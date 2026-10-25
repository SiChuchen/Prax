/* 数据集：产品发布运营数据集（合成快照，确定性生成，随首屏内联 — 无运行时获取）
 * 480 条 record × 14 个维度 + 3 个数值指标。基数 unbounded 由可滚动行集承载。 */
(function () {
  'use strict';

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rnd = mulberry32(20260902);
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const rint = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  const weighted = (pairs) => { // [[value, weight], ...]
    let sum = 0; for (const p of pairs) sum += p[1];
    let x = rnd() * sum;
    for (const p of pairs) { x -= p[1]; if (x <= 0) return p[0]; }
    return pairs[pairs.length - 1][0];
  };

  const DIMS = [
    { key: 'category', label: '产品线',   values: ['连接部件', '数据同步', '权限中心', '报表引擎', '通知推送', '搜索索引', '流程自动化', '开放平台'] },
    { key: 'platform', label: '平台',     values: ['Web', 'iOS', 'Android', '桌面端', 'API'] },
    { key: 'region',   label: '区域',     values: ['华北', '华东', '华南', '西南', '海外'] },
    { key: 'channel',  label: '渠道',     values: ['直销', '渠道', '自助线上', '市场'] },
    { key: 'status',   label: '状态',     values: ['在线', '公测', '开发中', '维护', '已下线'] },
    { key: 'priority', label: '优先级',   values: ['P0', 'P1', 'P2', 'P3'] },
    { key: 'owner',    label: '负责人',   values: ['林晚', '陈默', '苏黎', '周屿', '顾星河', '方晏', '白榆', '江离'] },
    { key: 'quarter',  label: '季度',     values: ['2025Q3', '2025Q4', '2026Q1', '2026Q2', '2026Q3', '2026Q4'] },
    { key: 'source',   label: '来源',     values: ['内部孵化', '收购整合', '开源共建', '客户共创'] },
    { key: 'tag',      label: '标签',     values: ['核心', '增长', '实验', '基础设施', '长尾'] },
    { key: 'version',  label: '版本线',   values: ['v1.x', 'v2.x', 'v3.x'] },
    { key: 'language', label: '语言',     values: ['中文', '英文', '多语言'] },
    { key: 'risk',     label: '风险等级', values: ['低', '中', '高'] },
    { key: 'scale',    label: '客户规模', values: ['KA', '中市场', 'SMB', '免费'] }
  ];

  const METRICS = [
    { key: 'mrr',    label: 'MRR ¥万', num: true },
    { key: 'dau',    label: 'DAU 万',  num: true },
    { key: 'health', label: '健康分',  num: true }
  ];

  const FEATURES = ['实时管道', '智能路由', '权限网关', '报表中心', '消息队列', '索引优化', '流程编排', '开放接口',
    '数据看板', '告警引擎', '同步任务', '审计日志', '配置下发', '灰度发布', '配额管理', '计费引擎',
    '模板市场', '连接器', '数据校验', '任务调度', '画像标签', '意图识别', '语音转写', '文档解析'];

  const STATUS_FACTOR = { '在线': 1, '公测': 0.55, '开发中': 0.18, '维护': 0.7, '已下线': 0.12 };
  const SCALE_BASE = { 'KA': 90, '中市场': 34, 'SMB': 9, '免费': 0.6 };

  const N = 480;
  const records = new Array(N);
  for (let i = 0; i < N; i++) {
    const cat = DIMS[0].values[i % DIMS[0].values.length];
    const status = weighted([['在线', 38], ['公测', 16], ['开发中', 20], ['维护', 15], ['已下线', 11]]);
    const scale = weighted([['KA', 22], ['中市场', 30], ['SMB', 30], ['免费', 18]]);
    const mrr = SCALE_BASE[scale] * STATUS_FACTOR[status] * (0.5 + rnd() * 1.6);
    const dau = Math.round(mrr * rint(90, 420) / 10) / 10;
    let health;
    if (status === '在线') health = rint(68, 98);
    else if (status === '维护') health = rint(48, 80);
    else if (status === '公测') health = rint(40, 76);
    else if (status === '开发中') health = rint(20, 60);
    else health = rint(5, 35);
    records[i] = {
      id: 'r' + (i + 1),
      name: cat + ' · ' + pick(FEATURES) + ' #' + String(i + 1).padStart(4, '0'),
      category: cat,
      platform: DIMS[1].values[i % 5 === 4 ? 4 : i % 4],
      region: pick(DIMS[2].values),
      channel: pick(DIMS[3].values),
      status,
      priority: weighted([['P0', 10], ['P1', 24], ['P2', 40], ['P3', 26]]),
      owner: pick(DIMS[6].values),
      quarter: pick(DIMS[7].values),
      source: pick(DIMS[8].values),
      tag: weighted([['核心', 20], ['增长', 24], ['实验', 22], ['基础设施', 16], ['长尾', 18]]),
      version: weighted([['v1.x', 30], ['v2.x', 45], ['v3.x', 25]]),
      language: weighted([['中文', 46], ['英文', 30], ['多语言', 24]]),
      risk: weighted([['低', 50], ['中', 34], ['高', 16]]),
      scale,
      mrr: Math.round(mrr * 10) / 10,
      dau,
      health
    };
  }

  window.DATASET = {
    name: '产品发布运营数据集',
    dims: DIMS,
    metrics: METRICS,
    records,
    total: N,
    note: 'unbounded 基数 · 示例快照'
  };
})();
