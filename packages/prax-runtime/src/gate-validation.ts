import {
  CapabilityMapSchema,
  DesignContextSchema,
  DesignDecisionsSchema,
  ExistingUnderstandingSchema,
  IntentLiteSchema,
  ProductFrameSchema,
  ProductObjectOverrideSchema,
  RequirementConfirmationSchema,
  type ArtifactValidation,
  type CapabilityMap,
  type ChangeKind,
  type DesignContext,
  type DesignDecisions,
  type DesignMode,
  type ExistingUnderstanding,
  type IntentLite,
  type ProductFrame,
  type RequirementConfirmation,
  zodIssues,
} from "./contracts.js";
import { classifyDesignContext } from "./classification.js";

export function validateRequirementConfirmation(input: unknown): ArtifactValidation<RequirementConfirmation> {
  const parsed = RequirementConfirmationSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "RETRY", issues: zodIssues(parsed.error), warnings: [] };
  }
  const issues: string[] = [];
  const warnings: string[] = [];
  if (parsed.data.boundaries.out_of_scope.length === 0) {
    issues.push(
      "boundaries.out_of_scope must declare at least one excluded concern; scope drift is the most common restatement failure.",
    );
  }
  const highImpact = parsed.data.open_questions.filter((question) => typeof question !== "string" && question.impact === "high");
  if (highImpact.length > 0) {
    issues.push(
      `High-impact open questions must be resolved or explicitly accepted before design starts: ${highImpact
        .map((question) => (typeof question === "string" ? question : question.id))
        .join(", ")}.`,
    );
  }
  if (parsed.data.open_questions.length > 0) {
    warnings.push(`${parsed.data.open_questions.length} requirement question(s) remain recorded.`);
  }
  return {
    status: issues.length === 0 ? (warnings.length === 0 ? "PASS" : "WARN") : "EXPAND",
    issues,
    warnings,
    value: parsed.data,
  };
}

const BACKEND_SHAPED_TERMS = [
  /(^|_)(api|db|table|service|repository|endpoint)($|_)/i,
  /(_config|_model|_entity|_record|_dto)$/i,
  /^(provider_model|route_config|proxy_config|credential)$/i,
];

function productObjectLooksBackendShaped(object: {
  id: string;
  user_name: string;
}): boolean {
  const systemName = object.id.trim();
  const userName = object.user_name.trim();
  const nameWasNotTranslated =
    systemName.toLowerCase() === userName.toLowerCase() ||
    userName.includes("_");
  return (
    nameWasNotTranslated &&
    BACKEND_SHAPED_TERMS.some((pattern) => pattern.test(systemName))
  );
}

function productObjectJustified(object: { justified_override?: unknown }): boolean {
  return (
    object.justified_override !== undefined &&
    ProductObjectOverrideSchema.safeParse(object.justified_override).success
  );
}

