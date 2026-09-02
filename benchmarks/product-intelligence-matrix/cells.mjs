/**
 * Cell lookup for the benchmark harness: matrix.yaml first (§43 verbatim
 * 15), then matrix-full.yaml (M1 150-cell full matrix). Shared by
 * run-cell.mjs so full-matrix cell ids resolve without harness changes.
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parse } from "yaml";

const matrixDir = import.meta.dirname;
const sources = ["matrix.yaml", "matrix-full.yaml"];

export async function loadCell(cellId) {
  for (const file of sources) {
    const doc = parse(await readFile(join(matrixDir, file), "utf8"));
    const cell = doc.cells.find((entry) => entry.id === cellId);
    if (cell !== undefined) return cell;
  }
  return undefined;
}
