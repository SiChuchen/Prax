/* 维象 · 多维数据探索 — cell-j13-s10 (explore × dimensional-space)
 * 纯静态单屏应用：零依赖、零构建、file:// 直接打开。
 * 数据由确定性种子生成器在解析时同步构建 —— 无网络请求、无加载态，首屏即就绪。
 *
 * 认知保持（成功标准）：切换 X/Y/颜色维度只改变投影映射，
 *   selection / filters / 历史栈（投影轨迹）全部跨维度切换保持。
 * 状态归属与回退（验收种子）：每条过滤器归属到维度（芯片标注），
 *   每次视图变更加入命名快照栈，可撤销/重做，也可在轨迹中点击任意一步回退。
 */
(function () {
'use strict';

/* =====================================================================
 * 0. 确定性数据生成（内联，无网络）
 * ===================================================================== */
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    var t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
var rand = mulberry32(0x20260913);
function randn() { // Box–Muller
  var u = 0, v = 0;
  while (u === 0) u = rand();
  while (v === 0) v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
function r1(v) { return Math.round(v * 10) / 10; }
function sig(x) { return 1 / (1 + Math.exp(-x)); }

var REGIONS = [
  { name: '华东沿海', temp: 16.5, precip: 1150, dev: 0.35 },
  { name: '华南沿海', temp: 22.5, precip: 1700, dev: 0.25 },
  { name: '北方平原', temp: 13.0, precip: 560,  dev: 0.00 },
  { name: '西南山地', temp: 15.5, precip: 1050, dev: -0.15 },
  { name: '西部内陆', temp: 11.0, precip: 480,  dev: -0.30 },
  { name: '东北寒地', temp: 6.5,  precip: 620,  dev: -0.05 }
];
var TIERS = ['超大城市', '特大城市', '大城市', '中小城市'];
var PREFIX = ['云港','临川','新岚','青石','白泉','永安','宁川','高坪','清河','龙溪',
              '南屿','东津','西泽','北岭','朔方','望城','曲阳','桐川','兰泽','鹤鸣',
              '沙汀','枫溪','月浦','芦湾','星屿','竹逸','梅川','荷塘','柳川','桂语',
              '榕荫','泉川','云崖','雪川','虹川','锦川','沧浪','翠微','丹丘','鹿鸣'];
var SUFFIX = ['市', '州', '城', '港', '原', '谷'];

var DATA = [];
(function buildDataset() {
  for (var i = 0; i < 240; i++) {
    var reg = REGIONS[i % REGIONS.length];
    var pop = clamp(Math.round(Math.exp(2.9 + 0.95 * randn()) * 6), 18, 3400);
    var area = clamp(Math.round(pop * (0.85 + rand() * 1.5) + 15 + rand() * 45), 12, 5200);
    var temp = r1(reg.temp + randn() * 2.4);
    var precip = Math.round(reg.precip * (0.72 + rand() * 0.62) / 10) * 10;
    var d = clamp(randn() * 0.85 + reg.dev, -2.2, 2.2);
    var gdp = r1(clamp(5 + 16 * sig(1.5 * d) + rand() * 2 + randn() * 1.2, 3, 30));
    var aqi = Math.round(clamp(78 - 16 * sig(1.3 * d) - (precip - 500) / 60 + randn() * 14, 22, 165));
    var happy = Math.round(clamp(52 + 16 * d - 0.06 * (aqi - 60) + randn() * 5, 20, 96));
    var beds = r1(clamp(2.5 + 4.2 * sig(1.2 * d) + randn() * 0.7, 0.8, 12));
    var commute = Math.round(clamp(14 + 4.6 * Math.log(pop + 20) + randn() * 4, 12, 70));
    var univ = Math.round(clamp(2 + 42 * sig(1.35 * d) + randn() * 6, 0, 88));
    var housing = r1(clamp(3.5 + 8.5 * sig(1.4 * d) + Math.max(0, Math.log10(pop / 80)) * 2.2 + randn() * 1.4, 1.5, 32));
    var startup = Math.round(clamp(34 + 24 * sig(1.05 * d) + randn() * 7, 8, 98));
    var culture = Math.round(clamp(2 + 34 * sig(1.15 * d) + randn() * 6, 0, 70));
    var tier = pop >= 1000 ? TIERS[0] : pop >= 500 ? TIERS[1] : pop >= 200 ? TIERS[2] : TIERS[3];
    DATA.push({
      id: i, name: PREFIX[i % 40] + SUFFIX[(i / 40) | 0],
      region: reg.name, tier: tier,
      pop: pop, area: area, gdp: gdp, housing: housing,
      temp: temp, precip: precip, aqi: aqi,
      beds: beds, commute: commute, univ: univ, happy: happy,
      startup: startup, culture: culture
    });
  }
})();

/* ---------- 维度元数据（15 维 = 13 数值 + 2 分类；层级：5 个主题组） ---------- */
var GROUPS = [
  { id: 'scale',      name: '规模与经济' },
  { id: 'climate',    name: '气候与环境' },
  { id: 'livability', name: '民生与公共服务' },
  { id: 'vitality',   name: '活力与创新' },
  { id: 'category',   name: '分类维度' }
];
var DIMS = [
  { id: 'pop',     name: '人口',         unit: '万人', type: 'num', group: 'scale' },
  { id: 'area',    name: '建成区面积',   unit: 'km²',  type: 'num', group: 'scale' },
  { id: 'gdp',     name: '人均GDP',      unit: '万元', type: 'num', group: 'scale', fmt: 1 },
  { id: 'housing', name: '房价收入比',   unit: '倍',   type: 'num', group: 'scale', fmt: 1 },
  { id: 'temp',    name: '年均气温',     unit: '°C',   type: 'num', group: 'climate', fmt: 1 },
  { id: 'precip',  name: '年降水量',     unit: 'mm',   type: 'num', group: 'climate' },
  { id: 'aqi',     name: '空气质量指数', unit: 'AQI',  type: 'num', group: 'climate' },
  { id: 'beds',    name: '每千人床位',   unit: '张',   type: 'num', group: 'livability', fmt: 1 },
  { id: 'commute', name: '平均通勤',     unit: '分钟', type: 'num', group: 'livability' },
  { id: 'univ',    name: '高校数量',     unit: '所',   type: 'num', group: 'livability' },
  { id: 'happy',   name: '幸福指数',     unit: '/100', type: 'num', group: 'livability' },
  { id: 'startup', name: '创业活跃度',   unit: '/100', type: 'num', group: 'vitality' },
  { id: 'culture', name: '文化场馆',     unit: '个',   type: 'num', group: 'vitality' },
  { id: 'region',  name: '区域',         type: 'cat',  group: 'category', cats: REGIONS.map(function (r) { return r.name; }) },
  { id: 'tier',    name: '城市等级',     type: 'cat',  group: 'category', cats: TIERS.slice() }
];
var DIM = {};
DIMS.forEach(function (dm) { DIM[dm.id] = dm; });

/* 各数值维度的全量范围 —— 轴域固定不随过滤跳动（方向锚点） */
var EXTENT = {};
DIMS.forEach(function (dm) {
  if (dm.type !== 'num') return;
  var lo = Infinity, hi = -Infinity;
  DATA.forEach(function (r) { var v = r[dm.id]; if (v < lo) lo = v; if (v > hi) hi = v; });
  EXTENT[dm.id] = { min: lo, max: hi };
});

/* ---------- 颜色（dataviz 参考实例：已验证槽序；relief = 图例+提示+表格） ---------- */
var CAT_PALETTE = {
  region: ['#2a78d6', '#eb6834', '#008300', '#4a3aa7', '#e34948', '#1baf7a'],
  tier:   ['#2a78d6', '#eb6834', '#008300', '#4a3aa7']
};
var SEQ = ['#cde2fb', '#9ec5f4', '#6da7ec', '#3987e5', '#256abf', '#184f95', '#0d366b'];
function seqColor(t) {
  t = clamp(t, 0, 1);
  var x = t * (SEQ.length - 1), i = Math.min(SEQ.length - 2, Math.floor(x)), f = x - i;
  var a = SEQ[i], b = SEQ[i + 1], out = '#';
  for (var k = 0; k < 3; k++) {
    var ch = Math.round(parseInt(a.substr(1 + k * 2, 2), 16) * (1 - f) + parseInt(b.substr(1 + k * 2, 2), 16) * f);
    out += ('0' + ch.toString(16)).slice(-2);
  }
  return out;
}
function colorOf(dimId, rec) {
  var dm = DIM[dimId];
  if (dm.type === 'cat') {
    var idx = dm.cats.indexOf(rec[dimId]);
    return (CAT_PALETTE[dimId] || CAT_PALETTE.region)[idx] || '#52514e';
  }
  var e = EXTENT[dimId];
  return seqColor((rec[dimId] - e.min) / (e.max - e.min));
}

/* ---------- 格式化 / 刻度 ---------- */
function fmtVal(dimId, v) {
  var dm = DIM[dimId];
  if (dm.type === 'cat') return String(v);
  return dm.fmt === 1 ? (+v).toFixed(1) : String(Math.round(v));
}
function fmtNum(dimId, v) {
  var dm = DIM[dimId];
  var s = dm.type === 'cat' ? String(v) : (dm.fmt === 1 ? (+v).toFixed(1) : String(Math.round(v)));
  return dm.unit ? s + ' ' + dm.unit : s;
}
function niceTicks(min, max, count) {
  var span = max - min;
  if (!(span > 0)) return [min];
  var raw = span / (count || 5);
  var mag = Math.pow(10, Math.floor(Math.log(raw) / Math.LN10));
  var norm = raw / mag;
  var step = (norm < 1.5 ? 1 : norm < 3.5 ? 2 : norm < 7.5 ? 5 : 10) * mag;
  var out = [], v = Math.ceil(min / step) * step;
  for (; v <= max + step * 1e-6; v += step) out.push(Math.round(v * 1e6) / 1e6);
  return out;
}

/* =====================================================================
 * 1. 状态：投影角色 + 过滤（归属到维度）+ 选择 + 命名快照栈
 * ===================================================================== */
var state = {
  x: 'gdp', y: 'happy', color: 'region',
  filters: Object.create(null),      // dimId -> {kind:'num',min,max} | {kind:'cat',on:Set}
  selection: new Set(),              // 记录 id 集合（跨投影保持）
  lastSel: null
};
var openEditors = new Set();         // 目录中展开的过滤编辑器（界面局部状态，不入历史）

var tape = [], ptr = -1;             // 快照带 + 当前指针（undo/redo/轨迹回退共用）
function serialize() {
  var f = {};
  Object.keys(state.filters).forEach(function (k) {
    var fl = state.filters[k];
    f[k] = fl.kind === 'num' ? { kind: 'num', min: fl.min, max: fl.max }
                             : { kind: 'cat', on: Array.from(fl.on) };
  });
  return { x: state.x, y: state.y, color: state.color, filters: f,
           selection: Array.from(state.selection), lastSel: state.lastSel };
}
function snapshot(label, owner) {
  tape.length = ptr + 1;
  tape.push({ label: label, owner: owner || '全局', snap: serialize() });
  ptr = tape.length - 1;
}
function restore(s) {
  state.x = s.x; state.y = s.y; state.color = s.color;
  state.filters = Object.create(null);
  Object.keys(s.filters).forEach(function (k) {
    var f = s.filters[k];
    state.filters[k] = f.kind === 'num' ? { kind: 'num', min: f.min, max: f.max }
                                        : { kind: 'cat', on: new Set(f.on) };
  });
  state.selection = new Set(s.selection);
  state.lastSel = s.lastSel;
}
function undo() { if (ptr > 0) { ptr--; restore(tape[ptr].snap); renderAll(); announce('撤销：' + tape[ptr].label); } }
function redo() { if (ptr < tape.length - 1) { ptr++; restore(tape[ptr].snap); renderAll(); announce('重做：' + tape[ptr].label); } }
function jumpTo(i) {
  if (i === ptr || i < 0 || i >= tape.length) return;
  var back = i < ptr;
  ptr = i; restore(tape[i].snap); renderAll();
  announce((back ? '回退' : '前进') + '到「' + tape[i].label + '」');
}
function push(label, owner) { snapshot(label, owner); renderAll(); }

/* ---------- 过滤语义 ---------- */
function passFilters(rec) {
  for (var k in state.filters) {
    var f = state.filters[k];
    if (f.kind === 'num') { if (rec[k] < f.min - 1e-9 || rec[k] > f.max + 1e-9) return false; }
    else if (!f.on.has(rec[k])) return false;
  }
  return true;
}
function visibleRecords() { return DATA.filter(passFilters); }
function ensureNumFilter(dimId) {
  var e = EXTENT[dimId];
  if (!state.filters[dimId]) state.filters[dimId] = { kind: 'num', min: e.min, max: e.max };
  return state.filters[dimId];
}
function ensureCatFilter(dimId) {
  if (!state.filters[dimId]) state.filters[dimId] = { kind: 'cat', on: new Set(DIM[dimId].cats) };
  return state.filters[dimId];
}
function removeFilter(dimId, announceLabel) {
  delete state.filters[dimId];
  push(announceLabel || ('移除过滤 ' + DIM[dimId].name), DIM[dimId].name);
}

/* =====================================================================
 * 2. DOM 基建
 * ===================================================================== */
function $(s, el) { return (el || document).querySelector(s); }
function el(tag, attrs, text) {
  var n = document.createElement(tag);
  if (attrs) Object.keys(attrs).forEach(function (k) {
    var v = attrs[k];
    if (v == null || v === false) return;
    if (k === 'class') n.className = v;
    else if (k === 'dataset') Object.keys(v).forEach(function (d) { n.dataset[d] = v[d]; });
    else if (k.slice(0, 2) === 'on') n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v === true ? '' : v);
  });
  if (text != null) n.textContent = text;
  return n;
}
var SVGNS = 'http://www.w3.org/2000/svg';
function svgEl(tag, attrs) {
  var n = document.createElementNS(SVGNS, tag);
  if (attrs) Object.keys(attrs).forEach(function (k) { n.setAttribute(k, attrs[k]); });
  return n;
}
function announce(msg) { $('#live').textContent = msg; }

var chart = $('#chart'), chartwrap = $('#chartwrap'), tooltip = $('#tooltip');
var M = { t: 14, r: 18, b: 40, l: 60 };
var chartW = 900, chartH = 480;
var cursorId = null;                 // 键盘光标所在记录

if ('ResizeObserver' in window) {
  new ResizeObserver(function () {
    var r = chartwrap.getBoundingClientRect();
    if (r.width > 60 && r.height > 60) {
      chartW = Math.round(r.width); chartH = Math.round(r.height);
      renderChart();
    }
  }).observe(chartwrap);
}

/* =====================================================================
 * 3. 维度目录（构建一次；状态变化时增量更新）
 * ===================================================================== */
function buildCatalog() {
  var nav = $('#catalog');
  nav.textContent = '';
  GROUPS.forEach(function (g) {
    var dims = DIMS.filter(function (dm) { return dm.group === g.id; });
    var grp = el('div', { class: 'dim-group' });
    grp.appendChild(el('h3', null, null));
    grp.firstChild.appendChild(el('span', null, g.name));
    grp.firstChild.appendChild(el('span', { class: 'count' }, dims.length + ' 维'));
    dims.forEach(function (dm) { grp.appendChild(buildDimRow(dm)); });
    nav.appendChild(grp);
  });
}
function buildDimRow(dm) {
  var row = el('div', { class: 'dim-row', dataset: { dim: dm.id } });
  var line = el('div', { class: 'dim-line' });
  line.appendChild(el('span', { class: 'dim-name' }, dm.name));
  line.appendChild(el('span', { class: 'dim-unit' }, dm.type === 'cat' ? dm.cats.length + ' 类' : dm.unit));
  line.appendChild(el('span', { class: 'dim-dot', hidden: '' }));
  var rb = el('span', { class: 'role-btns', role: 'group', 'aria-label': dm.name + ' 的投影角色' });
  [['x', 'X', '设为 X 轴'], ['y', 'Y', '设为 Y 轴'], ['color', '色', '设为颜色编码']].forEach(function (p) {
    var dis = p[0] !== 'color' && dm.type === 'cat';
    rb.appendChild(el('button', {
      type: 'button', dataset: { act: 'role', role: p[0], dim: dm.id },
      title: p[2] + (dis ? '（分类维度仅可作颜色）' : ''), 'aria-pressed': 'false',
      disabled: dis ? '' : null
    }, p[1]));
  });
  line.appendChild(rb);
  line.appendChild(el('button', {
    type: 'button', class: 'filter-toggle', dataset: { act: 'filter-toggle', dim: dm.id },
    'aria-expanded': 'false', title: '展开/收起 ' + dm.name + ' 的过滤编辑器'
  }, '过滤'));
  row.appendChild(line);
  if (dm.type === 'num') {
    var e = EXTENT[dm.id];
    row.appendChild(el('p', { class: 'dim-extent' }, '范围 ' + fmtVal(dm.id, e.min) + ' – ' + fmtVal(dm.id, e.max) + ' ' + dm.unit));
  } else {
    row.appendChild(el('p', { class: 'dim-extent' }, dm.cats.join(' / ')));
  }
  row.appendChild(buildEditor(dm));
  return row;
}
function buildEditor(dm) {
  var ed = el('div', { class: 'dim-editor', hidden: '', dataset: { editor: dm.id } });
  if (dm.type === 'num') {
    var e = EXTENT[dm.id], step = (e.max - e.min) / 200;
    [['min', '下限'], ['max', '上限']].forEach(function (p) {
      var line = el('div', { class: 'range-line' });
      var lab = el('label', { for: 'f-' + dm.id + '-' + p[0] }, p[1] + ' ');
      var out = el('output', { id: 'o-' + dm.id + '-' + p[0], for: 'f-' + dm.id + '-' + p[0] });
      lab.appendChild(out);
      line.appendChild(lab);
      line.appendChild(el('input', {
        type: 'range', id: 'f-' + dm.id + '-' + p[0], dataset: { bound: p[0], dim: dm.id },
        min: String(e.min), max: String(e.max), step: String(step), value: String(p[0] === 'min' ? e.min : e.max),
        'aria-label': dm.name + ' 过滤' + p[1]
      }));
      ed.appendChild(line);
    });
  } else {
    var list = el('div', { class: 'cat-list', role: 'group', 'aria-label': dm.name + ' 保留类别' });
    dm.cats.forEach(function (c) {
      var lab = el('label');
      var cb = el('input', { type: 'checkbox', checked: '', value: c, dataset: { dim: dm.id, act: 'cat' } });
      cb.addEventListener('change', onCatChange);
      lab.appendChild(cb);
      lab.appendChild(document.createTextNode(c));
      list.appendChild(lab);
    });
    ed.appendChild(list);
  }
  var foot = el('div', { class: 'editor-foot' });
  foot.appendChild(el('span', { class: 'mini' }, '归属维度：' + dm.name));
  if (dm.type === 'cat') {
    var allBtns = el('span');
    allBtns.appendChild(el('button', { type: 'button', class: 'ghost', dataset: { act: 'cat-all', dim: dm.id } }, '全选'));
    allBtns.appendChild(el('button', { type: 'button', class: 'ghost', dataset: { act: 'cat-none', dim: dm.id } }, '清空'));
    foot.appendChild(allBtns);
  }
  foot.appendChild(el('button', { type: 'button', dataset: { act: 'filter-clear', dim: dm.id } }, '移除过滤'));
  ed.appendChild(foot);
  return ed;
}

function updateCatalog() {
  document.querySelectorAll('.dim-row').forEach(function (row) {
    var id = row.dataset.dim, dm = DIM[id];
    var hasF = !!state.filters[id];
    row.classList.toggle('filtered', hasF);
    row.querySelector('.dim-dot').hidden = !hasF;
    row.querySelectorAll('[data-act="role"]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(state[b.dataset.role] === id));
    });
    var ft = row.querySelector('.filter-toggle');
    ft.setAttribute('aria-expanded', String(openEditors.has(id)));
    ft.textContent = openEditors.has(id) ? '收起' : '过滤';
    var ed = row.querySelector('.dim-editor');
    ed.hidden = !openEditors.has(id);
    if (ed.hidden) return;
    if (dm.type === 'num') {
      var f = state.filters[id], e = EXTENT[id];
      var lo = f ? f.min : e.min, hi = f ? f.max : e.max;
      var smin = $('#f-' + id + '-min'), smax = $('#f-' + id + '-max');
      if (document.activeElement !== smin) smin.value = String(lo);
      if (document.activeElement !== smax) smax.value = String(hi);
      $('#o-' + id + '-min').textContent = '≥ ' + fmtNum(id, lo);
      $('#o-' + id + '-max').textContent = '≤ ' + fmtNum(id, hi);
    } else if (f) {
      ed.querySelectorAll('input[type="checkbox"]').forEach(function (cb) {
        cb.checked = f.on.has(cb.value);
      });
    } else {
      ed.querySelectorAll('input[type="checkbox"]').forEach(function (cb) { cb.checked = true; });
    }
  });
}

/* ---------- 目录事件（委托） ---------- */
$('#catalog').addEventListener('click', function (ev) {
  var b = ev.target.closest('button');
  if (!b) return;
  var dimId = b.dataset.dim, act = b.dataset.act, dm = DIM[dimId];
  if (act === 'role') {
    var role = b.dataset.role;
    if (role === 'color') {
      if (state.color === dimId) return;
      state.color = dimId; push('颜色→' + dm.name, dm.name);
    } else {
      if (state[role] === dimId) return;
      var other = role === 'x' ? 'y' : 'x';
      if (state[other] === dimId) state[other] = state[role]; // 互换，避免轴重复
      state[role] = dimId;
      push(role.toUpperCase() + '→' + dm.name, dm.name);
    }
  } else if (act === 'filter-toggle') {
    if (openEditors.has(dimId)) openEditors.delete(dimId);
    else openEditors.add(dimId);
    updateCatalog();
  } else if (act === 'filter-clear') {
    if (state.filters[dimId]) removeFilter(dimId);
  } else if (act === 'cat-all' || act === 'cat-none') {
    var f = ensureCatFilter(dimId);
    if (act === 'cat-all') f.on = new Set(dm.cats);
    else f.on = new Set();
    push('调整 ' + dm.name + ' 过滤', dm.name);
  }
});
$('#catalog').addEventListener('input', function (ev) {
  var s = ev.target;
  if (s.type !== 'range') return;
  var dimId = s.dataset.dim, bound = s.dataset.bound;
  var f = ensureNumFilter(dimId);
  f[bound] = +s.value;
  if (bound === 'min' && f.min > f.max) f.min = f.max;
  if (bound === 'max' && f.max < f.min) f.max = f.min;
  renderDataDependents(); updateCatalog();
});
$('#catalog').addEventListener('change', function (ev) {
  var s = ev.target;
  if (s.type !== 'range') return;
  push('调整 ' + DIM[s.dataset.dim].name + ' 范围', DIM[s.dataset.dim].name);
});
function onCatChange(ev) {
  var cb = ev.target, dimId = cb.dataset.dim, dm = DIM[dimId];
  var f = ensureCatFilter(dimId);
  if (cb.checked) f.on.add(cb.value); else f.on.delete(cb.value);
  push('调整 ' + dm.name + ' 过滤', dm.name);
}

/* =====================================================================
 * 4. 散点投影（SVG，轴域固定于全量范围）
 * ===================================================================== */
function scales() {
  var xe = EXTENT[state.x], ye = EXTENT[state.y];
  var iw = chartW - M.l - M.r, ih = chartH - M.t - M.b;
  return {
    xe: xe, ye: ye, iw: iw, ih: ih,
    x: function (v) { return M.l + (v - xe.min) / (xe.max - xe.min) * iw; },
    y: function (v) { return M.t + ih - (v - ye.min) / (ye.max - ye.min) * ih; }
  };
}
function renderChart() {
  var sc = scales();
  chart.setAttribute('viewBox', '0 0 ' + chartW + ' ' + chartH);
  chart.setAttribute('width', chartW); chart.setAttribute('height', chartH);
  while (chart.firstChild) chart.removeChild(chart.firstChild);

  var xdm = DIM[state.x], ydm = DIM[state.y];
  chart.setAttribute('aria-label',
    '散点投影：X ' + xdm.name + '（' + xdm.unit + '），Y ' + ydm.name + '（' + ydm.unit +
    '），颜色 ' + DIM[state.color].name + '。可见 ' + visibleRecords().length + ' / ' + DATA.length +
    ' 条。方向键移动光标，回车切换选中。');

  /* 网格 + 刻度（弱化，退居信息之后） */
  var gGrid = svgEl('g');
  niceTicks(sc.xe.min, sc.xe.max, 6).forEach(function (t) {
    gGrid.appendChild(svgEl('line', { x1: sc.x(t), x2: sc.x(t), y1: M.t, y2: M.t + sc.ih, stroke: 'var(--grid)', 'stroke-width': 1 }));
    var tx = svgEl('text', { x: sc.x(t), y: M.t + sc.ih + 16, 'text-anchor': 'middle', 'font-size': 12, fill: 'var(--ink-2)', 'font-family': 'inherit' });
    tx.textContent = fmtVal(state.x, t); gGrid.appendChild(tx);
  });
  niceTicks(sc.ye.min, sc.ye.max, 5).forEach(function (t) {
    gGrid.appendChild(svgEl('line', { x1: M.l, x2: M.l + sc.iw, y1: sc.y(t), y2: sc.y(t), stroke: 'var(--grid)', 'stroke-width': 1 }));
    var ty = svgEl('text', { x: M.l - 8, y: sc.y(t) + 4, 'text-anchor': 'end', 'font-size': 12, fill: 'var(--ink-2)', 'font-family': 'inherit' });
    ty.textContent = fmtVal(state.y, t); gGrid.appendChild(ty);
  });
  chart.appendChild(gGrid);
  chart.appendChild(svgEl('line', { x1: M.l, x2: M.l + sc.iw, y1: M.t + sc.ih, y2: M.t + sc.ih, stroke: 'var(--axis)', 'stroke-width': 1 }));
  chart.appendChild(svgEl('line', { x1: M.l, x2: M.l, y1: M.t, y2: M.t + sc.ih, stroke: 'var(--axis)', 'stroke-width': 1 }));

  var xt = svgEl('text', { x: M.l + sc.iw / 2, y: chartH - 6, 'text-anchor': 'middle', 'font-size': 12.5, 'font-weight': 600, fill: 'var(--ink)', 'font-family': 'inherit' });
  xt.textContent = 'X 轴：' + xdm.name + '（' + xdm.unit + '）';
  var yt = svgEl('text', { x: 14, y: M.t + sc.ih / 2, 'text-anchor': 'middle', 'font-size': 12.5, 'font-weight': 600, fill: 'var(--ink)', 'font-family': 'inherit', transform: 'rotate(-90 14 ' + (M.t + sc.ih / 2) + ')' });
  yt.textContent = 'Y 轴：' + ydm.name + '（' + ydm.unit + '）';
  chart.appendChild(xt); chart.appendChild(yt);

  /* 点：被过滤的先画（淡出锚点，保持认知连续），可见的在上层 */
  var g = svgEl('g');
  var visible = [];
  var emptyMsg = null;
  DATA.forEach(function (rec) {
    var vis = passFilters(rec);
    var c = svgEl('circle', {
      cx: sc.x(rec[state.x]).toFixed(1), cy: sc.y(rec[state.y]).toFixed(1), r: 4.5,
      fill: colorOf(state.color, rec), 'fill-opacity': vis ? 0.88 : 0.10,
      'data-id': rec.id
    });
    if (!vis) { c.setAttribute('pointer-events', 'none'); }
    else {
      c.setAttribute('stroke', 'rgba(0,0,0,0)');      /* 透明描边把命中区扩到 ≥24px 直径 */
      c.setAttribute('stroke-width', '15');
      c.setAttribute('pointer-events', 'stroke');
      visible.push(rec);
    }
    g.appendChild(c);
  });
  chart.appendChild(g);

  /* 选中环 + 标签 */
  var rings = svgEl('g'), labels = svgEl('g');
  var labeled = state.selection.size <= 8 ? Array.from(state.selection) : (state.lastSel != null ? [state.lastSel] : []);
  state.selection.forEach(function (id) {
    var rec = DATA[id];
    rings.appendChild(svgEl('circle', { cx: sc.x(rec[state.x]).toFixed(1), cy: sc.y(rec[state.y]).toFixed(1), r: 7.5, fill: 'none', stroke: '#fff', 'stroke-width': 3 }));
    rings.appendChild(svgEl('circle', { cx: sc.x(rec[state.x]).toFixed(1), cy: sc.y(rec[state.y]).toFixed(1), r: 7.5, fill: 'none', stroke: '#0b0b0b', 'stroke-width': 2 }));
  });
  labeled.forEach(function (id) {
    var rec = DATA[id];
    var t = svgEl('text', { x: sc.x(rec[state.x]) + 10, y: sc.y(rec[state.y]) - 8, 'font-size': 12, fill: 'var(--ink)', 'font-family': 'inherit', 'paint-order': 'stroke', stroke: '#fcfcfb', 'stroke-width': 3 });
    t.textContent = rec.name; labels.appendChild(t);
  });
  chart.appendChild(rings); chart.appendChild(labels);

  /* 空态：过滤把所有记录排除时给出可撤销的出路提示 */
  if (!visible.length) {
    emptyMsg = svgEl('text', {
      x: M.l + sc.iw / 2, y: M.t + sc.ih / 2 - 10, 'text-anchor': 'middle',
      'font-size': 14, fill: 'var(--ink-2)', 'font-family': 'inherit'
    });
    emptyMsg.textContent = '当前过滤条件下没有可见记录 —— 在状态条或维度目录移除过滤即可恢复（可撤销）';
    chart.appendChild(emptyMsg);
  }

  /* 键盘光标 */
  var cur = cursorRec(visible);
  if (cur) {
    chart.appendChild(svgEl('rect', {
      x: (sc.x(cur[state.x]) - 10).toFixed(1), y: (sc.y(cur[state.y]) - 10).toFixed(1),
      width: 20, height: 20, rx: 5, fill: 'none', stroke: '#0b0b0b', 'stroke-width': 1.6, 'stroke-dasharray': '4 3'
    }));
  }
  chart._visible = visible; chart._sc = sc;
}
function cursorRec(visible) {
  if (!visible.length) return null;
  var i = visible.findIndex(function (r) { return r.id === cursorId; });
  return visible[i >= 0 ? i : 0];
}
function moveCursor(delta, announceIt) {
  var visible = chart._visible || [];
  if (!visible.length) return;
  var i = visible.findIndex(function (r) { return r.id === cursorId; });
  i = i < 0 ? 0 : clamp(i + delta, 0, visible.length - 1);
  cursorId = visible[i].id;
  renderChart();
  if (announceIt !== false) {
    var rec = visible[i];
    announce(rec.name + '：' + DIM[state.x].name + ' ' + fmtNum(state.x, rec[state.x]) + '，' + DIM[state.y].name + ' ' + fmtNum(state.y, rec[state.y]));
  }
}
chart.addEventListener('keydown', function (ev) {
  var step = ev.key === 'PageUp' ? -10 : ev.key === 'PageDown' ? 10 :
             (ev.key === 'ArrowRight' || ev.key === 'ArrowUp') ? 1 :
             (ev.key === 'ArrowLeft' || ev.key === 'ArrowDown') ? -1 : 0;
  if (step) { ev.preventDefault(); moveCursor(step); }
  else if (ev.key === 'Enter' || ev.key === ' ') {
    ev.preventDefault();
    var vis = chart._visible || [];
    if (cursorId != null && vis.some(function (r) { return r.id === cursorId; })) {
      toggleSelect(cursorId, '键盘选中');
    }
  }
});
chart.addEventListener('click', function (ev) {
  var t = ev.target.closest('[data-id]');
  if (t) toggleSelect(+t.dataset.id, '选中');
});
chart.addEventListener('pointermove', function (ev) {
  var t = ev.target.closest ? ev.target.closest('[data-id]') : null;
  if (!t || t.getAttribute('pointer-events') === 'none') { hideTip(); return; }
  var rec = DATA[+t.dataset.id];
  if (!passFilters(rec)) { hideTip(); return; }
  tooltip.hidden = false;
  tooltip.innerHTML = '';
  tooltip.appendChild(el('b', null, rec.name + '（' + rec.region + '）'));
  [[state.x, 'X'], [state.y, 'Y'], [state.color, '颜色']].forEach(function (p) {
    var row = el('div', { class: 'tt-row' });
    row.appendChild(el('span', { class: 'tt-k' }, p[1] + ' ' + DIM[p[0]].name));
    row.appendChild(el('span', null, fmtNum(p[0], rec[p[0]])));
    tooltip.appendChild(row);
  });
  var r = chartwrap.getBoundingClientRect();
  var x = ev.clientX - r.left + 14, y = ev.clientY - r.top + 14;
  if (x + 180 > r.width) x -= 200; if (y + 90 > r.height) y -= 100;
  tooltip.style.left = x + 'px'; tooltip.style.top = y + 'px';
});
chart.addEventListener('pointerleave', hideTip);
chart.addEventListener('pointerdown', function (ev) {
  var t = ev.target.closest ? ev.target.closest('[data-id]') : null;
  if (t) cursorId = +t.dataset.id;
});
function hideTip() { tooltip.hidden = true; }

function toggleSelect(id, verb) {
  var rec = DATA[id];
  if (state.selection.has(id)) {
    state.selection.delete(id);
    if (state.lastSel === id) state.lastSel = state.selection.size ? Array.from(state.selection).pop() : null;
    push('取消选中 ' + rec.name, '选择');
  } else {
    state.selection.add(id);
    state.lastSel = id;
    push((verb || '选中') + ' ' + rec.name, '选择');
    announce('已选中 ' + rec.name + '（共 ' + state.selection.size + ' 条）');
  }
}

/* =====================================================================
 * 5. 状态条 / 图例 / 标题 / 表格 / 检查器 / 轨迹
 * ===================================================================== */
function renderStateBar() {
  var box = $('#chips');
  box.textContent = '';
  var n = 0;
  Object.keys(state.filters).forEach(function (dimId) {
    n++;
    var dm = DIM[dimId], f = state.filters[dimId];
    var chip = el('span', { class: 'chip' });
    chip.appendChild(el('span', { class: 'owner' }, dm.name));   /* 归属：所属维度 */
    var e = EXTENT[dimId];
    var cond = f.kind === 'num'
      ? fmtVal(dimId, f.min) + ' – ' + fmtVal(dimId, f.max) + (f.min <= e.min + 1e-9 && f.max >= e.max - 1e-9 ? '（全部范围）' : ' ' + dm.unit)
      : f.on.size + ' / ' + dm.cats.length + ' 类保留';
    chip.appendChild(el('span', { class: 'cond' }, cond));
    var x = el('button', { type: 'button', class: 'chip-x', title: '移除 ' + dm.name + ' 的过滤（可撤销）', 'aria-label': '移除 ' + dm.name + ' 的过滤' }, '×');
    x.addEventListener('click', function () { removeFilter(dimId); });
    chip.appendChild(x);
    box.appendChild(chip);
  });
  if (state.selection.size) {
    n++;
    var chip = el('span', { class: 'chip' });
    chip.appendChild(el('span', { class: 'owner' }, '选择'));
    chip.appendChild(el('span', { class: 'cond' }, '已选 ' + state.selection.size + ' 条'));
    var x2 = el('button', { type: 'button', class: 'chip-x', title: '清除全部选择（可撤销）', 'aria-label': '清除全部选择' }, '×');
    x2.addEventListener('click', clearSelection);
    chip.appendChild(x2);
    box.appendChild(chip);
  }
  if (!n) box.appendChild(el('span', { class: 'none' }, '暂无过滤器 / 选择 —— 状态在此逐条归属显示'));
  $('#visible-count').textContent = '可见 ' + visibleRecords().length + ' / ' + DATA.length;
  $('#btn-undo').disabled = ptr <= 0;
  $('#btn-redo').disabled = ptr >= tape.length - 1;
}
function clearSelection() {
  if (!state.selection.size) return;
  state.selection = new Set(); state.lastSel = null;
  push('清除选择', '选择');
}
function renderTitle() {
  var t = $('#proj-title');
  t.textContent = '';
  [['X 轴', state.x], ['Y 轴', state.y], ['颜色', state.color]].forEach(function (p, i) {
    if (i) t.appendChild(el('span', { class: 'sep' }, '·'));
    t.appendChild(el('span', { class: 'role' }, p[0] + ' '));
    t.appendChild(el('span', { class: 'dimname' }, DIM[p[1]].name));
    if (DIM[p[1]].unit) t.appendChild(el('span', { class: 'unit' }, '（' + DIM[p[1]].unit + '）'));
  });
}
function renderLegend() {
  var lg = $('#legend'), dm = DIM[state.color];
  lg.textContent = '';
  lg.appendChild(el('span', { class: 'lg-title' }, '颜色 = ' + dm.name + '：'));
  if (dm.type === 'cat') {
    var f = state.filters[state.color];
    dm.cats.forEach(function (c, i) {
      var total = DATA.filter(function (r) { return r[state.color] === c; }).length;
      var vis = DATA.filter(function (r) { return r[state.color] === c && passFilters(r); }).length;
      var off = f && !f.on.has(c);
      var b = el('button', { type: 'button', class: 'lg-chip' + (off ? ' off' : ''), title: '点击切换「' + c + '」的保留状态（归属维度：' + dm.name + '）', 'aria-pressed': String(!off) });
      b.appendChild(el('span', { class: 'swatch', style: 'background:' + CAT_PALETTE[state.color][i] }));
      b.appendChild(document.createTextNode(c + ' '));
      b.appendChild(el('span', { class: 'n' }, off ? '0/' + total : vis + '/' + total));
      b.addEventListener('click', function () {
        var fl = ensureCatFilter(state.color);
        if (fl.on.has(c)) fl.on.delete(c); else fl.on.add(c);
        push('调整 ' + dm.name + ' 过滤', dm.name);
      });
      lg.appendChild(b);
    });
  } else {
    var e = EXTENT[state.color];
    lg.appendChild(el('span', { class: 'ramp', style: 'background:linear-gradient(90deg,' + SEQ.join(',') + ')' }));
    lg.appendChild(el('span', { class: 'ramp-labels' }, fmtVal(state.color, e.min) + ' → ' + fmtVal(state.color, e.max) + ' ' + dm.unit + '（低 → 高）'));
  }
}
function renderTable() {
  var tb = $('#table'), vis = visibleRecords();
  tb.textContent = '';
  var thead = el('thead'), trh = el('tr');
  trh.appendChild(el('th', null, '记录'));
  [[state.x, 'X'], [state.y, 'Y'], [state.color, '颜色']].forEach(function (p) {
    trh.appendChild(el('th', null, p[1] + '·' + DIM[p[0]].name));
  });
  thead.appendChild(trh); tb.appendChild(thead);
  var tbody = el('tbody');
  vis.forEach(function (rec) {
    var tr = el('tr');
    var td0 = el('td');
    td0.appendChild(el('span', { class: 'swatch', style: 'background:' + colorOf(state.color, rec) }));
    td0.appendChild(document.createTextNode(rec.name + '（' + rec.region + '）'));
    tr.appendChild(td0);
    [[state.x], [state.y], [state.color]].forEach(function (p) {
      tr.appendChild(el('td', null, fmtNum(p[0], rec[p[0]])));
    });
    tbody.appendChild(tr);
  });
  tb.appendChild(tbody);
}
function renderInspector() {
  var box = $('#inspector');
  box.textContent = '';
  if (state.lastSel == null) {
    var emp = el('div', { class: 'inspector-empty' });
    emp.appendChild(el('span', { class: 'big', 'aria-hidden': 'true' }, '◦ ◦ ◦'));
    emp.appendChild(document.createTextNode('尚未选中记录。点击散点（或用方向键 + 回车）选择一座城市；选择会跨维度切换保持，画像随之持续更新。'));
    box.appendChild(emp);
    return;
  }
  var rec = DATA[state.lastSel];
  var head = el('div', { class: 'rec-head' });
  head.appendChild(el('h3', null, rec.name));
  var bReg = el('span', { class: 'badge' });
  bReg.appendChild(el('span', { class: 'swatch', style: 'background:' + colorOf('region', rec) }));
  bReg.appendChild(document.createTextNode(rec.region));
  head.appendChild(bReg);
  head.appendChild(el('span', { class: 'badge' }, rec.tier));
  box.appendChild(head);

  if (state.selection.size > 1) {
    var sl = el('div', { class: 'sel-list' });
    Array.from(state.selection).forEach(function (id) {
      var c = el('span', { class: 'chip' });
      c.appendChild(el('span', { class: 'cond' }, DATA[id].name));
      var x = el('button', { type: 'button', class: 'chip-x', title: '从选择中移除 ' + DATA[id].name, 'aria-label': '从选择中移除 ' + DATA[id].name }, '×');
      x.addEventListener('click', function () {
        state.selection.delete(id);
        if (state.lastSel === id) state.lastSel = state.selection.size ? Array.from(state.selection)[state.selection.size - 1] : null;
        push('取消选中 ' + DATA[id].name, '选择');
      });
      c.appendChild(x);
      sl.appendChild(c);
    });
    box.appendChild(sl);
  }

  GROUPS.forEach(function (g) {
    var dims = DIMS.filter(function (dm) { return dm.group === g.id; });
    if (!dims.length) return;
    var grp = el('div', { class: 'profile-group' });
    grp.appendChild(el('h4', null, g.name));
    dims.forEach(function (dm) {
      var e = dm.type === 'num' ? EXTENT[dm.id] : null;
      var row = el('div', { class: 'profile-row' });
      var name = el('span', { class: 'p-name' });
      [['x', 'X'], ['y', 'Y'], ['color', '色']].forEach(function (p) {
        if (state[p[0]] === dm.id) name.appendChild(el('span', { class: 'roletag' }, p[1]));
      });
      name.appendChild(document.createTextNode(dm.name));
      row.appendChild(name);
      if (dm.type === 'num') {
        var bar = el('span', { class: 'p-bar' });
        var w = clamp((rec[dm.id] - e.min) / (e.max - e.min) * 100, 1.5, 100);
        bar.appendChild(el('i', { style: 'width:' + w.toFixed(1) + '%' }));
        row.appendChild(bar);
        row.appendChild(el('span', { class: 'p-val' }, fmtNum(dm.id, rec[dm.id])));
      } else {
        row.appendChild(el('span'));
        row.appendChild(el('span', { class: 'p-val' }, rec[dm.id]));
      }
      grp.appendChild(row);
    });
    box.appendChild(grp);
  });
}
function renderTrail() {
  var ol = $('#trail');
  ol.textContent = '';
  for (var i = tape.length - 1; i >= 0; i--) {
    (function (i) {
      var li = el('li', { class: i === ptr ? 'current' : i > ptr ? 'future' : '' });
      if (i === ptr) li.setAttribute('aria-current', 'step');
      var b = el('button', { type: 'button', class: 'trail-item', title: '回退到这一步（可继续撤销/重做）' });
      b.appendChild(el('span', { class: 'step' }, '#' + (i + 1)));
      b.appendChild(el('span', { class: 'lbl' }, tape[i].label));
      b.appendChild(el('span', { class: 'own' }, tape[i].owner));
      b.addEventListener('click', function () { jumpTo(i); });
      li.appendChild(b);
      ol.appendChild(li);
    })(i);
  }
  if (!tape.length) ol.appendChild(el('li', { class: 'inspector-empty' }, '暂无历史'));
}

/* =====================================================================
 * 6. 全局事件 / 启动
 * ===================================================================== */
$('#btn-undo').addEventListener('click', undo);
$('#btn-redo').addEventListener('click', redo);
$('#btn-reset').addEventListener('click', function () {
  restore(tape[0].snap);
  push('重置视图', '全局');
  announce('已重置到初始视图（可通过撤销回到重置前）');
});
document.addEventListener('keydown', function (ev) {
  var mod = ev.ctrlKey || ev.metaKey;
  if (mod && !ev.altKey && ev.key.toLowerCase() === 'z') {
    ev.preventDefault();
    if (ev.shiftKey) redo(); else undo();
  } else if (mod && !ev.altKey && ev.key.toLowerCase() === 'y') {
    ev.preventDefault(); redo();
  } else if (ev.key === 'Escape' && !ev.ctrlKey && !ev.metaKey &&
             document.activeElement.tagName !== 'INPUT') {
    clearSelection();
  }
});

function renderDataDependents() { renderChart(); renderStateBar(); renderLegend(); renderTable(); }
function renderAll() {
  renderTitle(); updateCatalog(); renderDataDependents(); renderInspector(); renderTrail();
}

buildCatalog();
snapshot('初始视图', '全局');
renderAll();
announce('就绪：' + DATA.length + ' 条记录、' + DIMS.length + ' 个维度已加载，可直接探索。');
})();
