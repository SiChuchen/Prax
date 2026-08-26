import {
  KnowledgeStore,
  loadBuiltInKnowledgeStore,
  type DisclosureDepth,
} from "prax-knowledge";
import { DesignRouter, DisclosureGate, type RoutingResult } from "prax-router";
import {
  FileSessionStore,
  advanceSession,
  checkOperationAllowed,
  currentGate,
  lifecyclePolicyFor,
  NEXT_TOOL_BY_GATE,
  PraxRuntimeError,
  sessionPolicy,
  validateCapabilityMap,
  validateDesignContext,
  validateDesignDecisions,
  validateExistingUnderstanding,
  validateIntentLite,
  frameUnderstandingAlignment,
  validateProductFrame,
  validateRequirementConfirmation,
  type CapabilityMap,
  type DesignContext,
  type DesignDecisions,
  type DesignOperation,
  type DesignSession,
  type ExistingUnderstanding,
  type GateStatus,
  type IntentLite,
  type ProductFrame,
  type RequirementConfirmation,
  ProductFrameSchema,
  DesignContextSchema,
} from "prax-runtime";
import { patternSurfaceContract, SdirEngine, validateSdirDelta, type Sdir, type SdirDelta } from "prax-sdir";
import {
  PraxValidator,
  ValidationPlanSchema,
  type ValidationEvidence,
  type ValidationPlan,
} from "prax-validator";
import type {
  DesignContextInput,
  DesignDecideInput,
  DesignFrameInput,
  DesignInspectInput,
  DesignPrepareImplementationInput,
  DesignReconcileInput,
  DesignRouteInput,
  DesignSdirInput,
  DesignStartInput,
  DesignValidateInput,
} from "./schemas.js";

export type PraxOutput = Record<string, unknown> & { status: GateStatus };

interface ValidationReportArtifact {
  plan: unknown;
  evidence?: ValidationEvidence;
  evaluation?: unknown;
}

function touch(session: DesignSession, now: string): DesignSession {
  return { ...session, updated_at: now, revision: session.revision + 1 };
}

function nextTool(tool: string): Record<string, string> {
  return { tool };
}

function operationBlock(session: DesignSession, operation: DesignOperation): PraxOutput | undefined {
  const blocked = checkOperationAllowed(session, operation);
  return blocked === undefined ? undefined : { ...blocked };
}

export class PraxService {
  public readonly knowledge: KnowledgeStore;
  public readonly sessions: FileSessionStore;
  private readonly router: DesignRouter;
  private readonly disclosureGate = new DisclosureGate();
  private readonly sdirEngine = new SdirEngine();
  private readonly validator = new PraxValidator();

  public constructor(options: { knowledge: KnowledgeStore; sessions?: FileSessionStore }) {
    this.knowledge = options.knowledge;
    this.sessions = options.sessions ?? new FileSessionStore();
    this.router = new DesignRouter(options.knowledge);
  }

  public static async create(options: { sessions?: FileSessionStore } = {}): Promise<PraxService> {
    return new PraxService({ knowledge: await loadBuiltInKnowledgeStore(), ...options });
  }

