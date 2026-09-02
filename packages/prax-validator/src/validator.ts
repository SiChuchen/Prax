import type { ChangeKind, DesignContext, DesignDecisions, DesignMode, IntentLite, ProductFrame, RealizationMode, RepresentationArtifact, RepresentationReview } from "prax-runtime";
import { SdirEngine, validateSdirDelta, type Sdir } from "prax-sdir";
import type { SdirDelta } from "prax-sdir";
import {
  ValidationEvidenceSchema,
  ValidationPlanSchema,
  type ValidationCheck,
  type ValidationEvaluation,
  type ValidationEvidence,
  type ValidationFinding,
  type ValidationPlan,
} from "./contracts.js";
import { verifyArtifactEvidence } from "./artifact-evidence.js";

const REQUIREMENT_CHECK: ValidationCheck = {
  id: "requirement_alignment",
  label: "Requirement alignment",
  kind: "assistive",
  requirement: "The delivered result matches the confirmed restatement, scope, and success definition.",
  evidence_required: true,
};

const UNIVERSAL_CHECKS: ValidationCheck[] = [
  { id: "semantic_conformance", label: "Semantic conformance", kind: "deterministic", requirement: "SDIR is valid, semantic, and aligned to the approved pattern.", evidence_required: false },
  { id: "state_completeness", label: "State completeness", kind: "deterministic", requirement: "Required loading, empty, ready, and error states exist.", evidence_required: false },
  { id: "product_model_alignment", label: "Product model alignment", kind: "assistive", requirement: "User-facing structure and language preserve the Product Frame.", evidence_required: true },
  { id: "keyboard", label: "Keyboard operability", kind: "empirical", requirement: "Primary work and selection are operable with keyboard and visible focus.", evidence_required: true },
  { id: "hierarchy_review", label: "Hierarchy review", kind: "assistive", requirement: "Visual prominence follows SDIR importance rather than implementation convenience.", evidence_required: true },
];

const EXISTING_CHECKS: ValidationCheck[] = [
  { id: "untouched_surface_regression", label: "Untouched surface regression", kind: "empirical", requirement: "Surfaces outside the declared change targets behave exactly as before.", evidence_required: true },
  { id: "pattern_consistency", label: "Pattern consistency", kind: "assistive", requirement: "The change follows the established patterns recorded in the existing-product understanding.", evidence_required: true },
  { id: "authority_consistency", label: "Design authority consistency", kind: "assistive", requirement: "The result stays consistent with the declared design authorities.", evidence_required: true },
];

const REWORK_CHECKS: ValidationCheck[] = [
  { id: "fresh_derivation_check", label: "Fresh derivation", kind: "assistive", requirement: "Product objects derive from user tasks, not from copying the legacy structure.", evidence_required: true },
  { id: "migration_readiness", label: "Migration readiness", kind: "empirical", requirement: "The migration plan covers every must_preserve item.", evidence_required: true },
];

const REPRESENTATION_CHECKS: ValidationCheck[] = [
  { id: "design_representation_coverage", label: "Design representation coverage", kind: "deterministic", requirement: "Every SDIR region maps to at least one approved representation frame and the approved SDIR digest still matches.", evidence_required: false },
  { id: "representation_runtime_drift", label: "Representation runtime drift", kind: "empirical", requirement: "Runtime snapshot evidence compares against the approved representation snapshot (two artifact_refs: approved then runtime).", evidence_required: true },
];

// SDIR 0.2 structure checks (spec §6.5): deterministic, zero-browser; only
// assembled for 0.2 sessions (frame declares version 0.2) — 0.1 sessions
// carry zero new obligations (compatibility discipline)
const STRUCTURE_CHECKS: ValidationCheck[] = [
  { id: "representation_decided", label: "Representation decided", kind: "deterministic", requirement: "SDIR 0.2 declares representation.primary with a non-empty reason.", evidence_required: false },
  { id: "state_ownership_declared", label: "State ownership declared", kind: "deterministic", requirement: "Selection and preview states both have declared owners.", evidence_required: false },
  { id: "acceptance_contract_present", label: "Acceptance contract present", kind: "deterministic", requirement: "SDIR 0.2 carries at least one acceptance criterion.", evidence_required: false },
  { id: "complexity_budget_declared", label: "Complexity budget declared", kind: "deterministic", requirement: "SDIR 0.2 declares a complexity_budget block (values are not judged).", evidence_required: false },
];

function universalChecks(input: ValidationPlanInput): ValidationCheck[] {
  return input.frame?.version === "0.2" ? [...UNIVERSAL_CHECKS, ...STRUCTURE_CHECKS] : UNIVERSAL_CHECKS;
}

