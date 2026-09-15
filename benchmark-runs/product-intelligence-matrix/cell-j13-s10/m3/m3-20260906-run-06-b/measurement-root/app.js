/* ============ Prism 多维探索台 ============
 * 状态架构（对应 design_decisions MC-1/MC-2）：
 *  - query 层（过滤 + 投影）是唯一事实源，过滤按维度归属、与投影正交；
 *    切换投影永不触碰过滤器（维度切换不重置认知）。
 *  - 每次过滤/投影变更 = 一条带 id 的状态条目（kind / dim / origin），
 *    托盘逐条可见、逐条可回退；另有撤销栈（Ctrl+Z）与全部重置。
 *  - selection 层由记录表拥有，跨投影保持（H-21 Orientation Invariants）。
 */
(function () {
  'use strict';

  var DS = window.PRISM_DATASET;
  var DIMS = DS.dimensions;
  var RECORDS = DS.records;
  var MEASURES = DS.measures;
  var dimById = {};
  DIMS.forEach(function (d) { dimById[d.id] = d; });
  var DEFAULT_PROJECTION = { primary: 'region', breakdown: null };
  var PALETTE = ['#4F6BED', '#E4572E', '#2CA58D', '#B27CDA', '#D9A404', '#3AA6B9', '#D46A9C', '#7A8B99'];
  var TABLE_CAP = 60;

  /* ---------- query store ---------- */
  var store = {
    filters: [],                       // [{id, dim, valueIdx, origin, at}]
    projection: { primary: 'region', breakdown: null },
    projOrigin: '初始默认',            // 当前投影的来源（归属）
    breakdownOrigin: null,
    projHistory: [],                   // [{primary, breakdown}] —— 投影条目 × 的回退目标
    selectedId: null,                  // selection：跨投影保持
    sort: { key: 'revenue', dir: -1 }, // 视图偏好（非 query，不入撤销栈）
    measure: 'revenue',
    expanded: { region: true },
    undoStack: [], redoStack: []
  };

  var _uid = 1;
  function uid() { return 'st-' + (_uid++); }
  function dimIdx(rec, dim) { return dim.kind === 'numeric' ? rec._revBin : rec[dim.id]; }
  function dimVal(rec, dim) { return dim.values[dimIdx(rec, dim)]; }

  /* ---------- 聚合与过滤 ---------- */
  function filterGroups(excludeDim) {
    var g = {};
    store.filters.forEach(function (f) {
      if (f.dim === excludeDim) return;
      (g[f.dim] = g[f.dim] || []).push(f.valueIdx);
    });
    return g;
  }
  function passFilters(rec, groups) {
    for (var dimId in groups) {
      if (groups[dimId].indexOf(dimIdx(rec, dimById[dimId])) === -1) return false;
    }
    return true;
  }
  function matched() {
    var g = filterGroups(null), out = [];
    for (var i = 0; i < RECORDS.length; i++) if (passFilters(RECORDS[i], g)) out.push(RECORDS[i]);
    return out;
  }
  function aggregate(recs, measureId, excludeDim) {
    // 分布图：排除主维度自身的过滤（标准 cross-filter），其余维度过滤计入
    var g = filterGroups(excludeDim), sum = 0, n = 0;
    for (var i = 0; i < recs.length; i++) {
      if (!passFilters(recs[i], g)) continue;
      n++;
      sum += recs[i][measureId === 'margin' ? 'margin' : measureId];
    }
    return { value: measureId === 'margin' && n ? sum / n : sum, count: n };
  }

  /* ---------- 命令式变更（每步可撤销，状态有归属） ---------- */
  function commit(op) {
    op.do();
    store.redoStack.length = 0;
    store.undoStack.push(op);
    renderAll();
  }
  function undo() {
    var op = store.undoStack.pop();
    if (!op) return;
    op.undo();
    store.redoStack.push(op);
    renderAll();
  }
  function redo() {
    var op = store.redoStack.pop();
    if (!op) return;
    op.do();
    store.undoStack.push(op);
    renderAll();
  }

  function makeAddFilter(dimId, valueIdx, origin) {
    var exists = store.filters.some(function (f) { return f.dim === dimId && f.valueIdx === valueIdx; });
    if (exists) return null;
    var entry = { id: uid(), kind: 'filter', dim: dimId, valueIdx: valueIdx, origin: origin, at: Date.now() };
    return {
      describe: '过滤 ' + dimById[dimId].name + '＝' + dimById[dimId].values[valueIdx],
      do: function () { store.filters.push(entry); },
      undo: function () { store.filters = store.filters.filter(function (f) { return f.id !== entry.id; }); }
    };
  }
  function makeRemoveFilter(fid) {
    var entry = store.filters.filter(function (f) { return f.id === fid; })[0];
    if (!entry) return null;
    return {
      describe: '回退 ' + dimById[entry.dim].name + '＝' + dimById[entry.dim].values[entry.valueIdx],
      do: function () { store.filters = store.filters.filter(function (f) { return f.id !== fid; }); },
      undo: function () { store.filters.push(entry); }
    };
  }
  function makeSetProjection(dimId, origin) {
    var prev = { primary: store.projection.primary, breakdown: store.projection.breakdown, projOrigin: store.projOrigin, breakdownOrigin: store.breakdownOrigin };
    var next = { primary: dimId, breakdown: prev.breakdown === dimId ? null : prev.breakdown, projOrigin: origin, breakdownOrigin: prev.breakdown === dimId ? null : prev.breakdownOrigin };
    return {
      describe: '投影 → ' + dimById[dimId].name,
      do: function () {
        store.projHistory.push(prev);
        if (store.projHistory.length > 30) store.projHistory.shift();
        store.projection.primary = next.primary;
        store.projection.breakdown = next.breakdown;
        store.projOrigin = next.projOrigin;
        store.breakdownOrigin = next.breakdownOrigin;
        store.expanded[dimId] = true;
      },
      undo: function () {
        store.projHistory.pop();
        store.projection.primary = prev.primary;
        store.projection.breakdown = prev.breakdown;
        store.projOrigin = prev.projOrigin;
        store.breakdownOrigin = prev.breakdownOrigin;
      }
    };
  }
  function makeSetBreakdown(dimId /* 可为 null */, origin) {
    var prev = { breakdown: store.projection.breakdown, breakdownOrigin: store.breakdownOrigin };
    return {
      describe: dimId ? '细分 → ' + dimById[dimId].name : '移除细分',
      do: function () { store.projection.breakdown = dimId; store.breakdownOrigin = origin; },
      undo: function () { store.projection.breakdown = prev.breakdown; store.breakdownOrigin = prev.breakdownOrigin; }
    };
  }
  function makeResetAll(origin) {
    var snap = {
      filters: store.filters.slice(),
      projection: { primary: store.projection.primary, breakdown: store.projection.breakdown },
      projOrigin: store.projOrigin, breakdownOrigin: store.breakdownOrigin,
      projHistory: store.projHistory.slice()
    };
    return {
      describe: '全部重置',
      do: function () {
        store.filters = [];
        store.projection = { primary: DEFAULT_PROJECTION.primary, breakdown: null };
        store.projOrigin = origin;
        store.breakdownOrigin = null;
        store.projHistory = [];
      },
      undo: function () {
        store.filters = snap.filters;
        store.projection = snap.projection;
        store.projOrigin = snap.projOrigin;
        store.breakdownOrigin = snap.breakdownOrigin;
        store.projHistory = snap.projHistory;
      }
    };
  }

  function toggleFilter(dimId, valueIdx, origin) {
    var hit = null;
    store.filters.forEach(function (f) { if (f.dim === dimId && f.valueIdx === valueIdx) hit = f; });
    if (hit) { var op = makeRemoveFilter(hit.id); op && commit(op); }
    else { var op2 = makeAddFilter(dimId, valueIdx, origin); op2 && commit(op2); }
  }
  function revertProjection() {
    var target = store.projHistory[store.projHistory.length - 1] || DEFAULT_PROJECTION;
    commit(makeSetProjection(target.primary, '托盘回退'));
  }

  /* ---------- 格式化 ---------- */
  function fmtMoney(v) {
    if (Math.abs(v) >= 10000) {
      var w = v / 10000;
      return '¥' + (w >= 100 ? Math.round(w) : w.toFixed(1)) + '万';
    }
    return '¥' + Math.round(v).toLocaleString('zh-CN');
  }
  function fmtMeasure(id, v) {
    if (id === 'revenue') return fmtMoney(v);
    if (id === 'units') return Math.round(v).toLocaleString('zh-CN');
    return v.toFixed(1) + '%';
  }

  /* ---------- 渲染 ---------- */
  var $ = function (id) { return document.getElementById(id); };
  var appEl = $('app');
  var lastFocusKey = null;

  function focusKey(el) {
    while (el && el !== appEl) {
      if (el.getAttribute && el.getAttribute('data-k')) return el.getAttribute('data-k');
      el = el.parentNode;
    }
    return null;
  }

  function renderAll() {
    var ae = document.activeElement;
    lastFocusKey = ae ? focusKey(ae) : null;
    renderHeader();
    renderRail();
    renderProjectionBar();
    renderChart();
    renderTable();
    renderTray();
    renderInspector();
    if (lastFocusKey) {
      var again = appEl.querySelector('[data-k="' + lastFocusKey + '"]');
      if (again && again.focus) again.focus({ preventScroll: true });
    }
  }

  function renderHeader() {
    var hit = matched().length;
    $('ds-name').textContent = DS.name + ' ' + DS.version;
    $('header-stats').innerHTML =
      '<span class="stat">记录 <b>' + RECORDS.length.toLocaleString('zh-CN') + '</b></span>' +
      '<span class="stat">维度 <b>' + DIMS.length + '</b></span>' +
      '<span class="stat stat-hit">当前命中 <b>' + hit.toLocaleString('zh-CN') + '</b></span>';
    $('btn-undo').disabled = store.undoStack.length === 0;
    $('btn-redo').disabled = store.redoStack.length === 0;
    var dirty = store.filters.length > 0 ||
      store.projection.primary !== DEFAULT_PROJECTION.primary ||
      store.projection.breakdown !== null;
    $('btn-reset').disabled = !dirty;
  }

  function renderRail() {
    var html = [];
    var projected = store.projection.primary;
    var breakdown = store.projection.breakdown;
    DIMS.forEach(function (dim) {
      var open = !!store.expanded[dim.id];
      var fCount = store.filters.filter(function (f) { return f.dim === dim.id; }).length;
      var groups = filterGroups(dim.id);
      var counts = {};
      var maxC = 1;
      for (var i = 0; i < RECORDS.length; i++) {
        var rec = RECORDS[i];
        if (!passFilters(rec, groups)) continue;
        var vi = dimIdx(rec, dim);
        counts[vi] = (counts[vi] || 0) + 1;
        if (counts[vi] > maxC) maxC = counts[vi];
      }
      var role = [];
      if (dim.id === projected) role.push('<span class="chip chip-proj">投影中</span>');
      if (dim.id === breakdown) role.push('<span class="chip chip-break">细分</span>');
      if (fCount) role.push('<span class="chip chip-filter">' + fCount + ' 过滤</span>');

      html.push('<div class="dim' + (open ? ' open' : '') + '" data-dim="' + dim.id + '">');
      html.push('<div class="dim-hd">');
      html.push('<button class="dim-exp" data-k="exp:' + dim.id + '" aria-expanded="' + open + '" title="展开/收起取值">' + (open ? '▾' : '▸') + '</button>');
      html.push('<button class="dim-name' + (dim.id === projected ? ' is-proj' : '') + '" data-k="proj:' + dim.id + '" title="设为投影维度">' +
        '<span class="dim-icon" aria-hidden="true">' + dim.icon + '</span>' + dim.name +
        '<span class="dim-cardinality">' + dim.values.length + ' 值</span></button>');
      html.push('<span class="dim-role">' + role.join('') + '</span>');
      html.push('</div>');
      if (open) {
        html.push('<div class="dim-vals" role="group" aria-label="' + dim.name + ' 取值过滤">');
        dim.values.forEach(function (v, vi) {
          var c = counts[vi] || 0;
          var on = store.filters.some(function (f) { return f.dim === dim.id && f.valueIdx === vi; });
          html.push('<label class="dim-val' + (on ? ' on' : '') + '" title="' + v + '：' + c + ' 条（按其他维度过滤）">');
          html.push('<input type="checkbox" data-k="cb:' + dim.id + ':' + vi + '" data-dim="' + dim.id + '" data-vi="' + vi + '"' + (on ? ' checked' : '') + '>');
          html.push('<span class="dv-name">' + v + '</span>');
          html.push('<span class="dv-bar" aria-hidden="true"><i style="width:' + Math.round(100 * c / maxC) + '%"></i></span>');
          html.push('<span class="dv-count">' + c.toLocaleString('zh-CN') + '</span>');
          html.push('</label>');
        });
        html.push('</div>');
      }
      html.push('</div>');
    });
    $('rail-body').innerHTML = html.join('');
  }

  function renderProjectionBar() {
    var dim = dimById[store.projection.primary];
    $('proj-title').textContent = '投影 · ' + dim.name;
    var sub = '按「' + dim.name + '」聚合当前过滤后数据';
    if (store.projection.breakdown) sub += '，以「' + dimById[store.projection.breakdown].name + '」细分';
    $('proj-sub').textContent = sub;

    var mOpts = MEASURES.map(function (m) {
      return '<option value="' + m.id + '"' + (m.id === store.measure ? ' selected' : '') + '>' + m.name + '</option>';
    }).join('');
    var measureSel = $('measure-select');
    if (measureSel.innerHTML !== mOpts) measureSel.innerHTML = mOpts;

    var bOpts = ['<option value="">（无细分）</option>'].concat(DIMS.filter(function (d) {
      return d.id !== store.projection.primary;
    }).map(function (d) {
      return '<option value="' + d.id + '"' + (d.id === store.projection.breakdown ? ' selected' : '') + '>' + d.name + '</option>';
    })).join('');
    var bSel = $('breakdown-select');
    if (bSel.innerHTML !== bOpts) bSel.innerHTML = bOpts;
  }

  function renderChart() {
    var dim = dimById[store.projection.primary];
    var breakdown = store.projection.breakdown ? dimById[store.projection.breakdown] : null;
    var activeValues = {};
    store.filters.forEach(function (f) { if (f.dim === dim.id) activeValues[f.valueIdx] = true; });

    var rows = dim.values.map(function (v, vi) {
      var recs = [];
      for (var i = 0; i < RECORDS.length; i++) if (dimIdx(RECORDS[i], dim) === vi) recs.push(RECORDS[i]);
      var agg = aggregate(recs, store.measure, dim.id);
      var seg = null;
      if (breakdown) {
        seg = breakdown.values.map(function (bv, bi) {
          var sub = recs.filter(function (r) { return dimIdx(r, breakdown) === bi && passFilters(r, filterGroups(dim.id)); });
          return { bi: bi, n: sub.length, value: sub.reduce(function (s, r) { return s + r[store.measure]; }, 0) };
        });
      }
      return { vi: vi, v: v, agg: agg, seg: seg };
    });

    var max = 0;
    rows.forEach(function (r) { if (r.agg.value > max) max = r.agg.value; });
    var totalHit = rows.reduce(function (s, r) { return s + r.agg.count; }, 0);

    var html = [];
    rows.forEach(function (r) {
      var pct = max > 0 ? Math.max(r.agg.value > 0 ? 1.5 : 0, 100 * r.agg.value / max) : 0;
      var pressed = !!activeValues[r.vi];
      var segHtml = '';
      if (r.seg) {
        var segMax = r.seg.reduce(function (s, x) { return s + x.value; }, 0) || 1;
        segHtml = r.seg.filter(function (x) { return x.value > 0; }).map(function (x) {
          return '<i class="seg" style="width:' + (100 * x.value / segMax).toFixed(2) + '%;background:' + PALETTE[x.bi % PALETTE.length] + '" title="' + dimById[store.projection.breakdown].values[x.bi] + '：' + fmtMeasure(store.measure, x.value) + '"></i>';
        }).join('');
      }
      html.push('<button class="bar-row' + (pressed ? ' active' : '') + (r.agg.count === 0 ? ' zero' : '') + '" data-k="bar:' + dim.id + ':' + r.vi + '" data-dim="' + dim.id + '" data-vi="' + r.vi + '" aria-pressed="' + pressed + '" title="点击' + (pressed ? '取消' : '') + '过滤：' + dim.name + '＝' + r.v + '（' + r.agg.count + ' 条）">');
      html.push('<span class="bar-label">' + r.v + '</span>');
      html.push('<span class="bar-track">' + (r.seg ? '<span class="bar bar-stack" style="width:' + pct.toFixed(2) + '%">' + segHtml + '</span>' : '<span class="bar" style="width:' + pct.toFixed(2) + '%"></span>') + '</span>');
      html.push('<span class="bar-value">' + fmtMeasure(store.measure, r.agg.value) + '</span>');
      html.push('<span class="bar-count">' + r.agg.count + ' 条</span>');
      html.push('</button>');
    });
    $('chart').innerHTML = html.join('');
    $('chart').classList.toggle('all-zero', totalHit === 0);

    var legend = $('legend');
    if (breakdown) {
      legend.hidden = false;
      legend.innerHTML = '<span class="lg-title">' + breakdown.name + '：</span>' + breakdown.values.map(function (bv, bi) {
        return '<span class="lg-item"><i style="background:' + PALETTE[bi % PALETTE.length] + '"></i>' + bv + '</span>';
      }).join('');
    } else {
      legend.hidden = true;
      legend.innerHTML = '';
    }
  }

  function renderTable() {
    var dim = dimById[store.projection.primary];
    var breakdown = store.projection.breakdown ? dimById[store.projection.breakdown] : null;
    var recs = matched().slice();
    var hit = recs.length;
    recs.sort(function (a, b) {
      var k = store.sort.key, d = store.sort.dir;
      return k === 'id' ? a.id < b.id ? -d : d : (a[k] - b[k]) * d;
    });
    var shown = recs.slice(0, TABLE_CAP);

    var sortable = [['id', '订单号'], ['revenue', '收入'], ['units', '数量'], ['margin', '利润率']];
    var html = '<table><thead><tr><th class="th-dim">订单号</th>';
    html += '<th class="th-dim th-proj">' + dim.name + '</th>';
    if (breakdown) html += '<th class="th-dim">' + breakdown.name + '</th>';
    sortable.slice(1).forEach(function (s) {
      var arrow = store.sort.key === s[0] ? (store.sort.dir < 0 ? ' ↓' : ' ↑') : '';
      html += '<th class="th-num"><button class="th-sort" data-k="sort:' + s[0] + '" data-key="' + s[0] + '">' + s[1] + arrow + '</button></th>';
    });
    html += '</tr></thead><tbody>';
    shown.forEach(function (r) {
      var sel = r.id === store.selectedId;
      html += '<tr tabindex="0" data-k="row:' + r.id + '" data-rid="' + r.id + '"' + (sel ? ' class="sel"' : '') + '>';
      html += '<td class="td-id">' + r.id + '</td>';
      html += '<td class="td-dim">' + dimVal(r, dim) + '</td>';
      if (breakdown) html += '<td class="td-dim">' + dimVal(r, breakdown) + '</td>';
      html += '<td class="td-num">' + fmtMoney(r.revenue) + '</td>';
      html += '<td class="td-num">' + r.units + '</td>';
      html += '<td class="td-num">' + r.margin + '%</td>';
      html += '</tr>';
    });
    html += '</tbody></table>';

    if (hit === 0) {
      html = '<div class="empty-state"><div class="empty-icon">◌</div>' +
        '<p>当前过滤条件下没有命中记录。</p>' +
        '<button class="btn" data-k="empty-clear" data-act="clear-filters">清空全部过滤</button></div>';
    }
    $('table-wrap').innerHTML = html;
    $('table-hint').textContent = hit === 0 ? '0 条命中'
      : '命中 ' + hit.toLocaleString('zh-CN') + ' 条 · 显示前 ' + Math.min(TABLE_CAP, hit) + ' 条（点击行查看明细）';
  }

  function trayEntries() {
    var entries = [];
    entries.push({
      id: 'proj-primary', kind: 'projection', dim: store.projection.primary,
      title: '投影维度 → <b>' + dimById[store.projection.primary].name + '</b>',
      origin: store.projOrigin, revertHint: '回到上一投影',
      canRevert: store.projHistory.length > 0 || store.projection.primary !== DEFAULT_PROJECTION.primary
    });
    if (store.projection.breakdown) {
      entries.push({
        id: 'proj-breakdown', kind: 'projection', dim: store.projection.breakdown,
        title: '细分维度 → <b>' + dimById[store.projection.breakdown].name + '</b>',
        origin: store.breakdownOrigin || '未记录', revertHint: '移除细分', canRevert: true
      });
    }
    store.filters.forEach(function (f) {
      entries.push({
        id: f.id, kind: 'filter', dim: f.dim,
        title: '<b>' + dimById[f.dim].name + '</b>＝' + dimById[f.dim].values[f.valueIdx],
        origin: f.origin,
        orphan: f.dim !== store.projection.primary && f.dim !== store.projection.breakdown,
        revertHint: '回退该过滤', canRevert: true
      });
    });
    return entries;
  }

  function renderTray() {
    var entries = trayEntries();
    $('tray-count').textContent = entries.length;
    var html = [];
    if (!entries.length) {
      html.push('<div class="tray-empty">无生效的过滤 / 投影状态。<br>所有变更都会出现在这里，并逐条可回退。</div>');
    }
    entries.forEach(function (e) {
      var orphanTag = e.orphan ? '<span class="tag tag-warn">不在当前投影 · 仍生效</span>' : '';
      html.push('<div class="state-entry kind-' + e.kind + '" data-dim="' + e.dim + '">');
      html.push('<span class="badge ' + (e.kind === 'filter' ? 'badge-filter' : 'badge-proj') + '">' + (e.kind === 'filter' ? '过滤' : '投影') + '</span>');
      html.push('<div class="entry-main"><div class="entry-title">' + e.title + '</div>' +
        '<div class="entry-meta"><span class="origin">来源：' + e.origin + '</span>' + orphanTag + '</div></div>');
      html.push('<button class="entry-x" data-k="x:' + e.id + '" data-act="' + (e.id === 'proj-primary' ? 'revert-proj' : e.id === 'proj-breakdown' ? 'clear-breakdown' : 'revert-filter') + '" data-fid="' + e.id + '" title="' + e.revertHint + '" ' + (e.canRevert ? '' : 'disabled') + '>✕</button>');
      html.push('</div>');
    });
    $('tray-body').innerHTML = html.join('');
  }

  function renderInspector() {
    var body = $('inspector-body');
    var btn = $('btn-deselect');
    var rec = null;
    for (var i = 0; i < RECORDS.length; i++) if (RECORDS[i].id === store.selectedId) { rec = RECORDS[i]; break; }
    btn.hidden = !rec;
    if (!rec) {
      body.innerHTML = '<div class="insp-empty">在记录表中点击任意行，<br>这里会显示该记录的全部维度与度量。<br><span class="insp-hint">选中状态在切换投影后保持。</span></div>';
      return;
    }
    var inHit = passFilters(rec, filterGroups(null));
    var html = '';
    if (!inHit) {
      html += '<div class="insp-warn">⚠ 该记录已被当前过滤排除（选中仍保持）</div>';
    }
    html += '<div class="insp-id">' + rec.id + '</div><div class="kv-grid">';
    DIMS.forEach(function (dim) {
      var v = dimVal(rec, dim);
      var on = store.filters.some(function (f) { return f.dim === dim.id && f.valueIdx === dimIdx(rec, dim); });
      html += '<div class="kv"><span class="kv-k">' + dim.name + '</span>' +
        '<span class="kv-v">' + v + '</span>' +
        '<button class="kv-act" data-k="insp:' + dim.id + '" data-dim="' + dim.id + '" data-vi="' + dimIdx(rec, dim) + '" title="' + (on ? '取消' : '添加') + '过滤：' + dim.name + '＝' + v + '">' + (on ? '✓ 已过滤' : '过滤') + '</button></div>';
    });
    html += '<div class="kv kv-measure"><span class="kv-k">收入</span><span class="kv-v">' + fmtMoney(rec.revenue) + '</span></div>';
    html += '<div class="kv kv-measure"><span class="kv-k">数量</span><span class="kv-v">' + rec.units + '</span></div>';
    html += '<div class="kv kv-measure"><span class="kv-k">利润率</span><span class="kv-v">' + rec.margin + '%</span></div>';
    html += '</div>';
    body.innerHTML = html;
  }

  /* ---------- 事件（委托，一次挂载） ---------- */
  $('rail-body').addEventListener('click', function (ev) {
    var exp = ev.target.closest('.dim-exp');
    if (exp) {
      var dim = exp.closest('.dim').getAttribute('data-dim');
      store.expanded[dim] = !store.expanded[dim];
      renderAll();
      return;
    }
    var name = ev.target.closest('.dim-name');
    if (name) {
      var dimId = name.closest('.dim').getAttribute('data-dim');
      if (dimId !== store.projection.primary) commit(makeSetProjection(dimId, '维度轨'));
    }
  });
  $('rail-body').addEventListener('change', function (ev) {
    var cb = ev.target.closest('input[type="checkbox"]');
    if (cb) toggleFilter(cb.getAttribute('data-dim'), +cb.getAttribute('data-vi'), '维度轨');
  });

  $('chart').addEventListener('click', function (ev) {
    var bar = ev.target.closest('.bar-row');
    if (bar) toggleFilter(bar.getAttribute('data-dim'), +bar.getAttribute('data-vi'), '分布图');
  });

  $('table-wrap').addEventListener('click', function (ev) {
    var sort = ev.target.closest('.th-sort');
    if (sort) {
      var key = sort.getAttribute('data-key');
      if (store.sort.key === key) store.sort.dir *= -1;
      else { store.sort.key = key; store.sort.dir = -1; }
      renderAll();
      return;
    }
    var clear = ev.target.closest('[data-act="clear-filters"]');
    if (clear) { commit(makeResetAll('空态恢复')); return; }
    var row = ev.target.closest('tr[data-rid]');
    if (row) { store.selectedId = row.getAttribute('data-rid'); renderAll(); }
  });
  $('table-wrap').addEventListener('keydown', function (ev) {
    if (ev.key !== 'Enter' && ev.key !== ' ') return;
    var row = ev.target.closest('tr[data-rid]');
    if (row) { ev.preventDefault(); store.selectedId = row.getAttribute('data-rid'); renderAll(); }
  });

  $('tray-body').addEventListener('click', function (ev) {
    var x = ev.target.closest('.entry-x');
    if (!x) return;
    var act = x.getAttribute('data-act');
    if (act === 'revert-filter') { var op = makeRemoveFilter(x.getAttribute('data-fid')); op && commit(op); }
    else if (act === 'revert-proj') revertProjection();
    else if (act === 'clear-breakdown') commit(makeSetBreakdown(null, '托盘回退'));
  });
  /* 状态条目 hover → 高亮归属维度的轨道行（归属可视化） */
  $('tray-body').addEventListener('mouseover', function (ev) {
    var e = ev.target.closest('.state-entry');
    if (!e) return;
    var dimRow = document.querySelector('.dim[data-dim="' + e.getAttribute('data-dim') + '"]');
    if (dimRow) dimRow.classList.add('flash');
  });
  $('tray-body').addEventListener('mouseout', function () {
    document.querySelectorAll('.dim.flash').forEach(function (el) { el.classList.remove('flash'); });
  });

  $('inspector-body').addEventListener('click', function (ev) {
    var act = ev.target.closest('.kv-act');
    if (act) toggleFilter(act.getAttribute('data-dim'), +act.getAttribute('data-vi'), '明细面板');
  });
  $('btn-deselect').addEventListener('click', function () { store.selectedId = null; renderAll(); });

  $('measure-select').addEventListener('change', function (ev) { store.measure = ev.target.value; renderAll(); });
  $('breakdown-select').addEventListener('change', function (ev) {
    var v = ev.target.value || null;
    if (v !== store.projection.breakdown) commit(makeSetBreakdown(v, '细分下拉'));
  });

  $('btn-undo').addEventListener('click', undo);
  $('btn-redo').addEventListener('click', redo);
  $('btn-reset').addEventListener('click', function () { commit(makeResetAll('头部重置')); });

  document.addEventListener('keydown', function (ev) {
    if ((ev.ctrlKey || ev.metaKey) && !ev.altKey) {
      var k = ev.key.toLowerCase();
      if (k === 'z' && !ev.shiftKey) { ev.preventDefault(); undo(); return; }
      if (k === 'y' || (k === 'z' && ev.shiftKey)) { ev.preventDefault(); redo(); return; }
    }
    if (ev.key === 'Escape' && store.selectedId) { store.selectedId = null; renderAll(); }
  });

  /* ---------- 测试钩子（验收证据用） ---------- */
  window.__prism = {
    store: store,
    commit: commit, undo: undo, redo: redo,
    toggleFilter: toggleFilter,
    matched: matched,
    trayEntries: trayEntries,
    makeSetProjection: makeSetProjection,
    makeResetAll: makeResetAll,
    dimById: dimById
  };

  /* ---------- 初始化：数据内联，加载完成即 ready（无加载态） ---------- */
  try {
    if (!RECORDS.length || !DIMS.length) throw new Error('数据集校验失败');
    renderAll();
  } catch (err) {
    appEl.innerHTML = '<div class="app-error"><h2>应用初始化失败</h2><p>' + String(err && err.message || err) + '</p></div>';
  }
})();
