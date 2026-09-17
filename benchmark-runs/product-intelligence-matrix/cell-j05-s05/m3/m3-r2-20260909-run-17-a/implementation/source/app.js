/* ============================================================
 * 脉络 Trace · 引擎层
 * 全景分层布局（确定性 barycenter）· 闭包/链路/路径分析 · 渲染与交互
 * ============================================================ */
'use strict';

/* ---------- 常量 ---------- */
const SVG_NS = 'http://www.w3.org/2000/svg';
const VIEW_W = 1720, VIEW_H = 940, MARGIN = 110;
const PILL_W = 118, PILL_H = 44;

const BANDS = {
  access:  { label: '接入层',     note: '入口 · 路由 · 鉴权', y: 14,  h: 132 },
  service: { label: '业务服务层', note: '领域微服务',         y: 158, h: 336 },
  topic:   { label: '消息总线',   note: 'Kafka 事件流',       y: 506, h: 126 },
  data:    { label: '数据与外部', note: '存储 · 外部依赖',    y: 644, h: 282 },
};

const TYPES = {
  access:   { label: '接入', color: 'var(--t-access)' },
  service:  { label: '服务', color: 'var(--t-service)' },
  topic:    { label: '消息', color: 'var(--t-topic)' },
  data:     { label: '数据', color: 'var(--t-data)' },
  external: { label: '外部', color: 'var(--t-external)' },
};

const KIND_LABEL = { sync: '同步调用', event: '事件流', data: '数据读写' };

/* ---------- 索引 ---------- */
const NODES = GRAPH.nodes, EDGES = GRAPH.edges;
EDGES.forEach((e, i) => { e.id = 'e' + i; });
const byId = new Map(NODES.map(n => [n.id, n]));

const adj = {
  out: new Map(NODES.map(n => [n.id, []])),
  in:  new Map(NODES.map(n => [n.id, []])),
};
for (const e of EDGES) {
  adj.out.get(e.from).push(e);
  adj.in.get(e.to).push(e);
}

/* ---------- 图分析 ---------- */
// 沿依赖方向（出边）或影响方向（入边）的 BFS 距离场
function walk(startId, dir) {
  const dist = new Map([[startId, 0]]);
  const q = [startId];
  while (q.length) {
    const u = q.shift();
    const list = dir === 'deps' ? adj.out.get(u) : adj.in.get(u);
    for (const e of list) {
      const v = dir === 'deps' ? e.to : e.from;
      if (!dist.has(v)) { dist.set(v, dist.get(u) + 1); q.push(v); }
    }
  }
  return dist;
}

// 最长影响链（入边方向最长简单路径，带回溯防环，图小代价可忽略）
function longestChain(id) {
  let best = 0;
  const vis = new Set([id]);
  (function dfs(u, d) {
    best = Math.max(best, d);
    for (const e of adj.in.get(u)) {
      if (vis.has(e.from)) continue;
      vis.add(e.from); dfs(e.from, d + 1); vis.delete(e.from);
    }
  })(id, 0);
  return best;
}

// 依赖方向最短路（BFS），返回 {nodes, edges} 或 null
function shortestPath(a, b) {
  if (a === b) return { nodes: [a], edges: [] };
  const prev = new Map([[a, null]]);
  const prevEdge = new Map();
  const q = [a];
  while (q.length) {
    const u = q.shift();
    for (const e of adj.out.get(u)) {
      if (prev.has(e.to)) continue;
      prev.set(e.to, u); prevEdge.set(e.to, e);
      if (e.to === b) {
        const nodes = [b], edges = [];
        let cur = b;
        while (prev.get(cur) !== null) {
          edges.push(prevEdge.get(cur));
          cur = prev.get(cur); nodes.push(cur);
        }
        return { nodes: nodes.reverse(), edges: edges.reverse() };
      }
      q.push(e.to);
    }
  }
  return null;
}

// 影响闭包最大的节点（全局枢纽）
const IMPACT_SIZE = new Map(NODES.map(n => [n.id, walk(n.id, 'impact').size - 1]));
const TOP_HUBS = [...IMPACT_SIZE.entries()]
  .sort((x, y) => y[1] - x[1] || byId.get(x[0]).name.localeCompare(byId.get(y[0]).name))
  .slice(0, 5);

