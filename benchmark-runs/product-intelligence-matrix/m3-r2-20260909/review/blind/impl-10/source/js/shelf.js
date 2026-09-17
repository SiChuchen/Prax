/* 星穹棱镜 · 维度货架：直方图框选过滤 + 投影轴指派 + 类别勾选 */
window.Shelf = (function () {
  'use strict';
  var SPW = 220, SPH = 34, BINS = 30;

  function filterFor(dim) {
    return App.state.filters.filter(function (f) { return f.dim === dim; })[0] || null;
  }

  /* ---------- 数值维度行 ---------- */
  function numRow(d) {
    var f = filterFor(d.key);
    var ext = Data.extents[d.key];
    var lo = ext[0], hi = ext[1];
    var bins = new Array(BINS).fill(0);
    Data.rows.forEach(function (r) {
      var i = Math.min(BINS - 1, Math.floor((r[d.key] - lo) / (hi - lo) * BINS));
      if (i >= 0) bins[i]++;
    });
    var bmax = Math.max.apply(null, bins);
    var bw = SPW / BINS;
    var bars = '';
    for (var i = 0; i < BINS; i++) {
      var bh = bmax ? bins[i] / bmax * (SPH - 6) : 0;
      var inF = !f || ((i + 0.5) / BINS * (hi - lo) + lo) >= f.lo && ((i + 0.5) / BINS * (hi - lo) + lo) <= f.hi;
      bars += '<rect x="' + (i * bw + 0.5).toFixed(1) + '" y="' + (SPH - bh).toFixed(1) +
        '" width="' + (bw - 1).toFixed(1) + '" height="' + bh.toFixed(1) +
        '" class="hb' + (inF ? '' : ' dim') + '"></rect>';
    }
    var overlay = '';
    if (f) {
      var x1 = (f.lo - lo) / (hi - lo) * SPW, x2 = (f.hi - lo) / (hi - lo) * SPW;
      overlay = '<rect class="frange" x="' + x1.toFixed(1) + '" y="0" width="' + (x2 - x1).toFixed(1) +
        '" height="' + SPH + '"></rect>';
    }
    var badge = f ? '<button class="fbadge" data-clearf="' + f.id + '" title="点击移除该维过滤">' +
      App.fmtV(d.key, f.lo) + '–' + App.fmtV(d.key, f.hi) + ' ✕</button>' : '';
    var onX = App.state.x === d.key, onY = App.state.y === d.key;

    return '<div class="dim num' + (f ? ' filtered' : '') + '" data-dim="' + d.key + '">' +
      '<div class="dimrow"><span class="dname">' + d.name + '</span>' +
      '<span class="dunit">' + d.unit + '</span>' + badge +
      '<span class="spacer"></span>' +
      '<button class="ax' + (onX ? ' on' : '') + '" data-axis="x" data-dim="' + d.key + '">X</button>' +
      '<button class="ax' + (onY ? ' on' : '') + '" data-axis="y" data-dim="' + d.key + '">Y</button>' +
      '</div>' +
      '<svg class="spark" width="' + SPW + '" height="' + SPH + '" viewBox="0 0 ' + SPW + ' ' + SPH + '">' +
      bars + overlay +
      '<rect class="dragzone" x="0" y="0" width="' + SPW + '" height="' + SPH + '"></rect></svg>' +
      '<div class="dext">' + App.fmtV(d.key, lo) + ' – ' + App.fmtV(d.key, hi) + ' ' + d.unit + '</div>' +
      '</div>';
  }

  /* ---------- 类别/层级维度行 ---------- */
  function catRow(d) {
    var counts = {};
    d.values.forEach(function (v) { counts[v] = 0; });
    Data.rows.forEach(function (r) { if (counts[r[d.key]] !== undefined) counts[r[d.key]]++; });
    var f = filterFor(d.key);
    var vals = '';
    d.values.forEach(function (v) {
      var on = App.catChecked(d.key, v);
      vals += '<button class="cv' + (on ? ' on' : ' off') + '" data-cat="' + d.key +
        '" data-val="' + App.esc(v) + '"><i class="cb"></i>' + App.esc(v) +
        '<em>' + counts[v] + '</em></button>';
    });
    return '<div class="dim cat' + (f ? ' filtered' : '') + '">' +
      '<div class="dimrow"><span class="dname">' + d.name + '</span>' +
      (f ? '<button class="fbadge" data-clearf="' + f.id + '" title="点击移除">含 ' + f.values.length + ' 值 ✕</button>' : '') +
      '</div><div class="catvals">' + vals + '</div></div>';
  }

  /* ---------- 渲染 ---------- */
  function render() {
    var h = '';
    h += '<div class="dimgroup">数值维度（坐标轴 / 区间过滤）</div>';
    Data.NUMS.forEach(function (d) { h += numRow(d); });
    h += '<div class="dimgroup">类别与层级维度（勾选包含值）</div>';
    Data.CATS.forEach(function (d) { h += catRow(d); });
    Data.HIER.forEach(function (d) {
      h += catRow({ key: d.key, name: d.name, values: valuesOf(d.key) });
    });
    document.getElementById('dimList').innerHTML = h;
    document.getElementById('dimCount').textContent =
      Data.NUMS.length + ' 数值 · ' + (Data.CATS.length + Data.HIER.length) + ' 类别';
    wire();
  }
  function valuesOf(key) {
    var s = new Set();
    Data.rows.forEach(function (r) { s.add(r[key]); });
    return Array.from(s).sort();
  }

  /* ---------- 交互 ---------- */
  function wire() {
    document.querySelectorAll('.ax').forEach(function (b) {
      b.addEventListener('click', function () { App.setAxis(b.getAttribute('data-axis'), b.getAttribute('data-dim')); });
    });
    document.querySelectorAll('.cv').forEach(function (b) {
      b.addEventListener('click', function () { App.toggleCatFilter(b.getAttribute('data-cat'), b.getAttribute('data-val')); });
    });
    document.querySelectorAll('[data-clearf]').forEach(function (b) {
      b.addEventListener('click', function () { App.removeFilter(b.getAttribute('data-clearf')); });
    });
    // 直方图拖拽 → 区间过滤（归属：直方图框选）
    document.querySelectorAll('.spark').forEach(function (svg) {
      var dim = svg.parentElement.getAttribute('data-dim');
      svg.addEventListener('mousedown', function (e) { startDrag(e, svg, dim); });
    });
  }

  function startDrag(e, svg, dim) {
    e.preventDefault();
    var rect = svg.getBoundingClientRect();
    var ext = Data.extents[dim];
    var sx = e.clientX - rect.left;
    var ghost = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    ghost.setAttribute('class', 'frange drag');
    ghost.setAttribute('y', 0);
    ghost.setAttribute('height', SPH);
    svg.appendChild(ghost);
    var moved = false;

    function mv(ev) {
      var cx = Math.max(0, Math.min(SPW, ev.clientX - rect.left));
      moved = moved || Math.abs(cx - sx) > 2;
      var x1 = Math.min(sx, cx), x2 = Math.max(sx, cx);
      ghost.setAttribute('x', x1); ghost.setAttribute('width', Math.max(1, x2 - x1));
    }
    function up(ev) {
      document.removeEventListener('mousemove', mv);
      document.removeEventListener('mouseup', up);
      var cx = Math.max(0, Math.min(SPW, ev.clientX - rect.left));
      svg.removeChild(ghost);
      if (!moved) return; // 单击不设过滤
      var x1 = Math.min(sx, cx), x2 = Math.max(sx, cx);
      var lo = ext[0] + x1 / SPW * (ext[1] - ext[0]);
      var hi = ext[0] + x2 / SPW * (ext[1] - ext[0]);
      var f = App.state.filters.filter(function (g) { return g.dim === dim; })[0];
      if (f && Math.abs(lo - f.lo) < (ext[1] - ext[0]) * 0.002 && Math.abs(hi - f.hi) < (ext[1] - ext[0]) * 0.002) return;
      App.addRangeFilter(dim, lo, hi, '直方图框选');
    }
    document.addEventListener('mousemove', mv);
    document.addEventListener('mouseup', up);
  }

  return { render: render };
})();
