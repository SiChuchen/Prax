// 生产发布 runbook 数据 —— 首屏内联，页面加载即用（无加载态）
// 风险类型：normal 常规 · verification 验证门 · irreversible 不可逆（确认门 + 恢复路径）
window.RUNBOOK = {
  code: "RB-2027-042",
  title: "生产发布执行",
  release: "v2.7.0",
  window: "变更窗口 22:00–24:00",
  captain: "发布值班长",
  phases: [
    {
      id: "p1",
      name: "预检",
      summary: "确认环境、人员与退路就绪",
      steps: [
        {
          id: "s1",
          code: "01",
          title: "确认变更窗口与值班到位",
          risk: "normal",
          detail: [
            "与值班经理确认变更窗口 22:00–24:00 无冲突。",
            "确认二线支援（DBA / 网络）在岗且可被呼叫。",
            "在值班频道发布「开始发布」通告。"
          ],
          contingency: [
            { if: "窗口与营销大促冲突", then: "中止发布，另行排期" }
          ]
        },
        {
          id: "s2",
          code: "02",
          title: "检查监控基线",
          risk: "verification",
          detail: [
            "打开核心监控面板，记录当前基线值。",
            "确认以下断言在近 15 分钟内持续成立。"
          ],
          checks: [
            "错误率 < 0.1%（近 15 分钟）",
            "P99 延迟 < 320ms（近 15 分钟）",
            "当前无未处理的 P2 及以上告警"
          ],
          contingency: [
            { if: "基线本身异常", then: "中止发布，先处理告警" }
          ]
        },
        {
          id: "s3",
          code: "03",
          title: "确认回滚版本制品可用",
          risk: "normal",
          detail: [
            "在制品库确认 v2.6.9 镜像与迁移回滚脚本 rollback-0042.sql 均已归档。",
            "将制品 SHA-256 摘要记录到发布频道。",
            "没有退路，不得开始发布。"
          ],
          contingency: [
            { if: "回滚制品缺失", then: "中止发布，先补齐归档" }
          ]
        },
        {
          id: "s4",
          code: "04",
          title: "冻结其他变更",
          risk: "normal",
          detail: [
            "在变更平台开启发布冻结窗，冻结期覆盖整个变更窗口。",
            "确认冻结生效：无新的变更单可进入执行。"
          ],
          contingency: [
            { if: "存在不可冻结的紧急变更", then: "升级至值班经理决策后再继续" }
          ]
        }
      ]
    },
    {
      id: "p2",
      name: "构建与制品",
      summary: "产出并锁定本次发布的唯一制品",
      steps: [
        {
          id: "s5",
          code: "05",
          title: "合并 release 分支并跑通 CI",
          risk: "verification",
          detail: [
            "将 release/2.7.0 合入 main，触发完整 CI 流水线。",
            "逐项确认以下断言后才能进入制品校验。"
          ],
          checks: [
            "单元测试 + 集成测试全部通过",
            "候选制品 build-1042 已生成"
          ],
          contingency: [
            { if: "CI 失败", then: "回退合并，修复后重新排期" }
          ]
        },
        {
          id: "s6",
          code: "06",
          title: "校验制品指纹",
          risk: "verification",
          detail: [
            "核对部署制品与 CI 产物的指纹与签名，确保所见即所部署。"
          ],
          checks: [
            "SHA-256 与 CI 产物一致",
            "制品签名验证通过"
          ],
          contingency: [
            { if: "指纹不一致", then: "立即销毁该制品并重建流水线" }
          ]
        }
      ]
    },
    {
      id: "p3",
      name: "数据库迁移",
      summary: "唯一涉及数据结构变更的阶段，含第一个不可逆步骤",
      steps: [
        {
          id: "s7",
          code: "07",
          title: "备份数据库并验证可恢复",
          risk: "verification",
          detail: [
            "执行 orders 库全量备份。",
            "在临时实例完成一次恢复演练——未验证过的备份等于没有备份。",
            "全部断言通过后，迁移步骤的确认门才会解锁。"
          ],
          checks: [
            "全量备份 backup-2027-042 已完成",
            "临时实例恢复演练成功",
            "备份校验和与源库一致"
          ],
          contingency: [
            { if: "恢复演练失败", then: "中止发布，不得进入迁移" }
          ]
        },
        {
          id: "s8",
          code: "08",
          title: "执行数据库迁移",
          risk: "irreversible",
          confirmPhrase: "MIGRATE-0042",
          detail: [
            "在停写窗口（≤ 5 分钟）内执行迁移脚本 migrate-0042.sql。",
            "变更内容：orders 表新增 fulfillment_channel 列及其索引。",
            "执行后本步骤只能通过下方恢复路径回滚，不可撤销重做。"
          ],
          recovery: {
            title: "回滚迁移 rollback-0042.sql",
            impact: "新增列与索引将被删除；迁移窗口内新写入的数据不丢失。预计停写 5 分钟。",
            steps: [
              "再次进入停写窗口（≤ 5 分钟）",
              "执行 rollback-0042.sql",
              "核对 orders 行数与迁移前一致",
              "解除停写，并在值班频道记录回滚时间点"
            ]
          },
          contingency: [
            { if: "迁移脚本执行报错", then: "立即按恢复路径回滚，并停止后续所有步骤" }
          ]
        },
        {
          id: "s9",
          code: "09",
          title: "校验迁移后数据完整性",
          risk: "verification",
          detail: [
            "对比迁移前后的关键数据指标，抽样校验新字段质量。"
          ],
          checks: [
            "orders 行数迁移前后一致",
            "抽样 1000 行 fulfillment_channel 填充率 100%",
            "无孤儿外键记录"
          ],
          contingency: [
            { if: "任一校验不通过", then: "回到步骤 08 执行恢复路径回滚迁移" }
          ]
        }
      ]
    },
    {
      id: "p4",
      name: "发布与切流",
      summary: "先灰度后全量，全量切流不可逆",
      steps: [
        {
          id: "s10",
          code: "10",
          title: "部署灰度实例 5%",
          risk: "normal",
          detail: [
            "以 v2.7.0 制品替换 5% 生产实例。",
            "确认新实例健康检查全部通过后再进入观察。"
          ],
          contingency: [
            { if: "实例启动失败", then: "将该批实例回滚至 v2.6.9 并检查启动日志" }
          ]
        },
        {
          id: "s11",
          code: "11",
          title: "观察灰度指标",
          risk: "verification",
          detail: [
            "灰度期不少于 10 分钟，逐项确认以下断言。"
          ],
          checks: [
            "5% 流量错误率无升高",
            "P99 延迟与基线偏差 < 10%",
            "无新增告警，核心下单转化正常"
          ],
          contingency: [
            { if: "指标持续恶化", then: "将灰度实例回滚至 v2.6.9（可逆操作），回到本步骤重新部署" }
          ]
        },
        {
          id: "s12",
          code: "12",
          title: "全量切流 100%",
          risk: "irreversible",
          confirmPhrase: "CUTOVER-100",
          detail: [
            "将 100% 生产流量切换至 v2.7.0 实例池。",
            "v2.6.9 实例池保留 24 小时后再执行清理（步骤 15）。",
            "切流完成后即对全部用户生效，只能按恢复路径回切。"
          ],
          recovery: {
            title: "回滚镜像至 v2.6.9 并回切流量",
            impact: "切流后新写入的数据由新增列承接，回滚镜像不丢失数据；回切预计 3 分钟。",
            steps: [
              "将网关权重回切至 v2.6.9 实例池",
              "确认 v2.6.9 实例健康检查通过",
              "观察错误率回落至基线",
              "在值班频道记录回滚时间点"
            ]
          },
          contingency: [
            { if: "切流后大面积异常", then: "立即执行恢复路径回切流量，不要尝试在线修复" }
          ]
        }
      ]
    },
    {
      id: "p5",
      name: "验证与观察",
      summary: "证明这次发布是成功的",
      steps: [
        {
          id: "s13",
          code: "13",
          title: "执行冒烟测试",
          risk: "verification",
          detail: [
            "在生产环境按冒烟清单逐项执行，全部通过方可进入观察期。"
          ],
          checks: [
            "登录 → 浏览 → 下单主链路通过",
            "支付回调通知正常",
            "主要 API 抽查均返回 200"
          ],
          contingency: [
            { if: "冒烟失败", then: "先执行步骤 12 恢复路径回切流量，再排查" }
          ]
        },
        {
          id: "s14",
          code: "14",
          title: "稳定性观察 30 分钟",
          risk: "verification",
          detail: [
            "在发布频道每 10 分钟播报一次指标快照，观察期结束后逐项确认。"
          ],
          checks: [
            "连续 30 分钟无 P3 及以上新告警",
            "错误率回到基线水平",
            "CPU / 内存占用平稳无爬升"
          ],
          contingency: [
            { if: "观察期出现劣化", then: "回切流量并中止本次发布" }
          ]
        }
      ]
    },
    {
      id: "p6",
      name: "收尾",
      summary: "清理现场并留档",
      steps: [
        {
          id: "s15",
          code: "15",
          title: "清理旧版本实例",
          risk: "irreversible",
          confirmPhrase: "RETIRE-V269",
          detail: [
            "确认 v2.6.9 归档制品校验通过后，缩容并删除 v2.6.9 实例池。",
            "实例删除后无法直接恢复，恢复方式是用归档制品重建。"
          ],
          recovery: {
            title: "从归档制品重建 v2.6.9 实例池",
            impact: "已删除的实例不可直接恢复；恢复方式为用归档镜像按原规格重建，预计 15 分钟。",
            steps: [
              "从制品库取回 v2.6.9 归档镜像",
              "按原规格重建实例池",
              "网关权重临时回切验证可用",
              "将本次回滚记录进发布纪要"
            ]
          },
          contingency: [
            { if: "归档制品校验失败", then: "保留 v2.6.9 实例池并升级决策，本步骤不得执行" }
          ]
        },
        {
          id: "s16",
          code: "16",
          title: "更新状态页与通知干系人",
          risk: "normal",
          detail: [
            "状态页发布「维护完成」公告。",
            "向业务方发送发布完成通知。"
          ],
          contingency: [
            { if: "状态页发布失败", then: "改用值班频道公告，并在纪要中记录" }
          ]
        },
        {
          id: "s17",
          code: "17",
          title: "解冻变更并归档纪要",
          risk: "normal",
          detail: [
            "关闭发布冻结窗，恢复常态变更流程。",
            "点击顶栏「导出纪要」生成发布纪要，归档至发布频道置顶。"
          ],
          contingency: []
        }
      ]
    }
  ]
};