/* ---------- 全景布局（确定性 barycenter 弛豫） ---------- */
function computeLayout() {
  const rows = new Map();
  NODES.forEach((n, i) => {
    n._i = i;
    const k = n.band + '|' + n.row;
    if (!rows.has(k)) rows.set(k, []);
    rows.get(k).push(n);
  });

  const spread = (list) => {
    const n = list.length;
    if (n === 1) { list[0].x = VIEW_W / 2; return; }
    const span = VIEW_W - 2 * MARGIN;
    list.forEach((nd, i) => { nd.x = MARGIN + span * i / (n - 1); });
  };
  for (const [, list] of rows) spread(list);

  // 行内 y：单行居中，双行 0.28 / 0.72
  for (const [k, list] of rows) {
    const band = BANDS[k.split('|')[0]];
    const r = list[0].row;
    const frac = r === 0
      ? (list.length && rows.has(k.split('|')[0] + '|1') ? 0.28 : 0.5)
      : 0.72;
    list.forEach(nd => { nd.y = band.y + band.h * frac; });
  }

  // barycenter 迭代：按邻居均值重排行内顺序
  for (let it = 0; it < 28; it++) {
    for (const [k, list] of rows) {
      const target = list.map(nd => {
        let sum = 0, c = 0;
        for (const e of adj.out.get(nd.id)) { const m = byId.get(e.to); if (m.x != null) { sum += m.x; c++; } }
        for (const e of adj.in.get(nd.id))  { const m = byId.get(e.from); if (m.x != null) { sum += m.x; c++; } }
        return c ? sum / c : nd.x;
      });
      const order = list.map((_, i) => i)
        .sort((a, b) => (target[a] - target[b]) || (list[a]._i - list[b]._i));
      spread(order.map(i => list[i]));
    }
  }
}
computeLayout();

/* ---------- SVG 构建 ---------- */
const svg = document.getElementById('graph');
const el = (tag, attrs) => {
  const nd = document.createElementNS(SVG_NS, tag);
  for (const k in attrs) nd.setAttribute(k, attrs[k]);
  return nd;
};

function buildDefs() {
  const defs = el('defs', {});
  const mk = (id, color) => {
    const m = el('marker', {
      id, viewBox: '0 0 10 10', refX: 9, refY: 5,
      markerWidth: 6.5, markerHeight: 6.5, orient: 'auto-start-reverse',
    });
    m.appendChild(el('path', { d: 'M0 0 L10 5 L0 10 Z', fill: color }));
    defs.appendChild(m);
  };
  mk('m-neutral', '#465062');
  mk('m-dep', '#3987e5');
  mk('m-impact', '#d95926');
  mk('m-trail', '#e8edf5');
  svg.appendChild(defs);
}

function buildBands() {
  const g = el('g', {});
  for (const key in BANDS) {
    const b = BANDS[key];
    g.appendChild(el('rect', { class: 'band', x: 10, y: b.y, width: VIEW_W - 20, height: b.h, rx: 12 }));
    const t = el('text', { class: 'band-label', x: 26, y: b.y + 24 });
    t.textContent = b.label;
    g.appendChild(t);
    const nt = el('text', { class: 'band-note', x: 26 + b.label.length * 15 + 18, y: b.y + 24 });
    nt.textContent = '· ' + b.note;
    g.appendChild(nt);
  }
  svg.appendChild(g);
}

function edgeGeometry(e) {
  const u = byId.get(e.from), v = byId.get(e.to);
  if (Math.abs(v.y - u.y) > 10) {
    const down = v.y > u.y;
    const x1 = u.x, x2 = v.x;
    const y1 = down ? u.y + PILL_H / 2 : u.y - PILL_H / 2;   // 从依赖方边缘出发
    const y2 = down ? v.y - PILL_H / 2 : v.y + PILL_H / 2;
    const k = (y2 - y1) * 0.45;
    return {
      d: `M ${x1} ${y1} C ${x1} ${y1 + k}, ${x2} ${y2 - k}, ${x2} ${y2}`,
      lx: (x1 + x2) / 2, ly: (y1 + y2) / 2 - 5,
    };
  }
  const dir = v.x >= u.x ? 1 : -1;
  const x1 = u.x + dir * PILL_W / 2, y1 = u.y, x2 = v.x - dir * PILL_W / 2, y2 = v.y;
  const k = (x2 - x1) * 0.45;
  return {
    d: `M ${x1} ${y1} C ${x1 + k} ${y1}, ${x2 - k} ${y2}, ${x2} ${y2}`,
    lx: (x1 + x2) / 2, ly: Math.min(y1, y2) - 9,
  };
}

const edgeEls = new Map(), nodeEls = new Map();

function buildEdges() {
  const g = el('g', {});
  for (const e of EDGES) {
    const geo = edgeGeometry(e);
    const eg = el('g', { class: `edge e-k-${e.kind}`, 'data-id': e.id });
    const line = el('path', { class: 'eline', d: geo.d });
    const hit = el('path', { class: 'ehit', d: geo.d });
    const label = el('text', { class: 'elabel', x: geo.lx, y: geo.ly });
    label.textContent = e.label;
    eg.appendChild(line); eg.appendChild(hit); eg.appendChild(label);
    g.appendChild(eg);
    edgeEls.set(e.id, eg);
  }
  svg.appendChild(g);
}

