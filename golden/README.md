# Golden Cases — 出题总纲 (harder-page suite)

PRAX-LANDING-001 validated the happy path: one greenfield figma_first
marketing page. This suite adds harder page archetypes, designed after how
the field benchmarks AI frontend generation:

- **Visual fidelity** — Design2Code (NAACL 2025) scores high-level CLIP
  similarity plus low-level block/text/position/color matching
  (arXiv:2403.03163).
- **Functional interactivity** — WebGen-Bench (NeurIPS 2025) has an
  LLM-agent unit-test generated multi-file sites against instructions
  (arXiv:2505.03733); FrontendBench pairs 148 prompts with test cases across
  five component levels, atomic to complex interactive
  (arXiv:2506.13832); IWR-Bench rebuilds real stateful sites.
- **Rubric judging** — WebDevJudge studies MLLM-as-judge for web quality
  (arXiv:2510.18560). Prax already runs the strongest form of this:
  evidence-gated validation with human decision provenance.

Difficulty axes we vary (landing had none of the first four): real states
(loading/empty/error/selected), density (compact vs spacious), interaction
logic with deterministic assertions, multi-view/stateful surfaces, and
realization-mode coverage (direct_code propose is still live-untested — both
existing-product lifecycles skip the realize gate by design).

## Queue (run in order)

### 1. PRAX-DASHBOARD-001 — greenfield + direct_code (`prax-dashboard/`)

Closes the direct_code realize-gate live gap. Compact density (first
non-spacious case), real states with deterministic Playwright assertions,
zero visual uncertainty (tokens pinned in the requirement) so direct_code
fit is honest. Golden observations: propose direct_code accepted before
prepare; validation plan carries NO representation checks; states + keyboard
verified live.

### 2. PRAX-PRICING-001 — existing_product + add_surface + figma_first (`prax-pricing/`)

Second figma_first case (Gate D: n=2 before treating the realization gate as
stable) and the first add_surface lifecycle. Pricing/comparison page on the
landing site: genuinely editorial (visual uncertainty, stakeholder approval,
spatial exploration all honestly hold), and it must integrate with the
existing shell + tokens (integration_plan path never run live).

### 3. PRAX-WIZARD-001 — greenfield + direct_code (`prax-wizard/`)

Multi-step wizard form with validation, the hardest state machine: per-step
validation, error/selected states, keyboard-only completable, resumable
draft. Functional assertions are fully deterministic (FrontendBench-style
interactive scenarios). Exercises the state_model impact flag and
STATE-FEEDBACK component contract.

### Cross-case probes (fold into the runs above)

- Mid-chain `design_correct` on the dashboard run: a correction recorded
  between gates must appear as a validation obligation in that run's plan
  (first in-chain exercise of the new ingestion tool).
- One deliberate capability gap declared during reconcile (dashboard export
  needs a backend that does not exist) to exercise `gap` status with an
  explicit compromise — never run live.

## Validation style per case

Prax gates remain the spine (decisions, SDIR lint, evidence-aware
validation). Deterministic functional assertions (Playwright) serve as
empirical evidence, mirroring FrontendBench's prompt–test pairing; visual
cases add region-scoped screenshot evidence as in PRAX-LANDING-001. No
VLM-judge: Prax's evidence rules demand artifacts, not attestation.
