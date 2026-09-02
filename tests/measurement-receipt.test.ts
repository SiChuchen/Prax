import { describe, expect, it } from "vitest";
import { MeasurementReceiptSchema } from "prax-validator";

const validReceipt = {
  receipt_version: "0.1",
  tool: { name: "prax-measure", version: "0.1.0" },
  target: { app_root: "apps/prax-wizard", base_url: "http://localhost:4175/", build_ref: null },
  run_at: "2026-09-01T00:00:00.000Z",
  viewport_matrix: [{ width: 1280, height: 860, label: "desktop" }],
  checks: [
    {
      id: "layout.overflow",
      status: "fail",
      severity: "warning",
      subject: "document.documentElement",
      measured: { scroll_width: 1294, inner_width: 1280, overflow_px: 14, viewport: "1280x860" },
      threshold: { max_overflow_px: 0 },
      evidence_refs: [{ ref: "validation-evidence/overflow-1280.png", sha256: "a".repeat(64) }],
      supported_fixes: ["find the widest row via the outlined subject and remove the fixed-width cause"],
    },
  ],
  summary: { pass: 0, fail: 1, skipped: 0, warnings: 1 },
};

describe("MeasurementReceiptSchema", () => {
  it("accepts a valid receipt", () => {
    expect(MeasurementReceiptSchema.parse(validReceipt).checks[0]?.id).toBe("layout.overflow");
  });
  it("requires reason when skipped", () => {
    const skipped = structuredClone(validReceipt);
    skipped.checks[0] = { ...skipped.checks[0], status: "skipped" };
    expect(MeasurementReceiptSchema.safeParse(skipped).success).toBe(false);
    skipped.checks[0] = { ...skipped.checks[0], status: "skipped", reason: "no chromium in CI" };
    expect(MeasurementReceiptSchema.safeParse(skipped).success).toBe(true);
  });
  it("rejects unknown check ids and bad sha256", () => {
    const bad = structuredClone(validReceipt);
    bad.checks[0]!.id = "made.up";
    expect(MeasurementReceiptSchema.safeParse(bad).success).toBe(false);
    const badHash = structuredClone(validReceipt);
    badHash.checks[0]!.evidence_refs[0]!.sha256 = "xyz";
    expect(MeasurementReceiptSchema.safeParse(badHash).success).toBe(false);
  });
});
