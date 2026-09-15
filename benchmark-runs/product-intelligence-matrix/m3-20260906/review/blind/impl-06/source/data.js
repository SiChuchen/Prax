/* ============================================================
   cell-j09-s03 · 选址决策台（decide × comparison-panel）
   数据内联 · 无外部服务 · file:// 可直接打开
   ============================================================ */

const SCENARIO = {
  brand: '青屿咖啡',
  task: '梧桐区二店选址',
  lead: '在 3 个候选铺位之间完成选址决策：全部决策输入同屏可得 —— 左侧为商圈地理语境，右侧为并排比较矩阵；调整权重即实时重算契合分，比较状态全程驻留本屏。',
  note: '演示数据为示意样例（虚构），不代表真实商圈。',
};

/* 准则：better = 'low' 表示越小越优，'high' 表示越大越优；w 为默认权重（0–5） */
const CRITERIA = [
  { id: 'rent',    label: '租金成本', unit: '¥/㎡/天',            better: 'low',  w: 4, fmt: (v) => v.toFixed(1) },
  { id: 'traffic', label: '人流规模', unit: '人次/日',            better: 'high', w: 5, fmt: (v) => (v / 1000).toFixed(1) + 'k' },
  { id: 'commute', label: '通勤可达', unit: 'min · 步行至江北商务区', better: 'low',  w: 4, fmt: (v) => v + '′' },
  { id: 'rival',   label: '竞争密度', unit: '500m 内同类店',       better: 'low',  w: 3, fmt: (v) => v + ' 家' },
  { id: 'space',   label: '空间品质', unit: '㎡ · 一层/外摆',      better: 'high', w: 3, fmt: (v) => v + '㎡' },
  { id: 'crowd',   label: '客群匹配', unit: '25–35 岁占比',        better: 'high', w: 4, fmt: (v) => v + '%' },
];

/* 候选铺位（主对象：location） */
const SITES = [
  {
    id: 'a', key: 'A', name: '望江里 · 临江铺', addr: '望江里历史街区 17 号',
    kind: '临街一层 · 老洋房', area: 145,
    vals: { rent: 18.5, traffic: 12000, commute: 18, rival: 5, space: 145, crowd: 58 },
    station: '望江里站', walkToStation: 2, stationXY: [170, 160], pinXY: [200, 190],
    note: '滨河人流走廊核心段，周末客群密集、品牌形象最佳；租金为三案最高。',
  },
  {
    id: 'b', key: 'B', name: '梧桐巷 · 社区铺', addr: '梧桐巷 42 号',
    kind: '社区底商 · 一层', area: 90,
    vals: { rent: 9.8, traffic: 7000, commute: 32, rival: 1, space: 90, crowd: 34 },
    station: '市图书馆站', walkToStation: 9, stationXY: [300, 235], pinXY: [150, 395],
    note: '租金与竞争双低，经营压力最小；依赖社区复购，工作日通勤客流弱。',
  },
  {
    id: 'c', key: 'C', name: '环汇广场 · 商场铺', addr: '环汇广场 2F-16',
    kind: '商场二层 · 中庭边', area: 68,
    vals: { rent: 15.2, traffic: 15000, commute: 12, rival: 8, space: 68, crowd: 66 },
    station: '环汇广场站', walkToStation: 3, stationXY: [450, 210], pinXY: [430, 245],
    note: '通勤客流与年轻客群最强、直达地铁枢纽；同类竞争最密集，空间最小。',
  },
];

const monthlyRentWan = (s) => Math.round((s.area * s.vals.rent * 30) / 100) / 100; // 万元/月（约）