const DELTA_CONFORMANCE_CHECK: ValidationCheck = {
  id: "delta_conformance",
  label: "Delta conformance",
  kind: "deterministic",
  requirement: "The sdir_delta passes referential and render-leak validation.",
  evidence_required: false,
};

const LIGHT_CHECKS: Record<"visual_polish" | "defect_fix", ValidationCheck[]> = {
  visual_polish: [
    { id: "hierarchy_preserved", label: "Hierarchy preserved", kind: "assistive", requirement: "The visual change does not alter the surface's information hierarchy.", evidence_required: true },
    { id: "readability", label: "Readability", kind: "empirical", requirement: "Contrast and type-scale evidence shows text remains readable.", evidence_required: true },
    REQUIREMENT_CHECK,
  ],
  defect_fix: [
    { id: "regression_check", label: "Regression check", kind: "empirical", requirement: "The fix resolves the reported defect without behavior change elsewhere.", evidence_required: true },
    REQUIREMENT_CHECK,
  ],
};

export interface ValidationPolicyContext {
  mode: DesignMode;
  change_kind?: ChangeKind | undefined;
  authorities?: string[] | undefined;
}

export interface ValidationPlanInput {
  policyContext?: ValidationPolicyContext | undefined;
  frame?: ProductFrame | undefined;
  context?: DesignContext | undefined;
  decisions?: DesignDecisions | undefined;
  intentLite?: IntentLite | undefined;
  realizationMode?: RealizationMode | undefined;
}

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

const CHECK_PROFILE: Record<string, { profile: string; facet: string }> = {
  requirement_alignment: { profile: "semantic_integrity", facet: "semantic" },
  semantic_conformance: { profile: "semantic_integrity", facet: "semantic" },
  state_completeness: { profile: "state_coverage", facet: "behavioral" },
  product_model_alignment: { profile: "semantic_integrity", facet: "semantic" },
  keyboard: { profile: "keyboard_accessibility", facet: "behavioral" },
  hierarchy_review: { profile: "semantic_integrity", facet: "visual_hierarchy" },
  untouched_surface_regression: { profile: "runtime_degradation", facet: "behavioral" },
  pattern_consistency: { profile: "semantic_integrity", facet: "semantic" },
  authority_consistency: { profile: "semantic_integrity", facet: "epistemic" },
  fresh_derivation_check: { profile: "semantic_integrity", facet: "semantic" },
  migration_readiness: { profile: "persistence_integrity", facet: "behavioral" },
  delta_conformance: { profile: "semantic_integrity", facet: "semantic" },
  hierarchy_preserved: { profile: "semantic_integrity", facet: "visual_hierarchy" },
  readability: { profile: "visual_snapshot", facet: "visual" },
  regression_check: { profile: "runtime_degradation", facet: "behavioral" },
  relationship_trace: { profile: "relationship_integrity", facet: "behavioral" },
  context_preservation: { profile: "relationship_integrity", facet: "behavioral" },
  canvas_signal_hierarchy: { profile: "semantic_integrity", facet: "visual_hierarchy" },
  filter_state: { profile: "state_coverage", facet: "behavioral" },
  comparison_scan: { profile: "state_coverage", facet: "behavioral" },
  settings_grouping: { profile: "semantic_integrity", facet: "semantic" },
  safe_change: { profile: "state_coverage", facet: "behavioral" },
  destructive_recovery: { profile: "runtime_degradation", facet: "behavioral" },
  design_representation_coverage: { profile: "representation_integrity", facet: "semantic" },
  representation_decided: { profile: "semantic_integrity", facet: "semantic" },
  state_ownership_declared: { profile: "semantic_integrity", facet: "semantic" },
  acceptance_contract_present: { profile: "semantic_integrity", facet: "semantic" },
  complexity_budget_declared: { profile: "semantic_integrity", facet: "semantic" },
  representation_runtime_drift: { profile: "representation_integrity", facet: "visual" },
};

function withProfiles(checks: ValidationCheck[]): ValidationCheck[] {
  return checks.map((check) => {
    const mapping = CHECK_PROFILE[check.id];
    if (mapping === undefined || check.profile !== undefined) return check;
    return { ...check, profile: mapping.profile, facet: mapping.facet };
  });
}

export class PraxValidator {
  private readonly sdirEngine = new SdirEngine();

  public plan(input: ValidationPlanInput): ValidationPlan {
    const plan = this.assemblePlan(input);
    return { ...plan, checks: withProfiles(plan.checks) };
  }

