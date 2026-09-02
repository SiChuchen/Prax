import { createHash } from "node:crypto";
import { readFile, realpath, stat } from "node:fs/promises";
import { resolve, sep } from "node:path";

export type EvidenceVerification =
  | { ok: true; sha256: string }
  | { ok: false; error: string };

/**
 * Contained evidence-file verification. Generalized (spec §5.5): the allowed
 * prefix is a parameter — the realization path keeps its historical
 * `rep-evidence/` default; receipt verification passes
 * `validation-evidence/`. The file must exist, be a non-empty regular file
 * inside the (realpath-resolved) evidence directory, and its sha256 is
 * returned for digest binding.
 */
export async function verifyEvidenceFile(
  sessionDirectory: string,
  ref: string,
  allowedPrefix = "rep-evidence/",
): Promise<EvidenceVerification> {
  if (!ref.startsWith(allowedPrefix) || ref.split("/").some((segment) => segment === "..")) {
    return { ok: false, error: `evidence ref must stay under ${allowedPrefix} relative to the session directory: ${ref}` };
  }
  const evidenceRoot = resolve(sessionDirectory, allowedPrefix.slice(0, -1));
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
