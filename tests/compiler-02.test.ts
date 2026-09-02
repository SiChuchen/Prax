import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { FileSessionStore } from "prax-runtime";
import { PraxService } from "prax-mcp";
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

async function startSession(sessionId: string) {
  const root = await mkdtemp(join(tmpdir(), "prax-compiler-02-"));
  cleanup.push(root);
  const projectRoot = join(root, "project");
  await mkdir(projectRoot, { recursive: true });
  const store = new FileSessionStore({ stateRoot: join(root, "state"), idGenerator: () => sessionId });
  const service = await PraxService.create({ sessions: store });
  await service.designStart({
    requirement: "一个中文需求",
    project_root: projectRoot,
    mode: "greenfield",
    requirement_confirmation: requirementConfirmation(),
  });
  return { service, store };
}

function frame02() {
  const frame = architectureProductFrame() as Record<string, unknown>;
  return {
    ...frame,
    version: "0.2",
    jtbd: { verb: "understand", target: "模块间依赖", success: "三分钟内定位共享影响" },
    primary_object: { type: "canvas_object", label: "架构节点" },
    task_model: { frequency: "medium", reversibility: "reversible", consequence: "low", expertise: "mixed" },
  };
}

function decisions02(sessionId: string) {
  const decisions = architectureDecisions(sessionId) as Record<string, unknown>;
  return {
    ...decisions,
    version: "0.2",
    information_shape: {
      cardinality: "many",
      relationality: "high",
      hierarchy: "medium",
      temporality: "low",
      density: "medium",
    },
    representation: {
      primary: { type: "canvas", reason: "关系密度高，空间位置承载语义" },
      supporting: [],
      rejected: [{ option: "table", reason: "并排比较困难" }],
    },
  };
}

async function driveToPrepare(service: PraxService, sessionId: string, use02: boolean) {
  await service.designFrame({
    design_session_id: sessionId,
    product_frame: (use02 ? frame02() : architectureProductFrame()) as never,
  });
  await service.designContext({ design_session_id: sessionId, design_context: architectureContext() });
  const routed = await service.designRoute({ design_session_id: sessionId, question: "选择主结构" });
  const patternId = (routed.patterns as Array<{ id: string }>)[0]?.id ?? "PAT-CANVAS-WORKSPACE";
  await service.designInspect({
    design_session_id: sessionId,
    ids: [patternId],
    depth: "L1",
    purpose: { kind: "compare_alternatives", target_ids: [patternId], question: "确认模式" },
  });
  await service.designDecide({
    design_session_id: sessionId,
    design_decisions: (use02 ? decisions02(sessionId) : architectureDecisions(sessionId)) as never,
  });
  await service.designSdir({ design_session_id: sessionId, mode: "generate_from_decisions" });
  await service.designReconcile({ design_session_id: sessionId, capability_map: architectureCapabilities() });
  await service.designRealize({ design_session_id: sessionId, mode: "propose", realization_mode: "direct_code", conditions: directCodeConditions() });
  return service.designPrepareImplementation({ design_session_id: sessionId, platform: "web_desktop", framework: "react" });
}

describe("context compiler 0.2 sections (Task I2, spec §6.4)", () => {
  it("compiles representation_portfolio, state_ownership, and acceptance for 0.2 sessions", async () => {
    const { service } = await startSession("ds_compiler_02");
    const prepared = await driveToPrepare(service, "ds_compiler_02", true);
    expect(prepared.status).toBe("PASS");

    const compiled = prepared.compiled_context as Record<string, unknown>;
    const portfolio = compiled.representation_portfolio as {
      primary: { type: string };
      rejected: Array<{ option: string }>;
    };
    expect(portfolio.primary.type).toBe("canvas");
    expect(portfolio.rejected[0]?.option).toBe("table");
    const stateOwnership = compiled.state_ownership as Array<{ state: string; owner: string }>;
    expect(stateOwnership.some((entry) => entry.state === "selection")).toBe(true);
    const acceptance = compiled.acceptance as string[];
    expect(acceptance.length).toBeGreaterThanOrEqual(1);

    // the implementation brief carries matching reference lines
    const brief = prepared.implementation_brief as Record<string, unknown>;
    expect(brief.representation_portfolio_ref).toContain("compiled-context.yaml");
    expect(brief.state_ownership_ref).toContain("compiled-context.yaml");
    expect(brief.acceptance_ref).toContain("compiled-context.yaml");
  });

  it("0.1 sessions compile unchanged with no new sections", async () => {
    const { service } = await startSession("ds_compiler_01");
    const prepared = await driveToPrepare(service, "ds_compiler_01", false);
    expect(prepared.status).toBe("PASS");
    const compiled = prepared.compiled_context as Record<string, unknown>;
    expect(compiled.representation_portfolio).toBeUndefined();
    expect(compiled.state_ownership).toBeUndefined();
    expect(compiled.acceptance).toBeUndefined();
    const brief = prepared.implementation_brief as Record<string, unknown>;
    expect(brief.representation_portfolio_ref).toBeUndefined();
  });
});
