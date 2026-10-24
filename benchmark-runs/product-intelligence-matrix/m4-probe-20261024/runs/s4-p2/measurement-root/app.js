/* 维度探针 Dimension Probe — cell-j13-s10 (explore × dimensional-space)
 *
 * 核心不变式（对应验收种子「过滤/投影状态有归属且可回退」）：
 *  - 单一状态对象 state = { projection, filters, colorBy, selection }，子空间正交。
 *  - 切换维度只写 projection 子空间，永不触碰 filters/selection —— 维度切换不重置认知。
 *  - 每个动作生成一个不可变快照入 hist（归属），cur 指针可指向任意历史步（可回退）。
 */
(function () {
  'use strict';

  var D = window.DATASET;
  var NUM_DIMS = D.dimensions.filter(function (d) { return d.type === 'numeric'; });
  var CAT_DIMS = D.dimensions.filter(function (d) { return d.type === 'category'; });
  var DIMByKey = {};
  D.dimensions.forEach(function (d) { DIMByKey[d.key] = d; });
  var RECORDS = D.records;

  var REGION_COLORS = ['#1d4ed8', '#b91c1c', '#047857', '#b45309', '#6d28d9', '#0e7490', '#be185d', '#3f3f46'];
  var TIER_COLORS = ['#1d4ed8', '#b45309', '#6d28d9'];
  var UNIFIED_COLOR = '#0e7490';
  var EXCLUDED_COLOR = 'rgba(148,163,184,.55)';

  var $ = function (id) { return document.getElementById(id); };

  /* ————— 状态与历史 ————— */
  function cloneState(s) {
    var f = {};
    for (var k in s.filters) f[k] = s.filters[k].slice();
    return {
      projection: { x: s.projection.x, y: s.projection.y },
      filters: f,
      colorBy: s.colorBy,
      selection: s.selection
    };
  }

  var initialState = {
    projection: { x: 'gdp', y: 'transit' },
    filters: {},
    colorBy: 'region',
    selection: null
  };

  var hist = [{ label: '初始视图 · ' + axisLabel('x', initialState) + ' × ' + axisLabel('y', initialState), kind: 'init', state: initialState }];
  var cur = 0;
  var state = hist[cur].state;

  function axisLabel(axis, s) {
    var d = DIMByKey[s.projection[axis]];
    return d ? d.label : d;
  }

  /* 提交一步：截断未来分支，追加归属快照 */
  function commit(label, kind, mutate) {
    hist = hist.slice(0, cur + 1);
    var next = cloneState(state);
    if (mutate) mutate(next);
    state = next;
    hist.push({ label: label, kind: kind, state: next });
    cur = hist.length - 1;
    renderAll(true);
  }

  function jumpTo(i) {
    if (i < 0 || i >= hist.length || i === cur) return;
    cur = i;
    state = hist[cur].state;
    renderAll(true);
    announce('回到第 ' + (i + 1) + ' 步：' + hist[i].label);
  }
  function undo() { if (cur > 0) jumpTo(cur - 1); }
  function redo() { if (cur < hist.length - 1) jumpTo(cur + 1); }

  /* ————— 动作（每个动作 = 一条归属轨迹） ————— */
  function setAxis(axis, key, via) {
    if (state.projection[axis] === key) return;
    var viaTxt = via ? '（' + via + '）' : '';
    commit((axis === 'x' ? 'X 轴 → ' : 'Y 轴 → ') + DIMByKey[key].label + viaTxt, 'projection', function (s) {
      s.projection[axis] = key;
    });
  }
  function swapAxes() {
    commit('交换 X/Y（' + axisLabel('y', state) + ' × ' + axisLabel('x', state) + '）', 'projection', function (s) {
      var t = s.projection.x; s.projection.x = s.projection.y; s.projection.y = t;
    });
  }
  function setColorBy(key) {
    if (state.colorBy === key) return;
    var names = { region: '区域', tier: '层级', none: '统一' };
    commit('着色 → ' + names[key], 'color', function (s) { s.colorBy = key; });
  }
  function setRange(key, lo, hi) {
    var d = DIMByKey[key];
    var full = lo <= d.min && hi >= d.max;
    var prev = state.filters[key];
    if (full && !prev) return; // 无变化
    if (full) {
      commit('清除过滤 · ' + d.label, 'filter', function (s) { delete s.filters[key]; });
    } else {
      var txt = fmtVal(d, lo) + ' – ' + fmtVal(d, hi) + ' ' + d.unit;
      commit('过滤 ' + d.label + ' ∈ ' + txt, 'filter', function (s) { s.filters[key] = [lo, hi]; });
    }
  }
  function toggleCategory(key, val) {
    var d = DIMByKey[key];
    var values = d.values;
    var prev = state.filters[key] ? state.filters[key].slice() : values.slice();
    var i = prev.indexOf(val);
    if (i >= 0) prev.splice(i, 1); else prev.push(val);
    if (prev.length === values.length) {
      commit('清除过滤 · ' + d.label, 'filter', function (s) { delete s.filters[key]; });
    } else {
      commit('过滤 ' + d.label + ' → ' + prev.length + '/' + values.length + ' 项', 'filter', function (s) { s.filters[key] = prev.sort(function (a, b) { return values.indexOf(a) - values.indexOf(b); }); });
    }
  }
  function clearFilters() {
    var n = Object.keys(state.filters).length;
    if (!n) return;
    commit('清除全部过滤（' + n + ' 项）', 'filter', function (s) { s.filters = {}; });
  }
  function select(rec, via) {
    if (state.selection === rec.id) return;
    commit((via ? via : '') + '选中 ' + rec.name, 'selection', function (s) { s.selection = rec.id; });
  }
  function deselect() {
    if (state.selection == null) return;
    commit('取消选中', 'selection', function (s) { s.selection = null; });
  }

  /* ————— 派生：匹配集合 ————— */
  function matches(r, filters) {
    for (var k in filters) {
      var f = filters[k];
      if (f.length === 2 && typeof f[0] === 'number') {
        if (r[k] < f[0] || r[k] > f[1]) return false;
      } else {
        if (f.indexOf(r[k]) < 0) return false;
      }
    }
    return true;
  }
  function visibleRecords(s) {
    return RECORDS.filter(function (r) { return matches(r, s.filters); });
  }

  function fmtVal(d, v) {
    if (d.key === 'pop') return String(Math.round(v));
    if (d.key === 'gdp') return (Math.round(v * 10) / 10).toFixed(1);
    return String(Math.round(v));
  }

  /* ————— 画布 ————— */
  var canvas = $('plot'), wrap = $('canvas-wrap'), tooltip = $('tooltip');
  var ctx = canvas.getContext('2d');
  var M = { l: 58, r: 18, t: 14, b: 42 };
  var hoverRec = null;
  var kbCursorId = null; // 键盘浏览游标（不入轨迹）

  function xScale(s) {
    var d = DIMByKey[s.projection.x];
    var w = canvas.clientWidth - M.l - M.r;
    return function (v) { return M.l + (v - d.min) / (d.max - d.min) * w; };
  }
  function yScale(s) {
    var d = DIMByKey[s.projection.y];
    var h = canvas.clientHeight - M.t - M.b;
    return function (v) { return M.t + h - (v - d.min) / (d.max - d.min) * h; };
  }
  function colorOf(s, r) {
    if (s.colorBy === 'region') return REGION_COLORS[CAT_DIMS[0].values.indexOf(r.region) % REGION_COLORS.length];
    if (s.colorBy === 'tier') return TIER_COLORS[CAT_DIMS[1].values.indexOf(r.tier) % TIER_COLORS.length];
    return UNIFIED_COLOR;
  }

  function drawCanvas(view) {
    if (view) { // 拖拽预览：临时换入视图状态绘制，不触碰已提交状态
      var saved = state;
      state = view;
      drawCanvas();
      state = saved;
      return;
    }
    var dpr = window.devicePixelRatio || 1;
    var cw = canvas.clientWidth, ch = canvas.clientHeight;
    if (cw < 40 || ch < 40) return;
    if (canvas.width !== Math.round(cw * dpr) || canvas.height !== Math.round(ch * dpr)) {
      canvas.width = Math.round(cw * dpr);
      canvas.height = Math.round(ch * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cw, ch);

    var dx = DIMByKey[state.projection.x], dy = DIMByKey[state.projection.y];
    var X = xScale(state), Y = yScale(state);
    var plotH = ch - M.t - M.b, plotW = cw - M.l - M.r;

    // 网格与刻度（固定值域 = 数据值域：切换维度前后坐标锚点稳定）
    ctx.font = '12px "Segoe UI", system-ui, sans-serif';
    ctx.strokeStyle = '#e2e8f0';
    ctx.fillStyle = '#475569';
    ctx.lineWidth = 1;
    var TICKS = 5;
    for (var i = 0; i <= TICKS; i++) {
      var frac = i / TICKS;
      var gx = M.l + frac * plotW;
      var gy = M.t + plotH - frac * plotH;
      ctx.beginPath(); ctx.moveTo(gx, M.t); ctx.lineTo(gx, M.t + plotH); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(M.l, gy); ctx.lineTo(M.l + plotW, gy); ctx.stroke();
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.fillText(fmtVal(dx, dx.min + frac * (dx.max - dx.min)), gx, M.t + plotH + 7);
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      ctx.fillText(fmtVal(dy, dy.min + frac * (dy.max - dy.min)), M.l - 8, gy);
    }
    // 坐标轴框
    ctx.strokeStyle = '#cbd5e1';
    ctx.strokeRect(M.l + .5, M.t + .5, plotW - 1, plotH - 1);
    // 轴标题
    ctx.fillStyle = '#334155';
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.fillText(dx.label + '（' + dx.unit + '）→', M.l + plotW / 2, ch - 6);
    ctx.save();
    ctx.translate(13, M.t + plotH / 2); ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText(dy.label + '（' + dy.unit + '）→', 0, 0);
    ctx.restore();

    // 图例
    var legendItems = state.colorBy === 'region' ? CAT_DIMS[0].values.map(function (v, ix) { return [v, REGION_COLORS[ix]]; })
      : state.colorBy === 'tier' ? CAT_DIMS[1].values.map(function (v, ix) { return [v, TIER_COLORS[ix]]; })
        : [['统一', UNIFIED_COLOR]];
    var lx = M.l + plotW - 6, ly = M.t + 12;
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    for (var li = legendItems.length - 1; li >= 0; li--) {
      ctx.fillStyle = legendItems[li][1];
      ctx.beginPath(); ctx.arc(lx - ctx.measureText(legendItems[li][0]).width - 10, ly, 3.5, 0, 7); ctx.fill();
      ctx.fillStyle = '#334155';
      ctx.fillText(legendItems[li][0], lx - 10, ly);
      ly += 17;
    }

    // 点：被过滤排除的画淡灰小点（保留上下文），可见的按着色画
    var i2, r2;
    for (i2 = 0; i2 < RECORDS.length; i2++) {
      r2 = RECORDS[i2];
      if (matches(r2, state.filters)) continue;
      ctx.fillStyle = EXCLUDED_COLOR;
      ctx.beginPath(); ctx.arc(X(r2[dx.key]), Y(r2[dy.key]), 2, 0, 7); ctx.fill();
    }
    var vis = visibleRecords(state);
    for (i2 = 0; i2 < vis.length; i2++) {
      r2 = vis[i2];
      ctx.fillStyle = colorOf(state, r2);
      ctx.globalAlpha = .92;
      ctx.beginPath(); ctx.arc(X(r2[dx.key]), Y(r2[dy.key]), 3.4, 0, 7); ctx.fill();
      ctx.globalAlpha = 1;
    }
    // 键盘游标（虚线环）
    if (kbCursorId != null) {
      var kr = RECORDS[kbCursorId];
      if (matches(kr, state.filters)) {
        ctx.strokeStyle = '#0f172a'; ctx.setLineDash([3, 3]); ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.arc(X(kr[dx.key]), Y(kr[dy.key]), 7.5, 0, 7); ctx.stroke();
        ctx.setLineDash([]);
      }
    }
    // 选中：实线环 + 十字导引
    if (state.selection != null) {
      var sr = RECORDS[state.selection];
      var sx = X(sr[dx.key]), sy = Y(sr[dy.key]);
      ctx.strokeStyle = '#0f172a'; ctx.lineWidth = 1.2;
      ctx.setLineDash([2, 4]);
      ctx.beginPath(); ctx.moveTo(M.l, sy); ctx.lineTo(M.l + plotW, sy); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(sx, M.t); ctx.lineTo(sx, M.t + plotH); ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle = '#0f172a'; ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.arc(sx, sy, 7, 0, 7); ctx.stroke();
      ctx.fillStyle = '#0f172a';
      ctx.font = '600 12px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
      ctx.fillText(sr.name, sx + 10, sy - 8);
    }
  }

  /* ————— 画布交互 ————— */
  function nearestRecord(px, py, s) {
    var dx = DIMByKey[s.projection.x], dy = DIMByKey[s.projection.y];
    var X = xScale(s), Y = yScale(s);
    var best = null, bestD = 144; // 12px 半径
    for (var i = 0; i < RECORDS.length; i++) {
      var r = RECORDS[i];
      if (!matches(r, s.filters)) continue;
      var d = (X(r[dx.key]) - px) * (X(r[dx.key]) - px) + (Y(r[dy.key]) - py) * (Y(r[dy.key]) - py);
      if (d < bestD) { bestD = d; best = r; }
    }
    return best;
  }

  canvas.addEventListener('mousemove', function (ev) {
    var rect = canvas.getBoundingClientRect();
    var rec = nearestRecord(ev.clientX - rect.left, ev.clientY - rect.top, state);
    hoverRec = rec;
    if (rec) {
      var dx = DIMByKey[state.projection.x], dy = DIMByKey[state.projection.y];
      tooltip.innerHTML = '<span class="tt-name">' + rec.name + '</span><br>' +
        '<span class="tt-dim">' + dx.label + '</span> ' + fmtVal(dx, rec[dx.key]) + ' ' + dx.unit +
        ' · <span class="tt-dim">' + dy.label + '</span> ' + fmtVal(dy, rec[dy.key]) + ' ' + dy.unit;
      tooltip.hidden = false;
      var tw = tooltip.offsetWidth, th = tooltip.offsetHeight;
      var tx = ev.clientX - rect.left + 14, ty = ev.clientY - rect.top - th - 8;
      if (tx + tw > rect.width - 8) tx = ev.clientX - rect.left - tw - 14;
      if (ty < 4) ty = ev.clientY - rect.top + 16;
      tooltip.style.left = tx + 'px';
      tooltip.style.top = ty + 'px';
    } else {
      tooltip.hidden = true;
    }
  });
  canvas.addEventListener('mouseleave', function () { tooltip.hidden = true; hoverRec = null; });
  canvas.addEventListener('click', function (ev) {
    var rect = canvas.getBoundingClientRect();
    var rec = nearestRecord(ev.clientX - rect.left, ev.clientY - rect.top, state);
    if (rec) select(rec); else deselect();
  });

  // 键盘浏览：方向键在可见记录间移动游标，回车选中
  function kbList() {
    var s = state;
    return visibleRecords(s).slice().sort(function (a, b) {
      var dx = DIMByKey[s.projection.x], dy = DIMByKey[s.projection.y];
      return (a[dx.key] - b[dx.key]) || (a[dy.key] - b[dy.key]) || (a.id - b.id);
    });
  }
  canvas.addEventListener('keydown', function (ev) {
    var list = kbList();
    if (!list.length) return;
    var s = state;
    var dy = DIMByKey[s.projection.y];
    var idx = -1;
    if (kbCursorId != null) { for (var i = 0; i < list.length; i++) if (list[i].id === kbCursorId) { idx = i; break; } }
    var byX = ev.key === 'ArrowRight' ? 1 : ev.key === 'ArrowLeft' ? -1 : 0;
    var byY = ev.key === 'ArrowDown' ? 1 : ev.key === 'ArrowUp' ? -1 : 0;
    if (byX || byY) {
      ev.preventDefault();
      if (idx < 0) {
        idx = 0;
      } else {
        // Up/Down 沿 y 值序移动，Left/Right 沿 x 值序移动
        var arr = list;
        if (byY) {
          arr = list.slice().sort(function (a, b) { return (a[dy.key] - b[dy.key]) || (a.id - b.id); });
          idx = arr.indexOf(list[idx]);
        }
        idx = Math.max(0, Math.min(arr.length - 1, idx + (byX || byY)));
      }
      kbCursorId = list[idx].id;
      drawCanvas();
      announce('浏览：' + list[idx].name);
    } else if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      if (kbCursorId != null) select(RECORDS[kbCursorId], '键盘 ');
    } else if (ev.key === 'Escape') {
      ev.preventDefault();
      deselect();
    }
  });

  /* ————— 控件栏 ————— */
  function fillSelect(sel, dims, allLabel) {
    sel.textContent = '';
    if (allLabel) {
      var oa = document.createElement('option');
      oa.value = 'none'; oa.textContent = allLabel;
      sel.appendChild(oa);
    }
    dims.forEach(function (d) {
      var o = document.createElement('option');
      o.value = d.key; o.textContent = d.type === 'numeric' ? d.label + '（' + d.unit + '）' : d.label;
      sel.appendChild(o);
    });
  }
  var selX = $('axis-x'), selY = $('axis-y'), selC = $('color-by');
  fillSelect(selX, NUM_DIMS);
  fillSelect(selY, NUM_DIMS);
  fillSelect(selC, CAT_DIMS, '统一色');
  selX.addEventListener('change', function () { setAxis('x', selX.value, '选择器'); });
  selY.addEventListener('change', function () { setAxis('y', selY.value, '选择器'); });
  selC.addEventListener('change', function () { setColorBy(selC.value); });
  $('btn-swap').addEventListener('click', swapAxes);
  $('btn-undo').addEventListener('click', undo);
  $('btn-redo').addEventListener('click', redo);
  $('btn-clear-filters').addEventListener('click', clearFilters);
  $('btn-clear-all').addEventListener('click', clearFilters);
  $('btn-deselect').addEventListener('click', deselect);

  document.addEventListener('keydown', function (ev) {
    if (!(ev.ctrlKey || ev.metaKey) || ev.altKey) return;
    var k = ev.key.toLowerCase();
    if (k === 'z' && !ev.shiftKey) { ev.preventDefault(); undo(); }
    else if ((k === 'z' && ev.shiftKey) || k === 'y') { ev.preventDefault(); redo(); }
  });

  /* ————— 过滤器面板 ————— */
  var filtersRoot = $('filters');

  function buildFilters(s) {
    filtersRoot.textContent = '';
    var anyActive = false;
    CAT_DIMS.forEach(function (d) {
      var g = document.createElement('div');
      g.className = 'filter-group';
      g.dataset.dim = d.key;
      var row = document.createElement('div');
      row.className = 'filter-row';
      var name = document.createElement('span');
      name.className = 'filter-name'; name.textContent = d.label;
      var vals = document.createElement('span');
      var active = s.filters[d.key];
      var isActive = !!active && active.length !== d.values.length;
      vals.className = 'filter-vals' + (isActive ? ' is-active' : '');
      vals.textContent = isActive ? active.length + '/' + d.values.length : '全部';
      row.appendChild(name); row.appendChild(vals);
      g.appendChild(row);
      var chips = document.createElement('div');
      chips.className = 'chips';
      chips.setAttribute('role', 'group');
      chips.setAttribute('aria-label', d.label + '过滤');
      d.values.forEach(function (v) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'chip';
        b.textContent = v;
        b.setAttribute('aria-pressed', (!isActive || active.indexOf(v) >= 0) ? 'true' : 'false');
        b.addEventListener('click', function () { toggleCategory(d.key, v); });
        chips.appendChild(b);
      });
      g.appendChild(chips);
      filtersRoot.appendChild(g);
      if (isActive) anyActive = true;
    });
    NUM_DIMS.forEach(function (d) {
      var g = document.createElement('div');
      g.className = 'filter-group';
      g.dataset.dim = d.key;
      var row = document.createElement('div');
      row.className = 'filter-row num-row';
      var name = document.createElement('span');
      name.className = 'filter-name'; name.textContent = d.label;

      var lo = document.createElement('input');
      var hi = document.createElement('input');
      [[lo, d.min, '最小值'], [hi, d.max, '最大值']].forEach(function (cfg) {
        var inp = cfg[0];
        inp.type = 'range';
        inp.min = d.min; inp.max = d.max; inp.step = d.key === 'gdp' ? 0.1 : 1;
        inp.value = cfg[1];
        inp.setAttribute('aria-label', d.label + cfg[2]);
      });

      var vals = document.createElement('span');
      var f = s.filters[d.key];
      var isActiveNum = !!f;
      vals.className = 'filter-vals' + (isActiveNum ? ' is-active' : '');
      vals.textContent = isActiveNum ? fmtVal(d, f[0]) + ' – ' + fmtVal(d, f[1]) + ' ' + d.unit : '不限';

      var cell = document.createElement('span');
      cell.className = 'val-cell';
      cell.appendChild(vals);
      if (isActiveNum) {
        anyActive = true;
        var clr = document.createElement('button');
        clr.type = 'button'; clr.className = 'filter-clear';
        clr.textContent = '✕';
        clr.setAttribute('aria-label', '清除 ' + d.label + ' 过滤');
        clr.title = '清除 ' + d.label + ' 过滤';
        clr.addEventListener('click', function () { setRange(d.key, d.min, d.max); });
        cell.appendChild(clr);
      }
      row.appendChild(name); row.appendChild(lo); row.appendChild(hi); row.appendChild(cell);
      g.appendChild(row);

      if (f) { lo.value = f[0]; hi.value = f[1]; }
      lo.addEventListener('input', function () {
        var l2 = Math.min(parseFloat(lo.value), parseFloat(hi.value) - (d.key === 'gdp' ? 0.1 : 1));
        lo.value = l2;
        previewRange(d.key, l2, parseFloat(hi.value));
      });
      hi.addEventListener('input', function () {
        var h2 = Math.max(parseFloat(hi.value), parseFloat(lo.value) + (d.key === 'gdp' ? 0.1 : 1));
        hi.value = h2;
        previewRange(d.key, parseFloat(lo.value), h2);
      });
      lo.addEventListener('change', function () { commitRange(d.key); });
      hi.addEventListener('change', function () { commitRange(d.key); });
      filtersRoot.appendChild(g);
    });
  }

  /* 拖动中：实时预览（不产生轨迹步），change 时才提交归属 */
  var pendingRange = null;
  function previewRange(key, lo, hi) {
    pendingRange = [key, lo, hi];
    var s = cloneState(state);
    var d = DIMByKey[key];
    if (lo <= d.min && hi >= d.max) delete s.filters[key];
    else s.filters[key] = [lo, hi];
    renderDynamic(s);
    var vals = filtersRoot.querySelector('.filter-group[data-dim="' + key + '"] .filter-vals');
    if (vals) {
      var activeNow = !(lo <= d.min && hi >= d.max);
      vals.className = 'filter-vals' + (activeNow ? ' is-active' : '');
      vals.textContent = activeNow ? fmtVal(d, lo) + ' – ' + fmtVal(d, hi) + ' ' + d.unit : '不限';
    }
  }
  function commitRange(key) {
    if (!pendingRange || pendingRange[0] !== key) { pendingRange = null; return; }
    var d = DIMByKey[key];
    var lo = pendingRange[1], hi = pendingRange[2];
    pendingRange = null;
    setRange(key, lo, hi); // 全值域时自动记为「清除过滤」
  }

  /* ————— 轨迹面板 ————— */
  var trailRoot = $('trail');
  var KIND_NAMES = { init: '初始', projection: '投影', filter: '过滤', selection: '选择', color: '着色' };
  function buildTrail() {
    trailRoot.textContent = '';
    for (var i = 0; i < hist.length; i++) {
      (function (i) {
        var h = hist[i];
        var li = document.createElement('li');
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'trail-step' + (i === cur ? ' is-current' : '') + (i > cur ? ' is-future' : '');
        b.title = '回到该状态：' + h.label;
        if (i === cur) b.setAttribute('aria-current', 'step');
        var idx = document.createElement('span');
        idx.className = 'idx'; idx.textContent = i;
        var lbl = document.createElement('span');
        lbl.className = 'lbl'; lbl.textContent = h.label;
        var kind = document.createElement('span');
        kind.className = 'kind kind-' + h.kind;
        kind.textContent = KIND_NAMES[h.kind] || h.kind;
        b.appendChild(idx); b.appendChild(lbl); b.appendChild(kind);
        b.addEventListener('click', function () { jumpTo(i); });
        li.appendChild(b);
        trailRoot.appendChild(li);
      })(i);
    }
    var curEl = trailRoot.children[cur];
    if (curEl && curEl.scrollIntoView) curEl.scrollIntoView({ block: 'nearest' });
  }

  /* ————— 详情面板 ————— */
  var inspBody = $('inspector-body'), btnDeselect = $('btn-deselect');
  function buildInspector(s) {
    if (s.selection == null) {
      btnDeselect.hidden = true;
      inspBody.innerHTML = '<p class="insp-empty">尚未选中记录。点击散点，或用 Tab 聚焦画布后以方向键浏览、回车选中。</p>';
      return;
    }
    var r = RECORDS[s.selection];
    var hidden = !matches(r, s.filters);
    btnDeselect.hidden = false;
    var html = '<p class="insp-name">' + r.name + '</p>' +
      '<div class="insp-chips"><span class="insp-chip">' + r.region + '</span><span class="insp-chip">' + r.tier + '</span></div>' +
      (hidden ? '<p class="insp-hidden-badge">⚠ 该记录当前被过滤隐藏（选中状态已保留）</p>' : '');
    html += '<div class="insp-rows">';
    NUM_DIMS.forEach(function (d) {
      var frac = (r[d.key] - d.min) / (d.max - d.min);
      html += '<div class="insp-row"><span class="k">' + d.label + '</span>' +
        '<span class="v"><span class="insp-bar"><i style="width:' + (frac * 100).toFixed(1) + '%"></i></span>' +
        '<span class="insp-num">' + fmtVal(d, r[d.key]) + ' ' + d.unit + '</span></span></div>';
    });
    html += '</div>';
    inspBody.innerHTML = html;
  }

  /* ————— 头部与读出 ————— */
  var countMatched = $('count-matched'), countTotal = $('count-total'), srLive = $('sr-live');
  $('dataset-meta').textContent = D.name + ' · ' + RECORDS.length + ' 条记录 × ' + D.dimensions.length + ' 个维度 · ' +
    CAT_DIMS[0].values.length + ' 个区域（内联合成数据，加载即就绪）';
  countTotal.textContent = RECORDS.length;
  function announce(t) { srLive.textContent = t; }

  function renderHeader(s) {
    var n = visibleRecords(s).length;
    countMatched.textContent = n;
    $('btn-undo').disabled = cur <= 0;
    $('btn-redo').disabled = cur >= hist.length - 1;
    $('empty-overlay').hidden = n !== 0;
  }

  /* 控件回填（仅非拖拽时执行，避免打断滑块拖动） */
  function reflectControls(s) {
    if (selX.value !== s.projection.x) selX.value = s.projection.x;
    if (selY.value !== s.projection.y) selY.value = s.projection.y;
    if (selC.value !== s.colorBy) selC.value = s.colorBy;
  }

  /* 动态部分：预览时也刷新（画布 + 计数 + 详情） */
  function renderDynamic(s) {
    drawCanvas(s);
    renderHeader(s);
    buildInspector(s);
  }

  function renderAll(reflect) {
    if (reflect) { reflectControls(state); buildFilters(state); buildTrail(); }
    renderDynamic(state);
  }

  /* ————— 启动 ————— */
  if (window.ResizeObserver) {
    new ResizeObserver(function () { drawCanvas(); }).observe(wrap);
  }
  window.addEventListener('resize', function () { drawCanvas(); }); // 不能直接传 drawCanvas：resize 事件对象会被误当作预览视图
  renderAll(true);
  announce('数据集就绪：' + RECORDS.length + ' 条记录');

  /* 证据/调试句柄：只读状态指纹（真实浏览器验证用） */
  window.__APP__ = {
    ready: true,
    version: '1.0.0',
    fingerprint: function () {
      return JSON.stringify({
        x: state.projection.x, y: state.projection.y,
        filters: state.filters, colorBy: state.colorBy,
        selection: state.selection,
        cur: cur, len: hist.length,
        visible: visibleRecords(state).length
      });
    },
    histLabels: function () { return hist.map(function (h) { return h.kind + ':' + h.label; }); },
    /* 供证据驱动器计算真实鼠标点击坐标（只读） */
    pointFor: function (id) {
      var r = RECORDS[id];
      if (!r || !matches(r, state.filters)) return null;
      var dx = DIMByKey[state.projection.x], dy = DIMByKey[state.projection.y];
      var rect = canvas.getBoundingClientRect();
      return [rect.left + xScale(state)(r[dx.key]), rect.top + yScale(state)(r[dy.key])];
    },
    firstVisibleId: function () {
      var v = visibleRecords(state);
      return v.length ? v[Math.floor(v.length / 2)].id : null;
    }
  };
})();
