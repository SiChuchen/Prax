import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { chromium } from "playwright";
import { MeasurementReceiptCheckSchema } from "prax-validator";
import { run } from "../packages/prax-measure/src/checks/a11y.contrast.js";

const fixtureUrl = new URL("./fixtures/measure/a11y.contrast.html", import.meta.url).href;

const cleanup: string[] = [];
afterEach(async () => {
  await Promise.all(cleanup.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("a11y.contrast check (Task A2.4)", () => {
  it("fails at error severity on sub-AA text, reporting measured ratios", async () => {
    const screenshotDir = await mkdtemp(join(tmpdir(), "prax-measure-contrast-"));
    cleanup.push(screenshotDir);
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
    await page.goto(fixtureUrl);

    const outcome = await run(page, { viewport: { width: 1280, height: 860, label: "desktop" }, screenshotDir });

    expect(outcome.status).toBe("fail");
    expect(outcome.severity).toBe("error");
    const measured = outcome.measured as {
      failing: number;
      pairs: Array<{ selector: string; ratio: number; required: number }>;
    };
    expect(measured.failing).toBe(1);
    expect(measured.pairs[0]?.selector).toBe("p#low-contrast-text");
    expect(measured.pairs[0]!.ratio).toBeGreaterThan(2.0);
    expect(measured.pairs[0]!.ratio).toBeLessThan(2.6);
    expect(measured.pairs[0]!.required).toBe(4.5);
    expect((outcome.threshold as Record<string, unknown>).normal_min_ratio).toBe(4.5);
    expect((outcome.threshold as Record<string, unknown>).large_min_ratio).toBe(3.0);
    expect(() => MeasurementReceiptCheckSchema.parse(outcome)).not.toThrow();

    await browser.close();
  });

  it("does not flag high-contrast text or text meeting the large-text minimum", async () => {
    const screenshotDir = await mkdtemp(join(tmpdir(), "prax-measure-contrast-"));
    cleanup.push(screenshotDir);
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
    await page.goto(fixtureUrl);

    const outcome = await run(page, { viewport: { width: 1280, height: 860 }, screenshotDir });
    const selectors = ((outcome.measured as { pairs: Array<{ selector: string }> }).pairs ?? []).map((p) => p.selector);

    expect(selectors).not.toContain("p#high-contrast-text");
    expect(selectors).not.toContain("p#large-text");

    await browser.close();
  });

  it("passes on a page whose text all meets AA", async () => {
    const screenshotDir = await mkdtemp(join(tmpdir(), "prax-measure-contrast-"));
    cleanup.push(screenshotDir);
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
    await page.setContent(
      "<!doctype html><html><head><style>p{color:#222;font-size:15px}</style></head><body style='margin:0;background:#fff'><main><p>Readable text on a readable background.</p></main></body></html>",
    );

    const outcome = await run(page, { viewport: { width: 1280, height: 860 }, screenshotDir });

    expect(outcome.status).toBe("pass");
    expect((outcome.measured as Record<string, unknown>).failing).toBe(0);
    expect(() => MeasurementReceiptCheckSchema.parse(outcome)).not.toThrow();

    await browser.close();
  });
});
