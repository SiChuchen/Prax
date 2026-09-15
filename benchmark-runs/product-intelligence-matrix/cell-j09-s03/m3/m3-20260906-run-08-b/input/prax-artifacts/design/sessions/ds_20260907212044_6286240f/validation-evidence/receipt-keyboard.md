# Measurement Receipt — keyboard (empirical)
- Run: node tools/cdp-drive.mjs (copy: validation-evidence/cdp-drive.mjs), headless Chrome `--remote-debugging-port=9337`, viewport 1440x900, page file:///E:/codex-prj/ab-worktrees/pi-matrix/cell-j09-s03-b/index.html
- Real key events via CDP Input.dispatchKeyEvent (not JS-synthesized): ArrowRight / ArrowLeft / 1-3 / L / R, plus native range-slider arrow handling.
- Assertions (stdout captured in validation-evidence/cdp-run.log, machine-readable copy validation-evidence/checks.json):
  - keyboard_select: {pinASelected:true, thASelected:true, mapInfoUpdated:true}  (ArrowRight from no selection -> A)
  - locked: {lockChip:true, verdictLocked:true, unlockBtn:true, pinLocked:true}  (L pressed while rent slider still focused -> shortcut not swallowed)
  - reset_works: {chipHiddenAgain:true, emptyHintsGone:true, rentBackToDefault:true}  (R pressed while slider focused)
- Visible focus: validation-evidence/05-locked-verdict.png shows focus ring on the rent slider; pins/buttons have :focus-visible outlines.
