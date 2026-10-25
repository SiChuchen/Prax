/* ============================================================
   护航台 · 高后果流程执行台 — 应用逻辑（零依赖原生 JS）
   结构：PAT-LIST-DETAIL（阶段→步骤列表 / 当前步骤详情 / 留痕）
   门控：顺序解锁；不可逆步骤经确认关卡（回滚方案 + 确认项 + 发布单号）；
   执行后进入回滚窗口（收尾前始终可回滚）；全部变迁写入留痕。
   ============================================================ */
"use strict";

/* ---------- 数据派生 ---------- */
var ALL_STEPS = [];
RELEASE.phases.forEach(function (phase, pi) {
  phase.steps.forEach(function (step, si) {
    ALL_STEPS.push(Object.assign({}, step, {
      phaseId: phase.id, phaseName: phase.name, phaseIndex: pi, localIndex: si
    }));
  });
});
var TOTAL = ALL_STEPS.length;
var ORDER = {}; ALL_STEPS.forEach(function (s, i) { ORDER[s.id] = i; });
var IRREVERSIBLE = ALL_STEPS.filter(function (s) { return s.reversibility === "irreversible"; });
var TICKET = RELEASE.ticket;

/* ---------- 图标（内联 SVG） ---------- */
var I = {
  lock: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>',
  check: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>',
  circleDot: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.6" fill="currentColor" stroke="none"/></svg>',
  play: '<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15l13-7.5z"/></svg>',
  warn: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>',
  undo: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7v6h6"/><path d="M3 13a9 9 0 1 0 3-7.7L3 8"/></svg>',
  info: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8h.01"/><path d="M12 12v5"/></svg>',
  bolt: '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13 2 3 14h7l-1 8 11-13h-7z"/></svg>'
};

/* ---------- 状态 ---------- */
function freshStepState() {
  var m = {};
  ALL_STEPS.forEach(function (s) {
    m[s.id] = { checks: s.checklist.map(function () { return false; }), done: false, executed: false, rolledBack: false };
  });
  return m;
}
function createState() {
  return {
    steps: freshStepState(),
    selectedId: ALL_STEPS[0].id,
    gateOpenFor: null,
    gateAcks: {},
    gateCode: "",
    gateError: "",
    events: [],
    startedAt: null,
    completedAt: null,
    resetArmed: false,
    resetTimer: null
  };
}
var state = createState();

/* ---------- 状态派生 ---------- */
function stepById(id) { return ALL_STEPS[ORDER[id]]; }
function st(id) { return state.steps[id]; }
function isComplete(id) { var s = st(id); return s.done || s.executed; }
function activeIndex() {
  for (var i = 0; i < TOTAL; i++) if (!isComplete(ALL_STEPS[i].id)) return i;
  return TOTAL; /* 全部完成 */
}
function activeStep() { return activeIndex() < TOTAL ? ALL_STEPS[activeIndex()] : null; }
function isLocked(id) { return ORDER[id] > activeIndex(); }
function flowCompleted() { return activeIndex() >= TOTAL; }
function progressCount() { return ALL_STEPS.filter(function (s) { return isComplete(s.id); }).length; }
function remainingIrreversible() {
  return IRREVERSIBLE.filter(function (s) { return !isComplete(s.id); }).length;
}
function rollbackCount() { return state.events.filter(function (e) { return e.type === "rollback"; }).length; }
function lastExecutedIrreversible() {
  var found = null;
  ALL_STEPS.forEach(function (s) { if (s.reversibility === "irreversible" && st(s.id).executed) found = s; });
  return found;
}
function phaseProgress(phase) {
  var done = 0;
  phase.steps.forEach(function (s) { if (isComplete(s.id)) done++; });
  return done + "/" + phase.steps.length;
}
function checksDone(id) {
  var s = st(id), n = 0;
  s.checks.forEach(function (c) { if (c) n++; });
  return n;
}

