/* CDP 取证探针：驱动真实 Chromium（headless）对静态页面执行场景验证并截图。
 * 用法：node .evidence/cdp-probe.mjs
 * 产出：.evidence/shot-*.png、.evidence/report.json、.evidence/probe-stdout.log
 * 诚实纪律：所有断言取自浏览器内 Runtime.evaluate 的实际观察值；任何 FAIL 原样记录。
 */
import { spawn, execSync } from 'node:child_process';
import { writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const URL_ = 'file:///' + ROOT.replace(/\\/g, '/') + '/index.html';
const EXES = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
];
const report = { method: 'cdp', node: process.version, browser: null, url: URL_, steps: [], console: [], screenshots: [] };
const step = (id, pass, observed) => { report.steps.push({ id, pass, observed }); console.log((pass ? 'PASS' : 'FAIL') + '\t' + id + '\t' + JSON.stringify(observed)); };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function findExe() { const e = EXES.find(existsSync); report.browser = e || null; return e; }

/* ---------- 兜底路径：无原生 WebSocket 时退化为一次性首屏截图 ---------- */
async function screenshotOnly(exe) {
  report.method = 'headless-screenshot-only';
  const out = join(HERE, 'shot-1-initial.png');
  try {
    execSync(`"${exe}" --headless=new --disable-gpu --window-size=1440,900 --virtual-time-budget=5000 --screenshot="${out}" "${URL_}"`, { stdio: 'ignore', timeout: 40000 });
    report.screenshots.push(out);
    step('fallback-initial-shot', existsSync(out), { out, note: '仅首屏截图；交互断言无法执行（node 缺原生 WebSocket）' });
  } catch (e) { step('fallback-initial-shot', false, { error: String(e) }); }
  writeFileSync(join(HERE, 'report.json'), JSON.stringify(report, null, 2));
  process.exit(existsSync(out) ? 0 : 3);
}

