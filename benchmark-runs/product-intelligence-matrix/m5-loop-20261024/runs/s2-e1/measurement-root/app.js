/* Prism — Dimension Explorer
 * Explore a multi-dimensional dataset by switching the grouping dimension
 * without resetting cognition: the record pool, filters, selection and the
 * exploration trail are lens-independent; every filter/projection step is
 * attributed to its owning dimension and individually revertible.
 *
 * All data is generated synchronously (seeded PRNG) so the app is usable at
 * first paint with no loading state. Classic script — opens from file://.
 */
'use strict';

/* ---------------- seeded PRNG + weighted pick ---------------- */

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------------- dimensions (the lenses) ---------------- */

const DIMS = [
  { id: 'category', label: 'Category', values: ['Electronics', 'Apparel', 'Home', 'Beauty', 'Sports', 'Toys', 'Grocery', 'Books'] },
  { id: 'region',   label: 'Region',   values: ['North', 'South', 'East', 'West', 'Central', 'Overseas'] },
  { id: 'channel',  label: 'Channel',  values: ['Web', 'Mobile App', 'Store', 'Phone', 'Partner'] },
  { id: 'segment',  label: 'Segment',  values: ['Consumer', 'Business', 'Education', 'Government'] },
  { id: 'payment',  label: 'Payment',  values: ['Card', 'Wallet', 'Transfer', 'COD', 'Installment'] },
  { id: 'quarter',  label: 'Quarter',  values: ['Q1', 'Q2', 'Q3', 'Q4'] },
  { id: 'carrier',  label: 'Carrier',  values: ['FastShip', 'BlueCargo', 'NationalPost', 'SameDay', 'Pickup'] },
  { id: 'priority', label: 'Priority', values: ['Standard', 'Express', 'Overnight'] },
  { id: 'size',     label: 'Order Size', values: ['S', 'M', 'L', 'XL', 'Bulk'] },
];
const DIM_MAP = Object.fromEntries(DIMS.map(d => [d.id, d]));
const DIM_COLORS = {
  category: '#5b8def', region: '#3fbf7f', channel: '#e0a53f', segment: '#a184f0',
  payment: '#e07aa8', quarter: '#3fc1d4', carrier: '#e08a4f', priority: '#7fd15c', size: '#c987e0',
};

/* value weights per dimension (non-uniform pools read more naturally) */
const WEIGHTS = {
  category: [20, 17, 14, 12, 11, 9, 9, 8],
  region:   [22, 18, 20, 16, 14, 10],
  channel:  [34, 28, 22, 8, 8],
  segment:  [46, 34, 11, 9],
  payment:  [38, 24, 16, 12, 10],
  quarter:  [21, 25, 24, 30],
  carrier:  [30, 24, 22, 12, 12],
  priority: [62, 27, 11],
  size:     [18, 32, 26, 16, 8],
};

const SEED = 42;
const N_RECORDS = 6400;

/* ---------------- inline dataset (ready at first paint) ---------------- */

function generateOrders(n, seed) {
  const rnd = mulberry32(seed);
  const pickers = {};
  for (const d of DIMS) {
    const w = WEIGHTS[d.id];
    const cum = []; let acc = 0;
    for (const x of w) { acc += x; cum.push(acc); }
    const total = acc;
    pickers[d.id] = () => {
      const r = rnd() * total;
      for (let i = 0; i < cum.length; i++) if (r < cum[i]) return d.values[i];
      return d.values[d.values.length - 1];
    };
  }
  const catBase = { Electronics: 260, Apparel: 120, Home: 180, Beauty: 70, Sports: 110, Toys: 65, Grocery: 38, Books: 30 };
  const sizeMul = { S: 0.5, M: 0.85, L: 1.3, XL: 2.1, Bulk: 4.4 };
  const segMul = { Consumer: 1, Business: 1.5, Education: 0.8, Government: 1.9 };
  const records = new Array(n);
  for (let i = 0; i < n; i++) {
    const r = { id: i + 1 };
    for (const d of DIMS) r[d.id] = pickers[d.id]();
    const units = 1 + Math.floor(rnd() * rnd() * 11);
    const noise = 0.55 + rnd() * 0.95;
    const revenue = catBase[r.category] * sizeMul[r.size] * segMul[r.segment] * units * noise;
    r.units = units;
    r.revenue = Math.round(revenue * 100) / 100;
    records[i] = r;
  }
  return records;
}

