import type { DesignContext, DesignDecisions, ProductFrame } from "prax-runtime";
import { SdirEngine, type Sdir } from "prax-sdir";
import {
  ValidationEvidenceSchema,
  ValidationPlanSchema,
  type ValidationCheck,
  type ValidationEvaluation,
  type ValidationEvidence,
  type ValidationFinding,
  type ValidationPlan,
} from "./contracts.js";

const UNIVERSAL_CHECKS: ValidationCheck[] = [
  { id: "semantic_conformance", label: "Semantic conformance", kind: "deterministic", requirement: "SDIR is valid, semantic, and aligned to the approved pattern.", evidence_required: false },
  { id: "state_completeness", label: "State completeness", kind: "deterministic", requirement: "Required loading, empty, ready, and error states exist.", evidence_required: false },
  { id: "product_model_alignment", label: "Product model alignment", kind: "assistive", requirement: "User-facing structure and language preserve the Product Frame.", evidence_required: true },
  { id: "keyboard", label: "Keyboard operability", kind: "empirical", requirement: "Primary work and selection are operable with keyboard and visible focus.", evidence_required: true },
  { id: "hierarchy_review", label: "Hierarchy review", kind: "assistive", requirement: "Visual prominence follows SDIR importance rather than implementation convenience.", evidence_required: true },
];

const PATTERN_CHECKS: Record<string, ValidationCheck[]> = {
  "PAT-CANVAS-WORKSPACE": [
    { id: "relationship_trace", label: "Relationship trace", kind: "empirical", requirement: "A user can locate and follow a relationship without losing global context.", evidence_required: true },
    { id: "context_preservation", label: "Context preservation", kind: "empirical", requirement: "Selection-driven detail preserves canvas position and visible selection.", evidence_required: true },
    { id: "canvas_signal_hierarchy", label: "Canvas signal hierarchy", kind: "assistive", requirement: "Architecture content dominates toolbar, navigation, and inspector chrome.", evidence_required: true },
  ],
  "PAT-DATA-EXPLORER": [
    { id: "filter_state", label: "Filter state", kind: "deterministic", requirement: "Active filters and result state are represented explicitly.", evidence_required: true },
    { id: "comparison_scan", label: "Comparison scan", kind: "empirical", requirement: "Comparable values can be scanned without opening every item.", evidence_required: true },
  ],
  "PAT-SETTINGS-SECTIONS": [
    { id: "settings_grouping", label: "Settings grouping", kind: "assistive", requirement: "Sections follow user goals rather than backend configuration objects.", evidence_required: true },
    { id: "safe_change", label: "Safe change", kind: "deterministic", requirement: "Save, dirty, success, and error behavior is explicit.", evidence_required: true },
  ],
};

export class PraxValidator {
  private readonly sdirEngine = new SdirEngine();

  public plan(_frame: ProductFrame, context: DesignContext, decisions: DesignDecisions): ValidationPlan {
    const patternChecks = PATTERN_CHECKS[decisions.primary_structure.pattern] ?? [];
    const riskChecks: ValidationCheck[] =
      context.risk.destructive_actions === "none"
        ? []
        : [{ id: "destructive_recovery", label: "Destructive recovery", kind: "deterministic", requirement: "Destructive actions match error cost with prevention or recovery.", evidence_required: true }];
    return ValidationPlanSchema.parse({
      version: "0.1",
      pattern_ref: decisions.primary_structure.pattern,
      checks: [...UNIVERSAL_CHECKS, ...patternChecks, ...riskChecks],
    });
  }

  public parseEvidence(input: unknown): ValidationEvidence {
    return ValidationEvidenceSchema.parse(input);
  }

  public evaluate(input: {
    plan: ValidationPlan;
    sdir: Sdir;
    decisions: DesignDecisions;
    evidence?: ValidationEvidence;
  }): ValidationEvaluation {
    const provided = new Map(input.evidence?.items.map((item) => [item.check_id, item]) ?? []);
    const findings: ValidationFinding[] = [];
    const sdirValidation = this.sdirEngine.validate(input.sdir, input.decisions);

    for (const check of input.plan.checks) {
      if (check.id === "semantic_conformance" || check.id === "state_completeness") {
        const failed = sdirValidation.status !== "PASS";
        findings.push({
          check_id: check.id,
          kind: "deterministic",
          outcome: failed ? "fail" : "pass",
          message: failed
            ? [...sdirValidation.schema_errors, ...sdirValidation.semantic_errors].join("; ")
            : check.requirement,
          source: "prax-validator",
        });
        continue;
      }

      const evidence = provided.get(check.id);
      if (evidence !== undefined) {
        findings.push({
          check_id: check.id,
          kind: check.kind,
          outcome: evidence.outcome,
          message: evidence.notes,
          source: evidence.source,
        });
      }
    }

    const missingEvidence = input.plan.checks
      .filter((check) => check.evidence_required && !provided.has(check.id))
      .map((check) => check.id);
    const deterministicFailure = findings.some(
      (finding) => finding.kind === "deterministic" && finding.outcome === "fail",
    );
    const reviewFailure = findings.some(
      (finding) => finding.kind !== "deterministic" && finding.outcome === "fail",
    );
    const inconclusive = findings.some((finding) => finding.outcome === "inconclusive");

    const status = deterministicFailure
      ? "BLOCK"
      : reviewFailure
        ? "REVIEW"
        : missingEvidence.length > 0
          ? "EXPAND"
          : inconclusive
            ? "WARN"
            : "PASS";

    return { status, checks: input.plan.checks, findings, missing_evidence: missingEvidence };
  }
}

