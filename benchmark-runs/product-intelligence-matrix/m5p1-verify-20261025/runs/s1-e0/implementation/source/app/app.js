/* 多维棱镜 · 应用核心
 * 状态模型（SDIR state_ownership）：
 *   query     = filters + axes + measure（每次变更加入带归属的轨迹，可回滚）
 *   selection = pinned 锚定集合（跨换轴持久）
 *   viewport  = expanded 展开态 / 滚动（不进轨迹）
 *   mode      = sortDir（顶栏持有，同样入轨迹）
 * 成功标准：换轴动作白名单化 —— 只触碰 rowDim/colDim，其余全部保留。
 */
(function () {
  'use strict';
  const CUBE = window.CUBE;
  const DIMS = CUBE.dims, TREES = CUBE.trees, ROWS = CUBE.rows, MEASURES = CUBE.measures;
  const $ = (sel) => document.querySelector(sel);
  const dimById = Object.fromEntries(DIMS.map((d) => [d.id, d]));
  const measureById = Object.fromEntries(MEASURES.map((m) => [m.id, m]));

  /* ---------- 格式化 ---------- */
  const fmtMoney = (v) => {
    const a = Math.abs(v);
    if (a >= 1e8) return '¥' + (v / 1e8).toFixed(2) + '亿';
    if (a >= 1e4) return '¥' + (v / 1e4).toFixed(1) + '万';
    return '¥' + Math.round(v);
  };
  const fmtInt = (v) => Math.round(v).toLocaleString('zh-CN');
  const fmtPct = (v) => (v * 100).toFixed(1) + '%';
  function fmtMeasure(id, v) {
    if (!isFinite(v)) return '—'; // 空交点（如退货率 0 记录）
    const f = measureById[id].fmt;
    return f === 'money' ? fmtMoney(v) : f === 'int' ? fmtInt(v) : fmtPct(v);
  }

  /* ---------- 初始状态 ---------- */
  function initialState() {
    const filters = {}, expanded = {};
    DIMS.forEach((d) => { filters[d.id] = []; expanded[d.id] = []; });
    // 默认轴：客群 × 季度（平坦×平坦的总览 landing）。
    // 理由：a) 维度轨道在 1280×860 不滚动（防裁剪焦点停准点/覆盖碰撞）；
    // b) 初始投影不含行头树焦点停准点，避免与左栏跨列焦点序回跳；
    // 层级维度（品类/渠道/区域）经行头/轨道 ▸ 一步可达。
    return {
      filters,
      rowDim: 'segment', colDim: 'quarter',
      measure: 'revenue', sortDir: 'desc',
      pinned: [], expanded
    };
  }
  let state = initialState();

  /* ---------- 状态轨迹（归属 + 回退） ---------- */
  const TRAIL_MAX = 50;
  let trail = [], ptr = -1;
  const clone = (s) => JSON.parse(JSON.stringify(s));
  function pushOp(label, origin) {
    // 轨迹记录：动作 + 来源归属 + 快照。未来分支（回滚后产生新操作）按撤销语义截断。
    // 首条「初始状态」永不移除：重置动作以它为基准。
    trail = trail.slice(0, ptr + 1);
    trail.push({ label, origin, ts: new Date(), snap: clone(state) });
    if (trail.length > TRAIL_MAX) trail.splice(1, 1);
    ptr = trail.length - 1;
  }
  function jumpTo(i) {
    if (i < 0 || i >= trail.length) return;
    ptr = i;
    state = clone(trail[i].snap);
    render({ jumped: true });
  }
  const undo = () => jumpTo(ptr - 1);
  const redo = () => jumpTo(ptr + 1);
  function resetAll() {
    state = clone(trail[0].snap);
    pushOp('重置全部状态', { source: '顶栏', detail: '恢复初始快照' });
    render();
    toast('已重置全部状态（可在轨迹中回退到重置前）');
  }

  /* ---------- 过滤语义：同维度值之间 OR，跨维度 AND ---------- */
  function findNode(dimId, id) {
    let found = null;
    (function walk(n) {
      if (n.id === id) { found = n; return; }
      n.children.forEach(walk);
    })(TREES[dimId]);
    return found;
  }
  function computeFiltered() {
    const allow = {};
    for (const d of DIMS) {
      const checked = state.filters[d.id];
      if (!checked.length) continue;
      const set = new Set();
      checked.forEach((id) => {
        const n = findNode(d.id, id);
        (function collect(x) {
          if (!x.children.length) set.add(x.id);
          x.children.forEach(collect);
        })(n);
      });
      allow[d.id] = set;
    }
    const idxs = [];
    outer: for (let i = 0; i < ROWS.length; i++) {
      const r = ROWS[i];
      for (const d in allow) if (!allow[d].has(r[d])) continue outer;
      idxs.push(i);
    }
    return idxs;
  }
  function aggregate(idxs, measureId) {
    let revenue = 0, profit = 0, orders = 0, returns = 0;
    for (const i of idxs) {
      const r = ROWS[i];
      revenue += r.revenue; profit += r.profit; orders += r.orders; returns += r.returns;
    }
    if (measureId === 'revenue') return revenue;
    if (measureId === 'profit') return profit;
    if (measureId === 'orders') return orders;
    return orders ? returns / orders : NaN; // returnRate
  }

  /* ---------- 行树扁平化（viewport：展开态记忆在各维度名下，跨换轴保留） ----------
   * topOrder 仅对顶层行生效（排序），子孙保持层级自然序，不打散树形分组。 */
  function flattenRows(dimId, topOrder) {
    const out = [];
    (function walk(node, depth) {
      const kids = depth === 0 && topOrder ? topOrder(node.children) : node.children;
      kids.forEach((c) => {
        out.push({ node: c, depth });
        if (state.expanded[dimId].includes(c.id)) walk(c, depth + 1);
      });
    })(TREES[dimId], 0);
    return out;
  }

  /* ---------- 热力梯度（靛蓝单色，11 档） ----------
   * 亮度上限刻意压住（最深处仍与正文色保持 ≥4.5:1），
   * 因此格内数值统一用深色文字，全矩阵无一处低于 AA。 */
  const RAMP = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    const mix = (a, b) => Math.round(a + (b - a) * t);
    RAMP.push(`rgb(${mix(244, 140)},${mix(245, 137)},${mix(253, 206)})`);
  }
  const heatIdx = (v, max) => (max > 0 && isFinite(v) && v >= 0 ? Math.min(10, Math.round((v / max) * 10)) : 0);

  /* ---------- 操作入口（全部记入轨迹） ---------- */
  let toastTimer = null;
  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
  }
  function contextAnchorNote() {
    const nF = DIMS.reduce((s, d) => s + state.filters[d.id].length, 0);
    const nP = state.pinned.length;
    return `已保留 ${nF} 项过滤 · ${nP} 处锚定 · 度量「${measureById[state.measure].name}」 · 排序${state.sortDir === 'desc' ? '降序' : '升序'}`;
  }

  function toggleFilter(dimId, nodeId, label) {
    const arr = state.filters[dimId];
    const adding = !arr.includes(nodeId);
    if (adding) arr.push(nodeId); else arr.splice(arr.indexOf(nodeId), 1);
    pushOp(`${adding ? '过滤＋' : '过滤－'} ${dimById[dimId].name}·${label}`,
      { source: '维度轨道', detail: `${dimById[dimId].name}面板勾选` });
    render();
  }
  function clearFilters() {
    DIMS.forEach((d) => { state.filters[d.id] = []; });
    pushOp('清除全部过滤', { source: '状态归属栏', detail: '一键清空' });
    render();
  }
  function setAxis(axis, dimId, via) {
    if (axis === 'row') {
      if (state.rowDim === dimId) return;
      if (state.colDim === dimId) { // 交换行列
        state.colDim = state.rowDim; state.rowDim = dimId;
        pushOp(`换轴 · 行/列交换为 ${dimById[dimId].name}`, { source: via, detail: '目标维度已在另一轴，执行交换' });
      } else {
        state.rowDim = dimId;
        pushOp(`换轴 · 行维度 → ${dimById[dimId].name}`, { source: via, detail: '投影重排' });
      }
    } else {
      if (state.colDim === dimId) return;
      if (state.rowDim === dimId) {
        state.rowDim = state.colDim; state.colDim = dimId;
        pushOp(`换轴 · 行/列交换为 ${dimById[dimId].name}`, { source: via, detail: '目标维度已在另一轴，执行交换' });
      } else {
        state.colDim = dimId;
        pushOp(`换轴 · 列维度 → ${dimById[dimId].name}`, { source: via, detail: '投影重排' });
      }
    }
    render();
    toast('维度已切换 · ' + contextAnchorNote()); // 认知锚回显：换轴不重置
  }
  function toggleExpand(dimId, nodeId) { // viewport 态，不入轨迹
    const arr = state.expanded[dimId];
    const i = arr.indexOf(nodeId);
    if (i >= 0) arr.splice(i, 1); else arr.push(nodeId);
    render();
  }
  function togglePin(ref) {
    const key = (p) => p.rowDim + '|' + p.rowPath + '|' + p.colDim + '|' + p.colValue;
    const i = state.pinned.findIndex((p) => key(p) === key(ref));
    const adding = i < 0;
    if (adding) state.pinned.push(ref); else state.pinned.splice(i, 1);
    pushOp(`${adding ? '锚定＋' : '锚定－'} ${ref.rowLabel} × ${ref.colValue}`,
      { source: '投影区', detail: '单元格点击' });
    render();
  }
  function setMeasure(id) {
    if (state.measure === id) return;
    state.measure = id;
    pushOp(`度量 → ${measureById[id].name}`, { source: '顶栏', detail: '度量选择器' });
    render();
  }
  function toggleSort() {
    state.sortDir = state.sortDir === 'desc' ? 'asc' : 'desc';
    pushOp(`排序 → ${state.sortDir === 'desc' ? '降序' : '升序'}`, { source: '顶栏', detail: '排序切换' });
    render();
  }
  function unpinChip(i) {
    const p = state.pinned[i];
    state.pinned.splice(i, 1);
    pushOp(`锚定－ ${p.rowLabel} × ${p.colValue}`, { source: '状态归属栏', detail: 'chip 移除' });
    render();
  }

  /* ---------- 渲染 ---------- */
  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function renderRail(filtered, inFiltered) {
    const root = $('#dimRail');
    root.innerHTML = '';
    DIMS.forEach((d) => {
      const sec = el('section', 'dim-block');
      const totalAgg = aggregate(filtered, state.measure);
      const isRow = state.rowDim === d.id, isCol = state.colDim === d.id;
      const head = el('div', 'dim-head');
      head.innerHTML =
        `<span class="dim-name">${esc(d.name)}</span>` +
        `<span class="dim-levels">${d.levels.join('›')}</span>` +
        `<span class="axis-badges">${isRow ? '<b class="ax ax-r">行</b>' : ''}${isCol ? '<b class="ax ax-c">列</b>' : ''}</span>`;
      const btns = el('div', 'dim-actions');
      const bR = el('button', 'mini-btn' + (isRow ? ' on' : ''), '行轴');
      bR.title = '设为行维度（保留过滤/锚定/度量）';
      bR.onclick = () => setAxis('row', d.id, '维度轨道');
      const bC = el('button', 'mini-btn' + (isCol ? ' on' : ''), '列轴');
      bC.title = '设为列维度（保留过滤/锚定/度量）';
      bC.onclick = () => setAxis('col', d.id, '维度轨道');
      btns.append(bR, bC);
      head.appendChild(btns);
      sec.appendChild(head);

      const list = el('div', 'dim-values');
      (function walk(node, depth) {
        node.children.forEach((c) => {
          const checked = state.filters[d.id].includes(c.id);
          const expanded = state.expanded[d.id].includes(c.id);
          const agg = aggregate(c.rec.filter((i) => inFiltered.has(i)), state.measure);
          const pct = totalAgg > 0 ? Math.min(100, (agg / totalAgg) * 100) : 0;
          const row = el('div', 'val-row' + (checked ? ' checked' : ''));
          row.style.paddingLeft = (8 + depth * 14) + 'px';
          const caret = c.children.length
            ? `<button class="caret" data-dim="${d.id}" data-id="${esc(c.id)}" aria-label="展开/收起">${expanded ? '▾' : '▸'}</button>`
            : '<span class="caret none"></span>';
          row.innerHTML =
            caret +
            `<label class="val-label"><input type="checkbox" data-dim="${d.id}" data-id="${esc(c.id)}" ${checked ? 'checked' : ''}>` +
            `<span class="val-name">${esc(c.label)}</span></label>` +
            `<span class="val-share"><i style="width:${pct.toFixed(1)}%"></i></span>`;
          list.appendChild(row);
          if (expanded) walk(c, depth + 1);
        });
      })(TREES[d.id], 0);
      sec.appendChild(list);
      root.appendChild(sec);
    });
  }

  function renderAttribution(filteredCount) {
    const bar = $('#attrBar');
    bar.innerHTML = '';
    const left = el('div', 'attr-left');
    left.innerHTML = '<span class="attr-title">状态归属</span>';
    let nF = 0;
    DIMS.forEach((d) => state.filters[d.id].forEach((id) => {
      nF++;
      const node = findNode(d.id, id);
      const chip = el('span', 'chip chip-filter',
        `<em class="chip-dim">${esc(d.name)}</em>${esc(node.label)}` +
        `<i class="origin" title="来源归属：维度轨道面板勾选">维度轨道</i>` +
        `<button class="chip-x" data-kind="filter" data-dim="${d.id}" data-id="${esc(id)}" aria-label="移除过滤">×</button>`);
      left.appendChild(chip);
    }));
    state.pinned.forEach((p, i) => {
      const dangling = p.rowDim !== state.rowDim || p.colDim !== state.colDim;
      const chip = el('span', 'chip chip-pin' + (dangling ? ' dangling' : ''),
        `★ ${esc(p.rowLabel)}×${esc(p.colValue)}` +
        `<span class="pin-val">${fmtMeasure(p.measure, p.value)}</span>` +
        (dangling ? '<i class="origin warn" title="锚定所在投影已被切换，切回后自动复显">悬空</i>'
                  : '<i class="origin">投影区</i>') +
        `<button class="chip-x" data-kind="pin" data-i="${i}" aria-label="移除锚定">×</button>`);
      left.appendChild(chip);
    });
    if (!nF && !state.pinned.length) {
      left.appendChild(el('span', 'attr-empty', '无过滤 · 无锚定（即初始状态）'));
    }
    const right = el('div', 'attr-right');
    right.innerHTML = `<span class="rec-count">记录 <b>${fmtInt(filteredCount)}</b> / ${fmtInt(ROWS.length)}</span>`;
    if (nF || state.pinned.length) {
      const clear = el('button', 'mini-btn', '清除全部');
      clear.onclick = clearFilters;
      right.appendChild(clear);
    }
    bar.append(left, right);
  }

  function renderGrid(filtered) {
    const wrap = $('#gridWrap');
    wrap.innerHTML = '';
    if (!filtered.length) { // 空态（state_completeness）
      const empty = el('div', 'empty-panel');
      empty.innerHTML = '<h3>当前过滤组合下没有记录</h3><p>过滤器把记录集缩小到了 0 条 —— 认知上下文仍在，可清除过滤或回滚轨迹。</p>';
      const b = el('button', 'btn primary', '清除全部过滤');
      b.onclick = clearFilters;
      empty.appendChild(b);
      wrap.appendChild(empty);
      return;
    }
    const rowDimId = state.rowDim, colDimId = state.colDim;
    const m = state.measure;
    const colNodes = TREES[colDimId].children;

    // 列过滤索引
    const colRecs = colNodes.map((c) => {
      const set = new Set();
      c.rec.forEach((i) => set.add(i));
      return set;
    });
    const inFiltered = new Set(filtered);
    const aggOf = (node) => aggregate(node.rec.filter((i) => inFiltered.has(i)), m);

    // 排序：仅对顶层行生效（children 保持层级自然序，不打散树形分组）
    let topOrder = null;
    if (state.sortDir !== 'none') {
      const aggById = new Map(TREES[rowDimId].children.map((c) => [c.id, aggOf(c)]));
      const sorted = [...TREES[rowDimId].children].sort((a, b) =>
        state.sortDir === 'desc' ? aggById.get(b.id) - aggById.get(a.id)
                                 : aggById.get(a.id) - aggById.get(b.id));
      const order = new Map(sorted.map((n, i) => [n.id, i]));
      topOrder = (kids) => [...kids].sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
    }
    const rowItems = flattenRows(rowDimId, topOrder);
    rowItems.forEach((ri) => { ri.agg = aggOf(ri.node); });

    // 热力归一化：以当前矩阵最大值为 1
    let max = 0;
    rowItems.forEach((ri) => {
      ri.cells = colNodes.map((cn, ci) => {
        const idxs = ri.node.rec.filter((i) => inFiltered.has(i) && colRecs[ci].has(i));
        return { v: aggregate(idxs, m), n: idxs.length };
      });
      ri.cells.forEach((c) => { if (isFinite(c.v)) max = Math.max(max, c.v); });
    });

    // 锚定命中检测（跨换轴持久：同轴同路径才高亮，否则在归属栏显示“悬空”）
    const pinHits = new Set();
    state.pinned.forEach((p) => {
      if (p.rowDim === rowDimId && p.colDim === colDimId) pinHits.add(p.rowPath + '|' + p.colValue);
    });

    const title = `行[${dimById[rowDimId].name}] × 列[${dimById[colDimId].name}] · ${measureById[m].name}`;
    $('#gridTitle').textContent = '投影 ' + title;
    $('#ctxAnchor').textContent = contextAnchorNote();

    const table = el('table', 'xgrid');
    const thead = el('thead');
    const hr = el('tr');
    hr.innerHTML = `<th class="rh corner">${esc(dimById[rowDimId].name)} \\ ${esc(dimById[colDimId].name)}</th>`;
    colNodes.forEach((cn, ci) => {
      const tot = colRecs[ci].size ? filtered.filter((i) => colRecs[ci].has(i)).length : 0;
      const share = filtered.length ? (tot / filtered.length * 100) : 0;
      hr.innerHTML += `<th class="ch"><span>${esc(cn.label)}</span><i>${share.toFixed(0)}%</i></th>`;
    });
    hr.innerHTML += '<th class="ch total">合计</th>';
    thead.appendChild(hr);
    table.appendChild(thead);

    const tbody = el('tbody');
    rowItems.forEach((ri) => {
      const tr = el('tr');
      const hasKids = ri.node.children.length > 0;
      const expanded = state.expanded[rowDimId].includes(ri.node.id);
      const rh = el('th', 'rh');
      rh.style.paddingLeft = (10 + ri.depth * 16) + 'px';
      rh.innerHTML =
        (hasKids ? `<button class="caret" data-dim="${rowDimId}" data-id="${esc(ri.node.id)}" aria-label="下钻/上卷">${expanded ? '▾' : '▸'}</button>` : '<span class="caret none"></span>') +
        `<span class="rh-name">${esc(ri.node.label)}</span>` +
        `<span class="rh-agg">${fmtMeasure(m, ri.agg)}</span>`;
      tr.appendChild(rh);
      ri.cells.forEach((c, ci) => {
        const td = el('td', 'cell');
        const idx = heatIdx(c.v, max);
        td.style.background = RAMP[idx];
        const key = ri.node.id + '|' + colNodes[ci].label;
        if (pinHits.has(key)) td.classList.add('pinned');
        if (!c.n) td.classList.add('void');
        td.dataset.rowPath = ri.node.id;
        td.dataset.rowLabel = ri.node.label;
        td.dataset.rowDepth = ri.depth;
        td.dataset.colIdx = ci;
        td.dataset.colValue = colNodes[ci].label;
        td.dataset.value = c.v;
        td.dataset.count = c.n;
        td.innerHTML = c.n
          ? `<span class="cell-v">${fmtMeasure(m, c.v)}</span>`
          : '<span class="cell-void">—</span>';
        tr.appendChild(td);
      });
      const tot = el('td', 'cell total', `<span class="cell-v">${fmtMeasure(m, ri.agg)}</span>`);
      tot.style.background = RAMP[heatIdx(ri.agg, max)];
      tr.appendChild(tot);
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    wrap.appendChild(table);
  }

  function renderTrail() {
    const t = $('#trail');
    t.innerHTML = '<span class="trail-title">状态轨迹</span>';
    const strip = el('div', 'trail-strip');
    trail.forEach((e, i) => {
      const past = i <= ptr;
      const c = el('button', 'trail-item' + (i === ptr ? ' current' : past ? ' past' : ' future'));
      const tm = new Date(e.ts);
      c.innerHTML = `<b>${i + 1}</b> ${esc(e.label)}<i class="origin">${esc(e.origin.source)}</i>` +
        `<time>${String(tm.getMinutes()).padStart(2, '0')}:${String(tm.getSeconds()).padStart(2, '0')}</time>`;
      c.title = `回滚到「${e.label}」\n来源：${e.origin.source}${e.origin.detail ? ' · ' + e.origin.detail : ''}`;
      c.onclick = () => { jumpTo(i); toast(`已回滚到第 ${i + 1} 步「${e.label}」`); };
      strip.appendChild(c);
    });
    t.appendChild(strip);
  }

  function renderTopbar(filtered) {
    $('#measureSel').value = state.measure;
    $('#sortBtn').textContent = state.sortDir === 'desc' ? '排序↓' : '排序↑';
    $('#undoBtn').disabled = ptr <= 0;
    $('#redoBtn').disabled = ptr >= trail.length - 1;
    $('#recMain').textContent = `记录 ${fmtInt(filtered.length)} / ${fmtInt(ROWS.length)}`;
  }

  function render(opts) {
    try {
      const filtered = computeFiltered();
      renderRail(filtered, new Set(filtered));
      renderAttribution(filtered.length);
      renderGrid(filtered);
      renderTrail();
      renderTopbar(filtered);
      $('#fatal').hidden = true;
      if (opts && opts.jumped) { /* 回滚渲染，不追加轨迹 */ }
    } catch (err) { // error 态（state_completeness）
      console.error(err);
      $('#fatalMsg').textContent = String(err && err.message || err);
      $('#fatal').hidden = false;
    }
  }

  /* ---------- 单元格悬浮预览（cell-inspector，contextual） ---------- */
  const tip = $('#cellTip');
  $('#gridWrap').addEventListener('mousemove', (e) => {
    const td = e.target.closest('td.cell');
    if (!td || td.classList.contains('total')) { tip.classList.remove('show'); return; }
    const m = state.measure;
    const v = +td.dataset.value;
    tip.innerHTML =
      `<b>${esc(td.dataset.rowLabel)}</b> × <b>${esc(td.dataset.colValue)}</b><br>` +
      `${measureById[m].name}：<b>${+td.dataset.count ? fmtMeasure(m, v) : '—'}</b><br>` +
      `记录数：${fmtInt(+td.dataset.count)} · 全集占比 ${(td.dataset.count / ROWS.length * 100).toFixed(1)}%<br>` +
      '<i>点击锚定 / 再次点击取消（换轴后保留）</i>';
    tip.classList.add('show');
    const panelRect = $('#gridPanel').getBoundingClientRect(); // tip 的绝对定位上下文是 gridPanel
    tip.style.left = Math.min(e.clientX - panelRect.left + 14, panelRect.width - 250) + 'px';
    tip.style.top = (e.clientY - panelRect.top + 16) + 'px';
  });
  $('#gridWrap').addEventListener('mouseleave', () => tip.classList.remove('show'));

  /* ---------- 事件绑定 ---------- */
  document.addEventListener('click', (e) => {
    const caret = e.target.closest('button.caret');
    if (caret) { toggleExpand(caret.dataset.dim, caret.dataset.id); return; }
    const chipX = e.target.closest('.chip-x');
    if (chipX) {
      if (chipX.dataset.kind === 'filter') {
        const dimId = chipX.dataset.dim, id = chipX.dataset.id;
        state.filters[dimId].splice(state.filters[dimId].indexOf(id), 1);
        pushOp(`过滤－ ${dimById[dimId].name}·${findNode(dimId, id).label}`,
          { source: '状态归属栏', detail: 'chip 单独移除' });
        render();
      } else unpinChip(+chipX.dataset.i);
      return;
    }
    const cell = e.target.closest('td.cell:not(.total)');
    if (cell && cell.dataset.count !== '0') {
      togglePin({
        rowDim: state.rowDim, colDim: state.colDim,
        rowPath: cell.dataset.rowPath, rowLabel: cell.dataset.rowLabel,
        colValue: cell.dataset.colValue, measure: state.measure,
        value: +cell.dataset.value
      });
    }
  });
  document.addEventListener('change', (e) => {
    const cb = e.target.closest('input[type="checkbox"][data-dim]');
    if (cb) {
      const label = findNode(cb.dataset.dim, cb.dataset.id).label;
      toggleFilter(cb.dataset.dim, cb.dataset.id, label);
    }
  });
  $('#rowSel').addEventListener('change', (e) => setAxis('row', e.target.value, '投影区'));
  $('#colSel').addEventListener('change', (e) => setAxis('col', e.target.value, '投影区'));
  $('#measureSel').addEventListener('change', (e) => setMeasure(e.target.value));
  $('#sortBtn').addEventListener('click', toggleSort);
  $('#undoBtn').addEventListener('click', undo);
  $('#redoBtn').addEventListener('click', redo);
  $('#resetBtn').addEventListener('click', resetAll);
  document.addEventListener('keydown', (e) => { // 键盘契约：撤销 / 重做
    if (!(e.ctrlKey || e.metaKey)) return;
    const k = e.key.toLowerCase();
    if (k === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
    else if ((k === 'z' && e.shiftKey) || k === 'y') { e.preventDefault(); redo(); }
  });

  /* ---------- 轴选择器 / 度量选择器选项 ---------- */
  function fillAxisSelects() {
    const opts = DIMS.map((d) => `<option value="${d.id}">${d.name}</option>`).join('');
    $('#rowSel').innerHTML = opts; $('#colSel').innerHTML = opts;
    $('#measureSel').innerHTML = MEASURES.map((mm) => `<option value="${mm.id}">${mm.name}</option>`).join('');
  }

  /* ---------- 启动：数据内联就绪，首帧即完整应用（无加载态） ---------- */
  fillAxisSelects();
  pushOp('初始状态', { source: '系统', detail: CUBE.meta.generatedBy });
  ptr = 0;
  render();
})();
