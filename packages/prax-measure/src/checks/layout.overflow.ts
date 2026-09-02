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

/**
 * layout.overflow (spec §5.3): page-level horizontal overflow
 * (documentElement.scrollWidth <= innerWidth) plus element-level content
 * overflow (visible elements with scrollWidth > clientWidth + 1, the 1px
 * rounding tolerance). Screenshot captured on fail.
 */
export async function run(page: Page, ctx: CheckContext): Promise<CheckOutcome> {
  const viewportLabel = ctx.viewport.label ?? `${ctx.viewport.width}x${ctx.viewport.height}`;
  const measurement = await page.evaluate(() => {
    const isVisible = (element: Element): boolean => {
      const style = window.getComputedStyle(element);
      return style.display !== "none" && style.visibility !== "hidden";
    };
    const flagged: string[] = [];
    const candidates: Element[] = [document.documentElement, document.body, ...Array.from(document.body?.querySelectorAll("*") ?? [])];
    for (const element of candidates) {
      if (element === null || !isVisible(element)) continue;
      if (element.scrollWidth > element.clientWidth + 1) {
        flagged.push(
          element.id !== ""
            ? `${element.tagName.toLowerCase()}#${element.id}`
            : element.tagName.toLowerCase(),
        );
      }
    }
    return {
      scroll_width: document.documentElement.scrollWidth,
      inner_width: window.innerWidth,
      flagged,
    };
  });

  const overflowPx = Math.max(0, measurement.scroll_width - measurement.inner_width);
  const threshold = { max_overflow_px: 0, element_overflow_tolerance_px: 1 };
  const measured = {
    scroll_width: measurement.scroll_width,
    inner_width: measurement.inner_width,
    overflow_px: overflowPx,
    element_overflows: measurement.flagged.length,
    flagged_elements: measurement.flagged,
    viewport: viewportLabel,
  };

  if (overflowPx <= 0 && measurement.flagged.length === 0) {
    return {
      id: "layout.overflow",
      status: "pass",
      severity: ARTIFACT_CHECK_DEFAULT_SEVERITY["layout.overflow"],
      measured,
      threshold,
      evidence_refs: [],
      supported_fixes: [],
    };
  }

  const fileName = `overflow-${ctx.viewport.width}x${ctx.viewport.height}.png`;
  await mkdir(ctx.screenshotDir, { recursive: true });
  await page.screenshot({ path: join(ctx.screenshotDir, fileName), fullPage: false });
  const sha256 = createHash("sha256")
    .update(await readFile(join(ctx.screenshotDir, fileName)))
    .digest("hex");

  return {
    id: "layout.overflow",
    status: "fail",
    severity: ARTIFACT_CHECK_DEFAULT_SEVERITY["layout.overflow"],
    subject: "document.documentElement",
    measured,
    threshold,
    evidence_refs: [{ ref: `validation-evidence/${fileName}`, sha256 }],
    supported_fixes: [
      "find the widest row via the flagged elements and remove the fixed-width cause",
    ],
  };
}

