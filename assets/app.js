/* DIBS: every number on this site is read live from the engine's records or from Solana. Nothing is made up. */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches;
const FINE = matchMedia('(hover: hover) and (pointer: fine)').matches;
async function api(path, opt = {}) {
  try { const r = await fetch(path, { ...opt, signal: AbortSignal.timeout(opt.ms || 25000) }); return await r.json(); }
  catch { return { ok: false, error: 'The server didn’t answer. Check your connection and try again.' }; }
}
const post = (path, body) => api(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), ms: 60000 });
const sol = n => n == null ? '—' : (+n >= 100 ? (+n).toFixed(1) : (+n).toFixed(4).replace(/\.?0+$/, '') || '0') + ' SOL';
const num = n => n == null ? '—' : (+n >= 100 ? (+n).toFixed(1) : (+n).toFixed(4).replace(/\.?0+$/, '') || '0');
const usd = n => n == null || !isFinite(n) ? '—' : n >= 1e6 ? '$' + (n / 1e6).toFixed(2) + 'M' : n >= 1e3 ? '$' + (n / 1e3).toFixed(1) + 'K' : '$' + Math.round(n);
const short = (a, n = 4) => a ? String(a).slice(0, n) + '…' + String(a).slice(-n) : '';
const tx = s => 'https://solscan.io/tx/' + s, acct = a => 'https://solscan.io/account/' + a;
function ago(t) { if (!t) return '—'; const s = Math.max(0, (Date.now() - new Date(t)) / 1000); return s < 60 ? Math.floor(s) + 's' : s < 3600 ? Math.floor(s / 60) + 'm' : s < 86400 ? Math.floor(s / 3600) + 'h' : Math.floor(s / 86400) + 'd'; }
function dur(s) { s = Math.max(0, Math.floor(s)); const d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60), x = s % 60; return d ? `${d}d ${h}h ${m}m` : h ? `${h}h ${m}m ${x}s` : `${m}m ${x}s`; }
function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('on'), 2400); }
async function copy(text, what = 'Copied') { try { await navigator.clipboard.writeText(text); toast(what); } catch { toast('Copy failed'); } }
document.addEventListener('click', e => { const b = e.target.closest('[data-copy]'); if (b) { e.preventDefault(); copy(b.dataset.copy, b.dataset.what || 'Copied'); } });
const ext = (href, label, cls = 'b sm') => `<a class="${cls}" href="${esc(href)}" target="_blank" rel="noopener">${label}</a>`;

