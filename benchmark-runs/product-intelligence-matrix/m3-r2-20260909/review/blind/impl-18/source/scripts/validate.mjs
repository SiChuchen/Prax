/* 真实浏览器验证：CDP 驱动 Chrome，全程真实交互 + 截图取证
   用法：node scripts/validate.mjs  */
import { spawn } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 9333;
const PAGE_URL = "file:///" + resolve("index.html").replace(/\\/g, "/");
const OUT = resolve("evidence");
mkdirSync(OUT, { recursive: true });

const results = [];
function assert(name, cond, extra) {
  results.push({ name, pass: !!cond, extra: extra || "" });
  console.log((cond ? "PASS  " : "FAIL  ") + name + (extra ? "  -> " + extra : ""));
  return !!cond;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------- 启动浏览器 ---------- */
function launchBrowser() {
  const exe = CHROME;
  const args = [
    "--headless=new", `--remote-debugging-port=${PORT}`, "--remote-allow-origins=*",
    "--user-data-dir=" + resolve(".chrome-tmp"), "--no-first-run", "--no-default-browser-check",
    "--disable-gpu", "--window-size=1440,900", "about:blank"
  ];
  return spawn(exe, args, { stdio: "ignore" });
}

async function waitForDevtools() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const list = await r.json();
      const page = list.find((t) => t.type === "page");
      if (page) return page.webSocketDebuggerUrl;
    } catch { /* retry */ }
    await sleep(300);
  }
  throw new Error("DevTools endpoint not reachable");
}

/* ---------- 极简 CDP 客户端 ---------- */
function connectCDP(url) {
  return new Promise((res, rej) => {
    const ws = new WebSocket(url);
    let id = 0;
    const pending = new Map();
    const events = [];
    const consoleLogs = [];
    ws.onopen = () => res({
      send(method, params = {}) {
        return new Promise((resolve2, reject2) => {
          const mid = ++id;
          pending.set(mid, { resolve2, reject2 });
          ws.send(JSON.stringify({ id: mid, method, params }));
        });
      },
      on(fn) { events.push(fn); },
      consoleLogs,
      close() { ws.close(); }
    });
    ws.onerror = rej;
    ws.onmessage = (msg) => {
      const data = JSON.parse(msg.data);
      if (data.id && pending.has(data.id)) {
        const p = pending.get(data.id);
        pending.delete(data.id);
        if (data.error) p.reject2(new Error(data.error.message)); else p.resolve2(data.result);
      } else if (data.method) {
        events.forEach((fn) => fn(data));
        if (data.method === "Runtime.exceptionThrown")
          consoleLogs.push("EXCEPTION: " + JSON.stringify(data.params.exceptionDetails?.exception?.description || data.params));
        if (data.method === "Log.entryAdded" && ["error", "warning"].includes(data.params.entry.level))
          consoleLogs.push(data.params.entry.level.toUpperCase() + ": " + data.params.entry.text);
        if (data.method === "Runtime.consoleAPICalled" && data.params.type === "error")
          consoleLogs.push("console.error: " + data.params.args.map((a) => a.value || a.description).join(" "));
      }
    };
  });
}

