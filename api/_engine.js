// The DIBS engine. It is custodial, and says so: every coin launched on DIBS has its own creator wallet, derived on this
// server from one master secret. pump.fun pays the coin's creator fees into it; the engine claims them and pays them to
// whoever holds the coin's dibs. Calling dibs is a deposit into a one-off wallet (also derived here): when it lands, the
// engine pays the outgoing holder their waiting fees, hands dibs to the caller, and splits the price: 90% to the outgoing
// holder, 5% buys the coin back and burns it, 5% to the $DIBS treasury. Every move is a public Solana transaction.
const crypto = require('crypto');
const L = require('./_lib');

let web3 = null, spl = null;
const w3 = () => web3 || (web3 = require('@solana/web3.js'));
const sp = () => spl || (spl = require('@solana/spl-token'));

const LAMPORTS = 1e9;
const RESERVE = 0.015 * LAMPORTS;          // stays in every coin wallet for gas and token-account rent
const CREATE_COST = 0.03 * LAMPORTS;       // pump.fun rent for a new coin, plus margin; whatever is unused goes back
const MIN_DEV = 0.01, MAX_DEV = 10;
const MIN_START = 0.05, MAX_START = 50;    // the first dibs price, in SOL
const STEP_BPS = 2000;                     // every dibs raises the price by 20%
const PREV_BPS = 9000, BURN_BPS = 500, CUT_BPS = 500;   // where a dibs payment goes
const BUFFER = 0.006 * LAMPORTS;           // sent with a dibs, covers the transactions; unused comes back
const ORDER_TTL = 30 * 60e3;               // an unfunded dibs is cancelled after 30 minutes
const CLAIM_MIN = 0.003 * LAMPORTS;
const PAY_MIN = Math.max(0.002, Number(process.env.PAY_MIN_SOL || 0.01)) * LAMPORTS;   // fees go to the holder once this much is waiting
const PORTAL = 'https://pumpportal.fun/api/trade-local';
const PRIORITY = Number(process.env.PRIORITY_FEE || 0.0002);
const need = devBuy => Math.ceil((CREATE_COST + devBuy * 1.02 * LAMPORTS + RESERVE) / 1e6) * 1e6;
const nextPrice = p => Math.ceil(Number(p) * (1e4 + STEP_BPS) / 1e4 / 1e5) * 1e5;   // rounded up to 0.0001 SOL
const split = price => { price = Number(price); const burn = Math.floor(price * BURN_BPS / 1e4), cut = L.TREASURY && L.isAddr(L.TREASURY) ? Math.floor(price * CUT_BPS / 1e4) : 0; return { burn, cut, toPrev: price - burn - cut }; };

// ---------- keys: derived, never stored ----------
let MASTER = null;
async function master() {
  if (MASTER) return MASTER;
  if (process.env.DIBS_MASTER && process.env.DIBS_MASTER.length >= 32) return (MASTER = process.env.DIBS_MASTER);
  await L.ready();
  await L.q(`INSERT INTO di_meta (k, v) VALUES ('master', $1) ON CONFLICT (k) DO NOTHING`, [crypto.randomBytes(32).toString('hex')]);
  const r = await L.q(`SELECT v FROM di_meta WHERE k='master'`);
  return (MASTER = r[0].v);
}
async function seedKey(tag) { const m = await master(); const { Keypair } = w3(); return Keypair.fromSeed(crypto.createHmac('sha256', m).update('dibs:' + tag).digest()); }
async function keys(id) { return { wallet: await seedKey('wallet:' + id), mint: await seedKey('mint:' + id) }; }
const orderKey = id => seedKey('order:' + id);
const newId = () => crypto.randomBytes(9).toString('base64url');

// ---------- leases: one worker per coin and per dibs at a time (requests and the engine pass can overlap) ----------
async function lease(key, ms = 55000) {
  const now = Date.now();
  const r = await L.q(`INSERT INTO di_meta (k, v) VALUES ($1, $2) ON CONFLICT (k) DO UPDATE SET v=EXCLUDED.v WHERE di_meta.v::bigint < $3 RETURNING v`, ['lease:' + key, String(now), now - ms]);
  return r.length > 0;
}
const unlease = key => L.q(`UPDATE di_meta SET v='0' WHERE k=$1`, ['lease:' + key]).catch(() => {});
async function leaseWait(key, waitMs = 20000) { const t0 = Date.now(); while (Date.now() - t0 < waitMs) { if (await lease(key)) return true; await new Promise(r => setTimeout(r, 1200)); } return false; }

