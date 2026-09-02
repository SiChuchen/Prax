import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { chromium } from "playwright";
import { MeasurementReceiptCheckSchema } from "prax-validator";
import { run, type CheckContext } from "../packages/prax-measure/src/checks/layout.overflow.js";

const fixtureUrl = new URL("./fixtures/measure/layout.overflow.html", import.meta.url).href;

const cleanup: string[] = [];
afterEach(async () => {
  await Promise.all(cleanup.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

async function freshPage(url: string, width = 1280, height = 860) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width, height } });
  await page.goto(url);
  return { browser, page };
}

describe("layout.overflow check (Task A2.1)", () => {
  it("fails on the overflowing fixture with measured overflow_px 14 and schema-valid outcome", async () => {
    const screenshotDir = await mkdtemp(join(tmpdir(), "prax-measure-overflow-"));
    cleanup.push(screenshotDir);
    const { browser, page } = await freshPage(fixtureUrl);
    const ctx: CheckContext = { viewport: { width: 1280, height: 860, label: "desktop" }, screenshotDir };

    const outcome = await run(page, ctx);

    expect(outcome.status).toBe("fail");
    expect(outcome.severity).toBe("warning");
    expect(outcome.subject).toBe("document.documentElement");
    expect((outcome.measured as Record<string, unknown>).overflow_px).toBe(14);
    expect((outcome.measured as Record<string, unknown>).inner_width).toBe(1280);
    expect((outcome.threshold as Record<string, unknown>).max_overflow_px).toBe(0);
    expect(outcome.evidence_refs?.[0]?.ref).toMatch(/^validation-evidence\/overflow-1280x860\.png$/);
    expect(() => MeasurementReceiptCheckSchema.parse(outcome)).not.toThrow();

    // the screenshot exists on disk and the declared sha256 matches its bytes
    const shotPath = join(screenshotDir, "overflow-1280x860.png");
    expect((await stat(shotPath)).size).toBeGreaterThan(0);
    const sha256 = createHash("sha256").update(await readFile(shotPath)).digest("hex");
    expect(outcome.evidence_refs?.[0]?.sha256).toBe(sha256);

    await browser.close();
  });

  it("flags the overflow region but never the contained negative region", async () => {
    const screenshotDir = await mkdtemp(join(tmpdir(), "prax-measure-overflow-"));
    cleanup.push(screenshotDir);
    const { browser, page } = await freshPage(fixtureUrl);
    const outcome = await run(page, { viewport: { width: 1280, height: 860 }, screenshotDir });

    const flagged = (outcome.measured as { flagged_elements: string[] }).flagged_elements;
    expect(flagged.join(" ")).not.toContain("contained-region");
    expect(flagged.length).toBeGreaterThan(0);

    await browser.close();
  });

  it("passes on a clean page", async () => {
    const screenshotDir = await mkdtemp(join(tmpdir(), "prax-measure-overflow-"));
    cleanup.push(screenshotDir);
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
    await page.setContent("<!doctype html><html><body style='margin:0'><main style='max-width:600px'><p>contained</p></main></body></html>");
    const outcome = await run(page, { viewport: { width: 1280, height: 860 }, screenshotDir });

    expect(outcome.status).toBe("pass");
    expect((outcome.measured as Record<string, unknown>).overflow_px).toBe(0);
    expect((outcome.measured as Record<string, unknown>).element_overflows).toBe(0);
    expect(outcome.evidence_refs).toEqual([]);
    expect(() => MeasurementReceiptCheckSchema.parse(outcome)).not.toThrow();

    await browser.close();
  });
});
