// file:// 直接打开验证：交付约束"根路径 index.html 直接静态打开"
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const edge = spawn("C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  ["--remote-debugging-port=9229", `--user-data-dir=${join(root, "evidence", ".edge-file")}`,
   "--headless=new", "--disable-gpu", "--window-size=1600,900", "about:blank"], { stdio: "ignore" });
for (let i = 0; i < 60; i++) { try { const r = await fetch("http://127.0.0.1:9229/json/version"); if (r.ok) break; } catch { } await sleep(250); }
const ws = new WebSocket((await (await fetch("http://127.0.0.1:9229/json/version")).json()).webSocketDebuggerUrl);
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
await S("Page.navigate", { url: "file:///" + root.replace(/\\/g, "/") + "/index.html" });
await lp; await sleep(600);
const ev = async (e) => (await S("Runtime.evaluate", { expression: e, returnByValue: true })).result?.value;
const result = await ev(`({ status: EXPLORE.status, visible: EXPLORE.visibleCount(),
  rows: document.querySelectorAll("#dimlist .dim").length,
  tableRows: document.querySelectorAll("#table-body tr").length,
  protocol: location.protocol })`);
await S("Page.captureScreenshot", { format: "png" }).then(r =>
  writeFileSync(join(root, "evidence", "shots", "11-file-open.png"), Buffer.from(r.data, "base64")));
console.log("[file://]", JSON.stringify(result));
ws.close(); try { edge.kill(); } catch { } await sleep(600); process.exit(0);
