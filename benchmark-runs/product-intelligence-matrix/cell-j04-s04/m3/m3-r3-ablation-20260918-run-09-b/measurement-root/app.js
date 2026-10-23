'use strict';
/* ============================================================
 * app.js — 脉墙 PulseWall 渲染与交互
 * 核心纪律（对应验收种子"无闪烁噪声"）：
 *   - 所有瓦片 DOM 节点一次性创建，位置恒定（恒定 CSS grid）
 *   - 每个采样 tick 只做 textContent / 属性 / path d 的就地替换
 *   - 无入场动画、无节点重建、无布局抖动（等宽数字字体）
 * 状态所有权：mode→流引擎 | query→顶部过滤 | selection→墙+inspector
 * ============================================================ */

let paused = false;
let sevFilter = 'all';      // all | crit | warn
let groupFilter = 'all';
let selectedId = null;
let feed = [];              // {t, id, sev, kind, val} 最新在前
let feedDirty = false;
let statusDirty = false;

const byId = new Map();
const feedEls = [];         // 复用的 feed 行
const pointEls = [];        // 复用的采样明细行
const groupEls = new Map(); // groupId -> {sec, countEl, metrics:[]}
let tickTimer = null;

const $ = id => document.getElementById(id);
const ST_NAME = { ok: '正常', warn: '告警', crit: '危急' };

/* ================= 构建（一次性） ================= */

function buildWall() {
  const wall = $('wall');
  for (const g of GROUPS) {
    const sec = document.createElement('section');
    sec.className = 'group';
    sec.dataset.group = g.id;
    const head = document.createElement('header');
    head.className = 'group-head';
    const h2 = document.createElement('h2');
    h2.textContent = g.name;
    const cnt = document.createElement('span');
    cnt.className = 'g-count';
    head.append(h2, cnt);
    const tiles = document.createElement('div');
    tiles.className = 'tiles';
    sec.append(head, tiles);
    wall.append(sec);

    const rec = { sec, countEl: cnt, metrics: [] };
    groupEls.set(g.id, rec);

    for (const m of METRICS) {
      if (m.group !== g.id) continue;
      rec.metrics.push(m);

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tile';
      btn.dataset.id = m.id;
      btn.innerHTML =
        '<span class="t-top"><span class="t-name"></span><span class="t-badge"></span></span>' +
        '<span class="t-mid"><span class="t-val"></span><span class="t-unit">' + m.unit + '</span><span class="t-delta"></span></span>' +
        '<svg class="t-spark" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true">' +
        '<path class="sp-area"></path><path class="sp-line"></path>' +
        '<line class="th th-warn"></line><line class="th th-crit"></line></svg>';
      btn.querySelector('.t-name').textContent = m.name;
      btn.addEventListener('click', () => select(m.id));

      m.el = {
        tile: btn,
        name: btn.querySelector('.t-name'),
        val: btn.querySelector('.t-val'),
        delta: btn.querySelector('.t-delta'),
        badge: btn.querySelector('.t-badge'),
        spLine: btn.querySelector('.sp-line'),
        spArea: btn.querySelector('.sp-area'),
        thW: btn.querySelector('.th-warn'),
        thC: btn.querySelector('.th-crit'),
      };
      tiles.append(btn);
      byId.set(m.id, m);
    }
  }
}

function buildGroupFilter() {
  const nav = $('group-filter');
  const defs = [{ id: 'all', name: '全部分组' }].concat(GROUPS);
  for (const g of defs) {
    const b = document.createElement('button');
    b.dataset.group = g.id;
    b.textContent = g.name;
    b.classList.toggle('on', g.id === groupFilter);
    b.setAttribute('aria-pressed', String(g.id === groupFilter));
    b.addEventListener('click', () => {
      groupFilter = g.id;
      for (const x of nav.children) {
        x.classList.toggle('on', x === b);
        x.setAttribute('aria-pressed', String(x === b));
      }
      applyFilter();
    });
    nav.append(b);
  }
}

function buildFeedRows() {
  const ol = $('feed');
  for (let i = 0; i < FEED_MAX; i++) {
    const li = document.createElement('li');
    li.innerHTML = '<time></time><span class="fe-chip"></span><button type="button" class="fe-name"></button><span class="fe-desc"></span>';
    li.querySelector('.fe-name').addEventListener('click', () => {
      const f = feed[i];
      if (f) select(f.id);
    });
    ol.append(li);
    feedEls.push({
      li,
      time: li.querySelector('time'),
      chip: li.querySelector('.fe-chip'),
      name: li.querySelector('.fe-name'),
      desc: li.querySelector('.fe-desc'),
    });
  }
}