  public async designStart(input: DesignStartInput): Promise<PraxOutput> {
    if ("design_session_id" in input) {
      const session = await this.sessions.getSession(input.design_session_id);
      if (currentGate(session) !== "confirm") {
        return {
          status: "BLOCK",
          code: "GATE_NOT_SATISFIED",
          message: `Session ${session.id} is not awaiting requirement confirmation.`,
          next: { tool: NEXT_TOOL_BY_GATE[currentGate(session)] },
        };
      }
      const validation = validateRequirementConfirmation(input.requirement_confirmation);
      if (validation.status !== "PASS" && validation.status !== "WARN") {
        return {
          status: validation.status,
          issues: validation.issues,
          warnings: validation.warnings,
          next: nextTool("design_start"),
        };
      }
      const updated = advanceSession(session, "confirm", this.sessions.nowIso());
      await this.sessions.commit(updated, [{ key: "requirementConfirmation", value: validation.value }]);
      return {
        status: validation.status,
        design_session_id: session.id,
        phase: updated.phase,
        next: nextTool(NEXT_TOOL_BY_GATE[currentGate(updated)]),
      };
    }

    let policy;
    try {
      policy = lifecyclePolicyFor(input.mode, input.change_kind);
    } catch (error) {
      if (error instanceof PraxRuntimeError) {
        return { status: "BLOCK", code: error.code, message: error.message };
      }
      throw error;
    }
    const session = await this.sessions.createSession({
      projectRoot: input.project_root,
      requirement: input.requirement,
      mode: input.mode,
      ...(input.project_id === undefined ? {} : { projectId: input.project_id }),
      lifecyclePolicy: policy,
      designAuthorities: input.design_authorities,
    });
    if (input.requirement_confirmation === undefined) {
      return {
        status: "PASS",
        design_session_id: session.id,
        phase: session.phase,
        next: nextTool("design_start"),
        required: ["user_quote", "restatement", "boundaries", "confirmed_with_user"],
      };
    }
    const validation = validateRequirementConfirmation(input.requirement_confirmation);
    if (validation.status !== "PASS" && validation.status !== "WARN") {
      return {
        status: validation.status,
        design_session_id: session.id,
        issues: validation.issues,
        warnings: validation.warnings,
        next: nextTool("design_start"),
      };
    }
    const updated = advanceSession(session, "confirm", this.sessions.nowIso());
    await this.sessions.commit(updated, [{ key: "requirementConfirmation", value: validation.value }]);
    return {
      status: validation.status,
      design_session_id: session.id,
      phase: updated.phase,
      next: nextTool(NEXT_TOOL_BY_GATE[currentGate(updated)]),
    };
  }

  public async designFrame(input: DesignFrameInput): Promise<PraxOutput> {
    const session = await this.sessions.getSession(input.design_session_id);
    const blocked = operationBlock(session, "design_frame");
    if (blocked !== undefined) return blocked;
    const gate = currentGate(session);
    const now = this.sessions.nowIso();

    if (gate === "understanding") {
      if (input.existing_understanding === undefined) {
        return {
          status: "EXPAND",
          issues: ["The understanding gate expects an existing_understanding payload."],
          next: nextTool("design_frame"),
        };
      }
      const validation = validateExistingUnderstanding(
        input.existing_understanding,
        session.mode,
        session.lifecycle_policy?.change_kind,
      );
      if (validation.status !== "PASS" && validation.status !== "WARN") {
        return {
          status: validation.status,
          issues: validation.issues,
          codes: validation.codes ?? [],
          warnings: validation.warnings,
          next: nextTool("design_frame"),
        };
      }
      const updated = advanceSession(session, "understanding", now);
      await this.sessions.commit(updated, [{ key: "existingUnderstanding", value: validation.value }]);
      return {
        status: validation.status,
        warnings: validation.warnings,
        phase: updated.phase,
        next: nextTool(NEXT_TOOL_BY_GATE[currentGate(updated)]),
      };
    }

    if (gate === "intent_lite") {
      if (input.intent_lite === undefined) {
        return {
          status: "EXPAND",
          issues: ["The intent gate expects an intent_lite payload."],
          next: nextTool("design_frame"),
        };
      }
      const expectedKind = session.lifecycle_policy?.change_kind === "defect_fix" ? "defect_fix" : "visual_polish";
      const understanding =
        (await this.sessions.readArtifact<ExistingUnderstanding>(session, "existingUnderstanding")) ?? undefined;
      const validation = validateIntentLite(input.intent_lite, expectedKind, understanding);
      if (validation.status !== "PASS") {
        return {
          status: validation.status,
          issues: validation.issues,
          codes: validation.codes ?? [],
          warnings: [],
          next: nextTool("design_frame"),
        };
      }
      const updated = advanceSession(session, "intent_lite", now);
      const intent = validation.value!;
      const brief = {
        version: "0.1",
        mode_plan: {
          change_list: [intent.change],
          regression_checks: intent.regression_points,
          surfaces: intent.surfaces,
        },
      };
      await this.sessions.commit(updated, [
        { key: "intentLite", value: intent },
        { key: "implementationBrief", value: brief },
      ]);
      return {
        status: "PASS",
        phase: updated.phase,
        next: nextTool(NEXT_TOOL_BY_GATE[currentGate(updated)]),
      };
    }

    if (input.product_frame === undefined) {
      return {
        status: "EXPAND",
        issues: ["The framing gate expects a product_frame payload."],
        next: nextTool("design_frame"),
      };
    }
    const hasUnderstanding = (await this.sessions.readArtifact(session, "existingUnderstanding")) !== undefined;
    const validation = validateProductFrame(input.product_frame, session.mode, hasUnderstanding);
    if (validation.status !== "PASS" && validation.status !== "WARN") {
      return {
        status: validation.status,
        missing_or_uncertain: validation.issues,
        warnings: validation.warnings,
        next: nextTool("design_frame"),
      };
    }
    const updated = advanceSession(session, "framing", now);
    await this.sessions.commit(updated, [{ key: "productFrame", value: validation.value }]);
    const understanding = await this.sessions.readArtifact<ExistingUnderstanding>(session, "existingUnderstanding");
    const extraWarnings =
      understanding !== undefined && (session.mode === "existing_product" || session.mode === "rework")
        ? frameUnderstandingAlignment(validation.value!, understanding, session.mode)
        : [];
    return {
      status: extraWarnings.length > 0 ? "WARN" : validation.status,
      missing_or_uncertain: [],
      warnings: [...validation.warnings, ...extraWarnings],
      phase: updated.phase,
      next: nextTool(NEXT_TOOL_BY_GATE[currentGate(updated)]),
    };
  }

