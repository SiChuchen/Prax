// seed.js — 设备资产种子数据（确定性、同步构建）
// 在页面解析期同步执行：window.SEED 在任何渲染之前就绪（首屏即用，零网络请求）。
// 数据 = 设备台账表（中心 → 科室 → [设备名, 型号, 数量]）+ 确定性状态序列。
(function () {
  "use strict";

  var STATUSES = ["active", "repair", "stock", "suspended", "scrap"];

  // 确定性状态序列（28 项：在用 15 · 维修中 4 · 库存 4 · 停用 3 · 待报废 2）
  var STATUS_PATTERN = [
    "active", "active", "repair", "active", "stock", "active", "suspended",
    "active", "stock", "active", "repair", "active", "scrap", "active",
    "suspended", "active", "stock", "repair", "active", "active", "scrap",
    "active", "suspended", "stock", "active", "repair", "active", "active",
  ];

  // 组织层级：中心 → 科室（叶子节点挂实体）
  var CENTERS = [
    {
      id: "c01", name: "医学检验中心",
      depts: [
        { id: "d0101", name: "生化免疫科", devices: [
          ["全自动生化分析仪", "AU5800", 4], ["化学发光免疫分析仪", "UniCell Dxl 800", 3],
          ["电解质分析仪", "EasyLyte", 3], ["血气分析仪", "ABL90", 3],
          ["全自动酶免分析仪", "FAME", 2], ["糖化血红蛋白分析仪", "HLC-723", 2]
        ] },
        { id: "d0102", name: "微生物科", devices: [
          ["全自动血培养仪", "BacT/ALERT", 3], ["微生物质谱鉴定仪", "VITEK MS", 2],
          ["自动药敏分析仪", "VITEK 2", 2], ["恒温培养箱", "Thermo 391", 4],
          ["生物安全柜", "BSC-1100", 3], ["全自动染色机", "Previ Color", 1]
        ] },
        { id: "d0103", name: "血液细胞科", devices: [
          ["全自动血液细胞分析仪", "XN-9000", 3], ["全自动凝血分析仪", "CS-5100", 2],
          ["尿液沉渣分析仪", "UF-5000", 2], ["流式细胞仪", "Navios", 2],
          ["全自动血型仪", "Galileo", 2]
        ] },
        { id: "d0104", name: "分子诊断科", devices: [
          ["实时荧光定量PCR仪", "QuantStudio 7", 3], ["基因测序仪", "NextSeq 550", 1],
          ["核酸提取仪", "MagMAX", 3], ["恒温扩增分析仪", "Genie II", 2],
          ["生物芯片扫描仪", "LuxScan 10K", 1]
        ] }
      ]
    },
    {
      id: "c02", name: "医学影像中心",
      depts: [
        { id: "d0201", name: "放射诊断科", devices: [
          ["64排螺旋CT", "Revolution", 2], ["1.5T磁共振成像仪", "Signa Pioneer", 2],
          ["数字X光摄影系统", "DR Definium", 3], ["乳腺钼靶机", "Pristina", 1],
          ["移动DR", "AMX Navigate", 3], ["消化道造影机", "Definium 8000", 1]
        ] },
        { id: "d0202", name: "超声科", devices: [
          ["彩色多普勒超声诊断仪", "EPIQ 7", 5], ["便携式超声诊断仪", "CX50", 3],
          ["经食道超声探头主机", "IE33", 1], ["超声经颅多普勒仪", "Doppler Box", 2]
        ] },
        { id: "d0203", name: "核医学科", devices: [
          ["SPECT/CT", "Symbia", 1], ["正电子发射断层扫描仪", "PET/CT Discovery", 1],
          ["甲状腺功能测定仪", "FH-458", 2], ["骨密度检测仪", "Lunar iDXA", 1],
          ["核素分装仪", "MED-System", 1]
        ] }
      ]
    },
    {
      id: "c03", name: "手术麻醉中心",
      depts: [
        { id: "d0301", name: "手术设备科", devices: [
          ["腹腔镜手术系统", "EndoAlpha", 3], ["电外科工作站", "ForceTriad", 4],
          ["超声切割止血刀", "Harmonic", 4], ["手术显微镜", "M720 OH", 2],
          ["C型臂X光机", "OEC 3D", 2], ["动力系统", "TwinPower", 3]
        ] },
        { id: "d0302", name: "麻醉设备科", devices: [
          ["麻醉机", "Aisys CS2", 5], ["麻醉气体监护仪", "CAPIOX", 2],
          ["可视喉镜", "C-MAC", 4], ["自体血回输机", "Cell Saver 5", 2],
          ["肌松监测仪", "TOF-Watch", 3]
        ] },
        { id: "d0303", name: "消毒供应科", devices: [
          ["全自动清洗消毒器", "Tiva 10", 3], ["环氧乙烷灭菌器", "3M Steri-Vac", 1],
          ["过氧化氢低温等离子灭菌机", "STERRAD NX", 2], ["脉动真空蒸汽灭菌器", "SQ-Z", 3],
          ["医用干燥柜", "YG-800", 3]
        ] }
      ]
    },
    {
      id: "c04", name: "生命支持中心",
      depts: [
        { id: "d0401", name: "重症监护科", devices: [
          ["有创呼吸机", "Servo-u", 5], ["多参数监护仪", "IntelliVue MX750", 8],
          ["连续性血液净化机", "PrisMax", 3], ["体外膜肺氧合系统", "ECLS", 1],
          ["输液泵", "Syramed", 10], ["临时起搏器", "Reprise", 2]
        ] },
        { id: "d0402", name: "急诊科", devices: [
          ["除颤监护仪", "Lifepak 20", 4], ["心电图机", "MAC 2000", 3],
          ["洗胃机", "DXW-A", 2], ["转运呼吸机", "TransPirator", 2],
          ["注射泵", "Perfusor Space", 8]
        ] },
        { id: "d0403", name: "呼吸治疗科", devices: [
          ["无创呼吸机", "Astral 150", 4], ["高流量湿化氧疗仪", "Airvo 2", 5],
          ["肺功能检查仪", "MasterScreen", 2], ["雾化泵", "PARI", 6],
          ["睡眠监测仪", "Somnoscreen", 3]
        ] }
      ]
    }
  ];

  var tree = CENTERS.map(function (c) {
    return {
      id: c.id, name: c.name,
      children: c.depts.map(function (d) { return { id: d.id, name: d.name }; })
    };
  });

  var entities = [];
  var seq = 0;
  var p = 0;
  CENTERS.forEach(function (center) {
    center.depts.forEach(function (dept) {
      dept.devices.forEach(function (dev) {
        var name = dev[0], model = dev[1], count = dev[2];
        for (var k = 1; k <= count; k++) {
          seq += 1;
          entities.push({
            id: "AST-" + (2400 + seq),
            name: count > 1 ? name + " " + (k < 10 ? "0" + k : k) + "号" : name,
            model: model,
            status: STATUS_PATTERN[p % STATUS_PATTERN.length],
            deptId: dept.id
          });
          p += 1;
        }
      });
    });
  });

  window.SEED = { statuses: STATUSES, tree: tree, entities: entities };
})();
