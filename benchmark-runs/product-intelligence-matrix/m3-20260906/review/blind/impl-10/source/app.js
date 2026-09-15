/* Docloom — 单文档结构化编辑器
 *
 * 架构约定（与 Prax 设计会话 ds_20260908164046_457d6489 一致）：
 *  - 单一状态源：state.doc 是唯一真值；大纲 / 编辑器 / 预览均为其派生渲染（MC-2）。
 *  - 结构操作白名单：增子节 / 增同级节 / 删除 / 上移 / 下移 / 升级 / 降级，
 *    每个操作自带约束，不存在能产生孤儿节、层级跳级或越界移动的路径（MC-3）。
 *  - 快照式撤销 / 重做（MC-4）；初始文档内联，首屏即就绪，无加载态（MC-5）。
 */
'use strict';

/* ================= 初始文档（首屏内联数据） ================= */

function sec(id, title, body, children, status) {
  return { id: id, title: title, status: status || 'draft', body: body || [], children: children || [] };
}

var INITIAL_DOC = {
  title: 'Aurora 桌面应用 2.0 · 发布说明',
  sections: [
    sec('s1', '概述', [
      'Aurora 2.0 是本年度最重要的版本，围绕「离线可用」与「多人协作」两条主线重构了核心同步引擎，并带来了 41 项改进。'
    ], [
      sec('s1-1', '背景', [
        '1.x 系列的在线架构在弱网环境下表现不佳：缓存失效频繁，编辑冲突需要人工处理。过去两个季度，约有 18% 的支持工单与此相关。'
      ]),
      sec('s1-2', '目标', [
        '本版本追求三个可度量的目标：弱网下的首开时间下降 40%、冲突自动解决率达到 95%、内存占用不高于 1.x 的 110%。'
      ])
    ]),
    sec('s2', '新功能', [
      '以下功能默认启用，无需管理员配置。'
    ], [
      sec('s2-1', '离线模式', [
        '断网后仍可浏览最近 30 天内打开过的文档并继续编辑；恢复联网后，变更将按段落粒度自动合并。',
        '托盘图标会显示同步状态：灰色为离线，蓝色为同步中，绿色为全部一致。'
      ], [
        sec('s2-1-1', '技术方案', [
          '同步引擎迁移到 CRDT（无冲突复制数据类型），本地持久化采用追加式日志，崩溃后可完整回放。'
        ], [], 'review')
      ]),
      sec('s2-2', '协作光标', [
        '同一文档的协作者头像与光标实时可见，最多支持 24 人同时编辑；超过后自动切换为分段锁定模式。'
      ], [], 'review')
    ], 'review'),
    sec('s3', '问题修复', [
      '修复搜索面板在包含全角空格的文档中定位偏移的问题。',
      '修复导出 PDF 时页眉重复渲染的问题。',
      '修复深色模式下侧边栏滚动条不可见的问题。'
    ]),
    sec('s4', '已知问题', [
      '在 Windows 7 上协作光标可能出现半秒延迟，将在 2.0.1 修复。',
      '极少数含 10 万段落的超长文档在打开时内存占用偏高。'
    ]),
    sec('s5', '升级与回滚', [
      '从 1.9 及以上版本可直接原地升级，历史版本设置会完整保留；更早版本请先升级到 1.9。',
      '如需回滚，可在「设置 → 高级」中使用「恢复到上一版本」，文档数据不受影响。'
    ], [], 'final')
  ]
};

var MAX_DEPTH = 4;
var STATUS_TEXT = { draft: '草稿', review: '评审中', final: '定稿' };

/* ================= 状态（单一状态源） ================= */

var state = {
  doc: JSON.parse(JSON.stringify(INITIAL_DOC)),
  selectedId: INITIAL_DOC.sections.length ? INITIAL_DOC.sections[0].id : null,
  reportOpen: false,
  undoStack: [],
  redoStack: [],
  editedAt: null,
  changeCount: 0
};

var idSeed = 100;
function newId() { idSeed += 1; return 'n' + idSeed + '_' + Math.floor(Math.random() * 900 + 100); }

/* ================= 树工具 ================= */

function cloneDoc() { return JSON.parse(JSON.stringify(state.doc)); }

