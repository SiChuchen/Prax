'use strict';
/* 落位 Floorcraft —— 空间布局工作台
 * 核心模型：对象的物理位置（中心点所在分区）即其归属，摆放即数据。
 * 所有空间操作在 keys.js 中提供键盘等价物。 */

// ── 常量 ─────────────────────────────────
const GRID = 20;
const WORLD = { w: 1280, h: 800 };
const TYPES = {
  chair:  { name: '椅', w: 34,  h: 34 },
  desk:   { name: '桌', w: 120, h: 60 },
  screen: { name: '屏', w: 88,  h: 56 },
  plant:  { name: '植', w: 32,  h: 32 },
  lamp:   { name: '灯', w: 36,  h: 36 },
  box:    { name: '箱', w: 46,  h: 46 },
};
const TYPE_ORDER = ['chair', 'desk', 'screen', 'plant', 'lamp', 'box'];
const ZONES = [
  { id: 'studio',  name: '工作区', x: 40,  y: 40,  w: 560, h: 420, accent: '#5b8def' },
  { id: 'meeting', name: '会议区', x: 680, y: 40,  w: 560, h: 420, accent: '#2fae7d' },
  { id: 'store',   name: '仓储区', x: 40,  y: 500, w: 560, h: 260, accent: '#d0912f' },
  { id: 'gallery', name: '展示区', x: 680, y: 500, w: 560, h: 260, accent: '#a06ae0' },
];

// ── 初始数据（随首屏内联就绪，无加载态）──
function buildInitial() {
  let nextId = 1;
  const counters = {};
  const mk = (type, x, y) => {
    counters[type] = (counters[type] || 0) + 1;
    return {
      id: nextId++, type, x, y, rot: 0, zone: null,
      label: TYPES[type].name + '-' + String(counters[type]).padStart(2, '0'),
    };
  };
  const objects = [
    ['desk', 160, 180], ['desk', 300, 300], ['chair', 160, 260], ['chair', 300, 220],
    ['screen', 220, 120], ['plant', 540, 120], ['lamp', 360, 180],
    ['desk', 900, 250],
    ['chair', 820, 170], ['chair', 980, 170], ['chair', 820, 330],
    ['chair', 980, 330], ['chair', 900, 140], ['chair', 900, 360],
    ['screen', 1160, 120],
    ['box', 120, 560], ['box', 180, 560], ['box', 120, 640], ['box', 180, 640],
    ['chair', 300, 600], ['lamp', 420, 600],
    ['plant', 740, 560], ['plant', 740, 660], ['lamp', 940, 560], ['box', 940, 660],
    ['chair', 640, 480], ['box', 640, 300], // 走廊上的两件 → 未落位
  ].map((a) => mk(a[0], a[1], a[2]));
  return { objects, nextId, counters };
}

// ── 状态 ─────────────────────────────────
const state = {
  objects: [], sel: new Set(), snap: true, addType: 'chair',
  view: { x: 0, y: 0, w: WORLD.w, h: WORLD.h },
};
let lastInit = buildInitial();

// ── DOM 引用 ─────────────────────────────
const $ = (s) => document.querySelector(s);
const stage = $('#stage'), viewG = $('#view'), objectsLayer = $('#objectsLayer');
const zonesLayer = $('#zonesLayer'), marqueeEl = $('#marquee');
const ledgerBody = $('#ledgerBody'), toastsEl = $('#toasts');
const stSel = $('#stSel'), stCount = $('#stCount'), stSnap = $('#stSnap'), stZoom = $('#stZoom');
const btnSnap = $('#btnSnap'), helpOverlay = $('#helpOverlay');

// ── 分区归属：中心点落在哪即归属哪 ────────
function zoneOf(o) {
  for (const z of ZONES) {
    if (o.x >= z.x && o.x <= z.x + z.w && o.y >= z.y && o.y <= z.y + z.h) return z;
  }
  return null;
}
const zoneById = (id) => ZONES.find((z) => z.id === id) || null;
function refreshMembership() {
  for (const o of state.objects) o.zone = zoneOf(o) ? zoneOf(o).id : null;
}

