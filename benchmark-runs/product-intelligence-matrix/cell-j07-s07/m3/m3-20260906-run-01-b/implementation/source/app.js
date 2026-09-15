"use strict";
/*
 * 落位台 SetPlot — cell-j07-s07（create × spatial-workspace）
 *
 * 用户任务：create 空间对象；成功标准：落位即意图 ——
 * 物件中心点落入某分区（placed_in）⇒ 其用途标签即时由该分区推导，无需任何表单。
 * 验收种子：每个空间操作都有键盘等价物（? 打开速查）。
 *
 * 区域契约（SDIR）：dominant_workspace 主画布 / contextual_inspector 底部状态条 /
 * supporting_toolbar 顶栏 / keyboard_reference_overlay 任务驱动覆盖层。
 */

/* ---------- 世界与数据 ---------- */

const WORLD = { w: 1120, h: 660 };
const GRID = 8;            // 键盘微移步长 / 网格
const BIG_STEP = 32;       // Shift+方向
const SNAP_TOL = 8;        // 智能对齐吸附阈值

const ZONES = [
  { id: "zone-display", name: "展示区", purpose: "对外展示", x: 40,  y: 40,  w: 300, h: 300, tone: "blue"   },
  { id: "zone-hands",   name: "体验区", purpose: "动手体验", x: 380, y: 40,  w: 420, h: 420, tone: "green"  },
  { id: "zone-debug",   name: "调试角", purpose: "调试待修", x: 840, y: 40,  w: 240, h: 200, tone: "orange" },
  { id: "zone-staging", name: "暂存区", purpose: "备料暂存", x: 840, y: 280, w: 240, h: 320, tone: "violet" },
];

const TYPES = {
  equipment: { label: "设备", color: "#b7791f" },
  display:   { label: "展陈", color: "#2b6cb0" },
  tool:      { label: "工具", color: "#c05040" },
  kit:       { label: "套件", color: "#6b46c1" },
  table:     { label: "台面", color: "#2f855a" },
  deco:      { label: "软装", color: "#0d7f8c" },
  cart:      { label: "移动", color: "#5a6270" },
  part:      { label: "物料", color: "#8a8f9c" },
};

/* 首屏内联初始数据：页面加载完成即处于可用状态（无加载态、无空态首屏） */
const INITIAL_ITEMS = [
  { id: "it-01", name: "3D 打印机", type: "equipment", x: 60,  y: 80,  w: 130, h: 80 },
  { id: "it-02", name: "作品墙",   type: "display",   x: 220, y: 80,  w: 100, h: 70 },
  { id: "it-03", name: "示例展柜", type: "display",   x: 70,  y: 200, w: 130, h: 80 },
  { id: "it-04", name: "白板",     type: "deco",      x: 230, y: 250, w: 90,  h: 60 },
  { id: "it-05", name: "焊台",     type: "tool",      x: 410, y: 80,  w: 110, h: 70 },
  { id: "it-06", name: "示波器",   type: "tool",      x: 550, y: 80,  w: 110, h: 70 },
  { id: "it-07", name: "机械臂",   type: "kit",       x: 410, y: 200, w: 130, h: 90 },
  { id: "it-08", name: "套件桌",   type: "table",     x: 580, y: 220, w: 150, h: 80 },
  { id: "it-09", name: "绿植",     type: "deco",      x: 700, y: 370, w: 70,  h: 70 },
  { id: "it-10", name: "工具车",   type: "cart",      x: 860, y: 70,  w: 100, h: 70 },
  { id: "it-11", name: "备用舵机", type: "part",      x: 870, y: 320, w: 100, h: 60 },
  { id: "it-12", name: "纸箱×若干", type: "part",     x: 280, y: 470, w: 120, h: 70 },
  { id: "it-13", name: "折叠椅",   type: "deco",      x: 470, y: 480, w: 90,  h: 60 },
];

/* ---------- 状态（单一所有者：canvas_controller） ---------- */

let items = INITIAL_ITEMS.map((it) => ({ ...it }));
const selection = new Set();      // item id 集合
let snapToGrid = true;
let helpOpen = false;
let renamingId = null;
let scale = 1;
let createCounter = 1;

const undoStack = [];
const redoStack = [];
let lastTag = null, lastTagAt = 0;

const guides = [];                // {axis:'v'|'h', at, a, b} 瞬态
let flashTimer = null;

