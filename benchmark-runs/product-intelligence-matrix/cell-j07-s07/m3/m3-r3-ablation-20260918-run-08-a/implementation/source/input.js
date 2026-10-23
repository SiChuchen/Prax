'use strict';
/* ============ Locus · 落位画布 — input: pointer / wheel / keyboard ============ */

let drag = null;   // {mode:'pan'|'move'|'band', ...}
let spaceHeld = false;

/* ---------- 启动：首屏即就绪（先于事件绑定） ---------- */
worldEl = document.getElementById('world');
viewportEl = document.getElementById('viewport');
bandEl = document.getElementById('band');
buildZones();
seedObjects();
fitAll();
if (new URLSearchParams(location.search).has('help')) document.getElementById('help').hidden = false;

/* ---------- 工具函数 ---------- */
function worldFromEvent(e) {
  const r = viewportEl.getBoundingClientRect();
  return { x: (e.clientX - r.left - state.panX) / state.zoom,
           y: (e.clientY - r.top  - state.panY) / state.zoom };
}
function setZoom(nz, cx, cy) {
  nz = clamp(nz, 0.25, 3);
  const k = nz / state.zoom;
  state.panX = cx - (cx - state.panX) * k;
  state.panY = cy - (cy - state.panY) * k;
  state.zoom = nz;
  fullRender();
}
const vpCenter = () => ({ cx: viewportEl.clientWidth / 2, cy: viewportEl.clientHeight / 2 });

/* ---------- 指针：平移 / 移动对象 / 框选 ---------- */
viewportEl.addEventListener('pointerdown', e => {
  if (e.button === 1 || spaceHeld || e.altKey) {           // 平移
    drag = { mode: 'pan', sx: e.clientX, sy: e.clientY, px: state.panX, py: state.panY };
    viewportEl.classList.add('panning');
    viewportEl.setPointerCapture(e.pointerId);
    e.preventDefault(); return;
  }
  if (e.button !== 0) return;
  if (state.editingId && !e.target.closest('.obj-title[contenteditable]')) stopEdit(true);

  const objEl = e.target.closest('.obj');
  if (objEl) {                                             // 选中并准备移动
    const id = +objEl.dataset.id;
    if (e.shiftKey) state.sel.has(id) ? state.sel.delete(id) : state.sel.add(id);
    else if (!state.sel.has(id)) state.sel = new Set([id]);
    fullRender();
    const w = worldFromEvent(e);
    drag = { mode: 'move', sx: w.x, sy: w.y, moved: false,
             orig: state.objects.filter(o => state.sel.has(o.id)).map(o => ({ id: o.id, x: o.x, y: o.y })) };
    for (const el of worldEl.querySelectorAll('.obj.selected')) el.classList.add('dragging');
    viewportEl.setPointerCapture(e.pointerId);
  } else {                                                 // 空白：框选
    const w = worldFromEvent(e);
    drag = { mode: 'band', sx: w.x, sy: w.y,
             base: e.shiftKey ? new Set(state.sel) : new Set() };
    if (!e.shiftKey) { state.sel.clear(); fullRender(); }
    bandEl.hidden = false;
    viewportEl.setPointerCapture(e.pointerId);
  }
});

