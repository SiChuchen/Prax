/* 落点 · 选址对比台
 * 单屏选址决策：左地图语境 + 右比较矩阵 + 底部权重/落定条。
 * 全部数据内联，无网络请求，加载即 ready（无加载态）。
 * 状态模型：ready（初始）→ selected（选定候选）→ decided（落定，驻留同屏）。
 * loading / empty / error 为防御性守卫：数据内联故无加载与空态路径，初始化异常落入 #fatal 提示。
 */
'use strict';

/* ── 数据（内联，示意数据） ─────────────────────────────── */

const CATS = [
  { id: 'price',   label: '价格' },
  { id: 'commute', label: '通勤' },
  { id: 'space',   label: '空间' },
  { id: 'quiet',   label: '安静' },
  { id: 'light',   label: '采光' },
  { id: 'quality', label: '品质' },
];

const DIMS = {
  rent:    { label: '月租', unit: '元 / 月', cat: 'price', num: true, dir: 'low',  win: c => `月租最低 ¥${c.v.rent.toLocaleString('zh-CN')}` },
  commute: { label: '通勤 · 到公司', unit: '分钟 · 门到门', cat: 'commute', num: true, dir: 'low', win: c => `通勤最短（${c.v.commute} 分钟）` },
  deposit: { label: '押付方式', cat: 'price', win: c => `押付最轻（${c.t.deposit}）` },
  area:    { label: '面积', unit: '㎡', cat: 'space', num: true, dir: 'high', win: c => `面积最大（${c.v.area} ㎡）` },
  layout:  { label: '户型', cat: 'space', win: () => '户型最完整' },
  noise:   { label: '噪音 · 昼间', unit: 'dB', cat: 'quiet', num: true, dir: 'low', win: c => `最安静（${c.v.noise} dB）` },
  light:   { label: '采光', cat: 'light', win: () => '采光最优' },
  age:     { label: '楼龄', unit: '年', cat: 'quality', num: true, dir: 'low', win: c => `楼龄最新（${c.v.age} 年）` },
  floor:   { label: '楼层 · 电梯', cat: 'quality', win: () => '梯户条件最优' },
  nearby:  { label: '周边配套', cat: 'quality', win: () => '日常配套最全' },
};
Object.keys(DIMS).forEach(id => { DIMS[id].id = id; }); // 维度对象自带 id（键与字段同步）

const GROUPS = [
  { label: '成本与通勤', dims: ['rent', 'commute', 'deposit'] },
  { label: '空间与舒适', dims: ['area', 'layout', 'noise', 'light'] },
  { label: '楼况与配套', dims: ['age', 'floor', 'nearby'] },
];

const CANDIDATES = [
  { id: 'c1', name: '望江里 · B 座', color: 'var(--c1)', tag: '临街高层 · 江景', map: { x: 336, y: 168 },
    v: { rent: 3580, commute: 32, area: 45, noise: 62, age: 3 },
    q: { deposit: 5, layout: 3, light: 5, floor: 4, nearby: 4 },
    t: { deposit: '押一付一', layout: '一室一厅', light: '东南向 · 充足', floor: '14/26 · 双电梯',
         nearby: '菜场 300m · 健身 450m', noiseTag: '临街', commuteNote: '公交 2 站 + 步行 600m' } },
  { id: 'c2', name: '榕树苑 · 3 栋', color: 'var(--c2)', tag: '公园旁 · 低密院落', map: { x: 140, y: 330 },
    v: { rent: 4200, commute: 18, area: 62, noise: 48, age: 12 },
    q: { deposit: 2, layout: 5, light: 4, floor: 4, nearby: 5 },
    t: { deposit: '押一付三', layout: '两室一厅', light: '南向 · 院景', floor: '6/11 · 电梯',
         nearby: '公园即达 · 菜场 150m', noiseTag: '围合院内', commuteNote: '地铁 4 站直达' } },
  { id: 'c3', name: '科苑馨庭', color: 'var(--c3)', tag: '地铁上盖 · 商圈', map: { x: 250, y: 398 },
    v: { rent: 3250, commute: 25, area: 38, noise: 58, age: 8 },
    q: { deposit: 3, layout: 2, light: 2, floor: 3, nearby: 3 },
    t: { deposit: '押二付一', layout: '开间', light: '北向 · 一般', floor: '22/30 · 电梯',
         nearby: '商场楼下 · 菜场 700m', noiseTag: '地铁上盖', commuteNote: '地铁 6 站' } },
  { id: 'c4', name: '永安坊 · 西院', color: 'var(--c4)', tag: '老城厢 · 带书房', map: { x: 84, y: 96 },
    v: { rent: 3890, commute: 41, area: 54, noise: 49, age: 21 },
    q: { deposit: 2, layout: 4, light: 3, floor: 2, nearby: 4 },
    t: { deposit: '押一付三', layout: '一室一厅 + 书房', light: '西向 · 午后光', floor: '3/6 · 无电梯',
         nearby: '老城商圈 · 医院 200m', noiseTag: '巷内', commuteNote: '公交两程 + 步行' } },
];

