// 键盘可操作性取证：真实 Tab / Space / Enter / Escape 按键事件（Input.dispatchKeyEvent）
import { writeFileSync, mkdirSync } from "node:fs";

const PORT = 9333;
const URL_TARGET = "file:///E:/codex-prj/ab-worktrees/pi-matrix-m5/s4-e1/index.html";
mkdirSync("artifacts", { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getPageTargetWs() {
  for (let i = 0; i < 20; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(URL_TARGET)}`, { method: "PUT" });
      if (res.ok) return (await res.json()).webSocketDebuggerUrl;
    } catch {}
    await sleep(500);
  }
  throw new Error("no CDP target");
}
const ws = new WebSocket(await getPageTargetWs());
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let msgId = 0;
const pending = new Map();
ws.onmessage = (ev) => {
  const d = JSON.parse(ev.data);
  if (d.id && pending.has(d.id)) {
    const { res, rej } = pending.get(d.id);
    pending.delete(d.id);
    d.error ? rej(new Error(d.error.message)) : res(d.result);
  }
};
const send = (method, params = {}) => new Promise((res, rej) => {
  const id = ++msgId;
  pending.set(id, { res, rej });
  ws.send(JSON.stringify({ id, method, params }));
});
const evaluate = async (expression) => {
  const r = await send("Runtime.evaluate", { expression, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || "eval failed");
  return r.result?.value;
};
async function key(keyName, code, vk, modifiers = 0) {
  await send("Input.dispatchKeyEvent", { type: "keyDown", key: keyName, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk, modifiers });
  await send("Input.dispatchKeyEvent", { type: "keyUp", key: keyName, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk, modifiers });
}
const tab = () => key("Tab", "Tab", 9);
const enter = () => key("Enter", "Enter", 13);
const space = () => key(" ", "Space", 32);
const escape = () => key("Escape", "Escape", 27);
async function shot(name) {
  await sleep(200);
  const r = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(`artifacts/${name}`, Buffer.from(r.data, "base64"));
  console.log("shot:", name);
}
const active = () => evaluate(`(()=>{const a=document.activeElement;return a?(a.tagName+'.'+(a.className||'')+' ['+(a.getAttribute&&a.getAttribute('data-act')||'')+'] "'+((a.textContent||a.value||'').trim().slice(0,18))+'"'):'none';})()`);

await send("Page.enable");
await send("Runtime.enable");
await sleep(800);

console.log("== Tab 序列（前 6 次真实 Tab 按键）==");
for (let i = 0; i < 6; i++) { await tab(); await sleep(60); console.log(`Tab#${i + 1} →`, await active()); }
await shot("10-keyboard-focus-ring.png"); // 焦点环可见

console.log("== 清单 roving tabindex：方向键移动选中（listbox 惯例）==");
await evaluate(`document.querySelector('.rail-item.selected').focus()`);
await key("ArrowDown", "ArrowDown", 40); await sleep(60);
console.log("ArrowDown →", await active());
await key("ArrowDown", "ArrowDown", 40); await sleep(60);
console.log("ArrowDown →", await active());
console.log("清单选中项 =", await evaluate(`document.querySelector('.rail-item.selected .step-title').textContent`));

console.log("== 验证门：键盘勾选（先回到并完成 s1，使 s2 的验证门成为当前步骤）==");
await evaluate(`document.querySelector('[data-sid="s1"]').click()`); // 重新选中 s1（方向键演示移走了视图）
await sleep(120);
await evaluate(`document.querySelector('[data-act="complete"]').click()`); // s1 完成（前置设置）
await sleep(120);
// 从当前焦点 Tab 到第一个 checkbox（描述转小写匹配 INPUT）
let guard = 0;
while (!((await active()).toLowerCase().includes("input")) && guard++ < 40) await tab();
console.log("聚焦到：", await active());
await space(); await sleep(80);
console.log("checkbox1 checked =", await evaluate(`document.querySelector('#detail input[data-check-idx]').checked`));
await shot("11-keyboard-gate-check.png");

console.log("== 前进到 s8（应用点击），再测不可逆确认门：键盘 Enter 打开，Esc 关闭 ==");
await evaluate(`(function drive(){
  function completeCurrent(){ document.querySelector('[data-act="complete"]').click(); }
  function passGate(){ document.querySelectorAll('#detail input[data-check-idx]').forEach(function(c){ if(!c.checked) c.click(); }); completeCurrent(); }
  passGate(); completeCurrent();     // s2, s3
  completeCurrent();                 // s4
  passGate(); passGate(); passGate();// s5, s6, s7
  return document.querySelector('.card-head h1').textContent;
})()`);
await sleep(150);
console.log("当前步骤 =", await evaluate(`document.querySelector('.card-head h1').textContent`));
// 纯键盘路径：真实 Tab 走到「打开确认门」按钮，再按 Enter
let g2 = 0;
while (!((await active()).includes('open-confirm')) && g2++ < 40) await tab();
console.log("聚焦到：", await active());
await enter();
await sleep(200);
console.log("Enter 后：焦点 =", await active(), "| 模态出现 =", await evaluate(`!!document.querySelector('.modal-overlay')`));
if (!(await evaluate(`!!document.querySelector('.modal-overlay')`))) {
  console.log("Enter 未触发按钮激活，尝试 Space 激活（按钮的原生键盘行为）…");
  await evaluate(`document.querySelector('[data-act="open-confirm"]').focus()`);
  await space();
  await sleep(200);
  console.log("Space 后模态出现 =", await evaluate(`!!document.querySelector('.modal-overlay')`));
}
await shot("12-keyboard-modal-open.png");
await escape();
await sleep(150);
console.log("Esc 后模态关闭 =", await evaluate(`!document.querySelector('.modal-overlay')`));
await shot("13-keyboard-modal-esc-closed.png");

ws.close();
process.exit(0);
