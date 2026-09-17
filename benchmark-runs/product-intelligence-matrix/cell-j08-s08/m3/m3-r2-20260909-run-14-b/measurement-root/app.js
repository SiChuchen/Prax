/* ============================================================
   Structura · 结构文档工作台
   单一数据源：编辑器与预览均渲染自同一文档模型 —— 编辑与预览一致
   是结构保证（同帧同步渲染），而非视觉巧合。

   状态模型（state completeness）：
   - ready    页面加载即就绪（初始文档随 data.js 内联，无网络加载）
   - loading  同步内联初始化，不存在可观测的加载态（简报要求）
   - empty    文档无任何块时的空状态（编辑区 + 预览区各有呈现）
   - selected 块选中态（编辑区 / 预览区 / 大纲三处同步高亮）
   - error    结构检查错误（诊断面板 + 顶栏健康度徽标），可一键修复
   ============================================================ */
(function () {
  'use strict';

  /* ---------------- 常量 ---------------- */
  var LS_KEY = 'structura.doc.v1';
  var HEADING_LEVELS = { h2: 2, h3: 3, h4: 4 };
  var TYPE_LABELS = {
    h2: '标题', h3: '标题', h4: '标题', p: '正文',
    ul: '列表', ol: '列表', quote: '引用', code: '代码',
    callout: '提示', divider: '分隔线'
  };
  var INSERT_TYPES = ['h2', 'h3', 'h4', 'p', 'ul', 'ol', 'quote', 'code', 'callout', 'divider'];
  var INSERT_LABELS = {
    h2: '二级标题', h3: '三级标题', h4: '四级标题', p: '段落',
    ul: '无序列表', ol: '有序列表', quote: '引用', code: '代码块',
    callout: '提示块', divider: '分隔线'
  };
  var CALLOUT_VARIANTS = { tip: '提示', info: '说明', warn: '注意' };

  /* contenteditable 能力探测：支持 plaintext-only 则用之，否则退化并手动拦截粘贴 */
  var CE_PLAIN = (function () {
    var d = document.createElement('div');
    d.setAttribute('contenteditable', 'plaintext-only');
    return d.contentEditable === 'plaintext-only';
  })();
  var CE = CE_PLAIN ? 'plaintext-only' : 'true';

  /* ---------------- 状态 ---------------- */
  var doc = null;          // { title, blocks: [...] } —— 唯一数据源
  var selectedId = null;   // 选中的块
  var history = [];        // 快照栈（撤销/重做）
  var hPtr = -1;
  var diags = [];          // 当前结构诊断
  var saveTimer = null;
  var commitTimer = null;
  var toastTimer = null;

  /* ---------------- 工具 ---------------- */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  var editorEl = $('#editor');
  var previewEl = $('#preview');
  function uid() { return 'b' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function findBlock(id) {
    for (var i = 0; i < doc.blocks.length; i++) if (doc.blocks[i].id === id) return i;
    return -1;
  }
  function newBlock(type) {
    var b = { id: uid(), type: type };
    if (type in HEADING_LEVELS || type === 'p' || type === 'quote' || type === 'code' || type === 'callout') b.text = '';
    if (type === 'callout') b.variant = 'tip';
    if (type === 'ul' || type === 'ol') b.items = [''];
    return b;
  }
  function blockPlainText(b) {
    if (b.type === 'ul' || b.type === 'ol') return (b.items || []).join(' ');
    return b.text || '';
  }
  function placeCaretEnd(el) {
    if (!el) return;
    el.focus();
    var r = document.createRange();
    r.selectNodeContents(el);
    r.collapse(false);
    var s = window.getSelection();
    s.removeAllRanges();
    s.addRange(r);
  }
  function focusBlockContent(id) {
    var el = $('.block[data-id="' + id + '"] .content', editorEl);
    if (el) placeCaretEnd(el);
    else { var blk = $('.block[data-id="' + id + '"]', editorEl); if (blk) blk.focus(); }
  }

  /* ---------------- 历史与持久化 ---------------- */
  function commitNow() { clearTimeout(commitTimer); pushHistory(); }
  function commitTyping() {
    clearTimeout(commitTimer);
    commitTimer = setTimeout(pushHistory, 650);
  }
  function pushHistory() {
    history = history.slice(0, hPtr + 1);
    history.push(clone(doc));
    if (history.length > 100) history.shift();
    hPtr = history.length - 1;
    updateHistoryUI();
    scheduleSave();
  }
  function undo() { if (hPtr > 0) { clearTimeout(commitTimer); hPtr--; restore(); } }
  function redo() { if (hPtr < history.length - 1) { clearTimeout(commitTimer); hPtr++; restore(); } }
  function restore() {
    doc = clone(history[hPtr]);
    if (selectedId && findBlock(selectedId) < 0) selectedId = null;
    renderAll();
    scheduleSave();
    updateHistoryUI();
  }
  function updateHistoryUI() {
    $('#undoBtn').disabled = hPtr <= 0;
    $('#redoBtn').disabled = hPtr >= history.length - 1;
  }
  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, 500);
  }
  function saveNow() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(doc));
      $('#saveTime').textContent = '已保存 ' + new Date().toLocaleTimeString('zh-CN', { hour12: false });
    } catch (e) { /* file:// 下个别浏览器禁用 localStorage —— 静默降级，不影响编辑 */ }
  }

  /* ---------------- 渲染：编辑器 ---------------- */
  function ceAttr(field, extra) {
    return ' class="content" contenteditable="' + CE + '" data-field="' + field + '" ' + (extra || '');
  }
  function blockChip(b) {
    if (b.type in HEADING_LEVELS) return 'H' + HEADING_LEVELS[b.type];
    return TYPE_LABELS[b.type];
  }
  function blockBodyHtml(b) {
    var t = b.type, h = '';
    if (t in HEADING_LEVELS) {
      h += '<div class="hwrap"><span class="lvl-chip">H' + HEADING_LEVELS[t] + '</span>';
      h += '<div' + ceAttr('text') + 'data-ph="分区标题">' + esc(b.text) + '</div></div>';
    } else if (t === 'p') {
      h += '<div' + ceAttr('text') + 'data-ph="输入正文…">' + esc(b.text) + '</div>';
    } else if (t === 'ul' || t === 'ol') {
      h += '<div class="list">';
      (b.items || []).forEach(function (it, i) {
        var mark = t === 'ol' ? (i + 1) + '.' : '•';
        h += '<div class="item-line" data-index="' + i + '"><span class="mark">' + mark + '</span>';
        h += '<div' + ceAttr('item', 'data-index="' + i + '"') + 'data-ph="列表项">' + esc(it) + '</div>';
        h += '<button class="mini" type="button" data-action="rm-item" data-index="' + i + '" title="删除该列表项">✕</button></div>';
      });
      h += '<button class="add-item" type="button" data-action="add-item">＋ 添加列表项</button></div>';
    } else if (t === 'quote') {
      h += '<div' + ceAttr('text') + 'data-ph="引用的文字…">' + esc(b.text) + '</div>';
    } else if (t === 'code') {
      h += '<div' + ceAttr('text') + 'data-ph="输入代码…">' + esc(b.text) + '</div>';
    } else if (t === 'callout') {
      h += '<div class="callout-row"><select class="variant-sel" data-field="variant" aria-label="提示类型">';
      Object.keys(CALLOUT_VARIANTS).forEach(function (k) {
        h += '<option value="' + k + '"' + (b.variant === k ? ' selected' : '') + '>' + CALLOUT_VARIANTS[k] + '</option>';
      });
      h += '</select><div' + ceAttr('text') + 'data-ph="提示内容…">' + esc(b.text) + '</div></div>';
    } else if (t === 'divider') {
      h += '<div class="divider-line"></div>';
    }
    return h;
  }
  function editorBlockHtml(b) {
    var sel = b.id === selectedId ? ' selected' : '';
    var h = '<article class="block t-' + b.type + sel + '" data-id="' + b.id + '" role="listitem" tabindex="-1">';
    h += '<div class="gutter"><span class="type-chip">' + blockChip(b) + '</span></div>';
    h += '<div class="main">' + blockBodyHtml(b) + '</div>';
    h += '<div class="ops">';
    if (b.type in HEADING_LEVELS) {
      h += '<button class="lvlbtn" type="button" data-action="promote" title="提升一级（Shift+Tab）">H−</button>';
      h += '<button class="lvlbtn" type="button" data-action="demote" title="降低一级（Tab）">H+</button>';
    }
    h += '<button type="button" data-action="up" title="上移 (Alt+↑)">↑</button>';
    h += '<button type="button" data-action="down" title="下移 (Alt+↓)">↓</button>';
    h += '<button type="button" data-action="dup" title="复制块">⧉</button>';
    h += '<button class="del" type="button" data-action="del" title="删除块（Ctrl+Z 可撤销）">✕</button>';
    h += '<button type="button" data-action="insert" title="在其后插入块">＋</button>';
    h += '</div></article>';
    return h;
  }
  function renderEditor() {
    if (!doc.blocks.length) {
      editorEl.innerHTML =
        '<div class="editor-empty"><div class="big-plus">＋</div>' +
        '文档是空的。插入第一个内容块：<br>' +
        '<button class="add-item" type="button" data-action="insert-first" style="font-size:13px">选择块类型…</button></div>';
      return;
    }
    var h = '';
    doc.blocks.forEach(function (b) { h += editorBlockHtml(b); });
    editorEl.innerHTML = h;
  }

  /* ---------------- 渲染：预览（与编辑器共享同一数据源） ---------------- */
  function pvBlock(b) {
    var sel = b.id === selectedId ? ' selected' : '';
    var id = ' data-pv-id="' + b.id + '"';
    var t = b.type, h = '';
    if (t === 'h2') h = '<h2 class="pv-h pv' + sel + '"' + id + '>' + esc(b.text) + '</h2>';
    else if (t === 'h3') h = '<h3 class="pv-h pv' + sel + '"' + id + '>' + esc(b.text) + '</h3>';
    else if (t === 'h4') h = '<h4 class="pv-h pv' + sel + '"' + id + '>' + esc(b.text) + '</h4>';
    else if (t === 'p') h = '<p class="pv' + sel + '"' + id + '>' + esc(b.text) + '</p>';
    else if (t === 'ul' || t === 'ol') {
      h = '<' + t + ' class="pv' + sel + '"' + id + '>';
      (b.items || []).forEach(function (it) { h += '<li class="pv-li">' + esc(it) + '</li>'; });
      h += '</' + t + '>';
    }
    else if (t === 'quote') h = '<blockquote class="pv' + sel + '"' + id + '>' + esc(b.text) + '</blockquote>';
    else if (t === 'code') h = '<pre class="pv' + sel + '"' + id + '><code>' + esc(b.text) + '</code></pre>';
    else if (t === 'callout') {
      var v = CALLOUT_VARIANTS[b.variant] ? b.variant : 'tip';
      h = '<aside class="pv-callout pv v-' + v + sel + '"' + id + '><span class="tag">' + CALLOUT_VARIANTS[v] + '</span><span>' + esc(b.text) + '</span></aside>';
    }
    else if (t === 'divider') h = '<hr class="pv' + sel + '"' + id + '>';
    return h;
  }
  function renderPreview() {
    var h = '<header><p class="doc-kicker">文档</p><h1 class="doc-title">' + esc(doc.title || '未命名文档') + '</h1></header>';
    if (!doc.blocks.length) {
      h += '<div class="pv-empty">文档还没有内容 —— 在左侧「结构化编辑」添加第一个内容块，这里会实时呈现最终排版。</div>';
    } else {
      doc.blocks.forEach(function (b) { h += pvBlock(b); });
    }
    previewEl.innerHTML = h;
    var chip = $('#syncChip');
    chip.classList.remove('blip');
    void chip.offsetWidth;
    chip.classList.add('blip');
  }

  /* ---------------- 渲染：大纲（由标题块派生） ---------------- */
  function activeOutlineId() {
    var i = selectedId ? findBlock(selectedId) : -1;
    if (i < 0) return null;
    for (var j = i; j >= 0; j--) {
      if (doc.blocks[j].type in HEADING_LEVELS) return doc.blocks[j].id;
    }
    return null;
  }
  function renderOutline() {
    var out = $('#outline');
    var heads = doc.blocks.filter(function (b) { return b.type in HEADING_LEVELS; });
    if (!heads.length) {
      out.innerHTML = '<div class="outline-empty">暂无分区。<br>添加 H2–H4 标题块后，大纲在此自动生成。</div>';
      return;
    }
    var act = activeOutlineId();
    var h = '';
    heads.forEach(function (b) {
      var lv = HEADING_LEVELS[b.type];
      var pad = (lv - 2) * 15;
      var cls = 'outline-item' + (b.id === act ? ' active' : '');
      var txt = b.text.trim() || '（空标题）';
      h += '<button class="' + cls + '" type="button" data-goto="' + b.id + '" style="padding-left:' + (8 + pad) + 'px" title="' + esc(txt) + '">' + esc(txt) + '</button>';
    });
    out.innerHTML = h;
  }

  /* ---------------- 结构检查（编辑不破坏结构的核心保障） ---------------- */
  function computeDiags() {
    var list = [];
    var bs = doc.blocks;
    var prevLevel = 1; // 基线：文档主标题视作 H1
    var seenHeading = false;
    bs.forEach(function (b) {
      if (b.type in HEADING_LEVELS) {
        var lv = HEADING_LEVELS[b.type];
        var txt = (b.text || '').trim();
        if (!txt) {
          list.push({ code: 'empty-heading', blockId: b.id, severity: 'error', msg: '存在空标题，分区缺少名称', fixLabel: '填充默认标题' });
        }
        if (lv > prevLevel + 1) {
          var from = prevLevel === 1 ? '文档标题（H1）' : 'H' + prevLevel;
          list.push({
            code: 'level-skip', blockId: b.id, severity: 'error',
            msg: '「' + (txt || '空标题') + '」从 ' + from + ' 直接跳到 H' + lv + '，缺少中间层级',
            fixLabel: '调整为 H' + (prevLevel + 1), fixLevel: prevLevel + 1
          });
        }
        prevLevel = lv;
        seenHeading = true;
      } else if (b.type === 'p') {
        if (!(b.text || '').trim()) list.push({ code: 'empty-p', blockId: b.id, severity: 'warn', msg: '存在空段落', fixLabel: '删除空段落' });
      } else if (b.type === 'ul' || b.type === 'ol') {
        var empty = !(b.items || []).length || (b.items || []).every(function (i) { return !String(i).trim(); });
        if (empty) list.push({ code: 'empty-list', blockId: b.id, severity: 'error', msg: '存在空列表（没有任何列表项）', fixLabel: '删除空列表' });
      } else if (b.type === 'quote' || b.type === 'callout') {
        if (!(b.text || '').trim()) list.push({ code: 'empty-quote', blockId: b.id, severity: 'warn', msg: '存在空的' + TYPE_LABELS[b.type] + '块', fixLabel: '删除' + TYPE_LABELS[b.type] + '块' });
      }
    });
    if (!seenHeading) {
      list.push({ code: 'no-heading', blockId: bs.length ? bs[0].id : null, severity: 'error', msg: '文档没有任何分区标题（H2–H4）', fixLabel: '在开头插入 H2' });
    }
    var last = bs[bs.length - 1];
    if (last && (last.type in HEADING_LEVELS) && (last.text || '').trim()) {
      list.push({ code: 'trailing-heading', blockId: last.id, severity: 'warn', msg: '文档以标题结尾，该标题下没有内容' });
    }
    return list;
  }
  function applyFix(i) {
    var d = diags[i];
    if (!d) return;
    var idx = d.blockId ? findBlock(d.blockId) : -1;
    var b = idx >= 0 ? doc.blocks[idx] : null;
    switch (d.code) {
      case 'level-skip':
        if (b) b.type = 'h' + d.fixLevel;
        break;
      case 'empty-heading':
        if (b) b.text = '未命名分区';
        break;
      case 'empty-p':
      case 'empty-list':
      case 'empty-quote':
        if (idx >= 0) { doc.blocks.splice(idx, 1); if (selectedId === d.blockId) selectedId = null; }
        break;
      case 'no-heading': {
        var nb = newBlock('h2');
        nb.text = '未命名分区';
        doc.blocks.unshift(nb);
        break;
      }
    }
    commitNow();
    renderAll();
    showToast('已修复：' + d.msg, '撤销', undo);
  }
  function renderDiags() {
    diags = computeDiags();
    var box = $('#diags');
    var countEl = $('#diagCount');
    if (!diags.length) {
      box.innerHTML = '<div class="diag-ok">✓ 结构检查通过：层级连续、无空块。</div>';
      countEl.textContent = '';
    } else {
      var h = '';
      diags.forEach(function (d, i) {
        h += '<div class="diag ' + d.severity + '" data-diag="' + i + '" role="button" tabindex="0">';
        h += '<span class="dot"></span><span class="diag-msg">' + esc(d.msg) + '</span>';
        if (d.fixLabel) h += '<button class="fix" type="button" data-fix="' + i + '">' + esc(d.fixLabel) + '</button>';
        h += '</div>';
      });
      box.innerHTML = h;
      countEl.textContent = diags.length + ' 项';
    }
    updateHealth();
  }
  function updateHealth() {
    var pill = $('#healthPill');
    var errs = diags.filter(function (d) { return d.severity === 'error'; }).length;
    var warns = diags.length - errs;
    pill.className = 'pill';
    if (!doc.blocks.length) { pill.classList.add('warn'); pill.textContent = '空文档'; return; }
    if (errs) { pill.classList.add('err'); pill.textContent = errs + ' 个结构问题'; }
    else if (warns) { pill.classList.add('warn'); pill.textContent = warns + ' 个待完善'; }
    else { pill.classList.add('ok'); pill.textContent = '结构完好'; }
  }

  /* ---------------- 渲染：统计 ---------------- */
  function renderStats() {
    var text = doc.title + ' ' + doc.blocks.map(blockPlainText).join(' ');
    var cjk = (text.match(/[一-鿿㐀-䶿]/g) || []).length;
    var words = (text.match(/[A-Za-z0-9][A-Za-z0-9'\-]*/g) || []).length;
    var sections = doc.blocks.filter(function (b) { return b.type in HEADING_LEVELS; }).length;
    $('#stats').textContent = '共 ' + doc.blocks.length + ' 块 · ' + sections + ' 个分区 · ' + (cjk + words) + ' 字';
  }

  function renderAll() {
    renderEditor();
    renderPreview();
    renderOutline();
    renderDiags();
    renderStats();
  }

  /* ---------------- 选中与滚动同步 ---------------- */
  function updateSelectionUI() {
    $$('.block', editorEl).forEach(function (el) {
      el.classList.toggle('selected', el.dataset.id === selectedId);
    });
    $$('[data-pv-id]', previewEl).forEach(function (el) {
      el.classList.toggle('selected', el.dataset.pvId === selectedId);
    });
    renderOutline();
  }
  function scrollEditorTo(id) {
    var el = $('.block[data-id="' + id + '"]', editorEl);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  function scrollPreviewTo(id) {
    var el = $('[data-pv-id="' + id + '"]', previewEl);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  function selectBlock(id, opts) {
    selectedId = id || null;
    updateSelectionUI();
    opts = opts || {};
    if (selectedId && opts.scrollEditor) scrollEditorTo(selectedId);
    if (selectedId && opts.scrollPreview) scrollPreviewTo(selectedId);
  }

  /* ---------------- 块操作 ---------------- */
  function afterModelChange(focusId) {
    commitNow();
    renderAll();
    if (focusId) { focusBlockContent(focusId); scrollEditorTo(focusId); scrollPreviewTo(focusId); }
  }
  function moveBlock(id, dir) {
    var i = findBlock(id);
    if (i < 0) return;
    var j = i + dir;
    if (j < 0 || j >= doc.blocks.length) return;
    var t = doc.blocks[i];
    doc.blocks[i] = doc.blocks[j];
    doc.blocks[j] = t;
    afterModelChange();
    scrollEditorTo(id);
    scrollPreviewTo(id);
  }
  function deleteBlock(id) {
    var i = findBlock(id);
    if (i < 0) return;
    var b = doc.blocks[i];
    var label = TYPE_LABELS[b.type];
    doc.blocks.splice(i, 1);
    if (selectedId === id) {
      var next = doc.blocks[Math.min(i, doc.blocks.length - 1)];
      selectedId = next ? next.id : null;
    }
    afterModelChange();
    showToast('已删除一个「' + label + '」块', '撤销', undo);
  }
  function duplicateBlock(id) {
    var i = findBlock(id);
    if (i < 0) return;
    var cp = clone(doc.blocks[i]);
    cp.id = uid();
    doc.blocks.splice(i + 1, 0, cp);
    selectedId = cp.id;
    afterModelChange();
    scrollEditorTo(cp.id);
  }
  function changeLevel(id, delta) {
    var b = doc.blocks[findBlock(id)];
    if (!b || !(b.type in HEADING_LEVELS)) return;
    var lv = HEADING_LEVELS[b.type] + delta;
    if (lv < 2) lv = 2;
    if (lv > 4) lv = 4;
    b.type = 'h' + lv;
    afterModelChange(id); // 重建后焦点回到标题内容，支持连续 Tab/Shift+Tab
  }
  function insertBlock(type, afterId) {
    var nb = newBlock(type);
    if (afterId) {
      var i = findBlock(afterId);
      doc.blocks.splice(i + 1, 0, nb);
    } else {
      doc.blocks.push(nb);
    }
    selectedId = nb.id;
    afterModelChange();
    if (type === 'divider') scrollEditorTo(nb.id);
    return nb.id;
  }
  function addItem(id, afterIndex) {
    var b = doc.blocks[findBlock(id)];
    if (!b) return;
    (b.items = b.items || []).splice(afterIndex + 1, 0, '');
    afterModelChange();
    var el = $('.block[data-id="' + id + '"] .item-line[data-index="' + (afterIndex + 1) + '"] .content', editorEl);
    if (el) placeCaretEnd(el);
  }

  /* ---------------- 插入菜单 ---------------- */
  var typeMenu = $('#typeMenu');
  var menuAnchor = null;
  function openTypeMenu(anchor, afterId) {
    menuAnchor = anchor;
    var h = '';
    INSERT_TYPES.forEach(function (t) {
      h += '<button type="button" data-type="' + t + '"><span>' + INSERT_LABELS[t] + '</span><span class="k">' + blockChip({ type: t }) + '</span></button>';
    });
    typeMenu.innerHTML = h;
    typeMenu.dataset.after = afterId || '';
    typeMenu.hidden = false;
    var r = anchor.getBoundingClientRect();
    var x = Math.min(r.left, window.innerWidth - 190);
    var y = r.bottom + 6;
    if (y + 330 > window.innerHeight) y = Math.max(8, r.top - 336);
    typeMenu.style.left = x + 'px';
    typeMenu.style.top = y + 'px';
    var first = $('button', typeMenu);
    if (first) first.focus();
  }
  function closeTypeMenu() { typeMenu.hidden = true; menuAnchor = null; }
  typeMenu.addEventListener('click', function (e) {
    var btn = e.target.closest('button[data-type]');
    if (!btn) return;
    var after = typeMenu.dataset.after || null;
    closeTypeMenu();
    var id = insertBlock(btn.dataset.type, after && findBlock(after) >= 0 ? after : null);
  });

  /* ---------------- 提示条 ---------------- */
  var toastEl = $('#toast');
  function showToast(text, actionText, fn) {
    clearTimeout(toastTimer);
    var h = '<span>' + esc(text) + '</span>';
    if (actionText) h += '<button type="button" data-toast-action>' + esc(actionText) + '</button>';
    toastEl.innerHTML = h;
    toastEl.hidden = false;
    toastEl.__fn = fn || null;
    toastTimer = setTimeout(function () { toastEl.hidden = true; }, 4000);
  }
  toastEl.addEventListener('click', function (e) {
    if (e.target.closest('[data-toast-action]')) {
      toastEl.hidden = true;
      if (toastEl.__fn) toastEl.__fn();
    }
  });

  /* ---------------- 导出 ---------------- */
  function slugName() {
    var s = (doc.title || 'document').replace(/[\\/:*?"<>|\s]+/g, '-').replace(/^-+|-+$/g, '');
    return (s || 'document').slice(0, 40);
  }
  function download(name, mime, content) {
    var blob = new Blob([content], { type: mime + ';charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }
  function toMarkdown() {
    var L = ['# ' + (doc.title || '未命名文档'), ''];
    doc.blocks.forEach(function (b) {
      var t = (b.text || '').trim();
      if (b.type in HEADING_LEVELS) { L.push('#'.repeat(HEADING_LEVELS[b.type]) + ' ' + t, ''); }
      else if (b.type === 'p') { L.push(t, ''); }
      else if (b.type === 'ul') { (b.items || []).forEach(function (i) { L.push('- ' + i.trim()); }); L.push(''); }
      else if (b.type === 'ol') { (b.items || []).forEach(function (i, n) { L.push((n + 1) + '. ' + i.trim()); }); L.push(''); }
      else if (b.type === 'quote') { L.push('> ' + t, ''); }
      else if (b.type === 'code') { L.push('```', b.text || '', '```', ''); }
      else if (b.type === 'callout') { L.push('> **' + (CALLOUT_VARIANTS[b.variant] || '提示') + ' |** ' + t, ''); }
      else if (b.type === 'divider') { L.push('---', ''); }
    });
    return L.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
  }
  function toExportHtml() {
    function body() {
      var h = '<h1>' + esc(doc.title || '未命名文档') + '</h1>';
      doc.blocks.forEach(function (b) {
        var t = esc(b.text || '');
        if (b.type === 'h2') h += '<h2>' + t + '</h2>';
        else if (b.type === 'h3') h += '<h3>' + t + '</h3>';
        else if (b.type === 'h4') h += '<h4>' + t + '</h4>';
        else if (b.type === 'p') h += '<p>' + t + '</p>';
        else if (b.type === 'ul' || b.type === 'ol') {
          h += '<' + b.type + '>';
          (b.items || []).forEach(function (i) { h += '<li>' + esc(i) + '</li>'; });
          h += '</' + b.type + '>';
        }
        else if (b.type === 'quote') h += '<blockquote>' + t + '</blockquote>';
        else if (b.type === 'code') h += '<pre><code>' + t + '</code></pre>';
        else if (b.type === 'callout') h += '<aside><strong>' + (CALLOUT_VARIANTS[b.variant] || '提示') + '</strong> ' + t + '</aside>';
        else if (b.type === 'divider') h += '<hr>';
      });
      return h;
    }
    return '<!DOCTYPE html>\n<html lang="zh-CN">\n<head>\n<meta charset="utf-8">\n<title>' + esc(doc.title || '未命名文档') + '</title>\n' +
      '<style>body{font-family:Georgia,"Source Han Serif SC","SimSun",serif;max-width:720px;margin:40px auto;padding:0 24px;color:#2b261d;line-height:2;font-size:15.5px}h1{border-bottom:2px solid #2b261d;padding-bottom:12px}h2{border-bottom:1px solid #e2ddd1;padding-bottom:6px}blockquote{border-left:3px solid #c3cbf3;background:#f5f3ea;margin:16px 0;padding:8px 18px;border-radius:0 8px 8px 0}pre{background:#2e2a22;color:#efeade;padding:12px 18px;border-radius:10px;overflow-x:auto}aside{background:#e8f3ec;border:1px solid #cfe5d8;border-radius:10px;padding:10px 16px;font-family:system-ui,sans-serif;font-size:14px}hr{border:0;height:1px;background:#d3ccbc;margin:28px 0}</style>\n' +
      '</head>\n<body>\n' + body() + '\n</body>\n</html>\n';
  }

  /* ---------------- 事件绑定 ---------------- */
  editorEl.addEventListener('click', function (e) {
    var actionBtn = e.target.closest('[data-action]');
    var blockEl = e.target.closest('.block');
    var blockId = blockEl ? blockEl.dataset.id : null;
    if (actionBtn) {
      var act = actionBtn.dataset.action;
      e.preventDefault();
      e.stopPropagation();
      if (!blockId && act !== 'insert-first') return;
      if (act === 'up') moveBlock(blockId, -1);
      else if (act === 'down') moveBlock(blockId, 1);
      else if (act === 'dup') duplicateBlock(blockId);
      else if (act === 'del') deleteBlock(blockId);
      else if (act === 'promote') changeLevel(blockId, -1);
      else if (act === 'demote') changeLevel(blockId, 1);
      else if (act === 'insert') openTypeMenu(actionBtn, blockId);
      else if (act === 'insert-first') openTypeMenu(actionBtn, null);
      else if (act === 'add-item') addItem(blockId, (blockEl.querySelectorAll('.item-line').length || 1) - 1);
      else if (act === 'rm-item') {
        var b = doc.blocks[findBlock(blockId)];
        var idx = parseInt(actionBtn.dataset.index, 10);
        b.items.splice(idx, 1);
        if (!b.items.length) b.items.push('');
        afterModelChange();
      }
      return;
    }
    if (e.target.closest('[data-diag]')) return;
    if (blockId) selectBlock(blockId, { scrollPreview: false });
  });

  /* 内容输入：只更新模型并重渲预览（不重渲编辑器，保持光标） */
  editorEl.addEventListener('input', function (e) {
    var ce = e.target.closest('[contenteditable]');
    if (!ce) return;
    var blockEl = ce.closest('.block');
    if (!blockEl) return;
    var b = doc.blocks[findBlock(blockEl.dataset.id)];
    if (!b) return;
    if (ce.textContent === '' && ce.innerHTML !== '' && ce.innerHTML.toLowerCase() !== '<br>') {
      ce.innerHTML = '';
    }
    var field = ce.dataset.field;
    if (field === 'text') b.text = ce.textContent.replace(/ /g, ' ');
    else if (field === 'item') {
      var idx = parseInt(ce.dataset.index, 10);
      b.items[idx] = ce.textContent.replace(/ /g, ' ');
    }
    commitTyping();
    renderPreview();
    renderOutline();
    renderDiags();
    renderStats();
  });

  /* 粘贴一律转纯文本（非 plaintext-only 环境下兜底） */
  editorEl.addEventListener('paste', function (e) {
    if (CE_PLAIN) return;
    e.preventDefault();
    var txt = (e.clipboardData || window.clipboardData).getData('text/plain');
    document.execCommand('insertText', false, txt);
  });

  /* 键盘：Enter 建新块 / Tab 调层级 / 空块 Backspace 删除 */
  editorEl.addEventListener('keydown', function (e) {
    var ce = e.target.closest('[contenteditable]');
    var blockEl = e.target.closest('.block');
    if (!blockEl) return;
    var id = blockEl.dataset.id;
    var b = doc.blocks[findBlock(id)];
    if (!b) return;

    if (e.key === 'Enter' && !e.shiftKey) {
      if (ce && ce.dataset.field === 'item') {
        e.preventDefault();
        addItem(id, parseInt(ce.dataset.index, 10));
        return;
      }
      if (b.type !== 'code') {
        e.preventDefault();
        var nid = insertBlock('p', id);
        focusBlockContent(nid);
        return;
      }
    }
    if (e.key === 'Tab' && b.type in HEADING_LEVELS && ce) {
      e.preventDefault();
      changeLevel(id, e.shiftKey ? -1 : 1);
      return;
    }
    if (e.key === 'Backspace' && ce) {
      var atStart = (function () {
        var s = window.getSelection();
        if (!s || !s.isCollapsed) return false;
        if (s.anchorOffset !== 0) return false;
        return true;
      })();
      if (atStart && !ce.textContent) {
        e.preventDefault();
        if (ce.dataset.field === 'item' && b.items.length > 1) {
          var idx = parseInt(ce.dataset.index, 10);
          b.items.splice(idx, 1);
          afterModelChange();
          var prev = $('.block[data-id="' + id + '"] .item-line[data-index="' + (idx - 1) + '"] .content', editorEl);
          if (prev) placeCaretEnd(prev);
        } else if (doc.blocks.length > 1) {
          var i = findBlock(id);
          var next = doc.blocks[Math.min(i + 1, doc.blocks.length - 1)];
          doc.blocks.splice(i, 1);
          selectedId = next && next.id !== id ? next.id : null;
          afterModelChange();
          if (selectedId) focusBlockContent(selectedId);
        }
      }
    }
  });

  /* 全局键盘：撤销/重做、移动块、关闭菜单 */
  document.addEventListener('keydown', function (e) {
    var mod = e.ctrlKey || e.metaKey;
    var k = (e.key || '').toLowerCase();
    if (mod && k === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return; }
    if (mod && (k === 'y' || (k === 'z' && e.shiftKey))) { e.preventDefault(); redo(); return; }
    if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      var id = selectedId;
      if (!id) {
        var el = document.activeElement && document.activeElement.closest ? document.activeElement.closest('.block') : null;
        if (el) id = el.dataset.id;
      }
      if (id) { e.preventDefault(); moveBlock(id, e.key === 'ArrowUp' ? -1 : 1); }
      return;
    }
    if (e.key === 'Escape') { closeTypeMenu(); }
  });
  document.addEventListener('click', function (e) {
    if (!typeMenu.hidden && !typeMenu.contains(e.target) && e.target !== menuAnchor && !(menuAnchor && menuAnchor.contains(e.target))) {
      closeTypeMenu();
    }
  });

  /* 预览点击 → 回选编辑器（双向一致） */
  previewEl.addEventListener('click', function (e) {
    var pv = e.target.closest('[data-pv-id]');
    if (pv) selectBlock(pv.dataset.pvId, { scrollEditor: true });
  });

  /* 大纲点击 → 双视图跳转 */
  $('#outline').addEventListener('click', function (e) {
    var btn = e.target.closest('[data-goto]');
    if (btn) selectBlock(btn.dataset.goto, { scrollEditor: true, scrollPreview: true });
  });

  /* 诊断面板：定位 / 修复 */
  $('#diags').addEventListener('click', function (e) {
    var fix = e.target.closest('[data-fix]');
    if (fix) { applyFix(parseInt(fix.dataset.fix, 10)); return; }
    var row = e.target.closest('[data-diag]');
    if (row) {
      var d = diags[parseInt(row.dataset.diag, 10)];
      if (d && d.blockId) selectBlock(d.blockId, { scrollEditor: true, scrollPreview: true });
    }
  });

  /* 顶栏 */
  var titleEl = $('#docTitle');
  titleEl.addEventListener('input', function () {
    doc.title = titleEl.value;
    commitTyping();
    renderPreview();
    renderStats();
  });
  $('#undoBtn').addEventListener('click', undo);
  $('#redoBtn').addEventListener('click', redo);
  $('#resetBtn').addEventListener('click', function () {
    doc = clone(window.INITIAL_DOC);
    selectedId = null;
    commitNow();
    renderAll();
    titleEl.value = doc.title;
    showToast('已恢复内置示例文档（当前内容可通过撤销找回）', '撤销', undo);
  });
  $('#healthPill').addEventListener('click', function () {
    var sec = $('#diagSection');
    sec.classList.remove('flash');
    void sec.offsetWidth;
    sec.classList.add('flash');
    sec.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });
  $$('.seg button').forEach(function (btn) {
    btn.addEventListener('click', function () {
      $$('.seg button').forEach(function (x) { x.classList.remove('on'); });
      btn.classList.add('on');
      document.body.dataset.view = btn.dataset.v;
    });
  });
  $('#exportMd').addEventListener('click', function () {
    $('#exportMenu').removeAttribute('open');
    download(slugName() + '.md', 'text/markdown', toMarkdown());
    showToast('已导出 Markdown（与预览排版一致）');
  });
  $('#exportHtml').addEventListener('click', function () {
    $('#exportMenu').removeAttribute('open');
    download(slugName() + '.html', 'text/html', toExportHtml());
    showToast('已导出 HTML（与预览排版一致）');
  });
  window.addEventListener('beforeunload', function () { clearTimeout(saveTimer); saveNow(); });

  /* ---------------- 初始化：同步内联，无加载态 ---------------- */
  function init() {
    var saved = null;
    try { saved = localStorage.getItem(LS_KEY); } catch (e) { }
    if (saved) {
      try {
        var d = JSON.parse(saved);
        if (d && Array.isArray(d.blocks)) doc = d;
      } catch (e) { }
    }
    if (!doc) doc = clone(window.INITIAL_DOC);
    titleEl.value = doc.title || '';
    history = [clone(doc)];
    hPtr = 0;
    renderAll();
    updateHistoryUI();
    saveNow();
  }
  init();
})();
