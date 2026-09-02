import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { chromium } from "playwright";
import { MeasurementReceiptCheckSchema } from "prax-validator";
import { run } from "../packages/prax-measure/src/checks/type.min_projected_size.js";

const fixtureUrl = new URL("./fixtures/measure/type.min_projected_size.html", import.meta.url).href;

const cleanup: string[] = [];
afterEach(async () => {
  await Promise.all(cleanup.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("type.min_projected_size check (Task A2.7)", () => {
  it("fails (advisory warning) when primary-content text projects below 12px", async () => {
    const screenshotDir = await mkdtemp(join(tmpdir(), "prax-measure-type-"));
    cleanup.push(screenshotDir);
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
    await page.goto(fixtureUrl);

    const outcome = await run(page, { viewport: { width: 1280, height: 860, label: "desktop" }, screenshotDir });

    expect(outcome.status).toBe("fail");
    expect(outcome.severity).toBe("warning");
    expect(outcome.subject).toBeTruthy();
    const measured = outcome.measured as { min_font_px: number; elements: string[] };
    expect(measured.min_font_px).toBe(10);
    expect(measured.elements).toContain("p#micro-primary");
    expect((outcome.threshold as Record<string, unknown>).min_projected_px).toBe(12);
    expect(() => MeasurementReceiptCheckSchema.parse(outcome)).not.toThrow();

    await browser.close();
  });

  it("ignores normal primary text and micro text outside primary scope", async () => {
    const screenshotDir = await mkdtemp(join(tmpdir(), "prax-measure-type-"));
    cleanup.push(screenshotDir);
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
    await page.goto(fixtureUrl);

    const outcome = await run(page, { viewport: { width: 1280, height: 860 }, screenshotDir });
    const elements = (outcome.measured as { elements: string[] }).elements;

    expect(elements).not.toContain("p#normal-primary");
    expect(elements).not.toContain("p#micro-footer");

    await browser.close();
  });

  it("passes when primary content stays at or above 12px", async () => {
    const screenshotDir = await mkdtemp(join(tmpdir(), "prax-measure-type-"));
    cleanup.push(screenshotDir);
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
    await page.setContent(
      "<!doctype html><html><head><style>p{font-size:14px}</style></head><body style='margin:0'><main data-primary><p>Comfortably readable primary text.</p></main></body></html>",
    );

    const outcome = await run(page, { viewport: { width: 1280, height: 860 }, screenshotDir });

    expect(outcome.status).toBe("pass");
    expect((outcome.measured as Record<string, unknown>).min_font_px).toBeGreaterThanOrEqual(12);
    expect(() => MeasurementReceiptCheckSchema.parse(outcome)).not.toThrow();

    await browser.close();
  });
});
