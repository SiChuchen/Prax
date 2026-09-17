/* Aurora 变更编年史 —— 渲染与交互
 * 结构契约（Prax 会话 ds_20260915182037_d4ba5123）：
 *  - 主表征 timeline，支撑 diagram（因果弧线）/ table（状态切片）/ list（字段操作）
 *  - mc1: 因果连线只从早指向晚（数据层校验）
 *  - mc2: 状态切片 = fold(changes ≤ t)，与详情 before/after 同一折叠函数
 *  - 状态：ready（首屏即就绪）/ selected / empty（Esc 清除后）/ error（完整性校验失败）；
 *    loading 按交付约束刻意不存在（数据内联，不以加载态作为可测状态）
 */
(function () {
  "use strict";
  var D = window.AURORA_DATA;
  var SVG_NS = "http://www.w3.org/2000/svg";
  // 启动探针：headless 取证 / 真实浏览器均可读；?probe=1 时屏幕可见
  function boot(s) {
    var b = document.getElementById("boot-status");
    if (!b) return;
    b.textContent = s;
    if (/[?&]probe=1/.test(location.search)) {
      b.style.cssText = "position:fixed;bottom:0;left:0;right:0;z-index:99;" +
        "font:11px/1.5 Consolas,monospace;padding:4px 10px;max-height:120px;overflow:hidden;" +
        "background:" + (s.indexOf("ERROR") >= 0 || s.indexOf("FAIL") >= 0 ? "#fff0f0;color:#c92a2a" : "#f0fff4;color:#087f5b") +
        ";border-top:1px solid #ddd";
    }
  }
  window.addEventListener("error", function (e) {
    boot("BOOT-ERROR: " + e.message + " @" + (e.lineno || "?"));
  });

  /* ---------------- 基础解析 ---------------- */
  var T0 = new Date(D.meta.range[0]).getTime();
  var T1 = new Date(D.meta.range[1]).getTime();
  var changes = D.changes.map(function (c, i) {
    return Object.assign({}, c, { time: new Date(c.t).getTime(), seq: i + 1 });
  });
  changes.sort(function (a, b) { return a.time - b.time; });
  var byId = {};
  changes.forEach(function (c) { byId[c.id] = c; });
  var entities = D.entities;
  var entById = {};
  entities.forEach(function (e) { entById[e.id] = e; });

  function fmt(t) {
    var d = new Date(t);
    function p(n) { return (n < 10 ? "0" : "") + n; }
    return p(d.getMonth() + 1) + "-" + p(d.getDate()) + " " + p(d.getHours()) + ":" + p(d.getMinutes());
  }

  /* ---------------- 完整性校验（error 状态来源；mc1 的数据层保证） ---------------- */
  var integrityErrors = [];
  var knownFields = {};
  entities.forEach(function (e) { knownFields[e.id] = {}; e.fields.forEach(function (f) { knownFields[e.id][f[0]] = true; }); });
  changes.forEach(function (c) {
    if (c.time < T0 || c.time > T1) integrityErrors.push(c.id + " 时间超出 Q2 范围");
    if (c.cause) {
      var pc = byId[c.cause];
      if (!pc) integrityErrors.push(c.id + " 的诱因 " + c.cause + " 不存在");
      else if (pc.time >= c.time) integrityErrors.push("因果方向违背时间顺序：" + c.cause + " → " + c.id);
    }
    (c.ops || []).forEach(function (op) {
      if (!knownFields[op.e]) { integrityErrors.push(c.id + " 引用未知组件 " + op.e); return; }
      if (op.op === "add") knownFields[op.e][op.k] = true;
      else if (!knownFields[op.e][op.k]) integrityErrors.push(c.id + " 引用未知字段 " + op.e + "." + op.k);
    });
  });

  /* ---------------- 因果链接与可达闭包 ---------------- */
  var links = [];
  changes.forEach(function (c) {
    if (c.cause) links.push({ id: c.cause + "->" + c.id, from: c.cause, to: c.id, why: c.why || "" });
  });
  var children = {}, causeOf = {};
  links.forEach(function (l) {
    (children[l.from] = children[l.from] || []).push(l.to);
    causeOf[l.to] = l.from;
  });
  function closure(id, map) {
    var seen = {}, queue = [id];
    while (queue.length) {
      var cur = queue.shift();
      var nxt = map[cur];
      if (nxt == null) nxt = [];
      if (typeof nxt === "string") nxt = [nxt]; // causeOf 映射的值是单个 id
      nxt.forEach(function (n) { if (!seen[n]) { seen[n] = true; queue.push(n); } });
    }
    return seen;
  }

  /* ---------------- 折叠：状态切片与 before/after 的唯一来源（mc2） ---------------- */
  function freshState() {
    var s = {};
    entities.forEach(function (e) {
      s[e.id] = {};
      e.fields.forEach(function (f) { s[e.id][f[0]] = { v: f[1], by: null, at: null }; });
    });
    return s;
  }
  function applyChange(state, c) {
    (c.ops || []).forEach(function (op) {
      var ent = state[op.e];
      if (!ent[op.k]) ent[op.k] = { v: null, by: null, at: null }; // add 语义：字段可以新生
      var cell = ent[op.k];
      if (op.op === "remove") { cell.v = null; }
      else { cell.v = op.to; }
      cell.by = c.id; cell.at = c.time;
    });
  }
  function stateAt(t) {
    var s = freshState();
    changes.forEach(function (c) { if (c.time <= t) applyChange(s, c); });
    return s;
  }
  // 启动时顺序回放一次，为每个 op 记录变更前值（详情 before/after 与切片同源）
  (function () {
    var s = freshState();
    changes.forEach(function (c) {
      (c.ops || []).forEach(function (op) {
        var cell = s[op.e] && s[op.e][op.k];
        op._from = cell ? cell.v : undefined;
      });
      applyChange(s, c);
    });
  })();

  // 触点：变更 × 组件
  var touches = {}; // changeId -> [entityId]
  changes.forEach(function (c) {
    var set = [];
    (c.ops || []).forEach(function (op) { if (set.indexOf(op.e) < 0) set.push(op.e); });
    touches[c.id] = set;
  });

  /* ---------------- SVG 构建 ---------------- */
  var VB_W = 1180, VB_H = 620, X0 = 104, X1 = 1168;
  function timeToX(t) { return X0 + (t - T0) / (T1 - T0) * (X1 - X0); }
  function xToTime(x) { return T0 + (x - X0) / (X1 - X0) * (T1 - T0); }

  var typeKeys = Object.keys(D.types);
  var ROW_Y0 = 68, ROW_H = 64;
  function rowY(type) { var i = typeKeys.indexOf(type); return ROW_Y0 + i * ROW_H + ROW_H / 2; }
  var LANE_TITLE_Y = 412, LANE_Y0 = 424, LANE_H = 19;

  var PHASE_TINT = { P1: ["#e7f0fa", "#3b6ea5"], P2: ["#fdf3df", "#a36a00"], P3: ["#fbe9ec", "#b03a52"], P4: ["#ecebf7", "#5a54b0"], P5: ["#e4f4ec", "#2b7a4b"] };

  function el(name, attrs, parent, text) {
    var n = document.createElementNS(SVG_NS, name);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (text != null) n.textContent = text;
    (parent || svg).appendChild(n);
    return n;
  }

  var svg = document.getElementById("timeline");
  var appRoot = document.querySelector("main");

  // 状态（state_ownership：selection 归时间轴，cursor 归应用会话）
  var state = { selectedId: "c16", cursorT: byId["c16"] ? byId["c16"].time : T1, filter: null, playing: null };

  function build() {
    // 箭头 marker
    var defs = el("defs", {});
    ["#b9c1cd", "#e8590c", "#7c8797"].forEach(function (col, i) {
      var m = el("marker", { id: "arrow" + i, viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: "auto-start-reverse" }, defs);
      el("path", { d: "M0,0 L10,5 L0,10 z", fill: col }, m);
    });

    // 月分隔与月份标签
    var months = [["2026-04-01", "4 月"], ["2026-05-01", "5 月"], ["2026-06-01", "6 月"]];
    months.forEach(function (m) {
      var x = timeToX(new Date(m[0]).getTime());
      el("line", { x1: x, y1: 4, x2: x, y2: 604, stroke: "#e9edf3", "stroke-width": 1 });
      el("text", { x: x + 8, y: 18, "class": "month-label" }, svg, m[1]);
    });

    // 阶段带（层级：中 —— 分组）；窄带的名字放到带下方，避免与邻带叠压
    D.phases.forEach(function (p, pi) {
      var a = timeToX(new Date(p.start).getTime()), b = timeToX(new Date(p.end).getTime());
      var tint = PHASE_TINT[p.id];
      var g = el("g", {}, svg);
      el("rect", { x: a + 1, y: 28, width: Math.max(2, b - a - 2), height: 26, rx: 6, fill: tint[0] }, g);
      var need = p.name.length * 12 + 18;
      if (b - a >= need) {
        el("text", { x: a + 9, y: 45, "class": "phase-name", fill: tint[1] }, g, p.name);
      } else {
        el("line", { x1: a + 6, y1: 54, x2: a + 6, y2: 60, stroke: tint[1], "stroke-width": 1 }, g);
        el("text", { x: a + 2, y: 64, "class": "phase-name", fill: tint[1], "font-size": 10.5 }, g, p.name);
      }
      var t = el("title", {}, g); t.textContent = p.name + "（" + fmt(new Date(p.start).getTime()).slice(0, 5) + " – " + fmt(new Date(p.end).getTime()).slice(0, 5) + "）· " + p.goal;
    });

    // 类型行（纵向 = 变更类型，横向 = 时间）
    typeKeys.forEach(function (tk, i) {
      var y = ROW_Y0 + i * ROW_H;
      if (i % 2 === 0) el("rect", { x: X0 - 4, y: y, width: X1 - X0 + 8, height: ROW_H, fill: "#fbfcfe" });
      el("line", { x1: X0 - 4, y1: y, x2: X1 + 4, y2: y, stroke: "#eef1f6" });
      var cnt = changes.filter(function (c) { return c.type === tk; }).length;
      el("text", { x: 14, y: y + ROW_H / 2 - 2, "class": "row-label" }, svg, D.types[tk].label);
      el("text", { x: 14, y: y + ROW_H / 2 + 14, "class": "row-count" }, svg, cnt + " 项");
    });
    el("line", { x1: X0 - 4, y1: ROW_Y0 + 5 * ROW_H, x2: X1 + 4, y2: ROW_Y0 + 5 * ROW_H, stroke: "#eef1f6" });

    // 组件触点泳道
    el("text", { x: 14, y: LANE_TITLE_Y, "class": "region-title" }, svg, "组件触点 · 每一格 = 一次波及");
    entities.forEach(function (e, i) {
      var y = LANE_Y0 + i * LANE_H;
      el("text", { x: 14, y: y + 9, "class": "lane-label", "data-lane": e.id }, svg, e.name);
      el("line", { x1: X0 - 4, y1: y + 13, x2: X1 + 4, y2: y + 13, stroke: "#f0f2f7", "data-lane-line": e.id });
    });

    // 底部日期刻度
    ["2026-04-01", "2026-04-15", "2026-05-01", "2026-05-15", "2026-06-01", "2026-06-15", "2026-06-30"].forEach(function (ds) {
      var x = timeToX(new Date(ds + "T00:00:00").getTime());
      el("line", { x1: x, y1: LANE_Y0 + entities.length * LANE_H + 2, x2: x, y2: 600, stroke: "#e9edf3" });
      el("text", { x: x, y: 614, "font-size": 10, fill: "#8a93a3", "text-anchor": "middle", "font-family": "Consolas, monospace" }, svg, ds.slice(5));
    });

    // 因果连线层（diagram 支撑）
    var edgeGroup = el("g", { id: "edges" });
    links.forEach(function (l) {
      var f = byId[l.from], t = byId[l.to];
      var x1 = timeToX(f.time), y1 = rowY(f.type), x2 = timeToX(t.time), y2 = rowY(t.type);
      var d;
      if (x2 - x1 < 22) {
        // 近同时刻的因果（如故障 → 止血回滚）：向上绕行小环，仍保持左→右语义
        d = "M" + x1 + "," + y1 + " C" + x1 + "," + (Math.min(y1, y2) - 52) + " " + x2 + "," + (Math.min(y1, y2) - 52) + " " + x2 + "," + (y2 - 9);
      } else {
        var dx = Math.max(26, (x2 - x1) * 0.42);
        d = "M" + x1 + "," + y1 + " C" + (x1 + dx) + "," + y1 + " " + (x2 - dx) + "," + y2 + " " + (x2 - 8) + "," + y2;
      }
      var p = el("path", { d: d, "class": "edge", "marker-end": "url(#arrow0)", "data-from": l.from, "data-to": l.to }, edgeGroup);
      var ti = el("title", {}, p);
      ti.textContent = l.from + " → " + l.to + "：" + l.why + "（诱因 " + fmt(f.time) + " → 后果 " + fmt(t.time) + "）";
      p.addEventListener("click", function (ev) { ev.stopPropagation(); select(l.to); });
    });

    // 变更节点层（timeline 主表征）
    var nodeGroup = el("g", { id: "nodes" });
    var lastEnd = {}; // 行内标签防重叠：above/below 两侧各自维护已占用右界
    typeKeys.forEach(function (tk) { lastEnd[tk] = { above: X0 - 999, below: X0 - 999 }; });
    changes.forEach(function (c) {
      var x = timeToX(c.time), y = rowY(c.type);
      var g = el("g", { "class": "node", "data-id": c.id, tabindex: 0, role: "button" }, nodeGroup);
      el("circle", { cx: x, cy: y, r: 8.6, fill: "none", stroke: "transparent", "class": "ring-chain" }, g);
      el("circle", { cx: x, cy: y, r: 10.4, fill: "none", stroke: "transparent", "stroke-width": 2.2, "class": "ring-sel" }, g);
      el("circle", { cx: x, cy: y, r: 6.4, fill: D.types[c.type].color, stroke: "#fff", "stroke-width": 1.6 }, g);
      var ti = el("title", {}, g);
      ti.textContent = "[" + c.id + " · " + D.types[c.type].label + "] " + c.title + "\n时间：" + fmt(c.time) + " · " + c.actor + "\n点击选中，查看因果与前后状态";

      // 标签（id + 短标题），行内上下交错防重叠；两侧都放不下时右移让位
      var w = 30 + c.short.length * 10.5;
      var ends = lastEnd[c.type];
      var side, lx = x;
      if (x - w / 2 > ends.above + 4) side = "above";
      else if (x - w / 2 > ends.below + 4) side = "below";
      else {
        side = ends.above <= ends.below ? "above" : "below";
        lx = ends[side] + w / 2 + 6; // 让位右移，保持行内标签互不叠压
      }
      var ly = side === "above" ? y - 15 : y + 22;
      ends[side] = lx + w / 2;
      var txt = el("text", { x: lx, y: ly, "text-anchor": "middle", "class": "node-label" }, g);
      var t1 = el("tspan", { "class": "nid" }, txt, c.id);
      el("tspan", { "class": "ntitle" }, txt, " " + c.short);

      g.addEventListener("click", function (ev) { ev.stopPropagation(); select(c.id); });
      g.addEventListener("keydown", function (ev) { if (ev.key === "Enter") select(c.id); });
    });

    // 时间游标（可拖动，驱动状态切片）
    var cur = el("g", { id: "cursor" });
    el("line", { x1: 0, y1: 4, x2: 0, y2: 604, "class": "cursor-line", "data-cursor-line": "" }, cur);
    el("path", { d: "M0,2 l-6,-9 l12,0 z", fill: "#1c2330", "class": "cursor-handle", transform: "translate(0,12)" }, cur);
    el("rect", { x: -9, y: 4, width: 18, height: 600, "class": "cursor-hit" }, cur);
  }

  /* ---------------- 动态更新 ---------------- */
  function chainOf(id) {
    var anc = closure(id, causeOf); anc[id] = true;
    var des = closure(id, children); des[id] = true;
    return { anc: anc, des: des };
  }

  function updateCanvas() {
    var sel = state.selectedId ? byId[state.selectedId] : null;
    var chain = sel ? chainOf(sel.id) : null;
    // 边
    svg.querySelectorAll(".edge").forEach(function (p) {
      var f = p.getAttribute("data-from"), t = p.getAttribute("data-to");
      var onChain = chain && ((chain.anc[f] && chain.anc[t]) || (chain.des[f] && chain.des[t]));
      p.classList.toggle("chain", !!onChain);
      p.setAttribute("marker-end", onChain ? "url(#arrow1)" : "url(#arrow0)");
      var vis = !state.filter || touches[f].indexOf(state.filter) >= 0 || touches[t].indexOf(state.filter) >= 0;
      p.classList.toggle("dim", !vis);
    });
    // 节点
    svg.querySelectorAll(".node").forEach(function (g) {
      var c = byId[g.getAttribute("data-id")];
      g.classList.remove("dim", "faded", "future");
      if (state.filter && touches[c.id].indexOf(state.filter) < 0) g.classList.add("dim");
      else if (chain && !chain.anc[c.id] && !chain.des[c.id]) g.classList.add("faded");
      if (c.time > state.cursorT) g.classList.add("future");
      g.querySelector(".ring-sel").setAttribute("stroke", state.selectedId === c.id ? "#1c2330" : "transparent");
      g.querySelector(".ring-chain").setAttribute("stroke", chain && (chain.anc[c.id] || chain.des[c.id]) && state.selectedId !== c.id ? "#e8590c" : "transparent");
    });
    // 游标位置
    var cx = timeToX(state.cursorT);
    var cur = svg.querySelector("#cursor");
    cur.setAttribute("transform", "translate(" + cx + ",0)");
    // 泳道高亮
    svg.querySelectorAll("[data-lane]").forEach(function (t) {
      t.setAttribute("fill", !state.filter || t.getAttribute("data-lane") === state.filter ? "#4a5568" : "#c3cad4");
      t.setAttribute("font-weight", state.filter === t.getAttribute("data-lane") ? "700" : "400");
    });
    svg.querySelectorAll("[data-lane-line]").forEach(function (l) {
      l.setAttribute("stroke", state.filter === l.getAttribute("data-lane-line") ? "#dbe4f0" : "#f0f2f7");
    });
    // 泳道刻度（触点）
    svg.querySelectorAll(".lane-tick").forEach(function (n) { n.remove(); });
    changes.forEach(function (c) {
      touches[c.id].forEach(function (eid) {
        var laneIdx = entities.findIndex(function (e) { return e.id === eid; });
        var x = timeToX(c.time), y = LANE_Y0 + laneIdx * LANE_H + 4;
        var r = el("rect", { x: x - 1.4, y: y, width: 2.8, height: 10, rx: 1, fill: D.types[c.type].color, "class": "lane-tick", opacity: 0.85 }, svg);
        var dimmed = (state.filter && state.filter !== eid) || c.time > state.cursorT;
        if (dimmed) r.setAttribute("opacity", 0.18);
        var ti = el("title", {}, r);
        ti.textContent = c.id + " · " + c.title + "（" + fmt(c.time) + "）";
        r.style.cursor = "pointer";
        r.addEventListener("click", function (ev) { ev.stopPropagation(); select(c.id); });
      });
    });
    // 游标读数
    var ro = document.getElementById("cursor-readout");
    ro.innerHTML = "切片时刻 <b>" + fmt(state.cursorT) + "</b>" + (state.filter ? " · 仅看 <b>" + entById[state.filter].name + "</b>" : "");
  }

  /* ---------------- 详情面板（list 支撑：字段级 before→after） ---------------- */
  function changeChip(id) {
    var c = byId[id];
    return '<span class="link" data-jump="' + id + '" title="' + c.title + '（' + fmt(c.time) + '）">' + id + "</span>";
  }
  function renderDetail() {
    var body = document.getElementById("detail-body");
    var nav = document.getElementById("detail-nav");
    var c = state.selectedId ? byId[state.selectedId] : null;
    nav.textContent = c ? "第 " + c.seq + " / " + changes.length + " 项" : "";
    if (!c) {
      body.innerHTML = '<div class="empty"><div class="big">◌</div><div>未选中变更集</div>' +
        '<div>点击时间轴上的节点、连线或触点刻度即可选中；<br>方向键可按时间顺序切换。</div></div>';
      return;
    }
    var t = D.types[c.type];
    var html = "";
    html += '<div class="detail-meta">' +
      '<span class="badge" style="background:' + t.color + '">' + t.label + "</span>" +
      '<span class="cid">' + c.id + "</span>" +
      '<span class="ctime">' + fmt(c.time) + "</span>" +
      '<span class="actor">' + c.actor + "</span></div>";
    html += '<h3 class="title">' + c.title + "</h3>";
    html += '<p class="summary">' + c.summary + "</p>";

    html += '<div class="sec"><div class="sec-t">诱因 · 为什么发生</div>';
    if (c.cause) {
      var pc = byId[c.cause];
      html += '<div class="cause-box"><span class="link" data-jump="' + pc.id + '">' + pc.id + " " + pc.short + "</span>" +
        '<span class="why">' + (c.why || "") + "</span></div>";
    } else {
      html += '<div class="origin-note">外部触发 —— ' + (c.origin || "无内部诱因") + "</div>";
    }
    html += "</div>";

    html += '<div class="sec"><div class="sec-t">变更操作 · 字段级 before → after</div><table class="ops">';
    (c.ops || []).forEach(function (op) {
      var sym = op.op === "add" ? '<span class="sym" style="color:#0ca678">＋</span>' :
        op.op === "remove" ? '<span class="sym" style="color:#e03131">－</span>' :
          '<span class="sym" style="color:#e8890c">～</span>';
      var oldV = op.op === "add" ? '<span class="old" style="text-decoration:none;color:#8a93a3">（新增）</span>' :
        '<span class="old">' + (op._from == null ? "空" : op._from) + "</span>";
      html += "<tr><td class='op-ent'><span class='ent-chip'>" + entById[op.e].name + "</span></td>" +
        "<td class='op-field'>" + (D.fieldLabels[op.k] || op.k) + "</td>" +
        "<td class='op-change'>" + sym + oldV + '<span class="new">' + (op.op === "remove" ? "已移除" : op.to) + "</span></td></tr>";
    });
    html += "</table></div>";

    var kids = children[c.id] || [];
    html += '<div class="sec"><div class="sec-t">' + (kids.length ? "引发的变更 · " + kids.length + " 项" : "引发的变更") + "</div>";
    if (!kids.length) html += '<div class="origin-note">无直接后果 —— 因果链在此终止。</div>';
    kids.forEach(function (kid) {
      var k = byId[kid];
      var l = links.filter(function (x) { return x.from === c.id && x.to === kid; })[0];
      html += '<div class="effect-row" data-jump="' + kid + '"><span class="link">' + kid + " " + k.short + "</span>" +
        '<span class="why">' + (l ? l.why : "") + "</span></div>";
    });
    html += "</div>";
    body.innerHTML = html;
    body.querySelectorAll("[data-jump]").forEach(function (n) {
      n.addEventListener("click", function (ev) { ev.stopPropagation(); select(n.getAttribute("data-jump")); });
    });
  }

  /* ---------------- 状态切片（table 支撑；fold 的呈现） ---------------- */
  function renderSnapshot() {
    var body = document.getElementById("snapshot-body");
    var st = stateAt(state.cursorT);
    var applied = changes.filter(function (c) { return c.time <= state.cursorT; });
    var pending = changes.length - applied.length;
    var last = applied[applied.length - 1];
    var html = '<div class="snap-head">' +
      '<span class="snap-time">' + fmt(state.cursorT) + "</span>" +
      '<span class="snap-source">' + (last
        ? "最近生效 <b>" + last.id + " " + last.short + "</b>"
        : "尚无变更生效") +
      (pending ? " · 此后 " + pending + " 项未生效" : "") + "</span></div>";
    entities.forEach(function (e) {
      var dim = state.filter && state.filter !== e.id;
      html += '<div class="ent-card' + (dim ? " dim" : "") + '"><div class="ent-head">' +
        '<span class="ent-name">' + e.name + '</span><span class="ent-group">' + e.group + "</span></div>";
      Object.keys(st[e.id]).forEach(function (k) {
        var cell = st[e.id][k];
        var touched = state.selectedId && cell.by === state.selectedId;
        html += '<div class="field-row' + (touched ? " touched" : "") + '">' +
          '<span class="fk">' + (D.fieldLabels[k] || k) + "</span>" +
          '<span class="fv">' + (touched && byId[cell.by] ?
            (function () {
              var op = byId[cell.by].ops.filter(function (o) { return o.e === e.id && o.k === k; })[0];
              return (op && op.op !== "add" && op._from != null ? '<span class="old">' + op._from + "</span>" : "") +
                '<span class="new">' + cell.v + "</span>";
            })() : (cell.v == null ? "已移除" : cell.v)) + "</span>" +
          (cell.by ? '<span class="fb" data-jump="' + cell.by + '" title="由 ' + byId[cell.by].title + "（" + fmt(cell.at) + '）设置">' + cell.by + "</span>" : '<span class="fb" title="初始状态（Q2 起点）">init</span>') +
          "</div>";
      });
      html += "</div>";
    });
    body.innerHTML = html;
    body.querySelectorAll("[data-jump]").forEach(function (n) {
      n.addEventListener("click", function (ev) { ev.stopPropagation(); select(n.getAttribute("data-jump")); });
    });
  }

  /* ---------------- 选中 / 游标 / 过滤 ---------------- */
  function select(id, moveCursor) {
    state.selectedId = id;
    // 选中即把游标带到该变更生效时刻：切片、详情因果与时间轴三者对齐
    if (id && moveCursor !== false) state.cursorT = byId[id].time;
    updateAll();
  }
  function updateAll() { updateCanvas(); renderDetail(); renderSnapshot(); }

  function setFilter(id) {
    state.filter = id;
    document.querySelectorAll("#toolbar .chip").forEach(function (ch) {
      ch.classList.toggle("active", ch.getAttribute("data-entity") === (id || ""));
    });
    updateAll();
  }

  // 游标拖拽 / 点击画布移动游标
  function clientToSvgX(clientX) {
    var pt = svg.createSVGPoint(); pt.x = clientX; pt.y = 0;
    var m = svg.getScreenCTM().inverse(); return pt.matrixTransform(m).x;
  }
  var dragging = false;
  function moveCursorTo(clientX) {
    var x = Math.min(X1, Math.max(X0, clientToSvgX(clientX)));
    state.cursorT = xToTime(x);
    updateAll();
  }
  svg.addEventListener("pointerdown", function (ev) {
    if (ev.target.closest(".node") || ev.target.closest(".edge")) return; // 节点/连线有点击语义
    dragging = true;
    svg.setPointerCapture(ev.pointerId);
    moveCursorTo(ev.clientX);
  });
  svg.addEventListener("pointermove", function (ev) { if (dragging) moveCursorTo(ev.clientX); });
  svg.addEventListener("pointerup", function () { dragging = false; });

  /* ---------------- 播放 ---------------- */
  var playBtn = document.getElementById("play-btn");
  playBtn.addEventListener("click", function () {
    if (state.playing) { stopPlay(); return; }
    var idx = changes.findIndex(function (c) { return c.time > state.cursorT; });
    if (idx < 0) idx = 0;
    playBtn.textContent = "⏸ 暂停";
    playBtn.classList.add("primary");
    state.playing = setInterval(function () {
      if (idx >= changes.length) { stopPlay(); return; }
      var c = changes[idx++];
      state.selectedId = c.id; state.cursorT = c.time;
      updateAll();
      if (idx >= changes.length) stopPlay();
    }, 1400);
  });
  function stopPlay() {
    if (state.playing) clearInterval(state.playing);
    state.playing = null;
    playBtn.textContent = "▶ 播放";
    playBtn.classList.remove("primary");
  }

  /* ---------------- 键盘契约（1 个：时间轴导航） ---------------- */
  document.addEventListener("keydown", function (ev) {
    if (ev.target && /INPUT|TEXTAREA/.test(ev.target.tagName)) return;
    var idx = changes.findIndex(function (c) { return c.id === state.selectedId; });
    if (ev.key === "ArrowRight") { select(changes[Math.min(changes.length - 1, idx + 1)].id); ev.preventDefault(); }
    else if (ev.key === "ArrowLeft") { select(changes[Math.max(0, idx - 1)].id); ev.preventDefault(); }
    else if (ev.key === "c" || ev.key === "C") { if (state.selectedId && causeOf[state.selectedId]) select(causeOf[state.selectedId]); }
    else if (ev.key === "e" || ev.key === "E") { var k = children[state.selectedId]; if (k && k.length) select(k[0]); }
    else if (ev.key === "Escape") { state.selectedId = null; stopPlay(); updateAll(); }
  });

  /* ---------------- 图例 / chips / footer ---------------- */
  function buildChrome() {
    var lg = document.getElementById("legend");
    Object.keys(D.types).forEach(function (tk) {
      lg.insertAdjacentHTML("beforeend",
        '<span class="lg"><span class="dot" style="background:' + D.types[tk].color + '"></span>' +
        D.types[tk].label + " " + changes.filter(function (c) { return c.type === tk; }).length + "</span>");
    });
    var bar = document.getElementById("toolbar");
    var chips = document.createElement("span");
    chips.innerHTML = '<button class="chip active" data-entity="">全部</button>' +
      entities.map(function (e) {
        return '<button class="chip" data-entity="' + e.id + '">' + e.name + "</button>";
      }).join("");
    // 插到 spacer 之前（先静态化集合再移动，避免 live collection 跳元素）
    var spacer = bar.querySelector(".spacer");
    Array.prototype.slice.call(chips.children).forEach(function (b) { bar.insertBefore(b, spacer); });
    bar.querySelectorAll(".chip").forEach(function (ch) {
      ch.addEventListener("click", function () { setFilter(ch.getAttribute("data-entity") || null); });
    });
    document.getElementById("stat-counts").innerHTML =
      "<b>" + changes.length + "</b> 个变更集 · <b>" + entities.length + "</b> 个组件 · <b>" + links.length + "</b> 条因果链 · 5 个阶段 · 2026-04-01 → 06-30";
    var integ = document.getElementById("stat-integrity");
    if (integrityErrors.length) {
      integ.innerHTML = '<span style="color:#e03131;font-weight:650">完整性校验失败：' + integrityErrors.length + " 处</span>";
    } else {
      integ.innerHTML = '完整性校验：<span class="ok">因果方向与时间顺序一致 ✓</span>';
    }
  }

  function renderError() {
    var wrap = document.querySelector(".canvas-wrap");
    wrap.innerHTML = '<div class="error-banner"><h2>数据完整性校验失败</h2><ul>' +
      integrityErrors.map(function (e) { return "<li>" + e + "</li>"; }).join("") +
      "</ul></div>";
    document.getElementById("detail-body").innerHTML =
      '<div class="empty"><div class="big">⚠</div><div>数据存在完整性问题，已阻断渲染。</div></div>';
    document.getElementById("snapshot-body").innerHTML =
      '<div class="empty"><div class="big">⚠</div><div>状态切片不可用。</div></div>';
  }

  /* ---------------- 深链参数（可复现的交互状态，也用于取证） ---------------- */
  function applyDeepLink() {
    var qs = new URLSearchParams(location.search);
    if (qs.get("sel") && byId[qs.get("sel")]) state.selectedId = qs.get("sel");
    if (qs.get("cursor")) {
      var cc = byId[qs.get("cursor")];
      var parsed = Date.parse(qs.get("cursor"));
      if (cc) state.cursorT = cc.time;
      else if (!isNaN(parsed)) state.cursorT = parsed;
    } else if (qs.get("sel") && byId[qs.get("sel")]) {
      state.cursorT = byId[qs.get("sel")].time;
    }
    if (qs.get("filter") && entById[qs.get("filter")]) setFilter(qs.get("filter"));
    if (qs.get("empty") === "1") state.selectedId = null;
  }

  /* ---------------- 页内自检（?selftest=1 时运行；语义一致性证据） ---------------- */
  function runSelfTest() {
    var qs = new URLSearchParams(location.search);
    if (qs.get("selftest") !== "1") return;
    var results = [];
    function eq(name, actual, expect) {
      results.push((String(actual) === String(expect) ? "PASS" : "FAIL") + " " + name +
        (String(actual) === String(expect) ? "" : "（got=" + actual + " want=" + expect + "）"));
    }
    // mc1：全部因果链方向与时间一致
    var fwd = links.filter(function (l) { return byId[l.from].time < byId[l.to].time; }).length;
    eq("forward_only_links", fwd + "/" + links.length, links.length + "/" + links.length);
    // mc2：切片 = 折叠，关键时刻语义正确
    eq("state@incident_gateway_status", stateAt(byId.c16.time)["payment-gateway"].status.v, "超时降级");
    eq("state@before_incident_gateway_status", stateAt(byId.c15.time)["payment-gateway"].status.v, "正常");
    eq("state@c18_gateway_replicas", stateAt(byId.c18.time)["payment-gateway"].replicas.v, "12");
    eq("state@end_gateway_breaker(add_op)", stateAt(T1)["payment-gateway"].breaker.v, "自动熔断（渠道级）");
    eq("state@end_one_click_buy", stateAt(T1)["feature-flags"].one_click_buy.v, "100% 全量");
    eq("state@q2_start_dedup", stateAt(byId.c01.time)["inventory-service"].dedup.v, "关闭");
    eq("state@after_c02_dedup", stateAt(byId.c04.time)["inventory-service"].dedup.v, "压测演练模式");
    // 详情 before 与切片同源（c19 恢复渠道时，前一状态应为止血后的仅微信）
    var op19 = byId.c19.ops.filter(function (o) { return o.k === "provider"; })[0];
    eq("detail_before_same_fold_source", op19._from, "仅微信（支付宝暂闭）");
    // 渲染计数
    eq("nodes_rendered", svg.querySelectorAll(".node").length, changes.length);
    eq("edges_rendered", svg.querySelectorAll(".edge").length, links.length);
    // 键盘契约：→ 选择后继，← 返回，Esc 清除（empty 态）
    var before = state.selectedId;
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    var afterRight = state.selectedId;
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
    eq("keyboard_right_then_left", afterRight + "|" + state.selectedId,
      changes[byId[before].seq - 1 + 1].id + "|" + before);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    eq("keyboard_escape_empty_state", state.selectedId, "null");
    // 恢复
    state.selectedId = "c16"; state.cursorT = byId.c16.time; updateAll();
    boot("SELFTEST " + (results.some(function (r) { return r.indexOf("FAIL") === 0; }) ? "FAIL" : "PASS") +
      " " + results.length + " checks :: " + results.join(" | "));
  }

  /* ---------------- 启动：首屏即就绪（无加载态） ---------------- */
  buildChrome();
  if (integrityErrors.length) { renderError(); boot("INTEGRITY-FAIL: " + integrityErrors.join("; ")); return; }
  build();
  applyDeepLink();
  updateAll();
  runSelfTest();
  if (!document.getElementById("boot-status").textContent) {
    boot("READY changes=" + changes.length + " links=" + links.length + " entities=" + entities.length +
      " integrity=ok selected=" + (state.selectedId || "none"));
  }
})();
