/*
 * Interactive evidence runner: drives the app in headless Chrome via CDP,
 * asserting the acceptance journey and saving screenshots + a JSON log.
 * Run: node scripts/evidence.js
 * Note: SVG elements have no .click() in Chrome — use dispatchEvent(MouseEvent).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');
const SHOTS = path.join(ROOT, 'shots');
const PORT = 9333;
const URL = 'file:///' + ROOT.replace(/\\/g, '/') + '/index.html';
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = [];
function record(step, ok, detail) {
  log.push({ step, ok, detail });
  console.log((ok ? 'PASS' : 'FAIL') + ' · ' + step + (detail ? ' — ' + detail : ''));
}
const svgClick = (selExpr) => `${selExpr}.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))`;

async function send(ws, method, params) {
  const id = ++send.id;
  return new Promise((resolve, reject) => {
    const onMsg = (evt) => {
      const m = JSON.parse(evt.data);
      if (m.id === id) { ws.removeEventListener('message', onMsg); m.error ? reject(new Error(method + ': ' + m.error.message)) : resolve(m.result); }
    };
    ws.addEventListener('message', onMsg);
    ws.send(JSON.stringify({ id, method, params: params || {} }));
  });
}
send.id = 0;

async function evalJS(ws, expr) {
  const r = await send(ws, 'Runtime.evaluate', { expression: expr, returnByValue: true });
  if (r.exceptionDetails) throw new Error('eval failed: ' + (r.exceptionDetails.exception && r.exceptionDetails.exception.description));
  return r.result.value;
}
async function shot(ws, name) {
  const r = await send(ws, 'Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(SHOTS, name), Buffer.from(r.data, 'base64'));
  console.log('SHOT  · ' + name);
}

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const chrome = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars',
    '--window-size=1680,1050', `--remote-debugging-port=${PORT}`,
    '--user-data-dir=' + path.join(process.env.TEMP, 'lensboard-cdp'),
    'about:blank',
  ], { stdio: 'ignore' });

  let target = null;
  for (let i = 0; i < 50 && !target; i++) {
    await sleep(200);
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      target = list.find((t) => t.type === 'page');
    } catch (e) { /* retry */ }
  }
  if (!target) { console.error('no CDP target'); process.exit(1); }

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  await send(ws, 'Page.enable');
  await send(ws, 'Runtime.enable');

  await send(ws, 'Page.navigate', { url: URL });
  await sleep(1200);

  const railBtns = `[...document.querySelectorAll('#rail-list .dim-row')]`;

  // ---- S1: first paint is usable — data present, no loading state ----
  const s1 = await evalJS(ws, `({
    count: document.querySelector('#working-count').textContent,
    rows: document.querySelectorAll('#working-table tbody tr').length,
    railDims: document.querySelectorAll('.dim-row').length,
    loadingText: document.body.textContent.includes('Loading'),
    chartBars: document.querySelectorAll('#lens-chart .bar-hit').length,
    total: window.DATASET.records.length,
  })`);
  record('S1 first-paint ready (inline data, no loading state)',
    s1.count.includes('720 / 720') && s1.rows > 5 && s1.rows <= 30 && s1.railDims === 9 && !s1.loadingText && s1.chartBars === 12 && s1.total === 720,
    JSON.stringify(s1));
  await shot(ws, 'e1-first-paint.png');

  // ---- S2: add a filter by clicking a histogram bin (SVG click) ----
  await evalJS(ws, svgClick(`document.querySelectorAll('#lens-chart .bar-hit')[8]`));
  await sleep(150);
  const s2 = await evalJS(ws, `({
    count: document.querySelector('#working-count').textContent,
    chips: [...document.querySelectorAll('#filter-chips .chip .chip-owner')].map(e => e.textContent),
    hist: [...document.querySelectorAll('#history-list .hist-row')].map(e => e.querySelector('.hist-label').textContent),
  })`);
  record('S2 bin click adds attributed filter', s2.count.includes('· 1 filter') && s2.chips.includes('Temperature') && s2.hist.length === 1,
    JSON.stringify(s2));

  // ---- S3: switch lens — filter must persist (维度切换不重置认知) ----
  await evalJS(ws, `${railBtns}.find(b => b.textContent.includes('Status')).click()`);
  await sleep(150);
  const s3 = await evalJS(ws, `({
    lensTitle: document.querySelector('#lens-title').textContent,
    tempChipStillThere: [...document.querySelectorAll('#filter-chips .chip-owner')].some(e => e.textContent === 'Temperature'),
    tempBadge: ${railBtns}.find(b => b.textContent.includes('Temperature')).querySelector('.dim-badge').textContent,
    bars: document.querySelectorAll('#lens-chart .bar-hit').length,
  })`);
  record('S3 lens switch keeps filter + attribution', s3.lensTitle.includes('Status') && s3.tempChipStillThere && s3.tempBadge === '1' && s3.bars === 3,
    JSON.stringify(s3));

  // ---- S4: second filter on the Status lens (bar 1 = degraded); selection persists ----
  await evalJS(ws, svgClick(`document.querySelectorAll('#lens-chart .bar-hit')[1]`));
  await evalJS(ws, `document.querySelectorAll('#working-table tbody tr')[3].click()`);
  await sleep(150);
  const s4 = await evalJS(ws, `({
    selected: document.querySelector('#working-table tbody tr.selected')?.dataset.id,
    inspectorId: document.querySelector('.insp-id span')?.textContent,
    historyKinds: [...document.querySelectorAll('.hist-kind')].map(e => e.textContent).join(','),
  })`);
  record('S4 second filter + selection drives inspector', !!s4.selected && s4.inspectorId === s4.selected && s4.historyKinds === 'filter-add,lens,filter-add',
    JSON.stringify(s4));
  await shot(ws, 'e2-two-filters-selection-history.png');

  // ---- S5: switch lens again; BOTH filters and the selection survive ----
  await evalJS(ws, `${railBtns}.find(b => b.textContent.includes('Uptime')).click()`);
  await sleep(150);
  const s5 = await evalJS(ws, `({
    chips: [...document.querySelectorAll('#filter-chips .chip-owner')].map(e => e.textContent).sort().join('|'),
    selStill: document.querySelector('.insp-id span')?.textContent,
    count: document.querySelector('#working-count').textContent,
  })`);
  record('S5 cognition survives second switch', s5.chips === 'Status|Temperature|lens' && s5.selStill === s4.selected && s5.count.includes('· 2 filters'),
    JSON.stringify(s5));
  await shot(ws, 'e3-lens-uptime-state-persists.png');

  // ---- S6: global undo (Ctrl+Z) pops the latest change (the Uptime lens switch) ----
  await send(ws, 'Input.dispatchKeyEvent', { type: 'keyDown', modifiers: 2, key: 'z', code: 'KeyZ', windowsVirtualKeyCode: 90 });
  await send(ws, 'Input.dispatchKeyEvent', { type: 'keyUp', modifiers: 2, key: 'z', code: 'KeyZ', windowsVirtualKeyCode: 90 });
  await sleep(150);
  const s6 = await evalJS(ws, `({
    lensTitle: document.querySelector('#lens-title').textContent,
    histCount: document.querySelectorAll('#history-list .hist-row').length,
    count: document.querySelector('#working-count').textContent,
  })`);
  record('S6 Ctrl+Z reverts latest (lens switch)', s6.lensTitle.includes('Status') && s6.histCount === 3 && s6.count.includes('· 2 filters'), JSON.stringify(s6));

  // ---- S7: per-entry revert of the newest filter entry (latest-first row 1) ----
  await evalJS(ws, `document.querySelectorAll('#history-list .hist-row button')[0].click()`);
  await sleep(150);
  const s7 = await evalJS(ws, `({
    lensTitle: document.querySelector('#lens-title').textContent,
    chips: [...document.querySelectorAll('#filter-chips .chip-owner')].map(e => e.textContent).sort().join('|'),
    histCount: document.querySelectorAll('#history-list .hist-row').length,
    count: document.querySelector('#working-count').textContent,
    statusBadge: ${railBtns}.find(b => b.textContent.includes('Status')).querySelector('.dim-badge').textContent,
  })`);
  record('S7 per-entry revert removes exactly the degraded filter',
    s7.lensTitle.includes('Status') && s7.chips === 'Temperature|lens' && s7.histCount === 2 && s7.count.includes('· 1 filter') && s7.statusBadge === '0',
    JSON.stringify(s7));

  // ---- S7b: per-entry revert of a PROJECTION (lens) entry ----
  await evalJS(ws, `${railBtns}.find(b => b.textContent.includes('Uptime')).click()`);
  await sleep(120);
  await evalJS(ws, `document.querySelectorAll('#history-list .hist-row button')[0].click()`);
  await sleep(150);
  const s7b = await evalJS(ws, `({
    lensTitle: document.querySelector('#lens-title').textContent,
    histCount: document.querySelectorAll('#history-list .hist-row').length,
  })`);
  record('S7b projection entry revert restores previous lens', s7b.lensTitle.includes('Status') && s7b.histCount === 2, JSON.stringify(s7b));

  // ---- S8: chip × removes a filter ----
  await evalJS(ws, `document.querySelectorAll('#filter-chips .chip .chip-x')[0].click()`);
  await sleep(150);
  const s8 = await evalJS(ws, `({
    count: document.querySelector('#working-count').textContent,
    histTop: document.querySelector('#history-list .hist-label')?.textContent,
    chips: [...document.querySelectorAll('#filter-chips .chip-owner')].map(e => e.textContent).sort().join('|'),
  })`);
  record('S8 chip removal clears working set filters', s8.count.includes('720 / 720') && /− Temperature/.test(s8.histTop) && s8.chips === 'lens', JSON.stringify(s8));

  // ---- S8b: the projection chip is owned state too — × reverts to previous lens ----
  await evalJS(ws, `document.querySelector('#filter-chips .lens-chip .chip-x').click()`);
  await sleep(150);
  const s8b = await evalJS(ws, `({ lensTitle: document.querySelector('#lens-title').textContent })`);
  record('S8b projection chip × reverts to previous lens', s8b.lensTitle.includes('Temperature'), JSON.stringify(s8b));

  // ---- S9: keyboard operability — focus a bin, press Enter; focus a row, press Enter ----
  await evalJS(ws, `document.querySelectorAll('#lens-chart .bar-hit')[5].focus()`);
  const s9focus = await evalJS(ws, `document.activeElement.classList.contains('bar-hit')`);
  await send(ws, 'Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  await send(ws, 'Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  await sleep(150);
  const s9 = await evalJS(ws, `({
    chipAdded: [...document.querySelectorAll('#filter-chips .chip-owner')].map(e => e.textContent).includes('Temperature'),
    focusPreserved: document.activeElement.classList.contains('bar-hit'),
  })`);
  const rowId = await evalJS(ws, `document.querySelector('#working-table tbody tr').dataset.id`);
  await evalJS(ws, `document.querySelector('#working-table tbody tr').focus()`);
  await send(ws, 'Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  await send(ws, 'Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  await sleep(150);
  const s9b = await evalJS(ws, `({ inspectorId: document.querySelector('.insp-id span')?.textContent || null })`);
  record('S9 keyboard operability (bin focus + Enter filters, focus preserved)', s9focus && s9.chipAdded && s9.focusPreserved, JSON.stringify({ s9focus, s9 }));
  record('S9b row keyboard selection drives inspector', s9b.inspectorId === rowId, JSON.stringify({ rowId, s9b }));
  await shot(ws, 'e4-keyboard-filter-selection.png');

  // ---- S10: empty state + recovery ----
  // bin[10] replaces the bin-5 filter (filter-set path); north never exceeds ~20 °C, so 0 rows
  await evalJS(ws, svgClick(`document.querySelectorAll('#lens-chart .bar-hit')[10]`));
  await sleep(120);
  await evalJS(ws, `${railBtns}.find(b => b.textContent.includes('Region')).click()`);
  await sleep(120);
  await evalJS(ws, svgClick(`document.querySelectorAll('#lens-chart .bar-hit')[0]`)); // region north
  await sleep(150);
  const s10 = await evalJS(ws, `({
    emptyShown: !document.querySelector('#empty-state').hidden,
    tableHidden: document.querySelector('#table-scroll').hidden,
    count: document.querySelector('#working-count').textContent,
    hasSetEntry: [...document.querySelectorAll('.hist-label')].some(e => e.textContent.startsWith('± Temperature')),
  })`);
  record('S10 empty state reachable with recovery', s10.emptyShown && s10.tableHidden && s10.count.startsWith('Showing 0') && s10.hasSetEntry, JSON.stringify(s10));
  await shot(ws, 'e5-empty-state.png');

  await evalJS(ws, `document.querySelector('#btn-empty-clear').click()`);
  await sleep(150);
  const s11 = await evalJS(ws, `({ count: document.querySelector('#working-count').textContent, histTop: document.querySelector('#history-list .hist-label')?.textContent })`);
  record('S11 empty-state recovery (revertible reset)', s11.count.includes('720 / 720') && /reset/.test(s11.histTop), JSON.stringify(s11));

  // ---- S12/S13: tab-order monotonicity (a11y.focus_order) at both validation viewports ----
  async function tabWalk(vw, vh) {
    await send(ws, 'Emulation.setDeviceMetricsOverride', { width: vw, height: vh, deviceScaleFactor: 1, mobile: false });
    await send(ws, 'Page.navigate', { url: URL });
    await sleep(1100);
    const stops = [];
    for (let i = 0; i < 60; i++) {
      await send(ws, 'Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
      await send(ws, 'Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
      const s = await evalJS(ws, `(() => {
        const a = document.activeElement;
        if (!a || a === document.body) return null;
        const r = a.getBoundingClientRect();
        return { tag: a.tagName, cls: (a.getAttribute('class') || '').slice(0, 24), y: Math.round(r.y), x: Math.round(r.x) };
      })()`);
      if (!s) break;
      // stop at the wrap-around: revisiting the first stop is the browser's cycle, not an inversion
      if (stops.length > 2 && s.tag === stops[0].tag && s.cls === stops[0].cls && s.x === stops[0].x && s.y === stops[0].y) break;
      stops.push(s);
    }
    const details = [];
    for (let i = 1; i < stops.length; i++) {
      if (stops[i].y < stops[i - 1].y - 2) details.push({ from: stops[i - 1], to: stops[i] });
    }
    await send(ws, 'Emulation.clearDeviceMetricsOverride');
    return { viewport: vw + 'x' + vh, stops: stops.length, inversions: details.length, details };
  }
  const fo1 = await tabWalk(1280, 860);
  fs.writeFileSync(path.join(SHOTS, 'focus-walk-1280x860.json'), JSON.stringify(fo1, null, 2));
  record('S12 tab order monotonic @1280x860', fo1.inversions === 0, JSON.stringify(fo1));
  const fo2 = await tabWalk(1440, 900);
  fs.writeFileSync(path.join(SHOTS, 'focus-walk-1440x900.json'), JSON.stringify(fo2, null, 2));
  record('S13 tab order monotonic @1440x900', fo2.inversions === 0, JSON.stringify(fo2));

  fs.writeFileSync(path.join(SHOTS, 'evidence-log.json'), JSON.stringify(log, null, 2));
  const failed = log.filter((l) => !l.ok);
  console.log('---'); console.log(failed.length ? `FAILURES: ${failed.length}` : 'ALL STEPS PASSED');
  ws.close(); chrome.kill();
  process.exit(failed.length ? 2 : 0);
})().catch((e) => { console.error('ERROR', e); process.exit(1); });
