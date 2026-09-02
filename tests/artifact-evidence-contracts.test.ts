import { describe, expect, it } from "vitest";
import {
  CHECK_MEASUREMENT_MAP,
  ValidationEvidenceItemSchema,
  type ValidationFinding,
} from "prax-validator";

describe("measurement evidence contracts (Task B1)", () => {
  it("round-trips an evidence item carrying measurement_receipt", () => {
    const item = ValidationEvidenceItemSchema.parse({
      check_id: "readability",
      outcome: "pass",
      source: "prax-measure",
      notes: "receipt-backed pass",
      artifact_refs: [],
      measurement_receipt: "validation-evidence/receipt-2026-09-01T00-00-00.000Z.json",
    });
    expect(item.measurement_receipt).toBe("validation-evidence/receipt-2026-09-01T00-00-00.000Z.json");
  });

  it("rejects measurement_receipt outside validation-evidence/", () => {
    const base = {
      check_id: "readability",
      outcome: "pass",
      source: "prax-measure",
      notes: "n",
      artifact_refs: [],
    };
    expect(ValidationEvidenceItemSchema.safeParse({ ...base, measurement_receipt: "rep-evidence/receipt.json" }).success).toBe(false);
    expect(ValidationEvidenceItemSchema.safeParse({ ...base, measurement_receipt: "../outside/x.json" }).success).toBe(false);
    expect(ValidationEvidenceItemSchema.safeParse({ ...base, measurement_receipt: "validation-evidence/../escape.json" }).success).toBe(true);
  });

  it("measurement_receipt remains optional (legacy items unchanged)", () => {
    expect(ValidationEvidenceItemSchema.safeParse({
      check_id: "regression_check",
      outcome: "pass",
      source: "agent",
      notes: "self-attested",
      artifact_refs: [],
    }).success).toBe(true);
  });

  it("CHECK_MEASUREMENT_MAP contains exactly the spec §5.4 entries", () => {
    expect(CHECK_MEASUREMENT_MAP).toEqual({
      readability: ["a11y.contrast", "type.min_projected_size"],
      keyboard: ["a11y.focus_order"],
      regression_check: ["layout.overflow"],
      untouched_surface_regression: ["layout.overflow", "layout.responsive_collision"],
    });
  });

  it("ValidationFinding carries provenance measured|attested", () => {
    const findings: ValidationFinding[] = [
      { check_id: "readability", kind: "empirical", outcome: "pass", message: "receipt-backed", source: "prax-measure", provenance: "measured" },
      { check_id: "keyboard", kind: "empirical", outcome: "pass", message: "self-attested", source: "agent", provenance: "attested" },
    ];
    expect(findings.map((finding) => finding.provenance)).toEqual(["measured", "attested"]);
  });
});
