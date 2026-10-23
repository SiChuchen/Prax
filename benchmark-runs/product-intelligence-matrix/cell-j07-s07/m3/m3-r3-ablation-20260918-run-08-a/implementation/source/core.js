'use strict';
/* ============ Locus · 落位画布 — core: state / data / render ============ */

const GRID = 20;              // 栅格步长
const OW = 200, OH = 76;      // 对象默认尺寸

// 三个语义区：物理落位即状态（落位即意图）
const ZONES = [
  { id: 'pool',   name: '待选池 Pool',   hint: '先扔进来再说',       color: 'var(--pool)',   x: 0,    y: 0, w: 480, h: 620 },
  { id: 'staged', name: '就位区 Staged', hint: '排期与依赖已确认',   color: 'var(--staged)', x: 540,  y: 0, w: 480, h: 620 },
  { id: 'locked', name: '定稿区 Locked', hint: '落位即承诺',         color: 'var(--locked)', x: 1080, y: 0, w: 480, h: 620 },
];

const state = {
  objects: [],        // {id,title,x,y,w,h,z,zone}
  sel: new Set(),     // 选中的对象 id
  panX: 0, panY: 0, zoom: 1,
  snap: true,
  editingId: null,
};

let undoStack = [], redoStack = [], nextId = 1;
let worldEl, viewportEl, bandEl;

/* ---------- 初始数据：随首屏就绪，无加载态 ---------- */
function seedObjects() {
  const seed = [
    ['竞品扫描笔记',      60,   80,  'pool'],
    ['用户访谈纪要',      280,  140, 'pool'],
    ['灵感：离线模式',    80,   300, 'pool'],
    ['数据看板草图',      260,  420, 'pool'],
    ['发布清单 v0.9',     600,  80,  'staged'],
    ['定价草案 v2',       820,  180, 'staged'],
    ['错误页文案三则',    620,  360, 'staged'],
    ['品牌命名「Locus」', 1120, 100, 'locked'],
    ['首屏信息架构图',    1140, 320, 'locked'],
  ];
  state.objects = seed.map(([title, x, y, zone], i) => {
    const o = { id: nextId++, title, x, y, w: OW, h: OH, z: i + 1, zone };
    return o;
  });
}

/* ---------- 几何 / 区归属 ---------- */
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const snapV = v => state.snap ? Math.round(v / GRID) * GRID : Math.round(v);

function zoneAt(cx, cy) {
  for (const zn of ZONES)
    if (cx >= zn.x && cx <= zn.x + zn.w && cy >= zn.y && cy <= zn.y + zn.h) return zn.id;
  return null;
}
function recomputeZone(o) {
  const z = zoneAt(o.x + o.w / 2, o.y + o.h / 2);
  return z !== o.zone ? (o.zone = z, true) : false;
}
const zoneName = id => (ZONES.find(zn => zn.id === id) || { name: '区外' }).name;

/* ---------- 撤销 / 重做（对象数组快照） ---------- */
function pushUndo() {
  undoStack.push(JSON.stringify(state.objects));
  if (undoStack.length > 100) undoStack.shift();
  redoStack.length = 0;
}
function undo() {
  if (!undoStack.length) return toast('没有可撤销的操作');
  redoStack.push(JSON.stringify(state.objects));
  state.objects = JSON.parse(undoStack.pop());
  state.sel.clear(); stopEdit(false);
  fullRender(); toast('已撤销');
}
function redo() {
  if (!redoStack.length) return toast('没有可重做的操作');
  undoStack.push(JSON.stringify(state.objects));
  state.objects = JSON.parse(redoStack.pop());
  state.sel.clear(); stopEdit(false);
  fullRender(); toast('已重做');
}

/* ---------- 渲染 ---------- */
function screenToWorld(sx, sy) {
  const r = viewportEl.getBoundingClientRect();
  return { x: (sx - r.left - state.panX) / state.zoom,
           y: (sy - r.top  - state.panY) / state.zoom };
}

function buildZones() {
  for (const zn of ZONES) {
    const el = document.createElement('div');
    el.className = 'zone'; el.dataset.zone = zn.id;
    el.style.cssText = `left:${zn.x}px;top:${zn.y}px;width:${zn.w}px;height:${zn.h}px;--zc:${zn.color}`;
    el.innerHTML = `<div class="zone-head"><span class="zname">${zn.name}</span>` +
      `<span class="zcount" data-count>0</span><span class="zhint">${zn.hint}</span></div>`;
    worldEl.appendChild(el);
  }
}

function objEl(o) {
  const el = document.createElement('div');
  el.className = `obj zone-${o.zone || 'none'}` + (state.sel.has(o.id) ? ' selected' : '');
  el.dataset.id = o.id;
  el.style.cssText = `left:${o.x}px;top:${o.y}px;width:${o.w}px;height:${o.h}px;z-index:${o.z + 10}`;
  el.innerHTML =
    `<div class="obj-bar"></div><div class="obj-body">` +
    `<div class="obj-title"${state.editingId === o.id ? ' contenteditable="true"' : ''}>${o.title}</div>` +
    `<div class="obj-meta"><span class="dot"></span><span>${zoneName(o.zone)}</span>` +
    `<span style="margin-left:auto">z${o.z}</span></div></div>`;
  return el;
}

let toastTimer = null;
function toast(msg) {
  const t = document.getElementById('st-toast');
  t.textContent = msg;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.textContent = ''; }, 2600);
}