const RECORDS = generateOrders(N_RECORDS, SEED);

/* ---------------- state: lens / pool constraints / selection / log ---------------- */

const state = {
  activeDim: 'category',     // projection owner
  filters: {},               // dimId -> Set(allowed values); absent/empty = all allowed
  selection: null,           // {dim, value} — pinned to the facet, survives lens switches
  log: [],                   // command log; the trail renders this, undo/revert invert commands
};

function allowedSet(dimId) { return state.filters[dimId] || null; }

/* a constraint that admits every value (or none) is not a constraint */
function normalizeFilter(dimId) {
  const set = state.filters[dimId];
  if (!set) return;
  if (!set.size || set.size === DIM_MAP[dimId].values.length) delete state.filters[dimId];
}

function recordAllowed(r) {
  for (const d of DIMS) {
    const set = state.filters[d.id];
    if (set && set.size && !set.has(r[d.id])) return false;
  }
  return true;
}

function poolRecords() {
  const out = [];
  for (const r of RECORDS) if (recordAllowed(r)) out.push(r);
  return out;
}

/* ---------------- command store (attribution + revertibility) ---------------- */
/* Every projection/filter change is a logged command with an explicit inverse;
 * the trail lists the log, undo pops one, revert-to truncates and inverts. */

function push(cmd) { state.log.push(cmd); }

function invert(cmd) {
  switch (cmd.type) {
    case 'dim': state.activeDim = cmd.from; break;
    case 'filter':
      if (cmd.on) { if (state.filters[cmd.dim]) state.filters[cmd.dim].delete(cmd.value); }
      else { (state.filters[cmd.dim] ||= new Set()).add(cmd.value); }
      normalizeFilter(cmd.dim);
      break;
    case 'clear_dim':
      if (cmd.prev && cmd.prev.length) state.filters[cmd.dim] = new Set(cmd.prev);
      else delete state.filters[cmd.dim];
      break;
    case 'clear_all':
      state.filters = {};
      for (const [k, v] of cmd.prev) state.filters[k] = new Set(v);
      break;
    case 'reset':
      state.activeDim = cmd.prev.activeDim;
      state.filters = {};
      for (const [k, v] of cmd.prev.filters) state.filters[k] = new Set(v);
      break;
  }
}

function undo() {
  const cmd = state.log.pop();
  if (cmd) invert(cmd);
  render();
}

function revertTo(logLength) {
  while (state.log.length > logLength) invert(state.log.pop());
  render();
}

/* user actions — each pushes exactly one attributed command */

function switchDim(to) {
  if (to === state.activeDim) return;
  push({ type: 'dim', from: state.activeDim, to });
  state.activeDim = to;
  render();
}

function toggleOnly(dimId, value) {
  const cur = state.filters[dimId];
  const on = !(cur && cur.size === 1 && cur.has(value));
  if (on) state.filters[dimId] = new Set([value]);
  else delete state.filters[dimId];
  push({ type: 'filter', dim: dimId, value, on });
  render();
}

function excludeValue(dimId, value) {
  const dim = DIM_MAP[dimId];
  const cur = state.filters[dimId];
  if (!cur || !cur.size) state.filters[dimId] = new Set(dim.values.filter(v => v !== value));
  else { const next = new Set(cur); next.delete(value); state.filters[dimId] = next; }
  normalizeFilter(dimId);
  push({ type: 'filter', dim: dimId, value, on: false });
  render();
}

function clearDimFilter(dimId) {
  const prev = state.filters[dimId];
  if (!prev) return;
  delete state.filters[dimId];
  push({ type: 'clear_dim', dim: dimId, prev: [...prev] });
  render();
}

