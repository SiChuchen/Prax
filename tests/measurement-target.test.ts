import { createServer } from "node:http";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { MeasurementReceiptSchema } from "prax-validator";
import { runMeasurement } from "../packages/prax-measure/src/runner.js";

const cleanup: string[] = [];
afterEach(async () => {
  for (const path of cleanup.splice(0)) await rm(path, { recursive: true, force: true });
});

async function measureHtml(html: string, status = 200, readiness = false) {
  const root = await mkdtemp(join(tmpdir(), "prax-target-"));
  cleanup.push(root);
  const server = createServer((_req, res) => {
    res.writeHead(status, { "content-type": "text/html" });
    res.end(html);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    if (typeof address !== "object" || address === null) throw new Error("server address missing");
    const path = await runMeasurement({
      appDir: root, outDir: root,
      serve: `http://127.0.0.1:${address.port}`,
      viewports: [{ width: 1280, height: 860 }],
      ...(readiness ? { readySelector: "[data-ready]", readyTimeoutMs: 200 } : {}),
    });
    return MeasurementReceiptSchema.parse(JSON.parse(await readFile(path, "utf8")));
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

it.each([
  ["HTTP 404", "<p>404 Not Found</p>", 404, false],
  ["empty page", "<!doctype html><html><body></body></html>", 200, false],
  ["runtime exception", "<p>Application</p><script>throw new Error('broken bootstrap')</script>", 200, false],
  ["unexpected dialog", "<p>Application</p><script>alert('broken application')</script>", 200, false],
  ["missing readiness marker", "<p>Still loading</p>", 200, true],
] as const)("does not pass an invalid measurement target: %s", async (_name, html, status, readiness) => {
  const receipt = await measureHtml(html, status, readiness);
  expect(receipt.summary.pass).toBe(0);
  expect(receipt.summary.skipped).toBe(7);
  expect(receipt.checks.every((check) => /invalid_target/.test(check.reason ?? ""))).toBe(true);
}, 15000);

it("waits for a declared visible readiness marker before checking the page", async () => {
  const receipt = await measureHtml('<div id="app">Loading</div><script>setTimeout(()=>{document.getElementById("app").outerHTML="<main data-ready>Application ready</main>"},50)</script>', 200, true);
  expect(receipt.summary).toMatchObject({ pass: 7, fail: 0, skipped: 0 });
  expect(receipt.receipt_version).toBe("0.2");
  if (receipt.receipt_version !== "0.2") throw new Error("new receipt binding missing");
  expect(receipt.binding.implementation.kind).toBe("local_source_association");
  expect(receipt.target_validation).toMatchObject({ readiness: "selector", ready_selector: "[data-ready]" });
});

it.each(["/wrong", "/?wrong=1", "/#wrong"])("invalidates a route change during readiness to %s", async (destination) => {
  const receipt = await measureHtml(`<p>Loading</p><script>setTimeout(()=>{history.replaceState(null,'',${JSON.stringify(destination)}); document.body.innerHTML='<main data-ready>Wrong entry</main>'},50)</script>`, 200, true);
  expect(receipt.summary.pass).toBe(0);
  expect(receipt.summary.skipped).toBe(7);
  expect(receipt.checks[0]?.reason).toContain("unexpected navigation target");
}, 15000);

it("invalidates a route change triggered by a check interaction", async () => {
  const receipt = await measureHtml('<button onfocus="history.replaceState(null,\'\',\'/wrong\')">Continue</button>');
  expect(receipt.summary.pass).toBe(0);
  expect(receipt.summary.skipped).toBe(7);
  expect(receipt.checks[0]?.reason).toContain("unexpected navigation target");
}, 15000);

it.each(["implementation", "contract"])("invalidates a run if %s changes during measurement", async (kind) => {
  const root = await mkdtemp(join(tmpdir(), "prax-target-changing-"));
  cleanup.push(root);
  const file = join(root, kind === "implementation" ? "index.html" : "implementation-brief.yaml");
  await writeFile(file, "before");
  const server = createServer(async (_req, res) => {
    await writeFile(file, "after");
    res.writeHead(200, { "content-type": "text/html" });
    res.end("<p>Ready</p>");
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    if (typeof address !== "object" || address === null) throw new Error("server address missing");
    const path = await runMeasurement({ appDir: root, outDir: root, serve: `http://127.0.0.1:${address.port}`, viewports: [{ width: 1280, height: 860 }] });
    const receipt = JSON.parse(await readFile(path, "utf8"));
    expect(receipt.target_validation?.status).toBe("invalid");
    expect(receipt.summary.pass).toBe(0);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
