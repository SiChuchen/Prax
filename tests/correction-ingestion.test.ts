import { mkdir, mkdtemp, readFile, readdir, rm, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse } from "yaml";
import { afterEach, expect, it } from "vitest";
import { FileSessionStore, loadCorrections } from "prax-runtime";
import { PraxService } from "prax-mcp";
import { architectureUnderstanding, requirementConfirmation, sdirDelta } from "./fixtures.js";

/**
 * Agent-facing correction ingestion (design_correct): the write path for
 * project-local corrections.yaml that MEM-001 limitation #1 recorded as
 * missing (previously operator-mediated only).
 */

const cleanup: string[] = [];
afterEach(async () => {
  await Promise.all(cleanup.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

function settingsCorrectionInput() {
  return {
    id: "corr_settings_001",
    scope: { project: "architecture_canvas", surfaces: ["settings"] },
    finding: { type: "hierarchy_semantics", observed: "search competed with section navigation" },
    intended: { statement: "search stays supporting and never outranks sections" },
    evidence_refs: ["human_review_001"],
    regression: { check_id: "settings_search_supporting", requirement: "search remains a supporting control" },
    supersedes: [],
    promotion: { candidate: false },
  };
}

async function makeService(sessionId: string) {
  const root = await mkdtemp(join(tmpdir(), "prax-corr-ingest-"));
  cleanup.push(root);
  const projectRoot = join(root, "project");
  await mkdir(projectRoot, { recursive: true });
  const stateRoot = join(root, "state");
  const store = new FileSessionStore({ stateRoot, idGenerator: () => sessionId });
  const service = await PraxService.create({ sessions: store });
  return { service, projectRoot, stateRoot };
}

async function serviceFor(stateRoot: string, sessionId: string) {
  const store = new FileSessionStore({ stateRoot, idGenerator: () => sessionId });
  return PraxService.create({ sessions: store });
}

async function startAnchorSession(service: PraxService, projectRoot: string, sessionId: string) {
  const started = await service.designStart({
    requirement: "Anchor session for correction ingestion.",
    project_root: projectRoot,
    mode: "greenfield",
    requirement_confirmation: requirementConfirmation(),
  });
  expect(["PASS", "WARN"]).toContain(started.status);
}

async function runModifySession(stateRoot: string, projectRoot: string, sessionId: string) {
  const service = await serviceFor(stateRoot, sessionId);
  await service.designStart({
    requirement: "把设置页改成分区检索式",
    project_root: projectRoot,
    mode: "existing_product",
    change_kind: "modify_surface",
    requirement_confirmation: requirementConfirmation(),
  });
  await service.designFrame({
    design_session_id: sessionId,
    existing_understanding: architectureUnderstanding(["settings"]),
  });
  const routed = await service.designRoute({ design_session_id: sessionId, question: "如何在设置页承载检索" });
  const patternId = (routed.patterns as Array<{ id: string }>)[0]?.id ?? "PAT-SETTINGS-SECTIONS";
  await service.designInspect({
    design_session_id: sessionId,
    ids: [patternId],
    depth: "L1",
    purpose: { kind: "compare_alternatives", target_ids: [patternId], question: "确认分区模式" },
  });
  await service.designDecide({
    design_session_id: sessionId,
    design_decisions: {
      session_id: sessionId,
      primary_structure: { pattern: patternId, rationale: ["分区"], confidence: "high" },
      information_hierarchy: { primary: ["settings"], secondary: ["search"] },
      density: { intent: "regular", strategy: ["分区标题"], avoid: [] },
      major_choices: [],
      rejected: [{ option: "长表单", reason: "检索成本高" }],
      unresolved: [],
    },
  });
  await service.designSdir({ design_session_id: sessionId, mode: "apply_delta", sdir_delta: sdirDelta() });
  await service.designPrepareImplementation({ design_session_id: sessionId, platform: "web_desktop", framework: "react" });
}

it("design_correct records a correction that a later session carries as a validation obligation", async () => {
  const { service, projectRoot, stateRoot } = await makeService("ds_corr_anchor");
  await startAnchorSession(service, projectRoot, "ds_corr_anchor");

  const recorded = await service.designCorrect({
    design_session_id: "ds_corr_anchor",
    correction: settingsCorrectionInput(),
  });
  expect(recorded.status).toBe("PASS");
  expect(recorded.active_corrections).toBe(1);

  const raw = parse(await readFile(join(projectRoot, ".prax", "corrections.yaml"), "utf8")) as {
    version: string;
    corrections: Array<{ id: string; created_at: string; evidence_refs: string[] }>;
  };
  expect(raw.version).toBe("0.1");
  expect(raw.corrections).toHaveLength(1);
  expect(raw.corrections[0].id).toBe("corr_settings_001");
  expect(raw.corrections[0].created_at).toBeTruthy();
  expect(await loadCorrections(join(projectRoot, ".prax"))).toHaveLength(1);

  await runModifySession(stateRoot, projectRoot, "ds_corr_consumer");
  const planned = await service.designValidate({ design_session_id: "ds_corr_consumer", mode: "plan" });
  expect(planned.status).toBe("EXPAND");
  expect(planned.missing_evidence as string[]).toContain("settings_search_supporting");
  expect(planned.correction_regressions).toEqual([
    { correction_id: "corr_settings_001", check_id: "settings_search_supporting", surfaces: ["settings"] },
  ]);
});

it("rejects duplicate ids and unknown supersedes targets without writing", async () => {
  const { service, projectRoot, stateRoot } = await makeService("ds_corr_anchor");
  await startAnchorSession(service, projectRoot, "ds_corr_anchor");
  expect(
    (await service.designCorrect({ design_session_id: "ds_corr_anchor", correction: settingsCorrectionInput() })).status,
  ).toBe("PASS");

  const duplicate = await service.designCorrect({
    design_session_id: "ds_corr_anchor",
    correction: settingsCorrectionInput(),
  });
  expect(duplicate.status).toBe("RETRY");
  expect(duplicate.code).toBe("CORRECTION_INGESTION_INVALID");
  expect(JSON.stringify(duplicate.issues)).toContain("already exists");

  const unknownSupersedes = await service.designCorrect({
    design_session_id: "ds_corr_anchor",
    correction: {
      ...settingsCorrectionInput(),
      id: "corr_settings_002",
      supersedes: ["corr_does_not_exist"],
    },
  });
  expect(unknownSupersedes.status).toBe("RETRY");
  expect(JSON.stringify(unknownSupersedes.issues)).toContain("corr_does_not_exist");

  expect(await loadCorrections(join(projectRoot, ".prax"))).toHaveLength(1);
});

it("preserves corrupt project memory when ingestion fails", async () => {
  const { service, projectRoot } = await makeService("ds_corr_corrupt");
  await startAnchorSession(service, projectRoot, "ds_corr_corrupt");
  const file = join(projectRoot, ".prax", "corrections.yaml");
  const raw = "version: '0.1'\ncorrections: [broken";
  await writeFile(file, raw, "utf8");
  await expect(service.designCorrect({
    design_session_id: "ds_corr_corrupt", correction: settingsCorrectionInput(),
  })).rejects.toMatchObject({ code: "CORRECTIONS_READ_FAILED" });
  expect(await readFile(file, "utf8")).toBe(raw);
});

it("does not steal an old project correction lock and can retry after operator recovery", async () => {
  const { service, projectRoot } = await makeService("ds_corr_lock");
  await startAnchorSession(service, projectRoot, "ds_corr_lock");
  const root = join(projectRoot, ".prax");
  const lock = join(root, "corrections.lock");
  const holder = `999999 ${Date.now() - 120_000}`;
  await writeFile(lock, holder, "utf8");
  const input = { design_session_id: "ds_corr_lock", correction: settingsCorrectionInput() };
  await expect(service.designCorrect(input)).rejects.toMatchObject({ code: "CORRECTIONS_LOCK_HELD" });
  expect(await readFile(lock, "utf8")).toBe(holder);
  expect(await loadCorrections(root)).toEqual([]);
  await unlink(lock);
  expect((await service.designCorrect(input)).status).toBe("PASS");
  expect((await readdir(root)).filter((file) => file.endsWith(".tmp") || file.endsWith(".lock"))).toEqual([]);
});

it.each([false, true])("serializes project inserts across independent state roots (duplicate: %s)", async (duplicate) => {
  const { service, projectRoot, stateRoot } = await makeService("ds_corr_race_0");
  await startAnchorSession(service, projectRoot, "ds_corr_race_0");
  const services = [service];
  for (let index = 1; index < 4; index += 1) {
    const peer = await serviceFor(`${stateRoot}-${index}`, `ds_corr_race_${index}`);
    await startAnchorSession(peer, projectRoot, `ds_corr_race_${index}`);
    services.push(peer);
  }
  const results = await Promise.all(services.map((peer, index) => peer.designCorrect({
    design_session_id: `ds_corr_race_${index}`,
    correction: { ...settingsCorrectionInput(), id: duplicate ? "corr_race" : `corr_race_${index}` },
  })));
  expect(results.filter((result) => result.status === "PASS")).toHaveLength(duplicate ? 1 : 4);
  for (const rejected of results.filter((result) => result.status !== "PASS")) {
    expect(rejected).toMatchObject({ status: "RETRY", code: "CORRECTION_INGESTION_INVALID" });
    expect(JSON.stringify(rejected.issues)).toContain("already exists");
  }
  expect(await loadCorrections(join(projectRoot, ".prax"))).toHaveLength(duplicate ? 1 : 4);
});

it("a superseding correction replaces the earlier obligation for later sessions", async () => {
  const { service, projectRoot, stateRoot } = await makeService("ds_corr_anchor");
  await startAnchorSession(service, projectRoot, "ds_corr_anchor");
  await service.designCorrect({ design_session_id: "ds_corr_anchor", correction: settingsCorrectionInput() });
  await service.designCorrect({
    design_session_id: "ds_corr_anchor",
    correction: {
      ...settingsCorrectionInput(),
      id: "corr_settings_002",
      finding: { type: "hierarchy_semantics", observed: "search still competed after the first fix" },
      intended: { statement: "search is removed from the settings header entirely" },
      evidence_refs: ["human_review_002"],
      supersedes: ["corr_settings_001"],
    },
  });

  await runModifySession(stateRoot, projectRoot, "ds_corr_consumer");
  const planned = await service.designValidate({ design_session_id: "ds_corr_consumer", mode: "plan" });
  expect(planned.correction_regressions).toEqual([
    { correction_id: "corr_settings_002", check_id: "settings_search_supporting", surfaces: ["settings"] },
  ]);
});