function clearAllFilters() {
  const prev = Object.entries(state.filters).map(([k, v]) => [k, [...v]]);
  if (!prev.length) return;
  state.filters = {};
  push({ type: 'clear_all', prev });
  render();
}

function resetAll() {
  const prev = { activeDim: state.activeDim, filters: Object.entries(state.filters).map(([k, v]) => [k, [...v]]) };
  state.activeDim = 'category';
  state.filters = {};
  state.selection = null;
  push({ type: 'reset', prev });
  render();
}

function setSelection(dim, value) {
  state.selection = (state.selection && state.selection.dim === dim && state.selection.value === value)
    ? null : { dim, value };
  render();
}

/* ---------------- aggregation ---------------- */

function aggregate(records, dimId) {
  const map = new Map();
  for (const v of DIM_MAP[dimId].values) map.set(v, { value: v, count: 0, revenue: 0, units: 0 });
  for (const r of records) {
    const row = map.get(r[dimId]);
    row.count++; row.revenue += r.revenue; row.units += r.units;
  }
  const rows = [...map.values()].sort((a, b) => b.count - a.count);
  return rows;
}

function crossAggregate(records, dimId) {
  const map = new Map();
  for (const r of records) {
    const k = r[dimId];
    const row = map.get(k) || { value: k, count: 0 };
    row.count++; map.set(k, row);
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}

/* ---------------- formatting ---------------- */

const fmtInt = n => n.toLocaleString('en-US');
function fmtMoney(n) {
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e4) return '$' + (n / 1e3).toFixed(1) + 'K';
  return '$' + Math.round(n).toLocaleString('en-US');
}
const fmtPct = x => (x * 100).toFixed(1) + '%';

/* ---------------- render ---------------- */

const $ = id => document.getElementById(id);
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const dimColor = id => DIM_COLORS[id] || '#8b93a3';

function filterSummary(dimId) {
  const set = state.filters[dimId];
  if (!set || !set.size) return '';
  const vals = [...set];
  const label = vals.slice(0, 2).join(', ') + (vals.length > 2 ? ` +${vals.length - 2} more` : '');
  return `${vals.length}/${DIM_MAP[dimId].values.length} · ${label}`;
}

function renderHeaderMeta(pool) {
  const totalValues = DIMS.reduce((a, d) => a + d.values.length, 0);
  $('dataset-meta').innerHTML = '';
  const mk = (html, cls) => { const s = el('span', cls); s.innerHTML = html; return s; };
  $('dataset-meta').append(
    mk(`<b>${fmtInt(N_RECORDS)}</b> orders`),
    mk(`seed <b>${SEED}</b>`),
    mk(`<b>${DIMS.length}</b> dimensions · <b>${totalValues}</b> values`),
    mk(`${pool.length === N_RECORDS ? 'full pool' : 'pool <b>' + fmtInt(pool.length) + '</b>'}`,
      pool.length === N_RECORDS ? 'meta-scope-ok' : 'meta-scope-cut'),
  );
}

function renderRail() {
  const list = $('dim-list');
  list.innerHTML = '';
  $('dim-count').textContent = DIMS.length;
  for (const d of DIMS) {
    const b = el('button', 'dim-item' + (d.id === state.activeDim ? ' active' : ''));
    b.tabIndex = -1; // reached via the rail's roving ↑↓, not Tab
    b.style.setProperty('--dim', dimColor(d.id));
    b.dataset.dim = d.id;
    const dot = el('span', 'dim-dot');
    const name = el('span', 'dim-name', d.label);
    b.append(dot, name);
    const set = state.filters[d.id];
    if (set && set.size) b.append(el('span', 'dim-badge filters', `${set.size}/${d.values.length}`));
    else b.append(el('span', 'dim-badge', String(d.values.length)));
    b.title = `Group by ${d.label} (${d.values.length} values)`;
    b.addEventListener('click', () => switchDim(d.id));
    list.append(b);
  }
}