  public async designContext(input: DesignContextInput): Promise<PraxOutput> {
    const session = await this.sessions.getSession(input.design_session_id);
    const blocked = operationBlock(session, "design_context");
    if (blocked !== undefined) return blocked;
    const frame = await this.requireArtifact<ProductFrame>(session, "productFrame");
    const validation = validateDesignContext(input.design_context, frame);
    if (validation.status !== "PASS" && validation.status !== "WARN") {
      return {
        status: validation.status,
        material_unknowns: validation.issues,
        warnings: validation.warnings,
        next: nextTool("design_context"),
      };
    }
    const updated = advanceSession(session, "context", this.sessions.nowIso());
    await this.sessions.commit(updated, [{ key: "designContext", value: validation.value }]);
    return {
      status: validation.status,
      material_unknowns: [],
      warnings: validation.warnings,
      phase: updated.phase,
      next: nextTool("design_route"),
    };
  }

  public async designRoute(input: DesignRouteInput): Promise<PraxOutput> {
    const session = await this.sessions.getSession(input.design_session_id);
    const blocked = operationBlock(session, "design_route");
    if (blocked !== undefined) return blocked;
    const frameArtifact = await this.sessions.readArtifact<ProductFrame>(session, "productFrame");
    const contextArtifact = await this.sessions.readArtifact<DesignContext>(session, "designContext");
    const understanding = await this.sessions.readArtifact<ExistingUnderstanding>(session, "existingUnderstanding");
    const confirmation = await this.sessions.readArtifact<RequirementConfirmation>(session, "requirementConfirmation");
    const frame = frameArtifact ?? this.derivedFrame(understanding, confirmation);
    const context = contextArtifact ?? this.derivedContext(understanding, confirmation, session.design_authorities);
    const derived = frameArtifact === undefined || contextArtifact === undefined;
    const route = this.router.route(frame, context, input.question);
    const now = this.sessions.nowIso();
    const selectedIds = [
      ...route.principles,
      ...route.heuristics,
      ...route.patterns,
      ...route.platform_profile,
    ].map((candidate) => candidate.id);
    const routedRecord = {
      question: input.question,
      selected_ids: selectedIds,
      excluded_ids: route.excluded.map((candidate) => candidate.id),
      confidence: route.confidence,
      routed_at: now,
    } as const;
    const acceptingScopeGap = route.status !== "PASS" && input.accept_scope_gap !== undefined;
    const advances = route.status === "PASS" || acceptingScopeGap;
    const phaseUpdated = advances ? advanceSession(session, "route", now) : touch(session, now);
    const updated = {
      ...phaseUpdated,
      routing_history: [...session.routing_history, routedRecord],
      ...(acceptingScopeGap
        ? {
            unresolved: [...session.unresolved, input.accept_scope_gap!.question],
            warnings: [
              ...session.warnings,
              `Routing scope gap accepted: ${input.accept_scope_gap!.rationale}`,
            ],
          }
        : {}),
      ...(derived
        ? {
            warnings: [
              ...(acceptingScopeGap ? [`Routing scope gap accepted: ${input.accept_scope_gap!.rationale}`] : []),
              ...session.warnings,
              "Routing inputs derived from existing understanding (provenance: existing-understanding.yaml + requirement-confirmation.yaml).",
            ],
          }
        : {}),
    };
    const priorLog = (await this.sessions.readArtifact<{ events?: unknown[] }>(session, "routingLog")) ?? {};
    const artifactWrites: Array<{ key: "routingLog" | "productFrame" | "designContext"; value: unknown }> = [
      {
        key: "routingLog",
        value: {
          version: "0.1",
          events: [
            ...(priorLog.events ?? []),
            {
              question: input.question,
              routed_at: now,
              result: route,
              ...(derived ? { derived_from_understanding: true } : {}),
              ...(acceptingScopeGap ? { scope_gap_accepted: input.accept_scope_gap } : {}),
            },
          ],
        },
      },
    ];
    if (frameArtifact === undefined) {
      artifactWrites.push({ key: "productFrame", value: frame });
    }
    if (contextArtifact === undefined) {
      artifactWrites.push({ key: "designContext", value: context });
    }
    await this.sessions.commit(updated, artifactWrites);
    return {
      ...route,
      ...(acceptingScopeGap ? { status: "WARN" as const } : {}),
      phase: updated.phase,
      next: advances ? nextTool("design_inspect") : nextTool("design_context"),
    };
  }

