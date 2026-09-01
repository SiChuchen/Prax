# Product-Intelligence Chain + Measured Artifact Validation — Program Plan

> **STATUS (2026-09-01): PLANNED, pending subagent review.** Phase 0/1 are task-level executable; Phases 2–4 are gated milestones with explicit replan triggers. Do not start Phase 2+ tasks before the prior phase gate passes.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Tasks marked **∥** are mutually independent and may run in parallel under separate agents; tasks marked **→** block the tasks they point to.

**Goal:** Implement ADR-005: structure the product-intelligence intermediate states (frame/decide/SDIR 0.2), build the measured artifact-validation layer (`prax-measure` + validator receipt integration + convergence protocol), restructure knowledge assets, and gate each phase on tests plus live evidence.

**Architecture:** No new MCP tools, no new lifecycle gates (PRAX-P-024). The 18-step research chain maps onto existing gates by extending payloads. Measurement is a new leaf package that shares its receipt schema with the validator (single schema source). Quality checks are born at warning level and promoted to error after zero-overkill evidence on golden cases.

**Tech Stack:** TypeScript (tsc -b), zod, vitest (`npm test` = build + vitest run), Playwright (declared in `apps/prax-wizard/package.json` and hoisted via npm workspaces — prax-measure declares its own dependency per Task A1), YAML artifact store.

**Spec:** `docs/superpowers/specs/2026-09-01-product-intelligence-chain-design.md` (authoritative; sections cited as §N). **ADR:** `docs/adr-005-product-intelligence-chain.md`.

**Conventions:** Commit style follows repo (`feat(scope): …`, `test(scope): …`, `docs: …`). Never push without user confirmation. Tests live in root `tests/`. All commands run from repo root `E:\codex-prj\Prax\Prax`. Every phase ends with the full suite green + golden fixture replays + the phase's doc-sync tasks.

---

## Phase 0 — Contract absorption (docs only)

**Gate 0 exit criteria:** ADR-005 + spec + this plan pass subagent review and are revised; the research doc is committed; no code changed.

### Task 0.1: Commit the research base and decision documents

**Files:**
- `docs/Prax_Frontend_Product_Intelligence_Research_v0.1.md` (currently untracked)
- `docs/adr-005-product-intelligence-chain.md`
- `docs/superpowers/specs/2026-09-01-product-intelligence-chain-design.md`
- `docs/superpowers/plans/2026-09-01-product-intelligence-chain.md`
- `docs/phase-report-2026-09-01.md`

- [ ] **Step 1:** Verify the working tree contains only the intended new docs: `git status --short`
- [ ] **Step 2:** **Ask the user for confirmation, then commit** (git mutations require explicit user confirmation):

```bash
git add docs/Prax_Frontend_Product_Intelligence_Research_v0.1.md docs/adr-005-product-intelligence-chain.md docs/superpowers/specs/2026-09-01-product-intelligence-chain-design.md docs/superpowers/plans/2026-09-01-product-intelligence-chain.md docs/phase-report-2026-09-01.md
git commit -m "docs: frontend product intelligence research v0.1 + ADR-005 + chain spec/plan + phase report"
```

### Task 0.2: Principle registry candidate additions

**Files:**
- Modify: `docs/principle-registry.md`

- [ ] **Step 1:** Append five `candidate` rows (promotion rules unchanged; these are NOT promoted by this plan):

```text
| PRAX-P-041 | candidate | Representation is a decided portfolio (primary + supporting + rejected) before implementation; the default shell is never assumed. |
| PRAX-P-042 | candidate | Interaction state has explicit owners; selection, preview, inspector, viewport, and query ownership are declared, not emergent. |
| PRAX-P-043 | candidate | Where a quality claim is machine-measurable, measured evidence outranks attestation; skipped is not passed. |
| PRAX-P-044 | candidate | Every feature declares its complexity budget; new permanent surfaces, modes, and state owners are counted, not assumed free. |
| PRAX-P-045 | candidate | Human review runs downstream of machine gates: a review request carries a runtime-computed readiness packet stating what was measured, attested, and skipped — humans never adjudicate what machines already failed. |
```

- [ ] **Step 2:** Verify no other document duplicates these principles (registry is the single source of truth).
- [ ] **Step 3:** Commit (after user confirmation): `docs: candidate principles P-041..P-045 (P-041..44 from research v0.1; P-045 from the 2026-09-01 loop-contract decision)`.

---

## Phase 1 — Measured artifact-validation layer

