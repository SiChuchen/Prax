import type { DisclosureDepth, DesignSession, GateResult } from "prax-runtime";

const L2_REASON = /(decid|select|reject|compar|conflict|rationale|trade.?off|选择|拒绝|比较|冲突|理由|权衡)/i;
const L3_REASON = /(evidence|source|dispute|review|verify|audit|证据|来源|争议|审查|验证|核验)/i;

export class DisclosureGate {
  public authorize(
    session: DesignSession,
    ids: readonly string[],
    depth: DisclosureDepth,
    reason: string,
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
    if (reason.trim().length === 0) {
      return { status: "RETRY", code: "INSPECTION_REASON_REQUIRED", message: "A decision-specific inspection reason is required." };
    }
    if (depth === "L2" && !L2_REASON.test(reason)) {
      return { status: "BLOCK", code: "L2_REASON_INSUFFICIENT", message: "L2 requires a selection, rejection, comparison, conflict, rationale, or trade-off reason." };
    }
    if (depth === "L3" && !L3_REASON.test(reason)) {
      return { status: "BLOCK", code: "L3_REASON_INSUFFICIENT", message: "L3 is reserved for evidence, source verification, dispute, audit, or review." };
    }
    return { status: "PASS", data: { authorized_ids: [...ids] } };
  }
}

