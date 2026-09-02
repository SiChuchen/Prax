import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { chromium } from "playwright";
import { MeasurementReceiptCheckSchema } from "prax-validator";
import { run, type CheckContext } from "../packages/prax-measure/src/checks/layout.responsive_collision.js";

const fixtureUrl = new URL("./fixtures/measure/layout.responsive_collision.html", import.meta.url).href;

const cleanup: string[] = [];
afterEach(async () => {
  await Promise.all(cleanup.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("layout.responsive_collision check (Task A2.2)", () => {
  it("fails on intersecting interactive elements with the colliding pair and its rects", async () => {
    const screenshotDir = await mkdtemp(join(tmpdir(), "prax-measure-collision-"));
    cleanup.push(screenshotDir);
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
    await page.goto(fixtureUrl);

    const outcome = await run(page, { viewport: { width: 1280, height: 860, label: "desktop" }, screenshotDir });

    expect(outcome.status).toBe("fail");
    expect(outcome.severity).toBe("error"); // promoted 2026-09-02 (F5 accreting gate)
    expect(outcome.subject).toBeTruthy();
    expect((outcome.measured as Record<string, unknown>).collisions).toBe(1);
    const pairs = (outcome.measured as { pairs: Array<{ a: string; b: string }> }).pairs;
    expect(pairs).toHaveLength(1);
    expect([pairs[0]!.a, pairs[0]!.b].sort()).toEqual(["button#first", "button#second"]);
    expect((pairs[0] as unknown as { a_rect: { x: number; width: number } }).a_rect).toMatchObject({ x: 0, width: 100 });
    expect((outcome.threshold as Record<string, unknown>).max_collisions).toBe(0);
    expect(() => MeasurementReceiptCheckSchema.parse(outcome)).not.toThrow();

    await browser.close();
  });

  it("never flags separated elements, exempt overlays, or ancestor/descendant pairs", async () => {
    const screenshotDir = await mkdtemp(join(tmpdir(), "prax-measure-collision-"));
    cleanup.push(screenshotDir);
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
    await page.goto(fixtureUrl);

    const outcome = await run(page, { viewport: { width: 1280, height: 860 }, screenshotDir });

    const pairs = (outcome.measured as { pairs: Array<{ a: string; b: string }> }).pairs;
    const flat = pairs.flatMap((pair) => [pair.a, pair.b]);
    expect(flat).not.toContain("button#left");
    expect(flat).not.toContain("button#right");
    expect(flat).not.toContain("button#floating");
    expect(flat).not.toContain("button#under");

    await browser.close();
  });

  it("passes on a page with no intersecting interactive elements", async () => {
    const screenshotDir = await mkdtemp(join(tmpdir(), "prax-measure-collision-"));
    cleanup.push(screenshotDir);
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
    await page.setContent(
      "<!doctype html><html><body style='margin:0'><main><button style='display:block;margin-bottom:16px'>One</button><button style='display:block'>Two</button></main></body></html>",
    );

    const outcome = await run(page, { viewport: { width: 1280, height: 860 }, screenshotDir });

    expect(outcome.status).toBe("pass");
    expect((outcome.measured as Record<string, unknown>).collisions).toBe(0);
    expect(() => MeasurementReceiptCheckSchema.parse(outcome)).not.toThrow();

    await browser.close();
  });
});
