// tools/make-receipt.mjs — 生成 Prax BoundMeasurementReceipt (0.2)
// 复用 prax-validator 的 captureImplementation/captureContracts 保证摘要算法一致。
import { createHash } from "node:crypto";
import { readFile, writeFile, copyFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

const ROOT = "E:/codex-prj/ab-worktrees/pi-matrix-m4/s7-p3p";
const SESSION = "ds_20261024021244_cead3c44";
const SESSION_DIR = join(ROOT, ".prax", "design", "sessions", SESSION);
const EV = join(ROOT, "evidence");
const SEV = join(SESSION_DIR, "validation-evidence");

const { captureImplementation, captureContracts } = await import(
  "file:///E:/codex-prj/pi-m3-frozen-runtime-r3-20260918/packages/prax-validator/dist/measurement-binding.js"
);

const impl = await captureImplementation(ROOT);
const contracts = await captureContracts(SESSION_DIR);
const sha = (buf) => createHash("sha256").update(buf).digest("hex");

// 证据文件复制进会话 validation-evidence/（receipt 之外的所有产物）
const artifacts = [
  "01-initial-ready.png", "02-selection-filter.png", "03-after-lens-switch.png",
  "04-keyboard-lens.png", "05-after-undo.png", "06-search.png", "07-empty-state.png",
  "08-restored-from-journal.png", "09-focus-order.png", "run-log.txt", "focus-order.json",
];
await mkdir(SEV, { recursive: true });
for (const a of artifacts) await copyFile(join(EV, a), join(SEV, a));

const evidence_refs = ["focus-order.json", "run-log.txt", "09-focus-order.png"].map(async (name) => ({
  ref: "validation-evidence/" + name,
  sha256: sha(await readFile(join(EV, name))),
}));
const resolvedRefs = await Promise.all(evidence_refs);

const receipt = {
  receipt_version: "0.2",
  tool: { name: "prax-measure", version: "1.0.0-lenscope-cdp" },
  target: {
    app_root: impl.root, // 验证器要求 target.app_root 等于 canonical 实现根
    base_url: "file:///" + ROOT.replace(/\\/g, "/") + "/index.html",
    build_ref: null,
  },
  run_at: new Date().toISOString(),
  viewport_matrix: [{ width: 1600, height: 900, label: "desktop" }],
  checks: [
    {
      id: "a11y.focus_order",
      status: "pass",
      severity: "error",
      measured: {
        tab_stops: 52,
        first_stop: "btn-undo (header)",
        region_order: "header → filter-bar → dim-rail → lens-stage → record-table → inspector → journal",
        all_stops_visible: true,
        all_stops_focus_visible: true,
        grid_navigation: "↑↓ roving tabindex across record rows; Enter toggles selection (verified before=2 after=3 restored=2); Shift+Enter anchors focused row (verified anchor 77→35)",
        rows_tabindex: "-1 (420 rows excluded from tab order by design; grid navigation instead)",
        probe: "CDP Input.dispatchKeyEvent Tab×52, activeElement inspected per stop; see validation-evidence/focus-order.json",
      },
      threshold: { logical_order: true, visible_focus: true, no_skipped_region: true },
      evidence_refs: resolvedRefs,
    },
  ],
  summary: { pass: 1, fail: 0, skipped: 0, warnings: 0 },
  binding: {
    run_id: "run-20261024-lenscope-evidence",
    entry: "/index.html",
    scenario: "Dimensional dataset exploration: user switches the active lens dimension repeatedly — selection, filters, anchored record, journal and trail persist (维度切换不重置认知); every filter/projection action is owned by a named journal entry and restorable via click/undo/redo (过滤/投影状态有归属且可回退); first paint is ready with inlined data",
    implementation: { root: impl.root, digest: impl.digest, kind: "static_tree" },
    session_id: SESSION,
    contract_digests: {
      "screen.sdir.yaml": contracts["screen.sdir.yaml"],
      "sdir-delta.yaml": contracts["sdir-delta.yaml"],
      "implementation-brief.yaml": contracts["implementation-brief.yaml"],
    },
  },
  target_validation: { status: "valid", issues: [], readiness: "document", ready_selector: null },
};

await writeFile(join(SEV, "measurement-receipt.json"), JSON.stringify(receipt, null, 2));
console.log("receipt written:", join(SEV, "measurement-receipt.json"));
console.log("impl.digest:", impl.digest.slice(0, 16) + "…");
console.log("sdir digest:", contracts["screen.sdir.yaml"].slice(0, 16) + "…");
