/* CDP 驱动：真实 Chrome（headless）打开 index.html，执行真实输入事件并截图取证。
   用法：node tools/cdp-drive.mjs   （产物写入 evidence/） */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9337;
const PAGE_URL = 'file:///E:/codex-prj/ab-worktrees/pi-matrix/cell-j09-s03-b/index.html';
const EV = 'E:\\codex-prj\\ab-worktrees\\pi-matrix\\cell-j09-s03-b\\evidence';

const profile = path.join(process.env.TEMP || '.', 'cdp-profile-sitechoice');
const chrome = spawn(CHROME, [
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  '--headless=new', '--no-first-run', '--no-default-browser-check', '--disable-gpu',
  '--window-size=1440,900', 'about:blank',
], { stdio: 'ignore' });
process.on('exit', () => { try { chrome.kill(); } catch {} });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
for (let i = 0; i < 60; i++) {
  try { const r = await fetch(`http://127.0.0.1:${PORT}/json/version`); if (r.ok) break; } catch {}
  await sleep(250);
}
const targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
const page = targets.find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

let msgId = 0; const pending = new Map(); const exceptions = []; const events = [];
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); }
  else if (m.method) {
    events.push(m.method);
    if (m.method === 'Runtime.exceptionThrown') exceptions.push(JSON.stringify(m.params?.exceptionDetails?.exception?.description || m.params));
  }
};
const send = (method, params = {}) => new Promise((res, rej) => { const id = ++msgId; pending.set(id, { res, rej }); ws.send(JSON.stringify({ id, method, params })); });
async function waitEvent(method, timeout = 8000) { const t0 = Date.now(); while (Date.now() - t0 < timeout) { if (events.includes(method)) return; await sleep(50); } throw new Error('timeout: ' + method); }

await send('Page.enable'); await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: PAGE_URL });
await waitEvent('Page.loadEventFired'); await sleep(500);

