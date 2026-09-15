'use strict';
/* =====================================================================
   PULSEWALL — volatile metric monitor (cell-j04-s04)
   job: monitor × volatile-evidence-stream
   → anomalies visible within a glance (strip, tile tints, feed badges)
   → every change traceable (per-metric event log + annotated chart)
   → no flicker noise (stable slots, debounced states, targeted DOM updates)
   Deterministic seeded simulation; zero network, zero dependencies.
   ===================================================================== */

/* ---------------- tiny utils ---------------- */
const $ = (s, r = document) => r.querySelector(s);
function el(tag, cls, txt) { const n = document.createElement(tag); if (cls) n.className = cls; if (txt != null) n.textContent = txt; return n; }
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const pad2 = n => String(n).padStart(2, '0');
function hash01(n) { let x = Math.imul(n ^ 0x9E3779B9, 0x85EBCA6B); x ^= x >>> 13; x = Math.imul(x, 0xC2B2AE35); x ^= x >>> 16; return (x >>> 0) / 4294967296; }
function vnoise(t, seed) { // smooth value noise in [-.5,.5], 4s segments
  const k = Math.floor(t / 4), f = t / 4 - k, s = f * f * (3 - 2 * f);
  const a = hash01(Math.imul(k, 2654435761) ^ seed), b = hash01(Math.imul(k + 1, 2654435761) ^ seed);
  return a + (b - a) * s - .5;
}
const fmtClock = ts => { const d = new Date(ts); return pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds()); };
const fmtDur = s => { s = Math.max(0, Math.round(s)); const m = Math.floor(s / 60); return m > 0 ? `${m}m${pad2(s % 60)}s` : `${s}s`; };
function fmtV(m, v) { if (!isFinite(v)) return '–'; return (m.dec === 0 && Math.abs(v) >= 10000) ? v.toLocaleString('en-US') : v.toFixed(m.dec); }
function ctx2d(cv) {
  const d = window.devicePixelRatio || 1, r = cv.getBoundingClientRect();
  const W = Math.max(1, Math.round(r.width * d)), H = Math.max(1, Math.round(r.height * d));
  if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
  const ctx = cv.getContext('2d'); ctx.setTransform(d, 0, 0, d, 0, 0);
  return { ctx, w: r.width, h: r.height };
}

/* ---------------- stream config ---------------- */
const TICK_MS = 1000, HIST_MAX = 240, SPARK_N = 90, CHART_N = 180,
  DEBOUNCE = 2, RAMP = 15, SPIKE_Z = 4.2, FEED_MAX = 80, SPIKE_COALESCE = 8;
const ramp = (start, end, mag) => ({ type: 'ramp', start, end, mag });
const burst = (start, end, mag) => ({ type: 'burst', start, end, mag });
const flat = (start, end) => ({ type: 'flat', start, end });

const GROUPS = [
  { id: 'edge', name: 'Edge Gateway', tag: 'edge' },
  { id: 'api', name: 'Payments API', tag: 'api' },
  { id: 'search', name: 'Search Index', tag: 'srch' },
  { id: 'ingest', name: 'Ingest Pipeline', tag: 'ing' },
];
const groupOf = id => GROUPS.find(g => g.id === id);

let _s = 0;
function M(id, name, gid, unit, dec, cfg) {
  _s++;
  return Object.assign({
    id, name, gid, unit, dec,
    seed: _s * 7919, phase: hash01(_s * 131 + 7) * 6.2832,
    warn: null, crit: null, dir: null, scripts: [],
    hist: [], state: 0, cand: 0, candN: 0, flatNow: false,
    ev: [], evDirty: true, entry: null, lastEvT: null, lastSpikeFeedT: -1e9,
    lo: null, hi: null,
    node: null, seg: null, numEl: null, dEl: null, sEl: null, cv: null,
  }, cfg);
}

