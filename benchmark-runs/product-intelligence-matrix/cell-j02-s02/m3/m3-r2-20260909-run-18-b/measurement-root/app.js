"use strict";
/*
 * app.js — The Open Collection · Natural History Index
 *
 * Pattern: PAT-LIST-DETAIL (selection-bound contextual inspector).
 * Single app state: { query, facet sets, selection, per-section windows }.
 * The results context (query, filters, counts, scroll) is never reset by
 * inspecting a record: the detail is a sibling region, not a route/modal.
 */
(function () {
  const C = window.COLLECTION;
  if (!C || !C.items || !C.items.length) {
    document.getElementById("results").innerHTML =
      '<div class="error-state"><h2>Index failed to load</h2><p>The collection data did not materialize.</p></div>';
    return;
  }

  const DEFAULT_WINDOW = 14;
  const WINDOW_STEP = 28;

  const state = {
    q: "",
    facets: { section: new Set(), status: new Set(), era: new Set() },
    selectedId: null,
    windows: Object.create(null),
    focusRowId: null,
    focusFacet: null, // `${groupKey}|${value}` to restore after rail re-render
  };

  const FACETS = [
    {
      key: "section", label: "Collection", field: "section",
      options: C.sections.map((s) => ({ value: s.key, label: s.label })),
    },
    {
      key: "status", label: "Status", field: "status",
      options: [
        { value: "Digitized", label: "Digitized" },
        { value: "In review", label: "In review" },
        { value: "On loan", label: "On loan" },
      ],
    },
    {
      key: "era", label: "Accession era", field: "era",
      options: C.eras.map((e) => ({ value: e.key, label: e.label })),
    },
  ];

  const facetByKey = {};
  FACETS.forEach((f) => { facetByKey[f.key] = f; });
  const facetValueLabel = {};
  FACETS.forEach((f) => f.options.forEach((o) => { facetValueLabel[f.key + "|" + o.value] = o.label; }));

  /* ---------- utilities ---------- */

  const $ = (sel) => document.querySelector(sel);
  const esc = (s) => String(s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  const fmt = (n) => n.toLocaleString("en-US");

  /* Wrap case-insensitive matches of q in <mark>, on escaped text. */
  function highlight(text, q) {
    const raw = String(text);
    if (!q) return esc(raw);
    const lower = raw.toLowerCase();
    const ql = q.toLowerCase();
    let out = "";
    let i = 0;
    while (i < raw.length) {
      const hit = lower.indexOf(ql, i);
      if (hit === -1) { out += esc(raw.slice(i)); break; }
      out += esc(raw.slice(i, hit)) + "<mark>" + esc(raw.slice(hit, hit + ql.length)) + "</mark>";
      i = hit + ql.length;
    }
    return out;
  }

  /* ---------- pipeline ---------- */

  function otherFacetsPass(item, skipKey) {
    for (const f of FACETS) {
      if (f.key === skipKey) continue;
      const set = state.facets[f.key];
      if (set.size && !set.has(item[f.field])) return false;
    }
    return true;
  }

  function compute() {
    const q = state.q.trim().toLowerCase();

    const base = q ? C.items.filter((it) => it.hay.includes(q)) : C.items;

    // Facet counts: candidate set constrained by query and every OTHER group.
    const counts = {};
    for (const f of FACETS) {
      const m = Object.create(null);
      for (const o of f.options) m[o.value] = 0;
      const pool = base.filter((it) => otherFacetsPass(it, f.key));
      for (const it of pool) m[it[f.field]]++;
      counts[f.key] = m;
    }

    const results = base.filter((it) => otherFacetsPass(it, null));

    const groups = [];
    for (const sec of C.sections) {
      const secItems = results.filter((it) => it.section === sec.key);
      if (secItems.length) groups.push({ key: sec.key, label: sec.label, items: secItems });
    }

    return { q, baseCount: base.length, total: results.length, counts: counts, groups: groups };
  }

  /* ---------- renderers ---------- */

  function renderHeader() {
    $("#header-totals").textContent =
      fmt(C.items.length) + " records · " + C.sections.length + " collections · index rebuilt " + C.rebuilt;
  }

  function chip(kindLabel, valueLabel, onRemove) {
    const el = document.createElement("span");
    el.className = "chip";
    el.innerHTML =
      '<span class="chip-kind">' + esc(kindLabel) + '</span><span class="chip-value">' + esc(valueLabel) + "</span>" +
      '<button type="button" class="chip-remove" aria-label="Remove ' + esc(valueLabel) + '">' +
      '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true"><line x1="5" y1="5" x2="19" y2="19"/><line x1="19" y1="5" x2="5" y2="19"/></svg>' +
      "</button>";
    el.querySelector(".chip-remove").addEventListener("click", onRemove);
    return el;
  }

  function renderContext(view) {
    const row = $("#context-row");
    row.innerHTML = "";

    if (view.q) {
      row.appendChild(chip("search", "“" + state.q.trim() + "”", () => {
        state.q = "";
        $("#search-input").value = "";
        update(true);
        $("#search-input").focus();
      }));
    }
    for (const f of FACETS) {
      for (const v of state.facets[f.key]) {
        row.appendChild(chip(f.label, facetValueLabel[f.key + "|" + v], () => {
          state.facets[f.key].delete(v);
          update(true);
        }));
      }
    }

    const total = document.createElement("span");
    total.className = "result-total";
    total.id = "result-total";
    total.setAttribute("aria-live", "polite");
    const narrowed = view.total !== C.items.length || view.q;
    total.innerHTML = narrowed
      ? "<strong>" + fmt(view.total) + "</strong> of " + fmt(C.items.length) + " records"
      : "<strong>" + fmt(C.items.length) + "</strong> records";
    row.appendChild(total);

    if (view.q || state.facets.section.size || state.facets.status.size || state.facets.era.size) {
      const clear = document.createElement("button");
      clear.type = "button";
      clear.className = "clear-all";
      clear.textContent = "Clear all";
      clear.addEventListener("click", () => {
        state.q = "";
        $("#search-input").value = "";
        state.facets.section.clear();
        state.facets.status.clear();
        state.facets.era.clear();
        update(true);
      });
      row.appendChild(clear);
    }
  }

  function renderFacets(view) {
    const rail = $("#filter-rail");
    rail.innerHTML = "";

    for (const f of FACETS) {
      const activeSet = state.facets[f.key];
      const group = document.createElement("div");
      group.className = "filter-group";

      const head = document.createElement("h3");
      head.innerHTML = "<span>" + esc(f.label) + "</span>";
      if (activeSet.size) {
        const gc = document.createElement("button");
        gc.type = "button";
        gc.className = "group-clear";
        gc.textContent = "reset";
        gc.setAttribute("aria-label", "Reset " + f.label + " filter");
        gc.addEventListener("click", () => {
          activeSet.clear();
          update(true);
        });
        head.appendChild(gc);
      }
      group.appendChild(head);

      for (const o of f.options) {
        const n = view.counts[f.key][o.value];
        const label = document.createElement("label");
        label.className = "facet-option" + (n === 0 && !activeSet.has(o.value) ? " off" : "");
        const input = document.createElement("input");
        input.type = "checkbox";
        input.checked = activeSet.has(o.value);
        input.addEventListener("change", () => {
          state.focusFacet = f.key + "|" + o.value;
          if (input.checked) activeSet.add(o.value);
          else activeSet.delete(o.value);
          update(true);
        });
        const name = document.createElement("span");
        name.className = "opt-label";
        name.textContent = o.label;
        const count = document.createElement("span");
        count.className = "opt-count";
        count.textContent = fmt(n);
        label.append(input, name, count);
        group.appendChild(label);
      }
      rail.appendChild(group);
    }

    if (state.focusFacet) {
      const [gk, val] = state.focusFacet.split("|");
      const f = facetByKey[gk];
      if (f) {
        const idx = f.options.findIndex((o) => o.value === val);
        const inputs = rail.querySelectorAll(".filter-group");
        // focus the matching checkbox without scrolling the page
        for (const g of inputs) {
          const h3 = g.querySelector("h3 span");
          if (h3 && h3.textContent === f.label) {
            const box = g.querySelectorAll("input")[idx];
            if (box) box.focus({ preventScroll: true });
            break;
          }
        }
      }
      state.focusFacet = null;
    }
  }

  function rowHtml(it, view) {
    const selected = state.selectedId === it.id;
    const meta = it.group + " · " + it.locality + " · " + it.date;
    return (
      '<li><button type="button" class="row" id="row-' + esc(it.id) + '"' +
      (selected ? ' aria-current="true"' : "") +
      ' data-id="' + esc(it.id) + '">' +
      '<span class="dot" data-status="' + esc(it.status) + '" title="' + esc(it.status) + '"></span>' +
      '<span class="row-name">' + highlight(it.name, view.q) +
      '<span class="common">' + highlight(it.common, view.q) + "</span></span>" +
      '<span class="row-id">' + highlight(it.id, view.q) + "</span>" +
      '<span class="row-meta">' + esc(meta) + "</span>" +
      "</button></li>"
    );
  }

  function renderResults(view) {
    const root = $("#results");

    if (!view.total) {
      root.innerHTML = "";
      root.appendChild(zeroState());
      return;
    }

    let html = "";
    for (const g of view.groups) {
      const shown = Math.min(g.items.length, state.windows[g.key] || DEFAULT_WINDOW);
      html += '<section aria-label="' + esc(g.label) + ' results">' +
        '<div class="section-head"><h2>' + esc(g.label) + '</h2><span class="sec-count">' +
        fmt(g.items.length) + (g.items.length === 1 ? " record" : " records") + "</span></div>" +
        "<ol>";
      for (let i = 0; i < shown; i++) html += rowHtml(g.items[i], view);
      html += "</ol>";
      if (shown < g.items.length) {
        html += '<button type="button" class="show-more" data-section="' + esc(g.key) + '" ' +
          'data-shown="' + shown + '">Show ' + Math.min(WINDOW_STEP, g.items.length - shown) +
          " more of " + fmt(g.items.length - shown) + "</button>";
      }
      html += "</section>";
    }
    root.innerHTML = html;

    root.querySelectorAll(".show-more").forEach((btn) => {
      btn.addEventListener("click", () => {
        const key = btn.getAttribute("data-section");
        state.windows[key] = (state.windows[key] || DEFAULT_WINDOW) + WINDOW_STEP;
        update(false);
        const again = root.querySelector('.show-more[data-section="' + key + '"]');
        if (again) again.focus({ preventScroll: true });
      });
    });

    root.querySelectorAll(".row").forEach((btn) => {
      btn.addEventListener("click", () => selectRecord(btn.getAttribute("data-id")));
    });
  }

  function zeroState() {
    const box = document.createElement("div");
    box.className = "zero-state";
    box.innerHTML = "<h2>No records match</h2><p>Relax one constraint — the rest of your context stays put.</p>";

    const chips = document.createElement("div");
    chips.className = "zero-chips";
    if (state.q.trim()) {
      chips.appendChild(chip("search", "“" + state.q.trim() + "”", () => {
        state.q = "";
        $("#search-input").value = "";
        update(true);
      }));
    }
    for (const f of FACETS) {
      for (const v of state.facets[f.key]) {
        chips.appendChild(chip(f.label, facetValueLabel[f.key + "|" + v], () => {
          state.facets[f.key].delete(v);
          update(true);
        }));
      }
    }
    box.appendChild(chips);
    return box;
  }

  function renderDetail() {
    const panel = $("#detail-panel");
    const shell = $("#workspace");
    const it = state.selectedId ? C.items.find((x) => x.id === state.selectedId) : null;

    if (!it) {
      panel.hidden = true;
      panel.innerHTML = "";
      shell.classList.remove("has-detail");
      return;
    }

    shell.classList.add("has-detail");
    panel.hidden = false;
    panel.innerHTML =
      '<div class="detail-head">' +
      '<h2>' + highlight(it.name, state.q.trim().toLowerCase() || null) + "</h2>" +
      '<button type="button" class="detail-close" id="detail-close" aria-label="Close detail, return to results">' +
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><line x1="5" y1="5" x2="19" y2="19"/><line x1="19" y1="5" x2="5" y2="19"/></svg>' +
      "</button></div>" +
      '<p class="detail-common">' + highlight(it.common, state.q.trim().toLowerCase() || null) + "</p>" +
      '<div class="detail-idline"><span class="row-id">' + esc(it.id) + "</span>" +
      '<span class="status-pill"><span class="dot" data-status="' + esc(it.status) + '"></span>' + esc(it.status) + "</span></div>" +
      '<div class="detail-summary">' + esc(it.summary) + "</div>" +
      "<dl>" +
      "<dt>Taxonomy</dt><dd>" + esc(it.taxa) + "</dd>" +
      "<dt>Curatorial group</dt><dd>" + esc(it.group) + "</dd>" +
      "<dt>Collected</dt><dd>" + esc(it.date) + " — " + esc(it.locality) + "</dd>" +
      "<dt>Collector</dt><dd>" + esc(it.collector) + "</dd>" +
      "<dt>Accession era</dt><dd>" + esc(it.eraLabel) + "</dd>" +
      "<dt>Catalog number</dt><dd>" + esc(it.id) + "</dd>" +
      "</dl>" +
      '<div class="tag-row">' + it.tags.map((t) => '<span class="tag">' + esc(t) + "</span>").join("") + "</div>" +
      '<p class="provenance">Record ' + esc(it.id) + " · index rebuilt " + esc(C.rebuilt) + " · public-domain data release</p>";

    $("#detail-close").addEventListener("click", closeDetail);
  }

  /* ---------- interactions ---------- */

  function selectRecord(id) {
    state.selectedId = id;

    // Update selection affordance in place — the list is not re-rendered,
    // so scroll position and focus are untouched by inspection.
    document.querySelectorAll('#results .row[aria-current="true"]').forEach((el) => el.removeAttribute("aria-current"));
    const row = document.getElementById("row-" + id);
    if (row) row.setAttribute("aria-current", "true");

    renderDetail();
  }

  function closeDetail() {
    const rowId = state.selectedId;
    state.selectedId = null;
    renderDetail();
    if (rowId) {
      const row = document.getElementById("row-" + rowId);
      if (row) row.focus({ preventScroll: true });
    }
  }

  function update(renderAll) {
    const view = compute();
    renderContext(view);
    renderFacets(view);
    renderResults(view);
    if (renderAll) renderDetail();
    if (state.focusRowId) {
      const row = document.getElementById("row-" + state.focusRowId);
      if (row) row.focus({ preventScroll: true });
      state.focusRowId = null;
    }
  }

  function boot() {
    renderHeader();
    update(true);
  }

  /* ---------- keyboard contract ---------- */

  document.addEventListener("keydown", (e) => {
    const inInput = /^(input|textarea|select)$/i.test(e.target.tagName);
    if (e.key === "/" && !inInput) {
      e.preventDefault();
      $("#search-input").focus();
      $("#search-input").select();
    } else if (e.key === "Escape") {
      if (e.target.id === "search-input") {
        if (state.q) {
          state.q = "";
          e.target.value = "";
          update(true);
        } else {
          e.target.blur();
        }
      } else if (state.selectedId) {
        closeDetail();
      }
    }
  });

  $("#search-input").addEventListener("input", (e) => {
    state.q = e.target.value;
    update(false);
  });

  /* First paint is the ready state: data is already materialized. */
  try {
    boot();
  } catch (err) {
    const root = document.getElementById("results");
    root.innerHTML =
      '<div class="error-state"><h2>The index failed to start</h2><p>' +
      esc(String(err && err.message ? err.message : err)) +
      '</p><button type="button" onclick="location.reload()">Reload the index</button></div>';
  }
})();
