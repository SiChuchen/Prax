/* CDP 交互取证：真实按键 / 真实鼠标点击 / 控制台采集 / 截图（零依赖，Node ≥22） */
"use strict";
const fs = require("fs");
const path = require("path");

const APP_URL = "file:///E:/codex-prj/ab-worktrees/pi-matrix-r3/cell-j06-s06-b/index.html";
const OUT_DIR = "E:/codex-prj/ab-worktrees/pi-matrix-r3/cell-j06-s06-b/evidence";
const PORT = 9333;
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const { spawn } = require("child_process");
  const profile = path.join(process.env.TEMP, "cdp-profile-" + Date.now());
  const chrome = spawn(CHROME, [
    "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
    "--window-size=1680,1050", "about:blank"
  ], { stdio: "ignore" });

  // 等调试端口就绪
  let version = null;
  for (let i = 0; i < 60; i++) {
    try { version = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json(); break; }
    catch { await sleep(250); }
  }
  if (!version) { chrome.kill(); throw new Error("CDP 端口未就绪"); }

  const target = await (await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(APP_URL)}`, { method: "PUT" })).json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

  let msgId = 0;
  const pending = new Map();
  const consoleEntries = [];
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    else if (m.method === "Runtime.consoleAPICalled")
      consoleEntries.push({ kind: "console." + m.params.type, text: m.params.args.map(a => a.value != null ? String(a.value) : (a.description || a.type)).join(" ") });
    else if (m.method === "Runtime.exceptionThrown")
      consoleEntries.push({ kind: "exception", text: m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text });
    else if (m.method === "Log.entryAdded")
      consoleEntries.push({ kind: "log." + m.params.entry.level, text: m.params.entry.text });
  };
  const cdp = (method, params = {}) => new Promise((res, rej) => {
    const id = ++msgId;
    pending.set(id, (m) => m.error ? rej(new Error(method + ": " + JSON.stringify(m.error))) : res(m.result));
    ws.send(JSON.stringify({ id, method, params }));
  });
  const evaljs = async (expression) => {
    const r = await cdp("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    return r.result.value;
  };
  const KEY = {
    ArrowDown: { key: "ArrowDown", code: "ArrowDown", windowsVirtualKeyCode: 40, nativeVirtualKeyCode: 40 },
    Escape: { key: "Escape", code: "Escape", windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 },
    c: { key: "c", code: "KeyC", text: "c", windowsVirtualKeyCode: 67, nativeVirtualKeyCode: 67 }
  };
  async function press(name) {
    const k = KEY[name];
    await cdp("Input.dispatchKeyEvent", { type: k.text ? "keyDown" : "rawKeyDown", ...k });
    await cdp("Input.dispatchKeyEvent", { type: "keyUp", key: k.key, code: k.code, windowsVirtualKeyCode: k.windowsVirtualKeyCode, nativeVirtualKeyCode: k.nativeVirtualKeyCode });
  }
  async function realClick(sel) {
    const r = await evaljs(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; e.scrollIntoView({block:'center'}); const b = e.getBoundingClientRect(); return {x: b.left + b.width/2, y: b.top + b.height/2}; })()`);
    if (!r) throw new Error("元素不存在: " + sel);
    for (const t of ["mouseMoved", "mousePressed", "mouseReleased"])
      await cdp("Input.dispatchMouseEvent", { type: t, x: r.x, y: r.y, button: "left", clickCount: t === "mouseMoved" ? 0 : 1 });
  }
  async function shot(name) {
    const r = await cdp("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(path.join(OUT_DIR, name), Buffer.from(r.data, "base64"));
  }
  const sel = () => evaljs(`(document.querySelector("article.ev.selected") || {}).dataset?.id || null`);
  const read = (s) => evaljs(`(document.querySelector(${JSON.stringify(s)}) || {}).textContent?.trim() || null`);

  const report = {};
  try {
    await cdp("Runtime.enable"); await cdp("Log.enable"); await cdp("Page.enable");
    await sleep(600);

    // 步骤1：首屏即用（无加载态）+ 自检行
    report.step1 = await evaljs(`({
      evCount: document.querySelectorAll("article.ev").length,
      integrity: document.getElementById("integrity").textContent,
      loadingElements: document.querySelectorAll("[class*=loading]").length
    })`);
    report.step1_initialSelected = await sel();
    report.step1_inspectorTitle = await read("#inspectorBody .ins-head h3");

    // 步骤3：真实 ArrowDown ×2
    await press("ArrowDown"); await sleep(150);
    const s1 = await sel();
    await press("ArrowDown"); await sleep(150);
    report.step3 = { after1: s1, after2: await sel() };

    // 步骤4：真实 C 键 → 游标对齐选中事件
    await press("c"); await sleep(200);
    report.step4 = {
      cursorLabel: await read("#cursorLabel"),
      foldCount: await read("#foldCount"),
      snapAt: await read("#snapAt")
    };
    await shot("05-keyboard-selection.png");

    // 步骤5：真实点击检查器中的起因 chip（◀ e04 发版）
    await realClick("#inspectorBody .chip-cause");
    await sleep(400);
    report.step5 = {
      selected: await sel(),
      inChainCount: await evaljs(`document.querySelectorAll("article.ev.in-chain").length`),
      activeEdges: await evaljs(`document.querySelectorAll("#edgeSvg .edge-active").length`),
      inspectorTitle: await read("#inspectorBody .ins-head h3")
    };
    await shot("06-chip-navigation.png");

    // 步骤6：Esc 取消选择 → 引导态
    await press("Escape"); await sleep(150);
    report.step6 = {
      selected: await sel(),
      guideShown: await evaljs(`document.getElementById("inspectorBody").textContent.includes("未选中事件")`)
    };

    // 步骤7：Esc 后 ArrowDown → 恢复选择
    await press("ArrowDown"); await sleep(150);
    report.step7 = { selected: await sel() };

    report.console = consoleEntries;
  } finally {
    ws.close(); chrome.kill();
  }

  fs.writeFileSync(path.join(OUT_DIR, "interaction-log.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => { console.error("FATAL", e); process.exit(1); });