viewportEl.addEventListener('pointermove', e => {
  if (!drag) {                                             // 状态栏：指针所在区
    const w = worldFromEvent(e);
    document.getElementById('st-zone').textContent =
      zoneAt(w.x, w.y) ? `指针位于「${zoneName(zoneAt(w.x, w.y))}」` : '指针不在任何区';
    return;
  }
  if (drag.mode === 'pan') {
    state.panX = drag.px + (e.clientX - drag.sx);
    state.panY = drag.py + (e.clientY - drag.sy);
    worldEl.style.transform = `translate(${state.panX}px,${state.panY}px) scale(${state.zoom})`;
    updateStatus();
  } else if (drag.mode === 'move') {
    const w = worldFromEvent(e);
    let dx = w.x - drag.sx, dy = w.y - drag.sy;
    if (!drag.moved && Math.hypot(dx, dy) * state.zoom < 3) return;
    if (!drag.moved) { pushUndo(); drag.moved = true; }
    for (const q of drag.orig) {
      const o = state.objects.find(x => x.id === q.id);
      o.x = snapV(q.x + dx); o.y = snapV(q.y + dy);
      const el = worldEl.querySelector(`.obj[data-id="${o.id}"]`);
      el.style.left = o.x + 'px'; el.style.top = o.y + 'px';
    }
    // 拖拽经过的区实时高亮
    const over = zoneAt(w.x, w.y);
    for (const el of worldEl.querySelectorAll('.zone'))
      el.classList.toggle('hot', el.dataset.zone === over);
  } else if (drag.mode === 'band') {
    const w = worldFromEvent(e);
    const x0 = Math.min(drag.sx, w.x), y0 = Math.min(drag.sy, w.y);
    const bw = Math.abs(w.x - drag.sx), bh = Math.abs(w.y - drag.sy);
    Object.assign(bandEl.style, {
      left: (x0 * state.zoom + state.panX) + 'px', top: (y0 * state.zoom + state.panY) + 'px',
      width: bw * state.zoom + 'px', height: bh * state.zoom + 'px',
    });
    state.sel = new Set(drag.base);
    for (const o of state.objects)
      if (o.x < x0 + bw && o.x + o.w > x0 && o.y < y0 + bh && o.y + o.h > y0) state.sel.add(o.id);
    for (const el of worldEl.querySelectorAll('.obj'))
      el.classList.toggle('selected', state.sel.has(+el.dataset.id));
    updateStatus();
  }
});

viewportEl.addEventListener('pointerup', e => {
  if (!drag) return;
  viewportEl.classList.remove('panning');
  bandEl.hidden = true;
  if (drag.mode === 'move' && drag.moved) {
    let zoneMsg = '';
    for (const q of drag.orig) {
      const o = state.objects.find(x => x.id === q.id);
      if (recomputeZone(o)) zoneMsg = `「${o.title}」落位 → ${zoneName(o.zone)}`;
    }
    if (zoneMsg) toast(zoneMsg);
    fullRender();
  }
  drag = null;
});

/* 双击：空白新建 / 对象改标题 */
viewportEl.addEventListener('dblclick', e => {
  const objEl = e.target.closest('.obj');
  if (objEl) startEdit(+objEl.dataset.id);
  else { stopEdit(true); createObject(worldFromEvent(e).x, worldFromEvent(e).y); }
});

/* 滚轮缩放（指针为中心） */
viewportEl.addEventListener('wheel', e => {
  e.preventDefault();
  const r = viewportEl.getBoundingClientRect();
  setZoom(state.zoom * Math.exp(-e.deltaY * 0.0016), e.clientX - r.left, e.clientY - r.top);
}, { passive: false });

