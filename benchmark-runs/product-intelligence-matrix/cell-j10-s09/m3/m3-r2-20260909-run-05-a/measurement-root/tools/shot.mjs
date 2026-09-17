/*
 * 真实浏览器证据采集脚本：以 headless Edge + CDP 驱动本应用，
 * 走完“带偏差执行（含人工恢复）→ 干净执行”两条路径，并在关键状态截图。
 * 零依赖（Node ≥22 内置 WebSocket / fetch）。用法：node tools/shot.mjs
 */
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const indexUrl = pathToFileURL(join(rootDir, 'index.html')).href;
const shotDir = join(rootDir, 'screenshots');
rmSync(shotDir, { recursive: true, force: true });
mkdirSync(shotDir, { recursive: true });

const BROWSER = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9333;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const captions = [];

const proc = spawn(BROWSER, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  `--user-data-dir=${join(rootDir, 'tools', '.edge-profile')}`,
  '--window-size=1680,1000', '--hide-scrollbars',
  `--remote-debugging-port=${PORT}`,
  indexUrl
], { stdio: ['ignore', 'pipe', 'pipe'] });

let jsErrors = [];

try {
  // 等待 DevTools 端点
  let page = null;
  for (let i = 0; i < 60 && !page; i++) {
    await sleep(400);
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      page = list.find((t) => t.type === 'page' && t.url.startsWith('file:')) || null;
    } catch { /* retry */ }
  }
  if (!page) throw new Error('DevTools endpoint unreachable');

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let msgId = 0;
  const pending = new Map();
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    else if (m.method === 'Runtime.exceptionThrown') {
      const d = m.params.exceptionDetails;
      jsErrors.push((d.exception && d.exception.description) || d.text);
    } else if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
      jsErrors.push(m.params.args.map((a) => a.value || a.description || '').join(' '));
    }
  };
  const send = (method, params = {}) => {
    const id = ++msgId;
    ws.send(JSON.stringify({ id, method, params }));
    return new Promise((res, rej) => pending.set(id, (m) =>
      m.error ? rej(new Error(method + ': ' + JSON.stringify(m.error))) : res(m.result)));
  };
  const ev = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
    if (r.exceptionDetails) throw new Error('eval: ' + JSON.stringify(r.exceptionDetails).slice(0, 400));
    return r.result ? r.result.value : undefined;
  };

  // 等待应用首屏就绪
  for (let i = 0; i < 50; i++) {
    if ((await ev(`document.readyState === 'complete' && !!document.querySelector('.step-row.cur')`)) === true) break;
    await sleep(200);
  }

  const q = (sel) => `document.querySelector(${JSON.stringify(sel)})`;
  const click = async (sel) => {
    for (let i = 0; i < 40; i++) {
      if ((await ev(`!!${q(sel)}`)) === true) break;
      await sleep(150);
    }
    const ok = await ev(`(function(){var el=${q(sel)};if(!el||el.disabled){return 'MISSING:'+${JSON.stringify(sel)}+' | h2='+((document.querySelector('.card-head h2')||{}).textContent||'-')+' | crumb='+((document.querySelector('.crumb')||{}).textContent||'-')+' | reqhint='+((document.querySelector('.req-hint')||{}).textContent||'-')+' | trace='+((window.__trace||[]).slice(-6).join(' | '));}el.click();return 'ok';})()`);
    if (ok !== 'ok') throw new Error('click failed: ' + ok);
    await sleep(120);
  };
  // 幂等勾选：已勾选则跳过（回退/恢复后状态会保留）
  const check = async (sel) => {
    const checked = await ev(`!!(${q(sel)} && ${q(sel)}.checked)`);
    if (!checked) await click(sel);
  };
  const setVal = async (sel, val) => {
    await ev(`(function(){var el=${q(sel)};el.disabled=false;el.value=${JSON.stringify(val)};el.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  };
  const shot = async (name, caption) => {
    const { data } = await send('Page.captureScreenshot', { format: 'png' });
    const file = join(shotDir, name + '.png');
    writeFileSync(file, Buffer.from(data, 'base64'));
    captions.push(name + '.png  ←  ' + caption);
    console.log('shot:', name, '(' + Math.round(data.length / 1024) + ' KB)');
  };
  const text = (sel) => ev(`${q(sel)} ? ${q(sel)}.textContent.trim().replace(/\\s+/g,' ') : '(absent)'`);
  const waitFor = async (expr, ms) => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) {
      if ((await ev(expr)) === true) return true;
      await sleep(200);
    }
    throw new Error('waitFor timeout: ' + expr);
  };
  const waitLock = async (n) =>
    waitFor(`document.getElementById('chipIrr').textContent.indexOf('${n}/2') >= 0`, 20000);

  // 注入调用追踪（应用函数为全局绑定，可安全包裹）
  await ev(`(function(){
    window.__trace = [];
    function w(name, fn){ return function(){ window.__trace.push(name + '#' + [].join.call(arguments, ',') + '@' + performance.now().toFixed(0)); return fn.apply(this, arguments); }; }
    lockStep = w('lockStep', lockStep);
    tryExecute = w('tryExecute', tryExecute);
    undoStep = w('undoStep', undoStep);
    tryRecover = w('tryRecover', tryRecover);
    gateAnswer = w('gateAnswer', gateAnswer);
  })()`);
  const dumpTrace = async () => console.log('TRACE:', await ev(`window.__trace.join(' | ')`));

  const tickChecks = async (ackIdx) => {
    await check('#ck-c1'); await check('#ck-c2');
    if (ackIdx != null) await check('#ack-' + ackIdx);
  };

  // ---- 带偏差执行路径（失误 + 撤销 + 人工恢复 + 阻断） ----
  await shot('01-initial-first-screen', '首屏即用：无加载态，PRE-01 处于可操作状态');

  // PRE-01：勾选 + 誊录校验码（先演示一次错录失误，再改对）
  await tickChecks();
  await setVal('[data-capture="code:t1"]', '7F3K9X');
  await click('[data-action="code:t1"]');
  await shot('02-transcription-mistake', '誊录校验码错误 → 记 1 次失误（零失误机制实测）');
  await setVal('[data-capture="code:t1"]', '7F3K9Q');
  await click('[data-action="code:t1"]');
  await click('[data-action="complete"]');
  console.log('after PRE-01, mistake chip:', await text('#chipMistake'));

  // PRE-02
  await tickChecks();
  await click('[data-action="complete"]');

  // PRE-03：勾选 + 风险提示确认 + 安全核查提问
  await tickChecks(2);
  await click('[data-action="gate:yes"]');
  await click('[data-action="complete"]');

  // CUT-01
  await tickChecks(3);
  await click('[data-action="complete"]');
  console.log('CUT-02 heading:', await text('.card-head h2'));
  await shot('03-irreversible-confirm-path', '不可逆步骤 CUT-02：条件未满足时执行被禁用（护栏）');

  // CUT-02：阅读回退预案 → 短语误填一次 → 正确 → 执行 → 撤销窗口
  await tickChecks(4);
  await setVal('#phraseInput', '确认切换端点');
  await click('[data-action="execute"]');
  await shot('04-phrase-mistake-irreversible', '不可逆确认短语不匹配 → 拒绝执行并计失误（确认路径实测）');
  await setVal('#phraseInput', '确认切换写入端点');
  await click('[data-action="execute"]');
  await waitFor(`!!document.querySelector('.armed-box')`, 3000);
  console.log('undo countdown t0:', await text('#undoSec'));
  await sleep(1500);
  console.log('undo countdown t0+1.5s:', await text('#undoSec'));
  await shot('05-undo-window-live', '已执行进入 10 秒撤销窗口，一键回退可用（恢复路径第一层）');
  await waitLock(1);
  await click('[data-idx="4"]');
  await waitFor(`!!document.querySelector('.locked-banner')`, 3000);
  await shot('06-locked-recovery-path', '窗口关闭后 CUT-02 已生效，展示人工恢复程序 HP-01（恢复路径第二层）');

  // 人工恢复程序 HP-01：把已生效的 CUT-02 拉回待执行
  await setVal('[data-capture="recphrase"]', '执行HP-01');
  await click('[data-action="recover"]');
  await waitFor(`!!document.querySelector('#phraseInput')`, 3000);
  await shot('07-manual-recovery-hp01', '执行 HP-01 → CUT-02 回到待执行（恢复路径实测，计偏差）');

  // 重新执行 CUT-02 → 生效
  await tickChecks(4);
  await setVal('#phraseInput', '确认切换写入端点');
  await click('[data-action="execute"]');
  await waitLock(1);

  // CUT-03：执行 → 撤销窗口内立即回退（偏差）→ 重新执行 → 生效
  await tickChecks(5);
  await setVal('#phraseInput', '确认封版旧主库');
  await click('[data-action="execute"]');
  await waitFor(`!!document.querySelector('.armed-box')`, 3000);
  await click('[data-action="undo"]');
  await shot('08-undo-used', 'CUT-03 使用撤销窗口回退 → 计 1 项偏差，步骤回到待执行');
  await tickChecks(5);
  await setVal('#phraseInput', '确认封版旧主库');
  await click('[data-action="execute"]');
  await waitLock(2);

  // POST-01：安全核查答“否”（与面板不符）→ 阻断 → 重新核查 → 通过
  await tickChecks(6);
  await click('[data-action="gate:no"]');
  await waitFor(`!!document.querySelector('.blocked-box')`, 3000);
  await shot('09-gate-blocked-safe-stop', '核查判断与面板不符 → 阻断推进 + 安全停止入口');
  await click('[data-action="recheck"]');
  await click('[data-action="gate:yes"]');
  await click('[data-action="complete"]');

  // POST-02 / POST-03
  await tickChecks();
  await click('[data-action="complete"]');
  await tickChecks();
  await click('[data-action="complete"]');
  await waitFor(`!!document.querySelector('.verdict')`, 3000);
  console.log('verdict title:', await text('.verdict h2'), '| 失误:', await text('#chipMistake'), '| 偏差:', await text('#chipDeviation'));
  await shot('10-verdict-with-deviations', '完成判定：含失误/偏差的诚实结算 + 全量审计日志');

  // ---- 干净执行路径：重新开始 → 零失误走完全程 ----
  await click('[data-action="restart2"]');
  await waitFor(`!!document.querySelector('[data-action="complete"]')`, 3000);

  const completeNormal = async () => {
    await tickChecks();
    const hasCode = await ev(`!!document.querySelector('[data-capture="code:t1"]')`);
    if (hasCode) { await setVal('[data-capture="code:t1"]', '7F3K9Q'); await click('[data-action="code:t1"]'); }
    const ackId = await ev(`(function(){var els=document.querySelectorAll('[data-ack]');return els.length?els[0].id:'';})()`);
    if (ackId) await check('#' + ackId);
    const hasGate = await ev(`!!document.querySelector('[data-action="gate:yes"]:not([disabled])')`);
    if (hasGate) await click('[data-action="gate:yes"]');
    await click('[data-action="complete"]');
  };
  const completeIrreversible = async (phrase) => {
    await tickChecks();
    const ackId = await ev(`(function(){var els=document.querySelectorAll('[data-ack]');return els.length?els[0].id:'';})()`);
    if (ackId) await check('#' + ackId);
    await setVal('#phraseInput', phrase);
    await click('[data-action="execute"]');
    await sleep(500);
  };

  await completeNormal();                                    // PRE-01
  await completeNormal();                                    // PRE-02
  await completeNormal();                                    // PRE-03（gate=是）
  await completeNormal();                                    // CUT-01
  await completeIrreversible('确认切换写入端点');              // CUT-02（等撤销窗口自然关闭）
  await waitLock(1);
  await completeIrreversible('确认封版旧主库');                // CUT-03
  await waitLock(2);
  await completeNormal();                                    // POST-01
  await completeNormal();                                    // POST-02
  await completeNormal();                                    // POST-03
  await waitFor(`!!document.querySelector('.verdict')`, 3000);
  console.log('clean verdict title:', await text('.verdict h2'),
    '| 失误:', await text('#chipMistake'), '| 偏差:', await text('#chipDeviation'),
    '| 进度:', await text('#progressLabel'));
  await shot('11-verdict-zero-mistake', '零失误完成判定 🏆（失误 0 / 偏差 0，9/9 步）');

  console.log('\nJS errors during run:', jsErrors.length ? jsErrors : '(none)');
} finally {
  proc.kill();
}

console.log('\n--- evidence index ---');
captions.forEach((c) => console.log(c));
