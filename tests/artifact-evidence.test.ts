import { mkdir, mkdtemp, rm, stat, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { verifyEvidenceFile } from "prax-runtime";
import { verifyArtifactEvidence } from "prax-validator";
import type { ValidationEvidence } from "prax-validator";

const cleanup: string[] = [];
afterEach(async () => {
  await Promise.all(cleanup.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

const PNG_BYTES = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
]);

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

interface ReceiptCheck {
  id: string;
  status: "pass" | "fail" | "skipped";
  reason?: string;
  subject?: string;
}

function receipt(checks: ReceiptCheck[], runAt = "2026-09-01T00:00:00.000Z") {
  return {
    receipt_version: "0.1",
    tool: { name: "prax-measure", version: "0.1.0" },
    target: { app_root: "apps/prax-wizard", base_url: "http://127.0.0.1:4175/", build_ref: null },
    run_at: runAt,
    viewport_matrix: [{ width: 1280, height: 860, label: "desktop" }],
    checks: checks.map((check) => ({
      id: check.id,
      status: check.status,
      severity: check.id === "a11y.contrast" || check.id === "a11y.target_size" ? "error" : "warning",
      ...(check.status === "pass" ? {} : { subject: check.subject ?? `subject for ${check.id}` }),
      measured: {},
      threshold: {},
      evidence_refs: check.status === "pass" ? [] : [{ ref: "validation-evidence/shot.png", sha256: sha256(PNG_BYTES) }],
      supported_fixes: [],
      ...(check.status === "skipped" ? { reason: check.reason ?? "no chromium in CI" } : {}),
    })),
    summary: {
      pass: checks.filter((check) => check.status === "pass").length,
      fail: checks.filter((check) => check.status === "fail").length,
      skipped: checks.filter((check) => check.status === "skipped").length,
      warnings: 0,
    },
  };
}

async function sessionWithReceipt(receiptObject: unknown, receiptName = "receipt.json") {
  const sessionDir = await mkdtemp(join(tmpdir(), "prax-artifact-ev-"));
  cleanup.push(sessionDir);
  await mkdir(join(sessionDir, "validation-evidence"), { recursive: true });
  await writeFile(join(sessionDir, "validation-evidence", "shot.png"), PNG_BYTES);
  await writeFile(
    join(sessionDir, "validation-evidence", receiptName),
    `${JSON.stringify(receiptObject, null, 2)}\n`,
  );
  return sessionDir;
}

function evidence(items: Array<{ check_id: string; outcome: "pass" | "fail"; receipt?: string }>): ValidationEvidence {
  return ValidationEvidenceSchema_parse(items);
}

// local parse via the schema to keep the literal shape honest
function ValidationEvidenceSchema_parse(
  items: Array<{ check_id: string; outcome: "pass" | "fail"; receipt?: string }>,
): ValidationEvidence {
  return {
    submitted_by: "agent",
    collected_at: "2026-09-01T01:00:00.000Z",
    items: items.map((item) => ({
      check_id: item.check_id,
      outcome: item.outcome,
      source: "operator review",
      notes: `${item.check_id} ${item.outcome}`,
      artifact_refs: [],
      ...(item.receipt === undefined ? {} : { measurement_receipt: item.receipt }),
    })),
  } as ValidationEvidence;
}

const READABILITY_RECEIPT = receipt([
  { id: "layout.overflow", status: "pass" },
  { id: "layout.responsive_collision", status: "pass" },
  { id: "text.truncation", status: "pass" },
  { id: "a11y.contrast", status: "pass" },
  { id: "a11y.focus_order", status: "pass" },
  { id: "a11y.target_size", status: "pass" },
  { id: "type.min_projected_size", status: "pass" },
]);

describe("artifact-evidence receipt verification (Task B2, spec §5.4)", () => {
  it("1. valid receipt with consistent claims marks findings measured", async () => {
    const sessionDir = await sessionWithReceipt(READABILITY_RECEIPT);
    const result = await verifyArtifactEvidence({
      sessionDirectory: sessionDir,
      evidence: evidence([{ check_id: "readability", outcome: "pass", receipt: "validation-evidence/receipt.json" }]),
    });
    expect(result.codes).toEqual([]);
    expect(result.status).toBe("PASS");
    expect(result.provenanceByCheck.get("readability")).toBe("measured");
  });

  it("2. missing or unreadable receipt file expands with EVIDENCE_FILE_INVALID", async () => {
    const sessionDir = await sessionWithReceipt(READABILITY_RECEIPT);
    const result = await verifyArtifactEvidence({
      sessionDirectory: sessionDir,
      evidence: evidence([{ check_id: "readability", outcome: "pass", receipt: "validation-evidence/gone.json" }]),
    });
    expect(result.status).toBe("EXPAND");
    expect(result.codes).toContain("EVIDENCE_FILE_INVALID");
    expect(result.provenanceByCheck.get("readability")).toBe("attested");
  });

  it("3. schema-invalid receipt blocks with MEASUREMENT_RECEIPT_INVALID", async () => {
    const sessionDir = await sessionWithReceipt({ garbage: true });
    const result = await verifyArtifactEvidence({
      sessionDirectory: sessionDir,
      evidence: evidence([{ check_id: "readability", outcome: "pass", receipt: "validation-evidence/receipt.json" }]),
    });
    expect(result.status).toBe("BLOCK");
    expect(result.codes).toContain("MEASUREMENT_RECEIPT_INVALID");
  });

  it("4. sha256 mismatch between receipt and file bytes blocks with EVIDENCE_DIGEST_MISMATCH", async () => {
    const tampered = structuredClone(READABILITY_RECEIPT) as {
      checks: Array<{ id: string; status: string; subject?: string; evidence_refs: Array<{ sha256: string }> }>;
    };
    // force a fail on layout.overflow so it declares an evidence ref, then corrupt the digest
    tampered.checks[0]!.status = "fail";
    tampered.checks[0]!.subject = "document.documentElement";
    tampered.checks[0]!.evidence_refs = [{ ref: "validation-evidence/shot.png", sha256: "0".repeat(64) }];
    const sessionDir = await sessionWithReceipt(tampered);
    const result = await verifyArtifactEvidence({
      sessionDirectory: sessionDir,
      evidence: evidence([{ check_id: "readability", outcome: "pass", receipt: "validation-evidence/receipt.json" }]),
    });
    expect(result.status).toBe("BLOCK");
    expect(result.codes).toContain("EVIDENCE_DIGEST_MISMATCH");
  });

  it("5. receipt fail contradicting a claimed pass blocks with VALIDATION_MEASUREMENT_CONTRADICTION", async () => {
    const contradictory = receipt([
      { id: "layout.overflow", status: "pass" },
      { id: "layout.responsive_collision", status: "pass" },
      { id: "text.truncation", status: "pass" },
      { id: "a11y.contrast", status: "fail", subject: "p#dim" },
      { id: "a11y.focus_order", status: "pass" },
      { id: "a11y.target_size", status: "pass" },
      { id: "type.min_projected_size", status: "pass" },
    ]);
    const sessionDir = await sessionWithReceipt(contradictory);
    const result = await verifyArtifactEvidence({
      sessionDirectory: sessionDir,
      evidence: evidence([{ check_id: "readability", outcome: "pass", receipt: "validation-evidence/receipt.json" }]),
    });
    expect(result.status).toBe("BLOCK");
    expect(result.codes).toContain("VALIDATION_MEASUREMENT_CONTRADICTION");
  });

  it("6. mapped check passing without any receipt expands with MEASUREMENT_RECEIPT_MISSING", async () => {
    const sessionDir = await sessionWithReceipt(READABILITY_RECEIPT);
    const result = await verifyArtifactEvidence({
      sessionDirectory: sessionDir,
      evidence: evidence([{ check_id: "readability", outcome: "pass" }]),
    });
    expect(result.status).toBe("EXPAND");
    expect(result.codes).toContain("MEASUREMENT_RECEIPT_MISSING");
    expect(result.missingEvidence).toContain("readability");
  });

  it("7a. skipped-with-reason satisfies coverage but stays attested with a warning", async () => {
    const skipped = receipt([
      { id: "layout.overflow", status: "pass" },
      { id: "layout.responsive_collision", status: "pass" },
      { id: "text.truncation", status: "pass" },
      { id: "a11y.contrast", status: "skipped", reason: "no chromium in CI" },
      { id: "a11y.focus_order", status: "pass" },
      { id: "a11y.target_size", status: "pass" },
      { id: "type.min_projected_size", status: "skipped", reason: "no chromium in CI" },
    ]);
    const sessionDir = await sessionWithReceipt(skipped);
    const result = await verifyArtifactEvidence({
      sessionDirectory: sessionDir,
      evidence: evidence([{ check_id: "readability", outcome: "pass", receipt: "validation-evidence/receipt.json" }]),
    });
    expect(result.codes).not.toContain("MEASUREMENT_RECEIPT_MISSING");
    expect(result.provenanceByCheck.get("readability")).toBe("attested");
    expect(result.warnings.some((warning) => warning.includes("attested"))).toBe(true);
  });

  it("7b. more than half the catalog skipped reviews for environment confirmation", async () => {
    const spread = receipt([
      { id: "layout.overflow", status: "skipped" },
      { id: "layout.responsive_collision", status: "skipped" },
      { id: "text.truncation", status: "skipped" },
      { id: "a11y.contrast", status: "skipped" },
      { id: "a11y.focus_order", status: "pass" },
      { id: "a11y.target_size", status: "pass" },
      { id: "type.min_projected_size", status: "skipped" },
    ]);
    const sessionDir = await sessionWithReceipt(spread);
    const result = await verifyArtifactEvidence({
      sessionDirectory: sessionDir,
      evidence: evidence([{ check_id: "readability", outcome: "pass", receipt: "validation-evidence/receipt.json" }]),
    });
    expect(result.status).toBe("REVIEW");
    expect(result.warnings.some((warning) => warning.includes("environment"))).toBe(true);
  });

  it("8. path traversal in measurement_receipt is rejected by containment", async () => {
    const sessionDir = await sessionWithReceipt(READABILITY_RECEIPT);
    const result = await verifyArtifactEvidence({
      sessionDirectory: sessionDir,
      evidence: evidence([{ check_id: "readability", outcome: "pass", receipt: "../outside/x.json" }]),
    });
    expect(result.status).toBe("EXPAND");
    expect(result.codes).toContain("EVIDENCE_FILE_INVALID");
  });

  it("9. partial coverage names the uncovered catalog id", async () => {
    const partial = receipt([
      { id: "layout.overflow", status: "pass" },
      { id: "layout.responsive_collision", status: "pass" },
      { id: "text.truncation", status: "pass" },
      { id: "a11y.contrast", status: "pass" },
      { id: "a11y.focus_order", status: "pass" },
      { id: "a11y.target_size", status: "pass" },
      // type.min_projected_size absent → partial
    ].slice(0, 6));
    const sessionDir = await sessionWithReceipt(partial);
    const result = await verifyArtifactEvidence({
      sessionDirectory: sessionDir,
      evidence: evidence([{ check_id: "readability", outcome: "pass", receipt: "validation-evidence/receipt.json" }]),
    });
    expect(result.status).toBe("EXPAND");
    expect(result.codes).toContain("MEASUREMENT_RECEIPT_MISSING");
    expect(result.issues.some((issue) => issue.includes("type.min_projected_size"))).toBe(true);
  });

  it("10. a receipt older than the SDIR or brief mtime is stale and does not cover", async () => {
    const sessionDir = await sessionWithReceipt(READABILITY_RECEIPT);
    // receipt run_at = 2026-09-01T00:00:00Z; make both artifacts newer
    const newer = new Date("2026-09-02T00:00:00.000Z");
    await writeFile(join(sessionDir, "screen.sdir.yaml"), "version: '0.1'\n");
    await writeFile(join(sessionDir, "implementation-brief.yaml"), "brief\n");
    await utimes(join(sessionDir, "screen.sdir.yaml"), newer, newer);
    await utimes(join(sessionDir, "implementation-brief.yaml"), newer, newer);
    const result = await verifyArtifactEvidence({
      sessionDirectory: sessionDir,
      evidence: evidence([{ check_id: "readability", outcome: "pass", receipt: "validation-evidence/receipt.json" }]),
    });
    expect(result.status).toBe("EXPAND");
    expect(result.codes).toContain("MEASUREMENT_RECEIPT_STALE");
    expect(result.missingEvidence).toContain("readability");
  });

  it("11. regression: verifyEvidenceFile keeps the rep-evidence/ default prefix", async () => {
    const sessionDir = await mkdtemp(join(tmpdir(), "prax-artifact-ev-"));
    cleanup.push(sessionDir);
    await mkdir(join(sessionDir, "rep-evidence"), { recursive: true });
    await writeFile(join(sessionDir, "rep-evidence", "shot.png"), PNG_BYTES);
    const ok = await verifyEvidenceFile(sessionDir, "rep-evidence/shot.png");
    expect(ok.ok).toBe(true);
    const rejected = await verifyEvidenceFile(sessionDir, "validation-evidence/shot.png");
    expect(rejected.ok).toBe(false);
    expect((await stat(join(sessionDir, "rep-evidence", "shot.png"))).size).toBeGreaterThan(0);
  });
});
