import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { MeasurementReceiptSchema } from "prax-validator";
import { runMeasurement } from "../packages/prax-measure/src/runner.js";
import { writeReceiptAtomically } from "../packages/prax-measure/src/receipt.js";

const fixtureDir = join(fileURLToPath(new URL("./fixtures/measure/", import.meta.url)));
const fixtureAppDir = fixtureDir; // plain-HTML fixture: no dist/ → static file serving

const cleanup: string[] = [];
afterEach(async () => {
  await Promise.all(cleanup.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("prax-measure runner (Task A3)", () => {
  it("preserves every old screenshot and receipt when a later measurement fails differently", async () => {
    const appDir = await mkdtemp(join(tmpdir(), "prax-measure-immutable-app-"));
    const outDir = await mkdtemp(join(tmpdir(), "prax-measure-immutable-out-"));
    cleanup.push(appDir, outDir);
    await writeFile(join(appDir, "index.html"), '<p style="width:1400px;background:red">First failure</p>');
    const options = { appDir, outDir, viewports: [{ width: 1280, height: 860 }] };
    const firstPath = await runMeasurement(options);
    const firstBytes = await readFile(firstPath, "utf8");
    const first = MeasurementReceiptSchema.parse(JSON.parse(firstBytes));
    expect(first.receipt_version).toBe("0.2");
    if (first.receipt_version !== "0.2") throw new Error("new receipt binding missing");
    expect(first.binding.implementation.kind).toBe("static_tree");
    expect(first.binding.entry).toBe("/");
    expect(first.target_validation.status).toBe("valid");
    expect(first.checks.flatMap((check) => check.evidence_refs).length).toBeGreaterThan(0);
    await writeFile(join(appDir, "index.html"), '<p style="width:1600px;background:blue">Different failure</p>');
    const secondPath = await runMeasurement(options);
    expect(secondPath).not.toBe(firstPath);
    expect(await readFile(firstPath, "utf8")).toBe(firstBytes);
    for (const ref of first.checks.flatMap((check) => check.evidence_refs)) {
      expect(createHash("sha256").update(await readFile(join(outDir, ref.ref))).digest("hex")).toBe(ref.sha256);
    }
  }, 20000);

  it("does not overwrite receipts that have identical timestamps", async () => {
    const outDir = await mkdtemp(join(tmpdir(), "prax-measure-receipt-id-"));
    cleanup.push(outDir);
    const frozen = MeasurementReceiptSchema.parse(JSON.parse(await readFile(join(fixtureDir, "receipts/wizard-1280x860.json"), "utf8")));
    const first = await writeReceiptAtomically(outDir, frozen);
    const second = await writeReceiptAtomically(outDir, frozen);
    expect(second).not.toBe(first);
  });

  it("preserves the reason and subject when only a later viewport has an incomplete focus walk", async () => {
    const appDir = await mkdtemp(join(tmpdir(), "prax-measure-viewport-"));
    cleanup.push(appDir);
    await writeFile(join(appDir, "index.html"), '<button style="outline:2px solid black">Ready</button><script>document.addEventListener("keydown",e=>{if(innerWidth<500&&e.key==="Tab")e.preventDefault()})</script>');
    const path = await runMeasurement({ appDir, outDir: appDir, viewports: [{ width: 1280, height: 860 }, { width: 400, height: 860 }] });
    const receipt = MeasurementReceiptSchema.parse(JSON.parse(await readFile(path, "utf8")));
    const focus = receipt.checks.find((check) => check.id === "a11y.focus_order")!;
    expect(focus.status).toBe("skipped");
    expect(focus.reason).toContain("incomplete");
    expect(focus.subject).toBeDefined();
  }, 20000);

  it("does not serve dependencies excluded from the static implementation digest", async () => {
    const appDir = await mkdtemp(join(tmpdir(), "prax-measure-excluded-"));
    cleanup.push(appDir);
    await writeFile(join(appDir, "content.tmp"), 'document.querySelector("main").textContent="Content from excluded file"');
    await writeFile(join(appDir, "index.html"), '<main>Ready</main><script src="/content.tmp"></script>');
    const path = await runMeasurement({ appDir, outDir: appDir, viewports: [{ width: 1280, height: 860 }] });
    const receipt = MeasurementReceiptSchema.parse(JSON.parse(await readFile(path, "utf8")));
    expect(receipt.receipt_version).toBe("0.2");
    if (receipt.receipt_version !== "0.2") throw new Error("binding missing");
    expect(receipt.target_validation.status).toBe("invalid");
    expect(receipt.summary.pass).toBe(0);
  }, 15000);

  it("produces a schema-valid receipt from the layout.overflow fixture", async () => {
    const outDir = await mkdtemp(join(tmpdir(), "prax-measure-runner-"));
    cleanup.push(outDir);

    const receiptPath = await runMeasurement({
      appDir: fixtureAppDir,
      outDir,
      viewports: [{ width: 1280, height: 860, label: "desktop" }],
      entry: "/layout.overflow.html",
    });

    const raw = JSON.parse(await readFile(receiptPath, "utf8"));
    const receipt = MeasurementReceiptSchema.parse(raw);

    // the receipt lands under validation-evidence/
    expect(receiptPath.includes(join("validation-evidence"))).toBe(true);

    // the layout.overflow fail is measured with the pinned 14px overflow
    const overflow = receipt.checks.find((check) => check.id === "layout.overflow");
    expect(overflow).toBeDefined();
    expect(overflow!.status).toBe("fail");
    expect((overflow!.measured as Record<string, unknown>).overflow_px).toBe(14);

    // every evidence sha256 matches the actual file bytes on disk
    for (const check of receipt.checks) {
      for (const ref of check.evidence_refs) {
        const evidencePath = join(outDir, ref.ref);
        expect((await stat(evidencePath)).size).toBeGreaterThan(0);
        const sha256 = createHash("sha256").update(await readFile(evidencePath)).digest("hex");
        expect(ref.sha256).toBe(sha256);
      }
    }

    // summary counts are consistent with the checks array
    expect(receipt.summary.pass).toBe(receipt.checks.filter((check) => check.status === "pass").length);
    expect(receipt.summary.fail).toBe(receipt.checks.filter((check) => check.status === "fail").length);
    expect(receipt.summary.skipped).toBe(receipt.checks.filter((check) => check.status === "skipped").length);
    expect(receipt.summary.warnings).toBe(receipt.checks.filter((check) => check.severity === "warning" && check.status === "fail").length);

    // the full catalog ran (7 checks for the single viewport)
    expect(receipt.checks).toHaveLength(7);
    expect(receipt.viewport_matrix).toEqual([{ width: 1280, height: 860, label: "desktop" }]);
  });

  it("writes the receipt atomically (no partial files left behind)", async () => {
    const outDir = await mkdtemp(join(tmpdir(), "prax-measure-runner-"));
    cleanup.push(outDir);
    await runMeasurement({
      appDir: fixtureAppDir,
      outDir,
      viewports: [{ width: 1280, height: 860 }],
      entry: "/layout.overflow.html",
    });
    const { readdir } = await import("node:fs/promises");
    const evidenceDir = join(outDir, "validation-evidence");
    const files = await readdir(evidenceDir);
    expect(files.every((file) => !file.includes(".tmp"))).toBe(true);
    expect(files.some((file) => file.startsWith("receipt-") && file.endsWith(".json"))).toBe(true);
  });
});
