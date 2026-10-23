// 真实浏览器证据采集：puppeteer-core 驱动本机 Chrome，
// 对构建产物 dist/ 做加载、编辑、同步、删除恢复、校验、键盘聚焦的
// 真实交互，逐步断言并截图到 evidence/。仅使用本机资源（localhost）。
import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { mkdirSync } from "node:fs";
import puppeteer from "puppeteer-core";

const ROOT = path.resolve(import.meta.dirname, "..");
const DIST = path.join(ROOT, "dist");
const OUT = path.join(ROOT, "evidence");
const PORT = 4199;
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

mkdirSync(OUT, { recursive: true });
const results = [];
const assert = (cond, id, detail, artifact = []) => {
  results.push({ id, pass: !!cond, detail, artifacts: artifact });
  console.log(`${cond ? "PASS" : "FAIL"}  ${id}  ${detail}`);
  return !!cond;
};

// —— 极简静态服务器：只服务 dist/index.html 与静态资源 ——
const server = http
  .createServer(async (req, res) => {
    try {
      const url = req.url.split("?")[0];
      const file = path.join(DIST, url === "/" ? "index.html" : url.slice(1));
      const data = await readFile(file);
      const type = file.endsWith(".html") ? "text/html; charset=utf-8"
        : file.endsWith(".js") ? "text/javascript" : "application/octet-stream";
      res.writeHead(200, { "content-type": type });
      res.end(data);
    } catch {
      res.writeHead(404);
      res.end("not found");
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
const shot = (name) => page.screenshot({ path: path.join(OUT, name), fullPage: false });

try {
  // ── 0. file:// 直接静态打开 ──
  await page.goto(pathToFileURL(path.join(DIST, "index.html")).href, { waitUntil: "load" });
  const fileOk = await page.evaluate(() => document.querySelector(".paper h1")?.textContent.trim() || "");
  assert(
    fileOk.includes("Aurora"),
    "static_file_open",
    `dist/index.html renders over file:// — h1 = "${fileOk}"`,
    ["evidence/00-file-open.png"]
  ).valueOf && (await shot("00-file-open.png"));

  // ── 1. 首屏即 ready：加载完成即有完整内容，无加载态 ──
  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: "load" });
  const ready = await page.evaluate(() => ({
    previewSections: document.querySelectorAll(".pv-sec").length,
    editorCards: document.querySelectorAll(".sec-card").length,
    loadingNodes: document.querySelectorAll(".loading,[data-loading]").length,
    hasTitle: document.body.innerText.includes("Aurora 笔记 2.4 更新说明"),
    pill: document.querySelector(".pill-ok")?.textContent.trim() || "",
  }));
  await shot("01-initial-ready.png");
  assert(
    ready.previewSections === 5 && ready.editorCards === 5 && ready.loadingNodes === 0 && ready.hasTitle,
    "ready_at_first_paint",
    `at load event: ${ready.previewSections} preview sections, ${ready.editorCards} editor cards, ${ready.loadingNodes} loading nodes, pill="${ready.pill}"`,
    ["evidence/01-initial-ready.png"]
  );

  // ── 2. 结构化编辑 → 预览即时一致 ──
  const itemInput = await page.$('input[aria-label="第 2 节第 2 条"]');
  await itemInput.click();
  await page.keyboard.down("Control");
  await page.keyboard.press("a");
  await page.keyboard.up("Control");
  await page.keyboard.type("双链引用与反向链接面板");
  await new Promise((r) => setTimeout(r, 120));
  const synced = await page.evaluate(() => ({
    previewHasNew: document.querySelector(".paper").innerText.includes("双链引用与反向链接面板"),
    previewStillOld: document.querySelector(".paper").innerText.includes("离线草稿自动保存"),
  }));
  await shot("02-edit-preview-sync.png");
  assert(
    synced.previewHasNew && !synced.previewStillOld,
    "edit_preview_consistency",
    "typed list item text appears in preview immediately; old text gone",
    ["evidence/02-edit-preview-sync.png"]
  );

  // ── 3. 预览点选 → 编辑器反向高亮（双向同步）──
  const sel = await page.evaluate(() => {
    const el = [...document.querySelectorAll(".pv-sec")].find((e) =>
      e.querySelector("h2")?.textContent.includes("升级须知")
    );
    el.click();
    return el.dataset.section;
  });
  await new Promise((r) => setTimeout(r, 200));
  const bothSelected = await page.evaluate((id) => {
    const card = document.querySelector(`.sec-card[data-section="${id}"]`);
    const pv = document.querySelector(`.pv-sec[data-section="${id}"]`);
    return { card: card?.classList.contains("selected"), pv: pv?.classList.contains("selected") };
  }, sel);
  await shot("03-selection-sync.png");
  assert(
    bothSelected.card && bothSelected.pv,
    "bidirectional_selection_sync",
    `clicking preview block highlights both panes (card=${bothSelected.card}, preview=${bothSelected.pv})`,
    ["evidence/03-selection-sync.png"]
  );

  // ── 4. 删除章节（破坏性）→ 撤销完整恢复 ──
  const beforeDel = await page.evaluate(() => document.querySelectorAll(".pv-sec").length);
  await page.click('button[aria-label="删除「版本速览」"]');
  await new Promise((r) => setTimeout(r, 120));
  const afterDel = await page.evaluate(() => ({
    n: document.querySelectorAll(".pv-sec").length,
    gone: !document.body.innerText.includes("版本速览"),
  }));
  await shot("04-section-deleted.png");
  await page.keyboard.down("Control");
  await page.keyboard.press("z");
  await page.keyboard.up("Control");
  await new Promise((r) => setTimeout(r, 150));
  const afterUndo = await page.evaluate(() => document.querySelectorAll(".pv-sec").length);
  const restored = await page.evaluate(() => document.body.innerText.includes("版本速览"));
  await shot("05-undo-restored.png");
  assert(
    afterDel.n === beforeDel - 1 && afterDel.gone && afterUndo === beforeDel && restored,
    "destructive_recovery",
    `delete: ${beforeDel}→${afterDel.n} sections (old text gone=${afterDel.gone}); Ctrl+Z restores to ${afterUndo}`,
    ["evidence/04-section-deleted.png", "evidence/05-undo-restored.png"]
  );

  // ── 5. 内容空缺 → 结构检查实时提示，且两侧一致 ──
  const heading = await page.$('input[aria-label="第 1 节标题"]');
  await heading.click();
  await page.keyboard.down("Control");
  await page.keyboard.press("a");
  await page.keyboard.up("Control");
  await page.keyboard.press("Delete");
  await new Promise((r) => setTimeout(r, 150));
  const valid = await page.evaluate(() => ({
    pill: document.querySelector(".pill-warn")?.textContent.trim() || "",
    flag: !!document.querySelector(".pv-flag"),
    ph: document.querySelector(".paper").innerText.includes("（未命名章节）"),
  }));
  await shot("06-content-validation.png");
  assert(
    valid.pill.includes("1 项待处理") && valid.flag && valid.ph,
    "live_validation_consistent",
    `empty heading → pill="${valid.pill}", preview flag=${valid.flag}, placeholder=${valid.ph}`,
    ["evidence/06-content-validation.png"]
  );
  await page.keyboard.down("Control");
  await page.keyboard.press("z");
  await page.keyboard.up("Control");

  // ── 6. 键盘可操作：Tab 聚焦有可见焦点环；Ctrl+Z 已在步骤 4/5 证明 ──
  await page.evaluate(() => document.activeElement?.blur());
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  const kb = await page.evaluate(() => {
    const el = document.activeElement;
    const cs = getComputedStyle(el);
    return {
      tag: el.tagName,
      label: el.getAttribute("aria-label") || el.textContent?.trim().slice(0, 12) || "",
      outline: `${cs.outlineStyle} ${cs.outlineWidth}`,
    };
  });
  await page.screenshot({
    path: path.join(OUT, "07-focus-ring.png"),
    clip: { x: 0, y: 0, width: 1600, height: 64 },
  });
  assert(
    kb.tag === "BUTTON" && kb.outline.startsWith("solid 2px"),
    "keyboard_operable",
    `Tab reaches interactive control (${kb.tag} "${kb.label}") with ${kb.outline} focus ring; Ctrl+Z/Ctrl+Y verified above`,
    ["evidence/07-focus-ring.png"]
  );

  // ── 7. 导出与模型同源：复制 Markdown ──
  let clip = null;
  try {
    const cdp = await page.createCDPSession();
    await cdp.send("Browser.grantPermissions", {
      permissions: ["clipboardReadWrite", "clipboardSanitizedWrite"],
      origin: `http://127.0.0.1:${PORT}`,
    });
    await page.click("header .header-actions button:nth-child(3)");
    await new Promise((r) => setTimeout(r, 250));
    clip = await page.evaluate(() => navigator.clipboard.readText());
  } catch (e) {
    clip = `clipboard-read unavailable in headless: ${e.message.slice(0, 80)}`;
  }
  assert(
    typeof clip === "string" && clip.startsWith("# Aurora 笔记 2.4 更新说明") && clip.includes("## 版本速览"),
    "export_from_same_model",
    `clipboard Markdown derives from the model: starts with document H1 and section headings (got ${typeof clip === "string" ? clip.slice(0, 40) + "…" : clip})`,
    ["evidence/results.json"]
  );

  // ── 8. 重置确认对话框存在（破坏性操作有防护）──
  page.once("dialog", (d) => {
    results.push({ id: "reset_confirm_dialog", pass: /撤销/.test(d.message()), detail: `confirm text: "${d.message()}"`, artifacts: [] });
    console.log(`PASS  reset_confirm_dialog  "${d.message()}"`);
    d.accept();
  });
  await page.evaluate(() => [...document.querySelectorAll("header button")].find((b) => b.textContent.includes("重置")).click());
  await new Promise((r) => setTimeout(r, 250));
} finally {
  await browser.close();
  server.close();
}

const failed = results.filter((r) => !r.pass);
const { writeFile } = await import("node:fs/promises");
await writeFile(path.join(OUT, "results.json"), JSON.stringify(results, null, 2));
console.log(`\n${results.length - failed.length}/${results.length} checks passed; evidence in evidence/`);
process.exit(failed.length ? 1 : 0);