// ---------- prices and markets ----------
async function solUsd() {
  return L.remember('solusd', 60000, async () => {
    if (L.MOCK && L.MOCK.solUsd) return L.MOCK.solUsd();
    try { const r = await L.getJson('https://api.coinbase.com/v2/prices/SOL-USD/spot', {}, 6000); const v = Number(r.json && r.json.data && r.json.data.amount); if (v > 0) return v; } catch {}
    const r = await L.getJson('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd', {}, 6000); const v = Number(r.json && r.json.solana && r.json.solana.usd);
    if (v > 0) return v; throw new Error('no SOL price');
  });
}
async function coinMarket(mint) {
  if (!L.isAddr(mint)) return { ok: false };
  return L.remember('cm:' + mint, 60000, async () => {
    try {
      const r = await L.getJson(`https://api.dexscreener.com/latest/dex/tokens/${mint}`, {}, 7000);
      const ps = ((r.json && r.json.pairs) || []).filter(p => p.chainId === 'solana').sort((a, b) => ((b.liquidity || {}).usd || 0) - ((a.liquidity || {}).usd || 0));
      if (ps.length) { const p = ps[0]; return { ok: true, mcapUsd: Number(p.marketCap || p.fdv || 0) || null, priceUsd: Number(p.priceUsd) || null, complete: p.dexId !== 'pumpfun', ch24h: (p.priceChange || {}).h24 ?? null, vol24: (p.volume || {}).h24 ?? null }; }
    } catch {}
    try {
      const [bc] = await L.accounts([L.bondingCurveOf(mint)]);
      if (bc && bc.data.length >= 49) {
        const vTok = Number(bc.data.readBigUInt64LE(8)), vSol = Number(bc.data.readBigUInt64LE(16)), rTok = Number(bc.data.readBigUInt64LE(24)), supply = Number(bc.data.readBigUInt64LE(40)), complete = bc.data[48] === 1;
        const s = await solUsd().catch(() => null);
        const mcapSol = vTok ? (vSol / 1e9) * (supply / vTok) : null;
        return { ok: true, mcapUsd: mcapSol && s ? mcapSol * s : null, mcapSol, complete, progress: complete ? 1 : Math.max(0, Math.min(1, (793100000e6 - rTok) / 793100000e6)) };
      }
    } catch {}
    return { ok: false };
  });
}

// ---------- sending ----------
async function blockhash() { const r = await L.rpc('getLatestBlockhash', [{ commitment: 'confirmed' }]); return r.value; }
async function confirm(sig, ms = 40000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try {
      const r = await L.rpc('getSignatureStatuses', [[sig], { searchTransactionHistory: false }]);
      const s = r.value && r.value[0];
      if (s) { if (s.err) return { ok: false, err: JSON.stringify(s.err) }; if (s.confirmationStatus === 'confirmed' || s.confirmationStatus === 'finalized') return { ok: true }; }
    } catch {}
    await new Promise(r => setTimeout(r, 1500));
  }
  return { ok: false, err: 'not confirmed in time' };
}
async function sendRaw(bytes, skipPreflight = false) {
  const b64 = Buffer.from(bytes).toString('base64');
  const j = await L.rpcRaw('sendTransaction', [b64, { encoding: 'base64', skipPreflight, maxRetries: 3, preflightCommitment: 'confirmed' }], 20000);
  if (j.error) { const logs = j.error.data && j.error.data.logs; throw new Error((j.error.message || 'send failed') + (logs ? ' | ' + logs.slice(-3).join(' | ') : '')); }
  return j.result;
}
async function sendAndConfirm(bytes) { const sig = await sendRaw(bytes); const c = await confirm(sig); if (!c.ok) { const e = new Error(c.err); e.sig = sig; throw e; } return sig; }
async function sendIxs(payer, ixs) {
  const { Transaction, ComputeBudgetProgram } = w3();
  const bh = await blockhash();
  const tx = new Transaction({ feePayer: payer.publicKey, blockhash: bh.blockhash, lastValidBlockHeight: bh.lastValidBlockHeight });
  tx.add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50000 }), ...ixs); tx.sign(payer);
  return sendAndConfirm(tx.serialize());
}
async function portal(args, signers) {
  if (L.MOCK && L.MOCK.portal) return L.MOCK.portal(args, signers);
  const r = await fetch(PORTAL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(args), signal: AbortSignal.timeout(15000) });
  if (r.status !== 200) throw new Error('pumpportal ' + r.status + ': ' + (await r.text().catch(() => '')).slice(0, 160));
  const { VersionedTransaction } = w3();
  const tx = VersionedTransaction.deserialize(new Uint8Array(await r.arrayBuffer()));
  tx.sign(signers); return tx;
}
const transfer = (from, to, lamports) => { const { SystemProgram, PublicKey } = w3(); return SystemProgram.transfer({ fromPubkey: from.publicKey, toPubkey: new PublicKey(to), lamports: Math.floor(lamports) }); };

