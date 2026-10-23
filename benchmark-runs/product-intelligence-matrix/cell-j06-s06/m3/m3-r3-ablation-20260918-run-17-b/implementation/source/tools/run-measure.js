/* 通过官方 prax-measure 运行器对应用做测量，产出绑定 receipt（写入会话目录 validation-evidence/） */
"use strict";
const { runMeasurement } = require("E:/codex-prj/pi-m3-frozen-runtime-r3-20260918/packages/prax-measure/dist/index.js");

runMeasurement({
  appDir: "E:/codex-prj/ab-worktrees/pi-matrix-r3/cell-j06-s06-b",
  outDir: "E:/codex-prj/ab-worktrees/pi-matrix-r3/cell-j06-s06-b/.prax/design/sessions/ds_20260923212452_56b24745",
  viewports: [{ width: 1680, height: 1050, label: "desktop-large" }],
  entry: "/index.html",
  sessionId: "ds_20260923212452_56b24745",
  scenario: "understand-evolving-state-timeline (cell-j06-s06: 选中变更事件读因果 + 时间游标下快照折叠，时间结构与变更语义一致)"
}).then((receipt) => {
  console.log(JSON.stringify({
    file: receipt.receipt_version,
    target_validation: receipt.target_validation,
    run_at: receipt.run_at,
    summary: receipt.summary,
    checks: receipt.checks.map((c) => ({
      id: c.id, status: c.status, severity: c.severity,
      subject: c.subject,
      missing: c.measured ? c.measured.missing_indicators : undefined,
      inversions: c.measured ? (c.measured.inversions || []).length : undefined,
      stops: c.measured ? c.measured.stops : undefined
    }))
  }, null, 2));
}).catch((e) => { console.error("FATAL", e); process.exit(1); });
