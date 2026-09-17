'use strict';
/* 落位 LoWei · 空间排布画板
   主题：create × spatial-workspace —— 落位即意图。
   纪律：所有空间操作（放置/移动/旋转/层级/删除/精确坐标）均有键盘等价物。 */

const $ = (s) => document.querySelector(s);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const snapV = (v) => Math.round(v / GRID) * GRID;
const escapeHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---------- 状态 ----------
let objects = [];
let selectedId = null;
let armed = null;            // 当前待放置（盖印）类型 key
let history = [];
let future = [];
let seq = 0;
let helpOpen = false;
const uid = () => 'o' + (++seq);

const el = {
  room: $('#room'), zlayer: $('#zlayer'), olayer: $('#olayer'), ghost: $('#ghost'),
  palList: $('#pal-list'), count: $('#count'), warnchip: $('#warnchip'),
  status: $('#status'), modehint: $('#modehint'),
  inspEmpty: $('#insp-empty'), inspObj: $('#insp-obj'),
  iType: $('#i-type'), iEmoji: $('#i-emoji'), iLabel: $('#i-label'),
  iX: $('#i-x'), iY: $('#i-y'), iW: $('#i-w'), iH: $('#i-h'), iRot: $('#i-rot'),
  iZone: $('#i-zone'), iSuggest: $('#i-suggest'), iWarn: $('#i-warn'),
  sumCount: $('#sum-count'), sumWarn: $('#sum-warn'), sumZones: $('#sum-zones'),
  btnUndo: $('#btn-undo'), btnRedo: $('#btn-redo'),
  help: $('#help-overlay'),
};

const byId = (id) => objects.find((o) => o.id === id) || null;
const selObj = () => byId(selectedId);

// ---------- 几何与语义 ----------
const rectOf = (o) => ({ x: o.x, y: o.y, w: o.w, h: o.h });
const intersects = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
function zoneAtPoint(x, y) {
  return ZONES.find((z) => x >= z.x && x <= z.x + z.w && y >= z.y && y <= z.y + z.h) || null;
}
const zoneOf = (o) => zoneAtPoint(o.x + o.w / 2, o.y + o.h / 2);
const AISLE = () => ZONES.find((z) => z.kind === 'clear');
function collides(o) {
  return objects.some((t) => t.id !== o.id && intersects(rectOf(o), rectOf(t)));
}
function warningsOf(o) {
  const w = [];
  if (collides(o)) w.push('与其它物品重叠');
  if (intersects(rectOf(o), AISLE())) w.push('占用动线通道');
  return w;
}
function suggestFor(o) {
  const t = TYPE_MAP[o.type];
  if (!t.prefer) return null;
  const z = zoneOf(o);
  if (z && z.id === t.prefer) return null;
  return ZONES.find((zz) => zz.id === t.prefer).name;
}

// ---------- 历史（撤销/重做） ----------
function pushHistory() {
  history.push(JSON.stringify(objects));
  if (history.length > 60) history.shift();
  future = [];
  updateTopbar();
}
function undo() {
  if (!history.length) return;
  future.push(JSON.stringify(objects));
  objects = JSON.parse(history.pop());
  if (!byId(selectedId)) selectedId = null;
  renderAll();
  narrate('已撤销');
}
function redo() {
  if (!future.length) return;
  history.push(JSON.stringify(objects));
  objects = JSON.parse(future.pop());
  if (!byId(selectedId)) selectedId = null;
  renderAll();
  narrate('已重做');
}

// ---------- 渲染 ----------
function renderZones() {
  el.zlayer.innerHTML = '';
  for (const z of ZONES) {
    const d = document.createElement('div');
    d.className = 'zone zone-' + z.kind;
    d.dataset.z = z.id;
    d.style.cssText = 'left:' + z.x + 'px;top:' + z.y + 'px;width:' + z.w + 'px;height:' + z.h + 'px';
    d.innerHTML = '<span class="zone-name" style="color:' + z.tone + '">' + z.name +
      '</span><span class="zone-hint" style="color:' + z.tone + '">' + z.hint + '</span>';
    el.zlayer.appendChild(d);
  }
}

