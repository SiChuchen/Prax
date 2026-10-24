// 真实浏览器证据采集：常驻无头 Edge + CDP（Node 24 内置 WebSocket）。
// 套路要点（见 memory headless-evidence-capture-win）：
//   1) 本地 http 服务器（file:// + query 会被动 Edge 劫持）
//   2) 端口避开保留段 8081–8380 → 用 8412 / 9223
//   3) 常驻单实例 + 独立 user-data-dir，避免多实例竞争
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
  "--window-size=1600,900", "--no-first-run", "--no-default-browser-check",
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
const snap = () => evaljs(`(() => { const s = EXPLORE.state; return {
  status: EXPLORE.status, visible: EXPLORE.visibleCount(),
  sel: s.selection.length, focus: s.focusId,
  filters: s.filters.map(f => f.origin + ":" + f.dim + ":" + (f.kind === "range" ? f.min.toFixed(1) + "-" + f.max.toFixed(1) : f.set.join("|"))),
  proj: { x: s.proj.x, y: s.proj.y, color: s.proj.color, portrait: s.proj.portrait, sort: s.proj.sort, dir: s.proj.sortDir },
  k: +s.view.k.toFixed(2), hist: EXPLORE.history,
  chips: document.querySelectorAll("#chips .chip").length,
}; })()`);
const rect = (sel) => evaljs(`(() => { const r = document.querySelector("${sel}").getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; })()`);
async function pointerEvents(sel, pts, opts = {}) {
  await evaljs(`(() => {
    const el = document.querySelector("${sel}");
    const r = el.getBoundingClientRect();
    const P = ${JSON.stringify(pts)}, type = "${opts.type || "scatter"}";
    const fire = (t, x, y) => el.dispatchEvent(new PointerEvent(t, { bubbles: true, cancelable: true, clientX: r.x + x, clientY: r.y + y, pointerId: 7, pointerType: "mouse", button: 0, buttons: t === "pointerup" ? 0 : 1, shiftKey: ${!!opts.shift} }));
    fire("pointerdown", P[0][0], P[0][1]);
    for (let i = 1; i < P.length - 1; i++) fire("pointermove", P[i][0], P[i][1]);
    fire("pointerup", P[P.length - 1][0], P[P.length - 1][1]);
    return true;
  })()`);
}
const report = { startedAt: new Date().toISOString(), steps: [] };
const step = async (name, fn) => {
  const before = await snap();
  const extra = (await fn?.()) ?? {};
  const after = await snap();
  report.steps.push({ name, before, after, ...extra });
  console.log("[step]", name, JSON.stringify(after));
};

// ---------- 01 首屏即用 ----------
await step("01 首屏 ready（无加载态）", async () => {
  const chk = await evaljs(`({
    dataStatus: document.querySelector("#app").dataset.status,
    spinner: !!document.querySelector(".spinner,[data-loading]"),
    resources: performance.getEntriesByType("resource").length,
    railRows: document.querySelectorAll("#dimlist .dim").length,
    points: document.querySelectorAll("#table-body tr").length,
    focusRingVisible: (() => { const d = document.querySelector("#dimlist .dim"); d.focus(); const s = getComputedStyle(d); return s.outlineStyle !== "none" || s.boxShadow !== "none"; })(),
  })`);
  await shot("01-initial-ready.png");
  return chk;
});

// ---------- 02 表格点选 → 选中集 ----------
await step("02 表格点选 3 行进入选中集（Ctrl 追加）", async () => {
  await evaljs(`(async () => {
    for (const i of [0, 1, 2]) {
      document.querySelectorAll("#table-body tr[data-id]")[i]
        .dispatchEvent(new MouseEvent("click", { bubbles: true, ctrlKey: i > 0 }));
      await new Promise(r => setTimeout(r, 60));
    }
    return true; })()`);
  await sleep(150);
  const chk = await evaljs(`({ selChips: document.querySelectorAll("#chips .chip.sel").length, detailName: document.querySelector("#detail .d-name")?.textContent ?? null })`);
  await shot("02-selected-from-table.png");
  return chk;
});

// ---------- 03 散点框选（追加，紧凑框） ----------
await step("03 散点框选追加选中", async () => {
  const pts = await evaljs("EXPLORE.ptsScreen().filter(t => !t.off).slice(0, 60).map(t => [t.x, t.y])");
  const [ax, ay] = pts[0];
  await pointerEvents("#scatter", [[ax - 26, ay - 26], [ax, ay], [ax + 26, ay + 26]], { shift: true });
  await sleep(150);
  await shot("03-boxselect.png");
  return { anchorPt: [ax, ay], nearby: pts.length };
});

