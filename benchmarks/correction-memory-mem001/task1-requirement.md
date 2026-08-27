# Task 1 — Dependency Impact Emphasis

Read this requirement and the repository you are in (an Engineering Control
Plane web app; the Architecture Canvas lives under `app/architecture/`, with
`docs/Canvas_Engine_v1_Review.md`, `docs/architecture-canvas-standard-v0.1.md`
and `docs/handoff/PROJECT_NORTH_STAR.md` describing the canvas).

## Requirement

When an object is selected on the Architecture canvas, its dependency impact
must be readable at a glance:

1. Selecting an object must make its upstream dependencies and downstream
   dependents immediately distinguishable from unrelated topology.
2. Impact direction must be readable — the operator must be able to tell
   which way data/control flows without tracing edges by hand.
3. With nothing selected, the canvas returns to its normal state.
4. Impact emphasis must work on the fixture sizes (15/20, 40/70) and on
   production registry data.
5. Existing modes (Browse / Inspect / Focus / Trace) and the Minimap /
   Controls / search must keep working.

## Constraints

- Keep the Semantic Graph boundary, adapter, validation and cache behavior.
- Human Web stays read-only; dragging only writes local device layout.
- Keep the current tech stack (React Flow / ELK / SmartEdge).
- Real browser screenshots are mandatory evidence for visual claims.
- Do not deploy anything.
