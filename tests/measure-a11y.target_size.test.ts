import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { chromium } from "playwright";
import { MeasurementReceiptCheckSchema } from "prax-validator";
import { run } from "../packages/prax-measure/src/checks/a11y.target_size.js";

const fixtureUrl = new URL("./fixtures/measure/a11y.target_size.html", import.meta.url).href;

const cleanup: string[] = [];
afterEach(async () => {
  await Promise.all(cleanup.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("a11y.target_size check (Task A2.6)", () => {
  it("fails at error severity on undersized targets with measured sizes", async () => {
    const screenshotDir = await mkdtemp(join(tmpdir(), "prax-measure-target-"));
    cleanup.push(screenshotDir);
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
    await page.goto(fixtureUrl);

    const outcome = await run(page, { viewport: { width: 1280, height: 860, label: "desktop" }, screenshotDir });

    expect(outcome.status).toBe("fail");
    expect(outcome.severity).toBe("error");
    const measured = outcome.measured as {
      undersized: number;
      elements: Array<{ selector: string; width: number; height: number }>;
    };
    expect(measured.undersized).toBe(1);
    expect(measured.elements[0]).toMatchObject({ selector: "button#tiny-button", width: 16, height: 16 });
    expect((outcome.threshold as Record<string, unknown>).min_target_px).toBe(24);
    expect(() => MeasurementReceiptCheckSchema.parse(outcome)).not.toThrow();

    await browser.close();
  });

  it("exempts sized targets, inline sentence links, and declared alternatives", async () => {
    const screenshotDir = await mkdtemp(join(tmpdir(), "prax-measure-target-"));
    cleanup.push(screenshotDir);
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
    await page.goto(fixtureUrl);

    const outcome = await run(page, { viewport: { width: 1280, height: 860 }, screenshotDir });
    const selectors = ((outcome.measured as { elements: Array<{ selector: string }> }).elements ?? []).map(
      (element) => element.selector,
    );

    expect(selectors).not.toContain("button#roomy-button");
    expect(selectors).not.toContain("a#inline-link");
    expect(selectors).not.toContain("button#compact-button");

    await browser.close();
  });

  it("passes on a page whose targets all meet the minimum", async () => {
    const screenshotDir = await mkdtemp(join(tmpdir(), "prax-measure-target-"));
    cleanup.push(screenshotDir);
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
    await page.setContent(
      "<!doctype html><html><head><style>button{width:28px;height:28px}</style></head><body style='margin:0'><main><button id='a'>A</button><button id='b'>B</button></main></body></html>",
    );

    const outcome = await run(page, { viewport: { width: 1280, height: 860 }, screenshotDir });

    expect(outcome.status).toBe("pass");
    expect((outcome.measured as Record<string, unknown>).undersized).toBe(0);
    expect(() => MeasurementReceiptCheckSchema.parse(outcome)).not.toThrow();

    await browser.close();
  });
});