// ---------- reading wallets ----------
async function mintInfo(mint) {
  return L.remember('mi:' + mint, 36e5, async () => { const [m] = await L.accounts([mint]); if (!m) throw new Error('mint not found'); return { program: m.owner, decimals: m.data[44] }; });
}
async function tokenBal(owner, mint) { const { program } = await mintInfo(mint); const [a] = await L.accounts([L.ataOf(owner, mint, program)]); return L.tokenAmount(a); }
async function waiting(wallet) {
  const v1 = L.creatorVaultOf(wallet), v2 = L.ammVaultOf(wallet);
  const [a, b] = await L.accounts([v1, L.ataOf(v2, L.SOL, L.TOKEN)]);
  return Math.max(0, (a ? a.lamports - L.RENT0 : 0)) + Number(L.tokenAmount(b));
}
async function chest(c) { return Math.max(0, (await L.balance(c.wallet)) - RESERVE); }

// ---------- the launch ----------
async function create(c) {
  const k = await keys(c.id);
  await L.log(c.id, 'launch', `deposit in. creating $${c.symbol} on pump.fun`);
  let sig;
  try {
    const tx = await portal({ publicKey: k.wallet.publicKey.toBase58(), action: 'create', tokenMetadata: { name: c.name, symbol: c.symbol, uri: c.meta_uri },
      mint: k.mint.publicKey.toBase58(), denominatedInSol: 'true', amount: c.dev_buy, slippage: 10, priorityFee: PRIORITY, pool: 'pump' }, [k.mint, k.wallet]);
    sig = await sendAndConfirm(tx.serialize());
  } catch (e) {
    const [bc] = await L.accounts([L.bondingCurveOf(c.mint)]).catch(() => [null]);
    if (!bc) {
      await L.q(`UPDATE di_coins SET state='failed', err=$2 WHERE id=$1`, [c.id, String(e.message).slice(0, 300)]);
      await L.log(c.id, 'error', 'launch failed: ' + String(e.message).slice(0, 200), { sig: e.sig });
      await refundLaunch(c, 'launch failed, deposit returned');
      return { ok: false, error: String(e.message) };
    }
    sig = e.sig || null;
  }
  await goLive(c, sig);
  await handOut(c, k).catch(e => L.log(c.id, 'error', 'sending the first buy back failed: ' + String(e.message).slice(0, 160)));
  return { ok: true, sig };
}
async function goLive(c, sig) {
  const r = await L.q(`UPDATE di_coins SET state='live', live_at=COALESCE(live_at, now()), holder_since=COALESCE(holder_since, now()), create_sig=COALESCE($2, create_sig), err=NULL WHERE id=$1 AND state<>'live' RETURNING id`, [c.id, sig]);
  if (!r.length) return;
  await L.q(`INSERT INTO di_reigns (coin_id, holder, paid_in) VALUES ($1,$2,0)`, [c.id, c.launcher]);
  await L.log(c.id, 'launch', `$${c.symbol} is live on pump.fun. dibs: ${short(c.launcher)} at ${sol(c.price)} SOL`, { sig, who: c.launcher });
}
async function handOut(c, k) {
  k = k || await keys(c.id);
  const { PublicKey, SystemProgram } = w3(); const S = sp();
  const owner = k.wallet.publicKey, to = new PublicKey(c.launcher), mint = new PublicKey(c.mint);
  const { program, decimals } = await mintInfo(c.mint); const prog = new PublicKey(program);
  const ixs = [];
  const amt = await tokenBal(owner.toBase58(), c.mint);
  if (amt > 0n) {
    const src = new PublicKey(L.ataOf(owner.toBase58(), c.mint, program)), dst = new PublicKey(L.ataOf(c.launcher, c.mint, program));
    ixs.push(S.createAssociatedTokenAccountIdempotentInstruction(owner, dst, to, mint, prog), S.createTransferCheckedInstruction(src, mint, dst, owner, amt, decimals, [], prog));
  }
  const bal = await L.balance(owner.toBase58());
  const extra = bal - RESERVE - 0.0025 * LAMPORTS;
  if (extra > 0.002 * LAMPORTS) ixs.push(SystemProgram.transfer({ fromPubkey: owner, toPubkey: to, lamports: Math.floor(extra) }));
  if (!ixs.length) return null;
  const sig = await sendIxs(k.wallet, ixs);
  await L.q(`UPDATE di_coins SET out_sig=$2 WHERE id=$1`, [c.id, sig]);
  await L.log(c.id, 'launch', `first buy${extra > 0.002 * LAMPORTS ? ' and unused SOL' : ''} sent back to the launcher`, { sig });
  return sig;
}
async function refundLaunch(c, why) {
  const k = await keys(c.id);
  const bal = await L.balance(k.wallet.publicKey.toBase58());
  const amt = bal - 10000;
  if (amt <= 0) return null;
  try {
    const sig = await sendIxs(k.wallet, [transfer(k.wallet, c.launcher, amt)]);
    await L.q(`UPDATE di_coins SET refund_sig=$2, state=CASE WHEN state='live' THEN state ELSE 'refunded' END WHERE id=$1`, [c.id, sig]);
    await L.log(c.id, 'refund', why, { sig, sol: amt / LAMPORTS });
    return sig;
  } catch (e) { await L.log(c.id, 'error', 'refund failed, will retry: ' + String(e.message).slice(0, 160)); return null; }
}
async function advance(c) {
  if (c.state === 'waiting') {
    const bal = await L.balance(c.wallet);
    if (bal >= Number(c.need) * 0.995) {
      const got = await L.q(`UPDATE di_coins SET state='creating', ticked_at=now() WHERE id=$1 AND state='waiting' RETURNING *`, [c.id]);
      if (got.length) return create(got[0]);
    } else if (Date.now() - new Date(c.created_at) > 3 * 36e5) {
      await L.q(`UPDATE di_coins SET state='expired' WHERE id=$1 AND state='waiting'`, [c.id]);
      if (bal > 10000) await refundLaunch({ ...c, state: 'expired' }, 'never fully funded, deposit returned');
    }
    return { ok: true, state: 'waiting', balance: bal };
  }
  if (c.state === 'creating' && Date.now() - new Date(c.ticked_at || c.created_at) > 4 * 6e4) {
    const [bc] = await L.accounts([L.bondingCurveOf(c.mint)]);
    if (bc) await goLive(c, null);
    else { await L.q(`UPDATE di_coins SET state='failed', err='creation did not land' WHERE id=$1`, [c.id]); await refundLaunch(c, 'launch did not land, deposit returned'); }
  }
  if ((c.state === 'expired' || c.state === 'failed') && !c.refund_sig) { const bal = await L.balance(c.wallet); if (bal > 10000) await refundLaunch(c, 'deposit returned'); }
  return { ok: true, state: c.state };
}

