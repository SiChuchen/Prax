/* =========================================================
 * cell-j01-s01 · 商品目录管理台 — 内联数据层
 * 确定性生成（固定种子），随首屏同步就绪，无网络请求。
 * ======================================================= */
(function () {
  'use strict';

  // mulberry32 — 固定种子 PRNG，保证每次打开数据完全一致
  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rnd = mulberry32(20260908);
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const int = (min, max) => min + Math.floor(rnd() * (max - min + 1));

  /* ---------- 层级定义：事业部 → 品类 ---------- */
  const DIVISIONS = [
    { id: 'dv-dg', code: 'DG', name: '数码事业部', manager: '沈亦舟' },
    { id: 'dv-jm', code: 'JM', name: '家居事业部', manager: '顾晚晴' },
    { id: 'dv-mz', code: 'MZ', name: '美妆事业部', manager: '阮清让' },
    { id: 'dv-sp', code: 'SP', name: '食品事业部', manager: '钟屿' },
  ];

  const CATEGORIES = [
    { id: 'cg-ph', div: 'dv-dg', code: 'PH', name: '手机通讯' },
    { id: 'cg-pc', div: 'dv-dg', code: 'PC', name: '电脑办公' },
    { id: 'cg-av', div: 'dv-dg', code: 'AV', name: '影音娱乐' },
    { id: 'cg-wt', div: 'dv-dg', code: 'WT', name: '智能穿戴' },
    { id: 'cg-kt', div: 'dv-jm', code: 'KT', name: '厨具茶具' },
    { id: 'cg-tx', div: 'dv-jm', code: 'TX', name: '家纺布艺' },
    { id: 'cg-sc', div: 'dv-jm', code: 'SC', name: '收纳清洁' },
    { id: 'cg-lt', div: 'dv-jm', code: 'LT', name: '灯具照明' },
    { id: 'cg-sk', div: 'dv-mz', code: 'SK', name: '护肤' },
    { id: 'cg-mk', div: 'dv-mz', code: 'MK', name: '彩妆' },
    { id: 'cg-fa', div: 'dv-mz', code: 'FA', name: '香水香氛' },
    { id: 'cg-sn', div: 'dv-sp', code: 'SN', name: '休闲零食' },
    { id: 'cg-gr', div: 'dv-sp', code: 'GR', name: '粮油调味' },
    { id: 'cg-tb', div: 'dv-sp', code: 'TB', name: '茶酒饮料' },
  ];

  /* ---------- 各品类的取名素材（品牌 × 品名 × 后缀） ---------- */
  const NAME_POOL = {
    'cg-ph': { b: ['星耀', '朗讯', '极目', '云雀'], n: ['旗舰手机', '轻薄手机', '电竞手机', '折叠屏手机'], s: ['Pro', 'Max', 'SE', '青春版'] },
    'cg-pc': { b: ['拓风', '白泽', '极光', '蓝鲸'], n: ['轻薄笔记本', '游戏本', '台式主机', '显示器', '机械键盘', '激光打印机'], s: ['', 'Air', '2025款', 'Pro'] },
    'cg-av': { b: ['声岚', '光年', '回声'], n: ['真无线耳机', '头戴式耳机', '蓝牙音箱', '智能电视', '回音壁'], s: ['', 'Plus', 'Mini'] },
    'cg-wt': { b: ['跃动', '星衡'], n: ['智能手表', '运动手环', '智能眼镜', '儿童电话手表'], s: ['', '2', 'S'] },
    'cg-kt': { b: ['陶然', '素白', '山语'], n: ['不粘锅具套装', '铸铁炒锅', '陶瓷餐具套装', '玻璃茶壶', '保温杯'], s: ['', '套装', '24cm', '经典款'] },
    'cg-tx': { b: ['眠云', '棉花堡'], n: ['全棉四件套', '羽绒被', '乳胶枕', '遮光窗帘', '法兰绒毛毯'], s: ['', 'A类', '加厚款'] },
    'cg-sc': { b: ['净界', '拾光', '屿鹿'], n: ['真空收纳袋', '桌面置物架', '免手洗拖把', '除螨仪', '感应垃圾桶'], s: ['', '加大款', 'Pro'] },
    'cg-lt': { b: ['月白', '拾光'], n: ['吸顶灯', '落地灯', '智能灯泡', '护眼台灯'], s: ['', '北欧款', '哑光版'] },
    'cg-sk': { b: ['澈研', '润栖'], n: ['保湿面霜', '修护精华液', '防晒乳', '补水面膜礼盒', '氨基酸洁面乳'], s: ['', '轻盈版', '升级款'] },
    'cg-mk': { b: ['绯屿', '慕色'], n: ['哑光口红', '持妆粉底液', '九色眼影盘', '温和卸妆水', '极细眉笔'], s: ['', '02号色', '限定色'] },
    'cg-fa': { b: ['雾屿', '森野'], n: ['中性淡香水', '家居香薰蜡烛', '无火藤条香氛'], s: ['', '50ml', '雪松调'] },
    'cg-sn': { b: ['山谷仓', '果集'], n: ['每日坚果', '炭烤猪肉脯', '手工鸡蛋卷', '冻干草莓脆', '夹心海苔'], s: ['', '分享装', '30袋装'] },
    'cg-gr': { b: ['金穗', '田园牧'], n: ['有机大米', '山茶油', '零添加生抽', '二八麻酱'], s: ['', '5kg装', '家庭装'] },
    'cg-tb': { b: ['茗川', '醒山'], n: ['明前龙井', '冷萃咖啡液', '桂花乌龙', '无糖气泡水'], s: ['', '礼盒装', '12支装'] },
  };

  const PRICE_RANGE = {
    'cg-ph': [899, 8999], 'cg-pc': [199, 12999], 'cg-av': [129, 7999], 'cg-wt': [149, 2599],
    'cg-kt': [39, 899], 'cg-tx': [59, 1299], 'cg-sc': [19, 499], 'cg-lt': [29, 899],
    'cg-sk': [69, 699], 'cg-mk': [49, 399], 'cg-fa': [89, 899],
    'cg-sn': [9, 129], 'cg-gr': [15, 199], 'cg-tb': [19, 399],
  };

  const OWNERS = ['林晚棠', '程一帆', '苏见川', '魏南絮', '江叙白', '韩沐阳', '祁思远', '丁乐瑶'];
  const SUPPLIERS = ['杭州云仓供应链', '深圳前海严选', '广州信诚贸易', '苏州锦澜实业', '宁波致远工贸',
    '福建山海优品', '青岛汇丰源', '成都锦官优选', '武汉江城集采', '厦门鹭洲供应链'];
  const TAGS = ['主推款', '促销中', '新品', '缺货预警', '长尾款'];

  // 状态分布（确定性加权）：在售 46% · 已下架 24% · 草稿 18% · 待审核 12%
  const STATUS_POOL = ['online', 'offline', 'draft', 'review'];
  function rollStatus() {
    const r = rnd();
    if (r < 0.46) return 'online';
    if (r < 0.70) return 'offline';
    if (r < 0.88) return 'draft';
    return 'review';
  }

  const STATUS_META = {
    online: { label: '在售', cls: 'st-online' },
    offline: { label: '已下架', cls: 'st-offline' },
    draft: { label: '草稿', cls: 'st-draft' },
    review: { label: '待审核', cls: 'st-review' },
  };

  /* ---------- 生成商品 ---------- */
  // 时间锚点固定为 2026-09-08（基准冻结日），保证快照确定性
  const ANCHOR = new Date(2026, 8, 8).getTime();
  const DAY = 24 * 60 * 60 * 1000;
  const seenNames = new Set();

  const products = [];
  CATEGORIES.forEach((cat) => {
    const pool = NAME_POOL[cat.id];
    const div = DIVISIONS.find((d) => d.id === cat.div);
    const count = int(9, 12);
    const [pMin, pMax] = PRICE_RANGE[cat.id];
    for (let i = 1; i <= count; i++) {
      let name = `${pool.b[int(0, pool.b.length - 1)]} ${pool.n[int(0, pool.n.length - 1)]}`;
      const suffix = pick(pool.s);
      if (suffix) name += ` ${suffix}`;
      if (seenNames.has(name)) name += ` ${pick(['二代', '尊享版', '2026款'])}`;
      seenNames.add(name);

      const status = rollStatus();
      const stock = rnd() < 0.08 ? 0 : int(0, 2400);
      const tagList = [];
      if (rnd() < 0.22) tagList.push('主推款');
      if (rnd() < 0.3) tagList.push('促销中');
      if (rnd() < 0.15) tagList.push('新品');
      if (stock === 0 && rnd() < 0.8) tagList.push('缺货预警');
      if (rnd() < 0.12) tagList.push('长尾款');

      products.push({
        id: `SKU-${div.code}-${cat.code}-${String(i).padStart(3, '0')}`,
        name,
        divisionId: cat.div,
        categoryId: cat.id,
        status,
        price: Math.round((pMin + rnd() * (pMax - pMin)) / 1) - 0.01 + 1,
        stock,
        owner: pick(OWNERS),
        supplier: pick(SUPPLIERS),
        tags: tagList,
        updatedAt: new Date(ANCHOR - int(0, 120) * DAY).toISOString().slice(0, 10),
      });
    }
  });

  // 价格修正为两位小数结尾 .99/.90 风格
  products.forEach((p) => { p.price = Math.max(1, Math.round(p.price)); });

  window.CATALOG = {
    generatedAt: '2026-09-08',
    statusMeta: STATUS_META,
    divisions: DIVISIONS,
    categories: CATEGORIES,
    products,
  };
})();
