import { describe, expect, it } from "vitest";
import { loadBuiltInKnowledgeStore } from "prax-knowledge";
import { DesignRouter } from "prax-router";
import type { CanonicalClassification, DesignContext } from "prax-runtime";
import { architectureProductFrame, settingsContext } from "./fixtures.js";

// PRAX-WIZARD-001 finding: an unrecognized domain vocabulary (canonical
// domain_id=unknown) made hardScopeMismatch exclude the fitting pattern —
// and the disclosure gate then refused its inspection. Task-type scope is
// usually still classified correctly, so the domain check must degrade to a
// flagged soft match instead of a hard exclusion, while KNOWN domain
// mismatches stay true scope boundaries.

const VOCAB_FLAG = "domain_vocabulary_mismatch:canonical_domain_unknown";

function classified(domainId: string): DesignContext {
  const classification: CanonicalClassification = {
    version: "1",
    task_type: "configure_preferences",
    domain_id: domainId,
    interaction_mode: "sections_with_navigation",
    product_type: "configuration_surface",
    primary_object_type: "replicate_config",
    secondary_object_types: [],
    confidence: domainId === "unknown" ? "medium" : "high",
    evidence: [`task_type/domain fixtures for ${domainId}`],
    open_questions: [],
  };
  return { ...settingsContext(), classification };
}

async function routed(domainId: string) {
  const store = await loadBuiltInKnowledgeStore();
  const router = new DesignRouter(store);
  return router.route(architectureProductFrame(), classified(domainId), "三步配置向导应采用哪个主结构模式");
}

describe("routing domain vocabulary tolerance", () => {
  it("keeps the fitting pattern when the canonical domain is unknown (wizard first-session trap)", async () => {
    const result = await routed("unknown");
    const settings = result.patterns.find((candidate) => candidate.id === "PAT-SETTINGS-SECTIONS");
    expect(settings).toBeDefined();
    expect(settings?.routing.scope_match).toContain(VOCAB_FLAG);
    expect(result.excluded.some((entry) => entry.id === "PAT-SETTINGS-SECTIONS")).toBe(false);
    // task-type scope still classifies correctly and stays a hard boundary
    expect(result.excluded.some((entry) => entry.id === "PAT-DATA-EXPLORER" && entry.reason.includes("task scope"))).toBe(true);
  });

  it("routes normally without the flag when the domain canonicalizes", async () => {
    const result = await routed("preferences");
    const settings = result.patterns.find((candidate) => candidate.id === "PAT-SETTINGS-SECTIONS");
    expect(settings).toBeDefined();
    expect(settings?.routing.scope_match).not.toContain(VOCAB_FLAG);
    expect(settings?.routing.scope_match).toContain("domain_id:preferences");
  });

  it("still hard-excludes on a known domain mismatch (true scope boundary)", async () => {
    const result = await routed("data_exploration");
    expect(result.excluded.some((entry) => entry.id === "PAT-SETTINGS-SECTIONS" && entry.reason.includes("domain scope"))).toBe(true);
    expect(result.patterns.some((candidate) => candidate.id === "PAT-SETTINGS-SECTIONS")).toBe(false);
  });
});
