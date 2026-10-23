// 交互级验证：CDP 驱动真实 Chrome，触发真实事件处理器（click / input），断言 DOM 状态并截图。
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9333;
const URL = 'file:///E:/codex-prj/ab-worktrees/pi-matrix-r3/cell-j09-s03-b/index.html';
const OUT = 'E:/codex-prj/ab-worktrees/pi-matrix-r3/cell-j09-s03-b/evidence';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${process.env.TEMP}\\itest-profile`, '--window-size=1600,900', '--hide-scrollbars', 'about:blank',
]);

let ws, msgId = 0;
const pending = new Map();
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++msgId;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}
const evaluate = async expression => {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true });
  if (r.exceptionDetails) throw new Error('page error: ' + JSON.stringify(r.exceptionDetails).slice(0, 300));
  return r.result.value;
};
const shot = async name => {
  const r = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(`${OUT}/${name}`, Buffer.from(r.data, 'base64'));
};
const assert = (cond, label) => { if (!cond) throw new Error('ASSERT FAIL: ' + label); console.log('PASS', label); };

try {
  await sleep(1200);
  const list = await fetch(`http://127.0.0.1:${PORT}/json`).then(r => r.json());
  const page = list.find(t => t.type === 'page');
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(r => { ws.onopen = r; });
  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id).resolve(m.result); pending.delete(m.id); }
  };

  await send('Page.enable');
  await send('Page.navigate', { url: URL });
  await sleep(1500);

  // 1) 初始 ready：推荐与禁用落定
  let rec = await evaluate(`document.querySelector('.dp-main').textContent`);
  assert(rec.includes('当前推荐'), 'ready: 面板显示推荐');
  let disabled = await evaluate(`document.querySelector('#btn-decide').disabled`);
  assert(disabled === true, 'ready: 未选定则落定禁用');

  // 2) 真实点击列头「选定」c3（科苑馨庭）→ selected 态
  await evaluate(`document.querySelector('button[data-select="c3"]').click()`);
  await sleep(120);
  let pressed = await evaluate(`document.querySelector('button[data-select="c3"]').getAttribute('aria-pressed')`);
  assert(pressed === 'true', 'click 选定 → aria-pressed=true');
  let pinSel = await evaluate(`document.querySelector('.pin[data-pin="c3"]').classList.contains('sel')`);
  assert(pinSel, 'click 选定 → 地图图钉联动高亮');
  let panel = await evaluate(`document.querySelector('.dp-main').textContent`);
  assert(panel.includes('科苑馨庭'), 'click 选定 → 面板切换为待落定');
  await shot('04-interact-selected-c3.png');

  // 3) 真实拖动滑杆：通勤权重拉满、价格归零 → 重排
  await evaluate(`
    const set = (id, v) => { const el = document.querySelector('#w-' + id); el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); };
    set('commute', 5); set('price', 2); set('space', 2); set('quiet', 3); set('light', 2); set('quality', 1);
  `);
  await sleep(120);
  const scores = await evaluate(`JSON.stringify((() => {
    const cells = [...document.querySelectorAll('.row-score td')];
    return cells.map(td => ({ id: td.dataset.col, score: td.querySelector('.score-num').textContent, rec: !!td.querySelector('.pill-rec') }));
  })())`);
  const parsed = JSON.parse(scores);
  const byId = Object.fromEntries(parsed.map(p => [p.id, p]));
  assert(byId.c2.rec === true, '权重(通勤优先) → 榕树苑第1推荐');
  assert(byId.c1.score !== '54', '权重变化 → 望江里总分随之更新（原均衡 54）');
  const presetOn = await evaluate(`document.querySelector('[data-preset="通勤优先"]').classList.contains('on')`);
  assert(presetOn, '权重变化 → 匹配预设高亮');
  await shot('05-interact-weights.png');

  // 4) 真实点击「落定」→ decided 驻留
  await evaluate(`document.querySelector('#btn-decide').click()`);
  await sleep(120);
  const chip = await evaluate(`document.querySelector('#hdr-status .chip').textContent`);
  assert(chip.includes('已落定') && chip.includes('科苑馨庭'), 'click 落定 → 顶栏决策徽章（落定的是已选定的 c3）');
  const colDecided = await evaluate(`document.querySelectorAll('#cmp td.col-decided').length`);
  assert(colDecided === 11, 'click 落定 → 该列 11 个单元格驻留高亮');
  const routeHot = await evaluate(`document.querySelector('.route-g[data-route="c3"] .route').classList.contains('hot')`);
  assert(routeHot, 'click 落定 → 地图通勤线路高亮');
  const reason = await evaluate(`document.querySelector('.dp-reason').textContent`);
  assert(reason.includes('月租最低'), 'click 落定 → 理由摘要生成（c3 胜出维度为月租）');
  await shot('06-interact-decided-c3.png');

  // 5) 重新比较 → 回到 ready
  await evaluate(`document.querySelector('#btn-redecide').click()`);
  await sleep(120);
  const backToReady = await evaluate(`!document.querySelector('#decide-panel.decided') && document.querySelector('#hdr-status .chip').textContent.includes('未落定')`);
  assert(backToReady, '重新比较 → 回到未落定');

  console.log('ALL INTERACTION TESTS PASSED');
} catch (e) {
  console.error('FAIL:', e.message);
  process.exitCode = 1;
} finally {
  try { ws && ws.close(); } catch {}
  chrome.kill();
}