async function main() {
  const proc = launchBrowser();
  _proc = proc;
  const wsUrl = await waitForDevtools();
  const cdp = await connectCDP(wsUrl);

  const evaljs = async (expr) => {
    const r = await cdp.send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error("page eval error: " + JSON.stringify(r.exceptionDetails));
    return r.result.value;
  };
  const shot = async (name) => {
    const r = await cdp.send("Page.captureScreenshot", { format: "png" });
    writeFileSync(resolve(OUT, name), Buffer.from(r.data, "base64"));
    console.log("SHOT  evidence/" + name);
  };
  cdp.on((d) => { /* events already collected in connectCDP */ });

  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Log.enable");
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

  const loaded = new Promise((r) => {
    const iv = setInterval(() => {}, 1e9);
    cdp.on((d) => { if (d.method === "Page.loadEventFired") { clearInterval(iv); r(); } });
  });
  cdp.send("Page.navigate", { url: PAGE_URL }).catch(() => {});
  await Promise.race([loaded, sleep(8000)]);
  await sleep(500);

  /* ---------- 值映射：证据字段 ---------- */
  const EV = {
    alarm_id: "ALERT-8842", commander: "王值班", freeze_time: "14:30", notice_channel: "群公告",
    replica_lag: "180", decision_reason: "两次采样复制延迟 320s→180s，无收敛趋势，判定主库 10 分钟内不可恢复",
    snapshot_id: "snap-20260916-1430", gtid: "3E11FA47-71BA-11E6:1-8842",
    fence_operator: "李操作", fence_time: "15:02", promoted_host: "db-05", promote_operator: "李操作",
    cutover_time: "15:18", change_no: "CHG-2026-0916-07", probe_ms: "12", smoke_ticket: "ST-0916-114",
    observe_start: "15:26", retro_doc: "RETRO-20260916", rebuild_owner: "王值班"
  };
  const esc = (s) => s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");

  async function fillStep(i, decisionId) {
    await evaljs(`(async () => {
      const cards = [...document.querySelectorAll('#work-body .rail-step')];
      return cards.length;
    })()`);
    await evaljs(`(() => {
      const st = window.__appProbe ? null : null;
      // 勾选全部检查项
      document.querySelectorAll('#work-body .check-item input[data-field="check"]').forEach(cb => {
        if (!cb.checked) { cb.checked = true; cb.dispatchEvent(new Event('change', { bubbles: true })); }
      });
      // 填写证据字段
      document.querySelectorAll('#work-body [data-field="ev"]').forEach(el => {
        const fid = el.getAttribute('data-fid');
        const v = ${JSON.stringify(EV)}[fid] || '';
        el.value = v;
        el.dispatchEvent(new Event('input', { bubbles: true }));
      });
      // 决策分支
      const dec = ${decisionId ? "'" + decisionId + "'" : "null"};
      if (dec) {
        const radio = document.querySelector('#work-body input[data-field="decision"][data-oid="' + dec + '"]');
        if (radio) { radio.checked = true; radio.dispatchEvent(new Event('change', { bubbles: true })); }
      }
    })()`);
  }
  async function clickActionBar() {
    await evaljs(`(() => {
      const bar = document.querySelector('#work-body .action-bar');
      const btn = bar.querySelector('button');
      if (btn.disabled) throw new Error('gate button still disabled');
      btn.click();
    })()`);
  }
  async function confirmIrreversible(word) {
    await evaljs(`(() => {
      document.querySelector('#work-body .action-bar button').click();
    })()`);
    await sleep(120);
    const open = await evaljs(`!document.getElementById('modal-overlay').hidden`);
    if (!open) throw new Error("confirm modal did not open");
    await evaljs(`(() => {
      const w = document.getElementById('modal-word');
      w.value = '${esc(word)}';
      w.dispatchEvent(new Event('input', { bubbles: true }));
      const ack = document.getElementById('modal-ack');
      ack.checked = true; ack.dispatchEvent(new Event('change', { bubbles: true }));
    })()`);
    await sleep(80);
    await evaljs(`document.querySelector('#modal [data-act="do-confirm"]').click()`);
    await sleep(120);
  }

  /* ========== 场景 A：首屏即就绪 ========== */
  const t0 = Date.now();
  const ready = await evaljs(`(() => ({
    title: document.getElementById('runbook-title').textContent,
    railSteps: document.querySelectorAll('#rail-body .rail-step').length,
    currentBtn: !!document.querySelector('#rail-body .rail-step.active'),
    badge: document.getElementById('deviation-badge').textContent,
    progress: document.getElementById('progress-text').textContent,
    workTitle: document.querySelector('#work-body h1') ? document.querySelector('#work-body h1').textContent : '',
    loadState: document.readyState
  }))()`);
  assert("首屏就绪：标题正确", ready.title.includes("哨兵 Runbook"), ready.title);
  assert("首屏就绪：13 个步骤全部渲染", ready.railSteps === 13, String(ready.railSteps));
  assert("首屏就绪：当前步高亮 s1", ready.currentBtn && ready.workTitle.startsWith("1."), ready.workTitle);
  assert("首屏就绪：零偏差徽标", ready.badge === "零偏差", ready.badge);
  assert("首屏就绪：无加载态", ready.loadState === "complete" && ready.progress === "0 / 13 步", ready.progress);
  console.log("TIMING load->probe " + (Date.now() - t0) + "ms");
  await shot("01-ready-first-screen.png");

  /* ========== 场景 B：门禁拦截 ========== */
  let g = await evaljs(`document.querySelector('#work-body .action-bar button').disabled`);
  assert("门禁：空状态下放行按钮禁用", g === true);
  // 部分填写（s2 用于格式错误演示，先完成 s1）
  await fillStep(0);
  await clickActionBar();
  await sleep(100);
  // s2：故意填错时间格式 → 错误态
  await evaljs(`(() => {
    const el = document.querySelector('#work-body [data-fid="freeze_time"]');
    el.value = '1430';
    el.dispatchEvent(new Event('input', { bubbles: true }));
    document.querySelectorAll('#work-body .check-item input').forEach(cb => { cb.checked = true; cb.dispatchEvent(new Event('change', { bubbles: true })); });
  })()`);
  await sleep(100);
  const errState = await evaljs(`(() => ({
    invalid: !!document.querySelector('#work-body .field input.invalid'),
    errText: (document.querySelector('[data-err-for="freeze_time"]') || {}).textContent || '',
    btnDisabled: document.querySelector('#work-body .action-bar button').disabled,
    hint: (document.querySelector('.gate-hint') || {}).textContent || ''
  }))()`);
  assert("错误态：非法格式触发行内错误", errState.invalid && errState.errText.includes("格式"), errState.errText);
  assert("门禁：格式错误时保持禁用", errState.btnDisabled === true, errState.hint);
  await shot("02-evidence-error-state.png");
  await fillStep(1); // 修正为 14:30 并补齐
  g = await evaljs(`!document.querySelector('#work-body .action-bar button').disabled`);
  assert("门禁：证据合法后放行按钮启用", g === true);
  await clickActionBar();

  /* ========== 场景 C：决策门（s5 failover）+ 常规步骤 s3、s4 ========== */
  await fillStep(2); await clickActionBar(); await sleep(80);
  await fillStep(3); await clickActionBar(); await sleep(80);
  const s5 = await evaljs(`document.querySelector('#work-body h1').textContent`);
  assert("顺序门禁：逐步放行后到达 s5 决策门", s5.includes("决策门"), s5);
  await shot("03-decision-gate.png");
  await fillStep(4, "failover");
  await clickActionBar(); await sleep(80);

  /* ========== 场景 D：不可逆确认仪式（s7 FENCE）========== */
  await fillStep(5); await clickActionBar(); await sleep(80); // s6
  const s7title = await evaljs(`document.querySelector('#work-body h1').textContent`);
  assert("到达 s7 不可逆步骤", s7title.includes("隔离旧主库"), s7title);
  const irrPanel = await evaljs(`!!document.querySelector('#work-body .recovery-panel') && !!document.querySelector('#work-body .consequence-block')`);
  assert("不可逆三件套：后果 + 恢复路径在执行前常驻可见", irrPanel === true);
  await shot("04-irreversible-step-with-recovery.png");

  // s7 本步的门禁先满足（检查项+证据），确认仪式入口才可用——门禁对不可逆步骤同样生效
  await fillStep(6);
  const s7gate = await evaljs(`!document.querySelector('#work-body .action-bar button').disabled`);
  assert("门禁：不可逆步骤同样受检查项/证据门禁约束", s7gate === true);
  await evaljs(`document.querySelector('#work-body .action-bar button').click()`);
  await sleep(150);
  let m = await evaljs(`(() => { const o=document.getElementById('modal-overlay'); return { open: !o.hidden, title: document.querySelector('#modal h2').textContent, hasRecovery: !!document.querySelector('#modal .recovery-panel'), word: (document.querySelector('#modal .word-field code')||{}).textContent }; })()`);
  assert("确认仪式：模态打开且含恢复路径与确认词", m.open && m.hasRecovery && m.word === "FENCE", JSON.stringify(m));
  await shot("05-confirm-modal.png");

  // 错误确认词
  await evaljs(`(() => { const w=document.getElementById('modal-word'); w.value='REMOVE'; w.dispatchEvent(new Event('input',{bubbles:true})); })()`);
  await sleep(80);
  m = await evaljs(`(() => ({ err: document.getElementById('modal-error').textContent, disabled: document.querySelector('#modal [data-act="do-confirm"]').disabled }))()`);
  assert("确认仪式：错误确认词被拦截并提示", m.err.includes("不匹配") && m.disabled, m.err);
  await shot("06-confirm-modal-wrong-word.png");

  await confirmIrreversible("FENCE");
  const after7 = await evaljs(`(() => ({ modalClosed: document.getElementById('modal-overlay').hidden, current: document.querySelector('#work-body h1').textContent, rail: [...document.querySelectorAll('#rail-body .rail-step')].map(b=>b.className.includes('done'))[6] }))()`);
  assert("s7 放行：确认词核验后模态关闭并前进", after7.modalClosed && after7.current.includes("提升从库"), after7.current);

  /* ========== 场景 E：恢复路径触发（s8 PROMOTE 后回退）========== */
  await fillStep(6); await confirmIrreversible("PROMOTE");
  // s8 已完成 → 回看 s8 并触发恢复
  await evaljs(`document.querySelectorAll('#rail-body .rail-step')[7].click()`);
  await sleep(100);
  const recov = await evaljs(`(() => ({ readonly: !!document.querySelector('#work-body .readonly-banner'), btn: !!document.querySelector('[data-act="recover-arm"]') }))()`);
  assert("恢复路径：已完成步骤可回看且出现触发入口", recov.readonly && recov.btn);
  await evaljs(`document.querySelector('[data-act="recover-arm"]').click()`);
  await sleep(100);
  await shot("07-recovery-armed.png");
  await evaljs(`document.querySelector('[data-act="recover-fire"]').click()`);
  await sleep(120);
  const afterRec = await evaljs(`(() => ({ badge: document.getElementById('deviation-badge').textContent, current: document.querySelector('#work-body h1').textContent, btnEnabled: !document.querySelector('#work-body .action-bar button').disabled }))()`);
  assert("恢复触发：偏差徽标变为 ×1", afterRec.badge.includes("×1"), afterRec.badge);
  assert("恢复触发：s8 回退为当前待执行", afterRec.current.includes("提升从库"), afterRec.current);
  await shot("08-recovery-deviation.png");
  // 重新走 s8
  await fillStep(6); await confirmIrreversible("PROMOTE");

  /* ========== 场景 F：走完全程（含偏差完成报告）========== */
  await fillStep(8); await confirmIrreversible("CUTOVER");   // s9
  await fillStep(9); await clickActionBar();                  // s10
  await fillStep(10); await clickActionBar();                 // s11
  await fillStep(11); await clickActionBar();                 // s12
  await fillStep(12, "rebuild"); await clickActionBar();      // s13
  await sleep(150);
  const report = await evaljs(`(() => ({ verdict: document.querySelector('.report-hero h1').textContent, stats: [...document.querySelectorAll('.stat-tile')].map(t=>t.textContent.replace(/\\s+/g,' ')), timeline: document.querySelectorAll('.timeline li').length }))()`);
  assert("完成报告：出现偏差完成判定", report.verdict.includes("1 次偏差"), report.verdict);
  assert("完成报告：时间线留痕", report.timeline >= 15, String(report.timeline));
  await shot("09-completion-with-deviation.png");

  // 审计抽屉
  await evaljs(`document.getElementById('btn-audit').click()`);
  await sleep(100);
  const drawer = await evaljs(`(() => ({ open: !document.getElementById('audit-drawer').hidden, events: document.querySelectorAll('.drawer-event').length }))()`);
  assert("审计抽屉：全程事件留痕", drawer.open && drawer.events >= 15, String(drawer.events));
  await shot("10-audit-drawer.png");
  await evaljs(`document.getElementById('btn-drawer-close').click()`);

  /* ========== 场景 G：重置后零偏差全程 ========== */
  await evaljs(`document.querySelector('[data-act="reset"]').click()`);
  await sleep(100);
  await evaljs(`(() => { const a=document.getElementById('modal-ack'); a.checked=true; a.dispatchEvent(new Event('change',{bubbles:true})); })()`);
  await evaljs(`document.querySelector('#modal [data-act="do-reset"]').click()`);
  await sleep(120);
  const resetState = await evaljs(`(() => ({ badge: document.getElementById('deviation-badge').textContent, title: document.querySelector('#work-body h1').textContent }))()`);
  assert("重置：回到零偏差就绪态", resetState.badge === "零偏差" && resetState.title.includes("成立应急响应"), JSON.stringify(resetState));

  // 键盘可达性：Tab 聚焦应可见（原生控件）
  for (let k = 0; k < 3; k++) {
    await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
    await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
    await sleep(40);
  }
  const kb = await evaljs(`(() => { const a = document.activeElement; return { tag: a.tagName, cls: a.className, visibleFocus: a === document.activeElement }; })()`);
  assert("键盘：Tab 可聚焦原生控件", ["INPUT", "BUTTON", "CHECKBOX"].includes(kb.tag) || kb.tag === "INPUT", JSON.stringify(kb));
  await shot("11-keyboard-focus.png");

  // 全程无偏差完成
  const order = [
    [0, null], [1, null], [2, null], [3, null], [4, "failover"], [5, null],
    [6, null], [7, null], [8, null], [9, null], [10, null], [11, null], [12, "rebuild"]
  ];
  for (const [i, dec] of order) {
    const cur = await evaljs(`document.querySelector('#work-body h1').textContent`);
    const idxNow = await evaljs(`(() => { const m = document.querySelector('#work-body h1').textContent; return parseInt(m, 10) - 1; })()`);
    await fillStep(idxNow, dec);
    const isIrr = await evaljs(`!!document.querySelector('#work-body .action-bar button.btn-danger') && document.querySelector('#work-body .action-bar button').textContent.includes('不可逆')`);
    if (isIrr) {
      const w = await evaljs(`document.querySelector('#modal-overlay').hidden ? (document.querySelector('#work-body .action-bar button').click(), null) : null`);
      await sleep(120);
      const word = await evaljs(`(document.querySelector('#modal .word-field code')||{}).textContent`);
      await confirmIrreversible(word);
    } else {
      await clickActionBar();
    }
    await sleep(80);
  }
  const final = await evaljs(`(() => ({ verdict: document.querySelector('.report-hero h1').textContent, badge: document.getElementById('deviation-badge').textContent }))()`);
  assert("零失误完成：最终判定为零偏差完成", final.verdict.includes("零失误走完全程"), final.verdict);
  assert("零失误完成：全程零偏差徽标", final.badge === "零偏差", final.badge);
  await shot("12-completion-zero-deviation.png");

  /* ---------- 汇总 ---------- */
  const errors = cdp.consoleLogs;
  assert("无控制台错误 / 页面异常", errors.length === 0, errors.join(" | ").slice(0, 300));

  const failed = results.filter((r) => !r.pass);
  console.log("\n==== SUMMARY: " + (results.length - failed.length) + "/" + results.length + " passed ====");
  cdp.close();
  proc.kill();
  process.exit(failed.length ? 1 : 0);
}

let _proc = null;
main().then(() => { if (_proc) _proc.kill(); }).catch((e) => { console.error("FATAL", e); if (_proc) _proc.kill(); process.exit(2); });
