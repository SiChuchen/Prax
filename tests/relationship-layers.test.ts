import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { FileSessionStore, validateExistingUnderstanding, validateProductFrame } from "prax-runtime";
import { PraxService } from "prax-mcp";
import { SdirEngine } from "prax-sdir";
import {
  architectureContext,
  architectureDecisions,
  architectureProductFrame,
  architectureUnderstanding,
  requirementConfirmation,
} from "./fixtures.js";

const cleanup: string[] = [];
afterEach(async () => {
  await Promise.all(cleanup.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("layer A — product relationships", () => {
  it("assigns deterministic ids to legacy relationships and keeps them stable", () => {
    const frame = architectureProductFrame();
    const first = validateProductFrame(frame, "greenfield");
    expect(first.status).toMatch(/PASS|WARN/);
    const legacy = first.value!.relationships.find((r) => r.source === "flow" && r.target === "architecture_node");
    expect(legacy?.id).toBe("rel_flow_architecture_node");

    const second = validateProductFrame(architectureProductFrame(), "greenfield");
    expect(
      second.value!.relationships.find((r) => r.source === "flow")?.id,
    ).toBe(legacy?.id);
  });

  it("preserves direction, meaning, importance and keeps condition as opaque text", () => {
    const result = validateProductFrame(architectureProductFrame(), "greenfield");
    const declared = result.value!.relationships.find((r) => r.id === "rel_node_relationship");
    expect(declared).toMatchObject({
      direction: "forward",
      meaning: expect.stringContaining("trace"),
      condition: "whenever the graph contains the node",
      importance: "primary",
    });
  });

  it("rejects relationships whose endpoints do not resolve to declared objects", () => {
    const frame = architectureProductFrame();
    frame.relationships = [
      { source: "architecture_node", target: "ghost_service", type: "depends_on" },
    ];
    const result = validateProductFrame(frame, "greenfield");
    expect(result.status).toBe("EXPAND");
    expect(result.issues.join(" ")).toMatch(/unknown target object 'ghost_service'/);
  });

  it("rejects self-loops and duplicate explicit ids", () => {
    const selfLoop = architectureProductFrame();
    selfLoop.relationships = [{ source: "flow", target: "flow", type: "loops" }];
    const selfLoopResult = validateProductFrame(selfLoop, "greenfield");
    expect(selfLoopResult.issues.join(" ")).toMatch(/links an object to itself/);

    const duplicated = architectureProductFrame();
    duplicated.relationships = [
      { id: "rel_dup", source: "flow", target: "architecture_node", type: "passes_through" },
      { id: "rel_dup", source: "architecture_node", target: "relationship", type: "connected_by" },
    ];
    const duplicateResult = validateProductFrame(duplicated, "greenfield");
    expect(duplicateResult.issues.join(" ")).toMatch(/'rel_dup' is declared more than once/);
  });

  it("disambiguates identical legacy triples with deterministic suffixes", () => {
    const frame = architectureProductFrame();
    frame.relationships = [
      { source: "flow", target: "architecture_node", type: "passes_through" },
      { source: "flow", target: "architecture_node", type: "passes_through" },
    ];
    const result = validateProductFrame(frame, "greenfield");
    const ids = result.value!.relationships.map((r) => r.id);
    expect(new Set(ids).size).toBe(2);
    expect(ids[0]).toBe("rel_flow_architecture_node");
    expect(ids[1]).toBe("rel_flow_architecture_node_2");
  });

  it("lets a simple project omit relationships entirely", () => {
    const frame = architectureProductFrame();
    frame.relationships = [];
    expect(validateProductFrame(frame, "greenfield").status).toMatch(/PASS|WARN/);
  });
});

describe("existing understanding — current relationships", () => {
  it("resolves current relationship endpoints against current objects", () => {
    const result = validateExistingUnderstanding(architectureUnderstanding(["settings"]), "existing_product", "modify_surface");
    expect(result.status).toMatch(/PASS|WARN/);
    expect(result.value!.current_relationships[0]).toMatchObject({
      id: "rel_current_node_preference",
      source: "architecture_node",
      target: "preference",
    });
  });

  it("rejects current relationships referencing unknown objects", () => {
    const understanding = architectureUnderstanding(["settings"]);
    understanding.current_relationships = [
      { source: "architecture_node", target: "ghost_api", type: "depends_on", evidence_refs: [] },
    ];
    const result = validateExistingUnderstanding(understanding, "existing_product", "modify_surface");
    expect(result.status).toBe("EXPAND");
    expect(result.codes).toContain("CURRENT_RELATIONSHIP_INVALID");
    expect(result.issues.join(" ")).toMatch(/unknown target object 'ghost_api'/);
  });

  it("allows omitting current relationships without inventing any", () => {
    const understanding = architectureUnderstanding(["settings"]);
    understanding.current_relationships = [];
    const result = validateExistingUnderstanding(understanding, "existing_product", "modify_surface");
    expect(result.status).toMatch(/PASS|WARN/);
    expect(result.value!.current_relationships).toEqual([]);
  });
});

describe("derived frame preservation", () => {
  it("keeps confirmed current relationships instead of hardcoding an empty array", async () => {
    const root = await mkdtemp(join(tmpdir(), "prax-rel-"));
    cleanup.push(root);
    const projectRoot = join(root, "project");
    await mkdir(projectRoot);
    const store = new FileSessionStore({ stateRoot: join(root, "state"), idGenerator: () => "ds_rel" });
    const service = await PraxService.create({ sessions: store });
    expect(
      (await service.designStart({
        requirement: "把设置页改成分区检索式",
        project_root: projectRoot,
        mode: "existing_product",
        change_kind: "modify_surface",
        requirement_confirmation: requirementConfirmation(),
      })).status,
    ).toBe("PASS");
    await service.designFrame({ design_session_id: "ds_rel", existing_understanding: architectureUnderstanding(["settings"]) });

    const routed = await service.designRoute({ design_session_id: "ds_rel", question: "如何在设置页承载检索" });
    expect(routed.status).toMatch(/PASS|WARN/);

    const session = await store.getSession("ds_rel");
    const derivedFrame = await store.readArtifact<{ relationships: Array<Record<string, unknown>> }>(session, "productFrame");
    expect(derivedFrame).toBeDefined();
    const preserved = derivedFrame!.relationships.find((r) => r.source === "architecture_node" && r.target === "preference");
    expect(preserved).toMatchObject({
      id: "rel_current_node_preference",
      type: "may_configure",
      direction: "forward",
      meaning: "selecting a node can surface its configuration entries",
      importance: "supporting",
    });
  });
});

describe("layer B — SDIR region relationships", () => {
  it("generates stable region relationship ids", () => {
    const sdir = new SdirEngine().generate(
      architectureProductFrame(),
      architectureContext(),
      architectureDecisions("ds_region"),
    );
    expect(sdir.screen.relationships[0]).toMatchObject({ id: "region_rel_architecture_inspector" });
  });

  it("rejects duplicated region relationship ids", () => {
    const engine = new SdirEngine();
    const sdir = engine.generate(architectureProductFrame(), architectureContext(), architectureDecisions("ds_region"));
    sdir.screen.relationships.push({ ...sdir.screen.relationships[0] });
    const result = engine.validate(sdir);
    expect(result.status).toBe("RETRY");
    expect(result.semantic_issues.map((issue) => issue.code)).toContain("SDIR_RELATION_ID_DUPLICATE");
  });

  it("keeps product relationships independent of region relationships", () => {
    const engine = new SdirEngine();
    const sdir = engine.generate(architectureProductFrame(), architectureContext(), architectureDecisions("ds_region"));
    expect(engine.validate(sdir).status).toBe("PASS");
    const productIds = new Set(architectureProductFrame().relationships.map((r) => `${r.source}->${r.target}`));
    for (const region of sdir.screen.relationships) {
      expect(productIds.has(`${region.source}->${region.target}`)).toBe(false);
    }
  });
});
