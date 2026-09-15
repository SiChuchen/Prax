/* 切换指挥台 · 运行时
 * 结构：PAT-LIST-DETAIL-INSPECTOR（左导航 / 中执行卡 / 右检查器+日志），向导式强制推进
 * 零失误主线：漏检提交、越序访问、确认码错误、恢复程序缺项 —— 一律被护栏拦截并写入执行日志
 * 不可逆步骤双路径：执行前确认码确认（确认路径）+ 执行后恢复向导（恢复路径）
 */
(function () {
  'use strict';

  var RUNBOOK = window.RUNBOOK;
  var RECOVERY_CODE = 'RECOVER';

  /* ---------- 状态 ---------- */
  var state = {
    steps: [],          // 运行时步骤（展平、有序）
    selectedId: null,   // selection：由左导航 / 中执行卡 / 右检查器共享
    log: [],            // 执行日志（最新在前）
    intercepts: [],     // 护栏拦截记录
    modal: null,        // {type:'confirm'|'recover'|'restart', stepId, checked, error}
    lastGuard: null,    // 最近一次拦截（执行卡顶部横幅）
    startedAt: Date.now(),
    recoveryRuns: 0
  };

  /* ---------- 基础工具 ---------- */
  function byId(id) { return document.getElementById(id); }
  function stepById(id) {
    for (var i = 0; i < state.steps.length; i++) if (state.steps[i].id === id) return state.steps[i];
    return null;
  }
  function stepIndex(id) {
    for (var i = 0; i < state.steps.length; i++) if (state.steps[i].id === id) return i;
    return -1;
  }
  function allDone() {
    return state.steps.every(function (s) { return s.status === 'done'; });
  }
  function checksDone(s) { return s.checks.every(function (c) { return !!s.checked[c.id]; }); }
  function checksDoneCount(s) {
    return s.checks.filter(function (c) { return !!s.checked[c.id]; }).length;
  }
  function totalChecks() {
    return state.steps.reduce(function (n, s) { return n + s.checks.length; }, 0);
  }
  function totalChecksPassed() {
    return state.steps.reduce(function (n, s) { return n + checksDoneCount(s); }, 0);
  }
  function doneIrrevCount() {
    return state.steps.filter(function (s) { return s.irreversible && s.status === 'done'; }).length;
  }
  function hhmmss(d) {
    d = d || new Date();
    function p(n) { return (n < 10 ? '0' : '') + n; }
    return p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
  }
  function fmtRemaining(ms) {
    if (ms <= 0) return '00:00';
    var s = Math.floor(ms / 1000);
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
    function p(n) { return (n < 10 ? '0' : '') + n; }
    return (h > 0 ? h + ':' + p(m) : p(m)) + ':' + p(ss);
  }
  function fmtWindow(min) {
    if (min >= 1440) return (min / 1440) + ' 小时';
    if (min >= 60) return (min / 60) + ' 小时';
    return min + ' 分钟';
  }
  function esc(t) {
    return String(t).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /* ---------- 初始化 ---------- */
  function initSteps() {
    state.steps = [];
    RUNBOOK.phases.forEach(function (ph) {
      ph.steps.forEach(function (s) {
        var rt = {};
        for (var k in s) rt[k] = s[k];
        rt.phaseName = ph.name;
        rt.status = 'locked';
        rt.checked = {};
        rt.executedAt = null;
        rt.deadline = 0;
        rt.recoveries = 0;
        state.steps.push(rt);
      });
    });
    state.steps[0].status = 'ready';
    state.selectedId = state.steps[0].id;
  }
  function seedLog() {
    log('info', '会话开始：' + RUNBOOK.meta.changeCode + ' ' + RUNBOOK.meta.title + '（' + RUNBOOK.meta.env + '）');
    log('info', '护栏系统就绪：漏检提交、越序访问、确认码错误将被拦截并留痕。');
    log('info', '提示：不可逆步骤（⚠）执行前需输入确认码，执行后可启动恢复路径。');
  }

  /* ---------- 日志 / 提示 ---------- */
  function log(kind, text) {
    state.log.unshift({ time: hhmmss(), kind: kind, text: text });
  }
  function toast(text, kind) {
    var el = document.createElement('div');
    el.className = kind === 'info' ? 'toast info-toast' : 'toast';
    el.innerHTML = '<svg class="ic"><use href="#' + (kind === 'info' ? 'i-check' : 'i-warn') + '"/></svg>' +
      '<div><strong>' + (kind === 'info' ? '操作成功' : '已被护栏拦截') + '</strong><span>' + esc(text) + '</span></div>';
    byId('toastRegion').appendChild(el);
    setTimeout(function () {
      el.classList.add('out');
      setTimeout(function () { el.remove(); }, 320);
    }, 4200);
  }
  function guard(text) {
    state.intercepts.push({ time: hhmmss(), text: text });
    state.lastGuard = text;
    log('guard', '护栏拦截：' + text);
    toast(text);
    renderGuardChip();
    renderLog();
  }
  function clearGuard() { state.lastGuard = null; }

  /* ---------- 动作 ---------- */
  function selectStep(id) {
    var s = stepById(id);
    if (!s) return;
    if (s.status === 'locked') {
      guard('越序访问被拦截：「' + s.code + ' ' + s.title + '」尚未解锁，请按序完成前序步骤。');
      render();
      return;
    }
    clearGuard();
    state.selectedId = id;
    render();
  }
  function toggleCheck(stepId, checkId, on) {
    var s = stepById(stepId);
    if (!s || s.status !== 'ready') return;
    if (on) s.checked[checkId] = true; else delete s.checked[checkId];
    if (state.lastGuard) { clearGuard(); render(); return; } // 清除拦截横幅
    var cnt = byId('checkCount');
    if (cnt) cnt.textContent = checksDoneCount(s) + '/' + s.checks.length;
  }
  function submitStep(stepId) {
    var s = stepById(stepId);
    if (!s || s.status !== 'ready') return;
    if (!checksDone(s)) {
      guard('漏检拦截：「' + s.code + '」还有 ' + (s.checks.length - checksDoneCount(s)) +
        ' 项检查未确认，本步骤不能提交。');
      render();
      return;
    }
    clearGuard();
    if (s.irreversible) {
      state.modal = { type: 'confirm', stepId: stepId, error: null };
      render();
      focusModalInput();
    } else {
      executeStep(s, null);
    }
  }
  function executeStep(s, code) {
    s.status = 'done';
    s.executedAt = Date.now();
    if (s.irreversible && s.recovery) {
      s.deadline = s.executedAt + s.recovery.windowMinutes * 60000;
    }
    log(s.irreversible ? 'confirm' : 'action',
      (s.irreversible ? '已确认执行（确认码 ' + code + '）：' : '已完成：') + s.code + ' ' + s.title);
    var next = state.steps[stepIndex(s.id) + 1];
    if (next) {
      next.status = 'ready';
      state.selectedId = next.id;
      log('info', '解锁下一步：' + next.code + ' ' + next.title + (next.irreversible ? '（⚠ 不可逆）' : ''));
    } else {
      state.selectedId = null;
      log('done', '全部步骤完成，流程结束 —— 零失误走完全程。');
    }
    render();
  }
  function confirmExecute() {
    var m = state.modal;
    if (!m || m.type !== 'confirm') return;
    var s = stepById(m.stepId);
    var input = byId('confirmCode');
    var val = ((input && input.value) || '').trim().toUpperCase();
    if (val !== s.confirmCode) {
      guard('确认码校验失败：「' + s.code + '」输入为「' + (val || '空') + '」，执行被阻止（第 ' +
        state.intercepts.length + ' 次拦截）。');
      m.error = '确认码不匹配，执行未放行。请输入 ' + s.confirmCode + ' 以确认。';
      renderModal();
      focusModalInput();
      return;
    }
    state.modal = null;
    executeStep(s, s.confirmCode);
  }
  function startRecovery(stepId) {
    var s = stepById(stepId);
    if (!s || !s.irreversible || s.status !== 'done') {
      guard('恢复入口仅对已执行的不可逆步骤开放。');
      render();
      return;
    }
    clearGuard();
    state.modal = { type: 'recover', stepId: stepId, checked: {}, error: null };
    log('recovery', '进入恢复路径：' + s.code + ' ' + s.title + ' —— ' + s.recovery.summary);
    render();
    focusModalInput();
  }
  function recDoneCount(m) { return Object.keys(m.checked).length; }
  function completeRecovery() {
    var m = state.modal;
    if (!m || m.type !== 'recover') return;
    var s = stepById(m.stepId);
    var total = s.recovery.steps.length;
    if (recDoneCount(m) < total) {
      guard('恢复拦截：「' + s.code + '」恢复程序还有 ' + (total - recDoneCount(m)) + ' 项未确认，回滚不能生效。');
      m.error = '还有 ' + (total - recDoneCount(m)) + ' 项恢复检查未确认。';
      renderModal();
      return;
    }
    var input = byId('recoveryCode');
    var val = ((input && input.value) || '').trim().toUpperCase();
    if (val !== RECOVERY_CODE) {
      guard('恢复确认码校验失败：「' + s.code + '」回滚被阻止。');
      m.error = '恢复确认码不匹配，请输入 ' + RECOVERY_CODE + '。';
      renderModal();
      focusModalInput();
      return;
    }
    var idx = stepIndex(s.id);
    for (var i = idx; i < state.steps.length; i++) {
      var t = state.steps[i];
      t.checked = {};
      t.executedAt = null;
      t.deadline = 0;
      t.status = (i === idx) ? 'ready' : 'locked';
    }
    s.recoveries++;
    state.recoveryRuns++;
    state.modal = null;
    state.selectedId = s.id;
    log('recovery', '恢复完成：' + s.code + ' 已回滚至待执行态，其后 ' +
      (state.steps.length - idx - 1) + ' 个步骤重新锁定。');
    render();
  }
  function restartRun() {
    initSteps();
    state.log = [];
    state.intercepts = [];
    state.lastGuard = null;
    state.modal = null;
    state.recoveryRuns = 0;
    state.startedAt = Date.now();
    seedLog();
    render();
  }

  /* ---------- 导出 / 复制 ---------- */
  function exportLog() {
    var payload = {
      workflow: RUNBOOK.meta,
      exportedAt: new Date().toISOString(),
      startedAt: new Date(state.startedAt).toISOString(),
      stats: {
        steps: state.steps.filter(function (s) { return s.status === 'done'; }).length + '/' + state.steps.length,
        checksPassed: totalChecksPassed() + '/' + totalChecks(),
        irreversibleConfirmed: doneIrrevCount(),
        recoveryRuns: state.recoveryRuns,
        intercepts: state.intercepts.length
      },
      intercepts: state.intercepts,
      log: state.log.slice().reverse()
    };
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'runlog-' + RUNBOOK.meta.changeCode + '.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    log('info', '执行日志已导出（' + a.download + '）。');
    renderLog();
    toast('执行日志已导出为 ' + a.download, 'info');
  }
  function copyLog() {
    var text = state.log.slice().reverse().map(function (e) {
      return e.time + ' [' + e.kind + '] ' + e.text;
    }).join('\n');
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { /* file:// 下可能受限 */ }
    ta.remove();
    toast(ok ? '日志已复制到剪贴板' : '复制受限，请使用「导出」或手动选择日志文本', ok ? 'info' : 'guard');
  }

  /* ---------- 渲染 ---------- */
  function render() {
    renderHeader();
    renderNav();
    renderDetail();
    renderInspector();
    renderLog();
    renderModal();
    tickCountdowns();
  }
  function renderGuardChip() {
    var el = byId('guardChip');
    el.textContent = '护栏拦截 ' + state.intercepts.length;
    el.classList.toggle('hot', state.intercepts.length > 0);
  }
  function renderHeader() {
    byId('chgCode').textContent = RUNBOOK.meta.changeCode;
    byId('wfTitle').textContent = RUNBOOK.meta.title;
    byId('wfEnv').textContent = RUNBOOK.meta.env + ' · ' + RUNBOOK.meta.window;
    var done = state.steps.filter(function (s) { return s.status === 'done'; }).length;
    var pct = Math.round(done / state.steps.length * 100);
    byId('progressFill').style.width = pct + '%';
    byId('progressText').textContent = done + '/' + state.steps.length + ' 步';
    renderGuardChip();
  }
  function renderNav() {
    var html = '';
    RUNBOOK.phases.forEach(function (ph) {
      html += '<div class="nav-phase"><div class="nav-phase-name">' + esc(ph.name) + '</div>';
      ph.steps.forEach(function (raw) {
        var s = stepById(raw.id);
        var ico = s.status === 'done' ? 'i-check' : (s.status === 'ready' ? 'i-play' : 'i-lock');
        var cls = 'nav-step ' + s.status + (s.id === state.selectedId ? ' selected' : '');
        var flag = s.irreversible ? '<svg class="ic ic-warn" aria-label="不可逆步骤"><use href="#i-warn"/></svg>' : '';
        var recov = s.recoveries > 0 ? '<span class="nav-recov">曾恢复×' + s.recoveries + '</span>' : '';
        html += '<button type="button" class="' + cls + '" data-action="select-step" data-step="' + s.id + '" title="' +
          esc(s.title) + (s.irreversible ? '（不可逆）' : '') + '">' +
          '<span class="ico" aria-hidden="true"><svg class="ic"><use href="#' + ico + '"/></svg></span>' +
          '<span class="nav-body"><span class="nav-code">' + s.code + '</span>' + esc(s.title) + recov + '</span>' +
          flag + '</button>';
      });
      html += '</div>';
    });
    byId('stepNav').innerHTML = html;
  }
  function renderDetail() {
    var box = byId('stepDetail');
    if (allDone() && !state.selectedId) {
      box.innerHTML = completionHtml();
      return;
    }
    var s = stepById(state.selectedId);
    if (!s) { box.innerHTML = ''; return; }
    var active = s.status === 'ready';
    var html = '';

    if (state.lastGuard) {
      html += '<div class="guard-banner" role="alert"><svg class="ic"><use href="#i-warn"/></svg>' +
        esc(state.lastGuard) + '</div>';
    }
    html += '<div class="detail-kicker">' +
      '<span class="chip chip-phase">' + esc(s.phaseName) + '</span>' +
      '<span class="step-code">' + s.code + '</span>' +
      (s.irreversible
        ? '<span class="chip chip-irrev"><svg class="ic"><use href="#i-warn"/></svg>不可逆步骤</span>'
        : '<span class="chip chip-rev">可逆</span>') +
      '</div>' +
      '<h2 class="detail-title">' + esc(s.title) + '</h2>' +
      '<p class="detail-goal">' + esc(s.goal) + '</p>';

    if (s.status === 'done') {
      html += '<div class="exec-stamp"><svg class="ic"><use href="#i-check"/></svg> 已执行于 ' +
        hhmmss(new Date(s.executedAt)) +
        (s.irreversible && s.recovery
          ? ' · 恢复窗口剩余 <strong data-cd="' + s.id + '">--:--</strong>'
          : '') +
        (s.recoveries > 0 ? ' · 曾恢复 ×' + s.recoveries : '') + '</div>';
    } else if (s.status === 'locked') {
      html += '<div class="lock-stamp"><svg class="ic"><use href="#i-lock"/></svg> 本步骤尚未解锁（前序步骤完成后按序开放）</div>';
    }

    html += '<section class="detail-sec"><h3>操作指令</h3><ol class="action-list">';
    s.actions.forEach(function (a) { html += '<li>' + esc(a) + '</li>'; });
    html += '</ol></section>';

    html += '<section class="detail-sec"><h3>检查项 <span class="muted" id="checkCount">' +
      checksDoneCount(s) + '/' + s.checks.length + '</span></h3><div class="check-list">';
    s.checks.forEach(function (c) {
      var on = !!s.checked[c.id];
      var ro = s.status !== 'ready';
      html += '<label class="check-item' + (on ? ' on' : '') + (ro ? ' ro' : '') + '">' +
        '<input type="checkbox" data-action="toggle-check" data-step="' + s.id + '" data-check="' + c.id + '"' +
        (on ? ' checked' : '') + (ro ? ' disabled' : '') + '/>' +
        '<span class="check-box" aria-hidden="true"><svg class="ic"><use href="#i-check"/></svg></span>' +
        '<span class="check-text">' + esc(c.text) + '<em>预期：' + esc(c.expect) + '</em></span></label>';
    });
    html += '</div></section>';

    html += '<section class="detail-sec"><details class="contingency">' +
      '<summary>异常处置 · 若结果与预期不符</summary>' +
      '<p class="cont-trigger">触发条件：' + esc(s.contingency.trigger) + '</p><ol>';
    s.contingency.steps.forEach(function (x) { html += '<li>' + esc(x) + '</li>'; });
    html += '</ol>' + (s.contingency.note ? '<p class="muted">' + esc(s.contingency.note) + '</p>' : '') +
      '</details></section>';

    if (active) {
      html += '<div class="detail-actions">' +
        '<button type="button" class="btn ' + (s.irreversible ? 'btn-danger' : 'btn-primary') +
        '" data-action="submit-step" data-step="' + s.id + '">' +
        (s.irreversible ? '进入执行确认…' : '确认完成本步骤') + '</button>' +
        (s.irreversible
          ? '<span class="action-hint">将弹出确认对话框，需输入确认码 <b>' + s.confirmCode + '</b> 后才会执行；执行后可随时启动恢复路径</span>'
          : '<span class="action-hint">本步骤可逆：' + esc(s.fallback || '重跑本步骤即可。') + '</span>') +
        '</div>';
    } else if (s.status === 'done' && s.irreversible) {
      html += '<div class="detail-actions">' +
        '<button type="button" class="btn btn-ghost" data-action="start-recovery" data-step="' + s.id + '">' +
        '<svg class="ic"><use href="#i-undo"/></svg> 启动恢复路径</button>' +
        '<span class="action-hint">恢复将回滚本步骤并重新锁定其后步骤（恢复确认码 ' + RECOVERY_CODE + '）</span></div>';
    }
    box.innerHTML = html;
    tickCountdowns();
  }
  function completionHtml() {
    function stat(label, value) {
      return '<div class="stat"><span class="stat-v">' + value + '</span><span class="stat-k">' + label + '</span></div>';
    }
    var g = state.intercepts;
    var html = '<div class="completion">' +
      '<div class="cert-banner"><svg class="ic big"><use href="#i-check"/></svg><div>' +
      '<h2>全程零失误完成</h2><p>' +
      (g.length === 0
        ? '无任何被拦截的误操作，全部检查项一次通过。'
        : '全程 ' + g.length + ' 次潜在误操作均被护栏拦截并阻止，未影响执行正确性。') +
      '</p></div></div>' +
      '<div class="cert-stats">' +
      stat('步骤', state.steps.length + '/' + state.steps.length) +
      stat('检查项通过', totalChecksPassed() + '/' + totalChecks()) +
      stat('不可逆确认', doneIrrevCount() + ' 次') +
      stat('恢复演练', state.recoveryRuns + ' 次') +
      stat('护栏拦截', g.length + ' 次') +
      '</div>';
    if (g.length) {
      html += '<section class="detail-sec"><h3>护栏拦截记录</h3><ul class="guard-list">';
      g.forEach(function (x) {
        html += '<li><span class="lt">' + x.time + '</span>' + esc(x.text) + '</li>';
      });
      html += '</ul></section>';
    } else {
      html += '<section class="detail-sec"><h3>护栏拦截记录</h3>' +
        '<div class="empty-state"><svg class="ic"><use href="#i-check"/></svg> 全程零拦截 · 无被阻止的误操作</div></section>';
    }
    html += '<div class="detail-actions">' +
      '<button type="button" class="btn btn-primary" data-action="export-log">' +
      '<svg class="ic"><use href="#i-down"/></svg> 导出执行日志</button>' +
      '<button type="button" class="btn btn-ghost" data-action="copy-log">复制日志文本</button>' +
      '<button type="button" class="btn btn-ghost" data-action="restart">↻ 重新演练</button></div></div>';
    return html;
  }
  function renderInspector() {
    var s = stepById(state.selectedId) || state.steps[state.steps.length - 1];
    var html = '<div class="insp-head"><h3>风险与恢复检查器</h3>' +
      (s.irreversible
        ? '<span class="chip chip-irrev"><svg class="ic"><use href="#i-warn"/></svg>高风险 · 不可逆</span>'
        : '<span class="chip chip-rev">常规 · 可逆</span>') +
      '</div>';
    html += '<div class="insp-sec"><h4>后果说明</h4><p>' +
      esc(s.irreversible
        ? s.consequence
        : '本步骤可逆：' + (s.fallback || '重做或回退配置即可恢复，不产生不可逆影响。')) +
      '</p></div>';
    if (s.recovery) {
      html += '<div class="insp-sec insp-recovery"><h4>恢复路径（窗口 ' + fmtWindow(s.recovery.windowMinutes) + '）</h4><ol>';
      s.recovery.steps.forEach(function (x) { html += '<li>' + esc(x) + '</li>'; });
      html += '</ol><p class="muted">' + esc(s.recovery.note) + '</p>' +
        '<button type="button" class="btn btn-ghost" data-action="start-recovery" data-step="' + s.id + '"' +
        (s.status === 'done' ? '' : ' disabled title="本步骤执行后方可启动恢复"') + '>' +
        '<svg class="ic"><use href="#i-undo"/></svg> 启动恢复路径</button>' +
        (s.status === 'done'
          ? '<p class="insp-cd">恢复窗口剩余 <strong data-cd="' + s.id + '">--:--</strong></p>'
          : '') +
        '</div>';
    } else {
      html += '<div class="insp-sec"><h4>恢复方式</h4><p>' + esc(s.fallback || '重跑本步骤即可。') + '</p></div>';
    }
    html += '<div class="insp-sec"><h4>异常处置</h4><p class="muted">触发条件：' + esc(s.contingency.trigger) + '</p></div>';
    byId('inspector').innerHTML = html;
    tickCountdowns();
  }
  function renderLog() {
    var html = '<div class="log-head"><h3>执行日志</h3><div class="log-tools">' +
      '<button type="button" class="btn btn-ghost btn-xs" data-action="export-log">导出</button>' +
      '<button type="button" class="btn btn-ghost btn-xs" data-action="copy-log">复制</button></div></div><ul class="log-list">';
    if (!state.log.length) html += '<li class="log-empty">暂无日志</li>';
    state.log.forEach(function (e) {
      html += '<li class="log-' + e.kind + '"><span class="lt">' + e.time + '</span>' + esc(e.text) + '</li>';
    });
    html += '</ul>';
    byId('runLog').innerHTML = html;
  }
  function errHtml(m) {
    return m.error ? '<p class="field-error" role="alert">' + esc(m.error) + '</p>' : '';
  }
  function renderModal() {
    var root = byId('modalRoot');
    if (!state.modal) { root.hidden = true; root.innerHTML = ''; return; }
    var m = state.modal;
    var s = m.stepId ? stepById(m.stepId) : null;
    var html = '';
    if (m.type === 'confirm') {
      html = '<form class="modal" role="dialog" aria-modal="true" aria-labelledby="mTitle">' +
        '<div class="modal-flag"><svg class="ic big"><use href="#i-warn"/></svg> 不可逆操作确认</div>' +
        '<h3 id="mTitle">' + esc(s.code + ' ' + s.title) + '</h3>' +
        '<div class="modal-sec"><h4>执行后果（不可逆）</h4><p>' + esc(s.consequence) + '</p></div>' +
        '<div class="modal-sec modal-recovery"><h4>若出问题：恢复路径（窗口 ' + fmtWindow(s.recovery.windowMinutes) + '）</h4><ol>';
      s.recovery.steps.forEach(function (x) { html += '<li>' + esc(x) + '</li>'; });
      html += '</ol><p class="muted">' + esc(s.recovery.note) + '</p></div>' +
        '<div class="modal-sec"><h4>输入确认码 <b>' + s.confirmCode + '</b> 以放行执行</h4>' +
        '<input id="confirmCode" class="code-input" autocomplete="off" spellcheck="false" placeholder="输入确认码"/>' +
        errHtml(m) + '</div>' +
        '<div class="modal-actions">' +
        '<button type="button" class="btn btn-ghost" data-action="close-modal">取消</button>' +
        '<button type="submit" class="btn btn-danger">确认执行</button></div></form>';
    } else if (m.type === 'recover') {
      html = '<form class="modal" role="dialog" aria-modal="true" aria-labelledby="mTitle">' +
        '<div class="modal-flag modal-flag-recov"><svg class="ic big"><use href="#i-undo"/></svg> 恢复路径 · 回滚 ' + esc(s.code) + '</div>' +
        '<h3 id="mTitle">' + esc(s.title) + ' 的回滚程序</h3>' +
        '<p class="muted">' + esc(s.recovery.summary) + '</p>' +
        '<div class="modal-sec"><h4>恢复检查项 <span class="muted" id="recCount">' + recDoneCount(m) + '/' + s.recovery.steps.length + '</span></h4><div class="check-list">';
      s.recovery.steps.forEach(function (x, i) {
        var on = !!m.checked[i];
        html += '<label class="check-item' + (on ? ' on' : '') + '">' +
          '<input type="checkbox" data-action="toggle-rec" data-idx="' + i + '"' + (on ? ' checked' : '') + '/>' +
          '<span class="check-box" aria-hidden="true"><svg class="ic"><use href="#i-check"/></svg></span>' +
          '<span class="check-text">' + esc(x) + '</span></label>';
      });
      html += '</div></div>' +
        '<div class="modal-sec"><h4>输入恢复确认码 <b>' + RECOVERY_CODE + '</b> 以执行回滚</h4>' +
        '<input id="recoveryCode" class="code-input" autocomplete="off" spellcheck="false" placeholder="RECOVER"/>' +
        errHtml(m) + '</div>' +
        '<div class="modal-actions">' +
        '<button type="button" class="btn btn-ghost" data-action="close-modal">取消恢复</button>' +
        '<button type="submit" class="btn btn-primary">完成恢复</button></div></form>';
    } else {
      html = '<form class="modal" role="dialog" aria-modal="true" aria-labelledby="mTitle">' +
        '<h3 id="mTitle">重新开始演练？</h3>' +
        '<p class="muted">将清空当前执行进度、执行日志与拦截记录，回到第 1 步。</p>' +
        '<div class="modal-actions">' +
        '<button type="button" class="btn btn-ghost" data-action="close-modal">继续当前演练</button>' +
        '<button type="submit" class="btn btn-danger">确认重新开始</button></div></form>';
    }
    root.hidden = false;
    root.innerHTML = html;
  }
  function focusModalInput() {
    var el = byId('confirmCode') || byId('recoveryCode');
    if (el) el.focus();
  }
  function tickCountdowns() {
    var els = document.querySelectorAll('[data-cd]');
    if (!els.length) return;
    var nowMs = Date.now();
    els.forEach(function (el) {
      var s = stepById(el.getAttribute('data-cd'));
      if (!s || !s.deadline) { el.textContent = '--:--'; return; }
      var rem = s.deadline - nowMs;
      el.textContent = rem > 0 ? fmtRemaining(rem) : '已超窗';
    });
  }

  /* ---------- 事件委托 ---------- */
  document.addEventListener('click', function (ev) {
    var el = ev.target.closest ? ev.target.closest('[data-action]') : null;
    if (!el) return;
    var act = el.getAttribute('data-action');
    if (act === 'select-step') selectStep(el.getAttribute('data-step'));
    else if (act === 'submit-step') submitStep(el.getAttribute('data-step'));
    else if (act === 'start-recovery') startRecovery(el.getAttribute('data-step'));
    else if (act === 'close-modal') { state.modal = null; render(); }
    else if (act === 'restart') { state.modal = { type: 'restart', stepId: null, error: null }; render(); }
    else if (act === 'export-log') exportLog();
    else if (act === 'copy-log') copyLog();
  });
  document.addEventListener('change', function (ev) {
    var el = ev.target.closest ? ev.target.closest('[data-action="toggle-check"]') : null;
    if (el) {
      toggleCheck(el.getAttribute('data-step'), el.getAttribute('data-check'), el.checked);
      return;
    }
    var r = ev.target.closest ? ev.target.closest('[data-action="toggle-rec"]') : null;
    if (r && state.modal) {
      var i = Number(r.getAttribute('data-idx'));
      if (r.checked) state.modal.checked[i] = true; else delete state.modal.checked[i];
      clearGuard();
      var cnt = byId('recCount');
      var s = stepById(state.modal.stepId);
      if (cnt && s) cnt.textContent = recDoneCount(state.modal) + '/' + s.recovery.steps.length;
    }
  });
  document.addEventListener('submit', function (ev) {
    var form = ev.target.closest ? ev.target.closest('.modal') : null;
    if (!form) return;
    ev.preventDefault();
    if (form.querySelector('#confirmCode')) confirmExecute();
    else if (form.querySelector('#recoveryCode')) completeRecovery();
    else restartRun();
  });
  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape' && state.modal) {
      state.modal = null;
      render();
    }
  });

  /* ---------- 启动：同步渲染，页面加载即就绪（无加载态） ---------- */
  initSteps();
  seedLog();
  render();
  setInterval(tickCountdowns, 1000);
})();
