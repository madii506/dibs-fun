// GET /api/coins                  every live coin on DIBS
// GET /api/coins?m=<mint>|id=     one coin: its holder, every reign, fee payouts and the engine log
// GET /api/coins?op=activity      the latest dibs, payouts, burns and launches across every coin
// GET /api/coins?op=stats         totals
// GET /api/coins?op=hall          the hall of dibs: top earners, longest reigns, biggest dibs
// GET /api/coins?op=me&w=         one wallet: dibs held now, past reigns, fees received, coins launched
const L = require('./_lib');
const E = require('./_engine');
const S = n => (n == null ? null : +(Number(n) / 1e9).toFixed(4));
const pub = (c, site) => ({ id: c.id, n: c.n, mint: c.mint, name: c.name, symbol: c.symbol, state: c.state, img: site + '/i/' + c.id, holder: c.holder, holderSince: c.holder_since,
  priceSol: S(c.price), nextSol: S(E.nextPrice(c.price)), startSol: S(c.start_price), reigns: c.reigns, dibsVolumeSol: S(c.dibs_volume), paidSol: S(c.paid), claimedSol: S(c.claimed),
  burnedSol: S(c.burned), mcapUsd: c.mcap_usd, complete: c.complete, lastDibsAt: c.last_dibs_at, liveAt: c.live_at, launcher: c.launcher });

