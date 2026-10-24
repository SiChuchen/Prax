/* Sundown — orders-primary 下线执行台
 * 数据内联（data.js）。首屏同步渲染，无加载态。
 */
window.RUNBOOK = {
  id: "orders-primary-decommission",
  title: "orders-primary 生产数据库下线",
  subtitle: "Runbook RB-0417 · 变更单 CHG-2026-0887",
  resource: "ORDERS-PRIMARY",
  confirmToken: "ORDERS-PRIMARY",
  brief: "本流程将永久下线生产数据库 orders-primary。其中第 3 阶段包含三个不可逆步骤：每一步执行前都有显式确认门，执行后有 60 秒恢复窗口（可撤销恢复 / 确认保留）。零失误走完全程即达成。",
  phases: [
    {
      id: "p1", title: "阶段 1 · 准备与核验",
      steps: [
        {
          id: "s1", irreversible: false,
          title: "冻结应用写入",
          desc: "开启 orders-primary 的全局写入冻结，让所有订单服务进入只读降级。",
          why: "后续任何操作都假设数据不再变化。写冻结是零失误的起点：如果仍有写入，备份与校验都会失真。",
          actionLabel: "开启写入冻结",
          checks: [
            "维护窗口已开始（02:00–04:00 CST）",
            "订单服务的双写开关已关闭",
            "状态页已发布维护公告"
          ]
        },
        {
          id: "s2", irreversible: false,
          title: "最终备份快照",
          desc: "对 orders-primary 执行最终全量快照，并归档校验和。",
          why: "这是销毁动作发生前最后的完整副本。校验和必须与快照一致，否则不得进入第 3 阶段。",
          actionLabel: "归档最终快照",
          checks: [
            "全量快照任务已完成（SNAP-8841）",
            "快照校验和匹配（sha256:c41f…9e02）",
            "快照已从副本成功挂载验证"
          ]
        }
      ]
    },
    {
      id: "p2", title: "阶段 2 · 流量切换",
      steps: [
        {
          id: "s3", irreversible: false,
          title: "orders-primary 切入只读",
          desc: "将数据库置为只读模式，排空剩余队列。",
          why: "只读是切流前的静默确认：若此刻仍有业务报错，应回退本步而不是继续。",
          actionLabel: "切入只读模式",
          checks: [
            "写队列已排空（队列深度 0）",
            "从库复制延迟为 0s",
            "核心接口只读探活全部通过"
          ]
        },
        {
          id: "s4", irreversible: false,
          title: "应用流量切至新库 orders-next",
          desc: "把订单服务的数据源从 orders-primary 切换到 orders-next。",
          why: "切流完成后，orders-primary 不再承载任何业务。此步可逆：新库异常时可切回。",
          actionLabel: "完成流量切换",
          checks: [
            "orders-next 连接池已预热",
            "金丝雀流量验证通过（错误率 0.00%）",
            "全量切流开关已确认（ FeatureFlag: ds_orders_next=100 ）"
          ]
        }
      ]
    },
    {
      id: "p3", title: "阶段 3 · 不可逆拆除",
      steps: [
        {
          id: "s5", irreversible: true, windowSec: 60,
          title: "吊销 orders-primary 访问凭据",
          desc: "吊销所有仍指向 orders-primary 的服务账号凭据。",
          why: "凭据吊销切断了旧库的最后一条常规访问路径，防止切流遗漏的服务继续写入。",
          actionLabel: "吊销凭据",
          consequences: [
            "所有仍配置 orders-primary 凭据的服务立即断连",
            "原凭据无法再回连旧库（回滚需走紧急审批重新签发）",
            "监控与排障工具将失去直连旧库能力"
          ],
          checks: [
            "切流后观察 30 分钟，订单核心指标无异常",
            "依赖清单中不再有 orders-primary 的活跃调用方"
          ]
        },
        {
          id: "s6", irreversible: true, windowSec: 60,
          title: "销毁 orders-primary 加密密钥",
          desc: "在 KMS 中销毁 orders-primary 的数据加密密钥（DEK-77）。",
          why: "密钥销毁后，任何磁盘介质上的数据都无法解密——这是数据不可恢复的最终屏障。",
          actionLabel: "销毁加密密钥",
          consequences: [
            "orders-primary 全部备份与磁盘数据永久不可解密",
            "DEK-77 不可重建，恢复窗口结束后无法撤销",
            "合规审计将以本次销毁记录作为数据销毁凭证"
          ],
          checks: [
            "第 2 步的最终快照校验和再次核对通过",
            "合规与 DBA 双人已在本单确认销毁授权"
          ]
        },
        {
          id: "s7", irreversible: true, windowSec: 60,
          title: "删除 orders-primary 备份快照",
          desc: "删除备份库中 orders-primary 的全部快照（含 SNAP-8841）。",
          why: "删除快照后，orders-primary 在物理上不复存在。这是本流程的最后一个不可逆动作。",
          actionLabel: "删除全部快照",
          consequences: [
            "orders-primary 的全部历史快照永久删除",
            "包括本日最终快照 SNAP-8841 在内无任何副本残留",
            "此后不可能以任何技术手段恢复 orders-primary 数据"
          ],
          checks: [
            "保留清单外的所有快照已核对（共 14 份）",
            "法务与合规已确认备份保留期届满"
          ]
        }
      ]
    },
    {
      id: "p4", title: "阶段 4 · 收尾完成",
      steps: [
        {
          id: "s8", irreversible: false,
          title: "更新服务目录与 DNS",
          desc: "在服务目录中下线 orders-primary 条目，并移除相关 DNS 记录。",
          why: "让目录与域名层反映真实世界：残留条目会把后来者引向一个不存在的数据库。",
          actionLabel: "更新目录与 DNS",
          checks: [
            "服务目录 orders-primary 条目已置为 decommissioned",
            "DNS 记录 orders-primary.internal 已移除并生效"
          ]
        },
        {
          id: "s9", irreversible: false,
          title: "关闭监控与告警",
          desc: "归档 orders-primary 的监控仪表盘，删除其告警规则。",
          why: "不存在的数据库不应再产生告警噪音；归档保留审计所需的的历史指标。",
          actionLabel: "归档并关闭告警",
          checks: [
            "监控仪表盘已归档（archived/2026/10）",
            "11 条告警规则已删除并留删除记录"
          ]
        },
        {
          id: "s10", irreversible: false,
          title: "下线主机并归档记录",
          desc: "关停 orders-primary 所在主机，归档本 runbook 的执行记录。",
          why: "最后一步：机器下电、记录归档。走完这一步，本次下线零失误完成。",
          actionLabel: "关停主机并归档",
          checks: [
            "主机 db-prod-07 / db-prod-08 已安全关机",
            "本 runbook 执行记录已归档至审计库"
          ]
        }
      ]
    }
  ]
};
