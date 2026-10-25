# Real-browser drive report — Gatepass (cell-j10-s09)

- Date: 2026-10-25
- Browser: Microsoft Edge (Chromium) 1440×900, headless, driven by playwright-core (.driver/drive.js)
- App under test: http://127.0.0.1:3000/ (static index.html at repo root; also openable via file://)
- Result: **30/30 checks passed, 0 JavaScript console errors** across two complete runs
- Independent harness: Prax's own browser measurement (prax-measure, receipt run `e8a9187b`) on the
  same app reports layout.overflow / responsive_collision / text.truncation / a11y.contrast /
  a11y.focus_order / a11y.target_size **all pass** at 1280×860 and 1440×900; its single
  warning-severity item (11px badge span) was fixed afterwards (badge raised to 12px) and the
  driver suite re-verified 30/30.

## Run 1 — full traversal incl. one deliberate verification failure
- first-paint-ready ✓ (step 1 active, 0/11, no loading state)
- A: action blocked before all gates pass (steps s1, s4, s7) ✓
- B: locked future step click → deny shake, no navigation ✓
- C: modal "Cancel (safe)" → overlay closes, no state change, audit entry ✓
- Step 6 IRREVERSIBLE: typed phrase MIGRATE DB-PROD-1 → button enables only on match ✓
- Step 7 IRREVERSIBLE: PROMOTE 2.4.0 → undo window opens at 15:00 ✓
- Step 8: wrong value 0.9% → FAILED chip + contingency block revealed ✓
- Completion: 11/11 steps, 3 typed confirmations, 6 values verified, **1 failed check** ✓
- D: audit ordering checked < gate-passed < verified < typed-confirmation < executed ✓

## Run 2 — clean zero-mistake run incl. rollback drill
- Restart runbook resets fully ✓
- F: rollback during undo window → step 7 back to pending/current, later steps collapse,
  audit logs "Rolled back", gates stay satisfied, re-execution enabled ✓
- Completion: 11/11, 4 typed confirmations, 6 verified, **0 failed checks** ✓
- E: zero console errors in both runs ✓

## Screenshots (this directory)
| file | shows |
|---|---|
| s01-first-paint.png | first paint: usable, all 3 regions, step 1 ready |
| s02-confirm-modal.png | typed-phrase confirmation modal (blast radius + recovery path) |
| s03-undo-window.png | 15:00 undo window + "Roll back now" + recovery path |
| s04-contingency.png | failed verification → FAILED chip + contingency block |
| s05-completion-with-warnings.png | completion stats with 1 failed check |
| s06-completion-zero-mistake.png | zero-mistake completion (0 failed checks, 64 audit events) |
| s07-locked-steps.png | rail: current highlighted, future steps locked |
| s08-keyboard-focus.png | visible keyboard focus ring on rail step row |
| s09-rollback.png | post-rollback state: step 7 pending/current, audit "Rolled back" |
