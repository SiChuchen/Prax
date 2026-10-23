/* TreeLedger — 确定性种子数据：区域 → 系统 → 设备 三级层级，随首屏同步就绪 */
(function () {
  const SPEC = [
    { name: '华东数据中心', code: 'EC', systems: [
      ['供配电系统', 'PWR', [['UPS 主机', 'UPS', 6], ['高压配电柜', 'HV', 4], ['蓄电池组', 'BAT', 5]]],
      ['冷却系统', 'CLG', [['精密空调', 'CRAC', 8], ['冷却塔', 'CT', 3], ['循环水泵', 'PUMP', 4]]],
      ['网络核心', 'NET', [['核心交换机', 'CORE', 4], ['汇聚交换机', 'AGG', 6], ['防火墙', 'FW', 2]]],
      ['安防监控', 'SEC', [['摄像头', 'CAM', 10], ['门禁控制器', 'AC', 3]]],
    ]},
    { name: '华北数据中心', code: 'NC', systems: [
      ['供配电系统', 'PWR', [['UPS 主机', 'UPS', 4], ['柴油发电机', 'GEN', 2], ['蓄电池组', 'BAT', 4]]],
      ['冷却系统', 'CLG', [['精密空调', 'CRAC', 6], ['新风机组', 'FAU', 2]]],
      ['计算集群', 'CMP', [['机柜节点', 'NODE', 12], ['存储阵列', 'STO', 3]]],
    ]},
    { name: '华南制造基地', code: 'SC', systems: [
      ['SMT 产线', 'SMT', [['贴片机', 'PLACER', 6], ['回流焊炉', 'OVEN', 3], ['AOI 检测仪', 'AOI', 3]]],
      ['组装产线', 'ASM', [['自动锁螺丝机', 'SCREW', 4], ['老化架', 'BURN', 8]]],
      ['质检工位', 'QC', [['影像测量仪', 'VMM', 2], ['盐雾试验箱', 'SALT', 1], ['恒温箱', 'TCC', 3]]],
    ]},
    { name: '上海研发中心', code: 'RD', systems: [
      ['实验设备', 'LAB', [['频谱分析仪', 'SA', 2], ['示波器', 'SCOPE', 4], ['电源负载架', 'LOAD', 3]]],
      ['办公终端', 'OFF', [['工作站', 'WS', 8], ['打印一体机', 'MFP', 3]]],
    ]},
  ];

  // mulberry32：可复现伪随机（同一份数据，每次加载一致）
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const STATUSES = ['running', 'maintenance', 'stopped', 'scrapping'];
  const WEIGHTS = [0.68, 0.14, 0.10, 0.08];

  window.SEED = (function build() {
    const rand = mulberry32(20260919);
    const nodes = [];
    let seq = 0;
    const nid = () => 'n' + (++seq);

    function pickStatus() {
      const r = rand();
      let acc = 0;
      for (let i = 0; i < STATUSES.length; i++) {
        acc += WEIGHTS[i];
        if (r < acc) return STATUSES[i];
      }
      return 'running';
    }

    SPEC.forEach((r) => {
      const regionId = nid();
      nodes.push({ id: regionId, type: 'region', name: r.name, code: r.code, parentId: null });
      r.systems.forEach(([sName, sCode, groups]) => {
        const sysId = nid();
        nodes.push({ id: sysId, type: 'system', name: sName, code: r.code + '-' + sCode, parentId: regionId });
        groups.forEach(([dName, dCode, count]) => {
          for (let i = 1; i <= count; i++) {
            const num = String(i).padStart(3, '0');
            nodes.push({
              id: nid(),
              type: 'device',
              name: dName + ' ' + num,
              code: r.code + '-' + sCode + '-' + dCode + '-' + num,
              parentId: sysId,
              status: pickStatus(),
            });
          }
        });
      });
    });

    return { nodes };
  })();
})();