/* 通勤线路（自绘 SVG 路径）与时长标签位置 */
const ROUTES = {
  c1: { d: 'M336,168 C320,196 284,202 257,207', lx: 302, ly: 192 },
  c2: { d: 'M140,330 C168,292 220,242 250,213', lx: 176, ly: 268 },
  c3: { d: 'M250,398 C246,340 252,262 251,213', lx: 238, ly: 320 },
  c4: { d: 'M84,96 C118,142 202,192 249,207',   lx: 136, ly: 152 },
};

const PRESETS = {
  均衡:     { price: 4, commute: 4, space: 3, quiet: 3, light: 2, quality: 2 },
  省钱优先: { price: 5, commute: 2, space: 2, quiet: 3, light: 1, quality: 2 },
  通勤优先: { price: 2, commute: 5, space: 2, quiet: 3, light: 2, quality: 1 },
  品质优先: { price: 2, commute: 3, space: 5, quiet: 4, light: 4, quality: 5 },
};

/* ── 状态（会话内；按交付约束不做跨会话持久化） ───────────── */

const state = {
  weights: { ...PRESETS.均衡 },
  selected: null,   // selected 态：列头/图钉联动高亮
  decided: null,    // decided 态：落定，驻留同屏
};

const $ = (sel, root) => (root || document).querySelector(sel);
const byId = id => CANDIDATES.find(c => c.id === id);
const SVGNS = 'http://www.w3.org/2000/svg';

/* ── 评分模型：维度归一 0–100 → 类别均值 → 加权总分 ─────────── */

function normFor(dim, cand) {
  if (!dim.num) return (cand.q[dim.id] - 1) / 4 * 100;
  const vals = CANDIDATES.map(c => c.v[dim.id]);
  const mx = Math.max(...vals), mn = Math.min(...vals);
  if (mx === mn) return 100;
  const v = cand.v[dim.id];
  // dir 'low'：取值越小越优（最小值 → 100）；'high' 相反
  return dim.dir === 'low' ? (mx - v) / (mx - mn) * 100 : (v - mn) / (mx - mn) * 100;
}

function computeScores() {
  let ws = CATS.map(c => state.weights[c.id]);
  const allZero = ws.every(w => w === 0);
  const out = {};
  CANDIDATES.forEach(cand => {
    let sum = 0, wsum = 0;
    CATS.forEach(cat => {
      const dims = GROUPS.flatMap(g => g.dims).map(id => DIMS[id]).filter(d => d.cat === cat.id);
      const mean = dims.reduce((a, d) => a + normFor(d, cand), 0) / dims.length;
      const w = allZero ? 1 : state.weights[cat.id];
      sum += w * mean; wsum += w;
    });
    out[cand.id] = Math.round(sum / wsum);
  });
  return out;
}

const rankedIds = scores => CANDIDATES.map(c => c.id).sort((a, b) => scores[b] - scores[a]);

function reasonFor(cand, scores) {
  const allDims = GROUPS.flatMap(g => g.dims).map(id => DIMS[id]);
  const wins = allDims
    .filter(d => normFor(d, cand) === 100)
    .sort((a, b) => state.weights[b.cat] - state.weights[a.cat])
    .slice(0, 3)
    .map(d => d.win(cand));
  return wins.length ? wins.join(' · ') : `综合加权 ${scores[cand.id]} 分`;
}

/* ── 构建：表头（一次性，之后只切换状态类） ─────────────────── */