const SHAPE_PATH = {
  service:  () => el('circle', { class: 'nshape-service', cx: -44, cy: 0, r: 4.5 }),
  access:   () => el('path', { class: 'nshape-access', d: 'M -44 -5.5 L -38.5 4.5 L -49.5 4.5 Z' }),
  topic:    () => el('path', { class: 'nshape-topic', d: 'M -44 -6 L -37.5 0 L -44 6 L -50.5 0 Z' }),
  data:     () => el('rect', { class: 'nshape-data', x: -48.5, y: -4.5, width: 9, height: 9, rx: 2 }),
  external: () => el('circle', { class: 'nshape-external', cx: -44, cy: 0, r: 4 }),
};

function buildNodes() {
  const g = el('g', {});
  for (const n of NODES) {
    const ng = el('g', { class: `node t-${n.type}`, 'data-id': n.id, transform: `translate(${n.x},${n.y})` });
    ng.appendChild(el('rect', { class: 'np', x: -PILL_W / 2, y: -PILL_H / 2, width: PILL_W, height: PILL_H, rx: 10 }));
    ng.appendChild(SHAPE_PATH[n.type]());
    const name = el('text', { class: 'nname', y: -3 }); name.textContent = n.name;
    const idt = el('text', { class: 'nid', y: 13 }); idt.textContent = n.id;
    ng.appendChild(name); ng.appendChild(idt);
    if (n.crit === 'P0' || n.crit === 'P1') {
      ng.appendChild(el('circle', { class: n.crit === 'P0' ? 'ncrit' : 'ncrit-p1', cx: 48, cy: -13, r: 3 }));
    }
    // 轨迹序号徽标（默认隐藏）
    ng.appendChild(el('circle', { class: 'nstep', cx: -PILL_W / 2, cy: -PILL_H / 2, r: 8, visibility: 'hidden' }));
    const step = el('text', { class: 'nstep-t', x: -PILL_W / 2, y: -PILL_H / 2 + 3.5, visibility: 'hidden' });
    ng.appendChild(step);
    g.appendChild(ng);
    nodeEls.set(n.id, ng);
  }
  svg.appendChild(g);
}

buildDefs(); buildBands(); buildEdges(); buildNodes();

/* ---------- 状态 ---------- */
const state = {
  sel: null,          // {kind:'node'|'edge', id}
  dir: 'both',        // deps | both | impact
  depth: 1,           // 1 | 2 | 3 | 99
  trail: [],          // [{node, edge|null}]
  visited: new Set(),
  pathMode: false,
  pathSel: { from: null, to: null },
  pathResult: null,   // {dep, impact}
};

/* ---------- 焦点计算 ---------- */
function computeFocus() {
  const fnodes = new Map(), fedges = new Map();
  if (state.sel && state.sel.kind === 'node') {
    const id = state.sel.id;
    const dd = state.dir !== 'impact' ? walk(id, 'deps') : new Map();
    const di = state.dir !== 'deps' ? walk(id, 'impact') : new Map();
    for (const n of NODES) {
      const d = Math.min(
        dd.has(n.id) ? dd.get(n.id) : Infinity,
        di.has(n.id) ? di.get(n.id) : Infinity,
      );
      if (d <= state.depth) fnodes.set(n.id, true);
    }
    for (const e of EDGES) {
      if (state.dir !== 'impact' && dd.has(e.from) && dd.get(e.to) === dd.get(e.from) + 1 && dd.get(e.to) <= state.depth) {
        fedges.set(e.id, 'dep');
      } else if (state.dir !== 'deps' && di.has(e.to) && di.get(e.from) === di.get(e.to) + 1 && di.get(e.from) <= state.depth) {
        fedges.set(e.id, 'impact');
      }
    }
  } else if (state.sel && state.sel.kind === 'edge') {
    const e = EDGES.find(x => x.id === state.sel.id);
    fnodes.set(e.from, true); fnodes.set(e.to, true);
    fedges.set(e.id, 'dep');
  } else if (state.pathResult) {
    for (const p of [state.pathResult.dep, state.pathResult.impact]) {
      if (!p) continue;
      for (const id of p.nodes) fnodes.set(id, true);
      for (const e of p.edges) fedges.set(e.id, p === state.pathResult.dep ? 'pathdep' : 'pathimpact');
    }
  }
  // 轨迹在跟随态下永久可见（总览态不产生焦点，全景素净）
  if (state.sel) {
    for (const t of state.trail) {
      fnodes.set(t.node, fnodes.get(t.node) || 'trail');
      if (t.edge) fedges.set(t.edge, 'trail');
    }
  }
  return { fnodes, fedges };
}

