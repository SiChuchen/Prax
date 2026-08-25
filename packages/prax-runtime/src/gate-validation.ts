import {
  CapabilityMapSchema,
  DesignContextSchema,
  DesignDecisionsSchema,
  ProductFrameSchema,
  ProductObjectOverrideSchema,
  type ArtifactValidation,
  type CapabilityMap,
  type DesignContext,
  type DesignDecisions,
  type DesignMode,
  type ProductFrame,
  zodIssues,
} from "./contracts.js";
import { classifyDesignContext } from "./classification.js";

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

  if (mode === "existing_product" && parsed.data.existing_product === undefined) {
    issues.push(
      "existing_product mode requires stable concepts, patterns, pain points, constraints and legacy debt.",
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