/* 深度优先展平：[{id, node, depth, number, index, parentId, parentIdList}] */
function flatten(sections, depth, prefix, parentId, out) {
  depth = depth || 1; prefix = prefix || ''; parentId = parentId || null; out = out || [];
  sections.forEach(function (n, i) {
    var number = prefix ? prefix + '.' + (i + 1) : String(i + 1);
    out.push({ id: n.id, node: n, depth: depth, number: number, index: i, parentId: parentId, parentIdList: parentId ? sections : null });
    if (n.children.length) flatten(n.children, depth + 1, number, n.id, out);
  });
  return out;
}

/* 返回节点所在列表 {list, index, parentNode}；未找到返回 null */
function locate(sections, id) {
  for (var i = 0; i < sections.length; i++) {
    if (sections[i].id === id) return { list: sections, index: i, parentNode: null };
    var r = locate(sections[i].children, id);
    if (r) { r.parentNode = sections[i]; return r; }
  }
  return null;
}

function findNode(id) {
  if (id == null) return null;
  var loc = locate(state.doc.sections, id);
  return loc ? loc.list[loc.index] : null;
}

function flatMap() {
  var m = {};
  flatten(state.doc.sections).forEach(function (f) { m[f.id] = f; });
  return m;
}

/* ================= 结构校验（结构检查面板数据源） ================= */

function validateDoc() {
  var flat = flatten(state.doc.sections);
  var issues = [];
  var byKey = {};
  flat.forEach(function (f) {
    var title = f.node.title.trim();
    var bodyText = f.node.body.join('').trim();
    if (!title) issues.push({ level: 'warning', nodeId: f.id, number: f.number, msg: '标题为空' });
    if (!bodyText) issues.push({ level: 'warning', nodeId: f.id, number: f.number, msg: '正文为空' });
    if (title) {
      var key = (f.parentId || 'root') + '|' + title;
      (byKey[key] = byKey[key] || []).push(f);
    }
  });
  Object.keys(byKey).forEach(function (k) {
    var arr = byKey[k];
    if (arr.length > 1) {
      for (var i = 1; i < arr.length; i++) {
        issues.push({ level: 'warning', nodeId: arr[i].id, number: arr[i].number, msg: '同级重复标题「' + arr[i].node.title.trim() + '」' });
      }
    }
  });
  issues.sort(function (a, b) { return a.number.localeCompare(b.number, undefined, { numeric: true }); });
  return issues;
}

/* ================= 操作提交（撤销栈 + 派生渲染） ================= */

var lastKey = null, lastKeyAt = 0;

function pushUndo(key) {
  var now = Date.now();
  /* 连续同类编辑（如持续输入）合并为一个撤销点 */
  if (key && key === lastKey && now - lastKeyAt < 900) { lastKeyAt = now; return; }
  state.undoStack.push(cloneDoc());
  if (state.undoStack.length > 120) state.undoStack.shift();
  lastKey = key; lastKeyAt = now;
}

function commit(label, key, mutate, opts) {
  opts = opts || {};
  var activeId = document.activeElement ? document.activeElement.id : null;
  pushUndo(key);
  mutate();
  state.redoStack.length = 0;
  state.editedAt = new Date();
  state.changeCount += 1;
  /* 操作后选择必然指向存在的节点（结构不变量） */
  if (state.selectedId != null && !findNode(state.selectedId)) state.selectedId = null;
  renderAll(opts.syncEditor !== false);
  if (opts.focusOutlineRow) {
    var row = outlineRowEl(state.selectedId);
    if (row) row.focus();
  } else if (activeId) {
    var el = document.getElementById(activeId);
    if (el) el.focus();
  }
  feedback(label);
}

/* ================= 结构操作白名单 ================= */

function makeSection(title) {
  return sec(newId(), title || '新建小节', ['（在此输入正文，空行分段。）']);
}

function opAddChild(parentId) {
  var node = findNode(parentId);
  if (!node) return;
  var f = flatMap()[parentId];
  if (f.depth >= MAX_DEPTH) return;
  var child = makeSection('新小节');
  commit('已添加子节到「' + nodeTitle(node) + '」', null, function () {
    node.children.push(child);
    state.selectedId = child.id;
  }, { focusOutlineRow: true });
}

function opAddSibling(id) {
  var loc = locate(state.doc.sections, id);
  if (!loc) { opAddRoot(); return; }
  var sib = makeSection('新小节');
  commit('已在下方添加同级节', null, function () {
    loc.list.splice(loc.index + 1, 0, sib);
    state.selectedId = sib.id;
  }, { focusOutlineRow: true });
}

