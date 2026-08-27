# Figma-first Realization Path Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the `design_realize` tool (11th), the `realize` gate, and the representation artifacts that implement the figma_first realization path per spec `docs/superpowers/specs/2026-08-28-figma-realization-design.md` (r2).

**Architecture:** Realization is a payload-dispatched tool (`propose`/`submit_draft`/`submit_review`) for lifecycle-policy v2 full-SDIR sessions. `propose(figma_first)` splices a `realize` gate between reconcile and prepare (same dynamic-splice precedent as sdir_delta→reconcile); approval binds SDIR digest + screenshot digests; drift checks enter the revision-locked validation plan. Figma is one entry in a static versioned provider table — no generic registry, no Figma-specific schema coupling.

**Tech Stack:** TypeScript (tsc -b), zod, vitest (`npm test` = build + vitest run), YAML artifact store.

**Spec:** `docs/superpowers/specs/2026-08-28-figma-realization-design.md` (authoritative; sections cited as §N).

**Conventions:** Commit style follows repo (`feat(scope): …`, `docs: …`). Never push without user confirmation. Tests live in root `tests/`. All commands run from repo root `E:\codex-prj\Prax\Prax`.

---

### Task 1: Runtime contracts — realize gate, policy v2 union, realization schemas, artifact keys

**Files:**
- Modify: `packages/prax-runtime/src/contracts.ts`
- Modify: `packages/prax-runtime/src/artifact-store.ts` (ARTIFACT_SCHEMAS registration)
- Test: `tests/realization-contracts.test.ts` (new)

- [ ] **Step 1: Write the failing test**

```ts
// tests/realization-contracts.test.ts
import { describe, expect, it } from "vitest";
import {
  ARTIFACT_FILES,
  DesignSessionSchema,
  LifecyclePolicySchema,
  RealizationDecisionSchema,
  RepresentationArtifactSchema,
  RepresentationReviewSchema,
} from "prax-runtime";

describe("realization contracts", () => {
  it("accepts lifecycle policy v1 and v2 sessions", () => {
    const v1 = { version: "1", mode: "greenfield", gates: ["confirm", "framing", "context"] };
    const v2 = { version: "2", mode: "greenfield", gates: ["confirm", "framing", "context", "route", "decide", "sdir", "realize", "prepare", "validate"] };
    expect(LifecyclePolicySchema.parse(v1).version).toBe("1");
    expect(LifecyclePolicySchema.parse(v2).version).toBe("2");
    expect(LifecyclePolicySchema.safeParse({ version: "3", mode: "greenfield", gates: ["confirm"] }).success).toBe(false);
    const session = {
      id: "ds_x", project_root: "/tmp/p", mode: "greenfield", phase: "REALIZATION",
      created_at: "2026-08-28T00:00:00.000Z", updated_at: "2026-08-28T00:00:00.000Z",
      revision: 1, requirement_ref: "requirement.md", completed_gates: [], current_gate: { name: "realize" },
      artifacts: {}, lifecycle_policy: v2,
    };
    expect(DesignSessionSchema.safeParse(session).success).toBe(true);
  });

  it("registers the three realization artifact files", () => {
    expect(ARTIFACT_FILES.realizationDecision).toBe("realization-decision.yaml");
    expect(ARTIFACT_FILES.representationArtifact).toBe("representation-artifact.yaml");
    expect(ARTIFACT_FILES.representationReview).toBe("representation-review.yaml");
  });

  it("round-trips a realization decision", () => {
    const decision = RealizationDecisionSchema.parse({
      version: "0.1",
      realization_mode: "figma_first",
      provider: "figma",
      provider_contract_version: "remote-mcp-2026-08",
      conditions: [{ id: "greenfield", holds: true, basis: "session mode is greenfield" }],
      proposed_at: "2026-08-28T00:00:00.000Z",
      supersedes: { prior_mode: "direct_code", reason: "stakeholder wants visual approval" },
    });
    expect(decision.conditions).toHaveLength(1);
    expect(RealizationDecisionSchema.safeParse({ version: "0.1", realization_mode: "figma_first", conditions: [], proposed_at: "2026-08-28T00:00:00.000Z" }).success).toBe(false);
  });

  it("round-trips a representation artifact and review with history", () => {
    const artifact = RepresentationArtifactSchema.parse({
      version: "0.1",
      id: "rep-ds_x",
      representation: { role: "primary" },
      semantic_refs: { sdir_ref: "screen.sdir.yaml", sdir_digest: "abc", regions: ["hero"] },
      realization: { provider: "figma", provider_contract_version: "remote-mcp-2026-08", refs: null },
      status: "pending_generation",
      validation: ["design_representation_coverage"],
    });
    expect(artifact.realization.refs).toBeNull();
    const review = RepresentationReviewSchema.parse({
      version: "0.1",
      round: 1,
      status: "rejected",
      provider_refs_verified: { file_key: "fk", frame_node_ids: ["n1"] },
      feedback: { text: "hero too weak", region_annotations: [{ sdir_region: "hero", note: "contrast" }] },
      evidence: [{ type: "human_decision", actor_type: "human", actor_ref: "user:x", source_type: "conversation", source_ref: "msg-1", quote: "redo", confirmed_at: "2026-08-28T00:00:00.000Z" }],
      decided_at: "2026-08-28T00:00:00.000Z",
      sdir_digest_at_review: "abc",
      history: [],
    });
    expect(review.round).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/realization-contracts.test.ts`
Expected: FAIL — no exports `RealizationDecisionSchema` etc. from prax-runtime.

- [ ] **Step 3: Implement in `packages/prax-runtime/src/contracts.ts`**

Add `"realize"` to `GateNameSchema` (after `"reconcile"`), and `"REALIZATION"` to `DesignPhaseSchema` (after `"CAPABILITY_RECONCILIATION"`). Replace the single `LifecyclePolicySchema` with a v1/v2 discriminated union:

```ts
const LifecyclePolicyV1Schema = z.object({
  version: z.literal("1"),
  mode: DesignModeSchema,
  change_kind: ChangeKindSchema.optional(),
  gates: z.array(GateNameSchema).min(1),
});

export const LifecyclePolicyV2Schema = z.object({
  version: z.literal("2"),
  mode: DesignModeSchema,
  change_kind: ChangeKindSchema.optional(),
  gates: z.array(GateNameSchema).min(1),
});
export type LifecyclePolicyV2 = z.infer<typeof LifecyclePolicyV2Schema>;

export const LifecyclePolicySchema = z.discriminatedUnion("version", [LifecyclePolicyV1Schema, LifecyclePolicyV2Schema]);
export type LifecyclePolicy = z.infer<typeof LifecyclePolicySchema>;
```

Append after `CapabilityMapSchema`:

```ts
export const RealizationModeSchema = z.enum(["direct_code", "figma_first"]);
export type RealizationMode = z.infer<typeof RealizationModeSchema>;

export const ProviderFrameRefSchema = z.object({
  node_id: NonEmptyStringSchema,
  name: NonEmptyStringSchema,
  sdir_region: NonEmptyStringSchema,
});
export type ProviderFrameRef = z.infer<typeof ProviderFrameRefSchema>;

export const ProviderRefsSchema = z.object({
  file_key: NonEmptyStringSchema,
  frames: z.array(ProviderFrameRefSchema).min(1),
});
export type ProviderRefs = z.infer<typeof ProviderRefsSchema>;

export const RealizationConditionSchema = z.object({
  id: NonEmptyStringSchema,
  holds: z.boolean(),
  basis: NonEmptyStringSchema,
});
export type RealizationCondition = z.infer<typeof RealizationConditionSchema>;

export const RealizationDecisionSchema = z.object({
  version: z.literal("0.1"),
  realization_mode: RealizationModeSchema,
  provider: NonEmptyStringSchema.optional(),
  provider_contract_version: NonEmptyStringSchema.optional(),
  conditions: z.array(RealizationConditionSchema).min(1),
  proposed_at: z.string().datetime(),
  supersedes: z
    .object({ prior_mode: RealizationModeSchema, reason: NonEmptyStringSchema })
    .optional(),
  overridden: z.boolean().default(false),
  override_reason: NonEmptyStringSchema.optional(),
});
export type RealizationDecision = z.infer<typeof RealizationDecisionSchema>;

export const RepresentationStatusSchema = z.enum([
  "pending_generation",
  "under_review",
  "revision_requested",
  "approved",
  "abandoned",
]);

export const RepresentationArtifactSchema = z.object({
  version: z.literal("0.1"),
  id: NonEmptyStringSchema,
  representation: z.object({ role: z.literal("primary") }),
  semantic_refs: z.object({
    sdir_ref: z.literal("screen.sdir.yaml"),
    sdir_digest: NonEmptyStringSchema,
    regions: z.array(NonEmptyStringSchema).min(1),
  }),
  realization: z.object({
    provider: NonEmptyStringSchema,
    provider_contract_version: NonEmptyStringSchema,
    refs: ProviderRefsSchema.nullable(),
  }),
  status: RepresentationStatusSchema,
  validation: z.array(NonEmptyStringSchema),
});
export type RepresentationArtifact = z.infer<typeof RepresentationArtifactSchema>;

export const ScreenshotEvidenceSchema = z.object({
  type: z.literal("screenshot"),
  ref: NonEmptyStringSchema,
  sha256: NonEmptyStringSchema,
  collected_at: z.string().datetime(),
});

export const HumanDecisionEvidenceSchema = z.object({
  type: z.literal("human_decision"),
  actor_type: z.literal("human"),
  actor_ref: NonEmptyStringSchema,
  source_type: NonEmptyStringSchema,
  source_ref: NonEmptyStringSchema,
  quote: NonEmptyStringSchema,
  confirmed_at: z.string().datetime(),
});

export const RepresentationReviewEvidenceSchema = z.discriminatedUnion("type", [
  ScreenshotEvidenceSchema,
  HumanDecisionEvidenceSchema,
]);
export type RepresentationReviewEvidence = z.infer<typeof RepresentationReviewEvidenceSchema>;

export const RepresentationReviewRecordSchema = z.object({
  round: z.number().int().positive(),
  status: z.enum(["approved", "rejected"]),
  provider_refs_verified: z.object({
    file_key: NonEmptyStringSchema,
    frame_node_ids: z.array(NonEmptyStringSchema).min(1),
  }),
  feedback: z
    .object({
      text: NonEmptyStringSchema,
      region_annotations: z
        .array(z.object({ sdir_region: NonEmptyStringSchema, note: NonEmptyStringSchema }))
        .default([]),
    })
    .optional(),
  evidence: z.array(RepresentationReviewEvidenceSchema).min(1),
  decided_at: z.string().datetime(),
  sdir_digest_at_review: NonEmptyStringSchema,
});
export type RepresentationReviewRecord = z.infer<typeof RepresentationReviewRecordSchema>;

export const RepresentationReviewSchema = RepresentationReviewRecordSchema.extend({
  version: z.literal("0.1"),
  history: z.array(RepresentationReviewRecordSchema).default([]),
});
export type RepresentationReview = z.infer<typeof RepresentationReviewSchema>;
```

Extend `ARTIFACT_FILES` (append before the closing `} as const`):

```ts
  realizationDecision: "realization-decision.yaml",
  representationArtifact: "representation-artifact.yaml",
  representationReview: "representation-review.yaml",
```

- [ ] **Step 4: Register schemas in `packages/prax-runtime/src/artifact-store.ts`**

Add to the existing import from `./contracts.js`: `RealizationDecisionSchema`, `RepresentationArtifactSchema`, `RepresentationReviewSchema`. Extend `ARTIFACT_SCHEMAS`:

```ts
  realizationDecision: RealizationDecisionSchema,
  representationArtifact: RepresentationArtifactSchema,
  representationReview: RepresentationReviewSchema,
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- tests/realization-contracts.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add packages/prax-runtime/src/contracts.ts packages/prax-runtime/src/artifact-store.ts tests/realization-contracts.test.ts
git commit -m "feat(runtime): realization contracts, lifecycle policy v2 union, representation artifacts"
```

---

### Task 2: Lifecycle policy v2 + realize gate maps

**Files:**
- Modify: `packages/prax-runtime/src/lifecycle-policy.ts`
- Test: `tests/lifecycle-policy.test.ts` (append a new `it` inside the first describe)

- [ ] **Step 1: Write the failing test** — append inside `describe("lifecycle policy", ...)` in `tests/lifecycle-policy.test.ts`:

```ts
  it("creates v2 policies and maps the realize gate", () => {
    expect(lifecyclePolicyFor("greenfield").version).toBe("2");
    expect(lifecyclePolicyFor("rework").version).toBe("2");
    expect(lifecyclePolicyFor("existing_product", "modify_surface").version).toBe("2");
    expect(DEFAULT_LEGACY_POLICY.version).toBe("1");
    expect(GATE_PHASE.realize).toBe("REALIZATION");
    expect(NEXT_TOOL_BY_GATE.realize).toBe("design_realize");
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/lifecycle-policy.test.ts`
Expected: FAIL — `version` is `"1"` and `GATE_PHASE.realize` undefined.

- [ ] **Step 3: Implement** in `packages/prax-runtime/src/lifecycle-policy.ts`:

