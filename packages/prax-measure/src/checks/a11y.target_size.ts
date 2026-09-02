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
 * a11y.target_size (spec §5.3): interactive targets ≥ 24×24 CSS px (WCAG 2.2
 * AA 2.5.8). Exemptions: inline links flowing inside a sentence, and controls
 * declaring an equivalent alternative on the same page via
 * data-target-alternative. Error-born severity: normative obligation.
 */
export async function run(page: Page, ctx: CheckContext): Promise<CheckOutcome> {
  const viewportLabel = ctx.viewport.label ?? `${ctx.viewport.width}x${ctx.viewport.height}`;
  const undersized: Array<{ selector: string; width: number; height: number }> = await page.evaluate(() => {
    const INTERACTIVE = "a,button,input,select,textarea,[role=button],[tabindex]";
    const describe = (element: Element): string => {
      const tag = element.tagName.toLowerCase();
      return element.id !== "" ? `${tag}#${element.id}` : tag;
    };
    const results: Array<{ selector: string; width: number; height: number }> = [];
    for (const element of Array.from(document.querySelectorAll(INTERACTIVE))) {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      if (style.display === "none" || style.visibility === "hidden" || rect.width === 0 || rect.height === 0) {
        continue;
      }
      // inline links within a sentence flow with the text — exempt
      if (element.tagName === "A" && style.display === "inline") continue;
      // an equivalent alternative control on the same page — exempt when the
      // declaration resolves to an existing element
      const alternative = element.getAttribute("data-target-alternative");
      if (alternative !== null && alternative !== "" && document.querySelector(alternative) !== null) continue;
      if (rect.width < 24 || rect.height < 24) {
        results.push({
          selector: describe(element),
          width: Math.round(rect.width * 100) / 100,
          height: Math.round(rect.height * 100) / 100,
        });
      }
    }
    return results;
  });

  const measured = {
    undersized: undersized.length,
    elements: undersized,
    viewport: viewportLabel,
  };
  const threshold = { min_target_px: 24 };

  if (undersized.length === 0) {
    return {
      id: "a11y.target_size",
      status: "pass",
      severity: ARTIFACT_CHECK_DEFAULT_SEVERITY["a11y.target_size"],
      measured,
      threshold,
      evidence_refs: [],
      supported_fixes: [],
    };
  }

  const fileName = `target-size-${ctx.viewport.width}x${ctx.viewport.height}.png`;
  await mkdir(ctx.screenshotDir, { recursive: true });
  await page.screenshot({ path: join(ctx.screenshotDir, fileName), fullPage: true });
  const sha256 = createHash("sha256")
    .update(await readFile(join(ctx.screenshotDir, fileName)))
    .digest("hex");

  return {
    id: "a11y.target_size",
    status: "fail",
    severity: ARTIFACT_CHECK_DEFAULT_SEVERITY["a11y.target_size"],
    subject: undersized.map((element) => element.selector).join("; "),
    measured,
    threshold,
    evidence_refs: [{ ref: `validation-evidence/${fileName}`, sha256 }],
    supported_fixes: [
      "raise the listed targets to at least 24×24 CSS px, or declare an equivalent alternative control via data-target-alternative",
    ],
  };
}
