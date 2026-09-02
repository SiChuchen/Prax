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


---

# Phase 2 execution record — intermediate state structuring (2026-09-02)

Entry gate: Gate 1 passed. All tasks TDD; suite green at every commit.

| Task | Commit | Tests |
|---|---|---|
| S1 SDIR vocab tables + 0.2 union | `805998a` | sdir-02 (8) |
| G1 frame 0.2 (JTBD/object/task model) | `cf1caae` | frame-02 (5) |
| G2 decide representation rules | `b4eebec` | decide-representation (8) |
| S2 0.2 generation + render-leak on new fields | `d892dca` | sdir-02-lint (3) |
| V1 four structure checks | `1933155` | validator-structure-checks (4) |
| I1 MCP 0.2 payloads + drift cross-check | `7c5cfe9` | mcp-payload-02 (4) |
| I2 compiler sections | `a0bfb88` | compiler-02 (2) |
| I3 gate + legacy resume + docs | (this commit) | legacy-resume-02 (1) |

## Gate 2 evidence

1. Full suite green: 305/305 tests, 44 files (Phase 1 close: 270/36).
2. SDIR 0.2 round-trip: 0.2 parses with every §6.1 block; 0.1 unchanged;
   version 0.3 rejected; referential refinements (priority → region ids,
   state owners ∈ regions ∪ {session,url}) enforced at schema level.
3. Render-leak permeation: flexbox/px in representation.reason and "rounded
   corners" in acceptance are rejected by the recursive lint.
4. Decide rules matrix: DECISION_SHAPE_MISSING (EXPAND),
   DECISION_DEFAULT_SHELL_UNJUSTIFIED via `cards` type, word-boundary text
   (English + CJK synonyms; embedded "dashboarding" does not trigger),
   justification must name an information_shape variable,
   DECISION_NO_REJECTED_REPRESENTATION (WARN).
5. Flattened MCP payloads: frame/decide/sdir client schemas accept 0.2
   payloads with no nested union (AB-001 recipe); 0.1 sdir round-trips
   byte-identically; SDIR_REPRESENTATION_DRIFT fires on decide↔SDIR primary
   disagreement (REVIEW) and is a no-op on 0.1.
6. Legacy resume proof: a 0.1 session driven to validate, resumed by a
   fresh service instance from disk, completes with zero new obligations
   (no structure checks assembled); mapped-check receipt obligations
   predate 0.2 and are not new.
7. Doc sync: architecture.md (0.2 intent row, portfolio/state-ownership
   concept boundaries), this report.

## Phase 2 deviation ledger

1. **Serial order S1→G1→G2→S2→V1→I1→I2** instead of the parallel map's
   S1→S2 / G1→G2 tracks: S2's generate-0.2 consumes the G1/G2 payload
   blocks, so the dependency runs the other way for serial execution. No
   spec change.
2. **compiled-context section name `representation_portfolio`**: spec §6.4
   says "representation (portfolio + rejected)" but `representation` is
   already the figma_first realization section in CompiledContext — renamed
   to avoid the collision.
3. **FORBIDDEN_VALUE gained `roundeds+corners`**: plan S2 pinned the
   rejection test for "button uses rounded corners" while its note said
   "do not widen the forbidden lists" — the pinned test wins; minimal
   single-phrase addition, recorded here.
4. **runtime → prax-sdir dependency edge declared** (vocab constants):
   spec §6.1/§6.3 pin the vocabulary tables in prax-sdir while frame/decide
   gates (runtime) consume them. Workspace cycle with prax-sdir → runtime
   is declared but the file-level graph stays acyclic (runtime imports only
   `prax-sdir/vocab.js`, which imports nothing back).
5. **0.2 session detection**: spec says "0.2 会话" without pinning the
   marker; implemented as explicit `version: "0.2"` on the frame
   (chain head) for plan assembly, and on frame/decisions/sdir artifacts
   individually for their own gates. Blocks without the declaration are
   rejected.

Gate 2: **PASSED** (autonomous per user instruction 2026-09-02).


---

# Phase 3 execution record — knowledge asset restructure (2026-09-02)

| Task | Commit | Tests |
|---|---|---|
| K1 schema 0.2 both layers + migration | `9c9f473` | knowledge-02-migration (6) |
| K2 trigger-condition routing + myth exclusion | `2aa36ca` | router-triggers (4) |
| K3 eleven myth seeds + decide surfacing | `a7727d1` | decide-myth-surfacing (4) |
| K4 intake protocol + first-batch corpus | (this commit) | — |

## Gate 3 evidence

1. Full suite green: 319/319, 47 files (Phase 2 close: 305/44).
2. Migration round-trip: 23 entries parse as expanded 0.2 contracts;
   platform_convention → profile; reviewed (3) → B; vocabulary alignment
   through the pinned synonym tables (task_type 19-verb, density intent→
   facet); frozen 0.1 source kept at `knowledge.v0.1.yaml`.
