/* 星巡台 ASTRA · cell-j13-s10 —— 多维数据探索（explore × dimensional-space）
 *
 * 设计契约（Prax 会话 ds_20261023205741_2a9a445c）：
 *  1. 维度切换不重置认知：换轴仅触碰 viewport（投影轴），query(过滤)/selection(聚焦)/
 *     度量/轨迹一律保留 —— projection_model 与 filter_model、focus_model 相互独立。
 *  2. 过滤/投影状态有归属且可回退：每次变更压入完整状态快照（归属 = 触发操作名 +
 *     来源 + 时间戳），轨迹条目即快照引用，点击回退；另配撤销/重做。
 *  3. 首屏即用：数据由 js/data.js 内联，同步初始化，无加载态、无网络请求。
 */
(function () {
  'use strict';

  var S = window.SURVEY;
  var DIM = {};
  S.dims.forEach(function (d) { DIM[d.id] = d; });
  var QUANT = S.dims.filter(function (d) { return d.type === 'quant'; });

  /* ---------------- 工具 ---------------- */
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function fmtV(dim, v) {
    var d = DIM[dim];
    if (d.type === 'cat') return String(v);
    var dec = (v >= 1000) ? 0 : d.dec;
    return Number(v).toFixed(dec);
  }
  function ts(d) {
    function p(n) { return (n < 10 ? '0' : '') + n; }
    return p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
  }
  function hsl2hex(h, s, l) {
    l /= 100; var a = s * Math.min(l, 1 - l) / 100;
    function f(n) {
      var k = (n + h / 30) % 12;
      var c = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
      return Math.round(255 * c).toString(16).padStart(2, '0');
    }
    return '#' + f(0) + f(8) + f(4);
  }
  /* 热力色标：单色相顺序色，7 级量化。带间留出明度台阶：
     级 0–2 深底配浅字、级 3–6 亮底配深字，两段文字对比度均 ≥ 4.5:1 */
  var HEAT = [
    { bg: '#151f2a', light: false },
    { bg: '#1d3444', light: false },
    { bg: '#2b505c', light: false },
    { bg: '#55a898', light: true },
    { bg: '#7fcfbc', light: true },
    { bg: '#a9e5d4', light: true },
    { bg: '#d4f2e8', light: true }
  ];

  /* ---------------- 状态模型 ---------------- */
  var BASE = {
    x: 'method',            // 投影 X 轴（viewport）
    y: 'temp',              // 投影 Y 轴（viewport）
    measure: { kind: 'count', dim: null }, // 度量（投影状态）
    filters: [],            // query：[{dim, kind:'cat', values:[]}|{dim, kind:'range', lo, hi}]
    focus: null             // selection：记录 id
  };
  var state;      // 当前已提交状态
  var trail = []; // [{seq, time, action, source, snap}] —— 快照栈：归属 + 回退
  var tIndex = 0; // 当前所处轨迹位置
  var ui = { openDim: null }; // 纯 UI 态（不进入快照）

  function snapshot() {
    return { x: state.x, y: state.y, measure: clone(state.measure), filters: clone(state.filters), focus: state.focus };
  }

  /* 每次过滤/投影变更统一走 commit：压入快照，归属 = action + source + time */
  function commit(action, source, mutate) {
    trail = trail.slice(0, tIndex + 1); // 丢弃重做分支
    mutate();
    trail.push({ seq: trail.length, time: new Date(), action: action, source: source, snap: snapshot() });
    tIndex = trail.length - 1;
    renderAll();
  }
  function timeTravel(i) {
    if (i < 0 || i >= trail.length || i === tIndex) return;
    tIndex = i;
    state = clone(trail[i].snap);
    renderAll();
  }
  function undo() { timeTravel(tIndex - 1); }
  function redo() { timeTravel(tIndex + 1); }

  function filterOf(dim) {
    for (var i = 0; i < state.filters.length; i++) if (state.filters[i].dim === dim) return state.filters[i];
    return null;
  }
  function matching() {
    return S.records.filter(function (r) {
      for (var i = 0; i < state.filters.length; i++) {
        var f = state.filters[i], v = r[f.dim];
        if (f.kind === 'cat') { if (f.values.indexOf(v) < 0) return false; }
        else { if (v < f.lo || v > f.hi) return false; }
      }
      return true;
    });
  }

  /* 数量维度：固定分箱（全域 8 箱）—— 过滤/换轴后参照系不变，认知不漂移 */
  var DOMAIN = {};
  QUANT.forEach(function (d) {
    var lo = Infinity, hi = -Infinity;
    S.records.forEach(function (r) { lo = Math.min(lo, r[d.id]); hi = Math.max(hi, r[d.id]); });
    DOMAIN[d.id] = { lo: lo, hi: hi, n: 8 };
  });
  function binOf(dim, v) {
    var d = DOMAIN[dim];
    return Math.min(d.n - 1, Math.max(0, Math.floor((v - d.lo) / (d.hi - d.lo) * d.n)));
  }
  function binLabel(dim, i) {
    var d = DOMAIN[dim], w = (d.hi - d.lo) / d.n;
    var a = d.lo + i * w, b = a + w;
    return fmtV(dim, a) + '–' + fmtV(dim, b);
  }
  function axisVals(dim) {
    if (DIM[dim].type === 'cat') return DIM[dim].values.slice();
    var out = [];
    for (var i = 0; i < DOMAIN[dim].n; i++) out.push({ bin: i });
    return out;
  }
  function axisIndexOf(dim, v) {
    return DIM[dim].type === 'cat' ? DIM[dim].values.indexOf(v) : binOf(dim, v);
  }

  /* ---------------- 交互动作 ---------------- */
  /* 换轴：只动 viewport —— 过滤、聚焦、度量、轨迹原样保留（成功标准的实现点） */
  function setAxis(axis, dim, source) {
    var target = axis === 'x' ? 'x' : 'y', other = axis === 'x' ? 'y' : 'x';
    var swapped = false;
    commit('换轴 ' + target.toUpperCase() + ' → ' + DIM[dim].label, source || '维度轨 · 点击', function () {
      if (state[other] === dim) { state[other] = state[target]; swapped = true; }
      state[target] = dim;
    });
    toast(swapped ? '已对调两轴 · 过滤 ' + state.filters.length + ' 项、聚焦与轨迹全部保留'
                  : '维度已切换 · 过滤 ' + state.filters.length + ' 项、聚焦与轨迹全部保留');
  }
  function setMeasure(kind, dim) {
    var label = kind === 'count' ? '计数' : '平均 · ' + DIM[dim].label;
    commit('度量 → ' + label, '投影画布 · 度量选择', function () {
      state.measure = kind === 'count' ? { kind: 'count', dim: null } : { kind: 'avg', dim: dim };
    });
  }
  function drillCell(yi, xj) {
    var xv = axisVals(state.x), yv = axisVals(state.y);
    var targets = [];
    [[state.x, xv[xj]], [state.y, yv[yi]]].forEach(function (p) {
      var dim = p[0], v = p[1], cur = filterOf(dim);
      if (DIM[dim].type === 'cat') {
        var same = cur && cur.values.length === 1 && cur.values[0] === v;
        if (!same) targets.push({ dim: dim, kind: 'cat', values: [v], label: v });
      } else {
        var d = DOMAIN[dim], w = (d.hi - d.lo) / d.n;
        var lo = d.lo + v.bin * w, hi = d.lo + (v.bin + 1) * w;
        var same2 = cur && cur.kind === 'range' && cur.lo === lo && cur.hi === hi;
        if (!same2) targets.push({ dim: dim, kind: 'range', lo: lo, hi: hi, label: binLabel(dim, v.bin) });
      }
    });
    if (!targets.length) { toast('该单元格已被当前过滤覆盖'); return; }
    var desc = targets.map(function (t) { return DIM[t.dim].label + '=' + t.label; }).join(' 且 ');
    commit('下钻 [' + desc + ']', '投影画布 · 单元格点击', function () {
      targets.forEach(function (t) {
        var k = state.filters.findIndex(function (f) { return f.dim === t.dim; });
        if (k >= 0) { delete t.label; state.filters[k] = t; } else { delete t.label; state.filters.push(t); }
      });
    });
  }
  function toggleCatValue(dim, val, source) {
    var f = filterOf(dim);
    var had = !!(f && f.values.indexOf(val) >= 0);
    commit((had ? '解除过滤 ' : '过滤 ') + DIM[dim].label + '=' + val, source, function () {
      var cur = filterOf(dim);
      if (!cur) { state.filters.push({ dim: dim, kind: 'cat', values: [val] }); return; }
      var vals = cur.values.slice(), k = vals.indexOf(val);
      if (k >= 0) {
        vals.splice(k, 1);
        if (!vals.length) state.filters = state.filters.filter(function (x) { return x.dim !== dim; });
        else cur.values = vals;
      } else { vals.push(val); cur.values = vals; }
    });
  }
  function setRange(dim, lo, hi, source) {
    commit('过滤 ' + DIM[dim].label + ' ∈ [' + fmtV(dim, lo) + ', ' + fmtV(dim, hi) + ']', source, function () {
      var f = filterOf(dim);
      if (f) { f.kind = 'range'; f.lo = lo; f.hi = hi; delete f.values; }
      else state.filters.push({ dim: dim, kind: 'range', lo: lo, hi: hi });
    });
  }
  function clearFilter(dim, source) {
    commit('解除 ' + DIM[dim].label + ' 过滤', source, function () {
      state.filters = state.filters.filter(function (f) { return f.dim !== dim; });
    });
  }
  function clearAllFilters() {
    commit('清除全部过滤（' + state.filters.length + ' 项）', '投影画布 · 空状态恢复', function () {
      state.filters = [];
    });
  }
  function setFocus(id, source) {
    var r = recById(id);
    if (state.focus === id) return;
    var wasNull = !state.focus;
    commit((wasNull ? '聚焦 ' : '切换聚焦 ') + r.name, source, function () { state.focus = id; });
  }
  function clearFocus() {
    commit('清除聚焦', '检查器 · 操作', function () { state.focus = null; });
  }
  function recById(id) {
    for (var i = 0; i < S.records.length; i++) if (S.records[i].id === id) return S.records[i];
    return null;
  }

  /* ---------------- toast ---------------- */
  var toastTimer = null;
  function toast(msg) {
    var t = document.getElementById('toast');
    t.textContent = msg;
    t.hidden = false;
    requestAnimationFrame(function () { t.classList.add('show'); });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      t.classList.remove('show');
      toastTimer = setTimeout(function () { t.hidden = true; }, 300);
    }, 2000);
  }

  /* ---------------- 渲染 ---------------- */
  function renderAll() {
    renderAnchor();
    renderRail();
    renderCanvas();
    renderRecords();
    renderTrail();
    renderInspector();
    /* 滚动容器退出 Tab 序（Chrome 会把可滚动容器纳入焦点导航，打乱视觉阅读顺序） */
    document.querySelectorAll('.dim-rail, .canvas, .anchor-bar, .panel-b, .trail-list, .dim-edit .vals, .rightcol').forEach(function (el) { el.tabIndex = -1; });
  }

  /* 认知锁点条：跨维度切换恒定的锚点（H-21 定向不变量的可见化） */
  function ensureMeasureHost() {
    var host = document.getElementById('measureHost');
    if (!host) {
      host = document.createElement('span');
      host.id = 'measureHost';
      host.className = 'measure-wrap';
      var bar = document.querySelector('.topbar');
      if (bar) bar.appendChild(host);
    }
    return host;
  }
  function renderAnchor() {
    var nF = state.filters.length;
    var fRec = state.focus ? recById(state.focus) : null;
    var mLabel = state.measure.kind === 'count' ? '计数' : '平均 · ' + DIM[state.measure.dim].label;
    var html = '';
    html += '<span class="chip dim-keep" title="投影轴：跨维度切换由你主动更换，此处恒定显示当前轴">投影 <b>' + esc(DIM[state.y].label) + '</b><span class="k">×</span><b>' + esc(DIM[state.x].label) + '</b></span>';
    html += '<span class="chip dim-keep" title="度量选择不随换轴重置">度量 <b>' + esc(mLabel) + '</b></span>';
    html += '<span class="chip" title="当前过滤下的记录数（总数恒定）"><span class="k">匹配</span><b>' + matching().length + '</b><span class="k">/ ' + S.records.length + '</span></span>';
    if (fRec) html += '<span class="chip focus-chip" title="聚焦记录跨维度切换保持锚定">聚焦 <b>' + esc(fRec.name) + '</b></span>';
    else html += '<span class="chip" title="尚未聚焦记录；聚焦后同样跨维度切换保持"><span class="k">聚焦</span>无</span>';
    html += '<span class="chip" title="状态轨迹深度：归属与回退见状态轨迹面板"><span class="k">轨迹</span><b>' + (tIndex + 1) + '</b><span class="k">/ ' + trail.length + '</span></span>';
    state.filters.forEach(function (f) {
      var owner = ownerOf(f.dim);
      var label = DIM[f.dim].label + ' = ' + (f.kind === 'cat' ? f.values.join('∣') : '[' + fmtV(f.dim, f.lo) + ', ' + fmtV(f.dim, f.hi) + ']');
      html += '<span class="chip filter-chip" data-clear-dim="' + f.dim + '" title="归属：' + esc(owner.action) + '（' + esc(owner.source) + '）· ' + esc(owner.time) + '；点击移除，可经轨迹回退恢复">' + esc(label) + '<span class="x" aria-label="移除过滤">×</span></span>';
    });
    document.getElementById('anchorBar').innerHTML = html;
    ensureMeasureHost().innerHTML = '度量 <select id="measureSel" aria-label="度量选择">' +
      '<option value="count"' + (state.measure.kind === 'count' ? ' selected' : '') + '>计数</option>' +
      QUANT.map(function (d) {
        return '<option value="avg:' + d.id + '"' + (state.measure.kind === 'avg' && state.measure.dim === d.id ? ' selected' : '') + '>平均 · ' + esc(d.label) + (d.unit ? '(' + d.unit + ')' : '') + '</option>';
      }).join('') + '</select>';
  }
  /* 归属查询：找到引入/最后更新该维度过滤的轨迹条目 */
  function ownerOf(dim) {
    for (var i = trail.length - 1; i >= 0; i--) {
      var a = trail[i].action;
      if (a.indexOf(DIM[dim].label) >= 0 && (a.indexOf('过滤') === 0 || a.indexOf('下钻') === 0 || a.indexOf('解除') === 0 || a.indexOf('清除') === 0))
        return { action: a, source: trail[i].source, time: ts(trail[i].time) };
    }
    return { action: '初始状态', source: trail[0].source, time: ts(trail[0].time) };
  }

  function renderRail() {
    var fams = {};
    S.dims.forEach(function (d) { (fams[d.family] = fams[d.family] || []).push(d); });
    var html = '';
    Object.keys(fams).forEach(function (fam) {
      html += '<div class="rail-title">' + esc(fam) + '</div>';
      fams[fam].forEach(function (d) {
        var onX = state.x === d.id, onY = state.y === d.id;
        var f = filterOf(d.id);
        html += '<div class="dim' + (onX ? ' on-x' : '') + (onY ? ' on-y' : '') + (f ? ' filtered' : '') + '">';
        html += '<div class="dim-head">';
        html += '<button class="ax' + (onX ? ' x-active' : '') + '" data-axis="x" data-dim="' + d.id + '" title="设为 X 轴（列）' + (onY ? '；当前为 Y 轴，点击将对调' : '') + '">X</button>';
        html += '<button class="ax' + (onY ? ' y-active' : '') + '" data-axis="y" data-dim="' + d.id + '" title="设为 Y 轴（行）' + (onX ? '；当前为 X 轴，点击将对调' : '') + '">Y</button>';
        html += '<span class="dim-name">' + esc(d.label) + (d.unit ? ' <i style="font-style:normal;color:var(--tx3)">(' + d.unit + ')</i>' : '') + '</span>';
        html += '<span class="badge ' + d.type + '">' + (d.type === 'cat' ? '类' : '量') + '</span>';
        html += '<button class="funnel' + (f ? ' has-f' : '') + '" data-funnel="' + d.id + '" title="过滤此维度">◮' + (f ? '<sub>' + (f.kind === 'cat' ? f.values.length : '∈') + '</sub>' : '') + '</button>';
        html += '</div>';
        html += sparkline(d.id);
        if (ui.openDim === d.id) html += filterEditor(d.id);
        html += '</div>';
      });
    });
    var rail = document.getElementById('dimRail');
    rail.innerHTML = html;
  }
  function sparkline(dim) {
    var d = DIM[dim], vals;
    if (d.type === 'cat') {
      vals = d.values.map(function (v) {
        return S.records.reduce(function (s, r) { return s + (r[dim] === v ? 1 : 0); }, 0);
      });
    } else {
      vals = new Array(DOMAIN[dim].n).fill(0);
      S.records.forEach(function (r) { vals[binOf(dim, r[dim])]++; });
    }
    var max = Math.max.apply(null, vals);
    var bars = vals.map(function (v, i) {
      var h = max ? Math.max(1.5, v / max * 22) : 1.5;
      return '<rect height="' + h.toFixed(1) + '" width="' + (100 / vals.length - 1.2).toFixed(2) + '" x="' + (i * 100 / vals.length).toFixed(2) + '" y="' + (24 - h).toFixed(1) + '"></rect>';
    }).join('');
    return '<svg class="spark" viewBox="0 0 100 24" preserveAspectRatio="none" aria-hidden="true">' + bars + '</svg>';
  }
  function filterEditor(dim) {
    var d = DIM[dim], f = filterOf(dim), html = '<div class="dim-edit">';
    if (d.type === 'cat') {
      html += '<div class="vals">';
      d.values.forEach(function (v) {
        var n = S.records.reduce(function (s, r) { return s + (r[dim] === v ? 1 : 0); }, 0);
        var on = f && f.values.indexOf(v) >= 0;
        html += '<label class="val"><input type="checkbox" data-catval="' + esc(v) + '" data-catdim="' + dim + '"' + (on ? ' checked' : '') + '> ' + esc(v) + '<span class="cnt">' + n + '</span></label>';
      });
      html += '</div>';
    } else {
      var lo = f ? f.lo : DOMAIN[dim].lo, hi = f ? f.hi : DOMAIN[dim].hi;
      html += '<div class="range-row"><input type="number" id="rng-' + dim + '-lo" value="' + lo + '" step="any" aria-label="最小值"> <span style="color:var(--tx3)">–</span> <input type="number" id="rng-' + dim + '-hi" value="' + hi + '" step="any" aria-label="最大值"></div>';
    }
    html += '<div class="mini-actions">';
    html += '<button class="btn primary" data-applyf="' + dim + '">应用过滤</button>';
    if (f) html += '<button class="btn ghost" data-clearf="' + dim + '">清除</button>';
    html += '</div></div>';
    return html;
  }

  function renderCanvas() {
    var el = document.getElementById('canvas');
    var xv = axisVals(state.x), yv = axisVals(state.y);
    var rows = matching();
    var mLabel = state.measure.kind === 'count' ? '计数' : '平均 · ' + DIM[state.measure.dim].label;

    var head = '<div class="canvas-head">';
    head += '<span class="canvas-title"><span class="yd">' + esc(DIM[state.y].label) + '</span><span class="arr">╲</span><span class="xd">' + esc(DIM[state.x].label) + '</span></span>';
    head += '<span class="canvas-note">单元格点击 = 下钻为过滤（归属并记入轨迹）· 换轴不改变过滤 / 聚焦 / 度量</span>';
    // 图例
    head += '<span class="legend" title="热力色标：低 → 高">';
    for (var li = 0; li < 7; li++) head += '<i style="background:' + HEAT[li].bg + '"></i>';
    head += '</span></span></div>';

    if (!rows.length) {
      el.innerHTML = head + '<div class="empty-state"><span class="glyph">◌</span>' +
        '<p>当前过滤组合下没有匹配记录（空集）。<br>过滤与投影状态仍被完整记录与保留。</p>' +
        '<button class="btn primary" id="clearAllBtn">清除全部过滤（' + state.filters.length + ' 项）</button></div>';
      return;
    }

    // 聚合
    var useAvg = state.measure.kind === 'avg', mDim = state.measure.dim;
    var cnt = [], agg = [], rowTot = [], colTot = new Array(xv.length).fill(0);
    var mVal = [];
    for (var i = 0; i < yv.length; i++) {
      cnt.push(new Array(xv.length).fill(0));
      mVal.push(new Array(xv.length).fill(0));
      rowTot.push(0);
    }
    var colAgg = new Array(xv.length).fill(0);
    rows.forEach(function (r) {
      var j = axisIndexOf(state.x, r[state.x]);
      var i2 = axisIndexOf(state.y, r[state.y]);
      cnt[i2][j]++; rowTot[i2]++; colTot[j]++;
      if (useAvg) { mVal[i2][j] += r[mDim]; colAgg[j] += r[mDim]; }
    });
    var cellDisp = cnt.map(function (row, i2) {
      return row.map(function (c, j) {
        if (!c) return null;
        return useAvg ? mVal[i2][j] / c : c;
      });
    });
    var maxCell = 0;
    cellDisp.forEach(function (row) { row.forEach(function (v) { if (v !== null) maxCell = Math.max(maxCell, v); }); });
    function heatLevel(v) { return Math.min(6, Math.floor(v / (maxCell || 1) * 6.999)); }

    var fRec = state.focus ? recById(state.focus) : null;
    var focusCell = null;
    if (fRec) focusCell = [axisIndexOf(state.y, fRec[state.y]), axisIndexOf(state.x, fRec[state.x])];

    var html = head + '<table class="heat"><thead><tr><th class="corner">' + esc(DIM[state.y].label) + ' ╲ ' + esc(DIM[state.x].label) + '</th>';
    xv.forEach(function (v, j) {
      var lab = DIM[state.x].type === 'cat' ? v : binLabel(state.x, v.bin);
      html += '<th class="" title="' + esc(lab) + '">' + esc(lab) + '</th>';
    });
    html += '<th class="margin">Σ</th></tr></thead><tbody>';
    yv.forEach(function (v, i2) {
      var lab = DIM[state.y].type === 'cat' ? v : binLabel(state.y, v.bin);
      html += '<tr><th class="' + (state.y === state.measure.dim && useAvg ? 'y-active-row' : '') + '" title="' + esc(lab) + '">' + esc(lab) + '</th>';
      xv.forEach(function (_, j) {
        var c = cnt[i2][j];
        var cls = 'cell' + (!c ? ' zero' : '');
        var style = '';
        if (c) {
          var hl = heatLevel(cellDisp[i2][j]);
          style = 'background:' + HEAT[hl].bg;
          if (HEAT[hl].light) cls += ' hot-tx';
        }
        if (focusCell && focusCell[0] === i2 && focusCell[1] === j) cls += ' focus-cell';
        var big = c === 0 ? '·' : (useAvg ? fmtV(mDim, cellDisp[i2][j]) : c);
        var sub = c === 0 ? '' : (useAvg ? 'n=' + c : '');
        html += '<td class="' + cls + '" style="' + style + '" data-cell="' + i2 + ',' + j + '" title="' + esc(DIM[state.y].label) + '×' + esc(DIM[state.x].label) + ': n=' + c + (c && useAvg ? ', avg=' + fmtV(mDim, cellDisp[i2][j]) : '') + '（点击下钻）">' +
          '<span class="big">' + big + '</span>' + (sub ? '<span class="sub">' + sub + '</span>' : '') + '</td>';
      });
      html += '<td class="margin">' + rowTot[i2] + '</td></tr>';
    });
    html += '<tr><th class="margin" style="text-align:right">Σ</th>';
    xv.forEach(function (_, j) { html += '<td class="margin">' + colTot[j] + '</td>'; });
    html += '<td class="margin">' + rows.length + '</td></tr></tbody></table>';
    el.innerHTML = html;
  }

  function renderRecords() {
    var el = document.getElementById('records');
    var rows = matching();
    var html = '<div class="panel-h">匹配记录<span class="cnt">' + rows.length + ' / ' + S.records.length + '</span></div>';
    html += '<div class="rec-head"><span>名称 / 类别</span><span>温度 K</span><span>距离 ly</span><span>ESI</span></div>';
    html += '<div class="panel-b">';
    var LIMIT = 60;
    rows = rows.slice().sort(function (a, b) { return b.esi - a.esi; });
    rows.slice(0, LIMIT).forEach(function (r) {
      var cur = state.focus === r.id;
      html += '<div class="rec-row' + (cur ? ' current' : '') + '" data-rec="' + r.id + '" title="点击聚焦（跨维度切换保持）">' +
        '<span class="rec-name">' + esc(r.name) + '<span class="rec-sub">' + esc(r.pclass) + ' · ' + esc(r.star) + '</span></span>' +
        '<span class="rec-num">' + r.temp + '</span><span class="rec-num">' + r.dist + '</span><span class="rec-num">' + r.esi.toFixed(2) + '</span></div>';
    });
    html += '</div>';
    if (rows.length > LIMIT) html += '<div class="rec-foot">仅显示前 ' + LIMIT + ' 条（按宜居指数序），共 ' + rows.length + ' 条匹配</div>';
    el.innerHTML = html;
  }

  function renderTrail() {
    var el = document.getElementById('trail');
    var html = '<div class="panel-h">状态轨迹 · 归属与回退' +
      '<span style="margin-left:auto;display:flex;gap:4px">' +
      '<button class="btn" id="undoBtn" title="撤销（Ctrl+Z）"' + (tIndex > 0 ? '' : ' disabled') + '>↶</button>' +
      '<button class="btn" id="redoBtn" title="重做（Ctrl+Shift+Z）"' + (tIndex < trail.length - 1 ? '' : ' disabled') + '>↷</button>' +
      '<button class="btn" id="baseBtn" title="回到初始状态"' + (tIndex > 0 ? '' : ' disabled') + '>⤺</button>' +
      '</span></div>';
    html += '<div class="trail-hint">每条 = 一个完整状态快照（归属：触发操作 + 来源 + 时间）。点击任意条目回退到该时刻；之后的操作会开新分支。</div>';
    html += '<div class="trail-list">';
    for (var i = trail.length - 1; i >= 0; i--) {
      var t = trail[i];
      var cls = 'trail-item' + (i === tIndex ? ' current' : '') + (i < tIndex ? ' past' : '');
      html += '<div class="' + cls + '" data-tidx="' + i + '" title="点击回退到该状态">' +
        '<span class="trail-seq">#' + t.seq + '</span>' +
        '<span class="trail-act"><span class="a">' + esc(t.action) + '</span><span class="src">归属：' + esc(t.source) + '</span></span>' +
        '<span class="trail-time">' + ts(t.time) + '</span></div>';
    }
    html += '</div>';
    el.innerHTML = html;
  }

  function renderInspector() {
    var el = document.getElementById('inspector');
    var r = state.focus ? recById(state.focus) : null;
    if (!r) {
      el.innerHTML = '<div class="panel-h">聚焦检查器</div><div class="insp-empty">尚未聚焦记录。点击画布下方的记录列表，或在投影中下钻后选择一条行星；聚焦会<b style="color:var(--tx2)">跨维度切换保持</b>，其投影落点随当前轴自动更新。</div>';
      return;
    }
    var html = '<div class="panel-h">聚焦检查器<span class="cnt">' + esc(r.id) + '</span></div><div class="insp-body">';
    html += '<div class="insp-name">' + esc(r.name) + '</div>';
    html += '<div class="insp-sub">' + esc(r.pclass) + ' · ' + esc(r.method) + ' · ' + esc(r.star) + ' · ' + esc(r.sky) + '</div>';
    html += '<div class="insp-grid">';
    QUANT.forEach(function (d) {
      html += '<div class="insp-kv"><span class="k">' + esc(d.label) + (d.unit ? '(' + d.unit + ')' : '') + '</span><span class="v">' + fmtV(d.id, r[d.id]) + '</span></div>';
    });
    html += '</div>';
    var xLab = DIM[state.x].type === 'cat' ? r[state.x] : binLabel(state.x, binOf(state.x, r[state.x]));
    var yLab = DIM[state.y].type === 'cat' ? r[state.y] : binLabel(state.y, binOf(state.y, r[state.y]));
    html += '<div class="insp-pos">当前投影落点：<b>' + esc(DIM[state.y].label) + '</b>=' + esc(yLab) + ' × <b>' + esc(DIM[state.x].label) + '</b>=' + esc(xLab) + '<br><span style="color:var(--tx3)">换轴后此行随当前投影自动更新，聚焦本身不丢失。</span></div>';
    html += '<div class="mini-actions"><button class="btn" id="clearFocusBtn" tabindex="-1" title="清除聚焦（键盘按 Esc）">清除聚焦（Esc）</button></div></div>';
    el.innerHTML = html;
  }

  /* ---------------- 事件绑定 ---------------- */
  function bind() {
    document.getElementById('dimRail').addEventListener('click', function (e) {
      var ax = e.target.closest('.ax');
      if (ax) { setAxis(ax.dataset.axis, ax.dataset.dim, '维度轨 · ' + ax.dataset.axis.toUpperCase() + ' 轴按钮'); return; }
      var fn = e.target.closest('.funnel');
      if (fn) { ui.openDim = ui.openDim === fn.dataset.funnel ? null : fn.dataset.funnel; renderRail(); }
    });
    document.getElementById('dimRail').addEventListener('change', function (e) {
      // 分类复选框即时提交（每 tick 一次快照，归属清晰）
      var cb = e.target.closest('input[data-catval]');
      if (cb) toggleCatValue(cb.dataset.catdim, cb.dataset.catval, '维度轨 · 值勾选');
    });
    document.getElementById('dimRail').addEventListener('click', function (e) {
      var ap = e.target.closest('[data-applyf]');
      if (ap) {
        var dim = ap.dataset.applyf, d = DIM[dim];
        if (d.type === 'quant') {
          var lo = parseFloat(document.getElementById('rng-' + dim + '-lo').value);
          var hi = parseFloat(document.getElementById('rng-' + dim + '-hi').value);
          if (isNaN(lo) || isNaN(hi) || lo > hi) { toast('区间无效'); return; }
          var dom = DOMAIN[dim];
          if (lo <= dom.lo && hi >= dom.hi) clearFilter(dim, '维度轨 · 区间应用（全域）');
          else setRange(dim, clampV(dim, lo), clampV(dim, hi), '维度轨 · 区间应用');
        }
        return;
      }
      var cl = e.target.closest('[data-clearf]');
      if (cl) clearFilter(cl.dataset.clearf, '维度轨 · 清除按钮');
    });
    document.getElementById('anchorBar').addEventListener('click', function (e) {
      var chip = e.target.closest('[data-clear-dim]');
      if (chip) clearFilter(chip.dataset.clearDim, '锁点条 · 过滤芯片 ×');
    });
    document.getElementById('canvas').addEventListener('click', function (e) {
      if (e.target.closest('#clearAllBtn')) { clearAllFilters(); return; }
      var cell = e.target.closest('[data-cell]');
      if (cell) {
        var ij = cell.dataset.cell.split(',');
        drillCell(+ij[0], +ij[1]);
      }
    });
    document.getElementById('records').addEventListener('click', function (e) {
      var row = e.target.closest('[data-rec]');
      if (row) setFocus(row.dataset.rec, '记录列表 · 点击行');
    });
    document.getElementById('trail').addEventListener('click', function (e) {
      if (e.target.closest('#undoBtn')) { undo(); return; }
      if (e.target.closest('#redoBtn')) { redo(); return; }
      if (e.target.closest('#baseBtn')) { timeTravel(0); return; }
      var it = e.target.closest('[data-tidx]');
      if (it) timeTravel(+it.dataset.tidx);
    });
    document.getElementById('inspector').addEventListener('click', function (e) {
      if (e.target.closest('#clearFocusBtn')) clearFocus();
    });
    document.addEventListener('change', function (e) {
      if (e.target && e.target.id === 'measureSel') {
        var v = e.target.value;
        if (v === 'count') setMeasure('count', null);
        else { var p = v.split(':'); setMeasure('avg', p[1]); }
      }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && state.focus) { clearFocus(); return; }
      if (!(e.ctrlKey || e.metaKey)) return;
      var k = e.key.toLowerCase();
      if (k === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      else if ((k === 'z' && e.shiftKey) || k === 'y') { e.preventDefault(); redo(); }
    });
  }
  function clampV(dim, v) {
    var d = DOMAIN[dim];
    return Math.min(d.hi, Math.max(d.lo, v));
  }

  /* ---------------- 启动 ---------------- */
  function boot(rootEl) {
    state = clone(BASE);
    trail = [{ seq: 0, time: new Date(), action: '初始状态（首屏内联就绪）', source: '系统 · 数据内联', snap: snapshot() }];
    bind();
    renderAll();
  }
  if (!window.__HARNESS__) {
    boot(document.getElementById('app'));
  }

  /* 供测试 harness 与调试使用 */
  window.APP = {
    boot: boot,
    /* 只读内部态 */
    get state() { return clone(state); },
    get trail() { return clone(trail.map(function (t) { return { seq: t.seq, time: t.time, action: t.action, source: t.source }; })); },
    get tIndex() { return tIndex; },
    matchingCount: function () { return matching().length; },
    /* 受控动作（带默认归属来源） */
    setAxis: function (a, d) { setAxis(a, d, 'harness'); },
    toggleCatValue: function (d, v) { toggleCatValue(d, v, 'harness'); },
    setRange: function (d, lo, hi) { setRange(d, lo, hi, 'harness'); },
    setFocus: function (id) { setFocus(id, 'harness'); },
    setMeasure: setMeasure,
    drillCell: drillCell,
    timeTravel: timeTravel,
    undo: undo,
    redo: redo,
    clearAllFilters: clearAllFilters
  };
})();
