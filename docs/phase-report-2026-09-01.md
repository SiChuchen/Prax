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

---

# Phase 1 execution record — measured artifact-validation layer (2026-09-02)

Baseline: `0c8c321` (Task A1). All Phase 1 tasks executed TDD
(failing test → implement → green → commit); `npm test` green at every
commit boundary; landing golden replay green throughout.

## Task ledger

| Task | Commit | Tests added |
|---|---|---|
| 0.2 principle registry P-041..P-045 | `de56ba7` | — |
| A1 receipt schema + catalog constants | `0c8c321` | measurement-receipt (3) |
| A2.1 layout.overflow | `7503ea6` | measure-layout.overflow (3) |
| A2.2 layout.responsive_collision | `435b262` | measure-layout.responsive_collision (3) |
| A2.3 text.truncation | `62458fa` | measure-text.truncation (3) |
| A2.4 a11y.contrast | `579c5b1` | measure-a11y.contrast (3) |
| A2.5 a11y.focus_order | `2d8d129` | measure-a11y.focus_order (3) |
| A2.6 a11y.target_size | `ed1a391` | measure-a11y.target_size (3) |
| A2.7 type.min_projected_size | `fabf580` | measure-type.min_projected_size (3) |
| A3 runner + CLI + atomic receipt writer | `f5dfd53` | measure-runner (2) |
| B1 contracts: map + provenance | `179fb41` | artifact-evidence-contracts (5) |
| B3 convergence protocol | `6ea8d7d` | validation-convergence (3) |
| B2 artifact-evidence verification | `05ac999` | artifact-evidence (12) |
| B4 evaluation wiring + readiness | `203ae68` | validate-measurement (4) |
| C1 e2e + replay fixture + this record | (this commit) | validate-measurement-e2e (5), measure-receipt-replay (2) |

## Calibration record (Task A3 Step 5 + C1 Step 1, zero-overkill evidence)

Runner executed against production builds of every runnable golden app at
1280x860. Every receipt parses against `MeasurementReceiptSchema`.

| App | Receipt summary | Findings triage |
|---|---|---|
| prax-wizard | 6 pass / 1 fail (warnings=1) | `type.min_projected_size` min 11px (field labels, counters, notes) — **real advisory finding**, warning tier; density-linked threshold deferred per spec §12 decision 11 |
| prax-dashboard | 7 pass / 0 fail | clean after over-kill fix |
| prax-landing | 6 pass / 1 fail (error=1) → **7 pass / 0 fail after fix** | `a11y.target_size` — two `nav.shell-nav` links at 19.5px height — real WCAG 2.2 AA 2.5.8 defect; **fixed 2026-09-02** (24px nav hit area, re-measured 7/7, commit follows this record) |

Over-kill false positives found and fixed during calibration (each now has a
fixture regression case):

1. `.sr-only` clip-pattern text (1px box) was flagged by element-level
   `layout.overflow` and `text.truncation` (dashboard) — sub-pixel boxes are
   assistive-tech text, never rendered content; fix scans skip boxes ≤ 1px
   (also applied to `a11y.contrast` for hygiene).
2. `tabindex="-1"` programmatic focus anchors (wizard step headings) were
   flagged by `a11y.target_size` — WCAG 2.5.8 covers pointer-activatable
   targets, not focus anchors; fix exempts `tabindex="-1"`.

Residual false-positive risk (subagent-style honest notes, for the F5
promotion review):

- `a11y.focus_order` detects indicators via outline/box-shadow only;
  border-change indicators are a known false-negative direction (not
  over-kill).
- `a11y.contrast` resolves background via the ancestor chain; gradients and
  background images degrade to the nearest opaque color (approximation, both
  directions possible).
- `layout.overflow` element scan relies on `scrollWidth > clientWidth + 1`;
  intentional scroll containers (`overflow: auto` with visible affordance)
  may need an explicit exemption class in a later catalog revision.

## Deviation ledger (plan ↔ as-executed)

