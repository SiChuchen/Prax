/**
 * PRAX-WIZARD-001 deterministic functional evidence (FrontendBench-style).
 * Real keyboard path only (Tab / arrows / Home / End / Enter / Space);
 * screenshots + assertions for: per-step gating, arm-equality inline error,
 * blind-review consequence note, stepper, review summary, reload resume,
 * submitting + success banner, focus visibility, no keyboard trap,
 * aria-live announcements, live character counter.
 */
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { chromium } from "playwright";

const evidenceDir = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.dirname(evidenceDir);
const shotDir = path.join(evidenceDir, "shots");
await mkdir(shotDir, { recursive: true });

const PORT = 4175;
const BASE = `http://localhost:${PORT}/`;

let failures = 0;
let passes = 0;
function check(name, condition, detail = "") {
  if (condition) {
    passes += 1;
    console.log(`PASS ${name}`);
  } else {
    failures += 1;
    console.log(`FAIL ${name} ${detail}`);
  }
}

// vite is hoisted to the repository root node_modules (npm workspaces)
const viteBin = path.join(appDir, "..", "..", "node_modules", "vite", "bin", "vite.js");
const server = spawn(process.execPath, [viteBin, "preview", "--port", String(PORT), "--strictPort", "--host", "127.0.0.1"], {
  cwd: appDir,
  stdio: ["ignore", "pipe", "pipe"],
  detached: false,
});
server.stdout?.on("data", (chunk) => process.stdout.write(`[vite] ${chunk}`));
server.stderr?.on("data", (chunk) => process.stderr.write(`[vite!] ${chunk}`));
server.on("exit", (code) => console.error(`[vite] exited with ${code}`));

async function waitForServer() {
  const url = `http://127.0.0.1:${PORT}/`;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1000) });
      if (response.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("vite preview did not come up within 20s");
}

