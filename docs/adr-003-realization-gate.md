# ADR-003: Realization Gate and the Eleventh Tool

Status: Accepted (2026-08-28)
Amends: ADR-002 decision 7 ("Tool count and names stay at ten")
Spec: `docs/superpowers/specs/2026-08-28-figma-realization-design.md`

## Context

The figma_first realization path needs a decision point between SDIR and
implementation, plus draft/review submissions that do not belong to any
existing tool's semantics. Provider integration (Figma today, other
representation providers later) made a dedicated tool cleaner than widening
`design_prepare_implementation` into a dual-purpose tool.

## Decision

1. Add `design_realize` as the eleventh tool with three payload modes:
   propose, submit_draft, submit_review.
2. Add the `realize` gate (phase REALIZATION), dynamically spliced between
   reconcile and prepare by `propose(figma_first)` and removed again on an
   unapproved flip to direct_code. Policy default tables are unchanged.
3. Lifecycle policies move to version 2 for new sessions. Realization
   enforcement (REALIZATION_REQUIRED at prepare) applies to v2 full-SDIR
   sessions only; persisted v1 sessions resume with their original behavior.
4. Figma enters as a versioned entry in a static provider table
   (`REALIZATION_PROVIDERS`); core schemas and methodology stay
   provider-agnostic (payload fields are `provider_refs`). The table declares
   supported adapters, not runtime availability — Prax never connects to
   Figma; agents do, via MCP. Provider failure is an escape hatch, not a
   dead end: re-propose direct_code removes the gate and abandons the
   artifact.
5. Approval binds evidence, not identifiers alone: SDIR content digest at
   propose/review, server-computed screenshot sha256, region coverage, and
   round-scoped screenshot directories. The residual risk (same-node edits
   in Figma) is covered by the `representation_runtime_drift` check (two
   verified artifact_refs: approved review screenshot + runtime snapshot
   under the session evidence root) and documented as a known limitation.

## Consequences

- The ten-tool contract from ADR-002 is superseded; future capability tools
  are judged by responsibility boundaries, not a fixed count.
- `design_validate` gains a deterministic fail-closed coverage check and a
  two-sided empirical drift check for figma_first sessions; validation plan
  digests now include the SDIR and the three realization artifacts.