function buildHead() {
  const row = $('#head-row');
  CANDIDATES.forEach(c => {
    const th = document.createElement('th');
    th.scope = 'col';
    th.className = 'cand-head';
    th.dataset.col = c.id;
    th.style.setProperty('--pin', c.color);
    th.innerHTML =
      `<div class="ch-top">` +
      `<span class="pin-dot" style="background:${c.color}"></span>` +
      `<div><div class="ch-name">${c.name}</div><div class="ch-tag">${c.tag}</div></div>` +
      `<button class="btn-select" data-select="${c.id}" aria-pressed="false" title="选定 ${c.name}">选定</button>` +
      `<span class="badge-decided" data-badge="${c.id}">已落定 ✓</span>` +
      `</div>`;
    th.addEventListener('click', e => { if (!e.target.closest('button')) select(c.id); });
    row.appendChild(th);
  });
  row.addEventListener('click', e => {
    const btn = e.target.closest('button[data-select]');
    if (btn) select(btn.dataset.select);
  });
}

/* ── 构建：比较矩阵主体（重渲染，量小无性能负担） ───────────── */

function miniBar(dim, c) {
  if (!dim.num) return '';
  const n = Math.round(normFor(dim, c));
  return `<span class="mini-bar" aria-hidden="true"><i style="width:${n}%;background:${c.color}"></i></span>`;
}

function cellHTML(dim, c) {
  switch (dim.id) {
    case 'rent':    return `<span class="cell-val">¥${c.v.rent.toLocaleString('zh-CN')}</span>` + miniBar(dim, c);
    case 'commute': return `<span class="cell-val">${c.v.commute} 分</span><span class="cell-sub">${c.t.commuteNote}</span>` + miniBar(dim, c);
    case 'area':    return `<span class="cell-val">${c.v.area} ㎡</span>` + miniBar(dim, c);
    case 'noise':   return `<span class="cell-val">${c.v.noise} dB</span><span class="cell-sub">${c.t.noiseTag}</span>` + miniBar(dim, c);
    case 'age':     return `<span class="cell-val">${c.v.age} 年</span>` + miniBar(dim, c);
    default:        return `<span class="cell-val">${c.t[dim.id]}</span>`;
  }
}

function renderBody() {
  const tbody = $('#tbody');
  const scores = computeScores();
  const ranks = {};
  rankedIds(scores).forEach((id, i) => { ranks[id] = i + 1; });
  const rec = rankedIds(scores)[0];

  if (!CANDIDATES.length) { // 防御性空态（数据内联，正常不可达）
    tbody.innerHTML = '<tr><td colspan="5">暂无候选地点。</td></tr>';
    return;
  }

  let html = '<tr class="row-score"><th scope="row">加权总分<small>随偏好权重实时更新</small></th>';
  CANDIDATES.forEach(c => {
    html += `<td data-col="${c.id}">` +
      `<span class="score-num">${scores[c.id]}</span>` +
      `<span class="rank-chip${ranks[c.id] === 1 ? ' r1' : ''}" title="当前排名">第 ${ranks[c.id]}</span>` +
      (ranks[c.id] === 1 ? '<span class="pill-rec">推荐</span>' : '') +
      `<span class="score-bar" aria-hidden="true"><i style="width:${scores[c.id]}%;background:${c.color}"></i></span>` +
      `</td>`;
  });
  html += '</tr>';

  GROUPS.forEach(g => {
    html += `<tr class="g"><th colspan="5" scope="colgroup">${g.label}</th></tr>`;
    g.dims.forEach(dimId => {
      const dim = DIMS[dimId];
      html += `<tr><th scope="row">${dim.label}<small>${dim.unit || '定性评估'}</small></th>`;
      CANDIDATES.forEach(c => {
        const n = normFor(dim, c);
        const cls = (n === 100 ? 'best' : n === 0 ? 'worst' : '');
        html += `<td data-col="${c.id}"${cls ? ` class="${cls}"` : ''}>` +
          cellHTML(dim, c) +
          (n === 100 ? '<span class="tag-best">优</span>' : '') +
          `</td>`;
      });
      html += '</tr>';
    });
  });

  tbody.innerHTML = html;
  tbody.dataset.rec = rec;
}

/* ── 构建：权重滑杆与预设 ─────────────────────────────────── */