/* ---------- DOM ---------- */

const $ = (sel) => document.querySelector(sel);
const worldEl = $("#world");
const scalerEl = $("#scaler");
const zonesLayer = $("#zones-layer");
const itemsLayer = $("#items-layer");
const guidesLayer = $("#guides-layer");
const marqueeEl = $("#marquee");
const statusEl = $("#status");
const emptyEl = $("#empty-hint");
const helpEl = $("#help-overlay");

/* ---------- 几何：落位即意图 ---------- */

function centerOf(it) { return { x: it.x + it.w / 2, y: it.y + it.h / 2 }; }

function zoneOf(it) {
  const c = centerOf(it);
  return ZONES.find((z) => c.x >= z.x && c.x <= z.x + z.w && c.y >= z.y && c.y <= z.y + z.h) || null;
}

function clampItem(it) {
  it.x = Math.max(0, Math.min(WORLD.w - it.w, it.x));
  it.y = Math.max(0, Math.min(WORLD.h - it.h, it.y));
}

function byId(id) { return items.find((it) => it.id === id) || null; }

/* ---------- 撤销 / 重做（可逆性保障） ---------- */

function snapshot() { return JSON.stringify(items); }

function pushUndo(tag) {
  const now = Date.now();
  if (tag && tag === lastTag && now - lastTagAt < 800) { lastTagAt = now; return; } // 连续微移合并
  undoStack.push(snapshot());
  if (undoStack.length > 100) undoStack.shift();
  redoStack.length = 0;
  lastTag = tag || null;
  lastTagAt = now;
}

function undo() {
  if (!undoStack.length) return flash("没有可撤销的操作");
  redoStack.push(snapshot());
  items = JSON.parse(undoStack.pop());
  lastTag = null;
  selection.forEach((id) => { if (!byId(id)) selection.delete(id); });
  render();
}

function redo() {
  if (!redoStack.length) return flash("没有可重做的操作");
  undoStack.push(snapshot());
  items = JSON.parse(redoStack.pop());
  lastTag = null;
  render();
}

/* ---------- 渲染 ---------- */

function renderZones() {
  zonesLayer.textContent = "";
  for (const z of ZONES) {
    const count = items.filter((it) => zoneOf(it) === z).length;
    const el = document.createElement("div");
    el.className = `zone tone-${z.tone}`;
    el.id = z.id;
    el.style.cssText = `left:${z.x}px;top:${z.y}px;width:${z.w}px;height:${z.h}px;`;
    const tag = document.createElement("div");
    tag.className = "zone-tag";
    tag.innerHTML = `${z.name} <small>${z.purpose} · ${count} 件</small>`;
    el.appendChild(tag);
    zonesLayer.appendChild(el);
  }
}

function purposeChipFor(it) {
  const z = zoneOf(it);
  if (!z) return `<span class="purpose-chip unplaced">未安置</span>`;
  return `<span class="purpose-chip" data-zone="${z.id}">${z.purpose}</span>`;
}

function renderItems() {
  itemsLayer.textContent = "";
  for (const it of items) {
    const t = TYPES[it.type] || TYPES.part;
    const el = document.createElement("div");
    el.className = "item" + (selection.has(it.id) ? " selected" : "");
    el.dataset.id = it.id;
    el.style.cssText = `left:${it.x}px;top:${it.y}px;width:${it.w}px;height:${it.h}px;--type-color:${t.color};`;
    if (it.id === renamingId) {
      el.innerHTML = `<div class="item-head"><span class="type-dot"></span>
        <span class="item-name"><input value="${escapeHtml(it.name)}" aria-label="物件名称"></span></div>
        ${purposeChipFor(it)}`;
    } else {
      el.title = `${it.name} · ${t.label}`;
      el.innerHTML = `<div class="item-head"><span class="type-dot"></span>
        <span class="item-name">${escapeHtml(it.name)}</span></div>
        ${purposeChipFor(it)}`;
    }
    itemsLayer.appendChild(el);
  }
  if (renamingId) {
    const input = itemsLayer.querySelector("input");
    if (input) { input.focus(); input.select(); }
  }
}

function renderGuides() {
  guidesLayer.textContent = "";
  for (const g of guides) {
    const el = document.createElement("div");
    el.className = `guide ${g.axis}`;
    if (g.axis === "v") el.style.left = g.at + "px";
    else el.style.top = g.at + "px";
    guidesLayer.appendChild(el);
  }
}

