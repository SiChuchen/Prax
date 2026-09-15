import { mkdir, mkdtemp, rm, writeFile, utimes } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import * as validator from "prax-validator";
import { DesignPrepareImplementationInputSchema } from "../packages/prax-mcp/src/schemas.js";

const directories: string[] = [];
afterEach(async () => {
  for (const directory of directories.splice(0)) await rm(directory, { recursive: true, force: true });
});
async function directory() {
  const root = await mkdtemp(join(tmpdir(), "prax-binding-"));
  directories.push(root);
  return root;
}
const legacy = {
  receipt_version: "0.1", tool: { name: "prax-measure", version: "0.1" },
  target: { app_root: "/app", base_url: "http://127.0.0.1/", build_ref: null },
  run_at: "2020-01-01T00:00:00.000Z", viewport_matrix: [{ width: 1280, height: 860 }],
  checks: [{ id: "layout.overflow", status: "pass", severity: "error", evidence_refs: [] }],
  summary: { pass: 1, fail: 0, skipped: 0, warnings: 0 },
};
const ref = "validation-evidence/receipt.json";
const evidence: validator.ValidationEvidence = {
  submitted_by: "test", collected_at: "2026-09-06T00:00:00.000Z",
  items: [{ check_id: "regression_check", outcome: "pass", source: "test", notes: "measured", artifact_refs: [], measurement_receipt: ref }],
};
async function fixture() {
  expect(validator.captureImplementation).toBeTypeOf("function");
  const appRoot = await directory();
  const sessionDirectory = await directory();
  await writeFile(join(appRoot, "index.html"), "<main>ready</main>");
  await writeFile(join(sessionDirectory, "implementation-brief.yaml"), "version: '0.1'\n");
  await mkdir(join(sessionDirectory, "validation-evidence"));
  const implementation = await validator.captureImplementation(appRoot);
  const receipt = {
    ...structuredClone(legacy), receipt_version: "0.2", target: { ...legacy.target, app_root: implementation.root },
    binding: { run_id: "run-1", entry: "/", scenario: "initial", implementation: { ...implementation, kind: "static_tree" }, session_id: "session-1", contract_digests: await validator.captureContracts(sessionDirectory) },
    target_validation: { status: "valid", issues: [], readiness: "document", ready_selector: null },
  };
  const expectedTarget = { appRoot, entry: "/", scenario: "initial", sessionId: "session-1" };
  const verify = async (expected = expectedTarget) => {
    await writeFile(join(sessionDirectory, ref), JSON.stringify(receipt));
    return validator.verifyArtifactEvidence({ sessionDirectory, evidence, expectedTarget: expected });
  };
  return { appRoot, sessionDirectory, receipt, expectedTarget, verify };
}

