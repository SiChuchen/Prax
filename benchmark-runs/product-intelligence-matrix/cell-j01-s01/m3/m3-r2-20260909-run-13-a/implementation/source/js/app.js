/* AssetGrid — 应用逻辑（无框架、无构建、无网络请求） */
(function () {
'use strict';

var D = window.DATA;
var STATUS_META = D.STATUS_META;
var STATUS_ORDER = D.STATUS_ORDER;
var DEFAULT_STATUS = D.DEFAULT_STATUS;

/* ================= 工具 ================= */
function $(sel, root) { return (root || document).querySelector(sel); }
function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
function el(tag, cls, html) {
  var n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html != null) n.innerHTML = html;
  return n;
}
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
function groupById(id) {
  for (var i = 0; i < D.GROUPS.length; i++) if (D.GROUPS[i].id === id) return D.GROUPS[i];
  return null;
}
function chain(id) { // 自身 → 根
  var out = [], g = groupById(id);
  while (g) { out.push(g); g = g.parent ? groupById(g.parent) : null; }
  return out;
}
function isWithin(gid, ancestorId) {
  return chain(gid).some(function (g) { return g.id === ancestorId; });
}
function groupPathLabel(gid) {
  return chain(gid).reverse().map(function (g) { return g.name; }).join(' › ');
}
function statusLabel(v) { return STATUS_META[v] ? STATUS_META[v].label : String(v); }
function pad2(n) { return n < 10 ? '0' + n : '' + n; }
function fmtTime(d) { return pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds()); }
function byId(id) {
  for (var i = 0; i < state.entities.length; i++) if (state.entities[i].id === id) return state.entities[i];
  return null;
}

/* ================= 状态 ================= */
var state = {
  entities: D.ENTITIES.slice(),
  selection: new Set(),
  scopeMode: 'direct',          // 分组勾选范围：direct 仅直属 | all 含子孙
  focus: 'ALL',                 // 表格关注的分组子树
  search: '',
  statusFilter: 'ALL',
  onlySelected: false,
  expanded: new Set(D.GROUPS.map(function (g) { return g.id; })),
  log: [],                      // 事务日志（新→旧）
  lastTx: null,                 // 最近一次可撤销事务
  txSeq: 0,
  confirm: null,                // 批量操作确认单
  policyModal: null,            // 分组策略弹窗
  drawerOpen: false,
  result: null                  // 操作结果卡片
};

var OPS = {
  status: { label: '修改状态' },
  move:   { label: '移动分组' },
  tag:    { label: '添加标签' },
  delete: { label: '删除设备' }
};

/* 生效状态：自身状态 > 最近的分组策略 > 系统默认（policyOverride 用于策略模拟预览） */
function effective(e, policyOverride) {
  if (e.ownStatus) return { value: e.ownStatus, kind: 'own', label: '自身设定', detail: '' };
  var arr = chain(e.groupId);
  for (var i = 0; i < arr.length; i++) {
    var g = arr[i];
    var pol = (policyOverride && policyOverride.groupId === g.id) ? policyOverride.value : g.policy;
    if (pol) return { value: pol, kind: 'group', label: '继承 · ' + g.name, detail: g.policyNote || '' };
  }
  return { value: DEFAULT_STATUS, kind: 'default', label: '系统默认', detail: '' };
}
function effPreviewValue(e, newOwnStatus, policyOverride) {
  var clone = Object.assign({}, e, { ownStatus: newOwnStatus });
  return effective(clone, policyOverride).value;
}
function resolveGroup(gid, mode) {
  return state.entities.filter(function (e) {
    return mode === 'all' ? isWithin(e.groupId, gid) : e.groupId === gid;
  }).map(function (e) { return e.id; });
}
function visibleEntities() {
  var list = state.entities;
  if (state.focus !== 'ALL') list = list.filter(function (e) { return isWithin(e.groupId, state.focus); });
  var q = state.search.trim().toLowerCase();
  if (q) {
    list = list.filter(function (e) {
      return (e.name + ' ' + e.id + ' ' + e.type + ' ' + e.model + ' ' + e.owner + ' ' + e.tags.join(' '))
        .toLowerCase().indexOf(q) >= 0;
    });
  }
  if (state.statusFilter !== 'ALL') {
    list = list.filter(function (e) {
      var ef = effective(e);
      if (state.statusFilter === 'override') return ef.kind === 'own';
      return ef.value === state.statusFilter;
    });
  }
  if (state.onlySelected) list = list.filter(function (e) { return state.selection.has(e.id); });
  return list;
}
function bucketByGroup(ids) {
  var order = {};
  D.GROUPS.forEach(function (g, i) { order[g.id] = i; });
  var map = new Map();
  ids.forEach(function (id) {
    var e = byId(id); if (!e) return;
    if (!map.has(e.groupId)) map.set(e.groupId, []);
    map.get(e.groupId).push(e);
  });
  return Array.from(map.entries())
    .sort(function (a, b) { return order[a[0]] - order[b[0]]; })
    .map(function (pair) {
      return { group: groupById(pair[0]), items: pair[1] };
    });
}
function allTags() {
  var s = new Set();
  state.entities.forEach(function (e) { e.tags.forEach(function (t) { s.add(t); }); });
  return Array.from(s).sort();
}

/* ================= 渲染：总览 ================= */
function render() {
  renderStats();
  renderTopButtons();
  renderTree();
  renderBreadcrumb();
  renderTable();
  renderSelPanel();
}

function renderStats() {
  var counts = {};
  STATUS_ORDER.forEach(function (s) { counts[s] = 0; });
  var prot = 0;
  state.entities.forEach(function (e) {
    counts[effective(e).value]++;
    if (e.locked) prot++;
  });
  $('#global-stats').innerHTML =
    '<span class="gstat">设备 <b>' + state.entities.length + '</b></span>' +
    STATUS_ORDER.map(function (s) {
      return '<span class="gstat ' + STATUS_META[s].cls + '">' + STATUS_META[s].label + ' <b>' + counts[s] + '</b></span>';
    }).join('') +
    '<span class="gstat prot" title="受保护设备在批量写操作中默认跳过">🛡 受保护 <b>' + prot + '</b></span>';
}