// ── 渲染 ─────────────────────────────────
function zoneLayerSVG() {
  let s = '';
  for (const z of ZONES) {
    s += `<g><rect class="zone-rect" x="${z.x}" y="${z.y}" width="${z.w}" height="${z.h}" `
      + `fill="${z.accent}" fill-opacity="0.055" stroke="${z.accent}" stroke-opacity="0.45" stroke-width="1.5"/>`
      + `<text class="zone-name" x="${z.x + 18}" y="${z.y + 28}" fill="${z.accent}">${z.name}</text>`
      + `<text class="zone-sub" x="${z.x + 18}" y="${z.y + 46}">${z.id}</text></g>`;
  }
  return s;
}

function objSVG(o) {
  const t = TYPES[o.type];
  const z = zoneById(o.zone);
  const acc = z ? z.accent : '#7d8798';
  const sel = state.sel.has(o.id);
  const rot = o.rot ? ` transform="rotate(${o.rot} ${o.x} ${o.y})"` : '';
  const L = o.x - t.w / 2, T = o.y - t.h / 2;
  let body = '';
  switch (o.type) {
    case 'desk':
      body = `<rect class="body" x="${L}" y="${T}" width="${t.w}" height="${t.h}" rx="9"/>`
        + `<rect x="${L + 10}" y="${T + 8}" width="${t.w - 20}" height="5" rx="2.5" fill="${acc}" fill-opacity="0.5"/>`;
      break;
    case 'chair':
      body = `<circle class="body" cx="${o.x}" cy="${o.y}" r="16"/>`
        + `<circle cx="${o.x}" cy="${o.y}" r="6" fill="none" stroke="${acc}" stroke-width="2"/>`;
      break;
    case 'screen':
      body = `<rect class="body" x="${L}" y="${T}" width="${t.w}" height="${t.h}" rx="6"/>`
        + `<rect x="${L + 8}" y="${T + 8}" width="${t.w - 16}" height="${t.h - 16}" rx="3" fill="${acc}" fill-opacity="0.35"/>`;
      break;
    case 'plant':
      body = `<circle class="body" cx="${o.x}" cy="${o.y}" r="15"/>`
        + `<path d="M${o.x} ${o.y - 12} L${o.x} ${o.y + 12} M${o.x - 10} ${o.y - 6} L${o.x + 10} ${o.y + 6} `
        + `M${o.x + 10} ${o.y - 6} L${o.x - 10} ${o.y + 6}" stroke="${acc}" stroke-width="2" fill="none" stroke-linecap="round"/>`;
      break;
    case 'lamp':
      body = `<polygon class="body" points="${o.x},${o.y - 17} ${o.x + 17},${o.y} ${o.x},${o.y + 17} ${o.x - 17},${o.y}"/>`
        + `<circle cx="${o.x}" cy="${o.y}" r="3.5" fill="${acc}"/>`;
      break;
    default: // box
      body = `<rect class="body" x="${L}" y="${T}" width="${t.w}" height="${t.h}" rx="5"/>`
        + `<line x1="${L}" y1="${o.y}" x2="${L + t.w}" y2="${o.y}" stroke="${acc}" stroke-width="2" stroke-opacity="0.7"/>`;
  }
  const ring = sel
    ? `<rect class="selring" x="${L - 7}" y="${T - 7}" width="${t.w + 14}" height="${t.h + 14}" rx="10"/>`
    : '';
  const labelY = o.y + t.h / 2 + 14;
  return `<g class="obj${sel ? ' sel' : ''}${z ? '' : ' unplaced'}" data-id="${o.id}">`
    + `${ring}<g${rot}><g stroke="${acc}" stroke-width="2">${body}</g></g>`
    + `<text x="${o.x}" y="${labelY}" fill="${z ? acc : '#7d8798'}">${o.label}</text></g>`;
}

function render() {
  stage.setAttribute('viewBox', `${state.view.x} ${state.view.y} ${state.view.w} ${state.view.h}`);
  let s = '';
  for (const o of state.objects) s += objSVG(o);
  objectsLayer.innerHTML = s;
  renderLedger();
  renderStatus();
}

