#!/usr/bin/env node
/**
 * m5p3-verify setup: 6 workspaces under pi-matrix-m5p3/<slot>-<arm>, briefs +
 * frozen prompts, per-arm .mcp.json (e0 -> m5p1 runtime 183410df,
 * e1 -> m5p3 runtime 76bfda91), launch report. Refuses overwrites.
 */
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { createHash } from "node:crypto";

const M = "E:/codex-prj/Prax/Prax/benchmark-runs/product-intelligence-matrix/m5p3-verify-20261025";
const OP3 = "E:/codex-prj/Prax/Prax/benchmark-runs/product-intelligence-matrix/m3-r3-ablation-20260918";
const PI = "E:/codex-prj/ab-worktrees/pi-matrix";
const WSR = "E:/codex-prj/ab-worktrees/pi-matrix-m5p3";
const RT_E0 = "E:/codex-prj/pi-m5p1-frozen-runtime-20261025";
const RT_E1 = "E:/codex-prj/pi-m5p3-frozen-runtime-20261025";
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

mkdirSync(`${M}/launch`, { recursive: true });
for (const [cell, want] of Object.entries(CELLS)) {
  const src = `${OP3}/launch/${cell}-b-prompt.md`;
  const dst = `${M}/launch/${cell}-b-prompt.md`;
  if (!existsSync(dst)) copyFileSync(src, dst);
  if (sha256(dst) !== want.prompt) throw new Error(`${cell}: prompt copy drifted from frozen sha`);
}

const report = { batch: "m5p3-verify-20261025", workspaces: [] };
for (const s of SLOTS) {
  const dir = `${WSR}/${s.slot}-${s.arm}`;
  if (existsSync(`${M}/runs/${s.slot}-${s.arm}/execution/run-metadata.json`)) {
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
  report.workspaces.push({ ...s, ws: `${s.slot}-${s.arm}`, brief_sha256: CELLS[s.cell].brief, prompt_sha256: CELLS[s.cell].prompt, runtime_manifest: s.arm === "e0" ? "183410df" : "76bfda91", prompt_file: `launch/${s.cell}-b-prompt.md` });
}
writeFileSync(`${M}/launch/prepare-launch-report.json`, JSON.stringify(report, null, 2));
console.log(`m5p3 setup OK: ${report.workspaces.length} workspaces under ${WSR}`);
