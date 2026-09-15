# M3 Protocol Addendum — versioned deviations and pre-registered policies

Status: FROZEN 2026-09-07 before run 01. Any change to arm prompts, runtime,
population, or budget after this point requires a separately approved versioned
protocol BEFORE any affected run. This file is the authoritative delta layer on
top of `m3-runbook.md` / `ab-protocol.md` / `architecture-canvas-ab/runbook.md`.

## D1 — B startup configs repaired (startup infrastructure, pre-freeze)

All ten prepared B `.mcp.json` files failed JSON parsing (`Bad JSON escape
sequence`) and contained a literal `$DIR` in `PRAX_STATE_ROOT`. Originals are
preserved byte-for-byte under `backups/mcp-json-original/<ws>.mcp.json`
(sha256 recorded in `launch/prepare-launch-report.json`). Repaired configs point
`node` at the frozen snapshot's `packages/prax-mcp/dist/stdio.js` and pin
`PRAX_STATE_ROOT` to that workspace's own absolute `.prax` (forward slashes,
pairwise unique). All ten re-validated after rebinding.

## D2 — Arm README moved out of workspaces; prompts issued from operator launch files

Startup READMEs embedded operator metadata (runbook references, packaging
paths, arm-mapping rules) inside experimental workspaces, and were the only
carrier of the frozen arm prompt. Resolution: exact prompt text extracted into
operator-only `launch/<ws>-prompt.md` — the common fenced prompt with the brief
placeholder replaced by the exact frozen `brief.md` bytes; Arm B appends the
exact Prax paragraph found outside the fence. Uniformity machine-verified: 1
fence variant across ten A workspaces, 1 fence + 1 paragraph variant across ten
B workspaces (`launch/prepare-launch-report.json`; prompt/brief sha256 recorded
there). Original READMEs preserved under `backups/README-<ws>.md` and REMOVED
from workspaces. Post-removal grep: zero prax strings in any A workspace; A
workspaces contain exactly `brief.md`; B workspaces exactly `brief.md` +
`.mcp.json`. The m3-runbook step "paste exactly the arm prompt from the
worktree README.md" is superseded by "paste exactly `launch/<ws>-prompt.md`".

## D3 — run-cell.mjs bypassed; direct prax-measure with per-run exclusive output

`run-cell.mjs` files receipts in a per-cell shared directory and reports the
lexically latest `receipt-*.json`, so a failed invocation can leave only
historical receipts and concurrent runs can mis-associate. The frozen wrapper
is NOT edited. Instead the operator invokes the measurement CLI directly with a
NEW `--out` directory per run, binds cell/arm/run externally in the operator
manifest, and records the exact emitted receipt path plus process exit code:

```
node E:/codex-prj/pi-m3-frozen-runtime-20260906/packages/prax-measure/bin/prax-measure.mjs \
  --app <measured-static-root> --out <run-package>/validation-evidence/<run-id> \
  --entry / --scenario entry --viewports 1280x860,1440x900
```

Exit codes: 0 completed without error-severity failures; 1 error-severity
failures (data); 2 incomplete/invalid/invocation failure (diagnostic skipped
receipt or none) — never mistaken for pass, never satisfied by an older
receipt. Smoke evidence: `smoke/`.

