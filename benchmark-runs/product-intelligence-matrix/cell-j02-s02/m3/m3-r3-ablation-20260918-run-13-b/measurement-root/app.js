/* PartAtlas — locate app.
 *
 * Pattern: PAT-LIST-DETAIL (filter-first). Three state owners:
 *   query  → search_bar   (S.q)
 *   filters→ filter_rail  (S.cat, S.fam, S.dims)
 *   select → results_list (S.sel) mirrored by detail_inspector
 * Context rule: query and filters compose (AND) and NEVER reset each other or
 * the selection. A selection that falls out of the narrowing is annotated in
 * the inspector, never dropped.
 */
(function () {
  'use strict';

  const $ = (s) => document.querySelector(s);
  const app = $('#app');

  /* ── phase gate: data must exist because data.js ran before this script ── */
  const C = window.CATALOG;
  if (!C || !C.parts || !C.parts.length) {
    app.dataset.phase = 'error';
    $('#state-loading').hidden = true;
    $('#state-error').hidden = false;
    return;
  }

  /* ── catalog indexes ──────────────────────────────────────────────────── */
  const byId = new Map(C.parts.map((p) => [p.id, p]));
  const famName = new Map();
  for (const cid of Object.keys(C.families))
    for (const f of C.families[cid]) famName.set(f.id, f.name);
  const catName = new Map(C.categories.map((c) => [c.id, c.name]));

  /* ── state ────────────────────────────────────────────────────────────── */
  const S = {
    q: '',
    cat: null,            // category id | null
    fam: null,            // family id | null
    dims: { pkgGroup: new Set(), mount: new Set(), tol: new Set(), avail: new Set() },
    open: new Set(),      // expanded categories in the rail
    sel: null,            // selected part id (roving, survives narrowing)
    phase: 'ready',       // ready | empty | error (loading handled in markup)
  };

  const DIMS = [
    { key: 'pkgGroup', label: 'Package group', part: (p) => p.pkgGroup },
    { key: 'mount',    label: 'Mount',         part: (p) => p.mount },
    { key: 'tol',      label: 'Tolerance',     part: (p) => p.tol,   skip: (v) => v === '—' },
    { key: 'avail',    label: 'Availability',  part: (p) => p.avail },
  ];

  /* ── querying ─────────────────────────────────────────────────────────── */
  function tokens() {
    return S.q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  }

  function makeTest(o) { // o: { qt, cat, fam, dims: {key:Set} }
    return (p) => {
      for (let i = 0; i < o.qt.length; i++) if (!p.hay.includes(o.qt[i])) return false;
      if (o.cat && p.cat !== o.cat) return false;
      if (o.fam && p.fam !== o.fam) return false;
      for (const d of DIMS) {
        const set = o.dims[d.key];
        if (set && set.size && !set.has(d.part(p))) return false;
      }
      return true;
    };
  }

  let K = null; // last computed view: { rows, rowIds, catCounts, famCounts, dimCounts }

  function compute() {
    const qt = tokens();
    const dimsAll = { pkgGroup: S.dims.pkgGroup, mount: S.dims.mount, tol: S.dims.tol, avail: S.dims.avail };

    const base = C.parts.filter(makeTest({ qt, dims: dimsAll }));
    const catCounts = {}, famCounts = {};
    for (const p of base) { catCounts[p.cat] = (catCounts[p.cat] || 0) + 1; famCounts[p.fam] = (famCounts[p.fam] || 0) + 1; }
    const rows = S.cat || S.fam ? base.filter((p) => (!S.cat || p.cat === S.cat) && (!S.fam || p.fam === S.fam)) : base;

    const dimCounts = {};
    for (const d of DIMS) {
      const dims2 = Object.assign({}, dimsAll, { [d.key]: new Set() });
      const t = makeTest({ qt, cat: S.cat, fam: S.fam, dims: dims2 });
      const counts = {};
      for (const p of C.parts) {
        if (!t(p)) continue;
        const v = d.part(p);
        if (d.skip && d.skip(v)) continue;
        counts[v] = (counts[v] || 0) + 1;
      }
      dimCounts[d.key] = counts;
    }

    const rowIds = new Set(rows.map((p) => p.id));
    return (K = { rows, rowIds, catCounts, famCounts, dimCounts });
  }

  /* ── helpers ──────────────────────────────────────────────────────────── */
  const fmt = (n) => n.toLocaleString('en-US');
  function activeFilterCount() {
    let n = 0;
    if (S.q.trim()) n++;
    if (S.cat) n++;
    if (S.fam) n++;
    for (const k of Object.keys(S.dims)) n += S.dims[k].size;
    return n;
  }

  /* ── region: search_bar ───────────────────────────────────────────────── */
  const q = $('#q'), qClear = $('#q-clear');
  q.addEventListener('input', () => { S.q = q.value; qClear.hidden = !q.value; render(); });
  qClear.addEventListener('click', () => { q.value = ''; S.q = ''; qClear.hidden = true; render(); q.focus(); });

  /* ── region: breadcrumb_strip ─────────────────────────────────────────── */
  const crumbs = $('#crumbs');
  function renderCrumbs() {
    const frag = document.createDocumentFragment();
    const mk = (label, cls, fn, ariaPressed) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'crumb ' + cls;
      b.textContent = label;
      if (ariaPressed !== undefined) b.setAttribute('aria-pressed', ariaPressed ? 'true' : 'false');
      b.addEventListener('click', fn);
      return b;
    };
    const sep = () => { const s = document.createElement('span'); s.className = 'crumb-sep'; s.textContent = '›'; return s; };

    frag.append(mk('All parts', S.cat ? '' : 'is-active', () => { S.cat = null; S.fam = null; render(); }), sep());
    if (S.cat) {
      frag.append(mk(catName.get(S.cat), S.fam ? '' : 'is-active', () => { S.fam = null; render(); }), sep());
      if (S.fam) frag.append(mk(famName.get(S.fam), 'is-active', () => {}));
    } else {
      const hint = document.createElement('span');
      hint.className = 'crumb-hint'; hint.textContent = 'no category scope';
      frag.append(hint);
    }

    // removable facet chips
    for (const d of DIMS) {
      for (const v of S.dims[d.key]) {
        const chip = document.createElement('button');
        chip.type = 'button'; chip.className = 'crumb-chip';
        chip.title = 'Remove filter';
        chip.innerHTML = `<span>${d.label}: ${v}</span><span class="x">×</span>`;
        chip.setAttribute('aria-label', `Remove filter ${d.label} ${v}`);
        chip.addEventListener('click', () => { S.dims[d.key].delete(v); render(); });
        frag.append(chip);
      }
    }

    if (activeFilterCount() > 0) {
      const clear = document.createElement('button');
      clear.type = 'button'; clear.className = 'crumb-clear';
      clear.textContent = 'Clear all';
      clear.addEventListener('click', clearAll);
      frag.append(clear);
    }
    crumbs.replaceChildren(frag);
  }

  function clearAll() {
    S.q = ''; q.value = ''; qClear.hidden = true;
    S.cat = null; S.fam = null;
    for (const k of Object.keys(S.dims)) S.dims[k].clear();
    render();
  }

  /* ── region: filter_rail ──────────────────────────────────────────────── */
  const rail = $('#rail');
  function renderRail() {
    const frag = document.createDocumentFragment();
    const H = (text) => { const h = document.createElement('h2'); h.className = 'rail-h'; h.textContent = text; return h; };

    // — collection tree —
    frag.append(H('Collection'));
    const allBtn = document.createElement('button');
    allBtn.type = 'button';
    allBtn.className = 'cat-row all' + (S.cat ? '' : ' is-active');
    allBtn.setAttribute('aria-pressed', S.cat ? 'false' : 'true');
    allBtn.innerHTML = `<span></span><span class="cat-name">All parts</span><span class="count">${fmt(C.parts.length)}</span>`;
    allBtn.addEventListener('click', () => { S.cat = null; S.fam = null; render(); });
    frag.append(allBtn);

    for (const c of C.categories) {
      const isOpen = S.open.has(c.id) || S.cat === c.id;
      const rowEl = document.createElement('div');
      rowEl.className = 'cat-item';
      // chevron toggles browsing scope; the name button narrows to the category
      const head = document.createElement('div');
      head.className = 'cat-head' + (S.cat === c.id ? ' is-active' : '');
      const chev = document.createElement('button');
      chev.type = 'button';
      chev.className = 'chev';
      chev.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      chev.setAttribute('aria-label', `${isOpen ? 'Collapse' : 'Expand'} ${c.name} families`);
      chev.textContent = isOpen ? '▾' : '▸';
      chev.addEventListener('click', () => { S.open.has(c.id) ? S.open.delete(c.id) : S.open.add(c.id); render(); });
      const nameBtn = document.createElement('button');
      nameBtn.type = 'button';
      nameBtn.className = 'cat-btn';
      nameBtn.setAttribute('aria-pressed', S.cat === c.id ? 'true' : 'false');
      nameBtn.innerHTML = `<span class="cat-name">${c.name}</span><span class="count">${fmt(K.catCounts[c.id] || 0)}</span>`;
      nameBtn.addEventListener('click', () => { S.cat = c.id; S.fam = null; render(); });
      head.append(chev, nameBtn);
      rowEl.append(head);

      if (isOpen) {
        const listEl = document.createElement('div');
        listEl.className = 'fam-list';
        for (const f of C.families[c.id]) {
          const n = K.famCounts[f.id] || 0;
          const fb = document.createElement('button');
          fb.type = 'button';
          fb.className = 'fam-row' + (S.fam === f.id ? ' is-active' : '');
          fb.setAttribute('aria-pressed', S.fam === f.id ? 'true' : 'false');
          fb.innerHTML = `<span class="fam-name">${f.name}</span><span class="count">${fmt(n)}</span>`;
          fb.addEventListener('click', () => { S.fam = f.id; S.cat = c.id; render(); });
          listEl.append(fb);
        }
        rowEl.append(listEl);
      }
      frag.append(rowEl);
    }

    // — facets —
    for (const d of DIMS) {
      const counts = K.dimCounts[d.key];
      const entries = Object.keys(counts)
        .filter((v) => !(d.skip && d.skip(v)))
        .sort((a, b) => counts[b] - counts[a]);
      const active = [...S.dims[d.key]];
      const shown = entries.slice(0, 14).concat(active.filter((v) => !entries.slice(0, 14).includes(v)));
      const sec = document.createElement('section');
      sec.className = 'facet';
      sec.append(H(d.label));
      const wrap = document.createElement('div');
      wrap.className = 'chips';
      for (const v of shown) {
        const chip = document.createElement('button');
        chip.type = 'button';
        const on = S.dims[d.key].has(v);
        chip.className = 'chip' + (on ? ' is-active' : '');
        chip.setAttribute('aria-pressed', on ? 'true' : 'false');
        chip.innerHTML = `<span>${v}</span><span class="count">${fmt(counts[v] || 0)}</span>`;
        chip.addEventListener('click', () => { on ? S.dims[d.key].delete(v) : S.dims[d.key].add(v); render(); });
        wrap.append(chip);
      }
      sec.append(wrap);
      frag.append(sec);
    }
    rail.replaceChildren(frag);
  }

  /* ── region: results_list (grouped, chunked, roving selection) ────────── */
  const list = $('#list');
  const sentinel = $('#sentinel');
  const CHUNK = 250;
  let groups = [];      // [{catId, famId, name, parts:[…]}]
  let cursor = { g: 0, i: 0 };
  let io = new IntersectionObserver(onSense, { root: list.parentElement, rootMargin: '600px' });
  io.observe(sentinel);

  function buildGroups() {
    groups = [];
    let cur = null;
    for (const p of K.rows) {
      if (!cur || cur.famId !== p.fam) {
        cur = { famId: p.fam, name: `${catName.get(p.cat)} › ${famName.get(p.fam)}`, parts: [] };
        groups.push(cur);
      }
      cur.parts.push(p);
    }
    cursor = { g: 0, i: 0 };
  }

  function rowEl(p) {
    const li = document.createElement('li');
    li.className = 'row' + (S.sel === p.id ? ' is-selected' : '');
    li.id = 'opt-' + p.id;
    li.setAttribute('role', 'option');
    li.setAttribute('aria-selected', S.sel === p.id ? 'true' : 'false');
    li.dataset.id = p.id;
    li.innerHTML =
      `<div class="row-top"><span class="mpn">${p.mpn}</span>` +
      `<span class="meta">${p.value}${p.pkg ? ' · ' + p.pkg : ''}</span></div>` +
      `<div class="row-desc"><span class="desc">${p.desc}</span>` +
      `<span class="stock s-${p.avail.split(' ')[0].toLowerCase()}">${p.avail}${p.stock ? ' · ' + fmt(p.stock) : ''}</span></div>`;
    return li;
  }

  function renderMore() {
    if (cursor.g >= groups.length) return false;
    const frag = document.createDocumentFragment();
    let budget = CHUNK;
    while (budget > 0 && cursor.g < groups.length) {
      const g = groups[cursor.g];
      if (cursor.i === 0) {
        const gh = document.createElement('li');
        gh.className = 'group'; gh.setAttribute('role', 'presentation');
        gh.innerHTML = `<span class="group-name">${g.name}</span><span class="count">${fmt(g.parts.length)}</span>`;
        frag.append(gh);
      }
      while (cursor.i < g.parts.length && budget-- > 0) frag.append(rowEl(g.parts[cursor.i++]));
      if (cursor.i >= g.parts.length) { cursor.g++; cursor.i = 0; }
    }
    list.append(frag);
    if (S.sel != null) {
      const el = document.getElementById('opt-' + S.sel);
      if (el) { list.setAttribute('aria-activedescendant', el.id); el.classList.add('is-selected'); el.setAttribute('aria-selected', 'true'); }
    }
    return cursor.g < groups.length;
  }

  function ensureRendered(id) {
    while (!document.getElementById('opt-' + id) && renderMore()) { /* chunk until present */ }
  }

  function onSense(entries) {
    if (entries.some((e) => e.isIntersecting) && !list.hidden) renderMore();
  }

  function renderList() {
    const empty = K.rows.length === 0;
    $('#state-empty').hidden = !empty;
    list.hidden = empty;
    sentinel.hidden = empty;
    app.dataset.empty = empty ? 'true' : 'false';
    if (empty) { list.replaceChildren(); return; }
    buildGroups();
    list.replaceChildren();
    renderMore();
  }

  list.addEventListener('click', (e) => {
    const li = e.target.closest('.row');
    if (li) select(Number(li.dataset.id), false);
  });

  /* ── region: detail_inspector ─────────────────────────────────────────── */
  const inspector = $('#inspector');
  function renderInspector() {
    app.dataset.selected = S.sel != null ? 'true' : 'false';
    if (S.sel == null) {
      inspector.replaceChildren();
      inspector.innerHTML =
        `<h2 class="ins-h">Inspector</h2>` +
        `<div class="ins-empty"><p>Select a part to inspect it here.</p>` +
        `<p class="ins-note">The results list and your narrowing stay exactly where they are — detail never replaces context.</p></div>`;
      return;
    }
    const p = byId.get(S.sel);
    const inNarrow = K.rowIds.has(p.id);
    const spec = (k, v) => v && v !== '—' ? `<div class="spec"><dt>${k}</dt><dd>${v}</dd></div>` : '';
    inspector.innerHTML =
      `<h2 class="ins-h">Inspector</h2>` +
      `<div class="ins-badge ${inNarrow ? 'ok' : 'out'}">${inNarrow ? '✓ in current narrowing' : '⚠ outside current narrowing'}</div>` +
      (inNarrow ? '' : `<button type="button" class="btn reveal">Show in its home context</button>`) +
      `<div class="ins-mpn">${p.mpn}</div>` +
      `<p class="ins-desc">${p.desc}</p>` +
      `<div class="ins-path">` +
        `<button type="button" class="path" data-cat="${p.cat}">${catName.get(p.cat)}</button> › ` +
        `<button type="button" class="path" data-fam="${p.fam}" data-cat="${p.cat}">${famName.get(p.fam)}</button>` +
      `</div>` +
      `<dl class="specs">` +
        spec('Value', p.value) + spec('Package', p.pkg) + spec('Package group', p.pkgGroup) +
        spec('Mount', p.mount) + spec('Tolerance', p.tol) + spec('Rating', p.volt) +
        spec('Stock', p.stock === 0 ? '0 — out of stock' : fmt(p.stock) + ' units') +
      `</dl>`;
    inspector.querySelector('.reveal')?.addEventListener('click', () => {
      S.q = ''; q.value = ''; qClear.hidden = true;
      for (const k of Object.keys(S.dims)) S.dims[k].clear();
      S.cat = p.cat; S.fam = p.fam;
      render();
    });
    inspector.querySelectorAll('.path').forEach((b) => b.addEventListener('click', () => {
      S.cat = b.dataset.cat; S.fam = b.dataset.fam || null; render();
    }));
  }

  /* ── selection (context rule: never reset by narrowing) ───────────────── */
  function select(id, scroll) {
    S.sel = id;
    ensureRendered(id);
    for (const el of list.querySelectorAll('.row.is-selected')) {
      el.classList.remove('is-selected'); el.setAttribute('aria-selected', 'false');
    }
    const el = document.getElementById('opt-' + id);
    if (el) {
      el.classList.add('is-selected'); el.setAttribute('aria-selected', 'true');
      list.setAttribute('aria-activedescendant', el.id);
      if (scroll) el.scrollIntoView({ block: 'nearest' });
    }
    renderInspector();
  }

  function moveSelection(delta) {
    if (!K.rows.length) return;
    const ids = K.rows.map((p) => p.id);
    let idx = ids.indexOf(S.sel);
    idx = idx === -1 ? (delta > 0 ? 0 : ids.length - 1) : Math.min(ids.length - 1, Math.max(0, idx + delta));
    select(ids[idx], true);
  }

  /* ── region: status_bar ───────────────────────────────────────────────── */
  function renderStatus() {
    const n = activeFilterCount();
    $('#status-count').textContent =
      `${fmt(K.rows.length)} of ${fmt(C.parts.length)} parts · ${n} filter${n === 1 ? '' : 's'} active`;
  }

  /* ── keyboard: / focus, ↑↓ move, Esc clear ────────────────────────────── */
  document.addEventListener('keydown', (e) => {
    const inInput = e.target === q;
    if (e.key === '/' && !inInput) { e.preventDefault(); q.focus(); q.select(); return; }
    if (inInput) {
      if (e.key === 'Escape') { q.value = ''; S.q = ''; qClear.hidden = true; render(); }
      return;
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); moveSelection(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); moveSelection(-1); }
    else if (e.key === 'Enter') {
      // ↵ inspect: hand focus to the detail region for the current selection
      if (S.sel == null) { moveSelection(1); return; }
      const el = document.getElementById('opt-' + S.sel);
      if (el) el.scrollIntoView({ block: 'nearest' });
      inspector.setAttribute('tabindex', '-1');
      inspector.focus({ preventScroll: true });
    }
    else if (e.key === 'Escape') { clearAll(); }
  });

  $('#empty-clear').addEventListener('click', clearAll);

  /* ── initial state (deep-linkable: ?q= &cat= &fam=) ───────────────────── */
  const params = new URLSearchParams(location.search);
  S.q = params.get('q') || '';
  q.value = S.q; qClear.hidden = !S.q;
  S.cat = params.get('cat') || null;
  S.fam = params.get('fam') || null;
  if (S.fam && !S.cat) for (const cid of Object.keys(C.families)) if (C.families[cid].some((f) => f.id === S.fam)) S.cat = cid;

  /* ── render + enter ready phase BEFORE first paint ────────────────────── */
  function render() {
    compute();
    renderCrumbs();
    renderRail();
    renderList();
    renderInspector();
    renderStatus();
    S.phase = K.rows.length ? 'ready' : 'empty';
    app.dataset.phase = S.phase;
  }

  $('#snapshot-label').textContent = `snapshot ${C.generated}`;
  $('#state-loading').hidden = true;
  render();
  q.focus({ preventScroll: true });
})();
