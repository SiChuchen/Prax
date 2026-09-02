import { createHash } from "node:crypto";
import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Page } from "playwright";
import { ARTIFACT_CHECK_DEFAULT_SEVERITY } from "prax-validator";
import type { MeasurementReceipt } from "prax-validator";

export interface CheckContext {
  viewport: { width: number; height: number; label?: string | undefined };
  screenshotDir: string; // absolute; check writes PNGs here, refs are rebased by the runner
}

export type CheckOutcome = MeasurementReceipt["checks"][number];

const MAX_STOPS = 64;

/**
 * a11y.focus_order (spec §5.3): sequential Tab walk (max 64 stops). Every
 * focused element must carry a visible indicator (outline or box-shadow —
 * background-only changes do not count), and consecutive stops that move
 * backwards in the visual reading order (bounding-box, row-banded) are
 * reported as inversions.
 */
export async function run(page: Page, ctx: CheckContext): Promise<CheckOutcome> {
  const viewportLabel = ctx.viewport.label ?? `${ctx.viewport.width}x${ctx.viewport.height}`;

  const stops: Array<{ selector: string; rect: { x: number; y: number; width: number; height: number } }> = [];
  const missingIndicators: string[] = [];

  for (let index = 0; index < MAX_STOPS; index += 1) {
    await page.keyboard.press("Tab");
    const stop = await page.evaluate(() => {
      const element = document.activeElement;
      if (element === null || element === document.body) return null;
      const describe = (): string => {
        const tag = element!.tagName.toLowerCase();
        return element!.id !== "" ? `${tag}#${element!.id}` : tag;
      };
      const style = window.getComputedStyle(element);
      const outlineVisible =
        style.outlineStyle !== "none" &&
        Number.parseFloat(style.outlineWidth || "0") > 0 &&
        style.outlineColor !== "transparent";
      const shadowVisible = style.boxShadow !== "none";
      const domRect = element.getBoundingClientRect();
      return {
        selector: describe(),
        indicator: outlineVisible || shadowVisible,
        rect: { x: domRect.x, y: domRect.y, width: domRect.width, height: domRect.height },
      };
    });
    if (stop === null) {
      // focus fell back to the body: the tab sequence wrapped (or the page
      // has no tabbables at all) — either way the walk is complete
      break;
    }
    if (stops.length > 0 && stops[stops.length - 1]!.selector === stop.selector) {
      break;
    }
    stops.push({ selector: stop.selector, rect: stop.rect });
    if (!stop.indicator) missingIndicators.push(stop.selector);
  }

  // visual reading order within a row band (tolerance: half the row height)
  const inversions: Array<{ from: string; to: string }> = [];
  for (let index = 1; index < stops.length; index += 1) {
    const previous = stops[index - 1]!;
    const current = stops[index]!;
    const tolerance = Math.max(previous.rect.height, current.rect.height) / 2;
    const sameRow = Math.abs(current.rect.y - previous.rect.y) <= tolerance;
    const movedUp = current.rect.y + tolerance < previous.rect.y - tolerance;
    const movedBackInRow = sameRow && current.rect.x < previous.rect.x - tolerance;
    if (movedUp || movedBackInRow) {
      inversions.push({ from: previous.selector, to: current.selector });
    }
  }

  const measured = {
    stops: stops.length,
    sequence: stops.map((stop) => stop.selector),
    missing_indicators: missingIndicators,
    inversions,
    viewport: viewportLabel,
  };
  const threshold = { max_missing_focus_indicators: 0, max_order_inversions: 0 };

  if (missingIndicators.length === 0 && inversions.length === 0) {
    return {
      id: "a11y.focus_order",
      status: "pass",
      severity: ARTIFACT_CHECK_DEFAULT_SEVERITY["a11y.focus_order"],
      measured,
      threshold,
      evidence_refs: [],
      supported_fixes: [],
    };
  }

  const fileName = `focus-order-${ctx.viewport.width}x${ctx.viewport.height}.png`;
  await mkdir(ctx.screenshotDir, { recursive: true });
  await page.screenshot({ path: join(ctx.screenshotDir, fileName), fullPage: false });
  const sha256 = createHash("sha256")
    .update(await readFile(join(ctx.screenshotDir, fileName)))
    .digest("hex");

  return {
    id: "a11y.focus_order",
    status: "fail",
    severity: ARTIFACT_CHECK_DEFAULT_SEVERITY["a11y.focus_order"],
    subject: [
      ...missingIndicators.map((selector) => `no visible focus indicator: ${selector}`),
      ...inversions.map((pair) => `tab order contradicts visual order: ${pair.from} → ${pair.to}`),
    ].join("; "),
    measured,
    threshold,
    evidence_refs: [{ ref: `validation-evidence/${fileName}`, sha256 }],
    supported_fixes: [
      "restore a visible focus indicator (outline or box-shadow) on the listed elements and order the tab sequence to follow the visual reading order (positive tabindex or DOM reordering)",
    ],
  };
}