function renderLedger() {
  const groups = ZONES.map((z) => ({ z, items: [] }));
  const loose = { z: null, items: [] };
  for (const o of state.objects) {
    const g = groups.find((g) => g.z.id === o.zone);
    (g ? g.items : loose.items).push(o);
  }
  let html = '';
  for (const g of [...groups, loose]) {
    const acc = g.z ? g.z.accent : '#7d8798';
    const name = g.z ? g.z.name : '未落位';
    html += `<div class="zgroup${g.items.length ? '' : ' empty'}">`
      + `<div class="zhead"><span class="zdot" style="background:${acc}"></span>`
      + `<span class="zname">${name}</span><span class="zcount">${g.items.length} 件</span></div>`
      + `<div class="chips">`
      + g.items.map((o) => `<button class="chip" data-id="${o.id}" style="--acc:${acc}" title="选中 ${o.label}">${o.label}</button>`).join('')
      + `</div></div>`;
  }
  ledgerBody.innerHTML = html;
}

function renderStatus() {
  const ids = [...state.sel];
  if (ids.length) {
    const o = state.objects.find((o) => o.id === ids[0]);
    if (o) {
      const z = zoneById(o.zone);
      const extra = ids.length > 1 ? ` 等 ${ids.length} 件` : '';
      stSel.textContent = `已选 ${o.label}${extra} · ${z ? z.name : '未落位'} · (${Math.round(o.x)}, ${Math.round(o.y)})${o.rot ? ' · ' + o.rot + '°' : ''}`;
    }
  } else {
    stSel.textContent = '未选中（Tab 循环选择对象）';
  }
  stCount.textContent = `对象 ${state.objects.length} · 已选 ${state.sel.size}`;
  stSnap.textContent = `吸附 ${state.snap ? '开' : '关'}`;
  stZoom.textContent = `缩放 ${Math.round(WORLD.w / state.view.w * 100)}%`;
  btnSnap.classList.toggle('on', state.snap);
}

// ── 提示 toast ───────────────────────────
function toast(msg) {
  const d = document.createElement('div');
  d.className = 'toast';
  d.innerHTML = msg;
  toastsEl.appendChild(d);
  requestAnimationFrame(() => d.classList.add('in'));
  setTimeout(() => { d.classList.remove('in'); setTimeout(() => d.remove(), 300); }, 1700);
  while (toastsEl.children.length > 3) toastsEl.firstChild.remove();
}

// ── 坐标换算 / 视图 ───────────────────────
function toWorld(e) {
  const m = viewG.getScreenCTM();
  if (!m) return { x: 0, y: 0 };
  const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
  return { x: p.x, y: p.y };
}
function clampView() {
  const v = state.view;
  v.w = Math.min(2560, Math.max(320, v.w));
  v.h = v.w * WORLD.h / WORLD.w;
  v.x = Math.min(WORLD.w, Math.max(-WORLD.w, v.x));
  v.y = Math.min(WORLD.h, Math.max(-WORLD.h, v.y));
}
function setView(x, y, w) {
  state.view = { x, y, w, h: w * WORLD.h / WORLD.w };
  clampView();
  render();
}
function zoomAt(ax, ay, f) {
  const v = state.view;
  const nw = Math.min(2560, Math.max(320, v.w * f));
  const rf = nw / v.w;
  setView(ax - (ax - v.x) * rf, ay - (ay - v.y) * rf, nw);
}
const viewCenter = () => ({ x: state.view.x + state.view.w / 2, y: state.view.y + state.view.h / 2 });

// ── 空位查找 ─────────────────────────────
function freeSlotInZone(z, avoid) {
  const cands = [];
  for (let gy = z.y + 60; gy <= z.y + z.h - 40; gy += 70)
    for (let gx = z.x + 70; gx <= z.x + z.w - 70; gx += 85)
      cands.push({ x: gx, y: gy, d: Math.hypot(gx - (z.x + z.w / 2), gy - (z.y + z.h / 2)) });
  cands.sort((a, b) => a.d - b.d);
  for (const c of cands) {
    if (!avoid.some((o) => Math.hypot(o.x - c.x, o.y - c.y) < 56)) return c;
  }
  return { x: z.x + z.w / 2, y: z.y + z.h / 2 };
}
function freeSpotNear(px, py, avoid) {
  if (!avoid.some((o) => Math.hypot(o.x - px, o.y - py) < 56)) return { x: px, y: py };
  for (let ring = 1; ring <= 8; ring++) {
    for (let a = 0; a < 8; a++) {
      const x = px + Math.cos(a * Math.PI / 4) * ring * 55;
      const y = py + Math.sin(a * Math.PI / 4) * ring * 55;
      if (x < 30 || x > WORLD.w - 30 || y < 30 || y > WORLD.h - 30) continue;
      if (!avoid.some((o) => Math.hypot(o.x - x, o.y - y) < 56)) return { x, y };
    }
  }
  return { x: px, y: py };
}

