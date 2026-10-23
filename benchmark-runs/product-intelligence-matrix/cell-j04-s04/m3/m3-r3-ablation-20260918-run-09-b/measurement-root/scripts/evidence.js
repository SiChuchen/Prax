// scripts/evidence.js — 经 CDP 驱动真实 Chromium 采集浏览器证据
// 前置：Node >= 22（内置 WebSocket）。零第三方依赖。
// 产物：evidence/01..07*.png + evidence/report.json
'use strict';
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

const ROOT = path.join(__dirname, '..');
const EVID = path.join(ROOT, 'evidence');
const PORT = 9333;
const APP_URL = 'file:///' + path.join(ROOT, 'index.html').replace(/\\/g, '/');

const CANDIDATES = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
].filter(Boolean);

const sleep = ms => new Promise(r => setTimeout(r, ms));

function httpGetJson(urlPath, method = 'GET') {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port: PORT, path: urlPath, method }, res => {
      let buf = '';
      res.on('data', d => (buf += d));
      res.on('end', () => { try { resolve(JSON.parse(buf)); } catch (e) { reject(e); } });
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  fs.mkdirSync(EVID, { recursive: true });
  const exe = CANDIDATES.find(p => fs.existsSync(p));
  if (!exe) throw new Error('未找到 Chrome/Edge，请安装或将路径加入 CANDIDATES');
  console.log('browser:', exe);

  const profile = path.join(require('os').tmpdir(), 'pw-cdp-profile');
  const proc = spawn(exe, [
    '--headless=new', `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profile}`, '--window-size=1600,1000',
    '--hide-scrollbars', '--disable-gpu', '--no-first-run', 'about:blank',
  ], { stdio: 'ignore' });

  try {
    // 等待调试端口就绪
    let version = null;
    for (let i = 0; i < 50 && !version; i++) {
      await sleep(200);
      try { version = await httpGetJson('/json/version'); } catch { /* retry */ }
    }
    if (!version) throw new Error('CDP 端口未就绪');

    // 浏览器级 ws → 建标签 → flatten 会话
    const ws = new WebSocket(version.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    let msgId = 0;
    const pending = new Map();
    const listeners = [];
    ws.onmessage = ev => {
      const m = JSON.parse(ev.data);
      if (m.id && pending.has(m.id)) { const { res, rej } = pending.get(m.id); pending.delete(m.id); m.error ? rej(new Error(m.error.message)) : res(m.result); }
      else if (m.method) for (const l of listeners) if (!l.sess || l.sess === m.sessionId) l.fn(m);
    };
    const send = (method, params = {}, sessionId) => new Promise((res, rej) => {
      const id = ++msgId;
      pending.set(id, { res, rej });
      ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
    const once = (method, sessionId, timeout = 15000) => new Promise((res, rej) => {
      const l = { sess: sessionId, fn: m => { if (m.method === method) { cleanup(); res(m.params); } } };
      const t = setTimeout(() => { cleanup(); rej(new Error('timeout waiting ' + method)); }, timeout);
      function cleanup() { clearTimeout(t); listeners.splice(listeners.indexOf(l), 1); }
      listeners.push(l);
    });

    const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
    const { sessionId: S } = await send('Target.attachToTarget', { targetId, flatten: true });
    await send('Page.enable', {}, S);
    await send('Runtime.enable', {}, S);
    await send('Log.enable', {}, S);

    const consoleMsgs = [];
    listeners.push({ sess: S, fn: m => {
      if (m.method === 'Runtime.consoleAPICalled') consoleMsgs.push({ kind: 'console.' + m.params.type, text: m.params.args.map(a => a.value ?? a.description ?? '').join(' ') });
      if (m.method === 'Runtime.exceptionThrown') consoleMsgs.push({ kind: 'exception', text: m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text });
      if (m.method === 'Log.entryAdded') consoleMsgs.push({ kind: 'log.' + m.params.entry.level, text: m.params.entry.text });
    } });

    await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false }, S);

    const shot = async name => {
      const { data } = await send('Page.captureScreenshot', { format: 'png' }, S);
      const p = path.join(EVID, name);
      fs.writeFileSync(p, Buffer.from(data, 'base64'));
      console.log('saved', name);
      return p;
    };
    const js = async expr => {
      const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true }, S);
      if (r.exceptionDetails) throw new Error('eval fail: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
      return r.result.value;
    };
    const rectCenter = async sel => await js(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});if(!e)return null;const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
    const clickAt = async (x, y) => {
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 }, S);
      await sleep(60);
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 }, S);
      await sleep(150);
    };
    const key = async (k) => { // k: {key, code, vk}
      await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: k.key, code: k.code, windowsVirtualKeyCode: k.vk }, S);
      await sleep(40);
      await send('Input.dispatchKeyEvent', { type: 'keyUp', key: k.key, code: k.code, windowsVirtualKeyCode: k.vk }, S);
      await sleep(150);
    };

    const report = { appUrl: APP_URL, browser: exe, console: consoleMsgs, steps: {} };

    // 1) 首屏 ready
    const loaded = once('Page.loadEventFired', S);
    await send('Page.navigate', { url: APP_URL }, S);
    await loaded;
    await sleep(400); // 首帧渲染落定
    report.steps.initial = await js(`(()=>{const q=s=>document.querySelector(s);const vis=e=>e&&e.offsetParent!==null;
      return { title: document.title,
        tiles: document.querySelectorAll('.tile').length,
        cCrit: q('#c-crit').textContent, cWarn: q('#c-warn').textContent, cAll: q('#c-all').textContent,
        inspVisible: !q('#insp-body').hidden, inspName: q('#insp-name').textContent, inspSince: q('#insp-since').textContent,
        feedRows: [...document.querySelectorAll('#feed li')].filter(li=>li.style.display!=='none').length,
        hOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth };})()`);
    report.steps.initial.shot = await shot('01-initial-load.png');

    // 2) 若干 tick 后（数值在变、布局不变）
    await sleep(8000);
    report.steps.afterTicks = await js(`(()=>{const t=document.querySelector('[data-id="pm.decline"]');
      return { clock: document.querySelector('#clock').textContent,
        declineVal: t.querySelector('.t-val').textContent,
        inspStillVisible: !document.querySelector('#insp-body').hidden };})()`);
    report.steps.afterTicks.shot = await shot('02-after-ticks.png');

    // 3) Esc → inspector 空态
    await key({ key: 'Escape', code: 'Escape', vk: 27 });
    report.steps.emptyInspector = await js(`(()=>({emptyVisible: !document.querySelector('#insp-empty').hidden}))()`);
    report.steps.emptyInspector.shot = await shot('03-empty-inspector.png');

    // 4) 点击 iv.lag 瓦片 → 追溯视图（真实鼠标事件）
    const c = await rectCenter('[data-id="iv.lag"]');
    if (!c) throw new Error('iv.lag tile not found (可能被滚动出视区，需先滚动)');
    await clickAt(c.x, c.y);
    report.steps.trace = await js(`(()=>{const q=s=>document.querySelector(s);
      return { name: q('#insp-name').textContent, badge: q('#insp-badge').textContent, since: q('#insp-since').textContent,
        hotD: (q('#insp-chart .ch-hot').getAttribute('d')||'').length };})()`);
    report.steps.trace.shot = await shot('04-inspector-trace.png');

    // 5) 键盘导航（Tab ×3 → 焦点可见）
    for (let i = 0; i < 3; i++) await key({ key: 'Tab', code: 'Tab', vk: 9 });
    report.steps.keyboard = await js(`(()=>{const a=document.activeElement;return { tag:a.tagName, cls:a.getAttribute('class'), label:a.getAttribute('aria-label')||a.textContent.slice(0,20) };})()`);
    report.steps.keyboard.shot = await shot('05-keyboard-focus.png');

    // 6) 危急过滤器（真实点击）
    const fc = await rectCenter('#sev-filter [data-sev="crit"]');
    await clickAt(fc.x, fc.y);
    report.steps.filterCrit = await js(`(()=>({ visibleTiles: document.querySelectorAll('.tile:not(.dim)').length,
      critCount: document.querySelector('#c-crit').textContent }))()`);
    report.steps.filterCrit.shot = await shot('06-filter-crit.png');

    // 7) 空格暂停（先让焦点落回 body）
    await js(`document.activeElement && document.activeElement.blur && document.activeElement.blur()`);
    await key({ key: ' ', code: 'Space', vk: 32 });
    report.steps.paused = await js(`(()=>({ hbLabel: document.querySelector('#hb-label').textContent }))()`);
    report.steps.paused.shot = await shot('07-paused.png');

    fs.writeFileSync(path.join(EVID, 'report.json'), JSON.stringify(report, null, 2));
    console.log('console messages:', JSON.stringify(consoleMsgs));
    console.log('REPORT WRITTEN');
    ws.close();
  } finally {
    proc.kill();
  }
}

main().then(() => process.exit(0)).catch(e => { console.error('EVIDENCE FAILED:', e); process.exit(1); });
