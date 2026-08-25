# Prax v0 Architecture

## Runtime shape

Prax is protocol-stateless and workflow-stateful. MCP transport lifetime is not
used as product state. Each request carries `design_session_id`; the runtime
loads the authoritative YAML record and gate artifacts from disk.

| Plane | v0 implementation | Boundary |
|---|---|---|
| Protocol | MCP 2026-07-28 over stdio, SDK v2 | Ten staged tools only |
| State | `prax-runtime` local YAML store | Optimistic revision check and atomic rename |
| Knowledge | 23 fully expanded entries | No list-all/search-everything tool |
| Routing | Scope filters plus deterministic scoring | 5 principles, 5 heuristics, 3 patterns, 1 profile |
| Intent | SDIR `0.1` | Semantic roles and commitments only |
| Validation | Deterministic, assistive, and empirical checks | External evidence is never fabricated |

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
├── implementation-brief.yaml
└── validation-report.yaml
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

## Deliberate v0 constraints

`prax-web`, remote persistence, vector retrieval, knowledge administration,
visual generation, additional platform adapters, and the full research catalog
remain deferred until the Architecture Canvas vertical slice provides evidence
that they are necessary.