  private assemblePlan(input: ValidationPlanInput): ValidationPlan {
    const policy = input.policyContext;
    if (policy === undefined) {
      const patternChecks = input.decisions !== undefined ? PATTERN_CHECKS[input.decisions.primary_structure.pattern] ?? [] : [];
      const riskChecks = this.riskChecks(input.context);
      return ValidationPlanSchema.parse({
        version: "0.1",
        ...(input.decisions === undefined ? {} : { pattern_ref: input.decisions.primary_structure.pattern }),
        checks: [...universalChecks(input), ...patternChecks, ...riskChecks, REQUIREMENT_CHECK],
      });
    }

    const lightKind =
      policy.change_kind === "visual_polish" || policy.change_kind === "defect_fix" ? policy.change_kind : undefined;
    if (lightKind !== undefined) {
      return ValidationPlanSchema.parse({
        version: "0.1",
        checks: [...LIGHT_CHECKS[lightKind]],
      });
    }

    if (policy.mode === "existing_product" && policy.change_kind === "modify_surface") {
      return ValidationPlanSchema.parse({
        version: "0.1",
        ...(input.decisions === undefined ? {} : { pattern_ref: input.decisions.primary_structure.pattern }),
        checks: [DELTA_CONFORMANCE_CHECK, ...EXISTING_CHECKS, REQUIREMENT_CHECK],
      });
    }

    const patternChecks = input.decisions !== undefined ? PATTERN_CHECKS[input.decisions.primary_structure.pattern] ?? [] : [];
    const riskChecks = this.riskChecks(input.context);
    const policyChecks =
      policy.mode === "rework" ? REWORK_CHECKS : policy.mode === "existing_product" ? EXISTING_CHECKS : [];
    const authorityCheck = this.authorityCheck(policy.authorities);
    const existingChecks = policy.mode === "existing_product" ? EXISTING_CHECKS.map((c) => (c.id === "authority_consistency" ? authorityCheck : c)) : policyChecks;
    return ValidationPlanSchema.parse({
      version: "0.1",
      ...(input.decisions === undefined ? {} : { pattern_ref: input.decisions.primary_structure.pattern }),
      checks: [
        ...universalChecks(input),
        ...patternChecks,
        ...riskChecks,
        ...(input.realizationMode === "figma_first" ? REPRESENTATION_CHECKS : []),
        ...existingChecks,
        REQUIREMENT_CHECK,
      ],
    });
  }

  private riskChecks(context?: DesignContext | undefined): ValidationCheck[] {
    return context !== undefined && context.risk.destructive_actions !== "none"
      ? [{ id: "destructive_recovery", label: "Destructive recovery", kind: "deterministic", requirement: "Destructive actions match error cost with prevention or recovery.", evidence_required: true }]
      : [];
  }

  private authorityCheck(authorities?: string[] | undefined): ValidationCheck {
    const suffix = authorities !== undefined && authorities.length > 0 ? ` Declared authorities: ${authorities.join(", ")}.` : "";
    return {
      id: "authority_consistency",
      label: "Design authority consistency",
      kind: "assistive",
      requirement: `The result stays consistent with the declared design authorities.${suffix}`,
      evidence_required: true,
    };
  }

  public parseEvidence(input: unknown): ValidationEvidence {
    return ValidationEvidenceSchema.parse(input);
  }

