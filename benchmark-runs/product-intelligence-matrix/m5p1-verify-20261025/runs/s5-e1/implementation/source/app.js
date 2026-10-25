/* 维界 Lens — cell-j13-s10 · explore × dimensional-space
 * 单屏多维数据集探索器 · PAT-DATA-EXPLORER + Contextual Inspector
 *
 * SDIR 契约（screen: data_explorer_screen）
 *  regions   : data(dominant/collection) · dimension-panel · lens-bar · inspector(selection_driven)
 *              · trail · overview(contextual)
 *  states    : ready(首屏即此态，数据内联) / selected / empty(零匹配) / error(完整性校验失败)
 *              loading 定义但按设计不可达 —— 初始数据随首屏就绪，不存在可测加载态
 *  ownership : lens（过滤+投影+排序+观察轴+搜索）单一状态所有者，作用于 DATASET；
 *              selection 归 data 区域，跨维度切换/撤销持久保留（维度切换不重置认知）
 *  revert    : revisions 时间旅行 —— 逐条 undo/redo（Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y）、
 *              轨迹点击任意步回退、chip 逐条移除、reset 一键回初始（本身可撤销）
 *  keyboard  : 2 个契约（undo/redo 组合键；Esc 取消选中）
 *  budget    : permanent_panels=4 · primary_actions=3 · modes=0 · state_owners=1 ·
 *              navigation_levels=1 · new_semantic_concepts=2(透镜/变更轨迹) · surfaces=1
 *  acceptance: 维度切换不重置认知 · 过滤/投影状态有归属且可回退 · 首屏 ready
 */
