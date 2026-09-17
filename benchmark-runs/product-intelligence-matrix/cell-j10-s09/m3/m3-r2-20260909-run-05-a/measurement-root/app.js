'use strict';

/* ================= 工具 ================= */
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad2 = (n) => String(n).padStart(2, '0');
const nowTime = () => { const d = new Date(); return pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds()); };
const fmtDur = (ms) => { const s = Math.max(0, Math.floor(ms / 1000)); return pad2(Math.floor(s / 60)) + ':' + pad2(s % 60); };

/* 展平步骤（保留阶段名） */
const STEPS = [];
WORKFLOW.phases.forEach((ph) => ph.steps.forEach((st) => STEPS.push(Object.assign({}, st, { phaseName: ph.name }))));
const TOTAL = STEPS.length;
const IRR_TOTAL = STEPS.filter((s) => s.risk === 'irreversible').length;

/* ================= 状态 ================= */
let state = null;
let undoTimer = null;

function freshState() {
  return {
    runId: 'RUN-' + Math.random().toString(36).slice(2, 6).toUpperCase(),
    startedAt: Date.now(),
    endedAt: null,
    aborted: false,
    mistakes: 0,      // 失误：誊录/确认短语错误、判断与面板不符
    deviations: 0,    // 偏差：动用撤销窗口或人工恢复程序
    undoUsed: 0,
    recoveries: 0,
    view: 0,
    log: [],
    steps: STEPS.map(() => ({
      status: 'pending', // pending | blocked | armed | done | locked
      checks: {}, ack: false,
      gate: null, gatePassed: false,
      codeOk: {}, codeVal: {}, codeErr: {},
      phraseVal: '', recPhraseVal: '',
      recoveredAfterLock: false,
      undoEnd: 0, doneAt: null, execAt: null
    }))
  };
}

const rs = (i) => state.steps[i];
const curIdx = () => { for (let i = 0; i < TOTAL; i++) if (rs(i).status !== 'done' && rs(i).status !== 'locked') return i; return -1; };
const allDone = () => curIdx() === -1;
const runEnded = () => state.aborted || allDone();
const isCurrent = (i) => !runEnded() && i === curIdx();
const laterAdvanced = (i) => STEPS.some((_, j) => j > i && (rs(j).status === 'done' || rs(j).status === 'locked'));
const earlierLocked = (i) => STEPS.some((d, j) => j < i && d.risk === 'irreversible' && rs(j).status === 'locked');
const irrLockedCount = () => STEPS.filter((d, j) => d.risk === 'irreversible' && rs(j).status === 'locked').length;
const canRecover = (i) => STEPS[i].risk === 'irreversible' && rs(i).status === 'locked' && !laterAdvanced(i);

/* 当前步骤的未满足条件（文案数组，兼作护栏） */
function reqsMissing(i) {
  const d = STEPS[i], s = rs(i), out = [];
  const unticked = d.checks.filter((c) => c.type === 'check' && !s.checks[c.id]);
  if (unticked.length) out.push(unticked.length + ' 项核查未勾选');
  if (d.checks.some((c) => c.type === 'code' && !s.codeOk[c.id])) out.push('校验码未誊录核对');
  if (d.checks.some((c) => c.type === 'gate') && !s.gatePassed) out.push('安全核查未通过');
  if (d.risk !== 'normal' && !s.ack) out.push(d.risk === 'irreversible' ? '回退预案未阅读确认' : '风险提示未阅读确认');
  // 仅当本步骤因人工恢复而回退、且前序不可逆步骤仍处于生效态时才阻断（正常推进不受影响）
  if (earlierLocked(i) && s.recoveredAfterLock) out.push('存在已生效的前序不可逆步骤，须先按逆序恢复');
  return out;
}

/* ================= 审计日志 ================= */
const LOG_TAG = { info: '信息', done: '完成', exec: '执行', undo: '回退', rec: '恢复', mist: '失误', block: '阻断', lock: '生效', abort: '中止' };
function log(type, msg) { state.log.push({ t: nowTime(), type, msg }); renderLog(); }

/* ================= 动作 ================= */
function afterMutate() {
  const c = curIdx();
  if (c !== -1) state.view = c;
  renderAll();
}

