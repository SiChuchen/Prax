/* ============================================================
 * PulseWall · app.js — 视图与交互（无框架、无依赖）
 * 渲染契约（SDIR）：
 *  - 网格结构仅首次构建，瓦片位置恒定不重排（fixed-grid-no-reflow）
 *  - 数值原位更新 + 短时高亮后静止（in-place-update）
 *  - 异常以色彩 + 异常条聚拢表达显著性（anomaly-strip）
 *  - 选中 → 检查器展示带时间戳证据链（trace-inspector）
 * ============================================================ */
(function () {
  'use strict';
  const S = window.PulseStream;
  const $ = function (id) { return document.getElementById(id); };

  const els = {};          // metricId -> 瓦片节点引用
  let selectedId = null;
  let paused = false;
  let filterAnomalyOnly = false;
  let lastFeedT = 0;       // 已渲染到的事件时间水位
  let lastStripSig = '';
  let lastBumpV = {};      // metricId -> 上次触发高亮的值
  let inspHistoryRows = 0;

  const SEV_RANK = { crit: 0, warn: 1, info: 2, ok: 3 };

  /* ---------- 瓦片构建（一次构建，永不重建结构） ---------- */
  function sparkSvg() {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 100 26');
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('class', 'spark');
    svg.setAttribute('aria-hidden', 'true');
    const base = document.createElementNS(ns, 'line');
    base.setAttribute('class', 'sp-base');
    base.setAttribute('x1', '0'); base.setAttribute('x2', '100');
    const poly = document.createElementNS(ns, 'polyline');
    svg.appendChild(base); svg.appendChild(poly);
    return { svg: svg, poly: poly, base: base };
  }

  function buildGrid() {
    const wall = $('region-metric-grid');
    const frag = document.createDocumentFragment();
    S.DOM_ORDER.forEach(function (dom) {
      const metrics = S.METRICS.filter(function (m) { return m.dom === dom; });
      const g = document.createElement('div');
      g.className = 'group';
      const h = document.createElement('h2');
      h.className = 'group-h';
      h.innerHTML = '<span>' + S.DOM_LABELS[dom] + '</span><span class="g-line"></span><span class="g-count">' +
        metrics.map(function (m) { return m.id; }).join(' · ') + '</span>';
      g.appendChild(h);
      const tiles = document.createElement('div');
      tiles.className = 'tiles';
      metrics.forEach(function (m) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'tile st-ok';
        b.dataset.id = m.id;
        b.setAttribute('aria-label', m.name + '，状态正常');
        const sp = sparkSvg();
        b.innerHTML =
          '<span class="t-top"><span class="t-name">' + m.name + '</span><span class="t-dom">' + m.id + '</span></span>' +
          '<span class="t-mid"><span class="t-val">--</span><span class="t-unit">' + m.unit + '</span><span class="t-delta">—</span></span>';
        b.appendChild(sp.svg);
        tiles.appendChild(b);
        els[m.id] = { tile: b, val: b.querySelector('.t-val'), unit: b.querySelector('.t-unit'),
                      delta: b.querySelector('.t-delta'), poly: sp.poly, base: sp.base, lastText: '', lastDelta: '' };
        b.addEventListener('click', function () { select(m.id); });
      });
      g.appendChild(tiles);
      frag.appendChild(g);
    });
    wall.appendChild(frag);
  }

  /* ---------- sparkline / 大图几何 ---------- */
  function pointsFor(m, w, h, pad) {
    const s = S.state[m.id];
    const vs = s.samples.map(function (p) { return p.v; });
    let lo = Math.min.apply(null, vs.concat([s.th.warn, s.th.crit, m.base]));
    let hi = Math.max.apply(null, vs.concat([s.th.warn, s.th.crit, m.base]));
    const span = (hi - lo) || Math.abs(m.base) * 0.1;
    lo -= span * 0.08; hi += span * 0.08;
    const n = vs.length;
    let pts = '';
    for (let i = 0; i < n; i++) {
      const x = (i / (S.WINDOW - 1)) * w;
      const y = pad + (1 - (vs[i] - lo) / (hi - lo)) * (h - pad * 2);
      pts += x.toFixed(2) + ',' + y.toFixed(2) + ' ';
    }
    return { pts: pts, lo: lo, hi: hi, n: n };
  }

  function yOf(v, lo, hi, h, pad) { return pad + (1 - (v - lo) / (hi - lo)) * (h - pad * 2); }

  function renderSpark(id) {
    const m = byId(id);
    const e = els[id];
    const g = pointsFor(m, 100, 26, 2);
    e.poly.setAttribute('points', g.pts);
    e.base.setAttribute('y1', yOf(m.base, g.lo, g.hi, 26, 2).toFixed(2));
    e.base.setAttribute('y2', e.base.getAttribute('y1'));
  }

  /* ---------- 每秒原位更新 ---------- */
  function byId(id) { return S.METRICS.find(function (m) { return m.id === id; }); }

  function fmtClock(t) {
    const d = new Date(t);
    const p = function (x) { return (x < 10 ? '0' : '') + x; };
    return p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
  }

  function fmtDur(ms) {
    const s = Math.max(0, Math.floor(ms / 1000));
    return Math.floor(s / 60) + ':' + (s % 60 < 10 ? '0' : '') + (s % 60);
  }

  function tickRender(now) {
    // 头部
    $('hdr-clock').textContent = fmtClock(now);
    let abn = 0;
    S.METRICS.forEach(function (m) { if (S.state[m.id].status !== 'ok') abn++; });
    $('hdr-stats').textContent = '异常 ' + abn + '/' + S.METRICS.length + ' · 转换 ' + S.transitions();

    // 瓦片原位更新
    S.METRICS.forEach(function (m) {
      const e = els[m.id];
      const s = S.state[m.id];
      const cur = s.samples[s.samples.length - 1];
      const txt = S.fmt(m, cur.v);
      if (txt !== e.lastText) {
        e.val.textContent = txt;
        // 短高亮：只有超过噪声底的变化才标记（区分信号与噪声）
        const lb = lastBumpV[m.id];
        if (lb === undefined) { lastBumpV[m.id] = cur.v; }
        else if (Math.abs(cur.v - lb) >= m.base * 0.035) {
          e.val.classList.remove('bump');
          void e.val.offsetWidth;
          e.val.classList.add('bump');
          lastBumpV[m.id] = cur.v;
        }
        e.lastText = txt;
      }
      // Δ vs 60s 前
      const old = s.samples.length > 60 ? s.samples[s.samples.length - 61].v : s.samples[0].v;
      const pct = old !== 0 ? ((cur.v - old) / Math.abs(old)) * 100 : 0;
      const dtxt = (pct >= 0 ? '▲' : '▼') + Math.abs(pct).toFixed(1) + '%';
      if (dtxt !== e.lastDelta) {
        e.delta.textContent = dtxt;
        e.delta.className = 't-delta ' + (pct >= 0 ? 'up' : 'down');
        e.lastDelta = dtxt;
      }
      // 状态色：仅跃迁时改类
      const cls = 'tile st-' + s.status + (selectedId === m.id ? ' sel' : '');
      if (e.tile.className !== cls) {
        e.tile.className = cls;
        e.tile.setAttribute('aria-label', m.name + '，状态' + ({ ok: '正常', warn: '警告', crit: '严重', info: '恢复中' }[s.status]));
      }
      renderSpark(m.id);
    });

    renderStrip(now);
    renderFeed();
    if (selectedId) updateInspectorLive(now);
  }

  /* ---------- 异常条：成员/排序变化才重建 ---------- */
  function renderStrip(now) {
    const strip = $('region-anomaly-strip');
    const body = $('strip-body');
    const items = [];
    S.METRICS.forEach(function (m) {
      const s = S.state[m.id];
      if (s.status !== 'ok') {
        items.push({ m: m, st: s.status, since: s.sinceT, v: s.samples[s.samples.length - 1].v });
      }
    });
    items.sort(function (a, b) { return SEV_RANK[a.st] - SEV_RANK[b.st] || a.since - b.since; });
    const sig = items.map(function (x) { return x.m.id + ':' + x.st; }).join('|');
    const isOk = items.length === 0;
    strip.classList.toggle('is-ok', isOk);
    if (sig !== lastStripSig) {
      lastStripSig = sig;
      body.innerHTML = '';
      if (isOk) {
        const note = document.createElement('span');
        note.className = 'strip-note';
        body.appendChild(note);
      } else {
        items.forEach(function (x) {
          const c = document.createElement('button');
          c.type = 'button';
          c.className = 'chip st-' + x.st;
          c.dataset.id = x.m.id;
          c.innerHTML =
            '<span class="c-dot"></span><span class="c-name">' + x.m.name + '</span>' +
            '<span class="c-val">' + S.fmt(x.m, x.v) + x.m.unit + '</span><span class="c-dur"></span>';
          c.setAttribute('aria-label', x.m.name + ' 异常，点击查看');
          c.addEventListener('click', function () { select(x.m.id); });
          body.appendChild(c);
        });
      }
    }
    // 仅原位刷新动态字段（值/持续时长/安静摘要时钟）
    if (isOk) {
      const note = body.firstChild;
      if (note) note.textContent = '✓ 全部 ' + S.METRICS.length + ' 项指标正常 · 最近检查 ' + fmtClock(now);
    } else {
      const chips = body.querySelectorAll('.chip');
      items.forEach(function (x, i) {
        const c = chips[i];
        if (!c || c.dataset.id !== x.m.id) return;
        c.querySelector('.c-val').textContent = S.fmt(x.m, x.v) + x.m.unit;
        c.querySelector('.c-dur').textContent = fmtDur(now - x.since);
      });
    }
  }

  /* ---------- 事件流：只追加新事件（无 auto-scroll） ---------- */
  function evNode(ev) {
    const li = document.createElement('li');
    li.className = 'ev-' + ev.kind;
    li.dataset.kind = ev.kind;
    li.dataset.id = ev.id;
    li.innerHTML =
      '<span class="e-t">' + fmtClock(ev.t) + '</span><span class="e-dot"></span>' +
      '<span class="e-name">' + ev.name + '</span><span class="e-msg">' + ev.msg + '</span>';
    li.setAttribute('role', 'button');
    li.tabIndex = 0;
    li.addEventListener('click', function () { select(ev.id); });
    li.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(ev.id); }
    });
    return li;
  }

  function renderFeed() {
    const list = $('feed-list');
    const evs = S.events;
    // 找出未渲染的新事件（events unshift 在前；水位之前的不重复渲染）
    const fresh = evs.filter(function (ev) { return ev.t > lastFeedT; });
    if (fresh.length) {
      lastFeedT = evs[0].t;
      for (let i = fresh.length - 1; i >= 0; i--) {
        list.insertBefore(evNode(fresh[i]), list.firstChild);
      }
      while (list.children.length > 60) list.removeChild(list.lastChild);
      applyFilter();
    }
    // empty 状态
    const visible = list.querySelectorAll('li:not([hidden])').length;
    let empty = document.getElementById('feed-empty');
    if (visible === 0) {
      if (!empty) {
        empty = document.createElement('div');
        empty.id = 'feed-empty';
        empty.className = 'feed-empty';
        list.parentNode.appendChild(empty);
      }
      empty.textContent = filterAnomalyOnly ? '无异常事件（过滤：仅看异常）' : '暂无事件';
    } else if (empty) {
      empty.remove();
    }
  }

  function applyFilter() {
    const list = $('feed-list');
    list.querySelectorAll('li').forEach(function (li) {
      li.hidden = filterAnomalyOnly && (li.dataset.kind === 'ok');
    });
  }

  /* ---------- 检查器 ---------- */
  function historyRows(m) {
    const s = S.state[m.id];
    const rows = [];
    // 状态跃迁事件
    S.events.forEach(function (ev) {
      if (ev.id !== m.id) return;
      rows.push({ t: ev.t, v: ev.v, kind: ev.kind, note: ev.msg });
    });
    // 采样点（10s 粒度 + 最新）
    const samples = s.samples;
    for (let i = samples.length - 1; i >= 0; i -= 10) {
      const p = samples[i];
      if (!rows.some(function (r) { return Math.abs(r.t - p.t) < 500; })) {
        rows.push({ t: p.t, v: p.v, kind: null, note: '采样' });
      }
    }
    rows.sort(function (a, b) { return b.t - a.t; });
    return rows.slice(0, 40);
  }

  function renderInspectorChart() {
    const m = byId(selectedId);
    const box = $('insp-chart');
    const W = 300, H = 110, pad = 8;
    const s = S.state[m.id];
    const g = pointsFor(m, W, H, pad);
    const yw = yOf(s.th.warn, g.lo, g.hi, H, pad);
    const yc = yOf(s.th.crit, g.lo, g.hi, H, pad);
    const yb = yOf(m.base, g.lo, g.hi, H, pad);
    const warnBandTop = Math.min(yw, yc), warnBandH = Math.abs(yc - yw);
    let svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" role="img" aria-label="走势图含阈值带">';
    svg += '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="rgba(255,255,255,0.02)"/>';
    svg += '<rect x="0" y="' + warnBandTop.toFixed(1) + '" width="' + W + '" height="' + warnBandH.toFixed(1) + '" fill="rgba(217,166,46,0.10)"/>';
    if (m.dir > 0) svg += '<rect x="0" y="' + yc.toFixed(1) + '" width="' + W + '" height="' + Math.max(0, H - yc).toFixed(1) + '" fill="rgba(244,81,91,0.12)"/>';
    else svg += '<rect x="0" y="0" width="' + W + '" height="' + Math.max(0, yc).toFixed(1) + '" fill="rgba(244,81,91,0.12)"/>';
    svg += '<line x1="0" x2="' + W + '" y1="' + yb.toFixed(1) + '" y2="' + yb.toFixed(1) + '" stroke="#2a3644" stroke-dasharray="3 4"/>';
    svg += '<line x1="0" x2="' + W + '" y1="' + yw.toFixed(1) + '" y2="' + yw.toFixed(1) + '" stroke="#d9a62e" stroke-dasharray="4 3" stroke-width="1"/>';
    svg += '<line x1="0" x2="' + W + '" y1="' + yc.toFixed(1) + '" y2="' + yc.toFixed(1) + '" stroke="#f4515b" stroke-dasharray="4 3" stroke-width="1"/>';
    svg += '<polyline points="' + g.pts + '" fill="none" stroke="' +
      ({ ok: '#3fb950', warn: '#d9a62e', crit: '#f4515b', info: '#4cb3ff' }[s.status]) + '" stroke-width="1.8"/>';
    svg += '</svg>';
    box.innerHTML = svg;
  }

  function renderInspectorHistory(now) {
    const m = byId(selectedId);
    const ol = $('insp-history');
    const keepScroll = ol.scrollTop; // 重建时保持阅读位置
    ol.innerHTML = '';
    const rows = historyRows(m);
    inspHistoryRows = rows.length;
    const cur = S.state[m.id].samples[S.state[m.id].samples.length - 1];
    const live = document.createElement('li');
    live.className = 'ev-' + S.state[m.id].status;
    live.innerHTML = '<span class="h-t">' + fmtClock(now) + '</span><span class="h-v">' + S.fmt(m, cur.v) + m.unit + '</span>' +
      '<span class="h-note">当前 · ' + ({ ok: '正常', warn: '警告', crit: '严重', info: '恢复中' }[S.state[m.id].status]) +
      ' · 持续 ' + fmtDur(now - S.state[m.id].sinceT) + '</span>';
    ol.appendChild(live);
    rows.forEach(function (r) {
      const li = document.createElement('li');
      if (r.kind) li.className = 'ev-' + r.kind;
      li.innerHTML = '<span class="h-t">' + fmtClock(r.t) + '</span>' +
        '<span class="h-v">' + (r.v !== undefined && r.v !== null ? S.fmt(m, r.v) + m.unit : '—') + '</span>' +
        '<span class="h-note">' + r.note + '</span>';
      ol.appendChild(li);
    });
    ol.scrollTop = keepScroll;
  }

  function select(id) {
    if (selectedId === id) return;
    if (selectedId && els[selectedId]) els[selectedId].tile.classList.remove('sel');
    selectedId = id;
    const m = byId(id);
    const s = S.state[id];
    els[id].tile.classList.add('sel');
    $('region-inspector').hidden = false;
    $('insp-dot').className = 'dot';
    $('insp-dot').style.background = { ok: 'var(--ok)', warn: 'var(--warn)', crit: 'var(--crit)', info: 'var(--info)' }[s.status];
    $('insp-name').textContent = m.name;
    $('insp-badge').className = 'badge st-' + s.status;
    $('insp-badge').textContent = { ok: 'NORMAL', warn: 'WARNING', crit: 'CRITICAL', info: 'RECOVER' }[s.status];
    $('insp-meta').textContent = m.id + ' · ' + S.DOM_LABELS[m.dom] + ' · ' + (m.dir > 0 ? '越高越坏' : '越低越坏');
    $('insp-thresholds').textContent = '基线 ' + S.fmt(m, m.base) + m.unit +
      ' · 警告 ≥ ' + S.fmt(m, s.th.warn) + ' · 严重 ≥ ' + S.fmt(m, s.th.crit);
    renderInspectorChart();
    renderInspectorHistory(Date.now());
    updateInspectorLive(Date.now());
  }

  function updateInspectorLive(now) {
    const m = byId(selectedId);
    const s = S.state[selectedId];
    const cur = s.samples[s.samples.length - 1];
    $('insp-value').innerHTML = S.fmt(m, cur.v) + ' <small>' + m.unit + '</small>';
    $('insp-badge').className = 'badge st-' + s.status;
    $('insp-badge').textContent = { ok: 'NORMAL', warn: 'WARNING', crit: 'CRITICAL', info: 'RECOVER' }[s.status];
    $('insp-dot').style.background = { ok: 'var(--ok)', warn: 'var(--warn)', crit: 'var(--crit)', info: 'var(--info)' }[s.status];
    renderInspectorChart();
    // 事件数变化才重建历史（避免读历史时列表跳动）
    const rows = historyRows(m);
    if (rows.length !== inspHistoryRows) renderInspectorHistory(now);
    else {
      const live = $('insp-history').firstChild;
      if (live) {
        live.className = 'ev-' + s.status;
        live.querySelector('.h-t').textContent = fmtClock(now);
        live.querySelector('.h-v').textContent = S.fmt(m, cur.v) + m.unit;
      }
    }
  }

  function clearSelection() {
    if (!selectedId) return;
    if (els[selectedId]) els[selectedId].tile.classList.remove('sel');
    selectedId = null;
    $('region-inspector').hidden = true;
  }

  /* ---------- 控制：暂停 / 注入 / 过滤 ---------- */
  function setPaused(p) {
    paused = p;
    S.setRunning(!p);
    document.body.classList.toggle('paused', p);
    $('btn-pause').textContent = p ? '▶ 恢复' : '⏸ 暂停';
    $('hb-label').textContent = p ? 'PAUSED' : 'LIVE · 1Hz';
  }

  /* ---------- 启动（同步完成：首屏即满数据，无加载态） ---------- */
  function boot() {
    buildGrid();
    S.METRICS.forEach(function (m) { renderSpark(m.id); });
    tickRender(Date.now());

    $('btn-pause').addEventListener('click', function () { setPaused(!paused); });
    $('btn-inject').addEventListener('click', function () {
      const id = S.inject();
      if (id) tickRender(Date.now()); // 新事件由 renderFeed 依水位自动拾取
    });
    $('btn-filter').addEventListener('click', function () {
      filterAnomalyOnly = !filterAnomalyOnly;
      $('btn-filter').setAttribute('aria-pressed', String(filterAnomalyOnly));
      applyFilter();
      renderFeed();
    });
    $('insp-close').addEventListener('click', clearSelection);

    document.addEventListener('keydown', function (e) {
      const tag = (e.target.tagName || '').toLowerCase();
      if (e.key === 'Escape') { clearSelection(); return; }
      if (e.key === ' ' && (tag === 'body' || tag === 'html')) {
        e.preventDefault();
        setPaused(!paused);
      }
    });

    // 主循环：1Hz 推进 + 原位渲染
    setInterval(function () {
      const now = Date.now();
      if (!paused) {
        S.tick(now);
        tickRender(now);
      } else {
        $('hdr-clock').textContent = fmtClock(now); // 时钟独立于流
      }
    }, 1000);

    // 看门狗：流意外中断 → error 状态（真实代码路径）
    setInterval(function () {
      if (paused) return;
      if (Date.now() - S.lastTickAt() > 4000) {
        $('hdr-alert').textContent = '⚠ 数据流中断，尝试恢复…';
        if (!boot._errFed) {
          boot._errFed = true;
          S.events.unshift({ t: Date.now(), id: '', name: '系统', unit: '', kind: 'inject', msg: '数据流中断（看门狗）' });
          renderFeed();
        }
        S.setRunning(true); // 重新拉起
      } else {
        $('hdr-alert').textContent = '';
        boot._errFed = false;
      }
    }, 2000);
  }

  boot();

  /* ---------- 演示/取证钩子（?scenario=…；不影响正常使用） ----------
   * boot / inspect / paused / filter / stability
   * 供自动化证据采集：以 JSON 写入 #__evidence（display:none）。 */
  function snapRects() {
    return Array.prototype.map.call(document.querySelectorAll('.tile'), function (t) {
      const r = t.getBoundingClientRect();
      return { id: t.dataset.id, x: Math.round(r.left * 10) / 10, y: Math.round(r.top * 10) / 10,
               w: Math.round(r.width * 10) / 10, h: Math.round(r.height * 10) / 10 };
    });
  }
  function evWrite(obj, id) {
    let el = document.getElementById(id || '__evidence');
    if (!el) { el = document.createElement('div'); el.id = id || '__evidence'; el.style.display = 'none'; document.body.appendChild(el); }
    el.textContent = JSON.stringify(obj);
  }
  window.__pw = { rects: snapRects,
    select: function (id) { select(id); },
    paused: function (p) { setPaused(p); } };

  (function () {
    let sc = null;
    try { sc = new URLSearchParams(location.search).get('scenario'); } catch (e) { /* file:// 老浏览器 */ }
    if (!sc) return;
    if (sc === 'boot') {
      const vals = Array.prototype.map.call(document.querySelectorAll('.tile .t-val'), function (e) { return e.textContent; });
      evWrite({
        tiles: vals.length,
        withValues: vals.filter(function (t) { return t && t !== '--'; }).length,
        stripChips: document.querySelectorAll('#strip-body .chip').length,
        stripList: Array.prototype.map.call(document.querySelectorAll('#strip-body .chip'), function (c) { return c.dataset.id + ':' + c.className; }),
        feedRows: document.querySelectorAll('#feed-list li').length,
        loadingPlaceholders: document.querySelectorAll('.skeleton,.loading,.spinner').length
      });
    } else if (sc === 'inspect') {
      select('svc.queue');
      evWrite({
        inspectorHidden: document.getElementById('region-inspector').hidden,
        historyRows: document.querySelectorAll('#insp-history li').length,
        historyHasTimestamps: Array.prototype.slice.call(document.querySelectorAll('#insp-history .h-t'), 0, 5).map(function (e) { return e.textContent; }),
        chartSvg: !!document.querySelector('#insp-chart svg')
      });
    } else if (sc === 'paused') {
      setPaused(true);
      evWrite({ hbLabel: document.getElementById('hb-label').textContent, pausedClass: document.body.className });
    } else if (sc === 'filter') {
      filterAnomalyOnly = true;
      $('btn-filter').setAttribute('aria-pressed', 'true');
      applyFilter();
      const lis = Array.prototype.slice.call(document.querySelectorAll('#feed-list li'));
      evWrite({ pressed: $('btn-filter').getAttribute('aria-pressed'), total: lis.length,
        visible: lis.filter(function (li) { return !li.hidden; }).length,
        visibleKinds: lis.filter(function (li) { return !li.hidden; }).map(function (li) { return li.dataset.kind; }) });
    } else if (sc === 'stability') {
      const r1 = snapRects();
      evWrite({ n: r1.length, rects: r1 }, '__evidence_r1');
      setTimeout(function () {
        const r2 = snapRects();
        const diffs = [];
        for (let i = 0; i < r1.length; i++) {
          if (JSON.stringify(r1[i]) !== JSON.stringify(r2[i])) diffs.push({ id: r1[i].id, from: r1[i], to: r2[i] });
        }
        evWrite({ stability_same: diffs.length === 0, tileCount: r1.length, diffCount: diffs.length, diffs: diffs.slice(0, 5),
          strip: document.getElementById('strip-body').textContent.trim().slice(0, 120),
          queueClass: (document.querySelector('.tile[data-id="svc.queue"]') || {}).className });
        document.title = diffs.length === 0 ? 'STABILITY_PASS' : 'STABILITY_FAIL';
      }, 42000);
    }
  })();
})();