function renderStatusFlash(msg) {
  statusEl.classList.add("warn");
  statusEl.innerHTML = escapeHtml(msg);
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => { statusEl.classList.remove("warn"); renderStatus(); }, 2400);
}

function flash(msg) { renderStatusFlash(msg); }

function renderStatus() {
  const sel = items.filter((it) => selection.has(it.id));
  const hint = `<span class="hint">Tab 选择 · 方向键移动 · Alt+方向 对齐 · N 新建 · ? 全部键位</span>`;
  if (!sel.length) {
    statusEl.innerHTML = `<span>未选中物件</span><span class="chip">落位即意图：物件落入分区 ⇒ 用途自动确定</span>${hint}`;
    return;
  }
  const primary = sel[sel.length - 1];
  const z = zoneOf(primary);
  const more = sel.length > 1 ? `<span>等 ${sel.length} 件</span>` : "";
  const zonePart = z
    ? `<span>落位于</span><span class="chip" style="background:${zoneChipBg(z)}">${escapeHtml(z.name)} · ${z.purpose}</span>`
    : `<span>未安置（自由区）</span>`;
  statusEl.innerHTML =
    `<span class="sel-name">「${escapeHtml(primary.name)}」</span>${more}` +
    `${zonePart}<span class="mono">x ${primary.x} · y ${primary.y}</span>${hint}`;
}

function zoneChipBg(z) {
  const map = { blue: "#dbe7fb", green: "#d9efdf", orange: "#f8e6d2", violet: "#e7dff7" };
  return map[z.tone] || "#eceadf";
}