function renderTopButtons() {
  $('#btn-undo').disabled = !(state.lastTx && !state.lastTx.undone);
  $('#log-count').textContent = state.log.length;
}

/* ================= 渲染：层级树 ================= */
function renderTree() {
  var wrap = $('#tree');
  wrap.innerHTML = '';
  D.GROUPS.filter(function (g) { return !g.parent; })
    .forEach(function (g) { wrap.appendChild(treeNode(g, 0)); });
}

function treeNode(g, depth) {
  var node = el('div', 'tree-node');
  var kids = D.GROUPS.filter(function (k) { return k.parent === g.id; });
  var row = el('div', 'tree-row' + (state.focus === g.id ? ' active' : ''));
  row.style.paddingLeft = (8 + depth * 16) + 'px';

  var exp = el('button', 'exp' + (kids.length ? '' : ' leaf') + (state.expanded.has(g.id) ? ' open' : ''), '▸');
  if (kids.length) {
    exp.addEventListener('click', function () {
      if (state.expanded.has(g.id)) state.expanded.delete(g.id); else state.expanded.add(g.id);
      render();
    });
  }
  row.appendChild(exp);

  var cb = el('input'); cb.type = 'checkbox';
  cb.title = '勾选' + g.name + (state.scopeMode === 'all' ? '（含全部子孙）' : '（仅直属）');
  var ids = resolveGroup(g.id, state.scopeMode);
  var selN = ids.filter(function (id) { return state.selection.has(id); }).length;
  cb.checked = ids.length > 0 && selN === ids.length;
  cb.indeterminate = selN > 0 && selN < ids.length;
  cb.addEventListener('change', function () { toggleGroup(g.id); });
  row.appendChild(cb);

  var name = el('button', 'gname', esc(g.name));
  name.title = groupPathLabel(g.id) + ' — 点击查看该分组子树';
  name.addEventListener('click', function () {
    state.focus = (state.focus === g.id) ? 'ALL' : g.id;
    render();
  });
  row.appendChild(name);

  var dot = el('button', 'pdot' + (g.policy ? ' has ' + STATUS_META[g.policy].cls : ''),
               g.policy ? '●' : '○');
  dot.title = g.policy
    ? '分组策略：' + statusLabel(g.policy) + (g.policyNote ? '（' + g.policyNote + '）' : '') + ' — 点击调整'
    : '分组策略：无 — 点击设置';
  dot.addEventListener('click', function (ev) { ev.stopPropagation(); openPolicyModal(g.id); });
  row.appendChild(dot);

  var direct = state.entities.filter(function (e) { return e.groupId === g.id; }).length;
  var subtree = state.entities.filter(function (e) { return isWithin(e.groupId, g.id); }).length;
  row.appendChild(el('span', 'gcount',
    direct + (subtree > direct ? ' / ' + subtree : '')));

  if (selN > 0) row.appendChild(el('span', 'selmark', String(selN)));

  node.appendChild(row);
  if (kids.length && state.expanded.has(g.id)) {
    var c = el('div', 'tree-kids');
    kids.forEach(function (k) { c.appendChild(treeNode(k, depth + 1)); });
    node.appendChild(c);
  }
  return node;
}

/* ================= 渲染：面包屑 / 表格 ================= */
function renderBreadcrumb() {
  var bc = $('#breadcrumb');
  var visible = visibleEntities().length;
  var html;
  if (state.focus === 'ALL') {
    html = '<span class="bc-label">范围</span><button class="crumb on">全部实体</button>';
  } else {
    var arr = chain(state.focus).reverse();
    html = '<span class="bc-label">范围</span><button class="crumb" data-crumb="ALL">全部</button>' +
      arr.map(function (g) {
        return ' <span class="sep">›</span> <button class="crumb' + (g.id === state.focus ? ' on' : '') +
               '" data-crumb="' + g.id + '">' + esc(g.name) + '</button>';
      }).join('');
  }
  html += '<span class="bc-count">显示 ' + visible + ' / ' + state.entities.length + ' 台</span>';
  bc.innerHTML = html;
  $$('[data-crumb]', bc).forEach(function (b) {
    b.addEventListener('click', function () { state.focus = b.getAttribute('data-crumb'); render(); });
  });
}

function ownBadgeHtml(e) {
  if (e.ownStatus) {
    var m = STATUS_META[e.ownStatus];
    return '<button class="own-st st ' + m.cls + '" data-id="' + e.id + '" title="点击修改自身状态">' + m.label + '</button>';
  }
  return '<button class="own-st st follow" data-id="' + e.id + '" title="未单独设定，点击为该设备设置自身状态">跟随上级</button>';
}

