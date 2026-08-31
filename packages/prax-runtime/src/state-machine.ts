import type { DesignSession, GateName, GateResult, LifecyclePolicy } from "./contracts.js";
import { DEFAULT_LEGACY_POLICY, GATE_PHASE, NEXT_TOOL_BY_GATE, normalizeCompletedGates } from "./lifecycle-policy.js";

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

const OPERATION_GATES: Record<DesignOperation, GateName[]> = {
  design_frame: ["understanding", "framing", "intent_lite"],
  design_context: ["context"],
  design_route: ["route"],
  design_inspect: ["decide"],
  design_decide: ["decide"],
  design_sdir: ["sdir", "sdir_delta"],
  design_reconcile: ["reconcile"],
  design_prepare_implementation: ["prepare"],
  design_validate: ["validate"],
};

export function sessionPolicy(session: DesignSession): LifecyclePolicy {
  return session.lifecycle_policy ?? DEFAULT_LEGACY_POLICY;
}

export function currentGate(session: DesignSession): GateName {
  const done = new Set(normalizeCompletedGates(session.completed_gates));
  return sessionPolicy(session).gates.find((gate) => !done.has(gate)) ?? "validate";
}

export function checkOperationAllowed(session: DesignSession, operation: DesignOperation): GateResult | undefined {
  const gate = currentGate(session);
  if (OPERATION_GATES[operation].includes(gate)) {
    return undefined;
  }

  return {
    status: "BLOCK",
    code: "GATE_NOT_SATISFIED",
    message: `${operation} is not legal while session ${session.id} is at the '${gate}' gate (${sessionPolicy(session).mode}).`,
    next: { tool: NEXT_TOOL_BY_GATE[gate] },
  };
}

export function advanceSession(session: DesignSession, gate: GateName, now: string): DesignSession {
  const normalized = normalizeCompletedGates(session.completed_gates);
  const completed = normalized.includes(gate) ? normalized : [...normalized, gate];
  const next = sessionPolicy(session).gates.find((candidate) => !completed.includes(candidate));
  return {
    ...session,
    phase: next === undefined ? session.phase : GATE_PHASE[next],
    updated_at: now,
    revision: session.revision + 1,
    completed_gates: completed,
    current_gate: { name: next ?? "complete" },
  };
}

/**
 * Rewind a session so that `targetGate` is the current (incomplete) gate
 * again, dropping every later completion. Used by design_context revision:
 * the mis-classified-context trap (PRAX-WIZARD-001 first session) previously
 * forced a whole new session because gates were one-way.
 */
export function rewindSession(session: DesignSession, targetGate: GateName, now: string): DesignSession {
  const gates = sessionPolicy(session).gates;
  const targetIndex = gates.indexOf(targetGate);
  const completed = gates.slice(0, targetIndex < 0 ? gates.length : targetIndex);
  return {
    ...session,
    phase: GATE_PHASE[targetGate],
    updated_at: now,
    revision: session.revision + 1,
    completed_gates: completed,
    current_gate: { name: targetGate },
  };
}
