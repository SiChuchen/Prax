/* Locus — app logic.
 * Single-owner state { query, category, tags, formats, licenses, selection, expanded }.
 * Synchronous boot: data is inline, so first render happens in the same tick —
 * the measurable state at page load is `ready`, never `loading`.
 */
(function () {
  "use strict";

  var ITEMS = window.LOCUS_ITEMS;
  var META = window.LOCUS_META;
  var ROW_H = 32, OVERSCAN = 8;

  /* ---------- state ---------- */
  var state = {
    q: "",
    domains: new Set(),      // domain ids
    subcats: new Set(),      // "domainId::subcategory"
    tags: new Set(),
    formats: new Set(),
    licenses: new Set(),
    sel: null,               // selected item id (detail panel)
    cursor: 0,               // keyboard cursor = index into filtered
    expanded: new Set(),     // expanded tree domains
    showAllTags: false
  };

  var filtered = ITEMS.slice();
  var rendered = { start: -1, end: -1 };

  /* ---------- boot-time indexes ---------- */
  ITEMS.forEach(function (it) {
    it._ts = Date.parse(it.updated);
    it._h = (it.name + " " + it.id + " " + it.tags.join(" ") + " " + it.subcategory + " " +
             it.domain + " " + it.description).toLowerCase();
    it._nl = it.name.toLowerCase();
  });
  var byId = Object.create(null);
  ITEMS.forEach(function (it) { byId[it.id] = it; });

  /* ---------- tiny DOM helpers ---------- */
  function $(id) { return document.getElementById(id); }
  var els = {
    app: $("app"), search: $("search"), count: $("result-count"), clearAll: $("clear-all"),
    chips: $("chips"), tree: $("tree"), tags: $("tag-facets"), formats: $("format-facets"),
    licenses: $("license-facets"), results: $("results"), empty: $("empty"),
    emptyDetail: $("empty-detail"), emptyClear: $("empty-clear"), detail: $("detail"),
    dCrumb: $("d-crumb"), dName: $("d-name"), dId: $("d-id"), dDesc: $("d-desc"),
    dMeta: $("d-meta"), dTags: $("d-tags"), dClose: $("detail-close"), copyId: $("copy-id"),
    banner: $("error-banner"), bannerText: $("error-text"), bannerReset: $("error-reset")
  };

  function esc(s) {
    return s.replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function escRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
  function hi(text, tokens) {
    var safe = esc(text);
    if (!tokens.length) return safe;
    var re = new RegExp("(" + tokens.map(escRe).join("|") + ")", "gi");
    return safe.replace(re, "<mark>$1</mark>");
  }
  function fmtDate(iso) {
    var m = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    var p = iso.split("-");
    return m[+p[1] - 1] + " " + p[0];
  }
  function fmtSize(mb) {
    return mb >= 1024 ? (mb / 1024).toFixed(1) + " GB" : mb + " MB";
  }
  function fmtNum(n) { return n.toLocaleString("en-US"); }

  /* ---------- filtering ---------- */
  function queryTokens() {
    return state.q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  }
  function tokenRank(it, tok) {
    if (it._nl.indexOf(tok) === 0) return 0;                       // name prefix
    if (it._nl.indexOf(tok) !== -1) return 1;                      // name contains
    if (it.id.toLowerCase().indexOf(tok) !== -1) return 2;         // id
    for (var i = 0; i < it.tags.length; i++)
      if (it.tags[i].toLowerCase().indexOf(tok) !== -1) return 2;  // tags
    if ((it.subcategory + " " + it.domain).toLowerCase().indexOf(tok) !== -1) return 3;
    if (it._h.indexOf(tok) !== -1) return 4;                       // description
    return -1;                                                     // no match
  }
  function matchesQuery(it, toks) {
    for (var i = 0; i < toks.length; i++) if (tokenRank(it, toks[i]) === -1) return false;
    return true;
  }
  function catPass(it) {
    if (state.subcats.size) return state.subcats.has(it.domainId + "::" + it.subcategory);
    if (state.domains.size) return state.domains.has(it.domainId);
    return true;
  }
  function passes(it, skip) { // skip: facet dimension excluded from the predicate
    if (skip !== "cat" && !catPass(it)) return false;
    if (skip !== "tags") {
      if (state.tags.size) {
        var hit = false;
        for (var i = 0; i < it.tags.length; i++) if (state.tags.has(it.tags[i])) { hit = true; break; }
        if (!hit) return false;
      }
    }
    if (skip !== "formats" && state.formats.size && !it.formats.some(function (f) { return state.formats.has(f); })) return false;
    if (skip !== "licenses" && state.licenses.size && !state.licenses.has(it.license)) return false;
    return true;
  }
  function refilter() {
    var toks = queryTokens();
    filtered = [];
    for (var i = 0; i < ITEMS.length; i++) {
      var it = ITEMS[i];
      if (matchesQuery(it, toks) && passes(it, null)) filtered.push(it);
    }
    if (toks.length) {
      filtered.forEach(function (it) {
        var best = 0;
        for (var i = 0; i < toks.length; i++) best = Math.max(best, tokenRank(it, toks[i]));
        it._rank = best;
      });
      filtered.sort(function (a, b) { return a._rank - b._rank || b._ts - a._ts; });
    } else {
      filtered.sort(function (a, b) { return b._ts - a._ts; });
    }
    if (state.cursor >= filtered.length) state.cursor = Math.max(0, filtered.length - 1);
  }

  /* ---------- facet counts (query + other dimensions, excluding `dim`) ---------- */
  function counts(dim) {
    var toks = queryTokens();
    var c = {
      domains: {}, subcats: {}, tags: {}, formats: {}, licenses: {}, n: 0
    };
    for (var i = 0; i < ITEMS.length; i++) {
      var it = ITEMS[i];
      if (!matchesQuery(it, toks) || !passes(it, dim)) continue;
      c.n++;
      c.domains[it.domainId] = (c.domains[it.domainId] || 0) + 1;
      var sk = it.domainId + "::" + it.subcategory;
      c.subcats[sk] = (c.subcats[sk] || 0) + 1;
      c.licenses[it.license] = (c.licenses[it.license] || 0) + 1;
      for (var f = 0; f < it.formats.length; f++) c.formats[it.formats[f]] = (c.formats[it.formats[f]] || 0) + 1;
      for (var t = 0; t < it.tags.length; t++) c.tags[it.tags[t]] = (c.tags[it.tags[t]] || 0) + 1;
    }
    return c;
  }

  /* ---------- rendering: results (windowed for unbounded-feel scale) ---------- */
  function visibleRange() {
    var h = els.results.clientHeight || 600;
    var start = Math.max(0, Math.floor(els.results.scrollTop / ROW_H) - OVERSCAN);
    var end = Math.min(filtered.length, Math.ceil((els.results.scrollTop + h) / ROW_H) + OVERSCAN);
    return [start, end];
  }
  function rowHTML(it, i, toks) {
    var cls = "row" + (i === state.cursor ? " cursor" : "") + (state.sel === it.id ? " selected" : "");
    return '<div class="' + cls + '" id="row-' + i + '" role="option" tabindex="-1" aria-selected="' + (state.sel === it.id) +
      '" data-id="' + it.id + '" data-i="' + i + '" style="top:' + (i * ROW_H) + 'px">' +
      '<span class="row-name">' + hi(it.name, toks) + '</span>' +
      '<code class="row-id">' + hi(it.id, toks) + '</code>' +
      '<span class="row-sub">' + esc(it.subcategory) + '</span>' +
      '<span class="row-meta">' + it.formats.join(" · ") + " · " + fmtSize(it.sizeMB) + " · " + fmtDate(it.updated) + '</span>' +
      '</div>';
  }
  function renderWindow(force) {
    var r = visibleRange();
    if (!force && r[0] === rendered.start && r[1] === rendered.end) return;
    rendered = { start: r[0], end: r[1] };
    var toks = queryTokens();
    var html = "";
    for (var i = r[0]; i < r[1]; i++) html += rowHTML(filtered[i], i, toks);
    els.results.innerHTML = html;
    els.results.style.setProperty("--canvas-h", (filtered.length * ROW_H) + "px");
    els.results.setAttribute("aria-activedescendant", "row-" + state.cursor);
  }
  function renderResults(resetScroll) {
    if (resetScroll) { els.results.scrollTop = 0; state.cursor = 0; rendered = { start: -1, end: -1 }; }
    var has = filtered.length > 0;
    els.results.hidden = !has;
    els.empty.hidden = has;
    els.app.dataset.state = !els.banner.hidden ? "error" : state.sel ? "selected" : has ? "ready" : "empty";
    if (!has) {
      var toks = queryTokens();
      var bits = [];
      if (toks.length) bits.push("search “" + state.q.trim() + "”");
      var nF = state.domains.size + state.subcats.size + state.tags.size + state.formats.size + state.licenses.size;
      if (nF) bits.push(nF + (nF === 1 ? " filter" : " filters") + " active");
      els.emptyDetail.textContent = "Nothing matches " + (bits.join(" + ") || "the current view") +
        " — " + fmtNum(ITEMS.length) + " items are in the collection.";
      return;
    }
    renderWindow(true);
  }

  /* ---------- rendering: facets ---------- */
  function facetBtn(attrs, label, n, selected) {
    return '<button type="button" ' + attrs + ' class="facet-row' + (selected ? " on" : "") +
      '" aria-pressed="' + selected + '"><span class="facet-label">' + label +
      '</span><span class="facet-n">' + fmtNum(n) + '</span></button>';
  }
  function renderTree(c) {
    var html = '<h3 class="facet-title">Collection</h3>';
    META.domains.forEach(function (d) {
      var n = c.domains[d.id] || 0;
      var open = state.expanded.has(d.id);
      var sel = state.domains.has(d.id);
      html += '<div class="tree-domain' + (sel ? " on" : "") + '">' +
        '<button type="button" class="tree-twist" aria-expanded="' + open + '" aria-label="' +
        (open ? "Collapse" : "Expand") + " " + esc(d.name) + '" data-domain="' + d.id + '">' +
        '<svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M3 1l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></button>' +
        facetBtn('data-cat="' + d.id + '"', esc(d.name), n, sel) + '</div>';
      if (open) {
        html += '<div class="tree-subcats" role="group">';
        d.subcats.forEach(function (s) {
          var sk = d.id + "::" + s;
          html += facetBtn('data-sub="' + esc(sk) + '" style="margin-left:22px"', esc(s), c.subcats[sk] || 0, state.subcats.has(sk));
        });
        html += '</div>';
      }
    });
    els.tree.innerHTML = html;
  }
  function renderTagFacets(c) {
    var pairs = [];
    for (var k in c.tags) pairs.push([k, c.tags[k]]);
    pairs.sort(function (a, b) { return b[1] - a[1] || a[0].localeCompare(b[0]); });
    var limit = state.showAllTags ? pairs.length : 18;
    var html = "";
    pairs.slice(0, limit).forEach(function (p) {
      html += facetBtn('data-tag="' + esc(p[0]) + '"', esc(p[0]), p[1], state.tags.has(p[0]));
    });
    if (pairs.length > 18) {
      html += '<button type="button" class="show-more" data-show-tags="1">' +
        (state.showAllTags ? "Show fewer" : "Show all " + pairs.length + " tags") + '</button>';
    }
    els.tags.innerHTML = html || '<p class="facet-none">No tags in current scope</p>';
  }
  function renderCheckFacets(el, values, c, dim, getter) {
    var html = "";
    values.forEach(function (v) {
      html += facetBtn('data-' + dim + '="' + esc(v) + '"', esc(v), c[dim][v] || 0, state[dim].has(v));
    });
    el.innerHTML = html;
  }

  /* ---------- rendering: chips + count ---------- */
  function chip(kind, key, label) {
    return '<button type="button" class="chip" data-chip-kind="' + kind + '" data-chip-key="' + esc(key) +
      '" title="Remove filter"><span>' + label + '</span><span class="chip-x" aria-hidden="true">✕</span></button>';
  }
  function renderChips() {
    var html = "";
    if (state.q.trim()) html += chip("q", "", "search: “" + esc(state.q.trim()) + "”");
    state.domains.forEach(function (d) {
      var dom = META.domains.filter(function (x) { return x.id === d; })[0];
      html += chip("domain", d, esc(dom.name));
    });
    state.subcats.forEach(function (s) {
      html += chip("subcat", s, esc(s.split("::")[1]));
    });
    state.tags.forEach(function (t) { html += chip("tags", t, "#" + esc(t)); });
    state.formats.forEach(function (f) { html += chip("formats", f, esc(f)); });
    state.licenses.forEach(function (l) { html += chip("licenses", l, esc(l)); });
    els.chips.innerHTML = html;
    els.chips.hidden = !html;
    var active = html || state.q.trim();
    els.clearAll.hidden = !active;
  }
  function renderCount() {
    els.count.textContent = filtered.length === ITEMS.length
      ? fmtNum(filtered.length) + " items"
      : fmtNum(filtered.length) + " of " + fmtNum(ITEMS.length) + " items";
  }

  /* ---------- detail panel (context-preserving) ---------- */
  function renderDetail() {
    var it = state.sel ? byId[state.sel] : null;
    els.detail.hidden = !it;
    if (!it) return;
    els.dCrumb.textContent = it.domain + " ▸ " + it.subcategory;
    els.dName.textContent = it.name;
    els.dId.textContent = it.id;
    els.dDesc.textContent = it.description;
    els.dMeta.innerHTML =
      "<dt>License</dt><dd>" + esc(it.license) + "</dd>" +
      "<dt>Formats</dt><dd>" + esc(it.formats.join(", ")) + "</dd>" +
      "<dt>Records</dt><dd>" + fmtNum(it.records) + "</dd>" +
      "<dt>Size</dt><dd>" + fmtSize(it.sizeMB) + "</dd>" +
      "<dt>Updated</dt><dd>" + fmtDate(it.updated) + " (" + esc(it.version) + ")</dd>" +
      "<dt>Maintainer</dt><dd>" + esc(it.maintainer) + "</dd>";
    els.dTags.innerHTML = it.tags.map(function (t) { return '<span class="pill">#' + esc(t) + "</span>"; }).join("");
  }
  function select(id) { state.sel = id; renderResults(false); renderDetail(); syncHash(); }
  function closeDetail() {
    if (!state.sel) return;
    state.sel = null;
    renderResults(false); renderDetail(); syncHash();
    var cur = document.getElementById("row-" + state.cursor);
    if (cur) cur.focus();
  }

  /* ---------- full refresh ---------- */
  function refresh(resetScroll) {
    refilter();
    renderTree(counts("cat"));      // each facet counts under query + other dims (exclusion model)
    renderTagFacets(counts("tags"));
    renderCheckFacets(els.formats, META.formats, counts("formats"), "formats");
    renderCheckFacets(els.licenses, META.licenses, counts("licenses"), "licenses");
    renderResults(resetScroll);
    renderChips();
    renderCount();
    syncHash();
  }

  /* ---------- URL hash (restore/share a locate path) ---------- */
  var hashQuiet = false;
  function syncHash() {
    if (hashQuiet) return;
    var p = new URLSearchParams();
    if (state.q.trim()) p.set("q", state.q.trim());
    if (state.domains.size) p.set("d", Array.from(state.domains).join(","));
    if (state.subcats.size) p.set("s", Array.from(state.subcats).map(encodeURIComponent).join(","));
    if (state.tags.size) p.set("t", Array.from(state.tags).join(","));
    if (state.formats.size) p.set("f", Array.from(state.formats).join(","));
    if (state.licenses.size) p.set("l", Array.from(state.licenses).join(","));
    if (state.sel) p.set("sel", state.sel);
    var h = p.toString();
    if (location.hash !== "#" + (h || "_")) history.replaceState(null, "", "#" + (h || "_"));
  }
  function parseHash() {
    var raw = location.hash.replace(/^#/, "");
    if (!raw || raw === "_") return;
    var p = new URLSearchParams(raw);
    if (p.get("q")) state.q = p.get("q");
    if (p.get("d")) p.get("d").split(",").forEach(function (x) { state.domains.add(x); });
    if (p.get("s")) p.get("s").split(",").forEach(function (x) { try { state.subcats.add(decodeURIComponent(x)); } catch (e) {} });
    if (p.get("t")) p.get("t").split(",").forEach(function (x) { state.tags.add(x); });
    if (p.get("f")) p.get("f").split(",").forEach(function (x) { state.formats.add(x); });
    if (p.get("l")) p.get("l").split(",").forEach(function (x) { state.licenses.add(x); });
    if (p.get("sel")) {
      if (byId[p.get("sel")]) state.sel = p.get("sel");
      else showError('Linked item "' + p.get("sel") + '" is not in this collection snapshot. It may have been renamed or renumbered.');
    }
    META.domains.forEach(function (d) {
      var subs = Array.from(state.subcats).some(function (s) { return s.indexOf(d.id + "::") === 0; });
      if (subs || state.domains.has(d.id)) state.expanded.add(d.id);
    });
  }
  function showError(msg) {
    els.bannerText.textContent = msg;
    els.banner.hidden = false;
    els.app.dataset.state = "error";
  }

  /* ---------- events ---------- */
  els.search.addEventListener("input", function () {
    state.q = els.search.value;
    refresh(true);
  });
  els.search.addEventListener("keydown", function (e) {
    if (e.key === "ArrowDown") { moveCursor(1); e.preventDefault(); }
    else if (e.key === "ArrowUp") { moveCursor(-1); e.preventDefault(); }
    else if (e.key === "Enter") { if (filtered[state.cursor]) select(filtered[state.cursor].id); e.preventDefault(); }
    else if (e.key === "Escape") {
      if (state.q) { state.q = ""; els.search.value = ""; refresh(true); }
      else if (state.sel) closeDetail();
      e.preventDefault();
    }
  });
  els.results.addEventListener("keydown", function (e) {
    if (e.key === "ArrowDown") { moveCursor(1); e.preventDefault(); }
    else if (e.key === "ArrowUp") { moveCursor(-1); e.preventDefault(); }
    else if (e.key === "Enter" || e.key === " ") { if (filtered[state.cursor]) select(filtered[state.cursor].id); e.preventDefault(); }
    else if (e.key === "Escape" && state.sel) closeDetail();
  });
  els.results.addEventListener("scroll", function () { renderWindow(false); });
  els.results.addEventListener("click", function (e) {
    var row = e.target.closest(".row");
    if (row) select(row.dataset.id);
  });

  function oneOf(set, key, kind) { // toggle helper
    if (set.has(key)) set.delete(key); else set.add(key);
    refresh(true);
  }
  document.querySelector(".workspace").addEventListener("click", function (e) {
    var t = e.target;
    var twist = t.closest(".tree-twist");
    if (twist) {
      var d = twist.dataset.domain;
      if (state.expanded.has(d)) state.expanded.delete(d); else state.expanded.add(d);
      renderTree(counts(null));
      return;
    }
    var cat = t.closest("[data-cat]");
    if (cat) return oneOf(state.domains, cat.dataset.cat);
    var sub = t.closest("[data-sub]");
    if (sub) return oneOf(state.subcats, sub.dataset.sub);
    var tag = t.closest("[data-tag]");
    if (tag) return oneOf(state.tags, tag.dataset.tag);
    var fmt = t.closest("[data-formats]");
    if (fmt) return oneOf(state.formats, fmt.dataset.formats);
    var lic = t.closest("[data-licenses]");
    if (lic) return oneOf(state.licenses, lic.dataset.licenses);
    if (t.closest("[data-show-tags]")) {
      state.showAllTags = !state.showAllTags;
      renderTagFacets(counts("tags"));
    }
  });

  els.chips.addEventListener("click", function (e) {
    var c = e.target.closest(".chip");
    if (!c) return;
    var k = c.dataset.chipKind, v = c.dataset.chipKey;
    if (k === "q") { state.q = ""; els.search.value = ""; }
    else if (k === "domain") state.domains.delete(v);
    else if (k === "subcat") state.subcats.delete(v);
    else if (k === "tags") state.tags.delete(v);
    else if (k === "formats") state.formats.delete(v);
    else if (k === "licenses") state.licenses.delete(v);
    refresh(true);
  });

  function clearAll() {
    state.q = ""; els.search.value = "";
    state.domains.clear(); state.subcats.clear();
    state.tags.clear(); state.formats.clear(); state.licenses.clear();
    refresh(true);
    els.search.focus();
  }
  els.clearAll.addEventListener("click", clearAll);
  els.emptyClear.addEventListener("click", clearAll);
  els.dClose.addEventListener("click", closeDetail);
  els.bannerReset.addEventListener("click", function () {
    els.banner.hidden = true;
    if (els.app.dataset.state === "error") els.app.dataset.state = "ready";
    clearAll();
  });
  els.copyId.addEventListener("click", function () {
    var id = els.dId.textContent;
    function done(ok) {
      els.copyId.textContent = ok ? "Copied ✓" : "Copy failed";
      setTimeout(function () { els.copyId.textContent = "Copy ID"; }, 1200);
    }
    if (navigator.clipboard && navigator.clipboard.writeText)
      navigator.clipboard.writeText(id).then(function () { done(true); }, function () { done(false); });
    else done(false);
  });

  function moveCursor(delta) {
    if (!filtered.length) return;
    var next = Math.min(filtered.length - 1, Math.max(0, state.cursor + delta));
    if (next === state.cursor && rendered.start <= state.cursor && state.cursor < rendered.end) return;
    state.cursor = next;
    // keep the cursor row inside the viewport without jumping
    var top = state.cursor * ROW_H, view = els.results;
    if (top < view.scrollTop) view.scrollTop = top;
    else if (top + ROW_H > view.scrollTop + view.clientHeight) view.scrollTop = top + ROW_H - view.clientHeight;
    renderWindow(true);
    view.setAttribute("aria-activedescendant", "row-" + state.cursor);
  }

  document.addEventListener("keydown", function (e) {
    var inInput = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
    if (e.key === "/" && !inInput) { els.search.focus(); els.search.select(); e.preventDefault(); }
    else if (e.key === "Escape" && state.sel && !inInput) closeDetail();
  });

  window.addEventListener("hashchange", function () {
    hashQuiet = true;
    var keep = { q: state.q, sel: state.sel };
    state.q = ""; state.domains.clear(); state.subcats.clear(); state.tags.clear();
    state.formats.clear(); state.licenses.clear(); state.sel = null;
    parseHash();
    hashQuiet = false;
    els.search.value = state.q;
    refresh(false);
    renderDetail(); // sel may have been dropped by the new hash — don't leave a stale panel
  });

  /* ---------- synchronous boot ---------- */
  parseHash();
  els.search.value = state.q;
  refresh(false);
  els.app.classList.remove("is-booting"); // same tick — `loading` is never observable
  els.search.focus();
})();
