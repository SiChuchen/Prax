# Evidence reliability hardening - 2026-09-06

## Scope and baseline

Implemented the approved P0 reliability and P1 measurement-binding slice in
the working tree, based on `39ac05c`. No commit, branch switch, dependency
upgrade, or frozen benchmark/golden modification was made. Baseline verification:
343 tests in 50 files passed.

## Delivered

- Session queue recovery after file-lock acquisition failure.
- Project-serialized correction insertion, atomic unique-temp replacement,
  corruption/read-error diagnostics, and no age-based correction-lock stealing.
- DOM-identity focus traversal with honest incomplete results for focus traps,
  body key traps, and traversal limits.
- Target preconditions and diagnostic invalid receipts for HTTP/blank/runtime/
  dialog/resource/readiness failures. URL checks cover origin/path/query/hash
  after readiness and after each check, including exceptional paths.
- Unique run/viewport/check screenshot paths and collision-resistant receipt
  filenames; subsequent runs leave earlier receipt/evidence bytes unchanged.
- Receipt 0.2 implementation/contract binding and prepared-target verification
  through the real MCP workflow. Changed content, wrong session/entry/scenario,
  or invalid targets cannot complete validation. Error-tier incomplete checks
  require REVIEW instead of self-attested completion.
- Explicit static-tree versus external/Vite local-source association strength;
  legacy replay compatibility without a legacy bypass for prepared targets.
- README usage/migration/recovery instructions and architecture trust boundaries.

## Verification record

Behavior regressions were exercised RED before their fixes and GREEN afterward.
Storage focused tests passed 62/62. Independent review found three additional
boundary gaps (body traps, serving digest-excluded files, and delayed SPA entry
changes); each received a regression and correction. The last route regressions
first reproduced three false seven-check passes and one six-check pass, then
passed 4/4 with the fix. Final independent review found no new important issues.

| Command | Result |
|---|---|
| Initial unconstrained `npm test` after implementation | 384 passed, 5 timed out at 5 seconds; no assertion failures |
| `npm test -- --maxWorkers=3` before final route regressions | 389/389 passed, 52 files |
| Final plain `npm test` | **393/393 passed, 52 files**, 51.45 seconds; includes TypeScript build |
| `git diff --check` | Exit 0; only local LF/CRLF conversion notices |
| `node packages/prax-mcp/dist/cli.js doctor` | PASS: Node, 54-entry knowledge pack, workspace-local state, MCP |
| `change_analyzer.js --mode working` | Exit 0; generic README advisories; manually checked actual Git diff and docs |

The default Vitest worker cap is now three because test files launch their own
Chromium instances. This controls resource oversubscription rather than weakening
assertions; callers can override the budget. The final suite adds 50 tests over
baseline. CLI doctor used `.prax-state/reliability-smoke`, not the global user
state root. The generic change analyzer reports zero line totals on this host,
so it is not the authority for change size or design-document presence.

## Remaining boundaries / next work

1. Run the prepared ten-cell pilot separately, with its frozen inputs intact;
   this change does not establish a product-quality benchmark improvement.
2. Add a deliberate target-declaration/migration path for light lifecycles and
   sessions already past prepare. New unprepared 0.2 evidence currently requires
   REVIEW; legacy receipts remain explicitly unbound.
3. Design session multi-file transactions/index recovery and ownership-safe
   session stale-lock handling. Correction locks can require manual crash recovery.
4. Stronger deployed-byte provenance and executed user-journey coverage are not
   implemented. Vite/`--serve` is only local association; scenario is only a label.
5. Hash snapshots detect ordinary drift, not malicious same-writer forgery or
   change-and-restore races. No fsync/power-loss durability guarantee is claimed.

Semantic-authoring changes, large service refactoring, and broader platform
features remain outside this implementation slice.
