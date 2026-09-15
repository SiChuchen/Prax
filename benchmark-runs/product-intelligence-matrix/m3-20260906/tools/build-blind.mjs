#!/usr/bin/env node
/**
 * M3 Task 6 — anonymous blind packages + PRIVATE mapping + leakage scan.
 * Raw evidence is never edited: bytes are copied; receipts are summarized
 * into a separately marked sanitized file with a provenance/hash map.
 *
 *   node build-blind.mjs
 * Idempotent-safe: refuses to rebuild if review/private/mapping.json exists.
 */
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync, statSync } from "node:fs";
import { createHash, randomBytes } from "node:crypto";
import { join, relative, extname } from "node:path";

const OP = "E:/codex-prj/Prax/Prax/benchmark-runs/product-intelligence-matrix/m3-20260906";
const REPO = "E:/codex-prj/Prax/Prax";
const sha256 = (p) => createHash("sha256").update(readFileSync(p)).digest("hex");
if (existsSync(`${OP}/review/private/mapping.json`)) { console.error("mapping exists — refusing to rebuild"); process.exit(2); }

const order = readFileSync(`${OP}/run-order.yaml`, "utf8");
const slots = [...order.matchAll(/- run: (\d+)\n\s+workspace: (\S+)\n\s+cell: (\S+)\n\s+arm: (\w)/g)]
  .map((m) => ({ run: `run-${m[1]}`, ws: m[2], cell: m[3], arm: m[4] }));

// Randomize anonymous ids once (seeded, recorded).
const seed = randomBytes(8).toString("hex");
let h = parseInt(seed, 16) >>> 0;
const rand = () => { h |= 0; h = (h + 0x6D2B79F5) | 0; let t = Math.imul(h ^ (h >>> 15), 1 | h); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const shuffled = [...slots];
for (let i = shuffled.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]; }

const LEAK = /prax|\bsdir\b|design_session|design_start|mcp__|prax-measure|measurement_target|greenfield gate|design_decide|design_frame/i;
const TEXT_EXT = new Set([".html", ".js", ".mjs", ".ts", ".css", ".json", ".md", ".txt", ".yaml", ".yml", ".svg"]);
const EXCLUDE_TOP = new Set(["evidence", "tools", "dist", "node_modules", ".prax", ".git", "brief.md"]);
const mapping = { seed, algorithm: "mulberry32+fisher-yates", generated: new Date().toISOString(), packages: [] };
const leakage = {};
mkdirSync(`${OP}/review/blind`, { recursive: true });
mkdirSync(`${OP}/review/private`, { recursive: true });

shuffled.forEach((s, i) => {
  const id = `impl-${String(i + 1).padStart(2, "0")}`;
  const pkg = `${REPO}/benchmark-runs/product-intelligence-matrix/${s.cell}/m3/m3-20260906-${s.run}-${s.arm}`;
  const out = `${OP}/review/blind/${id}`;
  mkdirSync(`${out}/screenshots`, { recursive: true });
  mkdirSync(`${out}/source`, { recursive: true });
  const prov = { id, brief: null, screenshots: {}, receipt: null, source_files: {} };

  // common task brief
  cpSync(`${pkg}/input/brief.md`, `${out}/brief.md`);
  prov.brief = sha256(`${out}/brief.md`);

  // screenshots (bytes copied, renamed)
  for (const vp of ["1280x860", "1440x900"]) {
    const src = `${pkg}/evidence/screenshots/operator-${vp}.png`;
    if (existsSync(src)) { cpSync(src, `${out}/screenshots/${vp}.png`); prov.screenshots[vp] = sha256(src); }
    else prov.screenshots[vp] = "missing";
  }

  // sanitized receipt summary (separately marked; raw receipt untouched)
  const evDir = `${pkg}/validation-evidence/${s.run}/validation-evidence`;
  const receipts = existsSync(evDir) ? readdirSync(evDir).filter((f) => f.startsWith("receipt-") && f.endsWith(".json")) : [];
  if (receipts.length) {
    const r = JSON.parse(readFileSync(`${evDir}/${receipts[0]}`, "utf8"));
    const checks = Object.fromEntries((r.checks ?? []).map((c) => [c.id, c.status]));
    const invalid = (r.checks ?? []).some((c) => c.status === "skipped" && JSON.stringify(c).includes("invalid_target"));
    writeFileSync(`${out}/measurement-summary.json`, JSON.stringify({
      _note: "SANITIZED SUMMARY derived from a raw measurement receipt (raw bytes preserved elsewhere, hash in private provenance). Seven browser checks at 1280x860 and 1440x900 on the initial page. This does not measure task time, retrieval accuracy, or human preference.",
      summary: r.summary, checks, target_invalid: invalid,
    }, null, 2));
    prov.receipt = { file: receipts[0], sha256: sha256(`${evDir}/${receipts[0]}`) };
  } else {
    writeFileSync(`${out}/measurement-summary.json`, JSON.stringify({ _note: "no receipt available for this package", summary: null, checks: {}, target_invalid: null }, null, 2));
  }

  // product source: app files only (exclude process artifacts, vendored tools, dist, brief)
  const srcRoot = `${pkg}/implementation/source`;
  const hits = [];
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      const rel = relative(srcRoot, p).replace(/\\/g, "/");
      const top = rel.split("/")[0];
      if (EXCLUDE_TOP.has(top) || top.startsWith(".") || rel.split("/").includes("node_modules")) continue;
      if (/^readme/i.test(e.name)) continue;                     // agent notes are process artifacts
      if (e.isDirectory()) { walk(p); continue; }
      if (statSync(p).size > 2 * 1024 * 1024) continue;           // skip binaries/large blobs
      const dest = `${out}/source/${rel}`;
      mkdirSync(join(dest, ".."), { recursive: true });
      cpSync(p, dest);
      prov.source_files[rel] = sha256(p);
      if (TEXT_EXT.has(extname(e.name).toLowerCase())) {
        const text = readFileSync(p, "utf8");
        const lines = text.split("\n");
        lines.forEach((ln, n) => { if (LEAK.test(ln)) hits.push({ file: rel, line: n + 1, text: ln.trim().slice(0, 140) }); });
      }
      if (LEAK.test(rel)) hits.push({ file: rel, line: 0, text: "filename matches leakage pattern" });
    }
  };
  walk(srcRoot);
  leakage[id] = { hits: hits.length, samples: hits.slice(0, 8) };
  mapping.packages.push({ id, run: s.run, cell: s.cell, arm: s.arm, workspace: s.ws, package: pkg.replace(REPO + "/", ""), provenance: prov });
});

writeFileSync(`${OP}/review/private/mapping.json`, JSON.stringify(mapping, null, 2));
writeFileSync(`${OP}/review/private/leakage-scan.json`, JSON.stringify(leakage, null, 2));
const summary = Object.entries(leakage).map(([id, l]) => `${id}:${l.hits}`).join(" ");
console.log(JSON.stringify({ packages: mapping.packages.length, seed, leakage_hits_per_package: summary }, null, 2));
