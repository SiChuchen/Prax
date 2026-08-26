# Replicate layout — canonical run schema (spec §24.3)

Each replicate directory is `run-01` … `run-06` and contains exactly:

```text
run-NN/
├── arm-a-bare/                 # or arm-b-prax (one arm per replicate run)
│   ├── input/
│   │   └── requirement.md      # the frozen requirement snapshot given to the agent
│   ├── execution/
│   │   ├── session-transcript.json   # CLI export, or transcript-status.md marking not_observable
│   │   └── events.ndjson        # operator log: every human-agent exchange + first-pass mark
│   ├── implementation/
│   │   ├── git-diff.patch
│   │   ├── changed-files.txt
│   │   └── checkpoints/
│   ├── evidence/
│   │   ├── screenshots/
│   │   └── validation-results.yaml   # prax arm: design_validate output; bare arm: agent's own verification
│   └── summary.yaml
└── (the other arm of the same replicate number lives in its own run directory)
```

Arm-B adds under `input/`: `compiled-context.md`, `context-compilation-trace.yaml`,
and `prax-artifacts/` (the session's `.prax/` directory copied after the run).

## events.ndjson format

One JSON object per line; `ts` is ISO-8601 local time:

```json
{"ts":"...","kind":"session_start"}
{"ts":"...","kind":"agent_question","text":"..."}
{"ts":"...","kind":"operator_answer","text":"...","why":"clarifies requirement scope"}
{"ts":"...","kind":"first_pass","note":"agent declared ready-for-evaluation"}
{"ts":"...","kind":"repair_round","n":1,"note":"..."}
{"ts":"...","kind":"session_end","wall_clock_seconds":1840}
```

## summary.yaml minimum fields

`run.id`, `run.arm`, `result.implementation_completed`, `result.final_validation`,
`process.wall_clock_seconds`, `process.model_usage` (or `not_observable`),
`process.tool_calls`, `process.prax_calls` (arm B), `process.human_clarifications`,
`process.first_pass_validation_failures`, `process.post_first_pass_repair_rounds`,
`important_events[]`, `open_questions[]`.