- `GATE_PHASE`: add `realize: "REALIZATION",` after the `reconcile` line.
- `NEXT_TOOL_BY_GATE`: add `realize: "design_realize",` after the `reconcile` line.
- In `lifecyclePolicyFor`, change every returned policy to `version: "2"`. The three return statements become:

```ts
    return { version: "2", mode, gates: ["confirm", "framing", ...FULL_TAIL] };
```
```ts
    return { version: "2", mode, change_kind: changeKind, gates: gatesByKind[changeKind] };
```
```ts
  return {
    version: "2",
    mode,
    ...(changeKind === undefined ? {} : { change_kind: changeKind }),
    gates: ["confirm", "understanding", "framing", ...REWORK_TAIL],
  };
```

`DEFAULT_LEGACY_POLICY` stays `version: "1"` (legacy resume behavior unchanged).

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/lifecycle-policy.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/prax-runtime/src/lifecycle-policy.ts tests/lifecycle-policy.test.ts
git commit -m "feat(runtime): lifecycle policy v2 with realize gate maps"
```

---

### Task 3: realization.ts — provider table, condition predicate, draft/review validation, evidence verification, gate splice helpers

**Files:**
- Create: `packages/prax-runtime/src/realization.ts`
- Modify: `packages/prax-runtime/src/index.ts` (add `export * from "./realization.js";`)
- Test: `tests/realization.test.ts` (new)

- [ ] **Step 1: Write the failing test**

```ts
// tests/realization.test.ts
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  REALIZATION_PROVIDERS,
  removeRealizeGate,
  spliceRealizeGate,
  validateDraft,
  validatePropose,
  validateReview,
  verifyEvidenceFile,
  type LifecyclePolicyV2,
  type RealizationCondition,
  type RepresentationArtifact,
} from "prax-runtime";

