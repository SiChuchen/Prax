#!/usr/bin/env node
/*
 * capture.mjs — 真实浏览器证据采集（零依赖，CDP over --remote-debugging-pipe）。
 *
 * 旅程：加载 index.html → 键盘旅程（Tab 选择 / 方向键移动 / Alt 对齐 / N 新建 /
 * 键盘落位 / Ctrl+D 复制 / 对齐 / 均分 / 层级 / ? 速查 / 删除+撤销）→ 每个里程碑
 * 截图 + window.__setplot 状态断言 → 另加载 dist/index.html 验证构建产物。
 *
 * 输出：evidence/*.png + evidence/journey.json（断言记录）。
 * 任一断言失败 → 退出码 1。
 */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const APP = "file:///E:/codex-prj/ab-worktrees/pi-matrix/cell-j07-s07-b/index.html";
const DIST = "file:///E:/codex-prj/ab-worktrees/pi-matrix/cell-j07-s07-b/dist/index.html";
const OUT = join(ROOT, "..", "evidence");

const CANDIDATE_BROWSERS = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
];

const browserPath = CANDIDATE_BROWSERS.find((p) => existsSync(p));
if (!browserPath) { console.error("NO_BROWSER: Edge/Chrome not found"); process.exit(2); }

mkdirSync(OUT, { recursive: true });
const profile = join(OUT, ".tmp-profile");
rmSync(profile, { recursive: true, force: true });

/* ---------- CDP over pipe ---------- */

const child = spawn(browserPath, [
  "--headless=new",
  "--remote-debugging-pipe",
  "--no-first-run",
  "--no-default-browser-check",
  "--disable-extensions",
  "--disable-background-networking",
  "--disable-gpu",
  "--hide-scrollbars",
  `--user-data-dir=${profile}`,
  "--window-size=1440,900",
  "about:blank",
], { stdio: ["ignore", "ignore", "inherit", "pipe", "pipe"] });

const cmdStream = child.stdio[3]; // parent -> chrome
const evtStream = child.stdio[4]; // chrome -> parent

let nextId = 1;
const pending = new Map();
const listeners = [];
let buf = "";

evtStream.on("data", (chunk) => {
  buf += chunk.toString("utf8");
  for (;;) {
    const m = /Content-Length:\s*(\d+)\r\n\r\n/.exec(buf);
    if (!m) break;
    const len = parseInt(m[1], 10);
    const bodyStart = m.index + m[0].length;
    if (buf.length < bodyStart + len) break;
    let msg;
    try { msg = JSON.parse(buf.slice(bodyStart, bodyStart + len)); } catch { msg = null; }
    buf = buf.slice(bodyStart + len);
    if (!msg) continue;
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
    } else if (msg.method) {
      for (const fn of listeners) fn(msg);
    }
  }
});

function send(method, params = {}, sessionId) {
  const id = nextId++;
  const msg = { id, method, params };
  if (sessionId) msg.sessionId = sessionId;
  const payload = Buffer.from(JSON.stringify(msg), "utf8");
  cmdStream.write(Buffer.from(`Content-Length: ${payload.length}\r\n\r\n`, "utf8"));
  cmdStream.write(payload);
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    setTimeout(() => { if (pending.has(id)) { pending.delete(id); reject(new Error(`timeout: ${method}`)); } }, 20000);
  });
}

function waitEvent(method, timeoutMs = 20000) {
  return new Promise((resolve, reject) => {
    const fn = (msg) => { if (msg.method === method) { cleanup(); resolve(msg.params); } };
    const timer = setTimeout(() => { cleanup(); reject(new Error(`timeout waiting ${method}`)); }, timeoutMs);
    const cleanup = () => { clearTimeout(timer); listeners.splice(listeners.indexOf(fn), 1); };
    listeners.push(fn);
  });
}

/* ---------- CDP helpers ---------- */

let sessionId;

async function evaluate(expression) {
  const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }, sessionId);
  if (r.exceptionDetails) throw new Error("eval exception: " + JSON.stringify(r.exceptionDetails.exception?.description || r.exceptionDetails));
  return r.result.value;
}

const KEYDEFS = {
  Tab:         { key: "Tab", code: "Tab", vk: 9 },
  Enter:       { key: "Enter", code: "Enter", vk: 13 },
  Escape:      { key: "Escape", code: "Escape", vk: 27 },
  Backspace:   { key: "Backspace", code: "Backspace", vk: 8 },
  Delete:      { key: "Delete", code: "Delete", vk: 46 },
  ArrowLeft:   { key: "ArrowLeft", code: "ArrowLeft", vk: 37 },
  ArrowUp:     { key: "ArrowUp", code: "ArrowUp", vk: 38 },
  ArrowRight:  { key: "ArrowRight", code: "ArrowRight", vk: 39 },
  ArrowDown:   { key: "ArrowDown", code: "ArrowDown", vk: 40 },
  d:           { key: "d", code: "KeyD", vk: 68, text: "d" },
  D:           { key: "D", code: "KeyD", vk: 68, text: "D" },
  g:           { key: "g", code: "KeyG", vk: 71, text: "g" },
  n:           { key: "n", code: "KeyN", vk: 78, text: "n" },
  "[":         { key: "[", code: "BracketLeft", vk: 219, text: "[" },
  "]":         { key: "]", code: "BracketRight", vk: 221, text: "]" },
  "?":         { key: "?", code: "Slash", vk: 191, text: "?", modifiers: 8 },
};