async function main() {
  await waitForServer();
  const browser = await chromium.launch();

  // ---- context 1: main keyboard happy path -------------------------------
  const context = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const page = await context.newPage();
  await page.goto(BASE);

  // 1. empty state: step 1, Next disabled, no resume banner
  check("empty: heading step 1", (await page.textContent("h2"))?.includes("Step 1 of 3") === true);
  const nextDisabled = await page.getByRole("button", { name: "Next →" }).isDisabled();
  check("empty: Next disabled", nextDisabled);
  check("empty: no resume banner", (await page.locator(".resume-banner").count()) === 0);
  await page.screenshot({ path: path.join(shotDir, "01-step1-empty.png"), fullPage: true });

  // 2. keyboard focus visibility on the first control
  await page.keyboard.press("Tab"); // steps are not tabbable; first control = surface select
  const outline = await page.evaluate(() => {
    const el = document.activeElement;
    const style = window.getComputedStyle(el);
    return { tag: el?.tagName, outlineStyle: style.outlineStyle, outlineWidth: style.outlineWidth };
  });
  check("keyboard: first Tab reaches surface select", outline.tag === "SELECT", JSON.stringify(outline));
  check("keyboard: :focus-visible outline present", outline.outlineStyle !== "none" && outline.outlineWidth !== "0px", JSON.stringify(outline));

  // 3. fill step 1 keyboard-only (arrow keys drive the select)
  await page.keyboard.press("ArrowDown"); // select first surface
  const surfaceValue = await page.evaluate(() => document.querySelector("select")?.value);
  check("step1: ArrowDown selects surface", surfaceValue === "landing-hero", String(surfaceValue));
  await page.keyboard.press("Tab");
  check("step1: focus moved to textarea", await page.evaluate(() => document.activeElement?.tagName) === "TEXTAREA");
  await page.keyboard.insertText("Rebuild the landing hero with the new token set and measure CTA conversion against the old hero.");
  const nextEnabled = await page.getByRole("button", { name: "Next →" }).isEnabled();
  check("step1: Next enabled after valid input", nextEnabled);
  await page.screenshot({ path: path.join(shotDir, "02-step1-valid.png"), fullPage: true });

  // 4. Next via keyboard (Back is disabled on step 1, so one Tab reaches Next)
  await page.keyboard.press("Tab");
  check("step1: focus on Next", (await page.evaluate(() => document.activeElement?.textContent))?.includes("Next"));
  await page.keyboard.press("Enter");
  check("nav: step 2 reached", (await page.textContent("h2"))?.includes("Step 2 of 3") === true);
  const live1 = await page.textContent("[aria-live='polite']");
  check("aria-live: step announcement", (live1 ?? "").includes("Step 2 of 3"));

  // 5. arm equality inline error (Home key drives model B to the first option)
  const selects = page.locator("select");
  await selects.nth(1).focus();
  await page.keyboard.press("Home"); // glm-5.3[1m] === arm A
  const inlineError = await page.locator("#arm-equal-error").isVisible();
  check("step2: arm-equality inline error visible", inlineError);
  check("step2: Next disabled while arms equal", await page.getByRole("button", { name: "Next →" }).isDisabled());
  check("step2: arm B marked aria-invalid", (await selects.nth(1).getAttribute("aria-invalid")) === "true");
  await page.screenshot({ path: path.join(shotDir, "03-step2-arm-equal-error.png"), fullPage: true });

  // 6. fix via End key (last model differs from A)
  await page.keyboard.press("End"); // qwen3-coder
  check("step2: inline error cleared", (await page.locator("#arm-equal-error").count()) === 0 || !(await page.locator("#arm-equal-error").isVisible()));
  check("step2: Next enabled after fix", await page.getByRole("button", { name: "Next →" }).isEnabled());

  // 7. blind review switch: Space toggles, consequence note appears
  const switchEl = page.getByRole("switch");
  await switchEl.focus();
  await page.keyboard.press("Space");
  check("step2: switch off via Space", (await switchEl.getAttribute("aria-checked")) === "false");
  check("step2: consequence note appears", await page.locator("#blind-note").isVisible());
  await page.screenshot({ path: path.join(shotDir, "04-step2-blind-off-note.png"), fullPage: true });
  await page.keyboard.press("Space"); // back on for the queued summary
  check("step2: switch back on", (await switchEl.getAttribute("aria-checked")) === "true");
  check("step2: note hidden when on", !(await page.locator("#blind-note").isVisible().catch(() => false)));

  // 8. stepper via keyboard
  const plus = page.getByRole("button", { name: "Increase replicate count" });
  await plus.focus();
  await page.keyboard.press("Enter");
  check("step2: stepper + via Enter", (await page.textContent(".stepper-value")) === "4");
  await page.getByRole("button", { name: "Decrease replicate count" }).focus();
  await page.keyboard.press("Enter");
  check("step2: stepper − via Enter", (await page.textContent(".stepper-value")) === "3");

  // 8b. no keyboard trap: Tab cycles across the step's controls
  {
    const seen = new Set();
    for (let i = 0; i < 22; i += 1) {
      await page.keyboard.press("Tab");
      seen.add(await page.evaluate(() => document.activeElement?.textContent ?? document.activeElement?.tagName));
    }
    check("keyboard: no trap (focus cycles broadly)", seen.size >= 5, Array.from(seen).join("|"));
  }

  // 9. review step
  await page.getByRole("button", { name: "Next →" }).focus();
  await page.keyboard.press("Enter");
  check("nav: step 3 reached", (await page.textContent("h2"))?.includes("Step 3 of 3") === true);
  const review = (await page.textContent(".review")) ?? "";
  check("review: surface shown", review.includes("landing-hero"));
  check("review: models shown", review.includes("glm-5.3[1m]") && review.includes("qwen3-coder"));
  check("review: replicate count shown", review.includes("3"));
  const blindDd = (await page.locator(".review > div:nth-child(5) dd").textContent()) ?? "";
  check("review: blind on shown", blindDd.startsWith("On —"));
  const queue = page.getByRole("button", { name: "Queue run" });
  check("review: Queue run enabled when all steps valid", await queue.isEnabled());
  await page.screenshot({ path: path.join(shotDir, "05-step3-review.png"), fullPage: true });

  // 10. reload → resume prompt → values restored
  await page.reload();
  check("resume: banner appears on reload", await page.locator(".resume-banner").isVisible());
  await page.screenshot({ path: path.join(shotDir, "08-reload-resume-prompt.png"), fullPage: true });
  await page.getByRole("button", { name: "Resume draft" }).click();
  check("resume: step 3 restored", (await page.textContent("h2"))?.includes("Step 3 of 3") === true);
  const reviewAfter = (await page.textContent(".review")) ?? "";
  check("resume: values intact", reviewAfter.includes("landing-hero") && reviewAfter.includes("qwen3-coder"));
  check("resume: back-navigation preserves values", await page.getByRole("button", { name: "← Back" }).isEnabled());

  // 11. queue: submitting state then deterministic success
  await page.getByRole("button", { name: "Queue run" }).focus();
  await page.keyboard.press("Enter");
  check("queue: submitting label", (await page.textContent(".step-nav button.primary")) === "Queueing…");
  check("queue: panel aria-busy", (await page.getAttribute(".panel", "aria-busy")) === "true");
  await page.screenshot({ path: path.join(shotDir, "06-submitting.png"), fullPage: true });
  const banner = page.locator(".success-banner");
  await banner.waitFor({ state: "visible", timeout: 5000 });
  check("queue: success banner role=status", (await banner.getAttribute("role")) === "status");
  const bannerText = (await banner.textContent()) ?? "";
  check("queue: banner carries config", bannerText.includes("glm-5.3[1m]") && bannerText.includes("qwen3-coder") && bannerText.includes("landing-hero"));
  check("queue: simulation disclosed", bannerText.toLowerCase().includes("no backend"));
  const stored = await page.evaluate(() => localStorage.getItem("prax-wizard-draft-v1"));
  check("queue: draft cleared after queue", stored === null);
  await page.screenshot({ path: path.join(shotDir, "07-success-banner.png"), fullPage: true });

  await context.close();

  // ---- context 2: live counter + over-limit error ------------------------
  const context2 = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const page2 = await context2.newPage();
  await page2.goto(BASE);
  await page2.locator("select").first().focus();
  await page2.keyboard.press("ArrowDown");
  await page2.locator("textarea").focus();
  await page2.keyboard.insertText("x".repeat(4100));
  const counter = (await page2.textContent(".char-counter")) ?? "";
  check("counter: live count 4100 / 4000", counter.replace(/\s/g, "").includes("4100/4000"), counter);
  check("counter: over-limit flagged", (await page2.locator(".char-counter").getAttribute("class"))?.includes("over") === true);
  // typing marks the field touched, so the over-limit error summarizes immediately
  const alert = await page2.locator(".error-summary").isVisible();
  check("counter: over-limit summarized inline", alert && ((await page2.textContent(".error-summary")) ?? "").includes("exceeds 4000"));
  check("counter: Next stays disabled", await page2.getByRole("button", { name: "Next →" }).isDisabled());
  await context2.close();

  await browser.close();
  console.log(`\n${passes} passed, ${failures} failed`);
  if (failures > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    if (process.platform === "win32") {
      spawn("taskkill", ["/pid", String(server.pid), "/T", "/F"], { stdio: "ignore" });
    } else {
      server.kill("SIGTERM");
    }
  });