function renderObjects() {
  el.olayer.innerHTML = '';
  for (const o of objects) {
    const t = TYPE_MAP[o.type];
    const d = document.createElement('div');
    const warn = warningsOf(o);
    d.className = 'obj' + (o.id === selectedId ? ' sel' : '') + (warn.length ? ' warn' : '');
    d.dataset.id = o.id;
    d.style.left = o.x + 'px';
    d.style.top = o.y + 'px';
    d.style.width = o.w + 'px';
    d.style.height = o.h + 'px';
    d.style.borderColor = t.color;
    const z = zoneOf(o);
    d.title = o.label + '（' + t.name + '）· ' + (z ? z.name : '未分区');
    const inner = document.createElement('div');
    inner.className = 'obj-inner';
    const iw = o.rot % 180 ? o.h : o.w;
    const ih = o.rot % 180 ? o.w : o.h;
    inner.style.width = iw + 'px';
    inner.style.height = ih + 'px';
    inner.style.transform = 'translate(-50%,-50%) rotate(' + o.rot + 'deg)';
    inner.innerHTML = '<span class="obj-emoji">' + t.emoji + '</span>' +
      '<span class="obj-label" style="transform:rotate(' + (-o.rot) + 'deg);color:' + t.color + '">' +
      escapeHtml(o.label) + '</span>';
    d.appendChild(inner);
    if (warn.length) {
      const b = document.createElement('span');
      b.className = 'warn-dot';
      b.textContent = '⚠';
      d.appendChild(b);
    }
    el.olayer.appendChild(d);
  }
}

function updateTopbar() {
  el.count.textContent = objects.length + ' 件物品';
  const nwarn = objects.filter((o) => warningsOf(o).length).length;
  el.warnchip.hidden = nwarn === 0;
  el.warnchip.textContent = '⚠ ' + nwarn + ' 处冲突';
  el.btnUndo.disabled = history.length === 0;
  el.btnRedo.disabled = future.length === 0;
}

function updateSummary() {
  el.sumCount.textContent = objects.length;
  el.sumWarn.textContent = objects.filter((o) => warningsOf(o).length).length + ' 件';
  const parts = ZONES.map((z) => {
    const n = objects.filter((o) => { const zz = zoneOf(o); return zz && zz.id === z.id; }).length;
    return '<div><span class="dot" style="background:' + z.tone + '"></span>' + z.name + ' · ' + n + '</div>';
  });
  parts.push('<div><span class="dot" style="background:#94a3b8"></span>未分区 · ' +
    objects.filter((o) => !zoneOf(o)).length + '</div>');
  el.sumZones.innerHTML = parts.join('');
}

function updateInspector() {
  const o = selObj();
  el.inspEmpty.hidden = !!o;
  el.inspObj.hidden = !o;
  if (!o) return;
  const t = TYPE_MAP[o.type];
  el.iType.textContent = t.name;
  el.iEmoji.textContent = t.emoji;
  if (document.activeElement !== el.iLabel) el.iLabel.value = o.label;
  if (document.activeElement !== el.iX) el.iX.value = o.x;
  if (document.activeElement !== el.iY) el.iY.value = o.y;
  el.iW.textContent = o.w;
  el.iH.textContent = o.h;
  el.iRot.textContent = o.rot + '°';
  const z = zoneOf(o);
  el.iZone.textContent = z ? '📍 ' + z.name : '未分区';
  el.iZone.className = 'zone-badge' + (z ? (z.kind === 'clear' ? ' bad' : ' ok') : '');
  const sug = suggestFor(o);
  el.iSuggest.hidden = !sug;
  if (sug) el.iSuggest.textContent = '💡 建议区域：' + sug;
  const w = warningsOf(o);
  el.iWarn.hidden = !w.length;
  el.iWarn.innerHTML = w.map((x) => '⚠ ' + x).join('<br>');
}

function renderAll() {
  renderObjects();
  updateInspector();
  updateTopbar();
  updateSummary();
}

