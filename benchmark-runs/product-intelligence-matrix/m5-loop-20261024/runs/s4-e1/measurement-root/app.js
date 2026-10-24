/* 发布执行台 —— 顺序强制的 runbook 执行状态机
 * 状态模型：pointer 指向唯一当前步骤（idx < pointer 完成，= 当前，> 锁定）。
 * 顺序强制因此天然成立：不存在可跳步的状态；回滚 = pointer 回退并重置后续验证门。 */
(function () {
  "use strict";

  var RUNBOOK = window.RUNBOOK;

  // ---- 扁平化步骤序列 ----
  var STEPS = [];
  RUNBOOK.phases.forEach(function (phase) {
    phase.steps.forEach(function (step) {
      STEPS.push(Object.assign({ phase: phase }, step));
    });
  });
  var N = STEPS.length;
  function idxOf(sid) {
    for (var i = 0; i < N; i++) if (STEPS[i].id === sid) return i;
    return -1;
  }

  var IRREVERSIBLE_EXEC_PHRASE_NOTE = "输入与确认短语一致的内容后才能执行";
  var RECOVER_PHRASE = "ROLLBACK";

  // ---- 状态 ----
  var state;
  function initState() {
    state = {
      pointer: 0,                 // 唯一当前步骤下标；N = 全部完成
      checks: {},                 // sid -> [bool] 验证门断言
      doneAt: {},                 // sid -> "HH:MM:SS"
      exec: {},                   // sid -> 执行次数（不可逆）
      rollback: {},               // sid -> 回滚次数（不可逆）
      log: [],                    // { t, kind, text, sid }
      selected: STEPS[0].id,      // 详情区正在查看的步骤；null = 完成页
      modal: null                 // { mode, sid }
    };
  }
  function currentSid() { return state.pointer < N ? STEPS[state.pointer].id : null; }
  function statusOf(step) {
    var i = idxOf(step.id);
    if (i < state.pointer) return "done";
    if (i === state.pointer) return "current";
    return "locked";
  }
  function now() { return new Date().toTimeString().slice(0, 8); }
  function checksOf(step) {
    if (!state.checks[step.id]) state.checks[step.id] = (step.checks || []).map(function () { return false; });
    return state.checks[step.id];
  }
  function gatePassed(step) { return checksOf(step).every(Boolean); }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function logEvent(kind, text, sid) {
    state.log.push({ t: now(), kind: kind, text: text, sid: sid });
  }

  // ---- 动作 ----
  function advance(step) {
    state.doneAt[step.id] = now();
    logEvent(
      step.risk === "verification" ? "verify" : "normal",
      (step.risk === "verification"
        ? "通过验证门并完成「" + step.title + "」（断言 " + step.checks.length + "/" + step.checks.length + "）"
        : "完成「" + step.title + "」"),
      step.id
    );
    state.pointer += 1;
    var next = currentSid();
    state.selected = next; // 全部完成时为 null → 完成页
    render();
  }

  function confirmExecute(step) {
    state.exec[step.id] = (state.exec[step.id] || 0) + 1;
    closeModal();
    state.doneAt[step.id] = now();
    logEvent("irreversible", "执行不可逆步骤「" + step.title + "」（确认短语 " + step.confirmPhrase + "，已留存恢复路径）", step.id);
    state.pointer += 1;
    state.selected = currentSid();
    toast("已执行「" + step.title + "」。恢复路径保持可用。");
    render();
  }

  function confirmRecover(step) {
    var i = idxOf(step.id);
    closeModal();
    state.rollback[step.id] = (state.rollback[step.id] || 0) + 1;
    // 回退：本步骤回到当前待重做，其后全部锁定并重置验证门
    for (var j = i; j < N; j++) {
      var s = STEPS[j];
      delete state.doneAt[s.id];
      if (state.checks[s.id]) state.checks[s.id] = state.checks[s.id].map(function () { return false; });
    }
    state.pointer = i;
    state.selected = step.id;
    logEvent("recovery", "已按恢复路径回滚「" + step.title + "」，流程回到本步骤待重做", step.id);
    toast("已回滚「" + step.title + "」。请核对现场后重新执行。");
    render();
  }

  function selectStep(sid) { state.selected = sid; render(); }
  function toggleCheck(sid, idx) {
    var step = STEPS[idxOf(sid)];
    var arr = checksOf(step);
    arr[idx] = !arr[idx];
    syncGateUI(step); // 原地更新，不重渲染：保持勾选焦点（键盘可用性），兄弟节点不脱钩
  }
  function syncGateUI(step) {
    var root = document.getElementById("detail");
    var arr = checksOf(step);
    var remaining = arr.filter(function (v) { return !v; }).length;
    var hint = root.querySelector(".gate-hint");
    if (hint) {
      if (remaining === 0) {
        hint.textContent = "断言 " + step.checks.length + "/" + step.checks.length + " 全部通过，可以完成本步骤。";
        hint.classList.add("ok");
      } else {
        hint.textContent = "尚有 " + remaining + " 项断言未确认——验证门未通过前，本步骤无法完成。";
        hint.classList.remove("ok");
      }
    }
    var btn = root.querySelector('[data-act="complete"]');
    if (btn && statusOf(step) === "current") btn.disabled = remaining !== 0;
  }
  function closeModal() { state.modal = null; renderModal(); }

  // ---- 渲染 ----
  function render() { renderMeta(); renderTop(); renderRail(); renderDetail(); renderLog(); renderModal(); }

  function renderMeta() {
    document.getElementById("meta").innerHTML =
      '<span class="meta-item">' + esc(RUNBOOK.code) + "</span>" +
      '<span class="meta-item">' + esc(RUNBOOK.release) + "</span>" +
      '<span class="meta-item">' + esc(RUNBOOK.window) + "</span>" +
      '<span class="meta-item">' + esc(RUNBOOK.captain) + "</span>";
  }

  function renderTop() {
    var pct = Math.round((state.pointer / N) * 100);
    document.getElementById("progressFill").style.width = pct + "%";
    document.getElementById("progressText").textContent = state.pointer + " / " + N + " 步";
    document.getElementById("progressBar").setAttribute("aria-valuenow", String(pct));
  }

  function riskChip(step) {
    if (step.risk === "irreversible") return '<span class="chip risk">不可逆</span>';
    if (step.risk === "verification") return '<span class="chip verify">验证门</span>';
    return "";
  }

  function renderRail() {
    var html = '<div role="listbox" aria-label="流程步骤（上下方向键移动，回车查看）">';
    RUNBOOK.phases.forEach(function (phase) {
      var done = phase.steps.filter(function (s) { return statusOf(s) === "done"; }).length;
      html += '<div class="rail-phase"><div class="rail-phase-head"><span>' + esc(phase.name) + "</span>" +
        '<span class="count">' + done + "/" + phase.steps.length + "</span></div>";
      phase.steps.forEach(function (step) {
        var st = statusOf(step);
        var isSel = state.selected === step.id;
        var cls = "rail-item" + (st === "current" ? " current" : "") + (st === "locked" ? " locked" : "") +
          (isSel ? " selected" : "");
        var dot = st === "done" ? '<span class="dot done">✓</span>'
          : st === "current" ? '<span class="dot current" aria-hidden="true"></span>'
          : '<span class="dot" aria-hidden="true"></span>';
        // roving tabindex：仅选中项可 Tab 到达，方向键在清单内移动（ARIA listbox 惯例）
        html += '<div class="' + cls + '" role="option" data-sid="' + step.id + '"' +
          ' tabindex="' + (isSel ? "0" : "-1") + '"' +
          (isSel ? ' aria-selected="true"' : ' aria-selected="false"') +
          (st === "current" ? ' aria-current="step"' : "") + ">" +
          dot +
          '<span class="step-title">' + esc(step.title) + "</span>" +
          '<span class="code">' + esc(step.code) + "</span>" +
          riskChip(step) +
          "</div>";
      });
      html += "</div>";
    });
    html += "</div>";
    var rail = document.getElementById("rail");
    rail.innerHTML = html;
    var list = rail.querySelector('[role="listbox"]');
    Array.prototype.forEach.call(list.querySelectorAll(".rail-item"), function (item) {
      item.addEventListener("click", function () { selectStep(item.getAttribute("data-sid")); });
    });
    list.addEventListener("keydown", function (evn) {
      var keys = { ArrowDown: 1, ArrowUp: -1, Home: "home", End: "end" };
      var delta = keys[evn.key];
      if (!delta) return;
      evn.preventDefault();
      var item = evn.target.closest(".rail-item");
      if (!item) return;
      var i = idxOf(item.getAttribute("data-sid"));
      i = delta === "home" ? 0 : delta === "end" ? N - 1 : Math.min(N - 1, Math.max(0, i + delta));
      state.selected = STEPS[i].id;
      render();
      var next = rail.querySelector('[data-sid="' + STEPS[i].id + '"]');
      if (next) next.focus();
    });
  }

  function statusChipHtml(step) {
    var st = statusOf(step);
    if (st === "done") return '<span class="status-chip done">已完成 ' + esc(state.doneAt[step.id] || "") + "</span>";
    if (st === "current") return '<span class="status-chip current">当前步骤</span>';
    return '<span class="status-chip locked">已锁定</span>';
  }

  function recoveryHtml(step, actionable) {
    if (!step.recovery) return "";
    var items = step.recovery.steps.map(function (s) { return "<li>" + esc(s) + "</li>"; }).join("");
    return (
      '<div class="recovery" data-testid="recovery-panel">' +
      "<h3>↩ 恢复路径 · " + esc(step.recovery.title) + "</h3>" +
      '<p class="impact">' + esc(step.recovery.impact) + "</p>" +
      "<ol>" + items + "</ol>" +
      '<div class="recovery-foot">' +
      (actionable
        ? '<button type="button" class="btn risk" data-act="recover">执行恢复（回滚）</button>' +
          '<span class="recovery-note">回滚后：流程回到本步骤待重做，其后步骤重新锁定并重置验证门。</span>'
        : '<span class="recovery-note">本步骤执行后，恢复入口在此保持可用；回滚是真实可走的路，不是说明文字。</span>') +
      "</div></div>"
    );
  }

  function gateHtml(step) {
    var arr = checksOf(step);
    var st = statusOf(step);
    var editable = st === "current";
    var rows = step.checks.map(function (c, i) {
      var checked = arr[i];
      return '<label class="check-row' + (editable ? "" : " disabled") + '">' +
        '<input type="checkbox" data-check-idx="' + i + '" ' + (checked ? "checked" : "") +
        (editable ? "" : " disabled") + "><span>" + esc(c) + "</span></label>";
    }).join("");
    var remaining = arr.filter(function (v) { return !v; }).length;
    var hint = !editable ? ""
      : remaining === 0
        ? '<div class="gate-hint ok">断言 ' + step.checks.length + "/" + step.checks.length + " 全部通过，可以完成本步骤。</div>"
        : '<div class="gate-hint">尚有 ' + remaining + " 项断言未确认——验证门未通过前，本步骤无法完成。</div>";
    return '<div class="gate" data-testid="gate">' + rows + hint + "</div>";
  }

  function contingencyHtml(step) {
    if (!step.contingency || !step.contingency.length) return "";
    var rows = step.contingency.map(function (c) {
      return "<li><b>若 " + esc(c.if) + "</b> → " + esc(c.then) + "</li>";
    }).join("");
    return '<div class="sec"><h2>异常分支</h2><div class="contingency"><ul>' + rows + "</ul></div></div>";
  }

  function stepDetailHtml(step) {
    var st = statusOf(step);
    var head =
      '<div class="card-head"><div class="phase-line">' + esc(step.phase.name) + " · 第 " + esc(step.code) + " 步 / 共 " + N + " 步</div>" +
      "<h1>" + esc(step.title) + "</h1>" +
      '<div class="head-chips">' + statusChipHtml(step) + riskChip(step) + "</div></div>";

    var instr =
      '<div class="sec"><h2>操作指令</h2><ol class="instr">' +
      step.detail.map(function (d) { return "<li>" + esc(d) + "</li>"; }).join("") +
      "</ol></div>";

    var riskBanner = step.risk === "irreversible"
      ? '<div class="risk-banner"><span class="icon">⚠</span><span><b>不可逆步骤。</b>执行前请确认下方恢复路径可用；执行后本步骤只能通过恢复路径回滚，无法撤销重做。</span></div>'
      : "";

    var gate = step.risk === "verification"
      ? '<div class="sec"><h2>验证门（须逐项确认）</h2>' + gateHtml(step) + "</div>"
      : "";

    var recovery = step.risk === "irreversible"
      ? '<div class="sec"><h2>恢复路径（执行前后均可用）</h2>' + recoveryHtml(step, st === "done") + "</div>"
      : "";

    var action = "";
    if (st === "locked") {
      action = '<div class="locked-note">🔒 此步骤已锁定。按顺序完成前置步骤后自动解锁——顺序强制是为了不给失误留入口。</div>';
    } else if (st === "current") {
      if (step.risk === "normal") {
        action = '<div class="action-row"><button type="button" class="btn primary big" data-act="complete">标记完成，进入下一步</button>' +
          '<span class="action-note">完成后自动聚焦下一步骤。</span></div>';
      } else if (step.risk === "verification") {
        action = '<div class="action-row"><button type="button" class="btn primary big" data-act="complete"' +
          (gatePassed(step) ? "" : " disabled") + ">通过验证门，进入下一步</button>" +
          '<span class="action-note">全部断言勾选后按钮解锁。</span></div>';
      } else {
        var redo = state.exec[step.id]
          ? '<span class="action-note">注意：该步骤此前已执行并回滚 ' + state.rollback[step.id] + " 次。</span>"
          : '<span class="action-note">执行需要键入确认短语——确认门 + 恢复路径双保险。</span>';
        action = '<div class="action-row"><button type="button" class="btn risk big" data-act="open-confirm">打开确认门…</button>' + redo + "</div>";
      }
    } else { // done
      action = '<div class="action-row"><span class="action-note">本步骤已完成' +
        (step.risk === "irreversible" ? "。如需撤销，使用上方恢复路径。" : "。") + "</span></div>";
    }

    return '<article class="card">' + head + riskBanner + instr + contingencyHtml(step) + gate + recovery + action + "</article>";
  }

  function doneHeroHtml() {
    var gates = STEPS.filter(function (s) { return s.risk === "verification"; });
    var irrev = STEPS.filter(function (s) { return s.risk === "irreversible"; });
    var gatesPassed = gates.filter(function (s) { return state.doneAt[s.id]; }).length;
    var execCount = irrev.reduce(function (a, s) { return a + (state.exec[s.id] || 0); }, 0);
    var rbCount = irrev.reduce(function (a, s) { return a + (state.rollback[s.id] || 0); }, 0);
    return '<article class="done-hero">' +
      '<div class="phase-line" style="color:#059669;font-weight:700;">✓ 流程完成</div>' +
      "<h1>发布全程零失误走完</h1>" +
      '<p class="lead">' + esc(RUNBOOK.code) + " · " + esc(RUNBOOK.release) + " 的全部 " + N + " 个步骤已按序完成。" +
      "每个不可逆步骤都经确认门执行，且恢复路径全程可见。点击「导出纪要」归档本次发布记录。</p>" +
      '<div class="done-stats">' +
      '<div class="stat"><b>' + N + "/" + N + '</b><span>步骤完成</span></div>' +
      '<div class="stat"><b>' + gatesPassed + "/" + gates.length + '</b><span>验证门通过</span></div>' +
      '<div class="stat"><b>' + execCount + '</b><span>不可逆执行（含重做）</span></div>' +
      '<div class="stat"><b>' + rbCount + '</b><span>恢复回滚</span></div>' +
      "</div>" +
      '<div class="action-row"><button type="button" class="btn primary big" data-act="export">导出发布纪要</button></div>' +
      "</article>";
  }

  function renderDetail() {
    var el = document.getElementById("detail");
    if (state.selected === null) { el.innerHTML = doneHeroHtml(); bindDetail(el); return; }
    var step = STEPS[idxOf(state.selected)];
    el.innerHTML = stepDetailHtml(step);
    bindDetail(el);
  }

  function bindDetail(root) {
    Array.prototype.forEach.call(root.querySelectorAll("[data-check-idx]"), function (box) {
      box.addEventListener("change", function () {
        toggleCheck(state.selected, parseInt(box.getAttribute("data-check-idx"), 10));
      });
    });
    Array.prototype.forEach.call(root.querySelectorAll("[data-act]"), function (btn) {
      var act = btn.getAttribute("data-act");
      btn.addEventListener("click", function () {
        if (act === "complete") advance(STEPS[idxOf(state.selected)]);
        else if (act === "open-confirm") openModal("execute", state.selected);
        else if (act === "recover") openModal("recover", state.selected);
        else if (act === "export") exportSummary();
      });
    });
  }

  function renderLog() {
    var el = document.getElementById("logPanel");
    var head = "<h2><span>执行日志</span><span class=\"count\">" + state.log.length + " 条</span></h2>";
    if (!state.log.length) {
      el.innerHTML = head + '<div class="log-empty">暂无执行记录。<br>完成第一步后，这里开始留痕。</div>';
      return;
    }
    var badgeText = { normal: "常规", verify: "验证", irreversible: "不可逆", recovery: "恢复" };
    var items = state.log.slice().reverse().map(function (e) {
      var rec = e.kind === "recovery" && e.sid
        ? '<div><button type="button" class="log-recover" data-resume="' + e.sid + '">查看该步骤</button></div>'
        : "";
      return '<div class="log-item"><div class="log-top"><span class="log-time">' + esc(e.t) +
        '</span><span class="badge ' + e.kind + '">' + badgeText[e.kind] + "</span></div>" +
        '<div class="log-text">' + esc(e.text) + "</div>" + rec + "</div>";
    }).join("");
    el.innerHTML = head + items;
    Array.prototype.forEach.call(el.querySelectorAll("[data-resume]"), function (btn) {
      btn.addEventListener("click", function () { selectStep(btn.getAttribute("data-resume")); });
    });
  }

  // ---- 确认门模态 ----
  function modalHtml() {
    var m = state.modal;
    if (!m) return "";
    var step = STEPS[idxOf(m.sid)];
    var inner;
    if (m.mode === "execute") {
      var redo = state.exec[step.id]
        ? '<p class="sub" style="color:#b45309;">注意：该步骤此前已执行并回滚 ' + state.rollback[step.id] + " 次，本次为第 " + (state.exec[step.id] + 1) + " 次执行。</p>"
        : "";
      inner =
        "<h2 id=\"modalTitle\">确认执行「" + esc(step.title) + "」</h2>" +
        '<p class="sub">此步骤<b>不可逆</b>：' + esc(step.detail[step.detail.length - 1]) +
        " 执行后无法撤销，只能通过下方恢复路径回滚。</p>" + redo +
        '<div class="risk-banner"><span class="icon">⚠</span><span>执行即对生产环境生效。</span></div>' +
        recoveryHtml(step, false) +
        '<div class="phrase-row"><label for="phraseInput">请键入确认短语 <code class="phrase">' + esc(step.confirmPhrase) + "</code> 以确认执行</label>" +
        '<input id="phraseInput" class="phrase-input" type="text" autocomplete="off" spellcheck="false" placeholder="' + esc(step.confirmPhrase) + '">' +
        '<div class="modal-error" id="phraseError">短语不一致。' + IRREVERSIBLE_EXEC_PHRASE_NOTE + "。</div></div>" +
        '<div class="modal-actions"><button type="button" class="btn ghost" data-act="cancel" style="color:#475569;border-color:#cbd5e1;">取消</button>' +
        '<button type="button" class="btn risk big" data-act="confirm-exec" disabled>确认执行</button></div>';
    } else {
      // recover
      inner =
        "<h2 id=\"modalTitle\">确认回滚「" + esc(step.title) + "」</h2>" +
        '<p class="sub">将按恢复路径执行：<b>' + esc(step.recovery.title) + "</b>。回滚后流程回到本步骤待重做，其后步骤重新锁定并重置验证门。</p>" +
        '<div class="risk-banner"><span class="icon">↩</span><span>回滚本身也会记入执行日志，可全程追溯。</span></div>' +
        recoveryHtml(step, false) +
        '<div class="phrase-row"><label for="phraseInput">请键入 <code class="phrase">' + RECOVER_PHRASE + "</code> 以确认回滚</label>" +
        '<input id="phraseInput" class="phrase-input" type="text" autocomplete="off" spellcheck="false" placeholder="' + RECOVER_PHRASE + '">' +
        '<div class="modal-error" id="phraseError">短语不一致。请键入 ' + RECOVER_PHRASE + "。</div></div>" +
        '<div class="modal-actions"><button type="button" class="btn ghost" data-act="cancel" style="color:#475569;border-color:#cbd5e1;">取消</button>' +
        '<button type="button" class="btn risk big" data-act="confirm-recover" disabled>确认回滚</button></div>';
    }
    return '<div class="modal-overlay"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="modalTitle">' + inner + "</div></div>";
  }

  function renderModal() {
    var root = document.getElementById("modalRoot");
    root.innerHTML = modalHtml();
    if (!state.modal) return;
    var step = STEPS[idxOf(state.modal.sid)];
    var expected = state.modal.mode === "execute" ? step.confirmPhrase : RECOVER_PHRASE;
    var input = root.querySelector("#phraseInput");
    var err = root.querySelector("#phraseError");
    var go = root.querySelector(state.modal.mode === "execute" ? "[data-act=confirm-exec]" : "[data-act=confirm-recover]");
    input.focus();
    function sync() { go.disabled = input.value.trim() !== expected; }
    input.addEventListener("input", function () { sync(); err.classList.remove("show"); });
    input.addEventListener("keydown", function (ev) {
      if (ev.key === "Enter" && input.value.trim() !== expected) err.classList.add("show");
    });
    Array.prototype.forEach.call(root.querySelectorAll("[data-act]"), function (btn) {
      btn.addEventListener("click", function () {
        var act = btn.getAttribute("data-act");
        if (act === "cancel") closeModal();
        else if (act === "confirm-exec") confirmExecute(step);
        else if (act === "confirm-recover") confirmRecover(step);
      });
    });
  }

  function openModal(mode, sid) { state.modal = { mode: mode, sid: sid }; renderModal(); }

  // ---- 导出 / 重置 / 提示 ----
  function exportSummary() {
    if (!state.log.length) { toast("尚无执行记录可导出——先开始执行流程。"); return; }
    var gates = STEPS.filter(function (s) { return s.risk === "verification"; });
    var irrev = STEPS.filter(function (s) { return s.risk === "irreversible"; });
    var gatesPassed = gates.filter(function (s) { return state.doneAt[s.id]; }).length;
    var execCount = irrev.reduce(function (a, s) { return a + (state.exec[s.id] || 0); }, 0);
    var rbCount = irrev.reduce(function (a, s) { return a + (state.rollback[s.id] || 0); }, 0);
    var lines = [];
    lines.push("发布纪要 — " + RUNBOOK.title + " " + RUNBOOK.code);
    lines.push("==============================================");
    lines.push("发布版本：" + RUNBOOK.release);
    lines.push("变更窗口：" + RUNBOOK.window + "　执行人：" + RUNBOOK.captain);
    lines.push("导出时间：" + new Date().toLocaleString("zh-CN", { hour12: false }));
    lines.push("进度：" + state.pointer + "/" + N + " 步完成　验证门：" + gatesPassed + "/" + gates.length +
      "　不可逆执行：" + execCount + " 次　回滚：" + rbCount + " 次");
    lines.push("");
    lines.push("已完成步骤：");
    STEPS.forEach(function (s) {
      if (state.doneAt[s.id]) lines.push("  " + s.code + " [" + s.phase.name + "] " + s.title + " — " + state.doneAt[s.id]);
    });
    lines.push("");
    lines.push("执行日志：");
    state.log.forEach(function (e) {
      var badgeText = { normal: "常规", verify: "验证", irreversible: "不可逆", recovery: "恢复" };
      lines.push("  " + e.t + " [" + badgeText[e.kind] + "] " + e.text);
    });
    var blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "发布纪要-" + RUNBOOK.code + ".txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
    toast("发布纪要已导出。");
  }

  function resetAll() {
    initState();
    render();
    toast("演练已重置回初始状态。");
  }

  var toastTimer = null;
  function toast(msg) {
    var root = document.getElementById("toastRoot");
    root.innerHTML = '<div class="toast">' + esc(msg) + "</div>";
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { root.innerHTML = ""; }, 2600);
  }

  // ---- 全局事件 ----
  document.addEventListener("keydown", function (ev) {
    if (ev.key === "Escape" && state.modal) closeModal();
  });
  document.getElementById("exportBtn").addEventListener("click", exportSummary);
  document.getElementById("resetBtn").addEventListener("click", resetAll);

  // ---- 启动：数据随脚本内联就绪，首屏直接渲染为可执行状态（无加载态） ----
  initState();
  render();
})();
