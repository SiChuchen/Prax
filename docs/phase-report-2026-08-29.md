# Phase Report — 2026-08-29 (A/B closure, MEM-001 cut, figma realization path)

Per spec §42.5. Baseline at start: `b9a50ce` (end of the 2026-08-26 report).
Baseline at end: `8d18514` + this report. Tests: **172/172 passing** (16 files;
171 prior + golden-fixture replay), build green, main pushed to origin.

## Status per work-order item

| Item | Status | Evidence |
|---|---|---|
| A10 — PRAX-AB-001 replicates (6×, isolated worktrees) | done | `6995a3f`..`06c065c` run packages under `benchmark-runs/PRAX-AB-001/replicates/` (diffs, screenshots, transcripts, prax artifacts, summaries) |
| AB dual-blind review + unblind + Gate A–H | done | `fc21945`, `6f03f23` (locked scores, 67% label agreement, divergences one-notch consistent), `52ae87e` (comparison.yaml, findings.yaml, gates.md, blinding-map.yaml) |
| AB lessons absorbed into code | done | `8572616` (design_start anyOf schema wall — gap-mcp-anyof-schema), `ca9774d` (validator requires artifact_refs for empirical claims) |
| PRAX-MEM-001 defined, then cut after task 1 | done (closed) | `5b33653`, `f6d369f`; user decision 2026-08-28, `benchmark-runs/PRAX-MEM-001/CLOSURE.md` — experiment cycle too slow vs development pace; correction memory stays **keep_provisional / untested** (no R9 evidence) |
| Pivot: figma_first realization path | done | spec `9c66364` (subagent-reviewed r2), plan `baea8ab`+`f7e4fe7`, implementation `2635b20`→`a8bb8fc` (contracts, lifecycle v2 realize gate, validation, draft/review with evidence verification, compiled representation mapping, service, tests), ADR-003 `a3681b4` |
| PRAX-LANDING-001 live run (figma_first) | done, PASS | `e07a830`; session `ds_20260829074608_9cd15a9c`; Figma `FVsFvRYZyAWv0Z4JXO9tyZ` frames 1:2–1:6; human review **round 1 approved in-session** (human_decision provenance + 5 sha256-verified screenshots); prepare realization block complete; validation **COMPLETE 8/8, zero warnings**; drift evidence exactly two verified artifact_refs; frozen into `golden/prax-landing/fixture/` |
| Golden fixture replay regression test | done | `8d18514`; `tests/prax-landing-fixture.test.ts` — regenerated SDIR deep-equals frozen artifact with matching contentDigest; screenshot digests match review record; anchors match; suite 171→172 |
| Research snapshot gap (A2 flag) | closed | `Prax_MegaPrompt_Insights.md` located at workspace root, backfilled into `research/upstream/` with sha256; manifest `missing:` section emptied |

## AB-001 headline results (see review/ for full detail)

Process effect replicated 3/3: every Prax-arm run produced a complete,
auditable pre-implementation design record and none abandoned the flow.
Outcome labels (R1–R7) show no directional arm difference at this rubric
granularity — cross-arm comparison INCONCLUSIVE at n=3; evidence ceiling
L2_replicated_implementation. Known rubric bias: blind scoring structurally
under-credits the Prax arm (rationale lives in .prax artifacts, excluded from
blind bundles). Gates A–H recorded with provisional dispositions; second
benchmark (B6/B7) still required before schema stabilization.

## Keep / Revise / Remove / Defer (updated with first live realization evidence)

- keep: relationship three-layer, context manifest, persisted validation
  plan, context compilation — all consumed by the landing run; no harm signals
- keep_provisional: correction memory (untested after MEM-001 cut); **new:
  realization gate (ADR-003)** — one live figma_first case, n=1; direct_code
  has service-test coverage but no live case yet
- defer (unchanged): Phase 8 implementation supervision (§21–23) — note: the
  landing run produced the first real drift-evidence artifacts, so the
  recorded precondition for revisiting Phase 8 now exists in sample size 1;
  Capability Registry (Phase 9+); Registry/Community/Asset UX (§25–34)
- none removed

## Explicitly NOT implemented (unchanged from 2026-08-26 report)

Registry/Community/Asset UX (§25–34); implementation supervision & controlled
re-entry (§21–23); statistics beyond directional language.

## Open operator items

1. ~~`primary-cta-destination` unresolved~~ **resolved 2026-08-29** (session
   `ds_20260829190800_0ced9700`): CTA wired to
   `https://github.com/SiChuchen/Prax` (new tab) — the project repository is
   the only real destination; surrogate decision recorded in the
   requirement-confirmation evidence chain. Validation COMPLETE 5/5, zero
   warnings; full modify_surface chain live-confirmed as
   confirm→understanding→route→decide→sdir_delta→prepare→validate with no
   realize gate.