/* ---------- 留痕 ---------- */
function nowTime() {
  var d = new Date();
  function p(n) { return (n < 10 ? "0" : "") + n; }
  return p(d.getHours()) + ":" + p(d.getMinutes()) + ":" + p(d.getSeconds());
}
function addEvent(type, stepId, text) {
  if (!state.startedAt) state.startedAt = Date.now();
  if (state.events.length === 0) {
    state.events.push({ t: nowTime(), type: "start", stepId: null, text: "流程开始：" + RELEASE.title + "（发布单号 " + TICKET + "）" });
  }
  state.events.push({ t: nowTime(), type: type, stepId: stepId, text: text });
}

/* ---------- 渲染 ---------- */
function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }

function riskBadge(step) {
  if (step.reversibility === "irreversible")
    return '<span class="badge badge-critical">' + I.bolt + ' 高危 · 不可逆</span>';
  if (step.risk === "caution") return '<span class="badge badge-caution">需谨慎</span>';
  if (step.risk === "critical") return '<span class="badge badge-critical">高危</span>';
  return '<span class="badge badge-normal">常规</span>';
}
function statusBadge(id) {
  var s = st(id), step = stepById(id);
  if (s.rolledBack) return '<span class="badge badge-status is-rolledback">' + I.undo + ' 已回滚 · 可重新执行</span>';
  if (s.executed) return '<span class="badge badge-status is-executed">' + (flowCompleted() ? "已执行" : "已执行 · 回滚窗口开启") + '</span>';
  if (s.done) return '<span class="badge badge-status is-done">' + I.check + ' 已完成</span>';
  if (isLocked(id)) return '<span class="badge badge-status">未解锁</span>';
  return '<span class="badge badge-status">待执行</span>';
}
function stepIcon(id) {
  var s = st(id);
  if (s.rolledBack) return I.undo;
  if (s.executed) return I.warn;
  if (s.done) return I.check;
  if (isLocked(id)) return I.lock;
  if (ORDER[id] === activeIndex()) return I.play;
  return I.circleDot;
}

function renderHeader() {
  var done = progressCount(), pct = Math.round(done / TOTAL * 100);
  var chips = "";
  if (flowCompleted()) {
    chips += '<span class="chip chip-ok">' + I.check + ' 发布完成</span>';
  }
  if (rollbackCount() > 0) {
    chips += '<span class="chip chip-violet">' + I.undo + ' 回滚 ' + rollbackCount() + ' 次</span>';
  }
  chips += '<span class="chip chip-danger">' + I.bolt + ' 剩余不可逆 ' + remainingIrreversible() + '</span>';
  document.getElementById("region-header").innerHTML =
    '<div class="hdr-left">' +
      '<div class="brand"><span class="brand-mark">护航台</span><span class="brand-sub">高后果流程执行台</span></div>' +
      '<div class="flow-title"><span class="flow-name">' + esc(RELEASE.title) + '</span>' +
      '<span class="ticket-badge">' + esc(TICKET) + '</span></div>' +
    '</div>' +
    '<div class="hdr-right">' + chips +
      '<div class="progress-block"><div class="progress-meta"><span>总进度 <b>' + done + '/' + TOTAL + '</b></span><span>' + pct + '%</span></div>' +
      '<div class="progress-bar"><i style="width:' + pct + '%"></i></div></div>' +
      '<button class="btn btn-sm ' + (state.resetArmed ? "btn-danger-solid" : "btn-ghost") + '" data-action="reset" data-fk="act:reset">' +
      (state.resetArmed ? "再次点击确认重置" : "重置流程") + '</button>' +
    '</div>';
}