3. Router regression: routing-vocabulary + runtime-and-routing suites
   green, live-run anchors intact (dashboard → PAT-DATA-EXPLORER at line
   423; canvas flows at 516/592); trigger-condition weighting is additive
   (lex specialis +2/facet) on top of unchanged hardScopeMismatch + score.
4. Myth quarantine: asset_class-layer exclusion; 11 myths never in default
   routing; SHELL_MYTH_MAP surfaces the matching myth id in the
   DECISION_DEFAULT_SHELL_UNJUSTIFIED REVIEW message.
5. Corpus: 20 entries from Appendix A rows 1-23, six-facet encoded,
   authority_initial C, review_by 2026-10-01; loader merges (54 total).
6. Doc sync: architecture.md knowledge row, docs/knowledge-intake-protocol.md
   (18 questions verbatim + stability rules), this report.

## Phase 3 deviation ledger

1. **Stability assignments are PROVISIONAL** — the plan reserves this as a
   human handoff (`stability-assignments.draft.yaml`, all confirmed: false).
   Under the user's autonomous-execution instruction the migration
   proceeded with reviewed→B / stable→A provisional grades; flipping any
   grade later is a one-line data change. **Open item for the user.**
2. **task_type/density vocabulary alignment tables** (browse→explore,
   inspect→review, trace/filter→locate, configure/administer→manage,
   compact→high, regular→medium, spacious→low) are pinned in the migration
   script — the 0.1 scope vocabulary predates the 19-verb table; spec §7.1
   does not enumerate the mapping. Recorded for review.
3. **Route-time facet contexts**: task/object from the 0.2 frame, density
   via inverse intent mapping, platform from context, phase fixed to
   "decision" (the router's consumer); representation cannot match at route
   time (decided after routing) — noted in router.ts.
4. **corpus entries use type product_evidence + asset_class representation**
   (the six legacy types are retained per spec; representation is an
   asset_class, not a legacy type).
5. knowledge-02-migration test pins the migration via the frozen 0.1 source
   (`knowledge.v0.1.yaml`) since the live file is already migrated.

Gate 3: **PASSED** (stability confirmation remains open for the user).


---

# Phase 4 execution record — empirical loop framework (2026-09-02)

Replan pair: `docs/superpowers/specs/2026-09-02-phase4-empirical-loop.md` +
`docs/superpowers/plans/2026-09-02-phase4-empirical-loop.md`.

| Task | Commit | Evidence |
|---|---|---|
| R1 replan docs | `41ce467` | spec+plan pair from Phase 1–3 evidence |
| F1 matrix + harness | `6a7d72d` | 15 cells (§43 verbatim) + run-cell.mjs; **smoke: cell-13 ran end-to-end against the dashboard build, 7/7 schema-valid receipt** filed under benchmark-runs/product-intelligence-matrix/cell-13/ |
| F2 A/B protocol | `4d4646c` | arms + 13 metrics (§44 verbatim), PRAX-AB-001 blind procedure, rubric-bias lesson recorded |
| F3 inter-rater + saturation | `e0eecc8` | §45 eight-field pilot procedure; saturation ledger seeded from §46 bands |
| F5 check promotion | `c53fa3a` | four checks warning→error (zero-overkill on landing/dashboard/wizard); type.min_projected_size stays advisory (§5.3 wins over the blanket rule) |
| G4 docs sync | (this commit) | this record + program ledger |

## Gate 4 status: PARTIAL at this write → **CLOSED** (2026-09-02 by the F4 pilot session; see docs/phase-report-2026-09-02.md)

1. ✅ Harness runs end to end on one matrix cell (cell-13 smoke).
2. ✅ A/B protocol written and reviewed.
3. ✅ Inter-rater pilot + saturation ledger framed.
4. ✅ F4 ECP cognition workspace pilot — executed 2026-09-02 by the
   operator-launched session: full 0.2 chain to COMPLETE, receipt 7/7,
   4-round convergence, fixture frozen + replay test (commit 483153b;
   details in docs/phase-report-2026-09-02.md).
5. ✅ Program ledger closed below.

## Program ledger close (ADR-005, phases 0–4)

- **keep**: measurement receipts as the empirical evidence channel (AB-001
  self-attestation gap closed at BLOCK); convergence stall rule as the sole
  convergence governor; vocabulary-as-versioned-constants; warning-born →
  zero-overkill → error promotion (first instance executed); flattened MCP
  payload recipe; corpus/myth knowledge separation.
- **revise**: none this program (all deviations recorded per-phase above).
- **remove**: none.
- **defer**: ECP pilot execution (F4, live session); 150-cell benchmark
  execution + A/B runs (next program); density-linked type-size threshold
  (needs a runner input channel); knowledge stability confirmation
  (provisional grades on record).
