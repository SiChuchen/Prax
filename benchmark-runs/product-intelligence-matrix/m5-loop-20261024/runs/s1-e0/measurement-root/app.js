/*
 * PRISM · 多维透镜探索台
 * 状态模型：lens / query / filters / selection / sort / grouped 全部存于可快照 state，
 * 任一变更经 commit() 生成带归属（origin）的台账条目；undo/redo/rollback 只移动历史指针。
 * 维度切换只改 lens 槽位 —— 过滤、查询、选择天然跨维度保留。
 */
(function () {
  'use strict';

  var D = window.PRISM_DATA;

  /* ── 启动守卫（error 态；数据内联，正常路径无加载态）── */
  var boot = document.getElementById('boot');
  if (!D || !D.records || !D.records.length || !D.dimensions || !D.dimensions.length) {
    document.querySelector('.layout').classList.add('hidden');
    document.querySelector('.continuity').classList.add('hidden');
    boot.innerHTML = '<div class="boot-error"><h2>数据集不可用</h2><p>内联数据模块缺失或为空（error 状态）。</p></div>';
    return;
  }

  /* ── 工具 ── */
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  }); }
  function fmtInt(n) { return n.toLocaleString('zh-CN'); }
  function $id(x) { return document.getElementById(x); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function hms(t) { var d = new Date(t); return ('0'+d.getHours()).slice(-2) + ':' + ('0'+d.getMinutes()).slice(-2) + ':' + ('0'+d.getSeconds()).slice(-2); }

  /* ── 维度元数据 ── */
  var DIMS = D.dimensions;
  var DIM_IDS = DIMS.map(function (d) { return d.id; });
  var DIM_BY = {}; DIMS.forEach(function (d) { DIM_BY[d.id] = d; });
  var PARENT_OF = {}; // parentOf[dim] = { value: parentValue }
  DIMS.forEach(function (d) {
    if (!d.parent) return;
    var m = {};
    D.records.forEach(function (r) { m[r[d.id]] = r[d.parent]; });
    PARENT_OF[d.id] = m;
  });
  // 每个维度的取值域（全集固定，过滤时取值行不消失 → 结构稳定）
  var DOMAIN = {};
  DIM_IDS.forEach(function (dim) {
    var s = new Set();
    D.records.forEach(function (r) { s.add(r[dim]); });
    DOMAIN[dim] = Array.from(s);
  });

  /* ── 状态 ── */
  var state = {
    lens: 'constellation',
    query: '',
    filters: {},          // { dim: [values...] } 有序
    selection: null,      // record id
    sort: 'count',        // 'count' | 'name'
    grouped: true
  };

  /* ── 台账（历史）── */
  var ORIGINS = {
    init: '初始', rail: '维度轨', keys: '快捷键 ↑↓', projrow: '投影行', chipx: 'chip ×',
    clear: '清空按钮', search: '搜索框', reclist: '记录列表', ledger: '台账回滚',
    undo: '撤销', redo: '重做', sortseg: '排序控件', groupseg: '分组控件'
  };
  var VERBS = {
    INIT: '载入', LENS_SWITCH: '切换透镜', FILTER_ADD: '加过滤', FILTER_REMOVE: '移过滤',
    FILTER_TOGGLE: '切换过滤', FILTERS_CLEAR: '清空过滤', SEARCH: '查询', SELECT: '选中',
    DESELECT: '取消选中', SORT: '排序', GROUP: '分组', ROLLBACK: '回滚', UNDO: '撤销', REDO: '重做'
  };
  var history = [];   // { t, verb, origin, desc, state }
  var hIndex = -1;

  function snap() { return clone(state); }
  function restore(s) { state.lens = s.lens; state.query = s.query; state.filters = clone(s.filters);
    state.selection = s.selection; state.sort = s.sort; state.grouped = s.grouped; }

  function pushEntry(verb, origin, desc) {
    history.push({ t: Date.now(), verb: verb, origin: origin, desc: desc, state: snap() });
    hIndex = history.length - 1;
  }
  // 所有状态变更唯一入口
  function commit(verb, origin, desc, mut) {
    if (mut) mut();
    history = history.slice(0, hIndex + 1);
    pushEntry(verb, origin, desc);
    render();
  }
  function movePointer(i, verb) {
    if (i < 0 || i >= history.length || i === hIndex) return;
    hIndex = i;
    restore(history[i].state);
    render();
  }
  function undo() { if (hIndex > 0) movePointer(hIndex - 1, 'UNDO'); }
  function redo() { if (hIndex < history.length - 1) movePointer(hIndex + 1, 'REDO'); }

  pushEntry('INIT', 'init', '数据集就绪：' + fmtInt(D.count) + ' 条记录 · ' + DIMS.length + ' 个维度 · 无过滤');

  /* ── 过滤器操作 ── */
  function filterCount() { var n = 0; for (var k in state.filters) n += state.filters[k].length; return n; }
  function toggleFilter(dim, value) {
    commit('FILTER_TOGGLE', 'projrow',
      (hasF(dim, value) ? '移除过滤 ' : '添加过滤 ') + DIM_BY[dim].label + ' = ' + value,
      function () {
        var arr = state.filters[dim] ? state.filters[dim].slice() : [];
        var i = arr.indexOf(value);
        if (i >= 0) arr.splice(i, 1); else { arr.push(value); arr.sort(); }
        if (arr.length) state.filters[dim] = arr; else delete state.filters[dim];
      });
  }
  function removeFilter(dim, value) {
    commit('FILTER_REMOVE', 'chipx', '移除过滤 ' + DIM_BY[dim].label + ' = ' + value, function () {
      var arr = (state.filters[dim] || []).filter(function (v) { return v !== value; });
      if (arr.length) state.filters[dim] = arr; else delete state.filters[dim];
    });
  }
  function hasF(dim, value) { return !!(state.filters[dim] && state.filters[dim].indexOf(value) >= 0); }

  /* ── 派生：查询 + 过滤 → 记录集 ── */
  function matchesQuery(r, q) {
    return r.name.toLowerCase().indexOf(q) >= 0 || r.id.toLowerCase().indexOf(q) >= 0 ||
      r.note.toLowerCase().indexOf(q) >= 0 || r.constellation.toLowerCase().indexOf(q) >= 0;
  }
  function filteredRecords() {
    var q = state.query.trim().toLowerCase();
    return D.records.filter(function (r) {
      if (q && !matchesQuery(r, q)) return false;
      for (var dim in state.filters) {
        if (state.filters[dim].indexOf(r[dim]) < 0) return false;
      }
      return true;
    });
  }
  // 投影：dim 的每个取值 → 计数/均值（取值域固定，零计数行保留）
  function project(dim, recs) {
    var map = {};
    DOMAIN[dim].forEach(function (v) { map[v] = { value: v, count: 0, radius: 0, conf: 0 }; });
    recs.forEach(function (r) {
      var g = map[r[dim]]; g.count++; g.radius += r.radius_r; g.conf += r.confidence;
    });
    var arr = DOMAIN[dim].map(function (v) { return map[v]; });
    arr.forEach(function (g) {
      g.avgRadius = g.count ? g.radius / g.count : 0;
      g.avgConf = g.count ? g.conf / g.count : 0;
    });
    if (state.sort === 'count') arr.sort(function (a, b) { return b.count - a.count || (a.value < b.value ? -1 : 1); });
    else arr.sort(function (a, b) { return a.value < b.value ? -1 : 1; });
    return arr;
  }

  /* ── 渲染 ── */
  var els = {
    meta: $id('meta'), orientation: $id('orientation'), continuity: $id('continuity'),
    dimrail: $id('dimrail'), dimCount: $id('dimCount'), projDim: $id('projDim'), projSub: $id('projSub'),
    projRows: $id('projRows'), sortSeg: $id('sortSeg'), groupSeg: $id('groupSeg'),
    chips: $id('chips'), chipCount: $id('chipCount'), detail: $id('detail'),
    recScroll: $id('recScroll'), recCount: $id('recCount'),
    ledger: $id('ledger'), ledScroll: $id('ledScroll'), ledCount: $id('ledCount'),
    search: $id('search'), undoBtn: $id('undoBtn'), redoBtn: $id('redoBtn'), clearBtn: $id('clearBtn'),
    tip: $id('tip'), projScroll: $id('projScroll')
  };

  var RECORD_CAP = 100, LEDGER_CAP = 200;

  function render() {
    var recs = filteredRecords();
    renderTop(recs);
    renderRail();
    renderProjection(recs);
    renderChips();
    renderRecords(recs);
    renderDetail();
    renderLedger();
    renderContinuity();
  }

  function renderTop(recs) {
    els.meta.textContent = D.dataset + ' · ' + fmtInt(D.count) + ' 条 · ' + DIMS.length + ' 维度';
    els.orientation.innerHTML =
      '当前投影 <b>' + esc(DIM_BY[state.lens].label) + '</b>' +
      ' · 范围内 <b>' + fmtInt(recs.length) + '</b> 条' +
      ' · 过滤 <b>' + filterCount() + '</b>' +
      ' · 选中 <b>' + (state.selection ? '1' : '0') + '</b>';
    els.undoBtn.disabled = hIndex <= 0;
    els.redoBtn.disabled = hIndex >= history.length - 1;
    els.clearBtn.disabled = filterCount() === 0;
    els.search.value = state.query;
    els.dimCount.textContent = DIMS.length + ' 个';
  }

  function renderRail() {
    var fc = {};
    for (var dim in state.filters) fc[dim] = state.filters[dim].length;
    els.dimrail.innerHTML = DIMS.map(function (d) {
      var on = d.id === state.lens;
      return '<button class="dimbtn' + (on ? ' active' : '') + '" data-dim="' + d.id + '"' +
        (on ? ' aria-current="true"' : '') + ' title="投影到『' + esc(d.label) + '』（过滤与选中保留）">' +
        '<span class="n">' + esc(d.label) + '</span>' +
        (fc[d.id] ? '<span class="fbadge" title="' + fc[d.id] + ' 个活跃过滤">' + fc[d.id] + '</span>' : '') +
        '<span class="cnt">' + DOMAIN[d.id].length + ' 值</span></button>';
    }).join('');
  }

  function renderProjection(recs) {
    var dim = state.lens, meta = DIM_BY[dim];
    els.projDim.textContent = meta.label;
    var n = DOMAIN[dim].length;
    els.projSub.textContent = n + ' 个取值 · 全域 ' + fmtInt(D.count) + ' 条 · 范围内 ' + fmtInt(recs.length) + ' 条' +
      (filterCount() ? ' · 过滤后计数（取值行不消失）' : ' · 点击行即可过滤');
    els.sortSeg.querySelectorAll('button').forEach(function (b) {
      b.classList.toggle('on', b.dataset.sort === state.sort);
    });
    var canGroup = !!meta.parent;
    els.groupSeg.classList.toggle('hidden', !canGroup);
    els.groupSeg.querySelectorAll('button').forEach(function (b) {
      b.classList.toggle('on', (b.dataset.group === '1') === state.grouped);
    });

    var groups = project(dim, recs);
    var max = Math.max.apply(null, groups.map(function (g) { return g.count; })) || 1;
    var sel = state.selection ? byId(state.selection) : null;
    var html = '';

    function rowHtml(g) {
      var w = Math.round(g.count / max * 1000) / 10;
      var f = hasF(dim, g.value);
      var anchor = sel && sel[dim] === g.value;
      return '<div class="prow' + (f ? ' filtered' : '') + (anchor ? ' anchored' : '') + (g.count ? '' : ' zero') + '"' +
        ' data-value="' + esc(g.value) + '" tabindex="0" role="button"' +
        ' aria-pressed="' + f + '"' +
        ' title="' + esc(g.value) + '：' + g.count + ' 条 · 平均半径 ' + g.avgRadius.toFixed(1) + ' R⊕ · 平均置信度 ' + g.avgConf.toFixed(2) + '">' +
        '<span class="mark">' + (anchor ? '◉' : f ? '✓' : '·') + '</span>' +
        '<span class="lbl">' + (f ? '<span style="color:var(--good)">✓ </span>' : '') + esc(g.value) + '</span>' +
        '<span class="bar"><i style="width:' + w + '%"></i></span>' +
        '<span class="num">' + fmtInt(g.count) + '</span>' +
        '<span class="mini">R⊕ ' + g.avgRadius.toFixed(1) + ' · 置信 ' + g.avgConf.toFixed(2) + '</span></div>';
    }

    if (canGroup && state.grouped) {
      var parentDim = meta.parent;
      var byParent = {};
      DOMAIN[parentDim].forEach(function (pv) { byParent[pv] = []; });
      groups.forEach(function (g) { byParent[PARENT_OF[dim][g.value]].push(g); });
      Object.keys(byParent).sort().forEach(function (pv) {
        var list = byParent[pv];
        var cnt = list.reduce(function (s, g) { return s + g.count; }, 0);
        var gf = hasF(parentDim, pv);
        html += '<div class="pgroup' + (gf ? ' gfiltered' : '') + '" data-parent="' + esc(pv) + '" tabindex="0" role="button"' +
          ' title="点击过滤父级：' + esc(DIM_BY[parentDim].label) + ' = ' + esc(pv) + '"><span>' + esc(pv) +
          (gf ? ' <span class="gfilter">✓ 已过滤</span>' : ' <span class="gfilter">⊕ 过滤此象限</span>') +
          '</span><span>' + fmtInt(cnt) + ' 条</span></div>';
        html += list.map(rowHtml).join('');
      });
    } else {
      html = groups.map(rowHtml).join('');
    }
    els.projRows.innerHTML = html;
  }

  function renderChips() {
    var n = filterCount();
    els.chipCount.textContent = n ? n + ' 个活跃' : '无';
    if (!n) { els.chips.innerHTML = '<div class="nochip">暂无过滤器 —— 点击投影行即可添加，此处显示每个过滤的来源。</div>'; return; }
    var html = '<div class="chiprow">';
    for (var dim in state.filters) {
      state.filters[dim].forEach(function (v) {
        html += '<span class="chip" title="归属：投影行点击 · 维度『' + esc(DIM_BY[dim].label) + '』">' +
          '<span class="src">⊕</span>' + esc(DIM_BY[dim].label) + ' = ' + esc(v) +
          '<button class="x" data-dim="' + esc(dim) + '" data-value="' + esc(v) + '" title="移除此过滤（可撤销）" aria-label="移除过滤 ' + esc(v) + '">✕</button></span>';
      });
    }
    els.chips.innerHTML = html + '</div>';
  }

  function byId(id) { for (var i = 0; i < D.records.length; i++) if (D.records[i].id === id) return D.records[i]; return null; }

  function renderRecords(recs) {
    els.recCount.textContent = fmtInt(recs.length) + ' 条' + (recs.length > RECORD_CAP ? ' · 显示前 ' + RECORD_CAP : '');
    if (!recs.length) {
      els.recScroll.innerHTML = '<div class="empty">范围内没有记录（empty 状态）。<br>' +
        '<span class="act" id="emptyClear">清除全部过滤器</span> 或修改查询。</div>';
      return;
    }
    var html = recs.slice(0, RECORD_CAP).map(function (r) {
      var sel = r.id === state.selection;
      return '<button class="rec' + (sel ? ' sel' : '') + '" data-id="' + r.id + '"' +
        (sel ? ' aria-current="true"' : '') + '>' +
        '<span class="r1"><span class="nm">' + esc(r.name) + '</span><span class="id">' + r.id + '</span>' +
        '<span class="cls">' + esc(r.planet_class) + '</span></span>' +
        '<span class="r2">' + esc(r.constellation) + ' · ' + esc(r.method) + ' · ' + r.year + ' · R⊕ ' + r.radius_r.toFixed(1) + ' · ' + esc(r.note) + '</span></button>';
    }).join('');
    els.recScroll.innerHTML = html;
  }

  function renderDetail() {
    if (!state.selection) {
      els.detail.innerHTML = '<div class="empty" style="padding:8px 0 10px">未选中记录 —— 在下方列表点击一条，它将作为<b style="color:var(--warn)">跨维度锚点</b>：切换透镜后仍保持选中，并显示它在当前投影下的落点。</div>';
      return;
    }
    var r = byId(state.selection);
    if (!r) { state.selection = null; return; }
    var dim = state.lens;
    var kv = '<dt>编号</dt><dd>' + r.id + '</dd>' +
      '<dt>名称</dt><dd>' + esc(r.name) + '</dd>' +
      '<dt>天体类别</dt><dd>' + esc(r.planet_class) + '</dd>' +
      '<dt>半径 / 质量</dt><dd>' + r.radius_r.toFixed(2) + ' R⊕ / ' + fmtInt(r.mass_m) + ' M⊕</dd>' +
      '<dt>平衡温度</dt><dd>' + r.temp_k + ' K</dd>' +
      '<dt>距离 / 周期</dt><dd>' + fmtInt(r.distance_ly) + ' 光年 / ' + r.period_d + ' 天</dd>' +
      '<dt>置信度</dt><dd>' + r.confidence.toFixed(2) + '</dd>' +
      '<dt>探测方法</dt><dd>' + esc(r.method) + '</dd>' +
      '<dt>设施 / 波段</dt><dd>' + esc(r.facility) + ' / ' + esc(r.band) + '</dd>' +
      '<dt>团队 / 年份</dt><dd>' + esc(r.team) + ' / ' + r.year + '</dd>' +
      '<dt>备注</dt><dd>' + esc(r.note) + '</dd>';
    var anchorNote = '<div class="anchor-note">◉ 跨维度锚点：在当前投影『' + esc(DIM_BY[dim].label) + '』下属于 <b>' +
      esc(r[dim]) + '</b>' + (PARENT_OF[dim] ? '（' + esc(PARENT_OF[dim][r[dim]]) + '）' : '') + '</div>';
    els.detail.innerHTML = '<div class="panel-head" style="padding:2px 0 6px">选中记录 · 锚点详情</div><dl class="kv">' + kv + '</dl>' + anchorNote;
  }

  function renderLedger() {
    els.ledCount.textContent = history.length + ' 条 · 当前 #' + (hIndex + 1);
    var start = Math.max(0, history.length - LEDGER_CAP);
    var rows = '';
    for (var i = history.length - 1; i >= start; i--) {
      var e = history[i];
      rows += '<button class="lrow' + (i === hIndex ? ' cur' : '') + '" data-i="' + i + '"' +
        ' title="状态归属：' + esc(e.desc) + ' — 点击回退到此状态">' +
        '<span class="t">' + hms(e.t) + '</span>' +
        '<span class="v" style="color:var(--accent)">' + (i === hIndex ? '●' : '◦') + '</span>' +
        '<span><b style="color:' + (i === hIndex ? 'var(--ink)' : 'var(--ink2)') + ';font-weight:600">' + VERBS[e.verb] + '</b> ' + esc(e.desc) + '</span>' +
        '<span class="o">' + esc(ORIGINS[e.origin] || e.origin) + '</span>' +
        '<span class="rb">回到此处 ⟲</span></button>';
    }
    var cap = start > 0 ? '<div class="ledger-cap">仅显示最近 ' + LEDGER_CAP + ' 条（共 ' + history.length + '）</div>' : '';
    els.ledger.innerHTML = rows + cap;
    els.ledScroll.scrollTop = els.ledScroll.scrollHeight;
  }

  /* ── 连续性条 ── */
  var lastSwitch = null;
  function renderContinuity() {
    if (!lastSwitch) {
      els.continuity.innerHTML = '<span class="tag">连续性就绪</span>' +
        '切换维度透镜时，<b>过滤器 · 查询 · 选中</b> 全部保留 —— 认知不重置；每次变更在本条下方台账中<b>有归属、可回退</b>。';
      return;
    }
    els.continuity.innerHTML = '<span class="tag">⇄ 维度已切换</span>' +
      '<b>' + esc(lastSwitch.from) + '</b> → <b>' + esc(lastSwitch.to) + '</b>' +
      '<span class="kept">✓ 保留 ' + lastSwitch.filters + ' 个过滤器</span>' +
      '<span class="kept">' + (lastSwitch.selection ? '✓ 选中记录已随行（见锚点落点）' : '· 无选中记录') + '</span>' +
      (lastSwitch.query ? '<span class="kept">✓ 查询「' + esc(lastSwitch.query) + '」保留</span>' : '') +
      '<span style="margin-left:auto;color:var(--ink3)">' + lastSwitch.t + '</span>';
  }

  /* ── tooltip ── */
  var tip = els.tip;
  function showTip(target, html) {
    tip.innerHTML = html; tip.style.display = 'block';
    var r = target.getBoundingClientRect();
    var x = Math.min(window.innerWidth - 270, r.right + 10);
    var y = Math.min(window.innerHeight - 90, r.top + 8);
    tip.style.left = x + 'px'; tip.style.top = y + 'px';
  }
  function hideTip() { tip.style.display = 'none'; }

  /* ── 事件 ── */
  els.dimrail.addEventListener('click', function (ev) {
    var b = ev.target.closest('.dimbtn'); if (!b) return;
    switchLens(b.dataset.dim, 'rail');
  });
  function switchLens(dim, origin) {
    if (dim === state.lens || !DIM_BY[dim]) return;
    var from = DIM_BY[state.lens].label;
    commit('LENS_SWITCH', origin, '透镜 ' + from + ' → ' + DIM_BY[dim].label + '（保留 ' + filterCount() + ' 过滤 / ' + (state.selection ? 1 : 0) + ' 选中 / ' + (state.query ? '查询' : '无查询') + '）',
      function () { state.lens = dim; });
    lastSwitch = {
      from: from, to: DIM_BY[dim].label, filters: filterCount(),
      selection: !!state.selection, query: state.query.trim(), t: hms(Date.now())
    };
    els.projScroll.scrollTop = 0;
    renderContinuity();
  }

  els.projRows.addEventListener('click', function (ev) {
    var pg = ev.target.closest('.pgroup');
    if (pg) {
      var parentDim = DIM_BY[state.lens].parent;
      if (parentDim) toggleFilter(parentDim, pg.dataset.parent);
      return;
    }
    var row = ev.target.closest('.prow');
    if (row) toggleFilter(state.lens, row.dataset.value);
  });
  els.projRows.addEventListener('keydown', function (ev) {
    if (ev.key !== 'Enter' && ev.key !== ' ') return;
    var row = ev.target.closest('.prow,.pgroup'); if (!row) return;
    ev.preventDefault(); row.click();
  });
  els.projRows.addEventListener('mousemove', function (ev) {
    var row = ev.target.closest('.prow'); if (!row) { hideTip(); return; }
    var dim = state.lens;
    var groups = project(dim, filteredRecords());
    var total = filteredRecords().length;
    var g = null;
    for (var i = 0; i < groups.length; i++) if (groups[i].value === row.dataset.value) { g = groups[i]; break; }
    if (!g) { hideTip(); return; }
    var sel = state.selection ? byId(state.selection) : null;
    showTip(row, '<div class="tt">' + esc(DIM_BY[dim].label) + ' = <b>' + esc(g.value) + '</b></div>' +
      '范围内 <b>' + fmtInt(g.count) + '</b> 条 · 占比 ' + (total ? (g.count / total * 100).toFixed(1) : '0.0') + '%' +
      '<br>平均半径 <b>' + g.avgRadius.toFixed(2) + '</b> R⊕ · 平均置信度 <b>' + g.avgConf.toFixed(2) + '</b>' +
      (sel && sel[dim] === g.value ? '<br><span style="color:var(--warn)">◉ 选中记录落在此分组</span>' : ''));
  });
  els.projRows.addEventListener('mouseleave', hideTip);

  els.chips.addEventListener('click', function (ev) {
    var x = ev.target.closest('.x'); if (!x) return;
    removeFilter(x.dataset.dim, x.dataset.value);
  });

  els.sortSeg.addEventListener('click', function (ev) {
    var b = ev.target.closest('button'); if (!b || b.dataset.sort === state.sort) return;
    commit('SORT', 'sortseg', '投影排序 → ' + (b.dataset.sort === 'count' ? '按计数' : '按名称'),
      function () { state.sort = b.dataset.sort; });
  });
  els.groupSeg.addEventListener('click', function (ev) {
    var b = ev.target.closest('button'); if (!b) return;
    var g = b.dataset.group === '1';
    if (g === state.grouped) return;
    commit('GROUP', 'groupseg', '层级分组 → ' + (g ? '开' : '关'), function () { state.grouped = g; });
  });

  els.recScroll.addEventListener('click', function (ev) {
    var empty = ev.target.closest('#emptyClear');
    if (empty) { clearFilters('reclist'); return; }
    var b = ev.target.closest('.rec'); if (!b) return;
    var id = b.dataset.id;
    if (state.selection === id) {
      commit('DESELECT', 'reclist', '取消选中 ' + id, function () { state.selection = null; });
    } else {
      commit('SELECT', 'reclist', '选中 ' + id + '（跨维度锚点）', function () { state.selection = id; });
    }
  });

  function clearFilters(origin) {
    if (!filterCount()) return;
    commit('FILTERS_CLEAR', origin, '清除全部 ' + filterCount() + ' 个过滤器', function () { state.filters = {}; });
  }
  els.clearBtn.addEventListener('click', function () { clearFilters('clear'); });

  els.ledger.addEventListener('click', function (ev) {
    var row = ev.target.closest('.lrow'); if (!row) return;
    var i = +row.dataset.i;
    if (i === hIndex) return;
    var verb = i < hIndex ? 'ROLLBACK' : 'ROLLBACK';
    movePointer(i, verb);
  });

  els.undoBtn.addEventListener('click', undo);
  els.redoBtn.addEventListener('click', redo);

  var debounceT = null;
  els.search.addEventListener('input', function () {
    clearTimeout(debounceT);
    debounceT = setTimeout(function () {
      var q = els.search.value;
      if (q === state.query) return;
      commit('SEARCH', 'search', q ? '查询「' + q + '」' : '清空查询', function () { state.query = q; });
    }, 160);
  });

  document.addEventListener('keydown', function (ev) {
    var typing = ev.target && (ev.target.tagName === 'INPUT' || ev.target.tagName === 'TEXTAREA');
    if (ev.key === '/' && !typing) { ev.preventDefault(); els.search.focus(); return; }
    if ((ev.ctrlKey || ev.metaKey) && !ev.shiftKey && ev.key.toLowerCase() === 'z') { ev.preventDefault(); undo(); return; }
    if (((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'y') ||
        ((ev.ctrlKey || ev.metaKey) && ev.shiftKey && ev.key.toLowerCase() === 'z')) { ev.preventDefault(); redo(); return; }
    if (!typing && (ev.key === 'ArrowDown' || ev.key === 'ArrowUp')) {
      var i = DIM_IDS.indexOf(state.lens);
      var j = ev.key === 'ArrowDown' ? Math.min(DIM_IDS.length - 1, i + 1) : Math.max(0, i - 1);
      if (j !== i) { ev.preventDefault(); switchLens(DIM_IDS[j], 'keys'); }
    }
  });

  /* ── 首屏即用：数据内联同步就绪，直接渲染 ── */
  render();

  /* 只读调试钩子（供自动化验收观察内部状态；不影响应用行为） */
  window.__PRISM_DBG = {
    state: function () { return clone(state); },
    hIndex: function () { return hIndex; },
    historyLen: function () { return history.length; }
  };
})();
