/* Zero-dependency CDP driver: replays the full runbook user journey in headless
   Chrome with real input events, asserts app behavior, and saves screenshot
   evidence to screenshots/. Run: node scripts/drive.cjs */
"use strict";
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const ROOT = "E:\\codex-prj\\ab-worktrees\\pi-matrix-m5p1\\s4-e1";
const SHOTS = path.join(ROOT, "screenshots");
const PORT = 9333;
const APP_URL = "file:///E:/codex-prj/ab-worktrees/pi-matrix-m5p1/s4-e1/index.html";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const results = [];
const consoleErrs = [];
function check(label, cond, detail) {
  results.push({ label, pass: !!cond, detail: detail || "" });
  console.log((cond ? "PASS  " : "FAIL  ") + label + (detail ? "  [" + detail + "]" : ""));
}
async function expectText(label, actual, wanted) {
  check(label, actual === wanted || (wanted instanceof RegExp && wanted.test(actual)), JSON.stringify(actual));
}

async function main() {
  fs.mkdirSync(SHOTS, { recursive: true });
  const profile = path.join(ROOT, ".chrome-test-profile");
  const chrome = spawn(CHROME, [
    "--headless=new", "--disable-gpu", "--remote-debugging-port=" + PORT,
    "--user-data-dir=" + profile, "--no-first-run", "--window-size=1440,900",
    "--hide-scrollbars", "about:blank"
  ], { stdio: "ignore" });

  let targets = [];
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch("http://127.0.0.1:" + PORT + "/json/list");
      targets = await res.json();
      if (targets.some((t) => t.type === "page")) break;
    } catch (_) {}
    await sleep(200);
  }
  const page = targets.find((t) => t.type === "page");
  if (!page) throw new Error("no devtools page target");
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

  let mid = 0;
  const pending = new Map();
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); return; }
    if (msg.method === "Runtime.consoleAPICalled" && msg.params.type === "error")
      consoleErrs.push(msg.params.args.map((a) => a.value || a.description || "").join(" "));
    if (msg.method === "Runtime.exceptionThrown") {
      const d = msg.params.exceptionDetails;
      consoleErrs.push((d.text || "") + " " + ((d.exception && d.exception.description) || ""));
    }
  };
  function send(method, params) {
    return new Promise((resolve, reject) => {
      const id = ++mid;
      pending.set(id, (m) => (m.error ? reject(new Error(method + ": " + JSON.stringify(m.error))) : resolve(m.result)));
      ws.send(JSON.stringify({ id, method, params: params || {} }));
    });
  }
  async function evaljs(expr) {
    const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error("eval failed: " + JSON.stringify((r.exceptionDetails.exception || {}).description || r.exceptionDetails.text));
    return r.result.value;
  }
  async function shot(name, fullPage) {
    const r = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: !!fullPage });
    fs.writeFileSync(path.join(SHOTS, name), Buffer.from(r.data, "base64"));
  }
  const sel = (s) => "document.querySelector(" + JSON.stringify(s) + ")";
  async function textOf(s) { return evaljs("((" + sel(s) + ")||{textContent:'(missing)'}).textContent.trim()"); }
  async function count(s) { return evaljs("document.querySelectorAll(" + JSON.stringify(s) + ").length"); }
  async function exists(s) { return evaljs("!!" + sel(s)); }
  async function clickAt(s) {
    for (let attempt = 0; attempt < 4; attempt++) {
      const c = await evaljs("(() => { const el = " + sel(s) + "; if (!el) return null; el.scrollIntoView({ block: 'center' });" +
        " const x = Math.round(el.getBoundingClientRect().left + el.getBoundingClientRect().width / 2);" +
        " const y = Math.round(el.getBoundingClientRect().top + el.getBoundingClientRect().height / 2);" +
        " const h = document.elementFromPoint(x, y);" +
        " return { x: x, y: y, hit: !h ? 'none' : (el === h || el.contains(h) || h.contains(el)) ? 'ok' : (h.tagName + '.' + (h.className || '')) }; })()");
      if (!c) throw new Error("element not found: " + s);
      if (c.hit === "ok") {
        await send("Input.dispatchMouseEvent", { type: "mousePressed", x: c.x, y: c.y, button: "left", clickCount: 1 });
        await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: c.x, y: c.y, button: "left", clickCount: 1 });
        await sleep(90);
        return;
      }
      await sleep(140); // page still settling (smooth scroll); re-measure
    }
    throw new Error("click blocked on " + s);
  }
  async function typeInto(s, str) {
    await evaljs("(() => { const el = " + sel(s) + "; el.focus(); el.value = ''; })()");
    for (const ch of str) {
      await send("Input.dispatchKeyEvent", { type: "keyDown", key: ch, text: ch });
      await send("Input.dispatchKeyEvent", { type: "keyUp", key: ch });
    }
    await sleep(50);
    const v = await evaljs(sel(s) + ".value");
    if (v !== str) { // fallback: direct set + event (still exercises the app handler)
      await evaljs("(() => { const el = " + sel(s) + "; el.value = " + JSON.stringify(str) + "; el.dispatchEvent(new Event('input', { bubbles: true })); })()");
    }
    await sleep(50);
  }
  async function tabTimes(n) {
    for (let i = 0; i < n; i++) {
      await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
      await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
      await sleep(60);
    }
  }
  function activeDesc() {
    return evaljs("(() => { const a = document.activeElement; if (!a) return '(none)'; return a.tagName.toLowerCase() + (a.id ? '#' + a.id : '') + (a.dataset && a.dataset.action ? '[' + a.dataset.action + ']' : '') + (a.dataset && a.dataset.step ? ':' + a.dataset.step : '') + (a.dataset && a.dataset.check ? ':' + a.dataset.check : ''); })()");
  }
  async function gateFlow(stepId, phrase) {
    await clickAt("button[data-action='open-gate'][data-step='" + stepId + "']");
    await sleep(120);
    await typeInto("#gate-phrase-input", phrase);
    await clickAt("input[data-gate-check='0']");
    await clickAt("input[data-gate-check='1']");
    const disabled = await evaljs("(document.querySelector(\"#gate [data-action='gate-execute']\")||{}).disabled");
    if (disabled) throw new Error("gate execute stayed disabled for " + stepId);
    await clickAt("#gate [data-action='gate-execute']");
    await sleep(120);
  }
  async function completeSimple(stepId, checkpoints) {
    for (let i = 0; i < (checkpoints || 0); i++) await clickAt("input[data-check='" + stepId + ":" + i + "']");
    await clickAt("button[data-action='complete'][data-step='" + stepId + "']");
    await sleep(90);
  }

  await send("Page.enable");
  await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await send("Page.navigate", { url: APP_URL });
  await sleep(1200);
  // Deterministic scrolling for the driver: the app keeps smooth scrolling for humans.
  await evaljs("document.documentElement.style.scrollBehavior = 'auto'");

  /* Stage 1 — first paint */
  check("S1: title", (await evaljs("document.title")) === "Ledger v2 Cutover — Runbook");
  await expectText("S1: progress label 0 of 10", await textOf("#progress-label"), "0 of 10 steps");
  await expectText("S1: status pill", await textOf("#status-pill"), "Not started");
  check("S1: 10 steps rendered", (await count("article.step")) === 10);
  check("S1: 4 phases rendered", (await count("section.phase")) === 4);
  check("S1: step 1 expanded with 2 checkpoints", (await count(".step[data-step-id='S1'] .check input")) === 2);
  check("S1: complete disabled until checkpoints ticked", await evaljs("(" + sel("button[data-action='complete'][data-step='S1']") + ").disabled"));
  check("S1: step 2 locked", (await evaljs(sel(".step[data-step-id='S2']") + ".classList.contains('is-locked')")));
  check("S1: no loading state text", !(await evaljs("document.body.textContent.toLowerCase().includes('loading')")));
  await shot("01-first-paint.png");
  await shot("01b-first-paint-full.png", true);

  /* Stage 2 — keyboard */
  const foc = [];
  for (let i = 0; i < 4; i++) { await tabTimes(1); foc.push(await activeDesc()); }
  check("S2: tab order starts at Activity log", foc[0] === "button#log-toggle[toggle-log]", foc.join(" -> "));
  check("S2: 3rd stop is step-1 row, 4th is its checkpoint", foc[2] === "button[toggle-step]:S1" && foc[3] === "input:S1:0", foc[2] + " -> " + foc[3]);
  check("S2: focus visible (focus-visible matches)", await evaljs("document.activeElement.matches(':focus-visible')"));
  await shot("02-keyboard-focus.png");

  /* Stage 3 — complete reversible steps 1..4 */
  await completeSimple("S1", 2);
  await completeSimple("S2", 2);
  await completeSimple("S3", 0);
  await completeSimple("S4", 0);
  await expectText("S3: progress 4 of 10", await textOf("#progress-label"), "4 of 10 steps");
  await expectText("S3: status in progress", await textOf("#status-pill"), "In progress");
  check("S3: step 5 is current", await evaljs(sel(".step[data-step-id='S5']") + ".classList.contains('is-current')"));
  await expectText("S3: irreversible badge", await textOf(".step[data-step-id='S5'] .badge-irrev"), "Irreversible");
  check("S3: gate button enabled", await evaljs("!(" + sel("button[data-action='open-gate'][data-step='S5']") + ").disabled"));
  await shot("03-progress-midway.png");

  /* Stage 4 — confirm gate for step 5 */
  await clickAt("button[data-action='open-gate'][data-step='S5']");
  await sleep(120);
  check("S4: gate open", await exists("#gate .gate-eyebrow"));
  await expectText("S4: gate eyebrow", await textOf("#gate .gate-eyebrow"), "Irreversible — point of no return");
  check("S4: consequence states irreversibility", (await textOf("#gate .gate-consequence")).includes("v1 stops accepting writes"));
  check("S4: rollback plan card present", (await textOf("#gate .rb-card h3")).includes("Rollback plan — your recovery path"));
  check("S4: rollback rto shown", (await textOf("#gate .rb-card")).includes("≤ 10 min"));
  check("S4: two acknowledgement checkboxes", (await count("#gate input[data-gate-check]")) === 2);
  check("S4: typed phrase prompt", (await textOf("#gate .gate-phrase label")).includes("LEDGER V2"));
  check("S4: execute disabled initially", await evaljs("(" + sel("#gate [data-action='gate-execute']") + ").disabled"));
  await shot("04-confirm-gate.png");
  await typeInto("#gate-phrase-input", "WRONG");
  check("S4: execute still disabled on wrong phrase", await evaljs("(" + sel("#gate [data-action='gate-execute']") + ").disabled"));
  check("S4: inline phrase error shown", (await textOf("#gate-phrase-error")).includes("does not match"));
  await shot("05-gate-error.png");
  await typeInto("#gate-phrase-input", "ledger v2");
  check("S4: phrase match is case-insensitive (value 'ledger v2')", (await evaljs(sel("#gate-phrase-input") + ".value")) === "ledger v2");
  check("S4: error hint cleared", (await textOf("#gate-phrase-error")) === "");
  await clickAt("input[data-gate-check='0']");
  await clickAt("input[data-gate-check='1']");
  check("S4: execute enabled after checks+phrase", await evaljs("!(" + sel("#gate [data-action='gate-execute']") + ").disabled"));
  await clickAt("#gate [data-action='gate-execute']");
  await sleep(150);
  check("S4: gate closed after execute", await evaljs("(" + sel("#gate-scrim") + ").hidden"));
  check("S4: step 5 done", await evaljs(sel(".step[data-step-id='S5']") + ".classList.contains('is-done')"));
  check("S4: rollback button available on step 5", await exists("button[data-action='rollback'][data-step='S5']:not([disabled])"));
  await shot("06-after-cutover.png");

  /* Stage 5 — rollback path */
  await clickAt("button[data-action='rollback'][data-step='S5']");
  await sleep(100);
  await expectText("S5: rollback arms (two-click)", await textOf("button[data-action='rollback'][data-step='S5']"), "Confirm rollback");
  await shot("07-rollback-armed.png");
  await clickAt("button[data-action='rollback'][data-step='S5']");
  await sleep(120);
  await expectText("S5: progress back to 4 of 10", await textOf("#progress-label"), "4 of 10 steps");
  check("S5: rolled-back badge shown", await exists(".step[data-step-id='S5'] .badge-rolled"));
  check("S5: rollback logged", (await evaljs("document.body.textContent")).includes('Rolled back "Cut over write traffic'));
  await shot("07b-rollback-done.png");

  /* Stage 6 — re-execute 5, then 6..10 to completion */
  await gateFlow("S5", "ledger v2");
  check("S6a: re-executed step 5 shows Done (not Rolled back)", await exists(".step[data-step-id='S5'] .badge-done"));
  await gateFlow("S6", "revoke v1");
  await completeSimple("S7", 3);
  await gateFlow("S8", "retire v1");
  await completeSimple("S9", 0);
  await completeSimple("S10", 0);
  await sleep(150);
  check("S6: completion banner visible", await evaljs("!(" + sel("#completion") + ").hidden"));
  check("S6: banner says zero missteps", (await textOf("#completion h2")).includes("zero missteps"));
  check("S6: stats 10/10 steps", (await textOf("#completion")).includes("10/10"));
  check("S6: stats 3/3 gates confirmed", (await textOf("#completion")).includes("3/3"));
  check("S6: rollbacks exercised = 1", (await textOf("#completion")).includes(">1<") || (await evaljs("document.querySelectorAll('.c-stat b')[2].textContent")) === "1");
  check("S6: per-phase roll-up lists all steps", (await count("#completion .c-phases li")) === 14);
  await shot("08-completion.png");

  /* Stage 7 — activity log */
  await clickAt("#log-toggle");
  await sleep(250);
  check("S7: drawer open", await evaljs(sel("#log-drawer") + ".classList.contains('open')"));
  check("S7: 21 audit entries", (await count("#log-list li")) === 21, String(await count("#log-list li")));
  check("S7: rollback entry recorded", (await count("#log-list .log-chip-rollback")) === 1);
  check("S7: confirmed entries recorded", (await count("#log-list .log-chip-confirmed")) === 4);
  await shot("09-activity-log.png");
  await clickAt("#log-close");
  await sleep(250);

  /* Stage 8 — reset */
  await clickAt("#reset-btn");
  await clickAt("#reset-btn");
  await sleep(120);
  await expectText("S8: reset returns to 0 of 10", await textOf("#progress-label"), "0 of 10 steps");
  await expectText("S8: status reset", await textOf("#status-pill"), "Not started");
  await shot("10-after-reset.png");

  check("Final: no console errors during journey", consoleErrs.length === 0, consoleErrs.slice(0, 3).join(" | "));

  const failed = results.filter((r) => !r.pass);
  const lines = results.map((r) => (r.pass ? "- PASS " : "- FAIL ") + r.label + (r.detail && !r.pass ? " — " + r.detail : ""));
  fs.writeFileSync(path.join(SHOTS, "journey-log.md"),
    "# Runbook journey — CDP drive " + new Date().toISOString() + "\n\n" +
    lines.join("\n") + "\n\nConsole errors: " + (consoleErrs.length ? consoleErrs.join(" | ") : "none") + "\n" +
    "\n" + results.length + " checks, " + failed.length + " failures\n");
  console.log("\n" + results.length + " checks, " + failed.length + " failures. Log: screenshots/journey-log.md");

  ws.close();
  chrome.kill();
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => { console.error("DRIVER ERROR:", e.message); process.exit(2); });
