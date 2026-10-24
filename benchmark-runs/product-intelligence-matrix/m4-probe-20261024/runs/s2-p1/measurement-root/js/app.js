"use strict";
/* cell-j13-s10 · explore × dimensional-space
 * PAT-DATA-EXPLORER + Contextual Inspector + 常驻状态条（compact dark）。
 *
 * 状态模型（认知连续性的实现根基）：
 *   proj / filters / selection / focusId / view 全部挂在数据集或行级，
 *   换维（X/Y/颜色/画像/排序）只写 proj 子树 → 选中、过滤、缩放、焦点跨维度切换保留。
 *   所有过滤/投影/选中变更经 mutate() 记入带归属的 trail（可单条移除、可撤销/重做/复位/点击回退）。
 */
/* global ROWS */

// ---------- 维度元数据 ----------
const DIMS = [
  { key: "mass",     label: "质量",     type: "num",  unit: "M⊕" },
  { key: "radius",   label: "半径",     type: "num",  unit: "R⊕" },
  { key: "temp",     label: "平衡温度", type: "num",  unit: "K" },
  { key: "period",   label: "轨道周期", type: "num",  unit: "天" },
  { key: "distance", label: "距离",     type: "num",  unit: "ly" },
  { key: "habit",    label: "适生指数", type: "num",  unit: "分" },
  { key: "cls",      label: "行星类别", type: "cat",  values: ["岩质", "超级地球", "类海王星", "气态巨行星"] },
  { key: "atm",      label: "大气",     type: "cat",  values: ["无大气", "稀薄", "浓密", "富氢"] },
  { key: "detection",label: "发现方法", type: "cat",  values: ["凌星法", "视向速度", "直接成像", "微引力透镜"] },
  { key: "water",    label: "液态水",   type: "bool", values: [0, 1] },
];
const DIMMAP = Object.fromEntries(DIMS.map(d => [d.key, d]));
const BOOL_LABEL = { 0: "无", 1: "有" };
const CAT_COLORS = {
  "岩质": "#e0a458", "超级地球": "#5fd0a5", "类海王星": "#5aa9ff", "气态巨行星": "#c792ea",
  "无大气": "#8a94a3", "稀薄": "#5fd0a5", "浓密": "#5aa9ff", "富氢": "#c792ea",
  "凌星法": "#5aa9ff", "视向速度": "#5fd0a5", "直接成像": "#e0a458", "微引力透镜": "#c792ea",
  0: "#6b7684", 1: "#5fd0a5",
};
const NUM_RAMP = ["#2b5f9e", "#3d86c6", "#4cc2ff", "#63d8b0", "#d8c25a", "#e0855a"];
const ACCENT = "#4cc2ff";
const GRID = "#222b35";
const AXIS_TXT = "#93a0af";
const MONO = "11px Consolas, ui-monospace, monospace";
const SANS = "11px 'Segoe UI', system-ui, sans-serif";

// ---------- 状态 ----------
const INITIAL = {
  proj: { x: "mass", y: "temp", color: "cls", portrait: "radius", sort: "mass", sortDir: -1 },
  filters: [],            // {id, dim, kind:'range', min, max, origin} | {id, dim, kind:'cats', set:string[], origin}
  selection: [],          // 行 id 数组（行级，跨维持久）
  focusId: null,
  view: { k: 1, cx: 0.5, cy: 0.5 },   // 散点缩放（换维保留比例）
};
let state = clone(INITIAL);
let past = [];            // [{meta:{seq,tag,label,dim}, state}]
let future = [];
let seq = 0;
let nextFilterId = 1;
let status = "loading";   // 状态机：loading（声明性，本应用数据内联不可达）→ ready ⇄ empty；error 仅初始化失败

function clone(o) { return JSON.parse(JSON.stringify(o)); }
function dimOf(key) { return DIMMAP[key]; }
function dimLabel(key) { return dimOf(key).label; }
function fmtVal(key, v) {
  const d = dimOf(key);
  if (d.type === "bool") return BOOL_LABEL[v] ?? String(v);
  if (d.type === "num") return Number.isInteger(v) ? String(v) : String(v);
  return String(v);
}
function catColor(key, v) {
  const d = dimOf(key);
  if (d.type === "num") {
    const t = DIMMAP[key]._norm ? DIMMAP[key]._norm(v) : 0.5;
    return NUM_RAMP[Math.min(5, Math.floor(t * 6))];
  }
  return CAT_COLORS[v] ?? "#8a94a3";
}

// ---------- DOM ----------
const $ = (s) => document.querySelector(s);
const el = {
  app: $("#app"), rowcount: $("#rowcount"), chips: $("#chips"),
  dimlist: $("#dimlist"), scatter: $("#scatter"), tooltip: $("#tooltip"),
  stageStatus: $("#stage-status"), portrait: $("#portrait"),
  portraitLabel: $("#portrait-label"),
  scrollWrap: $("#table-wrap .scroll"), thead: $("#table-head"), tbody: $("#table-body"),
  tableFoot: $("#table-foot"),
  detail: $("#detail"), trail: $("#trail"),
  undo: $("#btn-undo"), redo: $("#btn-redo"), reset: $("#btn-reset"),
};

