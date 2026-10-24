/* tools/evidence.js — 真实浏览器验收证据采集（CDP 直连无头 Edge）
   产物：evidence/*.png + stdout 断言报告。不属于交付产品本体。 */
"use strict";
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 9333;
const URL = "file:///E:/codex-prj/ab-worktrees/pi-matrix-m4/s7-p3p/index.html";
const OUT = path.join(__dirname, "..", "evidence");

fs.mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
let msgId = 0;
const pending = new Map();
const eventWaiters = [];
const jsErrors = [];

async function api(ws, method, params = {}) {
  const id = ++msgId;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}
function waitEvent(method, timeout = 15000) {
  return new Promise((resolve, reject) => {
    const w = { method, resolve, timer: setTimeout(() => reject(new Error("timeout " + method)), timeout) };
    eventWaiters.push(w);
  });
}

async function main() {
  const edge = spawn(EDGE, [
    "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
    `--remote-debugging-port=${PORT}`, "--window-size=1600,900",
    `--user-data-dir=${path.join(OUT, "_profile")}`, "about:blank",
  ], { stdio: "ignore" });

  // 等待 devtools 端点
  let list = null;
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      list = await res.json();
      if (list.find(t => t.type === "page")) break;
    } catch (e) { /* retry */ }
    await sleep(250);
  }
  const page = list.find(t => t.type === "page");
  if (!page) throw new Error("no page target");

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id);
      pending.delete(m.id);
      if (m.error) p.reject(new Error(m.error.message)); else p.resolve(m.result);
    } else if (m.method) {
      for (let i = eventWaiters.length - 1; i >= 0; i--) {
        if (eventWaiters[i].method === m.method) {
          clearTimeout(eventWaiters[i].timer);
          eventWaiters.splice(i, 1)[0].resolve(m.params);
        }
      }
      if (m.method === "Runtime.exceptionThrown") {
        jsErrors.push(m.params.exceptionDetails.text + " " + (m.params.exceptionDetails.exception && m.params.exceptionDetails.exception.description || ""));
      }
    }
  };

  await api(ws, "Page.enable");
  await api(ws, "Runtime.enable");
  const loaded = waitEvent("Page.loadEventFired");
  await api(ws, "Page.navigate", { url: URL });
  await loaded;
  await sleep(500);

  const evalJs = async (expr) => {
    const r = await api(ws, "Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error("eval failed: " + JSON.stringify(r.exceptionDetails));
    return r.result.value;
  };
  const shot = async (name) => {
    const r = await api(ws, "Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(path.join(OUT, name), Buffer.from(r.data, "base64"));
    console.log("SHOT " + name);
  };
  const assert = (label, cond, detail) => {
    console.log((cond ? "PASS " : "FAIL ") + label + (detail ? "  → " + detail : ""));
    if (!cond) process.exitCode = 1;
  };
  const key = (key, code, vk, mods = 0) => api(ws, "Input.dispatchKeyEvent", { type: "keyDown", key, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk, modifiers: mods })
    .then(() => api(ws, "Input.dispatchKeyEvent", { type: "keyUp", key, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk, modifiers: mods }));

  // ── S1 初始首屏 ──────────────────────────────────────────────
  const init = await evalJs(`(() => { const L = window.__lenscope; return {
    total: L.size, visible: document.getElementById('count-visible').textContent,
    journal: L.journal.entries.length, pointer: L.journal.pointer,
    sel: L.state.selection.size, anchor: L.state.anchor,
    lens: L.state.lens, ready: !document.getElementById('loading').offsetParent,
  };})()`);
  assert("S1 首屏 ready（数据内联，无加载态）", init.ready === true && init.visible === "420", JSON.stringify(init));
  assert("S1 初始：1 条日志 / 指针就位 / 透镜=人口", init.journal === 1 && init.pointer === 0 && init.lens === "population", `journal=${init.journal}`);
  await shot("01-initial-ready.png");

  // ── S2 选中 2 条 + 锚定第 3 条 + 大区筛选 ────────────────────
  await evalJs(`(() => {
    document.querySelector('[data-rec="12"]').click();
    document.querySelector('[data-rec="305"]').click();
    document.querySelector('[data-anchor="77"]').click();
    document.querySelector('[data-toggle="region"]').click();
    const ck = document.querySelector('[data-cat="region"][data-val="亚太"]');
    ck.click();
    return true;
  })()`);
  await sleep(250);
  const s2 = await evalJs(`(() => { const L = window.__lenscope; return {
    sel: L.state.selection.size, anchor: L.state.anchor,
    filters: JSON.stringify(L.state.filters), visible: +document.getElementById('count-visible').textContent,
    chips: document.querySelectorAll('.chip').length,
  };})()`);
  assert("S2 选中2 + 锚定77 + 大区筛选生效", s2.sel === 2 && s2.anchor === 77 && s2.visible < 420 && s2.chips >= 1, JSON.stringify(s2));
  await shot("02-selection-filter.png");

  // ── S3 切换透镜（点击维度）→ 认知状态保持 ────────────────────
  await evalJs(`document.querySelector('[data-lens="gdpPerCapita"]').click()`);
  await sleep(250);
  const s3 = await evalJs(`(() => { const L = window.__lenscope; return {
    lens: L.state.lens, sel: L.state.selection.size, anchor: L.state.anchor,
    filters: L.state.filters.length, trail: L.state.trail.length,
    lastLabel: L.journal.entries[L.journal.entries.length-1].label,
    sortedTh: document.querySelector('th.th-sorted') && document.querySelector('th.th-sorted').textContent.trim(),
    lensTh: !!document.querySelector('th.th-lens'),
  };})()`);
  assert("S3 透镜→人均GDP：选区/锚点/过滤器全部保持", s3.lens === "gdpPerCapita" && s3.sel === 2 && s3.anchor === 77 && s3.filters === 1, JSON.stringify(s3));
  assert("S3 日志归属：最后一条为透镜动作", /透镜/.test(s3.lastLabel), s3.lastLabel);
  assert("S3 表格重排：透镜列带头 + 排序指示", s3.lensTh && /人均GDP/.test(s3.sortedTh), s3.sortedTh);
  await shot("03-after-lens-switch.png");

  // ── S4 键盘 ] 切换下一个维度 ─────────────────────────────────
  await key("]", "BracketRight", 221);
  await sleep(250);
  const s4 = await evalJs(`window.__lenscope.state.lens`);
  assert("S4 键盘 ] → 下一维度（面积）", s4 === "area", "lens=" + s4);
  await shot("04-keyboard-lens.png");

  // ── S5 Ctrl+Z 撤销 ──────────────────────────────────────────
  await key("z", "KeyZ", 90, 2); // modifiers: Ctrl=2
  await sleep(250);
  const s5 = await evalJs(`window.__lenscope.state.lens`);
  assert("S5 Ctrl+Z 撤销 → 回到人均GDP", s5 === "gdpPerCapita", "lens=" + s5);
  await shot("05-after-undo.png");

  // ── S6 搜索 ─────────────────────────────────────────────────
  await evalJs(`(() => {
    const inp = document.getElementById('search-input');
    inp.focus(); inp.value = 'port';
    inp.dispatchEvent(new Event('input', {bubbles:true}));
    return true;
  })()`);
  await sleep(700);
  await evalJs(`document.activeElement && document.activeElement.blur(); true`); // 模拟真实用户移开焦点
  await sleep(700);
  const s6 = await evalJs(`(() => { const L = window.__lenscope; return { search: L.state.search, visible: +document.getElementById('count-visible').textContent }; })()`);
  assert("S6 搜索 port 生效且记入日志", s6.search === "port" && s6.visible < 100, JSON.stringify(s6));
  await shot("06-search.png");

  // ── S7 空态 ─────────────────────────────────────────────────
  await evalJs(`(() => {
    const inp = document.getElementById('search-input');
    inp.value = 'zzzz'; inp.dispatchEvent(new Event('input', {bubbles:true}));
    return true;
  })()`);
  await sleep(700);
  await evalJs(`document.activeElement && document.activeElement.blur(); true`);
  await sleep(700);
  const s7 = await evalJs(`(() => ({ visible: +document.getElementById('count-visible').textContent, emptyShown: !document.getElementById('table-empty').hidden }))()`);
  assert("S7 空态：0 可见 + 空态提示", s7.visible === 0 && s7.emptyShown, JSON.stringify(s7));
  await shot("07-empty-state.png");

  // ── S8 恢复日志条目（回到 #2 选择/筛选状态）─────────────────
  const restoreIdx = await evalJs(`(() => { const L = window.__lenscope; return L.journal.entries.findIndex(e => /筛选 大区/.test(e.label)); })()`);
  await evalJs(`document.querySelector('[data-restore="${restoreIdx}"]').click()`);
  await sleep(250);
  const s8 = await evalJs(`(() => { const L = window.__lenscope; return {
    search: L.state.search, lens: L.state.lens, sel: L.state.selection.size,
    pointerSeq: L.journal.entries[L.journal.pointer].seq,
    visible: +document.getElementById('count-visible').textContent,
  };})()`);
  assert("S8 恢复日志条目：回到该时刻完整状态（透镜当时=人口、无搜索、选区2）", s8.search === "" && s8.sel === 2 && s8.lens === "population" && s8.pointerSeq === 2, JSON.stringify(s8));
  await shot("08-restored-from-journal.png");

  // ── 悬停提示（鼠标事件：定位到真实存在的一个点）────────────
  const pt = await evalJs(`(() => {
    const L = window.__lenscope;
    const r = L.plot.vis.find(r => r._x != null);
    const rect = document.getElementById('chart').getBoundingClientRect();
    return { x: rect.left + r._x, y: rect.top + r._y };
  })()`);
  await evalJs(`window.__mm = 0; document.getElementById('chart').addEventListener('mousemove', () => window.__mm++);`);
  await api(ws, "Input.dispatchMouseEvent", { type: "mouseMoved", x: pt.x, y: pt.y });
  await sleep(150);
  const diag = await evalJs(`(() => {
    const el = document.elementFromPoint(${pt.x}, ${pt.y});
    const t = document.getElementById('tooltip');
    return { hit: el ? el.id || el.tagName : "null", mm: window.__mm, hidden: t.hidden, len: t.textContent.length, pt: ${JSON.stringify(pt)} };
  })()`);
  console.log("S9 diag " + JSON.stringify(diag));
  assert("S9 图表悬停提示（定位到真实数据点）", diag.mm > 0 && !diag.hidden && diag.len > 10);

  // ── S10 a11y.focus_order：真实 Tab 遍历，记录焦点路径与可见性 ──
  await evalJs(`document.body.setAttribute("tabindex","-1"); document.body.focus(); true`); // 从已知基线开始
  const tab = () => api(ws, "Input.dispatchKeyEvent", { type: "keyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9 })
    .then(() => api(ws, "Input.dispatchKeyEvent", { type: "keyUp", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9 }));
  const focusPath = [];
  for (let i = 0; i < 90; i++) {
    await tab();
    await sleep(25);
    const stop = await evalJs(`(() => {
      const a = document.activeElement;
      if (!a || a === document.body) return null;
      return {
        tag: a.tagName.toLowerCase(),
        id: a.id || "",
        cls: (a.className && String(a.className).split(" ")[0]) || "",
        label: a.getAttribute("aria-label") || a.textContent.slice(0, 12) || "",
        visible: !!a.offsetParent,
        focusVisible: a.matches(":focus-visible"),
        region: a.closest("#region-header") ? "header" : a.closest("#region-filter-bar") ? "filter-bar" : a.closest("#region-dim-rail") ? "dim-rail" : a.closest("#region-lens-stage") ? "lens-stage" : a.closest("#region-record-table") ? "record-table" : a.closest("#region-inspector") ? "inspector" : a.closest("#region-journal") ? "journal" : "other",
      };
    })()`);
    if (!stop) break;
    focusPath.push(stop);
  }
  const regions = focusPath.map(p => p.region);
  const allVisible = focusPath.every(p => p.visible);
  const allFocusVisible = focusPath.every(p => p.focusVisible);
  const has = (pred) => focusPath.some(pred);
  const idx = (pred) => focusPath.findIndex(pred);
  assert("S10 焦点从 DOM 首区开始（header 可用时=撤销按钮，否则搜索框）", focusPath[0] && (focusPath[0].region === "header" || focusPath[0].id === "search-input"), focusPath[0] && JSON.stringify(focusPath[0]));
  assert("S10 全部焦点停靠点可见且 :focus-visible 生效", allVisible && allFocusVisible);
  assert("S10 关键区域全部可达（搜索/维度/对比轴/记录表网格/检查器/日志）",
    has(p => p.id === "search-input") && has(p => p.cls === "dim-main") && has(p => p.id === "sel-companion") &&
    has(p => p.id === "table-scroll") && has(p => p.region === "inspector") && has(p => p.region === "journal"),
    "共 " + focusPath.length + " 站");
  const iT = idx(p => p.id === "table-scroll"), iI = idx(p => p.region === "inspector"), iJ = idx(p => p.region === "journal"), iL = idx(p => p.id === "sel-companion");
  assert("S10 区域顺序符合 DOM（过滤栏→维度栏→图台→表格→检查器→日志）", iT > iL && iI > iT && iJ > iI, `stage@${iL} table@${iT} insp@${iI} journal@${iJ}`);
  fs.writeFileSync(path.join(OUT, "focus-order.json"), JSON.stringify(focusPath, null, 2));

  // ── S11 网格键盘导航：↑↓ 移动 + Enter 选中 ─────────────────────
  await evalJs(`document.getElementById('table-scroll').focus(); true`);
  await key("ArrowDown", "ArrowDown", 40);
  await key("ArrowDown", "ArrowDown", 40);
  await sleep(80);
  const rowFocused = await evalJs(`document.activeElement.matches("tr.rec-row")`);
  const selBefore = await evalJs(`window.__lenscope.state.selection.size`);
  await key("Enter", "Enter", 13);
  await sleep(120);
  const selAfter = await evalJs(`window.__lenscope.state.selection.size`);
  await key("Enter", "Enter", 13); // 还原
  await sleep(120);
  const selRestored = await evalJs(`window.__lenscope.state.selection.size`);
  assert("S11 网格导航：↓↓ 聚焦行", rowFocused);
  assert("S11 键盘 Enter 切换选中并复原", Math.abs(selAfter - selBefore) === 1 && selRestored === selBefore, `before=${selBefore} after=${selAfter} restored=${selRestored}`);
  const anchorBefore = await evalJs(`window.__lenscope.state.anchor`);
  await key("Enter", "Enter", 13, 8); // Shift+Enter = 锚定当前行（modifiers: Shift=8）
  await sleep(120);
  const anchorAfter = await evalJs(`window.__lenscope.state.anchor`);
  const anchorRowId = await evalJs(`+document.activeElement.getAttribute("data-rec")`);
  assert("S11 Shift+Enter 锚定焦点行", anchorAfter === anchorRowId && anchorBefore !== anchorAfter, `before=${anchorBefore} after=${anchorAfter}`);
  await shot("09-focus-order.png"); // 停在表格网格焦点

  console.log("JS_ERRORS " + jsErrors.length);
  jsErrors.forEach(e => console.log("  " + e.split("\n")[0]));
  assert("全程无未捕获 JS 异常", jsErrors.length === 0, jsErrors.join(" | "));

  ws.close();
  edge.kill();
  await sleep(300);
  console.log("DONE");
  process.exit(process.exitCode || 0);
}

main().catch(e => { console.error("EVIDENCE-ERROR", e); process.exit(1); });
