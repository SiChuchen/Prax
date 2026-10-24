// 一次性探针：画像拖刷事件链路诊断
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import http from "node:http";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const MIME = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript" };
const server = http.createServer(async (req, res) => {
  const p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  const file = p === "/" ? "index.html" : p.slice(1);
  try { const b = await readFile(join(root, file)); res.writeHead(200, { "content-type": MIME[file.slice(file.lastIndexOf("."))] ?? "app/oct" }); res.end(b); }
  catch { res.writeHead(404); res.end(); }
});
await new Promise(r => server.listen(8413, "127.0.0.1", r));
const edge = spawn("C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  ["--remote-debugging-port=9227", `--user-data-dir=${join(root, "evidence", ".edge-probe")}`,
   "--headless=new", "--disable-gpu", "--window-size=1600,900", "about:blank"], { stdio: "ignore" });
for (let i = 0; i < 60; i++) { try { const r = await fetch("http://127.0.0.1:9227/json/version"); if (r.ok) break; } catch { } await sleep(250); }

const ws = new WebSocket((await (await fetch("http://127.0.0.1:9227/json/version")).json()).webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let id = 0; const pend = new Map(); const loads = [];
ws.onmessage = (ev) => { const m = JSON.parse(ev.data);
  if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); }
  else if (m.method === "Page.loadEventFired") loads.splice(0).forEach(f => f()); };
const send = (method, params = {}, sessionId) => new Promise((res, rej) => { pend.set(++id, { res, rej }); ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) })); });
const { targetId } = await send("Target.createTarget", { url: "about:blank" });
const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
const S = (m, p) => send(m, p, sessionId);
await S("Page.enable");
const lp = new Promise(r => loads.push(r));
await S("Page.navigate", { url: "http://127.0.0.1:8413/" });
await lp; await sleep(500);
const ev = async (e) => (await S("Runtime.evaluate", { expression: e, returnByValue: true })).result?.value;

console.log("status:", await ev(`EXPLORE.status`), "portrait dim:", await ev(`EXPLORE.state.proj.portrait`));
console.log("probe0:", await ev(`(() => { const cv = document.querySelector("#portrait"); const r = cv.getBoundingClientRect();
  return { w: r.width, h: r.height, hasListener: typeof cv.onpointerdown, type: typeof PointerEvent }; })()`));
console.log("down:", await ev(`(() => { const cv = document.querySelector("#portrait"); const r = cv.getBoundingClientRect();
  cv.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, clientX: r.x + r.width * 0.25, clientY: r.y + r.height * 0.5, pointerId: 7 }));
  return { x0: cv.dataset.x0 ?? null, rectX: r.x, rectW: r.width }; })()`));
console.log("move:", await ev(`(() => { const cv = document.querySelector("#portrait"); const r = cv.getBoundingClientRect();
  cv.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, clientX: r.x + r.width * 0.5, clientY: r.y + r.height * 0.5, pointerId: 7 }));
  return { brush: typeof brush === "undefined" ? "UNDEF" : brush }; })()`));
console.log("up:", await ev(`(() => { const cv = document.querySelector("#portrait"); const r = cv.getBoundingClientRect();
  cv.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, clientX: r.x + r.width * 0.6, clientY: r.y + r.height * 0.5, pointerId: 7 }));
  return { hist: EXPLORE.history, filters: EXPLORE.state.filters }; })()`));

ws.close(); try { edge.kill(); } catch { } await sleep(600); server.close(); process.exit(0);