  private derivedFrame(
    understanding: ExistingUnderstanding | undefined,
    confirmation: RequirementConfirmation | undefined,
  ): ProductFrame {
    if (understanding === undefined || confirmation === undefined) {
      throw new PraxRuntimeError(
        "ROUTING_INPUTS_MISSING",
        "Routing requires product_frame/design_context artifacts or an existing-understanding plus requirement-confirmation pair to derive them.",
      );
    }
    return ProductFrameSchema.parse({
      user: { primary_role: "existing product user", expertise: "mixed", familiarity: "unknown" },
      goal: { primary: confirmation.restatement },
      tasks: { primary: understanding.change_targets.join(", ") || "modify surface", secondary: [] },
      product_objects: understanding.current_objects.map((object) => ({
        id: object.id,
        user_name: object.user_name,
        purpose: object.purpose,
      })),
      relationships: [],
      mental_model_hypothesis: { summary: "derived from existing understanding", confidence: "medium", evidence: ["existing_product"] },
      primary_success_definition: "the change preserves the existing product model",
      open_questions: [],
    });
  }

  private derivedContext(
    understanding: ExistingUnderstanding | undefined,
    confirmation: RequirementConfirmation | undefined,
    authorities: string[],
  ): DesignContext {
    if (understanding === undefined || confirmation === undefined) {
      throw new PraxRuntimeError(
        "ROUTING_INPUTS_MISSING",
        "Routing requires product_frame/design_context artifacts or an existing-understanding plus requirement-confirmation pair to derive them.",
      );
    }
    if (understanding.surface_context === undefined) {
      throw new PraxRuntimeError(
        "ROUTING_INPUTS_INCOMPLETE",
        "Derived routing requires surface_context on the existing understanding; unknown facts must stay unknown, not default to regular/none.",
      );
    }
    const surfaceContext = understanding.surface_context;
    return DesignContextSchema.parse({
      user: { expertise: surfaceContext.user_expertise, familiarity: "unknown" },
      task: { primary: understanding.change_targets.join(", ") || "modify", modes: ["modify"], frequency: surfaceContext.task_frequency },
      domain: {
        type: understanding.current_surfaces.map((surface) => surface.id).join(", ") || "existing product",
        entities: understanding.current_objects.map((object) => object.id),
      },
      information: { volume: "unknown", relationship_complexity: "unknown", change_rate: "low", comparison_need: "unknown" },
      platform: { family: "web", form_factor: "desktop", input: ["pointer", "keyboard"], viewport: "large" },
      risk: { destructive_actions: surfaceContext.destructive_actions, error_cost: "medium" },
      priorities: ["preserve existing habits", ...authorities.slice(0, 2)],
      density_intent: surfaceContext.density,
      confidence: { overall: "medium" },
      unknowns: [],
    });
  }

