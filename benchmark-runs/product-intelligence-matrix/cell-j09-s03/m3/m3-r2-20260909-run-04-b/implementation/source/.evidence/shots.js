/* 浏览器实证脚本：加载即 ready、联动、权重、排除、敲定、键盘、空态 */
const puppeteer = require("puppeteer-core");
const path = require("path");
const fs = require("fs");

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const URL = "file:///E:/codex-prj/ab-worktrees/pi-matrix-r2/cell-j09-s03-b/index.html";
const OUT = path.join(__dirname, "shots");
fs.mkdirSync(OUT, { recursive: true });

const results = [];
function check(label, cond){ results.push({ label, ok: !!cond }); console.log(`${cond ? "PASS" : "FAIL"}: ${label}`); }

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1680, height: 960 });
  const consoleErrors = [];
  page.on("console", m => { if (m.type() === "error") consoleErrors.push(m.text()); });
  page.on("pageerror", e => consoleErrors.push("pageerror: " + e.message));

  // 1) 加载即 ready（无加载态）
  await page.goto(URL, { waitUntil: "load" });
  const atLoad = await page.evaluate(() => ({
    state: document.body.dataset.appState,
    rows: document.querySelectorAll("#matrixBody tr").length,
    pins: document.querySelectorAll("#mapWrap .pin").length,
    bar: document.getElementById("decisionBar").innerText.replace(/\s+/g, " "),
    sliders: document.querySelectorAll("input[type=range]").length,
    loadingUI: !!document.querySelector(".loading, .spinner, [data-state=loading]"),
  }));
  check("body[data-app-state=ready] 在 load 即成立", atLoad.state === "ready");
  check("矩阵行已渲染（4 分组 + 14 标准 = 18 行）", atLoad.rows === 18);
  check("地图 4 个候选点已渲染", atLoad.pins === 4);
  check("14 条权重滑杆已渲染", atLoad.sliders === 14);
  check("决定栏首屏即有领先者（无加载态）", atLoad.bar.includes("当前领先") && !atLoad.loadingUI);
  console.log("决定栏首屏内容:", atLoad.bar);
  await page.screenshot({ path: path.join(OUT, "01-load-ready.png") });

  // 2) 悬停矩阵 A 列单元格 → 地图 A 点预览 + 列预览
  await page.hover('#matrixBody td[data-id="A"][data-crit="rent"]');
  await page.waitForFunction(() =>
    document.querySelector('#mapWrap .pin[data-id="A"]').classList.contains("preview") &&
    document.querySelectorAll("#matrixBody td.preview").length > 0);
  check("悬停矩阵 A 列 → 地图 A 点预览 + 列单元格预览联动", true);
  await page.screenshot({ path: path.join(OUT, "02-hover-linkage.png") });

  // 3) 点击地图 C 点 → 锁定选中，矩阵 C 列标 selected
  await page.click('#mapWrap .pin[data-id="C"] .pin-dot');
  await page.waitForFunction(() =>
    document.querySelector('#mapWrap .pin[data-id="C"]').classList.contains("selected") &&
    document.querySelector('#matrixHead .site-head[data-id="C"]').classList.contains("selected"));
  check("点击地图 C 点 → 矩阵 C 列选中联动（selected 双向互认）", true);
  await page.screenshot({ path: path.join(OUT, "03-select-linkage.png") });

  // 4) 键盘：焦点置于 B 列名 → ←/→ 移动选中
  await page.focus('#matrixHead .sel-btn[data-id="B"]');
  await page.keyboard.press("ArrowRight");
  const kbSel = await page.evaluate(() => document.querySelector(".site-head.selected")?.dataset.id);
  check("键盘 ←/→ 移动选中（B→右侧下一个活跃候选）", ["A", "B", "C", "D"].includes(kbSel) && kbSel !== "B");
  const focusedOk = await page.evaluate(() => document.activeElement?.classList.contains("sel-btn"));
  check("键盘操作后焦点跟随选中列（可见焦点态）", focusedOk);
  await page.screenshot({ path: path.join(OUT, "04-keyboard.png") });

  // 5) 权重调整 → 领先者即时重算（驻留顶栏）
  const before = await page.evaluate(() => document.querySelector("#decisionBar .lead-name")?.textContent);
  const rentBefore = await page.evaluate(() => {
    const t = {}; document.querySelectorAll("#matrixHead .total-num").forEach((el, i) => t["ABCD"[i]] = el.textContent);
    return t;
  });
  await page.$eval('input[type=range][data-crit="rent"]', el => {
    el.value = "0"; el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  const after = await page.evaluate(() => ({
    lead: document.querySelector("#decisionBar .lead-name")?.textContent,
    rentVal: document.querySelector('input[type=range][data-crit="rent"]').closest(".wrow").querySelector(".wval").textContent,
    totals: (() => { const t = {}; document.querySelectorAll("#matrixHead .total-num").forEach((el, i) => t["ABCD"[i]] = el.textContent); return t; })(),
  }));
  check("月租金权重 4→0 后加权总分即时变化", JSON.stringify(rentBefore) !== JSON.stringify(after.totals));
  check("权重值数值常驻可见并更新", after.rentVal.includes("0"));
  console.log(`领先者: ${before} → ${after.lead}（租金权重归零后）`);
  await page.screenshot({ path: path.join(OUT, "05-weight-change.png") });

  // 6) 恢复租金权重，排除当前领先者 → 领先者转移、列置灰
  await page.$eval('input[type=range][data-crit="rent"]', el => {
    el.value = "4"; el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  const leadBeforeExclude = await page.evaluate(() => document.querySelector("#decisionBar .lead-name")?.textContent);
  const leadId = leadBeforeExclude.trim()[0];
  await page.click(`#matrixHead .exclude[data-id="${leadId}"]`);
  const afterExclude = await page.evaluate(id => ({
    lead: document.querySelector("#decisionBar .lead-name")?.textContent,
    off: document.querySelector(`#matrixHead .site-head[data-id="${id}"]`)?.classList.contains("off"),
    stillLeader: document.querySelector("#decisionBar .lead-name")?.textContent.trim()[0] === id,
  }), leadId);
  check(`排除领先者 ${leadId} 后其列置灰退出比较`, afterExclude.off && !afterExclude.stillLeader);
  console.log(`排除前领先: ${leadBeforeExclude} / 排除后领先: ${afterExclude.lead}`);
  await page.screenshot({ path: path.join(OUT, "06-exclude.png") });

  // 7) 敲定此处 → 决定驻留顶栏 + 地图标旗 + 列头徽记
  const commitId = await page.evaluate(() => {
    const ids = [...document.querySelectorAll("#matrixHead .commit:not([disabled])")].map(b => b.dataset.id);
    return ids[0];
  });
  await page.click(`#matrixHead .commit[data-id="${commitId}"]`);
  const committed = await page.evaluate(id => ({
    bar: document.getElementById("decisionBar").innerText.replace(/\s+/g, " "),
    pinFlag: document.querySelector(`#mapWrap .pin[data-id="${id}"]`)?.classList.contains("committed"),
    badge: document.querySelector(`#matrixHead .site-head[data-id="${id}"]`)?.classList.contains("is-decided"),
  }), commitId);
  check("敲定后决定栏驻留「已决定 + 候选 + 时间」", committed.bar.includes("已决定") && committed.bar.includes(commitId));
  check("敲定后地图候选点出现「已选定」标旗", committed.pinFlag);
  check("敲定后列头出现决定徽记", committed.badge);
  await page.screenshot({ path: path.join(OUT, "07-committed.png") });

  // 8) 重新比较 → 回到未决；排除全部候选 → 决定栏空态
  await page.click("#resetBtn");
  const resetOk = await page.evaluate(() => document.getElementById("decisionBar").innerText.includes("当前领先"));
  check("「重新比较」后回到未决态", resetOk);
  for (const id of ["A", "B", "C", "D"]) await page.click(`#matrixHead .exclude[data-id="${id}"]`);
  const emptyBar = await page.evaluate(() => document.getElementById("decisionBar").innerText.replace(/\s+/g, " "));
  check("全部排除后决定栏进入空态提示", emptyBar.includes("参与比较的候选为 0"));
  await page.screenshot({ path: path.join(OUT, "08-empty-state.png") });

  check("全程无 console 错误 / 页面异常", consoleErrors.length === 0);
  if (consoleErrors.length) console.log("console errors:", consoleErrors);

  const failed = results.filter(r => !r.ok);
  console.log(`\n== 结果: ${results.length - failed.length}/${results.length} 通过 ==`);
  fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify({ results, consoleErrors }, null, 2));
  await browser.close();
  process.exit(failed.length ? 1 : 0);
})().catch(e => { console.error("SCRIPT ERROR:", e); process.exit(2); });
