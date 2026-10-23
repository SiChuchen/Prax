/* 脉络 · 依赖关系网 —— 应用逻辑
 * 核心约定（对应验收种子「关系跟随不丢失全局上下文」）：
 *  - 全图永远完整渲染；聚焦时只把无关图元降暗（opacity 0.13），永不隐藏、永不替换视图。
 *  - 「跟随」= 在相邻节点间行走，路径累计为面包屑；可回退、可换向、可分支。
 */
"use strict";

/* ── 常量与索引 ─────────────────────────────────────────── */
const NW = 128, NH = 36;                 // 节点尺寸
const CW = 1690, CH = 1000;              // 画布坐标
const TYPE_NAME = { call: "同步调用", event: "事件", data: "数据读写" };
const TYPE_GLYPH = { call: "─▸", event: "⤍", data: "⇢" };
const CRIT_ORDER = { P0: 0, P1: 1, P2: 2 };

const byId = Object.fromEntries(NODES.map(n => [n.id, n]));
const laneById = Object.fromEntries(LANES.map(l => [l.id, l]));
const EDGES2 = EDGES.map(e => ({ ...e, id: `${e.f}~${e.t}` }));
const edgeById = Object.fromEntries(EDGES2.map(e => [e.id, e]));

const outEdges = {}, inEdges = {}, outTargets = {}, inSources = {}, neighbors = {};
NODES.forEach(n => { outEdges[n.id] = []; inEdges[n.id] = []; outTargets[n.id] = new Set(); inSources[n.id] = new Set(); neighbors[n.id] = new Set(); });
EDGES2.forEach(e => {
  outEdges[e.f].push(e); inEdges[e.t].push(e);
  outTargets[e.f].add(e.t); inSources[e.t].add(e.f);
  neighbors[e.f].add(e.t); neighbors[e.t].add(e.f);
});

function closure(start, nextMap) {
  const seen = new Set(), q = [start];
  while (q.length) {
    const x = q.shift();
    for (const y of nextMap[x]) if (!seen.has(y)) { seen.add(y); q.push(y); }
  }
  return seen;
}
const closureOut = id => { const s = closure(id, outTargets); s.delete(id); return s; };  // 它（传递）依赖的一切（环回到自身时不含自身）
const closureIn  = id => { const s = closure(id, inSources); s.delete(id); return s; };   // （传递）依赖它的一切 = 影响面

/* ── 状态 ──────────────────────────────────────────────── */
const S = { path: [], mode: "adj", selEdge: null, peek: null };

/* ── SVG 构建 ──────────────────────────────────────────── */
const svg = document.getElementById("graph");
const stage = document.getElementById("stage");
const NS = "http://www.w3.org/2000/svg";
const el = (tag, attrs, parent) => {
  const d = document.createElementNS(NS, tag);
  for (const k in attrs) d.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(d);
  return d;
};

function buildDefs() {
  const defs = document.getElementById("defs");
  const mk = (id, color) => {
    const m = el("marker", { id, viewBox: "0 0 8 8", refX: 7, refY: 4, markerWidth: 8, markerHeight: 8, orient: "auto-start-reverse", markerUnits: "userSpaceOnUse" }, defs);
    el("path", { d: "M0,0.6 L8,4 L0,7.4 z", fill: color }, m);
  };
  mk("arr-call", "#3987e5"); mk("arr-event", "#d95926"); mk("arr-data", "#199e70"); mk("arr-trace", "#e8f1ff");

  const pat = el("pattern", { id: "dots", width: 26, height: 26, patternUnits: "userSpaceOnUse" }, defs);
  el("circle", { cx: 1, cy: 1, r: 1, fill: "rgba(255,255,255,0.045)" }, pat);
}

