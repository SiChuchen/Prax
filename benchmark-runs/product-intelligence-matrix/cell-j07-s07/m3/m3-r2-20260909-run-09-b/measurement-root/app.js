/* 落位板 · Placement Board
 * cell-j07-s07 create × spatial-workspace
 * 落位即意图：区域归属（中心点入区）+ 邻近 + 网格对齐
 * 全部空间操作均有键盘等价物（KEYCONTRACTS 为唯一事实来源，帮助层由它生成）
 */
"use strict";

/* ---------- 常量与数据 ---------- */
const GRID = 20, CARD_W = 168, CARD_H = 88;
const PROXIMITY = 120;            // 邻近阈值（世界坐标 px）
const WORLD = { w: 1240, h: 760 };

const ZONES = [
  { id: "z1", name: "收集箱", x: 40,  y: 100, w: 360, h: 520, cls: "zone-1", color: "var(--zone1)" },
  { id: "z2", name: "进行中", x: 440, y: 100, w: 360, h: 520, cls: "zone-2", color: "var(--zone2)" },
  { id: "z3", name: "已完成", x: 840, y: 100, w: 360, h: 520, cls: "zone-3", color: "var(--zone3)" },
];
const NO_ZONE = { id: null, name: "未分区", color: "var(--none)" };

const HUES = ["#f59e0b", "#3b82f6", "#10b981", "#8b5cf6", "#ef4444", "#0ea5e9"];

/* 首屏内联种子数据（页面加载即 ready，无加载态） */
const SEED = [
  { id: "c1", title: "客户访谈纪要",       x: 100, y: 160, hue: HUES[0] },
  { id: "c2", title: "竞品截图包",         x: 300, y: 240, hue: HUES[1] },
  { id: "c3", title: "灵感：开箱短视频",   x: 120, y: 440, hue: HUES[2] },
  { id: "c4", title: "发布会主视觉 v2",    x: 520, y: 180, hue: HUES[3] },
  { id: "c5", title: "邀请函文案",         x: 680, y: 320, hue: HUES[4] },
  { id: "c6", title: "展台平面草案",       x: 500, y: 480, hue: HUES[5] },
  { id: "c7", title: "LOGO 定稿",          x: 920, y: 200, hue: HUES[1] },
  { id: "c8", title: "预算表 v1",          x: 960, y: 440, hue: HUES[2] },
  { id: "c9", title: "待定：联名提案",     x: 600, y: 20,  hue: HUES[0] },  // 区域外 → 未分区
];

/* 键位契约：帮助层与键位文档的唯一来源 */
const KEYCONTRACTS = [
  { group: "创建与复制", rows: [
    { keys: ["N"],        desc: "新建物料卡（有选中 → 其右侧相邻格位；无选中 → 视图中心）" },
    { keys: ["Ctrl", "D"], desc: "复制选中卡片（右下相邻格位）" },
  ]},
  { group: "选择", rows: [
    { keys: ["Tab"],       desc: "选中下一张卡片", small: "Shift+Tab 反向" },
    { keys: ["Esc"],       desc: "取消选择 / 退出编辑 / 关闭帮助" },
    { keys: ["Enter"],     desc: "就地编辑选中卡片标题", small: "Enter 提交 · Esc 取消" },
  ]},
  { group: "移动与落位", rows: [
    { keys: ["↑","↓","←","→"], desc: "微调选中卡片 1 格（20px）", small: "与指针拖动同格宽，等价" },
    { keys: ["Shift", "方向键"], desc: "大步微调（5 格 = 100px）" },
    { keys: ["1"], desc: "将选中卡片移入「收集箱」", small: "落位的键盘等价：自动落至区域内空槽" },
    { keys: ["2"], desc: "将选中卡片移入「进行中」" },
    { keys: ["3"], desc: "将选中卡片移入「已完成」" },
    { keys: ["F"], desc: "将选中卡片聚焦到视图中心" },
  ]},
  { group: "层级与删除", rows: [
    { keys: ["]"],        desc: "选中卡片层级前置" },
    { keys: ["["],        desc: "选中卡片层级后移" },
    { keys: ["Del"],      desc: "删除选中卡片", small: "Backspace 同效" },
    { keys: ["Ctrl", "Z"], desc: "撤销最近一次删除" },
  ]},
  { group: "视口", rows: [
    { keys: ["＋","＝"],   desc: "放大视图" },
    { keys: ["－"],       desc: "缩小视图" },
    { keys: ["0"],        desc: "复位视图（适配全览）" },
    { keys: ["方向键"],    desc: "无选中时：平移视图", small: "拖动空白处 / 滚轮缩放为指针等价" },
    { keys: ["?"],        desc: "打开/关闭本键位契约帮助层" },
  ]},
];

