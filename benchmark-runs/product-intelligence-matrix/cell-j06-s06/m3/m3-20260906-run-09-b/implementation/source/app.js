/* Orbit CDN · 变更时间线 —— 应用逻辑
 *
 * 设计约定（与验收种子对应）：
 *  - 时间结构：changeSets 按 ts 严格递增渲染，上早下晚；节点的视觉顺序 = 时间顺序。
 *  - 变更语义：因果徽标只允许指向「因=更早 / 果=更晚」；启动时校验 cause.ts < effect.ts。
 *  - 状态回放：replayTo 为纯函数，按时间升序逐条应用 change 至选中节点（含），
 *    与时间轴共用同一排序 —— 时间结构与变更语义由构造保证一致。
 *  - 状态清单：ready（首屏内联数据即就绪，按交付约束不存在加载态）、selected、
 *    empty（筛选无匹配）、error（渲染异常横幅）。
 */
(function () {
  'use strict';

  var DATA = window.ORBIT_DATA;

  var TYPE_META = {
    add:    { label: '新增',   symbol: '+', cls: 't-add' },
    modify: { label: '修改',   symbol: '~', cls: 't-modify' },
    remove: { label: '移除',   symbol: '−', cls: 't-remove' },
    rename: { label: '重命名', symbol: '→', cls: 't-rename' }
  };

  /* ---------- 数据整理与完整性校验 ---------- */

  var sets = DATA.changeSets.slice().sort(function (a, b) {
    return a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0;
  });
  var byId = {};
  sets.forEach(function (s) { byId[s.id] = s; });

  var integrityProblems = [];
  for (var i = 1; i < sets.length; i++) {
    if (!(sets[i - 1].ts < sets[i].ts)) {
      integrityProblems.push('时间序冲突：' + sets[i - 1].id + ' 不早于 ' + sets[i].id);
    }
  }

  var linksByCause = {}, linksByEffect = {};
  DATA.causalLinks.forEach(function (l) {
    var c = byId[l.cause], e = byId[l.effect];
    if (!c || !e) {
      integrityProblems.push('因果链接 ' + l.id + ' 端点缺失');
      return;
    }
    if (!(c.ts < e.ts)) {
      integrityProblems.push('因果链接 ' + l.id + ' 违反时间方向：' + l.cause + ' 不早于 ' + l.effect);
    }
    (linksByCause[l.cause] = linksByCause[l.cause] || []).push(l);
    (linksByEffect[l.effect] = linksByEffect[l.effect] || []).push(l);
  });
  if (integrityProblems.length) {
    console.warn('[数据完整性] 时间/因果约束冲突：\n' + integrityProblems.join('\n'));
  }

  var totalChanges = sets.reduce(function (n, s) { return n + s.changes.length; }, 0);

  var allElements = {};
  sets.forEach(function (s) {
    s.changes.forEach(function (ch) {
      allElements[ch.element] = true;
      if (ch.to) allElements[ch.to] = true;
    });
  });
  var elementList = Object.keys(allElements).sort();

  /* ---------- 状态（单一 store：selection + query） ---------- */

  var state = {
    selectedId: sets[sets.length - 1].id, // 首屏默认选中最新变更集
    type: 'all',
    element: 'all'
  };

  /* ---------- 工具 ---------- */

  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  var WD = ['日', '一', '二', '三', '四', '五', '六'];

  function parts(ts) {
    var d = new Date(ts);
    return {
      day: pad(d.getMonth() + 1) + '-' + pad(d.getDate()),
      weekday: '周' + WD[d.getDay()],
      time: pad(d.getHours()) + ':' + pad(d.getMinutes()),
      full: d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
        ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes())
    };
  }

  function matches(ch) {
    if (state.type !== 'all' && ch.type !== state.type) return false;
    if (state.element !== 'all' && ch.element !== state.element && ch.to !== state.element) return false;
    return true;
  }

  function changesMatchIn(cs) {
    return cs.changes.some(matches);
  }

  /* 回放：按时间升序应用至 selectedId（含）。返回 Map<element, {value, removed, by}> */
  function replayTo(csId) {
    var target = byId[csId];
    var m = new Map();
    for (var i = 0; i < sets.length; i++) {
      var s = sets[i];
      if (s.ts > target.ts) break;
      s.changes.forEach(function (ch) {
        if (ch.type === 'add' || ch.type === 'modify') {
          m.set(ch.element, { value: ch.after, removed: false, by: s.id });
        } else if (ch.type === 'rename') {
          m.delete(ch.element);
          m.set(ch.to, { value: ch.after, removed: false, by: s.id });
        } else if (ch.type === 'remove') {
          m.set(ch.element, { value: null, removed: true, by: s.id });
        }
      });
    }
    return m;
  }

  /* ---------- 渲染：时间线 ---------- */

  function compactRow(ch, isMatch) {
    var t = TYPE_META[ch.type];
    var html = '<div class="chg' + (isMatch ? '' : ' dim') + '" data-chg="' + esc(ch.id) + '">' +
      '<i class="sym ' + t.cls + '" title="' + t.label + '">' + t.symbol + '</i>' +
      '<span class="el">' + esc(ch.element) + '</span>';
    if (ch.type === 'rename') {
      html += ' <span class="arrow">→</span> <span class="el">' + esc(ch.to) + '</span>' +
        ' <span class="arrow">·</span> <span class="val">' + esc(ch.before) + '</span>' +
        ' <span class="arrow">→</span> <span class="val after">' + esc(ch.after) + '</span>';
    } else if (ch.type === 'add') {
      html += ' <span class="arrow">=</span> <span class="val after">' + esc(ch.after) + '</span>';
    } else if (ch.type === 'remove') {
      html += ' <span class="val removed-mark">' + esc(ch.before) + '</span>' +
        ' <span class="arrow">→</span> <span class="val">已移除</span>';
    } else {
      html += ' <span class="val">' + esc(ch.before) + '</span>' +
        ' <span class="arrow">→</span> <span class="val after">' + esc(ch.after) + '</span>';
    }
    html += '</div>';
    return html;
  }

  function causalBadges(csId) {
    var out = [];
    (linksByEffect[csId] || []).forEach(function (l) {
      out.push('<button type="button" class="causal-badge b-cause" data-jump="' + esc(l.cause) + '"' +
        ' title="跳转到因（更早）">' + '↩ 因 ' + esc(l.cause) + '</button>');
    });
    (linksByCause[csId] || []).forEach(function (l) {
      out.push('<button type="button" class="causal-badge b-effect" data-jump="' + esc(l.effect) + '"' +
        ' title="跳转到果（更晚）">' + '↪ 果 ' + esc(l.effect) + '</button>');
    });
    return out.join('');
  }

  function renderTimeline() {
    var root = document.getElementById('timeline');
    var html = '';
    var lastDay = null;
    var anyRowVisible = false;

    sets.forEach(function (s, idx) {
      var p = parts(s.ts);
      if (p.day !== lastDay) {
        lastDay = p.day;
        html += '<div class="day-sep">' + esc(p.day) + ' ' + esc(p.weekday) + '</div>';
      }
      var hasMatch = changesMatchIn(s);
      if (hasMatch) anyRowVisible = true;
      var linkedIds = causalNeighborIds(s.id);
      var cls = 'cs-node' +
        (s.id === state.selectedId ? ' selected' : '') +
        (linkedIds ? ' linked' : '') +
        (hasMatch ? '' : ' muted');
      html += '<article class="' + cls + '" role="listitem" data-cs="' + esc(s.id) + '"' +
        ' tabindex="-1" aria-current="' + (s.id === state.selectedId) + '">' +
        '<div class="node-head">' +
          '<span class="node-id">' + esc(s.id) + '</span>' +
          '<span class="node-title">' + esc(s.title) + '</span>' +
          '<span class="node-time">' + esc(p.day) + ' ' + esc(p.time) + '</span>' +
          '<span class="node-author">@' + esc(s.author) + '</span>' +
          '<span class="node-head-right">' + causalBadges(s.id) + '</span>' +
        '</div>' +
        '<div class="node-body">' +
          s.changes.map(function (ch) { return compactRow(ch, matches(ch)); }).join('') +
          (hasMatch ? '' : '<p class="node-empty-note">当前筛选下无匹配变更（已置灰保留结构）</p>') +
        '</div>' +
      '</article>';
    });

    if (!anyRowVisible) {
      html = '<div class="timeline-empty" role="status">' +
        '<strong>当前筛选无任何匹配变更</strong>' +
        '时间线结构保持完整显示（已置灰）。调整或清除筛选以查看变更明细。' +
        '</div>' + html;
    }
    root.innerHTML = html;
    root.setAttribute('aria-label', '变更集序列，共 ' + sets.length + ' 个，按时间升序');
  }

  function causalNeighborIds(csId) {
    var ids = [];
    (linksByCause[csId] || []).forEach(function (l) { ids.push(l.effect); });
    (linksByEffect[csId] || []).forEach(function (l) { ids.push(l.cause); });
    return ids;
  }

  /* ---------- 渲染：选中详情 ---------- */

  function detailRow(ch) {
    var t = TYPE_META[ch.type];
    var elHtml = esc(ch.element);
    if (ch.type === 'rename') {
      elHtml += ' <span class="arrow">→</span> <span class="to">' + esc(ch.to) + '</span>';
    }
    var diff = '';
    if (ch.type === 'add') {
      diff = '<span class="val after">' + esc(ch.after) + '</span>';
    } else if (ch.type === 'remove') {
      diff = '<span class="val before strike">' + esc(ch.before) + '</span>' +
        '<span class="arrow">→</span><span class="val">已移除</span>';
    } else if (ch.type === 'rename') {
      diff = '<span class="val before">' + esc(ch.before) + '</span>' +
        '<span class="arrow">→</span><span class="val after">' + esc(ch.after) + '</span>';
    } else {
      diff = '<span class="val before">' + esc(ch.before) + '</span>' +
        '<span class="arrow">→</span><span class="val after">' + esc(ch.after) + '</span>';
    }
    return '<div class="insp-chg">' +
      '<div class="row1"><i class="sym ' + t.cls + '" title="' + t.label + '">' + t.symbol + '</i>' +
      '<span class="el">' + elHtml + '</span>' +
      '<span class="tail node-author">' + t.label + '</span></div>' +
      '<div class="diff">' + diff + '</div>' +
      (ch.note ? '<p class="note">' + esc(ch.note) + '</p>' : '') +
    '</div>';
  }

  function causalCard(l, dir) {
    var other = dir === 'cause' ? l.cause : l.effect;
    var s = byId[other];
    return '<button type="button" class="causal-card b-' + (dir === 'cause' ? 'cause' : 'effect') + '" data-jump="' + esc(other) + '">' +
      '<span class="cc-top"><span class="cc-id">' + esc(other) + '</span>' +
      '<span class="cc-time">' + esc(parts(s.ts).day + ' ' + parts(s.ts).time) + '</span></span>' +
      '<span class="cc-reason">' + esc(l.reason) + '</span>' +
    '</button>';
  }

  function renderInspector() {
    var root = document.getElementById('region-inspector');
    var s = byId[state.selectedId];
    var p = parts(s.ts);
    var causes = (linksByEffect[s.id] || []);
    var effects = (linksByCause[s.id] || []);

    root.innerHTML =
      '<div class="insp-head">' +
        '<div class="line1"><span class="node-id">' + esc(s.id) + '</span>' +
        '<span class="title">' + esc(s.title) + '</span></div>' +
        '<p class="sub"><span>' + esc(p.full) + '</span><span>@' + esc(s.author) + '</span>' +
        '<span>触发：' + esc(s.trigger) + '</span>' +
        '<span>' + s.tags.map(function (t) { return '<span class="tag">' + esc(t) + '</span>'; }).join('') + '</span></p>' +
      '</div>' +
      '<div class="causal-block">' +
        '<p class="section-label"><span class="accent-cause">↩ 因何发生</span>（指向更早）</p>' +
        (causes.length ? causes.map(function (l) { return causalCard(l, 'cause'); }).join('')
                       : '<p class="causal-none">无记录的因（窗口内起点）</p>') +
      '</div>' +
      '<div class="causal-block">' +
        '<p class="section-label"><span class="accent-effect">↪ 引发</span>（指向更晚）</p>' +
        (effects.length ? effects.map(function (l) { return causalCard(l, 'effect'); }).join('')
                        : '<p class="causal-none">无记录的果（窗口内终点）</p>') +
      '</div>' +
      '<p class="section-label">变更明细 · ' + s.changes.length + ' 条</p>' +
      '<div class="insp-changes">' + s.changes.map(detailRow).join('') + '</div>';
  }

  /* ---------- 渲染：状态回放 ---------- */

  function renderStatePanel() {
    var root = document.getElementById('region-state-panel');
    var s = byId[state.selectedId];
    var p = parts(s.ts);
    var snap = replayTo(s.id);

    var touched = {};
    s.changes.forEach(function (ch) {
      touched[ch.element] = true;
      if (ch.to) touched[ch.to] = true;
    });

    var keys = Array.from(snap.keys()).sort();
    var rows = keys.map(function (k) {
      var v = snap.get(k);
      var valHtml;
      if (v.removed) {
        valHtml = '<span class="removed">（无值）</span><span class="removed-by">已移除 @' + esc(v.by) + '</span>';
      } else {
        valHtml = esc(v.value);
      }
      return '<tr class="' + (touched[k] ? 'touched' : '') + '">' +
        '<td class="el-cell">' + (touched[k] ? '<span class="dot" title="被选中变更集作用"></span>' : '') + esc(k) + '</td>' +
        '<td class="val-cell">' + valHtml + '</td>' +
      '</tr>';
    }).join('');

    root.innerHTML =
      '<div class="state-head">' +
        '<h2>状态快照 <span class="pane-sub">回放至选中时刻</span></h2>' +
        '<p class="asof">截至 <span class="mono">' + esc(s.id) + '</span> · ' + esc(p.full) +
        ' · 已按时间序应用 <span class="mono">' + appliedCount(s.id) + '</span> 条变更 · 元素 <span class="mono">' + keys.length + '</span> 个</p>' +
      '</div>' +
      '<div class="state-scroll"><table class="state-table">' +
        '<thead><tr><th>元素</th><th>当前值</th></tr></thead>' +
        '<tbody>' + rows + '</tbody>' +
      '</table></div>';
  }

  function appliedCount(csId) {
    var target = byId[csId], n = 0;
    sets.forEach(function (s) {
      if (s.ts <= target.ts) n += s.changes.length;
    });
    return n;
  }

  /* ---------- 渲染：筛选行 / 头部 ---------- */

  function renderFilters() {
    var chipsRoot = document.getElementById('type-chips');
    var defs = [['all', '全部'], ['add', '新增'], ['modify', '修改'], ['remove', '移除'], ['rename', '重命名']];
    chipsRoot.innerHTML = defs.map(function (d) {
      return '<button type="button" class="chip" data-type="' + d[0] + '" aria-pressed="' + (state.type === d[0]) + '">' + d[1] + '</button>';
    }).join('');

    var sel = document.getElementById('element-select');
    sel.innerHTML = '<option value="all">全部元素</option>' + elementList.map(function (e) {
      return '<option value="' + esc(e) + '"' + (state.element === e ? ' selected' : '') + '>' + esc(e) + '</option>';
    }).join('');

    var active = state.type !== 'all' || state.element !== 'all';
    document.getElementById('clear-filters').hidden = !active;

    var note = document.getElementById('filter-note');
    var visibleRows = 0;
    sets.forEach(function (s) { s.changes.forEach(function (ch) { if (matches(ch)) visibleRows++; }); });
    if (!active) {
      note.textContent = '显示全部 ' + visibleRows + ' 条变更';
      note.className = 'filter-note';
    } else if (visibleRows === 0) {
      note.textContent = '无匹配变更（0/' + totalChanges + '）';
      note.className = 'filter-note warn';
    } else {
      note.textContent = '筛选中：显示 ' + visibleRows + ' / ' + totalChanges + ' 条变更';
      note.className = 'filter-note' + (visibleRows < totalChanges ? ' warn' : '');
    }
  }

  function renderHeader() {
    var first = parts(sets[0].ts), last = parts(sets[sets.length - 1].ts);
    document.getElementById('header-meta').textContent =
      DATA.windowLabel + ' · ' + sets.length + ' 个变更集 · ' + totalChanges + ' 条变更 · ' +
      DATA.causalLinks.length + ' 条因果链接 · ' + first.day + ' → ' + last.day;
  }

  function renderAll() {
    renderHeader();
    renderFilters();
    renderTimeline();
    renderInspector();
    renderStatePanel();
  }

  /* ---------- 交互 ---------- */

  function select(csId, opts) {
    if (!byId[csId]) return;
    state.selectedId = csId;
    renderTimeline();
    renderInspector();
    renderStatePanel();
    var node = document.querySelector('.cs-node[data-cs="' + csId + '"]');
    if (node) {
      if (opts && opts.center) {
        node.scrollIntoView({ block: 'center', behavior: 'smooth' });
      } else {
        node.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
      if (opts && opts.flash) {
        node.classList.remove('flash');
        void node.offsetWidth; // 重新触发动画
        node.classList.add('flash');
      }
    }
  }

  function jump(csId) { select(csId, { center: true, flash: true }); }

  document.getElementById('timeline').addEventListener('click', function (ev) {
    var badge = ev.target.closest('.causal-badge');
    if (badge) {
      jump(badge.getAttribute('data-jump'));
      return;
    }
    var node = ev.target.closest('.cs-node');
    if (node) select(node.getAttribute('data-cs'));
  });

  document.getElementById('region-inspector').addEventListener('click', function (ev) {
    var card = ev.target.closest('.causal-card');
    if (card) jump(card.getAttribute('data-jump'));
  });

  document.getElementById('type-chips').addEventListener('click', function (ev) {
    var chip = ev.target.closest('.chip');
    if (!chip) return;
    state.type = chip.getAttribute('data-type');
    renderFilters();
    renderTimeline();
  });

  document.getElementById('element-select').addEventListener('change', function (ev) {
    state.element = ev.target.value;
    renderFilters();
    renderTimeline();
  });

  function clearFilters() {
    state.type = 'all';
    state.element = 'all';
    renderFilters();
    renderTimeline();
  }
  document.getElementById('clear-filters').addEventListener('click', clearFilters);

  document.addEventListener('keydown', function (ev) {
    if (ev.target && (ev.target.tagName === 'SELECT' || ev.target.tagName === 'INPUT' || ev.target.tagName === 'TEXTAREA')) return;
    if (ev.key === 'Escape') { clearFilters(); return; }
    if (ev.key !== 'ArrowUp' && ev.key !== 'ArrowDown') return;
    ev.preventDefault();
    var idx = sets.findIndex(function (s) { return s.id === state.selectedId; });
    var next = ev.key === 'ArrowUp' ? idx - 1 : idx + 1;
    if (next < 0 || next >= sets.length) return;
    select(sets[next].id);
  });

  /* ---------- 启动：内联数据随脚本就绪，无加载态 ---------- */

  try {
    renderAll();
    if (integrityProblems.length) {
      var err = document.getElementById('app-error');
      err.hidden = false;
      err.textContent = '数据完整性告警：' + integrityProblems.join('；');
    }
  } catch (e) {
    var err = document.getElementById('app-error');
    err.hidden = false;
    err.textContent = '渲染失败：' + (e && e.message ? e.message : e);
    throw e;
  }
})();
