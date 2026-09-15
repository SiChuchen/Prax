/* Evidence capture for Locus (cell-j02-s02-b) — v2.
 * Fixes vs v1: rec() awaits promise values; filters are reset between steps so
 * each scenario starts from a clean state; guarded clicks on optional panels.
 */
const puppeteer = require("puppeteer-core");
const fs = require("fs");
const path = require("path");

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const FILE = "file:///E:/codex-prj/ab-worktrees/pi-matrix/cell-j02-s02-b/index.html";
const OUT = path.join(__dirname, "..", "evidence");

const log = [];
async function rec(step, k, v) {
  if (v && typeof v.then === "function") v = await v;
  if (typeof v === "object" && v !== null) v = JSON.stringify(v);
  log.push({ step, k, v: String(v) });
  console.log(`[${step}] ${k} = ${v}`);
}
async function shot(page, name) {
  await page.screenshot({ path: path.join(OUT, name), type: "png" });
  await rec(name, "screenshot", path.join(OUT, name));
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: "new",
    args: ["--disable-gpu", "--force-device-scale-factor=1"],
    defaultViewport: { width: 1600, height: 1000 },
  });
  const page = await browser.newPage();
  const consoleMsgs = [];
  page.on("console", (m) => consoleMsgs.push({ type: m.type(), text: m.text() }));
  page.on("pageerror", (e) => consoleMsgs.push({ type: "pageerror", text: String(e) }));

  const state = () => page.$eval("#app", (a) => a.dataset.state);
  const counter = () => page.$eval("#result-count", (e) => e.textContent.trim());
  const chips = () => page.$$eval("#chips .chip", (cs) => cs.map((c) => c.textContent.trim()));
  const scrollTop = () => page.$eval("#results", (e) => Math.round(e.scrollTop));
  const detailOpen = () => page.$eval("#detail", (e) => !e.hidden);

  /* 1 — initial load */
  await page.goto(FILE, { waitUntil: "load" });
  await page.waitForSelector("#results .row", { timeout: 5000 });
  await sleep(150);
  await rec("1", "data-state", state());
  await rec("1", "counter", counter());
  await rec("1", "activeElement", page.evaluate(() => document.activeElement.id));
  await rec("1", "rowsRendered", (await page.$$("#results .row")).length);
  await rec("1", "bootOverlayGone", page.evaluate(() => !document.querySelector(".app").classList.contains("is-booting")));
  await shot(page, "01-initial-ready.png");

  /* 2 — search (interaction 1): real keystrokes */
  await page.click("#search");
  await page.keyboard.type("glacier", { delay: 40 });
  await sleep(150);
  await rec("2", "counter", counter());
  await rec("2", "firstRowName", page.$eval("#results .row .row-name", (e) => e.textContent));
  await rec("2", "marksTotal", page.$$eval("#results mark", (m) => m.length));
  await rec("2", "atlasVisible", page.$$eval("#results .row .row-name", (ns) => ns.some((n) => /Global Glacier Mass Balance Atlas/.test(n.textContent))));
  await shot(page, "02-search-glacier.png");

  /* 3 — facet (interaction 2) */
  await page.click('#tag-facets .facet-row[data-tag="climate"]');
  await sleep(150);
  await rec("3", "counter", counter());
  await rec("3", "chips", chips());
  await shot(page, "03-facet.png");

  /* 4 — select (interaction 3): detail opens in place */
  const target = await page.evaluate(() => {
    const rows = [...document.querySelectorAll("#results .row")];
    const r = rows.find((x) => /Global Glacier Mass Balance Atlas/.test(x.textContent));
    return r ? { id: r.dataset.id } : null;
  });
  await rec("4", "targetRow", target);
  const before4 = { scroll: await scrollTop(), chips: await chips(), counter: await counter() };
  await page.click(`#results .row[data-id="${target.id}"]`);
  await sleep(200);
  await rec("4", "detailName", page.$eval("#d-name", (e) => e.textContent));
  await rec("4", "detailId", page.$eval("#d-id", (e) => e.textContent));
  await rec("4", "data-state", state());
  await rec("4", "selectedRowAria", page.$eval(`#results .row[data-id="${target.id}"]`, (e) => e.getAttribute("aria-selected")));
  const after4 = { scroll: await scrollTop(), chips: await chips(), counter: await counter() };
  await rec("4", "contextBefore", before4);
  await rec("4", "contextAfter", after4);
  await rec("4", "contextIdentical", JSON.stringify(before4) === JSON.stringify(after4));
  await rec("4", "listStillVisibleBesidePanel", page.evaluate(() => {
    const d = document.getElementById("detail").getBoundingClientRect();
    const rows = [...document.querySelectorAll("#results .row")].filter((r) => {
      const b = r.getBoundingClientRect();
      return b.left < d.left && b.right > 0 && b.width > 0;
    });
    return rows.length;
  }));
  await shot(page, "04-detail-open.png");

  /* 5 — keyboard path from clean state: "/" → type → ↓↓↓ → Enter */
  await page.click("#detail-close"); // close panel (focus returns to cursor row)
  await sleep(100);
  await page.click("#clear-all"); // reset filters, search refocused+cleared
  await sleep(150);
  await rec("5", "resetCounter", counter());
  // move focus out of the search input (listbox is focusable, tabindex=0) so "/"
  // exercises the app's focus-search shortcut rather than typing a literal slash
  await page.evaluate(() => document.getElementById("results").focus());
  await page.keyboard.press("Slash"); // real key event → app focuses search
  await sleep(80);
  await rec("5", "focusAfterSlash", page.evaluate(() => document.activeElement.id));
  await page.keyboard.type("census", { delay: 40 });
  for (let i = 0; i < 3; i++) { await page.keyboard.press("ArrowDown"); await sleep(60); }
  await rec("5", "cursorRow", page.$eval("#results .row.cursor", (e) => e.id + " " + e.querySelector(".row-name").textContent));
  await rec("5", "cursorRing", page.$eval("#results .row.cursor", (e) => getComputedStyle(e).boxShadow !== "none"));
  await rec("5", "counter", counter());
  await page.keyboard.press("Enter");
  await sleep(200);
  await rec("5", "detailName", page.$eval("#d-name", (e) => e.textContent));
  await rec("5", "detailId", page.$eval("#d-id", (e) => e.textContent));
  await rec("5", "data-state", state());
  await rec("5", "keyboardInteractions", "Slash + type + 3xArrowDown + Enter = 3 interactions to detail");
  await shot(page, "05-keyboard-path.png");

  /* 6 — empty state */
  await page.keyboard.press("Escape"); // close panel (focus on row, not input)
  await sleep(120);
  await page.click("#search", { clickCount: 3 });
  await page.keyboard.type("zzzqqx", { delay: 30 });
  await sleep(150);
  await rec("6", "emptyHeading", page.$eval("#empty h2", (e) => e.textContent));
  await rec("6", "emptyDetail", page.$eval("#empty-detail", (e) => e.textContent));
  await rec("6", "clearBtnLabel", page.$eval("#empty-clear", (e) => e.textContent));
  await rec("6", "data-state", state());
  await shot(page, "06-empty.png");
  await page.click("#empty-clear");
  await sleep(150);
  await rec("6", "counterAfterClear", counter());

  /* 7 — error state (bad deep link, forced fresh load) */
  await page.goto("about:blank");
  await page.goto(FILE + "#sel=DS-99999", { waitUntil: "load" });
  await sleep(200);
  await rec("7", "detailHiddenOnError", page.$eval("#detail", (e) => e.hidden));
  await rec("7", "bannerVisible", page.$eval("#error-banner", (e) => !e.hidden));
  await rec("7", "bannerText", page.$eval("#error-text", (e) => e.textContent));
  await rec("7", "data-state", state());
  await shot(page, "07-error.png");
  await page.click("#error-reset");
  await sleep(150);
  await rec("7", "bannerHiddenAfterReset", page.$eval("#error-banner", (e) => e.hidden));
  await rec("7", "counterAfterReset", counter());

  /* 8 — context preservation under scroll */
  await page.click("#search", { clickCount: 3 });
  await page.keyboard.type("solar", { delay: 30 });
  await sleep(120);
  await page.click('.tree .facet-row[data-cat="energy"]');
  await sleep(150);
  await page.mouse.move(800, 500);
  await page.mouse.wheel({ deltaY: 800 });
  await sleep(150);
  const before8 = { scroll: await scrollTop(), chips: await chips(), counter: await counter() };
  await rec("8", "before", before8);
  await shot(page, "08a-before-select.png");
  await page.click("#results .row.cursor");
  await sleep(200);
  const after8 = { scroll: await scrollTop(), chips: await chips(), counter: await counter() };
  await rec("8", "after", after8);
  await rec("8", "identical", JSON.stringify(before8) === JSON.stringify(after8));
  await rec("8", "data-state", state());
  await shot(page, "08-context-preserved.png");

  /* 9 — a11y.focus_order measurement: real Tab traversal from a fresh load.
   * Initial focus is #search (app boots focused). Expected DOM tab order after
   * search is computed from the live document; keyboard focus visibility is
   * checked natively via :focus-visible matches (CSS-rule scanning is opaque
   * under file://). */
  await page.goto(FILE, { waitUntil: "load" });
  await page.waitForSelector("#results .row", { timeout: 5000 });
  await sleep(150);
  const initialFocus = await page.evaluate(() => document.activeElement.id || document.activeElement.tagName);
  const expectedTabbables = await page.evaluate(() =>
    [...document.querySelectorAll('#app button:not([hidden]), #app input:not([hidden]), #app [tabindex]:not([tabindex="-1"]):not(button):not(input)')]
      .filter((el) => el.offsetParent !== null) // display:none subtrees (hidden banner/panel) are not tabbable
      .map((el) => (el.id ? "#" + el.id : "") +
        (el.getAttribute("data-tag") ? `[tag=${el.getAttribute("data-tag")}]` : "") +
        (el.getAttribute("data-cat") ? `[cat=${el.getAttribute("data-cat")}]` : "") +
        (el.getAttribute("data-domain") ? `[domain=${el.getAttribute("data-domain")}]` : "") +
        (el.className && typeof el.className === "string" ? "." + el.className.split(" ")[0] : ""))
  );
  const tabOrder = [];
  const focusVisibleFlags = [];
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press("Tab");
    await sleep(40);
    tabOrder.push(await page.evaluate(() => {
      const a = document.activeElement;
      if (!a || a === document.body) return "(body)";
      return (a.id ? "#" + a.id : "") +
        (a.getAttribute("data-tag") ? `[tag=${a.getAttribute("data-tag")}]` : "") +
        (a.getAttribute("data-cat") ? `[cat=${a.getAttribute("data-cat")}]` : "") +
        (a.getAttribute("data-domain") ? `[domain=${a.getAttribute("data-domain")}]` : "") +
        (a.className && typeof a.className === "string" ? "." + a.className.split(" ")[0] : "");
    }));
    focusVisibleFlags.push(await page.evaluate(() => {
      const a = document.activeElement;
      try { return !!a && a !== document.body && a.matches(":focus-visible"); } catch (e) { return false; }
    }));
  }
  // expected order after the initially-focused search = expectedTabbables without the search entry
  const expectedAfterSearch = expectedTabbables.filter((x) => x !== "#search.locate-input");
  const orderMatchesDom = expectedAfterSearch.length >= 12 &&
    tabOrder.every((v, i) => v === expectedAfterSearch[i]);
  const focusResult = {
    measured_at: new Date().toISOString(),
    viewport: { width: 1600, height: 1000 },
    method: "real Tab key events via CDP (page.keyboard.press), fresh page load, 12 steps, compared against live-DOM tabbable order",
    initial_focus: initialFocus,
    tab_order: tabOrder,
    focus_visible: focusVisibleFlags,
    expected_order_prefix: expectedAfterSearch.slice(0, 12),
    assertions: {
      initial_focus_is_search: initialFocus === "search",
      tab_order_follows_dom: orderMatchesDom,
      sequence_advances_no_trap: new Set(tabOrder).size >= 8,
      keyboard_focus_visible_everywhere: focusVisibleFlags.every(Boolean),
    },
    result: null,
  };
  focusResult.result = Object.values(focusResult.assertions).every(Boolean) ? "pass" : "fail";
  const sessionEvidenceDir = path.join(__dirname, "..", ".prax", "design", "sessions", "ds_20260908001459_128963b1", "validation-evidence");
  fs.mkdirSync(sessionEvidenceDir, { recursive: true });
  fs.writeFileSync(path.join(sessionEvidenceDir, "focus-order-run.json"), JSON.stringify(focusResult, null, 2));
  await rec("9", "initialFocus", initialFocus);
  await rec("9", "focusOrderFirst3", tabOrder.slice(0, 3));
  await rec("9", "focusOrderAssertions", focusResult.assertions);
  await rec("9", "a11y.focus_order", focusResult.result);
  await rec("9", "evidenceFile", path.join(sessionEvidenceDir, "focus-order-run.json"));

  /* console */
  const errors = consoleMsgs.filter((m) => ["error", "warning", "pageerror"].includes(m.type));
  await rec("console", "messageCount", consoleMsgs.length);
  await rec("console", "errorsOrWarnings", errors.length ? errors : "none");

  fs.writeFileSync(path.join(OUT, "run-log.json"), JSON.stringify(log, null, 2));
  await browser.close();
  console.log("\nDONE. artifacts in " + OUT);
})().catch((e) => { console.error("FATAL", e); process.exit(1); });
