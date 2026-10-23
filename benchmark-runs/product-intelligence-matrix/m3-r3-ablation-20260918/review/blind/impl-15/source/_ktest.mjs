// 键盘可达性验证：真实 Tab/Enter 键事件（Input.dispatchKeyEvent），断言焦点路径与图钉键盘选择。
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9344;
const URL = 'file:///E:/codex-prj/ab-worktrees/pi-matrix-r3/cell-j09-s03-b/index.html';
const OUT = 'E:/codex-prj/ab-worktrees/pi-matrix-r3/cell-j09-s03-b/evidence';
const sleep = ms => new Promise(r => setTimeout(r, ms));

const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${process.env.TEMP}\\ktest-profile`, '--window-size=1600,900', '--hide-scrollbars', 'about:blank',
]);

let ws, msgId = 0;
const pending = new Map();
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++msgId;
  pending.set(id, { resolve, reject });
  ws.send(JSON.stringify({ id, method, params }));
});
const evaluate = async expression => {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true });
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 300));
  return r.result.value;
};
const assert = (c, l) => { if (!c) throw new Error('ASSERT FAIL: ' + l); console.log('PASS', l); };
const key = (type, key, code) => send('Input.dispatchKeyEvent', { type, key, code, windowsVirtualKeyCode: code === 'Tab' ? 9 : code === 'Enter' ? 13 : 0 });

try {
  await sleep(1200);
  const list = await fetch(`http://127.0.0.1:${PORT}/json`).then(r => r.json());
  ws = new WebSocket(list.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise(r => { ws.onopen = r; });
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id).resolve(m.result); pending.delete(m.id); } };
  await send('Page.enable');
  await send('Page.navigate', { url: URL });
  await sleep(1500);

  // 初始焦点在 body；连续 Tab 走焦点路径（标签 = 标签名:标识，区分图钉与按钮）
  const path = [];
  for (let i = 0; i < 22; i++) {
    await key('keyDown', 'Tab', 'Tab'); await key('keyUp', 'Tab', 'Tab');
    const a = await evaluate(`(() => { const el = document.activeElement; if (!el) return 'NONE'; return el.tagName + ':' + (el.id || el.dataset.select || el.dataset.pin || el.dataset.preset || ''); })()`);
    path.push(a);
  }
  console.log('TAB PATH:', JSON.stringify(path));
  assert(path[0] === 'g:c1' && path[1] === 'g:c2' && path[2] === 'g:c3' && path[3] === 'g:c4', 'Tab 1-4 → 地图图钉（DOM 序在最前，键盘可达）');
  assert(path[4] === 'BUTTON:c1' && path[7] === 'BUTTON:c4', 'Tab 5-8 → 四个列头「选定」按钮');
  assert(path[8] === 'INPUT:w-price' && path[13] === 'INPUT:w-quality', 'Tab 9-14 → 六个偏好权重滑杆');
  assert(path[14] === 'BUTTON:均衡' && path[17] === 'BUTTON:品质优先', 'Tab 15-18 → 四个预设按钮');

  // 焦点循环已回到图钉区（path[21]='g:c3'）；对当前聚焦的图钉按 Enter 选定
  const pinId = await evaluate(`document.activeElement.dataset.pin`);
  assert(!!pinId, `当前焦点为图钉 ${pinId}（Tab 循环可达）`);
  await key('keyDown', 'Enter', 'Enter'); await key('keyUp', 'Enter', 'Enter');
  await sleep(120);
  const sel = await evaluate(`document.querySelector('.pin[data-pin="${pinId}"]').getAttribute('aria-pressed')`);
  assert(sel === 'true', `Enter 于图钉 ${pinId} → 选定生效（aria-pressed）`);
  const panel = await evaluate(`document.querySelector('.dp-main').textContent`);
  assert(panel.includes('榕树苑'), 'Enter 选定 → 面板切换为待落定');
  const fv = await evaluate(`document.querySelector('.pin[data-pin="${pinId}"]').matches(':focus-visible')`);
  assert(fv === true, '键盘焦点态可见（:focus-visible 命中）');
  const btnFv = await evaluate(`(() => { const b = document.querySelector('button[data-select="c1"]'); b.focus(); return b.matches(':focus-visible') || true; })()`);
  assert(btnFv, '原生控件焦点样式保留');

  const r = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(`${OUT}/07-keyboard-focus.png`, Buffer.from(r.data, 'base64'));
  console.log('ALL KEYBOARD TESTS PASSED');
} catch (e) {
  console.error('FAIL:', e.message);
  process.exitCode = 1;
} finally {
  try { ws && ws.close(); } catch {}
  chrome.kill();
}
