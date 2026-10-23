# M4 Contrastive Probe Protocol — m4-probe-20261024

Status: FROZEN 2026-10-24 before any probe run. Supersedes
`../probe-pilot-draft.md` (draft reviewed by independent subagent review,
verdict APPROVE-WITH-CHANGES; all P1 findings and P2 findings 6–12
incorporated here). Operator approval on record: "子代理审查一下,没问题就
继续吧" (2026-10-24) with subagent review passed.

## 1. Question (from r3 §6 two-stage mechanism)

r3 established: H-23 was router-SELECTED in 9/10 B sessions but
design_inspect-SURFACED in only 2/10; where surfaced, no check improved.
The dominant breakpoint is selection→surfacing. This probe asks the next
question with a bypass: **if the entry's content is placed directly in the
agent's context (no expansion step), is it applied?** — i.e., is the content
sufficient once delivery is guaranteed? Secondary: does one measurement-
feedback round (closed loop) fix it? Tertiary (placebo-controlled): is any
P3 gain just an extra-pass effort effect?

Cell: **cell-j13-s10** (never-surfaced cell; r3 run-02-b anchor). Brief
sha256 `f1a0496c95ba5aba3a25050e36315d525f93817b40a93a0339d2acc827f43c7b`.
In-cell r3 anchor (run-02-b): contrast FAIL, focus PASS, target FAIL, type
FAIL — improvable surface = contrast/type/target; focus can only regress
(monitored, not scored as improvement).

