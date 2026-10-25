/* 多维棱镜 · 数据层
 * 确定性种子数据集：零售销售事实表（~2600 行），随首屏同步就绪。
 * 无网络、无构建 —— 普通 <script> 挂载 window.CUBE。
 */
(function () {
  'use strict';

  /* ---------- 确定性 PRNG（mulberry32） ---------- */
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rand = mulberry32(20260913);
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const pickW = (pairs) => { // [[value, weight],...]
    let r = rand() * pairs.reduce((s, p) => s + p[1], 0);
    for (const p of pairs) { r -= p[1]; if (r <= 0) return p[0]; }
    return pairs[pairs.length - 1][0];
  };

  /* ---------- 维度元数据（含层级树） ---------- */
  const TREE = {
    category: { label: '品类', children: [
      { label: '手机通讯', children: [
        { label: '智能手机', children: [
          { label: '旗舰机', price: 5999, tier: 6, margin: 0.18 },
          { label: '中端机', price: 2499, tier: 9, margin: 0.20 },
          { label: '入门机', price: 999,  tier: 14, margin: 0.15 } ] },
        { label: '配件', children: [
          { label: '保护壳', price: 49,  tier: 40, margin: 0.55 },
          { label: '充电器', price: 129, tier: 30, margin: 0.42 } ] } ] },
      { label: '数码影音', children: [
        { label: '耳机', children: [
          { label: '无线降噪耳机', price: 1299, tier: 10, margin: 0.30 },
          { label: '真无线耳机',   price: 599,  tier: 18, margin: 0.32 },
          { label: '头戴式耳机',   price: 899,  tier: 12, margin: 0.28 } ] },
        { label: '音箱', children: [
          { label: '智能音箱', price: 299, tier: 22, margin: 0.25 },
          { label: '蓝牙音箱', price: 399, tier: 18, margin: 0.27 } ] } ] },
      { label: '智能穿戴', children: [
        { label: '手表', children: [
          { label: '智能手表 Pro', price: 2199, tier: 9, margin: 0.34 },
          { label: '智能手表 SE',  price: 1299, tier: 13, margin: 0.31 } ] },
        { label: '手环', children: [
          { label: '运动手环', price: 249, tier: 26, margin: 0.35 } ] } ] },
      { label: '家用电器', children: [
        { label: '清洁电器', children: [
          { label: '扫地机器人', price: 1899, tier: 7, margin: 0.22 },
          { label: '吸尘器',     price: 1299, tier: 9, margin: 0.24 } ] },
        { label: '厨房电器', children: [
          { label: '空气炸锅', price: 499, tier: 16, margin: 0.26 },
          { label: '咖啡机',   price: 1499, tier: 7, margin: 0.28 } ] },
        { label: '环境电器', children: [
          { label: '空气净化器', price: 999, tier: 10, margin: 0.23 } ] } ] }
    ] },
    channel: { label: '渠道', children: [
      { label: '线上', children: [
        { label: '官方商城', w: 18, f: 1.00 },
        { label: '电商平台', w: 30, f: 1.15 },
        { label: '直播带货', w: 17, f: 1.30 } ] },
      { label: '线下', children: [
        { label: '直营门店', w: 20, f: 1.10 },
        { label: '加盟门店', w: 15, f: 0.90 } ] }
    ] },
    region: { label: '区域', children: [
      { label: '华东大区', children: [ { label: '沪苏皖', w: 15 }, { label: '浙江闽', w: 13 } ] },
      { label: '华南大区', children: [ { label: '广东', w: 16 }, { label: '港澳', w: 6 } ] },
      { label: '华北大区', children: [ { label: '京津冀', w: 14 }, { label: '山东', w: 8 } ] },
      { label: '西南大区', children: [ { label: '川渝', w: 12 }, { label: '云贵', w: 6 } ] },
      { label: '东北大区', children: [ { label: '辽吉黑', w: 10 } ] }
    ] },
    segment: { label: '客群', children: [
      { label: '个人消费者', w: 42, f: 1.00 },
      { label: '中小企业',   w: 22, f: 1.30 },
      { label: '大型企业',   w: 14, f: 2.20 },
      { label: '教育机构',   w: 12, f: 1.15 },
      { label: '政府采购',   w: 10, f: 1.80 }
    ] },
    quarter: { label: '季度', children: [
      { label: '2025Q1', g: 0.92 }, { label: '2025Q2', g: 0.97 }, { label: '2025Q3', g: 1.02 },
      { label: '2025Q4', g: 1.18 }, { label: '2026Q1', g: 0.98 }, { label: '2026Q2', g: 1.04 },
      { label: '2026Q3', g: 1.09 }
    ] }
  };

  const DIM_DEFS = [
    { id: 'category', name: '品类', levels: ['品类', '子类', '单品'] },
    { id: 'channel',  name: '渠道', levels: ['渠道类型', '渠道'] },
    { id: 'region',   name: '区域', levels: ['大区', '省区'] },
    { id: 'segment',  name: '客群', levels: ['客群'] },
    { id: 'quarter',  name: '季度', levels: ['季度'] }
  ];

  /* ---------- 树构建：id = 逐级 label 以 “/” 连接 ---------- */
  function buildTree(def, dimId, depth) {
    const node = {
      id: def.idPrefix || '', label: def.label || dimId,
      dimId, depth, children: [], rec: [], price: def.price, tier: def.tier,
      margin: def.margin, w: def.w, f: def.f, g: def.g
    };
    node.children = (def.children || []).map((c) =>
      buildTree({ ...c, idPrefix: (def.idPrefix ? def.idPrefix + '/' : '') + c.label },
        dimId, depth + 1));
    return node;
  }
  const dimTrees = {};
  for (const d of DIM_DEFS) {
    dimTrees[d.id] = buildTree(TREE[d.id], d.id, 0);
  }

  /* ---------- 事实行生成（~2600 行） ---------- */
  const rows = [];
  const skus = [];
  (function collectSku(node, chain) {
    if (!node.children.length) { skus.push(node); return; }
    node.children.forEach((c) => collectSku(c, chain));
  })(dimTrees.category, []);

  const channelLeaves = leafList(dimTrees.channel);
  const regionLeaves = leafList(dimTrees.region);
  const segmentLeaves = leafList(dimTrees.segment);
  const quarterLeaves = leafList(dimTrees.quarter);
  function leafList(node, acc) {
    acc = acc || [];
    if (!node.children.length) acc.push(node);
    node.children.forEach((c) => leafList(c, acc));
    return acc;
  }

  const N = 2600;
  for (let i = 0; i < N; i++) {
    const sku = pickW(skus.map((s) => [s, s.tier]));
    const ch = pickW(channelLeaves.map((c) => [c, c.w]));
    const rg = pickW(regionLeaves.map((c) => [c, c.w]));
    const sg = pickW(segmentLeaves.map((c) => [c, c.w]));
    const q = pickW(quarterLeaves.map((c) => [c, c.g]));

    const noise = 0.75 + rand() * 0.5;
    const units = Math.max(1, Math.round(sku.tier * (0.5 + rand()) * ch.f * noise));
    const revenue = Math.round(units * sku.price * sg.f * q.g * (0.9 + rand() * 0.2));
    const orders = Math.max(1, Math.round(revenue / sku.price / (0.9 + rand() * 0.2)));
    const margin = sku.margin + (rand() - 0.5) * 0.08;
    const profit = Math.round(revenue * margin);
    const returns = Math.round(orders * (0.015 + rand() * 0.05));

    rows.push({
      id: i,
      category: sku.id, channel: ch.id, region: rg.id,
      segment: sg.id, quarter: q.id,
      revenue, profit, orders, returns
    });
  }

  /* ---------- 节点 → 行索引（子树聚合用） ---------- */
  function attachRecords(dimId) {
    (function walk(node) {
      node.rec = [];
      rows.forEach((r, i) => {
        const p = r[dimId];
        if (p === node.id || p.startsWith(node.id + '/')) node.rec.push(i);
      });
      node.children.forEach(walk);
    })(dimTrees[dimId]);
  }
  DIM_DEFS.forEach((d) => attachRecords(d.id));

  /* ---------- 度量 ---------- */
  const MEASURES = [
    { id: 'revenue',    name: '销售额', agg: 'sum',  fmt: 'money' },
    { id: 'profit',     name: '毛利',   agg: 'sum',  fmt: 'money' },
    { id: 'orders',     name: '订单数', agg: 'sum',  fmt: 'int'   },
    { id: 'returnRate', name: '退货率', agg: 'ratio', fmt: 'pct'  }
  ];

  window.CUBE = {
    rows, dims: DIM_DEFS, trees: dimTrees, measures: MEASURES,
    meta: {
      datasetName: '零售销售观测事实表',
      recordCount: rows.length,
      generatedBy: 'mulberry32(20260913) 确定性种子 · 本地内联生成'
    }
  };
})();
