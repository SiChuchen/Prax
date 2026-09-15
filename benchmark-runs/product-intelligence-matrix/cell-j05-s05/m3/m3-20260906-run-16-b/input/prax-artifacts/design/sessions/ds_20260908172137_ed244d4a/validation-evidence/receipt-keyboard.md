# Measurement receipt — keyboard

- Measured at: 2026-09-08T18:00Z (local 2026-09-09 01:58 +08:00)
- Measured by: Claude (implementation arm, cell-j05-s05-b)
- Method: regex measurement over serialized DOM (evidence/05-dom-follow.html, from msedge --dump-dom) + source inspection of app.js / styles.css.

## Measurements (regex counts on serialized DOM)

- `tabindex="0"` → 64 occurrences (24 nodes + 40 edge hit-areas, all primary objects focusable)
- `role="button"` → 64 occurrences
- `aria-label` → 73 occurrences (every focusable object labelled)
- `class="edge-hit"` → 40; `chip current` → 1 (trail state reflected in DOM)

## Keyboard operability (app.js bindEvents)

- Tab: traverses all 24 nodes and 40 edge hit-areas in map order
- Enter / Space on node or edge: select (svg keydown handler, preventDefault on Space)
- Esc: returns to the whole web (clearAll — clears selection, trail, focus); Esc inside search closes the dropdown first
- `/`: focuses the search box (guarded against INPUT/TEXTAREA targets)
- ArrowDown / ArrowUp / Enter inside search: match navigation and selection

## Visible focus (styles.css)

- `g.node:focus-visible .node-box { stroke:#fff; stroke-width:2.2 }`
- `.edge-hit:focus-visible { stroke:rgba(56,225,255,.55); stroke-width:3; stroke-dasharray:3 4 }`
- `.btn:focus-visible { outline:2px solid var(--accent); outline-offset:1px }`
- `#search:focus { border-color:var(--accent) }`

## Artifacts

- evidence/05-dom-follow.html (measurement source)
- app.js, styles.css (handlers and focus rules)
