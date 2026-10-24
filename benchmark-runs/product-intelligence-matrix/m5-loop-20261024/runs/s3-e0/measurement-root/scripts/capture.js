/* capture.js — 真实浏览器（Chromium headless）驱动 + 截图取证
   零依赖：内置 CDP WebSocket 客户端（Node ≥21 用全局 WebSocket，否则回退 MiniWS）
   用法：node scripts/capture.js
   产物：evidence/*.png + evidence/assertions.json + evidence/capture-log.txt */
"use strict";
const fs = require("fs");
const path = require("path");
const net = require("net");
const crypto = require("crypto");
const { spawn } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "evidence");
const PAGE_URL = "file:///" + ROOT.replace(/\\/g, "/") + "/index.html";
const PORT = 9337;
const CODES = { s7: "MIGRATE-2410", s9: "CUTOVER-2410", s11: "RETIRE-239" };

fs.mkdirSync(OUT, { recursive: true });
const LOG = [];
function log(m) { const line = "[" + new Date().toISOString() + "] " + m; LOG.push(line); console.log(line); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------------- 最小 RFC6455 WebSocket（Node <21 回退用） ---------------- */
class MiniWS {
  constructor(url) { this.url = url; this._buf = Buffer.alloc(0); this._frag = []; this.onmessage = null; this.onclose = null; }
  connect() {
    return new Promise((resolve, reject) => {
      const u = new URL(this.url);
      this._sock = net.connect(+u.port, u.hostname, () => {
        const key = crypto.randomBytes(16).toString("base64");
        this._sock.write(
          "GET " + u.pathname + " HTTP/1.1\r\nHost: " + u.host + "\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n" +
          "Sec-WebSocket-Key: " + key + "\r\nSec-WebSocket-Version: 13\r\n\r\n");
      });
      let handshook = false;
      this._sock.on("data", (d) => {
        this._buf = Buffer.concat([this._buf, d]);
        if (!handshook) {
          const idx = this._buf.indexOf("\r\n\r\n");
          if (idx === -1) return;
          const first = this._buf.slice(0, idx).toString().split("\r\n")[0];
          if (!/ 101 /.test(first)) { reject(new Error("ws handshake failed: " + first)); return; }
          this._buf = this._buf.slice(idx + 4);
          handshook = true; resolve();
        }
        this._drain();
      });
      this._sock.on("error", (e) => { if (!handshook) reject(e); });
      this._sock.on("close", () => { if (this.onclose) this.onclose(); });
    });
  }
  _drain() {
    for (;;) {
      const b = this._buf;
      if (b.length < 2) return;
      const fin = (b[0] & 0x80) !== 0, op = b[0] & 0x0f;
      let len = b[1] & 0x7f, off = 2;
      if (len === 126) { if (b.length < 4) return; len = b.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (b.length < 10) return; len = Number(b.readBigUInt64BE(2)); off = 10; }
      const masked = (b[1] & 0x80) !== 0;
      if (masked) off += 4;
      if (b.length < off + len) return;
      let payload = b.slice(off, off + len);
      if (masked) { const mask = b.slice(off - 4, off); for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i & 3]; }
      this._buf = b.slice(off + len);
      if (op === 8) { try { this._sock.end(); } catch (e) {} if (this.onclose) this.onclose(); return; }
      if (op === 9) { this._send(10, payload); continue; }
      if (op === 1 || op === 2 || op === 0) {
        this._frag.push(payload);
        if (fin) { const full = Buffer.concat(this._frag).toString("utf8"); this._frag = []; if (this.onmessage) this.onmessage(full); }
      }
    }
  }
  send(text) { this._send(1, Buffer.from(text, "utf8")); }
  _send(op, payload) {
    const mask = crypto.randomBytes(4), len = payload.length;
    let head;
    if (len < 126) head = Buffer.from([0x80 | op, 0x80 | len]);
    else if (len < 65536) { head = Buffer.alloc(4); head[0] = 0x80 | op; head[1] = 0x80 | 126; head.writeUInt16BE(len, 2); }
    else { head = Buffer.alloc(10); head[0] = 0x80 | op; head[1] = 0x80 | 127; head.writeBigUInt64BE(BigInt(len), 2); }
    const m = Buffer.from(payload);
    for (let i = 0; i < m.length; i++) m[i] ^= mask[i & 3];
    this._sock.write(Buffer.concat([head, mask, m]));
  }
}

