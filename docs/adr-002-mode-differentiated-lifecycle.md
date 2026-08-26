# ADR-002: Mode-Differentiated Lifecycle

Status: Accepted (2026-08-26)
Supersedes: none
Spec: `docs/superpowers/specs/2026-08-26-mode-differentiated-lifecycle-design.md`
Plan: `docs/superpowers/plans/2026-08-26-mode-differentiated-lifecycle.md`

## Context

Real-agent feedback showed the single ten-stage flow misfits most real work:
small visual changes were dragged through full derivation (the agent bypassed
Prax), and a whole-product redesign was forced into greenfield framing. The
`mode` field existed since v0 but only toggled one frame block.

## Decision

1. **Posture toward the existing system defines the mode**: `greenfield`
   (derive everything), `existing_product` (the existing system is
   authoritative), `rework` (the existing system is evidence and a migration
   boundary, never the authority for the solution).
2. **Change kind tunes depth inside existing_product**: `add_surface`,
   `modify_surface`, `visual_polish`, `defect_fix` expand into different gate
   sequences via a per-session `lifecycle_policy` snapshot; the state machine
   reads the policy instead of hard-coded phase tables.
3. **Requirement confirmation is the first gate for every session**: the agent
   submits `user_quote`, a restatement, non-empty out-of-scope boundaries, and
   a `confirmed_with_user` declaration — evidence, not synthesized fact.
4. **Existing/rework sessions pass a mode-specific understanding gate**:
   inventory + habits for existing; pain points plus
   preserve/replace/free-to-reconsider buckets (exclusive and covering) for
   rework.
5. **Modify sessions produce semantic deltas, not full SDIRs**; a delta that
   declares `capability_needs` splices the reconcile gate back in before
   prepare.
6. **Execution plans and validation checks assemble by policy**: integration
   plans, change sequences, migration plans; light paths validate hierarchy/
   readability/regression instead of SDIR conformance.
7. Tool count and names stay at ten; gates ride existing tools through
   payload dispatch (`design_start` union, `design_frame` three payloads,
   `design_sdir` delta mode).

## Compatibility

Legacy sessions (no policy field) normalize their recorded gate names
(`frame→framing`, `prepare_implementation→prepare`, `validation→validate`) and
run the original full chain with unchanged behavior.

## Deviations from the approved spec (declared in the plan)

- `add_surface` keeps the reconcile gate (a new surface can introduce
  capability gaps).
- Light paths replace — not extend — the universal check set, because
  semantic_conformance assumes an SDIR artifact.

## Consequences

- New `design_start` callers must supply a requirement confirmation (breaking,
  intended).
- Pre-policy YAML sessions resume unchanged; post-policy sessions are
  auditable per gate.
- Adding a mode or change kind means editing the policy table plus tests, not
  the state machine.