export function validateProductFrame(
  input: unknown,
  mode: DesignMode,
  hasUnderstanding = false,
): ArtifactValidation<ProductFrame> {
  const parsed = ProductFrameSchema.safeParse(input);
  if (!parsed.success) {
    return {
      status: "EXPAND",
      issues: zodIssues(parsed.error),
      warnings: [],
    };
  }

  const issues: string[] = [];
  const warnings: string[] = [];

  if (mode === "existing_product" && !hasUnderstanding && parsed.data.existing_product === undefined) {
    issues.push(
      "existing_product mode requires stable concepts, patterns, pain points, constraints and legacy debt (or a prior existing-understanding gate).",
    );
  }

  if (
    parsed.data.mental_model_hypothesis.confidence === "low" &&
    parsed.data.mental_model_hypothesis.evidence.length === 0 &&
    parsed.data.open_questions.length === 0
  ) {
    issues.push(
      "A low-confidence mental model requires evidence or an explicit open question before architecture can be derived.",
    );
  }

  const backendShaped = parsed.data.product_objects.filter(productObjectLooksBackendShaped);
  const unjustified = backendShaped.filter((object) => !productObjectJustified(object));
  const justified = backendShaped.filter((object) => productObjectJustified(object));
  if (unjustified.length >= Math.min(2, parsed.data.product_objects.length)) {
    return {
      status: "REVIEW",
      issues: [
        `Product Objects appear to reproduce backend vocabulary without a justified override: ${unjustified.map((item) => item.id).join(", ")}.`,
        "Translate these into concepts users recognize, or record a structured justified_override (rationale, user_evidence, risks, accepted_by) showing the backend terms are established product concepts.",
      ],
      warnings,
      value: parsed.data,
    };
  }
  for (const object of justified) {
    const override = ProductObjectOverrideSchema.parse(object.justified_override);
    warnings.push(
      `${object.id} advances as a backend-shaped object under an override accepted by ${override.accepted_by}: ${override.rationale} (risks: ${override.risks.join("; ")})`,
    );
  }

  if (parsed.data.open_questions.length > 0) {
    warnings.push(
      `${parsed.data.open_questions.length} Product Frame question(s) remain recorded.`,
    );
  }

  return {
    status: issues.length === 0 ? (warnings.length === 0 ? "PASS" : "WARN") : "EXPAND",
    issues,
    warnings,
    value: parsed.data,
  };
}

export function validateDesignContext(
  input: unknown,
  frame: ProductFrame,
): ArtifactValidation<DesignContext> {
  const parsed = DesignContextSchema.safeParse(input);
  if (!parsed.success) {
    return {
      status: "EXPAND",
      issues: zodIssues(parsed.error),
      warnings: [],
    };
  }

  const highImpactUnknowns = parsed.data.unknowns.filter(
    (
      unknown,
    ): unknown is Extract<(typeof parsed.data.unknowns)[number], { impact: string }> =>
      typeof unknown !== "string" && unknown.impact === "high",
  );
  const issues = highImpactUnknowns.map(
    (unknown) =>
      `${unknown.id} is a high-impact unknown affecting ${unknown.affects.join(", ") || "an unspecified decision"}.`,
  );
  const warnings: string[] = [];

  if (parsed.data.confidence.overall === "low") {
    issues.push(
      "Overall context confidence is low; resolve the properties that can change pattern, density or risk decisions.",
    );
  } else if (parsed.data.confidence.overall === "medium") {
    warnings.push("Design Context is usable with medium confidence.");
  }

  const classification = classifyDesignContext(frame, parsed.data);
  if (classification.confidence === "low") {
    warnings.push(
      `Canonical classification is low-confidence (task_type=${classification.task_type}, domain_id=${classification.domain_id}); the router will stay conservative.`,
    );
  }

  return {
    status: issues.length === 0 ? (warnings.length === 0 ? "PASS" : "WARN") : "EXPAND",
    issues,
    warnings,
    value: { ...parsed.data, classification },
  };
}

export interface PatternSurfaces {
  dominant: string[];
  contextual: string[];
}

export interface DecisionValidationContext {
  sessionId: string;
  routedPatternIds: ReadonlySet<string>;
  inspectedAtLeastL1: ReadonlySet<string>;
  plausibleAlternativeCount: number;
  frame: ProductFrame;
  context: DesignContext;
  patternSurfaces?: PatternSurfaces | undefined;
}

interface DecisionIssue {
  code: string;
  message: string;
}

function normalizedToken(value: string): string {
  return value.trim().toLowerCase();
}

function decisionReferenceVocabulary(frame: ProductFrame, context: DesignContext): Set<string> {
  return new Set(
    [
      frame.user.primary_role,
      frame.goal.primary,
      frame.tasks.primary,
      ...frame.tasks.secondary,
      ...frame.product_objects.flatMap((object) => [object.id, object.user_name, object.purpose]),
      ...frame.mental_model_hypothesis.evidence,
      context.task.primary,
      ...context.task.modes,
      context.domain.type,
      ...context.domain.entities,
      ...context.priorities,
    ].map(normalizedToken),
  );
}