/* ---------- 状态 ---------- */
const state = {
  cards: SEED.map((s, i) => ({ ...s, w: CARD_W, h: CARD_H, z: i + 1 })),
  selection: null,          // card id
  viewport: { x: 0, y: 0, scale: 1 },
  editing: null,            // card id（就地编辑中）
  helpOpen: false,
  undoStack: [],            // 已删除卡片快照
  hueIdx: 0,
  nextId: 100,
};

/* ---------- DOM ---------- */
const $ = (sel) => document.querySelector(sel);
const el = {
  stage: $("#stage"), world: $("#world"), zones: $("#zones"), cards: $("#cards"),
  guideV: $("#guide-v"), guideH: $("#guide-h"),
  emptyHint: $("#empty-hint"),
  stZoom: $("#st-zoom"), stSel: $("#st-sel"), stCount: $("#st-count"),
  toast: $("#toast"),
  inspector: $("#inspector"), inspSel: $("#insp-sel"), inspSum: $("#insp-sum"),
  inspTitle: $("#insp-title"), inspZone: $("#insp-zone"), inspPos: $("#insp-pos"),
  inspNear: $("#insp-near"), inspZ: $("#insp-z"), inspCounts: $("#insp-counts"),
  help: $("#help"), helpBody: $("#help-body"),
};

/* ---------- 工具函数 ---------- */
const snap = (v) => Math.round(v / GRID) * GRID;
const cardById = (id) => state.cards.find((c) => c.id === id);
const selectedCard = () => (state.selection ? cardById(state.selection) : null);
const zoneOf = (card) => {
  const cx = card.x + card.w / 2, cy = card.y + card.h / 2;
  return ZONES.find((z) => cx >= z.x && cx <= z.x + z.w && cy >= z.y && cy <= z.y + z.h) || NO_ZONE;
};
const centerDist = (a, b) => Math.hypot((a.x + a.w/2) - (b.x + b.w/2), (a.y + a.h/2) - (b.y + b.h/2));
const neighborsOf = (card) => state.cards
  .filter((c) => c.id !== card.id && centerDist(c, card) <= PROXIMITY)
  .sort((a, b) => centerDist(a, card) - centerDist(b, card));
const maxZ = () => Math.max(0, ...state.cards.map((c) => c.z));

function showToast(msg) {
  el.toast.textContent = msg;
  el.toast.hidden = false;
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => { el.toast.hidden = true; }, 2200);
}

/* 区域内第一个空槽（1/2/3 换区落位的落点） */
function freeSlotInZone(zone) {
  const inZone = state.cards.filter((c) => zoneOf(c).id === zone.id);
  const i = inZone.length;
  const col = i % 2, row = Math.floor(i / 2);
  return {
    x: snap(Math.min(zone.x + 16 + col * (CARD_W + 24), zone.x + zone.w - CARD_W - 12)),
    y: snap(Math.min(zone.y + 48 + row * (CARD_H + 20), zone.y + zone.h - CARD_H - 12)),
  };
}

/* ---------- 渲染 ---------- */
const cardEls = new Map();