// ---------- 行集 ----------
function passFilter(r, fs) {
  for (const f of fs) {
    if (f.kind === "range") { const v = r[f.dim]; if (!(v >= f.min && v <= f.max)) return false; }
    else if (!f.set.includes(String(r[f.dim]))) return false;
  }
  return true;
}
function rowsPassing(fs) { const out = []; for (const r of ROWS) if (passFilter(r, fs)) out.push(r); return out; }

// ---------- trail / 快照 ----------
function mutate(meta, fn) {
  past.push({ meta: { seq: ++seq, tag: meta.tag, label: meta.label, dim: meta.dim ?? null }, state: clone(state) });
  if (past.length > 80) past.shift();
  future = [];
  fn();
  renderAll();
}
function undo() {
  if (!past.length) return;
  const node = past.pop();
  future.unshift({ meta: { seq: ++seq, tag: "撤销", label: node.meta.label, dim: node.meta.dim }, state: clone(state) });
  state = node.state;
  renderAll();
}
function redo() {
  if (!future.length) return;
  const node = future.shift();
  past.push({ meta: { seq: ++seq, tag: "重做", label: node.meta.label, dim: node.meta.dim }, state: clone(state) });
  state = node.state;
  renderAll();
}
function jumpTo(i) {
  const node = past[i];
  if (!node) return;
  future.unshift({ meta: { seq: ++seq, tag: "回退", label: node.meta.label, dim: node.meta.dim }, state: clone(state) });
  state = node.state;
  past = past.slice(0, i);
  renderAll();
}
function resetAll() {
  if (JSON.stringify(state) === JSON.stringify(INITIAL)) return;
  mutate({ tag: "复位", label: "复位到初始视图", dim: null }, () => { state = clone(INITIAL); });
}
function resetProjection() {
  mutate({ tag: "投影", label: "复位投影配置", dim: null }, () => { state.proj = clone(INITIAL.proj); });
}

// ---------- 状态操作 ----------
function setRole(role, key) {
  const roleName = { x: "X", y: "Y", color: "颜色", portrait: "画像", sort: "排序" }[role];
  mutate({ tag: "投影", label: `${roleName} = ${dimLabel(key)}`, dim: key }, () => {
    const p = state.proj;
    if (role === "x" || role === "y") {
      const other = role === "x" ? "y" : "x";
      if (p[other] === key) p[other] = p[role];   // 换维时占用另一轴 → 互换，避免 x===y
      p[role] = key;
    } else {
      p[role] = key;
    }
  });
}
function setSort(key) {
  mutate({ tag: "投影", label: key === state.proj.sort ? `排序方向 ${state.proj.sortDir === -1 ? "↑" : "↓"} · ${dimLabel(key)}` : `排序 = ${dimLabel(key)}`, dim: key }, () => {
    const p = state.proj;
    if (p.sort === key) p.sortDir = -p.sortDir; else { p.sort = key; p.sortDir = -1; }
  });
}
function upsertFilter(f) {
  mutate({ tag: "过滤", label: filterLabel(f), dim: f.dim }, () => {
    const i = state.filters.findIndex(x => x.dim === f.dim);
    if (i >= 0) state.filters[i] = f; else state.filters.push(f);
  });
}
function removeFilter(id) {
  const f = state.filters.find(x => x.id === id);
  if (!f) return;
  mutate({ tag: "过滤", label: `移除过滤 · ${dimLabel(f.dim)}`, dim: f.dim }, () => {
    state.filters = state.filters.filter(x => x.id !== id);
  });
}
function filterLabel(f) {
  const d = dimOf(f.dim);
  if (f.kind === "range") {
    const span = d._max - d._min || 1;
    return `${d.label} ∈ [${trim(f.min)}, ${trim(f.max)}] ${d.unit}`;
  }
  const names = f.set.map(v => d.type === "bool" ? BOOL_LABEL[v] : v).join("+");
  return `${d.label} = ${names || "（空）"}`;
}
function trim(v) { return Math.abs(v) >= 100 ? Math.round(v) : +v.toFixed(2); }

// ---------- 选中 ----------
function toggleSelect(id, additive) {
  const row = ROWS[id];
  const has = state.selection.includes(id);
  const n = state.selection.length;
  let label;
  mutate({ tag: "选中", label: "", dim: null }, () => {
    if (additive) {
      if (has) state.selection = state.selection.filter(x => x !== id);
      else state.selection.push(id);
    } else {
      state.selection = has && n === 1 ? [] : [id];
    }
    state.focusId = has && !additive && state.selection.length === 0 ? null : id;
    label = additive ? (has ? "取消选中" : "追加选中") : "点选";
  });
  past[past.length - 1].meta.label = `${label} ${row.name}（${dimLabel(state.proj.x)}=${fmtVal(state.proj.x, row[state.proj.x])}）`;
  renderTrail();
}
function boxSelect(ids, additive) {
  if (!ids.length && !additive && !state.selection.length) return;
  mutate({ tag: "选中", label: `${additive ? "追加框选" : "框选"} ${ids.length} 行`, dim: null }, () => {
    if (additive) { const s = new Set(state.selection); for (const i of ids) s.add(i); state.selection = [...s]; }
    else state.selection = ids;
  });
}
function clearSelection() {
  if (!state.selection.length) return;
  mutate({ tag: "选中", label: `清除选中（${state.selection.length} 行）`, dim: null }, () => {
    state.selection = []; state.focusId = null;
  });
}

