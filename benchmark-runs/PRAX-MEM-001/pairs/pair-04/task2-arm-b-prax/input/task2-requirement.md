# Task 2 — Multi-select Impact

Read this requirement and the repository you are in (an Engineering Control
Plane web app; the Architecture Canvas lives under `app/architecture/`). The
canvas already emphasizes dependency impact for a single selected object.

## Requirement

Extend impact emphasis to multi-selection:

1. Selecting several objects (click + box/marquee selection) computes the
   union of their impact: upstream dependencies and downstream dependents of
   any selected object.
2. Objects impacted by more than one selected object must be identifiable as
   shared impact.
3. The Inspector shows an aggregate impact summary for the current
   selection (counts and the object list), and returns to its idle state
   when the selection becomes empty.
4. All existing single-select behavior keeps working; Focus and Trace modes
   are unaffected.
5. Works on the fixture sizes (15/20, 40/70) and production registry data.

## Constraints

- Keep the Semantic Graph boundary, adapter, validation and cache behavior.
- Human Web stays read-only; dragging only writes local device layout.
- Keep the current tech stack (React Flow / ELK / SmartEdge).
- Real browser screenshots are mandatory evidence for visual claims.
- Do not deploy anything.
