import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { FileSessionStore } from "prax-runtime";
import { PraxService } from "prax-mcp";
import {
  architectureContext,
  architectureDecisions,
  architectureProductFrame,
  requirementConfirmation,
  settingsContext,
  settingsDecisions,
} from "./fixtures.js";

const cleanup: string[] = [];
afterEach(async () => {
  await Promise.all(cleanup.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

// PRAX-WIZARD-001 first session: a mis-classified design_context could not be
// revised after routing advanced (GATE_NOT_SATISFIED), forcing a whole new
// session. design_context must be revisable while the chain is still pre-sdir
// (gates route/decide), rewinding completed gates back to route; after sdir it
// stays blocked, but says so.

async function freshService(sessionId: string) {
  const root = await mkdtemp(join(tmpdir(), "prax-ctxrev-"));
  cleanup.push(root);
  const projectRoot = join(root, "project");
  await mkdir(projectRoot);
  const store = new FileSessionStore({ stateRoot: join(root, "state"), idGenerator: () => sessionId });
  const service = await PraxService.create({ sessions: store });
  await service.designStart({
    requirement: "三步基准运行配置向导",
    project_root: projectRoot,
    mode: "greenfield",
    requirement_confirmation: requirementConfirmation(),
  });
  await service.designFrame({ design_session_id: sessionId, product_frame: architectureProductFrame() });
  return service;
}

it("design_context can be revised after routing, rewinding to the route gate", async () => {
  const service = await freshService("ds_ctxrev_1");

  const first = await service.designContext({
    design_session_id: "ds_ctxrev_1",
    design_context: settingsContext(),
  });
  expect(first.status).toBe("PASS");
  expect(first.phase).toBe("ROUTING");

  const routed = await service.designRoute({ design_session_id: "ds_ctxrev_1", question: "配置向导采用哪个模式" });
  expect(routed.status).toBe("PASS");

  // mis-classified context discovered after routing — the wizard trap
  const revised = await service.designContext({
    design_session_id: "ds_ctxrev_1",
    design_context: { ...settingsContext(), id: "prax_benchmark_wizard" },
  });
  expect(revised.status).toBe("PASS");
  expect(revised.phase).toBe("ROUTING");
  expect(revised.context_revised).toBe(true);
  expect(revised.next).toEqual({ tool: "design_route" });

  // the rewind makes routing legal again and the chain still completes
  const rerouted = await service.designRoute({ design_session_id: "ds_ctxrev_1", question: "配置向导采用哪个模式" });
  expect(rerouted.status).toBe("PASS");

  await service.designInspect({
    design_session_id: "ds_ctxrev_1",
    ids: ["PAT-SETTINGS-SECTIONS"],
    depth: "L1",
    purpose: { kind: "compare_alternatives", target_ids: ["PAT-SETTINGS-SECTIONS"], question: "确认分区模式" },
  });
  const decided = await service.designDecide({
    design_session_id: "ds_ctxrev_1",
    design_decisions: {
      ...settingsDecisions("ds_ctxrev_1"),
      rejected: [{ option: "PAT-WORKSPACE", reason: "持久对象工作面与线性一次性配置流不合" }],
    },
  });
  expect(decided.status).toBe("PASS");
  expect(decided.phase).toBe("SDIR");
});

it("design_context revision also works at the decide gate (after routing, before sdir)", async () => {
  const service = await freshService("ds_ctxrev_2");
  await service.designContext({ design_session_id: "ds_ctxrev_2", design_context: settingsContext() });
  await service.designRoute({ design_session_id: "ds_ctxrev_2", question: "配置向导采用哪个模式" });

  const revised = await service.designContext({
    design_session_id: "ds_ctxrev_2",
    design_context: { ...settingsContext(), id: "prax_benchmark_wizard" },
  });
  expect(revised.status).toBe("PASS");
  expect(revised.phase).toBe("ROUTING");
  expect(revised.context_revised).toBe(true);
});

it("design_context stays blocked after sdir, with an explicit hint", async () => {
  const service = await freshService("ds_ctxrev_3");
  await service.designContext({ design_session_id: "ds_ctxrev_3", design_context: architectureContext() });
  const routed = await service.designRoute({ design_session_id: "ds_ctxrev_3", question: "画布采用哪个模式" });
  const patternId = (routed.patterns as Array<{ id: string }>)[0]?.id ?? "PAT-CANVAS-WORKSPACE";
  await service.designInspect({
    design_session_id: "ds_ctxrev_3",
    ids: [patternId],
    depth: "L1",
    purpose: { kind: "compare_alternatives", target_ids: [patternId], question: "确认模式" },
  });
  await service.designDecide({ design_session_id: "ds_ctxrev_3", design_decisions: architectureDecisions("ds_ctxrev_3") });
  const sdir = await service.designSdir({ design_session_id: "ds_ctxrev_3", mode: "generate_from_decisions" });
  expect(sdir.status).toBe("PASS");

  const blocked = await service.designContext({
    design_session_id: "ds_ctxrev_3",
    design_context: architectureContext(),
  });
  expect(blocked.status).toBe("BLOCK");
  expect(String((blocked as { message?: string }).message)).toMatch(/revised before the sdir gate|new session/i);
});