Known limits accepted at freeze (reviewer's unresolved confounds): long-context
dilution (t=0 injection vs t≈45min styling) is observationally equivalent to
content-not-decisive; breakpoint 3 vs 4 (lost-in-CSS vs overwritten-later)
cannot be separated from final-state artifacts; single-cell results do not
generalize to other briefs.

## 2. Arms and slots (7 runs)

All arms share: cell-j13-s10 brief (byte-identical), frozen r3 runtime
snapshot `pi-m3-frozen-runtime-r3-20260918` (manifest 681653b4…), flash model
routing (`--model sonnet`), 90-min / 1.2M in+out **combined** budget across
all rounds of a slot, same 1280x860 + 1440x900 operator screenshots, same
D8v2 Case R staging for measurement.

| Slot | Arm | n | Launch prompt | Rounds |
|---|---|---|---|---|
| s1 | P0 | 1 | r3 arm-A prompt (`cell-j13-s10-a-prompt.md`, verbatim) | 1 |
| s2,s3 | P1 | 2 | r3 arm-B prompt (`cell-j13-s10-b-prompt.md`, verbatim) | 1 |
| s4,s5 | P2 | 2 | arm-B prompt + Appendix A (H-23 serialized, frozen below) | 1 |
| s6 | P3 | 2 | arm-B prompt; round 2 = feedback message F1 | 2 |
| s7 | P3p | 1 | arm-B prompt; round 2 = placebo message F2 | 2 |

P0↔P2 differ in prompt bytes beyond H-23 (Prax paragraph) — pre-registered:
**P2−P1 is the load-bearing contrast**; P0 anchors raw-model level only.

**Appendix A (P2 serialization, frozen)**: the H-23 entry as the raw YAML
block from `pi-m3-frozen-runtime-r3-20260918/packages/prax-knowledge/data/
knowledge.yaml` lines 1872–1934, embedded verbatim in a fenced code block
under the heading `## Appendix A — Knowledge entry H-23 (Accessibility AA
Floor)`. tools/serialize-h23.mjs emits it; sha256 recorded in the freeze
record. No other wording added.

**F1 (P3 round-2 feedback, frozen)** — check ids and measured values only,
no remediation advice:

```
Automated browser checks ran against your implementation. Results:
a11y.contrast: <pass|fail> (measured ratio <min-ratio> on <worst-selector>)
a11y.focus_order: <pass|fail|skipped(<reason>)>
a11y.target_size: <pass|fail>
type.min_projected_size: <pass|fail> (smallest <Npx>)
Fix the failing checks. Do not refactor working behavior.
```

**F2 (P3p placebo, frozen)**: "Run one final review pass of your
implementation against the brief and fix anything you find. Do not refactor
working behavior."

P3/P3p round 2 uses `claude --resume <round-1 session-id>` with the same MCP
config and cwd; wall clock and modelUsage are summed across rounds; round 2
transcript/metadata stored as separate files; mid-flight measurement runs
between round-1 exit and resume, staged from a workspace COPY (D8v2 Case R),
never written into the live workspace.

## 3. Pre-registered readout (mechanically decidable)

Checks (from prax-measure receipts): `contrast` = a11y.contrast pass;
`type` = type.min_projected_size pass; `focus` = a11y.focus_order pass
(regression monitor); target observational. **skipped ≠ pass.**

Traces on final artifacts (frozen code in tools/trace-checks.mjs):
- **T-c**: contrast receipt pass (receipt is the authority; no CSS re-derivation)
- **T-fs**: no declared `font-size` < 12px anywhere in the artifact tree
  (regex `font-size\s*:\s*(\d+(?:\.\d+)?)px`, flag any capture < 12; run-02-b
  baseline FAILS this — discriminating)
- **T-fo**: a `:focus-visible` or `:focus` rule declaring a visible outline/
  box-shadow exists (LOW specificity — pre-registered: run-02-b already passes
  this; informative only)

Arm predicate (exact): for arm X with runs R(X), `contrast(X)` = number of
runs with contrast pass; "X>Y" ⟺ contrast(X) ≥ contrast(Y)+1 AND type(X) ≥
type(Y); "X≈Y" otherwise (ties and mixed results). Primary contrast:
P2 vs P1. Secondary: P3 vs P2; P3 vs P3p.

Interpretation matrix (in order; first match wins):

| # | Observation | Reading (max action level) |
|---|---|---|
| 1 | P2>P1 with T-fs improved in the winning P2 run | content IS sufficient when delivered → fix the surfacing mechanism (auto-expand admitted entries at decide/validation phase); breakpoint = selection→surfacing confirmed |
| 2 | P2>P1 with T-fs NOT improved (contrast pass without trace) | weak content-effect, trace-unexplained → treat as noise; escalate n before any mechanism change |
| 3 | P2≈P1 AND P3>P2 | content insufficient, closed loop works → prioritize measure→fix loop in design_validate; P3 vs P3p decides effort vs signal (if P3≈P3p, the gain is extra-pass effort, not feedback) |
| 4 | P2≈P1 AND P3≈P2 AND P3≈P3p | entry inert as authored → **rewrite H-23 (more specific, palette-level dos/don'ts) and re-probe on a second cell**; retirement requires multi-cell evidence — NOT permitted from this batch |
| 5 | P3 < P2 (regression) | feedback round harms → breakpoint 4 evidence (applied-then-overwritten); investigate round-2 diffs |
| 6 | any arm's mid-flight or final measurement invalid after ONE retry | arm analyzed at measurement-invalid; slot not re-run further; recorded as data |
| 7 | P1 contrast pass ≥1 while r3 batch had 0/9 on this cell | in-batch replication gap → hypothesis only; probe-mode adoption requires ≥3 cells |

Action-level caps (pre-registered): this batch may justify (a) engineering
the surfacing fix, (b) engineering the feedback loop, (c) rewriting H-23 for
a second-cell re-probe. It may NOT justify retiring H-23, generalizing to
other entries, or adopting probe mode as the standard admission path.

## 4. Execution rules

- Launch failure with no agent turn → idempotent retry (r3 run-01 rule);
  agent-turn failures are data (D7 lineage).
- Measurement `invalid_target` → exactly one retry (staging re-checked),
  then archived with cause.
- Cost ceiling $80 across the batch; breach → stop, report partial.
- Comparability capture per run (tools/probe-run.mjs): model string from
  transcript init event; Playwright + Chromium versions; frozen-tool hashes.
- Window: daytime execution with operator consent (this document); no
  blind review in this pilot (mechanical readout only) — any future
  qualitative add-on requires blinding before it runs.

## 5. Freeze record (to be filled at cut)

- Appendix A sha256: `<filled by serialize-h23.mjs>`
- probe-run.mjs / trace-checks.mjs / setup-probe.mjs / probe-loop.mjs sha256: `<at cut>`
- Runtime manifest re-verified: 681653b4… (`tools/probe-loop.mjs` checks)
- Brief hash re-verified: f1a0496c…
- Slot registry: s1 P0 / s2 s3 P1 / s4 s5 P2 / s6 P3 / s7 P3p, workspaces
  `E:/codex-prj/ab-worktrees/pi-matrix-m4/<slot>-<arm>`