function edgePathD(e) {
  const a = byId[e.f], b = byId[e.t];
  const x1 = a.x + NW, y1 = a.y + NH / 2, x2 = b.x, y2 = b.y + NH / 2;
  if (b.x >= a.x + 40) {                       // 前向：水平贝塞尔
    const mx = (x1 + x2) / 2;
    return `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`;
  }
  if (b.x < a.x - 40) {                        // 回边：绕行画布下方
    const dip = Math.min(Math.max(a.y, b.y) + 110 + (e.id.length % 5) * 14, 972);
    return `M${x1},${y1} C${x1},${dip} ${x2},${dip} ${x2},${y2}`;
  }
  const side = x1 + 52 + (e.id.length % 3) * 14; // 同列：右侧绕行
  return `M${x1},${y1} C${side},${y1} ${side},${y2} ${x2},${y2}`;
}

const edgeG = {};
function buildEdges() {
  const g = document.getElementById("g-edges");
  for (const e of EDGES2) {
    const grp = el("g", { class: `edge-g ${e.type}`.trim() }, g);
    grp.dataset.eid = e.id;
    const d = edgePathD(e);
    el("path", { class: `edge-line e-${e.type}`, d, "marker-end": `url(#arr-${e.type})` }, grp);
    el("path", { class: "edge-hit", d }, grp);
    edgeG[e.id] = grp;
  }
}

const nodeG = {};
function buildNodes() {
  const g = document.getElementById("g-nodes");
  for (const n of NODES) {
    const grp = el("g", { class: "node-g", transform: `translate(${n.x},${n.y})` }, g);
    grp.dataset.nid = n.id;
    if (n.lane === "ext") grp.classList.add("ext");
    el("rect", { class: "node-box", x: 0, y: 0, width: NW, height: NH }, grp);
    el("rect", { class: "node-accent", x: 0, y: 5, width: 3.5, height: NH - 10, fill: laneById[n.lane].accent, rx: 2 }, grp);
    const t = el("text", { class: "node-name", x: 12, y: NH / 2 + 4.5 }, grp);
    t.textContent = n.name;
    nodeG[n.id] = grp;
  }
}

function buildLanes() {
  const g = document.getElementById("g-lanes");
  el("rect", { x: 0, y: 0, width: CW, height: CH, fill: "url(#dots)" }, g);
  for (const l of LANES) {
    el("line", { class: "lane-sep", x1: l.x - 22, y1: 52, x2: l.x - 22, y2: 982 }, g);
    const count = NODES.filter(n => n.lane === l.id).length;
    const t = el("text", { class: "lane-name", x: l.x + 1, y: 34 }, g);
    t.textContent = l.name;
    const c = el("text", { class: "lane-count", x: l.x + 1, y: 50 }, g);
    c.textContent = `× ${count}`;
  }
}

const focusRing = (() => {
  const r = el("rect", { class: "focus-ring", width: NW + 12, height: NH + 12, x: -6, y: -6, rx: 13, visibility: "hidden" }, document.getElementById("g-trace"));
  return r;
})();

/* ── 高亮与渲染 ─────────────────────────────────────────── */
function traceEdges() {
  const out = [];
  for (let i = 0; i + 1 < S.path.length; i++) {
    const a = S.path[i], b = S.path[i + 1];
    const e = edgeById[`${a}~${b}`] || edgeById[`${b}~${a}`];
    if (e) out.push(e);
  }
  return out;
}

function render() {
  const f = S.path[S.path.length - 1] || null;
  const hlN = new Set(), hlE = new Set();
  let dim = false;

  if (S.selEdge) {
    dim = true;
    const e = edgeById[S.selEdge];
    hlN.add(e.f); hlN.add(e.t); hlE.add(e.id);
  } else if (f) {
    dim = true;
    hlN.add(f);
    let set;
    if (S.mode === "deps") set = closureOut(f);
    else if (S.mode === "impact") set = closureIn(f);
    else set = neighbors[f];
    set.forEach(n => hlN.add(n));
    for (const e of EDGES2) if (hlN.has(e.f) && hlN.has(e.t)) hlE.add(e.id);
  }

  const traced = traceEdges();
  traced.forEach(e => { hlE.add(e.id); hlN.add(e.f); hlN.add(e.t); });

  svg.classList.toggle("has-focus", dim);
  for (const n of NODES) {
    const g = nodeG[n.id];
    g.classList.toggle("focus", n.id === f);
    g.classList.toggle("hl", dim && hlN.has(n.id) && n.id !== f);
    g.classList.toggle("dim", dim && !hlN.has(n.id));
  }
  for (const e of EDGES2) {
    const g = edgeG[e.id];
    g.classList.toggle("trace", traced.some(t => t.id === e.id));
    g.classList.toggle("hl", dim && hlE.has(e.id) && !traced.some(t => t.id === e.id));
    g.classList.toggle("dim", dim && !hlE.has(e.id));
    g.classList.toggle("peek", S.peek === e.id);
    const onTrace = traced.some(t => t.id === e.id);
    g.querySelector(".edge-line").setAttribute("marker-end", onTrace ? "url(#arr-trace)" : `url(#arr-${e.type})`);
  }
  if (f) {
    focusRing.setAttribute("x", byId[f].x - 6); focusRing.setAttribute("y", byId[f].y - 6);
    focusRing.setAttribute("visibility", "visible");
  } else focusRing.setAttribute("visibility", "hidden");

  renderTracebar(f);
  renderPanel(f);
  renderTopstats(f);
  syncHash();
}

