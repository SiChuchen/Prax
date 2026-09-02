import type { KnowledgeEntry, KnowledgeStore, KnowledgeType, TriggerConditions } from "prax-knowledge";
import type { CanonicalClassification, DesignContext, ProductFrame } from "prax-runtime";
import type {
  CandidateAudit,
  ExcludedCandidate,
  RoutedCandidate,
  RoutingResult,
} from "./contracts.js";

interface ScoredEntry {
  entry: KnowledgeEntry;
  score: number;
  audit: CandidateAudit;
}

interface CanonicalRouting {
  classification: CanonicalClassification;
  taskTokens: readonly string[];
  domainTokens: readonly string[];
}

const TASK_SCOPE_TOKENS: Record<string, readonly string[]> = {
  inspect_relationships: ["inspect", "trace", "explore"],
  trace_flow: ["trace", "explore"],
  compare_filter_records: ["compare", "filter", "inspect"],
  browse_collection: ["browse", "inspect"],
  manage_lifecycle: ["manage", "administer"],
  configure_preferences: ["configure"],
};

const DOMAIN_SCOPE_TOKENS: Record<string, readonly string[]> = {
  software_architecture: ["architecture"],
  data_exploration: ["data", "logs"],
  observability_analytics: ["data", "logs"],
  preferences: ["settings"],
};

const TYPE_CAPS: Partial<Record<KnowledgeType, number>> = {
  principle: 5,
  heuristic: 5,
  pattern: 3,
  platform_convention: 1,
};

function normalized(value: string): string {
  return value.toLowerCase().replaceAll(/[^a-z0-9]+/g, "_");
}

function contextTokens(frame: ProductFrame, context: DesignContext, question: string): string {
  return normalized(
    [
      question,
      frame.user.primary_role,
      frame.goal.primary,
      frame.tasks.primary,
      ...frame.tasks.secondary,
      ...frame.product_objects.flatMap((object) => [object.id, object.user_name, object.purpose]),
      frame.mental_model_hypothesis.summary,
      context.task.primary,
      ...context.task.modes,
      context.domain.type,
      ...context.domain.entities,
      ...context.priorities,
      context.density_intent,
      context.platform.family,
      context.platform.form_factor,
      ...context.platform.input,
    ].join(" "),
  );
}

function anyMatch(values: readonly string[], haystack: string): string | undefined {
  return values.find((value) => haystack.includes(normalized(value)));
}

function canonicalRouting(context: DesignContext): CanonicalRouting | undefined {
  const classification = context.classification;
  if (classification === undefined) return undefined;
  return {
    classification,
    taskTokens: TASK_SCOPE_TOKENS[classification.task_type] ?? [],
    domainTokens: DOMAIN_SCOPE_TOKENS[classification.domain_id] ?? [],
  };
}

function hardScopeMismatch(
  entry: KnowledgeEntry,
  context: DesignContext,
  haystack: string,
  canonical: CanonicalRouting | undefined,
): string | undefined {
  const scope = entry.scope;
  const platform = `${context.platform.family}_${context.platform.form_factor}`;
  if (scope.platform.length > 0 && !scope.platform.some((value) => normalized(value) === platform)) {
    return `platform scope ${scope.platform.join(", ")} does not include ${platform}`;
  }
  if (scope.domain.length > 0) {
    if (canonical === undefined) {
      if (anyMatch(scope.domain, haystack) === undefined) {
        return `domain scope ${scope.domain.join(", ")} does not match ${context.domain.type}`;
      }
    } else {
      const matches = scope.domain.some((value) => canonical.domainTokens.includes(normalized(value)));
      if (!matches) {
        // A canonicalized domain that misses this scope is a true boundary.
        // An UNCANONICALIZED domain (the classifier failed to place it) is a
        // vocabulary gap, not a boundary — excluding here is what trapped the
        // PRAX-WIZARD-001 first session (fitting pattern excluded AND made
        // uninspectable). Task-type scope still classifies and stays hard.
        if (canonical.classification.domain_id !== "unknown") {
          return `domain scope ${scope.domain.join(", ")} does not match canonical domain_id ${canonical.classification.domain_id}`;
        }
      }
    }
  }
  if (scope.task_type.length > 0) {
    const matches =
      canonical !== undefined
        ? scope.task_type.some((value) => canonical.taskTokens.includes(normalized(value)))
        : anyMatch(scope.task_type, haystack) !== undefined;
    if (!matches) {
      return canonical !== undefined
        ? `task scope ${scope.task_type.join(", ")} does not match canonical task_type ${canonical.classification.task_type}`
        : `task scope ${scope.task_type.join(", ")} does not match the framed task`;
    }
  }
  if (scope.density.length > 0 && !scope.density.includes(context.density_intent)) {
    return `density scope ${scope.density.join(", ")} does not include ${context.density_intent}`;
  }
  return undefined;
}