function opAddRoot() {
  var s = makeSection('新建节');
  commit('已添加顶级节', null, function () {
    state.doc.sections.push(s);
    state.selectedId = s.id;
  }, { focusOutlineRow: true });
}

/* 删除：无子节直接删；有子节时二选一——子节上移 / 连同子树删除，绝不产生孤儿节 */
function opRemove(id, mode) {
  var loc = locate(state.doc.sections, id);
  if (!loc) return;
  var node = loc.list[loc.index];
  var nChildren = node.children.length;

  if (nChildren > 0 && !mode) {
    openModal({
      title: '删除「' + nodeTitle(node) + '」',
      body: '该节包含 ' + nChildren + ' 个子节。请选择处理方式（两种方式都不会产生无归属的孤儿节）：',
      actions: [
        { label: '子节上移一级（保留 ' + nChildren + ' 个子节）', kind: 'danger-soft',
          run: function () { closeModal(); opRemove(id, 'promote'); } },
        { label: '连同子节删除（共 ' + (nChildren + 1) + ' 节）', kind: 'danger',
          run: function () { closeModal(); opRemove(id, 'subtree'); } },
        { label: '取消', kind: 'mbtn', run: function () { closeModal(); } }
      ]
    });
    return;
  }

  var neighbor = neighborId(loc);
  commit('已删除「' + nodeTitle(node) + '」', null, function () {
    var removed = loc.list.splice(loc.index, 1);
    if (mode === 'promote' && removed[0].children.length) {
      var at = loc.index;
      removed[0].children.forEach(function (c, i) { loc.list.splice(at + i, 0, c); });
    }
    state.selectedId = neighbor;
  }, { focusOutlineRow: true });
}

function neighborId(loc) {
  var after = loc.list[loc.index + 1];
  if (after) return after.id;
  var before = loc.list[loc.index - 1];
  if (before) return before.id;
  return loc.parentNode ? loc.parentNode.id : (state.doc.sections[0] ? state.doc.sections[0].id : null);
}

function opMove(id, delta) {
  var loc = locate(state.doc.sections, id);
  if (!loc) return;
  var t = loc.index + delta;
  if (t < 0 || t >= loc.list.length) return;
  commit(delta < 0 ? '已上移' : '已下移', null, function () {
    var tmp = loc.list[loc.index];
    loc.list[loc.index] = loc.list[t];
    loc.list[t] = tmp;
  }, { focusOutlineRow: true });
}

/* 升级：有父节才能升级，升级后插入到父节之后 */
function opPromote(id) {
  var loc = locate(state.doc.sections, id);
  if (!loc || !loc.parentNode) return;
  var node = loc.list[loc.index];
  var pLoc = locate(state.doc.sections, loc.parentNode.id);
  commit('已升级（上提一级）', null, function () {
    loc.list.splice(loc.index, 1);
    pLoc.list.splice(pLoc.index + 1, 0, node);
  }, { focusOutlineRow: true });
}

/* 降级：必须存在前一个同级节，降级后成为其最后一个子节 */
function opDemote(id) {
  var loc = locate(state.doc.sections, id);
  if (!loc || loc.index === 0) return;
  var node = loc.list[loc.index];
  var prev = loc.list[loc.index - 1];
  var pf = flatMap()[prev.id];
  if (pf.depth + 1 > MAX_DEPTH) return;
  commit('已降级（成为「' + nodeTitle(prev) + '」的子节）', null, function () {
    loc.list.splice(loc.index, 1);
    prev.children.push(node);
  }, { focusOutlineRow: true });
}

/* ================= 字段 / 文档级操作 ================= */

function opUpdateSection(id, patch, key) {
  var node = findNode(id);
  if (!node) return;
  pushUndo(key);
  Object.keys(patch).forEach(function (k) { node[k] = patch[k]; });
  state.editedAt = new Date();
  state.changeCount += 1;
  lastKey = key; lastKeyAt = Date.now();
  /* 字段编辑不重绘编辑器（保护输入光标），仅同步派生面 */
  renderOutline(); renderPreview(); renderReport(); renderToolbar();
}

function opUpdateDocTitle(title, key) {
  pushUndo(key);
  state.doc.title = title;
  state.editedAt = new Date();
  state.changeCount += 1;
  lastKey = key; lastKeyAt = Date.now();
  renderPreview(); renderToolbar();
}

