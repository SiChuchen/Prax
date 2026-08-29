# PRAX-LANDING-001 fixture (figma_first live run, PASS)

Frozen outputs of the live acceptance run executed 2026-08-29:

- session: `ds_20260829074608_9cd15a9c` (greenfield, web_desktop/react)
- agent: ZCode CLI (desktop), model `builtin:bigmodel-start-plan/GLM-5.3-Flash`
- prax commit at run time: `a3681b4`
- result: **PASS** — validation reached `COMPLETE`, 8/8 checks pass,
  zero warnings (no gate bypasses, no agent self-attestation on the
  drift check)
- representation: figma_first, provider `figma`
  (`remote-mcp-2026-08`), file `FVsFvRYZyAWv0Z4JXO9tyZ`,
  frames `1:2`–`1:6`; human review **round 1 approved** by the
  stakeholder in-session (see `representation-review.yaml`
  human_decision evidence)
- implementation: `apps/prax-landing/` (Vite + React, static page)

## Layout

- `*.yaml` — session artifacts in gate order: requirement-confirmation →
  product-frame → design-context → routing-log → design-decisions →
  screen.sdir → capability-gaps → realization-decision →
  representation-artifact → representation-review → implementation-brief →
  compiled-context (+ context-manifest / context-compilation-trace /
  validation-plan / validation-report / session)
- `rep-evidence/round-1/` — approved review screenshots, one per SDIR
  region (workspace, hero, how-it-works, features, cta-close); sha256
  digests recorded in `representation-review.yaml` and the prepare
  realization block
- `rep-evidence/runtime/` — runtime snapshots: full-page workspace
  analog (drift check, second artifact_ref) and keyboard-focus capture
  (header CTA focus ring, Tab×3 from load)

## Golden observations coverage

Every observation in `../requirement.md` holds: region set covers
hero / value / features / CTA (+ pattern-contract `workspace`);
figma_first propose with all six §18.2 conditions; draft coverage check
passed with exact region→frame mapping; one human review round with
screenshot + human_decision provenance; prepare emitted the full
realization block and the compiled context carries the approved anchor;
the plan contains `design_representation_coverage` (deterministic) and
`representation_runtime_drift` (empirical, exactly two verified
artifact_refs: approved screenshot, then runtime snapshot).