  public async designInspect(input: DesignInspectInput): Promise<PraxOutput> {
    const session = await this.sessions.getSession(input.design_session_id);
    const blocked = operationBlock(session, "design_inspect");
    if (blocked !== undefined) return blocked;
    const authorized = this.disclosureGate.authorize(session, input.ids, input.depth, input.purpose);
    if (authorized.status !== "PASS") return { ...authorized };
    const now = this.sessions.nowIso();
    const knowledge = input.ids.map((id) => this.knowledge.inspect(id, input.depth));
    const additions = input.ids.map((id) => ({
      knowledge_id: id,
      depth: input.depth,
      trigger: `${input.purpose.kind}: ${input.purpose.question}`,
      disclosed_at: now,
    }));
    await this.sessions.commit(
      { ...touch(session, now), disclosures: [...session.disclosures, ...additions] },
    );
    return {
      status: "PASS",
      depth: input.depth,
      knowledge,
      next: nextTool(input.depth === "L0" ? "design_inspect" : "design_decide"),
    };
  }

  public async designDecide(input: DesignDecideInput): Promise<PraxOutput> {
    const session = await this.sessions.getSession(input.design_session_id);
    const blocked = operationBlock(session, "design_decide");
    if (blocked !== undefined) return blocked;
    const routedPatternIds = new Set(
      session.routing_history
        .flatMap((record) => record.selected_ids)
        .filter((id) => this.knowledge.get(id)?.type === "pattern"),
    );
    const depthRank: Record<DisclosureDepth, number> = { L0: 0, L1: 1, L2: 2, L3: 3 };
    const inspectedAtLeastL1 = new Set(
      session.disclosures.filter((record) => depthRank[record.depth] >= 1).map((record) => record.knowledge_id),
    );
    const context = await this.requireArtifact<DesignContext>(session, "designContext");
    const frame = await this.requireArtifact<ProductFrame>(session, "productFrame");
    const validation = validateDesignDecisions(input.design_decisions, {
      sessionId: session.id,
      routedPatternIds,
      inspectedAtLeastL1,
      plausibleAlternativeCount: routedPatternIds.size,
      frame,
      context,
      patternSurfaces: patternSurfaceContract(input.design_decisions.primary_structure.pattern),
    });
    if (validation.value !== undefined && validation.value.density.intent !== context.density_intent) {
      validation.codes?.push("DECISION_DENSITY_MISMATCH");
      validation.issues.push("Decision density intent must match Design Context or record an explicit context revision.");
      validation.status = "EXPAND";
    }
    if (validation.status !== "PASS" && validation.status !== "WARN") {
      return {
        status: validation.status,
        conflicts: validation.issues,
        codes: validation.codes ?? [],
        warnings: validation.warnings,
        required_expansions: validation.issues,
        next: nextTool("design_inspect"),
      };
    }
    const updated = advanceSession(session, "decide", this.sessions.nowIso());
    await this.sessions.commit(updated, [{ key: "designDecisions", value: validation.value }]);
    return {
      status: validation.status,
      conflicts: [],
      warnings: validation.warnings,
      required_expansions: [],
      phase: updated.phase,
      next: nextTool("design_sdir"),
    };
  }