function rowHtml(e) {
  var sel = state.selection.has(e.id);
  var eff = effective(e);
  var em = STATUS_META[eff.value];
  var tags = e.tags.slice(0, 2).map(function (t) { return '<span class="tag">' + esc(t) + '</span>'; }).join('');
  if (e.tags.length > 2) tags += '<span class="tag more">+' + (e.tags.length - 2) + '</span>';
  var grp = groupById(e.groupId);
  var region = chain(e.groupId).length > 1 ? chain(e.groupId)[chain(e.groupId).length - 1].name : '';
  return '<tr class="' + (sel ? 'sel' : '') + '" data-id="' + e.id + '">' +
    '<td class="c-cb"><input type="checkbox" class="row-cb" data-id="' + e.id + '"' + (sel ? ' checked' : '') + '></td>' +
    '<td class="c-name"><div class="nm">' + esc(e.name) + (e.locked ? ' <span class="lockmini" title="受保护">🛡</span>' : '') +
      '</div><div class="sub">' + e.id + ' · ' + esc(e.type) + ' ' + esc(e.model) + '</div></td>' +
    '<td class="c-grp"><div class="grp">' + esc(grp.name) + '</div><div class="sub">' + esc(region) + '</div></td>' +
    '<td class="c-owner">' + esc(e.owner) + '</td>' +
    '<td class="c-tags">' + tags + '</td>' +
    '<td class="c-own">' + ownBadgeHtml(e) + '</td>' +
    '<td class="c-eff"><span class="st ' + em.cls + '">' + em.label + '</span>' +
      '<div class="src">' + esc(eff.label) + (eff.detail ? ' · ' + esc(eff.detail) : '') + '</div></td>' +
    '<td class="c-lock"><button class="lock-btn' + (e.locked ? ' on' : '') + '" data-id="' + e.id + '" title="' +
      (e.locked ? '受保护：批量写操作默认跳过 — 点击取消保护' : '保护该设备（批量写操作默认跳过）') + '">' +
      (e.locked ? '🛡' : '○') + '</button></td>' +
    '</tr>';
}

function renderTable() {
  var list = visibleEntities();
  var selIn = list.filter(function (e) { return state.selection.has(e.id); }).length;
  var html = '<table class="grid"><colgroup>' +
    '<col style="width:34px"><col style="width:225px"><col style="width:118px"><col style="width:60px">' +
    '<col style="width:128px"><col style="width:104px"><col style="width:150px"><col style="width:52px">' +
    '</colgroup><thead><tr>' +
    '<th class="c-cb"><input type="checkbox" id="master-cb" title="全选 / 取消全选 当前显示结果"></th>' +
    '<th>设备</th><th>所属分组</th><th>负责人</th><th>标签</th><th>自身状态</th><th>生效状态 · 归属</th><th class="c-lock">保护</th>' +
    '</tr></thead><tbody>';
  if (!list.length) {
    html += '<tr><td colspan="8"><div class="empty">没有匹配的设备 — 调整搜索 / 筛选，或在左侧点击分组查看其子树。</div></td></tr>';
  } else {
    list.forEach(function (e) { html += rowHtml(e); });
  }
  html += '</tbody></table>';
  $('#table-wrap').innerHTML = html;
  var m = $('#master-cb');
  if (m) {
    var allSel = list.length > 0 && selIn === list.length;
    m.checked = allSel;
    m.indeterminate = selIn > 0 && !allSel;
  }
}

/* ================= 渲染：批量操作区 ================= */
function renderSelPanel() {
  var n = state.selection.size;
  $$('.op').forEach(function (b) {
    b.disabled = n === 0;
    $('.n', b).textContent = n > 0 ? '(' + n + ')' : '';
  });

  var summary = $('#sel-summary');
  if (n === 0) {
    summary.innerHTML = '<div class="sel-empty"><div style="font-size:26px">🗂</div><b>未选择任何设备</b>' +
      '<p>在左侧勾选分组（右上可切换 仅直属 / 含子孙），<br>或在表格中逐台勾选。<br>所有批量操作前都会生成逐台确认单。</p></div>';
  } else {
    var protSel = 0;
    var buckets = bucketByGroup(Array.from(state.selection));
    buckets.forEach(function (b) {
      b.items.forEach(function (e) { if (e.locked) protSel++; });
    });
    var html = '<div class="sel-big"><b>' + n + '</b><span>台设备已选</span></div>';
    if (protSel > 0) {
      html += '<div class="sel-prot">🛡 其中 ' + protSel + ' 台受保护，批量写操作默认跳过</div>';
    }
    html += '<div class="sel-buckets">' + buckets.map(function (b) {
      return '<div class="sb-head"><span>' + esc(b.group.name) + '</span><span>' + b.items.length + ' 台</span></div>' +
        '<div class="chips">' + b.items.map(function (e) {
          return '<button class="chip" data-id="' + e.id + '" title="点击移出选择">' + esc(e.name) + ' <i>×</i></button>';
        }).join('') + '</div>';
    }).join('') + '</div>';
    html += '<div class="sel-actions"><button class="btn small" id="sel-clear">清空选择</button></div>';
    summary.innerHTML = html;
  }

  var rc = $('#result-card');
  if (state.result) {
    rc.innerHTML = '<div class="rc ok"><span>' + state.result.html + '</span>' +
      '<button id="rc-undo">↩ 撤销</button><button id="rc-log">查看日志</button><i class="rc-x" title="关闭">×</i></div>';
  } else {
    rc.innerHTML = '';
  }
}

/* ================= 选择操作 ================= */
function toggleGroup(gid) {
  var ids = resolveGroup(gid, state.scopeMode);
  var all = ids.length > 0 && ids.every(function (id) { return state.selection.has(id); });
  if (all) ids.forEach(function (id) { state.selection.delete(id); });
  else ids.forEach(function (id) { state.selection.add(id); });
  render();
}
function toggleEntity(id) {
  if (state.selection.has(id)) state.selection.delete(id);
  else state.selection.add(id);
  render();
}

/* ================= 事务执行（批量 / 单台共用） ================= */
function paramLabelOf(op, param) {
  if (op === 'status') return param === 'clear' ? '清除自身状态' : statusLabel(param);
  if (op === 'move') return '移入 ' + groupById(param).name;
  if (op === 'tag') return '+「' + param + '」';
  return '';
}

