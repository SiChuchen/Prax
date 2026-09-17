/* DataAtlas self-check — exercises the real UI module in a real browser.
 * Open test.html; results also land in window.__testResults. */
(function () {
  "use strict";

  const A = window.DataAtlas;
  const results = [];
  window.__testResults = results;

  function T(name, fn) {
    try {
      const info = fn();
      results.push({ name: name, pass: true, info: info || "" });
    } catch (err) {
      results.push({ name: name, pass: false, info: err && err.message ? err.message : String(err) });
    }
  }
  function assert(cond, msg) { if (!cond) throw new Error(msg); }

  function setSearch(q) {
    A.els.search.value = q;
    A.els.search.dispatchEvent(new Event("input", { bubbles: true }));
  }
  function facetState(q, domain, subcat, formats, licenses) {
    return {
      q: q || "", domain: domain || null, subcat: subcat || null,
      formats: new Set(formats || []), licenses: new Set(licenses || []),
      sort: "relevance", openId: null
    };
  }

  window.addEventListener("load", () => {
    const ITEMS = A.ITEMS, TOTAL = A.TOTAL;

    /* 1 — registry integrity */
    T("registry: size, taxonomy, unique ids/names, complete fields", () => {
      assert(TOTAL >= 900, "expected ≥ 900 items, got " + TOTAL);
      assert(A.DOMAINS.length === 8, "expected 8 domains, got " + A.DOMAINS.length);
      const subcats = A.DOMAINS.reduce((a, d) => a + d.subcats.length, 0);
      assert(subcats === 40, "expected 40 collections, got " + subcats);
      const ids = new Set(), names = new Set();
      for (const it of ITEMS) {
        assert(!ids.has(it.id), "duplicate id " + it.id);
        ids.add(it.id);
        assert(!names.has(it.name), "duplicate name: " + it.name);
        names.add(it.name);
        for (const k of ["id", "name", "domain", "subcat", "org", "desc", "tags", "format", "license", "sizeMB", "records", "updated", "version", "downloads"]) {
          const v = it[k];
          const ok = k === "tags" ? (Array.isArray(v) && v.length >= 3) : (v !== "" && v !== null && v !== undefined);
          assert(ok, "item " + it.id + " field " + k + " missing/short");
        }
      }
      return TOTAL + " items, 8 domains, 40 collections, all fields present";
    });

    /* 2 — determinism */
    T("registry: deterministic build (same seed → identical catalog)", () => {
      const a = JSON.stringify(window.buildRegistry(20260902));
      const b = JSON.stringify(window.buildRegistry(20260902));
      assert(a === b, "two builds from the same seed differ");
      assert(a === JSON.stringify(ITEMS), "canonical DATASETS differs from a fresh same-seed build");
      return "identical across 3 builds";
    });

    /* 3 — search relevance */
    T("search: 'air quality' returns hits, every token matched, top hit on-topic", () => {
      const st = facetState("air quality");
      const list = A.currentList(st);
      assert(list.length > 0, "no results for 'air quality'");
      const tokens = A.tokenize("air quality");
      assert(tokens.length === 2, "tokenizer expected 2 tokens");
      for (const it of list) assert(A.scoreItem(it, tokens) > 0, it.id + " returned without matching both tokens");
      assert(list[0].subcat === "Air Quality", "top hit is off-topic: " + list[0].subcat);
      return list.length + " hits; top: " + list[0].name;
    });

    T("search: 'pm2.5' surfaces the PM2.5 datasets first", () => {
      const list = A.currentList(facetState("pm2.5"));
      assert(list.length >= 1, "no hits for pm2.5");
      assert(list[0].name.toLowerCase().includes("pm2.5"), "top hit lacks pm2.5: " + list[0].name);
      return "top: " + list[0].name;
    });

    /* 4 — facet purity */
    T("facets: domain / format / license filters are exact and combinable", () => {
      const dom = "Health";
      for (const it of A.currentList(facetState("", dom))) assert(it.domain === dom, "domain leak: " + it.id);
      for (const it of A.currentList(facetState("", dom, null, ["CSV"]))) {
        assert(it.domain === dom && it.format === "CSV", "combo leak: " + it.id);
      }
      for (const it of A.currentList(facetState("", "", null, [], ["ODbL"]))) {
        assert(it.license === "ODbL", "license leak: " + it.id);
      }
      return "no leaks across domain, format, license and combos";
    });

    T("facets: live counts partition the filtered set exactly", () => {
      const st = facetState("water");
      const c = A.facetCounts(st);
      const sum = c.domains.reduce((a, d) => a + d.count, 0);
      const direct = ITEMS.filter((it) => A.scoreItem(it, A.tokenize("water")) > 0).length;
      assert(sum === direct, "domain counts (" + sum + ") != query hits (" + direct + ")");
      const fsum = c.formats.reduce((a, f) => a + f.count, 0);
      assert(fsum === direct, "format counts (" + fsum + ") != query hits (" + direct + ")");
      return "query 'water': " + direct + " hits, counts partition exactly";
    });

    /* 5 — hash deep links */
    T("hash: serialize → parse round-trips query and location", () => {
      const st = { q: "solar", domain: "Energy & Utilities", subcat: "Renewables", openId: null };
      const p = A.parseHash(A.serializeHash(st));
      assert(p.q === "solar" && p.domain === "Energy & Utilities" && p.subcat === "Renewables",
        JSON.stringify(p));
      const p2 = A.parseHash("#q=ghost&domain=Nope");
      assert(p2.q === "ghost" && p2.domain === null, "invalid domain should be dropped");
      return "round-trip + invalid-value guard OK";
    });

    /* 6 — live DOM: search */
    T("UI: typing updates grid, count text and match highlighting", () => {
      A.reset();
      setSearch("solar");
      const list = A.currentList();
      assert(A.els.grid.children.length === list.length, "grid rows != result count");
      assert(/of [\d,]+ datasets/.test(A.els.count.textContent), "count text not in 'N of M' form: " + A.els.count.textContent);
      assert(A.els.grid.innerHTML.indexOf("<mark>") !== -1, "no <mark> highlight in results");
      assert(A.els.crumb.textContent.indexOf("All collections") !== -1, "breadcrumb lost during search");
      return list.length + " rows rendered, highlighted, breadcrumb intact";
    });

    /* 7 — live DOM: drill into a collection, context stays visible */
    T("UI: collection click filters and expands subcats with consistent counts", () => {
      A.reset();
      const btn = A.els.sidebar.querySelector('button.tree-row[data-domain="Health"]');
      btn.click();
      assert(A.state.domain === "Health", "state.domain not set");
      assert(A.els.crumb.textContent.indexOf("Health") !== -1, "breadcrumb missing domain");
      const rows = [...A.els.grid.querySelectorAll(".row-path")];
      assert(rows.length > 0 && rows.every((r) => r.textContent.indexOf("Health") === 0), "row breadcrumbs missing domain");
      const node = A.facetCounts().domains.find((d) => d.name === "Health");
      const sum = node.subcats.reduce((a, s) => a + s.count, 0);
      assert(sum === node.count, "subcat counts (" + sum + ") != domain count (" + node.count + ")");
      assert(A.els.sidebar.querySelectorAll(".subrow").length === 5, "expected 5 expanded collections");
      return rows.length + " rows, 5 subcats expanded, counts consistent";
    });

    /* 8 — the success criterion: locate in ≤ 3 interactions */
    T("locate: search (1) + click result (2) opens the target — under 3 interactions", () => {
      A.reset();
      setSearch("renewables wind");                            // interaction 1
      const top = A.currentList()[0];
      A.els.grid.querySelector('[data-id="' + top.id + '"]').click(); // interaction 2
      assert(A.state.openId === top.id, "drawer did not open on row click");
      assert(A.els.drawer.querySelector("#drawerTitle").textContent === top.name, "drawer title mismatch");
      const filtersBehind = A.els.count.textContent;           // context preserved behind drawer
      assert(filtersBehind.indexOf(String(A.currentList().length)) !== -1, "result count changed behind drawer");
      A.els.drawer.querySelector('[data-action="close"]').click(); // interaction 3 = done, with margin
      assert(A.state.openId === null, "drawer did not close");
      return "target '" + top.name + "' located in 2 interactions";
    });

    /* 9 — no lost context: show a located item inside the full catalog */
    T("locate: 'Show in full catalog' clears filters and flashes the item among neighbors", () => {
      setSearch("solar");
      const top = A.currentList()[0];
      A.els.grid.querySelector('[data-id="' + top.id + '"]').click();
      A.els.drawer.querySelector('[data-action="locate"]').click();
      assert(A.els.grid.children.length === TOTAL, "full catalog not restored (" + A.els.grid.children.length + " vs " + TOTAL + ")");
      const row = A.els.grid.querySelector('[data-id="' + top.id + '"]');
      assert(row && row.classList.contains("flash"), "target row not flashed");
      assert(A.state.q === "" && A.state.domain === null, "filters not cleared");
      return "item " + top.id + " flashed in the unfiltered catalog of " + TOTAL;
    });

    /* 10 — empty state recovery */
    T("empty state: no-match query shows recovery; reset restores the full catalog", () => {
      A.reset();
      setSearch("zzzqqq");
      assert(!A.els.empty.hidden, "empty state not shown");
      document.getElementById("emptyReset").click();
      assert(A.els.grid.children.length === TOTAL && A.els.empty.hidden, "reset did not restore");
      return "recovery OK";
    });

    /* render report */
    const passed = results.filter((r) => r.pass).length;
    const panel = document.createElement("div");
    panel.id = "testbanner";
    panel.innerHTML = "<h1>Self-check</h1>"
      + '<p class="sub">Same app module, real DOM — runs on open.</p>'
      + "<ol>"
      + results.map((r) => '<li class="' + (r.pass ? "pass" : "fail") + '">'
        + (r.pass ? "PASS" : "FAIL") + " — " + r.name
        + (r.info ? '<div class="info">' + r.info.replace(/&/g, "&amp;").replace(/</g, "&lt;") + "</div>" : "")
        + "</li>").join("")
      + "</ol>"
      + '<p class="summary ' + (passed === results.length ? "pass" : "fail") + '">'
      + passed + " / " + results.length + " passed</p>";
    document.body.appendChild(panel);
    // eslint-disable-next-line no-console
    console.table(results);
  });
})();