function renderRail() {
  var act = activeStep();
  var html = '<div class="rail-title">流程进度 · 单行道</div>';
  RELEASE.phases.forEach(function (phase, pi) {
    html += '<div class="phase">' +
      '<div class="phase-head"><span class="phase-idx">P' + (pi + 1) + '</span>' +
      '<span class="phase-name">' + esc(phase.name) + '</span>' +
      '<span class="phase-count">' + phaseProgress(phase) + '</span></div>';
    phase.steps.forEach(function (step) {
      var cls = "step";
      if (step.id === state.selectedId) cls += " is-selected";
      if (act && step.id === act.id) cls += " is-active";
      if (isLocked(step.id)) cls += " is-locked";
      if (st(step.id).done) cls += " is-done";
      if (st(step.id).executed) cls += " is-executed";
      if (st(step.id).rolledBack) cls += " is-rolledback";
      html += '<button class="' + cls + '" tabindex="' + (step.id === state.selectedId ? "0" : "-1") + '" data-action="select" data-id="' + step.id + '" data-fk="step:' + step.id + '"' +
        (step.id === state.selectedId ? ' aria-current="true"' : '') +
        ' title="' + esc(step.name) + '">' +
        '<span class="step-ico">' + stepIcon(step.id) + '</span>' +
        '<span class="step-body"><span class="step-name">' + esc(step.name) + '</span>' +
        (step.reversibility === "irreversible" ? '<span class="mini-flag">不可逆 · 有回滚预案</span>' : '') +
        '</span></button>';
    });
    html += '</div>';
  });
  document.getElementById("region-step-rail").innerHTML = html;
}

function checklistHtml(step, interactive) {
  var s = st(step.id);
  var lis = s.checks.map(function (on, i) {
    return '<li><label class="check-item' + (on ? " is-on" : "") + '">' +
      '<input type="checkbox" data-change="check" data-id="' + step.id + '" data-index="' + i + '" data-fk="chk:' + step.id + ':' + i + '"' +
      (on ? " checked" : "") + (interactive ? "" : " disabled") + '>' +
      '<span class="txt">' + esc(step.checklist[i]) + '</span></label></li>';
  }).join("");
  return '<ul class="check-list">' + lis + '</ul>' +
    '<div class="check-progress">核对进度 ' + checksDone(step.id) + '/' + s.checks.length + '</div>';
}

function rollbackBlockHtml(step, opts) {
  var rb = step.rollback;
  var ol = rb.steps.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("");
  return '<div class="block block-amber"><h3>' + I.undo + ' 回滚方案（恢复路径）' + (opts && opts.titleSuffix ? " · " + opts.titleSuffix : "") + '</h3>' +
    '<p class="rb-title"><b>' + esc(rb.title) + '</b></p>' +
    '<p class="rb-cost">' + esc(rb.cost) + '</p>' +
    '<ol>' + ol + '</ol></div>';
}

function completionCardHtml() {
  var rb = rollbackCount();
  var used = "";
  if (state.startedAt && state.completedAt) {
    var sec = Math.max(0, Math.round((state.completedAt - state.startedAt) / 1000));
    used = Math.floor(sec / 60) + " 分 " + (sec % 60) + " 秒";
  }
  var badge = rb === 0
    ? '<div class="block block-ok" style="margin:0 auto 18px;max-width:420px"><h3>' + I.check + ' 全程零回滚</h3><p>未触发任何恢复路径，零失误走完全程。</p></div>'
    : '<div class="block block-violet" style="margin:0 auto 18px;max-width:420px"><h3>' + I.undo + ' 触发回滚 ' + rb + ' 次</h3><p>恢复路径已按预案执行，流程仍完整走完；复演可挑战零回滚。</p></div>';
  return '<div class="done-card">' +
    '<span class="badge badge-critical">' + IRREVERSIBLE.length + ' 个不可逆步骤全部经确认关卡执行</span>' +
    '<h2>发布完成 🎉</h2><p class="sub">' + esc(RELEASE.title) + ' · 发布单号 ' + esc(TICKET) + '</p>' +
    '<div class="done-stats">' +
      '<div class="stat"><div class="v">' + TOTAL + '/' + TOTAL + '</div><div class="k">步骤完成</div></div>' +
      '<div class="stat"><div class="v">' + IRREVERSIBLE.length + '</div><div class="k">不可逆执行</div></div>' +
      '<div class="stat"><div class="v">' + rb + '</div><div class="k">回滚次数</div></div>' +
      (used ? '<div class="stat"><div class="v">' + used + '</div><div class="k">全程用时</div></div>' : '') +
    '</div>' + badge +
    '<div class="done-actions">' +
      '<button class="btn" data-action="copy-audit" data-fk="act:copy2">复制留痕摘要</button>' +
      '<button class="btn btn-ghost" data-action="reset" data-fk="act:reset2">重新演练（重置）</button>' +
    '</div></div>';
}