// ---------- 视图（viewport，store 持有；换维保留；不入 trail） ----------
function setView(fn) { fn(state.view); renderScatter(rowsPassing(state.filters)); }

// ---------- 排序 ----------
function sortedVisible() {
  const rows = rowsPassing(state.filters);
  const p = state.proj;
  rows.sort((a, b) => (a[p.sort] - b[p.sort]) * p.sortDir || (a.id - b.id));
  return rows;
}

// ---------- 通用绘图 ----------
function fitCanvas(cv) {
  const r = cv.getBoundingClientRect();
  const d = window.devicePixelRatio || 1;
  const w = Math.max(10, Math.round(r.width)), h = Math.max(10, Math.round(r.height));
  if (cv.width !== Math.round(w * d) || cv.height !== Math.round(h * d)) { cv.width = Math.round(w * d); cv.height = Math.round(h * d); }
  const ctx = cv.getContext("2d");
  ctx.setTransform(d, 0, 0, d, 0, 0);
  return [ctx, r.width, r.height];
}
function extent(rows, key) {
  let mn = Infinity, mx = -Infinity;
  for (const r of rows) { const v = r[key]; if (v < mn) mn = v; if (v > mx) mx = v; }
  if (!isFinite(mn)) { mn = 0; mx = 1; }
  if (mn === mx) { mn -= 1; mx += 1; }
  return [mn, mx];
}
function niceTicks(min, max, n) {
  const span = max - min || 1;
  const step0 = span / n;
  const mag = Math.pow(10, Math.floor(Math.log10(step0)));
  const norm = step0 / mag;
  const step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
  const out = [];
  for (let t = Math.ceil(min / step) * step; t <= max + 1e-9; t += step) out.push(t);
  return out;
}
function fmtTick(v) {
  if (Math.abs(v) >= 1000) return (v / 1000).toFixed(v % 1000 === 0 ? 0 : 1) + "k";
  if (Math.abs(v) >= 100) return String(Math.round(v));
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

// ---------- 散点 ----------
let geo = null;      // {x0,y0,w,h,ex,ey}
let pts = [];        // 屏幕坐标缓存 [{id,x,y}]
let hoverId = null;
let drag = null;     // {sx,sy,cx,cy} 框选

function px(v, ex, x0, w, view) { const f = (v - ex[0]) / (ex[1] - ex[0]); return x0 + ((f - view.cx) * view.k + 0.5) * w; }
function py(v, ey, y0, h, view) { const f = (v - ey[0]) / (ey[1] - ey[0]); return y0 + (0.5 - (f - view.cy) * view.k) * h; }

function renderScatter(visible) {
  const [ctx, W, H] = fitCanvas(el.scatter);
  const p = state.proj, view = state.view;
  const x0 = 46, x1 = W - 10, y0 = 10, y1 = H - 30;
  const w = x1 - x0, h = y1 - y0;
  const basis = visible.length ? visible : ROWS;
  const ex = extent(basis, p.x), ey = extent(basis, p.y);
  geo = { x0, y0, w, h, ex, ey };

  ctx.clearRect(0, 0, W, H);
  ctx.font = MONO; ctx.fillStyle = AXIS_TXT;
  // 网格 + 刻度
  ctx.strokeStyle = GRID; ctx.lineWidth = 1;
  for (const t of niceTicks(ex[0], ex[1], 6)) {
    const X = px(t, ex, x0, w, view);
    if (X < x0 - 1 || X > x1 + 1) continue;
    ctx.beginPath(); ctx.moveTo(X, y0); ctx.lineTo(X, y1); ctx.stroke();
    ctx.textAlign = "center"; ctx.fillText(fmtTick(t), X, y1 + 13);
  }
  for (const t of niceTicks(ey[0], ey[1], 5)) {
    const Y = py(t, ey, y0, h, view);
    if (Y < y0 - 1 || Y > y1 + 1) continue;
    ctx.beginPath(); ctx.moveTo(x0, Y); ctx.lineTo(x1, Y); ctx.stroke();
    ctx.textAlign = "right"; ctx.fillText(fmtTick(t), x0 - 6, Y + 3.5);
  }
  ctx.strokeStyle = "#2c3743";
  ctx.strokeRect(x0, y0, w, h);
  // 轴题
  ctx.font = SANS; ctx.fillStyle = AXIS_TXT;
  ctx.textAlign = "right"; ctx.fillText(`${dimLabel(p.x)} (${dimOf(p.x).unit})`, x1, y1 + 27);
  ctx.save(); ctx.translate(13, y0 + 4); ctx.rotate(-Math.PI / 2); ctx.textAlign = "right";
  ctx.fillText(`${dimLabel(p.y)} (${dimOf(p.y).unit})`, 0, 0); ctx.restore();

  // ghost：被过滤排除的行保持可见（行集上下文不丢），不参与命中
  const visSet = new Set(visible.map(r => r.id));
  ctx.fillStyle = "#39434f";
  for (const r of ROWS) {
    if (visSet.has(r.id)) continue;
    const X = px(r[p.x], ex, x0, w, view), Y = py(r[p.y], ey, y0, h, view);
    if (X < x0 || X > x1 || Y < y0 || Y > y1) continue;
    ctx.beginPath(); ctx.arc(X, Y, 1.8, 0, 6.2832); ctx.fill();
  }
  // 点
  pts = [];
  const sel = new Set(state.selection);
  const ck = p.color;
  for (const r of visible) {
    const X = px(r[p.x], ex, x0, w, view), Y = py(r[p.y], ey, y0, h, view);
    if (X < x0 || X > x1 || Y < y0 || Y > y1) { pts.push({ id: r.id, x: X, y: Y, off: true }); continue; }
    pts.push({ id: r.id, x: X, y: Y });
    ctx.beginPath();
    ctx.fillStyle = catColor(ck, r[ck]);
    ctx.arc(X, Y, sel.has(r.id) ? 4 : 2.6, 0, 6.2832);
    ctx.fill();
    if (sel.has(r.id)) {
      ctx.beginPath(); ctx.strokeStyle = ACCENT; ctx.lineWidth = 1.6;
      ctx.arc(X, Y, 6, 0, 6.2832); ctx.stroke();
    }
  }
  if (state.focusId != null) {
    const q = pts.find(t => t.id === state.focusId);
    if (q && !q.off) {
      ctx.beginPath(); ctx.strokeStyle = "#eef4fa"; ctx.lineWidth = 1.2;
      ctx.arc(q.x, q.y, 9, 0, 6.2832); ctx.stroke();
    }
  }
  if (hoverId != null) {
    const q = pts.find(t => t.id === hoverId);
    if (q && !q.off) {
      ctx.beginPath(); ctx.strokeStyle = "#ffffff88"; ctx.lineWidth = 1;
      ctx.arc(q.x, q.y, 7.5, 0, 6.2832); ctx.stroke();
    }
  }
  if (drag) {
    ctx.fillStyle = "#4cc2ff22"; ctx.strokeStyle = ACCENT; ctx.lineWidth = 1;
    const rx = Math.min(drag.sx, drag.cx), ry = Math.min(drag.sy, drag.cy);
    ctx.fillRect(rx, ry, Math.abs(drag.cx - drag.sx), Math.abs(drag.cy - drag.sy));
    ctx.strokeRect(rx, ry, Math.abs(drag.cx - drag.sx), Math.abs(drag.cy - drag.sy));
  }
}

// ---------- 维度画像 ----------
let brush = null;    // {x0,x1} 数据坐标
function renderPortrait(visible) {
  const pd = state.proj.portrait, d = dimOf(pd);
  el.portraitLabel.textContent = `维度画像 · ${d.label}${d.unit ? " (" + d.unit + ")" : ""}`;
  const [ctx, W, H] = fitCanvas(el.portrait);
  ctx.clearRect(0, 0, W, H);
  const own = state.filters.filter(f => f.dim !== pd);
  const others = rowsPassing(own);              // 未受本维过滤影响的行（ghost）
  const vis = visible;                          // 全部过滤后的行（solid）

  if (d.type === "num") {
    const [mn, mx] = extent(others.length ? others : ROWS, pd);
    d._min = mn; d._max = mx; d._norm = v => (v - mn) / (mx - mn);
    const NB = 26, bw = (mx - mn) / NB;
    const gh = new Array(NB).fill(0), vh = new Array(NB).fill(0);
    for (const r of others) gh[Math.min(NB - 1, Math.floor((r[pd] - mn) / bw))]++;
    for (const r of vis) if (r[pd] >= mn && r[pd] <= mx) vh[Math.min(NB - 1, Math.floor((r[pd] - mn) / bw))]++;
    const m = Math.max(1, ...gh);
    const x0 = 8, y0 = 8, h = H - y0 - 16, w = W - x0 - 8;
    ctx.strokeStyle = GRID;
    ctx.strokeRect(x0, y0, w, h);
    const bwpx = w / NB;
    for (let i = 0; i < NB; i++) {
      const bh = (gh[i] / m) * h;
      ctx.fillStyle = "#2c3846";
      ctx.fillRect(x0 + i * bwpx + 0.5, y0 + h - bh, bwpx - 1, bh);
      const vh2 = (vh[i] / m) * h;
      if (vh2 > 0) { ctx.fillStyle = ACCENT + "cc"; ctx.fillRect(x0 + i * bwpx + 0.5, y0 + h - vh2, bwpx - 1, vh2); }
    }
    ctx.font = MONO; ctx.fillStyle = AXIS_TXT;
    ctx.textAlign = "left"; ctx.fillText(fmtTick(mn), x0, H - 4);
    ctx.textAlign = "right"; ctx.fillText(fmtTick(mx), x0 + w, H - 4);
    const f = state.filters.find(x => x.dim === pd && x.kind === "range");
    if (f) {
      const a = px(f.min, [mn, mx], x0, w, { k: 1, cx: 0.5 });
      const b = px(f.max, [mn, mx], x0, w, { k: 1, cx: 0.5 });
      ctx.strokeStyle = ACCENT; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(a, y0); ctx.lineTo(a, y0 + h); ctx.moveTo(b, y0); ctx.lineTo(b, y0 + h); ctx.stroke();
    }
    if (brush) {
      const a = px(brush[0], [mn, mx], x0, w, { k: 1, cx: 0.5 });
      const b = px(brush[1], [mn, mx], x0, w, { k: 1, cx: 0.5 });
      ctx.fillStyle = "#4cc2ff26"; ctx.fillRect(Math.min(a, b), y0, Math.abs(b - a), h);
    }
  } else {
    const vals = d.values;
    const gh = {}, vh = {};
    for (const v of vals) { gh[v] = 0; vh[v] = 0; }
    for (const r of others) gh[r[pd]]++;
    for (const r of vis) vh[r[pd]]++;
    const m = Math.max(1, ...Object.values(gh));
    const x0 = 74, y0 = 6, rh = (H - 16) / vals.length, w = W - x0 - 52;
    ctx.font = SANS;
    vals.forEach((v, i) => {
      const y = y0 + i * rh;
      ctx.fillStyle = AXIS_TXT; ctx.textAlign = "right";
      ctx.fillText(d.type === "bool" ? BOOL_LABEL[v] : v, x0 - 8, y + rh / 2 + 4);
      ctx.fillStyle = "#2c3846";
      ctx.fillRect(x0, y + 3, (gh[v] / m) * w, rh - 8);
      if (vh[v]) { ctx.fillStyle = CAT_COLORS[v] ?? ACCENT; ctx.fillRect(x0, y + 3, (vh[v] / m) * w, rh - 8); }
      ctx.fillStyle = AXIS_TXT; ctx.font = MONO; ctx.textAlign = "left";
      ctx.fillText(String(vh[v]), x0 + (gh[v] / m) * w + 6, y + rh / 2 + 4);
      ctx.font = SANS;
      const on = state.filters.find(x => x.dim === pd && x.kind === "cats" && x.set.includes(String(v)));
      if (on) { ctx.strokeStyle = ACCENT; ctx.strokeRect(x0 - 1, y + 2, w + 2, rh - 6); }
    });
  }
}

// ---------- 维度轨 ----------
function renderRail(visible) {
  const p = state.proj;
  const roleOf = {};
  roleOf[p.x] = "x"; roleOf[p.y] = "y"; roleOf[p.color] = "c"; roleOf[p.portrait] = "p"; roleOf[p.sort] = "s";
  for (const li of el.dimlist.children) {
    const key = li.dataset.key, d = dimOf(key);
    li.setAttribute("aria-selected", String(key === p.portrait));
    li.querySelector(".role[data-role=x]").classList.toggle("on", p.x === key);
    li.querySelector(".role[data-role=y]").classList.toggle("on", p.y === key);
    li.querySelector(".role[data-role=c]").classList.toggle("on", p.color === key);
    li.querySelector(".role[data-role=p]").classList.toggle("on", p.portrait === key);
    li.querySelector(".role[data-role=s]").classList.toggle("on", p.sort === key);
    const cv = li.querySelector("canvas");
    const [ctx] = fitCanvas(cv);
    ctx.clearRect(0, 0, 54, 16);
    const n = visible.length;
    if (!n) continue;
    if (d.type === "num") {
      const [mn, mx] = extent(visible, key);
      const NB = 18, bw = (mx - mn) / NB || 1, bins = new Array(NB).fill(0);
      for (const r of visible) bins[Math.min(NB - 1, Math.floor((r[key] - mn) / bw))]++;
      const m = Math.max(1, ...bins);
      ctx.fillStyle = key === p.portrait ? ACCENT : "#4a5b6e";
      for (let i = 0; i < NB; i++) {
        const bh = (bins[i] / m) * 15;
        ctx.fillRect(i * 3, 16 - bh, 2.2, bh);
      }
    } else {
      const cnt = {};
      for (const v of d.values) cnt[v] = 0;
      for (const r of visible) cnt[r[key]]++;
      let X = 0;
      for (const v of d.values) {
        const frac = cnt[v] / n, w = frac * 54;
        ctx.fillStyle = CAT_COLORS[v] ?? ACCENT;
        ctx.fillRect(X, 4, Math.max(0, w - 0.5), 8);
        X += w;
      }
    }
  }
}

// ---------- 明细表 ----------
function renderTable(visible) {
  const p = state.proj;
  const cols = [
    { key: "name", label: "记录" },
    { key: p.x, label: `X · ${dimLabel(p.x)}` },
    { key: p.y, label: `Y · ${dimLabel(p.y)}` },
    { key: p.portrait, label: `像 · ${dimLabel(p.portrait)}` },
  ];
  const sel = new Set(state.selection);
  let head = "";
  for (const c of cols) {
    const dir = p.sort === c.key ? (p.sortDir === -1 ? "▼" : "▲") : "";
    head += `<th data-key="${c.key}" tabindex="0" aria-label="按${c.label}排序">${c.label}${dir ? `<span class="dir">${dir}</span>` : ""}</th>`;
  }
  el.thead.innerHTML = head;
  const MAX = 60;
  const st = el.scrollWrap.scrollTop;
  let body = "";
  visible.slice(0, MAX).forEach(r => {
    const isSel = sel.has(r.id), isFoc = state.focusId === r.id;
    body += `<tr data-id="${r.id}" class="${isSel ? "sel" : ""}${isFoc ? " focus" : ""}" tabindex="0" aria-selected="${isSel}">
      <td>${r.name}</td>
      <td>${fmtTick(r[p.x])}</td><td>${fmtTick(r[p.y])}</td><td>${fmtTick(r[p.portrait])}</td></tr>`;
  });
  el.tbody.innerHTML = body || `<tr><td colspan="4" style="text-align:center;color:var(--faint)">无匹配行</td></tr>`;
  el.scrollWrap.scrollTop = st;
  el.tableFoot.textContent = visible.length > MAX
    ? `显示前 ${MAX} 行 / 共 ${visible.length} 行 · 排序 ${dimLabel(p.sort)} ${p.sortDir === -1 ? "↓" : "↑"}`
    : `共 ${visible.length} 行 · 排序 ${dimLabel(p.sort)} ${p.sortDir === -1 ? "↓" : "↑"}`;
}

// ---------- 状态条 chips ----------
function renderChips(visible) {
  const p = state.proj;
  let html = "";
  const projChanged = JSON.stringify(p) !== JSON.stringify(INITIAL.proj);
  if (projChanged) {
    html += `<span class="chip proj" data-kind="proj">
      <span class="origin">投影</span>
      X ${dimLabel(p.x)} · Y ${dimLabel(p.y)} · 色 ${dimLabel(p.color)} · 像 ${dimLabel(p.portrait)} · 序 ${dimLabel(p.sort)}
      <button class="x" data-act="reset-proj" title="复位投影" aria-label="复位投影配置">×</button></span>`;
  }
  for (const f of state.filters) {
    html += `<span class="chip" data-kind="filter">
      <span class="origin">${f.origin}</span>${filterLabel(f)}
      <button class="x" data-act="rm-filter" data-id="${f.id}" title="移除该过滤" aria-label="移除过滤 ${filterLabel(f)}">×</button></span>`;
  }
  if (state.selection.length) {
    html += `<span class="chip sel" data-kind="sel">
      <span class="origin">选中</span>${state.selection.length} 行
      <button class="x" data-act="clear-sel" title="清除选中" aria-label="清除选中">×</button></span>`;
  }
  if (!html) html = `<span class="none">无过滤 · 默认投影 — 拖刷画像 / 框选散点 / 换维度，任何状态变更都会在此留下可单独回退的痕迹</span>`;
  el.chips.innerHTML = html;

  el.rowcount.innerHTML = `行 ${ROWS.length} → <b>${visible.length}</b> 可见 · 选中 <b>${state.selection.length}</b>`;
}

// ---------- 检查器 ----------
function renderDetail() {
  if (state.focusId == null) {
    el.detail.innerHTML = `<div class="empty">未聚焦记录 — 在散点 / 画像 / 表格中点选；选中集跨维度切换保留。</div>`;
    return;
  }
  const r = ROWS[state.focusId];
  const isSel = state.selection.includes(r.id);
  let rows = "";
  for (const d of DIMS) {
    const v = r[d.key];
    rows += `<tr><td class="k">${d.label}</td><td class="v">${fmtVal(d.key, v)}${d.unit && d.type === "num" ? " " + d.unit : ""}</td></tr>`;
  }
  el.detail.innerHTML = `<div class="d-name">${r.name}${isSel ? `<span class="tag">已选中</span>` : ""}</div><table>${rows}</table>`;
}
function renderTrail() {
  if (!past.length) { el.trail.innerHTML = `<li><div class="empty">尚无变更 — 每条过滤/投影/选中操作将带归属记录在此</div></li>`; return; }
  let html = "";
  for (let i = past.length - 1; i >= 0; i--) {
    const n = past[i];
    html += `<li><button data-idx="${i}" title="回退到该状态">
      <span class="t-seq">#${n.meta.seq}</span><span class="t-tag">${n.meta.tag}</span>
      <span class="t-label">${n.meta.dim ? dimLabel(n.meta.dim) + " · " : ""}${n.meta.label}</span></button></li>`;
  }
  el.trail.innerHTML = html;
}

// ---------- 总渲染 ----------
function renderAll() {
  const visible = rowsPassing(state.filters);
  status = visible.length ? "ready" : "empty";
  el.app.dataset.status = status;
  el.stageStatus.hidden = status !== "empty";
  el.stageStatus.innerHTML = status === "empty"
    ? `<div><b style="color:var(--danger)">0 行</b> 匹配当前过滤 — 点击状态条上的 × 移除过滤，或 <button id="btn-empty-reset" style="margin:0 4px">复位</button></div>`
    : "";
  if (status === "empty") $("#btn-empty-reset")?.addEventListener("click", resetAll);
  renderRail(visible);
  renderScatter(visible);
  renderPortrait(visible);
  renderTable(visible);
  renderChips(visible);
  renderDetail();
  renderTrail();
  el.undo.disabled = !past.length;
  el.redo.disabled = !future.length;
}

// ---------- 交互绑定 ----------
function initRail() {
  el.dimlist.innerHTML = DIMS.map(d => `
    <li class="dim" role="option" tabindex="-1" data-key="${d.key}" aria-selected="false">
      <span class="roles">
        <span class="role" data-role="x" title="X 轴">X</span><span class="role" data-role="y" title="Y 轴">Y</span><span class="role" data-role="c" title="颜色">色</span><span class="role" data-role="p" title="画像">像</span><span class="role" data-role="s" title="排序">序</span>
      </span>
      <span class="dlabel">${d.label}<span class="unit">${d.unit ?? ""}</span></span>
      <canvas width="108" height="32" aria-hidden="true"></canvas>
    </li>`).join("");
  let focusIdx = 0;
  const items = () => [...el.dimlist.children];
  el.dimlist.addEventListener("click", (e) => {
    const li = e.target.closest(".dim");
    if (li) setRole("portrait", li.dataset.key);
  });
  el.dimlist.addEventListener("keydown", (e) => {
    const li = e.target.closest(".dim");
    if (!li) return;
    const itemsNow = items();
    const idx = itemsNow.indexOf(li);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      focusIdx = Math.max(0, Math.min(itemsNow.length - 1, idx + (e.key === "ArrowDown" ? 1 : -1)));
      itemsNow[focusIdx].focus();
      return;
    }
    const key = li.dataset.key;
    if (e.key === "Enter") { e.preventDefault(); setRole(e.shiftKey ? "y" : "x", key); }
    else if (e.key === "p" || e.key === "P") setRole("portrait", key);
    else if (e.key === "c" || e.key === "C") setRole("color", key);
    else if (e.key === "s" || e.key === "S") setSort(key);
  });
  items()[0].tabIndex = 0;
}