module.exports = async (req, res) => {
  const qy = L.query(req);
  if (!L.dbReady()) return L.send(res, 200, { ok: true, offline: true, coins: [], log: [] });
  try {
    await L.ready(); const site = L.origin(req);
    if (qy.op === 'activity') {
      const kinds = qy.kind && /^[a-z]+$/.test(qy.kind) ? [qy.kind] : ['dibs', 'payout', 'pay', 'burn', 'launch'];
      const r = await L.q(`SELECT l.kind, l.text, l.sig, l.sol, l.who, l.at, c.symbol, c.mint, c.id AS cid FROM di_log l JOIN di_coins c ON c.id = l.id
        WHERE l.kind = ANY($1) AND c.state IN ('live') ORDER BY l.n DESC LIMIT 60`, [kinds]);
      return L.send(res, 200, { ok: true, log: r.map(x => ({ ...x, img: site + '/i/' + x.cid })) }, L.CACHE(8));
    }
    if (qy.op === 'stats') {
      const [r] = await L.q(`SELECT count(*)::int AS live, COALESCE(sum(reigns-1),0)::int AS dibs, COALESCE(sum(dibs_volume),0)::bigint AS volume, COALESCE(sum(paid),0)::bigint AS fees,
        COALESCE(sum(burned),0)::bigint AS burned, count(DISTINCT holder)::int AS holders FROM di_coins WHERE state='live'`);
      const [o] = await L.q(`SELECT COALESCE(sum(to_prev),0)::bigint AS to_prev, COALESCE(sum(cut),0)::bigint AS cut FROM di_orders WHERE state IN ('paying','done')`);
      const t = await L.q(`SELECT v FROM di_meta WHERE k='tick'`).catch(() => []);
      return L.send(res, 200, { ok: true, live: r.live, dibs: r.dibs, holders: r.holders, volumeSol: S(r.volume), feesSol: S(r.fees), burnedSol: S(r.burned), toHoldersSol: S(o.to_prev), treasurySol: S(o.cut),
        lastTick: t.length && Number(t[0].v) > 0 ? new Date(Number(t[0].v)).toISOString() : null }, L.CACHE(10));
    }
    if (qy.op === 'hall') {
      const earners = await L.q(`SELECT holder, count(*)::int AS reigns, COALESCE(sum(fees),0)::bigint AS fees, COALESCE(sum(paid_out),0)::bigint AS paid_out, COALESCE(sum(paid_in),0)::bigint AS paid_in,
        (COALESCE(sum(fees),0) + COALESCE(sum(paid_out),0) - COALESCE(sum(paid_in),0))::bigint AS net FROM di_reigns GROUP BY holder ORDER BY net DESC LIMIT 15`);
      const longest = await L.q(`SELECT r.holder, r.started_at, r.ended_at, EXTRACT(EPOCH FROM (COALESCE(r.ended_at, now()) - r.started_at))::bigint AS secs, c.symbol, c.mint FROM di_reigns r JOIN di_coins c ON c.id=r.coin_id
        WHERE c.state='live' ORDER BY secs DESC LIMIT 10`);
      const biggest = await L.q(`SELECT r.holder, r.paid_in, r.started_at, c.symbol, c.mint FROM di_reigns r JOIN di_coins c ON c.id=r.coin_id WHERE r.order_id IS NOT NULL ORDER BY r.paid_in DESC LIMIT 10`);
      const callers = await L.q(`SELECT holder, count(*)::int AS dibs FROM di_reigns WHERE order_id IS NOT NULL GROUP BY holder ORDER BY dibs DESC LIMIT 10`);
      return L.send(res, 200, { ok: true, earners: earners.map(e => ({ holder: e.holder, reigns: e.reigns, feesSol: S(e.fees), paidOutSol: S(e.paid_out), paidInSol: S(e.paid_in), netSol: S(e.net) })),
        longest: longest.map(x => ({ holder: x.holder, secs: Number(x.secs), live: !x.ended_at, symbol: x.symbol, mint: x.mint })), biggest: biggest.map(x => ({ holder: x.holder, sol: S(x.paid_in), at: x.started_at, symbol: x.symbol, mint: x.mint })), callers }, L.CACHE(15));
    }
    if (qy.op === 'me') {
      const w = String(qy.w || '');
      if (!L.isAddr(w)) return L.send(res, 200, { ok: false, error: 'That isn’t a Solana address.' });
      const holding = await L.q(`SELECT * FROM di_coins WHERE holder=$1 AND state='live' ORDER BY holder_since DESC`, [w]);
      const reigns = await L.q(`SELECT r.*, c.symbol, c.mint FROM di_reigns r JOIN di_coins c ON c.id=r.coin_id WHERE r.holder=$1 ORDER BY r.n DESC LIMIT 50`, [w]);
      const pays = await L.q(`SELECT p.lamports, p.sig, p.at, c.symbol, c.mint FROM di_pay p JOIN di_coins c ON c.id=p.coin_id WHERE p.holder=$1 ORDER BY p.n DESC LIMIT 50`, [w]);
      const launched = await L.q(`SELECT * FROM di_coins WHERE launcher=$1 AND state='live' ORDER BY n DESC LIMIT 30`, [w]);
      const open = await L.q(`SELECT o.id, o.state, o.price_at, o.created_at, c.symbol, c.mint FROM di_orders o JOIN di_coins c ON c.id=o.coin_id WHERE o.caller=$1 ORDER BY o.n DESC LIMIT 20`, [w]);
      return L.send(res, 200, { ok: true, holding: holding.map(c => pub(c, site)), launched: launched.map(c => pub(c, site)),
        reigns: reigns.map(r => ({ symbol: r.symbol, mint: r.mint, start: r.started_at, end: r.ended_at, paidInSol: S(r.paid_in), feesSol: S(r.fees), paidOutSol: S(r.paid_out) })),
        payouts: pays.map(p => ({ sol: S(p.lamports), sig: p.sig, at: p.at, symbol: p.symbol, mint: p.mint })), orders: open.map(o => ({ id: o.id, state: o.state, priceSol: S(o.price_at), at: o.created_at, symbol: o.symbol, mint: o.mint })) }, L.CACHE(5));
    }
    const key = String(qy.m || qy.mint || qy.id || '');
    if (key) {
      const r = await L.q(`SELECT * FROM di_coins WHERE mint=$1 OR id=$1`, [key.slice(0, 64)]);
      if (!r.length) return L.send(res, 200, { ok: false, error: 'No coin with that address on DIBS.' });
      const c = r[0];
      const reigns = await L.q(`SELECT n, holder, started_at, ended_at, paid_in, fees, paid_out, order_id FROM di_reigns WHERE coin_id=$1 ORDER BY n DESC LIMIT 100`, [c.id]);
      const pays = await L.q(`SELECT holder, lamports, sig, at FROM di_pay WHERE coin_id=$1 ORDER BY n DESC LIMIT 50`, [c.id]);
      const log = await L.q(`SELECT kind, text, sig, sol, at FROM di_log WHERE id=$1 AND kind<>'error' ORDER BY n DESC LIMIT 60`, [c.id]);
      let chest = null, waiting = null, market = null;
      if (c.state === 'live') [chest, waiting, market] = await Promise.all([E.chest(c).catch(() => null), E.waiting(c.wallet).catch(() => null), E.coinMarket(c.mint).catch(() => null)]);
      const s = E.split(c.price);
      return L.send(res, 200, { ok: true, coin: { ...pub(c, site), wallet: c.wallet, description: c.description, twitter: c.twitter, website: c.website, createSig: c.create_sig, metaUri: c.meta_uri,
        chestSol: S(chest), waitingSol: S(waiting), payMinSol: E.PAY_MIN / 1e9, market: market && market.ok ? market : null, err: c.err, toHolderSol: S(s.toPrev), burnSol: S(s.burn), treasurySol: S(s.cut) },
        reigns: reigns.map(x => ({ n: Number(x.n), holder: x.holder, start: x.started_at, end: x.ended_at, paidInSol: S(x.paid_in), feesSol: S(x.fees), paidOutSol: S(x.paid_out), dibs: !!x.order_id })),
        payouts: pays.map(p => ({ holder: p.holder, sol: S(p.lamports), sig: p.sig, at: p.at })), log }, L.CACHE(4));
    }
    const sort = { new: 'n DESC', price: 'price DESC', fees: 'paid DESC', reigns: 'reigns DESC' }[qy.sort] || 'COALESCE(last_dibs_at, live_at) DESC';
    const r = await L.q(`SELECT * FROM di_coins WHERE state='live' ORDER BY ${sort} LIMIT 200`);
    L.send(res, 200, { ok: true, coins: r.map(c => pub(c, site)) }, L.CACHE(8));
  } catch (e) { L.send(res, 200, { ok: false, error: 'The records didn’t answer just now.' }); }
};
