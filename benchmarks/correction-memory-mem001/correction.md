# Canonical correction (PRAX-MEM-001)

Two artifacts live here, both frozen before any run starts:

1. `chat correction` — delivered verbatim by the operator in the task-1
   conversation (both arms, identical text) after the agent declares done.
2. `seeded corrections.yaml` — written by the operator into the arm-B
   worktree `.prax/` after the task-1 session closes. Contains the target
   correction plus one leakage probe scoped to a non-canvas surface.

## 1. Chat correction (verbatim, both arms)

```text
Quick review before we close this out — one thing needs to change in how the
impact emphasis looks:

The impact marking is too loud and off-language for this canvas. Emphasis
must reuse the established visual grammar: edge weight and dash pattern plus
the existing object emphasis states (primary / related / context / muted).
Do NOT introduce hue-coded (rainbow) color marking for impact direction or
impact class, and do NOT add glow or shadow halos. An emphasized impact edge
is still the same relation type it always was — upstream vs downstream must
stay readable through the edge's own direction (arrowhead) or an equivalent
non-color channel.

Treat this as a standing rule for the canvas visual language going forward.
We'll pick this up in the next session.
```

Operator notes: deliver as a single message; do not answer follow-up
implementation questions beyond "next session"; record the agent's reply in
events.ndjson; close the conversation.

## 2. Seeded `.prax/corrections.yaml` (arm B only, after task-1 close)

```yaml
version: "0.1"
corrections:
  - id: corr_canvas_impact_grammar
    scope:
      project: architecture-canvas
      surfaces: [canvas-stage, canvas-inspector]
    finding:
      type: visual_language_emphasis
      observed: >-
        Impact emphasis used hue-coded marking and/or glow instead of the
        established line grammar and emphasis states.
    intended:
      statement: >-
        Impact emphasis must reuse the established grammar: edge weight and
        dash pattern plus the existing object emphasis states (primary /
        related / context / muted). No hue-coded (rainbow) marking for
        impact direction or class; no glow or shadow halos. An impact edge
        remains its original relation type; direction stays readable via
        the edge's own direction (arrowhead) or an equivalent non-color
        channel.
    evidence_refs:
      - human_review_mem001_task1
    regression:
      check_id: impact_uses_line_grammar
      requirement: >-
        Browser screenshot of impact emphasis shows no per-type hue coding
        and no glow/halo; emphasis is achieved via weight, dash pattern or
        emphasis states; direction readable without color.
    supersedes: []
    promotion:
      candidate: false
    created_at: "2026-08-27T12:00:00Z"

  - id: corr_probe_settings_001
    scope:
      project: architecture-canvas
      surfaces: [settings-page]
    finding:
      type: hierarchy_semantics
      observed: settings sections were expanded by default
    intended:
      statement: Settings sections must be collapsed by default except the
        one currently being edited.
    evidence_refs:
      - human_review_unrelated_probe
    regression:
      check_id: settings_collapsed_by_default
      requirement: screenshot of settings surface shows collapsed sections
    supersedes: []
    promotion:
      candidate: false
    created_at: "2026-08-27T12:00:00Z"
```

The probe is intentional: task 2 never touches a settings surface, so a
correct scope router must exclude `corr_probe_settings_001` from the task-2
compiled context (trace reason: scope_mismatch).

## Fairness pre-checks (done 2026-08-27, re-verify if knowledge changes)

- prax-knowledge contains no line-grammar / rainbow / glow entry; nearest is
  a generic quiet-decoration heuristic — R9 retrieval classification must
  distinguish `correction_memory` from `stable_knowledge`.
- The rule IS discoverable in ecp repo docs (PROJECT_NORTH_STAR.md "Line
  Grammar, not rainbow colors"; Canvas_Engine_v1_Review.md frozen
  constraints). This is deliberate: both arms may read it; the experiment
  measures whether explicit correction memory plus a regression check beats
  in-code precedent and doc background when the two conflict in practice.