describe("content-bound measurement receipts", () => {
  it("keeps legacy parsing and explicitly labels its weaker binding without warnings", async () => {
    expect(validator.MeasurementReceiptSchema.safeParse(legacy).success).toBe(true);
    const sessionDirectory = await directory();
    await mkdir(join(sessionDirectory, "validation-evidence"));
    await writeFile(join(sessionDirectory, ref), JSON.stringify(legacy));
    const result = await validator.verifyArtifactEvidence({ sessionDirectory, evidence });
    expect(result.bindingByReceipt[ref]).toBe("legacy_unbound");
    expect(result.warnings).toEqual([]);
  });
  it("requires a bound receipt when the session has explicitly prepared a target", async () => {
    const { sessionDirectory, expectedTarget } = await fixture();
    await writeFile(join(sessionDirectory, ref), JSON.stringify({ ...legacy, run_at: new Date(Date.now() + 1000).toISOString() }));
    const result = await validator.verifyArtifactEvidence({ sessionDirectory, evidence, expectedTarget });
    expect(result.status).toBe("BLOCK");
    expect(result.codes).toContain("MEASUREMENT_BINDING_REQUIRED");
    expect(result.receiptRefs).toEqual([]);
    expect(result.evidenceCurrent).toBe(false);
  });
  it("hashes deterministic file names and bytes while excluding transient outputs", async () => {
    const { appRoot } = await fixture();
    const before = await validator.captureImplementation(appRoot);
    for (const name of ["node_modules", ".git", ".prax", ".prax-state", "validation-evidence", "coverage", ".vite"]) {
      await mkdir(join(appRoot, name));
      await writeFile(join(appRoot, name, "ignored.txt"), "noise");
    }
    await writeFile(join(appRoot, "output.log"), "noise");
    await writeFile(join(appRoot, "build.tsbuildinfo"), "noise");
    await utimes(join(appRoot, "index.html"), new Date(), new Date());
    expect(await validator.captureImplementation(appRoot)).toEqual(before);
    await writeFile(join(appRoot, "second.html"), "<main>ready</main>");
    expect((await validator.captureImplementation(appRoot)).digest).not.toBe(before.digest);
  });
  it("requires all new binding and target validity fields, including all contract keys", async () => {
    const { receipt } = await fixture();
    expect(validator.MeasurementReceiptSchema.safeParse(receipt).success).toBe(true);
    for (const field of ["binding", "target_validation"]) {
      const value = { ...receipt } as Record<string, unknown>;
      delete value[field];
      expect(validator.MeasurementReceiptSchema.safeParse(value).success).toBe(false);
    }
    expect(validator.MeasurementReceiptSchema.safeParse({ ...receipt, binding: { ...receipt.binding, contract_digests: {} } }).success).toBe(false);
  });
  it("binds trusted static roots and content instead of mtime", async () => {
    const { verify } = await fixture();
    const result = await verify();
    expect(result.status).toBe("PASS");
    expect(result.bindingByReceipt[ref]).toBe("implementation_current");
    expect(result.evidenceCurrent).toBe(true);
  });
  it("does not read a self-declared root without a trusted target", async () => {
    const { sessionDirectory, receipt } = await fixture();
    receipt.binding.implementation.root = join(sessionDirectory, "does-not-exist");
    await writeFile(join(sessionDirectory, ref), JSON.stringify(receipt));
    const result = await validator.verifyArtifactEvidence({ sessionDirectory, evidence });
    expect(result.bindingByReceipt[ref]).toBe("unverified_target");
    expect(result.codes).toContain("MEASUREMENT_TARGET_UNVERIFIED");
    expect(result.codes).not.toContain("MEASUREMENT_BINDING_INVALID");
    expect(result.status).toBe("REVIEW");
    expect(result.evidenceCurrent).toBe(false);
  });
  it.each(["implementation", "contract", "root", "entry", "scenario", "session", "target", "evidence"])("revokes coverage for %s mismatch", async (kind) => {
    const { appRoot, sessionDirectory, receipt, expectedTarget, verify } = await fixture();
    if (kind === "implementation") await writeFile(join(appRoot, "index.html"), "changed");
    if (kind === "contract") await writeFile(join(sessionDirectory, "sdir-delta.yaml"), "changed");
    if (kind === "root") {
      const other = await directory();
      await writeFile(join(other, "index.html"), "<main>ready</main>");
      expectedTarget.appRoot = other;
    }
    if (kind === "entry") expectedTarget.entry = "/other";
    if (kind === "scenario") expectedTarget.scenario = "other";
    if (kind === "session") expectedTarget.sessionId = "other";
    if (kind === "target") {
      receipt.target_validation.status = "invalid";
      receipt.target_validation.issues.push("blank document");
      Object.assign(receipt.checks[0]!, { status: "skipped", subject: "document", reason: "invalid target" });
    }
    if (kind === "evidence") {
      await writeFile(join(sessionDirectory, "validation-evidence/shot.txt"), "changed");
      receipt.checks[0]!.evidence_refs.push({ ref: "validation-evidence/shot.txt", sha256: "0".repeat(64) } as never);
    }
    const result = await verify();
    expect(result.status).toBe("BLOCK");
    expect(result.bindingByReceipt[ref]).toBe("invalid");
    expect(result.receiptRefs).toEqual([]);
    expect(result.evidenceCurrent).toBe(false);
    expect(result.provenanceByCheck.get("regression_check")).toBe("attested");
  });
  it("labels externally served sources only as association-current", async () => {
    const { receipt, verify } = await fixture();
    receipt.binding.implementation.kind = "local_source_association";
    const result = await verify();
    expect(result.bindingByReceipt[ref], JSON.stringify(result)).toBe("association_current");
    expect(result.provenanceByCheck.get("regression_check")).toBe("measured");
  });
  it("does not complete on a new receipt with an incomplete error-tier measurement", async () => {
    const { receipt, verify } = await fixture();
    Object.assign(receipt.checks[0]!, { status: "skipped", subject: "document", reason: "incomplete measurement" });
    const result = await verify();
    expect(result.status).toBe("REVIEW");
    expect(result.codes).toContain("MEASUREMENT_INCOMPLETE");
    expect(result.provenanceByCheck.get("regression_check")).toBe("attested");
  });
  it("does not hide non-ENOENT contract read errors", async () => {
    const { sessionDirectory } = await fixture();
    await mkdir(join(sessionDirectory, "screen.sdir.yaml"));
    await expect(validator.captureContracts(sessionDirectory)).rejects.toThrow();
  });
  it("accepts optional prepare target metadata and rejects non-path entries", () => {
    const input = { design_session_id: "session", platform: "web_desktop", framework: "react", measurement_target: { app_root: "apps/demo", entry: "/", scenario: "initial" } };
    expect(DesignPrepareImplementationInputSchema.parse(input)).toHaveProperty("measurement_target", input.measurement_target);
    expect(DesignPrepareImplementationInputSchema.safeParse({ ...input, measurement_target: { ...input.measurement_target, entry: "https://outside/" } }).success).toBe(false);
  });
});
