# Locus — OpenCollection Locator (cell-j02-s02)

Single-page web app for the **locate × open-collection** cell: find any target in a large,
unbounded, weakly-related collection (2,400 seeded datasets across 8 domains) **within three
interactions**, with search/filter support and **zero context loss**.

## Run

No build step, no dependencies, no network:

- Open `index.html` directly (`file://` works — classic scripts only), or
- serve statically: `python -m http.server 8000` → http://localhost:8000

## The locate path (acceptance seed: 搜索/过滤支撑且不丢上下文)

1. **Type** in the search box — instant, synchronous filtering with hit highlighting (interaction 1)
2. *(optional)* **Click a facet** — domain tree / tags / format / license, live exclusion counts (interaction 2)
3. **Click the row** (or ↑/↓ + Enter) — detail opens in a **side panel**; list, chips, counts and
   scroll position stay exactly where they were (interaction ≤3)

Keyboard contract (one, declared): `/` focus search · `↑`/`↓` move result cursor ·
`Enter` open detail · `Esc` close panel / clear query.

Context preservation is structural: selection never navigates; removing a chip or closing the
panel restores the identical prior view. State is shareable via URL hash (`#q=…&d=…&sel=…`).

## States

`ready` (first paint — data is inlined and boots synchronously; `loading` is unreachable by
construction), `empty` (0 hits + one-click recovery), `selected` (detail panel open),
`error` (broken deep-link → banner + reset).

## Files

- `index.html` — structure/regions per SDIR `scr-locate-01`
- `styles.css` — compact token sheet (13px UI, 32px rows, 236px rail, 352px panel)
- `data.js` — deterministic seed `20260902` → 2,400 items, 8 domains × 3–6 subcategories
- `app.js` — single-owner state, exclusion facet counts, windowed rendering (bounded DOM)

Design session: Prax `ds_20260908001459_128963b1` (greenfield · PAT-LIST-DETAIL · direct_code).