function renderPalette() {
  el.palList.innerHTML = '';
  TYPES.forEach((t, i) => {
    const b = document.createElement('button');
    b.className = 'pal-item' + (armed === t.key ? ' armed' : '');
    b.dataset.key = t.key;
    b.innerHTML = '<span class="pal-key">' + (i + 1) + '</span>' +
      '<span class="pal-emoji">' + t.emoji + '</span>' +
      '<span class="pal-name">' + t.name + '</span>' +
      '<span class="pal-size">' + t.w + '×' + t.h + '</span>';
    el.palList.appendChild(b);
  });
}

// ---------- 反馈（落位即意图的叙述） ----------
function narrate(msg) {
  el.status.textContent = msg;
  el.status.classList.remove('flash');
  void el.status.offsetWidth;
  el.status.classList.add('flash');
}
function narrateWhere(o, prefix) {
  const z = zoneOf(o);
  const w = warningsOf(o);
  narrate((prefix || o.label) + ' → ' + (z ? z.name : '未分区') + (w.length ? ' ⚠ ' + w.join('、') : ''));
}

// ---------- 模式（放置盖印） ----------
function updateModeHint() {
  el.modehint.innerHTML = armed
    ? '放置模式：<b>' + TYPE_MAP[armed].name + '</b> · 点击画布落位 · <kbd>N</kbd> 快速放置 · <kbd>Esc</kbd> 退出'
    : '<kbd>Tab</kbd> 选择 · 方向键移动（Shift 微调）· <kbd>R</kbd> 旋转 · <kbd>1-8</kbd>+<kbd>N</kbd> 放置 · <kbd>?</kbd> 快捷键';
  el.room.classList.toggle('armed', !!armed);
}
function arm(key) {
  armed = key;
  renderPalette();
  updateModeHint();
}
function disarm() {
  armed = null;
  el.ghost.hidden = true;
  renderPalette();
  updateModeHint();
}

// ---------- 放置 / 创建 ----------
function placeAt(key, lx, ly) {
  const t = TYPE_MAP[key];
  const x = clamp(snapV(lx - t.w / 2), 0, ROOM.w - t.w);
  const y = clamp(snapV(ly - t.h / 2), 0, ROOM.h - t.h);
  pushHistory();
  const o = { id: uid(), type: key, x, y, w: t.w, h: t.h, rot: 0, label: t.name };
  objects.push(o);
  selectedId = o.id;
  narrateWhere(o, '已放置 ' + t.name + '「' + o.label + '」');
  renderAll();
}

function findFreeSpot(x, y, w, h) {
  for (let r = 0; r < 14; r++) {
    for (let dx = -r; dx <= r; dx++) {
      for (let dy = -r; dy <= r; dy++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const nx = clamp(snapV(x + dx * GRID * 2), 0, ROOM.w - w);
        const ny = clamp(snapV(y + dy * GRID * 2), 0, ROOM.h - h);
        const test = { x: nx, y: ny, w, h };
        if (!objects.some((o) => intersects(rectOf(o), test))) return { x: nx, y: ny };
      }
    }
  }
  return { x: clamp(snapV(x), 0, ROOM.w - w), y: clamp(snapV(y), 0, ROOM.h - h) };
}

function createByKey() {
  const key = armed || 'desk';
  const t = TYPE_MAP[key];
  const s = selObj();
  let x, y;
  if (s) { x = s.x + s.w + 16; y = s.y; }
  else { x = ROOM.w / 2 - t.w / 2; y = ROOM.h / 2 - t.h / 2; }
  const spot = findFreeSpot(x, y, t.w, t.h);
  pushHistory();
  const o = { id: uid(), type: key, x: spot.x, y: spot.y, w: t.w, h: t.h, rot: 0, label: t.name };
  objects.push(o);
  selectedId = o.id;
  narrateWhere(o, '已放置 ' + t.name + '「' + o.label + '」');
  renderAll();
}

