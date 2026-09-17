/* 星穹棱镜 · 状态层：投影/过滤状态、归属条、可回退历史、认知锚点 */
window.App = (function () {
  'use strict';

  var state = {
    x: 'radius', y: 'temp',      // 投影轴
    color: 'spec', size: null,   // 视觉编码
    filters: [],                 // [{id,dim,kind,lo,hi,values,src}]
    sel: new Set(),              // 选中（认知锚点：不随投影/回退重置）
    pins: new Set()              // 固定（认知锚点）
  };

  var hist = [], hptr = -1, fid = 0;
  var renderers = [];
  var hoveredId = null, detailId = null;

  /* ---------- 工具 ---------- */
  function dimByKey(k) {
    var i;
    for (i = 0; i < Data.NUMS.length; i++) if (Data.NUMS[i].key === k) return Data.NUMS[i];
    for (i = 0; i < Data.CATS.length; i++) if (Data.CATS[i].key === k) return Data.CATS[i];
    for (i = 0; i < Data.HIER.length; i++) if (Data.HIER[i].key === k) return Data.HIER[i];
    return null;
  }
  function isNumDim(k) { var d = dimByKey(k); return d && Data.NUMS.indexOf(d) >= 0; }
  function fmtV(k, v) {
    var d = dimByKey(k);
    if (!d) return String(v);
    if (Data.NUMS.indexOf(d) >= 0) return d.dp ? (+v).toFixed(d.dp) : String(v);
    return String(v);
  }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /* ---------- 过滤语义 ---------- */
  function matchFilter(r, f) {
    if (f.kind === 'range') return r[f.dim] >= f.lo && r[f.dim] <= f.hi;
    return f.values.indexOf(r[f.dim]) >= 0;
  }
  function visibleRows() {
    return Data.rows.filter(function (r) {
      for (var i = 0; i < state.filters.length; i++)
        if (!matchFilter(r, state.filters[i])) return false;
      return true;
    });
  }
  function filterLabel(f) {
    var d = dimByKey(f.dim);
    if (f.kind === 'range') {
      return d.name + ' ∈ [' + fmtV(f.dim, f.lo) + ', ' + fmtV(f.dim, f.hi) + '] ' + d.unit;
    }
    return d.name + ' ⊇ {' + f.values.join('，') + '}';
  }

  /* ---------- 历史（过滤+投影可回退；选中/固定不入历史） ---------- */
  function snap() {
    return {
      x: state.x, y: state.y, color: state.color, size: state.size,
      filters: JSON.parse(JSON.stringify(state.filters))
    };
  }
  function restore(s) {
    state.x = s.x; state.y = s.y; state.color = s.color; state.size = s.size;
    state.filters = JSON.parse(JSON.stringify(s.filters));
  }
  function commit(label, fn) {
    fn(state);
    hist = hist.slice(0, hptr + 1);
    hist.push({ label: label, t: new Date(), snap: snap() });
    hptr = hist.length - 1;
    render();
  }
  function undo() { if (hptr > 0) { hptr--; restore(hist[hptr].snap); render(); } }
  function redo() { if (hptr < hist.length - 1) { hptr++; restore(hist[hptr].snap); render(); } }
  function jump(i) { hptr = i; restore(hist[i].snap); render(); }

  /* ---------- 过滤变更 API（供货架/图区调用） ---------- */
  function addRangeFilter(dim, lo, hi, src) {
    var had = state.filters.filter(function (g) { return g.kind === 'range' && g.dim === dim; })[0];
    commit((had ? '调整过滤 ' : '过滤 ') + dimByKey(dim).name + ' ∈ [' + fmtV(dim, lo) + ', ' + fmtV(dim, hi) + ']',
      function (st) {
        st.filters = st.filters.filter(function (g) { return !(g.kind === 'range' && g.dim === dim); });
        st.filters.push({ id: 'f' + (fid++), dim: dim, kind: 'range', lo: lo, hi: hi, src: src });
      });
  }
  function toggleCatFilter(dim, val) {
    var existed = state.filters.filter(function (f) { return f.kind === 'cat' && f.dim === dim; })[0];
    var label = dimByKey(dim).name + ' ' + val;
    commit((existed ? '调整' : '过滤 ') + label, function (st) {
      var f = st.filters.filter(function (g) { return g.kind === 'cat' && g.dim === dim; })[0];
      if (!f) {
        var vals = dimByKey(dim).values.filter(function (v) { return v !== val; });
        st.filters.push({ id: 'f' + (fid++), dim: dim, kind: 'cat', values: vals, src: '类别勾选' });
      } else {
        var i = f.values.indexOf(val);
        if (i >= 0) f.values.splice(i, 1); else f.values.push(val);
        if (f.values.length === dimByKey(dim).values.length)
          st.filters = st.filters.filter(function (g) { return g !== f; });
      }
    });
  }
  function catChecked(dim, val) { // 该值当前是否被包含（无过滤=全包含）
    var f = state.filters.filter(function (g) { return g.kind === 'cat' && g.dim === dim; })[0];
    return !f || f.values.indexOf(val) >= 0;
  }
  function removeFilter(id) {
    var f = state.filters.filter(function (g) { return g.id === id; })[0];
    commit('移除过滤：' + (f ? filterLabel(f) : id), function (st) {
      st.filters = st.filters.filter(function (g) { return g.id !== id; });
    });
  }
  function clearFilters() {
    commit('清除全部 ' + state.filters.length + ' 个过滤', function (st) { st.filters = []; });
  }
  function setAxis(axis, dim) {
    if (state[axis] === dim) return;
    commit((axis === 'x' ? 'X 轴 → ' : 'Y 轴 → ') + dimByKey(dim).name, function (st) { st[axis] = dim; });
  }
  function setEnc(which, dim) {
    commit((which === 'color' ? '颜色 → ' : '大小 → ') + (dim ? dimByKey(dim).name : '无'),
      function (st) { st[which] = dim; });
  }

  /* ---------- 锚点操作（不入历史，实时生效） ---------- */
  function toggleSel(id) {
    if (state.sel.has(id)) state.sel.delete(id); else state.sel.add(id);
    render();
  }
  function setSel(ids) { state.sel = new Set(ids); render(); }
  function clearSel() { state.sel.clear(); render(); }
  function togglePin(id) {
    if (state.pins.has(id)) state.pins.delete(id); else state.pins.add(id);
    render();
  }
  function setHover(id) { hoveredId = id; render(); }
  function setDetail(id) { detailId = id; render(); }

  /* ---------- 渲染调度 ---------- */
  function render() {
    renderers.forEach(function (fn) { fn(); });
    document.getElementById('undoBtn').disabled = hptr <= 0;
    document.getElementById('redoBtn').disabled = hptr >= hist.length - 1;
    document.getElementById('encColor').value = state.color || '';
    document.getElementById('encSize').value = state.size || '';
  }

  /* ---------- 底部归属条 ---------- */
  function renderChips() {
    var vis = visibleRows();
    var hidden = 0;
    Data.rows.forEach(function (r) { if (state.sel.has(r.id)) hidden++; });
    hidden = hidden - vis.filter(function (r) { return state.sel.has(r.id); }).length;

    var html = '';
    html += chip('proj', 'X · ' + dimByKey(state.x).name, null, '投影');
    html += chip('proj', 'Y · ' + dimByKey(state.y).name, null, '投影');
    if (state.color) html += chip('proj', '颜色 · ' + dimByKey(state.color).name, 'color', '编码');
    if (state.size) html += chip('proj', '大小 · ' + dimByKey(state.size).name, 'size', '编码');
    state.filters.forEach(function (f) {
      html += chip('filt', filterLabel(f), f.id, f.src);
    });
    html += '<span class="chip anchor" title="认知锚点：跨维度切换与历史回退均保持">' +
      '◉ 选中 ' + state.sel.size + (hidden ? '（' + hidden + ' 被过滤遮蔽）' : '') + '</span>';
    if (state.pins.size) html += '<span class="chip anchor">★ 固定 ' + state.pins.size + '</span>';
    document.getElementById('chips').innerHTML = html;

    document.querySelectorAll('#chips .chip[data-remove]').forEach(function (el) {
      el.addEventListener('click', function () {
        var t = el.getAttribute('data-remove');
        if (t === 'color') setEnc('color', null);
        else if (t === 'size') setEnc('size', null);
        else removeFilter(t);
      });
    });

    document.getElementById('stateSummary').innerHTML =
      '显示 <b>' + vis.length + '</b> / ' + Data.rows.length + ' 条 · 过滤 <b>' + state.filters.length +
      '</b> · 视角「<b>' + esc(document.getElementById('lensName').value) + '</b>」';
  }
  function chip(kind, text, removeTarget, srcTag) {
    var h = '<span class="chip ' + kind + '" ' + (removeTarget ? 'data-remove="' + removeTarget + '" title="点击移除"' : '') + '>';
    if (srcTag) h += '<i class="src">' + esc(srcTag) + '</i>';
    h += esc(text);
    if (removeTarget) h += ' <b class="x">×</b>';
    return h + '</span>';
  }

  /* ---------- 右栏：锚点与详情 ---------- */
  function recRow(r, isPin) {
    var cls = state.sel.has(r.id) ? ' rec-sel' : '';
    return '<div class="rec' + cls + '" data-id="' + r.id + '">' +
      '<span class="dot spec-' + r.spec + '"></span>' +
      '<span class="recname">' + esc(r.name) + '</span>' +
      '<span class="recmeta">' + esc(r.constel) + ' · ESI ' + r.esi.toFixed(2) + '</span>' +
      (isPin
        ? '<button class="unpin" data-unpin="' + r.id + '" title="取消固定">✕</button>'
        : '<button class="unpin" data-pin="' + r.id + '" title="固定">★</button>') +
      '</div>';
  }
  function renderSide() {
    var vis = visibleRows();
    var selVis = [], selGhost = [];
    vis.forEach(function (r) { if (state.sel.has(r.id)) selVis.push(r); });
    Data.rows.forEach(function (r) { if (state.sel.has(r.id) && vis.indexOf(r) < 0) selGhost.push(r); });
    selVis = selVis.slice(0, 40);

    document.getElementById('anchorSummary').innerHTML =
      '<div class="acard"><b>' + state.sel.size + '</b> 选中<span>' +
      (selGhost.length ? selGhost.length + ' 条被当前过滤遮蔽，但仍保留' : '跨维度切换保持') +
      '</span></div>' +
      '<div class="acard"><b>' + state.pins.size + '</b> 固定<span>星标记录，任何状态变更不丢失</span></div>';

    document.getElementById('selCount').textContent = state.sel.size;
    document.getElementById('selList').innerHTML = selVis.length || selGhost.length
      ? selVis.map(function (r) { return recRow(r, state.pins.has(r.id)); }).join('') +
        (selGhost.length ? '<div class="ghostline">…另有 ' + selGhost.length + ' 条被过滤遮蔽</div>' : '')
      : '<div class="empty">在图上拖拽框选记录</div>';

    var pins = Data.rows.filter(function (r) { return state.pins.has(r.id); });
    document.getElementById('pinCount').textContent = pins.length;
    document.getElementById('pinList').innerHTML = pins.length
      ? pins.map(function (r) { return recRow(r, true); }).join('')
      : '<div class="empty">点击记录行的 ★ 固定</div>';

    renderDetail();
    document.querySelectorAll('.rec').forEach(function (el) {
      el.addEventListener('click', function () { setDetail(el.getAttribute('data-id')); });
    });
    document.querySelectorAll('[data-pin]').forEach(function (el) {
      el.addEventListener('click', function (e) { e.stopPropagation(); togglePin(el.getAttribute('data-pin')); });
    });
    document.querySelectorAll('[data-unpin]').forEach(function (el) {
      el.addEventListener('click', function (e) { e.stopPropagation(); togglePin(el.getAttribute('data-unpin')); });
    });
  }
  function renderDetail() {
    var el = document.getElementById('detail');
    var r = Data.byId[detailId] || (state.sel.size
      ? Data.byId[state.sel.values().next().value] : null);
    if (!r) { el.innerHTML = ''; return; }
    var h = '<div class="panelhead"><h2>详情</h2></div><div class="dcard">' +
      '<h3><span class="dot spec-' + r.spec + '"></span>' + esc(r.name) + '</h3>' +
      '<table>';
    Data.NUMS.forEach(function (d) {
      h += '<tr><td>' + d.name + '</td><td><b>' + fmtV(d.key, r[d.key]) + '</b> ' + d.unit + '</td></tr>';
    });
    h += '<tr><td>恒星光谱型</td><td><b>' + r.spec + '</b></td></tr>';
    h += '<tr><td>探测方法</td><td><b>' + esc(r.method) + '</b></td></tr>';
    h += '<tr><td>宜居带</td><td><b>' + r.hz + '</b></td></tr>';
    h += '<tr><td>星座 / 天区</td><td><b>' + esc(r.constel) + '</b> / ' + esc(r.zone) + '</td></tr>';
    h += '</table>';
    // 关系：同系统行星
    var sib = Data.rows.filter(function (x) { return x.sysName === r.sysName && x.id !== r.id; });
    if (sib.length) {
      h += '<p class="sibhead">同系统行星</p><div class="sibs">';
      sib.forEach(function (x) {
        h += '<button class="sib" data-sib="' + x.id + '">' + esc(x.name) + '</button>';
      });
      h += '</div>';
    }
    h += '</div>';
    el.innerHTML = h;
    el.querySelectorAll('[data-sib]').forEach(function (b) {
      b.addEventListener('click', function () { setDetail(b.getAttribute('data-sib')); });
    });
  }

  /* ---------- 历史抽屉 ---------- */
  function renderHist() {
    var drawer = document.getElementById('histDrawer');
    if (drawer.classList.contains('hidden')) return;
    var h = '';
    for (var i = hist.length - 1; i >= 0; i--) {
      var e = hist[i];
      h += '<li class="' + (i === hptr ? 'cur' : (i > hptr ? 'future' : '')) + '" data-i="' + i + '">' +
        '<span class="htime">' + e.t.toLocaleTimeString('zh-CN', { hour12: false }) + '</span>' +
        '<span class="hlabel">' + esc(e.label) + '</span>' +
        (i === hptr ? '<b class="htag">当前</b>' : '') + '</li>';
    }
    document.getElementById('histList').innerHTML = h;
    document.querySelectorAll('#histList li').forEach(function (li) {
      li.addEventListener('click', function () { jump(+li.getAttribute('data-i')); });
    });
  }

  /* ---------- 自检（?selftest=1）：验收标准在页面内可见验证 ---------- */
  function selftest() {
    var out = [], pass = 0;
    function t(name, fn) {
      try { var v = fn(); out.push([v === true, name, v === true ? '' : String(v)]); if (v === true) pass++; }
      catch (e) { out.push([false, name, e.message]); }
    }
    var nAll = Data.rows.length;
    t('数据就绪：' + nAll + ' 条记录随首屏同步生成', function () { return nAll > 400; });
    t('数值维度完备：每条记录 11 个有限数值', function () {
      return Data.rows.every(function (r) {
        return Data.NUMS.every(function (d) { return isFinite(r[d.key]); });
      });
    });
    t('范围维度与数据一致', function () {
      return Data.NUMS.every(function (d) {
        var lo = Infinity, hi = -Infinity;
        Data.rows.forEach(function (r) { lo = Math.min(lo, r[d.key]); hi = Math.max(hi, r[d.key]); });
        return Math.abs(lo - Data.extents[d.key][0]) < 1e-9 && Math.abs(hi - Data.extents[d.key][1]) < 1e-9;
      });
    });
    t('初始无过滤：可见 = 全集', function () { return visibleRows().length === nAll; });

    addRangeFilter('temp', 200, 650, '直方图框选');
    t('区间过滤生效：可见数 < 全集', function () { return visibleRows().length < nAll; });
    t('归属：过滤标签含维度名与谓词', function () {
      var f = state.filters[0];
      return filterLabel(f).indexOf('平衡温度') >= 0 && f.src === '直方图框选';
    });
    var selBefore = 14;
    setSel(visibleRows().slice(0, selBefore).map(function (r) { return r.id; }));
    t('框选 ' + selBefore + ' 条后选中数一致', function () { return state.sel.size === selBefore; });

    setAxis('y', 'esi'); // 维度切换
    t('维度切换不重置认知：选中保持', function () { return state.sel.size === selBefore; });
    t('维度切换不重置认知：过滤保持', function () {
      return state.filters.length >= 1 && visibleRows().length < nAll;
    });

    toggleCatFilter('hz', '是');
    t('类别过滤：勾掉「是」后不含该值', function () {
      return visibleRows().every(function (r) { return r.hz !== '是'; });
    });
    t('遮蔽归属：可见集被裁剪但选中集完整保留（锚点不丢弃）', function () {
      return state.sel.size === selBefore;
    });

    var hBefore = hist.length;
    undo();
    t('撤销：回退一步后过滤减少', function () { return state.filters.length < 2 && hist.length === hBefore; });
    redo();
    t('重做：恢复到回退前状态', function () { return state.filters.length >= 2; });
    var label0 = hist[0].label;
    jump(0);
    t('时间线跳转：回到「' + label0 + '」', function () { return state.filters.length === 0; });
    t('历史节点均有标签与快照', function () {
      return hist.every(function (e) { return e.label && e.snap && 'x' in e.snap; });
    });

    var panel = document.createElement('div');
    panel.id = 'selftest';
    var h = '<b>自检 selftest</b> — ' + pass + '/' + out.length + ' 通过' +
      (pass === out.length ? ' ✓' : ' ✗') + '<ul>';
    out.forEach(function (o) {
      h += '<li class="' + (o[0] ? 'ok' : 'bad') + '">' + (o[0] ? '✓' : '✗') + ' ' + esc(o[1]) +
        (o[2] ? ' <i>→ ' + esc(o[2]) + '</i>' : '') + '</li>';
    });
    panel.innerHTML = h + '</ul>';
    document.body.appendChild(panel);
  }

  /* ---------- 初始化 ---------- */
  function init() {
    hist.push({ label: '初始状态', t: new Date(), snap: snap() });
    hptr = 0;

    // ?demo=1：驱动一段真实交互（供截图取证）；?lens=名称 设视角名
    var qp = new URLSearchParams(location.search);
    if (qp.get('lens')) document.getElementById('lensName').value = qp.get('lens');
    if (qp.get('demo')) {
      addRangeFilter('temp', 200, 650, '直方图框选');
      toggleCatFilter('spec', 'M');
      var vs = visibleRows();
      setSel(vs.slice(0, 14).map(function (r) { return r.id; }));
      togglePin(vs[0].id); togglePin(vs[5].id);
      setAxis('y', 'esi');
      setTimeout(function () {
        document.getElementById('histDrawer').classList.remove('hidden'); render();
      }, 150);
    }

    document.getElementById('datastat').innerHTML =
      '<b>' + Data.rows.length + '</b> 颗行星 · <b>' + Data.nStars + '</b> 个系统 · <b>' +
      Data.NUMS.length + '</b> 数值维 · <b>' + (Data.CATS.length + Data.HIER.length) + '</b> 类别维';

    // 编码下拉：颜色=类别维度；大小=数值维度
    var cSel = document.getElementById('encColor'), sSel = document.getElementById('encSize');
    var oh = '<option value="">无</option>';
    Data.CATS.concat(Data.HIER).forEach(function (d) {
      oh += '<option value="' + d.key + '">' + d.name + '</option>';
    });
    cSel.innerHTML = oh;
    var osh = '<option value="">无</option>';
    Data.NUMS.forEach(function (d) { osh += '<option value="' + d.key + '">' + d.name + '</option>'; });
    sSel.innerHTML = osh;
    cSel.value = state.color; sSel.value = '';
    cSel.addEventListener('change', function () { setEnc('color', cSel.value || null); });
    sSel.addEventListener('change', function () { setEnc('size', sSel.value || null); });

    document.getElementById('undoBtn').addEventListener('click', undo);
    document.getElementById('redoBtn').addEventListener('click', redo);
    document.getElementById('histBtn').addEventListener('click', function () {
      document.getElementById('histDrawer').classList.toggle('hidden'); render();
    });
    document.getElementById('histClose').addEventListener('click', function () {
      document.getElementById('histDrawer').classList.add('hidden'); render();
    });
    document.getElementById('clearAll').addEventListener('click', clearFilters);
    document.getElementById('clearSel').addEventListener('click', clearSel);
    document.getElementById('lensName').addEventListener('change', render);

    document.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); }
    });

    renderers = [Shelf.render, Plot.render, renderChips, renderSide, renderHist];
    render();
  }

  return {
    init: init, render: render, commit: commit, undo: undo, redo: redo, jump: jump,
    selftest: selftest,
    state: state, hist: function () { return hist; }, hptr: function () { return hptr; },
    visibleRows: visibleRows, matchFilter: matchFilter, filterLabel: filterLabel,
    addRangeFilter: addRangeFilter, toggleCatFilter: toggleCatFilter, catChecked: catChecked,
    removeFilter: removeFilter, clearFilters: clearFilters,
    setAxis: setAxis, setEnc: setEnc,
    toggleSel: toggleSel, setSel: setSel, clearSel: clearSel, togglePin: togglePin,
    setHover: setHover, setDetail: setDetail,
    dimByKey: dimByKey, isNumDim: isNumDim, fmtV: fmtV, esc: esc,
    hoveredId: function () { return hoveredId; }, detailId: function () { return detailId; }
  };
})();
