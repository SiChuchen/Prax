/* ============================================================
 * 棱镜 Prism — 多维数据探索台
 * 设计契约（对应验收种子"过滤/投影状态有归属且可回退"）：
 *   1) 归属：每个筛选/投影状态片都标注所属维度（色点+维度名+实时命中数），
 *      维度目录同步计数，操作历史逐条命名维度。
 *   2) 可回退：单片移除 / 撤销·重做(Ctrl+Z·Ctrl+Y) / 历史任意步回退 / 全局重置。
 *   3) 成功标准"维度切换不重置认知"：筛选、排序、撤销历史、列表滚动、
 *      选中锚点全部跨投影保留；切换后锚点徽标直接标注其在新投影中的组。
 * ============================================================ */
(function () {
  'use strict';

  let DATA = window.GEO_DATA;
  let RECORDS = DATA.records;
  let DIMS = DATA.dims;
  let DIM = {};
  let IDX = new Map();

  const SEARCH_KEY = '__q';
  const PSEUDO = { [SEARCH_KEY]: { id: SEARCH_KEY, name: '名称搜索', color: '#8fa3bd' } };
  const HIGH_TOPK = 24;        // 高基数投影折叠阈值
  const NUM_BINS = 22;         // 数值投影分箱数

  /* ---------------- 可回退状态 ---------------- */
  const DEFAULTS = { filters: {}, projection: 'continent', sort: 'population' };
  let past = [];                                          // [{label, state}] 按时间正序
  let present = { label: '初始状态', state: clone(DEFAULTS) };
  let future = [];                                        // [next, next+1, ...] 前进方向
  let selection = null;                                   // 选中锚点（认知状态，不参与快照/撤销）
  let selName = null;                                     // 锚点身份校验（重采样后原记录可能消失）
  let openPanel = null;                                   // 维度目录展开的筛选面板（纯 UI 态）
  let topExpanded = false;                                // 高基数投影是否展开全部
  let chartMeta = [];                                     // 柱体悬停元数据
  let lastHistLen = -1;

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function snap() { return clone(present.state); }
  function st() { return present.state; }
  function rebuildIndex() {
    DIM = {};
    DIMS.forEach(d => { DIM[d.id] = d; });
    IDX = new Map(RECORDS.map(r => [r.id, r]));
  }
  rebuildIndex();

  /* ---------------- 历史机（可回退核心） ---------------- */
  function commit(label, nextState) {
    past.push(present);
    if (past.length > 80) past.shift();
    present = { label, state: nextState };
    future = [];
    renderAll();
    toast(label);
  }
  function restorePast(i) {
    if (i < 0 || i >= past.length) return;
    const after = past.splice(i + 1);
    after.push(present);
    future = after.concat(future);
    present = past.pop();
    renderAll(); toast('已回退 → ' + present.label);
  }
  function restoreFuture(k) {
    if (k < 0 || k >= future.length) return;
    const keep = future.splice(0, k + 1);
    past = past.concat(keep.slice(0, k));
    present = keep[k];
    renderAll(); toast('已前进 → ' + present.label);
  }
  const undo = () => restorePast(past.length - 1);
  const redo = () => restoreFuture(0);

  /* ---------------- 谓词与统计 ---------------- */
  function passes(rec, f) {
    if (!f) return true;
    if (f.t === 'cat') return f.v.indexOf(String(rec[f.dim])) >= 0;
    if (f.t === 'num') {
      const x = rec[f.dim];
      if (f.lo != null && x < f.lo) return false;
      if (f.hi != null && x > f.hi) return false;
      return true;
    }
    if (f.t === 'str') return rec.name.indexOf(f.q) >= 0;
    return true;
  }
  function filtered() {
    const fs = st().filters;
    return RECORDS.filter(r => {
      for (const k in fs) if (!passes(r, fs[k])) return false;
      return true;
    });
  }
  function dimOf(key) { return DIM[key] || PSEUDO[key] || { name: key, color: '#888' }; }
  function filterDesc(f) {
    const d = dimOf(f.dim);
    if (f.t === 'cat') return '= ' + (f.v.length <= 2 ? f.v.join('、') : f.v.slice(0, 2).join('、') + ' 等' + f.v.length + '项');
    if (f.t === 'num') return '∈ ' + (f.lo != null ? fmtNum(f.lo) : '−∞') + ' ~ ' + (f.hi != null ? fmtNum(f.hi) : '+∞') + (d.unit ? ' ' + d.unit : '');
    if (f.t === 'str') return '「' + f.q + '」';
    return '';
  }
  // 单片边际命中数：通过其余全部筛选、且命中该片的记录数 —— 归属问责
  function chipCount(key) {
    const fs = st().filters;
    let n = 0;
    outer: for (const r of RECORDS) {
      for (const k in fs) { if (k !== key && !passes(r, fs[k])) continue outer; }
      if (passes(r, fs[key])) n++;
    }
    return n;
  }

  /* ---------------- 操作（全部经 commit → 可回退） ---------------- */
  function toggleCat(dimId, value) {
    const s = snap(); const dim = DIM[dimId];
    const cur = (s.filters[dimId] && s.filters[dimId].t === 'cat') ? s.filters[dimId].v.slice() : [];
    const i = cur.indexOf(value);
    let label;
    if (i >= 0) { cur.splice(i, 1); label = '移除筛选 ' + dim.name + '=' + value; }
    else { cur.push(value); label = '筛选 ' + dim.name + '=' + value; }
    if (cur.length) s.filters[dimId] = { t: 'cat', dim: dimId, v: cur };
    else delete s.filters[dimId];
    commit(label, s);
  }
  function clearDim(dimId) {
    const s = snap();
    if (!s.filters[dimId]) return;
    delete s.filters[dimId];
    commit('清除筛选 ' + dimOf(dimId).name, s);
  }
  function setRange(dimId, lo, hi) {
    const s = snap(); const dim = DIM[dimId];
    if (lo == null && hi == null) { clearDim(dimId); return; }
    if (lo != null && hi != null && lo > hi) { const t = lo; lo = hi; hi = t; }
    s.filters[dimId] = { t: 'num', dim: dimId, lo, hi };
    commit('筛选 ' + dim.name + ' ∈ ' + filterDesc(s.filters[dimId]), s);
  }
  function setSearch(q) {
    const s = snap();
    if (q) {
      s.filters[SEARCH_KEY] = { t: 'str', dim: SEARCH_KEY, q };
      commit('搜索 「' + q + '」', s);
    } else if (s.filters[SEARCH_KEY]) {
      delete s.filters[SEARCH_KEY];
      commit('清除搜索', s);
    }
  }
  function setProjection(dimId) {
    const s = snap();
    if (s.projection === dimId) return;
    s.projection = dimId;
    const n = Object.keys(s.filters).length;
    commit('投影 → ' + DIM[dimId].name, s);
    // 成功标准提示：切换不重置认知
    toast('投影已切换为「' + DIM[dimId].name + '」· 保留 ' + n + ' 个筛选 · 选中锚点与撤销历史不变');
  }
  function resetAll() {
    commit('重置全部筛选与投影', clone(DEFAULTS));
    topExpanded = false;
  }
  function select(id) {
    selection = (selection === id) ? null : id;
    selName = selection ? (IDX.get(selection) || {}).name || null : null;
    renderAll();
  }
  function reseed() {
    const seed = 100000 + ((Math.random() * 899999) | 0);
    DATA = window.GEO_DATA.regenerate(seed);
    RECORDS = DATA.records; DIMS = DATA.dims;
    rebuildIndex();
    // 记录 id 跨种子稳定（C001…），但同名 id 已是另一座城 —— 按名称校验锚点身份
    if (selection && (!IDX.has(selection) || IDX.get(selection).name !== selName)) {
      selection = null;
      toast('已重采样 seed ' + seed + '：' + RECORDS.length + ' 条 · 原选中记录已不存在，锚点清除');
    } else {
      toast('已重采样 seed ' + seed + '：' + RECORDS.length + ' 条 · 全部筛选已重新校验（见账本命中数）');
    }
    renderAll();
  }

  /* ---------------- 分组构建 ---------------- */
  function buildGroups(dim, kept) {
    const keptSet = new Set(kept.map(r => r.id));
    const sel = selection ? IDX.get(selection) : null;
    const groups = [];

    if (dim.type === 'num') {
      const smin = dim.stats.min, w = ((dim.stats.max - smin) / NUM_BINS) || 1;
      for (let i = 0; i < NUM_BINS; i++) {
        groups.push({
          label: fmtNum(Math.round(smin + i * w)) + '–' + fmtNum(Math.round(smin + (i + 1) * w)),
          lo: smin + i * w, hi: smin + (i + 1) * w, total: 0, kept: 0,
        });
      }
      const bin = x => Math.min(NUM_BINS - 1, Math.max(0, Math.floor((x - smin) / w)));
      for (const r of RECORDS) { const g = groups[bin(r[dim.id])]; g.total++; if (keptSet.has(r.id)) g.kept++; }
      groups.anchor = sel ? bin(sel[dim.id]) : -1;
    } else if (dim.type === 'highcat') {
      const m = new Map();
      for (const r of RECORDS) {
        let g = m.get(r.id);
        if (!g) { g = { label: r.name, value: r.id, total: 0, kept: 0 }; m.set(r.id, g); }
        g.total++; if (keptSet.has(r.id)) g.kept++;
      }
      let all = [...m.values()].sort((a, b) => b.total - a.total);
      if (!topExpanded && all.length > HIGH_TOPK) {
        const hid = all.length - HIGH_TOPK;
        all = all.slice(0, HIGH_TOPK);
        all.hidden = hid; // slice 会丢弃自定义属性，需在切片后重挂
      }
      all.anchor = sel ? all.findIndex(g => g.value === sel.id) : -1;
      return all; // 注：anchor/hidden 挂在返回数组上
    } else {
      const byVal = new Map();
      for (const v of dim.values) { const g = { label: v, value: v, total: 0, kept: 0 }; byVal.set(v, g); groups.push(g); }
      for (const r of RECORDS) {
        const g = byVal.get(String(r[dim.id]));
        if (g) { g.total++; if (keptSet.has(r.id)) g.kept++; }
      }
      if (dim.type === 'cat') groups.sort((a, b) => b.total - a.total);
      groups.anchor = sel ? groups.findIndex(g => g.label === String(sel[dim.id])) : -1;
    }
    return groups;
  }

  /* ---------------- 渲染 ---------------- */
  const $ = id => document.getElementById(id);

  function renderAll() {
    const kept = filtered();
    renderMeta(kept);
    renderChips(kept);
    renderRail(kept);
    renderChart(kept);
    renderList(kept);
    renderDetail(kept);
    renderHistory();
    $('btn-undo').disabled = past.length === 0;
    $('btn-redo').disabled = future.length === 0;
  }

  function preserveScroll(el, fn) {
    const t = el ? el.scrollTop : 0;
    fn();
    if (el) el.scrollTop = t;
  }

  function renderMeta(kept) {
    $('data-meta').textContent =
      RECORDS.length + ' 条记录 · ' + DIMS.length + ' 个维度 · seed ' + DATA.seed + ' · 当前命中 ' + kept.length;
    $('dim-count').textContent = DIMS.length + ' 个';
  }

  function renderChips() {
    const el = $('ledger');
    const fs = st().filters;
    const keys = Object.keys(fs);
    let h = '';
    for (const k of keys) {
      const d = dimOf(k);
      const c = chipCount(k);
      h += '<span class="chip' + (c === 0 ? ' warn' : '') + '" style="--c:' + d.color + '" title="归属维度：' + d.name + '">' +
        '<span class="dot"></span><b>' + d.name + '</b> ' + filterDesc(fs[k]) +
        '<span class="cnt">命中 ' + c + '</span>' +
        '<button class="x" data-unfilter="' + k + '" title="移除该筛选（可撤销）">✕</button></span>';
    }
    h += '<span class="chip proj" style="--c:' + DIM[st().projection].color + '" title="当前投影维度 — 在左侧维度目录点击维度名切换">' +
      '<span class="dot"></span>投影 · <b>' + DIM[st().projection].name + '</b></span>';
    if (!keys.length) h += '<span class="ledger-empty">暂无筛选 — 点击图表柱体或维度「筛选」开始（所有状态片都可撤销）</span>';
    el.innerHTML = h;
  }

  function renderRail(kept) {
    preserveScroll($('dims'), () => {
      const el = $('dims');
      const fs = st().filters;
      const cur = st().projection;
      let h = '';
      for (const d of DIMS) {
        const f = fs[d.id];
        const on = d.id === cur;
        h += '<div class="dim' + (on ? ' on' : '') + '" style="--c:' + d.color + '">' +
          '<div class="dim-head" data-proj="' + d.id + '" title="点击设为投影维度">' +
          '<span class="dot"></span><span class="nm">' + d.name + '</span>' +
          '<span class="tag">' + (d.type === 'num' ? '数值' : d.type === 'ord' ? '序数' : d.type === 'highcat' ? '高基数' : '类别') + '</span>' +
          (on ? '<span class="tag proj">投影中</span>' : '') +
          (f ? '<span class="fcnt" title="该维度有 ' + (f.t === 'cat' ? f.v.length + ' 个取值' : '范围') + '筛选">●</span>' : '') +
          '<button class="fbtn" data-panel="' + d.id + '">' + (f ? '筛选●' : '筛选') + '</button>' +
          '</div>';
        if (openPanel === d.id) h += renderPanel(d, f, kept);
        h += '</div>';
      }
      el.innerHTML = h;
    });
  }

  function renderPanel(d, f, kept) {
    let h = '<div class="dim-panel">';
    if (d.type === 'num') {
      const lo = f && f.t === 'num' && f.lo != null ? f.lo : '';
      const hi = f && f.t === 'num' && f.hi != null ? f.hi : '';
      h += '<div class="range-row">' +
        '<input data-rlo="' + d.id + '" type="number" placeholder="' + d.stats.min + '" value="' + lo + '">' +
        '<span>~</span>' +
        '<input data-rhi="' + d.id + '" type="number" placeholder="' + d.stats.max + '" value="' + hi + '">' +
        '<span>' + d.unit + '</span></div>' +
        '<div class="panel-actions"><button data-apply="' + d.id + '">应用范围</button>' +
        (f ? '<button data-clear="' + d.id + '">清除</button>' : '') + '</div>';
    } else if (d.type === 'highcat') {
      h += '<div class="range-row"><input data-nameq="' + d.id + '" placeholder="按名称过滤记录…" value="' +
        (st().filters[SEARCH_KEY] ? st().filters[SEARCH_KEY].q : '') + '"></div>' +
        '<div class="panel-actions"><button data-clear="' + SEARCH_KEY + '">清除搜索</button></div>';
    } else {
      const sel = f && f.t === 'cat' ? f.v : [];
      const cnt = {};
      for (const r of RECORDS) { const v = String(r[d.id]); cnt[v] = (cnt[v] || 0) + 1; }
      const keptCnt = {};
      for (const r of kept) { const v = String(r[d.id]); keptCnt[v] = (keptCnt[v] || 0) + 1; }
      for (const v of d.values) {
        h += '<label class="vrow"><input type="checkbox" data-dim="' + d.id + '" data-val="' + v + '" ' +
          (sel.indexOf(v) >= 0 ? 'checked' : '') + '><span class="vn">' + v + '</span>' +
          '<span class="vc">命中 ' + (keptCnt[v] || 0) + ' / ' + (cnt[v] || 0) + '</span></label>';
      }
      if (f) h += '<div class="panel-actions"><button data-clear="' + d.id + '">清除该维度筛选</button></div>';
    }
    return h + '</div>';
  }

  function renderChart(kept) {
    const dim = DIM[st().projection];
    $('proj-title').textContent = '投影 · ' + dim.name + (dim.unit ? '（' + dim.unit + '）' : '');

    const sel = selection ? IDX.get(selection) : null;
    $('anchor-line').innerHTML = sel
      ? '锚点 <b class="a">◈ ' + esc(sel.name) + '</b> ' +
        '→ 当前投影组「<b class="a">' + esc(String(sel[dim.id])) + '</b>」' +
        ' · 筛选保留 ' + Object.keys(st().filters).length + ' 项 · 历史 ' + past.length + ' 步可回退'
      : '锚点：未选中 — 点击右侧清单或「名称」投影柱体设置（跨维度保留）';

    const wrap = $('chart-wrap');
    if (!kept.length) {
      wrap.innerHTML = '<div id="empty"><div class="box"><p><b>当前筛选组合命中 0 条记录</b></p>' +
        '<p>状态没有丢失 —— 每一步都可回退：</p>' +
        '<button data-ui="undo">↩ 撤销一步</button><button data-ui="reset-f">清除全部筛选</button></div></div>';
      $('legend').innerHTML = '';
      $('proj-note').textContent = '0 组';
      return;
    }

    const groups = buildGroups(dim, kept);
    const hidden = groups.hidden || 0;
    $('legend').innerHTML =
      '<span><i class="sw" style="background:' + rgba(dim.color, 0.75) + '"></i>命中当前筛选</span>' +
      '<span><i class="sw" style="background:' + rgba(dim.color, 0.18) + '"></i>被筛除</span>' +
      (hidden ? '<span>高基数维度：显示前 ' + groups.length + ' / ' + (groups.length + hidden) + ' 组 <button data-ui="tops" style="font-size:10px;padding:0 6px">' +
        (topExpanded ? '收起' : '展开全部') + '</button></span>' : '');
    $('proj-note').textContent = groups.length + ' 组 · 记录 ' + kept.length + ' / ' + RECORDS.length +
      (groups.anchor >= 0 ? ' · 锚点在第 ' + (groups.anchor + 1) + ' 组' : '');

    preserveScroll(wrap, () => { wrap.innerHTML = chartSVG(dim, groups); });
  }

  function chartSVG(dim, groups) {
    const wrap = $('chart-wrap');
    const W = Math.max(360, wrap.clientWidth - 4), H = 340;
    const padL = 48, padR = 10, padT = 18, padB = 48;
    const iw = W - padL - padR, ih = H - padT - padB;
    const max = Math.max(1, ...groups.map(g => g.total));
    const n = groups.length;
    const slot = iw / n;
    const minW = n > 200 ? 0.8 : 2;   // 540 组展开时 2px 会互相压叠
    const bw = Math.max(minW, slot - (n > 60 ? 0.5 : Math.min(10, slot * 0.25)));
    const f = st().filters[dim.id];
    const activeSet = f && f.t === 'cat' ? f.v : null;

    let s = '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '">';
    for (let i = 0; i <= 4; i++) {
      const v = max * i / 4, y = padT + ih - (v / max) * ih;
      s += '<line x1="' + padL + '" y1="' + y + '" x2="' + (W - padR) + '" y2="' + y + '" stroke="#22303f"/>' +
        '<text x="' + (padL - 6) + '" y="' + (y + 3) + '" text-anchor="end" font-size="10" fill="#71809a">' + fmtNum(Math.round(v)) + '</text>';
    }
    const labEvery = n <= 26 ? 1 : Math.ceil(n / 26);
    chartMeta = groups;
    for (let i = 0; i < n; i++) {
      const g = groups[i];
      const x = padL + i * slot + (slot - bw) / 2;
      const ht = Math.max(0.5, (g.total / max) * ih);
      const hk = Math.max(0.5, (g.kept / max) * ih);
      const isActive = activeSet ? activeSet.indexOf(g.label) >= 0 : false;
      const isAnchor = i === groups.anchor;
      s += '<rect data-i="' + i + '" x="' + x + '" y="' + (padT + ih - ht) + '" width="' + bw + '" height="' + ht +
        '" rx="2" fill="' + rgba(dim.color, 0.16) + '"/>';
      s += '<rect class="bar" data-i="' + i + '" x="' + x + '" y="' + (padT + ih - hk) + '" width="' + bw + '" height="' + hk +
        '" rx="2" fill="' + rgba(dim.color, isActive ? 1 : 0.72) + '"' +
        (isActive ? ' stroke="#fff" stroke-width="1"' : '') + '/>';
      if (isAnchor) {
        const yy = padT + ih - ht - 8;
        s += '<circle cx="' + (x + bw / 2) + '" cy="' + yy + '" r="7" fill="#ffd166" stroke="#5a4a10"/>' +
          '<text x="' + (x + bw / 2) + '" y="' + (yy + 3.5) + '" text-anchor="middle" font-size="9" font-weight="700" fill="#3a2c00">锚</text>';
      }
      if (i % labEvery === 0) {
        const lbl = g.label.length > 7 ? g.label.slice(0, 6) + '…' : g.label;
        const col = isActive ? '#fff' : '#8b99ad';
        if (n > 14) {
          s += '<text transform="translate(' + (x + bw / 2 + 4) + ',' + (padT + ih + 14) + ') rotate(-38)" text-anchor="end" font-size="10" fill="' + col + '">' + esc(lbl) + '</text>';
        } else {
          s += '<text x="' + (x + bw / 2) + '" y="' + (padT + ih + 16) + '" text-anchor="middle" font-size="10.5" fill="' + col + '">' + esc(lbl) + '</text>';
        }
      }
    }
    s += '<line x1="' + padL + '" y1="' + (padT + ih) + '" x2="' + (W - padR) + '" y2="' + (padT + ih) + '" stroke="#33415a"/></svg>';
    return s;
  }

  const SORTS = {
    population: ['人口 ↓', (a, b) => b.population - a.population],
    gdp_pc: ['人均GDP ↓', (a, b) => b.gdp_pc - a.gdp_pc],
    happy: ['幸福 ↓', (a, b) => b.happy - a.happy],
    aqi: ['AQI ↑', (a, b) => a.aqi - b.aqi],
    name: ['名称', (a, b) => a.name < b.name ? -1 : 1],
  };

  function renderList(kept) {
    $('kept-count').textContent = '命中 ' + kept.length + ' / ' + RECORDS.length;
    const sel = st().sort;
    const sEl = $('sort');
    if (document.activeElement !== sEl) sEl.value = sel;
    const dim = DIM[st().projection];

    preserveScroll($('list'), () => {
      const rows = kept.slice().sort(SORTS[sel][1]);
      let h = '';
      // 选中但被筛除的记录：幽灵行置顶，认知不断链
      if (selection && !kept.some(r => r.id === selection)) {
        const r = IDX.get(selection);
        if (r) h += rowHTML(r, dim, -1, true);
      }
      rows.forEach((r, i) => { h += rowHTML(r, dim, i + 1, false); });
      $('list').innerHTML = h || '<p style="color:#5d6b80;padding:14px">无命中记录</p>';
    });
  }

  function rowHTML(r, dim, rank, ghost) {
    const gv = String(r[dim.id]);
    const short = gv.length > 6 ? gv.slice(0, 5) + '…' : gv;
    return '<div class="row' + (r.id === selection ? ' sel' : '') + (ghost ? ' ghost' : '') + '" data-id="' + r.id + '" title="' + esc(r.name) + ' · ' + esc(gv) + '">' +
      '<span class="rk">' + (ghost ? '⚡' : rank) + '</span>' +
      '<div class="col1"><div><span class="nm2">' + esc(r.name) + '</span></div>' +
      '<div class="sub">' + esc(r.region) + ' · ' + esc(r.climate) + ' · ' + fmtWan(r.population) + ' · $' + fmtGdp(r.gdp_pc) + ' · AQI ' + r.aqi + '</div></div>' +
      '<span class="gb" style="--c:' + dim.color + ';background:' + rgba(dim.color, 0.16) + ';color:' + dim.color + ';border:1px solid ' + rgba(dim.color, 0.45) + '" title="当前投影「' + dim.name + '」的取值">' + esc(short) + '</span>' +
      '</div>';
  }

  function renderDetail(kept) {
    const el = $('detail');
    if (!selection) {
      el.innerHTML = '<h3>记录详情</h3><p style="color:#5d6b80;font-size:12px">未选中。点击清单任一行设置锚点；锚点在维度切换、筛选与撤销后均保持。</p>';
      return;
    }
    const r = IDX.get(selection);
    if (!r) { selection = null; el.innerHTML = ''; return; }
    const excluded = !kept.some(x => x.id === selection);
    let h = '<h3>◈ ' + esc(r.name) + ' <span class="tag">' + r.id + '</span></h3>';
    if (excluded) h += '<div class="warnbox">⚠ 该记录被当前筛选排除，但作为锚点保留 — 移除对应筛选片即可找回</div>';
    for (const d of DIMS) {
      if (d.type === 'highcat') continue;
      let bar = '';
      if (d.type === 'num') {
        const p = Math.round(100 * (r[d.id] - d.stats.min) / ((d.stats.max - d.stats.min) || 1));
        bar = '<span class="db"><i style="width:' + Math.max(2, Math.min(100, p)) + '%;background:' + d.color + '"></i></span>';
      }
      h += '<div class="drow" style="--c:' + d.color + '"><span class="dn">' + d.name + '</span>' + bar +
        '<span class="dv">' + fmtVal(d, r[d.id]) + (d.unit && d.type === 'num' ? ' ' + d.unit : '') + '</span></div>';
    }
    el.innerHTML = h;
  }

  function renderHistory() {
    const el = $('history');
    let h = '';
    const item = (e, kind, idx) =>
      '<li class="' + kind + '" data-kind="' + kind + '" data-i="' + idx + '" title="' + (kind === 'now' ? '当前状态' : '点击回到该状态') + '">' +
      '<span class="no">' + (kind === 'past' ? '#' + (idx + 1) : kind === 'now' ? '▶' : '↷') + '</span>' +
      '<span>' + esc(e.label) + '</span></li>';
    past.forEach((e, i) => { h += item(e, 'past', i); });
    h += item(present, 'now', 0);
    future.forEach((e, i) => { h += item(e, 'future', i); });
    el.innerHTML = h;
    if (past.length !== lastHistLen) { el.scrollTop = el.scrollHeight; lastHistLen = past.length; }
  }

  /* ---------------- 工具 ---------------- */
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function rgba(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return 'rgba(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a + ')';
  }
  function fmtNum(v) { return v >= 10000 ? v.toLocaleString('en-US') : String(Math.round(v)); }
  function fmtWan(v) { return v >= 10000 ? (v / 10000).toFixed(1) + '亿' : v + '万'; }
  function fmtGdp(v) { return v >= 1000 ? (v / 1000).toFixed(1) + 'k' : String(v); }
  function fmtVal(d, v) {
    if (d.type === 'num') return d.id === 'population' ? fmtWan(v) : d.id === 'gdp_pc' ? '$' + fmtGdp(v) : String(v);
    return esc(String(v));
  }
  let toastTimer = null;
  function toast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 3400);
  }

  /* ---------------- 事件 ---------------- */
  function wire() {
    $('btn-undo').addEventListener('click', undo);
    $('btn-redo').addEventListener('click', redo);
    $('btn-reset').addEventListener('click', resetAll);
    $('btn-reseed').addEventListener('click', reseed);

    $('ledger').addEventListener('click', e => {
      const b = e.target.closest('[data-unfilter]');
      if (b) {
        const k = b.dataset.unfilter;
        if (k === SEARCH_KEY) { setSearch(''); $('search').value = ''; }
        else clearDim(k);
      }
    });

    $('dims').addEventListener('click', e => {
      const pb = e.target.closest('[data-panel]');
      if (pb) { openPanel = openPanel === pb.dataset.panel ? null : pb.dataset.panel; renderAll(); return; }
      const cb = e.target.closest('input[data-dim]');
      if (cb) { toggleCat(cb.dataset.dim, cb.dataset.val); return; }
      const ap = e.target.closest('[data-apply]');
      if (ap) {
        const id = ap.dataset.apply;
        const lo = document.querySelector('[data-rlo="' + id + '"]').value;
        const hi = document.querySelector('[data-rhi="' + id + '"]').value;
        setRange(id, lo === '' ? null : +lo, hi === '' ? null : +hi);
        return;
      }
      const cl = e.target.closest('[data-clear]');
      if (cl) {
        if (cl.dataset.clear === SEARCH_KEY) { setSearch(''); $('search').value = ''; }
        else clearDim(cl.dataset.clear);
        return;
      }
      const head = e.target.closest('[data-proj]');
      if (head) setProjection(head.dataset.proj);
    });

    $('dims').addEventListener('keydown', e => {
      if (e.key !== 'Enter') return;
      const q = e.target.closest('[data-nameq]');
      if (q) setSearch(q.value.trim());
    });
    $('dims').addEventListener('change', e => {
      const q = e.target.closest('[data-nameq]');
      if (q) setSearch(q.value.trim());
    });

    $('chart-wrap').addEventListener('click', e => {
      const ui = e.target.closest('[data-ui]');
      if (ui) {
        if (ui.dataset.ui === 'undo') undo();
        else if (ui.dataset.ui === 'reset-f') { const s = snap(); s.filters = {}; commit('清除全部筛选', s); }
        else if (ui.dataset.ui === 'tops') { topExpanded = !topExpanded; renderAll(); }
        return;
      }
      const t = e.target.closest('[data-i]');
      if (!t) return;
      const g = chartMeta[+t.dataset.i];
      if (!g) return;
      const dim = DIM[st().projection];
      if (dim.type === 'num') {
        const rlo = Math.round(g.lo), rhi = Math.round(g.hi);
        const f = st().filters[dim.id];
        const same = f && f.t === 'num' &&
          Math.abs((f.lo == null ? -Infinity : f.lo) - (g.lo === -Infinity ? -Infinity : rlo)) < 1e-9 &&
          Math.abs((f.hi == null ? Infinity : f.hi) - (g.hi === Infinity ? Infinity : rhi)) < 1e-9;
        if (same) clearDim(dim.id);
        else setRange(dim.id, rlo, rhi);
      } else if (dim.type === 'highcat') {
        select(g.value);
      } else {
        toggleCat(dim.id, g.label);
      }
    });

    const tip = $('tip');
    $('chart-wrap').addEventListener('mousemove', e => {
      const t = e.target.closest('[data-i]');
      if (!t) { tip.style.display = 'none'; return; }
      const g = chartMeta[+t.dataset.i];
      if (!g) return;
      tip.innerHTML = '<b>' + esc(g.label) + '</b><br>总记录 ' + g.total + ' · 命中 ' + g.kept +
        (g.total ? ' · 占比 ' + Math.round(100 * g.kept / Math.max(1, RECORDS.length)) + '%（全集）' : '');
      tip.style.display = 'block';
      tip.style.left = Math.min(window.innerWidth - 170, e.clientX + 14) + 'px';
      tip.style.top = (e.clientY + 12) + 'px';
    });
    $('chart-wrap').addEventListener('mouseleave', () => { tip.style.display = 'none'; });

    $('list').addEventListener('click', e => {
      const row = e.target.closest('.row[data-id]');
      if (row) select(row.dataset.id);
    });

    $('history').addEventListener('click', e => {
      const li = e.target.closest('li[data-kind]');
      if (!li) return;
      if (li.dataset.kind === 'past') restorePast(+li.dataset.i);
      else if (li.dataset.kind === 'future') restoreFuture(+li.dataset.i);
    });

    // 高基数折叠开关位于图例（chart-foot），单独接线
    $('legend').addEventListener('click', e => {
      if (e.target.closest('[data-ui="tops"]')) { topExpanded = !topExpanded; renderAll(); }
    });

    let qTimer = null;
    $('search').addEventListener('input', e => {
      clearTimeout(qTimer);
      const v = e.target.value.trim();
      qTimer = setTimeout(() => setSearch(v), 380);
    });
    $('search').addEventListener('keydown', e => {
      if (e.key === 'Enter') { clearTimeout(qTimer); setSearch(e.target.value.trim()); }
    });

    $('sort').addEventListener('change', e => {
      const s = snap(); s.sort = e.target.value;
      commit('排序 → ' + SORTS[s.sort][0], s);
    });

    document.addEventListener('keydown', e => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      if (k === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      else if ((k === 'z' && e.shiftKey) || k === 'y') { e.preventDefault(); redo(); }
    });

    let rsz = null;
    window.addEventListener('resize', () => {
      clearTimeout(rsz);
      rsz = setTimeout(() => renderChart(filtered()), 150);
    });
  }

  /* ---------------- 启动 / 自动化取证钩子 ---------------- */
  // 错误可见化：无头截图与 DOM 转储中能直接暴露 JS 异常
  window.onerror = function (msg, src, line) {
    document.title = 'JSERROR: ' + msg + ' @' + (src || '').split('/').pop() + ':' + line;
    const b = document.createElement('div');
    b.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:99;background:#7a1f1f;color:#fff;padding:6px 12px;font:12px Consolas,monospace';
    b.textContent = 'JSERROR: ' + msg + ' @' + (src || '').split('/').pop() + ':' + line;
    document.body.appendChild(b);
  };
  // 真实交互经同一状态机，供自动化浏览器取证（#scenario=b|c|d）
  window.__prism = {
    toggleCat, setRange, setSearch, select, setProjection, undo, resetAll, reseed,
    state: () => present.state, kept: () => filtered().length,
  };
  function runScenario(name) {
    const b = [
      () => toggleCat('continent', '亚洲'),
      () => setRange('population', 100, 500),
      () => { const r = filtered()[2]; if (r) select(r.id); },
      () => { document.getElementById('list').scrollTop = 800; },
      () => setProjection('climate'),
    ];
    const steps = {
      b: b,
      c: b.concat([() => undo()]),                              // 撤销「投影→气候带」：投影回大洲，筛选与锚点保留
      d: b.concat([() => setProjection('name')]),               // 高基数投影（Top-K 折叠）
    };
    const seq = steps[name];
    if (seq) seq.forEach((fn, i) => setTimeout(fn, 350 * (i + 1)));
  }

  wire();
  renderAll();
  const sc = (location.hash.match(/scenario=([a-z])/) || [])[1];
  if (sc) runScenario(sc);
})();
