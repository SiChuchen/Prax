// CDP 驱动脚本：在真实 Chrome 中走完发布流程并截图取证
// 用法：先启动 chrome --headless=new --remote-debugging-port=9333，再 node devtools/cdp-drive.mjs
import { writeFileSync, mkdirSync } from "node:fs";

const PORT = 9333;
const URL_TARGET = "file:///E:/codex-prj/ab-worktrees/pi-matrix-m5/s4-e1/index.html";
const OUT = "artifacts";
mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getPageTargetWs() {
  for (let attempt = 0; attempt < 20; attempt++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(URL_TARGET)}`, { method: "PUT" });
      if (res.ok) {
        const t = await res.json();
        return t.webSocketDebuggerUrl;
      }
    } catch { /* chrome not ready yet */ }
    await sleep(500);
  }
  throw new Error("could not create CDP target");
}

const wsUrl = await getPageTargetWs();
const ws = new WebSocket(wsUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

let msgId = 0;
const pending = new Map();
ws.onmessage = (ev) => {
  const data = JSON.parse(ev.data);
  if (data.id && pending.has(data.id)) {
    const { res, rej } = pending.get(data.id);
    pending.delete(data.id);
    data.error ? rej(new Error(data.error.message)) : res(data.result);
  }
};
function send(method, params = {}) {
  const id = ++msgId;
  return new Promise((res, rej) => {
    pending.set(id, { res, rej });
    ws.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error("eval failed: " + JSON.stringify(r.exceptionDetails.exception?.description || r.exceptionDetails.text));
  return r.result?.value;
}
async function shot(name) {
  await sleep(250);
  const r = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(`${OUT}/${name}`, Buffer.from(r.data, "base64"));
  console.log("shot:", name);
}
// 在页面上下文里点击（真实 DOM 事件）
const click = (sel) => evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(sel)});if(!el)throw new Error('not found: ${sel}');el.click();return true;})()`);
const clickAll = (sel) => evaluate(`(()=>{const els=[...document.querySelectorAll(${JSON.stringify(sel)})];els.forEach(e=>e.click());return els.length;})()`);
const typePhrase = (text, submitWrong = false) => evaluate(`(()=>{
  const input=document.querySelector('#phraseInput');
  input.focus();
  input.value=${JSON.stringify(text)};
  input.dispatchEvent(new Event('input',{bubbles:true}));
  ${submitWrong ? `input.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));` : ``}
  return input.value;
})()`);

await send("Page.enable");
await send("Runtime.enable");
await sleep(800); // 首屏同步渲染完成

// 01 首屏
await shot("01-initial-first-screen.png");

// 走到 s2（验证门）：完成 s1
await click('[data-sid="s1"]') && await click('[data-act="complete"]');
await sleep(150);
// s2：勾选全部断言 → 截图（按钮解锁，amber 提示转绿）
await clickAll('#detail input[data-check-idx]');
await shot("02-verification-gate-passed.png");
await click('[data-act="complete"]'); // 完成 s2
// s3、s4
await click('[data-act="complete"]');
await click('[data-act="complete"]');

// s5、s6（验证门）
await clickAll('#detail input[data-check-idx]'); await click('[data-act="complete"]');
await clickAll('#detail input[data-check-idx]'); await click('[data-act="complete"]');

// s7（验证门：备份）→ s8 不可逆
await clickAll('#detail input[data-check-idx]'); await click('[data-act="complete"]');
await sleep(150);
await shot("03-irreversible-step-card.png"); // s8 当前：风险横幅 + 恢复路径 + 确认门按钮

// 打开确认门 → 空短语按钮禁用
await click('[data-act="open-confirm"]');
await shot("04-confirm-modal.png");
// 错误短语 → Enter → 错误态
await typePhrase("MIGRATE-9999", true);
await shot("05-confirm-error-state.png");
// 正确短语 → 执行
await typePhrase("MIGRATE-0042");
await click('[data-act="confirm-exec"]');
await sleep(200);
await shot("06-after-irreversible-exec.png"); // s9 当前 + 日志含不可逆条目

// 回滚演示：选中 s8 → 恢复面板可执行
await click('[data-sid="s8"]');
await click('[data-act="recover"]');
await typePhrase("ROLLBACK");
await shot("07-recover-modal.png");
await click('[data-act="confirm-recover"]');
await sleep(200);
await shot("08-after-rollback.png"); // s8 回到当前待重做，日志含恢复条目

// 重做 s8 → 按真实顺序走到底（gate: 勾选+完成；normal: 完成；irreversible: 确认门）
async function passGate() { await clickAll('#detail input[data-check-idx]'); await click('[data-act="complete"]'); }
async function passNormal() { await click('[data-act="complete"]'); }
async function passIrreversible(phrase) {
  await click('[data-act="open-confirm"]');
  await typePhrase(phrase);
  await click('[data-act="confirm-exec"]');
  await sleep(200);
}
await passIrreversible("MIGRATE-0042"); // 重做 s8（第 2 次执行）
await passGate();            // s9 校验迁移后数据完整性
await passNormal();          // s10 部署灰度实例
await passGate();            // s11 观察灰度指标
await passIrreversible("CUTOVER-100"); // s12 全量切流
await passGate();            // s13 冒烟测试
await passGate();            // s14 稳定性观察
await passIrreversible("RETIRE-V269"); // s15 清理旧版本实例
await passNormal();          // s16 状态页与通知
await passNormal();          // s17 解冻并归档
await sleep(200);
await shot("09-done-hero.png");

// 断言最终状态
const final = await evaluate(`(()=>{
  const logItems=[...document.querySelectorAll('.log-item')].length;
  return {
    progress: document.querySelector('#progressText').textContent,
    logItems,
    hero: !!document.querySelector('.done-hero'),
    heroStats: [...document.querySelectorAll('.stat')].map(s=>s.textContent.trim()).join(' | ')
  };
})()`);
console.log("FINAL:", JSON.stringify(final, null, 2));
ws.close();
process.exit(0);