function renderZones() {
  el.zones.innerHTML = "";
  for (const z of ZONES) {
    const d = document.createElement("div");
    d.className = `zone ${z.cls}`;
    d.style.cssText = `left:${z.x}px;top:${z.y}px;width:${z.w}px;height:${z.h}px`;
    d.innerHTML = `<span class="zone-tag">${z.name}</span><span class="zone-count" data-zone="${z.id}"></span>`;
    el.zones.appendChild(d);
  }
}

function makeCardEl(card) {
  const d = document.createElement("div");
  d.className = "card";
  d.dataset.id = card.id;
  d.setAttribute("role", "button");
  d.tabIndex = -1;
  d.innerHTML = `
    <div class="card-title" spellcheck="false"></div>
    <span class="card-badge"></span>
    <span class="card-coord"></span>`;
  return d;
}

function updateCardEl(card) {
  let d = cardEls.get(card.id);
  if (!d) { d = makeCardEl(card); cardEls.set(card.id, d); el.cards.appendChild(d); }
  d.style.left = card.x + "px";
  d.style.top = card.y + "px";
  d.style.zIndex = card.z;
  d.style.setProperty("--hue", card.hue);
  d.classList.toggle("selected", card.id === state.selection);
  const zone = zoneOf(card);
  const badge = d.querySelector(".card-badge");
  badge.textContent = zone.name;
  badge.style.background = zone.id ? "rgba(255,255,255,.85)" : "#eef2f7";
  badge.style.color = getComputedStyle(document.documentElement).getPropertyValue(
    zone.id === "z1" ? "--zone1" : zone.id === "z2" ? "--zone2" : zone.id === "z3" ? "--zone3" : "--none");
  d.querySelector(".card-coord").textContent = `${card.x},${card.y}`;
  const titleEl = d.querySelector(".card-title");
  if (state.editing !== card.id && titleEl.textContent !== card.title) titleEl.textContent = card.title;
}

function renderCards() {
  for (const c of state.cards) updateCardEl(c);
  for (const [id, d] of cardEls) {
    if (!cardById(id)) { d.remove(); cardEls.delete(id); }
  }
  el.cards.style.zIndex = 5;
  updateZonesMeta();
}

function updateZonesMeta() {
  document.querySelectorAll(".zone-count").forEach((n) => {
    const z = ZONES.find((zz) => zz.id === n.dataset.zone);
    const count = state.cards.filter((c) => zoneOf(c).id === z.id).length;
    n.textContent = `${count} 张物料卡`;
  });
}

function renderInspector() {
  const card = selectedCard();
  el.inspSel.hidden = !card;
  el.inspSum.hidden = !!card;
  if (card) {
    const zone = zoneOf(card);
    el.inspTitle.textContent = card.title;
    el.inspZone.textContent = zone.name;
    el.inspZone.style.color = getComputedStyle(document.documentElement).getPropertyValue(
      zone.id === "z1" ? "--zone1" : zone.id === "z2" ? "--zone2" : zone.id === "z3" ? "--zone3" : "--none");
    el.inspZone.style.border = "1px solid currentColor";
    el.inspPos.textContent = `x=${card.x}  y=${card.y}   (格 ${card.x/GRID}, ${card.y/GRID})`;
    const near = neighborsOf(card);
    el.inspNear.innerHTML = near.length
      ? near.slice(0, 4).map((c) =>
          `<li><span class="dot" style="background:${c.hue}"></span>${escapeHtml(c.title)}
            <span class="dist">${Math.round(centerDist(c, card))}px</span></li>`).join("")
      : `<li class="empty-row">120px 内暂无邻近卡片</li>`;
    const byZ = [...state.cards].sort((a, b) => a.z - b.z);
    el.inspZ.textContent = `第 ${byZ.findIndex((c) => c.id === card.id) + 1} 层 / 共 ${byZ.length} 层`;
  } else {
    const counts = ZONES.map((z) => {
      const n = state.cards.filter((c) => zoneOf(c).id === z.id).length;
      return `<li><span class="dot" style="background:${z.color}"></span>${z.name}
        <span class="dist">${n} 张</span></li>`;
    }).join("");
    const free = state.cards.filter((c) => !zoneOf(c).id).length;
    el.inspCounts.innerHTML = counts +
      `<li><span class="dot" style="background:var(--none)"></span>未分区<span class="dist">${free} 张</span></li>`;
  }
}

