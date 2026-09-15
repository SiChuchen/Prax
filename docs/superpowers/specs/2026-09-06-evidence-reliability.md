# Evidence Reliability Implementation Plan

> **For agentic workers:** Use subagent-driven-development for the independent storage task and TDD for every behavior change. Do not commit or change frozen benchmark artifacts in this execution.

**Goal:** Remove demonstrated false passes, recover from lock failures, protect correction memory, and bind new measurement evidence to an immutable run and the measured implementation.

**Architecture:** Keep the existing local-file runtime and seven-check catalog. Harden their boundaries rather than introducing a database or workflow framework. Preserve legacy receipt parsing/replay; new receipts explicitly carry target validity and implementation provenance. Frozen benchmark inputs remain unchanged.

**Tech Stack:** TypeScript, Node filesystem APIs, Zod, Playwright, Vitest.

## Chunk 1: P0 recovery and target validity

### Task 1: Session and correction persistence

Files: `packages/prax-runtime/src/artifact-store.ts`, `packages/prax-runtime/src/corrections.ts`, a small runtime file-lock/atomic-write helper if needed, `packages/prax-runtime/src/index.ts`, the correction handler in `packages/prax-mcp/src/service.ts`, and runtime/correction tests.

- [x] Write regressions for a held lock followed by a successful retry on the same store; corrupt YAML/schema and non-ENOENT read errors; concurrent correction inserts and duplicate insertion races.
- [x] Run `npx vitest run tests/runtime-and-routing.test.ts tests/correction-ingestion.test.ts tests/correction-memory.test.ts` and observe expected failures (build workspace dependencies when necessary).
- [x] Always release the local queue on lock acquisition failure. Move correction read/validate/write inside a project-scoped exclusive lock and use unique-temp atomic rename. Only missing files mean empty memory; corrupt/unreadable memory must produce diagnostic errors without overwriting bytes.
- [x] Re-run focused tests. Preserve existing MCP success/duplicate/supersedes behavior. Do not claim whole-session multi-file transactionality; record that as a separate follow-up.

### Task 2: Focus identity

Files: `packages/prax-measure/src/checks/a11y.focus_order.ts`, `tests/measure-a11y.focus_order.test.ts`.

- [x] Add a failing real-browser case with consecutive id-less buttons and a missing focus indicator on the second button.
- [x] Run `npx vitest run tests/measure-a11y.focus_order.test.ts`.
- [x] Track node identity separately from the human-readable selector. Treat a repeated focus trap or unfinished bounded walk as incomplete, not a successful full traversal.
- [x] Verify ordinary DOM order, id-less controls, focus traps and traversal limits.

### Task 3: Measurement target validity

Files: `packages/prax-measure/src/runner.ts`, `packages/prax-measure/bin/prax-measure.mjs`, `tests/measure-runner.test.ts`, `tests/measure-cli.test.ts`.

- [x] Add failing cases for HTTP 404, unhandled script errors, blank documents, missing explicit readiness markers, and a valid delayed readiness marker.
- [x] Run `npx vitest run tests/measure-runner.test.ts tests/measure-cli.test.ts`.
- [x] Verify navigation response, collect page errors/dialogs, and wait for optional caller-declared readiness conditions with bounded timeouts. No invalid target may yield a passing check. Failed preconditions must persist diagnostic skipped evidence and cause the CLI to exit nonzero.
- [x] Keep readiness opt-in for legacy callers; describe the limit of generic ready-page detection. A caller-provided marker is not independent proof of task correctness.
- [x] Re-run browser and CLI tests.

## Chunk 2: P1 immutable, implementation-bound evidence

### Task 4: Immutable run files

Files: runner, receipt writer, runner/receipt tests.

- [x] Add a regression running failing measurements twice in one output directory with changed content; verify old receipt bytes and every referenced screenshot digest remain unchanged.
- [x] Give every run a unique directory and rebase check evidence refs under it. Give receipt filenames collision-resistant identities even for identical timestamps.
- [x] Verify no temporary files remain after successful writes and legacy flat receipt refs remain readable.

### Task 5: Implementation and contract binding

Files: `packages/prax-runtime/src/evidence-files.ts` or a dedicated content-binding module, runtime exports, `packages/prax-validator/src/contracts.ts`, `packages/prax-validator/src/artifact-evidence.ts`, runner, measurement/evidence contract tests.

- [x] Add tests for deterministic implementation digests, excluded transient outputs, implementation changes during/after measurement, contract digest drift, wrong session/target binding, and legacy receipt replay.
- [x] Introduce a versioned new receipt binding: unique run id, entry/scenario, measured implementation digest/root, optional session id, and design artifact digests. Hash the actual built-in static tree when serving it; Vite preview and externally served apps record their weaker local-source association explicitly.
- [x] Compare local implementation and contract digests at verification for new receipts, reject target mismatches, and never treat legacy receipts as implementation-bound. Preserve frozen legacy parsing and report their weaker provenance explicitly.
- [x] Require caller-specified readiness/scenario metadata to describe coverage; do not imply automated user-journey coverage that did not execute.
- [x] Run focused measurement, validator, legacy replay, and MCP suites.

### Task 6: Verification and documentation

- [x] Independent spec review followed by code-quality review; fix material findings with regression tests.
- [x] Run `npm test`, `git diff --check`, CLI smoke and inspect the final diff.
- [x] Update architecture/README with new receipt behavior, migration boundary and remaining limits.
- [x] Record exact results and remaining work. Ten-cell execution, semantic-authoring changes and large service refactoring are separate follow-up work; do not silently alter the frozen experiment to accommodate this hardening.

## Execution result

Completed against baseline `39ac05c`, without commits or frozen benchmark changes.
Final `npm test`: **393 passed in 52 files**, including the original legacy replay
suite. The original baseline was 343 tests in 50 files. Independent reviews
identified and drove additional regressions for body focus traps, excluded
static dependencies, and delayed/interaction-triggered SPA route drift.

The unconstrained worker run exposed five 5-second timeouts (including unchanged
legacy tests); the full suite passed with `--maxWorkers=3`. The default worker
budget is now three, and plain `npm test` passed in 51.45 seconds without
loosening assertions. `git diff --check` and workspace-local CLI doctor passed.
README and architecture document API usage, recovery and compatibility limits.
See `docs/phase-report-2026-09-06.md` for the execution record and follow-ups.
