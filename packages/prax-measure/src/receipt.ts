import { randomUUID } from "node:crypto";
import { mkdir, rename, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import type { MeasurementReceipt } from "prax-validator";

/**
 * Atomic receipt write (same pattern as prax-runtime artifact-store):
 * unique temp file + rename, so a reader never observes a partial receipt.
 */
export async function writeReceiptAtomically(outDir: string, receipt: MeasurementReceipt): Promise<string> {
  const evidenceDir = join(outDir, "validation-evidence");
  await mkdir(evidenceDir, { recursive: true });
  const fileName = `receipt-${receipt.run_at.replace(/[:.]/g, "-")}.json`;
  const filePath = join(evidenceDir, fileName);
  const temporaryPath = join(dirname(filePath), `.${basename(filePath)}.${randomUUID()}.tmp`);
  try {
    await writeFile(temporaryPath, `${JSON.stringify(receipt, null, 2)}\n`, {
      encoding: "utf8",
      flag: "wx",
    });
    await rename(temporaryPath, filePath);
  } catch (error) {
    await import("node:fs/promises").then((fs) => fs.rm(temporaryPath, { force: true })).catch(() => undefined);
    throw error;
  }
  return filePath;
}
