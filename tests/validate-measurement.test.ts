import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { FileSessionStore, type FileSessionStore as Store } from "prax-runtime";
import { PraxService, type PraxOutput } from "prax-mcp";
import { architectureUnderstanding, requirementConfirmation, sdirDelta } from "./fixtures.js";

const cleanup: string[] = [];
afterEach(async () => {
  await Promise.all(cleanup.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

const PNG_BYTES = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
]);

interface ReceiptStatus {
  id: string;
  status: "pass" | "fail" | "skipped";
  reason?: string;
}

function receiptJson(checks: ReceiptStatus[], runAt: string) {
  return {
    receipt_version: "0.1",
    tool: { name: "prax-measure", version: "0.1.0" },
    target: { app_root: "apps/prax-dashboard", base_url: "http://127.0.0.1:4390/", build_ref: null },
    run_at: runAt,
    viewport_matrix: [{ width: 1280, height: 860, label: "desktop" }],
    checks: checks.map((check) => ({
      id: check.id,
      status: check.status,
      severity: check.id === "a11y.contrast" || check.id === "a11y.target_size" ? "error" : "warning",
      ...(check.status === "pass" ? {} : { subject: `subject for ${check.id}` }),
      measured: {},
      threshold: {},
      evidence_refs: check.status === "pass" ? [] : [{ ref: "validation-evidence/shot.png", sha256: createHash("sha256").update(PNG_BYTES).digest("hex") }],
      supported_fixes: [],
      ...(check.status === "skipped" ? { reason: check.reason ?? "no chromium in CI" } : {}),
    })),
    summary: {
      pass: checks.filter((check) => check.status === "pass").length,
      fail: checks.filter((check) => check.status === "fail").length,
      skipped: checks.filter((check) => check.status === "skipped").length,
      warnings: checks.filter((check) => check.status === "fail" && check.id !== "a11y.contrast" && check.id !== "a11y.target_size").length,
    },
  };
}

const ALL_PASS = [
  { id: "layout.overflow", status: "pass" as const },
  { id: "layout.responsive_collision", status: "pass" as const },
  { id: "text.truncation", status: "pass" as const },
  { id: "a11y.contrast", status: "pass" as const },
  { id: "a11y.focus_order", status: "pass" as const },
  { id: "a11y.target_size", status: "pass" as const },
  { id: "type.min_projected_size", status: "pass" as const },
];

async function startSession(sessionId: string): Promise<{ service: PraxService; store: Store }> {
  const root = await mkdtemp(join(tmpdir(), "prax-valmeas-"));
  cleanup.push(root);
  const projectRoot = join(root, "project");
  await mkdir(projectRoot, { recursive: true });
  const store = new FileSessionStore({ stateRoot: join(root, "state"), idGenerator: () => sessionId });
  const service = await PraxService.create({ sessions: store });
  await service.designStart({
    requirement: "修复画布多选标识缺陷",
    project_root: projectRoot,
    mode: "existing_product",
    change_kind: "modify_surface",
    requirement_confirmation: requirementConfirmation(),
  });
  await service.designFrame({
    design_session_id: sessionId,
    existing_understanding: architectureUnderstanding(["canvas"]),
  });
  const routed = await service.designRoute({ design_session_id: sessionId, question: "画布上如何承载多选聚合" });
  const patternId = (routed.patterns as Array<{ id: string }>)[0]?.id ?? "PAT-CANVAS-WORKSPACE";
  await service.designInspect({
    design_session_id: sessionId,
    ids: [patternId],
    depth: "L1",
    purpose: { kind: "compare_alternatives", target_ids: [patternId], question: "确认画布模式" },
  });
  await service.designDecide({
    design_session_id: sessionId,
    design_decisions: {
      session_id: sessionId,
      primary_structure: { pattern: patternId, rationale: ["画布"], confidence: "high" },
      information_hierarchy: { primary: ["canvas"], secondary: ["inspector"] },
      density: { intent: "regular", strategy: ["密度"], avoid: [] },
      major_choices: [],
      rejected: [{ option: "列表", reason: "丢上下文" }],
      unresolved: [],
    },
  });
  await service.designSdir({ design_session_id: sessionId, mode: "apply_delta", sdir_delta: sdirDelta() });
  await service.designPrepareImplementation({ design_session_id: sessionId, platform: "web_desktop", framework: "react" });
  return { service, store };
}

async function writeReceipt(store: Store, sessionId: string, receipt: unknown) {
  const sessionDir = await store.artifactDirectory(sessionId);
  await mkdir(join(sessionDir, "validation-evidence"), { recursive: true });
  await writeFile(join(sessionDir, "validation-evidence", "shot.png"), PNG_BYTES);
  await writeFile(join(sessionDir, "validation-evidence", "receipt.json"), `${JSON.stringify(receipt, null, 2)}\n`);
  return sessionDir;
}

function evidenceForPlan(plan: PraxOutput, receiptOn?: string, outcomeOverride: Record<string, "pass" | "fail"> = {}) {
  const checks = (plan.checks as Array<{ id: string; evidence_required: boolean }>).filter((check) => check.evidence_required);
  return {
    submitted_by: "operator",
    collected_at: new Date().toISOString(),
    items: checks.map((check) => ({
      check_id: check.id,
      outcome: outcomeOverride[check.id] ?? ("pass" as "pass" | "fail"),
      source: "operator review",
      notes: `${check.id} pass`,
      artifact_refs: [],
      ...(check.id === "untouched_surface_regression" && receiptOn !== undefined
        ? { measurement_receipt: receiptOn }
        : {}),
    })),
  };
}

const futureRunAt = () => new Date(Date.now() + 60_000).toISOString();

describe("design_validate measured-evidence wiring (Task B4, spec §5.4/§5.7)", () => {
  it("a mapped pass with receipt coverage completes with measured provenance and a readiness block", async () => {
    const { service, store } = await startSession("ds_valmeas_ok");
    await writeReceipt(store, "ds_valmeas_ok", receiptJson(ALL_PASS, futureRunAt()));
    const plan = await service.designValidate({ design_session_id: "ds_valmeas_ok", mode: "plan" });

    const result = await service.designValidate({
      design_session_id: "ds_valmeas_ok",
      mode: "evaluate",
      evidence: evidenceForPlan(plan, "validation-evidence/receipt.json"),
    });

    expect(result.status).toBe("PASS");
    expect((result as { phase?: string }).phase).toBe("COMPLETE");
    const findings = (result.findings ?? []) as Array<{ check_id: string; provenance: string }>;
    const untouched = findings.find((finding) => finding.check_id === "untouched_surface_regression");
    expect(untouched?.provenance).toBe("measured");
    const patternFinding = findings.find((finding) => finding.check_id === "pattern_consistency");
    expect(patternFinding?.provenance).toBe("attested");

    const readiness = (result as { readiness?: Record<string, unknown> }).readiness;
    expect(readiness).toBeDefined();
    expect(readiness!.deterministic_passed).toBe(true);
    expect(readiness!.evidence_current).toBe(true);
    const claims = readiness!.claims as { measured: string[]; attested: string[]; skipped: string[] };
    expect(claims.measured).toContain("untouched_surface_regression");
    expect(claims.attested).toContain("pattern_consistency");
    expect(claims.skipped).toEqual([]);
  });

  it("a doctored fail receipt contradicting a claimed pass blocks with VALIDATION_MEASUREMENT_CONTRADICTION", async () => {
    const { service, store } = await startSession("ds_valmeas_contra");
    const doctored = ALL_PASS.map((check) =>
      check.id === "layout.overflow" ? { id: check.id, status: "fail" as const } : check,
    );
    await writeReceipt(store, "ds_valmeas_contra", receiptJson(doctored, futureRunAt()));
    const plan = await service.designValidate({ design_session_id: "ds_valmeas_contra", mode: "plan" });

    const result = await service.designValidate({
      design_session_id: "ds_valmeas_contra",
      mode: "evaluate",
      evidence: evidenceForPlan(plan, "validation-evidence/receipt.json"),
    });

    expect(result.status).toBe("BLOCK");
    expect((result as { code?: string }).code).toBe("VALIDATION_MEASUREMENT_CONTRADICTION");
    expect((result as { phase?: string }).phase).not.toBe("COMPLETE");
  });

  it("a mapped pass without a receipt expands with MEASUREMENT_RECEIPT_MISSING", async () => {
    const { service } = await startSession("ds_valmeas_missing");
    const plan = await service.designValidate({ design_session_id: "ds_valmeas_missing", mode: "plan" });

    const result = await service.designValidate({
      design_session_id: "ds_valmeas_missing",
      mode: "evaluate",
      evidence: evidenceForPlan(plan),
    });

    expect(result.status).toBe("EXPAND");
    expect((result as { missing_evidence?: string[] }).missing_evidence).toContain("untouched_surface_regression");
    const readiness = (result as { readiness?: Record<string, unknown> }).readiness;
    expect((readiness!.claims as { attested: string[] }).attested).toContain("untouched_surface_regression");
  });

  it("an open error-severity receipt failure downgrades an otherwise-green evaluation to REVIEW REVIEW_NOT_READY", async () => {
    const { service, store } = await startSession("ds_valmeas_notready");
    // target_size (error severity) fails; it maps to no validator check, so no
    // contradiction fires — but readiness must refuse green (spec §5.7 R2).
    const withErrorFail = ALL_PASS.map((check) =>
      check.id === "a11y.target_size" ? { id: check.id, status: "fail" as const } : check,
    );
    await writeReceipt(store, "ds_valmeas_notready", receiptJson(withErrorFail, futureRunAt()));
    const plan = await service.designValidate({ design_session_id: "ds_valmeas_notready", mode: "plan" });

    const result = await service.designValidate({
      design_session_id: "ds_valmeas_notready",
      mode: "evaluate",
      evidence: evidenceForPlan(plan, "validation-evidence/receipt.json"),
    });

    expect(result.status).toBe("REVIEW");
    expect((result as { code?: string }).code).toBe("REVIEW_NOT_READY");
    const readiness = (result as { readiness?: Record<string, unknown> }).readiness;
    const measurement = readiness!.measurement as { error_failures_open: number };
    expect(measurement.error_failures_open).toBe(1);
    expect((result as { phase?: string }).phase).not.toBe("COMPLETE");
  });
});