function executeBatch(op, param, ids) {
  var entries = [];
  var doomed = [];
  ids.forEach(function (id) {
    var e = byId(id); if (!e) return;
    var idx = state.entities.indexOf(e);
    var before = { ownStatus: e.ownStatus, groupId: e.groupId, tags: e.tags.slice() };
    if (op === 'status') e.ownStatus = (param === 'clear') ? null : param;
    else if (op === 'move') e.groupId = param;
    else if (op === 'tag') { if (e.tags.indexOf(param) < 0) e.tags.push(param); }
    else if (op === 'delete') doomed.push(e);
    entries.push({
      id: id, name: e.name, entity: e, index: idx,
      before: before,
      after: { ownStatus: e.ownStatus, groupId: e.groupId, tags: e.tags.slice() },
      deleted: op === 'delete'
    });
  });
  if (op === 'delete') {
    state.entities = state.entities.filter(function (e) { return doomed.indexOf(e) < 0; });
  }
  var tx = {
    seq: ++state.txSeq, time: new Date(), op: op, param: param,
    opLabel: OPS[op].label + (op === 'delete' ? '' : ' · ' + paramLabelOf(op, param)),
    entries: entries, skippedIds: [], undone: false
  };
  state.log.unshift(tx);
  state.lastTx = tx;
  return tx;
}

function applyConfirm() {
  var c = state.confirm;
  if (!c) return;
  var param = c.op === 'tag' ? c.tagText.trim() : c.param;
  if (c.op === 'move' && !param) return;
  if (c.op === 'tag' && !param) return;
  var all = Array.from(state.selection);
  var ids = all.filter(function (id) {
    var e = byId(id);
    return !c.excluded.has(id) && (c.includeProtected || !e.locked);
  });
  if (!ids.length) return;
  var skipped = all.filter(function (id) { return ids.indexOf(id) < 0; });

  var tx = executeBatch(c.op, param, ids);
  tx.skippedIds = skipped;

  state.selection.clear();
  state.onlySelected = false;
  $('#only-selected').checked = false;
  state.confirm = null;
  state.result = {
    tx: tx,
    html: '批量' + OPS[c.op].label + '完成：<b>成功 ' + ids.length + ' 台</b>' +
      (skipped.length ? ' · 跳过 ' + skipped.length + ' 台（受保护 / 手动排除）' : '')
  };
  closeModal();
  render();
  showToast('批量' + OPS[c.op].label + '完成：成功 ' + ids.length + ' 台' +
    (skipped.length ? ' · 跳过 ' + skipped.length + ' 台' : ''), true);
}

function undoLast() {
  var tx = state.lastTx;
  if (!tx || tx.undone) return;
  if (tx.op === 'policy') {
    var g = groupById(tx.groupId);
    g.policy = tx.beforePolicy;
    g.policyNote = tx.beforeNote;
  } else {
    for (var i = tx.entries.length - 1; i >= 0; i--) {
      var en = tx.entries[i];
      var e = en.entity;
      if (tx.op === 'delete') {
        state.entities.splice(Math.min(en.index, state.entities.length), 0, e);
      }
      e.ownStatus = en.before.ownStatus;
      e.groupId = en.before.groupId;
      e.tags = en.before.tags.slice();
    }
  }
  tx.undone = true;
  state.lastTx = null;
  if (state.result && state.result.tx === tx) state.result = null;
  render();
  showToast('已撤销：' + tx.opLabel, false);
}

/* ================= 确认单（零误伤核心） ================= */
function openConfirm(opKey) {
  if (state.selection.size === 0) return;
  state.result = null;
  state.confirm = {
    op: opKey,
    param: opKey === 'status' ? 'active' : '',
    tagText: '',
    excluded: new Set(),
    includeProtected: false
  };
  renderModal();
}
function includedIds() {
  var c = state.confirm;
  if (!c) return [];
  return Array.from(state.selection).filter(function (id) {
    var e = byId(id);
    return e && !c.excluded.has(id) && (c.includeProtected || !e.locked);
  });
}
function deltaPreview(c, e) {
  function grp(id) { var g = groupById(id); return g ? g.name : '?'; }
  if (c.op === 'status') {
    var fromOwn = e.ownStatus ? statusLabel(e.ownStatus) : '跟随上级';
    var toOwn = (c.param === 'clear') ? '跟随上级' : statusLabel(c.param);
    var toEff = (c.param === 'clear') ? effPreviewValue(e, null) : c.param;
    return '自身 <s>' + fromOwn + '</s>→<b>' + toOwn + '</b> · 生效 <s>' + statusLabel(effective(e).value) +
           '</s>→<b>' + statusLabel(toEff) + '</b>';
  }
  if (c.op === 'move') return '<s>' + grp(e.groupId) + '</s> → <b>' + grp(c.param || '?') + '</b>';
  if (c.op === 'tag') return '标签 +<b>「' + esc(c.tagText.trim() || '…') + '」</b>';
  return '<b class="del">删除</b>（原属 ' + grp(e.groupId) + '）';
}
function paramMissing() {
  var c = state.confirm;
  if (!c) return true;
  if (c.op === 'move' && !c.param) return true;
  if (c.op === 'tag' && !c.tagText.trim()) return true;
  return false;
}

function renderModal() {
  var root = $('#modal-root');
  if (state.policyModal) { root.innerHTML = policyModalHtml(); bindPolicyModal(); return; }
  if (state.confirm) { root.innerHTML = confirmHtml(); bindConfirm(); return; }
  root.innerHTML = '';
}
function closeModal() {
  state.confirm = null;
  state.policyModal = null;
  $('#modal-root').innerHTML = '';
}