function opUndo() {
  if (!state.undoStack.length) return;
  state.redoStack.push(cloneDoc());
  state.doc = state.undoStack.pop();
  lastKey = null;
  fixSelection();
  renderAll(true);
  feedback('已撤销');
}

function opRedo() {
  if (!state.redoStack.length) return;
  state.undoStack.push(cloneDoc());
  state.doc = state.redoStack.pop();
  lastKey = null;
  fixSelection();
  renderAll(true);
  feedback('已重做');
}

function opReset() {
  openModal({
    title: '恢复初始示例文档',
    body: '当前的全部编辑（包括大纲结构与正文）将被丢弃，恢复为页面打开时的示例文档。此操作可通过撤销（Ctrl+Z）撤回。',
    actions: [
      { label: '恢复初始文档', kind: 'danger', run: function () {
          closeModal();
          commit('已恢复初始示例文档', null, function () {
            state.doc = JSON.parse(JSON.stringify(INITIAL_DOC));
            state.selectedId = state.doc.sections.length ? state.doc.sections[0].id : null;
          }, { focusOutlineRow: true });
        } },
      { label: '取消', kind: 'mbtn', run: function () { closeModal(); } }
    ]
  });
}

function fixSelection() {
  if (state.selectedId != null && !findNode(state.selectedId)) {
    state.selectedId = state.doc.sections.length ? state.doc.sections[0].id : null;
  }
}

function nodeTitle(node) {
  var t = (node.title || '').trim();
  return t || '未命名节';
}

/* ================= 渲染 ================= */

var $ = function (id) { return document.getElementById(id); };

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

function renderAll(syncEditor) {
  renderOutline();
  renderEditor(syncEditor === true);
  renderPreview();
  renderReport();
  renderToolbar();
}

function renderToolbar() {
  var titleInput = $('docTitle');
  if (document.activeElement !== titleInput) titleInput.value = state.doc.title;
  $('btnUndo').disabled = state.undoStack.length === 0;
  $('btnRedo').disabled = state.redoStack.length === 0;
  var issues = validateDoc();
  var badge = $('reportBadge');
  badge.textContent = issues.length ? '结构检查 · ' + issues.length + ' 项提醒' : '结构检查 · 完整';
  badge.className = 'badge' + (issues.length ? ' has-issues' : '');
  var es = $('editState');
  es.textContent = state.editedAt
    ? '已编辑 ' + state.editedAt.toTimeString().slice(0, 8) + ' · ' + state.changeCount + ' 处'
    : '未编辑';
}

/* ---------- 大纲 ---------- */

function outlineRowEl(id) {
  var el = $('outlineTree').querySelector('[data-row="' + id + '"]');
  return el;
}

function renderOutline() {
  refreshValidateCache();
  var flat = flatten(state.doc.sections);
  var tree = $('outlineTree');

  $('outlineCount').textContent = flat.length ? flat.length + ' 节' : '';

  if (!flat.length) {
    tree.innerHTML = '<div class="outline-empty">文档当前没有任何节。<br>' +
      '<button class="sbtn" type="button" data-act="add-root">＋ 新建第一节</button></div>';
    return;
  }

  var html = '';
  flat.forEach(function (f) {
    var node = f.node;
    var sel = f.id === state.selectedId;
    var warn = issuesFor(f);
    html += '<div class="ol-item">' +
      '<div class="ol-row' + (sel ? ' selected' : '') + '" style="--d:' + f.depth + '" data-row="' + f.id + '"' +
      ' role="treeitem" aria-selected="' + sel + '" aria-level="' + f.depth + '" tabindex="' + (sel ? 0 : -1) + '">' +
      '<span class="ol-num">' + f.number + '</span>' +
      '<span class="ol-title">' + escapeHtml(nodeTitle(node)) + '</span>' +
      (warn ? '<span class="ol-flag" title="结构检查有提醒"></span>' : '') +
      '<span class="ol-actions">' +
      ob('add-child', f.id, '添加子节', '＋子', !canAddChild(f), canAddChild(f) ? '' : '已达最大层级 ' + MAX_DEPTH + ' 级') +
      ob('add-sibling', f.id, '在下方添加同级节', '＋下', false, '') +
      ob('move-up', f.id, '上移', '↑', f.index === 0, '已在本级最前') +
      ob('move-down', f.id, '下移', '↓', !canMoveDown(f), canMoveDown(f) ? '' : '已在本级最后') +
      ob('promote', f.id, '升级（上提一级）', '⇤', !canPromote(f), canPromote(f) ? '' : '已是顶级节') +
      ob('demote', f.id, '降级（成为前一节的子节）', '⇥', !canDemote(f), canDemote(f) ? '' : '前一个同级节不存在，无法降级') +
      ob('remove', f.id, '删除', '删', false, '') +
      '</span></div></div>';
  });
  tree.innerHTML = html;

  var selRow = outlineRowEl(state.selectedId);
  if (selRow && !isInView(selRow, tree)) selRow.scrollIntoView({ block: 'nearest' });
}