function buildPointRows() {
  const ol = $('insp-points');
  for (let i = 0; i < POINTS_SHOWN; i++) {
    const li = document.createElement('li');
    li.innerHTML = '<time></time><span class="p-val"></span><span class="p-delta"></span><span class="p-st"></span>';
    ol.append(li);
    pointEls.push({
      li,
      time: li.querySelector('time'),
      val: li.querySelector('.p-val'),
      delta: li.querySelector('.p-delta'),
      st: li.querySelector('.p-st'),
    });
  }
}

/* ================= 就地更新 ================= */

/* 瓦片 sparkline / inspector 大图共用的纵轴映射 */
function vScale(m, h, topPad, botPad) {
  const vals = m.vals;
  let mn = Infinity, mx = -Infinity;
  for (const v of vals) { if (v < mn) mn = v; if (v > mx) mx = v; }
  const range = (mx - mn) || Math.max(m.amp, 1e-9);
  mn -= range * 0.06; mx += range * 0.06;
  const r2 = mx - mn;
  return {
    y: v => topPad + (1 - (v - mn) / r2) * (h - topPad - botPad),
    yOf(th) { const y = this.y(th); return (y >= topPad - 1 && y <= h - botPad + 1) ? y : null; },
  };
}

function linePath(pts) {
  let d = '';
  for (let i = 0; i < pts.length; i++) {
    d += (i ? 'L' : 'M') + pts[i][0].toFixed(2) + ' ' + pts[i][1].toFixed(2);
    if (i < pts.length - 1) d += ' ';
  }
  return d;
}

function updateSparkline(m) {
  const n = m.vals.length;
  const s = vScale(m, 30, 3, 3);
  const pts = m.vals.map((v, i) => [i / (n - 1) * 100, s.y(v)]);
  const d = linePath(pts);
  m.el.spLine.setAttribute('d', d);
  m.el.spArea.setAttribute('d', d + ' L100 30 L0 30 Z');
  for (const [elm, th] of [[m.el.thW, m.warn], [m.el.thC, m.crit]]) {
    const y = s.yOf(th);
    if (y === null) { elm.classList.remove('show'); continue; }
    elm.setAttribute('y1', y.toFixed(2));
    elm.setAttribute('y2', y.toFixed(2));
    elm.classList.add('show');
  }
}

function updateTile(m) {
  const el = m.el;
  el.val.textContent = fmtVal(m, m.cur);

  const ref = m.vals[m.vals.length - 1 - DELTA_LAG];
  const d = m.cur - ref;
  el.delta.textContent = (d > 0 ? '▲ ' : d < 0 ? '▼ ' : '· ') + fmtVal(m, Math.abs(d));
  const bad = m.dir === 'above' ? d > 0 : d < 0;
  el.delta.classList.toggle('bad', bad);
  el.delta.classList.toggle('good', d !== 0 && !bad);

  el.badge.textContent = ST_NAME[m.status];
  const tile = el.tile;
  tile.classList.toggle('st-ok', m.status === 'ok');
  tile.classList.toggle('st-warn', m.status === 'warn');
  tile.classList.toggle('st-crit', m.status === 'crit');
  tile.setAttribute('aria-label', m.name + ' ' + fmtVal(m, m.cur) + ' ' + m.unit + '，' + ST_NAME[m.status]);

  updateSparkline(m);
}

/* ---------- 顶部计数 ---------- */
function updateCounts() {
  let c = 0, w = 0;
  for (const m of METRICS) { if (m.status === 'crit') c++; else if (m.status === 'warn') w++; }
  $('c-crit').textContent = c;
  $('c-warn').textContent = w;
  $('c-all').textContent = METRICS.length - c - w;
}

function updateGroupCounts() {
  for (const [, rec] of groupEls) {
    let c = 0, w = 0;
    for (const m of rec.metrics) { if (m.status === 'crit') c++; else if (m.status === 'warn') w++; }
    const parts = [];
    if (c) parts.push('<b class="n-crit">' + c + ' 危急</b>');
    if (w) parts.push('<b class="n-warn">' + w + ' 告警</b>');
    parts.push((rec.metrics.length - c - w) + ' 正常');
    rec.countEl.innerHTML = parts.join(' · ');
  }
}