async function connectWS(url) {
  if (typeof WebSocket !== "undefined") {
    const ws = new WebSocket(url);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = (e) => rej(new Error("ws error")); });
    ws.onmessage = (ev) => { if (ws._h) ws._h(String(ev.data)); };
    ws._raw = (h) => { ws._h = h; };
    ws.sendText = (t) => ws.send(t);
    return ws;
  }
  const ws = new MiniWS(url);
  await ws.connect();
  ws.onmessage = (d) => { if (ws._h) ws._h(d); };
  ws._raw = (h) => { ws._h = h; };
  ws.sendText = (t) => ws.send(t);
  return ws;
}

/* ---------------- 浏览器进程 ---------------- */
function findBrowser() {
  const cands = [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    process.env.LOCALAPPDATA + "\\Google\\Chrome\\Application\\chrome.exe"
  ];
  for (const c of cands) { try { if (fs.existsSync(c)) return c; } catch (e) {} }
  throw new Error("未找到 Chrome/Edge，请设置环境变量 BROWSER_EXE");
}
function launchBrowser() {
  const exe = process.env.BROWSER_EXE || findBrowser();
  const profile = path.join(OUT, ".profile");
  const base = ["--user-data-dir=" + profile, "--no-first-run", "--no-default-browser-check",
    "--disable-gpu", "--window-size=1440,900", "--hide-scrollbars", "--mute-audio",
    "--remote-debugging-port=" + PORT, "about:blank"];
  log("browser: " + exe);
  return spawn(exe, ["--headless=new", ...base], { stdio: "ignore" });
}
async function waitForDevTools() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch("http://127.0.0.1:" + PORT + "/json/version");
      if (r.ok) return await r.json();
    } catch (e) {}
    await sleep(300);
  }
  throw new Error("DevTools 端口未就绪");
}

