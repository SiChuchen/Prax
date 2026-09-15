# M3 Ten-Cell Pilot Execution Plan

> **For agentic workers:** Use executing-plans for the operator workflow. Independent agents may review the plan or mechanically validate packages; experimental arms must run in fresh, independent CLI conversations, never context-inheriting subagents. Track steps with checkboxes. Do not commit or push without a separate user request.

**Goal:** Execute and honestly account for the frozen ten-cell, two-arm pilot, producing reproducible run packages and an independently scored comparison, not a predetermined Prax win.

**Architecture:** Separate operator preparation, independent arm execution, objective evidence capture, blind review, and unblinded analysis. Freeze a content-addressed runtime before the first arm; preserve historical inputs and raw evidence. Treat failed, incomplete, or contaminated runs as data rather than silently replacing them.

**Tech Stack:** Existing Node/TypeScript Prax runtime, MCP, Playwright, Git, PowerShell, independent coding-agent CLI sessions.

## Scope and source of truth

- Repository: `E:/codex-prj/Prax/Prax` (not its outer handoff directory).
- Prepared workspaces: `E:/codex-prj/ab-worktrees/pi-matrix/<cell>-<a|b>`.
- Frozen input: `benchmarks/product-intelligence-matrix/pilot-batch.yaml` and
  `benchmark-runs/product-intelligence-matrix/<cell>/brief.md`.
- Procedure: `benchmarks/product-intelligence-matrix/m3-runbook.md`,
  `benchmarks/product-intelligence-matrix/ab-protocol.md`,
  `benchmarks/architecture-canvas-ab/runbook.md`, and
  `benchmark-runs/PRAX-AB-001/replicates/README.md`.
- Program interpretation: `docs/superpowers/plans/2026-09-02-benchmark-execution.md`.
- Runtime changes/limits: `docs/phase-report-2026-09-06.md`, `README.md`,
  `docs/architecture.md`.

This handoff covers M3, blind outcome review, and a limited unblinded pilot
analysis. It does NOT execute 150 cells, change product code, alter frozen
briefs/prompts, promote checks/knowledge, or claim M4's separate 30-page coding
sample/saturation band is complete. Lifecycle binding and storage transactions
are separate engineering projects.

## Known preflight findings (observed 2026-09-06)

1. All ten prepared B `.mcp.json` files fail JSON parsing (`Bad JSON escape
   sequence`). The inspected j01-s01 file also contains literal `$DIR` in its
   state path. Historical preparation reports are not proof of current readiness.
2. Sample A workspace j01-s01 has an unborn HEAD and untracked README/brief.
   `git diff` alone cannot capture an implementation created from scratch.
3. Startup README contains operator/Prax information even in Arm A. The rule
   "no Prax strings anywhere" conflicts with that file. Keep operator metadata
   outside the actual experimental workspace; retain originals in a backup.
4. `run-cell.mjs` selects the lexically latest receipt in a cell-shared directory
   rather than binding the exact invocation. A failed invocation can leave only
   historical receipts; simultaneous runs can associate the wrong receipt.
5. The runtime now emits 0.2 receipts. Existing B prompts do not instruct the
   agent to declare `measurement_target` at prepare. Unprepared 0.2 evidence
   requires REVIEW. Do not coach only B or rewrite gated artifacts to hide this.
6. `ab-protocol.md` says >=3 repetitions per arm; the later M3 pilot program and
   runbook explicitly allow >=1 per cell/arm. This plan chooses exactly one
   planned run per cell/arm (20 runs), labels it a pilot, and records the deviation
   from the broader replicated protocol before execution. No significance claims.

## Chunk 1: Operator preparation and freeze

### Task 1: Inventory without modifying the experiment

- [ ] Read the source-of-truth documents above; use fast-context for unknown
  code locations, exact reads for known paths. Do not recursively inspect unrelated
  user directories or state roots.
- [ ] Run from the repository:
  ```powershell
  git status --short
  git rev-parse HEAD
  npm test
  ```
  Last observed state: HEAD `39ac05c`, uncommitted hardening, 393/393 tests in
  52 files. Recheck rather than assuming these remain true; do not revert changes.
- [ ] Inspect all 20 workspaces: prior implementation/state, brief SHA256,
  HEAD or `unborn`, untracked files, MCP JSON. Preserve any used workspace;
  allocate a fresh sibling instead of deleting or reusing it.