function confirmHtml() {
  var c = state.confirm;
  var meta = OPS[c.op];
  var all = Array.from(state.selection);
  var prot = all.filter(function (id) { return byId(id).locked; });

  var paramCtl = '';
  if (c.op === 'status') {
    paramCtl = '<label>目标状态</label><select id="cf-param">' +
      STATUS_ORDER.map(function (s) {
        return '<option value="' + s + '"' + (c.param === s ? ' selected' : '') + '>' + statusLabel(s) + '</option>';
      }).join('') +
      '<option value="clear"' + (c.param === 'clear' ? ' selected' : '') + '>清除自身状态（恢复跟随上级）</option>' +
      '</select><span class="hint" style="padding:0">「清除自身状态」＝ 让设备重新跟随分组策略</span>';
  } else if (c.op === 'move') {
    paramCtl = '<label>移入分组</label><select id="cf-param">' +
      '<option value="">— 选择目标分组 —</option>' + groupOptions(c.param) + '</select>';
  } else if (c.op === 'tag') {
    paramCtl = '<label>标签内容</label><input id="cf-param" type="text" list="tag-list" value="' + esc(c.tagText) +
      '" placeholder="如：待巡检"><datalist id="tag-list">' +
      allTags().map(function (t) { return '<option value="' + esc(t) + '">'; }).join('') + '</datalist>';
  }

  var rowsHtml = bucketByGroup(all).map(function (b) {
    var h = '<div class="cf-grp"><h4>' + esc(b.group.name) + ' <span>' + b.items.length + ' 台</span></h4>';
    b.items.forEach(function (e) {
      var inc = !c.excluded.has(e.id) && (c.includeProtected || !e.locked);
      h += '<label class="cf-row' + (inc ? '' : ' off') + (e.locked ? ' prot' : '') + '">' +
        '<input type="checkbox" class="cf-inc" data-id="' + e.id + '"' +
        (inc ? ' checked' : '') + ((!c.includeProtected && e.locked) ? ' disabled' : '') + '>' +
        '<span class="cf-name">' + esc(e.name) + '<i>' + e.id + '</i></span>' +
        '<span class="cf-delta" data-id="' + e.id + '">' + deltaPreview(c, e) + '</span>' +
        (e.locked ? '<span class="cf-prot" title="受保护">🛡</span>' : '') +
        '</label>';
    });
    return h + '</div>';
  }).join('');

  var included = includedIds();

  return '<div class="overlay" id="cf-overlay"><div class="modal">' +
    '<div class="modal-head"><h3>批量' + meta.label + ' · 确认单</h3>' +
    '<p>已选 ' + all.length + ' 台 — 请逐台核对：取消勾选即<b>不操作</b>该设备（零误伤）。</p></div>' +
    '<div class="modal-body">' +
    '<div class="cf-param">' + paramCtl + '</div>' +
    rowsHtml + '</div>' +
    '<div class="modal-foot">' +
    (prot.length
      ? '<div class="cf-note">🛡 ' + prot.length + ' 台受保护设备默认<b>跳过</b>' +
        '<label class="chk"><input type="checkbox" id="cf-prot"' + (c.includeProtected ? ' checked' : '') + '> 本次包含受保护设备</label></div>'
      : '<div class="cf-note">🛡 本批不含受保护设备。</div>') +
    '<div class="cf-note">操作完成后写入操作日志，可撤销（限最近一次，会话内有效）。</div>' +
    '<div class="cf-btns"><button class="btn" id="cf-cancel">取消</button>' +
    '<button class="btn primary" id="cf-go"' + ((included.length === 0 || paramMissing()) ? ' disabled' : '') +
    '>确认' + meta.label + '（' + included.length + ' 台）</button></div>' +
    '</div></div></div>';
}

function groupOptions(selected) {
  return D.GROUPS.map(function (g) {
    var depth = chain(g.id).length - 1;
    return '<option value="' + g.id + '"' + (selected === g.id ? ' selected' : '') + '>' +
      '────'.slice(0, depth) + esc(g.name) + '</option>';
  }).join('');
}

function updateCta() {
  var go = $('#cf-go');
  if (!go) return;
  var n = includedIds().length;
  go.textContent = '确认' + OPS[state.confirm.op].label + '（' + n + ' 台）';
  go.disabled = n === 0 || paramMissing();
}

function bindConfirm() {
  var c = state.confirm;
  $('#cf-overlay').addEventListener('click', function (ev) {
    if (ev.target.id === 'cf-overlay') closeModal();
  });
  $('#cf-cancel').addEventListener('click', closeModal);
  $('#cf-go').addEventListener('click', applyConfirm);

  var paramEl = $('#cf-param');
  if (paramEl && c.op === 'tag') {
    paramEl.addEventListener('input', function () {
      c.tagText = paramEl.value;
      $$('.cf-delta').forEach(function (d) {
        var e = byId(d.getAttribute('data-id'));
        if (e) d.innerHTML = deltaPreview(c, e);
      });
      updateCta();
    });
  } else if (paramEl) {
    paramEl.addEventListener('change', function () {
      c.param = paramEl.value;
      renderModal();
    });
  }

  $$('.cf-inc').forEach(function (cbx) {
    cbx.addEventListener('change', function () {
      var id = cbx.getAttribute('data-id');
      if (cbx.checked) c.excluded.delete(id); else c.excluded.add(id);
      cbx.closest('.cf-row').classList.toggle('off', !cbx.checked);
      updateCta();
    });
  });

  var protBox = $('#cf-prot');
  if (protBox) {
    protBox.addEventListener('change', function () {
      c.includeProtected = protBox.checked;
      renderModal();
    });
  }
}

