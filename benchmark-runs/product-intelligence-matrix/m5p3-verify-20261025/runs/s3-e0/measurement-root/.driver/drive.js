/* Drive Gatepass end-to-end with a real browser (Edge via playwright-core). */
const { chromium } = require("playwright-core");
const fs = require("fs");

const APP = "http://127.0.0.1:3000/";
const OUT = "E:/codex-prj/ab-worktrees/pi-matrix-m5p3/s3-e0/evidence";
const results = [];
const consoleErrors = [];
function check(id, ok, note) { results.push({ id, ok, note }); console.log((ok ? "PASS" : "FAIL") + "  " + id + (note ? " — " + note : "")); }

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({
    executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on("pageerror", e => consoleErrors.push("pageerror: " + e.message));
  page.on("console", m => { if (m.type() === "error") consoleErrors.push("console: " + m.text()); });

  const tickAll = async (gid, n) => { for (let i = 0; i < n; i++) await page.check(`#ck-${gid}-${i}`); };
  const verify = async (gid, val) => { await page.fill(`#vf-${gid}`, val); await page.click(`button[data-verify="${gid}"]`); };
  const executeIrrev = async (phrase) => {
    await page.click("#execute-btn");
    await page.waitForSelector("#confirm_modal.open");
    await page.fill("#m-phrase", phrase);
    check("modal-enables-on-phrase " + phrase, await page.locator("#m-execute").isEnabled());
    await page.click("#m-execute");
    await page.waitForSelector("#confirm_modal.open", { state: "detached" });
  };

  async function doStep(spec) {
    // spec: {boxes:[[gid,n]], values:[[gid,val]], action:'complete'|'execute', phrase}
    for (const [gid, n] of (spec.boxes || [])) await tickAll(gid, n);
    if (spec.values && spec.values.length) {
      // check A: action must be disabled while a value gate is unverified
      const actDisabled = await page.locator("#complete-btn, #execute-btn").isDisabled();
      check("A:action-blocked-before-gates (" + spec.name + ")", actDisabled === true);
      for (const [gid, val] of spec.values) await verify(gid, val);
    }
    if (spec.action === "complete") { await page.click("#complete-btn"); }
    else { await executeIrrev(spec.phrase); }
    await page.click("#advance-btn");
    await page.waitForTimeout(150);
  }

  /* ---------------- RUN 1 (one deliberate failure) ---------------- */
  await page.goto(APP, { waitUntil: "load" });
  await page.waitForTimeout(300);
  await page.screenshot({ path: OUT + "/s01-first-paint.png" });

  // first paint usable: step 1 current, no loading UI
  const crumb = await page.textContent(".crumb");
  check("first-paint-ready", /Phase 1/.test(crumb) && (await page.locator(".step-row.current").count()) === 1, crumb.trim());
  check("no-loading-state", (await page.locator("#app-loading, .loading, .spinner").count()) === 0);

  // keyboard focus evidence: first Tab lands on the current step row; locked rows are skipped
  await page.keyboard.press("Tab");
  await page.waitForTimeout(100);
  await page.screenshot({ path: OUT + "/s08-keyboard-focus.png" });
  const focusCls = await page.evaluate(() => document.activeElement && document.activeElement.className);
  check("keyboard-focus-reaches-rail", typeof focusCls === "string" && focusCls.includes("step-row"), focusCls);

  // B: locked step click → deny shake, no navigation
  await page.click('.step-row[data-step="s11"]', { force: true });
  const denied = await page.evaluate(() => document.querySelector('.step-row[data-step="s11"]').classList.contains("deny"));
  const still1 = (await page.textContent(".crumb")).includes("Phase 1");
  check("B:locked-step-click-denied", denied && still1);
  await page.screenshot({ path: OUT + "/s07-locked-steps.png" });

  // steps 1–5
  await doStep({ name: "s1", boxes: [["g1a", 3]], values: [["g1b", "9f3ce21"]], action: "complete" });
  await doStep({ name: "s2", boxes: [["g2a", 3]], action: "complete" });
  await doStep({ name: "s3", boxes: [["g3a", 2]], action: "complete" });
  await doStep({ name: "s4", boxes: [["g4a", 2]], values: [["g4b", "bk-1025-0930"]], action: "complete" });
  await doStep({ name: "s5", boxes: [["g5a", 3]], action: "complete" });

  // C: modal cancel is safe (on step 6)
  await tickAll("g6a", 2); await verify("g6b", "1,048,320");
  await page.click("#execute-btn");
  await page.waitForSelector("#confirm_modal.open");
  await page.click("#m-cancel");
  await page.waitForSelector("#confirm_modal.open", { state: "detached" });
  const auditTxt1 = await page.evaluate(() => S.audit.map(e => e.html.replace(/<[^>]+>/g, "")).join(" | "));
  check("C:cancel-safe", auditTxt1.includes("Confirmation cancelled — no action taken"), "overlay closed, audit entry present");
  // now really execute s6
  await page.click("#execute-btn");
  await page.waitForSelector("#confirm_modal.open");
  await page.fill("#m-phrase", "MIGRATE DB-PROD-1");
  check("modal-enables-on-phrase", await page.locator("#m-execute").isEnabled());
  await page.screenshot({ path: OUT + "/s02-confirm-modal.png" });
  await page.click("#m-execute");
  await page.waitForSelector("#confirm_modal.open", { state: "detached" });
  await page.click("#advance-btn");

  // s7 with undo window
  await doStep({ name: "s7", boxes: [["g7a", 2]], values: [["g7b", "0.02%"]], action: "execute", phrase: "PROMOTE 2.4.0" });
  // after advance we are on s8; go back to s7 view for the undo banner shot
  await page.click('.step-row[data-step="s7"]');
  await page.waitForSelector("#undo-clock");
  const clockTxt = await page.textContent("#undo-clock");
  check("undo-window-open", /^\d+:\d\d$/.test(clockTxt.trim()), "clock=" + clockTxt.trim());
  await page.screenshot({ path: OUT + "/s03-undo-window.png" });
  await page.click("#back-current");

  // s8 with deliberate failure → contingency
  await page.fill("#vf-g8a", "0.9%");
  await page.click('button[data-verify="g8a"]');
  await page.waitForSelector(".contingency");
  const failChip = await page.textContent(".gate-state.fail");
  check("fail-reveals-contingency", !!failChip && (await page.locator(".contingency").count()) === 1, "chip=" + failChip.trim());
  await page.screenshot({ path: OUT + "/s04-contingency.png" });
  await verify("g8a", "0.03%");
  await verify("g8b", "287");
  await tickAll("g8c", 2);
  await page.click("#complete-btn"); await page.click("#advance-btn");

  await doStep({ name: "s9", boxes: [["g9a", 2]], action: "execute", phrase: "RETIRED 2.3.9" });
  await doStep({ name: "s10", boxes: [["g10a", 3]], action: "complete" });
  await tickAll("g11a", 3);
  await page.click("#complete-btn");
  await page.click("#finish-btn");
  await page.waitForSelector(".complete-card");
  const stats = await page.evaluate(() => Array.from(document.querySelectorAll(".stat")).map(s => s.textContent.replace(/\s+/g, " ").trim()));
  check("run1-completion-shows-1-failed-check", stats.some(s => s.startsWith("1") && s.includes("FAILED")), stats.join(" ; "));
  await page.screenshot({ path: OUT + "/s05-completion-with-warnings.png" });

  // D: audit ordering sanity (across run 1)
  const auditDump = await page.evaluate(() => S.audit.map(e => e.t + " " + e.kind + " " + e.html.replace(/<[^>]+>/g, "")));
  const joined = auditDump.join("\n");
  const iChk = joined.indexOf("Checked —");
  const iGate = joined.indexOf("Gate passed —");
  const iVer = joined.indexOf("Verified —");
  const iConf = joined.indexOf("Typed confirmation matched");
  const iExec = joined.indexOf("Irreversible action executed");
  check("D:audit-ordered", iChk < iGate && iGate < iVer && iVer < iConf && iConf < iExec, "checked<gate<verified<confirmed<executed");
  check("D:audit-has-contingency-event", joined.includes("Verification FAILED"), "failed verification recorded");
  check("E:no-console-errors-run1", consoleErrors.length === 0, consoleErrors.slice(0, 3).join(" ; "));

  /* ---------------- RUN 2 (clean, incl. rollback drill) ---------------- */
  await page.click("#restart");
  await page.waitForTimeout(200);
  check("restart-resets", (await page.textContent(".crumb")).includes("Phase 1"));

  await doStep({ name: "r2s1", boxes: [["g1a", 3]], values: [["g1b", "9f3ce21"]], action: "complete" });
  await doStep({ name: "r2s2", boxes: [["g2a", 3]], action: "complete" });
  await doStep({ name: "r2s3", boxes: [["g3a", 2]], action: "complete" });
  await doStep({ name: "r2s4", boxes: [["g4a", 2]], values: [["g4b", "bk-1025-0930"]], action: "complete" });
  await doStep({ name: "r2s5", boxes: [["g5a", 3]], action: "complete" });
  await doStep({ name: "r2s6", boxes: [["g6a", 2]], values: [["g6b", "1,048,320"]], action: "execute", phrase: "MIGRATE DB-PROD-1" });
  await doStep({ name: "r2s7", boxes: [["g7a", 2]], values: [["g7b", "0.02%"]], action: "execute", phrase: "PROMOTE 2.4.0" });

  // F: rollback drill
  await page.click('.step-row[data-step="s7"]');
  await page.waitForSelector("#rollback-btn");
  await page.click("#rollback-btn");
  await page.waitForTimeout(200);
  const f = await page.evaluate(() => ({
    s7current: document.querySelector('.step-row[data-step="s7"]').classList.contains("current"),
    status: S.status.s7,
    auditHasRollback: S.audit.some(e => e.html.includes("Rolled back"))
  }));
  check("F:rollback-reverts", f.s7current && f.status === "pending" && f.auditHasRollback, JSON.stringify(f));
  await page.screenshot({ path: OUT + "/s09-rollback.png" });
  // re-execute
  await executeIrrev("PROMOTE 2.4.0");
  await page.click("#advance-btn");

  await doStep({ name: "r2s8", values: [["g8a", "0.03%"], ["g8b", "287"]], boxes: [["g8c", 2]], action: "complete" });
  await doStep({ name: "r2s9", boxes: [["g9a", 2]], action: "execute", phrase: "RETIRED 2.3.9" });
  await doStep({ name: "r2s10", boxes: [["g10a", 3]], action: "complete" });
  await tickAll("g11a", 3);
  await page.click("#complete-btn");
  await page.click("#finish-btn");
  await page.waitForSelector(".complete-card");
  const stats2 = await page.evaluate(() => Array.from(document.querySelectorAll(".stat")).map(s => s.textContent.replace(/\s+/g, " ").trim()));
  check("run2-zero-mistake", stats2.some(s => s.startsWith("0") && s.includes("FAILED")), stats2.join(" ; "));
  await page.screenshot({ path: OUT + "/s06-completion-zero-mistake.png" });
  check("E:no-console-errors-run2", consoleErrors.length === 0, consoleErrors.slice(0, 3).join(" ; "));

  await browser.close();
  const fails = results.filter(r => !r.ok);
  console.log("\n=== SUMMARY: " + (results.length - fails.length) + "/" + results.length + " checks passed ===");
  if (fails.length) { fails.forEach(f => console.log("FAILED: " + f.id + " — " + f.note)); process.exit(1); }
})().catch(e => { console.error("DRIVER ERROR:", e); process.exit(2); });
