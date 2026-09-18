#!/usr/bin/env node
/**
 * Operator screenshot capture — pre-registered in protocol-addendum.md D9.
 *
 *   node capture-screens.mjs <static-root> <out-dir> <snapshot-id>
 *
 * Captures the initial page "/" of the stopped artifact snapshot at
 * 1280x860 and 1440x900 with the frozen runtime's Playwright Chromium.
 * No interactions, no ready-selector beyond document readiness, no repair.
 * Writes operator-<viewport>.png plus capture-manifest.json (URL, viewport,
 * timestamp, browser version, snapshot id, image sha256). Exit 0 iff both
 * captures succeeded; failures are recorded as missing evidence.
 */
import { chromium } from "playwright";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync, existsSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const [rootArg, outArg, snapshotId] = process.argv.slice(2);
if (!rootArg || !outArg || !snapshotId) {
  console.error("usage: capture-screens.mjs <static-root> <out-dir> <snapshot-id>");
  process.exit(2);
}
const root = resolve(rootArg);
if (!existsSync(join(root, "index.html"))) {
  console.error(`capture-screens: no index.html under ${root} — missing evidence, not repaired`);
  process.exit(2);
}
const url = "file:///" + root.replace(/\\/g, "/") + "/index.html";
const outDir = resolve(outArg);
mkdirSync(outDir, { recursive: true });
const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

const browser = await chromium.launch();
const manifest = { snapshot_id: snapshotId, root, url, captures: [] };
let failure = null;
for (const viewport of [{ w: 1280, h: 860 }, { w: 1440, h: 900 }]) {
  const context = await browser.newContext({ viewport: { width: viewport.w, height: viewport.h } });
  const page = await context.newPage();
  try {
    await page.goto(url, { waitUntil: "load", timeout: 20000 });
    const file = join(outDir, `operator-${viewport.w}x${viewport.h}.png`);
    const buf = await page.screenshot({ path: file });
    manifest.captures.push({
      viewport: `${viewport.w}x${viewport.h}`,
      file,
      sha256: sha256(buf),
      captured_at: new Date().toISOString(),
    });
  } catch (error) {
    failure = `viewport ${viewport.w}x${viewport.h}: ${error.message}`;
    manifest.captures.push({ viewport: `${viewport.w}x${viewport.h}`, error: error.message });
  }
  await context.close();
}
const v = await browser.version();
await browser.close();
manifest.browser_version = v;
manifest.method = "playwright chromium, waitUntil=load, no interactions, document readiness only";
writeFileSync(join(outDir, "capture-manifest.json"), JSON.stringify(manifest, null, 2));
if (failure) {
  console.error(`capture-screens: FAILED — ${failure} (manifest records missingness)`);
  process.exit(1);
}
console.log(`capture-screens: 2 viewports captured from ${url}`);
for (const c of manifest.captures) console.log(`  ${c.viewport} -> ${c.file} sha256=${c.sha256.slice(0, 12)}`);