function completeStep(i) {
  if (!isCurrent(i) || reqsMissing(i).length) return;
  const s = rs(i);
  s.status = 'done'; s.doneAt = nowTime();
  log('done', '完成 ' + STEPS[i].code + ' · ' + STEPS[i].title);
  if (allDone()) { state.endedAt = Date.now(); log('info', '全部步骤完成，生成本次执行判定'); }
  afterMutate();
}

function tryExecute(i) {
  if (!isCurrent(i)) return;
  const d = STEPS[i], s = rs(i);
  if (reqsMissing(i).length) return;
  const val = (s.phraseVal || '').trim();
  if (!val) return; // 空输入不判失误，提示补录
  if (val !== d.confirmPhrase) {
    state.mistakes++;
    s.phraseVal = '';
    log('mist', '确认短语不匹配（' + d.code + '），不可逆操作未执行，已计 1 次失误');
    renderAll();
    return;
  }
  s.execAt = nowTime();
  s.undoEnd = Date.now() + d.rollback.undoSeconds * 1000;
  s.status = 'armed';
  s.recoveredAfterLock = false;
  log('exec', '执行不可逆操作 ' + d.code + ' · ' + d.title);
  log('undo', '撤销窗口开启（' + d.rollback.undoSeconds + ' 秒）—— 现在回退无损');
  startUndoTimer();
  afterMutate();
}

function undoStep(i) {
  const s = rs(i);
  if (s.status !== 'armed') return;
  s.status = 'pending'; s.undoEnd = 0;
  state.deviations++; state.undoUsed++;
  log('undo', '使用撤销窗口回退 ' + STEPS[i].code + '（计入 1 项偏差），步骤回到待执行');
  afterMutate();
}

function clearLaterRecoveryFlags(i) {
  for (let k = i + 1; k < TOTAL; k++) rs(k).recoveredAfterLock = false;
}

function lockStep(i) {
  rs(i).status = 'locked';
  clearLaterRecoveryFlags(i);
  log('lock', '撤销窗口关闭，' + STEPS[i].code + ' 已正式生效 —— 静默回退通道关闭，仅余人工恢复程序 ' + STEPS[i].rollback.manual.code);
  if (allDone()) { state.endedAt = Date.now(); log('info', '全部步骤完成，生成本次执行判定'); }
  afterMutate();
}

function tryRecover(i) {
  const d = STEPS[i], s = rs(i);
  if (!canRecover(i)) return;
  const val = (s.recPhraseVal || '').trim();
  if (!val) return;
  if (val !== d.rollback.manual.phrase) {
    state.mistakes++; s.recPhraseVal = '';
    log('mist', '恢复程序确认短语不匹配（' + d.rollback.manual.code + '），已计 1 次失误');
    renderAll();
    return;
  }
  s.status = 'pending';
  s.recoveredAfterLock = true;
  state.deviations++; state.recoveries++;
  log('rec', '人工恢复程序 ' + d.rollback.manual.code + ' 执行完成：' + d.code + ' 回到待执行（计入 1 项偏差）');
  afterMutate();
}

function gateAnswer(i, ans) {
  const d = STEPS[i], s = rs(i);
  if (!isCurrent(i) || s.gatePassed) return;
  const gate = d.checks.find((c) => c.type === 'gate');
  s.gate = ans;
  if (ans === gate.expect) {
    s.gatePassed = true;
    log('done', STEPS[i].code + ' 安全核查通过（' + gate.label + ' → ' + (ans === 'yes' ? '是' : '否') + '）');
  } else {
    state.mistakes++;
    s.status = 'blocked';
    log('block', STEPS[i].code + ' 安全核查未通过：判断与值班面板数据不符，计 1 次失误，已阻断推进');
  }
  renderAll();
}

function recheck(i) {
  const s = rs(i);
  if (s.status !== 'blocked') return;
  s.status = 'pending';
  log('info', STEPS[i].code + ' 进入重新核查（对照值班面板后再作答）');
  renderAll();
}

function abortRun() {
  state.aborted = true;
  state.endedAt = Date.now();
  log('abort', '执行安全中止（安全停止）。本单已封存至审计日志。');
  renderAll();
}