(function () {
  'use strict';

  const DS = window.DATASET;
  const app = document.getElementById('app');
  const dimByKey = {};
  DS.dims.forEach((d) => { dimByKey[d.key] = d; });

  const DEFAULT_PROJECTION = { category: 1, platform: 1, status: 1, priority: 1, mrr: 1, health: 1 };

  const clone = (o) => JSON.parse(JSON.stringify(o));
  const pad2 = (n) => String(n).padStart(2, '0');
  const nowTs = () => { const d = new Date(); return pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds()); };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* ---------------- lens store（单一状态所有者 + revision 时间旅行） ---------------- */
  const INITIAL_LENS = { focus: 'category', filters: {}, projection: clone(DEFAULT_PROJECTION), sort: null, search: '' };

  const state = {
    lens: clone(INITIAL_LENS),
    revisions: [{ seq: 0, op: 'init', label: '初始视角', target: '—', ts: nowTs(), lens: clone(INITIAL_LENS) }],
    pointer: 0,
    selectedId: null,
    phase: 'ready' // ready | selected | empty | error（loading 按设计不可达：数据内联）
  };

  const opLabel = { init: '初始', filter: '过滤', unfilter: '取消过滤', 'clear-filters': '清除过滤', focus: '观察轴', 'project-add': '投影+', 'project-remove': '投影−', 'project-reset': '默认投影', sort: '排序', 'clear-sort': '清除排序', search: '搜索', 'clear-search': '清除搜索', reset: '重置' };

  function commit(op, label, target, mutator) {
    const next = mutator(clone(state.lens));
    state.revisions = state.revisions.slice(0, state.pointer + 1);
    state.revisions.push({ seq: state.revisions[state.pointer].seq + 1, op, label, target, ts: nowTs(), lens: next });
    state.pointer = state.revisions.length - 1;
    state.lens = next;
    update(); // 单一出口：任何透镜变更后全量刷新
  }
  const sameLens = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  const actions = {
    setFocus(dim) {
      if (dim === state.lens.focus) return;
      commit('focus', '观察轴 → ' + dimByKey[dim].label, dim, (l) => { l.focus = dim; return l; });
    },
    toggleFilter(dim, val) {
      const on = (state.lens.filters[dim] || []).indexOf(val) >= 0;
      commit(on ? 'unfilter' : 'filter', (on ? '取消过滤 ' : '过滤 ') + dimByKey[dim].label + '=' + val, dim + '=' + val, (l) => {
        const arr = (l.filters[dim] || []).filter((v) => v !== val);
        if (arr.length) l.filters[dim] = arr; else delete l.filters[dim];
        if (!on) { (l.filters[dim] = l.filters[dim] || []).push(val); }
        return l;
      });
    },
    clearFilters() {
      if (!Object.keys(state.lens.filters).length) return;
      commit('clear-filters', '清除全部过滤（' + Object.keys(state.lens.filters).length + ' 个维度）', 'filters', (l) => { l.filters = {}; return l; });
    },
    toggleProjection(key) {
      const label = dimByKey[key] ? dimByKey[key].label : (DS.metrics.find((m) => m.key === key) || {}).label;
      const on = !!state.lens.projection[key];
      const restCount = Object.keys(state.lens.projection).filter((k) => state.lens.projection[k]).length;
      if (on && restCount <= 1) return; // 至少保留一列
      commit(on ? 'project-remove' : 'project-add', (on ? '移除投影列 · ' : '添加投影列 · ') + label, key, (l) => {
        if (on) delete l.projection[key]; else l.projection[key] = 1;
        return l;
      });
    },
    resetProjection() {
      if (sameLens(state.lens.projection, DEFAULT_PROJECTION)) return;
      commit('project-reset', '恢复默认投影（6 列）', 'projection', (l) => { l.projection = clone(DEFAULT_PROJECTION); return l; });
    },
    setSort(key) {
      const cur = state.lens.sort;
      const dir = !cur || cur.key !== key ? 'asc' : cur.dir === 'asc' ? 'desc' : null;
      if (!dir) {
        commit('clear-sort', '清除排序', key, (l) => { l.sort = null; return l; });
      } else {
        const label = key === 'name' ? '条目' : (dimByKey[key] || DS.metrics.find((m) => m.key === key)).label;
        commit('sort', '排序 · ' + label + (dir === 'asc' ? ' ↑' : ' ↓'), key, (l) => { l.sort = { key, dir }; return l; });
      }
    },
    setSearch(text) {
      const cur = state.lens.search || '';
      if (text === cur) return;
      commit(text ? 'search' : 'clear-search', text ? '搜索 · "' + text + '"' : '清除搜索', 'search', (l) => { l.search = text; return l; });
    },
    resetLens() {
      if (sameLens(state.lens, INITIAL_LENS)) return;
      commit('reset', '重置到初始视角', 'lens', () => clone(INITIAL_LENS));
    },
    undo() { if (state.pointer > 0) { state.pointer--; state.lens = state.revisions[state.pointer].lens; } },
    redo() { if (state.pointer < state.revisions.length - 1) { state.pointer++; state.lens = state.revisions[state.pointer].lens; } },
    jump(i) { if (i >= 0 && i < state.revisions.length) { state.pointer = i; state.lens = state.revisions[i].lens; update(); } },
    select(id) { state.selectedId = state.selectedId === id ? null : id; update(); }
  };

  /* ---------------- 派生：匹配集 / 分面计数 ---------------- */
  function passesFilters(r, filters, skipDim) {
    for (const k in filters) {
      if (k === skipDim) continue;
      if (filters[k].indexOf(r[k]) < 0) return false;
    }
    return true;
  }
  function matched() {
    const { filters, search } = state.lens;
    const q = (search || '').trim().toLowerCase();
    let rows = DS.records.filter((r) => passesFilters(r, filters, null));
    if (q) rows = rows.filter((r) => (r.name + ' ' + DS.dims.map((d) => r[d.key]).join(' ')).toLowerCase().indexOf(q) >= 0);
    return rows;
  }
  function sorted(rows) {
    const s = state.lens.sort;
    if (!s) return rows;
    const isNum = !!DS.metrics.find((m) => m.key === s.key);
    const dir = s.dir === 'asc' ? 1 : -1;
    return rows.slice().sort((a, b) => {
      if (isNum) return (a[s.key] - b[s.key]) * dir;
      return String(a[s.key]).localeCompare(String(b[s.key]), 'zh') * dir;
    });
  }
  function facetCounts() {
    const dim = dimByKey[state.lens.focus];
    const base = DS.records.filter((r) => passesFilters(r, state.lens.filters, dim.key));
    const counts = {};
    dim.values.forEach((v) => { counts[v] = 0; });
    base.forEach((r) => { counts[r[dim.key]]++; });
    return { dim, counts, base: base.length };
  }

  /* ---------------- DOM 骨架（构建一次；动态区按需重渲染） ---------------- */
  function buildSkeleton() {
    app.innerHTML =
      '<header class="lensbar" data-region="lens-bar">' +
      '  <div class="lens-top">' +
      '    <div class="brand"><span class="logo">◈ 维界 Lens</span><span class="ds-name">' + esc(DS.name) + ' <em style="font-style:normal;color:#5f6b80">· ' + esc(DS.note) + '</em></span></div>' +
      '    <span class="ownership" title="过滤/投影状态归属：透镜明确作用于该数据集">作用于 · ' + esc(DS.name) + '</span>' +
      '    <div class="overview" id="overview" data-region="overview"></div>' +
      '    <div class="hist-controls">' +
      '      <button id="btn-undo" title="撤销 (Ctrl+Z)">↶ 撤销</button>' +
      '      <button id="btn-redo" title="重做 (Ctrl+Shift+Z / Ctrl+Y)">↷ 重做</button>' +
      '      <button id="btn-reset" title="重置到初始视角（本身可撤销）">⭯ 重置</button>' +
      '    </div>' +
      '  </div>' +
      '  <div class="lens-chips">' +
      '    <span class="search-box"><span class="icon">⌕</span><input id="search-input" type="text" placeholder="跨维度搜索…（按 / 聚焦）" /></span>' +
      '    <span class="group-label">生效视角</span>' +
      '    <span id="chips" style="display:contents"></span>' +
      '    <span class="match-count" id="match-count"></span>' +
      '  </div>' +
      '</header>' +
      '<div class="workspace">' +
      '  <aside class="dim-panel" data-region="dimension-panel">' +
      '    <div class="panel-title">维度 <span class="n">' + DS.dims.length + '</span></div>' +
      '    <div class="hint">点击维度切换<b>观察轴</b>（不重置选择/过滤）· 点值切换过滤</div>' +
      '    <div class="dim-scroll"><ul id="dim-list"></ul></div>' +
      '    <div class="proj-box" id="proj-box">' +
      '      <div class="panel-title">投影列 <span class="n" id="proj-count"></span></div>' +
      '      <div class="proj-grid" id="proj-grid"></div>' +
      '      <div class="proj-foot"><span>列变更记入变更轨迹</span><button id="btn-proj-reset">恢复默认</button></div>' +
      '    </div>' +
      '  </aside>' +
      '  <section class="data-region" data-region="data"><div class="grid-scroll" id="grid-scroll"></div></section>' +
      '  <aside class="right-panel">' +
      '    <div class="inspector" data-region="inspector">' +
      '      <div class="panel-title">条目详情 <span class="n" id="insp-state"></span></div>' +
      '      <div class="insp-body" id="insp-body"></div>' +
      '    </div>' +
      '    <div class="trail" data-region="trail">' +
      '      <div class="panel-title">变更轨迹 <span class="trail-pos" id="trail-pos"></span></div>' +
      '      <div class="trail-hint">每步含操作·目标·时间 · 点击任意步回退（后续操作将分叉）</div>' +
      '      <ol id="trail"></ol>' +
      '    </div>' +
      '  </aside>' +
      '</div>' +
      '<footer class="acceptance">' +
      '  <span><b class="k">✓</b> 维度切换不重置认知</span>' +
      '  <span><b class="k">✓</b> 过滤/投影状态有归属且可回退</span>' +
      '  <span><b class="k">✓</b> 首屏即 ready（数据内联）</span>' +
      '  <span style="margin-left:auto"><kbd>Ctrl+Z</kbd> 撤销 · <kbd>Ctrl+Shift+Z</kbd> 重做 · <kbd>Esc</kbd> 取消选中 · <kbd>/</kbd> 搜索</span>' +
      '</footer>';
  }

  /* ---------------- 各区域渲染 ---------------- */
  function findIntro(op, target) {
    for (let i = state.pointer; i >= 0; i--) {
      const r = state.revisions[i];
      if (r.op === op && r.target === target) return r;
    }
    return null;
  }

  function renderChips() {
    const l = state.lens;
    const chips = [];
    const defaultFocus = l.focus === INITIAL_LENS.focus;
    const intro = findIntro('focus', l.focus);
    chips.push('<span class="chip chip-focus" title="观察轴（维度切换）' + (intro ? ' · 来自 #' + intro.seq + ' ' + (opLabel[intro.op] || intro.op) + ' ' + intro.ts : ' · 初始') + '">观察轴 · ' + esc(dimByKey[l.focus].label) +
      (defaultFocus ? '' : '<button class="x" data-x="focus" title="恢复观察轴为 ' + esc(dimByKey[INITIAL_LENS.focus].label) + '（记入轨迹）">×</button>') + '</span>');
    let filterCount = 0;
    DS.dims.forEach((d) => {
      (l.filters[d.key] || []).forEach((v) => {
        filterCount++;
        const src = findIntro('filter', d.key + '=' + v);
        chips.push('<span class="chip chip-filter" title="过滤条件 · 作用维度：' + esc(d.label) + (src ? ' · 来自 #' + src.seq + ' ' + src.ts : '') + '"><span class="src">过滤</span>' + esc(d.label) + ' = ' + esc(v) + '<button class="x" data-x="filter" data-dim="' + d.key + '" data-val="' + esc(v) + '" title="移除此过滤（记入轨迹，可撤销）">×</button></span>');
      });
    });
    if (filterCount >= 2) chips.push('<span class="chip chip-filter"><button class="x" data-x="clear-filters" style="width:auto;background:none;padding:2px 4px;border-radius:4px" title="清除全部过滤（记入轨迹，可撤销）">清空过滤 ×</button></span>');
    if (!sameLens(l.projection, DEFAULT_PROJECTION)) {
      const n = Object.keys(l.projection).filter((k) => l.projection[k]).length;
      const total = DS.dims.length + DS.metrics.length;
      chips.push('<span class="chip chip-project" title="投影状态 · 当前 ' + n + '/' + total + ' 列 · 与默认投影不同 · 点击 × 恢复默认（记入轨迹）"><span class="src">投影</span>' + n + '/' + total + ' 列<button class="x" data-x="project-reset" title="恢复默认投影（记入轨迹）">×</button></span>');
    }
    if (l.sort) {
      const label = l.sort.key === 'name' ? '条目' : (dimByKey[l.sort.key] || DS.metrics.find((m) => m.key === l.sort.key)).label;
      chips.push('<span class="chip chip-sort" title="排序状态 · 作用列：' + esc(label) + '"><span class="src">排序</span>' + esc(label) + ' ' + (l.sort.dir === 'asc' ? '↑' : '↓') + '<button class="x" data-x="clear-sort" title="清除排序（记入轨迹）">×</button></span>');
    }
    if (l.search) chips.push('<span class="chip chip-search" title="搜索状态 · 作用于名称与全部维度值"><span class="src">搜索</span>"' + esc(l.search) + '"<button class="x" data-x="clear-search" title="清除搜索（记入轨迹）">×</button></span>');
    if (!chips.length) chips.push('<span class="chip chip-empty">初始视角 · 无过滤</span>');
    document.getElementById('chips').innerHTML = chips.join('');
  }

  function renderHeader(matchedCount) {
    document.getElementById('overview').innerHTML =
      '<b>' + DS.total + '</b> 条 · 匹配 <b>' + matchedCount + '</b> · ' + DS.dims.length + ' 维度 · 轨迹 ' + (state.pointer + 1) + '/' + state.revisions.length;
    document.getElementById('match-count').innerHTML = '匹配 <b>' + matchedCount + '</b> / ' + DS.total;
    document.getElementById('btn-undo').disabled = state.pointer <= 0;
    document.getElementById('btn-redo').disabled = state.pointer >= state.revisions.length - 1;
    document.getElementById('btn-reset').disabled = sameLens(state.lens, INITIAL_LENS);
    const si = document.getElementById('search-input');
    if (si.value !== (state.lens.search || '')) si.value = state.lens.search || '';
  }

  function renderDimPanel() {
    const { dim, counts } = facetCounts();
    const max = Math.max(1, ...Object.values(counts));
    const active = state.lens.filters[dim.key] || [];
    let html = '';
    DS.dims.forEach((d) => {
      const n = (state.lens.filters[d.key] || []).length;
      if (d.key === dim.key) {
        html += '<li class="dim-item focused" data-dim="' + d.key + '"><div class="dim-head" title="当前观察轴 · 点击其他维度切换（不重置选择/过滤）"><span class="chev">▾</span>' + esc(d.label) + (n ? '<span class="badge">' + n + '</span>' : '') + '</div><div class="values">';
        d.values.forEach((v) => {
          const on = active.indexOf(v) >= 0;
          const w = Math.round(counts[v] / max * 100);
          html += '<div class="val' + (on ? ' active' : '') + '" data-dim="' + d.key + '" data-val="' + esc(v) + '" title="' + (on ? '取消' : '添加') + '过滤 ' + esc(d.label) + '=' + esc(v) + '（记入轨迹）">' +
            '<span class="vname">' + esc(v) + '</span><span class="bar"><i style="width:' + w + '%"></i></span><span class="vcount">' + counts[v] + '</span></div>';
        });
        html += '</div></li>';
      } else {
        html += '<li class="dim-item" data-dim="' + d.key + '"><div class="dim-head" title="切换观察轴到 ' + esc(d.label) + '（不重置选择/过滤，记入轨迹）"><span class="chev">▸</span>' + esc(d.label) + (n ? '<span class="badge">' + n + '</span>' : '') + '</div></li>';
      }
    });
    document.getElementById('dim-list').innerHTML = html;

    // 投影列
    const pg = document.getElementById('proj-grid');
    let pj = '';
    DS.dims.forEach((d) => {
      const on = !!state.lens.projection[d.key];
      pj += '<label title="' + (on ? '移除' : '添加') + '投影列 ' + esc(d.label) + '（记入轨迹）"><input type="checkbox" data-proj="' + d.key + '"' + (on ? ' checked' : '') + '/>' + esc(d.label) + '</label>';
    });
    DS.metrics.forEach((m) => {
      const on = !!state.lens.projection[m.key];
      pj += '<label title="' + (on ? '移除' : '添加') + '投影列 ' + esc(m.label) + '（记入轨迹）"><input type="checkbox" data-proj="' + m.key + '"' + (on ? ' checked' : '') + '/>' + esc(m.label) + '</label>';
    });
    pg.innerHTML = pj;
    const n = Object.keys(state.lens.projection).filter((k) => state.lens.projection[k]).length;
    document.getElementById('proj-count').textContent = n + '/' + (DS.dims.length + DS.metrics.length);
  }

  function cellHtml(r, key) {
    if (key === 'name') return '<td class="dim-cell" style="font-weight:600">' + esc(r.name) + '</td>';
    const m = DS.metrics.find((x) => x.key === key);
    if (m) {
      if (key === 'health') {
        const cls = r.health >= 68 ? 'good' : r.health >= 40 ? 'mid' : 'bad';
        return '<td class="num"><span class="health-' + cls + '">' + r.health + '</span></td>';
      }
      const v = r[key];
      const txt = key === 'mrr' ? (v >= 100 ? '¥' + Math.round(v) + '万' : '¥' + v.toFixed(1) + '万') : (v >= 100 ? Math.round(v) + '万' : v.toFixed(1) + '万');
      return '<td class="num">' + txt + '</td>';
    }
    let extra = '';
    if (key === 'priority') extra = ' class="dim-cell pri pri-' + esc(r.priority) + '"';
    else if (key === 'status') extra = ' class="dim-cell st-' + esc(r.status) + '"';
    return '<td' + extra + '>' + esc(r[key]) + '</td>';
  }

  function renderGrid(rows) {
    const wrap = document.getElementById('grid-scroll');
    const l = state.lens;
    if (!rows.length) {
      const fcount = Object.keys(l.filters).reduce((a, k) => a + l.filters[k].length, 0);
      wrap.innerHTML = '<div class="empty-state" data-state="empty"><div class="big">没有匹配当前视角的数据条目</div>' +
        '<div>' + (fcount ? fcount + ' 个过滤值' : '') + (l.search ? (fcount ? ' · ' : '') + '搜索 "' + esc(l.search) + '"' : '') + ' · 调整或清除后即可恢复</div>' +
        (fcount ? '<button id="btn-empty-clear">清除全部过滤（记入轨迹，可撤销）</button>' : '') + '</div>';
      return;
    }
    state.phase = 'ready';
    let cols = [{ key: 'name', label: '条目' }];
    DS.dims.forEach((d) => { if (l.projection[d.key]) cols.push(d); });
    DS.metrics.forEach((m) => { if (l.projection[m.key]) cols.push(m); });
    let html = '<table class="grid"><thead><tr>' + cols.map((c) => {
      const sortedCls = l.sort && l.sort.key === c.key ? ' sorted' : '';
      const dir = l.sort && l.sort.key === c.key ? '<span class="dir">' + (l.sort.dir === 'asc' ? '▲' : '▼') + '</span>' : '';
      const numCls = c.num ? ' num' : '';
      return '<th class="th-sort' + numCls + sortedCls + '" data-sort="' + c.key + '" title="点击循环排序：升 → 降 → 无（记入轨迹）">' + esc(c.label) + dir + '</th>';
    }).join('') + '</tr></thead><tbody>';
    rows.forEach((r) => {
      html += '<tr data-id="' + r.id + '"' + (state.selectedId === r.id ? ' class="selected"' : '') + '>' + cols.map((c) => cellHtml(r, c.key)).join('') + '</tr>';
    });
    wrap.innerHTML = html + '</tbody></table>';
    state.phase = 'ready';
  }

  function renderInspector() {
    const body = document.getElementById('insp-body');
    const badge = document.getElementById('insp-state');
    if (!state.selectedId) {
      badge.textContent = '';
      body.innerHTML = '<div class="insp-placeholder">在左侧数据表中点击一行查看该条目的<b>全维度详情</b>。<br/>选中状态跨维度切换 / 过滤调整保持不变。</div>';
      return;
    }
    const r = DS.records.find((x) => x.id === state.selectedId);
    const rows = matched();
    const excluded = !rows.some((x) => x.id === r.id);
    badge.textContent = '选中';
    body.innerHTML = '<div class="insp-name">' + esc(r.name) + '</div>' +
      (excluded ? '<div class="insp-warn" title="selection 归属 data 区域，不随透镜重置">⚠ 选中条目被当前视角排除 — 选择已保留，调整过滤即可找回</div>' : '') +
      '<dl class="insp-dl">' +
      DS.dims.map((d) => '<dt>' + esc(d.label) + '</dt><dd>' + esc(r[d.key]) + '</dd>').join('') +
      '<dt>MRR</dt><dd>¥' + r.mrr.toFixed(1) + ' 万</dd>' +
      '<dt>DAU</dt><dd>' + r.dau.toFixed(1) + ' 万</dd>' +
      '<dt>健康分</dt><dd>' + r.health + ' / 100</dd>' +
      '</dl>';
  }

  function renderTrail() {
    document.getElementById('trail-pos').textContent = (state.pointer + 1) + '/' + state.revisions.length;
    document.getElementById('trail').innerHTML = state.revisions.map((r, i) => {
      const cls = i === state.pointer ? ' class="current"' : i > state.pointer ? ' class="future"' : '';
      return '<li' + cls + ' data-idx="' + i + '" title="回退到第 ' + i + ' 步：' + esc(r.label) + '（' + r.ts + '）' + (i > state.pointer ? ' · 之后操作将分叉' : '') + '">' +
        '<span class="seq">#' + pad2(r.seq) + '</span><span class="lbl">' + esc(r.label) + '</span><span class="ts">' + r.ts + '</span></li>';
    }).join('');
  }

  function update() {
    const rows = sorted(matched());
    if (state.phase !== 'error') {
      state.phase = rows.length ? (state.selectedId ? 'selected' : 'ready') : 'empty';
    }
    app.setAttribute('data-app-state', state.phase);
    app.setAttribute('data-matched', String(rows.length));
    renderHeader(rows.length);
    renderChips();
    renderDimPanel();
    renderGrid(rows);
    renderInspector();
    renderTrail();
  }

  /* ---------------- 事件（委托） ---------------- */
  function wire() {
    document.getElementById('dim-list').addEventListener('click', (e) => {
      const val = e.target.closest('.val');
      if (val) { actions.toggleFilter(val.getAttribute('data-dim'), val.getAttribute('data-val')); return; }
      const head = e.target.closest('.dim-head');
      if (head) actions.setFocus(head.parentElement.getAttribute('data-dim'));
    });
    document.getElementById('chips').addEventListener('click', (e) => {
      const x = e.target.closest('.x');
      if (!x) return;
      const kind = x.getAttribute('data-x');
      if (kind === 'filter') actions.toggleFilter(x.getAttribute('data-dim'), x.getAttribute('data-val'));
      else if (kind === 'focus') actions.setFocus(INITIAL_LENS.focus);
      else if (kind === 'clear-filters') actions.clearFilters();
      else if (kind === 'project-reset') actions.resetProjection();
      else if (kind === 'clear-sort') actions.setSort(state.lens.sort.key);
      else if (kind === 'clear-search') actions.setSearch('');
    });
    document.getElementById('proj-grid').addEventListener('change', (e) => {
      const k = e.target.getAttribute && e.target.getAttribute('data-proj');
      if (k) actions.toggleProjection(k);
    });
    document.getElementById('btn-proj-reset').addEventListener('click', () => actions.resetProjection());
    document.getElementById('grid-scroll').addEventListener('click', (e) => {
      if (e.target.id === 'btn-empty-clear') { actions.clearFilters(); return; }
      const th = e.target.closest('.th-sort');
      if (th) { actions.setSort(th.getAttribute('data-sort')); return; }
      const tr = e.target.closest('tr[data-id]');
      if (tr) { actions.select(tr.getAttribute('data-id')); }
    });
    document.getElementById('trail').addEventListener('click', (e) => {
      const li = e.target.closest('li[data-idx]');
      if (li) actions.jump(parseInt(li.getAttribute('data-idx'), 10));
    });
    document.getElementById('btn-undo').addEventListener('click', () => { actions.undo(); update(); });
    document.getElementById('btn-redo').addEventListener('click', () => { actions.redo(); update(); });
    document.getElementById('btn-reset').addEventListener('click', () => { actions.resetLens(); update(); });

    let searchTimer = null;
    document.getElementById('search-input').addEventListener('input', function () {
      clearTimeout(searchTimer);
      const v = this.value;
      searchTimer = setTimeout(() => { actions.setSearch(v.trim()); update(); }, 300);
    });

    document.addEventListener('keydown', (e) => {
      const inInput = e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA');
      if ((e.ctrlKey || e.metaKey) && !inInput) {
        const k = e.key.toLowerCase();
        if (k === 'z' && !e.shiftKey) { e.preventDefault(); actions.undo(); update(); return; }
        if ((k === 'z' && e.shiftKey) || k === 'y') { e.preventDefault(); actions.redo(); update(); return; }
      }
      if (e.key === 'Escape' && !inInput) { state.selectedId = null; update(); }
      if (e.key === '/' && !inInput) { e.preventDefault(); document.getElementById('search-input').focus(); }
    });

    // commit() 内部统一触发 update()；undo/redo/reset 等旁路操作在各自入口补一次刷新
  }

  /* ---------------- 启动：完整性校验失败 → error 态；否则首屏即 ready ---------------- */
  function integrityCheck() {
    return !!(window.DATASET && Array.isArray(DATASET.records) && DATASET.records.length > 0 &&
      Array.isArray(DATASET.dims) && DATASET.dims.length >= 10 &&
      DATASET.records.every && typeof DATASET.records[0].id === 'string');
  }

  function boot() {
    if (!integrityCheck()) {
      state.phase = 'error';
      app.setAttribute('data-app-state', 'error');
      app.innerHTML = '<div class="error-state" data-state="error" style="margin-top:40vh"><div class="big" style="font-size:16px;font-weight:700">数据集完整性校验失败</div><div style="margin-top:6px">内联数据缺失或格式不符 — 请检查 data.js 是否随页面正确加载。</div></div>';
      return;
    }
    buildSkeleton();
    wire();
    update(); // 首屏同步渲染完成 → ready（无加载态）
  }

  boot();
})();