1. **A2.1–A2.7 executed serially by the orchestrating agent, not parallel
   subagents.** Seven parallel subagents were dispatched per the plan's
   parallelization map; the account hit API rate limits (429) and two agents
   died mid-read with no files written; the remaining five were stopped and
   the checks implemented serially under the same TDD discipline and per-task
   commits. No spec deviation — execution-mode only.
2. **Check file naming uses catalog ids verbatim** (`layout.overflow.ts`),
   not the dashed names in spec §10 (`layout-overflow.ts`). The plan's Task
   A2 block and the user-issued subagent template pin `<id>.ts`, and Task A3
   references the fixture as `layout.overflow.html` — dot form followed for
   consistency with the plan's pinned paths.
3. **`ValidationFinding.provenance` semantics for deterministic findings**:
   spec §5.4 defines the field for empirical claims (measured = verified
   receipt; attested = self-claim). Deterministic machine-computed findings
   (SDIR checks, adjudicator) are labeled `measured` — machine-computed from
   gated artifacts, never agent self-claims; empirical findings default
   `attested` until receipt-backed.
4. **Golden e2e flows augmented with receipts** (service-e2e, landing
   fixture replay, adjudication completes, realization-e2e): mapped checks
   claiming pass now require receipt coverage (spec §5.4 rule 3), so each
   flow attaches a valid receipt before evaluate. The landing replay's
   frozen bytes and golden digests are untouched; the receipt attaches as a
   new evidence file and the frozen evidence object replays unmodified.
5. **`prax-measure` tsconfig gains `"lib": ["es2023", "dom"]`** — evaluate
   callbacks run in browser context and need DOM globals; not foreseen in
   the plan's "tsconfig matching sibling packages".
6. `type.min_projected_size` records `min_font_px` even on pass (honest
   measurement, not only the failing minimum).

## Gate 1 status

See "Gate 1 evidence" below (added by Task 1.6).

## Gate 1 evidence (Task 1.6, 2026-09-02)

1. **`npm test` green including all new files**: 270/270 tests, 36 files
   (baseline 216/22 at Phase 0 close; +54 tests across 14 new files).
2. **Runner on real builds of every runnable golden app**: receipts parse
   against `MeasurementReceiptSchema` — wizard 6/1 (advisory type size),
   dashboard 7/0, landing 6/1 (real WCAG 2.5.8 nav target-size defect);
   frozen wizard receipt + PNG replay byte-identically
   (`tests/measure-receipt-replay.test.ts`).
3. **Contradiction demonstration**: doctored receipt (`layout.overflow` fail)
   + claimed pass → BLOCK `VALIDATION_MEASUREMENT_CONTRADICTION`, at unit
   level (artifact-evidence case 5) and service level
   (validate-measurement case 2, validate-measurement-e2e case 2).
4. **Convergence stall**: baseline + two non-improving rounds (three
   non-PASS total) → REVIEW `VALIDATION_CONVERGENCE_STALLED`, gate stays
   open (fourth call accepted), stall event in session warnings, unresolved
   list runtime-filled into `readiness.convergence`
   (validation-convergence, validate-measurement-e2e case 3).
5. **Skipped ≠ passed**: skipped-with-reason satisfies coverage, findings
   stay `attested` + downgrade warning, `claims.skipped` listed separately;
   >50% catalog skipped → REVIEW for environment confirmation
   (artifact-evidence cases 7a/7b, validate-measurement-e2e case 4).
6. **Doc sync**: architecture.md (validation row, `validation-evidence/`
   persistence, two-prefix evidence containment, readiness concept
   boundary), README.md (prax-measure package row + capability paragraph),
   this report.

Gate 1: **PASSED and confirmed by the user (2026-09-02)**. The landing
nav target-size defect was fixed per user instruction (24px hit area,
re-measured 7 pass / 0 fail). Remaining open item: severity-promotion
review timing (Phase 4 F5 — the wizard type-size advisory and calibration
record feed it).