/* ================= 撤销窗口计时 ================= */
function startUndoTimer() {
  if (undoTimer) clearInterval(undoTimer);
  undoTimer = setInterval(() => {
    const c = curIdx();
    if (c === -1 || rs(c).status !== 'armed') { clearInterval(undoTimer); undoTimer = null; return; }
    const remain = rs(c).undoEnd - Date.now();
    if (remain <= 0) { clearInterval(undoTimer); undoTimer = null; lockStep(c); return; }
    const bar = $('undoBar'), sec = $('undoSec');
    if (bar) bar.style.width = (remain / (STEPS[c].rollback.undoSeconds * 1000) * 100) + '%';
    if (sec) sec.textContent = (remain / 1000).toFixed(1);
  }, 100);
}

/* ================= 渲染 ================= */
function renderAll() { renderHeader(); renderMap(); renderStage(); renderLog(); }

function renderHeader() {
  const doneCount = STEPS.filter((_, i) => rs(i).status === 'done' || rs(i).status === 'locked').length;
  $('progressFill').style.width = (doneCount / TOTAL * 100) + '%';
  $('progressLabel').textContent = doneCount + ' / ' + TOTAL + ' 步';
  $('chipIrr').textContent = '不可逆 ' + irrLockedCount() + '/' + IRR_TOTAL;
  const cm = $('chipMistake'); cm.textContent = '失误 ' + state.mistakes; cm.className = 'chip' + (state.mistakes ? ' bad' : '');
  const cd = $('chipDeviation'); cd.textContent = '偏差 ' + state.deviations; cd.className = 'chip' + (state.deviations ? ' warn' : '');
  $('runChip').textContent = state.runId;
}

function tickTimer() {
  const end = state.endedAt || Date.now();
  $('chipTimer').textContent = fmtDur(end - state.startedAt);
}

function renderMap() {
  const c = curIdx();
  let html = '', i = 0;
  for (const ph of WORKFLOW.phases) {
    const start = i;
    const doneIn = ph.steps.filter((_, k) => rs(start + k).status === 'done' || rs(start + k).status === 'locked').length;
    html += '<div class="phase"><div class="phase-head"><b>' + esc(ph.name) + '</b><span>' + doneIn + ' / ' + ph.steps.length + '</span></div>';
    for (let k = 0; k < ph.steps.length; k++, i++) {
      const d = STEPS[i], s = rs(i);
      const cur = i === c && !runEnded();
      let dotCls = '', txt = '';
      if (s.status === 'done') { dotCls = 'done'; txt = '✓'; }
      else if (s.status === 'locked') { dotCls = 'locked'; txt = '●'; }
      else if (s.status === 'armed') { dotCls = 'armed'; txt = '◐'; }
      else if (s.status === 'blocked') { dotCls = 'blocked'; txt = '!'; }
      else if (cur) { dotCls = 'cur-dot'; }
      const rowCls = ['step-row',
        (s.status === 'done' || s.status === 'locked') ? 'done-row' : '',
        cur ? 'cur' : '',
        i === state.view ? 'sel' : ''].filter(Boolean).join(' ');
      html += '<button type="button" class="' + rowCls + '" data-idx="' + i + '">' +
        '<span class="dot ' + dotCls + '">' + txt + '</span>' +
        '<span class="st-body"><span class="st-code">' + esc(d.code) + '</span>' +
        '<span class="st-title">' + esc(d.title) + '</span></span>' +
        (d.risk === 'irreversible' ? '<span class="mini-irr">不可逆</span>' : '') +
        '</button>';
    }
    html += '</div>';
  }
  $('map').innerHTML = html;
  const sel = $('map').querySelector('.step-row.cur');
  if (sel) sel.scrollIntoView({ block: 'nearest' });
}

function renderLog() {
  const rows = state.log.slice().reverse().map((e) =>
    '<div class="log-row"><span class="lt t-' + e.type + '">' + LOG_TAG[e.type] + '</span>' +
    '<span class="ltime">' + e.t + '</span><span class="lmsg">' + esc(e.msg) + '</span></div>').join('');
  $('log').innerHTML = rows;
}

