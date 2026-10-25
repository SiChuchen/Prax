/* Real-browser evidence capture harness v2 — original planned sequence, run against FIXED app.js.
   Expected RP chain: RP-1(S4) -> recover -> re-commit RP-2(S4) -> RP-3(S5) -> RP-4(S7). */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const ROOT = 'E:/codex-prj/ab-worktrees/pi-matrix-m5p3/s6-e1';
const EV = path.join(ROOT, 'evidence');
fs.mkdirSync(EV, { recursive: true });
const LOG = path.join(EV, 'run.log');
fs.writeFileSync(LOG, '');
const APP_URL = 'file:///E:/codex-prj/ab-worktrees/pi-matrix-m5p3/s6-e1/index.html';
const BROWSERS = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ts = () => new Date().toISOString();
function logLine(s) { fs.appendFileSync(LOG, s + '\n'); process.stdout.write(s + '\n'); }

let ws = null, msgId = 0, proc = null, udd = null;
const pending = new Map();
const consoleIssues = [];

function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++msgId;
    pending.set(id, { resolve, reject, method });
    ws.send(JSON.stringify({ id, method, params }));
  });
}
function onMessage(data) {
  let m; try { m = JSON.parse(data); } catch { return; }
  if (m.id && pending.has(m.id)) {
    const p = pending.get(m.id); pending.delete(m.id);
    if (m.error) p.reject(new Error(`${p.method}: ${m.error.message}`));
    else p.resolve(m.result);
    return;
  }
  if (m.method === 'Runtime.consoleAPICalled' && ['error', 'warning', 'assert'].includes(m.params.type)) {
    const txt = (m.params.args || []).map(a => a.value !== undefined ? JSON.stringify(a.value) : (a.description || a.type)).join(' ');
    consoleIssues.push(`console.${m.params.type}: ${txt}`);
  } else if (m.method === 'Runtime.exceptionThrown') {
    const d = m.params.exceptionDetails;
    consoleIssues.push(`exception: ${d.text}${d.exception?.description ? ' | ' + d.exception.description : ''}`);
  } else if (m.method === 'Log.entryAdded' && ['error', 'warning'].includes(m.params.entry.level)) {
    consoleIssues.push(`log.${m.params.entry.level} [${m.params.entry.source}]: ${m.params.entry.text}`);
  }
}
async function evalExpr(expression) {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error('eval failed: ' + JSON.stringify(r.exceptionDetails));
  return r.result.value;
}
async function shot(name) {
  await sleep(80); // settle paint
  const r = await send('Page.captureScreenshot', { format: 'png' });
  const p = path.join(EV, name);
  fs.writeFileSync(p, Buffer.from(r.data, 'base64'));
  logLine(`${ts()} | SHOT | ${name} | ${fs.statSync(p).size} bytes`);
  return p;
}
const J = v => JSON.stringify(v);
async function clickSel(sel) {
  const r = await evalExpr(`(function(){var el=document.querySelector(${J(sel)});if(!el)return "MISSING";el.click();return "OK";})()`);
  if (r !== 'OK') throw new Error('clickSel missing: ' + sel);
  await sleep(40);
}
async function textOf(sel) { return evalExpr(`(function(){var el=document.querySelector(${J(sel)});return el?el.textContent.replace(/\\s+/g," ").trim():null;})()`); }
async function exists(sel) { return evalExpr(`!!document.querySelector(${J(sel)})`); }
async function isDisabled(sel) { return evalExpr(`(function(){var el=document.querySelector(${J(sel)});return el?el.disabled:null;})()`); }
async function badges() { return evalExpr(`[...document.querySelectorAll('#badges .badge')].map(function(b){return b.textContent.replace(/\\s+/g," ").trim();})`); }
async function setPass(value) {
  return evalExpr(`(function(){var i=document.querySelector('#gate-pass-input');if(!i)return "MISSING";i.value=${J(value)};i.dispatchEvent(new Event('input',{bubbles:true}));return i.value;})()`);
}
async function key(k) {
  const base = { key: k.key, code: k.code, windowsVirtualKeyCode: k.vk, nativeVirtualKeyCode: k.vk };
  await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', ...base });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', ...base });
  await sleep(40);
}

