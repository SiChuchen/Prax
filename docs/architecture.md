# Prax v0 Architecture

## Runtime shape

Prax is protocol-stateless and workflow-stateful. MCP transport lifetime is not
used as product state. Each request carries `design_session_id`; the runtime
loads the authoritative YAML record and gate artifacts from disk.

| Plane | v0 implementation | Boundary |
|---|---|---|
| Protocol | MCP 2026-07-28 over stdio, SDK v2 | Twelve staged tools (`design_realize` added by ADR-003; `design_correct` agent-facing correction ingestion) |
| State | `prax-runtime` local YAML store | Optimistic revision check and atomic rename |
| Knowledge | 34 built-in entries (23 migrated + 11 myth-quarantined) + first-batch corpus files (`corpus-*.yaml`, multi-file merge) | No list-all/search-everything tool; asset_class/stability/trigger_conditions per spec §7.1; myths surface only at decide-time checks, never in default routing; 0.1 documents rejected — migration script is the sanctioned path |
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

### Persistence hardening (2026-09-06)

Session lock acquisition failures release the in-process queue, allowing a
subsequent request on the same store to retry. The existing session stale-lock
policy is unchanged; this does not solve lease ownership or multi-file commit
atomicity. A session artifact, session metadata, and the global index can still
need reconciliation after interruption.

Correction insertion uses a separate **project-scoped** exclusive lock across
the entire read/validate/write operation, including duplicate and supersedes
checks. Distinct state roots therefore cannot lose each other's corrections.
Only ENOENT is empty memory; corruption and other read errors fail closed.
Unique-temp atomic replacement protects the last valid file. Correction locks
are not reclaimed by age: stop writers and verify the recorded process has
exited before manually removing a crash-orphaned lock/temp file. There is no
fsync/power-loss guarantee or protection from out-of-protocol manual writers.

## Measurement trust boundary (receipt 0.2)

The runner keeps the seven-check catalog and checks target preconditions before
each check/viewport: successful navigation, expected URL, nonempty rendered
document, optional visible readiness selector, and no observed page errors,
dialogs, or failed script/stylesheet requests. Any invalid target invalidates
the entire run; diagnostic skipped results cannot become a false green result.
Focus traversal uses DOM node identity, with repeated focus, a trapped body,
or an exhausted traversal budget reported as incomplete. A basic ready
document is not proof of application/user-task correctness, and asynchronous
failures outside the measurement window are not observed.

New evidence is append-by-unique-name:

```text
validation-evidence/
  receipt-<timestamp>-<uuid>.json
  <run-id>/viewport-<index>/<check-id>/<screenshot>.png
```

Receipt 0.2 carries the run id, entry/scenario, explicit session id, canonical
implementation root/content digest, and digests (or explicit absence) of
`screen.sdir.yaml`, `sdir-delta.yaml`, and `implementation-brief.yaml`. The
runner compares snapshots before and after measurement; verification compares
current bytes against the receipt. Hashing uses sorted relative names and bytes,
not mtimes, rejects child symlinks/nonregular files, and is bounded to 50,000
entries and 256 MiB. It excludes dependency/VCS/runtime/output caches
(`node_modules`, `.git`, `.prax`, `.prax-state`, `validation-evidence`, `coverage`,
`.vite`) and `.log`, `.tmp`, `.tsbuildinfo` paths. The built-in static server
uses the same exclusion and containment policy so excluded files cannot be
served as unbound dependencies. External resources and services are not hashed.

`design_prepare_implementation.measurement_target` declares a project-relative
existing app directory, entry, and scenario. At evaluation, MCP resolves this
target independently and supplies the session id; the validator never uses an
untrusted receipt root to decide which files to read. Root, entry, scenario,
session, implementation, or contract mismatch revokes coverage and BLOCKs.
An incomplete error-tier 0.2 check requires REVIEW, not self-attested completion.
The runtime-computed `readiness.measurement.binding` distinguishes:

| Value | Meaning |
|---|---|
| `implementation_current` | Prepared target matches the current local static tree |
| `association_current` | Prepared local tree matches; Vite/externally served bytes are not verified |
| `unverified_target` | No prepared target; REVIEW and `evidence_current: false` |
| `legacy_unbound` | Original 0.1 replay/mtime behavior, not implementation binding |
| `invalid` | Target/content/evidence verification failed; coverage revoked |

Version 0.1 still parses without blanket new warnings for historical/frozen
replays, but is rejected when the session declares a binding requirement.
Light lifecycles without prepare and sessions already past prepare have no
new target declaration/migration path yet. Do not backfill gated artifacts
silently. A scenario is descriptive metadata; no interaction journey is run.
Readiness selectors are caller declarations, not independent correctness proof.

These hashes detect ordinary drift; they are not signatures or proof against
a malicious writer who can replace both receipts and files. Unique naming does
not make files read-only, and before/after snapshots are not a filesystem
transaction (a change-and-restore during measurement can escape detection).
Vite preview and `--serve` deliberately claim only local-source association;
they do not authenticate the deployment. Multi-file transactions, stronger
deployment provenance, light-lifecycle binding, and ten-cell benchmark execution
remain separate follow-up work.

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
- **The complexity budget is authored at decide** (0.2, gap #1 closed
  2026-09-03): `design_decide` accepts an optional ten-count
  `complexity_budget` and the SDIR generator copies it through verbatim —
  no post-validate backfill path exists or is needed. An unauthored budget
  keeps the validate-time presence advisory (`P-044`); values are never
  judged, only declared.
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
