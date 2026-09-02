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
 * text.truncation (spec §5.3): visible text clipped by its block container
 * with no declared truncation intent. Exemptions: text-overflow: ellipsis, a
 * title attribute carrying the full text, and the explicit
 * `.truncation-intended` opt-out class.
 */
export async function run(page: Page, ctx: CheckContext): Promise<CheckOutcome> {
  const viewportLabel = ctx.viewport.label ?? `${ctx.viewport.width}x${ctx.viewport.height}`;
  const elements: string[] = await page.evaluate(() => {
    const describe = (element: Element): string => {
      const tag = element.tagName.toLowerCase();
      return element.id !== "" ? `${tag}#${element.id}` : tag;
    };
    const truncated: string[] = [];
    for (const element of Array.from(document.body?.querySelectorAll("*") ?? [])) {
      const style = window.getComputedStyle(element);
      if (style.display === "none" || style.visibility === "hidden") continue;
      // sr-only clip pattern: a sub-pixel box is assistive-tech text, not rendered content
      const box = element.getBoundingClientRect();
      if (box.width <= 1 || box.height <= 1) continue;
      // only elements that directly contain text can clip that text
      const ownText = Array.from(element.childNodes)
        .filter((node) => node.nodeType === Node.TEXT_NODE)
        .map((node) => node.textContent ?? "")
        .join("")
        .trim();
      if (ownText === "") continue;
      if (element.classList.contains("truncation-intended")) continue;
      if (style.textOverflow === "ellipsis") continue;
      const title = element.getAttribute("title");
      if (title !== null && title.includes(ownText)) continue;
      if (element.scrollWidth > element.clientWidth + 1) {
        truncated.push(describe(element));
      }
    }
    return truncated;
  });

  const measured = {
    truncated: elements.length,
    elements,
    viewport: viewportLabel,
  };
  const threshold = { max_truncated: 0 };

  if (elements.length === 0) {
    return {
      id: "text.truncation",
      status: "pass",
      severity: ARTIFACT_CHECK_DEFAULT_SEVERITY["text.truncation"],
      measured,
      threshold,
      evidence_refs: [],
      supported_fixes: [],
    };
  }

  const fileName = `truncation-${ctx.viewport.width}x${ctx.viewport.height}.png`;
  await mkdir(ctx.screenshotDir, { recursive: true });
  await page.screenshot({ path: join(ctx.screenshotDir, fileName), fullPage: true });
  const sha256 = createHash("sha256")
    .update(await readFile(join(ctx.screenshotDir, fileName)))
    .digest("hex");

  return {
    id: "text.truncation",
    status: "fail",
    severity: ARTIFACT_CHECK_DEFAULT_SEVERITY["text.truncation"],
    subject: elements.join("; "),
    measured,
    threshold,
    evidence_refs: [{ ref: `validation-evidence/${fileName}`, sha256 }],
    supported_fixes: [
      "let the clipped text wrap, widen its container, or declare truncation intent (ellipsis, title, or .truncation-intended)",
    ],
  };
}