function renderStatus() {
  el.stZoom.textContent = `缩放 ${Math.round(state.viewport.scale * 100)}%`;
  el.stSel.textContent = `选中 ${state.selection ? 1 : 0}`;
  el.stCount.textContent = `卡片 ${state.cards.length}`;
}

function renderState() {
  const empty = state.cards.length === 0;
  el.emptyHint.hidden = !empty;
  document.body.dataset.state =
    state.helpOpen ? "help" : state.editing ? "editing" : empty ? "empty" : "ready";
  $("#btn-dup").disabled = $("#btn-del").disabled = $("#btn-back").disabled =
    $("#btn-front").disabled = !state.selection;
}

function renderAll() { renderCards(); renderInspector(); renderStatus(); renderState(); }

function escapeHtml(s) {
  return s.replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));
}

/* ---------- 视口 ---------- */
function applyViewport() {
  const { x, y, scale } = state.viewport;
  el.world.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
  renderStatus();
}
function resetView() {  // 适配全览（0 键 / 复位按钮）
  const pad = 28;
  const s = Math.min(1,
    (el.stage.clientWidth - pad * 2) / WORLD.w,
    (el.stage.clientHeight - pad * 2) / WORLD.h);
  state.viewport.scale = Math.max(0.4, s);
  state.viewport.x = (el.stage.clientWidth - WORLD.w * state.viewport.scale) / 2;
  state.viewport.y = (el.stage.clientHeight - WORLD.h * state.viewport.scale) / 2;
  applyViewport();
}
function zoomAt(cx, cy, factor) {  // 屏幕坐标锚点缩放
  const v = state.viewport;
  const s2 = Math.min(2, Math.max(0.4, v.scale * factor));
  const k = s2 / v.scale;
  v.x = cx - (cx - v.x) * k;
  v.y = cy - (cy - v.y) * k;
  v.scale = s2;
  applyViewport();
}
function panBy(dx, dy) { state.viewport.x += dx; state.viewport.y += dy; applyViewport(); }
function toWorld(cx, cy) {
  const v = state.viewport;
  return { x: (cx - v.x) / v.scale, y: (cy - v.y) / v.scale };
}

/* ---------- 动作（键盘与工具栏共用 = 等价） ---------- */
function selectCard(id) { state.selection = id; renderAll(); }

function cycleSelection(dir) {
  if (!state.cards.length) return;
  const ids = state.cards.map((c) => c.id);
  const i = ids.indexOf(state.selection);
  const next = i === -1 ? (dir > 0 ? 0 : ids.length - 1) : (i + dir + ids.length) % ids.length;
  selectCard(ids[next]);
}

function createCard(opts = {}) {
  const sel = selectedCard();
  let x, y;
  if (opts.wx != null) {            // 指针路径：双击空白处
    x = opts.wx - CARD_W / 2; y = opts.wy - CARD_H / 2;
  } else if (sel) {                 // 键盘路径：选中卡片右侧相邻格位
    x = sel.x + CARD_W + GRID * 2; y = sel.y;
  } else {                          // 键盘路径：视图中心
    const c = toWorld(el.stage.clientWidth / 2, el.stage.clientHeight / 2);
    x = c.x - CARD_W / 2; y = c.y - CARD_H / 2;
  }
  const card = {
    id: "c" + (state.nextId++),
    title: opts.title || "新物料卡",
    x: snap(Math.max(GRID, x)), y: snap(Math.max(GRID, y)),
    w: CARD_W, h: CARD_H,
    hue: HUES[state.hueIdx++ % HUES.length],
    z: maxZ() + 1,
  };
  state.cards.push(card);
  selectCard(card.id);
  return card;
}

