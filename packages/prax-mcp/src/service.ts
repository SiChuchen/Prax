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
  validateCapabilityMap,
  validateDesignContext,
  validateDesignDecisions,
  validateProductFrame,
  type CapabilityMap,
  type DesignContext,
  type DesignDecisions,
  type DesignOperation,
  type DesignSession,
  type GateStatus,
  type ProductFrame,
} from "prax-runtime";
import { patternSurfaceContract, SdirEngine, SdirSchema, type Sdir } from "prax-sdir";
import {
  PraxValidator,
  ValidationPlanSchema,
  type ValidationEvidence,
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
    const session = await this.sessions.createSession({
      projectRoot: input.project_root,
      requirement: input.requirement,
      mode: input.mode,
      ...(input.project_id === undefined ? {} : { projectId: input.project_id }),
    });
    return {
      status: "PASS",
      design_session_id: session.id,
      phase: session.phase,
      next: nextTool("design_frame"),
      required: ["user", "goal", "primary_task", "product_objects"],
    };
  }

  public async designFrame(input: DesignFrameInput): Promise<PraxOutput> {
    const session = await this.sessions.getSession(input.design_session_id);
    const blocked = operationBlock(session, "design_frame");
    if (blocked !== undefined) return blocked;
    const validation = validateProductFrame(input.product_frame, session.mode);
    if (validation.status !== "PASS" && validation.status !== "WARN") {
      return {
        status: validation.status,
        missing_or_uncertain: validation.issues,
        warnings: validation.warnings,
        next: nextTool("design_frame"),
      };
    }
    const updated = advanceSession(session, "design_frame", this.sessions.nowIso());
    await this.sessions.commit(updated, [{ key: "productFrame", value: validation.value }]);
    return {
      status: validation.status,
      missing_or_uncertain: [],
      warnings: validation.warnings,
      phase: updated.phase,
      next: nextTool("design_context"),
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
    const updated = advanceSession(session, "design_context", this.sessions.nowIso());
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
    const frame = await this.requireArtifact<ProductFrame>(session, "productFrame");
    const context = await this.requireArtifact<DesignContext>(session, "designContext");
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
    const phaseUpdated = advances ? advanceSession(session, "design_route", now) : touch(session, now);
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
    };
    const priorLog = (await this.sessions.readArtifact<{ events?: unknown[] }>(session, "routingLog")) ?? {};
    await this.sessions.commit(updated, [
      { key: "routingLog", value: { version: "0.1", events: [...(priorLog.events ?? []), { question: input.question, routed_at: now, result: route, ...(acceptingScopeGap ? { scope_gap_accepted: input.accept_scope_gap } : {}) }] } },
    ]);
    return {
      ...route,
      ...(acceptingScopeGap ? { status: "WARN" as const } : {}),
      phase: updated.phase,
      next: advances ? nextTool("design_inspect") : nextTool("design_context"),
    };
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
    const updated = advanceSession(session, "design_decide", this.sessions.nowIso());
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
    const blocked = operationBlock(session, "design_sdir");
    if (blocked !== undefined) return blocked;
    const decisions = await this.requireArtifact<DesignDecisions>(session, "designDecisions");
    const frame = await this.requireArtifact<ProductFrame>(session, "productFrame");
    const context = await this.requireArtifact<DesignContext>(session, "designContext");
    if (input.mode === "generate_from_decisions" && session.phase !== "SDIR") {
      return {
        status: "BLOCK",
        code: "GATE_NOT_SATISFIED",
        message: "generate_from_decisions is only legal in the SDIR phase; regeneration would invalidate downstream artifacts. Use mode validate to check a candidate without advancing.",
      };
    }
    if (input.mode === "validate" && session.phase !== "SDIR") {
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
    const updated = advanceSession(session, "design_sdir", this.sessions.nowIso());
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
    const updated = advanceSession(session, "design_reconcile", this.sessions.nowIso());
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
    const frame = await this.requireArtifact<ProductFrame>(session, "productFrame");
    const context = await this.requireArtifact<DesignContext>(session, "designContext");
    const decisions = await this.requireArtifact<DesignDecisions>(session, "designDecisions");
    const sdir = SdirSchema.parse(await this.requireArtifact<Sdir>(session, "sdir"));
    const capabilityMap = await this.requireArtifact<CapabilityMap>(session, "capabilityGaps");
    const validationPlan = this.validator.plan(frame, context, decisions);
    const implementationBrief = {
      version: "0.1",
      platform_profile: "WEB-DESKTOP",
      framework: input.framework,
      sdir_ref: "screen.sdir.yaml",
      decision_ref: "design-decisions.yaml",
      approved_patterns: [decisions.primary_structure.pattern],
      approved_component_contracts: this.componentContracts(decisions.primary_structure.pattern),
      states_required: sdir.screen.required_states,
      capability_gaps: capabilityMap.needs.filter((need) => need.status === "gap" || need.status === "blocked"),
      validation_requirements: validationPlan.checks.map((check) => check.id),
    };
    const updated = advanceSession(session, "design_prepare_implementation", this.sessions.nowIso());
    await this.sessions.commit(updated, [{ key: "implementationBrief", value: implementationBrief }]);
    return {
      status: "PASS",
      implementation_brief: implementationBrief,
      phase: updated.phase,
      next: nextTool("design_validate"),
    };
  }

  public async designValidate(input: DesignValidateInput): Promise<PraxOutput> {
    const session = await this.sessions.getSession(input.design_session_id);
    const blocked = operationBlock(session, "design_validate");
    if (blocked !== undefined) return blocked;
    const frame = await this.requireArtifact<ProductFrame>(session, "productFrame");
    const context = await this.requireArtifact<DesignContext>(session, "designContext");
    const decisions = await this.requireArtifact<DesignDecisions>(session, "designDecisions");
    const sdir = SdirSchema.parse(await this.requireArtifact<Sdir>(session, "sdir"));
    const prior = await this.sessions.readArtifact<ValidationReportArtifact>(session, "validationReport");
    const plan = prior === undefined
      ? this.validator.plan(frame, context, decisions)
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
    const evaluation = this.validator.evaluate({ plan, sdir, decisions, ...(evidence === undefined ? {} : { evidence }) });
    const now = this.sessions.nowIso();
    const updated = evaluation.status === "PASS"
      ? {
          ...touch(session, now),
          phase: "COMPLETE" as const,
          completed_gates: session.completed_gates.includes("validation") ? session.completed_gates : [...session.completed_gates, "validation"],
          current_gate: { name: "complete" },
        }
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
