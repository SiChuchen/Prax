# The Open Collection — Natural History Index

Single-page web app for **cell-j02-s02 (locate × open-collection)**: locate any
record in a large, weakly-related open collection (2,260 records, 9 collections)
**within three interactions**, via a search/filter path that **never loses your
context**.

## Run it

No build step and no network: the deliverable is static source that is also the
runtime artifact.

- **Open directly**: double-click `index.html` (works from `file://`).
- **Or serve statically** (optional): `python -m http.server` then visit
  `http://localhost:8000/`.

First paint **is** the ready state — the entire collection is materialized
synchronously from `data.js` before first render. There is no loading state.

## Verify it

Open `selftest.html` for in-browser assertions (id uniqueness, curated landmark
locatability, query × facet composition semantics, facet count bounds).

## The locate path (acceptance: 三次交互内定位)

1. **Type** in the search box (or press `/`) — instant narrowing over names,
   catalog numbers, tags, localities; matches highlighted; live total updates.
2. **Optionally click one facet** — Collection / Status / Accession era, with
   live per-option counts; composes with the query.
3. **Click the target row** — the record opens in the adjacent detail panel.

## Context preservation (acceptance: 不丢上下文)

- Opening a record **does not re-render, scroll, or reset** the results list —
  the detail is a sibling region (List-Detail pattern, selection-bound
  contextual inspector), never a modal or route change.
- Active query and facets persist as removable **chips**; removing one
  constraint keeps the others.
- Result-set size is visible at every step: header total, per-section counts,
  and per-facet-option counts.
- Closing the detail returns focus to the originating row.
- Zero-result state lists the active constraints with in-place relax buttons.
- Large sections render incrementally (Show more) while counts always reflect
  the full filtered set — visibility of the remaining space is never traded
  for performance.

## Files

| File | Role |
|---|---|
| `index.html` | Page shell and semantic regions |
| `styles.css` | Design tokens + List-Detail layout |
| `data.js` | Deterministic seeded generator — the corpus materializes at script-eval time |
| `app.js` | Single app state (query, facet sets, selection, section windows) + pipeline + renderers |
| `selftest.html` | In-browser invariant checks |

## Notes

- No backend, no accounts, no persistence, no external requests (fonts/icons
  are system/inline; favicon is a data URI).
- Keyboard: `/` focuses search · `Esc` clears the query, then closes the
  detail · all rows, chips and facets are reachable by tab.