const METRICS = [
  /* ---- Edge Gateway ---- */
  M('edge-gw1-loss', 'gw1 · packet loss', 'edge', '%', 2, { base: .25, amp: .06, period: 95, noise: .05, dir: 'upBad', warn: 1, crit: 3, scripts: [ramp(70, 200, 3.2)] }),
  M('edge-gw1-cpu', 'gw1 · cpu', 'edge', '%', 1, { base: 46, amp: 6, period: 130, noise: 2.5, dir: 'upBad', warn: 80, crit: 92 }),
  M('edge-gw2-loss', 'gw2 · packet loss', 'edge', '%', 2, { base: .18, amp: .05, period: 110, noise: .04, dir: 'upBad', warn: 1, crit: 3 }),
  M('edge-gw2-cpu', 'gw2 · cpu', 'edge', '%', 1, { base: 39, amp: 5, period: 80, noise: 2, dir: 'upBad', warn: 80, crit: 92, scripts: [burst(-150, -120, 26)] }),
  M('edge-gw3-sess', 'gw3 · sessions', 'edge', 'k', 2, { base: 12.4, amp: 1.1, period: 150, noise: .35 }),
  M('edge-lb-rps', 'lb · request rate', 'edge', 'k/s', 2, { base: 41, amp: 2.2, period: 120, noise: .8, scripts: [burst(6, 14, 12)] }),
  M('edge-lb-qlen', 'lb · queue length', 'edge', '', 0, { base: 118, amp: 14, period: 90, noise: 6, dir: 'upBad', warn: 400, crit: 900 }),
  M('edge-gw4-cpu', 'gw4 · cpu', 'edge', '%', 1, { base: 51, amp: 5, period: 100, noise: 2.4, dir: 'upBad', warn: 80, crit: 92 }),
  /* ---- Payments API ---- */
  M('api-p99', 'p99 latency', 'api', 'ms', 0, { base: 320, amp: 26, period: 140, noise: 14, dir: 'upBad', warn: 800, crit: 1500, scripts: [ramp(-60, 140, 2100)] }),
  M('api-p95', 'p95 latency', 'api', 'ms', 0, { base: 190, amp: 15, period: 130, noise: 9, dir: 'upBad', warn: 500, crit: 900, scripts: [ramp(-58, 130, 620)] }),
  M('api-err', 'error rate', 'api', '%', 2, { base: .42, amp: .06, period: 160, noise: .05, dir: 'upBad', warn: 2, crit: 5, scripts: [ramp(-40, 60, 2.2)] }),
  M('api-pool', 'db pool wait', 'api', 'ms', 1, { base: 12, amp: 1.6, period: 100, noise: .8, dir: 'upBad', warn: 60, crit: 120, scripts: [flat(-25, 45)] }),
  M('api-q', 'queue depth', 'api', '', 0, { base: 210, amp: 18, period: 110, noise: 12, dir: 'upBad', warn: 800, crit: 2000, scripts: [ramp(-50, 120, 1100)] }),
  M('api-tx', 'tx rate', 'api', '/s', 0, { base: 1450, amp: 70, period: 150, noise: 40 }),
  M('api-auth', 'auth failures', 'api', '%', 2, { base: .21, amp: .04, period: 120, noise: .04, dir: 'upBad', warn: 1.5, crit: 4 }),
  M('api-fb', 'fallback rate', 'api', '%', 2, { base: 1.1, amp: .15, period: 140, noise: .12, dir: 'upBad', warn: 6, crit: 12 }),
  /* ---- Search Index ---- */
  M('srch-q99', 'query p99', 'search', 'ms', 0, { base: 88, amp: 7, period: 90, noise: 4, dir: 'upBad', warn: 250, crit: 500 }),
  M('srch-lag', 'index lag', 'search', 's', 1, { base: 3.2, amp: .4, period: 170, noise: .25, dir: 'upBad', warn: 20, crit: 45, scripts: [ramp(95, 210, 60)] }),
  M('srch-cache', 'cache hit', 'search', '%', 2, { base: 94, amp: .7, period: 200, noise: .35, dir: 'upGood', warn: 88, crit: 75, scripts: [ramp(-90, -20, -25)] }),
  M('srch-qps', 'query rate', 'search', 'k/s', 2, { base: 8.4, amp: .5, period: 110, noise: .22, scripts: [burst(30, 44, 3.5)] }),
  M('srch-fan', 'fanout', 'search', 'ms', 0, { base: 34, amp: 3, period: 95, noise: 1.6, dir: 'upBad', warn: 120, crit: 240 }),
  M('srch-zero', 'zero results', 'search', '%', 1, { base: 6.5, amp: .6, period: 180, noise: .35, dir: 'upBad', warn: 15, crit: 30 }),
  M('srch-heap', 'node3 heap', 'search', '%', 1, { base: 72, amp: 2.4, period: 210, noise: .9, dir: 'upBad', warn: 88, crit: 96, scripts: [ramp(150, 260, 30)] }),
  /* ---- Ingest Pipeline ---- */
  M('ing-lag', 'pipeline lag', 'ingest', 's', 1, { base: 8, amp: .9, period: 160, noise: .5, dir: 'upBad', warn: 30, crit: 60, scripts: [ramp(170, 300, 90)] }),
  M('ing-tpt', 'throughput', 'ingest', 'k/s', 2, { base: 42, amp: 1.6, period: 130, noise: .5, scripts: [flat(15, 55)] }),
  M('ing-dlq', 'dlq rate', 'ingest', '/m', 1, { base: 3, amp: .4, period: 140, noise: .25, dir: 'upBad', warn: 25, crit: 80 }),
  M('ing-schema', 'schema errors', 'ingest', '%', 2, { base: .8, amp: .12, period: 150, noise: .08, dir: 'upBad', warn: 4, crit: 9 }),
  M('ing-cpu', 'worker cpu', 'ingest', '%', 1, { base: 58, amp: 4, period: 120, noise: 1.8, dir: 'upBad', warn: 85, crit: 95 }),
  M('ing-ckpt', 'checkpoint age', 'ingest', 's', 1, { base: 2.1, amp: .3, period: 130, noise: .15, dir: 'upBad', warn: 15, crit: 40, scripts: [ramp(-70, -10, 50)] }),
];
const byId = Object.fromEntries(METRICS.map(m => [m.id, m]));