function renderDetail() {
  var box = document.getElementById("region-step-detail");
  var step = stepById(state.selectedId);
  var s = st(step.id);
  var act = activeStep();
  var isActive = act && act.id === step.id;
  var html = "";

  if (flowCompleted()) html += completionCardHtml();

  html += '<div class="crumbs">P' + (step.phaseIndex + 1) + ' · <b>' + esc(step.phaseName) + '</b> · 步骤 ' + (ORDER[step.id] + 1) + '/' + TOTAL + '</div>';
  html += '<div class="detail-head"><h2>' + esc(step.name) + '</h2>' +
    '<div class="badges">' + riskBadge(step) + statusBadge(step.id) + '</div></div>';

  if (isLocked(step.id)) {
    var prev = ALL_STEPS[activeIndex()];
    html += '<div class="locked-note">' + I.lock + '<span><b>此步骤尚未解锁。</b>单行道执行：需先完成「' + esc(prev.name) + '」后自动解锁，不可跳步。</span></div>';
  }

  /* 已执行不可逆步骤：回滚窗口（收尾前始终可达的恢复路径） */
  if (s.executed && !flowCompleted()) {
    var rbOl = step.rollback.steps.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("");
    html += '<div class="section"><div class="block block-amber"><h3>' + I.warn + ' 已执行 · 回滚窗口开启中（收尾前可回滚）</h3>' +
      '<p><b>' + esc(step.rollback.title) + '</b> · <span class="rb-cost">' + esc(step.rollback.cost) + '</span></p>' +
      '<ol>' + rbOl + '</ol></div>' +
      '<div class="action-bar" style="margin-top:12px;padding-top:12px;border-top:0;">' +
      '<button class="btn btn-danger-outline" data-action="rollback" data-id="' + step.id + '" data-fk="act:rb:' + step.id + '">' + I.undo + ' 回滚此步骤（级联复位后续步骤）</button>' +
      '<span class="action-hint">回滚将写入留痕，并复位该步骤及其后所有已完成步骤。</span></div></div>';
  }
  if (s.rolledBack) {
    html += '<div class="section"><div class="block block-violet"><h3>' + I.undo + ' 已回滚</h3><p>该步骤及其后步骤已按恢复路径复位，可在满足条件后重新执行。</p></div></div>';
  }

  html += '<div class="section"><h3>操作指引</h3><ol class="guide-list">' +
    step.guide.map(function (g) { return "<li>" + esc(g) + "</li>"; }).join("") + '</ol></div>';

  html += '<div class="section"><h3>核对清单' + (isActive ? "" : "（只读）") + '</h3>' +
    checklistHtml(step, isActive && !s.done && !s.executed) + '</div>';

  html += '<div class="section"><h3>预期结果</h3><div class="block block-info"><div class="expected">' + I.info +
    '<span>' + esc(step.expected) + '</span></div></div></div>';

  /* 不可逆预告：执行前即可预览后果与回滚方案 */
  if (step.reversibility === "irreversible" && !s.done && !s.executed) {
    html += '<div class="section"><div class="block block-danger"><h3>' + I.bolt + ' 不可逆操作 · 执行前须知</h3>' +
      '<p>' + esc(step.consequence) + '</p>' +
      '<p class="rb-title"><b>恢复路径：</b>' + esc(step.rollback.title) + ' · <span class="rb-cost">' + esc(step.rollback.cost) + '</span></p>' +
      '<p>执行时将打开确认关卡：需逐项勾选确认、输入发布单号 <code>' + esc(TICKET) + '</code> 后方可放行。</p></div></div>';
  }

  /* 动作区 */
  if (isActive && !s.done && !s.executed) {
    var label = step.kind === "finalize" ? "关闭变更单，完成发布"
      : step.kind === "verify" ? "确认验证通过"
      : "标记完成";
    if (step.reversibility === "irreversible") {
      html += '<div class="action-bar">' +
        '<button class="btn btn-danger-solid btn-lg" data-action="open-gate" data-id="' + step.id + '" data-fk="act:exec:' + step.id + '">' + I.bolt + ' 执行不可逆操作…</button>' +
        '<span class="action-hint">先完成核对清单（' + checksDone(step.id) + '/' + s.checks.length + '），执行前将强制通过确认关卡。</span></div>';
    } else {
      var ready = checksDone(step.id) === s.checks.length;
      html += '<div class="action-bar">' +
        '<button class="btn btn-primary btn-lg" data-action="complete" data-id="' + step.id + '" data-fk="act:done:' + step.id + '"' + (ready ? "" : " disabled") + '>' +
        (step.kind === "verify" ? I.check + " " : "") + label + '</button>' +
        '<span class="action-hint">' + (ready ? "全部核对项已勾选，可完成本步骤。" : "请先完成全部核对项（" + checksDone(step.id) + "/" + s.checks.length + "）。") + '</span></div>';
    }
  } else if (s.done) {
    html += '<div class="action-bar"><span class="action-hint">' + I.check + ' 本步骤已完成。' + (flowCompleted() ? "" : "回滚窗口提示见流程内已执行的不可逆步骤。") + '</span></div>';
  } else if (s.executed) {
    /* 回滚窗口块已在上方渲染 */
  } else if (isLocked(step.id)) {
    html += '<div class="action-bar"><span class="action-hint">解锁后可执行本步骤。</span></div>';
  }

  /* 活动步骤处的回滚窗口提示（恢复路径始终可达） */
  if (isActive && !flowCompleted()) {
    var ex = lastExecutedIrreversible();
    if (ex && ex.id !== step.id) {
      html += '<div class="section"><div class="block block-amber"><h3>' + I.undo + ' 回滚窗口</h3>' +
        '<p>「' + esc(ex.name) + '」已执行且仍在回滚窗口内（收尾前可回滚）。</p>' +
        '<button class="btn btn-sm btn-danger-outline" data-action="select" data-id="' + ex.id + '" data-fk="act:goto:' + ex.id + '">查看回滚方案</button></div></div>';
    }
  }

  box.innerHTML = html;
}