// ---------- fees: claimed into the coin wallet, paid to whoever has dibs ----------
async function claim(c, k) {
  const w = await waiting(c.wallet);
  if (w < CLAIM_MIN) return 0;
  const before = await L.balance(c.wallet);
  const tx = await portal({ publicKey: c.wallet, action: 'collectCreatorFee', priorityFee: 0.00001, pool: 'pump' }, [k.wallet]);
  const sig = await sendAndConfirm(tx.serialize());
  const got = Math.max(0, (await L.balance(c.wallet)) - before);
  if (got <= 0) return 0;
  await L.q(`UPDATE di_coins SET claimed = claimed + $2 WHERE id=$1`, [c.id, got]);
  await L.log(c.id, 'claim', `claimed ${sol(got)} SOL of creator fees`, { sig, sol: got / LAMPORTS });
  return got;
}
async function payHolder(c, k, min = PAY_MIN) {
  const pot = await chest(c);
  if (pot < min || pot < 0.001 * LAMPORTS) return null;
  const sig = await sendIxs(k.wallet, [transfer(k.wallet, c.holder, pot)]);
  await L.q(`INSERT INTO di_pay (coin_id, holder, lamports, sig) VALUES ($1,$2,$3,$4)`, [c.id, c.holder, pot, sig]);
  await L.q(`UPDATE di_coins SET paid = paid + $2 WHERE id=$1`, [c.id, pot]);
  await L.q(`UPDATE di_reigns SET fees = fees + $3 WHERE n = (SELECT n FROM di_reigns WHERE coin_id=$1 AND holder=$2 AND ended_at IS NULL ORDER BY n DESC LIMIT 1)`, [c.id, c.holder, pot]);
  await L.log(c.id, 'pay', `paid ${sol(pot)} SOL of fees to the dibs holder ${short(c.holder)}`, { sig, sol: pot / LAMPORTS, who: c.holder });
  return sig;
}