/* ---------- 异常事件流 ---------- */
function updateFeed() {
  for (let i = 0; i < FEED_MAX; i++) {
    const el = feedEls[i];
    const f = feed[i];
    if (!f) { el.li.style.display = 'none'; continue; }
    el.li.style.display = '';
    const m = byId.get(f.id);
    el.li.classList.remove('fe-empty');
    el.time.textContent = fmtTime(f.t);
    el.chip.textContent = f.kind === 'recover' ? '恢复' : ST_NAME[f.sev];
    el.chip.className = 'fe-chip ' + (f.kind === 'recover' ? 'ok' : f.sev);
    el.name.textContent = m.name;
    el.desc.textContent = f.kind === 'recover'
      ? '回到正常区间'
      : (m.dir === 'above' ? '越过' : '跌破') + ST_NAME[f.sev] + '阈值 ' + fmtVal(m, f.val) + m.unit;
  }
}

function pushEvent(ev) {
  feed.unshift(ev);
  if (feed.length > FEED_MAX) feed.length = FEED_MAX;
  updateFeed();
}

/* ---------- Inspector ---------- */
function anomalySince(m) {
  // 从最新点回溯状态连续段起点：异常"始于何时"即由此得出（变化可追溯的核心）
  let i = m.vals.length - 1;
  while (i > 0 && statusOf(m, m.vals[i - 1]) === m.status) i--;
  return { idx: i, t: m.times[i] };
}

function renderInspector() {
  const empty = $('insp-empty'), body = $('insp-body');
  if (!selectedId) { empty.hidden = false; body.hidden = true; return; }
  empty.hidden = true; body.hidden = false;

  const m = byId.get(selectedId);
  $('insp-name').textContent = m.name;
  const badge = $('insp-badge');
  badge.textContent = ST_NAME[m.status];
  badge.className = 't-badge b-' + m.status;
  $('insp-group').textContent = GROUPS.find(g => g.id === m.group).name;
  const cmp = m.dir === 'above' ? '≥' : '≤';
  $('insp-thr').textContent = '告警 ' + cmp + m.warn + m.unit + ' · 危急 ' + cmp + m.crit + m.unit;

  const since = anomalySince(m);
  const sinceEl = $('insp-since');
  if (m.status === 'ok') {
    sinceEl.textContent = '✓ 处于正常区间';
    sinceEl.className = 'insp-since ok';
  } else {
    const dur = Math.max(0, Math.round((Date.now() - since.t) / 1000));
    const mm = Math.floor(dur / 60), ss = dur % 60;
    sinceEl.textContent = '异常自 ' + fmtTime(since.t) + ' 起，已持续 ' + mm + ':' + String(ss).padStart(2, '0');
    sinceEl.className = 'insp-since';
  }

  // 大轨迹图
  const n = m.vals.length;
  const s = vScale(m, 130, 5, 5);
  const pts = m.vals.map((v, i) => [i / (n - 1) * 360, s.y(v)]);
  const d = linePath(pts);
  $('insp-chart').querySelector('.ch-area').setAttribute('d', d + ' L360 130 L0 130 Z');
  $('insp-chart').querySelector('.ch-line').setAttribute('d', d);
  const hot = $('insp-chart').querySelector('.ch-hot');
  if (m.status === 'ok') { hot.setAttribute('d', ''); }
  else {
    hot.setAttribute('d', linePath(pts.slice(since.idx)));
    hot.classList.toggle('warn-hot', m.status === 'warn');
  }
  for (const [elm, th] of [['.th-warn', m.warn], ['.th-crit', m.crit]]) {
    const line = $('insp-chart').querySelector(elm);
    const y = s.yOf(th);
    if (y === null) { line.classList.remove('show'); continue; }
    line.setAttribute('y1', y.toFixed(2));
    line.setAttribute('y2', y.toFixed(2));
    line.classList.add('show');
  }

  // 逐点采样明细（最新在前）
  for (let r = 0; r < POINTS_SHOWN; r++) {
    const i = n - 1 - r;
    const el = pointEls[r];
    const v = m.vals[i];
    const prev = m.vals[i - 1];
    const dv = prev === undefined ? 0 : v - prev;
    el.time.textContent = fmtTime(m.times[i]);
    el.val.textContent = fmtVal(m, v) + ' ' + m.unit;
    el.delta.textContent = (dv >= 0 ? '+' : '-') + fmtVal(m, Math.abs(dv));
    const st = statusOf(m, v);
    el.st.textContent = ST_NAME[st];
    el.li.classList.toggle('is-crit', st === 'crit');
    el.li.classList.toggle('is-warn', st === 'warn');
  }
}

