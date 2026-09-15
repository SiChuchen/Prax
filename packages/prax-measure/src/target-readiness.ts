import type { Page } from "playwright";

export function observeTargetFailures(page: Page): string[] {
  const issues: string[] = [];
  page.on("pageerror", (error) => issues.push(`pageerror: ${error.message}`));
  page.on("dialog", (dialog) => {
    issues.push(`unexpected ${dialog.type()} dialog: ${dialog.message()}`);
    void dialog.dismiss().catch(() => undefined);
  });
  page.on("requestfailed", (request) => {
    if (["script", "stylesheet"].includes(request.resourceType())) {
      issues.push(`resource failed: ${request.url()} (${request.failure()?.errorText ?? "unknown"})`);
    }
  });
  page.on("response", (response) => {
    if (response.status() >= 400 && ["script", "stylesheet"].includes(response.request().resourceType())) {
      issues.push(`resource HTTP ${response.status()}: ${response.url()}`);
    }
  });
  return issues;
}

export function assertTargetUrl(page: Page, url: string): void {
  const expected = new URL(url);
  const actual = new URL(page.url());
  if (actual.origin !== expected.origin || actual.pathname !== expected.pathname || actual.search !== expected.search || actual.hash !== expected.hash) {
    throw new Error(`unexpected navigation target: ${actual.href}`);
  }
}

export async function navigateTarget(
  page: Page,
  url: string,
  options: { readySelector?: string | undefined; readyTimeoutMs?: number | undefined },
): Promise<void> {
  const response = await page.goto(url, { waitUntil: "load", timeout: options.readyTimeoutMs ?? 10_000 });
  if (response === null || !response.ok()) throw new Error(`HTTP ${response?.status() ?? "no response"}`);
  assertTargetUrl(page, url);
  if (options.readySelector !== undefined) {
    await page.locator(options.readySelector).first().waitFor({ state: "visible", timeout: options.readyTimeoutMs ?? 10_000 });
  }
  // A document smoke check is deliberately weaker than caller-declared app readiness.
  const hasContent = await page.evaluate(() => {
    if (document.body?.innerText.trim()) return true;
    return [...document.querySelectorAll("canvas,svg,img,video,input,button")].some((element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
    });
  });
  if (!hasContent) throw new Error("empty rendered document");
  assertTargetUrl(page, url);
}
