# Measurement receipt — keyboard check (scr-locate-01 / ds_20260908001459_128963b1)

- Collected: 2026-09-08T01:05:00Z (final capture run)
- Instrument: headless Chrome (Chrome/131 class, `--headless=new`) driven via Chrome DevTools
  Protocol through puppeteer-core 23; real input events dispatched with `page.keyboard`
  (not JS-synthesized state mutation). Scenario script: `tools/capture.js` (v2) in the project root.
- Subject under test: `file:///E:/codex-prj/ab-worktrees/pi-matrix/cell-j02-s02-b/index.html`
  (fresh `page.goto` per scenario; viewport 1600×1000).

## Raw measurement trace (verbatim from evidence/run-log.json, step 5)

```
[5] resetCounter = 2,400 items
[5] focusAfterSlash = search          ← "/" key event moved focus into #search
[5] cursorRow = row-3 Census Counts — Projected Monitor   ← after 3× ArrowDown
[5] cursorRing = true                 ← getComputedStyle(.row.cursor).boxShadow !== "none" (visible cursor)
[5] counter = 284 of 2,400 items      ← typed "census" filtered synchronously
    (Enter pressed here)
[5] detailName = Census Counts — Projected Monitor
[5] detailId = DS-12303
[5] data-state = selected             ← detail panel opened from keyboard
[5] keyboardInteractions = Slash + type + 3xArrowDown + Enter = 3 interactions to detail
```

## Cross-checks in the same run

- `page.on('console')` / `page.on('pageerror')`: 0 messages, 0 errors/warnings across the
  whole scenario (`[console] messageCount = 0`, `errorsOrWarnings = none`).
- Focus visibility: search input shows `:focus-visible` ring (screenshot 05); cursor row
  shows 1px accent border + box-shadow ring (screenshot 05, row-3 highlighted).
- Esc behavior verified in step 5→6 transition (panel closed) and step-4 close via button.

## Screenshots bound to this receipt

- `evidence/05-keyboard-path.png` — post-Enter state: cursor row ring + open detail panel
  + counter "284 of 2,400 items" + chip `search: "census"`.
- `evidence/run-log.json` — machine-readable full log (all steps 1–8 + console).
