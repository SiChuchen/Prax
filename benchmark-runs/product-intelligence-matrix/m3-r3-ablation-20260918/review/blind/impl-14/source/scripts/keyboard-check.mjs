// 键盘可操作性度量：全程不使用鼠标，产生可核对的运行日志（measurement receipt）。
// 三段独立的键盘旅程，每段都从全新加载开始（Tab 位置确定）。
// 输出：evidence/keyboard-run.log + evidence/keyboard-run.json
import http from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { mkdirSync } from "node:fs";
import puppeteer from "puppeteer-core";

const ROOT = path.resolve(import.meta.dirname, "..");
const DIST = path.join(ROOT, "dist");
const OUT = path.join(ROOT, "evidence");
const PORT = 4198;
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
mkdirSync(OUT, { recursive: true });

const log = [];
const say = (m) => {
  log.push(`[${new Date().toISOString()}] ${m}`);
  console.log(m);
};
const server = http
  .createServer(async (req, res) => {
    try {
      const data = await readFile(path.join(DIST, req.url.split("?")[0] === "/" ? "index.html" : req.url.slice(1)));
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(data);
    } catch {
      res.writeHead(404);
      res.end();
    }
  })
  .listen(PORT, "127.0.0.1");

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  defaultViewport: { width: 1600, height: 1000 },
  args: ["--no-first-run", "--disable-gpu"],
});
const page = await browser.newPage();
const outcomes = [];
const check = (id, cond, detail) => {
  outcomes.push({ id, pass: !!cond, detail });
  say(`${cond ? "PASS" : "FAIL"} ${id} — ${detail}`);
};
const freshLoad = async () => page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: "load" });
const activeInfo = () =>
  page.evaluate(() => {
    const el = document.activeElement;
    const cs = getComputedStyle(el);
    return {
      tag: el.tagName,
      label: el.getAttribute("aria-label") || "",
      cls: el.className || "",
      outline: `${cs.outlineStyle} ${cs.outlineWidth}`,
    };
  });

try {
  // ── 旅程 1：纯键盘编辑标题 → 预览同步 → 撤销 → 重做 ──
  await freshLoad();
  await page.keyboard.press("Tab"); // 首个停靠点即标题输入框
  let info = await activeInfo();
  check("keyboard_focus_title", info.label === "文档标题" && info.outline === "solid 2px",
    `first Tab lands on title input, focus ring "${info.outline}"`);
  await page.keyboard.down("Control");
  await page.keyboard.press("a");
  await page.keyboard.up("Control");
  await page.keyboard.type("Aurora 笔记 2.5 更新说明");
  await new Promise((r) => setTimeout(r, 120));
  let h1 = await page.evaluate(() => document.querySelector(".paper h1")?.textContent.trim());
  check("keyboard_edit_updates_preview", h1 === "Aurora 笔记 2.5 更新说明", `preview h1 after typing = "${h1}"`);
  await page.keyboard.down("Control");
  await page.keyboard.press("z");
  await page.keyboard.up("Control");
  await new Promise((r) => setTimeout(r, 120));
  h1 = await page.evaluate(() => document.querySelector(".paper h1")?.textContent.trim());
  check("keyboard_undo_restores", h1 === "Aurora 笔记 2.4 更新说明", `preview h1 after Ctrl+Z = "${h1}"`);
  await page.keyboard.down("Control");
  await page.keyboard.press("y");
  await page.keyboard.up("Control");
  await new Promise((r) => setTimeout(r, 120));
  h1 = await page.evaluate(() => document.querySelector(".paper h1")?.textContent.trim());
  check("keyboard_redo", h1 === "Aurora 笔记 2.5 更新说明", `preview h1 after Ctrl+Y = "${h1}"`);

  // ── 旅程 2：Tab 遍历前 8 个停靠点，全部可交互且有可见焦点环 ──
  await freshLoad();
  const stops = [];
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press("Tab");
    const s = await activeInfo();
    stops.push({ tag: s.tag, label: s.label || s.cls, outline: s.outline });
  }
  say("tab stops: " + JSON.stringify(stops));
  check(
    "tab_traversal_focus_ring",
    stops.every((s) => ["BUTTON", "INPUT", "SELECT", "TEXTAREA"].includes(s.tag)) &&
      stops.every((s) => s.outline === "solid 2px"),
    "8/8 tab stops are interactive elements with 'solid 2px' focus ring"
  );

  // ── 旅程 3：Tab 至预览块 → Enter 选中 → 双侧高亮 ──
  await freshLoad();
  const tabbable = await page.evaluate(
    () =>
      document.querySelectorAll('button:not(:disabled), input, select, textarea, [tabindex="0"]')
        .length
  );
  say(`tabbable elements in DOM order: ${tabbable}`);
  let found = -1;
  for (let i = 0; i < tabbable + 5; i++) {
    await page.keyboard.press("Tab");
    const isPv = await page.evaluate(() => document.activeElement?.classList.contains("pv-sec") || false);
    if (isPv) {
      found = i + 1;
      break;
    }
  }
  info = await activeInfo();
  await page.keyboard.press("Enter");
  await new Promise((r) => setTimeout(r, 200));
  const sel = await page.evaluate(() => {
    const id = document.activeElement.dataset.section;
    return {
      pv: document.activeElement.classList.contains("selected"),
      card: document.querySelector(`.sec-card[data-section="${id}"]`)?.classList.contains("selected"),
    };
  });
  check(
    "keyboard_select_preview_block",
    found > 0 && sel.pv && sel.card,
    `Tab reached preview block in ${found} stops ("${info.label}"); Enter selected both panes (pv=${sel.pv}, editor card=${sel.card})`
  );
} finally {
  await browser.close();
  server.close();
}

const passed = outcomes.filter((o) => o.pass).length;
say(`SUMMARY: ${passed}/${outcomes.length} keyboard checks passed`);
await writeFile(path.join(OUT, "keyboard-run.log"), log.join("\n") + "\n");
await writeFile(path.join(OUT, "keyboard-run.json"), JSON.stringify(outcomes, null, 2));
process.exit(passed === outcomes.length ? 0 : 1);
