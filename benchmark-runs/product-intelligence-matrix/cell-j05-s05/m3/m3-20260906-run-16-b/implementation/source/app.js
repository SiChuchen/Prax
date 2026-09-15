/* DepAtlas · 服务依赖图谱 —— understand × relational-web
 * 核心纪律：跟随依赖与影响不丢失全局上下文（dim-to-focus，从不移除节点/边）。 */
(function () {
  "use strict";

  /* ---------- 数据校验（error 态防御） ---------- */
  function validateData(d) {
    if (!d || !Array.isArray(d.nodes) || !Array.isArray(d.edges) || d.nodes.length === 0) {
      throw new Error("内联数据缺失或为空：nodes/edges 必须非空数组。");
    }
    const ids = new Set(d.nodes.map(function (n) { return n.id; }));
    for (const e of d.edges) {
      if (!ids.has(e.from) || !ids.has(e.to)) {
        throw new Error("依赖关系 " + (e.id || "?") + " 引用了不存在的服务节点。");
      }
    }
  }

  let DATA;
  try {
    DATA = window.DEPATLAS_DATA;
    validateData(DATA);
  } catch (err) {
    document.body.className = "state-error";
    const app = document.getElementById("app");
    if (app) app.hidden = true;
    const panel = document.getElementById("error-panel");
    document.getElementById("error-message").textContent = String(err.message || err);
    panel.hidden = false;
    return;
  }

  /* ---------- 索引 ---------- */
  const nodeById = new Map(DATA.nodes.map(function (n) { return Object.assign(n, { el: null }); })
    .map(function (n) { return [n.id, n]; }));
  const edgeById = new Map(DATA.edges.map(function (e) { return Object.assign(e, { el: null }); })
    .map(function (e) { return [e.id, e]; }));
  const outEdges = new Map(), inEdges = new Map(); // nodeId -> edges[]
  DATA.nodes.forEach(function (n) { outEdges.set(n.id, []); inEdges.set(n.id, []); });
  DATA.edges.forEach(function (e) { outEdges.get(e.from).push(e); inEdges.get(e.to).push(e); });
  const teamOf = function (n) { return DATA.teams[n.team]; };
  const tierOf = function (n) { return DATA.tiers[n.tier - 1]; };

  /* 传递闭包：dir='dep' 传递依赖（可达的下游），dir='impact' 影响面（可达的上游依赖方） */
  const closureCache = new Map();
  function closure(id, dir) {
    dir = dir === "impact" ? "impact" : "dep"; // 归一化：'deps' 视作 'dep'
    const key = dir + ":" + id;
    if (closureCache.has(key)) return closureCache.get(key);
    const seen = new Set();
    const queue = [id];
    while (queue.length) {
      const cur = queue.shift();
      const list = dir === "dep" ? outEdges.get(cur) : inEdges.get(cur);
      list.forEach(function (e) {
        const nxt = dir === "dep" ? e.to : e.from;
        if (!seen.has(nxt)) { seen.add(nxt); queue.push(nxt); }
      });
    }
    closureCache.set(key, seen);
    return seen;
  }

  /* ---------- 布局：确定性分层布局（左→右依赖流），锚点永不移动 ---------- */
  const COL_X = [46, 386, 726, 1076], NW = 196, NH = 40;
  const TIER_Y0 = { 1: 170, 2: 260, 3: 56, 4: 84 }, TIER_DY = { 1: 230, 2: 220, 3: 62, 4: 108 };
  const pos = new Map();
  DATA.tiers.forEach(function (t) {
    const col = DATA.nodes.filter(function (n) { return n.tier === t.n; });
    col.forEach(function (n, i) {
      pos.set(n.id, { x: COL_X[t.n - 1], y: TIER_Y0[t.n] + i * TIER_DY[t.n] });
    });
  });

  function edgePath(e) {
    const a = pos.get(e.from), b = pos.get(e.to);
    if (a.x === b.x) { // 同层依赖：向右外侧绕行
      const cx = a.x + NW + 46;
      return "M " + (a.x + NW) + " " + (a.y + NH / 2) +
        " C " + cx + " " + (a.y + NH / 2) + ", " + cx + " " + (b.y + NH / 2) + ", " + (b.x + NW) + " " + (b.y + NH / 2);
    }
    const x1 = a.x + NW, y1 = a.y + NH / 2, x2 = b.x, y2 = b.y + NH / 2;
    const dx = Math.max(40, (x2 - x1) * 0.5);
    return "M " + x1 + " " + y1 + " C " + (x1 + dx) + " " + y1 + ", " + (x2 - dx) + " " + y2 + ", " + x2 + " " + y2;
  }

  /* ---------- 状态 ---------- */
  const state = {
    sel: null,        // {kind:'node'|'edge', id}
    trail: [],        // [{nodeId, viaEdgeId|null, dir:null|'dep'|'usedby'}] — 有序跟随步
    focus: null,      // {kind:'impact'|'deps', rootId, set:Set}
    showData: true
  };

  /* ---------- 渲染：地图只建一次，之后仅切换类名 ---------- */
  const svg = document.getElementById("map");
  const NS = "http://www.w3.org/2000/svg";
  function el(name, attrs, parent) {
    const node = document.createElementNS(NS, name);
    for (const k in attrs) node.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(node);
    return node;
  }

  function renderMap() {
    const gBands = document.getElementById("layer-bands");
    const gEdges = document.getElementById("layer-edges");
    const gNodes = document.getElementById("layer-nodes");

    DATA.tiers.forEach(function (t) {
      el("rect", { x: COL_X[t.n - 1] - 14, y: 34, width: NW + 28, height: 756, rx: 10,
        class: "band", "data-tier": t.n }, gBands);
      const label = el("text", { x: COL_X[t.n - 1], y: 22, class: "tier-label" }, gBands);
      label.textContent = "T" + t.n + " · " + t.name;
    });

    DATA.edges.forEach(function (e) {
      const d = edgePath(e);
      const hit = el("path", { d: d, class: "edge-hit" + (e.type === "data" ? " data" : ""),
        "data-edge": e.id, tabindex: 0, role: "button",
        "aria-label": "依赖关系：" + e.from + " 依赖 " + e.to + (e.critical ? "，关键链路" : "") }, gEdges);
      e.el = hit;
      const vis = el("path", { d: d, class: "edge " + e.type + (e.critical ? " crit" : ""), "data-edge": e.id }, gEdges);
      e.visEl = vis;
      e.baseMarker = e.critical ? "url(#arr-crit)" : "url(#arr)";
      vis.setAttribute("marker-end", e.baseMarker);
    });

    DATA.nodes.forEach(function (n) {
      const p = pos.get(n.id), tm = teamOf(n);
      const g = el("g", { class: "node", transform: "translate(" + p.x + "," + p.y + ")",
        tabindex: 0, role: "button", "data-node": n.id,
        "aria-label": n.id + " " + n.zh + "，" + tm.name + "，直接依赖 " + outEdges.get(n.id).length +
          " 项，被依赖 " + inEdges.get(n.id).length + " 项" }, gNodes);
      el("rect", { x: 0, y: 0, width: NW, height: NH, rx: 8, class: "node-box" }, g);
      el("rect", { x: 0, y: 4, width: 3.5, height: NH - 8, rx: 1.75, fill: tm.color, class: "team-stripe" }, g);
      const t1 = el("text", { x: 14, y: 17, class: "node-id" }, g); t1.textContent = n.id;
      const t2 = el("text", { x: 14, y: 32, class: "node-zh" }, g); t2.textContent = n.zh;
      n.el = g;
    });
  }

  /* ---------- 视图更新（dim-to-focus：只置灰，从不移除） ---------- */
  function focusSets() {
    const nodes = new Set(), edges = new Set();
    state.trail.forEach(function (s) {
      nodes.add(s.nodeId);
      if (s.viaEdgeId) edges.add(s.viaEdgeId);
    });
    if (state.focus) state.focus.set.forEach(function (id) { nodes.add(id); });
    if (state.focus) { // 闭包高亮时，根到闭包的边也保持清晰
      const root = state.focus.rootId;
      DATA.edges.forEach(function (e) {
        if ((e.from === root && state.focus.set.has(e.to)) ||
            (e.to === root && state.focus.set.has(e.from))) edges.add(e.id);
      });
    }
    return { nodes: nodes, edges: edges };
  }

  function updateView() {
    const active = state.trail.length > 0 || !!state.focus;
    const fs = focusSets();

    DATA.nodes.forEach(function (n) {
      const c = n.el.classList;
      c.toggle("dim", active && !fs.nodes.has(n.id));
      c.toggle("trail", state.trail.some(function (s) { return s.nodeId === n.id; }));
      c.toggle("sel", !!(state.sel && state.sel.kind === "node" && state.sel.id === n.id));
      c.toggle("closure", !!(state.focus && state.focus.set.has(n.id) &&
        !(state.sel && state.sel.kind === "node" && state.sel.id === n.id)));
    });
    DATA.edges.forEach(function (e) {
      const onTrail = fs.edges.has(e.id);
      const c = e.visEl.classList, ch = e.el.classList;
      c.toggle("dim", active && !onTrail);
      c.toggle("trail", onTrail);
      ch.toggle("dim", active && !onTrail);
      e.visEl.setAttribute("marker-end", onTrail ? "url(#arr-trail)" : e.baseMarker);
    });

    svg.classList.toggle("no-data", !state.showData);
    renderGlobalContext(fs);
    renderTrail();
    renderInspector();
    syncHash();
  }

  function renderGlobalContext(fs) {
    const box = document.getElementById("global-context");
    const total = DATA.nodes.length, eTotal = DATA.edges.length;
    if (state.focus) {
      box.innerHTML = (state.focus.kind === "deps" ? "依赖闭包高亮 · <b>" : "影响面高亮 · <b>") +
        fs.nodes.size + "</b> / " + total + " 服务清晰 · 其余置灰仍在原位";
    } else if (state.trail.length) {
      box.innerHTML = "跟随中 · 路径 <b>" + state.trail.length + "</b> 节点清晰 / 全图 " + total +
        " 服务 " + eTotal + " 依赖关系 · 保持原位可见";
    } else {
      box.innerHTML = "全局视图 · " + total + " 服务 · " + eTotal + " 依赖关系 · 全部可见";
    }
  }

  /* ---------- 跟随路径条 ---------- */
  function renderTrail() {
    const ol = document.getElementById("trail");
    const btn = document.getElementById("clear-trail");
    ol.innerHTML = "";
    btn.hidden = state.trail.length === 0;
    state.trail.forEach(function (s, i) {
      const n = nodeById.get(s.nodeId);
      const li = document.createElement("li");
      li.className = "tstep";
      const b = document.createElement("button");
      b.className = "chip" + (i === state.trail.length - 1 ? " current" : "");
      b.dataset.idx = i;
      b.title = "回到 " + n.id;
      b.innerHTML = '<i class="dot" style="background:' + teamOf(n).color + '"></i>' + n.id;
      b.setAttribute("aria-label", "跟随路径第 " + (i + 1) + " 步：" + n.id);
      li.appendChild(b);
      ol.appendChild(li);
      if (i < state.trail.length - 1) {
        const sep = document.createElement("li");
        sep.className = "tsep";
        sep.innerHTML = s.dir === "usedby" ? "←<em>被依赖</em>" : "→<em>依赖</em>";
        ol.appendChild(sep);
      }
    });
  }

  /* ---------- 详情面板 ---------- */
  function renderInspector() {
    const emptyBox = document.getElementById("inspector-empty");
    const nodeBox = document.getElementById("inspector-node");
    const edgeBox = document.getElementById("inspector-edge");
    nodeBox.hidden = true; edgeBox.hidden = true; emptyBox.hidden = true;

    if (!state.sel) { emptyBox.hidden = false; return; }

    if (state.sel.kind === "node") {
      const n = nodeById.get(state.sel.id);
      const tm = teamOf(n), deps = outEdges.get(n.id), used = inEdges.get(n.id);
      nodeBox.innerHTML =
        "<h3 class='insp-title'><i class='dot' style='background:" + tm.color + "'></i>" + n.id +
        " <small>" + n.zh + "</small></h3>" +
        "<p class='insp-desc'>" + n.desc + "</p>" +
        "<p class='insp-meta'>" + tm.name + " · " + tierOf(n).name + "</p>" +
        "<div class='stats'>" +
        cell(deps.length, "直接依赖") + cell(closure(n.id, "dep").size, "传递依赖") +
        cell(used.length, "直接被依赖") + cell(closure(n.id, "impact").size, "影响面") +
        "</div>" +
        relSection("依赖（上游）", deps, "dep", n.id) +
        relSection("被依赖（下游）", used, "usedby", n.id) +
        "<div class='closure-actions'>" +
        "<button class='btn small" + (state.focus && state.focus.kind === "impact" ? " on" : "") +
        "' data-act='impact'>高亮影响面</button>" +
        "<button class='btn small" + (state.focus && state.focus.kind === "deps" ? " on" : "") +
        "' data-act='deps'>高亮依赖闭包</button></div>" +
        "<p class='panel-hint'>点击关系项即沿该跳跟随；影响面 = 改动本服务可能波及的服务。</p>";
      nodeBox.hidden = false;
    } else {
      const e = edgeById.get(state.sel.id);
      const a = nodeById.get(e.from), b = nodeById.get(e.to);
      edgeBox.innerHTML =
        "<h3 class='insp-title'>依赖关系 <small>" + e.id + "</small></h3>" +
        "<div class='edge-line'><span>" + a.id + "</span><i class='arr'>→</i><b>" + b.id + "</b></div>" +
        "<dl class='edge-meta'>" +
        "<dt>类型</dt><dd>" + (e.type === "call" ? "调用依赖（同步）" : "数据依赖（存储 / 消息）") + "</dd>" +
        "<dt>关键度</dt><dd>" + (e.critical ? "关键链路" : "一般") + "</dd>" +
        "<dt>端点</dt><dd>" + teamOf(a).name + " / " + teamOf(b).name + "</dd></dl>" +
        "<p class='panel-hint'>" + b.zh + "（" + b.id + "）变更将波及 " + a.zh + " 及其全部上游依赖方（" +
        closure(a.id, "impact").size + " 项）。</p>" +
        "<div class='closure-actions'>" +
        "<button class='btn small' data-goto='" + a.id + "'>查看 " + a.id + "</button>" +
        "<button class='btn small' data-goto='" + b.id + "'>查看 " + b.id + "</button></div>";
      edgeBox.hidden = false;
    }
  }
  function cell(num, label) { return "<div class='stat'><b>" + num + "</b><span>" + label + "</span></div>"; }
  function relSection(title, list, dir, fromId) {
    let html = "<section class='rel-group'><h4>" + title + " <i>" + list.length + "</i></h4>";
    if (!list.length) { html += "<p class='rel-none'>无</p>"; }
    html += "<ul class='rel-list'>";
    list.forEach(function (e) {
      const otherId = dir === "dep" ? e.to : e.from;
      const other = nodeById.get(otherId);
      html += "<li><button class='rel' data-edge='" + e.id + "' data-to='" + otherId + "' data-dir='" + dir + "'>" +
        "<span class='dir'>" + (dir === "dep" ? "→" : "←") + "</span> " + otherId +
        " <em>" + other.zh + "</em>" +
        (e.critical ? "<i class='flag'>关键</i>" : "") + "</button></li>";
    });
    html += "</ul></section>";
    return html;
  }

  /* ---------- 交互 ---------- */
  function selectNode(id, opts) {
    opts = opts || {};
    if (opts.fresh !== false) state.trail = [{ nodeId: id, viaEdgeId: null, dir: null }];
    state.sel = { kind: "node", id: id };
    updateView();
  }
  function followTo(edgeId, toId, dir) {
    if (!state.trail.length) state.trail.push({ nodeId: edgeById.get(edgeId).from, viaEdgeId: null, dir: null });
    state.trail.push({ nodeId: toId, viaEdgeId: edgeId, dir: dir });
    state.sel = { kind: "node", id: toId };
    updateView();
  }
  function selectEdge(id) {
    state.sel = { kind: "edge", id: id };
    updateView();
  }
  function truncateTrail(idx) {
    state.trail = state.trail.slice(0, idx + 1);
    state.sel = { kind: "node", id: state.trail[idx].nodeId };
    if (!state.trail[idx].viaEdgeId && state.trail.length === 1) { /* 起点步保留 */ }
    updateView();
  }
  function clearAll() {
    state.sel = null; state.trail = []; state.focus = null;
    updateView();
  }

  function bindEvents() {
    svg.addEventListener("click", function (ev) {
      const nodeG = ev.target.closest("g.node");
      if (nodeG) { selectNode(nodeG.dataset.node); return; }
      const hit = ev.target.closest(".edge-hit");
      if (hit) { selectEdge(hit.dataset.edge); return; }
      if (ev.target === svg || ev.target.closest(".band")) clearAll();
    });
    svg.addEventListener("keydown", function (ev) {
      if (ev.key !== "Enter" && ev.key !== " ") return;
      const t = ev.target;
      if (t.classList && t.classList.contains("node")) { ev.preventDefault(); selectNode(t.dataset.node); }
      else if (t.classList && t.classList.contains("edge-hit")) { ev.preventDefault(); selectEdge(t.dataset.edge); }
    });

    document.getElementById("inspector").addEventListener("click", function (ev) {
      const rel = ev.target.closest("button.rel");
      if (rel) { followTo(rel.dataset.edge, rel.dataset.to, rel.dataset.dir); return; }
      const act = ev.target.closest("button[data-act]");
      if (act) {
        const kind = act.dataset.act === "impact" ? "impact" : "deps";
        if (state.focus && state.focus.kind === kind) state.focus = null;
        else if (state.sel && state.sel.kind === "node") {
          state.focus = { kind: kind, rootId: state.sel.id, set: closure(state.sel.id, kind) };
        }
        updateView(); return;
      }
      const go = ev.target.closest("button[data-goto]");
      if (go) { selectNode(go.dataset.goto); }
    });

    document.getElementById("trail").addEventListener("click", function (ev) {
      const chip = ev.target.closest("button.chip");
      if (chip) truncateTrail(Number(chip.dataset.idx));
    });
    document.getElementById("clear-trail").addEventListener("click", clearAll);
    document.getElementById("reset").addEventListener("click", clearAll);
    document.getElementById("edge-filter").addEventListener("change", function (ev) {
      state.showData = ev.target.checked; updateView();
    });

    /* 键盘：Esc 全局返回全局视图；/ 聚焦搜索 */
    document.addEventListener("keydown", function (ev) {
      if (ev.key === "Escape") {
        if (!searchResults.hidden) { closeSearch(); return; }
        clearAll();
      } else if (ev.key === "/" && !/^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName)) {
        ev.preventDefault(); searchInput.focus();
      }
    });

    bindSearch();
    bindTooltip();
    bindHash();
  }

  /* ---------- 搜索（locate：不离开地图） ---------- */
  const searchInput = document.getElementById("search");
  const searchResults = document.getElementById("search-results");
  let searchIdx = -1;
  function closeSearch() {
    searchResults.hidden = true;
    searchInput.setAttribute("aria-expanded", "false");
    searchIdx = -1;
  }
  function bindSearch() {
    searchInput.addEventListener("input", function () {
      const q = searchInput.value.trim().toLowerCase();
      searchIdx = -1;
      if (!q) { closeSearch(); return; }
      const hits = DATA.nodes.filter(function (n) {
        return n.id.toLowerCase().indexOf(q) >= 0 || n.zh.indexOf(searchInput.value.trim()) >= 0;
      }).slice(0, 8);
      searchResults.innerHTML = "";
      if (!hits.length) {
        const li = document.createElement("li");
        li.className = "none"; li.textContent = "无匹配服务";
        searchResults.appendChild(li);
      } else {
        hits.forEach(function (n, i) {
          const li = document.createElement("li");
          const b = document.createElement("button");
          b.type = "button"; b.dataset.id = n.id; b.setAttribute("role", "option");
          b.innerHTML = "<i class='dot' style='background:" + teamOf(n).color + "'></i>" + n.id +
            " <em>" + n.zh + "</em><span>" + teamOf(n).name + "</span>";
          b.addEventListener("mousedown", function (ev) { ev.preventDefault(); pick(n.id); });
          li.appendChild(b);
          searchResults.appendChild(li);
          if (i === 0) b.dataset.first = "1";
        });
      }
      searchResults.hidden = false;
      searchInput.setAttribute("aria-expanded", "true");
    });
    searchInput.addEventListener("keydown", function (ev) {
      const items = searchResults.querySelectorAll("button[data-id]");
      if (ev.key === "ArrowDown" || ev.key === "ArrowUp") {
        if (!items.length) return;
        ev.preventDefault();
        searchIdx = ev.key === "ArrowDown"
          ? (searchIdx + 1) % items.length
          : (searchIdx - 1 + items.length) % items.length;
        items.forEach(function (b, i) { b.classList.toggle("hover", i === searchIdx); });
      } else if (ev.key === "Enter") {
        const target = searchIdx >= 0 ? items[searchIdx] : searchResults.querySelector("button[data-first]");
        if (target) { ev.preventDefault(); pick(target.dataset.id); }
      }
    });
    searchInput.addEventListener("blur", function () { setTimeout(closeSearch, 120); });
  }
  function pick(id) {
    selectNode(id);
    closeSearch();
    searchInput.blur();
  }

  /* ---------- 悬停提示（preview） ---------- */
  function bindTooltip() {
    const tip = document.getElementById("tooltip");
    svg.addEventListener("mousemove", function (ev) {
      const g = ev.target.closest("g.node");
      if (!g) { tip.hidden = true; return; }
      const n = nodeById.get(g.dataset.node);
      tip.innerHTML = "<b>" + n.id + "</b> " + n.zh + "<br>" + teamOf(n).name + " · " +
        "依赖 " + outEdges.get(n.id).length + " · 被依赖 " + inEdges.get(n.id).length;
      tip.hidden = false;
      const x = Math.min(ev.clientX + 14, window.innerWidth - 190);
      const y = Math.min(ev.clientY + 14, window.innerHeight - 70);
      tip.style.left = x + "px"; tip.style.top = y + "px";
    });
    svg.addEventListener("mouseleave", function () { tip.hidden = true; });
  }

  /* ---------- 深链（状态可分享，亦是证据钩子） ---------- */
  function bindHash() {
    window.addEventListener("hashchange", applyHash);
  }
  function applyHash() {
    const h = location.hash.replace(/^#/, "");
    if (!h) return;
    const params = new URLSearchParams(h);
    const follow = params.get("follow");
    if (follow) {
      const ids = follow.split(">").filter(Boolean);
      state.trail = []; state.focus = null;
      ids.forEach(function (id, i) {
        if (!nodeById.has(id)) return;
        if (i === 0) { state.trail.push({ nodeId: id, viaEdgeId: null, dir: null }); return; }
        const prev = state.trail[state.trail.length - 1].nodeId;
        const e = DATA.edges.find(function (x) {
          return (x.from === prev && x.to === id) || (x.to === prev && x.from === id);
        });
        if (e) {
          state.trail.push({ nodeId: id, viaEdgeId: e.id, dir: e.from === prev ? "dep" : "usedby" });
        }
      });
      if (state.trail.length) state.sel = { kind: "node", id: state.trail[state.trail.length - 1].nodeId };
    }
    const sel = params.get("select");
    if (sel && nodeById.has(sel)) {
      if (!state.trail.length) selectNode(sel, { fresh: false });
      state.sel = { kind: "node", id: sel };
      if (!state.trail.some(function (s) { return s.nodeId === sel; })) {
        state.trail.push({ nodeId: sel, viaEdgeId: null, dir: null });
      }
    }
    const impact = params.get("impact");
    if (impact && state.sel && state.sel.kind === "node") {
      const kind = impact === "deps" ? "deps" : "impact";
      state.focus = { kind: kind, rootId: state.sel.id, set: closure(state.sel.id, kind) };
    }
    updateView();
  }
  let hashSync = false;
  function syncHash() {
    if (hashSync) return;
    hashSync = true;
    try {
      const p = new URLSearchParams();
      if (state.trail.length > 1) p.set("follow", state.trail.map(function (s) { return s.nodeId; }).join(">"));
      else if (state.sel && state.sel.kind === "node") p.set("select", state.sel.id);
      if (state.focus) p.set("impact", state.focus.kind === "deps" ? "deps" : "1");
      const next = p.toString() ? "#" + p.toString() : "#";
      if (location.hash !== next) history.replaceState(null, "", next);
    } catch (e) { /* file:// 下 history 可能受限，忽略 */ }
    hashSync = false;
  }

  /* ---------- 启动：同步渲染，无加载态 ---------- */
  renderMap();
  bindEvents();
  applyHash();
  updateView();
})();