function renderStrip(pool) {
  const strip = $('state-strip');
  strip.innerHTML = '';

  const lens = el('span', 'chip chip-projection');
  lens.style.setProperty('--dim', dimColor(state.activeDim));
  lens.append(
    el('span', 'chip-dot'),
    el('span', 'chip-kind', 'lens'),
    el('span', 'chip-owner', DIM_MAP[state.activeDim].label),
  );
  lens.title = 'Active projection — switch it from the dimension rail';
  strip.append(lens);

  let constrained = false;
  for (const d of DIMS) {
    const set = state.filters[d.id];
    if (!set || !set.size) continue;
    constrained = true;
    const chip = el('span', 'chip');
    chip.style.setProperty('--dim', dimColor(d.id));
    chip.append(
      el('span', 'chip-dot'),
      el('span', 'chip-kind', 'filter'),
      el('span', 'chip-owner', d.label),
      el('span', 'chip-val', filterSummary(d.id)),
    );
    const x = el('button', 'chip-x', '✕');
    x.tabIndex = -1; // chip removal is reachable via trail revert / undo / reset
    x.title = `Remove the ${d.label} filter`;
    x.setAttribute('aria-label', `Remove ${d.label} filter`);
    x.addEventListener('click', () => clearDimFilter(d.id));
    chip.append(x);
    strip.append(chip);
  }

  if (state.selection) {
    constrained = true;
    const s = state.selection;
    const chip = el('span', 'chip');
    chip.style.setProperty('--dim', dimColor(s.dim));
    chip.append(
      el('span', 'chip-dot'),
      el('span', 'chip-kind', 'pin'),
      el('span', 'chip-owner', DIM_MAP[s.dim].label),
      el('span', 'chip-val', s.value),
    );
    const x = el('button', 'chip-x', '✕');
    x.tabIndex = -1;
    x.title = 'Release selection';
    x.setAttribute('aria-label', 'Release selection');
    x.addEventListener('click', () => { state.selection = null; render(); });
    chip.append(x);
    strip.append(chip);
  }

  if (!constrained) {
    strip.append(el('span', 'strip-empty', 'Full pool — no filters, no selection. Click a value to pin it, “only / cut” to filter.'));
  } else {
    const ca = el('button', 'btn btn-mini strip-action', 'Clear filters');
    ca.tabIndex = -1; // keyboard path: Ctrl+Z / trail revert
    ca.addEventListener('click', clearAllFilters);
    strip.append(ca);
  }
}

function renderGrid(pool) {
  gridHl = -1; // rows are rebuilt; any keyboard highlight is stale
  const active = state.activeDim;
  const dim = DIM_MAP[active];
  const head = $('grid-head');
  head.innerHTML = '';
  const ghDim = el('span', 'gh-dim');
  const dot = el('span', 'dim-dot'); dot.style.background = dimColor(active);
  ghDim.append(dot, document.createTextNode(`Orderstream · grouped by ${dim.label}`));
  const ghScope = el('span', 'gh-scope');
  ghScope.innerHTML = `<b>${fmtInt(pool.length)}</b> of ${fmtInt(N_RECORDS)} records`;
  head.append(ghDim, ghScope);

  const body = $('proj-body');
  body.innerHTML = '';
  const rows = aggregate(pool, active);
  const max = rows[0] ? rows[0].count : 0;
  const total = rows.reduce((a, r) => a + r.count, 0);
  const sel = state.selection;

  $('grid-empty').hidden = total !== 0;
  for (const r of rows) {
    const tr = el('tr');
    tr.style.setProperty('--dim', dimColor(active));
    tr.tabIndex = 0;
    tr.setAttribute('role', 'button');
    const isSel = sel && sel.dim === active && sel.value === r.value;
    if (isSel) tr.classList.add('selected');
    const set = state.filters[active];
    if (set && set.size) {
      if (set.has(r.value)) tr.classList.add('filtered-in');
      else tr.classList.add('muted');
    }

    const tdV = el('td', 'col-val', r.value);
    const tdC = el('td', 'col-num', fmtInt(r.count));
    const tdB = el('td', 'col-bar');
    const bar = el('span', 'share-bar'); const fill = el('i');
    fill.style.width = max ? (r.count / max * 100).toFixed(1) + '%' : '0%';
    bar.append(fill); tdB.append(bar);
    const tdP = el('td', 'col-num', total ? fmtPct(r.count / total) : '—');
    const tdR = el('td', 'col-num', fmtMoney(r.revenue));
    const tdA = el('td', 'col-num', r.count ? fmtMoney(r.revenue / r.count) : '—');
    const tdAct = el('td', 'col-act');
    const act = el('span', 'row-act');
    const bOnly = el('button', 'act-btn' + (set && set.size === 1 && set.has(r.value) ? ' on' : ''), '⦿ only');
    bOnly.tabIndex = -1; // hover affordance; keyboard equivalent is F on the row
    bOnly.title = `Show only ${r.value}`;
    bOnly.addEventListener('click', e => { e.stopPropagation(); toggleOnly(active, r.value); });
    const bCut = el('button', 'act-btn', '⊘ cut');
    bCut.tabIndex = -1;
    bCut.title = `Exclude ${r.value}`;
    bCut.addEventListener('click', e => { e.stopPropagation(); excludeValue(active, r.value); });
    act.append(bOnly, bCut); tdAct.append(act);

    tr.append(tdV, tdC, tdB, tdP, tdR, tdA, tdAct);
    tr.addEventListener('click', () => setSelection(active, r.value));
    tr.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelection(active, r.value); } });
    body.append(tr);
  }
}

