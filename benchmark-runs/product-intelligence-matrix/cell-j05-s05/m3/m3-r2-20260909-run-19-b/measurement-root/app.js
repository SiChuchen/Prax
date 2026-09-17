/* 星链 · 依赖全景
 * understand × relational-web：聚焦任一对象，跟随上游依赖 / 下游影响；
 * 全图常驻——非相关内容仅弱化、不移除，节点位置不随跟随变化（orientation invariants）。
 * 同步初始化：数据来自 data.js 内联脚本，本文件末尾立即渲染，页面加载完成即可交互（无 loading 态）。 */
(function () {
  "use strict";

  var DATA = window.RW_DATA;
  var NODES = DATA.nodes;
  var EDGES = DATA.edges.map(function (e, i) { e.id = "e" + i; return e; });

  var TYPE_META = {
    source:  { name: "数据源",   color: "#68e0a2" },
    store:   { name: "数据表",   color: "#61a5ff" },
    job:     { name: "管道作业", color: "#c58bff" },
    service: { name: "在线服务", color: "#ff9d66" },
    metric:  { name: "指标",     color: "#ffd166" },
    app:     { name: "应用消费", color: "#4dd8e6" }
  };
  var EDGE_META = {
    data:   { name: "数据依赖" },
    write:  { name: "产出写入" },
    call:   { name: "调用依赖" },
    derive: { name: "derive 派生计算" }
  };
  EDGE_META.derive.name = "派生计算";
  var COL = { base: "#3c466b", crit: "#5d6b9e", dim: "#20283f", up: "#3fd2ff", down: "#ffb054", sel: "#ffd166" };

  var byId = {};
  NODES.forEach(function (n) { byId[n.id] = n; n.deg = 0; });
  var out = {}, inn = {};
  NODES.forEach(function (n) { out[n.id] = []; inn[n.id] = []; });
  EDGES.forEach(function (e) {
    if (!byId[e.from] || !byId[e.to]) return;
    out[e.from].push({ node: e.to, edge: e });
    inn[e.to].push({ node: e.from, edge: e });
    byId[e.from].deg++; byId[e.to].deg++;
  });
  function edgeOn(e) { return !state.off.has(e.type); }

  /* ---------- 确定性布局（种子随机力导向 + 层级 y 引导） ---------- */
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function layout() {
    var W = 1200, H = 840, rnd = mulberry32(20260917);
    NODES.forEach(function (n) {
      n.r = 11 + Math.min(n.deg, 9) * 1.35;
      var yBase = H * (0.10 + 0.78 * n.layer / 5);
      n.x = W * 0.5 + (rnd() - 0.5) * W * 0.86;
      n.y = yBase + (rnd() - 0.5) * 70;
    });
    for (var it = 0; it < 380; it++) {
      var i, j;
      for (i = 0; i < NODES.length; i++) {
        for (j = i + 1; j < NODES.length; j++) {
          var a = NODES[i], b = NODES[j];
          var dx = a.x - b.x, dy = a.y - b.y;
          var d2 = Math.max(dx * dx + dy * dy, 500);
          var f = 30000 / d2;
          var d = Math.sqrt(d2);
          a.x += dx / d * f; a.y += dy / d * f;
          b.x -= dx / d * f; b.y -= dy / d * f;
        }
      }
      EDGES.forEach(function (e) {
        var p = byId[e.from], q = byId[e.to];
        var dx = q.x - p.x, dy = q.y - p.y;
        var d = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
        var f = (d - 132) * 0.02;
        p.x += dx / d * f; p.y += dy / d * f;
        q.x -= dx / d * f; q.y -= dy / d * f;
      });
      NODES.forEach(function (n) {
        var yTarget = H * (0.10 + 0.78 * n.layer / 5);
        n.y += (yTarget - n.y) * 0.05;
        n.x += (W / 2 - n.x) * 0.012;
      });
    }
    var minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
    NODES.forEach(function (n) {
      minX = Math.min(minX, n.x); maxX = Math.max(maxX, n.x);
      minY = Math.min(minY, n.y); maxY = Math.max(maxY, n.y);
    });
    var pad = 105, bw = maxX - minX || 1, bh = maxY - minY || 1;
    var s = Math.min((W - pad * 2) / bw, (H - pad * 2) / bh, 1.12);
    var ox = (W - bw * s) / 2 - minX * s, oy = (H - bh * s) / 2 - minY * s;
    NODES.forEach(function (n) { n.x = n.x * s + ox; n.y = n.y * s + oy; });
  }

  /* ---------- 状态 ---------- */
  var CORE = "dws_trade"; /* 默认聚焦：影响面最大的枢纽（task-first entry） */
  var state = {
    home: false,        /* 空态：未聚焦引导 */
    trail: [],          /* 跟随路径；末位 = 当前聚焦 */
    depth: "2",         /* 1 | 2 | a */
    selEdge: null,      /* 选中的关系（边）id */
    off: new Set(),     /* 关闭的关系类型 */
    error: null,        /* hash 指向不存在对象 */
    kb: false           /* kb=1：加载后聚焦搜索框（演示键盘可达） */
  };
  function focusId() { return state.trail.length ? state.trail[state.trail.length - 1] : null; }

  function parseHash() {
    var h = location.hash.replace(/^#/, "");
    var p = new URLSearchParams(h);
    var s = { home: false, trail: [], depth: "2", selEdge: null, off: [], error: null, kb: p.get("kb") === "1" };
    if (p.get("h") === "1") { s.home = true; }
    var raw = p.get("p");
    if (raw) {
      s.trail = raw.split(".").filter(Boolean);
      s.trail.forEach(function (id) { if (!byId[id]) s.error = id; });
      s.trail = s.trail.filter(function (id) { return byId[id]; });
    }
    if (p.get("d") === "1" || p.get("d") === "2" || p.get("d") === "a") s.depth = p.get("d");
    if (p.get("e") && EDGES.some(function (e) { return e.id === p.get("e"); })) s.selEdge = p.get("e");
    if (p.get("off")) s.off = p.get("off").split(",").filter(function (t) { return EDGE_META[t]; });
    return s;
  }
  function writeHash() {
    var p = new URLSearchParams();
    if (state.home) p.set("h", "1");
    if (state.trail.length) p.set("p", state.trail.join("."));
    p.set("d", state.depth);
    if (state.selEdge) p.set("e", state.selEdge);
    if (state.off.size) p.set("off", Array.from(state.off).join(","));
    var s = "#" + p.toString();
    if (location.hash !== s) { suppress = true; location.hash = s; }
  }
  var suppress = false;
  window.addEventListener("hashchange", function () {
    if (suppress) { suppress = false; return; }
    apply(parseHash());
  });

  function apply(s) {
    state.home = s.home; state.trail = s.trail; state.depth = s.depth;
    state.selEdge = s.selEdge; state.error = s.error; state.kb = !!s.kb;
    state.off = new Set(s.off);
    render();
  }
  function render2() { /* 渲染并写回 hash（用户动作入口） */
    render();
    writeHash();
  }

  /* 用户动作 */
  function follow(id) {
    if (!byId[id]) return;
    if (focusId() === id && !state.home) { state.home = false; render2(); return; }
    if (state.home || focusId() !== id) state.trail.push(id);
    state.home = false; state.selEdge = null; state.error = null;
    render2();
  }
  function goBack() {
    if (state.selEdge) { state.selEdge = null; }
    else if (state.trail.length > 1) state.trail.pop();
    else { state.home = true; state.trail = []; }
    render2();
  }
  function goHome() { state.home = true; state.trail = []; state.selEdge = null; render2(); }
  function selectEdge(id) { state.selEdge = (state.selEdge === id) ? null : id; render2(); }
  function setDepth(d) { state.depth = d; render2(); }
  function toggleType(t) {
    if (state.off.has(t)) state.off.delete(t); else state.off.add(t);
    render2();
  }

  /* ---------- 可达性（跟随遍历，尊重类型过滤） ---------- */
  function bfs(startId, dir, maxD) {
    var dist = new Map([[startId, 0]]);
    var frontier = [startId], d = 0;
    while (frontier.length && d < maxD) {
      d++;
      var next = [];
      frontier.forEach(function (id) {
        (dir === "up" ? out[id] : inn[id]).forEach(function (step) {
          if (!edgeOn(step.edge)) return;
          if (!dist.has(step.node)) { dist.set(step.node, d); next.push(step.node); }
        });
      });
      frontier = next;
    }
    return dist;
  }
  function maxDepthNum() { return state.depth === "a" ? Infinity : parseInt(state.depth, 10); }

  /* ---------- SVG 构建（一次） ---------- */
  var svg = document.getElementById("graph");
  var gEdges = document.getElementById("edges");
  var gNodes = document.getElementById("nodes");
  var gLabels = document.getElementById("elabels");
  var edgeEls = {}, nodeEls = {};

  function buildGraph() {
    var hasReverse = {};
    EDGES.forEach(function (e) {
      var key = e.from + ">" + e.to;
      hasReverse[key] = (hasReverse[key] || 0) + 1;
    });
    EDGES.forEach(function (e) {
      var A = byId[e.from], B = byId[e.to];
      var dx = B.x - A.x, dy = B.y - A.y, d = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
      var ux = dx / d, uy = dy / d;
      var ax = A.x + ux * (A.r + 4), ay = A.y + uy * (A.r + 4);
      var bx = B.x - ux * (B.r + 8), by = B.y - uy * (B.r + 8);
      var curve = hasReverse[e.to + ">" + e.from] ? 34 : 15;
      var mx = (ax + bx) / 2 - uy * curve, my = (ay + by) / 2 + ux * curve;
      e.mid = { x: (ax + 2 * mx + bx) / 4, y: (ay + 2 * my + by) / 4 };
      var g = document.createElementNS("http://www.w3.org/2000/svg", "g");
      g.setAttribute("class", "edge");
      var vis = document.createElementNS("http://www.w3.org/2000/svg", "path");
      vis.setAttribute("class", "vis");
      vis.setAttribute("d", "M" + ax + "," + ay + " Q" + mx + "," + my + " " + bx + "," + by);
      var hit = document.createElementNS("http://www.w3.org/2000/svg", "path");
      hit.setAttribute("class", "hit");
      hit.setAttribute("d", vis.getAttribute("d"));
      hit.addEventListener("click", function (ev) { ev.stopPropagation(); selectEdge(e.id); });
      g.appendChild(vis); g.appendChild(hit);
      gEdges.appendChild(g);
      var lbl = document.createElementNS("http://www.w3.org/2000/svg", "text");
      lbl.setAttribute("class", "elabel");
      lbl.setAttribute("x", e.mid.x); lbl.setAttribute("y", e.mid.y - 4);
      lbl.style.display = "none";
      gLabels.appendChild(lbl);
      edgeEls[e.id] = { g: g, vis: vis, lbl: lbl };
    });
    NODES.forEach(function (n) {
      var g = document.createElementNS("http://www.w3.org/2000/svg", "g");
      g.setAttribute("class", "node");
      var halo = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      halo.setAttribute("r", n.r + 6);
      halo.setAttribute("cx", n.x); halo.setAttribute("cy", n.y);
      halo.setAttribute("fill", "none"); halo.style.display = "none";
      var body = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      body.setAttribute("class", "body");
      body.setAttribute("r", n.r);
      body.setAttribute("cx", n.x); body.setAttribute("cy", n.y);
      body.setAttribute("fill", TYPE_META[n.type].color);
      body.setAttribute("fill-opacity", "0.16");
      body.setAttribute("stroke", TYPE_META[n.type].color);
      body.setAttribute("stroke-width", "2");
      var dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      dot.setAttribute("r", "4");
      dot.setAttribute("cx", n.x + n.r * 0.72); dot.setAttribute("cy", n.y - n.r * 0.72);
      dot.setAttribute("fill", "#ff7a6b"); dot.setAttribute("stroke", "#0c1120"); dot.setAttribute("stroke-width", "1.5");
      if (n.status !== "warn") dot.style.display = "none";
      var hit = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      hit.setAttribute("r", n.r + 9);
      hit.setAttribute("cx", n.x); hit.setAttribute("cy", n.y);
      hit.setAttribute("fill", "transparent");
      hit.addEventListener("click", function (ev) { ev.stopPropagation(); follow(n.id); });
      var title = document.createElementNS("http://www.w3.org/2000/svg", "title");
      title.textContent = n.name + "（" + TYPE_META[n.type].name + "）· " + n.desc;
      g.appendChild(halo); g.appendChild(body); g.appendChild(dot); g.appendChild(hit); g.appendChild(title);
      var txt = document.createElementNS("http://www.w3.org/2000/svg", "text");
      txt.setAttribute("x", n.x); txt.setAttribute("y", n.y + n.r + 15);
      txt.textContent = n.name;
      gNodes.appendChild(g); gLabels.appendChild(txt);
      nodeEls[n.id] = { g: g, halo: halo, body: body, txt: txt };
    });
  }

  /* ---------- 每次渲染：图高亮（全图常驻，仅弱化） ---------- */
  function renderGraph() {
    var fid = focusId();
    var isEdgeMode = !!state.selEdge && EDGES.some(function (e) { return e.id === state.selEdge; });
    var sel = isEdgeMode ? EDGES.filter(function (e) { return e.id === state.selEdge; })[0] : null;
    var dU = null, dD = null, maxD = maxDepthNum();
    if (!state.home && fid) { dU = bfs(fid, "up", maxD); dD = bfs(fid, "down", maxD); }

    /* 节点 */
    NODES.forEach(function (n) {
      var el = nodeEls[n.id];
      var inU = dU && dU.has(n.id), inD = dD && dD.has(n.id);
      var op = 1, halo = null, haloOp = 0.95;
      if (state.error && !isEdgeMode && !fid) { /* 错误态按 home 展示图 */ }
      if (isEdgeMode) {
        var isEnd = sel && (n.id === sel.from || n.id === sel.to);
        op = isEnd ? 1 : 0.3;
        halo = isEnd ? "sel" : null;
      } else if (!dU) {
        op = 1; /* home：全图原样 */
      } else if (n.id === fid) {
        op = 1; halo = "focus";
      } else if (inU || inD) {
        var d = Math.min(inU ? dU.get(n.id) : 99, inD ? dD.get(n.id) : 99);
        op = d === 1 ? 1 : Math.max(0.5, 0.9 - d * 0.12);
        halo = (inU && (!inD || (dU.get(n.id) <= dD.get(n.id)))) ? "up" : "down";
      } else {
        op = 0.12;
      }
      el.g.setAttribute("opacity", op);
      el.txt.setAttribute("opacity", Math.max(op, 0.25));
      if (halo) {
        el.halo.style.display = "";
        el.halo.setAttribute("stroke", halo === "up" ? COL.up : halo === "down" ? COL.down : halo === "sel" ? COL.sel : "#ffffff");
        el.halo.setAttribute("stroke-width", halo === "focus" ? 2.6 : 1.8);
        el.halo.setAttribute("stroke-dasharray", halo === "focus" ? "" : "3 3");
        el.halo.setAttribute("opacity", haloOp);
      } else el.halo.style.display = "none";
    });

    /* 边 */
    EDGES.forEach(function (e) {
      var el = edgeEls[e.id];
      var on = edgeOn(e);
      el.g.style.display = on ? "" : "none";
      if (!on) return;
      var vis = el.vis, isSel = sel && e.id === sel.id;
      var stroke, marker, width, op, showLabel = false;
      var inU = dU && dU.has(e.from) && dU.has(e.to) && dU.get(e.to) <= dU.get(e.from) + 1 && (dU.get(e.to) >= 1 || e.from === fid || dU.get(e.from) >= 1);
      var inD = dD && dD.has(e.from) && dD.has(e.to) && dD.get(e.from) <= dD.get(e.to) + 1 && (dD.get(e.from) >= 1 || e.to === fid || dD.get(e.to) >= 1);
      if (isEdgeMode) {
        var related = isSel || e.from === sel.from || e.to === sel.from || e.from === sel.to || e.to === sel.to;
        op = isSel ? 1 : (related ? 0.5 : 0.1);
        stroke = isSel ? COL.sel : COL.crit;
        marker = isSel ? "arr-sel" : (e.critical ? "arr-dim" : "arr-dim");
        width = isSel ? 3 : 1.6;
        if (isSel) showLabel = true;
      } else if (!dU) {
        stroke = e.critical ? COL.crit : COL.base;
        marker = e.critical ? "arr-crit" : "arr-base";
        width = e.critical ? 2.3 : 1.5;
        op = 0.9;
      } else if (inU || inD) {
        var isUp = inU;
        stroke = isUp ? COL.up : COL.down;
        marker = isUp ? "arr-up" : "arr-down";
        width = (e.from === fid || e.to === fid) ? 2.6 : 2;
        var dEdge = Math.min(
          dU.has(e.from) && dU.has(e.to) ? Math.max(dU.get(e.from), dU.get(e.to)) : 99,
          dD.has(e.from) && dD.has(e.to) ? Math.max(dD.get(e.from), dD.get(e.to)) : 99
        );
        op = dEdge === 1 ? 0.98 : Math.max(0.45, 0.85 - dEdge * 0.1);
        showLabel = e.from === fid || e.to === fid;
      } else {
        stroke = COL.dim; marker = "arr-dim"; width = 1.4; op = 0.14;
      }
      vis.setAttribute("stroke", stroke);
      vis.setAttribute("stroke-width", width);
      vis.setAttribute("opacity", op);
      vis.setAttribute("marker-end", "url(#" + marker + ")");
      vis.setAttribute("stroke-dasharray", e.type === "call" ? "6 4" : e.type === "write" ? "2 4" : "");
      if (showLabel || (sel && e.id === sel.id)) {
        el.lbl.textContent = EDGE_META[e.type].name + (e.critical ? " ⚑" : "");
        el.lbl.style.display = "";
      } else el.lbl.style.display = "none";
    });
    return { dU: dU, dD: dD, sel: sel, isEdgeMode: isEdgeMode };
  }

  /* ---------- 面包屑 / 上下文徽标 ---------- */
  function renderTrail() {
    var wrap = document.getElementById("trailChips");
    var badge = document.getElementById("ctxBadge");
    var html = '<span class="tc-label">跟随路径</span>';
    if (state.home || !state.trail.length) {
      html += '<span class="crumb" style="cursor:default">未聚焦 · 点击任意对象开始</span>';
    } else {
      state.trail.forEach(function (id, i) {
        var n = byId[id];
        if (i) html += '<span class="trail-sep">→</span>';
        html += '<button class="crumb' + (i === state.trail.length - 1 ? " current" : "") + '" data-crumb="' + i + '" title="回退到 ' + n.name + '">' +
          '<span class="dot" style="background:' + TYPE_META[n.type].color + '"></span>' + n.name + '</button>';
      });
      html += '<button class="tb-btn" data-act="back" title="回退一步（Backspace）">← 回退</button>';
      html += '<button class="tb-btn" data-act="home" title="清除聚焦，回到全景（Esc）">⌂ 全景</button>';
    }
    wrap.innerHTML = html;
    var hiN = 0, hiE = 0;
    if (!state.home && focusId()) {
      var maxD = maxDepthNum();
      var dU = bfs(focusId(), "up", maxD), dD = bfs(focusId(), "down", maxD);
      hiN = dU.size + dD.size - 1;
      EDGES.forEach(function (e) {
        if (!edgeOn(e)) return;
        var u = dU.has(e.from) && dU.has(e.to) && dU.get(e.to) <= dU.get(e.from) + 1;
        var d = dD.has(e.from) && dD.has(e.to) && dD.get(e.from) <= dD.get(e.to) + 1;
        if (u || d) hiE++;
      });
    }
    badge.innerHTML = (state.home || !state.trail.length)
      ? '全局上下文：<b>' + NODES.length + '</b> 对象 · <b>' + EDGES.length + '</b> 关系全部可见'
      : '全局上下文：<b>' + NODES.length + '</b> 对象 / <b>' + EDGES.length + '</b> 关系均可见 ｜ 高亮 <span class="u">' + hiN + '</span> 节点 · <span class="d">' + hiE + '</span> 关系 ｜ 其余弱化保留';
  }

  /* ---------- 检查器 ---------- */
  function typeChip(t) { return '<span class="type-chip" style="background:' + TYPE_META[t].color + '">' + TYPE_META[t].name + '</span>'; }
  function statusDot(n) { return '<span class="status-dot ' + (n.status === "warn" ? "warn" : "ok") + '" title="' + (n.status === "warn" ? "存在告警" : "正常") + '"></span>'; }

  function renderInspector(gi) {
    var box = document.getElementById("inspector");
    var html = "";
    if (state.error) {
      html += '<div class="err-box"><div class="t">未找到对象</div><div class="m">链接中的对象 id「' + state.error +
        '」不存在。已回退到全景视图，可点击图中任意对象开始跟随。</div></div>';
    }
    if (gi.isEdgeMode && gi.sel) {
      var e = gi.sel, A = byId[e.from], B = byId[e.to];
      html += '<button class="back-btn" data-act="edge-back">← 返回 ' + (focusId() ? byId[focusId()].name : "全景") + '</button>';
      html += '<div class="insp-kind">关系 · RELATIONSHIP</div>';
      html += '<div class="edge-dir-line">' +
        '<button class="edge-node-card" data-follow="' + A.id + '"><div class="en-role">依赖方 ' + typeChip(A.type) + '</div><div class="en-name">' + A.name + '</div></button>' +
        '<span class="edge-arrow">⟶</span>' +
        '<button class="edge-node-card" data-follow="' + B.id + '"><div class="en-role">被依赖 ' + typeChip(B.type) + '</div><div class="en-name">' + B.name + '</div></button>' +
        '</div>';
      html += '<div class="edge-props">' +
        '<div class="edge-prop"><span class="k">类型</span><span class="v">' + EDGE_META[e.type].name + '（A → B = A 依赖 B）</span></div>' +
        '<div class="edge-prop"><span class="k">关键度</span><span class="v">' + (e.critical ? "⚑ 关键链路" : "一般") + '</span></div>' +
        '<div class="edge-prop"><span class="k">说明</span><span class="v">' + e.label + '</span></div>' +
        '<div class="edge-prop"><span class="k">图上</span><span class="v">已高亮该边与两端对象，其余内容弱化保留</span></div>' +
        '</div>';
      html += '<div class="sec-title">继续跟随<span class="hint">点击两端对象，沿关系移动</span></div>' +
        '<button class="nb-item go-up" data-follow="' + B.id + '"><span class="dot" style="background:' + TYPE_META[B.type].color + '"></span>' +
        '<span class="nb-label">跳到被依赖方：' + B.name + '</span><span class="nb-hint">上游</span></button>' +
        '<button class="nb-item go-down" data-follow="' + A.id + '"><span class="dot" style="background:' + TYPE_META[A.type].color + '"></span>' +
        '<span class="nb-label">跳到依赖方：' + A.name + '</span><span class="nb-hint">下游</span></button>';
      box.innerHTML = html;
      return;
    }
    if (state.home || !focusId()) {
      var hubs = NODES.slice().sort(function (a, b) { return b.deg - a.deg; }).slice(0, 5);
      html += '<div class="insp-kind">全景 · OVERVIEW</div>';
      html += '<p class="guide-p"><b>这是一张依赖网络。</b>每个对象都有上游依赖（它依赖谁）与下游影响（谁依赖它）。' +
        '点击图中<b>任意对象</b>开始跟随；跟随过程中<b>全图始终可见</b>——非相关内容仅弱化、不移除。</p>';
      html += '<div class="sec-title">从枢纽对象开始<span class="hint">按连接度排序</span></div>';
      hubs.forEach(function (n) {
        html += '<button class="nb-item" data-follow="' + n.id + '"><span class="dot" style="background:' + TYPE_META[n.type].color + '"></span>' +
          '<span class="nb-label">' + n.name + '</span><span class="nb-hint">' + n.deg + ' 条关系</span></button>';
      });
      html += '<div class="sec-title">键盘操作</div><ul class="kbd-list">' +
        '<li><kbd>/</kbd> 聚焦搜索框，<kbd>↑</kbd><kbd>↓</kbd> 选择，<kbd>Enter</kbd> 跟随</li>' +
        '<li><kbd>Backspace</kbd> 沿跟随路径回退一步</li>' +
        '<li><kbd>Esc</kbd> 清除选边 / 回退 / 回到全景</li>' +
        '<li><kbd>1</kbd> <kbd>2</kbd> <kbd>0</kbd> 切换 1 跳 / 2 跳 / 全链路</li></ul>';
      html += '<p class="guide-p" style="font-size:12px;color:var(--text-3)">方向语义：A → B 表示 A 依赖 B；沿箭头走是向上游追因，逆箭头走是向下游评估影响。</p>';
      box.innerHTML = html;
      return;
    }

    var n = byId[focusId()];
    var maxD = maxDepthNum();
    var dU1 = bfs(n.id, "up", 1), dU2 = bfs(n.id, "up", 2), dUa = bfs(n.id, "up", Infinity);
    var dD1 = bfs(n.id, "down", 1), dD2 = bfs(n.id, "down", 2), dDa = bfs(n.id, "down", Infinity);
    var curU = gi.dU, curD = gi.dD;
    function statNums(m1, m2, ma, cur) {
      function cell(v, m) {
        var dim = (cur !== m);
        return '<span class="stat-num' + (dim ? " dim" : "") + '"><b>' + v + '</b><span>' + (m === 1 ? "1 跳" : m === 2 ? "2 跳" : "全链") + '</span></span>';
      }
      return cell(m1.size, 1) + cell(m2.size, 2) + cell(ma.size, Infinity);
    }
    html += '<div class="insp-kind">对象 · ' + TYPE_META[n.type].name.toUpperCase() + '</div>';
    html += '<div class="insp-title-row">' + statusDot(n) + '<span class="insp-name">' + n.name + '</span></div>';
    html += '<div class="insp-id">' + n.id + ' · ' + typeChip(n.type) + '</div>';
    html += '<div class="insp-meta"><b>负责人：</b>' + n.owner + ' ｜ <b>连接度：</b>' + n.deg + '<br>' + n.desc + '</div>';
    if (n.status === "warn") html += '<div class="insp-warnbox">⚠ 存在告警：' + n.desc.replace(/^.*（/, "").replace(/）$/, "") + '，建议评估其上下游。</div>';

    html += '<div class="stat-grid">' +
      '<div class="stat-card up"><div class="stat-label">上游依赖（我依赖谁）</div><div class="stat-nums">' + statNums(dU1, dU2, dUa, state.depth === "a" ? Infinity : parseInt(state.depth, 10)) + '</div></div>' +
      '<div class="stat-card down"><div class="stat-label">下游影响（谁依赖我）</div><div class="stat-nums">' + statNums(dD1, dD2, dDa, state.depth === "a" ? Infinity : parseInt(state.depth, 10)) + '</div></div>' +
      '</div>';

    var ups = out[n.id].filter(function (s) { return edgeOn(s.edge); });
    var downs = inn[n.id].filter(function (s) { return edgeOn(s.edge); });
    function sortList(list) {
      return list.slice().sort(function (a, b) {
        return (b.edge.critical - a.edge.critical) || byId[a.node].name.localeCompare(byId[b.node].name, "zh");
      });
    }
    html += '<div class="sec-title"><span style="color:var(--up)">上游依赖</span><span class="cnt">' + ups.length + ' 条 · 1 跳</span><span class="hint">点击跟随</span></div>';
    if (!ups.length) html += '<p class="guide-p" style="font-size:12px">（当前过滤下无 1 跳上游）</p>';
    sortList(ups).forEach(function (s) {
      var t = byId[s.node];
      html += '<button class="nb-item go-up" data-follow="' + t.id + '" title="' + s.edge.label + '"><span class="dot" style="background:' + TYPE_META[t.type].color + '"></span>' +
        '<span class="nb-label">' + t.name + '</span><span class="nb-hint">' + (s.edge.critical ? "⚑ " : "") + EDGE_META[s.edge.type].name + '</span></button>';
    });
    html += '<div class="sec-title"><span style="color:var(--down)">下游影响</span><span class="cnt">' + downs.length + ' 条 · 1 跳</span><span class="hint">点击跟随</span></div>';
    if (!downs.length) html += '<p class="guide-p" style="font-size:12px">（当前过滤下无 1 跳下游——叶子消费端）</p>';
    sortList(downs).forEach(function (s) {
      var t = byId[s.node];
      html += '<button class="nb-item go-down" data-follow="' + t.id + '" title="' + s.edge.label + '"><span class="dot" style="background:' + TYPE_META[t.type].color + '"></span>' +
        '<span class="nb-label">' + t.name + '</span><span class="nb-hint">' + (s.edge.critical ? "⚑ " : "") + EDGE_META[s.edge.type].name + '</span></button>';
    });

    var rels = ups.concat(downs);
    html += '<div class="sec-title">关系明细<span class="cnt">' + rels.length + ' 条</span><span class="hint">关系是一等内容 · 点击查看</span></div>';
    sortList(rels).forEach(function (s) {
      var isUp = !!out[n.id].some(function (x) { return x.edge === s.edge; });
      var other = byId[isUp ? s.node : s.node];
      html += '<button class="rel-item" data-edge="' + s.edge.id + '">' +
        '<span class="rel-line1"><span class="rel-dir ' + (isUp ? "up" : "down") + '">' + (isUp ? "本 ⟶ 对端" : "对端 ⟶ 本") + '</span>' +
        '<span class="rel-name">' + other.name + '</span>' + (s.edge.critical ? '<span class="rel-flag">⚑</span>' : '') +
        '<span class="rel-type">' + EDGE_META[s.edge.type].name + '</span></span>' +
        '<span class="rel-note">' + s.edge.label + '</span></button>';
    });
    box.innerHTML = html;
  }

  /* ---------- 顶栏控件 ---------- */
  function renderControls() {
    document.querySelectorAll(".seg-btn").forEach(function (b) {
      b.classList.toggle("on", b.dataset.depth === state.depth);
    });
    var chips = document.getElementById("typeChips");
    chips.innerHTML = Object.keys(EDGE_META).map(function (t) {
      return '<button class="chip' + (state.off.has(t) ? " off" : "") + '" data-off="' + t + '" title="切换显示「' + EDGE_META[t].name + '」关系">' +
        '<span class="sw" style="background:' + ({ data: "#7c8bbd", write: "#8f7cd8", call: "#d8a07c", derive: "#7cb8d8" }[t]) + '"></span>' + EDGE_META[t].name + '</button>';
    }).join("");
    document.getElementById("globalStats").textContent = NODES.length + " 个对象 · " + EDGES.length + " 条关系 · A→B = A 依赖 B";
  }
  function renderLegend() {
    var ln = document.getElementById("legendNodes");
    ln.innerHTML = Object.keys(TYPE_META).map(function (t) {
      return '<span class="lg-item"><span class="lg-swatch" style="background:' + TYPE_META[t].color + '"></span>' + TYPE_META[t].name + '</span>';
    }).join("");
    var le = document.getElementById("legendEdges");
    var lc = { data: "#7c8bbd", write: "#8f7cd8", call: "#d8a07c", derive: "#7cb8d8" };
    le.innerHTML = Object.keys(EDGE_META).map(function (t) {
      var dash = t === "call" ? "dash:6 4" : t === "write" ? "dot:2 4" : "solid";
      var style = t === "call" ? "border-top-style:dashed" : t === "write" ? "border-top-style:dotted" : "";
      return '<span class="lg-item"><span class="lg-line" style="border-color:' + lc[t] + ';' + style + '"></span>' + EDGE_META[t].name + '</span>';
    }).join("");
  }

  /* ---------- 视图（pan/zoom via viewBox） ---------- */
  var VB0 = { x: 0, y: 0, w: 1200, h: 840 };
  function svgPoint(evt) {
    var pt = svg.createSVGPoint();
    pt.x = evt.clientX; pt.y = evt.clientY;
    return pt.matrixTransform(svg.getScreenCTM().inverse());
  }
  var panning = null;
  svg.addEventListener("mousedown", function (e) {
    if (e.target.closest(".node") || e.target.closest(".edge")) return;
    var p = svgPoint(e);
    panning = { x: p.x, y: p.y };
    svg.classList.add("panning");
  });
  window.addEventListener("mousemove", function (e) {
    if (!panning) return;
    var p = svgPoint(e);
    var vb = svg.viewBox.baseVal;
    vb.x -= (p.x - panning.x); vb.y -= (p.y - panning.y);
    panning = p;
  });
  window.addEventListener("mouseup", function () { panning = null; svg.classList.remove("panning"); });
  svg.addEventListener("wheel", function (e) {
    e.preventDefault();
    var vb = svg.viewBox.baseVal;
    var f = Math.exp(e.deltaY * 0.0012);
    var nw = Math.min(Math.max(vb.width * f, 320), 2600);
    f = nw / vb.width;
    var p = svgPoint(e);
    vb.x = p.x - (p.x - vb.x) * f;
    vb.y = p.y - (p.y - vb.y) * f;
    vb.width *= f; vb.height *= f;
  }, { passive: false });
  svg.addEventListener("dblclick", function () {
    svg.viewBox.baseVal.x = VB0.x; svg.viewBox.baseVal.y = VB0.y;
    svg.viewBox.baseVal.width = VB0.w; svg.viewBox.baseVal.height = VB0.h;
  });
  svg.addEventListener("click", function (e) {
    if (e.target === svg || e.target.id === "view" || e.target.closest("#edges") === null && e.target.closest("#nodes") === null) {
      if (state.selEdge) { state.selEdge = null; render2(); }
    }
  });

  /* ---------- 总渲染 ---------- */
  function render() {
    var gi = renderGraph();
    renderTrail();
    renderInspector(gi);
    renderControls();
  }

  /* ---------- 事件委托 ---------- */
  document.addEventListener("click", function (e) {
    if (!e.target.closest("#searchBox") || e.target.closest(".sd-item")) closeDrop();
    var el;
    if ((el = e.target.closest("[data-follow]"))) { follow(el.dataset.follow); return; }
    if ((el = e.target.closest("[data-edge]"))) { selectEdge(el.dataset.edge); return; }
    if ((el = e.target.closest("[data-crumb]"))) {
      var i = parseInt(el.dataset.crumb, 10);
      state.trail = state.trail.slice(0, i + 1);
      state.home = false; state.selEdge = null;
      render2(); return;
    }
    if ((el = e.target.closest("[data-act]"))) {
      var a = el.dataset.act;
      if (a === "back") goBack();
      else if (a === "home") goHome();
      else if (a === "edge-back") { state.selEdge = null; render2(); }
      return;
    }
    if ((el = e.target.closest("[data-depth]"))) { setDepth(el.dataset.depth); return; }
    if ((el = e.target.closest("[data-off]"))) { toggleType(el.dataset.off); return; }
  });

  /* ---------- 搜索 ---------- */
  var sInput = document.getElementById("searchInput");
  var sDrop = document.getElementById("searchDrop");
  var sItems = [], sActive = -1;
  function closeDrop() { sDrop.classList.remove("open"); sDrop.innerHTML = ""; sItems = []; sActive = -1; sInput.setAttribute("aria-expanded", "false"); }
  function renderDrop() {
    var q = sInput.value.trim().toLowerCase();
    if (!q) { closeDrop(); return; }
    sItems = NODES.filter(function (n) {
      return n.name.toLowerCase().indexOf(q) >= 0 || n.id.toLowerCase().indexOf(q) >= 0 || TYPE_META[n.type].name.indexOf(q) >= 0;
    }).slice(0, 8);
    sActive = sItems.length ? 0 : -1;
    sDrop.innerHTML = sItems.length
      ? sItems.map(function (n, i) {
        return '<button class="sd-item' + (i === sActive ? " active" : "") + '" role="option" data-follow="' + n.id + '">' +
          '<span class="dot" style="width:9px;height:9px;border-radius:50%;background:' + TYPE_META[n.type].color + '"></span>' +
          n.name + '<span class="sd-id">' + n.id + '</span></button>';
      }).join("")
      : '<div class="sd-empty">无匹配对象</div>';
    sDrop.classList.add("open");
    sInput.setAttribute("aria-expanded", "true");
  }
  sInput.addEventListener("input", renderDrop);
  sInput.addEventListener("focus", renderDrop);
  sInput.addEventListener("keydown", function (e) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!sItems.length) return;
      sActive = (sActive + (e.key === "ArrowDown" ? 1 : -1) + sItems.length) % sItems.length;
      sDrop.querySelectorAll(".sd-item").forEach(function (b, i) { b.classList.toggle("active", i === sActive); });
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (sItems[sActive]) { var id = sItems[sActive].id; sInput.value = ""; closeDrop(); sInput.blur(); follow(id); }
    } else if (e.key === "Escape") {
      sInput.value = ""; closeDrop(); sInput.blur();
    }
  });

  /* ---------- 全局键盘 ---------- */
  document.addEventListener("keydown", function (e) {
    var typing = e.target === sInput || /INPUT|TEXTAREA/.test(e.target.tagName || "");
    if (typing) return;
    if (e.key === "/") { e.preventDefault(); sInput.focus(); }
    else if (e.key === "Escape") {
      if (state.selEdge) { state.selEdge = null; render2(); }
      else if (state.trail.length > 1) goBack();
      else if (!state.home) goHome();
    }
    else if (e.key === "Backspace") { e.preventDefault(); goBack(); }
    else if (e.key === "1") setDepth("1");
    else if (e.key === "2") setDepth("2");
    else if (e.key === "0") setDepth("a");
  });

  /* ---------- 启动（同步，无加载态） ---------- */
  layout();
  buildGraph();
  renderLegend();
  var init = parseHash();
  if (!init.home && !init.trail.length && !init.error) init.trail = [CORE]; /* task-first：默认聚焦枢纽 */
  apply(init);
  if (state.kb) setTimeout(function () { sInput.focus(); }, 60);
})();
