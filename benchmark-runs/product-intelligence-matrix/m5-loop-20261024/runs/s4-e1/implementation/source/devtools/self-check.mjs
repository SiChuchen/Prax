// 自检：复现 a11y 焦点顺序（Tab 遍历的视口 y 单调性）与 rail 是否滚动
import { writeFileSync } from "node:fs";
const PORT = 9333;
const URL_TARGET = "file:///E:/codex-prj/ab-worktrees/pi-matrix-m5/s4-e1/index.html";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getWs() {
  for (let i = 0; i < 20; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(URL_TARGET)}`, { method: "PUT" });
      if (res.ok) return (await res.json()).webSocketDebuggerUrl;
    } catch {}
    await sleep(500);
  }
  throw new Error("no target");
}
const ws = new WebSocket(await getWs());
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let id = 0; const pend = new Map();
ws.onmessage = (ev) => { const d = JSON.parse(ev.data); if (d.id && pend.has(d.id)) { const { res, rej } = pend.get(d.id); pend.delete(d.id); d.error ? rej(new Error(d.error.message)) : res(d.result); } };
const send = (m, p = {}) => new Promise((res, rej) => { const i = ++id; pend.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
const ev = async (expr) => (await send("Runtime.evaluate", { expression: expr, returnByValue: true })).result?.value;

await send("Page.enable"); await send("Runtime.enable");

for (const vp of [[1280, 860], [1440, 900]]) {
  await send("Emulation.setDeviceMetricsOverride", { width: vp[0], height: vp[1], deviceScaleFactor: 1, mobile: false });
  await send("Page.navigate", { url: URL_TARGET });
  await sleep(700);
  const rail = await ev(`(()=>{const r=document.getElementById('rail');return {scrollH:r.scrollHeight, clientH:r.clientHeight, items:r.querySelectorAll('.rail-item').length};})()`);
  // Tab 遍历所有可聚焦元素
  const stops = [];
  let guard = 0, prev = null;
  while (guard++ < 60) {
    await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9 });
    await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9 });
    await sleep(30);
    const cur = await ev(`(()=>{const a=document.activeElement;if(!a||a===document.body)break_return_null;const r=a.getBoundingClientRect();return {tag:a.tagName,id:a.id,cls:(a.className||'').slice(0,20),x:Math.round(r.x),y:Math.round(r.y)};})()`.replace("break_return_null;", "return null;"));
    if (!cur) break;
    const key = cur.tag + cur.id + cur.x + "," + cur.y;
    if (prev && prev.key === key && stops.length > 2) { stops.push(cur); break; } // 循环回到起点附近
    stops.push({ ...cur, key });
    if (stops.length > 40) break;
    prev = cur;
  }
  // 去掉环绕重复的最后一个
  const seq = stops.slice(0, -1);
  let inversions = [];
  for (let i = 1; i < seq.length; i++) {
    const a = seq[i - 1], b = seq[i];
    if (b.y < a.y - 2) inversions.push({ from: (a.id || a.cls), to: (b.id || b.cls), ay: a.y, by: b.y });
  }
  console.log(`viewport ${vp[0]}x${vp[1]}: stops=${seq.length} railScroll=${rail.scrollH}>${rail.clientH}? ${rail.scrollH > rail.clientH} items=${rail.items}`);
  console.log("  y-seq:", seq.map(s => s.y).join(","));
  console.log("  inversions(y-up):", JSON.stringify(inversions));
}
ws.close(); process.exit(0);