function hierarchyFindings(decisions: DesignDecisions, surfaces: PatternSurfaces): DecisionIssue[] {
  const dominant = surfaces.dominant.map(normalizedToken);
  const contextual = surfaces.contextual.map(normalizedToken);
  const findings: DecisionIssue[] = [];
  const primary = decisions.information_hierarchy.primary;
  if (!primary.some((surface) => dominant.includes(normalizedToken(surface)))) {
    findings.push({
      code: "HIERARCHY_DOMINANT_NOT_PRIMARY",
      message: `No dominant workspace surface (${surfaces.dominant.join(", ")}) appears in information_hierarchy.primary; the surface carrying the primary task must lead the hierarchy.`,
    });
  }
  for (const surface of primary) {
    if (contextual.includes(normalizedToken(surface))) {
      findings.push({
        code: "HIERARCHY_CONTEXTUAL_SURFACES_DOMINANT",
        message: `Contextual inspection surface '${surface}' is placed in information_hierarchy.primary; it must stay subordinate to the dominant workspace unless a justified override is recorded.`,
      });
    }
  }
  return findings;
}

function semanticFindings(
  decisions: DesignDecisions,
  context: DecisionValidationContext,
  vocabulary: Set<string>,
): { issues: DecisionIssue[]; acceptedOverride?: DesignDecisions["information_hierarchy"]["override"] } {
  const findings: DecisionIssue[] = [];
  let acceptedOverride: DesignDecisions["information_hierarchy"]["override"] | undefined;

  if (context.patternSurfaces !== undefined) {
    const hierarchy = hierarchyFindings(decisions, context.patternSurfaces);
    const override = decisions.information_hierarchy.override;
    if (hierarchy.length > 0 && override !== undefined) {
      const unknownRefs = override.evidence_refs.filter((ref) => !vocabulary.has(normalizedToken(ref)));
      if (unknownRefs.length === 0) {
        acceptedOverride = override;
      } else {
        findings.push({
          code: "DECISION_OVERRIDE_EVIDENCE_UNKNOWN",
          message: `information_hierarchy.override cites evidence (${unknownRefs.join(", ")}) that does not resolve to the Product Frame or Design Context; record real user evidence or an explicit open question.`,
        });
        findings.push(...hierarchy);
      }
    } else {
      findings.push(...hierarchy);
    }
  }

  for (const choice of decisions.major_choices) {
    if (choice.references.length === 0) {
      findings.push({
        code: "MAJOR_CHOICE_REFERENCE_MISSING",
        message: `major_choices '${choice.id}' does not reference any product object, task, or context concept; record structured references.`,
      });
      continue;
    }
    for (const reference of choice.references) {
      if (!vocabulary.has(normalizedToken(reference))) {
        findings.push({
          code: "MAJOR_CHOICE_REFERENCE_UNKNOWN",
          message: `major_choices '${choice.id}' references '${reference}', which is not a known product object, task, or context concept.`,
        });
      }
    }
  }

  return { issues: findings, acceptedOverride };
}

