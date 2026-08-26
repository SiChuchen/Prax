import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  deriveContextManifest,
  manifestStale,
  type ContextManifest,
  type DesignContext,
  type DesignSession,
} from "prax-runtime";
import { FileSessionStore } from "prax-runtime";
import { PraxService } from "prax-mcp";
import {
  architectureContext,
  architectureProductFrame,
  architectureUnderstanding,
  intentLite,
  requirementConfirmation,
} from "./fixtures.js";

const cleanup: string[] = [];
afterEach(async () => {
  await Promise.all(cleanup.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

let counter = 0;
function bareSession(): DesignSession {
  counter += 1;
  return {
    id: `ds_bare_${counter}`,
    project_root: "E:/tmp",
    mode: "greenfield",
    phase: "ROUTING",
    created_at: "2026-08-26T00:00:00.000Z",
    updated_at: "2026-08-26T00:00:00.000Z",
    revision: counter,
    requirement_ref: "requirement.md",
    completed_gates: [],
    current_gate: { name: "route" },
  };
}

async function startSession(
  sessionId: string,
  mode: "greenfield" | "existing_product",
  changeKind?: "add_surface" | "modify_surface" | "visual_polish" | "defect_fix",
) {
  const root = await mkdtemp(join(tmpdir(), "prax-manifest-"));
  cleanup.push(root);
  const projectRoot = join(root, "project");
  await mkdir(projectRoot);
  const store = new FileSessionStore({ stateRoot: join(root, "state"), idGenerator: () => sessionId });
  const service = await PraxService.create({ sessions: store });
  const started = await service.designStart({
    requirement: "一个中文需求",
    project_root: projectRoot,
    mode,
    ...(changeKind === undefined ? {} : { change_kind: changeKind }),
    requirement_confirmation: requirementConfirmation(),
  });
  expect(started.status).toBe("PASS");
  return { service, store };
}

describe("context manifest derivation", () => {
  it("greenfield: derives and persists a manifest at routing time", async () => {
    const { service, store } = await startSession("ds_man_gf", "greenfield");
    await service.designFrame({ design_session_id: "ds_man_gf", product_frame: architectureProductFrame() });
    await service.designContext({ design_session_id: "ds_man_gf", design_context: architectureContext() });
    const routed = await service.designRoute({ design_session_id: "ds_man_gf", question: "选择主结构" });
    expect(routed.status).toMatch(/PASS|WARN/);

    const manifest = routed.context_manifest as ContextManifest;
    expect(manifest.version).toBe("0.1");
    expect(manifest.context_capabilities.relationships).toBe("required");
    expect(manifest.context_capabilities.existing_behavior).toBe("none");
    expect(manifest.context_capabilities.data_evidence).toBe("none");
    expect(manifest.fidelity_profiles).toContain("workspace_coherence");
    expect(manifest.validation_profiles).toContain("relationship_integrity");
    expect(manifest.derived_from.mode).toBe("greenfield");
    expect(manifest.derived_from.artifact_digests.product_frame).toBeDefined();
    expect(manifest.derived_from.artifact_digests.design_context).toBeDefined();

    const session = await store.getSession("ds_man_gf");
    const persisted = await store.readArtifact<ContextManifest>(session, "contextManifest");
    expect(persisted).toEqual(manifest);
  });

  it("modify_surface: existing behavior is required and understanding feeds the manifest", async () => {
    const { service } = await startSession("ds_man_mod", "existing_product", "modify_surface");
    await service.designFrame({
      design_session_id: "ds_man_mod",
      existing_understanding: architectureUnderstanding(["settings"]),
    });
    const routed = await service.designRoute({ design_session_id: "ds_man_mod", question: "如何承载检索" });
    const manifest = routed.context_manifest as ContextManifest;
    expect(manifest.context_capabilities.existing_behavior).toBe("required");
    expect(manifest.context_capabilities.relationships).toBe("required");
    expect(manifest.derived_from.change_kind).toBe("modify_surface");
    expect(manifest.derived_from.artifact_digests.existing_understanding).toBeDefined();
    expect(manifest.derived_from.artifact_digests.product_frame).toBeUndefined();
  });

  it("visual_polish: light path gets a tiny manifest without full-chain cost", async () => {
    const { service } = await startSession("ds_man_vp", "existing_product", "visual_polish");
    await service.designFrame({
      design_session_id: "ds_man_vp",
      existing_understanding: architectureUnderstanding(["settings"]),
    });
    const result = await service.designFrame({ design_session_id: "ds_man_vp", intent_lite: intentLite("visual_polish") });
    expect(result.status).toBe("PASS");
    const manifest = result.context_manifest as ContextManifest;
    expect(manifest.fidelity_profiles).toContain("reference_visual_fidelity");
    expect(manifest.validation_profiles).toContain("visual_snapshot");
    expect(manifest.validation_profiles).not.toContain("semantic_integrity");
    expect(manifest.context_capabilities.existing_behavior).toBe("required");
  });

  it("keeps unknown context needs unresolved instead of inventing capability", () => {
    const context: DesignContext = {
      ...architectureContext(),
      information: { ...architectureContext().information, relationship_complexity: "unknown" },
      classification: undefined,
    };
    const frame = { ...architectureProductFrame(), relationships: [] };
    const manifest = deriveContextManifest({ session: bareSession(), frame, context });
    expect(manifest.context_capabilities.relationships).toBe("none");
    expect(manifest.unresolved.join(" ")).toMatch(/relationship complexity is unknown/);
  });

  it("classification feeds the manifest as a bounded signal without duplication", () => {
    const context: DesignContext = {
      ...architectureContext(),
      classification: {
        version: "1",
        task_type: "inspect",
        domain_id: "software_architecture",
        interaction_mode: "canvas",
        product_type: "canvas_workspace",
        primary_object_type: "architecture_node",
        secondary_object_types: [],
        confidence: "high",
        evidence: [],
        open_questions: [],
      },
    };
    const manifest = deriveContextManifest({ session: bareSession(), frame: architectureProductFrame(), context });
    expect(manifest.product_archetypes).toEqual(["canvas_workspace"]);
  });

  it("derivation is deterministic for identical authoritative state", () => {
    const session = bareSession();
    const first = deriveContextManifest({ session, frame: architectureProductFrame(), context: architectureContext() });
    const second = deriveContextManifest({ session, frame: architectureProductFrame(), context: architectureContext() });
    expect(first).toEqual(second);
  });

  it("upstream artifact change makes the stored manifest stale", () => {
    const session = bareSession();
    const stored = deriveContextManifest({ session, frame: architectureProductFrame(), context: architectureContext() });
    expect(manifestStale(stored, { session, frame: architectureProductFrame(), context: architectureContext() })).toBe(false);
    const changedFrame = {
      ...architectureProductFrame(),
      relationships: [
        ...architectureProductFrame().relationships,
        { source: "group", target: "flow", type: "contains" },
      ],
    };
    expect(manifestStale(stored, { session, frame: changedFrame, context: architectureContext() })).toBe(true);
  });
});
