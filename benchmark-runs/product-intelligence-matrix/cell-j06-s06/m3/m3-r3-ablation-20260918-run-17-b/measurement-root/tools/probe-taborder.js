/* Tab 焦点顺序预检：模拟 a11y.focus_order（≤64 停靠、可见指示器、视觉行带逆序） */
"use strict";
const path = require("path");
const APP_URL = "file:///E:/codex-prj/ab-worktrees/pi-matrix-r3/cell-j06-s06-b/index.html";
const PORT = 9337;
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const { spawn } = require("child_process");
  const profile = path.join(process.env.TEMP, "cdp-tab-" + Date.now());
  const chrome = spawn(CHROME, ["--headless=new", "--disable-gpu", "--no-first-run",
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, "--window-size=1680,1050", "about:blank"], { stdio: "ignore" });
  for (let i = 0; i < 60; i++) { try { await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json(); break; } catch { await sleep(250); } }
  const target = await (await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(APP_URL)}`, { method: "PUT" })).json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0; const pend = new Map();
  ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
  const cdp = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pend.set(i, (m) => m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result)); ws.send(JSON.stringify({ id: i, method, params })); });
  await cdp("Runtime.enable"); await cdp("Page.enable");
  await sleep(600);
  const visited = [];
  let incomplete = "reached 64 stops";
  for (let i = 0; i < 64; i++) {
    await cdp("Input.dispatchKeyEvent", { type: "rawKeyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9 });
    await cdp("Input.dispatchKeyEvent", { type: "keyUp", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9 });
    const stop = await (await cdp("Runtime.evaluate", { expression: `(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      const s = getComputedStyle(el);
      const outline = s.outlineStyle !== "none" && parseFloat(s.outlineWidth || "0") > 0 && s.outlineColor !== "transparent";
      const r = el.getBoundingClientRect();
      return { sel: el.id ? el.tagName.toLowerCase() + "#" + el.id : (el.className && typeof el.className === "string" ? el.tagName.toLowerCase() + "." + el.className.split(" ")[0] : el.tagName.toLowerCase()),
        tag: el.tagName.toLowerCase(), tabindex: el.tabIndex,
        indicator: outline || s.boxShadow !== "none", x: r.x, y: r.y, w: r.width, h: r.height,
        label: (el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 24) };
    })()`, returnByValue: true })).result;
    if (!stop.value) { incomplete = (await (await cdp("Runtime.evaluate", { expression: "document.hasFocus()", returnByValue: true })).result.value) ? "focus on body" : "done"; break; }
    visited.push(stop.value);
  }
  const inversions = [];
  for (let i = 1; i < visited.length; i++) {
    const p = visited[i - 1], c = visited[i];
    const tol = Math.max(p.h, c.h) / 2;
    if (c.y + tol < p.y - tol || (Math.abs(c.y - p.y) <= tol && c.x < p.x - tol)) inversions.push({ from: p.label, to: c.label });
  }
  console.log(JSON.stringify({
    stops: visited.length,
    incomplete,
    missingIndicators: visited.filter(s => !s.indicator).map(s => s.sel),
    inversions,
    sequence: visited.map(s => `[${Math.round(s.x)},${Math.round(s.y)}] ${s.label}`)
  }, null, 2));
  ws.close();
  const { spawn: s2 } = require("child_process");
}
main().catch((e) => { console.error("FATAL", e); process.exit(1); }).finally(() => process.exit(0));
