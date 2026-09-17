/* =====================================================================
 * 实体台账管理台 — app.js
 *
 * 模式：PAT-LIST-DETAIL-INSPECTOR
 *   tree_table（dominant workspace） + selection_inspector（contextual inspector）
 *   + toolbar（persistent command bar） + batch_preview_modal / receipt / status_bar
 *
 * 零误伤核心不变量（choice_selection_scope「可见即作用域」）：
 *   1. 选择集 selected 只存显式勾选的实体 id；
 *   2. 行/分组/全选的任何勾选入口，只作用于“当前渲染可见”的实体行；
 *      折叠分支、被搜索/筛选隐藏的实体在机制上进不了选择集；
 *   3. 批量操作执行前必须经过影响预览模态（按归属路径分组 + 计数），
 *      执行后回执“已影响 N 项”并可一步撤销。
 *
 * 状态所有权（SDIR state_ownership）：
 *   selection -> state.selected（显式 id 集合）      query -> state.query/statusFilter
 *   viewport  -> state.collapsed（展开映射）          preview -> state.modal（模态控制器）
 *   inspector -> 由 selected 派生，不独立持有状态
 * ===================================================================== */
(function () {
  "use strict";

  /* ---------------- 工具 ---------------- */
  function h(tag, attrs) {
    var el = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v === null || v === undefined || v === false) return;
        if (k === "class") el.className = v;
        else if (k === "text") el.textContent = v;
        else if (k === "checked") el.checked = true;
        else if (k === "indeterminate") el.indeterminate = true;
        else if (k.slice(0, 2) === "on" && typeof v === "function") el.addEventListener(k.slice(2), v);
        else el.setAttribute(k, v === true ? "" : String(v));
      });
    }
    for (var i = 2; i < arguments.length; i++) appendChild(el, arguments[i]);
    return el;
  }
  function appendChild(el, c) {
    if (c === null || c === undefined || c === false) return;
    if (Array.isArray(c)) { c.forEach(function (x) { appendChild(el, x); }); return; }
    el.appendChild(c.nodeType ? c : document.createTextNode(String(c)));
  }
  function el(id) { return document.getElementById(id); }
  function pad(n, w) { return String(n).padStart(w, "0"); }
  function nowTime() { return new Date().toLocaleTimeString("zh-CN", { hour12: false }); }

  /* ---------------- 数据索引 ---------------- */
  var groups = window.REGISTRY_DATA.groups;
  var groupById = new Map();
  var childrenOf = new Map();     // groupId -> 子分组[]
  var ROOTS = [];
  groups.forEach(function (g) {
    groupById.set(g.id, g);
    if (g.parentId) {
      if (!childrenOf.has(g.parentId)) childrenOf.set(g.parentId, []);
      childrenOf.get(g.parentId).push(g);
    } else ROOTS.push(g);
  });

  var entityById = new Map();     // id -> entity
  var entitiesByGroup = new Map();// groupId -> 直接实体[]
  window.REGISTRY_DATA.entities.forEach(function (e) { indexEntity(e); });
  function indexEntity(e) {
    entityById.set(e.id, e);
    if (!entitiesByGroup.has(e.groupId)) entitiesByGroup.set(e.groupId, []);
    entitiesByGroup.get(e.groupId).push(e);
  }
  childrenOf.forEach(function (list) {
    list.sort(function (a, b) { return a.name < b.name ? -1 : 1; });
  });

  var PATH = new Map();           // groupId -> 名称路径[]
  function pathOfGroup(id) {
    if (PATH.has(id)) return PATH.get(id);
    var g = groupById.get(id);
    var p = g.parentId ? pathOfGroup(g.parentId).concat([g.name]) : [g.name];
    PATH.set(id, p);
    return p;
  }
  function pathTextOfGroup(id) { return pathOfGroup(id).join(" / "); }
  function entityPath(e) { return pathTextOfGroup(e.groupId); }

  var STATUS = {
    online:      { label: "在线",   cls: "st-online" },
    maintenance: { label: "维护中", cls: "st-maintenance" },
    retired:     { label: "停用",   cls: "st-retired" }
  };
  var STATUS_KEYS = ["online", "maintenance", "retired"];

  /* ---------------- 状态 ---------------- */
  // phase: "loading"（状态机完备性保留，数据内联故同步就绪） | "ready" | "error"
  var state = {
    phase: "ready",
    collapsed: new Set(),          // 已折叠分组（默认全展开，层级首屏即见）
    selected: new Set(),           // 显式选择集：实体 id
    query: "",
    statusFilter: "all",
    modal: null,                   // {kind:"status"|"move"|"delete", target, error}
    receipt: null,                 // {text, changed:[...], undo, undone}
    error: null,                   // {text}
    anchorId: null,                // shift 范围选择锚点
    focusRowId: null,
    lastOpText: "—",
    visibleEntityCount: 0,
    menuOpen: false
  };

  /* ---------------- 选择器 ---------------- */
  function queryText() { return state.query.trim().toLowerCase(); }
  function filterActive() { return queryText() !== "" || state.statusFilter !== "all"; }
  function matchesFilter(e) {
    if (state.statusFilter !== "all" && e.status !== state.statusFilter) return false;
    var q = queryText();
    if (q && e.name.toLowerCase().indexOf(q) < 0 && e.code.toLowerCase().indexOf(q) < 0) return false;
    return true;
  }
  function directEntities(gid) { return entitiesByGroup.get(gid) || []; }

  // 展开后的可见行（树表渲染序：子分组在前，直接实体在后）
  function buildRows() {
    var rows = [];
    function hasMatch(g) {
      var d = directEntities(g.id);
      for (var i = 0; i < d.length; i++) if (matchesFilter(d[i])) return true;
      var subs = childrenOf.get(g.id) || [];
      for (var j = 0; j < subs.length; j++) if (hasMatch(subs[j])) return true;
      return false;
    }
    function subtreeTotal(g) {
      var n = directEntities(g.id).length;
      (childrenOf.get(g.id) || []).forEach(function (s) { n += subtreeTotal(s); });
      return n;
    }
    function walk(g, depth, anc) {
      if (!hasMatch(g)) return;
      var directVisible = directEntities(g.id).filter(matchesFilter);
      var expanded = filterActive() ? true : !state.collapsed.has(g.id);
      rows.push({
        kind: "group", g: g, depth: depth, expanded: expanded,
        directVisible: directVisible.length,
        directTotal: directEntities(g.id).length,
        subtreeTotal: subtreeTotal(g)
      });
      if (expanded) {
        (childrenOf.get(g.id) || []).forEach(function (s) { walk(s, depth + 1, anc.concat([s.id])); });
        directVisible.forEach(function (e) {
          rows.push({ kind: "entity", e: e, depth: depth + 1, anc: anc });
        });
      }
    }
    ROOTS.forEach(function (r) { walk(r, 1, [r.id]); });
    return rows;
  }

  function visibleEntityIds(rows) {
    var out = [];
    rows.forEach(function (r) { if (r.kind === "entity") out.push(r.e.id); });
    return out;
  }
  function statusCounts() {
    var c = { online: 0, maintenance: 0, retired: 0 };
    entityById.forEach(function (e) { c[e.status] += 1; });
    return c;
  }
  function selectedEntities() {
    var out = [];
    state.selected.forEach(function (id) {
      var e = entityById.get(id);
      if (e) out.push(e);
    });
    out.sort(function (a, b) { return a.code < b.code ? -1 : 1; });
    return out;
  }
  function groupByPath(list, describe) {
    var map = new Map();
    list.forEach(function (item) {
      var p = item.e ? entityPath(item.e) : describe(item).path;
      if (!map.has(p)) map.set(p, []);
      map.get(p).push(item);
    });
    return Array.from(map.entries());
  }

  /* ---------------- 动作 ---------------- */
  var actions = {
    setQuery: function (q) { state.query = q; render(); },
    setStatusFilter: function (f) { state.statusFilter = f; render(); },
    clearFilters: function () { state.query = ""; state.statusFilter = "all"; var i = el("searchInput"); if (i) { i.value = ""; } render(); },
    toggleCollapse: function (gid) {
      if (state.collapsed.has(gid)) state.collapsed.delete(gid); else state.collapsed.add(gid);
      render();
    },
    toggleEntity: function (id, checked) {
      if (checked) state.selected.add(id); else state.selected.delete(id);
      state.anchorId = id;
      render();
    },
    // 分组复选框：可见即作用域 —— 只作用于该分组当前渲染可见的下属实体行
    // （折叠分支 / 被筛选隐藏的实体不在渲染行中，机制上进不了选择集）
    toggleGroupDirect: function (gid, checked) {
      var rows = state.lastRows || [];
      rows.forEach(function (r) {
        if (r.kind === "entity" && r.anc && r.anc.indexOf(gid) >= 0) {
          if (checked) state.selected.add(r.e.id); else state.selected.delete(r.e.id);
        }
      });
      render();
    },
    // 全选可见：只纳入当前渲染的实体行
    selectAllVisible: function () {
      visibleEntityIds(state.lastRows || []).forEach(function (id) { state.selected.add(id); });
      render();
    },
    clearSelection: function () { state.selected.clear(); render(); },
    removeSelected: function (id) { state.selected.delete(id); render(); },
    toggleMenu: function (open) { state.menuOpen = open === undefined ? !state.menuOpen : open; renderToolbarMenu(); },
    openModal: function (kind, target) {
      state.menuOpen = false; renderToolbarMenu();
      if (state.selected.size === 0) return;
      state.modal = { kind: kind, target: target === undefined ? null : target, error: null };
      render();
    },
    closeModal: function () { state.modal = null; render(); },
    setModalTarget: function (t) {
      if (state.modal) { state.modal.target = t; state.modal.error = null; state.modal.refocus = "moveTarget"; render(); }
    },
    confirmModal: function () { executeOp(); },
    undo: function () { undoOp(); },
    dismissReceipt: function () { state.receipt = null; render(); },
    dismissError: function () { state.error = null; render(); },
    setFocusRow: function (rowId) { state.focusRowId = rowId; }
  };

  /* ------------- 批量操作（预览 → 确认 → 回执 → 可撤销） ------------- */
  function modalAffected() {
    var m = state.modal;
    var sel = selectedEntities();
    if (m.kind === "status") {
      var changed = sel.filter(function (e) { return e.status !== m.target; });
      return { affected: changed, unchanged: sel.length - changed.length };
    }
    if (m.kind === "move") {
      var moved = m.target ? sel.filter(function (e) { return e.groupId !== m.target; }) : [];
      return { affected: moved, unchanged: sel.length - moved.length };
    }
    return { affected: sel, unchanged: 0 };
  }

  function opLabel() {
    var m = state.modal;
    if (m.kind === "status") return "批量状态变更 →「" + STATUS[m.target].label + "」";
    if (m.kind === "move") return "批量移动归属 →「" + (m.target ? pathTextOfGroup(m.target) : "?") + "」";
    return "批量删除";
  }

  function executeOp() {
    var m = state.modal;
    if (!m) return;
    var aff = modalAffected();
    if (m.kind === "move" && !m.target) { state.modal.error = "请选择目标分组"; render(); return; }
    if (aff.affected.length === 0) {
      state.modal.error = "所选实体均无需变更（0 项受影响），未执行任何操作。";
      render();
      return;
    }
    var ids = aff.affected.map(function (e) { return e.id; });
    var label = opLabel();

    // 快照（单级撤销：如实记录，再次执行将覆盖上一个回执）
    var snapshot = {
      kind: m.kind,
      target: m.target,
      label: label,
      time: nowTime(),
      selectionBefore: Array.from(state.selected),
      entitySnaps: aff.affected.map(function (e) { return JSON.parse(JSON.stringify(e)); })
    };
    var oldPathById = {};
    snapshot.entitySnaps.forEach(function (s) { oldPathById[s.id] = pathTextOfGroup(s.groupId); });

    aff.affected.forEach(function (e) {
      if (m.kind === "status") e.status = m.target;
      if (m.kind === "move") e.groupId = m.target;
      if (m.kind === "delete") { entityById.delete(e.id); }
    });
    rebuildGroupIndex();

    if (m.kind === "delete") {
      ids.forEach(function (id) { state.selected.delete(id); });
    }

    state.modal = null;
    state.lastOpText = "上次操作：" + label.replace("批量", "") + " · " + snapshot.time + " · 影响 " + ids.length + " 项";
    state.receipt = {
      text: "已影响 " + ids.length + " 项：" + label,
      changed: buildChangedList(aff.affected, m, oldPathById),
      undo: snapshot,
      undone: false
    };
    render();
  }

  function buildChangedList(affected, m, oldPathById) {
    return affected.map(function (e) {
      var item = { id: e.id, name: e.name + " " + e.code, path: entityPath(e) };
      if (m.kind === "status") {
        // 执行后 e 已是新状态；delta 记录目标状态，path 不变
        item.delta = STATUS[m.target].label;
      } else if (m.kind === "move") {
        item.path = oldPathById[e.id] || entityPath(e); // 移动前路径
        item.delta = pathTextOfGroup(m.target);
      } else {
        item.delta = "已删除";
      }
      return item;
    });
  }

  function undoOp() {
    var r = state.receipt;
    if (!r || !r.undo || r.undone) return;
    var snap = r.undo;
    snap.entitySnaps.forEach(function (s) {
      if (!entityById.has(s.id)) { indexEntity(JSON.parse(JSON.stringify(s))); }
      else {
        var e = entityById.get(s.id);
        e.status = s.status;
        e.groupId = s.groupId;
      }
    });
    rebuildGroupIndex();
    state.selected = new Set(snap.selectionBefore.filter(function (id) { return entityById.has(id); }));
    state.lastOpText = "上次操作：" + snap.label.replace("批量", "") + "（已撤销）";
    state.receipt = { text: "已撤销：" + snap.label + "，" + snap.entitySnaps.length + " 项已还原。", changed: [], undo: null, undone: true };
    render();
  }

  function rebuildGroupIndex() {
    entitiesByGroup = new Map();
    entityById.forEach(function (e) {
      if (!entitiesByGroup.has(e.groupId)) entitiesByGroup.set(e.groupId, []);
      entitiesByGroup.get(e.groupId).push(e);
    });
  }

  /* ---------------- 渲染：静态外壳（一次） ---------------- */
  function buildShell() {
    var app = el("app");
    app.replaceChildren(
      h("header", { class: "site-header" },
        h("span", { class: "brand-mark", "aria-hidden": "true" }, "ER"),
        h("h1", null, "实体台账管理台"),
        h("span", { class: "sub" }, "层级实体 · 批量操作台"),
        h("span", { class: "badge" }, "可见即作用域 · 零误伤")
      ),
      h("div", { class: "toolbar" },
        h("div", { class: "toolbar-row" },
          h("div", { class: "search", id: "searchBox" },
            h("span", { class: "icon", "aria-hidden": "true" }, "⌕"),
            h("input", {
              id: "searchInput", type: "search", placeholder: "搜索名称 / 编码…",
              "aria-label": "搜索实体名称或编码",
              oninput: function (ev) {
                el("searchBox").classList.toggle("has-value", !!ev.target.value);
                actions.setQuery(ev.target.value);
              }
            }),
            h("button", {
              class: "clear", title: "清除搜索", "aria-label": "清除搜索",
              onclick: function () {
                var i = el("searchInput"); i.value = "";
                el("searchBox").classList.remove("has-value");
                actions.setQuery("");
                i.focus();
              }
            }, "×")
          ),
          h("div", { class: "seg", role: "group", "aria-label": "按状态筛选", id: "statusSeg" }),
          h("span", { class: "scope", id: "scope", "aria-live": "off" })
        ),
        h("div", { class: "toolbar-row" },
          h("span", { class: "sel-chip", id: "selChip" }),
          h("div", { class: "menu-anchor" },
            h("button", {
              class: "btn caret", id: "btnStatus", onclick: function () { actions.toggleMenu(); }
            }, "变更状态"),
            h("div", { id: "menuSlot" })
          ),
          h("button", { class: "btn", id: "btnMove", onclick: function () { actions.openModal("move", null); } }, "移动归属"),
          h("button", { class: "btn danger", id: "btnDelete", onclick: function () { actions.openModal("delete", null); } }, "删除"),
          h("span", { class: "vr", "aria-hidden": "true" }),
          h("button", { class: "btn", id: "btnSelectAll", onclick: function () { actions.selectAllVisible(); } }),
          h("button", { class: "btn quiet", id: "btnClearSel", onclick: function () { actions.clearSelection(); } }, "清除选择"),
          h("span", { class: "vr", "aria-hidden": "true" }),
          h("button", { class: "btn quiet", id: "btnUndoBar", onclick: function () { actions.undo(); } }, "↺ 撤销")
        )
      ),
      h("div", { id: "receiptSlot" }),
      h("div", { id: "errorSlot" }),
      h("main", { class: "layout" },
        h("section", { class: "tree-panel", "aria-label": "层级分组树表" },
          h("div", { class: "panel-cap" },
            "层级分组树表",
            h("span", { class: "hint" }, "勾选仅作用于当前可见的下属实体行；折叠分支不会被批量选中"),
            h("span", { class: "rule" })
          ),
          h("div", { class: "tree-scroll" },
            h("div", { class: "treegrid", id: "treeGrid", role: "treegrid",
              "aria-label": "实体层级列表",
              onkeydown: onGridKeydown,
              onclick: onGridClick })
          )
        ),
        h("aside", { class: "inspector", id: "inspector", "aria-label": "选择集检查器" })
      ),
      h("footer", { class: "status-bar", id: "statusBar" }),
      h("div", { id: "modalRoot" })
    );

    // 状态筛选分段（静态创建，渲染时更新 active 与计数）
    var seg = el("statusSeg");
    [["all", "全部"], ["online", "在线"], ["maintenance", "维护中"], ["retired", "停用"]].forEach(function (p) {
      seg.appendChild(h("button", {
        type: "button", "data-filter": p[0],
        onclick: function () { actions.setStatusFilter(p[0]); }
      }, p[1], h("span", { class: "n" })));
    });
  }

  /* ---------------- 渲染：工具栏动态区 ---------------- */
  function renderToolbar() {
    var counts = statusCounts();
    var total = entityById.size;
    var selN = state.selected.size;
    var visN = state.visibleEntityCount;

    Array.prototype.forEach.call(el("statusSeg").children, function (b) {
      var f = b.getAttribute("data-filter");
      b.classList.toggle("active", state.statusFilter === f);
      b.querySelector(".n").textContent =
        f === "all" ? String(total) : String(counts[f]);
    });

    el("scope").replaceChildren(
      "可见 ", h("span", { class: "num" }, String(visN)), " / 总计 ", h("span", { class: "num" }, String(total)),
      h("span", { class: "sep" }, "｜"),
      "已选 ", h("strong", null, String(selN)), " 项"
    );

    el("selChip").replaceChildren("对已选 ", h("strong", null, String(selN)), " 项执行：");
    el("btnStatus").disabled = selN === 0;
    el("btnMove").disabled = selN === 0;
    el("btnDelete").disabled = selN === 0;
    el("btnSelectAll").disabled = visN === 0;
    el("btnSelectAll").textContent = "全选可见（" + visN + "）";
    el("btnClearSel").disabled = selN === 0;
    el("btnUndoBar").disabled = !(state.receipt && state.receipt.undo && !state.receipt.undone);
  }

  function renderToolbarMenu() {
    var slot = el("menuSlot");
    if (!slot) return;
    slot.replaceChildren();
    if (!state.menuOpen) return;
    var menu = h("div", { class: "menu", role: "menu", "aria-label": "选择目标状态" });
    STATUS_KEYS.forEach(function (k) {
      menu.appendChild(h("button", {
        role: "menuitem", type: "button",
        onclick: function () { actions.openModal("status", k); }
      }, h("span", { class: "st-badge " + STATUS[k].cls }, STATUS[k].label),
         "设为「" + STATUS[k].label + "」"));
    });
    slot.appendChild(menu);
  }

  /* ---------------- 渲染：树表 ---------------- */
  function rowIdOf(r) { return r.kind === "group" ? "g:" + r.g.id : "e:" + r.e.id; }

  function groupRow(r) {
    var visibleDescIds = [];
    (state.lastRows || []).forEach(function (x) {
      if (x.kind === "entity" && x.anc && x.anc.indexOf(r.g.id) >= 0) visibleDescIds.push(x.e.id);
    });
    var selCount = visibleDescIds.filter(function (id) { return state.selected.has(id); }).length;
    var allChecked = visibleDescIds.length > 0 && selCount === visibleDescIds.length;
    var someChecked = selCount > 0 && !allChecked;
    var boxDisabled = visibleDescIds.length === 0;

    return h("div", {
      class: "trow group-row", role: "row", "aria-level": r.depth,
      "aria-expanded": r.expanded ? "true" : "false",
      "data-row": rowIdOf(r), tabindex: "-1",
      "aria-label": "分组 " + r.g.name + "，直接实体 " + r.directTotal + " 项，下级共 " + r.subtreeTotal + " 项"
    },
      h("span", { class: "c-check" },
        h("input", {
          type: "checkbox", checked: allChecked, indeterminate: someChecked,
          disabled: boxDisabled,
          "aria-checked": someChecked ? "mixed" : (allChecked ? "true" : "false"),
          "aria-label": (boxDisabled ? "分组 " + r.g.name + " 当前无可见下属实体，展开后可选择" :
            (someChecked ? "取消选择" : "选择") + "分组「" + r.g.name + "」下当前可见的 " + visibleDescIds.length + " 个实体"),
          onchange: function (ev) { actions.toggleGroupDirect(r.g.id, ev.target.checked); }
        })),
      h("span", { class: "c-name" },
        h("span", { class: "indent", style: "width:" + ((r.depth - 1) * 16) + "px", "aria-hidden": "true" }),
        h("button", {
          class: "caret" + (r.expanded ? " open" : ""), tabindex: "-1",
          "aria-label": (r.expanded ? "折叠" : "展开") + "分组 " + r.g.name,
          "aria-hidden": "true",
          onclick: function (ev) { ev.stopPropagation(); actions.toggleCollapse(r.g.id); }
        }, "▶"),
        h("span", { class: "name", title: pathTextOfGroup(r.g.id) }, r.g.name),
        h("span", { class: "g-count", title: "直接实体 " + r.directTotal + " · 含下级共 " + r.subtreeTotal },
          r.directTotal + "/" + r.subtreeTotal)
      ),
      h("span", { class: "c-status" },
        boxDisabled
          ? h("span", { class: "st-badge st-retired", title: "当前无可见下属实体（可见即作用域）" }, "—")
          : h("span", { class: "st-badge " + (allChecked ? "st-online" : (someChecked ? "st-maintenance" : "st-retired")),
              title: "已选 " + selCount + " / 当前可见 " + visibleDescIds.length },
              selCount + "/" + visibleDescIds.length)
      ),
      h("span", { class: "c-path" }, pathTextOfGroup(r.g.id))
    );
  }

  function entityRow(r) {
    var e = r.e;
    var isSel = state.selected.has(e.id);
    var st = STATUS[e.status];
    return h("div", {
      class: "trow entity-row" + (isSel ? " selected" : ""),
      role: "row", "aria-level": r.depth, "aria-selected": isSel ? "true" : "false",
      "data-row": rowIdOf(r), tabindex: "-1",
      "aria-label": e.name + "，编码 " + e.code + "，" + st.label + "，归属 " + entityPath(e)
    },
      h("span", { class: "c-check" },
        h("input", {
          type: "checkbox", checked: isSel,
          "aria-label": (isSel ? "取消选择 " : "选择 ") + e.name,
          onchange: function (ev) { actions.toggleEntity(e.id, ev.target.checked); }
        })),
      h("span", { class: "c-name" },
        h("span", { class: "indent", style: "width:" + ((r.depth - 1) * 16 + 18) + "px", "aria-hidden": "true" }),
        h("button", { class: "caret leaf", tabindex: "-1", "aria-hidden": "true" }, "▶"),
        h("span", { class: "name" }, e.name),
        h("span", { class: "code" }, e.code)
      ),
      h("span", { class: "c-status" }, h("span", { class: "st-badge " + st.cls }, st.label)),
      h("span", { class: "c-path", title: entityPath(e) }, entityPath(e))
    );
  }

  function renderTree() {
    var rows = buildRows();
    state.lastRows = rows;
    state.visibleEntityCount = 0;
    rows.forEach(function (r) { if (r.kind === "entity") state.visibleEntityCount += 1; });

    var grid = el("treeGrid");
    var prev = activeTreeFocusInfo();
    var frag = document.createDocumentFragment();

    frag.appendChild(h("div", { class: "trow thead", role: "row" },
      h("span", { class: "c-check" },
        h("input", { type: "checkbox", disabled: true, style: "visibility:hidden", "aria-hidden": "true" })),
      h("span", { role: "columnheader", "aria-sort": "none" }, "名称 / 编码"),
      h("span", { role: "columnheader" }, "状态"),
      h("span", { role: "columnheader" }, "归属路径")
    ));

    if (state.visibleEntityCount === 0) {
      frag.appendChild(h("div", { class: "empty-state", role: "row" },
        h("div", { class: "glyph", "aria-hidden": "true" }, "⌀"),
        h("div", null, "无匹配实体"),
        h("div", null, "当前搜索 / 状态筛选条件下没有可见实体。"),
        h("button", { class: "btn", onclick: function () { actions.clearFilters(); } }, "清除筛选")
      ));
    } else {
      rows.forEach(function (r) {
        frag.appendChild(r.kind === "group" ? groupRow(r) : entityRow(r));
      });
    }
    grid.replaceChildren(frag);

    // 焦点保持：渲染后恢复到原焦点行（勾选、展开不丢失键盘位置）
    if (state.focusRowId === null && rows.length) {
      state.focusRowId = rowIdOf(rows.find(function (r) { return r.kind === "entity"; }) || rows[0]);
    }
    applyTabindex(grid);
    restoreTreeFocus(prev);
  }

  function activeTreeFocusInfo() {
    var a = document.activeElement;
    if (!a) return null;
    var row = a.closest ? a.closest("#treeGrid .trow") : null;
    if (!row) return null;
    return { row: row.getAttribute("data-row"), inCheckbox: a.tagName === "INPUT" };
  }
  function applyTabindex(grid) {
    Array.prototype.forEach.call(grid.querySelectorAll(".trow"), function (row) {
      row.tabindex = row.getAttribute("data-row") === state.focusRowId ? 0 : -1;
    });
  }
  function restoreTreeFocus(prev) {
    if (!prev) return;
    var row = el("treeGrid").querySelector('[data-row="' + prev.row + '"]');
    if (!row) return;
    if (prev.inCheckbox) {
      var cb = row.querySelector('input[type="checkbox"]');
      if (cb && !cb.disabled) { cb.focus(); return; }
    }
    row.focus();
  }

  /* ---------------- 树表键盘 / 指针交互 ---------------- */
  function visibleRowEls() {
    return Array.prototype.slice.call(el("treeGrid").querySelectorAll(".trow:not(.thead)"));
  }
  function moveRowFocus(dir) {
    var rows = visibleRowEls();
    if (!rows.length) return;
    var idx = rows.findIndex(function (r) { return r.getAttribute("data-row") === state.focusRowId; });
    var next = idx < 0 ? 0 : Math.min(rows.length - 1, Math.max(0, idx + dir));
    state.focusRowId = rows[next].getAttribute("data-row");
    applyTabindex(el("treeGrid"));
    rows[next].focus();
  }
  function onGridKeydown(ev) {
    var rowEl = ev.target.closest ? ev.target.closest(".trow:not(.thead)") : null;
    if (!rowEl) return;
    var rowId = rowEl.getAttribute("data-row");
    var kind = rowId.charAt(0) === "g" ? "group" : "entity";
    var id = rowId.slice(2);

    switch (ev.key) {
      case "ArrowDown": ev.preventDefault(); moveRowFocus(1); break;
      case "ArrowUp": ev.preventDefault(); moveRowFocus(-1); break;
      case "Home": ev.preventDefault(); state.focusRowId = visibleRowEls()[0].getAttribute("data-row"); applyTabindex(el("treeGrid")); visibleRowEls()[0].focus(); break;
      case "End": { var rs = visibleRowEls(); ev.preventDefault(); state.focusRowId = rs[rs.length - 1].getAttribute("data-row"); applyTabindex(el("treeGrid")); rs[rs.length - 1].focus(); break; }
      case "ArrowRight":
        if (kind === "group") { ev.preventDefault(); if (state.collapsed.has(id)) actions.toggleCollapse(id); }
        break;
      case "ArrowLeft":
      case "Enter":
        if (kind === "group") { ev.preventDefault(); actions.toggleCollapse(id); }
        break;
      case " ":
      case "Spacebar":
        if (ev.target.tagName === "INPUT") return; // 复选框原生行为
        ev.preventDefault();
        if (kind === "entity") {
          var e = entityById.get(id);
          actions.toggleEntity(id, !state.selected.has(id));
          if (state.selected.has(id)) state.anchorId = id;
          void e;
        } else {
          // 分组行空格：等价点击其复选框（可见直接实体全选/取消）
          var cb = rowEl.querySelector('input[type="checkbox"]');
          if (cb && !cb.disabled) actions.toggleGroupDirect(id, !cb.checked || cb.indeterminate);
        }
        break;
      default: break;
    }
  }
  function onGridClick(ev) {
    var rowEl = ev.target.closest(".trow:not(.thead)");
    if (!rowEl) return;
    var rowId = rowEl.getAttribute("data-row");
    state.focusRowId = rowId;
    applyTabindex(el("treeGrid"));
    if (ev.target.tagName === "INPUT" || ev.target.closest("button")) return;

    if (rowId.charAt(0) === "g") {
      actions.toggleCollapse(rowId.slice(2));
      return;
    }
    var id = rowId.slice(2);
    if (ev.shiftKey && state.anchorId && entityById.has(state.anchorId)) {
      // 范围选择：锚点 → 当前行（仅当前可见行；可见即作用域）
      var ids = visibleEntityIds(state.lastRows || []);
      var a = ids.indexOf(state.anchorId), b = ids.indexOf(id);
      if (a >= 0 && b >= 0) {
        var lo = Math.min(a, b), hi = Math.max(a, b);
        for (var i = lo; i <= hi; i++) state.selected.add(ids[i]);
        render();
        return;
      }
    }
    state.anchorId = id; // 普通点击只设锚点，不改变选择（防误选）
  }

  /* ---------------- 渲染：检查器（选择集清单） ---------------- */
  function renderInspector() {
    var box = el("inspector");
    var sel = selectedEntities();
    var head = h("div", { class: "insp-head" }, "选择集", h("span", { class: "count" }, String(sel.length)));
    if (sel.length === 0) {
      box.replaceChildren(
        head,
        h("div", { class: "insp-empty" },
          h("div", { class: "glyph", "aria-hidden": "true" }, "☐"),
          h("p", null, h("strong", null, "尚未选择任何实体")),
          h("p", null, "勾选左侧行或分组复选框以构建选择集。"),
          h("p", null, "折叠分支与被筛选隐藏的实体不会进入选择集——批量操作只作用于下方显式列出的项。")
        )
      );
      return;
    }
    var byStatus = { online: 0, maintenance: 0, retired: 0 };
    sel.forEach(function (e) { byStatus[e.status] += 1; });

    var body = h("div", { class: "insp-body" });
    groupByPath(sel, function (x) { return { path: entityPath(x) }; }).forEach(function (pair) {
      body.appendChild(h("div", { class: "insp-path" },
        h("span", null, pair[0]), h("span", { class: "rule" }), h("span", null, pair[1].length + " 项")));
      pair[1].forEach(function (e) {
        body.appendChild(h("div", { class: "insp-item" },
          h("span", { class: "st-badge " + STATUS[e.status].cls }, STATUS[e.status].label),
          h("span", { class: "nm", title: e.name }, e.name),
          h("span", { class: "cd" }, e.code),
          h("button", {
            class: "rm", title: "从选择集移除 " + e.name, "aria-label": "从选择集移除 " + e.name,
            onclick: function () { actions.removeSelected(e.id); }
          }, "×")
        ));
      });
    });

    box.replaceChildren(
      head,
      h("div", { class: "insp-stats" },
        "在线 ", h("span", { class: "num" }, String(byStatus.online)),
        " · 维护中 ", h("span", { class: "num" }, String(byStatus.maintenance)),
        " · 停用 ", h("span", { class: "num" }, String(byStatus.retired))
      ),
      body,
      h("div", { class: "insp-foot" },
        h("span", { class: "hint" }, "批量操作仅作用于以上显式勾选的 " + sel.length + " 项"),
        h("button", { class: "btn quiet", onclick: function () { actions.clearSelection(); } }, "清空")
      )
    );
  }

  /* ---------------- 渲染：回执 / 错误 / 页脚 ---------------- */
  function renderReceipt() {
    var slot = el("receiptSlot");
    slot.replaceChildren();
    var r = state.receipt;
    if (!r) return;
    var box = h("div", { class: "receipt" + (r.undone ? " undone" : ""), "aria-live": "polite" },
      h("span", { class: "tick", "aria-hidden": "true" }, r.undone ? "↺" : "✓"),
      h("span", null, r.text)
    );
    if (r.changed.length) {
      var list = h("div", { class: "changed-list" });
      r.changed.forEach(function (c) {
        list.appendChild(h("div", null, c.name + " — " + c.path + " → " + c.delta));
      });
      box.appendChild(h("details", null,
        h("summary", null, "影响明细（" + r.changed.length + " 项）"),
        list));
    }
    var ops = h("span", { class: "detail" });
    if (r.undo && !r.undone) {
      ops.appendChild(h("button", { class: "btn", onclick: function () { actions.undo(); } }, "↺ 撤销此次操作"));
    }
    ops.appendChild(h("button", { class: "btn quiet", "aria-label": "关闭回执", onclick: function () { actions.dismissReceipt(); } }, "知道了"));
    box.appendChild(ops);
    slot.appendChild(box);
  }

  function renderError() {
    var slot = el("errorSlot");
    slot.replaceChildren();
    if (!state.error) return;
    slot.appendChild(h("div", { class: "error-banner", role: "alert" },
      h("span", { "aria-hidden": "true" }, "⛔"),
      h("span", null, state.error.text),
      h("button", { class: "x", "aria-label": "关闭错误提示", onclick: function () { actions.dismissError(); } }, "×")
    ));
  }

  function renderFooter() {
    var counts = statusCounts();
    el("statusBar").replaceChildren(
      h("span", null, "实体总数 ", h("span", { class: "num" }, String(entityById.size))),
      h("span", { class: "dot" }, "·"),
      h("span", null, "在线 ", h("span", { class: "num" }, String(counts.online))),
      h("span", null, "维护中 ", h("span", { class: "num" }, String(counts.maintenance))),
      h("span", null, "停用 ", h("span", { class: "num" }, String(counts.retired))),
      h("span", { class: "dot" }, "·"),
      h("span", { class: "last" }, state.lastOpText),
      h("span", { class: "mem" }, "内存演示数据 · 刷新即还原"),
      (state.receipt && state.receipt.undo && !state.receipt.undone)
        ? h("button", { class: "undo-link", onclick: function () { actions.undo(); } }, "撤销上次操作")
        : h("span", { class: "mem" }, "")
    );
  }

  /* ---------------- 渲染：批量操作预览模态 ---------------- */
  function renderModal() {
    var root = el("modalRoot");
    root.replaceChildren();
    var m = state.modal;
    if (!m) return;

    var aff = modalAffected();
    var selN = state.selected.size;
    var danger = m.kind === "delete";
    var title = m.kind === "status" ? "批量状态变更 — 确认影响范围"
      : m.kind === "move" ? "批量移动归属 — 确认影响范围"
      : "批量删除 — 确认影响范围";

    var body = h("div", { class: "dlg-body" });

    if (m.kind === "move") {
      var opts = [h("option", { value: "" }, "— 选择目标分组 —")];
      (function emit(pid, depth) {
        (pid ? (childrenOf.get(pid) || []) : ROOTS).forEach(function (g) {
          opts.push(h("option", { value: g.id }, " ".repeat(" ", depth * 2) + "　".repeat(depth) + g.name +
            "（直接 " + directEntities(g.id).length + "）"));
          emit(g.id, depth + 1);
        });
      })(null, 0);
      opts.forEach(function (o) { if (o.value === m.target) o.setAttribute("selected", ""); });
      body.appendChild(h("div", { class: "dlg-field" },
        h("label", { for: "moveTarget" }, "目标分组（实体将移动为该分组的直接成员）"),
        h("select", {
          id: "moveTarget", onchange: function (ev) { actions.setModalTarget(ev.target.value || null); }
        }, opts)
      ));
    }

    if (m.error) body.appendChild(h("div", { class: "dlg-error", role: "alert" }, m.error));

    // 显式错误状态：目标分组与全部所选归属相同 → 0 项可变更，阻止执行
    if (m.kind === "move" && m.target && aff.affected.length === 0 && !m.error) {
      body.appendChild(h("div", { class: "dlg-error", role: "alert" },
        "所选 " + selN + " 项均已属于「" + pathTextOfGroup(m.target) + "」，无可变更项（影响 0 项）。请更换目标分组或取消。"));
    }

    if (m.kind === "status" && aff.unchanged > 0) {
      body.appendChild(h("div", { class: "dlg-meta", style: "margin:0 0 8px" },
        "另 " + aff.unchanged + " 项已处于「" + STATUS[m.target].label + "」，不会重复计入影响。"));
    }
    if (m.kind === "move" && !m.target) {
      body.appendChild(h("div", { class: "dlg-meta", style: "margin:0 0 8px" }, "选择目标分组后，此处将按归属路径列出受影响实体。"));
    }

    if (aff.affected.length) {
      var describe = function (e) {
        return {
          path: entityPath(e),
          name: e.name + " " + e.code,
          delta: m.kind === "status" ? STATUS[e.status].label + " → " + STATUS[m.target].label
            : m.kind === "move" ? entityPath(e) + " → " + pathTextOfGroup(m.target)
            : STATUS[e.status].label + " → 删除"
        };
      };
      groupByPath(aff.affected, describe).forEach(function (pair) {
        body.appendChild(h("div", { class: "pv-group" },
          h("span", null, pair[0]), h("span", { class: "rule" }),
          h("span", { class: "n" }, pair[1].length + " 项")));
        pair[1].forEach(function (e) {
          var d = describe(e);
          body.appendChild(h("div", { class: "pv-item" },
            h("span", { class: "nm" }, e.name + " " + e.code),
            h("span", { class: "delta " + (danger ? "to-danger" : "to") },
              m.kind === "move" ? "→ " + pathTextOfGroup(m.target) : d.delta)
          ));
        });
      });
    }

    var confirmLabel = "确认执行（影响 " + aff.affected.length + " 项）";
    var dialog = h("div", {
      class: "dialog" + (danger ? " danger" : ""), role: "dialog", "aria-modal": "true",
      "aria-labelledby": "dlgTitle", tabindex: "-1"
    },
      h("div", { class: "dlg-head" },
        h("h2", { class: "dlg-title", id: "dlgTitle" }, title),
        h("div", { class: "dlg-meta" },
          "操作：", h("strong", null, opLabel()),
          h("span", null, "　·　选择集 ", h("strong", null, String(selN)), " 项"),
          m.kind !== "move" || m.target
            ? h("span", null, "　·　受影响 ", h("strong", null, String(aff.affected.length)), " 项")
            : null,
          danger && aff.affected.length
            ? h("span", { class: "warn-note" }, "　·　删除可通过回执中的「撤销」一步还原")
            : null
        )
      ),
      body,
      h("div", { class: "dlg-foot" },
        h("span", { class: "note" }, "仅作用于显式勾选的选择集；取消不产生任何变更。"),
        h("span", { class: "spacer" }),
        h("button", { class: "btn", onclick: function () { actions.closeModal(); } }, "取消"),
        h("button", {
          class: "btn " + (danger ? "danger" : "primary"),
          disabled: aff.affected.length === 0 || (m.kind === "move" && !m.target),
          onclick: function () { actions.confirmModal(); }
        }, confirmLabel)
      )
    );

    var overlay = h("div", {
      class: "overlay",
      onclick: function (ev) { if (ev.target === overlay) actions.closeModal(); }
    }, dialog);
    root.appendChild(overlay);

    overlay.addEventListener("keydown", function (ev) { if (ev.key === "Escape") actions.closeModal(); });
    // 焦点进入对话框（重渲染时回到此前聚焦的控件）
    var focusTarget = (m.refocus && dialog.querySelector("#" + m.refocus)) ||
      dialog.querySelector("#moveTarget") ||
      dialog.querySelector(".btn.primary, .btn.danger");
    m.refocus = null;
    if (focusTarget && !focusTarget.disabled) focusTarget.focus();
    else dialog.focus();
  }

  /* ---------------- 渲染总入口 ---------------- */
  function render() {
    if (state.phase === "loading") { renderLoading(); return; }
    renderToolbarMenu();
    renderTree();      // 先树（得到 visibleEntityCount）
    renderToolbar();
    renderInspector();
    renderReceipt();
    renderError();
    renderFooter();
    renderModal();
  }
  function renderLoading() {
    // 状态机完备性保留：数据随页面内联，ready 同步到达，此分支不作为可测状态出现
    el("app").replaceChildren(h("div", { class: "skeleton" },
      h("div", { class: "bar", style: "width:40%" }),
      h("div", { class: "bar", style: "width:70%" }),
      h("div", { class: "bar", style: "width:55%" })));
  }

  /* ---------------- 全局事件 ---------------- */
  document.addEventListener("click", function (ev) {
    if (state.menuOpen && !ev.target.closest(".menu-anchor")) actions.toggleMenu(false);
  }, true);
  document.addEventListener("keydown", function (ev) {
    if (ev.key === "Escape" && state.menuOpen) actions.toggleMenu(false);
  });

  /* ---------------- 测试钩子（浏览器验证用，不影响 UI） ---------------- */
  window.__REGISTRY__ = {
    state: state,
    buildRows: buildRows,
    visibleEntityIds: function () { return visibleEntityIds(state.lastRows || []); },
    counts: function () { return { total: entityById.size, selected: state.selected.size, visible: state.visibleEntityCount }; },
    entity: function (id) { return entityById.get(id); },
    allEntities: function () { return Array.from(entityById.values()); },
    entitiesOfGroup: directEntities,
    pathOf: pathTextOfGroup
  };

  /* ---------------- 启动（同步 ready） ---------------- */
  buildShell();
  render();
})();