// ── 操作（键盘等价物见 keys.js）──────────
const snapv = (v) => (state.snap ? Math.round(v / GRID) * GRID : v);
const sortedSel = () => state.objects.filter((o) => state.sel.has(o.id));

function labelFor(type) {
  let mx = 0;
  for (const o of state.objects) {
    if (o.type !== type) continue;
    const m = /-(\d+)$/.exec(o.label);
    if (m) mx = Math.max(mx, +m[1]);
  }
  return TYPES[type].name + '-' + String(mx + 1).padStart(2, '0');
}

function moveSelection(dx, dy) {
  for (const o of sortedSel()) { o.x += dx; o.y += dy; }
  commitMove();
}
function commitMove() {
  const before = new Map(state.objects.map((o) => [o.id, o.zone]));
  refreshMembership();
  for (const o of sortedSel()) {
    if (before.get(o.id) !== o.zone) {
      const z = zoneById(o.zone);
      toast(`<b>${o.label}</b> 落入 ${z ? z.name : '未落位'}`);
    }
  }
  render();
}
function moveByKeyboard(dx, dy) {
  moveSelection(dx, dy); // 内部已 render；移动不逐次刷 toast，状态栏坐标足够反馈
}

function sendToZone(zoneId) {
  const z = zoneById(zoneId);
  if (!z) return;
  const sel = sortedSel();
  if (!sel.length) { toast('未选中对象——先用 Tab 选择'); return; }
  const others = state.objects.filter((o) => !state.sel.has(o.id));
  for (const o of sel) {
    const slot = freeSlotInZone(z, others);
    o.x = Math.round(slot.x); o.y = Math.round(slot.y);
    others.push(o);
  }
  const before = sel.map((o) => [o.id, o.zone]);
  refreshMembership();
  sel.forEach((o, i) => {
    if (before[i][1] !== o.zone) toast(`<b>${o.label}</b> → ${z.name}`);
  });
  render();
}

function addNode() {
  const label = labelFor(state.addType);
  const c0 = viewCenter();
  const spot = freeSpotNear(Math.round(c0.x), Math.round(c0.y), state.objects);
  const o = { id: nextId(), type: state.addType, x: snapv(spot.x), y: snapv(spot.y), rot: 0, zone: null, label };
  state.objects.push(o);
  refreshMembership();
  state.sel = new Set([o.id]);
  const z = zoneById(o.zone);
  toast(`新增 <b>${o.label}</b>${z ? ' → ' + z.name : '（未落位）'}`);
  render();
}
let _nextId = 0;
function nextId() { return ++_nextId; }

function duplicateSelection() {
  const sel = sortedSel();
  if (!sel.length) return;
  const created = [];
  for (const o of sel) {
    const c = {
      id: nextId(), type: o.type, rot: o.rot, zone: null,
      x: o.x + GRID, y: o.y + GRID, label: '',
    };
    c.label = labelFor(c.type);
    state.objects.push(c); // 立即入栈：多个副本编号连续递增
    created.push(c);
  }
  refreshMembership();
  state.sel = new Set(created.map((o) => o.id));
  toast(`已复制 ${created.length} 件（<b>D</b>）`);
  render();
}

function deleteSelection() {
  if (!state.sel.size) return;
  const n = state.sel.size;
  const names = sortedSel().slice(0, 2).map((o) => o.label).join('、');
  state.objects = state.objects.filter((o) => !state.sel.has(o.id));
  state.sel.clear();
  toast(`已删除 ${n} 件（${names}${n > 2 ? '…' : ''}）`);
  render();
}

function cycleType() {
  const sel = sortedSel();
  if (!sel.length) return;
  for (const o of sel) {
    o.type = TYPE_ORDER[(TYPE_ORDER.indexOf(o.type) + 1) % TYPE_ORDER.length];
    o.label = labelFor(o.type);
  }
  refreshMembership();
  toast(`已切换类型（<b>T</b>）→ ${TYPES[sel[0].type].name}`);
  render();
}

