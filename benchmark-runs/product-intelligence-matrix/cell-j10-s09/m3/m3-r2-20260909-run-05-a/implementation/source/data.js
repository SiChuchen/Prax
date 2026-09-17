'use strict';

/* ================= Runbook 数据定义（内联，首屏即用，无任何外部请求） ================= */

const RISK = {
  normal: { label: '常规' },
  caution: { label: '谨慎' },
  irreversible: { label: '不可逆' }
};

const WORKFLOW = {
  id: 'RB-PAY-0915',
  title: '支付核心库主库割接',
  subtitle: '高后果流程执行台 · 目标：零失误走完全程',
  meta: '变更窗口 22:00 – 23:00 · 指挥：值班 DBA',
  phases: [
    {
      id: 'P1',
      name: '阶段一 · 预检与准备',
      steps: [
        {
          code: 'PRE-01', title: '核对备份与快照', risk: 'normal',
          desc: '确认最近一次全量备份可用，并将快照校验码誊录到本单，作为割接后对账的凭证。',
          panel: [
            { k: '全量备份', v: '今日 03:12 完成 · 校验通过' },
            { k: '灾备同步', v: '已下拉至灾备存储' },
            { k: '快照校验码', v: '7F3K9Q', mono: true, strong: true }
          ],
          checks: [
            { id: 'c1', type: 'check', label: '最近全量备份完成且校验通过（6 小时内）' },
            { id: 'c2', type: 'check', label: '备份已异地下拉至灾备存储' },
            { id: 't1', type: 'code', label: '誊录快照校验码', expect: '7F3K9Q', placeholder: '输入值班面板中的校验码' }
          ]
        },
        {
          code: 'PRE-02', title: '冻结变更并确认窗口', risk: 'normal',
          desc: '在进入执行阶段前，冻结一切无关变更，并确认窗口内各干系人在线待命。',
          panel: [
            { k: '变更冻结', v: '已生效 · 冻结编号 FZ-0915-22' },
            { k: '割接窗口', v: '22:00 – 23:00' },
            { k: '干系人', v: '指挥 / DBA×2 / 业务值守 均在线' }
          ],
          checks: [
            { id: 'c1', type: 'check', label: '发布平台变更冻结已生效（FZ-0915-22）' },
            { id: 'c2', type: 'check', label: '业务负责人已在值班群确认割接窗口' }
          ]
        },
        {
          code: 'PRE-03', title: '确认目标副本健康', risk: 'caution',
          desc: '核对目标副本（10.0.12.9）的复制健康度。这是切换前的最后一道数据安全闸。',
          riskNote: '副本延迟超标时强行切换，将造成写入数据丢失。任何异常必须先处理、再推进，不允许带病切换。',
          panel: [
            { k: '目标副本', v: '10.0.12.9:3306', mono: true },
            { k: '复制延迟', v: '0.42 s', strong: true },
            { k: '长事务', v: '无' },
            { k: '锁等待', v: '无' }
          ],
          checks: [
            { id: 'c1', type: 'check', label: '目标副本复制延迟 < 1 s（对照值班面板）' },
            { id: 'c2', type: 'check', label: '副本无长事务、无锁等待' },
            {
              id: 'g1', type: 'gate', label: '目标副本延迟是否 < 1 秒？', expect: 'yes',
              blockedGuidance: '暂停推进：先对照值班面板核实真实延迟。若延迟确已超标，先追平复制后再重新核查；若无法追平，通知指挥并评估中止本次割接。'
            }
          ]
        }
      ]
    },
    {
      id: 'P2',
      name: '阶段二 · 割接执行',
      steps: [
        {
          code: 'CUT-01', title: '停止应用写入', risk: 'caution',
          desc: '打开应用维护开关，排空连接池，使写入流量归零，为端点切换创造静默窗口。',
          riskNote: '本步骤可逆：关闭维护开关即可恢复写入。但窗口只有 60 分钟，排空后请尽快推进后续步骤，避免窗口超时。',
          panel: [
            { k: '维护开关', v: '已打开' },
            { k: '活跃连接', v: '0' },
            { k: '写入 QPS', v: '0', strong: true }
          ],
          checks: [
            { id: 'c1', type: 'check', label: '应用连接池已排空（活跃连接 = 0）' },
            { id: 'c2', type: 'check', label: '维护开关已打开，写入 QPS 归零并截图归档' }
          ]
        },
        {
          code: 'CUT-02', title: '切换写入端点至新主库', risk: 'irreversible',
          desc: '通过配置中心把数据库写入端点从旧主库切换到新主库。切换生效后，所有应用写入立即落到新主库。',
          riskNote: '端点切换对外生效后无法静默撤回：所有应用的写入将立即切换到新主库 10.0.12.9。',
          panel: [
            { k: '旧端点', v: '10.0.12.4:3306', mono: true },
            { k: '新端点', v: '10.0.12.9:3306', mono: true, strong: true },
            { k: '复制延迟', v: '0.30 s' },
            { k: '配置发布', v: '待执行' }
          ],
          checks: [
            { id: 'c1', type: 'check', label: '配置中心已发布新端点并全量生效' },
            { id: 'c2', type: 'check', label: '新主库只读锁定已解除，角色校验通过' }
          ],
          rollback: {
            undoSeconds: 10,
            plan: '撤销窗口（10 秒）内可一键切回旧端点，流量无损。窗口关闭后，唯一回退方式是人工恢复程序 HP-01：回滚配置发布 → 复核复制拓扑 → 二次割接，需两名 DBA 复核，预计中断 15 分钟。',
            manual: {
              code: 'HP-01',
              title: '人工恢复程序 HP-01 · 端点回切',
              phrase: '执行HP-01',
              steps: [
                '回滚配置中心最近一次发布，写入端点指回旧主库 10.0.12.4',
                '复核新旧主库复制拓扑与 binlog 位点',
                '两名 DBA 复核确认后，执行二次割接'
              ]
            }
          },
          confirmPhrase: '确认切换写入端点'
        },
        {
          code: 'CUT-03', title: '旧主库封版退役', risk: 'irreversible',
          desc: '将旧主库（10.0.12.4）降为只读、解除复制链路并标记退役，防止出现双写分叉。',
          riskNote: '封版后旧主库不再接受任何写入，复制链路将被拆除，无法静默恢复。',
          panel: [
            { k: '旧主库', v: '10.0.12.4 · 已只读', mono: true },
            { k: '复制链路', v: '待解除' },
            { k: '退役标签', v: 'retired-0915', mono: true }
          ],
          checks: [
            { id: 'c1', type: 'check', label: '旧主库已降为只读并解除复制链路' },
            { id: 'c2', type: 'check', label: '实例已打退役标签，告警静默已配置' }
          ],
          rollback: {
            undoSeconds: 8,
            plan: '撤销窗口（8 秒）内可一键恢复旧主库写入权限。窗口关闭后需执行人工恢复程序 HP-02：解除退役标签 → 重建复制链路 → 全量数据比对，需值班经理与 DBA 双签。',
            manual: {
              code: 'HP-02',
              title: '人工恢复程序 HP-02 · 旧主库解封',
              phrase: '执行HP-02',
              steps: [
                '解除退役标签，恢复实例告警',
                '重建旧主库与新主库间的复制链路并追平数据',
                '全量数据比对一致后，由值班经理与 DBA 双签解封'
              ]
            }
          },
          confirmPhrase: '确认封版旧主库'
        }
      ]
    },
    {
      id: 'P3',
      name: '阶段三 · 验证与收尾',
      steps: [
        {
          code: 'POST-01', title: '核心链路冒烟验证', risk: 'caution',
          desc: '在新主库上执行核心链路冒烟，并对账新旧库数据，确认本次割接无损。',
          riskNote: '任何一项验证失败都必须停止放流，按回退指引评估端点回切（HP-01），不允许带差异放流。',
          panel: [
            { k: '下单冒烟', v: '3 / 3 通过', strong: true },
            { k: '对账差异', v: '0 条', strong: true },
            { k: '支付成功率', v: '99.98 %' }
          ],
          checks: [
            { id: 'c1', type: 'check', label: '支付下单冒烟用例全部通过（3/3）' },
            { id: 'c2', type: 'check', label: '新旧库对账差异 = 0' },
            {
              id: 'g1', type: 'gate', label: '冒烟与对账是否全部通过？', expect: 'yes',
              blockedGuidance: '验证未通过：立即停止放流。通知指挥评估执行 HP-01 端点回切；回切完成前不得解除维护开关、不得恢复流量。'
            }
          ]
        },
        {
          code: 'POST-02', title: '恢复应用流量', risk: 'normal',
          desc: '关闭维护开关，按灰度策略恢复全部流量，并观察核心指标回落到基线。',
          panel: [
            { k: '维护开关', v: '已关闭 · 灰度 100%' },
            { k: '错误率', v: '0.02 %' },
            { k: '核心延迟', v: 'P99 84 ms' }
          ],
          checks: [
            { id: 'c1', type: 'check', label: '维护开关已关闭，流量灰度 100% 生效' },
            { id: 'c2', type: 'check', label: '错误率与延迟回落至割接前基线' }
          ]
        },
        {
          code: 'POST-03', title: '归档并解除冻结', risk: 'normal',
          desc: '归档执行记录，解除变更冻结并通报窗口关闭，正式结束本次割接。',
          panel: [
            { k: '执行记录', v: '待归档 · 本单' },
            { k: '变更冻结', v: '待解除 · FZ-0915-22' },
            { k: '关闭通报', v: '待发送' }
          ],
          checks: [
            { id: 'c1', type: 'check', label: '割接记录与监控截图归档至值班日志' },
            { id: 'c2', type: 'check', label: '变更冻结解除，窗口关闭通报已发送' }
          ]
        }
      ]
    }
  ]
};
