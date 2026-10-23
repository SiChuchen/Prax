/* Real-browser evidence harness for Plotboard.
   Runs the keyboard create-and-place journey in a local Chromium (Edge/Chrome)
   via puppeteer-core and saves screenshots to evidence/. Not part of the app. */
const puppeteer = require("puppeteer-core");
const fs = require("fs");
const path = require("path");

const OUT = path.join(__dirname, "..", "evidence");
fs.mkdirSync(OUT, { recursive: true });

const CANDIDATES = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  process.env.LOCALAPPDATA + "\\Google\\Chrome\\Application\\chrome.exe"
];
const exe = CANDIDATES.find((p) => p && fs.existsSync(p));

const URL = "file:///E:/codex-prj/ab-worktrees/pi-matrix-r3/cell-j07-s07-b/index.html";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = { browser: exe || null, steps: {}, errors: [] };

(async () => {
  if (!exe) throw new Error("No Edge/Chrome executable found");
  const browser = await puppeteer.launch({
    executablePath: exe,
    headless: true,
    defaultViewport: { width: 1440, height: 900 },
    args: ["--force-device-scale-factor=1"]
  });
  const page = await browser.newPage();
  page.on("pageerror", (e) => results.errors.push("pageerror: " + e.message));
  page.on("console", (m) => {
    if (m.type() === "error") results.errors.push("console.error: " + m.text());
  });

  const counts = () =>
    page.evaluate(() => ({
      zones: document.querySelectorAll("#zoneLayer .zone").length,
      tiles: document.querySelectorAll("#objLayer .tile").length
    }));
  const hint = () => page.evaluate(() => document.getElementById("statusHint").textContent);
  const shot = (n) => page.screenshot({ path: path.join(OUT, n) });

  await page.goto(URL, { waitUntil: "load" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "load" });
  await sleep(350);

  // 1 — first paint
  results.steps.s1_firstPaint = {
    ...(await counts()),
    stats: await page.evaluate(() => document.getElementById("statusStats").textContent),
    hint: await hint(),
    title: await page.title(),
    loadingElement: await page.evaluate(() => !!document.querySelector(".loading, [data-loading]"))
  };
  await shot("01-first-paint.png");

  // 2 — Tab selects first tile; inspector shows derived facts + neighbor link
  await page.keyboard.press("Tab");
  await sleep(180);
  results.steps.s2_selection = await page.evaluate(() => ({
    selected: !!document.querySelector(".tile.selected"),
    selectedName: (document.querySelector(".tile.selected .t-name") || {}).textContent || null,
    link: !!document.querySelector("#fxLayer .link"),
    linkLabel: (document.querySelector("#fxLayer .link-label") || {}).textContent || null,
    inspectorText: document.getElementById("inspector").innerText
  }));
  await shot("02-selection-derived-facts.png");

  // 3 — N ghost, arrows position it, landing hint names the zone
  await page.keyboard.press("n");
  await sleep(150);
  const ghostStart = await page.evaluate(() => ({
    ghost: !!document.querySelector("#fxLayer .ghost"),
    hint: document.getElementById("statusHint").textContent
  }));
  for (let i = 0; i < 3; i++) await page.keyboard.press("ArrowRight");
  for (let i = 0; i < 2; i++) await page.keyboard.press("ArrowDown");
  await sleep(150);
  results.steps.s3_placing = { ghostStart, afterArrows: await page.evaluate(() => ({
    ghost: !!document.querySelector("#fxLayer .ghost"),
    hint: document.getElementById("statusHint").textContent
  })) };
  await shot("03-placing-ghost.png");

  // 4 — Enter commits; rename opens
  await page.keyboard.press("Enter");
  await sleep(200);
  results.steps.s4_committed = {
    ...(await counts()),
    renameVisible: await page.evaluate(() => !!document.querySelector(".rename-input")),
    renameValue: await page.evaluate(() => ((document.querySelector(".rename-input") || {}).value || null))
  };
  await shot("04-committed-rename.png");
  await page.keyboard.press("Escape");
  await sleep(120);

  // 5 — click Rolling Cart, send to zone 4 (Archive)
  const cart = await page.evaluate(() => {
    const el = [...document.querySelectorAll(".tile")].find((t) => t.textContent.includes("Rolling Cart"));
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  await page.mouse.click(cart.x, cart.y);
  await sleep(150);
  await page.keyboard.press("4");
  await sleep(350);
  results.steps.s5_sendToZone = await page.evaluate(() => {
    const el = [...document.querySelectorAll(".tile")].find((t) => t.textContent.includes("Rolling Cart"));
    const archive = [...document.querySelectorAll(".zone-chip")].find((c) => c.textContent.includes("Archive"));
    return {
      cartLeft: el.style.left,
      cartTop: el.style.top,
      archiveStillExists: !!archive,
      statusHint: document.getElementById("statusHint").textContent
    };
  });
  await shot("05-send-to-zone.png");

  // 6 — help overlay
  await page.keyboard.press("?");
  await sleep(150);
  results.steps.s6_help = await page.evaluate(() => ({
    helpHidden: document.getElementById("helpOverlay").hidden
  }));
  await shot("06-help-overlay.png");
  await page.keyboard.press("Escape");
  await sleep(120);

  // 7 — select Archive zone chip, Delete; tiles must survive
  const chip = await page.evaluate(() => {
    const c = [...document.querySelectorAll(".zone-chip")].find((x) => x.textContent.includes("Archive"));
    if (!c) return null;
    const r = c.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  if (chip) {
    await page.mouse.click(chip.x, chip.y);
    await sleep(150);
    await page.keyboard.press("Delete");
    await sleep(250);
  }
  results.steps.s7_deleteZone = { chipFound: !!chip, ...(await counts()) };
  await shot("07-zone-deleted-keeps-tiles.png");

  // 8 — reload: autosave restores
  await page.reload({ waitUntil: "load" });
  await sleep(400);
  results.steps.s8_reloadAutosave = await counts();
  await shot("08-reload-autosave.png");

  // 9 — two-step reset
  await page.click("#btnReset");
  await sleep(200);
  results.steps.s9_reset = {
    armedText: await page.evaluate(() => document.getElementById("btnReset").textContent)
  };
  await page.click("#btnReset");
  await sleep(350);
  results.steps.s9_reset = {
    ...results.steps.s9_reset,
    ...(await counts()),
    finalButtonText: await page.evaluate(() => document.getElementById("btnReset").textContent)
  };
  await shot("09-reset-scene.png");

  await browser.close();
  console.log(JSON.stringify(results, null, 1));
})().catch((e) => {
  results.fatal = String(e && e.stack || e);
  console.log(JSON.stringify(results, null, 1));
  process.exit(1);
});
