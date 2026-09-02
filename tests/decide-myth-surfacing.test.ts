import { describe, expect, it } from "vitest";
import { SHELL_MYTH_MAP, validateDesignDecisions } from "prax-runtime";
import { loadBuiltInKnowledgeStore } from "prax-knowledge";
import { DesignRouter } from "prax-router";
import { architectureContext, architectureDecisions, architectureProductFrame } from "./fixtures.js";

const CONTEXT = {
  sessionId: "ds_myth",
  routedPatternIds: new Set(["PAT-CANVAS-WORKSPACE"]),
  inspectedAtLeastL1: new Set(["PAT-CANVAS-WORKSPACE"]),
  plausibleAlternativeCount: 2,
  frame: architectureProductFrame(),
  context: architectureContext(),
};

const MYTH_IDS = [
  "myth-left-nav-best",
  "myth-dark-more-professional",
  "myth-max-n-actions",
  "myth-fixed-panels-best",
  "myth-canvas-needs-minimap",
  "myth-more-disclosure-better",
  "myth-whitespace-more-premium",
  "myth-all-temporal-timeline",
  "myth-all-relational-graph",
  "myth-dashboard-default-home",
  "myth-card-grid-default",
];

function decisions02With(representation: Record<string, unknown>) {
  const base = architectureDecisions("ds_myth") as Record<string, unknown>;
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
    representation,
  };
}

describe("negative-knowledge myth seeds (Task K3, spec §7.3)", () => {
  it("SHELL_MYTH_MAP is pinned exactly", () => {
    expect(SHELL_MYTH_MAP).toEqual({
      dashboard: "myth-dashboard-default-home",
      cards: "myth-card-grid-default",
      tabs: "myth-more-disclosure-better",
      modal: "myth-more-disclosure-better",
    });
  });

  it("all eleven myth entries load with refutations and valid correct_refs", async () => {
    const store = await loadBuiltInKnowledgeStore();
    for (const id of MYTH_IDS) {
      const entry = store.get(id);
      expect(entry, id).toBeDefined();
      expect(entry!.asset_class).toBe("myth");
      expect(entry!.refutation).toMatch(/研究|样本|§/);
      expect(store.get(entry!.correct_ref!)).toBeDefined();
    }
  });

  it("myths never appear in default routing", async () => {
    const store = await loadBuiltInKnowledgeStore();
    const router = new DesignRouter(store);
    const result = router.route(architectureProductFrame(), CONTEXT.context, "画布导航面板选择");
    const routedIds = [
      ...(result.principles ?? []),
      ...(result.heuristics ?? []),
      ...(result.patterns ?? []),
      ...(result.platform_profile ?? []),
    ].map((entry) => entry.id);
    for (const id of MYTH_IDS) {
      expect(routedIds).not.toContain(id);
    }
  });

  it("decide surfaces the matching myth id in the unjustified-shell REVIEW", () => {
    const cards = validateDesignDecisions(
      decisions02With({
        primary: { type: "cards", reason: "cards as the default representation" },
        supporting: [],
        rejected: [{ option: "table", reason: "x" }],
      }),
      CONTEXT,
    );
    expect(cards.status).toBe("REVIEW");
    expect(cards.issues.join(" ")).toContain("myth-card-grid-default");

    const dashboardText = validateDesignDecisions(
      decisions02With({
        primary: { type: "canvas", reason: "fallback to a dashboard home for admins" },
        supporting: [],
        rejected: [{ option: "table", reason: "x" }],
      }),
      CONTEXT,
    );
    expect(dashboardText.issues.join(" ")).toContain("myth-dashboard-default-home");

    const tabs = validateDesignDecisions(
      decisions02With({
        primary: { type: "canvas", reason: "with tabs for section switching" },
        supporting: [],
        rejected: [{ option: "table", reason: "x" }],
      }),
      CONTEXT,
    );
    expect(tabs.issues.join(" ")).toContain("myth-more-disclosure-better");
  });
});