const cleanup: string[] = [];
afterEach(async () => {
  await Promise.all(cleanup.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

function figmaFirstConditions(holds: Partial<Record<string, boolean>> = {}): RealizationCondition[] {
  const all: Array<[string, string]> = [
    ["greenfield", "session mode is greenfield"],
    ["high_visual_uncertainty", "brand hero has no settled visual language"],
    ["marketing_editorial", "product landing page"],
    ["stakeholder_visual_approval", "product owner approves visuals in Figma"],
    ["spatial_exploration_value", "layout exploration precedes code"],
    ["runtime_dependency_low", "static marketing page"],
  ];
  return all.map(([id, basis]) => ({ id, holds: holds[id] ?? true, basis }));
}

function directCodeConditions(): RealizationCondition[] {
  return [
    { id: "defect_fix_fit", holds: false, basis: "not a defect fix" },
    { id: "visual_polish_fit", holds: false, basis: "not a polish pass" },
    { id: "small_modification", holds: false, basis: "full greenfield surface" },
    { id: "mature_design_system", holds: false, basis: "no design system yet" },
  ];
}

const NOW = "2026-08-28T00:00:00.000Z";

describe("validatePropose", () => {
  it("passes a fit figma_first proposal and stamps provider contract version", () => {
    const result = validatePropose(
      { realization_mode: "figma_first", provider: "figma", conditions: figmaFirstConditions() },
      { mode: "greenfield" },
      { now: NOW },
    );
    expect(result.status).toBe("PASS");
    expect(result.value?.provider_contract_version).toBe(REALIZATION_PROVIDERS.figma.contract_version);
  });

  it("blocks figma_first without a registered provider", () => {
    const result = validatePropose(
      { realization_mode: "figma_first", provider: "sketch", conditions: figmaFirstConditions() },
      { mode: "greenfield" },
      { now: NOW },
    );
    expect(result.status).toBe("BLOCK");
    expect(result.codes).toContain("REALIZATION_MODE_INVALID");
  });

  it("blocks a condition set that is not the exact fixed set", () => {
    const conditions = figmaFirstConditions().slice(0, 3);
    const result = validatePropose(
      { realization_mode: "figma_first", provider: "figma", conditions },
      { mode: "greenfield" },
      { now: NOW },
    );
    expect(result.status).toBe("BLOCK");
    expect(result.codes).toContain("REALIZATION_CONDITIONS_INCOMPLETE");
    const duplicated = [...figmaFirstConditions(), figmaFirstConditions()[0]!];
    expect(
      validatePropose({ realization_mode: "figma_first", provider: "figma", conditions: duplicated }, { mode: "greenfield" }, { now: NOW }).status,
    ).toBe("BLOCK");
  });

  it("expands when a basis is blank", () => {
    const conditions = figmaFirstConditions();
    conditions[1] = { ...conditions[1]!, basis: "   " };
    const result = validatePropose(
      { realization_mode: "figma_first", provider: "figma", conditions },
      { mode: "greenfield" },
      { now: NOW },
    );
    expect(result.status).toBe("EXPAND");
    expect(result.codes).toContain("REALIZATION_BASIS_MISSING");
  });

  it("reviews figma_first that fails the eligibility predicate, recommending direct_code", () => {
    const result = validatePropose(
      {
        realization_mode: "figma_first",
        provider: "figma",
        conditions: figmaFirstConditions({
          runtime_dependency_low: false,
          high_visual_uncertainty: false,
          marketing_editorial: false,
          stakeholder_visual_approval: false,
          spatial_exploration_value: false,
        }),
      },
      { mode: "greenfield" },
      { now: NOW },
    );
    expect(result.status).toBe("REVIEW");
    expect(result.codes).toContain("REALIZATION_MODE_MISMATCH");
  });

  it("accepts an unsatisfied predicate only via explicit override, recorded on the decision", () => {
    const conditions = figmaFirstConditions({ runtime_dependency_low: false });
    const result = validatePropose(
      { realization_mode: "figma_first", provider: "figma", conditions, override: true, override_reason: "stakeholder insists on Figma review" },
      { mode: "greenfield" },
      { now: NOW },
    );
    expect(result.status).toBe("WARN");
    expect(result.value?.overridden).toBe(true);
  });

  it("reviews a greenfield declaration that contradicts the session mode", () => {
    const result = validatePropose(
      { realization_mode: "figma_first", provider: "figma", conditions: figmaFirstConditions() },
      { mode: "rework" },
      { now: NOW },
    );
    expect(result.status).toBe("REVIEW");
    expect(result.codes).toContain("REALIZATION_CONDITION_MISMATCH");
  });

  it("requires a reason when re-proposing flips the mode", () => {
    const prior = { version: "0.1" as const, realization_mode: "figma_first" as const, conditions: figmaFirstConditions(), proposed_at: NOW };
    const result = validatePropose(
      { realization_mode: "direct_code", conditions: directCodeConditions() },
      { mode: "greenfield" },
      { now: NOW, priorDecision: prior },
    );
    expect(result.status).toBe("EXPAND");
    const withReason = validatePropose(
      { realization_mode: "direct_code", conditions: directCodeConditions(), reason: "figma seat unavailable" },
      { mode: "greenfield" },
      { now: NOW, priorDecision: prior },
    );
    expect(withReason.status).toBe("PASS");
    expect(withReason.value?.supersedes).toMatchObject({ prior_mode: "figma_first", reason: "figma seat unavailable" });
  });
});

function artifactFor(status: RepresentationArtifact["status"], refs: RepresentationArtifact["realization"]["refs"]): RepresentationArtifact {
  return {
    version: "0.1",
    id: "rep-ds_x",
    representation: { role: "primary" },
    semantic_refs: { sdir_ref: "screen.sdir.yaml", sdir_digest: "digest-1", regions: ["hero", "features", "cta"] },
    realization: { provider: "figma", provider_contract_version: "remote-mcp-2026-08", refs },
    status,
    validation: ["design_representation_coverage", "representation_runtime_drift"],
  };
}

describe("validateDraft", () => {
  it("expands when an sdir region has no frame and flags unknown regions and duplicate node ids", () => {
    const artifact = artifactFor("pending_generation", null);
    const partial = validateDraft({ file_key: "fk", frames: [{ node_id: "n1", name: "Hero", sdir_region: "hero" }] }, artifact);
    expect(partial.status).toBe("EXPAND");
    expect(partial.issues.join(" ")).toMatch(/features, cta/);
    const bad = validateDraft(
      {
        file_key: "fk",
        frames: [
          { node_id: "n1", name: "A", sdir_region: "hero" },
          { node_id: "n1", name: "B", sdir_region: "nonexistent" },
        ],
      },
      artifact,
    );
    expect(bad.status).toBe("EXPAND");
    expect(bad.codes).toContain("REALIZATION_DRAFT_INVALID");
  });

  it("passes full coverage", () => {
    const artifact = artifactFor("pending_generation", null);
    const result = validateDraft(
      {
        file_key: "fk",
        frames: [
          { node_id: "n1", name: "Hero", sdir_region: "hero" },
          { node_id: "n2", name: "Features", sdir_region: "features" },
          { node_id: "n3", name: "CTA", sdir_region: "cta" },
        ],
      },
      artifact,
    );
    expect(result.status).toBe("PASS");
  });
});

describe("verifyEvidenceFile", () => {
  it("verifies a real file and returns its sha256", async () => {
    const root = await mkdtemp(join(tmpdir(), "prax-rev-"));
    cleanup.push(root);
    await mkdir(join(root, "rep-evidence", "round-1"), { recursive: true });
    await writeFile(join(root, "rep-evidence", "round-1", "frame-hero.png"), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    const result = await verifyEvidenceFile(root, "rep-evidence/round-1/frame-hero.png");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.sha256).toHaveLength(64);
  });

  it("rejects traversal, wrong prefix, missing files, and symlink escapes", async () => {
    const root = await mkdtemp(join(tmpdir(), "prax-rev-"));
    cleanup.push(root);
    await mkdir(join(root, "rep-evidence", "round-1"), { recursive: true });
    await writeFile(join(root, "rep-evidence", "round-1", "a.png"), "x");
    await mkdir(join(root, "outside"), { recursive: true });
    await writeFile(join(root, "outside", "secret.png"), "x");
    expect((await verifyEvidenceFile(root, "../outside/secret.png")).ok).toBe(false);
    expect((await verifyEvidenceFile(root, "evidence/round-1/a.png")).ok).toBe(false);
    expect((await verifyEvidenceFile(root, "rep-evidence/round-1/missing.png")).ok).toBe(false);
    try {
      await symlink(join(root, "outside", "secret.png"), join(root, "rep-evidence", "round-1", "link.png"));
      expect((await verifyEvidenceFile(root, "rep-evidence/round-1/link.png")).ok).toBe(false);
    } catch {
      // Windows without symlink privilege: containment is still covered by the checks above.
    }
  });
});

describe("validateReview", () => {
  const approvedRefs = {
    file_key: "fk",
    frames: [
      { node_id: "n1", name: "Hero", sdir_region: "hero" },
      { node_id: "n2", name: "Features", sdir_region: "features" },
      { node_id: "n3", name: "CTA", sdir_region: "cta" },
    ],
  };

  async function withEvidenceRoot(run: (root: string) => Promise<void>) {
    const root = await mkdtemp(join(tmpdir(), "prax-rev-"));
    cleanup.push(root);
    await mkdir(join(root, "rep-evidence", "round-1"), { recursive: true });
    await writeFile(join(root, "rep-evidence", "round-1", "hero.png"), Buffer.from([0x89, 0x50]));
    await run(root);
  }

  it("retries when provider_refs_verified does not match the artifact refs", async () => {
    await withEvidenceRoot(async (root) => {
      const artifact = artifactFor("under_review", approvedRefs);
      const result = await validateReview(
        {
          status: "approved",
          provider_refs_verified: { file_key: "other", frame_node_ids: ["n1"] },
          evidence: [{ type: "human_decision", actor_ref: "user:x", source_type: "conversation", source_ref: "m1", quote: "ok" }],
        },
        artifact,
        { sessionDirectory: root, now: NOW },
      );
      expect(result.status).toBe("RETRY");
      expect(result.codes).toContain("REALIZATION_REVIEW_REFS_MISMATCH");
    });
  });

  it("expands when rejected without feedback or approved without both evidence kinds", async () => {
    await withEvidenceRoot(async (root) => {
      const artifact = artifactFor("under_review", approvedRefs);
      const rejectedNoFeedback = await validateReview(
        { status: "rejected", provider_refs_verified: { file_key: "fk", frame_node_ids: ["n1", "n2", "n3"] }, evidence: [{ type: "human_decision", actor_ref: "u", source_type: "conversation", source_ref: "m", quote: "no" }] },
        artifact,
        { sessionDirectory: root, now: NOW },
      );
      expect(rejectedNoFeedback.status).toBe("EXPAND");
      const approvedNoScreenshot = await validateReview(
        {
          status: "approved",
          provider_refs_verified: { file_key: "fk", frame_node_ids: ["n1", "n2", "n3"] },
          feedback: { text: "ok" },
          evidence: [{ type: "human_decision", actor_ref: "u", source_type: "conversation", source_ref: "m", quote: "approved" }],
        },
        artifact,
        { sessionDirectory: root, now: NOW },
      );
      expect(approvedNoScreenshot.status).toBe("EXPAND");
      expect(approvedNoScreenshot.codes).toContain("REALIZATION_REVIEW_EVIDENCE_INCOMPLETE");
    });
  });

  it("computes screenshot sha256 server-side and builds an approved record", async () => {
    await withEvidenceRoot(async (root) => {
      const artifact = artifactFor("under_review", approvedRefs);
      const result = await validateReview(
        {
          status: "approved",
          provider_refs_verified: { file_key: "fk", frame_node_ids: ["n1", "n2", "n3"] },
          feedback: { text: "approved after hero fix" },
          evidence: [
            { type: "screenshot", ref: "rep-evidence/round-1/hero.png" },
            { type: "human_decision", actor_ref: "user:x", source_type: "conversation", source_ref: "m1", quote: "approved" },
          ],
        },
        artifact,
        { sessionDirectory: root, now: NOW },
      );
      expect(result.status).toBe("PASS");
      const record = result.value!;
      expect(record.status).toBe("approved");
      expect(record.evidence[0]).toMatchObject({ type: "screenshot", sha256: expect.any(String) });
      expect(record.sdir_digest_at_review).toBe("digest-1");
    });
  });
});

describe("gate splice helpers", () => {
  const policy: LifecyclePolicyV2 = {
    version: "2",
    mode: "greenfield",
    gates: ["confirm", "framing", "context", "route", "decide", "sdir", "reconcile", "prepare", "validate"],
  };

  it("splices realize before prepare and removes it again", () => {
    const spliced = spliceRealizeGate(policy);
    expect(spliced.gates.indexOf("realize")).toBe(spliced.gates.indexOf("prepare") - 1);
    expect(spliceRealizeGate(spliced).gates).toEqual(spliced.gates);
    expect(removeRealizeGate(spliced).gates).toEqual(policy.gates);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/realization.test.ts`
Expected: FAIL — module `prax-runtime` has no export `validatePropose`.

- [ ] **Step 3: Implement `packages/prax-runtime/src/realization.ts`**

```ts
import { createHash } from "node:crypto";
import { readFile, realpath, stat } from "node:fs/promises";
import { resolve, sep } from "node:path";
import {
  RealizationDecisionSchema,
  type DesignSession,
  type GateStatus,
  type LifecyclePolicyV2,
  type RealizationCondition,
  type RealizationDecision,
  type RealizationMode,
  type RepresentationArtifact,
  type RepresentationReviewEvidence,
  type RepresentationReviewRecord,
} from "./contracts.js";

export const REALIZATION_PREDICATE_VERSION = "1";

export const REALIZATION_PROVIDERS = {
  figma: {
    id: "figma",
    contract_version: "remote-mcp-2026-08",
    capabilities: ["write_canvas", "screenshot", "metadata"],
  },
} as const;
export type RealizationProviderId = keyof typeof REALIZATION_PROVIDERS;

export const REALIZATION_CONDITION_IDS: Record<RealizationMode, readonly string[]> = {
  direct_code: ["defect_fix_fit", "visual_polish_fit", "small_modification", "mature_design_system"],
  figma_first: [
    "greenfield",
    "high_visual_uncertainty",
    "marketing_editorial",
    "stakeholder_visual_approval",
    "spatial_exploration_value",
    "runtime_dependency_low",
  ],
};

const FIGMA_FIRST_FIT_CONDITIONS = [
  "greenfield",
  "high_visual_uncertainty",
  "marketing_editorial",
  "stakeholder_visual_approval",
  "spatial_exploration_value",
] as const;

export interface RealizationValidation<T = undefined> {
  status: GateStatus;
  issues: string[];
  warnings: string[];
  codes?: string[];
  value?: T;
}

export interface ProposeInput {
  realization_mode: RealizationMode;
  provider?: string | undefined;
  conditions: RealizationCondition[];
  reason?: string | undefined;
  override?: boolean | undefined;
  override_reason?: string | undefined;
}

export function validatePropose(
  input: ProposeInput,
  session: Pick<DesignSession, "mode">,
  options: { now: string; priorDecision?: RealizationDecision | undefined },
): RealizationValidation<RealizationDecision> {
  const warnings: string[] = [];
  const codes: string[] = [];

  if (input.realization_mode === "figma_first") {
    const provider = input.provider as RealizationProviderId | undefined;
    if (provider === undefined || REALIZATION_PROVIDERS[provider] === undefined) {
      return {
        status: "BLOCK",
        issues: [`figma_first requires a registered provider (${Object.keys(REALIZATION_PROVIDERS).join(", ")}).`],
        warnings,
        codes: ["REALIZATION_MODE_INVALID"],
      };
    }
  }

  const expected = [...REALIZATION_CONDITION_IDS[input.realization_mode]].sort();
  const actual = input.conditions.map((condition) => condition.id).sort();
  const hasDuplicates = input.conditions.length !== new Set(input.conditions.map((c) => c.id)).size;
  if (hasDuplicates || actual.join() !== expected.join()) {
    return {
      status: "BLOCK",
      issues: [`conditions must exactly match the fixed condition set for ${input.realization_mode}: ${expected.join(", ")}.`],
      warnings,
      codes: ["REALIZATION_CONDITIONS_INCOMPLETE"],
    };
  }

  const issues: string[] = [];
  const emptyBasis = input.conditions.filter((condition) => condition.basis.trim().length === 0);
  if (emptyBasis.length > 0) {
    issues.push(`every condition needs a non-empty basis (missing: ${emptyBasis.map((c) => c.id).join(", ")}).`);
    codes.push("REALIZATION_BASIS_MISSING");
  }

  const holds = new Map(input.conditions.map((condition) => [condition.id, condition.holds]));
  if (input.realization_mode === "figma_first") {
    const fits = FIGMA_FIRST_FIT_CONDITIONS.filter((id) => holds.get(id) === true);
    const lowRuntime = holds.get("runtime_dependency_low") === true;
    if (!lowRuntime || fits.length === 0) {
      if (input.override === true && (input.override_reason ?? "").trim() !== "") {
        warnings.push("figma_first accepted via explicit override although the eligibility predicate is not satisfied; recorded on the decision.");
      } else {
        return {
          status: "REVIEW",
          issues: [
            "figma_first requires runtime_dependency_low plus at least one fit condition (greenfield, high_visual_uncertainty, marketing_editorial, stakeholder_visual_approval, spatial_exploration_value); recommend direct_code or re-propose with override plus override_reason.",
          ],
          warnings,
          codes: ["REALIZATION_MODE_MISMATCH"],
        };
      }
    }
    if (holds.get("greenfield") === true && session.mode !== "greenfield") {
      return {
        status: "REVIEW",
        issues: [`condition 'greenfield' holds=true but the session mode is '${session.mode}'; fix the declaration or use direct_code.`],
        warnings,
        codes: ["REALIZATION_CONDITION_MISMATCH"],
      };
    }
  }

  if (issues.length > 0) {
    return { status: "EXPAND", issues, warnings, codes };
  }

  const modeFlip =
    options.priorDecision !== undefined && options.priorDecision.realization_mode !== input.realization_mode;
  if (modeFlip && (input.reason ?? "").trim() === "") {
    return {
      status: "EXPAND",
      issues: ["changing the realization mode requires a reason explaining the switch."],
      warnings,
      codes: ["REALIZATION_BASIS_MISSING"],
    };
  }

  const provider = input.realization_mode === "figma_first" ? REALIZATION_PROVIDERS[input.provider as RealizationProviderId] : undefined;
  const value = RealizationDecisionSchema.parse({
    version: "0.1",
    realization_mode: input.realization_mode,
    ...(provider === undefined ? {} : { provider: provider.id, provider_contract_version: provider.contract_version }),
    conditions: input.conditions,
    proposed_at: options.now,
    ...(modeFlip
      ? { supersedes: { prior_mode: options.priorDecision!.realization_mode, reason: input.reason! } }
      : {}),
    overridden: input.override === true,
    ...(input.override_reason === undefined ? {} : { override_reason: input.override_reason }),
  });
  return { status: warnings.length > 0 ? "WARN" : "PASS", issues: [], warnings, codes: [], value };
}

export function validateDraft(
  refs: { file_key: string; frames: Array<{ node_id: string; name: string; sdir_region: string }> },
  artifact: RepresentationArtifact,
): RealizationValidation {
  const issues: string[] = [];
  const codes: string[] = [];
  const regions = new Set(artifact.semantic_refs.regions);
  const nodeIds = new Set<string>();
  for (const frame of refs.frames) {
    if (nodeIds.has(frame.node_id)) {
      issues.push(`duplicate frame node_id '${frame.node_id}'.`);
      codes.push("REALIZATION_DRAFT_INVALID");
    }
    nodeIds.add(frame.node_id);
    if (!regions.has(frame.sdir_region)) {
      issues.push(`frame '${frame.name}' maps to unknown sdir_region '${frame.sdir_region}'.`);
      codes.push("REALIZATION_DRAFT_INVALID");
    }
  }
  const missing = artifact.semantic_refs.regions.filter(
    (region) => !refs.frames.some((frame) => frame.sdir_region === region),
  );
  if (missing.length > 0) {
    issues.push(`sdir regions without any frame: ${missing.join(", ")}.`);
    codes.push("REALIZATION_COVERAGE_INCOMPLETE");
  }
  return issues.length === 0
    ? { status: "PASS", issues: [], warnings: [], codes: [] }
    : { status: "EXPAND", issues, warnings: [], codes };
}

export type EvidenceVerification =
  | { ok: true; sha256: string }
  | { ok: false; error: string };

export async function verifyEvidenceFile(sessionDirectory: string, ref: string): Promise<EvidenceVerification> {
  if (!ref.startsWith("rep-evidence/") || ref.split("/").some((segment) => segment === "..")) {
    return { ok: false, error: `evidence ref must stay under rep-evidence/ relative to the session directory: ${ref}` };
  }
  const evidenceRoot = resolve(sessionDirectory, "rep-evidence");
  const target = resolve(sessionDirectory, ref);
  if (!target.startsWith(evidenceRoot + sep)) {
    return { ok: false, error: `evidence ref escapes the evidence directory: ${ref}` };
  }
  try {
    const realTarget = await realpath(target);
    const realRoot = await realpath(evidenceRoot);
    if (!realTarget.startsWith(realRoot + sep)) {
      return { ok: false, error: `evidence ref resolves outside the evidence directory: ${ref}` };
    }
    const stats = await stat(realTarget);
    if (!stats.isFile()) {
      return { ok: false, error: `evidence ref is not a regular file: ${ref}` };
    }
    if (stats.size === 0) {
      return { ok: false, error: `evidence file is empty: ${ref}` };
    }
    const sha256 = createHash("sha256").update(await readFile(realTarget)).digest("hex");
    return { ok: true, sha256 };
  } catch {
    return { ok: false, error: `evidence file not found: ${ref}` };
  }
}

export interface ReviewSubmissionInput {
  status: "approved" | "rejected";
  provider_refs_verified: { file_key: string; frame_node_ids: string[] };
  feedback?: { text: string; region_annotations?: Array<{ sdir_region: string; note: string }> } | undefined;
  evidence: Array<
    | { type: "screenshot"; ref: string }
    | { type: "human_decision"; actor_ref: string; source_type: string; source_ref: string; quote: string }
  >;
}

export async function validateReview(
  submission: ReviewSubmissionInput,
  artifact: RepresentationArtifact,
  options: { sessionDirectory: string; now: string; expectedRound?: number },
): Promise<RealizationValidation<RepresentationReviewRecord>> {
  const refs = artifact.realization.refs;
  if (refs === null) {
    return { status: "BLOCK", issues: ["the artifact carries no draft refs; submit_draft first."], warnings: [], codes: ["REALIZATION_WINDOW_INVALID"] };
  }
  const verifiedIds = [...submission.provider_refs_verified.frame_node_ids].sort();
  const artifactIds = refs.frames.map((frame) => frame.node_id).sort();
  if (submission.provider_refs_verified.file_key !== refs.file_key || verifiedIds.join() !== artifactIds.join()) {
    return {
      status: "RETRY",
      issues: ["provider_refs_verified must match the artifact refs exactly (same file_key and node id set)."],
      warnings: [],
      codes: ["REALIZATION_REVIEW_REFS_MISMATCH"],
    };
  }
  const issues: string[] = [];
  const codes: string[] = [];
  if (submission.status === "rejected" && (submission.feedback?.text ?? "").trim() === "") {
    issues.push("rejected reviews require feedback.text.");
    codes.push("REALIZATION_REVIEW_EVIDENCE_INCOMPLETE");
  }
  const evidence: RepresentationReviewEvidence[] = [];
  let screenshots = 0;
  let human = 0;
  const roundPrefix = `rep-evidence/round-${options.expectedRound ?? 1}/`;
  for (const item of submission.evidence) {
    if (item.type === "screenshot") {
      if (!item.ref.startsWith(roundPrefix)) {
        issues.push(`screenshot evidence must come from the current review round directory (${roundPrefix}): ${item.ref}`);
        codes.push("REALIZATION_EVIDENCE_INVALID");
        continue;
      }
      const verified = await verifyEvidenceFile(options.sessionDirectory, item.ref);
      if (!verified.ok) {
        issues.push(verified.error);
        codes.push("REALIZATION_EVIDENCE_INVALID");
        continue;
      }
      evidence.push({ type: "screenshot", ref: item.ref, sha256: verified.sha256, collected_at: options.now });
      screenshots += 1;
    } else {
      if (
        item.actor_ref.trim() === "" ||
        item.source_type.trim() === "" ||
        item.source_ref.trim() === "" ||
        item.quote.trim() === ""
      ) {
        issues.push("human_decision evidence requires actor_ref, source_type, source_ref, and quote.");
        codes.push("REALIZATION_REVIEW_EVIDENCE_INCOMPLETE");
        continue;
      }
      evidence.push({
        type: "human_decision",
        actor_type: "human",
        actor_ref: item.actor_ref,
        source_type: item.source_type,
        source_ref: item.source_ref,
        quote: item.quote,
        confirmed_at: options.now,
      });
      human += 1;
    }
  }
  if (submission.status === "approved" && (screenshots === 0 || human === 0)) {
    issues.push("approved reviews require at least one screenshot evidence and one human_decision evidence.");
    codes.push("REALIZATION_REVIEW_EVIDENCE_INCOMPLETE");
  }
  if (issues.length > 0) {
    return { status: "EXPAND", issues, warnings: [], codes };
  }
  const value: RepresentationReviewRecord = {
    round: 0,
    status: submission.status,
    provider_refs_verified: submission.provider_refs_verified,
    ...(submission.feedback === undefined
      ? {}
      : { feedback: { text: submission.feedback.text, region_annotations: submission.feedback.region_annotations ?? [] } }),
    evidence,
    decided_at: options.now,
    sdir_digest_at_review: artifact.semantic_refs.sdir_digest,
  };
  return { status: "PASS", issues: [], warnings: [], codes: [], value };
}

export function spliceRealizeGate(policy: LifecyclePolicyV2): LifecyclePolicyV2 {
  if (policy.gates.includes("realize")) return policy;
  const gates = [...policy.gates];
  const index = gates.indexOf("prepare");
  gates.splice(index === -1 ? gates.length : index, 0, "realize");
  return { ...policy, gates };
}

export function removeRealizeGate(policy: LifecyclePolicyV2): LifecyclePolicyV2 {
  return { ...policy, gates: policy.gates.filter((gate) => gate !== "realize") };
}
```

- [ ] **Step 4: Export from index** — in `packages/prax-runtime/src/index.ts` add:

```ts
export * from "./realization.js";
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- tests/realization.test.ts`
Expected: PASS (all describes).

- [ ] **Step 6: Commit**

```bash
git add packages/prax-runtime/src/realization.ts packages/prax-runtime/src/index.ts tests/realization.test.ts
git commit -m "feat(runtime): realization proposal/draft/review validation with evidence verification"
```

---

### Task 4: Validator — representation checks in plans + deterministic fail-closed evaluator + two-sided drift evidence

**Files:**
- Modify: `packages/prax-validator/src/validator.ts`
- Test: `tests/realization-validator.test.ts` (new)

- [ ] **Step 1: Write the failing test**

```ts
// tests/realization-validator.test.ts
import { describe, expect, it } from "vitest";
import { PraxValidator } from "prax-validator";
import type { RepresentationArtifact } from "prax-runtime";
import { architectureDecisions } from "./fixtures.js";

function artifact(overrides: Partial<RepresentationArtifact> = {}): RepresentationArtifact {
  return {
    version: "0.1",
    id: "rep-ds_x",
    representation: { role: "primary" },
    semantic_refs: { sdir_ref: "screen.sdir.yaml", sdir_digest: "digest-1", regions: ["hero", "cta"] },
    realization: {
      provider: "figma",
      provider_contract_version: "remote-mcp-2026-08",
      refs: {
        file_key: "fk",
        frames: [
          { node_id: "n1", name: "Hero", sdir_region: "hero" },
          { node_id: "n2", name: "CTA", sdir_region: "cta" },
        ],
      },
    },
    status: "approved",
    validation: ["design_representation_coverage", "representation_runtime_drift"],
    ...overrides,
  };
}

describe("representation checks in the plan", () => {
  const validator = new PraxValidator();

  it("appends both representation checks for figma_first full-SDIR sessions", () => {
    const plan = validator.plan({
      policyContext: { mode: "greenfield" },
      decisions: architectureDecisions("ds_x"),
      realizationMode: "figma_first",
    });
    const ids = plan.checks.map((check) => check.id);
    expect(ids).toContain("design_representation_coverage");
    expect(ids).toContain("representation_runtime_drift");
    const coverage = plan.checks.find((check) => check.id === "design_representation_coverage")!;
    expect(coverage).toMatchObject({ kind: "deterministic", evidence_required: false, profile: "representation_integrity" });
  });

  it("omits representation checks for direct_code and light paths", () => {
    const direct = new PraxValidator().plan({ policyContext: { mode: "greenfield" }, realizationMode: "direct_code" });
    expect(direct.checks.some((check) => check.id === "design_representation_coverage")).toBe(false);
    const light = new PraxValidator().plan({ policyContext: { mode: "existing_product", change_kind: "visual_polish" } });
    expect(light.checks.some((check) => check.id === "representation_runtime_drift")).toBe(false);
  });
});

describe("deterministic representation coverage evaluator (fail-closed)", () => {
  const validator = new PraxValidator();
  const approvedReview = {
    version: "0.1" as const,
    round: 1,
    status: "approved" as const,
    provider_refs_verified: { file_key: "fk", frame_node_ids: ["n1", "n2"] },
    feedback: { text: "ok", region_annotations: [] },
    evidence: [{ type: "human_decision" as const, actor_type: "human" as const, actor_ref: "u", source_type: "conversation", source_ref: "m", quote: "ok", confirmed_at: "2026-08-28T00:00:00.000Z" }],
    decided_at: "2026-08-28T00:00:00.000Z",
    sdir_digest_at_review: "digest-1",
    history: [],
  };

  function evaluateWith(art: RepresentationArtifact | undefined, sdirDigest: string | undefined, review: unknown = approvedReview) {
    const plan = validator.plan({ policyContext: { mode: "greenfield" }, realizationMode: "figma_first" });
    return validator.evaluate({ plan, representationArtifact: art, representationReview: review as never, sdirDigest });
  }

  it("fails closed when the artifact is missing, unapproved, unreviewed, drifted, or uncovered", () => {
    expect(evaluateWith(undefined, "digest-1").status).toBe("BLOCK");
    expect(evaluateWith(artifact({ status: "revision_requested" }), "digest-1").status).toBe("BLOCK");
    expect(evaluateWith(artifact(), "digest-1", undefined).status).toBe("BLOCK");
    expect(evaluateWith(artifact(), undefined).status).toBe("BLOCK");
    expect(evaluateWith(artifact(), "different-digest").status).toBe("BLOCK");
    expect(
      evaluateWith(
        artifact({
          realization: {
            provider: "figma",
            provider_contract_version: "remote-mcp-2026-08",
            refs: { file_key: "fk", frames: [{ node_id: "n1", name: "Hero", sdir_region: "hero" }] },
          },
        }),
        "digest-1",
      ).status,
    ).toBe("BLOCK");
  });

  it("produces a finding for every deterministic check in the plan (no silent passes)", () => {
    const plan = validator.plan({ policyContext: { mode: "greenfield" }, realizationMode: "figma_first", decisions: architectureDecisions("ds_x") });
    const evaluation = validator.evaluate({ plan, representationArtifact: artifact(), representationReview: approvedReview, sdirDigest: "digest-1" });
    const deterministicIds = plan.checks.filter((check) => check.kind === "deterministic").map((check) => check.id);
    const findingIds = evaluation.findings.filter((finding) => finding.kind === "deterministic").map((finding) => finding.check_id);
    expect(deterministicIds.every((id) => findingIds.includes(id))).toBe(true);
  });

  it("passes when approved and fully covered, and the drift check demands two artifact_refs", () => {
    const evaluation = evaluateWith(artifact(), "digest-1");
    const coverage = evaluation.findings.find((finding) => finding.check_id === "design_representation_coverage");
    expect(coverage).toMatchObject({ kind: "deterministic", outcome: "pass" });

    const drift = evaluation.missing_evidence;
    expect(drift).toContain("representation_runtime_drift");
    const withDriftOneRef = validator.evaluate({
      plan: validator.plan({ policyContext: { mode: "greenfield" }, realizationMode: "figma_first" }),
      representationArtifact: artifact(),
      representationReview: approvedReview,
      sdirDigest: "digest-1",
      evidence: {
        submitted_by: "agent",
        collected_at: "2026-08-28T00:00:00.000Z",
        items: [{ check_id: "representation_runtime_drift", outcome: "pass", source: "visual diff", notes: "match", artifact_refs: ["only-one.png"] }],
      },
    });
    expect(withDriftOneRef.missing_evidence).toContain("representation_runtime_drift");
    expect(withDriftOneRef.findings.find((finding) => finding.check_id === "representation_runtime_drift")?.outcome).toBe("inconclusive");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/realization-validator.test.ts`
Expected: FAIL — `ValidationPlanInput` has no `realizationMode`.

- [ ] **Step 3: Implement in `packages/prax-validator/src/validator.ts`**

3a. Extend the type import from `prax-runtime` (line 1) with `type RepresentationArtifact`.

3b. Add the check constants after `REWORK_CHECKS`:

```ts
const REPRESENTATION_CHECKS: ValidationCheck[] = [
  { id: "design_representation_coverage", label: "Design representation coverage", kind: "deterministic", requirement: "Every SDIR region maps to at least one approved representation frame and the approved SDIR digest still matches.", evidence_required: false },
  { id: "representation_runtime_drift", label: "Representation runtime drift", kind: "empirical", requirement: "Runtime snapshot evidence compares against the approved representation snapshot (two artifact_refs: approved then runtime).", evidence_required: true },
];
```

3c. In `CHECK_PROFILE` add:

```ts
  design_representation_coverage: { profile: "representation_integrity", facet: "semantic" },
  representation_runtime_drift: { profile: "representation_integrity", facet: "visual" },
```

3d. `ValidationPlanInput` gains (extend the `prax-runtime` type import with `RealizationMode`):

```ts
  realizationMode?: RealizationMode | undefined;
```

3e. In `assemblePlan`, only the final full-chain return appends the checks (light and modify branches never carry realization). Change the final return's `checks` array to:

```ts
      checks: [
        ...UNIVERSAL_CHECKS,
        ...patternChecks,
        ...riskChecks,
        ...(input.realizationMode === "figma_first" ? REPRESENTATION_CHECKS : []),
        ...existingChecks,
        REQUIREMENT_CHECK,
      ],
```

3f. `evaluate` input type gains (extend the `prax-runtime` type import with `RepresentationReview`):

```ts
    representationArtifact?: RepresentationArtifact | undefined;
    representationReview?: RepresentationReview | undefined;
    sdirDigest?: string | undefined;
```

3g. Add the deterministic branch after the `delta_conformance` block:

```ts
    if (checkIds.has("design_representation_coverage")) {
      const artifact = input.representationArtifact;
      let failure: string | undefined;
      if (artifact === undefined) {
        failure = "representation artifact is missing.";
      } else if (artifact.status !== "approved") {
        failure = `representation artifact status is '${artifact.status}', not approved.`;
      } else if (input.representationReview === undefined || input.representationReview.status !== "approved") {
        failure = "no approved representation review backs the artifact.";
      } else if (input.sdirDigest === undefined) {
        failure = "the current SDIR digest is unavailable.";
      } else if (input.sdirDigest !== artifact.semantic_refs.sdir_digest) {
        failure = "the SDIR digest changed after representation approval.";
      } else if (artifact.realization.refs === null) {
        failure = "the approved representation artifact carries no provider refs.";
      } else {
        const unmapped = artifact.semantic_refs.regions.filter(
          (region) => !artifact.realization.refs!.frames.some((frame) => frame.sdir_region === region),
        );
        if (unmapped.length > 0) {
          failure = `sdir regions without an approved frame: ${unmapped.join(", ")}.`;
        } else if (input.sdir?.screen.regions !== undefined) {
          const drifted = input.sdir.screen.regions.filter(
            (region) => !artifact.semantic_refs.regions.includes(region.id),
          );
          if (drifted.length > 0) {
            failure = `SDIR regions missing from the approved artifact: ${drifted.map((region) => region.id).join(", ")}.`;
          }
        }
      }
      findings.push({
        check_id: "design_representation_coverage",
        kind: "deterministic",
        outcome: failure === undefined ? "pass" : "fail",
        message:
          failure ??
          input.plan.checks.find((candidate) => candidate.id === "design_representation_coverage")!.requirement,
        source: "prax-validator",
      });
    }
```

3h. Add `"design_representation_coverage"` to the skip list in the evidence loop (the condition listing semantic_conformance/state_completeness/delta_conformance).

3i. Enforce two-sided drift evidence. After the evidence loop, before computing `missingEvidence`:

```ts
    const driftEvidence = provided.get("representation_runtime_drift");
    const driftInsufficient =
      driftEvidence !== undefined && (driftEvidence.artifact_refs?.length ?? 0) < 2;
    if (driftInsufficient) {
      const finding = findings.find((candidate) => candidate.check_id === "representation_runtime_drift");
      if (finding !== undefined) {
        finding.outcome = "inconclusive";
        finding.message = `${finding.message}; two artifact_refs are required (approved snapshot, runtime snapshot).`;
      }
    }
```

and change the `missingEvidence` computation to include it:

```ts
    const missingEvidence = input.plan.checks
      .filter(
        (check) =>
          (check.evidence_required && !provided.has(check.id)) ||
          (check.id === "representation_runtime_drift" && driftInsufficient),
      )
      .map((check) => check.id);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/realization-validator.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/prax-validator/src/validator.ts tests/realization-validator.test.ts
git commit -m "feat(validator): representation drift checks with fail-closed deterministic evaluator"
```

---

### Task 5: Context compiler — representation section

**Files:**
- Modify: `packages/prax-runtime/src/context-compiler.ts`
- Test: `tests/context-compilation.test.ts` (append one `it`)

- [ ] **Step 1: Write the failing test** — append inside the compilation describe in `tests/context-compilation.test.ts` (that file has no session factory; inline the minimal session literal):

```ts
  it("compiles the approved representation mapping for implementing agents", () => {
    const session: DesignSession = {
      id: "ds_repr", project_root: "/tmp/p", mode: "greenfield", phase: "IMPLEMENTATION_READY",
      created_at: "2026-08-28T00:00:00.000Z", updated_at: "2026-08-28T00:00:00.000Z", revision: 3,
      requirement_ref: "requirement.md", completed_gates: ["confirm", "framing", "context", "route", "decide", "sdir", "reconcile", "realize"],
      current_gate: { name: "prepare" }, disclosures: [], routing_history: [], artifacts: {},
      unresolved: [], warnings: [], design_authorities: [],
    };
    const { compiled, trace } = compileContext({
      session,
      planRevision: 1,
      planCheckIds: ["design_representation_coverage"],
      corrections: [],
      representation: {
        provider: "figma",
        file_key: "fk",
        approved_anchor: { round: 2, sdir_digest: "digest-1", screenshot_digests: [{ ref: "rep-evidence/round-2/hero.png", sha256: "abc" }] },
        region_frames: [
          { region: "hero", node_id: "n1", name: "Hero" },
          { region: "cta", node_id: "n2", name: "CTA" },
        ],
      },
    });
    expect(compiled.representation).toMatchObject({
      provider: "figma",
      file_key: "fk",
      approved_anchor: { round: 2, sdir_digest: "digest-1" },
    });
    expect(compiled.representation?.region_frames).toHaveLength(2);
    expect(JSON.stringify(trace.selected)).toContain("representation");
  });
```

Add `compileContext` and `type DesignSession` to that file's `prax-runtime` import if not already present.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/context-compilation.test.ts`
Expected: FAIL — no `representation` input/field.

- [ ] **Step 3: Implement in `packages/prax-runtime/src/context-compiler.ts`**

Add to `CompiledContextSchema` (after `corrections`):

```ts
  representation: z
    .object({
      provider: NonEmpty,
      file_key: NonEmpty,
      approved_anchor: z.object({
        round: z.number().int().positive(),
        sdir_digest: NonEmpty,
        screenshot_digests: z.array(z.object({ ref: NonEmpty, sha256: NonEmpty })).default([]),
      }),
      region_frames: z.array(z.object({ region: NonEmpty, node_id: NonEmpty, name: NonEmpty })).min(1),
    })
    .optional(),
```

Extend `CompileContextInput`:

```ts
  representation?: {
    provider: string;
    file_key: string;
    approved_anchor: { round: number; sdir_digest: string; screenshot_digests: Array<{ ref: string; sha256: string }> };
    region_frames: Array<{ region: string; node_id: string; name: string }>;
  } | undefined;
```

In `compileContext`, destructure `representation` from input, add to the `CompiledContextSchema.parse({...})` call:

```ts
    ...(representation === undefined ? {} : { representation }),
```

and to `trace.selected`:

```ts
      ...(representation === undefined
        ? []
        : [{ ref: "representation", reason: representation.region_frames.map((frame) => `${frame.region}->${frame.node_id}`) }]),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/context-compilation.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/prax-runtime/src/context-compiler.ts tests/context-compilation.test.ts
git commit -m "feat(runtime): compiled context gains the approved representation mapping"
```

---

### Task 6: MCP input schema (flat)

**Files:**
- Modify: `packages/prax-mcp/src/schemas.ts`
- Test: `tests/mcp-client-schema.test.ts` (append describe)

- [ ] **Step 1: Write the failing test**

Append to `tests/mcp-client-schema.test.ts`:

```ts
describe("client-facing design_realize schema (flat, no anyOf)", () => {
  it("serializes to a single flat object schema", () => {
    const json = toJSONSchema(DesignRealizeInputSchema, { target: "draft-2020-12", io: "input" });
    expect(json.type).toBe("object");
    expect((json as { anyOf?: unknown }).anyOf).toBeUndefined();
    expect((json as { additionalProperties?: unknown }).additionalProperties).toBeUndefined();
  });

  it("accepts propose and review payloads without nested unions", () => {
    const propose = DesignRealizeInputSchema.safeParse({
      design_session_id: "ds_x",
      mode: "propose",
      realization_mode: "figma_first",
      provider: "figma",
      conditions: [{ id: "greenfield", holds: true, basis: "greenfield session" }],
    });
    expect(propose.success).toBe(true);
    const review = DesignRealizeInputSchema.safeParse({
      design_session_id: "ds_x",
      mode: "submit_review",
      status: "approved",
      provider_refs_verified: { file_key: "fk", frame_node_ids: ["n1"] },
      evidence: [
        { type: "screenshot", ref: "rep-evidence/round-1/hero.png" },
        { type: "human_decision", actor_ref: "user:x", source_type: "conversation", source_ref: "m1", quote: "approved" },
      ],
    });
    expect(review.success).toBe(true);
  });
});
```

adding `DesignRealizeInputSchema` to the existing `import { PraxService, DesignStartClientSchema } from "prax-mcp";` line.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/mcp-client-schema.test.ts`
Expected: FAIL — no export `DesignRealizeInputSchema`.

- [ ] **Step 3: Implement schema in `packages/prax-mcp/src/schemas.ts`**

Extend the `prax-runtime` import with `ProviderRefsSchema, RealizationModeSchema`. Append:

```ts
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

export type DesignRealizeInput = z.infer<typeof DesignRealizeInputSchema>;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/mcp-client-schema.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/prax-mcp/src/schemas.ts tests/mcp-client-schema.test.ts
git commit -m "feat(mcp): design_realize flat input schema"
```

---

### Task 7: Service — designRealize + server registration + prepare enforcement + plan digests + evaluate wiring

**Files:**
- Modify: `packages/prax-mcp/src/service.ts`
- Modify: `packages/prax-mcp/src/server.ts`
- Modify: `tests/fixtures.ts` (condition fixtures)
- Test: `tests/realization-e2e.test.ts` (new), `tests/mcp-protocol.test.ts` (tool list)

- [ ] **Step 1: Add fixtures to `tests/fixtures.ts`**

Append:

```ts
export function figmaFirstConditions(
  holds: Partial<Record<string, boolean>> = {},
): RealizationCondition[] {
  const all: Array<[string, string]> = [
    ["greenfield", "session mode is greenfield"],
    ["high_visual_uncertainty", "brand hero has no settled visual language"],
    ["marketing_editorial", "product landing page"],
    ["stakeholder_visual_approval", "product owner approves visuals in Figma"],
    ["spatial_exploration_value", "layout exploration precedes code"],
    ["runtime_dependency_low", "static marketing page"],
  ];
  return all.map(([id, basis]) => ({ id, holds: holds[id] ?? true, basis }));
}

export function directCodeConditions(): RealizationCondition[] {
  return [
    { id: "defect_fix_fit", holds: false, basis: "not a defect fix" },
    { id: "visual_polish_fit", holds: false, basis: "not a polish pass" },
    { id: "small_modification", holds: false, basis: "full greenfield surface" },
    { id: "mature_design_system", holds: false, basis: "no design system yet" },
  ];
}
```

with `import type { RealizationCondition } from "prax-runtime";` added to the file's imports.

- [ ] **Step 2: Write the failing e2e test** — create `tests/realization-e2e.test.ts`:

```ts
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { FileSessionStore } from "prax-runtime";
import { PraxService } from "prax-mcp";
import {
  architectureCapabilities,
  architectureContext,
  architectureDecisions,
  architectureProductFrame,
  directCodeConditions,
  figmaFirstConditions,
  requirementConfirmation,
} from "./fixtures.js";

const cleanup: string[] = [];
afterEach(async () => {
  await Promise.all(cleanup.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

async function startGreenfield(sessionId: string) {
  const root = await mkdtemp(join(tmpdir(), "prax-realize-"));
  cleanup.push(root);
  const projectRoot = join(root, "project");
  await mkdir(projectRoot);
  const store = new FileSessionStore({ stateRoot: join(root, "state"), idGenerator: () => sessionId });
  const service = await PraxService.create({ sessions: store });
  const started = await service.designStart({
    requirement: "Build the Prax product landing page.",
    project_root: projectRoot,
    mode: "greenfield",
    requirement_confirmation: requirementConfirmation(),
  });
  expect(started.status).toBe("PASS");
  return { service, store };
}

async function driveToReconcile(service: PraxService, sessionId: string) {
  await service.designFrame({ design_session_id: sessionId, product_frame: architectureProductFrame() });
  await service.designContext({ design_session_id: sessionId, design_context: architectureContext() });
  const routed = await service.designRoute({ design_session_id: sessionId, question: "Choose the landing page structure" });
  const patternId = (routed.patterns as Array<{ id: string }>)[0]?.id ?? "PAT-CANVAS-WORKSPACE";
  await service.designInspect({
    design_session_id: sessionId,
    ids: [patternId],
    depth: "L1",
    purpose: { kind: "compare_alternatives", target_ids: [patternId], question: "Confirm pattern" },
  });
  await service.designDecide({ design_session_id: sessionId, design_decisions: architectureDecisions(sessionId) });
  const sdir = await service.designSdir({ design_session_id: sessionId, mode: "generate_from_decisions" });
  expect(sdir.status).toBe("PASS");
  await service.designReconcile({ design_session_id: sessionId, capability_map: architectureCapabilities() });
  const regions = (sdir.sdir as { screen: { regions: Array<{ id: string }> } }).screen.regions.map((region) => region.id);
  return regions;
}

async function writeEvidence(store: FileSessionStore, sessionId: string, round: number, name: string) {
  const dir = await store.artifactDirectory(sessionId);
  await mkdir(join(dir, "rep-evidence", `round-${round}`), { recursive: true });
  const file = join(dir, "rep-evidence", `round-${round}`, name);
  await writeFile(file, Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]));
  return `rep-evidence/round-${round}/${name}`;
}

async function writeRuntimeSnapshot(store: FileSessionStore, sessionId: string, name: string) {
  const dir = await store.artifactDirectory(sessionId);
  await mkdir(join(dir, "rep-evidence"), { recursive: true });
  const file = join(dir, "rep-evidence", `runtime-${name}`);
  await writeFile(file, Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  return `rep-evidence/runtime-${name}`;
}

function draftRefs(regions: string[]) {
  return {
    file_key: "figma-landing",
    frames: regions.map((region, index) => ({ node_id: `node-${index + 1}`, name: `Frame ${index + 1}`, sdir_region: region })),
  };
}

const HUMAN_DECISION = {
  type: "human_decision" as const,
  actor_ref: "user:SiChuchen",
  source_type: "conversation",
  source_ref: "claude-code-session",
  quote: "approved after hero revision",
};

describe("design_realize end to end", () => {
  it("runs figma_first propose → draft → review → prepare → validate with drift checks", async () => {
    const sessionId = "ds_realize_full";
    const { service, store } = await startGreenfield(sessionId);
    const regions = await driveToReconcile(service, sessionId);

    const prepareWithoutDecision = await service.designPrepareImplementation({ design_session_id: sessionId, platform: "web_desktop", framework: "react" });
    expect(prepareWithoutDecision).toMatchObject({ status: "BLOCK", code: "REALIZATION_REQUIRED" });

    const proposed = await service.designRealize({
      design_session_id: sessionId,
      mode: "propose",
      realization_mode: "figma_first",
      provider: "figma",
      conditions: figmaFirstConditions(),
    });
    expect(proposed.status).toBe("PASS");
    expect(proposed.phase).toBe("REALIZATION");

    const prepareBeforeReview = await service.designPrepareImplementation({ design_session_id: sessionId, platform: "web_desktop", framework: "react" });
    expect(prepareBeforeReview).toMatchObject({ status: "BLOCK" });

    const partial = await service.designRealize({
      design_session_id: sessionId,
      mode: "submit_draft",
      provider_refs: { file_key: "figma-landing", frames: [draftRefs(regions).frames[0]!] },
    });
    expect(partial).toMatchObject({ status: "EXPAND" });

    const draft = await service.designRealize({ design_session_id: sessionId, mode: "submit_draft", provider_refs: draftRefs(regions) });
    expect(draft.status).toBe("REVIEW");

    const refsMismatch = await service.designRealize({
      design_session_id: sessionId,
      mode: "submit_review",
      status: "approved",
      provider_refs_verified: { file_key: "figma-landing", frame_node_ids: ["node-1"] },
      evidence: [{ ...HUMAN_DECISION }],
    });
    expect(refsMismatch).toMatchObject({ status: "RETRY" });

    const heroRef = await writeEvidence(store, sessionId, 1, "hero.png");
    const approved = await service.designRealize({
      design_session_id: sessionId,
      mode: "submit_review",
      status: "approved",
      provider_refs_verified: { file_key: "figma-landing", frame_node_ids: draftRefs(regions).frames.map((frame) => frame.node_id) },
      feedback: { text: "approved" },
      evidence: [{ type: "screenshot", ref: heroRef }, HUMAN_DECISION],
    });
    expect(approved.status).toBe("PASS");

    const locked = await service.designRealize({
      design_session_id: sessionId,
      mode: "propose",
      realization_mode: "direct_code",
      conditions: directCodeConditions(),
    });
    expect(locked).toMatchObject({ status: "BLOCK", code: "REALIZATION_LOCKED" });

    const prepared = await service.designPrepareImplementation({ design_session_id: sessionId, platform: "web_desktop", framework: "react" });
    expect(prepared.status).toBe("PASS");
    const brief = prepared.implementation_brief as { realization: Record<string, unknown> };
    expect(brief.realization).toMatchObject({ mode: "figma_first", provider: "figma" });
    const compiled = prepared.compiled_context as { representation?: { region_frames: unknown[] } };
    expect(compiled.representation?.region_frames).toHaveLength(regions.length);

    const planned = await service.designValidate({ design_session_id: sessionId, mode: "plan" });
    const checks = planned.checks as Array<{ id: string; evidence_required: boolean }>;
    expect(checks.map((check) => check.id)).toContain("design_representation_coverage");
    const runtimeRef = await writeRuntimeSnapshot(store, sessionId, "landing.png");
    const evidence = {
      submitted_by: "realize-e2e",
      collected_at: new Date().toISOString(),
      items: [
        ...checks
          .filter((check) => check.evidence_required && check.id !== "representation_runtime_drift")
          .map((check) => ({ check_id: check.id, outcome: "pass" as const, source: "e2e review", notes: `${check.id} ok` })),
        {
          check_id: "representation_runtime_drift",
          outcome: "pass" as const,
          source: "visual diff",
          notes: "runtime page matches approved frames",
          artifact_refs: [heroRef, runtimeRef],
        },
      ],
    };
    const submitted = await service.designValidate({ design_session_id: sessionId, mode: "submit_evidence", evidence });
    expect(submitted.status).toBe("PASS");
    const evaluated = await service.designValidate({ design_session_id: sessionId, mode: "evaluate" });
    expect(evaluated.status).toBe("PASS");
    expect(evaluated.phase).toBe("COMPLETE");
  });

  it("loops a rejected review and records full history", async () => {
    const sessionId = "ds_realize_reject";
    const { service, store } = await startGreenfield(sessionId);
    const regions = await driveToReconcile(service, sessionId);
    await service.designRealize({
      design_session_id: sessionId,
      mode: "propose",
      realization_mode: "figma_first",
      provider: "figma",
      conditions: figmaFirstConditions(),
    });
    await service.designRealize({ design_session_id: sessionId, mode: "submit_draft", provider_refs: draftRefs(regions) });
    const heroRef = await writeEvidence(store, sessionId, 1, "hero.png");
    const rejected = await service.designRealize({
      design_session_id: sessionId,
      mode: "submit_review",
      status: "rejected",
      provider_refs_verified: { file_key: "figma-landing", frame_node_ids: draftRefs(regions).frames.map((frame) => frame.node_id) },
      feedback: { text: "hero too weak", region_annotations: [{ sdir_region: regions[0]!, note: "contrast" }] },
      evidence: [{ type: "screenshot", ref: heroRef }, HUMAN_DECISION],
    });
    expect(rejected.status).toBe("REVIEW");
    const session = await store.getSession(sessionId);
    const artifact = await store.readArtifact<{ status: string }>(session, "representationArtifact");
    expect(artifact?.status).toBe("revision_requested");

    await service.designRealize({ design_session_id: sessionId, mode: "submit_draft", provider_refs: draftRefs(regions) });
    const heroRef2 = await writeEvidence(store, sessionId, 2, "hero.png");
    const approved = await service.designRealize({
      design_session_id: sessionId,
      mode: "submit_review",
      status: "approved",
      provider_refs_verified: { file_key: "figma-landing", frame_node_ids: draftRefs(regions).frames.map((frame) => frame.node_id) },
      feedback: { text: "approved" },
      evidence: [{ type: "screenshot", ref: heroRef2 }, HUMAN_DECISION],
    });
    expect(approved.status).toBe("PASS");
    const review = await store.readArtifact<{ round: number; history: unknown[] }>(session, "representationReview");
    expect(review?.round).toBe(2);
    expect(review?.history).toHaveLength(1);
  });

  it("explicit direct_code proposals reach prepare and plans carry no representation checks", async () => {
    const sessionId = "ds_realize_direct";
    const { service, store } = await startGreenfield(sessionId);
    await driveToReconcile(service, sessionId);
    const proposed = await service.designRealize({
      design_session_id: sessionId,
      mode: "propose",
      realization_mode: "direct_code",
      conditions: directCodeConditions(),
    });
    expect(proposed).toMatchObject({ status: "PASS" });
    expect(proposed.next).toEqual({ tool: "design_prepare_implementation" });
    const prepared = await service.designPrepareImplementation({ design_session_id: sessionId, platform: "web_desktop", framework: "react" });
    expect(prepared.status).toBe("PASS");
    expect((prepared.implementation_brief as { realization: { mode: string } }).realization.mode).toBe("direct_code");
    const planned = await service.designValidate({ design_session_id: sessionId, mode: "plan" });
    expect((planned.checks as Array<{ id: string }>).some((check) => check.id === "design_representation_coverage")).toBe(false);
  });

  it("flips figma_first → direct_code before approval, abandoning the artifact and unblocking prepare", async () => {
    const sessionId = "ds_realize_flip";
    const { service } = await startGreenfield(sessionId);
    await driveToReconcile(service, sessionId);
    await service.designRealize({
      design_session_id: sessionId,
      mode: "propose",
      realization_mode: "figma_first",
      provider: "figma",
      conditions: figmaFirstConditions(),
    });
    const noReason = await service.designRealize({
      design_session_id: sessionId,
      mode: "propose",
      realization_mode: "direct_code",
      conditions: directCodeConditions(),
    });
    expect(noReason).toMatchObject({ status: "EXPAND" });
    const flipped = await service.designRealize({
      design_session_id: sessionId,
      mode: "propose",
      realization_mode: "direct_code",
      conditions: directCodeConditions(),
      reason: "figma write seat unavailable",
    });
    expect(flipped.status).toBe("PASS");
    const prepared = await service.designPrepareImplementation({ design_session_id: sessionId, platform: "web_desktop", framework: "react" });
    expect(prepared.status).toBe("PASS");
  });

  it("reviews an unfit figma_first proposal without persisting anything", async () => {
    const sessionId = "ds_realize_review";
    const { service, store } = await startGreenfield(sessionId);
    await driveToReconcile(service, sessionId);
    const unfit = await service.designRealize({
      design_session_id: sessionId,
      mode: "propose",
      realization_mode: "figma_first",
      provider: "figma",
      conditions: figmaFirstConditions({ runtime_dependency_low: false }),
    });
    expect(unfit).toMatchObject({ status: "REVIEW", code: "REALIZATION_MODE_MISMATCH" });
    const session = await store.getSession(sessionId);
    expect(session.artifacts.realizationDecision).toBeUndefined();
    expect(await store.readArtifact(session, "representationArtifact")).toBeUndefined();
  });

  it("leaves v1 legacy sessions untouched: prepare without realization and design_realize unreachable", async () => {
    const root = await mkdtemp(join(tmpdir(), "prax-realize-v1-"));
    cleanup.push(root);
    const projectRoot = join(root, "project");
    await mkdir(projectRoot);
    const store = new FileSessionStore({ stateRoot: join(root, "state"), idGenerator: () => "ds_realize_v1" });
    const service = await PraxService.create({ sessions: store });
    await store.createSession({
      projectRoot,
      requirement: "Legacy v1 session",
      mode: "greenfield",
      lifecyclePolicy: {
        version: "1",
        mode: "greenfield",
        gates: ["framing", "context", "route", "decide", "sdir", "reconcile", "prepare", "validate"],
      },
    });
    await service.designFrame({ design_session_id: "ds_realize_v1", product_frame: architectureProductFrame() });
    await service.designContext({ design_session_id: "ds_realize_v1", design_context: architectureContext() });
    const routed = await service.designRoute({ design_session_id: "ds_realize_v1", question: "structure" });
    const patternId = (routed.patterns as Array<{ id: string }>)[0]?.id ?? "PAT-CANVAS-WORKSPACE";
    await service.designInspect({
      design_session_id: "ds_realize_v1",
      ids: [patternId],
      depth: "L1",
      purpose: { kind: "compare_alternatives", target_ids: [patternId], question: "confirm" },
    });
    await service.designDecide({ design_session_id: "ds_realize_v1", design_decisions: architectureDecisions("ds_realize_v1") });
    await service.designSdir({ design_session_id: "ds_realize_v1", mode: "generate_from_decisions" });
    await service.designReconcile({ design_session_id: "ds_realize_v1", capability_map: architectureCapabilities() });
    const realized = await service.designRealize({
      design_session_id: "ds_realize_v1",
      mode: "propose",
      realization_mode: "direct_code",
      conditions: directCodeConditions(),
    });
    expect(realized).toMatchObject({ status: "BLOCK", code: "REALIZATION_WINDOW_INVALID" });
    const prepared = await service.designPrepareImplementation({ design_session_id: "ds_realize_v1", platform: "web_desktop", framework: "react" });
    expect(prepared.status).toBe("PASS");
    expect((prepared.implementation_brief as { realization?: unknown }).realization).toBeUndefined();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- tests/realization-e2e.test.ts`
Expected: FAIL — `service.designRealize` is not a function.

- [ ] **Step 4: Implement in `packages/prax-mcp/src/service.ts`**

4a. Extend the `prax-runtime` import with: `normalizeCompletedGates`, `removeRealizeGate`, `spliceRealizeGate`, `validateDraft`, `validatePropose`, `validateReview`, and types `RealizationDecision`, `RepresentationArtifact`, `RepresentationReview`. Extend the `./schemas.js` type import with `DesignRealizeInput`.

4b. Add the method (place after `designReconcile`):

```ts
  public async designRealize(input: DesignRealizeInput): Promise<PraxOutput> {
    const session = await this.sessions.getSession(input.design_session_id);
    const policy = sessionPolicy(session);
    if (policy.version !== "2" || !policy.gates.includes("sdir")) {
      return {
        status: "BLOCK",
        code: "REALIZATION_WINDOW_INVALID",
        message: "design_realize applies to v2 full-SDIR sessions only; this session has no realization decision point.",
        next: nextTool(NEXT_TOOL_BY_GATE[currentGate(session)]),
      };
    }
    if (normalizeCompletedGates(session.completed_gates).includes("realize")) {
      return {
        status: "BLOCK",
        code: "REALIZATION_LOCKED",
        message: "The realize gate is already completed; changing the realization strategy requires a new design change.",
        next: nextTool(NEXT_TOOL_BY_GATE[currentGate(session)]),
      };
    }
    const gate = currentGate(session);
    const now = this.sessions.nowIso();

    if (input.mode === "propose") {
      if (gate !== "prepare" && gate !== "realize") {
        return {
          status: "BLOCK",
          code: "REALIZATION_WINDOW_INVALID",
          message: `realization proposals are accepted after sdir/reconcile and before prepare (current gate: ${gate}).`,
          next: nextTool(NEXT_TOOL_BY_GATE[gate]),
        };
      }
      const priorDecision =
        (await this.sessions.readArtifact<RealizationDecision>(session, "realizationDecision")) ?? undefined;
      const validation = validatePropose(
        {
          realization_mode: input.realization_mode!,
          provider: input.provider,
          conditions: input.conditions!,
          reason: input.reason,
          override: input.override,
          override_reason: input.override_reason,
        },
        { mode: session.mode },
        { now, priorDecision },
      );
      if (validation.status !== "PASS" && validation.status !== "WARN") {
        return {
          status: validation.status,
          code: validation.codes?.[0],
          issues: validation.issues,
          warnings: validation.warnings,
          recommended_realization_mode: validation.codes?.includes("REALIZATION_MODE_MISMATCH") ? "direct_code" : undefined,
          next: nextTool("design_realize"),
        };
      }
      const decision = validation.value!;
      if (decision.realization_mode === "figma_first") {
        const sdir = await this.requireArtifact<Sdir>(session, "sdir");
        const artifact: RepresentationArtifact = {
          version: "0.1",
          id: `rep-${session.id}`,
          representation: { role: "primary" },
          semantic_refs: {
            sdir_ref: "screen.sdir.yaml",
            sdir_digest: contentDigest(sdir),
            regions: sdir.screen.regions.map((region) => region.id),
          },
          realization: {
            provider: decision.provider!,
            provider_contract_version: decision.provider_contract_version!,
            refs: null,
          },
          status: "pending_generation",
          validation: ["design_representation_coverage", "representation_runtime_drift"],
        };
        const updated: DesignSession = {
          ...touch(session, now),
          lifecycle_policy: spliceRealizeGate(policy),
          phase: "REALIZATION",
          current_gate: { name: "realize" },
        };
        await this.sessions.commit(updated, [
          { key: "realizationDecision", value: decision },
          { key: "representationArtifact", value: artifact },
        ]);
        return {
          status: validation.status,
          realization_decision: decision,
          representation_artifact: artifact,
          warnings: validation.warnings,
          phase: updated.phase,
          next: nextTool("design_realize"),
        };
      }
      const priorArtifact =
        (await this.sessions.readArtifact<RepresentationArtifact>(session, "representationArtifact")) ?? undefined;
      let updated: DesignSession = touch(session, now);
      const writes: Array<{ key: "realizationDecision" | "representationArtifact"; value: unknown }> = [
        { key: "realizationDecision", value: decision },
      ];
      if (gate === "realize" && priorArtifact !== undefined && priorArtifact.status !== "abandoned") {
        updated = {
          ...updated,
          lifecycle_policy: removeRealizeGate(policy),
          phase: "IMPLEMENTATION_READY",
          current_gate: { name: "prepare" },
        };
        writes.push({ key: "representationArtifact", value: { ...priorArtifact, status: "abandoned" } });
      }
      await this.sessions.commit(updated, writes);
      return {
        status: validation.status,
        realization_decision: decision,
        warnings: validation.warnings,
        phase: updated.phase,
        next: nextTool("design_prepare_implementation"),
      };
    }

    if (gate !== "realize") {
      return {
        status: "BLOCK",
        code: "REALIZATION_WINDOW_INVALID",
        message: `submit_draft/submit_review require the realize gate (current gate: ${gate}).`,
        next: nextTool(NEXT_TOOL_BY_GATE[gate]),
      };
    }
    const decision = await this.requireArtifact<RealizationDecision>(session, "realizationDecision");
    if (decision.realization_mode !== "figma_first") {
      return {
        status: "BLOCK",
        code: "REALIZATION_MODE_INVALID",
        message: "The recorded realization decision is direct_code; re-propose before submitting representation payloads.",
        next: nextTool("design_realize"),
      };
    }
    const artifact = await this.requireArtifact<RepresentationArtifact>(session, "representationArtifact");
    const priorReview =
      (await this.sessions.readArtifact<RepresentationReview>(session, "representationReview")) ?? undefined;

    if (input.mode === "submit_draft") {
      if (artifact.status !== "pending_generation" && artifact.status !== "revision_requested") {
        return {
          status: "BLOCK",
          code: "REALIZATION_WINDOW_INVALID",
          message: `submit_draft expects pending_generation or revision_requested (current: ${artifact.status}).`,
          next: nextTool("design_realize"),
        };
      }
      const validation = validateDraft(input.provider_refs!, artifact);
      if (validation.status !== "PASS") {
        return {
          status: validation.status,
          code: validation.codes?.[0],
          issues: validation.issues,
          warnings: [],
          next: nextTool("design_realize"),
        };
      }
      const updatedArtifact = {
        ...artifact,
        realization: { ...artifact.realization, refs: input.provider_refs! },
        status: "under_review" as const,
      };
      await this.sessions.commit(touch(session, now), [{ key: "representationArtifact", value: updatedArtifact }]);
      return {
        status: "REVIEW",
        message: "Representation draft recorded. Human review in the provider surface is required before design_prepare_implementation.",
        phase: session.phase,
        next: nextTool("design_realize"),
      };
    }

    if (artifact.status !== "under_review") {
      return {
        status: "BLOCK",
        code: "REALIZATION_WINDOW_INVALID",
        message: `submit_review expects under_review (current: ${artifact.status}).`,
        next: nextTool("design_realize"),
      };
    }
    const sdir = await this.requireArtifact<Sdir>(session, "sdir");
    if (contentDigest(sdir) !== artifact.semantic_refs.sdir_digest) {
      await this.sessions.commit(touch(session, now), [
        { key: "representationArtifact", value: { ...artifact, status: "revision_requested" } },
      ]);
      return {
        status: "BLOCK",
        code: "REALIZATION_SDIR_DRIFT",
        message: "The SDIR changed after the representation was generated; the artifact was reset to revision_requested — submit_draft again against the new SDIR.",
        next: nextTool("design_realize"),
      };
    }
    const sessionDirectory = await this.sessions.artifactDirectory(session.id);
    const round = (priorReview?.round ?? 0) + 1;
    const validation = await validateReview(
      {
        status: input.status!,
        provider_refs_verified: input.provider_refs_verified!,
        feedback: input.feedback,
        evidence: input.evidence!,
      },
      artifact,
      { sessionDirectory, now, expectedRound: round },
    );
    if (validation.status !== "PASS") {
      return {
        status: validation.status,
        code: validation.codes?.[0],
        issues: validation.issues,
        warnings: validation.warnings,
        next: nextTool("design_realize"),
      };
    }
    const record = { ...validation.value!, round };
    const priorRecord = priorReview === undefined
      ? undefined
      : {
          round: priorReview.round,
          status: priorReview.status,
          provider_refs_verified: priorReview.provider_refs_verified,
          ...(priorReview.feedback === undefined ? {} : { feedback: priorReview.feedback }),
          evidence: priorReview.evidence,
          decided_at: priorReview.decided_at,
          sdir_digest_at_review: priorReview.sdir_digest_at_review,
        };
    const history = [...(priorReview?.history ?? []), ...(priorRecord === undefined ? [] : [priorRecord])];
    if (record.status === "approved") {
      const review = RepresentationReviewSchema.parse({ version: "0.1", ...record, history });
      const updated = advanceSession(session, "realize", now);
      await this.sessions.commit(updated, [
        { key: "representationArtifact", value: { ...artifact, status: "approved" } },
        { key: "representationReview", value: review },
      ]);
      return {
        status: "PASS",
        representation_review: review,
        phase: updated.phase,
        next: nextTool("design_prepare_implementation"),
      };
    }
    const review = RepresentationReviewSchema.parse({
      version: "0.1",
      ...record,
      history,
    });
    await this.sessions.commit(touch(session, now), [
      { key: "representationArtifact", value: { ...artifact, status: "revision_requested" } },
      { key: "representationReview", value: review },
    ]);
    return {
      status: "REVIEW",
      representation_review: review,
      phase: session.phase,
      next: nextTool("design_realize"),
    };
  }
```

Add `RepresentationReviewSchema` to the prax-runtime imports.

4c. **Prepare enforcement** — in `designPrepareImplementation`, after the `capabilityMap` read and before `resolveValidationPlan`, insert:

```ts
    let realizationBlock: Record<string, unknown> | undefined;
    let representation: Parameters<typeof compileContext>[0]["representation"];
    if (policy.version === "2" && policy.gates.includes("sdir")) {
      const decision =
        (await this.sessions.readArtifact<RealizationDecision>(session, "realizationDecision")) ?? undefined;
      if (decision === undefined) {
        return {
          status: "BLOCK",
          code: "REALIZATION_REQUIRED",
          message: "v2 full-SDIR sessions must record a realization decision via design_realize before prepare.",
          next: nextTool("design_realize"),
        };
      }
      if (decision.realization_mode === "figma_first") {
        const representationArtifact =
          (await this.sessions.readArtifact<RepresentationArtifact>(session, "representationArtifact")) ?? undefined;
        const representationReview =
          (await this.sessions.readArtifact<RepresentationReview>(session, "representationReview")) ?? undefined;
        if (representationArtifact?.status !== "approved" || representationReview?.status !== "approved") {
          return {
            status: "BLOCK",
            code: "REALIZATION_REQUIRED",
            message: "figma_first sessions need an approved representation review via design_realize before prepare.",
            next: nextTool("design_realize"),
          };
        }
        if (sdirArtifact !== undefined && contentDigest(sdirArtifact) !== representationArtifact.semantic_refs.sdir_digest) {
          return {
            status: "BLOCK",
            code: "REALIZATION_SDIR_DRIFT",
            message: "The SDIR changed after representation approval; re-run draft and review via design_realize.",
            next: nextTool("design_realize"),
          };
        }
        const refs = representationArtifact.realization.refs!;
        const screenshotDigests = representationReview.evidence
          .filter((item): item is Extract<typeof item, { type: "screenshot" }> => item.type === "screenshot")
          .map((item) => ({ ref: item.ref, sha256: item.sha256 }));
        realizationBlock = {
          mode: "figma_first",
          provider: representationArtifact.realization.provider,
          provider_contract_version: representationArtifact.realization.provider_contract_version,
          representation_artifact_ref: "representation-artifact.yaml",
          review: {
            round: representationReview.round,
            decided_at: representationReview.decided_at,
            screenshot_digests: screenshotDigests,
          },
          provider_refs: refs,
          sdir_digest: representationArtifact.semantic_refs.sdir_digest,
        };
        representation = {
          provider: representationArtifact.realization.provider,
          file_key: refs.file_key,
          approved_anchor: {
            round: representationReview.round,
            sdir_digest: representationArtifact.semantic_refs.sdir_digest,
            screenshot_digests: screenshotDigests,
          },
          region_frames: refs.frames.map((frame) => ({
            region: frame.sdir_region,
            node_id: frame.node_id,
            name: frame.name,
          })),
        };
      } else {
        realizationBlock = { mode: "direct_code" };
      }
    }
```

In `implementationBrief`, add after `validation_requirements`:

```ts
      ...(realizationBlock === undefined ? {} : { realization: realizationBlock }),
```

In the `compileContext` call, add `...(representation === undefined ? {} : { representation }),`.

4d. **Plan digests** — in `resolveValidationPlan`, add the artifact reads next to the other reads (before the `const digests` declaration), then extend the digest assignments **after** `const digests: Record<string, string> = {};` (the existing assignments stay):

Reads (after the `intentLite` line):

```ts
    const realizationDecision =
      (await this.sessions.readArtifact<RealizationDecision>(session, "realizationDecision")) ?? undefined;
    const representationArtifact =
      (await this.sessions.readArtifact<RepresentationArtifact>(session, "representationArtifact")) ?? undefined;
    const representationReview =
      (await this.sessions.readArtifact<RepresentationReview>(session, "representationReview")) ?? undefined;
    const sdirForDigest = (await this.sessions.readArtifact<Sdir>(session, "sdir")) ?? undefined;
```

Assignments (after the existing `existing_understanding` assignment):

```ts
    if (sdirForDigest !== undefined) digests.sdir = contentDigest(sdirForDigest);
    if (realizationDecision !== undefined) digests.realization_decision = contentDigest(realizationDecision);
    if (representationArtifact !== undefined) digests.representation_artifact = contentDigest(representationArtifact);
    if (representationReview !== undefined) digests.representation_review = contentDigest(representationReview);
```

Note: adding the `sdir` digest grows the digest set for every full-SDIR session, so a stored pre-change plan re-derives once (revision +1). No existing test asserts the exact digest key set; revision-number assertions compare within a run and stay valid.

and in the `this.validator.plan({...})` call add:

```ts
      ...(realizationDecision?.realization_mode === undefined ? {} : { realizationMode: realizationDecision.realization_mode }),
```

4e. **Evaluate wiring** — in `designValidate`, next to the `sdirArtifact` read, add:

```ts
    const representationArtifact =
      (await this.sessions.readArtifact<RepresentationArtifact>(session, "representationArtifact")) ?? undefined;
    const representationReview =
      (await this.sessions.readArtifact<RepresentationReview>(session, "representationReview")) ?? undefined;
```

and extend the `this.validator.evaluate({...})` call:

```ts
      ...(representationArtifact === undefined ? {} : { representationArtifact }),
      ...(representationReview === undefined ? {} : { representationReview }),
      ...(representationArtifact === undefined || sdirArtifact === undefined ? {} : { sdirDigest: contentDigest(sdirArtifact) }),
```

4f. **Drift evidence verification (submit_evidence path)** — in `designValidate`, in the `submit_evidence` branch, after `const evidence = this.validator.parseEvidence(input.evidence);` add server-side verification for the structured two-sided drift evidence (ref 1 = approved snapshot ref, must match an approved review screenshot; ref 2 = runtime snapshot, must exist under the session evidence root):

```ts
      if (plan.checks.some((check) => check.id === "representation_runtime_drift")) {
        const driftItem = evidence.items.find((item) => item.check_id === "representation_runtime_drift");
        if (driftItem !== undefined) {
          const sessionDirectory = await this.sessions.artifactDirectory(session.id);
          const approvedRefs = new Set(
            (representationReview?.evidence ?? []).flatMap((item) =>
              item.type === "screenshot" ? [item.ref] : [],
            ),
          );
          const issues: string[] = [];
          if ((driftItem.artifact_refs?.length ?? 0) !== 2) {
            issues.push("representation_runtime_drift requires exactly two artifact_refs: approved snapshot ref, then runtime snapshot ref.");
          } else {
            const [approvedRef, runtimeRef] = driftItem.artifact_refs!;
            if (!approvedRefs.has(approvedRef)) {
              issues.push(`approved snapshot ref '${approvedRef}' is not among the approved review screenshots.`);
            }
            const runtimeVerified = await verifyEvidenceFile(sessionDirectory, runtimeRef);
            if (!runtimeVerified.ok) issues.push(runtimeVerified.error);
          }
          if (issues.length > 0) {
            return { status: "EXPAND", code: "REALIZATION_DRIFT_EVIDENCE_INVALID", issues, next: nextTool("design_validate") };
          }
        }
      }
```

Add `verifyEvidenceFile` to the `prax-runtime` service imports. Agents save the runtime snapshot under the session's `rep-evidence/runtime-<name>.png`; the approved side is anchored by digest to the review record.

- [ ] **Step 5: Register the tool in `packages/prax-mcp/src/server.ts`**

Add `DesignRealizeInputSchema` to the schema imports, and register between `design_reconcile` and `design_prepare_implementation`:

```ts
  server.registerTool("design_realize", {
    title: "Decide and steer design realization",
    description:
      "Propose the realization strategy (direct_code | figma_first) after SDIR; submit representation drafts and human review outcomes for figma_first sessions.",
    inputSchema: DesignRealizeInputSchema,
  }, (input) => invoke(() => service.designRealize(input)));
```

- [ ] **Step 6: Update the tool list assertion in `tests/mcp-protocol.test.ts`**

The sorted array becomes: `design_context, design_decide, design_frame, design_inspect, design_prepare_implementation, design_realize, design_reconcile, design_route, design_sdir, design_start, design_validate`.

- [ ] **Step 7: Run tests to verify they pass**

Run: `npm test -- tests/realization-e2e.test.ts tests/realization-validator.test.ts tests/mcp-protocol.test.ts`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/prax-mcp/src/service.ts packages/prax-mcp/src/server.ts tests/fixtures.ts tests/realization-e2e.test.ts tests/mcp-protocol.test.ts
git commit -m "feat(mcp): design_realize service with realize gate, review loop, and prepare enforcement"
```

---

### Task 8: Update existing tests for the v2 realization requirement

New sessions are policy v2; every greenfield/rework/add_surface chain that calls `designPrepareImplementation` must first propose `direct_code` (or the full figma_first chain). Files: `tests/validation-plan.test.ts`, `tests/service-e2e.test.ts`, `tests/lifecycle-e2e.test.ts`, `tests/correction-memory.test.ts`.

- [ ] **Step 1: Update `tests/validation-plan.test.ts`** — add the propose call inside `driveGreenfieldToPrepare` (after `designReconcile`):

```ts
  await service.designRealize({
    design_session_id: sessionId,
    mode: "propose",
    realization_mode: "direct_code",
    conditions: directCodeConditions(),
  });
```

and add `directCodeConditions` to the fixture import.

- [ ] **Step 2: Update `tests/service-e2e.test.ts`** — insert before its `designPrepareImplementation` call (after `designReconcile`):

```ts
  expect((await service.designRealize({
    design_session_id: sessionId,
    mode: "propose",
    realization_mode: "direct_code",
    conditions: directCodeConditions(),
  })).status).toBe("PASS");
```

with the fixture import extended.

- [ ] **Step 3: Update `tests/lifecycle-e2e.test.ts` and `tests/correction-memory.test.ts`** — for every chain whose policy contains the full `sdir` gate (greenfield / rework / add_surface sessions) and which reaches `designPrepareImplementation`, insert the same `designRealize` propose call immediately before the prepare call. Chains using `modify_surface`/light paths are left untouched. (Grep first: `grep -n "designPrepareImplementation" tests/lifecycle-e2e.test.ts tests/correction-memory.test.ts` and apply per call site whose session mode is full-SDIR.)

- [ ] **Step 3b: Update the two remaining full-SDIR prepare call sites**

  - `tests/context-compilation.test.ts` line ~153 (the greenfield `ds_cc_3` chain): insert the same `designRealize` propose call (with `design_session_id: "ds_cc_3"`) between `designReconcile` and `designPrepareImplementation`. The modify_surface helper at line ~81 is NOT touched.
  - `tests/lifecycle-policy.test.ts` line ~475 (the rework `ds_brief` chain): insert the same propose call (with `design_session_id: "ds_brief"`) immediately before `designPrepareImplementation`.

- [ ] **Step 4: Run the full suite**

Run: `npm test`
Expected: all previous tests PASS again plus new ones. If a digest-key assertion breaks (plan now carries `realization_decision` digest), the fix is additive — no existing assertion enumerates the full digest key set (verified: they check single keys / revision numbers only).

- [ ] **Step 5: Commit**

```bash
git add tests/validation-plan.test.ts tests/service-e2e.test.ts tests/lifecycle-e2e.test.ts tests/correction-memory.test.ts
git commit -m "test: propose direct_code before prepare in v2 full-SDIR chains"
```

---

### Task 9: Documentation — ADR-003, architecture.md, golden case

**Files:**
- Create: `docs/adr-003-realization-gate.md`
- Modify: `docs/architecture.md`
- Create: `golden/prax-landing/requirement.md`, `golden/prax-landing/run-manifest.md`

- [ ] **Step 1: Write ADR-003**

```markdown
# ADR-003: Realization Gate and the Eleventh Tool

Status: Accepted (2026-08-28)
Amends: ADR-002 decision 7 ("Tool count and names stay at ten")
Spec: `docs/superpowers/specs/2026-08-28-figma-realization-design.md`

## Context

The figma_first realization path needs a decision point between SDIR and
implementation, plus draft/review submissions that do not belong to any
existing tool's semantics. Provider integration (Figma today, other
representation providers later) made a dedicated tool cleaner than widening
`design_prepare_implementation` into a dual-purpose tool.

## Decision

1. Add `design_realize` as the eleventh tool with three payload modes:
   propose, submit_draft, submit_review.
2. Add the `realize` gate (phase REALIZATION), dynamically spliced between
   reconcile and prepare by `propose(figma_first)` and removed again on an
   unapproved flip to direct_code. Policy default tables are unchanged.
3. Lifecycle policies move to version 2 for new sessions. Realization
   enforcement (REALIZATION_REQUIRED at prepare) applies to v2 full-SDIR
   sessions only; persisted v1 sessions resume with their original behavior.
4. Figma enters as a versioned entry in a static provider table
   (`REALIZATION_PROVIDERS`); core schemas and methodology stay
   provider-agnostic. The table declares supported adapters, not runtime
   availability — Prax never connects to Figma; agents do, via MCP.
5. Approval binds evidence, not identifiers alone: SDIR content digest at
   propose/review, server-computed screenshot sha256, region coverage. The
   residual risk (same-node edits in Figma) is covered by the
   `representation_runtime_drift` check and documented as a known limitation.

## Consequences

- The ten-tool contract from ADR-002 is superseded; future capability tools
  are judged by responsibility boundaries, not a fixed count.
- `design_validate` gains a deterministic fail-closed coverage check and a
  two-sided empirical drift check for figma_first sessions.
```

- [ ] **Step 2: Update `docs/architecture.md`**

- Protocol row: `Ten staged tools only` → `Eleven staged tools (design_realize added by ADR-003)`.
- Persistence model tree: add after `capability-gaps.yaml`:

```text
├── realization-decision.yaml
├── representation-artifact.yaml    # figma_first only; SDIR-digest bound
├── representation-review.yaml      # human review rounds, append-only history
```

- Lifecycle policies paragraph: append `Policy v2 sessions with a full SDIR gate splice a realize gate between reconcile and prepare when figma_first is proposed; prepare rejects v2 full-SDIR sessions without a recorded realization decision (REALIZATION_REQUIRED).`
- Concept boundaries: append a bullet — `Figma is a Representation Surface: the authority chain is Design Contract → Representation Artifact → provider refs; runtime never connects to Figma, and same-node edits after approval are a documented residual risk covered by representation_runtime_drift evidence.`

- [ ] **Step 3: Write the golden case files**

`golden/prax-landing/requirement.md`:

```markdown
# Golden Case: Prax Landing Page (figma_first realization)

## Requirement

Design and implement the Prax product website home page. Sections: hero with
product value proposition and primary CTA, "how it works" value summary
(three-stage), capability features list, closing CTA. Audience: engineering
leads evaluating AI-assisted frontend design tooling. Tone: precise,
product-first, no marketing fluff. Static page; no complex runtime state.

## Why this case fits figma_first (Methodology §18.2)

Greenfield; high visual uncertainty (brand language unsettled);
marketing/editorial surface; stakeholder visual approval required; spatial
exploration valuable; runtime dependency low.

## Golden observations (expected per gate)

- design_decide / design_sdir complete with region set covering hero, value,
  features, CTA.
- design_realize propose → figma_first with a satisfied eligibility predicate
  (all six conditions declared; runtime_dependency_low + ≥1 fit condition true).
- submit_draft maps every SDIR region to ≥1 Figma frame (coverage check passes).
- Human review round recorded with screenshot evidence under
  rep-evidence/round-N/ and human_decision provenance; any rejection carries
  region-annotated feedback and triggers a revision round.
- design_prepare_implementation emits a realization block (provider,
  representation_artifact_ref, review round, provider_refs, sdir_digest) and the
  compiled context carries the region→frame mapping.
- validation plan contains design_representation_coverage (deterministic) and
  representation_runtime_drift (empirical, two-sided artifact_refs).
- Implementation lands in apps/prax-landing/ and validation reaches COMPLETE.

## Pass/fail

Pass = every observation above holds with zero manual gate bypasses and no
agent self-attestation warnings on the drift check. Fail = any gate bypass,
empty drift evidence, or unapproved-representation prepare.
```

`golden/prax-landing/run-manifest.md`:

```markdown
# Run Manifest — PRAX-LANDING-001 (live acceptance run)

Fill before running; freeze outputs into fixture/ after a passing run.

- agent_cli: <e.g. claude-code>
- agent_model: <model id>
- prax_commit: <commit running packages/prax-mcp>
- figma_mcp: official remote server (plugin) — record whoami seat info
- session_id: <ds_...>
- figma_file_key: <...>
- review_rounds: <n>
- result: PASS | FAIL
- notes: <deviations, provider incidents, overrides used>
```

- [ ] **Step 4: Update `README.md`** — replace the "Ten tools" wording with eleven tools including `design_realize` (propose / submit_draft / submit_review), and insert `design_realize` into the documented full-SDIR flow between `design_reconcile` and `design_prepare_implementation` with one line noting v2 full-SDIR sessions must record a realization decision before prepare (direct_code or figma_first).

- [ ] **Step 5: Commit**

```bash
git add docs/adr-003-realization-gate.md docs/architecture.md golden/prax-landing README.md
git commit -m "docs: ADR-003 realization gate; architecture, README, and prax-landing golden case"
```

---

### Task 10: Full verification

- [ ] **Step 1: Full suite**

Run: `npm test`
Expected: all tests PASS (existing suites adapted in Task 8 + new realization suites).

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Doctor smoke (optional, local)**

Run: `node packages/prax-mcp/dist/cli.js doctor`
Expected: PASS.

- [ ] **Step 4: Final state check + commit any leftovers**

```bash
git status --short
git log --oneline -8
```

Expected: clean tree; commit history readable as the feature arc.

---

## Deviations & engineering notes (subagent plan review, r2)

1. **`design_realize` is custom-gated, not in `DESIGN_OPERATIONS`** — like `design_start`: its propose window spans two gates (prepare, realize) and version/policy checks carry richer messages than `checkOperationAllowed` produces. The splice/remove helpers live in `realization.ts` (pure policy transforms) rather than `state-machine.ts`; `state-machine.ts` needs no change because `currentGate`/`advanceSession` already read the policy gates array.
2. **Commit ordering is the crash-recovery story, not a journal** — `FileSessionStore.commit` writes artifacts first and the session record last, so a crash mid-commit leaves an un-advanced session; agents re-submit and artifacts are overwritten. Building a staging/journal mechanism is out of scope (pre-existing store behavior, unchanged by this feature).
3. **SDIR drift at submit_review resets the artifact to `revision_requested`** (transactional with the BLOCK) so `submit_draft` remains reachable — no dead-end gate.
4. **Review history is append-only in one file** — the current record moves into `history` (full record, not summary) on every decided round; approved rounds preserve prior rejected rounds the same way.
5. **Drift evidence is verified server-side in `design_validate` submit_evidence**: exactly two `artifact_refs` — the first must be an approved review screenshot ref (digest-anchored), the second a runtime snapshot verified under the session `rep-evidence/` root (existence, containment, sha256 via the same verifier). The generic validator keeps the ≥2 guard as backstop.
6. **Screenshots are round-scoped** (`rep-evidence/round-<expectedRound>/`), preventing stale-round evidence; the brief and compiled anchor carry `screenshot_digests` alongside round + SDIR digest.
7. **Provider neutrality**: schema symbols are `ProviderRefsSchema`/`ProviderFrameRefSchema`, payload fields `provider_refs`/`provider_refs_verified`; `figma` survives only as a provider id and in prose. Adding a provider = new `REALIZATION_PROVIDERS` entry + condition/eligibility rules.
8. **The golden case live run is user-side by design** (human review in Figma + seat availability cannot be automated here); the service-level full chain — including drift evidence verification — is covered by `tests/realization-e2e.test.ts`.

---

## Post-implementation (user-side, outside this plan)

1. Connect the official Figma MCP (plugin / OAuth) and verify with `whoami` (seat write access).
2. Run `golden/prax-landing/` as a live session with Prax + Figma MCP mounted; user performs the human review in Figma.
3. Implementation lands in `apps/prax-landing/`.
4. Freeze the passing run into `golden/prax-landing/fixture/` (artifacts + review rounds + screenshot digests + expected gate/status/code list).
5. Push only after user confirmation.