// ---------- 空间操作（全部有键盘等价物） ----------
function select(id) {
  if (selectedId !== id) { selectedId = id; renderAll(); }
}
function cycle(dir) {
  if (!objects.length) return;
  const i = objects.findIndex((o) => o.id === selectedId);
  const j = i < 0 ? (dir > 0 ? 0 : objects.length - 1) : (i + dir + objects.length) % objects.length;
  selectedId = objects[j].id;
  renderAll();
  const o = objects[j];
  const z = zoneOf(o);
  narrate('选中 ' + o.label + ' · ' + (z ? z.name : '未分区') + ' · 方向键移动');
}
function moveSel(dx, dy, push, fine) {
  const o = selObj();
  if (!o) { narrate('未选中物品 — 先按 Tab 选择'); return; }
  if (push) pushHistory();
  o.x = clamp(o.x + dx, 0, ROOM.w - o.w);
  o.y = clamp(o.y + dy, 0, ROOM.h - o.h);
  narrateWhere(o, (fine ? '微调 ' : '移动 ') + o.label);
  renderAll();
}
function rotateSel(dir) {
  const o = selObj();
  if (!o) { narrate('未选中物品 — 先按 Tab 选择'); return; }
  pushHistory();
  const nr = ((o.rot + dir * 90) + 360) % 360;
  const nw = nr % 180 ? o.h : o.w;   // 旋转 90° 后足迹宽高互换（保持 AABB 精确）
  const nh = nr % 180 ? o.w : o.h;
  o.w = nw;
  o.h = nh;
  o.rot = nr;
  o.x = clamp(o.x, 0, ROOM.w - o.w);
  o.y = clamp(o.y, 0, ROOM.h - o.h);
  narrateWhere(o, '已旋转 ' + o.rot + '° · ' + o.label);
  renderAll();
}
function duplicateSel() {
  const o = selObj();
  if (!o) { narrate('未选中物品 — 先按 Tab 选择'); return; }
  pushHistory();
  const spot = findFreeSpot(o.x + 16, o.y + 16, o.w, o.h);
  const c = { id: uid(), type: o.type, x: spot.x, y: spot.y, w: o.w, h: o.h, rot: o.rot, label: o.label + ' 副本' };
  objects.push(c);
  selectedId = c.id;
  narrateWhere(c, '已复制为「' + c.label + '」');
  renderAll();
}
function deleteSel() {
  const o = selObj();
  if (!o) return;
  pushHistory();
  objects = objects.filter((t) => t.id !== o.id);
  selectedId = null;
  narrate('已删除「' + o.label + '」（Ctrl+Z 撤销）');
  renderAll();
}
function zOrder(dir) {
  const o = selObj();
  if (!o) { narrate('未选中物品 — 先按 Tab 选择'); return; }
  const i = objects.findIndex((t) => t.id === o.id);
  const j = i + dir;
  if (j < 0 || j >= objects.length) { narrate('已在这一层'); return; }
  pushHistory();
  objects[i] = objects[j];
  objects[j] = o;
  narrate(dir > 0 ? '「' + o.label + '」上移一层' : '「' + o.label + '」下移一层');
  renderAll();
}
function startRename() {
  const o = selObj();
  if (!o) { narrate('未选中物品 — 先按 Tab 选择'); return; }
  el.iLabelPrev = o.label;
  el.iLabel.focus();
  el.iLabel.select();
}

// ---------- 幽灵预览 ----------
function updateGhost(key, lx, ly) {
  const t = TYPE_MAP[key];
  const x = clamp(snapV(lx - t.w / 2), 0, ROOM.w - t.w);
  const y = clamp(snapV(ly - t.h / 2), 0, ROOM.h - t.h);
  el.ghost.hidden = false;
  el.ghost.style.left = x + 'px';
  el.ghost.style.top = y + 'px';
  el.ghost.style.width = t.w + 'px';
  el.ghost.style.height = t.h + 'px';
  const z = zoneAtPoint(x + t.w / 2, y + t.h / 2);
  el.ghost.innerHTML = t.emoji + ' ' + (z ? z.name : '未分区');
}
function roomPoint(e) {
  const rb = el.room.getBoundingClientRect();
  const x = e.clientX - rb.left;
  const y = e.clientY - rb.top;
  return (x >= 0 && y >= 0 && x <= ROOM.w && y <= ROOM.h) ? { x, y } : null;
}