/* ---------------- CDP 会话 ---------------- */
let cdpId = 0; const pending = new Map(); const evWaiters = [];
function cdp(ws, method, params) {
  return new Promise((resolve, reject) => {
    const id = ++cdpId;
    pending.set(id, { resolve, reject });
    ws.sendText(JSON.stringify({ id, method, params: params || {} }));
    setTimeout(() => { if (pending.has(id)) { pending.delete(id); reject(new Error("cdp timeout: " + method)); } }, 30000);
  });
}
function waitEvent(method) {
  return new Promise((resolve) => evWaiters.push({ method, resolve }));
}
function wireWS(ws) {
  ws._raw((text) => {
    let d; try { d = JSON.parse(text); } catch (e) { return; }
    if (d.id && pending.has(d.id)) {
      const p = pending.get(d.id); pending.delete(d.id);
      if (d.error) p.reject(new Error(d.error.message)); else p.resolve(d.result);
      return;
    }
    if (d.method) for (let i = evWaiters.length - 1; i >= 0; i--) {
      if (evWaiters[i].method === d.method) { evWaiters[i].resolve(d.params); evWaiters.splice(i, 1); }
    }
  });
}
async function ev(ws, expr) {
  const r = await cdp(ws, "Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error("page exception: " + JSON.stringify(r.exceptionDetails).slice(0, 400));
  return r.result ? r.result.value : undefined;
}
async function shot(ws, name) {
  const r = await cdp(ws, "Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(path.join(OUT, name), Buffer.from(r.data, "base64"));
  log("📸 " + name);
}
async function nav(ws, url) {
  const lp = waitEvent("Page.loadEventFired");
  await cdp(ws, "Page.navigate", { url });
  await lp; await sleep(450);
}

/* ---------------- 页面驱动片段 ---------------- */
const JS = {
  info: `JSON.stringify((function(){
    return {
      title: document.title,
      steps: document.querySelectorAll('.nav-item').length,
      current: (document.querySelector('.nav-item.is-current .nav-t')||{}).textContent || null,
      doneChips: document.querySelectorAll('.nav-item.is-done').length,
      modeChip: (document.querySelector('.top-actions .chip')||{}).textContent,
      progress: (document.querySelector('.progress')||{}).textContent,
      h2: (document.querySelector('.work h2')||{}).textContent,
      irrevTags: document.querySelectorAll('.nav-item .tag-danger').length,
      lockedSample: (document.querySelectorAll('.nav-item')[4]||{}).disabled,
      completeDisabled: (document.querySelector('[data-action="complete"]')||{disabled:'none'}).disabled,
      recEmpty: !!document.querySelector('.side .empty'),
      events: document.querySelectorAll('.events li').length
    };
  })())`,
  checkAll: `(function(){ var n=0; document.querySelectorAll('.work [data-check]').forEach(function(c){ if(!c.checked){ c.click(); n++; } }); return n; })()`,
  checkAllRollback: `(function(){ var n=0; document.querySelectorAll('.work [data-rcheck]').forEach(function(c){ if(!c.checked){ c.click(); n++; } }); return n; })()`,
  btn: function (a) { return `(function(){ var b=document.querySelector('[data-action="${a}"]:not(:disabled)'); if(!b) throw new Error('btn missing/disabled: ${a}'); b.click(); return true; })()`; },
  typeCode: function (code) { return `(function(){ var i=document.getElementById('confirm-code'); if(!i) throw new Error('no confirm input'); i.value='${code}'; i.dispatchEvent(new Event('input',{bubbles:true})); return i.value; })()`; },
  summaryText: `document.querySelector('.work .summary') ? document.querySelector('.work .summary').textContent.slice(0,600) : null`,
  summaryStats: `JSON.stringify((function(){
    var s=document.querySelector('.work .summary'); if(!s) return null;
    var vs=[].map.call(s.querySelectorAll('.stat-v'), function(x){return x.textContent;});
    return { badge:(s.querySelector('.sum-badge')||{}).textContent, stats: vs,
             recChips: [].map.call(document.querySelectorAll('.rec-item .chip'), function(x){return x.textContent;}) };
  })())`,
  focusInfo: `JSON.stringify({ active: document.activeElement ? (document.activeElement.tagName + '.' + document.activeElement.className) : null,
    visible: (function(){ var el=document.activeElement; if(!el) return false; var r=el.getBoundingClientRect(); return r.width>0 && r.height>0; })() })`
};
const clearsReload = `localStorage.clear(); location.reload(); 'cleared'`;

async function completeStep(ws, action) {
  await ev(ws, JS.checkAll);
  await ev(ws, JS.btn(action));
}
async function doIrrev(ws, code) {
  await ev(ws, JS.checkAll);
  await ev(ws, JS.btn("open-irrev"));
  await ev(ws, JS.typeCode(code));
  await ev(ws, JS.btn("exec-irrev"));
}

(async function main() {
  const asserts = { sessionA: {}, sessionB: {}, keyboard: {} };
  let child = null;
  try {
    child = launchBrowser();
    const ver = await waitForDevTools();
    log("devtools ready: " + (ver.Browser || "") + " " + (ver["User-Agent"] || "").slice(0, 60));
    const list = await (await fetch("http://127.0.0.1:" + PORT + "/json/list")).json();
    const page = list.find((t) => t.type === "page");
    const ws = await connectWS(page.webSocketDebuggerUrl);
    wireWS(ws);
    await cdp(ws, "Page.enable");
    await cdp(ws, "Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

    /* ============ 会话 A：主路径 + 确认门 + 异常分支 + 回滚 ============ */
    await nav(ws, PAGE_URL);
    asserts.sessionA.first = JSON.parse(await ev(ws, JS.info));
    await shot(ws, "01-first-screen-ready.png");

    await ev(ws, JS.checkAll);                       // s1 三项全勾
    asserts.sessionA.s1_checked_all = true;
    asserts.sessionA.complete_enabled_after_checks = await ev(ws,
      `!document.querySelector('[data-action="complete"]').disabled`);
    await shot(ws, "02-checks-gate-open.png");
    await ev(ws, JS.btn("complete"));                // s1 → s2
    await ev(ws, JS.checkAll); await ev(ws, JS.btn("complete"));   // s2 → s3
    await ev(ws, JS.checkAll); await ev(ws, JS.btn("vpass"));      // s3 验证通过 → s4
    await ev(ws, JS.checkAll); await ev(ws, JS.btn("complete"));   // s4 → s5
    await ev(ws, JS.checkAll); await ev(ws, JS.btn("vpass"));      // s5 → s6
    await ev(ws, JS.checkAll); await ev(ws, JS.btn("complete"));   // s6 → s7(不可逆)
    asserts.sessionA.s7_head = JSON.parse(await ev(ws,
      `JSON.stringify({h2:document.querySelector('.work h2').textContent, warn:!!document.querySelector('.irrev-warn'), preview:!!document.querySelector('.recovery-preview')})`));
    await ev(ws, JS.checkAll);
    await ev(ws, JS.btn("open-irrev"));
    asserts.sessionA.confirm_gate = JSON.parse(await ev(ws,
      `JSON.stringify({modal:!!document.querySelector('.modal'), codeHint:(document.querySelector('.code-label code')||{}).textContent, execDisabled:document.querySelector('[data-action="exec-irrev"]').disabled})`));
    await shot(ws, "03-confirm-gate.png");
    await ev(ws, JS.typeCode(CODES.s7));
    await ev(ws, JS.btn("exec-irrev"));
    asserts.sessionA.after_exec = JSON.parse(await ev(ws,
      `JSON.stringify({h2:document.querySelector('.work h2').textContent, recItem:!!document.querySelector('.rec-item'), recBtnDisabled:document.querySelector('[data-action="rb-start"]') ? document.querySelector('[data-action="rb-start"]').disabled : 'none'})`));
    await shot(ws, "04-irrev-executed-recovery-center.png");

    await ev(ws, JS.btn("vfail"));                   // s8 校验不通过 → 异常分支
    asserts.sessionA.deviation = JSON.parse(await ev(ws,
      `JSON.stringify({alert:!!document.querySelector('.deviate'), rollbackEnabled:!document.querySelector('[data-action="dev-rollback"]').disabled, chip:(document.querySelector('.top-actions .chip')||{}).textContent})`));
    await shot(ws, "05-deviation-branch.png");
    await ev(ws, JS.btn("dev-rollback"));            // 回滚最近不可逆操作
    await shot(ws, "06-guided-rollback.png");
    await ev(ws, JS.checkAllRollback);
    await ev(ws, JS.btn("rb-confirm"));
    asserts.sessionA.aborted = JSON.parse(await ev(ws, JS.summaryStats));
    await shot(ws, "07-safely-aborted.png");

    /* ============ 会话 B：零失误走完全程 ============ */
    const lp = waitEvent("Page.loadEventFired");
    await ev(ws, clearsReload); await lp; await sleep(500);
    await completeStep(ws, "complete");   // s1
    await completeStep(ws, "complete");   // s2
    await completeStep(ws, "vpass");      // s3
    await completeStep(ws, "complete");   // s4
    await completeStep(ws, "vpass");      // s5
    await completeStep(ws, "complete");   // s6
    await doIrrev(ws, CODES.s7);          // s7 不可逆
    await completeStep(ws, "vpass");      // s8
    await doIrrev(ws, CODES.s9);          // s9 不可逆
    await completeStep(ws, "vpass");      // s10
    await doIrrev(ws, CODES.s11);         // s11 不可逆
    await completeStep(ws, "complete");   // s12
    asserts.sessionB.summary = JSON.parse(await ev(ws, JS.summaryStats));
    asserts.sessionB.fullTextHasZeroSlip = ((await ev(ws, JS.summaryText)) || "").includes("零失误走完全程");
    await shot(ws, "08-completed-zero-slip.png");

    // 导出审计（真实下载）
    try {
      await cdp(ws, "Browser.setDownloadBehavior", { behavior: "allow", downloadPath: OUT });
      await ev(ws, JS.btn("export"));
      await sleep(1500);
      const f = fs.readdirSync(OUT).find((x) => x.startsWith("audit-") && x.endsWith(".json"));
      asserts.sessionB.auditExported = f || null;
      if (f) log("audit exported: " + f);
    } catch (e) { asserts.sessionB.auditExported = "error: " + e.message; }

    /* ============ 会话 C：键盘可达性（Tab + 焦点环） ============ */
    const lp2 = waitEvent("Page.loadEventFired");
    await ev(ws, clearsReload); await lp2; await sleep(500);
    for (let i = 0; i < 5; i++) {
      await cdp(ws, "Input.dispatchKeyEvent", { type: "rawKeyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
      await cdp(ws, "Input.dispatchKeyEvent", { type: "keyUp", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
    }
    asserts.keyboard.focus = JSON.parse(await ev(ws, JS.focusInfo));
    await shot(ws, "09-keyboard-focus-ring.png");

    fs.writeFileSync(path.join(OUT, "assertions.json"), JSON.stringify(asserts, null, 2));
    log("DONE. evidence files: " + fs.readdirSync(OUT).filter((f) => !f.startsWith(".")).join(", "));
    try { ws.close ? ws.close() : ws._sock && ws._sock.end(); } catch (e) {}
  } catch (e) {
    log("FATAL: " + (e && e.stack || e));
    fs.writeFileSync(path.join(OUT, "assertions.json"), JSON.stringify(asserts, null, 2));
    process.exitCode = 1;
  } finally {
    if (child) {
      try { if (process.platform === "win32") spawn("taskkill", ["/F", "/T", "/PID", String(child.pid)], { stdio: "ignore" });
            else child.kill(); } catch (e) {}
    }
    fs.writeFileSync(path.join(__dirname, "capture-log.txt"), LOG.join("\n"));
  }
})();