/* ---------- 主舞台 ---------- */
function panelHTML(d) {
  if (!d.panel) return '';
  return '<div class="panel"><div class="panel-title">值班面板 · 只读数据</div>' +
    d.panel.map((p) => '<div class="panel-row"><span class="k">' + esc(p.k) + '</span><span class="v' +
      (p.strong ? ' strong' : '') + (p.mono ? ' mono' : '') + '">' + esc(p.v) + '</span></div>').join('') +
    '</div>';
}

function checkRowsHTML(i, interactive) {
  const d = STEPS[i], s = rs(i);
  return d.checks.map((c) => {
    if (c.type === 'check') {
      const on = !!s.checks[c.id];
      return '<div class="check-row' + (on ? ' checked' : '') + '">' +
        '<input type="checkbox" id="ck-' + c.id + '" data-check="' + c.id + '"' + (on ? ' checked' : '') + (interactive ? '' : ' disabled') + '>' +
        '<label for="ck-' + c.id + '">' + esc(c.label) + '</label></div>';
    }
    if (c.type === 'code') {
      const ok = !!s.codeOk[c.id];
      return '<div class="check-row" style="flex-direction:column;align-items:stretch;gap:9px">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px">' +
        '<span>' + esc(c.label) + ' <span class="req">*</span></span>' +
        (ok ? '<span class="ok-mark">✓ 已核对</span>' : '') + '</div>' +
        '<div class="code-inline">' +
        '<input class="input" data-capture="code:' + c.id + '" placeholder="' + esc(c.placeholder || '') + '" value="' + esc(s.codeVal[c.id] || '') + '"' +
        ((ok || !interactive) ? ' disabled' : '') + ' autocomplete="off" spellcheck="false">' +
        (ok ? '' : '<button type="button" class="btn small ghost" data-action="code:' + c.id + '"' + (interactive ? '' : ' disabled') + '>校验</button>') +
        '</div>' +
        (s.codeErr[c.id] ? '<div class="err">✕ ' + esc(s.codeErr[c.id]) + '</div>' : '') +
        '</div>';
    }
    if (c.type === 'gate') {
      const passed = s.gatePassed;
      const dis = passed || !interactive;
      return '<div class="gate-row' + (passed ? ' passed' : '') + '">' +
        '<div class="gate-q"><b>核查提问</b>' + esc(c.label) + '</div>' +
        '<div class="gate-opts">' +
        '<button type="button" class="pill' + (s.gate === 'yes' ? ' on' : '') + '" data-action="gate:yes"' + (dis ? ' disabled' : '') + '>是</button>' +
        '<button type="button" class="pill' + (s.gate === 'no' ? ' on no' : '') + '" data-action="gate:no"' + (dis ? ' disabled' : '') + '>否</button>' +
        (passed ? '<span class="ok-mark">✓ 核查通过</span>' : '') +
        '</div></div>';
    }
    return '';
  }).join('');
}

function foldHTML(i, interactive) {
  const d = STEPS[i], s = rs(i);
  if (d.risk === 'normal' || !d.riskNote) return '';
  const irr = d.risk === 'irreversible';
  const ackText = irr ? '我已阅读并理解回退预案' : '我已阅读上述风险提示';
  let body = '<div class="fold-body"><p>' + esc(d.riskNote) + '</p>';
  if (irr) body += '<p style="margin-top:8px"><b style="color:#ffe1a1">回退预案：</b>' + esc(d.rollback.plan) + '</p>';
  body += '<div class="ack-row"><input type="checkbox" id="ack-' + i + '" data-ack="1"' + (s.ack ? ' checked' : '') + (interactive ? '' : ' disabled') + '>' +
    '<label for="ack-' + i + '"><span>' + ackText + '</span></label></div></div>';
  return '<details class="fold ' + (irr ? 'irr' : 'caution') + '"' + (s.ack ? ' open' : '') + '>' +
    '<summary>' + (irr ? '回退预案（必读）' : '风险提示（必读）') + '</summary>' + body + '</details>';
}

