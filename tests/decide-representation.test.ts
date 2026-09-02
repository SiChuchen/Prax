import { describe, expect, it } from "vitest";
import { SHELL_TERMS, validateDesignDecisions } from "prax-runtime";
import { architectureContext, architectureDecisions, architectureProductFrame } from "./fixtures.js";

const CONTEXT = {
  sessionId: "ds_decide_02",
  routedPatternIds: new Set(["PAT-CANVAS-WORKSPACE"]),
  inspectedAtLeastL1: new Set(["PAT-CANVAS-WORKSPACE"]),
  plausibleAlternativeCount: 2,
  frame: architectureProductFrame(),
  context: architectureContext(),
};

function decisions02(overrides: Record<string, unknown> = {}) {
  const base = architectureDecisions("ds_decide_02") as Record<string, unknown>;
  return {
    ...base,
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
    ...overrides,
  };
}

describe("decide representation portfolio rules (Task G2, spec §6.3)", () => {
  it("SHELL_TERMS is versioned alongside SDIR_VOCAB with the CJK synonyms", () => {
    expect(SHELL_TERMS.terms).toEqual(["dashboard", "cards", "tabs", "modal"]);
    expect(SHELL_TERMS.synonyms).toEqual(["仪表盘", "卡片", "标签页", "模态"]);
  });

  it("EXPANDs with DECISION_SHAPE_MISSING when a 0.2 decision lacks the blocks", () => {
    const missing = decisions02();
    delete (missing as { information_shape?: unknown }).information_shape;
    const result = validateDesignDecisions(missing, CONTEXT);
    expect(result.status).toBe("EXPAND");
    expect(result.codes).toContain("DECISION_SHAPE_MISSING");

    const noRepresentation = decisions02();
    delete (noRepresentation as { representation?: unknown }).representation;
    expect(validateDesignDecisions(noRepresentation, CONTEXT).codes).toContain("DECISION_SHAPE_MISSING");
  });

  it("keeps 0.1 decisions unchanged", () => {
    const legacy = architectureDecisions("ds_decide_02");
    const result = validateDesignDecisions(legacy, CONTEXT);
    expect(result.status).toBe("PASS");
    expect(result.codes ?? []).not.toContain("DECISION_SHAPE_MISSING");
  });

  it("REVIEWs with DECISION_DEFAULT_SHELL_UNJUSTIFIED when primary.type is cards", () => {
    const result = validateDesignDecisions(
      decisions02({
        representation: {
          primary: { type: "cards", reason: "a neutral reason with no shell word" },
          supporting: [],
          rejected: [{ option: "table", reason: "x" }],
        },
      }),
      CONTEXT,
    );
    expect(result.status).toBe("REVIEW");
    expect(result.codes).toContain("DECISION_DEFAULT_SHELL_UNJUSTIFIED");
  });

  it("word-boundary text matching triggers for English terms but not inside longer words", () => {
    const triggered = validateDesignDecisions(
      decisions02({
        representation: {
          primary: { type: "canvas", reason: "fallback to a dashboard layout for this data" },
          supporting: [],
          rejected: [{ option: "table", reason: "x" }],
        },
      }),
      CONTEXT,
    );
    expect(triggered.codes).toContain("DECISION_DEFAULT_SHELL_UNJUSTIFIED");

    const embedded = validateDesignDecisions(
      decisions02({
        representation: {
          primary: { type: "canvas", reason: "dashboarding tools were rejected upstream" },
          supporting: [],
          rejected: [{ option: "table", reason: "x" }],
        },
      }),
      CONTEXT,
    );
    expect(embedded.codes ?? []).not.toContain("DECISION_DEFAULT_SHELL_UNJUSTIFIED");
  });

  it("CJK synonyms in major_choices free text trigger the justification rule", () => {
    const base = decisions02() as { major_choices: unknown[] };
    base.major_choices = [
      { id: "mc_layout", choice: "沿用仪表盘结构", rationale: "历史习惯", confidence: "medium" },
    ];
    const result = validateDesignDecisions(base, CONTEXT);
    expect(result.status).toBe("REVIEW");
    expect(result.codes).toContain("DECISION_DEFAULT_SHELL_UNJUSTIFIED");
  });

  it("justification_vs_shape referencing an information_shape variable passes", () => {
    const justified = decisions02({
      representation: {
        primary: { type: "cards", reason: "cards chosen deliberately" },
        supporting: [],
        rejected: [{ option: "table", reason: "x" }],
        justification_vs_shape:
          "cardinality is few and relationality is low, so cards are the honest minimum",
      },
    }) as { representation: Record<string, unknown> };
    const result = validateDesignDecisions(justified, CONTEXT);
    expect(result.codes ?? []).not.toContain("DECISION_DEFAULT_SHELL_UNJUSTIFIED");

    const unjustified = decisions02({
      representation: {
        primary: { type: "cards", reason: "cards chosen deliberately" },
        supporting: [],
        rejected: [{ option: "table", reason: "x" }],
        justification_vs_shape: "it looks cleaner",
      },
    });
    expect(validateDesignDecisions(unjustified, CONTEXT).codes).toContain("DECISION_DEFAULT_SHELL_UNJUSTIFIED");
  });

  it("empty representation.rejected warns with DECISION_NO_REJECTED_REPRESENTATION", () => {
    const result = validateDesignDecisions(
      decisions02({
        representation: {
          primary: { type: "canvas", reason: "关系密度高" },
          supporting: [],
          rejected: [],
        },
      }),
      CONTEXT,
    );
    expect(result.status).toBe("WARN");
    expect(result.warnings.some((warning) => warning.includes("DECISION_NO_REJECTED_REPRESENTATION"))).toBe(true);
  });
});
