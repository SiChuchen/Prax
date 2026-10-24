/* CDP-driven interactive verification of the Prism app (local tooling).
 * Performs real clicks + key events against the live page and asserts
 * every step of the acceptance behavior. Writes screenshots + results. */
import { spawn } from 'node:child_process';
import { writeFileSync, rmSync } from 'node:fs';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9339;
const APP = 'file:///E:/codex-prj/ab-worktrees/pi-matrix-m5/s2-e1/index.html';
const OUT = 'E:/codex-prj/ab-worktrees/pi-matrix-m5/s2-e1/shots';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const proc = spawn(CHROME, [
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${OUT}/_profile`,
  '--headless=new', '--disable-gpu', '--no-first-run', '--window-size=1680,950', 'about:blank',
], { stdio: 'ignore' });
process.on('exit', () => { try { proc.kill(); } catch {} });

const results = [];
const consoleErrors = [];
function record(step, pass, got) { results.push({ step, pass, got }); console.log((pass ? 'PASS' : 'FAIL') + '  ' + step + '  → ' + JSON.stringify(got)); }

let msgId = 0;
const pending = new Map();
let ws;

function send(method, params = {}) {
  return new Promise((res, rej) => {
    const id = ++msgId;
    pending.set(id, { res, rej });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function evalJs(expression) {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error('page exception: ' + JSON.stringify(r.exceptionDetails.exception?.description || r.exceptionDetails.text));
  return r.result.value;
}
const dom = sel => evalJs(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); return e ? e.textContent.trim() : null; })()`);
const domAll = sel => evalJs(`[...document.querySelectorAll(${JSON.stringify(sel)})].map(e => e.textContent.trim())`);
async function clickAt(selector, all) {
  return evalJs(`(() => {
    const els = [...document.querySelectorAll(${JSON.stringify(selector)})];
    const el = ${all ? 'els[0]' : 'els[0]'};
    if (!el) return 'MISS';
    el.scrollIntoView({ block: "center" });
    el.click();
    return 'OK';
  })()`);
}

async function key(modifiers, key, code, vk) {
  await send('Input.dispatchKeyEvent', { type: 'keyDown', modifiers, key, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', modifiers, key, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk });
}
async function screenshot(name) {
  const r = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(`${OUT}/${name}`, Buffer.from(r.data, 'base64'));
}

async function main() {
  let wsUrl;
  for (let i = 0; i < 40; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
      const page = list.find(t => t.type === 'page');
      if (page) { wsUrl = page.webSocketDebuggerUrl; break; }
    } catch {}
    await sleep(250);
  }
  ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); }
    else if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') consoleErrors.push(m.params.args.map(a => a.value ?? a.description).join(' '));
    else if (m.method === 'Runtime.exceptionThrown') consoleErrors.push(m.params.exceptionDetails?.exception?.description || m.params.exceptionDetails?.text || 'exception');
  };
  await send('Runtime.enable');
  await send('Page.enable');

  await send('Page.navigate', { url: APP });
  await sleep(900);

  // 1 — initial state
  const rows0 = await domAll('#proj-body td.col-val');
  record('initial: grid populated at first paint (8 category rows, no loading state)',
    rows0.length === 8 && rows0[0] === 'Electronics', rows0);
  const chips0 = await domAll('#state-strip .chip');
  record('initial: lens chip = Category', chips0.length === 1 && chips0[0].includes('Category'), chips0);
  const trail0 = await domAll('#trail-list .trail-label');
  record('initial: trail has base step only', trail0.length === 1 && trail0[0].includes('Category'), trail0);

  // 2 — switch lens to Region
  await clickAt('.dim-item[data-dim="region"]');
  await sleep(80);
  const head1 = await dom('.grid-head .gh-dim');
  const rows1 = await domAll('#proj-body td.col-val');
  const trail1 = await domAll('#trail-list .trail-label');
  record('lens switch: header → Region, 6 rows, trail logs "lens → Region"',
    head1.includes('Region') && rows1.length === 6 && trail1.length === 2 && trail1[1].includes('Region'),
    { head1, n: rows1.length, trail1 });

  // 3 — pin West
  await evalJs(`[...document.querySelectorAll('#proj-body tr')].find(tr => tr.cells[0].textContent === 'West').click()`);
  await sleep(80);
  const chips2 = await domAll('#state-strip .chip');
  const insp = await dom('.insp-title');
  const cross = await dom('.insp-cross-label');
  record('select West: pin chip + inspector "West · Region" + cross "Across Region"',
    chips2.some(c => c.includes('pin') && c.includes('Region') && c.includes('West')) && insp.includes('West') && cross.includes('Across Region'),
    { chips: chips2, insp, cross });

  // 4 — filter "only West"
  await evalJs(`[...document.querySelectorAll('#proj-body tr')].find(tr => tr.cells[0].textContent === 'West').querySelector('.act-btn').click()`);
  await sleep(80);
  const chips3 = await domAll('#state-strip .chip');
  const trail3 = await domAll('#trail-list .trail-label');
  const scope3 = await dom('.grid-head .gh-scope');
  record('filter only-West: attributed chip "Region 1/6 · West", scope narrowed, trail logs filter',
    chips3.some(c => c.includes('filter') && c.includes('Region') && c.includes('1/6')) && trail3.length === 3 && scope3.includes('of 6,400'),
    { chips: chips3, trail: trail3.length, scope: scope3 });

  // 5 — switch lens to Channel: THE continuity check
  await clickAt('.dim-item[data-dim="channel"]');
  await sleep(80);
  const head5 = await dom('.grid-head .gh-dim');
  const chips5 = await domAll('#state-strip .chip');
  const cross5 = await dom('.insp-cross-label');
  const rows5 = await domAll('#proj-body td.col-val');
  const trail5 = await domAll('#trail-list .trail-label');
  record('CONTINUITY: after lens switch to Channel, filter chip + pin chip survive, inspector re-projects West "Across Channel", trail intact',
    head5.includes('Channel') && rows5.length === 5 &&
    chips5.some(c => c.includes('filter') && c.includes('Region')) &&
    chips5.some(c => c.includes('pin') && c.includes('West')) &&
    cross5.includes('Across Channel') && trail5.length === 4,
    { head: head5, chips: chips5, cross: cross5, trail: trail5 });
  await screenshot('06-interactive-continuity.png');

  // 6 — Ctrl+Z undoes the lens switch
  await key(2, 'z', 'KeyZ', 90);
  await sleep(80);
  const head6 = await dom('.grid-head .gh-dim');
  const trail6 = await domAll('#trail-list .trail-label');
  const chips6 = await domAll('#state-strip .chip');
  record('undo (Ctrl+Z): back to Region lens, filter+pin still owned by Region',
    head6.includes('Region') && trail6.length === 3 && chips6.some(c => c.includes('filter') && c.includes('Region')),
    { head: head6, trail: trail6.length, chips: chips6 });

  // 7 — revert to trail step 1 ("lens → Region"): removes the later filter step
  const revertOk = await evalJs(`(() => { const items = [...document.querySelectorAll('#trail-list .trail-item')]; const t = items[1]?.querySelector('.trail-revert'); if (!t) return 'MISS'; t.click(); return 'OK'; })()`);
  await sleep(80);
  const chips7 = await domAll('#state-strip .chip');
  const trail7 = await domAll('#trail-list .trail-label');
  record('trail revert-to-step: reverting to "lens → Region" removes the later filter step and its chip',
    revertOk === 'OK' && trail7.length === 2 && !chips7.some(c => c.includes('filter')),
    { chips: chips7, trail: trail7 });

  // 8 — Escape releases the pin
  await key(0, 'Escape', 'Escape', 27);
  await sleep(80);
  const chips8 = await domAll('#state-strip .chip');
  const insp8 = await dom('.insp-hint');
  record('Escape: pin released, inspector back to hint',
    !chips8.some(c => c.includes('pin')) && (insp8 || '').includes('No selection'),
    { chips: chips8, hint: insp8 });

  // 9 — Reset all
  await clickAt('#btn-reset');
  await sleep(80);
  const trail9 = await domAll('#trail-list .trail-label');
  const head9 = await dom('.grid-head .gh-dim');
  const chips9 = await domAll('#state-strip .chip');
  record('Reset all: back to initial Category view, full pool, trail logs reset',
    head9.includes('Category') && trail9[trail9.length - 1].includes('reset') && chips9.length === 1,
    { head: head9, trail: trail9, chips: chips9 });
  await screenshot('07-interactive-reset.png');

  record('console: no errors during entire session', consoleErrors.length === 0, consoleErrors);

  writeFileSync(`${OUT}/cdp-results.json`, JSON.stringify({ results, consoleErrors }, null, 2));
  const failed = results.filter(r => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  ws.close();
}

main().then(async () => { proc.kill(); await sleep(800); try { rmSync(`${OUT}/_profile`, { recursive: true, force: true }); } catch {} process.exit(0); })
  .catch(e => { console.error('DRIVER ERROR:', e); proc.kill(); process.exit(1); });