// ---------- a face for every wallet: drawn from the address, the same face everywhere ----------
const FACE = ['#FFD23F', '#ffb08a', '#7cc6ff', '#b9f3cf', '#ffb3c7', '#d7c4ff', '#fff3c4'];
function hash(s) { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function face(addr, cls = '') {
  const h = hash(addr || 'x'), f = FACE[h % FACE.length], e = (h >> 3) % 4, m = (h >> 6) % 4, hat = (h >> 9) % 5;
  const eyes = [`<circle cx="15" cy="19" r="2.6"/><circle cx="25" cy="19" r="2.6"/>`, `<path d="M12 19h6M22 19h6" stroke="#141414" stroke-width="2.6" stroke-linecap="round"/>`,
    `<circle cx="15" cy="19" r="3.4" fill="#fff" stroke="#141414" stroke-width="2"/><circle cx="25" cy="19" r="3.4" fill="#fff" stroke="#141414" stroke-width="2"/><circle cx="15.6" cy="19.4" r="1.5"/><circle cx="25.6" cy="19.4" r="1.5"/>`,
    `<path d="M12 20q3-4 6 0M22 20q3-4 6 0" fill="none" stroke="#141414" stroke-width="2.4" stroke-linecap="round"/>`][e];
  const mouth = [`<path d="M14 26q6 6 12 0" fill="none" stroke="#141414" stroke-width="2.6" stroke-linecap="round"/>`, `<path d="M15 27h10" stroke="#141414" stroke-width="2.6" stroke-linecap="round"/>`,
    `<ellipse cx="20" cy="27.5" rx="3.2" ry="2.6" fill="#141414"/>`, `<path d="M14 26q6 5 12 0z" fill="#141414"/>`][m];
  const top = ['', `<path d="M10 11q10-9 20 0" fill="none" stroke="#141414" stroke-width="3" stroke-linecap="round"/>`, `<rect x="12" y="2" width="16" height="7" rx="2" fill="#141414"/><rect x="9" y="8" width="22" height="3" rx="1.5" fill="#141414"/>`,
    `<path d="M20 2l3 6h-6z" fill="#FFD23F" stroke="#141414" stroke-width="2"/>`, `<circle cx="20" cy="4" r="3" fill="#ff5a4e" stroke="#141414" stroke-width="2"/>`][hat];
  return `<svg class="av ${cls}" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="21" r="16.5" fill="${f}" stroke="#141414" stroke-width="3"/>${top}<g fill="#141414">${eyes}</g>${mouth}</svg>`;
}
const who = (a, me) => `<a class="who" href="/me?w=${esc(a)}">${face(a)}<span class="mono">${me && WAL && a === WAL.pk ? 'you' : short(a)}</span></a>`;
const HAND = `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="22" y="6" width="11" height="34" rx="5.5" fill="#FFD23F" stroke="#141414" stroke-width="3.5"/><rect x="22" y="30" width="22" height="22" rx="8" fill="#FFD23F" stroke="#141414" stroke-width="3.5"/><path d="M33 36h11M33 44h11" stroke="#141414" stroke-width="3"/><rect x="22" y="52" width="22" height="7" rx="2" fill="#fff" stroke="#141414" stroke-width="3"/></svg>`;
const COINS = `<svg viewBox="0 0 64 64" aria-hidden="true"><ellipse cx="32" cy="44" rx="18" ry="7" fill="#fff" stroke="#141414" stroke-width="3.5"/><ellipse cx="32" cy="33" rx="18" ry="7" fill="#fff" stroke="#141414" stroke-width="3.5"/><ellipse cx="32" cy="22" rx="18" ry="7" fill="#fff" stroke="#141414" stroke-width="3.5"/></svg>`;
const UP = `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M32 50V14M18 28l14-14 14 14" fill="none" stroke="#141414" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

// ---------- wallet ----------
const wallets = () => [
  { id: 'phantom', name: 'Phantom', p: (window.phantom && window.phantom.solana) || (window.solana && window.solana.isPhantom ? window.solana : null) },
  { id: 'solflare', name: 'Solflare', p: window.solflare && window.solflare.isSolflare ? window.solflare : null },
  { id: 'backpack', name: 'Backpack', p: window.backpack && (window.backpack.solana || window.backpack) },
].filter(w => w.p);
let WAL = null;
async function connect() {
  const ws = wallets();
  if (!ws.length) { toast('No Solana wallet in this browser. You can paste your address instead.'); return null; }
  const w = ws[0];
  try { const r = await w.p.connect(); const pk = (r && r.publicKey) || w.p.publicKey; WAL = { ...w, pk: pk.toString() }; try { localStorage.setItem('dibs:w', w.id); } catch {} paintWallet(); return WAL; }
  catch { toast('Wallet connection was cancelled'); return null; }
}
function paintWallet() { $$('[data-connect]').forEach(b => { b.innerHTML = WAL ? face(WAL.pk) + short(WAL.pk) : 'Connect'; }); $$('[data-mywallet]').forEach(f => { if (WAL && !f.value) f.value = WAL.pk; }); }
document.addEventListener('click', e => { const b = e.target.closest('[data-connect]'); if (b) { e.preventDefault(); if (WAL) go('/me'); else connect(); } });
(async () => { await sleep(400); try { const id = localStorage.getItem('dibs:w'); const w = wallets().find(x => x.id === id); if (w) { const r = await w.p.connect({ onlyIfTrusted: true }); const pk = (r && r.publicKey) || w.p.publicKey; if (pk) { WAL = { ...w, pk: pk.toString() }; paintWallet(); } } } catch {} })();
async function sendSol(to, lamports, relayOp = '/api/launch?op=relay') {
  const w = WAL || await connect(); if (!w) throw new Error('Connect a wallet, or send it from any wallet.');
  if (!window.solanaWeb3) await new Promise((ok, no) => { const s = document.createElement('script'); s.src = '/assets/web3.min.js'; s.onload = ok; s.onerror = no; document.head.appendChild(s); });
  const { Transaction, SystemProgram, PublicKey } = window.solanaWeb3;
  const bh = await api('/api/launch?op=blockhash'); if (!bh || !bh.ok) throw new Error('Solana didn’t answer. Try again.');
  const from = new PublicKey(w.pk);
  const t = new Transaction({ feePayer: from, blockhash: bh.blockhash, lastValidBlockHeight: bh.lastValidBlockHeight }).add(SystemProgram.transfer({ fromPubkey: from, toPubkey: new PublicKey(to), lamports }));
  if (w.p.signAndSendTransaction) { const r = await w.p.signAndSendTransaction(t); return String((r && (r.signature || r)) || ''); }
  const s = await w.p.signTransaction(t); const r = await post(relayOp, { tx: btoa(String.fromCharCode(...s.serialize())) }); if (!r.ok) throw new Error(r.error); return r.sig;
}

// ---------- shared ----------
let CFG = null;
const config = async () => CFG || (CFG = await api('/api/launch?op=config').then(j => (j && j.ok ? j : { ok: false, stepBps: 2000, prevBps: 9500, burnBps: 500, cutBps: 0, minStart: 0.05, maxStart: 50, minDev: 0.01, maxDev: 10, bufferSol: 0.006, createSol: 0.03, reserveSol: 0.015, payMinSol: 0.01, orderMin: 30 })));
(function nudge() { try { const t = +localStorage.getItem('dibs:nudge') || 0; if (Date.now() - t < 60000) return; localStorage.setItem('dibs:nudge', String(Date.now())); } catch {} fetch('/api/tick', { keepalive: true }).catch(() => {}); })();
function card(c) {
  return `<a class="dc" href="/c/${esc(c.mint)}">
    <div class="top"><img class="img" src="${esc(c.img)}" alt="" loading="lazy"><span class="up"><i></i>UP FOR DIBS</span></div>
    <div class="nm">${esc(c.name)}<span>$${esc(c.symbol)}</span></div>
    <div class="lab">dibs holder</div><div class="val">${face(c.holder)}<span class="mono">${WAL && WAL.pk === c.holder ? 'you' : short(c.holder)}</span><span class="dim" style="font-size:13px;font-weight:700">· ${ago(c.holderSince)}</span></div>
    <div class="row"><div><div class="lab">dibs costs</div><div class="val">${sol(c.priceSol)}</div></div><div><div class="lab">fees paid</div><div class="val">${sol(c.paidSol)}</div></div></div>
    <span class="b y go">Call dibs</span></a>`;
}
async function tape() {
  const j = await api('/api/coins?op=activity');
  const el = $('#tape'); if (!j.ok || !j.log.length) { el.hidden = true; return; }
  const items = j.log.slice(0, 20).map(l => `<span>${l.kind === 'dibs' ? '☝' : l.kind === 'burn' ? '🔥' : l.kind === 'launch' ? '✦' : '●'} <a href="/c/${esc(l.mint)}">$${esc(l.symbol)}</a> ${esc(l.text.replace(/^\S+ called dibs on \$\S+ /, 'dibs ').slice(0, 90))} <span class="mute">${ago(l.at)}</span></span>`).join('');
  $('#tapeRun').innerHTML = items + items; el.hidden = false;
}

// ---------- router ----------
const ROUTES = [[/^\/$/, home], [/^\/coins$/, coins], [/^\/c\/([1-9A-HJ-NP-Za-km-z]{32,44})$/, m => coin(m[1])], [/^\/launch$/, launch], [/^\/activity$/, activity], [/^\/hall$/, hall], [/^\/me$/, (m, q) => me(q)], [/^\/how$/, how], [/^\/token$/, token]];
let VIEW = 0, TIMERS = [];
const every = (fn, ms) => TIMERS.push(setInterval(fn, ms));
const stopTimers = () => { TIMERS.forEach(clearInterval); TIMERS = []; };
const set = html => { $('#screen').innerHTML = html; paintWallet(); };
async function route() {
  const path = location.pathname.replace(/\/+$/, '') || '/', q = new URLSearchParams(location.search);
  const mine = ++VIEW; stopTimers();
  $$('#menu a').forEach(a => a.classList.toggle('on', path === '/' + a.dataset.r || (a.dataset.r === 'coins' && path.startsWith('/c/'))));
  const hit = ROUTES.find(([re]) => re.test(path));
  if (!hit) { set(notFound()); return; }
  set('<div class="boot"><img src="/assets/mark.png" alt=""></div>');
  try { await hit[1](path.match(hit[0]), q, () => mine === VIEW); const f = $('#screen').firstElementChild; if (f && !REDUCE) { f.classList.add('page-in'); } } catch (e) { if (mine === VIEW) set(`<div class="msg bad">This page broke: ${esc(e && e.message)}. <a href="/">Go home</a></div>`); }
  window.scrollTo(0, 0);
}
function go(href) { history.pushState(null, '', href); route(); }
document.addEventListener('click', e => {
  const a = e.target.closest('a[href]'); if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || a.target === '_blank') return;
  const href = a.getAttribute('href'); if (!href || !href.startsWith('/') || href.startsWith('//') || /^\/(api|m|i|assets)\//.test(href)) return;
  e.preventDefault(); closeModal(); go(href);
});
addEventListener('popstate', route);

// ---------- home ----------
async function home() {
  const cfg = await config();
  const prev = (cfg.prevBps || 9000) / 100, burn = (cfg.burnBps || 500) / 100, cut = (cfg.cutBps || 0) / 100;
  set(`<section class="hero">
    <div class="side" id="heroL"></div>
    <div class="mid">
      <div class="rays" aria-hidden="true"></div>
      <h1 style="margin-top:8px"><span class="w" style="--i:0">Call</span> <span class="w" style="--i:1">dibs</span> <span class="w" style="--i:2">on</span> <span class="w pill" style="--i:3">any coin.</span></h1>
      <p class="lead">Every coin launched on DIBS is up for dibs: whoever has it gets the coin’s creator fees. Anyone can call dibs over you, and they pay you to do it.</p>
      <div class="cta"><a class="b y xl" href="/coins">☝ Call dibs</a><a class="b xl" href="/launch">Launch a coin</a></div>
    </div>
    <div class="side" id="heroR"></div>
  </section>
  <section class="sec"><div class="stats" id="stats">${['coins up for dibs', 'dibs called', 'paid to holders', 'fees paid out', 'burned'].map(l => `<div class="st"><div class="l">${l}</div><div class="v">—</div></div>`).join('')}</div></section>
  ${xtapes()}
  <section class="sec"><div class="hd"><div><h2>How dibs <span class="hl">works</span></h2><p>Three moves. Every one is a public Solana transaction.</p></div><a class="b sm" href="/how">The full rules</a></div>
    <div class="steps">
      <div class="card stp tl"><div class="ico">${HAND}</div><b>01. CALL DIBS</b><p>Pay the coin’s dibs price. Dibs is yours the moment your SOL lands.</p></div>
      <div class="card stp"><div class="ico">${COINS}</div><b>02. COLLECT</b><p>While you hold dibs, the coin’s creator fees are paid to your wallet. No claiming.</p></div>
      <div class="card stp tr"><div class="ico">${UP}</div><b>03. GET OUT-DIBSED</b><p>Someone calls dibs over you at +20%. They pay you ${prev}% of it: more than you paid.</p></div>
    </div></section>
  <section class="sec grid g2" style="align-items:start">
    <div><h2>Where a dibs <span class="hl">goes</span></h2><p class="mute" style="margin:0 0 18px">Every time someone calls dibs, the price they pay is split three ways.</p>
      <div class="split"><div class="a" style="flex:${prev}">${prev}% to the holder</div><div class="bb" style="flex:${burn * 1.6}">${burn}% burn</div>${cut ? `<div class="c" style="flex:${cut * 1.6}">${cut}%</div>` : ''}</div>
      <div class="legend"><div><i style="background:var(--y)"></i><span><b>${prev}% to the outgoing holder.</b> The person who loses dibs is paid for it, on top of every fee they collected.</span></div>
        <div><i style="background:#ffb08a"></i><span><b>${burn}% buys the coin back and burns it.</b> Every dibs makes the coin scarcer.</span></div>
        ${cut ? `<div><i style="background:var(--blue)"></i><span><b>${cut}% to the $DIBS treasury.</b></span></div>` : `<div><i style="background:var(--blue)"></i><span><b>The $DIBS treasury’s 5% goes to the outgoing holder</b> until the treasury is set.</span></div>`}
        <div><i style="background:#fff"></i><span><b>The next dibs costs 20% more.</b> The launcher is the first holder, at the start price they choose.</span></div></div></div>
    <div class="card calc" id="calc"></div></section>
  <section class="sec"><div class="hd"><div><h2>Up for <span class="hl">dibs</span></h2><p>Coins on DIBS, freshest dibs first.</p></div><a class="b sm" href="/coins">All coins</a></div><div id="hot" class="grid g3"><div class="empty">Reading the board…</div></div></section>
  <section class="sec grid g2" style="align-items:start">
    <div><div class="hd"><div><h2>Live <span class="hl">dibs</span></h2><p>Straight from the engine’s log.</p></div><a class="b sm" href="/activity">All activity</a></div><div id="feed" class="feed"><div class="empty">Reading…</div></div></div>
    <div><div class="hd"><div><h2>Hall of <span class="hl">dibs</span></h2><p>Who made the most from dibs.</p></div><a class="b sm" href="/hall">The hall</a></div><div id="hallp"><div class="empty">Reading…</div></div></div></section>
  <section class="sec"><h2 style="margin-bottom:18px">Good <span class="hl">questions</span></h2>${faq(cfg)}</section>
  <section class="sec band"><span class="hand">${HAND}</span><h2 style="margin-top:12px">Got a coin in you?</h2><p class="lead">Launch it on DIBS. You hold the first dibs, its fees come to you, and whoever wants it next has to pay you for it.</p><div class="cta" style="display:flex;justify-content:center;gap:12px;margin-top:24px;flex-wrap:wrap"><a class="b y xl" href="/launch">Launch a coin</a><a class="b xl" href="/how">Read the rules</a></div></section>
  ${foot(cfg)}`);
  calc(cfg);
  const [list, st, act, hl] = await Promise.all([api('/api/coins'), api('/api/coins?op=stats'), api('/api/coins?op=activity'), api('/api/coins?op=hall')]);
  if (st.ok && !st.offline) $('#stats').innerHTML = [['coins up for dibs', st.live, ''], ['dibs called', st.dibs, ''], ['paid to holders', st.toHoldersSol, ' SOL'], ['fees paid out', st.feesSol, ' SOL'], ['burned', st.burnedSol, ' SOL']].map(([l, v, u]) => `<div class="st"><div class="l">${l}</div><div class="v" data-count="${+v || 0}" data-unit="${u}">0${u}</div></div>`).join('');
  const cs = list.ok ? (list.coins || []) : [];
  $('#hot').innerHTML = cs.length ? cs.slice(0, 6).map(card).join('') : `<div class="empty" style="grid-column:1/-1"><b>No coins up for dibs yet.</b>The first coin on DIBS is yours to launch. You’ll hold its first dibs.<div style="margin-top:14px"><a class="b y" href="/launch">Launch the first coin</a></div></div>`;
  if (cs[0]) $('#heroL').innerHTML = `<div class="tl float">${card(cs[0])}</div>`; else demo($('#heroL'), DEMOS[0], 'tl', 0);
  if (cs[1]) $('#heroR').innerHTML = `<div class="tr float d2">${card(cs[1])}</div>`; else demo($('#heroR'), DEMOS[1], 'tr', 1400);
  feedInto($('#feed'), act.ok ? (act.log || []).slice(0, 7) : [], 'No dibs yet. When someone calls one, it shows up here with its transaction.');
  $('#hallp').innerHTML = hl.ok && (hl.earners || []).length ? earnersTable(hl.earners.slice(0, 6)) : `<div class="empty"><b>The hall is empty.</b>The first holder to get out-dibsed goes up here.</div>`;
  tape();
}
function calc(cfg) {
  const el = $('#calc'); const prev = (cfg.prevBps || 9000) / 1e4;
  el.innerHTML = `<h3>Dibs calculator</h3><p class="hint" style="margin-top:0">Pick a start price and how many times dibs gets called. This is arithmetic, not a forecast.</p>
    <div class="f"><label>start price: <b id="cS"></b></label><input type="range" id="cs" min="0" max="100" value="25"></div>
    <div class="f"><label>dibs called: <b id="cN"></b></label><input type="range" id="cn" min="1" max="15" value="6"></div>
    <div class="lad" id="lad"></div><div id="cout" class="hint" style="font-size:14px;color:var(--ink)"></div>`;
  const toS = v => +(Math.pow(10, Math.log10(cfg.minStart || 0.05) + (v / 100) * (Math.log10(Math.min(cfg.maxStart || 50, 10)) - Math.log10(cfg.minStart || 0.05)))).toFixed(2);
  const paint = () => {
    const s = toS(+$('#cs').value), n = +$('#cn').value; const ps = [s]; for (let i = 0; i < n; i++) ps.push(Math.ceil(ps[ps.length - 1] * 1.2 * 1e4) / 1e4);
    $('#cS').textContent = s + ' SOL'; $('#cN').textContent = n;
    const mx = ps[ps.length - 1]; $('#lad').innerHTML = ps.map(p => `<div style="height:${Math.max(4, p / mx * 100)}%" title="${p} SOL"></div>`).join('');
    const paid = ps[1], got = ps[2] ? ps[2] * prev : null;
    $('#cout').innerHTML = `After ${n} dibs the price is <b>${num(ps[n])} SOL</b>. Each holder who gets out-dibsed pays <i>p</i> and gets back <b>${(1.2 * prev * 100).toFixed(0)}% of p</b>${got ? ` (e.g. pay ${num(paid)}, get ${num(got)} SOL)` : ''}, plus the fees they collected. The last holder keeps dibs until someone pays ${num(ps[n])} SOL; if nobody does, they keep the fees and nothing else.`;
  };
  $('#cs').addEventListener('input', paint); $('#cn').addEventListener('input', paint); paint();
}
function feedInto(el, log, emptyMsg) {
  el.innerHTML = log.length ? log.map(l => `<div class="it"><span class="k ${esc(l.kind)}">${l.kind === 'dibs' ? '☝' : l.kind === 'burn' ? '🔥' : l.kind === 'launch' ? '✦' : '◎'}</span>${l.img ? `<img src="${esc(l.img)}" alt="" loading="lazy">` : ''}<div class="t">${l.mint ? `<a href="/c/${esc(l.mint)}" style="font-weight:900;text-decoration:none">$${esc(l.symbol)}</a> ` : ''}${esc(l.text)} <small>· ${ago(l.at)} ago</small></div>${l.sig ? `<a class="tx" href="${tx(l.sig)}" target="_blank" rel="noopener">tx ↗</a>` : ''}</div>`).join('') : `<div class="empty">${emptyMsg}</div>`;
}
function earnersTable(rows) {
  return `<div class="tw"><table class="tbl"><thead><tr><th>#</th><th>holder</th><th class="n">fees</th><th class="n">paid out</th><th class="n">net</th></tr></thead><tbody>${rows.map((e, i) => `<tr><td><b>${i + 1}</b></td><td>${who(e.holder, 1)}</td><td class="n">${sol(e.feesSol)}</td><td class="n">${sol(e.paidOutSol)}</td><td class="n"><b class="${e.netSol >= 0 ? 'okc' : 'badc'}">${e.netSol >= 0 ? '+' : ''}${num(e.netSol)}</b></td></tr>`).join('')}</tbody></table></div>`;
}
function faq(cfg) {
  const prev = (cfg.prevBps || 9000) / 100;
  return [['What is dibs?', `Every coin launched on DIBS has one dibs. Whoever holds it gets the coin’s pump.fun creator fees, paid to their wallet automatically once at least ${cfg.payMinSol || 0.01} SOL is waiting.`],
    ['How do I call dibs?', `Open a coin, press Call dibs, and send the price (plus ${cfg.bufferSol || 0.006} SOL for network fees, which comes back). The moment it lands, dibs is yours and the price goes up 20% for the next person.`],
    ['What happens when someone calls dibs over me?', `You get ${prev}% of what they paid. They paid 20% more than you did, so you get back ${(1.2 * prev).toFixed(0)}% of your price, on top of every fee you collected while you held it.`],
    ['Can I lose money?', 'Yes. If nobody calls dibs over you, you keep dibs and its fees, but nobody pays you for it. Fees depend on trading, which can stop. Dibs is a game of musical chairs with a fee stream attached: only pay what you are fine losing.'],
    ['Who launches coins?', 'Anyone. The launcher picks a start price and is the first dibs holder, so the first person to call dibs pays them. The launch itself is a normal pump.fun coin with a first buy that goes to the launcher.'],
    ['Is it custodial?', 'Partly, and we say so. Each coin’s creator wallet and each dibs deposit wallet is held by the DIBS engine, derived from one server secret. The engine can only claim fees, pay holders, split dibs payments and refund. Every move is on Solscan.'],
    ['What if two people call dibs at once?', 'The first deposit to land wins. The other one is refunded in full, automatically. A dibs that isn’t funded within 30 minutes is cancelled and anything sent is returned.']]
    .map(([q, a]) => `<details><summary>${q}</summary><p>${a}</p></details>`).join('');
}
const foot = cfg => `<div class="sec"></div>`;