**Gate 1 exit criteria (all required):**
1. `npm test` green including the new test files listed below.
2. The runner produces valid receipts on real builds of every runnable golden app — currently `apps/prax-landing`, `apps/prax-dashboard`, `apps/prax-wizard` (Task C1 Step 1).
3. A contradiction demonstration test exists and passes: a doctored receipt containing `status: fail` plus an evidence item claiming `pass` → evaluation BLOCK with `VALIDATION_MEASUREMENT_CONTRADICTION` (Task B2 item 5 at unit level; Task C1 Step 2 at service level, including the `REVIEW_NOT_READY` readiness assertions).
4. Convergence stall demonstration: baseline first non-PASS + two consecutive non-improving evaluations (three non-PASS rounds total) → REVIEW with `VALIDATION_CONVERGENCE_STALLED`, gate not locked (a further `design_validate` call is still accepted) (Tasks B3 + C1 Step 2).
5. A receipt replay fixture test exists and passes (Task C1 Step 3), and skipped-with-reason is asserted to satisfy coverage while remaining `attested` — never displayed as `measured` (Task B2 item 7, C1 Step 2).
6. Doc sync (Task 1.6) landed.

### Parallelization map (Phase 1)

```text
Track A (prax-measure package):   A1 → (A2.1 … A2.7 mutually independent ∥,
                                        one agent per check, disjoint files) → A3
Track B (validator/runtime):      A1 → B1 → B2 ──────────→ B4
                                       B3 ∥ B2 ──────────┘   (B4 waits for BOTH
                                                               B2 and B3: B3 and B4
                                                               both touch service.ts)
Integration:                      C1 (needs A3 + B4) → 1.6 doc sync → Gate 1 review
```

Serialization notes (do not relax): A1 precedes B1 (B1's `CHECK_MEASUREMENT_MAP` types import `ArtifactCheckId` from A1, same file `prax-validator/contracts.ts`). All A2.x precede A3 (the runner statically imports every check; A3's fixture `layout.overflow.html` is owned by A2.1). G1→G2 and K1→K3 rules appear in their own phases.

### Task A1: Package scaffold + shared receipt schema

**Files:**
- Create: `packages/prax-measure/package.json`, `packages/prax-measure/tsconfig.json`
- Modify: root `package.json` workspaces if needed (verify `packages/*` glob already covers it), root `tsconfig` references
- Modify: `packages/prax-validator/src/contracts.ts` (receipt schema — **the single schema source**)
- Test: `tests/measurement-receipt.test.ts` (new)

- [ ] **Step 1: Write the failing test**

```ts
// tests/measurement-receipt.test.ts
import { describe, expect, it } from "vitest";
import { MeasurementReceiptSchema } from "prax-validator";

const validReceipt = {
  receipt_version: "0.1",
  tool: { name: "prax-measure", version: "0.1.0" },
  target: { app_root: "apps/prax-wizard", base_url: "http://localhost:4175/", build_ref: null },
  run_at: "2026-09-01T00:00:00.000Z",
  viewport_matrix: [{ width: 1280, height: 860, label: "desktop" }],
  checks: [
    {
      id: "layout.overflow",
      status: "fail",
      severity: "warning",
      subject: "document.documentElement",
      measured: { scroll_width: 1294, inner_width: 1280, overflow_px: 14, viewport: "1280x860" },
      threshold: { max_overflow_px: 0 },
      evidence_refs: [{ ref: "validation-evidence/overflow-1280.png", sha256: "a".repeat(64) }],
      supported_fixes: ["find the widest row via the outlined subject and remove the fixed-width cause"],
    },
  ],
  summary: { pass: 0, fail: 1, skipped: 0, warnings: 1 },
};

describe("MeasurementReceiptSchema", () => {
  it("accepts a valid receipt", () => {
    expect(MeasurementReceiptSchema.parse(validReceipt).checks[0]?.id).toBe("layout.overflow");
  });
  it("requires reason when skipped", () => {
    const skipped = structuredClone(validReceipt);
    skipped.checks[0] = { ...skipped.checks[0], status: "skipped" };
    expect(MeasurementReceiptSchema.safeParse(skipped).success).toBe(false);
    skipped.checks[0] = { ...skipped.checks[0], status: "skipped", reason: "no chromium in CI" };
    expect(MeasurementReceiptSchema.safeParse(skipped).success).toBe(true);
  });
  it("rejects unknown check ids and bad sha256", () => {
    const bad = structuredClone(validReceipt);
    bad.checks[0]!.id = "made.up";
    expect(MeasurementReceiptSchema.safeParse(bad).success).toBe(false);
    const badHash = structuredClone(validReceipt);
    badHash.checks[0]!.evidence_refs[0]!.sha256 = "xyz";
    expect(MeasurementReceiptSchema.safeParse(badHash).success).toBe(false);
  });
});
```

- [ ] **Step 2:** Run `npm test -- tests/measurement-receipt.test.ts` → FAIL (no export).
- [ ] **Step 3:** Implement in `packages/prax-validator/src/contracts.ts`:

