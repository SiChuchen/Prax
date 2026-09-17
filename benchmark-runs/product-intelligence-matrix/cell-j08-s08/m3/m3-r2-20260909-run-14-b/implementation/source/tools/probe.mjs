import { spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9224;
const PAGE = 'file:///' + ROOT.replace(/\\/g, '/') + '/index.html';
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--remote-debugging-port=' + PORT,
  '--user-data-dir=' + join(process.env.TEMP, 'probe-' + Date.now()), 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let ws, id = 0; const pend = new Map(); const evs = [];
const send = (m, p, s) => new Promise((res, rej) => { const i = ++id; pend.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method: m, params: p || {}, sessionId: s })); });
try {
  let vws;
  for (let i = 0; i < 60; i++) { try { vws = (await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json()).webSocketDebuggerUrl; break; } catch { await sleep(250); } }
  ws = new WebSocket(vws);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { const p = pend.get(d.id); pend.delete(d.id); d.error ? p.rej(new Error(d.error.message)) : p.res(d.result); } else if (d.method) evs.push(d); };
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  await send('Page.enable', {}, sessionId);
  await send('Runtime.enable', {}, sessionId);
  await send('Log.enable', {}, sessionId);
  await send('Page.navigate', { url: PAGE }, sessionId);
  await sleep(2500);
  const info = await send('Runtime.evaluate', { expression: `JSON.stringify({init: typeof window.INITIAL_DOC, blocks: window.INITIAL_DOC && window.INITIAL_DOC.blocks.length, scripts: [...document.scripts].map(s=>s.src||'inline')})`, returnByValue: true }, sessionId);
  console.log('PAGE:', info.result.value);
  console.log('EXCEPTIONS:', JSON.stringify(evs.filter(e => e.method === 'Runtime.exceptionThrown').map(e => e.params.exceptionDetails), null, 1).slice(0, 2000));
  console.log('LOG:', JSON.stringify(evs.filter(e => e.method.startsWith('Log.entryAdded')).map(e => e.params.entry.text), null, 1).slice(0, 2000));
  await send('Target.closeTarget', { targetId });
} catch (e) { console.error('ERR', e.message); } finally { chrome.kill(); }
