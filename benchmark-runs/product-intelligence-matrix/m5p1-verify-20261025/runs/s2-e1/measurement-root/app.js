/*
 * Lensboard — dimensional workbench (cell-j13-s10 · explore × dimensional-space)
 *
 * State ownership (acceptance seed: 过滤/投影状态有归属且可回退):
 *   query      → per-dimension filter map (each filter belongs to exactly one dimension)
 *   viewport   → projection controller (the active lens), independent of query state
 *   selection  → working-set table + inspector pair, persists across lens switches
 *   preview    → lens chart hover/focus tooltip
 *   mode       → history ledger: every mutation is a labeled, invertible entry
 *
 * Switching the lens never touches the filter map: cognition carries across switches.
 */
'use strict';
(function () {
  const DS = window.DATASET;
  const DIMS = DS.dimensions;
  const INITIAL_LENS = 'temp_c';
  const NUM_BINS = 12;

  // ---------- tiny DOM helpers ----------
  const $ = (sel) => document.querySelector(sel);
  function h(tag, attrs, children) {
    const node = document.createElement(tag);
    if (attrs) for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') node.className = v;
      else if (k === 'text') node.textContent = v;
      else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
      else if (v !== false && v != null) node.setAttribute(k, v === true ? '' : v);
    }
    (children || []).forEach((c) => node.appendChild(c));
    return node;
  }
  const fmtVal = (dim, v) => v.toFixed(dim.dp || 0);

  // ---------- dataset statistics (computed once over the FULL dataset — stable anchors) ----------
  const STATS = {};
  for (const d of DIMS) {
    if (d.type === 'numeric') {
      let min = Infinity, max = -Infinity;
      for (const r of DS.records) { const v = r[d.id]; if (v < min) min = v; if (v > max) max = v; }
      const w = ((max - min) || 1) / NUM_BINS;
      const bins = [];
      for (let i = 0; i < NUM_BINS; i++) bins.push({ lo: min + i * w, hi: min + (i + 1) * w, last: i === NUM_BINS - 1 });
      STATS[d.id] = { min, max, bins };
    } else {
      STATS[d.id] = { values: d.values.slice() };
    }
  }
  function binOf(dim, v) {
    const s = STATS[dim.id];
    const w = ((s.max - s.min) / NUM_BINS) || 1;
    let i = Math.floor((v - s.min) / w);
    if (i < 0) i = 0;
    if (i >= NUM_BINS) i = NUM_BINS - 1;
    return i;
  }

  // ---------- state ----------
  const state = {
    lens: INITIAL_LENS,                  // viewport owner
    sort: { dim: INITIAL_LENS, dir: 1 }, // reading order follows the lens
    filters: new Map(),                  // query owner: dimId -> {lo,hi,last} | {allowed:Set}
    selection: null,                     // selection owner
    history: [],                         // mode owner: labeled invertible entries
  };

  const dimOf = (id) => DIMS.find((d) => d.id === id);
  const dimLabel = (id) => dimOf(id).label;

  // ---------- query ----------
  function matchDim(record, dim, f) {
    const v = record[dim.id];
    if (dim.type === 'numeric') return v >= f.lo && (f.last ? v <= f.hi : v < f.hi);
    return f.allowed.has(v);
  }
  function inWorkingSet(record) {
    for (const d of DIMS) {
      const f = state.filters.get(d.id);
      if (f && !matchDim(record, d, f)) return false;
    }
    return true;
  }
  function workingSet() {
    const rows = DS.records.filter(inWorkingSet);
    const { dim, dir } = state.sort;
    const d = dimOf(dim);
    rows.sort((a, b) => {
      const va = a[dim], vb = b[dim];
      const c = d.type === 'numeric' ? va - vb : String(va).localeCompare(String(vb));
      return c * dir || a.id.localeCompare(b.id);
    });
    return rows;
  }
  function excludedDims(record) {
    const out = [];
    for (const d of DIMS) {
      const f = state.filters.get(d.id);
      if (f && !matchDim(record, d, f)) out.push(d.id);
    }
    return out;
  }

  // ---------- history (mode owner): labeled, invertible entries ----------
  function filterText(dim, f) {
    if (dim.type === 'numeric') {
      const dp = dim.dp || 0;
      return `[${f.lo.toFixed(dp)} – ${f.hi.toFixed(dp)}${f.last ? '' : ')'}${dim.unit ? ' ' + dim.unit : ''}]`;
    }
    return '⊆ {' + [...f.allowed].join(', ') + '}';
  }
  function rawSetLens(id) { state.lens = id; state.sort = { dim: id, dir: 1 }; }
  function rawSetFilter(id, f) {
    if (f == null) return state.filters.delete(id);
    state.filters.set(id, f);
    return true;
  }
  function pushHistory(entry) { state.history.push(entry); }

  function setLens(id) {
    if (id === state.lens) return;
    const from = state.lens;
    rawSetLens(id);
    pushHistory({
      kind: 'lens', from,
      label: `lens ${dimLabel(from)} → ${dimLabel(id)}`,
      invert() { rawSetLens(from); return true; },
    });
    renderAll();
  }

  function applyBinFilter(dim, idx) {
    const prev = state.filters.get(dim.id) || null;
    let next = null;
    if (dim.type === 'numeric') {
      const bin = STATS[dim.id].bins[idx];
      const cand = { lo: bin.lo, hi: bin.hi, last: bin.last };
      next = (prev && prev.lo === cand.lo && prev.hi === cand.hi) ? null : cand;
    } else {
      const v = dim.values[idx];
      if (!prev) next = { allowed: new Set([v]) };
      else {
        const allowed = new Set(prev.allowed);
        if (allowed.has(v)) allowed.delete(v); else allowed.add(v);
        next = allowed.size ? { allowed } : null;
      }
    }
    rawSetFilter(dim.id, next);
    if (next === null) {
      pushHistory({
        kind: 'filter-remove',
        label: `− ${dim.label} ${filterText(dim, prev)}`,
        invert() { return rawSetFilter(dim.id, prev); },
      });
    } else if (prev === null) {
      pushHistory({
        kind: 'filter-add',
        label: `+ ${dim.label} ${filterText(dim, next)}`,
        invert() { return rawSetFilter(dim.id, null); },
      });
    } else {
      pushHistory({
        kind: 'filter-set',
        label: `± ${dim.label} ${filterText(dim, prev)} → ${filterText(dim, next)}`,
        invert() { return rawSetFilter(dim.id, prev); },
      });
    }
    renderAll();
  }

  function removeFilter(dimId) {
    const dim = dimOf(dimId);
    const prev = state.filters.get(dimId);
    if (!prev) return;
    state.filters.delete(dimId);
    pushHistory({
      kind: 'filter-remove',
      label: `− ${dim.label} ${filterText(dim, prev)}`,
      invert() { return rawSetFilter(dimId, prev); },
    });
    renderAll();
  }

  function resetAll(clearsOnly) {
    const snapshot = {
      lens: state.lens,
      sort: { ...state.sort },
      filters: [...state.filters.entries()],
    };
    state.filters = new Map();
    if (!clearsOnly) {
      state.lens = INITIAL_LENS;
      state.sort = { dim: INITIAL_LENS, dir: 1 };
    }
    pushHistory({
      kind: 'reset',
      label: clearsOnly ? 'reset — cleared all filters (empty-state recovery)' : 'reset — cleared all filters, restored initial lens',
      invert() {
        state.filters = new Map(snapshot.filters);
        state.lens = snapshot.lens;
        state.sort = { ...snapshot.sort };
        return true;
      },
    });
    renderAll();
  }

  function undoLatest() {
    const entry = state.history.pop();
    if (!entry) return;
    entry.invert();
    renderAll();
  }

  function revertEntry(entry) {
    if (entry.invert()) {
      const i = state.history.indexOf(entry);
      if (i >= 0) state.history.splice(i, 1);
    } else {
      entry.spent = true; // no longer applicable — shown disabled, kept for the record
    }
    renderAll();
  }

  function lastLensEntry() {
    for (let i = state.history.length - 1; i >= 0; i--) if (state.history[i].kind === 'lens') return state.history[i];
    return null;
  }

  // ---------- URL hash: shareable view state (lens + filters + selection) ----------
  function encodeHash() {
    const parts = [];
    if (state.lens !== INITIAL_LENS) parts.push('lens=' + state.lens);
    if (state.filters.size) {
      const specs = [];
      for (const [id, f] of state.filters) {
        const d = dimOf(id);
        specs.push(d.type === 'numeric'
          ? id + ':' + f.lo + '-' + f.hi + (f.last ? '*' : '')
          : id + ':' + [...f.allowed].join(','));
      }
      parts.push('f=' + specs.join(';'));
    }
    if (state.selection) parts.push('sel=' + state.selection);
    return parts.length ? '#' + parts.join('&') : '';
  }
  function applyHash() {
    if (!location.hash || location.hash.length < 2) return;
    for (const part of location.hash.slice(1).split('&')) {
      const eq = part.indexOf('=');
      if (eq < 0) continue;
      const k = part.slice(0, eq), v = part.slice(eq + 1);
      if (!v) continue;
      if (k === 'lens' && dimOf(v)) {
        state.lens = v;
        state.sort = { dim: v, dir: 1 };
      } else if (k === 'sel' && DS.records.some((r) => r.id === v)) {
        state.selection = v;
      } else if (k === 'f') {
        for (const spec of v.split(';')) {
          const ci = spec.indexOf(':');
          if (ci < 0) continue;
          const id = spec.slice(0, ci), val = spec.slice(ci + 1);
          const d = dimOf(id);
          if (!d) continue;
          if (d.type === 'numeric') {
            const last = val.endsWith('*');
            const [lo, hi] = val.replace(/\*$/, '').split('-').map(parseFloat);
            if (isFinite(lo) && isFinite(hi)) state.filters.set(id, { lo, hi, last });
          } else {
            const allowed = new Set(val.split(',').filter((x) => d.values.includes(x)));
            if (allowed.size) state.filters.set(id, { allowed });
          }
        }
      }
    }
  }
  let booted = false;
  function updateHash() {
    if (!booted) return;
    try { history.replaceState(null, '', encodeHash() || location.pathname + location.search); } catch (e) { /* file:// quirks — state stays in-app */ }
  }

  // ---------- rendering ----------
  const railList = $('#rail-list');
  const lensTitle = $('#lens-title');
  const lensNote = $('#lens-note');
  const lensFilterNote = $('#lens-filter-note');
  const lensChart = $('#lens-chart');
  const lensTip = $('#lens-tip');
  const table = $('#working-table');
  const tableNote = $('#table-note');
  const tableScroll = $('#table-scroll');
  const emptyState = $('#empty-state');
  const inspectorBody = $('#inspector-body');
  const chipsBox = $('#filter-chips');
  const historyBox = $('#history-list');
  const workingCount = $('#working-count');
  const btnUndo = $('#btn-undo');
  const btnReset = $('#btn-reset');

  function renderHeader(ws) {
    $('#dataset-name').textContent = `${DS.name} · ${DS.count} records · ${DIMS.length} dimensions`;
    workingCount.textContent = `Showing ${ws.length} / ${DS.count} records · ${state.filters.size} filter${state.filters.size === 1 ? '' : 's'}`;
    btnUndo.disabled = state.history.length === 0;
    btnUndo.textContent = `↶ Undo${state.history.length ? ` (${state.history.length})` : ''}`;
    btnReset.disabled = !(state.filters.size > 0 || state.lens !== INITIAL_LENS);
    $('#rail-note').textContent = 'click = switch lens · filters untouched';
  }

  function renderRail() {
    railList.textContent = '';
    for (const d of DIMS) {
      const s = STATS[d.id];
      const counts = d.type === 'numeric' ? new Array(NUM_BINS).fill(0) : new Array(s.values.length).fill(0);
      for (const r of DS.records) counts[d.type === 'numeric' ? binOf(d, r[d.id]) : s.values.indexOf(r[d.id])]++;

      const row = h('button', {
        class: 'dim-row',
        role: 'listitem',
        'aria-pressed': String(d.id === state.lens),
        title: d.id === state.lens ? 'Active lens' : `Switch lens to ${d.label} — filters stay applied`,
        onclick: () => setLens(d.id),
      });
      const name = h('span', { class: 'dim-name' });
      name.appendChild(document.createTextNode(d.label + ' '));
      name.appendChild(h('span', { class: 'dim-type', text: d.type === 'numeric' ? '#' : 'abc' }));
      if (d.unit) name.appendChild(h('span', { class: 'dim-unit', text: d.unit }));
      row.appendChild(name);

      // sparkbars over the FULL dataset — constant under any state, an orientation anchor
      const maxC = Math.max(...counts, 1);
      const bw = 54 / counts.length;
      let bars = '';
      for (let i = 0; i < counts.length; i++) {
        const bh = Math.max(1, Math.round((counts[i] / maxC) * 13));
        bars += `<rect x="${(i * bw).toFixed(1)}" y="${(14 - bh).toFixed(1)}" width="${(bw - 0.8).toFixed(1)}" height="${bh}" rx="0.6" fill="${d.id === state.lens ? '#2457d6' : '#b6c3da'}"/>`;
      }
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('width', '54');
      svg.setAttribute('height', '15');
      svg.setAttribute('viewBox', '0 0 54 15');
      svg.setAttribute('aria-hidden', 'true');
      svg.innerHTML = bars;
      row.appendChild(svg);

      const f = state.filters.get(d.id);
      const badge = h('span', {
        class: 'dim-badge' + (f ? ' owned' : ''),
        title: f ? `1 filter owned by ${d.label}` : 'no filter owned',
        'aria-label': f ? `${d.label}: 1 filter owned` : `${d.label}: no filter`,
        text: f ? '1' : '0',
      });
      row.appendChild(badge);
      railList.appendChild(row);
    }

    // roving tabindex: one tab stop for the rail, arrow keys walk the dimensions
    const rows = [...railList.querySelectorAll('.dim-row')];
    const setRailRoving = (owner) => rows.forEach((r, i) => r.setAttribute('tabindex', i === owner ? '0' : '-1'));
    setRailRoving(0);
    rows.forEach((r, i) => {
      r.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault();
          const next = Math.min(rows.length - 1, Math.max(0, i + (e.key === 'ArrowDown' ? 1 : -1)));
          if (next !== i) { setRailRoving(next); rows[next].focus(); }
        }
      });
    });
  }

  function showTip(anchorRect, text) {
    const box = lensChart.getBoundingClientRect();
    lensTip.textContent = text;
    lensTip.hidden = false;
    const tw = lensTip.offsetWidth, th = lensTip.offsetHeight;
    let x = anchorRect.left - box.left + anchorRect.width / 2 - tw / 2;
    x = Math.max(4, Math.min(x, box.width - tw - 4));
    let y = anchorRect.top - box.top - th - 6;
    if (y < 2) y = anchorRect.top - box.top + anchorRect.height + 6;
    lensTip.style.left = x + 'px';
    lensTip.style.top = y + 'px';
  }
  const hideTip = () => { lensTip.hidden = true; };

  function renderChart(ws) {
    const dim = dimOf(state.lens);
    const s = STATS[dim.id];
    const f = state.filters.get(dim.id);
    lensTitle.textContent = `Lens — ${dim.label}${dim.unit ? ` (${dim.unit})` : ''}`;
    lensNote.textContent = 'click a bar to filter · hover/focus to preview';

    lensFilterNote.textContent = '';
    if (f) {
      lensFilterNote.appendChild(h('span', { class: 'panel-note', text: `active filter ${filterText(dim, f)}` }));
      lensFilterNote.appendChild(h('button', {
        class: 'chip-x',
        title: `Remove the ${dim.label} filter`,
        'aria-label': `Remove the ${dim.label} filter`,
        text: '×',
        onclick: () => removeFilter(dim.id),
      }));
    }

    const counts = dim.type === 'numeric' ? new Array(NUM_BINS).fill(0) : new Array(s.values.length).fill(0);
    for (const r of ws) counts[dim.type === 'numeric' ? binOf(dim, r[dim.id]) : s.values.indexOf(r[dim.id])]++;

    const W = 960, H = 205, padL = 14, padR = 14, baseY = 168, topY = 20;
    const maxC = Math.max(...counts, 1);
    const n = counts.length;
    const slot = (W - padL - padR) / n;
    const bw = Math.min(slot - 6, 64);
    const yFor = (c) => baseY - (c / maxC) * (baseY - topY);

    let svg = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${dim.label} distribution of the working set">`;
    svg += `<line x1="${padL}" y1="${baseY + 0.5}" x2="${W - padR}" y2="${baseY + 0.5}" stroke="#c9cfd9"/>`;
    svg += `<text class="axis-label" x="${padL}" y="${topY - 5}">peak ${maxC}</text>`;

    for (let i = 0; i < n; i++) {
      const x = padL + i * slot + (slot - bw) / 2;
      const y = yFor(counts[i]);
      const bh = counts[i] ? Math.max(2, baseY - y) : 0;
      const label = dim.type === 'numeric'
        ? `${fmtVal(dim, s.bins[i].lo)}–${fmtVal(dim, s.bins[i].hi)}${dim.unit ? ' ' + dim.unit : ''}`
        : s.values[i];
      let owned = false;
      if (f) owned = dim.type === 'numeric' ? (s.bins[i].hi > f.lo && s.bins[i].lo < f.hi) : f.allowed.has(s.values[i]);
      const cls = 'bar-fill' + (owned ? ' owned' : f ? ' muted' : '');
      const tipText = `${label} · ${counts[i]} record${counts[i] === 1 ? '' : 's'}${owned ? ' · inside filter' : f ? ' · outside filter' : ''}`;
      svg += `<g class="bar-hit" data-idx="${i}" data-tip="${tipText}" tabindex="0" role="button" aria-pressed="${owned}" aria-label="Filter ${label} — ${counts[i]} records">
        <rect x="${x}" y="${topY - 8}" width="${bw}" height="${baseY - topY + 8}" fill="transparent"/>
        <rect class="${cls}" x="${x}" y="${y}" width="${bw}" height="${bh}" rx="2"/>
        ${counts[i] ? `<text class="bar-count-label" x="${x + bw / 2}" y="${y - 3}" text-anchor="middle">${counts[i]}</text>` : ''}
        <text class="bar-cat-label" x="${x + bw / 2}" y="${baseY + 13}" text-anchor="middle">${dim.type === 'categorical' ? label : ''}</text>
      </g>`;
    }
    if (dim.type === 'numeric') {
      svg += `<text class="axis-label" x="${padL}" y="${baseY + 26}">${fmtVal(dim, s.min)}</text>`;
      svg += `<text class="axis-label" x="${W - padR}" y="${baseY + 26}" text-anchor="end">${fmtVal(dim, s.max)}</text>`;
      svg += `<text class="axis-label" x="${W / 2}" y="${baseY + 26}" text-anchor="middle">${dim.unit ? dim.unit + ' · ' : ''}${NUM_BINS} bins over the full range</text>`;
      if (f) {
        const x1 = padL + ((f.lo - s.min) / ((s.max - s.min) || 1)) * (W - padL - padR);
        const x2 = padL + ((f.hi - s.min) / ((s.max - s.min) || 1)) * (W - padL - padR);
        svg += `<line class="filter-bracket" x1="${x1}" y1="${baseY + 5}" x2="${x2}" y2="${baseY + 5}"/>`;
      }
    } else {
      svg += `<text class="axis-label" x="${W / 2}" y="${baseY + 26}" text-anchor="middle">${f ? 'filter keeps {' + [...f.allowed].join(', ') + '}' : 'no filter on this dimension'}</text>`;
    }
    svg += '</svg>';
    // preserve keyboard focus on the focused bin across re-renders
    const prevFocusIdx = document.activeElement && document.activeElement.classList && document.activeElement.classList.contains('bar-hit')
      ? Number(document.activeElement.dataset.idx) : null;
    lensChart.innerHTML = svg;

    // roving tabindex: one tab stop for the chart group, arrow keys walk the bins
    const bins = [...lensChart.querySelectorAll('.bar-hit')];
    const focusIdx = prevFocusIdx != null ? prevFocusIdx : 0;
    const setRoving = (owner) => bins.forEach((b, i) => b.setAttribute('tabindex', i === owner ? '0' : '-1'));
    setRoving(focusIdx);

    for (const g of bins) {
      const idx = Number(g.dataset.idx);
      const onTip = () => showTip(g.querySelectorAll('rect')[1].getBoundingClientRect(), g.dataset.tip);
      g.addEventListener('mouseenter', onTip);
      g.addEventListener('focus', onTip);
      g.addEventListener('mouseleave', hideTip);
      g.addEventListener('blur', hideTip);
      g.addEventListener('click', () => applyBinFilter(dim, idx));
      g.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); applyBinFilter(dim, idx); }
        else if (e.key.startsWith('Arrow')) {
          e.preventDefault();
          const delta = (e.key === 'ArrowRight' || e.key === 'ArrowDown') ? 1 : -1;
          const next = Math.min(bins.length - 1, Math.max(0, idx + delta));
          if (next !== idx) { setRoving(next); bins[next].focus(); }
        }
      });
    }
    if (prevFocusIdx != null) {
      const again = bins[prevFocusIdx];
      if (again) again.focus();
    }
  }

  // ---------- working-set table (virtualized: only the visible window is in the DOM) ----------
  const ROW_H = 24; // keep in sync with #working-table tbody tr height
  let viewRows = [];
  let rowH = ROW_H;
  let rowRoving = 0; // roving tabindex index into viewRows (one tab stop for the table)

  function setRowRoving(idx) {
    rowRoving = idx;
    for (const tr of table.querySelectorAll('tbody tr[data-id]')) {
      const i = viewRows.findIndex((r) => r.id === tr.dataset.id);
      if (i >= 0) tr.setAttribute('tabindex', i === idx ? '0' : '-1');
    }
  }
  function rowFor(r, idx) {
    const tr = h('tr', {
      'data-id': r.id,
      class: r.id === state.selection ? 'selected' : '',
      'aria-selected': String(r.id === state.selection),
      tabindex: idx === rowRoving ? '0' : '-1',
      onclick: () => select(r.id),
      onfocus: () => { if (rowRoving !== idx) setRowRoving(idx); },
      onkeydown: (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(r.id); }
        else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault();
          const target = idx + (e.key === 'ArrowDown' ? 1 : -1);
          if (target < 0 || target >= viewRows.length) return;
          if (!table.querySelector(`tbody tr[data-id="${viewRows[target].id}"]`)) {
            tableScroll.scrollTop += (e.key === 'ArrowDown' ? 1 : -1) * rowH;
            renderRows();
          }
          setRowRoving(target);
          const tr = table.querySelector(`tbody tr[data-id="${viewRows[target].id}"]`);
          if (tr) tr.focus();
        }
      },
    });
    tr.appendChild(h('td', { class: 'id', text: r.id }));
    for (const d of DIMS) {
      if (d.id === 'status') {
        const td = h('td', { class: 'cat' });
        td.appendChild(h('span', { class: `status-dot status-${r.status}`, 'aria-hidden': 'true' }));
        td.appendChild(document.createTextNode(r.status));
        tr.appendChild(td);
      } else {
        tr.appendChild(h('td', { class: d.type === 'numeric' ? 'num' : 'cat', text: String(r[d.id]) }));
      }
    }
    return tr;
  }
  function spacerRow(px) {
    const tr = document.createElement('tr');
    tr.setAttribute('aria-hidden', 'true');
    const td = document.createElement('td');
    td.colSpan = DIMS.length + 1;
    td.style.height = px + 'px';
    td.style.padding = '0';
    td.style.borderBottom = 'none';
    tr.appendChild(td);
    return tr;
  }
  function renderRows() {
    const tbody = table.tBodies[0];
    if (!tbody) return;
    const n = viewRows.length;
    tbody.textContent = '';
    if (!n) return;
    const theadH = table.tHead ? table.tHead.offsetHeight : 26;
    const visible = Math.max(1, Math.ceil((tableScroll.clientHeight - theadH) / rowH));
    const firstVisible = Math.min(Math.max(0, Math.floor(tableScroll.scrollTop / rowH)), Math.max(0, n - 1));
    const start = Math.max(0, firstVisible - 3);
    const end = Math.min(n, firstVisible + visible + 1); // ≤1 row may sit below the visible area
    if (start > 0) tbody.appendChild(spacerRow(start * rowH));
    for (let i = start; i < end; i++) tbody.appendChild(rowFor(viewRows[i], i));
    if (end < n) tbody.appendChild(spacerRow((n - end) * rowH));
    // self-correct the row height once, in case CSS and the constant drift apart
    if (rowH === ROW_H) {
      const probe = tbody.querySelector('tr[data-id]');
      const measured = probe ? probe.offsetHeight : 0;
      if (measured && Math.abs(measured - ROW_H) > 0.5) { rowH = measured; renderRows(); }
    }
  }
  function renderTable(ws) {
    viewRows = ws;
    table.textContent = '';
    tableNote.textContent = `sorted by ${dimLabel(state.sort.dim)} ${state.sort.dir > 0 ? '↑' : '↓'} · click a row to inspect`;
    const trh = h('tr');
    const mkTh = (dimId, label, cls) => {
      const sortHere = state.sort.dim === dimId;
      const b = h('button', {
        title: `Sort by ${label}`,
        'aria-label': `Sort by ${label}`,
        onclick: () => {
          if (state.sort.dim === dimId) state.sort.dir *= -1;
          else state.sort = { dim: dimId, dir: 1 };
          renderTable(workingSet());
        },
      });
      b.appendChild(document.createTextNode(label + ' '));
      if (sortHere) b.appendChild(h('span', { class: 'sort-mark', 'aria-hidden': 'true', text: state.sort.dir > 0 ? '▲' : '▼' }));
      trh.appendChild(h('th', { class: cls, scope: 'col' }, [b]));
    };
    mkTh('id', 'Device', 'cat');
    for (const d of DIMS) mkTh(d.id, d.label + (d.unit ? ` (${d.unit})` : ''), d.type === 'numeric' ? 'num' : 'cat');
    table.appendChild(h('thead', null, [trh]));
    table.appendChild(h('tbody'));
    tableScroll.onscroll = () => renderRows();
    renderRows();
  }

  function select(id) {
    state.selection = state.selection === id ? null : id;
    renderSelection();
  }

  function renderSelection() {
    for (const tr of table.querySelectorAll('tbody tr')) {
      const on = tr.dataset.id === state.selection;
      tr.classList.toggle('selected', on);
      tr.setAttribute('aria-selected', String(on));
    }
    renderInspector();
  }

  function renderInspector() {
    inspectorBody.textContent = '';
    if (!state.selection) {
      inspectorBody.appendChild(h('div', { class: 'insp-hint', text: 'No record selected.' }));
      inspectorBody.appendChild(h('div', { class: 'insp-hint', text: 'Click a row in the working set — the selection persists when you switch lenses.' }));
      return;
    }
    const r = DS.records.find((x) => x.id === state.selection);
    const out = excludedDims(r);
    inspectorBody.appendChild(h('div', { class: 'insp-id' }, [
      h('span', { text: r.id }),
      h('span', { class: `status-dot status-${r.status}`, 'aria-hidden': 'true' }),
    ]));
    inspectorBody.appendChild(h('div', {
      class: 'insp-state ' + (out.length ? 'outside' : 'visible'),
      text: out.length
        ? `outside current filters (excluded by: ${out.map(dimLabel).join(', ')}) — kept as your anchor`
        : 'inside the working set',
    }));
    for (const d of DIMS) {
      const f = state.filters.get(d.id);
      const bad = f && !matchDim(r, d, f);
      const row = h('div', { class: 'insp-dim' + (bad ? ' out-filter' : '') });
      const row1 = h('div', { class: 'row1' });
      row1.appendChild(h('span', { class: 'lab', text: d.label }));
      const val = h('span', { class: 'val' });
      val.appendChild(document.createTextNode((d.type === 'numeric' ? fmtVal(d, r[d.id]) : String(r[d.id])) + ' '));
      if (d.unit) val.appendChild(h('small', { text: d.unit }));
      if (bad) val.appendChild(h('span', { class: 'flag', text: '· outside filter' }));
      row1.appendChild(val);
      row.appendChild(row1);
      if (d.type === 'numeric') {
        const s = STATS[d.id];
        const pct = Math.max(0, Math.min(100, ((r[d.id] - s.min) / ((s.max - s.min) || 1)) * 100));
        row.appendChild(h('div', { class: 'inl-bar' }, [h('i', { style: `width:${pct.toFixed(1)}%` })]));
      }
      inspectorBody.appendChild(row);
    }
  }

  function renderLedger() {
    // filter chips — ownership is structural: exactly one chip per dimension filter, labeled by it
    chipsBox.textContent = '';
    $('#chip-count').textContent = state.filters.size ? `(${state.filters.size})` : '';
    if (!state.filters.size) {
      chipsBox.appendChild(h('span', { class: 'ledger-empty', text: 'No filters — the working set is the full dataset.' }));
    }
    for (const [dimId, f] of state.filters) {
      const dim = dimOf(dimId);
      const chip = h('span', { class: 'chip' });
      chip.appendChild(h('span', { class: 'chip-owner', text: dim.label }));
      chip.appendChild(h('span', { class: 'chip-pred', text: filterText(dim, f) }));
      chip.appendChild(h('button', {
        class: 'chip-x',
        title: `Remove the ${dim.label} filter`,
        'aria-label': `Remove the ${dim.label} filter ${filterText(dim, f)}`,
        text: '×',
        onclick: () => removeFilter(dimId),
      }));
      chipsBox.appendChild(chip);
    }
    // projection chip — the lens is owned state too, revertible to its previous value
    const le = lastLensEntry();
    const lensChip = h('span', { class: 'chip lens-chip' });
    lensChip.appendChild(h('span', { class: 'chip-owner', text: 'lens' }));
    lensChip.appendChild(h('span', { class: 'chip-pred', text: dimLabel(state.lens) }));
    lensChip.appendChild(h('button', {
      class: 'chip-x', text: '×',
      title: le ? `Revert projection to ${dimLabel(le.from)}` : 'No previous lens to revert to',
      'aria-label': le ? `Revert projection to ${dimLabel(le.from)}` : 'No previous lens to revert to',
      disabled: !le,
      onclick: () => le && setLens(le.from),
    }));
    chipsBox.appendChild(lensChip);

    // history — latest first, each entry individually revertible
    historyBox.textContent = '';
    $('#history-count').textContent = state.history.length ? `(${state.history.length})` : '';
    if (!state.history.length) {
      historyBox.appendChild(h('span', { class: 'ledger-empty', text: 'No changes yet — filter and lens actions will appear here, each revertible.' }));
    }
    for (const entry of state.history.slice(-14).reverse()) {
      const row = h('div', { class: 'hist-row' + (entry.spent ? ' spent' : '') });
      row.appendChild(h('span', { class: `hist-kind ${entry.kind}`, text: entry.kind }));
      row.appendChild(h('span', { class: 'hist-label', text: entry.label }));
      row.appendChild(h('button', {
        title: 'Revert exactly this change',
        'aria-label': `Revert: ${entry.label}`,
        text: '↩ revert',
        onclick: () => revertEntry(entry),
      }));
      historyBox.appendChild(row);
    }
  }

  function renderEmpty(ws) {
    const isEmpty = ws.length === 0;
    emptyState.hidden = !isEmpty;
    tableScroll.hidden = isEmpty;
    $('#btn-empty-clear').onclick = () => resetAll(true);
  }

  function renderAll() {
    const ws = workingSet();
    renderHeader(ws);
    renderRail();
    renderChart(ws);
    renderTable(ws);
    renderEmpty(ws);
    renderInspector();
    renderLedger();
    updateHash();
  }

  // ---------- global events ----------
  btnUndo.addEventListener('click', undoLatest);
  btnReset.addEventListener('click', () => resetAll(false));
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      undoLatest();
    }
  });

  // ---------- init: fully usable at first paint (data ships inline in data.js) ----------
  applyHash();
  $('#dataset-name').textContent = `${DS.name} · ${DS.count} records · ${DIMS.length} dimensions`;
  renderAll();
  booted = true;
})();