function badgeHTML(d) {
  const cls = d.risk === 'irreversible' ? 'danger' : d.risk === 'caution' ? 'warn' : 'ok';
  return '<span class="badge ' + cls + '">' + RISK[d.risk].label + '</span>';
}

function headHTML(d, badge, title) {
  return '<div class="card-head">' + badge + '<h2>' + esc(title) + '</h2></div>';
}

function renderStage() {
  const stage = $('stage');
  if (runEnded()) { stage.innerHTML = verdictHTML(); return; }
  const i = state.view, d = STEPS[i], s = rs(i);
  const cur = isCurrent(i);
  const riskCls = d.risk === 'irreversible' ? 'risk-irreversible' : d.risk === 'caution' ? 'risk-caution' : 'risk-normal';

  if (s.status === 'done') { stage.innerHTML = doneRecapHTML(i); return; }
  if (s.status === 'locked') { stage.innerHTML = lockedRecapHTML(i); return; }
  if (s.status === 'armed') { stage.innerHTML = armedHTML(i); startUndoTimer(); return; }
  if (cur && s.status === 'blocked') { stage.innerHTML = blockedHTML(i); return; }
  if (!cur) { stage.innerHTML = previewHTML(i); return; }

  /* 当前步骤 · 交互视图 */
  const missing = reqsMissing(i);
  const irr = d.risk === 'irreversible';
  let html = '<div class="card ' + riskCls + '">';
  html += '<div class="crumb">' + esc(d.phaseName) + ' · 第 ' + (i + 1) + ' / ' + TOTAL + ' 步</div>';
  html += headHTML(d, badgeHTML(d), d.code + ' · ' + d.title);
  html += '<p class="desc">' + esc(d.desc) + '</p>';
  html += panelHTML(d);
  html += '<div class="checks">' + checkRowsHTML(i, true) + '</div>';
  html += foldHTML(i, true);
  html += '<div class="actions">';
  if (irr) {
    const canExec = missing.length === 0;
    html += '<div class="req-hint ' + (canExec ? 'good' : 'bad') + '">' +
      (canExec ? '执行条件已满足。誊录确认短语后执行：执行后 ' + d.rollback.undoSeconds + ' 秒内可一键回退。'
               : '尚未满足：' + esc(missing.join('；'))) + '</div>';
    html += '<div class="phrase-block">' +
      '<div class="phrase-label">誊录确认短语 <code class="mono" style="color:#ffb3b3;font-weight:700">「' + esc(d.confirmPhrase) + '」</code>' +
      '<br>执行后进入 ' + d.rollback.undoSeconds + ' 秒撤销窗口；窗口关闭后仅能通过人工恢复程序 ' + esc(d.rollback.manual.code) + ' 回退。</div>' +
      '<div class="phrase-row">' +
      '<input class="input" id="phraseInput" data-capture="phrase" placeholder="' + esc(d.confirmPhrase) + '" value="' + esc(s.phraseVal) + '" autocomplete="off" spellcheck="false">' +
      '<button type="button" class="btn danger" data-action="execute"' + (canExec ? '' : ' disabled') + '>确认执行（不可逆）</button>' +
      '</div></div>';
  } else {
    const can = missing.length === 0;
    html += '<div class="req-hint ' + (can ? 'good' : 'bad') + '">' + (can ? '全部条件已满足。' : '尚未满足：' + esc(missing.join('；'))) + '</div>';
    html += '<button type="button" class="btn primary" data-action="complete"' + (can ? '' : ' disabled') + '>完成步骤</button>';
  }
  html += '</div></div>';
  stage.innerHTML = html;
}