function rotateSelection(dir) {
  const sel = sortedSel();
  if (!sel.length) return;
  for (const o of sel) o.rot = ((o.rot + dir * 15) % 360 + 360) % 360;
  renderStatus();
  render();
}

function cycleSelect(back) {
  if (!state.objects.length) return;
  const list = [...state.objects].sort((a, b) => a.id - b.id);
  const cur = list.findIndex((o) => state.sel.has(o.id));
  const i = back
    ? (cur <= 0 ? list.length - 1 : cur - 1)
    : (cur === -1 || cur === list.length - 1 ? 0 : cur + 1);
  state.sel = new Set([list[i].id]);
  render();
}

function selectAll() { state.sel = new Set(state.objects.map((o) => o.id)); render(); }
function clearSelection() { state.sel.clear(); render(); }
function toggleSnap() { state.snap = !state.snap; toast(`网格吸附 ${state.snap ? '开' : '关'}（<b>G</b>）`); render(); }
function resetData() {
  lastInit = buildInitial();
  state.objects = lastInit.objects;
  _nextId = lastInit.nextId;
  state.sel.clear();
  state.snap = true;
  setView(0, 0, WORLD.w);
  toast('已恢复初始布局');
}

// ── 指针交互（拖拽 = 键盘的等价操作）──────
let drag = null;
let spaceDown = false;

stage.addEventListener('pointerdown', (e) => {
  if (e.button !== 0 && e.button !== 1) return;
  try { stage.setPointerCapture(e.pointerId); } catch (_) {}
  const w = toWorld(e);
  if (spaceDown || e.button === 1) {
    drag = { mode: 'pan', sx: e.clientX, sy: e.clientY, v: { ...state.view } };
    stage.classList.add('panning');
    return;
  }
  const g = e.target instanceof Element ? e.target.closest('g.obj') : null;
  if (g) {
    const id = +g.dataset.id;
    if (e.shiftKey) {
      state.sel.has(id) ? state.sel.delete(id) : state.sel.add(id);
    } else if (!state.sel.has(id)) {
      state.sel = new Set([id]);
    }
    drag = { mode: 'move', start: w, moved: false };
    render();
  } else {
    drag = { mode: 'marquee', start: w, base: new Set(state.sel), add: e.shiftKey };
    if (!e.shiftKey) { state.sel.clear(); }
    render();
  }
});

stage.addEventListener('pointermove', (e) => {
  if (!drag) return;
  if (drag.mode === 'pan') {
    const k = state.view.w / (stage.clientWidth || 1);
    state.view.x = drag.v.x - (e.clientX - drag.sx) * k;
    state.view.y = drag.v.y - (e.clientY - drag.sy) * k;
    clampView();
    stage.setAttribute('viewBox', `${state.view.x} ${state.view.y} ${state.view.w} ${state.view.h}`);
    renderStatus();
    return;
  }
  const w = toWorld(e);
  if (drag.mode === 'move') {
    let dx = w.x - drag.start.x, dy = w.y - drag.start.y;
    dx = snapv(dx); dy = snapv(dy);
    if (dx || dy) {
      drag.moved = true;
      const sel = sortedSel();
      if (!drag.orig) drag.orig = new Map(sel.map((o) => [o.id, { x: o.x, y: o.y }]));
      for (const o of sel) {
        const p = drag.orig.get(o.id);
        o.x = p.x + dx; o.y = p.y + dy;
      }
      commitMove();
    }
  } else if (drag.mode === 'marquee') {
    drag.cur = w;
    drawMarquee(drag);
    previewMarquee(drag);
  }
});

stage.addEventListener('pointerup', (e) => {
  if (!drag) return;
  if (drag.mode === 'marquee') {
    marqueeEl.setAttribute('hidden', '');
    if (drag.cur) previewMarquee(drag, true);
  }
  if (drag.mode === 'pan') stage.classList.remove('panning');
  drag = null;
});
stage.addEventListener('pointercancel', () => { drag = null; stage.classList.remove('panning'); });

