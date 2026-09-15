# Prax

> **Prax — Product-first design intelligence for coding agents.**

Prax is a local, stateful design-intelligence runtime exposed through a small,
stateless MCP protocol surface. It makes a coding agent establish the user,
task, product objects, context, and design decisions before implementation.

This repository contains the first executable vertical slice: Architecture
Canvas. It implements all ten staged tools from the v0 specification, explicit
YAML session artifacts, scoped knowledge routing, L0–L3 progressive disclosure,
SDIR linting, capability reconciliation, implementation handoff, and
evidence-aware validation — now backed by a measured artifact-validation
layer (`prax-measure`): browser-measured checks emit hash-bound receipts
that the validator cross-checks against agent claims, with receipt-staleness
invalidation after artifact edits and a runtime-computed review-readiness
packet before any human review. Four layout/focus checks were promoted to
error severity after zero-overkill calibration on all runnable golden apps
(the accreting-gate mechanism's first instance).

## Why Prax exists

Coding agents often receive backend structures and immediately reproduce them
as navigation, forms, or tables. Prax inserts enforceable product-design gates:

```text
Product Frame → Context → Routing → Decision → SDIR
              → Capability Reconciliation → Implementation → Validation
```

The backend remains a constraint and capability source. It does not silently
become the product model.

## Packages

| Package | Responsibility |
|---|---|
| `prax-mcp` | Prax MCP server, twelve tool contracts, orchestration, and CLI |
| `prax-runtime` | Explicit sessions, state machine, artifact persistence, gate validation |
| `prax-knowledge` | Scoped, lifecycle-managed design knowledge with L0–L3 disclosure |
| `prax-router` | Context routing, candidate caps, audit records, disclosure authorization |
| `prax-sdir` | Semantic Design Intent Record generation and render-leak linting |
| `prax-validator` | Context-specific plans, evidence ingestion, typed findings, and measurement-receipt verification |
| `prax-measure` | Measured artifact validation: browser-measured checks (overflow, collision, truncation, contrast, focus order, target size, projected type size) emitting hash-bound receipts under `validation-evidence/` |
| `prax-web` | Reserved for a later review/administration UI; intentionally deferred in v0 |
| `prax-landing` | Product website home page — PRAX-LANDING-001 golden case output (figma_first) |
| `prax-dashboard` | Local operations dashboard — PRAX-DASHBOARD-001 golden case output (direct_code) |

## Requirements

- Node.js 20 or newer
- npm 10 or newer

## Run locally

```bash
npm install
npm run build
npm test
npm run dev:mcp
```

The test suite includes real Chromium integrations and defaults to three
workers to avoid browser oversubscription. Override with
`npm test -- --maxWorkers=<count>` when the host has capacity.

The production stdio entry is:

```bash
node packages/prax-mcp/dist/stdio.js
```

Example MCP client configuration after a build:

```json
{
  "mcpServers": {
    "Prax MCP": {
      "command": "node",
      "args": ["/absolute/path/to/Prax/packages/prax-mcp/dist/stdio.js"]
    }
  }
}
```

Session metadata is indexed under `PRAX_STATE_ROOT` (default `~/.prax`). Design
artifacts live with the target project at:

```text
<project>/.prax/design/sessions/<design_session_id>/
```

## CLI

```bash
prax doctor
prax inspect <design_session_id>
prax validate <design_session_id>
```

During repository development, use `npm run prax -- <command>` after building.

## MCP workflow

Twelve tools: eleven staged lifecycle tools plus `design_correct` (project
correction memory, legal in any phase). `design_start` declares the posture toward
the existing system and the change kind, which expands into a per-session gate
policy:

| mode + change_kind | gates |
|---|---|
| `greenfield` | confirm → frame → context → route → decide → sdir → reconcile → prepare → validate |
| `existing_product` + `add_surface` | confirm → understanding → frame → context → route → decide → sdir → reconcile → prepare → validate |
| `existing_product` + `modify_surface` | confirm → understanding → route → decide → sdir_delta → prepare → validate |
| `existing_product` + `visual_polish` / `defect_fix` | confirm → understanding → intent_lite → validate |
| `rework` | confirm → understanding → frame → context → route → decide → sdir → reconcile → prepare → validate |

1. `design_start` — creates the session and gates it behind a structured
   requirement confirmation (`user_quote`, `restatement`, boundaries, and a
   `confirmation` object whose evidence types must match its status); the
   confirmation may be submitted inline or via a resume call.
2. `design_frame` — payload depends on the current gate:
   `existing_understanding` (existing/rework question sets),
   `product_frame`, or a lightweight `intent_lite` for polish/fix sessions.
   Light intents declare structured impact flags and are cross-checked
   against the change text and the existing surfaces — structural work
   cannot squeeze through a light path (REVIEW with a recommended kind).
3. `design_context` 4. `design_route` 5. `design_inspect` 6. `design_decide`
7. `design_sdir` — full SDIR (`generate_from_decisions` / `validate`) or a
   semantic `sdir_delta` via `apply_delta` for modify sessions (which can
   declare `capability_needs` to pull the reconcile gate back in).
8. `design_reconcile` 9. `design_realize` — full-SDIR sessions must record a
   realization decision before prepare: `direct_code` (explicit, audited) or
   `figma_first` (provider refs + draft + human review through the spliced
   `realize` gate). 10. `design_prepare_implementation` (mode-specific
   integration/change/migration plan) 11. `design_validate` (policy-assembled
   check set).
12. `design_correct` — agent-facing ingestion for project-local correction
    memory (`.prax/corrections.yaml`): evidence refs required, duplicate ids
    and unknown supersedes targets rejected; scoped corrections surface in
    later sessions as compiled-context entries and validation obligations.

Tool order is enforced by the per-session gate policy. Calls after
`design_start` require an explicit `design_session_id`, so a second agent can
resume without replaying a chat transcript. Sessions created before lifecycle
policies keep the original full-chain behavior.

## Measurement evidence (receipt 0.2)

For sessions with a prepare gate, add a target to the existing
`design_prepare_implementation` payload **before** measuring:

```json
{
  "measurement_target": {
    "app_root": "apps/demo",
    "entry": "/",
    "scenario": "entry"
  }
}
```

`app_root` must already exist, be project-relative, and resolve inside the
project. Keep the other mode-specific prepare fields. Then measure that same
directory, entry, scenario, and session (replace the example paths and id):

```bash
node packages/prax-measure/bin/prax-measure.mjs --app /project/apps/demo --out /project/.prax/design/sessions/ds_example --entry / --session-id ds_example --scenario entry --ready-selector "[data-app-ready]"
```

The optional readiness selector must become visible; `--ready-timeout-ms`
defaults to 10000 (maximum 60000). Without it, only basic document readiness
is checked. HTTP errors, blank pages, runtime errors, failed script/style
loads, unexpected dialogs, and unexpected redirects invalidate the target.
The scenario is a label, not an executed user journey.

Each run writes uniquely named receipts and screenshots under
`validation-evidence/<run-id>/viewport-<index>/<check-id>/`; later runs do not
overwrite earlier evidence. Receipt 0.2 binds implementation content and the
SDIR/delta/implementation brief, not just timestamps. Validation compares
these against the prepared target; changed content requires remeasurement.
Plain static serving reports `implementation_current`; `--serve` and Vite
preview report only `association_current` (local source association, not
proof of deployed bytes). See [Architecture](docs/architecture.md) for limits.

CLI exit codes: **0** for completed checks without error-severity failures
(warning failures are allowed), **1** for error-severity failures, **2** for
incomplete checks, invalid targets, or invocation failures. Invalid browser
targets produce diagnostic skipped receipts; failures before capture can
exit without a receipt. Incomplete error-tier 0.2 measurements require REVIEW.

Legacy 0.1 receipts remain replayable as `legacy_unbound` for sessions without
a declared target, but cannot satisfy a prepared binding requirement. A 0.2
receipt without an independently prepared target requires REVIEW and does not
read the receipt's self-declared filesystem root. Existing sessions already
past prepare and light `visual_polish`/`defect_fix` lifecycles have no target
declaration/migration path yet; do not manually rewrite their gated artifacts
to bypass this boundary.

## Correction memory recovery

Correction ingestion serializes project-wide updates with
`.prax/corrections.lock` and replaces YAML using a unique temporary file.
Only a missing corrections file means empty memory: malformed or unreadable
files return `CORRECTIONS_READ_FAILED` and are not overwritten.
`CORRECTIONS_LOCK_HELD` means the lock could not be acquired. Locks are never
stolen based on age. After a crashed writer, stop all project writers and
confirm the recorded owner has exited before manually removing its orphaned
lock/temp file; preserve and repair existing memory rather than deleting it.
This is not a multi-file session transaction or a power-loss durability guarantee.

## v0 boundaries

Prax v0 deliberately has no database, vector store, knowledge enumeration
tool, network service, UI generator, or component library. It supports the Web
Desktop/React implementation handoff only. The knowledge store is small and
auditable, and the router uses deterministic filters and ranking.

See [Architecture](docs/architecture.md), [Constitution](docs/constitution.md),
the [Architecture Canvas Golden Case](golden/architecture-canvas/README.md),
and the [Golden Case Suite](golden/README.md) — PRAX-LANDING-001 (figma_first),
PRAX-DASHBOARD-001 (direct_code), and the queued pricing/wizard cases, each
with a live-run record in `docs/phase-report-2026-08-29.md`.