export function validateDesignDecisions(
  input: unknown,
  context: DecisionValidationContext,
): ArtifactValidation<DesignDecisions> {
  const parsed = DesignDecisionsSchema.safeParse(input);
  if (!parsed.success) {
    return {
      status: "RETRY",
      issues: zodIssues(parsed.error),
      warnings: [],
    };
  }

  const issues: string[] = [];
  const warnings: string[] = [];
  const codes: string[] = [];
  const chosen = parsed.data.primary_structure.pattern;

  if (parsed.data.session_id !== context.sessionId) {
    codes.push("DECISION_SESSION_MISMATCH");
    issues.push("design_decisions.session_id does not match design_session_id.");
  }
  if (!context.routedPatternIds.has(chosen)) {
    codes.push("DECISION_PATTERN_NOT_ROUTED");
    issues.push(`Chosen Pattern ${chosen} was not returned by the Design Router.`);
  }
  if (!context.inspectedAtLeastL1.has(chosen)) {
    codes.push("DECISION_PATTERN_NOT_INSPECTED");
    issues.push(`Chosen Pattern ${chosen} was not inspected to at least L1.`);
  }
  if (
    context.plausibleAlternativeCount > 1 &&
    parsed.data.rejected.length === 0
  ) {
    codes.push("DECISION_ALTERNATIVE_NOT_REJECTED");
    issues.push("At least one plausible alternative must be explicitly rejected.");
  }
  const highImpactUnknowns = parsed.data.unresolved.filter(
    (unknown) => typeof unknown !== "string" && unknown.impact === "high",
  );
  if (highImpactUnknowns.length > 0) {
    codes.push("DECISION_HIGH_IMPACT_UNRESOLVED");
    issues.push("High-impact design decisions remain unresolved.");
  }

  const vocabulary = decisionReferenceVocabulary(context.frame, context.context);
  const semantic = semanticFindings(parsed.data, context, vocabulary);
  if (semantic.acceptedOverride !== undefined) {
    const override = semantic.acceptedOverride;
    warnings.push(
      `information_hierarchy deviates from the pattern contract under an override accepted by ${override.accepted_by}: ${override.basis} (risks: ${override.risks.join("; ")})`,
    );
  }
  for (const finding of semantic.issues) {
    codes.push(finding.code);
    issues.push(finding.message);
  }

  if (parsed.data.primary_structure.confidence === "low") {
    warnings.push("The primary structure decision has low confidence.");
  }

  return {
    status: issues.length === 0 ? (warnings.length === 0 ? "PASS" : "WARN") : "EXPAND",
    issues,
    warnings,
    codes,
    value: parsed.data,
  };
}

export function validateCapabilityMap(
  input: unknown,
): ArtifactValidation<CapabilityMap> {
  const parsed = CapabilityMapSchema.safeParse(input);
  if (!parsed.success) {
    return {
      status: "RETRY",
      issues: zodIssues(parsed.error),
      warnings: [],
    };
  }

  const issues: string[] = [];
  const warnings: string[] = [];
  for (const need of parsed.data.needs) {
    if ((need.status === "gap" || need.status === "blocked") && need.resolution === undefined) {
      issues.push(
        `${need.id} is ${need.status} but has no explicit resolution type and notes.`,
      );
    }
    if (need.status === "blocked") {
      issues.push(`${need.id} remains blocked.`);
    }
    if (need.status === "gap" && need.resolution?.type === "explicit_compromise") {
      warnings.push(`${need.id} advances with an explicit UX compromise.`);
    }
  }

  const status = issues.some((issue) => issue.endsWith("remains blocked."))
    ? "BLOCK"
    : issues.length > 0
      ? "RETRY"
      : warnings.length > 0
        ? "WARN"
        : "PASS";

  return {
    status,
    issues,
    warnings,
    value: parsed.data,
  };
}