/* ---------- 渲染：图谱 ---------- */
function renderGraph() {
  const { fnodes, fedges } = computeFocus();
  const hasFocus = fnodes.size > 0;
  const activeEdges = [...fedges.values()].filter(c => c !== 'trail').length;
  const showLabels = activeEdges > 0 && activeEdges <= 12;

  for (const n of NODES) {
    const g = nodeEls.get(n.id);
    const active = fnodes.has(n.id);
    const cls = ['node', 't-' + n.type];
    if (hasFocus && !active) cls.push('dim');
    if (state.sel && state.sel.kind === 'node' && state.sel.id === n.id) cls.push('sel');
    const ti = state.trail.findIndex(t => t.node === n.id);
    if (ti >= 0) cls.push('trail-out');
    g.setAttribute('class', cls.join(' '));

    const stepC = g.querySelectorAll('.nstep')[0];
    const stepT = g.querySelectorAll('.nstep-t')[0];
    if (ti >= 0) {
      stepC.setAttribute('visibility', 'visible');
      stepT.setAttribute('visibility', 'visible');
      stepT.textContent = String(ti + 1);
    } else {
      stepC.setAttribute('visibility', 'hidden');
      stepT.setAttribute('visibility', 'hidden');
    }
  }

  for (const e of EDGES) {
    const g = edgeEls.get(e.id);
    const role = fedges.get(e.id);
    const cls = ['edge', 'e-k-' + e.kind];
    if (role) cls.push(role);
    else if (hasFocus) cls.push('dim');
    if (showLabels && (role === 'dep' || role === 'impact' || role === 'pathdep' || role === 'pathimpact')) cls.push('showlabel');
    g.setAttribute('class', cls.join(' '));
  }
}

/* ---------- 渲染：面板 ---------- */
const panel = document.getElementById('panel');
const esc = s => s; // 数据为本地受控内容

function kindTag(kind) { return `<span class="rel-label">${esc(kindLabelCn(kind))}</span>`; }
function kindLabelCn(k) { return KIND_LABEL[k]; }

function shapeCls(type) { return 'shape s-' + type; }

function relRow(nodeId, edge, dirLabel) {
  const n = byId.get(nodeId);
  return `<button class="rel-row" data-follow="${n.id}" data-edge="${edge.id}">
    <i class="${shapeCls(n.type)}"></i>
    <span class="rel-name">${n.name}</span>
    ${kindTag(edge.kind)}
    <span class="rel-label">${esc(edge.label)}</span>
    <span class="rel-go">${dirLabel} →</span>
  </button>`;
}

function relList(title, items, dirLabel) {
  return `<div class="card"><h3>${title}</h3><div class="rel-list">${
    items.length ? items.map(([nid, e]) => relRow(nid, e, dirLabel)).join('') : '<div class="rel-empty">无</div>'
  }</div></div>`;
}

function nodePanel(id) {
  const n = byId.get(id);
  const deps = adj.out.get(id), imps = adj.in.get(id);
  const depClo = walk(id, 'deps').size - 1, impClo = walk(id, 'impact').size - 1;
  const chain = longestChain(id);
  return `
  <div class="card">
    <div class="p-head">
      <i class="${shapeCls(n.type)}"></i>
      <div class="p-title">
        <h2>${n.name}</h2>
        <div class="pid">${n.id} · ${TYPES[n.type].label}</div>
        <div class="p-badges">
          ${n.crit !== 'P2' ? `<span class="badge crit-${n.crit.toLowerCase()}">${n.crit}</span>` : '<span class="badge">P2</span>'}
          <span class="badge">${n.domain}</span>
          <span class="badge">${BANDS[n.band].label}</span>
          <span class="badge">${n.owner}</span>
        </div>
      </div>
    </div>
    <p class="p-desc">${n.desc}</p>
    <div class="stat-grid">
      <div class="stat st-dep"><b>${deps.length}</b><span>直接依赖</span></div>
      <div class="stat st-imp"><b>${imps.length}</b><span>直接影响</span></div>
      <div class="stat"><b>${depClo}</b><span>依赖闭包</span></div>
      <div class="stat"><b>${impClo}</b><span>影响闭包</span></div>
      <div class="stat"><b>${chain}</b><span>影响链深</span></div>
    </div>
    <div class="actions">
      <button class="act-btn orange" data-view="impact">看影响闭包</button>
      <button class="act-btn blue" data-view="deps">看依赖闭包</button>
      <button class="act-btn" data-view="path">路径分析由此出发</button>
    </div>
  </div>
  ${relList('它依赖 · ' + deps.length, deps.map(e => [e.to, e]), '跟随')}
  ${relList('被谁依赖 · ' + imps.length, imps.map(e => [e.from, e]), '跟随')}`;
}

function edgePanel(edgeId) {
  const e = EDGES.find(x => x.id === edgeId);
  const a = byId.get(e.from), b = byId.get(e.to);
  const blast = walk(b.id, 'impact').size - 1;
  return `
  <div class="card">
    <h3>关系详情</h3>
    <div class="p-head">
      <div class="p-title">
        <h2 style="font-size:15px">${a.name} <span style="color:var(--dep)">→</span> ${b.name}</h2>
        <div class="p-badges" style="margin-top:6px">
          <span class="badge">${KIND_LABEL[e.kind]}</span>
          <span class="badge">${esc(e.label)}</span>
        </div>
      </div>
    </div>
    <p class="p-desc">${a.name} 依赖 ${b.name}（${KIND_LABEL[e.kind]}）。若 ${b.name} 不可用，该关系中断，波及 ${a.name} 及其下游共 <b style="color:var(--impact)">${blast}</b> 个节点。</p>
    <div class="actions">
      <button class="act-btn blue" data-jump="${a.id}">定位 ${a.name}</button>
      <button class="act-btn blue" data-jump="${b.id}">定位 ${b.name}</button>
    </div>
  </div>`;
}

