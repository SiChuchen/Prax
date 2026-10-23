/* 发布指挥台 · 内联数据：orders-api v2.4.0 生产发布运行手册
 * 全部数据随首屏内联，无任何网络请求。 */
window.FLOW = {
  meta: {
    product: "orders-api",
    version: "v2.4.0",
    runbook: "RLB-2.4",
    change: "CHG-20260919-042",
  },
  phases: [
    { id: "p0", name: "预检准备", intent: "窗口、产物、授权逐项确认" },
    { id: "p1", name: "备份快照", intent: "为所有恢复路径兜底" },
    { id: "p2", name: "灰度发布", intent: "10% 流量验证新版本" },
    { id: "p3", name: "数据迁移", intent: "不可逆 schema 变更" },
    { id: "p4", name: "全量切换", intent: "不可逆流量切换" },
    { id: "p5", name: "收尾归档", intent: "关闭变更、留存报告" },
  ],
  steps: [
    {
      id: "p0-1", phase: "p0", kind: "check",
      title: "核对变更单与发布窗口",
      desc: "逐项确认以下信息与变更单 CHG-20260919-042 一致。任何一项不符都应立即停止发布并上报。",
      est: "2 分钟",
      checks: [
        "变更单已审批：审批人林晓，窗口 02:00–04:00",
        "发布指挥人与今日值班表一致（指挥人：S. Chen）",
      ],
    },
    {
      id: "p0-2", phase: "p0", kind: "action",
      title: "核对构建产物",
      desc: "确认待发布镜像指纹与制品库一致，防止误发未经审核的构建。",
      est: "3 分钟",
      actions: [
        { label: "比对镜像 sha256 前 8 位 = a1b2c3d4", result: "指纹一致：a1b2c3d4" },
        { label: "确认 tag v2.4.0 已同步至生产制品库", result: "制品库已存在 v2.4.0" },
      ],
    },
    {
      id: "p0-3", phase: "p0", kind: "check",
      title: "确认值班与回滚授权",
      desc: "高后果操作前，确认异常时有人可呼、有人有权拍板回滚。",
      est: "2 分钟",
      checks: [
        "值班响应人王磊在线且已知会本次发布",
        "回滚授权人（值班经理）已确认授权",
      ],
    },
    {
      id: "p1-1", phase: "p1", kind: "action",
      title: "创建数据库快照",
      desc: "对 orders-db 主库做全量快照。它是本流程所有恢复路径的最后兜底，务必先行完成。",
      est: "6 分钟",
      actions: [
        { label: "对 orders-db 主库创建全量快照", result: "快照 snap-0919-a1b2 已就绪" },
      ],
    },
    {
      id: "p1-2", phase: "p1", kind: "action",
      title: "验证快照可恢复性",
      desc: "未经恢复验证的快照等于没有快照。",
      est: "4 分钟",
      actions: [
        { label: "抽样恢复至临时实例并比对行数校验和", result: "校验通过：行数偏差 0" },
      ],
    },
    {
      id: "p1-3", phase: "p1", kind: "action",
      title: "导出配置基线",
      desc: "留存当前生产配置，供回滚后快速比对差异。",
      est: "2 分钟",
      actions: [
        { label: "导出生产配置并存档至变更单附件", result: "config-baseline-0919.json 已存档" },
      ],
    },
    {
      id: "p2-1", phase: "p2", kind: "action",
      title: "部署灰度实例（10% 流量）",
      desc: "拉起灰度实例组并接入 10% 生产流量，开始观察窗口。",
      est: "5 分钟",
      actions: [
        { label: "拉起灰度实例组并接入 10% 流量", result: "灰度组 canary-7d4f 就绪，10% 流量" },
      ],
    },
    {
      id: "p2-2", phase: "p2", kind: "gate",
      title: "灰度观察门禁（15 分钟）",
      desc: "对照阈值逐项研判。任一指标越限都必须判定「未达标」，并按恢复路径处置——误判会被记为失误。",
      est: "15 分钟",
      gate: {
        badChance: 0.5,
        metrics: [
          { name: "P99 延迟", unit: "ms", good: 247, bad: 412, threshold: "< 300", decimals: 0 },
          { name: "HTTP 5xx 错误率", unit: "%", good: 0.04, bad: 0.42, threshold: "< 0.10", decimals: 2 },
          { name: "CPU 饱和度", unit: "%", good: 58, bad: 81, threshold: "< 70", decimals: 0 },
        ],
      },
      recovery: {
        kicker: "恢复路径 · 灰度回滚",
        intro: "门禁未达标时按以下路径处置，处置完毕后重新灰度并复判。正确执行恢复路径不算失误。",
        actions: [
          { id: "r1", type: "button", label: "回滚灰度组 canary-7d4f", result: "灰度实例已回收，10% 流量摘除" },
          { id: "r2", type: "check", label: "抽样日志确认异常来自 v2.4.0 新代码路径" },
        ],
        retryLabel: "重新灰度并复判",
      },
    },
    {
      id: "p3-1", phase: "p3", kind: "irreversible",
      title: "执行数据库迁移 #217",
      desc: "为 orders 表新增 status_default 列（NOT NULL + 默认值）。迁移一旦提交，无法直接撤销，只能走恢复路径。",
      est: "8 分钟",
      confirmPhrase: "MIGRATE-217",
      confirmLabel: "执行迁移 #217",
      confirmDesc: "即将对生产库 orders-db 执行 schema 迁移 #217。提交后无法直接撤销。",
      recovery: {
        kicker: "恢复路径 · 迁移 #217",
        steps: [
          "首选：在线执行反向修复脚本 217-fix（约 8 分钟，不锁表）",
          "若修复无效：停止写入，用快照 snap-0919-a1b2 整库恢复（停机约 40 分钟）",
          "恢复后重新研判数据校验，并通报值班经理",
        ],
        note: "本步骤快照兜底由「备份快照」阶段提供；执行前请确认快照已验证可恢复。",
      },
    },
    {
      id: "p3-2", phase: "p3", kind: "gate",
      title: "迁移后数据校验",
      desc: "迁移不可逆，故迁移后必须用数据指标确认无损。任一指标越限即判定「未达标」。",
      est: "5 分钟",
      gate: {
        badChance: 0.25,
        metrics: [
          { name: "回填完成率", unit: "%", good: 100, bad: 97.2, threshold: "≥ 99.99", decimals: 2 },
          { name: "慢查询增量", unit: "条/分", good: 0, bad: 23, threshold: "< 5", decimals: 0 },
          { name: "主从延迟", unit: "s", good: 0.8, bad: 4.6, threshold: "< 2", decimals: 1 },
        ],
      },
      recovery: {
        kicker: "恢复路径 · 迁移后修复",
        intro: "按路径处置后复判。注意：迁移本身不可逆，修复动作均为在线补偿。",
        actions: [
          { id: "r1", type: "check", label: "抽样核对慢查询来源，确认非迁移引起" },
          { id: "r2", type: "button", label: "在线补建索引 idx_orders_created_at", result: "索引已生效，执行计划已更新" },
        ],
        retryLabel: "复判数据校验",
      },
    },
    {
      id: "p4-1", phase: "p4", kind: "irreversible",
      title: "全量切换 100% 流量",
      desc: "将生产流量从 v2.3.1 整体切至 v2.4.0，切换即全量生效。窗口内保留 Kill-Switch 快速回切能力。",
      est: "3 分钟",
      confirmPhrase: "CUTOVER",
      confirmLabel: "执行全量切换",
      confirmDesc: "即将把 100% 生产流量切换至 v2.4.0。切换立即全量生效。",
      recovery: {
        kicker: "恢复路径 · Kill-Switch 回切",
        steps: [
          "5 分钟内：按 Kill-Switch 将 100% 流量回切 v2.3.1",
          "回切后保留 v2.4.0 实例用于定位，并通报值班经理",
          "定位修复后重新走本步骤的确认流程再切换",
        ],
        note: "回切开关演练记录：最近一次实测回切用时 3 分 12 秒。",
      },
    },
    {
      id: "p4-2", phase: "p4", kind: "gate",
      title: "全量观察门禁（30 分钟）",
      desc: "全量后的最终门禁。此时流量已不可逆地切至新版本，越限必须走恢复路径处置。",
      est: "30 分钟",
      gate: {
        badChance: 0.35,
        metrics: [
          { name: "P99 延迟", unit: "ms", good: 268, bad: 388, threshold: "< 300", decimals: 0 },
          { name: "HTTP 5xx 错误率", unit: "%", good: 0.03, bad: 0.51, threshold: "< 0.10", decimals: 2 },
          { name: "下单成功率", unit: "%", good: 99.97, bad: 99.62, threshold: "≥ 99.90", decimals: 2 },
          { name: "MQ 消费积压", unit: "条", good: 320, bad: 8400, threshold: "< 1000", decimals: 0 },
        ],
      },
      recovery: {
        kicker: "恢复路径 · 全量回切与热修",
        intro: "全量后异常的处置路径。回切是先止损，热修后再重新切换。",
        actions: [
          { id: "r1", type: "button", label: "Kill-Switch 回切 v2.3.1", result: "流量已回切（用时 3 分 12 秒）" },
          { id: "r2", type: "check", label: "通报值班经理与业务方（通告模板 #ops-3）" },
          { id: "r3", type: "button", label: "部署热修 v2.4.1 并重新切换 100%", result: "流量已切换至 v2.4.1" },
        ],
        retryLabel: "复判全量观察",
      },
    },
    {
      id: "p5-1", phase: "p5", kind: "check",
      title: "关闭变更单与通告",
      desc: "流程收尾：关闭变更、知会业务方。",
      est: "3 分钟",
      checks: [
        "变更单 CHG-20260919-042 标记为完成",
        "已向业务方发送发布完成通告",
      ],
    },
    {
      id: "p5-2", phase: "p5", kind: "action",
      title: "归档发布报告",
      desc: "归档后本次演练结束，输出零失误判定。",
      est: "2 分钟",
      actions: [
        { label: "生成本次发布报告并归档", result: "报告 RLS-20260919-042 已归档" },
      ],
    },
  ],
};
