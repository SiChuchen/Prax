# Measurement receipt — keyboard

- Method: driver stage=10 programmatically focuses the journey-map current-step button
  (a native `<button>`), then headless Chrome screenshot (same flags as state-completeness receipt).
- Artifact: evidence/shotK-keyboard-focus.png — a 2px `:focus-visible` outline is clearly visible
  around the journey step row.
- Keyboard semantics (implementation): all interactive controls are native button/checkbox
  (Tab reachable, Enter/Space operate); journey rows are buttons; Esc closes the confirm modal and
  the record drawer; Tab is trapped inside the confirm modal; the confirm button enables only after
  the acknowledgement checkbox is checked.
- Captured: 2026-09-19 by implementation-arm.
