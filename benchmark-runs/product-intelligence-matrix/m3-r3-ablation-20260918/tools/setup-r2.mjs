#!/usr/bin/env node
/**
 * M3 round-2 setup (operator prep, no experimental sessions).
 * Creates fresh sibling workspaces, copies frozen arm prompts from round 1,
 * verifies brief/runtime identity, writes the r2 prepare-launch-report.
 * Idempotence: refuses to overwrite existing r2 workspace files.
 */
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { createHash } from "node:crypto";

const CELLS = ["cell-j01-s01", "cell-j02-s02", "cell-j09-s03", "cell-j04-s04", "cell-j05-s05", "cell-j06-s06", "cell-j07-s07", "cell-j08-s08", "cell-j10-s09", "cell-j13-s10"];
const PI2 = "E:/codex-prj/ab-worktrees/pi-matrix-r3";
const OP1 = "E:/codex-prj/Prax/Prax/benchmark-runs/product-intelligence-matrix/m3-20260906";
const OP2 = "E:/codex-prj/Prax/Prax/benchmark-runs/product-intelligence-matrix/m3-r3-ablation-20260918";
const FROZEN = "E:/codex-prj/pi-m3-frozen-runtime-r3-20260918";
const sha256 = (p) => createHash("sha256").update(readFileSync(p)).digest("hex");

const r1Report = JSON.parse(readFileSync(`${OP1}/launch/prepare-launch-report.json`, "utf8"));
const r1ByWs = Object.fromEntries(r1Report.workspaces.map((w) => [w.ws, w]));
mkdirSync(`${OP2}/launch`, { recursive: true });
mkdirSync(`${OP2}/review`, { recursive: true });
copyFileSync(`${OP1}/review/rubric.md`, `${OP2}/review/rubric.md`);
// Frozen runtime identity re-check against the round-1 manifest hash.
const manifestNow = sha256(`${OP1}/runtime-content-sha256.txt`);
const manifestExpected = "23e770b3a48bf75111c9a56e963467fb8a7d40061f10ca06261dc33b5a3a4bab";
if (manifestNow !== manifestExpected) throw new Error("runtime manifest hash drifted");

const report = { workspaces: [] };
for (const cell of CELLS) {
  for (const arm of ["a", "b"]) {
    const ws = `${cell}-${arm}`;
    const dir = `${PI2}/${ws}`;
    if (!existsSync(dir)) { execSync(`git init -q "${dir}"`); }
    const r1 = r1ByWs[ws];
    if (!r1) throw new Error(`${ws}: not in round-1 report`);
    // brief: exact frozen bytes (copied from the round-1 repo-side frozen brief path used at r1 prep? briefs live in the r1 workspaces — untouched; copy from there)
    const briefSrc = `E:/codex-prj/ab-worktrees/pi-matrix/${ws}/brief.md`;
    if (sha256(briefSrc) !== r1.brief_sha256) throw new Error(`${ws}: r1 brief drifted`);
    const briefDst = `${dir}/brief.md`;
    if (!existsSync(briefDst)) copyFileSync(briefSrc, briefDst);
    if (sha256(briefDst) !== r1.brief_sha256) throw new Error(`${ws}: r2 brief copy mismatch`);
    // prompt: byte-identical to the round-1 frozen launch file
    const promptSrc = `${OP1}/launch/${ws}-prompt.md`;
    const promptDst = `${OP2}/launch/${ws}-prompt.md`;
    if (!existsSync(promptDst)) copyFileSync(promptSrc, promptDst);
    if (arm === "a" && readFileSync(promptDst, "utf8").toLowerCase().includes("prax")) throw new Error(`${ws}: A prompt contains prax string`);
    if (arm === "b") {
      const cfg = { mcpServers: { prax: { type: "stdio", command: "node", args: [`${FROZEN}/packages/prax-mcp/dist/stdio.js`], env: { PRAX_STATE_ROOT: `${PI2}/${ws}/.prax` } } } };
      const cfgPath = `${dir}/.mcp.json`;
      if (!existsSync(cfgPath)) writeFileSync(cfgPath, JSON.stringify(cfg, null, 2) + "\n");
    }
    // arm hygiene (after config creation)
    const entries = execSync(`ls -A "${dir}"`, { encoding: "utf8", shell: "E:/Huawei/Git/usr/bin/bash.exe" }).split(/\r?\n/).filter(Boolean).sort();
    const expected = arm === "a" ? [".git", "brief.md"] : [".git", ".mcp.json", "brief.md"];
    if (JSON.stringify(entries) !== JSON.stringify(expected)) throw new Error(`${ws}: unexpected contents ${entries}`);
    report.workspaces.push({ ws, brief_sha256: r1.brief_sha256, prompt_sha256: sha256(promptDst), r1_prompt_sha256: r1.prompt_sha256 });
  }
}
for (const w of report.workspaces) if (w.prompt_sha256 !== w.r1_prompt_sha256) throw new Error(`${w.ws}: prompt bytes differ from round 1`);
writeFileSync(`${OP2}/launch/prepare-launch-report.json`, JSON.stringify({ ...r1Report, round: 2, workspaces: report.workspaces.map(({ r1_prompt_sha256, ...rest }) => rest) }, null, 2));
console.log(`r2 setup OK: 20 workspaces, prompts byte-identical to round 1, briefs hash-verified, runtime manifest ${manifestNow.slice(0, 12)} unchanged`);
