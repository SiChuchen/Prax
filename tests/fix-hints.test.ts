import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { FileSessionStore } from "prax-runtime";
import { PraxService, type PraxOutput } from "prax-mcp";
import {
  architectureCapabilities,
  architectureContext,
  architectureProductFrame,
  architectureUnderstanding,
  directCodeConditions,
  requirementConfirmation,
} from "./fixtures.js";

// m5.2 (m5 s5/s6 phenotype): agents read "does not satisfy
// 'representation_decided'" repeatedly without acting — the SDIR was version
// 0.1 (engine fallback), the checks read only a 0.2 SDIR, and nothing in the
// output said which tool regenerates what. These tests pin the discoverability
// contract: a generate fallback warning + per-finding fix_hint + stall
// fix_paths.

const cleanup: string[] = [];
afterEach(async () => {
  await Promise.all(cleanup.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

type Finding = { check_id: string; outcome: string; fix_hint?: string };

async function startAddSurfaceSession(sessionId: string) {
  const root = await mkdtemp(join(tmpdir(), "prax-hints-"));
  cleanup.push(root);
  const projectRoot = join(root, "project");
  await mkdir(projectRoot);
  const store = new FileSessionStore({ stateRoot: join(root, "state"), idGenerator: () => sessionId });
  const service = await PraxService.create({ sessions: store });
  await service.designStart({
    requirement: "给控制台加一个画布视图",
    project_root: projectRoot,
    mode: "existing_product",
    change_kind: "add_surface",
    requirement_confirmation: requirementConfirmation(),
  });
  await service.designFrame({ design_session_id: sessionId, existing_understanding: architectureUnderstanding([]) });
  // 0.2 frame (structure checks enter the plan only when the frame is 0.2 —
  // validator.ts planFor) with 0.1 decisions: generate then falls back to a
  // 0.1 SDIR, exactly the live m5 s5/s6 shape.
  const frame = architectureProductFrame();
  await service.designFrame({
    design_session_id: sessionId,
    product_frame: {
      ...frame,
      version: "0.2" as const,
      jtbd: { verb: "understand" as const, target: "模块间依赖", success: "三分钟内定位共享影响" },
      primary_object: { type: "canvas_object" as const },
      task_model: { frequency: "medium" as const, reversibility: "reversible" as const, consequence: "low" as const, expertise: "mixed" as const },
    },
  });
  await service.designContext({ design_session_id: sessionId, design_context: architectureContext() });
  const routed = await service.designRoute({ design_session_id: sessionId, question: "新面用什么结构" });
  const patternId = (routed.patterns as Array<{ id: string }>)[0]?.id ?? "PAT-CANVAS-WORKSPACE";
  await service.designInspect({
    design_session_id: sessionId,
    ids: [patternId],
    depth: "L1",
    purpose: { kind: "compare_alternatives", target_ids: [patternId], question: "确认模式" },
  });
  await service.designDecide({
    design_session_id: sessionId,
    design_decisions: {
      session_id: sessionId,
      primary_structure: { pattern: patternId, rationale: ["匹配"], confidence: "high" },
      information_hierarchy: { primary: ["architecture"], secondary: [] },
      density: { intent: "compact", strategy: ["grouping"], avoid: [] },
      major_choices: [],
      rejected: [{ option: "PAT-LIST-DETAIL", reason: "非列表任务" }],
      unresolved: [],
    },
  });
  const sdir = await service.designSdir({ design_session_id: sessionId, mode: "generate_from_decisions" });
  await service.designReconcile({ design_session_id: sessionId, capability_map: architectureCapabilities() });
  await service.designRealize({ design_session_id: sessionId, mode: "propose", realization_mode: "direct_code", conditions: directCodeConditions() });
  await service.designPrepareImplementation({ design_session_id: sessionId, platform: "web_desktop", framework: "react" });
  return { service, store, sdir, patternId };
}

function partialEvidence(plan: PraxOutput) {
  const checks = (plan.checks as Array<{ id: string; evidence_required: boolean }>).filter(
    (check) => check.evidence_required,
  );
  return {
    submitted_by: "operator",
    collected_at: new Date().toISOString(),
    items: [checks[0]!].map((check) => ({
      check_id: check.id,
      outcome: "pass" as const,
      source: "operator review",
      notes: `${check.id} pass`,
      artifact_refs: [],
    })),
  };
}

describe("fix-path discoverability (m5.2, s5/s6 evidence)", () => {
  it("design_sdir generate_from_decisions warns when it falls back to a 0.1 SDIR, naming the missing upstream inputs", async () => {
    const { sdir } = await startAddSurfaceSession("ds_hint_fallback");
    expect((sdir as { sdir?: { version: string } }).sdir?.version ?? "0.1").toBe("0.1");
    const warnings = (sdir as { warnings?: string[] }).warnings ?? [];
    const fallback = warnings.find((warning) => warning.includes("0.1"));
    expect(fallback).toBeDefined();
    // cause naming is precise: this fixture's frame IS 0.2-complete, so only
    // the decisions gap is named
    expect(fallback!).not.toContain("design_frame");
    expect(fallback!).toContain("design_decisions");
    expect(fallback!).toContain("representation_decided");
  });

  it("failing 0.2 structure findings carry a fix_hint naming the 0.2 chain and design_sdir", async () => {
    const { service } = await startAddSurfaceSession("ds_hint_findings");
    const plan = await service.designValidate({ design_session_id: "ds_hint_findings", mode: "plan" });
    const result = await service.designValidate({
      design_session_id: "ds_hint_findings",
      mode: "evaluate",
      evidence: partialEvidence(plan),
    });
    const findings = result.findings as Finding[];
    const hinted = findings.filter((finding) => finding.fix_hint !== undefined);
    for (const id of ["representation_decided", "state_ownership_declared", "acceptance_contract_present"]) {
      const finding = findings.find((candidate) => candidate.check_id === id);
      expect(finding?.outcome).toBe("fail");
      expect(finding?.fix_hint).toContain("0.2 SDIR");
      expect(finding?.fix_hint).toContain("design_sdir");
    }
    // hints attach only to failing checks with a known path — other failing
    // or missing items stay unhinted rather than guessing
    expect(hinted.length).toBe(3);
  });

  it("a convergence stall reports deduped fix_paths for the unresolved checks", async () => {
    const { service } = await startAddSurfaceSession("ds_hint_stall");
    const plan = await service.designValidate({ design_session_id: "ds_hint_stall", mode: "plan" });
    let stalled: PraxOutput | undefined;
    for (let round = 0; round < 3; round += 1) {
      stalled = await service.designValidate({
        design_session_id: "ds_hint_stall",
        mode: "evaluate",
        evidence: partialEvidence(plan),
      });
    }
    expect((stalled as { code?: string }).code).toBe("VALIDATION_CONVERGENCE_STALLED");
    const fixPaths = (stalled as { fix_paths?: string[] }).fix_paths ?? [];
    expect(fixPaths.length).toBeGreaterThan(0);
    expect(fixPaths.length).toBe(new Set(fixPaths).size);
    expect(fixPaths.join(" ")).toContain("design_sdir");
    expect(fixPaths.join(" ")).toContain("design_frame");
  });
});
