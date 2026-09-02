import { z } from "zod";

const NonEmpty = z.string().trim().min(1);

export const ValidationCheckSchema = z.object({
  id: NonEmpty,
  label: NonEmpty,
  kind: z.enum(["deterministic", "assistive", "empirical"]),
  profile: NonEmpty.optional(),
  facet: NonEmpty.optional(),
  requirement: NonEmpty,
  evidence_required: z.boolean(),
});
export type ValidationCheck = z.infer<typeof ValidationCheckSchema>;

export const ValidationPlanSchema = z.object({
  version: z.literal("0.1"),
  pattern_ref: NonEmpty.optional(),
  checks: z.array(ValidationCheckSchema).min(1),
});
export type ValidationPlan = z.infer<typeof ValidationPlanSchema>;

export const PersistedValidationPlanSchema = z.object({
  version: z.literal("0.1"),
  revision: z.number().int().positive(),
  session_id: NonEmpty,
  derived_from: z.object({
    artifact_digests: z.record(z.string(), NonEmpty),
  }),
  plan: ValidationPlanSchema,
  history: z
    .array(
      z.object({
        revision: z.number().int().positive(),
        derived_from: z.object({
          artifact_digests: z.record(z.string(), NonEmpty),
        }),
        checks: z.array(ValidationCheckSchema),
      }),
    )
    .default([]),
});
export type PersistedValidationPlan = z.infer<typeof PersistedValidationPlanSchema>;

export const ValidationEvidenceItemSchema = z.object({
  check_id: NonEmpty,
  outcome: z.enum(["pass", "fail", "inconclusive"]),
  source: NonEmpty,
  notes: NonEmpty,
  artifact_refs: z.array(NonEmpty).default([]).describe(
    "Concrete artifacts backing an empirical claim (screenshot paths, run logs). " +
    "Empty means self-attestation, which is not independently verifiable.",
  ),
  measurement_receipt: NonEmpty.refine((r) => r.startsWith("validation-evidence/"), {
    message: "measurement receipts must live under validation-evidence/ relative to the session directory",
  }).optional(),
});

export const ValidationEvidenceSchema = z.object({
  submitted_by: NonEmpty,
  collected_at: z.string().datetime(),
  items: z.array(ValidationEvidenceItemSchema).min(1),
});
export type ValidationEvidence = z.infer<typeof ValidationEvidenceSchema>;

export interface ValidationFinding {
  check_id: string;
  kind: "deterministic" | "assistive" | "empirical";
  outcome: "pass" | "fail" | "inconclusive";
  message: string;
  source: string;
  provenance: "measured" | "attested";
}

export interface ReviewReadiness {
  deterministic_passed: boolean;
  measurement: {
    receipt_ref: string | null;
    error_failures_open: number;
    warning_dispositions: Array<{ check_id: string; disposition: "accepted" | "deferred"; reason: string }>;
  };
  convergence: { stalled: boolean; unresolved: string[] };
  evidence_current: boolean;
  claims: { measured: string[]; attested: string[]; skipped: string[] };
}

export interface ValidationEvaluation {
  status: "PASS" | "WARN" | "REVIEW" | "BLOCK" | "EXPAND";
  checks: ValidationCheck[];
  findings: ValidationFinding[];
  missing_evidence: string[];
  warnings: string[];
  codes?: string[];
  readiness?: ReviewReadiness;
}


export const ARTIFACT_CHECK_IDS = [
  "layout.overflow",
  "layout.responsive_collision",
  "text.truncation",
  "a11y.contrast",
  "a11y.focus_order",
  "a11y.target_size",
  "type.min_projected_size",
] as const;
export type ArtifactCheckId = (typeof ARTIFACT_CHECK_IDS)[number];

// Default severity per ADR-005 decision 6: warning-born; the two WCAG
// normative checks are error-born (zero overkill risk).
export const ARTIFACT_CHECK_DEFAULT_SEVERITY: Record<ArtifactCheckId, "warning" | "error"> = {
  "layout.overflow": "warning",
  "layout.responsive_collision": "warning",
  "text.truncation": "warning",
  "a11y.contrast": "error",
  "a11y.focus_order": "warning",
  "a11y.target_size": "error",
  "type.min_projected_size": "warning",
};

// Spec §5.4: validator check id -> measured catalog ids it accepts receipts for.
// Lookup semantics: absent key ≡ empty mapping (not enforced).
export const CHECK_MEASUREMENT_MAP: Record<string, readonly ArtifactCheckId[]> = {
  readability: ["a11y.contrast", "type.min_projected_size"],
  keyboard: ["a11y.focus_order"],
  regression_check: ["layout.overflow"],
  untouched_surface_regression: ["layout.overflow", "layout.responsive_collision"],
};

export const MeasurementReceiptCheckSchema = z.object({
  id: z.enum(ARTIFACT_CHECK_IDS),
  status: z.enum(["pass", "fail", "skipped"]),
  severity: z.enum(["warning", "error"]),
  subject: NonEmpty.optional(),
  measured: z.record(z.string(), z.unknown()).default({}),
  threshold: z.record(z.string(), z.unknown()).default({}),
  evidence_refs: z
    .array(z.object({
      ref: NonEmpty.refine((r) => r.startsWith("validation-evidence/"), {
        message: "receipt evidence refs must live under validation-evidence/",
      }),
      sha256: z.string().regex(/^[0-9a-f]{64}$/),
    }))
    .default([]),
  supported_fixes: z.array(NonEmpty).default([]),
  reason: NonEmpty.optional(),
}).superRefine((check, ctx) => {
  if (check.status === "skipped" && check.reason === undefined) {
    ctx.addIssue({ code: "custom", message: "skipped checks require a reason" });
  }
  if (check.status !== "pass" && check.subject === undefined) {
    ctx.addIssue({ code: "custom", message: "fail/skipped checks require a subject" });
  }
});
export type MeasurementReceiptCheck = z.infer<typeof MeasurementReceiptCheckSchema>;

export const MeasurementReceiptSchema = z.object({
  receipt_version: z.literal("0.1"),
  tool: z.object({ name: z.literal("prax-measure"), version: NonEmpty }), // version deliberately NonEmpty, not semver-constrained
  target: z.object({ app_root: NonEmpty, base_url: NonEmpty, build_ref: NonEmpty.nullable() }),
  run_at: z.string().datetime(),
  viewport_matrix: z.array(z.object({ width: z.number().int().positive(), height: z.number().int().positive(), label: NonEmpty.optional() })).min(1),
  checks: z.array(MeasurementReceiptCheckSchema).min(1),
  summary: z.object({ pass: z.number().int().nonnegative(), fail: z.number().int().nonnegative(), skipped: z.number().int().nonnegative(), warnings: z.number().int().nonnegative() }),
});
export type MeasurementReceipt = z.infer<typeof MeasurementReceiptSchema>;