function drawMarquee(d) {
  const x = Math.min(d.start.x, d.cur.x), y = Math.min(d.start.y, d.cur.y);
  marqueeEl.removeAttribute('hidden');
  marqueeEl.setAttribute('x', x); marqueeEl.setAttribute('y', y);
  marqueeEl.setAttribute('width', Math.abs(d.cur.x - d.start.x));
  marqueeEl.setAttribute('height', Math.abs(d.cur.y - d.start.y));
}
function previewMarquee(d, final) {
  const x1 = Math.min(d.start.x, d.cur.x), x2 = Math.max(d.start.x, d.cur.x);
  const y1 = Math.min(d.start.y, d.cur.y), y2 = Math.max(d.start.y, d.cur.y);
  const hit = state.objects.filter((o) => {
    const t = TYPES[o.type];
    return o.x + t.w / 2 >= x1 && o.x - t.w / 2 <= x2 && o.y + t.h / 2 >= y1 && o.y - t.h / 2 <= y2;
  });
  const ids = new Set(d.base);
  for (const o of hit) {
    if (d.add && ids.has(o.id) && !final) ids.delete(o.id);
    else ids.add(o.id);
  }
  if (final) {
    state.sel = ids;
    render();
  } else {
    state.sel = ids;
    // 只更新对象层与状态栏，避免重建 ledger 造成的开销
    let s = '';
    for (const o of state.objects) s += objSVG(o);
    objectsLayer.innerHTML = s;
    renderStatus();
  }
}

stage.addEventListener('wheel', (e) => {
  e.preventDefault();
  const w = toWorld(e);
  zoomAt(w.x, w.y, e.deltaY < 0 ? 1 / 1.12 : 1.12);
}, { passive: false });

// ── 台账 chip 点击选择 ────────────────────
ledgerBody.addEventListener('click', (e) => {
  const c = e.target instanceof Element ? e.target.closest('.chip') : null;
  if (!c) return;
  const id = +c.dataset.id;
  if (e.shiftKey) state.sel.has(id) ? state.sel.delete(id) : state.sel.add(id);
  else state.sel = new Set([id]);
  render();
});

// ── 工具栏 ───────────────────────────────
const typeSeg = $('#typeSeg');
function renderTypeSeg() {
  typeSeg.innerHTML = TYPE_ORDER.map((t) =>
    `<button data-type="${t}" class="${state.addType === t ? 'on' : ''}" title="新增类型：${TYPES[t].name}">${TYPES[t].name}</button>`
  ).join('');
}
typeSeg.addEventListener('click', (e) => {
  const b = e.target instanceof Element ? e.target.closest('button[data-type]') : null;
  if (!b) return;
  state.addType = b.dataset.type;
  renderTypeSeg();
});
$('#btnAdd').addEventListener('click', addNode);
btnSnap.addEventListener('click', toggleSnap);
$('#btnReset').addEventListener('click', resetData);
$('#btnHelp').addEventListener('click', () => { helpOverlay.hidden = !helpOverlay.hidden; });
$('#btnCloseHelp').addEventListener('click', () => { helpOverlay.hidden = true; });
$('#zIn').addEventListener('click', () => { const c = viewCenter(); zoomAt(c.x, c.y, 1 / 1.25); });
$('#zOut').addEventListener('click', () => { const c = viewCenter(); zoomAt(c.x, c.y, 1.25); });
$('#zFit').addEventListener('click', () => setView(0, 0, WORLD.w));

// ── 启动：首屏即就绪 ─────────────────────
state.objects = lastInit.objects;
_nextId = lastInit.nextId;
refreshMembership();
$('#gridLayer').innerHTML = `<rect width="${WORLD.w}" height="${WORLD.h}" fill="url(#dots)"/>`;
zonesLayer.innerHTML = zoneLayerSVG();
renderTypeSeg();
render();

// 供 keys.js / 自检使用
window.__fc = { state, TYPES, TYPE_ORDER, ZONES, GRID, WORLD, zoneById, moveByKeyboard,
  sendToZone, addNode, duplicateSelection, deleteSelection, cycleType, rotateSelection,
  cycleSelect, selectAll, clearSelection, toggleSnap, setView, zoomAt, resetData,
  toggleHelp: () => { helpOverlay.hidden = !helpOverlay.hidden; }, helpOpen: () => !helpOverlay.hidden };
