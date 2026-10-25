import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const URL = 'file:///E:/codex-prj/ab-worktrees/pi-matrix-m5p3/s2-e1/index.html';
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'cdp-audit-'));
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', `--user-data-dir=${profile}`, '--remote-debugging-port=0', '--window-size=1280,860', 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
const wsUrl = await new Promise((res, rej) => { let b = ''; const t = setTimeout(() => rej(new Error('timeout')), 15000); chrome.stderr.on('data', d => { b += d; const m = b.match(/DevTools listening on (ws:\/\/\S+)/); if (m) { clearTimeout(t); res(m[1]); } }); });
const ws = new WebSocket(wsUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let id = 0; const pend = new Map();
ws.onmessage = ev => { const m = JSON.parse(ev.data); if (pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
const send = (method, params = {}, sessionId) => new Promise(res => { pend.set(++id, res); ws.send(JSON.stringify({ id, method, params, sessionId })); });
const sleep = ms => new Promise(r => setTimeout(r, ms));

const { result: t } = await send('Target.createTarget', { url: 'about:blank' });
const { result: att } = await send('Target.attachToTarget', { targetId: t.targetId, flatten: true });
const sessionId = att.sessionId;
await send('Page.enable', {}, sessionId);
await send('Runtime.enable', {}, sessionId);
await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 860, deviceScaleFactor: 1, mobile: false }, sessionId);
await send('Page.navigate', { url: URL }, sessionId);
await sleep(900);
// 制造 2 步轨迹以测量 trail-step
await send('Runtime.evaluate', { expression: `document.querySelector('#ledger-head th[data-dim="language"]').click()`, returnByValue: true }, sessionId);
await sleep(300);
const q = async expr => {
  const resp = await send('Runtime.evaluate', { expression: expr, returnByValue: true }, sessionId);
  if (resp.result?.exceptionDetails) console.error('EVAL-ERR', JSON.stringify(resp.result.exceptionDetails).slice(0, 400));
  return resp.result?.result?.value;
};
console.log(JSON.stringify(await q(`(() => {
  const r = (s) => { const el = document.querySelector(s); if (!el) return null; const b = el.getBoundingClientRect(); return Math.round(b.height * 10) / 10; };
  const ts = [...document.querySelectorAll('.trail-step')].map(b => Math.round(b.getBoundingClientRect().height * 10) / 10);
  const undersized = [];
  document.querySelectorAll('button, input, [role="button"]').forEach(el => {
    const b = el.getBoundingClientRect();
    if (b.width > 0 && (b.height < 24 || b.width < 24)) {
      if (!(el.type === 'checkbox' && false)) undersized.push({ tag: el.tagName, cls: el.className && el.className.toString().slice(0, 20), w: Math.round(b.width), h: Math.round(b.height), txt: (el.textContent || '').trim().slice(0, 10) });
    }
  });
  return {
    trailSteps: ts, miniBtn: r('.mini-btn'), tbtn: r('.tbtn'), legend: r('.legend-item'), actBtn: r('.act-btn'),
    checkbox: r('#match-only'), undersizedCount: undersized.length, undersized: undersized.slice(0, 10),
    dimMetaSample: (() => { const el = document.querySelector('.dim-meta'); return el ? el.textContent : null; })()
  };
})()`), null, 1));
ws.close(); chrome.kill(); process.exit(0);
