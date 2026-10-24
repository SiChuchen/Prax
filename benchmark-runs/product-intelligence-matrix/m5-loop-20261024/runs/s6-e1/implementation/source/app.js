/* Sundown — 下线执行台
 * 状态机 + 渲染。数据来自 data.js（window.RUNBOOK，内联）。
 * 状态完备性（H-07）：
 *  loading —— 首屏同步渲染，无加载态（数据内联，代码路径保留于 mount 兜底）
 *  empty   —— RUNBOOK 缺失/为空时的空态面板（防御分支）
 *  ready   —— 主工作态
 *  selected—— 左轨选中已完成步骤，进入只读回看
 *  error   —— 强确认输入不匹配的内联错误态；非法动作一律禁用（零失误护栏）
 */
(function () {
  'use strict';

  var RB = window.RUNBOOK;
  var app = document.getElementById('app');
  var TOKEN = RB && RB.confirmToken;

  /* ---------- 展平步骤 ---------- */
  var STEPS = [];
  if (RB && RB.phases) {
    RB.phases.forEach(function (ph, pi) {
      ph.steps.forEach(function (st) {
        STEPS.push({
          id: st.id,
          title: st.title,
          desc: st.desc,
          why: st.why || '',
          checks: st.checks || [],
          irreversible: !!st.irreversible,
          consequences: st.consequences || [],
          windowSec: st.windowSec || 60,
          actionLabel: st.actionLabel || '执行',
          phaseIdx: pi,
          phaseTitle: ph.title
        });
      });
    });
  }
  var TOTAL = STEPS.length;

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function fmtClock(sec) {
    sec = Math.max(0, Math.floor(sec));
    var m = Math.floor(sec / 60), s = sec % 60;
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  }
  function fmtElapsed(ms) {
    var sec = Math.max(0, Math.floor(ms / 1000));
    var h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    var mm = (m < 10 ? '0' : '') + m, ss = (s < 10 ? '0' : '') + s;
    return h > 0 ? h + ':' + mm + ':' + ss : mm + ':' + ss;
  }
  function fmtTime(ts) {
    var d = new Date(ts);
    function p(n) { return (n < 10 ? '0' : '') + n; }
    return p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
  }

  /* ---------- 状态 ---------- */
  function freshState() {
    return {
      t0: Date.now(),
      finishedAt: null,
      sel: null,            // null = 实时当前步；数字 = 只读回看的步骤下标
      resetArmed: false,
      focusKey: null,
      steps: STEPS.map(function (_, i) {
        return {
          status: i === 0 ? 'ready' : 'locked', // locked | ready | executed | retained
          checks: STEPS[i].checks.map(function () { return false; }),
          armed: false,
          confirmText: '',
          mismatch: false,
          windowEnd: 0,
          log: []
        };
      })
    };
  }
  var S = freshState();

  function retainedCount() {
    var n = 0;
    S.steps.forEach(function (st) { if (st.status === 'retained') n++; });
    return n;
  }
  function allRetained() { return retainedCount() === TOTAL; }
  function currentIdx() {
    for (var i = 0; i < TOTAL; i++) if (S.steps[i].status !== 'retained') return i;
    return TOTAL - 1;
  }
  function viewIdx() { return S.sel === null ? currentIdx() : S.sel; }
  function checksAllDone(i) {
    return S.steps[i].checks.every(function (c) { return c; });
  }
  function pushLog(i, msg) {
    S.steps[i].log.push({ t: Date.now(), msg: msg });
  }

  /* ---------- 渲染 ---------- */
  var STATUS_TEXT = { locked: '锁定', ready: '可执行', executed: '恢复窗口', retained: '已完成' };

  function railHTML() {
    var cur = currentIdx(), view = viewIdx(), out = '';
    STEPS.forEach(function (step, idx) {
      if (idx === 0 || STEPS[idx - 1].phaseIdx !== step.phaseIdx) {
        out += '<div class="rail-phase' + (step.phaseIdx === STEPS[view].phaseIdx ? ' rail-phase-active' : '') + '">'
             + '<div class="rail-phase-title">' + esc(step.phaseTitle) + '</div>';
      }
      var s = S.steps[idx];
      var cls = 'rail-step st-' + s.status
              + (idx === view ? ' rail-step-view' : '')
              + (idx === cur && S.sel === null ? ' rail-step-live' : '');
      var canClick = (s.status === 'retained' || s.status === 'executed' || idx === cur);
      var irreversibleMark = step.irreversible ? '<span class="tag-irv" title="不可逆步骤">不可逆</span>' : '';
      out += '<button type="button" class="' + cls + '" data-action="select" data-step="' + idx + '"'
           + (canClick ? '' : ' disabled') + ' data-fkey="rail-' + idx + '"'
           + ' aria-current="' + (idx === cur && S.sel === null ? 'step' : 'false') + '">'
           + '<span class="dot" aria-hidden="true"></span>'
           + '<span class="rail-step-title">' + esc(step.title) + '</span>'
           + irreversibleMark
           + '<span class="rail-status">' + STATUS_TEXT[s.status] + '</span>'
           + '</button>';
      if (idx === TOTAL - 1 || STEPS[idx + 1].phaseIdx !== step.phaseIdx) {
        out += '</div>';
      }
    });
    return out;
  }

  function checksHTML(i) {
    var out = '<fieldset class="checks"><legend>前置检查 <span class="checks-hint">（全部勾选后动作解锁）</span></legend>';
    STEPS[i].checks.forEach(function (c, j) {
      var done = S.steps[i].status !== 'ready' && S.steps[i].status !== 'locked';
      out += '<label class="check' + (done ? ' check-done' : '') + '">'
           + '<input type="checkbox" data-action="toggle-check" data-step="' + i + '" data-i="' + j + '"'
           + (S.steps[i].checks[j] ? ' checked' : '') + (done ? ' disabled' : '')
           + ' data-fkey="chk-' + i + '-' + j + '">'
           + '<span>' + esc(c) + '</span></label>';
    });
    out += '</fieldset>';
    return out;
  }

  function confirmGateHTML(i) {
    var st = S.steps[i];
    var step = STEPS[i];
    var match = st.confirmText.trim().toUpperCase() === TOKEN;
    var out = '<div class="danger-zone" role="region" aria-label="不可逆动作确认门">';
    if (!st.armed) {
      out += '<div class="danger-head"><span class="danger-badge">不可逆</span>'
           + '<span>此动作执行后无法在窗口期外撤销。请先解锁确认门。</span></div>'
           + '<button type="button" class="btn btn-danger-outline" data-action="arm" data-step="' + i + '"'
           + (checksAllDone(i) ? '' : ' disabled') + ' data-fkey="arm-' + i + '">解锁危险动作</button>'
           + (checksAllDone(i) ? '' : '<p class="guard-hint">前置检查全部通过后才能解锁。</p>');
    } else {
      out += '<div class="confirm-panel">'
           + '<div class="danger-head"><span class="danger-badge">不可逆</span>'
           + '<strong>执行「' + esc(step.title) + '」将产生以下后果：</strong></div>'
           + '<ul class="consequences">';
      step.consequences.forEach(function (c) { out += '<li>' + esc(c) + '</li>'; });
      out += '</ul>'
           + '<label class="confirm-label" for="conf-' + i + '">输入 <code>' + esc(TOKEN) + '</code> 以确认执行</label>'
           + '<input id="conf-' + i + '" class="confirm-input' + (st.mismatch ? ' confirm-input-error' : '') + '"'
           + ' type="text" autocomplete="off" spellcheck="false" value="' + esc(st.confirmText) + '"'
           + ' data-action="confirm-input" data-step="' + i + '" data-fkey="conf-' + i + '"'
           + ' placeholder="' + esc(TOKEN) + '" aria-invalid="' + (st.mismatch ? 'true' : 'false') + '">'
           + (st.mismatch ? '<p class="error-text" role="alert">输入不匹配：请准确输入 <code>' + esc(TOKEN) + '</code>。</p>' : '')
           + '<div class="confirm-actions">'
           + '<button type="button" class="btn btn-danger" data-action="execute" data-step="' + i + '"'
           + (match ? '' : ' disabled') + ' data-fkey="exec-' + i + '">确认执行（进入 ' + step.windowSec + ' 秒恢复窗口）</button>'
           + '<button type="button" class="btn btn-ghost" data-action="disarm" data-step="' + i + '" data-fkey="disarm-' + i + '">取消</button>'
           + '</div></div>';
    }
    out += '</div>';
    return out;
  }

  function recoveryCardHTML(i, inline) {
    var remain = Math.max(0, (S.steps[i].windowEnd - Date.now()) / 1000);
    return '<div class="recovery-card' + (inline ? ' recovery-card-inline' : '') + '" role="status">'
         + '<div class="recovery-head"><span class="recovery-badge">恢复窗口</span>'
         + '<span>「' + esc(STEPS[i].title) + '」已执行。撤销或保留，倒计时结束将自动保留。</span></div>'
         + '<div class="recovery-body">'
         + '<span class="countdown" data-cd="' + i + '">' + fmtClock(remain) + '</span>'
         + '<div class="recovery-actions">'
         + '<button type="button" class="btn btn-undo" data-action="undo" data-step="' + i + '" data-fkey="undo-' + i + '">撤销恢复</button>'
         + '<button type="button" class="btn btn-keep" data-action="keep" data-step="' + i + '" data-fkey="keep-' + i + '">确认保留</button>'
         + '</div></div></div>';
  }

  function recordHTML(i) {
    var st = S.steps[i];
    if (!st.log.length) return '';
    var out = '<div class="record"><div class="record-title">执行记录</div><ul class="record-list">';
    st.log.forEach(function (e) {
      out += '<li><span class="record-t">' + fmtTime(e.t) + '</span>' + esc(e.msg) + '</li>';
    });
    out += '</ul></div>';
    return out;
  }

  function stepDetailHTML() {
    var i = viewIdx(), step = STEPS[i], st = S.steps[i];
    var head = '<div class="crumb">' + esc(step.phaseTitle) + ' · 步骤 ' + (i + 1) + '/' + TOTAL
             + (step.irreversible ? ' · <span class="tag-irv">不可逆</span>' : ' · 可逆') + '</div>'
             + '<h1 class="step-title">' + esc(step.title) + '</h1>'
             + '<p class="step-desc">' + esc(step.desc) + '</p>'
             + (step.why ? '<div class="why"><span class="why-mark">为什么重要</span>' + esc(step.why) + '</div>' : '');

    /* 只读回看（selected 态） */
    if (S.sel !== null && i !== currentIdx()) {
      return head
        + '<div class="readonly-note">只读回看：该步骤已结束。<button type="button" class="btn btn-ghost btn-sm" data-action="back-current" data-fkey="back-current">返回当前步骤</button></div>'
        + checksHTML(i) + recordHTML(i);
    }

    var body = checksHTML(i);

    if (st.status === 'ready') {
      if (step.irreversible) {
        body += confirmGateHTML(i);
      } else {
        body += '<div class="action-zone">'
              + '<button type="button" class="btn btn-primary" data-action="execute" data-step="' + i + '"'
              + (checksAllDone(i) ? '' : ' disabled') + ' data-fkey="exec-' + i + '">' + esc(step.actionLabel) + '</button>'
              + (checksAllDone(i) ? '' : '<p class="guard-hint">完成全部前置检查后动作解锁。</p>')
              + '</div>';
      }
    } else if (st.status === 'executed') {
      body += recoveryCardHTML(i, true);
    } else if (st.status === 'retained') {
      body += '<div class="done-note"><span class="done-badge">已完成</span>'
            + (step.irreversible ? '不可逆动作已确认保留。' : '步骤完成。')
            + '<button type="button" class="btn btn-ghost btn-sm" data-action="back-current" data-fkey="back-current">前往当前步骤</button></div>';
    }
    body += recordHTML(i);
    return head + body;
  }

  function summaryHTML() {
    var irv = STEPS.map(function (s, i) { return s.irreversible ? i : null; }).filter(function (x) { return x !== null; });
    var irvRows = irv.map(function (i) {
      var last = S.steps[i].log.length ? S.steps[i].log[S.steps[i].log.length - 1] : null;
      return '<li><span class="dot dot-retained" aria-hidden="true"></span>' + esc(STEPS[i].title)
           + ' — <strong>保留</strong>' + (last ? '（' + fmtTime(last.t) + ' ' + esc(last.msg) + '）' : '') + '</li>';
    }).join('');
    var logs = [];
    S.steps.forEach(function (st, i) {
      st.log.forEach(function (e) { logs.push({ t: e.t, msg: '步骤 ' + (i + 1) + ' · ' + e.msg }); });
    });
    logs.sort(function (a, b) { return a.t - b.t; });
    var logRows = logs.map(function (e) {
      return '<li><span class="record-t">' + fmtTime(e.t) + '</span>' + esc(e.msg) + '</li>';
    }).join('');
    var checksTotal = 0, checksDone = 0;
    STEPS.forEach(function (s, i) {
      checksTotal += s.checks.length;
      s.checks.forEach(function (_, j) { if (S.steps[i].checks[j]) checksDone++; });
    });
    return '<div class="crumb">阶段 4 · 收尾完成</div>'
      + '<div class="summary-hero"><div class="summary-check" aria-hidden="true">✓</div>'
      + '<h1 class="step-title">零失误走完全程</h1>'
      + '<p class="step-desc">orders-primary 下线流程已完成：全程无跳步、无越权动作，所有不可逆步骤均经显式确认执行并在恢复窗口后确认保留。</p></div>'
      + '<div class="stat-row">'
      + '<div class="stat"><div class="stat-num">' + TOTAL + '/' + TOTAL + '</div><div class="stat-label">步骤完成</div></div>'
      + '<div class="stat"><div class="stat-num">' + checksDone + '/' + checksTotal + '</div><div class="stat-label">前置检查通过</div></div>'
      + '<div class="stat"><div class="stat-num">' + irv.length + '</div><div class="stat-label">不可逆步骤（均已确认+保留）</div></div>'
      + '<div class="stat"><div class="stat-num">0</div><div class="stat-label">跳步 / 越权动作</div></div>'
      + '</div>'
      + '<div class="record"><div class="record-title">不可逆步骤终态</div><ul class="summary-irv">' + irvRows + '</ul></div>'
      + '<div class="record"><div class="record-title">完整执行记录</div><ul class="record-list">' + logRows + '</ul></div>'
      + '<div class="action-zone"><button type="button" class="btn btn-primary" data-action="reset-arm" data-fkey="summary-reset">重置演练</button></div>';
  }

  function bannerHTML() {
    var open = [];
    S.steps.forEach(function (st, i) { if (st.status === 'executed') open.push(i); });
    if (!open.length) return '';
    var cards = open.map(function (i) {
      var remain = Math.max(0, (S.steps[i].windowEnd - Date.now()) / 1000);
      return '<div class="banner-card">'
        + '<span class="recovery-badge">恢复窗口</span>'
        + '<span class="banner-text">' + esc(STEPS[i].title) + ' — 请撤销或保留</span>'
        + '<span class="countdown" data-cd="' + i + '">' + fmtClock(remain) + '</span>'
        + '<button type="button" class="btn btn-undo btn-sm" data-action="undo" data-step="' + i + '" data-fkey="undo-b-' + i + '">撤销恢复</button>'
        + '<button type="button" class="btn btn-keep btn-sm" data-action="keep" data-step="' + i + '" data-fkey="keep-b-' + i + '">确认保留</button>'
        + '</div>';
    }).join('');
    return '<div class="recovery-banner" role="status" aria-live="polite">' + cards + '</div>';
  }

  function resetStripHTML() {
    if (!S.resetArmed) return '';
    return '<div class="reset-strip" role="alertdialog" aria-label="确认重置">'
      + '<span>重置将清除全部进度与恢复窗口，回到初始状态。</span>'
      + '<button type="button" class="btn btn-danger btn-sm" data-action="reset-confirm" data-fkey="reset-confirm">确认重置</button>'
      + '<button type="button" class="btn btn-ghost btn-sm" data-action="reset-cancel" data-fkey="reset-cancel">取消</button>'
      + '</div>';
  }

  function render() {
    var focusKey = S.focusKey;

    /* empty 态（防御分支）：数据缺失 */
    if (!RB || !TOTAL) {
      app.innerHTML = '<div class="empty-state"><h1>暂无流程</h1><p>runbook 数据不可用（data.js 未加载或为空）。</p></div>';
      return;
    }

    var done = retainedCount();
    var pct = Math.round(done / TOTAL * 100);
    var elapsed = (S.finishedAt || Date.now()) - S.t0;

    var html = ''
      + '<header class="topbar">'
      + '  <div class="brand"><span class="brand-mark">SUNDOWN</span>'
      + '  <span class="brand-title">' + esc(RB.title) + '</span>'
      + '  <span class="chip">' + esc(RB.resource) + '</span>'
      + '  <span class="chip chip-dim">' + esc(RB.subtitle) + '</span></div>'
      + '  <div class="top-right">'
      + '    <div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="' + TOTAL + '" aria-valuenow="' + done + '" aria-label="流程进度">'
      + '      <div class="progress-bar" style="width:' + pct + '%"></div>'
      + '    </div>'
      + '    <span class="progress-text">' + done + '/' + TOTAL + ' 步</span>'
      + '    <span class="elapsed">耗时 <span data-elapsed>' + fmtElapsed(elapsed) + '</span></span>'
      + '    <button type="button" class="btn btn-ghost btn-sm" data-action="reset-arm" data-fkey="reset-arm"' + (allRetained() ? ' style="display:none"' : '') + '>重置演练</button>'
      + '  </div>'
      + '</header>'
      + '<p class="brief">' + esc(RB.brief) + '</p>'
      + resetStripHTML()
      + bannerHTML()
      + '<div class="layout">'
      + '  <nav class="rail" aria-label="流程轨道">' + railHTML() + '</nav>'
      + '  <main class="detail">'
      + (allRetained() ? summaryHTML() : stepDetailHTML())
      + '  </main>'
      + '</div>';

    app.innerHTML = html;

    if (focusKey) {
      var el = app.querySelector('[data-fkey="' + focusKey.replace(/"/g, '') + '"]');
      if (el) {
        el.focus();
        if (el.setSelectionRange && el.value != null) {
          try { el.setSelectionRange(el.value.length, el.value.length); } catch (e) { /* 非 text 输入 */ }
        }
      }
    }
    updateTickTexts();
  }

  function updateTickTexts() {
    var els = app.querySelectorAll('[data-cd]');
    Array.prototype.forEach.call(els, function (el) {
      var i = parseInt(el.getAttribute('data-cd'), 10);
      el.textContent = fmtClock(Math.max(0, (S.steps[i].windowEnd - Date.now()) / 1000));
    });
    var eEl = app.querySelector('[data-elapsed]');
    if (eEl) eEl.textContent = fmtElapsed((S.finishedAt || Date.now()) - S.t0);
  }

  /* ---------- 动作 ---------- */
  app.addEventListener('click', function (ev) {
    var el = ev.target.closest('[data-action]');
    if (!el || el.disabled) return;
    var act = el.getAttribute('data-action');
    var i = el.getAttribute('data-step') !== null ? parseInt(el.getAttribute('data-step'), 10) : null;

    /* 复选框与确认输入由 change/input 事件处理；
       此处先渲染会使原元素脱离 DOM，change 将无法冒泡到 #app */
    if (act === 'toggle-check' || act === 'confirm-input') return;

    var acted = false;
    S.focusKey = el.getAttribute('data-fkey') || null;

    switch (act) {
      case 'select': {
        var idx = i;
        if (idx === currentIdx()) { S.sel = null; acted = true; }
        else if (S.steps[idx].status === 'retained' || S.steps[idx].status === 'executed') { S.sel = idx; acted = true; }
        break;
      }
      case 'back-current': S.sel = null; acted = true; break;
      case 'arm': S.steps[i].armed = true; acted = true; break;
      case 'disarm': S.steps[i].armed = false; S.steps[i].mismatch = false; acted = true; break;
      case 'execute': doExecute(i); acted = true; break;
      case 'undo':
        S.steps[i].status = 'ready';
        S.steps[i].windowEnd = 0;
        S.steps[i].armed = false;
        S.steps[i].confirmText = '';
        pushLog(i, '撤销恢复——操作已回滚，步骤回到可执行态');
        acted = true;
        break;
      case 'keep':
        S.steps[i].status = 'retained';
        S.steps[i].windowEnd = 0;
        pushLog(i, '确认保留——不可逆操作生效');
        advanceIf(i);
        acted = true;
        break;
      case 'reset-arm': S.resetArmed = true; acted = true; break;
      case 'reset-cancel': S.resetArmed = false; acted = true; break;
      case 'reset-confirm': S = freshState(); acted = true; break;
    }
    if (acted) render();
  });

  app.addEventListener('change', function (ev) {
    var el = ev.target;
    if (el.getAttribute && el.getAttribute('data-action') === 'toggle-check') {
      var i = parseInt(el.getAttribute('data-step'), 10);
      var j = parseInt(el.getAttribute('data-i'), 10);
      S.steps[i].checks[j] = el.checked;
      S.focusKey = el.getAttribute('data-fkey');
      render();
    }
    /* 强确认输入失焦校验 → error 态（不抢回焦点） */
    if (el.classList && el.classList.contains('confirm-input')) {
      var si = parseInt(el.getAttribute('data-step'), 10);
      var txt = S.steps[si].confirmText;
      var bad = txt.length > 0 && txt.trim().toUpperCase() !== TOKEN;
      if (bad !== S.steps[si].mismatch) { S.steps[si].mismatch = bad; S.focusKey = null; render(); }
    }
  });

  app.addEventListener('input', function (ev) {
    var el = ev.target;
    if (el.classList && el.classList.contains('confirm-input')) {
      var i = parseInt(el.getAttribute('data-step'), 10);
      S.steps[i].confirmText = el.value;
      S.steps[i].mismatch = false;
      var match = el.value.trim().toUpperCase() === TOKEN;
      var btn = app.querySelector('[data-action="execute"][data-step="' + i + '"]');
      if (btn) btn.disabled = !match;
    }
  });

  function doExecute(i) {
    var st = S.steps[i], step = STEPS[i];
    if (!checksAllDone(i)) return;              // 护栏：检查未过禁止执行
    if (step.irreversible && st.confirmText.trim().toUpperCase() !== TOKEN) {
      st.mismatch = true;                       // 护栏：强确认不匹配 → error 态
      return;
    }
    if (step.irreversible) {
      st.status = 'executed';
      st.windowEnd = Date.now() + step.windowSec * 1000;
      pushLog(i, '确认执行（已手输 ' + TOKEN + '）——进入 ' + step.windowSec + 's 恢复窗口');
      st.armed = false; st.confirmText = '';
    } else {
      st.status = 'retained';
      pushLog(i, '执行完成：' + step.actionLabel);
      advanceIf(i);
    }
  }

  function advanceIf(i) {
    if (S.steps[i].status !== 'retained') return; // 护栏：只有保留态才解锁下一步
    if (i + 1 < TOTAL && S.steps[i + 1].status === 'locked') {
      S.steps[i + 1].status = 'ready';
    }
    if (allRetained()) S.finishedAt = Date.now();
  }

  /* ---------- 心跳：倒计时与到期 ---------- */
  setInterval(function () {
    var now = Date.now(), dirty = false;
    S.steps.forEach(function (st, i) {
      if (st.status === 'executed' && now >= st.windowEnd) {
        st.status = 'retained';
        st.windowEnd = 0;
        pushLog(i, '恢复窗口到期，自动保留');
        dirty = true;
      }
    });
    if (dirty) {
      for (var k = 0; k < TOTAL; k++) advanceIf(k);
      render();
      return;
    }
    updateTickTexts();
  }, 250);

  /* ---------- 焦点追踪（键盘可达性） ---------- */
  app.addEventListener('focusin', function (ev) {
    var el = ev.target.closest ? ev.target.closest('[data-fkey]') : null;
    if (el) S.focusKey = el.getAttribute('data-fkey');
  });

  /* ---------- 首屏同步渲染：加载即就绪 ---------- */
  render();
})();
