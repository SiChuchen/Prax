export type SessionStatus = "running" | "complete" | "failed";

export interface SessionRow {
  id: string;
  task: string;
  status: SessionStatus;
  startedAt: string;
  durationMs: number;
  gates: { total: number; passed: number };
  evidence: number;
  requirement: string;
}

export interface EventEntry {
  at: string;
  level: "info" | "warn" | "error";
  message: string;
}

export interface DashboardFixture {
  runtime: { version: string; uptimeMs: number };
  sessions: SessionRow[];
  gateOutcomes: { date: string; passed: number; failed: number }[];
  events: EventEntry[];
}

const SESSIONS: SessionRow[] = [
  { id: "ds_20260830045528", task: "PRAX-DASHBOARD-001 (figma/direct_code)", status: "running", startedAt: "2026-08-30T04:55:28Z", durationMs: 1_482_000, gates: { total: 8, passed: 7 }, evidence: 12, requirement: "Operations dashboard, direct_code realization" },
  { id: "ds_20260829190800", task: "CTA destination (modify_surface)", status: "complete", startedAt: "2026-08-29T19:08:00Z", durationMs: 2_106_000, gates: { total: 5, passed: 5 }, evidence: 8, requirement: "Resolve primary-cta-destination" },
  { id: "ds_20260829184622", task: "Favicon 404 (defect_fix)", status: "complete", startedAt: "2026-08-29T18:46:22Z", durationMs: 984_000, gates: { total: 2, passed: 2 }, evidence: 3, requirement: "Fix missing favicon" },
  { id: "ds_20260829074608", task: "PRAX-LANDING-001 (figma_first)", status: "complete", startedAt: "2026-08-29T07:46:08Z", durationMs: 3_540_000, gates: { total: 8, passed: 8 }, evidence: 14, requirement: "Landing page, figma_first realization" },
  { id: "ds_20260829070930", task: "Landing attempt (abandoned)", status: "failed", startedAt: "2026-08-29T07:09:30Z", durationMs: 820_000, gates: { total: 6, passed: 6 }, evidence: 0, requirement: "Landing page (superseded)" },
  { id: "ds_20260827134101", task: "MEM-001 pair-01-b", status: "complete", startedAt: "2026-08-27T13:41:01Z", durationMs: 5_220_000, gates: { total: 9, passed: 9 }, evidence: 21, requirement: "Correction memory benchmark" },
  { id: "ds_20260827025314", task: "AB run-06 arm-b", status: "failed", startedAt: "2026-08-27T02:53:14Z", durationMs: 7_140_000, gates: { total: 9, passed: 7 }, evidence: 9, requirement: "Settings search restructure" },
  { id: "ds_20260826165604", task: "AB run-04 arm-b", status: "complete", startedAt: "2026-08-26T16:56:04Z", durationMs: 6_930_000, gates: { total: 9, passed: 9 }, evidence: 17, requirement: "Settings search restructure" },
  { id: "ds_20260826125836", task: "AB run-02 arm-b", status: "complete", startedAt: "2026-08-26T12:58:36Z", durationMs: 7_010_000, gates: { total: 9, passed: 8 }, evidence: 15, requirement: "Settings search restructure" },
];

export const FIXTURE: DashboardFixture = {
  runtime: { version: "0.1.0+eae3cce", uptimeMs: 5_432_100 },
  sessions: SESSIONS,
  gateOutcomes: Array.from({ length: 14 }, (_, index) => {
    const day = new Date(Date.UTC(2026, 7, 17 + index));
    const passed = 2 + ((index * 5) % 7);
    const failed = index % 4 === 3 ? 1 : index % 5 === 2 ? 1 : 0;
    return {
      date: `${day.getUTCMonth() + 1}/${day.getUTCDate()}`,
      passed,
      failed,
    };
  }),
  events: [
    { at: "2026-08-30T05:20:11Z", level: "info", message: "ds_20260830045528 passed gate design_reconcile (1 gap: n4-export)" },
    { at: "2026-08-30T05:12:47Z", level: "info", message: "ds_20260830045528 proposed realization direct_code" },
    { at: "2026-08-30T04:58:02Z", level: "info", message: "ds_20260830045528 routed to PAT-DATA-EXPLORER (confidence high)" },
    { at: "2026-08-29T19:41:03Z", level: "info", message: "ds_20260829190800 validation COMPLETE (5/5)" },
    { at: "2026-08-29T19:12:55Z", level: "info", message: "ds_20260829190800 CTA verified in DOM (3 anchors, new tab)" },
    { at: "2026-08-29T18:59:41Z", level: "warn", message: "ds_20260829184622 lint rejected structural phrasing (LIFECYCLE_KIND_MISMATCH), intent_lite refined" },
    { at: "2026-08-29T18:52:19Z", level: "info", message: "ds_20260829184622 validation COMPLETE (2/2)" },
    { at: "2026-08-29T13:37:08Z", level: "error", message: "ds_20260829070930 superseded by ds_20260829074608 before submit_draft" },
    { at: "2026-08-29T12:23:13Z", level: "info", message: "ds_20260829074608 human review round 1 approved (5 screenshots)" },
    { at: "2026-08-29T08:31:44Z", level: "info", message: "ds_20260829074608 submit_draft coverage passed (5 regions)" },
    { at: "2026-08-27T14:09:26Z", level: "warn", message: "mem1-pair-01-b correction ingestion was operator-mediated" },
    { at: "2026-08-27T04:05:58Z", level: "error", message: "run-06 arm-b final validation drift on settings_search_supporting" },
  ],
};

export function formatDuration(ms: number): string {
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h${minutes % 60 ? ` ${minutes % 60}m` : ""}`;
}

export function formatUptime(ms: number): string {
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  return `${hours}h ${minutes}m`;
}
