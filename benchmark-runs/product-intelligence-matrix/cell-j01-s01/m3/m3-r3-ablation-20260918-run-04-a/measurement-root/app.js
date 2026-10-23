/* TreeLedger — 层级实体批量管理：零误伤批量操作 + 状态归属显式 */
(function () {
  'use strict';

  /* ---------- 数据索引 ---------- */
  const nodes = window.SEED.nodes;
  const byId = new Map(nodes.map(function (n) { return [n.id, n]; }));
  const children = new Map();
  nodes.forEach(function (n) {
    const k = n.parentId || 'root';
    if (!children.has(k)) children.set(k, []);
    children.get(k).push(n);
  });
  const roots = children.get('root');

  const descCache = new Map();
  function descendantsOf(id) {
    if (descCache.has(id)) return descCache.get(id);
    const out = [];
    const stack = [id];
    while (stack.length) {
      const cur = stack.pop();
      out.push(cur);
      (children.get(cur) || []).forEach(function (c) { stack.push(c.id); });
    }
    descCache.set(id, out);
    return out;
  }
  const devCache = new Map();
  function devicesUnder(id) {
    if (!devCache.has(id)) devCache.set(id, descendantsOf(id).filter(function (x) { return byId.get(x).type === 'device'; }));
    return devCache.get(id);
  }
  function aliveDevices() { return nodes.filter(function (n) { return n.type === 'device' && !n.deleted; }); }

  const STATUS = {
    running: { label: '运行' },
    maintenance: { label: '维护' },
    stopped: { label: '停用' },
    scrapping: { label: '待报废' }
  };
  const STATUS_ORDER = ['running', 'maintenance', 'stopped', 'scrapping'];

  function pathParts(id) {
    const parts = [];
    let cur = byId.get(id);
    while (cur) { parts.unshift(cur.name); cur = cur.parentId ? byId.get(cur.parentId) : null; }
    return parts;
  }
  function pathStr(id) { return pathParts(id).join(' / '); }

  const $ = function (s) { return document.querySelector(s); };
  const esc = function (s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  /* ---------- 应用状态 ---------- */
  const state = {
    selection: new Set(),   // 显式选中的节点 id（可含 region/system/device）
    open: new Set(),        // 树中展开的节点
    focusId: null,          // 表格范围（子树过滤）
    search: '',
    statusFilter: 'all',
    showSystems: false,
    ops: []                 // 操作记录：{id, time, kind, target?, changes:[[id,from,to]], undone}
  };
  roots.forEach(function (r) { state.open.add(r.id); });

  /* ---------- 选择语义：勾选组节点 = 显式选中其全部后代 ---------- */
  function setSubtreeSelected(id, on) {
    descendantsOf(id).forEach(function (d) { if (on) state.selection.add(d); else state.selection.delete(d); });
  }
  function selectedDevices() {
    const set = new Set();
    state.selection.forEach(function (id) {
      const n = byId.get(id);
      if (!n || n.deleted) return;
      if (n.type === 'device') { set.add(id); return; }
      descendantsOf(id).forEach(function (d) {
        const m = byId.get(d);
        if (m.type === 'device' && !m.deleted) set.add(d);
      });
    });
    return set;
  }
  // 三态：2=子树下设备全选 1=部分选中 0=未选（按设备叶子判定）
  function selectionStateOf(id) {
    const devs = devicesUnder(id).filter(function (d) { return !byId.get(d).deleted; });
    if (!devs.length) return state.selection.has(id) ? 2 : 0;
    let sel = 0;
    devs.forEach(function (d) { if (state.selection.has(d)) sel++; });
    if (sel === 0) return 0;
    return sel === devs.length ? 2 : 1;
  }

  /* ---------- 渲染：顶部统计 ---------- */
  function renderStats() {
    const devs = aliveDevices();
    const counts = { running: 0, maintenance: 0, stopped: 0, scrapping: 0 };
    devs.forEach(function (d) { counts[d.status]++; });
    let html = '<span class="stat"><b>' + devs.length + '</b> 台设备</span>';
    STATUS_ORDER.forEach(function (k) {
      html += '<span class="stat"><i class="dot dot-' + k + '"></i>' + STATUS[k].label + ' <b>' + counts[k] + '</b></span>';
    });
    $('#stats').innerHTML = html;
  }

  /* ---------- 渲染：层级树 ---------- */
  function nodeRow(n, depth) {
    const sel = selectionStateOf(n.id);
    const open = n.type !== 'device' && state.open.has(n.id);
    let meta = '';
    if (n.type === 'region') {
      const sysCount = (children.get(n.id) || []).length;
      meta = sysCount + ' 系统 · ' + devicesUnder(n.id).filter(function (d) { return !byId.get(d).deleted; }).length + ' 台';
    } else if (n.type === 'system') {
      meta = devicesUnder(n.id).filter(function (d) { return !byId.get(d).deleted; }).length + ' 台';
    }
    const dot = n.type === 'device' ? '<i class="dot dot-' + n.status + '"></i>' : '';
    const tw = n.type !== 'device'
      ? '<button class="tw' + (open ? ' open' : '') + '" data-act="toggle" aria-label="展开/折叠"></button>'
      : '<span class="tw-space"></span>';
    return '<div class="tn d' + depth + (state.focusId === n.id ? ' focused' : '') + '" data-id="' + n.id + '">' +
      tw +
      '<input type="checkbox" data-act="check"' + (sel === 2 ? ' checked' : '') + (sel === 1 ? ' class="indeterminate"' : '') + '>' +
      dot +
      '<span class="tn-name" data-act="focus">' + esc(n.name) + '</span>' +
      (meta ? '<span class="tn-meta">' + meta + '</span>' : '') +
      (n.deleted ? '<span class="tn-deleted">已删除</span>' : '') +
      '</div>';
  }
  function renderTree() {
    let html = '';
    const walk = function (n, depth) {
      html += nodeRow(n, depth);
      if (n.type !== 'device' && state.open.has(n.id)) {
        (children.get(n.id) || []).forEach(function (c) { walk(c, depth + 1); });
      }
    };
    roots.forEach(function (r) { walk(r, 0); });
    $('#tree').innerHTML = html;
    document.querySelectorAll('input.indeterminate').forEach(function (el) { el.indeterminate = true; });
  }

  /* ---------- 渲染：设备表 ---------- */
  function visibleRows() {
    const focusSet = state.focusId ? new Set(descendantsOf(state.focusId)) : null;
    const q = state.search.trim().toLowerCase();
    return nodes.filter(function (n) {
      if (n.deleted) return false;
      if (n.type === 'system') { if (!state.showSystems || state.statusFilter !== 'all') return false; }
      else if (n.type !== 'device') return false;
      if (focusSet && !focusSet.has(n.id)) return false;
      if (q && n.name.toLowerCase().indexOf(q) < 0 && n.code.toLowerCase().indexOf(q) < 0) return false;
      if (state.statusFilter !== 'all' && n.status !== state.statusFilter) return false;
      return true;
    });
  }
  function rowHtml(n) {
    const isDev = n.type === 'device';
    const sel = state.selection.has(n.id);
    const statusCell = isDev
      ? '<select class="status-sel st-' + n.status + '" data-act="status" data-id="' + n.id + '">' +
        STATUS_ORDER.map(function (k) {
          return '<option value="' + k + '"' + (k === n.status ? ' selected' : '') + '>' + STATUS[k].label + '</option>';
        }).join('') + '</select>'
      : '<span class="muted">—</span>';
    return '<tr class="' + (sel ? 'row-sel' : '') + '" data-id="' + n.id + '">' +
      '<td><input type="checkbox" data-act="rowcheck"' + (sel ? ' checked' : '') + '></td>' +
      '<td class="c-code">' + esc(n.code) + '</td>' +
      '<td class="c-name">' + (isDev ? '' : '<span class="tag-sys">系统</span>') + esc(n.name) + '</td>' +
      '<td class="c-path">' + esc(pathStr(n.parentId)) + '</td>' +
      '<td>' + statusCell + '</td>' +
      '</tr>';
  }
  function renderTable() {
    const rows = visibleRows();
    $('#tbl-body').innerHTML = rows.length
      ? rows.map(rowHtml).join('')
      : '<tr><td colspan="5" class="empty">没有匹配的设备 —— 试试调整搜索、状态筛选或范围</td></tr>';
    $('#row-count').textContent = '显示 ' + rows.length + ' 条';
    const vis = rows.filter(function (r) { return r.type === 'device'; });
    const allSel = vis.length > 0 && vis.every(function (r) { return state.selection.has(r.id); });
    const btn = $('#btn-selectvisible');
    btn.textContent = allSel ? '取消全选可见' : '全选可见';
    btn.dataset.mode = allSel ? 'off' : 'on';
  }

  /* ---------- 渲染：批量操作条 ---------- */
  function renderBatchBar() {
    const bar = $('#batchbar');
    if (!state.selection.size) { bar.hidden = true; return; }
    const devs = selectedDevices();
    let groupCount = 0;
    state.selection.forEach(function (id) { if (byId.get(id).type !== 'device') groupCount++; });
    const counts = {};
    devs.forEach(function (d) { const s = byId.get(d).status; counts[s] = (counts[s] || 0) + 1; });
    const breakdown = STATUS_ORDER.filter(function (k) { return counts[k]; })
      .map(function (k) { return STATUS[k].label + ' ' + counts[k]; }).join(' · ');
    $('#bb-info').innerHTML = '已选 <b>' + state.selection.size + '</b> 项 ＝ 设备 <b>' + devs.size + '</b> 台' +
      (breakdown ? '（' + breakdown + '）' : '') +
      (groupCount ? ' ＋ 组织节点 ' + groupCount + ' 个（其下设备已计入，节点本身不改动）' : '');
    bar.hidden = false;
    $('#btn-status').disabled = devs.size === 0;
    $('#btn-delete').disabled = devs.size === 0;
    $('#btn-export').disabled = devs.size === 0;
    $('#tree-sel-count').textContent = state.selection.size;
  }

  /* ---------- 渲染：范围 chip / 操作记录 ---------- */
  function renderFocusChip() {
    const chip = $('#focus-chip');
    if (!state.focusId) { chip.hidden = true; return; }
    chip.hidden = false;
    chip.innerHTML = '范围：' + esc(pathStr(state.focusId)) + ' <button id="chip-x" title="清除范围">✕</button>';
    $('#chip-x').onclick = function () { state.focusId = null; renderAll(); };
  }
  function opSummary(op) {
    return op.kind === 'status'
      ? op.changes.length + ' 台设备状态 →「' + STATUS[op.target].label + '」'
      : '删除 ' + op.changes.length + ' 台设备';
  }
  function latestActiveOp() {
    for (let i = state.ops.length - 1; i >= 0; i--) if (!state.ops[i].undone) return state.ops[i];
    return null;
  }
  function renderOpLog() {
    const last = latestActiveOp();
    $('#op-count').textContent = state.ops.filter(function (o) { return !o.undone; }).length;
    if (!state.ops.length) { $('#op-list').innerHTML = '<div class="op-empty">暂无操作记录</div>'; return; }
    let html = '';
    state.ops.slice().reverse().forEach(function (op) {
      const codes = op.changes.slice(0, 3).map(function (c) { return byId.get(c[0]).code; }).join('、');
      const detail = op.changes.length > 3 ? codes + ' 等 ' + op.changes.length + ' 条' : codes;
      const action = op.undone
        ? '<span class="op-tag">已撤销</span>'
        : (op === last
          ? '<button class="btn btn-sm" data-undo="' + op.id + '">撤销</button>'
          : '<span class="op-tag">需先撤销其后的操作</span>');
      html += '<div class="op' + (op.undone ? ' op-undone' : '') + '">' +
        '<div class="op-top"><span class="op-kind">' + (op.kind === 'status' ? '改状态' : '删除') + '</span>' +
        '<span>' + op.time.toLocaleTimeString('zh-CN', { hour12: false }) + '</span></div>' +
        '<div class="op-sum">' + esc(opSummary(op)) + '</div>' +
        '<div class="op-detail">' + esc(detail) + '</div>' +
        '<div class="op-act">' + action + '</div>' +
        '</div>';
    });
    $('#op-list').innerHTML = html;
  }

  function renderAll() {
    renderStats();
    renderTree();
    renderTable();
    renderBatchBar();
    renderOpLog();
    renderFocusChip();
  }

  /* ---------- 操作执行（可撤销） ---------- */
  let opSeq = 0;
  function afterMutation(msg) {
    renderAll();
    const last = latestActiveOp();
    toast(msg, last ? last.id : null);
  }
  function commitStatus(target, devIds) {
    const changes = Array.from(devIds).map(function (id) { return [id, byId.get(id).status, target]; });
    changes.forEach(function (c) { byId.get(c[0]).status = c[2]; });
    state.ops.push({ id: 'op' + (++opSeq), time: new Date(), kind: 'status', target: target, changes: changes, undone: false });
    afterMutation('已将 ' + changes.length + ' 台设备状态改为「' + STATUS[target].label + '」');
  }
  function commitDelete(devIds) {
    const ids = Array.from(devIds);
    const changes = ids.map(function (id) { return [id, byId.get(id).status, null]; });
    ids.forEach(function (id) { byId.get(id).deleted = true; state.selection.delete(id); });
    state.ops.push({ id: 'op' + (++opSeq), time: new Date(), kind: 'delete', changes: changes, undone: false });
    afterMutation('已删除 ' + ids.length + ' 台设备（可在操作记录中撤销恢复）');
  }
  function undoOp(op) {
    if (op.kind === 'status') op.changes.forEach(function (c) { byId.get(c[0]).status = c[1]; });
    else op.changes.forEach(function (c) { byId.get(c[0]).deleted = false; });
    op.undone = true;
    afterMutation('已撤销：' + opSummary(op));
  }

  /* ---------- 提示 ---------- */
  function toast(msg, undoOpId) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = '<span>' + esc(msg) + '</span>' +
      (undoOpId ? '<button class="t-undo" data-tundo="' + undoOpId + '">撤销</button>' : '');
    $('#toasts').appendChild(el);
    setTimeout(function () { el.classList.add('gone'); }, 5200);
    setTimeout(function () { el.remove(); }, 5600);
  }

  /* ---------- 批量确认弹窗（逐台枚举 = 零误伤凭据） ---------- */
  function openModal(html) { $('#modal-card').innerHTML = html; $('#modal').hidden = false; }
  function closeModal() { $('#modal').hidden = true; }
  function groupBySystem(devIds) {
    const groups = new Map();
    devIds.forEach(function (id) {
      const p = byId.get(id).parentId;
      if (!groups.has(p)) groups.set(p, []);
      groups.get(p).push(id);
    });
    return Array.from(groups.entries()).sort(function (a, b) {
      return pathStr(a[0]).localeCompare(pathStr(b[0]), 'zh-CN');
    });
  }
  function confirmStatus(target) {
    const devs = selectedDevices();
    if (!devs.size) { toast('未选中任何设备'); return; }
    const total = aliveDevices().length;
    let listHtml = '';
    groupBySystem(devs).forEach(function (g) {
      const ids = g[1].slice().sort(function (a, b) { return byId.get(a).code.localeCompare(byId.get(b).code); });
      listHtml += '<div class="cg-head">' + esc(pathStr(g[0])) + '<span>' + ids.length + ' 台</span></div>';
      ids.forEach(function (id) {
        const d = byId.get(id);
        listHtml += '<div class="cg-row"><span class="c-code">' + esc(d.code) + '</span><span>' + esc(d.name) + '</span>' +
          '<span class="chg"><i class="dot dot-' + d.status + '"></i>' + STATUS[d.status].label +
          '<b class="arr">→</b><i class="dot dot-' + target + '"></i>' + STATUS[target].label + '</span></div>';
      });
    });
    openModal(
      '<div class="m-head"><h3>批量修改状态</h3></div>' +
      '<p class="m-scope">将把选中的 <b>' + devs.size + '</b> 台设备状态修改为 <b class="hl-' + target + '">「' + STATUS[target].label + '」</b>。</p>' +
      '<div class="m-guard">✔ 范围核对：本次操作<b>精确作用于下列 ' + devs.size + ' 台设备</b>；全库共 ' + total +
      ' 台，未列出的 ' + (total - devs.size) + ' 台不受任何影响。组织节点不带状态，不会被修改。</div>' +
      '<div class="m-list">' + listHtml + '</div>' +
      '<div class="m-foot"><button class="btn" id="m-cancel">取消</button>' +
      '<button class="btn btn-primary" id="m-ok">确认执行（' + devs.size + ' 台）</button></div>'
    );
    $('#m-cancel').onclick = closeModal;
    $('#m-ok').onclick = function () { closeModal(); commitStatus(target, devs); };
  }
  function confirmDelete() {
    const devs = selectedDevices();
    if (!devs.size) { toast('未选中任何设备'); return; }
    let listHtml = '';
    groupBySystem(devs).forEach(function (g) {
      const ids = g[1].slice().sort(function (a, b) { return byId.get(a).code.localeCompare(byId.get(b).code); });
      listHtml += '<div class="cg-head">' + esc(pathStr(g[0])) + '<span>' + ids.length + ' 台</span></div>';
      ids.forEach(function (id) {
        const d = byId.get(id);
        listHtml += '<div class="cg-row"><span class="c-code">' + esc(d.code) + '</span><span>' + esc(d.name) + '</span>' +
          '<span class="chg"><i class="dot dot-' + d.status + '"></i>' + STATUS[d.status].label + '</span></div>';
      });
    });
    openModal(
      '<div class="m-head"><h3>批量删除设备</h3></div>' +
      '<p class="m-scope">将从台账中移除选中的 <b>' + devs.size + '</b> 台设备。</p>' +
      '<div class="m-guard guard-red">✔ 范围核对：仅删除下列 <b>' + devs.size + ' 台设备</b>；组织节点（区域 / 系统）不会被删除，其下未选中设备不受影响。删除可在操作记录中一键撤销恢复。</div>' +
      '<div class="m-list">' + listHtml + '</div>' +
      '<div class="m-foot"><button class="btn" id="m-cancel">取消</button>' +
      '<button class="btn btn-danger" id="m-ok">确认删除（' + devs.size + ' 台）</button></div>'
    );
    $('#m-cancel').onclick = closeModal;
    $('#m-ok').onclick = function () { closeModal(); commitDelete(devs); };
  }

  /* ---------- CSV 导出 ---------- */
  const escCsv = function (v) { return '"' + String(v).replace(/"/g, '""') + '"'; };
  function exportCsv() {
    const devs = Array.from(selectedDevices()).map(function (id) { return byId.get(id); })
      .sort(function (a, b) { return a.code.localeCompare(b.code); });
    const lines = [['编码', '名称', '区域', '系统', '状态'].map(escCsv).join(',')].concat(
      devs.map(function (d) {
        const parts = pathParts(d.parentId);
        return [d.code, d.name, parts[0], parts[1], STATUS[d.status].label].map(escCsv).join(',');
      })
    );
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'treeledger-export-' + new Date().toISOString().slice(0, 10) + '.csv';
    a.click();
    URL.revokeObjectURL(a.href);
    toast('已导出 ' + devs.length + ' 条设备记录');
  }

  /* ---------- 事件 ---------- */
  $('#tree').addEventListener('click', function (e) {
    const tn = e.target.closest('.tn');
    if (!tn) return;
    const t = e.target.closest('[data-act]');
    if (!t) return;
    const id = tn.dataset.id;
    const act = t.dataset.act;
    if (act === 'toggle') { if (state.open.has(id)) state.open.delete(id); else state.open.add(id); renderTree(); }
    else if (act === 'check') { setSubtreeSelected(id, t.checked); renderAll(); }
    else if (act === 'focus') { state.focusId = state.focusId === id ? null : id; renderAll(); }
  });

  $('#tbl-body').addEventListener('click', function (e) {
    const t = e.target.closest('[data-act]');
    if (!t || t.dataset.act !== 'rowcheck') return;
    const id = t.closest('tr').dataset.id;
    const n = byId.get(id);
    if (n.type === 'device') { if (t.checked) state.selection.add(id); else state.selection.delete(id); }
    else setSubtreeSelected(id, t.checked);
    renderAll();
  });
  $('#tbl-body').addEventListener('change', function (e) {
    const t = e.target.closest('[data-act]');
    if (t && t.dataset.act === 'status') commitStatus(t.value, [t.dataset.id]);
  });

  $('#inp-search').addEventListener('input', function (e) { state.search = e.target.value; renderTable(); });
  $('#sel-status').addEventListener('change', function (e) { state.statusFilter = e.target.value; renderTable(); });
  $('#cb-systems').addEventListener('change', function (e) { state.showSystems = e.target.checked; renderTable(); });

  $('#btn-selectvisible').addEventListener('click', function () {
    const ids = visibleRows().filter(function (r) { return r.type === 'device'; }).map(function (r) { return r.id; });
    const off = this.dataset.mode === 'off';
    ids.forEach(function (id) { if (off) state.selection.delete(id); else state.selection.add(id); });
    renderAll();
  });
  function clearSel() { state.selection.clear(); renderAll(); }
  $('#btn-clearsel').addEventListener('click', clearSel);
  $('#btn-clear').addEventListener('click', clearSel);

  $('#btn-status').addEventListener('click', function (e) {
    e.stopPropagation();
    $('#dd-status').hidden = !$('#dd-status').hidden;
  });
  document.addEventListener('click', function () { $('#dd-status').hidden = true; });
  $('#dd-status').addEventListener('click', function (e) {
    const b = e.target.closest('[data-status]');
    if (!b) return;
    $('#dd-status').hidden = true;
    confirmStatus(b.dataset.status);
  });
  $('#btn-delete').addEventListener('click', confirmDelete);
  $('#btn-export').addEventListener('click', exportCsv);

  $('#btn-expand').addEventListener('click', function () {
    nodes.forEach(function (n) { if (n.type !== 'device') state.open.add(n.id); });
    renderTree();
  });
  $('#btn-collapse').addEventListener('click', function () { state.open.clear(); renderTree(); });

  $('#btn-log').addEventListener('click', function () { $('#oplog').classList.toggle('show'); });
  $('#btn-log-close').addEventListener('click', function () { $('#oplog').classList.remove('show'); });
  $('#op-list').addEventListener('click', function (e) {
    const b = e.target.closest('[data-undo]');
    if (!b) return;
    const op = state.ops.find(function (o) { return o.id === b.dataset.undo; });
    if (op && op === latestActiveOp()) undoOp(op);
  });

  $('#toasts').addEventListener('click', function (e) {
    const b = e.target.closest('[data-tundo]');
    if (!b) return;
    const op = state.ops.find(function (o) { return o.id === b.dataset.tundo; });
    if (op && op === latestActiveOp()) { undoOp(op); b.closest('.toast').remove(); }
  });

  $('#modal').addEventListener('click', function (e) { if (e.target === $('#modal')) closeModal(); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { closeModal(); $('#dd-status').hidden = true; }
  });

  renderAll();
})();
