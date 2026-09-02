#!/usr/bin/env node
/**
 * prax-measure CLI (spec §5.1):
 *   node bin/prax-measure.mjs --app <appDir> --out <sessionDir>
 *       [--serve <url>] [--viewports 1280x860,1440x900]
 * Exit codes: 0 = no error-severity fail; 1 = error-severity fail;
 *             2 = environment failure (receipt still written, all checks skipped).
 */
import { readFile } from "node:fs/promises";
import { runMeasurement } from "../dist/runner.js";

function parseViewports(raw) {
  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry !== "")
    .map((entry) => {
      const match = entry.match(/^(\d+)x(\d+)(?::(\w+))?$/);
      if (match === null) throw new Error(`invalid viewport '${entry}' (expected WxH[:label])`);
      return { width: Number(match[1]), height: Number(match[2]), ...(match[3] === undefined ? {} : { label: match[3] }) };
    });
}

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return undefined;
  const value = process.argv[index + 1];
  if (value === undefined || value.startsWith("--")) return undefined;
  return value;
}

const app = argumentValue("--app");
const out = argumentValue("--out");
const serve = argumentValue("--serve");
const viewportsRaw = argumentValue("--viewports") ?? "1280x860";

if (app === undefined || out === undefined) {
  console.error("usage: prax-measure --app <appDir> --out <sessionDir> [--serve <url>] [--viewports 1280x860,1440x900]");
  process.exit(2);
}

try {
  const receiptPath = await runMeasurement({
    appDir: app,
    outDir: out,
    serve,
    viewports: parseViewports(viewportsRaw),
  });
  const receipt = JSON.parse(await readFile(receiptPath, "utf8"));
  const environmentFailure = receipt.checks.every((check) => check.status === "skipped");
  const errorFailures = receipt.checks.filter((check) => check.status === "fail" && check.severity === "error");
  console.log(`receipt: ${receiptPath}`);
  console.log(
    `summary: pass=${receipt.summary.pass} fail=${receipt.summary.fail} skipped=${receipt.summary.skipped} warnings=${receipt.summary.warnings}`,
  );
  for (const check of receipt.checks.filter((entry) => entry.status !== "pass")) {
    console.log(`  ${check.status} ${check.id}${check.reason !== undefined ? ` (${check.reason})` : ""}`);
  }
  process.exit(environmentFailure ? 2 : errorFailures.length > 0 ? 1 : 0);
} catch (error) {
  console.error(`prax-measure failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(2);
}
