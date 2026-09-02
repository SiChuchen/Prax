import { copyFile, mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";
import { KnowledgeStore, loadBuiltInKnowledgeStore } from "prax-knowledge";
import { parse } from "yaml";

const exec = promisify(execFile);
const cleanup: string[] = [];
afterEach(async () => {
  await Promise.all(cleanup.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

const SCRIPT = join(process.cwd(), "packages/prax-knowledge/scripts/migrate-02.mjs");
const SOURCE = join(process.cwd(), "packages/prax-knowledge/data/knowledge.v0.1.yaml");

async function migrateCopy(): Promise<{ outDir: string; draft: Record<string, unknown> }> {
  const outDir = await mkdtemp(join(tmpdir(), "prax-k-mig-"));
  cleanup.push(outDir);
  const { stdout } = await exec("node", [SCRIPT, SOURCE, outDir]);
  expect(stdout).toContain("23");
  const draftRaw = await readdir(outDir).then((files) =>
    files.find((file) => file === "stability-assignments.draft.yaml"),
  );
  expect(draftRaw).toBeDefined();
  const draft = parse(await readFileUtf8(join(outDir, "stability-assignments.draft.yaml")));
  return { outDir, draft };
}

async function readFileUtf8(path: string): Promise<string> {
  const { readFile } = await import("node:fs/promises");
  return readFile(path, "utf8");
}

describe("knowledge 0.2 migration (Task K1, spec §7.1)", () => {
  it("migrates all 23 entries with asset_class, stability, trigger_conditions, and evidence", async () => {
    const { outDir } = await migrateCopy();
    const store = await KnowledgeStore.fromYamlFile(join(outDir, "knowledge.yaml"));
    expect(store.size()).toBe(23);
    for (const entry of store.entries()) {
      expect(entry.asset_class).toBeDefined();
      expect(["A", "B", "C"]).toContain(entry.stability);
      expect(entry.trigger_conditions).toBeDefined();
      expect(entry.evidence.authority_initial).toMatch(/^[NABCDE]$/);
      expect(entry.evidence.review_by).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
    // type → asset_class mapping (spec §7.2: platform_convention → profile, NOT a literal translation)
    const profile = store.entries().find((entry) => entry.id === "PAT-SETTINGS-SECTIONS");
    expect(profile?.asset_class).toBe("pattern");
    const convention = store.entries().filter((entry) => entry.type === "platform_convention");
    for (const entry of convention) {
      expect(entry.asset_class).toBe("profile");
    }
  });

  it("maps lifecycle to stability: the three reviewed entries → B, stable entries carry provisional A pending human confirmation", async () => {
    const { outDir, draft } = await migrateCopy();
    const raw = parse(await readFileUtf8(join(outDir, "knowledge.yaml"))) as {
      entries: Array<{ id: string; lifecycle: { status: string }; stability: string }>;
    };
    const reviewed = raw.entries.filter((entry) => entry.lifecycle.status === "reviewed");
    expect(reviewed.length).toBe(3);
    for (const entry of reviewed) {
      expect(entry.stability).toBe("B");
    }
    // the draft names every stable entry as provisional — the human handoff
    const assignments = (draft as { assignments: Array<{ id: string; stability: string; confirmed?: boolean }> }).assignments;
    expect(assignments.length).toBe(23);
    expect(assignments.every((assignment) => assignment.confirmed === false)).toBe(true);
  });

  it("maps scope task_type through the pinned synonym table and normalizes phases", async () => {
    const { outDir } = await migrateCopy();
    const raw = parse(await readFileUtf8(join(outDir, "knowledge.yaml"))) as {
      entries: Array<{ id: string; trigger_conditions: { task_type?: string[]; phase?: string[]; platform?: string[] } }>;
    };
    const allowedVerbs = new Set([
      "scan", "locate", "navigate", "compare", "monitor", "create", "edit", "manage",
      "decide", "transact", "communicate", "explore", "learn", "explain", "understand",
      "control", "troubleshoot", "complete", "review",
    ]);
    const allowedPhases = new Set(["framing", "context", "routing", "decision", "sdir", "validation"]);
    for (const entry of raw.entries) {
      for (const verb of entry.trigger_conditions.task_type ?? []) {
        expect(allowedVerbs.has(verb)).toBe(true);
      }
      for (const phase of entry.trigger_conditions.phase ?? []) {
        expect(allowedPhases.has(phase)).toBe(true);
      }
    }
  });

  it("the loader merges corpus-*.yaml files alongside knowledge.yaml", async () => {
    const { outDir } = await migrateCopy();
    await writeFile(
      join(outDir, "corpus-2026-09.test.yaml"),
      `version: "0.2"
entries:
  - id: CORPUS-TEST-01
    type: heuristic
    asset_class: heuristic
    stability: C
    name: Corpus probe
    summary: A corpus-sourced probe entry.
    category: corpus
    scope: {}
    triggers: [corpus_probe]
    trigger_conditions: { phase: [decision] }
    stability_note: provisional
    lifecycle: { status: draft }
    evidence: { authority_initial: C, review_by: "2026-10-01" }
    provenance: { source_refs: [corpus-2026-09], authority_category: project_evidence, certainty: low, recommendation_strength: weak }
    validation: { mode: assistive, checks: [] }
    statement: A corpus probe statement.
    applies_when: [probing]
    rationale: Loader merge verification.
`,
      "utf8",
    );
    const store = await KnowledgeStore.fromDirectory(outDir);
    expect(store.size()).toBe(24);
    expect(store.get("CORPUS-TEST-01")?.name).toBe("Corpus probe");
  });

  it("myth asset_class entries require refutation and correct_ref", async () => {
    const mythSeed = `version: "0.2"
entries:
  - id: myth-card-grid-default
    type: myth
    asset_class: myth
    stability: C
    name: Cards/grid as default
    summary: Cards and grids are not a universal default representation.
    category: negative_knowledge
    scope: {}
    triggers: [cards, grid]
    trigger_conditions: { representation: [cards, grid] }
    lifecycle: { status: draft }
    evidence: { authority_initial: B, review_by: "2026-10-01" }
    provenance: { source_refs: [research-v0.1-§5], authority_category: sample_coding, certainty: high, recommendation_strength: strong }
    validation: { mode: assistive, checks: [] }
    statement: Cards are the default representation for content collections.
    applies_when: [never as default]
    rationale: 4.2% of 120 coded samples use cards/grid as the primary representation.
    refutation: The 120-sample corpus shows cards/grid primary at 4.2%; generalizing it as default is unjustified (research §5, §4.1).
    correct_ref: PAT-DATA-EXPLORER
`;
    const dir = await mkdtemp(join(tmpdir(), "prax-k-myth-"));
    cleanup.push(dir);
    await writeFile(join(dir, "knowledge.yaml"), mythSeed, "utf8");
    const store = await KnowledgeStore.fromDirectory(dir);
    expect(store.get("myth-card-grid-default")?.refutation).toContain("4.2%");

    // a myth without refutation fails to load
    const broken = mythSeed.replace(/    refutation:.*\n/, "").replace(/    correct_ref:.*\n/, "");
    await writeFile(join(dir, "knowledge.yaml"), broken, "utf8");
    await expect(KnowledgeStore.fromDirectory(dir)).rejects.toThrow();
  });

  it("the built-in store loads after in-place migration", async () => {
    const store = await loadBuiltInKnowledgeStore();
    expect(store.size()).toBeGreaterThanOrEqual(23);
    for (const entry of store.entries()) {
      expect(entry.asset_class).toBeDefined();
    }
  });
});