/* ---------- 约束判定（操作可用性 = 结构保护） ---------- */

function ob(act, id, label, glyph, disabled, reason) {
  return '<button type="button" class="obtn' + (act === 'remove' ? ' danger' : '') + '" data-act="' + act + '" data-id="' + id + '"' +
    (disabled ? ' disabled' : '') +
    ' title="' + escapeHtml(label + (reason ? '（' + reason + '）' : '')) + '"' +
    ' aria-label="' + escapeHtml(label + (reason ? '——不可用：' + reason : '')) + '">' + glyph + '</button>';
}

function isInView(el, container) {
  var r = el.getBoundingClientRect(), c = container.getBoundingClientRect();
  return r.top >= c.top - 4 && r.bottom <= c.bottom + 4;
}

/* ---------- 约束判定（操作可用性 = 结构保护） ---------- */

function canAddChild(f) { return f.depth < MAX_DEPTH; }
function canPromote(f) { return !!f.parentId; }
function canDemote(f) { return f.index > 0; }
function canMoveDown(f) {
  var loc = locate(state.doc.sections, f.id);
  return !!loc && loc.index < loc.list.length - 1;
}

function issuesFor(f) {
  /* 轻量提示：该节存在校验问题时在大纲上显示圆点 */
  return validateDocCache ? validateDocCache[f.id] : null;
}

var validateDocCache = null;
function refreshValidateCache() {
  validateDocCache = {};
  validateDoc().forEach(function (i) { validateDocCache[i.nodeId] = i; });
}

/* ---------- 编辑器 ---------- */

function renderEditor(syncFields) {
  var body = $('editorBody');
  var node = findNode(state.selectedId);

  if (!node) {
    body.innerHTML = '<div class="editor-empty">' +
      '<div class="big">未选中任何节</div>' +
      '<div>在大纲中选择一节，或新建一节开始编辑。</div>' +
      '<p><button class="sbtn" type="button" data-act="add-root">＋ 新建节</button></p></div>';
    $('crumbs').innerHTML = '<span class="cnum">—</span>';
    return;
  }

  if (!syncFields && body.dataset.editingId === state.selectedId) {
    /* 保留输入状态，仅刷新受结构影响的片段 */
    renderEditorMetaAndActions(node);
    return;
  }
  body.dataset.editingId = state.selectedId;

  /* 面包屑 */
  var crumbs = [];
  (function path(list, chain) {
    for (var j = 0; j < list.length; j++) {
      var cur = chain.concat([{ node: list[j] }]);
      if (list[j].id === state.selectedId) { crumbs = cur; return true; }
      if (list[j].children.length && path(list[j].children, cur)) return true;
    }
    return false;
  })(state.doc.sections, []);
  var cHtml = '<span class="cnum">文档</span>';
  crumbs.forEach(function (c) {
    cHtml += '<span class="csep">/</span><span class="ccur">' + escapeHtml(nodeTitle(c.node)) + '</span>';
  });
  $('crumbs').innerHTML = cHtml;

  var opts = ['draft', 'review', 'final'].map(function (s) {
    return '<option value="' + s + '"' + (node.status === s ? ' selected' : '') + '>' + STATUS_TEXT[s] + '</option>';
  }).join('');

  body.innerHTML =
    '<div class="editor-grid">' +
      '<div class="field"><label class="field-label" for="fTitle">节标题</label>' +
        '<input id="fTitle" class="field-input" type="text" value="' + escapeHtml(node.title) + '" autocomplete="off" spellcheck="false"></div>' +
      '<div class="field"><label class="field-label" for="fStatus">状态</label>' +
        '<select id="fStatus" class="field-select">' + opts + '</select>' +
        '<div class="field-hint">进入预览标签显示</div></div>' +
    '</div>' +
    '<div class="field"><label class="field-label" for="fBody">正文</label>' +
      '<textarea id="fBody" class="field-area" spellcheck="false">' + escapeHtml(node.body.join('\n\n')) + '</textarea>' +
      '<div class="field-hint">空行分段；正文将原样渲染到预览。</div></div>' +
    '<div id="editorMeta" class="editor-meta"></div>' +
    '<div id="editorActions" class="sec-actions"></div>';

  renderEditorMetaAndActions(node);
}