// ---------- coins ----------
async function coins() {
  set(`<div class="hd"><div><h1 style="font-size:clamp(36px,6vw,64px)">Up for <span class="pill">dibs.</span></h1><p class="lead">Every live coin on DIBS. Call dibs on any of them.</p></div></div>
    <div class="hd" style="margin-top:22px"><div class="tabs" id="sort">${[['hot', 'Fresh dibs'], ['new', 'Newest'], ['price', 'Priciest dibs'], ['fees', 'Most fees'], ['reigns', 'Most dibs']].map(([k, t], i) => `<button type="button" data-s="${k}" class="${i ? '' : 'on'}">${t}</button>`).join('')}</div>
    <input class="in" id="find" placeholder="Search name, ticker or address" style="max-width:320px"></div>
    <div id="cl" class="grid g3" style="margin-top:8px"><div class="empty">Reading the board…</div></div>`);
  let all = [];
  const paint = () => { const f = $('#find').value.trim().toLowerCase(); const l = all.filter(c => !f || (c.name + ' ' + c.symbol + ' ' + c.mint).toLowerCase().includes(f));
    $('#cl').innerHTML = l.length ? l.map(card).join('') : all.length ? `<div class="empty" style="grid-column:1/-1">Nothing matches that.</div>` : `<div class="empty" style="grid-column:1/-1"><b>No coins yet.</b>Launch the first one and hold its first dibs.<div style="margin-top:14px"><a class="b y" href="/launch">Launch a coin</a></div></div>`; };
  const load = async s => { const j = await api('/api/coins?sort=' + s); all = j.ok ? (j.coins || []) : []; if (!j.ok) $('#cl').innerHTML = `<div class="msg bad">${esc(j.error)}</div>`; else paint(); };
  $$('#sort button').forEach(b => b.addEventListener('click', () => { $$('#sort button').forEach(x => x.classList.toggle('on', x === b)); load(b.dataset.s); }));
  $('#find').addEventListener('input', paint);
  await load('hot');
}