/* ── 面包屑跟随条 ──────────────────────────────────────── */
const tracebar = document.getElementById("tracebar");
function renderTracebar(f) {
  const sig = S.path.join(",");
  if (sig === traceSig) return;
  traceSig = sig;
  tracebar.innerHTML = "";
  tracebar.hidden = S.path.length === 0;
  if (!S.path.length) return;
  S.path.forEach((id, i) => {
    if (i > 0) {
      const a = S.path[i - 1], b = id;
      const e = edgeById[`${a}~${b}`] || edgeById[`${b}~${a}`];
      const forward = e && e.f === a;
      const sep = document.createElement("span");
      sep.className = "crumb-sep";
      sep.style.color = e ? { call: "#3987e5", event: "#d95926", data: "#199e70" }[e.type] : "var(--ink-3)";
      sep.textContent = forward ? "─▸" : "◂─";
      sep.title = e ? `${e.f} 依赖 ${e.t}（${TYPE_NAME[e.type]}）` : "";
      tracebar.appendChild(sep);
    }
    const btn = document.createElement("button");
    btn.className = "crumb" + (id === f ? " cur" : "");
    btn.textContent = byId[id].name;
    btn.title = id === f ? "当前聚焦" : "回到这一步（保留前缀）";
    btn.addEventListener("click", () => { S.path = S.path.slice(0, i + 1); S.selEdge = null; render(); });
    tracebar.appendChild(btn);
  });
  const meta = document.createElement("span");
  meta.className = "crumb-meta";
  meta.textContent = `影响闭包 ${closureIn(f).size} · 依赖闭包 ${closureOut(f).size}`;
  tracebar.appendChild(meta);
  const clear = document.createElement("button");
  clear.className = "btn"; clear.textContent = "重置";
  clear.addEventListener("click", resetAll);
  tracebar.appendChild(clear);
}

/* ── 右侧上下文面板 ────────────────────────────────────── */
const panel = document.getElementById("panel-body");
let panelSig = null, traceSig = null;   // 脏检查：悬停触发的重渲染不重建 DOM，避免 hover 抖动
const critChip = c => `<span class="crit ${c.toLowerCase()}">${c}</span>`;
const typeBadge = t => `<span class="tbadge ${t}">${TYPE_NAME[t]}</span>`;

function relRow(e, otherId) {
  return `<button class="rel" data-nid="${otherId}" data-eid="${e.id}">
    ${typeBadge(e.type)}<span class="rel-name">${byId[otherId].name}</span>${critChip(e.crit)}
    <span class="rel-label">${e.label}</span></button>`;
}

function renderPanel(f) {
  const sig = S.selEdge ? `e:${S.selEdge}` : f ? `n:${f}` : "ov";
  if (sig === panelSig) return;
  panelSig = sig;
  if (S.selEdge) return renderEdgeCard(edgeById[S.selEdge]);
  if (f) return renderNodeCard(byId[f]);
  renderOverview();
}

