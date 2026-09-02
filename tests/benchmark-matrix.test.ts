import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parse } from "yaml";
import {
  InformationShapeSchema,
  JTBD_VERBS,
  OBJECT_TYPES,
  REPRESENTATION_PRIMITIVES,
} from "prax-sdir";

const matrixDir = resolve(import.meta.dirname, "..", "benchmarks", "product-intelligence-matrix");

async function loadYaml(relative: string): Promise<any> {
  return parse(await readFile(join(matrixDir, relative), "utf8"));
}

/** Facet keys the corpus trigger_conditions vocabulary defines (corpus-2026-09). */
const CORPUS_FACET_KEYS = [
  "task_type",
  "object_type",
  "representation",
  "density",
  "platform",
  "phase",
] as const;

describe("shapes.yaml — 10 shape prototypes (M1)", () => {
  it("pins exactly 10 shapes with unique ids and names", async () => {
    const shapes = await loadYaml("shapes.yaml");
    expect(shapes.version).toBe("0.1");
    expect(shapes.shapes).toHaveLength(10);
    const ids = shapes.shapes.map((shape: any) => shape.id);
    const names = shapes.shapes.map((shape: any) => shape.name);
    expect(new Set(ids).size).toBe(10);
    expect(new Set(names).size).toBe(10);
  });

  it("derives every information_shape from the SDIR 0.2 vocabulary (no new words)", async () => {
    const shapes = await loadYaml("shapes.yaml");
    for (const shape of shapes.shapes) {
      const parsed = InformationShapeSchema.parse(shape.information_shape);
      expect(parsed).toBeTruthy();
      expect(shape.description, `${shape.id} description`).toMatch(/\S/);
      expect(shape.seed_clause, `${shape.id} seed_clause`).toMatch(/\S/);
      expect(shape.suggested_objects.length, `${shape.id} suggested_objects`).toBeGreaterThan(0);
      for (const object of shape.suggested_objects) {
        expect(OBJECT_TYPES).toContain(object);
      }
    }
  });

  it("keeps trigger_conditions within the corpus facet vocabulary", async () => {
    const shapes = await loadYaml("shapes.yaml");
    for (const shape of shapes.shapes) {
      const keys = Object.keys(shape.trigger_conditions ?? {});
      for (const key of keys) {
        expect(CORPUS_FACET_KEYS, `${shape.id} facet key '${key}'`).toContain(key);
      }
      for (const object of shape.trigger_conditions.object_type ?? []) {
        expect(OBJECT_TYPES, `${shape.id} object_type '${object}'`).toContain(object);
      }
      for (const verb of shape.trigger_conditions.task_type ?? []) {
        expect(JTBD_VERBS, `${shape.id} task_type '${verb}'`).toContain(verb);
      }
      for (const density of shape.trigger_conditions.density ?? []) {
        expect(["low", "medium", "high"], `${shape.id} density '${density}'`).toContain(density);
      }
      for (const representation of shape.trigger_conditions.representation ?? []) {
        expect(REPRESENTATION_PRIMITIVES, `${shape.id} representation '${representation}'`).toContain(representation);
      }
    }
  });

  it("absorbs all 15 §43 example cells, prototype round-trip exact", async () => {
    const { shapes } = await loadYaml("shapes.yaml");
    const matrix = await loadYaml("matrix.yaml");
    const cellIds = matrix.cells.map((cell: any) => cell.id);
    const covered = new Set<string>();
    for (const shape of shapes) {
      expect(shape.exemplar_cells.length, `${shape.id} exemplar_cells`).toBeGreaterThan(0);
      for (const cellId of shape.exemplar_cells) {
        expect(cellIds, `${shape.id} exemplar '${cellId}'`).toContain(cellId);
        expect(covered.has(cellId), `cell '${cellId}' claimed by two shapes`).toBe(false);
        covered.add(cellId);
      }
      // the prototype IS the first exemplar's parsed shape (induction is exact on the prototype)
      const prototype = matrix.cells.find((cell: any) => cell.id === shape.exemplar_cells[0]);
      expect(InformationShapeSchema.parse(shape.information_shape)).toEqual(
        InformationShapeSchema.parse(prototype.information_shape),
      );
    }
    expect([...covered].sort()).toEqual([...cellIds].sort());
  });

  it("pins the 3 high-frequency jobs from corpus-2026-09 task_type counts", async () => {
    const shapes = await loadYaml("shapes.yaml");
    expect(shapes.high_frequency_jobs).toEqual(["decide", "locate", "explore"]);
  });
});

