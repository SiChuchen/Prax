/*
 * a11y.focus_order 实测 + 0.2 测量回执生成。
 * 依据 prax-validator contracts：收据绑定实现树摘要（与 captureImplementation
 * 同算法：sha256("prax-static-tree-v1\0") + 排序条目 [path,size]+\0+content+\0）。
 */
const puppeteer = require("puppeteer-core");
const { createHash } = require("crypto");
const fs = require("fs");
const path = require("path");

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const URL = "file:///E:/codex-prj/ab-worktrees/pi-matrix-r2/cell-j09-s03-b/index.html";
const PROJECT_ROOT = "E:\\codex-prj\\ab-worktrees\\pi-matrix-r2\\cell-j09-s03-b";
const SESSION_DIR = path.join(PROJECT_ROOT, ".prax", "design", "sessions", "ds_20260915150653_a22fc0e1");
const EV_DIR = path.join(SESSION_DIR, "validation-evidence");
fs.mkdirSync(EV_DIR, { recursive: true });

const sha256File = p => createHash("sha256").update(fs.readFileSync(p)).digest("hex");
const EXCLUDED = new Set(["node_modules", ".git", ".prax", ".prax-state", "validation-evidence", "coverage", ".vite"]);
// 与 prax-validator measurement-binding.captureImplementation 完全一致的实现树摘要
function captureImplementation(root) {
  const hash = createHash("sha256").update("prax-static-tree-v1\0");
  let entries = 0, bytes = 0;
  (function visit(dir, prefix) {
    for (const name of fs.readdirSync(dir).sort()) {
      if (++entries > 50000) throw new Error("entry limit");
      if (EXCLUDED.has(name.toLowerCase()) || /\.(?:log|tmp|tsbuildinfo)$/i.test(name)) continue;
      const p = path.join(dir, name);
      const st = fs.lstatSync(p);
      if (st.isSymbolicLink()) throw new Error("symlink");
      if (st.isDirectory()) visit(p, `${prefix}${name}/`);
      else if (st.isFile()) {
        bytes += st.size;
        const content = fs.readFileSync(p);
        hash.update(JSON.stringify([`${prefix}${name}`, content.length]));
        hash.update("\0").update(content).update("\0");
      } else throw new Error("non-regular file");
    }
  })(root, "");
  return { digest: hash.digest("hex"), entries, bytes };
}