const SEVC = ['ok', 'warn', 'crit'];
const STATE_COLOR = ['#3f7fc4', '#f2b63b', '#ff5f5f'];
const EV_LABEL = { warn: 'WARN', crit: 'CRIT', recover: 'OK', spike: 'SPIKE', flat: 'FLAT' };

/* ---------------- deterministic value generator ---------------- */
function frozenAt(m, t) {
  for (const sc of m.scripts) if (sc.type === 'flat' && t >= sc.start && t <= sc.end) return sc.start;
  return null;
}
function baseAt(m, t) {
  return m.base + m.amp * Math.sin(6.2832 * t / m.period + m.phase) + 3 * m.amp * vnoise(t / 3, m.seed);
}
function anomOffset(m, t) {
  let off = 0;
  for (const sc of m.scripts) {
    if (sc.type === 'burst') {
      if (t < sc.start || t > sc.end) continue;
      for (let c = sc.start; c <= sc.end; c += 4) { const d = t - c; off += sc.mag * Math.exp(-(d * d) / 2.42); }
    } else {
      if (sc.type === 'flat') continue; // frozen windows don't ramp
      if (t < sc.start || t > sc.end + RAMP) continue;
      let w;
      if (t < sc.start + RAMP) w = (t - sc.start) / RAMP;
      else if (t > sc.end) w = 1 - (t - sc.end) / RAMP;
      else w = 1;
      w = clamp(w, 0, 1); w = w * w * (3 - 2 * w);
      off += sc.mag * w;
    }
  }
  return off;
}
function genValue(m, t) {
  const fz = frozenAt(m, t);
  if (fz !== null) return baseAt(m, fz);            // stuck signal: deterministic part frozen, no noise
  const nz = m.noise * (vnoise(t, m.seed * 7 + 13) + .6 * (hash01(Math.imul(t, 97) + m.seed) - .5));
  return baseAt(m, t) + nz + anomOffset(m, t);
}

/* ---------------- detectors ---------------- */
function classify(m, v) { // 0 ok · 1 warn · 2 crit by absolute thresholds
  if (m.warn == null) return 0;
  if (m.dir === 'upGood') return v <= m.crit ? 2 : v <= m.warn ? 1 : 0;
  return v >= m.crit ? 2 : v >= m.warn ? 1 : 0;
}
function flatRange(m, hist) { // null unless the last 12 samples are frozen
  const n = Math.min(12, hist.length); if (n < 12) return null;
  let lo = Infinity, hi = -Infinity;
  for (let i = hist.length - n; i < hist.length; i++) { const v = hist[i].v; if (v < lo) lo = v; if (v > hi) hi = v; }
  const eps = Math.max(m.noise * .35, 1e-9);
  return (hi - lo) < eps ? (hi - lo) : null;
}
function breachRule(m, sev) {
  const th = sev === 2 ? m.crit : m.warn;
  const op = m.dir === 'upGood' ? '≤' : '≥';
  return `${op} ${fmtV(m, th)}${m.unit} · 2s persist`;
}

/* ---------------- event / feed stores ---------------- */
const feed = [];            // newest first
let eid = 0, curT = 0, uiReady = false;
const T0 = Date.now();

function logEv(m, t, type, v, prev, note) {
  m.ev.push({ t, type, v, prev, note });
  if (m.ev.length > 40) m.ev.shift();
  m.evDirty = true;
  m.lastEvT = t;
}
function makeEntry(m, t, kind, sev, rule) {
  const e = { id: 'e' + (eid++), m, kind, sev, rule, t0: t, t1: null, peak: m.hist.length ? m.hist[m.hist.length - 1].v : 0, peakAt: t, node: null, durEl: null, badgeEl: null, peakEl: null };
  feed.unshift(e);
  m.entry = e;
  if (uiReady) feedList.prepend(entryNode(e));
  feedTrim();
  return e;
}
function entryResolve(e) { if (!e.node) return; e.node.classList.add('done'); }
function entryEscalate(e, rule) {
  e.sev = 'crit'; if (rule) e.rule = rule;
  if (e.node) { e.node.dataset.sev = 'crit'; e.badgeEl.textContent = 'CRIT'; e.ruleEl.textContent = e.rule; }
}
function feedTrim() {
  while (feed.length > FEED_MAX) { const e = feed.pop(); if (e.node) e.node.remove(); }
}
function updateEntryPeak(e) {
  if (!e.peakEl) return;
  e.peakEl.textContent = `peak ${fmtV(e.m, e.peak)}${e.m.unit} @ ${fmtClock(T0 + e.peakAt * 1000)}`;
}