/* ---------- 键盘：所有空间操作的等价物 ---------- */
window.addEventListener('keydown', e => {
  if (e.target.closest && e.target.closest('button')) return; // 按钮聚焦时交给按钮原生行为
  const help = document.getElementById('help');
  if (e.key === '?' || (e.key === '/' && e.shiftKey)) { help.hidden = !help.hidden; e.preventDefault(); return; }
  if (!help.hidden) { if (e.key === 'Escape') help.hidden = true; return; }

  if (e.key === ' ' && !state.editingId) { spaceHeld = true; e.preventDefault(); return; }

  if (state.editingId) {
    const mod0 = e.ctrlKey || e.metaKey;
    if (!mod0) {                                           // 编辑态只认提交/取消
      if (e.key === 'Enter')  { stopEdit(true); toast('标题已更新'); }
      if (e.key === 'Escape') { stopEdit(false); toast('已取消编辑'); }
      if (e.key === 'Enter' || e.key === 'Escape' || e.key === 'Tab') e.preventDefault();
      return;
    }
    stopEdit(true);                                        // 修饰键组合：先提交再放行（如 Ctrl+2 落位）
  }

  const mod = e.ctrlKey || e.metaKey;
  const k = e.key;

  // 单键快捷键吞掉默认行为（如避免 N 把字符打进刚打开的编辑器）
  if ('nNsS[]=-_0+1'.includes(k) && k.length === 1) e.preventDefault();

  if (mod && (k === 'z' || k === 'Z')) { e.shiftKey ? redo() : undo(); return e.preventDefault(); }
  if (mod && (k === 'y' || k === 'Y')) { redo(); return e.preventDefault(); }
  if (mod && (k === 'a' || k === 'A')) { state.sel = new Set(state.objects.map(o => o.id)); fullRender(); return e.preventDefault(); }
  if (mod && (k === 'd' || k === 'D')) { duplicateSelected(); return e.preventDefault(); }
  if (mod && ['1', '2', '3'].includes(k)) { moveSelectedToZone(+k - 1); return e.preventDefault(); }
  if (mod) return;

  switch (k) {
    case 'Delete': case 'Backspace': deleteSelected(); break;
    case 'Enter': case 'F2':
      if (state.sel.size === 1) startEdit([...state.sel][0]);
      else toast('选中单个对象后按 Enter 编辑');
      break;
    case 'ArrowLeft': case 'ArrowRight': case 'ArrowUp': case 'ArrowDown': {
      const dx = k === 'ArrowLeft' ? -1 : k === 'ArrowRight' ? 1 : 0;
      const dy = k === 'ArrowUp' ? -1 : k === 'ArrowDown' ? 1 : 0;
      if (state.sel.size) nudgeSelected(e.shiftKey ? dx : dx * GRID, e.shiftKey ? dy : dy * GRID);
      else { state.panX -= dx * 80; state.panY -= dy * 80; fullRender(); }
      e.preventDefault(); break;
    }
    case 'Tab': {                                          // 循环选择
      if (!state.objects.length) break;
      const order = [...state.objects].sort((a, b) =>
        ZONES.findIndex(z => z.id === a.zone) - ZONES.findIndex(z => z.id === b.zone) || a.y - b.y || a.x - b.x);
      const cur = order.findIndex(o => state.sel.has(o.id));
      const nxt = e.shiftKey ? (cur <= 0 ? order.length - 1 : cur - 1)
                             : (cur === order.length - 1 || cur === -1 ? 0 : cur + 1);
      state.sel = new Set([order[nxt].id]);
      fullRender(); e.preventDefault(); break;
    }
    case 'Escape': state.sel.clear(); fullRender(); break;
    case 'n': case 'N': { const { cx, cy } = vpCenter();
      const w = { x: (cx - state.panX) / state.zoom, y: (cy - state.panY) / state.zoom };
      createObject(w.x, w.y); break; }
    case 's': case 'S': state.snap = !state.snap; fullRender();
      toast('栅格吸附 ' + (state.snap ? '开' : '关')); break;
    case '[': reorderSelected(-1); break;
    case ']': reorderSelected(+1); break;
    case '=': case '+': { const { cx, cy } = vpCenter(); setZoom(state.zoom * 1.2, cx, cy); break; }
    case '-': case '_': { const { cx, cy } = vpCenter(); setZoom(state.zoom / 1.2, cx, cy); break; }
    case '0': { const { cx, cy } = vpCenter(); setZoom(1, cx, cy); break; }
    case '1': fitAll(); break;
  }
});
window.addEventListener('keyup', e => { if (e.key === ' ') spaceHeld = false; });
window.addEventListener('blur', () => { spaceHeld = false; });

/* ---------- 工具栏（按钮 = 键盘等价入口） ---------- */
document.getElementById('btn-new').onclick  = () => { const { cx, cy } = vpCenter();
  createObject((cx - state.panX) / state.zoom, (cy - state.panY) / state.zoom); };
document.getElementById('btn-dup').onclick  = duplicateSelected;
document.getElementById('btn-del').onclick  = deleteSelected;
document.getElementById('btn-undo').onclick = undo;
document.getElementById('btn-redo').onclick = redo;
document.getElementById('btn-snap').onclick = () => { state.snap = !state.snap; fullRender();
  toast('栅格吸附 ' + (state.snap ? '开' : '关')); };
document.getElementById('btn-zin').onclick  = () => { const c = vpCenter(); setZoom(state.zoom * 1.2, c.cx, c.cy); };
document.getElementById('btn-zout').onclick = () => { const c = vpCenter(); setZoom(state.zoom / 1.2, c.cx, c.cy); };
document.getElementById('btn-fit').onclick  = fitAll;
document.getElementById('btn-zreset').onclick = () => { const c = vpCenter(); setZoom(1, c.cx, c.cy); };
document.getElementById('btn-help').onclick = () => { document.getElementById('help').hidden = false; };
document.getElementById('help-close').onclick = () => { document.getElementById('help').hidden = true; };
// 点击后交还键盘焦点，避免后续快捷键被聚焦按钮挡住
for (const b of document.querySelectorAll('button')) b.addEventListener('click', () => b.blur());
