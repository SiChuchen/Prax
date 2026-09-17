/* DataAtlas — locate layer for an open-collection registry.
 * Vanilla JS, no dependencies, no build step.
 *
 * Locate path: instant search + live facet counts + a location breadcrumb
 * that never disappears, so narrowing the collection never loses context.
 */
(function () {
  "use strict";

  /* ---------------- catalog ---------------- */

  const ITEMS = window.DATASETS;          // built synchronously by data.js
  const TOTAL = ITEMS.length;
  const byId = new Map(ITEMS.map((d) => [d.id, d]));

  const DOMAINS = [];
  {
    const m = new Map();
    for (const it of ITEMS) {
      if (!m.has(it.domain)) m.set(it.domain, []);
      const arr = m.get(it.domain);
      if (!arr.includes(it.subcat)) arr.push(it.subcat);
    }
    for (const [name, subcats] of m) DOMAINS.push({ name: name, subcats: subcats });
  }
  const SUBCAT_TOTAL = DOMAINS.reduce((a, d) => a + d.subcats.length, 0);
  const FORMATS = [...new Set(ITEMS.map((d) => d.format))].sort();
  const LICENSES = [...new Set(ITEMS.map((d) => d.license))].sort();

  // lowercase search fields, precomputed once
  const F = new Map();
  for (const it of ITEMS) {
    F.set(it.id, {
      name: it.name.toLowerCase(),
      org: it.org.toLowerCase(),
      tags: it.tags.join(" ").toLowerCase(),
      sub: it.subcat.toLowerCase(),
      dom: it.domain.toLowerCase(),
      desc: it.desc.toLowerCase()
    });
  }

  /* ---------------- state ---------------- */

  const state = {
    q: "",
    domain: null,       // selected domain (top tier)
    subcat: null,       // selected collection (second tier)
    formats: new Set(),
    licenses: new Set(),
    sort: "relevance",
    openId: null        // dataset shown in the detail drawer
  };

  /* ---------------- pure query logic (unit-testable) ---------------- */

  const tokenize = (q) => String(q).toLowerCase().split(/[\s,]+/).filter(Boolean).slice(0, 8);

  // Facet predicate with per-call overrides so facet counts can ask
  // "what would the count be under this single facet value".
  function facetMatch(it, st, ov) {
    ov = ov || {};
    const domain = "domain" in ov ? ov.domain : st.domain;
    const subcat = "subcat" in ov ? ov.subcat : st.subcat;
    const formats = ov.formats !== undefined ? ov.formats : st.formats;
    const licenses = ov.licenses !== undefined ? ov.licenses : st.licenses;
    if (domain && it.domain !== domain) return false;
    if (subcat && it.subcat !== subcat) return false;
    if (formats && formats.size && !formats.has(it.format)) return false;
    if (licenses && licenses.size && !licenses.has(it.license)) return false;
    return true;
  }

  // AND semantics across tokens; each token must hit at least one field.
  const W = { prefix: 60, name: 40, tag: 30, org: 24, sub: 20, dom: 12, desc: 8 };
  function scoreItem(it, tokens) {
    if (!tokens.length) return 0;
    const f = F.get(it.id);
    let total = 0;
    for (const t of tokens) {
      let s = 0;
      if (f.name.startsWith(t)) s = W.prefix;
      else if (f.name.includes(t)) s = W.name;
      if (!s && f.tags.includes(t)) s = W.tag;
      if (!s && f.org.includes(t)) s = W.org;
      if (!s && f.sub.includes(t)) s = W.sub;
      if (!s && f.dom.includes(t)) s = W.dom;
      if (!s && f.desc.includes(t)) s = W.desc;
      if (!s) return 0;
      total += s;
    }
    return total;
  }

  function currentList(st) {
    st = st || state;
    const tokens = tokenize(st.q);
    const scored = [];
    for (const it of ITEMS) {
      if (!facetMatch(it, st)) continue;
      const s = scoreItem(it, tokens);
      if (tokens.length && !s) continue;
      scored.push({ it: it, s: s });
    }
    const cmp = {
      relevance: (a, b) => b.s - a.s || b.it.downloads - a.it.downloads,
      downloads: (a, b) => b.it.downloads - a.it.downloads,
      updated: (a, b) => b.it.updated.localeCompare(a.it.updated),
      name: (a, b) => a.it.name.localeCompare(b.it.name)
    }[st.sort] || ((a, b) => b.s - a.s);
    scored.sort(cmp);
    return scored.map((x) => x.it);
  }

  // Live counts: each facet value counted under "query + all other facets".
  function facetCounts(st) {
    st = st || state;
    const count = (ov) => ITEMS.reduce((a, it) => a + (facetMatch(it, st, ov) ? 1 : 0), 0);
    return {
      domains: DOMAINS.map((d) => ({
        name: d.name,
        count: count({ domain: d.name, subcat: null }),
        subcats: d.subcats.map((s) => ({ name: s, count: count({ domain: d.name, subcat: s }) }))
      })),
      formats: FORMATS.map((f) => ({ name: f, count: count({ formats: new Set([f]) }) })),
      licenses: LICENSES.map((l) => ({ name: l, count: count({ licenses: new Set([l]) }) }))
    };
  }

  /* ---------------- deep-link hash ---------------- */

  function serializeHash(st) {
    st = st || state;
    const p = new URLSearchParams();
    if (st.q) p.set("q", st.q);
    if (st.subcat) { p.set("domain", st.domain); p.set("subcat", st.subcat); }
    else if (st.domain) p.set("domain", st.domain);
    if (st.openId) p.set("item", st.openId);
    const s = p.toString();
    return s ? "#" + s : "";
  }

  function parseHash(hash) {
    const out = { q: "", domain: null, subcat: null, item: null };
    if (!hash || hash.length < 2) return out;
    const p = new URLSearchParams(hash.slice(1));
    out.q = (p.get("q") || "").slice(0, 80);
    const dom = p.get("domain");
    const node = dom && DOMAINS.find((d) => d.name === dom);
    if (node) {
      out.domain = node.name;
      const sub = p.get("subcat");
      if (sub && node.subcats.includes(sub)) out.subcat = sub;
    }
    const item = p.get("item");
    if (item && byId.has(item)) out.item = item;
    return out;
  }

  function syncHash() {
    try { history.replaceState(null, "", location.pathname + location.search + serializeHash(state)); }
    catch (e) { /* non-fatal on some file:// builds */ }
  }

  /* ---------------- dom ---------------- */

  const els = {};
  const MOTION = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  function hl(raw, tokens) {
    if (!tokens.length) return esc(raw);
    const re = new RegExp("(" + tokens.map(reEsc).join("|") + ")", "ig");
    return String(raw).split(re).map((p, i) => (i % 2 ? "<mark>" + esc(p) + "</mark>" : esc(p))).join("");
  }

  const fmtFull = (n) => n.toLocaleString("en-US");
  const fmtNum = (n) => (n >= 1e6 ? (n / 1e6).toFixed(1) + "M"
    : n >= 1e4 ? Math.round(n / 1e3) + "k"
    : n >= 1e3 ? (Math.round(n / 100) / 10) + "k"
    : String(n));
  const fmtSize = (mb) => (mb >= 1024 ? (mb / 1024).toFixed(1) + " GB" : mb + " MB");

  /* ---------------- renderers ---------------- */

  function rowHTML(it, tokens) {
    return '<article class="row" role="listitem" tabindex="0" data-id="' + it.id + '" aria-label="' + esc(it.name) + '">'
      + '<div class="row-top"><span class="fmt">' + it.format + '</span>'
      + '<h3 class="row-name">' + hl(it.name, tokens) + '</h3>'
      + '<span class="ver">v' + esc(it.version) + '</span></div>'
      + '<div class="row-meta"><span class="row-path">' + esc(it.domain) + ' › ' + esc(it.subcat) + '</span>'
      + '<span class="dot">·</span><span>' + esc(it.org) + '</span>'
      + '<span class="dot">·</span><span>updated ' + it.updated + '</span>'
      + '<span class="dot">·</span><span>' + fmtSize(it.sizeMB) + '</span>'
      + '<span class="dot">·</span><span>' + fmtNum(it.downloads) + ' downloads</span></div>'
      + '<p class="row-desc">' + hl(it.desc, tokens) + '</p>'
      + '<div class="row-tags">' + it.tags.map((t) => '<span class="tag">' + hl(t, tokens) + '</span>').join("") + '</div>'
      + '</article>';
  }

  function renderGrid() {
    const tokens = tokenize(state.q);
    const list = currentList(state);
    els.grid.innerHTML = list.map((it) => rowHTML(it, tokens)).join("");
    els.grid.hidden = list.length === 0;
    els.empty.hidden = list.length > 0;
    return list;
  }

  function renderCount(list) {
    els.count.textContent = list.length === TOTAL
      ? fmtFull(TOTAL) + " datasets"
      : fmtFull(list.length) + " of " + fmtFull(TOTAL) + " datasets";
  }

  function renderCrumb() {
    let h = '<button class="crumb-link' + (!state.domain ? " here" : "") + '" data-crumb="all">All collections</button>';
    if (state.domain) {
      h += '<span class="crumb-sep">›</span>'
        + '<button class="crumb-link' + (!state.subcat ? " here" : "") + '" data-crumb="domain">' + esc(state.domain) + '</button>';
    }
    if (state.subcat) {
      h += '<span class="crumb-sep">›</span>'
        + '<span class="crumb-link here" aria-current="location">' + esc(state.subcat) + '</span>';
    }
    els.crumb.innerHTML = h;
  }

  function renderChips() {
    const chips = [];
    if (state.q) chips.push({ k: "q", label: "“" + esc(state.q) + "”", title: "Clear search" });
    if (state.subcat) chips.push({ k: "subcat", label: esc(state.subcat), title: "Clear collection filter" });
    else if (state.domain) chips.push({ k: "domain", label: esc(state.domain), title: "Clear domain filter" });
    for (const f of state.formats) chips.push({ k: "format:" + f, label: esc(f), title: "Remove format filter" });
    for (const l of state.licenses) chips.push({ k: "license:" + l, label: esc(l), title: "Remove license filter" });
    let h = chips.map((c) =>
      '<span class="chip"><span>' + c.label + '</span>'
      + '<button class="chip-x" data-remove="' + esc(c.k) + '" title="' + (c.title || "") + '" aria-label="' + (c.title || "Remove filter") + '">✕</button></span>'
    ).join("");
    if (chips.length) h += '<button class="chip-reset" data-remove="all">Reset all</button>';
    els.chips.innerHTML = h;
    els.chips.hidden = !chips.length;
  }

  function checkboxSection(title, key, opts, selected) {
    let h = '<section class="facet"><h2 class="facet-title">' + title + '</h2>';
    for (const o of opts) {
      const on = selected.has(o.name);
      h += '<label class="check' + (on ? " on" : "") + '">'
        + '<input type="checkbox" data-facet="' + key + '" value="' + esc(o.name) + '"' + (on ? " checked" : "") + '>'
        + '<span class="box" aria-hidden="true"></span>'
        + '<span class="check-name">' + esc(o.name) + '</span>'
        + '<span class="n">' + fmtFull(o.count) + '</span></label>';
    }
    return h + '</section>';
  }

  function renderSidebar() {
    const c = facetCounts(state);
    let h = '<section class="facet"><h2 class="facet-title">Collections</h2><div class="tree">';
    for (const d of c.domains) {
      const open = state.domain === d.name;
      h += '<div class="tree-node' + (open ? " open" : "") + '">'
        + '<button class="tree-row' + (open && !state.subcat ? " sel" : "") + '" data-domain="' + esc(d.name) + '" aria-expanded="' + open + '">'
        + '<span class="chev" aria-hidden="true">▸</span>'
        + '<span class="tree-name">' + esc(d.name) + '</span>'
        + '<span class="n">' + fmtFull(d.count) + '</span></button>';
      if (open) {
        for (const s of d.subcats) {
          h += '<button class="tree-row subrow' + (state.subcat === s.name ? " sel" : "") + '"'
            + ' data-domain="' + esc(d.name) + '" data-subcat="' + esc(s.name) + '">'
            + '<span class="tree-name">' + esc(s.name) + '</span>'
            + '<span class="n">' + fmtFull(s.count) + '</span></button>';
        }
      }
      h += '</div>';
    }
    h += '</div></section>';
    h += checkboxSection("Format", "format", c.formats, state.formats);
    h += checkboxSection("License", "license", c.licenses, state.licenses);
    els.sidebar.innerHTML = h;
  }

  function renderAll() {
    renderSidebar();
    renderCrumb();
    renderChips();
    const list = renderGrid();
    renderCount(list);
    syncHash();
  }

  /* ---------------- detail drawer ---------------- */

  const metaRow = (k, v) => '<div class="meta-row"><dt>' + k + '</dt><dd>' + v + '</dd></div>';

  function drawerHTML(it) {
    return '<header class="drawer-head">'
      + '<div class="drawer-kicker"><span class="fmt">' + it.format + '</span>'
      + '<span>v' + esc(it.version) + '</span><span class="mono">' + it.id + '</span>'
      + '<button class="icon-btn" data-action="close" aria-label="Close details">✕</button></div>'
      + '<h2 class="drawer-title" id="drawerTitle">' + esc(it.name) + '</h2>'
      + '<nav class="drawer-path" aria-label="Location in catalog">'
      + '<button class="crumb-link" data-action="path" data-value="all">All collections</button>'
      + '<span class="crumb-sep">›</span>'
      + '<button class="crumb-link" data-action="path" data-value="domain">' + esc(it.domain) + '</button>'
      + '<span class="crumb-sep">›</span>'
      + '<button class="crumb-link" data-action="path" data-value="subcat">' + esc(it.subcat) + '</button>'
      + '</nav></header>'
      + '<div class="drawer-body">'
      + '<p class="drawer-org">Published by <strong>' + esc(it.org) + '</strong></p>'
      + '<p class="drawer-desc">' + esc(it.desc) + '</p>'
      + '<div class="row-tags drawer-tags">' + it.tags.map((t) => '<span class="tag">' + esc(t) + '</span>').join("") + '</div>'
      + '<dl class="meta">'
      + metaRow("License", esc(it.license))
      + metaRow("Updated", it.updated)
      + metaRow("Size", fmtSize(it.sizeMB))
      + metaRow("Records", fmtFull(it.records))
      + metaRow("Downloads", fmtFull(it.downloads))
      + metaRow("ID", '<span class="mono">' + it.id + '</span>')
      + '</dl>'
      + '<div class="drawer-actions">'
      + '<button class="btn primary" data-action="browse">Browse this collection</button>'
      + '<button class="btn" data-action="locate">Show in full catalog</button>'
      + '<button class="btn" data-action="copy">Copy link</button>'
      + '</div></div>';
  }

  let lastFocus = null;
  let drawerSeq = 0;   // guards delayed hide/show callbacks against rapid toggling

  function openDrawer(id, opts) {
    const it = byId.get(id);
    if (!it) return;
    const seq = ++drawerSeq;
    state.openId = id;
    els.drawer.innerHTML = drawerHTML(it);
    els.drawer.hidden = false;
    els.overlay.hidden = false;
    requestAnimationFrame(() => {
      if (seq !== drawerSeq) return;
      els.drawer.classList.add("open");
      els.overlay.classList.add("open");
    });
    syncHash();
    if (!(opts && opts.fromHash)) {
      if (!lastFocus || !lastFocus.isConnected) lastFocus = document.activeElement;
      const btn = els.drawer.querySelector('[data-action="close"]');
      if (btn) btn.focus();
    }
  }

  function closeDrawer() {
    if (!state.openId) return;
    const seq = ++drawerSeq;
    state.openId = null;
    els.drawer.classList.remove("open");
    els.overlay.classList.remove("open");
    const finish = () => {
      if (seq !== drawerSeq) return;   // re-opened before the hide landed
      els.drawer.hidden = true;
      els.overlay.hidden = true;
    };
    if (MOTION) setTimeout(finish, 230); else finish();
    if (lastFocus && lastFocus.isConnected) { try { lastFocus.focus(); } catch (e) { /* noop */ } }
    lastFocus = null;
    syncHash();
  }

  // From an item, jump into its home collection — context loop closed.
  function browseCollection(it) {
    state.domain = it.domain;
    state.subcat = it.subcat;
    closeDrawer();
    renderAll();
    els.main.scrollTop = 0;
  }

  // Clear every filter, keep the full catalog, and flash the item in place
  // among its neighbors — "where does this live?" in one look.
  function locateInCatalog(id) {
    clearAll(true);
    closeDrawer();
    renderAll();
    const row = els.grid.querySelector('[data-id="' + id + '"]');
    if (row) {
      row.scrollIntoView({ behavior: MOTION ? "smooth" : "auto", block: "center" });
      row.classList.add("flash");
      setTimeout(() => row.classList.remove("flash"), 2400);
    }
  }

  function copyLink(id) {
    const url = location.href.split("#")[0] + serializeHash(Object.assign({}, state, { openId: id }));
    const done = (ok) => {
      const b = els.drawer.querySelector('[data-action="copy"]');
      if (!b) return;
      b.textContent = ok ? "Copied ✓" : url;
      setTimeout(() => { if (b.isConnected) b.textContent = "Copy link"; }, 2600);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(() => done(true), () => done(false));
    } else done(false);
  }

  function clearAll(clearInput) {
    state.q = "";
    if (clearInput !== false) els.search.value = "";
    state.domain = null;
    state.subcat = null;
    state.formats.clear();
    state.licenses.clear();
  }

  function reset() {
    clearAll(true);
    state.sort = "relevance";
    els.sort.value = "relevance";
    closeDrawer();
    renderAll();
  }

  /* ---------------- events ---------------- */

  function bind() {
    els.search.addEventListener("input", () => { state.q = els.search.value; renderAll(); });
    els.search.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && els.search.value) {
        e.stopPropagation();
        els.search.value = "";
        state.q = "";
        renderAll();
      }
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "/" && !state.openId) {
        const t = document.activeElement, tag = t && t.tagName;
        if (tag !== "INPUT" && tag !== "TEXTAREA" && tag !== "SELECT") {
          e.preventDefault();
          els.search.focus();
          els.search.select();
        }
      } else if (e.key === "Escape" && state.openId) {
        closeDrawer();
      }
    });

    els.sidebar.addEventListener("click", (e) => {
      const btn = e.target.closest("button.tree-row");
      if (!btn) return;
      const dom = btn.dataset.domain;
      const sub = btn.dataset.subcat || null;
      if (sub) {
        state.subcat = state.subcat === sub ? null : sub;  // toggle off returns to domain view
        state.domain = dom;
      } else if (state.domain === dom && !state.subcat) {
        state.domain = null;                               // second click clears + collapses
      } else {
        state.domain = dom;
        state.subcat = null;
      }
      renderAll();
    });

    els.sidebar.addEventListener("change", (e) => {
      const inp = e.target.closest("input[data-facet]");
      if (!inp) return;
      const set = inp.dataset.facet === "format" ? state.formats : state.licenses;
      if (inp.checked) set.add(inp.value); else set.delete(inp.value);
      renderAll();
    });

    els.crumb.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-crumb]");
      if (!btn) return;
      if (btn.dataset.crumb === "all") { state.domain = null; state.subcat = null; }
      else state.subcat = null;
      renderAll();
    });

    els.chips.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-remove]");
      if (!btn) return;
      const k = btn.dataset.remove;
      if (k === "all") clearAll(true);
      else if (k === "q") { state.q = ""; els.search.value = ""; }
      else if (k === "domain") { state.domain = null; state.subcat = null; }
      else if (k === "subcat") state.subcat = null;
      else if (k.indexOf("format:") === 0) state.formats.delete(k.slice(7));
      else if (k.indexOf("license:") === 0) state.licenses.delete(k.slice(8));
      renderAll();
    });

    els.sort.addEventListener("change", () => { state.sort = els.sort.value; renderAll(); });

    els.grid.addEventListener("click", (e) => {
      const row = e.target.closest("[data-id]");
      if (row) openDrawer(row.dataset.id);
    });
    els.grid.addEventListener("keydown", (e) => {
      if ((e.key === "Enter" || e.key === " ") && e.target.dataset && e.target.dataset.id) {
        e.preventDefault();
        openDrawer(e.target.dataset.id);
      }
    });

    els.overlay.addEventListener("click", closeDrawer);

    els.drawer.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-action]");
      if (!btn) return;
      const it = byId.get(state.openId);
      if (btn.dataset.action === "close") { closeDrawer(); return; }
      if (!it) return;
      const act = btn.dataset.action;
      if (act === "browse") browseCollection(it);
      else if (act === "locate") locateInCatalog(it.id);
      else if (act === "copy") copyLink(it.id);
      else if (act === "path") {
        if (btn.dataset.value === "all") { state.domain = null; state.subcat = null; }
        else if (btn.dataset.value === "domain") { state.domain = it.domain; state.subcat = null; }
        else { state.domain = it.domain; state.subcat = it.subcat; }
        closeDrawer();
        renderAll();
        els.main.scrollTop = 0;
      }
    });

    document.getElementById("emptyReset").addEventListener("click", reset);
  }

  /* ---------------- init ---------------- */

  function init() {
    ["search", "sidebar", "crumb", "chips", "count", "sort", "grid", "empty",
     "drawer", "overlay", "topstats", "main"].forEach((id) => { els[id] = document.getElementById(id); });
    bind();
    els.topstats.textContent =
      fmtFull(TOTAL) + " datasets · " + SUBCAT_TOTAL + " collections · " + DOMAINS.length + " domains";

    const h = parseHash(location.hash);
    state.q = h.q;
    state.domain = h.domain;
    state.subcat = h.subcat;
    els.search.value = state.q;
    renderAll();
    if (h.item) openDrawer(h.item, { fromHash: true });
    else els.search.focus();
  }

  /* test hooks — same module powers the UI and test.html assertions */
  window.DataAtlas = {
    state: state, ITEMS: ITEMS, TOTAL: TOTAL,
    DOMAINS: DOMAINS, FORMATS: FORMATS, LICENSES: LICENSES,
    tokenize: tokenize, facetMatch: facetMatch, scoreItem: scoreItem,
    currentList: currentList, facetCounts: facetCounts,
    parseHash: parseHash, serializeHash: serializeHash,
    renderAll: renderAll, reset: reset, clearAll: clearAll,
    openDrawer: openDrawer, closeDrawer: closeDrawer,
    els: els
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
