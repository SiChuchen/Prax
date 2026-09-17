/* model.test.mjs — doc-model.js 单元测试（node 原生 assert，无依赖）
 * 运行：node tests/model.test.mjs
 */
import { createRequire } from 'module';
import assert from 'assert/strict';
const require = createRequire(import.meta.url);
const M = require('../doc-model.js');

let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log('  ✓ ' + name);
}

console.log('doc-model.js');

/* ---------- 样例文档 ---------- */

test('样例文档结构完好（无 lint 提示）', () => {
  const doc = M.sampleDoc();
  assert.ok(doc.title.length > 0);
  assert.ok(doc.blocks.length >= 10);
  assert.deepEqual(M.lint(doc), []);
  assert.equal(doc.blocks[0].t, 'p');
  assert.ok(doc.blocks.some(b => b.t === 'h' && b.level === 2));
  assert.ok(doc.blocks.some(b => b.t === 'h' && b.level === 3));
  assert.ok(doc.blocks.some(b => b.t === 'li' && b.marker === 'ul'));
  assert.ok(doc.blocks.some(b => b.t === 'li' && b.marker === 'ol'));
  assert.ok(doc.blocks.some(b => b.t === 'quote'));
  assert.ok(doc.blocks.some(b => b.t === 'code'));
  assert.ok(doc.blocks.some(b => b.t === 'hr'));
});

/* ---------- Markdown 序列化 / 解析 round-trip ---------- */

test('serializeMarkdown：标题行 + 列表连续无空行 + 代码围栏 + 分割线', () => {
  const md = M.serializeMarkdown(M.sampleDoc());
  const lines = md.split('\n');
  assert.equal(lines[0], '# 领航 App 3.2 版本发布说明（草案）');
  assert.ok(md.includes('## 主要新功能'));
  assert.ok(md.includes('### 反馈渠道'));
  assert.ok(md.includes('- 全新首页卡片流'));
  assert.ok(md.includes('1. 修复语音助手'));
  assert.ok(md.includes('> 部分安卓 8 机型'));
  assert.ok(md.includes('```'));
  assert.ok(md.includes('---'));
  // 无序列表三项应连续（中间无空行）
  const i1 = lines.indexOf('- 全新首页卡片流：支持按使用场景自动排序，常用卡片可一键置顶。');
  assert.equal(lines[i1 + 1], '- 离线地图包体积缩小 38%，弱网与地铁场景加载更快。');
});

test('round-trip：parse(serialize(sample)) 与原文档深相等', () => {
  const doc = M.sampleDoc();
  const back = M.parseMarkdown(M.serializeMarkdown(doc), 'x');
  assert.deepEqual(back, doc);
});

test('parseMarkdown：标题取首个 H1、层级截到 H3、缩进与有序标记', () => {
  const md = [
    '# 我的文档', '',
    '#### 过深的标题', '',
    '- 顶层', '',
    '  - 二层', '',
    '    - 三层', '',
    '      - 超深（截为 3）', '',
    '1) 第一项', '',
    '2) 第二项', ''
  ].join('\n');
  const doc = M.parseMarkdown(md, '缺省标题');
  assert.equal(doc.title, '我的文档');
  const hs = doc.blocks.filter(b => b.t === 'h');
  assert.equal(hs[0].level, 3); // #### 截为 H3
  const lis = doc.blocks.filter(b => b.t === 'li');
  assert.deepEqual(lis.map(l => l.indent), [0, 1, 2, 3, 0, 0]);
  assert.equal(lis[4].marker, 'ol');
});

test('parseMarkdown：多行段落合并、引用合并、未闭合围栏容错', () => {
  const md = '第一行\n第二行\n\n> 引用A\n> 引用B\n\n```\n未闭合的代码';
  const doc = M.parseMarkdown(md, 't');
  assert.equal(doc.blocks[0].t, 'p');
  assert.equal(doc.blocks[0].text, '第一行\n第二行');
  assert.equal(doc.blocks[1].t, 'quote');
  assert.equal(doc.blocks[1].text, '引用A\n引用B');
  assert.equal(doc.blocks[2].t, 'code');
  assert.equal(doc.blocks[2].text, '未闭合的代码');
});

test('parseMarkdown：空输入', () => {
  const doc = M.parseMarkdown('', '空');
  assert.equal(doc.title, '空');
  assert.deepEqual(doc.blocks, []);
});

/* ---------- lint 与修复 ---------- */

test('lint：多个一级标题', () => {
  const doc = {
    title: 't',
    blocks: [
      M.newBlock('h', { level: 1, text: 'A' }),
      M.newBlock('h', { level: 1, text: 'B' })
    ]
  };
  const issues = M.lint(doc);
  assert.equal(issues.length, 1);
  assert.equal(issues[0].kind, 'multi-h1');
  assert.equal(issues[0].i, 1);
  assert.ok(M.applyFix(doc, issues[0]));
  assert.equal(doc.blocks[1].level, 2);
  assert.deepEqual(M.lint(doc), []);
});

