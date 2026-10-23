/* 下线指挥台 · 状态机与渲染（无构建、无异步依赖、file:// 可直开） */
(function () {
  "use strict";

  var RUNBOOK = window.RUNBOOK;
  var meta = RUNBOOK.meta;

  /* ---------- 展平流程 ---------- */
  var STEPS = [];
  RUNBOOK.phases.forEach(function (phase) {
    phase.steps.forEach(function (step) {
      STEPS.push(Object.assign({}, step, {
        phaseNum: phase.num,
        phaseTitle: phase.title,
        seq: STEPS.length + 1
      }));
    });
  });
  var TOTAL = STEPS.length;
  var stepById = {};
  STEPS.forEach(function (s) { stepById[s.id] = s; });

  /* ---------- 状态 ---------- */
  var STORAGE_KEY = "offboard-console-v1";

  function freshState() {
    return {
      startedAt: Date.now(),
      pointer: 0,            // 当前步骤索引（唯一推进指针，禁止跳步）
      checks: {},            // stepId -> [bool]
      done: {},              // stepId -> { at }
      irrev: {},             // stepId -> { confirmedAt, executedAt, undoneAt, effectiveAt }
      undo: {},              // stepId -> deadline(ms) 活动撤销窗口
      deviations: [],        // { at, stepId, kind, text }
      events: [],            // { at, kind, text }
      selectedStepId: null,  // 旅程图选中（回看已完成步骤）；null = 跟随当前指针
      completedAt: null
    };
  }

  function loadState() {
    try {
      var raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var s = JSON.parse(raw);
      if (typeof s.pointer !== "number" || !s.checks) return null;
      return s;
    } catch (e) { return null; } // file:// 下存储不可用时退化为内存态
  }

  function saveState() {
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* 内存态 */ }
  }

  var state = loadState() || freshState();
  if (!state.events || !state.events.length) state.startedAt = state.startedAt || Date.now();

  // 恢复会话时，把已过期的撤销窗口落为"已生效"
  Object.keys(state.undo || {}).forEach(function (id) {
    if (Date.now() >= state.undo[id]) finalizeUndoWindow(id, true);
  });

  /* ---------- 事件与偏差 ---------- */
  function logEvent(kind, text) {
    state.events.push({ at: Date.now(), kind: kind, text: text });
  }
  function logDeviation(stepId, kind, text) {
    state.deviations.push({ at: Date.now(), stepId: stepId, kind: kind, text: text });
    logEvent("deviation", "偏差 +1 · " + text);
  }

  /* ---------- 工具 ---------- */
  function $(id) { return document.getElementById(id); }
  function esc(t) {
    return String(t).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function fmtTime(ms) {
    return new Date(ms).toLocaleTimeString("zh-CN", { hour12: false });
  }
  function fmtDur(ms) {
    var s = Math.max(0, Math.floor(ms / 1000));
    var m = Math.floor(s / 60);
    s = s % 60;
    return (m < 10 ? "0" + m : m) + ":" + (s < 10 ? "0" + s : s);
  }
  function currentStep() { return STEPS[state.pointer]; }
  function isDone(id) { return !!state.done[id]; }
  function isCurrent(id) { var c = currentStep(); return !!c && c.id === id; }
  function isLocked(id) {
    var s = stepById[id];
    return !isDone(id) && !isCurrent(id);
  }
  function stepStatus(id) {
    if (isDone(id)) return "done";
    if (isCurrent(id)) return "current";
    return "locked";
  }
  function checksOf(step) {
    if (!state.checks[step.id]) {
      state.checks[step.id] = step.checks.map(function () { return false; });
    }
    return state.checks[step.id];
  }
  function checksAllPass(step) {
    return checksOf(step).every(Boolean);
  }

  var ICONS = {
    lock: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
    check: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7"/></svg>',
    play: '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4l13 8-13 8z"/></svg>',
    warn: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3L2.5 20h19z"/><path d="M12 10v4"/><path d="M12 17.4v.2"/></svg>',
    undo: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10h11a5 5 0 0 1 0 10h-4"/><path d="M8 6l-4 4 4 4"/></svg>',
    checkCircle: '<svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9.5"/><path d="M8 12.5l2.7 2.7L16.5 9"/></svg>'
  };

  /* ---------- 渲染：顶栏 ---------- */
  function renderHeader() {
    $("brandSub").textContent = meta.changeId + " · " + meta.title;
    $("headerMeta").innerHTML =
      "<span>目标 <b>" + esc(meta.target) + "</b></span>" +
      "<span>" + esc(meta.window) + "</span>" +
      "<span>执行人 <b>" + esc(meta.executor) + "</b></span>";

    var badge = $("deviationBadge");
    var n = state.deviations.length;
    badge.textContent = n === 0 ? "偏差 0" : "偏差 " + n;
    badge.className = "dev-badge " + (n === 0 ? "is-ok" : "is-bad");

    $("footerMeta").textContent = state.completedAt
      ? "全程完成于 " + fmtTime(state.completedAt)
      : "当前进度 " + Math.min(state.pointer, TOTAL) + " / " + TOTAL + " 步";
  }

  /* ---------- 渲染：旅程图 ---------- */
  function renderJourney() {
    var html = '<div class="journey-head"><div class="jt">流程旅程图</div>' +
      '<div class="jmeta">' + esc(meta.title) + ' · ' + TOTAL + ' 步</div></div>';

    RUNBOOK.phases.forEach(function (phase) {
      var doneCount = phase.steps.filter(function (s) { return isDone(s.id); }).length;
      html += '<section class="jphase"><header class="jphase-head">' +
        '<span class="jpnum">阶段 ' + phase.num + '</span>' +
        '<span class="jptitle">' + esc(phase.title) + '</span>' +
        '<span class="jpprog">' + doneCount + '/' + phase.steps.length + '</span>' +
        '</header><ol class="jlist">';

      STEPS.filter(function (s) { return s.phaseNum === phase.num; }).forEach(function (step) {
        var st = stepStatus(step.id);
        var viewing = state.selectedStepId === step.id && st !== "current";
        var icon = st === "done" ? ICONS.check : st === "current" ? ICONS.play : ICONS.lock;
        var cls = "jstep is-" + st + (viewing ? " is-viewing" : "");
        var disabled = st === "locked";
        var irrevFlag = step.irrev
          ? '<span class="jflag" title="不可逆步骤：有确认门与恢复路径">' + ICONS.warn + '</span>'
          : "";
        html += '<li><button type="button" class="' + cls + '" data-step="' + step.id + '"' +
          (disabled ? " disabled aria-disabled=\"true\"" : "") +
          (st === "current" ? ' aria-current="step"' : "") +
          ' title="' + esc("步骤 " + step.seq + " · " + step.title) + '">' +
          '<span class="jicon">' + icon + '</span>' +
          '<span class="jtitle">' + step.seq + '. ' + esc(step.title) + '</span>' +
          irrevFlag + '</button></li>';
      });
      html += "</ol></section>";
    });

    $("journey").innerHTML = html;
  }

  /* ---------- 渲染：撤销窗口横条 ---------- */
  function activeUndos() {
    return Object.keys(state.undo).map(function (id) {
      return { step: stepById[id], deadline: state.undo[id] };
    }).sort(function (a, b) { return a.deadline - b.deadline; });
  }

  function renderUndoStrip() {
    var list = activeUndos();
    var host = $("undoStrip");
    if (!list.length) { host.innerHTML = ""; return; }
    var now = Date.now();
    host.innerHTML = '<div class="undo-strip" role="region" aria-label="活动撤销窗口">' +
      list.map(function (u) {
        var left = Math.max(0, u.deadline - now);
        return '<div class="undo-item">' +
          '<span class="undo-ico">' + ICONS.undo + '</span>' +
          '<span>「<span class="u-title">' + esc(u.step.title) + '</span>」已执行 · 撤销窗口剩余 <b class="u-count" data-deadline="' + u.deadline + '">' + fmtDur(left) + '</b></span>' +
          '<span class="u-hint">' + esc(u.step.irrev.recovery.split("；")[0]) + '</span>' +
          '<span class="spacer"></span>' +
          '<button type="button" class="btn ghost sm" data-view="' + u.step.id + '">查看</button>' +
          '<button type="button" class="btn ok sm" data-undo="' + u.step.id + '">撤销此步</button>' +
          '</div>';
      }).join("") + '</div>';
  }

  function tickUndo() {
    var now = Date.now();
    var changed = false;
    Object.keys(state.undo).forEach(function (id) {
      if (now >= state.undo[id]) { finalizeUndoWindow(id, false); changed = true; }
    });
    if (!changed) {
      // 只刷新倒计时文本，避免整屏重绘
      document.querySelectorAll(".u-count").forEach(function (el) {
        var dl = Number(el.getAttribute("data-deadline"));
        el.textContent = fmtDur(Math.max(0, dl - now));
      });
      return;
    }
    saveState();
    renderAll();
  }

  function finalizeUndoWindow(id, fromReload) {
    delete state.undo[id];
    var rec = state.irrev[id];
    if (rec && !rec.undoneAt) {
      rec.effectiveAt = Date.now();
      logEvent("expire", "「" + stepById[id].title + "」撤销窗口已关闭，动作生效；恢复路径转为恢复点 / 回滚指引。" +
        (fromReload ? "（会话恢复时判定）" : ""));
    }
  }

  /* ---------- 渲染：执行区 ---------- */
  function renderFocus() {
    var host = $("focusCol");

    if (state.pointer >= TOTAL) {
      host.innerHTML = renderCertificate();
      return;
    }

    var step = state.selectedStepId ? stepById[state.selectedStepId] : currentStep();
    var viewing = !isCurrent(step.id) && isDone(step.id); // 只读回看
    host.innerHTML = viewing ? renderDoneStep(step) : renderCurrentStep(step);
  }

  function irrevPreviewHtml(step) {
    var kindText = step.irrev.kind === "undoable"
      ? "可撤销（执行后 " + step.irrev.undoSeconds + " 秒冷静期）"
      : "不可撤销（仅恢复点 / 回滚指引）";
    return '<div class="irrev-preview">' +
      '<div class="block"><div class="block-label is-danger">' + ICONS.warn + ' 不可逆 · 执行后果</div>' +
      '<p>' + esc(step.irrev.consequence) + '</p></div>' +
      '<div class="block"><div class="block-label is-safe">' + ICONS.undo + ' 恢复路径 · ' + esc(kindText) + '</div>' +
      '<p>' + esc(step.irrev.recovery) + '</p></div>' +
      '</div>';
  }

  function checksHtml(step) {
    var vals = checksOf(step);
    return '<div class="section-label">门禁校验（全部通过后方可' +
      (step.irrev ? "进入确认门" : "完成本步骤") + '）</div>' +
      '<div class="checks">' +
      step.checks.map(function (label, i) {
        var on = vals[i];
        return '<label class="check-row' + (on ? " is-checked" : "") + '">' +
          '<input type="checkbox" data-check="' + i + '"' + (on ? " checked" : "") + '>' +
          '<span class="check-text">' + esc(label) + '</span></label>';
      }).join("") + "</div>";
  }

  function renderCurrentStep(step) {
    var pass = checksAllPass(step);
    var btn = step.irrev
      ? '<button type="button" class="btn danger" id="btnAction">' + ICONS.warn + ' 确认并执行（不可逆）</button>'
      : '<button type="button" class="btn primary" id="btnAction">完成本步骤</button>';
    var hint = step.irrev
      ? "该步骤不可逆：点击后将打开确认门，展示后果与恢复路径。"
      : "完成所有门禁校验后点击完成，将自动进入下一步。";

    return '<article class="step-card">' +
      '<div class="crumb"><span>阶段 ' + step.phaseNum + ' · ' + esc(step.phaseTitle) + '</span>' +
      '<span class="sep">/</span><span>步骤 ' + step.seq + ' / ' + TOTAL + '</span></div>' +
      '<div class="step-title-row"><h1 class="step-title">' + esc(step.title) + '</h1>' +
      (step.irrev ? '<span class="badge irrev">' + ICONS.warn + ' 不可逆步骤</span>' : "") +
      '</div>' +
      '<p class="step-instruction">' + esc(step.instruction) + '</p>' +
      '<div id="gateErrorSlot"></div>' +
      checksHtml(step) +
      (step.irrev ? irrevPreviewHtml(step) : "") +
      '<div class="action-row" id="actionRow">' +
      '<span class="action-hint">' + esc(hint) + '</span>' + btn + '</div>' +
      '</article>';
  }

  function renderDoneStep(step) {
    var rec = state.irrev[step.id] || {};
    var rows = '<div class="dr-row"><span class="dr-k">完成于</span><span class="dr-v">' + fmtTime(state.done[step.id].at) + '</span></div>';
    if (rec.confirmedAt) rows += '<div class="dr-row"><span class="dr-k">确认门通过</span><span class="dr-v">' + fmtTime(rec.confirmedAt) + '</span></div>';
    if (rec.undoneAt) rows += '<div class="dr-row"><span class="dr-k">曾于</span><span class="dr-v">' + fmtTime(rec.undoneAt) + ' 执行后撤销（现已重新完成）</span></div>';
    if (state.undo[step.id]) rows += '<div class="dr-row"><span class="dr-k">撤销窗口</span><span class="dr-v">进行中，剩余 ' + fmtDur(state.undo[step.id] - Date.now()) + '（顶部横条可撤销）</span></div>';
    else if (rec.effectiveAt) rows += '<div class="dr-row"><span class="dr-k">撤销窗口</span><span class="dr-v">已于 ' + fmtTime(rec.effectiveAt) + ' 关闭</span></div>';

    var recoveryBlock = "";
    if (step.irrev) {
      var kindText = step.irrev.kind === "undoable" ? "撤销窗口已结束后的回滚路径" : "恢复点 / 回滚指引";
      recoveryBlock = '<div class="irrev-preview">' +
        '<div class="block"><div class="block-label is-safe">' + ICONS.undo + ' 恢复路径 · ' + esc(kindText) + '</div>' +
        '<p>' + esc(step.irrev.recovery) + '</p></div></div>';
    }

    return '<article class="step-card">' +
      '<div class="crumb"><span>阶段 ' + step.phaseNum + ' · ' + esc(step.phaseTitle) + '</span>' +
      '<span class="sep">/</span><span>步骤 ' + step.seq + ' / ' + TOTAL + '</span></div>' +
      '<div class="step-title-row"><h1 class="step-title">' + esc(step.title) + '</h1>' +
      '<span class="badge done">' + ICONS.check + ' 已完成</span>' +
      '<span class="badge readonly">只读回看</span></div>' +
      '<p class="step-instruction">' + esc(step.instruction) + '</p>' +
      '<div class="done-record">' + rows + '</div>' +
      recoveryBlock +
      '<div class="action-row"><span class="action-hint">已完成步骤为只读，不可修改或重做。</span>' +
      '<button type="button" class="btn ghost" id="btnBackCurrent">返回当前步骤</button></div>' +
      '</article>';
  }

  /* ---------- 渲染：完成凭证 ---------- */
  function renderCertificate() {
    var devCount = state.deviations.length;
    var irrevSteps = STEPS.filter(function (s) { return s.irrev; });
    var undoCount = irrevSteps.filter(function (s) { return state.irrev[s.id] && state.irrev[s.id].undoneAt; }).length;
    var zero = devCount === 0;

    var auditRows = irrevSteps.map(function (s) {
      var rec = state.irrev[s.id] || {};
      var undoCell = s.irrev.kind === "final"
        ? "不可撤销（恢复点已留档）"
        : rec.undoneAt
          ? "曾撤销（" + fmtTime(rec.undoneAt) + "）后重新执行"
          : (rec.effectiveAt ? "窗口关闭，已生效" : "撤销窗口进行中");
      return "<tr>" +
        '<td>' + s.seq + '. ' + esc(s.title) + '</td>' +
        '<td class="mono">' + (rec.confirmedAt ? fmtTime(rec.confirmedAt) : "—") + '</td>' +
        '<td class="mono">' + (rec.executedAt ? fmtTime(rec.executedAt) : "—") + '</td>' +
        '<td>' + undoCell + '</td>' +
        '<td>' + esc(s.irrev.recovery) + '</td>' +
        "</tr>";
    }).join("");

    return '<article class="certificate" id="certificate">' +
      '<div class="cert-icon">' + ICONS.checkCircle + '</div>' +
      '<h1 class="cert-title">流程已完成</h1>' +
      '<p class="cert-sub">' + esc(meta.changeId) + ' · ' + esc(meta.title) + ' · ' + esc(meta.target) + '</p>' +
      '<div class="cert-zero ' + (zero ? "is-perfect" : "is-flawed") + '">' +
      (zero ? ICONS.check + ' 零失误达成' : "全程完成 · 偏差 " + devCount + " 处（详见执行记录）") +
      '</div>' +
      '<div class="cert-stats">' +
      '<div class="cert-stat"><div class="v">' + fmtDur(state.completedAt - state.startedAt) + '</div><div class="k">总用时</div></div>' +
      '<div class="cert-stat"><div class="v">' + TOTAL + '</div><div class="k">步骤全部完成</div></div>' +
      '<div class="cert-stat"><div class="v">' + irrevSteps.length + '</div><div class="k">不可逆动作（均过确认门）</div></div>' +
      '<div class="cert-stat"><div class="v">' + undoCount + '</div><div class="k">撤销（恢复路径启用）</div></div>' +
      '</div>' +
      '<div class="cert-table-wrap"><table class="cert-table">' +
      '<caption>不可逆动作审计摘要</caption>' +
      '<thead><tr><th>步骤</th><th>确认门通过</th><th>执行于</th><th>撤销窗口</th><th>恢复路径</th></tr></thead>' +
      '<tbody>' + auditRows + '</tbody></table></div>' +
      '<div class="cert-actions">' +
      '<button type="button" class="btn primary" id="btnPrint">打印 / 导出凭证</button>' +
      '<button type="button" class="btn ghost" id="btnRestart">重置演练</button>' +
      '</div></article>';
  }

  /* ---------- 渲染：抽屉（执行记录） ---------- */
  var drawerOpen = false;

  function renderDrawer() {
    var drawer = $("drawer");
    drawer.hidden = !drawerOpen;
    if (!drawerOpen) return;
    var empty = state.events.length === 0;
    $("drawerEmpty").style.display = empty ? "" : "none";
    $("drawerCount").textContent = empty ? "" : state.events.length + " 条记录 · 偏差 " + state.deviations.length + " 处";
    $("timeline").innerHTML = state.events.map(function (ev) {
      return '<li class="tl-item k-' + ev.kind + '"><span class="tl-dot"></span>' +
        '<div class="tl-time">' + fmtTime(ev.at) + '</div>' +
        '<div class="tl-text">' + esc(ev.text) + '</div></li>';
    }).join("");
  }

  /* ---------- 渲染：汇总 ---------- */
  function renderAll() {
    renderHeader();
    renderJourney();
    renderUndoStrip();
    renderFocus();
    renderDrawer();
  }

  /* ---------- 交互：门禁与完成 ---------- */
  function showGateError(step) {
    var vals = checksOf(step);
    var unmet = step.checks.filter(function (_, i) { return !vals[i]; });
    $("gateErrorSlot").innerHTML =
      '<div class="gate-error" role="alert"><div class="ge-title">' + ICONS.warn +
      ' 门禁校验未通过，已记录 1 次偏差</div><ul>' +
      unmet.map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("") +
      '</ul>请先完成以上各项，再执行本步骤。</div>';
    var row = $("actionRow");
    row.classList.remove("shake"); void row.offsetWidth; row.classList.add("shake");
    toast("已记录 1 次偏差：门禁未过即尝试执行", "bad");
  }

  function onAction(step) {
    if (!checksAllPass(step)) {
      logDeviation(step.id, "gate_attempt", "「" + step.title + "」门禁未过即尝试执行");
      showGateError(step);
      saveState();
      renderHeader();
      renderJourney();
      return;
    }
    if (step.irrev) openConfirm(step);
    else completeStep(step, null);
  }

  function completeStep(step, irrevRecord) {
    state.done[step.id] = { at: Date.now() };
    if (irrevRecord) state.irrev[step.id] = irrevRecord;
    logEvent("done", "完成步骤 " + step.seq + "「" + step.title + "」");
    if (step.irrev) {
      logEvent("execute", "不可逆动作已执行：" + step.title +
        (step.irrev.kind === "undoable" ? "（撤销窗口 " + step.irrev.undoSeconds + " 秒）" : "（不可撤销，恢复点已留档）"));
    }
    state.selectedStepId = null;
    state.pointer = step.seq; // 指针推进到下一步（seq = 索引+1）
    if (state.pointer >= TOTAL) {
      state.completedAt = Date.now();
      logEvent("done", "全部 " + TOTAL + " 步完成，流程收束。偏差 " + state.deviations.length + " 处。");
      toast("流程已完成", "ok");
    } else {
      toast("已进入：步骤 " + (step.seq + 1) + "「" + currentStep().title + "」", "ok");
    }
    saveState();
    renderAll();
  }

  /* ---------- 交互：确认门 ---------- */
  var modalStep = null;
  var lastTrigger = null;

  function openConfirm(step) {
    modalStep = step;
    lastTrigger = document.activeElement;
    logEvent("confirm", "打开确认门：" + step.title + "（后果与恢复路径已展示）");
    $("modalTitle").textContent = "执行不可逆动作：" + step.title;
    $("modalConsequence").textContent = step.irrev.consequence;
    $("modalRecovery").textContent = step.irrev.recovery;
    $("modalAck").checked = false;
    $("modalConfirm").disabled = true;
    $("scrim").hidden = false;
    $("modal").hidden = false;
    renderDrawer();
    saveState();
    $("modalAck").focus();
  }

  function closeConfirm(confirmed) {
    var step = modalStep;
    $("modal").hidden = true;
    $("scrim").hidden = true;
    modalStep = null;
    if (!confirmed && step) {
      logDeviation(step.id, "confirm_cancel", "「" + step.title + "」确认门中被取消（未执行）");
      toast("已取消执行，偏差 +1（可在门禁通过后重新确认）", "bad");
      saveState();
      renderAll();
      var back = $("btnAction");
      if (back) back.focus();
      return;
    }
    if (lastTrigger && document.contains(lastTrigger)) lastTrigger.focus();
  }

  /* ---------- 交互：撤销 ---------- */
  function undoStep(id) {
    if (!state.undo[id]) return;
    var step = stepById[id];
    delete state.undo[id];
    var rec = state.irrev[id];
    if (rec) rec.undoneAt = Date.now();
    delete state.done[id];

    // 级联回退：该步骤之后所有已完成步骤一并回退（依赖失效）
    var rolled = [];
    STEPS.slice(step.seq).forEach(function (later) {
      if (state.done[later.id]) {
        delete state.done[later.id];
        delete state.undo[later.id];
        rolled.push(later.seq + ". " + later.title);
      }
    });

    state.pointer = step.seq - 1; // 指针退回本步骤
    state.selectedStepId = null;
    if (state.completedAt) state.completedAt = null;

    logEvent("undo", "恢复路径启用：已撤销「" + step.title + "」，状态回到执行前。" +
      (rolled.length ? "后续依赖步骤已一并回退：" + rolled.join("、") + "。" : ""));
    toast("已撤销：" + step.title, "ok");
    saveState();
    renderAll();
  }

  /* ---------- 交互：旅程图选中 ---------- */
  function selectStep(id) {
    if (state.pointer >= TOTAL) return; // 已收束：凭证为终态
    var st = stepStatus(id);
    if (st === "locked") return; // 锁定步骤不可跳入
    state.selectedStepId = (st === "current") ? null : id;
    saveState();
    renderAll();
  }

  /* ---------- Toast ---------- */
  var toastTimer = null;
  function toast(text, kind) {
    var el = $("toast");
    el.textContent = text;
    el.className = "toast" + (kind === "bad" ? " is-bad" : kind === "ok" ? " is-ok" : "");
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.hidden = true; }, 2600);
  }

  /* ---------- 重置 ---------- */
  function resetAll() {
    if (!window.confirm("确定重置整场演练？所有执行记录、确认与偏差记录将被清空。")) return;
    state = freshState();
    saveState();
    renderAll();
    toast("已重置演练", "ok");
  }

  /* ---------- 事件绑定 ---------- */
  document.addEventListener("click", function (e) {
    var t = e.target.closest ? e.target.closest("button") : null;
    if (!t) return;

    if (t.id === "btnAction") { onAction(currentStep()); return; }
    if (t.id === "btnBackCurrent") { state.selectedStepId = null; saveState(); renderAll(); return; }
    if (t.id === "btnRecord") { drawerOpen = true; renderDrawer(); $("drawerClose").focus(); return; }
    if (t.id === "drawerClose") { drawerOpen = false; renderDrawer(); $("btnRecord").focus(); return; }
    if (t.id === "btnReset" || t.id === "btnRestart") { resetAll(); return; }
    if (t.id === "btnPrint") { window.print(); return; }
    if (t.hasAttribute("data-step")) { selectStep(t.getAttribute("data-step")); return; }
    if (t.hasAttribute("data-view")) { state.selectedStepId = t.getAttribute("data-view"); saveState(); renderAll(); return; }
    if (t.hasAttribute("data-undo")) { undoStep(t.getAttribute("data-undo")); return; }
    if (t.id === "modalCancel") { closeConfirm(false); return; }
    if (t.id === "modalConfirm" && modalStep && !$("modalConfirm").disabled) {
      var step = modalStep;
      var now = Date.now();
      $("modal").hidden = true; $("scrim").hidden = true; modalStep = null;
      var rec = { confirmedAt: now, executedAt: now };
      if (step.irrev.kind === "undoable") state.undo[step.id] = now + step.irrev.undoSeconds * 1000;
      completeStep(step, rec);
    }
  });

  document.addEventListener("change", function (e) {
    var input = e.target;
    if (input.matches(".check-row input")) {
      var step = state.selectedStepId ? stepById[state.selectedStepId] : currentStep();
      if (isCurrent(step.id)) {
        checksOf(step)[Number(input.getAttribute("data-check"))] = input.checked;
        saveState();
        renderJourney();
        // 局部更新：勾选行样式 + 清除错误提示，保持输入焦点
        input.closest(".check-row").classList.toggle("is-checked", input.checked);
        var err = $("gateErrorSlot");
        if (err && checksAllPass(step)) err.innerHTML = "";
      }
    }
    if (input.id === "modalAck") {
      $("modalConfirm").disabled = !input.checked;
    }
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      if (!$("modal").hidden) { closeConfirm(false); return; }
      if (drawerOpen) { drawerOpen = false; renderDrawer(); $("btnRecord").focus(); }
    }
    // 确认门内焦点圈
    if (e.key === "Tab" && !$("modal").hidden) {
      var focusables = Array.prototype.filter.call(
        $("modal").querySelectorAll("button, input"),
        function (el) { return !el.disabled; }
      );
      if (!focusables.length) return;
      var first = focusables[0], last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  /* ---------- 启动（同步首屏，无加载态） ---------- */
  renderAll();
  setInterval(tickUndo, 1000);
})();