function render() {
  renderZones();
  renderItems();
  renderGuides();
  renderStatus();
  emptyEl.hidden = items.length !== 0;
  $("#btn-undo").disabled = undoStack.length === 0;
  $("#btn-redo").disabled = redoStack.length === 0;
  $("#btn-snap").setAttribute("aria-pressed", String(snapToGrid));
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/* ---------- 智能对齐（拖拽与 Alt+方向 共用同一语义） ---------- */

function collectSnapLines(excludeIds) {
  const xs = [0, WORLD.w / 2, WORLD.w];
  const ys = [0, WORLD.h / 2, WORLD.h];
  for (const z of ZONES) { xs.push(z.x, z.x + z.w / 2, z.x + z.w); ys.push(z.y, z.y + z.h / 2, z.y + z.h); }
  for (const o of items) {
    if (excludeIds.has(o.id)) continue;
    xs.push(o.x, o.x + o.w / 2, o.x + o.w);
    ys.push(o.y, o.y + o.h / 2, o.y + o.h);
  }
  return { xs, ys };
}

function applySmartSnap(mover, excludeIds) {
  const { xs, ys } = collectSnapLines(excludeIds);
  const my = { xs: [mover.x, mover.x + mover.w / 2, mover.x + mover.w], ys: [mover.y, mover.y + mover.h / 2, mover.y + mover.h] };
  guides.length = 0;
  let bestX = null, bestY = null;
  for (const mx of my.xs) for (const lx of xs) {
    const d = Math.abs(mx - lx);
    if (d <= SNAP_TOL && (!bestX || d < bestX.d)) bestX = { d, delta: lx - mx, line: lx };
  }
  for (const myy of my.ys) for (const ly of ys) {
    const d = Math.abs(myy - ly);
    if (d <= SNAP_TOL && (!bestY || d < bestY.d)) bestY = { d, delta: ly - myy, line: ly };
  }
  if (bestX) { mover.x += bestX.delta; }
  if (bestY) { mover.y += bestY.delta; }
  // 参考线：贯穿被吸附物件与参照物之间
  if (bestX) {
    const targets = snapLineExtent(bestX.line, "x", excludeIds);
    guides.push({ axis: "v", at: bestX.line, a: targets.min, b: targets.max });
  }
  if (bestY) {
    const targets = snapLineExtent(bestY.line, "y", excludeIds);
    guides.push({ axis: "h", at: bestY.line, a: targets.min, b: targets.max });
  }
}

function snapLineExtent(line, axis, excludeIds) {
  let min = line, max = line;
  const near = (v) => Math.abs(v - line) < 0.5;
  for (const o of items) {
    if (excludeIds.has(o.id)) continue;
    const vs = axis === "x" ? [o.x, o.x + o.w / 2, o.x + o.w] : [o.y, o.y + o.h / 2, o.y + o.h];
    if (vs.some(near)) { min = Math.min(min, axis === "x" ? o.x : o.y); max = Math.max(max, axis === "x" ? o.x + o.w : o.y + o.h); }
  }
  for (const z of ZONES) {
    const vs = axis === "x" ? [z.x, z.x + z.w / 2, z.x + z.w] : [z.y, z.y + z.h / 2, z.y + z.h];
    if (vs.some(near)) {
      min = Math.min(min, axis === "x" ? z.x : z.y);
      max = Math.max(max, axis === "x" ? z.x + z.w : z.y + z.h);
    }
  }
  min = Math.max(min, 0); max = Math.min(max, axis === "x" ? WORLD.w : WORLD.h);
  return { min, max };
}

function scheduleGuideFade() {
  renderGuides();
  setTimeout(() => { if (guides.length) { guides.length = 0; renderGuides(); } }, 900);
}

/* ---------- 指针交互（每个动作都有键盘等价物） ---------- */

let drag = null; // {mode:'move'|'marquee', ...}

function worldPoint(e) {
  const r = worldEl.getBoundingClientRect();
  return { x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale };
}

worldEl.addEventListener("pointerdown", (e) => {
  if (e.button !== 0) return;
  if (renamingId && !e.target.closest(".item-name input")) commitRename(false);
  const p = worldPoint(e);
  const itemEl = e.target.closest(".item");
  if (itemEl) {
    const id = itemEl.dataset.id;
    if (e.shiftKey) {
      selection.has(id) ? selection.delete(id) : selection.add(id);
      render();
      return;
    }
    if (!selection.has(id)) { selection.clear(); selection.add(id); render(); }
    const primary = byId([...selection][selection.size - 1]) || byId(id);
    drag = { mode: "move", start: p, origin: items.filter((it) => selection.has(it.id)).map((it) => ({ id: it.id, x: it.x, y: it.y })), moved: false, ref: primary };
    worldEl.setPointerCapture(e.pointerId);
  } else {
    drag = { mode: "marquee", start: p, base: e.shiftKey ? new Set(selection) : new Set() };
    if (!e.shiftKey) { selection.clear(); render(); }
    worldEl.setPointerCapture(e.pointerId);
  }
  e.preventDefault();
});

worldEl.addEventListener("pointermove", (e) => {
  if (!drag) return;
  const p = worldPoint(e);
  if (drag.mode === "marquee") {
    const r = normRect(drag.start, p);
    marqueeEl.hidden = false;
    marqueeEl.style.cssText = `left:${r.x}px;top:${r.y}px;width:${r.w}px;height:${r.h}px;`;
    drag.rect = r;
    selection.clear();
    drag.base.forEach((id) => selection.add(id));
    for (const it of items) {
      if (it.x < r.x + r.w && it.x + it.w > r.x && it.y < r.y + r.h && it.y + it.h > r.y) selection.add(it.id);
    }
    renderItems(); renderStatus();
    return;
  }
  // move
  if (!drag.moved) {
    if (Math.hypot(p.x - drag.start.x, p.y - drag.start.y) < 3) return;
    drag.moved = true;
    pushUndo("drag-move");
    itemsLayer.classList.add("dragging");
  }
  const exclude = new Set(selection);
  let dx = p.x - drag.start.x, dy = p.y - drag.start.y;
  const dxSnap = snapToGrid ? Math.round(dx / GRID) * GRID : dx;
  const dySnap = snapToGrid ? Math.round(dy / GRID) * GRID : dy;
  const moving = byId(drag.ref.id);
  if (moving) {
    moving.x = drag.origin.find((o) => o.id === drag.ref.id).x + dxSnap;
    moving.y = drag.origin.find((o) => o.id === drag.ref.id).y + dySnap;
    applySmartSnap(moving, exclude);
    dx = moving.x - drag.origin.find((o) => o.id === drag.ref.id).x;
    dy = moving.y - drag.origin.find((o) => o.id === drag.ref.id).y;
  }
  for (const o of drag.origin) {
    const it = byId(o.id);
    if (!it || it === moving) continue;
    it.x = o.x + dx; it.y = o.y + dy;
  }
  for (const it of items) if (selection.has(it.id)) clampItem(it);
  renderItems(); renderGuides(); renderStatus();
});

worldEl.addEventListener("pointerup", (e) => {
  if (!drag) return;
  if (drag.mode === "marquee") { marqueeEl.hidden = true; render(); }
  else {
    itemsLayer.classList.remove("dragging");
    guides.length = 0;
    if (drag.moved) render();
  }
  drag = null;
});

worldEl.addEventListener("dblclick", (e) => {
  const itemEl = e.target.closest(".item");
  if (itemEl) { startRename(itemEl.dataset.id); return; }
  const p = worldPoint(e);
  createAt(snapToGrid ? Math.round((p.x - 60) / GRID) * GRID : p.x - 60,
           snapToGrid ? Math.round((p.y - 40) / GRID) * GRID : p.y - 40, 120, 80);
});

function normRect(a, b) {
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) };
}