function duplicateSelected() {
  const sel = selectedCard(); if (!sel) return showToast("无选中卡片 — Ctrl+D 需先选中");
  const card = { ...sel, id: "c" + (state.nextId++), x: snap(sel.x + GRID * 2), y: snap(sel.y + GRID * 2), z: maxZ() + 1 };
  state.cards.push(card);
  selectCard(card.id);
}

function deleteSelected() {
  const sel = selectedCard(); if (!sel) return;
  state.undoStack.push(sel);
  state.cards = state.cards.filter((c) => c.id !== sel.id);
  state.selection = null;
  showToast(`已删除「${sel.title}」 — Ctrl+Z 可撤销`);
  renderAll();
}

function undoDelete() {
  const card = state.undoStack.pop();
  if (!card) return showToast("没有可撤销的删除");
  state.cards.push(card);
  selectCard(card.id);
  showToast(`已恢复「${card.title}」`);
}

function moveSelection(dxCells, dyCells) {
  const sel = selectedCard(); if (!sel) return;
  sel.x = snap(Math.max(GRID, sel.x + dxCells * GRID));
  sel.y = snap(Math.max(GRID, sel.y + dyCells * GRID));
  renderAll();                       // 实时区域归属改写
}

function moveToZone(zoneIdx) {       // 1/2/3 — 换区落位（键盘等价）
  const sel = selectedCard(); if (!sel) return showToast(`按 1/2/3 换区前请先选中卡片`);
  const zone = ZONES[zoneIdx];
  const from = zoneOf(sel);
  const slot = freeSlotInZone(zone);
  sel.x = slot.x; sel.y = slot.y;
  renderAll();
  if (from.id !== zone.id) showToast(`「${sel.title}」已落位至「${zone.name}」`);
}

function zOrder(forward) {
  const sel = selectedCard(); if (!sel) return;
  sel.z = forward ? maxZ() + 1 : Math.min(...state.cards.map((c) => c.z)) - 1;
  renderAll();
}

function focusSelection() {
  const sel = selectedCard(); if (!sel) return;
  const v = state.viewport;
  v.x = el.stage.clientWidth / 2 - (sel.x + sel.w / 2) * v.scale;
  v.y = el.stage.clientHeight / 2 - (sel.y + sel.h / 2) * v.scale;
  applyViewport();
}

/* ---------- 就地编辑 ---------- */
function startEdit() {
  const sel = selectedCard(); if (!sel || state.editing) return;
  state.editing = sel.id;
  const d = cardEls.get(sel.id);
  const t = d.querySelector(".card-title");
  d.classList.add("editing");
  t.contentEditable = "true";
  t.textContent = sel.title;
  t.focus();
  getSelection().selectAllChildren(t);
  t.onblur = () => { if (state.editing === id) commitEdit(false); };
  renderState();
}
function commitEdit(revert) {
  const id = state.editing; if (!id) return;
  const card = cardById(id);
  const t = cardEls.get(id).querySelector(".card-title");
  t.onblur = null;
  if (!revert) {
    const v = t.textContent.trim();
    card.title = v || "无题物料卡";
  }
  t.contentEditable = "false";
  cardEls.get(id).classList.remove("editing");
  state.editing = null;
  renderAll();
}

/* ---------- 帮助层 ---------- */
function renderHelp() {
  el.helpBody.innerHTML = KEYCONTRACTS.map((g) => `
    <div class="help-group"><h3>${g.group}</h3>
      ${g.rows.map((r) => `
        <div class="help-row">
          <span class="keys">${r.keys.map((k) => `<kbd>${k}</kbd>`).join("")}</span>
          <span class="desc">${r.desc}${r.small ? ` <small>· ${r.small}</small>` : ""}</span>
        </div>`).join("")}
    </div>`).join("");
}
function toggleHelp(force) {
  state.helpOpen = force != null ? force : !state.helpOpen;
  el.help.hidden = !state.helpOpen;
  renderState();
}

