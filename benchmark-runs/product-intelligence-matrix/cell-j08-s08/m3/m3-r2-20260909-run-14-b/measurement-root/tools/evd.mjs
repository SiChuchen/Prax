/* Structura 证据驱动：真实 Chrome(headless,CDP) 上的交互式验收证据采集。
   零依赖（Node 22+ 内置 WebSocket/fetch）。运行：node tools/evd.mjs */
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const OUT = join(ROOT, 'evidence');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9225;
const PAGE = 'file:///' + ROOT.replace(/\\/g, '/') + '/index.html';

mkdirSync(OUT, { recursive: true });
const results = [];
function ok(name, cond, detail) {
  results.push({ name, pass: !!cond, detail: detail || '' });
  console.log((cond ? 'PASS' : 'FAIL') + '  ' + name + (detail ? '  -- ' + detail : ''));
}

const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--remote-debugging-port=' + PORT,
  '--user-data-dir=' + join(process.env.TEMP, 'structura-cdp-' + Date.now()),
  '--window-size=1600,1000', '--hide-scrollbars', 'about:blank'
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let ws, msgId = 0;
const pending = new Map();
const events = [];
function send(method, params, sessionId) {
  return new Promise((resolve, reject) => {
    const id = ++msgId;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params: params || {}, sessionId }));
  });
}
async function waitEvent(method, sessionId, timeoutMs) {
  const t0 = Date.now();
  while (Date.now() - t0 < (timeoutMs || 5000)) {
    const i = events.findIndex((e) => e.method === method && (!sessionId || e.sessionId === sessionId));
    if (i >= 0) return events.splice(i, 1)[0];
    await sleep(60);
  }
  return null;
}
async function evaluate(expression, sessionId) {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, sessionId);
  if (r.exceptionDetails) throw new Error('eval: ' + JSON.stringify(r.exceptionDetails.exception?.description || r.exceptionDetails.text));
  return r.result.value;
}
async function shot(name, sessionId) {
  const r = await send('Page.captureScreenshot', { format: 'png' }, sessionId);
  writeFileSync(join(OUT, name), Buffer.from(r.data, 'base64'));
  console.log('SHOT  ' + name);
}
async function key(kd, sessionId) { await send('Input.dispatchKeyEvent', kd, sessionId); }

