/* =====================================================================
 * 实体台账管理台 — 种子数据（内联首屏数据，无网络请求）
 * data.js · 经典脚本（file:// 可直接打开）
 * 确定性伪随机（mulberry32 固定种子），保证每次加载截图/验证一致。
 * ===================================================================== */
(function () {
  "use strict";

  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rng = mulberry32(20260916);

  const groups = [];
  const entities = [];

  function unit(id, name, prefix, base, count) {
    return { id: id, name: name, prefix: prefix, base: base, count: count };
  }

  var SITE_CODE = { "site-hq": "HQ", "site-bj": "BJ", "site-gz": "GZ" };
  var SITE_NUM  = { "site-hq": 1, "site-bj": 2, "site-gz": 3 };

  var SITES = [
    {
      id: "site-hq", name: "华东·上海园区", systems: [
        { id: "sys-hq-env", name: "动环监控系统", units: [
          unit("sg-hq-env-temp", "温度监测", "TH", "温度传感器", 12),
          unit("sg-hq-env-hum",  "湿度监测", "HS", "湿度传感器", 10),
          unit("sg-hq-env-leak", "漏水检测", "LK", "漏水检测绳", 8)
        ]},
        { id: "sys-hq-acc", name: "安防门禁系统", units: [
          unit("sg-hq-acc-door", "门禁读卡", "AC", "门禁读卡器", 10),
          unit("sg-hq-acc-cam",  "监控摄像", "CM", "网络摄像头", 12)
        ]},
        { id: "sys-hq-ene", name: "能耗计量系统", units: [
          unit("sg-hq-ene-pwr", "电力计量", "PM", "电力计量表", 12),
          unit("sg-hq-ene-wtr", "水务计量", "WM", "智能水表", 6)
        ]}
      ]
    },
    {
      id: "site-bj", name: "华北·北京数据中心", systems: [
        { id: "sys-bj-cac", name: "精密空调", units: [
          unit("sg-bj-cac-crac",  "机房空调", "CR", "精密空调 CRAC", 8),
          unit("sg-bj-cac-fresh", "新风机组", "FA", "新风机组", 5)
        ]},
        { id: "sys-bj-ups", name: "UPS 供电", units: [
          unit("sg-bj-ups-batt", "电池组",   "BT", "蓄电池组", 8),
          unit("sg-bj-ups-pdu",  "配电单元", "PD", "机柜 PDU", 10),
          unit("sg-bj-ups-inv",  "逆变输出", "IV", "UPS 逆变器", 6)
        ]},
        { id: "sys-bj-fir", name: "消防联动", units: [
          unit("sg-bj-fir-smoke", "烟感探测", "SD", "烟感探测器", 14),
          unit("sg-bj-fir-rel",   "气体释放", "RV", "气体释放阀", 4)
        ]}
      ]
    },
    {
      id: "site-gz", name: "华南·广州园区", systems: [
        { id: "sys-gz-lit", name: "智能照明", units: [
          unit("sg-gz-lit-out", "室外照明", "LT", "室外照明回路", 8),
          unit("sg-gz-lit-in",  "室内照明", "LN", "室内照明回路", 8)
        ]},
        { id: "sys-gz-ele", name: "电梯监控", units: [
          unit("sg-gz-ele-pax", "客运电梯", "EL", "客运电梯", 6),
          unit("sg-gz-ele-cgo", "货运电梯", "EG", "重载货梯", 4)
        ]},
        { id: "sys-gz-plb", name: "给排水", units: [
          unit("sg-gz-plb-pump", "加压泵组", "PB", "加压水泵", 6),
          unit("sg-gz-plb-drn",  "集水井",   "SW", "潜水排污泵", 7)
        ]}
      ]
    }
  ];

  function pickStatus() {
    var r = rng();
    if (r < 0.70) return "online";
    if (r < 0.86) return "maintenance";
    return "retired";
  }

  var seq = 0;
  SITES.forEach(function (site) {
    groups.push({ id: site.id, parentId: null, name: site.name, type: "site" });
    site.systems.forEach(function (sys) {
      groups.push({ id: sys.id, parentId: site.id, name: sys.name, type: "system" });
      sys.units.forEach(function (u) {
        groups.push({ id: u.id, parentId: sys.id, name: u.name, type: "unit" });
        for (var i = 0; i < u.count; i++) {
          seq += 1;
          var zone = ["A", "B", "C"][i % 3];
          var nn = String(i + 1).padStart(2, "0");
          entities.push({
            id: "E" + String(seq).padStart(3, "0"),
            name: u.base + " " + SITE_CODE[site.id] + "-" + zone + nn,
            code: u.prefix + "-" + SITE_NUM[site.id] + String(seq).padStart(3, "0"),
            status: pickStatus(),
            groupId: u.id
          });
        }
      });
    });
  });

  window.REGISTRY_DATA = { groups: groups, entities: entities };
})();