// ---------- one coin ----------
async function coin(mint) {
  set(`<div class="crumb"><a href="/coins">Coins</a> / ${short(mint)}</div><div id="cn"><div class="boot"><img src="/assets/mark.png" alt=""></div></div>`);
  let C = null;
  const paint = async () => {
    const j = await api('/api/coins?m=' + encodeURIComponent(mint));
    if (!j.ok) { $('#cn').innerHTML = `<div class="empty"><b>${esc(j.error || 'Not found')}</b><a class="b" href="/coins" style="margin-top:12px">Back to coins</a></div>`; return false; }
    const c = j.coin, mk = c.market || {}; C = c;
    const mine = WAL && WAL.pk === c.holder;
    $('#cn').innerHTML = `<div class="ch">
      <div>
        <div class="cid"><img src="${esc(c.img)}" alt=""><div><span class="up"><i></i>UP FOR DIBS</span><h1 style="font-size:clamp(34px,5vw,54px);margin-top:8px">${esc(c.name)}</h1><div style="font-weight:900;color:var(--g);font-size:20px">$${esc(c.symbol)}</div></div></div>
        ${c.state !== 'live' ? `<div class="msg y">This coin is ${esc(c.state)}${c.err ? ': ' + esc(c.err) : ''}.</div>` : ''}
        <div class="links">${ext('https://pump.fun/coin/' + c.mint, 'Trade on pump.fun ↗', 'b sm y')}${ext('https://dexscreener.com/solana/' + c.mint, 'Chart ↗')}<button class="b sm" type="button" data-copy="${esc(c.mint)}" data-what="Address copied">Copy CA</button><a class="b sm" href="https://x.com/intent/post?text=${encodeURIComponent(`$${c.symbol} is up for dibs. Whoever holds dibs gets its fees. Dibs costs ${num(c.priceSol)} SOL right now.\n\n${location.origin}/c/${c.mint}`)}" target="_blank" rel="noopener">Share ↗</a></div>
        <div class="stats s3 sec" style="margin-top:28px">
          <div class="st"><div class="l">market cap</div><div class="v">${usd(c.mcapUsd || mk.mcapUsd)}</div><div class="hint" style="margin:0">${mk.complete || c.complete ? 'graduated' : mk.progress != null ? Math.round(mk.progress * 100) + '% of the curve' : ''}</div></div>
          <div class="st"><div class="l">fees paid to holders</div><div class="v">${sol(c.paidSol)}</div><div class="hint" style="margin:0">${c.waitingSol ? sol(c.waitingSol) + ' waiting to claim' : ' '}</div></div>
          <div class="st"><div class="l">dibs called</div><div class="v">${c.reigns - 1}</div><div class="hint" style="margin:0">${sol(c.dibsVolumeSol)} paid in dibs</div></div>
          <div class="st"><div class="l">burned</div><div class="v">${sol(c.burnedSol)}</div><div class="hint" style="margin:0">bought back and burned</div></div>
          <div class="st"><div class="l">start price</div><div class="v">${sol(c.startSol)}</div><div class="hint" style="margin:0">set by the launcher</div></div>
          <div class="st"><div class="l">next fee payout</div><div class="v">${sol(c.chestSol)}</div><div class="hint" style="margin:0">goes out at ${c.payMinSol} SOL</div></div>
        </div>
        <section class="sec"><div class="hd"><div><h2>Dibs history</h2><p>Every holder this coin has had.</p></div></div>
          <div class="tw"><table class="tbl"><thead><tr><th>holder</th><th>held</th><th class="n">paid</th><th class="n">fees</th><th class="n">got back</th></tr></thead><tbody>${j.reigns.map(r => `<tr><td>${who(r.holder, 1)}${r.dibs ? '' : ' <span class="dim" style="font-size:12px">launcher</span>'}</td><td class="mono">${r.end ? dur((new Date(r.end) - new Date(r.start)) / 1000) : '<b>holding</b>'}</td><td class="n">${r.paidInSol ? sol(r.paidInSol) : '—'}</td><td class="n">${sol(r.feesSol)}</td><td class="n">${r.end ? sol(r.paidOutSol) : '—'}</td></tr>`).join('')}</tbody></table></div></section>
        <section class="sec"><div class="hd"><div><h2>Engine log</h2><p>Everything the engine did for this coin.</p></div></div><div class="feed" id="clog"></div></section>
      </div>
      <div style="position:sticky;top:96px">
        <div class="card throne"><div class="lab" style="margin-top:0">dibs holder</div><div style="margin:12px auto 8px;width:96px">${face(c.holder, 'xl')}</div>
          <a class="who mono" href="/me?w=${esc(c.holder)}" style="font-size:18px">${mine ? 'you' : short(c.holder, 6)}</a>
          <div class="timer" style="margin-top:6px">has had dibs for <b id="reign">${dur((Date.now() - new Date(c.holderSince)) / 1000)}</b></div>
          <div class="lab" style="margin-top:22px">dibs costs</div><div class="big">${num(c.priceSol)}<span style="font-size:.4em"> SOL</span></div>
          <div class="hint" style="color:var(--ink)">the next one will cost ${sol(c.nextSol)}</div>
          <button class="b k xl" type="button" id="callBtn" style="margin-top:18px;width:100%" ${c.state !== 'live' || mine ? 'disabled' : ''}>${mine ? 'You have dibs' : '☝ Call dibs'}</button></div>
        <div class="card flat" style="margin-top:20px"><h3>If you call dibs now</h3><dl class="kv">
          <dt>you pay</dt><dd><b>${sol(c.priceSol)}</b> + ${CFG ? CFG.bufferSol : 0.006} SOL for fees (unused comes back)</dd>
          <dt>${short(c.holder)} gets</dt><dd><b>${sol(c.toHolderSol)}</b> plus the fees waiting for them</dd>
          <dt>burned</dt><dd>${sol(c.burnSol)} buys $${esc(c.symbol)} back and burns it</dd>
          ${c.treasurySol ? `<dt>treasury</dt><dd>${sol(c.treasurySol)} to $DIBS</dd>` : ''}
          <dt>you get</dt><dd>every fee from then on, and ${sol(+(c.nextSol * ((CFG && CFG.prevBps) || 9000) / 1e4).toFixed(4))} if someone calls dibs over you</dd></dl></div>
        <div class="card flat" style="margin-top:20px"><h3>The record</h3><dl class="kv"><dt>contract</dt><dd class="mono">${esc(c.mint)}</dd><dt>coin wallet</dt><dd><a class="mono" href="${acct(c.wallet)}" target="_blank" rel="noopener">${short(c.wallet, 6)} ↗</a></dd><dt>launcher</dt><dd>${who(c.launcher, 1)}</dd>${c.createSig ? `<dt>created</dt><dd><a href="${tx(c.createSig)}" target="_blank" rel="noopener">${short(c.createSig, 6)} ↗</a></dd>` : ''}</dl></div>
      </div></div>`;
    feedInto($('#clog'), j.log, 'Nothing yet.');
    $('#callBtn').addEventListener('click', () => callDibs(C));
    return true;
  };
  if (await paint()) { every(() => { const el = $('#reign'); if (el && C) el.textContent = dur((Date.now() - new Date(C.holderSince)) / 1000); }, 1000); every(() => { if ($('#modal').hidden) paint(); }, 20000); }
}

// ---------- calling dibs ----------
let ORDER = null, POLL = null;
function openModal(html) { $('#sheet').innerHTML = html; $('#modal').hidden = false; paintWallet(); }
function closeModal() { $('#modal').hidden = true; clearInterval(POLL); POLL = null; }
document.addEventListener('click', e => { if (e.target.closest('[data-close]') || e.target.id === 'modal') closeModal(); });
async function callDibs(c) {
  await config();
  openModal(`<h2>Call dibs on $${esc(c.symbol)}</h2><p class="mute" style="margin:6px 0 0">Dibs costs <b style="color:var(--ink)">${sol(c.priceSol)}</b> right now.</p>
    <div class="f"><label>your wallet (dibs and any refund go here)</label><div class="inrow"><input class="in mono" id="caller" data-mywallet placeholder="connect, or paste your Solana address"><button class="b sm" type="button" data-connect>Connect</button></div></div>
    <div class="msg y">You send <b>${num(c.priceSol + CFG.bufferSol)} SOL</b>: the price plus ${CFG.bufferSol} SOL for network fees. If someone beats you to it, everything comes back.</div>
    <div style="margin-top:18px"><button class="b y xl" type="button" id="openOrder" style="width:100%">Continue</button></div><div id="oerr"></div>`);
  $('#openOrder').addEventListener('click', async () => {
    let caller = $('#caller').value.trim(); if (!caller) { const w = await connect(); if (w) caller = w.pk; $('#caller').value = caller || ''; }
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(caller)) { $('#oerr').innerHTML = '<div class="msg bad">Connect a wallet or paste your Solana address.</div>'; return; }
    $('#openOrder').disabled = true;
    const r = await post('/api/dibs?op=prepare', { coin: c.mint, caller });
    $('#openOrder').disabled = false;
    if (!r.ok) { $('#oerr').innerHTML = `<div class="msg bad">${esc(r.error)}</div>`; return; }
    ORDER = r; try { localStorage.setItem('dibs:order', JSON.stringify({ id: r.id, mint: c.mint })); } catch {}
    trackOrder(r);
  });
}
const OSTEPS = [['open', 'dibs opened'], ['dep', 'deposit landed'], ['take', 'dibs is yours'], ['paid', 'outgoing holder paid'], ['burn', 'buyback burned'], ['done', 'change returned']];
function trackOrder(o) {
  openModal(`<h2>Calling dibs on $${esc(o.symbol || '')}</h2>
    <div id="opay"><p style="margin:12px 0 0">Send exactly <b>${o.needSol} SOL</b> to this one-off dibs wallet:</p>
    <div class="addr"><code>${esc(o.wallet)}</code><button class="b sm" type="button" data-copy="${esc(o.wallet)}" data-what="Wallet copied">Copy</button><button class="b sm" type="button" data-copy="${o.needSol}" data-what="Amount copied">Amount</button></div>
    <button class="b y xl" type="button" id="paybtn" style="width:100%;margin-top:14px">Send ${o.needSol} SOL with my wallet</button>
    <p class="hint" id="pmsg">Not funded in 30 minutes: cancelled, and anything sent comes back.</p></div>
    <div class="prog" id="oprog"></div><div id="ores"></div>`);
  $('#paybtn').addEventListener('click', async () => {
    const m = $('#pmsg');
    try { m.textContent = 'Approve the transfer in your wallet…'; const sig = await sendSol(o.wallet, o.need); m.innerHTML = `Sent: <a href="${tx(sig)}" target="_blank" rel="noopener">${short(sig, 6)} ↗</a>. Waiting for it to land…`; }
    catch (e) { m.innerHTML = `<span class="badc">${esc((e && e.message) || 'The transfer was cancelled.')}</span> You can also send it from any wallet.`; }
  });
  paintSteps('waiting', {});
  let busy = false;
  const check = async () => {
    if (busy) return; busy = true;
    const d = await api('/api/dibs?op=status&id=' + encodeURIComponent(o.id), { ms: 65000 }); busy = false;
    if (!d || !d.ok) return;
    paintSteps(d.state, d);
    if (d.state === 'waiting' && d.balance > 0 && $('#pmsg')) $('#pmsg').textContent = `${(d.balance / 1e9).toFixed(4)} of ${d.needSol} SOL arrived.`;
    if (d.state !== 'waiting' && $('#opay')) $('#opay').remove();
    if (d.state === 'done') { clearInterval(POLL); try { localStorage.removeItem('dibs:order'); } catch {} confetti();
      $('#ores').innerHTML = `<div class="msg ok"><b>Dibs is yours.</b> $${esc(d.coin.symbol)}’s fees now come to you. The next dibs costs ${sol(d.coin.priceSol)}.<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:12px"><a class="b sm y" href="/c/${esc(d.coin.mint)}">See the coin</a>${d.sigPay ? ext(tx(d.sigPay), 'Payout tx ↗') : ''}<a class="b sm" href="https://x.com/intent/post?text=${encodeURIComponent(`I just called dibs on $${d.coin.symbol}. Its fees are mine now. Come take it: ${sol(d.coin.priceSol)}.\n\n${location.origin}/c/${d.coin.mint}`)}" target="_blank" rel="noopener">Share ↗</a></div></div>`; }
    if (['expired', 'refunded', 'outbid'].includes(d.state)) { clearInterval(POLL); try { localStorage.removeItem('dibs:order'); } catch {}
      $('#ores').innerHTML = `<div class="msg bad"><b>Dibs not taken:</b> ${esc(d.err || d.state)}. ${d.sigRefund ? `Your SOL came back: <a href="${tx(d.sigRefund)}" target="_blank" rel="noopener">refund tx ↗</a>` : 'Anything you sent is being returned automatically.'}</div>`; }
  };
  clearInterval(POLL); POLL = setInterval(check, 4000); check();
}
function paintSteps(state, d) {
  const el = $('#oprog'); if (!el) return;
  const bad = ['expired', 'refunded', 'outbid'].includes(state);
  let at = state === 'waiting' ? 1 : state === 'paying' ? (d.sigPay ? (d.sigBurn ? 5 : 4) : 3) : state === 'done' ? 6 : 1;
  el.innerHTML = OSTEPS.map(([k, t], i) => `<div class="${bad ? (i === 0 ? 'ok' : i === 1 ? 'bad' : '') : i < at ? 'ok' : i === at ? 'on' : ''}">${t}</div>`).join('');
}
function confetti() { const c = document.createElement('div'); c.className = 'confetti'; c.innerHTML = Array.from({ length: 60 }, (_, i) => `<i style="left:${Math.random() * 100}%;background:${['#FFD23F', '#ffb08a', '#7cc6ff', '#b9f3cf', '#ffb3c7'][i % 5]};animation-delay:${Math.random() * .5}s;animation-duration:${1.4 + Math.random()}s"></i>`).join(''); document.body.appendChild(c); setTimeout(() => c.remove(), 3200); }

