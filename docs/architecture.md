# Prax v0 Architecture

## Runtime shape

Prax is protocol-stateless and workflow-stateful. MCP transport lifetime is not
used as product state. Each request carries `design_session_id`; the runtime
loads the authoritative YAML record and gate artifacts from disk.

| Plane | v0 implementation | Boundary |
|---|---|---|
| Protocol | MCP 2026-07-28 over stdio, SDK v2 | Twelve staged tools (`design_realize` added by ADR-003; `design_correct` agent-facing correction ingestion) |
| State | `prax-runtime` local YAML store | Optimistic revision check and atomic rename |
| Knowledge | 23 fully expanded entries | No list-all/search-everything tool; entries are a compiled subset of the versioned `research/upstream/` snapshot, not the whole research asset |
| Routing | Scope filters plus deterministic scoring | 5 principles, 5 heuristics, 3 patterns, 1 profile |
| Intent | SDIR `0.1` / `0.2` (discriminated union; vocab tables in `prax-sdir/vocab.ts`) | Semantic roles and commitments only; 0.2 adds user_job / information_shape / representation portfolio / state ownership / complexity budget / acceptance — still zero pixels |
| Validation | Deterministic, assistive, and empirical checks; measured artifact layer (`prax-measure` receipts verified by the validator: schema, digest, containment, staleness, claim cross-check) | External evidence is never fabricated; measured evidence outranks attestation (P-043); skipped is not passed |

## Gate behavior

Every gate uses only `PASS`, `EXPAND`, `RETRY`, `WARN`, `REVIEW`, or `BLOCK`.
`PASS` and explicitly recorded `WARN` may advance. A failed artifact does not
replace the last valid artifact and does not advance the phase.

## Persistence model

The project-local directory is the handoff packet:

```text
.prax/design/sessions/<id>/
├── requirement.md
├── session.yaml
├── product-frame.yaml
├── design-context.yaml
├── routing-log.yaml
├── design-decisions.yaml
├── screen.sdir.yaml
├── capability-gaps.yaml
├── realization-decision.yaml
├── representation-artifact.yaml    # figma_first only; SDIR-digest bound
├── representation-review.yaml      # human review rounds, append-only history
├── implementation-brief.yaml
├── validation-plan.yaml          # revision-locked, materialized pre-implementation
├── context-manifest.yaml         # runtime-owned derived routing metadata
├── compiled-context.yaml         # task-scoped implementation packet
├── context-compilation-trace.yaml
├── validation-report.yaml
└── validation-evidence/          # prax-measure receipts + bound screenshots (sha256)
.prax/corrections.yaml            # project-local correction/regression memory
```

`session.yaml` contains revision, phase, gate history, routed IDs, disclosure
history, unresolved items, warnings, and artifact references. The global index
contains only the session location and update timestamp.

## Security and integrity assumptions

- Project roots must already exist and are resolved to absolute paths.
- Artifact filenames are fixed by the runtime; callers cannot inject paths.
- Writes use a unique temporary file followed by atomic rename.
- Stale revisions are rejected.
- Knowledge inspection is limited to previously routed IDs and eight IDs per call.
- L2 and L3 requests require decision- or evidence-specific reasons.
- SDIR recursively rejects known render keys and render values.
- Evidence-file verification is prefix-contained: `rep-evidence/` (realization
  drift) and `validation-evidence/` (measurement receipts) both resolve and
  realpath-check against their own directory; receipt sha256 digests are
  recomputed from disk, never trusted from the declaring check.

## Lifecycle policies

Sessions carry a `lifecycle_policy` snapshot (version 1) expanded from
`(mode, change_kind)` at `design_start`. The state machine resolves the current
gate from the policy plus normalized `completed_gates` (legacy gate names such
as `frame`/`prepare_implementation`/`validation` map to `framing`/`prepare`/
`validate`), so pre-policy sessions resume with their original full-chain
behavior. `sdir_delta` payloads that declare `capability_needs` splice a
`reconcile` gate in before `prepare` at commit time. `design_sdir` validate
mode remains callable after the SDIR gate as a read-only cross-phase check.
Policy v2 sessions with a full SDIR gate splice a `realize` gate between
reconcile and prepare when figma_first is proposed; prepare rejects v2
full-SDIR sessions without a recorded realization decision
(`REALIZATION_REQUIRED`).

## Concept boundaries (v0.3.1)

- **Relationships live on three separate layers**: Product Relationship
  (`product-frame`, connects product objects), SDIR Region Relationship
  (`screen.sdir`, coordinates UI regions), and Implementation Representation
  (visual/runtime expression of a relationship). Cross-layer references are
  optional and typed; no universal graph IR; `condition` stays opaque text.
- **CanonicalClassification is a bounded routing signal**, one input among
  others to the session Context Manifest; the Manifest is Runtime-owned
  derived metadata, never an agent-submitted authority.
- **Validation `kind` stays `deterministic | assistive | empirical`.**
  Semantic/behavioral/spatial/… are facets/profiles on a separate field.
- **The design responsibility boundary runs through implementation**: SDIR
  excludes CSS/JSX detail, but Prax still supervises design fidelity via
  persisted validation obligations and drift evidence — Prax controls design
  fidelity, not implementation syntax.
- **The review-readiness packet is runtime-computed** (spec §5.7): evaluation
  output carries a `readiness` block (deterministic gates, open error-severity
  measurement failures, warning dispositions, convergence truth, evidence
  currency, measured/attested/skipped claim split) that agents cannot
  self-declare — human review runs downstream of machine gates (P-045).
- **The representation portfolio replaces the single archetype reference**:
  0.2 sessions decide primary + supporting + rejected representation before
  SDIR (`design_decide`), carry it into SDIR 0.2 with a drift cross-check
  (`SDIR_REPRESENTATION_DRIFT`), and compile it into the implementation
  context. Default-shell vocabulary (dashboard / cards / tabs / modal,
  with CJK synonyms) demands justification against information-shape
  variables (`DECISION_DEFAULT_SHELL_UNJUSTIFIED`, REVIEW).
- **State ownership is a declared layer** (0.2): selection, preview,
  inspector, viewport, query, and mode ownership name a region, `session`,
  or `url` — emergent ownership is a check failure, not a style note.
- **Figma is a Representation Surface**: the authority chain is Design
  Contract → Representation Artifact → provider refs; the runtime never
  connects to Figma (agents drive the provider MCP), and same-node edits
  after approval are a documented residual risk covered by
  `representation_runtime_drift` evidence.

## Deliberate v0 constraints

`prax-web`, remote persistence, vector retrieval, knowledge administration,
visual generation, additional platform adapters, and the full research catalog
remain deferred until the Architecture Canvas vertical slice provides evidence
that they are necessary.

