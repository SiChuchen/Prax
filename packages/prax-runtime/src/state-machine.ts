import type { DesignPhase, DesignSession, GateResult } from "./contracts.js";

export const DESIGN_OPERATIONS = [
  "design_frame",
  "design_context",
  "design_route",
  "design_inspect",
  "design_decide",
  "design_sdir",
  "design_reconcile",
  "design_prepare_implementation",
  "design_validate",
] as const;

export type DesignOperation = (typeof DESIGN_OPERATIONS)[number];

const ALLOWED_PHASES: Record<DesignOperation, readonly DesignPhase[]> = {
  design_frame: ["PRODUCT_FRAMING"],
  design_context: ["CONTEXT"],
  design_route: ["ROUTING", "DECISION"],
  design_inspect: ["DECISION"],
  design_decide: ["DECISION"],
  design_sdir: ["SDIR", "CAPABILITY_RECONCILIATION", "IMPLEMENTATION_READY", "VALIDATION", "COMPLETE"],
  design_reconcile: ["CAPABILITY_RECONCILIATION"],
  design_prepare_implementation: ["IMPLEMENTATION_READY"],
  design_validate: ["VALIDATION", "COMPLETE"],
};

export const PHASE_AFTER_PASS: Partial<Record<DesignOperation, DesignPhase>> = {
  design_frame: "CONTEXT",
  design_context: "ROUTING",
  design_route: "DECISION",
  design_decide: "SDIR",
  design_sdir: "CAPABILITY_RECONCILIATION",
  design_reconcile: "IMPLEMENTATION_READY",
  design_prepare_implementation: "VALIDATION",
};

const NEXT_TOOL_BY_PHASE: Partial<Record<DesignPhase, string>> = {
  PRODUCT_FRAMING: "design_frame",
  CONTEXT: "design_context",
  ROUTING: "design_route",
  DECISION: "design_decide",
  SDIR: "design_sdir",
  CAPABILITY_RECONCILIATION: "design_reconcile",
  IMPLEMENTATION_READY: "design_prepare_implementation",
  VALIDATION: "design_validate",
};

export function checkOperationAllowed(
  session: DesignSession,
  operation: DesignOperation,
): GateResult | undefined {
  const allowed = ALLOWED_PHASES[operation];
  if (allowed.includes(session.phase)) {
    return undefined;
  }

  const requiredTool = NEXT_TOOL_BY_PHASE[session.phase];
  return {
    status: "BLOCK",
    code: "GATE_NOT_SATISFIED",
    message: `${operation} is not legal while session ${session.id} is in ${session.phase}.`,
    ...(requiredTool === undefined ? {} : { next: { tool: requiredTool } }),
  };
}

export function advanceSession(
  session: DesignSession,
  operation: DesignOperation,
  now: string,
): DesignSession {
  const nextPhase = PHASE_AFTER_PASS[operation];
  if (nextPhase === undefined || nextPhase === session.phase) {
    return {
      ...session,
      updated_at: now,
      revision: session.revision + 1,
    };
  }

  const completedGate = operation.replace(/^design_/, "");
  return {
    ...session,
    phase: nextPhase,
    updated_at: now,
    revision: session.revision + 1,
    completed_gates: session.completed_gates.includes(completedGate)
      ? session.completed_gates
      : [...session.completed_gates, completedGate],
    current_gate: {
      name: nextPhase.toLowerCase(),
    },
  };
}
