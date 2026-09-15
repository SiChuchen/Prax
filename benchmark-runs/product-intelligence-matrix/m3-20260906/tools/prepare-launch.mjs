#!/usr/bin/env node
/**
 * M3 pilot operator preparation (Chunk 1, plan 2026-09-06 Task 2).
 *
 * Per workspace (10 cells x 2 arms under E:/codex-prj/ab-worktrees/pi-matrix):
 *   1. Extract the fenced arm prompt from README.md, verify it is identical
 *      across arms (A vs A, B vs B).
 *   2. Replace the brief placeholder with the exact frozen brief.md bytes.
 *      Arm B additionally appends the exact Prax paragraph found after the
 *      fence; verify it is identical across all B workspaces.
 *   3. Write operator launch/<ws>-prompt.md and record hashes.
 *   4. Back up README.md to backups/ and remove it from the workspace.
 *   5. Back up the broken .mcp.json (Arm B) and write a repaired config
 *      bound to the frozen runtime snapshot with a workspace-unique
 *      PRAX_STATE_ROOT.
 * Idempotence: refuses to run if a workspace README is already gone
 * (already prepared) unless --force, so a rerun cannot double-mutate.
 */
import { readFileSync, writeFileSync, renameSync, existsSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";

const PI = "E:/codex-prj/ab-worktrees/pi-matrix";
const OP = "E:/codex-prj/Prax/Prax/benchmark-runs/product-intelligence-matrix/m3-20260906";
const FROZEN = "E:/codex-prj/pi-m3-frozen-runtime-20260906";
const CELLS = [
  "cell-j01-s01", "cell-j02-s02", "cell-j09-s03", "cell-j04-s04", "cell-j05-s05",
  "cell-j06-s06", "cell-j07-s07", "cell-j08-s08", "cell-j10-s09", "cell-j13-s10",
];
const ARMS = ["a", "b"];

const sha256 = (data) => createHash("sha256").update(data).digest("hex");

function extractFence(text) {
  const start = text.indexOf("```text");
  if (start === -1) throw new Error("no ```text fence");
  const bodyStart = text.indexOf("\n", start) + 1;
  const end = text.indexOf("```", bodyStart);
  if (end === -1) throw new Error("unterminated fence");
  return { fence: text.slice(bodyStart, end).replace(/\n+$/, "\n"), after: text.slice(end + 3) };
}

const PLACEHOLDER = "<contents of brief.md in this directory>";
mkdirSync(join(OP, "launch"), { recursive: true });
mkdirSync(join(OP, "backups", "mcp-json-original"), { recursive: true });

const report = [];
const seenA = new Map();
const seenB = new Map();

for (const cell of CELLS) {
  for (const arm of ARMS) {
    const ws = `${cell}-${arm}`;
    const dir = join(PI, ws);
    const readmePath = join(dir, "README.md");
    if (!existsSync(readmePath)) {
      throw new Error(`${ws}: README.md missing — workspace may already be prepared; refusing`);
    }
    const readme = readFileSync(readmePath, "utf8");
    const { fence, after } = extractFence(readme);
    if (!fence.includes(PLACEHOLDER)) throw new Error(`${ws}: placeholder not found in fence`);

    const briefBytes = readFileSync(join(dir, "brief.md"));
    const promptText = fence.replace(PLACEHOLDER, briefBytes.toString("utf8").replace(/\n+$/, ""));

    if (arm === "a") {
      seenA.set(fence, (seenA.get(fence) ?? 0) + 1);
    } else {
      seenB.set(fence, (seenB.get(fence) ?? 0) + 1);
      const para = after.trim();
      seenB.set("PARA:" + para, (seenB.get("PARA:" + para) ?? 0) + 1);
    }

    const finalPrompt = arm === "b" ? promptText + "\n" + after.trim() + "\n" : promptText;
    writeFileSync(join(OP, "launch", `${ws}-prompt.md`), finalPrompt);

    // Backup + remove operator README from the experimental workspace.
    writeFileSync(join(OP, "backups", `README-${ws}.md`), readme);
    renameSync(readmePath, join(OP, "backups", `README-${ws}.md.moved`));
    renameSync(join(OP, "backups", `README-${ws}.md.moved`), join(OP, "backups", `README-${ws}.md`));

    // Arm B: backup broken .mcp.json, write repaired frozen-bound config.
    let mcpOriginalHash = null;
    if (arm === "b") {
      const mcpPath = join(dir, ".mcp.json");
      const original = readFileSync(mcpPath, "utf8");
      mcpOriginalHash = sha256(original);
      writeFileSync(join(OP, "backups", "mcp-json-original", `${ws}.mcp.json`), original);
      const repaired = {
        mcpServers: {
          prax: {
            type: "stdio",
            command: "node",
            args: [`${FROZEN}/packages/prax-mcp/dist/stdio.js`],
            env: { PRAX_STATE_ROOT: `${PI}/${ws}/.prax` },
          },
        },
      };
      writeFileSync(mcpPath, JSON.stringify(repaired, null, 2) + "\n");
    }

    report.push({
      ws,
      brief_sha256: sha256(briefBytes),
      prompt_sha256: sha256(readFileSync(join(OP, "launch", `${ws}-prompt.md`))),
      readme_backup: `backups/README-${ws}.md`,
      mcp_original_sha256: mcpOriginalHash,
      mcp_repaired: arm === "b" ? sha256(readFileSync(join(dir, ".mcp.json"))) : null,
    });
  }
}

// Cross-arm uniformity checks.
const aVariants = [...seenA.entries()].filter(([k]) => !k.startsWith("PARA:"));
const bPromptVariants = [...seenB.entries()].filter(([k]) => !k.startsWith("PARA:"));
const bParaVariants = [...seenB.entries()].filter(([k]) => k.startsWith("PARA:"));
const summary = {
  a_fence_variants: aVariants.length,
  b_fence_variants: bPromptVariants.length,
  b_para_variants: bParaVariants.length,
  b_para_variant_counts: bParaVariants.map(([k, n]) => ({ count: n, sha256: sha256(k) })),
  workspaces: report,
};
writeFileSync(join(OP, "launch", "prepare-launch-report.json"), JSON.stringify(summary, null, 2));
console.log(JSON.stringify({
  a_fence_variants: aVariants.length,
  b_fence_variants: bPromptVariants.length,
  b_para_variants: bParaVariants.length,
  processed: report.length,
}, null, 2));
if (aVariants.length !== 1 || bPromptVariants.length !== 1 || bParaVariants.length !== 1) {
  console.error("UNEXPECTED VARIANTS — inspect prepare-launch-report.json");
  process.exit(1);
}