(async () => {
  // ── 1. 真实浏览器 Tab 焦点序走查 ──
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1680, height: 960 });
  await page.goto(URL, { waitUntil: "load" });
  await page.waitForSelector("#matrixBody tr");

  const focusables = await page.evaluate(() =>
    [...document.querySelectorAll('button:not([disabled]):not([style*="display:none"]), input:not([disabled]), [tabindex="0"]')]
      .filter(el => el.offsetParent !== null || el.closest("svg")).length);

  const stops = [];
  for (let i = 0; i < focusables + 6; i++) {
    await page.keyboard.press("Tab");
    const d = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return { tag: "body" };
      const pin = el.closest(".pin");
      if (pin) return { kind: "pin", id: pin.dataset.id };
      if (el.classList.contains("sel-btn")) return { kind: "sel-btn", id: el.dataset.id };
      if (el.classList.contains("commit")) return { kind: "commit", id: el.dataset.id };
      if (el.classList.contains("exclude")) return { kind: "exclude", id: el.dataset.id };
      if (el.type === "range") return { kind: "slider", crit: el.dataset.crit };
      if (el.id === "resetBtn") return { kind: "reset" };
      return { kind: el.tagName.toLowerCase(), id: el.id || el.className };
    });
    stops.push(d);
    if (d.tag === "body" && i > focusables) break;
    if (stops.length > 2 && JSON.stringify(stops[0]) === JSON.stringify(d)) break; // 回到第一个 → 一整圈完成
  }

  // 截取第一个循环：Tab 从最后控件回到 body 再进入首控件（Chromium 行为），
  // body 为瞬态停靠点，不计入循环；回到 stops[0] 即为一整圈。
  let cycleEnd = stops.findIndex((s, i) => i > 0 && JSON.stringify(s) === JSON.stringify(stops[0]));
  if (cycleEnd === -1) cycleEnd = stops.length;
  const cycle = stops.slice(0, cycleEnd).filter(s => s.tag !== "body");
  const pinOrder = cycle.filter(s => s.kind === "pin").map(s => s.id).join("");
  const colOrder = cycle.filter(s => ["sel-btn", "commit", "exclude"].includes(s.kind)).map(s => s.id).join("");
  const sliderCount = cycle.filter(s => s.kind === "slider").length;
  const uniqueStops = new Set(cycle.map(s => JSON.stringify(s))).size;
  const checks = {
    pin_order_is_ABCD: pinOrder === "ABCD",
    column_controls_left_to_right: colOrder === "AABBCCDD" || colOrder === ["A", "B", "C", "D"].map(id => id.repeat(3)).join(""),
    all_sliders_reachable: sliderCount === 14,
    cycle_matches_focusables: cycle.length === focusables,
    no_focus_trap: stops.some(s => s.tag === "body") || cycleEnd < stops.length, // 正常环绕/回到 body，未卡死
    reachability_full: uniqueStops === focusables,
  };
  const passed = Object.values(checks).every(Boolean);
  console.log("focus walk:", JSON.stringify({ focusables, stops: stops.length, pinOrder, sliderCount, uniqueStops, checks }, null, 2));
  await browser.close();

  // ── 2. 摘要与回执 ──
  const implRoot = fs.realpathSync(PROJECT_ROOT);
  const impl = captureImplementation(implRoot);
  const runJson = path.join(EV_DIR, "focus-order-run.json");
  const runData = { url: URL, viewport: { width: 1680, height: 960 }, focusables, stops, cycle_length: cycle.length, checks, passed,
    run_at: new Date().toISOString(), driver: "puppeteer-core (Chrome headless, new)" };
  fs.writeFileSync(runJson, JSON.stringify(runData, null, 2));

  const receipt = {
    receipt_version: "0.2",
    tool: { name: "prax-measure", version: "local-focus-walk-0.1" },
    target: { app_root: implRoot, base_url: URL, build_ref: null },
    run_at: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
    viewport_matrix: [{ width: 1680, height: 960, label: "desktop-large" }],
    checks: [{
      id: "a11y.focus_order",
      status: passed ? "pass" : "fail",
      severity: "error",
      subject: "index.html 全部可交互控件（地图 4 pin、矩阵 4×3 列控、14 权重滑杆）",
      measured: { focusables_total: focusables, tabstops_recorded: stops.length, pin_order: pinOrder,
        column_control_order: colOrder, sliders_reached: sliderCount, unique_stops: uniqueStops,
        checks, driver: runData.driver, script: ".evidence/measure-focus.js" },
      threshold: { pin_order: "ABCD", column_control_order: "left-to-right A..D", sliders: 14,
        focus_trap: false, full_reachability: true },
      evidence_refs: [
        { ref: "validation-evidence/focus-order-run.json", sha256: sha256File(runJson) },
        { ref: "validation-evidence/keyboard-results.json", sha256: sha256File(path.join(EV_DIR, "keyboard-results.json")) },
      ],
      supported_fixes: [],
    }],
    summary: { pass: passed ? 1 : 0, fail: passed ? 0 : 1, skipped: 0, warnings: 0 },
    binding: {
      run_id: `focus-walk-${Date.now()}`,
      entry: "/index.html",
      scenario: "decide × comparison-panel：选址决定——区位图与比较矩阵同屏，权重调整与落定决定全程驻留同屏",
      implementation: { root: implRoot, digest: impl.digest, kind: "static_tree" },
      session_id: "ds_20260915150653_a22fc0e1",
      contract_digests: {
        "screen.sdir.yaml": sha256File(path.join(SESSION_DIR, "screen.sdir.yaml")),
        "sdir-delta.yaml": null,
        "implementation-brief.yaml": sha256File(path.join(SESSION_DIR, "implementation-brief.yaml")),
      },
    },
    target_validation: { status: "valid", issues: [], readiness: "selector", ready_selector: "#matrixBody tr" },
  };
  const receiptPath = path.join(EV_DIR, "measure-focus.receipt.json");
  fs.writeFileSync(receiptPath, JSON.stringify(receipt, null, 2));
  console.log(`receipt written: ${receiptPath}`);
  console.log(`implementation digest: ${impl.digest.slice(0, 16)}… (entries=${impl.entries}, bytes=${impl.bytes})`);
  console.log(passed ? "A11Y.FOCUS_ORDER: PASS" : "A11Y.FOCUS_ORDER: FAIL");
  process.exit(passed ? 0 : 1);
})().catch(e => { console.error("SCRIPT ERROR:", e); process.exit(2); });
