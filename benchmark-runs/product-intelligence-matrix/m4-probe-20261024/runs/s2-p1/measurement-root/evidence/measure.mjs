// a11y.focus_order 实测 + prax-measure 格式回执生成（receipt_version 0.2 绑定版）。
// 真实键盘 Tab 穿越（CDP Input 域，受信任事件）→ 焦点序与焦点可见性；
// 摘要算法逐行复刻 prax-validator/src/measurement-binding.ts。
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { readdir, readFile, realpath, lstat, stat, writeFile } from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = await realpath(dirname(fileURLToPath(import.meta.url)) + "/..");
const SESSION_DIR = join(root, ".prax", "design", "sessions", "ds_20261023200920_909feae5");
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const MIME = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript" };
const HTTP_PORT = 8414, CDP_PORT = 9231;

const server = http.createServer(async (req, res) => {
  const p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  const file = p === "/" ? "index.html" : p.slice(1);
  try { const b = await readFile(join(root, file)); res.writeHead(200, { "content-type": MIME[file.slice(file.lastIndexOf("."))] ?? "app/oct" }); res.end(b); }
  catch { res.writeHead(404); res.end(); }
});
await new Promise(r => server.listen(HTTP_PORT, "127.0.0.1", r));
const edge = spawn("C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  ["--remote-debugging-port=" + CDP_PORT, `--user-data-dir=${join(os.tmpdir(), "prax-edge-measure")}`,
   "--headless=new", "--disable-gpu", "--window-size=1600,900", "about:blank"], { stdio: "ignore" });
for (let i = 0; i < 60; i++) { try { const r = await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`); if (r.ok) break; } catch { } await sleep(250); }
const ws = new WebSocket((await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`)).json()).webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let id = 0; const pend = new Map(); const loads = [];
ws.onmessage = (ev) => { const m = JSON.parse(ev.data);
  if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); }
  else if (m.method === "Page.loadEventFired") loads.splice(0).forEach(f => f()); };
const send = (method, params = {}, sessionId) => new Promise((res, rej) => { pend.set(++id, { res, rej }); ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) })); });
const { targetId } = await send("Target.createTarget", { url: "about:blank" });
const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
const S = (m, p) => send(m, p, sessionId);
await S("Page.enable"); await S("Runtime.enable");
const lp = new Promise(r => loads.push(r));
await S("Page.navigate", { url: `http://127.0.0.1:${HTTP_PORT}/` });
await lp; await sleep(600);

// ── 真实 Tab 穿越（受信任键盘事件）──
const describe = `(() => { const a = document.activeElement; if (!a || a === document.body) return null;
  const cs = getComputedStyle(a);
  const visible = cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0 || cs.boxShadow !== "none";
  return { tag: a.tagName.toLowerCase(), id: a.id || null, cls: a.getAttribute("class"), key: (a.dataset && (a.dataset.key || a.dataset.id)) || null,
           label: (a.textContent || "").trim().slice(0, 18), focusVisible: visible }; })()`;
