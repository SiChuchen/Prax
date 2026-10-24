// EXO·LENS — 真实浏览器证据采集（无 Playwright/Puppeteer，仅系统 Edge + CDP）
// 套路与坑位来源：memory headless-evidence-capture-win（参考实现 s2-p1/evidence/shoot.mjs）
//   1) 本地 http 服务器（file:// + query 会被 Edge 劫持）
//   2) 端口避开保留段 8081–8380 → 用 8412 / 9223
//   3) 常驻单实例 + 独立 user-data-dir，避免多实例竞争
// 用法：node evidence/shoot.mjs   （产出 evidence/shots/*.png + evidence/shots/report.json）
import { spawn } from "node:child_process";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { readFile } from "node:fs/promises";
import http from "node:http";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(root, "evidence", "shots");
mkdirSync(OUT, { recursive: true });
const HTTP_PORT = 8412, CDP_PORT = 9223;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ---------- 静态服务器 ----------
const MIME = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8" };
const server = http.createServer(async (req, res) => {
  const p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  const file = p === "/" ? "index.html" : p.slice(1).split("?")[0];
  try {
    const buf = await readFile(join(root, file));
    res.writeHead(200, { "content-type": MIME[file.slice(file.lastIndexOf("."))] ?? "application/octet-stream" });
    res.end(buf);
  } catch { res.writeHead(404); res.end("not found"); }
});
await new Promise(r => server.listen(HTTP_PORT, "127.0.0.1", r));
console.log(`[srv] http://127.0.0.1:${HTTP_PORT}/`);

// ---------- 常驻无头 Edge ----------
const profile = join(root, "evidence", ".edge-profile");
rmSync(profile, { recursive: true, force: true });
const edge = spawn("C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe", [
  `--remote-debugging-port=${CDP_PORT}`,
  `--user-data-dir=${profile}`,
  "--headless=new", "--disable-gpu", "--hide-scrollbars",
  "--window-size=1680,950", "--no-first-run", "--no-default-browser-check",
  "about:blank",
], { stdio: "ignore" });

