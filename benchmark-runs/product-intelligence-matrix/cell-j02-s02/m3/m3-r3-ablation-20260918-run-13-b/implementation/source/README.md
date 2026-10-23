# PartAtlas — locate a component (cell-j02-s02 · locate × open-collection)

Single-page web app for the **locate** job in a large, open-ended collection
(2,000-part electronics catalog, 8 categories, 30 families). The main cognitive
burden is the **locate path**: instant search + faceted narrowing that never
loses context.

## Run

No build, no server, no dependencies.

- **Open directly:** double-click `index.html` (classic scripts → works from `file://`).
- Or serve statically: `python -m http.server` / `npx serve` and open `/index.html`.
- Optional deep link: `index.html?q=100nF&cat=cap&fam=cap/CER`

## The three-interaction locate path

1. Type a fragment (search is focused on load) — results + every facet count
   update synchronously.
2. Optionally click one family or facet chip to narrow (counts stay live).
3. Click a row — or press <kbd>↓</kbd>/<kbd>↑</kbd> + <kbd>↵</kbd> — the part
   fills the adjacent inspector. Results, breadcrumb, and narrowing all stay.

## Context preservation (acceptance seed)

- Search and filters **compose** (AND); changing one never resets the other.
- The breadcrumb strip (`All parts › Category › Family` + removable facet
  chips) always shows where you are; ancestors are clickable to relax scope.
- A selected part stays pinned in the inspector even when narrowing moves on;
  if it falls outside the current narrowing it is annotated
  (`⚠ outside current narrowing`) with an explicit **Show in its home context**
  action. Nothing is silently dropped.

## Data

`data.js` inlines the catalog deterministically (seeded PRNG, snapshot label
`2026-09-24`). It evaluates synchronously **before first paint** — the full
collection is present the moment the screen is visible; no loading state is
measurable at load. A `loading` panel exists in markup only as a defensive
state (hidden by `app.js`, which runs immediately after `data.js`).

## Files

- `index.html` — semantic regions (search / rail / results / inspector / breadcrumbs / status)
- `styles.css` — design tokens, quiet regular-density styling, AA contrast, visible focus
- `data.js` — inlined catalog generator (classic script, no modules → `file://` safe)
- `app.js` — state (query / filters / selection) + chunked rendering + keyboard support

Keyboard: <kbd>/</kbd> focus search · <kbd>↑</kbd><kbd>↓</kbd> move selection ·
<kbd>↵</kbd> inspect · <kbd>Esc</kbd> clear (search field: clears query; otherwise clears narrowing).