export function validateExistingUnderstanding(
  input: unknown,
  mode: DesignMode,
  changeKind?: ChangeKind,
): ArtifactValidation<ExistingUnderstanding> {
  const parsed = ExistingUnderstandingSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "RETRY", issues: zodIssues(parsed.error), warnings: [] };
  }
  const data = parsed.data;
  const issues: string[] = [];
  const codes: string[] = [];
  const warnings: string[] = [];

  if (data.design_authorities.length === 0) {
    warnings.push("No external design authorities declared; decisions will be checked only against the built-in pack.");
  }

  if (mode === "existing_product") {
    const surfaces = new Set(data.current_surfaces.map((surface) => surface.id));
    for (const target of data.change_targets) {
      if (!surfaces.has(target)) {
        codes.push("CHANGE_TARGET_NOT_DECLARED");
        issues.push(`change_target '${target}' does not map to any declared current_surfaces entry.`);
      }
    }
    if (data.current_objects.length === 0 || data.current_surfaces.length === 0) {
      codes.push("UNDERSTANDING_INCOMPLETE");
      issues.push("existing_product understanding requires current_objects and current_surfaces.");
    }
    if (changeKind === "add_surface" && data.change_targets.length > 0) {
      warnings.push(
        "add_surface declares change targets although the change adds a new surface; they are recorded as integration neighbors.",
      );
    }
  }

  if (mode === "rework") {
    if (data.pain_points.length === 0) {
      codes.push("REWORK_PAIN_POINTS_MISSING");
      issues.push("rework requires pain_points; no pain means no basis for redesign.");
    }
    if (data.actual_usage.length === 0) {
      codes.push("UNDERSTANDING_INCOMPLETE");
      issues.push("rework understanding requires actual_usage evidence.");
    }
    const buckets: Array<[string, string[]]> = [
      ["must_preserve", data.must_preserve],
      ["must_replace", data.must_replace],
      ["free_to_reconsider", data.free_to_reconsider],
    ];
    const placement = new Map<string, string>();
    for (const [bucket, items] of buckets) {
      for (const item of items) {
        const prior = placement.get(item);
        if (prior !== undefined) {
          codes.push("REWORK_BUCKET_CONFLICT");
          issues.push(`'${item}' appears in both ${prior} and ${bucket}; the three buckets must be exclusive.`);
        }
        placement.set(item, bucket);
      }
    }
    const inventory = [
      ...data.current_objects.map((object) => object.id),
      ...data.current_surfaces.map((surface) => surface.id),
    ];
    const uncovered = inventory.filter((item) => !placement.has(item));
    if (uncovered.length > 0) {
      codes.push("REWORK_COVERAGE_INCOMPLETE");
      issues.push(
        `Every declared object and surface must fall into exactly one bucket; uncovered: ${uncovered.join(", ")}.`,
      );
    }
  }

  return {
    status: issues.length === 0 ? (warnings.length === 0 ? "PASS" : "WARN") : "EXPAND",
    issues,
    warnings,
    codes,
    value: data,
  };
}

export function validateIntentLite(
  input: unknown,
  expectedKind: ChangeKind,
): ArtifactValidation<IntentLite> {
  const parsed = IntentLiteSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "RETRY", issues: zodIssues(parsed.error), warnings: [] };
  }
  const issues: string[] = [];
  const codes: string[] = [];
  if (parsed.data.kind !== expectedKind) {
    codes.push("INTENT_KIND_MISMATCH");
    issues.push(`intent_lite.kind '${parsed.data.kind}' does not match the session's change_kind '${expectedKind}'.`);
  }
  return { status: issues.length === 0 ? "PASS" : "EXPAND", issues, warnings: [], codes, value: parsed.data };
}

export function frameUnderstandingAlignment(
  frame: ProductFrame,
  understanding: ExistingUnderstanding,
  mode: DesignMode,
): string[] {
  const known = new Set(understanding.current_objects.map((object) => object.id));
  const warnings: string[] = [];
  const introduced = frame.product_objects.filter((object) => !known.has(object.id)).map((object) => object.id);
  if (introduced.length > 0) {
    warnings.push(
      `Frame introduces product objects absent from the existing understanding (${introduced.join(", ")}); confirm they are genuinely new to users, not unexamined backend nouns.`,
    );
  }
  if (mode === "rework") {
    const replaced = new Set([...understanding.must_replace, ...understanding.free_to_reconsider]);
    const legacyIds = new Set(understanding.current_objects.map((object) => object.id));
    const copied = frame.product_objects
      .filter((object) => legacyIds.has(object.id) && !replaced.has(object.id))
      .map((object) => object.id);
    if (copied.length > 0) {
      warnings.push(
        `Rework frame reuses legacy objects without declaring them free_to_reconsider or must_replace (${copied.join(", ")}); fresh derivation must start from tasks.`,
      );
    }
  }
  return warnings;
}
