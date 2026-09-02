import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { chromium } from "playwright";
import { MeasurementReceiptCheckSchema } from "prax-validator";
import { run } from "../packages/prax-measure/src/checks/a11y.focus_order.js";

const fixtureUrl = new URL("./fixtures/measure/a11y.focus_order.html", import.meta.url).href;

const cleanup: string[] = [];
afterEach(async () => {
  await Promise.all(cleanup.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("a11y.focus_order check (Task A2.5)", () => {
  it("fails on missing focus indicators and tab-order/visual-order inversions", async () => {
    const screenshotDir = await mkdtemp(join(tmpdir(), "prax-measure-focus-"));
    cleanup.push(screenshotDir);
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
    await page.goto(fixtureUrl);

    const outcome = await run(page, { viewport: { width: 1280, height: 860, label: "desktop" }, screenshotDir });

    expect(outcome.status).toBe("fail");
    expect(outcome.severity).toBe("warning");
    const measured = outcome.measured as {
      stops: number;
      sequence: string[];
      missing_indicators: string[];
      inversions: Array<{ from: string; to: string }>;
    };
    expect(measured.stops).toBeGreaterThanOrEqual(4);
    expect(measured.sequence).toContain("a#ghost-link");
    expect(measured.missing_indicators).toContain("a#ghost-link");
    expect(measured.inversions.length).toBeGreaterThanOrEqual(1);
    expect(measured.inversions[0]).toMatchObject({ from: "button#tab-first-dom", to: "button#tab-second-dom" });
    expect((outcome.threshold as Record<string, unknown>).max_missing_focus_indicators).toBe(0);
    expect(() => MeasurementReceiptCheckSchema.parse(outcome)).not.toThrow();

    await browser.close();
  });

  it("does not flag default-outlined buttons in DOM/visual order", async () => {
    const screenshotDir = await mkdtemp(join(tmpdir(), "prax-measure-focus-"));
    cleanup.push(screenshotDir);
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
    await page.goto(fixtureUrl);

    const outcome = await run(page, { viewport: { width: 1280, height: 860 }, screenshotDir });
    const measured = outcome.measured as { missing_indicators: string[]; sequence: string[] };

    expect(measured.missing_indicators).not.toContain("button#clean-first");
    expect(measured.missing_indicators).not.toContain("button#clean-second");
    expect(measured.sequence).toContain("button#clean-first");
    expect(measured.sequence).toContain("button#clean-second");

    await browser.close();
  });

  it("passes on a page with ordered, outlined tabbables", async () => {
    const screenshotDir = await mkdtemp(join(tmpdir(), "prax-measure-focus-"));
    cleanup.push(screenshotDir);
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
    await page.setContent(
      "<!doctype html><html><head><style>button{display:block;margin-bottom:12px}</style></head><body style='margin:0'><main><button id='one'>One</button><button id='two'>Two</button><button id='three'>Three</button></main></body></html>",
    );

    const outcome = await run(page, { viewport: { width: 1280, height: 860 }, screenshotDir });

    expect(outcome.status).toBe("pass");
    expect((outcome.measured as Record<string, unknown>).stops).toBe(3);
    expect(() => MeasurementReceiptCheckSchema.parse(outcome)).not.toThrow();

    await browser.close();
  });
});
