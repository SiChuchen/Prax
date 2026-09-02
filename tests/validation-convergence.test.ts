import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { DesignSessionSchema, FileSessionStore } from "prax-runtime";
import { PraxService, type PraxOutput } from "prax-mcp";
import { architectureUnderstanding, requirementConfirmation, sdirDelta } from "./fixtures.js";

const cleanup: string[] = [];
afterEach(async () => {
  await Promise.all(cleanup.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

async function startModifySurfaceSession(sessionId: string) {
  const root = await mkdtemp(join(tmpdir(), "prax-conv-"));
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

function evidenceForPlan(plan: PraxOutput, failing: string[]) {
  const checks = (plan.checks as Array<{ id: string; evidence_required: boolean }>).filter(
    (check) => check.evidence_required,
  );
  return {
    submitted_by: "operator",
    collected_at: new Date().toISOString(),
    items: checks.map((check) => ({
      check_id: check.id,
      outcome: (failing.includes(check.id) ? "fail" : "pass") as "fail" | "pass",
      source: "operator review",
      notes: `${check.id} ${failing.includes(check.id) ? "fail" : "pass"}`,
      artifact_refs: [],
    })),
  };
}

describe("validation convergence protocol (Task B3, spec §5.6)", () => {
  it("parses a legacy session without validation_loop with an empty history default", async () => {
    const { store } = await startModifySurfaceSession("ds_conv_legacy");
    const session = await store.getSession("ds_conv_legacy");
    const legacy = { ...session } as Record<string, unknown>;
    delete legacy.validation_loop;
    const parsed = DesignSessionSchema.parse(legacy);
    expect(parsed.validation_loop).toEqual({ history: [] });
  });

  it("stalls at the third consecutive non-improving evaluation, reports truthfully, and keeps the gate open", async () => {
    const { service, store } = await startModifySurfaceSession("ds_conv_stall");
    const plan = await service.designValidate({ design_session_id: "ds_conv_stall", mode: "plan" });
    const failing = [(plan.checks as Array<{ id: string; evidence_required: boolean }>)
      .filter((check) => check.evidence_required)[0]!.id];

    // Round 1: first non-PASS evaluation establishes the baseline — never counted as non-improving.
    const first = await service.designValidate({
      design_session_id: "ds_conv_stall",
      mode: "evaluate",
      evidence: evidenceForPlan(plan, failing),
    });
    expect(first.status).toBe("REVIEW");
    expect((first as { code?: string }).code).toBeUndefined();

    // Round 2: non-improving (open_findings equals the baseline minimum), stall counter = 1.
    const second = await service.designValidate({
      design_session_id: "ds_conv_stall",
      mode: "evaluate",
      evidence: evidenceForPlan(plan, failing),
    });
    expect(second.status).toBe("REVIEW");
    expect((second as { code?: string }).code).toBeUndefined();

    // Round 3: second consecutive non-improving evaluation → REVIEW VALIDATION_CONVERGENCE_STALLED.
    const third = await service.designValidate({
      design_session_id: "ds_conv_stall",
      mode: "evaluate",
      evidence: evidenceForPlan(plan, failing),
    });
    expect(third.status).toBe("REVIEW");
    expect((third as { code?: string }).code).toBe("VALIDATION_CONVERGENCE_STALLED");
    const stalled = third as { message?: string; unresolved?: string[] };
    expect(stalled.message ?? stalled.unresolved ?? JSON.stringify(third.findings)).toBeTruthy();

    // The gate is not locked: a subsequent design_validate call is still accepted.
    const fourth = await service.designValidate({
      design_session_id: "ds_conv_stall",
      mode: "evaluate",
      evidence: evidenceForPlan(plan, failing),
    });
    expect(fourth.status).toBe("REVIEW");

    // The stall event is recorded in session warnings.
    const session = await store.getSession("ds_conv_stall");
    expect(session.warnings.some((warning) => warning.includes("VALIDATION_CONVERGENCE_STALLED"))).toBe(true);
    expect(session.validation_loop?.history.length).toBe(4);
  });

  it("an improving round resets the non-improving streak before a stall can trigger", async () => {
    const { service } = await startModifySurfaceSession("ds_conv_improve");
    const plan = await service.designValidate({ design_session_id: "ds_conv_improve", mode: "plan" });
    const evidenceRequired = (plan.checks as Array<{ id: string; evidence_required: boolean }>).filter(
      (check) => check.evidence_required,
    );
    const twoFails = evidenceRequired.slice(0, 2).map((check) => check.id);
    const oneFail = [twoFails[0]!];

    // Baseline with two open findings.
    await service.designValidate({
      design_session_id: "ds_conv_improve",
      mode: "evaluate",
      evidence: evidenceForPlan(plan, twoFails),
    });
    // Improvement: one open finding — a new minimum resets the streak.
    await service.designValidate({
      design_session_id: "ds_conv_improve",
      mode: "evaluate",
      evidence: evidenceForPlan(plan, oneFail),
    });
    // Flat at the new minimum: streak = 1, not yet a stall.
    const third = await service.designValidate({
      design_session_id: "ds_conv_improve",
      mode: "evaluate",
      evidence: evidenceForPlan(plan, oneFail),
    });
    expect(third.status).toBe("REVIEW");
    expect((third as { code?: string }).code).not.toBe("VALIDATION_CONVERGENCE_STALLED");
  });
});
