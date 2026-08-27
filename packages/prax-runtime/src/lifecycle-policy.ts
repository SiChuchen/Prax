import type { ChangeKind, DesignMode, DesignPhase, GateName, LifecyclePolicy } from "./contracts.js";
import { PraxRuntimeError } from "./errors.js";

const FULL_TAIL: GateName[] = ["context", "route", "decide", "sdir", "reconcile", "prepare", "validate"];
const REWORK_TAIL: GateName[] = FULL_TAIL;

export const DEFAULT_LEGACY_POLICY: LifecyclePolicy = {
  version: "1",
  mode: "greenfield",
  gates: ["framing", ...FULL_TAIL],
};

export const GATE_PHASE: Record<GateName, DesignPhase> = {
  confirm: "REQUIREMENT_CONFIRMATION",
  understanding: "UNDERSTANDING",
  framing: "PRODUCT_FRAMING",
  intent_lite: "INTENT_LITE",
  context: "CONTEXT",
  route: "ROUTING",
  decide: "DECISION",
  sdir: "SDIR",
  sdir_delta: "SDIR",
  reconcile: "CAPABILITY_RECONCILIATION",
  realize: "REALIZATION",
  prepare: "IMPLEMENTATION_READY",
  validate: "VALIDATION",
};

export const NEXT_TOOL_BY_GATE: Record<GateName, string> = {
  confirm: "design_start",
  understanding: "design_frame",
  framing: "design_frame",
  intent_lite: "design_frame",
  context: "design_context",
  route: "design_route",
  decide: "design_inspect",
  sdir: "design_sdir",
  sdir_delta: "design_sdir",
  reconcile: "design_reconcile",
  realize: "design_realize",
  prepare: "design_prepare_implementation",
  validate: "design_validate",
};

const LEGACY_GATE_ALIASES: Record<string, GateName> = {
  frame: "framing",
  prepare_implementation: "prepare",
  validation: "validate",
};

export function normalizeCompletedGates(completed: readonly string[]): GateName[] {
  return completed.map((gate) => LEGACY_GATE_ALIASES[gate] ?? (gate as GateName));
}

export function lifecyclePolicyFor(mode: DesignMode, changeKind?: ChangeKind): LifecyclePolicy {
  if (mode === "greenfield") {
    if (changeKind !== undefined) {
      throw new PraxRuntimeError(
        "UNKNOWN_LIFECYCLE_POLICY",
        `change_kind ${changeKind} is not valid for greenfield sessions.`,
      );
    }
    return { version: "2", mode, gates: ["confirm", "framing", ...FULL_TAIL] };
  }
  if (mode === "existing_product") {
    if (changeKind === undefined) {
      throw new PraxRuntimeError(
        "UNKNOWN_LIFECYCLE_POLICY",
        "existing_product sessions require change_kind (add_surface | modify_surface | visual_polish | defect_fix).",
      );
    }
    const gatesByKind: Record<ChangeKind, GateName[]> = {
      add_surface: ["confirm", "understanding", "framing", ...FULL_TAIL],
      modify_surface: ["confirm", "understanding", "route", "decide", "sdir_delta", "prepare", "validate"],
      visual_polish: ["confirm", "understanding", "intent_lite", "validate"],
      defect_fix: ["confirm", "understanding", "intent_lite", "validate"],
    };
    return { version: "2", mode, change_kind: changeKind, gates: gatesByKind[changeKind] };
  }
  return {
    version: "2",
    mode,
    ...(changeKind === undefined ? {} : { change_kind: changeKind }),
    gates: ["confirm", "understanding", "framing", ...REWORK_TAIL],
  };
}