function renderOverview() {
  const deg = id => inEdges[id].length + outEdges[id].length;
  const hubs = NODES.map(n => n.id).sort((a, b) => deg(b) - deg(a)).slice(0, 5);
  const p0 = EDGES2.filter(e => e.crit === "P0").length;
  const laneRows = LANES.map(l => {
    const cnt = NODES.filter(n => n.lane === l.id).length;
    const w = Math.round(cnt / 9 * 100);
    return `<div class="row"><span style="width:104px;flex:none">${l.name}</span>
      <span class="bar" style="--lc:${l.accent};width:${w}%"></span><span class="n">${cnt}</span></div>`;
  }).join("");
  const keyIds = ["order~inventory", "order~pay", "pay~wxpay", "pay~alipay", "order~mq"];
  const keyEdges = keyIds.map(id => {
    const e = edgeById[id];
    return `<button class="rel" data-eid="${e.id}" data-nid="">
      ${typeBadge(e.type)}<span class="rel-name">${byId[e.f].name} ▸ ${byId[e.t].name}</span>${critChip(e.crit)}</button>`;
  }).join("");
  panel.innerHTML = `
    <div class="pcard-sec">
      <div class="pkick">全局概览</div>
      <h2>${META.title}</h2>
      <p class="pdesc">${META.note}</p>
    </div>
    <div class="statrow grid3">
      <div><b>${NODES.length}</b><span>节点</span></div>
      <div><b>${EDGES2.length}</b><span>关系</span></div>
      <div><b>${p0}</b><span>P0 关系</span></div>
    </div>
    <h3>分层构成 <small>6 层</small></h3>
    <div class="lane-summary">${laneRows}</div>
    <h3>枢纽节点 <small>按连接度</small></h3>
    <div class="rel-list">${hubs.map(id =>
      `<button class="rel" data-nid="${id}" data-eid=""><span class="rel-name">${byId[id].name}</span>
       <span class="rel-label">${deg(id)} 连接</span></button>`).join("")}</div>
    <h3>P0 关键链路 <small>点击查看关系</small></h3>
    <div class="rel-list">${keyEdges}</div>
    <h3>怎么用</h3>
    <p class="pnote">点击任意节点开始「跟随」：相邻节点可继续行走，路径会累计成面包屑；整张关系网始终可见——其余节点只降暗，<b style="color:var(--ink-2)">不隐藏、不替换</b>，全局上下文永不丢失。</p>`;
}

function renderNodeCard(n) {
  const outs = outEdges[n.id].slice().sort((a, b) => CRIT_ORDER[a.crit] - CRIT_ORDER[b.crit]);
  const ins = inEdges[n.id].slice().sort((a, b) => CRIT_ORDER[a.crit] - CRIT_ORDER[b.crit]);
  panel.innerHTML = `
    <div class="pcard-sec">
      <div class="pkick">节点 · ${laneById[n.lane].name}${n.lane === "ext" ? "（外部）" : ""}</div>
      <h2>${n.name}</h2>
      <p class="pdesc">${n.desc}</p>
      <div class="chips"><span class="chip">团队 · ${n.team}</span></div>
    </div>
    <div class="statrow">
      <div><b>${outs.length}</b><span>直接依赖</span></div>
      <div><b>${ins.length}</b><span>直接被依赖</span></div>
      <div><b>${closureOut(n.id).size}</b><span>依赖闭包</span></div>
      <div><b>${closureIn(n.id).size}</b><span>影响闭包</span></div>
    </div>
    <h3>它依赖 <small>出边 ${outs.length}</small></h3>
    <div class="rel-list">${outs.length ? outs.map(e => relRow(e, e.t)).join("") : '<div class="empty-list">无 —— 它不依赖任何节点</div>'}</div>
    <h3>被谁依赖 <small>入边 ${ins.length} · 出故障时受影响</small></h3>
    <div class="rel-list">${ins.length ? ins.map(e => relRow(e, e.f)).join("") : '<div class="empty-list">无 —— 没有节点依赖它</div>'}</div>
    <div class="btnrow">
      <button class="btn" id="btn-mode-deps">看它依赖什么（闭包 ${closureOut(n.id).size}）</button>
      <button class="btn" id="btn-mode-impact">看谁受它影响（闭包 ${closureIn(n.id).size}）</button>
    </div>`;
  document.getElementById("btn-mode-deps").addEventListener("click", () => setMode("deps"));
  document.getElementById("btn-mode-impact").addEventListener("click", () => setMode("impact"));
}