```ts
export const ARTIFACT_CHECK_IDS = [
  "layout.overflow",
  "layout.responsive_collision",
  "text.truncation",
  "a11y.contrast",
  "a11y.focus_order",
  "a11y.target_size",
  "type.min_projected_size",
] as const;
export type ArtifactCheckId = (typeof ARTIFACT_CHECK_IDS)[number];

// Default severity per ADR-005 decision 6: warning-born; the two WCAG
// normative checks are error-born (zero overkill risk).
export const ARTIFACT_CHECK_DEFAULT_SEVERITY: Record<ArtifactCheckId, "warning" | "error"> = {
  "layout.overflow": "warning",
  "layout.responsive_collision": "warning",
  "text.truncation": "warning",
  "a11y.contrast": "error",
  "a11y.focus_order": "warning",
  "a11y.target_size": "error",
  "type.min_projected_size": "warning",
};

export const MeasurementReceiptCheckSchema = z.object({
  id: z.enum(ARTIFACT_CHECK_IDS),
  status: z.enum(["pass", "fail", "skipped"]),
  severity: z.enum(["warning", "error"]),
  subject: NonEmpty.optional(),
  measured: z.record(z.string(), z.unknown()).default({}),
  threshold: z.record(z.string(), z.unknown()).default({}),
  evidence_refs: z
    .array(z.object({
      ref: NonEmpty.refine((r) => r.startsWith("validation-evidence/"), {
        message: "receipt evidence refs must live under validation-evidence/",
      }),
      sha256: z.string().regex(/^[0-9a-f]{64}$/),
    }))
    .default([]),
  supported_fixes: z.array(NonEmpty).default([]),
  reason: NonEmpty.optional(),
}).superRefine((check, ctx) => {
  if (check.status === "skipped" && check.reason === undefined) {
    ctx.addIssue({ code: "custom", message: "skipped checks require a reason" });
  }
  if (check.status !== "pass" && check.subject === undefined) {
    ctx.addIssue({ code: "custom", message: "fail/skipped checks require a subject" });
  }
});

export const MeasurementReceiptSchema = z.object({
  receipt_version: z.literal("0.1"),
  tool: z.object({ name: z.literal("prax-measure"), version: NonEmpty }), // version deliberately NonEmpty, not semver-constrained
  target: z.object({ app_root: NonEmpty, base_url: NonEmpty, build_ref: NonEmpty.nullable() }),
  run_at: z.string().datetime(),
  viewport_matrix: z.array(z.object({ width: z.number().int().positive(), height: z.number().int().positive(), label: NonEmpty.optional() })).min(1),
  checks: z.array(MeasurementReceiptCheckSchema).min(1),
  summary: z.object({ pass: z.number().int().nonnegative(), fail: z.number().int().nonnegative(), skipped: z.number().int().nonnegative(), warnings: z.number().int().nonnegative() }),
});
export type MeasurementReceipt = z.infer<typeof MeasurementReceiptSchema>;
```

- [ ] **Step 4:** Scaffold `packages/prax-measure` (package.json `"name": "prax-measure"`, dependencies: `prax-validator` workspace + `playwright`; tsconfig matching sibling packages). Re-export nothing yet.
- [ ] **Step 5:** Run test → PASS. Run `npm run build` → green.
- [ ] **Step 6:** Commit: `feat(validator): measurement receipt schema + artifact check catalog constants`.

### Task A2.1–A2.7: The seven checks (mutually independent **∥**)