function initScatter() {
  const cv = el.scatter;
  cv.tabIndex = 0;
  cv.addEventListener("pointerdown", (e) => {
    const rc = cv.getBoundingClientRect();
    drag = { sx: e.clientX - rc.left, sy: e.clientY - rc.top, cx: e.clientX - rc.left, cy: e.clientY - rc.top, add: e.shiftKey, moved: false };
    try { cv.setPointerCapture(e.pointerId); } catch { /* 合成事件（无活动指针）时忽略 */ }
  });
  cv.addEventListener("pointermove", (e) => {
    const rc = cv.getBoundingClientRect();
    const mx = e.clientX - rc.left, my = e.clientY - rc.top;
    if (drag) {
      drag.cx = mx; drag.cy = my;
      if (Math.abs(mx - drag.sx) + Math.abs(my - drag.sy) > 5) drag.moved = true;
      renderScatter(rowsPassing(state.filters));
      el.tooltip.hidden = true;
      return;
    }
    // hover 命中
    let best = null, bd = 64;
    for (const t of pts) {
      if (t.off) continue;
      const d2 = (t.x - mx) ** 2 + (t.y - my) ** 2;
      if (d2 < bd) { bd = d2; best = t; }
    }
    if (best) {
      hoverId = best.id;
      const r = ROWS[best.id], p = state.proj;
      el.tooltip.hidden = false;
      el.tooltip.style.left = Math.min(best.x + 12, rc.width - 180) + "px";
      el.tooltip.style.top = (best.y + 12) + "px";
      el.tooltip.innerHTML = `<div class="t-name">${r.name}${state.selection.includes(r.id) ? " ✓" : ""}</div>
        <div class="t-row">${dimLabel(p.x)} ${fmtTick(r[p.x])} · ${dimLabel(p.y)} ${fmtTick(r[p.y])}</div>
        <div class="t-row">${dimLabel(p.color)} ${fmtVal(p.color, r[p.color])}</div>`;
    } else if (hoverId != null) { hoverId = null; el.tooltip.hidden = true; }
  });
  cv.addEventListener("pointerup", (e) => {
    if (!drag) return;
    const d = drag; drag = null;
    if (!d.moved) {
      // 点击：命中点 → 选中切换；空白 → 清除聚焦
      let best = null, bd = 100;
      for (const t of pts) { if (t.off) continue; const d2 = (t.x - d.sx) ** 2 + (t.y - d.sy) ** 2; if (d2 < bd) { bd = d2; best = t; } }
      if (best) toggleSelect(best.id, e.shiftKey || d.add);
      else if (state.focusId != null) {
        mutate({ tag: "选中", label: "清除聚焦", dim: null }, () => { state.focusId = null; });
      }
      renderScatter(rowsPassing(state.filters));
      return;
    }
    // 框选（屏幕空间命中，与感知一致）
    const rx0 = Math.min(d.sx, d.cx), rx1 = Math.max(d.sx, d.cx);
    const ry0 = Math.min(d.sy, d.cy), ry1 = Math.max(d.sy, d.cy);
    const ids = pts.filter(t => !t.off && t.x >= rx0 && t.x <= rx1 && t.y >= ry0 && t.y <= ry1).map(t => t.id);
    boxSelect(ids, d.add);
  });
  cv.addEventListener("pointerleave", () => { hoverId = null; el.tooltip.hidden = true; });
  cv.addEventListener("wheel", (e) => {
    e.preventDefault();
    const rc = cv.getBoundingClientRect();
    const u = (e.clientX - rc.left - geo.x0) / geo.w;
    const v = (e.clientY - rc.top - geo.y0) / geo.h;
    setView((vw) => {
      const f = e.deltaY < 0 ? 1.18 : 1 / 1.18;
      const k2 = Math.min(8, Math.max(1, vw.k * f));
      const cu = (u - 0.5) / vw.k + vw.cx;
      const cvv = (0.5 - v) / vw.k + vw.cy;
      vw.cx = cu - (u - 0.5) / k2;
      vw.cy = cvv - (0.5 - v) / k2;
      vw.k = k2;
    });
  }, { passive: false });
  cv.addEventListener("dblclick", () => setView((vw) => { vw.k = 1; vw.cx = 0.5; vw.cy = 0.5; }));
}

