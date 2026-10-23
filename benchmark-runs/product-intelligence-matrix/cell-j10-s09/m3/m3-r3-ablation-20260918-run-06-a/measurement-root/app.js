/* 发布指挥台 · 应用逻辑（无框架，无网络请求） */
(function () {
  "use strict";

  var FLOW = window.FLOW;
  var KIND_LABEL = { check: "逐项检查", action: "执行操作", gate: "观察门禁", irreversible: "不可逆" };
  var KIND_CLASS = { check: "kind-check", action: "kind-action", gate: "kind-gate", irreversible: "kind-irreversible" };

  // ── 状态 ───────────────────────────────────────────────────
  var S = {
    startedAt: Date.now(),
    finished: false,
    finishedAt: null,
    currentIdx: 0,
    viewIdx: 0,
    steps: [],
    mistakes: [],
    log: [],
    stats: { confirms: 0, recoveries: 0, recActs: 0, gates: 0 },
  };
  var modalStepId = null;

  function initState() {
    S.steps = FLOW.steps.map(function (st, i) {
      var s = Object.assign({}, st);
      s.idx = i;
      s.status = "locked"; // locked | active | done
      s.err = false;
      s.checksDone = {};
      s.actsDone = {};
      s.recoveryViewed = false;
      s.recovering = false;
      s.recoveryActsDone = {};
      s.metricsRoll = null;
      s.verdict = null; // 'pass' | 'recovered'
      s.execCount = 0;
      if (s.kind === "gate") rollGate(s);
      return s;
    });
    S.steps[0].status = "active";
  }

  function rollGate(st, forceGood) {
    var bad = !forceGood && Math.random() < (st.gate.badChance || 0.3);
    st.metricsRoll = bad ? "bad" : "good";
  }

  function metricValue(st, m) {
    var v = st.metricsRoll === "bad" ? m.bad : m.good;
    return v.toFixed(m.decimals);
  }

  // ── 工具 ───────────────────────────────────────────────────
  function $(id) { return document.getElementById(id); }
  function esc(t) {
    return String(t).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function nowStr() {
    var d = new Date();
    function p(n) { return (n < 10 ? "0" : "") + n; }
    return p(d.getHours()) + ":" + p(d.getMinutes()) + ":" + p(d.getSeconds());
  }
  function fmtElapsed(ms) {
    var s = Math.floor(ms / 1000);
    var m = Math.floor(s / 60);
    s = s % 60;
    return (m < 10 ? "0" : "") + m + ":" + (s < 10 ? "0" : "") + s;
  }
  function logEvent(text, tone) {
    S.log.unshift({ t: nowStr(), text: text, tone: tone || "" });
    if (S.log.length > 30) S.log.pop();
  }
  function toast(text, tone) {
    var box = $("toasts");
    var el = document.createElement("div");
    el.className = "toast " + (tone || "");
    el.textContent = text;
    box.appendChild(el);
    setTimeout(function () { el.remove(); }, 3600);
  }
  function recordMistake(st, text) {
    st.err = true;
    S.mistakes.push({ t: nowStr(), step: st.title, text: text });
    logEvent("失误：" + text, "danger");
    toast("已记 1 次失误：" + text, "danger");
  }

  // ── 流程推进 ───────────────────────────────────────────────
  function completeStep(st) {
    st.status = "done";
    logEvent("步骤完成：" + st.title, "good");
    var prevPhase = st.phase;
    var next = null;
    for (var i = 0; i < S.steps.length; i++) {
      if (S.steps[i].status !== "done") { next = S.steps[i]; break; }
    }
    if (!next) { finish(); return; }
    next.status = "active";
    S.currentIdx = next.idx;
    S.viewIdx = next.idx;
    if (next.phase !== prevPhase) {
      var ph = phaseById(next.phase);
      toast("进入阶段：" + ph.name, "");
      logEvent("进入阶段：" + ph.name, "");
    }
    render();
  }

  function phaseById(id) {
    for (var i = 0; i < FLOW.phases.length; i++) if (FLOW.phases[i].id === id) return FLOW.phases[i];
    return null;
  }

  function startRecovery(st) {
    st.recovering = true;
    st.recoveryActsDone = {};
    logEvent("进入恢复路径：" + st.recovery.kicker, "warn");
    toast("已进入恢复路径：" + st.recovery.kicker, "warn");
  }

  function gateJudge(st, passJudged) {
    S.stats.gates++;
    var healthy = st.metricsRoll === "good";
    if (passJudged && healthy) {
      st.verdict = st.recovering ? "recovered" : "pass";
      st.recovering = false;
      toast("门禁通过：" + st.title, "good");
      logEvent("门禁通过：" + st.title, "good");
      completeStep(st);
    } else if (!passJudged && !healthy) {
      // 正确识别越限 → 走恢复路径，不算失误
      st.verdict = null;
      startRecovery(st);
      render();
    } else if (passJudged && !healthy) {
      var names = st.gate.metrics.map(function (m) { return m.name; }).join("、");
      recordMistake(st, "误判达标：" + names + "越限");
      startRecovery(st);
      render();
    } else {
      recordMistake(st, "误判未达标：各项指标均在阈值内");
      render();
    }
  }

  function finish() {
    S.finished = true;
    S.finishedAt = Date.now();
    logEvent("全程完成，输出判定", "good");
    renderOverlay();
    render();
  }

  // ── 渲染：左栏 ─────────────────────────────────────────────
  function renderRail() {
    var html = "";
    FLOW.phases.forEach(function (ph) {
      var stepIdxs = S.steps.filter(function (s) { return s.phase === ph.id; });
      var done = stepIdxs.filter(function (s) { return s.status === "done"; }).length;
      var groupState = done === stepIdxs.length ? "done" : (done > 0 || stepIdxs.some(function (s) { return s.status === "active"; })) ? "active" : "locked";
      html += '<div class="phase-group ' + groupState + '">';
      html += '<div class="phase-head"><span class="phase-dot"></span><span class="phase-name">' + esc(ph.name) + '</span><span class="phase-count">' + done + "/" + stepIdxs.length + "</span></div>";
      html += '<div class="phase-intent">' + esc(ph.intent) + "</div>";
      html += '<ul class="phase-steps">';
      stepIdxs.forEach(function (st) {
        var cls = st.status;
        if (st.err) cls += " err";
        var clickable = st.status !== "locked";
        html += '<li class="step-item ' + cls + '"' + (clickable ? ' data-action="view-step" data-idx="' + st.idx + '" style="cursor:pointer"' : "") + ">";
        html += '<span class="st-num">' + st.id.replace("-", "-") + "</span>";
        html += '<span class="st-title">' + esc(st.title) + "</span>";
        if (st.kind === "irreversible") html += '<span class="st-irr">不可逆</span>';
        if (st.status === "done") html += '<span class="st-check">✓</span>';
        html += "</li>";
      });
      html += "</ul></div>";
    });
    $("rail").innerHTML = html;
  }

  // ── 渲染：中栏 ─────────────────────────────────────────────
  function taskRow(st, opts) {
    var interactive = opts.interactive;
    var html = '<ul class="task-list">';
    opts.items.forEach(function (item) {
      var isDone = item.done;
      html += '<li class="task ' + (isDone ? "is-done" : "") + '">';
      if (item.type === "check") {
        html += '<button class="task-box" data-action="toggle-check" data-step="' + st.id + '" data-key="' + item.key + '"' + (interactive && !isDone ? "" : " disabled") + ">✓</button>";
        html += '<span class="task-label">' + esc(item.label) + "</span>";
      } else if (isDone) {
        html += '<span class="task-box" style="cursor:default">✓</span>';
        html += '<span class="task-label">' + esc(item.label) + '</span><span class="task-result">' + esc(item.result) + "</span>";
      } else {
        html += '<button class="btn btn-primary" data-action="do-act" data-step="' + st.id + '" data-key="' + item.key + '"' + (interactive ? "" : " disabled") + ">执行</button>";
        html += '<span class="task-label">' + esc(item.label) + "</span>";
      }
      html += "</li>";
    });
    return html + "</ul>";
  }

  function recoveryDetails(st, interactive) {
    var r = st.recovery;
    var viewedTag = st.recoveryViewed ? '<span class="viewed-tag">已查阅 ✓</span>' : "";
    var html = '<details class="recovery-panel' + (st.recoveryViewed ? " viewed" : "") + '" data-step="' + st.id + '"' + (st.recoveryOpen ? " open" : "") + '><summary><span>🔖 ' + esc(r.kicker) + "</span>" + viewedTag + '</summary><div class="recovery-body">';
    if (r.intro) html += '<p style="font-size:12.5px;color:var(--muted);margin:6px 0 4px">' + esc(r.intro) + "</p>";
    if (r.steps) {
      r.steps.forEach(function (s, i) {
        html += '<div class="rec-step"><span class="n">' + (i + 1) + ".</span><span>" + esc(s) + "</span></div>";
      });
    }
    if (r.actions) {
      r.actions.forEach(function (a) {
        var done = st.recoveryActsDone[a.id];
        html += '<div class="rec-step"><span class="n">·</span><span style="flex:1">' + esc(a.label);
        if (done) html += ' <span class="task-result">' + esc(a.result || "已确认") + "</span>";
        html += "</span>";
        if (interactive && st.recovering && !done) {
          html += a.type === "check"
            ? '<button class="task-box" data-action="rec-check" data-step="' + st.id + '" data-key="' + a.id + '">✓</button>'
            : '<button class="btn" data-action="rec-act" data-step="' + st.id + '" data-key="' + a.id + '">执行</button>';
        }
        html += "</div>";
      });
    }
    if (r.note) html += '<p class="rec-note">※ ' + esc(r.note) + "</p>";
    if (interactive && st.recovering) {
      var allDone = r.actions.every(function (a) { return st.recoveryActsDone[a.id]; });
      html += '<div style="margin-top:12px"><button class="btn btn-good" data-action="rec-retry" data-step="' + st.id + '"' + (allDone ? "" : " disabled") + ">" + esc(r.retryLabel) + "</button>";
      if (!allDone) html += ' <span class="foot-meta">先完成上方恢复动作</span></div>';
      else html += "</div>";
    }
    html += "</div></details>";
    return html;
  }

  function renderStage() {
    var st = S.steps[S.viewIdx];
    var isCurrent = st.idx === S.currentIdx && !S.finished;
    var html = '<div class="stage-inner">';
    html += '<div class="kind-row"><span class="kind-badge ' + KIND_CLASS[st.kind] + '">' + KIND_LABEL[st.kind] + '</span><span class="step-crumb">阶段 ' + phaseById(st.phase).name + " · " + st.id + " · 预计 " + esc(st.est) + "</span></div>";
    html += "<h1>" + esc(st.title) + "</h1>";
    html += '<p class="stage-desc">' + esc(st.desc) + "</p>";

    if (st.status === "done") {
      html += '<div class="done-banner">✓ 本步骤已完成';
      if (st.kind === "gate") html += "<span>（判定：" + (st.verdict === "recovered" ? "经恢复路径后通过" : "达标通过") + "）</span>";
      if (st.kind === "irreversible") html += "<span>（已执行，短语确认 ×" + st.execCount + "）</span>";
      html += "</div>";
    }

    if (st.kind === "check") {
      html += taskRow(st, {
        interactive: isCurrent,
        items: st.checks.map(function (c, i) {
          return { type: "check", key: "c" + i, label: c, done: !!st.checksDone["c" + i] };
        }),
      });
    } else if (st.kind === "action") {
      html += taskRow(st, {
        interactive: isCurrent,
        items: st.actions.map(function (a, i) {
          return { type: "act", key: "a" + i, label: a.label, result: a.result, done: !!st.actsDone["a" + i] };
        }),
      });
    } else if (st.kind === "gate") {
      if (st.recovering && isCurrent) {
        html += '<div class="gate-recovering-strip"><b>恢复中</b><span>已按「' + esc(st.recovery.kicker) + '」处置，完成后复判。正确处置不计失误。</span></div>';
      }
      html += '<table class="gate-table"><thead><tr><th>指标</th><th>当前值</th><th>阈值</th></tr></thead><tbody>';
      st.gate.metrics.forEach(function (m) {
        html += '<tr><td class="m-name">' + esc(m.name) + '</td><td class="m-val">' + metricValue(st, m) + " " + esc(m.unit) + '</td><td class="m-th">' + esc(m.threshold) + " " + esc(m.unit) + "</td></tr>";
      });
      html += "</tbody></table>";
      if (st.status === "done") {
        // 已在上面 done-banner 中体现
      } else if (isCurrent && !st.recovering) {
        html += '<div class="gate-verdict-row"><span class="q">对照阈值，本次窗口判定为：</span>';
        html += '<button class="btn btn-good" data-action="gate-pass" data-step="' + st.id + '">达标</button>';
        html += '<button class="btn btn-danger" data-action="gate-fail" data-step="' + st.id + '">未达标</button>';
        html += "</div>";
      }
      html += recoveryDetails(st, isCurrent);
    } else if (st.kind === "irreversible") {
      if (st.status !== "done") {
        html += '<div class="irr-strip"><span class="glyph">⚠</span><span><b>本步骤不可逆。</b>' + esc(st.confirmDesc) + " 执行需输入确认短语；异常时按恢复路径处置。</span></div>";
      }
      html += recoveryDetails(st, isCurrent);
      if (st.status === "done") {
        html += '<div class="irr-strip" style="border-color:rgba(61,220,151,.4);background:var(--green-dim)"><span class="glyph" style="color:var(--green)">✓</span><span>已按确认流程执行。如后续发现异常，立即按上方恢复路径处置。</span></div>';
      } else if (isCurrent) {
        html += '<div style="display:flex;align-items:center;gap:14px">';
        html += '<button class="btn btn-danger btn-lg" data-action="exec-irrev" data-step="' + st.id + '">▸ ' + esc(st.confirmLabel) + "</button>";
        html += '<span class="foot-meta">恢复路径：' + (st.recoveryViewed ? '<b style="color:var(--green)">已查阅</b>' : '<b style="color:var(--amber)">建议先查阅</b>') + "</span>";
        html += "</div>";
      }
    }

    html += '<div class="stage-foot"><span class="foot-meta">步骤 <b>' + (st.idx + 1) + "/" + S.steps.length + "</b></span><span class=\"foot-meta\">失误 <b id=\"foot-mistakes\">" + S.mistakes.length + "</b></span></div>";

    // 接下来
    var upcoming = S.steps.filter(function (x) { return x.status === "locked"; }).slice(0, 3);
    if (upcoming.length) {
      html += '<div class="upnext"><h3>接下来</h3><div class="upnext-chips">';
      upcoming.forEach(function (u) {
        html += '<span class="up-chip"><span class="lock">🔒</span>' + esc(u.title) + (u.kind === "irreversible" ? ' <span class="up-irr">不可逆</span>' : "") + "</span>";
      });
      html += "</div></div>";
    }

    html += "</div>";
    var stage = $("stage");
    stage.innerHTML = html;
    stage.querySelectorAll("details.recovery-panel").forEach(function (d) {
      d.addEventListener("toggle", function () {
        var s2 = stepById(d.getAttribute("data-step"));
        s2.recoveryOpen = d.open;
        if (d.open && !s2.recoveryViewed) {
          s2.recoveryViewed = true;
          S.stats.recoveries++;
          logEvent("查阅恢复路径：" + s2.recovery.kicker, "");
          render();
        }
      });
    });
  }

  function stepById(id) {
    for (var i = 0; i < S.steps.length; i++) if (S.steps[i].id === id) return S.steps[i];
    return null;
  }

  // ── 渲染：右栏 ─────────────────────────────────────────────
  function renderStatus() {
    var html = "";
    // 环境快照
    var ver = "v2.3.1 · 稳定";
    var p21 = stepById("p2-1"), p41 = stepById("p4-1"), p31 = stepById("p3-1"), p12 = stepById("p1-2"), p11 = stepById("p1-1");
    if (p41.status === "done") ver = "v2.4.0 · 全量";
    else if (p21 && p21.status === "done") ver = "v2.4.0 · 灰度 10%";
    var db = p31.status === "done" ? "#217 已迁移" : "#216 · 稳定";
    var snap = "未创建";
    if (p12.status === "done") snap = "已验证 ✓";
    else if (p11.status === "done") snap = "待验证";
    html += '<div class="panel"><div class="panel-head">环境快照</div><div class="panel-body">';
    html += '<div class="env-row"><span class="k">生产版本</span><span class="v ok">' + ver + "</span></div>";
    html += '<div class="env-row"><span class="k">orders-db schema</span><span class="v">' + db + "</span></div>";
    html += '<div class="env-row"><span class="k">快照兜底</span><span class="v ' + (p12.status === "done" ? "ok" : "warn") + '">' + snap + "</span></div>";
    html += '<div class="env-row"><span class="k">入口流量</span><span class="v">1,248 req/s</span></div>';
    html += "</div></div>";

    // 不可逆步骤
    var irrs = S.steps.filter(function (s) { return s.kind === "irreversible"; });
    html += '<div class="panel"><div class="panel-head">不可逆步骤<span class="ph-count">' + irrs.filter(function (s) { return s.status === "done"; }).length + "/" + irrs.length + ' 已确认执行</span></div><div class="panel-body">';
    irrs.forEach(function (s) {
      var stCls = s.status === "done" ? "exec" : "wait";
      var stTxt = s.status === "done" ? "已执行" : "待执行";
      html += '<div class="irr-row"><span class="glyph">⚠</span><span class="t">' + esc(s.title) + '<br><span class="mono" style="font-size:10.5px;color:var(--faint)">短语 ' + esc(s.confirmPhrase) + " · 恢复路径" + (s.recoveryViewed ? "已查阅" : "未查阅") + "</span></span>";
      html += '<span class="st ' + stCls + '">' + stTxt + "</span></div>";
    });
    html += "</div></div>";

    // 失误记录
    html += '<div class="panel"><div class="panel-head">失误记录<span class="ph-count">目标 0</span></div><div class="panel-body">';
    html += '<div class="mistake-count ' + (S.mistakes.length ? "nzero" : "zero") + '">' + S.mistakes.length + "</div>";
    if (S.mistakes.length) {
      html += '<div class="panel-body-scroll">';
      S.mistakes.slice().reverse().forEach(function (m) {
        html += '<div class="mistake-item"><span class="mt">✕</span> ' + esc(m.text) + ' <span class="mm">' + m.t + " · " + esc(m.step) + "</span></div>";
      });
      html += "</div>";
    } else {
      html += '<div class="zero-line">无失误记录，保持住。</div>';
    }
    html += "</div></div>";

    // 操作日志
    html += '<div class="panel"><div class="panel-head">操作日志</div><div class="panel-body panel-body-scroll">';
    if (!S.log.length) html += '<div class="zero-line" style="color:var(--faint)">等待首个动作…</div>';
    S.log.forEach(function (l) {
      html += '<div class="log-item ' + (l.tone ? "tone-" + l.tone : "") + '"><span class="lt">' + l.t + "</span><span>" + esc(l.text) + "</span></div>";
    });
    html += "</div></div>";

    $("status").innerHTML = html;
  }

  // ── 渲染：顶栏 ─────────────────────────────────────────────
  function renderTop() {
    var done = S.steps.filter(function (s) { return s.status === "done"; }).length;
    var pct = Math.round((done / S.steps.length) * 100);
    $("progress-fill").style.width = pct + "%";
    $("progress-text").textContent = done + "/" + S.steps.length;
    var badge = $("mistake-badge");
    badge.textContent = S.mistakes.length ? S.mistakes.length + " 次失误" : "零失误";
    badge.className = "verdict-chip " + (S.mistakes.length ? "bad" : "ok");
  }

  function render() {
    renderTop();
    renderRail();
    renderStage();
    renderStatus();
  }

  // ── 确认模态 ───────────────────────────────────────────────
  function openModal(st) {
    modalStepId = st.id;
    $("modal-title").textContent = st.confirmLabel;
    $("modal-desc").textContent = st.confirmDesc;
    $("modal-phrase").textContent = st.confirmPhrase;
    $("modal-input").value = "";
    $("modal-hint").classList.add("hidden");
    $("modal-exec").disabled = true;
    $("modal-backdrop").classList.remove("hidden");
    $("modal-input").focus();
  }
  function closeModal() {
    modalStepId = null;
    $("modal-backdrop").classList.add("hidden");
  }

  // ── 完成判定 ───────────────────────────────────────────────
  function renderOverlay() {
    var elapsed = fmtElapsed(S.finishedAt - S.startedAt);
    var perfect = S.mistakes.length === 0;
    var irrs = S.steps.filter(function (s) { return s.kind === "irreversible"; });
    var html = '<div class="cert ' + (perfect ? "perfect" : "") + '">';
    html += '<div class="cert-kicker">RELEASE DRILL RESULT · CHG-20260919-042</div>';
    html += '<div class="cert-title ' + (perfect ? "perfect" : "flawed") + '">' + (perfect ? "零失误通关" : "完成全程 · " + S.mistakes.length + " 次失误") + "</div>";
    html += '<div class="cert-sub">orders-api v2.4.0 生产发布演练 · 运行手册 RLB-2.4 · 全部 ' + S.steps.length + " 个步骤已走完</div>";
    html += '<div class="cert-stats">';
    html += '<div class="stat"><div class="sv">' + S.steps.length + "/" + S.steps.length + '</div><div class="sk">步骤完成</div></div>';
    html += '<div class="stat"><div class="sv">' + elapsed + '</div><div class="sk">全程用时</div></div>';
    html += '<div class="stat"><div class="sv">' + S.stats.gates + '</div><div class="sk">门禁判定次数</div></div>';
    html += '<div class="stat"><div class="sv">' + S.stats.confirms + '</div><div class="sk">不可逆短语确认</div></div>';
    html += '<div class="stat"><div class="sv">' + S.stats.recoveries + '</div><div class="sk">恢复路径查阅</div></div>';
    html += '<div class="stat"><div class="sv">' + S.stats.recActs + '</div><div class="sk">恢复动作执行</div></div>';
    html += "</div>";
    html += '<div class="cert-section"><h3>失误明细</h3>';
    if (perfect) {
      html += '<div class="cert-zero">✓ 全程零失误：所有门禁判定正确，' + irrs.length + " 个不可逆步骤均经短语确认执行。</div>";
    } else {
      S.mistakes.forEach(function (m) {
        html += '<div class="cert-mistake"><span class="cm-t">' + m.t + '</span><span><span class="cm-x">✕</span> ' + esc(m.text) + "（" + esc(m.step) + "）</span></div>";
      });
    }
    html += "</div>";
    html += '<div class="cert-foot"><span class="sig">RLB-2.4 · 发布指挥台 · 本地演练，不产生生产副作用</span><button class="btn btn-primary" data-action="restart">重新演练</button></div>';
    html += "</div>";
    $("overlay").innerHTML = html;
    $("overlay").classList.remove("hidden");
  }

  // ── 事件 ───────────────────────────────────────────────────
  document.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-action]");
    if (!btn) return;
    var act = btn.getAttribute("data-action");
    var stepId = btn.getAttribute("data-step");
    var key = btn.getAttribute("data-key");

    if (act === "view-step") {
      var idx = parseInt(btn.getAttribute("data-idx"), 10);
      if (!isNaN(idx)) { S.viewIdx = idx; renderStage(); }
      return;
    }
    if (act === "toggle-check") {
      var st = stepById(stepId);
      if (st.checksDone[key]) return;
      st.checksDone[key] = true;
      var all = st.checks.every(function (_, i) { return st.checksDone["c" + i]; });
      logEvent("确认：" + st.checks[Number(key.slice(1))], "");
      if (all) { toast("检查完成：" + st.title, "good"); completeStep(st); } else render();
      return;
    }
    if (act === "do-act") {
      var st2 = stepById(stepId);
      if (st2.actsDone[key]) return;
      st2.actsDone[key] = true;
      var ai = Number(key.slice(1));
      logEvent("执行：" + st2.actions[ai].label, "");
      toast(st2.actions[ai].result, "good");
      var all2 = st2.actions.every(function (_, i) { return st2.actsDone["a" + i]; });
      if (all2) { completeStep(st2); } else render();
      return;
    }
    if (act === "exec-irrev") {
      openModal(stepById(stepId));
      return;
    }
    if (act === "gate-pass") { gateJudge(stepById(stepId), true); return; }
    if (act === "gate-fail") { gateJudge(stepById(stepId), false); return; }
    if (act === "rec-check" || act === "rec-act") {
      var st3 = stepById(stepId);
      if (st3.recoveryActsDone[key]) return;
      st3.recoveryActsDone[key] = true;
      S.stats.recActs++;
      var ra = st3.recovery.actions.filter(function (a) { return a.id === key; })[0];
      logEvent("恢复动作：" + ra.label, "warn");
      if (ra.result) toast(ra.result, "warn");
      render();
      return;
    }
    if (act === "rec-retry") {
      var st4 = stepById(stepId);
      rollGate(st4, true); // 恢复处置后复判
      st4.recovering = false;
      logEvent("恢复处置完毕，重新研判门禁", "good");
      toast("处置完毕，请复判门禁", "good");
      render();
      return;
    }
    if (act === "confirm-cancel") { closeModal(); return; }
    if (act === "confirm-exec") {
      var st5 = stepById(modalStepId);
      if (!st5) return;
      var val = $("modal-input").value;
      if (val !== st5.confirmPhrase) {
        $("modal-hint").classList.remove("hidden");
        return;
      }
      S.stats.confirms++;
      st5.execCount++;
      closeModal();
      logEvent("短语确认通过，执行：" + st5.title, "danger");
      toast("已执行（不可逆）：" + st5.title, "danger");
      completeStep(st5);
      return;
    }
    if (act === "restart") { location.reload(); return; }
  });

  $("modal-input").addEventListener("input", function () {
    var st = stepById(modalStepId);
    if (!st) return;
    var ok = this.value === st.confirmPhrase;
    $("modal-exec").disabled = !ok;
    if (ok) $("modal-hint").classList.add("hidden");
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && modalStepId) closeModal();
  });

  // ── 计时器 ─────────────────────────────────────────────────
  setInterval(function () {
    if (!S.finished) $("timer").textContent = fmtElapsed(Date.now() - S.startedAt);
  }, 1000);

  // ── 启动：数据内联，首屏即用 ───────────────────────────────
  initState();
  logEvent("发布演练开始：" + FLOW.meta.product + " " + FLOW.meta.version, "");
  render();
})();
