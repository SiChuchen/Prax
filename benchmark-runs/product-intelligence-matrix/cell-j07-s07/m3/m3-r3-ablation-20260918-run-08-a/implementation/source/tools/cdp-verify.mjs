'use strict';
/* CDP live-browser verification for Locus · 落位画布.
 * Drives real Chrome (headless) over raw DevTools protocol — real trusted
 * key/mouse events, DOM assertions, screenshot capture. No external deps.
 */
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9333;
const URL_ = 'http://127.0.0.1:8321/index.html';
const prof = `${process.env.TEMP}\\cdp-prof-${Date.now()}`;

const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--hide-scrollbars',
  `--user-data-dir=${prof}`, `--remote-debugging-port=${PORT}`,
  '--window-size=1440,900', 'about:blank',
], { stdio: 'ignore' });

const sleep = ms => new Promise(r => setTimeout(r, ms));
async function findPage() {
  for (let i = 0; i < 60; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
      const p = list.find(t => t.type === 'page');
      if (p) return p;
    } catch {}
    await sleep(250);
  }
  throw new Error('CDP endpoint timeout');
}

const page = await findPage();
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

let mid = 0; const pending = new Map(); const errors = [];
ws.onmessage = ev => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); }
  else if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') errors.push(m.params.entry.text);
  else if (m.method === 'Runtime.exceptionThrown') errors.push(JSON.stringify(m.params.exceptionDetails.exception?.description || m.params));
};
const send = (method, params = {}) => new Promise(res => {
  const id = ++mid; pending.set(id, res);
  ws.send(JSON.stringify({ id, method, params }));
});
const evaljs = async expr =>
  (await send('Runtime.evaluate', { expression: expr, returnByValue: true }))?.result?.value;

await send('Runtime.enable'); await send('Log.enable'); await send('Page.enable');
await send('Page.navigate', { url: URL_ });
await sleep(1200);

/* ---------- helpers ---------- */
let pass = 0, fail = 0;
function check(name, cond, detail = '') {
  if (cond) { pass++; console.log(`PASS  ${name}${detail ? '  [' + detail + ']' : ''}`); }
  else { fail++; console.log(`FAIL  ${name}${detail ? '  [' + detail + ']' : ''}`); }
}
async function key(k, code, vk, { text, mods = 0, hold = false } = {}) {
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: k, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk, modifiers: mods, ...(text ? { text } : {}) });
  if (!hold) await send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk, modifiers: mods });
  await sleep(60);
}
async function shot(name) {
  const r = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(new URL(`../evidence/${name}`, import.meta.url), Buffer.from(r.data, 'base64'));
  console.log(`SHOT  evidence/${name}`);
}
const mouse = (type, x, y, p = {}) => send('Input.dispatchMouseEvent', {
  type, x, y, button: 'left',
  buttons: p.buttons ?? (type === 'mousePressed' || type === 'mouseMoved' ? 1 : 0),
  clickCount: p.clicks ?? 1,
});
async function drag(x0, y0, x1, y1) {
  await mouse('mousePressed', x0, y0, { buttons: 1 });
  for (let i = 1; i <= 6; i++) { await mouse('mouseMoved', x0 + (x1 - x0) * i / 6, y0 + (y1 - y0) * i / 6, { buttons: 1 }); await sleep(30); }
  await mouse('mouseReleased', x1, y1, { buttons: 0 });
  await sleep(80);
}
async function dblclick(x, y) {
  await mouse('mousePressed', x, y, { clicks: 1, buttons: 1 });
  await mouse('mouseReleased', x, y, { clicks: 1, buttons: 0 });
  await mouse('mousePressed', x, y, { clicks: 2, buttons: 1 });
  await mouse('mouseReleased', x, y, { clicks: 2, buttons: 0 });
  await sleep(120);
}
const objCount = () => evaljs(`document.querySelectorAll('.obj').length`);
const selInfo = () => evaljs(`(()=>{const s=document.querySelector('.obj.selected');return s?{title:s.querySelector('.obj-title').textContent,cls:s.className,left:s.style.left,top:s.style.top,editing:!!s.querySelector('[contenteditable]')}:null})()`);
const stTxt = id => evaljs(`document.getElementById('${id}').textContent`);

/* ---------- suite ---------- */
// A1 initial state
check('A1 三个区', await evaljs(`document.querySelectorAll('.zone').length`) === 3);
check('A1 初始 9 对象、无加载态', (await objCount()) === 9 && await evaljs(`document.querySelector('#help').hidden && !document.querySelector('.loading')`));
check('A1 状态栏未选中', (await stTxt('st-sel')) === '未选中');
await shot('01-initial.png');

// A2 Tab 循环选择
await key('Tab', 'Tab', 9);
const s2 = await selInfo();
check('A2 Tab 选中首个', s2 && s2.title === '竞品扫描笔记' && (await stTxt('st-sel')).includes('已选 1'), JSON.stringify(s2));

// A3 方向键步进 / Shift 微调
const l0 = parseInt(s2.left);
await key('ArrowRight', 'ArrowRight', 39);
const l1 = parseInt((await selInfo()).left);
await key('ArrowRight', 'ArrowRight', 39, { mods: 8 });   // Shift=8
const l2 = parseInt((await selInfo()).left);
check('A3 方向键 +20 / Shift+1', l1 === l0 + 20 && l2 === l1 + 1, `${l0}→${l1}→${l2}`);

