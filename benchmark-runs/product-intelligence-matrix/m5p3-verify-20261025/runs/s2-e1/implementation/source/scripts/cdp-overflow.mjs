import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const URL = 'file:///E:/codex-prj/ab-worktrees/pi-matrix-m5p3/s2-e1/index.html';
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'cdp-ov-'));
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
await send('Runtime.evaluate', { expression: `document.querySelector('#legend .legend-item[data-val="成熟"]').click()`, returnByValue: true }, sessionId);
await sleep(500);

const q = async expr => {
  const resp = await send('Runtime.evaluate', { expression: expr, returnByValue: true }, sessionId);
  if (resp.result?.exceptionDetails) console.error('EVAL-ERR', JSON.stringify(resp.result.exceptionDetails).slice(0, 600));
  return resp.result?.result?.value;
};
const out = await q(`(() => {
  const bad = [];
  document.querySelectorAll('*').forEach(el => {
    const sw = el.scrollWidth, cw = el.clientWidth, sh = el.scrollHeight, ch = el.clientHeight;
    if (sw > cw + 1 || sh > ch + 1) {
      bad.push({
        tag: el.tagName, id: el.id || null, cls: String(el.getAttribute('class') || '').slice(0, 40),
        sw, cw, sh, ch,
        text: (el.textContent || '').trim().slice(0, 24)
      });
    }
  });
  return bad.slice(0, 40);
})()`);
console.log(JSON.stringify(out, null, 2));
ws.close(); chrome.kill(); process.exit(0);
