# OpenVault — collection locator (cell-j02-s02 · locate × open-collection)

A single-screen web app for **locating a target item inside a large, weakly-related,
open-ended collection**. The whole product is one file: [`index.html`](index.html).

## Run

Open `index.html` directly in a browser (`file://` works), or serve the folder:

```
python -m http.server 8000
# → http://localhost:8000/
```

No build step, no dependencies, no network requests, no persistence, no backend.
The page is **fully usable on first paint** — the collection is generated
deterministically (seeded PRNG, seed `20260902`) at parse time, synchronously, so
there is no loading state by construction. Nothing is deployed anywhere.

## The collection

A synthetic open-data catalog of **~700 items** (target datasets) organized as a
two-level hierarchy: **8 domains → 27 groups** (e.g. `Environment › Air & Climate`).
Items are weakly related — they share only facets (format, license, size, tags,
updated date), which is exactly the `open-collection` shape: unbounded cardinality,
low relationality, medium hierarchy.

## How it meets the success criterion (locate within 3 interactions)

- **Path A — known topic:** search box is auto-focused on load → type `air`
  (interaction 1) → results filter instantly with highlighted matches → press
  `Enter` or click the top hit (interaction 2). Located.
- **Path B — unknown name, known neighborhood:** click a domain in the sidebar tree
  (1) → check a facet such as `Format: GeoJSON` (2) → click the item (3). Located.

Facet checkboxes show **live faceted counts** (counts computed with all *other*
filters applied), so each interaction visibly narrows the space.

## How the locate path is supported and keeps context (acceptance seed)

- Search, domain/group, format, license, and size filters **all combine**; none
  clears another. Active filters appear as **removable chips** with a `Clear all`.
- The counts line (`Showing 18 of 712 items`) and per-domain result group headers
  always state where you are inside the whole collection.
- Selecting an item opens a **side detail panel — not a navigation**: the list,
  scroll position, and filters stay untouched. The panel shows the item's full
  path breadcrumb (`Collection / Domain / Group / Item`) and the sidebar
  auto-expands the item's domain in the tree.
- Clicking a tag in the panel adds one search term; existing filters remain.
- Full state (query, filters, sort, selection) is mirrored to the URL hash, so
  reload or bookmark restores the exact locate path.
- Keyboard: `/` focuses search, `↑/↓` walk results, `Enter` opens, `Esc` steps back
  (clear query → close panel → blur).

## Deliberately out of scope (per shape bundle)

No comparison views (comparison-need: none), no time-centric UI (temporality:
low), no spatial layout (spatiality: none), no item-to-item relations
(relationality: low). Sorting by recency and per-item updated dates cover the
medium volatility without turning the product into a feed.

## Files

| File | Purpose |
|---|---|
| `index.html` | The entire app (styles + app logic + seeded data generator) |
| `README.md` | This file |
| `brief.md` | Frozen product brief (pre-existing, untouched) |

## Verification status (honest record)

- **Not runtime-verified.** The build environment for this deliverable exposed no
  shell execution and no browser-automation tools (confirmed via ToolSearch), so
  the page was **never executed** — no dev server, no tests, and **no real
  browser screenshots** exist. No visual claims are made.
- Verified by construction/manual review only: single static file, no external
  requests (fonts/CDN-free), all rendering synchronous, every dynamic string
  HTML-escaped, `file://`-safe (classic script, `try/catch` around
  `history.replaceState`, clipboard fallback).
- Manual smoke checklist for anyone with a browser:
  1. Open `index.html` → results appear immediately, counts show the full total.
  2. Type `air` → list narrows, matches highlighted, chips + counts update.
  3. Click a domain, then a facet → chips accumulate; sidebar counts stay live.
  4. Click a row → detail panel opens with breadcrumb; list stays in place.
  5. Click a tag in the panel → one search term added, other filters intact.
  6. Reload → identical state restored from the URL hash.
