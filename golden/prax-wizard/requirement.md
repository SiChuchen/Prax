# Golden Case: Prax Benchmark Run Wizard (greenfield, direct_code realization)

## Requirement

Build the benchmark-run setup wizard for Prax operators: a three-step form
that configures an A/B replicate before execution. Step 1 "Target": pick the
surface under test (select), paste the requirement text (textarea, required,
max 4000 chars with live counter). Step 2 "Arms": choose arm A model and arm
B model from two dropdowns (must differ — inline error if equal), set
replicate count 1–6 (stepper, default 3), and toggle "blind review" (default
on, with a short consequence note when toggled off). Step 3 "Review": a
read-only summary computed from steps 1–2 and a primary action "Queue run"
(disabled until every step is valid), plus back-navigation that preserves
all entered values. Validation is per-step (Next is disabled with the first
error summarized inline); every field keyboard-operable with visible focus;
errors announced via aria-live; the wizard is resumable — state persists to
localStorage and a "resume draft" prompt appears on reload. States: step
transition is synchronous, but the queue action shows a submitting state
with a deterministic simulated outcome (success banner; no backend). Visual
tokens pinned like the dashboard (dark instrument-panel, compact); no chart,
no marketing copy.

Audience: the Prax operator preparing benchmark replicates. Tone:
instrument-panel; every label names a real artifact or field.

## Why this case fits direct_code (realization §18 analog)

Greenfield; visual language pinned (same token set as the dashboard);
utility form surface with strong established conventions (wizards are the
most patterned UI in existence); single-operator audience; the difficulty is
entirely in the state machine and interaction logic — the state_model
impact flag is the point, and functional assertions are fully deterministic
(FrontendBench-style interactive scenarios), not visual exploration.

## Golden observations (expected per gate)

- SDIR declares a real state model: per-step valid/invalid, submitting,
  success, resume-prompt; `changes_state_model` semantics live in a
  greenfield chain for the first time.
- design_realize propose → direct_code accepted before prepare; plan again
  carries no representation checks.
- Deterministic functional evidence (Playwright): full happy path
  keyboard-only; arm-equality inline error; Next disabled states per step;
  reload → resume prompt restores values; blind-review-off note appears.
- Accessibility evidence: aria-live error announcements observed; focus
  visible on every control; no keyboard trap.
- Validation reaches COMPLETE with zero warnings.

## Pass/fail

Pass = every observation holds; all functional assertions scripted and
green in a real browser; state persists across reload.
Fail = silent validation gaps, lost draft state, keyboard traps, or any
gate bypass.
