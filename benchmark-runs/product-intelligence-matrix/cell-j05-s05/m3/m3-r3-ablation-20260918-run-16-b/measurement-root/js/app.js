/* Relational Web Explorer — 单屏关系网探索器
   核心约束：跟随依赖/影响的全过程中，全图始终可见（降不透明度但不隐藏），
   面包屑 + 小地图 + 距离着色共同保证“关系跟随不丢失全局上下文”。 */
(function () {
  "use strict";
  var A = window.GraphAlgo;
  var DATA = window.GRAPH_DATA;
  var graph = A.buildGraph(DATA);
  var lay = A.layout(graph, {});

  var SVGNS = "http://www.w3.org/2000/svg";
  var TYPE_COLORS = {
    client: "#7048e8", gateway: "#1971c2", service: "#0b8a67",
    data: "#d9480f", middleware: "#e8890c", external: "#c2255c"
  };

  var state = {
    selectedId: null,
    trace: null,        // { dir:'up'|'down', b:bfs 结果, steps:number|Infinity, max:number }
    pathTargetId: null, // 闭包内被点击的节点：显示起点→它的具体路径
    view: { k: 1, x: 0, y: 0 }
  };

  function $(s) { return document.querySelector(s); }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function svgEl(tag, attrs) {
    var el = document.createElementNS(SVGNS, tag);
    for (var k in attrs) el.setAttribute(k, attrs[k]);
    return el;
  }
  function typeLabel(t) { return (DATA.nodeTypes[t] && DATA.nodeTypes[t].label) || t; }
  function nName(id) { var n = graph.nodes.get(id); return n ? n.name : id; }
  function edgeKey(e) { return e.from + "->" + e.to; }

  var svg = $("#canvas-svg");
  var viewport = $("#viewport");
  var edgeLayer = $("#edge-layer");
  var nodeLayer = $("#node-layer");
  var mmSvg = $("#minimap");
  var MMW = 216, MMH = 132, MMPAD = 8;

  var nodeEl = new Map();
  var edgeEl = new Map();

  /* ---------------- 静态构建 ---------------- */
  function buildDefs() {
    var defs = svgEl("defs", {});
    [["arrow-default", "#b7c0d4"], ["arrow-trace", "#3b5bdb"], ["arrow-path", "#1c2f6b"]]
      .forEach(function (m) {
        var mk = svgEl("marker", {
          id: m[0], viewBox: "0 0 10 10", refX: 8.5, refY: 5,
          markerWidth: 6.5, markerHeight: 6.5, orient: "auto-start-reverse"
        });
        mk.appendChild(svgEl("path", { d: "M0,0 L10,5 L0,10 z", fill: m[1] }));
        defs.appendChild(mk);
      });
    svg.insertBefore(defs, svg.firstChild);
  }

  function buildEdges() {
    graph.edges.forEach(function (e) {
      var p1 = lay.pos.get(e.from), p2 = lay.pos.get(e.to);
      var x1 = p1.x + lay.nodeW / 2, y1 = p1.y + lay.nodeH;
      var x2 = p2.x + lay.nodeW / 2, y2 = p2.y - 2;
      var my = (y1 + y2) / 2;
      var d = "M " + x1 + " " + y1 + " C " + x1 + " " + my + ", " + x2 + " " + my + ", " + x2 + " " + y2;
      var path = svgEl("path", {
        d: d,
        class: "edge" + (e.strength === "core" ? " core" : ""),
        "data-key": edgeKey(e)
      });
      var t = svgEl("title", {});
      t.textContent = nName(e.from) + " 依赖 " + nName(e.to) + (e.strength === "core" ? "（强）" : "");
      path.appendChild(t);
      edgeLayer.appendChild(path);
      edgeEl.set(edgeKey(e), path);
    });
  }

  function buildNodes() {
    graph.nodes.forEach(function (n, id) {
      var p = lay.pos.get(id);
      var g = svgEl("g", {
        class: "node type-" + n.type, "data-id": id,
        tabindex: "0", role: "button",
        "aria-label": n.name + "，" + typeLabel(n.type)
      });
      g.setAttribute("transform", "translate(" + p.x + "," + p.y + ")");

      var title = svgEl("title", {});
      title.textContent = n.name + "（" + typeLabel(n.type) + "）\n" + (n.desc || "");
      var rect = svgEl("rect", { x: 0, y: 0, rx: 8, width: lay.nodeW, height: lay.nodeH, class: "node-box" });
      var name = svgEl("text", { x: 12, y: 17, class: "node-name" });
      name.textContent = n.name;
      var sub = svgEl("text", { x: 12, y: 30, class: "node-sub" });
      sub.textContent = n.id + " · " + (n.owner || "");
      var dot = svgEl("circle", { cx: lay.nodeW - 13, cy: lay.nodeH / 2, r: 3.5, class: "node-dot" });

      var badge = svgEl("g", { class: "dist-badge" });
      var bc = svgEl("circle", { cx: lay.nodeW - 5, cy: 2, r: 9 });
      var bt = svgEl("text", { x: lay.nodeW - 5, y: 5.5 });
      badge.appendChild(bc); badge.appendChild(bt);

      g.appendChild(title); g.appendChild(rect); g.appendChild(name);
      g.appendChild(sub); g.appendChild(dot); g.appendChild(badge);

      g.addEventListener("click", function () { select(id, false); });
      g.addEventListener("keydown", function (ev) {
        if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); select(id, false); }
      });

      nodeLayer.appendChild(g);
      nodeEl.set(id, g);
    });
  }

  function buildLegendAndStats() {
    $("#stat-nodes").textContent = graph.nodes.size;
    $("#stat-edges").textContent = graph.edges.length;
    var ul = $("#legend-types");
    var html = "";
    Object.keys(DATA.nodeTypes).forEach(function (t) {
      var cnt = 0;
      graph.nodes.forEach(function (n) { if (n.type === t) cnt++; });
      html += '<li><span class="t-dot type-' + t + '"></span>' + esc(typeLabel(t)) +
        '<span class="cnt">' + cnt + "</span></li>";
    });
    ul.innerHTML = html;
    var m = DATA.meta || {};
    $("#guide-meta").textContent =
      (m.system || "") + " · " + (m.note || "") + " · 数据更新 " + (m.updated || "—") +
      " · 快捷键：F 适应全图，Esc 清除跟随，＋/− 缩放";
  }

  /* ---------------- 视口 ---------------- */
  function applyView(animate) {
    viewport.classList.toggle("anim", !!animate);
    viewport.setAttribute("transform",
      "translate(" + state.view.x + "," + state.view.y + ") scale(" + state.view.k + ")");
    drawMinimap();
  }
  function clampK(k) { return Math.max(0.1, Math.min(4, k)); }
  function zoomAt(px, py, factor, animate) {
    var k2 = clampK(state.view.k * factor);
    var r = k2 / state.view.k;
    state.view.x = px - (px - state.view.x) * r;
    state.view.y = py - (py - state.view.y) * r;
    state.view.k = k2;
    applyView(animate);
  }
  function fitView(animate) {
    var vw = svg.clientWidth, vh = svg.clientHeight;
    var k = Math.min(vw / lay.size.w, vh / lay.size.h) * 0.94;
    state.view.k = k;
    state.view.x = (vw - lay.size.w * k) / 2;
    state.view.y = (vh - lay.size.h * k) / 2;
    applyView(animate);
  }
  function centerOn(id, animate) {
    var p = lay.pos.get(id);
    var vw = svg.clientWidth, vh = svg.clientHeight;
    state.view.x = vw / 2 - (p.x + lay.nodeW / 2) * state.view.k;
    state.view.y = vh / 2 - (p.y + lay.nodeH / 2) * state.view.k;
    applyView(animate);
  }

  function initPanZoom() {
    svg.addEventListener("wheel", function (e) {
      e.preventDefault();
      var r = svg.getBoundingClientRect();
      zoomAt(e.clientX - r.left, e.clientY - r.top, e.deltaY < 0 ? 1.12 : 1 / 1.12, false);
    }, { passive: false });

    var panning = false, moved = false, sx = 0, sy = 0, ox = 0, oy = 0;
    svg.addEventListener("pointerdown", function (e) {
      if (e.target.closest && e.target.closest(".node")) return;
      panning = true; moved = false;
      sx = e.clientX; sy = e.clientY; ox = state.view.x; oy = state.view.y;
      svg.setPointerCapture(e.pointerId);
    });
    svg.addEventListener("pointermove", function (e) {
      if (!panning) return;
      var dx = e.clientX - sx, dy = e.clientY - sy;
      if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;
      state.view.x = ox + dx; state.view.y = oy + dy;
      applyView(false);
    });
    svg.addEventListener("pointerup", function () { panning = false; });
    svg.addEventListener("click", function (e) {
      if (moved) { e.stopPropagation(); moved = false; }
    }, true);

    $("#btn-zoom-in").addEventListener("click", function () {
      zoomAt(svg.clientWidth / 2, svg.clientHeight / 2, 1.25, true);
    });
    $("#btn-zoom-out").addEventListener("click", function () {
      zoomAt(svg.clientWidth / 2, svg.clientHeight / 2, 1 / 1.25, true);
    });
    $("#btn-fit").addEventListener("click", function () { fitView(true); });

    mmSvg.addEventListener("click", function (e) {
      var r = mmSvg.getBoundingClientRect();
      var s = minimapScale();
      var wx = (e.clientX - r.left - MMPAD) / s;
      var wy = (e.clientY - r.top - MMPAD) / s;
      state.view.x = svg.clientWidth / 2 - wx * state.view.k;
      state.view.y = svg.clientHeight / 2 - wy * state.view.k;
      applyView(true);
    });

    window.addEventListener("resize", drawMinimap);
  }

  /* ---------------- 小地图 ---------------- */
  function minimapScale() {
    return Math.min((MMW - MMPAD * 2) / lay.size.w, (MMH - MMPAD * 2) / lay.size.h);
  }
  function drawMinimap() {
    while (mmSvg.firstChild) mmSvg.removeChild(mmSvg.firstChild);
    var s = minimapScale();
    var closure = currentClosure();
    graph.nodes.forEach(function (n, id) {
      var p = lay.pos.get(id);
      var inC = closure ? closure.has(id) : false;
      var c = svgEl("circle", {
        cx: MMPAD + p.x * s + lay.nodeW / 2 * s,
        cy: MMPAD + p.y * s + lay.nodeH / 2 * s,
        r: inC ? 4 : 2.8,
        fill: inC ? TYPE_COLORS[n.type] || "#3b5bdb" : "#c7cfdf"
      });
      if (id === state.selectedId) {
        c.setAttribute("r", "5");
        c.setAttribute("stroke", "#17203a");
        c.setAttribute("stroke-width", "1.5");
      }
      mmSvg.appendChild(c);
    });
    var vw = svg.clientWidth / state.view.k, vh = svg.clientHeight / state.view.k;
    var wx = -state.view.x / state.view.k, wy = -state.view.y / state.view.k;
    mmSvg.appendChild(svgEl("rect", {
      x: MMPAD + wx * s, y: MMPAD + wy * s,
      width: Math.max(4, vw * s), height: Math.max(4, vh * s),
      fill: "rgba(59,91,219,.08)", stroke: "#3b5bdb", "stroke-width": "1.2", rx: 2
    }));
  }

  /* ---------------- 状态推导 ---------------- */
  function currentClosure() {
    if (!state.trace) return null;
    return A.closureUpTo(state.trace.b, state.trace.steps);
  }
  function hopCounts(closure) {
    var counts = new Map();
    closure.forEach(function (d) { counts.set(d, (counts.get(d) || 0) + 1); });
    return counts;
  }

  /* ---------------- 主渲染 ---------------- */
  function render() {
    var t = state.trace;
    var closure = currentClosure();

    var treeEdges = new Set();
    if (t) {
      t.b.dist.forEach(function (d, id) {
        if (d > 0 && d <= t.steps) {
          var pe = t.b.parent.get(id);
          if (pe) treeEdges.add(edgeKey(pe));
        }
      });
    }
    var pathEdges = new Set(), pathNodes = [];
    if (t && state.pathTargetId && closure.has(state.pathTargetId)) {
      A.pathEdges(t.b, state.pathTargetId, t.dir).forEach(function (e) { pathEdges.add(edgeKey(e)); });
      pathNodes = A.pathNodes(t.b, state.pathTargetId, t.dir);
    }

    nodeEl.forEach(function (g, id) {
      var isSel = id === state.selectedId;
      var inC = closure ? closure.has(id) : false;
      g.classList.toggle("selected", isSel);
      g.classList.toggle("trace", !isSel && inC);
      g.classList.toggle("dim", !!t && !inC);
      g.classList.toggle("path", pathNodes.indexOf(id) >= 0 && !isSel);
      var badge = g.querySelector(".dist-badge");
      if (t && inC) {
        badge.classList.add("show");
        badge.querySelector("text").textContent = closure.get(id) === 0 ? "起" : closure.get(id);
      } else {
        badge.classList.remove("show");
      }
    });

    edgeEl.forEach(function (p, key) {
      p.classList.toggle("trace", treeEdges.has(key));
      p.classList.toggle("path", pathEdges.has(key));
      p.classList.toggle("dim", !!t && !treeEdges.has(key) && !pathEdges.has(key));
    });

    renderBreadcrumb(closure);
    renderInspector(closure, pathNodes);
    renderStatus(closure);
    drawMinimap();
  }

  function shownSteps() {
    var t = state.trace;
    if (!t) return 0;
    return t.steps === Infinity ? t.max : t.steps;
  }

  function renderBreadcrumb(closure) {
    var box = $("#breadcrumb");
    var t = state.trace;
    if (!t || !closure) {
      box.innerHTML = '<span class="bc-empty">未在跟随 —— 在画布选中节点，再选择「追踪上游依赖 / 下游影响」开始。全图与小地图始终可见。</span>';
      return;
    }
    var counts = hopCounts(closure);
    var shown = shownSteps();
    var html = "";
    html += chipHtml(0, "起点 · " + esc(nName(state.selectedId)), shown === 0, true);
    var kMax = t.steps === Infinity ? t.max : t.steps;
    for (var k = 1; k <= Math.max(shown, 0); k++) {
      html += '<span class="bc-sep">→</span>';
      html += chipHtml(k, "第 " + k + " 跳 · +" + (counts.get(k) || 0), shown === k);
    }
    if (t.steps === Infinity && t.max > 0) {
      // 到底时最后一个 chip 即 active（上面循环已覆盖 k=max）
    }
    if (t.steps !== Infinity && shown < t.max) {
      html += '<span class="bc-sep">⋯</span>';
      html += '<span class="bc-empty">还可继续 ' + (t.max - shown) + " 跳</span>";
    }
    box.innerHTML = html;

    box.querySelectorAll(".chip").forEach(function (el) {
      el.addEventListener("click", function () { setSteps(parseInt(el.dataset.step, 10)); });
    });
  }
  function chipHtml(step, label, active, origin) {
    return '<button class="chip' + (active ? " active" : "") + (origin ? " origin" : "") +
      '" data-step="' + step + '" title="回溯到这一跳">' + label + "</button>";
  }

  function renderStatus(closure) {
    var el = $("#trace-status");
    var t = state.trace;
    if (!t) { el.textContent = ""; return; }
    var dirLabel = t.dir === "up" ? "上游依赖" : "下游影响";
    var stepsLabel = t.steps === Infinity ? "到底（" + t.max + " 跳）" : shownSteps() + " 跳";
    el.innerHTML = "<span><b>" + dirLabel + "</b> · 已跟随 " + stepsLabel +
      " · 覆盖 " + closure.size + " / " + graph.nodes.size + " 节点</span>" +
      '<button class="btn-clear" data-action="clear-trace">清除跟随</button>';
  }

  function renderInspector(closure, pathNodes) {
    var guide = $("#inspector-guide");
    var body = $("#inspector-body");
    var id = state.selectedId;
    if (!id) { guide.hidden = false; body.hidden = true; return; }
    guide.hidden = true; body.hidden = false;

    var n = graph.nodes.get(id);
    var t = state.trace;
    var shown = shownSteps();

    var html = "";
    html += '<span class="insp-type type-' + n.type + '">' + esc(typeLabel(n.type)) + "</span>" +
      '<span class="insp-id">' + esc(n.id) + "</span>";
    html += '<div class="insp-name">' + esc(n.name) + "</div>";
    html += '<p class="insp-desc">' + esc(n.desc || "") + "</p>";
    html += '<div class="insp-meta">' +
      '<div class="m"><small>负责人</small><b>' + esc(n.owner || "—") + "</b></div>" +
      '<div class="m"><small>关键度</small><b>' + esc(n.tier || "—") + "</b></div>" +
      "</div>";

    /* 跟随控制 */
    var canStep = t && t.steps !== Infinity && shown < t.max;
    html += '<div class="trace-controls"><div class="tc-title">关系跟随 · 全图保持可见</div><div class="row">' +
      '<button data-action="trace-up" class="primary"' + (t && t.dir === "up" ? " disabled" : "") + '>追踪上游依赖</button>' +
      '<button data-action="trace-down" class="primary down"' + (t && t.dir === "down" ? " disabled" : "") + '>追踪下游影响</button>' +
      '</div><div class="row" style="margin-top:6px">' +
      '<button data-action="step-next"' + (canStep ? "" : " disabled") + ">下一步 +1 跳</button>" +
      '<button data-action="trace-all"' + (t && t.steps === Infinity ? " disabled" : "") + ">自动到底</button>" +
      '<button data-action="trace-clear"' + (t ? "" : " disabled") + ">清除</button>" +
      "</div>";
    if (t) {
      var dirLabel = t.dir === "up" ? "上游（我所依赖的）" : "下游（依赖我的）";
      html += '<div class="tc-state">方向：<b>' + dirLabel + "</b> · 已展开 <b>" +
        (t.steps === Infinity ? t.max : shown) + " / " + t.max + "</b> 跳 · 点击面包屑或距离徽标可回溯。</div>";
    } else {
      html += '<div class="tc-state">跟随过程中，全图降为浅色但仍完整可见，小地图同步标出追踪范围。</div>';
    }
    html += "</div>";

    /* 具体路径 */
    if (t && state.pathTargetId && pathNodes.length) {
      var chain = pathNodes.map(function (nid, i) {
        var arrow = i ? '<span class="arrow">→</span>' : "";
        return arrow + "<b data-pathsel=\"" + esc(nid) + '" title="把路径终点切到这里">' + esc(nName(nid)) + "</b>";
      }).join("");
      html += '<div class="path-box"><div class="p-title">经由路径 · ' +
        (t.dir === "up" ? "依赖链" : "影响链") + " · " + (pathNodes.length - 1) + " 跳</div>" +
        '<div class="p-chain">' + chain + "</div>" +
        '<div class="p-note">点击链上节点名可将路径终点切换到该节点；Esc 清除跟随。</div></div>';
    }

    /* 直接上/下游 */
    function relList(edges, dir) {
      if (!edges.length) return '<div class="insp-empty">无</div>';
      var sorted = edges.slice().sort(function (a, b) {
        return nName(dir === "up" ? a.to : a.from).localeCompare(nName(dir === "up" ? b.to : b.from), "zh");
      });
      var lis = sorted.map(function (e) {
        var other = dir === "up" ? e.to : e.from;
        var otherNode = graph.nodes.get(other);
        var inC = closure && closure.has(other);
        return '<li><button data-select="' + esc(other) + '" title="' + esc(otherNode.desc || "") + '">' +
          '<span class="t-dot type-' + otherNode.type + '"></span>' + esc(otherNode.name) +
          (e.strength === "core" ? '<span class="rel">强依赖</span>' : "") +
          (inC ? '<span class="rel">✓ 在追踪内</span>' : "") +
          "</button></li>";
      });
      return '<ul class="insp-list">' + lis.join("") + "</ul>";
    }
    html += '<div class="insp-sec"><h3>直接上游<span class="n">' + n.out.length + '</span><span class="hint">我依赖什么</span></h3>' +
      relList(n.out, "up") + "</div>";
    html += '<div class="insp-sec"><h3>直接下游<span class="n">' + n.in.length + '</span><span class="hint">谁依赖我</span></h3>' +
      relList(n.in, "down") + "</div>";

    body.innerHTML = html;
  }

  /* ---------------- 动作 ---------------- */
  function select(id, silent) {
    state.selectedId = id;
    if (state.trace) {
      var inC = state.trace.b.dist.has(id);
      var origin = state.trace.b.order[0];
      if (!inC) {
        state.trace = null;
        state.pathTargetId = null;
      } else {
        state.pathTargetId = id === origin ? null : id;
      }
    }
    if (!silent) centerOn(id, true);
    render();
  }
  function startTrace(dir) {
    if (!state.selectedId) return;
    var b = A.bfs(graph, state.selectedId, dir);
    state.trace = { dir: dir, b: b, steps: 1, max: b.max };
    state.pathTargetId = null;
    render();
  }
  function setSteps(k) {
    if (!state.trace) return;
    state.trace.steps = Math.max(0, Math.min(k, state.trace.max));
    render();
  }
  function clearTrace() {
    state.trace = null;
    state.pathTargetId = null;
    render();
  }

  function initInspectorEvents() {
    $("#inspector").addEventListener("click", function (e) {
      var btn = e.target.closest("button");
      if (!btn) return;
      if (btn.dataset.select) { select(btn.dataset.select, false); return; }
      if (btn.dataset.pathsel) { state.pathTargetId = btn.dataset.pathsel; render(); return; }
      var action = btn.dataset.action;
      if (action === "trace-up") startTrace("up");
      else if (action === "trace-down") startTrace("down");
      else if (action === "step-next") setSteps(shownSteps() + 1);
      else if (action === "trace-all") { state.trace.steps = Infinity; render(); }
      else if (action === "trace-clear" || action === "clear-trace") clearTrace();
    });
    $("#trace-status").addEventListener("click", function (e) {
      if (e.target.closest(".btn-clear")) clearTrace();
    });
  }

  /* ---------------- 搜索 ---------------- */
  function initSearch() {
    var input = $("#search-input");
    var listBox = $("#search-results");
    var results = [];
    var active = 0;

    function close() { listBox.hidden = true; input.setAttribute("aria-expanded", "false"); }
    function open() { listBox.hidden = false; input.setAttribute("aria-expanded", "true"); }
    function paint() {
      if (!results.length) {
        listBox.innerHTML = '<li class="none">无匹配节点</li>';
        return;
      }
      listBox.innerHTML = results.map(function (r, i) {
        return '<li role="option" data-id="' + esc(r.id) + '" class="' + (i === active ? "active" : "") + '">' +
          '<span class="t-dot type-' + r.type + '"></span>' + esc(r.name) +
          "<small>" + esc(r.id) + "</small></li>";
      }).join("");
      listBox.querySelectorAll("li[data-id]").forEach(function (li) {
        li.addEventListener("mousedown", function (e) {
          e.preventDefault();
          choose(li.dataset.id);
        });
      });
    }
    function choose(id) {
      close();
      input.value = "";
      select(id, false);
      var g = nodeEl.get(id);
      if (g) g.focus({ preventScroll: true });
    }
    input.addEventListener("input", function () {
      var q = input.value.trim().toLowerCase();
      active = 0;
      if (!q) { close(); return; }
      results = [];
      graph.nodes.forEach(function (n, id) {
        if (n.name.toLowerCase().indexOf(q) >= 0 || id.toLowerCase().indexOf(q) >= 0) results.push(n);
      });
      results = results.slice(0, 8);
      paint();
      open();
    });
    input.addEventListener("keydown", function (e) {
      if (listBox.hidden) return;
      if (e.key === "ArrowDown") { e.preventDefault(); active = Math.min(active + 1, results.length - 1); paint(); }
      else if (e.key === "ArrowUp") { e.preventDefault(); active = Math.max(active - 1, 0); paint(); }
      else if (e.key === "Enter") { e.preventDefault(); if (results[active]) choose(results[active].id); }
      else if (e.key === "Escape") { close(); }
    });
    input.addEventListener("blur", function () { setTimeout(close, 150); });
  }

  /* ---------------- 全局键盘 ---------------- */
  function initGlobalKeys() {
    document.addEventListener("keydown", function (e) {
      var tag = (e.target.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea") return;
      if (e.key === "Escape") clearTrace();
      else if (e.key === "f" || e.key === "F") fitView(true);
      else if (e.key === "+" || e.key === "=") zoomAt(svg.clientWidth / 2, svg.clientHeight / 2, 1.25, true);
      else if (e.key === "-") zoomAt(svg.clientWidth / 2, svg.clientHeight / 2, 1 / 1.25, true);
    });
  }

  /* ---------------- URL 状态（便于取证复现，不属持久化） ---------------- */
  function applyUrlState() {
    var qs = new URLSearchParams(location.search);
    var sel = qs.get("select");
    if (sel && graph.nodes.has(sel)) select(sel, true);
    var tr = qs.get("trace");
    if (tr === "up" || tr === "down") {
      if (!state.selectedId) return;
      startTrace(tr);
      var st = qs.get("steps");
      if (st === "all") state.trace.steps = Infinity;
      else if (st !== null && !isNaN(+st)) state.trace.steps = Math.max(0, Math.min(+st, state.trace.max));
      var pt = qs.get("path");
      if (pt && graph.nodes.has(pt) && state.trace.b.dist.has(pt)) state.pathTargetId = pt;
      render();
    }
    if (qs.get("kb")) {
      var g = nodeEl.get(state.selectedId);
      if (g) g.focus({ preventScroll: true });
    }
  }

  /* ---------------- 启动 ---------------- */
  buildDefs();
  buildEdges();
  buildNodes();
  buildLegendAndStats();
  initPanZoom();
  initInspectorEvents();
  initSearch();
  initGlobalKeys();
  fitView(false);
  render();
  applyUrlState();
})();
