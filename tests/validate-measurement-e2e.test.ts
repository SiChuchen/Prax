import { copyFile, mkdir, mkdtemp, readFile, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { FileSessionStore, type FileSessionStore as Store } from "prax-runtime";
import { PraxService, type PraxOutput } from "prax-mcp";
import { architectureUnderstanding, requirementConfirmation, sdirDelta } from "./fixtures.js";

const RECEIPTS_DIR = fileURLToPath(new URL("./fixtures/measure/receipts/", import.meta.url));
const FROZEN_RECEIPT: Record<string, unknown> = JSON.parse(
  await readFile(join(RECEIPTS_DIR, "wizard-1280x860.json"), "utf8"),
);

const RECEIPT_RUN_AT = "2026-09-02T02:38:11.881Z"; // frozen wizard calibration run
const ARTIFACT_MTIME = new Date("2026-09-02T01:00:00.000Z"); // measured AFTER the last artifact change

const cleanup: string[] = [];
afterEach(async () => {
  await Promise.all(cleanup.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

async function startSession(sessionId: string): Promise<{ service: PraxService; store: Store; sessionDir: string }> {
  const root = await mkdtemp(join(tmpdir(), "prax-valmeas-e2e-"));
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
  const sessionDir = await store.artifactDirectory(sessionId);
  return { service, store, sessionDir };
}

async function installFrozenReceipt(sessionDir: string, receipt: unknown = FROZEN_RECEIPT) {
  await mkdir(join(sessionDir, "validation-evidence"), { recursive: true });
  await writeFile(join(sessionDir, "validation-evidence", "receipt.json"), `${JSON.stringify(receipt, null, 2)}\n`);
  await copyFile(
    join(RECEIPTS_DIR, "min-projected-size-1280x860.png"),
    join(sessionDir, "validation-evidence", "min-projected-size-1280x860.png"),
  );
  // the receipt must postdate the gated artifacts, or staleness (§5.7 R3) fires
  for (const artifact of ["screen.sdir.yaml", "implementation-brief.yaml"]) {
    await utimes(join(sessionDir, artifact), ARTIFACT_MTIME, ARTIFACT_MTIME).catch(() => undefined);
  }
}

function evidenceForPlan(plan: PraxOutput, receiptOn?: string, failing: string[] = []) {
  const checks = (plan.checks as Array<{ id: string; evidence_required: boolean }>).filter((check) => check.evidence_required);
  return {
    submitted_by: "operator",
    collected_at: new Date().toISOString(),
    items: checks.map((check) => ({
      check_id: check.id,
      outcome: (failing.includes(check.id) ? "fail" : "pass") as "fail" | "pass",
      source: "operator review",
      notes: `${check.id} ${failing.includes(check.id) ? "fail" : "pass"}`,
      artifact_refs: [],
      ...(check.id === "untouched_surface_regression" && receiptOn !== undefined ? { measurement_receipt: receiptOn } : {}),
    })),
  };
}

function doctoredReceipt(flip: { id: string; status: "fail" }) {
  const cloned = structuredClone(FROZEN_RECEIPT) as {
    checks: Array<{ id: string; status: string; subject?: string }>;
    summary: { fail: number; pass: number };
  };
  const target = cloned.checks.find((check) => check.id === flip.id);
  target!.status = flip.status;
  target!.subject = `subject for ${flip.id}`;
  cloned.summary.fail += 1;
  cloned.summary.pass -= 1;
  return cloned;
}

describe("measured-validation e2e (Task C1, Gate 1 criteria 2–5)", () => {
  it("consumes the frozen real receipt: measured provenance, readiness block, COMPLETE", async () => {
    const { service, sessionDir } = await startSession("ds_e2e_measured");
    await installFrozenReceipt(sessionDir);
    const plan = await service.designValidate({ design_session_id: "ds_e2e_measured", mode: "plan" });

    const result = await service.designValidate({
      design_session_id: "ds_e2e_measured",
      mode: "evaluate",
      evidence: evidenceForPlan(plan, "validation-evidence/receipt.json"),
    });

    expect(result.status).toBe("PASS");
    expect((result as { phase?: string }).phase).toBe("COMPLETE");
    const untouched = ((result.findings ?? []) as Array<{ check_id: string; provenance: string }>).find(
      (finding) => finding.check_id === "untouched_surface_regression",
    );
    expect(untouched?.provenance).toBe("measured");
    const readiness = (result as { readiness?: Record<string, unknown> }).readiness;
    expect(readiness).toBeDefined();
    expect(readiness!.deterministic_passed).toBe(true);
    expect(readiness!.evidence_current).toBe(true);
    expect((readiness!.measurement as { receipt_ref: string }).receipt_ref).toBe("validation-evidence/receipt.json");
  });

  it("a doctored fail receipt contradicting a claimed pass blocks (Gate 1 criterion 3)", async () => {
    const { service, sessionDir } = await startSession("ds_e2e_contra");
    await installFrozenReceipt(sessionDir, doctoredReceipt({ id: "layout.overflow", status: "fail" }));
    const plan = await service.designValidate({ design_session_id: "ds_e2e_contra", mode: "plan" });

    const result = await service.designValidate({
      design_session_id: "ds_e2e_contra",
      mode: "evaluate",
      evidence: evidenceForPlan(plan, "validation-evidence/receipt.json"),
    });

    expect(result.status).toBe("BLOCK");
    expect((result as { code?: string }).code).toBe("VALIDATION_MEASUREMENT_CONTRADICTION");
    expect((result as { phase?: string }).phase).not.toBe("COMPLETE");
  });

  it("three non-improving rounds review with VALIDATION_CONVERGENCE_STALLED and the gate stays open (Gate 1 criterion 4)", async () => {
    const { service, store } = await startSession("ds_e2e_stall");
    const plan = await service.designValidate({ design_session_id: "ds_e2e_stall", mode: "plan" });
    const failing = [(plan.checks as Array<{ id: string; evidence_required: boolean }>).filter((check) => check.evidence_required)[0]!.id];

    for (let round = 1; round <= 3; round += 1) {
      const evaluated = await service.designValidate({
        design_session_id: "ds_e2e_stall",
        mode: "evaluate",
        evidence: evidenceForPlan(plan, undefined, failing),
      });
      if (round < 3) {
        expect(evaluated.status).toBe("REVIEW");
        expect((evaluated as { code?: string }).code).toBeUndefined();
      } else {
        expect(evaluated.status).toBe("REVIEW");
        expect((evaluated as { code?: string }).code).toBe("VALIDATION_CONVERGENCE_STALLED");
        const readiness = (evaluated as { readiness?: { convergence: { stalled: boolean; unresolved: string[] } } }).readiness;
        expect(readiness?.convergence.stalled).toBe(true);
        expect(readiness!.convergence.unresolved).toContain(failing[0]);
      }
    }

    // the gate is not locked: a further design_validate call is accepted
    const fourth = await service.designValidate({
      design_session_id: "ds_e2e_stall",
      mode: "evaluate",
      evidence: evidenceForPlan(plan, undefined, failing),
    });
    expect(fourth.status).toBe("REVIEW");
    const session = await store.getSession("ds_e2e_stall");
    expect(session.warnings.some((warning) => warning.includes("VALIDATION_CONVERGENCE_STALLED"))).toBe(true);
  });

  it("skipped-with-reason satisfies coverage while staying attested with a warning (Gate 1 criterion 5)", async () => {
    const { service, sessionDir } = await startSession("ds_e2e_skipped");
    const cloned = structuredClone(FROZEN_RECEIPT) as {
      checks: Array<{ id: string; status: string; reason?: string; subject?: string }>;
      summary: { skipped: number; pass: number };
    };
    for (const id of ["layout.overflow", "layout.responsive_collision"]) {
      const check = cloned.checks.find((candidate) => candidate.id === id)!;
      check.status = "skipped";
      check.reason = "no chromium in CI";
      check.subject = "viewport run skipped";
    }
    cloned.summary.skipped += 2;
    cloned.summary.pass -= 2;
    await installFrozenReceipt(sessionDir, cloned);
    const plan = await service.designValidate({ design_session_id: "ds_e2e_skipped", mode: "plan" });

    const result = await service.designValidate({
      design_session_id: "ds_e2e_skipped",
      mode: "evaluate",
      evidence: evidenceForPlan(plan, "validation-evidence/receipt.json"),
    });

    expect(result.status).toBe("PASS");
    expect((result as { phase?: string }).phase).toBe("COMPLETE");
    const untouched = ((result.findings ?? []) as Array<{ check_id: string; provenance: string }>).find(
      (finding) => finding.check_id === "untouched_surface_regression",
    );
    expect(untouched?.provenance).toBe("attested");
    expect((result.warnings ?? []).some((warning) => warning.includes("attested"))).toBe(true);
    const readiness = (result as { readiness?: { claims: { skipped: string[] } } }).readiness;
    expect(readiness!.claims.skipped).toEqual(
      expect.arrayContaining(["layout.overflow", "layout.responsive_collision"]),
    );
  });

  it("a readiness-failing submission reviews with REVIEW_NOT_READY (spec §5.7 R2)", async () => {
    const { service, sessionDir } = await startSession("ds_e2e_notready");
    await installFrozenReceipt(sessionDir, doctoredReceipt({ id: "a11y.target_size", status: "fail" }));
    const plan = await service.designValidate({ design_session_id: "ds_e2e_notready", mode: "plan" });

    const result = await service.designValidate({
      design_session_id: "ds_e2e_notready",
      mode: "evaluate",
      evidence: evidenceForPlan(plan, "validation-evidence/receipt.json"),
    });

    expect(result.status).toBe("REVIEW");
    expect((result as { code?: string }).code).toBe("REVIEW_NOT_READY");
    const readiness = (result as { readiness?: { measurement: { error_failures_open: number } } }).readiness;
    expect(readiness!.measurement.error_failures_open).toBe(1);
    expect((result as { phase?: string }).phase).not.toBe("COMPLETE");
  });
});