/* ---------- 指针交互（与键盘等价的指针路径） ---------- */
let drag = null;   // {kind:'card'|'pan', ...}

el.stage.addEventListener("pointerdown", (e) => {
  if (e.button !== 0 || state.helpOpen) return;
  if (state.editing) commitEdit(false);          // 点击画布先提交编辑
  const cardEl = e.target.closest(".card");
  el.stage.focus({ preventScroll: true });
  if (cardEl && state.editing !== cardEl.dataset.id) {
    const card = cardById(cardEl.dataset.id);
    selectCard(card.id);
    drag = {
      kind: "card", card, start: { x: card.x, y: card.y },
      px: e.clientX, py: e.clientY, moved: false,
    };
  } else if (!cardEl) {
    drag = { kind: "pan", px: e.clientX, py: e.clientY, moved: false };
    el.stage.classList.add("panning");
  }
  el.stage.setPointerCapture(e.pointerId);
});

el.stage.addEventListener("pointermove", (e) => {
  if (!drag) return;
  const dx = e.clientX - drag.px, dy = e.clientY - drag.py;
  if (drag.kind === "pan") {
    if (Math.abs(dx) + Math.abs(dy) > 2) drag.moved = true;
    panBy(dx, dy);
    drag.px = e.clientX; drag.py = e.clientY;
    return;
  }
  if (Math.abs(dx) + Math.abs(dy) > 2) drag.moved = true;
  const v = state.viewport;
  let nx = drag.start.x + dx / v.scale;
  let ny = drag.start.y + dy / v.scale;
  nx = snap(nx); ny = snap(ny);

  // 对齐参考：与其他卡片/区域中心对齐（阈值 6px 屏幕世界坐标）
  let gx = null, gy = null;
  const targets = state.cards.filter((c) => c.id !== drag.card.id).map((c) => [c.x + c.w/2, c.y + c.h/2]);
  for (const z of ZONES) targets.push([z.x + z.w/2, z.y + z.h/2]);
  const cx = nx + CARD_W / 2, cy = ny + CARD_H / 2;
  for (const [tx, ty] of targets) {
    if (gx === null && Math.abs(cx - tx) < 6) { nx = snap(tx - CARD_W / 2); gx = tx; }
    if (gy === null && Math.abs(cy - ty) < 6) { ny = snap(ty - CARD_H / 2); gy = ty; }
  }
  drag.card.x = Math.max(GRID, nx);
  drag.card.y = Math.max(GRID, ny);
  showGuide(gx, gy);
  renderCards(); renderInspector();   // 拖动中实时改写区域归属
});

el.stage.addEventListener("pointerup", (e) => {
  if (!drag) return;
  if (drag.kind === "pan" && !drag.moved) selectCard(null);
  hideGuides();
  el.stage.classList.remove("panning");
  drag = null;
});

function showGuide(x, y) {
  el.guideV.hidden = x == null; el.guideH.hidden = y == null;
  if (x != null) el.guideV.style.left = x + "px";
  if (y != null) el.guideH.style.top = y + "px";
}
function hideGuides() { el.guideV.hidden = true; el.guideH.hidden = true; }

el.stage.addEventListener("wheel", (e) => {
  e.preventDefault();
  if (e.ctrlKey) { zoomAt(e.clientX - el.stage.getBoundingClientRect().left, e.clientY - el.stage.getBoundingClientRect().top, e.deltaY < 0 ? 1.1 : 0.9); }
  else { zoomAt(e.clientX - el.stage.getBoundingClientRect().left, e.clientY - el.stage.getBoundingClientRect().top, e.deltaY < 0 ? 1.08 : 0.926); }
}, { passive: false });