// ---------- 04 画像拖刷 → 归属过滤 chip ----------
await step("04 画像拖刷生成过滤 chip", async () => {
  const r = await rect("#portrait");
  const fire = (t, x, y) => evaljs(`(() => {
    const cv = document.querySelector("#portrait"); const rc = cv.getBoundingClientRect();
    cv.dispatchEvent(new PointerEvent("${t}", { bubbles: true, cancelable: true, clientX: rc.x + ${x}, clientY: rc.y + ${y}, pointerId: 7, pointerType: "mouse", button: 0, buttons: ${t === "pointerup" ? 0 : 1} }));
    return { x0: cv.dataset.x0 ?? null, brush: typeof brush === "undefined" ? "U" : brush }; })()`);
  const d1 = await fire("pointerdown", r.w * 0.22, r.h * 0.6);
  const d2 = await fire("pointermove", r.w * 0.4, r.h * 0.6);
  const d3 = await fire("pointermove", r.w * 0.58, r.h * 0.6);
  const d4 = await fire("pointerup", r.w * 0.58, r.h * 0.6);
  await sleep(150);
  const chk = await evaljs(`({ chipTexts: [...document.querySelectorAll("#chips .chip")].map(c => c.textContent.trim().slice(0, 44)) })`);
  await shot("04-brush-filter-chip.png");
  return { d1, d2, d3, d4, ...chk };
});

// ---------- 05 缩放（换维前基准） ----------
await step("05 滚轮缩放散点", async () => {
  const r = rect("#scatter");
  await evaljs(`(() => { const el = document.querySelector("#scatter"), rr = el.getBoundingClientRect();
    el.dispatchEvent(new WheelEvent("wheel", { bubbles: true, cancelable: true, clientX: rr.x + rr.width * 0.55, clientY: rr.y + rr.height * 0.45, deltaY: -240 }));
    return true; })()`);
  await sleep(150);
  await shot("05-zoomed.png");
  return {};
});

// ---------- 06 维度切换（核心验收：认知不重置） ----------
await step("06 键盘换维 X=适生指数 + 点击换画像/颜色 + 表头换排序", async () => {
  await evaljs(`(() => {
    const li = document.querySelector('#dimlist .dim[data-key="habit"]'); li.focus();
    li.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));      // X = 适生指数
    document.querySelector('#dimlist .dim[data-key="period"]').click();                    // 画像 = 轨道周期
    const liD = document.querySelector('#dimlist .dim[data-key="detection"]'); liD.focus();
    liD.dispatchEvent(new KeyboardEvent("keydown", { key: "c", bubbles: true }));          // 颜色 = 发现方法
    document.querySelector('#table-head th[data-key="' + EXPLORE.state.proj.portrait + '"]').dispatchEvent(new MouseEvent("click", { bubbles: true })); // 排序 = 画像列
    return true; })()`);
  await sleep(200);
  const chk = await evaljs(`({
    focusStillOnRail: document.activeElement?.dataset?.key ?? null,
    trailTop: document.querySelector("#trail button .t-label")?.textContent ?? null,
  })`);
  await shot("06-dims-switched-state-kept.png");
  return chk;
});

// ---------- 07 单条移除过滤 chip ----------
await step("07 移除第一条过滤 chip", async () => {
  await evaljs(`document.querySelector('#chips .chip[data-kind="filter"] button.x')?.dispatchEvent(new MouseEvent("click", { bubbles: true })); true`);
  await sleep(150);
  await shot("07-chip-removed.png");
  return {};
});

// ---------- 08 撤销 → 重做 ----------
await step("08 Ctrl+Z 撤销两次", async () => {
  for (let i = 0; i < 2; i++) {
    await evaljs(`document.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true, cancelable: true })); true`);
    await sleep(120);
  }
  await shot("08-undo-twice.png");
  return {};
});

// ---------- 09 复位 ----------
await step("09 复位到初始视图", async () => {
  await evaljs(`document.querySelector("#btn-reset").click(); true`);
  await sleep(150);
  await shot("09-reset.png");
  return {};
});

// ---------- 10 空状态 ----------
await step("10 空状态（过滤无匹配）", async () => {
  await evaljs(`EXPLORE.upsertFilter({ id: 9001, dim: "mass", kind: "range", min: 99999, max: 100000, origin: "画像拖刷" }); true`);
  await sleep(150);
  const chk = await evaljs(`({ status: EXPLORE.status, overlay: document.querySelector("#stage-status")?.hidden === false })`);
  await shot("10-empty-state.png");
  await evaljs(`document.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true, cancelable: true })); true`);
  return chk;
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