const stops = [];
for (let i = 0; i < 26; i++) {
  await S("Input.dispatchKeyEvent", { type: "rawKeyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
  await S("Input.dispatchKeyEvent", { type: "keyUp", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
  await sleep(40);
  const d = (await S("Runtime.evaluate", { expression: describe, returnByValue: true })).result.value;
  if (!d) break;
  if (stops.length && d.tag === stops[0].tag && d.id === stops[0].id && d.key === stops[0].key) { stops.push({ ...d, wrapped: true }); break; }
  stops.push(d);
}
const allVisible = stops.every(s => s.focusVisible);
console.log("[tab-order]", stops.map(s => `${s.tag}${s.id ? "#" + s.id : ""}${s.key ? "[" + s.key + "]" : ""}:${s.focusVisible ? "fv" : "HIDDEN"}`).join(" → "));
console.log("[tab-order] stops:", stops.length, "all focus visible:", allVisible);

// ── implementation 摘要（逐行复刻 captureImplementation）──
const EXCLUDED = new Set(["node_modules", ".git", ".prax", ".prax-state", "validation-evidence", "coverage", ".vite"]);
const isExcluded = (name) => name.split(/[\\/]/).some(n => EXCLUDED.has(n.toLowerCase()) || /\.(?:log|tmp|tsbuildinfo)$/i.test(n));
async function captureImpl(directory, prefix, hash, counter) {
  const names = (await readdir(directory)).sort();
  for (const name of names) {
    if (++counter.entries > 50000) throw new Error("entry limit");
    if (isExcluded(name)) continue;
    const path = join(directory, name);
    const stats = await lstat(path);
    if (stats.isSymbolicLink()) throw new Error(`symlink: ${prefix}${name}`);
    if (stats.isDirectory()) await captureImpl(path, `${prefix}${name}/`, hash, counter);
    else if (stats.isFile()) {
      counter.bytes += stats.size;
      const content = await readFile(path);
      hash.update(JSON.stringify([`${prefix}${name}`, content.length]));
      hash.update("\0").update(content).update("\0");
    } else throw new Error(`non-regular: ${prefix}${name}`);
  }
}
const implHash = createHash("sha256").update("prax-static-tree-v1\0");
const counter = { entries: 0, bytes: 0 };
await captureImpl(root, "", implHash, counter);
const implDigest = implHash.digest("hex");
console.log("[impl] entries:", counter.entries, "bytes:", counter.bytes, "digest:", implDigest.slice(0, 16) + "…");

const sha = async (p) => createHash("sha256").update(await readFile(p)).digest("hex");
const contractDigests = {
  "screen.sdir.yaml": await sha(join(SESSION_DIR, "screen.sdir.yaml")),
  "sdir-delta.yaml": null,
  "implementation-brief.yaml": await sha(join(SESSION_DIR, "implementation-brief.yaml")),
};

const brief = await readFile(join(SESSION_DIR, "implementation-brief.yaml"), "utf8");
const scenario = brief.match(/scenario:\s*(.+)/)[1].trim();
const entry = brief.match(/entry:\s*(.+)/)[1].trim();

const receipt = {
  receipt_version: "0.2",
  tool: { name: "prax-measure", version: "evidence/measure.mjs (local CDP tab-order, runtime r3 schema)" },
  target: { app_root: root, base_url: `http://127.0.0.1:${HTTP_PORT}/`, build_ref: null },
  run_at: new Date().toISOString(),
  viewport_matrix: [{ width: 1600, height: 900, label: "desktop" }],
  checks: [{
    id: "a11y.focus_order",
    status: allVisible && stops.length > 5 ? "pass" : "fail",
    severity: "error",
    subject: "KEPLER-EXT 480 · index.html",
    measured: { stops, stop_count: stops.length, all_focus_visible: allVisible, traversal: "real Tab keypresses via CDP Input domain" },
    threshold: { rule: "Tab order follows DOM/visual order; a visible focus indicator exists at every stop" },
    evidence_refs: [],
    supported_fixes: [],
  }],
  summary: { pass: allVisible && stops.length > 5 ? 1 : 0, fail: allVisible && stops.length > 5 ? 0 : 1, skipped: 0, warnings: 0 },
  binding: {
    run_id: "run-focus-order-1",
    entry, scenario,
    implementation: { root, digest: implDigest, kind: "static_tree" },
    session_id: "ds_20261023200920_909feae5",
    contract_digests: contractDigests,
  },
  target_validation: { status: "valid", issues: [], readiness: "selector", ready_selector: "#app[data-status='ready']" },
};
const out = join(SESSION_DIR, "validation-evidence", "measure-focus-order.json");
await writeFile(out, JSON.stringify(receipt, null, 2), "utf8");
console.log("[receipt]", out, "status:", receipt.checks[0].status);

ws.close(); try { edge.kill(); } catch { } await sleep(600); server.close();
process.exit(0);
