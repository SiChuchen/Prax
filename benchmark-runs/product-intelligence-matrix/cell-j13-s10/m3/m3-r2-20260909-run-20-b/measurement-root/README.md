# AURORA Exoplanet Catalog — Dimensional Explorer

Cell **cell-j13-s10** (explore × dimensional-space) — a single-screen web app for
exploring a multi-dimensional dataset where **switching dimensions never resets
your cognitive context**.

## Run it

No build, no server, no network:

- Double-click `index.html` (opens statically, `file://` is fine), or
- serve the folder with any static server.

First paint renders the full UI synchronously from the inlined catalog
(1,204 synthetic records × 10 dimensions, seeded generator in `data.js`) —
there is no loading state.

## The explore loop

- **Encoding slots (left rail):** assign any dimension to X, Y, Color, or Size.
  Swapping a slot re-projects the same records — your **selection**, **filters**,
  table order and scroll survive untouched, because selection attaches to
  record identity, not screen position.
- **Filters (dimension rail):** every quantitative dimension has a range filter;
  every categorical one has class checkboxes. Each filter is **owned** by its
  dimension and appears as a **chip** above the field naming its owner and
  predicate. Remove one chip → exactly that filter is reverted. `Clear filters`
  reverts all.
- **Projection is revertible:** `↶ Undo projection` steps back through slot
  changes; `Reset projection` returns to defaults (and is itself undoable).
- **Inspector:** shows the selected record's profile across **all ten**
  dimensions regardless of what is currently projected; dims currently on a
  slot are marked `◂ slot`. An excluded record says so in **Status**.
- **Record table:** dense rows with the current slot values — a reading anchor
  that keeps its scroll position across re-projection. Sortable headers.
- **Keyboard:** table rows are focusable; `Enter`/`Space` select, `↑`/`↓` move
  the selection, `Esc` clears it. Slots, toggles, and filters are native
  controls with visible focus.

## Self-test

Open `index.html?test=1` — a scripted harness exercises first-paint readiness,
selection-persistence across dimension switches, chip ownership and individual
revert, per-step projection undo, reset, and clear-all, and renders a pass/fail
report (`window.__EXPLORER__` exposes the same API for external verification).

## Implementation notes

- Zero dependencies: hand-written vanilla JS/CSS (classic scripts, ES module–free
  so `file://` works without a server). Canvas scatter, DPR-aware.
- State owners: `projection+scale` → app root (undoable history);
  `filters` → per-dimension rail controls (mirrored as chips);
  `selection` → app-root `Set<recordId>`; `viewport` → derived axis extents;
  `inspector` → derived from the selection anchor.