function renderEdgeCard(e) {
  const a = byId[e.f], b = byId[e.t];
  panel.innerHTML = `
    <div class="pcard-sec">
      <div class="pkick">关系 · ${TYPE_NAME[e.type]}（${e.proto}）${b.lane === "ext" ? " · 跨边界" : ""}</div>
      <div class="edgerel">
        <button data-nid="${a.id}" data-eid="">${a.name}</button>
        <span class="edge-arrow ${e.type}" title="${a.name} 依赖 ${b.name}">──${TYPE_GLYPH[e.type]}</span>
        <button data-nid="${b.id}" data-eid="">${b.name}</button>
      </div>
      <p class="pdesc">${e.label} —— ${e.desc}</p>
    </div>
    <div class="chips">
      <span class="chip">类型 · ${TYPE_NAME[e.type]}</span>
      <span class="chip">协议 · ${e.proto}</span>
      <span class="chip">${critChip(e.crit)} 关键性</span>
    </div>
    <div class="statrow grid3" style="margin-top:14px">
      <div><b>${outEdges[a.id].length}</b><span>${a.name} 的依赖</span></div>
      <div><b>${inEdges[b.id].length}</b><span>${b.name} 被依赖</span></div>
      <div><b>${closureIn(b.id).size}</b><span>${b.name} 影响闭包</span></div>
    </div>
    <h3>继续跟随</h3>
    <div class="rel-list">
      <button class="rel" data-nid="${a.id}" data-eid=""><span class="rel-name">▸ ${a.name}</span><span class="rel-label">上游（依赖方）</span></button>
      <button class="rel" data-nid="${b.id}" data-eid=""><span class="rel-name">▸ ${b.name}</span><span class="rel-label">下游（被依赖方）</span></button>
    </div>
    <p class="pnote" style="margin-top:12px">关系即内容：${TYPE_NAME[e.type]}${e.type === "event" ? "意味着解耦——故障传播慢一拍但同样到达" : e.type === "data" ? "意味着数据契约——模式变更需双向协同" : "意味着同步依赖——可用性直接受下游牵连"}。</p>`;
}

/* ── 顶栏统计 ──────────────────────────────────────────── */
const topstats = document.getElementById("topstats");
function renderTopstats(f) {
  topstats.innerHTML = f
    ? `聚焦 <b>${byId[f].name}</b> · ${NODES.length} 节点 · ${EDGES2.length} 关系`
    : `<b>${NODES.length}</b> 节点 · <b>${EDGES2.length}</b> 关系 · <b>${LANES.length}</b> 层`;
}

/* ── 交互：跟随 ────────────────────────────────────────── */
function followTo(id) {
  if (!byId[id]) return;
  S.selEdge = null;
  const cur = S.path[S.path.length - 1];
  if (cur && cur !== id && neighbors[cur].has(id)) S.path.push(id);   // 相邻：累计跟随
  else if (cur !== id) S.path = [id];                                  // 跳转：新起路径
  render();
}
function resetAll() { S.path = []; S.selEdge = null; setMode("adj"); }
function setMode(m) {
  S.mode = m;
  document.querySelectorAll(".modes button").forEach(b => b.classList.toggle("on", b.dataset.mode === m));
  render();
}

/* 事件委托（面板内按钮） */
panel.addEventListener("click", ev => {
  const b = ev.target.closest("button"); if (!b) return;
  const nid = b.dataset.nid, eid = b.dataset.eid;
  if (nid) followTo(nid);
  else if (eid) { S.selEdge = eid; render(); }   // 保留跟随路径：查看关系不丢弃全局上下文
});
panel.addEventListener("mouseover", ev => {
  const b = ev.target.closest("button"); if (!b) return;
  S.peek = b.dataset.eid || null; render();
});
panel.addEventListener("mouseout", () => { if (S.peek) { S.peek = null; render(); } });

document.querySelectorAll(".modes button").forEach(b => b.addEventListener("click", () => setMode(b.dataset.mode)));
document.getElementById("btn-reset").addEventListener("click", resetAll);

