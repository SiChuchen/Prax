# Lensboard — dimensional workbench

Cell **cell-j13-s10** (explore × dimensional-space) · single-screen web app for exploring a
high-dimensional dataset where **switching dimensions never resets cognition**.

## Run

No build, no dependencies, no network:

- Double-click `index.html` (works from `file://`), or
- serve statically, e.g. `python -m http.server 8000` → http://localhost:8000

The dataset (720 records × 9 dimensions) ships inline in `data.js`, loaded synchronously —
the page is fully usable at first paint; there is no loading state.

## What it does

- **Lens switching without cognitive reset** — click a dimension in the left rail to make it the
  active lens (chart projection + table sort). Filters, selection, and history are untouched.
- **Attributed filter state** — every filter is owned by exactly one dimension: the rail shows a
  per-dimension ownership badge, the ledger shows a chip labeled by its dimension
  (`Temperature [30.0 – 40.0) °C  ×`), the lens chart highlights the covered bins.
- **Revertible at three granularities**
  - each chip has an individual remove button,
  - each history entry (filter add/remove/set, lens switch, reset) has its own `↩ revert`,
  - global `Undo` button + `Ctrl+Z` pops the latest change; `Reset all` is itself revertible.
- **Click-to-filter lens** — click a histogram bin / category bar to filter by that range or value;
  click again (or the chip) to remove. Hover/focus previews range + count.
- **Persistent selection** — click a row; the inspector shows that record across **all** dimensions
  in fixed order (with full-range position bars), even when later filters push it outside the
  working set (flagged, never silently dropped).
- **Keyboard grammar** — one Tab stop per region (rail, lens chart, table, ledger); `Arrow` keys
  walk within a region; `Enter`/`Space` applies (filter / select / switch lens); `Ctrl+Z` undoes.
- **Shareable view state** — the URL hash carries `lens`, `f` (filters), and `sel` (selection),
  e.g. `index.html#f=status:degraded&lens=battery_pct&sel=S-0100`.
- **Virtualized working set** — only the visible row window is in the DOM (spacer-sized), so the
  720-record table stays instant at any viewport.
- **Empty state** — over-filtering to 0 records shows a recovery action; no dead ends.

## Files

| file | role |
|---|---|
| `index.html` | markup shell (static-open entry) |
| `styles.css` | compact professional theme (self-contained design tokens) |
| `app.js` | state model + rendering (vanilla JS, no modules, no fetch) |
| `data.js` | generated dataset payload (`window.DATASET`) |
| `scripts/gen-data.js` | one-off deterministic generator (`node scripts/gen-data.js`) |

## States

- `ready` — initial state at first paint (data is inline).
- `selected` — row selection drives the inspector.
- `empty` — working set filtered to 0 records; recovery offered.
- `loading` / `error` — unreachable by design: all data is local and synchronous, there is no
  network, no async work, and no destructive action. Documented intentionally rather than faked.

## Design-session provenance

Built through a Prax design session (`ds_20261025061600_34e1162d`, greenfield):
pattern **PAT-DATA-EXPLORER** (+ contextual inspector, orientation invariants),
SDIR screen `dimensional_workbench`, direct-code realization, validation plan rev 1.