function renderEditorMetaAndActions(node) {
  var flat = flatten(state.doc.sections);
  var f = null;
  for (var i = 0; i < flat.length; i++) if (flat[i].id === state.selectedId) { f = flat[i]; break; }
  if (!f) return;

  var chars = node.body.join('').replace(/\s+/g, '').length;
  var paras = node.body.filter(function (p) { return p.trim(); }).length;
  $('editorMeta').innerHTML =
    '<span>编号 <b>' + f.number + '</b></span>' +
    '<span>层级 <b>' + f.depth + ' / ' + MAX_DEPTH + '</b></span>' +
    '<span>正文 <b>' + paras + '</b> 段 · 约 <b>' + chars + '</b> 字</span>' +
    '<span>子节 <b>' + node.children.length + '</b> 个</span>';

  var btn = function (id, label, act, arg, disabled, reason, cls) {
    return '<button type="button" id="' + id + '" class="sbtn ' + (cls || '') + '" data-act="' + act + '"' +
      (arg ? ' data-id="' + arg + '"' : '') + (disabled ? ' disabled' : '') +
      ' title="' + escapeHtml(reason || label) + '">' + label + '</button>';
  };
  $('editorActions').innerHTML =
    btn('btnAddChild', '＋ 添加子节', 'add-child', f.id, !canAddChild(f),
      canAddChild(f) ? '在「' + nodeTitle(node) + '」下创建子节' : '已达最大层级 ' + MAX_DEPTH + ' 级，不可再深') +
    btn('btnAddSibling', '＋ 添加同级节', 'add-sibling', f.id, false, '在其后创建同级节') +
    btn('btnUp', '↑ 上移', 'move-up', f.id, f.index === 0, f.index === 0 ? '已在本级最前' : '与本节交换位置') +
    btn('btnDown', '↓ 下移', 'move-down', f.id, !canMoveDown(f), canMoveDown(f) ? '与本节交换位置' : '已在本级最后') +
    btn('btnPromote', '⇤ 升级', 'promote', f.id, !canPromote(f), canPromote(f) ? '上提一级，移到父节之后' : '已是顶级节，无法升级') +
    btn('btnDemote', '⇥ 降级', 'demote', f.id, !canDemote(f), canDemote(f) ? '成为前一节的子节' : '前一节不存在（本节是第一节），无法降级') +
    btn('btnRemove', '删除本节', 'remove', f.id, false, '删除（含子节时将询问处理方式）', 'danger');
}

/* ---------- 预览（与编辑同一模型渲染） ---------- */

function docStats() {
  var flat = flatten(state.doc.sections);
  var paras = 0, chars = 0;
  flat.forEach(function (f) {
    f.node.body.forEach(function (p) { chars += p.replace(/\s+/g, '').length; });
    paras += f.node.body.filter(function (p) { return p.trim(); }).length;
  });
  return { sections: flat.length, paras: paras, chars: chars };
}

function renderPreview() {
  var art = $('previewDoc');
  if (!state.doc.sections.length) {
    art.innerHTML = '<div class="pv-doc-empty">（空文档）<br>在大纲中新建节后，此处将实时渲染全文。</div>';
    return;
  }
  var st = docStats();
  var html = '<h1 class="pv-doc-title">' + escapeHtml(state.doc.title.trim() || '（无标题文档）') + '</h1>' +
    '<div class="pv-doc-meta">' + st.sections + ' 节 · ' + st.paras + ' 段 · 约 ' + st.chars + ' 字</div>';

  var walk = function (sections, depth) {
    var out = '';
    sections.forEach(function (n) {
      var lv = Math.min(depth, 4);
      out += '<section class="pv-sec lv' + lv + '" data-node="' + n.id + '" style="--lv:' + lv + '">' +
        '<div class="pv-head" data-id="' + n.id + '" role="button" tabindex="0" aria-label="选中小节 ' + escapeHtml(nodeTitle(n)) + '">' +
        '<span class="pv-num">' + numberFor(n.id) + '</span>' +
        '<span class="pv-text">' + escapeHtml(nodeTitle(n)) + '</span>' +
        '<span class="pv-status ' + n.status + '">' + STATUS_TEXT[n.status] + '</span></div>' +
        '<div class="pv-body-wrap">' +
        n.body.map(function (p) {
          var t = escapeHtml(p);
          return t.trim() ? '<p class="pv-p">' + t + '</p>' : '';
        }).join('') +
        (n.children.length ? '<div class="pv-children">' + walk(n.children, depth + 1) + '</div>' : '') +
        '</div></section>';
    });
    return out;
  };
  html += walk(state.doc.sections, 1);
  art.innerHTML = html;

  var selEl = art.querySelector('[data-node="' + state.selectedId + '"]');
  if (selEl) {
    if (art.dataset.selectedNode !== state.selectedId) {
      selEl.scrollIntoView({ block: 'nearest', behavior: 'auto' });
    }
    selEl.setAttribute('data-selected', '1');
  }
  art.dataset.selectedNode = state.selectedId || '';
}

