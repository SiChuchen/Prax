import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const URL = 'file:///E:/codex-prj/ab-worktrees/pi-matrix-m5p3/s2-e1/index.html';
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'cdp-key-'));
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', `--user-data-dir=${profile}`, '--remote-debugging-port=0', '--window-size=1680,960', 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
const wsUrl = await new Promise((res, rej) => { let b = ''; const t = setTimeout(() => rej(new Error('timeout')), 15000); chrome.stderr.on('data', d => { b += d; const m = b.match(/DevTools listening on (ws:\/\/\S+)/); if (m) { clearTimeout(t); res(m[1]); } }); });
const ws = new WebSocket(wsUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let id = 0; const pend = new Map(); const events = [];
ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } else events.push(m); };
const send = (method, params = {}, sessionId) => new Promise(res => { pend.set(++id, res); ws.send(JSON.stringify({ id, method, params, sessionId })); });
const sleep = ms => new Promise(r => setTimeout(r, ms));

const { result: t } = await send('Target.createTarget', { url: 'about:blank' });
const { result: att } = await send('Target.attachToTarget', { targetId: t.targetId, flatten: true });
const sessionId = att.sessionId;
for (const d of ['Page', 'Runtime']) await send(d + '.enable', {}, sessionId);
await send('Emulation.setDeviceMetricsOverride', { width: 1680, height: 960, deviceScaleFactor: 1, mobile: false }, sessionId);
await send('Page.navigate', { url: URL }, sessionId);
await sleep(900);
const q = async expr => (await send('Runtime.evaluate', { expression: expr, returnByValue: true }, sessionId)).result?.result?.value;

async function key(type, k) { await send('Input.dispatchKeyEvent', { type, key: k.key, code: k.code, windowsVirtualKeyCode: k.vk, nativeVirtualKeyCode: k.vk }, sessionId); }

console.log('before:', await q(`document.querySelector('#chart-title').innerText`));
// Tab 直到 proj:language
for (let i = 0; i < 14; i++) {
  await key('rawKeyDown', { key: 'Tab', code: 'Tab', vk: 9 });
  await key('keyUp', { key: 'Tab', code: 'Tab', vk: 9 });
  const ae = await q(`(() => { const el = document.activeElement; return el ? el.tagName + ':' + el.getAttribute('data-act') + ':' + (el.getAttribute('data-dim')||'') : 'none'; })()`);
  console.log('tab', i + 1, '->', ae);
  if (ae === 'BUTTON:proj:language') break;
}
console.log('activeElement before Enter:', await q(`document.activeElement.outerHTML.slice(0, 120)`));
await key('keyDown', { key: 'Enter', code: 'Enter', vk: 13 });
await sleep(120);
console.log('after keyDown(120ms):', await q(`document.querySelector('#chart-title').innerText`));
await key('keyUp', { key: 'Enter', code: 'Enter', vk: 13 });
await sleep(400);
console.log('after keyUp+400ms:', await q(`document.querySelector('#chart-title').innerText`));
console.log('activeElement after:', await q(`document.activeElement.outerHTML.slice(0, 120)`));
ws.close(); chrome.kill(); process.exit(0);
