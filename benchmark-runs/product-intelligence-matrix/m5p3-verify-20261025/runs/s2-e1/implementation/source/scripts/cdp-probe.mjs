import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const URL = 'file:///E:/codex-prj/ab-worktrees/pi-matrix-m5p3/s2-e1/index.html';
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'cdp-probe-'));
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', `--user-data-dir=${profile}`, '--remote-debugging-port=0', '--window-size=1680,960', 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
const wsUrl = await new Promise((res, rej) => {
  let b = ''; const t = setTimeout(() => rej(new Error('timeout')), 15000);
  chrome.stderr.on('data', d => { b += d; const m = b.match(/DevTools listening on (ws:\/\/\S+)/); if (m) { clearTimeout(t); res(m[1]); } });
});
const ws = new WebSocket(wsUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let id = 0; const pend = new Map();
ws.onmessage = ev => { const m = JSON.parse(ev.data); if (pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); p(m); } };
const send = (method, params = {}, sessionId) => new Promise((res, rej) => { const mid = ++id; pend.set(mid, m => m.error ? rej(new Error(method + ': ' + m.error.message)) : res(m)); ws.send(JSON.stringify({ id: mid, method, params, sessionId })); });
const sleep = ms => new Promise(r => setTimeout(r, ms));

const { result: t } = await send('Target.createTarget', { url: 'about:blank' });
const { result: att } = await send('Target.attachToTarget', { targetId: t.targetId, flatten: true });
const sessionId = att.sessionId;
await send('Page.enable', {}, sessionId);
await send('Runtime.enable', {}, sessionId);
await send('Emulation.setDeviceMetricsOverride', { width: 1680, height: 960, deviceScaleFactor: 1, mobile: false }, sessionId);
await send('Page.navigate', { url: URL }, sessionId);
await sleep(900);
await send('Runtime.evaluate', { expression: `document.querySelector('#ledger-body tr[data-id="r005"]').click()`, returnByValue: true }, sessionId);
await sleep(400);

const q = async expr => {
  const resp = await send('Runtime.evaluate', { expression: expr, returnByValue: true }, sessionId);
  if (resp.result?.exceptionDetails) console.error('EVAL-ERR', JSON.stringify(resp.result.exceptionDetails, null, 2));
  return resp.result?.result?.value;
};
const out = await q(`(() => {
  const r = s => { const el = document.querySelector(s); if (!el) return null; const b = el.getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height), sw: el.scrollWidth, cw: el.clientWidth }; };
  const cs = s => { const el = document.querySelector(s); const c = getComputedStyle(el); return { display: c.display, overflow: c.overflow, minW: c.minWidth }; };
  return {
    main: r('#main'), center: r('#center'), ledger: r('#ledger-region'), insp: r('#inspector'), chart: r('#chart-region'), rail: r('#dim-rail'),
    ledgerScroll: r('#ledger-scroll'), table: r('#ledger'), inspBody: r('#insp-body'),
    inspBodyScroll: (() => { const el = document.querySelector('#insp-body'); return { sl: el.scrollLeft, sw: el.scrollWidth, cw: el.clientWidth }; })(),
    inspDl: (() => { const el = document.querySelector('.insp-dl'); if (!el) return null; const b = el.getBoundingClientRect(); return { x: Math.round(b.x), w: Math.round(b.width), sw: el.scrollWidth }; })(),
    inspName: (() => { const el = document.querySelector('.insp-name'); if (!el) return null; const b = el.getBoundingClientRect(); return { x: Math.round(b.x), w: Math.round(b.width) }; })(),
    mainCols: cs('#main'), centerCols: cs('#center'), inspMin: cs('#inspector'), centerMin: cs('#center'), ledgerMin: cs('#ledger-region'),
    docW: document.documentElement.scrollWidth, winW: window.innerWidth,
    gridColWidths: getComputedStyle(document.querySelector('#main')).gridTemplateColumns
  };
})()`);
console.log(JSON.stringify(out, null, 2));
ws.close(); chrome.kill(); process.exit(0);