function buildWeights() {
  const wrap = $('#sliders');
  CATS.forEach(cat => {
    const g = document.createElement('span');
    g.className = 'wg';
    g.innerHTML =
      `<label for="w-${cat.id}">${cat.label}</label>` +
      `<input type="range" id="w-${cat.id}" min="0" max="5" step="1" value="${state.weights[cat.id]}" aria-label="${cat.label}权重（0 至 5）">` +
      `<output for="w-${cat.id}">×${state.weights[cat.id]}</output>`;
    wrap.appendChild(g);
  });
  wrap.addEventListener('input', e => {
    const inp = e.target.closest('input[type=range]');
    if (!inp) return;
    const catId = inp.id.slice(2);
    state.weights[catId] = Number(inp.value);
    inp.nextElementSibling.textContent = `×${inp.value}`;
    refreshScores();
  });

  const pre = $('#presets');
  Object.keys(PRESETS).forEach(name => {
    const b = document.createElement('button');
    b.className = 'btn-preset';
    b.textContent = name;
    b.dataset.preset = name;
    b.title = name === '均衡' ? '重置为均衡权重' : `应用预设：${name}`;
    pre.appendChild(b);
  });
  pre.addEventListener('click', e => {
    const b = e.target.closest('button[data-preset]');
    if (!b) return;
    state.weights = { ...PRESETS[b.dataset.preset] };
    CATS.forEach(cat => {
      const inp = $(`#w-${cat.id}`);
      inp.value = state.weights[cat.id];
      inp.nextElementSibling.textContent = `×${state.weights[cat.id]}`;
    });
    refreshScores();
  });
}

function refreshPresets() {
  document.querySelectorAll('.btn-preset').forEach(b => {
    const p = PRESETS[b.dataset.preset];
    b.classList.toggle('on', CATS.every(c => p[c.id] === state.weights[c.id]));
  });
}

/* ── 构建：地图图钉 / 通勤线路 / 图例 ─────────────────────── */

function svgEl(tag, attrs) {
  const n = document.createElementNS(SVGNS, tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  return n;
}

function buildMap() {
  const pins = $('#pins'), routes = $('#routes');
  CANDIDATES.forEach(c => {
    const r = ROUTES[c.id];
    const g = svgEl('g', { class: 'route-g', 'data-route': c.id });
    g.appendChild(svgEl('path', { class: 'route', d: r.d, stroke: c.color }));
    const t = svgEl('text', { class: 'route-min', x: r.lx, y: r.ly, fill: c.color, 'text-anchor': 'middle' });
    t.textContent = `${c.v.commute}分`;
    g.appendChild(t);
    routes.appendChild(g);

    const p = svgEl('g', {
      class: 'pin', 'data-pin': c.id, tabindex: '0', role: 'button',
      'aria-pressed': 'false', 'aria-label': `在地图上选定 ${c.name}`,
    });
    p.appendChild(svgEl('ellipse', { class: 'pin-shadow', cx: c.map.x, cy: c.map.y + 14, rx: 6, ry: 2.5 }));
    p.appendChild(svgEl('circle', { class: 'pin-ring', cx: c.map.x, cy: c.map.y, r: 15 }));
    p.appendChild(svgEl('circle', { class: 'pin-body', cx: c.map.x, cy: c.map.y, r: 11, fill: c.color }));
    const num = svgEl('text', { class: 'pin-num', x: c.map.x, y: c.map.y + 4 });
    num.textContent = c.id.slice(1);
    p.appendChild(num);
    const label = svgEl('text', { class: 'pin-label', x: c.map.x, y: c.map.y + 28 });
    label.textContent = c.name;
    p.appendChild(label);
    p.addEventListener('click', () => select(c.id));
    p.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(c.id); }
    });
    pins.appendChild(p);
  });

  const legend = $('#legend');
  legend.innerHTML =
    CANDIDATES.map(c => `<span class="lg"><i style="background:${c.color}"></i>${c.id.slice(1)} ${c.name}</span>`).join('') +
    `<span class="lg"><i class="lg-office"></i>公司 · 科苑大厦</span>` +
    `<span class="lg"><i class="lg-line"></i>地铁 7 号线</span>`;
}

/* ── 状态渲染：选中 / 落定 驻留同屏 ───────────────────────── */

function select(id) {
  state.selected = id;
  renderAll();
}

