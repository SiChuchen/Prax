# keyboard — receipt (INCONCLUSIVE — real-key journey not executed here)

Outcome: inconclusive. Implementation complete; executed evidence missing due to environment
(no shell/browser channel in this session — see product_model_alignment receipt).

Static basis:
- All 24 tiles are native <button type="button"> elements → Tab-reachable, Enter/Space activate (js/app.js buildGrid).
- Event-feed rows: tabindex="0" role="button" + Enter/Space keydown → select (js/app.js evNode).
- Esc closes the inspector; Space toggles pause when focus is on body (document keydown, js/app.js).
- Visible focus: :focus-visible { outline: 2px solid var(--focus) } (css/style.css).
- Filter button exposes aria-pressed; pause button exposes state via label ⏸/▶.

Scripted real-key journey (NOT yet executed): evidence/collect.ps1 step 8 launches a headed
browser window, sends OS-level TAB×3 + ENTER (→ tile focused → inspector opens) then ESC, saving
03-keyboard-selection.png / 03b-keyboard-closed.png. One command produces the evidence.