test('lint：标题跳级（H1 → H3）', () => {
  const doc = {
    title: 't',
    blocks: [
      M.newBlock('h', { level: 1, text: '章' }),
      M.newBlock('p', { text: '中间隔着正文也能检出' }),
      M.newBlock('h', { level: 3, text: '节' })
    ]
  };
  const issues = M.lint(doc);
  assert.equal(issues.length, 1);
  assert.equal(issues[0].kind, 'jump');
  assert.equal(issues[0].msg, '标题跳级 H1 → H3');
  M.applyFix(doc, issues[0]);
  assert.equal(doc.blocks[2].level, 2);
  assert.deepEqual(M.lint(doc), []);
});

test('lint：空标题修复为正文', () => {
  const doc = { title: 't', blocks: [M.newBlock('h', { level: 2, text: '   ' })] };
  const issues = M.lint(doc);
  assert.equal(issues[0].kind, 'empty-h');
  M.applyFix(doc, issues[0]);
  assert.equal(doc.blocks[0].t, 'p');
  assert.deepEqual(M.lint(doc), []);
});

/* ---------- 结构操作 ---------- */

test('moveBlock：上移 / 下移 / 越界返回 false', () => {
  const blocks = ['a', 'b', 'c'].map(t => M.newBlock('p', { text: t }));
  assert.equal(M.moveBlock(blocks, 1, -1), true);
  assert.deepEqual(blocks.map(b => b.text), ['b', 'a', 'c']);
  assert.equal(M.moveBlock(blocks, 0, -1), false);
  assert.equal(M.moveBlock(blocks, 2, 1), false);
  M.moveBlock(blocks, 2, -1);
  assert.deepEqual(blocks.map(b => b.text), ['b', 'c', 'a']);
});

test('indentBlock：列表缩进夹取 0..3；标题层级夹取 1..3', () => {
  const li = M.newBlock('li', { marker: 'ul', indent: 0, text: 'x' });
  const blocks = [li];
  M.indentBlock(blocks, 0, 1);
  assert.equal(li.indent, 1);
  li.indent = 3;
  M.indentBlock(blocks, 0, 1);
  assert.equal(li.indent, 3); // 上限
  M.indentBlock(blocks, 0, -5);
  assert.equal(li.indent, 0); // 下限
  const h = M.newBlock('h', { level: 1, text: 'h' });
  M.indentBlock([h], 0, 1);
  assert.equal(h.level, 2);
  h.level = 3;
  M.indentBlock([h], 0, 1);
  assert.equal(h.level, 3);
  const p = M.newBlock('p', { text: 'p' });
  assert.equal(M.indentBlock([p], 0, 1), false);
});

test('convertBlock：p → 有序列表保留文本；标题转换指定层级', () => {
  const blocks = [
    M.newBlock('p', { text: '内容' }),
    M.newBlock('p', { text: '正文' })
  ];
  M.convertBlock(blocks, 0, 'ol');
  assert.equal(blocks[0].t, 'li');
  assert.equal(blocks[0].marker, 'ol');
  assert.equal(blocks[0].text, '内容');
  M.convertBlock(blocks, 1, 'h', 3);
  assert.equal(blocks[1].t, 'h');
  assert.equal(blocks[1].level, 3);
});

test('convertBlock：未指定层级时沿上一标题降一级', () => {
  const blocks = [
    M.newBlock('h', { level: 2, text: '章' }),
    M.newBlock('p', { text: '正文' })
  ];
  M.convertBlock(blocks, 1, 'h');
  assert.equal(blocks[1].level, 3);
  const blocks2 = [M.newBlock('p', { text: 'x' })];
  M.convertBlock(blocks2, 0, 'h');
  assert.equal(blocks2[0].level, 1);
});

test('insertAfter / deleteBlock', () => {
  const blocks = [M.newBlock('p', { text: 'a' })];
  M.insertAfter(blocks, 0, M.newBlock('p', { text: 'b' }));
  assert.deepEqual(blocks.map(b => b.text), ['a', 'b']);
  M.deleteBlock(blocks, 0);
  assert.deepEqual(blocks.map(b => b.text), ['b']);
});

/* ---------- 统计 ---------- */

test('countWords：CJK 按字、西文按词', () => {
  assert.equal(M.countWords('你好 world 世界 123'), 6);
  assert.equal(M.countWords(''), 0);
  assert.equal(M.countWords('中文'), 2);
});

test('stats：块数 / 字数 / 阅读时长', () => {
  const doc = M.sampleDoc();
  const s = M.stats(doc);
  assert.equal(s.blocks, doc.blocks.length);
  assert.ok(s.words > 100);
  assert.ok(s.minutes >= 1);
});

console.log('\n全部通过：' + passed + ' 个用例');
