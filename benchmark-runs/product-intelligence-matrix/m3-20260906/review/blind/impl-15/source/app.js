/* LOCI — locate targets in a large open collection.
 * Vanilla JS, no build step, no network. State lives in the URL hash so any
 * located view survives refresh, back/forward, and sharing. */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var NOW = Date.now();
  var DAY = 86400000;

  /* ---------- data ---------- */
  var DATA = LOCI_GEN.generate();
  var ITEMS = DATA.items;
  var BY_ID = {};
  ITEMS.forEach(function (it) {
    it.hay = (it.name + ' ' + it.id + ' ' + it.tags.join(' ') + ' ' + it.category + ' ' + it.domain +
              ' ' + it.desc + ' ' + it.steward + ' ' + it.region + ' ' + it.format).toLowerCase();
    BY_ID[it.id] = it;
  });

  var DOMAINS = DATA.domains;
  var FORMATS = ['CSV', 'Parquet', 'GeoTIFF', 'NetCDF', 'JSON', 'HDF5', 'Shapefile', 'Zarr'];
  var LICENSES = ['CC0-1.0', 'CC-BY-4.0', 'ODbL-1.0', 'CC-BY-NC-4.0', 'Custom Terms'];
  var ACCESS = ['open', 'registration', 'gated'];

  var DEFAULTS = { q: '', domain: null, cat: null, fmt: null, lic: null, acc: null, sort: 'relevance', sel: null };
  var state = Object.assign({}, DEFAULTS, { shown: 80 });
  var expanded = {};          // domain -> bool (view-only)

  /* ---------- helpers ---------- */
  function fmtCount(n) { return n.toLocaleString('en-US'); }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function rel(ts) {
    var d = Math.floor((NOW - ts) / DAY);
    if (d <= 0) return 'today';
    if (d < 45) return d + ' d ago';
    if (d < 640) return Math.round(d / 30.4) + ' mo ago';
    return Math.round(d / 365) + ' y ago';
  }

  /* ---------- filtering & scoring ---------- */
  function tokens(q) { return q.toLowerCase().split(/\s+/).filter(Boolean); }

  function matchesBase(it, tk, skip) {
    if (state.domain && state.domain !== it.domain && skip !== 'tree') return false;
    if (state.cat && state.cat !== it.category && skip !== 'tree') return false;
    if (state.fmt && state.fmt !== it.format && skip !== 'fmt') return false;
    if (state.lic && state.lic !== it.license && skip !== 'lic') return false;
    if (state.acc && state.acc !== it.access && skip !== 'acc') return false;
    for (var i = 0; i < tk.length; i++) if (it.hay.indexOf(tk[i]) === -1) return false;
    return true;
  }

  function score(it, tk) {
    var s = 0, name = it.name.toLowerCase(), i, t;
    for (i = 0; i < tk.length; i++) {
      t = tk[i];
      if (it.id.toLowerCase().indexOf(t) === 0) s += 40;
      else if (name.indexOf(t) !== -1) s += 30;
      else if (it.tags.some(function (x) { return x.indexOf(t) === 0; })) s += 16;
      else if ((it.category + ' ' + it.domain).toLowerCase().indexOf(t) !== -1) s += 10;
      else s += 4;
    }
    s += Math.max(0, 6 - (NOW - it.updatedTs) / (90 * DAY)); // mild freshness nudge
    return s;
  }

  function computeResults() {
    var tk = tokens(state.q);
    var out = [];
    for (var i = 0; i < ITEMS.length; i++) {
      var it = ITEMS[i];
      if (matchesBase(it, tk, null)) out.push(it);
    }
    var sort = state.sort || (tk.length ? 'relevance' : 'updated');
    if (sort === 'relevance' && tk.length) {
      out.sort(function (a, b) { return score(b, tk) - score(a, tk) || b.updatedTs - a.updatedTs; });
    } else if (sort === 'updated') {
      out.sort(function (a, b) { return b.updatedTs - a.updatedTs; });
    } else if (sort === 'name') {
      out.sort(function (a, b) { return a.name.localeCompare(b.name); });
    } else if (sort === 'size') {
      out.sort(function (a, b) { return b.sizeMB - a.sizeMB; });
    }
    return out;
  }

  /* counts per facet value, computed under query + tree + other facet groups */
  function facetCounts(group, tk) {
    var counts = {};
    var pool = group === 'fmt' ? FORMATS : group === 'lic' ? LICENSES : ACCESS;
    pool.forEach(function (v) { counts[v] = 0; });
    for (var i = 0; i < ITEMS.length; i++) {
      var it = ITEMS[i];
      if (!matchesBase(it, tk, group)) continue;
      var v = group === 'fmt' ? it.format : group === 'lic' ? it.license : it.access;
      counts[v]++;
    }
    return counts;
  }

  function treeCounts(tk) {
    var domains = {}, cats = {};
    DOMAINS.forEach(function (d) { domains[d.name] = 0; d.cats.forEach(function (c) { cats[c] = 0; }); });
    for (var i = 0; i < ITEMS.length; i++) {
      var it = ITEMS[i];
      if (!matchesBase(it, tk, 'tree')) continue;
      domains[it.domain]++; cats[it.category]++;
    }
    return { domains: domains, cats: cats };
  }

  /* ---------- hash <-> state ---------- */
  function serialize(st) {
    var p = new URLSearchParams();
    if (st.q) p.set('q', st.q);
    if (st.domain) p.set('domain', st.domain);
    if (st.cat) p.set('cat', st.cat);
    if (st.fmt) p.set('fmt', st.fmt);
    if (st.lic) p.set('lic', st.lic);
    if (st.acc) p.set('acc', st.acc);
    if (st.sort && st.sort !== 'relevance') p.set('sort', st.sort);
    if (st.sel) p.set('sel', st.sel);
    var s = p.toString();
    return s ? '#' + s : '#';
  }
  function parseHash() {
    var p = new URLSearchParams(location.hash.replace(/^#\/?/, ''));
    function one(v, valid) { return v && valid.indexOf(v) !== -1 ? v : null; }
    state.q = p.get('q') || '';
    state.domain = one(p.get('domain'), DOMAINS.map(function (d) { return d.name; }));
    state.cat = one(p.get('cat'), DOMAINS.reduce(function (a, d) { return a.concat(d.cats); }, []));
    state.fmt = one(p.get('fmt'), FORMATS);
    state.lic = one(p.get('lic'), LICENSES);
    state.acc = one(p.get('acc'), ACCESS);
    state.sort = one(p.get('sort'), ['relevance', 'updated', 'name', 'size']) || 'relevance';
    state.sel = p.get('sel') && BY_ID[p.get('sel')] ? p.get('sel') : null;
    state.shown = 80;
  }
  function nav(patch, replace) {
    Object.assign(state, patch);
    var h = serialize(state);
    if (replace) history.replaceState(null, '', h); else history.pushState(null, '', h);
    renderAll();
  }
  function onHistory() {
    if (serialize(state) === location.hash) return;
    parseHash();
    expanded = {};
    renderAll();
    if (state.sel) revealSelected(false);
  }

  /* ---------- rendering ---------- */
  function renderAll() {
    var results = computeResults();
    renderTree();
    renderFacets();
    renderContext(results);
    renderResults(results);
    renderDetail(results);
    $('total-count').textContent = fmtCount(ITEMS.length) + ' datasets';
  }

  function renderTree() {
    var tk = tokens(state.q);
    var tc = treeCounts(tk);
    var html = '<p class="side-title">Collections</p>';
    if (state.domain) expanded[state.domain] = true;
    DOMAINS.forEach(function (d) {
      var isSel = state.domain === d.name;
      var open = !!expanded[d.name];
      html += '<div class="tree-domain' + (isSel ? ' sel' : '') + '">' +
        '<button class="tree-row" role="treeitem" aria-expanded="' + open + '"' +
        ' data-domain="' + esc(d.name) + '">' +
        '<svg class="chev' + (open ? ' open' : '') + '" viewBox="0 0 16 16" aria-hidden="true"><path d="M6 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
        '<span class="tree-name">' + esc(d.name) + '</span>' +
        '<span class="tree-count">' + fmtCount(tc.domains[d.name]) + '</span></button>';
      if (open) {
        html += '<div class="tree-cats" role="group">';
        d.cats.forEach(function (c) {
          var cSel = state.cat === c;
          html += '<button class="tree-row cat' + (cSel ? ' sel' : '') + '" role="treeitem" aria-selected="' + cSel + '"' +
            ' data-cat="' + esc(c) + '"' + (cSel ? ' aria-current="true"' : '') + '>' +
            '<span class="tree-name">' + esc(c) + '</span>' +
            '<span class="tree-count">' + fmtCount(tc.cats[c]) + '</span></button>';
        });
        html += '</div>';
      }
      html += '</div>';
    });
    $('tree').innerHTML = html;
  }

  function renderFacets() {
    var tk = tokens(state.q);
    var sections = [
      { key: 'fmt', title: 'Format', values: FORMATS, get: function (it) { return it.format; } },
      { key: 'lic', title: 'License', values: LICENSES, get: function (it) { return it.license; } },
      { key: 'acc', title: 'Access', values: ACCESS, get: function (it) { return it.access; } },
    ];
    var html = '';
    sections.forEach(function (s) {
      var counts = facetCounts(s.key, tk);
      html += '<p class="side-title">' + s.title + '</p><div class="facet-group" role="group" aria-label="' + s.title + ' filter">';
      s.values.forEach(function (v) {
        var sel = state[s.key] === v;
        html += '<button class="facet-row' + (sel ? ' sel' : '') + '" aria-pressed="' + sel + '"' +
          ' data-facet="' + s.key + '" data-value="' + esc(v) + '">' +
          (s.key === 'acc' ? '<span class="dot dot-' + v + '"></span>' : '') +
          '<span class="facet-name">' + esc(v) + '</span>' +
          '<span class="tree-count">' + fmtCount(counts[v]) + '</span></button>';
      });
      html += '</div>';
    });
    $('facets').innerHTML = html;
  }

  function renderContext(results) {
    var bc = '<button class="crumb' + (!state.domain && !state.cat ? ' here' : '') + '" data-crumb="root">All collections</button>';
    if (state.domain) {
      bc += '<span class="crumb-sep">/</span><button class="crumb' + (!state.cat ? ' here' : '') + '" data-crumb="domain">' + esc(state.domain) + '</button>';
      if (state.cat) bc += '<span class="crumb-sep">/</span><button class="crumb here" data-crumb="cat">' + esc(state.cat) + '</button>';
    }
    $('breadcrumb').innerHTML = bc;

    var chips = [];
    function chip(kind, value, label) {
      chips.push('<button class="chip" data-chip="' + kind + '" data-value="' + esc(value) + '" aria-label="Remove filter ' + esc(label) + '">' +
        esc(label) + '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></button>');
    }
    if (state.q) chip('q', state.q, '“' + state.q + '”');
    if (state.cat) chip('cat', state.cat, state.cat);
    else if (state.domain) chip('domain', state.domain, state.domain);
    if (state.fmt) chip('fmt', state.fmt, state.fmt);
    if (state.lic) chip('lic', state.lic, state.lic);
    if (state.acc) chip('acc', state.acc, state.acc);
    var chipsEl = $('chips');
    if (chips.length) {
      chips.push('<button class="chip chip-reset" data-chip="all">Reset all</button>');
      chipsEl.innerHTML = chips.join('');
      chipsEl.classList.remove('hidden');
    } else {
      chipsEl.innerHTML = '';
      chipsEl.classList.add('hidden');
    }
    $('sort').value = state.sort;
  }

  function rowHTML(it, pos) {
    return '<li class="row" role="option" tabindex="-1" data-id="' + it.id + '" aria-selected="' + (state.sel === it.id) + '" data-pos="' + pos + '">' +
      '<div class="row-main">' +
      '<span class="row-name">' + esc(it.name) + '</span>' +
      '<span class="row-sub">' + esc(it.id) + ' · ' + esc(it.domain) + ' › ' + esc(it.category) + '</span>' +
      '</div>' +
      '<div class="row-tags">' + it.tags.slice(0, 3).map(function (t) { return '<span class="tag">' + esc(t) + '</span>'; }).join('') + '</div>' +
      '<div class="row-meta">' +
      '<span class="badge">' + esc(it.format) + '</span>' +
      '<span class="access access-' + it.access + '">' + esc(it.access) + '</span>' +
      '<span class="row-size">' + (it.sizeMB >= 1024 ? (it.sizeMB / 1024).toFixed(1) + ' GB' : it.sizeMB + ' MB') + '</span>' +
      '<span class="row-upd" title="Updated ' + it.updated + '">' + rel(it.updatedTs) + '</span>' +
      '</div></li>';
  }

  function renderResults(results) {
    var ul = $('results');
    var n = Math.min(state.shown, results.length);
    var html = '';
    for (var i = 0; i < n; i++) html += rowHTML(results[i], i);
    ul.innerHTML = html;
    ul.classList.toggle('hidden', results.length === 0);

    var more = results.length - n;
    var lm = $('load-more');
    if (more > 0) {
      lm.textContent = 'Show more — ' + fmtCount(more) + ' remaining';
      lm.classList.remove('hidden');
    } else lm.classList.add('hidden');
    $('end-note').classList.toggle('hidden', !(results.length > 0 && more === 0 && results.length > 80));

    var emptyEl = $('empty');
    if (results.length === 0) {
      emptyEl.innerHTML = '<p class="empty-title">No datasets match this view</p>' +
        '<p class="empty-sub">Loosen a filter or shorten the query — every token must appear in name, tags, category, or description.</p>' +
        '<button class="btn" id="empty-reset">Clear search &amp; filters</button>';
      emptyEl.classList.remove('hidden');
    } else emptyEl.classList.add('hidden');

    var pos = state.sel ? results.findIndex(function (r) { return r.id === state.sel; }) : -1;
    var where = pos >= 0 ? ' · match ' + (pos + 1) + ' selected' : '';
    $('result-summary').textContent =
      fmtCount(results.length) + (results.length === ITEMS.length ? ' datasets' : ' of ' + fmtCount(ITEMS.length) + ' datasets match') +
      (results.length > n ? ' · showing first ' + n : '') + where;
  }

  function renderDetail(results) {
    var el = $('detail');
    var it = state.sel ? BY_ID[state.sel] : null;
    if (!it) {
      el.innerHTML = '<div class="detail-placeholder">' +
        '<svg viewBox="0 0 16 16" aria-hidden="true" class="ph-icon"><circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" stroke-width="1.4"/><line x1="11" y1="11" x2="14.5" y2="14.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>' +
        '<p>Select a dataset to inspect it here.<br>The result list and filters stay put.</p></div>';
      el.setAttribute('aria-hidden', 'true');
      el.classList.remove('open');
      return;
    }
    var pos = results.findIndex(function (r) { return r.id === it.id; });
    var ctxLine = pos >= 0
      ? 'Match ' + (pos + 1) + ' of ' + fmtCount(results.length) + ' in current view · list position preserved'
      : 'Outside current filters — showing full-record context';

    el.innerHTML =
      '<div class="detail-head">' +
      '<span class="detail-id">' + esc(it.id) + ' · ' + esc(it.version) + '</span>' +
      '<button class="icon-btn" id="detail-close" aria-label="Close detail (Esc)" title="Close (Esc)">' +
      '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></button>' +
      '</div>' +
      '<h2 class="detail-name">' + esc(it.name) + '</h2>' +
      '<p class="detail-path">' + esc(it.domain) + ' › ' + esc(it.category) + '</p>' +
      '<div class="detail-badges">' +
      '<span class="badge">' + esc(it.format) + '</span>' +
      '<span class="badge">' + esc(it.license) + '</span>' +
      '<span class="access access-' + it.access + '">' + esc(it.access) + '</span>' +
      '</div>' +
      '<p class="detail-desc">' + esc(it.desc) + '</p>' +
      '<p class="detail-ctx">' + esc(ctxLine) + '</p>' +
      '<dl class="detail-meta">' +
      '<dt>Records</dt><dd>' + fmtCount(it.records) + '</dd>' +
      '<dt>Size</dt><dd>' + (it.sizeMB >= 1024 ? (it.sizeMB / 1024).toFixed(1) + ' GB' : it.sizeMB + ' MB') + '</dd>' +
      '<dt>Updated</dt><dd>' + it.updated + ' (' + rel(it.updatedTs) + ')</dd>' +
      '<dt>Steward</dt><dd>' + esc(it.steward) + '</dd>' +
      '<dt>Region</dt><dd>' + esc(it.region) + '</dd>' +
      '</dl>' +
      '<div class="detail-tags">' + it.tags.map(function (t) { return '<span class="tag">' + esc(t) + '</span>'; }).join('') + '</div>' +
      '<div class="detail-actions">' +
      (pos >= 0 ? '<button class="btn btn-primary" id="show-in-list">Show in list</button>' : '') +
      '<button class="btn" id="copy-id">Copy ID</button>' +
      '</div>';
    el.setAttribute('aria-hidden', 'false');
    el.classList.add('open');
  }

  /* ---------- selection helpers ---------- */
  function rowEl(id) { return document.querySelector('.row[data-id="' + id + '"]'); }

  function revealSelected(flash) {
    var results = computeResults();
    var pos = results.findIndex(function (r) { return r.id === state.sel; });
    if (pos < 0) return;
    if (pos >= state.shown) { state.shown = Math.ceil((pos + 40) / 80) * 80; renderResults(results); }
    var el = rowEl(state.sel);
    if (el) {
      el.scrollIntoView({ block: 'nearest' });
      if (flash) {
        el.classList.remove('flash');
        void el.offsetWidth;
        el.classList.add('flash');
      }
    }
  }

  /* ---------- events ---------- */
  var searchTimer = null;
  $('search').addEventListener('input', function () {
    var v = this.value;
    $('search-clear').classList.toggle('hidden', !v);
    clearTimeout(searchTimer);
    searchTimer = setTimeout(function () { nav({ q: v, sel: state.sel }, true); }, 120);
  });
  $('search-clear').addEventListener('click', function () {
    $('search').value = '';
    $('search-clear').classList.add('hidden');
    nav({ q: '' }, false);
    $('search').focus();
  });
  $('sort').addEventListener('change', function () { nav({ sort: this.value }, false); });

  document.addEventListener('click', function (e) {
    var t = e.target.closest('button, .row');
    if (!t) return;

    if (t.id === 'empty-reset') {
      $('search').value = ''; $('search-clear').classList.add('hidden');
      nav({ q: '', domain: null, cat: null, fmt: null, lic: null, acc: null }, false);
      return;
    }
    if (t.id === 'detail-close') { nav({ sel: null }, false); return; }
    if (t.id === 'copy-id') {
      var idTxt = state.sel;
      (navigator.clipboard ? navigator.clipboard.writeText(idTxt) : Promise.reject())
        .catch(function () {}).finally(function () {
          t.textContent = 'Copied ✓';
          setTimeout(function () { t.textContent = 'Copy ID'; }, 1200);
        });
      return;
    }
    if (t.id === 'show-in-list') { revealSelected(true); return; }
    if (t.id === 'load-more') { state.shown += 120; renderResults(computeResults()); return; }

    if (t.dataset.crumb) {
      if (t.dataset.crumb === 'root') nav({ domain: null, cat: null }, false);
      else if (t.dataset.crumb === 'domain') nav({ cat: null }, false);
      return;
    }
    if (t.dataset.chip) {
      var k = t.dataset.chip;
      if (k === 'all') { $('search').value = ''; $('search-clear').classList.add('hidden'); nav({ q: '', domain: null, cat: null, fmt: null, lic: null, acc: null }, false); }
      else if (k === 'q') { $('search').value = ''; $('search-clear').classList.add('hidden'); nav({ q: '' }, false); }
      else if (k === 'cat') nav({ cat: null }, false);
      else if (k === 'domain') nav({ domain: null, cat: null }, false);
      else { var patch = {}; patch[k] = null; nav(patch, false); }
      return;
    }
    if (t.dataset.domain && t.classList.contains('tree-row')) {
      var dn = t.dataset.domain;
      if (expanded[dn] && !state.domain) { expanded[dn] = false; renderTree(); return; }
      expanded[dn] = true;
      nav(state.domain === dn ? { domain: null, cat: null } : { domain: dn, cat: null }, false);
      return;
    }
    if (t.dataset.cat) {
      nav(state.cat === t.dataset.cat ? { cat: null } : { cat: t.dataset.cat }, false);
      return;
    }
    if (t.dataset.facet) {
      var fk = t.dataset.facet, patch2 = {};
      patch2[fk] = state[fk] === t.dataset.value ? null : t.dataset.value;
      nav(patch2, false);
      return;
    }
    if (t.classList.contains('row')) {
      var id = t.dataset.id;
      nav({ sel: state.sel === id ? null : id }, false);
    }
  });

  // keyboard: / focuses search; arrows move through visible rows; Enter selects; Esc steps back
  document.addEventListener('keydown', function (e) {
    var inSearch = document.activeElement === $('search');
    if (e.key === '/' && !inSearch) { e.preventDefault(); $('search').focus(); $('search').select(); return; }
    if (e.key === 'Escape') {
      if (inSearch && $('search').value) { $('search').value = ''; $('search-clear').classList.add('hidden'); nav({ q: '' }, true); }
      else if (!inSearch && state.sel) { nav({ sel: null }, false); }
      else if (inSearch) $('search').blur();
      return;
    }
    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && !inSearch) {
      var rows = Array.prototype.slice.call(document.querySelectorAll('.row'));
      if (!rows.length) return;
      e.preventDefault();
      var cur = document.activeElement && document.activeElement.classList.contains('row')
        ? rows.indexOf(document.activeElement) : (e.key === 'ArrowDown' ? -1 : rows.length);
      var next = Math.max(0, Math.min(rows.length - 1, cur + (e.key === 'ArrowDown' ? 1 : -1)));
      rows[next].focus();
      rows[next].scrollIntoView({ block: 'nearest' });
    }
    if (e.key === 'Enter' && document.activeElement && document.activeElement.classList.contains('row')) {
      document.activeElement.click();
    }
  });

  // infinite-ish windowing: grow when the "Show more" button comes near
  new IntersectionObserver(function (entries) {
    if (entries[0].isIntersecting && !$('load-more').classList.contains('hidden')) {
      state.shown += 120;
      renderResults(computeResults());
    }
  }, { rootMargin: '600px' }).observe($('load-more'));

  window.addEventListener('hashchange', onHistory);
  window.addEventListener('popstate', onHistory);

  /* ---------- boot: first paint is fully populated, no loading state ---------- */
  if (location.hash && location.hash !== '#') parseHash();
  $('search').value = state.q;
  $('search-clear').classList.toggle('hidden', !state.q);
  renderAll();
  $('search').focus({ preventScroll: true });
})();