function pathCard(title, path, cls) {
  if (!path || path.nodes.length < 2) {
    return `<div class="card"><h3>${title}</h3><div class="rel-empty">不存在该方向的路径</div></div>`;
  }
  let html = `<div class="path-seg">`;
  path.nodes.forEach((id, i) => {
    const n = byId.get(id);
    html += `<div class="path-step ${cls}"><span class="dot"></span><button data-pathjump="${id}">${n.name}</button></div>`;
    if (i < path.edges.length) {
      const e = path.edges[i];
      html += `<div class="path-hopv">│ ${KIND_LABEL[e.kind]} · ${esc(e.label)}</div>`;
    }
  });
  html += `</div>`;
  return `<div class="card"><h3>${title} · ${path.nodes.length} 节点 / ${path.edges.length} 跳</h3>${html}</div>`;
}

function overviewPanel() {
  const bandCounts = {};
  for (const n of NODES) bandCounts[n.band] = (bandCounts[n.band] || 0) + 1;
  const maxHub = TOP_HUBS[0][1];
  return `
  <div class="card">
    <h3>全局总览</h3>
    <div class="p-title"><h2 style="font-size:16px">${GRAPH.meta.title}</h2></div>
    <div class="stat-grid" style="grid-template-columns:repeat(3,1fr)">
      <div class="stat"><b>${NODES.length}</b><span>节点</span></div>
      <div class="stat"><b>${EDGES.length}</b><span>关系</span></div>
      <div class="stat"><b>${Object.keys(BANDS).length}</b><span>层带</span></div>
    </div>
    <div class="kv">
      ${Object.keys(BANDS).map(k => `<span>${BANDS[k].label} <b>${bandCounts[k] || 0}</b></span>`).join('')}
    </div>
    <p class="p-desc">${GRAPH.meta.bandNote}。选中任意节点即可沿蓝（依赖）橙（影响）双向跟随，轨迹与全景始终保留。</p>
  </div>
  <div class="card">
    <h3>影响闭包最大 · 全局枢纽</h3>
    <div class="ov-rows">
      ${TOP_HUBS.map(([id, sz], i) => {
        const n = byId.get(id);
        return `<button class="ov-row" data-follow="${id}">
          <span class="ov-rank">${i + 1}</span>
          <i class="${shapeCls(n.type)}"></i>
          <span class="rel-name">${n.name}</span>
          <span class="ov-bar-wrap"><i class="ov-bar" style="width:${Math.max(6, sz / maxHub * 100)}%;background:var(--impact)"></i></span>
          <span class="ov-num">波及 ${sz}</span>
        </button>`;
      }).join('')}
    </div>
  </div>
  <div class="card">
    <h3>跟随方式</h3>
    <div class="rel-list">
      <div class="rel-empty">· 点击节点：跟随其依赖（蓝）与影响（橙）</div>
      <div class="rel-empty">· 点击连线：查看关系详情（关系即内容）</div>
      <div class="rel-empty">· 路径分析：任选两节点求依赖 / 影响路径</div>
      <div class="rel-empty">· 轨迹条：回溯走访过的每一步，全景不丢</div>
    </div>
  </div>`;
}

function renderPanel() {
  if (state.pathResult) {
    const { from, to } = state.pathSel;
    const fa = byId.get(from).name, fb = byId.get(to).name;
    panel.innerHTML = `
      <div class="card"><h3>路径分析</h3>
        <div class="path-hint">${fa} ⇢ ${fb}：蓝色为依赖路径（${fa} 逐层依赖到 ${fb}），橙色为影响路径（${fa} 逐层波及到 ${fb}）。点击路径中任意节点可查看详情，路径保持常亮。</div>
        <div class="actions">
          <button class="act-btn" data-view="exitpath">退出路径分析</button>
        </div>
      </div>
      ${pathCard('依赖路径', state.pathResult.dep, 'dep-hop')}
      ${pathCard('影响路径', state.pathResult.impact, 'impact-hop')}
      ${state.sel && state.sel.kind === 'node' ? nodePanel(state.sel.id) : ''}`;
    return;
  }
  if (state.pathMode) {
    const stage = state.pathSel.from
      ? `起点已定：<b>${byId.get(state.pathSel.from).name}</b>，请点击终点节点。`
      : '请点击<b>起点</b>节点（再点终点即出路径）。';
    panel.innerHTML = `
      <div class="card"><h3>路径分析</h3>
        <div class="path-hint">${stage}</div>
        <div class="actions"><button class="act-btn" data-view="exitpath">退出路径分析</button></div>
      </div>`;
    return;
  }
  if (state.sel && state.sel.kind === 'node') { panel.innerHTML = nodePanel(state.sel.id); return; }
  if (state.sel && state.sel.kind === 'edge') { panel.innerHTML = edgePanel(state.sel.id); return; }
  panel.innerHTML = overviewPanel();
}

