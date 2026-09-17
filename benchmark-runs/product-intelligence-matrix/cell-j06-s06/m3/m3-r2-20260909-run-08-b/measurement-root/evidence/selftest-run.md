# Selftest run log — keyboard contract measurement

- Date: 2026-09-16 (session ds_20260915182037_d4ba5123, cell-j06-s06-b)
- Browser: Microsoft Edge headless (`--headless=new`), Chromium engine, real render + JS execution
- Delivery mode: `file:///E:/codex-prj/ab-worktrees/pi-matrix-r2/cell-j06-s06-b/index.html` (static open, no server)

## Command

```
msedge --headless=new --allow-file-access-from-files --disable-gpu --hide-scrollbars ^
  --no-first-run --user-data-dir=%TEMP%\edge-hl-j06c ^
  --window-size=1680,1050 --screenshot=evidence\01-initial.png ^
  --virtual-time-budget=5000 ^
  "file:///E:/codex-prj/ab-worktrees/pi-matrix-r2/cell-j06-s06-b/index.html?probe=1&selftest=1"
```

## Measurement procedure

`?selftest=1` executes `runSelfTest()` inside the loaded page (app.js). The keyboard
part dispatches real `KeyboardEvent("keydown")` events on `document` and asserts the
resulting application state:

1. `ArrowRight` → selection advances to the chronologically next change set (c16 → c17)
2. `ArrowLeft` → selection returns to the previous change set (c17 → c16)
3. `Escape` → selection cleared, detail panel enters the empty state (`selectedId === null`)

The page writes results into the on-page probe bar (`#boot-status`, visible with
`?probe=1`), captured in `evidence/01-initial.png` (bottom green bar).

## Observed output (verbatim from probe bar in evidence/01-initial.png)

```
SELFTEST PASS 13 checks :: PASS forward_only_links | PASS state@incident_gateway_status |
PASS state@before_incident_gateway_status | PASS state@c18_gateway_replicas |
PASS state@end_gateway_breaker(add_op) | PASS state@end_one_click_buy |
PASS state@q2_start_dedup | PASS state@after_c02_dedup |
PASS detail_before_same_fold_source | PASS nodes_rendered | PASS edges_rendered |
PASS keyboard_right_then_left | PASS keyboard_escape_empty_state
```

## Result

- `keyboard_right_then_left`: PASS
- `keyboard_escape_empty_state`: PASS
- Total: 13/13 checks PASS in a real browser render.