  public async designSdir(input: DesignSdirInput): Promise<PraxOutput> {
    const session = await this.sessions.getSession(input.design_session_id);
    const sdirDone = session.completed_gates.includes("sdir") || session.completed_gates.includes("sdir_delta");
    if (input.mode === "validate" && input.sdir !== undefined && sdirDone) {
      const decisions = await this.requireArtifact<DesignDecisions>(session, "designDecisions");
      const validation = this.sdirEngine.validate(input.sdir, decisions);
      return {
        status: validation.status,
        schema_errors: validation.schema_errors,
        semantic_errors: validation.semantic_errors,
        semantic_issues: validation.semantic_issues,
        warnings: validation.warnings,
        phase: session.phase,
      };
    }
    const blocked = operationBlock(session, "design_sdir");
    if (blocked !== undefined) return blocked;
    if (currentGate(session) === "sdir_delta") {
      if (input.sdir_delta === undefined || input.mode !== "apply_delta") {
        return {
          status: "RETRY",
          issues: ["The sdir_delta gate expects mode apply_delta with a sdir_delta payload."],
          next: nextTool("design_sdir"),
        };
      }
      const validation = validateSdirDelta(input.sdir_delta);
      if (validation.status !== "PASS") {
        return {
          status: validation.status,
          schema_errors: validation.schema_errors,
          semantic_errors: validation.semantic_errors,
          semantic_issues: validation.semantic_issues,
          warnings: [],
          next: nextTool("design_sdir"),
        };
      }
      const gateUnderstanding =
        (await this.sessions.readArtifact<ExistingUnderstanding>(session, "existingUnderstanding")) ?? undefined;
      if (
        gateUnderstanding !== undefined &&
        !gateUnderstanding.current_surfaces.some((surface) => surface.id === validation.value!.surface)
      ) {
        return {
          status: "REVIEW",
          code: "LIFECYCLE_KIND_MISMATCH",
          issues: [
            `sdir_delta targets surface '${validation.value!.surface}' which is not in the existing understanding; building a new surface is add_surface work, and changing the product model is rework. Restart the session with the matching change_kind.`,
          ],
          next: nextTool("design_sdir"),
        };
      }
      let policy = sessionPolicy(session);
      if (validation.value!.capability_needs.length > 0 && !policy.gates.includes("reconcile")) {
        const gates = [...policy.gates];
        gates.splice(gates.indexOf("prepare"), 0, "reconcile");
        policy = { ...policy, gates };
      }
      const updated = advanceSession({ ...session, lifecycle_policy: policy }, "sdir_delta", this.sessions.nowIso());
      await this.sessions.commit(updated, [{ key: "sdirDelta", value: validation.value }]);
      return {
        status: "PASS",
        sdir_delta: validation.value,
        phase: updated.phase,
        next: nextTool(NEXT_TOOL_BY_GATE[currentGate(updated)]),
      };
    }
    const decisions = await this.requireArtifact<DesignDecisions>(session, "designDecisions");
    const frame = await this.requireArtifact<ProductFrame>(session, "productFrame");
    const context = await this.requireArtifact<DesignContext>(session, "designContext");
    const candidate = input.mode === "generate_from_decisions"
      ? this.sdirEngine.generate(frame, context, decisions)
      : input.sdir;
    const validation = this.sdirEngine.validate(candidate, decisions);
    if (validation.status !== "PASS" || validation.value === undefined) {
      return {
        status: validation.status,
        schema_errors: validation.schema_errors,
        semantic_errors: validation.semantic_errors,
        semantic_issues: validation.semantic_issues,
        warnings: validation.warnings,
        next: nextTool("design_sdir"),
      };
    }
    const updated = advanceSession(session, "sdir", this.sessions.nowIso());
    await this.sessions.commit(updated, [{ key: "sdir", value: validation.value }]);
    return {
      status: "PASS",
      schema_errors: [],
      semantic_errors: [],
      sdir: validation.value,
      phase: updated.phase,
      next: nextTool("design_reconcile"),
    };
  }

  public async designReconcile(input: DesignReconcileInput): Promise<PraxOutput> {
    const session = await this.sessions.getSession(input.design_session_id);
    const blocked = operationBlock(session, "design_reconcile");
    if (blocked !== undefined) return blocked;
    const validation = validateCapabilityMap(input.capability_map);
    if (validation.status !== "PASS" && validation.status !== "WARN") {
      return {
        status: validation.status,
        gaps: validation.issues,
        required_decisions: validation.issues,
        warnings: validation.warnings,
        next: nextTool("design_reconcile"),
      };
    }
    const updated = advanceSession(session, "reconcile", this.sessions.nowIso());
    await this.sessions.commit(updated, [{ key: "capabilityGaps", value: validation.value }]);
    return {
      status: validation.status,
      gaps: validation.value?.needs.filter((need) => need.status === "gap") ?? [],
      required_decisions: [],
      warnings: validation.warnings,
      phase: updated.phase,
      next: nextTool("design_prepare_implementation"),
    };
  }