- [ ] Create a NEW operator directory, proposed
  `benchmark-runs/product-intelligence-matrix/m3-20260906/`. If occupied, choose
  a new suffix and use that consistently. Record real paths, not this example
  blindly. No edits to previous benchmark run directories.

### Task 2: Freeze protocol, runtime, and arm isolation

Create in the new operator directory: `preflight.md`, `protocol-addendum.md`,
`runtime-lock.yaml`, `run-order.yaml`, `operator-events.ndjson`, and `launch/`.

- [ ] Fix only startup infrastructure before the freeze: preserve original B
  configs, write valid JSON pointing to the exact tested Prax entry (explicit
  `node` plus absolute `packages/prax-mcp/dist/stdio.js`, not an unverified global
  alias). Set each state root to THAT workspace's absolute `.prax` path, using
  JSON-safe forward slashes. Validate all ten configs and pairwise unique roots.
- [ ] Keep operator READMEs, manifests, arm mapping, and this plan outside arm
  workspaces. Extract their frozen arm prompt text into operator-only launch files.
  Include B's Prax paragraph, which is OUTSIDE the common fenced prompt in the
  current README. Replace only the brief placeholder with exact frozen text.
  Record prompt/brief hashes. Preserve the original README as an operator backup.
- [ ] Verify Arm A's ACTUAL available MCP/tools, injected global skills/context,
  filesystem access, and conversation are not exposing Prax or other arm results.
  A clean directory alone is insufficient. B gets the same tools plus Prax; pin
  identical model/version/settings and dependency/environment policy. Report any
  isolation feature the selected CLI cannot enforce before starting runs.
- [ ] Pin runtime source AND tested build content including untracked new modules;
  HEAD alone does not describe the current dirty implementation. Prefer a separate
  frozen runtime snapshot with hashed sources/build/lockfiles and resolved MCP
  entry. Exclude unrelated secrets and historical experiment data. Record Node,
  browser, package lock, agent CLI/model, and commands. Do not create a commit.
- [ ] Include runtime-loaded assets such as `packages/prax-knowledge/data`, not
  only `src`/`dist`. Ensure dependencies install reproducibly from the frozen lock
  and workspace links resolve within the frozen copy rather than the live repo.
  Rebind ALL B `.mcp.json` entries to this frozen copy; validate final configs
  after rebinding. Only then run the real-client smoke checks below. Record the
  actual loaded knowledge/assets and executable hashes as part of runtime identity.
- [ ] Record the pilot's 20-run scope, 90-minute / 1.2M-token per-run limits,
  stop rules, metric/rubric definitions, missing-data policy, fixed viewports
  1280x860 and 1440x900, entry `/`, post-run measurement policy, and B's possible
  binding/React-framework limitations. Preserve the frozen arm wording rather
  than feeding solutions from earlier warm-ups to B. If changing arm prompts,
  runtime, population, or budget becomes necessary, request a separately approved
  versioned protocol before any affected runs; do not silently adapt mid-batch.
- [ ] Randomize the 20 cell/arm slots ONCE, saving the seed/algorithm and complete
  schedule before outcomes exist. Default to sequential execution for isolation
  and comparable wall time. Each cell from pilot-batch appears exactly once per
  arm. No extra attempts selected because of disappointing outcomes.
- [ ] Before formal runs, show the operator the aggregate resource ceiling:
  20 x 90 minutes = 30 serial run-hours, plus preparation/review; observable
  per-run token caps sum to 24M tokens. Obtain batch-budget confirmation and
  record it. This plan is not approval to buy services or increase repetitions.
- [ ] Smoke-test the frozen runtime/MCP/measurement in a dedicated scratch app,
  not one of the ten pilot cells. `doctor` alone is insufficient: verify actual
  MCP initialize/tool availability with the intended client. Keep scratch state
  outside all arm workspaces; do not seed correction memory.
- [ ] Verify preflight has no unresolved validity-critical items. If blocked by
  missing CLI, session launching, access, or operator decisions, report the exact
  blocker plus ready-to-launch instructions; do not simulate independent runs.

### Task 3: Safe evidence capture preparation

- [ ] Use the existing measurement CLI directly with a UNIQUE per-run output
  directory, rather than trusting `run-cell.mjs`'s latest-file lookup. Record this
  versioned harness deviation in the addendum; do not edit the frozen wrapper.
  Bind cell/arm/run externally in the operator manifest, hash it, and log the
  exact emitted receipt path and process exit code.
