/* 星穹棱镜 · 主屏散点：投影轴 / 编码 / 框选 / 遮蔽幽灵点（认知连续性） */
window.Plot = (function () {
  'use strict';
  var M = { l: 58, r: 18, t: 12, b: 42 };
  var SVG_NS = 'http://www.w3.org/2000/svg';

  var SPEC_COLORS = { M: '#e0566e', K: '#f0975a', G: '#e8d44d', F: '#f2f0e6', A: '#8ecdf5', B: '#7a8ef5' };
  var PALETTE = ['#5ab4f0', '#f0975a', '#67d98b', '#e0566e', '#c084fc', '#e8d44d', '#4fd8c8', '#f272a8'];

  function colorFor(dimKey, val) {
    if (dimKey === 'spec') return SPEC_COLORS[val] || '#999';
    var d = App.dimByKey(dimKey);
    var vals = d.values || catValues(dimKey);
    return PALETTE[Math.max(0, vals.indexOf(val)) % PALETTE.length];
  }
  function catValues(key) {
    var s = new Set();
    Data.rows.forEach(function (r) { s.add(r[key]); });
    return Array.from(s).sort();
  }

  /* ---------- 比例尺：跨度大自动对数 ---------- */
  function makeScale(dim, a0, a1) {
    var ext = Data.extents[dim];
    var log = ext[0] > 0 && ext[1] / ext[0] > 300;
    var d0 = log ? Math.log10(Math.max(ext[0], 1e-3)) : ext[0];
    var d1 = log ? Math.log10(ext[1]) : ext[1];
    function to(v) {
      var t = (log ? Math.log10(Math.max(v, 1e-3)) : v) - d0;
      return a0 + t / (d1 - d0) * (a1 - a0);
    }
    function inv(px) {
      var t = (px - a0) / (a1 - a0) * (d1 - d0) + d0;
      return log ? Math.pow(10, t) : t;
    }
    return { to: to, inv: inv, log: log, d0: d0, d1: d1, ext: ext };
  }
  function ticks(sc, n) {
    var out = [];
    if (sc.log) {
      for (var e = Math.ceil(sc.d0); e <= Math.floor(sc.d1); e++) out.push(Math.pow(10, e));
      if (out.length < 2) out = [Math.pow(10, sc.d0), Math.pow(10, sc.d1)];
      return out;
    }
    var span = sc.d1 - sc.d0, step = Math.pow(10, Math.floor(Math.log10(span / n)));
    var err = span / n / step;
    if (err >= 7.5) step *= 10; else if (err >= 3.5) step *= 5; else if (err >= 1.5) step *= 2;
    for (var v = Math.ceil(sc.d0 / step) * step; v <= sc.d1 + 1e-9; v += step) out.push(+v.toFixed(6));
    return out;
  }
  function fmtTick(v) {
    if (Math.abs(v) >= 1000) return (v / 1000) + 'k';
    if (Math.abs(v) >= 10) return String(Math.round(v));
    return String(+v.toFixed(1));
  }

  /* ---------- 渲染 ---------- */
  function render() {
    var svg = document.getElementById('plot');
    var wrap = document.getElementById('plotwrap');
    var W = wrap.clientWidth || 900, H = wrap.clientHeight || 560;
    svg.setAttribute('width', W); svg.setAttribute('height', H);
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    var st = App.state;
    var vis = App.visibleRows();
    var selGhost = [];
    Data.rows.forEach(function (r) { if (st.sel.has(r.id) && vis.indexOf(r) < 0) selGhost.push(r); });

    var iw = W - M.l - M.r, ih = H - M.t - M.b;
    var sx = makeScale(st.x, M.l, M.l + iw);
    var sy = makeScale(st.y, M.t + ih, M.t); // y 反向

    var s = '<rect id="plotbg" x="' + M.l + '" y="' + M.t + '" width="' + iw + '" height="' + ih + '" fill="transparent"/>';
    // 网格 + 刻度
    ticks(sx, 6).forEach(function (v) {
      var x = sx.to(v);
      s += '<line x1="' + x + '" y1="' + M.t + '" x2="' + x + '" y2="' + (M.t + ih) + '" class="gridl"/>' +
        '<text x="' + x + '" y="' + (H - M.b + 16) + '" class="tick" text-anchor="middle">' + fmtTick(v) + '</text>';
    });
    ticks(sy, 5).forEach(function (v) {
      var y = sy.to(v);
      s += '<line x1="' + M.l + '" y1="' + y + '" x2="' + (M.l + iw) + '" y2="' + y + '" class="gridl"/>' +
        '<text x="' + (M.l - 8) + '" y="' + (y + 4) + '" class="tick" text-anchor="end">' + fmtTick(v) + '</text>';
    });
    var dx = App.dimByKey(st.x), dy = App.dimByKey(st.y);
    s += '<text x="' + (M.l + iw / 2) + '" y="' + (H - 8) + '" class="axisname" text-anchor="middle">' +
      dx.name + (dx.unit ? ' (' + dx.unit + ')' : '') + (sx.log ? ' · 对数轴' : '') + '</text>';
    s += '<text x="' + (M.l - 44) + '" y="' + (M.t + ih / 2) + '" class="axisname" text-anchor="middle" transform="rotate(-90 ' + (M.l - 44) + ' ' + (M.t + ih / 2) + ')">' +
      dy.name + (dy.unit ? ' (' + dy.unit + ')' : '') + (sy.log ? ' · 对数轴' : '') + '</text>';

    // 大小编码
    var sizeSc = null;
    if (st.size) {
      var e2 = Data.extents[st.size];
      sizeSc = function (v) { return 2 + 4.5 * (v - e2[0]) / (e2[1] - e2[0]); };
    }

    // 遮蔽幽灵点（选中但被过滤遮蔽 —— 认知锚）
    selGhost.forEach(function (r) {
      s += pt(r, sx, sy, sizeSc, ' ghostpt');
    });
    // 可见点
    vis.forEach(function (r) {
      var cls = 'pt' + (st.sel.has(r.id) ? ' sel' : '') + (App.state.pins.has(r.id) ? ' pinned' : '');
      s += pt(r, sx, sy, sizeSc, ' ' + cls);
    });
    // 固定星标
    vis.forEach(function (r) {
      if (st.pins.has(r.id)) {
        s += '<text class="pinstar" x="' + (sx.to(r[st.x]) + 6) + '" y="' + (sy.to(r[st.y]) - 6) + '">★</text>';
      }
    });

    s += '<rect id="brushbox" class="hidden" x="0" y="0" width="0" height="0"/>';
    svg.innerHTML = s;

    document.getElementById('plotTitle').innerHTML = dx.name + ' <i>×</i> ' + dy.name +
      ' <span class="plotmeta">显示 ' + vis.length + ' 条' + (sx.log ? ' · X 对数' : '') + (sy.log ? ' · Y 对数' : '') + '</span>';

    renderLegend(vis);
    wire(svg, sx, sy, vis);
  }

  function pt(r, sx, sy, sizeSc, cls) {
    var x = sx.to(r[App.state.x]), y = sy.to(r[App.state.y]);
    var rad = sizeSc ? sizeSc(r[App.state.size]) : 3.2;
    var fill = App.state.color ? colorFor(App.state.color, r[App.state.color]) : '#5ab4f0';
    var h = '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="' + rad.toFixed(1) +
      '" fill="' + fill + '" class="' + cls.trim() + '" data-id="' + r.id + '">';
    h += '<title>' + App.esc(r.name) + '\n' + App.dimByKey(App.state.x).name + ': ' + App.fmtV(App.state.x, r[App.state.x]) +
      ' · ' + App.dimByKey(App.state.y).name + ': ' + App.fmtV(App.state.y, r[App.state.y]) +
      '\nESI ' + r.esi.toFixed(2) + ' · ' + App.esc(r.constel) + ' · ' + App.esc(r.method) + '</title>';
    return h + '</circle>';
  }

  function renderLegend(vis) {
    var el = document.getElementById('legend');
    if (!App.state.color) { el.innerHTML = ''; return; }
    var d = App.dimByKey(App.state.color);
    var vals = d.values || catValues(App.state.color);
    var counts = {};
    vis.forEach(function (r) { counts[r[App.state.color]] = (counts[r[App.state.color]] || 0) + 1; });
    var h = '<b>' + d.name + '</b>';
    vals.slice(0, 9).forEach(function (v) {
      if (!counts[v]) return;
      h += '<span class="lg"><i style="background:' + colorFor(App.state.color, v) + '"></i>' +
        App.esc(v) + ' <em>' + counts[v] + '</em></span>';
    });
    if (vals.length > 9) h += '<span class="lg">…</span>';
    el.innerHTML = h;
  }

  /* ---------- 交互：悬停 / 点击选中 / 拖拽框选 ---------- */
  function wire(svg, sx, sy) {
    var bg = svg.querySelector('#plotbg');
    var box = svg.querySelector('#brushbox');
    var shift = false;

    svg.querySelectorAll('circle.pt').forEach(function (c) {
      c.addEventListener('click', function (e) {
        e.stopPropagation();
        App.toggleSel(c.getAttribute('data-id'));
        App.setDetail(c.getAttribute('data-id'));
      });
    });

    function pos(ev) {
      var r = svg.getBoundingClientRect();
      return [ev.clientX - r.left, ev.clientY - r.top];
    }
    bg.addEventListener('mousedown', function (e) {
      if (e.target !== bg) return;
      shift = e.shiftKey;
      var p0 = pos(e), active = true;
      box.classList.remove('hidden');

      function mv(ev) {
        var p1 = pos(ev);
        box.setAttribute('x', Math.min(p0[0], p1[0]));
        box.setAttribute('y', Math.min(p0[1], p1[1]));
        box.setAttribute('width', Math.abs(p1[0] - p0[0]));
        box.setAttribute('height', Math.abs(p1[1] - p0[1]));
      }
      function up(ev) {
        document.removeEventListener('mousemove', mv);
        document.removeEventListener('mouseup', up);
        box.classList.add('hidden');
        if (!active) return; active = false;
        var p1 = pos(ev);
        var x0 = Math.min(p0[0], p1[0]), x1 = Math.max(p0[0], p1[0]);
        var y0 = Math.min(p0[1], p1[1]), y1 = Math.max(p0[1], p1[1]);
        if (x1 - x0 < 4 && y1 - y0 < 4) { if (!shift) App.clearSel(); return; } // 单击空白清除
        var vx0 = sx.inv(x0), vx1 = sx.inv(x1);
        var vy0 = sy.inv(y1), vy1 = sy.inv(y0);
        var ids = [];
        App.visibleRows().forEach(function (r) {
          var vx = r[App.state.x], vy = r[App.state.y];
          if (vx >= vx0 && vx <= vx1 && vy >= vy0 && vy <= vy1) ids.push(r.id);
        });
        if (shift) { ids.forEach(function (id) { if (!App.state.sel.has(id)) App.state.sel.add(id); }); App.render(); }
        else App.setSel(ids);
        if (ids.length) App.setDetail(ids[0]);
      }
      document.addEventListener('mousemove', mv);
      document.addEventListener('mouseup', up);
    });
  }

  window.addEventListener('resize', function () { if (window.App) App.render(); });

  return { render: render };
})();
