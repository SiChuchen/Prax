import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { FileSessionStore } from "prax-runtime";
import { PraxService, type PraxOutput } from "prax-mcp";
import {
  architectureCapabilities,
  architectureContext,
  architectureDecisions,
  architectureProductFrame,
  directCodeConditions,
  requirementConfirmation,
} from "./fixtures.js";

const cleanup: string[] = [];
afterEach(async () => {
  await Promise.all(cleanup.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("legacy 0.1 session resume (Task I3, Gate 2)", () => {
  it("resumes across service restarts and completes validate with zero new obligations", async () => {
    const root = await mkdtemp(join(tmpdir(), "prax-legacy-resume-"));
    cleanup.push(root);
    const projectRoot = join(root, "project");
    await mkdir(projectRoot, { recursive: true });
    const stateRoot = join(root, "state");
    const sessionId = "ds_legacy_resume";

    // first lifetime: a 0.1 session driven to the validate gate
    const store = new FileSessionStore({ stateRoot, idGenerator: () => sessionId });
    const service = await PraxService.create({ sessions: store });
    await service.designStart({
      requirement: "一个中文需求",
      project_root: projectRoot,
      mode: "greenfield",
      requirement_confirmation: requirementConfirmation(),
    });
    await service.designFrame({ design_session_id: sessionId, product_frame: architectureProductFrame() });
    await service.designContext({ design_session_id: sessionId, design_context: architectureContext() });
    const routed = await service.designRoute({ design_session_id: sessionId, question: "选择主结构" });
    const patternId = (routed.patterns as Array<{ id: string }>)[0]?.id ?? "PAT-CANVAS-WORKSPACE";
    await service.designInspect({
      design_session_id: sessionId,
      ids: [patternId],
      depth: "L1",
      purpose: { kind: "compare_alternatives", target_ids: [patternId], question: "确认模式" },
    });
    await service.designDecide({ design_session_id: sessionId, design_decisions: architectureDecisions(sessionId) });
    await service.designSdir({ design_session_id: sessionId, mode: "generate_from_decisions" });
    await service.designReconcile({ design_session_id: sessionId, capability_map: architectureCapabilities() });
    await service.designRealize({ design_session_id: sessionId, mode: "propose", realization_mode: "direct_code", conditions: directCodeConditions() });
    await service.designPrepareImplementation({ design_session_id: sessionId, platform: "web_desktop", framework: "react" });
    const plan = await service.designValidate({ design_session_id: sessionId, mode: "plan" });
    expect((plan as PraxOutput).status).toBe("EXPAND");

    // second lifetime: a fresh service instance resumes from disk alone
    const resumed = await PraxService.create({ sessions: new FileSessionStore({ stateRoot }) });
    const resumedPlan = await resumed.designValidate({ design_session_id: sessionId, mode: "plan" });
    const checkIds = (resumedPlan.checks as Array<{ id: string }>).map((check) => check.id);

    // zero new obligations: the 0.2 structure checks are NOT assembled
    for (const id of ["representation_decided", "state_ownership_declared", "acceptance_contract_present", "complexity_budget_declared"]) {
      expect(checkIds).not.toContain(id);
    }
    // the mapped measurement checks still require receipts (that obligation
    // predates 0.2 — not a new one), so attach one and complete
    const { writeMeasurementReceipt } = await import("./fixtures.js");
    const receiptRef = await writeMeasurementReceipt(new FileSessionStore({ stateRoot }), sessionId);
    const checks = resumedPlan.checks as Array<{ id: string; evidence_required: boolean }>;
    const evidence = {
      submitted_by: "operator",
      collected_at: new Date().toISOString(),
      items: checks.filter((check) => check.evidence_required).map((check) => ({
        check_id: check.id,
        outcome: "pass" as const,
        source: "operator review",
        notes: `${check.id} pass`,
        artifact_refs: [],
        ...(check.id === "keyboard" ? { measurement_receipt: receiptRef } : {}),
      })),
    };
    await resumed.designValidate({ design_session_id: sessionId, mode: "submit_evidence", evidence });
    const evaluated = await resumed.designValidate({ design_session_id: sessionId, mode: "evaluate" });
    expect((evaluated as PraxOutput).status).toBe("PASS");
    expect((evaluated as { phase?: string }).phase).toBe("COMPLETE");
  });
});
