/* app.js — 文枢 · 单文档结构化编辑器（DOM 层）
 *
 * 三栏单屏：大纲（结构派生）｜结构化块编辑器（结构操作）｜实时预览（同源渲染）。
 * 数据模型全部在 doc-model.js；本层只做渲染与事件绑定。
 * 编辑不破坏结构：文本只能在块内编辑；结构变更（移动/缩进/转换/插入/删除）走模型操作。
 */
(function () {
  'use strict';
  var M = window.DocModel;

  /* ---------- 状态 ---------- */
  var doc = M.sampleDoc();          // 当前文档（唯一事实来源）
  var hist = [];                    // 快照历史 {label,time,doc}
  var histIndex = -1;
  var issues = [];                  // 当前结构检查结果

  /* ---------- 基础工具 ---------- */
  function $(s) { return document.querySelector(s); }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function fmtTime(d) { return pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()); }

  var ICONS = {
    up: '<path d="M18 15l-6-6-6 6"/>',
    down: '<path d="M6 9l6 6 6-6"/>',
    left: '<path d="M15 6l-6 6 6 6"/>',
    right: '<path d="M9 6l6 6-6 6"/>',
    swap: '<path d="M7 8h10m0 0-3-3m3 3-3 3"/><path d="M17 16H7m0 0 3-3m-3 3 3 3"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    trash: '<path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13M10 11v6M14 11v6"/>',
    undo: '<path d="M4 9h10a5 5 0 0 1 0 10h-3"/><path d="M8 5 4 9l4 4"/>',
    redo: '<path d="M20 9H10a5 5 0 0 0 0 10h3"/><path d="M16 5l4 4-4 4"/>',
    clock: '<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/>',
    download: '<path d="M12 4v11m-5-4 5 5 5-5M5 20h14"/>',
    upload: '<path d="M12 20V9m-5 4 5-5 5 5M5 4h14"/>',
    reset: '<path d="M20 12a8 8 0 1 1-2.34-5.66"/><path d="M20 4v5h-5"/>',
    check: '<path d="M5 13l4 4L19 7"/>',
    warn: '<path d="M12 4 2.5 20h19L12 4z"/><path d="M12 10.5v4"/><path d="M12 17.6v.2"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M13 7l4 4"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>'
  };
  function icon(name, size) {
    size = size || 14;
    return '<svg viewBox="0 0 24 24" width="' + size + '" height="' + size + '" fill="none" stroke="currentColor" ' +
      'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICONS[name] + '</svg>';
  }
  function btn(opts) {
    var b = el('button', 'btn' + (opts.cls ? ' ' + opts.cls : '') + (opts.icon && !opts.label ? ' btn-icon' : ''));
    b.type = 'button';
    b.title = opts.title || opts.label || '';
    b.setAttribute('aria-label', b.title);
    if (opts.icon) b.innerHTML = icon(opts.icon);
    if (opts.label) b.appendChild(el('span', null, opts.label));
    b.disabled = !!opts.disabled;
    if (opts.onclick) b.addEventListener('click', opts.onclick);
    return b;
  }

  /* ---------- 历史（时间性：快照 + 回溯） ---------- */
  function pushHistory(label) {
    hist = hist.slice(0, histIndex + 1);
    hist.push({ label: label, time: new Date(), doc: M.clone(doc) });
    if (hist.length > 120) hist.shift();
    histIndex = hist.length - 1;
  }
  var histTimer = null, pendingLabel = null;
  function flushHistory() {
    if (histTimer) { clearTimeout(histTimer); histTimer = null; }
    if (pendingLabel) { pushHistory(pendingLabel); pendingLabel = null; }
  }
  // 结构操作：立即入史并整屏刷新
  function touch(label) { flushHistory(); pushHistory(label); refreshAll(); }
  // 连续文本编辑：合并为一条历史（停顿 900ms 落账）
  function editTouch(label) {
    if (pendingLabel && pendingLabel !== label) flushHistory();
    pendingLabel = label;
    clearTimeout(histTimer);
    histTimer = setTimeout(flushHistory, 900);
    updateHistUI();
  }
  function undo() { flushHistory(); if (histIndex > 0) { histIndex--; doc = M.clone(hist[histIndex].doc); refreshAll(); } }
  function redo() { flushHistory(); if (histIndex < hist.length - 1) { histIndex++; doc = M.clone(hist[histIndex].doc); refreshAll(); } }
  function jumpTo(k) { flushHistory(); if (k === histIndex) return; histIndex = k; doc = M.clone(hist[k].doc); refreshAll(); }

  /* ---------- 渲染调度 ----------
   * 文本编辑只重渲染派生视图（预览/大纲/检查/统计），不重建编辑器 —— 不打断输入；
   * 结构操作（touch）走 refreshAll 重建编辑器并恢复焦点。 */
  var pvTimer = null;
  function schedulePreview() {
    clearTimeout(pvTimer);
    pvTimer = setTimeout(function () {
      issues = M.lint(doc);
      renderPreview(); renderOutline(); renderIssues(); updateStats(); markSynced();
    }, 120);
  }
  function refreshAll() {
    issues = M.lint(doc);
    var ti = $('#docTitle');
    if (ti.value !== doc.title) ti.value = doc.title;
    buildEditor(); renderPreview(); renderOutline(); renderIssues(); updateStats(); updateHistUI(); markSynced();
  }

  /* ---------- 同步徽标 ---------- */
  function markEditing() {
    var b = $('#syncBadge');
    b.className = 'sync editing';
    b.innerHTML = icon('edit') + '<span>编辑中…</span>';
  }
  function markSynced() {
    var b = $('#syncBadge');
    b.className = 'sync ok';
    b.innerHTML = icon('check') + '<span>已同步 · ' + fmtTime(new Date()) + '</span>';
  }

  /* ---------- 编辑器（结构化块） ---------- */
  function chipText(b) { return M.chipText(b); }
  function canShallow(b) { return b.t === 'li' ? (b.indent || 0) > 0 : b.t === 'h' ? b.level > 1 : false; }
  function canDeepen(b) { return b.t === 'li' ? (b.indent || 0) < M.INDENT_MAX : b.t === 'h' ? b.level < M.HEADING_MAX : false; }
  function placeholderFor(b) {
    switch (b.t) {
      case 'h': return '输入标题…';
      case 'li': return '输入列表项…';
      case 'quote': return '输入引用内容…';
      case 'code': return '// 输入代码…';
      default: return '输入正文，Enter 换行…';
    }
  }
  function inputClass(b) {
    switch (b.t) {
      case 'h': return 'input-h' + b.level;
      case 'li': return 'input-li';
      case 'quote': return 'input-quote';
      case 'code': return 'input-code';
      default: return 'input-p';
    }
  }
  function autoGrow(ta) { ta.style.height = 'auto'; ta.style.height = (ta.scrollHeight + 2) + 'px'; }

  function liMarkerText(b, prev, olN) {
    if (b.marker === 'ul') { for (var k in olN) delete olN[k]; return '•'; }
    if (!prev || prev.t !== 'li' || prev.marker !== 'ol') { for (var k2 in olN) delete olN[k2]; }
    olN[b.indent || 0] = (olN[b.indent || 0] || 0) + 1;
    for (var k3 in olN) { if (+k3 > (b.indent || 0)) delete olN[k3]; }
    return olN[b.indent || 0] + '.';
  }

  function buildEditor() {
    var list = $('#editorList');
    list.textContent = '';
    if (!doc.blocks.length) {
      var empty = el('div', 'empty-state');
      empty.appendChild(el('p', null, '空文档。'));
      empty.appendChild(btn({ icon: 'plus', label: '插入第一个块', title: '插入第一个块', onclick: function (e) { openInsertMenu(e.currentTarget, -1); } }));
      list.appendChild(empty);
      return;
    }
    var prev = null, olN = {};
    doc.blocks.forEach(function (b, i) {
      var row = el('div', 'block b-' + b.t);
      row.dataset.i = i;

      var rail = el('div', 'rail');
      rail.appendChild(el('span', 'chip chip-' + b.t, chipText(b)));
      rail.appendChild(btn({
        icon: 'up', title: '上移', disabled: i === 0,
        onclick: function () { if (M.moveBlock(doc.blocks, i, -1)) { touch('上移「' + chipText(b) + '」块'); focusBlock(i - 1); } }
      }));
      rail.appendChild(btn({
        icon: 'down', title: '下移', disabled: i === doc.blocks.length - 1,
        onclick: function () { if (M.moveBlock(doc.blocks, i, 1)) { touch('下移「' + chipText(b) + '」块'); focusBlock(i + 1); } }
      }));
      if (b.t === 'h' || b.t === 'li') {
        rail.appendChild(btn({
          icon: 'left', title: b.t === 'h' ? '标题升一级' : '减少缩进', disabled: !canShallow(b),
          onclick: function () { if (M.indentBlock(doc.blocks, i, -1)) { touch('调整层级'); focusBlock(i); } }
        }));
        rail.appendChild(btn({
          icon: 'right', title: b.t === 'h' ? '标题降一级' : '增加缩进', disabled: !canDeepen(b),
          onclick: function () { if (M.indentBlock(doc.blocks, i, 1)) { touch('调整层级'); focusBlock(i); } }
        }));
      }
      var convBtn = btn({ icon: 'swap', title: '转换块类型', onclick: function () { openConvertMenu(convBtn, i); } });
      rail.appendChild(convBtn);
      var insBtn = btn({ icon: 'plus', title: '在下方插入块', onclick: function () { openInsertMenu(insBtn, i); } });
      rail.appendChild(insBtn);
      rail.appendChild(btn({
        icon: 'trash', title: '删除块', cls: 'danger',
        onclick: function () { M.deleteBlock(doc.blocks, i); touch('删除「' + chipText(b) + '」块'); }
      }));
      row.appendChild(rail);

      if (b.t === 'hr') {
        row.appendChild(el('div', 'hr-line'));
      } else {
        var wrap = el('div', 'text-wrap' + (b.t === 'li' ? ' indent-' + (b.indent || 0) : ''));
        if (b.t === 'li') wrap.appendChild(el('span', 'li-marker', liMarkerText(b, prev, olN)));
        var ta = document.createElement('textarea');
        ta.className = 'block-input ' + inputClass(b);
        ta.rows = 1;
        ta.spellcheck = false;
        ta.placeholder = placeholderFor(b);
        ta.value = b.text;
        ta.setAttribute('aria-label', M.blockLabel(b));
        ta.addEventListener('input', function () { onTextInput(i, ta, b); });
        ta.addEventListener('keydown', function (e) { onTextKey(e, i, ta, b); });
        wrap.appendChild(ta);
        row.appendChild(wrap);
      }
      list.appendChild(row);
      prev = b;
    });
    list.querySelectorAll('textarea').forEach(autoGrow);
  }

  function onTextInput(i, ta, b) {
    var v = ta.value;
    if (b.t === 'h' || b.t === 'li') {           // 标题/列表保持单行，防止结构符进入块
      var sv = v.replace(/[\r\n]+/g, ' ');
      if (sv !== v) { v = sv; ta.value = v; }
    }
    doc.blocks[i].text = v;
    autoGrow(ta);
    markEditing();
    schedulePreview();
    editTouch('编辑「' + chipText(b) + '」内容');
  }

  function onTextKey(e, i, ta, b) {
    if (e.key === 'Enter' && !e.shiftKey) {
      if (b.t === 'h') {
        e.preventDefault();
        M.insertAfter(doc.blocks, i, M.newBlock('p', { text: '' }));
        touch('标题后新建正文');
        focusBlock(i + 1);
      } else if (b.t === 'li') {
        e.preventDefault();
        M.insertAfter(doc.blocks, i, M.newBlock('li', { marker: b.marker, indent: b.indent || 0, text: '' }));
        touch('新建列表项');
        focusBlock(i + 1);
      }
      // p / quote / code：默认换行留在块内
    } else if (e.key === 'Backspace' && ta.value === '') {
      e.preventDefault();
      if (doc.blocks.length === 1) { doc.blocks = []; touch('删除块'); return; }
      var ni = i > 0 ? i - 1 : i;
      M.deleteBlock(doc.blocks, i);
      touch('删除空块');
      focusBlock(ni);
    }
  }

  function focusBlock(i) {
    var row = $('.block[data-i="' + i + '"]');
    if (!row) return;
    row.scrollIntoView({ block: 'center', behavior: 'smooth' });
    row.classList.add('flash');
    setTimeout(function () { row.classList.remove('flash'); }, 1100);
    var ta = row.querySelector('textarea');
    if (ta) {
      ta.focus({ preventScroll: true });
      var n = ta.value.length;
      try { ta.setSelectionRange(n, n); } catch (e) { }
    }
  }

  /* ---------- 大纲（层级性：由标题块派生） ---------- */
  function renderOutline() {
    var box = $('#outlineList');
    box.textContent = '';
    var warnIdx = {};
    issues.forEach(function (x) { warnIdx[x.i] = true; });
    var count = 0;
    doc.blocks.forEach(function (b, i) {
      if (b.t !== 'h') return;
      count++;
      var item = el('button', 'outline-item lv' + b.level);
      item.type = 'button';
      item.title = '定位到该块';
      item.appendChild(el('span', 'outline-text', b.text || '（空标题）'));
      if (warnIdx[i]) { item.appendChild(el('span', 'o-warn', '!')); item.title = '该标题存在结构提示'; }
      item.addEventListener('click', function () { focusBlock(i); });
      box.appendChild(item);
    });
    if (!count) box.appendChild(el('div', 'outline-empty', '尚无标题块。插入「标题」即可生成大纲。'));
    $('#outlineMeta').textContent = count ? ('标题块 ' + count + ' ／ 总块数 ' + doc.blocks.length) : '共 ' + doc.blocks.length + ' 个块';
  }

  /* ---------- 结构检查条 ---------- */
  function renderIssues() {
    var strip = $('#issueStrip');
    strip.textContent = '';
    if (!issues.length) {
      strip.className = 'issue-strip ok';
      strip.innerHTML = icon('check');
      strip.appendChild(el('span', null, '结构检查通过：标题层级连续，一级标题唯一，无空标题。'));
      return;
    }
    strip.className = 'issue-strip warn';
    strip.appendChild(el('span', 'issue-title', '结构检查：' + issues.length + ' 个提示'));
    issues.forEach(function (iss) {
      var chip = el('span', 'issue-chip');
      chip.title = '点击定位到该块';
      chip.appendChild(el('span', null, iss.msg));
      chip.appendChild(btn({
        label: '修复', title: '应用结构化修复', cls: 'mini',
        onclick: function () { M.applyFix(doc, iss); touch('修复：' + iss.msg); }
      }));
      chip.addEventListener('click', function (e) {
        if (e.target.tagName !== 'BUTTON') focusBlock(iss.i);
      });
      strip.appendChild(chip);
    });
    strip.appendChild(btn({
      label: '全部修复', title: '修复全部结构提示', cls: 'mini',
      onclick: function () { issues.forEach(function (x) { M.applyFix(doc, x); }); touch('修复全部结构提示'); }
    }));
  }

  /* ---------- 预览（与编辑器同源渲染） ---------- */
  function renderPreview() {
    var body = $('#previewBody');
    body.textContent = '';
    body.appendChild(el('div', 'pv-title', doc.title || '未命名文档'));
    body.appendChild(el('hr', 'pv-rule'));
    var stack = [];
    doc.blocks.forEach(function (b) {
      if (b.t !== 'li') stack = [];
      switch (b.t) {
        case 'h':
          body.appendChild(el('h' + b.level, null, b.text || '（空标题）'));
          break;
        case 'p': {
          var p = el('p'); p.textContent = b.text; body.appendChild(p);
          break;
        }
        case 'quote': {
          var q = el('blockquote'); q.textContent = b.text; body.appendChild(q);
          break;
        }
        case 'code': {
          var pre = el('pre'); pre.appendChild(el('code', null, b.text)); body.appendChild(pre);
          break;
        }
        case 'hr':
          body.appendChild(el('hr'));
          break;
        case 'li': {
          var ind = b.indent || 0;
          while (stack.length && (stack[stack.length - 1].indent > ind ||
            (stack[stack.length - 1].indent === ind && stack[stack.length - 1].marker !== b.marker))) stack.pop();
          var top = stack[stack.length - 1];
          if (!top || top.indent < ind) {
            var list = el(b.marker === 'ol' ? 'ol' : 'ul');
            (top && top.lastLi ? top.lastLi : body).appendChild(list);
            stack.push({ indent: ind, marker: b.marker, list: list, lastLi: null });
          }
          var t = stack[stack.length - 1];
          var li = el('li', null, b.text || '');
          t.list.appendChild(li);
          t.lastLi = li;
          break;
        }
      }
    });
  }

  /* ---------- 统计 ---------- */
  function updateStats() {
    var s = M.stats(doc);
    $('#statLine').textContent = s.blocks + ' 块 · ' + s.words + ' 字 · 约 ' + s.minutes + ' 分钟';
    $('#pvWords').textContent = '与编辑器实时同步 · ' + s.words + ' 字';
  }

  /* ---------- 历史面板 ---------- */
  function updateHistUI() {
    $('#btnUndo').disabled = histIndex <= 0;
    $('#btnRedo').disabled = histIndex >= hist.length - 1;
    $('#histCount').textContent = hist.length ? ('(' + (histIndex + 1) + '/' + hist.length + ')') : '';
  }
  function openHistoryMenu(anchor) {
    var items = hist.map(function (h, k) {
      return {
        label: fmtTime(h.time) + ' · ' + h.label + (k === histIndex ? ' · 当前' : ''),
        current: k === histIndex,
        onclick: function () { jumpTo(k); }
      };
    }).reverse();
    openMenu(anchor, items);
  }

  /* ---------- 浮层菜单 ---------- */
  var menuEl;
  function onDocDown(e) { if (menuEl && !menuEl.contains(e.target)) closeMenu(); }
  function openMenu(anchor, items) {
    menuEl = menuEl || $('#menu');
    menuEl.textContent = '';
    items.forEach(function (it) {
      var b = el('button', 'menu-item' + (it.current ? ' current' : ''));
      b.type = 'button';
      if (it.icon) b.innerHTML = icon(it.icon);
      b.appendChild(el('span', null, it.label));
      b.disabled = !!it.disabled;
      b.addEventListener('click', function () { closeMenu(); if (it.onclick) it.onclick(); });
      menuEl.appendChild(b);
    });
    menuEl.classList.remove('hidden');
    menuEl.style.visibility = 'hidden';
    menuEl.style.left = '0px'; menuEl.style.top = '0px';
    var r = anchor.getBoundingClientRect();
    requestAnimationFrame(function () {
      var mw = menuEl.offsetWidth, mh = menuEl.offsetHeight;
      var x = Math.max(8, Math.min(r.left, window.innerWidth - mw - 8));
      var y = r.bottom + 6;
      if (y + mh > window.innerHeight - 8) y = Math.max(8, r.top - mh - 6);
      menuEl.style.left = x + 'px';
      menuEl.style.top = y + 'px';
      menuEl.style.visibility = '';
    });
    setTimeout(function () { document.addEventListener('pointerdown', onDocDown); }, 0);
  }
  function closeMenu() {
    if (menuEl) menuEl.classList.add('hidden');
    document.removeEventListener('pointerdown', onDocDown);
  }

  /* ---------- 块类型菜单（转换 / 插入） ---------- */
  var TYPES = [
    { to: 'h', level: 1, label: '一级标题' },
    { to: 'h', level: 2, label: '二级标题' },
    { to: 'h', level: 3, label: '三级标题' },
    { to: 'p', label: '正文' },
    { to: 'ul', label: '无序列表' },
    { to: 'ol', label: '有序列表' },
    { to: 'quote', label: '引用' },
    { to: 'code', label: '代码块' },
    { to: 'hr', label: '分割线' }
  ];
  function isCurrent(b, it) {
    if (it.to === 'h') return b.t === 'h' && b.level === it.level;
    if (it.to === 'ul') return b.t === 'li' && b.marker === 'ul';
    if (it.to === 'ol') return b.t === 'li' && b.marker === 'ol';
    return b.t === it.to;
  }
  function makeBlock(it) {
    if (it.to === 'h') return M.newBlock('h', { level: it.level });
    if (it.to === 'ul') return M.newBlock('li', { marker: 'ul', indent: 0 });
    if (it.to === 'ol') return M.newBlock('li', { marker: 'ol', indent: 0 });
    return M.newBlock(it.to);
  }
  function openConvertMenu(anchor, i) {
    var b = doc.blocks[i];
    openMenu(anchor, TYPES.map(function (it) {
      var cur = isCurrent(b, it);
      return {
        label: it.label + (cur ? '（当前）' : ''),
        disabled: cur,
        onclick: function () { M.convertBlock(doc.blocks, i, it.to, it.level); touch('转换为' + it.label); focusBlock(i); }
      };
    }));
  }
  function openInsertMenu(anchor, i) {
    openMenu(anchor, TYPES.map(function (it) {
      return {
        label: it.label,
        onclick: function () {
          M.insertAfter(doc.blocks, i, makeBlock(it));
          touch('插入' + it.label);
          focusBlock(i + 1);
        }
      };
    }));
  }

  /* ---------- 导入 / 导出 / 重置 ---------- */
  function copyText(md, done) {
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = md;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); done(true); } catch (e) { done(false); }
      ta.remove();
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(md).then(function () { done(true); }, fallback);
    } else fallback();
  }
  function downloadMd() {
    var md = M.serializeMarkdown(doc);
    var name = (doc.title || 'document').replace(/[\\/:*?"<>|]+/g, '_').slice(0, 60) || 'document';
    var blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name + '.md';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 500);
  }
  function openExport() {
    var md = M.serializeMarkdown(doc);
    openModal({
      title: '导出 Markdown',
      hint: '以下为当前文档的 Markdown 源文 —— 与编辑器、预览派生自同一份结构模型。',
      value: md, readOnly: true,
      buttons: [
        { label: '复制到剪贴板', icon: 'copy', close: false, onclick: function () { copyText(md, function (ok) { toast(ok ? '已复制 Markdown' : '复制失败，请手动复制'); }); } },
        { label: '下载 .md', icon: 'download', close: false, onclick: function () { downloadMd(); toast('已开始下载 .md'); } },
        { label: '关闭' }
      ]
    });
  }
  function openImport() {
    openModal({
      title: '导入 Markdown',
      hint: '粘贴 Markdown 源文，解析后将替换当前文档（首个一级标题作为文档标题）。可先在「导出」中备份。',
      value: '', readOnly: false, placeholder: '# 文档标题\n\n正文…',
      buttons: [
        {
          label: '解析并导入', icon: 'upload', close: false,
          onclick: function () {
            var md = $('#modalText').value;
            if (!md.trim()) { toast('内容为空'); return; }
            doc = M.parseMarkdown(md, doc.title || '导入的文档');
            closeModal();
            touch('导入 Markdown');
            toast('已导入 ' + doc.blocks.length + ' 个块');
          }
        },
        { label: '取消' }
      ]
    });
  }
  function resetDoc() {
    if (confirm('确定重置为示例文档？当前内容将被清除。')) {
      doc = M.sampleDoc();
      touch('重置为示例文档');
      toast('已重置为示例文档');
    }
  }

  /* ---------- 弹窗 / 提示 ---------- */
  function openModal(o) {
    $('#modalTitle').textContent = o.title;
    $('#modalHint').textContent = o.hint || '';
    var ta = $('#modalText');
    ta.value = o.value || '';
    ta.readOnly = !!o.readOnly;
    ta.placeholder = o.placeholder || '';
    var foot = $('#modalFoot');
    foot.textContent = '';
    (o.buttons || [{ label: '关闭' }]).forEach(function (b) {
      foot.appendChild(btn({
        label: b.label, icon: b.icon, cls: b.primary ? 'primary' : '',
        onclick: function () {
          if (b.onclick) b.onclick();
          if (b.close !== false) closeModal();
        }
      }));
    });
    $('#modal').classList.remove('hidden');
  }
  function closeModal() { $('#modal').classList.add('hidden'); }
  var toastTimer = null;
  function toast(msg) {
    var t = $('#toast');
    t.textContent = msg;
    t.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.add('hidden'); }, 1800);
  }

  /* ---------- 快捷键 ---------- */
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { closeMenu(); closeModal(); return; }
    var mod = e.ctrlKey || e.metaKey;
    if (!mod) return;
    var k = e.key.toLowerCase();
    if (k === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
    else if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); redo(); }
    else if (k === 's') { e.preventDefault(); openExport(); }
  });

  /* ---------- 自动化取证入口（#demo=…，正常使用不触发） ----------
   * 仅通过真实 UI 路径（元素 click / input 事件）驱动，供无头浏览器截图验证：
   *   #demo=edit   在「主要新功能」标题块模拟一次真实输入（验证编辑 → 预览同步）
   *   #demo=lint   通过「转换块类型」菜单把「问题修复」「已知问题」先后转为 H1，
   *                第二个 H1 触发结构检查告警「一级标题不止一个」
   *   #demo=fix    lint 场景之后点击「全部修复」（验证结构化修复恢复一致）
   *   #demo=export 点击「导出」打开 Markdown 弹窗                                    */
  function runDemoIfAny() {
    var m = location.hash.match(/demo=(edit|lint|fix|export)/);
    if (!m) return;
    var kind = m[1];
    function findH2(text) {
      return doc.blocks.findIndex(function (b) { return b.t === 'h' && b.level === 2 && b.text === text; });
    }
    if (kind === 'edit') {
      setTimeout(function () {
        var i = findH2('主要新功能');
        if (i < 0) return;
        var ta = document.querySelector('.block[data-i="' + i + '"] textarea');
        if (!ta) return;
        ta.focus();
        ta.value = '主要新功能（已编辑 · 与预览实时同步）';
        ta.dispatchEvent(new Event('input', { bubbles: true }));
      }, 150);
    } else if (kind === 'lint' || kind === 'fix') {
      // 真实 UI 路径：点块上「转换块类型」按钮 → 菜单点「一级标题」，连做两块
      function convertToH1(text, then) {
        var i = findH2(text);
        if (i < 0) return;
        var conv = document.querySelector('.block[data-i="' + i + '"] .rail [title="转换块类型"]');
        if (!conv) return;
        conv.click();
        var target = [].slice.call(document.querySelectorAll('#menu .menu-item'))
          .find(function (b) { return b.textContent.trim() === '一级标题'; });
        if (!target) return;
        target.click();
        if (then) setTimeout(then, 250);
      }
      setTimeout(function () {
        convertToH1('问题修复', function () {
          convertToH1('已知问题', function () {
            if (kind !== 'fix') return;
            var fixBtn = [].slice.call(document.querySelectorAll('#issueStrip button'))
              .find(function (b) { return b.textContent.trim() === '全部修复'; });
            if (fixBtn) fixBtn.click();
          });
        });
      }, 150);
    } else if (kind === 'export') {
      setTimeout(function () { $('#btnExport').click(); }, 150);
    }
  }

  /* ---------- 顶栏图标 ---------- */
  function dressTopbar() {
    $('#btnUndo').innerHTML = icon('undo', 15);
    $('#btnRedo').innerHTML = icon('redo', 15);
    $('#btnReset').innerHTML = icon('reset', 15);
    $('#btnImport').innerHTML = icon('upload') + '<span>导入</span>';
    $('#btnExport').innerHTML = icon('download') + '<span>导出</span>';
    $('#btnHistory').insertAdjacentHTML('afterbegin', icon('clock', 13));
    $('#modalClose').innerHTML = icon('x', 15);
  }

  /* ---------- 启动（同步完成，首屏即可用，无加载态） ---------- */
  function init() {
    dressTopbar();
    $('#docTitle').value = doc.title;
    $('#docTitle').addEventListener('input', function (e) {
      doc.title = e.target.value;
      markEditing();
      schedulePreview();
      editTouch('修改文档标题');
    });
    $('#btnUndo').addEventListener('click', undo);
    $('#btnRedo').addEventListener('click', redo);
    $('#btnHistory').addEventListener('click', function (e) { openHistoryMenu(e.currentTarget); });
    $('#btnImport').addEventListener('click', openImport);
    $('#btnExport').addEventListener('click', openExport);
    $('#btnReset').addEventListener('click', resetDoc);
    $('#modalClose').addEventListener('click', closeModal);
    $('#modal').addEventListener('click', function (e) { if (e.target.id === 'modal') closeModal(); });
    pushHistory('打开示例文档');
    refreshAll();
    runDemoIfAny();
  }
  init();
})();
