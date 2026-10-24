// Real-browser evidence driver (zero deps; Node >=22 global fetch/WebSocket).
// Launches headless Chrome, drives the app through REAL input events, captures
// screenshots + state fingerprints at every step, writes evidence/*.png|json.
import { writeFileSync, mkdirSync, rmSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";

const ROOT = resolve(join(import.meta.dirname, ".."));
const APP_URL = "file:///" + ROOT.replace(/\\/g, "/") + "/index.html";
const OUT = join(ROOT, "evidence");
mkdirSync(OUT, { recursive: true });

const CHROME = process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = 9333;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function startChrome() {
  const udd = mkdtempSync(join(tmpdir(), "probe-"));
  const p = spawn(CHROME, [
    "--headless=new", "--remote-debugging-port=" + PORT,
    "--user-data-dir=" + udd, "--no-first-run", "--no-default-browser-check",
    "--disable-gpu", "--hide-scrollbars", "--remote-allow-origins=*",
    "--window-size=1680,1050", "about:blank",
  ], { stdio: "ignore" });
  for (let i = 0; i < 60; i++) {
    try {
      const v = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (v.ok) return { p, udd };
    } catch {}
    await sleep(250);
  }
  throw new Error("chrome devtools port never opened");
}

let wsId = 0;
const pending = new Map();
const consoleErrors = [];

function send(ws, method, params = {}) {
  return new Promise((res, rej) => {
    const id = ++wsId;
    pending.set(id, { res, rej });
    ws.send(JSON.stringify({ id, method, params }));
    setTimeout(() => {
      if (pending.has(id)) { pending.delete(id); rej(new Error("cdp timeout: " + method)); }
    }, 20000);
  });
}

async function evaluate(ws, expression) {
  const r = await send(ws, "Runtime.evaluate", { expression, returnByValue: true });
  if (r.exceptionDetails) throw new Error("eval failed: " + JSON.stringify(r.exceptionDetails).slice(0, 400));
  return r.result?.value;
}

async function shot(ws, name) {
  const r = await send(ws, "Page.captureScreenshot", { format: "png" });
  writeFileSync(join(OUT, name), Buffer.from(r.data, "base64"));
}

async function key(ws, keyName, code, wvkc, mods = 0) {
  await send(ws, "Input.dispatchKeyEvent", { type: "keyDown", key: keyName, code, windowsVirtualKeyCode: wvkc, modifiers: mods });
  await send(ws, "Input.dispatchKeyEvent", { type: "keyUp", key: keyName, code, windowsVirtualKeyCode: wvkc, modifiers: mods });
}

async function clickAt(ws, x, y) {
  await send(ws, "Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
  await send(ws, "Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", buttons: 1, clickCount: 1 });
  await send(ws, "Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", buttons: 0, clickCount: 1 });
}

const steps = [];
function record(name, fp, asserts, note = "") {
  steps.push({ name, fingerprint: fp ? JSON.parse(fp) : null, asserts, note });
  const bad = Object.entries(asserts).filter(([, v]) => v !== true);
  console.log((bad.length ? "FAIL " : "ok   ") + name + (bad.length ? "  -> " + JSON.stringify(bad) : ""));
  return bad.length === 0;
}