function renderInspector(pool) {
  const box = $('inspector');
  box.innerHTML = '';
  box.append(el('div', 'insp-head', 'Inspector'));

  if (!state.selection) {
    box.append(el('div', 'insp-hint',
      'No selection. Click any value in the projection to pin it — the pin survives lens switches, so you can follow one entity across every dimension.'));
    return;
  }

  const s = state.selection;
  const dim = DIM_MAP[s.dim];
  const scoped = pool.filter(r => r[s.dim] === s.value);
  const count = scoped.length;
  const revenue = scoped.reduce((a, r) => a + r.revenue, 0);

  const title = el('div', 'insp-title');
  const tdot = el('span', 'dim-dot'); tdot.style.background = dimColor(s.dim);
  title.append(tdot, el('span', null, s.value), el('span', 'insp-owner', `· ${dim.label}`));
  const scope = el('div', 'insp-scope');
  scope.innerHTML = `<b>${fmtInt(count)}</b> of ${fmtInt(pool.length)} in-pool records match`;

  const stats = el('div', 'insp-stats');
  const stat = (k, v) => { const d = el('div', 'insp-stat'); d.append(el('div', 'k', k), el('div', 'v', v)); return d; };
  stats.append(stat('Orders', fmtInt(count)), stat('Revenue', fmtMoney(revenue)),
    stat('Share of pool', pool.length ? fmtPct(count / pool.length) : '—'));

  const crossLabel = el('div', 'insp-cross-label');
  const cdot = el('span', 'dim-dot'); cdot.style.background = dimColor(state.activeDim);
  crossLabel.append(cdot, document.createTextNode(`Across ${DIM_MAP[state.activeDim].label}`));

  box.append(title, scope, stats, crossLabel);

  if (!count) {
    box.append(el('div', 'insp-hint', 'This value has no in-pool records under the current filters.'));
    return;
  }
  const cross = crossAggregate(scoped, state.activeDim);
  const max = cross[0].count;
  const show = cross.slice(0, 6);
  let shown = 0;
  for (const c of show) {
    const row = el('div', 'cross-row');
    row.style.setProperty('--dim', dimColor(state.activeDim));
    const bar = el('span', 'cbar'); const fill = el('i');
    fill.style.width = (c.count / max * 100).toFixed(1) + '%';
    bar.append(fill);
    row.append(el('span', 'cv', c.value), bar, el('span', 'cpct', fmtPct(c.count / count)));
    box.append(row);
    shown += c.count;
  }
  if (cross.length > show.length) {
    const rest = count - shown;
    const row = el('div', 'cross-row');
    row.style.setProperty('--dim', dimColor(state.activeDim));
    const bar = el('span', 'cbar'); const fill = el('i');
    fill.style.width = '0%';
    bar.append(fill);
    row.append(el('span', 'cv', `+${cross.length - show.length} others`), bar,
      el('span', 'cpct', fmtPct(rest / count)));
    box.append(row);
  }
}

