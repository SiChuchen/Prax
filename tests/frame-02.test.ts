import { describe, expect, it } from "vitest";
import { ProductFrameSchema, validateProductFrame } from "prax-runtime";
import { architectureProductFrame } from "./fixtures.js";

function frame02(overrides: Record<string, unknown> = {}) {
  const base = architectureProductFrame() as Record<string, unknown>;
  return {
    ...base,
    version: "0.2",
    jtbd: { verb: "understand", target: "模块间依赖", success: "三分钟内定位共享影响" },
    primary_object: { type: "canvas_object", label: "架构节点" },
    task_model: { frequency: "medium", reversibility: "reversible", consequence: "low", expertise: "mixed" },
    ...overrides,
  };
}

describe("product frame 0.2 (Task G1, spec §6.2)", () => {
  it("parses a 0.2 frame carrying the three product-model blocks", () => {
    const parsed = ProductFrameSchema.parse(frame02());
    expect(parsed.version).toBe("0.2");
    expect(parsed.jtbd?.verb).toBe("understand");
    expect(parsed.primary_object?.type).toBe("canvas_object");
    expect(parsed.task_model?.frequency).toBe("medium");
  });

  it("keeps 0.1 frames unchanged and block-free", () => {
    const legacy = architectureProductFrame();
    const parsed = ProductFrameSchema.parse(legacy);
    expect(parsed.version).toBeUndefined();
    expect(parsed.jtbd).toBeUndefined();
    expect(validateProductFrame(legacy, "greenfield").status).toBe("PASS");
  });

  it("enforces the vocabulary enums on jtbd.verb and primary_object.type", () => {
    expect(ProductFrameSchema.safeParse(frame02({ jtbd: { verb: "vibe", target: "t", success: "s" } })).success).toBe(false);
    expect(ProductFrameSchema.safeParse(frame02({ primary_object: { type: "spreadsheet" } })).success).toBe(false);
    expect(
      ProductFrameSchema.safeParse(frame02({ task_model: { frequency: "hourly", reversibility: "reversible", consequence: "low", expertise: "mixed" } })).success,
    ).toBe(false);
  });

  it("EXPANDs with FRAME_PRODUCT_MODEL_INCOMPLETE when a 0.2 frame is missing a block", () => {
    const missingJtbd = frame02();
    delete (missingJtbd as { jtbd?: unknown }).jtbd;
    const result = validateProductFrame(missingJtbd, "greenfield");
    expect(result.status).toBe("EXPAND");
    expect(result.codes).toContain("FRAME_PRODUCT_MODEL_INCOMPLETE");
    expect(result.issues.some((issue) => issue.includes("jtbd"))).toBe(true);

    const missingTaskModel = frame02();
    delete (missingTaskModel as { task_model?: unknown }).task_model;
    const result2 = validateProductFrame(missingTaskModel, "greenfield");
    expect(result2.codes).toContain("FRAME_PRODUCT_MODEL_INCOMPLETE");
  });

  it("rejects 0.2 blocks without the explicit version declaration", () => {
    const undeclared = frame02();
    delete (undeclared as { version?: unknown }).version;
    expect(ProductFrameSchema.safeParse(undeclared).success).toBe(false);
  });
});
