import { createHash } from "node:crypto";
import { lstat, readdir, readFile, realpath } from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";

export interface ExpectedMeasurementTarget {
  appRoot: string;
  entry: string;
  scenario: string;
  sessionId: string | null;
}

export const CONTRACT_FILES = ["screen.sdir.yaml", "sdir-delta.yaml", "implementation-brief.yaml"] as const;
const EXCLUDED = new Set(["node_modules", ".git", ".prax", ".prax-state", "validation-evidence", "coverage", ".vite"]);
const MAX_ENTRIES = 50_000;
const MAX_BYTES = 256 * 1024 * 1024;

export function isMeasurementExcluded(path: string): boolean {
  return path.split(/[\\/]/).some((name) => EXCLUDED.has(name.toLowerCase()) || /\.(?:log|tmp|tsbuildinfo)$/i.test(name));
}

/** Hash sorted names and bytes, not timestamps. Never follow tree symlinks. */
export async function captureImplementation(root: string): Promise<{ root: string; digest: string }> {
  const canonical = await realpath(root);
  if (!(await lstat(canonical)).isDirectory()) throw new Error("Implementation root must be a directory");
  const hash = createHash("sha256").update("prax-static-tree-v1\0");
  let entries = 0;
  let bytes = 0;
  async function visit(directory: string, prefix: string): Promise<void> {
    const names = (await readdir(directory)).sort();
    for (const name of names) {
      if (++entries > MAX_ENTRIES) throw new Error("Implementation tree exceeds entry limit");
      if (isMeasurementExcluded(name)) continue;
      const path = join(directory, name);
      const stats = await lstat(path);
      if (stats.isSymbolicLink()) throw new Error(`Implementation tree contains a symlink: ${prefix}${name}`);
      if (stats.isDirectory()) {
        await visit(path, `${prefix}${name}/`);
      } else if (stats.isFile()) {
        bytes += stats.size;
        if (bytes > MAX_BYTES) throw new Error("Implementation tree exceeds byte limit");
        const content = await readFile(path);
        if (content.length !== stats.size) throw new Error("Implementation file changed while hashing");
        hash.update(JSON.stringify([`${prefix}${name}`, content.length]));
        hash.update("\0").update(content).update("\0");
      } else {
        throw new Error(`Implementation tree contains a non-regular file: ${prefix}${name}`);
      }
    }
  }
  await visit(canonical, "");
  return { root: canonical, digest: hash.digest("hex") };
}

export async function captureContracts(sessionDirectory: string): Promise<Record<string, string | null>> {
  const result: Record<string, string | null> = {};
  for (const name of CONTRACT_FILES) {
    try {
      const path = join(sessionDirectory, name);
      const stats = await lstat(path);
      if (!stats.isFile() || stats.isSymbolicLink()) throw new Error(`Contract is not a regular file: ${name}`);
      if (stats.size > MAX_BYTES) throw new Error(`Contract exceeds byte limit: ${name}`);
      result[name] = createHash("sha256").update(await readFile(path)).digest("hex");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      result[name] = null;
    }
  }
  return result;
}

export async function resolveMeasurementTarget(
  projectRoot: string,
  target: { app_root: string; entry: string; scenario: string },
  sessionId: string,
): Promise<ExpectedMeasurementTarget> {
  if (isAbsolute(target.app_root) || /^[a-z]:/i.test(target.app_root)) throw new Error("measurement_target.app_root must be project-relative");
  if (!target.entry.startsWith("/") || target.entry.startsWith("//") || /[\\\s]/.test(target.entry)) throw new Error("measurement_target.entry must be a root-relative URL path");
  if (!target.scenario.trim()) throw new Error("measurement_target.scenario is required");
  const project = await realpath(projectRoot);
  const appRoot = await realpath(resolve(project, target.app_root));
  const rel = relative(project, appRoot);
  if (rel === ".." || rel.startsWith(`..\\`) || rel.startsWith("../") || isAbsolute(rel)) throw new Error("measurement_target.app_root escapes project root");
  if (!(await lstat(appRoot)).isDirectory()) throw new Error("measurement_target.app_root must be a directory");
  return { appRoot, entry: target.entry, scenario: target.scenario, sessionId };
}
