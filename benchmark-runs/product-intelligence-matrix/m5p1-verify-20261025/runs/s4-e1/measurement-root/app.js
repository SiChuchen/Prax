/* Runbook walker — strict-order execution of one high-consequence workflow.
   Irreversible steps pass a typed confirmation gate that previews the rollback plan;
   executed irreversible steps keep an inline recovery path. All data is inlined
   (data.js), so the first paint is the complete, usable screen. */
(function () {
  "use strict";

  var RB = window.RUNBOOK;

  /* ---------- Flatten phases → ordered steps with prerequisites ---------- */
  var PHASES = RB.phases.map(function (p, pi) {
    return {
      id: p.id, num: pi + 1, title: p.title, goal: p.goal,
      steps: p.steps
    };
  });
  var STEPS = [];
  PHASES.forEach(function (p) {
    p.steps.forEach(function (s, si) {
      s.phaseId = p.id;
      s.order = STEPS.length;
      // Strict order: a step requires every step before it.
      s.requires = si === 0
        ? (STEPS.length ? [STEPS[STEPS.length - 1].id] : [])
        : [p.steps[si - 1].id];
      STEPS.push(s);
    });
  });
  var STEP_BY_ID = {};
  STEPS.forEach(function (s) { STEP_BY_ID[s.id] = s; });
  function dependentsOf(id) {
    return STEPS.filter(function (s) { return s.requires.indexOf(id) !== -1; });
  }

  /* ---------- State (session-local; no persistence by design) ---------- */
  var store = {
    done: {},            // stepId -> true
    rolledBack: {},      // stepId -> true (irreversible step currently rolled back)
    open: {},            // stepId -> expanded
    checks: {},          // stepId -> { checkIndex -> true }
    log: [],
    gateStepId: null,    // confirm gate open for this step
    gateChecks: {},
    gatePhrase: "",
    logOpen: false,
    resetArmed: false,
    rollbackArmed: null  // stepId awaiting rollback confirmation
  };

  /* ---------- Helpers ---------- */
  function now() { return new Date().toLocaleTimeString("en-GB", { hour12: false }); }
  function log(type, text) { store.log.push({ t: now(), type: type, text: text }); }
  function isDone(id) { return !!store.done[id]; }
  function isUnlocked(s) {
    if (!s.requires.length) return true;
    return s.requires.every(function (r) { return isDone(r); });
  }
  function currentStep() {
    for (var i = 0; i < STEPS.length; i++) if (!isDone(STEPS[i].id)) return STEPS[i];
    return null;
  }
  function phaseComplete(p) { return p.steps.every(function (s) { return isDone(s.id); }); }
  function doneCount() { return STEPS.filter(function (s) { return isDone(s.id); }).length; }
  function allDone() { return doneCount() === STEPS.length; }
  function irreversibleCount() { return STEPS.filter(function (s) { return !s.reversible; }).length; }
  function rollbackAvailable(s) {
    // Recovery path stays usable until a dependent step has executed.
    return dependentsOf(s.id).every(function (d) { return !isDone(d.id); });
  }
  function checksAllTicked(s) {
    var c = store.checks[s.id] || {};
    return s.checkpoints.every(function (_, i) { return !!c[i]; });
  }
  function escapeHtml(t) {
    return String(t).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }

  var ICONS = {
    lock: '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3.5" y="7" width="9" height="6.5" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
    check: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5 6.5 12 13 4.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    alert: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2 15 14H1L8 2z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M8 6.5v3.2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="8" cy="12" r=".9" fill="currentColor"/></svg>',
    chev: '<svg class="step-chev" width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 6l5 5 5-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    undo: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 7h7a3.5 3.5 0 1 1 0 7H6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M6 4 3 7l3 3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    circle: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="5.5" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>'
  };

  function statusOfRunbook() {
    if (allDone()) return "complete";
    if (doneCount() > 0) return "in-progress";
    return "not-started";
  }

  /* ---------- Render ---------- */
  function render() {
    renderHeader();
    renderCompletion();
    renderLadder();
    renderLog();
    renderGate();
  }

  function renderHeader() {
    var done = doneCount(), total = STEPS.length, st = statusOfRunbook();
    var pill = document.getElementById("status-pill");
    pill.dataset.state = st;
    pill.textContent = st === "complete" ? "Complete" : st === "in-progress" ? "In progress" : "Not started";
    document.getElementById("progress-label").textContent = done + " of " + total + " steps";
    var bar = document.getElementById("progress-bar");
    bar.setAttribute("aria-valuemax", String(total));
    bar.setAttribute("aria-valuenow", String(done));
    bar.setAttribute("aria-valuetext", done + " of " + total + " steps complete");
    document.getElementById("progress-fill").style.width = (total ? (done / total) * 100 : 0) + "%";
    var rb = document.getElementById("reset-btn");
    rb.textContent = store.resetArmed ? "Confirm reset?" : "Reset runbook";
    rb.classList.toggle("btn-danger-ghost", !store.resetArmed);
    rb.classList.toggle("btn-danger", store.resetArmed);
  }

  function renderCompletion() {
    var el = document.getElementById("completion");
    if (!allDone()) { el.hidden = true; el.innerHTML = ""; return; }
    var confirmed = STEPS.filter(function (s) { return !s.reversible && isDone(s.id); }).length;
    var rollbacks = store.log.filter(function (e) { return e.type === "rollback"; }).length;
    var phaseLines = PHASES.map(function (p) {
      var items = p.steps.map(function (s) {
        return "<li><b>" + escapeHtml(s.title) + "</b> — " + escapeHtml(s.outcome) + "</li>";
      }).join("");
      return "<li><b>Phase " + p.num + " · " + escapeHtml(p.title) + "</b></li>" + items;
    }).join("");
    el.hidden = false;
    el.innerHTML =
      '<h2 id="completion-title">' + ICONS.check + "Runbook complete — zero missteps</h2>" +
      '<p class="c-sub">Every step executed in strict order. Every irreversible action passed its typed confirmation gate, ' +
      "with its rollback plan previewed first. The full audit trail is in the activity log.</p>" +
      '<div class="c-stats">' +
        '<div class="c-stat"><b>' + doneCount() + "/" + STEPS.length + "</b><span>steps executed</span></div>" +
        '<div class="c-stat"><b>' + confirmed + "/" + irreversibleCount() + "</b><span>gates confirmed</span></div>" +
        '<div class="c-stat"><b>' + rollbacks + "</b><span>rollbacks exercised</span></div>" +
        '<div class="c-stat"><b>' + store.log.length + "</b><span>audit entries</span></div>" +
      "</div>" +
      '<ul class="c-phases">' + phaseLines + "</ul>";
  }

  function renderLadder() {
    var cur = currentStep();
    var html = PHASES.map(function (p) {
      var pDone = p.steps.filter(function (s) { return isDone(s.id); }).length;
      var rows = p.steps.map(function (s) { return stepHtml(s, cur); }).join("");
      return (
        '<section class="phase' + (phaseComplete(p) ? " is-complete" : "") + '" aria-labelledby="' + p.id + '-title">' +
          '<div class="phase-head">' +
            '<span class="phase-num" aria-hidden="true">' + p.num + "</span>" +
            '<h2 class="phase-title" id="' + p.id + '-title">' + escapeHtml(p.title) + "</h2>" +
            '<span class="phase-count">' + pDone + "/" + p.steps.length + " steps</span>" +
          "</div>" +
          '<p class="phase-goal">' + escapeHtml(p.goal) + "</p>" +
          rows +
        "</section>"
      );
    }).join("");
    document.getElementById("ladder").innerHTML = html;
  }

  function stepHtml(s, cur) {
    var done = isDone(s.id), unlocked = isUnlocked(s);
    var isCur = cur && cur.id === s.id;
    var rolled = !!store.rolledBack[s.id];
    var isOpen = !!store.open[s.id] || (!!isCur && store.open[s.id] !== false);
    var cls = "step" + (done ? " is-done" : "") + (isCur ? " is-current" : "") +
      (!unlocked ? " is-locked" : "") + (isOpen ? " is-open" : "");

    var marker = done ? ICONS.check : (!unlocked ? ICONS.lock : ICONS.circle);
    var summaryText = done ? s.outcome : s.summary;
    var badge = !s.reversible
      ? '<span class="badge badge-irrev">' + ICONS_LOCK_WORD + "</span>"
      : '<span class="badge badge-check">Standard</span>';
    var side = '<span class="step-side">' +
      (isCur ? '<span class="badge badge-upnext">Up next</span>' : "") +
      (rolled ? '<span class="badge badge-rolled">Rolled back</span>' : (done ? '<span class="badge badge-done">Done</span>' : "")) +
      badge + ICONS.chev + "</span>";

    var row =
      '<button type="button" class="step-row" data-action="toggle-step" data-step="' + s.id + '"' +
        ' aria-expanded="' + isOpen + '"' + (isCur ? ' aria-current="step"' : "") + ">" +
        '<span class="step-marker" aria-hidden="true">' + marker + "</span>" +
        '<span class="step-main">' +
          '<span class="step-title-line"><span class="step-title">' + (s.order + 1) + ". " + escapeHtml(s.title) + "</span></span>" +
          '<span class="step-summary">' + escapeHtml(summaryText) + "</span>" +
        "</span>" + side +
      "</button>";

    var body = "";
    if (isOpen) body = '<div class="step-body">' + stepBody(s, done, unlocked, rolled) + "</div>";
    return '<article class="' + cls + '" data-step-id="' + s.id + '">' + row + body + "</article>";
  }

  var ICONS_LOCK_WORD = "Irreversible"; // plain-language badge; icon lives on the marker

  function stepBody(s, done, unlocked, rolled) {
    var h = "";
    h += '<ul class="step-detail">' + s.detail.map(function (d) { return "<li>" + d + "</li>"; }).join("") + "</ul>";
    h += '<div class="step-meta">' +
      "<span><b>Owner:</b> " + escapeHtml(s.owner) + "</span>" +
      "<span><b>Est.:</b> " + escapeHtml(s.est) + "</span>" +
      "<span><b>Systems:</b> " + escapeHtml(s.systems.join(", ")) + "</span>" +
      "</div>";

    if (done) {
      h += '<p class="step-outcome">' + ICONS.check + " Outcome: " + escapeHtml(s.outcome) + "</p>";
      if (!s.reversible) {
        var avail = rollbackAvailable(s);
        var armed = store.rollbackArmed === s.id;
        h += '<div class="step-actions">' +
          '<button type="button" class="btn btn-danger-ghost" data-action="rollback" data-step="' + s.id + '"' +
            (!avail ? " disabled" : "") + ">" + ICONS.undo + (armed ? "Confirm rollback" : "Roll back") + "</button>";
        if (!avail) {
          h += '<span class="step-hint is-error">Rollback window closed — a dependent step has already executed.</span>';
        } else if (armed) {
          h += '<span class="step-hint">This undoes the step and re-locks anything that depends on it. <b>Click again to confirm.</b></span>';
        } else {
          h += '<span class="step-hint">Recovery path: ' + escapeHtml(s.rollback.title) + " (" + escapeHtml(s.rollback.rto) + ").</span>";
        }
        h += "</div>";
        h += '<p class="rb-note">Executed through its confirmation gate on this run; the gate previewed this exact rollback plan before you proceeded.</p>';
      }
      return h;
    }

    // Not done yet.
    if (!s.reversible) {
      h += '<div class="step-actions">' +
        '<button type="button" class="btn btn-danger btn-large" data-action="open-gate" data-step="' + s.id + '"' +
          (!unlocked ? " disabled" : "") + ">" + ICONS.alert + " Execute irreversible step…</button>" +
        '<span class="step-hint">Opens a confirmation gate: consequence, rollback plan, and typed confirmation.</span>' +
        "</div>";
    } else {
      if (s.checkpoints) {
        var c = store.checks[s.id] || {};
        h += '<div class="checks"><p class="checks-title">Checkpoints — confirm before completing</p>' +
          s.checkpoints.map(function (cp, i) {
            return '<label class="check"><input type="checkbox" data-check="' + s.id + ':' + i + '"' +
              (c[i] ? " checked" : "") + (!unlocked ? " disabled" : "") + "> <span>" + escapeHtml(cp) + "</span></label>";
          }).join("") + "</div>";
      }
      var ready = unlocked && (!s.checkpoints || checksAllTicked(s));
      h += '<div class="step-actions">' +
        '<button type="button" class="btn btn-primary btn-large" data-action="complete" data-step="' + s.id + '"' +
          (!ready ? " disabled" : "") + ">Mark step complete</button>";
      if (!unlocked) h += '<span class="step-hint">Locked — finish the previous step first.</span>';
      else if (s.checkpoints && !checksAllTicked(s)) h += '<span class="step-hint">Tick every checkpoint to enable completion.</span>';
      h += "</div>";
    }
    return h;
  }

  function renderLog() {
    var list = document.getElementById("log-list");
    var empty = document.getElementById("log-empty");
    list.innerHTML = store.log.map(function (e) {
      return "<li><span class='log-time'>" + e.t + "</span>" +
        "<span class='log-chip log-chip-" + e.type + "'>" + e.type + "</span>" +
        "<span class='log-text'>" + escapeHtml(e.text) + "</span></li>";
    }).join("");
    empty.hidden = store.log.length > 0;
    var drawer = document.getElementById("log-drawer");
    drawer.classList.toggle("open", store.logOpen);
    drawer.setAttribute("aria-hidden", String(!store.logOpen));
    var btn = document.getElementById("log-toggle");
    btn.setAttribute("aria-expanded", String(store.logOpen));
  }

  /* ---------- Confirm gate ---------- */
  function openGate(stepId) {
    var s = STEP_BY_ID[stepId];
    if (!s || isDone(stepId) || !isUnlocked(s)) return;
    store.gateStepId = stepId;
    store.gateChecks = {};
    store.gatePhrase = "";
    log("info", "Opened confirmation gate for \"" + s.title + "\".");
    render();
    focusGate();
  }
  function closeGate() {
    if (!store.gateStepId) return;
    store.gateStepId = null;
    render();
    var el = document.querySelector(".step.is-current .step-row");
    if (el) el.focus();
  }
  function gateValid() {
    var s = STEP_BY_ID[store.gateStepId];
    if (!s) return false;
    var checksOk = GATE_CHECK_IDS.every(function (i) { return !!store.gateChecks[i]; });
    var phraseOk = store.gatePhrase.trim().toUpperCase() === s.confirmPhrase;
    return checksOk && phraseOk;
  }
  function renderGate() {
    var scrim = document.getElementById("gate-scrim");
    var gate = document.getElementById("gate");
    if (!store.gateStepId) { scrim.hidden = true; gate.innerHTML = ""; return; }
    scrim.hidden = false;
    var s = STEP_BY_ID[store.gateStepId];
    gate.innerHTML =
      '<p class="gate-eyebrow">' + ICONS.alert + " Irreversible — point of no return</p>" +
      '<h2 id="gate-title">' + escapeHtml(s.title) + "</h2>" +
      '<p class="gate-consequence"><b>What happens if you proceed:</b> ' + escapeHtml(s.consequence) + "</p>" +
      '<div class="rb-card">' +
        "<h3>Rollback plan — your recovery path</h3>" +
        '<p class="rb-title">' + escapeHtml(s.rollback.title) + "</p>" +
        "<ol>" + s.rollback.steps.map(function (r) { return "<li>" + escapeHtml(r) + "</li>"; }).join("") + "</ol>" +
        '<div class="rb-meta"><span>Recovery time: ' + escapeHtml(s.rollback.rto) + "</span><span>" +
          escapeHtml(s.rollback.note) + "</span></div>" +
      "</div>" +
      '<div class="gate-checks">' +
        GATE_CHECKS.map(function (c, i) {
          return '<label class="check"><input type="checkbox" data-gate-check="' + i + '"' +
            (store.gateChecks[i] ? " checked" : "") + "> <span>" + escapeHtml(c) + "</span></label>";
        }).join("") +
      "</div>" +
      '<div class="gate-phrase">' +
        "<label for=\"gate-phrase-input\">Type <code>" + escapeHtml(s.confirmPhrase) + "</code> to confirm</label>" +
        '<input id="gate-phrase-input" type="text" autocomplete="off" spellcheck="false" value="' + escapeHtml(store.gatePhrase) + '">' +
        '<p class="phrase-error" id="gate-phrase-error"></p>' +
      "</div>" +
      '<div class="gate-actions">' +
        '<button type="button" class="btn" data-action="close-gate">Cancel — stay on the ladder</button>' +
        '<button type="button" class="btn btn-danger btn-large" data-action="gate-execute" disabled>' + ICONS.alert + " Execute now</button>" +
      "</div>";
    updateGateButton();
  }
  function updateGateButton() {
    var gate = document.getElementById("gate");
    var btn = gate.querySelector("[data-action='gate-execute']");
    var err = document.getElementById("gate-phrase-error");
    var s = STEP_BY_ID[store.gateStepId];
    if (!btn || !s) return;
    var phraseOk = store.gatePhrase.trim().toUpperCase() === s.confirmPhrase;
    var valid = gateValid();
    btn.disabled = !valid;
    if (store.gatePhrase.length > 0 && !phraseOk) {
      err.textContent = "Phrase does not match yet — check spelling and spacing.";
    } else {
      err.textContent = "";
    }
  }
  function executeFromGate() {
    var s = STEP_BY_ID[store.gateStepId];
    if (!s || !gateValid()) return;
    log("confirmed", "Typed confirmation accepted for \"" + s.title + "\" (rollback plan acknowledged).");
    log("executed", "Executed \"" + s.title + "\" — " + s.outcome);
    store.done[s.id] = true;
    delete store.rolledBack[s.id];
    // Keep the executed irreversible step expanded: its recovery path must stay visible.
    store.open[s.id] = true;
    store.gateStepId = null;
    render();
    announce("Executed: " + s.title);
    scrollCurrent();
  }
  function focusGate() {
    var first = document.querySelector("#gate input, #gate button");
    if (first) first.focus();
  }
  function scrollCurrent() {
    var el = document.querySelector(".step.is-current");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }
  function announce(msg) {
    var t = document.getElementById("toast");
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(announce._t);
    announce._t = setTimeout(function () { t.hidden = true; }, 2600);
  }

  var GATE_CHECKS = [
    "I have read the consequence and the rollback plan above.",
    "I confirm no dependent step will break if I proceed now."
  ];
  var GATE_CHECK_IDS = [0, 1];

  /* ---------- Actions ---------- */
  function toggleStep(id) {
    var s = STEP_BY_ID[id];
    if (!s) return;
    var el = document.querySelector(".step[data-step-id='" + id + "']");
    var visuallyOpen = el ? el.classList.contains("is-open") : false;
    store.open[id] = !visuallyOpen;
    render();
  }
  function completeStep(id) {
    var s = STEP_BY_ID[id];
    if (!s || !isUnlocked(s) || isDone(id)) return;
    if (s.checkpoints && !checksAllTicked(s)) return;
    log("executed", "Completed \"" + s.title + "\" — " + s.outcome);
    store.done[id] = true;
    store.open[id] = false; // collapse: the one-line summary now carries the recorded outcome
    store.rollbackArmed = null;
    render();
    announce("Completed: " + s.title);
    scrollCurrent();
  }
  function rollback(id) {
    var s = STEP_BY_ID[id];
    if (!s || !isDone(id) || s.reversible) return;
    if (!rollbackAvailable(s)) return;
    if (store.rollbackArmed !== id) {
      store.rollbackArmed = id;
      render();
      return;
    }
    store.rollbackArmed = null;
    delete store.done[id];
    store.rolledBack[id] = true;
    log("rollback", "Rolled back \"" + s.title + "\" via: " + s.rollback.title + " (" + s.rollback.rto + "). Step re-armed for re-execution.");
    render();
    announce("Rolled back: " + s.title);
  }
  function resetRunbook() {
    if (!store.resetArmed) {
      store.resetArmed = true;
      render();
      clearTimeout(resetRunbook._t);
      resetRunbook._t = setTimeout(function () { store.resetArmed = false; renderHeader(); }, 4000);
      return;
    }
    store.resetArmed = false;
    store.done = {}; store.rolledBack = {}; store.open = {}; store.checks = {};
    store.rollbackArmed = null; store.gateStepId = null;
    store.log = [];
    log("reset", "Runbook reset — fresh rehearsal started from Preflight.");
    render();
    window.scrollTo({ top: 0, behavior: "smooth" });
    announce("Runbook reset");
  }
  function toggleLog(force) {
    store.logOpen = typeof force === "boolean" ? force : !store.logOpen;
    renderLog();
  }

  /* ---------- Events (delegated) ---------- */
  document.addEventListener("click", function (ev) {
    var el = ev.target.closest("[data-action]");
    if (!el) {
      if (store.gateStepId && ev.target === document.getElementById("gate-scrim")) closeGate();
      return;
    }
    var a = el.dataset.action, id = el.dataset.step;
    switch (a) {
      case "toggle-step": toggleStep(id); break;
      case "complete": completeStep(id); break;
      case "open-gate": openGate(id); break;
      case "rollback": rollback(id); break;
      case "close-gate": closeGate(); break;
      case "gate-execute": executeFromGate(); break;
      case "toggle-log": toggleLog(); break;
      case "close-log": toggleLog(false); break;
      case "reset": resetRunbook(); break;
    }
  });

  document.addEventListener("change", function (ev) {
    var t = ev.target;
    if (t.matches("[data-check]")) {
      var parts = t.dataset.check.split(":");
      var sid = parts[0], idx = parts[1];
      store.checks[sid] = store.checks[sid] || {};
      store.checks[sid][idx] = t.checked;
      // Re-render just this step's action button state.
      render();
    } else if (t.matches("[data-gate-check]")) {
      store.gateChecks[t.dataset.gateCheck] = t.checked;
      updateGateButton();
    }
  });

  document.addEventListener("input", function (ev) {
    if (ev.target.id === "gate-phrase-input") {
      store.gatePhrase = ev.target.value;
      updateGateButton();
    }
  });

  document.addEventListener("keydown", function (ev) {
    if (ev.key === "Escape") {
      if (store.gateStepId) { closeGate(); return; }
      if (store.logOpen) { toggleLog(false); document.getElementById("log-toggle").focus(); return; }
      if (store.resetArmed) { store.resetArmed = false; renderHeader(); return; }
    }
    if (ev.key === "Tab" && store.gateStepId) {
      // Focus trap inside the gate.
      var focusables = Array.prototype.slice.call(
        document.querySelectorAll("#gate button, #gate input")).filter(function (n) { return !n.disabled; });
      if (!focusables.length) return;
      var first = focusables[0], last = focusables[focusables.length - 1];
      if (ev.shiftKey && document.activeElement === first) { ev.preventDefault(); last.focus(); }
      else if (!ev.shiftKey && document.activeElement === last) { ev.preventDefault(); first.focus(); }
    }
  });

  /* ---------- Boot: synchronous first paint, data already inlined ---------- */
  document.getElementById("rh-eyebrow").textContent = RB.meta.eyebrow;
  document.getElementById("rh-title").textContent = RB.meta.title;
  document.getElementById("rh-meta").innerHTML =
    "<span>" + escapeHtml(RB.meta.owner) + "</span><span>" + escapeHtml(RB.meta.window) + "</span><span>" +
    escapeHtml(RB.meta.version) + "</span>";
  log("info", "Runbook " + "RW-2026-0914" + " loaded — rehearsal session started.");
  // Open the first actionable step so the task is obvious at first paint.
  var first = currentStep();
  if (first) store.open[first.id] = true;
  render();
})();