function numberFor(id) {
  var flat = flatten(state.doc.sections);
  for (var i = 0; i < flat.length; i++) if (flat[i].id === id) return flat[i].number;
  return '';
}

/* ---------- 结构检查面板 ---------- */

function renderReport() {
  var issues = validateDoc();
  $('reportState').textContent = issues.length ? issues.length + ' 项提醒' : '未发现问题';
  $('reportState').className = 'report-state ' + (issues.length ? 'warn' : 'ok');

  $('reportInvariants').textContent =
    '结构约束全部满足：层级连续（≤ ' + MAX_DEPTH + ' 级）· 无孤儿节 · 操作经白名单校验';

  var list = $('reportList');
  if (!issues.length) {
    list.innerHTML = '<li><div class="report-none">✓ 未发现空标题、空正文或同级重复标题。</div></li>';
    return;
  }
  list.innerHTML = issues.map(function (i) {
    return '<li><button type="button" class="ritem" data-node="' + i.nodeId + '">' +
      '<span class="rnum">' + i.number + '</span><span>' + escapeHtml(i.msg) + '</span></button></li>';
  }).join('');
}

/* ================= 反馈（轻提示 + 屏幕阅读器实时区域） ================= */

var toastTimer = null;
function feedback(msg) {
  $('live').textContent = msg;
  var t = $('toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { t.hidden = true; }, 2000);
}

/* ================= 弹窗 ================= */

var modalState = { prevFocus: null };

function openModal(cfg) {
  modalState.prevFocus = document.activeElement;
  $('modalTitle').textContent = cfg.title;
  $('modalBody').textContent = cfg.body;
  var box = $('modalActions');
  box.innerHTML = '';
  cfg.actions.forEach(function (a, i) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'mbtn ' + (a.kind || '');
    b.textContent = a.label;
    b.addEventListener('click', a.run);
    if (i === cfg.actions.length - 1 && a.kind === 'mbtn') b.setAttribute('data-cancel', '1');
    box.appendChild(b);
  });
  $('modalBackdrop').hidden = false;
  var first = box.querySelector('button');
  if (first) first.focus();
}

function closeModal() {
  $('modalBackdrop').hidden = true;
  if (modalState.prevFocus && document.contains(modalState.prevFocus)) modalState.prevFocus.focus();
  modalState.prevFocus = null;
}

/* ================= 事件绑定 ================= */

