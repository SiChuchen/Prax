# Pre-registered Known Limitations — PRAX-AB-001

Registered before any run (spec §13.10). If a failure matches one of these,
attribute to the baseline limitation first, not to "Prax Product-first
concept failure".

1. **Hardcoded component-contract stub.** Prax `componentContracts()` returns
   hardcoded string stubs, not full semantic component contracts. Risks:
   component-driven or capability-mismatch guidance. Relevant failures →
   attribute to `Capability / Asset Mismatch`. The stub will NOT be reworked
   before this A/B unless it blocks experimental fairness.

2. **Single reviewer.** Blinding is procedural (anonymized labels, randomized
   order, outcome-first); there is no independent second reviewer. Recorded as
   a standing limitation on all outcome claims.

3. **Operator-run harness.** Evidence capture depends on the agent CLI's
   session transcript export and operator discipline, not an automated
   benchmark harness. Token usage may be `not_observable`; process
   replayability claims are bounded accordingly.

4. **Model stochasticity.** No seed control; run-to-run variance is expected
   and is exactly why ≥3 runs per arm are required. Directional signals only.

5. **Requirement reconstruction.** The requirement snapshot is a faithful
   reconstruction from the ecp handoff record (user challenge + agreed
   contracts), not a verbatim chat export. Both arms receive the identical
   file, so fairness holds, but the file is not the historical prompt.

6. **Base includes optimistic v1 self-review.** At base `2c77838`,
   `docs/Canvas_Engine_v1_Review.md` contains pre-correction claims written
   before real-browser verification. Both arms see it equally; agents that
   trust it over the requirement's real-browser mandate may be misled — this
   is an observed-behavior data point, not a protocol flaw.

7. **Prax lifecycle fit.** This task is a `modify_surface` on a small
   well-documented diff; Prax's full-chain value on greenfield/rework paths is
   not tested here. Negative results on this task do not generalize to other
   lifecycles without a second case (spec §35.3).

8. **No correction-memory benefit expected here.** H4 belongs to
   PRAX-MEM-001; this benchmark must not claim correction-memory value.
