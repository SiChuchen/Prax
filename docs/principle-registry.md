# Unified Principle Registry

Single source of truth for all Prax principle text (spec v0.3.1 §4).
Constitution, phase invariants, and candidates are distinguished only by
`status`; no other document may maintain a parallel principle list.

- `constitution` — v0 invariants already in force.
- `phase_invariant` — mandatory for the v0.3.1 implementation phase; not yet
  auto-promoted to the constitution.
- `candidate` — long-term direction accepted, requires Architecture Canvas
  evidence plus at least one independent case / governance review before
  promotion (§41).

| ID | Status | Principle |
|---|---|---|
| PRAX-P-001 | constitution | Product framing precedes design knowledge routing. |
| PRAX-P-002 | constitution | User goals, tasks, and product objects outrank backend nouns. |
| PRAX-P-003 | constitution | The agent receives only knowledge relevant to the current decision. |
| PRAX-P-004 | constitution | Knowledge expands progressively; normal flows stay at shallow disclosure unless deeper evidence is needed. |
| PRAX-P-005 | constitution | Major structural choices name a Pattern, rationale, and rejected alternative. |
| PRAX-P-006 | constitution | Professional-tool density is acceptable only when hierarchy and grouping make it legible. |
| PRAX-P-007 | constitution | SDIR records meaning and commitments, never pixels, CSS, components, or frameworks. |
| PRAX-P-008 | constitution | Capability gaps remain explicit; UI is not silently downgraded to fit an API. |
| PRAX-P-009 | constitution | Deterministic, assistive, and empirical validation claims remain distinct. |
| PRAX-P-010 | constitution | User evidence is submitted by an external actor and is never synthesized as fact. |
| PRAX-P-011 | constitution | Filesystem handoff must let another agent resume from `design_session_id` alone. |
| PRAX-P-012 | constitution | High floor, soft ceiling: defaults prevent accidental low quality without forbidding justified deviation. |
| PRAX-P-013 | constitution | Requirement confirmation precedes design work and preserves quote/restatement/scope evidence. |
| PRAX-P-014 | constitution | Existing-system posture determines lifecycle depth; small changes never pay the full-chain tax. |
| PRAX-P-015 | phase_invariant | Six fidelity seeds are benchmark seeds, not a closed product ontology. |
| PRAX-P-016 | phase_invariant | Composition over classification: context is described on multiple open axes rather than a unique product class. |
| PRAX-P-017 | phase_invariant | Core Product Frame remains small; domain-specific facts live in scoped project context. |
| PRAX-P-018 | phase_invariant | Context Manifest is Runtime-owned derived metadata, not a lifecycle gate or independent authority. |
| PRAX-P-019 | phase_invariant | Product relationships are semantic before visual; region relationships and visual/runtime representations are separate layers. |
| PRAX-P-020 | phase_invariant | Unknown remains unknown; missing project facts are never completed by plausible defaults. |
| PRAX-P-021 | phase_invariant | Validation obligations are materialized and version-locked before implementation. |
| PRAX-P-022 | phase_invariant | Human correction becomes project memory before general knowledge. |
| PRAX-P-023 | phase_invariant | Context is compiled, not dumped. |
| PRAX-P-024 | phase_invariant | Existing MCP surface remains stable unless a genuinely independent workflow gate is proven necessary. |
| PRAX-P-025 | phase_invariant | Reviewed research is canonical upstream; benchmarks calibrate and specialize it rather than silently replacing it. |
| PRAX-P-026 | phase_invariant | Local evidence specializes before it generalizes. |
| PRAX-P-027 | phase_invariant | Domain intelligence adds conditions and examples; it does not replace the stable foundation. |
| PRAX-P-028 | candidate | Implementation is part of design closure; Prax remains responsible for fidelity until sufficient real implementation evidence exists. |
| PRAX-P-029 | candidate | Prax controls design fidelity, not implementation syntax. |
| PRAX-P-030 | candidate | Execution evidence is first-class and must survive the original agent conversation. |
| PRAX-P-031 | candidate | Available skills/components/frameworks/APIs are capabilities, not product-structure authority. |
| PRAX-P-032 | candidate | Capability routing is scoped; do not dump all available skills into the agent. |
| PRAX-P-033 | candidate | Asset scope and maturity are orthogonal. |
| PRAX-P-034 | candidate | User-created intelligence remains portable and user-controlled. |
| PRAX-P-035 | candidate | Contribution is explicit, sanitized, licensed, reviewed and scoped before it can affect shared/system intelligence. |
| PRAX-P-036 | candidate | Reproducibility requires versioned inputs and durable content/source references. |
| PRAX-P-037 | candidate | `no suitable asset` is a valid capability-routing result. |
| PRAX-P-038 | candidate | Local learning may propose candidates but must not silently mutate authoritative user/org/system assets. |
| PRAX-P-039 | candidate | External capability trust is explicit: origin, license, execution class, permissions and risk are part of routing. |
| PRAX-P-040 | candidate | Project truth is scoped to facts that materially affect user-visible meaning, interaction, design decisions or validation. |

## Promotion rules

- `phase_invariant` → `constitution`: after the Architecture Canvas A/B and
  cross-case review confirm the invariant holds under real use.
- `candidate` → higher: requires benchmark IDs, Knowledge Absorption Review,
  and conflict/counterexample records (§41). "The spec says so" is not
  promotion evidence.
- Demotion/removal follows §17.3 (provisional keep/revise/remove/defer after
  the first case; final cross-case stop only after the second case).