// ---------- launch ----------
async function launch() {
  const cfg = await config();
  set(`<div class="grid" style="grid-template-columns:minmax(0,1.3fr) minmax(0,1fr);gap:34px;align-items:start" id="lwrap">
    <div><h1 style="font-size:clamp(36px,6vw,62px)">Launch a coin <span class="pill">up for dibs.</span></h1>
      <p class="lead">It launches on pump.fun like any coin. The twist: it has dibs. You hold the first one, so its fees come to you until someone pays you to take it.</p>
      ${cfg.ok && !cfg.open ? '<div class="msg bad">Launching is paused: the engine’s records aren’t connected yet.</div>' : ''}
      <form id="lf" autocomplete="off" class="card" style="margin-top:28px">
        <div style="display:flex;gap:18px;align-items:center;flex-wrap:wrap"><label class="drop" id="drop" for="pic">add a<br>picture</label><input type="file" id="pic" accept="image/png,image/jpeg,image/webp,image/gif" hidden><div class="hint" style="flex:1;min-width:180px">Square works best. PNG, JPG, WEBP or GIF, under 1.5 MB.</div></div>
        <div class="grid g2" style="gap:0 14px"><div class="f"><label for="nm">name</label><input class="in" id="nm" maxlength="32" placeholder="up to 32 characters"></div>
        <div class="f"><label for="sy">ticker</label><input class="in" id="sy" maxlength="10" placeholder="1–10 letters" style="text-transform:uppercase"></div></div>
        <div class="f"><label for="ds">description</label><textarea class="in" id="ds" maxlength="400" rows="2" placeholder="optional. a line about dibs is added for you"></textarea></div>
        <div class="grid g2" style="gap:0 14px"><div class="f"><label for="xl">x link</label><input class="in" id="xl" placeholder="optional · https://x.com/…"></div><div class="f"><label for="wl">website</label><input class="in" id="wl" placeholder="optional"></div></div>
        <div class="f"><label for="sp">starting dibs price</label><div class="inrow"><input class="in" id="sp" type="number" min="${cfg.minStart}" max="${cfg.maxStart}" step="0.01" value="0.1"><span style="align-self:center;font-weight:900">SOL</span></div>
          <div class="chips" id="spc">${[0.05, 0.1, 0.25, 0.5, 1, 2].map(v => `<button type="button" data-v="${v}">${v}</button>`).join('')}</div><div class="hint">The first person to call dibs pays this. You get ${(cfg.prevBps || 9000) / 100}% of it. ${cfg.minStart}–${cfg.maxStart} SOL.</div></div>
        <div class="f"><label for="dv">first buy</label><div class="inrow"><input class="in" id="dv" type="number" min="${cfg.minDev}" max="${cfg.maxDev}" step="0.01" value="0.05"><span style="align-self:center;font-weight:900">SOL</span></div>
          <div class="chips" id="dvc">${[0.01, 0.05, 0.1, 0.25, 0.5, 1].map(v => `<button type="button" data-v="${v}">${v}</button>`).join('')}</div><div class="hint">Bought the moment the coin is created; the tokens are sent to your wallet.</div></div>
        <div class="f"><label for="launcher">your wallet (the first dibs holder)</label><div class="inrow"><input class="in mono" id="launcher" data-mywallet placeholder="connect, or paste your Solana address"><button class="b sm" type="button" data-connect>Connect</button></div></div>
        <div class="msg y" id="sum"></div>
        <button class="b y xl" type="submit" id="go" style="width:100%;margin-top:16px">Launch it</button><div id="err"></div>
      </form><div id="flow"></div></div>
    <div style="position:sticky;top:100px"><div class="lab" style="margin:0 0 12px">preview</div><div id="pv"></div>
      <div class="card flat" style="margin-top:24px"><h3>What you get</h3><div class="legend" style="margin:0"><div><i style="background:var(--y)"></i><span>The first dibs, so every fee until someone calls dibs.</span></div><div><i style="background:#b9f3cf"></i><span>${(cfg.prevBps || 9000) / 100}% of the first dibs price when they do.</span></div><div><i style="background:var(--blue)"></i><span>The first-buy tokens, sent to your wallet.</span></div></div></div></div>
  </div>`);
  if (innerWidth < 980) $('#lwrap').style.gridTemplateColumns = '1fr';
  const S = { img: null };
  const pv = () => { $('#pv').innerHTML = `<div class="tl">${card({ mint: '', img: S.img || '/assets/icon-180.png', name: $('#nm').value || 'Your coin', symbol: ($('#sy').value || 'TICKER').toUpperCase(), holder: $('#launcher').value || (WAL && WAL.pk) || 'you', holderSince: new Date(), priceSol: +$('#sp').value || 0, paidSol: 0 })}</div>`; $('#pv a').removeAttribute('href'); };
  const sum = () => { const dev = Math.max(0, +$('#dv').value || 0), need = (cfg.createSol || 0.03) + dev * 1.02 + (cfg.reserveSol || 0.015);
    $('#sum').innerHTML = `You send <b>${need.toFixed(3)} SOL</b> = ${cfg.createSol} to create + ${dev} first buy (+2%) + ${cfg.reserveSol} kept in the coin’s wallet for gas. Unused SOL comes back. Not funded in 3 hours: everything returned.`; pv(); };
  ['nm', 'sy', 'sp', 'dv', 'launcher'].forEach(id => $('#' + id).addEventListener('input', sum));
  $$('#spc button').forEach(b => b.addEventListener('click', () => { $('#sp').value = b.dataset.v; sum(); }));
  $$('#dvc button').forEach(b => b.addEventListener('click', () => { $('#dv').value = b.dataset.v; sum(); }));
  $('#pic').addEventListener('change', async e => {
    const f = e.target.files && e.target.files[0]; if (!f) return;
    try { const bmp = await createImageBitmap(f); const c = document.createElement('canvas'); const s = Math.min(bmp.width, bmp.height); c.width = c.height = 512; c.getContext('2d').drawImage(bmp, (bmp.width - s) / 2, (bmp.height - s) / 2, s, s, 0, 0, 512, 512); S.img = c.toDataURL('image/jpeg', 0.9); $('#drop').innerHTML = `<img src="${S.img}" alt="">`; pv(); }
    catch { toast('That picture couldn’t be read'); }
  });
  sum();
  const err = m => { $('#err').innerHTML = m ? `<div class="msg bad">${esc(m)}</div>` : ''; };
  $('#lf').addEventListener('submit', async e => {
    e.preventDefault(); err('');
    if (!S.img) return err('Add a picture for the coin.');
    let launcher = $('#launcher').value.trim(); if (!launcher) { const w = await connect(); if (w) launcher = w.pk; }
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(launcher)) return err('Connect a wallet or paste your Solana address.');
    $('#go').disabled = true; $('#go').textContent = 'Recording the launch…';
    const r = await post('/api/launch?op=prepare', { launcher, name: $('#nm').value, symbol: $('#sy').value, description: $('#ds').value, twitter: $('#xl').value.trim(), website: $('#wl').value.trim(), devBuy: +$('#dv').value, startPrice: +$('#sp').value, image: S.img });
    $('#go').disabled = false; $('#go').textContent = 'Launch it';
    if (!r.ok) return err(r.error || 'The launch didn’t save.');
    trackLaunch(r);
  });
  try { const s = JSON.parse(localStorage.getItem('dibs:launch') || 'null'); if (s && s.id) { trackLaunch(s); toast('Picking up your launch where it left off'); } } catch {}
}
const LSTEPS = [['rec', 'launch recorded'], ['dep', 'deposit landed'], ['make', 'coin created on pump.fun'], ['live', 'live and up for dibs. you hold dibs']];
function trackLaunch(d) {
  $('#lf').hidden = true;
  try { localStorage.setItem('dibs:launch', JSON.stringify({ id: d.id, wallet: d.wallet, need: d.need, needSol: d.needSol, mint: d.mint, symbol: d.symbol })); } catch {}
  $('#flow').innerHTML = `<div class="card" style="margin-top:28px"><h2>Launching $${esc(d.symbol)}</h2><div id="ldep"><p>Send exactly <b>${d.needSol} SOL</b> to the coin’s own wallet:</p>
    <div class="addr"><code>${esc(d.wallet)}</code><button class="b sm" type="button" data-copy="${esc(d.wallet)}" data-what="Wallet copied">Copy</button><button class="b sm" type="button" data-copy="${d.needSol}" data-what="Amount copied">Amount</button></div>
    <button class="b y xl" type="button" id="lpay" style="width:100%;margin-top:14px">Send ${d.needSol} SOL with my wallet</button><p class="hint" id="lmsg">This page checks every few seconds. You can close it once the transfer is sent.</p></div>
    <div class="prog" id="lprog"></div><div class="feed" id="llog"></div><div id="lres"></div></div>`;
  $('#lpay').addEventListener('click', async () => { const m = $('#lmsg'); try { m.textContent = 'Approve the transfer in your wallet…'; const sig = await sendSol(d.wallet, d.need); m.innerHTML = `Sent: <a href="${tx(sig)}" target="_blank" rel="noopener">${short(sig, 6)} ↗</a>. Waiting for it to land…`; } catch (e) { m.innerHTML = `<span class="badc">${esc((e && e.message) || 'Cancelled.')}</span> You can also send it from any wallet.`; } });
  const prog = st => { const bad = ['failed', 'refunded', 'expired'].includes(st), at = { waiting: 1, creating: 2, live: 4 }[st] || 1; $('#lprog').innerHTML = LSTEPS.map(([k, t], i) => `<div class="${bad ? (i === 0 ? 'ok' : i === 1 ? 'bad' : '') : i < at ? 'ok' : i === at ? 'on' : ''}">${t}</div>`).join(''); };
  prog('waiting');
  let busy = false;
  const check = async () => {
    if (busy) return; busy = true; const s = await api('/api/launch?op=status&id=' + encodeURIComponent(d.id), { ms: 65000 }); busy = false; if (!s || !s.ok) return;
    prog(s.state); feedInto($('#llog'), s.logs || [], '');
    if (s.state === 'waiting' && s.balance > 0) $('#lmsg').textContent = `${(s.balance / 1e9).toFixed(4)} of ${s.needSol} SOL arrived.`;
    if (s.state !== 'waiting' && $('#ldep')) $('#ldep').remove();
    if (s.state === 'live') { stopTimers(); try { localStorage.removeItem('dibs:launch'); } catch {} confetti(); $('#lres').innerHTML = `<div class="msg ok"><b>$${esc(s.symbol)} is live and up for dibs.</b> You hold dibs at ${s.startSol} SOL.<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:12px"><a class="b sm y" href="/c/${esc(s.mint)}">Open the coin</a>${ext('https://pump.fun/coin/' + s.mint, 'pump.fun ↗')}<a class="b sm" href="https://x.com/intent/post?text=${encodeURIComponent(`$${s.symbol} is live on DIBS and I have dibs. Its fees are mine until someone pays ${s.startSol} SOL to take it.\n\n${location.origin}/c/${s.mint}`)}" target="_blank" rel="noopener">Share ↗</a></div></div>`; }
    if (['failed', 'expired', 'refunded'].includes(s.state)) { stopTimers(); try { localStorage.removeItem('dibs:launch'); } catch {} $('#lres').innerHTML = `<div class="msg bad">The launch ${s.state === 'expired' ? 'expired' : 'didn’t go through'}${s.err ? ': ' + esc(s.err.slice(0, 160)) : ''}. ${s.refund_sig ? `Your deposit came back: <a href="${tx(s.refund_sig)}" target="_blank" rel="noopener">refund tx ↗</a>` : 'Anything you sent is being returned.'}<div style="margin-top:12px"><a class="b sm" href="/launch" onclick="localStorage.removeItem('dibs:launch')">Start again</a></div></div>`; }
  };
  every(check, 4000); check();
}