2. Figma account cleanup (manual, no MCP delete API): drafts file “Prax MCP
   写权限测试（可删）” and aborted-attempt file `22WgXGAA7q2I6aOQFp5lCa`.
3. Optional: lightweight correction-memory probe design (MEM-001 H4) without
   rerunning the full pair experiment.
4. direct_code realization gate still live-untested: it exists only in
   full-SDIR chains (greenfield/rework/add_surface); both existing-product
   lifecycles skip the realize gate by design. A greenfield direct_code case
   is queued in the harder-page golden set (golden/README.md).

## Second realization-path case (2026-08-29, same session)

Existing-product defect_fix executed live: session
`ds_20260829184622_a50704d0` — favicon 404 on apps/prax-landing (recorded
defect, item 2 above, now fixed). Lifecycle exercised the paths that had only
service-test coverage: existing_product start with task-brief-backed
confirmation, existing_understanding frame, intent_lite (twice refined after
LIFECYCLE_KIND_MISMATCH lint correctly rejected structural phrasing),
correction memory loading (`.prax/corrections.yaml` header-collapse correction
surfaced and correctly scoped out), and the collapsed defect_fix validation
plan (regression_check + requirement_alignment only — no route/decide/sdir/
realize gates by design). Fix: `public/favicon.svg` (ink token monochrome) +
one `<link rel="icon">` declaration; zero approved-region changes. Verified
in the production build: console 0 errors, only `/favicon.svg` requested
(200), full page unchanged, suite 172/172. Validation **COMPLETE 2/2, zero
warnings**.

## Third live case: CTA destination via modify_surface (2026-08-29, same session)

Session `ds_20260829190800_0ced9700` resolved the recorded
`primary-cta-destination` through the full modify_surface chain: existing
understanding (with the live-confirmed change-target-to-surface referential
check), routing (PAT-APPLICATION-SHELL now the sole, semantically fitting
routed pattern), L1 inspection, decision with vocabulary-checked references,
sdir_delta (behavior_intent only — the render-leak lint correctly rejected
free-form field names), prepare with the five-check modify validation plan,
and evidence-backed evaluation to **COMPLETE 5/5, zero warnings**. All three
CTAs verified in-DOM (href/target/rel), page visually unchanged, suite
175/175. Lifecycle finding recorded: modify chains contain no realize gate,
so direct_code propose remains live-untested pending a full-SDIR case.

## Fourth live case: PRAX-DASHBOARD-001, direct_code (2026-08-30)

Session `ds_20260830045528_df52c3d8` closed the last realization-coverage
gap: greenfield with **direct_code propose accepted before prepare** (three
of four conditions honestly false — only mature_design_system holds; the
direct_code path declares and records, it has no eligibility predicate).
The prepare brief carries only `{mode: direct_code}` in its realization
block and the validation plan contains **no representation checks**
(design_representation_coverage / representation_runtime_drift are
figma_first-only) — both golden observations verified live. The KB routed
at high confidence to **PAT-DATA-EXPLORER** (first live match of the
data-exploration domain; its semantic component contracts
DATA-SURFACE / FILTER-CONTROLS / CONTEXTUAL-DETAIL surfaced in the brief),
and the plan gained data-explorer-specific checks (filter_state,
comparison_scan). Reconcile recorded the first live capability **gap**
(n4-export, explicit compromise). Implementation: `apps/prax-dashboard/`
(dark instrument panel, compact density — first non-spacious case; four
honest states reachable via ?forceError=1 / ?slow=1 seams and an empty
filter; SVG bar chart without a chart library). Playwright evidence:
loading/empty/error/selected screenshots, real-keyboard walkthrough
(:focus-visible verified per stop, Enter selects), sort/filter DOM
assertions. Suite 175/175. Validation **COMPLETE 8/8, zero warnings**.
Note: the mid-chain design_correct probe could not run through MCP in this
session (the tool shipped after this MCP connection started); the write
path plus scoped-obligation behavior is covered by
tests/correction-ingestion.test.ts and needs only an MCP reconnect to use
live.

## Next phase preconditions

1. ~~Second realization case, exercising the paths that are service-tested but
   not live-proven~~ **done 2026-08-29** (see "Second realization-path case"
   above); remaining live-coverage gap narrowed to the direct_code realize
   gate inside a modify_surface/greenfield case (item 4 above).
2. Cross-case review per Gate D before treating the realization gate as stable.
