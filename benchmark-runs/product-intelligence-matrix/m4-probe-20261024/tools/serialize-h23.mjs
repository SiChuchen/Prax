#!/usr/bin/env node
/**
 * M4 probe — serialize H-23 (Appendix A, frozen by protocol.md §2).
 * Extracts the raw H-23 YAML block from the frozen knowledge.yaml, wraps it
 * verbatim in a fenced block, writes launch/appendix-a.md, prints the block
 * sha256 (recorded in the freeze record). Idempotent.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";

const KY = "E:/codex-prj/pi-m3-frozen-runtime-r3-20260918/packages/prax-knowledge/data/knowledge.yaml";
const OUT = "E:/codex-prj/Prax/Prax/benchmark-runs/product-intelligence-matrix/m4-probe-20261024/launch/appendix-a.md";
mkdirSync("E:/codex-prj/Prax/Prax/benchmark-runs/product-intelligence-matrix/m4-probe-20261024/launch", { recursive: true });

const lines = readFileSync(KY, "utf8").split(/\r?\n/);
const start = lines.findIndex((l) => l === "  - id: H-23");
if (start < 0) throw new Error("H-23 entry not found in frozen knowledge.yaml");
let end = lines.length;
for (let i = start + 1; i < lines.length; i++) {
  if (/^  - id: /.test(lines[i])) { end = i; break; }
}
const block = lines.slice(start, end).join("\n").replace(/\s+$/, "\n");
const doc = `## Appendix A — Knowledge entry H-23 (Accessibility AA Floor)\n\n\`\`\`yaml\n${block}\`\`\`\n`;
writeFileSync(OUT, doc);
const sha = createHash("sha256").update(block).digest("hex");
console.log(JSON.stringify({ appendix: OUT, yaml_block_sha256: sha, block_lines: end - start }));
