# Phase Report — 2026-08-26 (A0–A9 pre-A/B work order)

Per spec §42.5. Baseline at start: `b0af8d4` (spec-declared applicable base).
Baseline at end: `b9a50ce`. Tests: **127/127 passing** (8 files), build green.

## Status per Appendix A item

| Item | Status | Evidence |
|---|---|---|
| A0 read spec + repo + confirm baseline | done | HEAD matched spec baseline `b0af8d4` exactly |
| A1 freeze baseline + A/B protocol + harness rules | done | `benchmarks/architecture-canvas-ab/` (6 files: benchmark.yaml, requirement.md, protocol.md, rubric.yaml, environment-policy.yaml, known-limitations.md) |
| A2 versioned research snapshot | done | `research/upstream/` — 17 files + `manifest.yaml` with sha256, release `research-2026-08-26`. **`Prax_MegaPrompt_Insights.md` not on this machine** (flagged; insights already absorbed into spec §12+) |
| A3 docs normalization + Principle Registry | done | `docs/principle-registry.md` (40 principles, three statuses); constitution.md now points at the registry; architecture.md gains concept boundaries + new artifact layout |
| A4 relationship three-layer | done | commit `3a1bffa`: product relationship ids/direction/meaning/opaque condition/importance + referential/self-loop/duplicate validation; `current_relationships` on understanding; derived-frame preservation; SDIR region ids + duplicate detection; `tests/relationship-layers.test.ts` (13) |
| A5 Context Manifest v0.1 | done | commit `fafcbd6`: runtime-owned derivation at route/intent time, capability status, digests, staleness; `tests/context-manifest.test.ts` (7) |
| A6 persisted validation plan | done | commit `c82a503`: `validation-plan.yaml` revision-locked at prepare/intent, brief cites revision, validate consumes persisted plan, re-derive on upstream change with auditable history, profile/facet fields; `tests/validation-plan.test.ts` (5) |
| A7 correction memory | done | commit `25bf630` + fix `b9a50ce`: project-root `.prax/corrections.yaml`, supersede, surface scoping, regression obligations in validate, no fabrication; `tests/correction-memory.test.ts` (6) |
| A8 minimal context compilation | done | commit `192a0d7`: compiled-context + trace at prepare/intent; `tests/context-compilation.test.ts` (5) |
| A9 execution evidence capture | done | commit `f580e0a`: `benchmark-runs/PRAX-AB-001/` scaffold (experiment manifest, prax-lock template, replicate schema, review/lessons) + operator runbook with Gate A–H checklist |

Environment: ecp restored at `E:\codex-prj\ecp\engineering-control-plane`
(bundle verified, `npm ci`, build pass); Prax installed globally via npm link
(`prax doctor` PASS; stdio MCP handshake verified).

## Keep / Revise / Remove / Defer (provisional, pre-evidence)

- keep_provisional: all five P0 primitives (A4–A8) — no run evidence yet
- defer: Implementation Supervision / drift (Phase 8), Capability Registry
  (Phase 9+), user/org assets (Phase 11+), Evidence Status (Phase 12),
  contribution/registry (Phase 13)
- none removed; no harm signals observed pre-run

## Explicitly NOT implemented (long-term spec sections)

Registry/Community/Asset UX (§25–34) — gated on Phase 9+; implementation
supervision & controlled re-entry (§21–23) — Phase 8, after real drift
evidence; PRAX-MEM-001 cross-session memory benchmark — Phase 7B, after the
main A/B; statistics beyond directional language — never at this sample size.

## Unresolved questions for the operator

1. Which agent CLI runs the arms (fills prax-lock `agent.*`)?
2. `Prax_MegaPrompt_Insights.md` original — obtainable? (manifest records it missing)
3. Push `b0af8d4..b9a50ce` to origin — awaiting user confirmation.

## Next phase preconditions (A10 — the run itself)

1. Fill `prax-lock.yaml` + `experiment-manifest.yaml` (digest, commits, model).
2. Create `E:\codex-prj\ecp\ab-worktrees`, run 6 replicates per runbook §2.
3. After packaging: blinded review per §4, then hand to a review session with
   the Gate A–H checklist.