function evBadge(type) {
  var map = {
    start: ["ev-start", "流程"], complete: ["ev-complete", "完成"],
    verify: ["ev-verify", "验证通过"], confirm: ["ev-confirm", "确认"],
    execute: ["ev-execute", "执行"], rollback: ["ev-rollback", "回滚"]
  };
  var m = map[type] || ["ev-start", type];
  return '<span class="ev-badge ' + m[0] + '">' + m[1] + '</span>';
}

function renderAudit() {
  var items = state.events.slice().reverse().map(function (e) {
    var name = e.stepId ? stepById(e.stepId).name : "";
    var text = e.text;
    return '<li class="audit-item"><span class="audit-ico">' + I.circleDot + '</span>' +
      '<div class="audit-main"><div class="audit-text">' + esc(text) + '</div>' +
      '<div class="audit-meta">' + evBadge(e.type) + (name && e.type !== "start" ? '<span class="audit-time">' + esc(name) + '</span>' : '') +
      '<span class="audit-time">' + e.t + '</span></div></div></li>';
  }).join("");
  document.getElementById("region-audit").innerHTML =
    '<div class="audit-head"><h2>操作留痕</h2><span class="audit-count">' + state.events.length + ' 条</span></div>' +
    '<div class="audit-tools">' +
    '<button class="btn btn-sm" data-action="copy-audit" data-fk="act:copy"' + (state.events.length ? "" : " disabled") + '>复制</button>' +
    '<button class="btn btn-sm" data-action="export-audit" data-fk="act:export"' + (state.events.length ? "" : " disabled") + '>导出 JSON</button></div>' +
    (state.events.length ? '<ul class="audit-list">' + items + '</ul>'
      : '<div class="audit-empty">尚无操作记录。<br>完成第一个步骤后，所有执行、确认、回滚动作都会在此留痕。</div>');
}

