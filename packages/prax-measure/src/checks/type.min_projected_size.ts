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
 * type.min_projected_size (spec §5.3): computed font-size of primary-content
 * text (main / article / [data-primary] scopes) must be ≥ 12px. Advisory only
 * — warning severity, never error by default; density-linked thresholds are
 * deferred (spec §12 decision 11: the runner has no density input channel).
 */
export async function run(page: Page, ctx: CheckContext): Promise<CheckOutcome> {
  const viewportLabel = ctx.viewport.label ?? `${ctx.viewport.width}x${ctx.viewport.height}`;
  const observed: Array<{ selector: string; font_px: number }> = await page.evaluate(() => {
    const scopes = Array.from(document.querySelectorAll("main, article, [data-primary]"));
    const targets = scopes.length > 0 ? scopes : [document.body];
    const describe = (element: Element): string => {
      const tag = element.tagName.toLowerCase();
      return element.id !== "" ? `${tag}#${element.id}` : tag;
    };
    const results: Array<{ selector: string; font_px: number }> = [];
    for (const scope of targets) {
      const textElements = [scope, ...Array.from(scope.querySelectorAll("*"))];
      for (const element of textElements) {
        const style = window.getComputedStyle(element);
        if (style.display === "none" || style.visibility === "hidden") continue;
        const ownText = Array.from(element.childNodes)
          .filter((node) => node.nodeType === Node.TEXT_NODE)
          .map((node) => node.textContent ?? "")
          .join("")
          .trim();
        if (ownText === "") continue;
        results.push({ selector: describe(element), font_px: Number.parseFloat(style.fontSize) });
      }
    }
    return results;
  });
  // honest measurement: the projected minimum is recorded even when it passes
  const findings = observed.filter((entry) => entry.font_px < 12);

  const measured = {
    min_font_px: observed.length > 0 ? Math.min(...observed.map((entry) => entry.font_px)) : null,
    undersized: findings.length,
    elements: findings.map((finding) => finding.selector),
    viewport: viewportLabel,
  };
  const threshold = { min_projected_px: 12 };

  if (findings.length === 0) {
    return {
      id: "type.min_projected_size",
      status: "pass",
      severity: ARTIFACT_CHECK_DEFAULT_SEVERITY["type.min_projected_size"],
      measured,
      threshold,
      evidence_refs: [],
      supported_fixes: [],
    };
  }

  const fileName = `min-projected-size-${ctx.viewport.width}x${ctx.viewport.height}.png`;
  await mkdir(ctx.screenshotDir, { recursive: true });
  await page.screenshot({ path: join(ctx.screenshotDir, fileName), fullPage: true });
  const sha256 = createHash("sha256")
    .update(await readFile(join(ctx.screenshotDir, fileName)))
    .digest("hex");

  return {
    id: "type.min_projected_size",
    status: "fail",
    severity: ARTIFACT_CHECK_DEFAULT_SEVERITY["type.min_projected_size"],
    subject: findings.map((finding) => finding.selector).join("; "),
    measured,
    threshold,
    evidence_refs: [{ ref: `validation-evidence/${fileName}`, sha256 }],
    supported_fixes: [
      "raise the listed primary-content text to at least 12px, or declare a density intent that justifies the smaller projection",
    ],
  };
}