async function waitCdp() {
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`); if (r.ok) return r.json(); } catch { }
    await sleep(250);
  }
  throw new Error("CDP 等待超时");
}
const ver = await waitCdp();
console.log("[cdp] browser:", ver.Browser);

// ---------- CDP RPC ----------
const ws = new WebSocket(ver.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let rpcId = 0;
const pending = new Map();
const loadWaiters = [];
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    const { res, rej } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? rej(new Error(msg.error.message)) : res(msg.result);
  } else if (msg.method === "Page.loadEventFired") {
    loadWaiters.splice(0).forEach(f => f());
  }
};
function send(method, params = {}, sessionId) {
  return new Promise((res, rej) => {
    const id = ++rpcId;
    pending.set(id, { res, rej });
    ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
}
const waitLoad = () => new Promise(r => loadWaiters.push(r));

const { targetId } = await send("Target.createTarget", { url: "about:blank" });
const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
const S = (m, p) => send(m, p, sessionId);
await S("Page.enable");
await S("Runtime.enable");
const loadP = waitLoad();
await S("Page.navigate", { url: `http://127.0.0.1:${HTTP_PORT}/` });
await loadP; await sleep(600);

async function evaljs(expr) {
  const r = await S("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error("eval: " + JSON.stringify(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text));
  return r.result.value;
}
async function shot(name) {
  const r = await S("Page.captureScreenshot", { format: "png" });
  writeFileSync(join(OUT, name), Buffer.from(r.data, "base64"));
  console.log("[shot]", name);
}
// 可信键盘事件（OS 级语义：原生 button 的 Enter 激活、document 级 Ctrl+Z）
async function key(k) {
  const VK = { Enter: [13, "\r"], z: [90, "z"], Control: [17, null] };
  if (k === "ctrl-z") {
    await S("Input.dispatchKeyEvent", { type: "keyDown", modifiers: 2, key: "Control", code: "ControlLeft", windowsVirtualKeyCode: 17 }, sessionId);
    await S("Input.dispatchKeyEvent", { type: "keyDown", modifiers: 2, key: "z", code: "KeyZ", windowsVirtualKeyCode: 90, text: "\u001a" }, sessionId);
    await S("Input.dispatchKeyEvent", { type: "keyUp", modifiers: 2, key: "z", code: "KeyZ", windowsVirtualKeyCode: 90 }, sessionId);
    await S("Input.dispatchKeyEvent", { type: "keyUp", key: "Control", code: "ControlLeft", windowsVirtualKeyCode: 17 }, sessionId);
    return;
  }
  const [vk, text] = VK[k];
  await S("Input.dispatchKeyEvent", { type: "keyDown", key: k, code: k === "Enter" ? "Enter" : "Key" + k.toUpperCase(), windowsVirtualKeyCode: vk, ...(text ? { text } : {}) }, sessionId);
  await S("Input.dispatchKeyEvent", { type: "keyUp", key: k, code: k === "Enter" ? "Enter" : "Key" + k.toUpperCase(), windowsVirtualKeyCode: vk }, sessionId);
}
const click = (sel) => evaljs(`(() => {
  const el = document.querySelector("${sel}");
  if (!el) throw new Error("no match: ${sel}");
  el.scrollIntoView({ block: "center" });
  el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  return el.textContent.trim().slice(0, 40); })()`);
const railBtn = (label) => evaljs(`(() => {
  const b = [...document.querySelectorAll("#rail .dim")].find(x => x.textContent.includes("${label}"));
  if (!b) throw new Error("rail btn not found: ${label}");
  return true; })()`);

const snap = () => evaljs(`(() => { const s = App.state; const rec = s.selection ? window.DATA.records.find(r => r.id === s.selection) : null; return {
  x: s.x, y: s.y, color: s.color,
  filters: s.lens.map(f => f.owner + ":" + f.dim + ":" + (f.op === "in" ? "{" + f.values.join("|") + "}" : "[" + f.min + "," + f.max + ")")),
  selection: s.selection, selName: rec ? rec.name : null,
  visible: App.filteredCount(), undo: s.undoStack.length,
  chipCount: document.querySelectorAll('#lensbar .chips[aria-label="活跃过滤"] .chip:not(.chip-empty)').length,
  projChips: [...document.querySelectorAll(".chip-proj")].map(c => c.textContent.trim().replace(/×$/, "").trim()),
  inspName: document.querySelector(".insp-name")?.textContent ?? null,
  viewMode: document.querySelector("#view-mode")?.textContent ?? null,
  emptyOverlay: !!document.querySelector(".view-empty"),
}; })()`);

const report = { startedAt: new Date().toISOString(), steps: [] };
const step = async (name, fn) => {
  const before = await snap();
  const extra = (await fn?.()) ?? {};
  await sleep(150);
  const after = await snap();
  report.steps.push({ name, before, after, ...extra });
  console.log("[step]", name, JSON.stringify(after));
};

// ---------- 01 首屏即用（无加载态） ----------
await step("01 首屏 ready", async () => {
  const chk = await evaljs(`({
    spinner: !!document.querySelector(".spinner,[data-loading]"),
    resources: performance.getEntriesByType("resource").length,
    tableRows: document.querySelectorAll("#table-body tr").length,
    legend: document.querySelectorAll("#view-legend .lg").length,
    footState: document.querySelector("#foot-state")?.textContent ?? null,
    focusRing: (() => { const d = document.querySelector("#rail .dim"); d.focus(); const s = getComputedStyle(d); const on = document.activeElement === d; d.blur(); return { focused: on, outline: s.outlineStyle + " " + s.outlineWidth + " " + s.outlineColor }; })(),
  })`);
  await shot("01-initial-ready.png");
  return chk;
});

// ---------- 02 记录表点选 → 选中 ----------
await step("02 表格点选选中记录", async () => {
  const clicked = await click("#table-body tr[data-id] .rowbtn");
  const insp = await evaljs(`({ badge: document.querySelector(".insp-badge")?.textContent ?? null, name: document.querySelector(".insp-name")?.textContent ?? null })`);
  await shot("02-selected.png");
  return { clicked, insp };
});

// ---------- 03 图表刷选 → 归属过滤 chip ----------
await step("03 点击条形 → 图表来源过滤芯片", async () => {
  const chipBefore = (await snap()).chipCount;
  const clicked = await click('#view-body svg g .hit, #view-body svg .hit');
  await sleep(150);
  const chip = await evaljs(`(() => { const c = document.querySelector('#lensbar .chips[aria-label="活跃过滤"] .chip'); return c ? c.textContent.trim() : null; })()`);
  await shot("03-filter-chip.png");
  return { clicked, chipBefore, chipText: chip };
});

// ---------- 04 维度切换（核心验收：认知不重置） ----------
await step("04 换 X 维度 → 选中/过滤/计数保持", async () => {
  railBtn("行星半径");
  const clicked = await evaljs(`(() => {
    const b = [...document.querySelectorAll("#rail .dim")].find(x => x.textContent.includes("行星半径"));
    b.scrollIntoView({ block: "center" });
    b.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    return true; })()`);
  await sleep(200);
  const chk = await evaljs(`({ bins: document.querySelectorAll("#view-body svg .hit").length, selBand: !!document.querySelector("#view-body svg .sel-band"), mode: document.querySelector("#view-mode")?.textContent ?? null })`);
  await shot("04-dimswitch-context-kept.png");
  return { clicked, ...chk };
});

// ---------- 05 Ctrl+Z 撤销换维 ----------
await step("05 Ctrl+Z 撤销（回 X=发现方法）", async () => {
  await key("ctrl-z");
  await sleep(150);
  await shot("05-undo.png");
  return {};
});

// ---------- 06 单芯片移除 ----------
await step("06 移除过滤芯片（计数回升）", async () => {
  await click('#lensbar .chips[aria-label="活跃过滤"] .chip .chip-x');
  await sleep(150);
  await shot("06-chip-removed.png");
  return {};
});

// ---------- 07 空状态（过滤无匹配） ----------
await step("07 空状态 + 重置镜头恢复", async () => {
  await evaljs(`App.actions.addFilter({ dim: "mass", op: "range", min: 99999, max: 100000 }, "手动"); true`);
  await sleep(150);
  const empty = await evaljs(`({ overlay: !!document.querySelector(".view-empty"), text: document.querySelector(".view-empty p")?.textContent ?? null })`);
  await shot("07-empty-state.png");
  await evaljs(`App.actions.resetAll(); true`);
  await sleep(150);
  await shot("08-reset-all.png");
  return { empty };
});

// ---------- 08 键盘（可信事件）：焦点 + Enter 换维 + Ctrl+Z ----------
await step("08 键盘 Enter 换维（可见焦点）+ Ctrl+Z", async () => {
  await evaljs(`(() => { const b = [...document.querySelectorAll("#rail .dim")].find(x => x.textContent.includes("行星半径")); b.focus(); return document.activeElement === b; })()`);
  const focusChk = await evaljs(`(() => { const b = document.activeElement; const s = getComputedStyle(b); return { active: b.textContent.trim().slice(0, 20), outline: s.outlineWidth + " " + s.outlineStyle + " " + s.outlineColor }; })()`);
  await shot("09-focus-visible.png");
  await key("Enter");
  await sleep(200);
  const afterEnter = await snap();
  await key("ctrl-z");
  await sleep(150);
  await shot("10-keyboard-undone.png");
  return { focusChk, xAfterEnter: afterEnter.x };
});

report.finishedAt = new Date().toISOString();
writeFileSync(join(OUT, "report.json"), JSON.stringify(report, null, 2));
console.log("[done] report + shots →", OUT);

ws.close();
try { edge.kill(); } catch { }
await sleep(700);
server.close();
try { rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 400 }); } catch (e) { console.warn("[cleanup]", e.message); }
process.exit(0);
