import { z } from "zod";
import {
  CapabilityMapSchema,
  ChangeKindSchema,
  DesignContextSchema,
  DesignDecisionsSchema,
  DesignModeSchema,
  DisclosureDepthSchema,
  ExistingUnderstandingSchema,
  IntentLiteSchema,
  ProductFrameSchema,
  RequirementConfirmationSchema,
} from "prax-runtime";
import { SdirSchema } from "prax-sdir";
import { ValidationEvidenceSchema } from "prax-validator";

const SessionId = z.string().trim().min(1).describe("Explicit persisted Prax design_session_id");

const CreateSessionInput = z.strictObject({
  requirement: z.string().trim().min(1),
  project_root: z.string().trim().min(1),
  mode: DesignModeSchema,
  change_kind: ChangeKindSchema.optional(),
  design_authorities: z.array(z.string().trim().min(1)).default([]),
  project_id: z.string().trim().min(1).optional(),
  requirement_confirmation: RequirementConfirmationSchema.optional(),
});

const ResumeConfirmationInput = z.strictObject({
  design_session_id: SessionId,
  requirement_confirmation: RequirementConfirmationSchema,
});

export const DesignStartInputSchema = z.union([ResumeConfirmationInput, CreateSessionInput]);

export const DesignFrameInputSchema = z
  .object({
    design_session_id: SessionId,
    product_frame: ProductFrameSchema.optional(),
    existing_understanding: ExistingUnderstandingSchema.optional(),
    intent_lite: IntentLiteSchema.optional(),
  })
  .superRefine((input, ctx) => {
    const payloads = [input.product_frame, input.existing_understanding, input.intent_lite].filter(
      (value) => value !== undefined,
    );
    if (payloads.length !== 1) {
      ctx.addIssue({
        code: "custom",
        path: ["product_frame"],
        message: "Exactly one of product_frame, existing_understanding, or intent_lite is required.",
      });
    }
  });

export const DesignContextInputSchema = z.object({
  design_session_id: SessionId,
  design_context: DesignContextSchema,
});

export const DesignRouteInputSchema = z.object({
  design_session_id: SessionId,
  question: z.string().trim().min(1),
  accept_scope_gap: z
    .object({
      question: z.string().trim().min(1),
      rationale: z.string().trim().min(1),
    })
    .optional()
    .describe("Explicitly accept an uncovered domain and proceed on generic guidance; recorded as an unresolved open question."),
});

export const DisclosurePurposeInputSchema = z.object({
  kind: z.enum(["compare_alternatives", "resolve_conflict", "validate_decision", "investigate_risk"]),
  target_ids: z.array(z.string().trim().min(1)).default([]),
  question: z.string().trim().min(1),
});

export const DesignInspectInputSchema = z.object({
  design_session_id: SessionId,
  ids: z.array(z.string().trim().min(1)).min(1).max(20),
  depth: DisclosureDepthSchema,
  purpose: DisclosurePurposeInputSchema,
});

export const DesignDecideInputSchema = z.object({
  design_session_id: SessionId,
  design_decisions: DesignDecisionsSchema,
});

export const DesignSdirInputSchema = z
  .object({
    design_session_id: SessionId,
    mode: z.enum(["generate_from_decisions", "validate"]),
    sdir: SdirSchema.optional(),
  })
  .superRefine((input, context) => {
    if (input.mode === "validate" && input.sdir === undefined) {
      context.addIssue({ code: "custom", path: ["sdir"], message: "sdir is required in validate mode." });
    }
  });

export const DesignReconcileInputSchema = z.object({
  design_session_id: SessionId,
  capability_map: CapabilityMapSchema,
});

export const DesignPrepareImplementationInputSchema = z.object({
  design_session_id: SessionId,
  platform: z.literal("web_desktop"),
  framework: z.literal("react"),
});

export const DesignValidateInputSchema = z.object({
  design_session_id: SessionId,
  mode: z.enum(["plan", "submit_evidence", "evaluate"]),
  evidence: ValidationEvidenceSchema.optional(),
});

export type DesignStartInput = z.infer<typeof DesignStartInputSchema>;
export type DesignFrameInput = z.infer<typeof DesignFrameInputSchema>;
export type DesignContextInput = z.infer<typeof DesignContextInputSchema>;
export type DesignRouteInput = z.infer<typeof DesignRouteInputSchema>;
export type DesignInspectInput = z.infer<typeof DesignInspectInputSchema>;
export type DesignDecideInput = z.infer<typeof DesignDecideInputSchema>;
export type DesignSdirInput = z.infer<typeof DesignSdirInputSchema>;
export type DesignReconcileInput = z.infer<typeof DesignReconcileInputSchema>;
export type DesignPrepareImplementationInput = z.infer<typeof DesignPrepareImplementationInputSchema>;
export type DesignValidateInput = z.infer<typeof DesignValidateInputSchema>;

