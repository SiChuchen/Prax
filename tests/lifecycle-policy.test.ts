import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_LEGACY_POLICY,
  GATE_PHASE,
  NEXT_TOOL_BY_GATE,
  PraxRuntimeError,
  lifecyclePolicyFor,
  normalizeCompletedGates,
} from "prax-runtime";

const FULL_TAIL = ["context", "route", "decide", "sdir", "reconcile", "prepare", "validate"];
const REWORK_TAIL = ["context", "route", "decide", "sdir", "prepare", "validate"];

describe("lifecycle policy", () => {
  it("expands each supported mode and change kind into its gate sequence", () => {
    expect(lifecyclePolicyFor("greenfield").gates).toEqual(["confirm", "framing", ...FULL_TAIL]);
    expect(lifecyclePolicyFor("rework").gates).toEqual(["confirm", "understanding", "framing", ...REWORK_TAIL]);
    expect(lifecyclePolicyFor("existing_product", "add_surface").gates).toEqual(["confirm", "understanding", "framing", ...FULL_TAIL]);
    expect(lifecyclePolicyFor("existing_product", "modify_surface").gates).toEqual([
      "confirm", "understanding", "route", "decide", "sdir_delta", "prepare", "validate",
    ]);
    expect(lifecyclePolicyFor("existing_product", "visual_polish").gates).toEqual(["confirm", "intent_lite", "validate"]);
    expect(lifecyclePolicyFor("existing_product", "defect_fix").gates).toEqual(["confirm", "intent_lite", "validate"]);
  });

  it("rejects invalid combinations and preserves a rework change_kind hint", () => {
    expect(() => lifecyclePolicyFor("greenfield", "defect_fix")).toThrowError(PraxRuntimeError);
    expect(() => lifecyclePolicyFor("existing_product")).toThrowError(PraxRuntimeError);
    const rework = lifecyclePolicyFor("rework", "modify_surface");
    expect(rework.gates).toEqual(["confirm", "understanding", "framing", ...REWORK_TAIL]);
    expect(rework.change_kind).toBe("modify_surface");
  });

  it("keeps the legacy default policy equivalent to the old flow", () => {
    expect(DEFAULT_LEGACY_POLICY.gates).toEqual(["framing", ...FULL_TAIL]);
  });

  it("maps every gate to a phase and a next tool", () => {
    expect(GATE_PHASE.confirm).toBe("REQUIREMENT_CONFIRMATION");
    expect(GATE_PHASE.understanding).toBe("UNDERSTANDING");
    expect(GATE_PHASE.intent_lite).toBe("INTENT_LITE");
    expect(GATE_PHASE.sdir_delta).toBe("SDIR");
    for (const gate of DEFAULT_LEGACY_POLICY.gates) {
      expect(GATE_PHASE[gate]).toBeDefined();
      expect(NEXT_TOOL_BY_GATE[gate]).toBeDefined();
    }
  });

  it("normalizes legacy gate names recorded by the old state machine", () => {
    expect(
      normalizeCompletedGates([
        "frame", "context", "route", "decide", "sdir", "reconcile", "prepare_implementation", "validation",
      ]),
    ).toEqual(["framing", "context", "route", "decide", "sdir", "reconcile", "prepare", "validate"]);
    expect(normalizeCompletedGates(["framing", "validate"])).toEqual(["framing", "validate"]);
  });
});