/* ---------- 创建 / 复制 / 删除 / 重命名 ---------- */

function createAt(x, y, w = 120, h = 80) {
  pushUndo("create");
  const types = Object.keys(TYPES);
  const type = types[createCounter % types.length];
  const it = { id: "it-" + Date.now().toString(36) + "-" + createCounter, name: `新物件 ${createCounter}`, type, x, y, w, h };
  createCounter++;
  clampItem(it);
  items.push(it);
  selection.clear(); selection.add(it.id);
  render();
  const z = zoneOf(it);
  flash(z ? `已创建「${it.name}」— 已落位于${z.name}（${z.purpose}）` : `已创建「${it.name}」— 方向键移动到目标分区即完成落位`);
}

function findFreeSpot() {
  const w = 120, h = 80;
  const cx = WORLD.w / 2 - w / 2, cy = WORLD.h / 2 - h / 2;
  for (let ring = 0; ring < 40; ring++) {
    const candidates = ring === 0 ? [[cx, cy]] : [];
    if (ring > 0) {
      const step = GRID * 4;
      for (let a = -ring; a <= ring; a += 2) for (let b = -ring; b <= ring; b += 2) {
        candidates.push([cx + a * step, cy + b * step]);
      }
    }
    for (const [x, y] of candidates) {
      const rect = { x, y, w, h };
      if (x < 0 || y < 0 || x + w > WORLD.w || y + h > WORLD.h) continue;
      const overlap = items.some((it) => it.x < rect.x + w && it.x + it.w > rect.x && it.y < rect.y + h && it.y + it.h > rect.y);
      if (!overlap) return { x: Math.round(x / GRID) * GRID, y: Math.round(y / GRID) * GRID };
    }
  }
  return { x: GRID * 2, y: WORLD.h - h - GRID * 2 };
}

function duplicateSelection() {
  const sel = items.filter((it) => selection.has(it.id));
  if (!sel.length) return flash("先选择物件（Tab 或点击）");
  pushUndo("duplicate");
  const clones = sel.map((it) => ({ ...it, id: "it-" + Date.now().toString(36) + "-" + (createCounter++), x: it.x + 16, y: it.y + 16, name: it.name + " 副本" }));
  clones.forEach((c) => { clampItem(c); items.push(c); });
  selection.clear();
  clones.forEach((c) => selection.add(c.id));
  render();
  flash(`已复制 ${clones.length} 件`);
}

function deleteSelection() {
  if (!selection.size) return flash("先选择物件（Tab 或点击）");
  pushUndo("delete");
  const n = selection.size;
  items = items.filter((it) => !selection.has(it.id));
  selection.clear();
  render();
  flash(`已删除 ${n} 件 — Ctrl+Z 可撤销`);
}

function startRename(id) {
  renamingId = id;
  renderItems();
}

function commitRename(cancel) {
  const input = itemsLayer.querySelector(".item-name input");
  const it = byId(renamingId);
  renamingId = null;
  if (it && input && !cancel) {
    const name = input.value.trim();
    if (name && name !== it.name) { pushUndo("rename"); it.name = name; }
  }
  render();
}

itemsLayer.addEventListener("keydown", (e) => {
  if (e.target.tagName !== "INPUT") return;
  if (e.key === "Enter") { e.preventDefault(); commitRename(false); }
  else if (e.key === "Escape") { e.preventDefault(); commitRename(true); }
  e.stopPropagation();
});

itemsLayer.addEventListener("focusout", (e) => {
  if (e.target.tagName === "INPUT" && renamingId) commitRename(false);
});

/* ---------- 键盘契约（验收种子：空间操作有键盘等价物） ---------- */

