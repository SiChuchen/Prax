/* AURORA Dimensional Explorer — vanilla JS, classic scripts (file:// safe).
   Architecture: state is owned by clearly named owners; every render is a pure
   function of state. Selection attaches to record id, so re-projecting
   dimensions never resets cognition (user_job success criterion).
   State owners:
     projection+scale → app root (undoable via history stack)
     filters          → per-dimension controls in the rail, mirrored as chips
     selection        → app root Set<recordId>
     viewport         → chart axis extents (derived)
     inspector/detail → derived from selection                                     */
(function () {
  'use strict';

  var CAT = window.CATALOG;
  var DIMS = CAT.dimensions;
  var DIM_BY_ID = {};
  DIMS.forEach(function (d) { DIM_BY_ID[d.id] = d; });

  var DEFAULT_SLOTS = { x: 'radius', y: 'period', color: 'star_class', size: 'mass' };
  var DEFAULT_SCALES = { x: 'lin', y: 'log' };

  var state = {
    slots: { x: DEFAULT_SLOTS.x, y: DEFAULT_SLOTS.y, color: DEFAULT_SLOTS.color, size: DEFAULT_SLOTS.size },
    scales: { x: 'lin', y: 'log' },
    filters: [],            // [{dim, lo, hi} | {dim, set:Set}] — one owner per dimension
    selection: new Set(),   // record ids — survives projection & filter changes
    selectedId: null,       // inspector binding (also survives re-projection)
    hist: [],               // projection history for undo
    sort: { key: 'id', dir: 1 }
  };

  var el = function (id) { return document.getElementById(id); };
  var canvas, ctx, tip;
  var geo = null;          // current chart geometry for hit-testing
  var hoverId = null;

  /* ---------------- scale / format helpers ---------------- */
  function fmtVal(dim, v) {
    if (v == null || isNaN(v)) return '–';
    var s = Number(v).toFixed(dim.fmt != null ? dim.fmt : 2);
    return dim.unit ? s + ' ' + dim.unit : s;
  }
  function val(r, dimId) { return r[dimId]; }
  function transform(v, scale) { return scale === 'log' ? Math.log(v) : v; }
  function extent(records, dimId, scale) {
    var lo = Infinity, hi = -Infinity;
    for (var i = 0; i < records.length; i++) {
      var v = transform(records[i][dimId], scale);
      if (v < lo) lo = v; if (v > hi) hi = v;
    }
    if (lo === hi) { lo -= 1; hi += 1; }
    var pad = (hi - lo) * 0.05;
    return [lo - pad, hi + pad];
  }
  function niceTicks(lo, hi, n, scale) {
    var ticks = [], span = hi - lo, step0 = span / n;
    var mag = Math.pow(10, Math.floor(Math.log(step0) / Math.LN10));
    var norm = step0 / mag;
    var step = (norm < 1.5 ? 1 : norm < 3.5 ? 2 : norm < 7.5 ? 5 : 10) * mag;
    var t = Math.ceil(lo / step) * step;
    for (; t <= hi + 1e-9; t += step) {
      var v = scale === 'log' ? Math.exp(t) : t;
      ticks.push({ v: v, t: Math.abs(v) >= 1000 ? Math.round(v).toLocaleString('en-US') : String(Math.round(v * 100) / 100) });
    }
    return ticks;
  }

  /* ---------------- filtering (owned state) ---------------- */
  function matches(r, f) {
    var dim = DIM_BY_ID[f.dim];
    if (dim.type === 'q') return r[f.dim] >= f.lo && r[f.dim] <= f.hi;
    return f.set.has(String(r[f.dim]));
  }
  function inScope() {
    return CAT.records.filter(function (r) { return state.filters.every(function (f) { return matches(r, f); }); });
  }
  function filterLabel(f) {
    var dim = DIM_BY_ID[f.dim];
    if (dim.type === 'q') return fmtVal(dim, f.lo).replace(/ /g, '') + '–' + fmtVal(dim, f.hi).replace(/ /g, '');
    var vals = dim.cats.filter(function (c) { return f.set.has(c); });
    return vals.length <= 3 ? vals.join(', ') : vals.length + ' of ' + dim.cats.length;
  }

  /* ---------------- selection (identity-owned) ---------------- */
  function setSelection(ids, anchorId) {
    state.selection = new Set(ids);
    state.selectedId = anchorId != null ? anchorId : (ids.length ? ids[ids.length - 1] : null);
  }

  /* ---------------- projection changes (owned + undoable) ---------------- */
  function pushHist() { state.hist.push({ x: state.slots.x, y: state.slots.y, color: state.slots.color, size: state.slots.size }); if (state.hist.length > 60) state.hist.shift(); }
  function setSlot(slot, dimId) {
    if (state.slots[slot] === dimId) return;
    pushHist();
    var prev = state.slots[slot];
    state.slots[slot] = dimId;
    // A dimension can only sit in one slot: swap, don't duplicate.
    for (var s in state.slots) if (s !== slot && state.slots[s] === dimId) state.slots[s] = prev;
    renderAll();
  }
  function undoProjection() {
    if (!state.hist.length) return;
    state.slots = state.hist.pop();
    renderAll();
  }
  function resetProjection() {
    pushHist();
    state.slots = { x: DEFAULT_SLOTS.x, y: DEFAULT_SLOTS.y, color: DEFAULT_SLOTS.color, size: DEFAULT_SLOTS.size };
    state.scales = { x: DEFAULT_SCALES.x, y: DEFAULT_SCALES.y };
    renderAll();
  }
  function toggleScale(axis) {
    state.scales[axis] = state.scales[axis] === 'log' ? 'lin' : 'log';
    renderAll();
  }

  /* ---------------- render: header ---------------- */
  function renderHeader(inScopeN) {
    el('scope-summary').innerHTML =
      '<b>' + inScopeN.toLocaleString('en-US') + '</b> / ' + CAT.records.length.toLocaleString('en-US') +
      ' in scope · <span class="sel-count">' + state.selection.size + ' selected</span>' +
      (state.hist.length ? ' · <span title="projection changes can be undone">' + state.hist.length + ' undoable</span>' : '');
    el('btn-undo').disabled = state.hist.length === 0;
    el('btn-clear-filters').disabled = state.filters.length === 0;
    el('btn-clear-selection').disabled = state.selection.size === 0;
  }

  /* ---------------- render: projection rail ---------------- */
  function renderRail() {
    ['x', 'y', 'color', 'size'].forEach(function (slot) {
      var sel = el('slot-' + slot);
      if (sel.value !== state.slots[slot]) sel.value = state.slots[slot];
      var toggle = document.querySelector('.scale-t[data-axis="' + slot + '"]');
      if (toggle) {
        toggle.textContent = state.scales[slot] === 'log' ? 'log' : 'lin';
        toggle.setAttribute('aria-pressed', String(state.scales[slot] === 'log'));
      }
    });
    // filter dot + active summary per dimension row
    DIMS.forEach(function (dim) {
      var row = document.querySelector('.dim-row[data-dim="' + dim.id + '"]');
      if (!row) return;
      var f = state.filters.filter(function (x) { return x.dim === dim.id; })[0];
      row.querySelector('.filter-dot').hidden = !f;
      row.querySelector('.dim-active').textContent = f ? filterLabel(f) : '';
    });
  }

  function buildRail() {
    ['x', 'y', 'color', 'size'].forEach(function (slot) {
      var sel = el('slot-' + slot);
      sel.innerHTML = DIMS.map(function (d) { return '<option value="' + d.id + '">' + d.label + '</option>'; }).join('');
      sel.value = state.slots[slot];
      sel.setAttribute('aria-label', slot + ' encoding slot dimension');
      sel.addEventListener('change', function () { setSlot(slot, sel.value); });
    });

    var lib = el('dimension-library');
    lib.innerHTML = DIMS.map(function (dim) {
      var controls;
      if (dim.type === 'q') {
        controls =
          '<div class="hint">Range filter (owner: ' + dim.label + ')</div>' +
          '<div class="range-val"><span id="rq-' + dim.id + '-lo"></span><span id="rq-' + dim.id + '-hi"></span></div>' +
          '<div class="range-pair">' +
          '<input type="range" id="rf-' + dim.id + '-lo" aria-label="' + dim.label + ' minimum">' +
          '<input type="range" id="rf-' + dim.id + '-hi" aria-label="' + dim.label + ' maximum"></div>';
      } else {
        controls =
          '<div class="hint">Include classes (owner: ' + dim.label + ')</div>' +
          '<div class="cat-list">' + dim.cats.map(function (c) {
            var n = CAT.records.filter(function (r) { return r[dim.id] === c; }).length;
            return '<label><input type="checkbox" value="' + c + '" checked> ' + c +
                   '<span class="cat-count">' + n + '</span></label>';
          }).join('') + '</div>';
      }
      return '<details class="dim-row" data-dim="' + dim.id + '">' +
        '<summary><span class="dim-caret">▶</span><span class="dim-label">' + dim.label + '</span>' +
        '<span class="dim-active" style="font-family:var(--mono);font-size:10px;color:var(--accent)"></span>' +
        '<span class="badge ' + dim.type + '">' + (dim.type === 'q' ? 'Q' : 'C') + '</span>' +
        '<span class="filter-dot" hidden></span></summary>' +
        '<div class="dim-controls">' + controls +
        '<div class="dim-reset"><button class="link-btn" data-clear="' + dim.id + '">Remove ' + dim.label + ' filter</button></div>' +
        '</div></details>';
    }).join('');

    // wire per-axis lin/log toggles (viewport-owned, not part of projection undo)
    document.querySelectorAll('.scale-t').forEach(function (btn) {
      btn.addEventListener('click', function () { toggleScale(btn.getAttribute('data-axis')); });
    });
    // wire range filters
    DIMS.filter(function (d) { return d.type === 'q'; }).forEach(function (dim) {
      var vals = CAT.records.map(function (r) { return r[dim.id]; });
      var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
      var rlo = el('rf-' + dim.id + '-lo'), rhi = el('rf-' + dim.id + '-hi');
      var step = (hi - lo) / 200 || 0.01;
      [rlo, rhi].forEach(function (r) { r.min = lo; r.max = hi; r.step = step; });
      rlo.value = lo; rhi.value = hi;
      function update() {
        var a = parseFloat(rlo.value), b = parseFloat(rhi.value);
        if (a > b) { var t = a; a = b; b = t; }
        el('rq-' + dim.id + '-lo').textContent = fmtVal(dim, a);
        el('rq-' + dim.id + '-hi').textContent = fmtVal(dim, b);
        var others = state.filters.filter(function (f) { return f.dim !== dim.id; });
        var full = a <= lo + 1e-9 && b >= hi - 1e-9;
        if (full) state.filters = others;
        else {
          var mine = state.filters.filter(function (f) { return f.dim === dim.id; })[0];
          if (mine) { mine.lo = a; mine.hi = b; state.filters = others.concat([mine]); }
          else state.filters = others.concat([{ dim: dim.id, lo: a, hi: b }]);
        }
        renderAll();
      }
      rlo.addEventListener('input', update);
      rhi.addEventListener('input', update);
    });
    // wire categorical filters
    DIMS.filter(function (d) { return d.type === 'c'; }).forEach(function (dim) {
      var boxes = Array.prototype.slice.call(
        document.querySelectorAll('.dim-row[data-dim="' + dim.id + '"] input[type="checkbox"]'));
      boxes.forEach(function (box) {
        box.addEventListener('change', function () {
          var checked = boxes.filter(function (b) { return b.checked; }).map(function (b) { return b.value; });
          var others = state.filters.filter(function (f) { return f.dim !== dim.id; });
          if (checked.length === 0 || checked.length === dim.cats.length) state.filters = others;
          else {
            var mine = state.filters.filter(function (f) { return f.dim === dim.id; })[0];
            var set = new Set(checked);
            if (mine) { mine.set = set; state.filters = others.concat([mine]); }
            else state.filters = others.concat([{ dim: dim.id, set: set }]);
          }
          renderAll();
        });
      });
    });
    // per-dimension reset (individual revert)
    lib.addEventListener('click', function (e) {
      var id = e.target.getAttribute && e.target.getAttribute('data-clear');
      if (!id) return;
      state.filters = state.filters.filter(function (f) { return f.dim !== id; });
      var dim = DIM_BY_ID[id];
      if (dim.type === 'q') {
        var vals = CAT.records.map(function (r) { return r[id]; });
        el('rf-' + id + '-lo').value = Math.min.apply(null, vals);
        el('rf-' + id + '-hi').value = Math.max.apply(null, vals);
      } else {
        document.querySelectorAll('.dim-row[data-dim="' + id + '"] input[type="checkbox"]').forEach(function (b) { b.checked = true; });
      }
      renderAll();
    });
    // caret rotation for <details>
    lib.addEventListener('toggle', function (e) {
      var s = e.target.querySelector('.dim-caret');
      if (s) s.textContent = e.target.open ? '▼' : '▶';
    }, true);
  }

  /* ---------------- render: filter chips ---------------- */
  function renderChips() {
    var wrap = el('filter-chips');
    if (!state.filters.length) { wrap.innerHTML = '<span class="empty">No active filters — add them from the dimension rail</span>'; return; }
    wrap.innerHTML = state.filters.map(function (f, i) {
      var dim = DIM_BY_ID[f.dim];
      return '<span class="chip" role="listitem" data-i="' + i + '" title="Owner dimension: ' + dim.label + '">' +
        '<span class="owner">' + dim.label + '</span><span class="pred">' + filterLabel(f) + '</span>' +
        '<button class="chip-x" data-remove="' + i + '" aria-label="Remove ' + dim.label + ' filter" title="Remove exactly this filter">×</button></span>';
    }).join('');
  }

  /* ---------------- render: chart ---------------- */
  var CAT_PALETTE = ['#4ea1ff', '#ffb454', '#58d68d', '#ff7ab6', '#b48cff', '#4dd0e1'];
  var Q_STOPS = [[65, 68, 135], [42, 120, 142], [34, 168, 132], [122, 209, 81], [253, 231, 37]];
  function qColor(t) {
    t = Math.max(0, Math.min(1, t)) * (Q_STOPS.length - 1);
    var i = Math.min(Q_STOPS.length - 2, Math.floor(t)), f = t - i;
    var a = Q_STOPS[i], b = Q_STOPS[i + 1];
    return 'rgb(' + Math.round(a[0] + (b[0] - a[0]) * f) + ',' + Math.round(a[1] + (b[1] - a[1]) * f) + ',' + Math.round(a[2] + (b[2] - a[2]) * f) + ')';
  }
  function colorFor(r, dim) {
    if (dim.type === 'c') return CAT_PALETTE[dim.cats.indexOf(r[dim.id]) % CAT_PALETTE.length];
    return qColor((r[dim.id] - dim._min) / (dim._max - dim._min || 1));
  }
  function renderLegend(dim) {
    var lg = el('legend');
    if (dim.type === 'c') {
      lg.innerHTML = '<div class="legend-cats"><span class="legend-title">' + dim.label + '</span>' +
        dim.cats.map(function (c, i) {
          return '<span class="lc"><span class="sw" style="background:' + CAT_PALETTE[i % CAT_PALETTE.length] + '"></span>' + c + '</span>';
        }).join('') + '</div>';
    } else {
      lg.innerHTML = '<div class="legend-title">' + dim.label + (dim.unit ? ' (' + dim.unit + ')' : '') + '</div>' +
        '<div class="legend-grad" style="background:linear-gradient(to right,' + Q_STOPS.map(function (s, i) { return 'rgb(' + s.join(',') + ') ' + (i / (Q_STOPS.length - 1) * 100) + '%'; }).join(',') + ')"></div>' +
        '<div class="legend-scale-labels"><span>' + dim._min.toLocaleString('en-US') + '</span><span>' + dim._max.toLocaleString('en-US') + '</span></div>';
    }
    var sdim = DIM_BY_ID[state.slots.size];
    lg.innerHTML += '<div class="legend-size">◎ size = ' + sdim.label + '</div>';
  }

  function renderChart(inScopeRecords) {
    if (!ctx) return;
    var rect = canvas.parentElement.getBoundingClientRect();
    var dpr = window.devicePixelRatio || 1;
    if (canvas.width !== Math.round(rect.width * dpr) || canvas.height !== Math.round(rect.height * dpr)) {
      canvas.width = Math.round(rect.width * dpr); canvas.height = Math.round(rect.height * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var W = rect.width, H = rect.height;
    ctx.clearRect(0, 0, W, H);
    if (!inScopeRecords.length) { geo = null; return; }

    var xd = DIM_BY_ID[state.slots.x], yd = DIM_BY_ID[state.slots.y];
    var M = { l: 56, r: 16, t: 12, b: 34 };
    var pw = W - M.l - M.r, ph = H - M.t - M.b;
    var xex = extent(inScopeRecords, xd.id, state.scales.x);
    var yex = extent(inScopeRecords, yd.id, state.scales.y);
    // normalized color domain over in-scope records
    var cmin = Infinity, cmax = -Infinity;
    if (xd && yd) {
      var cd = DIM_BY_ID[state.slots.color];
      if (cd.type === 'q') {
        inScopeRecords.forEach(function (r) { var v = r[cd.id]; if (v < cmin) cmin = v; if (v > cmax) cmax = v; });
        cd._min = cmin; cd._max = cmax;
      }
    }
    var sd = DIM_BY_ID[state.slots.size];
    var smin = Infinity, smax = -Infinity;
    inScopeRecords.forEach(function (r) { var v = r[sd.id]; if (v < smin) smin = v; if (v > smax) smax = v; });

    function px(v) { return M.l + (transform(v, state.scales.x) - xex[0]) / (xex[1] - xex[0]) * pw; }
    function py(v) { return H - M.b - (transform(v, state.scales.y) - yex[0]) / (yex[1] - yex[0]) * ph; }

    // grid + ticks
    ctx.font = '10px ui-monospace, Consolas, monospace';
    ctx.fillStyle = '#5b6572'; ctx.strokeStyle = '#1c222c'; ctx.lineWidth = 1;
    niceTicks(xex[0], xex[1], 6, state.scales.x).forEach(function (tk) {
      var x = px(tk.v);
      ctx.beginPath(); ctx.moveTo(x, M.t); ctx.lineTo(x, H - M.b); ctx.stroke();
      ctx.textAlign = 'center'; ctx.fillText(tk.t, x, H - M.b + 14);
    });
    niceTicks(yex[0], yex[1], 5, state.scales.y).forEach(function (tk) {
      var y = py(tk.v);
      ctx.beginPath(); ctx.moveTo(M.l, y); ctx.lineTo(W - M.r, y); ctx.stroke();
      ctx.textAlign = 'right'; ctx.fillText(tk.t, M.l - 6, y + 3);
    });
    // frame + axis titles
    ctx.strokeStyle = '#2a3340';
    ctx.strokeRect(M.l, M.t, pw, ph);
    ctx.fillStyle = '#8b96a5'; ctx.textAlign = 'center';
    ctx.fillText(xd.label + (xd.unit ? ' (' + xd.unit + ')' : '') + ' · ' + state.scales.x, M.l + pw / 2, H - 6);
    ctx.save(); ctx.translate(12, M.t + ph / 2); ctx.rotate(-Math.PI / 2);
    ctx.fillText(yd.label + (yd.unit ? ' (' + yd.unit + ')' : '') + ' · ' + state.scales.y, 0, 0); ctx.restore();

    // points
    var pts = [];
    for (var i = 0; i < inScopeRecords.length; i++) {
      var r = inScopeRecords[i];
      var cx = px(r[xd.id]), cy = py(r[yd.id]);
      var t = (r[sd.id] - smin) / (smax - smin || 1);
      var rad = 1.4 + Math.sqrt(t) * 5.2;
      var selected = state.selection.has(r.id);
      ctx.globalAlpha = selected ? 1 : 0.78;
      ctx.fillStyle = colorFor(r, DIM_BY_ID[state.slots.color]);
      ctx.beginPath(); ctx.arc(cx, cy, rad, 0, 6.2832); ctx.fill();
      if (selected) {
        ctx.globalAlpha = 1; ctx.lineWidth = 1.6; ctx.strokeStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(cx, cy, rad + 2.6, 0, 6.2832); ctx.stroke();
      } else if (r.id === hoverId) {
        ctx.globalAlpha = 1; ctx.lineWidth = 1.2; ctx.strokeStyle = '#4ea1ff';
        ctx.beginPath(); ctx.arc(cx, cy, rad + 2, 0, 6.2832); ctx.stroke();
      }
      pts.push({ id: r.id, x: cx, y: cy, r: rad });
    }
    ctx.globalAlpha = 1;
    geo = { pts: pts, M: M, W: W, H: H };
    renderLegend(DIM_BY_ID[state.slots.color]);
  }

  /* ---------------- render: record table ---------------- */
  function renderTable(inScopeRecords) {
    var table = el('record-table');
    var scroll = el('table-scroll');
    var st = scroll.scrollTop;
    // keyboard continuity: keep focus on the same record's row across re-renders
    var ae = document.activeElement;
    var focusId = (ae && table.contains(ae) && ae.getAttribute('data-id')) ? ae.getAttribute('data-id') : null;
    var xd = DIM_BY_ID[state.slots.x], yd = DIM_BY_ID[state.slots.y],
        cd = DIM_BY_ID[state.slots.color], sd = DIM_BY_ID[state.slots.size];
    var cols = [
      { key: 'id', label: 'Record' },
      { key: xd.id, label: xd.label },
      { key: yd.id, label: yd.label },
      { key: cd.id, label: cd.label },
      { key: sd.id, label: sd.label }
    ];
    var arr = inScopeRecords.slice();
    var k = state.sort.key, dir = state.sort.dir;
    arr.sort(function (a, b) {
      var va = k === 'id' ? a.id : a[k], vb = k === 'id' ? b.id : b[k];
      return (va < vb ? -1 : va > vb ? 1 : 0) * dir;
    });
    var head = '<thead><tr>' + cols.map(function (c) {
      var arrow = c.key === k ? (dir > 0 ? ' ▲' : ' ▼') : '';
      return '<th data-sort="' + c.key + '" title="Sort by ' + c.label + '">' + c.label + arrow + '</th>';
    }).join('') + '</tr></thead>';
    var body = arr.map(function (r) {
      return '<tr tabindex="0" data-id="' + r.id + '"' +
        (state.selection.has(r.id) ? ' class="sel"' : '') + '>' +
        '<td>' + r.id + '</td>' +
        '<td>' + fmtVal(xd, r[xd.id]) + '</td>' +
        '<td>' + fmtVal(yd, r[yd.id]) + '</td>' +
        '<td>' + fmtVal(cd, r[cd.id]) + '</td>' +
        '<td>' + fmtVal(sd, r[sd.id]) + '</td></tr>';
    }).join('');
    table.innerHTML = head + '<tbody>' + (body || '') + '</tbody>' +
      (arr.length ? '' : '<tbody id="table-empty"><tr><td colspan="5">No records in scope — remove a filter chip.</td></tr></tbody>');
    scroll.scrollTop = st;
    if (focusId) {
      var nr = table.querySelector('tr[data-id="' + focusId + '"]');
      if (nr) nr.focus({ preventScroll: true });  // keep the restored scroll position stable
    }
  }

  /* ---------------- render: inspector (full profile, projection-invariant) ---------------- */
  function renderInspector() {
    var empty = el('inspector-empty'), body = el('inspector-body');
    el('inspector-anchor').textContent = state.selectedId ? state.selectedId : '';
    if (!state.selectedId) { empty.hidden = false; body.hidden = true; return; }
    var r = null;
    for (var i = 0; i < CAT.records.length; i++) if (CAT.records[i].id === state.selectedId) { r = CAT.records[i]; break; }
    if (!r) { empty.hidden = false; body.hidden = true; return; }
    empty.hidden = true; body.hidden = false;
    var inScopeSet = new Set(inScope().map(function (x) { return x.id; }));
    function row(dim) {
      var slotNames = Object.keys(state.slots).filter(function (s) { return state.slots[s] === dim.id; });
      var v = r[dim.id];
      var text = dim.type === 'c' ? String(v) : fmtVal(dim, v);
      return '<div class="insp-row' + (slotNames.length ? ' projected' : '') + '" title="' +
        (slotNames.length ? 'currently on slot: ' + slotNames.join(', ') : 'not projected') + '">' +
        '<span class="k">' + dim.label + '</span><span class="v">' + text +
        (dim.unit && dim.type === 'q' ? '<span class="unit">' + dim.unit + '</span>' : '') + '</span></div>';
    }
    body.innerHTML = '<div class="insp-name">' + r.id + '</div>' +
      '<div class="insp-group"><h3>Quantitative</h3>' +
      DIMS.filter(function (d) { return d.type === 'q'; }).map(row).join('') + '</div>' +
      '<div class="insp-group"><h3>Categorical</h3>' +
      DIMS.filter(function (d) { return d.type === 'c'; }).map(row).join('') + '</div>' +
      '<div class="insp-group"><h3>Status</h3><div class="insp-row"><span class="k">In scope</span><span class="v">' +
      (inScopeSet.has(r.id) ? 'yes' : 'no — excluded by a filter') + '</span></div></div>';
  }

  /* ---------------- master render ---------------- */
  function renderAll() {
    var scopeRecords = inScope();
    renderHeader(scopeRecords.length);
    renderRail();
    renderChips();
    el('chart-empty').hidden = scopeRecords.length > 0;
    renderChart(scopeRecords);
    renderTable(scopeRecords);
    renderInspector();
  }

  /* ---------------- chart pointer interactions ---------------- */
  function hitTest(mx, my) {
    if (!geo) return null;
    var best = null, bd = 1e9;
    geo.pts.forEach(function (p) {
      var d = (p.x - mx) * (p.x - mx) + (p.y - my) * (p.y - my);
      var rad = Math.max(9, p.r + 4);
      if (d <= rad * rad && d < bd) { bd = d; best = p; }
    });
    return best;
  }
  function wireChart() {
    canvas.addEventListener('pointermove', function (e) {
      var rect = canvas.getBoundingClientRect();
      var mx = e.clientX - rect.left, my = e.clientY - rect.top;
      var hit = hitTest(mx, my);
      var id = hit ? hit.id : null;
      if (id !== hoverId) { hoverId = id; drawWithHover(); }
      if (hit) {
        var r = byId(hit.id);
        var xd = DIM_BY_ID[state.slots.x], yd = DIM_BY_ID[state.slots.y];
        tip.innerHTML = '<div class="t-name">' + r.id + '</div>' +
          '<div class="t-row"><span>' + xd.label + '</span><span>' + fmtVal(xd, r[xd.id]) + '</span></div>' +
          '<div class="t-row"><span>' + yd.label + '</span><span>' + fmtVal(yd, r[yd.id]) + '</span></div>';
        tip.hidden = false;
        tip.style.left = Math.min(mx + 14, rect.width - 160) + 'px';
        tip.style.top = Math.max(6, my - 14) + 'px';
      } else tip.hidden = true;
    });
    canvas.addEventListener('pointerleave', function () { hoverId = null; tip.hidden = true; drawWithHover(); });
    canvas.addEventListener('click', function (e) {
      var rect = canvas.getBoundingClientRect();
      var hit = hitTest(e.clientX - rect.left, e.clientY - rect.top);
      if (!hit) return;
      if (e.ctrlKey || e.metaKey || e.shiftKey) {
        var ids = Array.from(state.selection);
        var ix = ids.indexOf(hit.id);
        if (ix >= 0) ids.splice(ix, 1); else ids.push(hit.id);
        setSelection(ids, hit.id);
      } else setSelection([hit.id], hit.id);
      renderAll();
    });
  }
  function drawWithHover() { renderChart(inScope()); }
  function byId(id) { for (var i = 0; i < CAT.records.length; i++) if (CAT.records[i].id === id) return CAT.records[i]; return null; }

  /* ---------------- table interactions (keyboard-operable selection) ---------------- */
  function wireTable() {
    var table = el('record-table');
    table.addEventListener('click', function (e) {
      var th = e.target.closest('th');
      if (th) {
        var key = th.getAttribute('data-sort');
        if (state.sort.key === key) state.sort.dir *= -1; else { state.sort.key = key; state.sort.dir = 1; }
        renderTable(inScope());
        return;
      }
      var tr = e.target.closest('tr[data-id]');
      if (!tr) return;
      var id = tr.getAttribute('data-id');
      if (e.ctrlKey || e.metaKey || e.shiftKey) {
        var ids = Array.from(state.selection);
        var ix = ids.indexOf(id);
        if (ix >= 0) ids.splice(ix, 1); else ids.push(id);
        setSelection(ids, id);
      } else setSelection([id], id);
      renderAll();
    });
    table.addEventListener('keydown', function (e) {
      var tr = e.target.closest('tr[data-id]');
      if (!tr) return;
      var id = tr.getAttribute('data-id');
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelection([id], id); renderAll(); }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        var next = e.key === 'ArrowDown' ? tr.nextElementSibling : tr.previousElementSibling;
        if (next) { next.focus(); setSelection([next.getAttribute('data-id')], next.getAttribute('data-id')); renderAll(); }
      }
    });
  }

  /* ---------------- header actions ---------------- */
  function wireHeader() {
    el('btn-undo').addEventListener('click', undoProjection);
    el('btn-reset-proj').addEventListener('click', resetProjection);
    el('btn-clear-filters').addEventListener('click', function () {
      state.filters = [];
      // sync rail controls to the cleared state
      DIMS.forEach(function (dim) {
        if (dim.type === 'q') {
          var vals = CAT.records.map(function (r) { return r[dim.id]; });
          el('rf-' + dim.id + '-lo').value = Math.min.apply(null, vals);
          el('rf-' + dim.id + '-hi').value = Math.max.apply(null, vals);
        } else document.querySelectorAll('.dim-row[data-dim="' + dim.id + '"] input[type="checkbox"]').forEach(function (b) { b.checked = true; });
      });
      renderAll();
    });
    el('btn-clear-selection').addEventListener('click', function () { setSelection([], null); renderAll(); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !e.target.closest('details')) { setSelection([], null); renderAll(); }
    });
  }

  /* ---------------- boot ---------------- */
  function boot() {
    canvas = el('chart'); tip = el('tooltip');
    try { ctx = canvas.getContext('2d'); } catch (err) { ctx = null; }
    if (!ctx) el('chart-error').hidden = false;
    buildRail();
    wireHeader(); wireTable(); wireChart();
    if (ctx && 'ResizeObserver' in window) new ResizeObserver(function () { drawWithHover(); }).observe(canvas.parentElement);
    window.addEventListener('resize', drawWithHover);
    renderAll();                     // synchronous first paint: data is inlined, no loading state
    if (new URLSearchParams(location.search).has('test')) runTests();
  }

  /* ---------------- external API (browser-driven verification) ---------------- */
  window.__EXPLORER__ = {
    state: function () { return state; },
    inScopeCount: function () { return inScope().length; },
    select: function (ids) { setSelection(ids, ids[0] || null); renderAll(); },
    setSlot: function (slot, dimId) { setSlot(slot, dimId); },
    addQFilter: function (dimId, lo, hi) {
      var others = state.filters.filter(function (f) { return f.dim !== dimId; });
      state.filters = others.concat([{ dim: dimId, lo: lo, hi: hi }]);
      renderAll();
    },
    addCFilter: function (dimId, values) {
      var others = state.filters.filter(function (f) { return f.dim !== dimId; });
      state.filters = others.concat([{ dim: dimId, set: new Set(values) }]);
      renderAll();
    },
    removeChip: function (i) {
      var dimId = state.filters[i].dim;
      state.filters.splice(i, 1);
      var dim = DIM_BY_ID[dimId];
      if (dim.type === 'q') {
        var vals = CAT.records.map(function (r) { return r[dimId]; });
        el('rf-' + dimId + '-lo').value = Math.min.apply(null, vals);
        el('rf-' + dimId + '-hi').value = Math.max.apply(null, vals);
      } else document.querySelectorAll('.dim-row[data-dim="' + dimId + '"] input[type="checkbox"]').forEach(function (b) { b.checked = true; });
      renderAll();
    },
    undo: undoProjection,
    reset: resetProjection,
    clearFilters: function () { el('btn-clear-filters').click(); },
    clearSelection: function () { el('btn-clear-selection').click(); },
    demo: function () {
      // A representative explore moment: select three records, scope by two
      // filters, then re-project X — everything else stays put.
      this.select(['AUR-1004', 'AUR-1052', 'AUR-1210']);
      this.addQFilter('distance', 0, 800);
      this.addCFilter('method', ['Transit', 'Radial Velocity']);
      this.setSlot('x', 'habit');
      return { sel: Array.from(state.selection), filters: state.filters.length, x: state.slots.x };
    }
  };

  /* ---------------- self-test harness (?test) ---------------- */
  function runTests() {
    var report = el('test-report');
    report.hidden = false;
    var results = [];
    function assert(name, cond, detail) { results.push({ name: name, pass: !!cond, detail: detail || '' }); }
    var X = window.__EXPLORER__;

    // T1 first paint: ready, no loading state, full scope
    assert('T1 first paint ready (no loading state)', document.querySelectorAll('.loading, .skeleton').length === 0
      && X.inScopeCount() === CAT.records.length, 'inScope=' + X.inScopeCount());

    // T2 selection survives a dimension switch
    X.select(['AUR-1000', 'AUR-1010', 'AUR-1020']);
    var before = Array.from(X.state().selection).slice().sort();
    var selRowsBefore = document.querySelectorAll('#record-table tr.sel').length;
    X.setSlot('x', 'temp');
    var after = Array.from(X.state().selection).slice().sort();
    var selRowsAfter = document.querySelectorAll('#record-table tr.sel').length;
    assert('T2 selection survives dimension switch', JSON.stringify(before) === JSON.stringify(after)
      && selRowsBefore === selRowsAfter && selRowsAfter === 3,
      'rowsBefore=' + selRowsBefore + ' rowsAfter=' + selRowsAfter);

    // T3 filters are owned: chips name their owner dimension
    X.addQFilter('radius', 1, 4);
    X.addCFilter('star_class', ['G', 'K']);
    var chips = document.querySelectorAll('#filter-chips .chip');
    var ownerTexts = Array.prototype.map.call(chips, function (c) { return c.querySelector('.owner').textContent; });
    var scoped = X.inScopeCount();
    assert('T3 filter chips exist with owners', chips.length === 2 &&
      ownerTexts.indexOf('Planet Radius') >= 0 && ownerTexts.indexOf('Stellar Class') >= 0 && scoped < CAT.records.length,
      'chips=' + chips.length + ' inScope=' + scoped);
    // Filtering intentionally narrows the visible subset; selection STATE must
    // survive (header count + reverts), with the in-scope subset still highlighted.
    var selState = X.state().selection.size;
    var selRowsNow = document.querySelectorAll('#record-table tr.sel').length;
    var headerSays = /3 selected/.test(document.querySelector('#scope-summary').textContent);
    assert('T3b selection state survives filters; in-scope subset highlighted',
      selState === 3 && headerSays && selRowsNow === 1,
      'selState=' + selState + ' inScopeSelRows=' + selRowsNow + ' headerSays3=' + headerSays);

    // T4 removing a chip removes exactly that filter
    var beforeScope = X.inScopeCount();
    X.removeChip(1); // Stellar Class chip
    var chipsAfter = document.querySelectorAll('#filter-chips .chip');
    var ownersAfter = Array.prototype.map.call(chipsAfter, function (c) { return c.querySelector('.owner').textContent; });
    assert('T4 chip removal reverts exactly one filter', chipsAfter.length === 1 &&
      ownersAfter[0] === 'Planet Radius' && X.inScopeCount() > beforeScope,
      'inScope ' + beforeScope + '→' + X.inScopeCount());

    // T5 projection undo restores the previous projection, touches nothing else
    var scopeBeforeUndo = X.inScopeCount();
    var xBefore = X.state().slots.x;
    var filtersBeforeUndo = X.state().filters.length;
    X.setSlot('x', 'mass');
    X.undo();
    assert('T5 projection undo is per-step and side-effect-free',
      X.state().slots.x === xBefore && X.state().filters.length === filtersBeforeUndo
      && X.inScopeCount() === scopeBeforeUndo,
      'x=' + X.state().slots.x);

    // T6 reset restores default slots; undo reverts the reset
    X.reset();
    var isDefault = X.state().slots.x === 'radius' && X.state().slots.y === 'period';
    X.undo();
    assert('T6 reset→default and undo→pre-reset', isDefault && X.state().slots.x === 'temp',
      'after reset x=radius? ' + isDefault + '; after undo x=' + X.state().slots.x);

    // T7 clear-all and clear-selection
    X.addCFilter('method', ['Transit']);
    X.clearFilters();
    X.clearSelection();
    assert('T7 clear filters + selection', X.state().filters.length === 0 &&
      X.state().selection.size === 0 && X.inScopeCount() === CAT.records.length,
      'inScope=' + X.inScopeCount());

    var npass = results.filter(function (r) { return r.pass; }).length;
    report.innerHTML = '<h3>SELF-TEST ' + npass + '/' + results.length + ' PASS</h3>' +
      results.map(function (r) {
        return '<div class="tr ' + (r.pass ? 'pass' : 'fail') + '"><span>' + (r.pass ? '✔' : '✘') + '</span><span>' +
          r.name + (r.detail ? ' — <i>' + r.detail + '</i>' : '') + '</span></div>';
      }).join('') +
      '<div class="sum ' + (npass === results.length ? 'pass' : 'fail') + '">' +
      (npass === results.length ? 'ALL CHECKS PASS' : 'FAILURES PRESENT') + '</div>';
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
