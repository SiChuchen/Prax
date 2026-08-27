import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { toJSONSchema } from "zod";
import { afterEach, describe, expect, it } from "vitest";
import { FileSessionStore } from "prax-runtime";
import { PraxService, DesignStartClientSchema, DesignRealizeInputSchema } from "prax-mcp";
import { requirementConfirmation } from "./fixtures.js";

const cleanup: string[] = [];
afterEach(async () => {
  await Promise.all(cleanup.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("client-facing design_start schema (gap-mcp-anyof-schema)", () => {
  it("serializes to a single flat object schema with no top-level anyOf or additionalProperties lock", () => {
    const json = toJSONSchema(DesignStartClientSchema, { target: "draft-2020-12", io: "input" });
    expect(json.type).toBe("object");
    expect((json as { anyOf?: unknown }).anyOf).toBeUndefined();
    expect((json as { additionalProperties?: unknown }).additionalProperties).toBeUndefined();
  });

  it("accepts a create payload that mixes optional fields (the shape strict validators rejected)", () => {
    const parsed = DesignStartClientSchema.safeParse({
      requirement: "把设置页改成分区检索式",
      project_root: "E:/tmp/project",
      mode: "existing_product",
      change_kind: "modify_surface",
      requirement_confirmation: requirementConfirmation(),
    });
    expect(parsed.success).toBe(true);
  });

  it("accepts a resume payload", () => {
    const parsed = DesignStartClientSchema.safeParse({
      design_session_id: "ds_x",
      requirement_confirmation: requirementConfirmation(),
    });
    expect(parsed.success).toBe(true);
  });
});

describe("server-side branch validation", () => {
  it("rejects session creation missing required fields with a clear EXPAND", async () => {
    const root = await mkdtemp(join(tmpdir(), "prax-schema-"));
    cleanup.push(root);
    const projectRoot = join(root, "project");
    await mkdir(projectRoot);
    const store = new FileSessionStore({ stateRoot: join(root, "state"), idGenerator: () => "ds_s1" });
    const service = await PraxService.create({ sessions: store });
    const result = await service.designStart({ requirement: "缺 project_root 和 mode" } as never);
    expect(result.status).toBe("EXPAND");
    expect(JSON.stringify(result.issues)).toMatch(/project_root/);
    expect(JSON.stringify(result.issues)).toMatch(/mode/);
  });

  it("rejects resume without requirement_confirmation with RETRY", async () => {
    const root = await mkdtemp(join(tmpdir(), "prax-schema-"));
    cleanup.push(root);
    const projectRoot = join(root, "project");
    await mkdir(projectRoot);
    const store = new FileSessionStore({ stateRoot: join(root, "state"), idGenerator: () => "ds_s2" });
    const service = await PraxService.create({ sessions: store });
    const created = await service.designStart({
      requirement: "需求",
      project_root: projectRoot,
      mode: "greenfield",
    } as never);
    const sessionId = created.design_session_id as string;
    const resumed = await service.designStart({ design_session_id: sessionId } as never);
    expect(resumed.status).toBe("RETRY");
    expect(JSON.stringify(resumed.issues)).toMatch(/requirement_confirmation/);
  });
});

describe("client-facing design_realize schema (flat, no anyOf)", () => {
  it("serializes to a single flat object schema", () => {
    const json = toJSONSchema(DesignRealizeInputSchema, { target: "draft-2020-12", io: "input" });
    expect(json.type).toBe("object");
    expect((json as { anyOf?: unknown }).anyOf).toBeUndefined();
    expect((json as { additionalProperties?: unknown }).additionalProperties).toBeUndefined();
  });

  it("accepts propose and review payloads without nested unions", () => {
    const propose = DesignRealizeInputSchema.safeParse({
      design_session_id: "ds_x",
      mode: "propose",
      realization_mode: "figma_first",
      provider: "figma",
      conditions: [{ id: "greenfield", holds: true, basis: "greenfield session" }],
    });
    expect(propose.success).toBe(true);
    const review = DesignRealizeInputSchema.safeParse({
      design_session_id: "ds_x",
      mode: "submit_review",
      status: "approved",
      provider_refs_verified: { file_key: "fk", frame_node_ids: ["n1"] },
      evidence: [
        { type: "screenshot", ref: "rep-evidence/round-1/hero.png" },
        { type: "human_decision", actor_ref: "user:x", source_type: "conversation", source_ref: "m1", quote: "approved" },
      ],
    });
    expect(review.success).toBe(true);
  });
});