/* SVG 上的点击（拖拽平移后的 click 需抑制） */
let panMoved = false;
svg.addEventListener("click", ev => {
  if (panMoved) { panMoved = false; return; }
  const ng = ev.target.closest(".node-g");
  const hit = ev.target.closest(".edge-hit");
  if (ng) { followTo(ng.dataset.nid); return; }
  if (hit) { S.selEdge = hit.parentNode.dataset.eid; render(); return; }
  if (S.selEdge) { S.selEdge = null; render(); }   // 点空白处 = 取消关系选中（跟随路径保留）
});

/* ── 提示气泡 ──────────────────────────────────────────── */
const tooltip = document.getElementById("tooltip");
function showTip(ev, html) {
  tooltip.innerHTML = html; tooltip.hidden = false;
  const r = stage.getBoundingClientRect();
  let x = ev.clientX - r.left + 14, y = ev.clientY - r.top + 14;
  x = Math.min(x, r.width - tooltip.offsetWidth - 8);
  y = Math.min(y, r.height - tooltip.offsetHeight - 8);
  tooltip.style.left = x + "px"; tooltip.style.top = y + "px";
}
svg.addEventListener("mousemove", ev => {
  const ng = ev.target.closest(".node-g");
  const hit = ev.target.closest(".edge-hit");
  if (ng) {
    const n = byId[ng.dataset.nid];
    showTip(ev, `<b>${n.name}</b><div class="tt-sub">${laneById[n.lane].name} · ${n.team}</div><div class="tt-sub">${n.desc}</div>`);
  } else if (hit) {
    const e = edgeById[hit.parentNode.dataset.eid];
    showTip(ev, `<b>${byId[e.f].name} ${TYPE_GLYPH[e.type]} ${byId[e.t].name}</b>
      <div class="tt-sub">${e.label} · ${TYPE_NAME[e.type]} · ${e.proto} · ${e.crit}</div>`);
  } else tooltip.hidden = true;
});
svg.addEventListener("mouseleave", () => { tooltip.hidden = true; });
svg.addEventListener("mouseover", ev => {
  const hit = ev.target.closest(".edge-hit");
  S.peek = hit ? hit.parentNode.dataset.eid : null; render();
});

/* ── 搜索 ──────────────────────────────────────────────── */
const searchInput = document.getElementById("search");
const searchDrop = document.getElementById("search-drop");
function doSearch(q) {
  q = q.trim().toLowerCase();
  if (!q) { searchDrop.hidden = true; return; }
  const hits = NODES.filter(n => n.name.toLowerCase().includes(q) || n.id.includes(q) || n.desc.includes(q)).slice(0, 8);
  if (!hits.length) { searchDrop.hidden = true; return; }
  searchDrop.innerHTML = hits.map(n =>
    `<button data-nid="${n.id}"><span>${n.name}</span><span class="s-lane">${laneById[n.lane].name}</span></button>`).join("");
  searchDrop.hidden = false;
}
searchInput.addEventListener("input", () => doSearch(searchInput.value));
searchInput.addEventListener("keydown", ev => {
  if (ev.key === "Enter") {
    const first = searchDrop.querySelector("button");
    if (first) { followTo(first.dataset.nid); searchDrop.hidden = true; searchInput.value = ""; searchInput.blur(); }
  } else if (ev.key === "Escape") { searchDrop.hidden = true; searchInput.blur(); }
});
searchDrop.addEventListener("click", ev => {
  const b = ev.target.closest("button"); if (!b) return;
  followTo(b.dataset.nid);
  searchDrop.hidden = true; searchInput.value = "";
});