function initPortrait() {
  const cv = el.portrait;
  cv.addEventListener("pointerdown", (e) => {
    const d = dimOf(state.proj.portrait);
    if (d.type !== "num") return;
    brush = null;
    cv.dataset.x0 = String(e.clientX - cv.getBoundingClientRect().left);
    try { cv.setPointerCapture(e.pointerId); } catch { /* 合成事件（无活动指针）时忽略 */ }
  });
  cv.addEventListener("pointermove", (e) => {
    const d = dimOf(state.proj.portrait);
    if (d.type !== "num" || cv.dataset.x0 == null) return;
    const [ctx, W, H] = fitCanvas(cv);
    const x0 = 8, w = W - 16;
    const mx = e.clientX - cv.getBoundingClientRect().left;
    const [mn, mxv] = [d._min ?? 0, d._max ?? 1];
    const a = Math.min(+cv.dataset.x0, mx), b = Math.max(+cv.dataset.x0, mx);
    brush = [mn + ((a - x0) / w) * (mxv - mn), mn + ((b - x0) / w) * (mxv - mn)];
    renderPortrait(rowsPassing(state.filters));
  });
  cv.addEventListener("pointerup", (e) => {
    const d = dimOf(state.proj.portrait);
    delete cv.dataset.x0;
    if (d.type !== "num") { catClick(e); return; }
    if (!brush || brush[1] - brush[0] < (d._max - d._min) * 0.005) { brush = null; renderPortrait(rowsPassing(state.filters)); return; }
    upsertFilter({ id: nextFilterId++, dim: state.proj.portrait, kind: "range", min: brush[0], max: brush[1], origin: "画像拖刷" });
    brush = null;
  });
  function catClick(e) {
    const d = dimOf(state.proj.portrait);
    if (d.type === "num") return;
    const rc = cv.getBoundingClientRect();
    const y = e.clientY - rc.top;
    const rh = (rc.height - 16) / d.values.length;
    const idx = Math.floor((y - 6) / rh);
    if (idx < 0 || idx >= d.values.length) return;
    const v = String(d.values[idx]);
    const cur = state.filters.find(x => x.dim === d.key && x.kind === "cats");
    const set = cur ? new Set(cur.set) : new Set();
    if (set.has(v)) set.delete(v); else set.add(v);
    if (!set.size) {
      if (cur) removeFilter(cur.id);
      return;
    }
    upsertFilter({ id: nextFilterId++, dim: d.key, kind: "cats", set: [...set], origin: "类别点选" });
  }
}

