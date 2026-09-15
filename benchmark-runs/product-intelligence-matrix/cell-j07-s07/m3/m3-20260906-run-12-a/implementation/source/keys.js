'use strict';
/* keys.js —— 键盘等价物（验收种子：空间操作必须有键盘等价物）
 * 每一个指针能做的空间操作，这里都有对应按键。 */

const api = window.__fc;

function keyStep() {
  return api.state.snap ? api.GRID : 4;
}

window.addEventListener('keydown', (e) => {
  const t = e.target;
  if (t instanceof Element && t.closest('input, textarea, select')) return;

  // 帮助浮层打开时：只响应 ? 与 Esc
  if (api.helpOpen()) {
    if (e.key === 'Escape' || e.key === '?') { api.toggleHelp(); e.preventDefault(); }
    return;
  }

  const k = e.key;
  const big = e.shiftKey ? 5 : 1;

  switch (true) {
    case k === 'ArrowLeft':  api.moveByKeyboard(-keyStep() * big, 0); e.preventDefault(); return;
    case k === 'ArrowRight': api.moveByKeyboard(keyStep() * big, 0);  e.preventDefault(); return;
    case k === 'ArrowUp':    api.moveByKeyboard(0, -keyStep() * big); e.preventDefault(); return;
    case k === 'ArrowDown':  api.moveByKeyboard(0, keyStep() * big);  e.preventDefault(); return;

    case k === 'Tab':
      api.cycleSelect(e.shiftKey); e.preventDefault(); return;

    case k === 'Delete' || k === 'Backspace':
      api.deleteSelection(); e.preventDefault(); return;

    case (k === 'd' || k === 'D'):
      if (e.ctrlKey || e.metaKey) e.preventDefault();
      api.duplicateSelection(); return;

    case (k === 'a' || k === 'A') && !e.ctrlKey && !e.metaKey:
      api.selectAll(); e.preventDefault(); return;

    case k === 'Escape':
      api.clearSelection(); return;

    case k === 't' || k === 'T':
      api.cycleType(); return;

    case k === '[': api.rotateSelection(-1); return;
    case k === ']': api.rotateSelection(1); return;

    case k === '1': api.sendToZone(api.ZONES[0].id); e.preventDefault(); return;
    case k === '2': api.sendToZone(api.ZONES[1].id); e.preventDefault(); return;
    case k === '3': api.sendToZone(api.ZONES[2].id); e.preventDefault(); return;
    case k === '4': api.sendToZone(api.ZONES[3].id); e.preventDefault(); return;

    case k === 'n' || k === 'N':
      api.addNode(); return;

    case k === 'g' || k === 'G':
      api.toggleSnap(); return;

    case k === '+' || k === '=': { const c = api.state.view; api.zoomAt(c.x + c.w / 2, c.y + c.h / 2, 1 / 1.25); e.preventDefault(); return; }
    case k === '-' || k === '_': { const c = api.state.view; api.zoomAt(c.x + c.w / 2, c.y + c.h / 2, 1.25); e.preventDefault(); return; }
    case k === '0':
      api.setView(0, 0, api.WORLD.w); e.preventDefault(); return;

    case k === '?':
      api.toggleHelp(); e.preventDefault(); return;
  }
});

// 空格按住 = 平移画布（拖拽手型的键盘/指针复合操作）
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && !(e.target instanceof Element && e.target.closest('input,textarea'))) {
    e.preventDefault();
  }
});
window.addEventListener('keyup', (e) => { if (e.code === 'Space') e.preventDefault(); });

/* ────────────────────────────────────────────
 * 自检模式：index.html?selftest=1
 * 通过真实 window 事件监听器派发 KeyboardEvent，
 * 断言画布状态与台账联动，输出逐条 PASS/FAIL。
 * 无需任何外部服务，任何浏览器打开即测。
 * ──────────────────────────────────────────── */
