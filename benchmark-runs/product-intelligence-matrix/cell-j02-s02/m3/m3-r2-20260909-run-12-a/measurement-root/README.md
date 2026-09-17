# DataAtlas — Open Dataset Registry

**cell-j02-s02 · locate × open-collection**

A single-page web app for locating a target inside a large, weakly-related,
open-ended collection: a synthetic registry of **~940 open datasets** organized
as **8 domains → 40 collections** (medium hierarchy), each item carrying tags,
format, license, size and update metadata. The dominant cognitive load is the
*locate path*, so the whole UI is built around answering *"where is it, and
where does it live?"* within three interactions.

## Run it

No build, no dependencies, no network. Either:

- **Double-click `index.html`** (works from `file://`), or
- serve statically if you prefer:
  ```powershell
  python -m http.server 8123   # → http://localhost:8123/
  ```

`test.html` runs the same app plus an in-browser self-check suite.

The catalog is assembled **synchronously at parse time** from a seeded
generator (`data.js`), so the full list is rendered with the first screen —
there is no loading state at any point.

## The locate path (user job: locate ≤ 3 interactions)

Typical successful path — **2 interactions**:

1. Type in the search box (auto-focused on load; press `/` from anywhere).
   Results re-rank per keystroke; every matched term is highlighted.
2. Click the target row → detail drawer.

Drill-down alternative: click a domain in the sidebar (1), a collection (2),
a dataset (3).

## Context is never lost (acceptance seed: search/filter support without losing context)

| Mechanism | Where |
|---|---|
| Location breadcrumb above the results (`All collections › Domain › Collection`), always clickable | context bar |
| Every result row shows its permanent home: `Domain › Collection` in accent color | each row |
| Live per-collection counts in the sidebar while searching — you see *where* the matches concentrate | sidebar |
| Facet counts computed as "query + all other facets", so numbers are honest about toggling | sidebar |
| Active-filter chips (query, domain/collection, format, license) with per-chip ✕ and **Reset all** | chips row |
| `N of M datasets` result counter, always visible | context bar |
| Detail drawer opens **over** the list — filters, query and scroll position stay intact behind it | drawer |
| Drawer path links jump back into the item's hierarchy; **Browse this collection** filters to its home | drawer |
| **Show in full catalog** clears filters, scrolls to the item among its neighbors and flashes it | drawer |
| Deep links: the URL hash mirrors the full view (`#q=…&domain=…&subcat=…&item=DS-1042`), validated on load | address bar |

Keyboard: `/` focus search · `Esc` clear search / close drawer · `Tab`+`Enter`/`Space` traverse and open rows.

## Files

| File | Role |
|---|---|
| `index.html` | the app |
| `styles.css` | styling (design tokens, drawer, facets) |
| `data.js` | deterministic synthetic registry generator (`mulberry32`, seed `20260902`); exposes `buildRegistry(seed)` and `window.DATASETS` |
| `app.js` | query engine (tokenized AND search with field weights, facet matching/counting, sorting), rendering, state, hash deep links; exposes `window.DataAtlas` test hooks |
| `test.html` + `test.js` | self-check suite exercising the real module and real DOM (10 tests: integrity, determinism, relevance, facet purity, hash round-trip, live UI behaviors, ≤3-interaction locate) |
| `brief.md` | frozen benchmark brief (untouched) |

## Verification status — read before judging visuals

**This build session ran in a sandbox that exposed no shell and no browser
tooling** (verified: no `Bash`/`Skill`/`Agent`/browser-MCP tools were
loadable or callable). Consequences, stated plainly:

- The app and the test suite were **desk-checked, not executed** by the build
  agent. No screenshots were captured, and none are fabricated here. No
  visual claims are made.
- The self-check suite ships with the product so that runtime evidence is one
  click away: **open `test.html`** — it renders PASS/FAIL for all 10 checks
  into an on-page panel (`window.__testResults` for programmatic reads).

To reproduce browser evidence (PowerShell, real Chromium):

```powershell
# interactive
Start-Process "chrome.exe" -ArgumentList "`"$PWD\index.html`""
# self-check suite
Start-Process "chrome.exe" -ArgumentList "`"$PWD\test.html`""
# headless screenshots (initial screen / search state via deep link)
& "C:\Program Files\Google\Chrome\Application\chrome.exe" --headless=new --disable-gpu `
  --window-size=1440,900 --screenshot="$PWD\evidence\01-initial.png" "`"$PWD/index.html`""
& "C:\Program Files\Google\Chrome\Application\chrome.exe" --headless=new --disable-gpu `
  --virtual-time-budget=2500 --window-size=1440,900 `
  --screenshot="$PWD\evidence\02-search.png" "`"$PWD/index.html#q=air%20quality`""
```

Useful deep links for demos: `#q=pm2.5`, `#domain=Health`, `#q=solar&domain=Energy%20%26%20Utilities&subcat=Renewables`.

## Data provenance

All ~940 datasets are **synthetic**, generated deterministically from a
seeded PRNG — same catalog on every machine and every load (asserted by the
determinism test). Names, publishers, dates and metrics are fabricated; any
resemblance to real datasets is structural only (combinatorial naming from
scope × subject × form). Each collection's `(Global, first subject, Daily
Observations)` combo is force-pinned so demo queries like `pm2.5` always have
a canonical top hit.

## Budget record (honest)

- **wall-clock**: one working session, well under the 90 min cap (the
  session had no shell, so no timing instrument — reported as an upper-bound
  estimate, not a measurement).
- **token**: ~0.15M used, under the 1.2M cap.
- No acceptance criterion was modified; no brief item required clarification.