function initTable() {
  el.thead.addEventListener("click", (e) => {
    const th = e.target.closest("th");
    if (th && th.dataset.key !== "name") setSort(th.dataset.key);
  });
  el.thead.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    const th = e.target.closest("th");
    if (th && th.dataset.key !== "name") setSort(th.dataset.key);
  });
  el.tbody.addEventListener("click", (e) => {
    const tr = e.target.closest("tr[data-id]");
    if (tr) toggleSelect(+tr.dataset.id, e.shiftKey || e.ctrlKey);
  });
  el.tbody.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    const tr = e.target.closest("tr[data-id]");
    if (tr) toggleSelect(+tr.dataset.id, e.shiftKey);
  });
}

function initChips() {
  el.chips.addEventListener("click", (e) => {
    const btn = e.target.closest("button.x");
    if (!btn) return;
    const act = btn.dataset.act;
    if (act === "rm-filter") removeFilter(+btn.dataset.id);
    else if (act === "clear-sel") clearSelection();
    else if (act === "reset-proj") resetProjection();
  });
}

function initGlobal() {
  el.undo.addEventListener("click", undo);
  el.redo.addEventListener("click", redo);
  el.reset.addEventListener("click", resetAll);
  el.trail.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-idx]");
    if (b) jumpTo(+b.dataset.idx);
  });
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === "z") { e.preventDefault(); undo(); }
    else if (((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") || ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "z")) { e.preventDefault(); redo(); }
    else if (e.key === "Escape") { brush = null; if (drag) { drag = null; renderScatter(rowsPassing(state.filters)); } el.tooltip.hidden = true; }
  });
  const ro = new ResizeObserver(() => requestAnimationFrame(renderAll));
  ro.observe($("#scatter-wrap"));
  ro.observe($("#portrait-wrap"));
}

// ---------- 初始化（同步、内联数据 → 首屏即 ready，无加载态） ----------
try {
  // 数值维度预归一化（颜色映射用）
  for (const d of DIMS) {
    if (d.type === "num") {
      const [mn, mx] = extent(ROWS, d.key);
      d._min = mn; d._max = mx; d._norm = v => (v - mn) / (mx - mn || 1);
    }
  }
  initRail();
  initScatter();
  initPortrait();
  initTable();
  initChips();
  initGlobal();
  renderAll();
  status = "ready";
  el.app.dataset.status = status;
} catch (err) {
  status = "error";
  el.app.dataset.status = "error";
  console.error("[cell-j13-s10] init failed:", err);
}

// 证据/测试句柄（状态只读；动作入口与 UI 事件一致）
window.EXPLORE = {
  get state() { return state; },
  get status() { return status; },
  get history() { return { past: past.length, future: future.length }; },
  visibleCount: () => rowsPassing(state.filters).length,
  ptsScreen: () => pts.map(t => ({ ...t })),
  upsertFilter, clearSelection, resetAll, undo, redo,
};
