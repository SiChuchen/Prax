import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { MeasurementReceiptSchema } from "prax-validator";
import { runMeasurement } from "../packages/prax-measure/src/runner.js";

const fixtureDir = join(fileURLToPath(new URL("./fixtures/measure/", import.meta.url)));
const fixtureAppDir = fixtureDir; // plain-HTML fixture: no dist/ → static file serving

const cleanup: string[] = [];
afterEach(async () => {
  await Promise.all(cleanup.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("prax-measure runner (Task A3)", () => {
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
