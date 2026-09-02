#!/usr/bin/env node
/**
 * Benchmark cell runner (Phase 4 F1, spec 2026-09-02 §F1).
 *
 *   node run-cell.mjs <cell-id> --app <appDir> [--viewports 1280x860]
 *
 * Runs prax-measure against the cell's implementation and files the receipt
 * under benchmark-runs/product-intelligence-matrix/<cell-id>/. The receipt IS
 * the objective evidence layer — this wrapper adds no measurement logic, it
 * only binds a matrix cell to its evidence directory and verifies the
 * receipt parses against the shared schema.
 */
import { spawn } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parse } from "yaml";
import { MeasurementReceiptSchema } from "prax-validator";

const repoRoot = resolve(import.meta.dirname, "..", "..");
const matrixPath = join(repoRoot, "benchmarks", "product-intelligence-matrix", "matrix.yaml");

function argumentValue(name, fallback = undefined) {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  const value = process.argv[index + 1];
  return value === undefined || value.startsWith("--") ? fallback : value;
}

const cellId = process.argv[2];
const appDir = argumentValue("--app");
const viewports = argumentValue("--viewports", "1280x860");
if (cellId === undefined || cellId.startsWith("--") || appDir === undefined) {
  console.error("usage: run-cell.mjs <cell-id> --app <appDir> [--viewports 1280x860]");
  process.exit(2);
}

const matrix = parse(await readFile(matrixPath, "utf8"));
const cell = matrix.cells.find((entry) => entry.id === cellId);
if (cell === undefined) {
  console.error(`unknown cell '${cellId}' — known: ${matrix.cells.map((entry) => entry.id).join(", ")}`);
  process.exit(2);
}

const outDir = join(repoRoot, "benchmark-runs", "product-intelligence-matrix", cellId);
const child = spawn(
  process.execPath,
  [join(repoRoot, "packages", "prax-measure", "bin", "prax-measure.mjs"), "--app", appDir, "--out", outDir, "--viewports", viewports],
  { stdio: "inherit" },
);
const exitCode = await new Promise((resolveExit) => child.on("exit", resolveExit));

const evidenceDir = join(outDir, "validation-evidence");
const receipts = (await readdir(evidenceDir).catch(() => []))
  .filter((file) => file.startsWith("receipt-") && file.endsWith(".json"))
  .sort();
if (receipts.length === 0) {
  console.error(`cell ${cellId}: no receipt produced (prax-measure exit ${exitCode})`);
  process.exit(2);
}
const receipt = MeasurementReceiptSchema.parse(
  JSON.parse(await readFile(join(evidenceDir, receipts[receipts.length - 1]), "utf8")),
);
console.log(`cell ${cellId} (${cell.job_shape}) → ${receipts[receipts.length - 1]}`);
console.log(`  summary: pass=${receipt.summary.pass} fail=${receipt.summary.fail} skipped=${receipt.summary.skipped} warnings=${receipt.summary.warnings}`);
process.exit(exitCode);
