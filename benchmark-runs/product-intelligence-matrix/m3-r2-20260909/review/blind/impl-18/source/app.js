/* 哨兵 Runbook · 应用逻辑
   结构：PAT-APPLICATION-SHELL —— 左轨（阶段/步骤地图）+ 当前步工作区 + 确认模态 + 审计抽屉
   核心机制：顺序硬门禁 / 不可逆三要素确认仪式 / 恢复路径常驻可见 / 偏差全程审计 */
(function () {
  "use strict";

  var RB = window.RUNBOOK;

  /* ---------- 流程扁平化 ---------- */
  var STEPS = [];
  RB.phases.forEach(function (phase) {
    phase.steps.forEach(function (step) {
      STEPS.push({ phase: phase, step: step });
    });
  });

  var KIND_LABEL = { normal: "常规步骤", decision: "决策门", irreversible: "不可逆操作" };

  /* ---------- 状态 ---------- */
  function freshStepState() {
    return { checked: {}, ev: {}, decision: null, done: false, confirms: 0, deviated: false };
  }
  function freshState() {
    return {
      currentIdx: 0,          // 第一个未完成步骤
      selectedIdx: null,      // 只读回看的已完成步骤
      steps: STEPS.map(freshStepState),
      events: [],             // { t, kind, stepIdx, text }
      outcome: null           // null | 'completed' | 'aborted'
    };
  }
  var state = freshState();
  var modalCtx = null;      // { type:'irreversible'|'abort'|'reset', stepIdx }
  var drawerOpen = false;
  var armedRecovery = null; // 已进入二次确认的恢复按钮（stepIdx）
  var lastFocus = null;

  /* ---------- 工具 ---------- */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function now() { return new Date().toTimeString().slice(0, 8); }
  function kindOf(i) { return STEPS[i].step.kind; }
  function deviations() { return state.events.filter(function (e) { return e.kind === "recover"; }); }
  function doneCount() {
    if (state.outcome === "completed") return STEPS.length;
    return state.steps.filter(function (s) { return s.done; }).length;
  }
  function logEvent(kind, stepIdx, text) {
    state.events.push({ t: now(), kind: kind, stepIdx: stepIdx, text: text });
  }

  /* ---------- 门禁：当前步是否满足放行条件 ---------- */
  function evidenceFieldError(st, f) {
    var v = (st.ev[f.id] || "").trim();
    if (!v) return "未填写";
    if (f.pattern && !(new RegExp(f.pattern)).test(v)) return "格式：" + (f.patternHint || "不符合要求");
    return null;
  }
  function gate(i) {
    var st = state.steps[i];
    var step = STEPS[i].step;
    var missing = [];
    var unchecked = step.checks.filter(function (c, ci) { return !st.checked[ci]; }).length;
    if (unchecked) missing.push("检查项 " + (step.checks.length - unchecked) + "/" + step.checks.length);
    var evMissing = [];
    (step.evidence || []).forEach(function (f) {
      var err = evidenceFieldError(st, f);
      if (err) evMissing.push(f.label + (err === "未填写" ? "" : "（" + err + "）"));
    });
    if (evMissing.length) missing.push("证据：" + evMissing.join("、"));
    if (step.kind === "decision" && !st.decision) missing.push("未选择决策分支");
    return { ok: missing.length === 0, missing: missing, evErrors: step.evidence || [] };
  }

  /* ---------- 渲染：顶部 ---------- */
  function renderHeader() {
    var done = doneCount();
    var pct = Math.round((done / STEPS.length) * 100);
    $("#progress-fill").style.width = pct + "%";
    $("#progress-text").textContent = done + " / " + STEPS.length + " 步";
    $(".progress").setAttribute("aria-valuenow", String(pct));
    var dev = deviations().length;
    var badge = $("#deviation-badge");
    if (dev === 0) {
      badge.textContent = "零偏差";
      badge.className = "badge badge-ok";
    } else {
      badge.textContent = "偏差 ×" + dev;
      badge.className = "badge badge-warn";
    }
    var abortBtn = $("#btn-abort");
    abortBtn.disabled = !!state.outcome;
  }

  /* ---------- 渲染：左轨 ---------- */
  function statusIcon(i) {
    var st = state.steps[i];
    if (st.done) return '<span class="rail-ico" style="color:var(--ok);font-weight:700">✓</span>';
    if (i === state.currentIdx && !state.outcome) return '<span class="dot dot-current"></span>';
    return '<span style="color:var(--line-strong)">—</span>';
  }
  function renderRail() {
    var html = "";
    var globalIdx = 0;
    RB.phases.forEach(function (phase) {
      var phaseDone = phase.steps.every(function (_s) {
        return state.steps[globalIdx + phase.steps.indexOf(_s)] && state.steps[globalIdx + phase.steps.indexOf(_s)].done;
      });
      html += '<div class="rail-phase"><div class="rail-phase-name">' + esc(phase.name) +
        (phaseDone ? ' <span class="phase-done-tick">✓</span>' : "") + "</div>";
      phase.steps.forEach(function (step) {
        var i = globalIdx;
        var st = state.steps[i];
        var reachable = st.done || (i === state.currentIdx && !state.outcome);
        var cls = "rail-step";
        if (st.done) cls += " done";
        if (i === state.currentIdx && !state.outcome && state.selectedIdx === null) cls += " active";
        if (state.selectedIdx === i) cls += " viewing";
        var irr = step.kind === "irreversible" ? '<span class="dot dot-irr" title="不可逆步骤"></span>' : "";
        var dev = st.deviated ? '<span class="dot dot-irr" style="background:var(--warn)" title="该步骤曾触发恢复"></span>' : "";
        html += '<button type="button" class="' + cls + '" data-act="view" data-idx="' + i + '"' +
          (reachable ? "" : " disabled") + ' aria-current="' + (i === state.currentIdx && !state.outcome) + '">' +
          '<span class="step-no">' + (i + 1) + "</span>" +
          '<span class="step-title-in-rail">' + irr + esc(step.title) + "</span>" + dev +
          '<span class="rail-status">' + statusIcon(i) + "</span></button>";
        globalIdx++;
      });
      html += "</div>";
    });
    $("#rail-body").innerHTML = html;
  }

  /* ---------- 渲染：恢复路径面板 ---------- */
  function recoveryPanelHTML(i, opts) {
    var step = STEPS[i].step;
    var st = state.steps[i];
    var r = step.recovery;
    var executed = st.done;
    var isLastDone = i === state.currentIdx - 1 && !state.outcome;
    var windowOpen = executed && isLastDone;
    var canRecover = windowOpen;
    var html = '<div class="recovery-panel' + (executed ? " executed" : "") + '">' +
      '<div class="recovery-head"><h3>🪢 恢复路径 · ' + esc(r.title) + "</h3>" +
      (executed ? '<span class="kind-tag kind-normal">已执行本步骤</span>' : '<span class="kind-tag kind-irreversible">执行前必读</span>') +
      "</div>" +
      '<p class="recovery-trigger-cond"><strong>触发条件：</strong>' + esc(r.trigger) + "</p>" +
      '<ol class="recovery-steps">' + r.steps.map(function (s) { return "<li>" + esc(s) + "</li>"; }).join("") + "</ol>" +
      '<p class="recovery-impact">触发影响：' + esc(r.impact) + "</p>";
    // 恢复动作区：只读回看也不剥夺恢复权利（回退窗口内仍可触发）
    html += '<div class="recovery-actions">';
      if (!executed) {
        html += '<span class="window-closed">本步骤尚未执行；执行后如需回退，将在此触发恢复路径。</span>';
      } else if (canRecover) {
        if (armedRecovery === i) {
          html += '<button type="button" class="btn btn-danger" data-act="recover-fire" data-idx="' + i + '">确认触发恢复（将记录偏差）</button>' +
            '<button type="button" class="btn" data-act="recover-disarm" data-idx="' + i + '">取消</button>' +
            '<span class="recovery-armed-note">再次点击确认：流程将回退到本步骤重新执行。</span>';
        } else {
          html += '<button type="button" class="btn btn-danger-ghost" data-act="recover-arm" data-idx="' + i + '">触发恢复路径</button>';
        }
      } else {
        html += '<span class="window-closed">恢复窗口已关闭：后续步骤已执行，请按复盘流程处理，不可就地回退。</span>';
      }
      html += "</div>";
    html += "</div>";
    return html;
  }

  /* ---------- 渲染：步骤工作区 ---------- */
  function checksHTML(i, readonly) {
    var step = STEPS[i].step;
    var st = state.steps[i];
    var done = step.checks.filter(function (_c, ci) { return st.checked[ci]; }).length;
    var items = step.checks.map(function (c, ci) {
      var on = !!st.checked[ci];
      if (readonly) {
        return '<li class="' + (on ? "done-item" : "") + '">' + (on ? "✓ " : "✗ ") + esc(c) + "</li>";
      }
      return '<label class="check-item' + (on ? " checked" : "") + '">' +
        '<input type="checkbox" data-field="check" data-ci="' + ci + '"' + (on ? " checked" : "") + ">" +
        "<span>" + esc(c) + "</span></label>";
    }).join("");
    if (readonly) {
      return '<div class="section"><h2>验证检查项（' + done + "/" + step.checks.length + '）</h2><ul class="recorded-list">' + items + "</ul></div>";
    }
    return '<div class="section"><h2>验证检查项 <span class="req-hint" data-checks-count="' + i + '">' + done + "/" + step.checks.length + "</span>" +
      "　<span class='req-hint'>全部勾选方可放行</span></h2>" +
      '<div class="check-list">' + items + "</div></div>";
  }

  function evidenceHTML(i, readonly) {
    var step = STEPS[i].step;
    var st = state.steps[i];
    var fields = (step.evidence || []).map(function (f) {
      var v = st.ev[f.id] || "";
      if (readonly) {
        return '<div class="kv"><b>' + esc(f.label) + "</b><span>" + (v ? esc(v) : "—") + "</span></div>";
      }
      var err = evidenceFieldError(st, f);
      var errHTML = (v && err) ? '<div class="field-error" data-err-for="' + f.id + '">' + esc(err) + "</div>" :
        '<div class="field-error" data-err-for="' + f.id + '" hidden></div>';
      var hint = f.patternHint ? '<div class="field-hint">' + esc(f.patternHint) + "</div>" : "";
      var common = 'data-field="ev" data-fid="' + f.id + '" placeholder="' + esc(f.placeholder || "") + '"';
      var inner = f.textarea
        ? '<textarea ' + common + ">" + esc(v) + "</textarea>"
        : '<input type="text" value="' + esc(v) + '" ' + common + ">";
      return '<div class="field"><label>' + esc(f.label) + ' <span class="req">*</span></label>' + inner + errHTML + hint + "</div>";
    }).join("");
    if (!fields) return "";
    if (readonly) {
      return '<div class="section"><h2>执行证据留档</h2><div class="recorded-kv">' + fields + "</div></div>";
    }
    return '<div class="section"><h2>执行证据 <span class="req-hint">留档可审计，格式校验通过方可放行</span></h2>' +
      '<div class="evidence-grid">' + fields + "</div></div>";
  }

  function decisionHTML(i) {
    var step = STEPS[i].step;
    var st = state.steps[i];
    if (!step.decision) return "";
    var cards = step.decision.options.map(function (o) {
      var on = st.decision === o.id;
      return '<label class="option-card' + (on ? " selected" : "") + (o.aborts ? " option-abort" : "") + '">' +
        '<input type="radio" name="decision-' + i + '" value="' + o.id + '"' + (on ? " checked" : "") + ' data-field="decision" data-oid="' + o.id + '">' +
        '<span class="option-main"><span class="option-label">' + esc(o.label) + "</span>" +
        '<div class="option-detail">' + esc(o.detail) + "</div>" +
        '<div class="option-outcome">分支结果：' + esc(o.outcome) + "</div></span></label>";
    }).join("");
    return '<div class="section"><h2>决策分支 <span class="req-hint">选择后将记录进审计，不可跳过</span></h2>' +
      '<div class="option-list">' + cards + "</div></div>";
  }

  function actionBarHTML(i) {
    var step = STEPS[i].step;
    var g = gate(i);
    var hint = g.ok ? '<span class="gate-hint ok">✓ 门禁通过，可以放行</span>'
      : '<span class="gate-hint">门禁未通过 · 还差：' + esc(g.missing.join("；")) + "</span>";
    var btn;
    if (step.kind === "decision") {
      var st = state.steps[i];
      var chosen = step.decision.options.filter(function (o) { return o.id === st.decision; })[0];
      var label = chosen && chosen.aborts ? "确认决策 · 安全中止切换" : "确认决策并继续";
      btn = '<button type="button" class="btn btn-primary" data-act="advance" data-idx="' + i + '"' + (g.ok ? "" : " disabled") + ">" + label + "</button>";
    } else if (step.kind === "irreversible") {
      btn = '<button type="button" class="btn btn-danger" data-act="open-confirm" data-idx="' + i + '"' + (g.ok ? "" : " disabled") + ">执行不可逆操作 · 进入确认仪式</button>";
    } else {
      btn = '<button type="button" class="btn btn-primary" data-act="advance" data-idx="' + i + '"' + (g.ok ? "" : " disabled") + ">完成本步并放行</button>";
    }
    return '<div class="action-bar" data-action-bar="' + i + '">' + hint + btn + "</div>";
  }

  function stepCardHTML(i, readonly) {
    var item = STEPS[i];
    var step = item.step;
    var cls = "step-card is-" + step.kind;
    var head = '<div class="step-head"><div class="kind-tags">' +
      '<span class="kind-tag kind-phase">' + esc(item.phase.name) + "</span>" +
      '<span class="kind-tag kind-' + step.kind + '">' + KIND_LABEL[step.kind] + "</span>" +
      (step.kind === "irreversible" ? '<span class="kind-tag kind-irreversible">需确认词 + 恢复路径</span>' : "") +
      "</div><h1>" + (i + 1) + ". " + esc(step.title) + "</h1>" +
      '<p class="step-summary">' + esc(step.summary) + "</p></div>";

    var banner = "";
    if (readonly) {
      banner = '<div class="readonly-banner"><span><span class="ro-tag">已完成 · 只读回看</span>' +
        (state.steps[i].deviated ? " · 本步骤曾触发恢复路径（已记偏差）" : "") +
        (step.kind === "irreversible" && state.steps[i].confirms ? " · 确认词已核验 ×" + state.steps[i].confirms : "") +
        "</span>" +
        '<button type="button" class="btn" data-act="back-current">返回当前步骤</button></div>';
    }

    var body = '<div class="step-body">';
    if (step.actions && step.actions.length) {
      body += '<div class="section"><h2>操作指引</h2><ol class="action-list">' +
        step.actions.map(function (a) { return "<li>" + esc(a) + "</li>"; }).join("") + "</ol></div>";
    }
    if (step.decision) body += decisionHTML(i);
    body += checksHTML(i, readonly);
    body += evidenceHTML(i, readonly);
    if (step.kind === "irreversible") {
      body += '<div class="section"><h2>不可逆后果</h2><div class="consequence-block"><strong>⚠ 执行后无法在本流程内撤销</strong>' +
        esc(step.consequence) + "</div></div>";
      body += '<div class="section"><h2>恢复路径（执行前必读）</h2>' + recoveryPanelHTML(i, { readonly: readonly }) + "</div>";
    }
    body += "</div>";

    var bar = readonly ? "" : actionBarHTML(i);
    return '<article class="' + cls + '">' + banner + head + body + bar + "</article>";
  }

  /* ---------- 渲染：完成报告 ---------- */
  function verdict() {
    var dev = deviations().length;
    if (state.outcome === "completed" && dev === 0)
      return { cls: "verdict-ok", icon: "🛡️", title: "零失误走完全程", text: "全部 13 个步骤按顺序放行，" + confirmCount() + " 次不可逆操作均通过确认仪式，未触发任何恢复路径。本流程达成验收标准：零偏差完成。" };
    if (state.outcome === "completed")
      return { cls: "verdict-deviation", icon: "⚠️", title: "完成，但存在 " + dev + " 次偏差", text: "流程已走完全程，但过程中触发了恢复路径。偏差明细已记入审计，请在复盘会议中逐条归因。" };
    if (state.outcome === "aborted" && dev === 0)
      return { cls: "verdict-abort", icon: "🛟", title: "安全中止（零偏差）", text: "本次切换按决策门设计的安全出口中止。中止不构成失误：未进入或已退出的不可逆操作均未执行，全部过程留档可审计。" };
    return { cls: "verdict-deviation", icon: "⚠️", title: "已中止，过程存在 " + dev + " 次偏差", text: "本次切换已按安全出口中止，但过程中触发过恢复路径。偏差明细已记入审计，请纳入复盘。" };
  }
  function confirmCount() {
    return state.steps.reduce(function (n, s) { return n + s.confirms; }, 0);
  }
  function reportHTML() {
    var v = verdict();
    var stats =
      '<div class="stat-tile"><b>' + doneCount() + "</b><span>已放行步骤</span></div>" +
      '<div class="stat-tile"><b>' + confirmCount() + "</b><span>不可逆确认</span></div>" +
      '<div class="stat-tile"><b>' + deviations().length + "</b><span>恢复触发（偏差）</span></div>" +
      '<div class="stat-tile"><b>' + state.events.filter(function (e) { return e.kind === "decision"; }).length + "</b><span>决策记录</span></div>";
    var timeline = state.events.length
      ? '<ul class="timeline">' + state.events.map(function (e) {
          var label = STEPS[e.stepIdx] ? "s" + (e.stepIdx + 1) + " " + STEPS[e.stepIdx].step.title + " · " : "";
          return '<li class="ev-' + e.kind + '"><span class="ev-time">' + e.t + '</span><b>' + kindLabelOf(e.kind) + "</b>　" + esc(label) + esc(e.text) + "</li>";
        }).join("") + "</ul>"
      : '<div class="drawer-empty">无事件记录</div>';
    var retro = '<ul class="recorded-list">' + RB.retroPoints.map(function (p) { return "<li>" + esc(p) + "</li>"; }).join("") + "</ul>";
    return '<div class="report-card"><div class="report-hero ' + v.cls + '">' +
      '<div class="hero-icon" style="font-size:44px">' + v.icon + "</div><h1>" + esc(v.title) + "</h1><p>" + esc(v.text) + "</p></div>" +
      '<div class="report-stats">' + stats + "</div>" +
      '<div class="report-section"><h2>全程事件时间线</h2>' + timeline + "</div>" +
      '<div class="report-section"><h2>复盘要点</h2>' + retro + "</div>" +
      '<div class="report-actions">' +
      '<button type="button" class="btn btn-primary" data-act="export">导出报告（JSON）</button>' +
      '<button type="button" class="btn" data-act="reset">重新演练</button></div></div>';
  }
  function kindLabelOf(kind) {
    return { complete: "放行", confirm: "不可逆确认", recover: "恢复触发", abort: "安全中止", decision: "决策", system: "系统" }[kind] || kind;
  }

  /* ---------- 渲染：工作区入口 ---------- */
  function renderWork() {
    var el = $("#work-body");
    if (state.outcome) {
      el.innerHTML = reportHTML();
      return;
    }
    if (state.selectedIdx !== null) {
      el.innerHTML = stepCardHTML(state.selectedIdx, true);
      return;
    }
    el.innerHTML = stepCardHTML(state.currentIdx, false);
  }

  /* ---------- 渲染：审计抽屉 ---------- */
  function renderDrawer() {
    var body = $("#drawer-body");
    if (!state.events.length) {
      body.innerHTML = '<div class="drawer-empty">暂无事件。<br>完成步骤、执行不可逆确认或触发恢复后，将在此全程留痕。</div>';
      return;
    }
    body.innerHTML = state.events.map(function (e) {
      var label = STEPS[e.stepIdx] ? "s" + (e.stepIdx + 1) + " " + STEPS[e.stepIdx].step.title : "";
      return '<div class="drawer-event"><div class="ev-meta"><span class="ev-kind ev-' + e.kind + '">' + kindLabelOf(e.kind) +
        '</span><span class="ev-time">' + e.t + "</span></div><div>" + esc(label) + "</div><div>" + esc(e.text) + "</div></div>";
    }).join("");
  }
  function setDrawer(open) {
    drawerOpen = open;
    $("#audit-drawer").hidden = !open;
    $("#btn-audit").setAttribute("aria-expanded", String(open));
    if (open) renderDrawer();
  }

  /* ---------- 模态 ---------- */
  function openModal(ctx) {
    modalCtx = ctx;
    armedRecovery = null;
    lastFocus = document.activeElement;
    var m = $("#modal");
    var overlay = $("#modal-overlay");
    if (ctx.type === "irreversible") {
      var item = STEPS[ctx.stepIdx];
      var step = item.step;
      m.className = "modal";
      m.innerHTML = '<div class="modal-body">' +
        '<h2>确认执行不可逆操作</h2>' +
        '<p class="modal-sub">s' + (ctx.stepIdx + 1) + " · " + esc(step.title) + "　|　" + esc(item.phase.name) + "</p>" +
        '<div class="consequence-block"><strong>⚠ 不可逆后果</strong>' + esc(step.consequence) + "</div>" +
        recoveryPanelHTML(ctx.stepIdx, { readonly: true }) +
        '<label class="ack-row"><input type="checkbox" id="modal-ack">' +
        "<span>我已完整阅读上述<strong>不可逆后果</strong>与<strong>恢复路径</strong>，知晓本操作无法在本流程内撤销。</span></label>" +
        '<div class="word-field"><label>请输入确认词 <code>' + esc(step.confirmWord) + "</code> 以继续</label>" +
        '<input type="text" id="modal-word" autocomplete="off" spellcheck="false" placeholder="输入确认词">' +
        '<div class="modal-error" id="modal-error"></div></div>' +
        '<div class="modal-actions"><button type="button" class="btn" data-act="close-modal">取消</button>' +
        '<button type="button" class="btn btn-danger" data-act="do-confirm" data-idx="' + ctx.stepIdx + '" disabled>确认执行</button></div></div>';
    } else if (ctx.type === "abort") {
      m.className = "modal is-abort";
      m.innerHTML = '<div class="modal-body">' +
        "<h2>安全中止本次切换</h2>" +
        '<p class="modal-sub">中止是本流程设计的安全出口（决策门分支），不构成失误。已完成的步骤与证据将保持现状并留档。</p>' +
        '<label class="ack-row is-abort"><input type="checkbox" id="modal-ack">' +
        "<span>我确认按<strong>安全出口中止</strong>本次切换，并已在作战室通报。</span></label>" +
        '<div class="modal-error" id="modal-error"></div>' +
        '<div class="modal-actions"><button type="button" class="btn" data-act="close-modal">继续执行流程</button>' +
        '<button type="button" class="btn btn-danger" data-act="do-abort" disabled>确认安全中止</button></div></div>';
    } else if (ctx.type === "reset") {
      m.className = "modal is-abort";
      m.innerHTML = '<div class="modal-body">' +
        "<h2>重新演练</h2>" +
        '<p class="modal-sub">将清空全部步骤状态、证据与事件记录，回到初始就绪态。</p>' +
        '<label class="ack-row is-abort"><input type="checkbox" id="modal-ack">' +
        "<span>我确认清空全部记录并重新演练。</span></label>" +
        '<div class="modal-actions"><button type="button" class="btn" data-act="close-modal">取消</button>' +
        '<button type="button" class="btn btn-danger" data-act="do-reset" disabled>确认重新演练</button></div></div>';
    }
    overlay.hidden = false;
    var ack = $("#modal-ack");
    if (ack) ack.focus(); else m.focus();
    m.setAttribute("tabindex", "-1");
  }
  function closeModal() {
    $("#modal-overlay").hidden = true;
    modalCtx = null;
    if (lastFocus && lastFocus.focus) lastFocus.focus();
    lastFocus = null;
  }
  function updateModalGate() {
    if (!modalCtx) return;
    var ack = $("#modal-ack");
    var word = $("#modal-word");
    var btn = $('[data-act="do-confirm"], [data-act="do-abort"], [data-act="do-reset"]', $("#modal"));
    if (modalCtx.type === "irreversible") {
      var step = STEPS[modalCtx.stepIdx].step;
      var okWord = word && word.value.trim() === step.confirmWord;
      var okAck = ack && ack.checked;
      word.classList.toggle("invalid", !!word.value && !okWord);
      $("#modal-error").textContent = word.value && !okWord ? "确认词不匹配，请核对后重新输入。" : "";
      btn.disabled = !(okWord && okAck);
    } else {
      btn.disabled = !(ack && ack.checked);
    }
  }
  function doIrreversibleConfirm(idx) {
    var step = STEPS[idx].step;
    var st = state.steps[idx];
    st.confirms += 1;
    st.done = true;
    logEvent("confirm", idx, "通过确认仪式执行不可逆操作（确认词 " + step.confirmWord + " 已核验）");
    closeModal();
    advanceToNext(idx);
  }
  function advance(idx) {
    var step = STEPS[idx].step;
    var st = state.steps[idx];
    st.done = true;
    if (step.kind === "decision") {
      var chosen = step.decision.options.filter(function (o) { return o.id === st.decision; })[0];
      logEvent("decision", idx, "决策：选择「" + chosen.label + "」");
      if (chosen.aborts) {
        state.outcome = "aborted";
        logEvent("abort", idx, "按决策门安全出口中止本次切换（可逆出口，不构成失误）");
        state.selectedIdx = null;
        renderAll();
        return;
      }
    } else {
      logEvent("complete", idx, "全部检查项与证据通过门禁，步骤放行");
    }
    advanceToNext(idx);
  }
  function advanceToNext(idx) {
    state.selectedIdx = null;
    armedRecovery = null;
    if (idx >= STEPS.length - 1) {
      state.outcome = "completed";
    } else {
      state.currentIdx = idx + 1;
    }
    renderAll();
  }

  /* ---------- 恢复触发 ---------- */
  function fireRecovery(idx) {
    var step = STEPS[idx].step;
    var st = state.steps[idx];
    st.done = false;
    st.checked = {};
    st.ev = {};
    st.deviated = true;
    state.currentIdx = idx;
    state.selectedIdx = null;
    armedRecovery = null;
    logEvent("recover", idx, "触发恢复路径「" + step.recovery.title + "」，步骤回退为待执行，需重新走确认仪式");
    renderAll();
  }

  /* ---------- 即时门禁刷新（不整块重渲染，保持输入焦点） ---------- */
  function updateGateUI(i) {
    var bar = $('[data-action-bar="' + i + '"]');
    if (!bar) return;
    var step = STEPS[i].step;
    var g = gate(i);
    var hintEl = $(".gate-hint", bar);
    if (hintEl) {
      if (g.ok) {
        hintEl.textContent = "✓ 门禁通过，可以放行";
        hintEl.classList.add("ok");
      } else {
        hintEl.textContent = "门禁未通过 · 还差：" + g.missing.join("；");
        hintEl.classList.remove("ok");
      }
    }
    var btn = $("button", bar);
    if (btn) btn.disabled = !g.ok;
    // 检查项计数
    var st = state.steps[i];
    var done = step.checks.filter(function (_c, ci) { return st.checked[ci]; }).length;
    var counter = $('[data-checks-count="' + i + '"]');
    if (counter) counter.textContent = done + "/" + step.checks.length;
    // 证据字段错误态
    (step.evidence || []).forEach(function (f) {
      var inputEl = $('[data-fid="' + f.id + '"]');
      var errEl = $('[data-err-for="' + f.id + '"]');
      if (!inputEl || !errEl) return;
      var v = (st.ev[f.id] || "").trim();
      var err = evidenceFieldError(st, f);
      inputEl.classList.toggle("invalid", !!(v && err));
      if (v && err) { errEl.textContent = err; errEl.hidden = false; }
      else { errEl.hidden = true; }
    });
  }

  /* ---------- 导出 ---------- */
  function exportReport() {
    var v = verdict();
    var data = {
      runbook: RB.code, title: RB.title, incident: RB.incident,
      exported_at: new Date().toISOString(),
      verdict: { title: v.title, deviations: deviations().length, irreversible_confirms: confirmCount() },
      steps: STEPS.map(function (it, i) {
        var st = state.steps[i];
        return {
          id: it.step.id, title: it.step.title, kind: it.step.kind, phase: it.phase.name,
          done: st.done, decision: st.decision, confirms: st.confirms, deviated: st.deviated,
          checks: it.step.checks.map(function (c, ci) { return { label: c, checked: !!st.checked[ci] }; }),
          evidence: it.step.evidence || []
        };
      }),
      events: state.events
    };
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "runbook-report-" + Date.now() + ".json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  }

  /* ---------- 总渲染 ---------- */
  function renderAll() {
    renderHeader();
    renderRail();
    renderWork();
    if (drawerOpen) renderDrawer();
  }

  /* ---------- 事件委托 ---------- */
  document.addEventListener("click", function (ev) {
    var t = ev.target.closest("[data-act]");
    if (!t) return;
    var act = t.getAttribute("data-act");
    var idx = t.getAttribute("data-idx") !== null ? parseInt(t.getAttribute("data-idx"), 10) : null;

    if (act === "view") {
      var i = idx;
      if (state.steps[i].done) { state.selectedIdx = i; }
      else if (i === state.currentIdx && !state.outcome) { state.selectedIdx = null; }
      renderAll();
    } else if (act === "back-current") {
      state.selectedIdx = null;
      renderAll();
    } else if (act === "advance") {
      advance(idx);
    } else if (act === "open-confirm") {
      openModal({ type: "irreversible", stepIdx: idx });
    } else if (act === "do-confirm") {
      if (!$("#modal-word") || $("#modal-word").value.trim() !== STEPS[modalCtx.stepIdx].step.confirmWord) return;
      doIrreversibleConfirm(idx);
    } else if (act === "recover-arm") {
      armedRecovery = idx;
      renderWork();
    } else if (act === "recover-disarm") {
      armedRecovery = null;
      renderWork();
    } else if (act === "recover-fire") {
      fireRecovery(idx);
    } else if (act === "close-modal") {
      closeModal();
    } else if (act === "do-abort") {
      state.outcome = "aborted";
      state.selectedIdx = null;
      logEvent("abort", state.currentIdx, "从顶部「安全中止」出口中止本次切换（可逆出口，不构成失误）");
      closeModal();
      renderAll();
    } else if (act === "reset") {
      openModal({ type: "reset" });
    } else if (act === "do-reset") {
      closeModal();
      state = freshState();
      renderAll();
    } else if (act === "export") {
      exportReport();
    }
  });

  document.addEventListener("change", function (ev) {
    var t = ev.target;
    var work = $("#work-body");
    if (work.contains(t)) {
      var i = state.selectedIdx !== null ? state.selectedIdx : state.currentIdx;
      if (t.getAttribute("data-field") === "check") {
        state.steps[i].checked[t.getAttribute("data-ci")] = t.checked;
        t.closest(".check-item").classList.toggle("checked", t.checked);
        updateGateUI(i);
      } else if (t.getAttribute("data-field") === "decision") {
        state.steps[i].decision = t.getAttribute("data-oid");
        $all(".option-card", work).forEach(function (c) { c.classList.remove("selected"); });
        t.closest(".option-card").classList.add("selected");
        updateGateUI(i);
      }
    } else if (t.id === "modal-ack" || t.id === "modal-word") {
      updateModalGate();
    }
  });

  document.addEventListener("input", function (ev) {
    var t = ev.target;
    if (t.id === "modal-word") { updateModalGate(); return; }
    var work = $("#work-body");
    if (work.contains(t) && t.getAttribute("data-field") === "ev") {
      var i = state.selectedIdx !== null ? state.selectedIdx : state.currentIdx;
      state.steps[i].ev[t.getAttribute("data-fid")] = t.value;
      updateGateUI(i);
    }
  });

  document.addEventListener("keydown", function (ev) {
    if (ev.key === "Escape" && modalCtx) closeModal();
  });

  $("#btn-abort").addEventListener("click", function () {
    if (!state.outcome) openModal({ type: "abort" });
  });
  $("#btn-audit").addEventListener("click", function () { setDrawer(!drawerOpen); });
  $("#btn-drawer-close").addEventListener("click", function () { setDrawer(false); });

  /* ---------- 初始化：首屏即就绪（数据内联，无加载态） ---------- */
  $("#runbook-title").textContent = "哨兵 Runbook · " + RB.title;
  $("#runbook-code").textContent = RB.code + " · " + RB.incident;
  renderAll();
})();
