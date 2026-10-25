# ADR-006: measure→fix loop inside design_validate

Status: ACCEPTED 2026-10-24 · Supersedes nothing (extends ADR-005 / spec §5.4, §5.7)

## Context

Two rounds of pre-registered evidence converged on the same finding:

- r3 (m3-r3-ablation): H-23 was router-selected in 9/10 Prax sessions and
  inspect-surfaced in only 2/10; the causal ablation verdict was NEGATIVE at
  the pre-registered bar — the knowledge channel did not move measured
  accessibility.
- m4 (m4-probe-20261024): guaranteeing full H-23 content in the prompt (P2)
  produced no increment over standard Prax (P1); but ONE round of
  check-results-only feedback (P3) took a 5-fail implementation to 2 fails
  (contrast/type/target fixed) while the placebo second round (P3p) fixed
  nothing. Feedback content — not extra effort, not knowledge — is the
  active ingredient.

Meanwhile the baseline flow requires the agent to discover failures itself:
it must run the prax-measure CLI, read receipts, and iterate unprompted. In
the r3 batch only 6/20 B-arm sessions reached runtime COMPLETE; the
measure→fix handoff is part of that closing friction (Gate F).

## Decision

`design_validate` (evaluate mode) gains a server-side measure→fix loop:

1. **Trigger**: a `measurement_target` is prepared AND the submitted evidence
   references no measurement receipt. If the agent already runs and cites its
   own receipt, the existing path is untouched (backward compatible).
2. **Prax runs the 7 browser checks itself** via `prax-measure`'s
   `runMeasurement` (workspace dependency), writing the receipt into the
   session's `validation-evidence/` with operator-grade provenance — this
   *strengthens* the spec §5.4 trust boundary (measured > attested; the
   receipt is no longer agent-produced bytes).
3. **On error-level failures**: return `EXPAND` + `MEASUREMENT_FIX_REQUIRED`
   with `measurement_feedback` = per-check `{check_id, status, measured}`
   (m4 F1 lesson: check id + measured values only — no remediation advice).
   The agent fixes and calls design_validate again.
4. **Cap**: 3 measurement rounds per session (`measurement_loop.attempts` in
   the validation report). Feedback rounds do NOT enter the B3 convergence
   history (they are measurement rounds, not stalled evaluations). After the
   cap the flow degrades to the conventional evaluation.
5. **On all-green**: the server-generated receipt is woven into the evidence
   item for `untouched_surface_regression`, so the final evaluation binds it
   as *measured* provenance and can close the session in one flow.
6. **Failure/timeout** (120s cap): `EXPAND` + `MEASUREMENT_UNAVAILABLE` with
   the self-run CLI fallback instruction — the gate is never blocked by
   measurement infrastructure.

## Amendment m5.1 (2026-10-25) — measurement-procedural rounds leave the B3 history

Evidence (`m5-loop-20261024`): the loop engaged in 4/4 E1 sessions and fixed
measured a11y (contrast 4/4 vs 0/2), but 3/4 sessions stalled at
`VALIDATION_CONVERGENCE_STALLED`. One phenotype is a protocol bug: s4's
convergence history was `[0,0,0,0]` — receipt-plumbing rejections
(`MEASUREMENT_RECEIPT_MISSING`, `MEASUREMENT_BINDING_INVALID`) append
zero-open-finding entries, and three flat zeros trip the stall on a session
with nothing unresolved (the stall message "report unresolved findings" is
vacuous there). §4's exclusion principle — measurement rounds are not
stalled evaluations — extends to ALL zero-open-finding non-PASS rounds:
they carry no convergence signal and no longer append. A prior stall
persists through them (a partial all-pass submission is progress on
evidence, not a new findings minimum) until a round with open findings
reaches a new minimum or a PASS completes. Rounds with ≥1 open finding
stall exactly as before (m5 s5/s6's flat-3 SDIR-contract stalls are the
detector working as designed — that discoverability gap is registered
separately, not a convergence-protocol change).
Tests: `tests/validation-convergence.test.ts` (400/400).

## Alternatives rejected

- **New `design_measure` tool**: widens the 12-tool surface for no benefit;
  the loop belongs to validation semantics.
- **Async measurement job table**: MCP request/response is synchronous;
  polling machinery adds state for a sub-2-minute operation.
- **Keep agent-run CLI as the only path**: that is the status quo the m4
  evidence argues against.

## Consequences

- prax-mcp depends on prax-measure (workspace ref added; Playwright becomes
  a transitive runtime dep of the MCP server — acceptable: the server already
  runs on the operator's machine where measurement is expected).
- MCP clients must tolerate up to ~2 min on the first validate call
  (documented in README; claude-code `MCP_TIMEOUT` guidance).
- The loop is injectable for tests (`measureRunner` option on
  `PraxService.create`).

## Evidence trail

`benchmark-runs/product-intelligence-matrix/m3-r3-ablation-20260918/ablation-report.md`
· `benchmark-runs/product-intelligence-matrix/m4-probe-20261024/probe-report.md`
· `benchmark-runs/product-intelligence-matrix/m5-transition/m5-entry.md` §7