/* ---------------- per-tick pipeline ---------------- */
function step(m, t) {
  // rolling stats over the window BEFORE the current sample (for z-scores)
  const n = Math.min(30, m.hist.length);
  let mu = 0, sd = 0;
  if (n > 10) {
    for (let i = m.hist.length - n; i < m.hist.length; i++) mu += m.hist[i].v;
    mu /= n;
    for (let i = m.hist.length - n; i < m.hist.length; i++) { const d = m.hist[i].v - mu; sd += d * d; }
    sd = Math.sqrt(sd / n);
  }
  const prevV = m.hist.length ? m.hist[m.hist.length - 1].v : null;
  const v = genValue(m, t);
  m.hist.push({ t, v });
  if (m.hist.length > HIST_MAX) m.hist.shift();

  m.flatNow = frozenAt(m, t) !== null && flatRange(m, m.hist) !== null;

  // state machine with 2-tick debounce (kills flapping → no flicker noise)
  const sev = Math.max(classify(m, v), m.flatNow ? 1 : 0);
  if (sev !== m.state) {
    if (m.cand === sev) m.candN++; else { m.cand = sev; m.candN = 1; }
    if (m.candN >= DEBOUNCE) {
      const from = m.state; m.state = sev; m.cand = sev; m.candN = 0;
      onStateChange(m, t, v, prevV, from, sev);
    }
  } else { m.cand = sev; m.candN = 0; }

  // volatility spike: transient event, never a state change.
  // Baseline window must look "alive" (sd ≳ noise), else frozen/just-recovered
  // windows exaggerate the first wiggle into a fake spike.
  if (!m.flatNow && m.state === 0 && sd > m.noise * .6) {
    const z = Math.abs(v - mu) / sd;
    if (z >= SPIKE_Z) {
      logEv(m, t, 'spike', v, prevV, `${fmtV(m, prevV)} → ${fmtV(m, v)}${m.unit} · z=${z.toFixed(1)}`);
      if (t - m.lastSpikeFeedT > SPIKE_COALESCE) { // coalesce burst spikes → feed stays readable
        m.lastSpikeFeedT = t;
        const e = makeEntry(m, t, 'spike', 'spike', `volatility spike · z=${z.toFixed(1)}`);
        e.t1 = t; entryResolve(e); m.entry = null;
      }
    }
  }

  // live peak tracking on the open incident
  const e = m.entry;
  if (e && e.kind !== 'spike') {
    const worse = m.dir === 'upGood' ? v < e.peak : v > e.peak;
    if (worse) { e.peak = v; e.peakAt = t; }
  }
}

function onStateChange(m, t, v, prevV, from, to) {
  if (to === 0) { // recovery
    const e = m.entry, dur = e ? fmtDur(t - e.t0) : '?';
    logEv(m, t, 'recover', v, prevV, `${fmtV(m, prevV)} → ${fmtV(m, v)}${m.unit} · in band after ${dur}`);
    if (e) { e.t1 = t; entryResolve(e); m.entry = null; }
    return;
  }
  if (from === 0) { // new incident
    let kind, type, rule;
    if (to === 2) { kind = 'breach'; type = 'crit'; rule = breachRule(m, 2); }
    else if (m.flatNow) { kind = 'flat'; type = 'flat'; rule = `flatline · range≈0 over 12s`; }
    else { kind = 'breach'; type = 'warn'; rule = breachRule(m, 1); }
    logEv(m, t, type, v, prevV, `${fmtV(m, prevV)} → ${fmtV(m, v)}${m.unit} · ${rule}`);
    makeEntry(m, t, kind, to === 2 ? 'crit' : 'warn', rule);
  } else if (from === 1 && to === 2) { // escalation of the same incident
    const rule = breachRule(m, 2);
    logEv(m, t, 'crit', v, prevV, `${fmtV(m, prevV)} → ${fmtV(m, v)}${m.unit} · escalated: ${rule}`);
    if (m.entry) entryEscalate(m.entry, rule);
  }
}

/* ---------------- UI build ---------------- */
const gridEl = $('#grid'), stripEl = $('#strip'), feedList = $('#feedList'),
  feedRateEl = $('#feedRate'), traceEmpty = $('#traceEmpty'), traceBody = $('#traceBody'),
  trHead = $('#trHead'), chartWrap = $('#chartWrap'), chartCv = $('#chart'),
  xh = $('#xhair'), evList = $('#evList'), qEl = $('#q');
const groupEls = {};
let sel = null, chartGeo = null, filterMode = 'all', searchTerm = '';

function groupTag(gid) { return groupOf(gid).tag; }

function buildTile(m) {
  const n = el('div', 'tile'); n.dataset.sev = 'ok'; n.tabIndex = 0;
  n.setAttribute('role', 'button'); n.setAttribute('aria-label', m.name);
  const top = el('div', 't-top');
  top.append(el('span', 'dot'), el('span', 't-name', m.name), el('span', 't-grp', groupTag(m.gid)));
  const mid = el('div', 't-mid');
  m.numEl = el('span', 't-num', '–');
  const val = el('span', 't-val'); val.append(m.numEl);
  if (m.unit) val.append(el('i', null, m.unit));
  m.dEl = el('span', 't-delta flat', '·');
  mid.append(val, m.dEl);
  m.cv = el('canvas', 'spark');
  m.sEl = el('div', 't-since', 'ok'); m.sEl.dataset.sev = 'ok';
  n.append(top, mid, m.cv, m.sEl);
  n.addEventListener('click', () => selectMetric(m));
  n.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectMetric(m); locate(m); } });
  m.node = n;
  return n;
}

