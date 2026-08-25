import {
  CapabilityMapSchema,
  DesignContextSchema,
  DesignDecisionsSchema,
  ProductFrameSchema,
  type ArtifactValidation,
  type CapabilityMap,
  type DesignContext,
  type DesignDecisions,
  type DesignMode,
  type ProductFrame,
  zodIssues,
} from "./contracts.js";

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
    parsed.data.mental_model_hypothesis.evidence.length === 0
  ) {
    issues.push(
      "A low-confidence mental model requires evidence or an explicit open question before architecture can be derived.",
    );
  }

  const backendShaped = parsed.data.product_objects.filter(
    productObjectLooksBackendShaped,
  );
  if (backendShaped.length >= Math.min(2, parsed.data.product_objects.length)) {
    return {
      status: "REVIEW",
      issues: [
        `Product Objects appear to reproduce backend vocabulary: ${backendShaped.map((item) => item.id).join(", ")}.`,
        "Translate these into concepts users recognize, or record evidence that the backend terms are established product concepts.",
      ],
      warnings,
      value: parsed.data,
    };
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

  return {
    status: issues.length === 0 ? (warnings.length === 0 ? "PASS" : "WARN") : "EXPAND",
    issues,
    warnings,
    value: parsed.data,
  };
}

export interface DecisionValidationContext {
  sessionId: string;
  routedPatternIds: ReadonlySet<string>;
  inspectedAtLeastL1: ReadonlySet<string>;
  plausibleAlternativeCount: number;
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
  const chosen = parsed.data.primary_structure.pattern;

  if (parsed.data.session_id !== context.sessionId) {
    issues.push("design_decisions.session_id does not match design_session_id.");
  }
  if (!context.routedPatternIds.has(chosen)) {
    issues.push(`Chosen Pattern ${chosen} was not returned by the Design Router.`);
  }
  if (!context.inspectedAtLeastL1.has(chosen)) {
    issues.push(`Chosen Pattern ${chosen} was not inspected to at least L1.`);
  }
  if (
    context.plausibleAlternativeCount > 1 &&
    parsed.data.rejected.length === 0
  ) {
    issues.push("At least one plausible alternative must be explicitly rejected.");
  }
  const highImpactUnknowns = parsed.data.unresolved.filter(
    (unknown) => typeof unknown !== "string" && unknown.impact === "high",
  );
  if (highImpactUnknowns.length > 0) {
    issues.push("High-impact design decisions remain unresolved.");
  }

  if (parsed.data.primary_structure.confidence === "low") {
    warnings.push("The primary structure decision has low confidence.");
  }

  return {
    status: issues.length === 0 ? (warnings.length === 0 ? "PASS" : "WARN") : "EXPAND",
    issues,
    warnings,
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