function armedHTML(i) {
  const d = STEPS[i], s = rs(i);
  const remainMs = Math.max(0, s.undoEnd - Date.now());
  return '<div class="card risk-caution">' +
    '<div class="crumb">' + esc(d.phaseName) + '</div>' +
    '<div class="card-head"><span class="badge warn">执行中 · 撤销窗口</span><h2>' + esc(d.code) + ' · ' + esc(d.title) + '</h2></div>' +
    '<div class="armed-box">' +
    '<div class="armed-head">已执行 —— 撤销窗口进行中，现在回退无损</div>' +
    '<div class="undo-row"><div class="undo-bar-wrap"><div class="undo-bar" id="undoBar" style="width:' + (remainMs / (d.rollback.undoSeconds * 1000) * 100) + '%"></div></div>' +
    '<div class="undo-sec"><span id="undoSec">' + (remainMs / 1000).toFixed(1) + '</span> s</div></div>' +
    '<p>窗口关闭后，<b>' + esc(d.code) + '</b> 将正式生效。回退路径收窄为人工恢复程序 <b>' + esc(d.rollback.manual.code) + '</b>（需双人复核，计入偏差并写入审计日志）。</p>' +
    '<button type="button" class="btn warnline" data-action="undo">立即回退 · 计 1 项偏差</button>' +
    '</div>' +
    '<p class="desc" style="margin-bottom:0">已满足的执行条件保持勾选；回退后如需再次执行，须重新誊录确认短语。</p>' +
    '</div>';
}

function lockedRecapHTML(i) {
  const d = STEPS[i], s = rs(i), m = d.rollback.manual;
  let html = '<div class="card risk-irreversible">';
  html += '<div class="crumb">' + esc(d.phaseName) + '</div>';
  html += headHTML(d, '<span class="badge danger">不可逆 · 已生效</span>', d.code + ' · ' + d.title);
  html += '<div class="locked-banner">此操作已于 ' + esc(s.execAt || '') + ' 执行并生效，不可静默回退</div>';
  html += '<div class="checks">' + recapChecksHTML(i) + '</div>';
  html += '<div class="recovery"><h4>恢复路径 · ' + esc(m.title) + '</h4>';
  html += '<div class="rec-sub">生效后的唯一回退方式 · 需双人复核 · 执行将计入 1 项偏差并写入审计日志</div><ol>';
  m.steps.forEach((x) => { html += '<li>' + esc(x) + '</li>'; });
  html += '</ol>';
  if (canRecover(i)) {
    html += '<div class="rec-action">' +
      '<input class="input" data-capture="recphrase" placeholder="誊录：' + esc(m.phrase) + '" value="' + esc(s.recPhraseVal) + '" autocomplete="off" spellcheck="false">' +
      '<button type="button" class="btn warnline" data-action="recover">确认执行恢复程序</button></div>';
  } else {
    html += '<div class="rec-note">后续步骤已推进：须按逆序先恢复后续不可逆步骤，才能恢复本步骤。</div>';
  }
  html += '</div></div>';
  return html;
}

function recapChecksHTML(i) {
  const d = STEPS[i], s = rs(i);
  return d.checks.map((c) => {
    if (c.type === 'check') return '<div class="check-row checked"><span class="ok-mark">✓</span><label>' + esc(c.label) + '</label></div>';
    if (c.type === 'code') return '<div class="check-row checked"><span class="ok-mark">✓</span><label>' + esc(c.label) + '：' + esc(s.codeVal[c.id] || '') + '</label></div>';
    if (c.type === 'gate') return '<div class="check-row checked"><span class="ok-mark">✓</span><label>' + esc(c.label) + ' → ' + (s.gate === 'yes' ? '是' : '否') + '</label></div>';
    return '';
  }).join('');
}

function doneRecapHTML(i) {
  const d = STEPS[i];
  return '<div class="card risk-normal"><div class="crumb">' + esc(d.phaseName) + '</div>' +
    headHTML(d, '<span class="badge ok">已完成</span>', d.code + ' · ' + d.title) +
    '<p class="desc">于 ' + esc(rs(i).doneAt || '') + ' 完成。</p>' +
    '<div class="checks">' + recapChecksHTML(i) + '</div>' +
    '<div class="req-hint good">已进入下一步骤。点击左侧地图可随时回看本步骤。</div></div>';
}

