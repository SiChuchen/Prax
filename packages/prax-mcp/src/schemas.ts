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
  ProviderRefsSchema,
  RealizationModeSchema,
  RequirementConfirmationSchema,
} from "prax-runtime";
import { SdirDeltaSchema, SdirSchema } from "prax-sdir";
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

// Client-facing shape: a single permissive object. The z.union above serializes
// to a top-level anyOf with additionalProperties:false per branch, which strict
// MCP client validators reject (PRAX-AB-001 gap-mcp-anyof-schema). Branch
// discrimination and validation stay server-side.
export const DesignStartClientSchema = z.object({
  design_session_id: SessionId.optional().describe(
    "Existing design_session_id to resume at the requirement-confirmation gate; omit to create a new session.",
  ),
  requirement_confirmation: RequirementConfirmationSchema.optional(),
  requirement: z.string().trim().min(1).optional().describe("Required when creating a session: the user requirement text."),
  project_root: z.string().trim().min(1).optional().describe("Required when creating a session: absolute project root path."),
  mode: DesignModeSchema.optional().describe("Required when creating a session."),
  change_kind: ChangeKindSchema.optional().describe("Required for existing_product sessions."),
  design_authorities: z
    .array(z.string().trim().min(1))
    .optional()
    .describe("Documents whose constraints outrank generic guidance."),
  project_id: z.string().trim().min(1).optional(),
});

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
    mode: z.enum(["generate_from_decisions", "validate", "apply_delta"]),
    sdir: SdirSchema.optional(),
    sdir_delta: SdirDeltaSchema.optional(),
  })
  .superRefine((input, context) => {
    if (input.mode === "validate" && input.sdir === undefined) {
      context.addIssue({ code: "custom", path: ["sdir"], message: "sdir is required in validate mode." });
    }
    if (input.mode === "apply_delta" && input.sdir_delta === undefined) {
      context.addIssue({ code: "custom", path: ["sdir_delta"], message: "sdir_delta is required in apply_delta mode." });
    }
    if (input.mode !== "apply_delta" && input.sdir_delta !== undefined) {
      context.addIssue({ code: "custom", path: ["mode"], message: "sdir_delta requires mode apply_delta." });
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

const RealizeEvidenceItem = z.object({
  type: z.enum(["screenshot", "human_decision"]),
  ref: z.string().trim().min(1).optional(),
  actor_ref: z.string().trim().min(1).optional(),
  source_type: z.string().trim().min(1).optional(),
  source_ref: z.string().trim().min(1).optional(),
  quote: z.string().trim().min(1).optional(),
});

export const DesignRealizeInputSchema = z
  .object({
    design_session_id: SessionId,
    mode: z.enum(["propose", "submit_draft", "submit_review"]),
    realization_mode: RealizationModeSchema.optional(),
    provider: z.string().trim().min(1).optional(),
    conditions: z
      .array(z.object({ id: z.string().trim().min(1), holds: z.boolean(), basis: z.string().trim().min(1) }))
      .optional(),
    reason: z.string().trim().min(1).optional().describe("Required when re-proposing a different mode."),
    override: z.boolean().optional(),
    override_reason: z.string().trim().min(1).optional(),
    provider_refs: ProviderRefsSchema.optional(),
    status: z.enum(["approved", "rejected"]).optional(),
    provider_refs_verified: z
      .object({ file_key: z.string().trim().min(1), frame_node_ids: z.array(z.string().trim().min(1)).min(1) })
      .optional(),
    feedback: z
      .object({
        text: z.string().trim().min(1).optional(),
        region_annotations: z
          .array(z.object({ sdir_region: z.string().trim().min(1), note: z.string().trim().min(1) }))
          .optional(),
      })
      .optional(),
    evidence: z.array(RealizeEvidenceItem).min(1).optional(),
  })
  .superRefine((input, ctx) => {
    if (input.mode === "propose" && (input.realization_mode === undefined || input.conditions === undefined)) {
      ctx.addIssue({ code: "custom", path: ["realization_mode"], message: "propose requires realization_mode and conditions." });
    }
    if (input.mode === "submit_draft" && input.provider_refs === undefined) {
      ctx.addIssue({ code: "custom", path: ["provider_refs"], message: "submit_draft requires provider_refs." });
    }
    if (
      input.mode === "submit_review" &&
      (input.status === undefined || input.provider_refs_verified === undefined || input.evidence === undefined)
    ) {
      ctx.addIssue({ code: "custom", path: ["status"], message: "submit_review requires status, provider_refs_verified, and evidence." });
    }
  });

export type DesignStartInput = z.infer<typeof DesignStartInputSchema>;
export type DesignStartClientInput = z.input<typeof DesignStartClientSchema>;
export type DesignFrameInput = z.infer<typeof DesignFrameInputSchema>;
export type DesignContextInput = z.infer<typeof DesignContextInputSchema>;
export type DesignRouteInput = z.infer<typeof DesignRouteInputSchema>;
export type DesignInspectInput = z.infer<typeof DesignInspectInputSchema>;
export type DesignDecideInput = z.infer<typeof DesignDecideInputSchema>;
export type DesignSdirInput = z.infer<typeof DesignSdirInputSchema>;
export type DesignReconcileInput = z.infer<typeof DesignReconcileInputSchema>;
export type DesignPrepareImplementationInput = z.infer<typeof DesignPrepareImplementationInputSchema>;
export type DesignValidateInput = z.infer<typeof DesignValidateInputSchema>;
export type DesignRealizeInput = z.infer<typeof DesignRealizeInputSchema>;

