/* ============================================================
 * GeoScope · 城市观测集 — 合成演示数据
 * 确定性种子生成，同步执行：脚本随首屏解析即完成，无加载态。
 * 暴露：window.GEO_DATA = { seed, records, dims, regenerate(seed) }
 * ============================================================ */
(function () {
  'use strict';

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const CONTINENTS = ['亚洲', '欧洲', '非洲', '北美洲', '南美洲', '大洋洲'];
  const CONT_W = [31, 22, 17, 17, 11, 6];

  const REGIONS = {
    '亚洲':   ['东亚', '东南亚', '南亚', '中亚', '西亚'],
    '欧洲':   ['北欧', '西欧', '南欧', '东欧'],
    '非洲':   ['北非', '西非', '东非', '中非', '南部非洲'],
    '北美洲': ['美加地区', '墨西哥与中美', '加勒比'],
    '南美洲': ['安第斯地区', '南美北部', '南锥体'],
    '大洋洲': ['澳大利亚', '新西兰与波利尼西亚', '美拉尼西亚'],
  };

  // 气候带（顺序即下述权重向量的顺序）
  const CLIMATES = ['热带雨林', '热带草原', '干旱半干旱', '地中海式', '温带海洋性', '温带大陆性', '高原山地'];

  // 分区 → 气候权重（与 CLIMATES 对齐）
  const REGION_CLIM = {
    '东亚':   [2, 1, 2, 1, 4, 6, 2],
    '东南亚': [8, 4, 0, 0, 1, 0, 0],
    '南亚':   [5, 5, 2, 1, 1, 1, 1],
    '中亚':   [0, 1, 7, 0, 1, 4, 2],
    '西亚':   [1, 2, 8, 1, 0, 1, 0],
    '北欧':   [0, 0, 0, 0, 6, 2, 3],
    '西欧':   [0, 0, 0, 3, 7, 2, 0],
    '南欧':   [0, 0, 1, 6, 4, 1, 1],
    '东欧':   [0, 0, 1, 0, 3, 6, 2],
    '北非':   [0, 2, 8, 1, 0, 0, 0],
    '西非':   [4, 7, 1, 0, 0, 0, 0],
    '东非':   [2, 5, 3, 1, 1, 0, 2],
    '中非':   [8, 3, 0, 0, 0, 0, 0],
    '南部非洲': [1, 5, 3, 1, 1, 0, 1],
    '美加地区': [0, 0, 1, 0, 4, 5, 2],
    '墨西哥与中美': [4, 5, 2, 1, 0, 0, 1],
    '加勒比': [8, 3, 0, 0, 0, 0, 0],
    '安第斯地区': [2, 2, 1, 0, 1, 1, 5],
    '南美北部': [8, 3, 0, 0, 0, 0, 0],
    '南锥体': [1, 2, 2, 1, 3, 3, 0],
    '澳大利亚': [1, 4, 7, 1, 1, 0, 0],
    '新西兰与波利尼西亚': [5, 2, 0, 1, 5, 0, 0],
    '美拉尼西亚': [8, 3, 0, 0, 0, 0, 0],
  };

  // 气候 → [基准气温°C, 基准降水mm]
  const CLIM_BASE = {
    '热带雨林':  [26.5, 2250],
    '热带草原':  [25.0, 950],
    '干旱半干旱': [18.0, 210],
    '地中海式':  [17.0, 520],
    '温带海洋性': [11.5, 880],
    '温带大陆性': [7.5, 520],
    '高原山地':  [9.0, 640],
  };

  const GDP_BASE = { '亚洲': 17, '欧洲': 33, '非洲': 6.5, '北美洲': 31, '南美洲': 13, '大洋洲': 32 };
  const GDP_CLIM = { '温带海洋性': 1.12, '地中海式': 1.08, '热带雨林': 0.86, '干旱半干旱': 0.92 };

  const TIERS = ['巨型城市', '特大城市', '大城市', '中等城市', '小城市'];

  const SYL = ['圣', '布兰', '卡', '波', '格', '马', '阿', '维', '罗', '巴', '蒙', '纽', '拉', '帕', '奥', '坦', '贝', '托', '兰', '塞'];
  const TAIL = ['堡', '顿', '维尔', '斯克', '尼亚', '利亚', '哥', '诺', '港', '湾', '城', '原', '川', '洲', '菲', '登', '铎', '姆'];

  const DIMS = [
    { id: 'continent', name: '大洲',        type: 'cat',  color: '#5aa2f0' },
    { id: 'region',    name: '分区',        type: 'cat',  color: '#8f7bf2' },
    { id: 'climate',   name: '气候带',      type: 'cat',  color: '#e070b8' },
    { id: 'coastal',   name: '沿海属性',    type: 'cat',  color: '#4fc3a1' },
    { id: 'tier',      name: '规模档',      type: 'ord',  color: '#e0a35a' },
    { id: 'population', name: '人口',       type: 'num',  unit: '万',   color: '#e0d25a' },
    { id: 'gdp_pc',    name: '人均GDP',     type: 'num',  unit: '美元', color: '#7bd0f0' },
    { id: 'aqi',       name: '空气质量指数', type: 'num',  unit: '',     color: '#f0655a' },
    { id: 'temp',      name: '年均气温',    type: 'num',  unit: '°C',   color: '#ffab70' },
    { id: 'rain',      name: '年降水',      type: 'num',  unit: 'mm',   color: '#6be0c8' },
    { id: 'happy',     name: '幸福指数',    type: 'num',  unit: '/10',  color: '#9ed05a' },
    { id: 'elev',      name: '海拔',        type: 'num',  unit: 'm',    color: '#c07bf2' },
    { id: 'founded',   name: '建城年份',    type: 'num',  unit: '年',   color: '#9ab0c8' },
    { id: 'name',      name: '名称',        type: 'highcat', color: '#8fa3bd' },
  ];

  function weightedPick(R, items, weights) {
    let sum = 0;
    for (let i = 0; i < weights.length; i++) sum += weights[i];
    let x = R() * sum;
    for (let i = 0; i < items.length; i++) { x -= weights[i]; if (x <= 0) return items[i]; }
    return items[items.length - 1];
  }

  function makeDataset(seed) {
    const R = mulberry32(seed);
    const records = [];
    const used = Object.create(null);

    for (let i = 0; i < 540; i++) {
      // 唯一合成城市名
      let name;
      for (;;) {
        name = SYL[(R() * SYL.length) | 0] + (R() < 0.28 ? SYL[(R() * SYL.length) | 0] : '') + TAIL[(R() * TAIL.length) | 0];
        if (!used[name]) { used[name] = 1; break; }
      }

      const continent = weightedPick(R, CONTINENTS, CONT_W);
      const regs = REGIONS[continent];
      const region = regs[(R() * regs.length) | 0];
      const climate = weightedPick(R, CLIMATES, REGION_CLIM[region]);
      const cb = CLIM_BASE[climate];
      const coastal = R() < 0.46;

      const elev = Math.round(Math.pow(R(), 2.4) * 1800 + (climate === '高原山地' ? 900 + R() * 1600 : 15 + R() * 160));
      const temp = +(cb[0] + (R() * 7 - 3.5) - elev * 0.0042).toFixed(1);
      const rain = Math.round(cb[1] * (0.55 + R() * 0.9) * (coastal ? 1.25 : 1));

      const pop = Math.round(Math.exp(3.0 + ((R() + R()) / 2) * 3.7) * (R() < 0.03 ? 3.2 : 1));
      const tier = pop >= 1000 ? TIERS[0] : pop >= 300 ? TIERS[1] : pop >= 100 ? TIERS[2] : pop >= 30 ? TIERS[3] : TIERS[4];

      const gdp = Math.round(GDP_BASE[continent] * (0.55 + R() * 0.95) * (coastal ? 1.18 : 1) * (GDP_CLIM[climate] || 1) * 1000);
      const aqi = Math.round(Math.min(185, Math.max(8, 18 + pop / 26 + (climate === '干旱半干旱' ? 26 : 0) + R() * 42 - (rain > 1600 ? 10 : 0))));
      const happy = +Math.min(9.3, Math.max(2.2, 2.35 + gdp / 9000 * 2.1 - aqi / 95 + R() * 1.7)).toFixed(1);
      let founded = Math.round(820 + Math.pow(R(), 1.55) * 1130);
      if (founded > 2008) founded = 2008;

      records.push({
        id: 'C' + String(i + 1).padStart(3, '0'),
        name, continent, region, climate,
        coastal: coastal ? '沿海' : '内陆',
        tier,
        population: pop, gdp_pc: gdp, aqi, temp, rain, happy, elev, founded,
      });
    }

    // 每维统计：数值维 min/max（供直方图、范围输入、详情条）；类别维取值清单
    const dims = DIMS.map(d => {
      const dd = Object.assign({}, d);
      if (dd.type === 'num') {
        let min = Infinity, max = -Infinity;
        for (const r of records) { if (r[dd.id] < min) min = r[dd.id]; if (r[dd.id] > max) max = r[dd.id]; }
        dd.stats = { min, max };
      } else if (dd.type === 'highcat') {
        dd.values = records.map(r => r.name);
      } else {
        dd.values =
          dd.id === 'continent' ? CONTINENTS :
          dd.id === 'region' ? Object.keys(REGIONS).reduce((a, k) => a.concat(REGIONS[k]), []) :
          dd.id === 'climate' ? CLIMATES :
          dd.id === 'coastal' ? ['沿海', '内陆'] :
          TIERS;
      }
      return dd;
    });

    return { seed, records, dims };
  }

  window.GEO_DATA = makeDataset(20260903);
  window.GEO_DATA.regenerate = makeDataset;
})();