/* ---------- 确认关卡 ---------- */
function gateStep() { return state.gateOpenFor ? stepById(state.gateOpenFor) : null; }
function gateAcksAll() {
  var step = gateStep();
  if (!step) return false;
  for (var i = 0; i < step.acks.length; i++) if (!state.gateAcks[i]) return false;
  return true;
}
function gateCodeOk() { return state.gateCode.trim() === TICKET; }
function gateReady() { return gateAcksAll() && gateCodeOk(); }
function gateHint() {
  var step = gateStep();
  var n = step.acks.filter(function (_, i) { return state.gateAcks[i]; }).length;
  return "确认项 " + n + "/" + step.acks.length + " · 发布单号" + (gateCodeOk() ? "已匹配" : "未匹配");
}
function renderGate() {
  var root = document.getElementById("gate-root");
  var step = gateStep();
  if (!step) { root.innerHTML = ""; return; }
  var s = st(step.id);
  var impact = step.impact.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("");
  var acks = step.acks.map(function (a, i) {
    return '<label class="ack-item"><input type="checkbox" data-change="gate-ack" data-index="' + i + '"' +
      (state.gateAcks[i] ? " checked" : "") + '><span>' + esc(a) + '</span></label>';
  }).join("");
  root.innerHTML =
    '<div class="gate-overlay">' +
    '<div class="gate-dialog" role="dialog" aria-modal="true" aria-labelledby="gate-title" id="gate-dialog" tabindex="-1">' +
      '<div class="gate-head"><span class="gate-kicker">' + I.bolt + ' 不可逆操作 · 确认关卡</span>' +
      '<h2 id="gate-title">' + esc(step.name) + '</h2></div>' +
      '<div class="gate-scroll">' +
        '<div class="block block-danger"><h3>后果陈述</h3><p>' + esc(step.consequence) + '</p><ul>' + impact + '</ul></div>' +
        rollbackBlockHtml(step, { titleSuffix: "执行前确认" }) +
        '<div class="block"><h3>确认项（须全部勾选）</h3>' + acks + '</div>' +
        '<div class="block"><h3>发布单号确认</h3>' +
        '<p>输入发布单号 <code>' + esc(TICKET) + '</code> 以确认执行。</p>' +
        '<div class="code-row"><input class="code-input" type="text" data-input="gate-code" placeholder="输入发布单号" ' +
        'aria-label="发布单号确认" autocomplete="off" spellcheck="false"></div>' +
        (state.gateError ? '<p class="form-error" role="alert">' + I.warn + ' ' + esc(state.gateError) + '</p>' : '') +
        '</div>' +
      '</div>' +
      '<div class="gate-foot"><span class="gate-hint" id="gate-hint">' + gateHint() + '</span>' +
      '<div class="gate-foot-btns">' +
      '<button class="btn" data-action="gate-cancel" data-fk="act:gcancel">取消（无任何变更）</button>' +
      '<button class="btn btn-danger-solid" data-action="gate-confirm" data-fk="act:gconfirm"' + (s.done ? " disabled" : "") + '>确认执行</button>' +
      '</div></div>' +
    '</div></div>';
}
function openGate(id) {
  state.gateOpenFor = id;
  state.gateAcks = {};
  state.gateCode = "";
  state.gateError = "";
  addEvent("confirm", id, "打开确认关卡：" + stepById(id).name);
  render();
  var dlg = document.getElementById("gate-dialog");
  if (dlg) dlg.focus();
}
function cancelGate() {
  if (!state.gateOpenFor) return;
  var id = state.gateOpenFor;
  state.gateOpenFor = null;
  render();
  var btn = document.querySelector('[data-fk="act:exec:' + id + '"]');
  if (btn) btn.focus();
}
function confirmGate() {
  var step = gateStep();
  if (!step) return;
  if (!gateAcksAll() && !gateCodeOk()) state.gateError = "确认项未全部勾选，且发布单号不匹配。";
  else if (!gateAcksAll()) state.gateError = "确认项未全部勾选，无法执行。";
  else if (!gateCodeOk()) state.gateError = "发布单号不匹配，请核对后重新输入（" + TICKET + "）。";
  if (state.gateError) { renderGate(); return; }
  /* 放行执行 */
  state.gateOpenFor = null;
  var s = st(step.id);
  s.executed = true;
  s.rolledBack = false;
  s.checks = s.checks.map(function () { return true; });
  addEvent("confirm", step.id, "通过确认关卡（确认项 " + step.acks.length + "/" + step.acks.length + "，发布单号匹配）");
  addEvent("execute", step.id, "执行不可逆操作：" + step.name);
  advanceAfter(step.id);
}

