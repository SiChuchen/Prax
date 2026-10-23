/* 真实浏览器交互取证脚本（CDP over WebSocket）。
   用法：node scripts\capture.mjs <chrome或edge可执行路径> <输出目录>
   依次驱动真实输入事件：框选、维度槽位点击、键盘 Ctrl+Z / A / Esc，
   每步截图到输出目录。 */
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const exe = process.argv[2];
const outDir = process.argv[3] || 'screenshots';
const port = 9337;
const pageUrl = 'file:///E:/codex-prj/ab-worktrees/pi-matrix-r3/cell-j13-s10-b/index.html';
mkdirSync(outDir, { recursive: true });

const chrome = spawn(exe, [
  '--headless=new', '--disable-gpu', `--remote-debugging-port=${port}`,
  '--window-size=1680,980', '--hide-scrollbars', '--no-first-run',
  'about:blank',
], { stdio: 'ignore' });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function wsConnect(url) {
  // Node >=22 原生 WebSocket
  const ws = new WebSocket(url);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  return ws;
}

async function main() {
  let list = null;
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/list`);
      list = await res.json();
      if (list.some(t => t.type === 'page')) break;
    } catch {}
    await sleep(250);
  }
  const target = list.find(t => t.type === 'page');
  const ws = await wsConnect(target.webSocketDebuggerUrl);
  let mid = 0;
  const pending = new Map();
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
  };
  const send = (method, params = {}) => new Promise((res) => {
    const id = ++mid;
    pending.set(id, res);
    ws.send(JSON.stringify({ id, method, params }));
  });
  const shot = async (name) => {
    const r = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(join(outDir, name), Buffer.from(r.result.data, 'base64'));
    console.log('saved', name);
  };
  const evalJs = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
    return r.result?.result?.value;
  };

  await send('Page.enable');
  await send('Page.navigate', { url: pageUrl });
  await sleep(1200);

  console.log('visible/total:', await evalJs(`document.getElementById('cnt-visible').textContent + '/' + document.getElementById('cnt-total').textContent`));
  await shot('01-initial-load.png');

  // 真实指针框选（画布中央区域）
  const stage = await evalJs(`JSON.stringify(document.getElementById('stage').getBoundingClientRect())`);
  const g = JSON.parse(stage);
  const cx = g.x + g.width / 2, cy = g.y + g.height / 2;
  const mouse = (type, x, y, mods = 0) => send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: type === 'mouseMoved' ? 0 : 1, modifiers: mods });
  await mouse('mousePressed', cx - 180, cy - 140);
  for (let i = 1; i <= 8; i++) await mouse('mouseMoved', cx - 180 + i * 45, cy - 140 + i * 35);
  await mouse('mouseReleased', cx + 180, cy + 140);
  await sleep(300);
  console.log('after brush selected:', await evalJs(`document.getElementById('cnt-selected').textContent`));
  await shot('02-brush-selection.png');

  // 真实点击维度卡槽位：把活跃用户设为 X、满意度设为 Y（键盘可达按钮 click）
  await evalJs(`document.querySelector('button[aria-label="活跃用户 设为 X 轴"]').click()`);
  await evalJs(`document.querySelector('button[aria-label="满意度 设为 Y 轴"]').click()`);
  await sleep(300);
  console.log('projection:', await evalJs(`document.getElementById('proj-xy').textContent`));
  console.log('filters kept:', await evalJs(`document.getElementById('fb-count').textContent`), 'selected kept:', await evalJs(`document.getElementById('cnt-selected').textContent`));
  await shot('03-dimension-switch-carryover.png');

  // 真实键盘：Ctrl+Z 撤销一次（回到切换前投影），A 全选可见，Esc 清除
  const VK = { KeyZ: 90, KeyA: 65 };
  const key = (type, key, code, mods = 0) => send('Input.dispatchKeyEvent', { type, key, code, windowsVirtualKeyCode: VK[code] || 0, modifiers: mods, text: type === 'keyDown' && !mods ? key : undefined });
  await key('keyDown', 'z', 'KeyZ', 2); // Ctrl
  await key('keyUp', 'z', 'KeyZ', 2);
  await sleep(250);
  console.log('after Ctrl+Z projection:', await evalJs(`document.getElementById('proj-xy').textContent`));
  await shot('04-undo-ctrlz.png');
  await key('keyDown', 'z', 'KeyZ', 3); // Ctrl+Shift
  await key('keyUp', 'z', 'KeyZ', 3);
  await sleep(250);
  await key('keyDown', 'a', 'KeyA'); await key('keyUp', 'a', 'KeyA');
  await sleep(250);
  console.log('after redo + A selected:', await evalJs(`document.getElementById('cnt-selected').textContent`));
  await shot('05-redo-selectall-visible.png');

  // 账本回退：点击账本第一条快照（跳转回退）
  await evalJs(`document.querySelectorAll('#histlist .hsnap')[document.querySelectorAll('#histlist .hsnap').length-1].click()`);
  await sleep(300);
  console.log('after jump-to-initial filters:', await evalJs(`document.getElementById('fb-count').textContent || '0'`), 'selected:', await evalJs(`document.getElementById('cnt-selected').textContent`));
  await shot('06-ledger-rollback-initial.png');

  ws.close(); chrome.kill();
}
main().catch(e => { console.error('CAPTURE_FAILED', e.message); chrome.kill(); process.exit(1); });
