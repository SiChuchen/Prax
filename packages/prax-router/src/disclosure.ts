import type { DisclosureDepth, DesignSession, GateResult } from "prax-runtime";

export type DisclosurePurposeKind =
  | "compare_alternatives"
  | "resolve_conflict"
  | "validate_decision"
  | "investigate_risk";

export interface DisclosurePurpose {
  kind: DisclosurePurposeKind;
  target_ids: readonly string[];
  question: string;
}

const L3_KINDS = new Set<DisclosurePurposeKind>(["validate_decision", "investigate_risk"]);

export class DisclosureGate {
  public authorize(
    session: DesignSession,
    ids: readonly string[],
    depth: DisclosureDepth,
    purpose: DisclosurePurpose,
  ): GateResult<{ authorized_ids: string[] }> {
    if (ids.length === 0) {
      return { status: "RETRY", code: "EMPTY_INSPECTION", message: "At least one routed knowledge id is required." };
    }
    if (ids.length > 8) {
      return { status: "BLOCK", code: "KNOWLEDGE_DUMP_BLOCKED", message: "Inspection is capped at eight routed items per decision." };
    }
    const routed = new Set(session.routing_history.flatMap((record) => record.selected_ids));
    const unauthorized = ids.filter((id) => !routed.has(id));
    if (unauthorized.length > 0) {
      return {
        status: "BLOCK",
        code: "KNOWLEDGE_NOT_ROUTED",
        message: `Knowledge must be routed before inspection: ${unauthorized.join(", ")}`,
      };
    }
    if (purpose.question.trim().length === 0) {
      return { status: "RETRY", code: "INSPECTION_PURPOSE_REQUIRED", message: "A decision- or evidence-specific question is required." };
    }
    const unroutedTargets = purpose.target_ids.filter((id) => !routed.has(id));
    if (unroutedTargets.length > 0) {
      return {
        status: "BLOCK",
        code: "PURPOSE_TARGET_NOT_ROUTED",
        message: `Inspection purpose references unrouted knowledge: ${unroutedTargets.join(", ")}`,
      };
    }
    if (depth === "L2" && purpose.target_ids.length === 0) {
      return { status: "BLOCK", code: "L2_PURPOSE_INSUFFICIENT", message: "L2 requires a purpose naming the alternatives or conflicts being compared." };
    }
    if (depth === "L3" && !L3_KINDS.has(purpose.kind)) {
      return { status: "BLOCK", code: "L3_PURPOSE_INSUFFICIENT", message: "L3 is reserved for validate_decision or investigate_risk purposes; evidence depth is not for casual comparison." };
    }
    return { status: "PASS", data: { authorized_ids: [...ids] } };
  }
}