const run = async () => {
  const { p, udd } = await startChrome();
  const tabs = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
  const page = tabs.find((t) => t.type === "page");
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const { res, rej } = pending.get(m.id);
      pending.delete(m.id);
      m.error ? rej(new Error(m.error.message)) : res(m.result || {});
    } else if (m.method === "Runtime.exceptionThrown") {
      consoleErrors.push(JSON.stringify(m.params.exceptionDetails).slice(0, 300));
    }
  };
  await send(ws, "Page.enable");
  await send(ws, "Runtime.enable");
  await send(ws, "Page.navigate", { url: APP_URL });
  for (let i = 0; i < 50; i++) {
    const ready = await evaluate(ws, `!!(window.__APP__ && window.__APP__.ready && document.readyState === 'complete')`).catch(() => false);
    if (ready) break;
    await sleep(200);
  }

  // S1 — first paint, zero interactions
  let fp = await evaluate(ws, `window.__APP__.fingerprint()`);
  let f = JSON.parse(fp);
  record("S1 first-paint ready", fp, {
    "initial projection gdp×transit": f.x === "gdp" && f.y === "transit",
    "no filters": Object.keys(f.filters).length === 0,
    "all 240 visible": f.visible === 240,
    "history = init step only": f.len === 1 && f.cur === 0,
  }, "首屏即用：数据内联，无加载态");
  await shot(ws, "01-first-paint.png");

  // S2 — switch X dimension via the real <select> (projection change only)
  await evaluate(ws, `(() => { const s = document.getElementById('axis-x'); s.value = 'pop'; s.dispatchEvent(new Event('change', {bubbles:true})); })()`);
  await sleep(150);
  fp = await evaluate(ws, `window.__APP__.fingerprint()`); f = JSON.parse(fp);
  record("S2 switch X -> pop", fp, {
    "X now pop": f.x === "pop",
    "Y unchanged": f.y === "transit",
    "filters untouched": Object.keys(f.filters).length === 0,
    "attributed step appended": f.len === 2 && f.cur === 1,
  }, "维度切换不重置认知：只写 projection 子空间");
  await shot(ws, "02-axis-x-switched.png");

  // S3 — range filter via real slider events (input preview, then change commit)
  await evaluate(ws, `(() => {
    const g = document.querySelector('.filter-group[data-dim="air"]');
    const lo = g.querySelector('input[type=range]:nth-of-type(1)');
    const hi = g.querySelector('input[type=range]:nth-of-type(2)');
    lo.value = 40; lo.dispatchEvent(new Event('input', {bubbles:true}));
    hi.value = 70; hi.dispatchEvent(new Event('input', {bubbles:true}));
    hi.dispatchEvent(new Event('change', {bubbles:true}));
  })()`);
  await sleep(150);
  fp = await evaluate(ws, `window.__APP__.fingerprint()`); f = JSON.parse(fp);
  record("S3 filter air 40-70", fp, {
    "filter owned in state": JSON.stringify(f.filters.air) === "[40,70]",
    "visible subset shrank": f.visible < 240 && f.visible > 0,
    "attributed step appended": f.len === 3 && f.cur === 2,
  }, "过滤状态有归属");
  await shot(ws, "03-filter-air.png");

  // S4 — REAL mouse click on a record point (coordinates from the app's own scales)
  const pt = await evaluate(ws, `(() => {
    const id = window.__APP__.firstVisibleId();
    const p = window.__APP__.pointFor(id);
    const el = document.elementFromPoint(p[0], p[1]);
    return { id, p, hit: el ? (el.id || el.tagName) : 'none' };
  })()`);
  await clickAt(ws, Math.round(pt.p[0]), Math.round(pt.p[1]));
  await sleep(150);
  fp = await evaluate(ws, `window.__APP__.fingerprint()`); f = JSON.parse(fp);
  record("S4 mouse select point", fp, {
    "click lands on canvas": pt.hit === "plot",
    "selection = clicked record": f.selection === pt.id,
    "filter still active": JSON.stringify(f.filters.air) === "[40,70]",
    "attributed step appended": f.len === 4 && f.cur === 3,
  }, "指针选择（真实 CDP 鼠标事件）");
  await shot(ws, "04-mouse-selected.png");

  // S5 — THE cognition test: switch Y while filter+selection active
  const preFp = JSON.parse(await evaluate(ws, `window.__APP__.fingerprint()`));
  await evaluate(ws, `(() => { const s = document.getElementById('axis-y'); s.value = 'air'; s.dispatchEvent(new Event('change', {bubbles:true})); })()`);
  await sleep(150);
  fp = await evaluate(ws, `window.__APP__.fingerprint()`); f = JSON.parse(fp);
  record("S5 dimension switch preserves cognition", fp, {
    "Y now air": f.y === "air",
    "filter air survives": JSON.stringify(f.filters.air) === "[40,70]",
    "selection survives": f.selection === pt.id,
    "visible count unchanged": f.visible === preFp.visible,
    "attributed step appended": f.len === 5 && f.cur === 4,
  }, "核心判据：切维度后过滤/选择/计数全部保留");
  await shot(ws, "05-switch-y-with-context.png");

  // S6 — undo twice via real buttons (selection, then Y axis) — filter must survive both
  await evaluate(ws, `document.getElementById('btn-undo').click()`);
  await sleep(100);
  await evaluate(ws, `document.getElementById('btn-undo').click()`);
  await sleep(150);
  fp = await evaluate(ws, `window.__APP__.fingerprint()`); f = JSON.parse(fp);
  record("S6 undo x2", fp, {
    "cur back to filter step": f.cur === 2 && f.len === 5,
    "filter survives undo": JSON.stringify(f.filters.air) === "[40,70]",
    "selection undone": f.selection === null,
    "Y reverted": f.y === "transit",
  }, "撤销只回退后续子空间，过滤保留");
  await shot(ws, "06-undo-x2.png");

  // S7 — one-click revert: jump to init step via the trail
  await evaluate(ws, `document.querySelectorAll('#trail .trail-step')[0].click()`);
  await sleep(150);
  fp = await evaluate(ws, `window.__APP__.fingerprint()`); f = JSON.parse(fp);
  record("S7 jump to step 0 reverts everything", fp, {
    "back to initial": f.cur === 0 && f.len === 5,
    "filter cleared": Object.keys(f.filters).length === 0,
    "projection initial": f.x === "gdp" && f.y === "transit",
    "all visible again": f.visible === 240,
  }, "可回退：单击任意轨迹步恢复完整状态");
  await shot(ws, "07-jump-to-init.png");

  // S8 — empty state: filter to a value guaranteed absent from the data.
  // (lo/hi clamping keeps a 1-wide corridor, so require a gap of 2.)
  const emptyVal = await evaluate(ws, `(() => {
    const pops = new Set(window.DATASET.records.map(r => r.pop));
    for (let v = 18; v <= 1449; v++) if (!pops.has(v) && !pops.has(v + 1)) return v;
    return null;
  })()`);
  await evaluate(ws, `(() => {
    const g = document.querySelector('.filter-group[data-dim="pop"]');
    const lo = g.querySelector('input[type=range]:nth-of-type(1)');
    const hi = g.querySelector('input[type=range]:nth-of-type(2)');
    lo.value = ${emptyVal}; lo.dispatchEvent(new Event('input', {bubbles:true}));
    hi.value = ${emptyVal}; hi.dispatchEvent(new Event('input', {bubbles:true}));
    hi.dispatchEvent(new Event('change', {bubbles:true}));
  })()`);
  await sleep(150);
  const emptyShown = await evaluate(ws, `!document.getElementById('empty-overlay').hidden`);
  fp = await evaluate(ws, `window.__APP__.fingerprint()`); f = JSON.parse(fp);
  record("S8 empty state", fp, {
    "emptyVal found": emptyVal !== null,
    "visible == 0": f.visible === 0,
    "empty overlay shown": emptyShown === true,
  }, "空态：过滤器排除全部记录，引导保留可回退 emptyVal=" + emptyVal);
  await shot(ws, "08-empty-state.png");

  // S9 — clear all filters from the empty overlay
  await evaluate(ws, `document.getElementById('btn-clear-all').click()`);
  await sleep(150);
  fp = await evaluate(ws, `window.__APP__.fingerprint()`); f = JSON.parse(fp);
  const overlayHidden = await evaluate(ws, `document.getElementById('empty-overlay').hidden`);
  record("S9 clear all filters", fp, {
    "all visible": f.visible === 240,
    "no filters": Object.keys(f.filters).length === 0,
    "overlay hidden": overlayHidden === true,
  }, "一键恢复");
  await shot(ws, "09-cleared.png");

  // S10 — keyboard focus: from the canvas, real Tab must land on the next control
  // (first trail step); every interactive control must be natively focusable.
  const focusables = await evaluate(ws, `(() => {
    const els = [...document.querySelectorAll('button, select, input, [tabindex]')];
    const bad = els.filter(e => !e.disabled && (e.tabIndex < 0))
      .map(e => e.id || e.className || e.tagName);
    return { total: els.length, enabled: els.filter(e => !e.disabled).length, bad };
  })()`);
  await evaluate(ws, `document.getElementById('plot').focus()`);
  await key(ws, "Tab", "Tab", 9);
  await sleep(100);
  const focusInfo = await evaluate(ws, `(() => {
    const a = document.activeElement;
    return a ? { tag: a.tagName, id: a.id || null, cls: a.className || null } : null;
  })()`);
  console.log("  [S10] activeElement after Tab:", JSON.stringify(focusInfo));
  await shot(ws, "10-focus-visible.png");
  record("S10 keyboard focus", null, {
    "all enabled controls natively focusable": focusables.bad.length === 0,
    "Tab from canvas lands on next control": focusInfo && focusInfo.tag === "BUTTON" && String(focusInfo.cls || "").includes("trail-step"),
  }, `H-23: 键盘可达 + 可见焦点环（enabled=${focusables.enabled}, bad=${JSON.stringify(focusables.bad)}）`);

  // S11 — keyboard selection: focus canvas, real arrow keys + Enter
  const preLen = JSON.parse(await evaluate(ws, `window.__APP__.fingerprint()`)).len;
  await evaluate(ws, `document.getElementById('plot').focus()`);
  for (let i = 0; i < 3; i++) await key(ws, "ArrowRight", "ArrowRight", 39);
  await key(ws, "Enter", "Enter", 13);
  await sleep(150);
  fp = await evaluate(ws, `window.__APP__.fingerprint()`); f = JSON.parse(fp);
  record("S11 keyboard selection", fp, {
    "selection committed via keyboard": f.selection !== null,
    "attributed selection step appended": f.len === preLen + 1 && f.cur === f.len - 1,
    "no console errors so far": consoleErrors.length === 0,
  }, "键盘等价：方向键浏览 + 回车选中");
  await shot(ws, "11-keyboard-selected.png");

  const trail = await evaluate(ws, `window.__APP__.histLabels()`);
  const result = {
    url: APP_URL,
    userAgent: await evaluate(ws, `navigator.userAgent`),
    viewport: "1680x1050",
    consoleErrors,
    trail,
    steps,
    allPassed: steps.every((s) => Object.values(s.asserts).every(Boolean)) && consoleErrors.length === 0,
  };
  writeFileSync(join(OUT, "evidence.json"), JSON.stringify(result, null, 2));
  console.log("\nALL PASSED:", result.allPassed, "| console errors:", consoleErrors.length);
  try { ws.close(); } catch {}
  p.kill();
  await new Promise((r) => p.on("exit", r));
  try { rmSync(udd, { recursive: true, force: true }); } catch {}
  process.exit(result.allPassed ? 0 : 1);
};

run().catch((e) => { console.error("DRIVER ERROR:", e); process.exit(2); });
