import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { chromium } from "playwright";
import { MeasurementReceiptCheckSchema } from "prax-validator";
import { run } from "../packages/prax-measure/src/checks/text.truncation.js";

const fixtureUrl = new URL("./fixtures/measure/text.truncation.html", import.meta.url).href;

const cleanup: string[] = [];
afterEach(async () => {
  await Promise.all(cleanup.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("text.truncation check (Task A2.3)", () => {
  it("fails on text clipped without ellipsis/title intent, reporting the element", async () => {
    const screenshotDir = await mkdtemp(join(tmpdir(), "prax-measure-trunc-"));
    cleanup.push(screenshotDir);
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
    await page.goto(fixtureUrl);

    const outcome = await run(page, { viewport: { width: 1280, height: 860, label: "desktop" }, screenshotDir });

    expect(outcome.status).toBe("fail");
    expect(outcome.severity).toBe("error"); // promoted 2026-09-02 (F5 accreting gate)
    const measured = outcome.measured as { truncated: number; elements: string[] };
    expect(measured.truncated).toBe(1);
    expect(measured.elements).toContain("div#clipped-text");
    expect((outcome.threshold as Record<string, unknown>).max_truncated).toBe(0);
    expect(() => MeasurementReceiptCheckSchema.parse(outcome)).not.toThrow();

    await browser.close();
  });

  it("exempts ellipsis, title-carried text, the opt-out class, and wrapping text", async () => {
    const screenshotDir = await mkdtemp(join(tmpdir(), "prax-measure-trunc-"));
    cleanup.push(screenshotDir);
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
    await page.goto(fixtureUrl);

    const outcome = await run(page, { viewport: { width: 1280, height: 860 }, screenshotDir });
    const elements = (outcome.measured as { elements: string[] }).elements;

    expect(elements).not.toContain("div#ellipsis-text");
    expect(elements).not.toContain("div#title-text");
    expect(elements).not.toContain("div#intended-text");
    expect(elements).not.toContain("p#wrapping-text");
    expect(elements).not.toContain("span#sr-only-text");

    await browser.close();
  });

  it("passes on a page with no clipped text", async () => {
    const screenshotDir = await mkdtemp(join(tmpdir(), "prax-measure-trunc-"));
    cleanup.push(screenshotDir);
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
    await page.setContent(
      "<!doctype html><html><body style='margin:0'><main style='max-width:400px'><p>Short text that fits on one line.</p></main></body></html>",
    );

    const outcome = await run(page, { viewport: { width: 1280, height: 860 }, screenshotDir });

    expect(outcome.status).toBe("pass");
    expect((outcome.measured as Record<string, unknown>).truncated).toBe(0);
    expect(() => MeasurementReceiptCheckSchema.parse(outcome)).not.toThrow();

    await browser.close();
  });
});