/* ---------- 动作 ---------- */
function advanceAfter(id) {
  var act = activeStep();
  state.selectedId = act ? act.id : id;
  if (!act) state.completedAt = Date.now();
  render();
  var n = document.querySelector('[data-fk="step:' + state.selectedId + '"]');
  if (n) n.focus({ preventScroll: false });
}
function completeStep(id) {
  if (isLocked(id) || isComplete(id)) return;
  var step = stepById(id);
  if (checksDone(id) !== step.checklist.length) return;
  st(id).done = true;
  addEvent(step.kind === "verify" ? "verify" : "complete", id,
    (step.kind === "verify" ? "验证通过：" : "完成：") + step.name);
  advanceAfter(id);
}
function toggleCheck(id, idx) {
  if (isLocked(id) || isComplete(id)) return;
  var s = st(id);
  s.checks[idx] = !s.checks[idx];
  render();
}
function rollbackStep(id) {
  var step = stepById(id);
  if (!st(id).executed || flowCompleted()) return;
  var reset = 0;
  for (var i = ORDER[id]; i < TOTAL; i++) {
    var sid = ALL_STEPS[i].id, s = st(sid);
    if (isComplete(sid)) reset++;
    s.done = false; s.executed = false;
    s.checks = s.checks.map(function () { return false; });
    s.rolledBack = (sid === id);
  }
  state.completedAt = null;
  addEvent("rollback", id, "回滚「" + step.name + "」，按恢复路径复位其后 " + reset + " 个步骤");
  state.selectedId = id;
  render();
}
function doReset() {
  if (!state.resetArmed) {
    state.resetArmed = true;
    renderHeader();
    clearTimeout(state.resetTimer);
    state.resetTimer = setTimeout(function () { state.resetArmed = false; renderHeader(); }, 4000);
    return;
  }
  clearTimeout(state.resetTimer);
  state = createState();
  render();
}