// route-time facet contexts (spec §7.2 trigger_conditions): the 0.2 frame
// supplies task/object; density maps through the pinned inverse; the router
// itself serves the decision phase. Representation is decided after routing,
// so that facet cannot match at route time.
const DENSITY_TO_FACET: Record<string, Facet<"density">> = {
  compact: "high",
  regular: "medium",
  spacious: "low",
};

type Facet<T extends keyof TriggerConditions> = TriggerConditions[T][number];

interface FacetContext {
  task_type?: Facet<"task_type"> | undefined;
  object_type?: Facet<"object_type"> | undefined;
  density?: Facet<"density"> | undefined;
  platform: Facet<"platform">;
  phase: Facet<"phase">;
}

function facetContext(frame: ProductFrame, context: DesignContext): FacetContext {
  const legacy = frame as { jtbd?: { verb?: Facet<"task_type"> }; primary_object?: { type?: Facet<"object_type"> } };
  return {
    ...(legacy.jtbd?.verb !== undefined ? { task_type: legacy.jtbd.verb } : {}),
    ...(legacy.primary_object?.type !== undefined ? { object_type: legacy.primary_object.type } : {}),
    ...(DENSITY_TO_FACET[context.density_intent] !== undefined
      ? { density: DENSITY_TO_FACET[context.density_intent]! }
      : {}),
    platform: `${context.platform.family}_${context.platform.form_factor}` as Facet<"platform">,
    phase: "decision",
  };
}

function triggerConditionBonus(
  entry: KnowledgeEntry,
  facets: FacetContext,
  scopeMatch: string[],
): number {
  const conditions = entry.trigger_conditions;
  if (conditions === undefined) return 0;
  let bonus = 0;
  if (facets.task_type !== undefined && conditions.task_type.includes(facets.task_type)) {
    bonus += 2;
    scopeMatch.push(`trigger_condition:task_type`);
  }
  if (facets.object_type !== undefined && conditions.object_type.includes(facets.object_type)) {
    bonus += 2;
    scopeMatch.push(`trigger_condition:object_type`);
  }
  if (facets.density !== undefined && conditions.density.includes(facets.density)) {
    bonus += 2;
    scopeMatch.push(`trigger_condition:density`);
  }
  if (conditions.platform.includes(facets.platform)) {
    bonus += 2;
    scopeMatch.push(`trigger_condition:platform`);
  }
  if (conditions.phase.includes(facets.phase)) {
    bonus += 2;
    scopeMatch.push(`trigger_condition:phase`);
  }
  return bonus;
}

