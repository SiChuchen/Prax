# PRAX-PRICING-001 fixture (figma_first on penpot, live run, PASS)

Frozen outputs of the live acceptance run executed 2026-08-30 → 2026-08-31:

- session: `ds_20260830103431_85ce10c7` (existing_product + add_surface,
  web_desktop/react)
- agent: ZCode CLI (desktop), model `builtin:bigmodel-coding-plan/GLM-5.3-Flash`
- result: **PASS** — validation reached `COMPLETE`, 11/11 checks pass,
  zero warnings
- representation: figma_first, **provider `penpot`**
  (`official-mcp-2026-08`, self-hosted docker compose, port 9101) — the
  first non-Figma realization, switched mid-session per ADR-004 after the
  Figma Starter MCP quota wall; file `317f08f6-f8f6-8199-8008-8ffe053a4bd9`,
  page `PRAX-PRICING-001`, one board per SDIR region
  (`368337e1-…` ids in `realization-decision.yaml`)
- human review: **two rounds, both recorded with the stakeholder's own
  words** — round 1 **rejected** (「这里有问题」+ screenshot:
  penpot-editor rendering showed stray shapes covering the framing
  headline; root cause was residue from failed builds, not the approved
  design), round 2 **approved** (「这次确实可以」); full history in
  `representation-review.yaml`
- implementation: `apps/prax-landing/` pricing page (hash route
  `#/pricing`, header nav gains the pricing entry, native
  `details`/`summary` FAQ, `width:100%` on all auto-margin shell children
  per correction `corr-pricing-shell-width-stretch`)

## Layout

- `*.yaml` — session artifacts in gate order: requirement-confirmation →
  product-frame → existing-understanding → design-context → routing-log →
  design-decisions → screen.sdir → capability-gaps → realization-decision →
  representation-artifact → representation-review → implementation-brief →
  compiled-context (+ context-manifest / context-compilation-trace /
  validation-plan / validation-report / session)
- `rep-evidence/round-1/` — draft screenshots + `round1-user-feedback.png`
  (the stakeholder's rejection screenshot, sha256 in
  `representation-review.yaml` history)
- `rep-evidence/round-2/` — approved review screenshots, one per SDIR
  region; sha256 digests recorded in `representation-review.yaml` and the
  prepare realization block
- `rep-evidence/runtime/` — `pricing-full.png` (drift check, second
  artifact_ref), `home-full.png` (untouched-surface regression: home
  unchanged except the nav pricing entry), `faq-keyboard.png`

## Golden observations coverage

Every observation in `../requirement.md` holds: add_surface lifecycle
(existing understanding declared the landing surfaces; pricing entered
change_targets; `integration_plan` with alignment_points / neighbors /
implementation_order appeared in the prepare brief); router repeated the
accepted marketing-domain gap (PAT-APPLICATION-SHELL adopted with recorded
rationale, L1 inspections rejected the alternatives); figma_first propose
with all six §18.2 conditions — re-proposed for provider `penpot` after the
quota wall, same mode, no mode-flip reason; honest two-round stakeholder
loop with per-region screenshots; prepare ran only after submit_review
(existing_product ordering); the mid-chain `design_correct` correction
surfaced as a `correction_regressions` obligation in the validation plan
and was exercised live (width:100% verified in code + full-page screenshot);
keyboard check via native details/summary with Tab/Space trusted-input
verification plus the stakeholder's manual confirmation; drift carries
exactly two verified artifact_refs (approved screenshot, runtime snapshot).