/* ================= 分组策略（状态归属显式核心） ================= */
function openPolicyModal(gid) {
  var g = groupById(gid);
  state.result = null;
  state.policyModal = { gid: gid, value: g.policy || 'none', note: g.policyNote || '' };
  renderModal();
}
function computePolicyChange(gid, value) {
  var changed = [], unaffected = 0;
  state.entities.forEach(function (e) {
    if (!isWithin(e.groupId, gid)) return;
    var from = effective(e).value;
    var to = effective(e, { groupId: gid, value: value === 'none' ? null : value }).value;
    if (from !== to) changed.push({ e: e, from: from, to: to });
    else unaffected++;
  });
  return { changed: changed, unaffected: unaffected };
}
function policyModalHtml() {
  var pm = state.policyModal;
  var g = groupById(pm.gid);
  var res = computePolicyChange(pm.gid, pm.value);

  var listHtml;
  if (res.changed.length) {
    listHtml = '<div class="pl-list">' + res.changed.map(function (x) {
      return '<div class="pl-row"><span>' + esc(x.e.name) + '</span>' +
        '<span class="d"><s>' + statusLabel(x.from) + '</s> → <b>' + statusLabel(x.to) + '</b></span></div>';
    }).join('') + '</div>';
  } else {
    listHtml = '<div class="pl-none">子树内没有设备的生效状态会因此改变（均有自身状态或更近的分组策略）。</div>';
  }

  return '<div class="overlay" id="pl-overlay"><div class="modal" style="width:560px">' +
    '<div class="modal-head"><h3>分组策略 · ' + esc(g.name) + '</h3>' +
    '<p>' + esc(groupPathLabel(g.id)) + '</p></div>' +
    '<div class="modal-body">' +
    '<div class="pl-desc">分组策略向子树内「<b>无自身状态</b>」的设备级联生效；设备自身状态优先于任何分组策略，' +
    '更近一级的策略优先于更远策略。当前子树共 ' +
    (res.changed.length + res.unaffected) + ' 台设备。</div>' +
    '<div class="cf-param"><label>策略状态</label><select id="pl-val">' +
    '<option value="none"' + (pm.value === 'none' ? ' selected' : '') + '>无（跟随上级 / 系统默认）</option>' +
    STATUS_ORDER.map(function (s) {
      return '<option value="' + s + '"' + (pm.value === s ? ' selected' : '') + '>' + statusLabel(s) + '</option>';
    }).join('') +
    '</select></div>' +
    '<div class="cf-param"><label>策略说明</label><input id="pl-note" type="text" value="' + esc(pm.note) + '" placeholder="原因备注，如：门店改造施工中"></div>' +
    '<div class="pl-preview"><h4>影响预览 — 将改变 <b style="color:var(--accent)">' + res.changed.length +
    '</b> 台设备的生效状态，其余 ' + res.unaffected + ' 台不受影响</h4>' + listHtml + '</div>' +
    '</div>' +
    '<div class="modal-foot"><div class="cf-note">策略变更计入操作日志，可撤销（限最近一次）。</div>' +
    '<div class="cf-btns"><button class="btn" id="pl-cancel">取消</button>' +
    '<button class="btn primary" id="pl-go"' +
    ((pm.value === (g.policy || 'none') && pm.note.trim() === (g.policyNote || '')) ? ' disabled' : '') +
    '>确认设置策略（影响 ' + res.changed.length + ' 台）</button></div>' +
    '</div></div></div>';
}
function refreshPolicyPreview() {
  var pm = state.policyModal;
  var res = computePolicyChange(pm.gid, pm.value);
  var prev = $('.pl-preview');
  var g = groupById(pm.gid);
  var listHtml = res.changed.length
    ? '<div class="pl-list">' + res.changed.map(function (x) {
        return '<div class="pl-row"><span>' + esc(x.e.name) + '</span>' +
          '<span class="d"><s>' + statusLabel(x.from) + '</s> → <b>' + statusLabel(x.to) + '</b></span></div>';
      }).join('') + '</div>'
    : '<div class="pl-none">子树内没有设备的生效状态会因此改变（均有自身状态或更近的分组策略）。</div>';
  prev.innerHTML = '<h4>影响预览 — 将改变 <b style="color:var(--accent)">' + res.changed.length +
    '</b> 台设备的生效状态，其余 ' + res.unaffected + ' 台不受影响</h4>' + listHtml;
  $('#pl-go').textContent = '确认设置策略（影响 ' + res.changed.length + ' 台）';
  $('#pl-go').disabled = (pm.value === (g.policy || 'none')) && (pm.note.trim() === (g.policyNote || ''));
}
function bindPolicyModal() {
  $('#pl-overlay').addEventListener('click', function (ev) {
    if (ev.target.id === 'pl-overlay') closeModal();
  });
  $('#pl-cancel').addEventListener('click', closeModal);
  $('#pl-val').addEventListener('change', function () {
    state.policyModal.value = $('#pl-val').value;
    refreshPolicyPreview();
  });
  $('#pl-note').addEventListener('input', function () {
    state.policyModal.note = $('#pl-note').value;
    refreshPolicyPreview();
  });
  $('#pl-go').addEventListener('click', function () {
    var pm = state.policyModal;
    var g = groupById(pm.gid);
    var v = pm.value;
    var beforePolicy = g.policy, beforeNote = g.policyNote;
    g.policy = (v === 'none') ? null : v;
    g.policyNote = pm.note.trim() || null;
    var res = computePolicyChange(pm.gid, v);
    var tx = {
      seq: ++state.txSeq, time: new Date(), op: 'policy', groupId: pm.gid,
      beforePolicy: beforePolicy, beforeNote: beforeNote,
      opLabel: '分组策略 · ' + g.name + ' → ' + (v === 'none' ? '无' : statusLabel(v)),
      entries: [], skippedIds: [], undone: false,
      affectedCount: res.changed.length
    };
    state.log.unshift(tx);
    state.lastTx = tx;
    closeModal();
    state.result = { tx: tx, html: '分组策略已更新：' + esc(g.name) + ' → ' +
      (v === 'none' ? '无' : statusLabel(v) + (g.policyNote ? '（' + esc(g.policyNote) + '）' : '')) +
      '，<b>' + res.changed.length + ' 台</b>设备生效状态改变' };
    render();
    showToast('分组策略已更新：' + g.name, true);
  });
}