function scoreEntry(
  entry: KnowledgeEntry,
  context: DesignContext,
  haystack: string,
  canonical: CanonicalRouting | undefined,
  facets: FacetContext,
): ScoredEntry {
  const trigger = anyMatch(entry.triggers, haystack);
  const scopeMatch: string[] = [];
  let score = 0;

  if (canonical === undefined) {
    if (trigger !== undefined) score += 8;
    if (entry.scope.domain.length > 0 && anyMatch(entry.scope.domain, haystack) !== undefined) {
      score += 6;
      scopeMatch.push(`domain:${context.domain.type}`);
    }
    if (entry.scope.task_type.length > 0 && anyMatch(entry.scope.task_type, haystack) !== undefined) {
      score += 5;
      scopeMatch.push(`task:${context.task.primary}`);
    }
  } else {
    if (trigger !== undefined) score += 4;
    if (
      entry.scope.domain.length > 0 &&
      canonical.domainTokens.length > 0 &&
      entry.scope.domain.some((value) => canonical.domainTokens.includes(normalized(value)))
    ) {
      score += 6;
      scopeMatch.push(`domain_id:${canonical.classification.domain_id}`);
    }
    if (
      entry.scope.domain.length > 0 &&
      canonical.classification.domain_id === "unknown"
    ) {
      scopeMatch.push("domain_vocabulary_mismatch:canonical_domain_unknown");
    }
    if (
      entry.scope.task_type.length > 0 &&
      entry.scope.task_type.some((value) => canonical.taskTokens.includes(normalized(value)))
    ) {
      score += 5;
      scopeMatch.push(`task_type:${canonical.classification.task_type}`);
    }
  }
  if (entry.scope.platform.includes("web_desktop")) {
    score += 3;
    scopeMatch.push("platform:web_desktop");
  }
  if (entry.scope.density.includes(context.density_intent)) {
    score += 2;
    scopeMatch.push(`density:${context.density_intent}`);
  }
  score += entry.lifecycle.status === "stable" ? 3 : entry.lifecycle.status === "reviewed" ? 2 : 0;
  // lex specialis (D7 via spec §7.2): every matching trigger facet adds
  // weight on top of scope + lifecycle; more specific entries outrank
  score += triggerConditionBonus(entry, facets, scopeMatch);
  if (entry.type === "platform_convention") score += 4;
  if (entry.scope.domain.length === 0 && entry.scope.task_type.length === 0) score += 1;

  const confidence = score >= 14 ? "high" : score >= 8 ? "medium" : "low";
  return {
    entry,
    score,
    audit: {
      selected_because:
        canonical !== undefined
          ? `canonical task_type=${canonical.classification.task_type} and domain_id=${canonical.classification.domain_id} match this entry's scope${
              trigger === undefined ? "" : `; natural-language trigger '${trigger}' supports it`
            }`
          : trigger === undefined
            ? "generic scoped guidance ranked for the current decision"
            : `trigger '${trigger}' matched the framed product question`,
      trigger: trigger ?? "scope_and_lifecycle",
      scope_match: scopeMatch.length === 0 ? ["generic"] : scopeMatch,
      confidence,
    },
  };
}

export class DesignRouter {
  public constructor(private readonly store: KnowledgeStore) {}

  public route(frame: ProductFrame, context: DesignContext, question: string): RoutingResult {
    const haystack = contextTokens(frame, context, question);
    const canonical = canonicalRouting(context);
    const facets = facetContext(frame, context);
    const scored: ScoredEntry[] = [];
    const excluded: ExcludedCandidate[] = [];

    for (const entry of this.store.entries()) {
      // myth quarantine lives at the asset_class layer now (spec §7.2); myth
      // entries surface only at decide-time default-shell checks and explicit
      // inspection — never in default routing
      if (entry.asset_class === "myth" || entry.type === "product_evidence") continue;
      if (entry.lifecycle.status === "deprecated") {
        excluded.push({ id: entry.id, reason: "deprecated knowledge is not preferred" });
        continue;
      }
      const mismatch = hardScopeMismatch(entry, context, haystack, canonical);
      if (mismatch !== undefined) {
        if (entry.type === "pattern") excluded.push({ id: entry.id, reason: mismatch });
        continue;
      }
      const candidate = scoreEntry(entry, context, haystack, canonical, facets);
      if (candidate.score < 4) continue;
      scored.push(candidate);
    }

    const select = (type: KnowledgeType): RoutedCandidate[] => {
      const cap = TYPE_CAPS[type] ?? 0;
      return scored
        .filter((candidate) => candidate.entry.type === type)
        .sort((left, right) => right.score - left.score || left.entry.id.localeCompare(right.entry.id))
        .slice(0, cap)
        .map(({ entry, audit }) => ({ ...this.store.index(entry), routing: audit }));
    };

    const principles = select("principle");
    const heuristics = select("heuristic");
    const patterns = select("pattern");
    const platformProfile = select("platform_convention");
    const bestPattern = patterns[0];
    const lowConfidenceClassification =
      canonical !== undefined && canonical.classification.confidence === "low";
    const confidence =
      lowConfidenceClassification || bestPattern === undefined
        ? "low"
        : bestPattern.routing.confidence === "high"
          ? "high"
          : "medium";

    return {
      status: confidence === "low" ? "EXPAND" : "PASS",
      candidate_domains: [...new Set([...patterns, ...principles, ...heuristics].map((item) => item.scope.domain).flat())],
      principles,
      heuristics,
      patterns,
      platform_profile: platformProfile,
      excluded: excluded.slice(0, 8),
      confidence,
    };
  }
}
