/* data.js — 城市观测 2026 (CityPulse 2026)
   合成数据集：确定性种子生成，420 条记录 × 14 维度。
   全部内联，同步可用 —— 页面加载即 ready，无网络请求。 */
(function () {
  "use strict";

  // ── 确定性 PRNG（mulberry32）─────────────────────────────────────────
  function mulberry32(seed) {
    let a = seed | 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rnd = mulberry32(20260924);
  const rand = () => rnd();
  const between = (lo, hi) => lo + (hi - lo) * rnd();
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const gauss = () => {
    // Box–Muller（确定性种子）
    let u = 0, v = 0;
    while (u === 0) u = rnd();
    while (v === 0) v = rnd();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

  // ── 维度定义 ─────────────────────────────────────────────────────────
  const DIMS = [
    { id: "population",      name: "人口",       unit: "万",     type: "num", fmt: "int" },
    { id: "gdpPerCapita",    name: "人均GDP",    unit: "千美元", type: "num", fmt: "fix1" },
    { id: "area",            name: "面积",       unit: "km²",    type: "num", fmt: "int" },
    { id: "density",         name: "密度",       unit: "人/km²", type: "num", fmt: "int" },
    { id: "transitScore",    name: "公共交通",   unit: "分",     type: "num", fmt: "int" },
    { id: "greenSpace",      name: "绿地率",     unit: "%",      type: "num", fmt: "fix1" },
    { id: "airQuality",      name: "空气质量AQI", unit: "",      type: "num", fmt: "int", lowerBetter: true },
    { id: "costIndex",       name: "生活成本",   unit: "指数",   type: "num", fmt: "int" },
    { id: "startupActivity", name: "创业活跃度", unit: "分",     type: "num", fmt: "int" },
    { id: "safetyIndex",     name: "治安指数",   unit: "分",     type: "num", fmt: "int" },
    { id: "happiness",       name: "幸福指数",   unit: "分",     type: "num", fmt: "fix1" },
    { id: "region",          name: "大区",       unit: "",       type: "cat",
      values: ["亚太", "欧洲", "北美", "拉美", "中东非", "南亚"] },
    { id: "band",            name: "发展带",     unit: "",       type: "cat",
      values: ["成熟", "新兴", "边境"] },
    { id: "coastal",         name: "海陆属性",   unit: "",       type: "cat",
      values: ["沿海", "内陆", "岛屿"] },
  ];

  const REGION_MULT = { "北美": 1.5, "欧洲": 1.35, "亚太": 1.0, "拉美": 0.75, "南亚": 0.55, "中东非": 0.5 };
  const REGION_W    = { "亚太": 0.26, "欧洲": 0.2, "北美": 0.16, "拉美": 0.14, "中东非": 0.13, "南亚": 0.11 };
  const BAND_MULT   = { "成熟": 1.0, "新兴": 0.55, "边境": 0.3 };

  // ── 城市名生成（组合式，保证唯一）───────────────────────────────────
  const PRE = ["Ar","Bel","Cor","Dan","El","Far","Gal","Hal","Ily","Kar","Lor","Mar","Nor","Or","Pel","Quel","Ros","Sil","Tor","Ul","Ven","Wes","Xan","Yar","Zel","Bran","Cael","Drev","Eryn","Fenn"];
  const MID = ["a","e","i","o","u","au","ei","ora","ande","illi"];
  const SUF = ["mira","ndor","via","ton","burg","polis","grad","haven","ford","dale","port","field","crest","shore","vale","mont","wick","holm","gard","spur"];
  function makeNames(n) {
    const used = new Set();
    const names = [];
    let guard = 0;
    while (names.length < n && guard < n * 50) {
      guard++;
      const nm = pick(PRE) + pick(MID) + pick(SUF);
      if (!used.has(nm)) { used.add(nm); names.push(nm); }
    }
    while (names.length < n) names.push(pick(PRE) + pick(SUF) + " " + (names.length + 1));
    return names;
  }

  // ── 生成 420 条记录 ──────────────────────────────────────────────────
  const N = 420;
  const names = makeNames(N);
  const records = new Array(N);

  function weightedRegion() {
    let r = rnd(), acc = 0;
    for (const k of Object.keys(REGION_W)) { acc += REGION_W[k]; if (r <= acc) return k; }
    return "亚太";
  }

  for (let i = 0; i < N; i++) {
    const region = weightedRegion();
    const cr = rnd();
    const coastal = cr < 0.45 ? "沿海" : (cr < 0.85 ? "内陆" : "岛屿");
    const cb = rnd();
    const band = cb < 0.42 ? "成熟" : (cb < 0.82 ? "新兴" : "边境");

    const rm = REGION_MULT[region], bm = BAND_MULT[band];
    const pop = clamp(Math.exp(between(Math.log(30), Math.log(3400))) * between(0.55, 1.25), 28, 3400);

    const gdpBase = 4 + 120 * bm * rm * (0.55 + 0.45 * rnd());
    const gdpPerCapita = clamp(gdpBase * (1 + gauss() * 0.18), 1.8, 132);

    const area = clamp(Math.round(pop * between(1.6, 3.4) * (0.7 + rnd() * 0.9)), 40, 9800);
    const density = clamp(Math.round((pop * 10000) / area * between(0.75, 1.35)), 60, 26000);

    const transitScore = Math.round(clamp(18 + 46 * bm * (0.7 + 0.6 * rnd()) + Math.log(pop) * 3.4 + gauss() * 7, 12, 98));
    const greenSpace = clamp(4 + 30 * (1 - clamp(density / 16000, 0, 1)) * (0.6 + 0.8 * rnd()) + gauss() * 3, 1.2, 44);

    const airQuality = Math.round(clamp(38 + 70 * (1 - bm) * rm * (0.8 + 0.5 * rnd()) + gauss() * 14, 11, 178));
    const costIndex = Math.round(clamp(28 + 165 * (gdpPerCapita / 132) * (0.8 + 0.4 * rnd()) + gauss() * 8, 24, 215));
    const startupActivity = Math.round(clamp((gdpPerCapita / 132) * 74 + Math.log(pop) * 3.1 + (band === "成熟" ? 12 : 0) + gauss() * 8, 2, 99));
    const safetyIndex = Math.round(clamp(38 + 52 * (gdpPerCapita / 132) * (0.85 + 0.3 * rnd()) + gauss() * 7, 22, 99));
    const happiness = clamp(
      2.6 + 2.1 * (gdpPerCapita / 132) + 1.2 * (safetyIndex / 100) + 0.9 * (greenSpace / 44)
      - 0.8 * (airQuality / 178) + 0.5 * (transitScore / 100) + gauss() * 0.28, 3.0, 7.9);

    records[i] = {
      id: i,
      name: names[i],
      region, coastal, band,
      population: Math.round(pop),
      gdpPerCapita: +gdpPerCapita.toFixed(1),
      area, density,
      transitScore,
      greenSpace: +greenSpace.toFixed(1),
      airQuality, costIndex, startupActivity, safetyIndex,
      happiness: +happiness.toFixed(1),
    };
  }

  // ── 每个数值维度的 min/max（用于缩放）────────────────────────────────
  const stats = {};
  for (const d of DIMS) {
    if (d.type !== "num") continue;
    let mn = Infinity, mx = -Infinity;
    for (const r of records) { const v = r[d.id]; if (v < mn) mn = v; if (v > mx) mx = v; }
    stats[d.id] = { min: mn, max: mx };
  }

  window.APP_DATA = { dims: DIMS, records, stats, size: N };
})();
