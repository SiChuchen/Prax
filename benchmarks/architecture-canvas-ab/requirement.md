# Architecture Canvas Readability Correction — Requirement Snapshot

> Benchmark: `PRAX-AB-001` · Arm-input: identical for Arm A (Bare) and Arm B (Prax)
> Base commit: `2c77838` ("Build Canvas Engine v1")
> This file is the authoritative requirement snapshot. Nothing outside this file
> and the repository state at the base commit may be assumed as requirement.

## Product context

Engineering Control Plane (ECP) is a Control Plane between humans, coding
agents, and repositories. Its Human Web is read-only for humans; the
Architecture Canvas is its primary **human comprehension tool**, not a graph
demo. The deployed Human Web UI is Chinese; established technical terms remain
English.

The Architecture Canvas v1 (see `app/architecture/`, `docs/Canvas_Engine_v1_Review.md`,
`docs/architecture-canvas-standard-v0.1.md`) renders a semantic architecture
graph with Browse / Inspect / Focus / Trace modes, semantic zoom (Landscape),
Regions, Relationships, Flows, and an Inspector.

## The problem (user challenge, 2026-08-25)

The user reviewed the delivered canvas with real screenshots and rejected it:
the lines were numerous and chaotic, and the result was **not human-readable**.
Concretely, the default view behaves like a very large minimap:

1. Default fit compresses object labels below readable size.
2. Top-level Regions form a long horizontal strip.
3. Landscape hides objects without providing meaningful Region summaries.
4. Relationship lines are numerous and hard to follow.
5. Trace highlights a set but does not create a readable ordered main path.
6. The Inspector overlays the canvas without camera recomposition.
7. Region frames occupy space without providing a strong readable summary.

Changing colors alone will not fix the structure.

## Agreed direction (spatial/readability contracts from the reference prototype)

Borrow the prototype's **spatial composition and hierarchy**, not its
high-saturation Region colors, permanent glow, decorative dashboards, or
universal runtime gauges:

- **Readable screen-space node sizes** — screen-space size is the acceptance
  unit, not the node's internal layout width before camera fit.
- **Two-dimensional Region composition** — top-level Regions must compose in
  2D; internal process/Flow layout may remain directional.
- **Architecture-level default density** — the default view stays at an
  Architecture density where Region and key Object labels are readable, rather
  than immediately entering Landscape.
- **Canvas content occupies most of the useful viewport** — without requiring
  all geometry to fit at once.
- **Docked Inspector** — the Inspector is a docked workspace panel; the camera
  and effective viewport must respond to it (Browse mode is not the same thing
  as Landscape zoom).
- **Stable map plus an ordered Trace corridor** — Trace is a lens over a
  stable map and should expose ordered steps, transformations, entry, and
  outcome.

## Fixed decisions that constrain this task

- Preserve the Semantic Graph / ELK / React Flow foundations; readability fixes
  do not justify rewriting the domain model.
- Relationship grammar must not depend on rainbow colors.
- The Canvas is a human comprehension tool: quiet, structural, readable.
  Readability above theme. No generic AI SaaS cards, marketing decoration,
  permanent glow, or color-only semantics.
- Human Web remains read-only; dragging writes only local canvas layout.
- Existing public Canvas data shapes and the Agent maintenance boundary must
  remain compatible.

## Scope of work

Modify the existing Architecture Canvas implementation under `app/architecture/`
(and related styles/tests as needed) so the six spatial/readability contracts
above hold in real browser use. Add or update tests covering the changed
behavior (geometry/layout invariants, camera/viewport behavior, Trace ordering,
Inspector viewport interaction). Provide real browser evidence (screenshots of
the corrected canvas in representative modes: default Browse at Architecture
density, with Inspector docked, and a Trace view).

## Out of scope

- Backend, D1, protocol, deployment, ECP Change publication.
- New runtime data sources for the Runtime Overlay.
- Rewriting the Semantic Graph model, the Agent maintenance contract, or the
  Agent Runtime boundary.
- Any deployment or remote write.

## Acceptance framing

An operator must be able to open the canvas, read Region and key Object labels
without zooming first, follow a relationship between two objects without losing
global system context, run a Trace and see an ordered main path from entry to
outcome, and inspect an object with the Inspector docked without the canvas
collapsing into a minimap. Real browser screenshots are mandatory evidence for
visual claims; generated geometry images alone are not acceptance evidence.