function trailLabel(cmd) {
  switch (cmd.type) {
    case 'dim': return { dim: cmd.to, html: `lens → <b>${DIM_MAP[cmd.to].label}</b>` };
    case 'filter': return cmd.on
      ? { dim: cmd.dim, html: `filter + <b>${DIM_MAP[cmd.dim].label}</b> ⊂ ${cmd.value}` }
      : { dim: cmd.dim, html: `filter − <b>${DIM_MAP[cmd.dim].label}</b> ∌ ${cmd.value}` };
    case 'clear_dim': return { dim: cmd.dim, html: `cleared <b>${DIM_MAP[cmd.dim].label}</b> filter` };
    case 'clear_all': return { dim: null, html: `cleared <b>all filters</b>` };
    case 'reset': return { dim: null, html: `<b>reset all</b> state` };
  }
  return { dim: null, html: 'step' };
}

function renderTrail() {
  const list = $('trail-list');
  list.innerHTML = '';
  $('trail-count').textContent = state.log.length ? `${state.log.length} steps` : '0 steps';

  const base = el('li', 'trail-item base');
  base.style.setProperty('--dim', dimColor('category'));
  base.append(el('span', 'trail-idx', '0'), el('span', 'trail-dot'),
    (() => { const s = el('span', 'trail-label'); s.innerHTML = `initial — by <b>${DIM_MAP.category.label}</b>`; return s; })());
  const bRevert = el('button', 'trail-revert', '↩ here');
  bRevert.tabIndex = -1;
  bRevert.title = 'Revert everything after this point';
  bRevert.addEventListener('click', () => revertTo(0));
  base.append(bRevert);
  list.append(base);

  state.log.forEach((cmd, i) => {
    const { dim, html } = trailLabel(cmd);
    const li = el('li', 'trail-item');
    if (dim) li.style.setProperty('--dim', dimColor(dim));
    li.append(el('span', 'trail-idx', String(i + 1)));
    const dot = el('span', 'trail-dot');
    if (!dim) dot.style.background = '#5c6575';
    li.append(dot);
    const label = el('span', 'trail-label'); label.innerHTML = html;
    li.append(label);
    const rv = el('button', 'trail-revert', '↩ here');
    rv.tabIndex = -1; // reached via the trail panel's roving ↑↓ + Enter
    rv.title = 'Revert to this point';
    rv.addEventListener('click', () => revertTo(i + 1));
    li.append(rv);
    list.append(li);
  });
  list.scrollTop = list.scrollHeight;
}

function setButtons() {
  $('btn-undo').disabled = !state.log.length;
  $('btn-trail-undo').disabled = !state.log.length;
}

function render() {
  const pool = poolRecords();
  renderHeaderMeta(pool);
  renderRail();
  renderStrip(pool);
  renderGrid(pool);
  renderInspector(pool);
  renderTrail();
  setButtons();
}

function renderError(err) {
  $('grid-error').hidden = false;
  $('grid-error-msg').textContent = String(err && err.message || err);
}

/* ---------------- events ---------------- */

$('btn-undo').addEventListener('click', undo);
$('btn-trail-undo').addEventListener('click', undo);
$('btn-reset').addEventListener('click', resetAll);
$('btn-empty-clear').addEventListener('click', clearAllFilters);

/* Header buttons are pointer shortcuts kept out of the tab ring: the tab
 * sequence then reads strictly left→right (rail → grid → trail), and every
 * header function stays keyboard-reachable (Ctrl+Z undo; trail revert-to-base
 * + Esc = reset). */
$('btn-undo').tabIndex = -1;
$('btn-reset').tabIndex = -1;
$('btn-trail-undo').tabIndex = -1;
$('btn-empty-clear').tabIndex = -1;

document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); }
  else if (e.key === 'Escape' && state.selection) { state.selection = null; render(); }
});

