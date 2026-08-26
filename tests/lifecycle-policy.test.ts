import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_LEGACY_POLICY,
  DesignSessionSchema,
  FileSessionStore,
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

const cleanup: string[] = [];
afterEach(async () => {
  await Promise.all(cleanup.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("session policy persistence", () => {
  it("stores the policy snapshot, authorities, and starts at the first gate phase", async () => {
    const root = await mkdtemp(join(tmpdir(), "prax-policy-"));
    cleanup.push(root);
    const projectRoot = join(root, "project");
    await mkdir(projectRoot);
    const store = new FileSessionStore({ stateRoot: join(root, "state"), idGenerator: () => "ds_policy" });
    const session = await store.createSession({
      projectRoot,
      requirement: "Rework the console",
      mode: "rework",
      lifecyclePolicy: lifecyclePolicyFor("rework"),
      designAuthorities: ["docs/DESIGN.md"],
    });
    expect(session.lifecycle_policy?.gates[0]).toBe("confirm");
    expect(session.phase).toBe("REQUIREMENT_CONFIRMATION");
    expect(session.design_authorities).toEqual(["docs/DESIGN.md"]);
  });

  it("parses legacy sessions without policy or authorities", () => {
    const legacy = DesignSessionSchema.parse({
      id: "ds_old", project_root: "/tmp/p", mode: "greenfield", phase: "PRODUCT_FRAMING",
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(), revision: 1,
      requirement_ref: "requirement.md", completed_gates: [], current_gate: { name: "product_framing" },
      disclosures: [], routing_history: [], artifacts: {}, unresolved: [], warnings: [],
    });
    expect(legacy.lifecycle_policy).toBeUndefined();
    expect(legacy.design_authorities).toEqual([]);
  });
});
