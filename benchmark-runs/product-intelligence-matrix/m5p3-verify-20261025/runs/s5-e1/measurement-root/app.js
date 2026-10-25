/* Prism · Terra Index — 维度探索台
 * 状态模型（对应 SDIR state_ownership）：
 *   query     → probe_rail      ：每条探针带来源(origin)，可静默/移除
 *   mode      → projection_canvas：dimension × measure × agg × sort（投影 chip，可回退）
 *   selection → record_table    ：记录 id 集合，跨投影切换保持
 *   viewport  → history_strip   ：时间游标唯一决定全量状态（undo/redo/回跳都是移动指针） */
(function () {
  'use strict';

  var T = window.TERRA;

  /* ---------- 词汇表 ---------- */
  var DIMS = {
    region: { label: '地区', values: T.regions },
    income: { label: '收入组', values: T.incomes },
    year:   { label: '年份', values: T.years.map(String) },
    country:{ label: '国家', values: T.countries.map(function (c) { return c.name; }).sort() }
  };
  var MEASURES = {
    population:  { label: '人口',       fmt: function (v) { return v >= 100 ? (v / 100).toFixed(2) + '亿' : Math.round(v * 100) + '万'; } },
    gdpPc:       { label: '人均GDP',    fmt: function (v) { return '$' + Math.round(v).toLocaleString('zh-CN'); } },
    co2Pc:       { label: '人均CO₂',    fmt: function (v) { return v.toFixed(2) + 't'; } },
    renewables:  { label: '可再生占比', fmt: function (v) { return v.toFixed(1) + '%'; } },
    internet:    { label: '互联网普及', fmt: function (v) { return v.toFixed(1) + '%'; } },
    lifeExp:     { label: '预期寿命',   fmt: function (v) { return v.toFixed(1) + '岁'; } },
    energyPc:    { label: '人均能耗',   fmt: function (v) { return v >= 1000 ? (v / 1000).toFixed(1) + 'k' : String(Math.round(v)); } }
  };
  var ORIGINS = {
    'chart-click':   { label: '图表', cls: 'origin-chart' },
    'manual':        { label: '手动', cls: 'origin-manual' },
    'history':       { label: '历史', cls: 'origin-history' },
    'dimension':     { label: '维度切换', cls: 'origin-dim' },
    'projection-back': { label: '投影回退', cls: 'origin-history' },
    'projection-fwd':  { label: '投影前进', cls: 'origin-history' },
    'time-travel':   { label: '时间回跳', cls: 'origin-history' },
    'measure':       { label: '度量', cls: 'origin-dim' },
    'agg':           { label: '聚合', cls: 'origin-dim' },
    'sort':          { label: '排序', cls: 'origin-dim' },
    'reset':         { label: '重置', cls: 'origin-reset' }
  };
  var TABLE_COLS = [
    { key: 'country', label: '国家' }, { key: 'region', label: '地区' },
    { key: 'income', label: '收入组' }, { key: 'year', label: '年份' }
  ].concat(Object.keys(MEASURES).map(function (k) {
    return { key: k, label: MEASURES[k].label, num: true };
  }));
  var MAX_TABLE_ROWS = 250, MAX_HISTORY = 80;

  /* ---------- 状态与时间线 ---------- */
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function initialState() {
    return {
      projection: { dim: 'region', measure: 'co2Pc', agg: 'mean', sort: 'value-desc' },
      probes: [],            // {id, dim, value:String, origin, muted}
      selection: []          // record ids
    };
  }

  var state = initialState();
  var timeline = [{ label: '起点', kind: 'origin', state: clone(state) }];
  var ptr = 0;
  var projStack = [clone(state.projection)], projPtr = 0;
  var probeSeq = 0, carryTimer = null;

  function commit(label, kind) {
    timeline = timeline.slice(0, ptr + 1);
    timeline.push({ label: label, kind: kind, state: clone(state) });
    if (timeline.length > MAX_HISTORY) { timeline.shift(); } else { ptr++; }
    ptr = Math.min(ptr, timeline.length - 1);
  }

  function goTo(i, verb) {
    if (i < 0 || i >= timeline.length) return;
    ptr = i;
    state = clone(timeline[i].state);
    projStack = [clone(state.projection)]; projPtr = 0; // 回跳后投影局部栈与“现在”对齐
    renderAll();
    toast((verb || '已回跳') + '：' + timeline[i].label, 'history');
  }

  function undo() { if (ptr > 0) goTo(ptr - 1, '撤销'); }
  function redo() { if (ptr < timeline.length - 1) goTo(ptr + 1, '重做'); }

  /* ---------- 派生计算 ---------- */
  function activeProbes() { return state.probes.filter(function (p) { return !p.muted; }); }

  function applyProbes(rows) {
    var byDim = {};
    activeProbes().forEach(function (p) { (byDim[p.dim] = byDim[p.dim] || []).push(String(p.value)); });
    return rows.filter(function (r) {
      for (var dim in byDim) {
        if (byDim[dim].indexOf(String(r[dim])) === -1) return false;
      }
      return true;
    });
  }

  function aggregate(rows, key, agg) {
    if (!rows.length) return NaN;
    var vs = rows.map(function (r) { return r[key]; });
    if (agg === 'sum') return vs.reduce(function (a, b) { return a + b; }, 0);
    if (agg === 'median') {
      vs.sort(function (a, b) { return a - b; });
      var m = vs.length >> 1;
      return vs.length % 2 ? vs[m] : (vs[m - 1] + vs[m]) / 2;
    }
    return vs.reduce(function (a, b) { return a + b; }, 0) / vs.length;
  }

  function project(rows) {
    var pj = state.projection, dim = pj.dim;
    var seen = {}, keys = [];
    rows.forEach(function (r) {
      var k = String(r[dim]);
      if (!seen[k]) { seen[k] = true; keys.push(k); }
    });
    var bars = keys.map(function (k) {
      var sub = rows.filter(function (r) { return String(r[dim]) === k; });
      return {
        key: k,
        value: aggregate(sub, pj.measure, pj.agg),
        n: sub.length,
        selN: sub.reduce(function (a, r) { return a + (state.selection.indexOf(r.id) !== -1 ? 1 : 0); }, 0)
      };
    });
    var s = pj.sort;
    if (s === 'value-desc') bars.sort(function (a, b) { return b.value - a.value; });
    else if (s === 'value-asc') bars.sort(function (a, b) { return a.value - b.value; });
    else if (s === 'name-asc') bars.sort(function (a, b) { return a.key.localeCompare(b.key, 'zh'); });
    else bars.sort(function (a, b) { return b.key.localeCompare(a.key, 'zh'); });
    return bars;
  }

  /* ---------- 渲染 ---------- */
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  function renderAll() {
    renderDimSeg(); renderControls(); renderProjectionChip(); renderProbes();
    renderChart(); renderTable(); renderInspector(); renderHistory(); renderStatus();
  }

  function renderDimSeg() {
    $('dimSeg').innerHTML = Object.keys(DIMS).map(function (d) {
      var on = state.projection.dim === d;
      return '<button role="tab" aria-selected="' + on + '" class="seg-btn' + (on ? ' on' : '') +
        '" data-dim="' + d + '" tabindex="0">' + DIMS[d].label + '</button>';
    }).join('');
  }

  function renderControls() {
    if ($('measureSel').options.length === 0) {
      $('measureSel').innerHTML = Object.keys(MEASURES).map(function (k) {
        return '<option value="' + k + '">' + MEASURES[k].label + '</option>';
      }).join('');
    }
    $('measureSel').value = state.projection.measure;
    $('aggSel').value = state.projection.agg;
    $('sortSel').value = state.projection.sort;
  }

  function originBadge(origin) {
    var o = ORIGINS[origin] || { label: origin, cls: 'origin-manual' };
    return '<span class="badge ' + o.cls + '" title="来源：' + o.label + '">' + o.label + '</span>';
  }

  function renderProjectionChip() {
    var pj = state.projection;
    var lastOrigin = timeline[ptr].kind === 'projection' || timeline[ptr].kind === 'origin'
      ? (ptr === 0 ? null : (timeline[ptr].origin || 'dimension')) : timeline[ptr].origin;
    var back = projPtr > 0, fwd = projPtr < projStack.length - 1;
    $('projChipBox').innerHTML =
      '<div class="proj-chip">' +
        '<span class="proj-k">投影</span>' +
        '<span class="proj-v">' + DIMS[pj.dim].label + ' × ' + MEASURES[pj.measure].label +
          ' × ' + ({ mean: '均值', median: '中位数', sum: '总和' })[pj.agg] + '</span>' +
        (lastOrigin ? originBadge(lastOrigin) : '') +
        '<span class="proj-nav">' +
          '<button class="icon-btn" id="projBack" title="回退到上一个投影" ' + (back ? '' : 'disabled') + '>‹</button>' +
          '<button class="icon-btn" id="projFwd" title="前进到下一个投影" ' + (fwd ? '' : 'disabled') + '>›</button>' +
        '</span>' +
      '</div>';
    $('projBack').onclick = function () { projectionStep(-1); };
    $('projFwd').onclick = function () { projectionStep(1); };
  }

  function probeCoverage(p) {
    var others = activeProbes().filter(function (q) { return q !== p; });
    var base = T.records.filter(function (r) {
      return others.every(function (q) { return String(r[q.dim]) === String(q.value); });
    });
    return base.filter(function (r) { return String(r[p.dim]) === String(p.value); }).length;
  }

  function renderProbes() {
    var box = $('probeList');
    if (!state.probes.length) {
      box.innerHTML = '<div class="rail-empty">暂无探针 —— 点击图表中的柱，或使用下方“手动添加”。<br>维度切换不会清空探针。</div>';
      return;
    }
    box.innerHTML = state.probes.map(function (p, i) {
      var dimLabel = DIMS[p.dim].label;
      return '<div class="chip' + (p.muted ? ' muted' : '') + '" data-i="' + i + '">' +
        originBadge(p.origin) +
        '<span class="chip-label"><b>' + esc(dimLabel) + '</b> = ' + esc(p.value) + '</span>' +
        '<span class="chip-n" title="该探针在其余探针条件下的覆盖记录数">n=' + probeCoverage(p) + '</span>' +
        '<button class="icon-btn mute" data-act="mute" title="' + (p.muted ? '取消静默' : '静默（保留但暂不生效）') + '">' + (p.muted ? '◌' : '◉') + '</button>' +
        '<button class="icon-btn rm" data-act="rm" title="移除此探针">×</button>' +
      '</div>';
    }).join('');
  }

  function renderChart() {
    var rows = applyProbes(T.records);
    var wrap = $('chartWrap');
    var emptyBox = $('tableEmpty');

    if (!rows.length) {
      wrap.innerHTML = '<div class="empty-panel in-chart"><div class="empty-icon">◌</div>' +
        '<div>当前探针组合下没有记录</div>' +
        '<button class="btn" id="chartEmptyClear">清空全部探针</button></div>';
      var b = $('chartEmptyClear');
      if (b) b.onclick = clearProbes;
      emptyBox.hidden = false;
      return;
    }
    emptyBox.hidden = true;

    var bars = project(rows);
    var pj = state.projection;
    var fmt = MEASURES[pj.measure].fmt;
    var many = bars.length > 14;
    var availW = Math.max(wrap.clientWidth - 70, 260);
    var slotW = Math.max(46, Math.floor(availW / bars.length));
    var barW = Math.min(slotW - 10, 64);
    var plotH = 250;
    var maxV = Math.max.apply(null, bars.map(function (b) { return b.value; }).concat([0]));

    var yTicks = [0, 0.25, 0.5, 0.75, 1].map(function (f) {
      return { f: f, v: maxV * f, bottom: 'calc(20px + (100% - 20px) * ' + f + ')' };
    });
    var grid = yTicks.map(function (t) {
      return '<i class="gridline" style="bottom:' + t.bottom + '"></i>';
    }).join('');
    var yAxis = '<div class="y-axis">' + yTicks.map(function (t) {
      return '<span class="y-tick" style="bottom:' + t.bottom + '">' + esc(fmt(t.v)) + '</span>';
    }).join('') + '</div>';

    var plot = bars.map(function (b, i) {
      var h = maxV > 0 ? Math.max(b.value / maxV * plotH, b.value > 0 ? 2 : 0) : 0;
      var light = 38 + 26 * (1 - i / Math.max(bars.length - 1, 1));
      var active = hasProbe(pj.dim, b.key);
      var selPct = (b.n && b.selN && h > 0) ? Math.min(b.selN / b.n * 100, 100) : 0;
      var bg = selPct > 0
        ? 'background:linear-gradient(to top, hsl(212,64%,' + light + '%) calc(100% - ' + selPct.toFixed(1) + '%), var(--amber) 0);'
        : 'background:hsl(212,64%,' + light + '%);';
      return '<div class="bar-slot" style="width:' + slotW + 'px">' +
        (bars.length <= 24 ? '<span class="bar-val">' + esc(fmt(b.value)) + '</span>' : '') +
        '<button type="button" class="bar-btn' + (active ? ' active' : '') + '" data-key="' + esc(b.key) + '" aria-pressed="' + active + '"' +
        ' style="width:' + barW + 'px;height:' + Math.round(h) + 'px;' + bg + '"' +
        ' aria-label="' + esc(b.key + '：' + fmt(b.value) + '，' + b.n + ' 条记录，选中 ' + b.selN + (active ? '，已过滤' : '') + '。点击切换探针') + '"' +
        ' title="' + esc(b.key + ' · ' + MEASURES[pj.measure].label + '（' + pj.agg + '）：' + fmt(b.value) + ' · 记录 ' + b.n + ' · 选中 ' + b.selN) + '"></button>' +
        '</div>';
    }).join('');

    var xStrip = bars.map(function (b) {
      return '<div class="x-slot" style="width:' + slotW + 'px">' +
        '<span class="bar-key' + (many ? ' rotated' : '') + '">' + esc(b.key) + '</span>' +
        '<span class="bar-n">n=' + b.n + (b.selN ? ' · ◆' + b.selN : '') + '</span>' +
        '</div>';
    }).join('');

    wrap.innerHTML = '<div class="chart-canvas" style="width:' + (70 + bars.length * slotW) + 'px">' +
      '<div class="plot">' + yAxis +
      '<div class="plot-inner" style="height:' + plotH + 'px">' + grid + plot + '</div>' +
      '</div>' +
      '<div class="x-strip">' + xStrip + '</div>' +
      '</div>';

    wrap.querySelectorAll('.bar-btn').forEach(function (node) {
      node.addEventListener('click', function () { toggleProbe(state.projection.dim, node.getAttribute('data-key'), 'chart-click'); });
    });
  }

  function renderTable() {
    var rows = applyProbes(T.records);
    $('tableCount').textContent = '镜头内 ' + rows.length + ' / ' + T.records.length + ' 条' +
      (rows.length > MAX_TABLE_ROWS ? '（显示前 ' + MAX_TABLE_ROWS + '，可排序定位）' : '');
    var sort = tableSort;

    $('tableHead').innerHTML = '<tr>' + TABLE_COLS.map(function (c) {
      var dir = sort.key === c.key ? sort.dir : null;
      return '<th role="button" tabindex="0" data-key="' + c.key + '" aria-sort="' + (dir === 'desc' ? 'descending' : dir === 'asc' ? 'ascending' : 'none') +
        '" class="' + (c.num ? 'num' : '') + (dir ? ' sorted' : '') + '">' + c.label + (dir === 'desc' ? ' ↓' : dir === 'asc' ? ' ↑' : '') + '</th>';
    }).join('') + '</tr>';

    var sorted = rows.slice();
    if (sort.key) {
      sorted.sort(function (a, b) {
        var va = a[sort.key], vb = b[sort.key];
        var c = typeof va === 'string' ? String(va).localeCompare(String(vb), 'zh') : va - vb;
        return sort.dir === 'asc' ? c : -c;
      });
    }
    var shown = sorted.slice(0, MAX_TABLE_ROWS);
    $('tableBody').innerHTML = shown.map(function (r) {
      var sel = state.selection.indexOf(r.id) !== -1;
      return '<tr data-id="' + r.id + '" tabindex="-1" aria-selected="' + sel + '" class="' + (sel ? 'row-sel' : '') + '">' +
        TABLE_COLS.map(function (c) {
          var v = r[c.key];
          return '<td class="' + (c.num ? 'num' : '') + '">' + (c.num ? MEASURES[c.key].fmt(v) : esc(v)) + '</td>';
        }).join('') + '</tr>';
    }).join('');

    // 明细表键盘模式：tbody 单 Tab 停靠，↑/↓ 在行间漫游，Enter 选中/取消（漫游处理统一在 wire() 委托）
    var body = $('tableBody');
    body.setAttribute('tabindex', '0');
    body.setAttribute('role', 'grid');
    body.setAttribute('aria-label', '明细记录表：↑ ↓ 选择行，Enter 选中或取消选中');
    body.querySelectorAll('tr').forEach(function (tr) {
      var h = function () { toggleRecord(tr.getAttribute('data-id')); };
      tr.addEventListener('click', h);
      tr.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); h(); } });
    });
  }

  function renderInspector() {
    var sel = state.selection;
    $('inspectorCount').textContent = sel.length ? '已选 ' + sel.length + ' 条记录' : '未选中记录';
    if (!sel.length) {
      $('inspectorBody').innerHTML = '<div class="rail-empty">在明细表中点击行即可选中。<br><br>' +
        '选择以记录 id 归属，<b>切换投影维度后保持不变</b>；选中记录所在的柱以琥珀色段标注。</div>';
      return;
    }
    var ids = sel.slice(-6).reverse(); // 最近选中的在前
    var html = ids.map(function (id) {
      var r = T.records.find(function (x) { return x.id === id; });
      if (!r) return '';
      var fields = [['国家', r.country], ['地区', r.region], ['收入组', r.income], ['年份', r.year]]
        .concat(Object.keys(MEASURES).map(function (k) { return [MEASURES[k].label, MEASURES[k].fmt(r[k])]; }));
      return '<div class="ins-card" data-id="' + r.id + '">' +
        '<div class="ins-head"><b>' + esc(r.country) + ' · ' + r.year + '</b>' +
        '<button class="icon-btn rm" data-act="rm" title="取消选中">×</button></div>' +
        '<div class="ins-grid">' + fields.map(function (f) {
          return '<span class="ins-k">' + f[0] + '</span><span class="ins-v">' + esc(f[1]) + '</span>';
        }).join('') + '</div></div>';
    }).join('');
    if (sel.length > 6) html += '<div class="ins-more">…另有 ' + (sel.length - 6) + ' 条选中</div>';
    $('inspectorBody').innerHTML = html;
    $('inspectorBody').querySelectorAll('.ins-card .rm').forEach(function (b) {
      b.onclick = function () { toggleRecord(b.closest('.ins-card').getAttribute('data-id')); };
    });
  }

  function renderHistory() {
    var nodes = timeline.map(function (s, i) {
      var cls = 'h-node' + (i === ptr ? ' current' : i > ptr ? ' future' : '');
      return '<button class="' + cls + '" data-i="' + i + '" title="' + esc((i <= ptr ? '回跳到' : '重做到') + '：' + s.label) + '">' +
        '<span class="h-dot"></span>' + esc(s.label) + '</button>';
    }).join('');
    $('historyNodes').innerHTML = nodes;
    $('historyNodes').scrollLeft = 99999;
    $('historyNodes').querySelectorAll('.h-node').forEach(function (n) {
      n.onclick = function () { goTo(parseInt(n.getAttribute('data-i'), 10)); };
    });
    $('undoBtn').disabled = ptr === 0;
    $('redoBtn').disabled = ptr >= timeline.length - 1;
  }

  function renderStatus() {
    var rows = applyProbes(T.records);
    var muted = state.probes.filter(function (p) { return p.muted; }).length;
    $('statusLine').innerHTML =
      '<span>镜头内 <b>' + rows.length + '</b> / ' + T.records.length + ' 条</span>' +
      '<span>探针 <b>' + state.probes.length + '</b>' + (muted ? '（' + muted + ' 静默）' : '') + '</span>' +
      '<span>选中 <b>' + state.selection.length + '</b></span>' +
      '<span>历史深度 <b>' + timeline.length + '</b></span>' +
      '<span class="status-keep">✓ 维度切换保留以上全部状态</span>';
  }

  /* ---------- 动作 ---------- */
  function hasProbe(dim, value) {
    return state.probes.some(function (p) { return p.dim === dim && String(p.value) === String(value); });
  }

  function toggleProbe(dim, value, origin) {
    var idx = state.probes.findIndex(function (p) { return p.dim === dim && String(p.value) === String(value); });
    var dimLabel = DIMS[dim].label;
    if (idx >= 0) {
      state.probes.splice(idx, 1);
      commit('移除探针 ' + dimLabel + '=' + value, 'probe');
      toast('已移除探针：' + dimLabel + ' = ' + value, 'remove');
    } else {
      state.probes.push({ id: 'p' + (++probeSeq), dim: dim, value: String(value), origin: origin, muted: false });
      commit('探针 ' + dimLabel + '=' + value, 'probe');
      toast('已添加探针：' + dimLabel + ' = ' + value + '（来源：' + (ORIGINS[origin] || {}).label + '）', 'add');
    }
    renderAll();
  }

  function removeProbe(i) { var p = state.probes[i]; state.probes.splice(i, 1); commit('移除探针 ' + DIMS[p.dim].label + '=' + p.value, 'probe'); renderAll(); }
  function toggleMute(i) { var p = state.probes[i]; p.muted = !p.muted; commit((p.muted ? '静默' : '启用') + '探针 ' + DIMS[p.dim].label + '=' + p.value, 'probe'); renderAll(); }
  function clearProbes() {
    if (!state.probes.length) return;
    state.probes = []; commit('清空全部探针', 'probe'); renderAll(); toast('已清空全部探针', 'remove');
  }

  function setProjection(next, label, origin) {
    var dimChanged = next.dim !== state.projection.dim;
    state.projection = clone(next);
    commit(label, 'projection');
    timeline[ptr].origin = origin;
    projStack = projStack.slice(0, projPtr + 1); projStack.push(clone(next)); projPtr++;
    renderAll();
    if (dimChanged) carryOver();
  }

  function projectionStep(dir) {
    var np = projPtr + dir;
    if (np < 0 || np >= projStack.length) return;
    projPtr = np;
    state.projection = clone(projStack[np]);
    var wasDim = true;
    commit(dir < 0 ? '投影回退 → ' + DIMS[state.projection.dim].label : '投影前进 → ' + DIMS[state.projection.dim].label, 'projection');
    timeline[ptr].origin = dir < 0 ? 'projection-back' : 'projection-fwd';
    renderAll();
    if (wasDim) carryOver();
  }

  function carryOver() {
    var el = $('carryOver');
    el.innerHTML = '投影维度 → <b>' + DIMS[state.projection.dim].label + '</b>' +
      ' · 保留 <b>' + state.probes.length + '</b> 探针 · <b>' + state.selection.length + '</b> 选中 · 排序 ' +
      ({ 'value-desc': '按值↓', 'value-asc': '按值↑', 'name-asc': '名称A→Z', 'name-desc': '名称Z→A' })[state.projection.sort];
    el.hidden = false;
    el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
    clearTimeout(carryTimer);
    carryTimer = setTimeout(function () { el.hidden = true; }, 5000);
  }

  function toggleRecord(id) {
    var i = state.selection.indexOf(id);
    var r = T.records.find(function (x) { return x.id === id; });
    if (i >= 0) { state.selection.splice(i, 1); commit('取消选中 ' + r.country + ' ' + r.year, 'selection'); }
    else { state.selection.push(id); commit('选中 ' + r.country + ' ' + r.year, 'selection'); }
    renderAll();
  }

  function clearSelection() {
    if (!state.selection.length) return;
    state.selection = []; commit('清除全部选择', 'selection'); renderAll();
  }

  function resetAll() {
    state = initialState();
    commit('全部重置', 'reset');
    timeline[ptr].origin = 'reset';
    projStack = [clone(state.projection)]; projPtr = 0;
    renderAll(); toast('已回到初始状态（本次重置本身可撤销）', 'history');
  }

  /* ---------- 表格排序（独立归属，跨投影保持） ---------- */
  var tableSort = { key: null, dir: 'desc' };
  function cycleTableSort(key) {
    if (tableSort.key !== key) tableSort = { key: key, dir: 'desc' };
    else if (tableSort.dir === 'desc') tableSort.dir = 'asc';
    else tableSort = { key: null, dir: 'desc' };
    commit(tableSort.key ? '排序：' + key + ' ' + tableSort.dir : '取消排序', 'sort');
    renderAll();
  }

  /* ---------- Toast / 错误态 ---------- */
  function toast(msg, kind) {
    var t = document.createElement('div');
    t.className = 'toast toast-' + (kind || 'info');
    t.textContent = msg;
    $('toastStack').appendChild(t);
    setTimeout(function () { t.classList.add('out'); }, 2600);
    setTimeout(function () { t.remove(); }, 3000);
  }
  window.addEventListener('error', function (e) {
    toast('发生错误：' + (e.message || '未知'), 'error');
  });

  /* ---------- 事件接线 ---------- */
  function wire() {
    $('dimSeg').addEventListener('click', function (e) {
      var b = e.target.closest('.seg-btn');
      if (!b || b.getAttribute('data-dim') === state.projection.dim) return;
      var next = clone(state.projection); next.dim = b.getAttribute('data-dim');
      setProjection(next, '投影维度 → ' + DIMS[next.dim].label, 'dimension');
    });
    $('measureSel').addEventListener('change', function (e) {
      var next = clone(state.projection); next.measure = e.target.value;
      setProjection(next, '度量 → ' + MEASURES[next.measure].label, 'measure');
    });
    $('aggSel').addEventListener('change', function (e) {
      var next = clone(state.projection); next.agg = e.target.value;
      setProjection(next, '聚合 → ' + e.target.options[e.target.selectedIndex].text, 'agg');
    });
    $('sortSel').addEventListener('change', function (e) {
      var next = clone(state.projection); next.sort = e.target.value;
      setProjection(next, '排序 → ' + e.target.options[e.target.selectedIndex].text, 'sort');
    });

    $('probeList').addEventListener('click', function (e) {
      var btn = e.target.closest('.icon-btn'); if (!btn) return;
      var i = parseInt(btn.closest('.chip').getAttribute('data-i'), 10);
      if (btn.getAttribute('data-act') === 'rm') removeProbe(i); else toggleMute(i);
    });

    $('inspectorBody').addEventListener('click', function (e) { /* 由卡片内按钮接管 */ });
    $('clearSelection').onclick = clearSelection;
    $('emptyClear').onclick = clearProbes;
    $('clearProbes').onclick = clearProbes;
    $('resetBtn').onclick = resetAll;
    $('undoBtn').onclick = undo;
    $('redoBtn').onclick = redo;

    // 手动探针构建器
    var dimSel = $('manualDim');
    dimSel.innerHTML = Object.keys(DIMS).map(function (d) { return '<option value="' + d + '">' + DIMS[d].label + '</option>'; }).join('');
    dimSel.onchange = fillManualValues;
    function fillManualValues() {
      var vals = DIMS[dimSel.value].values;
      $('manualValue').innerHTML = vals.map(function (v) { return '<option value="' + esc(v) + '">' + esc(v) + '</option>'; }).join('');
    }
    fillManualValues();
    $('manualAdd').onclick = function () {
      var dim = dimSel.value, value = $('manualValue').value;
      if (hasProbe(dim, value)) { toast('该探针已存在：' + DIMS[dim].label + ' = ' + value, 'info'); return; }
      state.probes.push({ id: 'p' + (++probeSeq), dim: dim, value: String(value), origin: 'manual', muted: false });
      commit('探针 ' + DIMS[dim].label + '=' + value + '（手动）', 'probe');
      renderAll();
      toast('已添加探针：' + DIMS[dim].label + ' = ' + value + '（来源：手动）', 'add');
    };

    // 键盘：undo/redo
    document.addEventListener('keydown', function (e) {
      if (!(e.ctrlKey || e.metaKey)) return;
      var k = e.key.toLowerCase();
      if (k === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      else if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); redo(); }
    });

    // 表格行漫游（tbody 持久元素，仅绑一次；柱为原生 button，Enter/Space 原生触发 click）
    $('tableBody').addEventListener('keydown', function (e) {
      var dir = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0;
      if (!dir) return;
      var rowNodes = Array.prototype.slice.call($('tableBody').querySelectorAll('tr'));
      if (!rowNodes.length) return;
      e.preventDefault();
      var idx = rowNodes.indexOf(document.activeElement);
      var next = idx < 0 ? (dir > 0 ? 0 : rowNodes.length - 1)
        : Math.max(0, Math.min(rowNodes.length - 1, idx + dir));
      rowNodes[next].focus();
    });

    window.addEventListener('resize', function () { renderChart(); });
  }

  /* ---------- 启动：数据内联就绪，首屏直接渲染 ---------- */
  $('datasetMeta').textContent = T.records.length + ' 条观测 · ' + T.countries.length + ' 国 · ' + T.years[0] + '–' + T.years[T.years.length - 1] + ' · 数据内联就绪';
  wire();
  renderAll();
})();
