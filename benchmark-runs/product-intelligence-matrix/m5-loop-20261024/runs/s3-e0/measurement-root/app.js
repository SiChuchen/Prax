/* 发布护航台 RunGuard — 高后果流程执行器
   零失误走完全程：不可跳步 + 检查项强制 + 验证门 + 不可逆确认门 + 恢复中心回滚 + 全程审计 */
(function () {
  "use strict";

  var STORE_KEY = "runguard.pay2410.v1";

  /* ---------- 展平流程 ---------- */
  var PHASES = RUNBOOK.phases;
  var STEPS = [];
  PHASES.forEach(function (p, pi) {
    p.steps.forEach(function (s) { s._phase = p; s._pi = pi; STEPS.push(s); });
  });
  var IRREV_TOTAL = STEPS.filter(function (s) { return s.irrev; }).length;

  /* ---------- 工具 ---------- */
  function esc(x) {
    return String(x).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function fmtTime(ts) { var d = new Date(ts); return d.toTimeString().slice(0, 8); }
  function fmtDur(ms) {
    var s = Math.max(0, Math.round(ms / 1000));
    var m = Math.floor(s / 60); s = s % 60;
    return m + " 分 " + (s < 10 ? "0" : "") + s + " 秒";
  }

  /* ---------- 状态 ---------- */
  function freshState() {
    var steps = {};
    STEPS.forEach(function (s) {
      steps[s.id] = { status: "pending", checks: (s.checks || []).map(function () { return false; }), verify: null };
    });
    return {
      v: 1, mode: "run", steps: steps, log: [],
      rollbackQueue: [], rollbackChecks: [], abortIntent: false,
      viewedStepId: null, events: [], startedAt: Date.now(),
      deviations: 0, restored: false
    };
  }
  var state;
  var ui = { modal: null, modalInput: "" };
  var focusSel = null;

  function save() { try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* 私隐模式下降级为内存态 */ } }
  function load() {
    try {
      var s = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
      if (s && s.v === 1 && s.steps && s.events) {
        for (var i = 0; i < STEPS.length; i++) if (!s.steps[STEPS[i].id]) return null;
        s.restored = true;
        return s;
      }
    } catch (e) {}
    return null;
  }
  function addEvent(type, text) { state.events.push({ t: Date.now(), type: type, text: text }); }

  function stepById(id) { for (var i = 0; i < STEPS.length; i++) if (STEPS[i].id === id) return STEPS[i]; return null; }
  function st(id) { return state.steps[id]; }
  function currentIdx() {
    for (var i = 0; i < STEPS.length; i++) if (state.steps[STEPS[i].id].status === "pending") return i;
    return -1;
  }
  function checksDone(s) {
    if (!s.checks || !s.checks.length) return true;
    return st(s.id).checks.every(function (b) { return b; });
  }
  function remainingChecks(s) { return s.checks ? st(s.id).checks.filter(function (b) { return !b; }).length : 0; }
  function doneCount() { return STEPS.filter(function (s) { return st(s.id).status === "done"; }).length; }
  function viewable(i) {
    return st(STEPS[i].id).status !== "pending" || i === currentIdx();
  }
  function lastOpenIrrev() {
    for (var i = state.log.length - 1; i >= 0; i--) if (!state.log[i].rolledBack) return state.log[i];
    return null;
  }
  function openIrrevList() { return state.log.filter(function (e) { return !e.rolledBack; }); }
  function finishFlowIfLast() {
    if (doneCount() === STEPS.length) {
      state.mode = "completed";
      state.viewedStepId = null;
      addEvent("complete", "全部步骤完成：零失误走完全程");
    }
  }

  /* ---------- 动作 ---------- */
  function actNav(idxStr) {
    if (state.mode === "rollback") return;
    var i = +idxStr;
    if (!viewable(i)) return;
    state.viewedStepId = (i === currentIdx()) ? null : STEPS[i].id;
    save(); render();
  }
  function actComplete(id) {
    var s = stepById(id);
    if (!checksDone(s)) return;
    st(id).status = "done";
    addEvent("step", "完成步骤：" + s.title);
    state.viewedStepId = null;
    finishFlowIfLast();
    save(); render();
  }
  function actVerify(id, pass) {
    var s = stepById(id);
    if (!checksDone(s)) return;
    if (pass) {
      st(id).verify = "pass"; st(id).status = "done";
      state.mode = "run";
      addEvent("verify", "验证通过：" + s.title);
      state.viewedStepId = null;
      finishFlowIfLast();
    } else {
      st(id).verify = "fail";
      state.deviations++;
      state.mode = "deviation";
      addEvent("verify", "验证未通过：" + s.title + " → 进入异常处理");
    }
    save(); render();
  }
  function actOpenIrrev(id) {
    var s = stepById(id);
    if (!checksDone(s)) return;
    ui.modal = { type: "confirm", stepId: id }; ui.modalInput = "";
    addEvent("confirm", "打开确认门：" + s.title + "（确认码 " + s.irrev.code + "）");
    save(); render();
  }
  function actExecuteIrrev(id) {
    var s = stepById(id);
    if (ui.modalInput !== s.irrev.code) return;
    st(id).status = "done";
    state.log.push({ stepId: id, code: s.irrev.code, at: Date.now(), rolledBack: false, rolledBackAt: null });
    addEvent("irrev", "执行不可逆操作：" + s.title + "（确认码 " + s.irrev.code + "）");
    ui.modal = null;
    state.viewedStepId = null;
    finishFlowIfLast();
    save(); render();
  }
  function actModalCancel() {
    var s = stepById(ui.modal.stepId);
    ui.modal = null;
    addEvent("confirm", "取消确认门（未执行）：" + s.title);
    save(); render();
  }
  function actDeviation(choice) {
    var cur = STEPS[currentIdx()];
    if (choice === "retry") {
      st(cur.id).verify = null;
      state.mode = "run";
      addEvent("deviation", "异常分支：重试验证（" + cur.title + "）");
    } else if (choice === "rollback") {
      var e = lastOpenIrrev();
      if (!e) return;
      startRollback([e.stepId], false);
    } else {
      var q = openIrrevList().map(function (x) { return x.stepId; }).reverse();
      state.mode = "run";
      if (!q.length) {
        state.mode = "aborted";
        addEvent("abort", "流程安全中止：无已执行的不可逆操作，无需回滚");
      } else {
        startRollback(q, true);
      }
    }
    save(); render();
  }
  function startRollback(queue, abortIntent) {
    state.mode = "rollback";
    state.abortIntent = abortIntent;
    state.rollbackQueue = queue;
    state.viewedStepId = null;
    initRollbackChecks();
    addEvent("rollback-start", "开始回滚：" + stepById(queue[0]).title +
      (queue.length > 1 ? "（共 " + queue.length + " 个，按执行倒序）" : ""));
  }
  function initRollbackChecks() {
    var s = stepById(state.rollbackQueue[0]);
    state.rollbackChecks = s.irrev.recovery.steps.map(function () { return false; });
  }
  function actRollbackConfirm() {
    var s = stepById(state.rollbackQueue[0]);
    if (!state.rollbackChecks.every(function (b) { return b; })) return;
    var e = state.log.filter(function (x) { return x.stepId === s.id && !x.rolledBack; })[0];
    if (e) { e.rolledBack = true; e.rolledBackAt = Date.now(); }
    addEvent("rollback-done", "回滚完成：" + s.title + "（恢复预案：" + s.irrev.recovery.title + "）");
    state.rollbackQueue.shift();
    if (state.rollbackQueue.length) {
      initRollbackChecks();
      addEvent("rollback-start", "继续回滚：" + stepById(state.rollbackQueue[0]).title +
        "（剩余 " + state.rollbackQueue.length + " 个）");
    } else {
      state.mode = "aborted";
      addEvent("abort", state.abortIntent
        ? "流程安全中止：已回滚全部已执行的不可逆操作"
        : "流程安全中止：已回滚最近不可逆操作，流程转入安全中止");
    }
    save(); render();
  }
  function actStartRollback(id) {
    if (state.mode !== "run") return;
    var e = state.log.filter(function (x) { return x.stepId === id && !x.rolledBack; })[0];
    if (!e) return;
    startRollback([id], true);
    save(); render();
  }
  function actExport() {
    addEvent("export", "导出审计日志");
    var payload = {
      app: "发布护航台 RunGuard",
      cell: "cell-j10-s09 · complete × consequential-flow",
      runbook: { id: RUNBOOK.id, code: RUNBOOK.code, title: RUNBOOK.title },
      exportedAt: new Date().toISOString(),
      mode: state.mode,
      stats: {
        stepsDone: doneCount(), stepsTotal: STEPS.length,
        irreversibleExecuted: state.log.length, irreversibleTotal: IRREV_TOTAL,
        rollbacks: state.log.filter(function (e) { return e.rolledBack; }).length,
        deviations: state.deviations,
        durationMs: Date.now() - state.startedAt
      },
      irreversibleLog: state.log,
      events: state.events
    };
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "audit-" + RUNBOOK.code + ".json";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
    save(); render();
  }
  function actResetConfirm() {
    try { localStorage.removeItem(STORE_KEY); } catch (e) {}
    state = freshState();
    addEvent("session", "重新开始：进度与审计已清空，新会话启动");
    ui.modal = null;
    save(); render();
  }

  /* ---------- 渲染 ---------- */
  function modeChip() {
    switch (state.mode) {
      case "deviation": return '<span class="chip chip-danger">异常处理中</span>';
      case "rollback": return '<span class="chip chip-warn">回滚中</span>';
      case "completed": return '<span class="chip chip-ok">已完成</span>';
      case "aborted": return '<span class="chip">已安全中止</span>';
      default: return '<span class="chip chip-accent">进行中</span>';
    }
  }
  function renderTopbar() {
    var cur = currentIdx();
    var progress = "步骤 " + doneCount() + "/" + STEPS.length +
      (cur >= 0 && state.mode !== "completed" && state.mode !== "aborted" ? " · " + STEPS[cur]._phase.name : " · " + (state.mode === "completed" ? "全部完成" : "流程结束"));
    return '<header class="topbar">' +
      '<div class="brand"><span class="logo" aria-hidden="true"></span><span class="brand-name">发布护航台</span>' +
      '<span class="topdiv"></span><span class="rb-title">' + esc(RUNBOOK.title) + '</span>' +
      '<span class="chip">' + esc(RUNBOOK.code) + '</span>' +
      '<span class="chip chip-danger">' + esc(RUNBOOK.risk) + '</span></div>' +
      '<div class="top-actions"><span class="progress">' + progress + '</span>' + modeChip() +
      '<button class="btn btn-ghost btn-sm" data-action="export">导出审计日志</button>' +
      '<button class="btn btn-ghost btn-sm" data-action="reset-open">重新开始</button>' +
      '</div></header>';
  }
  function renderNav() {
    var cur = currentIdx();
    var flowOver = state.mode === "completed" || state.mode === "aborted";
    var html = '<div class="nav-intro"><p class="goal">' + esc(RUNBOOK.win) + ' · 按序推进，禁止跳步。</p></div>';
    html += PHASES.map(function (p) {
      var done = p.steps.filter(function (s) { return st(s.id).status === "done"; }).length;
      var items = p.steps.map(function (s) {
        var i = STEPS.indexOf(s);
        var ss = st(s.id);
        var cls = "nav-item";
        var icon = "○";
        var isCur = (i === cur && !flowOver);
        if (ss.status === "done") { icon = "✓"; cls += " is-done"; }
        else if (ss.status === "rolled_back") { icon = "↩"; cls += " is-rolled"; }
        else if (isCur) { icon = "●"; cls += " is-current"; }
        else { cls += " is-locked"; }
        var dis = (state.mode === "rollback" || !viewable(i)) ? " disabled" : "";
        return '<button class="' + cls + '"' + dis + (isCur ? ' aria-current="step"' : "") +
          ' data-action="nav" data-idx="' + i + '" title="' + esc(s.title) + '">' +
          '<span class="nav-ico" aria-hidden="true">' + icon + '</span>' +
          '<span class="nav-t">' + esc(s.title) + '</span>' +
          (s.irrev ? '<span class="tag tag-danger">不可逆</span>' : (s.verify ? '<span class="tag tag-warn">验证</span>' : '')) +
          '</button>';
      }).join("");
      return '<div class="nav-phase"><div class="nav-ph-head"><span>' + esc(p.name) + '</span>' +
        '<span class="nav-ph-count">' + done + '/' + p.steps.length + '</span></div>' + items + '</div>';
    }).join("");
    return html;
  }
  function kindBadge(s) {
    if (s.irrev) return '<span class="chip chip-danger">不可逆操作</span>';
    if (s.verify) return '<span class="chip chip-warn">验证门</span>';
    return '<span class="chip">检查项</span>';
  }
  function renderIrrevBlock(s, readonly) {
    var ir = s.irrev;
    var ready = checksDone(s);
    var html = '<div class="irrev-warn"><div class="irrev-head">⚠ 不可逆操作 · 执行前必读</div>' +
      '<p class="irrev-desc">' + esc(ir.headline) + '</p>' +
      '<ul class="cons">' + ir.consequences.map(function (c) { return "<li>" + esc(c) + "</li>"; }).join("") + "</ul></div>";
    html += '<div class="recovery-preview"><div class="rp-head">恢复预案预览 · ' + esc(ir.recovery.title) +
      '（执行后可在右侧「恢复中心」真正发起回滚）</div><ol>' +
      ir.recovery.steps.map(function (r) { return "<li>" + esc(r) + "</li>"; }).join("") + "</ol></div>";
    if (!readonly) {
      var rem = remainingChecks(s);
      html += '<div class="actions"><button class="btn btn-danger" data-action="open-irrev" data-step="' + s.id + '"' +
        (ready ? "" : " disabled") + '>执行不可逆操作…</button>' +
        (ready ? "" : '<span class="hint">先完成上方确认项（还剩 ' + rem + ' 项），确认门才会打开</span>') + "</div>";
    }
    return html;
  }
  function renderVerifyBlock(s) {
    var ready = checksDone(s);
    var rem = remainingChecks(s);
    return '<div class="verify"><div class="verify-q">验证门 · ' + esc(s.verify.question) + '</div>' +
      '<div class="actions">' +
      '<button class="btn btn-primary" data-action="vpass" data-step="' + s.id + '"' + (ready ? "" : " disabled") + '>' + esc(s.verify.passLabel) + '</button>' +
      '<button class="btn btn-danger-o" data-action="vfail" data-step="' + s.id + '"' + (ready ? "" : " disabled") + '>' + esc(s.verify.failLabel) + '</button>' +
      (ready ? "" : '<span class="hint">先完成上方确认项（还剩 ' + rem + ' 项），再作答</span>') +
      "</div></div>";
  }
  function renderDeviation() {
    var open = openIrrevList();
    var lastTxt = open.length
      ? '最近可回滚：' + esc(stepById(open[open.length - 1].stepId).title)
      : "当前尚无已执行的不可逆操作——可放心重试，或直接安全中止（无需回滚）。";
    return '<div class="deviate" role="alert">' +
      '<div class="dev-head">异常处理 · 验证未通过，必须选择分支</div>' +
      '<p>「零失误」在这里的含义是：走恢复路径，而不是绕过它。所选分支会记入审计日志。</p>' +
      '<div class="dev-actions">' +
      '<button class="btn btn-primary" data-action="dev-retry">① 重试验证</button>' +
      '<button class="btn btn-warn" data-action="dev-rollback"' + (open.length ? "" : " disabled") + '>② 回滚最近不可逆操作</button>' +
      '<button class="btn btn-danger" data-action="dev-abort">③ 安全中止流程</button>' +
      "</div>" + '<p class="hint">' + lastTxt + "</p></div>";
  }
  function renderStepCard(s, readonly) {
    var i = STEPS.indexOf(s);
    var ss = st(s.id);
    var html = '<section class="card step-card' + (s.irrev ? " step-irrev" : "") + '">';
    html += '<div class="eyebrow">' + esc(s._phase.name) + ' · 第 ' + (i + 1) + ' / ' + STEPS.length + ' 步 ' + kindBadge(s) + '</div>';
    html += "<h2>" + esc(s.title) + "</h2>";
    if (readonly) {
      var rolled = ss.status === "rolled_back";
      html += '<div class="review-note"><span class="chip ' + (rolled ? "chip-warn" : "chip-ok") + '">' +
        (rolled ? "已回滚 · 只读回看" : "已完成 · 只读回看") + '</span>' +
        '<button class="btn btn-ghost btn-sm" data-action="nav-back">返回当前步骤</button></div>';
      if (rolled) html += '<div class="why"><strong>回滚记录</strong>该不可逆操作已按恢复预案回滚，流程转入安全中止。</div>';
    } else {
      html += '<div class="why"><strong>为什么重要</strong>' + esc(s.why || "") + "</div>";
    }
    if (s.checks) {
      var done = ss.checks.filter(Boolean).length;
      html += '<div class="check-head"><span>执行确认项</span><span class="count">' + done + ' / ' + s.checks.length + '</span></div>';
      html += '<div class="checks">' + s.checks.map(function (c, ci) {
        var checked = ss.checks[ci];
        if (readonly) {
          return '<div class="check-row static"><span class="ro-ico">' + (checked ? "✓" : "○") + '</span><span>' + esc(c) + "</span></div>";
        }
        return '<label class="check-row"><input type="checkbox" class="cbx" data-check data-step="' + s.id + '" data-i="' + ci + '"' +
          (checked ? " checked" : "") + "><span>" + esc(c) + "</span></label>";
      }).join("") + "</div>";
    }
    if (s.irrev) {
      html += renderIrrevBlock(s, readonly);
    } else if (s.verify && !readonly) {
      html += renderVerifyBlock(s);
    }
    if (!s.verify && !s.irrev && !readonly) {
      var ready = checksDone(s);
      html += '<div class="actions"><button class="btn btn-primary" data-action="complete" data-step="' + s.id + '"' +
        (ready ? "" : " disabled") + '>完成步骤，继续 →</button>' +
        (ready ? "" : '<span class="hint">还剩 ' + remainingChecks(s) + ' 项确认未完成</span>') + "</div>";
    }
    if (state.mode === "deviation" && !readonly && ss.verify === "fail") {
      html += renderDeviation();
    }
    html += "</section>";
    return html;
  }
  function renderRollback() {
    var s = stepById(state.rollbackQueue[0]);
    var rec = s.irrev.recovery;
    var done = state.rollbackChecks.filter(Boolean).length;
    var ready = done === rec.steps.length;
    return '<section class="card step-card step-rollback">' +
      '<div class="eyebrow">恢复中心 · 引导式回滚 <span class="chip chip-warn">回滚中</span></div>' +
      "<h2>恢复预案：" + esc(rec.title) + "</h2>" +
      '<div class="why"><strong>正在回滚</strong>' + esc(s.title) + "（确认码 " + esc(s.irrev.code) + "）。" +
      (state.rollbackQueue.length > 1 ? "之后还将按执行倒序回滚剩余 " + (state.rollbackQueue.length - 1) + " 个不可逆操作。" : "回滚完成后，流程将进入「已安全中止」。") + "</div>" +
      '<div class="check-head"><span>回滚执行项</span><span class="count">' + done + ' / ' + rec.steps.length + '</span></div>' +
      '<div class="checks">' + rec.steps.map(function (c, i) {
        return '<label class="check-row"><input type="checkbox" class="cbx" data-rcheck data-i="' + i + '"' +
          (state.rollbackChecks[i] ? " checked" : "") + "><span>" + esc(c) + "</span></label>";
      }).join("") + "</div>" +
      '<div class="actions"><button class="btn btn-warn" data-action="rb-confirm"' + (ready ? "" : " disabled") + '>完成回滚并记录</button>' +
      (ready ? "" : '<span class="hint">还剩 ' + (rec.steps.length - done) + ' 项未完成</span>') + "</div></section>";
  }
  function stat(k, v) { return '<div class="stat"><div class="stat-k">' + k + '</div><div class="stat-v">' + v + "</div></div>"; }
  function renderSummary(completed) {
    var executed = state.log.length;
    var rolled = state.log.filter(function (e) { return e.rolledBack; }).length;
    var dur = fmtDur(Date.now() - state.startedAt);
    var html = '<section class="card summary">';
    if (completed) {
      html += '<div class="sum-badge ok">✓ 零失误走完全程</div>' +
        "<h2>" + esc(RUNBOOK.title) + " · 发布完成</h2>" +
        '<p class="sum-p">全部 ' + STEPS.length + ' 个步骤按序完成，无跳步、无漏检；' + executed +
        ' 个不可逆操作均通过确认门（键入确认码）执行，恢复预案全程可达、未被启用。</p>';
    } else {
      html += '<div class="sum-badge warn">已安全中止</div><h2>流程已安全中止</h2>' +
        '<p class="sum-p">未走完全程，但零失误原则优先：已按恢复预案回滚 ' + rolled + " / " + executed +
        ' 个已执行的不可逆操作，系统处于安全状态。</p>' +
        (executed ? '<ul class="sum-log">' + state.log.slice().reverse().map(function (e) {
          return "<li><span>" + esc(stepById(e.stepId).title) + '</span><span class="chip ' +
            (e.rolledBack ? "chip-ok" : "chip-danger") + '">' + (e.rolledBack ? "已回滚" : "未回滚") + "</span></li>";
        }).join("") + "</ul>" : '<p class="hint">本次未执行任何不可逆操作。</p>');
    }
    html += '<div class="sum-stats">' +
      stat("完成步骤", doneCount() + " / " + STEPS.length) +
      stat("不可逆操作（二次确认）", executed + " / " + IRREV_TOTAL) +
      stat("回滚", rolled + " 次") +
      stat("异常分支触发", state.deviations + " 次") +
      stat("审计事件", state.events.length + " 条") +
      stat("用时", dur) + "</div>" +
      '<div class="actions center"><button class="btn btn-primary" data-action="export">导出审计日志（JSON）</button>' +
      '<button class="btn btn-ghost" data-action="reset-open">重新开始</button></div></section>';
    return html;
  }
  function renderWork() {
    var banner = state.restored
      ? '<div class="restore-note"><span>已恢复上次会话进度（' + doneCount() + "/" + STEPS.length + ' 步）。</span>' +
        '<button class="btn btn-ghost btn-sm" data-action="dismiss-restore">知道了</button></div>'
      : "";
    if (state.mode === "completed") return banner + renderSummary(true);
    if (state.mode === "aborted") return banner + renderSummary(false);
    if (state.mode === "rollback") return banner + renderRollback();
    var cur = currentIdx();
    var s, readonly = false;
    if (state.viewedStepId) {
      s = stepById(state.viewedStepId);
      readonly = st(s.id).status !== "pending";
    } else if (cur >= 0) {
      s = STEPS[cur];
    } else {
      return banner + renderSummary(true);
    }
    return banner + renderStepCard(s, readonly);
  }
  function renderAside() {
    var rec;
    if (!state.log.length) {
      rec = '<div class="empty">尚无已执行的不可逆操作。<br>执行后可在此按恢复预案发起回滚。</div>';
    } else {
      rec = state.log.slice().reverse().map(function (e) {
        var s = stepById(e.stepId);
        var can = !e.rolledBack && state.mode === "run";
        return '<div class="rec-item"><div class="rec-top"><span class="rec-t">' + esc(s.title) + '</span>' +
          '<span class="chip ' + (e.rolledBack ? "chip-ok" : "chip-danger") + '">' + (e.rolledBack ? "已回滚" : "已执行") + '</span></div>' +
          '<div class="rec-meta">确认码 ' + esc(e.code) + " · " + fmtTime(e.at) + "</div>" +
          '<button class="btn btn-warn btn-sm" data-action="rb-start" data-step="' + s.id + '"' +
          (can ? "" : " disabled") + ">执行回滚</button></div>";
      }).join("");
    }
    var evs = state.events.slice().reverse().map(function (e) {
      return '<li><span class="ev-t">' + fmtTime(e.t) + '</span><span class="ev-x">' + esc(e.text) + "</span></li>";
    }).join("");
    return '<div class="panel"><div class="panel-head">恢复中心</div><div class="panel-body">' + rec + "</div></div>" +
      '<div class="panel"><div class="panel-head">审计日志 <span class="count">' + state.events.length + " 条</span></div>" +
      '<ul class="events">' + evs + "</ul></div>";
  }
  function renderModal() {
    if (!ui.modal) return "";
    if (ui.modal.type === "confirm") {
      var s = stepById(ui.modal.stepId);
      var ok = ui.modalInput === s.irrev.code;
      return '<div class="overlay" role="dialog" aria-modal="true" aria-label="不可逆操作确认门">' +
        '<div class="modal"><h3>确认门 · ' + esc(s.title) + "</h3>" +
        '<p class="irrev-desc">' + esc(s.irrev.headline) + "</p>" +
        '<ul class="cons">' + s.irrev.consequences.map(function (c) { return "<li>" + esc(c) + "</li>"; }).join("") + "</ul>" +
        '<div class="recovery-preview"><div class="rp-head">若出问题 → 恢复预案：' + esc(s.irrev.recovery.title) + '</div><ol>' +
        s.irrev.recovery.steps.map(function (r) { return "<li>" + esc(r) + "</li>"; }).join("") + "</ol></div>" +
        '<label class="code-label" for="confirm-code">键入确认码 <code>' + esc(s.irrev.code) + '</code> 以确认执行</label>' +
        '<input id="confirm-code" class="code-input" type="text" autocomplete="off" spellcheck="false" placeholder="' + esc(s.irrev.code) + '">' +
        '<div class="actions end"><button class="btn btn-ghost" data-action="modal-cancel">取消</button>' +
        '<button class="btn btn-danger" data-action="exec-irrev" data-step="' + s.id + '"' + (ok ? "" : " disabled") + '>我已知晓后果，执行</button></div>' +
        "</div></div>";
    }
    if (ui.modal.type === "reset") {
      return '<div class="overlay" role="dialog" aria-modal="true" aria-label="重新开始确认"><div class="modal modal-sm">' +
        "<h3>重新开始？</h3><p>将清空当前全部进度与审计记录（建议先导出审计日志）。</p>" +
        '<div class="actions end"><button class="btn btn-ghost" data-action="reset-cancel">取消</button>' +
        '<button class="btn btn-danger" data-action="reset-confirm">确认重新开始</button></div></div></div>';
    }
    return "";
  }
  function render() {
    var app = document.getElementById("app");
    app.innerHTML = renderTopbar() +
      '<div class="layout">' +
      '<nav class="col nav" aria-label="流程导航">' + renderNav() + "</nav>" +
      '<main class="col work" aria-label="当前步骤">' + renderWork() + "</main>" +
      '<aside class="col side" aria-label="恢复中心与审计日志">' + renderAside() + "</aside>" +
      "</div>" + renderModal();
    if (focusSel) {
      var f = document.querySelector(focusSel);
      if (f) f.focus();
      focusSel = null;
    } else if (ui.modal) {
      var inp = document.getElementById("confirm-code");
      if (inp) { inp.focus(); inp.select(); }
    }
  }

  /* ---------- 事件委托 ---------- */
  function onClick(ev) {
    var t = ev.target.closest("[data-action]");
    if (!t || t.disabled) return;
    var a = t.getAttribute("data-action");
    if (a === "nav") actNav(t.getAttribute("data-idx"));
    else if (a === "nav-back") { state.viewedStepId = null; save(); render(); }
    else if (a === "complete") actComplete(t.getAttribute("data-step"));
    else if (a === "vpass") actVerify(t.getAttribute("data-step"), true);
    else if (a === "vfail") actVerify(t.getAttribute("data-step"), false);
    else if (a === "open-irrev") actOpenIrrev(t.getAttribute("data-step"));
    else if (a === "exec-irrev") actExecuteIrrev(t.getAttribute("data-step"));
    else if (a === "modal-cancel") actModalCancel();
    else if (a === "dev-retry") actDeviation("retry");
    else if (a === "dev-rollback") actDeviation("rollback");
    else if (a === "dev-abort") actDeviation("abort");
    else if (a === "rb-confirm") actRollbackConfirm();
    else if (a === "rb-start") actStartRollback(t.getAttribute("data-step"));
    else if (a === "export") actExport();
    else if (a === "reset-open") { ui.modal = { type: "reset" }; render(); }
    else if (a === "reset-cancel") { ui.modal = null; render(); }
    else if (a === "reset-confirm") actResetConfirm();
    else if (a === "dismiss-restore") { state.restored = false; save(); render(); }
  }
  function onChange(ev) {
    var t = ev.target;
    if (t.matches("[data-check]")) {
      var id = t.getAttribute("data-step"), i = +t.getAttribute("data-i");
      st(id).checks[i] = t.checked;
      focusSel = '[data-check][data-step="' + id + '"][data-i="' + i + '"]';
      save(); render();
    } else if (t.matches("[data-rcheck]")) {
      var j = +t.getAttribute("data-i");
      state.rollbackChecks[j] = t.checked;
      focusSel = '[data-rcheck][data-i="' + j + '"]';
      save(); render();
    }
  }
  function onInput(ev) {
    if (ev.target.id === "confirm-code" && ui.modal && ui.modal.type === "confirm") {
      ui.modalInput = ev.target.value;
      var btn = document.querySelector('[data-action="exec-irrev"]');
      if (btn) btn.disabled = ev.target.value !== stepById(ui.modal.stepId).irrev.code;
    }
  }
  function onKeydown(ev) {
    if (ev.key === "Escape" && ui.modal) {
      if (ui.modal.type === "confirm") actModalCancel();
      else if (ui.modal.type === "reset") { ui.modal = null; render(); }
      return;
    }
    if (ev.key === "Enter" && ui.modal && ui.modal.type === "confirm" && ev.target.id === "confirm-code") {
      actExecuteIrrev(ui.modal.stepId);
    }
  }

  /* ---------- 启动：同步初始化，首屏即就绪 ---------- */
  state = load() || freshState();
  if (!state.events.length) addEvent("session", "会话开始：" + RUNBOOK.code + " " + RUNBOOK.title);
  save();
  var appEl = document.getElementById("app");
  appEl.addEventListener("click", onClick);
  appEl.addEventListener("change", onChange);
  appEl.addEventListener("input", onInput);
  document.addEventListener("keydown", onKeydown);
  render();
})();
