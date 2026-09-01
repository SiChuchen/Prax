# ADR-005: Product-Intelligence Chain and Measured Artifact Validation

Status: Accepted (2026-09-01)
Amends: none. Reaffirms ADR-002 (data-driven extension points), ADR-003
(realization gate), ADR-004 (pluggable providers). Supersedes no prior
decision; it absorbs the v0.1 frontend research into the execution line.

## Context

Three independent evidence streams converged on the same gap:

1. **The v0.1 large-sample frontend research**
   (`docs/Prax_Frontend_Product_Intelligence_Research_v0.1.md`, 120 coded
   samples + deep case studies) produced a causal model: Product Intent ×
   User/JTBD × Object × Task × Information Shape × Interaction Need →
   Representation Architecture → IA → Priority/Disclosure → Interaction
   Grammar → State Ownership → Visual Hierarchy → Implementation →
   Validation → Evidence → Evolution Memory (its §34). Its §31 diagnoses why
   bare coding agents emit dashboard shells: Backend Schema Salience,
   Component Prior, and five missing layers — User Model, Information Shape,
   **Representation Decision**, Negative Knowledge, Evolution Evidence.
2. **The Archify dissection** (tt-a1i/archify, external analysis 2026-09-01)
   showed why its artifacts reach a quality ours have not: authored intent in
   a bounded vocabulary → deterministic compile/measure → machine-checkable
   receipts with verified fixes → frozen, hash-bound delivery. Quality there
   is structural and measured; ours, at the artifact level, was attested.
3. **Our own runtime evidence**: PRAX-AB-001 showed an empirical pass
   self-attested over a screenshot containing an error dialog (fixed to
   warning level only); the ECP architecture canvas (external project)
   iterated several times without a composition owner or a readability
   measure and stayed unusable.

The earlier research package (reference_documents D8/D9) already fixed two
load-bearing positions: SDIR is a decision record and reasoning scaffold
(ADR-analogue), **not** a compiler IR, guarded by the Boundary Guard
Principle; and quality rules must be machine-checkable where decidable,
honestly delegated where not. D9's landing order (Q15: pipeline and stock
first, execution machinery second, SDIR tooling last, gated) disciplines the
phasing decided below.

## Decision

1. **The product-intelligence chain becomes the session spine.** The states
   the research names (User/JTBD, Product Object, Task, Information Shape,
   Representation Architecture, Priority/Disclosure, Interaction Grammar,
   State Ownership, Complexity Budget, Acceptance) are structured as
   first-class, gate-checked data. They are carried by **extending existing
   gates** — `design_frame`, `design_decide`, `design_sdir` — and not by
   adding new gates. PRAX-P-024 stands: no new MCP tool and no new lifecycle
   gate is introduced by this ADR.
2. **SDIR evolves 0.1 → 0.2, additively.** New fields: `user_job`,
   `primary_object`, `information_shape`, `representation`
   (primary + supporting portfolio, each with a reason), `priority`,
   typed `interaction` grammar, `state_ownership`, `complexity_budget`,
   `acceptance`. All fields are semantic; the Boundary Guard Principle and
   the render-leak lint apply unchanged. Version is a discriminated union;
   persisted 0.1 sessions resume unchanged. Vocabularies (JTBD verbs, object
   types, representation primitives) ship as **versioned constant tables** in
   code, following the REALIZATION_PROVIDERS precedent.
3. **A measured artifact-validation layer is built** (new package
   `prax-measure` + validator integration): deterministic, browser-measured
   checks on the running page (overflow, truncation, contrast, focus order,
   target size, responsive collision, projected font size) emitting
   structured receipts (`{id, status, severity, subject, measured,
   threshold, evidence_refs, supported_fixes}` per check; field names pinned
   in spec §5.2). Empirical evidence whose content the machine can
   verify **must** be content-verified: the runtime parses receipts, verifies
   referenced evidence files (hash-bound), and refuses a claimed `pass` that
   contradicts a receipt `fail`. The AB-001 self-attestation class closes at
   BLOCK level, not warning.
4. **Validation claims stay non-convertible.** Deterministic / assistive /
   empirical remain separate claim layers (PRAX-P-009); a skipped or absent
   measurement is never a pass; assistive judgment still requires an
   auditable evidence trail and never substitutes for measurement where
   measurement exists.
5. **The correction loop gains a convergence protocol.** The runtime tracks
   open-finding counts per session; repair continues only while the count
   reaches a new minimum, stops after two consecutive non-improving rounds,
   and unresolved findings are reported truthfully instead of retried
   indefinitely.
6. **Quality checks are born advisory and promoted on evidence.** Every new
   measured check ships as warning-level first, is calibrated on the golden
   cases, and is promoted to blocking only after zero-overkill is
   demonstrated. Named checks accrete monotonically — the compounding
   mechanism this program exists to create.
7. **Knowledge assets restructure to the research taxonomy** (five asset
   classes: Product Object / Representation / Composition / Interaction
   Pattern / Validation; stability grades A/B/C; myth-quarantine entries for
   refuted defaults). Phase-gated, after the measurement layer exists.
8. **The ECP cognition workspace is the designated pilot** that exercises the
   full new chain end-to-end (research §40–41), becoming golden case six.
   No universal-shell canvas; representation is derived per user job.
9. **Iteration is a first-class loop with a machine-gated review standard.**
   Neither representation drafts nor final code are one-shot artifacts. Both
   share one loop contract (spec §5.7): an agent-side machine-gate loop
   (candidate → gates → diagnostic repair → re-run; progress = new minimum
   of objective failures; stall = two consecutive non-improving rounds →
   stop and report truthfully), and a human-review loop whose back-edge
   invalidates prior evidence (stale receipts stop counting as coverage).
   Human review is requested only with a runtime-computed readiness packet
   (deterministic gates passed, no open error-severity measurements,
   warnings dispositioned, convergence honestly reported, claims separated)
   — humans adjudicate only what machines cannot decide. Divergence from
   Archify recorded: no hard cap on repair rounds; the stall rule is the
   sole convergence governor (its `correction_rounds ≤ 2` exists because
   each Archify delivery round is a full freeze cycle; our repair rounds are
   cheap).

Non-goals (unchanged and reinforced): no SDIR→code compiler; no auto-layout
engine for general UI; no vector store, hosted service, or visual
generation; no pixel/CSS/component fields in SDIR; no VLM judge as final
adjudicator — perceptual final review stays human.

## Consequences

- The implementation program is specified in
  `docs/superpowers/specs/2026-09-01-product-intelligence-chain-design.md`
  and planned in
  `docs/superpowers/plans/2026-09-01-product-intelligence-chain.md`.
  Execution is phase-gated (0→4); each phase has a test gate and a
  plan-refresh step, so later phases re-plan on earlier evidence rather than
  executing a frozen grand design.
- `design_decide` payloads grow a representation-portfolio contract; default
  shell representations (`dashboard` / `cards` / `tabs` / `modal` — detection
  vocabulary and matching rule pinned in spec §6.3) require explicit
  justification against information-shape variables — negative knowledge
  becomes consumable at the decision point.
- Validation reports bind build/evidence digests; changing the artifact
  after a PASS invalidates the evidence visibly.
- The principle registry gains candidate principles (representation
  decision before implementation; state ownership made explicit; measurement
  over attestation; complexity budget declared). Promotion follows the
  existing rules — this ADR is not promotion evidence.
- Risk register updates: R4 (agent overconfidence) gains a mechanical
  mitigation (receipt cross-check); a new risk — measurement over-kill —
  is accepted and controlled by decision 6.
