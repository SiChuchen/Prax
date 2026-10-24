/* One-off: dump the tab sequence + rects to confirm column-major focus order. */
import { spawn } from 'node:child_process';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9341;
const APP = 'file:///E:/codex-prj/ab-worktrees/pi-matrix-m5/s2-e1/index.html';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const proc = spawn(CHROME, [`--remote-debugging-port=${PORT}`, `--user-data-dir=E:/codex-prj/ab-worktrees/pi-matrix-m5/s2-e1/shots/_profile2`, '--headless=new', '--disable-gpu', '--no-first-run', '--window-size=1280,860', 'about:blank'], { stdio: 'ignore' });

let msgId = 0; const pending = new Map(); let ws;
const send = (method, params = {}) => new Promise((res, rej) => { const id = ++msgId; pending.set(id, { res, rej }); ws.send(JSON.stringify({ id, method, params })); });

async function main() {
  let wsUrl;
  for (let i = 0; i < 40; i++) {
    try { const list = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json(); const p = list.find(t => t.type === 'page'); if (p) { wsUrl = p.webSocketDebuggerUrl; break; } } catch {}
    await sleep(250);
  }
  ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); } };

  await send('Page.navigate', { url: APP });
  await sleep(900);
  const r = await send('Runtime.evaluate', {
    returnByValue: true,
    expression: `(() => {
      const tabbables = [...document.querySelectorAll('button:not([disabled]):not([tabindex="-1"]), [tabindex="0"], a[href]')];
      return tabbables.map(e => { const r = e.getBoundingClientRect(); return { tag: e.tagName + (e.id ? '#' + e.id : ''), cls: e.className && String(e.className).slice(0, 24), x: Math.round(r.x), y: Math.round(r.y) }; });
    })()`,
  });
  const seq = r.result.value;
  console.log('tab stops in DOM order:');
  for (const s of seq) console.log(`  x=${String(s.x).padStart(5)} y=${String(s.y).padStart(5)}  ${s.tag} .${s.cls}`);
  // column-major check: x must be non-decreasing across the sequence
  let inversions = 0;
  for (let i = 1; i < seq.length; i++) if (seq[i].x < seq[i - 1].x - 4) { inversions++; console.log(`  INVERSION: ${seq[i - 1].tag}(x${seq[i - 1].x}) -> ${seq[i].tag}(x${seq[i].x})`); }
  console.log(inversions === 0 ? 'column-major order OK (no leftward moves)' : `${inversions} inversions`);
  ws.close();
}
main().finally(async () => { proc.kill(); await sleep(600); process.exit(0); });