document.addEventListener("keydown", (e) => {
  if (e.target.tagName === "INPUT") return; // 重命名输入时让位
  const mod = e.ctrlKey || e.metaKey;
  const onButton = e.target.tagName === "BUTTON"; // 焦点在工具条按钮上时保留原生键盘语义

  if (mod && (e.key === "z" || e.key === "Z")) { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
  if (mod && (e.key === "y" || e.key === "Y")) { e.preventDefault(); redo(); return; }
  if (mod && (e.key === "d" || e.key === "D")) { e.preventDefault(); duplicateSelection(); return; }
  if (mod && (e.key === "a" || e.key === "A")) { e.preventDefault(); items.forEach((it) => selection.add(it.id)); render(); return; }

  switch (e.key) {
    case "Tab": {
      if (onButton) return; // 允许 Tab 在工具条按钮间移动焦点
      e.preventDefault();
      cycleSelection(e.shiftKey ? -1 : 1);
      return;
    }
    case "Escape":
      e.preventDefault();
      if (helpOpen) { toggleHelp(false); return; }
      if (renamingId) { commitRename(true); return; }
      selection.clear(); render();
      return;
    case "?": case "k": case "K":
      e.preventDefault();
      toggleHelp();
      return;
    case "n": case "N": {
      e.preventDefault();
      const spot = findFreeSpot();
      createAt(spot.x, spot.y);
      return;
    }
    case "Delete": case "Backspace":
      e.preventDefault();
      deleteSelection();
      return;
    case "Enter": {
      if (onButton) return; // 按钮自身的激活语义优先
      const first = [...selection][selection.size - 1];
      if (first) { e.preventDefault(); startRename(first); }
      return;
    }
    case "[" : zorder(-1); return;
    case "]" : zorder(1); return;
    case "g": case "G":
      snapToGrid = !snapToGrid;
      render();
      flash(`网格吸附已${snapToGrid ? "开启" : "关闭"}`);
      return;
    case "d": distribute("h"); return;
    case "D": distribute("v"); return;
  }

  if (e.key.startsWith("Arrow")) {
    e.preventDefault();
    nudge(e);
    return;
  }

  if (/^[1-6]$/.test(e.key)) { alignTo(e.key); return; }
});

function cycleSelection(dir) {
  if (!items.length) return;
  const ordered = items; // 数组顺序即 z 序
  let idx = -1;
  const current = [...selection][selection.size - 1];
  if (current) idx = ordered.findIndex((it) => it.id === current);
  let next = (idx + dir + ordered.length) % ordered.length;
  if (idx === -1 && dir === -1) next = ordered.length - 1;
  selection.clear();
  selection.add(ordered[next].id);
  renamingId = null;
  render();
}

function nudge(e) {
  const sel = items.filter((it) => selection.has(it.id));
  if (!sel.length) { flash("先按 Tab 选择物件，或 N 新建"); return; }
  const step = e.shiftKey ? BIG_STEP : GRID;
  const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
  const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
  pushUndo("nudge");
  const exclude = new Set(selection);
  for (const it of sel) {
    it.x += dx; it.y += dy;
    if (e.altKey) {
      // 键盘等价物：移动并智能对齐吸附（与拖拽吸附同一语义）
      applySmartSnap(it, new Set([...exclude].filter((id) => id !== it.id)));
    }
    clampItem(it);
  }
  if (e.altKey) scheduleGuideFade(); else { guides.length = 0; }
  render();
  const primary = sel[sel.length - 1];
  const z = zoneOf(primary);
  if (z && sel.length === 1) flash(`落位：${z.name} · ${z.purpose}`);
}

/* 1-6 对齐：单选 → 对齐所在分区（未安置则对齐画布）；多选 → 组内对齐 */
function alignTo(key) {
  const sel = items.filter((it) => selection.has(it.id));
  if (!sel.length) return flash("先选择物件");
  let target;
  if (sel.length === 1) {
    const z = zoneOf(sel[0]);
    target = z ? { x: z.x, y: z.y, w: z.w, h: z.h } : { x: 0, y: 0, w: WORLD.w, h: WORLD.h };
  } else {
    const minX = Math.min(...sel.map((i) => i.x)), minY = Math.min(...sel.map((i) => i.y));
    const maxX = Math.max(...sel.map((i) => i.x + i.w)), maxY = Math.max(...sel.map((i) => i.y + i.h));
    target = { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  }
  pushUndo("align");
  for (const it of sel) {
    switch (key) {
      case "1": it.x = target.x; break;
      case "2": it.x = target.x + (target.w - it.w) / 2; break;
      case "3": it.x = target.x + target.w - it.w; break;
      case "4": it.y = target.y; break;
      case "5": it.y = target.y + (target.h - it.h) / 2; break;
      case "6": it.y = target.y + target.h - it.h; break;
    }
    clampItem(it);
  }
  render();
  flash(`已对齐（${ { "1": "左", "2": "水平居中", "3": "右", "4": "顶", "5": "垂直居中", "6": "底" }[key] }）`);
}

function distribute(axis) {
  const sel = items.filter((it) => selection.has(it.id));
  if (sel.length < 3) return flash("均分至少需要选中 3 件（Shift+点击 或 Ctrl+A 加选）");
  pushUndo("distribute");
  const sorted = [...sel].sort((a, b) => (axis === "h" ? a.x - b.x : a.y - b.y));
  const first = sorted[0], last = sorted[sorted.length - 1];
  if (axis === "h") {
    const span = (last.x - first.x) || 1;
    const inner = sorted.length - 1;
    sorted.forEach((it, i) => { it.x = Math.round(first.x + (span * i) / inner); clampItem(it); });
  } else {
    const span = (last.y - first.y) || 1;
    const inner = sorted.length - 1;
    sorted.forEach((it, i) => { it.y = Math.round(first.y + (span * i) / inner); clampItem(it); });
  }
  render();
  flash(`已${axis === "h" ? "水平" : "垂直"}均分 ${sel.length} 件`);
}

function zorder(dir) {
  const sel = items.filter((it) => selection.has(it.id));
  if (!sel.length) return flash("先选择物件");
  pushUndo("zorder");
  if (dir > 0) {
    for (let i = items.length - 2; i >= 0; i--) {
      if (selection.has(items[i].id) && !selection.has(items[i + 1].id)) {
        [items[i], items[i + 1]] = [items[i + 1], items[i]];
      }
    }
  } else {
    for (let i = 1; i < items.length; i++) {
      if (selection.has(items[i].id) && !selection.has(items[i - 1].id)) {
        [items[i], items[i - 1]] = [items[i - 1], items[i]];
      }
    }
  }
  render();
}

/* ---------- 覆盖层与工具条 ---------- */

function toggleHelp(force) {
  helpOpen = force !== undefined ? force : !helpOpen;
  helpEl.hidden = !helpOpen;
}

$("#btn-new").addEventListener("click", (e) => { const s = findFreeSpot(); createAt(s.x, s.y); e.currentTarget.blur(); });
$("#btn-delete").addEventListener("click", (e) => { deleteSelection(); e.currentTarget.blur(); });
$("#btn-undo").addEventListener("click", (e) => { undo(); e.currentTarget.blur(); });
$("#btn-redo").addEventListener("click", (e) => { redo(); e.currentTarget.blur(); });
$("#btn-snap").addEventListener("click", (e) => { snapToGrid = !snapToGrid; render(); e.currentTarget.blur(); });
$("#btn-help").addEventListener("click", () => toggleHelp());
$("#btn-help-close").addEventListener("click", () => toggleHelp(false));
helpEl.addEventListener("click", (e) => { if (e.target === helpEl) toggleHelp(false); });

/* ---------- 自适应缩放（画布总是完整可见，无平移导航） ---------- */

function fit() {
  const wrap = $("#canvas-wrap");
  const availW = wrap.clientWidth - 28;
  const availH = wrap.clientHeight - 28;
  scale = Math.min(1, availW / WORLD.w, availH / WORLD.h);
  scalerEl.style.width = WORLD.w * scale + "px";
  scalerEl.style.height = WORLD.h * scale + "px";
  worldEl.style.transform = `scale(${scale})`;
}
window.addEventListener("resize", fit);

/* ---------- 供验证脚本读取（只读快照） ---------- */

window.__setplot = {
  get items() { return items.map((it) => ({ ...it, zone: zoneOf(it) ? zoneOf(it).id : null })); },
  get selection() { return [...selection]; },
  zoneOf: (name) => { const it = items.find((i) => i.name === name); return it ? (zoneOf(it) ? zoneOf(it).name : null) : undefined; },
};

/* ---------- 启动：同步首渲染，无加载态 ---------- */

renderZones();
renderItems();
fit();
render();