/* ---------- 留痕导出 ---------- */
function auditSnapshot() {
  return {
    release: { ticket: TICKET, title: RELEASE.title, window: RELEASE.window },
    exportedAt: new Date().toISOString(),
    summary: {
      stepsTotal: TOTAL, stepsCompleted: progressCount(),
      irreversibleExecuted: IRREVERSIBLE.filter(function (s) { return st(s.id).executed; }).length,
      rollbacks: rollbackCount(),
      completed: flowCompleted()
    },
    events: state.events
  };
}
function copyAudit() {
  var lines = state.events.map(function (e) {
    return e.t + " [" + e.type + "] " + e.text;
  });
  var text = "操作留痕 — " + RELEASE.title + "（" + TICKET + "）\n" +
    "步骤完成 " + progressCount() + "/" + TOTAL + " · 回滚 " + rollbackCount() + " 次\n" +
    "----------------------------------------\n" + lines.join("\n");
  copyText(text);
  flashCopied();
}
function exportAudit() {
  var blob = new Blob([JSON.stringify(auditSnapshot(), null, 2)], { type: "application/json" });
  var a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "audit-" + TICKET + ".json";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
}
function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).catch(function () { fallbackCopy(text); });
    return;
  }
  fallbackCopy(text);
}
function fallbackCopy(text) {
  var ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed"; ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand("copy"); } catch (e) { /* 忽略：用户可改用导出 */ }
  ta.remove();
}
function flashCopied() {
  var btn = document.querySelector('[data-action="copy-audit"]');
  if (!btn) return;
  var old = btn.textContent;
  btn.textContent = "已复制 ✓";
  setTimeout(function () { btn.textContent = old; }, 1200);
}

/* ---------- 渲染入口（保留焦点） ---------- */
function render() {
  var el = document.activeElement;
  var fk = el && el.getAttribute ? el.getAttribute("data-fk") : null;
  renderHeader(); renderRail(); renderDetail(); renderAudit(); renderGate();
  if (fk) {
    var n = document.querySelector('[data-fk="' + fk + '"]');
    if (n) n.focus({ preventScroll: true });
  }
}

/* ---------- 事件绑定 ---------- */
document.addEventListener("click", function (e) {
  var el = e.target.closest("[data-action]");
  if (!el) return;
  var a = el.dataset.action, id = el.dataset.id;
  if (a === "select") { state.selectedId = id; render(); }
  else if (a === "complete") completeStep(id);
  else if (a === "open-gate") openGate(id);
  else if (a === "gate-cancel") cancelGate();
  else if (a === "gate-confirm") confirmGate();
  else if (a === "rollback") rollbackStep(id);
  else if (a === "copy-audit") copyAudit();
  else if (a === "export-audit") exportAudit();
  else if (a === "reset") doReset();
});
document.addEventListener("change", function (e) {
  var el = e.target.closest("[data-change]");
  if (!el) return;
  if (el.dataset.change === "check") toggleCheck(el.dataset.id, Number(el.dataset.index));
  else if (el.dataset.change === "gate-ack") {
    state.gateAcks[Number(el.dataset.index)] = el.checked;
    state.gateError = "";
    renderGate();
  }
});
document.addEventListener("input", function (e) {
  if (e.target.matches('[data-input="gate-code"]')) {
    state.gateCode = e.target.value;
    state.gateError = "";
    var hint = document.getElementById("gate-hint");
    if (hint) hint.textContent = gateHint();
  }
});
document.addEventListener("keydown", function (e) {
  if (e.key === "Escape" && state.gateOpenFor) cancelGate();
});
/* 左栏列表 roving tabindex：↑/↓/Home/End 在步骤间移动焦点，Enter/Space 原生点击选中 */
document.getElementById("region-step-rail").addEventListener("keydown", function (e) {
  if (e.key !== "ArrowDown" && e.key !== "ArrowUp" && e.key !== "Home" && e.key !== "End") return;
  var steps = Array.prototype.slice.call(this.querySelectorAll(".step"));
  if (!steps.length) return;
  var idx = steps.indexOf(document.activeElement);
  if (idx === -1) return;
  e.preventDefault();
  var next;
  if (e.key === "ArrowDown") next = steps[Math.min(idx + 1, steps.length - 1)];
  else if (e.key === "ArrowUp") next = steps[Math.max(idx - 1, 0)];
  else if (e.key === "End") next = steps[steps.length - 1];
  else next = steps[0];
  next.focus();
});
document.getElementById("gate-root").addEventListener("click", function (e) {
  if (e.target.classList.contains("gate-overlay")) cancelGate();
});

/* ---------- 启动：同步渲染，页面加载完成即 ready（留痕初始为空态） ---------- */
render();