- [ ] Predefine build/root resolution consistently for both arms. Prefer an
  existing standalone static output (root `index.html` or built `dist`) for
  strong local static-tree binding. Do not change build output configuration
  after seeing results. If Vite preview or an external server is needed, label
  its weaker source association and record the exact served root/process.
- [ ] Pre-register operator screenshot capture for BOTH arms, independent of
  measurement check failures: on the stopped artifact snapshot, capture the final
  initial page `/` at 1280x860 and 1440x900 with the same browser, ready-document
  policy, and capture method. Save URL, viewport, timestamp, browser version,
  source snapshot id, and image SHA256. Do not require interactions or repair
  code to improve the frame; failures are explicit missing evidence. Passing
  prax-measure checks may emit no screenshots, so receipt validity alone cannot
  supply a usable blind visual package.
- [ ] Example command, run with the application's correct cwd and substitute
  only recorded paths (the `--out` directory must be new):
  ```powershell
  node <frozen-runtime>/packages/prax-measure/bin/prax-measure.mjs --app <measured-static-root> --out <new-run-package> --entry / --scenario entry --viewports 1280x860,1440x900
  ```
  Benchmark post-run capture is NOT a B session validation receipt and must not
  be backfilled into its completed/blocked workflow. Session receipts, if the
  agent generates them, remain separate and retain their binding metadata.
- [ ] Smoke-check pass, failing-check, and invalid-target examples: respectively
  completed evidence, exit 1, and exit 2/diagnostic skipped evidence. Invocation
  failure must never select a previous receipt. Do not require every implementation
  to pass checks to count as observed data.

## Chunk 2: Independent execution and reproducible packages

### Task 4: Run each scheduled arm (repeat 20 times)

- [ ] Operator chooses the scheduled workspace, checks input/runtime hashes,
  and launches a NEW independent CLI session at that cwd with only its exact arm
  prompt. Do not give an arm this plan, previous transcripts, warm-up fixes,
  other-arm outputs, blind scores, or the overall coordinator conversation.
- [ ] Start a real clock; log events/transcript as they occur, including questions,
  answers, first_pass, repairs, and stop reason. Supply material clarifications
  equivalently under the predeclared parity rule; mark uncorrectable asymmetry
  biased. Never reconstruct invisible tokens/tool counts/first-pass timing.
- [ ] Stop at declared completion, 90 minutes, or observable 1.2M token use.
  Missing token telemetry is `not_observable` with explanation, not zero or a
  claim the cap was verified. Retain failures and budget-exceeded runs.
- [ ] Freeze output at stop. Operator may execute the documented build and
  measurement but not repair application code. Record operator time separately;
  do not extend the arm budget through post-run repair. Failed build/measurement
  remains data. A retry is allowed only under the preregistered infrastructure
  policy; preserve original attempts and exclude any silent best-of selection.
- [ ] Package under a new
  `benchmark-runs/product-intelligence-matrix/<cell>/m3/<batch-run-id>-<arm>/`:
  ```text
  input/brief.md                   # exact supplied bytes
  input/prax-artifacts/            # B only; original session and evidence
  execution/events.ndjson
  execution/session-transcript.*   # or transcript-status.md
  implementation/source/          # complete app files, including untracked ones
  implementation/git-diff.patch
  implementation/changed-files.txt
  implementation/file-hashes.json
  evidence/screenshots/
  validation-evidence/             # exact new receipt + referenced evidence tree
  summary.yaml
  ```
  Include package/lock/build instructions. Exclude dependency caches, credentials,
  and unrelated files. A diff is supplementary; preserve the standalone source
  snapshot without needing an initial commit. Record initial HEAD as `unborn`
  where applicable, not a fabricated commit.
- [ ] Validate new receipt schema, target status, root digest against the preserved
  measured artifact snapshot, all referenced evidence hashes and containment, and
  exact run association. Preserve raw absolute-path receipts; do not rewrite them
  to look portable. A snapshot manifest maps original root to archived content.
- [ ] Execute the predeclared operator capture against the SAME stopped snapshot;
  place its two viewport screenshots and capture manifest in `evidence/screenshots/`,
  separate from measurement-failure PNGs in `validation-evidence/`. Preserve any
  agent-produced images separately with their own provenance. Verify hashes and
  snapshot identity; if capture fails, record missingness and review eligibility
  instead of inventing images or selecting nicer frames from another run.
