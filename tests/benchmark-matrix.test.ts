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