/* ---- assertion helpers ---- */
let curM = 'INIT';
const fails = [];
function assert(name, pass, expected, actual) {
  if (!pass) fails.push(`${curM}:${name}`);
  logLine(`${ts()} | ${curM} | ASSERT ${pass ? 'PASS' : 'FAIL'} | ${name} | expected=${J(expected)} actual=${J(actual)}`);
}
function assertEq(name, actual, expected) { assert(name, JSON.stringify(actual) === JSON.stringify(expected), expected, actual); }
async function badgeLine() { logLine(`${ts()} | ${curM} | BADGES ${J(await badges())}`); }
async function consoleLine() { logLine(`${ts()} | ${curM} | CONSOLE_ISSUES_SO_FAR ${consoleIssues.length}${consoleIssues.length ? ' :: ' + consoleIssues.join(' ;; ') : ''}`); }
async function checkAll(step) {
  for (let i = 0; i < 3; i++) await clickSel(`#step_detail input[data-action="toggle-check"][data-step="${step}"][data-idx="${i}"]`);
}
async function gateFlow(code) {
  await setPass(code);
  await clickSel('#gate-ack');
  const dis = await isDisabled('#gate-confirm');
  assert('gate-confirm enabled after ack+pass', dis === false, false, dis);
  await clickSel('#gate-confirm');
  await sleep(60);
}