/* ================= 状态菜单（单台自身状态） ================= */
function openStatusMenu(btn, id) {
  var e = byId(id);
  if (!e) return;
  var root = $('#menu-root');
  root.innerHTML = '';
  var m = el('div', 'status-menu');
  m.innerHTML = '<div class="sm-title">设置自身状态 · ' + esc(e.name) + '</div>' +
    STATUS_ORDER.map(function (s) {
      return '<button class="sm-item' + (e.ownStatus === s ? ' cur' : '') + '" data-v="' + s + '">' +
        '<span class="dot ' + STATUS_META[s].cls + '"></span>' + statusLabel(s) + (e.ownStatus === s ? ' ✓' : '') + '</button>';
    }).join('') +
    '<div class="sm-sep"></div>' +
    '<button class="sm-item clear' + (e.ownStatus == null ? ' cur' : '') + '" data-v="clear">清除自身状态（恢复跟随上级）</button>';
  root.appendChild(m);
  var r = btn.getBoundingClientRect();
  m.style.left = Math.max(8, Math.min(r.left, window.innerWidth - 236)) + 'px';
  var top = r.bottom + 6;
  if (top + 240 > window.innerHeight) top = Math.max(8, r.top - 246);
  m.style.top = top + 'px';
}
function closeMenu() { $('#menu-root').innerHTML = ''; state.statusMenuFor = null; }

/* ================= 抽屉：操作日志 ================= */
function deltaText(tx, en) {
  function grp(id) { var g = groupById(id); return g ? g.name : '?'; }
  function stW(v) { return v ? statusLabel(v) : '跟随上级'; }
  if (tx.op === 'status') return stW(en.before.ownStatus) + ' → ' + stW(en.after.ownStatus);
  if (tx.op === 'move') return grp(en.before.groupId) + ' → ' + grp(en.after.groupId);
  if (tx.op === 'tag') return '+「' + tx.param + '」';
  return '已删除（原属 ' + grp(en.before.groupId) + '）';
}
function renderDrawer() {
  var root = $('#drawer-root');
  if (!state.drawerOpen) { root.innerHTML = ''; return; }
  var items = state.log.map(function (tx) {
    var h = '<div class="tx' + (tx.undone ? ' undone' : '') + '">' +
      '<div class="tx-head"><span class="tx-time">' + fmtTime(tx.time) + '</span>' +
      '<span class="tx-label">' + esc(tx.opLabel) + '</span>' +
      '<span class="tx-chip' + (tx.undone ? ' off' : '') + '">' + (tx.undone ? '已撤销' : '已完成') + '</span></div>' +
      '<div class="tx-sub">成功 ' + tx.entries.length + ' 台' +
      (tx.skippedIds.length ? ' · 跳过 ' + tx.skippedIds.length + ' 台（保护 / 排除）' : '') +
      (tx.op === 'policy' ? ' · 影响生效 ' + (tx.affectedCount || 0) + ' 台' : '') +
      '</div>';
    if (tx.op === 'policy') {
      h += '<div class="tx-sub">' + esc(groupById(tx.groupId).name) + '：' +
        (tx.beforePolicy ? statusLabel(tx.beforePolicy) : '无') + ' → ' +
        (groupById(tx.groupId).policy ? statusLabel(groupById(tx.groupId).policy) : '无') + '</div>';
    }
    if (tx.entries.length) {
      h += '<button class="tx-toggle" data-seq="' + tx.seq + '">' + (tx._open ? '收起明细 ▴' : '展开明细 ▾') + '</button>';
      if (tx._open) {
        h += '<div class="tx-list">' + tx.entries.map(function (en) {
          return '<div class="tx-row"><span>' + esc(en.name) + '</span><span class="tx-delta">' + deltaText(tx, en) + '</span></div>';
        }).join('') + '</div>';
      }
    }
    if (tx === state.lastTx && !tx.undone) {
      h += '<button class="btn small" data-undo="' + tx.seq + '">↩ 撤销此操作</button>';
    }
    return h + '</div>';
  }).join('');
  root.innerHTML = '<div class="drawer-overlay" id="drawer-overlay"></div>' +
    '<aside class="drawer"><header><h3>🕘 操作日志</h3><button class="btn ghost" id="drawer-close">关闭</button></header>' +
    '<div class="drawer-body">' + (items || '<div class="empty">暂无操作记录</div>') + '</div></aside>';
}
function toggleDrawer(open) {
  state.drawerOpen = (open == null) ? !state.drawerOpen : open;
  renderDrawer();
}

/* ================= Toast ================= */
var toastTimer = null;
function showToast(msg, undoable) {
  var root = $('#toast-root');
  root.innerHTML = '<div class="toast"><span>' + msg + '</span>' +
    (undoable && state.lastTx && !state.lastTx.undone ? '<button id="toast-undo">↩ 撤销</button>' : '') +
    '<button class="tx" id="toast-x" title="关闭">×</button></div>';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { root.innerHTML = ''; }, 6000);
}

/* ================= 事件绑定 ================= */
function setScope(mode) {
  state.scopeMode = mode;
  $$('#scope-toggle button').forEach(function (x) { x.classList.toggle('on', x.getAttribute('data-scope') === mode); });
  $('#scope-hint').innerHTML = mode === 'direct'
    ? '勾选分组 ＝ 勾选其<b>直属</b>设备；切到「含子孙」将连同下级分组设备一并选中。'
    : '勾选分组 ＝ 勾选其<b>全部子孙设备</b>（含下级分组）；切回「仅直属」只选直属设备。';
}

/* ================= 深链演示锚点（#s=2…7）
   供无交互环境（如无头浏览器截图）复现各操作状态；
   均通过与点击事件相同的内部函数驱动，不引入额外逻辑。 ================= */