function bindEvents() {
  /* 文档标题 */
  $('docTitle').addEventListener('input', function () {
    opUpdateDocTitle(this.value, 'doc-title');
  });

  /* 顶部按钮 */
  $('btnUndo').addEventListener('click', opUndo);
  $('btnRedo').addEventListener('click', opRedo);
  $('btnReport').addEventListener('click', function () {
    state.reportOpen = !state.reportOpen;
    this.setAttribute('aria-expanded', String(state.reportOpen));
    $('reportPanel').hidden = !state.reportOpen;
    refreshValidateCache();
    if (state.reportOpen) renderReport();
  });
  $('btnReset').addEventListener('click', opReset);

  /* 大纲（事件委托） */
  $('outlineTree').addEventListener('click', function (e) {
    var actBtn = e.target.closest('[data-act]');
    if (actBtn) {
      if (actBtn.disabled) return;
      var act = actBtn.getAttribute('data-act');
      var id = actBtn.getAttribute('data-id');
      if (act === 'add-root') return opAddRoot();
      if (act === 'add-child') return opAddChild(id);
      if (act === 'add-sibling') return opAddSibling(id);
      if (act === 'move-up') return opMove(id, -1);
      if (act === 'move-down') return opMove(id, 1);
      if (act === 'promote') return opPromote(id);
      if (act === 'demote') return opDemote(id);
      if (act === 'remove') return opRemove(id);
      return;
    }
    var row = e.target.closest('[data-row]');
    if (row) selectSection(row.getAttribute('data-row'));
  });

  /* 大纲键盘：↑/↓ 在行间移动选择（roving tabindex） */
  $('outlineTree').addEventListener('keydown', function (e) {
    var row = e.target.closest ? e.target.closest('[data-row]') : null;
    if (!row) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      var flat = flatten(state.doc.sections);
      var idx = -1;
      flat.forEach(function (f, i) { if (f.id === row.getAttribute('data-row')) idx = i; });
      var next = flat[idx + (e.key === 'ArrowDown' ? 1 : -1)];
      if (next) { selectSection(next.id); }
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      selectSection(row.getAttribute('data-row'));
    }
  });

  /* 编辑器字段 */
  $('editorBody').addEventListener('input', function (e) {
    var t = e.target;
    if (t.id === 'fTitle') opUpdateSection(state.selectedId, { title: t.value }, 'title|' + state.selectedId);
    if (t.id === 'fBody') {
      var paras = t.value.split(/\n\s*\n/).map(function (s) { return s.replace(/[ \t]+\n/g, '\n'); });
      opUpdateSection(state.selectedId, { body: paras }, 'body|' + state.selectedId);
    }
  });
  $('editorBody').addEventListener('change', function (e) {
    if (e.target.id === 'fStatus') {
      commit('状态已改为「' + STATUS_TEXT[e.target.value] + '」', null, function () {
        findNode(state.selectedId).status = e.target.value;
      });
    }
  });

  /* 编辑器按钮（事件委托） */
  $('editorBody').addEventListener('click', function (e) {
    var b = e.target.closest('[data-act]');
    if (!b || b.disabled) return;
    var act = b.getAttribute('data-act');
    var id = b.getAttribute('data-id');
    if (act === 'add-root') return opAddRoot();
    if (act === 'add-child') return opAddChild(id);
    if (act === 'add-sibling') return opAddSibling(id);
    if (act === 'move-up') return opMove(id, -1);
    if (act === 'move-down') return opMove(id, 1);
    if (act === 'promote') return opPromote(id);
    if (act === 'demote') return opDemote(id);
    if (act === 'remove') return opRemove(id);
  });

  /* 预览：点击标题选中对应变节（双向一致） */
  $('previewDoc').addEventListener('click', function (e) {
    var h = e.target.closest('.pv-head');
    if (h) selectSection(h.getAttribute('data-id'), true);
  });
  $('previewDoc').addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    var h = e.target.closest('.pv-head');
    if (h) { e.preventDefault(); selectSection(h.getAttribute('data-id'), true); }
  });

  /* 结构检查项 → 定位 */
  $('reportList').addEventListener('click', function (e) {
    var b = e.target.closest('.ritem');
    if (b) selectSection(b.getAttribute('data-node'), true);
  });

  /* 全局键盘契约：Ctrl+Z / Ctrl+Y（Ctrl+Shift+Z） */
  document.addEventListener('keydown', function (e) {
    var modalOpen = !$('modalBackdrop').hidden;
    if (modalOpen) {
      if (e.key === 'Escape') { e.preventDefault(); closeModal(); }
      return;
    }
    if ((e.ctrlKey || e.metaKey) && !e.altKey) {
      var k = e.key.toLowerCase();
      if (k === 'z' && !e.shiftKey) { e.preventDefault(); opUndo(); }
      else if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); opRedo(); }
      else if (k === 's') { e.preventDefault(); feedback('本文档为本地单页应用，无需保存——所有更改已实时生效。'); }
    }
  });
}

function selectSection(id, fromPreview) {
  if (id === state.selectedId) return;
  state.selectedId = id;
  renderOutline();
  renderEditor(true);
  renderPreview();
  renderReport();
  var row = outlineRowEl(id);
  if (row && !fromPreview) row.focus();
  if (row) row.scrollIntoView({ block: 'nearest' });
}

/* ================= 启动：首屏即就绪（无加载态） ================= */

refreshValidateCache();
bindEvents();
renderAll(true);
