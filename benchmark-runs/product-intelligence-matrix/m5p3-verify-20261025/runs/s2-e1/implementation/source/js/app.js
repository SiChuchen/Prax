/*
 * 棱镜 Lens — 多维数据探索台（cell-j13-s10 · explore × dimensional-space）
 *
 * 架构要点：
 *  - 单一视图状态所有者 view（投影/着色/过滤），全部变更经 commit() 入快照历史
 *    → 过滤/投影状态有归属（芯片标注来源维度与值）且可回退（撤销/重做/回全集）。
 *  - 定向不变量（维度切换不重置认知）：
 *      1) 区域恒定   —— 切换维度只重投影，区域位置与坐标框架（全域轴）不动；
 *      2) 选择保持   —— selectionId 跨任何视图变更存活；
 *      3) 顺序稳定   —— 台账按稳定 id 排序，过滤只淡出不重排；分类条目序按全集频数缓存；
 *      4) 颜色语义   —— 每个分类维度的取值色板注册一次，会话内恒定。
 *  - 无障碍 AA、零外部依赖、首帧同步渲染（数据内联，无加载态）。
 */
(function () {
  'use strict';

  /* ================= 维度定义 ================= */
  var DIMS = [
    { id: 'category',     name: '分类',         type: 'categorical', group: '分类维度' },
    { id: 'language',     name: '语言',         type: 'categorical', group: '分类维度' },
    { id: 'license',      name: '许可证',       type: 'categorical', group: '分类维度' },
    { id: 'stage',        name: '生命周期',     type: 'categorical', group: '分类维度' },
    { id: 'stars',        name: 'Stars',        type: 'numeric',     group: '数值维度', unit: 'k', fmt: fmtStars },
    { id: 'contributors', name: '贡献者',       type: 'numeric',     group: '数值维度', fmt: function (v) { return String(Math.round(v)); } },
    { id: 'prwk',         name: '周 PR',        type: 'numeric',     group: '数值维度', fmt: function (v) { return String(Math.round(v)); } },
    { id: 'closeRate',    name: '关闭率',       type: 'numeric',     group: '数值维度', unit: '%', fmt: function (v) { return Math.round(v) + '%'; } },
    { id: 'deps',         name: '依赖数',       type: 'numeric',     group: '数值维度', fmt: function (v) { return String(Math.round(v)); } },
    { id: 'year',         name: '创建年份',     type: 'temporal',    group: '时间维度', fmt: function (v) { return String(Math.round(v)); } }
  ];
  var DIM_BY_ID = {};
  DIMS.forEach(function (d) { DIM_BY_ID[d.id] = d; });

  function fmtStars(v) {
    return (v >= 100 ? String(Math.round(v)) : v.toFixed(1)) + 'k';
  }

  /* ================= 数据与一次性注册表 ================= */
  var DS = window.OSS_RADAR;
  var RECORDS = DS.records;
  var N = RECORDS.length;

  // 分类维度的取值序（按全集频数 desc、名称 asc —— 会话内恒定）
  var CAT_VALUES = {};   // dimId -> [value,...]
  var VALUE_COLOR = {};  // dimId -> {value -> color}
  var PALETTE = ['#2f6fed', '#e8590c', '#0ca678', '#d6336c', '#7048e8',
                 '#f59f00', '#1098ad', '#5c940d', '#c92a2a', '#3b5bdb'];
  DIMS.forEach(function (d) {
    if (d.type !== 'categorical') return;
    var counts = {};
    RECORDS.forEach(function (r) { counts[r[d.id]] = (counts[r[d.id]] || 0) + 1; });
    var values = Object.keys(counts).sort(function (a, b) {
      return counts[b] - counts[a] || (a < b ? -1 : a > b ? 1 : 0);
    });
    CAT_VALUES[d.id] = values;
    var map = {};
    values.forEach(function (v, i) { map[v] = PALETTE[i % PALETTE.length]; });
    VALUE_COLOR[d.id] = map;
  });

  // 数值/时间维度全域值域（缓存 —— 过滤不改变轴，保证坐标框架恒定）
  var NUM_AXIS = {};
  DIMS.forEach(function (d) {
    if (d.type === 'categorical') return;
    var lo = Infinity, hi = -Infinity;
    RECORDS.forEach(function (r) {
      if (r[d.id] < lo) lo = r[d.id];
      if (r[d.id] > hi) hi = r[d.id];
    });
    NUM_AXIS[d.id] = { min: lo, max: hi };
  });

  var NUM_BINS = 26;

  /* ================= 视图状态（唯一所有者）与快照历史 ================= */
  var INITIAL_VIEW = { projection: 'category', color: 'stage', filters: [] };
  var view = cloneView(INITIAL_VIEW);   // {projection, color, filters:[{id,dim,kind,values|min,max}]}
  var selectionId = null;               // 认知锚点：跨视图变更存活，不入历史
  var matchOnly = false;                // 台账局部 UI 态
  var filterSeq = 0;

  var history = { snaps: [{ view: cloneView(INITIAL_VIEW), desc: '初始视图' }], idx: 0 };

  function cloneView(v) { return JSON.parse(JSON.stringify(v)); }

  // 所有投影/着色/过滤变更都经此入历史（可撤销/重做/回全集）
  function commit(desc) {
    history.snaps.length = history.idx + 1;
    history.snaps.push({ view: cloneView(view), desc: desc });
    if (history.snaps.length > 80) history.snaps.shift();
    history.idx = history.snaps.length - 1;
  }
  function undo() {
    if (history.idx === 0) return;
    history.idx--;
    view = cloneView(history.snaps[history.idx].view);
    render();
  }
  function redo() {
    if (history.idx >= history.snaps.length - 1) return;
    history.idx++;
    view = cloneView(history.snaps[history.idx].view);
    render();
  }
  function resetAll() {
    if (history.idx === 0) return;
    history.idx = 0;
    view = cloneView(history.snaps[0].view);
    render();
  }
  function canUndo() { return history.idx > 0; }
  function canRedo() { return history.idx < history.snaps.length - 1; }

  /* ================= 派生：匹配集 ================= */
  function passes(r, f) {
    if (f.kind === 'cat') return f.values.indexOf(r[f.dim]) !== -1;
    return r[f.dim] >= f.min && r[f.dim] <= f.max;
  }
  function isMatch(r) {
    for (var i = 0; i < view.filters.length; i++) if (!passes(r, view.filters[i])) return false;
    return true;
  }
  var MATCHED_CACHE = null;
  function matched() {
    if (!MATCHED_CACHE) {
      MATCHED_CACHE = [];
      for (var i = 0; i < N; i++) if (isMatch(RECORDS[i])) MATCHED_CACHE.push(RECORDS[i]);
    }
    return MATCHED_CACHE;
  }
  function invalidateMatched() { MATCHED_CACHE = null; }

  /* ================= 过滤/投影变更（每步一提交，皆可撤销） ================= */
  function toggleCatFilter(dim, value) {
    var d = DIM_BY_ID[dim];
    var f = filterFor(dim);
    var adding = !f || f.values.indexOf(value) === -1;
    if (!f) {
      f = { id: 'f' + (++filterSeq), dim: dim, kind: 'cat', values: [] };
      view.filters.push(f);
    }
    var ix = f.values.indexOf(value);
    if (ix === -1) f.values.push(value); else f.values.splice(ix, 1);
    if (f.values.length === 0) view.filters.splice(view.filters.indexOf(f), 1);
    invalidateMatched();
    commit('过滤 ' + d.name + (adding ? ' + ' : ' − ') + value);
    render();
  }
  function setNumFilter(dim, min, max) {
    var d = DIM_BY_ID[dim];
    var f = filterFor(dim);
    if (!f) { f = { id: 'f' + (++filterSeq), dim: dim, kind: 'num' }; view.filters.push(f); }
    f.kind = 'num';
    f.min = min;
    f.max = max;
    delete f.values;
    invalidateMatched();
    commit('过滤 ' + d.name + ' ∈ ' + rangeLabel(dim, min, max));
    render();
  }
  function removeFilter(fid) {
    for (var i = 0; i < view.filters.length; i++) {
      if (view.filters[i].id === fid) {
        var f = view.filters[i];
        view.filters.splice(i, 1);
        invalidateMatched();
        commit('移除过滤 ' + DIM_BY_ID[f.dim].name);
        break;
      }
    }
    render();
  }
  function rangeLabel(dim, min, max) {
    var d = DIM_BY_ID[dim];
    var a = NUM_AXIS[dim];
    var lo = d.fmt(min), hi = d.fmt(max);
    if (min <= a.min && max >= a.max) return '全域';
    if (min <= a.min) return '≤ ' + hi;
    if (max >= a.max) return '≥ ' + lo;
    return lo + ' – ' + hi;
  }
  function filterFor(dim) {
    for (var i = 0; i < view.filters.length; i++) if (view.filters[i].dim === dim) return view.filters[i];
    return null;
  }
  function setProjection(dim) {
    if (view.projection === dim) return;
    view.projection = dim;
    commit('投影 → ' + DIM_BY_ID[dim].name);
    render();
  }
  function setColor(dim) {
    if (view.color === dim) return;
    view.color = dim;
    commit('着色 → ' + DIM_BY_ID[dim].name);
    render();
  }

  /* ================= 颜色 ================= */
  function colorOf(v) {
    var d = DIM_BY_ID[view.color];
    if (d.type === 'categorical') return VALUE_COLOR[view.color][v] || '#98a2b3';
    var a = NUM_AXIS[view.color];
    var t = (v - a.min) / (a.max - a.min || 1);
    return lerpColor([223, 232, 252], [30, 64, 175], t); // 蓝色渐变 ramp
  }
  function lerpColor(c1, c2, t) {
    var r = Math.round(c1[0] + (c2[0] - c1[0]) * t);
    var g = Math.round(c1[1] + (c2[1] - c1[1]) * t);
    var b = Math.round(c1[2] + (c2[2] - c1[2]) * t);
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  /* ================= 渲染调度（rAF 合帧） ================= */
  var renderQueued = false;

  // 焦点保持：全量重建 DOM 后把焦点还给等价控件（键盘可操作性）
  function focusKey(el) {
    if (!el || !el.getAttribute) return null;
    var id = el.id;
    if (id) return '#' + id;
    var act = el.getAttribute('data-act');
    if (!act) return null;
    var dim = el.getAttribute('data-dim');
    var val = el.getAttribute('data-val');
    if (dim) return '[data-act="' + act + '"][data-dim="' + dim + '"]';
    if (val) return '[data-act="' + act + '"][data-val="' + val + '"]';
    return null;
  }

  function render() {
    if (renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(function () {
      renderQueued = false;
      invalidateMatched(); // 每帧以当前视图重算匹配集：undo/redo/reset 恢复快照同样生效
      var fk = focusKey(document.activeElement);
      renderHeader();
      renderRail();
      renderChart();
      renderLegend();
      renderLedger();
      renderInspector();
      renderStateBar();
      if (fk) {
        var el = document.querySelector(fk);
        if (el && document.activeElement !== el && !el.disabled) el.focus({ preventScroll: true });
      }
    });
  }

  function $(sel) { return document.querySelector(sel); }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ---------- 头部 ---------- */
  function renderHeader() {
    var m = matched().length;
    $('#hdr-counts').innerHTML =
      (m === N ? '<b>' + N + '</b>&nbsp;条记录（全集）'
               : '匹配 <b>' + m + '</b> / ' + N + (m === 0 ? '&nbsp;<span class="warn">空结果</span>' : ''))
      + '<span class="hdr-sep">·</span>10 维度';
  }

  /* ---------- 维度面板 ---------- */
  var openEditorDim = null;

  function renderRail() {
    var groups = {};
    DIMS.forEach(function (d) { (groups[d.group] = groups[d.group] || []).push(d); });
    var html = '';
    Object.keys(groups).forEach(function (g) {
      html += '<div class="rail-group-title">' + esc(g) + '</div>';
      groups[g].forEach(function (d) {
        var hasFilter = !!filterFor(d.id);
        var meta = d.type === 'categorical'
          ? CAT_VALUES[d.id].length + ' 值'
          : d.fmt(NUM_AXIS[d.id].min) + ' – ' + d.fmt(NUM_AXIS[d.id].max);
        html += '<div class="dim-item' + (openEditorDim === d.id ? ' open' : '') + (hasFilter ? ' has-filter' : '') + '">'
          + '<div class="dim-row">'
          + '<button class="dim-name" data-act="expand" data-dim="' + d.id + '" title="展开 / 收起过滤编辑器">'
          + '<span class="dot" aria-hidden="true"></span>' + esc(d.name)
          + '<span class="dim-meta">' + meta + '</span></button>'
          + '<span class="dim-actions">'
          + '<button class="tbtn" data-act="proj" data-dim="' + d.id + '" aria-pressed="' + (view.projection === d.id) + '" title="设为投影轴">投影</button>'
          + '<button class="tbtn" data-act="color" data-dim="' + d.id + '" aria-pressed="' + (view.color === d.id) + '" title="设为着色维度">着色</button>'
          + '</span></div>';
        if (openEditorDim === d.id) html += renderEditor(d);
        html += '</div>';
      });
    });
    $('#rail-groups').innerHTML = html;
    $('#dim-badge').textContent = DIMS.length + ' 个 · 投影=' + DIM_BY_ID[view.projection].name;
  }

  function renderEditor(d) {
    var f = filterFor(d.id);
    var m = matched();
    if (d.type === 'categorical') {
      var html = '<div class="dim-editor"><div class="editor-note">勾选 = 只保留所选值（与图例 / 条形点击联动）</div>';
      CAT_VALUES[d.id].forEach(function (v) {
        var c = 0;
        for (var i = 0; i < m.length; i++) if (m[i][d.id] === v) c++;
        var on = f && f.values.indexOf(v) !== -1;
        html += '<label class="check-row"><input type="checkbox" data-act="catval" data-dim="' + d.id + '" data-val="' + esc(v) + '"' + (on ? ' checked' : '') + '>'
          + '<span class="swatch" style="background:' + VALUE_COLOR[d.id][v] + '"></span>' + esc(v)
          + '<span class="cnt">' + c + '</span></label>';
      });
      html += '<div class="editor-actions"><button class="mini-btn" data-act="clearfilter" data-dim="' + d.id + '">清除此维过滤</button></div></div>';
      return html;
    }
    var a = NUM_AXIS[d.id];
    var lo = f && f.kind === 'num' ? f.min : a.min;
    var hi = f && f.kind === 'num' ? f.max : a.max;
    var step = d.id === 'year' ? 1 : 'any';
    return '<div class="dim-editor"><div class="editor-note">区间过滤（含端点）；也可直接点击直方图箱体</div>'
      + '<div class="range-row">'
      + '<input type="number" data-role="rmin" data-dim="' + d.id + '" value="' + lo + '" step="' + step + '" aria-label="最小值">'
      + '<span style="color:var(--faint)">–</span>'
      + '<input type="number" data-role="rmax" data-dim="' + d.id + '" value="' + hi + '" step="' + step + '" aria-label="最大值">'
      + '</div>'
      + '<div class="editor-actions">'
      + '<button class="mini-btn primary" data-act="applyrange" data-dim="' + d.id + '">应用区间</button>'
      + '<button class="mini-btn" data-act="clearfilter" data-dim="' + d.id + '">清除</button>'
      + '</div></div>';
  }

  /* ---------- 图表 ---------- */
  // 分类条目序：按全集频数缓存（过滤时条目位置不动 —— 定向不变量）
  var BAR_ORDER = {};

  function renderChart() {
    var d = DIM_BY_ID[view.projection];
    var m = matched();
    $('#chart-title').innerHTML = '分布投影 · <b>' + esc(d.name) + '</b>';
    $('#chart-sub').textContent = d.type === 'categorical'
      ? '条长 = 匹配记录数 · 点击整行切换该值过滤 · ◆ = 选中记录'
      : '箱高 = 匹配记录数 · 点击箱体按区间过滤 · 下方条带逐条显示匹配记录';

    var body = $('#chart-body');
    if (m.length === 0) {
      body.innerHTML = '';
      $('#empty-panel').hidden = false;
      return;
    }
    $('#empty-panel').hidden = true;

    var w = Math.max(360, body.clientWidth - 22);   // 扣除 10+10 水平 padding，SVG 恰好填满内容盒
    var h = Math.max(180, body.clientHeight - 12);  // 扣除 2+8 垂直 padding + 边框余量
    body.innerHTML = d.type === 'categorical' ? catChart(d, m, w, h) : numChart(d, m, w, h);
  }

  function makeBins(dim) {
    var a = NUM_AXIS[dim];
    var span = a.max - a.min || 1;
    var bw = span / NUM_BINS;
    var bins = [];
    for (var i = 0; i < NUM_BINS; i++) {
      bins.push({ lo: a.min + i * bw, hi: a.min + (i + 1) * bw, last: i === NUM_BINS - 1 });
    }
    return bins;
  }
  function inBin(v, b) { return v >= b.lo && (v < b.hi || (b.last && v <= b.hi)); }
  function binTitle(d, b) { return d.fmt(b.lo) + ' – ' + d.fmt(b.hi) + (d.unit || ''); }

  function catChart(d, m, w, h) {
    var values = BAR_ORDER[d.id] || (BAR_ORDER[d.id] = CAT_VALUES[d.id].slice());
    var counts = {};
    values.forEach(function (v) { counts[v] = 0; });
    m.forEach(function (r) { if (counts[r[d.id]] !== undefined) counts[r[d.id]]++; });
    var maxC = Math.max(1, Math.max.apply(null, values.map(function (v) { return counts[v]; })));

    var padL = 92, padR = 64, padT = 8;
    var rowH = Math.min(34, (h - padT - 24) / values.length);
    var barH = Math.max(10, rowH - 9);
    var plotW = w - padL - padR;
    var sel = selectedRecord();
    var colorNumeric = DIM_BY_ID[view.color].type !== 'categorical';
    var f = filterFor(d.id);

    var s = '<svg width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '">';
    s += '<line x1="' + padL + '" y1="' + (padT - 2) + '" x2="' + padL + '" y2="' + (padT + rowH * values.length + 4) + '" stroke="#c3ccd6"/>';

    values.forEach(function (v, i) {
      var y = padT + i * rowH;
      var c = counts[v];
      var bw = c / maxC * plotW;

      if (c > 0) {
        // 堆叠分段（按着色维度取值）
        var parts = {};
        if (!colorNumeric) CAT_VALUES[view.color].forEach(function (cv) { parts[cv] = 0; });
        for (var k = 0; k < m.length; k++) {
          var r = m[k];
          if (r[d.id] !== v) continue;
          var key = colorNumeric ? '__num__' : r[view.color];
          parts[key] = (parts[key] || 0) + 1;
        }
        var acc = 0;
        Object.keys(parts).forEach(function (key) {
          var pn = parts[key];
          if (!pn) return;
          var sw = pn / maxC * plotW;
          s += '<rect x="' + (padL + acc) + '" y="' + y + '" width="' + Math.max(sw - 0.5, 0.5) + '" height="' + barH + '" rx="2" fill="' + colorOf(key === '__num__' ? midOf(d) : key) + '"/>';
          acc += sw;
        });
      } else {
        s += '<rect x="' + padL + '" y="' + y + '" width="2" height="' + barH + '" rx="1" fill="#dde3ea"/>';
      }

      var isOn = f && f.kind === 'cat' && f.values.indexOf(v) !== -1;
      s += '<text x="' + (padL - 8) + '" y="' + (y + barH / 2 + 4) + '" text-anchor="end" font-size="12" fill="' + (isOn ? '#1d4ed8' : '#3a4454') + '" font-weight="' + (isOn ? '650' : '400') + '">' + esc(v) + (isOn ? ' ⏷' : '') + '</text>';
      s += '<text x="' + (padL + bw + 6) + '" y="' + (y + barH / 2 + 4) + '" font-size="11" fill="#66707d">' + c + '</text>';
      // 整行命中区（点击切换该值过滤）
      s += '<rect x="4" y="' + (y - 2) + '" width="' + (w - 8) + '" height="' + rowH + '" fill="transparent" class="hit" data-act="bar" data-val="' + esc(v) + '" data-tip="' + esc(v) + '：' + c + ' 条匹配 · 点击切换过滤"/>';
      // 选中锚点 ◆
      if (sel && sel[d.id] === v) {
        var mx = padL + bw + 20;
        s += '<path d="M ' + mx + ' ' + (y + barH / 2 - 5) + ' l 5 5 l -5 5 l -5 -5 Z" fill="#101828" data-tip="选中：' + esc(sel.name) + '"/>';
      }
    });

    var footY = padT + rowH * values.length + 18;
    s += '<text x="' + padL + '" y="' + footY + '" font-size="10.5" fill="#66707d">0</text>';
    s += '<text x="' + (padL + plotW) + '" y="' + footY + '" text-anchor="end" font-size="10.5" fill="#66707d">' + maxC + ' 条</text>';
    s += '</svg>';
    return s;
  }
  function midOf(d) {
    var a = NUM_AXIS[d.id];
    return (a.min + a.max) / 2;
  }

  function numChart(d, m, w, h) {
    var bins = makeBins(d.id);
    var counts = new Array(NUM_BINS);
    for (var i0 = 0; i0 < NUM_BINS; i0++) counts[i0] = 0;
    m.forEach(function (r) {
      var v = r[d.id];
      for (var i = 0; i < NUM_BINS; i++) if (inBin(v, bins[i])) { counts[i]++; break; }
    });
    var maxC = Math.max(1, Math.max.apply(null, counts));

    var padL = 46, padR = 16, padT = 10;
    var histH = Math.max(60, Math.min(h - 62, 168));
    var stripY = padT + histH + 26;
    var plotW = w - padL - padR;
    var a = NUM_AXIS[d.id];
    var binW = plotW / NUM_BINS;
    var sel = selectedRecord();
    var colorNumeric = DIM_BY_ID[view.color].type !== 'categorical';

    function x(v) { return padL + (v - a.min) / (a.max - a.min || 1) * plotW; }

    var s = '<svg width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '">';

    // 网格与刻度（全域坐标 —— 不随过滤变化）
    [0, 0.25, 0.5, 0.75, 1].forEach(function (t) {
      var gx = padL + t * plotW;
      var gv = a.min + t * (a.max - a.min);
      s += '<line x1="' + gx + '" y1="' + padT + '" x2="' + gx + '" y2="' + (padT + histH) + '" stroke="#eef1f5"/>';
      s += '<text x="' + gx + '" y="' + (padT + histH + 14) + '" font-size="10" fill="#66707d" text-anchor="' + (t === 0 ? 'start' : t === 1 ? 'end' : 'middle') + '">' + esc(d.fmt(gv)) + '</text>';
    });

    // 堆叠箱体（按着色维度）
    for (var i = 0; i < NUM_BINS; i++) {
      var c = counts[i];
      if (!c) continue;
      var bx = padL + i * binW;
      var parts = {};
      if (!colorNumeric) CAT_VALUES[view.color].forEach(function (cv) { parts[cv] = 0; });
      for (var k = 0; k < m.length; k++) {
        var r = m[k];
        if (!inBin(r[d.id], bins[i])) continue;
        var key = colorNumeric ? '__num__' : r[view.color];
        parts[key] = (parts[key] || 0) + 1;
      }
      var acc = 0, bh;
      Object.keys(parts).forEach(function (key) {
        var pn = parts[key];
        if (!pn) return;
        bh = pn / maxC * histH;
        s += '<rect x="' + (bx + 0.5) + '" y="' + (padT + histH - acc - bh) + '" width="' + Math.max(binW - 1.2, 1) + '" height="' + bh + '" fill="' + colorOf(key === '__num__' ? (bins[i].lo + bins[i].hi) / 2 : key) + '" class="hit" data-act="bin" data-bin="' + i + '" data-tip="' + esc(binTitle(d, bins[i])) + ' · ' + (key === '__num__' ? '' : esc(key) + '：') + pn + ' 条"/>';
        acc += bh;
      });
    }
    s += '<line x1="' + padL + '" y1="' + (padT + histH) + '" x2="' + (padL + plotW) + '" y2="' + (padT + histH) + '" stroke="#c3ccd6"/>';

    // 条带：逐条匹配记录（高密度个体层）
    for (var k2 = 0; k2 < m.length; k2++) {
      var r2 = m[k2];
      var tx = x(r2[d.id]);
      s += '<line x1="' + tx + '" y1="' + stripY + '" x2="' + tx + '" y2="' + (stripY + 10) + '" stroke="' + colorOf(r2[view.color]) + '" stroke-width="1" opacity="0.75" data-tip="' + esc(r2.name) + ' · ' + esc(d.fmt(r2[d.id])) + '"/>';
    }
    s += '<line x1="' + padL + '" y1="' + (stripY + 12) + '" x2="' + (padL + plotW) + '" y2="' + (stripY + 12) + '" stroke="#dde3ea"/>';

    // 选中锚点（跨投影保持）
    if (sel) {
      var sx = x(sel[d.id]);
      s += '<line x1="' + sx + '" y1="' + padT + '" x2="' + sx + '" y2="' + (stripY + 12) + '" stroke="#101828" stroke-dasharray="3 3" stroke-width="1.2" data-tip="选中：' + esc(sel.name) + ' · ' + esc(d.fmt(sel[d.id])) + '"/>';
      s += '<path d="M ' + sx + ' ' + (stripY + 12) + ' l 4.5 6 l -9 0 Z" fill="#101828" data-tip="选中：' + esc(sel.name) + '"/>';
    }

    // 现有区间过滤的标注
    var f = filterFor(d.id);
    if (f && f.kind === 'num') {
      var fx1 = x(f.min), fx2 = x(f.max);
      s += '<rect x="' + fx1 + '" y="' + padT + '" width="' + Math.max(fx2 - fx1, 2) + '" height="' + histH + '" fill="none" stroke="#1d4ed8" stroke-dasharray="4 3" rx="3" data-tip="当前区间过滤：' + esc(rangeLabel(d.id, f.min, f.max)) + '"/>';
    }
    s += '<text x="' + padL + '" y="' + (stripY + 26) + '" font-size="10" fill="#66707d">' + m.length + ' 条匹配 · 条带内 1 刻度 = 1 条记录</text>';
    s += '</svg>';
    return s;
  }

  /* ---------- 图例 ---------- */
  function renderLegend() {
    var d = DIM_BY_ID[view.color];
    var m = matched();
    var el = $('#legend');
    if (d.type === 'categorical') {
      var html = '<span style="font-size:11px;color:var(--faint)">着色 · ' + esc(d.name) + '</span>';
      CAT_VALUES[d.id].forEach(function (v) {
        var c = 0;
        for (var i = 0; i < m.length; i++) if (m[i][d.id] === v) c++;
        var f = filterFor(d.id);
        var off = f && f.kind === 'cat' && f.values.length > 0 && f.values.indexOf(v) === -1;
        html += '<button class="legend-item' + (off ? ' off' : '') + '" data-act="legend" data-val="' + esc(v) + '" title="点击切换过滤：' + esc(v) + '" aria-pressed="' + (f && f.values.indexOf(v) !== -1) + '">'
          + '<span class="sw" style="background:' + VALUE_COLOR[d.id][v] + '"></span>' + esc(v)
          + '<span class="n">' + c + '</span></button>';
      });
      el.innerHTML = html;
    } else {
      var a = NUM_AXIS[d.id];
      el.innerHTML = '<span class="legend-grad">着色 · ' + esc(d.name)
        + '<span class="bar" style="background:linear-gradient(90deg,' + colorOf(a.min) + ',' + colorOf(a.max) + ')"></span>'
        + esc(d.fmt(a.min)) + ' → ' + esc(d.fmt(a.max)) + '</span>';
    }
  }

  /* ---------- 台账（稳定顺序 · 锚点表） ---------- */
  var LEDGER_DIMS = ['category', 'language', 'stage', 'stars', 'contributors', 'prwk', 'closeRate', 'deps', 'year'];

  function renderLedger() {
    var thead = '<tr><th class="num" data-dim="id" style="cursor:default" title="稳定 id：台账顺序恒定，不随视图变更">id</th>'
      + '<th data-dim="name" title="点击仓库列不改变投影">仓库</th>';
    LEDGER_DIMS.forEach(function (dimId) {
      var d = DIM_BY_ID[dimId];
      thead += '<th data-dim="' + dimId + '" class="' + (d.type === 'categorical' ? '' : 'num')
        + (dimId === view.projection ? ' col-proj' : '') + (dimId === view.color ? ' col-color' : '')
        + '" title="点击设为投影轴">' + esc(d.name) + (dimId === view.projection ? ' ◂' : '') + '</th>';
    });
    $('#ledger-head').innerHTML = thead + '</tr>';

    var scroll = $('#ledger-scroll');
    var st = scroll.scrollTop;
    var rows = [];
    for (var i = 0; i < N; i++) {
      var r = RECORDS[i];
      var ok = isMatch(r);
      if (matchOnly && !ok) continue;
      var cls = (ok ? '' : ' dim') + (r.id === selectionId ? ' sel' : '');
      var tds = '<td class="num id dim-keep">' + r.id + '</td><td class="name dim-keep">' + esc(r.name) + '</td>';
      LEDGER_DIMS.forEach(function (dimId) {
        var d = DIM_BY_ID[dimId];
        var cls2 = (d.type === 'categorical' ? '' : 'num')
          + (dimId === view.projection ? ' col-proj' : '')
          + (dimId === view.color ? ' col-color' : '');
        var inner;
        if (dimId === view.color && d.type === 'categorical') {
          inner = '<span class="swatch" style="background:' + VALUE_COLOR[dimId][r[dimId]] + '"></span>' + esc(r[dimId]);
        } else if (d.type === 'categorical') {
          inner = esc(r[dimId]);
        } else {
          inner = esc(d.fmt(r[dimId]));
        }
        tds += '<td class="' + cls2 + '">' + inner + '</td>';
      });
      rows.push('<tr class="' + cls.trim() + '" data-id="' + r.id + '" title="点击选中（锚点跨维度切换保持）">' + tds + '</tr>');
    }
    $('#ledger-body').innerHTML = rows.join('');
    scroll.scrollTop = Math.min(st, Math.max(0, scroll.scrollHeight - scroll.clientHeight));
  }

  /* ---------- 检查器 ---------- */
  function selectedRecord() {
    if (!selectionId) return null;
    for (var i = 0; i < N; i++) if (RECORDS[i].id === selectionId) return RECORDS[i];
    return null;
  }

  function renderInspector() {
    var r = selectedRecord();
    var el = $('#insp-body');
    if (!r) {
      el.innerHTML = '<div class="insp-empty">尚未选中记录。<br>在台账中点击一行即可选中。<br><br>选择是跨维度切换的<b style="color:var(--muted)">认知锚点</b>：切换投影 / 着色 / 过滤后仍保持选中与定位标记。</div>';
      return;
    }
    var m = matched();
    var d = DIM_BY_ID[view.projection];
    var html = '<div class="insp-name">' + esc(r.name) + '<span class="badge stage-' + esc(r.stage) + '">' + esc(r.stage) + '</span></div>'
      + '<div class="insp-id" style="margin-top:2px">' + r.id + ' · ' + esc(r.category) + ' / ' + esc(r.language) + ' · ' + esc(r.license) + '</div>'
      + '<table class="insp-dl"><tbody>';
    DIMS.forEach(function (dim) {
      var hot = dim.id === view.projection;
      var extra = '';
      if (dim.type === 'categorical') {
        if (hot) {
          var share = 0;
          for (var i = 0; i < m.length; i++) if (m[i][dim.id] === r[dim.id]) share++;
          extra = '<span class="insp-pct">匹配中 ' + share + '/' + m.length + '</span>';
        }
        html += '<tr class="' + (hot ? 'hot' : '') + '"><th>' + esc(dim.name) + '</th><td class="v">' + esc(r[dim.id]) + extra + '</td></tr>';
      } else {
        var pct = '';
        if (hot) {
          var below = 0;
          for (var j = 0; j < m.length; j++) if (m[j][dim.id] <= r[dim.id]) below++;
          pct = '<span class="insp-pct">自低 ' + Math.round(below / (m.length || 1) * 100) + '%</span>';
        }
        html += '<tr class="' + (hot ? 'hot' : '') + '"><th>' + esc(dim.name) + (dim.unit ? ' (' + dim.unit + ')' : '') + '</th><td class="v">' + esc(dim.fmt(r[dim.id])) + pct + '</td></tr>';
      }
    });
    html += '</tbody></table>';
    html += '<div class="insp-tip">' + (isMatch(r) ? '✓ 该记录在当前过滤范围内。' : '⚠ 该记录被当前过滤排除（台账中淡出保留）。') + '切换维度后仍保持选中。</div>';
    el.innerHTML = html;
  }

  /* ---------- 状态条（归属芯片 + 操作轨迹） ---------- */
  function renderStateBar() {
    var html = '';
    html += '<span class="chip chip-proj" title="投影状态 · 来源维度：' + esc(DIM_BY_ID[view.projection].name) + '">投影 <b>' + esc(DIM_BY_ID[view.projection].name) + '</b><span class="owner">· 来源维度</span></span>';
    html += '<span class="chip chip-color" title="着色状态 · 来源维度：' + esc(DIM_BY_ID[view.color].name) + '">着色 <b>' + esc(DIM_BY_ID[view.color].name) + '</b><span class="owner">· 来源维度</span></span>';
    if (view.filters.length === 0) {
      html += '<span class="chip ghost">无过滤 · 全集 ' + N + ' 条</span>';
    } else {
      view.filters.forEach(function (f) {
        var d = DIM_BY_ID[f.dim];
        var label = f.kind === 'cat'
          ? (f.values.length <= 3 ? f.values.join(', ') : f.values.length + ' 个值')
          : rangeLabel(f.dim, f.min, f.max);
        html += '<span class="chip chip-filter" title="过滤状态 · 来源维度：' + esc(d.name) + '（移除后可撤销恢复）">'
          + '<b>' + esc(d.name) + '</b> ' + (f.kind === 'cat' ? '∈ ' : '') + esc(label)
          + '<button class="x" data-act="remove" data-fid="' + f.id + '" aria-label="移除过滤 ' + esc(d.name) + '" title="移除该条过滤（可撤销恢复）">×</button></span>';
      });
    }
    $('#chips').innerHTML = html;

    $('#btn-undo').disabled = !canUndo();
    $('#btn-redo').disabled = !canRedo();
    $('#btn-reset').disabled = !canUndo();

    var t = '';
    history.snaps.forEach(function (s, i) {
      var cls = i === history.idx ? ' cur' : (i > history.idx ? ' future' : '');
      t += '<button class="trail-step' + cls + '" data-idx="' + i + '" title="' + esc(s.desc) + '（点击跳转到此步）"' + (i === history.idx ? ' aria-current="step"' : '') + '>' + (i + 1) + '. ' + esc(s.desc) + '</button>';
    });
    var trail = $('#trail');
    trail.innerHTML = t;
    var cur = trail.querySelector('.trail-step.cur');
    if (cur && (cur.offsetLeft < trail.scrollLeft || cur.offsetLeft + cur.offsetWidth > trail.scrollLeft + trail.clientWidth)) {
      trail.scrollLeft = cur.offsetLeft - 8;
    }
  }

  /* ================= 交互 ================= */
  function wire() {
    // 维度面板（事件委托）
    $('#rail-groups').addEventListener('click', function (e) {
      var btn = e.target.closest('button');
      if (!btn) return;
      var act = btn.getAttribute('data-act');
      var dim = btn.getAttribute('data-dim');
      if (act === 'expand') {
        openEditorDim = openEditorDim === dim ? null : dim;
        renderRail();
      } else if (act === 'proj') setProjection(dim);
      else if (act === 'color') setColor(dim);
      else if (act === 'clearfilter') {
        var f = filterFor(dim);
        if (f) removeFilter(f.id);
      } else if (act === 'applyrange') {
        var item = btn.closest('.dim-editor');
        var lo = parseFloat(item.querySelector('[data-role="rmin"]').value);
        var hi = parseFloat(item.querySelector('[data-role="rmax"]').value);
        var a = NUM_AXIS[dim];
        if (isNaN(lo)) lo = a.min;
        if (isNaN(hi)) hi = a.max;
        if (lo > hi) { var tmp = lo; lo = hi; hi = tmp; }
        setNumFilter(dim, lo, hi);
      }
    });
    $('#rail-groups').addEventListener('change', function (e) {
      var cb = e.target.closest('input[data-act="catval"]');
      if (cb) toggleCatFilter(cb.getAttribute('data-dim'), cb.getAttribute('data-val'));
    });

    // 图表命中（条形行 / 直方图箱）
    $('#chart-body').addEventListener('click', function (e) {
      var hit = e.target.closest('.hit');
      if (!hit) return;
      var act = hit.getAttribute('data-act');
      if (act === 'bar') toggleCatFilter(view.projection, hit.getAttribute('data-val'));
      else if (act === 'bin') {
        var b = makeBins(view.projection)[+hit.getAttribute('data-bin')];
        setNumFilter(view.projection, b.lo, b.hi);
      }
    });

    // 图例（点击着色维度取值过滤）
    $('#legend').addEventListener('click', function (e) {
      var it = e.target.closest('.legend-item');
      if (it) toggleCatFilter(view.color, it.getAttribute('data-val'));
    });

    // 台账：点击选中（锚点）
    $('#ledger-body').addEventListener('click', function (e) {
      var tr = e.target.closest('tr[data-id]');
      if (!tr) return;
      selectionId = tr.getAttribute('data-id');
      renderLedger();
      renderInspector();
      renderChart();
    });
    // 表头点击 = 设为投影轴
    $('#ledger-head').addEventListener('click', function (e) {
      var th = e.target.closest('th[data-dim]');
      if (!th) return;
      if (DIM_BY_ID[th.getAttribute('data-dim')]) setProjection(th.getAttribute('data-dim'));
    });
    $('#match-only').addEventListener('change', function (e) {
      matchOnly = e.target.checked;
      renderLedger();
    });

    // 状态条与轨迹
    $('#chips').addEventListener('click', function (e) {
      var x = e.target.closest('button[data-act="remove"]');
      if (x) removeFilter(x.getAttribute('data-fid'));
    });
    $('#btn-undo').addEventListener('click', undo);
    $('#btn-redo').addEventListener('click', redo);
    $('#btn-reset').addEventListener('click', resetAll);
    $('#btn-empty-reset').addEventListener('click', resetAll);
    $('#trail').addEventListener('click', function (e) {
      var step = e.target.closest('.trail-step');
      if (!step) return;
      var idx = +step.getAttribute('data-idx');
      if (idx === history.idx) return;
      history.idx = idx;
      view = cloneView(history.snaps[idx].view);
      render();
    });

    // 键盘：撤销 / 重做 / 取消选择
    document.addEventListener('keydown', function (e) {
      var mod = e.ctrlKey || e.metaKey;
      var k = e.key.toLowerCase();
      if (mod && k === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); }
      else if (mod && k === 'y') { e.preventDefault(); redo(); }
      else if (!mod && e.key === 'Escape' && selectionId) {
        selectionId = null;
        renderLedger(); renderInspector(); renderChart();
      }
    });

    // 自定义浮层提示（SVG data-tip）
    var tip = $('#tooltip');
    document.addEventListener('mousemove', function (e) {
      var t = e.target && e.target.closest ? e.target.closest('[data-tip]') : null;
      if (t) {
        tip.textContent = t.getAttribute('data-tip');
        tip.hidden = false;
        tip.style.left = Math.min(e.clientX + 14, window.innerWidth - 340) + 'px';
        tip.style.top = (e.clientY + 16) + 'px';
      } else if (!tip.hidden) {
        tip.hidden = true;
      }
    }, true);

    var rs;
    window.addEventListener('resize', function () {
      clearTimeout(rs);
      rs = setTimeout(renderChart, 120);
    });
  }

  /* ================= 启动（同步、无加载态） ================= */
  function boot() {
    if (!DS || !DS.records || !DS.records.length) throw new Error('内联数据集缺失（window.OSS_RADAR）');
    document.getElementById('hdr-dataset').textContent = DS.name + ' · ' + DS.title;
    wire();
    render();
    document.getElementById('app').hidden = false;
  }

  try {
    boot();
  } catch (err) {
    console.error(err);
    document.getElementById('boot-error').hidden = false;
    document.getElementById('boot-error-msg').textContent = String((err && err.message) || err);
  }
})();