**Files (one per check, same shape):**
- Create: `packages/prax-measure/src/checks/<id>.ts`
- Test: `tests/measure-<id>.test.ts` (new, one file per check — parallel agents must not share test files; runner-level integration lives in A3's `tests/measure-runner.test.ts`)
- Fixture pages under `tests/fixtures/measure/` — each check owns a uniquely-named fixture (`<id>.html`) to keep parallel work conflict-free

Uniform contract (pin this; every check file exports exactly this):

```ts
import type { Page } from "playwright";
import type { ArtifactCheckId, MeasurementReceipt } from "prax-validator";

export interface CheckContext {
  viewport: { width: number; height: number; label?: string | undefined };
  screenshotDir: string; // absolute; check writes PNGs here, refs are rebased by the runner
}

export type CheckOutcome = MeasurementReceipt["checks"][number];

export async function run(page: Page, ctx: CheckContext): Promise<CheckOutcome>;
```

Per-check measurement semantics (spec §5.3 is authoritative):

- **A2.1 `layout.overflow`** — page-level `document.documentElement.scrollWidth <= window.innerWidth`; element-level: visible elements with `scrollWidth > clientWidth + 1` (1px rounding tolerance). Screenshot on fail.
- **A2.2 `layout.responsive_collision`** — pairwise intersection of visible interactive elements (`a,button,input,select,textarea,[role=button],[tabindex]`), excluding ancestor/descendant pairs and elements with `data-overlay` role. Report colliding pairs with rects.
- **A2.3 `text.truncation`** — visible text nodes whose inline box overflows their block container without `text-overflow: ellipsis` or a `title` attribute carrying the full text (the `.truncation-intended` exemption class is the explicit opt-out).
- **A2.4 `a11y.contrast`** — for each visible text element, compute effective foreground/background (walk up for backgrounds, account for opacity); ratio vs WCAG 2.2 AA (4.5 normal / 3.0 large ≥ 24px or 18.66px bold). Report failing pairs with measured ratios. **Severity: error.**
- **A2.5 `a11y.focus_order`** — sequential Tab walk (max 64 stops): every focused element has a visible indicator (outline/box-shadow/non-background-only change); record focus sequence; flag DOM-order inversions that contradict visual order (measured by bounding-box reading order).
- **A2.6 `a11y.target_size`** — interactive elements ≥ 24×24 CSS px (WCAG 2.2 2.5.8); exemptions: inline links within a sentence, elements with an equivalent alternative control on the same page (declared via `data-target-alternative`). **Severity: error.**
- **A2.7 `type.min_projected_size`** — computed `font-size` of primary-content text (main/article/[data-primary]) ≥ 12px. Advisory only.

- [ ] Each task: failing unit test against a fixture page → implement → test passes. Commit per check: `feat(measure): <id> check`.

### Task A3: Runner + CLI

**Files:**
- Create: `packages/prax-measure/src/runner.ts`, `packages/prax-measure/src/receipt.ts`, `packages/prax-measure/bin/prax-measure.mjs`, `packages/prax-measure/src/index.ts`
- Test: `tests/measure-runner.test.ts` (new)

- [ ] **Step 1: Failing test** — runner against `tests/fixtures/measure/layout.overflow.html` (the A2.1-owned fixture: one deliberate 14px overflow) produces a receipt that: parses against `MeasurementReceiptSchema`; contains `layout.overflow` fail with `measured.overflow_px: 14`; every `evidence_refs[].sha256` matches the actual file bytes on disk; summary counts are consistent with checks.
- [ ] **Step 2:** Run → FAIL (no module).
- [ ] **Step 3:** Implement:
  - `receipt.ts`: atomic write (unique tmp file + rename, same pattern as artifact-store); sha256 computed by the runner at file creation, never trusted from checks.
  - `runner.ts`: serve fixture/app (`vite preview` spawn when `appDir` has a build, or static file server for plain HTML fixtures — detect by `dist/` presence); launch chromium; for each viewport × each check: fresh page, run check, collect outcomes; skipped on environment failure with `reason`; assemble receipt; write `<sessionDir-or-out>/validation-evidence/receipt-<timestamp>.json`.
  - CLI: `--app <dir> --out <dir> [--serve <url>] [--viewports 1280x860,1440x900]`; exit 0 no error-severity fail / 1 error-severity fail / 2 environment failure. Browser-missing path exits 2 and still writes a receipt with all checks `skipped`.
- [ ] **Step 4:** Test → PASS.
- [ ] **Step 5:** Live calibration runs (required, not optional): run against `apps/prax-wizard` and `apps/prax-dashboard` builds; receipts must parse; **record every finding as either a real defect (file it) or an overkill false positive (fix the check)** — this is the zero-overkill evidence ADR-005 decision 6 requires before any severity promotion.
- [ ] **Step 6:** Commit: `feat(measure): runner, CLI, atomic receipt writer`.

### Task B1: Validator contracts — evidence extension + measurement map + finding provenance

**Files:**
- Modify: `packages/prax-validator/src/contracts.ts`
- Test: `tests/artifact-evidence-contracts.test.ts` (new)

- [ ] **Step 1: Failing test** covering: `measurement_receipt` optional field round-trip (including prefix refine rejection of a non-`validation-evidence/` path); `CHECK_MEASUREMENT_MAP` contains exactly the spec §5.4 entries (lookup semantics: absent key ≡ empty mapping, not enforced); `ValidationFinding` gains `provenance: "measured" | "attested"`.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement:

```ts
// contracts.ts additions
export const CHECK_MEASUREMENT_MAP: Record<string, readonly ArtifactCheckId[]> = {
  readability: ["a11y.contrast", "type.min_projected_size"],
  keyboard: ["a11y.focus_order"],
  regression_check: ["layout.overflow"],
  untouched_surface_regression: ["layout.overflow", "layout.responsive_collision"],
};
```

`ValidationEvidenceItemSchema`: add `measurement_receipt: NonEmpty.optional()` (path must start with `validation-evidence/` — enforce via `.refine`). `ValidationFinding`: add `provenance: z.enum(["measured", "attested"])` equivalent TS field.

- [ ] **Step 4:** Test → PASS.
- [ ] **Step 5:** Commit: `feat(validator): measurement evidence contract + check mapping + finding provenance`.

### Task B2: artifact-evidence.ts — receipt verification and cross-check

**→ depends on B1. Files:**
- Create: `packages/prax-validator/src/artifact-evidence.ts`
- Modify: `packages/prax-runtime/src/realization.ts` (generalize `verifyEvidenceFile` — see below), or create `packages/prax-runtime/src/evidence-files.ts` and re-export from `realization.ts` for compatibility
- Test: `tests/artifact-evidence.test.ts` (new)

- [ ] **Step 1: Failing test** matrix (each one `it`):
  1. valid receipt + consistent claimed outcomes → findings marked `measured`
  2. receipt declared but file unreadable/missing/escaping containment → EXPAND `EVIDENCE_FILE_INVALID`
  3. receipt schema-invalid → BLOCK `MEASUREMENT_RECEIPT_INVALID`
  4. receipt `evidence_refs` sha256 ≠ recomputed file hash → BLOCK `EVIDENCE_DIGEST_MISMATCH`
  5. receipt contains fail for `a11y.contrast` while `readability` item claims pass → BLOCK `VALIDATION_MEASUREMENT_CONTRADICTION`
  6. mapped check (`readability`) claims pass without any receipt → EXPAND `MEASUREMENT_RECEIPT_MISSING`
  7. receipt with all checks skipped (with reasons) → coverage satisfied, but the affected findings are marked `attested` + warning recorded; >50% catalog skipped → REVIEW demanding human environment confirmation (spec §5.4 rule 4 — skipped never displays as measured, never deadlocks sessions without a measurable target)
  8. path traversal `measurement_receipt: "../outside/x.json"` → rejected by containment check
  9. partial coverage — mapping requires `[a11y.contrast, type.min_projected_size]` but the receipt covers only one → EXPAND `MEASUREMENT_RECEIPT_MISSING` naming the uncovered id
  10. stale receipt — receipt `run_at` precedes the mtime of `screen.sdir.yaml` or `implementation-brief.yaml` → receipt does not count as coverage, EXPAND `MEASUREMENT_RECEIPT_STALE` (spec §5.7 R3: the human-review back-edge invalidates prior measurement)
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement per spec §5.4. Generalize `verifyEvidenceFile(sessionDirectory, ref, allowedPrefix = "rep-evidence/")`; existing realization call sites keep default behavior (add a regression test asserting the old prefix still applies).
- [ ] **Step 4:** Test → PASS.
- [ ] **Step 5:** Commit: `feat(validator): receipt verification, digest binding, measurement contradiction gate`.

### Task B3: Convergence protocol (**∥** independent of Track A and B2)

**Files:**
- Modify: `packages/prax-runtime/src/contracts.ts` (`DesignSessionSchema` gains `validation_loop`), `packages/prax-mcp/src/service.ts` (record + stall detection)
- Test: `tests/validation-convergence.test.ts` (new)

- [ ] **Step 1: Failing test**: legacy session without `validation_loop` parses (default `{ history: [] }`); after a non-PASS evaluation the runtime appends `{ evaluated_at, open_findings }`; the first non-PASS evaluation establishes the baseline and is never counted as non-improving; two consecutive non-improving evaluations after the baseline (stall earliest at the third non-PASS evaluation) → status REVIEW with code `VALIDATION_CONVERGENCE_STALLED`; the subsequent `design_validate` call is still accepted (gate not locked); stall event recorded in session warnings.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement per spec §5.6. Open findings = count of fail + inconclusive findings in the evaluation. "Non-improving" = `open_findings >= min(history)` at submission time, evaluated only once a baseline exists.
- [ ] **Step 4:** Test → PASS.
- [ ] **Step 5:** Commit: `feat(runtime): validation convergence tracking with truthful stall reporting`.

### Task B4: Evaluation wiring — measured evidence in `design_validate`

**→ depends on B2 + B3 (both touch service.ts; B4 lands last). Files:**
- Modify: `packages/prax-validator/src/validator.ts` (call artifact-evidence verification inside evaluation; attach `provenance` on findings), `packages/prax-mcp/src/service.ts` (pass session directory; EXPAND/BLOCK propagation)
- Test: extend `tests/artifact-evidence.test.ts` + service-level test `tests/validate-measurement.test.ts`

- [ ] **Step 1:** Failing service test: full `design_validate` with a real receipt on disk → COMPLETE requires zero missing evidence including receipt coverage; contradiction case → BLOCK; missing receipt for mapped check → EXPAND; evaluation output carries the runtime-computed `readiness` block (spec §5.7) with correct `deterministic_passed` / `error_failures_open` / `claims` split; a readiness-failing evaluation → REVIEW `REVIEW_NOT_READY`.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement. COMPLETE semantics unchanged (PASS + zero missing evidence). The readiness block is computed by the runtime/validator from artifacts and receipts — agents cannot self-declare it.
- [ ] **Step 4:** Test → PASS.
- [ ] **Step 5:** Commit: `feat(validate): measured evidence enforcement + review-readiness packet in evaluation`.

### Task C1: End-to-end measured-validation demonstration

**→ needs A3 + B4 (and B3 for the stall scenario). Files:**
- Create: `tests/validate-measurement-e2e.test.ts`
- Create: `tests/fixtures/measure/receipts/` (committed real receipts from Step 1)
- Modify: `docs/phase-report-2026-09-01.md` (calibration record)

- [ ] **Step 1: Live calibration runs (required, not optional).** Run `prax-measure` against the production builds of every runnable golden app — currently `apps/prax-landing`, `apps/prax-dashboard`, `apps/prax-wizard`. Every receipt must parse against `MeasurementReceiptSchema`. Triage every finding as either a real defect (file it in the phase report) or an over-kill false positive (fix the check) — this triage record is the zero-overkill evidence ADR-005 decision 6 requires before any severity promotion.
- [ ] **Step 2: E2E test.** Service-level `design_validate` consuming a real receipt from Step 1: measured findings carry `provenance: "measured"`; a doctored contradiction (fail receipt + claimed pass) → BLOCK `VALIDATION_MEASUREMENT_CONTRADICTION`; a three-round stall scenario (baseline + two non-improving) → REVIEW `VALIDATION_CONVERGENCE_STALLED` and the gate stays open; a skipped-with-reason receipt satisfies coverage but findings stay `attested` + warning; the evaluation output carries the runtime-computed `readiness` block, and a readiness-failing submission (deterministic gate red / open error-severity failure / stalled — readiness not green with the runtime-filled unresolved list attached, per spec §5.7 R4) → REVIEW `REVIEW_NOT_READY` (spec §5.7).
- [ ] **Step 3: Receipt replay fixture.** Freeze one real receipt + its evidence files into `tests/fixtures/measure/receipts/` and add a replay test (pattern follows `tests/prax-landing-fixture.test.ts`): re-parsing the frozen receipt and re-verifying its evidence digests must succeed byte-identically.
- [ ] **Step 4:** Commit: `test(validate): measured-validation e2e + receipt replay fixture + calibration record`.

### Task 1.6: Phase 1 doc sync

**Files:**
- Modify: `docs/architecture.md` (validation row: measured artifact layer + receipt verification; persistence model: `validation-evidence/` directory; security section: generalized evidence containment with two prefixes; concept boundaries: review-readiness packet is runtime-computed, spec §5.7), `README.md` (package list gains prax-measure; capability paragraph), `docs/phase-report-2026-09-01.md` (update: Gate 1 status + calibration record from C1)

- [ ] **Step 1:** architecture.md edits; README edits.
- [ ] **Step 2:** Phase report entry with Gate 1 evidence (test counts, calibration run receipts, contradiction demo).
- [ ] **Step 3:** Commit: `docs: phase 1 measurement layer sync + phase report`.

---

## Phase 2 — Intermediate state structuring (SDIR 0.2 + decide/frame extensions)

**Entry gate:** Gate 1 passed. **Replan trigger:** if Phase 1 calibration evidence showed a catalog check is unusable, adjust §6.5 expectations here before starting.

### Parallelization map (Phase 2)

```text
Track S (sdir):      S1 (vocab + 0.2 schema) → S2 (engine generate 0.2 + lint渗透 tests)
Track G (gates):     G1 → G2 (SERIAL: both modify runtime/contracts.ts + gate-validation.ts)
Track V (validator): V1 (4 new deterministic checks) ∥ S1 ∥ G1
Integration:         I1 (needs S1 + G2 + V1) → I2 (compiler sections) → I3 (test gate) → 2.x doc sync
```

### Task S1: SDIR vocabulary tables + 0.2 discriminated union

**Files:**
- Create: `packages/prax-sdir/src/vocab.ts`
- Modify: `packages/prax-sdir/src/contracts.ts`
- Test: `tests/sdir-02.test.ts` (new)

- [ ] **Step 1: Failing test** — construct a valid 0.2 document exercising every §6.1 block (user_job / primary_object / information_shape / representation / priority / interaction / state_ownership / complexity_budget / acceptance) and assert it parses; 0.1 documents still parse; `version: "0.3"` rejected; priority referencing a nonexistent region id fails refinement; state_ownership owner outside regions ∪ {session,url} fails; acceptance empty array fails; each vocabulary enum rejects out-of-table values (including the two first-amendment entries `understand` and `architecture` being ACCEPTED).
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement `SDIR_VOCAB` (exact field values per spec §6.1: 19 JTBD verbs including `understand`, 16 object types, 22 representation primitives including `architecture`, `version: "2026-09"`) and `SdirV02Schema` with referential `superRefine`s; `SdirSchema = z.discriminatedUnion("version", [SdirV01Schema, SdirV02Schema])`. The `archetype` block is retained in 0.2; only its `pattern_ref` field becomes optional (0.1 unchanged).
- [ ] **Step 4:** Test → PASS.
- [ ] **Step 5:** Commit: `feat(sdir): vocabulary tables + SDIR 0.2 union with referential checks`.

### Task S2: Engine — generate 0.2 + render-leak coverage proof

**Files:**
- Modify: `packages/prax-sdir/src/engine.ts`
- Test: `tests/sdir-02-lint.test.ts` (new)

- [ ] **Step 1: Failing test** — render-leak lint rejects pixel/CSS/class vocabulary inside the NEW fields (`representation.primary.reason: "use flexbox gap 12px"` → rejected; `acceptance: ["button uses rounded corners"]` → rejected); generate mode emits `version: "0.2"` with defaults filled.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement (lint already recurses; if any new field bypasses traversal, fix traversal — do not widen the forbidden lists).
- [ ] **Step 4:** Test → PASS.
- [ ] **Step 5:** Commit: `feat(sdir): 0.2 generation + render-leak coverage on new fields`.

### Task G1: Frame 0.2

**Files:**
- Modify: `packages/prax-runtime/src/contracts.ts` (ProductFrame 0.2 union), `packages/prax-runtime/src/gate-validation.ts` (`FRAME_PRODUCT_MODEL_INCOMPLETE`)
- Test: `tests/frame-02.test.ts`

- [ ] TDD cycle per spec §6.2: 0.2 frame requires jtbd/primary_object/task_model blocks (EXPAND when missing); 0.1 frames unchanged; verb/object enums enforced.
- [ ] Commit: `feat(runtime): product frame 0.2 with JTBD/object/task model`.

### Task G2: Decide representation rules

**Files:**
- Modify: `packages/prax-runtime/src/contracts.ts` (DesignDecisions representation block), `packages/prax-runtime/src/gate-validation.ts`
- Test: `tests/decide-representation.test.ts`

- [ ] TDD matrix per spec §6.3: missing blocks → EXPAND `DECISION_SHAPE_MISSING`; `SHELL_TERMS` detection triggered (via `primary.type === "cards"` OR word-boundary text match, incl. CJK synonyms) without shape-referencing justification → REVIEW `DECISION_DEFAULT_SHELL_UNJUSTIFIED`; empty rejected → WARN `DECISION_NO_REJECTED_REPRESENTATION`. `SHELL_TERMS` constant pinned exactly as spec (versioned alongside `SDIR_VOCAB`).
- [ ] Commit: `feat(runtime): representation portfolio decision rules`.

### Task V1: Four deterministic structure checks (**∥**)

**Files:**
- Modify: `packages/prax-validator/src/validator.ts`, `contracts.ts` (CHECK_PROFILE rows)
- Test: `tests/validator-structure-checks.test.ts`

- [ ] TDD per spec §6.5: the four checks evaluate against SDIR 0.2 artifacts; 0.1 sessions do not assemble them (compat test); each check's fail/warning semantics exactly as tabled.
- [ ] Commit: `feat(validator): representation/state/acceptance/budget structure checks`.

### Task I1: MCP payload integration

**→ needs S1 + G2 + V1. Files:** `packages/prax-mcp/src/schemas.ts`, `packages/prax-mcp/src/service.ts`, `packages/prax-runtime/src/gate-validation.ts` (the `SDIR_REPRESENTATION_DRIFT` cross-check lives in gate-validation, not the service layer)

**Flattening recipe (pinned; the AB-001 anyOf lesson — see `benchmark-runs/PRAX-AB-001/lessons/prax-gaps.yaml`, gap-mcp-anyof-schema):** client schemas carry the union of 0.1 + 0.2 fields, all optional, plus an optional `version` literal; no `z.union` / discriminatedUnion inside any MCP `inputSchema` (nested anyOf on `sdir` is unproven for strict MCP clients). The service layer reads `version` (absent ⇒ 0.1 behavior) and then parses with the matching server-side zod branch.

- [ ] Failing test: client schemas accept flattened 0.2 payloads; `SDIR_REPRESENTATION_DRIFT` cross-check fires when decide's primary and SDIR's primary disagree (REVIEW); a 0.1 payload round-trips unchanged.
- [ ] Implement; test → PASS.
- [ ] Commit: `feat(mcp): 0.2 payloads for frame/decide/sdir with drift cross-check`.

### Task I2: Compiler + brief sections

**Files:** `packages/prax-runtime/src/context-compiler.ts`

- [ ] Failing test: compiled context contains representation/state_ownership/acceptance sections sourced only from gated artifacts; 0.1 sessions compile unchanged.
- [ ] Implement; test → PASS.
- [ ] Commit: `feat(runtime): compiled context carries representation portfolio, state ownership, acceptance`.

### Task I3: Phase 2 test gate + doc sync

- [ ] Full suite green; new tests: `sdir-02`, `sdir-02-lint`, `frame-02`, `decide-representation`, `validator-structure-checks`, payload integration.
- [ ] Legacy resume proof: a persisted 0.1 session fixture resumes and completes validate with zero new obligations.
- [ ] Doc sync: architecture.md (SDIR 0.2 concept boundary: portfolio replaces single archetype ref; state ownership layer), `docs/phase-report-2026-09-01.md` update.
- [ ] Commit: `docs: phase 2 sync`.

---

## Phase 3 — Knowledge asset restructure

**Entry gate:** Gate 2 passed. Medium-detail tasks; the executing agent follows spec §7 exactly.

### Parallelization map (Phase 3)

```text
K1 (schema 0.2 + loader multi-file + migration of 23 entries) → K2 (router trigger matching)
K1 → K3 (myth seeds append to knowledge.yaml AFTER migration; K3 tests only decide-surfacing)
K4 (corpus file data/corpus-2026-09.yaml — separate file, content work) ∥ K2, K3
```

- [ ] **K1:** `packages/prax-knowledge` schema 0.2 per spec §7.1 — BOTH layers (seed `KnowledgeSeedSchema` + expanded `KnowledgeEntry` incl. disclosure L0–L3) and both hardcoded version literals (contracts.ts, store.ts); loader gains multi-file merge (knowledge.yaml + corpus-*.yaml). Migration script `packages/prax-knowledge/scripts/migrate-02.mjs` round-trips all 23 entries; mapping source is the structured `scope` field (free-text `triggers` advisory only); type→asset_class per spec mapping (platform_convention→profile); lifecycle→stability: stable→A/B per entry, the 3 reviewed entries→B. **Human handoff step (required):** the script emits `data/stability-assignments.draft.yaml`; the executing agent presents it to the user, waits for confirmation, and commits the confirmed file as `data/stability-assignments.yaml`. Tests: `tests/knowledge-02-migration.test.ts`.
- [ ] **K2:** router applies trigger_conditions (cross-facet AND, intra-facet OR per spec §7.1 vocabulary) as lex-specialis weighting on top of existing hardScopeMismatch + deterministic scoring. Myth exclusion is existing behavior (router skips type=myth); preserve it through the asset_class migration. K2 owns the "myth never routed by default" assertions. Tests: `tests/router-triggers.test.ts` (six-facet matrix + myth-exclusion).
- [ ] **K3:** eleven myth entries per spec §7.3 (§48C 全量 10 + `myth-card-grid-default` per §5/§4.1), appended to `data/knowledge.yaml` AFTER K1 migration lands; each carries `refutation` rebutting the universal quantifier (not in-domain value). `design_decide` default-shell check surfaces the matching myth id via `SHELL_MYTH_MAP` (spec §7.3) in its REVIEW message — K3 tests cover decide-surfacing only. Tests: `tests/decide-myth-surfacing.test.ts`.
- [ ] **K4:** `docs/knowledge-intake-protocol.md` — the 18 intake questions (research Appendix C verbatim) + stability grading rules + first batch of ≥20 entries encoded from the 120-sample matrix (Appendix A) into `data/corpus-2026-09.yaml`, each carrying trigger_conditions + authority_initial + review_by.
- [ ] **Gate 3:** full suite green; migration round-trip passes; router regression against the existing routing suites (`tests/routing-vocabulary.test.ts`, `tests/runtime-and-routing.test.ts`) plus the recorded live-run routing logs (dashboard → PAT-DATA-EXPLORER; CTA modify → PAT-APPLICATION-SHELL); **stability assignments human-confirmed** (K1 step); doc sync (architecture.md knowledge row, README, phase report update). Commit: `docs: phase 3 sync`.

---

## Phase 4 — Empirical loop (framework only; replan before execution)

**Entry gate:** Gate 3 passed. **Explicit replan step:** this phase is re-planned as its own spec+plan pair using Phase 1–3 measurement evidence; the items below are the binding scope, not the task list.

- [ ] **F1:** Empirical benchmark matrix — 15 user jobs × 10 information shapes (research §43 list verbatim) as benchmark definitions under `benchmarks/`; harness reuses prax-measure receipts as the objective evidence layer.
- [ ] **F2:** A/B protocol document — arms and the 13 evaluation metrics (research §44 verbatim), blind-review procedure from PRAX-AB-001 reused, rubric-bias lesson recorded (process artifacts excluded from blind bundles under-credits the Prax arm).
- [ ] **F3:** Inter-rater coding pilot (research §45 field list) + pattern saturation ledger (§46 five new-rate counters).
- [ ] **F4:** ECP cognition workspace pilot — golden case #6; representation architecture derived per research §40–41 (Canvas + Change Timeline + Search + Inspector composition; no universal shell); full chain ①→⑱ exercised; fixture frozen afterward per the landing precedent.
- [ ] **F5:** Check-promotion review — every warning-born catalog check that survived zero-overkill calibration on all runnable golden apps (currently landing, dashboard, wizard; the promotion gate is the runnable set) is promoted to error; the promotion commit is the first instance of the accreting-gate mechanism (spec §8.1).
- [ ] **Gate 4 / program exit:** benchmark harness runs end to end on one matrix cell; A/B protocol reviewed; ECP fixture frozen; phase report closes the keep/revise/remove/defer ledger for the whole program.

---

## Cross-phase rules (binding on every task)

1. TDD: failing test → implement → pass → commit. No task commits red.
2. `npm test` (build + vitest) must be green at every commit boundary.
3. Golden fixture replays must stay green — currently `tests/prax-landing-fixture.test.ts` (the only golden replay; new replays added by later phases, e.g. the receipt replay in C1, join it). A deliberate fixture change requires its own commit message explaining why.
4. Any deviation from spec §N is recorded in the phase report's keep/revise/remove/defer ledger with the reason — plans are updated, never silently bypassed.
5. Doc sync tasks are part of each phase gate, not optional cleanup.
6. Git mutations (commit/push) require explicit user confirmation at each phase boundary; within a phase, per-task commits follow the repo convention and are pushed only when the user asks.
