#!/usr/bin/env node
/**
 * M4 probe setup (operator prep, no experimental sessions).
 * Creates 7 fresh workspaces under pi-matrix-m4/<slot>-<arm>, copies the
 * hash-verified cell-j13-s10 brief, writes .mcp.json for all Prax arms,
 * generates the P2 prompt (b-prompt + frozen Appendix A), and writes the
 * prepare-launch-report. Refuses to overwrite existing workspace files.
 */
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { createHash } from "node:crypto";

const M4 = "E:/codex-prj/Prax/Prax/benchmark-runs/product-intelligence-matrix/m4-probe-20261024";
const OP3 = "E:/codex-prj/Prax/Prax/benchmark-runs/product-intelligence-matrix/m3-r3-ablation-20260918";
const PI4 = "E:/codex-prj/ab-worktrees/pi-matrix-m4";
const FROZEN = "E:/codex-prj/pi-m3-frozen-runtime-r3-20260918";
const sha256 = (p) => createHash("sha256").update(readFileSync(p)).digest("hex");

const BRIEF_SRC = `${PI4}/../pi-matrix-r3/cell-j13-s10-b/brief.md`;
const BRIEF_EXPECTED = "f1a0496c95ba5aba3a25050e36315d525f93817b40a93a0339d2acc827f43c7b";
if (sha256(BRIEF_SRC) !== BRIEF_EXPECTED) throw new Error(`brief drifted: ${sha256(BRIEF_SRC)}`);

const SLOTS = [
  { slot: "s1", arm: "p0", prax: false, rounds: 1, prompt: "a" },
  { slot: "s2", arm: "p1", prax: true, rounds: 1, prompt: "b" },
  { slot: "s3", arm: "p1", prax: true, rounds: 1, prompt: "b" },
  { slot: "s4", arm: "p2", prax: true, rounds: 1, prompt: "b+appendix" },
  { slot: "s5", arm: "p2", prax: true, rounds: 1, prompt: "b+appendix" },
  { slot: "s6", arm: "p3", prax: true, rounds: 2, prompt: "b" },
  { slot: "s7", arm: "p3p", prax: true, rounds: 2, prompt: "b" },
];

// Frozen prompt bases from r3 (byte-identical launch files).
const aPrompt = readFileSync(`${OP3}/launch/cell-j13-s10-a-prompt.md`);
const bPrompt = readFileSync(`${OP3}/launch/cell-j13-s10-b-prompt.md`);
const appendix = readFileSync(`${M4}/launch/appendix-a.md`);
const p2Prompt = Buffer.concat([bPrompt, Buffer.from("\n\n"), appendix]);
mkdirSync(`${M4}/launch`, { recursive: true });
if (!existsSync(`${M4}/launch/s-p0-prompt.md`)) writeFileSync(`${M4}/launch/s-p0-prompt.md`, aPrompt);
if (!existsSync(`${M4}/launch/s-p1-prompt.md`)) writeFileSync(`${M4}/launch/s-p1-prompt.md`, bPrompt);
if (!existsSync(`${M4}/launch/s-p2-prompt.md`)) writeFileSync(`${M4}/launch/s-p2-prompt.md`, p2Prompt);

const report = { batch: "m4-probe-20261024", workspaces: [] };
for (const s of SLOTS) {
  const promptKey = !s.prax ? "s-p0-prompt.md" : s.prompt === "b+appendix" ? "s-p2-prompt.md" : "s-p1-prompt.md";
  const dir = `${PI4}/${s.slot}-${s.arm}`;
  if (existsSync(`${M4}/runs/${s.slot}-${s.arm}/execution/run-metadata.json`)) {
    report.workspaces.push({ slot: s.slot, arm: s.arm, ws: `${s.slot}-${s.arm}`, brief_sha256: BRIEF_EXPECTED, prompt: s.prompt, prompt_file: promptKey, rounds: s.rounds, prompt_sha256: sha256(`${M4}/launch/${promptKey}`), status: "already_completed_skipped" });
    continue;
  }
  if (!existsSync(dir)) execSync(`git init -q "${dir}"`);
  const briefDst = `${dir}/brief.md`;
  if (!existsSync(briefDst)) copyFileSync(BRIEF_SRC, briefDst);
  if (sha256(briefDst) !== BRIEF_EXPECTED) throw new Error(`${s.slot}: brief copy mismatch`);
  if (s.prax && !existsSync(`${dir}/.mcp.json`)) {
    const cfg = { mcpServers: { prax: { type: "stdio", command: "node", args: [`${FROZEN}/packages/prax-mcp/dist/stdio.js`], env: { PRAX_STATE_ROOT: `${dir}/.prax` } } } };
    writeFileSync(`${dir}/.mcp.json`, JSON.stringify(cfg, null, 2) + "\n");
  }
  if (existsSync(`${dir}/.prax`)) throw new Error(`${s.slot}-${s.arm}: stale .prax before run`);
  const entries = execSync(`ls -A "${dir}"`, { encoding: "utf8", shell: "E:/Huawei/Git/usr/bin/bash.exe" }).split(/\r?\n/).filter(Boolean).sort();
  const expected = s.prax ? [".git", ".mcp.json", "brief.md"] : [".git", "brief.md"];
  if (JSON.stringify(entries) !== JSON.stringify(expected)) throw new Error(`${s.slot}-${s.arm}: unexpected contents ${entries}`);
  report.workspaces.push({ slot: s.slot, arm: s.arm, ws: `${s.slot}-${s.arm}`, brief_sha256: BRIEF_EXPECTED, prompt: s.prompt, prompt_file: promptKey, rounds: s.rounds, prompt_sha256: sha256(`${M4}/launch/${promptKey}`) });
}
writeFileSync(`${M4}/launch/prepare-launch-report.json`, JSON.stringify(report, null, 2));
console.log(`m4 setup OK: 7 workspaces, P2 prompt sha256 ${sha256(`${M4}/launch/s-p2-prompt.md`).slice(0, 12)}…`);