function renderStates() {
  const scores = computeScores();

  document.querySelectorAll('#cmp [data-col]').forEach(cell => {
    const id = cell.dataset.col;
    cell.classList.toggle('col-sel', state.selected === id && state.decided !== id);
    cell.classList.toggle('col-decided', state.decided === id);
  });
  document.querySelectorAll('#head-row .cand-head').forEach(th => {
    const id = th.dataset.col;
    th.classList.toggle('col-sel', state.selected === id && state.decided !== id);
    th.classList.toggle('col-decided', state.decided === id);
    const btn = th.querySelector('.btn-select');
    btn.setAttribute('aria-pressed', String(state.selected === id));
    btn.textContent = state.selected === id ? '已选定' : '选定';
    th.querySelector('.badge-decided').style.display = state.decided === id ? 'inline-block' : 'none';
    btn.style.display = state.decided === id ? 'none' : '';
  });
  document.querySelectorAll('.pin').forEach(p => {
    const id = p.dataset.pin;
    p.classList.toggle('sel', state.selected === id && state.decided !== id);
    p.classList.toggle('decided', state.decided === id);
    p.setAttribute('aria-pressed', String(state.selected === id || state.decided === id));
  });
  document.querySelectorAll('.route-g').forEach(g => {
    g.querySelector('.route').classList.toggle('hot', g.dataset.route === state.selected || g.dataset.route === state.decided);
    g.querySelector('.route-min').classList.toggle('hot', g.dataset.route === state.selected || g.dataset.route === state.decided);
  });

  /* 顶栏状态 */
  const hdr = $('#hdr-status');
  if (state.decided) {
    const c = byId(state.decided);
    hdr.innerHTML = `<span class="chip decided"><span class="dot" style="background:${c.color}"></span>已落定 · ${c.name}</span>`;
  } else {
    hdr.innerHTML = '<span class="chip">未落定 · 比较后选定候选</span>';
  }

  /* 底部落定面板（唯一常驻主操作） */
  const panel = $('#decide-panel');
  const rec = rankedIds(scores)[0];
  if (state.decided) {
    const c = byId(state.decided);
    panel.classList.add('decided');
    panel.innerHTML =
      `<div class="dp-info"><div class="dp-title">已落定 · 决策驻留同屏</div>` +
      `<div class="dp-main">${c.name} · ${scores[c.id]} 分</div>` +
      `<div class="dp-reason">${reasonFor(c, scores)}</div></div>` +
      `<button class="btn-primary" id="btn-redecide">重新比较</button>`;
    $('#btn-redecide').addEventListener('click', () => { state.decided = null; renderAll(); });
  } else if (state.selected) {
    const c = byId(state.selected);
    const isRec = state.selected === rec;
    panel.classList.remove('decided');
    panel.innerHTML =
      `<div class="dp-info"><div class="dp-title">已选定 · 待落定</div>` +
      `<div class="dp-main">${c.name} · ${scores[c.id]} 分${isRec ? ' · 当前推荐' : `（推荐：${byId(rec).name}）`}</div>` +
      `<div class="dp-reason">${reasonFor(c, scores)}</div></div>` +
      `<button class="btn-primary" id="btn-decide">落定：${c.name.split(' · ')[0]}</button>`;
    $('#btn-decide').addEventListener('click', () => { state.decided = state.selected; renderAll(); });
  } else {
    panel.classList.remove('decided');
    panel.innerHTML =
      `<div class="dp-info"><div class="dp-title">尚未选定</div>` +
      `<div class="dp-main">当前推荐：${byId(rec).name} · ${scores[rec]} 分</div>` +
      `<div class="dp-reason">点击列头「选定」或地图图钉，再一键落定</div></div>` +
      `<button class="btn-primary" id="btn-decide" disabled>落定</button>`;
  }
}

function renderAll() {
  renderBody();
  refreshPresets();
  renderStates();
}

function refreshScores() { /* 权重变化：无需重建表头/图钉 */
  renderBody();
  refreshPresets();
  renderStates();
}

/* ── 证据辅助：#select=c2&decide=c2 可复现状态截图（不影响正常流程） ── */

function applyUrlParams() {
  const raw = location.hash.startsWith('#') ? location.hash.slice(1) : location.search.slice(1);
  const q = new URLSearchParams(raw);
  const d = q.get('decide'), s = q.get('select');
  if (d && byId(d)) { state.decided = d; state.selected = d; }
  else if (s && byId(s)) { state.selected = s; }
}

/* ── 初始化（同步完成：加载即 ready） ─────────────────────── */

function init() {
  buildHead();
  buildWeights();
  buildMap();
  applyUrlParams();
  renderAll();
}

try {
  init();
} catch (err) {
  const f = $('#fatal');
  f.hidden = false;
  f.textContent = `初始化失败：${err && err.message ? err.message : err}`;
}
