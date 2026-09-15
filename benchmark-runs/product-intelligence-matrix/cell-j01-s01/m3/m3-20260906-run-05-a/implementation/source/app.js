/* =========================================================
 * 目录矩阵 · 商品层级管理台 — 应用逻辑
 * 设计要点（对应验收种子「批量选择与操作零误伤，状态归属显式」）：
 *  1. 选择永远显式：行/品类/事业部/全库四级勾选，跨筛选持久，
 *     被筛选隐藏的已选条目以警告条+徽标显式披露，绝不静默扩大或丢失。
 *  2. 批量操作先预演：确认弹窗给出逐条影响清单、分组归属、
 *     状态迁移 before→after、跳过原因与保护拦截，确认后才落库。
 *  3. 状态归属显式：每行常驻归属路径列；每次变更写入操作日志
 *     （影响清单全量留痕），支持一键撤销。
 * ======================================================= */
(function () {
  'use strict';

  const { divisions, categories, statusMeta } = window.CATALOG;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const catById = new Map(categories.map((c) => [c.id, c]));
  const divById = new Map(divisions.map((d) => [d.id, d]));

  /* ---------------- 状态 ---------------- */
  const S = {
    products: [],
    selection: new Set(),
    statusFilter: new Set(),      // 空 = 全部状态
    search: '',
    scope: null,                  // null=全部 | {type:'div',id} | {type:'cat',id}
    expanded: new Set(divisions.map((d) => d.id)),
    log: [],
    seq: 0,
    lastOp: null,                 // 撤销快照
    activeOp: null,               // 当前确认弹窗
  };

  function resetState() {
    S.products = window.CATALOG.products.map((p) => ({ ...p, tags: [...p.tags] }));
    S.selection.clear(); S.statusFilter.clear(); S.search = '';
    S.scope = null; S.expanded = new Set(divisions.map((d) => d.id));
    S.log = []; S.seq = 0; S.lastOp = null; S.activeOp = null;
  }

  /* ---------------- 派生 ---------------- */
  const byId = () => { const m = new Map(); S.products.forEach((p) => m.set(p.id, p)); return m; };
  const pathOf = (p) => `${divById.get(p.divisionId).name} / ${catById.get(p.categoryId).name}`;

  function inScope(p) {
    if (!S.scope) return true;
    return S.scope.type === 'div' ? p.divisionId === S.scope.id : p.categoryId === S.scope.id;
  }
  function matchesFilter(p) {
    if (S.statusFilter.size && !S.statusFilter.has(p.status)) return false;
    if (S.search) {
      const q = S.search.toLowerCase();
      if (!(p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q) ||
            p.supplier.toLowerCase().includes(q) || p.owner.toLowerCase().includes(q))) return false;
    }
    return true;
  }
  function visibleProducts() { return S.products.filter((p) => inScope(p) && matchesFilter(p)); }

  /* ---------------- 渲染：状态筛选条 ---------------- */
  function statusCounts() {
    const m = { online: 0, offline: 0, draft: 0, review: 0 };
    S.products.forEach((p) => m[p.status]++);
    return m;
  }
  function renderChips() {
    const c = statusCounts();
    $('statusBar').innerHTML =
      `<span class="filterbar-label">状态：</span>` +
      Object.entries(statusMeta).map(([k, meta]) =>
        `<span class="stchip ${S.statusFilter.has(k) ? 'on' : ''}" data-st="${k}" role="button" tabindex="0">` +
        `<span class="dot dot-${k}"></span>${meta.label} <b>${c[k]}</b></span>`).join('') +
      (S.statusFilter.size || S.search
        ? `<button class="linklike" id="chipClear" type="button" style="margin-left:6px">清除全部筛选</button>` : '');
  }

  /* ---------------- 渲染：层级树 ---------------- */
  function groupSelState(ids) {
    let n = 0;
    ids.forEach((id) => { if (S.selection.has(id)) n++; });
    return n === 0 ? 0 : (n === ids.length ? 2 : 1);
  }
  const cbHtml = (scope, state, title) =>
    `<input type="checkbox" data-sel-scope="${scope}" ${state === 2 ? 'checked' : ''} title="${title}" ${state === 1 ? 'data-tri="1"' : ''}>`;
  function triSync(el, state) {
    el.checked = state === 2; el.indeterminate = state === 1;
  }

  function renderTree() {
    const live = S.products;
    const allIds = live.map((p) => p.id);
    const rows = [];
    rows.push(`<div class="tree-node ${!S.scope ? 'active' : ''}">
      ${cbHtml('all', groupSelState(allIds), '选择全库所有商品')}
      <button class="tree-caret leaf" tabindex="-1"></button>
      <span class="tree-name" data-scope="all">全部商品</span>
      <span class="tree-count">${allIds.length}</span></div>`);

    divisions.forEach((d) => {
      const dCats = categories.filter((c) => c.div === d.id);
      const dIds = live.filter((p) => p.divisionId === d.id).map((p) => p.id);
      const open = S.expanded.has(d.id);
      const selN = [...S.selection].filter((id) => dIds.includes(id)).length;
      rows.push(`<div class="tree-division">
        <div class="tree-node ${S.scope && S.scope.type === 'div' && S.scope.id === d.id ? 'active' : ''} ${selN ? 'partial' : ''}">
          ${cbHtml('div:' + d.id, groupSelState(dIds), `选择「${d.name}」全部商品`)}
          <button class="tree-caret ${open ? 'open' : ''}" data-caret="${d.id}" aria-label="展开/收起">▶</button>
          <span class="tree-name" data-scope="div:${d.id}">${esc(d.name)}</span>
          <span class="tree-count">${selN ? selN + '/' : ''}${dIds.length}</span>
        </div>
        ${open ? `<div class="tree-children">` + dCats.map((c) => {
          const cIds = live.filter((p) => p.categoryId === c.id).map((p) => p.id);
          const cSel = [...S.selection].filter((id) => cIds.includes(id)).length;
          const note = cIds.length ? visibleHideNote(cIds) : '';
          return `<div>
            <div class="tree-node ${S.scope && S.scope.type === 'cat' && S.scope.id === c.id ? 'active' : ''} ${cSel ? 'partial' : ''}">
              ${cbHtml('cat:' + c.id, groupSelState(cIds), `选择「${c.name}」全部商品`)}
              <button class="tree-caret leaf" tabindex="-1"></button>
              <span class="tree-name" data-scope="cat:${c.id}">${esc(c.name)}</span>
              <span class="tree-count">${cSel ? cSel + '/' : ''}${cIds.length}</span>
            </div>${note}</div>`;
        }).join('') + `</div>` : ''}
      </div>`);
    });
    $('tree').innerHTML = rows.join('');
    $('treeFoot').innerHTML =
      `<span>事业部 ${divisions.length}</span><span>品类 ${categories.length}</span><span>商品 ${live.length}</span>`;
  }
  // 品类内被当前筛选隐藏的数量提示（归属显式：勾选 = 整个品类，含被隐藏者）
  function visibleHideNote(catIds) {
    const hidden = catIds.filter((id) => {
      const p = S.products.find((x) => x.id === id);
      return p && inScope(p) && !matchesFilter(p);
    }).length;
    return hidden ? `<div class="tree-hidden-note">⚠ 其中 ${hidden} 条被当前筛选隐藏，勾选将一并选中</div>` : '';
  }

  /* ---------------- 渲染：表格 ---------------- */
  function renderTable() {
    const vis = visibleProducts();
    const groups = new Map();
    vis.forEach((p) => {
      if (!groups.has(p.categoryId)) groups.set(p.categoryId, []);
      groups.get(p.categoryId).push(p);
    });
    const body = [];
    categories.forEach((c) => {
      const list = groups.get(c.id);
      if (!list || !list.length) return;
      const div = divById.get(c.div);
      const allInCat = S.products.filter((p) => p.categoryId === c.id);
      const hiddenInCat = allInCat.length - list.length;
      const gs = groupSelState(allInCat.map((p) => p.id));
      body.push(`<tr class="group-row"><td class="col-check">${cbHtml('cat:' + c.id, gs, `选择「${c.name}」全部 ${allInCat.length} 条`)}</td>
        <td colspan="7"><span class="group-title">${esc(div.name)} <span class="sep">/</span> ${esc(c.name)}
        <span class="group-path">${allInCat.length} 条</span>
        ${hiddenInCat ? `<span class="group-note">· 另有 ${hiddenInCat} 条被筛选隐藏（勾选=全品类 ${allInCat.length} 条）</span>` : ''}
        </span></td></tr>`);
      list.forEach((p) => {
        const sel = S.selection.has(p.id);
        const st = statusMeta[p.status];
        body.push(`<tr class="entity ${sel ? 'selected' : ''}" data-id="${p.id}">
          <td class="col-check"><input type="checkbox" data-row="${p.id}" ${sel ? 'checked' : ''} aria-label="选择 ${esc(p.name)}"></td>
          <td class="col-name"><span class="cell-name"><span class="nm" data-detail="${p.id}">${esc(p.name)}</span>
            <span class="sku">${p.id}</span></span></td>
          <td><span class="crumb">${esc(div.name)}<span class="sep">›</span><span class="cat">${esc(c.name)}</span></span></td>
          <td><span class="status-pill ${st.cls}">${st.label}</span></td>
          <td class="col-price">¥${p.price.toLocaleString()}</td>
          <td class="col-stock ${p.stock === 0 ? 'zero-stock' : ''}">${p.stock.toLocaleString()}</td>
          <td class="col-tags">${p.tags.map((t) => `<span class="tag ${t === '主推款' ? 'tag-hot' : t === '新品' ? 'tag-new' : t === '缺货预警' ? 'tag-warn' : ''}">${t}</span>`).join('')}</td>
          <td>${esc(p.owner)}</td></tr>`);
      });
    });
    $('gridBody').innerHTML = body.join('');
    $('emptyState').hidden = vis.length > 0;

    // 表头全选（当前视图）
    const visIds = vis.map((p) => p.id);
    triSync($('masterCheck'), groupSelState(visIds));
    $('masterCheck').disabled = visIds.length === 0;

    // 视图外已选警告
    const hiddenSel = [...S.selection].filter((id) => !visIds.includes(id));
    const hb = $('hiddenBanner');
    hb.hidden = hiddenSel.length === 0;
    if (hiddenSel.length) {
      hb.innerHTML = `<span>⚠ <b>${hiddenSel.length} 条已选商品在当前视图外</b>（被筛选或层级收起隐藏）——批量操作<b>仍将包含</b>它们：
        <span class="mono" style="font-family:var(--mono);font-size:11px">${hiddenSel.slice(0, 4).map(esc).join('、')}${hiddenSel.length > 4 ? ' …' : ''}</span></span>
        <span class="grow"></span>
        <button class="btn btn-sm" id="btnKeepVisible" type="button">仅保留视图内（移除这 ${hiddenSel.length} 条）</button>`;
    }

    // 顶栏信息
    const scopeName = !S.scope ? '全部商品' : S.scope.type === 'div' ? divById.get(S.scope.id).name : catById.get(S.scope.id).name;
    const inScopeN = S.products.filter(inScope).length;
    $('scopeInfo').innerHTML =
      `当前层级：<b>${esc(scopeName)}</b> · 视图内 <b>${vis.length}</b> / ${inScopeN} 条` +
      (S.statusFilter.size ? ` · 状态筛选 ${[...S.statusFilter].map((k) => statusMeta[k].label).join('、')}` : '') +
      (S.search ? ` · 搜索“${esc(S.search)}”` : '');
    renderBatchbar();
  }

  /* ---------------- 渲染：批量栏 / 日志计数 ---------------- */
  function renderBatchbar() {
    const n = S.selection.size;
    $('batchbar').hidden = n === 0;
    if (!n) return;
    $('batchCount').textContent = n;
    const bySt = {};
    [...S.selection].forEach((id) => {
      const p = byId().get(id); if (!p) return;
      bySt[p.status] = (bySt[p.status] || 0) + 1;
    });
    const parts = Object.keys(statusMeta).filter((k) => bySt[k]).map((k) => `${statusMeta[k].label} ${bySt[k]}`);
    const visIds = new Set(visibleProducts().map((p) => p.id));
    const out = [...S.selection].filter((id) => !visIds.has(id)).length;
    $('batchMeta').innerHTML =
      `已选商品（${parts.join(' · ')}）` +
      (out ? `<br>⚠ ${out} 条在当前视图外，操作仍将包含` : '· 所选均在当前视图内');
  }
  function renderLogCount() {
    const el = $('logCount');
    el.hidden = S.log.length === 0;
    el.textContent = S.log.length;
  }

  /* ---------------- 选择操作 ---------------- */
  function toggleGroup(prefix, targetIds) {
    // prefix: 'all' | 'div:xx' | 'cat:xx'；勾选语义 = 该层级下全部商品（含被筛选隐藏者）
    const ids = targetIds();
    const cur = ids.filter((id) => S.selection.has(id)).length;
    if (cur === ids.length) ids.forEach((id) => S.selection.delete(id));
    else ids.forEach((id) => S.selection.add(id));
  }
  function scopedIds(prefix) {
    if (prefix === 'all') return S.products.map((p) => p.id);
    const [type, id] = prefix.split(':');
    return S.products.filter((p) => (type === 'div' ? p.divisionId === id : p.categoryId === id)).map((p) => p.id);
  }

  /* ---------------- 批量操作定义 ---------------- */
  const OPS = {
    setOnline: { label: '批量上架', target: 'online', skipSame: '已是在售，跳过' },
    setOffline: { label: '批量下架', target: 'offline', skipSame: '已是已下架，跳过' },
    move: { label: '批量移动品类' },
    remove: { label: '批量删除', protect: (p) => (p.status === 'online' ? '在售保护：在售商品须先下架' : null) },
  };

  function planOp(opKey, ids, moveTarget) {
    const op = OPS[opKey];
    const idMap = byId();
    const will = [], skip = [], blocked = [];
    ids.forEach((id) => {
      const p = idMap.get(id);
      if (!p) return;
      if (opKey === 'move') {
        if (p.categoryId === moveTarget) skip.push({ p, why: '已在目标品类，跳过' });
        else will.push({ p, to: moveTarget });
      } else if (opKey === 'remove') {
        const why = op.protect(p);
        if (why) blocked.push({ p, why });
        else will.push({ p, to: 'deleted' });
      } else {
        if (p.status === op.target) skip.push({ p, why: op.skipSame });
        else will.push({ p, to: op.target });
      }
    });
    return { op, opKey, will, skip, blocked };
  }

  /* ---------------- 确认弹窗（预演清单） ---------------- */
  function openConfirm(opKey) {
    S.activeOp = { opKey, moveTarget: opKey === 'move' ? defaultMoveTarget() : null };
    $('cmTitle').textContent = `${OPS[opKey].label} · 影响预演`;
    drawConfirm();
    $('confirmModal').hidden = false; $('scrim').hidden = false;
  }
  function defaultMoveTarget() {
    const sel = [...S.selection].map((id) => byId().get(id)).filter(Boolean);
    const divId = sel.length ? sel[0].divisionId : null;
    const first = categories.find((c) => (!divId || c.div === divId) && (!S.scope || S.scope.type !== 'cat' || c.id !== S.scope.id));
    return first ? first.id : categories[0].id;
  }
  function closeModal() {
    $('confirmModal').hidden = true; $('scrim').hidden = true; S.activeOp = null;
  }

  function drawConfirm() {
    const { opKey, moveTarget } = S.activeOp;
    const prevAck = !!($('cmAck') && $('cmAck').checked);
    const plan = planOp(opKey, S.selection, moveTarget);
    const visIds = new Set(visibleProducts().map((p) => p.id));
    const hiddenWill = plan.will.filter((w) => !visIds.has(w.p.id)).length;
    const meta = statusMeta;

    let html = '';
    if (opKey === 'move') {
      html += `<div class="cm-move-target">目标品类：
        <select id="cmMoveSel">${categories.map((c) =>
          `<option value="${c.id}" ${c.id === moveTarget ? 'selected' : ''}>${esc(divById.get(c.div).name)} / ${esc(c.name)}</option>`).join('')}
        </select>
        <span class="muted" style="font-size:12px">已在该品类的商品将列为跳过</span></div>`;
    }
    html += `<div class="cm-stats">
      <div class="cm-stat will"><b>${plan.will.length}</b><span>将执行</span></div>
      <div class="cm-stat skip"><b>${plan.skip.length}</b><span>已达状态/在目标内 · 跳过</span></div>
      <div class="cm-stat blk"><b>${plan.blocked.length}</b><span>保护拦截</span></div>
      <div class="cm-stat"><b>${plan.will.length + plan.skip.length + plan.blocked.length}</b><span>已选合计</span></div>
    </div>`;

    const warns = [];
    if (plan.blocked.length) warns.push(`❌ <b>${plan.blocked.length} 条在售商品被“在售保护”拦截</b>：${OPS.remove.protect({ status: 'online' })}，本次不会删除（可先批量下架再删）。`);
    if (hiddenWill) warns.push(`⚠ 其中 <b>${hiddenWill} 条当前不在视图内</b>（被筛选/收起隐藏），仍将一并执行——它们列于下方清单，请核对。`);
    if (opKey === 'remove') warns.push(`删除为高危操作：清单需逐条核对，确认后仍可立即撤销一次。`);
    if (plan.skip.length && !plan.will.length) warns.push(`所选商品全部${plan.skip.length ? '已达目标状态或位置' : ''}，本次执行不会有任何变更。`);
    if (warns.length) html += `<div class="cm-warnbox ${opKey === 'remove' ? 'danger' : ''}">${warns.join('<br>')}</div>`;

    // 按归属路径分组渲染“将执行”
    if (plan.will.length) {
      const byPath = new Map();
      plan.will.forEach((w) => {
        const path = pathOf(w.p);
        if (!byPath.has(path)) byPath.set(path, []);
        byPath.get(path).push(w);
      });
      html += `<div class="sect">将执行 ${plan.will.length} 条 · 按归属分组</div>`;
      [...byPath.entries()].forEach(([path, list]) => {
        html += `<div class="cm-group"><div class="cm-group-head">📁 ${esc(path)}<span class="n">${list.length} 条</span></div><div class="cm-rows">` +
          list.map((w) => {
            const tr = opKey === 'move'
              ? `<span class="tr">${esc(catById.get(w.p.categoryId).name)} → <em>${esc(catById.get(w.to).name)}</em></span>`
              : opKey === 'remove'
                ? `<span class="tr">${meta[w.p.status].label} → <em style="color:var(--danger)">删除</em></span>`
                : `<span class="tr">${meta[w.p.status].label} → <em>${meta[w.to].label}</em></span>`;
            return `<div class="cm-row"><span class="id">${w.p.id}</span><span class="nm">${esc(w.p.name)}</span>${tr}</div>`;
          }).join('') + `</div></div>`;
      });
    }
    if (plan.skip.length) {
      html += `<div class="sect">跳过 ${plan.skip.length} 条（不会变更）</div><div class="cm-group"><div class="cm-rows">` +
        plan.skip.map((s) => `<div class="cm-row skiprow"><span class="id">${s.p.id}</span><span class="nm">${esc(s.p.name)}</span><span class="why">${s.why}</span></div>`).join('') +
        `</div></div>`;
    }
    if (plan.blocked.length) {
      html += `<div class="sect">保护拦截 ${plan.blocked.length} 条（不会变更）</div><div class="cm-group"><div class="cm-rows">` +
        plan.blocked.map((b) => `<div class="cm-row skiprow"><span class="id">${b.p.id}</span><span class="nm">${esc(b.p.name)}</span><span class="why" style="color:var(--danger)">${b.why}</span></div>`).join('') +
        `</div></div>`;
    }
    if (opKey === 'remove' && plan.will.length) {
      html += `<label class="cm-confirm-line"><input type="checkbox" id="cmAck" ${prevAck ? 'checked' : ''}> 我已逐条核对上方影响清单（${plan.will.length} 条）</label>`;
    }
    $('cmBody').innerHTML = html;

    const canExec = plan.will.length > 0 && (opKey !== 'remove' || !!(($('cmAck') || {}).checked));
    $('cmFoot').innerHTML =
      `<span class="foot-note">预演清单 · 确认前不发生任何变更</span>
       <button class="btn" data-close="confirmModal" type="button">取消</button>
       <button class="btn ${opKey === 'remove' ? 'btn-danger-solid' : 'btn-primary'}" id="cmExec" type="button" ${canExec ? '' : 'disabled'}>
         确认执行（${plan.will.length} 条）</button>`;

    const sel = $('cmMoveSel');
    if (sel) sel.onchange = () => { S.activeOp.moveTarget = sel.value; drawConfirm(); };
    const ack = $('cmAck');
    if (ack) ack.onchange = drawConfirm;
    const exec = $('cmExec');
    if (exec) exec.onclick = () => executePlan(plan);
  }

  /* ---------------- 执行 + 撤销 + 日志 ---------------- */
  function executePlan(plan) {
    const before = new Map();
    const removed = [];
    plan.will.forEach((w) => {
      before.set(w.p.id, { status: w.p.status, categoryId: w.p.categoryId });
      if (plan.opKey === 'remove') removed.push(w.p);
    });
    if (plan.opKey === 'remove') {
      const del = new Set(removed.map((p) => p.id));
      S.products = S.products.filter((p) => !del.has(p.id));
      del.forEach((id) => S.selection.delete(id));
    } else {
      plan.will.forEach((w) => {
        const p = byId().get(w.p.id);
        if (plan.opKey === 'move') p.categoryId = w.to; else p.status = w.to;
      });
    }
    S.lastOp = { planKey: plan.opKey, label: plan.op.label, ids: plan.will.map((w) => w.p.id), before, removed };

    S.seq++;
    const entry = {
      no: S.seq, time: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
      op: plan.op.label,
      summary: { ok: plan.will.length, skip: plan.skip.length, blocked: plan.blocked.length },
      ids: plan.will.map((w) => w.p.id),
      detail: plan.will.map((w) => {
        const base = `${w.p.id} ${w.p.name} · ${pathOf(w.p)}`;
        if (plan.opKey === 'move') return `${base}：${catById.get(w.p.categoryId).name} → ${catById.get(w.to).name}`;
        if (plan.opKey === 'remove') return `${base}：${statusMeta[w.p.status].label} → 删除`;
        return `${base}：${statusMeta[w.p.status].label} → ${statusMeta[w.to].label}`;
      }),
      skipDetail: plan.skip.map((s) => `${s.p.id} ${s.p.name}：${s.why}`)
        .concat(plan.blocked.map((b) => `${b.p.id} ${b.p.name}：${b.why}`)),
    };
    S.log.unshift(entry);
    renderLogCount();

    closeModal();
    renderAll();

    const visIds = new Set(visibleProducts().map((p) => p.id));
    const hiddenAfter = entry.ids.filter((id) => !visIds.has(id)).length;
    toast('ok', `<b>${plan.op.label}完成</b>：成功 ${entry.summary.ok} 条 · 跳过 ${entry.summary.skip} 条 · 拦截 ${entry.summary.blocked} 条`,
      (hiddenAfter ? `其中 ${hiddenAfter} 条在当前视图外变更（详见操作日志 #${entry.no}）。` : `明细已写入操作日志 #${entry.no}。`),
      [{ label: '撤销', fn: undoLast }, { label: '查看日志', fn: () => openDrawer('logDrawer') }]);
  }

  function undoLast() {
    const op = S.lastOp;
    if (!op) return;
    const restored = [];
    op.ids.forEach((id) => {
      const b = op.before.get(id);
      if (op.planKey === 'remove') {
        const p = op.removed.find((x) => x.id === id);
        if (p) { S.products.push({ ...p, tags: [...p.tags] }); restored.push(p.id); }
      } else {
        const p = byId().get(id);
        if (p) { p.status = b.status; p.categoryId = b.categoryId; restored.push(id); }
      }
    });
    S.seq++;
    S.log.unshift({
      no: S.seq, time: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
      op: `撤销 · ${op.label}`, summary: { ok: restored.length, skip: 0, blocked: 0 },
      ids: restored, detail: restored.map((id) => `${id}：已恢复至操作前状态`),
      skipDetail: [],
    });
    S.lastOp = null;
    renderLogCount(); renderAll();
    toast('info', `<b>已撤销</b>：${op.label} 的 ${restored.length} 条商品恢复原状`, '恢复明细见操作日志。');
  }

  /* ---------------- 轻提示 / 抽屉 ---------------- */
  function toast(kind, html, sub, actions) {
    const el = document.createElement('div');
    el.className = `toast ${kind}`;
    el.innerHTML = `${html}${sub ? `<div class="t-sub">${sub}</div>` : ''}` +
      (actions ? `<div class="t-actions">${actions.map((a, i) => `<button class="btn" data-ta="${i}" type="button">${a.label}</button>`).join('')}</div>` : '');
    if (actions) actions.forEach((a, i) => { el.querySelector(`[data-ta="${i}"]`).onclick = () => { a.fn(); el.remove(); }; });
    $('toasts').appendChild(el);
    setTimeout(() => el.remove(), 9000);
  }

  function openDrawer(id) {
    if (id === 'logDrawer') renderLog();
    if (id === 'detailDrawer' && S.openDetailId) renderDetail(S.openDetailId);
    $(id).hidden = false; $('scrim').hidden = false;
  }
  function closeOverlays() {
    ['detailDrawer', 'logDrawer'].forEach((id) => { $(id).hidden = true; });
    closeModal();
  }

  function renderLog() {
    $('logBody').innerHTML = S.log.length ? S.log.map((e) => `
      <div class="log-item">
        <div class="log-top"><span class="log-op">${esc(e.op)}</span>
          <span class="muted">${e.time}</span><span class="log-no">#${e.no}</span></div>
        <div class="log-summary"><span class="ok">成功 ${e.summary.ok}</span><span class="skip">跳过/拦截 ${e.summary.skip + e.summary.blocked}</span><span>涉及 ${e.ids.length} 条</span></div>
        ${e.ids.length ? `<details class="log-details"><summary>影响清单（${e.ids.length} 条）</summary><div class="mono-list">${e.detail.map(esc).join('<br>')}</div></details>` : ''}
        ${e.skipDetail.length ? `<details class="log-details"><summary>跳过/拦截明细（${e.skipDetail.length} 条）</summary><div class="mono-list">${e.skipDetail.map(esc).join('<br>')}</div></details>` : ''}
      </div>`).join('') : `<div class="log-empty">本会话暂无操作记录</div>`;
  }

  function renderDetail(id) {
    const p = byId().get(id);
    if (!p) { $('detailBody').innerHTML = `<div class="log-empty">该商品已被删除（可用撤销恢复）</div>`; return; }
    const st = statusMeta[p.status];
    const related = S.log.filter((e) => e.ids.includes(id)).slice(0, 5);
    $('detailBody').innerHTML = `
      <div class="detail-crumb">📍 ${esc(divById.get(p.divisionId).name)} › ${esc(catById.get(p.categoryId).name)}</div>
      <dl class="kv">
        <dt>商品名</dt><dd><b>${esc(p.name)}</b></dd>
        <dt>SKU</dt><dd class="detail-id">${p.id}</dd>
        <dt>状态</dt><dd><span class="status-pill ${st.cls}">${st.label}</span></dd>
        <dt>价格</dt><dd>¥${p.price.toLocaleString()}</dd>
        <dt>库存</dt><dd>${p.stock.toLocaleString()}${p.stock === 0 ? ' <span class="zero-stock">（缺货）</span>' : ''}</dd>
        <dt>负责人</dt><dd>${esc(p.owner)}</dd>
        <dt>供应商</dt><dd>${esc(p.supplier)}</dd>
        <dt>标签</dt><dd>${p.tags.map((t) => `<span class="tag">${t}</span>`).join('') || '—'}</dd>
        <dt>更新日期</dt><dd>${p.updatedAt}</dd>
      </dl>
      <div class="sect">本商品近期操作（归属留痕）</div>
      ${related.length ? related.map((e) => `<div class="log-item" style="margin-bottom:6px">
        <div class="log-top"><span class="log-op" style="font-size:12.5px">${esc(e.op)}</span><span class="muted">${e.time}</span><span class="log-no">#${e.no}</span></div>
        <div class="muted" style="font-size:12px">${esc((e.detail.find((d) => d.startsWith(id)) || '').split('：')[1] || '')}</div></div>`).join('')
      : `<div class="muted">本会话尚无涉及该商品的操作</div>`}`;
  }

  /* ---------------- 事件绑定 ---------------- */
  function bind() {
    $('statusBar').addEventListener('click', (e) => {
      const chip = e.target.closest('.stchip');
      if (chip) {
        const k = chip.dataset.st;
        S.statusFilter.has(k) ? S.statusFilter.delete(k) : S.statusFilter.add(k);
        renderAll(); return;
      }
      if (e.target.id === 'chipClear') {
        S.statusFilter.clear(); S.search = ''; $('globalSearch').value = '';
        renderAll();
      }
    });

    $('tree').addEventListener('click', (e) => {
      const caret = e.target.closest('[data-caret]');
      if (caret) {
        const id = caret.dataset.caret;
        S.expanded.has(id) ? S.expanded.delete(id) : S.expanded.add(id);
        renderTree(); return;
      }
      const name = e.target.closest('.tree-name');
      if (name) {
        const [type, id] = name.dataset.scope === 'all' ? [null, null] : name.dataset.scope.split(':');
        S.scope = type === null ? null : { type, id };
        renderAll(); return;
      }
    });
    $('tree').addEventListener('change', (e) => {
      const cb = e.target.closest('[data-sel-scope]');
      if (!cb) return;
      toggleGroup(cb.dataset.selScope, () => scopedIds(cb.dataset.selScope));
      renderAll();
    });

    $('gridBody').addEventListener('change', (e) => {
      const cb = e.target.closest('[data-row]');
      if (!cb) return;
      cb.checked ? S.selection.add(cb.dataset.row) : S.selection.delete(cb.dataset.row);
      renderAll();
    });
    $('gridBody').addEventListener('click', (e) => {
      const nm = e.target.closest('[data-detail]');
      if (nm) { S.openDetailId = nm.dataset.detail; openDrawer('detailDrawer'); }
    });

    $('masterCheck').addEventListener('change', () => {
      const visIds = visibleProducts().map((p) => p.id);
      const all = visIds.every((id) => S.selection.has(id));
      visIds.forEach((id) => all ? S.selection.delete(id) : S.selection.add(id));
      renderAll();
    });
    $('btnSelectFiltered').addEventListener('click', () => {
      // 显式语义：无视状态/搜索筛选，选中当前层级下的全部商品
      scopedIds(S.scope ? (S.scope.type + ':' + S.scope.id) : 'all').forEach((id) => S.selection.add(id));
      renderAll();
      toast('info', `<b>已选中本层级全部商品</b>`, '该操作无视筛选，包含被筛选隐藏的商品；可在确认弹窗中逐条核对。');
    });
    $('btnInvert').addEventListener('click', () => {
      visibleProducts().forEach((p) => S.selection.has(p.id) ? S.selection.delete(p.id) : S.selection.add(p.id));
      renderAll();
    });
    $('btnClearSel').addEventListener('click', () => { S.selection.clear(); renderAll(); });

    $('hiddenBanner').addEventListener('click', (e) => {
      if (e.target.id === 'btnKeepVisible') {
        const vis = new Set(visibleProducts().map((p) => p.id));
        [...S.selection].forEach((id) => { if (!vis.has(id)) S.selection.delete(id); });
        renderAll();
      }
    });

    $('batchbar').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-op]');
      if (btn && S.selection.size) openConfirm(btn.dataset.op);
    });
    $('confirmModal').addEventListener('click', (e) => { if (e.target.closest('[data-close]')) closeModal(); });

    $('globalSearch').addEventListener('input', (e) => { S.search = e.target.value.trim(); renderAll(); });
    $('btnClearFilter').addEventListener('click', () => {
      S.statusFilter.clear(); S.search = ''; $('globalSearch').value = ''; renderAll();
    });
    $('btnExpandAll').addEventListener('click', () => { S.expanded = new Set(divisions.map((d) => d.id)); renderTree(); });
    $('btnCollapseAll').addEventListener('click', () => { S.expanded.clear(); renderTree(); });
    $('btnLog').addEventListener('click', () => openDrawer('logDrawer'));
    $('btnReset').addEventListener('click', () => { resetState(); $('globalSearch').value = ''; renderAll(); toast('info', '<b>已重置</b>','数据、选择、筛选与日志已恢复初始快照。'); });

    $('scrim').addEventListener('click', closeOverlays);
    document.querySelectorAll('[data-close]').forEach((b) => {
      if (b.dataset.close !== 'confirmModal') b.addEventListener('click', closeOverlays);
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeOverlays(); });
  }

  /* ---------------- 总渲染 ---------------- */
  function renderAll() { renderChips(); renderTree(); renderTable(); renderLogCount(); }

  /* ---------------- 演示脚本（供浏览器取证：?shot=xxx） ---------------- */
  function runShot(name) {
    if (name === 'selection') {
      // 选中「手机通讯」全品类（含将被筛选隐藏者），再筛选 在售+待审核 → 触发视图外警告
      toggleGroup('cat:cg-ph', () => scopedIds('cat:cg-ph'));
      S.statusFilter = new Set(['online', 'review']);
      renderAll();
      S.openDetailId = visibleProducts()[0].id;
      openDrawer('detailDrawer');
    } else if (name === 'confirm-offline') {
      // 选中「护肤」全品类 → 批量下架预演（含“已是已下架”跳过清单）
      toggleGroup('cat:cg-sk', () => scopedIds('cat:cg-sk'));
      renderAll(); openConfirm('setOffline');
    } else if (name === 'confirm-move') {
      toggleGroup('div:dv-mz', () => scopedIds('div:dv-mz'));
      renderAll(); openConfirm('move');
    } else if (name === 'confirm-remove') {
      toggleGroup('cat:cg-av', () => scopedIds('cat:cg-av'));
      renderAll(); openConfirm('remove');
    } else if (name === 'done') {
      // 真实执行一次批量下架（跳过已下架），随后弹结果 toast + 打开日志
      const ids = scopedIds('cat:cg-kt');
      ids.forEach((id) => S.selection.add(id));
      const plan = planOp('setOffline', ids, null);
      executePlan(plan);
      openDrawer('logDrawer');
    } else if (name === 'log') {
      toggleGroup('div:dv-sp', () => scopedIds('div:dv-sp'));
      const plan = planOp('setOnline', scopedIds('div:dv-sp'), null);
      executePlan(plan);
      undoLast();
      openDrawer('logDrawer');
    }
  }

  /* ---------------- 启动：数据随首屏同步就绪 ---------------- */
  resetState();
  bind();
  renderAll();
  const shot = new URLSearchParams(location.search).get('shot');
  if (shot) { try { runShot(shot); } catch (err) { console.error('shot failed', err); } }
})();