  public async evaluate(input: {
    plan: ValidationPlan;
    sdir?: Sdir | undefined;
    sdirDelta?: SdirDelta | undefined;
    decisions?: DesignDecisions | undefined;
    evidence?: ValidationEvidence;
    representationArtifact?: RepresentationArtifact | undefined;
    representationReview?: RepresentationReview | undefined;
    sdirDigest?: string | undefined;
    sessionDirectory?: string | undefined;
  }): Promise<ValidationEvaluation> {
    const provided = new Map(input.evidence?.items.map((item) => [item.check_id, item]) ?? []);
    const findings: ValidationFinding[] = [];
    const checkIds = new Set(input.plan.checks.map((check) => check.id));

    if (checkIds.has("semantic_conformance") || checkIds.has("state_completeness")) {
      const sdirValidation = this.sdirEngine.validate(input.sdir, input.decisions);
      const failed = sdirValidation.status !== "PASS";
      for (const check of ["semantic_conformance", "state_completeness"] as const) {
        if (!checkIds.has(check)) continue;
        findings.push({
          check_id: check,
          kind: "deterministic",
          outcome: failed ? "fail" : "pass",
          message: failed
            ? [...sdirValidation.schema_errors, ...sdirValidation.semantic_errors].join("; ")
            : input.plan.checks.find((candidate) => candidate.id === check)!.requirement,
          source: "prax-validator",
          provenance: "measured",
        });
      }
    }

    if (checkIds.has("delta_conformance")) {
      const deltaValidation = input.sdirDelta !== undefined ? validateSdirDelta(input.sdirDelta) : undefined;
      findings.push({
        check_id: "delta_conformance",
        kind: "deterministic",
        outcome: deltaValidation === undefined || deltaValidation.status !== "PASS" ? "fail" : "pass",
        message:
          deltaValidation === undefined
            ? "sdir_delta artifact is missing."
            : deltaValidation.status === "PASS"
              ? input.plan.checks.find((candidate) => candidate.id === "delta_conformance")!.requirement
              : deltaValidation.semantic_errors.join("; "),
        source: "prax-validator",
          provenance: "measured",
      });
    }

    if (checkIds.has("design_representation_coverage")) {
      const artifact = input.representationArtifact;
      let failure: string | undefined;
      if (artifact === undefined) {
        failure = "representation artifact is missing.";
      } else if (artifact.status !== "approved") {
        failure = `representation artifact status is '${artifact.status}', not approved.`;
      } else if (input.representationReview === undefined || input.representationReview.status !== "approved") {
        failure = "no approved representation review backs the artifact.";
      } else if (input.sdirDigest === undefined) {
        failure = "the current SDIR digest is unavailable.";
      } else if (input.sdirDigest !== artifact.semantic_refs.sdir_digest) {
        failure = "the SDIR digest changed after representation approval.";
      } else if (artifact.realization.refs === null) {
        failure = "the approved representation artifact carries no provider refs.";
      } else {
        const unmapped = artifact.semantic_refs.regions.filter(
          (region) => !artifact.realization.refs!.frames.some((frame) => frame.sdir_region === region),
        );
        if (unmapped.length > 0) {
          failure = `sdir regions without an approved frame: ${unmapped.join(", ")}.`;
        } else if (input.sdir?.screen.regions !== undefined) {
          const drifted = input.sdir.screen.regions.filter(
            (region) => !artifact.semantic_refs.regions.includes(region.id),
          );
          if (drifted.length > 0) {
            failure = `SDIR regions missing from the approved artifact: ${drifted.map((region) => region.id).join(", ")}.`;
          }
        }
      }
      findings.push({
        check_id: "design_representation_coverage",
        kind: "deterministic",
        outcome: failure === undefined ? "pass" : "fail",
        message:
          failure ??
          input.plan.checks.find((candidate) => candidate.id === "design_representation_coverage")!.requirement,
        source: "prax-validator",
          provenance: "measured",
      });
    }

    const structureCheckIds = new Set(STRUCTURE_CHECKS.map((check) => check.id));
    const structureWarnings: string[] = [];
    if (input.plan.checks.some((check) => structureCheckIds.has(check.id))) {
      const screen02 = input.sdir !== undefined && input.sdir.version === "0.2" ? input.sdir.screen : undefined;
      const owned = new Set((screen02?.state_ownership ?? []).map((entry) => entry.state));
      for (const check of input.plan.checks.filter((entry) => structureCheckIds.has(entry.id))) {
        let passed = false;
        let warning: string | undefined;
        if (check.id === "representation_decided") {
          passed = screen02?.representation?.primary?.reason !== undefined && screen02.representation.primary.reason.trim() !== "";
        } else if (check.id === "state_ownership_declared") {
          passed = owned.has("selection") && owned.has("preview");
        } else if (check.id === "acceptance_contract_present") {
          passed = (screen02?.acceptance?.length ?? 0) >= 1;
        } else {
          passed = true; // presence-only check; absence is advisory
          if (screen02?.complexity_budget === undefined) {
            warning =
              "complexity_budget_declared: the 0.2 SDIR declares no complexity_budget block — new permanent surfaces, modes, and state owners stay uncounted (P-044).";
          }
        }
        if (warning !== undefined) structureWarnings.push(warning);
        findings.push({
          check_id: check.id,
          kind: "deterministic",
          outcome: passed ? "pass" : "fail",
          message: passed
            ? check.requirement
            : `0.2 session SDIR does not satisfy '${check.id}': ${check.requirement}`,
          source: "prax-validator",
          provenance: "measured",
        });
      }
    }

    for (const check of input.plan.checks) {
      if (
        check.id === "semantic_conformance" ||
        check.id === "state_completeness" ||
        check.id === "delta_conformance" ||
        check.id === "design_representation_coverage" ||
        structureCheckIds.has(check.id)
      ) {
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
          provenance: "attested",
        });
      }
    }

    const driftEvidence = provided.get("representation_runtime_drift");
    const driftInsufficient =
      driftEvidence !== undefined && (driftEvidence.artifact_refs?.length ?? 0) < 2;
    if (driftInsufficient) {
      const finding = findings.find((candidate) => candidate.check_id === "representation_runtime_drift");
      if (finding !== undefined) {
        finding.outcome = "inconclusive";
        finding.message = `${finding.message}; two artifact_refs are required (approved snapshot, runtime snapshot).`;
      }
    }

    const missingEvidence = input.plan.checks
      .filter(
        (check) =>
          (check.evidence_required && !provided.has(check.id)) ||
          (check.id === "representation_runtime_drift" && driftInsufficient),
      )
      .map((check) => check.id);
    const deterministicFailure = findings.some(
      (finding) => finding.kind === "deterministic" && finding.outcome === "fail",
    );
    const reviewFailure = findings.some(
      (finding) => finding.kind !== "deterministic" && finding.outcome === "fail",
    );
    const inconclusive = findings.some((finding) => finding.outcome === "inconclusive");

    let status: ValidationEvaluation["status"] = deterministicFailure
      ? "BLOCK"
      : reviewFailure
        ? "REVIEW"
        : missingEvidence.length > 0
          ? "EXPAND"
          : inconclusive
            ? "WARN"
            : "PASS";

    const warnings = [
      ...structureWarnings,
      ...input.plan.checks
      .filter(
        (check) =>
          check.kind === "empirical" &&
          check.evidence_required &&
          provided.get(check.id)?.outcome === "pass" &&
          (provided.get(check.id)?.artifact_refs?.length ?? 0) === 0,
      )
      .map(
        (check) =>
          `check '${check.id}' passed on agent self-attestation without artifact_refs; cite concrete artifacts (screenshots, run logs) so the claim is verifiable (PRAX-AB-001 finding-01)`,
      ),
    ];

    // ── measured artifact evidence (Task B4, spec §5.4/§5.7) ──
    let codes: string[] = [];
    let readiness: import("./contracts.js").ReviewReadiness | undefined;
    if (input.sessionDirectory !== undefined && input.evidence !== undefined) {
      const artifact = await verifyArtifactEvidence({
        sessionDirectory: input.sessionDirectory,
        evidence: input.evidence,
      });
      for (const finding of findings) {
        const provenance = artifact.provenanceByCheck.get(finding.check_id);
        if (provenance !== undefined) finding.provenance = provenance;
      }
      for (const missing of artifact.missingEvidence) {
        if (!missingEvidence.includes(missing)) missingEvidence.push(missing);
      }
      warnings.push(...artifact.warnings);
      codes = artifact.codes;
      readiness = {
        deterministic_passed: !findings.some((finding) => finding.kind === "deterministic" && finding.outcome === "fail"),
        measurement: {
          receipt_ref: artifact.receiptRefs[0] ?? null,
          error_failures_open: artifact.errorFailuresOpen,
          warning_dispositions: [],
        },
        convergence: { stalled: false, unresolved: [] }, // the service injects the runtime-tracked state
        evidence_current: artifact.evidenceCurrent,
        claims: {
          // the split reflects every finding's final provenance, not only the
          // mapped checks — unmapped claims stay attested and are never shown
          // as measured (spec §5.4)
          measured: [...new Set(findings.filter((finding) => finding.provenance === "measured").map((finding) => finding.check_id))],
          attested: [...new Set(findings.filter((finding) => finding.provenance === "attested").map((finding) => finding.check_id))],
          skipped: artifact.skippedArtifactIds,
        },
      };
      const severity: Record<ValidationEvaluation["status"], number> = { BLOCK: 4, REVIEW: 3, EXPAND: 2, WARN: 1, PASS: 0 };
      if (severity[artifact.status] > severity[status]) status = artifact.status;
      // §5.7 R1/R2: a not-green readiness refuses completion — only PASS/WARN
      // evaluations are downgraded here; worse statuses already refuse it
      const readinessGreen =
        readiness.deterministic_passed &&
        readiness.measurement.error_failures_open === 0 &&
        readiness.evidence_current;
      if (!readinessGreen && (status === "PASS" || status === "WARN")) {
        status = "REVIEW";
        codes = ["REVIEW_NOT_READY", ...codes];
      }
    }

    return {
      status,
      checks: input.plan.checks,
      findings,
      missing_evidence: missingEvidence,
      warnings,
      ...(codes.length > 0 ? { codes } : {}),
      ...(readiness !== undefined ? { readiness } : {}),
    };
  }
}