Operator-shell note (pre-registered after smoke discovery): in Git Bash, MSYS
path conversion rewrites a bare `--entry /` argument (CLI rejects it as "entry
must be a root-relative URL path"). All recorded operator commands run with
`MSYS_NO_PATHCONV=1` and Windows-style absolute paths (`E:/...`, JSON-safe);
verified equivalent behavior in the smoke cases.

## D4 — Repetitions: exactly one planned run per cell/arm (20 runs)

`ab-protocol.md` requires >=3 runs per arm; the later M3 program and runbook
allow >=1 per cell/arm for the pilot. This batch runs exactly one planned run
per cell/arm, labeled a pilot, with no significance claims. No additional
attempts are selected because of disappointing outcomes; infrastructure retries
are governed by D7.

## D5 — Sessions are fresh non-interactive CLI conversations

Each arm run is a brand-new `claude -p` process at the workspace cwd receiving
exactly its `launch/<ws>-prompt.md` text — no plan, no other-arm output, no
warm-up lessons, no coordinator context. The arm does not ask questions
mid-run; if the agent stops to ask, the operator may resume that SAME
independent session via `claude -p --resume <session-id>` with a material
answer, logged in `operator-events.ndjson`. Material clarifications follow the
parity rule: equivalent info must be offered to the other arm at its next
equivalent opportunity or the run is marked `biased`. Token usage is read from
stream-json usage events; wall clock from real timestamps.

**Token accounting — AMENDED v2 (registered 2026-09-08 before run 02; see
changelog):** the 1.2M cap is evaluated as `modelUsage` totals of
**input_tokens + output_tokens** (cache_read and cache_creation recorded for
transparency but NOT counted), matching the AB-001 `model_usage` convention
that defined the 1.2M budget ("AB-001 median ×1.5"; AB-001 runs record
input+output ≈ 0.9M–2.7M and cache_read 60M–100M listed separately). D5 v1's
"in+out+cache_read+cache_creation" wording was a coordinator drafting error
that would have exceeded the cap on every long cached session including all
historical AB-001 runs. Per-message usage events do not exist in this
CLI/backend stream, so the token cap is evaluated RETROSPECTIVELY from the
final `result.modelUsage`; the enforced live guard is the 90-minute wall
clock. A run whose final in+out exceeds 1.2M is annotated
`token_budget_exceeded_retrospective` and retained as data. Run 01 audit:
in+out = 552,952 → within budget (`run-01-b/execution/run-metadata.audit-token-metric.json`).
Missing token telemetry is recorded `not_observable` with explanation.
Agent-produced
session validation receipts (Arm B may measure inside its own flow) stay in the
session's own evidence tree — they are distinct from the operator's post-run
measurement and are never merged into it.

## D6 — Unprepared 0.2 receipts require REVIEW; no coaching, no backfill

The runtime now emits receipt 0.2 with implementation/contract binding. B's
frozen prompt does not instruct declaring `measurement_target` at prepare, so
B-side session validation evidence may land as REVIEW (unprepared target).
Policy: record it as observed; do not coach B mid-run; do not rewrite gated
artifacts; do not convert REVIEW/skipped into PASS. The operator's external
post-run measurement (D3) is the scoring evidence layer for BOTH arms and is
unaffected by B-side session state.

## D7 — Failure handling: failures are data; retries only for infrastructure

Failed build, failed measurement, timeout, budget overrun, and contamination
are recorded, kept, and counted. A re-run is permitted only when the operator
logs a concrete infrastructure fault (host crash, CLI transport failure before
any agent turn, frozen-runtime corruption) — the original attempt is preserved
and both attempts appear in the ledger; no best-of selection ever occurs.

## D8 — Build/root resolution (pre-registered, identical both arms; AMENDED v2 before run 02 — see changelog)

The frozen measurement CLI's serving heuristic is: if the directory passed as
`--app` contains a `dist/` subdirectory it runs `vite preview` (requiring a
resolvable vite install, which the frozen runtime does not ship) instead of its
static server. Several cells may legitimately ship BOTH a root static tree and
a `dist/`. Resolution rule, applied identically to every run BEFORE any outcome
is consulted:

1. **Case R (root static tree)**: root `index.html` exists → the measured
   artifact is the project root's static tree. The operator stages
   `<pkg>/measurement-root/` as a copy of the workspace EXCLUDING
   `.git/`, `.prax/`, `.mcp.json`, `node_modules/`, and `dist/`, then measures
   and screenshots THAT staged directory (strong `static_tree` binding). A
   coexisting `dist/` stays in `implementation/source/` as supplementary.
2. **Case D (built dist only)**: no root `index.html`, `dist/index.html`
   exists → the measured artifact is the built dist. Stage `<pkg>/measurement-root/`
   as a copy of `dist/` CONTENTS (no nested `dist/`), measure that
   (strong `static_tree` binding of built bytes).
3. **Case B (operator build)**: neither exists and `package.json` has a build
   script → operator runs `npm install` (if needed) then `npm run build` once,
   recorded verbatim with exit codes; then Case D applies. Build failure is
   recorded as data (missing measurement + missing screenshots).
4. Vite preview / `--serve` are NOT used in this batch (the frozen runtime
   cannot run vite; an external server would only weaken binding).

`measurement-root` staging is recorded (rule case, file count, sha256 of
staged `index.html`) in `summary.yaml`; the receipt binds the staged tree and
`implementation/source/ + the recorded exclusions` reproduce it exactly.

## D9 — Pre-registered operator screenshot capture (both arms, independent of checks)

Passing prax-measure checks may emit no screenshots, so receipts alone cannot
supply a blind visual package. BEFORE run 01, the operator therefore
pre-registers: after each arm session stops, on the SAME stopped artifact
snapshot used for measurement (D8-resolved root), capture the initial page at
`/` at BOTH 1280x860 and 1440x900 with the frozen runtime's Playwright
Chromium, no interactions, no code repair, ready-document policy = document
readiness (no ready-selector), saved as
`<run-package>/evidence/screenshots/operator-<viewport>.png` plus a
`capture-manifest.json` recording URL (file:// of the exact root), viewport,
timestamp, browser version, source snapshot id, and image sha256. Failures are
recorded as missing evidence and affect review eligibility, never repaired or
substituted from other runs. Measurement-failure PNGs (if any) stay under
`validation-evidence/`; agent-produced images are preserved separately with
their own provenance.

## D10 — Metrics honesty

The seven browser-measured checks (overflow, collision, truncation, contrast,
focus order, target size, projected type size) do NOT measure task completion
time, retrieval accuracy, user error rate, human preference, or time to
understand. Those are marked `not_observable` in this batch unless a
pre-registered alternative method exists (none is registered for M3). Model
preference is not human preference. No composite scoring formula will be
invented after outcomes are seen. Results legitimately include "no advantage"
or "insufficient data".

## Changelog

- 2026-09-07 v1: D1–D10 frozen before run 01 (with D3 MSYS note and D5 token
  accounting added during smoke, still before run 01).
- 2026-09-08 v2 (before run 02): D5 token accounting amended to the AB-001
  model_usage convention (input+output; cache listed separately; retrospective
  evaluation from result.modelUsage with wall clock as the enforced live
  guard). Evidence: benchmark-runs/PRAX-AB-001/replicates/*/arm-*/summary.yaml;
  run-01 audit annotation. D8 amended with the measurement-root staging rule
  (Case R/D/B) after run-01's measurement exposed the frozen CLI's dist→vite
  preview heuristic. No arm prompt, runtime, population, or budget size
  changed. Registered in operator-events.ndjson before run 02 started.