function updateStatus() {
  document.getElementById('st-zoom').textContent = Math.round(state.zoom * 100) + '%';
  document.getElementById('st-snap').textContent = '吸附 ' + (state.snap ? '开' : '关');
  const n = state.sel.size;
  let selTxt = n === 0 ? '未选中' : `已选 ${n} 个`;
  if (n === 1) {
    const o = state.objects.find(x => x.id === [...state.sel][0]);
    selTxt += ` ·「${o.title}」@ ${zoneName(o.zone)}`;
  }
  document.getElementById('st-sel').textContent = selTxt;
  document.getElementById('btn-undo').disabled = !undoStack.length;
  document.getElementById('btn-redo').disabled = !redoStack.length;
}

function fullRender() {
  // world 变换
  worldEl.style.transform = `translate(${state.panX}px,${state.panY}px) scale(${state.zoom})`;
  // 对象（保留 zone 节点：按 data-obj 前缀清理）
  for (const el of [...worldEl.querySelectorAll('.obj')]) el.remove();
  const frag = document.createDocumentFragment();
  for (const o of state.objects) frag.appendChild(objEl(o));
  worldEl.appendChild(frag);
  // 区计数
  for (const zn of ZONES) {
    const c = worldEl.querySelector(`.zone[data-zone="${zn.id}"] [data-count]`);
    c.textContent = state.objects.filter(o => o.zone === zn.id).length;
  }
  // 区高亮（跟随所选对象所在区）
  const hot = new Set([...state.sel].map(id => state.objects.find(o => o.id === id)?.zone));
  for (const el of worldEl.querySelectorAll('.zone'))
    el.classList.toggle('hot', hot.has(el.dataset.zone));
  // 工具按钮态
  document.getElementById('btn-snap').classList.toggle('on', state.snap);
  updateStatus();
}

/* 适应全部：让三个区完整可见并居中 */
function fitAll() {
  const bw = ZONES[ZONES.length - 1].x + ZONES[ZONES.length - 1].w + 80;
  const bh = ZONES[0].h + 80;
  const vw = viewportEl.clientWidth, vh = viewportEl.clientHeight;
  state.zoom = clamp(Math.min(vw / bw, vh / bh), 0.25, 1.6);
  state.panX = (vw - bw * state.zoom) / 2 + 40 * state.zoom;
  state.panY = (vh - bh * state.zoom) / 2 + 40 * state.zoom;
  fullRender();
}

/* ---------- 对象操作（键盘与鼠标共用入口） ---------- */
function createObject(wx, wy, openEditor = true) {
  pushUndo();
  const o = { id: nextId++, title: '新对象', x: snapV(wx - OW / 2), y: snapV(wy - OH / 2),
              w: OW, h: OH, z: state.objects.reduce((m, q) => Math.max(m, q.z), 0) + 1, zone: null };
  recomputeZone(o);
  state.objects.push(o);
  state.sel = new Set([o.id]);
  fullRender();
  toast(`已创建「${o.title}」@ ${zoneName(o.zone)}`);
  if (openEditor) startEdit(o.id);
  return o;
}

function duplicateSelected() {
  const src = state.objects.filter(o => state.sel.has(o.id));
  if (!src.length) return toast('先选中一个对象');
  pushUndo();
  const created = src.map(o => ({ ...o, id: nextId++, x: o.x + 24, y: o.y + 24,
                                  z: state.objects.reduce((m, q) => Math.max(m, q.z), 0) + 1 }));
  state.objects.push(...created);
  state.sel = new Set(created.map(o => o.id));
  fullRender();
  toast(`已复制 ${created.length} 个对象`);
}

function deleteSelected() {
  if (!state.sel.size) return toast('先选中对象再删除');
  pushUndo();
  const n = state.sel.size;
  state.objects = state.objects.filter(o => !state.sel.has(o.id));
  state.sel.clear();
  fullRender();
  toast(`已删除 ${n} 个对象（可撤销）`);
}

function nudgeSelected(dx, dy) {
  if (!state.sel.size) return;
  for (const o of state.objects) {
    if (!state.sel.has(o.id)) continue;
    o.x += dx; o.y += dy;
    if (recomputeZone(o)) toast(`「${o.title}」落位 → ${zoneName(o.zone)}`);
  }
  fullRender();
}

function moveSelectedToZone(zoneIdx) {
  const zn = ZONES[zoneIdx];
  if (!zn || !state.sel.size) return;
  pushUndo();
  let i = 0;
  for (const o of state.objects) {
    if (!state.sel.has(o.id)) continue;
    o.x = snapV(zn.x + 40 + (i % 3) * (OW + 20));
    o.y = snapV(zn.y + 60 + Math.floor(i / 3) * (OH + 16));
    recomputeZone(o); i++;
  }
  fullRender();
  toast(`已落位 → ${zn.name}`);
}

function reorderSelected(delta) {
  if (!state.sel.size) return;
  pushUndo();
  for (const o of state.objects)
    if (state.sel.has(o.id)) o.z = Math.max(1, o.z + delta);
  fullRender();
  toast(delta > 0 ? '前移一层' : '后移一层');
}

/* ---------- 标题编辑 ---------- */
let editSaved = null;
function startEdit(id) {
  stopEdit(true);
  state.editingId = id;
  fullRender();
  const el = worldEl.querySelector(`.obj[data-id="${id}"] .obj-title`);
  if (!el) return;
  editSaved = el.textContent;
  el.focus();
  getSelection().selectAllChildren(el);
}
function stopEdit(commit) {
  const id = state.editingId;
  if (!id) return;
  const el = worldEl.querySelector(`.obj[data-id="${id}"] .obj-title`);
  const o = state.objects.find(x => x.id === id);
  if (el && o) {
    if (commit) {
      const t = el.textContent.trim() || '未命名';
      if (t !== editSaved) { pushUndo(); o.title = t; }
    } else if (editSaved != null) {
      o.title = editSaved; // Esc 取消：直接回滚标题，不动撤销栈
    }
  }
  state.editingId = null; editSaved = null;
  fullRender();
}