function buildUI() {
  for (const g of GROUPS) {
    const sec = el('section', 'group');
    const head = el('div', 'g-head');
    head.append(el('span', 'g-name', g.name));
    const okEl = el('span', 'g-ok', ''); okEl.dataset.worst = 'ok';
    head.append(okEl); groupEls[g.id] = { okEl, worst: 'ok' };
    const gg = el('div', 'g-grid');
    for (const m of METRICS.filter(x => x.gid === g.id)) gg.append(buildTile(m));
    sec.append(head, gg);
    gridEl.append(sec);
  }
  // fleet strip — one stable segment per metric, group gaps preserved
  METRICS.forEach((m, i) => {
    const s = el('div', 'seg' + (i > 0 && METRICS[i - 1].gid !== m.gid ? ' gap' : ''));
    s.dataset.sev = 'ok'; s.title = m.name;
    s.addEventListener('click', () => { selectMetric(m); locate(m); });
    stripEl.append(s); m.seg = s;
  });
}

function entryNode(e) {
  const m = e.m;
  const n = el('div', 'entry'); n.dataset.sev = e.sev;
  const side = el('div', 'e-side');
  e.badgeEl = el('span', 'e-badge', e.kind === 'spike' ? 'SPIKE' : e.kind === 'flat' ? 'FLAT' : e.sev.toUpperCase());
  e.durEl = el('span', 'e-dur', e.t1 != null ? fmtDur(e.t1 - e.t0) : fmtDur(curT - e.t0));
  side.append(e.badgeEl, e.durEl, el('span', 'e-t0', fmtClock(T0 + e.t0 * 1000)));
  const main = el('div', 'e-main');
  main.append(el('div', 'e-name', `${m.name} · ${groupOf(m.gid).name}`));
  // rule text (kept in sync when the incident escalates)
  const ruleEl = el('div', 'e-rule', e.rule);
  main.append(ruleEl);
  e.ruleEl = ruleEl;
  e.peakEl = el('div', 'e-peak', '');
  main.append(e.peakEl);
  n.append(el('span', 'e-dot'), main, side);
  e.node = n;
  updateEntryPeak(e);
  if (e.t1 != null) n.classList.add('done');
  n.addEventListener('click', () => { selectMetric(m); locate(m); });
  return n;
}function buildFeedInitial() { for (const e of feed) feedList.append(entryNode(e)); }

/* ---------------- rendering ---------------- */
function drawSpark(m) {
  const { ctx, w, h } = ctx2d(m.cv);
  const data = m.hist.slice(-SPARK_N);
  if (data.length < 2 || w < 10) return;
  let lo = Infinity, hi = -Infinity;
  for (const p of data) { if (p.v < lo) lo = p.v; if (p.v > hi) hi = p.v; }
  const pad = (hi - lo) || Math.abs(hi) || 1; lo -= pad * .12; hi += pad * .12;
  m.lo = m.lo == null ? lo : m.lo + (lo - m.lo) * .3;   // eased bounds → no rescale jitter
  m.hi = m.hi == null ? hi : m.hi + (hi - m.hi) * .3;
  lo = m.lo; hi = m.hi;
  const X = i => i / (data.length - 1) * w, Y = v => h - (v - lo) / (hi - lo) * h;
  ctx.clearRect(0, 0, w, h);
  // threshold guides (only when inside the visible band)
  for (const th of [m.warn, m.crit]) {
    if (th != null && th > lo && th < hi) {
      ctx.strokeStyle = th === m.crit ? '#ff5f5f' : '#f2b63b';
      ctx.globalAlpha = .38; ctx.setLineDash([3, 3]); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, Y(th)); ctx.lineTo(w, Y(th)); ctx.stroke();
      ctx.setLineDash([]); ctx.globalAlpha = 1;
    }
  }
  const col = STATE_COLOR[m.state];
  ctx.beginPath();
  data.forEach((p, i) => i ? ctx.lineTo(X(i), Y(p.v)) : ctx.moveTo(X(0), Y(p.v)));
  ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.lineJoin = 'round'; ctx.stroke();
  ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath();
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, col + '2b'); g.addColorStop(1, col + '05');
  ctx.fillStyle = g; ctx.fill();
}