async function runSelftest() {
  const results = [];
  const panel = document.createElement('div');
  panel.id = 'selftest';
  document.body.appendChild(panel);

  const press = (key, opts = {}) =>
    window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...opts }));

  function check(name, fn) {
    try {
      const detail = fn();
      const pass = detail === true || (detail !== null && typeof detail === 'object' && detail.pass === true);
      const msg = detail === true ? ''
        : (detail !== null && typeof detail === 'object' && detail.msg !== undefined ? detail.msg : String(detail));
      results.push({ name, pass, detail: msg });
    } catch (err) {
      results.push({ name, pass: false, detail: '异常: ' + err.message });
    }
  }
  const eq = (a, b) => a === b ? true : `期望 ${b}，实际 ${a}`;
  const sel0 = () => api.state.objects.find((o) => api.state.sel.has(o.id));

  await new Promise((r) => setTimeout(r, 60));

  // 1. 首屏即就绪
  check('首屏内联就绪：27 个对象已渲染，无加载态', () => {
    const n = document.querySelectorAll('#objectsLayer g.obj').length;
    if (n !== 27) return `DOM 实渲染 ${n} 个`;
    if (api.state.objects.length !== 27) return `状态仅 ${api.state.objects.length} 个`;
    return { pass: true, msg: 'DOM 27 = 状态 27，同步渲染，无加载态' };
  });
  check('台账按分区分组（4 分区 + 未落位）', () =>
    eq(document.querySelectorAll('#ledgerBody .zgroup').length, 5));

  // 2. Tab 循环选择
  press('Tab');
  check('Tab 选中第一个对象（桌-01）', () =>
    api.state.sel.size === 1 && sel0().label === '桌-01' ? true : `选中 ${[...api.state.sel].length} 个`);

  // 3. 方向键移动（吸附 20/格）
  const x0 = sel0().x, y0 = sel0().y;
  press('ArrowRight');
  press('ArrowRight');
  press('ArrowDown', { shiftKey: true });
  check('→ → 移动 2 格（+40），Shift+↓ 大步 5 格（+100）', () => {
    const dx = sel0().x - x0, dy = sel0().y - y0;
    return dx === 40 && dy === 100 ? true : `实际 Δ(${dx}, ${dy})`;
  });

  // 4. 数字键发送到分区
  press('2');
  check('按 2：桌-01 落入 会议区（位置重排到分区内空位）', () => {
    const z = api.zoneById(sel0().zone);
    return sel0().zone === 'meeting' && sel0().x > 680 && sel0().x < 1240
      ? true : `zone=${sel0().zone}, x=${sel0().x}`;
  });

  // 5. 分区内继续用键盘微调
  const x1 = sel0().x;
  press('ArrowRight'); press('ArrowRight');
  check('分区内 ←→ 微调仍有效（+40，归属不变）', () =>
    sel0().x === x1 + 40 && sel0().zone === 'meeting' ? true : `x=${sel0().x}`);

  // 6. 复制 / 删除
  press('d');
  check('D 复制：对象 27→28，副本为选中', () =>
    api.state.objects.length === 28 && api.state.sel.size === 1
      && sel0().type === 'desk' ? true : `n=${api.state.objects.length}`);
  press('Delete');
  check('Del 删除：28→27，选择清空', () =>
    api.state.objects.length === 27 && api.state.sel.size === 0 ? true : `n=${api.state.objects.length}`);

  // 7. T 切换类型（标签随类型重排）
  press('Tab');
  press('t');
  check('T 切换类型：桌 → 屏，标签重排为 屏-03', () =>
    sel0().type === 'screen' && sel0().label === '屏-03'
      ? true : `${sel0().type}/${sel0().label}`);

  // 8. 旋转
  press('[');
  check('[ 旋转 -15°（345°）', () => eq(sel0().rot, 345));

  // 9. 吸附开关与微调步长
  press('g');
  const x2 = sel0().x;
  press('ArrowRight');
  const fine = sel0().x - x2;
  press('g');
  check('G 关吸附后 → 为 4px 微调，再按 G 恢复', () =>
    fine === 4 && api.state.snap === true ? true : `步长 ${fine}, snap=${api.state.snap}`);

  // 10. 键盘发送回工作区
  press('1');
  check('按 1：对象发送回 工作区', () =>
    sel0().zone === 'studio' ? true : `zone=${sel0().zone}`);

  // 11. 全选 / 取消
  press('a');
  const allN = api.state.sel.size;
  press('Escape');
  check('A 全选 27 件，Esc 取消', () => allN === 27 && api.state.sel.size === 0 ? true : `${allN}/${api.state.sel.size}`);

  // 12. 缩放 / 复位
  press('+');
  const zw = api.state.view.w;
  press('0');
  check('+ 缩放（1280→1024），0 复位（→1280）', () =>
    Math.abs(zw - 1024) < 1 && api.state.view.w === 1280 ? true : `${zw}→${api.state.view.w}`);

  // 13. 帮助浮层
  press('?');
  const opened = api.helpOpen();
  press('Escape');
  check('? 打开快捷键浮层，Esc 关闭', () => opened && !api.helpOpen());

  // 14. 恢复初始布局，保持首屏观感
  api.resetData();

  const pass = results.filter((r) => r.pass).length;
  panel.innerHTML = `<h3>自检（键盘等价物）：<span class="${pass === results.length ? 'sum-pass' : 'sum-fail'}">${pass}/${results.length} 通过</span></h3>`
    + `<ol>${results.map((r) =>
      `<li class="${r.pass ? 'pass' : 'fail'}"><b>${r.pass ? '✓' : '✗'}</b> ${r.name}<br><span>${r.detail || ''}</span></li>`
    ).join('')}</ol>`
    + `<div class="foot">通过 index.html?selftest=1 触发；按键经真实 keydown 监听器派发。布局已恢复初始状态。</div>`;
}

if (new URLSearchParams(location.search).has('selftest')) {
  runSelftest();
}
