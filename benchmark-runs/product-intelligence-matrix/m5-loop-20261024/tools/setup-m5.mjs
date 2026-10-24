#!/usr/bin/env node
/**
 * M5 loop-batch setup (operator prep, no experimental sessions).
 * Creates 6 fresh workspaces under pi-matrix-m5/<slot>-<arm>, copies the
 * hash-verified per-cell briefs, copies the frozen per-cell B-arm prompts
 * into launch/, writes per-arm .mcp.json (e0 -> r3 runtime 681653b4,
 * e1 -> m5 runtime fbf222e1), and writes prepare-launch-report.json.
 * Refuses to overwrite existing workspace files; skips completed slots.
 */
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { createHash } from "node:crypto";

const M5 = "E:/codex-prj/Prax/Prax/benchmark-runs/product-intelligence-matrix/m5-loop-20261024";
const OP3 = "E:/codex-prj/Prax/Prax/benchmark-runs/product-intelligence-matrix/m3-r3-ablation-20260918";
const PI = "E:/codex-prj/ab-worktrees/pi-matrix";
const PI5 = "E:/codex-prj/ab-worktrees/pi-matrix-m5";
const RT_E0 = "E:/codex-prj/pi-m3-frozen-runtime-r3-20260918";
const RT_E1 = "E:/codex-prj/pi-m5-frozen-runtime-20261024";
const sha256 = (p) => createHash("sha256").update(readFileSync(p)).digest("hex");

const CELLS = {
  "cell-j13-s10": { brief: "f1a0496c95ba5aba3a25050e36315d525f93817b40a93a0339d2acc827f43c7b", prompt: "f9e89254497c27324ecc091f80e3a335802e746882043c3f4e3d3a9cd5bc66bc" },
  "cell-j10-s09": { brief: "e72fc9e17e5a879a8381c4f3fb9ab145a22ea9ddbde85709ca5ef950e9f8021c", prompt: "7ce966a665c968c0d4e14c419d13c825ec5d96ac0f98cfed6722c0319951b47a" },
};
const SLOTS = [
  { slot: "s1", cell: "cell-j13-s10", arm: "e0" },
  { slot: "s2", cell: "cell-j13-s10", arm: "e1" },
  { slot: "s3", cell: "cell-j10-s09", arm: "e0" },
  { slot: "s4", cell: "cell-j10-s09", arm: "e1" },
  { slot: "s5", cell: "cell-j13-s10", arm: "e1" },
  { slot: "s6", cell: "cell-j10-s09", arm: "e1" },
];

mkdirSync(`${M5}/launch`, { recursive: true });
// prompt provenance copies (hash-locked to r3 launch files)
for (const [cell, want] of Object.entries(CELLS)) {
  const src = `${OP3}/launch/${cell}-b-prompt.md`;
  const dst = `${M5}/launch/${cell}-b-prompt.md`;
  if (!existsSync(dst)) copyFileSync(src, dst);
  if (sha256(dst) !== want.prompt) throw new Error(`${cell}: prompt copy drifted from frozen sha`);
}

const report = { batch: "m5-loop-20261024", workspaces: [] };
for (const s of SLOTS) {
  const dir = `${PI5}/${s.slot}-${s.arm}`;
  if (existsSync(`${M5}/runs/${s.slot}-${s.arm}/execution/run-metadata.json`)) {
    report.workspaces.push({ ...s, ws: `${s.slot}-${s.arm}`, status: "already_completed_skipped" });
    continue;
  }
  if (!existsSync(dir)) execSync(`git init -q "${dir}"`);
  const briefDst = `${dir}/brief.md`;
  if (!existsSync(briefDst)) copyFileSync(`${PI}/${s.cell}-b/brief.md`, briefDst);
  if (sha256(briefDst) !== CELLS[s.cell].brief) throw new Error(`${s.slot}: brief copy mismatch`);
  const runtime = s.arm === "e0" ? RT_E0 : RT_E1;
  if (!existsSync(`${dir}/.mcp.json`)) {
    const cfg = { mcpServers: { prax: { type: "stdio", command: "node", args: [`${runtime}/packages/prax-mcp/dist/stdio.js`], env: { PRAX_STATE_ROOT: `${dir}/.prax` } } } };
    writeFileSync(`${dir}/.mcp.json`, JSON.stringify(cfg, null, 2) + "\n");
  }
  if (existsSync(`${dir}/.prax`)) throw new Error(`${s.slot}-${s.arm}: stale .prax before run`);
  const entries = execSync(`ls -A "${dir}"`, { encoding: "utf8", shell: "E:/Huawei/Git/usr/bin/bash.exe" }).split(/\r?\n/).filter(Boolean).sort();
  if (JSON.stringify(entries) !== JSON.stringify([".git", ".mcp.json", "brief.md"])) throw new Error(`${s.slot}-${s.arm}: unexpected contents ${entries}`);
  report.workspaces.push({ ...s, ws: `${s.slot}-${s.arm}`, brief_sha256: CELLS[s.cell].brief, prompt_sha256: CELLS[s.cell].prompt, runtime_manifest: s.arm === "e0" ? "681653b4" : "fbf222e1", prompt_file: `launch/${s.cell}-b-prompt.md` });
}
writeFileSync(`${M5}/launch/prepare-launch-report.json`, JSON.stringify(report, null, 2));
console.log(`m5 setup OK: ${report.workspaces.length} workspaces under ${PI5}`);
