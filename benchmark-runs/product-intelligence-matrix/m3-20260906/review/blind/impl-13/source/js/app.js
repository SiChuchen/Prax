/* cell-j01-s01 实体目录管理台 — 应用核心
 * 架构：单一数据源（内存实体数组）+ 派生渲染；
 * 状态归属：selection（选择集）/ query（筛选器）/ mode（预览模态）/ viewport（树展开）四类状态各有唯一属主。
 * 零误伤契约：computeAffected() 是预览与执行的唯一共同来源——确认列表与实际作用集合逐 id 一致。 */
(function () {
  'use strict';

  var SEED = window.SEED;
  var STATUSES = SEED.statuses;
  var STATUS_BY_ID = {};
  STATUSES.forEach(function (s) { STATUS_BY_ID[s.id] = s; });

  // ---------- 索引 ----------
  var CAT_BY_ID = {};
  SEED.categories.forEach(function (c) { CAT_BY_ID[c.id] = c; });
  var CHILDREN = {};
  SEED.categories.forEach(function (c) {
    if (c.parentId) { (CHILDREN[c.parentId] = CHILDREN[c.parentId] || []).push(c); }
  });
  var DOMAIN_CATS = {};
  SEED.categories.forEach(function (c) {
    if (!c.parentId) { (DOMAIN_CATS[c.domainId] = DOMAIN_CATS[c.domainId] || []).push(c); }
  });
  var ENT_BY_ID = {};
  SEED.entities.forEach(function (e) { ENT_BY_ID[e.id] = e; });

  // ---------- 状态（各有唯一属主） ----------
  var state = {
    // query —— 筛选器：只决定可见行，永不触碰 selection
    scopeNodeId: 'root',
    query: '',
    statusFilter: {},        // {statusId:true} 有勾选=只显示勾选状态
    sortKey: 'id',
    sortDir: 1,
    // selection —— 选择集：仅 行复选 / 范围全选 / 清空 / 仅保留可见 四种显式动作可变
    selection: {},           // {entityId:true}
    // viewport —— 树展开状态
    expanded: { root: true },
    // mode —— 预览确认模态（暂存待执行操作）
    pending: null,
    // 操作记录
    ops: [],
    lastOp: null,
    // 交互辅助
    anchor: null,            // shift 范围选择锚点
    activeRowIdx: 0,         // roving tabindex 当前行
    detailOpen: {},          // 行内展开
    warnListOpen: false,
    opsPanelOpen: false
  };

  SEED.domains.forEach(function (d) { state.expanded[d.id] = true; });
  SEED.categories.forEach(function (c) { if (c.depth <= 1) state.expanded[c.id] = true; });

  // ---------- 纯派生 ----------
  function allEntities() { return SEED.entities; }

  function catPath(catId) {
    var parts = [], c = CAT_BY_ID[catId];
    while (c) { parts.unshift(c.name); c = c.parentId ? CAT_BY_ID[c.parentId] : null; }
    return parts;
  }
  function pathText(catId) { return catPath(catId).join(' / '); }
  function statusOf(e) { return STATUS_BY_ID[e.status]; }

  function subtreeCatIds(nodeId) {
    if (nodeId === 'root') return SEED.categories.map(function (c) { return c.id; });
    var out = [nodeId], queue = [nodeId];
    while (queue.length) {
      var cur = queue.shift();
      (CHILDREN[cur] || []).forEach(function (ch) { out.push(ch.id); queue.push(ch.id); });
    }
    return out;
  }

  function entitiesInNode(nodeId) {
    var ids = subtreeCatIds(nodeId), set = {};
    ids.forEach(function (id) { set[id] = true; });
    return allEntities().filter(function (e) { return set[e.categoryId]; });
  }

  function visibleList() {
    var q = state.query.trim().toLowerCase();
    var scopeIds = subtreeCatIds(state.scopeNodeId), scopeSet = {};
    scopeIds.forEach(function (id) { scopeSet[id] = true; });
    // 状态筛选：未勾选任何状态 = 全部显示；有勾选 = 只显示勾选状态
    var anyFilter = STATUSES.some(function (s) { return state.statusFilter[s.id]; });
    var list = allEntities().filter(function (e) {
      if (!scopeSet[e.categoryId]) return false;
      if (anyFilter && !state.statusFilter[e.status]) return false;
      return true;
    });
    if (q) {
      list = list.filter(function (e) {
        return (e.id + ' ' + e.name + ' ' + e.owner + ' ' + e.tags.join(' ') + ' ' + pathText(e.categoryId))
          .toLowerCase().indexOf(q) !== -1;
      });
    }
    var k = state.sortKey, dir = state.sortDir;
    list.sort(function (a, b) {
      var va, vb;
      if (k === 'status') { va = statusOf(a).label; vb = statusOf(b).label; }
      else if (k === 'path') { va = pathText(a.categoryId); vb = pathText(b.categoryId); }
      else { va = a[k]; vb = b[k]; }
      return va < vb ? -dir : va > vb ? dir : (a.id < b.id ? -1 : 1);
    });
    return list;
  }

  // 节点聚合：直接计数 / 累计计数 / 状态分布（树、表格、状态栏三处同源）
  function nodeAgg(nodeId) {
    var direct = nodeId === 'root' ? 0
      : allEntities().filter(function (e) { return e.categoryId === nodeId; }).length;
    var list = entitiesInNode(nodeId);
    var dist = {};
    STATUSES.forEach(function (s) { dist[s.id] = 0; });
    list.forEach(function (e) { dist[e.status] += 1; });
    return { total: list.length, direct: direct, dist: dist };
  }

  function selectedIds() {
    return Object.keys(state.selection);
  }
  function hiddenSelected() {
    var vis = {};
    visibleList().forEach(function (e) { vis[e.id] = true; });
    return selectedIds().filter(function (id) { return !vis[id]; });
  }

  // ---------- 零误伤核心：预览与执行共用同一计算 ----------
  // 返回 {apply:[{id,name,path,before,after,...}], noop:[{id,name,path,reason}]}
  function computeAffected(ids, op) {
    var apply = [], noop = [];
    ids.forEach(function (id) {
      var e = ENT_BY_ID[id];
      var item = { id: id, name: e.name, path: pathText(e.categoryId), e: e };
      if (op.type === 'status') {
        if (e.status === op.target) { item.reason = '已是「' + statusOf(e).label + '」'; noop.push(item); return; }
        item.before = e.status; item.after = op.target;
      } else if (op.type === 'move') {
        if (e.categoryId === op.target) { item.reason = '已在该类别'; noop.push(item); return; }
        item.beforePath = pathText(e.categoryId); item.afterPath = pathText(op.target);
      } else if (op.type === 'tag-add') {
        var add = op.tags.filter(function (t) { return e.tags.indexOf(t) === -1; });
        if (!add.length) { item.reason = '已含全部目标标签'; noop.push(item); return; }
        item.beforeTags = e.tags.slice(); item.afterTags = e.tags.concat(add);
      } else if (op.type === 'tag-remove') {
        if (e.tags.indexOf(op.tag) === -1) { item.reason = '不含标签「' + op.tag + '」'; noop.push(item); return; }
        item.beforeTags = e.tags.slice();
        item.afterTags = e.tags.filter(function (t) { return t !== op.tag; });
      } else if (op.type === 'delete') {
        item.before = e.status;
      }
      apply.push(item);
    });
    return { apply: apply, noop: noop };
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // ---------- 渲染 ----------
  function statusBadge(sid) {
    var s = STATUS_BY_ID[sid];
    return '<span class="badge tone-' + s.tone + '">' + s.label + '</span>';
  }

  function countsHtml(agg) {
    // 显示「直接 · 累计」；叶节点直接=累计时只显示一个数
    if (agg.direct && agg.direct !== agg.total) {
      return '<span class="tcount" title="直接 ' + agg.direct + ' · 累计 ' + agg.total + '">' +
        '<b>' + agg.direct + '</b>·' + agg.total + '</span>';
    }
    return '<span class="tcount" title="累计 ' + agg.total + '">' + agg.total + '</span>';
  }

  function microBar(agg) {
    if (!agg.total) return '<span class="mbar" title="无实体"></span>';
    var segs = STATUSES.map(function (s) {
      var n = agg.dist[s.id];
      return n ? '<i class="tone-' + s.tone + '" style="flex:' + n + '" title="' + s.label + ' ' + n + '"></i>' : '';
    }).join('');
    return '<span class="mbar">' + segs + '</span>';
  }

  function trowHtml(id, name, openable, open, scoped, countAgg) {
    return '<div class="trow' + (scoped ? ' scoped' : '') + '" role="treeitem" tabindex="-1"' +
      (openable ? ' aria-expanded="' + !!open + '"' : '') +
      ' data-act="scope" data-id="' + id + '">' +
      (openable ? '<span class="caret' + (open ? ' open' : '') + '" data-act="caret" data-id="' + id + '" title="展开/收起">▸</span>'
                : '<span class="caret leaf"></span>') +
      '<span class="tname">' + esc(name) + '</span>' + countsHtml(countAgg) + microBar(countAgg) + '</div>';
  }

  function renderTree() {
    var rootAgg = nodeAgg('root');
    var html = '<div class="tnode depth-0' + (state.scopeNodeId === 'root' ? ' scoped' : '') + '">' +
      trowHtml('root', '全部实体', false, false, state.scopeNodeId === 'root', rootAgg) + '</div>';
    SEED.domains.forEach(function (d) {
      var agg = nodeAgg(d.id);
      var open = !!state.expanded[d.id];
      var kids = (DOMAIN_CATS[d.id] || []).map(function (c) { return catNode(c, 1); }).join('');
      html += '<div class="tnode depth-0">' +
        trowHtml(d.id, d.name, true, open, state.scopeNodeId === d.id, agg) +
        (open ? '<div class="tkids">' + kids + '</div>' : '') + '</div>';
    });
    document.getElementById('tree').innerHTML = html;
  }

  function catNode(c, depth) {
    var agg = nodeAgg(c.id);
    var kids = CHILDREN[c.id] || [];
    var open = !!state.expanded[c.id];
    var childHtml = kids.length && open ? '<div class="tkids">' + kids.map(function (ch) { return catNode(ch, depth + 1); }).join('') + '</div>' : '';
    return '<div class="tnode depth-' + depth + '">' +
      trowHtml(c.id, c.name, kids.length > 0, open, state.scopeNodeId === c.id, agg) +
      childHtml + '</div>';
  }

  function renderToolbar() {
    var scopeName = state.scopeNodeId === 'root' ? '全部实体' : pathText(state.scopeNodeId);
    document.getElementById('scope-crumb').textContent = '范围：' + scopeName + '（含子层级）';
    var vis = visibleList().length;
    var sub = entitiesInNode(state.scopeNodeId).length;
    document.getElementById('btn-sel-visible').textContent = '选当前筛选结果 (' + vis + ')';
    document.getElementById('btn-sel-subtree').textContent = '选子树全部 (' + sub + ')';
    // 状态 chips（全局计数，点击=只显示该状态）
    var distAll = {};
    STATUSES.forEach(function (s) { distAll[s.id] = 0; });
    allEntities().forEach(function (e) { distAll[e.status] += 1; });
    document.getElementById('status-chips').innerHTML = STATUSES.map(function (s) {
      var on = !!state.statusFilter[s.id];
      return '<button class="chip tone-' + s.tone + (on ? ' on' : '') + '" data-act="status-chip" data-id="' + s.id + '"' +
        ' aria-pressed="' + on + '" title="' + (on ? '取消「只显示' : '只显示') + s.label + (on ? '」' : '」') + '">' +
        s.label + ' <b>' + distAll[s.id] + '</b></button>';
    }).join('');
  }

  function renderWarn() {
    var hidden = hiddenSelected();
    var el = document.getElementById('warn');
    var listEl = document.getElementById('warn-list');
    if (!hidden.length) {
      el.hidden = true; listEl.hidden = true; state.warnListOpen = false;
      return;
    }
    el.hidden = false;
    document.getElementById('warn-text').textContent =
      '已选 ' + selectedIds().length + ' 项中有 ' + hidden.length +
      ' 项被当前筛选/范围隐藏——批量操作仍会包含它们。';
    listEl.hidden = !state.warnListOpen;
    if (state.warnListOpen) {
      listEl.innerHTML = hidden.map(function (id) {
        var e = ENT_BY_ID[id];
        return '<div class="warn-item"><code>' + esc(id) + '</code> ' + esc(e.name) +
          ' <span class="dim">· ' + esc(pathText(e.categoryId)) + '</span></div>';
      }).join('');
    }
  }

  function renderTable() {
    var list = visibleList();
    var tbody = document.getElementById('tbody');
    if (!list.length) {
      tbody.innerHTML = '<tr class="empty-row"><td colspan="8"><div class="empty">' +
        '<div class="empty-title">当前范围内没有匹配的实体</div>' +
        '<div class="dim">调整关键字或状态筛选，或<span class="link" data-act="clear-filters" tabindex="0">清除全部筛选</span></div>' +
        '</div></td></tr>';
    } else {
      // 巡航行（roving tabindex）：仅当前行复选框可 Tab 到达，方向键在行间移动
      if (state.activeRowIdx >= list.length) state.activeRowIdx = Math.max(0, list.length - 1);
      if (state.activeRowIdx < 0) state.activeRowIdx = 0;
      tbody.innerHTML = list.map(function (e, idx) {
        var sel = !!state.selection[e.id];
        var open = !!state.detailOpen[e.id];
        var row = '<tr class="ent' + (sel ? ' sel' : '') + '" data-id="' + e.id + '">' +
          '<td class="c-check"><input type="checkbox" tabindex="' + (idx === state.activeRowIdx ? '0' : '-1') + '" data-act="row-check" data-id="' + e.id + '"' +
          (sel ? ' checked' : '') + ' aria-label="选择 ' + esc(e.name) + '"></td>' +
          '<td class="c-code"><code>' + esc(e.id) + '</code></td>' +
          '<td class="c-name"><button class="name-btn" tabindex="-1" data-act="detail" data-id="' + e.id + '" aria-expanded="' + open + '">' +
          '<span class="chev">' + (open ? '▾' : '▸') + '</span>' + esc(e.name) + '</button></td>' +
          '<td class="c-status">' + statusBadge(e.status) + '</td>' +
          '<td class="c-path">' + esc(pathText(e.categoryId)) + '</td>' +
          '<td class="c-owner">' + esc(e.owner) + '</td>' +
          '<td class="c-tags">' + (e.tags.length ? e.tags.map(function (t) { return '<span class="tag">' + esc(t) + '</span>'; }).join('') : '<span class="dim">—</span>') + '</td>' +
          '<td class="c-date">' + esc(e.updatedAt) + '</td></tr>';
        if (open) {
          row += '<tr class="detail"><td></td><td colspan="7"><div class="detail-card">' +
            '<div><b>编码</b><code>' + esc(e.id) + '</code></div>' +
            '<div><b>归属</b>' + esc(pathText(e.categoryId)) + '</div>' +
            '<div><b>状态</b>' + statusBadge(e.status) + '</div>' +
            '<div><b>负责人</b>' + esc(e.owner) + '</div>' +
            '<div><b>标签</b>' + (e.tags.length ? e.tags.map(function (t) { return '<span class="tag">' + esc(t) + '</span>'; }).join(' ') : '—') + '</div>' +
            '<div><b>备注</b>' + esc(e.note) + '</div>' +
            '<div><b>更新</b>' + esc(e.updatedAt) + '</div></div></td></tr>';
        }
        return row;
      }).join('');
    }
    // 表头三态复选框
    var visIds = list.map(function (e) { return e.id; });
    var selVis = visIds.filter(function (id) { return state.selection[id]; }).length;
    var head = document.getElementById('head-check');
    head.checked = visIds.length > 0 && selVis === visIds.length;
    head.indeterminate = selVis > 0 && selVis < visIds.length;
    document.getElementById('sel-summary').textContent =
      '已选 ' + selectedIds().length + ' · 可见 ' + visIds.length + ' · 范围内 ' + entitiesInNode(state.scopeNodeId).length;
    // 排序指示
    Array.prototype.forEach.call(document.querySelectorAll('#thead th[data-sort]'), function (th) {
      var on = th.getAttribute('data-sort') === state.sortKey;
      th.setAttribute('aria-sort', on ? (state.sortDir === 1 ? 'ascending' : 'descending') : 'none');
      th.querySelector('.sort-ind').textContent = on ? (state.sortDir === 1 ? '▲' : '▼') : '';
    });
  }

  function renderActionbar() {
    var n = selectedIds().length;
    var bar = document.getElementById('actionbar');
    bar.hidden = n === 0;
    if (!n) return;
    var hidden = hiddenSelected().length;
    document.getElementById('ab-count').innerHTML = '已选 <b>' + n + '</b> 项' +
      (hidden ? ' <span class="ab-hidden">（' + hidden + ' 项当前不可见，仍将包含）</span>' : '');
  }

  function renderStatusbar() {
    var el = document.getElementById('receipt');
    if (state.lastOp && !state.lastOp.undone) {
      el.innerHTML = '<span class="rc-ok">✓</span> ' + esc(state.lastOp.receipt) +
        ' <button class="btn btn-mini" data-act="undo">撤销</button>';
    } else if (state.lastOp && state.lastOp.undone) {
      el.innerHTML = '<span class="dim">已撤销：' + esc(state.lastOp.receipt) + '</span>';
    } else {
      el.innerHTML = '<span class="dim">就绪 · 批量操作经逐项预览确认后生效</span>';
    }
    document.getElementById('ops-btn').textContent = '操作记录 (' + state.ops.length + ')';
    document.getElementById('sb-total').textContent =
      '共 ' + allEntities().length + ' 项 · 内存态，刷新重置为种子数据';
    var panel = document.getElementById('ops-panel');
    panel.hidden = !state.opsPanelOpen;
    if (state.opsPanelOpen) {
      panel.innerHTML = state.ops.length
        ? state.ops.slice().reverse().map(function (op) {
          return '<div class="op-item' + (op.undone ? ' undone' : '') + '">' +
            '<span class="op-time">' + esc(op.time) + '</span> ' + esc(op.label) +
            (op.undone ? ' <span class="op-undone">已撤销</span>' : '') + '</div>';
        }).join('')
        : '<div class="dim op-item">暂无操作</div>';
    }
  }

  function renderAll() {
    renderTree();
    renderToolbar();
    renderWarn();
    renderTable();
    renderActionbar();
    renderStatusbar();
  }

  // ---------- 选择集动作（唯一合法入口） ----------
  function addVisible() {
    visibleList().forEach(function (e) { state.selection[e.id] = true; });
    renderAll();
  }
  function addSubtree() {
    entitiesInNode(state.scopeNodeId).forEach(function (e) { state.selection[e.id] = true; });
    renderAll();
  }
  function clearSel() { state.selection = {}; state.anchor = null; renderAll(); }
  function pruneToVisible() {
    var vis = {};
    visibleList().forEach(function (e) { vis[e.id] = true; });
    selectedIds().forEach(function (id) { if (!vis[id]) delete state.selection[id]; });
    renderAll();
  }
  function shiftRange(currentId) {
    var visIds = visibleList().map(function (e) { return e.id; });
    var a = visIds.indexOf(state.anchor), b = visIds.indexOf(currentId);
    if (a === -1 || b === -1) { state.anchor = currentId; return; }
    if (a > b) { var t = a; a = b; b = t; }
    for (var i = a; i <= b; i++) state.selection[visIds[i]] = true;
    renderAll();
  }

  // ---------- 批量操作引擎 ----------
  var OP_META = {
    'status':     { title: '批量修改状态' },
    'move':       { title: '批量移动类别' },
    'tag-add':    { title: '批量添加标签' },
    'tag-remove': { title: '批量移除标签' },
    'delete':     { title: '批量删除实体' }
  };

  function openPreview(type) {
    var ids = selectedIds();
    if (!ids.length) return;
    state.pending = { type: type, ids: ids, target: '', tags: '', confirmDelete: false };
    renderPreviewModal();
    document.getElementById('modal').hidden = false;
    var first = document.querySelector('#modal-ctrl select, #modal-ctrl input[type=text]');
    if (first) first.focus();
  }

  function closePreview() {
    state.pending = null;
    document.getElementById('modal').hidden = true;
  }

  function renderPreviewModal() {
    var p = state.pending;
    if (!p) return;
    document.getElementById('modal-title').textContent = OP_META[p.type].title;

    // 控制区
    var ctrl = document.getElementById('modal-ctrl');
    if (p.type === 'status') {
      ctrl.innerHTML = '<label>目标状态</label><select id="op-target" aria-label="目标状态">' +
        '<option value="">— 选择目标状态 —</option>' +
        STATUSES.map(function (s) {
          return '<option value="' + s.id + '"' + (p.target === s.id ? ' selected' : '') + '>' + s.label + '</option>';
        }).join('') + '</select>';
    } else if (p.type === 'move') {
      var opts = SEED.categories.map(function (c) {
        return '<option value="' + c.id + '"' + (p.target === c.id ? ' selected' : '') + '>' +
          '　'.repeat(c.depth) + esc(c.name) + '（' + esc(CAT_BY_ID[c.domainId].name) + '）</option>';
      }).join('');
      ctrl.innerHTML = '<label>目标类别</label><select id="op-target" aria-label="目标类别">' +
        '<option value="">— 选择目标类别 —</option>' + opts + '</select>';
    } else if (p.type === 'tag-add') {
      ctrl.innerHTML = '<label>新标签（逗号分隔）</label><input type="text" id="op-tags" placeholder="如：待巡检, 核心">';
    } else if (p.type === 'tag-remove') {
      var tagSet = {};
      p.ids.forEach(function (id) { ENT_BY_ID[id].tags.forEach(function (t) { tagSet[t] = true; }); });
      var tagOpts = Object.keys(tagSet).map(function (t) {
        return '<option value="' + esc(t) + '"' + (p.target === t ? ' selected' : '') + '>' + esc(t) + '</option>';
      }).join('');
      ctrl.innerHTML = '<label>要移除的标签</label><select id="op-target" aria-label="要移除的标签">' +
        '<option value="">— 选择标签 —</option>' + tagOpts + '</select>';
    } else {
      ctrl.innerHTML = '<label class="danger-label"><input type="checkbox" id="op-confirm-del"> ' +
        '我确认删除以下 <b>' + p.ids.length + '</b> 项（操作后可撤销）</label>';
    }

    // 控件事件
    var targetSel = document.getElementById('op-target');
    if (targetSel) targetSel.addEventListener('change', function () {
      state.pending.target = this.value;
      renderPreviewModal();
      var s = document.getElementById('op-target');
      if (s) s.focus();
    });
    var tagsInput = document.getElementById('op-tags');
    if (tagsInput) {
      tagsInput.value = p.tags;
      tagsInput.addEventListener('input', function () {
        state.pending.tags = this.value;
        renderPreviewModal();
        var i2 = document.getElementById('op-tags');
        i2.focus();
        i2.setSelectionRange(i2.value.length, i2.value.length);
      });
    }
    var delChk = document.getElementById('op-confirm-del');
    if (delChk) delChk.addEventListener('change', function () {
      state.pending.confirmDelete = this.checked;
      renderPreviewModal();
    });

    // 受影响集合（预览 = 执行的唯一来源）
    var op = pendingOp();
    var aff = op
      ? computeAffected(p.ids, op)
      : { apply: [], noop: p.ids.map(function (id) {
          var e = ENT_BY_ID[id];
          return { id: id, name: e.name, path: pathText(e.categoryId), reason: '尚未选择目标' };
        }) };

    document.getElementById('modal-summary').innerHTML =
      '<span class="mchip">已选 <b>' + p.ids.length + '</b> 项</span>' +
      '<span class="mchip ok">将生效 <b>' + aff.apply.length + '</b> 项</span>' +
      (aff.noop.length ? '<span class="mchip dim2">跳过（无变更）<b>' + aff.noop.length + '</b> 项</span>' : '');

    var rows = aff.apply.map(function (it) {
      var detail = '';
      if (p.type === 'status') detail = statusBadge(it.before) + ' <span class="arrow">→</span> ' + statusBadge(it.after);
      else if (p.type === 'move') detail = '<span class="dim small">' + esc(it.beforePath) + '</span> <span class="arrow">→</span> <span class="small">' + esc(it.afterPath) + '</span>';
      else if (p.type === 'tag-add' || p.type === 'tag-remove') detail = '<span class="dim">' + tagsText(it.beforeTags) + '</span> <span class="arrow">→</span> ' + tagsText(it.afterTags, true);
      else detail = statusBadge(it.before) + ' <span class="arrow">→</span> <span class="badge tone-danger">删除</span>';
      return '<div class="aff-row"><code>' + esc(it.id) + '</code><span class="aff-name">' + esc(it.name) + '</span>' +
        '<span class="aff-path dim">' + esc(it.path) + '</span><span class="aff-change">' + detail + '</span></div>';
    }).join('');
    var noopRows = aff.noop.map(function (it) {
      return '<div class="aff-row noop"><code>' + esc(it.id) + '</code><span class="aff-name">' + esc(it.name) + '</span>' +
        '<span class="aff-path dim">' + esc(it.path) + '</span><span class="aff-change dim">' + esc(it.reason) + '</span></div>';
    }).join('');
    document.getElementById('modal-list').innerHTML =
      (rows ? '<div class="aff-head">将生效（' + aff.apply.length + '）</div>' + rows : '') +
      (noopRows ? '<div class="aff-head dim-head">跳过——无变更（' + aff.noop.length + '）</div>' + noopRows : '');

    // 错误/可用性
    var err = validatePending();
    document.getElementById('modal-error').textContent = err || '';
    var btn = document.getElementById('btn-confirm');
    btn.disabled = !!err;
    btn.textContent = p.type === 'delete'
      ? '确认删除 ' + aff.apply.length + ' 项'
      : '确认执行（' + aff.apply.length + ' 项）';
  }

  function tagsText(tags, highlight) {
    if (!tags || !tags.length) return '<span class="dim">—</span>';
    return tags.map(function (t) {
      return '<span class="tag' + (highlight ? ' hl' : '') + '">' + esc(t) + '</span>';
    }).join(' ');
  }

  function pendingOp() {
    var p = state.pending;
    if (!p) return null;
    if (p.type === 'status' && p.target) return { type: 'status', target: p.target };
    if (p.type === 'move' && p.target) return { type: 'move', target: p.target };
    if (p.type === 'tag-add') {
      var tags = p.tags.split(/[,，]/).map(function (t) { return t.trim(); }).filter(Boolean);
      return tags.length ? { type: 'tag-add', tags: tags } : null;
    }
    if (p.type === 'tag-remove' && p.target) return { type: 'tag-remove', tag: p.target };
    if (p.type === 'delete') return { type: 'delete' };
    return null;
  }

  function validatePending() {
    var p = state.pending;
    if (!p) return '内部错误';
    var op = pendingOp();
    if (!op) {
      if (p.type === 'delete') return '请先勾选确认框';
      return p.type === 'tag-add' ? '请输入至少一个标签' : '请选择目标';
    }
    var aff = computeAffected(p.ids, op);
    if (!aff.apply.length) return '没有可生效的变更（全部所选实体已处于目标状态/位置）';
    if (p.type === 'delete' && !p.confirmDelete) return '请先勾选确认框';
    return '';
  }

  function confirmOp() {
    var p = state.pending;
    if (!p || validatePending()) return;
    var op = pendingOp();
    var aff = computeAffected(p.ids, op); // 与预览同一函数：作用集合=确认集合
    var time = new Date().toTimeString().slice(0, 8);
    // 快照含全字段，删除也可精确恢复
    var snapshot = aff.apply.map(function (it) {
      var e = it.e;
      return {
        id: e.id, name: e.name, owner: e.owner, note: e.note, updatedAt: e.updatedAt,
        status: e.status, categoryId: e.categoryId, tags: e.tags.slice()
      };
    });
    aff.apply.forEach(function (it) {
      var e = it.e;
      if (op.type === 'status') e.status = op.target;
      else if (op.type === 'move') e.categoryId = op.target;
      else if (op.type === 'tag-add') {
        op.tags.forEach(function (t) { if (e.tags.indexOf(t) === -1) e.tags.push(t); });
      } else if (op.type === 'tag-remove') {
        e.tags = e.tags.filter(function (t) { return t !== op.tag; });
      } else if (op.type === 'delete') {
        e._deleted = true;
      }
    });
    if (op.type === 'delete') {
      SEED.entities = SEED.entities.filter(function (e) { return !e._deleted; });
      aff.apply.forEach(function (it) {
        delete ENT_BY_ID[it.id];
        delete state.selection[it.id];
        delete state.detailOpen[it.id];
      });
    }
    var receipt;
    if (op.type === 'status') receipt = '已将 ' + aff.apply.length + ' 项状态改为「' + STATUS_BY_ID[op.target].label + '」';
    else if (op.type === 'move') receipt = '已将 ' + aff.apply.length + ' 项移动到「' + pathText(op.target) + '」';
    else if (op.type === 'tag-add') receipt = '已为 ' + aff.apply.length + ' 项添加标签「' + op.tags.join('、') + '」';
    else if (op.type === 'tag-remove') receipt = '已从 ' + aff.apply.length + ' 项移除标签「' + op.tag + '」';
    else receipt = '已删除 ' + aff.apply.length + ' 项';
    var record = {
      time: time,
      label: OP_META[p.type].title + ' ' + p.ids.length + ' 项',
      receipt: receipt,
      snapshot: snapshot,
      type: op.type,
      undone: false
    };
    state.ops.push(record);
    state.lastOp = record;
    state.pending = null;
    state.selection = {};
    state.anchor = null;
    document.getElementById('modal').hidden = true;
    renderAll();
  }

  function undoLast() {
    var op = state.lastOp;
    if (!op || op.undone) return;
    if (op.type === 'delete') {
      op.snapshot.forEach(function (s) {
        var e = {
          id: s.id, name: s.name, owner: s.owner, note: s.note, updatedAt: s.updatedAt,
          status: s.status, categoryId: s.categoryId, tags: s.tags.slice()
        };
        SEED.entities.push(e);
        ENT_BY_ID[s.id] = e;
      });
    } else {
      op.snapshot.forEach(function (s) {
        var e = ENT_BY_ID[s.id];
        if (!e) return;
        e.status = s.status;
        e.categoryId = s.categoryId;
        e.tags = s.tags.slice();
      });
    }
    op.undone = true;
    renderAll();
  }

  // ---------- 事件 ----------
  function treeToggle(id) { state.expanded[id] = !state.expanded[id]; renderAll(); }

  function wire() {
    var tree = document.getElementById('tree');
    tree.addEventListener('click', function (ev) {
      var caret = ev.target.closest('.caret[data-act="caret"]');
      if (caret) { treeToggle(caret.getAttribute('data-id')); return; }
      var row = ev.target.closest('.trow');
      if (!row) return;
      state.scopeNodeId = row.getAttribute('data-id');
      renderAll();
    });
    // 树键盘：容器为唯一 Tab 停留点，方向键巡航（ARIA tree 惯例）
    tree.addEventListener('keydown', function (ev) {
      var rows = Array.prototype.slice.call(tree.querySelectorAll('.trow'));
      var cur = document.activeElement && document.activeElement.closest
        ? document.activeElement.closest('.trow') : null;
      var i = cur ? rows.indexOf(cur) : -1;
      if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
        ev.preventDefault();
        var next = ev.key === 'ArrowDown' ? Math.min(i + 1, rows.length - 1) : (i === -1 ? 0 : Math.max(i - 1, 0));
        rows[next].focus();
      } else if (ev.key === 'Home' || ev.key === 'End') {
        ev.preventDefault();
        rows[ev.key === 'Home' ? 0 : rows.length - 1].focus();
      } else if (ev.key === 'ArrowRight' || ev.key === 'ArrowLeft') {
        if (!cur) return;
        ev.preventDefault();
        treeToggle(cur.getAttribute('data-id'));
        var again = tree.querySelector('.trow[data-id="' + cur.getAttribute('data-id') + '"]');
        if (again) again.focus();
      } else if (ev.key === 'Enter' || ev.key === ' ') {
        if (!cur) return;
        ev.preventDefault();
        state.scopeNodeId = cur.getAttribute('data-id');
        renderAll();
        var scopedRow = tree.querySelector('.trow[data-id="' + cur.getAttribute('data-id') + '"]');
        if (scopedRow) scopedRow.focus();
      }
    });

    // 工具栏
    document.getElementById('search').addEventListener('input', function () {
      state.query = this.value;
      renderAll();
    });
    document.getElementById('status-chips').addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-act="status-chip"]');
      if (!b) return;
      var id = b.getAttribute('data-id');
      if (state.statusFilter[id]) delete state.statusFilter[id];
      else state.statusFilter[id] = true;
      renderAll();
    });
    document.getElementById('btn-sel-visible').addEventListener('click', addVisible);
    document.getElementById('btn-sel-subtree').addEventListener('click', addSubtree);
    document.getElementById('btn-clear-filters').addEventListener('click', clearFilters);

    // 警示条
    document.getElementById('warn-strip').addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-act]');
      if (!b) return;
      var act = b.getAttribute('data-act');
      if (act === 'keep-visible') pruneToVisible();
      else if (act === 'toggle-list') { state.warnListOpen = !state.warnListOpen; renderWarn(); }
    });

    // 表格
    document.getElementById('thead').addEventListener('click', function (ev) {
      var th = ev.target.closest('th[data-sort]');
      if (!th) return;
      var k = th.getAttribute('data-sort');
      if (state.sortKey === k) state.sortDir *= -1;
      else { state.sortKey = k; state.sortDir = 1; }
      renderAll();
    });
    var tbody = document.getElementById('tbody');
    // 表格键盘：roving tabindex——仅当前行复选框在 Tab 序中，方向键巡航、空格选择、回车展开
    var tablewrap = document.getElementById('tablewrap');
    function roveTo(nextChk) {
      var prev = tbody.querySelector('input[data-act="row-check"][tabindex="0"]');
      if (prev && prev !== nextChk) prev.setAttribute('tabindex', '-1');
      nextChk.setAttribute('tabindex', '0');
      var rows = Array.prototype.slice.call(tbody.querySelectorAll('tr.ent'));
      var nr = nextChk.closest('tr.ent');
      state.activeRowIdx = rows.indexOf(nr);
    }
    tablewrap.addEventListener('keydown', function (ev) {
      if (ev.key !== 'ArrowDown' && ev.key !== 'ArrowUp' && ev.key !== 'Home' && ev.key !== 'End' && ev.key !== 'Enter') return;
      var rows = Array.prototype.slice.call(tbody.querySelectorAll('tr.ent'));
      if (!rows.length) return;
      var curRow = document.activeElement && document.activeElement.closest
        ? document.activeElement.closest('tr.ent') : null;
      var i = curRow ? rows.indexOf(curRow) : -1;
      ev.preventDefault();
      if (ev.key === 'Enter') {
        if (curRow) {
          var idd = curRow.getAttribute('data-id');
          state.detailOpen[idd] = !state.detailOpen[idd];
          renderTable();
          var again = tbody.querySelector('tr.ent[data-id="' + idd + '"] input[data-act="row-check"]');
          if (again) again.focus();
        }
        return;
      }
      var next = ev.key === 'ArrowDown' ? Math.min(i + 1, rows.length - 1)
        : ev.key === 'ArrowUp' ? Math.max(i - 1, 0)
        : ev.key === 'Home' ? 0 : rows.length - 1;
      var chk = rows[next].querySelector('input[data-act="row-check"]');
      if (chk) { chk.focus(); roveTo(chk); }
    });
    tbody.addEventListener('click', function (ev) {
      if (ev.target.closest('[data-act="clear-filters"]')) { clearFilters(); return; }
      var nameBtn = ev.target.closest('[data-act="detail"]');
      if (nameBtn) {
        var idd = nameBtn.getAttribute('data-id');
        state.detailOpen[idd] = !state.detailOpen[idd];
        renderTable();
        return;
      }
      var chk = ev.target.closest('input[data-act="row-check"]');
      if (chk && ev.shiftKey && state.anchor) {
        ev.preventDefault(); // 范围选择=只加选，不翻转当前框
        shiftRange(chk.getAttribute('data-id'));
      }
    });
    tbody.addEventListener('change', function (ev) {
      var chk = ev.target.closest('input[data-act="row-check"]');
      if (!chk) return;
      var id = chk.getAttribute('data-id');
      if (chk.checked) state.selection[id] = true;
      else delete state.selection[id];
      state.anchor = id;
      renderAll();
    });
    document.getElementById('head-check').addEventListener('click', function () {
      var list = visibleList();
      var allSel = list.length && list.every(function (e) { return state.selection[e.id]; });
      if (allSel) list.forEach(function (e) { delete state.selection[e.id]; });
      else list.forEach(function (e) { state.selection[e.id] = true; });
      renderAll();
    });

    // 操作条
    document.getElementById('actionbar').addEventListener('click', function (ev) {
      var b = ev.target.closest('button[data-op]');
      if (!b) return;
      openPreview(b.getAttribute('data-op'));
    });
    document.getElementById('btn-ab-clear').addEventListener('click', clearSel);

    // 模态
    document.getElementById('btn-cancel').addEventListener('click', closePreview);
    document.getElementById('btn-x').addEventListener('click', closePreview);
    document.getElementById('btn-confirm').addEventListener('click', confirmOp);
    document.getElementById('modal').addEventListener('click', function (ev) {
      if (ev.target === document.getElementById('modal')) closePreview();
    });

    // 状态栏
    document.getElementById('statusbar').addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-act]');
      if (!b) return;
      var act = b.getAttribute('data-act');
      if (act === 'undo') undoLast();
      else if (act === 'toggle-ops') { state.opsPanelOpen = !state.opsPanelOpen; renderStatusbar(); }
    });

    // 键盘契约：/ 聚焦搜索；Esc 关闭模态
    document.addEventListener('keydown', function (ev) {
      var tag = document.activeElement ? document.activeElement.tagName : '';
      if (ev.key === '/' && !/INPUT|SELECT|TEXTAREA/.test(tag)) {
        ev.preventDefault();
        document.getElementById('search').focus();
      }
      if (ev.key === 'Escape' && state.pending) closePreview();
    });

    window.addEventListener('error', function (e) {
      var el = document.getElementById('errbanner');
      el.hidden = false;
      el.textContent = '运行错误：' + (e.message || '未知错误');
    });
  }

  function clearFilters() {
    state.query = '';
    state.statusFilter = {};
    state.scopeNodeId = 'root';
    document.getElementById('search').value = '';
    renderAll();
  }

  // ---------- 演示场景（供自动化截图取证；不影响正常使用） ----------
  function runScene() {
    var m = /scene=(\w+)/.exec(location.search);
    if (!m) return;
    var scene = m[1];
    if (scene === 'selected') {
      // 选中「产线设备」子树全部，再只显示「在用」→ 隐藏已选警示 + 操作条
      entitiesInNode('c3').forEach(function (e) { state.selection[e.id] = true; });
      state.statusFilter = { active: true };
      renderAll();
    } else if (scene === 'preview') {
      entitiesInNode('c11').forEach(function (e) { state.selection[e.id] = true; });
      renderAll();
      openPreview('status');
      state.pending.target = 'disabled';
      renderPreviewModal();
    } else if (scene === 'delete') {
      entitiesInNode('c34').forEach(function (e) { state.selection[e.id] = true; });
      renderAll();
      openPreview('delete');
    } else if (scene === 'detail') {
      var first = visibleList()[0];
      if (first) state.detailOpen[first.id] = true;
      entitiesInNode('c21').forEach(function (e) { state.selection[e.id] = true; });
      renderAll();
    } else if (scene === 'receipt') {
      // 走真实执行路径：选择→预览→确认，截取回执与撤销按钮
      entitiesInNode('c11').forEach(function (e) { state.selection[e.id] = true; });
      renderAll();
      openPreview('status');
      state.pending.target = 'disabled';
      renderPreviewModal();
      confirmOp();
    } else if (scene === 'undo') {
      entitiesInNode('c11').forEach(function (e) { state.selection[e.id] = true; });
      renderAll();
      openPreview('status');
      state.pending.target = 'disabled';
      renderPreviewModal();
      confirmOp();
      undoLast();
      state.opsPanelOpen = true;
      renderStatusbar();
    } else if (scene === 'selftest') {
      runSelfTest();
    }
  }

  // ---------- 自测：派发真实 DOM 事件走完整用户旅程并断言（仅供自动化取证） ----------
  function runSelfTest() {
    var out = [];
    function t(name, fn) {
      try {
        var got = fn();
        out.push((got === true ? 'PASS' : 'FAIL') + ' ' + name + (got === true ? '' : ' => ' + got));
      } catch (ex) {
        out.push('FAIL ' + name + ' => 异常 ' + ex.message);
      }
    }
    function text(sel) { var el = document.querySelector(sel); return el ? el.textContent.trim() : '(无元素)'; }
    function rows() { return document.querySelectorAll('#tbody tr.ent').length; }

    t('A 树点击「生产运营」切换范围', function () {
      document.querySelector('#tree .trow[data-id="d2"]').click();
      return text('#scope-crumb') === '范围：生产运营（含子层级）' && rows() === 42 ? true : text('#scope-crumb') + ' / rows=' + rows();
    });
    t('B 选子树全部 → 操作条与计数', function () {
      document.getElementById('btn-sel-subtree').click();
      return !document.getElementById('actionbar').hidden && text('#ab-count').indexOf('已选 42 项') !== -1 ? true : text('#ab-count');
    });
    t('C 状态筛选→隐藏已选警示', function () {
      document.querySelector('#status-chips [data-id="active"]').click();
      var w = text('#warn-text');
      return w.indexOf('有 19 项') !== -1 && text('#ab-count').indexOf('19 项当前不可见') !== -1 ? true : w + ' | ' + text('#ab-count');
    });
    t('D 查看隐藏项列表展开', function () {
      document.querySelector('#warn [data-act="toggle-list"]').click();
      return document.querySelectorAll('#warn-list .warn-item').length === 19 ? true : 'items=' + document.querySelectorAll('#warn-list .warn-item').length;
    });
    t('E 打开改状态模态', function () {
      document.querySelector('#actionbar [data-op="status"]').click();
      return !document.getElementById('modal').hidden && text('#modal-title') === '批量修改状态' ? true : text('#modal-title');
    });
    t('F 选目标状态→预览 35 项生效/7 项跳过', function () {
      var sel = document.getElementById('op-target');
      sel.value = 'disabled';
      sel.dispatchEvent(new Event('change'));
      var s = text('#modal-summary');
      return s.indexOf('将生效 35') !== -1 && s.indexOf('跳过（无变更）7') !== -1 &&
        !document.getElementById('btn-confirm').disabled &&
        text('#btn-confirm') === '确认执行（35 项）' ? true : s + ' | ' + text('#btn-confirm');
    });
    t('G 确认执行→回执与逐项守恒（零误伤）', function () {
      document.getElementById('btn-confirm').click();
      document.querySelector('#status-chips [data-id="active"]').click(); // 取消「只显示在用」，恢复全可见
      var rc = text('#receipt');
      var chipMuted = text('#status-chips [data-id="disabled"]').replace(/\s+/g, '');
      var badgeMuted = document.querySelectorAll('#tbody .badge.tone-muted').length;
      return rc.indexOf('已将 35 项状态改为「已停用」') !== -1 && chipMuted.indexOf('69') !== -1 && badgeMuted === 42 ? true : rc + ' | chip=' + chipMuted + ' | 可见已停用行=' + badgeMuted;
    });
    t('H 撤销→计数恢复', function () {
      document.querySelector('#receipt [data-act="undo"]').click();
      var rc = text('#receipt');
      var chipMuted = text('#status-chips [data-id="disabled"]').replace(/\s+/g, '');
      var badgeMuted = document.querySelectorAll('#tbody .badge.tone-muted').length;
      return rc.indexOf('已撤销') !== -1 && chipMuted.indexOf('34') !== -1 && badgeMuted === 7 ? true : rc + ' | chip=' + chipMuted + ' | 可见已停用行=' + badgeMuted;
    });
    t('I 键盘 / 聚焦搜索', function () {
      if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
      document.dispatchEvent(new KeyboardEvent('keydown', { key: '/', bubbles: true }));
      return document.activeElement === document.getElementById('search') ? true : document.activeElement.id;
    });
    t('J 键盘进入表格→方向键→选择（roving tabindex）', function () {
      var chk = document.querySelector('#tbody input[data-act="row-check"][tabindex="0"]');
      if (!chk) return '无 tabindex=0 的活动行复选框';
      chk.focus();
      chk.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      var chk2 = document.activeElement;
      var isCheck = chk2 && chk2.matches && chk2.matches('input[data-act="row-check"]') && chk2 !== chk;
      if (!isCheck) return '方向键未下移焦点';
      chk2.click(); // 原生 click = 空格切换等效路径，触发 change
      return !document.getElementById('actionbar').hidden && text('#ab-count').indexOf('已选 1 项') !== -1 ? true : text('#ab-count');
    });
    t('K 删除模态门禁（未勾选禁用+错误文案；Esc 关闭）', function () {
      document.getElementById('btn-ab-clear').click();
      document.getElementById('btn-sel-subtree').click();
      document.querySelector('#actionbar [data-op="delete"]').click();
      var gate = document.getElementById('btn-confirm').disabled && text('#modal-error') === '请先勾选确认框';
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      return gate && document.getElementById('modal').hidden ? true : 'gate=' + gate + ' err=' + text('#modal-error');
    });
    t('L 状态列排序（升序非递减）', function () {
      document.getElementById('btn-clear-filters').click();
      document.querySelector('#thead th[data-sort="status"]').click();
      var labels = Array.prototype.map.call(document.querySelectorAll('#tbody tr.ent .c-status .badge'), function (b) { return b.textContent; });
      for (var i = 1; i < labels.length; i++) {
        if (labels[i - 1] > labels[i]) return '第 ' + (i - 1) + '>' + i + ' 项逆序: ' + labels[i - 1] + '>' + labels[i];
      }
      return labels.length === 214 ? true : 'rows=' + labels.length;
    });

    var host = document.getElementById('selftest-out');
    var pass = out.filter(function (l) { return l.indexOf('PASS') === 0; }).length;
    host.textContent = 'SELFTEST ' + pass + '/' + out.length + ' :: ' + out.join(' ;; ');
    host.hidden = false;
    document.getElementById('btn-clear-filters').click();
    state.statusFilter = {};
    renderAll();
  }

  // ---------- 启动：同步就绪，无加载态 ----------
  wire();
  renderAll();
  runScene();
})();