// ---------- 指针交互 ----------
let drag = null;      // {id, ox, oy, pushed}
let palDrag = null;   // {key, sx, sy, moved}

el.room.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return;
  const p = roomPoint(e);
  if (!p) return;
  if (armed) { placeAt(armed, p.x, p.y); return; }
  const t = e.target.closest('.obj');
  if (t) {
    const o = byId(t.dataset.id);
    select(o.id);
    drag = { id: o.id, ox: p.x - o.x, oy: p.y - o.y, pushed: false };
    el.room.setPointerCapture(e.pointerId);
  } else {
    select(null);
  }
});
el.room.addEventListener('pointermove', (e) => {
  const p = roomPoint(e);
  if (armed && p) updateGhost(armed, p.x, p.y);
  if (!drag) return;
  const o = byId(drag.id);
  if (!o) return;
  if (!drag.pushed) { pushHistory(); drag.pushed = true; }
  if (p) {
    o.x = clamp(snapV(p.x - drag.ox), 0, ROOM.w - o.w);
    o.y = clamp(snapV(p.y - drag.oy), 0, ROOM.h - o.h);
    narrateWhere(o);
    renderAll();
  }
});
el.room.addEventListener('pointerup', () => {
  if (drag) {
    const o = byId(drag.id);
    if (o && drag.pushed) narrateWhere(o, '落位 ' + o.label);
    drag = null;
  }
});
el.room.addEventListener('pointerleave', () => { if (!palDrag) el.ghost.hidden = true; });
el.room.addEventListener('contextmenu', (e) => { e.preventDefault(); onEscape(); });

// 物品栏：点击武装 / 拖拽直接放置
el.palList.addEventListener('pointerdown', (e) => {
  const item = e.target.closest('.pal-item');
  if (!item) return;
  e.preventDefault();
  palDrag = { key: item.dataset.key, sx: e.clientX, sy: e.clientY, moved: false };
});
window.addEventListener('pointermove', (e) => {
  if (palDrag && !palDrag.moved && Math.hypot(e.clientX - palDrag.sx, e.clientY - palDrag.sy) > 5) {
    palDrag.moved = true;
    disarm();
  }
  const key = armed || (palDrag && palDrag.moved && palDrag.key);
  if (!key) return;
  const p = roomPoint(e);
  if (p) updateGhost(key, p.x, p.y);
  else el.ghost.hidden = true;
});
window.addEventListener('pointerup', (e) => {
  if (!palDrag) return;
  const p = roomPoint(e);
  if (palDrag.moved && p) {
    placeAt(palDrag.key, p.x, p.y);
    disarm();
  } else {
    if (armed === palDrag.key) disarm();
    else {
      arm(palDrag.key);
      narrate('已选类型：' + TYPE_MAP[palDrag.key].name + ' — 点击画布落位（可连续盖印），Esc 退出');
    }
  }
  palDrag = null;
});

// ---------- 键盘（空间操作的键盘等价物） ----------
function onEscape() {
  if (helpOpen) { toggleHelp(false); return; }
  if (armed) { disarm(); narrate('已退出放置模式'); return; }
  select(null);
}
function toggleHelp(force) {
  helpOpen = typeof force === 'boolean' ? force : !helpOpen;
  el.help.hidden = !helpOpen;
}

