/* doc-model.js — 文枢 · 单文档结构化编辑器（纯数据模型层）
 *
 * 文档 = { title, blocks[] }；块（block）是结构的最小单元：
 *   { t:'h',    level:1..3, text }   标题
 *   { t:'p',    text }               正文
 *   { t:'li',   marker:'ul'|'ol', indent:0..3, text }  列表项
 *   { t:'quote',text }               引用
 *   { t:'code', text }               代码块（text 可含换行）
 *   { t:'hr' }                       分割线
 *
 * 所有结构变更都通过本层的操作函数完成（移动 / 缩进 / 转换 / 插入 / 删除），
 * 序列化、预览、结构检查（lint）全部派生自同一份块模型 —— 保证「编辑不破坏结构，
 * 结构化编辑与预览一致」。浏览器挂 window.DocModel；Node 测试走 module.exports。
 */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.DocModel = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var HEADING_MAX = 3;   // 标题最深 H3
  var INDENT_MAX = 3;    // 列表最深缩进

  function newBlock(t, extra) {
    return Object.assign({ t: t, text: '' }, extra || {});
  }

  function clone(v) { return JSON.parse(JSON.stringify(v)); }

  function emptyDoc() { return { title: '未命名文档', blocks: [] }; }

  function sampleDoc() {
    return {
      title: '领航 App 3.2 版本发布说明（草案）',
      blocks: [
        newBlock('p', { text: '本文是 3.2 版本发布说明的评审稿。请在对应章节内补充内容；调整章节时请使用块操作，避免破坏标题层级。' }),
        newBlock('h', { level: 2, text: '主要新功能' }),
        newBlock('li', { marker: 'ul', indent: 0, text: '全新首页卡片流：支持按使用场景自动排序，常用卡片可一键置顶。' }),
        newBlock('li', { marker: 'ul', indent: 0, text: '离线地图包体积缩小 38%，弱网与地铁场景加载更快。' }),
        newBlock('li', { marker: 'ul', indent: 0, text: '长按多选日程，支持批量移动、合并与提醒重设。' }),
        newBlock('h', { level: 2, text: '问题修复' }),
        newBlock('li', { marker: 'ol', indent: 0, text: '修复语音助手在蓝牙通话中偶发误唤醒的问题。' }),
        newBlock('li', { marker: 'ol', indent: 0, text: '修复深色模式下部分页面文字对比度不足。' }),
        newBlock('li', { marker: 'ol', indent: 0, text: '修复跨时区日程显示偏移一天的错误。' }),
        newBlock('h', { level: 2, text: '已知问题' }),
        newBlock('quote', { text: '部分安卓 8 机型桌面小部件偶发不刷新，重启启动器可临时恢复，预计 3.2.1 修复。' }),
        newBlock('h', { level: 2, text: '升级方式' }),
        newBlock('p', { text: '正式发布后，用户可在「设置 → 关于 → 检查更新」中升级；企业渠道请使用以下命令：' }),
        newBlock('code', { text: 'adb install -r navigator-3.2.0-release.apk\n# 企业渠道静默安装（PowerShell）\n./gradlew publishRelease -Pchannel=enterprise' }),
        newBlock('hr'),
        newBlock('h', { level: 3, text: '反馈渠道' }),
        newBlock('p', { text: '体验问题请提交内网「质量平台 · 领航」项目，或在工作群联系发布负责人。定稿前请勿外传本文档。' })
      ]
    };
  }

  /* ---------- 展示辅助 ---------- */

  function chipText(b) {
    switch (b.t) {
      case 'h': return 'H' + b.level;
      case 'p': return '正文';
      case 'li': return b.marker === 'ol' ? '有序' : '列表';
      case 'quote': return '引用';
      case 'code': return '代码';
      case 'hr': return '分割线';
    }
    return '块';
  }

  function blockLabel(b) {
    switch (b.t) {
      case 'h': return '标题 H' + b.level;
      case 'p': return '正文段落';
      case 'li': return b.marker === 'ol' ? '有序列表项' : '无序列表项';
      case 'quote': return '引用';
      case 'code': return '代码块';
      case 'hr': return '分割线';
    }
    return '块';
  }

  /* ---------- Markdown 序列化（导出与预览同源） ---------- */

  function serializeMarkdown(doc) {
    var lines = [];
    if (doc.title) lines.push('# ' + doc.title, '');
    var prev = null;
    doc.blocks.forEach(function (b) {
      // 相邻列表项之间不空行；其余块之间空一行
      if (lines.length && !(prev && prev.t === 'li' && b.t === 'li')) lines.push('');
      switch (b.t) {
        case 'h':
          lines.push('#'.repeat(Math.min(HEADING_MAX, b.level)) + ' ' + b.text);
          break;
        case 'p':
          (b.text || '').split('\n').forEach(function (l) { lines.push(l); });
          break;
        case 'li':
          lines.push('  '.repeat(b.indent || 0) + (b.marker === 'ol' ? '1. ' : '- ') + b.text);
          break;
        case 'quote':
          (b.text || '').split('\n').forEach(function (l) { lines.push('> ' + l); });
          break;
        case 'code':
          lines.push('```');
          (b.text || '').split('\n').forEach(function (l) { lines.push(l); });
          lines.push('```');
          break;
        case 'hr':
          lines.push('---');
          break;
      }
      prev = b;
    });
    return lines.join('\n');
  }

  /* ---------- Markdown 解析（导入） ---------- */

  function parseMarkdown(md, fallbackTitle) {
    var lines = String(md || '').replace(/\r\n?/g, '\n').split('\n');
    var blocks = [];
    var para = [];
    var code = null; // null=不在代码围栏内；[]=围栏内缓冲

    function flushPara() {
      if (para.length) { blocks.push(newBlock('p', { text: para.join('\n') })); para = []; }
    }

    lines.forEach(function (raw) {
      var line = raw.replace(/\s+$/, '');
      if (code !== null) {
        if (/^```/.test(line)) { blocks.push(newBlock('code', { text: code.join('\n') })); code = null; }
        else code.push(raw);
        return;
      }
      if (/^```/.test(line)) { flushPara(); code = []; return; }
      if (!line.trim()) { flushPara(); return; }
      var m;
      if ((m = line.match(/^(#{1,6})\s+(.*)$/))) {
        flushPara();
        blocks.push(newBlock('h', { level: Math.min(HEADING_MAX, m[1].length), text: m[2].trim() }));
        return;
      }
      if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) { flushPara(); blocks.push(newBlock('hr')); return; }
      if ((m = line.match(/^>\s?(.*)$/))) {
        flushPara();
        var last = blocks[blocks.length - 1];
        if (last && last.t === 'quote') last.text += (last.text ? '\n' : '') + m[1];
        else blocks.push(newBlock('quote', { text: m[1] }));
        return;
      }
      if ((m = line.match(/^(\s*)([-*+]|\d+[.)])\s+(.*)$/))) {
        flushPara();
        var indent = Math.min(INDENT_MAX, Math.floor(m[1].replace(/\t/g, '  ').length / 2));
        blocks.push(newBlock('li', { marker: /\d/.test(m[2]) ? 'ol' : 'ul', indent: indent, text: m[3] }));
        return;
      }
      para.push(line);
    });
    if (code !== null && code.length) blocks.push(newBlock('code', { text: code.join('\n') }));
    flushPara();

    var doc = emptyDoc();
    if (blocks.length && blocks[0].t === 'h' && blocks[0].level === 1) {
      doc.title = blocks[0].text;
      blocks.shift();
    } else {
      doc.title = fallbackTitle || '导入的文档';
    }
    doc.blocks = blocks;
    return doc;
  }

  /* ---------- 统计 ---------- */

  function countWords(s) {
    if (!s) return 0;
    var cjk = (s.match(/[\u3400-\u9fff\uf900-\ufaff]/g) || []).length;
    var rest = s.replace(/[\u3400-\u9fff\uf900-\ufaff]/g, ' ');
    var latin = rest.split(/[\s`~!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?—…·]+/).filter(Boolean).length;
    return cjk + latin;
  }

  function stats(doc) {
    var words = 0, chars = 0;
    function walk(t) { chars += t.length; words += countWords(t); }
    walk(doc.title || '');
    doc.blocks.forEach(function (b) { if (b.t !== 'hr') walk(b.text || ''); });
    return { blocks: doc.blocks.length, words: words, chars: chars, minutes: Math.max(1, Math.round(words / 400)) };
  }

  /* ---------- 结构检查（lint）与修复 ----------
   * 规则：① 一级标题块至多一个；② 标题层级不得跳级；③ 不允许空标题。
   * 修复都是「结构化操作」（改层级 / 转类型），不产生新文本。 */

  function lint(doc) {
    var issues = [];
    var prevH = null, h1seen = false;
    doc.blocks.forEach(function (b, i) {
      if (b.t !== 'h') return;
      if (!String(b.text).trim()) {
        issues.push({ i: i, kind: 'empty-h', msg: '存在空标题', fix: { op: 'convert', to: 'p' } });
      } else if (b.level === 1) {
        if (h1seen) issues.push({ i: i, kind: 'multi-h1', msg: '一级标题不止一个', fix: { op: 'level', level: 2 } });
        h1seen = true;
      } else if (prevH && b.level > prevH.level + 1) {
        issues.push({ i: i, kind: 'jump', msg: '标题跳级 H' + prevH.level + ' → H' + b.level, fix: { op: 'level', level: prevH.level + 1 } });
      }
      prevH = b;
    });
    return issues;
  }

  function applyFix(doc, issue) {
    var b = doc.blocks[issue.i];
    if (!b) return false;
    if (issue.fix.op === 'level') b.level = issue.fix.level;
    else if (issue.fix.op === 'convert') { b.t = issue.fix.to; delete b.level; delete b.marker; delete b.indent; }
    return true;
  }

  /* ---------- 结构操作（调用方负责先克隆 / 记录历史） ---------- */

  function moveBlock(blocks, i, dir) {
    var j = i + dir;
    if (j < 0 || j >= blocks.length) return false;
    var b = blocks.splice(i, 1)[0];
    blocks.splice(j, 0, b);
    return true;
  }

  function indentBlock(blocks, i, delta) {
    var b = blocks[i];
    if (!b) return false;
    if (b.t === 'li') {
      var v = Math.max(0, Math.min(INDENT_MAX, (b.indent || 0) + delta));
      if (v === (b.indent || 0)) return false;
      b.indent = v; return true;
    }
    if (b.t === 'h') {
      var lv = Math.max(1, Math.min(HEADING_MAX, b.level + (delta > 0 ? 1 : -1)));
      if (lv === b.level) return false;
      b.level = lv; return true;
    }
    return false;
  }

  function convertBlock(blocks, i, to, level) {
    var b = blocks[i];
    if (!b) return false;
    var text = b.text || '';
    var nb;
    switch (to) {
      case 'h': {
        var lv = Math.max(1, Math.min(HEADING_MAX, level || (b.t === 'h' ? b.level : guessLevel(blocks, i))));
        nb = newBlock('h', { level: lv, text: text });
        break;
      }
      case 'p': nb = newBlock('p', { text: text }); break;
      case 'ul': nb = newBlock('li', { marker: 'ul', indent: b.t === 'li' ? (b.indent || 0) : 0, text: text }); break;
      case 'ol': nb = newBlock('li', { marker: 'ol', indent: b.t === 'li' ? (b.indent || 0) : 0, text: text }); break;
      case 'quote': nb = newBlock('quote', { text: text }); break;
      case 'code': nb = newBlock('code', { text: text }); break;
      case 'hr': nb = newBlock('hr'); break;
      default: return false;
    }
    blocks.splice(i, 1, nb);
    return true;
  }

  // 转为标题时的缺省层级：沿用上一个标题的下一级；无上一个标题则为 H1
  function guessLevel(blocks, i) {
    for (var j = i - 1; j >= 0; j--) {
      if (blocks[j].t === 'h') return Math.min(HEADING_MAX, blocks[j].level + 1);
    }
    return 1;
  }

  function insertAfter(blocks, i, block) {
    blocks.splice(i + 1, 0, block);
    return true;
  }

  function deleteBlock(blocks, i) {
    blocks.splice(i, 1);
    return true;
  }

  return {
    HEADING_MAX: HEADING_MAX,
    INDENT_MAX: INDENT_MAX,
    newBlock: newBlock,
    clone: clone,
    emptyDoc: emptyDoc,
    sampleDoc: sampleDoc,
    chipText: chipText,
    blockLabel: blockLabel,
    serializeMarkdown: serializeMarkdown,
    parseMarkdown: parseMarkdown,
    countWords: countWords,
    stats: stats,
    lint: lint,
    applyFix: applyFix,
    moveBlock: moveBlock,
    indentBlock: indentBlock,
    convertBlock: convertBlock,
    guessLevel: guessLevel,
    insertAfter: insertAfter,
    deleteBlock: deleteBlock
  };
});