/* ---------- 渲染：轨迹条 + 顶栏 ---------- */
const trailChips = document.getElementById('trail-chips');
const coverageEl = document.getElementById('coverage');
const globalStats = document.getElementById('global-stats');

function buildGlobalStats() {
  globalStats.innerHTML = `
    <div class="gs-item"><b>${NODES.length}</b>节点</div>
    <div class="gs-item"><b>${EDGES.length}</b>关系</div>
    <div class="gs-item"><b>${Object.keys(BANDS).length}</b>层带</div>
    <div class="gs-sep"></div>
    <div class="gs-cov">
      <div class="gs-cov-top"><span>走访覆盖</span><b id="cov-num"></b></div>
      <div class="gs-bar"><i id="cov-bar" style="width:0%"></i></div>
    </div>`;
}

function renderTrail() {
  const cur = state.sel && state.sel.kind === 'node' ? state.sel.id : null;
  let html = '';
  state.trail.forEach((t, i) => {
    const n = byId.get(t.node);
    if (i > 0) {
      const pe = t.edge ? EDGES.find(e => e.id === t.edge) : null;
      html += `<span class="trail-hop">→${pe ? ` <b>${KIND_LABEL[pe.kind]}</b>` : ''}→</span>`;
    }
    html += `<button class="trail-chip${t.node === cur ? ' cur' : ''}" data-trail="${i}">
      <span class="step">${i + 1}</span>${n.name}</button>`;
  });
  trailChips.innerHTML = html || '<span class="trail-hop" style="padding-left:2px">点击节点开始跟随</span>';
  const cov = state.visited.size;
  coverageEl.textContent = `已走访 ${cov}/${NODES.length}`;
  document.getElementById('cov-num').textContent = `${cov}/${NODES.length}`;
  document.getElementById('cov-bar').style.width = (cov / NODES.length * 100) + '%';
}

function render() { renderGraph(); renderPanel(); renderTrail(); }

/* ---------- 交互 ---------- */
function follow(id, edgeId) {
  if (state.pathMode) {
    if (!state.pathSel.from || state.pathSel.to) {
      state.pathSel = { from: id, to: null }; state.pathResult = null;
    } else if (id !== state.pathSel.from) {
      state.pathSel.to = id;
      const dep = shortestPath(state.pathSel.from, state.pathSel.to);
      const back = shortestPath(state.pathSel.to, state.pathSel.from);
      const impact = back ? { nodes: [...back.nodes].reverse(), edges: [...back.edges].reverse() } : null;
      state.pathResult = { dep, impact };
    }
    state.sel = { kind: 'node', id };
    render(); syncHash(); return;
  }
  const cur = state.trail.length ? state.trail[state.trail.length - 1].node : null;
  if (id !== cur) {
    state.trail.push({ node: id, edge: edgeId || null });
    state.visited.add(id);
  }
  state.sel = { kind: 'node', id };
  render(); syncHash();
}

function selectEdge(edgeId) {
  state.sel = { kind: 'edge', id: edgeId };
  render();
}

function resetAll() {
  state.sel = null; state.trail = []; state.visited = new Set();
  state.pathMode = false; state.pathSel = { from: null, to: null }; state.pathResult = null;
  document.getElementById('path-btn').classList.remove('on');
  render(); syncHash();
}

// 事件委托：图谱
svg.addEventListener('click', (ev) => {
  const nodeG = ev.target.closest('.node');
  if (nodeG) { follow(nodeG.dataset.id, null); return; }
  const edgeG = ev.target.closest('.edge');
  if (edgeG) { selectEdge(edgeG.dataset.id); return; }
  if (ev.target === svg) {
    state.sel = null;
    if (state.pathMode) { state.pathResult = null; }
    render();
  }
});

// 悬停：直接邻居提亮 + 节点 tooltip
const tooltip = document.getElementById('tooltip');
svg.addEventListener('mousemove', (ev) => {
  const nodeG = ev.target.closest('.node');
  const edgeG = ev.target.closest('.edge');
  if (nodeG) {
    const n = byId.get(nodeG.dataset.id);
    tooltip.innerHTML = `<b>${n.name}</b>${TYPES[n.type].label} · ${n.domain} · ${n.owner}<br>直接依赖 ${adj.out.get(n.id).length} · 直接影响 ${adj.in.get(n.id).length} · 影响闭包波及 ${IMPACT_SIZE.get(n.id)}`;
    tooltip.classList.remove('hidden');
    tooltip.style.left = Math.min(window.innerWidth - 260, ev.clientX + 14) + 'px';
    tooltip.style.top = (ev.clientY + 16) + 'px';
  } else if (edgeG) {
    const e = EDGES.find(x => x.id === edgeG.dataset.id);
    tooltip.innerHTML = `<b>${byId.get(e.from).name} → ${byId.get(e.to).name}</b>${KIND_LABEL[e.kind]} · ${e.label}`;
    tooltip.classList.remove('hidden');
    tooltip.style.left = Math.min(window.innerWidth - 260, ev.clientX + 14) + 'px';
    tooltip.style.top = (ev.clientY + 16) + 'px';
  } else {
    tooltip.classList.add('hidden');
  }
});
svg.addEventListener('mouseleave', () => tooltip.classList.add('hidden'));