function updateTile(m, t) {
  const h = m.hist, n = h.length, v = h[n - 1].v;
  m.numEl.textContent = fmtV(m, v);
  // delta vs one minute ago — absolute when the scale is small
  let dTxt = '·', dCls = 'flat';
  if (n > 60) {
    const ref = h[n - 61].v, d = v - ref;
    if (Math.abs(ref) > 1) {
      const p = d / ref * 100;
      if (Math.abs(p) >= .5) { dTxt = (d > 0 ? '▲' : '▼') + Math.abs(p).toFixed(1) + '%'; dCls = d > 0 ? 'up' : 'dn'; }
    } else {
      const dec = Math.max(m.dec, 2);
      if (Math.abs(d) >= Math.pow(10, -dec) / 2) { dTxt = (d > 0 ? '▲' : '▼') + Math.abs(d).toFixed(dec); dCls = d > 0 ? 'up' : 'dn'; }
    }
  }
  if (m.dEl.textContent !== dTxt) { m.dEl.textContent = dTxt; m.dEl.className = 't-delta ' + dCls; }
  const sev = SEVC[m.state];
  if (m.node.dataset.sev !== sev) { m.node.dataset.sev = sev; m.seg.dataset.sev = sev; }
  m.seg.title = `${m.name} · ${sev.toUpperCase()} · ${fmtV(m, v)}${m.unit}`;
  let sTxt;
  if (m.state > 0 && m.entry) sTxt = `${sev} · ${fmtDur(t - m.entry.t0)}`;
  else if (m.lastEvT != null) sTxt = `ok · ${fmtDur(t - m.lastEvT)} calm`;
  else sTxt = 'ok';
  if (m.sEl.textContent !== sTxt) m.sEl.textContent = sTxt;
  m.sEl.dataset.sev = sev;
  drawSpark(m);
}

function updateGroups() {
  for (const g of GROUPS) {
    let ok = 0, warn = 0, crit = 0, tot = 0;
    for (const m of METRICS) if (m.gid === g.id) { tot++; m.state === 0 ? ok++ : m.state === 1 ? warn++ : crit++; }
    const worst = crit ? 'crit' : warn ? 'warn' : 'ok';
    const parts = [`${ok}/${tot} ok`];
    if (warn) parts.push(`${warn} warn`);
    if (crit) parts.push(`${crit} crit`);
    const ge = groupEls[g.id];
    ge.okEl.textContent = parts.join(' · ');
    ge.okEl.dataset.worst = worst;
  }
}

function updateStats(t) {
  let ok = 0, warn = 0, crit = 0;
  for (const m of METRICS) m.state === 0 ? ok++ : m.state === 1 ? warn++ : crit++;
  $('#cTotal').textContent = METRICS.length;
  $('#cOk').textContent = ok; $('#cWarn').textContent = warn; $('#cCrit').textContent = crit;
  const active = feed.filter(e => e.t1 == null).length;
  const rate = feed.filter(e => e.t0 > t - 60).length;
  $('#cRate').textContent = rate;
  feedRateEl.textContent = `${active} active · ${rate}/min`;
  $('#clock').textContent = fmtClock(T0 + t * 1000);
  document.title = crit ? `(${crit}●) PULSEWALL` : 'PULSEWALL · volatile metric monitor';
  $('.stat.sev-crit').classList.toggle('crit-flash', crit > 0);
}

/* ---------------- trace chart ---------------- */
let trRefs = null;
function buildTrHead(m) {
  trHead.innerHTML = '';
  const l1 = el('div', 'tr-line1');
  const nm = el('span', 'tr-name'); nm.append(m.name, el('i', null, groupOf(m.gid).name));
  l1.append(nm);
  const act = el('div', 'tr-actions');
  const locB = el('button', 'tbtn', 'Locate tile');
  locB.addEventListener('click', () => locate(m));
  const xB = el('button', 'tbtn', '✕');
  xB.title = 'Close trace';
  xB.addEventListener('click', () => selectMetric(null));
  act.append(locB, xB); l1.append(act);
  const l2 = el('div', 'tr-line2');
  const tv = el('span', 'tr-val'); trRefs = { num: el('span', null, '–'), unit: el('i', null, m.unit) };
  tv.append(trRefs.num, trRefs.unit);
  trRefs.chip = el('span', 'badge ok', 'OK');
  l2.append(tv, trRefs.chip);
  trRefs.meta = el('div', 'tr-meta', '');
  trHead.append(l1, l2, trRefs.meta);
}
function updateTrHead(t) {
  const m = sel, h = m.hist, v = h[h.length - 1].v;
  trRefs.num.textContent = fmtV(m, v);
  const sev = SEVC[m.state];
  trRefs.chip.className = 'badge ' + (m.state > 0 ? sev : 'recover');
  trRefs.chip.textContent = m.state > 0 && m.entry ? `${sev.toUpperCase()} · ${fmtDur(t - m.entry.t0)}` : m.state > 0 ? sev.toUpperCase() : 'OK';
  trRefs.meta.textContent = `last event ${m.lastEvT != null ? fmtDur(t - m.lastEvT) + ' ago' : '—'} · window ${Math.round(CHART_N / 60)}m · tick 1s`;
  trRefs.unit.textContent = m.unit;
}
function ttX(t) { return (t - chartGeo.t0) / (chartGeo.t1 - chartGeo.t0) * chartGeo.w; }
function ttY(v) { return chartGeo.h - (v - chartGeo.lo) / (chartGeo.hi - chartGeo.lo) * chartGeo.h; }

