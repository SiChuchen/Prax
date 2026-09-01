# Phase Report — 2026-09-01 (research v0.1 absorption: ADR-005, chain spec, program plan)

Per the main spec (`docs/Prax_Context_Evolution_and_Benchmark_Spec_v0.3.1.md`)
§42.5. Baseline at start: `bdaaf57` (routing vocabulary tolerance +
pre-sdir context revision) plus the then-untracked research document.
This is a planning round: no runtime code changed. Tests: **175/175
unchanged** (suite not run by this round; last green at baseline).

## What happened

| Item | Status | Evidence |
|---|---|---|
| Frontend Product Intelligence research v0.1 finalized | done (uncommitted at baseline) | `docs/Prax_Frontend_Product_Intelligence_Research_v0.1.md` — 120-sample wide corpus + deep cases; 18-step causal model (§34); SDIR vNext (§36); validation stack (§39); ECP representation architecture (§40–41); benchmark/A-B/inter-rater/saturation next-phase design (§43–46); stability grading (§48); asset classes (§51); intake protocol (§52) |
| External analysis: tt-a1i/archify design methodology | done | findings absorbed into spec §1, §5, §12: decision rights by determinability; quality as fail-able measured checks; executable diagnostics; convergence discipline (two-round stall rule); byte-bound frozen delivery; non-convertible claim layers; accreting named gates (Proof Lab 66→99) |
| External analysis: ECP canvas failure root causes | done | composition unowned, readability unmeasured, text-size guessed, readability fix unpublished — motivates measurement-first phasing |
| Direction decision | done | `docs/adr-005-product-intelligence-chain.md` — chain becomes session spine via extended gates (no new gates/tools); SDIR 0.2 additive; measured artifact validation; claims non-convertible; convergence protocol; advisory-born checks; knowledge restructure phase-gated; ECP pilot designated |
| Master spec | done | `docs/superpowers/specs/2026-09-01-product-intelligence-chain-design.md` |
| Program plan (phases 0–4) | done | `docs/superpowers/plans/2026-09-01-product-intelligence-chain.md` — Phase 0/1 task-level TDD; Phase 2 medium-detail with parallel tracks; Phase 3 medium; Phase 4 framework with binding scope + replan trigger |
| Subagent review of spec/plan | done | three reviewers (codebase facts / internal consistency / research fidelity); findings and applied revisions summarized in "Review revisions" below |

## Review revisions (2026-09-01, three-reviewer pass)

Reviewers: (a) codebase facts, (b) internal consistency/executability,
(c) research fidelity. One blocker, eleven major, and the applied fixes:

- **B-1 default-shell detection was unimplementable**: spec §6.3 now pins the
  mechanism — `SHELL_TERMS` word-boundary matching over named decision fields
  (`cards` matches the primitive directly; `dashboard`/`tabs`/`modal` are
  composition/disclosure/detail vocabulary, sourced to research §31.6/§9.2/
  §18/§10), plus `SHELL_MYTH_MAP` for decide-time myth surfacing (§7.3).
- Parallel-map hard conflicts serialized: A1→B1 (shared contracts.ts), all
  A2.x→A3 (runner imports every check), B3→B4 (shared service.ts), G1→G2
  (shared contracts.ts + gate-validation.ts), K1→K3 (shared knowledge.yaml).
- Convergence semantics pinned: first non-PASS evaluation sets the baseline;
  stall earliest at the third non-PASS (spec §5.6, plan B3, Gate 1 item 4).
- Promotion gate unified: zero-overkill on every runnable golden app
  (landing, dashboard, wizard), spec §5.3 / plan A3+F5 / this report aligned.
- Vocabulary pre-adjudication: research §36/§43 examples use `understand`
  and `architecture`, absent from the §3.1/§9.1 tables — admitted as the
  vocabulary's first amendments (19 verbs, 22 primitives, spec §6.1).