function select(id) {
  selectedId = id;
  for (const m of METRICS) m.el.tile.classList.toggle('sel', m.id === id);
  renderInspector();
}

/* ---------- 过滤（置灰保位，不做隐藏重排 → 位置语义恒定） ---------- */
function applyFilter() {
  for (const [, rec] of groupEls) {
    let anyVisible = false;
    for (const m of rec.metrics) {
      const vis = (sevFilter === 'all' || m.status === sevFilter) &&
                  (groupFilter === 'all' || m.group === groupFilter);
      m.el.tile.classList.toggle('dim', !vis);
      if (vis) anyVisible = true;
    }
    rec.sec.classList.toggle('dim', !anyVisible);
  }
}

function buildSevFilter() {
  const nav = $('sev-filter');
  for (const b of nav.querySelectorAll('button')) {
    b.addEventListener('click', () => {
      sevFilter = b.dataset.sev;
      for (const x of nav.querySelectorAll('button')) {
        x.classList.toggle('on', x === b);
        x.setAttribute('aria-pressed', String(x === b));
      }
      applyFilter();
    });
  }
}

/* ================= 流引擎 ================= */

function scanInitialEvents() {
  // 遍历初始历史，重放状态迁移 → 事件流与轨迹逐点一致（可追溯）
  for (const m of METRICS) {
    let prev = statusOf(m, m.vals[0]);
    for (let i = 1; i < m.vals.length; i++) {
      const st = statusOf(m, m.vals[i]);
      if (st !== prev) {
        feed.push({ t: m.times[i], id: m.id, sev: st, kind: st === 'ok' ? 'recover' : 'breach', val: m.vals[i] });
        prev = st;
      }
    }
  }
  feed.sort((a, b) => b.t - a.t);
  feed.length = Math.min(feed.length, FEED_MAX);
}

function tick() {
  const now = Date.now();
  for (const m of METRICS) {
    const v = nextValue(m);
    m.vals.push(v); m.vals.shift();
    m.times.push(now); m.times.shift();
    m.cur = v;
    const st = statusOf(m, v);
    if (st !== m.status) {
      pushEvent({ t: now, id: m.id, sev: st, kind: st === 'ok' ? 'recover' : 'breach', val: v });
      m.status = st;
      statusDirty = true;
    }
    updateTile(m);
  }
  if (statusDirty) { updateGroupCounts(); statusDirty = false; }
  updateCounts();
  const clock = $('clock');
  clock.textContent = fmtTime(now);
  clock.setAttribute('datetime', new Date(now).toISOString());
  if (selectedId) renderInspector(); // 就地刷新选中指标（仅 textContent/属性替换）
}

function startStream() {
  tickTimer = setInterval(tick, TICK_MS);
}

function setPaused(p) {
  paused = p;
  $('hb').classList.toggle('paused', p);
  $('hb-label').textContent = p ? 'PAUSED' : 'LIVE';
  const btn = $('pause-btn');
  btn.setAttribute('aria-pressed', String(p));
  $('pause-label').textContent = p ? '恢复' : '暂停';
  btn.querySelector('.pause-glyph').textContent = p ? '▶' : '▍▍';
}

/* ================= 键盘 ================= */

document.addEventListener('keydown', e => {
  const onWidget = e.target instanceof HTMLButtonElement && !e.target.classList.contains('tile');
  if (e.code === 'Space' && !e.repeat && !onWidget) {
    e.preventDefault(); // 焦点在瓦片或页面上时空格归全局暂停；过滤/暂停按钮保留原生行为
    setPaused(!paused);
  } else if (e.key === 'Escape' && selectedId) {
    select(null);
  }
});

/* ================= 启动：同步完成 → 首屏即 ready ================= */

(function init() {
  const now = Date.now();
  buildInitialState(now);   // data.js：24 指标 × 90 点初始历史
  buildWall();
  buildGroupFilter();
  buildSevFilter();
  buildFeedRows();
  buildPointRows();
  scanInitialEvents();

  for (const m of METRICS) updateTile(m);
  updateCounts();
  updateGroupCounts();
  updateFeed();
  $('clock').textContent = fmtTime(now);

  // 初始选中：最近一次异常事件对应的指标 → 首屏即展示"变化追溯"
  const hottest = feed.find(f => f.sev === 'crit') || feed[0];
  select(hottest ? hottest.id : METRICS[0].id);

  startStream();
})();
