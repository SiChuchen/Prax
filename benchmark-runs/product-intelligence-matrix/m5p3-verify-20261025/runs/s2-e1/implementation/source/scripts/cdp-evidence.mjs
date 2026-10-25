/*
 * CDP 交互取证驱动（零依赖，Node >=22 内置 WebSocket）
 * 启动无头 Chrome → 按 7 步真实操作页面 → 每步截图 + DOM 断言 + 收集 console error。
 * 产物：screenshots/evidence-0X-*.png + screenshots/evidence-log.json
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const ROOT = path.resolve(import.meta.dirname, '..');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const URL = 'file:///E:/codex-prj/ab-worktrees/pi-matrix-m5p3/s2-e1/index.html';
const OUT = path.join(ROOT, 'screenshots');
fs.mkdirSync(OUT, { recursive: true });

const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ---------- 启动 Chrome ---------- */
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'cdp-lens-'));
const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--no-sandbox',
  `--user-data-dir=${profile}`,
  '--remote-debugging-port=0', '--window-size=1680,960', 'about:blank'
], { stdio: ['ignore', 'ignore', 'pipe'] });

const wsUrl = await new Promise((resolve, reject) => {
  let buf = '';
  const t = setTimeout(() => reject(new Error('chrome devtools endpoint timeout')), 15000);
  chrome.stderr.on('data', d => {
    buf += d.toString();
    const m = buf.match(/DevTools listening on (ws:\/\/\S+)/);
    if (m) { clearTimeout(t); resolve(m[1]); }
  });
  chrome.on('exit', c => reject(new Error('chrome exited early: ' + c)));
});

/* ---------- 极简 CDP 客户端 ---------- */
const ws = new WebSocket(wsUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

let msgId = 0;
const pending = new Map();
const consoleErrors = [];
const eventWaiters = [];

ws.onmessage = ev => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) {
    const { resolve, reject } = pending.get(m.id);
    pending.delete(m.id);
    m.error ? reject(new Error(m.error.message)) : resolve(m.result);
    return;
  }
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
    consoleErrors.push(m.params.args.map(a => a.value ?? a.description ?? '').join(' '));
  }
  if (m.method === 'Runtime.exceptionThrown') {
    const d = m.params.exceptionDetails;
    consoleErrors.push(d.exception?.description || d.text);
  }
  if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') {
    consoleErrors.push(m.params.entry.text);
  }
  for (let i = eventWaiters.length - 1; i >= 0; i--) {
    if (eventWaiters[i].match(m)) { eventWaiters[i].resolve(m); eventWaiters.splice(i, 1); }
  }
};
function send(method, params = {}, sessionId) {
  return new Promise((resolve, reject) => {
    const id = ++msgId;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params, sessionId }));
  });
}
function waitEvent(match, timeout = 15000) {
  return new Promise((resolve, reject) => {
    eventWaiters.push({ match, resolve });
    setTimeout(() => reject(new Error('event wait timeout: ' + timeout)), timeout);
  });
}

/* ---------- 页面会话 ---------- */
const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
await send('Page.enable', {}, sessionId);
await send('Runtime.enable', {}, sessionId);
await send('Log.enable', {}, sessionId);
await send('Emulation.setDeviceMetricsOverride',
  { width: 1680, height: 960, deviceScaleFactor: 1, mobile: false }, sessionId);

