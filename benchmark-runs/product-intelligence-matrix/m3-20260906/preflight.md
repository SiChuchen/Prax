# M3 Pilot Preflight — Chunk 1 record (2026-09-07)

Operator: M3 coordinator session (ZCode/GLM). This file records what was
observed and changed BEFORE the freeze; frozen inputs were never modified.

## Source-of-truth documents read

- benchmarks/product-intelligence-matrix/pilot-batch.yaml (10 cells + 2 warmups)
- benchmarks/product-intelligence-matrix/m3-runbook.md
- benchmarks/product-intelligence-matrix/ab-protocol.md
- benchmarks/architecture-canvas-ab/runbook.md
- benchmark-runs/PRAX-AB-001/replicates/README.md
- docs/superpowers/plans/2026-09-02-benchmark-execution.md (M1–M5 program)
- docs/phase-report-2026-09-06.md; README.md; docs/architecture.md (skimmed for
  runtime identity)

## Repository state (rechecked, not assumed)

- HEAD `39ac05c0d9c180c211563620bf2e640aff0d5314`; 30 modified/untracked files
  (evidence-reliability hardening, matches phase-report-2026-09-06).
- `npm test`: **393/393 passed, 52 files** (fresh run 2026-09-07, exit 0).
- No commit created; nothing reverted.

## Frozen inputs verified

- Repo-side briefs and worktree briefs hash-identical for all 10 cells
  (sha256-12 pairs recorded in Task 1 log; e.g. cell-j01-s01 = 29c600b5f4d3).
- pilot-batch.yaml unchanged; warmup workspaces (`cell-j09-s01-warmup-b`,
  `cell-j13-s02-warmup-b`) used, committed, contain `.prax` — PRESERVED
  untouched; never counted as experimental data.

## 20 pilot workspaces (E:/codex-prj/ab-worktrees/pi-matrix)

- All 20: unborn HEAD (empty repo, `git init` only, zero commits), untracked
  brief.md (+README.md at inventory time; +.mcp.json for B). No prior
  implementation, no `.prax` anywhere. Nothing needed reallocation.
- All ten B `.mcp.json` INVALID (JSON parse error, literal `$DIR`) — repaired
  per addendum D1 with originals backed up.
- README operator-info leak — resolved per addendum D2 (moved to backups,
  prompt extracted to launch files, uniformity machine-verified).

## Isolation findings (claude CLI 2.1.251)

- User-scope MCP registry contains a GLOBAL `prax` server pointing at the
  globally npm-installed prax-mcp (stale build, not the frozen runtime). Every
  plain new session would see it — including Arm A. Mitigation: every arm
  session launches with `--strict-mcp-config` (verified present in this CLI
  version): Arm A loads an empty MCP config, Arm B loads only its workspace
  `.mcp.json`. Operator's global config was NOT mutated; post-pilot cleanup
  recommendation recorded in runtime-lock.yaml.
- Global CLAUDE.md / plugins / SessionStart hook: no prax strings (grep
  verified). They inject identically into both arms (parity preserved).
- No claude project memory dirs exist for any pi-matrix workspace path.
- No CLAUDE.md on the cwd chain above the worktrees.
- Isolation limits honestly reported: the CLI cannot cryptographically prove a
  negative (that the model has no prior knowledge of Prax from training or
  other conversations on this machine). Enforced isolation covers: tools/MCP
  surface, cwd-scoped context files, project memory, coordinator transcripts.
  Residual risk accepted and recorded.

## Runtime freeze (runtime-lock.yaml)

- Snapshot: E:/codex-prj/pi-m3-frozen-runtime-20260906 (1020 files hashed;
  excludes .git/node_modules/benchmark-runs/.prax/.prax-state and derived
  app node_modules; includes packages src+dist, prax-knowledge/data, lockfile,
  tests, golden, docs).
- `npm ci` inside snapshot: exit 0 (133 packages). `doctor` inside snapshot:
  PASS (node, knowledge 54 entries, state_store, MCP 2026-07-28).
- Toolchain pinned: node v24.14.0, npm 11.9.0, playwright 1.62.1,
  chromium-1234 (ms-playwright cache), claude 2.1.251, model pin
  `--model sonnet` -> glm-5.3-flash[1M] @ bigmodel endpoint.

## Run order (run-order.yaml)

- Seed `2b71439277291095`, mulberry32 + Fisher-Yates over 20 slots, generated
  and written BEFORE any run outcome existed. Each cell appears exactly once
  per arm; sequential execution, one session at a time.

## Budget (requires operator confirmation before run 01)

- 20 runs x 90 min = 30 serial wall-clock hours ceiling (likely less if agents
  declare done early), plus operator preparation/review overhead outside that.
- Observable token ceiling: 20 x 1.2M = 24M tokens (per-run caps; runs where
  telemetry is unavailable are recorded `not_observable`, not zero).
- No service purchases, no added repetitions (addendum D4/D7).

## Open items requiring operator decision before run 01

1. Confirm the aggregate budget above (30 run-hours + 24M token ceiling) and
   the arm client pin (claude 2.1.251, `--model sonnet` = glm-5.3-flash[1M]).
2. Confirm non-interactive `-p` session mode with resume-on-question policy
   (addendum D5), or name a different preferred mode.
3. Optionally approve post-pilot removal of the global user-scope `prax` MCP
   registration (defense in depth; not required given --strict-mcp-config).

## Smoke checks

Separate file: smoke/smoke-report.md (MCP initialize/tools/call through the
frozen stdio entry, real claude-client initialize, measurement pass/fail/
invalid examples, screenshot capture rehearsal). Chunk 1 is BLOCKED on those
passing.