  public async designPrepareImplementation(input: DesignPrepareImplementationInput): Promise<PraxOutput> {
    const session = await this.sessions.getSession(input.design_session_id);
    const blocked = operationBlock(session, "design_prepare_implementation");
    if (blocked !== undefined) return blocked;
    const policy = sessionPolicy(session);
    const decisions = await this.requireArtifact<DesignDecisions>(session, "designDecisions");
    const sdirArtifact = (await this.sessions.readArtifact<Sdir>(session, "sdir")) ?? undefined;
    const deltaArtifact = (await this.sessions.readArtifact<import("prax-sdir").SdirDelta>(session, "sdirDelta")) ?? undefined;
    const understanding = (await this.sessions.readArtifact<ExistingUnderstanding>(session, "existingUnderstanding")) ?? undefined;
    const capabilityMap = policy.gates.includes("reconcile")
      ? await this.requireArtifact<CapabilityMap>(session, "capabilityGaps")
      : { needs: [] as CapabilityMap["needs"] };
    const states = sdirArtifact?.screen.required_states ?? ["loading", "empty", "ready", "error"];
    const validationPlan = await this.validationPlanFor(session);

    let modePlan: Record<string, unknown> | undefined;
    if (policy.mode === "rework" && understanding !== undefined) {
      modePlan = {
        migration_plan: {
          user_transition: understanding.migration_notes,
          data: understanding.must_preserve,
          per_surface: [
            ...understanding.must_preserve.map((item) => ({ surface: item, treatment: "preserve" })),
            ...understanding.must_replace.map((item) => ({ surface: item, treatment: "rework" })),
            ...understanding.free_to_reconsider.map((item) => ({ surface: item, treatment: "rework" })),
          ],
        },
      };
    } else if (policy.change_kind === "add_surface" && understanding !== undefined) {
      modePlan = {
        integration_plan: {
          alignment_points: understanding.established_patterns,
          neighbors: understanding.change_targets,
          implementation_order: understanding.current_surfaces.map((surface) => surface.id),
        },
      };
    } else if (policy.change_kind === "modify_surface" && deltaArtifact !== undefined) {
      modePlan = {
        change_sequence: deltaArtifact.changes.map((change) => ({
          region: change.region,
          action: change.action,
          rationale: change.rationale,
        })),
        regression_points: deltaArtifact.regression_points,
      };
    }

    const implementationBrief = {
      version: "0.1",
      platform_profile: "WEB-DESKTOP",
      framework: input.framework,
      sdir_ref: sdirArtifact !== undefined ? "screen.sdir.yaml" : "sdir-delta.yaml",
      decision_ref: "design-decisions.yaml",
      approved_patterns: [decisions.primary_structure.pattern],
      approved_component_contracts: this.componentContracts(decisions.primary_structure.pattern),
      states_required: states,
      capability_gaps: capabilityMap.needs.filter((need) => need.status === "gap" || need.status === "blocked"),
      validation_requirements: validationPlan.checks.map((check) => check.id),
      ...(modePlan === undefined ? {} : { mode_plan: modePlan }),
    };
    const updated = advanceSession(session, "prepare", this.sessions.nowIso());
    await this.sessions.commit(updated, [{ key: "implementationBrief", value: implementationBrief }]);
    return {
      status: "PASS",
      implementation_brief: implementationBrief,
      phase: updated.phase,
      next: nextTool("design_validate"),
    };
  }

  private async validationPlanFor(session: DesignSession): Promise<ValidationPlan> {
    const policy = sessionPolicy(session);
    const understanding =
      (await this.sessions.readArtifact<ExistingUnderstanding>(session, "existingUnderstanding")) ?? undefined;
    const authorities = [
      ...new Set([...session.design_authorities, ...(understanding?.design_authorities ?? [])]),
    ];
    return this.validator.plan({
      policyContext: {
        mode: session.mode,
        ...(policy.change_kind === undefined ? {} : { change_kind: policy.change_kind }),
        authorities,
      },
      frame: (await this.sessions.readArtifact<ProductFrame>(session, "productFrame")) ?? undefined,
      context: (await this.sessions.readArtifact<DesignContext>(session, "designContext")) ?? undefined,
      decisions: (await this.sessions.readArtifact<DesignDecisions>(session, "designDecisions")) ?? undefined,
      intentLite: (await this.sessions.readArtifact<IntentLite>(session, "intentLite")) ?? undefined,
    });
  }