/* ── 平移与缩放（viewBox） ─────────────────────────────── */
const VB = { x: 0, y: 0, w: CW, h: CH };
function applyVB() { svg.setAttribute("viewBox", `${VB.x} ${VB.y} ${VB.w} ${VB.h}`); }
function fitView() {
  const r = stage.getBoundingClientRect();
  const ar = r.width / Math.max(r.height, 1), dar = CW / CH;
  if (ar > dar) { VB.h = CH; VB.w = CH * ar; VB.x = (CW - VB.w) / 2; VB.y = 0; }
  else { VB.w = CW; VB.h = CW / ar; VB.x = 0; VB.y = (CH - VB.h) / 2; }
  applyVB();
}
function svgPoint(cx, cy) {
  const p = svg.createSVGPoint(); p.x = cx; p.y = cy;
  return p.matrixTransform(svg.getScreenCTM().inverse());
}
function zoomAt(cx, cy, f) {
  const w = Math.min(Math.max(VB.w * f, 320), CW * 3.2);
  f = w / VB.w;
  const pt = svgPoint(cx, cy);
  VB.x = pt.x - (pt.x - VB.x) * f; VB.y = pt.y - (pt.y - VB.y) * f;
  VB.w *= f; VB.h *= f; applyVB();
}
stage.addEventListener("wheel", ev => { ev.preventDefault(); zoomAt(ev.clientX, ev.clientY, ev.deltaY > 0 ? 1.12 : 1 / 1.12); }, { passive: false });
function zoomCenter(f) {
  const r = stage.getBoundingClientRect();
  zoomAt(r.left + r.width / 2, r.top + r.height / 2, f);
}
document.getElementById("btn-zin").addEventListener("click", () => zoomCenter(1 / 1.25));
document.getElementById("btn-zout").addEventListener("click", () => zoomCenter(1.25));

let pan = null;
svg.addEventListener("pointerdown", ev => {
  if (ev.target.closest(".node-g") || ev.target.closest(".edge-hit")) return;
  pan = { x: ev.clientX, y: ev.clientY, vx: VB.x, vy: VB.y };
  svg.classList.add("panning"); svg.setPointerCapture(ev.pointerId);
});
svg.addEventListener("pointermove", ev => {
  if (!pan) return;
  if (Math.abs(ev.clientX - pan.x) + Math.abs(ev.clientY - pan.y) > 3) panMoved = true;
  const r = stage.getBoundingClientRect();
  VB.x = pan.vx - (ev.clientX - pan.x) * VB.w / r.width;
  VB.y = pan.vy - (ev.clientY - pan.y) * VB.h / r.height;
  applyVB();
});
svg.addEventListener("pointerup", () => { pan = null; svg.classList.remove("panning"); });
document.getElementById("btn-fit").addEventListener("click", fitView);
window.addEventListener("resize", fitView);

/* ── 键盘 ──────────────────────────────────────────────── */
window.addEventListener("keydown", ev => {
  if (ev.target.tagName === "INPUT") return;
  if (ev.key === "Escape") resetAll();
  if (ev.key === "f" || ev.key === "F") fitView();
});

/* ── 深链（#p=a>b>c&m=impact / #e=a~b）────── 同一交互代码路径 */
function syncHash() {
  let h = "";
  if (S.selEdge) h = `e=${S.selEdge}`;
  else if (S.path.length) h = `p=${S.path.join(">")}&m=${S.mode}`;
  try { history.replaceState(null, "", h ? "#" + h : location.pathname); } catch (_) { /* file:// 下可能受限 */ }
}
function parseHash() {
  const h = location.hash.slice(1);
  if (!h) return;
  const q = new URLSearchParams(h);
  const e = q.get("e");
  if (e && edgeById[e]) { S.selEdge = e; return; }
  const p = q.get("p");
  if (p) {
    const ids = p.split(">").map(s => s.trim()).filter(id => byId[id]);
    // 只保留可达的连续路径片段
    const ok = [];
    for (const id of ids) {
      const cur = ok[ok.length - 1];
      if (!cur || neighbors[cur].has(id) || id === cur) ok.push(id); else break;
    }
    if (ok.length) S.path = ok;
  }
  const m = q.get("m");
  if (["adj", "deps", "impact"].includes(m)) { S.mode = m; document.querySelectorAll(".modes button").forEach(b => b.classList.toggle("on", b.dataset.mode === m)); }
}

/* ── 启动：同步构建 + 首屏即渲染，无加载态 ─────────────── */
buildDefs(); buildLanes(); buildEdges(); buildNodes();
parseHash();
fitView();
render();