- [ ] Fill original summary fields plus `cell`, batch/run ids, runtime id,
  prompt/brief hashes, initial/final snapshots, exact commands/exit codes, target
  status/binding strength, missing metrics, protocol deviations, and any bias.

### Task 5: Mechanical completeness audit

- [ ] Produce `run-ledger.yaml`: all 20 intended slots, all attempts, completion,
  budget, contamination, raw receipt presence, target validity, skipped/fail/pass
  counts, and blind-review eligibility. Keep attempted and eligible denominators
  separate. Missing evidence does not erase an attempted run.
- [ ] Verify brief/runtime freeze hashes unchanged; pairwise state separation;
  reproducible source snapshots including untracked files; receipt-to-run mapping;
  costs or explicit missingness. No "newest file" inference.
- [ ] State M3 gate truthfully: only close it when all ten cells have both arms
  with the required valid measurement evidence and cost accounting/explicit
  observability limits. An invalid target or absent receipt is not a clean pass;
  retain partial results and explain unmet slots without substituting warm-ups.

## Chunk 3: Independent scoring and limited analysis

### Task 6: Blind packages and independent reviewers

- [ ] Freeze rubric and metric definitions BEFORE reviews. Use the existing 13
  evaluation dimensions where observable. Browser layout/a11y checks do not measure
  task completion time, retrieval accuracy, user error rate, or human preference;
  collect separately under the agreed method or mark `not_observable`. Model
  preference is not human preference. Do not invent a composite scoring formula
  after seeing outcomes.
- [ ] Operator generates anonymous packages and a PRIVATE mapping. Exclude MCP
  state, Prax logs, operator reports, arm labels and revealing absolute paths.
  Keep raw evidence untouched; generate separately marked sanitized receipt
  summaries with a provenance/hash map. Check screenshots/UI/source filenames for
  incidental arm leakage; record unavoidable unblinding rather than editing the
  actual product. Give reviewers the common task brief, not the arm prompt.
- [ ] Two independent fresh reviewers score without access to each other's scores
  or the mapping; require evidence-backed observations and missingness. Freeze and
  hash both scores before comparing disagreements, adjudicating, and unblinding.
  This is outcome-review agreement, not the separate M4 taxonomy coding study.

### Task 7: Report without overclaiming

- [ ] Create `comparison.md`, `review-agreement.md`, `findings.yaml`, and
  `follow-ups.md` in the operator directory. Report paired cell-level outcomes,
  valid/invalid/missing counts, costs, observable metrics, and sensitivity to
  exclusions. One heterogeneous run per cell/arm supports exploratory findings,
  not replicated per-cell or statistically significant superiority claims.
- [ ] After unblinding, separately assess process reliability and Gate A-H, with
  visible evidence for attribution. Distinguish measurement problems, product
  defects, Prax gate friction, operator errors, and unknown causes. Do not infer
  private model reasoning.
- [ ] Propose keep/revise/remove/defer with supporting cell/run ids; implement no
  runtime/knowledge/check promotion in this batch. Explicitly defer M4's full
  coding/saturation task and any 150-cell expansion decision not yet supported.
- [ ] Final handoff lists output paths, exact commands and checks, accomplished
  versus blocked gates, all limitations, and the next concrete action. Do not
  claim all 20 succeeded just because packaging is complete.

## Acceptance checklist

- [ ] No frozen inputs, historical evidence, or unrelated user changes overwritten.
- [ ] Runtime/content snapshot, protocol addendum, seeded schedule, isolation and
  measurement smoke checks precede experimental execution.
- [ ] Twenty planned independent conversations are accounted for; no substitute
  subagent rollouts or hidden best-of selection.
- [ ] Every completed package can reproduce its implementation and locate its
  own evidence without consulting mutable workspaces or newest-file heuristics.
- [ ] Blind scores precede unblinding; evidence/cost/missingness denominators are
  explicit; the conclusion can legitimately be no advantage or insufficient data.

## Plan review record

Reviewed and approved on 2026-09-07. Two review findings were incorporated:
complete runtime assets/dependency resolution with post-freeze client smoke,
and preregistered successful-page screenshot capture independent of check PNGs.
The reviewer confirmed plan/prompt consistency and no remaining important issues.
This was document review only; no experimental runs were started.