function drawChart() {
  const m = sel; if (!m) return;
  const { ctx, w, h } = ctx2d(chartCv);
  if (w < 20) return;
  const data = m.hist.slice(-CHART_N);
  if (data.length < 2) return;
  const t1 = curT, t0 = t1 - CHART_N;
  let lo = Infinity, hi = -Infinity;
  for (const p of data) { if (p.v < lo) lo = p.v; if (p.v > hi) hi = p.v; }
  if (m.warn != null && (m.state > 0 || data.some(p => classify(m, p.v) > 0))) {
    if (m.dir === 'upGood') lo = Math.min(lo, m.crit); else hi = Math.max(hi, m.crit);
  }
  const pad = (hi - lo) * .09 || 1; lo -= pad; hi += pad;
  chartGeo = { t0, t1, w, h, lo, hi };
  const Y = ttY;
  ctx.clearRect(0, 0, w, h);
  // horizontal gridlines
  ctx.strokeStyle = '#16202c'; ctx.lineWidth = 1;
  for (let i = 1; i <= 3; i++) { const y = h * i / 4; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
  // threshold bands + lines
  if (m.warn != null) {
    const good = m.dir === 'upGood';
    const yw = Y(m.warn), yc = m.crit != null ? Y(m.crit) : null;
    ctx.fillStyle = 'rgba(242,182,59,.07)';
    ctx.fillRect(0, Math.min(yw, yc ?? yw), w, Math.abs((yc ?? yw) - yw) || 1);
    if (yc != null) {
      ctx.fillStyle = 'rgba(255,95,95,.10)';
      if (good) ctx.fillRect(0, yc, w, Math.max(0, Y(lo) - yc));
      else ctx.fillRect(0, 0, w, Math.max(0, yc));
    }
    for (const th of [m.warn, m.crit]) {
      if (th == null || th < lo || th > hi) continue;
      const c = th === m.crit ? '#ff5f5f' : '#f2b63b';
      ctx.strokeStyle = c; ctx.globalAlpha = .4; ctx.setLineDash([5, 4]);
      ctx.beginPath(); ctx.moveTo(0, Y(th)); ctx.lineTo(w, Y(th)); ctx.stroke();
      ctx.setLineDash([]); ctx.globalAlpha = .75;
      ctx.fillStyle = c; ctx.font = '9px ' + 'Consolas,monospace';
      ctx.fillText(fmtV(m, th) + m.unit, 4, Y(th) - 3);
      ctx.globalAlpha = 1;
    }
  }
  // time gridlines each 30s
  ctx.fillStyle = '#55657a'; ctx.font = '9px Consolas,monospace'; ctx.textAlign = 'right';
  for (let tt = Math.ceil(t0 / 30) * 30; tt <= t1; tt += 30) {
    const x = ttX(tt);
    ctx.strokeStyle = '#141d28';
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    const lbl = t1 - tt === 0 ? 'now' : t1 - tt < 60 ? `-${t1 - tt}s` : `-${Math.round((t1 - tt) / 60)}m`;
    ctx.fillText(lbl, Math.min(x - 3, w - 4), h - 4);
  }
  ctx.textAlign = 'left';
  // value curve + soft area
  ctx.beginPath();
  data.forEach((p, i) => { const x = ttX(p.t), y = Y(p.v); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
  ctx.strokeStyle = '#4da3ff'; ctx.lineWidth = 1.6; ctx.lineJoin = 'round'; ctx.stroke();
  ctx.lineTo(ttX(data[data.length - 1].t), h); ctx.lineTo(ttX(data[0].t), h); ctx.closePath();
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, 'rgba(77,163,255,.16)'); g.addColorStop(1, 'rgba(77,163,255,.02)');
  ctx.fillStyle = g; ctx.fill();
  // event markers — the traceable change history, on the curve
  for (const ev of m.ev) {
    if (ev.t < t0 || ev.t > t1) continue;
    const x = ttX(ev.t), y = Y(ev.v);
    if (ev.type === 'crit' || ev.type === 'warn') {
      ctx.fillStyle = ev.type === 'crit' ? '#ff5f5f' : '#f2b63b';
      ctx.beginPath(); ctx.moveTo(x, y - 4); ctx.lineTo(x - 4, y + 4); ctx.lineTo(x + 4, y + 4); ctx.closePath(); ctx.fill();
    } else if (ev.type === 'recover') {
      ctx.fillStyle = '#3bd98c';
      ctx.beginPath(); ctx.arc(x, y, 3.2, 0, 6.2832); ctx.fill();
    } else if (ev.type === 'spike') {
      ctx.fillStyle = '#b48cff';
      ctx.beginPath(); ctx.moveTo(x, y - 4.5); ctx.lineTo(x + 4, y); ctx.lineTo(x, y + 4.5); ctx.lineTo(x - 4, y); ctx.closePath(); ctx.fill();
    }
  }
  // live head dot
  const last = data[data.length - 1];
  ctx.fillStyle = STATE_COLOR[m.state];
  ctx.beginPath(); ctx.arc(ttX(last.t), Y(last.v), 3, 0, 6.2832); ctx.fill();
}

function renderEvList(m) {
  evList.innerHTML = '';
  const list = [...m.ev].reverse();
  if (!list.length) { evList.append(el('div', 'empty', 'No changes recorded yet.')); return; }
  for (const e of list) {
    const row = el('div', 'ev-row');
    row.append(el('span', 'ev-t', fmtClock(T0 + e.t * 1000)), el('span', 'badge ' + e.type, EV_LABEL[e.type]), el('span', 'ev-note', e.note));
    evList.append(row);
  }
}

/* ---------------- selection / locate ---------------- */
function selectMetric(m) {
  if (sel) { sel.node.classList.remove('sel'); sel.seg.classList.remove('sel'); }
  sel = m;
  if (!m) {
    traceBody.hidden = true; traceEmpty.hidden = false; $('#trSub').textContent = '';
    return;
  }
  traceEmpty.hidden = true; traceBody.hidden = false;
  $('#trSub').textContent = `${groupOf(m.gid).name} · ${m.id}`;
  m.node.classList.add('sel'); m.seg.classList.add('sel');
  buildTrHead(m);
  renderEvList(m);
  updateTrHead(curT);
  drawChart();
}
function locate(m) {
  m.node.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  m.node.classList.remove('locate'); void m.node.offsetWidth;
  m.node.classList.add('locate');
}

/* ---------------- tick ---------------- */
function renderTick(t) {
  curT = t;
  for (const m of METRICS) updateTile(m, t);
  updateGroups();
  updateStats(t);
  const activeEntries = feed.filter(e => e.t1 == null);
  for (const e of activeEntries) {
    if (e.durEl) e.durEl.textContent = fmtDur(t - e.t0);
    updateEntryPeak(e);
  }
  if (sel) {
    updateTrHead(t);
    drawChart();
    if (sel.evDirty) { renderEvList(sel); sel.evDirty = false; }
  }
}

/* ---------------- controls ---------------- */
$('#sevChips').addEventListener('click', e => {
  const b = e.target.closest('.fbtn'); if (!b) return;
  filterMode = b.dataset.f;
  for (const x of $('#sevChips').children) { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', x === b); }
  gridEl.classList.remove('f-warn', 'f-crit');
  if (filterMode === 'warn') gridEl.classList.add('f-warn');
  if (filterMode === 'crit') gridEl.classList.add('f-crit');
});
qEl.addEventListener('input', () => {
  searchTerm = qEl.value.trim().toLowerCase();
  for (const m of METRICS) {
    const hit = !searchTerm || (m.name + ' ' + groupTag(m.gid) + ' ' + groupOf(m.gid).name).toLowerCase().includes(searchTerm);
    m.node.classList.toggle('hide', !hit);
    m.seg.classList.toggle('hide', !hit);
  }
});
let running = true, timer = null;
const pauseBtn = $('#pauseBtn');
function setRunning(on) {
  running = on;
  pauseBtn.innerHTML = on ? '&#10074;&#10074; Pause' : '&#9654; Resume';
  pauseBtn.setAttribute('aria-pressed', String(!on));
  $('#liveDot').classList.toggle('paused', !on);
  clearInterval(timer);
  if (on) timer = setInterval(tick, TICK_MS);
}
pauseBtn.addEventListener('click', () => setRunning(!running));
document.addEventListener('keydown', e => {
  if (e.key === '/' && document.activeElement !== qEl) { e.preventDefault(); qEl.focus(); qEl.select(); }
  else if (e.key === 'Escape') { if (document.activeElement === qEl && qEl.value) { qEl.value = ''; qEl.dispatchEvent(new Event('input')); } else selectMetric(null); }
});
window.addEventListener('resize', () => { drawChart(); for (const m of METRICS) drawSpark(m); });

/* ---------------- boot: backfill → build → stream ---------------- */
function tick() {
  if (!running) return;
  const t = curT + 1;
  for (const m of METRICS) step(m, t);
  renderTick(t);
}

for (let t = -HIST_MAX; t <= 0; t++) for (const m of METRICS) step(m, t); // 4 min of history, incidents included
buildUI();
uiReady = true;
buildFeedInitial();
// deep-link: #m=<metricId>&f=<all|warn|crit> — default is the active crit incident
const hash = new URLSearchParams(location.hash.slice(1));
if (hash.get('f')) { const b = $(`.fbtn[data-f="${hash.get('f')}"]`); if (b) b.click(); }
selectMetric(byId[hash.get('m')] || byId['api-p99']); // richest context ready at first paint
renderTick(0);
timer = setInterval(tick, TICK_MS);
