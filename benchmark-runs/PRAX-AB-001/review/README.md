# Review package layout

After all replicates finish:

- `blinded-outcomes/` — anonymized per-impl bundles (labels `impl-1`…`impl-6`,
  randomized order, no arm-identifying metadata, no Prax traces)
- `rubric.yaml` — copy of the static rubric used (from benchmarks/)
- `comparison.yaml` — per-rubric outcome labels per impl, cost/process metrics
  per arm (filled after unblinding)
- `findings.yaml` — material findings with §24.6 attribution taxonomy entries
  (Knowledge Gap / Routing / Compilation / Agent Reasoning / Implementation /
  Validation / Requirement / Process Overhead / Capability–Asset Mismatch /
  Authority Conflict / INCONCLUSIVE)

Scoring order: outcome first (R1–R7), locked; then unblind; then process
metrics and attribution.
