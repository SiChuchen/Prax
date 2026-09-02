import { describe, expect, it } from "vitest";
import { SdirEngine, SdirV02Schema, renderLeakIssues } from "prax-sdir";
import { architectureContext, architectureDecisions, architectureProductFrame } from "./fixtures.js";

function frame02() {
  const frame = architectureProductFrame();
  return {
    ...frame,
    version: "0.2" as const,
    jtbd: { verb: "understand" as const, target: "模块间依赖", success: "三分钟内定位共享影响" },
    primary_object: { type: "canvas_object" as const, label: "架构节点" },
    task_model: { frequency: "medium" as const, reversibility: "reversible" as const, consequence: "low" as const, expertise: "mixed" as const },
  };
}

function decisions02() {
  const decisions = architectureDecisions("ds_s2");
  return {
    ...decisions,
    version: "0.2" as const,
    information_shape: {
      cardinality: "many" as const,
      relationality: "high" as const,
      hierarchy: "medium" as const,
      temporality: "low" as const,
      density: "medium" as const,
    },
    representation: {
      primary: { type: "canvas" as const, reason: "关系密度高，空间位置承载语义" },
      supporting: [],
      rejected: [{ option: "table", reason: "并排比较困难" }],
    },
  };
}

describe("SDIR 0.2 generation + render-leak coverage (Task S2, spec §6.1)", () => {
  it("rejects render vocabulary inside the new 0.2 fields", () => {
    const flexbox = {
      version: "0.2",
      screen: { representation: { primary: { type: "canvas", reason: "use flexbox gap 12px" } } },
    };
    expect(renderLeakIssues(flexbox).length).toBeGreaterThan(0);

    const rounded = {
      version: "0.2",
      screen: { acceptance: ["button uses rounded corners"] },
    };
    expect(renderLeakIssues(rounded).length).toBeGreaterThan(0);
  });

  it("generate mode emits version 0.2 with defaults filled when 0.2 inputs are present", () => {
    const engine = new SdirEngine();
    const generated = engine.generate(frame02(), architectureContext(), decisions02() as never) as { version?: string };
    expect(generated.version).toBe("0.2");
    const parsed = SdirV02Schema.parse(generated);
    // defaults are materialized, not left implicit
    expect(parsed.screen.interaction).toEqual({ preview: "none", inspect: "select", navigate: "none", locate: "none" });
    // the 0.2 blocks flow from the gated upstream artifacts, not invented here
    expect(parsed.screen.user_job.verb).toBe("understand");
    expect(parsed.screen.representation.primary.type).toBe("canvas");
    expect(parsed.screen.information_shape.cardinality).toBe("many");
    expect(parsed.screen.state_ownership.length).toBeGreaterThanOrEqual(1);
    expect(parsed.screen.acceptance.length).toBeGreaterThanOrEqual(1);
    // render-leak lint stays clean on the generated document
    expect(renderLeakIssues(generated)).toEqual([]);
  });

  it("generate mode keeps emitting 0.1 for 0.1 inputs (compatibility)", () => {
    const engine = new SdirEngine();
    const generated = engine.generate(architectureProductFrame(), architectureContext(), architectureDecisions("ds_s2_legacy"));
    expect(generated.version).toBe("0.1");
  });
});
