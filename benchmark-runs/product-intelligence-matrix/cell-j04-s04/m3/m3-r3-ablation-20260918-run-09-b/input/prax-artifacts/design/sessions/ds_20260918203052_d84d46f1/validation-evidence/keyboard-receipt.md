# Measurement receipt — keyboard

- check: `keyboard` (empirical, keyboard_accessibility)
- measured at: 2026-09-19T05:02+08:00 (local, UTC+8)
- method: Google Chrome 140 headless (`--headless=new --remote-debugging-port=9333`), driven by
  `scripts/evidence.js` over the Chrome DevTools Protocol; key presses dispatched as real
  `Input.dispatchKeyEvent` events (Tab ×3, Space, Escape); no synthetic DOM events.
- results (mirrored in `report.json` → `steps.keyboard` / `steps.paused` / `steps.emptyInspector`):
  - After Tab×3: `document.activeElement` is a `BUTTON.tile` with reachable name
    `aria-label="SKU 查询 P95 69 ms，正常"`; `:focus-visible` outline visible in `05-keyboard-focus.png`.
  - Space: stream paused — `#hb-label` = `PAUSED` (`07-paused.png`); filter/pause buttons keep native
    Space activation.
  - Escape: inspector closed, empty state visible — `insp-empty` shown (`03-empty-inspector.png`).
  - Enter: native button activation selects a tile (tiles are `<button type="button">`).
- artifacts: evidence/05-keyboard-focus.png, evidence/07-paused.png, evidence/03-empty-inspector.png
