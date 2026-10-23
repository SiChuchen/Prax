/* 第二批取证：过滤跨维度切换保持 + 空状态与恢复（全部走与应用点击/键盘相同的动作函数，并逐步校验计数）。
   用法：node scripts\capture2.mjs <chrome或edge可执行路径> <输出目录> */
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const exe = process.argv[2];
const outDir = process.argv[3] || 'screenshots';
const port = 9339;
const pageUrl = 'file:///E:/codex-prj/ab-worktrees/pi-matrix-r3/cell-j13-s10-b/index.html';
mkdirSync(outDir, { recursive: true });

const chrome = spawn(exe, [
  '--headless=new', '--disable-gpu', `--remote-debugging-port=${port}`,
  '--window-size=1680,980', '--hide-scrollbars', '--no-first-run',
  'about:blank',
], { stdio: 'ignore' });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

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
  const ws = new WebSocket(list.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let mid = 0; const pending = new Map();
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
  };
  const send = (method, params = {}) => new Promise((res) => {
    const id = ++mid; pending.set(id, res);
    ws.send(JSON.stringify({ id, method, params }));
  });
  const shot = async (name) => {
    const r = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(join(outDir, name), Buffer.from(r.result.data, 'base64'));
    console.log('saved', name);
  };
  const evalJs = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
    if (r.result?.exceptionDetails) throw new Error('eval failed: ' + JSON.stringify(r.result.exceptionDetails.exception?.description || ''));
    return r.result?.result?.value;
  };
  const counts = async () => evalJs(`document.getElementById('cnt-visible').textContent + '|' + document.getElementById('cnt-selected').textContent + '|' + document.getElementById('fb-count').textContent`);

  await send('Page.enable');

  /* ---- 场景 A：建立 3 项过滤 + 键盘全选 → 切换 X/Y 维度 → 验证过滤与选中全部保留 ---- */
  await send('Page.navigate', { url: pageUrl });
  await sleep(1100);
  console.log('A0 initial:', await counts());
  await evalJs(`toggleBinFilter('revenue',3)`);
  await evalJs(`toggleBinFilter('revenue',4)`);
  await evalJs(`toggleBinFilter('revenue',5)`);
  await evalJs(`toggleValFilter('channel','电商','维度卡·渠道 · 取值')`);
  console.log('A1 filters set:', await counts());
  await evalJs(`setSelection([...visibleSet],'全选可见 '+visibleSet.size+' 条（键盘 A）','键盘','键')`);
  console.log('A2 select-all-visible:', await counts());
  await evalJs(`assignRole('x','users')`);
  await evalJs(`assignRole('y','csat')`);
  await evalJs(`assignRole('color','category')`);
  await sleep(300);
  console.log('A3 after switch projection:', await evalJs(`document.getElementById('proj-xy').textContent`),
    '| color:', await evalJs(`document.getElementById('proj-color').textContent`),
    '| counts:', await counts());
  if (await evalJs(`state.filters.length`) !== 4) throw new Error('filters lost on switch!');
  if (await evalJs(`state.selection.size`) === 0) throw new Error('selection lost on switch!');
  await shot('07-filter-carryover-switch.png');

  /* ---- 场景 B：回退到过滤建立前（账本跳转）→ 空状态 → 一键恢复 ---- */
  await evalJs(`jump(1)`); // 回到仅有 #1 初始状态? 先跳回 #1（初始），再从干净状态构造空态
  console.log('B0 rolled back to #1:', await counts(),
    '| pointer:', await evalJs(`pointer`), '| ledger len:', await evalJs(`ledger.length`));
  // 逐步加过滤直到 0 可见（确定性到达空态）
  const steps = [
    `toggleBinFilter('csat',0)`,
    `toggleValFilter('quarter','2023Q1','维度卡·上线季度 · 取值')`,
    `toggleValFilter('region','东北','维度卡·地区 · 取值')`,
    `toggleBinFilter('revenue',0)`,
    `toggleBinFilter('users',0)`,
    `toggleValFilter('channel','OEM','维度卡·渠道 · 取值')`,
  ];
  let vis = parseInt((await counts()).split('|')[0].replace(/,/g, ''), 10);
  for (const s of steps) {
    if (vis === 0) break;
    await evalJs(s);
    vis = parseInt((await counts()).split('|')[0].replace(/,/g, ''), 10);
    console.log('B after step:', s, '-> visible', vis);
  }
  if (vis !== 0) throw new Error('could not reach empty state, visible=' + vis);
  await shot('08-empty-state-recovery.png');
  await evalJs(`document.getElementById('btn-clearall').click()`); // 空态卡片上的恢复按钮
  await sleep(250);
  const rec = await counts();
  console.log('B1 after clear-all recovery:', rec);
  if (!rec.startsWith('2,400')) throw new Error('recovery failed: ' + rec);
  await shot('09-empty-recovered-full.png');

  ws.close(); chrome.kill();
  console.log('ALL_OK');
}
main().catch(e => { console.error('CAPTURE2_FAILED', e.message); chrome.kill(); process.exit(1); });