const results = {}; const notes = {};
async function evaljs(expr) {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
  if (r.exceptionDetails) throw new Error('eval: ' + (r.exceptionDetails.exception?.description || 'fail'));
  return r.result.value;
}
async function shot(name) {
  const { data } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
  fs.writeFileSync(path.join(EV, name), Buffer.from(data, 'base64'));
  console.log('shot ->', name);
}
async function boxCenter(sel) {
  const b = await evaljs(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});if(!e)return null;const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2,w:r.width,h:r.height};})()`);
  if (!b) throw new Error('missing element: ' + sel); return b;
}
async function clickAt(sel, fx = 0.5) {
  const b = await boxCenter(sel); const x = Math.round(b.x + (fx - 0.5) * b.w), y = Math.round(b.y);
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
  await sleep(150);
}
async function moveTo(sel) { const b = await boxCenter(sel); await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: Math.round(b.x), y: Math.round(b.y) }); await sleep(250); }
async function key(k, code, vk) {
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: k, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk });
  await sleep(120);
}
const fitTexts = () => evaljs(`Array.from(document.querySelectorAll('[data-cell^="fit:"]')).map(e=>e.textContent.trim())`);

/* 1) 加载即 ready */
await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true }).then(async ({ data }) => {
  fs.writeFileSync(path.join(EV, '01-initial-ready.png'), Buffer.from(data, 'base64')); console.log('shot -> 01-initial-ready.png');
});
results.initial_ready = await evaljs(`(() => ({
  readyState: document.readyState,
  colHeaders: document.querySelectorAll('th.col').length,
  critRows: document.querySelectorAll('tr[data-crit]').length,
  pins: document.querySelectorAll('#pins .pin').length,
  scoreCellsFilled: Array.from(document.querySelectorAll('[data-cell^="fit:"]')).every(e=>/\\d/.test(e.textContent)),
  verdictLeader: document.querySelector('#region-verdict').textContent.includes('当前领先'),
  verdictClean: !/undefined|NaN/.test(document.querySelector('#region-verdict').textContent),
  bestBadges: document.querySelectorAll('.badge-best').length,
  noLoadingPlaceholder: !document.body.textContent.includes('加载中'),
}))()`);
await sleep(100);

/* 2) 键盘 → 选择 A（键盘可操作性证据） */
await key('ArrowRight', 'ArrowRight', 39);
results.keyboard_select = await evaljs(`(() => ({
  pinASelected: document.querySelector('.pin[data-site="a"]').classList.contains('is-sel'),
  thASelected: document.querySelector('th.col[data-col="a"]').classList.contains('is-sel'),
  mapInfoUpdated: document.querySelector('#map-info').textContent.includes('已选'),
}))()`);
await key('ArrowLeft', 'ArrowLeft', 37); // 回到无选中前先取消（再次 ArrowLeft 切到 C，用点击覆盖）
await evaljs(`document.querySelector('.pin[data-site="a"]').getAttribute('class')`); // noop keep

/* 3) 点击列头 B → 双向联动 */
await clickAt('button.col-btn[data-site="b"]');
results.selection_sync = await evaljs(`(() => ({
  pinBSelected: document.querySelector('.pin[data-site="b"]').classList.contains('is-sel'),
  thBSelected: document.querySelector('th.col[data-col="b"]').classList.contains('is-sel'),
  walkLineVisible: document.getElementById('walk-line').getAttribute('visibility') === 'visible',
  walkLabel: document.getElementById('walk-label').textContent,
}))()`);
await shot('02-select-b-sync.png');

/* 4) 悬停「通勤可达」行 → 地图地铁线/锚点联动 */
await moveTo('tr[data-crit="commute"]');
results.row_hover_link = await evaljs(`(() => ({
  svgHasHot: document.getElementById('map').classList.contains('has-hot'),
  metroHot: document.querySelector('.m-metro').classList.contains('hot'),
  anchorHot: document.querySelector('.m-anchor').classList.contains('hot'),
}))()`);
await shot('03-row-hover-map-link.png');

/* 5) 真实点击调整租金权重滑杆 → 实时重算 */
const fitsBefore = await fitTexts();
await clickAt('#w-rent', 0.97);
await sleep(200);
results.weight_adjust = await evaljs(`(() => ({
  rentWeight: document.getElementById('w-rent').value,
  chipVisible: !document.getElementById('w-chip').hidden,
  rentOutput: document.getElementById('wo-rent').value,
}))()`);
notes.fitsBefore = fitsBefore; notes.fitsAfterRent5 = await fitTexts();
await shot('04-weight-customized.png');

/* 6) 键盘 L → 锁定选择（焦点仍在滑杆上，验证快捷键不被吞掉） */
await key('l', 'KeyL', 76);
results.locked = await evaljs(`(() => ({
  lockChip: !!document.querySelector('.chip-lock'),
  verdictLocked: document.querySelector('#region-verdict').textContent.includes('已锁定'),
  unlockBtn: !!document.querySelector('[data-act="unlock"]'),
  pinLocked: document.querySelector('.pin.is-locked') !== null,
}))()`);
await shot('05-locked-verdict.png');

/* 7) 全部权重归零 → 空态提示；R 重置恢复（先解锁回到比较态） */
await key('l', 'KeyL', 76);
await sleep(150);
results.unlock_works = await evaljs(`(() => ({
  lockChipGone: !document.querySelector('.chip-lock'),
  leaderBack: document.querySelector('#region-verdict').textContent.includes('当前领先'),
}))()`);
await evaljs(`['rent','traffic','commute','rival','space','crowd'].forEach(id=>document.getElementById('w-'+id).focus()); 0`);
for (const id of ['rent', 'traffic', 'commute', 'rival', 'space', 'crowd']) {
  await evaljs(`document.getElementById('w-${id}').focus(); 0`);
  for (let i = 0; i < 6; i++) await key('ArrowLeft', 'ArrowLeft', 37);
}
results.zero_weights = await evaljs(`(() => ({
  emptyHints: document.querySelectorAll('.fit-empty').length,
  verdictEmpty: document.querySelector('#region-verdict').textContent.includes('暂无有效评分'),
  lockDisabled: document.querySelector('[data-act="lock"]').disabled,
}))()`);
await shot('06-zero-weights-empty.png');
await key('r', 'KeyR', 82);
await sleep(150);
results.reset_works = await evaljs(`(() => ({
  chipHiddenAgain: document.getElementById('w-chip').hidden,
  emptyHintsGone: document.querySelectorAll('.fit-empty').length === 0,
  rentBackToDefault: document.getElementById('w-rent').value === '4',
}))()`);

results.console_clean = { exceptionCount: exceptions.length, exceptions: exceptions.slice(0, 5) };
notes.evictions = null;
fs.writeFileSync(path.join(EV, 'checks.json'), JSON.stringify({ collectedAt: new Date().toISOString(), pageUrl: PAGE_URL, results, notes }, null, 2));
console.log(JSON.stringify(results, null, 2));
ws.close(); chrome.kill();
process.exit(0);