el.stage.addEventListener("dblclick", (e) => {
  if (state.editing) commitEdit(false);
  if (e.target.closest(".card")) { startEdit(); return; }
  if (state.helpOpen) return;
  const w = toWorld(e.clientX - el.stage.getBoundingClientRect().left, e.clientY - el.stage.getBoundingClientRect().top);
  createCard({ wx: w.x, wy: w.y });
});

/* ---------- 键盘契约（所有空间操作的键盘等价物） ---------- */
window.addEventListener("keydown", (e) => {
  const k = e.key;
  if (state.editing) {                 // 编辑态：标题编辑优先
    if (k === "Enter") { e.preventDefault(); commitEdit(false); }
    else if (k === "Escape") { e.preventDefault(); commitEdit(true); }
    return;
  }
  if (state.helpOpen) {                // 帮助层打开：仅响应关闭键
    if (k === "Escape" || k === "?") toggleHelp(false);
    return;
  }
  if ((e.ctrlKey || e.metaKey) && (k === "d" || k === "D")) { e.preventDefault(); duplicateSelected(); return; }
  if ((e.ctrlKey || e.metaKey) && (k === "z" || k === "Z")) { e.preventDefault(); undoDelete(); return; }
  if (e.ctrlKey || e.metaKey || e.altKey) return;

  switch (k) {
    case "n": case "N": createCard(); break;
    case "Tab": e.preventDefault(); cycleSelection(e.shiftKey ? -1 : 1); break;
    case "Enter": startEdit(); break;
    case "Escape": toggleHelp(false); selectCard(null); break;
    case "Delete": case "Backspace": e.preventDefault(); deleteSelected(); break;
    case "[": zOrder(false); break;
    case "]": zOrder(true); break;
    case "1": case "2": case "3": moveToZone(Number(k) - 1); break;
    case "f": case "F": focusSelection(); break;
    case "+": case "=": zoomAt(el.stage.clientWidth / 2, el.stage.clientHeight / 2, 1.15); break;
    case "-": case "_": zoomAt(el.stage.clientWidth / 2, el.stage.clientHeight / 2, 0.87); break;
    case "0": resetView(); break;
    case "?": toggleHelp(); break;
    case "ArrowUp": case "ArrowDown": case "ArrowLeft": case "ArrowRight": {
      e.preventDefault();
      const step = e.shiftKey ? 5 : 1;
      const dx = k === "ArrowLeft" ? -step : k === "ArrowRight" ? step : 0;
      const dy = k === "ArrowUp" ? -step : k === "ArrowDown" ? step : 0;
      if (state.selection) moveSelection(dx, dy);
      else panBy(dx * GRID * state.viewport.scale, dy * GRID * state.viewport.scale);  // 无选中：键盘平移视口
      break;
    }
  }
});

/* ---------- 工具栏（同一批动作 = 键位等价的指针入口） ---------- */
$("#btn-create").addEventListener("click", () => createCard());
$("#btn-dup").addEventListener("click", () => duplicateSelected());
$("#btn-del").addEventListener("click", () => deleteSelected());
$("#btn-back").addEventListener("click", () => zOrder(false));
$("#btn-front").addEventListener("click", () => zOrder(true));
$("#btn-reset").addEventListener("click", () => resetView());
$("#btn-help").addEventListener("click", () => toggleHelp());
$("#btn-help-close").addEventListener("click", () => toggleHelp(false));
el.help.addEventListener("click", (e) => { if (e.target === el.help) toggleHelp(false); });

window.addEventListener("resize", applyViewport);

/* ---------- 启动（同步完成：首屏即 ready，无加载态） ---------- */
renderZones();
renderHelp();
el.world.style.width = WORLD.w + "px";
el.world.style.height = WORLD.h + "px";
document.querySelector(".grid-layer").style.width = WORLD.w + "px";
document.querySelector(".grid-layer").style.height = WORLD.h + "px";
renderAll();
resetView();