// 面板与轨迹条（委托到 document，覆盖动态内容）
document.addEventListener('click', (ev) => {
  const fl = ev.target.closest('[data-follow]');
  if (fl) {
    if (state.pathMode) { state.pathMode = false; state.pathResult = null; document.getElementById('path-btn').classList.remove('on'); }
    follow(fl.dataset.follow, fl.dataset.edge || null);
    return;
  }
  const jp = ev.target.closest('[data-jump],[data-pathjump]');
  if (jp) { follow(jp.dataset.jump || jp.dataset.pathjump, null); return; }
  const vw = ev.target.closest('[data-view]');
  if (vw) {
    const v = vw.dataset.view;
    if (v === 'impact') { state.dir = 'impact'; state.depth = 99; segSync(); }
    if (v === 'deps') { state.dir = 'deps'; state.depth = 99; segSync(); }
    if (v === 'path') { enterPathMode(); }
    if (v === 'exitpath') { exitPathMode(); }
    render(); return;
  }
  const tr = ev.target.closest('[data-trail]');
  if (tr) {
    const i = +tr.dataset.trail;
    state.trail = state.trail.slice(0, i + 1);
    state.visited = new Set(state.trail.map(t => t.node));
    follow(state.trail[i].node, null);
    return;
  }
});

/* ---------- 控件 ---------- */
function segSync() {
  document.querySelectorAll('#dir-seg button').forEach(b => b.classList.toggle('on', b.dataset.dir === state.dir));
  document.querySelectorAll('#depth-seg button').forEach(b => b.classList.toggle('on', +b.dataset.depth === state.depth));
}
document.getElementById('dir-seg').addEventListener('click', (ev) => {
  const b = ev.target.closest('button'); if (!b) return;
  state.dir = b.dataset.dir; segSync(); render(); syncHash();
});
document.getElementById('depth-seg').addEventListener('click', (ev) => {
  const b = ev.target.closest('button'); if (!b) return;
  state.depth = +b.dataset.depth; segSync(); render(); syncHash();
});

function enterPathMode() {
  state.pathMode = true; state.pathSel = { from: null, to: null }; state.pathResult = null;
  document.getElementById('path-btn').classList.add('on');
}
function exitPathMode() {
  state.pathMode = false; state.pathSel = { from: null, to: null }; state.pathResult = null;
  document.getElementById('path-btn').classList.remove('on');
}
document.getElementById('path-btn').addEventListener('click', () => {
  state.pathMode ? exitPathMode() : enterPathMode();
  render();
});
document.getElementById('reset-btn').addEventListener('click', resetAll);

document.addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape') {
    if (state.pathMode) { exitPathMode(); render(); }
    else { state.sel = null; render(); }
  }
});

/* ---------- 检索 ---------- */
const searchInput = document.getElementById('search');
const searchPop = document.getElementById('search-pop');
function searchHits(q) {
  q = q.trim().toLowerCase();
  if (!q) return [];
  return NODES.filter(n =>
    n.name.includes(q) || n.id.toLowerCase().includes(q) ||
    n.domain.includes(q) || n.owner.includes(q) ||
    TYPES[n.type].label.includes(q)
  ).slice(0, 8);
}
function renderPop(list) {
  if (!list.length) { searchPop.classList.add('hidden'); return; }
  searchPop.innerHTML = list.map(n =>
    `<div class="sp-item" data-sp="${n.id}"><i class="${shapeCls(n.type)}"></i>
     <span class="sp-name">${n.name}</span><span class="sp-id">${n.id}</span></div>`).join('');
  searchPop.classList.remove('hidden');
}
searchInput.addEventListener('input', () => renderPop(searchHits(searchInput.value)));
searchInput.addEventListener('focus', () => renderPop(searchHits(searchInput.value)));
searchInput.addEventListener('keydown', (ev) => {
  if (ev.key === 'Enter') {
    const hits = searchHits(searchInput.value);
    if (hits.length) { searchPop.classList.add('hidden'); searchInput.value = ''; searchInput.blur(); follow(hits[0].id, null); }
  }
  if (ev.key === 'Escape') { searchPop.classList.add('hidden'); searchInput.blur(); }
});
searchPop.addEventListener('mousedown', (ev) => {
  const it = ev.target.closest('[data-sp]');
  if (it) { searchPop.classList.add('hidden'); searchInput.value = ''; follow(it.dataset.sp, null); }
});
searchInput.addEventListener('blur', () => setTimeout(() => searchPop.classList.add('hidden'), 150));