async function main() {
  const exe = BROWSERS.find(p => fs.existsSync(p));
  if (!exe) throw new Error('no Chromium browser found');
  let port = null;
  for (const p of [9223, 9224, 9225]) {
    try { await fetch(`http://127.0.0.1:${p}/json/version`); } catch { port = p; break; }
  }
  if (!port) throw new Error('no free debug port 9223-9225');
  udd = fs.mkdtempSync(path.join(os.tmpdir(), 'rg-profile-'));
  const headlessVariants = [['--headless=new'], ['--headless']];
  let versionInfo = null;
  for (const hl of headlessVariants) {
    proc = spawn(exe, [
      `--remote-debugging-port=${port}`, '--window-size=1600,900', ...hl, '--disable-gpu',
      `--user-data-dir=${udd}`, '--no-first-run', '--no-default-browser-check', 'about:blank',
    ], { stdio: 'ignore' });
    for (let i = 0; i < 60; i++) {
      try { const r = await fetch(`http://127.0.0.1:${port}/json/version`); if (r.ok) { versionInfo = await r.json(); break; } } catch {}
      if (proc.exitCode !== null) break;
      await sleep(250);
    }
    if (versionInfo) { logLine(`${ts()} | ENV | browser=${exe} | ${versionInfo.Browser} | flag=${hl[0]} | port=${port} | profile=${udd}`); break; }
    try { proc.kill(); } catch {}
    proc = null;
  }
  if (!proc || !versionInfo) throw new Error('browser failed to start with debug port');

  const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const page = list.find(t => t.type === 'page');
  if (!page) throw new Error('no page target');
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('ws error')); });
  ws.onmessage = e => onMessage(typeof e.data === 'string' ? e.data : e.data.toString());

  await send('Runtime.enable');
  await send('Page.enable');
  await send('Log.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: APP_URL });
  for (let i = 0; i < 100; i++) {
    try { if (await evalExpr('document.readyState') === 'complete') break; } catch {}
    await sleep(100);
  }
  await sleep(200);
  logLine(`${ts()} | NAV | ${APP_URL}`);

  /* ---------------- M1: 01-initial ---------------- */
  curM = 'M1-initial';
  await shot('01-initial.png');
  let b = await badges();
  assertEq('badges', b, ['核验 0/21', '确认门 0/3', '恢复点 0 可用', '流程 进行中']);
  assertEq('#btn-primary disabled', await isDisabled('#btn-primary'), true);
  assertEq('rp empty-state hint', await exists('#rp-list .rp-empty'), true);
  assertEq('ledger empty-state hint', await exists('#ledger-list .ledger-empty'), true);
  assertEq('rp-empty text', await textOf('#rp-list .rp-empty'), '尚无恢复点。第一个不可逆步骤提交时，会自动在这里创建恢复点。');
  assertEq('ledger-empty text', await textOf('#ledger-list .ledger-empty'), '尚无执行记录。你的每个动作（核验 / 提交 / 恢复 / 重置）都会留痕在这里。');
  // (a) initial nav state: S1 active, S2..S7 locked
  const nav0 = await evalExpr(`[...document.querySelectorAll('.step-item')].map(function(el){return {step:el.dataset.step, cls:el.className, meta:(el.querySelector('.st-meta')||{}).textContent||null};})`);
  const s1n = nav0.find(n => n.step === 'S1');
  assert('initial S1 is-active', s1n && s1n.cls.includes('is-active'), 'contains is-active', s1n);
  assertEq('initial S1 meta 当前步骤', s1n && s1n.meta, '当前步骤');
  const lockExp = { S2: '锁定', S3: '锁定', S4: '锁定 · 不可逆', S5: '锁定 · 不可逆', S6: '锁定', S7: '锁定 · 不可逆' };
  for (const [stp, metaExp] of Object.entries(lockExp)) {
    const n = nav0.find(x => x.step === stp);
    assert(`initial ${stp} is-locked`, n && n.cls.includes('is-locked'), 'contains is-locked', n);
    assertEq(`initial ${stp} meta`, n && n.meta, metaExp);
  }
  // (a11y) locked step names: full-opacity color-based mute (no opacity dimming)
  const lockStyle = await evalExpr(`(function(){var el=document.querySelector('.step-item.is-locked .st-name');var cs=getComputedStyle(el);return {color:cs.color,opacity:cs.opacity};})()`);
  assertEq('locked .st-name computed color', lockStyle.color, 'rgb(78, 93, 118)');
  assertEq('locked .st-name opacity', lockStyle.opacity, '1');
  // (a11y) checkbox target size >= 24x24
  const cbSize = await evalExpr(`(function(){var el=document.querySelector('#step_detail .check input');return {w:el.offsetWidth,h:el.offsetHeight};})()`);
  assert('checkbox target size >= 24', cbSize.w >= 24 && cbSize.h >= 24, 'w>=24 && h>=24', cbSize);
  // (a11y) roving tabindex at rest: selected tabbable, others not
  const tabState = await evalExpr(`[...document.querySelectorAll('.step-item')].map(function(el){return {step:el.dataset.step,t:el.getAttribute('tabindex'),cur:el.getAttribute('aria-current')};})`);
  const s1t = tabState.find(x => x.step === 'S1'), s2t = tabState.find(x => x.step === 'S2');
  assertEq('roving tabindex: S1 (selected) tabindex', s1t && s1t.t, '0');
  assertEq('roving tabindex: S1 aria-current', s1t && s1t.cur, 'step');
  assertEq('roving tabindex: S2 (unselected) tabindex', s2t && s2t.t, '-1');
  assertEq('roving tabindex: S2 aria-current', s2t && s2t.cur, 'false');
  await badgeLine(); await consoleLine();

  /* ---------------- M2: S1-S3 commit, S4 gate -> 02-gate-modal ---------------- */
  curM = 'M2-gate-modal';
  await checkAll('S1'); // S1 selected by default
  logLine(`${ts()} | ${curM} | INFO step=S1 btn-primary label=${J(await textOf('#btn-primary'))}`);
  await clickSel('#btn-primary');
  await sleep(60);
  // (b) after S1 commit: S1 done, S2 active
  const navS1 = await evalExpr(`(function(){var g=function(s){var el=document.querySelector('.step-item[data-step="'+s+'"]');return {cls:el.className,meta:(el.querySelector('.st-meta')||{}).textContent};};return {S1:g('S1'),S2:g('S2')};})()`);
  assert('post-S1-commit S1 is-done', navS1.S1.cls.includes('is-done'), 'contains is-done', navS1.S1);
  assertEq('post-S1-commit S1 meta 已完成', navS1.S1.meta, '已完成');
  assert('post-S1-commit S2 is-active', navS1.S2.cls.includes('is-active'), 'contains is-active', navS1.S2);
  assertEq('post-S1-commit S2 meta 当前步骤', navS1.S2.meta, '当前步骤');
  for (const s of ['S2', 'S3']) {
    await clickSel(`.step-item[data-step="${s}"]`);
    await checkAll(s);
    const label = await textOf('#btn-primary');
    logLine(`${ts()} | ${curM} | INFO step=${s} btn-primary label=${J(label)}`);
    await clickSel('#btn-primary');
    await sleep(60);
  }
  await clickSel('.step-item[data-step="S4"]');
  await checkAll('S4');
  assertEq('S4 btn label', await textOf('#btn-primary'), '⚠ 执行迁移');
  await clickSel('#btn-primary');
  await sleep(60);
  await shot('02-gate-modal.png');
  assertEq('gate dialog exists', await exists('#modal-root .gate'), true);
  assertEq('gate kicker', await textOf('.gate-kicker'), '⚠ 确认门 · 不可逆步骤');
  const cons = await textOf('.gate-consequence');
  assert('gate consequence text', cons !== null && cons.includes('提交后不可直接撤销') && cons.includes('不可回退的 DDL'), 'contains 提交后不可直接撤销 + 不可回退的 DDL', cons && cons.slice(0, 60) + '…');
  assertEq('passcode hint MIGRATE', await textOf('.gate-pass label code'), 'MIGRATE');
  assertEq('#gate-confirm disabled', await isDisabled('#gate-confirm'), true);
  assertEq('RP preview in gate', await textOf('.gate-checkpoint .rp-ref'), 'RP-1');
  await badgeLine(); await consoleLine();

  /* ---------------- M3: wrong passcode -> 03-gate-error ---------------- */
  curM = 'M3-gate-error';
  assertEq('set WRONG', await setPass('WRONG'), 'WRONG');
  await clickSel('#gate-ack');
  await sleep(40);
  await shot('03-gate-error.png');
  assertEq('#gate-confirm still disabled', await isDisabled('#gate-confirm'), true);
  const err = await textOf('#gate-err');
  assert('#gate-err 口令不匹配', err !== null && err.includes('口令不匹配'), 'contains 口令不匹配', err);
  await badgeLine(); await consoleLine();

  /* ---------------- M4: MIGRATE commit -> RP-1 -> 04-committed-rp ---------------- */
  curM = 'M4-committed-rp';
  assertEq('set MIGRATE', await setPass('MIGRATE'), 'MIGRATE');
  assertEq('#gate-confirm enabled', await isDisabled('#gate-confirm'), false);
  await clickSel('#gate-confirm');
  await sleep(80);
  // app auto-advances selection to S5 after commit; select S4 in nav to display its committed detail
  await clickSel('.step-item[data-step="S4"]');
  logLine(`${ts()} | ${curM} | NOTE selected S4 in nav to capture committed detail (app auto-advanced selection after commit)`);
  await shot('04-committed-rp.png');
  assertEq('modal closed', await exists('#modal-root .gate'), false);
  const s4meta = await textOf('.step-item[data-step="S4"] .st-meta');
  assert('S4 nav 已提交 (no dup)', s4meta === '已提交 · 不可逆', '已提交 · 不可逆', s4meta);
  assertEq('RP-1 card exists', await exists('#rp-list .rp-card[data-rp="RP-1"]'), true);
  assertEq('RP-1 recover button', await textOf('#rp-list .rp-card[data-rp="RP-1"] .btn-recover'), '恢复到此点');
  assertEq('S4 nav RP chip', await textOf('.step-item[data-step="S4"] .st-rp'), 'RP-1');
  const led = await textOf('#ledger-list');
  assert('ledger 确认门提交 + MIGRATE + RP-1', led !== null && led.includes('确认门提交') && led.includes('MIGRATE') && led.includes('RP-1'), 'contains 确认门提交 & MIGRATE & RP-1', led && led.slice(0, 80) + '…');
  b = await badges();
  assertEq('badges', b, ['核验 12/21', '确认门 1/3', '恢复点 1 可用', '流程 进行中']);
  const note = await textOf('.committed-note');
  assert('violet committed note', note !== null && note.includes('已提交 · 不可直接撤销') && note.includes('RP-1'), '已提交 · 不可直接撤销 + RP-1', note);
  await badgeLine(); await consoleLine();

  /* ---------------- M5: recover gate -> 05-recover-gate ---------------- */
  curM = 'M5-recover-gate';
  await clickSel('#rp-list .rp-card[data-rp="RP-1"] .btn-recover');
  await sleep(60);
  await shot('05-recover-gate.png');
  assertEq('recover dialog exists', await exists('#modal-root .gate.is-recover'), true);
  assertEq('recover kicker', await textOf('.gate-kicker'), '↺ 恢复确认 · Recovery Gate');
  assertEq('recover title', await textOf('#gate-title'), '从恢复点 RP-1 恢复？');
  assertEq('#gate-confirm disabled before ack', await isDisabled('#gate-confirm'), true);
  await clickSel('#gate-ack');
  assertEq('#gate-confirm enabled after ack', await isDisabled('#gate-confirm'), false);
  await clickSel('#gate-confirm');
  await sleep(80);

  /* ---------------- M6: recovered state -> 06-recovered ---------------- */
  curM = 'M6-recovered';
  await shot('06-recovered.png');
  assertEq('modal closed', await exists('#modal-root .gate'), false);
  const s4cls = await evalExpr(`(function(){var el=document.querySelector('.step-item[data-step="S4"]');return el?el.className:null;})()`);
  assert('S4 nav is-active', s4cls !== null && s4cls.includes('is-active'), 'contains is-active', s4cls);
  const s4meta2 = await textOf('.step-item[data-step="S4"] .st-meta');
  assert('S4 nav 当前步骤', s4meta2 !== null && s4meta2.includes('当前步骤'), 'contains 当前步骤', s4meta2);
  const s4checks = await evalExpr(`[...document.querySelectorAll('#step_detail input[data-step="S4"]')].map(function(i){return i.checked;})`);
  assertEq('S4 3 checks still checked', s4checks, [true, true, true]);
  assertEq('#btn-primary re-enabled', await isDisabled('#btn-primary'), false);
  assertEq('#btn-primary label', await textOf('#btn-primary'), '⚠ 执行迁移');
  assertEq('RP-1 stays visible', await exists('#rp-list .rp-card[data-rp="RP-1"]'), true);
  const topLi = await evalExpr(`(function(){var li=document.querySelector('#ledger-list li:first-child');return li?{cls:li.className,txt:li.textContent.replace(/\\s+/g," ").trim()}:null;})()`);
  assert('ledger top ↺ recover entry', topLi !== null && topLi.cls.includes('is-recover') && topLi.txt.includes('↺') && topLi.txt.includes('已从恢复点 RP-1 恢复'), 'is-recover + ↺ + 已从恢复点 RP-1 恢复', topLi);
  b = await badges();
  assertEq('badges', b, ['核验 12/21', '确认门 0/3', '恢复点 1 可用', '流程 进行中']);
  await badgeLine(); await consoleLine();

  /* ---------------- M7: re-commit S4 -> RP-2; S5 gate -> RP-3; S6 direct; S7 final gate -> 07-final-gate ---------------- */
  curM = 'M7-final-gate';
  await clickSel('#btn-primary'); // S4 re-commit gate
  await sleep(60);
  assertEq('S4 gate hint MIGRATE', await textOf('.gate-pass label code'), 'MIGRATE');
  assertEq('S4 gate previews RP-2', await textOf('.gate-checkpoint .rp-ref'), 'RP-2');
  await gateFlow('MIGRATE');
  assertEq('RP-2 card in right panel', await exists('#rp-list .rp-card[data-rp="RP-2"]'), true);
  const rp2step = await textOf('#rp-list .rp-card[data-rp="RP-2"] .rp-step');
  assert('RP-2 belongs to S4', rp2step !== null && rp2step.includes('数据库迁移'), 'RP-2 = 数据库迁移 · 执行迁移前', rp2step);
  const topLed7 = await evalExpr(`(function(){var li=document.querySelector('#ledger-list li:first-child');return li?li.textContent.replace(/\\s+/g," ").trim():null;})()`);
  assert('ledger top mentions RP-2', topLed7 !== null && topLed7.includes('RP-2'), 'contains RP-2', topLed7);
  const rpState = await evalExpr(`[...document.querySelectorAll('#rp-list .rp-card')].map(function(c){return {rp:c.dataset.rp, cls:c.className, mark:(c.querySelector('.rp-mark')||{}).textContent||null};})`);
  logLine(`${ts()} | ${curM} | RP_SUPERSEDED_STATE ${J(rpState)}`);
  const navChipS4 = await textOf('.step-item[data-step="S4"] .st-rp');
  assert('RP-2 id visible in nav (S4 chip)', navChipS4 !== null && navChipS4.includes('RP-2'), 'contains RP-2', navChipS4);

  await clickSel('.step-item[data-step="S5"]');
  await checkAll('S5');
  assertEq('S5 btn label', await textOf('#btn-primary'), '⚠ 全量切换');
  await clickSel('#btn-primary');
  await sleep(60);
  assertEq('S5 gate hint CUTOVER', await textOf('.gate-pass label code'), 'CUTOVER');
  assertEq('S5 gate previews RP-3', await textOf('.gate-checkpoint .rp-ref'), 'RP-3');
  await gateFlow('CUTOVER');
  assertEq('RP-3 card exists', await exists('#rp-list .rp-card[data-rp="RP-3"]'), true);

  await clickSel('.step-item[data-step="S6"]');
  await checkAll('S6');
  assertEq('S6 btn label', await textOf('#btn-primary'), '标记验证通过');
  await clickSel('#btn-primary');
  await sleep(60);
  assertEq('S6 no gate (direct commit)', await exists('#modal-root .gate'), false);
  const s6meta = await textOf('.step-item[data-step="S6"] .st-meta');
  assert('S6 done', s6meta !== null && s6meta.includes('已完成'), 'contains 已完成', s6meta);

  await clickSel('.step-item[data-step="S7"]');
  await checkAll('S7');
  const s7label = await textOf('#btn-primary');
  assert('S7 btn 关闭归档（终局）', s7label !== null && s7label.includes('关闭归档（终局）'), 'contains 关闭归档（终局）', s7label);
  await clickSel('#btn-primary');
  await sleep(60);
  await shot('07-final-gate.png');
  assertEq('final gate hint CLOSE', await textOf('.gate-pass label code'), 'CLOSE');
  assertEq('final gate kicker', await textOf('.gate-kicker'), '⚠ 确认门 · 不可逆步骤');
  assertEq('final gate previews RP-4', await textOf('.gate-checkpoint .rp-ref'), 'RP-4');
  const rpSum = await evalExpr(`[...document.querySelectorAll('#rp-list .rp-card')].map(function(c){return c.dataset.rp + "=" + (c.querySelector('.rp-step')||{}).textContent;})`);
  logLine(`${ts()} | ${curM} | RP_SUMMARY_BEFORE_FINAL ${J(rpSum)}`);
  await badgeLine(); await consoleLine();

  /* ---------------- M8: CLOSE -> RP-4 + completion -> 08-completed ---------------- */
  curM = 'M8-completed';
  await gateFlow('CLOSE');
  await shot('08-completed.png');
  const banner = await textOf('.complete-banner h2');
  assert('green banner', banner !== null && banner.includes('流程完成 · 零失误走完全程'), 'contains 流程完成 · 零失误走完全程', banner);
  const chips = await evalExpr(`[...document.querySelectorAll('.complete-stats .stat-chip')].map(function(c){return c.textContent.replace(/\\s+/g," ").trim();})`);
  assert('stats 21/21', chips.some(c => c.startsWith('21/21')), 'chip 21/21核验项', chips);
  assert('stats 3/3 gates', chips.some(c => c.startsWith('3/3')), 'chip 3/3确认门通过', chips);
  assert('stats 4 RP', chips.some(c => c.startsWith('4恢复点')), 'chip 4恢复点', chips);
  assertEq('RP-4 card exists', await exists('#rp-list .rp-card[data-rp="RP-4"]'), true);
  b = await badges();
  assertEq('badges', b, ['核验 21/21', '确认门 3/3', '恢复点 4 可用', '流程 已完成']);
  const topLi2 = await evalExpr(`(function(){var li=document.querySelector('#ledger-list li:first-child');return li?{cls:li.className,txt:li.textContent.replace(/\\s+/g," ").trim()}:null;})()`);
  assert('ledger top 流程完成', topLi2 !== null && topLi2.txt.includes('流程完成 · 零失误走完全程'), 'contains 流程完成 · 零失误走完全程', topLi2);
  await badgeLine(); await consoleLine();

  /* ---------------- M9: keyboard (roving tabindex) -> 09-keyboard-focus ---------------- */
  curM = 'M9-keyboard-focus';
  await key({ key: 'Escape', code: 'Escape', vk: 27 });
  assertEq('Escape with nothing open: gate still absent', await exists('#modal-root .gate'), false);
  await key({ key: 'Tab', code: 'Tab', vk: 9 });
  let active = await evalExpr(`(function(){var el=document.activeElement;return {id:el.id||null,cls:el.className||null};})()`);
  assert('Tab1 from body reaches #btn-reset', active.id === 'btn-reset', '#btn-reset', active);
  await key({ key: 'Tab', code: 'Tab', vk: 9 });
  // only the selected step (S7 — all steps finished) is tabbable
  let focusInfo = await evalExpr(`(function(){var el=document.activeElement;return {tag:el.tagName,cls:el.className,step:el.dataset?el.dataset.step:null,t:el.getAttribute('tabindex'),fv:el.matches(':focus-visible')};})()`);
  assert('Tab2 lands on selected step S7 (roving tabindex)', focusInfo.cls.includes('step-item') && focusInfo.step === 'S7', '.step-item[data-step=S7] tabindex=0', focusInfo);
  assert('S7 :focus-visible ring', focusInfo.fv === true, true, focusInfo.fv);
  await key({ key: 'ArrowUp', code: 'ArrowUp', vk: 38 }); // moves focus + selection to adjacent S6
  focusInfo = await evalExpr(`(function(){var el=document.activeElement;return {tag:el.tagName,cls:el.className,step:el.dataset?el.dataset.step:null,t:el.getAttribute('tabindex'),fv:el.matches(':focus-visible')};})()`);
  assert('ArrowUp focuses adjacent S6', focusInfo.cls.includes('step-item') && focusInfo.step === 'S6', '.step-item[data-step=S6]', focusInfo);
  assert('S6 :focus-visible ring', focusInfo.fv === true, true, focusInfo.fv);
  const selState = await evalExpr(`(function(){var sel=document.querySelector('.step-item.is-selected');var s6=document.querySelector('.step-item[data-step="S6"]');return {selectedStep:sel?sel.dataset.step:null,s6AriaCurrent:s6?s6.getAttribute('aria-current'):null,s6Tabindex:s6?s6.getAttribute('tabindex'):null};})()`);
  assert('selection moved with focus to S6', selState.selectedStep === 'S6', 'S6', selState);
  assertEq('S6 aria-current=step', selState.s6AriaCurrent, 'step');
  assertEq('S6 tabindex now 0', selState.s6Tabindex, '0');
  await shot('09-keyboard-focus.png');
  await badgeLine(); await consoleLine();

  /* ---------------- M10: reset -> 10-reset ---------------- */
  curM = 'M10-reset';
  await clickSel('#btn-reset');
  await sleep(60);
  assertEq('reset dialog exists', await exists('#modal-root .gate.is-reset'), true);
  assertEq('reset kicker', await textOf('.gate-kicker'), '⟲ 重启演练');
  assertEq('reset passcode hint', await textOf('.gate-pass label code'), 'RESET');
  assertEq('#gate-confirm disabled before', await isDisabled('#gate-confirm'), true);
  await setPass('RESET');
  await clickSel('#gate-ack');
  assertEq('#gate-confirm enabled after', await isDisabled('#gate-confirm'), false);
  await clickSel('#gate-confirm');
  await sleep(80);
  await shot('10-reset.png');
  b = await badges();
  assertEq('badges reset', b, ['核验 0/21', '确认门 0/3', '恢复点 0 可用', '流程 进行中']);
  assertEq('rp empty state back', await exists('#rp-list .rp-empty'), true);
  const lis = await evalExpr(`[...document.querySelectorAll('#ledger-list li')].map(function(li){return {cls:li.className,txt:li.textContent.replace(/\\s+/g," ").trim()};})`);
  assertEq('ledger single reset entry', lis.length, 1);
  assert('reset entry content', lis.length === 1 && lis[0].cls.includes('is-reset') && lis[0].txt.includes('演练已重置'), 'is-reset + 演练已重置', lis);
  await badgeLine(); await consoleLine();

  /* ---------------- done ---------------- */
  logLine(`${ts()} | FINAL | fails=${fails.length}${fails.length ? ' :: ' + fails.join(' ;; ') : ''} | consoleIssues=${consoleIssues.length}`);
  for (const f of ['01-initial.png', '02-gate-modal.png', '03-gate-error.png', '04-committed-rp.png', '05-recover-gate.png', '06-recovered.png', '07-final-gate.png', '08-completed.png', '09-keyboard-focus.png', '10-reset.png']) {
    const p = path.join(EV, f);
    logLine(`${ts()} | PNG | ${f} | ${fs.existsSync(p) ? fs.statSync(p).size : 'MISSING'} bytes`);
  }
}

main().then(() => {
  try { ws && ws.close(); } catch {}
  try { proc && proc.kill(); } catch {}
  process.exit(fails.length ? 2 : 0);
}).catch(e => {
  logLine(`${ts()} | FATAL | ${e && e.stack || e}`);
  try { ws && ws.close(); } catch {}
  try { proc && proc.kill(); } catch {}
  process.exit(1);
});