function blockedHTML(i) {
  const d = STEPS[i], s = rs(i);
  const gate = d.checks.find((c) => c.type === 'gate');
  return '<div class="card risk-caution">' +
    '<div class="crumb">' + esc(d.phaseName) + '</div>' +
    headHTML(d, '<span class="badge warn">已阻断</span>', d.code + ' · ' + d.title) +
    '<div class="blocked-box">' +
    '<h3>安全核查未通过 —— 已阻断推进</h3>' +
    '<p>' + esc(gate.label) + ' → <b style="color:#ffe1a1">' + (s.gate === 'yes' ? '是' : '否') + '</b>，与值班面板数据不符，已计 1 次失误。</p>' +
    '<p>' + esc(gate.blockedGuidance) + '</p>' +
    '<div class="blocked-actions">' +
    '<button type="button" class="btn primary" data-action="recheck">重新核查（对照面板后作答）</button>' +
    '<button type="button" class="btn warnline" data-action="abort">标记安全中止</button>' +
    '</div></div>' +
    panelHTML(d) +
    '</div>';
}

function previewHTML(i) {
  const d = STEPS[i];
  const cls = d.risk === 'irreversible' ? 'risk-irreversible' : d.risk === 'caution' ? 'risk-caution' : 'risk-normal';
  return '<div class="card dim ' + cls + '">' +
    '<div class="crumb">' + esc(d.phaseName) + ' · 待解锁</div>' +
    headHTML(d, badgeHTML(d), d.code + ' · ' + d.title) +
    '<p class="desc">' + esc(d.desc) + '</p>' +
    '<div class="req-hint">完成前序步骤后解锁。</div></div>';
}

/* ---------- 完成判定 ---------- */
function statTiles() {
  const dur = fmtDur((state.endedAt || Date.now()) - state.startedAt);
  const t = (n, l, cls) => '<div class="v-stat"><div class="n ' + (cls || '') + '">' + n + '</div><div class="l">' + l + '</div></div>';
  return t(dur, '总用时') +
    t(TOTAL, '总步骤') +
    t(irrLockedCount() + ' / ' + IRR_TOTAL, '不可逆生效', irrLockedCount() ? 'warn' : '') +
    t(state.undoUsed, '撤销回退', state.undoUsed ? 'warn' : 'good') +
    t(state.recoveries, '人工恢复', state.recoveries ? 'warn' : 'good') +
    t(state.mistakes, '失误', state.mistakes ? 'bad' : 'good') +
    t(state.deviations, '偏差', state.deviations ? 'warn' : 'good');
}

function verdictHTML() {
  if (state.aborted) {
    return '<div class="card"><div class="verdict">' +
      '<div class="v-ico">⛔</div><h2>已安全中止</h2>' +
      '<div class="v-sub">安全停止是本流程的设计路径：阻断状态下不放任何流量、不做任何不可逆操作。本单已封存至审计日志，可截图归档复盘。</div>' +
      '<div class="v-stats">' + statTiles() + '</div>' +
      '<div class="v-actions"><button type="button" class="btn primary" data-action="restart2">重新开始</button></div>' +
      '<div class="v-note">执行编号 ' + esc(state.runId) + ' · ' + esc(WORKFLOW.id) + '</div>' +
      '</div></div>';
  }
  const clean = state.mistakes === 0 && state.deviations === 0;
  const ico = clean ? '🏆' : (state.mistakes === 0 ? '✅' : '⚠️');
  const title = clean ? '零失误完成' : (state.mistakes === 0 ? '完成 · 含偏差' : '完成 · 含失误');
  const sub = clean
    ? '全程 ' + TOTAL + ' 步（含 ' + IRR_TOTAL + ' 个不可逆步骤）零失误走完：所有核查如实作答、确认短语一次誊录正确、未动用任何回退通道。本记录可直接归档。'
    : (state.mistakes === 0
      ? '走完全程且无执行失误，但动用了 ' + state.deviations + ' 项回退 / 恢复通道（撤销窗口或人工恢复程序）。'
      : '走完全程，但过程中有 ' + state.mistakes + ' 次失误（誊录 / 判断错误）与 ' + state.deviations + ' 项偏差。风险均被护栏拦在生效之前，请对照审计日志复盘。');
  return '<div class="card"><div class="verdict">' +
    '<div class="v-ico">' + ico + '</div><h2>' + title + '</h2>' +
    '<div class="v-sub">' + sub + '</div>' +
    '<div class="v-stats">' + statTiles() + '</div>' +
    '<div class="v-actions"><button type="button" class="btn primary" data-action="restart2">重新开始</button></div>' +
    '<div class="v-note">执行编号 ' + esc(state.runId) + ' · ' + esc(WORKFLOW.id) + ' · 完整审计日志见右侧</div>' +
    '</div></div>';
}