async function press(name, opts = {}) {
  const def = KEYDEFS[name] || (name.length === 1 ? { key: name, code: "Key" + name.toUpperCase(), vk: name.toUpperCase().charCodeAt(0), text: name } : null);
  if (!def) throw new Error("unknown key " + name);
  const modifiers = (def.modifiers || 0) | (opts.ctrl ? 2 : 0) | (opts.shift ? 8 : 0) | (opts.alt ? 1 : 0);
  const base = { key: def.key, code: def.code, windowsVirtualKeyCode: def.vk, nativeVirtualKeyCode: def.vk, modifiers };
  await send("Input.dispatchKeyEvent", { type: "keyDown", ...base, text: opts.ctrl ? "" : (def.text ?? "") }, sessionId);
  await send("Input.dispatchKeyEvent", { type: "keyUp", ...base }, sessionId);
}

async function screenshot(name) {
  const r = await send("Page.captureScreenshot", { format: "png" }, sessionId);
  writeFileSync(join(OUT, name), Buffer.from(r.data, "base64"));
}

/* ---------- 旅程与断言 ---------- */

const journey = [];
function record(step, ok, detail) {
  journey.push({ step, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${step}  ${detail ?? ""}`);
}
function assert(step, cond, detail) { record(step, Boolean(cond), detail); return Boolean(cond); }

async function loadPage(url) {
  const loaded = waitEvent("Page.loadEventFired", 20000).catch(() => null);
  await send("Page.navigate", { url }, sessionId);
  await loaded;
  await new Promise((r) => setTimeout(r, 300));
  const state = await evaluate("document.readyState");
  if (state !== "complete") throw new Error("readyState=" + state);
}

async function main() {
  const targets = await send("Target.getTargets");
  const page = targets.targetInfos.find((t) => t.type === "page");
  const { sessionId: sid } = await send("Target.attachToTarget", { targetId: page.targetId, flatten: true });
  sessionId = sid;
  await send("Page.enable", {}, sessionId);
  await send("Runtime.enable", {}, sessionId);

  /* —— 主页：首屏即就绪 —— */
  await loadPage(APP);
  const boot = await evaluate(`(() => ({
    items: window.__setplot.items.length,
    loadingUI: Boolean(document.querySelector('.loading')),
    readyState: document.readyState,
    chips: document.querySelectorAll('.purpose-chip').length,
    zones: document.querySelectorAll('.zone').length,
  }))()`);
  assert("first-screen-ready", boot.items === 13 && !boot.loadingUI && boot.zones === 4 && boot.chips >= 13,
    `items=${boot.items} zones=${boot.zones} chips=${boot.chips} loadingUI=${boot.loadingUI}`);
  await screenshot("01-initial-board.png");

  /* —— 键盘选择 —— */
  await press("Tab");
  const sel = await evaluate("window.__setplot.selection");
  assert("keyboard-select", sel.length === 1, `selection=${JSON.stringify(sel)}`);
  await screenshot("02-keyboard-selected.png");

  /* —— 方向键微移 —— */
  const before = await evaluate(`window.__setplot.items.find(i => i.id === window.__setplot.selection[0]).x`);
  await press("ArrowRight"); await press("ArrowRight");
  const after = await evaluate(`window.__setplot.items.find(i => i.id === window.__setplot.selection[0]).x`);
  assert("keyboard-nudge", after - before === 16, `x ${before} -> ${after} (+16)`);

  /* —— Shift 大步 + Alt 智能对齐 —— */
  await press("ArrowRight", { shift: true });
  const afterBig = await evaluate(`window.__setplot.items.find(i => i.id === window.__setplot.selection[0]).x`);
  assert("keyboard-bigstep", afterBig - after === 32, `x ${after} -> ${afterBig} (+32)`);
  await press("ArrowLeft", { alt: true });
  const afterAlt = await evaluate(`window.__setplot.items.find(i => i.id === window.__setplot.selection[0]).x`);
  assert("keyboard-alt-align", afterAlt === afterBig - 8, `x ${afterBig} -> ${afterAlt} (Alt 步进+吸附)`);

  /* —— N 新建（落点在体验区内） —— */
  await press("n");
  let st = await evaluate(`(() => {
    const sel = window.__setplot.selection[0];
    const it = window.__setplot.items.find(i => i.id === sel);
    return { count: window.__setplot.items.length, name: it && it.name, zone: it && it.zone };
  })()`);
  assert("keyboard-create", st.count === 14 && st.name.startsWith("新物件") && st.zone === "zone-hands",
    `count=${st.count} name=${st.name} zone=${st.zone}`);

  /* —— 键盘落位变更意图：先移出分区（未安置），再落位暂存区 —— */
  for (let i = 0; i < 15; i++) await press("ArrowLeft", { shift: true });
  st = await evaluate(`window.__setplot.items.find(i => i.id === window.__setplot.selection[0]).zone`);
  assert("keyboard-move-out-unplaced", st === null, `zone=${st}（未安置）`);
  for (let i = 0; i < 30; i++) await press("ArrowRight", { shift: true });
  st = await evaluate(`(() => {
    const it = window.__setplot.items.find(i => i.id === window.__setplot.selection[0]);
    return { zone: it.zone, x: it.x, y: it.y };
  })()`);
  assert("keyboard-place-infers-intent", st.zone === "zone-staging", `zone=${st.zone} at (${st.x},${st.y})`);
  await screenshot("03-keyboard-placed-intent.png");

  /* —— Ctrl+D 复制 —— */
  await press("d", { ctrl: true });
  st = await evaluate("window.__setplot.items.length");
  assert("keyboard-duplicate", st === 15, `count=${st}`);

  /* —— 1-6 对齐（多选组内） —— */
  await press("a", { ctrl: true });
  await press("2");
  const xs = await evaluate(`(() => {
    const sel = new Set(window.__setplot.selection);
    const it = window.__setplot.items.filter(i => sel.has(i.id));
    const minX = Math.min(...it.map(i => i.x)), maxX = Math.max(...it.map(i => i.x + i.w));
    return { centered: it.filter(i => Math.abs((i.x + i.w/2) - (minX + maxX)/2) < 1).length, total: it.length };
  })()`);
  assert("keyboard-align", xs.centered >= 1, `h-centered=${xs.centered}/${xs.total}`);

  /* —— d 均分（水平） —— */
  await press("d");
  const spread = await evaluate(`(() => {
    const sel = new Set(window.__setplot.selection);
    const xs = window.__setplot.items.filter(i => sel.has(i.id)).map(i => i.x);
    return { distinct: new Set(xs).size, total: xs.length };
  })()`);
  assert("keyboard-distribute", spread.distinct >= 3, `distinct x=${spread.distinct}/${spread.total}`);
  await screenshot("04-after-align-distribute.png");

  /* —— [ ] 层级 —— */
  const orderBefore = await evaluate("window.__setplot.items.map(i => i.id).join(',')");
  await press("Tab"); // 确保有单选
  await press("]");
  const orderAfter = await evaluate("window.__setplot.items.map(i => i.id).join(',')");
  assert("keyboard-zorder", orderBefore !== orderAfter, "z-order changed");

  /* —— ? 键位速查 —— */
  await press("?");
  const helpShown = await evaluate("!document.getElementById('help-overlay').hidden");
  assert("keyboard-help-overlay", helpShown, "overlay visible");
  await screenshot("05-keyboard-help-overlay.png");
  await press("Escape");
  const helpHidden = await evaluate("document.getElementById('help-overlay').hidden");
  assert("help-overlay-closes", helpHidden, "overlay hidden");

  /* —— 删除 + 撤销（可逆） —— */
  await evaluate("document.body.focus()");
  await press("Tab");
  const cntBeforeDel = await evaluate("window.__setplot.items.length");
  await press("Delete");
  const cntAfterDel = await evaluate("window.__setplot.items.length");
  await press("z", { ctrl: true });
  const cntRestored = await evaluate("window.__setplot.items.length");
  assert("delete-undo-recovery", cntAfterDel === cntBeforeDel - 1 && cntRestored === cntBeforeDel,
    `del ${cntBeforeDel}->${cntAfterDel}, undo->${cntRestored}`);

  /* —— dist 构建产物 —— */
  if (existsSync(join(ROOT, "..", "dist", "index.html"))) {
    await loadPage(DIST);
    const distState = await evaluate(`({ items: window.__setplot.items.length, chips: document.querySelectorAll('.purpose-chip').length })`);
    assert("dist-build-opens", distState.items === 13 && distState.chips >= 13, `items=${distState.items} chips=${distState.chips}`);
    await screenshot("06-dist-build.png");
  } else {
    record("dist-build-opens", false, "dist/index.html missing");
  }

  const failed = journey.filter((j) => !j.ok);
  writeFileSync(join(OUT, "journey.json"), JSON.stringify({ startedAt: new Date().toISOString(), browser: browserPath, journey }, null, 2));
  console.log(`\n${journey.length - failed.length}/${journey.length} checks passed`);
  child.kill();
  process.exit(failed.length ? 1 : 0);
}

main().catch((err) => {
  console.error("CAPTURE_ERROR:", err.message);
  writeFileSync(join(OUT, "journey.json"), JSON.stringify({ error: err.message, journey }, null, 2));
  child.kill();
  process.exit(1);
});
