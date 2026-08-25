import { mkdir, mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { FileSessionStore } from "prax-runtime";
import { PraxService } from "prax-mcp";
import {
  architectureCapabilities,
  architectureContext,
  architectureDecisions,
  architectureProductFrame,
} from "./fixtures.js";

const cleanup: string[] = [];
afterEach(async () => {
  await Promise.all(cleanup.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

it("runs Architecture Canvas end-to-end and supports cross-Agent resume", async () => {
  const root = await mkdtemp(join(tmpdir(), "prax-e2e-"));
  cleanup.push(root);
  const projectRoot = join(root, "project");
  const stateRoot = join(root, "state");
  await mkdir(projectRoot);
  const store = new FileSessionStore({ stateRoot, idGenerator: () => "ds_architecture_canvas" });
  const service = await PraxService.create({ sessions: store });

  const started = await service.designStart({ requirement: "Build an Architecture Canvas for inspecting and tracing a complex software system.", project_root: projectRoot, mode: "greenfield" });
  expect(started.status).toBe("PASS");
  const sessionId = String(started.design_session_id);

  const outOfOrder = await service.designContext({ design_session_id: sessionId, design_context: architectureContext() });
  expect(outOfOrder.status).toBe("BLOCK");

  expect((await service.designFrame({ design_session_id: sessionId, product_frame: architectureProductFrame() })).status).toBe("PASS");
  expect((await service.designContext({ design_session_id: sessionId, design_context: architectureContext() })).status).toBe("PASS");

  const routed = await service.designRoute({ design_session_id: sessionId, question: "Choose the primary workspace pattern for tracing architecture relationships while preserving context" });
  expect(routed.status).toBe("PASS");
  const routedPatterns = routed.patterns as Array<Record<string, unknown>>;
  expect(routedPatterns[0]?.id).toBe("PAT-CANVAS-WORKSPACE");
  expect(JSON.stringify(routed)).not.toContain("pattern_contract");

  const inspected = await service.designInspect({ design_session_id: sessionId, ids: ["PAT-CANVAS-WORKSPACE"], depth: "L2", reason: "compare and select the primary pattern with explicit tradeoffs" });
  expect(inspected.status).toBe("PASS");
  expect(JSON.stringify(inspected)).toContain("pattern_contract");

  expect((await service.designDecide({ design_session_id: sessionId, design_decisions: architectureDecisions(sessionId) })).status).toBe("PASS");
  const sdir = await service.designSdir({ design_session_id: sessionId, mode: "generate_from_decisions" });
  expect(sdir.status).toBe("PASS");
  expect((sdir.sdir as { screen: { required_states: string[] } }).screen.required_states).toContain("selected");

  expect((await service.designReconcile({ design_session_id: sessionId, capability_map: architectureCapabilities() })).status).toBe("PASS");
  expect((await service.designPrepareImplementation({ design_session_id: sessionId, platform: "web_desktop", framework: "react" })).status).toBe("PASS");

  const planned = await service.designValidate({ design_session_id: sessionId, mode: "plan" });
  expect(planned.status).toBe("EXPAND");
  const checks = planned.checks as Array<{ id: string; evidence_required: boolean }>;
  const evidence = {
    submitted_by: "architecture-canvas-golden-review",
    collected_at: new Date().toISOString(),
    items: checks.filter((check) => check.evidence_required).map((check) => ({
      check_id: check.id,
      outcome: "pass" as const,
      source: "golden-case review and keyboard walkthrough",
      notes: `${check.id} passed the shared review rubric.`,
    })),
  };
  expect((await service.designValidate({ design_session_id: sessionId, mode: "submit_evidence", evidence })).status).toBe("PASS");
  const evaluated = await service.designValidate({ design_session_id: sessionId, mode: "evaluate" });
  expect(evaluated.status).toBe("PASS");
  expect(evaluated.phase).toBe("COMPLETE");

  const resumed = await PraxService.create({ sessions: new FileSessionStore({ stateRoot }) });
  const inspection = await resumed.inspectSession(sessionId);
  expect((inspection.session as { phase: string }).phase).toBe("COMPLETE");
  const artifactFiles = await readdir(String(inspection.artifact_directory));
  expect(artifactFiles).toEqual(expect.arrayContaining([
    "requirement.md", "product-frame.yaml", "design-context.yaml", "routing-log.yaml",
    "design-decisions.yaml", "screen.sdir.yaml", "capability-gaps.yaml",
    "implementation-brief.yaml", "validation-report.yaml", "session.yaml",
  ]));
});