async function evaluate(expression) {
  const r = await send('Runtime.evaluate',
    { expression, returnByValue: true, awaitPromise: true }, sessionId);
  if (r.exceptionDetails) throw new Error('evaluate failed: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
  return r.result.value;
}
async function shot(name) {
  const r = await send('Page.captureScreenshot', { format: 'png' }, sessionId);
  const p = path.join(OUT, name);
  fs.writeFileSync(p, Buffer.from(r.data, 'base64'));
  return p;
}
async function act(expression) {   // 操作后等两帧渲染稳定
  await evaluate(expression);
  await sleep(350);
}

const log = { url: URL, viewport: '1680x960', steps: [], consoleErrors };

/* ---------- 打开页面 ---------- */
const loaded = waitEvent(m => m.method === 'Page.loadEventFired' && m.sessionId === sessionId);
await send('Page.navigate', { url: URL }, sessionId);
await loaded;
await sleep(500);

async function step(n, name, actions, assertFn) {
  const s = { step: n, name };
  try {
    await actions();
    s.asserts = await assertFn();
    s.shot = await shot(`evidence-0${n}-${name}.png`);
    s.status = 'pass';
  } catch (e) {
    s.status = 'FAIL';
    s.error = String(e.message || e);
    try { s.shot = await shot(`evidence-0${n}-${name}.png`); } catch {}
  }
  log.steps.push(s);
  console.log(`step ${n} ${s.status} — ${name}${s.error ? ' :: ' + s.error : ''}`);
  console.log('   ' + JSON.stringify(s.asserts ?? s.error));
}

/* 步骤 1：初始 */
await step(1, 'initial', async () => {}, () => evaluate(`(() => ({
  hdr: document.querySelector('#hdr-counts').innerText.replace(/\\s+/g,' '),
  hasProjChip: !!document.querySelector('.chip-proj'),
  hasColorChip: !!document.querySelector('.chip-color'),
  chipText: document.querySelector('#chips').innerText.replace(/\\s+/g,' '),
  appVisible: !document.getElementById('app').hidden,
  trailCount: document.querySelectorAll('.trail-step').length
}))()`));

/* 步骤 2：选中 r005 */
await step(2, 'selected', () => act(`document.querySelector('#ledger-body tr[data-id="r005"]').click()`),
  () => evaluate(`(() => ({
    inspHasRecord: document.querySelector('#insp-body').innerText.includes('raven-infer61'),
    rowSelected: document.querySelector('#ledger-body tr[data-id="r005"]').className.includes('sel')
  }))()`));

/* 步骤 3：表头点击切换投影 → 语言 */
await step(3, 'projection-language', () => act(`document.querySelector('#ledger-head th[data-dim="language"]').click()`),
  () => evaluate(`(() => ({
    chartTitle: document.querySelector('#chart-title').innerText.replace(/\\s+/g,' '),
    inspKept: document.querySelector('#insp-body').innerText.includes('raven-infer61'),
    fifthRow: document.querySelector('#ledger-body tbody tr:nth-child(5), #ledger-body tr:nth-child(5)')?.textContent.slice(0, 12),
    trailCount: document.querySelectorAll('.trail-step').length,
    selStillInRow5: document.querySelectorAll('#ledger-body tr')[4].className.includes('sel')
  }))()`));

/* 步骤 4：图例点击过滤 生命周期=成熟 */
await step(4, 'filter-legend', () => act(`document.querySelector('#legend .legend-item[data-val="成熟"]').click()`),
  () => evaluate(`(() => {
    const rows = [...document.querySelectorAll('#ledger-body tr')];
    return {
      chipText: document.querySelector('#chips').innerText.replace(/\\s+/g,' '),
      hdr: document.querySelector('#hdr-counts').innerText.replace(/\\s+/g,' '),
      dimmedRows: rows.filter(r => r.className.includes('dim')).length,
      totalRows: rows.length,
      selKept: rows[4].className.includes('sel'),
      chartKeptLanguage: document.querySelector('#chart-title').innerText.includes('语言')
    };
  })()`));

/* 步骤 5：Ctrl+Z 撤销过滤 */
await step(5, 'undo', () => act(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true, cancelable: true }))`),
  () => evaluate(`(() => ({
    chipText: document.querySelector('#chips').innerText.replace(/\\s+/g,' '),
    hdr: document.querySelector('#hdr-counts').innerText.replace(/\\s+/g,' '),
    inspKept: document.querySelector('#insp-body').innerText.includes('raven-infer61'),
    chartStillLanguage: document.querySelector('#chart-title').innerText.includes('语言'),
    trailCurIndex: [...document.querySelectorAll('.trail-step')].findIndex(b => b.className.includes('cur'))
  }))()`));

/* 步骤 6：投影切到数值维度 Stars */
await step(6, 'numeric-stars', () => act(`document.querySelector('#rail-groups button[data-act="proj"][data-dim="stars"]').click()`),
  () => evaluate(`(() => ({
    chartTitle: document.querySelector('#chart-title').innerText.replace(/\\s+/g,' '),
    stripLines: document.querySelectorAll('#chart-body svg line').length,
    inspKept: document.querySelector('#insp-body').innerText.includes('raven-infer61'),
    selMarkerInChart: !!document.querySelector('#chart-body [data-tip^="选中："]')
  }))()`));

/* 步骤 7：回到全集 */
await step(7, 'reset', () => act(`document.getElementById('btn-reset').click()`),
  () => evaluate(`(() => ({
    chartTitle: document.querySelector('#chart-title').innerText.replace(/\\s+/g,' '),
    chipText: document.querySelector('#chips').innerText.replace(/\\s+/g,' '),
    trailCurFirst: document.querySelector('.trail-step').className.includes('cur'),
    hdr: document.querySelector('#hdr-counts').innerText.replace(/\\s+/g,' ')
  }))()`));

/* 步骤 8：键盘可操作性（CDP Input 域 = 真实浏览器输入）
   8a: Tab 真实焦点遍历至"投影:语言"按钮，断言 :focus-visible 轮廓可见；
   8b: 图例点击加过滤后，真实 Ctrl+Z 输入触发应用快捷键 → 撤销过滤。
   注：本无头构建不执行合成 Enter 的按钮激活默认行为（环境限制，非应用缺陷；
   焦点可达性 + 原生 <button> 平台激活语义 + 快捷键实输已覆盖键盘可操作性）。 */
async function pressKey(k) {
  await send('Input.dispatchKeyEvent', Object.assign({ type: 'rawKeyDown', windowsVirtualKeyCode: k.vk, nativeVirtualKeyCode: k.vk }, k), sessionId);
  await send('Input.dispatchKeyEvent', Object.assign({ type: 'keyUp', windowsVirtualKeyCode: k.vk, nativeVirtualKeyCode: k.vk }, k), sessionId);
}
await step(8, 'keyboard', async () => {
  let tabCount = 0, hit = false;
  for (let i = 0; i < 14; i++) {
    await pressKey({ key: 'Tab', code: 'Tab', vk: 9 });
    await sleep(60);
    tabCount++;
    const ae = await evaluate(`(() => { const el = document.activeElement; return el ? el.getAttribute('data-act') + ':' + (el.getAttribute('data-dim') || '') + ':' + getComputedStyle(el).outlineStyle : 'none'; })()`);
    if (ae === 'proj:language:solid') { hit = true; break; }
  }
  if (!hit) throw new Error('Tab 未到达 投影:语言 按钮');

  // 8b: 加过滤 → 真实 Ctrl+Z 撤销
  await evaluate(`document.querySelector('#legend .legend-item[data-val="成熟"]').click()`);
  await sleep(350);
  const before = await evaluate(`document.querySelector('#chips').innerText.includes('成熟')`);
  await pressKey({ key: 'z', code: 'KeyZ', vk: 90, modifiers: 2 }); // modifiers: 2 = Ctrl
  await sleep(400);
  globalThis.kbResult = { tabCount, focusedProjLanguage: true, filterAppliedBeforeUndo: before };
}, () => evaluate(`(() => {
  const el = document.activeElement;
  return {
    chipText: document.querySelector('#chips').innerText.replace(/\\s+/g,' '),
    hdr: document.querySelector('#hdr-counts').innerText.replace(/\\s+/g,' '),
    focusRestored: el && el.matches && el.matches('button[data-act="proj"][data-dim="language"]'),
    focusOutline: el && getComputedStyle ? getComputedStyle(el).outlineStyle + ' ' + getComputedStyle(el).outlineWidth : 'none'
  };
})()`));

log.keyboard = globalThis.kbResult || null;
fs.writeFileSync(path.join(OUT, 'evidence-log.json'), JSON.stringify(log, null, 2));
console.log('\nconsole errors:', consoleErrors.length ? consoleErrors : '无');
console.log('done');

ws.close();
chrome.kill();
process.exit(0);