/* ================= 事件 ================= */
function onStageClick(e) {
  const btn = e.target.closest('[data-action]');
  if (!btn || btn.disabled) return;
  const act = btn.dataset.action;
  const i = state.view;
  if (act === 'complete') completeStep(i);
  else if (act === 'execute') tryExecute(i);
  else if (act === 'undo') undoStep(i);
  else if (act === 'recover') tryRecover(i);
  else if (act === 'recheck') recheck(i);
  else if (act === 'abort') abortRun();
  else if (act === 'restart2') newRun();
  else if (act.indexOf('gate:') === 0) gateAnswer(i, act.slice(5));
  else if (act.indexOf('code:') === 0) submitCode(i, act.slice(5));
}

function submitCode(i, cid) {
  const d = STEPS[i], s = rs(i);
  const c = d.checks.find((x) => x.id === cid);
  if (!c || s.codeOk[cid] || !isCurrent(i)) return;
  const val = (s.codeVal[cid] || '').trim();
  if (!val) return;
  if (val === c.expect) {
    s.codeOk[cid] = true; s.codeErr[cid] = '';
    log('info', STEPS[i].code + ' 「' + c.label + '」核对通过');
  } else {
    state.mistakes++;
    s.codeErr[cid] = '校验码不匹配（输入 ' + val + '），已计 1 次失误，请重新誊录';
    log('mist', STEPS[i].code + ' 誊录校验码不匹配，已计 1 次失误');
  }
  renderAll();
}

function onStageChange(e) {
  const t = e.target, i = state.view;
  if (!isCurrent(i)) return;
  if (t.dataset && t.dataset.check) { rs(i).checks[t.dataset.check] = t.checked; renderAll(); }
  else if (t.dataset && t.dataset.ack) {
    rs(i).ack = t.checked;
    if (t.checked) log('info', STEPS[i].code + (STEPS[i].risk === 'irreversible' ? ' 已阅读并确认回退预案' : ' 已阅读并确认风险提示'));
    renderAll();
  }
}

function onStageInput(e) {
  const t = e.target, cap = t.dataset && t.dataset.capture;
  if (!cap) return;
  const s = rs(state.view);
  if (cap === 'phrase') s.phraseVal = t.value;
  else if (cap === 'recphrase') s.recPhraseVal = t.value;
  else if (cap.indexOf('code:') === 0) s.codeVal[cap.slice(5)] = t.value;
}

function onStageKeydown(e) {
  if (e.key !== 'Enter') return;
  const t = e.target;
  if (t.dataset && t.dataset.capture) {
    const row = t.closest('.phrase-row, .rec-action, .code-inline');
    const btn = row && row.querySelector('button');
    if (btn && !btn.disabled) btn.click();
  }
}

/* ================= 启动 ================= */
function newRun() {
  if (undoTimer) { clearInterval(undoTimer); undoTimer = null; }
  state = freshState();
  log('info', '执行开始 ' + state.runId + ' · ' + WORKFLOW.id + '（' + WORKFLOW.meta + '）');
  renderAll();
  tickTimer();
}

function init() {
  $('map').addEventListener('click', (e) => {
    const b = e.target.closest('.step-row');
    if (!b) return;
    state.view = +b.dataset.idx;
    renderAll();
  });
  const stage = $('stage');
  stage.addEventListener('click', onStageClick);
  stage.addEventListener('change', onStageChange);
  stage.addEventListener('input', onStageInput);
  stage.addEventListener('keydown', onStageKeydown);
  $('btnRestart').addEventListener('click', () => $('modal').classList.remove('hidden'));
  $('modalCancel').addEventListener('click', () => $('modal').classList.add('hidden'));
  $('modal').addEventListener('click', (e) => { if (e.target === $('modal')) $('modal').classList.add('hidden'); });
  $('modalOk').addEventListener('click', () => { $('modal').classList.add('hidden'); newRun(); });
  newRun();
  setInterval(tickTimer, 500);
}

init();