// ---------- calling dibs ----------
// A dibs is a one-off deposit wallet. Once it holds the price (+ a small buffer for fees), settle():
//   1. claims the coin's waiting creator fees and pays them to the outgoing holder (they earned them),
//   2. hands dibs to the caller and raises the price 20%, in one statement (so a crash can't half-apply it),
//   3. pays the outgoing holder 90% (+ the treasury's 5% to the treasury, or to the holder while there is none),
//   4. buys the coin with the last 5% and burns what it bought,
//   5. returns whatever is left of the buffer to the caller.
// Steps 3–5 are idempotent: each one checks the chain before it acts, so a retry never pays twice.
async function prepareOrder(c, caller) {
  const id = newId(); const k = await orderKey(id);
  const price = Number(c.price), needL = price + BUFFER;
  await L.q(`INSERT INTO di_orders (id, coin_id, caller, wallet, price_at, need) VALUES ($1,$2,$3,$4,$5,$6)`, [id, c.id, caller, k.publicKey.toBase58(), price, needL]);
  return { id, wallet: k.publicKey.toBase58(), price, need: needL, next: nextPrice(price), split: split(price), expiresAt: new Date(Date.now() + ORDER_TTL).toISOString() };
}
async function refundOrder(o, k, why, state) {
  // claim the order first: only one worker may refund it, and never one that has taken dibs
  const from = o.state === 'waiting' ? 'waiting' : state;
  const got = await L.q(`UPDATE di_orders SET state=$2, err=$3, done_at=COALESCE(done_at, now()) WHERE id=$1 AND state=$4 AND sig_refund IS NULL RETURNING id`, [o.id, state, why, from]);
  if (!got.length) return { state: (await L.q(`SELECT state FROM di_orders WHERE id=$1`, [o.id]))[0].state };
  const bal = await L.balance(o.wallet); let sig = null;
  if (bal > 15000) {
    try { sig = await sendIxs(k, [transfer(k, o.caller, bal - 10000)]); }
    catch (e) { await L.log(o.coin_id, 'error', 'dibs refund failed, will retry: ' + String(e.message).slice(0, 140)); return { state }; }
    await L.q(`UPDATE di_orders SET sig_refund=$2 WHERE id=$1`, [o.id, sig]);
    await L.log(o.coin_id, 'refund', `dibs not taken (${why}); ${sol(bal - 10000)} SOL returned to ${short(o.caller)}`, { sig, sol: (bal - 10000) / LAMPORTS, who: o.caller });
  }
  return { state, refund: sig };
}
async function settle(o) {
  const k = await orderKey(o.id);
  if (k.publicKey.toBase58() !== o.wallet) throw new Error('key mismatch');
  if (!(await lease('o:' + o.id, 90000))) return { state: o.state, busy: true };
  try {
    o = (await L.q(`SELECT * FROM di_orders WHERE id=$1`, [o.id]))[0];
    if (o.state === 'waiting') {
      const bal = await L.balance(o.wallet);
      if (bal < Number(o.need) - 2000) {
        if (Date.now() - new Date(o.created_at) > ORDER_TTL) return refundOrder(o, k, 'not funded in 30 minutes', 'expired');
        return { state: 'waiting', balance: bal };
      }
      let [c] = await L.q(`SELECT * FROM di_coins WHERE id=$1`, [o.coin_id]);
      if (!c || c.state !== 'live') return refundOrder(o, k, 'the coin is not live', 'refunded');
      if (c.holder === o.caller) return refundOrder(o, k, 'you already have dibs', 'refunded');
      if (Number(c.price) > Number(o.price_at)) return refundOrder(o, k, `someone called dibs first; the price is now ${sol(c.price)} SOL`, 'outbid');
      // the coin itself: one worker at a time, so fees can't be paid twice
      if (!(await leaseWait('c:' + c.id, 25000))) return { state: 'waiting', busy: true, note: 'the coin is busy; retrying' };
      try {
        [c] = await L.q(`SELECT * FROM di_coins WHERE id=$1`, [o.coin_id]);
        if (c.holder === o.caller) return refundOrder(o, k, 'you already have dibs', 'refunded');
        if (Number(c.price) > Number(o.price_at)) return refundOrder(o, k, `someone called dibs first; the price is now ${sol(c.price)} SOL`, 'outbid');
        const ck = await keys(c.id);
        // the outgoing holder keeps every fee earned while they had dibs
        try { await claim(c, ck); } catch (e) { await L.log(c.id, 'error', 'claim before dibs failed: ' + String(e.message).slice(0, 140)); }
        try { await payHolder(c, ck, 0); } catch (e) { await L.log(c.id, 'error', 'paying the outgoing holder failed: ' + String(e.message).slice(0, 140)); }
        const price = Number(c.price), s = split(price), np = nextPrice(price);
        const won = await L.q(`WITH c AS (
            UPDATE di_coins SET holder=$2, price=$3, holder_since=now(), reigns=reigns+1, last_dibs_at=now(), dibs_volume=dibs_volume+$4
            WHERE id=$1 AND holder=$5 AND price=$4 AND state='live' AND EXISTS (SELECT 1 FROM di_orders WHERE id=$9 AND state='waiting') RETURNING id),
          o AS (UPDATE di_orders SET state='paying', price=$4, prev_holder=$5, to_prev=$6, burn=$7, cut=$8 WHERE id=$9 AND state='waiting' AND EXISTS (SELECT 1 FROM c) RETURNING id),
          r1 AS (UPDATE di_reigns SET ended_at=now(), paid_out=$6
            WHERE n = (SELECT n FROM di_reigns WHERE coin_id=$1 AND holder=$5 AND ended_at IS NULL ORDER BY n DESC LIMIT 1) AND EXISTS (SELECT 1 FROM c) RETURNING n),
          r2 AS (INSERT INTO di_reigns (coin_id, holder, paid_in, order_id) SELECT $1, $2, $4, $9 WHERE EXISTS (SELECT 1 FROM c) RETURNING n)
          SELECT (SELECT count(*) FROM c)::int AS won`, [c.id, o.caller, np, price, c.holder, s.toPrev, s.burn, s.cut, o.id]);
        if (!won[0] || !won[0].won) return { state: 'waiting', note: 'raced; retrying' };
        await L.log(c.id, 'dibs', `${short(o.caller)} called dibs on $${c.symbol} for ${sol(price)} SOL. next dibs: ${sol(np)} SOL`, { sol: price / LAMPORTS, who: o.caller });
      } finally { await unlease('c:' + c.id); }
      o = (await L.q(`SELECT * FROM di_orders WHERE id=$1`, [o.id]))[0];
    }
    if (o.state === 'paying') return await pay(o, k);
    if (['expired', 'refunded', 'outbid'].includes(o.state) && !o.sig_refund) {
      const bal = await L.balance(o.wallet);
      if (bal > 15000) return refundOrder(o, k, o.err || 'returned', o.state);
    }
    return { state: o.state };
  } finally { await unlease('o:' + o.id); }
}
async function lastSig(addr) {
  try { const r = await L.rpc('getSignaturesForAddress', [addr, { limit: 5, commitment: 'confirmed' }]); const ok = (r || []).find(x => !x.err); return ok ? ok.signature : null; } catch { return null; }
}
async function pay(o, k) {
  const [c] = await L.q(`SELECT * FROM di_coins WHERE id=$1`, [o.coin_id]);
  const toPrev = Number(o.to_prev), cut = Number(o.cut), burn = Number(o.burn);
  // 3. the outgoing holder (and the treasury)
  if (!o.sig_pay) {
    const bal = await L.balance(o.wallet);
    let sig;
    if (bal < toPrev + cut + 5000) sig = (await lastSig(o.wallet)) || 'sent';      // it already went out; a retry must not send it twice
    else {
      const ixs = [transfer(k, o.prev_holder, toPrev)];
      if (cut > 0) ixs.push(transfer(k, L.TREASURY, cut));
      sig = await sendIxs(k, ixs);
      await L.log(o.coin_id, 'payout', `${sol(toPrev)} SOL to ${short(o.prev_holder)} for losing dibs${cut ? `; ${sol(cut)} SOL to the $DIBS treasury` : ''}`, { sig, sol: toPrev / LAMPORTS, who: o.prev_holder });
    }
    await L.q(`UPDATE di_orders SET sig_pay=$2 WHERE id=$1`, [o.id, sig]);
    o.sig_pay = sig;
  }
  // 4. buy back and burn
  if (!o.sig_burn && burn > 0) {
    let note = null;
    try { note = await buyAndBurn(c, k, burn); }
    catch (e) {
      // the burn share never goes back to the caller: if the buyback can't run, it goes to the outgoing holder
      const bal = await L.balance(o.wallet);
      const amt = Math.min(burn, bal - 15000);
      const held = await tokenBal(o.wallet, c.mint).catch(() => 0n);
      if (held > 0n) throw new Error('burn will retry: ' + String(e.message).slice(0, 80));
      if (amt > 0.001 * LAMPORTS) {
        const sig = await sendIxs(k, [transfer(k, o.prev_holder, amt)]).catch(() => null);
        if (sig) { note = 'sent:' + sig; await L.log(o.coin_id, 'payout', `the buyback couldn't run (${String(e.message).slice(0, 80)}), so its ${sol(amt)} SOL went to ${short(o.prev_holder)}`, { sig, sol: amt / LAMPORTS, who: o.prev_holder }); }
      } else note = 'skipped';
    }
    if (!note) throw new Error('burn step failed; will retry');
    await L.q(`UPDATE di_orders SET sig_burn=$2 WHERE id=$1`, [o.id, note]);
  }
  // 5. the unused buffer back to the caller
  const bal = await L.balance(o.wallet); let rs = null;
  if (bal > 15000) rs = await sendIxs(k, [transfer(k, o.caller, bal - 10000)]).catch(() => null);
  if (bal > 15000 && !rs) throw new Error('change refund failed; will retry');
  await L.q(`UPDATE di_orders SET state='done', sig_refund=COALESCE($2, sig_refund), done_at=now() WHERE id=$1 AND state='paying'`, [o.id, rs]);
  return { state: 'done' };
}
async function buyAndBurn(c, k, lamports) {
  const owner = k.publicKey.toBase58();
  let held = await tokenBal(owner, c.mint).catch(() => 0n), s1 = null, spent = 0;
  if (held === 0n) {
    // spend the burn share, leaving room for the token account's rent and pump.fun's fee
    const bal = await L.balance(owner);
    const budget = Math.min(lamports, bal - 0.00204 * LAMPORTS - 0.0015 * LAMPORTS);
    const amt = Math.floor(budget / 1.03 / 1000) * 1000;
    if (amt < 0.001 * LAMPORTS) throw new Error('too little for a buyback');
    const tx = await portal({ publicKey: owner, action: 'buy', mint: c.mint, denominatedInSol: 'true', amount: +(amt / LAMPORTS).toFixed(6), slippage: 15, priorityFee: PRIORITY, pool: 'auto' }, [k]);
    s1 = await sendAndConfirm(tx.serialize());
    spent = amt;
    held = await tokenBal(owner, c.mint);
    if (held <= 0n) throw new Error('the buy landed but no tokens arrived yet');
  }
  const { PublicKey } = w3(); const S = sp(); const { program, decimals } = await mintInfo(c.mint); const prog = new PublicKey(program);
  const ata = new PublicKey(L.ataOf(owner, c.mint, program));
  const s2 = await sendIxs(k, [S.createBurnCheckedInstruction(ata, new PublicKey(c.mint), k.publicKey, held, decimals, [], prog), S.createCloseAccountInstruction(ata, k.publicKey, k.publicKey, [], prog)]);
  await L.q(`UPDATE di_coins SET burned = burned + $2, burned_tokens = burned_tokens + $3 WHERE id=$1`, [c.id, spent || lamports, String(held)]);
  const ui = Number(held) / 10 ** decimals, fmt = ui >= 1e6 ? (ui / 1e6).toFixed(2) + 'M' : ui >= 1e3 ? (ui / 1e3).toFixed(1) + 'K' : ui.toFixed(0);
  await L.log(c.id, 'burn', `${spent ? sol(spent) + ' SOL bought back ' : 'bought back '}${fmt} $${c.symbol} and burned it`, { sig: s2, sol: (spent || lamports) / LAMPORTS });
  return s2 || s1;
}