/* ---------- CDP 主路径 ---------- */
async function main() {
  const exe = findExe();
  if (!exe) { console.log('NO_BROWSER'); process.exit(2); }
  if (typeof WebSocket !== 'function') return screenshotOnly(exe);

  const PORT = 9333;
  const profile = join(HERE, '.tmp-profile');
  rmSync(profile, { recursive: true, force: true });
  const proc = spawn(exe, [
    '--headless=new', '--disable-gpu', `--remote-debugging-port=${PORT}`,
    '--window-size=1440,900', `--user-data-dir=${profile}`, 'about:blank'
  ], { stdio: 'ignore' });

  let ws = null;
  const bail = (err) => {
    report.fatal = String(err);
    console.log('FATAL\t' + report.fatal);
    try { ws && ws.close(); } catch {}
    try { execSync(`taskkill /PID ${proc.pid} /T /F`, { stdio: 'ignore' }); } catch {}
    writeFileSync(join(HERE, 'report.json'), JSON.stringify(report, null, 2));
    process.exit(1);
  };
  setTimeout(() => bail('global timeout 50s'), 50000).unref();

  try {
    /* 等调试端口就绪 */
    let targets = null;
    for (let i = 0; i < 40; i++) {
      try {
        const res = await fetch(`http://127.0.0.1:${PORT}/json`);
        const list = await res.json();
        targets = list.filter(t => t.type === 'page');
        if (targets.length) break;
      } catch {}
      await sleep(250);
    }
    if (!targets || !targets.length) throw new Error('devtools port not ready');
    ws = new WebSocket(targets[0].webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

    let mid = 0; const pend = new Map(); const hooks = [];
    ws.onmessage = (e) => {
      const m = JSON.parse(e.data);
      if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); }
      else hooks.forEach(h => h(m));
    };
    const send = (method, params = {}) => new Promise((res, rej) => { const id = ++mid; pend.set(id, { res, rej }); ws.send(JSON.stringify({ id, method, params })); });
    const on = (fn) => hooks.push(fn);

    await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable');
    on(m => {
      if (m.method === 'Runtime.consoleAPICalled' && ['warning', 'error'].includes(m.params.type))
        report.console.push({ kind: 'console.' + m.params.type, text: m.params.args.map(a => a.value != null ? String(a.value) : (a.description || '')).join(' ') });
      if (m.method === 'Runtime.exceptionThrown')
        report.console.push({ kind: 'exception', text: m.params.exceptionDetails.text + ' ' + (m.params.exceptionDetails.exception && m.params.exceptionDetails.exception.description || '') });
      if (m.method === 'Log.entryAdded' && ['warning', 'error'].includes(m.params.entry.level))
        report.console.push({ kind: 'log.' + m.params.entry.level, text: m.params.entry.text });
    });

    const ev = async (expr) => {
      const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
      if (r.exceptionDetails) return { __err: r.exceptionDetails.text };
      return r.result.value;
    };
    const shot = async (name) => {
      const { data } = await send('Page.captureScreenshot', { format: 'png' });
      const p = join(HERE, name);
      writeFileSync(p, Buffer.from(data, 'base64'));
      report.screenshots.push(p);
      return p;
    };

    await send('Page.navigate', { url: URL_ });
    await sleep(2400);

    /* a. 首屏即就绪 */
    const first = await ev(`(() => ({
      dimRows: document.querySelectorAll('.dim-row').length,
      circles: document.querySelectorAll('#chart circle[data-id]').length,
      visibleCount: document.getElementById('visible-count').textContent,
      chips: document.getElementById('chips').textContent.trim(),
      loadingWord: /加载中|loading/i.test(document.body.innerText),
      groups: document.querySelectorAll('.dim-group').length,
      trailItems: document.querySelectorAll('#trail .trail-item').length,
      projTitle: document.getElementById('proj-title').textContent
    }))()`);
    step('a-initial-ready',
      first.dimRows === 15 && first.circles === 240 && /240\s*\/\s*240/.test(first.visibleCount) && !first.loadingWord && first.trailItems === 1,
      first);
    await shot('shot-1-initial.png');

    /* b. 点选 */
    const b = await ev(`(() => {
      document.querySelector('#chart circle[data-id="7"]').click();
      return { chips: document.getElementById('chips').textContent.trim(), insp: (document.querySelector('#inspector h3')||{}).textContent || null };
    })()`);
    step('b-select-point', /已选 1 条/.test(b.chips) && !!b.insp, b);

    /* c. 换 Y 轴 → 选中保持 */
    const c = await ev(`(() => {
      document.querySelector('button[data-act="role"][data-role="y"][data-dim="pop"]').click();
      return {
        projTitle: document.getElementById('proj-title').textContent,
        rings: document.querySelectorAll('#chart circle[stroke="#0b0b0b"]').length,
        trailFirst: (document.querySelector('#trail li .trail-item .lbl')||{}).textContent || null,
        inspUnchanged: (document.querySelector('#inspector h3')||{}).textContent || null
      };
    })()`);
    step('c-dim-switch-preserves', /人口/.test(c.projTitle) && c.rings >= 1 && /Y→人口/.test(c.trailFirst) && c.inspUnchanged === b.insp, c);
    await shot('shot-2-dimswitch.png');

    /* d. 过滤（归属芯片 + 可见数下降） */
    const d = await ev(`(() => {
      document.querySelector('button[data-act="filter-toggle"][data-dim="gdp"]').click();
      const s = document.getElementById('f-gdp-min');
      s.value = (+s.min) + (+s.max - +s.min) * 0.2;
      s.dispatchEvent(new Event('input', { bubbles: true }));
      s.dispatchEvent(new Event('change', { bubbles: true }));
      return { visibleCount: document.getElementById('visible-count').textContent,
               chips: document.getElementById('chips').textContent.trim(),
               faded: [...document.querySelectorAll('#chart circle[data-id]')].filter(x => x.getAttribute('fill-opacity') === '0.1').length };
    })()`);
    const vn = parseInt(d.visibleCount.replace(/\D+/g, ''), 10);
    step('d-filter-attributed', vn < 240 && /人均GDP/.test(d.chips) && d.faded > 0, { ...d, visibleN: vn });
    await shot('shot-3-filter.png');

    /* e. 撤销 / 重做 / 轨迹回退 */
    const e1 = await ev(`(() => { document.getElementById('btn-undo').click();
      return { s: document.getElementById('f-gdp-min').value, chips: document.getElementById('chips').textContent.trim(), vc: document.getElementById('visible-count').textContent }; })()`);
    step('e1-undo-restores', /240\s*\/\s*240/.test(e1.vc) && /已选 1 条/.test(e1.chips), e1);
    const e2 = await ev(`(() => { document.getElementById('btn-redo').click();
      return { vc: document.getElementById('visible-count').textContent, chips: document.getElementById('chips').textContent.trim() }; })()`);
    step('e2-redo-reapplies', !/240\s*\/\s*240/.test(e2.vc) && /人均GDP/.test(e2.chips), e2);
    const e3 = await ev(`(() => {
      const item = [...document.querySelectorAll('#trail .trail-item')].find(x => x.textContent.includes('初始视图'));
      item.click();
      return { vc: document.getElementById('visible-count').textContent, chips: document.getElementById('chips').textContent.trim() }; })()`);
    step('e3-trail-restores-initial', /240\s*\/\s*240/.test(e3.vc) && !/人均GDP/.test(e3.chips) && !/已选/.test(e3.chips), e3);

    /* f. 键盘选中 + 焦点可见性 */
    const f = await ev(`(() => {
      const ch = document.getElementById('chart');
      ch.focus();
      for (const k of ['ArrowRight','ArrowRight','ArrowRight']) ch.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
      ch.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
      const cs = getComputedStyle(ch);
      return { chips: document.getElementById('chips').textContent.trim(), insp: (document.querySelector('#inspector h3')||{}).textContent || null,
               outline: cs.outlineWidth + ' ' + cs.outlineStyle + ' ' + cs.outlineColor,
               live: document.getElementById('live').textContent };
    })()`);
    step('f-keyboard-select', /已选 1 条/.test(f.chips) && !!f.insp, f);
    await shot('shot-4-keyboard.png');

    /* g. AA 抽查 + 对比度计算 */
    const g = await ev(`(() => {
      const lum = (rgb) => { const m = rgb.match(/\\d+(\\.\\d+)?/g).map(Number); const [r,gg,b] = m; const f = v => { v/=255; return v<=0.03928? v/12.92 : Math.pow((v+0.055)/1.055, 2.4); }; return 0.2126*f(r)+0.7152*f(gg)+0.0722*f(b); };
      const ratio = (a, b2) => { const l1 = lum(a), l2 = lum(b2); return +(((Math.max(l1,l2)+0.05)/(Math.min(l1,l2)+0.05)).toFixed(2)); };
      const cs = el => getComputedStyle(el);
      const body = cs(document.body), hint = cs(document.querySelector('.panel-hint')),
            btn = cs(document.getElementById('btn-undo')), chip = cs(document.querySelector('.chip') || document.body),
            dimn = cs(document.querySelector('.dim-name'));
      return {
        body: { color: body.color, bg: body.backgroundColor, font: body.fontSize },
        panelHint: { color: hint.color, font: hint.fontSize },
        dimName: { color: dimn.color, font: dimn.fontSize },
        button: { minHeight: btn.minHeight, font: btn.fontSize },
        chip: { font: chip.fontSize },
        ratioBodyOnPanel: ratio(body.color, 'rgb(252, 252, 251)'),
        ratioHintOnPanel: ratio(hint.color, 'rgb(252, 252, 251)'),
        ratioBodyOnPage: ratio(body.color, body.backgroundColor)
      };
    })()`);
    step('g-aa-floor', g.ratioBodyOnPanel >= 4.5 && g.ratioHintOnPanel >= 4.5 && parseFloat(g.body.font) >= 12 && parseFloat(g.panelHint.font) >= 12 && parseFloat(g.button.minHeight) >= 24 && parseFloat(g.chip.font) >= 12, g);

    ws.close();
  } catch (err) { bail(err); }
  try { execSync(`taskkill /PID ${proc.pid} /T /F`, { stdio: 'ignore' }); } catch {}
  rmSync(profile, { recursive: true, force: true });
  writeFileSync(join(HERE, 'report.json'), JSON.stringify(report, null, 2));
  console.log('DONE steps=' + report.steps.length + ' shots=' + report.screenshots.length);
}
main();