/* roving arrows inside the dimension rail: ↑/↓ move focus, Enter activates */
$('dim-rail').addEventListener('keydown', e => {
  if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
  const items = [...$('dim-list').querySelectorAll('.dim-item')];
  const idx = items.indexOf(document.activeElement);
  e.preventDefault();
  const start = idx === -1 ? (e.key === 'ArrowDown' ? -1 : 0) : idx;
  const next = items[Math.min(items.length - 1, Math.max(0, start + (e.key === 'ArrowDown' ? 1 : -1)))];
  if (next) next.focus();
});

/* composite keyboard for the grid: one tab stop, ↑↓ highlight, Enter pin, F only */
let gridHl = -1;
function hlRow(idx) {
  const rows = [...document.querySelectorAll('#proj-body tr')];
  rows.forEach(r => r.classList.remove('kbd-hl'));
  gridHl = idx;
  if (rows[gridHl]) {
    rows[gridHl].classList.add('kbd-hl');
    rows[gridHl].scrollIntoView({ block: 'nearest' });
  }
}
$('grid-scroll').addEventListener('keydown', e => {
  const rows = document.querySelectorAll('#proj-body tr');
  if (!rows.length) return;
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    const base = gridHl < 0 ? (e.key === 'ArrowDown' ? -1 : 0) : gridHl;
    hlRow(Math.min(rows.length - 1, Math.max(0, base + (e.key === 'ArrowDown' ? 1 : -1))));
  } else if ((e.key === 'Enter' || e.key === ' ') && gridHl >= 0) {
    e.preventDefault();
    rows[gridHl].click();
  } else if ((e.key === 'f' || e.key === 'F') && gridHl >= 0) {
    e.preventDefault();
    rows[gridHl].querySelector('.act-btn')?.click();
  }
});
$('grid-scroll').addEventListener('blur', () => hlRow(-1));

/* composite keyboard for the trail: one tab stop, ↑↓ highlight, Enter reverts */
let trailHl = -1;
function hlStep(idx) {
  const items = [...document.querySelectorAll('#trail-list .trail-item')];
  items.forEach(i => i.classList.remove('kbd-hl'));
  trailHl = idx;
  if (items[trailHl]) {
    items[trailHl].classList.add('kbd-hl');
    items[trailHl].scrollIntoView({ block: 'nearest' });
  }
}
$('trail-panel').addEventListener('keydown', e => {
  const items = document.querySelectorAll('#trail-list .trail-item');
  if (!items.length) return;
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    const base = trailHl < 0 ? (e.key === 'ArrowDown' ? -1 : 0) : trailHl;
    hlStep(Math.min(items.length - 1, Math.max(0, base + (e.key === 'ArrowDown' ? 1 : -1))));
  } else if ((e.key === 'Enter' || e.key === ' ') && trailHl >= 0) {
    e.preventDefault();
    items[trailHl].querySelector('.trail-revert')?.click();
  }
});
$('trail-panel').addEventListener('blur', () => hlStep(-1));

/* ---------------- boot: synchronous, usable at first paint ---------------- */

/* Deep-link replay: #r=dim:region|sel:region:West|only:region:West|dim:channel
 * replays a command sequence through the same store as live interaction,
 * so a shared view arrives with its full attributed trail. */
function replayFromHash() {
  const m = /(?:^#|&)r=([^&]*)/.exec(location.hash);
  if (!m) return;
  for (const step of m[1].split('|')) {
    const [op, a, b] = step.split(':');
    if (op === 'dim' && DIM_MAP[a]) switchDim(a);
    else if (op === 'sel' && DIM_MAP[a]) {
      if (DIM_MAP[a].values.includes(b)) { state.selection = null; setSelection(a, b); }
    } else if (op === 'only' && DIM_MAP[a] && DIM_MAP[a].values.includes(b)) toggleOnly(a, b);
    else if (op === 'cut' && DIM_MAP[a] && DIM_MAP[a].values.includes(b)) excludeValue(a, b);
  }
}

try {
  replayFromHash();
  render();
} catch (err) {
  renderError(err);
}