// ---------- activity, hall, me ----------
async function activity() {
  set(`<h1 style="font-size:clamp(36px,6vw,62px)">Live <span class="pill">activity.</span></h1><p class="lead">Every dibs, payout, burn and launch, newest first. Each one links to its transaction.</p>
    <div class="tabs" id="ak" style="margin-top:26px">${[['', 'Everything'], ['dibs', 'Dibs'], ['payout', 'Dibs payouts'], ['pay', 'Fee payouts'], ['burn', 'Burns'], ['launch', 'Launches']].map(([k, t], i) => `<button type="button" data-k="${k}" class="${i ? '' : 'on'}">${t}</button>`).join('')}</div><div class="feed" id="af" style="margin-top:18px"><div class="empty">Reading…</div></div>`);
  let k = '';
  const load = async () => { const j = await api('/api/coins?op=activity' + (k ? '&kind=' + k : '')); feedInto($('#af'), j.ok ? (j.log || []) : [], j.ok ? 'Nothing here yet. The first dibs on DIBS will show up here.' : esc(j.error)); };
  $$('#ak button').forEach(b => b.addEventListener('click', () => { $$('#ak button').forEach(x => x.classList.toggle('on', x === b)); k = b.dataset.k; load(); }));
  await load(); every(load, 15000);
}
async function hall() {
  set(`<h1 style="font-size:clamp(36px,6vw,62px)">Hall of <span class="pill">dibs.</span></h1><p class="lead">Net = fees collected + what they were paid when out-dibsed − what they paid for dibs.</p><div id="hl" class="sec" style="margin-top:30px"><div class="empty">Reading…</div></div>`);
  const j = await api('/api/coins?op=hall');
  if (!j.ok || j.offline) { $('#hl').innerHTML = `<div class="msg bad">${esc(j.error || 'The records are offline for a moment.')}</div>`; return; }
  const none = m => `<div class="empty">${m}</div>`;
  $('#hl').innerHTML = `<div class="grid g2" style="align-items:start"><div><h2>Top earners</h2>${j.earners.length ? earnersTable(j.earners) : none('Nobody yet.')}</div>
    <div><h2>Longest dibs</h2>${j.longest.length ? `<div class="tw"><table class="tbl"><thead><tr><th>holder</th><th>coin</th><th class="n">held</th></tr></thead><tbody>${j.longest.map(x => `<tr><td>${who(x.holder, 1)}</td><td><a href="/c/${esc(x.mint)}"><b>$${esc(x.symbol)}</b></a></td><td class="n mono">${dur(x.secs)}${x.live ? ' <span class="up" style="font-size:9px"><i></i>NOW</span>' : ''}</td></tr>`).join('')}</tbody></table></div>` : none('Nobody yet.')}
    <h2 style="margin-top:34px">Biggest dibs</h2>${j.biggest.length ? `<div class="tw"><table class="tbl"><thead><tr><th>caller</th><th>coin</th><th class="n">paid</th></tr></thead><tbody>${j.biggest.map(x => `<tr><td>${who(x.holder, 1)}</td><td><a href="/c/${esc(x.mint)}"><b>$${esc(x.symbol)}</b></a></td><td class="n"><b>${sol(x.sol)}</b></td></tr>`).join('')}</tbody></table></div>` : none('No dibs called yet.')}</div></div>`;
}
async function me(q) {
  const w = q.get('w') || (WAL && WAL.pk) || '';
  set(`<h1 style="font-size:clamp(36px,6vw,62px)">${w && WAL && w === WAL.pk ? 'My' : 'Wallet'} <span class="pill">dibs.</span></h1>
    <form id="mf" class="inrow" style="margin-top:22px;max-width:640px"><input class="in mono" id="mw" placeholder="paste a Solana address" value="${esc(w)}"><button class="b y" type="submit">Look up</button><button class="b" type="button" data-connect>Connect</button></form><div id="mo" class="sec" style="margin-top:30px"></div>`);
  $('#mf').addEventListener('submit', e => { e.preventDefault(); const v = $('#mw').value.trim(); if (v) go('/me?w=' + encodeURIComponent(v)); });
  if (!w) { $('#mo').innerHTML = `<div class="empty"><b>Connect or paste a wallet.</b>You’ll see the coins it holds dibs on, every dibs it had, and every fee it was paid.</div>`; return; }
  const j = await api('/api/coins?op=me&w=' + encodeURIComponent(w));
  if (!j.ok || j.offline) { $('#mo').innerHTML = `<div class="msg bad">${esc(j.error)}</div>`; return; }
  const fees = j.payouts.reduce((a, p) => a + p.sol, 0), out = j.reigns.reduce((a, r) => a + (r.paidOutSol || 0), 0), paidIn = j.reigns.reduce((a, r) => a + (r.paidInSol || 0), 0);
  $('#mo').innerHTML = `<div style="display:flex;align-items:center;gap:14px">${face(w, 'lg')}<div class="mono" style="word-break:break-all;font-weight:700">${esc(w)}</div></div>
    <div class="stats s4" style="margin-top:22px"><div class="st"><div class="l">holding dibs on</div><div class="v">${j.holding.length}</div></div><div class="st"><div class="l">fees received</div><div class="v">${sol(fees)}</div></div><div class="st"><div class="l">paid when out-dibsed</div><div class="v">${sol(out)}</div></div><div class="st"><div class="l">spent on dibs</div><div class="v">${sol(paidIn)}</div></div></div>
    <section class="sec"><h2>Dibs held now</h2>${j.holding.length ? `<div class="grid g3">${j.holding.map(card).join('')}</div>` : `<div class="empty">No dibs right now. <a class="b sm y" href="/coins" style="margin-left:8px">Find a coin</a></div>`}</section>
    <section class="sec"><h2>Every dibs</h2>${j.reigns.length ? `<div class="tw"><table class="tbl"><thead><tr><th>coin</th><th>held</th><th class="n">paid</th><th class="n">fees</th><th class="n">got back</th></tr></thead><tbody>${j.reigns.map(r => `<tr><td><a href="/c/${esc(r.mint)}"><b>$${esc(r.symbol)}</b></a></td><td class="mono">${r.end ? dur((new Date(r.end) - new Date(r.start)) / 1000) : '<b>holding</b>'}</td><td class="n">${r.paidInSol ? sol(r.paidInSol) : 'launcher'}</td><td class="n">${sol(r.feesSol)}</td><td class="n">${r.end ? sol(r.paidOutSol) : '—'}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">None yet.</div>'}</section>
    <section class="sec grid g2" style="align-items:start"><div><h2>Fee payouts</h2>${j.payouts.length ? `<div class="feed">${j.payouts.map(p => `<div class="it"><span class="k pay">◎</span><div class="t"><b>${sol(p.sol)}</b> from <a href="/c/${esc(p.mint)}">$${esc(p.symbol)}</a> <small>· ${ago(p.at)} ago</small></div><a class="tx" href="${tx(p.sig)}" target="_blank" rel="noopener">tx ↗</a></div>`).join('')}</div>` : '<div class="empty">None yet.</div>'}</div>
    <div><h2>Dibs called</h2>${j.orders.length ? `<div class="feed">${j.orders.map(o => `<div class="it"><span class="k">☝</span><div class="t"><a href="/c/${esc(o.mint)}"><b>$${esc(o.symbol)}</b></a> at ${sol(o.priceSol)} · <b>${esc(o.state)}</b> <small>· ${ago(o.at)} ago</small></div>${['waiting', 'paying'].includes(o.state) ? `<button class="b sm" type="button" data-resume="${esc(o.id)}">Open</button>` : ''}</div>`).join('')}</div>` : '<div class="empty">None yet.</div>'}</div></section>`;
  $$('[data-resume]').forEach(b => b.addEventListener('click', async () => { const s = await api('/api/dibs?op=status&id=' + b.dataset.resume); if (s.ok) trackOrder({ id: s.id, wallet: s.wallet, need: s.need, needSol: s.needSol, symbol: s.coin && s.coin.symbol }); }));
}

// ---------- how and $DIBS ----------
async function how() {
  const cfg = await config(); const prev = (cfg.prevBps || 9000) / 100;
  set(`<h1 style="font-size:clamp(36px,6vw,62px)">The rules of <span class="pill">dibs.</span></h1><p class="lead">Short version: whoever has dibs gets the fees, and taking dibs from someone costs 20% more than they paid and pays them for it.</p>
    <div class="grid g2 sec" style="align-items:start;margin-top:36px">
      <div class="card"><h3>1 · Launching</h3><p>Anyone launches a coin on pump.fun through DIBS: a picture, a name, a ticker, a first buy (${cfg.minDev}–${cfg.maxDev} SOL) and a <b>start price</b> for dibs (${cfg.minStart}–${cfg.maxStart} SOL). The launcher is the first dibs holder. The first-buy tokens go to the launcher.</p></div>
      <div class="card"><h3>2 · Holding dibs</h3><p>The coin’s creator wallet is held by the DIBS engine. pump.fun pays the coin’s creator fees into it; the engine claims them and pays them to whoever holds dibs once at least ${cfg.payMinSol} SOL is waiting. ${cfg.reserveSol} SOL stays in the coin wallet for gas.</p></div>
      <div class="card"><h3>3 · Calling dibs</h3><p>Anyone can call dibs by sending the current price (+${cfg.bufferSol} SOL for network fees, the unused part comes back) to a one-off dibs wallet. When it lands, the engine first pays the outgoing holder every fee still waiting, then hands dibs to the caller in one database step, and the price rises <b>20%</b>.</p></div>
      <div class="card"><h3>4 · The split</h3><p><b>${prev}%</b> of the price goes to the outgoing holder. <b>${(cfg.burnBps || 500) / 100}%</b> buys the coin back on pump.fun and burns it. ${cfg.cutBps ? `<b>${cfg.cutBps / 100}%</b> goes to the $DIBS treasury.` : 'The $DIBS treasury’s 5% goes to the outgoing holder until the treasury is set.'} If the buyback can’t run, its SOL goes to the outgoing holder, never back to the caller.</p></div>
      <div class="card"><h3>5 · Races and refunds</h3><p>Two people can open a dibs at the same price. The first deposit to land wins; the other is refunded in full. A dibs not funded within ${cfg.orderMin || 30} minutes is cancelled and anything sent is returned. You can’t call dibs on a coin you already hold.</p></div>
      <div class="card"><h3>6 · The honest part</h3><p>Dibs is a game. A holder who gets out-dibsed always gets back more than they paid (${(1.2 * prev).toFixed(0)}%), but the <b>last</b> holder only gets fees, and fees depend on people trading. Prices climb 20% per dibs, so at some point nobody pays the next one. Only use SOL you can lose. Nothing here is financial advice.</p></div>
    </div>
    <section class="sec"><div class="card"><h3>Custody, plainly</h3><p>Each coin’s creator wallet and each dibs wallet is derived on the server from one secret. That means the engine signs for them. It is written to do only five things: create the coin, claim its fees, pay the holder, split a dibs payment, and refund. Every one of those is a Solana transaction you can open from the coin’s page. The engine runs on every visit to the site (at most once a minute) and on every dibs status check.</p>
      <p style="margin-bottom:0"><button class="b y" type="button" id="st">Run the self-test</button> <span class="hint">Builds a pump.fun create, a fee claim and a payout and simulates them on mainnet. Nothing is sent.</span></p><div id="sto"></div></div></section>
    <section class="sec"><h2 style="margin-bottom:18px">Questions</h2>${faq(cfg)}</section>`);
  $('#st').addEventListener('click', async () => { $('#st').disabled = true; $('#sto').innerHTML = '<div class="msg">Simulating on mainnet…</div>'; const j = await api('/api/launch?op=selftest', { ms: 60000 }); $('#st').disabled = false;
    if (!j.ok) { $('#sto').innerHTML = `<div class="msg bad">${esc(j.error)}</div>`; return; }
    const row = (k, v) => `<div class="it"><span class="k ${v && v.ok && (!v.sim || !v.sim.err) ? 'pay' : 'burn'}">${v && v.ok && (!v.sim || !v.sim.err) ? '✓' : '!'}</span><div class="t"><b>${k}</b> <small>${esc(v ? (v.sim ? (v.sim.err ? 'simulation error: ' + JSON.stringify(v.sim.err) : 'simulated OK') : v.error || JSON.stringify(Object.fromEntries(Object.entries(v).filter(([x]) => !['ok', 'ms'].includes(x))))) : '')}</small></div><span class="mono dim">${v && v.ms}ms</span></div>`;
    $('#sto').innerHTML = `<div class="feed" style="margin-top:14px">${['create', 'claim', 'payout', 'buyback', 'keys', 'price'].filter(k => j[k]).map(k => row(k, j[k])).join('')}</div><p class="hint">${esc(j.note)}</p>`; });
}
async function token() {
  const [cfg, st] = await Promise.all([config(), api('/api/coins?op=stats')]);
  set(`<h1 style="font-size:clamp(36px,6vw,62px)"><span class="pill">$DIBS</span></h1><p class="lead">The DIBS token. ${cfg.cutBps ? `${cfg.cutBps / 100}% of every dibs called on any coin goes to its treasury.` : 'Once its treasury is set, 5% of every dibs called on any coin goes to it.'}</p>
    <div class="grid g2 sec" style="align-items:start;margin-top:34px">
      <div class="card"><div class="lab" style="margin-top:0">contract</div>${cfg.ca ? `<div class="addr"><code>${esc(cfg.ca)}</code><button class="b sm" type="button" data-copy="${esc(cfg.ca)}" data-what="CA copied">Copy</button></div><div class="links">${ext('https://pump.fun/coin/' + cfg.ca, 'Buy on pump.fun ↗', 'b sm y')}${ext('https://dexscreener.com/solana/' + cfg.ca, 'Chart ↗')}</div>` : `<div class="val" style="margin-top:6px">not launched yet</div><p class="hint">The contract address goes here the moment it exists. Anything claiming to be $DIBS before then isn’t.</p>`}
        ${cfg.x ? `<div class="links">${ext(cfg.x, 'Follow on X ↗')}</div>` : ''}</div>
      <div class="card"><div class="lab" style="margin-top:0">treasury</div>${cfg.treasury ? `<div class="addr"><code>${esc(cfg.treasury)}</code>${ext(acct(cfg.treasury), 'Solscan ↗')}</div>` : '<div class="val" style="margin-top:6px">not set yet</div><p class="hint">Until it is, the treasury’s share of every dibs goes to the outgoing holder.</p>'}
        <div class="lab">sent to the treasury so far</div><div class="big" style="font-size:40px">${st.ok ? num(st.treasurySol) : '—'}<span style="font-size:.4em"> SOL</span></div></div>
    </div>`);
}
function notFound() { return `<div class="empty" style="margin-top:40px"><span class="hand">${HAND}</span><b style="font-size:40px;margin-top:10px">404</b>Nobody called dibs on this page, because it doesn’t exist.<div style="margin-top:16px"><a class="b y" href="/">Go home</a></div></div>`; }


// ================= motion & effects =================
const HAMMY = `<svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="46" fill="#FFE9C9" stroke="#141414" stroke-width="5"/><circle cx="28" cy="31" r="10" fill="#E8A25A" stroke="#141414" stroke-width="4.5"/><circle cx="28" cy="31" r="4.5" fill="#F4B3AA"/><circle cx="72" cy="31" r="10" fill="#E8A25A" stroke="#141414" stroke-width="4.5"/><circle cx="72" cy="31" r="4.5" fill="#F4B3AA"/><ellipse cx="50" cy="56" rx="31" ry="27" fill="#E8A25A" stroke="#141414" stroke-width="4.5"/><ellipse cx="29" cy="64" rx="13" ry="11" fill="#F8D7AE" stroke="#141414" stroke-width="3.5"/><ellipse cx="71" cy="64" rx="13" ry="11" fill="#F8D7AE" stroke="#141414" stroke-width="3.5"/><ellipse cx="50" cy="66" rx="12" ry="9" fill="#F8D7AE"/><circle cx="40" cy="50" r="4.6" fill="#141414"/><circle cx="41.6" cy="48.4" r="1.6" fill="#fff"/><circle cx="60" cy="50" r="4.6" fill="#141414"/><circle cx="61.6" cy="48.4" r="1.6" fill="#fff"/><ellipse cx="50" cy="59" rx="3.6" ry="2.6" fill="#E26D6D" stroke="#141414" stroke-width="2"/><path d="M45.5 64.5 Q50 68 54.5 64.5" fill="none" stroke="#141414" stroke-width="2.4" stroke-linecap="round"/></svg>`;
const QUACK = `<svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="46" fill="#D5ECFF" stroke="#141414" stroke-width="5"/><path d="M18 74 Q50 84 84 72" fill="none" stroke="#7FBDEB" stroke-width="5" stroke-linecap="round"/><ellipse cx="55" cy="62" rx="27" ry="16" fill="#FFD23F" stroke="#141414" stroke-width="4.5"/><path d="M58 58 Q68 52 74 60" fill="none" stroke="#141414" stroke-width="3.5" stroke-linecap="round"/><circle cx="40" cy="38" r="15" fill="#FFD23F" stroke="#141414" stroke-width="4.5"/><path d="M26 39 Q14 40 18 46 Q24 49 30 44 Z" fill="#FF8A3D" stroke="#141414" stroke-width="3.5" stroke-linejoin="round"/><circle cx="39" cy="34" r="3.6" fill="#141414"/><circle cx="40.2" cy="32.8" r="1.2" fill="#fff"/></svg>`;
const DEMOS = [{ name: 'Hammy', sym: 'HAMMY', art: HAMMY, start: 1 }, { name: 'Quack', sym: 'QUACK', art: QUACK, start: 0.5 }];
// an example card that plays the rules on a loop: someone calls dibs, the old holder gets paid, the price climbs 20%
function demo(host, d, tilt, delay) {
  let price = d.start, n = 0, seed = d.sym + ':0';
  host.innerHTML = `<div class="${tilt} float${tilt === 'tr' ? ' d2' : ''}" style="position:relative"><div class="dc demo" style="pointer-events:none">
    <div class="top"><span class="img">${d.art}</span><span class="up"><i></i>UP FOR DIBS</span></div>
    <div class="nm">${d.name}<span>$${d.sym}</span></div>
    <div class="lab">dibs holder</div><div class="val" data-h>${face(seed)}<span class="mono flip">anon</span></div>
    <div class="row"><div><div class="lab">dibs costs</div><div class="val"><span class="flip" data-p>${num(price)} SOL</span></div></div><div><div class="lab">next one</div><div class="val"><span class="flip" data-n>+20%</span></div></div></div>
    <span class="b y go" data-btn>Call dibs</span></div></div>`;
  if (REDUCE) return;
  const card = host.querySelector('.dc'), btn = host.querySelector('[data-btn]');
  const step = () => {
    if (!document.body.contains(host)) return clearInterval(t);
    btn.classList.add('press'); setTimeout(() => btn.classList.remove('press'), 160);
    const r = btn.getBoundingClientRect(); if (r.top > 0 && r.bottom < innerHeight) burst(r.left + r.width / 2, r.top + r.height / 2, 'DIBS!');
    const paid = price * ((CFG && CFG.prevBps) || 9500) / 1e4;
    const plus = document.createElement('div'); plus.className = 'plus'; plus.textContent = `+${num(paid)} SOL to the last holder`; card.appendChild(plus); setTimeout(() => plus.remove(), 1500);
    price = Math.ceil(price * 1.2 * 1e4) / 1e4; n++; seed = d.sym + ':' + n;
    const h = host.querySelector('[data-h]'); h.innerHTML = `${face(seed)}<span class="mono flip go">${['anon', 'degen', 'whale', 'you?', 'ser', 'fren'][n % 6]}</span>`; h.classList.remove('swap'); void h.offsetWidth; h.classList.add('swap');
    const pe = host.querySelector('[data-p]'); pe.classList.remove('go'); void pe.offsetWidth; pe.classList.add('go'); setTimeout(() => { pe.textContent = num(price) + ' SOL'; }, 220);
    if (n >= 9) { n = 0; price = d.start; }
  };
  let t; setTimeout(() => { if (!document.body.contains(host)) return; step(); t = setInterval(step, 3200); TIMERS.push(t); }, 1600 + delay);
}
function xtapes() {
  const a = ['CALL DIBS ☝', 'COLLECT THE FEES', 'GET OUT-DIBSED', '<em>+20%</em> EVERY TIME', 'THEY PAY YOU TO TAKE IT'];
  const b = ['WHOEVER HAS DIBS GETS THE FEES', '<em>95%</em> TO THE LAST HOLDER', '<em>5%</em> BOUGHT BACK &amp; BURNED', 'ANY COIN. ANY TIME.'];
  const run = list => { const one = `<span>${list.map(x => `<span>${x}</span>`).join('<span>✦</span>')}<span>✦</span></span>`; return one + one + one + one; };
  return `<div class="xtapes" aria-hidden="true"><div class="xt b"><div class="xr">${run(b)}</div></div><div class="xt a"><div class="xr">${run(a)}</div></div></div>`;
}
// comic burst wherever someone presses a yellow or black button
const BC = ['#FFD23F', '#ffb08a', '#7cc6ff', '#b9f3cf', '#ffb3c7'];
function burst(x, y, text = 'DIBS!') {
  if (REDUCE) return;
  const d = document.createElement('div'); d.className = 'burst'; d.style.left = x + 'px'; d.style.top = y + 'px';
  d.innerHTML = `<b>${text}</b>` + Array.from({ length: 12 }, (_, i) => `<i style="--a:${i * 30 + Math.random() * 14}deg;--c:${BC[i % 5]}"></i>`).join('');
  document.body.appendChild(d); setTimeout(() => d.remove(), 900);
}
document.addEventListener('click', e => { const b = e.target.closest('.b.y, .b.k'); if (b && !b.disabled) burst(e.clientX, e.clientY, /dibs/i.test(b.textContent) ? 'DIBS!' : ['NICE!', 'GO!', 'YES!'][Math.floor(Math.random() * 3)]); });
// reveal on scroll, count-ups and 3D tilt, wired to whatever the router draws
const IO = 'IntersectionObserver' in window ? new IntersectionObserver(es => es.forEach(e => { if (!e.isIntersecting) return; e.target.classList.add('vis'); IO.unobserve(e.target); }), { rootMargin: '0px 0px -6% 0px', threshold: 0.06 }) : null;
const CO = 'IntersectionObserver' in window ? new IntersectionObserver(es => es.forEach(e => { if (!e.isIntersecting) return; CO.unobserve(e.target); countUp(e.target); }), { threshold: 0.3 }) : null;
function countUp(el) {
  const to = +el.dataset.count || 0, unit = el.dataset.unit || '', int = !unit;
  if (REDUCE || !to) { el.textContent = (int ? to : num(to)) + unit; return; }
  const t0 = performance.now(), dur = 1200;
  const tick = now => { const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3), v = to * e; el.textContent = (int ? Math.round(v) : num(+v.toFixed(4))) + unit; if (k < 1) requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
}
function tilt(el) {
  el.classList.add('tilt');
  el.addEventListener('pointermove', e => { const r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5; el.style.transform = `perspective(900px) rotateX(${(-y * 9).toFixed(2)}deg) rotateY(${(x * 11).toFixed(2)}deg) translateY(-4px)`; });
  el.addEventListener('pointerleave', () => { el.style.transform = ''; });
}
function fx(root) {
  if (!root) return;
  let i = 0;
  root.querySelectorAll('h1:not(.wired), h2:not(.wired), .lead:not(.wired), .dc:not(.wired), .card:not(.wired), .st:not(.wired), .it:not(.wired), .tw:not(.wired), details:not(.wired), .split:not(.wired), .empty:not(.wired), .msg:not(.wired), .lad:not(.wired)').forEach(el => {
    el.classList.add('wired');
    if (el.closest('.hero') || el.closest('.modal') || el.closest('.demo')) return;
    if (el.classList.contains('split')) { IO ? IO.observe(el) : el.classList.add('vis'); return; }
    el.classList.add('rv'); el.style.setProperty('--d', (i++ % 6) * 70 + 'ms');
    IO ? IO.observe(el) : el.classList.add('vis');
  });
  root.querySelectorAll('[data-count]:not(.counted)').forEach(el => { el.classList.add('counted'); CO ? CO.observe(el) : countUp(el); });
  if (FINE && !REDUCE) root.querySelectorAll('a.dc:not(.tilt), .stp:not(.tilt), .st:not(.tilt), .throne:not(.tilt)').forEach(tilt);
}
new MutationObserver(() => fx($('#screen'))).observe($('#screen'), { childList: true, subtree: true });
// doodles drifting behind the page, with a little parallax, and a scroll progress bar
(function doodles() {
  const host = $('#doodles'); if (!host) return;
  const D = {
    hand: `<svg viewBox="155 150 690 690"><rect x="378" y="716" width="250" height="104" rx="20" fill="#fff" stroke="#141414" stroke-width="30"/><rect x="352" y="452" width="296" height="292" rx="78" fill="#FFD23F" stroke="#141414" stroke-width="30"/><rect x="352" y="168" width="112" height="380" rx="56" fill="#FFD23F" stroke="#141414" stroke-width="30"/><rect x="470" y="452" width="178" height="96" rx="48" fill="#FFD23F" stroke="#141414" stroke-width="30"/><rect x="470" y="536" width="178" height="96" rx="48" fill="#FFD23F" stroke="#141414" stroke-width="30"/><rect x="470" y="620" width="178" height="96" rx="48" fill="#FFD23F" stroke="#141414" stroke-width="30"/><rect x="352" y="566" width="236" height="92" rx="46" fill="#FFD23F" stroke="#141414" stroke-width="30"/></svg>`,
    coin: `<svg viewBox="0 0 60 60"><circle cx="30" cy="30" r="25" fill="#FFD23F" stroke="#141414" stroke-width="4"/><circle cx="30" cy="30" r="16" fill="none" stroke="#141414" stroke-width="3" stroke-dasharray="4 5"/></svg>`,
    up: `<svg viewBox="0 0 60 60"><rect x="6" y="6" width="48" height="48" rx="13" fill="#fff" stroke="#141414" stroke-width="4"/><path d="M30 44V17M19 28l11-11 11 11" fill="none" stroke="#141414" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    star: `<svg viewBox="0 0 60 60"><path d="M30 4l6 18 18 6-18 6-6 18-6-18-18-6 18-6z" fill="#FFD23F" stroke="#141414" stroke-width="3.5" stroke-linejoin="round"/></svg>`,
    squig: `<svg viewBox="0 0 80 30"><path d="M4 18q8-14 16 0t16 0 16 0 16 0 8-6" fill="none" stroke="#141414" stroke-width="4" stroke-linecap="round"/></svg>`,
    pct: `<svg viewBox="0 0 90 46"><rect x="3" y="3" width="84" height="40" rx="12" fill="#b9f3cf" stroke="#141414" stroke-width="4"/><text x="45" y="31" text-anchor="middle" font-family="Inter,system-ui,sans-serif" font-weight="900" font-size="20" fill="#141414">+20%</text></svg>`,
  };
  const spots = [['hand', 4, 18, 54], ['coin', 92, 14, 44], ['star', 12, 62, 34], ['up', 88, 52, 46], ['pct', 6, 88, 74], ['squig', 82, 84, 70], ['coin', 46, 96, 38], ['star', 70, 30, 28], ['hand', 94, 74, 40], ['up', 26, 38, 36]];
  host.innerHTML = spots.map(([k, x, y, w], i) => `<div class="dd" style="left:${x}%;top:${y}%;width:${w}px;height:${w}px;--k:${(0.04 + (i % 4) * 0.035).toFixed(3)}"><div style="width:100%;height:100%;--t:${7 + (i % 5) * 1.6}s;--dl:${-i * 1.3}s;--r0:${-10 + (i % 3) * 4}deg;--r1:${8 - (i % 4) * 3}deg">${D[k]}</div></div>`).join('');
  let raf = 0;
  const onScroll = () => { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; const y = scrollY, h = document.documentElement.scrollHeight - innerHeight; host.style.setProperty('--sy', y); const p = $('#sprog'); if (p) p.style.transform = `scaleX(${h > 0 ? Math.min(1, y / h) : 0})`; }); };
  addEventListener('scroll', onScroll, { passive: true }); onScroll();
})();

route();
try { const o = JSON.parse(localStorage.getItem('dibs:order') || 'null'); if (o && o.id) api('/api/dibs?op=status&id=' + o.id).then(s => { if (s.ok && ['waiting', 'paying'].includes(s.state)) { trackOrder({ id: s.id, wallet: s.wallet, need: s.need, needSol: s.needSol, symbol: s.coin && s.coin.symbol }); toast('Picking up your dibs where it left off'); } else localStorage.removeItem('dibs:order'); }); } catch {}