- Research-fidelity annotations added: information_shape enums and
  task_model four-field subset are spec-defined (§6.1/§6.2 notes); myth
  refutations rebut universality, not in-domain value (§7.3); knowledge
  `evidence.level` renamed `authority_initial` per D2/D5 semantics (§7.1).
- Code-fact fixes: playwright dependency location (wizard package.json,
  hoisted); knowledge 0.2 covers seed + expanded schemas and both version
  literals; myth routing exclusion acknowledged as existing behavior
  (router skips type=myth), migrated to asset_class layer; migration source
  is structured `scope`, not free-text `triggers`; `EVIDENCE_FILE_INVALID`
  added for unreadable declared receipts; receipt `ref` prefix enforced at
  schema layer.
- Density-linked font-size threshold lowering deferred (no runner input
  channel; spec §12 decision 11).
- Plan C1 task defined (end-to-end measured-validation demonstration) —
  Gate 1 items 2–4 land there.
- **User-directed addition (2026-09-01):** iteration loops made first-class —
  spec §5.7 loop contract + runtime-computed review-readiness standard
  (human review strictly downstream of machine gates), ADR-005 decision 9,
  candidate principle PRAX-P-045, new codes `MEASUREMENT_RECEIPT_STALE` /
  `REVIEW_NOT_READY`; divergence from Archify (no hard round cap) recorded
  with rationale.

## Key bindings the plan fixes (architect decisions, for executors)

- No new MCP tools, no new lifecycle gates (PRAX-P-024); the 18-step chain
  maps onto existing gates by payload extension (frame 0.2 / decide
  representation block / SDIR 0.2 / validate receipt channel).
- `prax-measure` is the first new package; receipt schema lives in
  prax-validator contracts as the single source shared by writer and
  verifier.
- Check catalog v0 fixed at seven ids, all warning-born except the two WCAG
  normative checks (error-born); promotion requires zero-overkill evidence
  on every runnable golden app (currently `apps/prax-landing`,
  `apps/prax-dashboard`, `apps/prax-wizard`) — the promotion gate is the
  runnable set, not the four-case discussion set.
- `SHELL_TERMS = dashboard | cards | tabs | modal` (word-boundary detection
  over named decision fields, spec §6.3) triggers a REVIEW
  justification rule at decide, never a BLOCK — negative knowledge mandates
  argumentation, not prohibition.
- Legacy compatibility: persisted 0.1 sessions and the sdir_delta light
  paths carry zero new obligations.

## Keep / Revise / Remove / Defer

- keep (unchanged): relationship three-layer, context manifest, persisted
  validation plan, context compilation, realization gate (still
  keep_provisional until second case per 2026-08-29 report), correction
  memory (keep_provisional / untested after MEM-001 cut)
- revise: validation evidence model — measurement receipts become the
  required content-verified channel for mapped empirical checks (AB-001
  class closes at BLOCK, superseding the warning-level fix)
- none removed
- defer (unchanged): Phase 8 implementation supervision (§21–23);
  Capability Registry; Registry/Community/Asset UX. New defers:
  Phase 4 empirical protocol detail — explicitly replanned after Phase 1–3
  evidence (spec §8.4); density-linked `type.min_projected_size` threshold
  lowering — dropped from v0, no runner input channel exists
  (spec §12 decision 11)

## Explicitly NOT decided here (honest boundary)

- Artifact checks measure layout/a11y/typography facts only. Taste,
  hierarchy quality, and representation fit remain assistive/human claims;
  no machine final adjudication was introduced anywhere.
- The measurement layer proves browser-observable facts; it does not prove
  the design is right. The A/B and empirical benchmark (Phase 4) are the
  outcome-layer instruments and remain to be built.

## Open operator items

1. User to confirm and commit the five new/changed documents (plan Task 0.1).
2. After Gate 1: decide whether the wizard/dashboard/landing calibration
   findings are defects to fix or check over-kill to tune — this choice feeds
   the first severity-promotion review (Phase 4 F5).
