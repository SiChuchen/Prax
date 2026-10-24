/* EXO·LENS — 系外行星维度探索
 * app.js — 状态 store（lens/selection/projection，含撤销栈）+ 区域渲染器
 *
 * 区域（SDIR dimension_explorer_main）：lens_bar / dimension_rail /
 * projection_view（dominant）/ records_table / inspector / status_footer
 * 维度切换只重绘 projection_view（及表格取值），其余区域为定向不变量。
 */
(function () {
  'use strict';

  var DATA = window.DATA;
  var DIMS = DATA.dims;
  var RECORDS = DATA.records;
  var PALETTE = DATA.palette;

  // ---------- 基础工具 ----------
  function $(sel, root) { return (root || document).querySelector(sel); }
  function dim(id) { for (var i = 0; i < DIMS.length; i++) if (DIMS[i].id === id) return DIMS[i]; return null; }
  function catValues(d) { return d.values; }
  function catColor(d, v) { return PALETTE[d.values.indexOf(v) % PALETTE.length]; }

  function fmtNum(v, d) {
    if (typeof v !== 'number' || !isFinite(v)) return String(v);
    if (d && d.integer) return String(Math.round(v));
    var a = Math.abs(v);
    if (a >= 1000) return (v / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    if (a >= 100) return String(Math.round(v));
    if (a >= 10) return String(Math.round(v));
    if (a >= 1) return v.toFixed(1);
    return v.toFixed(2);
  }
  function shortLabel(d, v) { return (d.short && d.short[v]) ? d.short[v] : v; }
  function tOf(d, v) { return (d.scale === 'log') ? Math.log10(Math.max(v, 1e-6)) : v; }
  function tInv(d, t) { return (d.scale === 'log') ? Math.pow(10, t) : t; }

  // ---------- 状态（state_ownership 见 SDIR：query→lens_store，selection→selection_store，viewport→axis） ----------
  var INITIAL = { x: 'method', y: '__count', color: 'starType' };
  var state = {
    x: INITIAL.x, y: INITIAL.y, color: INITIAL.color,
    lens: [],            // {id, kind:'filter', dim, op:'in'|'range', values?, min?, max?, owner}
    selection: null,     // record id（跨维度保持）
    undoStack: [],       // 逆操作栈
    builderOpen: false,
    builderDraft: null,
    lastAction: '初始就绪',
    error: null
  };
  var filterSeq = 0;

  // ---------- 派生 ----------
  function activeFilters() { return state.lens; }
  function filtered() {
    var fs = activeFilters();
    if (!fs.length) return RECORDS;
    return RECORDS.filter(function (r) {
      for (var i = 0; i < fs.length; i++) {
        var f = fs[i];
        if (f.op === 'in') { if (f.values.indexOf(String(r[f.dim])) < 0) return false; }
        else { var v = r[f.dim]; if (v < f.min || v > f.max) return false; }
      }
      return true;
    });
  }
  function filterLabel(f) {
    var d = dim(f.dim);
    if (f.op === 'in') {
      var vs = f.values.map(function (v) { return shortLabel(d, v); }).join('·');
      return d.label + ' ∈ {' + vs + '}';
    }
    return d.label + ' ∈ [' + fmtNum(f.min, d) + ', ' + fmtNum(f.max, d) + ')';
  }

  // ---------- 动作 + 撤销（验收种子：过滤/投影状态有归属且可回退） ----------
  function pushUndo(inv) {
    state.undoStack.push(inv);
    if (state.undoStack.length > 60) state.undoStack.shift();
  }
  function applyInverse(inv) {
    if (inv.op === 'addFilter') state.lens.push(inv.entry);
    else if (inv.op === 'removeFilter') state.lens = state.lens.filter(function (f) { return f.id !== inv.entry.id; });
    else if (inv.op === 'setAxis') state[inv.axis] = inv.value;
    else if (inv.op === 'restore') {
      state.lens = inv.lens; state.x = inv.x; state.y = inv.y; state.color = inv.color;
    }
  }
  function undo() {
    if (!state.undoStack.length) return;
    var inv = state.undoStack.pop();
    applyInverse(inv);
    state.lastAction = '撤销 → ' + describeInverse(inv);
    renderAll();
  }
  function describeInverse(inv) {
    if (inv.op === 'addFilter') return '恢复过滤「' + filterLabel(inv.entry) + '」';
    if (inv.op === 'removeFilter') return '移除过滤「' + filterLabel(inv.entry) + '」';
    if (inv.op === 'setAxis') return '恢复 ' + axisLabel(inv.axis) + ' = ' + axisValueText(inv.axis, inv.value);
    return '恢复镜头快照';
  }
  function axisLabel(a) { return a === 'x' ? 'X 轴' : (a === 'y' ? 'Y 轴' : '颜色'); }
  function axisValueText(axis, id) {
    if (id === '__count') return '计数';
    if (id === '__none') return '无';
    var d = dim(id); return d ? d.label : id;
  }

  function addFilter(entry, owner) {
    entry.id = 'f' + (++filterSeq);
    entry.kind = 'filter';
    entry.owner = owner || '手动';
    state.lens.push(entry);
    pushUndo({ op: 'removeFilter', entry: entry });
    state.lastAction = '添加过滤「' + filterLabel(entry) + '」（来源：' + entry.owner + '）';
    renderAll();
  }
  function removeFilter(id) {
    var f = null;
    for (var i = 0; i < state.lens.length; i++) if (state.lens[i].id === id) f = state.lens[i];
    if (!f) return;
    state.lens = state.lens.filter(function (x) { return x.id !== id; });
    pushUndo({ op: 'addFilter', entry: f });
    state.lastAction = '移除过滤「' + filterLabel(f) + '」';
    renderAll();
  }
  function toggleValueFilter(dimId, v, owner) {
    var existing = null;
    for (var i = 0; i < state.lens.length; i++) {
      var f = state.lens[i];
      if (f.dim === dimId && f.op === 'in') { existing = f; break; }
    }
    if (existing) {
      var has = existing.values.indexOf(v) >= 0;
      var nextVals = has ? existing.values.filter(function (x) { return x !== v; })
                         : existing.values.concat([v]);
      if (!nextVals.length) { removeFilter(existing.id); return; }
      var upd = Object.assign({}, existing, { values: nextVals });
      state.lens = state.lens.map(function (f) { return f.id === existing.id ? upd : f; });
      pushUndo({ op: 'removeFilter', entry: existing });
      pushUndo({ op: 'addFilter', entry: upd });
      state.lastAction = (has ? '取消' : '加入') + '过滤值「' + v + '」（来源：' + owner + '）';
      renderAll();
    } else {
      addFilter({ dim: dimId, op: 'in', values: [v] }, owner);
    }
  }
  function toggleRangeFilter(dimId, min, max, owner) {
    var eps = 1e-9, existing = null;
    for (var i = 0; i < state.lens.length; i++) {
      var f = state.lens[i];
      if (f.dim === dimId && f.op === 'range' &&
          Math.abs(f.min - min) < eps && Math.abs(f.max - max) < eps) { existing = f; break; }
    }
    if (existing) removeFilter(existing.id);
    else addFilter({ dim: dimId, op: 'range', min: min, max: max }, owner);
  }
  function setAxis(axis, id) {
    if (state[axis] === id) return;
    var old = state[axis];
    state[axis] = id;
    pushUndo({ op: 'setAxis', axis: axis, value: old });
    state.lastAction = '切换 ' + axisLabel(axis) + ' → ' + axisValueText(axis, id) +
      '（选中 ' + (state.selection ? '保持' : '无') + ' · 过滤 ' + state.lens.length + ' 项保持）';
    renderAll();
  }
  function revertAxis(axis) {
    if (state[axis] === INITIAL[axis]) return;
    setAxis(axis, INITIAL[axis]);
  }
  function resetAll() {
    var snap = { op: 'restore', lens: state.lens, x: state.x, y: state.y, color: state.color };
    state.lens = [];
    state.x = INITIAL.x; state.y = INITIAL.y; state.color = INITIAL.color;
    pushUndo(snap);
    state.lastAction = '重置全部镜头（过滤 ' + snap.lens.length + ' 项已回退 · 投影已恢复默认）';
    renderAll();
  }
  function select(id) {
    state.selection = (state.selection === id) ? null : id;
    state.lastAction = state.selection ? '选中记录 ' + recordById(id).name : '取消选中';
    renderView(); renderTable(); renderInspector(); renderFooter();
  }
  function recordById(id) { for (var i = 0; i < RECORDS.length; i++) if (RECORDS[i].id === id) return RECORDS[i]; return null; }

  // ---------- DOM / SVG 助手 ----------
  var SVGNS = 'http://www.w3.org/2000/svg';
  function h(tag, attrs) {
    var isSvg = tag.indexOf('svg:') === 0;
    var el = isSvg ? document.createElementNS(SVGNS, tag.slice(4)) : document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (attrs[k] == null) return; // null/undefined → 不落属性（避免 "null" 串）
      if (k === 'class') el.setAttribute('class', attrs[k]);
      else if (k === 'text') el.textContent = attrs[k];
      else if (k.indexOf('on') === 0 && typeof attrs[k] === 'function') {
        el.addEventListener(k.slice(2).toLowerCase(), attrs[k]);
      } else el.setAttribute(k, attrs[k]);
    });
    for (var i = 2; i < arguments.length; i++) {
      var c = arguments[i];
      if (c == null) continue;
      if (Array.isArray(c)) c.forEach(function (x) { if (x) el.appendChild(x); });
      else el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return el;
  }
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  // ---------- 坐标（extent 固定 = 全量数据定义域 → 稳定锚点） ----------
  function ticks(d) { // 数值轴刻度（值空间）
    var lo = tOf(d, d.min), hi = tOf(d, d.max), out = [], step;
    if (d.scale === 'log') {
      for (var p = Math.ceil(lo); p <= Math.floor(hi); p++) out.push(Math.pow(10, p));
      if (!out.length) out = [d.min, d.max];
    } else {
      step = (hi - lo) / 5;
      var mag = Math.pow(10, Math.floor(Math.log10(step)));
      var nrm = step / mag;
      step = (nrm < 1.5 ? 1 : nrm < 3.5 ? 2 : nrm < 7.5 ? 5 : 10) * mag;
      var v0 = Math.ceil(lo / step) * step;
      for (var v = v0; v <= hi + 1e-9; v += step) out.push(+v.toPrecision(12));
    }
    return out;
  }

  // ---------- 渲染：镜头条（lens_bar） ----------
  function renderHead() {
    var root = $('#lensbar'); clear(root);
    var nAll = RECORDS.length, n = filtered().length;

    // 结果计数（归属的可见证据之一）
    root.appendChild(h('span', { class: 'count-pill' + (n === nAll ? '' : ' is-filtered'),
      text: '显示 ' + n + ' / ' + nAll }));

    // 过滤芯片
    var chips = h('div', { class: 'chips', role: 'list', 'aria-label': '活跃过滤' });
    if (!state.lens.length) chips.appendChild(h('span', { class: 'chip chip-empty', text: '无过滤 — 全部记录' }));
    state.lens.forEach(function (f) {
      var chip = h('span', { class: 'chip', role: 'listitem', title: '归属：' + f.owner + ' · 作用于「' + dim(f.dim).label + '」' },
        h('span', { class: 'chip-owner', text: f.owner }),
        h('span', { class: 'chip-label', text: filterLabel(f) }),
        h('button', { class: 'chip-x', 'aria-label': '移除过滤 ' + filterLabel(f), title: '移除（可撤销）',
          onclick: function () { removeFilter(f.id); } }, '×'));
      chips.appendChild(chip);
    });
    root.appendChild(chips);

    // 投影芯片（投影状态的归属与回退）
    var proj = h('div', { class: 'chips chips-proj', role: 'list', 'aria-label': '当前投影' });
    [['x', 'X'], ['y', 'Y'], ['color', '色']].forEach(function (p) {
      var axis = p[0], name = p[1], cur = state[axis];
      var isDefault = cur === INITIAL[axis];
      proj.appendChild(h('span', { class: 'chip chip-proj' + (isDefault ? ' chip-default' : '') },
        h('span', { class: 'chip-owner', text: name }),
        h('span', { class: 'chip-label', text: axisValueText(axis, cur) }),
        h('button', { class: 'chip-x' + (isDefault ? ' is-disabled' : ''),
          disabled: isDefault ? 'disabled' : null,
          'aria-label': '回退 ' + axisLabel(axis) + ' 到默认投影',
          title: isDefault ? '已是默认投影' : '回退到默认（' + axisValueText(axis, INITIAL[axis]) + '）',
          onclick: function () { revertAxis(axis); } }, '×')));
    });
    root.appendChild(proj);

    // 动作区
    var acts = h('div', { class: 'lens-actions' });
    acts.appendChild(h('button', { class: 'btn', onclick: function () { state.builderOpen = !state.builderOpen; if (!state.builderOpen) state.builderDraft = null; renderHead(); },
      'aria-expanded': state.builderOpen ? 'true' : 'false' }, state.builderOpen ? '收起' : '＋ 过滤'));
    var undoBtn = h('button', { class: 'btn' + (state.undoStack.length ? '' : ' btn-quiet'), onclick: undo,
      title: 'Ctrl+Z 撤销上一步镜头变更', 'aria-label': '撤销上一步镜头变更（Ctrl+Z）' },
      '撤销', h('span', { class: 'btn-badge', text: String(state.undoStack.length) }));
    if (!state.undoStack.length) undoBtn.setAttribute('disabled', 'disabled');
    acts.appendChild(undoBtn);
    acts.appendChild(h('button', { class: 'btn' + (state.lens.length || state.x !== INITIAL.x || state.y !== INITIAL.y || state.color !== INITIAL.color ? '' : ' btn-quiet'),
      onclick: resetAll, 'aria-label': '重置全部镜头' }, '重置镜头'));
    root.appendChild(acts);

    // 内联过滤构建器（紧凑表单，不弹模态）
    if (state.builderOpen) root.appendChild(renderBuilder());
  }

  function renderBuilder() {
    var draft = state.builderDraft || (state.builderDraft = { dim: 'radius', values: {}, min: '', max: '' });
    var d = dim(draft.dim);
    var box = h('div', { class: 'builder', role: 'group', 'aria-label': '新建过滤' });
    var sel = h('select', { class: 'sel', 'aria-label': '过滤维度', onchange: function (e) { draft.dim = e.target.value; draft.values = {}; draft.min = ''; draft.max = ''; renderHead(); } });
    DIMS.forEach(function (dd) { if (dd.type !== 'id') sel.appendChild(h('option', { value: dd.id, selected: dd.id === draft.dim ? 'selected' : null }, dd.label + '（' + (dd.type === 'cat' ? '分类' : '数值') + '）')); });
    box.appendChild(h('label', { class: 'fld' }, h('span', { class: 'fld-k', text: '维度' }), sel));

    if (d.type === 'cat') {
      var vg = h('div', { class: 'valgrid' });
      catValues(d).forEach(function (v) {
        var on = !!draft.values[v];
        vg.appendChild(h('button', { class: 'val' + (on ? ' is-on' : ''), style: on ? 'border-color:' + catColor(d, v) : null,
          onclick: function () { draft.values[v] = !draft.values[v]; renderHead(); } },
          h('i', { class: 'sw', style: 'background:' + catColor(d, v) }), v));
      });
      box.appendChild(h('div', { class: 'fld' }, h('span', { class: 'fld-k', text: '包含值' }), vg));
    } else {
      var mk = function (key, ph) {
        return h('input', { class: 'inp', type: 'number', placeholder: ph, value: draft[key],
          'aria-label': key === 'min' ? '最小值' : '最大值',
          oninput: function (e) { draft[key] = e.target.value; } });
      };
      box.appendChild(h('div', { class: 'fld fld-row' }, h('span', { class: 'fld-k', text: '范围（' + d.unit + '）' }),
        mk('min', String(d.min)), h('span', { class: 'fld-sep', text: '—' }), mk('max', String(d.max))));
    }
    box.appendChild(h('div', { class: 'builder-actions' },
      h('button', { class: 'btn btn-accent', onclick: function () {
        if (d.type === 'cat') {
          var vs = catValues(d).filter(function (v) { return draft.values[v]; });
          if (vs.length && vs.length < catValues(d).length) addFilter({ dim: d.id, op: 'in', values: vs }, '手动');
        } else {
          var lo = draft.min === '' ? d.min : +draft.min, hi = draft.max === '' ? d.max : +draft.max;
          if (isFinite(lo) && isFinite(hi) && lo <= hi) addFilter({ dim: d.id, op: 'range', min: lo, max: hi }, '手动');
        }
        state.builderOpen = false; state.builderDraft = null; renderAll();
      } }, '应用过滤'),
      h('button', { class: 'btn btn-quiet', onclick: function () { state.builderOpen = false; state.builderDraft = null; renderHead(); } }, '取消')));
    return box;
  }

  // ---------- 渲染：维度栏（dimension_rail） ----------
  function renderRail() {
    var root = $('#rail'); clear(root);
    var groups = [
      { axis: 'x', title: 'X 轴维度', dims: DIMS.filter(function (d) { return d.type !== 'id'; }) },
      { axis: 'y', title: 'Y 轴维度', dims: [{ id: '__count', label: '计数', type: 'count' }].concat(DIMS.filter(function (d) { return d.type === 'num'; })) },
      { axis: 'color', title: '颜色维度', dims: [{ id: '__none', label: '无', type: 'none' }].concat(DIMS.filter(function (d) { return d.type === 'cat'; })) }
    ];
    groups.forEach(function (g) {
      var sec = h('section', { class: 'rail-sec', 'aria-label': g.title });
      sec.appendChild(h('h3', { class: 'rail-h', text: g.title }));
      g.dims.forEach(function (d) {
        var active = state[g.axis] === d.id;
        sec.appendChild(h('button', { class: 'dim' + (active ? ' is-active' : ''),
          'aria-pressed': active ? 'true' : 'false',
          onclick: function () { setAxis(g.axis, d.id); } },
          h('span', { class: 'dim-type', text: d.type === 'cat' ? '▪' : (d.type === 'num' ? '▤' : '○') }),
          h('span', { class: 'dim-label', text: d.label }),
          d.type === 'cat' && d.values ? h('span', { class: 'dim-meta', text: String(d.values.length) + ' 值' }) : null,
          d.type === 'num' ? h('span', { class: 'dim-meta', text: fmtNum(d.min, d) + '–' + fmtNum(d.max, d) + (d.unit ? ' ' + d.unit : '') }) : null));
      });
      root.appendChild(sec);
    });
    // 当前 X 摘要（稳定上下文）
    var xd = dim(state.x);
    var sum = h('section', { class: 'rail-sum', 'aria-label': '当前投影摘要' },
      h('h3', { class: 'rail-h', text: '投影摘要' }),
      h('div', { class: 'sum-row' }, h('span', { text: 'X' }), h('b', { text: xd.label + (xd.type === 'num' ? '（' + (xd.scale === 'log' ? '对数' : '线性') + '）' : '') })),
      h('div', { class: 'sum-row' }, h('span', { text: 'Y' }), h('b', { text: axisValueText('y', state.y) })),
      h('div', { class: 'sum-row' }, h('span', { text: '颜色' }), h('b', { text: axisValueText('color', state.color) })));
    root.appendChild(sum);
  }

  // ---------- 渲染：投影视图（projection_view，dominant） ----------
  var CH = { W: 940, H: 470, L: 66, R: 18, T: 34, B: 48 };
  function renderView() {
    var root = $('#view-body'); clear(root);
    var legend = $('#view-legend'); clear(legend);
    var rows = filtered();
    var xd = dim(state.x), yd = state.y === '__count' ? null : dim(state.y), cd = state.color === '__none' ? null : dim(state.color);

    // 图例（颜色维度取值，可点击过滤——归属：图例）
    if (cd && cd.id !== state.x) {
      cd.values.forEach(function (v) {
        var f = null;
        state.lens.forEach(function (x) { if (x.dim === cd.id && x.op === 'in' && x.values.indexOf(v) >= 0) f = x; });
        legend.appendChild(h('button', { class: 'lg' + (f ? ' is-off' : ''), title: '点击' + (f ? '取消过滤' : '过滤') + '「' + v + '」（来源：图例）',
          onclick: function () { toggleValueFilter(cd.id, v, '图例'); } },
          h('i', { class: 'sw', style: 'background:' + catColor(cd, v) }), shortLabel(cd, v)));
      });
    }

    // 视图副标题（当前模式描述）
    var mode = (yd && xd.type === 'num')
      ? '散点 · ' + xd.label + ' × ' + yd.label
      : '分布 · 计数 × ' + xd.label + (yd ? '（Y 仅在 X 为数值维度时生效，当前按计数聚合）' : '');
    $('#view-mode').textContent = mode;

    if (!rows.length) { // empty 状态
      root.appendChild(h('div', { class: 'view-empty' },
        h('p', { text: '当前镜头下无记录 — ' + state.lens.length + ' 项过滤互相冲突。' }),
        h('button', { class: 'btn btn-accent', onclick: resetAll }, '重置镜头')));
      return;
    }

    var svg = h('svg:svg', { class: 'chart', viewBox: '0 0 ' + CH.W + ' ' + CH.H, role: 'img',
      'aria-label': mode + '；共 ' + rows.length + ' 条记录' + (state.selection ? '；已选中 1 条' : '') });
    var iw = CH.W - CH.L - CH.R, ih = CH.H - CH.T - CH.B;

    // 网格 + Y 轴
    var yMax, yTicks;
    if (yd) { yTicks = ticks(yd); yMax = tOf(yd, yd.max); }
    else { yMax = Math.max(4, Math.ceil(maxCount(rows, xd, cd) * 1.12)); yTicks = niceCounts(yMax); }

    yTicks.forEach(function (tv) {
      var t = yd ? tOf(yd, tv) : tv;
      if (t > yMax + 1e-9) return;
      var y = CH.T + ih - (t / yMax) * ih;
      svg.appendChild(h('svg:line', { x1: CH.L, y1: y, x2: CH.W - CH.R, y2: y, class: 'gridline' }));
      svg.appendChild(h('svg:text', { x: CH.L - 8, y: y + 4, class: 'tick', 'text-anchor': 'end', text: yd ? fmtNum(tv, yd) : String(tv) }));
    });

    if (yd && xd.type === 'num') renderScatter(svg, rows, xd, yd, cd, iw, ih, yMax);
    else if (xd.type === 'num') renderHist(svg, rows, xd, cd, iw, ih, yMax);
    else renderBars(svg, rows, xd, cd, iw, ih, yMax);

    root.appendChild(svg);
  }

  function maxCount(rows, xd, cd) {
    if (xd.type === 'num') {
      var lo = tOf(xd, xd.min), hi = tOf(xd, xd.max), NB = 28, m = 0, bins = {};
      rows.forEach(function (r) {
        var bi = binIndex(xd, r[xd.id], lo, hi, NB); bins[bi] = (bins[bi] || 0) + 1;
      });
      Object.keys(bins).forEach(function (k) { m = Math.max(m, bins[k]); });
      return m;
    }
    var m = 0;
    xd.values.forEach(function (v) {
      var c = 0; rows.forEach(function (r) { if (String(r[xd.id]) === v) c++; }); m = Math.max(m, c);
    });
    return m;
  }
  function niceCounts(max) {
    var step = max <= 8 ? 1 : max <= 20 ? 5 : max <= 60 ? 10 : max <= 150 ? 25 : max <= 400 ? 50 : 100;
    var out = []; for (var v = 0; v <= max; v += step) out.push(v); return out;
  }
  function binIndex(d, v, lo, hi, NB) {
    var t = tOf(d, v);
    return Math.min(NB - 1, Math.max(0, Math.floor((t - lo) / (hi - lo) * NB)));
  }

  function binEdges(d, NB) { // 值空间边界（用于刷选过滤的归属）
    var lo = tOf(d, d.min), hi = tOf(d, d.max), edges = [];
    for (var i = 0; i <= NB; i++) edges.push(tInv(d, lo + (hi - lo) * i / NB));
    return edges;
  }

  function renderHist(svg, rows, xd, cd, iw, ih, yMax) {
    var NB = 28, lo = tOf(xd, xd.min), hi = tOf(xd, xd.max);
    var edges = binEdges(xd, NB);
    var colorVals = cd && cd.id !== xd.id ? cd.values : null;
    // 聚积
    var bins = []; for (var i = 0; i < NB; i++) bins.push(colorVals ? {} : 0);
    rows.forEach(function (r) {
      var bi = binIndex(xd, r[xd.id], lo, hi, NB);
      if (colorVals) { var cv = String(r[cd.id]); bins[bi][cv] = (bins[bi][cv] || 0) + 1; }
      else bins[bi]++;
    });
    var bw = iw / NB;
    for (let b = 0; b < NB; b++) { // let：click 闭包按迭代捕获
      var total = colorVals ? Object.keys(bins[b]).reduce(function (s, k) { return s + bins[b][k]; }, 0) : bins[b];
      if (!total) continue;
      var x = CH.L + b * bw, acc = 0;
      var parts = colorVals ? colorVals.filter(function (v) { return bins[b][v]; }) : [null];
      parts.forEach(function (v) {
        var c = v ? bins[b][v] : total;
        var y0 = CH.T + ih - ((acc + c) / yMax) * ih, hh = (c / yMax) * ih;
        acc += c;
        var fill = v ? catColor(cd, v) : 'var(--bar)';
        svg.appendChild(h('svg:rect', { x: x + 0.75, y: y0, width: Math.max(1, bw - 1.5), height: Math.max(1, hh),
          fill: fill, class: 'seg' }));
      });
      // 刷选命中区（键盘可操作按钮；<title> 作为其子节点提供悬停提示）
      var lbl = fmtNum(edges[b], xd) + '–' + fmtNum(edges[b + 1], xd) + (xd.unit ? ' ' + xd.unit : '') + ' · ' + total + ' 条';
      var hit = h('svg:rect', { x: x, y: CH.T, width: bw, height: ih, class: 'hit', tabindex: 0, role: 'button',
        'aria-label': '过滤 ' + xd.label + ' ' + lbl, onclick: function () { toggleRangeFilter(xd.id, edges[b], edges[b + 1], '图表'); } });
      attachKey(hit, function () { toggleRangeFilter(xd.id, edges[b], edges[b + 1], '图表'); });
      hit.appendChild(h('svg:title', { text: lbl }));
      svg.appendChild(hit);
    }
    axisXNum(svg, xd, iw, ih, ticks(xd));
    markSelectedBin(svg, xd, lo, hi, NB, iw, ih);
  }

  function renderBars(svg, rows, xd, cd, iw, ih, yMax) {
    var colorVals = cd && cd.id !== xd.id ? cd.values : null;
    var n = xd.values.length, band = iw / n, bw = Math.min(band * 0.66, 96);
    xd.values.forEach(function (v, i) {
      var subset = rows.filter(function (r) { return String(r[xd.id]) === v; });
      var total = subset.length;
      var x = CH.L + i * band + (band - bw) / 2;
      var yTop = CH.T + ih - (total / yMax) * ih;
      if (total) {
        var parts = colorVals ? colorVals.filter(function (cv) { return subset.some(function (r) { return String(r[cd.id]) === cv; }); }) : [null];
        var acc = 0;
        parts.forEach(function (cv) {
          var c = cv ? subset.filter(function (r) { return String(r[cd.id]) === cv; }).length : total;
          var y0 = CH.T + ih - ((acc + c) / yMax) * ih, hh = (c / yMax) * ih; acc += c;
          svg.appendChild(h('svg:rect', { x: x, y: y0, width: bw, height: Math.max(1, hh),
            fill: cv ? catColor(cd, cv) : 'var(--bar)', class: 'seg' }));
        });
      }
      // 轴标签（短标签）+ 刷选按钮
      var lbl = v + ' · ' + total + ' 条';
      svg.appendChild(h('svg:text', { x: x + bw / 2, y: CH.T + ih + 18, class: 'tick', 'text-anchor': 'middle', text: shortLabel(xd, v) }));
      var hit = h('svg:rect', { x: CH.L + i * band, y: CH.T, width: band, height: ih + 24, class: 'hit', tabindex: 0, role: 'button',
        'aria-label': '过滤 ' + xd.label + ' = ' + v + '（' + total + ' 条）',
        onclick: function () { toggleValueFilter(xd.id, v, '图表'); } });
      attachKey(hit, function () { toggleValueFilter(xd.id, v, '图表'); });
      hit.appendChild(h('svg:title', { text: lbl }));
      svg.appendChild(hit);
    });
    markSelectedBin(svg, xd, null, null, n, iw, ih);
  }

  function renderScatter(svg, rows, xd, yd, cd, iw, ih, yMax) {
    var xLo = tOf(xd, xd.min), xHi = tOf(xd, xd.max);
    var sel = state.selection ? recordById(state.selection) : null;
    var pts = rows.map(function (r) {
      return {
        r: r,
        px: CH.L + (tOf(xd, r[xd.id]) - xLo) / (xHi - xLo) * iw,
        py: CH.T + ih - (tOf(yd, r[yd.id]) / yMax) * ih
      };
    });
    // 第一遍：24px 透明命中圆（target size ≥24；键盘路径 = 记录表 + 选中点）
    pts.forEach(function (p) {
      var isSel = sel && p.r.id === sel.id;
      var hit = h('svg:circle', { cx: p.px, cy: p.py, r: 12, class: 'pt-hit', role: 'button',
        tabindex: isSel ? 0 : null,
        'aria-label': (isSel ? '已选中 ' : '选中 ') + p.r.name,
        onclick: function (e) { e.stopPropagation(); select(p.r.id); } });
      if (isSel) attachKey(hit, function () { select(p.r.id); });
      hit.appendChild(h('svg:title', { text: p.r.name + '\n' + xd.label + ' ' + fmtNum(p.r[xd.id], xd) + ' ' + xd.unit + ' · ' + yd.label + ' ' + fmtNum(p.r[yd.id], yd) + ' ' + yd.unit }));
      svg.appendChild(hit);
    });
    // 第二遍：可视点（纯表现层，pointer-events:none，选中高亮）
    pts.forEach(function (p) {
      var isSel = sel && p.r.id === sel.id;
      svg.appendChild(h('svg:circle', { cx: p.px, cy: p.py, r: isSel ? 5.5 : 3.2,
        fill: cd ? catColor(cd, String(p.r[cd.id])) : 'var(--bar)',
        class: 'pt' + (isSel ? ' is-sel' : ''), 'aria-hidden': 'true' }));
    });
    // 选中十字参考线：把选中锚定到坐标系（切换维度后仍在）
    if (sel) {
      var px = CH.L + (tOf(xd, sel[xd.id]) - xLo) / (xHi - xLo) * iw;
      var py = CH.T + ih - (tOf(yd, sel[yd.id]) / yMax) * ih;
      svg.appendChild(h('svg:line', { x1: px, y1: py, x2: px, y2: CH.T + ih, class: 'guide' }));
      svg.appendChild(h('svg:line', { x1: CH.L, y1: py, x2: px, y2: py, class: 'guide' }));
      svg.appendChild(h('svg:text', { x: px, y: CH.T + ih + 32, class: 'tick tick-sel', 'text-anchor': 'middle', text: fmtNum(sel[xd.id], xd) + ' ' + xd.unit }));
      svg.appendChild(h('svg:text', { x: CH.L - 8, y: py + 4, class: 'tick tick-sel', 'text-anchor': 'end', text: fmtNum(sel[yd.id], yd) }));
      svg.appendChild(h('svg:circle', { cx: px, cy: py, r: 9, class: 'sel-ring' }));
    }
    axisXNum(svg, xd, iw, ih, ticks(xd));
  }

  function axisXNum(svg, xd, iw, ih, tks) {
    var lo = tOf(xd, xd.min), hi = tOf(xd, xd.max);
    tks.forEach(function (v) {
      var t = tOf(xd, v); if (t < lo - 1e-9 || t > hi + 1e-9) return;
      var x = CH.L + (t - lo) / (hi - lo) * iw;
      svg.appendChild(h('svg:line', { x1: x, y1: CH.T + ih, x2: x, y2: CH.T + ih + 5, class: 'axisline' }));
      svg.appendChild(h('svg:text', { x: x, y: CH.T + ih + 18, class: 'tick', 'text-anchor': 'middle', text: fmtNum(v, xd) }));
    });
    svg.appendChild(h('svg:text', { x: CH.L + iw / 2, y: CH.H - 6, class: 'axname', 'text-anchor': 'middle',
      text: xd.label + (xd.unit ? '（' + xd.unit + (xd.scale === 'log' ? '，对数轴' : '') + '）' : '') }));
  }

  function markSelectedBin(svg, xd, lo, hi, NB, iw, ih) {
    var sel = state.selection ? recordById(state.selection) : null;
    if (!sel) return;
    var v = sel[xd.id];
    var i = (xd.type === 'num') ? binIndex(xd, v, tOf(xd, xd.min), tOf(xd, xd.max), NB)
                                : xd.values.indexOf(String(v));
    if (i < 0) return;
    var bw = iw / NB;
    var selText = (xd.type === 'num')
      ? fmtNum(v, xd) + (xd.unit ? ' ' + xd.unit : '')
      : shortLabel(xd, String(v));
    svg.appendChild(h('svg:rect', { x: CH.L + i * bw + 1, y: CH.T, width: bw - 2, height: ih, class: 'sel-band' }));
    svg.appendChild(h('svg:text', { x: CH.L + i * bw + bw / 2, y: CH.T - 12, class: 'tick tick-sel', 'text-anchor': 'middle',
      text: '选中：' + sel.name + '（' + selText + '）' }));
  }

  function attachKey(node, fn) {
    node.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); }
    });
  }

  // ---------- 渲染：记录表（records_table） ----------
  function renderTable() {
    var root = $('#table-body'); clear(root);
    var rows = filtered().slice();
    var xd = dim(state.x);
    rows.sort(function (a, b) {
      if (xd.type === 'num') return b[xd.id] - a[xd.id];
      return String(a[xd.id]).localeCompare(String(b[xd.id]), 'zh');
    });
    $('#table-count').textContent = 'Top ' + Math.min(rows.length, 80) + ' / ' + rows.length + '（按 ' + xd.label + ' 排序）';
    rows.slice(0, 80).forEach(function (r) {
      var isSel = state.selection === r.id;
      var tr = h('tr', { class: isSel ? 'is-sel' : '', 'data-id': r.id, 'aria-selected': isSel ? 'true' : 'false' });
      tr.appendChild(h('td', null, h('button', { class: 'rowbtn', 'aria-label': '选中 ' + r.name,
        onclick: function () { select(r.id); } }, r.name)));
      tr.appendChild(h('td', { class: 'num' }, String(xd.type === 'num' ? fmtNum(r[xd.id], xd) : shortLabel(xd, String(r[xd.id])))));
      tr.appendChild(h('td', { class: 'num' }, fmtNum(r.mass, dim('mass'))));
      tr.appendChild(h('td', { class: 'num' }, fmtNum(r.distance, dim('distance'))));
      tr.appendChild(h('td', { class: 'num' }, String(r.year)));
      tr.addEventListener('click', function (e) { if (e.target.tagName !== 'BUTTON') select(r.id); });
      root.appendChild(tr);
    });
    if (!rows.length) root.appendChild(h('tr', { class: 'empty-row' }, h('td', { colspan: '5', text: '无匹配记录' })));
  }

  // ---------- 渲染：检查器（inspector，选中驱动） ----------
  function renderInspector() {
    var root = $('#inspector'); clear(root);
    var rec = state.selection ? recordById(state.selection) : null;
    if (!rec) {
      root.appendChild(h('div', { class: 'insp-empty' },
        h('h3', { text: '未选中记录' }),
        h('p', { text: '点击散点或记录表中的行以选中。选中与维度无关——切换 X/Y/颜色后保持不变。' })));
      return;
    }
    var cd = state.color === '__none' ? null : dim(state.color);
    root.appendChild(h('div', { class: 'insp-id' },
      h('span', { class: 'insp-badge', text: '已选中' }),
      h('h3', { class: 'insp-name', text: rec.name }),
      cd ? h('span', { class: 'sw-big', style: 'background:' + catColor(cd, String(rec[cd.id])) }) : null));

    var groups = [
      { title: '身份与背景', dims: ['method', 'starType', 'systemSize', 'starTemp', 'distance', 'year'] },
      { title: '物理量', dims: ['radius', 'mass', 'period'] }
    ];
    groups.forEach(function (g) {
      var sec = h('section', { class: 'insp-sec' }, h('h4', { class: 'insp-h', text: g.title }));
      g.dims.forEach(function (id) {
        var d = dim(id), v = rec[id];
        var valEl = (d.type === 'cat')
          ? h('span', { class: 'insp-val' }, h('i', { class: 'sw', style: 'background:' + catColor(d, String(v)) }), String(v))
          : h('span', { class: 'insp-val', text: fmtNum(v, d) + ' ' + d.unit });
        var row = h('div', { class: 'insp-row' }, h('span', { class: 'insp-k', text: d.label }), valEl);
        if (d.type === 'num') { // 值在固定定义域中的位置（跨维度恒定的认知锚）
          var t = (tOf(d, v) - tOf(d, d.min)) / (tOf(d, d.max) - tOf(d, d.min)) * 100;
          row.appendChild(h('span', { class: 'track' }, h('i', { class: 'dot', style: 'left:' + Math.min(98, Math.max(0, t)) + '%' })));
        }
        sec.appendChild(row);
      });
      root.appendChild(sec);
    });
    root.appendChild(h('p', { class: 'insp-note', text: '身份卡不随维度切换重排 — 这就是「不重置认知」。' }));
  }

  // ---------- 渲染：页脚（status_footer） ----------
  function renderFooter() {
    var nAll = RECORDS.length, n = filtered().length;
    $('#foot-count').textContent = '显示 ' + n + ' / ' + nAll + ' 条记录';
    $('#foot-lens').textContent = '过滤 ' + state.lens.length + ' 项 · 撤销栈 ' + state.undoStack.length + ' 步';
    $('#foot-last').textContent = '最近操作：' + state.lastAction;
  }

  function renderAll() {
    renderHead(); renderRail(); renderView(); renderTable(); renderInspector(); renderFooter();
  }

  // ---------- 初始化 ----------
  function init() {
    var app = $('#app');
    app.appendChild(h('div', { class: 'grid' },
      h('header', { class: 'brand', id: 'brand', 'aria-label': '应用标识' },
        h('h1', { text: 'EXO·LENS' }),
        h('p', { class: 'brand-sub', text: '系外行星维度探索 — ' + RECORDS.length + ' 条记录 · 10 个维度 · 本地数据集' })),
      h('div', { class: 'lensbar', id: 'lensbar', role: 'region', 'aria-label': 'lens_bar 当前镜头' }),
      h('nav', { class: 'rail', id: 'rail', role: 'region', 'aria-label': 'dimension_rail 维度切换栏' }),
      h('main', { class: 'view', id: 'view', role: 'region', 'aria-label': 'projection_view 投影主视图' },
        h('div', { class: 'view-head' },
          h('span', { id: 'view-mode', class: 'view-mode' }),
          h('div', { id: 'view-legend', class: 'legend', role: 'group', 'aria-label': '颜色维度图例' })),
        h('div', { class: 'view-body', id: 'view-body' })),
      h('aside', { class: 'inspector', id: 'inspector', role: 'region', 'aria-label': 'inspector 选中检查器' }),
      h('section', { class: 'tablepane', id: 'tablepane', role: 'region', 'aria-label': 'records_table 记录表' },
        h('div', { class: 'table-head' },
          h('h3', { text: '记录' }), h('span', { id: 'table-count', class: 'table-count' })),
        h('div', { class: 'table-scroll' },
          h('table', { class: 'tbl' },
            h('thead', null, h('tr', null,
              h('th', { text: '名称' }), h('th', { id: 'th-x', text: 'X' }),
              h('th', { text: '质量 M⊕' }), h('th', { text: '距离 光年' }), h('th', { text: '年份' }))),
            h('tbody', { id: 'table-body' })))),
      h('footer', { class: 'foot', id: 'foot', role: 'region', 'aria-label': 'status_footer 状态栏' },
        h('span', { id: 'foot-count' }), h('span', { id: 'foot-lens' }),
        h('span', { id: 'foot-last', class: 'foot-last' }),
        h('span', { id: 'foot-state', class: 'foot-state', text: '状态：就绪（无加载态 — 数据随首屏就绪）' }))));

    // 维度切换只影响表格列头 — 与视图联动但不动其他区域
    var thX = $('#th-x');

    document.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) { e.preventDefault(); undo(); }
    });
    window.addEventListener('error', function (e) {
      state.error = e.message || '渲染异常';
      $('#foot-state').textContent = '状态：错误 — ' + state.error;
      $('#foot-state').classList.add('is-error');
    });

    // X 列头动态化
    var observer = new MutationObserver(function () {
      var xd = dim(state.x); thX.textContent = 'X · ' + xd.label + (xd.unit ? ' ' + xd.unit : '');
    });
    observer.observe($('#table-body'), { childList: true });

    renderAll();
    runJourney();
  }

  // ---------- 证据采集 harness（仅当 URL 带 #journey=<step> 时触发） ----------
  // 依次调用与 UI 事件完全相同的动作函数（同一管线，非旁路），供自动化截图取证。
  function runJourney() {
    var m = location.hash.match(/journey=([a-z]+)/);
    if (!m) return;
    var step = m[1];
    var pick = null;
    for (var i = 0; i < RECORDS.length; i++) {
      if (RECORDS[i].method === '凌星法' && RECORDS[i].starType === 'M' && RECORDS[i].radius < 2) { pick = RECORDS[i]; break; }
    }
    var base = function () {
      if (pick) select(pick.id);                                   // 选中一条记录
      toggleValueFilter('method', '凌星法', '图表');               // 图表刷选 → 过滤芯片
    };
    var seq = {
      selected:  base,
      filtered:  base,
      dimswitch: function () { base(); setAxis('x', 'radius'); },  // 核心证据：换维度后选中/过滤保留
      undone:    function () { base(); setAxis('x', 'radius'); undo(); },
      reset:     function () { base(); setAxis('x', 'radius'); resetAll(); },
      focus:     function () {
        var b = document.querySelectorAll('#rail .dim')[3];
        if (b) b.focus();
      }
    };
    (seq[step] || function () {})();
  }

  // 供证据脚本检查的只读钩子
  window.App = {
    get state() { return state; },
    actions: { setAxis: setAxis, addFilter: addFilter, removeFilter: removeFilter, select: select,
      resetAll: resetAll, undo: undo, toggleValueFilter: toggleValueFilter, toggleRangeFilter: toggleRangeFilter },
    filteredCount: function () { return filtered().length; }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