window.addEventListener('keydown', (e) => {
  const tag = (e.target.tagName || '').toLowerCase();
  const typing = tag === 'input' || tag === 'textarea' || e.target.isContentEditable;
  if (typing) {
    if (e.key === 'Escape') {
      if (e.target === el.iLabel && el.iLabelPrev !== undefined) e.target.value = el.iLabelPrev;
      e.target.blur();
    }
    return;
  }
  if (helpOpen) {
    if (e.key === 'Escape' || e.key === '?') { e.preventDefault(); toggleHelp(false); }
    return;
  }
  const ctrl = e.ctrlKey || e.metaKey;
  const k = e.key.toLowerCase();
  if (ctrl && k === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
  if (ctrl && k === 'y') { e.preventDefault(); redo(); return; }
  if (ctrl && k === 'd') { e.preventDefault(); duplicateSel(); return; }
  if (ctrl || e.altKey) return;

  const step = e.shiftKey ? 1 : 10;
  switch (e.key) {
    case 'Tab': e.preventDefault(); cycle(e.shiftKey ? -1 : 1); break;
    case 'ArrowLeft': e.preventDefault(); moveSel(-step, 0, !e.repeat, e.shiftKey); break;
    case 'ArrowRight': e.preventDefault(); moveSel(step, 0, !e.repeat, e.shiftKey); break;
    case 'ArrowUp': e.preventDefault(); moveSel(0, -step, !e.repeat, e.shiftKey); break;
    case 'ArrowDown': e.preventDefault(); moveSel(0, step, !e.repeat, e.shiftKey); break;
    case 'n': case 'N': createByKey(); break;
    case 'r': rotateSel(1); break;
    case 'R': rotateSel(-1); break;
    case 'd': case 'D': duplicateSel(); break;
    case 'Delete': case 'Backspace': e.preventDefault(); deleteSel(); break;
    case 'Enter': case 'F2': e.preventDefault(); startRename(); break;
    case '[': zOrder(-1); break;
    case ']': zOrder(1); break;
    case 'Escape': onEscape(); break;
    case '?': e.preventDefault(); toggleHelp(); break;
    default:
      if (/^[1-8]$/.test(e.key)) {
        const t = TYPES[+e.key - 1];
        arm(t.key);
        narrate('已选类型：' + t.name + ' — 点击画布或按 N 放置');
      }
  }
});

// ---------- 检查器输入 ----------
el.iLabel.addEventListener('focus', () => { el.iLabelPrev = el.iLabel.value; });
el.iLabel.addEventListener('keydown', (e) => { if (e.key === 'Enter') e.target.blur(); });
el.iLabel.addEventListener('change', () => {
  const o = selObj();
  if (!o) return;
  const v = el.iLabel.value.trim();
  if (!v || v === o.label) { el.iLabel.value = o.label; return; }
  pushHistory();
  o.label = v;
  narrate('已重命名为「' + v + '」');
  renderAll();
});
function coordInput(input, axis) {
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') e.target.blur(); });
  input.addEventListener('change', () => {
    const o = selObj();
    if (!o) return;
    pushHistory();
    const v = clamp(snapV(parseFloat(input.value) || 0), 0, (axis === 'x' ? ROOM.w : ROOM.h) - (axis === 'x' ? o.w : o.h));
    o[axis] = v;
    input.value = v;
    narrateWhere(o, '精确落位 ' + o.label);
    renderAll();
  });
}
coordInput(el.iX, 'x');
coordInput(el.iY, 'y');

$('#b-rot').addEventListener('click', () => rotateSel(1));
$('#b-dup').addEventListener('click', duplicateSel);
$('#b-fwd').addEventListener('click', () => zOrder(1));
$('#b-back').addEventListener('click', () => zOrder(-1));
$('#b-del').addEventListener('click', deleteSel);
el.btnUndo.addEventListener('click', undo);
el.btnRedo.addEventListener('click', redo);
$('#btn-help').addEventListener('click', () => toggleHelp());
$('#btn-help-close').addEventListener('click', () => toggleHelp(false));
el.help.addEventListener('click', (e) => { if (e.target === el.help) toggleHelp(false); });

// ---------- 初始化（首屏即就绪，无加载态） ----------
function init() {
  renderZones();
  renderPalette();
  objects = INITIAL_OBJECTS.map((o) => {
    const t = TYPE_MAP[o.type];
    return { w: t.w, h: t.h, rot: 0, label: t.name, x: 0, y: 0, ...o };
  });
  seq = INITIAL_OBJECTS.length;
  selectedId = null;
  renderAll();
  updateModeHint();
  narrate('示例工作室已就绪 · ' + objects.length + ' 件物品 · 按 Tab 选择，方向键移动，? 查看全部快捷键');
}
init();