/* ---------- 深链（分享当前视角） ---------- */
function syncHash() {
  const p = new URLSearchParams();
  if (state.sel && state.sel.kind === 'node') p.set('sel', state.sel.id); else p.set('sel', 'overview');
  p.set('dir', state.dir); p.set('depth', state.depth);
  history.replaceState(null, '', '#' + p.toString());
}
const INITIAL_SEL = (function parseHash() {
  const p = new URLSearchParams(location.hash.slice(1));
  const sel = p.get('sel');
  if (p.get('dir')) state.dir = p.get('dir');
  if (p.get('depth')) state.depth = +p.get('depth') || 1;
  if (sel && byId.has(sel)) {
    state.sel = { kind: 'node', id: sel };
    state.trail = [{ node: sel, edge: null }];
    state.visited = new Set([sel]);
    return sel;
  }
  return null;
})();

/* ---------- 启动 ---------- */
buildGlobalStats();
segSync();
follow(INITIAL_SEL || 'order-svc', null);   // 首屏即处于跟随态，数据随首屏就绪
document.documentElement.dataset.boot = 'ok';
window.__TRACE_DEBUG = { nodes: NODES.length, edges: EDGES.length, visited: state.visited.size, sel: state.sel.id };

/* ---------- 自检（?selftest=1：在真实浏览器中执行交互链路并输出报告） ---------- */
(function selftest() {
  if (!new URLSearchParams(location.search).has('selftest')) return;
  const out = [];
  const check = (name, cond, detail) => out.push({ name, pass: !!cond, detail: detail === undefined ? '' : String(detail) });
  try {
    check('boot-selected-order-svc', state.sel && state.sel.id === 'order-svc');
    // 跟随链：订单 → 价格 → 营销 → 用户 → 用户库
    ['pricing-svc', 'promo-svc', 'user-svc', 'pg-users'].forEach(id => follow(id, null));
    check('trail-follow-chain', state.trail.length === 5 && state.trail[4].node === 'pg-users',
      state.trail.map(t => t.node).join('>'));
    // 影响闭包焦点
    state.dir = 'impact'; state.depth = 99; segSync();
    const expect = walk('pg-users', 'impact').size;
    const got = computeFocus().fnodes.size;
    check('impact-closure-focus', got === expect, got + '/' + expect);
    // 路径分析 A：依赖路径 web-app ⇢ pg-users（BFS 最短依赖链）
    resetAll(); enterPathMode(); follow('web-app', null); follow('pg-users', null);
    check('path-dep-exists', !!(state.pathResult && state.pathResult.dep && state.pathResult.dep.nodes.length >= 4),
      state.pathResult && state.pathResult.dep ? state.pathResult.dep.nodes.join('>') : 'null');
    // 路径分析 B：影响路径 t-order ⇢ web-app（事件流波及链）
    resetAll(); enterPathMode(); follow('t-order', null); follow('web-app', null);
    check('path-impact-mirror', !!(state.pathResult && state.pathResult.impact && state.pathResult.impact.nodes.length >= 4),
      state.pathResult && state.pathResult.impact ? state.pathResult.impact.nodes.join('>') : 'null');
    // 关系选择（关系即内容）
    exitPathMode();
    selectEdge(EDGES.find(e => e.from === 'order-svc' && e.to === 'pg-orders').id);
    check('edge-select-renders', state.sel.kind === 'edge' &&
      document.getElementById('panel').textContent.includes('关系详情'));
    // 复位到总览
    resetAll();
    check('reset-overview', state.sel === null && state.trail.length === 0);
    // 还原首屏跟随态
    follow('order-svc', null);
  } catch (err) {
    out.push({ name: 'exception', pass: false, detail: err.message });
  }
  const report = { pass: out.every(o => o.pass), steps: out };
  let div = document.getElementById('selftest-report');
  if (!div) {
    div = document.createElement('div');
    div.id = 'selftest-report';
    div.style.cssText = 'position:fixed;left:8px;top:8px;z-index:9999;background:#0e1218;color:#e8edf5;border:1px solid #3987e5;padding:10px 14px;font:11px/1.7 Consolas,monospace;max-width:560px;white-space:pre-wrap';
    document.body.appendChild(div);
  }
  div.textContent = 'SELFTEST ' + (report.pass ? 'PASS' : 'FAIL') + '\n' +
    out.map(o => (o.pass ? '✓ ' : '✗ ') + o.name + (o.detail ? ' · ' + o.detail : '')).join('\n');
  window.__SELFTEST = report;
})();

window.addEventListener('error', (ev) => {
  document.documentElement.dataset.boot = 'error';
  const bar = document.createElement('div');
  bar.style.cssText = 'position:fixed;inset:auto 0 0 0;background:#d03b3b;color:#fff;padding:8px 14px;font-size:12px;z-index:999';
  bar.textContent = '启动错误：' + ev.message;
  document.body.appendChild(bar);
});
