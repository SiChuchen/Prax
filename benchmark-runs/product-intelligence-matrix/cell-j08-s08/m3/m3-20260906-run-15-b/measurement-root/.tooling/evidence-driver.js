/* 真实浏览器交互证据采集：puppeteer-core 驱动本机 Edge（CDP）
 * 旅程 A–H：首屏就绪 / 选择同步 / 字段编辑一致性 / 撤销 / 结构操作 /
 * 删除防护弹窗 / 校验定位 / 键盘导航。截图输出至 ../evidence/。
 */
'use strict';
const puppeteer = require('puppeteer-core');
const path = require('path');

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const URL = 'file:///E:/codex-prj/ab-worktrees/pi-matrix/cell-j08-s08-b/index.html';
const OUT = path.resolve(__dirname, '..', 'evidence');

const R = {};
const consoleErrors = [];

async function textOf(page, sel) {
  return page.$eval(sel, el => el.textContent.trim()).catch(() => null);
}
async function shot(page, name) {
  await page.screenshot({ path: path.join(OUT, name) });
  R[name] = 'saved';
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({
    executablePath: EDGE,
    headless: true,
    defaultViewport: { width: 1680, height: 960 },
    args: ['--disable-gpu', '--hide-scrollbars']
  });
  const page = await browser.newPage();
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', e => consoleErrors.push('pageerror: ' + e.message));

  /* ---------- STEP A: 首屏就绪 ---------- */
  await page.goto(URL, { waitUntil: 'load' });
  await sleep(300);
  R.A = {
    bodyHasLoadingText: (await textOf(page, 'body')).includes('加载中'),
    outlineCount: await textOf(page, '#outlineCount'),
    editorTitleValue: await page.$eval('#fTitle', el => el.value),
    previewH1: await textOf(page, '.pv-doc-title'),
    firstPvHead: await textOf(page, '.pv-sec .pv-head'),
    badge: await textOf(page, '#reportBadge'),
    undoDisabled: await page.$eval('#btnUndo', el => el.disabled),
    redoDisabled: await page.$eval('#btnRedo', el => el.disabled)
  };
  await shot(page, '01-initial-load.png');

  /* ---------- STEP B: 选择同步 ---------- */
  await page.click('[data-row="s2-1"] .ol-title');
  await sleep(150);
  R.B = {
    editorTitleValue: await page.$eval('#fTitle', el => el.value),
    crumbs: await textOf(page, '#crumbs'),
    previewSelected: await page.$eval('.pv-sec[data-node="s2-1"]', el => el.getAttribute('data-selected'))
  };
  await shot(page, '02-select-section.png');

  /* ---------- STEP C: 字段编辑 → 预览即时一致（验收种子） ---------- */
  await page.click('#fTitle');
  await page.keyboard.press('End');
  await page.keyboard.type('（测试）', { delay: 40 });
  await sleep(200);
  R.C = {
    editorTitleValue: await page.$eval('#fTitle', el => el.value),
    previewHeading: await textOf(page, '.pv-sec[data-node="s2-1"] .pv-text'),
    outlineRowTitle: await textOf(page, '[data-row="s2-1"] .ol-title')
  };
  await shot(page, '03-field-edit-consistency.png');

  /* ---------- STEP D: 撤销恢复三栏一致 ---------- */
  await page.keyboard.down('Control');
  await page.keyboard.press('z');
  await page.keyboard.up('Control');
  await sleep(200);
  R.D = {
    editorTitleValue: await page.$eval('#fTitle', el => el.value),
    previewHeading: await textOf(page, '.pv-sec[data-node="s2-1"] .pv-text'),
    outlineRowTitle: await textOf(page, '[data-row="s2-1"] .ol-title')
  };
  await shot(page, '04-undo-revert.png');

  /* ---------- STEP E: 结构操作（降级）+ 约束 ---------- */
  await page.click('[data-row="s2-2"] [data-act="demote"]');
  await sleep(200);
  R.E = {
    demotedNumber: await textOf(page, '[data-row="s2-2"] .ol-num'),
    nestedInPreview: await page.$eval('[data-node="s2-1"] .pv-children [data-node="s2-2"]', el => !!el).catch(() => false),
    outlineCount: await textOf(page, '#outlineCount'),
    previewHeadingOfParent: await textOf(page, '.pv-sec[data-node="s2-1"] .pv-text')
  };
  await shot(page, '05-demote-structure.png');
  await page.keyboard.down('Control');
  await page.keyboard.press('z');
  await page.keyboard.up('Control');
  await sleep(200);
  R.E_afterUndo = { demotedNumber: await textOf(page, '[data-row="s2-2"] .ol-num') };

  /* ---------- STEP F: 删除防护弹窗 ---------- */
  await page.click('[data-row="s2"] [data-act="remove"]');
  await sleep(200);
  R.F = {
    modalVisible: await page.$eval('#modalBackdrop', el => !el.hidden),
    modalTitle: await textOf(page, '#modalTitle'),
    modalBody: await textOf(page, '#modalBody'),
    actions: await page.$$eval('#modalActions button', els => els.map(e => e.textContent.trim()))
  };
  await shot(page, '06-delete-confirm-modal.png');
  await page.$$eval('#modalActions button', els => els[els.length - 1].click());
  await sleep(150);
  R.F_afterCancel = {
    modalHidden: await page.$eval('#modalBackdrop', el => el.hidden),
    s2StillExists: await page.$eval('[data-row="s2"]', el => !!el).catch(() => false)
  };

  /* ---------- STEP G: 校验 → 徽标 → 面板定位 ---------- */
  await page.click('[data-row="s4"] .ol-title');
  await sleep(150);
  await page.click('#fTitle');
  await page.keyboard.down('Control'); await page.keyboard.press('a'); await page.keyboard.up('Control');
  await page.keyboard.press('Delete');
  await sleep(250);
  R.G_badgeAfterClear = await textOf(page, '#reportBadge');
  await page.click('#btnReport');
  await sleep(200);
  R.G = {
    reportFirstItem: await textOf(page, '.ritem'),
    reportState: await textOf(page, '#reportState')
  };
  await page.click('.ritem');
  await sleep(200);
  R.G_selectedAfterLocate = await page.$eval('.ol-row.selected', el => el.getAttribute('data-row'));
  await shot(page, '07-validation-locate.png');
  await page.keyboard.down('Control'); await page.keyboard.press('z'); await page.keyboard.up('Control');
  await sleep(200);
  R.G_badgeAfterUndo = {
    badge: await textOf(page, '#reportBadge'),
    editorTitleValue: await page.$eval('#fTitle', el => el.value)
  };

  /* ---------- STEP H: 键盘导航 + 可见焦点 ---------- */
  await page.click('[data-row="s1"] .ol-title');
  await sleep(150);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await sleep(200);
  R.H = {
    selectedRow: await page.$eval('.ol-row.selected', el => el.getAttribute('data-row')),
    selectedRowTitle: await textOf(page, '.ol-row.selected .ol-title'),
    editorTitleValue: await page.$eval('#fTitle', el => el.value),
    activeElementIsSelectedRow: await page.evaluate(() =>
      document.activeElement && document.activeElement.classList.contains('ol-row') &&
      document.activeElement.classList.contains('selected'))
  };
  await shot(page, '08-keyboard-navigation.png');

  R.consoleErrors = consoleErrors;
  console.log(JSON.stringify(R, null, 2));
  await browser.close();
})().catch(e => { console.error('DRIVER FAILED:', e); process.exit(1); });
