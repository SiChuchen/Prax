import { z } from "zod";

const NonEmpty = z.string().trim().min(1);

export const ValidationCheckSchema = z.object({
  id: NonEmpty,
  label: NonEmpty,
  kind: z.enum(["deterministic", "assistive", "empirical"]),
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

export const ValidationEvidenceItemSchema = z.object({
  check_id: NonEmpty,
  outcome: z.enum(["pass", "fail", "inconclusive"]),
  source: NonEmpty,
  notes: NonEmpty,
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
}

export interface ValidationEvaluation {
  status: "PASS" | "WARN" | "REVIEW" | "BLOCK" | "EXPAND";
  checks: ValidationCheck[];
  findings: ValidationFinding[];
  missing_evidence: string[];
}

