import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile } from "node:fs/promises";
import { afterEach, describe, expect, it } from "vitest";

const exec = promisify(execFile);
const cleanup: string[] = [];
afterEach(async () => {
  await Promise.all(cleanup.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("prax-measure CLI --entry (gap #2, F4 pilot)", () => {
  it("measures a non-root entry page via --entry", async () => {
    const outDir = await mkdtemp(join(tmpdir(), "prax-measure-cli-"));
    cleanup.push(outDir);
    const cli = join(process.cwd(), "packages", "prax-measure", "bin", "prax-measure.mjs");

    // the fixture fails an error-tier check → CLI legitimately exits 1;
    // promisified execFile throws with stdout attached
    const invocation = exec("node", [
      cli,
      "--app", join(process.cwd(), "tests", "fixtures", "measure"),
      "--out", outDir,
      "--viewports", "1280x860",
      "--entry", "/layout.overflow.html",
    ]);
    const stdout = await invocation.then(
      (result) => result.stdout,
      (error) => error.stdout as string,
    );
    expect(stdout).toContain("summary:");

    const evidenceDir = join(outDir, "validation-evidence");
    const receiptName = (await readdir(evidenceDir)).find((file) => file.startsWith("receipt-"));
    expect(receiptName).toBeDefined();
    const receipt = JSON.parse(await readFile(join(evidenceDir, receiptName!), "utf8"));
    const overflow = receipt.checks.find((check: { id: string }) => check.id === "layout.overflow");
    // the fixture's deliberate 14px overflow is only reachable via --entry
    expect(overflow.status).toBe("fail");
    expect(overflow.measured.overflow_px).toBe(14);
  });
});