function applyScenario(s) {
  function selectEastAll() {
    setScope('all');
    resolveGroup('east', 'all').forEach(function (id) { state.selection.add(id); });
    render();
  }
  if (s === '2') {                       // 含子孙选中 华东大区（26 台）
    selectEastAll();
  } else if (s === '3') {                // + 打开「修改状态→已停用」确认单
    selectEastAll();
    state.confirm = { op: 'status', param: 'paused', tagText: '', excluded: new Set(), includeProtected: false };
    renderModal();
  } else if (s === '4') {                // 执行后的结果态（成功 25 · 跳过 1）
    var all = resolveGroup('east', 'all');
    var ids = all.filter(function (id) { return !byId(id).locked; });
    var tx = executeBatch('status', 'paused', ids);
    tx.skippedIds = all.filter(function (id) { return byId(id).locked; });
    state.result = {
      tx: tx,
      html: '批量修改状态完成：<b>成功 ' + ids.length + ' 台</b> · 跳过 ' + tx.skippedIds.length + ' 台（受保护 / 手动排除）'
    };
    state.selection.clear();
    render();
    showToast('批量修改状态完成：成功 ' + ids.length + ' 台 · 跳过 ' + tx.skippedIds.length + ' 台', true);
  } else if (s === '5') {                // 西湖门店分组策略弹窗（已停用预览）
    openPolicyModal('hz-xh');
    state.policyModal.value = 'paused';
    renderModal();
  } else if (s === '6') {                // 天津子树：继承归属视图
    state.focus = 'tj';
    render();
  } else if (s === '7') {                // 天津子树 + 操作日志抽屉（含已撤销明细）
    var all2 = resolveGroup('east', 'all');
    executeBatch('status', 'paused', all2.filter(function (id) { return !byId(id).locked; }));
    undoLast();
    state.log[0]._open = true;
    state.focus = 'tj';
    render();
    toggleDrawer(true);
  }
}

function bindStatic() {
  $$('#scope-toggle button').forEach(function (b) {
    b.addEventListener('click', function () { setScope(b.getAttribute('data-scope')); render(); });
  });

  $('#table-search').addEventListener('input', function () {
    state.search = this.value;
    renderBreadcrumb();
    renderTable();
  });
  $('#status-filter').addEventListener('change', function () {
    state.statusFilter = this.value;
    renderBreadcrumb();
    renderTable();
  });
  $('#only-selected').addEventListener('change', function () {
    state.onlySelected = this.checked;
    renderBreadcrumb();
    renderTable();
  });

  $('#table-wrap').addEventListener('change', function (ev) {
    var t = ev.target;
    if (t.id === 'master-cb') {
      var list = visibleEntities();
      var all = list.length > 0 && list.every(function (e) { return state.selection.has(e.id); });
      if (all) list.forEach(function (e) { state.selection.delete(e.id); });
      else list.forEach(function (e) { state.selection.add(e.id); });
      render();
    } else if (t.classList && t.classList.contains('row-cb')) {
      toggleEntity(t.getAttribute('data-id'));
    }
  });
  $('#table-wrap').addEventListener('click', function (ev) {
    var lockBtn = ev.target.closest('.lock-btn');
    if (lockBtn) {
      var e = byId(lockBtn.getAttribute('data-id'));
      if (e) { e.locked = !e.locked; render(); }
      return;
    }
    var stBtn = ev.target.closest('.own-st');
    if (stBtn) {
      ev.stopPropagation();
      openStatusMenu(stBtn, stBtn.getAttribute('data-id'));
    }
  });

  $('#ops-panel').addEventListener('click', function (ev) {
    var chip = ev.target.closest('.chip');
    if (chip) { toggleEntity(chip.getAttribute('data-id')); return; }
    if (ev.target.id === 'sel-clear') { state.selection.clear(); render(); return; }
    if (ev.target.id === 'rc-undo') { undoLast(); return; }
    if (ev.target.id === 'rc-log') { toggleDrawer(true); return; }
    if (ev.target.classList.contains('rc-x')) { state.result = null; renderSelPanel(); renderTopButtons(); return; }
    var opBtn = ev.target.closest('.op');
    if (opBtn && !opBtn.disabled) openConfirm(opBtn.getAttribute('data-op'));
  });

  $('#btn-log').addEventListener('click', function () { toggleDrawer(); });
  $('#btn-undo').addEventListener('click', undoLast);

  $('#drawer-root').addEventListener('click', function (ev) {
    if (ev.target.id === 'drawer-overlay' || ev.target.id === 'drawer-close') { toggleDrawer(false); return; }
    var tg = ev.target.closest('.tx-toggle');
    if (tg) {
      var seq = Number(tg.getAttribute('data-seq'));
      state.log.forEach(function (tx) { if (tx.seq === seq) tx._open = !tx._open; });
      renderDrawer();
      return;
    }
    var ub = ev.target.closest('[data-undo]');
    if (ub) undoLast();
  });

  $('#menu-root').addEventListener('click', function (ev) {
    var item = ev.target.closest('.sm-item');
    if (!item) return;
    var id = state.statusMenuFor;
    var v = item.getAttribute('data-v');
    closeMenu();
    if (!id) return;
    var tx = executeBatch('status', v === 'clear' ? 'clear' : v, [id]);
    render();
    showToast('已更新 ' + byId(id).name + ' 的自身状态' + (v === 'clear' ? '（恢复跟随上级）' : ''), true);
  });

  document.addEventListener('click', function (ev) {
    if (ev.target.closest('.status-menu') || ev.target.closest('.own-st')) return;
    if ($('#menu-root').innerHTML) closeMenu();
  });
  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape') {
      if ($('#menu-root').innerHTML) { closeMenu(); return; }
      if (state.confirm || state.policyModal) { closeModal(); return; }
      if (state.drawerOpen) toggleDrawer(false);
    }
  });

  $('#toast-root').addEventListener('click', function (ev) {
    if (ev.target.id === 'toast-undo') undoLast();
    if (ev.target.id === 'toast-x') $('#toast-root').innerHTML = '';
  });
}

/* ================= 启动（同步就绪，无加载态） ================= */
bindStatic();
render();
window.__APP_READY__ = true;
(function () {
  var m = (location.hash || '').match(/s=([2-7])/);
  if (m) applyScenario(m[1]);
})();
})();
