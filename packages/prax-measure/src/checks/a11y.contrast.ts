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
 * a11y.contrast (spec §5.3): visible text contrast against its effective
 * background (walks ancestors for the first opaque background, accounts for
 * opacity) under WCAG 2.2 AA — 4.5:1 normal text, 3.0:1 large text (≥24px, or
 * ≥18.66px bold). Error-born severity: a normative obligation with no
 * overkill risk.
 */
export async function run(page: Page, ctx: CheckContext): Promise<CheckOutcome> {
  const viewportLabel = ctx.viewport.label ?? `${ctx.viewport.width}x${ctx.viewport.height}`;
  const pairs: Array<{
    selector: string;
    ratio: number;
    required: number;
    font_px: number;
    bold: boolean;
    foreground: string;
    background: string;
  }> = await page.evaluate(() => {
    const parseColor = (value: string): [number, number, number, number] | undefined => {
      const match = value.match(/rgba?\(([^)]+)\)/);
      if (match === null) return undefined;
      const parts = match[1]!.split(",").map((part) => Number.parseFloat(part.trim()));
      return [parts[0]!, parts[1]!, parts[2]!, parts[3] === undefined ? 1 : parts[3]!];
    };
    const blend = (over: [number, number, number, number], under: [number, number, number]): [number, number, number] => {
      const alpha = over[3];
      return [
        over[0]! * alpha + under[0]! * (1 - alpha),
        over[1]! * alpha + under[1]! * (1 - alpha),
        over[2]! * alpha + under[2]! * (1 - alpha),
      ];
    };
    const luminance = (rgb: [number, number, number]): number => {
      const channels = rgb.map((channel) => {
        const scaled = channel / 255;
        return scaled <= 0.04045 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
      }) as [number, number, number];
      return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
    };
    const contrast = (a: [number, number, number], b: [number, number, number]): number => {
      const l1 = luminance(a);
      const l2 = luminance(b);
      const [hi, lo] = l1 >= l2 ? [l1, l2] : [l2, l1];
      return (hi + 0.05) / (lo + 0.05);
    };
    const describe = (element: Element): string => {
      const tag = element.tagName.toLowerCase();
      return element.id !== "" ? `${tag}#${element.id}` : tag;
    };

    const failing: typeof pairs = [];
    for (const element of Array.from(document.body?.querySelectorAll("*") ?? [])) {
      const style = window.getComputedStyle(element);
      if (style.display === "none" || style.visibility === "hidden") continue;
      const ownText = Array.from(element.childNodes)
        .filter((node) => node.nodeType === Node.TEXT_NODE)
        .map((node) => node.textContent ?? "")
        .join("")
        .trim();
      if (ownText === "") continue;

      // effective background: nearest ancestor with a non-transparent color,
      // composited onto the canvas default (white) when itself translucent
      let background: [number, number, number] = [255, 255, 255];
      for (let ancestor: Element | null = element; ancestor !== null; ancestor = ancestor.parentElement) {
        const parsed = parseColor(window.getComputedStyle(ancestor).backgroundColor);
        if (parsed === undefined) continue;
        if (parsed[3] >= 1) {
          background = [parsed[0]!, parsed[1]!, parsed[2]!];
          break;
        }
        if (parsed[3] > 0) {
          background = blend(parsed, background);
          break;
        }
      }

      // effective foreground: the element's color, composited over the
      // background by its accumulated opacity chain
      const foregroundParsed = parseColor(style.color) ?? [0, 0, 0, 1];
      let opacity = 1;
      for (let node: Element | null = element; node !== null; node = node.parentElement) {
        opacity *= Number.parseFloat(window.getComputedStyle(node).opacity || "1");
      }
      const foreground = blend([foregroundParsed[0]!, foregroundParsed[1]!, foregroundParsed[2]!, opacity], background);

      const fontPx = Number.parseFloat(style.fontSize);
      const bold = style.fontWeight === "bold" || Number.parseInt(style.fontWeight, 10) >= 600;
      const required = fontPx >= 24 || (fontPx >= 18.66 && bold) ? 3.0 : 4.5;
      const ratio = contrast(foreground, background);
      if (ratio < required) {
        failing.push({
          selector: describe(element),
          ratio: Math.round(ratio * 100) / 100,
          required,
          font_px: fontPx,
          bold,
          foreground: style.color,
          background: `rgb(${Math.round(background[0]!)},${Math.round(background[1]!)},${Math.round(background[2]!)})`,
        });
      }
    }
    return failing;
  });

  const measured = {
    failing: pairs.length,
    pairs,
    viewport: viewportLabel,
  };
  const threshold = { normal_min_ratio: 4.5, large_min_ratio: 3.0 };

  if (pairs.length === 0) {
    return {
      id: "a11y.contrast",
      status: "pass",
      severity: ARTIFACT_CHECK_DEFAULT_SEVERITY["a11y.contrast"],
      measured,
      threshold,
      evidence_refs: [],
      supported_fixes: [],
    };
  }

  const fileName = `contrast-${ctx.viewport.width}x${ctx.viewport.height}.png`;
  await mkdir(ctx.screenshotDir, { recursive: true });
  await page.screenshot({ path: join(ctx.screenshotDir, fileName), fullPage: true });
  const sha256 = createHash("sha256")
    .update(await readFile(join(ctx.screenshotDir, fileName)))
    .digest("hex");

  return {
    id: "a11y.contrast",
    status: "fail",
    severity: ARTIFACT_CHECK_DEFAULT_SEVERITY["a11y.contrast"],
    subject: pairs.map((pair) => pair.selector).join("; "),
    measured,
    threshold,
    evidence_refs: [{ ref: `validation-evidence/${fileName}`, sha256 }],
    supported_fixes: [
      "darken the failing text color (or lighten it against a dark background) until the measured ratio meets the required minimum",
    ],
  };
}