  public async designValidate(input: DesignValidateInput): Promise<PraxOutput> {
    const session = await this.sessions.getSession(input.design_session_id);
    const blocked = operationBlock(session, "design_validate");
    if (blocked !== undefined) return blocked;
    const prior = await this.sessions.readArtifact<ValidationReportArtifact>(session, "validationReport");
    const plan = prior === undefined
      ? await this.validationPlanFor(session)
      : ValidationPlanSchema.parse(prior.plan);

    if (input.mode === "plan") {
      await this.sessions.commit(touch(session, this.sessions.nowIso()), [
        { key: "validationReport", value: { plan, ...(prior?.evidence === undefined ? {} : { evidence: prior.evidence }) } },
      ]);
      return { status: "EXPAND", checks: plan.checks, findings: [], missing_evidence: plan.checks.filter((check) => check.evidence_required).map((check) => check.id), next: nextTool("design_validate") };
    }

    if (input.mode === "submit_evidence") {
      if (input.evidence === undefined) {
        return { status: "RETRY", code: "VALIDATION_EVIDENCE_REQUIRED", checks: plan.checks, findings: [], missing_evidence: plan.checks.filter((check) => check.evidence_required).map((check) => check.id) };
      }
      const evidence = this.validator.parseEvidence(input.evidence);
      await this.sessions.commit(touch(session, this.sessions.nowIso()), [
        { key: "validationReport", value: { plan, evidence } },
      ]);
      return { status: "PASS", checks: plan.checks, findings: [], missing_evidence: [], next: nextTool("design_validate") };
    }

    const evidence = input.evidence ?? prior?.evidence;
    const sdirArtifact = (await this.sessions.readArtifact<Sdir>(session, "sdir")) ?? undefined;
    const sdirDeltaArtifact = (await this.sessions.readArtifact<SdirDelta>(session, "sdirDelta")) ?? undefined;
    const decisionsArtifact = (await this.sessions.readArtifact<DesignDecisions>(session, "designDecisions")) ?? undefined;
    const evaluation = this.validator.evaluate({
      plan,
      ...(sdirArtifact === undefined ? {} : { sdir: sdirArtifact }),
      ...(sdirDeltaArtifact === undefined ? {} : { sdirDelta: sdirDeltaArtifact }),
      ...(decisionsArtifact === undefined ? {} : { decisions: decisionsArtifact }),
      ...(evidence === undefined ? {} : { evidence }),
    });
    const now = this.sessions.nowIso();
    const updated = evaluation.status === "PASS"
      ? { ...advanceSession(session, "validate", now), phase: "COMPLETE" as const, current_gate: { name: "complete" } }
      : touch(session, now);
    await this.sessions.commit(updated, [
      { key: "validationReport", value: { plan, ...(evidence === undefined ? {} : { evidence }), evaluation } },
    ]);
    return {
      ...evaluation,
      phase: updated.phase,
      ...(evaluation.status === "PASS" ? {} : { next: nextTool("design_validate") }),
    };
  }

  public async inspectSession(sessionId: string): Promise<Record<string, unknown>> {
    const session = await this.sessions.getSession(sessionId);
    return { session, artifact_directory: await this.sessions.artifactDirectory(sessionId) };
  }

  private async requireArtifact<T>(session: DesignSession, key: Parameters<FileSessionStore["readArtifact"]>[1]): Promise<T> {
    const artifact = await this.sessions.readArtifact<T>(session, key);
    if (artifact === undefined) throw new Error(`Required artifact '${key}' is missing for ${session.id}.`);
    return artifact;
  }

  private componentContracts(pattern: string): string[] {
    if (pattern === "PAT-CANVAS-WORKSPACE") return ["ARCHITECTURE-CANVAS", "CONTEXTUAL-INSPECTOR", "CANVAS-TOOLBAR", "STATE-FEEDBACK"];
    if (pattern === "PAT-DATA-EXPLORER") return ["DATA-SURFACE", "FILTER-CONTROLS", "CONTEXTUAL-DETAIL"];
    if (pattern === "PAT-SETTINGS-SECTIONS") return ["SETTINGS-NAVIGATION", "SETTINGS-SECTION", "CHANGE-FEEDBACK"];
    return ["WORKSPACE", "STATE-FEEDBACK"];
  }
}

export type { RoutingResult };