// ---------- one pass ----------
async function tickCoin(c) {
  if (!(await lease('c:' + c.id, 90000))) return;
  try { await tickCoin1(c); } finally { await unlease('c:' + c.id); }
}
async function tickCoin1(c) {
  const k = await keys(c.id);
  if (k.wallet.publicKey.toBase58() !== c.wallet) throw new Error('key mismatch');
  try { await claim(c, k); } catch (e) { await L.log(c.id, 'error', 'claim failed: ' + String(e.message).slice(0, 160)); }
  const m = await coinMarket(c.mint).catch(() => ({ ok: false }));
  if (m.ok) await L.q(`UPDATE di_coins SET mcap_usd=$2, complete=$3 WHERE id=$1`, [c.id, m.mcapUsd, !!m.complete]);
  try { await payHolder(c, k); } catch (e) { await L.log(c.id, 'error', 'fee payout waits: ' + String(e.message).slice(0, 160), { sig: e.sig }); }
  await L.q(`UPDATE di_coins SET ticked_at=now() WHERE id=$1`, [c.id]);
}
async function tick(budgetMs = 40000) {
  await L.ready();
  const lock = await L.q(`INSERT INTO di_meta (k, v) VALUES ('tick', $1) ON CONFLICT (k) DO UPDATE SET v=EXCLUDED.v WHERE di_meta.v::bigint < $2 RETURNING v`, [String(Date.now()), Date.now() - 50000]);
  if (!lock.length) return { ok: true, skipped: 'another pass is running or ran under a minute ago' };
  const deadline = Date.now() + budgetMs; const done = { launches: 0, dibs: 0, coins: 0, errors: 0 };
  const pend = await L.q(`SELECT * FROM di_coins WHERE state IN ('waiting','creating') OR (state IN ('expired','failed') AND refund_sig IS NULL) ORDER BY created_at LIMIT 20`);
  for (const c of pend) { if (Date.now() > deadline) break; try { await advance(c); done.launches++; } catch { done.errors++; } }
  const orders = await L.q(`(SELECT * FROM di_orders WHERE state IN ('waiting','paying') ORDER BY (state='paying') DESC, created_at LIMIT 30)
    UNION ALL (SELECT * FROM di_orders WHERE state IN ('expired','refunded','outbid') AND sig_refund IS NULL AND done_at > now() - interval '2 days' ORDER BY done_at DESC LIMIT 8)`);
  for (const o of orders) { if (Date.now() > deadline) break; try { await settle(o); done.dibs++; } catch (e) { done.errors++; await L.log(o.coin_id, 'error', 'dibs step: ' + String(e.message).slice(0, 160)); } }
  const live = await L.q(`SELECT * FROM di_coins WHERE state='live' ORDER BY ticked_at NULLS FIRST LIMIT 30`);
  for (const c of live) { if (Date.now() > deadline - 8000) break; try { await tickCoin(c); done.coins++; } catch (e) { done.errors++; await L.log(c.id, 'error', 'tick: ' + String(e.message).slice(0, 160)); } }
  return { ok: true, ...done, at: new Date().toISOString() };
}

function sol(l) { return (Number(l) / LAMPORTS).toFixed(4).replace(/\.?0+$/, '') || '0'; }
function short(a) { return a ? String(a).slice(0, 4) + '…' + String(a).slice(-4) : ''; }

module.exports = { keys, orderKey, newId, need, nextPrice, split, advance, settle, prepareOrder, tick, lease, unlease, blockhash, sendRaw, confirm, portal, waiting, chest, coinMarket, solUsd,
  RESERVE, CREATE_COST, MIN_DEV, MAX_DEV, MIN_START, MAX_START, STEP_BPS, PREV_BPS, BURN_BPS, CUT_BPS, BUFFER, ORDER_TTL, PAY_MIN, LAMPORTS };
