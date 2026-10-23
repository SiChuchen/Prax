/* 真实浏览器取证：headless Chrome 驱动发布指挥台走完全程并截图。 */
const puppeteer = require("puppeteer-core");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const BASE = "http://127.0.0.1:8931/";

async function main() {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: "new",
    args: ["--window-size=1600,1000", "--force-device-scale-factor=1", "--hide-scrollbars"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 1000 });
  page.on("pageerror", (e) => console.log("PAGE-ERROR:", e.message));
  page.on("console", (m) => { if (m.type() === "error") console.log("CONSOLE-ERROR:", m.text()); });

  await page.goto(BASE, { waitUntil: "networkidle0" });
  await sleep(500);
  const hasLoadingText = await page.evaluate(() => document.body.textContent.includes("加载中"));
  console.log("initial-has-loading-state:", hasLoadingText);
  await shot(page, "01-initial-screen");

  // 推进到灰度门禁 p2-2（先等快速点击产生的 toast 消散，保证截图可见性）
  await advance(page);
  await sleep(3700);
  await shot(page, "02-gate-canary");
  let ok = await judgeGate(page);
  console.log("canary-gate-first-roll-healthy:", ok);
  if (!ok) {
    await sleep(250);
    await shot(page, "03-recovery-canary");
    await doRecovery(page);
    await sleep(250);
    ok = await judgeGate(page);
    console.log("canary-gate-after-recovery-healthy:", ok);
  }

  // p3-1 不可逆：迁移
  await advance(page);
  await sleep(3700);
  await page.evaluate(() => document.querySelectorAll("details.recovery-panel").forEach((d) => (d.open = true)));
  await sleep(300);
  await shot(page, "04-irreversible-migration");
  await page.evaluate(() => document.querySelector('[data-action="exec-irrev"]').click());
  await sleep(250);
  await shot(page, "05-confirm-modal-migrate");
  await confirmModal(page);
  await sleep(250);

  // p3-2 数据校验门禁
  await advance(page);
  ok = await judgeGate(page);
  console.log("migrate-gate-first-roll-healthy:", ok);
  if (!ok) {
    await sleep(200);
    await shot(page, "06-recovery-migrate");
    await doRecovery(page);
    await sleep(200);
    await judgeGate(page);
  }

  // p4-1 不可逆：全量切换
  await advance(page);
  await page.evaluate(() => document.querySelector('[data-action="exec-irrev"]').click());
  await sleep(200);
  await confirmModal(page);
  await sleep(200);

  // p4-2 全量门禁
  await advance(page);
  await sleep(3700);
  await shot(page, "07-gate-cutover");
  ok = await judgeGate(page);
  console.log("cutover-gate-first-roll-healthy:", ok);
  if (!ok) {
    await sleep(200);
    await shot(page, "08-recovery-cutover");
    await doRecovery(page);
    await sleep(200);
    await judgeGate(page);
  }

  // p5 收尾 → 完成判定
  await advance(page);
  await sleep(400);
  const verdict = await page.evaluate(() => {
    const t = document.querySelector(".cert-title");
    return t ? t.textContent : "NO-OVERLAY";
  });
  console.log("final-verdict:", verdict);
  await shot(page, "09-completion-verdict");

  const mistakes = await page.evaluate(() => document.querySelector(".cert-section").textContent.slice(0, 300));
  console.log("mistake-section:", mistakes.replace(/\s+/g, " "));

  await browser.close();
}

async function shot(page, name) {
  await page.screenshot({ path: __dirname + "/" + name + ".png" });
  console.log("shot:", name);
}

/* 在页面内点击检查/操作项，直到遇到门禁、不可逆步骤或完成遮罩 */
async function advance(page) {
  for (let i = 0; i < 60; i++) {
    const stop = await page.evaluate(() => {
      if (!document.getElementById("overlay").classList.contains("hidden")) return "overlay";
      const enabled = (sel) => document.querySelector(sel) && !document.querySelector(sel).disabled;
      if (enabled('#stage [data-action="gate-pass"]')) return "gate";
      if (enabled('#stage [data-action="exec-irrev"]')) return "irreversible";
      const clickFirst = (sel) => {
        const b = [...document.querySelectorAll(sel)].find((x) => !x.disabled);
        if (b) { b.click(); return true; }
        return false;
      };
      if (clickFirst('#stage [data-action="toggle-check"]')) return "clicked";
      if (clickFirst('#stage [data-action="do-act"]')) return "clicked";
      return "stuck";
    });
    if (stop === "overlay" || stop === "gate" || stop === "irreversible") return stop;
    if (stop === "stuck") throw new Error("advance() 卡住，未找到可点击项");
    await sleep(130);
  }
  throw new Error("advance() 超过循环上限");
}

/* 解析门禁表：对照阈值判定，返回首轮指标是否健康 */
async function judgeGate(page) {
  return page.evaluate(() => {
    const rows = [...document.querySelectorAll(".gate-table tbody tr")];
    if (!rows.length) throw new Error("未找到门禁表");
    let pass = true;
    for (const r of rows) {
      const val = parseFloat(r.querySelector(".m-val").textContent);
      const thrTxt = r.querySelector(".m-th").textContent.trim();
      const thr = parseFloat(thrTxt.replace(/[^\d.]/g, ""));
      const ok = thrTxt.includes("≥") ? val >= thr : val < thr;
      if (!ok) pass = false;
    }
    const btn = document.querySelector(pass ? '[data-action="gate-pass"]' : '[data-action="gate-fail"]');
    btn.click();
    return pass;
  });
}

/* 恢复路径：展开面板 → 逐项执行恢复动作 → 复判 */
async function doRecovery(page) {
  for (let i = 0; i < 30; i++) {
    const done = await page.evaluate(() => {
      document.querySelectorAll("details.recovery-panel").forEach((d) => (d.open = true));
      const acts = [...document.querySelectorAll('#stage [data-action="rec-check"], #stage [data-action="rec-act"]')]
        .filter((b) => !b.disabled);
      if (acts.length) { acts[0].click(); return "acted"; }
      const retry = document.querySelector('#stage [data-action="rec-retry"]');
      if (retry && !retry.disabled) { retry.click(); return "retried"; }
      return "none";
    });
    if (done === "retried") return;
    await sleep(130);
  }
  throw new Error("doRecovery() 未完成");
}

/* 确认模态：读取短语 → 填入 → 执行 */
async function confirmModal(page) {
  const phrase = await page.evaluate(() => document.getElementById("modal-phrase").textContent);
  await page.evaluate((p) => {
    const input = document.getElementById("modal-input");
    input.value = p;
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }, phrase);
  await sleep(120);
  const disabled = await page.evaluate(() => document.getElementById("modal-exec").disabled);
  if (disabled) throw new Error("确认按钮未随短语输入启用");
  await page.evaluate(() => document.getElementById("modal-exec").click());
  await sleep(150);
}

main().catch((e) => { console.error("DRIVER-FAIL:", e.message); process.exit(1); });
