import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { MeasurementReceiptSchema } from "prax-validator";

const RECEIPTS_DIR = fileURLToPath(new URL("./fixtures/measure/receipts/", import.meta.url));
const EVIDENCE_PREFIX = "validation-evidence/";

/**
 * Receipt replay fixture (Task C1 Step 3, pattern follows
 * tests/prax-landing-fixture.test.ts): the frozen prax-wizard calibration
 * receipt of 2026-09-02 (run at 02:38:11.881Z, 1280x860) and its evidence
 * PNG must re-parse and re-verify byte-identically. Any check, schema, or
 * digest change that would break the frozen measurement fails here.
 */
describe("frozen measurement receipt replay (Task C1)", () => {
  it("re-parses the frozen receipt against the current schema", async () => {
    const raw = JSON.parse(await readFile(join(RECEIPTS_DIR, "wizard-1280x860.json"), "utf8"));
    const receipt = MeasurementReceiptSchema.parse(raw);
    expect(receipt.receipt_version).toBe("0.1");
    expect(receipt.tool).toEqual({ name: "prax-measure", version: "0.1.0" });
    expect(receipt.run_at).toBe("2026-09-02T02:38:11.881Z");
    expect(receipt.viewport_matrix).toEqual([{ width: 1280, height: 860, label: "desktop" }]);
    expect(receipt.checks).toHaveLength(7);
    expect(receipt.checks.map((check) => check.id)).toEqual([
      "layout.overflow",
      "layout.responsive_collision",
      "text.truncation",
      "a11y.contrast",
      "a11y.focus_order",
      "a11y.target_size",
      "type.min_projected_size",
    ]);
    // calibration record: wizard fails only the advisory type size check
    expect(receipt.checks.filter((check) => check.status === "fail").map((check) => check.id)).toEqual([
      "type.min_projected_size",
    ]);
    expect(receipt.summary).toEqual({ pass: 6, fail: 1, skipped: 0, warnings: 1 });
  });

  it("re-verifies every declared evidence digest byte-identically", async () => {
    const raw = JSON.parse(await readFile(join(RECEIPTS_DIR, "wizard-1280x860.json"), "utf8"));
    const receipt = MeasurementReceiptSchema.parse(raw);
    const declared = receipt.checks.flatMap((check) => check.evidence_refs);
    expect(declared.length).toBeGreaterThan(0);
    for (const ref of declared) {
      // the frozen fixture directory flattens the validation-evidence/ prefix
      if (!ref.ref.startsWith(EVIDENCE_PREFIX)) throw new Error(`unexpected ref outside the prefix: ${ref.ref}`);
      const bytes = await readFile(join(RECEIPTS_DIR, ref.ref.slice(EVIDENCE_PREFIX.length)));
      const sha256 = createHash("sha256").update(bytes).digest("hex");
      expect(sha256, `${ref.ref} must hash to the frozen digest`).toBe(ref.sha256);
    }
  });
});