try {
  const versionWs = await (async () => {
    for (let i = 0; i < 60; i++) {
      try {
        const j = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json();
        return j.webSocketDebuggerUrl;
      } catch { await sleep(250); }
    }
    throw new Error('devtools port unreachable');
  })();

  ws = new WebSocket(versionWs);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id && pending.has(d.id)) {
      const p = pending.get(d.id);
      pending.delete(d.id);
      d.error ? p.reject(new Error(d.error.message)) : p.resolve(d.result);
    } else if (d.method) events.push(d);
  };

  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  await send('Page.enable', {}, sessionId);
  await send('Runtime.enable', {}, sessionId); // 收集异常
  await send('Page.navigate', { url: PAGE }, sessionId);
  await waitEvent('Page.loadEventFired', sessionId, 8000);
  await sleep(700);

  /* 01 首屏即就绪 */
  ok('01 ready-state blocks rendered', (await evaluate(`document.querySelectorAll('#editor .block').length`, sessionId)) === 18);
  ok('01 health pill ok', (await evaluate(`document.getElementById('healthPill').textContent`, sessionId)) === '结构完好');
  ok('01 preview synced title', (await evaluate(`document.querySelector('#preview .doc-title').textContent`, sessionId)).includes('城市步道'));
  await shot('01-initial-ready.png', sessionId);

  /* 02 大纲点击 → 双视图同步 */
  await evaluate(`document.querySelector('[data-goto="b07"]').click()`, sessionId);
  await sleep(600);
  ok('02 selection synced in both panes', (await evaluate(
    `document.querySelectorAll('.block.selected').length + document.querySelectorAll('.preview .pv.selected').length`, sessionId)) === 2);
  await shot('02-outline-jump-sync.png', sessionId);

  /* 03 键入 → 预览实时一致（真实 CDP 输入） */
  await evaluate(`var el=document.querySelector('.block[data-id="b03"] .content'); el.focus();
    var r=document.createRange(); r.selectNodeContents(el); r.collapse(false);
    var s=getSelection(); s.removeAllRanges(); s.addRange(r);`, sessionId);
  await send('Input.insertText', { text: '本期范围已核定。' }, sessionId);
  await sleep(300);
  ok('03 typed text appears in preview', (await evaluate(
    `document.querySelector('[data-pv-id="b03"]').textContent`, sessionId)).includes('本期范围已核定。'));
  ok('03 editor keeps caret (no rerender)', (await evaluate(`document.activeElement.closest('.block').dataset.id`, sessionId)) === 'b03');
  await shot('03-edit-preview-consistency.png', sessionId);

  /* 04 制造结构破坏（H2 下直接降 H3→H4 形成跳级）→ 结构检查拦截 */
  await evaluate(`document.querySelector('.block[data-id="b08"] [data-action="demote"]').click()`, sessionId);
  await sleep(250);
  ok('04 level-jump detected', (await evaluate(
    `[document.getElementById('healthPill').textContent, document.querySelectorAll('.diag').length].join('|')`, sessionId)) === '1 个结构问题|1');
  await shot('04-structure-guard-error.png', sessionId);

  /* 05 一键修复 → 恢复健康 */
  await evaluate(`document.querySelector('.diag [data-fix]').click()`, sessionId);
  await sleep(250);
  ok('05 fix restores health', (await evaluate(`document.getElementById('healthPill').textContent`, sessionId)) === '结构完好');
  ok('05 heading back to H3', (await evaluate(`document.querySelector('.block[data-id="b08"] .type-chip').textContent`, sessionId)) === 'H3');
  await shot('05-structure-fixed.png', sessionId);

  /* 06 删除块 → 提示可撤销 → Ctrl+Z 恢复 */
  await evaluate(`document.querySelector('.block[data-id="b13"] [data-action="del"]').click()`, sessionId);
  await sleep(250);
  ok('06 block deleted + toast shown', (await evaluate(
    `!document.getElementById('toast').hidden && !document.querySelector('.block[data-id="b13"]')`, sessionId)) === true);
  await shot('06a-delete-toast.png', sessionId);
  await key({ type: 'keyDown', modifiers: 2, code: 'KeyZ', key: 'z', windowsVirtualKeyCode: 90 }, sessionId);
  await key({ type: 'keyUp', modifiers: 2, code: 'KeyZ', key: 'z', windowsVirtualKeyCode: 90 }, sessionId);
  await sleep(300);
  ok('06 Ctrl+Z restores block', (await evaluate(`!!document.querySelector('.block[data-id="b13"]')`, sessionId)) === true);
  await shot('06b-undo-restored.png', sessionId);

  /* 07 键盘 Tab/Shift+Tab 调标题层级 */
  await evaluate(`document.querySelector('.block[data-id="b08"] .content').focus()`, sessionId);
  await key({ type: 'keyDown', code: 'Tab', key: 'Tab', windowsVirtualKeyCode: 9 }, sessionId);
  await key({ type: 'keyUp', code: 'Tab', key: 'Tab', windowsVirtualKeyCode: 9 }, sessionId);
  await sleep(200);
  ok('07 Tab demotes to H4', (await evaluate(`document.querySelector('.block[data-id="b08"] .type-chip').textContent`, sessionId)) === 'H4');
  await key({ type: 'keyDown', modifiers: 8, code: 'Tab', key: 'Tab', windowsVirtualKeyCode: 9 }, sessionId);
  await key({ type: 'keyUp', modifiers: 8, code: 'Tab', key: 'Tab', windowsVirtualKeyCode: 9 }, sessionId);
  await sleep(200);
  ok('07 Shift+Tab promotes back to H3', (await evaluate(`document.querySelector('.block[data-id="b08"] .type-chip').textContent`, sessionId)) === 'H3');
  await shot('07-keyboard-level.png', sessionId);

  /* 08 空状态 → 重置示例 */
  await evaluate(`(function(){var n=0; while(document.querySelector('.block [data-action="del"]')&&n++<60){document.querySelector('.block [data-action="del"]').click();} return document.querySelectorAll('.block').length;})()`, sessionId);
  await sleep(250);
  ok('08 empty state shown', (await evaluate(
    `[document.querySelectorAll('.block').length, document.querySelector('.editor-empty')?1:0, document.querySelector('.pv-empty')?1:0, document.getElementById('healthPill').textContent].join('|')`, sessionId)) === '0|1|1|空文档');
  await shot('08a-empty-state.png', sessionId);
  await evaluate(`document.getElementById('resetBtn').click()`, sessionId);
  await sleep(300);
  ok('08 reset restores sample', (await evaluate(
    `[document.querySelectorAll('.block').length, document.getElementById('healthPill').textContent].join('|')`, sessionId)) === '18|结构完好');

  /* 09 预览点击 → 回选编辑器 */
  await evaluate(`document.querySelector('[data-pv-id="b06"]').click()`, sessionId);
  await sleep(500);
  ok('09 preview click selects editor block', (await evaluate(
    `document.querySelector('.block[data-id="b06"]').classList.contains('selected')`, sessionId)) === true);
  await shot('09-preview-click-sync.png', sessionId);

  /* 运行时异常应为 0 */
  const exceptions = events.filter((e) => e.method === 'Runtime.exceptionThrown');
  ok('runtime exceptions = 0', exceptions.length === 0, exceptions.map((e) => e.params.exceptionDetails.text).join('; '));

  /* 保存持久化验证 */
  ok('10 autosave persisted', (await evaluate(`(JSON.parse(localStorage.getItem('structura.doc.v1'))||{}).blocks.length`, sessionId)) === 18);

  await send('Target.closeTarget', { targetId });
} catch (e) {
  console.error('DRIVER ERROR:', e.message);
  process.exitCode = 1;
} finally {
  chrome.kill();
  try { rmSync(join(process.env.TEMP, 'structura-cdp-temp'), { recursive: true, force: true }); } catch { }
}
const failed = results.filter((r) => !r.pass);
console.log('---');
console.log(failed.length ? failed.length + ' FAILED' : 'ALL ' + results.length + ' CHECKS PASSED');
writeFileSync(join(OUT, 'checks.json'), JSON.stringify(results, null, 2));
