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

interface ElementRecord {
  selector: string;
  rect: { x: number; y: number; width: number; height: number };
  contains: string[];
}

/**
 * layout.responsive_collision (spec §5.3): pairwise intersection of visible
 * interactive elements (a, button, input, select, textarea, [role=button],
 * [tabindex]) per viewport. Exemptions: ancestor/descendant containment and
 * elements declaring an explicit overlay role via [data-overlay]. Reports
 * colliding pairs with their rects.
 */
export async function run(page: Page, ctx: CheckContext): Promise<CheckOutcome> {
  const viewportLabel = ctx.viewport.label ?? `${ctx.viewport.width}x${ctx.viewport.height}`;
  const elements: ElementRecord[] = await page.evaluate(() => {
    const INTERACTIVE = "a,button,input,select,textarea,[role=button],[tabindex]";
    const isVisible = (element: Element): boolean => {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        rect.width > 0 &&
        rect.height > 0
      );
    };
    const describe = (element: Element): string => {
      const tag = element.tagName.toLowerCase();
      if (element.id !== "") return `${tag}#${element.id}`;
      const text = (element.textContent ?? "").trim().slice(0, 24);
      return text !== "" ? `${tag}[${text}]` : tag;
    };
    const candidates = Array.from(document.querySelectorAll(INTERACTIVE)).filter(
      (element) => !element.hasAttribute("data-overlay") && isVisible(element),
    );
    return candidates.map((element) => {
      const domRect = element.getBoundingClientRect();
      return {
        selector: describe(element),
        rect: { x: domRect.x, y: domRect.y, width: domRect.width, height: domRect.height },
        contains: candidates
          .filter((other) => other !== element && element.contains(other))
          .map((other) => describe(other)),
      };
    });
  });

  const pairs: Array<{ a: string; b: string; a_rect: ElementRecord["rect"]; b_rect: ElementRecord["rect"] }> = [];
  for (let i = 0; i < elements.length; i += 1) {
    for (let j = i + 1; j < elements.length; j += 1) {
      const first = elements[i]!;
      const second = elements[j]!;
      // ancestor/descendant pairs are containment, not collision
      if (first.contains.includes(second.selector) || second.contains.includes(first.selector)) continue;
      const overlaps =
        first.rect.x < second.rect.x + second.rect.width &&
        second.rect.x < first.rect.x + first.rect.width &&
        first.rect.y < second.rect.y + second.rect.height &&
        second.rect.y < first.rect.y + first.rect.height;
      if (overlaps) {
        pairs.push({ a: first.selector, b: second.selector, a_rect: first.rect, b_rect: second.rect });
      }
    }
  }

  const measured = {
    collisions: pairs.length,
    pairs,
    interactive_elements: elements.length,
    viewport: viewportLabel,
  };
  const threshold = { max_collisions: 0 };

  if (pairs.length === 0) {
    return {
      id: "layout.responsive_collision",
      status: "pass",
      severity: ARTIFACT_CHECK_DEFAULT_SEVERITY["layout.responsive_collision"],
      measured,
      threshold,
      evidence_refs: [],
      supported_fixes: [],
    };
  }

  const fileName = `responsive-collision-${ctx.viewport.width}x${ctx.viewport.height}.png`;
  await mkdir(ctx.screenshotDir, { recursive: true });
  await page.screenshot({ path: join(ctx.screenshotDir, fileName), fullPage: false });
  const sha256 = createHash("sha256")
    .update(await readFile(join(ctx.screenshotDir, fileName)))
    .digest("hex");

  return {
    id: "layout.responsive_collision",
    status: "fail",
    severity: ARTIFACT_CHECK_DEFAULT_SEVERITY["layout.responsive_collision"],
    subject: pairs.map((pair) => `${pair.a} ∩ ${pair.b}`).join("; "),
    measured,
    threshold,
    evidence_refs: [{ ref: `validation-evidence/${fileName}`, sha256 }],
    supported_fixes: [
      "separate the colliding interactive elements or restructure the layout so their hit areas do not intersect at this viewport",
    ],
  };
}