describe("gen-matrix — 150-cell full matrix (M1)", () => {
  const corpusPath = resolve(import.meta.dirname, "..", "packages", "prax-knowledge", "data", "corpus-2026-09.yaml");

  async function sources() {
    const [shapes, matrix, corpus] = await Promise.all([
      loadYaml("shapes.yaml"),
      loadYaml("matrix.yaml"),
      parse(await readFile(corpusPath, "utf8")),
    ]);
    return { shapes, matrix, corpus };
  }

  it("crosses 15 jobs × 10 shapes into 150 unique, well-formed cells", async () => {
    const { generateMatrix } = await import("../benchmarks/product-intelligence-matrix/gen-matrix.mjs");
    const { shapes, matrix, corpus } = await sources();
    const full = generateMatrix(shapes, matrix, corpus);
    expect(full.version).toBe("0.1");
    expect(full.cells).toHaveLength(150);
    const ids = full.cells.map((cell: any) => cell.id);
    expect(new Set(ids).size).toBe(150);
    for (const cell of full.cells) {
      expect(cell.id).toMatch(/^cell-j\d{2}-s\d{2}$/);
      expect(cell.job_shape).toMatch(/^[a-z]+ × [a-z-]+$/);
      expect(JTBD_VERBS).toContain(cell.user_job.verb);
      expect(cell.user_job.target).toMatch(/\S/);
      expect(cell.user_job.success).toMatch(/\S/);
      expect(InformationShapeSchema.parse(cell.information_shape)).toBeTruthy();
      expect(OBJECT_TYPES).toContain(cell.object_type);
      expect(cell.acceptance_seed).toMatch(/\S/);
      expect([1, 2, 3]).toContain(cell.priority);
    }
  });

  it("keeps the 15 §43 natural pairs verbatim on job/object/seed", async () => {
    const { generateMatrix } = await import("../benchmarks/product-intelligence-matrix/gen-matrix.mjs");
    const { shapes, matrix, corpus } = await sources();
    const full = generateMatrix(shapes, matrix, corpus);
    const byId = new Map<string, any>(matrix.cells.map((cell: any) => [`job:${cell.id}`, cell]));
    const shapeOf = new Map<string, any>();
    for (const shape of shapes.shapes) {
      for (const cellId of shape.exemplar_cells) shapeOf.set(cellId, shape);
    }
    for (const original of matrix.cells) {
      const shape = shapeOf.get(original.id);
      const generated = full.cells.find(
        (cell: any) =>
          cell.user_job.target === original.user_job.target &&
          cell.user_job.success === original.user_job.success &&
          cell.job_shape === `${original.user_job.verb} × ${shape.name}`,
      );
      expect(generated, `natural pair for ${original.id}`).toBeTruthy();
      expect(generated.user_job).toEqual(original.user_job);
      expect(generated.object_type).toBe(original.object_type);
      expect(generated.acceptance_seed).toBe(original.acceptance_seed);
    }
  });

  it("bands all 10 shapes × 3 high-frequency jobs at priority 1 (30 cells)", async () => {
    const { generateMatrix } = await import("../benchmarks/product-intelligence-matrix/gen-matrix.mjs");
    const { shapes, matrix, corpus } = await sources();
    const full = generateMatrix(shapes, matrix, corpus);
    const band = full.cells.filter((cell: any) => shapes.high_frequency_jobs.includes(cell.user_job.verb));
    expect(band).toHaveLength(30);
    expect(band.every((cell: any) => cell.priority === 1)).toBe(true);
    for (const shape of shapes.shapes) {
      for (const verb of shapes.high_frequency_jobs) {
        expect(
          band.some((cell: any) => cell.job_shape === `${verb} × ${shape.name}`),
          `band cell ${verb} × ${shape.name}`,
        ).toBe(true);
      }
    }
  });

  it("gives priority-1 enough verb diversity for the M2 pilot (>=5 verbs, disambiguation pin)", async () => {
    const { generateMatrix } = await import("../benchmarks/product-intelligence-matrix/gen-matrix.mjs");
    const { shapes, matrix, corpus } = await sources();
    const full = generateMatrix(shapes, matrix, corpus);
    const verbs = new Set(
      full.cells.filter((cell: any) => cell.priority === 1).map((cell: any) => cell.user_job.verb),
    );
    expect(verbs.size).toBeGreaterThanOrEqual(5);
  });

  it("is deterministic", async () => {
    const { generateMatrix } = await import("../benchmarks/product-intelligence-matrix/gen-matrix.mjs");
    const { shapes, matrix, corpus } = await sources();
    expect(generateMatrix(shapes, matrix, corpus)).toEqual(generateMatrix(shapes, matrix, corpus));
  });

  it("commits matrix-full.yaml equal to the generator output (gate M1 evidence)", async () => {
    const { generateMatrix } = await import("../benchmarks/product-intelligence-matrix/gen-matrix.mjs");
    const { shapes, matrix, corpus } = await sources();
    const committed = await loadYaml("matrix-full.yaml");
    expect(committed.cells).toHaveLength(150);
    expect(committed).toEqual(generateMatrix(shapes, matrix, corpus));
  });

  it("resolves cells from matrix.yaml then matrix-full.yaml (run-cell lookup)", async () => {
    const { loadCell } = await import("../benchmarks/product-intelligence-matrix/cells.mjs");
    const verbatim = await loadCell("cell-01");
    expect(verbatim?.user_job.verb).toBe("manage");
    const full = await loadCell("cell-j01-s02");
    expect(full?.job_shape).toBe("manage × open-collection");
    expect(full?.priority).toBeDefined();
    expect(await loadCell("cell-nope")).toBeUndefined();
  });
});
