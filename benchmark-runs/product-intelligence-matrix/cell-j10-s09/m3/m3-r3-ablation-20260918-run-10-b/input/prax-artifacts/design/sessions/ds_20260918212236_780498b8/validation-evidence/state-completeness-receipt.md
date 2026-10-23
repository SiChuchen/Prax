# Measurement receipt — state_completeness

- Method: real headless Chrome (C:\Program Files\Google\Chrome\Application\chrome.exe),
  `--headless=new --disable-gpu --hide-scrollbars --window-size=1440,900 --virtual-time-budget=<ms> --screenshot=<png>`
  over `file:///E:/codex-prj/ab-worktrees/pi-matrix-r3/cell-j10-s09-b/evidence/evidence.html?stage=N`.
- Artifacts: evidence/shotA-firstscreen.png (ready), evidence/shotL-empty-drawer.png (empty drawer),
  evidence/shotB-gate-error.png (error state), evidence/shotK-keyboard-focus.png (selected journey row visible).
- Text cross-check via `--dump-dom` + Select-String: 偏差 0 / 步骤 1 / 门禁校验未通过 / 已记录 1 次偏差 all matched (4/4).
- Findings: ready = first screen synchronously actionable (no loading indicator exists in the app);
  error = inline gate-error block + deviation+1; empty = drawer empty-state copy;
  selected = read-only review view reachable from journey map.
- loading: structurally absent by design — no async path (data inlined, no build chain);
  frozen brief forbids a loading state as the measurable condition. SDIR 0.2 keeps the
  `loading` declaration per vocabulary contract and records the stance in unresolved u3-loading-absent.
- Captured: 2026-09-19 by implementation-arm.
