/* =====================================================================
 * AURORA 变更时间轴 — 应用逻辑（原生 JS，经典脚本，file:// 可直接打开）
 *
 * 状态所有权（与 SDIR 一致）：
 *   timeline 拥有 selection 与 viewport(时间游标)；toolbar 拥有 query(过滤)；
 *   inspector / snapshot 为 selection 与 viewport 的投影。
 * 折叠语义：stateAt(k) = initialState 依序应用 events[0..k]（后者覆盖同字段）。
 * ===================================================================== */
(function () {
  "use strict";

  var DATA = window.DATA;
  var EVT = DATA.eventTypes, FLD = DATA.fields, HLT = DATA.healthStates;
  var COMPS = DATA.components, EVENTS = DATA.events;

  /* ---------- 应用状态 ---------- */
  var state = {
    cursorIdx: EVENTS.length - 1,     // viewport：游标所在事件下标（-1 = 窗口起点）
    selectedId: "e06",                // selection：默认选中因果枢纽事件
    typeOn: {},                       // query：类型过滤（默认全开）
    compFilter: "all"                 // query：组件过滤
  };
  Object.keys(EVT).forEach(function (t) { state.typeOn[t] = true; });

  /* ---------- 工具 ---------- */
  function $(id) { return document.getElementById(id); }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function parseTs(ts) { return new Date(ts); }
  function fmtHM(ts) { var d = parseTs(ts); return pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + " " + pad(d.getHours()) + ":" + pad(d.getMinutes()); }
  function fmtTime(ts) { var d = parseTs(ts); return pad(d.getHours()) + ":" + pad(d.getMinutes()); }
  function compName(id) { for (var i = 0; i < COMPS.length; i++) if (COMPS[i].id === id) return COMPS[i].name; return id; }
  function evById(id) { for (var i = 0; i < EVENTS.length; i++) if (EVENTS[i].id === id) return EVENTS[i]; return null; }
  function evIndex(id) { for (var i = 0; i < EVENTS.length; i++) if (EVENTS[i].id === id) return i; return -1; }
  function fmtVal(field, v) {
    var meta = FLD[field] || {};
    if (meta.health && HLT[v]) return null; /* 健康度走彩色渲染 */
    if (meta.bool) return v ? "开" : "关";
    return String(v);
  }
  /* 带彩色字形的标记：字形吃 --mark，文本吃 ink 令牌 */
  function markEl(tag, cls, glyph, text) {
    var n = el(tag, cls);
    n.appendChild(el("span", "g", glyph));
    n.appendChild(document.createTextNode(text));
    return n;
  }

  /* ---------- 数据自检（验收种子：时间结构与变更语义一致） ---------- */
  var boot = (function validateData() {
    var errors = [], edges = 0, fromMatches = 0, changes = 0;
    /* 折叠模拟在深拷贝上进行，绝不触碰真正的 initialState */
    var sim = {};
    COMPS.forEach(function (c) { sim[c.id] = Object.assign({}, DATA.initialState[c.id]); });
    for (var i = 0; i < EVENTS.length; i++) {
      var ev = EVENTS[i];
      if (i > 0 && !(parseTs(EVENTS[i - 1].ts) < parseTs(ev.ts)))
        errors.push(ev.id + " 时间戳非严格递增");
      (ev.causes || []).forEach(function (cid) {
        edges++;
        var c = evById(cid);
        if (!c) errors.push(ev.id + " 的起因 " + cid + " 不存在");
        else if (!(parseTs(c.ts) < parseTs(ev.ts)))
          errors.push("因果边 " + cid + "→" + ev.id + " 逆时间");
      });
      (ev.changes || []).forEach(function (ch) {
        changes++;
        var cur = sim[ch.component];
        if (!cur) { errors.push(ev.id + " 引用未知组件 " + ch.component); return; }
        if (!(ch.field in cur)) { errors.push(ev.id + " 引用未知字段 " + ch.component + "." + ch.field); return; }
        if (cur[ch.field] === ch.from) { fromMatches++; }
        else errors.push(ev.id + " 变更 " + ch.component + "." + ch.field + " 前值与折叠不符");
        cur[ch.field] = ch.to;
      });
    }
    return { ok: errors.length === 0, errors: errors, events: EVENTS.length, edges: edges, changes: changes, fromMatches: fromMatches };
  })();

  /* ---------- 折叠：游标处的状态快照 ---------- */
  function stateAt(idx) {
    var s = {};
    COMPS.forEach(function (c) {
      s[c.id] = JSON.parse(JSON.stringify(DATA.initialState[c.id]));
    });
    for (var i = 0; i <= idx && i < EVENTS.length; i++) {
      EVENTS[i].changes.forEach(function (ch) { s[ch.component][ch.field] = ch.to; });
    }
    return s;
  }
  function ledToMap() {
    var m = {};
    EVENTS.forEach(function (ev) {
      (ev.causes || []).forEach(function (cid) {
        (m[cid] = m[cid] || []).push(ev.id);
      });
    });
    return m;
  }
  var LED = ledToMap();

  /* 选中事件的因果链闭包（沿 causes 边双向传递） */
  function chainOf(id) {
    var set = {}, frontier = [id];
    set[id] = true;
    while (frontier.length) {
      var cur = frontier.pop();
      (evById(cur).causes || []).forEach(function (c) { if (!set[c]) { set[c] = true; frontier.push(c); } });
      (LED[cur] || []).forEach(function (n) { if (!set[n]) { set[n] = true; frontier.push(n); } });
    }
    return set;
  }

  /* ---------- 渲染：时间轴 ---------- */
  var rowEls = {};       /* id -> row element */
  var nodeEls = {};      /* id -> rail node element */
  var edgeEls = [];      /* {from,to,path} */

  function typeCls(ev) { return EVT[ev.type].channel === "cat" ? "cat" + EVT[ev.type].slot : "st-" + EVT[ev.type].status; }

  function visible(ev) {
    return state.typeOn[ev.type] &&
      (state.compFilter === "all" || ev.changes.some(function (c) { return c.component === state.compFilter; }));
  }

  function chip(targetId, dir) {
    var t = evById(targetId);
    var b = el("button", "chip " + (dir === "cause" ? "chip-cause" : "chip-lead"));
    b.tabIndex = -1; /* 行内因果 chips 不进 Tab 序：↑/↓ 选中 + 检查器方向键漫游负责键盘可达 */
    b.textContent = dir === "cause" ? "◀ " + targetId : targetId + " ▶";
    b.title = (dir === "cause" ? "起因：" : "导致：") + t.title;
    b.setAttribute("aria-label", b.title);
    b.addEventListener("click", function (e) {
      e.stopPropagation();
      if (!visible(t)) resetFilters();           /* 目标被过滤隐藏时先还原过滤，保证可达 */
      select(targetId, true);
    });
    return b;
  }

  function renderTimeline() {
    var canvas = $("tlCanvas");
    canvas.querySelectorAll(".day-group").forEach(function (n) { n.remove(); });
    rowEls = {}; nodeEls = {};

    var groups = [];
    EVENTS.forEach(function (ev, i) {
      var key = ev.ts.slice(0, 10);
      if (!groups.length || groups[groups.length - 1].key !== key) {
        groups.push({ key: key, items: [] });
      }
      groups[groups.length - 1].items.push({ ev: ev, idx: i });
    });

    groups.forEach(function (g) {
      var gd = el("div", "day-group");
      var head = el("div", "day-head");
      var h3 = el("h3", null, g.key.slice(5).replace("-", "/"));
      var wk = el("span", "day-sub");
      var d = parseTs(g.key + "T12:00:00+08:00");
      wk.textContent = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][d.getDay()];
      head.appendChild(el("span", "day-dot"));
      head.appendChild(h3);
      head.appendChild(wk);
      gd.appendChild(head);

      g.items.forEach(function (it) {
        var ev = it.ev;
        var row = el("article", "ev");
        row.dataset.id = ev.id;
        row.tabIndex = -1; /* 列表框模式：仅选中行可 Tab，↑/↓ 漫游 */
        row.setAttribute("role", "button");
        row.setAttribute("aria-pressed", "false");

        var rail = el("div", "ev-rail");
        var node = el("span", "node " + typeCls(ev));
        node.textContent = EVT[ev.type].glyph;
        rail.appendChild(node);

        var main = el("div", "ev-main");
        var l1 = el("div", "ev-line1");
        l1.appendChild(el("time", null, fmtTime(ev.ts)));
        l1.appendChild(markEl("span", "badge " + typeCls(ev), EVT[ev.type].glyph, EVT[ev.type].label));
        l1.appendChild(el("span", "ev-title", ev.title));

        var l2 = el("div", "ev-line2");
        ev.changes.forEach(function (c) {
          var cc = el("span", "chip chip-comp", compName(c.component));
          cc.title = c.component + "." + c.field;
          l2.appendChild(cc);
        });
        (ev.causes || []).forEach(function (cid) { l2.appendChild(chip(cid, "cause")); });
        (LED[ev.id] || []).forEach(function (lid) { l2.appendChild(chip(lid, "lead")); });

        main.appendChild(l1);
        main.appendChild(l2);
        row.appendChild(rail);
        row.appendChild(main);

        row.addEventListener("click", function () { select(ev.id, false); });
        row.addEventListener("keydown", function (e) {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); select(ev.id, false); }
        });

        gd.appendChild(row);
        rowEls[ev.id] = row;
        nodeEls[ev.id] = node;
      });
      canvas.appendChild(gd);
    });

    $("tlCount").textContent = EVENTS.length + " 个事件 · " + boot.edges + " 条因果边";
    applyFilters();
    requestAnimationFrame(function () { drawEdges(); applySelectionClasses(); });
  }

  /* ---------- 因果连线（时间下游方向恒为正） ---------- */
  function drawEdges() {
    var svg = $("edgeSvg");
    var canvas = $("tlCanvas");
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    edgeEls = [];
    var crect = canvas.getBoundingClientRect();
    var NS = "http://www.w3.org/2000/svg";
    svg.setAttribute("width", crect.width);
    svg.setAttribute("height", crect.height);

    var defs = document.createElementNS(NS, "defs");
    [["arrMuted", "#898781"], ["arrActive", "#3987e5"]].forEach(function (m) {
      var mk = document.createElementNS(NS, "marker");
      mk.setAttribute("id", m[0]); mk.setAttribute("viewBox", "0 0 8 8");
      mk.setAttribute("refX", "6"); mk.setAttribute("refY", "4");
      mk.setAttribute("markerWidth", "6"); mk.setAttribute("markerHeight", "6");
      mk.setAttribute("orient", "auto-start-reverse");
      var p = document.createElementNS(NS, "path");
      p.setAttribute("d", "M0,0 L8,4 L0,8 z");
      p.setAttribute("fill", m[1]);
      mk.appendChild(p); defs.appendChild(mk);
    });
    svg.appendChild(defs);

    var slot = 0;
    EVENTS.forEach(function (ev) {
      (ev.causes || []).forEach(function (cid) {
        var a = nodeEls[cid], b = nodeEls[ev.id];
        var ra = rowEls[cid], rb = rowEls[ev.id];
        if (!a || !b || !ra || !rb) return;
        if (ra.classList.contains("hidden") || rb.classList.contains("hidden")) return; /* 被过滤隐藏 */
        var ar = a.getBoundingClientRect(), br = b.getBoundingClientRect();
        var x = ar.left - crect.left + ar.width / 2; /* 节点中心（含画布内边距） */
        var y1 = ar.top - crect.top + ar.height / 2;
        var y2 = br.top - crect.top + br.height / 2;
        if (y2 - y1 < 24) return; /* 过近的边由行内 chips 表达 */
        var bx = x - (13 + (slot++ % 3) * 6);
        var path = document.createElementNS(NS, "path");
        path.setAttribute("d", "M" + x + "," + y1 + " C" + bx + "," + y1 + " " + bx + "," + y2 + " " + x + "," + y2);
        path.setAttribute("class", "edge");
        path.setAttribute("marker-end", "url(#arrMuted)");
        path.dataset.from = cid; path.dataset.to = ev.id;
        path.classList.toggle("future-edge",
          evIndex(ev.id) > state.cursorIdx || evIndex(cid) > state.cursorIdx);
        svg.appendChild(path);
        edgeEls.push(path);
      });
    });
  }

  /* ---------- 选中与因果链高亮 ---------- */
  function applySelectionClasses() {
    var sel = state.selectedId ? evById(state.selectedId) : null;
    var chain = sel ? chainOf(sel.id) : null;
    var canvas = $("tlCanvas");
    canvas.classList.toggle("chain-on", !!chain);
    Object.keys(rowEls).forEach(function (id) {
      var on = !!(chain && chain[id]); /* 必须布尔化：undefined 会令 toggle 变为翻转 */
      rowEls[id].classList.toggle("selected", id === state.selectedId);
      rowEls[id].classList.toggle("in-chain", on);
      rowEls[id].setAttribute("aria-pressed", id === state.selectedId ? "true" : "false");
    });
    edgeEls.forEach(function (p) {
      var active = !!(chain && chain[p.dataset.from] && chain[p.dataset.to]);
      p.classList.toggle("edge-active", active);
      p.setAttribute("marker-end", active ? "url(#arrActive)" : "url(#arrMuted)");
    });
    /* 列表框漫游：唯一可 Tab 行 = 选中行（无选中时取首个可见行） */
    var tabId = state.selectedId && rowEls[state.selectedId] ? state.selectedId : null;
    if (!tabId) {
      for (var vi = 0; vi < EVENTS.length; vi++) {
        if (visible(EVENTS[vi])) { tabId = EVENTS[vi].id; break; }
      }
    }
    Object.keys(rowEls).forEach(function (id) {
      rowEls[id].tabIndex = id === tabId ? 0 : -1;
    });
    renderInspector();
  }

  function select(id, scroll) {
    state.selectedId = id;
    applySelectionClasses();
    if (scroll && rowEls[id]) {
      rowEls[id].scrollIntoView({ block: "center", behavior: "smooth" });
    }
    if (id) {
      var idx = evIndex(id);
      if (idx <= state.cursorIdx) markSnapshotHot(); else renderSnapshot();
    }
  }

  /* ---------- 检查器 ---------- */
  function renderInspector() {
    var box = $("inspectorBody");
    box.textContent = "";
    var ev = state.selectedId ? evById(state.selectedId) : null;
    if (!ev) {
      var g = el("div", "ins-guide");
      g.appendChild(el("p", null, "未选中事件。点击时间轴中的任意变更事件，即可查看其字段级改动（前值 → 后值）与因果上下文。"));
      g.appendChild(el("p", "muted", "键盘：↑ / ↓ 浏览事件 · C 将游标对齐选中事件 · Esc 取消选择"));
      box.appendChild(g);
      return;
    }
    var head = el("div", "ins-head");
    head.appendChild(markEl("span", "badge " + typeCls(ev), EVT[ev.type].glyph, EVT[ev.type].label));
    var h3 = el("h3", null, ev.title);
    head.appendChild(h3);
    box.appendChild(head);

    box.appendChild(el("div", "ins-meta", fmtHM(ev.ts) + " · 操作 " + ev.actor + " · 工单 " + ev.ticket));
    box.appendChild(el("p", "ins-detail", ev.detail));

    /* 变更明细 */
    var sec = el("section", "ins-sec");
    sec.appendChild(el("h4", null, "变更明细"));
    var tbl = el("table", "diff-table");
    ev.changes.forEach(function (c) {
      var tr = el("tr");
      tr.appendChild(el("td", "td-comp", compName(c.component)));
      tr.appendChild(el("td", "td-field", (FLD[c.field] || {}).label || c.field));
      var td = el("td", "td-diff");
      var from = fmtVal(c.field, c.from);
      if (from == null) {
        var hs = HLT[c.from];
        td.appendChild(markEl("s", "hv st-" + hs.status, hs.glyph, hs.label));
      } else td.appendChild(el("s", null, from));
      td.appendChild(el("span", "arrow", " → "));
      if (FLD[c.field] && FLD[c.field].health) {
        var h2 = HLT[c.to];
        td.appendChild(markEl("b", "hv st-" + h2.status, h2.glyph, h2.label));
      } else td.appendChild(el("b", null, fmtVal(c.field, c.to)));
      tr.appendChild(td);
      tbl.appendChild(tr);
    });
    sec.appendChild(tbl);
    box.appendChild(sec);

    /* 因果上下文 */
    var sec2 = el("section", "ins-sec");
    sec2.appendChild(el("h4", null, "因果上下文"));
    var rowC = el("div", "ins-cause-row");
    rowC.appendChild(el("span", "ins-label", "起因"));
    var cwrap = el("div", "ins-chips");
    if (!(ev.causes || []).length) cwrap.appendChild(el("span", "muted", "无 — 窗口内无上游事件"));
    (ev.causes || []).forEach(function (cid) {
      var t = evById(cid);
      var b = el("button", "chip chip-cause");
      b.textContent = "◀ " + cid + " " + EVT[t.type].label;
      b.title = t.title;
      b.addEventListener("click", function () {
        if (!visible(t)) resetFilters();
        select(cid, true);
      });
      cwrap.appendChild(b);
    });
    rowC.appendChild(cwrap);
    sec2.appendChild(rowC);

    var rowL = el("div", "ins-cause-row");
    rowL.appendChild(el("span", "ins-label", "导致"));
    var lwrap = el("div", "ins-chips");
    if (!(LED[ev.id] || []).length) lwrap.appendChild(el("span", "muted", "无 — 该事件在窗口内无下游后果"));
    (LED[ev.id] || []).forEach(function (lid) {
      var t = evById(lid);
      var b = el("button", "chip chip-lead");
      b.textContent = lid + " " + EVT[t.type].label + " ▶";
      b.title = t.title;
      b.addEventListener("click", function () {
        if (!visible(t)) resetFilters();
        select(lid, true);
      });
      lwrap.appendChild(b);
    });
    rowL.appendChild(lwrap);
    sec2.appendChild(rowL);

    var note = el("p", "muted ins-note");
    var chainIds = Object.keys(chainOf(ev.id)).filter(function (k) { return k !== ev.id; }).sort();
    note.textContent = "因果链共 " + chainIds.length + " 个关联事件，已在时间轴中连线高亮；连线方向与时间正方向一致。";
    sec2.appendChild(note);
    box.appendChild(sec2);

    var align = el("button", "btn-align");
    align.textContent = "⇥ 将游标对齐此事件（快照折叠到 " + fmtTime(ev.ts) + "）";
    align.addEventListener("click", function () { setCursor(evIndex(ev.id)); });
    box.appendChild(align);

    /* 检查器是单一 Tab 停靠点（容器），内部按钮经方向键漫游 */
    box.querySelectorAll("button").forEach(function (b) { b.tabIndex = -1; });
  }

  /* ---------- 游标与快照 ---------- */
  function setCursor(idx) {
    state.cursorIdx = Math.max(-1, Math.min(EVENTS.length - 1, idx));
    $("cursorRange").value = String(state.cursorIdx);
    updateCursor();
  }

  function updateCursor() {
    var idx = state.cursorIdx;
    var label, folded;
    if (idx < 0) { label = "窗口起点 · 初始状态"; folded = "已折叠 0/" + EVENTS.length; }
    else {
      var ev = EVENTS[idx];
      label = fmtHM(ev.ts) + " · " + ev.id + " " + EVT[ev.type].label;
      folded = "已折叠 " + (idx + 1) + "/" + EVENTS.length;
    }
    $("cursorLabel").textContent = label;
    $("foldCount").textContent = folded;
    Object.keys(rowEls).forEach(function (id) {
      rowEls[id].classList.toggle("future", evIndex(id) > idx);
    });
    edgeEls.forEach(function (p) {
      p.classList.toggle("future-edge", evIndex(p.dataset.to) > idx || evIndex(p.dataset.from) > idx);
    });
    renderSnapshot();
  }

  function healthPill(v) {
    var h = HLT[v];
    return markEl("span", "pill st-" + h.status, h.glyph, h.label);
  }

  function renderSnapshot() {
    var s = stateAt(state.cursorIdx);
    var sel = state.selectedId ? evById(state.selectedId) : null;
    var selApplicable = !!sel && evIndex(sel.id) <= state.cursorIdx;
    $("snapAt").textContent = "游标 " + (state.cursorIdx < 0 ? "窗口起点" : fmtHM(EVENTS[state.cursorIdx].ts));
    var box = $("snapshotBody");
    box.textContent = "";

    if (sel && !selApplicable) {
      box.appendChild(el("div", "snap-note", "选中事件 " + sel.id + " 在游标之后，当前快照未包含其变更。"));
    } else if (sel) {
      box.appendChild(el("div", "snap-note muted", "高亮行 = 选中事件 " + sel.id + " 的改动（前值 → 后值）。"));
    }

    COMPS.forEach(function (c) {
      var block = el("div", "comp");
      var head = el("div", "comp-head");
      head.appendChild(el("span", "comp-name", c.name));
      head.appendChild(healthPill(s[c.id].health));
      block.appendChild(head);

      var tbl = el("table", "snap-table");
      Object.keys(DATA.initialState[c.id]).forEach(function (f) {
        if (f === "health") return;
        var tr = el("tr");
        tr.appendChild(el("td", "td-field", (FLD[f] || {}).label || f));
        var td = el("td", "td-val");
        td.textContent = fmtVal(f, s[c.id][f]);
        tr.appendChild(td);
        if (sel && selApplicable) {
          var hit = sel.changes.some(function (ch) { return ch.component === c.id && ch.field === f; });
          if (hit) {
            tr.classList.add("hot");
            var ch2 = sel.changes.filter(function (ch) { return ch.component === c.id && ch.field === f; })[0];
            td.textContent = "";
            td.appendChild(el("s", null, fmtVal(f, ch2.from)));
            td.appendChild(el("span", "arrow", " → "));
            td.appendChild(el("b", null, fmtVal(f, ch2.to)));
          }
        }
        tbl.appendChild(tr);
      });
      /* 健康度行 */
      var trh = el("tr");
      trh.appendChild(el("td", "td-field", "健康度"));
      var tdh = el("td", "td-val");
      var healthHit = sel && selApplicable && sel.changes.some(function (ch) { return ch.component === c.id && ch.field === "health"; });
      if (healthHit) {
        trh.classList.add("hot");
        var chh = sel.changes.filter(function (ch) { return ch.component === c.id && ch.field === "health"; })[0];
        tdh.appendChild(markEl("s", "hv st-" + HLT[chh.from].status, HLT[chh.from].glyph, HLT[chh.from].label));
        tdh.appendChild(el("span", "arrow", " → "));
        tdh.appendChild(markEl("b", "hv st-" + HLT[chh.to].status, HLT[chh.to].glyph, HLT[chh.to].label));
      } else {
        tdh.appendChild(healthPill(s[c.id].health));
      }
      trh.appendChild(tdh);
      tbl.appendChild(trh);

      block.appendChild(tbl);
      box.appendChild(block);
    });
  }

  function markSnapshotHot() { renderSnapshot(); }

  /* ---------- 过滤 ---------- */
  function applyFilters() {
    var shown = 0;
    EVENTS.forEach(function (ev) {
      var v = visible(ev);
      rowEls[ev.id].classList.toggle("hidden", !v);
      if (v) shown++;
    });
    $("tlShown").textContent = "显示 " + shown + "/" + EVENTS.length;
    $("tlEmpty").classList.toggle("hidden", shown !== 0);
    document.querySelectorAll("#tlCanvas .day-group").forEach(function (g) {
      var any = g.querySelectorAll(".ev:not(.hidden)").length > 0;
      g.classList.toggle("hidden", !any);
    });
    document.querySelectorAll(".tchip").forEach(function (b) {
      b.classList.toggle("on", !!state.typeOn[b.dataset.type]);
      b.setAttribute("aria-pressed", b.classList.contains("on") ? "true" : "false");
    });
    $("compSelect").value = state.compFilter;
    requestAnimationFrame(function () { drawEdges(); applySelectionClasses(); });
  }

  function resetFilters() {
    Object.keys(EVT).forEach(function (t) { state.typeOn[t] = true; });
    state.compFilter = "all";
    applyFilters();
  }

  /* ---------- 启动 ---------- */
  function buildToolbar() {
    var wrap = $("typeChips");
    var counts = {};
    EVENTS.forEach(function (ev) { counts[ev.type] = (counts[ev.type] || 0) + 1; });
    Object.keys(EVT).forEach(function (t) {
      var b = el("button", "tchip on");
      b.dataset.type = t;
      b.setAttribute("aria-pressed", "true");
      var g = el("span", "glyph " + typeCls({ type: t }), EVT[t].glyph);
      b.appendChild(g);
      b.appendChild(document.createTextNode(EVT[t].label + " "));
      b.appendChild(el("span", "cnt", String(counts[t] || 0)));
      b.addEventListener("click", function () {
        state.typeOn[t] = !state.typeOn[t];
        applyFilters();
      });
      wrap.appendChild(b);
    });
    var sel = $("compSelect");
    var optAll = el("option", null, "全部组件");
    optAll.value = "all";
    sel.appendChild(optAll);
    COMPS.forEach(function (c) {
      var o = el("option", null, c.name);
      o.value = c.id;
      sel.appendChild(o);
    });
    sel.addEventListener("change", function () { state.compFilter = sel.value; applyFilters(); });
    $("resetFilters").addEventListener("click", resetFilters);
  }

  function initCursorBox() {
    var r = $("cursorRange");
    r.min = "-1"; r.max = String(EVENTS.length - 1); r.step = "1";
    r.value = String(state.cursorIdx);
    r.addEventListener("input", function () { setCursor(parseInt(r.value, 10)); });
    $("cursorStart").addEventListener("click", function () { setCursor(-1); });
    $("cursorEnd").addEventListener("click", function () { setCursor(EVENTS.length - 1); });
    $("cursorToSel").addEventListener("click", function () {
      if (state.selectedId) setCursor(evIndex(state.selectedId));
    });
  }

  function initKeyboard() {
    /* 检查器面板：单一 Tab 停靠点 + 方向键漫游内部 chips（不与全局选择冲突） */
    var panel = $("inspectorPanel");
    panel.addEventListener("keydown", function (e) {
      if (["ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft"].indexOf(e.key) === -1) return;
      var btns = Array.prototype.slice.call(panel.querySelectorAll("button"))
        .filter(function (b) { return b.offsetParent !== null; });
      if (!btns.length) return;
      e.preventDefault();
      e.stopPropagation();
      var idx = btns.indexOf(document.activeElement);
      var delta = e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : -1;
      btns[(idx + delta + btns.length) % btns.length].focus();
    });

    document.addEventListener("keydown", function (e) {
      var t = e.target;
      if (t && (t.tagName === "INPUT" || t.tagName === "SELECT" || t.tagName === "TEXTAREA")) return;
      if (t && t.closest && t.closest("#inspectorPanel") && (e.key.indexOf("Arrow") === 0 || e.key === "j" || e.key === "k")) return;
      var step = e.key === "ArrowDown" || e.key === "j" ? 1 : e.key === "ArrowUp" || e.key === "k" ? -1 : 0;
      if (step !== 0) {
        e.preventDefault();
        var vis = EVENTS.filter(visible);
        if (!vis.length) return;
        var curIdx = -1;
        if (state.selectedId) {
          for (var i = 0; i < vis.length; i++) if (vis[i].id === state.selectedId) { curIdx = i; break; }
        }
        var next = vis[Math.max(0, Math.min(vis.length - 1, curIdx + step))];
        if (curIdx === -1) next = step > 0 ? vis[0] : vis[vis.length - 1];
        select(next.id, true);
      } else if (e.key === "Home") { e.preventDefault(); setCursor(-1); }
      else if (e.key === "End") { e.preventDefault(); setCursor(EVENTS.length - 1); }
      else if (e.key === "c" || e.key === "C") {
        if (state.selectedId) setCursor(evIndex(state.selectedId));
      }
      else if (e.key === "Escape") { state.selectedId = null; applySelectionClasses(); }
    });
  }

  function initIntegrity() {
    var n = $("integrity");
    if (boot.ok) {
      n.textContent = "自检 ✓ " + boot.events + " 事件 · " + boot.edges + " 条因果边全部时间正向 · " + boot.changes + " 处字段前值与折叠一致";
      n.classList.add("ok");
    } else {
      n.textContent = "自检 ✗ " + boot.errors.join("；");
      n.classList.add("bad");
      var banner = el("div", "error-banner", "数据一致性校验失败：" + boot.errors.join("；"));
      document.body.insertBefore(banner, document.body.firstChild);
    }
  }

  function boot2() {
    initIntegrity();
    buildToolbar();
    initCursorBox();
    initKeyboard();
    renderTimeline();
    /* 深链：#e10 选中事件 · #c=8 设置游标 · #f=incident,rollback 类型过滤 */
    var h = location.hash || "";
    var mE = h.match(/e([a-z]\d+)/i), mC = h.match(/c=(-?\d+)/), mF = h.match(/f=([\w,]+)/);
    if (mF) {
      Object.keys(EVT).forEach(function (t) { state.typeOn[t] = mF[1].split(",").indexOf(t) !== -1; });
    }
    if (mC) state.cursorIdx = Math.max(-1, Math.min(EVENTS.length - 1, parseInt(mC[1], 10)));
    if (mE && evById("e" + mE[1])) state.selectedId = "e" + mE[1];
    updateCursor();
    applyFilters();
    applySelectionClasses();
    var rt;
    window.addEventListener("resize", function () {
      clearTimeout(rt);
      rt = setTimeout(drawEdges, 120);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot2);
  } else {
    boot2();
  }

  /* 调试/取证句柄（只读用途） */
  window.__AURORA = { state: state, chainOf: chainOf, ledTo: LED, events: EVENTS };
})();