// A4 N 创建（编辑器自动打开）
await key('n', 'KeyN', 78, { text: 'n' });
const s4 = await selInfo();
check('A4 N 创建并进入编辑', (await objCount()) === 10 && s4?.editing && s4.title === '新对象', JSON.stringify(s4));
check('A4 toast 已创建', (await stTxt('st-toast')).includes('已创建'), await stTxt('st-toast'));

// A5 编辑态下 Ctrl+2 落位（提交编辑后放行）
await key('2', 'Digit2', 50, { mods: 2 });                 // Ctrl=2
const s5 = await selInfo();
check('A5 Ctrl+2 落位到就位区', s5 && s5.cls.includes('zone-staged') && !s5.editing && s5.left === '580px' && s5.top === '60px', JSON.stringify(s5));
check('A5 toast 落位提示', (await stTxt('st-toast')).includes('落位 → 就位区'), await stTxt('st-toast'));
await shot('03-after-rezone.png');

// A6 Ctrl+Z 撤销（一次回位置，一次删对象）
await key('z', 'KeyZ', 90, { mods: 2 });
const s6 = await selInfo();
check('A6 Ctrl+Z 回滚落位', s6 === null && (await objCount()) === 10);   // undo 清空选择
await key('z', 'KeyZ', 90, { mods: 2 });
check('A6 再撤一次对象消失', (await objCount()) === 9);

// A7 删除 / 撤销删除 / 重做删除（Tab×2 避开 A9 要用的竞品扫描笔记；此时共 10 个对象）
await key('Tab', 'Tab', 9);
await key('Tab', 'Tab', 9);
await key('Delete', 'Delete', 46);
const c7a = await objCount();
await key('z', 'KeyZ', 90, { mods: 2 });
const c7b = await objCount();
await key('y', 'KeyY', 89, { mods: 2 });
const c7c = await objCount();
check('A7 删除→撤销→重做', c7a === 8 && c7b === 9 && c7c === 8, `${c7a}→${c7b}→${c7c}`);

// A8 双击空白创建（鼠标路径），Esc 取消编辑，Delete 删除
const pt = await evaljs(`(()=>{const z=document.querySelector('.zone[data-zone="pool"]').getBoundingClientRect();
  return {x:Math.round(z.left+90), y:Math.round(z.bottom-70)}})()`);
await dblclick(pt.x, pt.y);
const s8 = await selInfo();
check('A8 双击空白创建', (await objCount()) === 9 && s8?.editing, JSON.stringify(s8));
await key('Escape', 'Escape', 27);
await key('Delete', 'Delete', 46);
check('A8 取消编辑后删除', (await objCount()) === 8);

// A9 鼠标拖拽跨区落位
const d9 = await evaljs(`(()=>{const o=[...document.querySelectorAll('.obj')].find(q=>q.textContent.includes('竞品扫描'));
  const z=document.querySelector('.zone[data-zone="locked"]').getBoundingClientRect();
  const a=o.getBoundingClientRect();return {x0:a.left+a.width/2,y0:a.top+a.height/2,x1:z.left+110,y1:z.bottom-70}})()`);
await drag(d9.x0, d9.y0, d9.x1, d9.y1);
const s9 = await selInfo();
check('A9 拖拽落位定稿区', s9 && s9.cls.includes('zone-locked'), JSON.stringify(s9));
check('A9 toast 落位提示', (await stTxt('st-toast')).includes('落位 → 定稿区'), await stTxt('st-toast'));
await shot('04-after-drag.png');

// A10 空格+拖拽平移 / 滚轮缩放 / 0 复位 / 1 适应
const tf0 = await evaljs(`document.querySelector('#world').style.transform`);
await key(' ', 'Space', 32, { text: ' ', hold: true });
await drag(700, 450, 900, 550);
await key(' ', 'Space', 32, { text: ' ', hold: false });
const tf1 = await evaljs(`document.querySelector('#world').style.transform`);
check('A10 空格+拖拽平移', tf0 !== tf1, `${tf0} → ${tf1}`);
await send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 720, y: 450, deltaX: 0, deltaY: -240 });
await sleep(80);
const z1 = await stTxt('st-zoom');
await key('0', 'Digit0', 48);
const z2 = await stTxt('st-zoom');
check('A10 滚轮缩放 / 0 复位', z1 !== z2 && z2 === '100%', `${z1} → ${z2}`);
await key('1', 'Digit1', 49);
const fitOk = await evaljs(`(()=>{const v=document.querySelector('#viewport').getBoundingClientRect();
  return [...document.querySelectorAll('.zone')].every(z=>{const r=z.getBoundingClientRect();
  return r.left>=v.left-1&&r.right<=v.right+1&&r.top>=v.top-1&&r.bottom<=v.bottom+1})})()`);
check('A10 适应全部', fitOk);

// A11 帮助面板
await key('?', 'Slash', 191, { mods: 8, text: '?' });
const helpOpen = await evaljs(`!document.querySelector('#help').hidden`);
const helpRow = await evaljs(`[...document.querySelectorAll('#help td')].some(td=>td.textContent.includes('Ctrl+1/2/3'))`);
check('A11 ? 打开帮助（含落位行）', helpOpen && helpRow);
await shot('02-help.png');
await key('Escape', 'Escape', 27);
check('A11 Esc 关闭帮助', await evaljs(`document.querySelector('#help').hidden`));

// A12 控制台错误
check('A12 无控制台错误', errors.length === 0, errors.slice(0, 3).join(' | '));

console.log(`\n===== ${pass} passed, ${fail} failed =====`);
ws.close(); chrome.kill();
process.exit(fail ? 1 : 0);
