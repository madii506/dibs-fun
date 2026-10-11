// POST /api/dibs?op=prepare {coin, caller}  open a dibs on a coin: returns a one-off deposit wallet and the exact amount
// GET  /api/dibs?op=status&id=              where a dibs is (and moves it forward)
// GET  /api/dibs?op=quote&coin=             the price now, the next price and where the money goes
const L = require('./_lib');
const E = require('./_engine');
const S = n => (n == null ? null : +(Number(n) / 1e9).toFixed(4));
const find = async key => (await L.q(`SELECT * FROM di_coins WHERE mint=$1 OR id=$1`, [String(key || '').slice(0, 64)]))[0];
const quote = c => { const p = Number(c.price), s = E.split(p); return { price: S(p), next: S(E.nextPrice(p)), toHolder: S(s.toPrev), burn: S(s.burn), treasury: S(s.cut), buffer: E.BUFFER / 1e9, holder: c.holder, holderSince: c.holder_since }; };

module.exports = async (req, res) => {
  const qy = L.query(req), op = String(qy.op || 'quote');
  if (!L.dbReady()) return L.send(res, 200, { ok: false, error: 'The engine’s records are offline.' });
  try {
    await L.ready();
    if (req.method === 'POST' && op === 'prepare') {
      if (L.limited('dibs:' + L.ip(req), 12, 600000)) return L.send(res, 200, { ok: false, error: 'Too many from here. Wait a few minutes.' });
      const b = await L.body(req, 4096);
      const caller = String(b.caller || '').trim();
      if (!L.isAddr(caller)) return L.send(res, 200, { ok: false, error: 'Connect a wallet (or paste your address): dibs and any refund go there.' });
      const c = await find(b.coin);
      if (!c) return L.send(res, 200, { ok: false, error: 'No coin with that address on DIBS.' });
      if (c.state !== 'live') return L.send(res, 200, { ok: false, error: 'That coin isn’t live yet.' });
      if (c.holder === caller) return L.send(res, 200, { ok: false, error: 'You already have dibs on this coin.' });
      const o = await E.prepareOrder(c, caller);
      return L.send(res, 200, { ok: true, ...o, coin: c.mint, symbol: c.symbol, priceSol: S(o.price), needSol: S(o.need), nextSol: S(o.next), toHolderSol: S(o.split.toPrev), burnSol: S(o.split.burn), treasurySol: S(o.split.cut) });
    }
    if (op === 'status') {
      const id = String(qy.id || '');
      if (!/^[A-Za-z0-9_-]{6,20}$/.test(id)) return L.send(res, 200, { ok: false, error: 'No such dibs.' });
      let [o] = await L.q(`SELECT * FROM di_orders WHERE id=$1`, [id]);
      if (!o) return L.send(res, 200, { ok: false, error: 'No such dibs.' });
      let r = {};
      if (['waiting', 'paying'].includes(o.state) || (!o.sig_refund && ['expired', 'refunded', 'outbid'].includes(o.state))) {
        try { r = await E.settle(o) || {}; } catch (e) { r = { error: String(e.message).slice(0, 160) }; }
        [o] = await L.q(`SELECT * FROM di_orders WHERE id=$1`, [id]);
      }
      const bal = o.state === 'waiting' ? (r.balance != null ? r.balance : await L.balance(o.wallet).catch(() => null)) : null;
      const [c] = await L.q(`SELECT mint, symbol, holder, price FROM di_coins WHERE id=$1`, [o.coin_id]);
      const logs = await L.q(`SELECT kind, text, sig, at FROM di_log WHERE id=$1 AND at >= $2 ORDER BY n DESC LIMIT 10`, [o.coin_id, o.created_at]);
      return L.send(res, 200, { ok: true, id: o.id, state: o.state, err: o.err, wallet: o.wallet, caller: o.caller, need: Number(o.need), needSol: S(o.need), balance: bal, priceSol: S(o.price_at),
        sigPay: o.sig_pay, sigBurn: o.sig_burn && !/^(sent:|skipped)/.test(o.sig_burn) ? o.sig_burn : null, sigRefund: o.sig_refund, prev: o.prev_holder, toPrevSol: S(o.to_prev), burnSol: S(o.burn), cutSol: S(o.cut),
        expiresAt: new Date(new Date(o.created_at).getTime() + E.ORDER_TTL).toISOString(), coin: c && { mint: c.mint, symbol: c.symbol, holder: c.holder, priceSol: S(c.price) }, busy: !!r.busy, note: r.note || r.error || null, logs });
    }
    const c = await find(qy.coin || qy.m);
    if (!c) return L.send(res, 200, { ok: false, error: 'No coin with that address on DIBS.' });
    L.send(res, 200, { ok: true, ...quote(c) }, L.CACHE(5));
  } catch (e) { L.send(res, 200, { ok: false, error: 'Something broke: ' + String(e && e.message).slice(0, 120) }); }
};
