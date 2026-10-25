/* Inlined runbook data — present at first parse, so the app never shows a loading state. */
window.RUNBOOK = {
  meta: {
    id: "RW-2026-0914",
    eyebrow: "Runbook " + "RW-2026-0914 · rehearsal",
    title: "Payments Ledger v2 — Production Cutover",
    owner: "Owner: Release Engineering on-call",
    window: "Change window: Sat 14 Sep 2026, 02:00–04:00 UTC · CHG-88412",
    version: "Runbook v4.2 · approved by Change Advisory Board"
  },
  phases: [
    {
      id: "P1",
      title: "Preflight",
      goal: "Prove the environment is safe to change. Nothing has been modified yet.",
      steps: [
        {
          id: "S1",
          title: "Confirm the change freeze",
          summary: "Verify the freeze is in force and no conflicting change overlaps the window.",
          detail: [
            "Open CHG-88412 and confirm CAB approval is attached and signed.",
            "Check the change calendar for any overlapping production change in 02:00–04:00 UTC.",
            "Confirm the deploy pipeline is paused for non-runbook changes."
          ],
          owner: "Release on-call",
          est: "5 min",
          systems: ["ServiceNow", "Change calendar"],
          reversible: true,
          checkpoints: [
            "Change ticket CHG-88412 is approved and attached",
            "No conflicting change is scheduled in this window"
          ],
          outcome: "Freeze confirmed; pipeline paused for the window."
        },
        {
          id: "S2",
          title: "Verify backups and replication",
          summary: "A fresh snapshot and healthy replication are the preconditions for every later rollback plan.",
          detail: [
            "Confirm the latest ledger snapshot is younger than 15 minutes.",
            "Check replica lag on all three regions (must be under 2 s).",
            "Record snapshot id in the run log — the S8 rollback plan replays from it."
          ],
          owner: "DBA on-call",
          est: "10 min",
          systems: ["Ledger cluster", "Snapshot service"],
          reversible: true,
          checkpoints: [
            "Latest snapshot is younger than 15 minutes",
            "Replica lag under 2 s in all three regions"
          ],
          outcome: "Backups verified: snapshot snap-0914-0142, worst lag 0.8 s."
        },
        {
          id: "S3",
          title: "Open the maintenance window",
          summary: "Publish the maintenance notice so traffic drops before any component changes.",
          detail: [
            "Post the scheduled-maintenance banner to the status page.",
            "Verify error budgets dashboards are annotated with the window start."
          ],
          owner: "Release on-call",
          est: "5 min",
          systems: ["Status page"],
          reversible: true,
          outcome: "Window opened at 02:00 UTC; status page shows the maintenance notice."
        }
      ]
    },
    {
      id: "P2",
      title: "Cutover",
      goal: "Move write traffic to Ledger v2. Two of the three points of no return live in this phase.",
      steps: [
        {
          id: "S4",
          title: "Deploy Ledger v2 binaries",
          summary: "Roll out v2 to the full fleet while v1 continues to serve all writes.",
          detail: [
            "Canary first: kubectl rollout status deploy/ledger-v2 --timeout=5m on the canary pool.",
            "Then roll the remaining pools; confirm 24/24 pods on 4.2.1.",
            "v1 keeps serving writes — this step changes nothing user-visible."
          ],
          owner: "Release on-call",
          est: "15 min",
          systems: ["Kubernetes", "ledger-v2"],
          reversible: true,
          outcome: "ledger-v2 4.2.1 running on 24/24 nodes; v1 still serving all writes."
        },
        {
          id: "S5",
          title: "Cut over write traffic to Ledger v2",
          summary: "Flip the dual-write proxy primary from v1 to v2.",
          detail: [
            "Run proxyctl set-primary ledger-v2 and watch the flip complete within ~5 s.",
            "v1 stops accepting writes immediately; cache invalidations fan out to all 3 regions.",
            "Watch the write-error panel for 5 minutes before moving on."
          ],
          owner: "Release on-call",
          est: "10 min",
          systems: ["Write proxy", "ledger-v2", "ledger-v1"],
          reversible: false,
          consequence: "The proxy primary flips and v1 stops accepting writes within seconds. Client sessions re-handshake; cache invalidations fan out to 3 regions. This is the first point of no return.",
          rollback: {
            title: "Fail write traffic back to Ledger v1",
            steps: [
              "Flip the proxy primary back to v1 (proxyctl failback)",
              "Flush v2-only cache entries in all regions",
              "Verify v1 write latency under 50 ms for 5 minutes"
            ],
            rto: "≤ 10 min",
            note: "Available only while v1 write credentials still exist — i.e. before step S6 is executed."
          },
          confirmPhrase: "LEDGER V2",
          outcome: "Write primary is now ledger-v2; v1 is read-only."
        },
        {
          id: "S6",
          title: "Revoke v1 write credentials",
          summary: "Destroy v1's database credentials so it can never accept writes again.",
          detail: [
            "Rotate the ledger-v1 service account to read-only scopes.",
            "Delete the write-role credentials from the vault.",
            "Confirm v1 write attempts now fail closed in all regions."
          ],
          owner: "Security on-call",
          est: "10 min",
          systems: ["Vault", "ledger-v1"],
          reversible: false,
          consequence: "v1's write credentials are destroyed. Failing traffic back to v1 now requires reissuing credentials from the break-glass vault under an incident declaration. This is the deepest point of no return.",
          rollback: {
            title: "Reissue v1 write credentials from the break-glass vault",
            steps: [
              "Raise a SEV-1 security call to open the break-glass vault",
              "Reissue v1 write credentials and hot-reload them onto the fleet",
              "Re-run the proxy failback procedure from S5"
            ],
            rto: "≤ 25 min",
            note: "Recovery exists but is slow and incident-declared — treat rollback here as emergency-only."
          },
          confirmPhrase: "REVOKE V1",
          outcome: "v1 write credentials revoked; v1 is permanently read-only."
        }
      ]
    },
    {
      id: "P3",
      title: "Verification",
      goal: "Prove v2 carries production load before anything is retired.",
      steps: [
        {
          id: "S7",
          title: "Verify live transaction health",
          summary: "Ten minutes of green numbers across success rate, latency, and reconciliation.",
          detail: [
            "Watch the payment success rate over a 10-minute slide: must stay ≥ 99.95%.",
            "Check P99 ledger write latency stays under 80 ms.",
            "Run the reconciliation job and confirm zero drift against settlement."
          ],
          owner: "SRE on-call",
          est: "15 min",
          systems: ["Metrics", "Reconciliation job"],
          reversible: true,
          checkpoints: [
            "Payment success rate ≥ 99.95% over 10 minutes",
            "P99 ledger write latency under 80 ms",
            "Zero reconciliation drift against settlement"
          ],
          outcome: "Health green: 99.98% success, P99 61 ms, drift 0."
        },
        {
          id: "S8",
          title: "Decommission the v1 fleet",
          summary: "Terminate the v1 VMs and reclaim the hardware.",
          detail: [
            "Terraform-apply the ledger-v1-fleet destroy module.",
            "Archive local WAL tails to cold storage before each node dies.",
            "Confirm capacity dashboards show the reclaimed nodes."
          ],
          owner: "Platform on-call",
          est: "20 min",
          systems: ["Terraform", "v1 fleet"],
          reversible: false,
          consequence: "The 24 v1 VMs and their local state directories are destroyed. Recovery requires rebuilding the fleet from the golden image and replaying archived WAL. This is the final point of no return.",
          rollback: {
            title: "Rebuild the v1 fleet from the golden image",
            steps: [
              "Terraform-apply the v1-fleet restore module",
              "Replay archived WAL from snapshot snap-0914-0142",
              "Re-run reconciliation before any traffic moves"
            ],
            rto: "≤ 45 min",
            note: "Recovery is a rebuild, not a flip — plan for a long outage before choosing it."
          },
          confirmPhrase: "RETIRE V1",
          outcome: "v1 fleet terminated; 24 VMs reclaimed."
        }
      ]
    },
    {
      id: "P4",
      title: "Closeout",
      goal: "Return to normal operations and leave a complete record behind.",
      steps: [
        {
          id: "S9",
          title: "Close the maintenance window",
          summary: "Restore the status page and unpause the deploy pipeline.",
          detail: [
            "Remove the maintenance banner from the status page.",
            "Unpause the deploy pipeline for non-runbook changes.",
            "Confirm client traffic patterns are back to baseline."
          ],
          owner: "Release on-call",
          est: "5 min",
          systems: ["Status page", "Deploy pipeline"],
          reversible: true,
          outcome: "Window closed at 03:12 UTC; status page green."
        },
        {
          id: "S10",
          title: "Publish the cutover record",
          summary: "Attach the final report to the change ticket and brief the channel.",
          detail: [
            "Post the timeline, metrics, and any rollback usage to #inc-ops.",
            "Attach the activity log export to CHG-88412.",
            "File follow-ups for any anomaly noted during the window."
          ],
          owner: "Release on-call",
          est: "10 min",
          systems: ["ServiceNow", "#inc-ops"],
          reversible: true,
          outcome: "Report published to #inc-ops and attached to CHG-88412."
        }
      ]
    }
  ]
};
