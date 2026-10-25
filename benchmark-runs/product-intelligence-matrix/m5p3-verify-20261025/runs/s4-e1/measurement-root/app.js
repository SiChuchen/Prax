/* 办结 —— 高后果流程零失误向导
 * 示例流程：有限公司注销（单一 workflow，5 阶段 × 11 步，其中 2 个互斥分支步骤，判定后 1 步标记不适用）
 * 零外部依赖；数据随脚本内联，首屏同步渲染，无加载态。
 */
'use strict';

/* ---------------------------------------------------------------- 数据 -- */

const FLOW = {
  meta: {
    product: '办结',
    company: '示例市云杉科技有限公司',
    updated: '口径核对：2026-10',
    disclaimer: '本应用为流程演练演示，步骤与材料为常见通行口径；各地执行细节存在差异，一切以办理当日主管机关官方口径为准。'
  },
  phases: [
    {
      id: 'p1', name: '一 · 决议与备案', steps: [
        {
          id: 's1', title: '股东会解散决议', risk: 'normal',
          oneLiner: '全体股东依章程作出解散公司的股东会决议——注销全程的合法起点。',
          meta: { 地点: '公司住所地 / 线上股东会', 周期: '1–3 个工作日', 费用: '0' },
          points: [
            '按章程约定的表决权比例通过解散决议（通常需三分之二以上表决权）',
            '决议同步确定清算组成员（通常由股东担任）与负责人',
            '决议原件全体股东签署，一式多份：备案、税务、银行各需留存'
          ],
          preflight: [
            '已核对章程，确认解散决议所需的表决权比例',
            '决议文件已由全体参会股东签署并归档',
            '清算组人选已确定，且成员本人知情同意'
          ],
          pitfalls: [
            '表决权比例不足 → 决议可被撤销，后续所有动作失去依据',
            '决议未写明清算组成员 → 备案时被退回补正'
          ],
          advisory: {
            regional: '部分地区提供决议文本范本，建议按当地市场监管部门范本起草。',
            time: '公司法及登记口径近年有修订，以办理当日口径为准。'
          }
        },
        {
          id: 's2', title: '清算组备案', risk: 'normal',
          oneLiner: '将清算组信息向市场监管部门备案，取得合法清算身份。',
          meta: { 地点: '国家企业信用信息公示系统 / 登记机关窗口', 周期: '当场或 1–3 个工作日', 费用: '0' },
          points: [
            '通过公示系统或登记窗口提交清算组备案（成员、负责人、联系方式）',
            '备案完成后，清算组方可对外发布公告、处理清算事务',
            '保留备案回执或公示截图——后续多处要用'
          ],
          preflight: [
            '营业执照副本与公章在手',
            '备案信息与股东会决议完全一致',
            '已保存备案成功凭证（回执或截图）'
          ],
          pitfalls: [
            '备案成员与决议不一致 → 被退回',
            '公示系统登录方式（电子营业执照等）未提前准备 → 现场卡壳'
          ],
          advisory: {
            regional: '线上渠道名称各地不同（公示系统 / 一网通办等），任选其一即可。',
            time: '备案渠道界面常更新，每完成一步截图留档。'
          }
        }
      ]
    },
    {
      id: 'p2', name: '二 · 公告与清偿', steps: [
        {
          id: 's3', title: '发布债权人公告', risk: 'irreversible',
          oneLiner: '以清算组身份在公示系统发布债权人公告，开启 45 日申报期——第一个不可逆节点。',
          meta: { 地点: '国家企业信用信息公示系统', 周期: '发布 1 日，公示期 45 日', 费用: '0' },
          points: [
            '公告期 45 日，自发布之日起算；期内公司不得继续经营性收支',
            '同步向全体已知债权人发出书面通知并留存凭证',
            '把公示期的起止日期写进日历，后续步骤都卡着这条线'
          ],
          preflight: [
            '公告文本已逐字核对（公司名称、统一社会信用代码、清算组信息）',
            '已知债权人名单与联系方式已整理成册',
            '公示期起止日期已标记'
          ],
          pitfalls: [
            '公司名称 / 统一社会信用代码写错 → 公告作废重来，45 日重新起算',
            '只发公告、未书面通知已知债权人 → 清算责任瑕疵'
          ],
          consequence: '公告一经发布即对外公示。内容错误或情形不符将导致申报期作废、流程倒退至少 45 日，并可能引来债权人异议。',
          recovery: {
            before: '尚未提交：公告可随时在系统中撤回、修改后重新提交，无任何后果。',
            after: '已发布且发现重大错误：立即向登记机关说明并作废重发，45 日重新起算；轻微瑕疵可在公示系统作更正说明。'
          },
          confirm: {
            promises: [
              '我已逐字核对公告文本（名称、统一社会信用代码、清算组信息）',
              '我已确认 45 日申报期的起算与截止日期',
              '我已理解：发布后若发现重大错误，申报期将作废并重新起算 45 日'
            ],
            typed: false
          }
        },
        {
          id: 's4', title: '清偿债务与申报处理', risk: 'normal',
          oneLiner: '公示期内登记申报债权，按法定顺序清偿职工工资社保与已知债务。',
          meta: { 地点: '公司经营地', 周期: '与 45 日公示期并行', 费用: '视债务情况' },
          points: [
            '对已知债权人书面通知并留存送达凭证；登记申报债权，编制债务清册',
            '清偿顺序：清算费用 → 职工工资社保 → 税款 → 普通债权',
            '资不抵债时不得继续普通注销，应转入破产程序'
          ],
          preflight: [
            '职工工资、社保、公积金已全部结清',
            '已知债权人已全部书面通知',
            '债务清册与清偿凭证齐全'
          ],
          pitfalls: [
            '未清偿职工债权就向股东分配 → 股东对职工债权承担连带责任',
            '对债权申报异议置之不理 → 公示期后转为诉讼、阻碍注销'
          ],
          advisory: {
            regional: '欠薪垫付等特殊政策各地不同，涉及劳动争议先咨询当地人社部门。',
            time: '与 45 日公示期并行推进，不要等公示期满才开始。'
          }
        }
      ]
    },
    {
      id: 'p3', name: '三 · 税务注销', steps: [
        {
          id: 's5', title: '税务注销路径判定', risk: 'gate',
          oneLiner: '回答三个判定问题，确定走「即办」还是「一般程序」，避免走错通道白跑。',
          meta: { 地点: '本页判定，结果供参考', 周期: '5 分钟', 费用: '0' },
          points: [
            '三问全部为「否」→ 通常符合即办条件，当日办结',
            '任何一问为「是」→ 走一般程序：先补申报、补缴、移出异常，再注销',
            '判定结果仅供参考，最终以税务机关受理口径为准'
          ],
          preflight: [
            '电子税务局可正常登录',
            '公司税务状况资料（申报记录、发票领用记录）在手'
          ],
          pitfalls: [
            '误判为即办、到窗被告知不符 → 白跑一趟',
            '存在未申报却未处理 → 受理退回，还可能新增滞纳金'
          ],
          gate: {
            intro: '逐题作答，向导将推荐通道并把不适用的分支步骤标记为「不适用」：',
            questions: [
              { id: 'q1', text: '公司是否曾领用发票且尚未缴销？' },
              { id: 'q2', text: '是否存在未按期申报或未结清的税款？' },
              { id: 'q3', text: '是否被列入经营异常名录，或存在未办结的稽查 / 协查事项？' }
            ],
            branches: {
              fast:  { label: '即办通道', stepId: 's6a', why: '三问均为「否」：无发票、无欠税、无异常——多数情形可当日办结。' },
              general: { label: '一般程序', stepId: 's6b', why: '存在待办结事项：先补申报 / 补缴 / 移出异常，取得清税证明后再继续。' }
            }
          },
          advisory: {
            regional: '「即办」条件各地执行尺度略有差异，以主管税务机关答复为准。',
            time: '临时税务登记、简易注销试点等政策更新频繁，以当日口径为准。'
          }
        },
        {
          id: 's6a', title: '即办通道 · 税务注销', risk: 'irreversible', branchKey: 'fast',
          oneLiner: '符合条件的市场主体当日办结税务注销，取得《清税证明》。',
          meta: { 地点: '电子税务局 / 办税服务厅', 周期: '当场办结', 费用: '0' },
          points: [
            '适用于未领用发票或已缴销发票、无未办结事项的情形',
            '提交清税申报，取得《清税证明》',
            '清税证明原件妥善保管——注销登记时必须提交'
          ],
          preflight: [
            '路径判定结果为「即办通道」',
            '全部税种均已申报完毕',
            '《清税证明》已取得并扫描存档'
          ],
          pitfalls: [
            '持有税控设备未注销 → 无法即办',
            '清税证明遗失补开耗时——先扫描存档'
          ],
          consequence: '税务注销完成后，公司的纳税主体资格终止。此后若发现遗漏申报或欠税，将直接产生法律责任与滞纳金，且税务登记不可恢复。',
          recovery: {
            before: '尚未提交：申请可随时撤回，补充资料后重新提交，无后果。',
            after: '已办结：本步没有撤销窗口。补救方式只剩「依法补申报、补缴」——请把这里当作最后的核对点。'
          },
          confirm: {
            promises: [
              '我已确认路径判定为「即办」，且全部税种申报完毕',
              '我已确认无未缴销发票、无未注销税控设备',
              '我已理解：清税证明签发后，纳税主体资格终止且不可恢复'
            ],
            typed: false
          }
        },
        {
          id: 's6b', title: '一般程序 · 税务注销', risk: 'irreversible', branchKey: 'general',
          oneLiner: '存在未办结事项时，经查账、补申报、补缴后取得《清税证明》。',
          meta: { 地点: '主管税务机关（可能多次跑动）', 周期: '数周至数月', 费用: '补缴税款与滞纳金' },
          points: [
            '逐税种补申报、补缴税款与滞纳金',
            '配合查账，处理异常名录、稽查等未办结事项',
            '办结后取得《清税证明》并扫描存档'
          ],
          preflight: [
            '路径判定结果为「一般程序」',
            '全部补申报 / 补缴已完成',
            '《清税证明》已取得并扫描存档'
          ],
          pitfalls: [
            '低估滞纳金按日累加 → 预算不足',
            '经营异常名录未移出 → 流程卡住数月'
          ],
          consequence: '税务注销完成后，公司的纳税主体资格终止。此后若发现遗漏申报或欠税，将直接产生法律责任与滞纳金，且税务登记不可恢复。',
          recovery: {
            before: '办理过程中：随时可与专管员沟通补充材料，尚未取得清税证明前均可中止。',
            after: '已办结：本步没有撤销窗口。补救方式只剩「依法补申报、补缴」——请把这里当作最后的核对点。'
          },
          confirm: {
            promises: [
              '我已确认全部补申报、补缴事项办结',
              '我已确认无未办结的异常名录 / 稽查事项',
              '我已理解：清税证明签发后，纳税主体资格终止且不可恢复'
            ],
            typed: false
          }
        }
      ]
    },
    {
      id: 'p4', name: '四 · 账户与人员收尾', steps: [
        {
          id: 's7', title: '银行基本户销户', risk: 'irreversible',
          oneLiner: '注销公司基本存款账户，结清余额、收回票据与网银介质。',
          meta: { 地点: '开户银行对公柜台', 周期: '1–7 个工作日', 费用: '0 – 小额手续费' },
          points: [
            '提前结清账户余额，按完税后的清算方案转出',
            '交回未用支票、回单卡、网银介质，解除全部代扣协议',
            '取得销户回执并归档'
          ],
          preflight: [
            '账户余额已清零或已安排转出',
            '未用票据与网银介质已收回',
            '不存在未到期的对公贷款或对外担保'
          ],
          pitfalls: [
            '账户里还有未兑付支票 → 销户失败',
            '漏解约代扣协议（税、社保）→ 扣款失败产生滞纳金'
          ],
          consequence: '销户完成后，原账号永久失效——任何向该账号的付款都无法入账，也无法恢复。',
          recovery: {
            before: '尚未办理：账户可正常使用，随时可以暂停计划；先冻结账户是可逆的保护动作。',
            after: '已销户：账号不可恢复。若有遗漏款项，只能凭销户回执与对方协商退至指定账户——流程繁琐且不保证成功。'
          },
          confirm: {
            promises: [
              '我已确认账户余额处理完毕、无未兑付票据',
              '我已解除全部代扣 / 委托扣款协议',
              '我已理解：原账号销户后永久失效，不可恢复'
            ],
            typed: false
          }
        },
        {
          id: 's8', title: '社保与公积金账户注销', risk: 'normal',
          oneLiner: '人员全部减员、结清费用后，注销社保与公积金单位账户。',
          meta: { 地点: '社保网上服务 / 经办窗口', 周期: '各 1–5 个工作日', 费用: '0' },
          points: [
            '在职人员全部办理减员，结清最后一期费用',
            '分别提交社保、公积金账户注销申请',
            '保留注销回执归档'
          ],
          preflight: [
            '全部员工已减员且异议期已过',
            '社保、公积金均无欠缴记录',
            '两笔注销回执均已归档'
          ],
          pitfalls: [
            '员工减员当月仍产生费用 → 结清后才能注销',
            '漏缴公积金 → 注销被拒，回头补缴'
          ],
          advisory: {
            regional: '线上渠道各地不同（人社 APP / 政务服务网），窗口办理需预约。',
            time: '减员与费用结清的截止日各地不同，先查当地缴费周期。'
          }
        }
      ]
    },
    {
      id: 'p5', name: '五 · 注销登记与归档', steps: [
        {
          id: 's9', title: '申请注销登记（缴销营业执照）', risk: 'irreversible',
          oneLiner: '向登记机关申请注销登记、缴销营业执照——公司法人资格终止的终点。',
          meta: { 地点: '登记机关窗口 / 一网通办', 周期: '材料齐全当场至 3 个工作日', 费用: '0' },
          points: [
            '材料：注销登记申请书、股东会决议、清税证明、清算报告、营业执照正副本',
            '清算报告须经股东会确认',
            '取得《注销核准通知书》——公司法人资格自此终止'
          ],
          preflight: [
            '清算报告已经股东会确认',
            '清税证明原件在册',
            '营业执照正副本齐全（遗失的已先行公示）'
          ],
          pitfalls: [
            '营业执照遗失未先行公示 → 退回',
            '清算报告与账实不符 → 股东承担赔偿责任'
          ],
          consequence: '核准注销后，公司法人资格终止，不可恢复。此后以公司名义的一切行为均无效且违法；未发现的债权债务由清算组成员按过错承担责任。',
          recovery: {
            before: '尚未提交：材料可随时补充修改。对清算报告有疑虑，先审计再提交是可逆的保护动作。',
            after: '已核准：法人资格不可恢复。唯一「补救」是对未发现的债权债务，清算组成员在剩余财产分配范围内继续承担责任——所以这一步之前请完成全部核对。'
          },
          confirm: {
            promises: [
              '我已确认清算报告真实、完整，并经股东会确认',
              '我已确认清税证明、营业执照正副本等材料齐全',
              '我已理解：核准后公司法人资格终止，不可恢复'
            ],
            typed: true
          }
        },
        {
          id: 's10', title: '印章缴销与档案归档', risk: 'normal',
          oneLiner: '向公安机关缴销全部备案印章，归档注销文件与账簿——全程收尾。',
          meta: { 地点: '公安指定刻章点 / 治安管理窗口', 周期: '半日', 费用: '0' },
          points: [
            '缴销公章、财务章、合同章等全部备案印章',
            '归档清单：决议、公告、清税证明、注销核准通知书、销户回执',
            '账簿凭证依法保存 10 年以上'
          ],
          preflight: [
            '全部备案印章已收齐并办理缴销',
            '归档清单逐项核对完毕',
            '账簿凭证已装箱并标注保存年限'
          ],
          pitfalls: [
            '印章遗落在外流转 → 法律风险',
            '注销文件散失 → 日后应诉、审计无据可依'
          ],
          advisory: {
            regional: '缴销渠道各地不同，多数地区可在政务网预约。',
            time: '账簿保存期自清算完结之日起算。'
          }
        }
      ]
    }
  ]
};

/* ---------------------------------------------------------------- 状态 -- */

function freshState() {
  return {
    done: new Set(),          // 已完成步骤 id
    skipped: new Set(),       // 不适用（分支淘汰）步骤 id
    checked: {},              // stepId -> [bool, ...] 前置自查
    branch: null,             // 'fast' | 'general' | null
    view: null,               // 预览的步骤 id（null = 跟随当前）
    modal: null,              // {kind:'confirm', stepId} | {kind:'reset'}
    drawer: false
  };
}

let S = freshState();

const allSteps = FLOW.phases.flatMap(p => p.steps);
const stepById = id => allSteps.find(s => s.id === id);
const TOTAL = allSteps.length;

function currentIndex() {
  for (let i = 0; i < allSteps.length; i++) {
    const s = allSteps[i];
    if (!S.done.has(s.id) && !S.skipped.has(s.id)) return i;
  }
  return -1; // 全部办结
}
const currentStep = () => { const i = currentIndex(); return i === -1 ? null : allSteps[i]; };

function stepStatus(s) {
  if (S.done.has(s.id)) return 'done';
  if (S.skipped.has(s.id)) return 'skipped';
  const cur = currentStep();
  if (cur && cur.id === s.id) return 'current';
  if (s.branchKey && S.branch && s.branchKey !== S.branch) return 'skipped';
  return 'locked';
}

const isIrrev = s => s.risk === 'irreversible';
const checkedAll = s => {
  const arr = S.checked[s.id];
  if (!s.preflight) return true;
  if (!arr) return false;
  return s.preflight.every((_, i) => arr[i]);
};

function progress() {
  const total = TOTAL - S.skipped.size;
  const done = S.done.size;
  return { done, total, pct: total ? Math.round(done / total * 100) : 100 };
}

/* ---------------------------------------------------------------- 工具 -- */

const $ = sel => document.querySelector(sel);
const esc = t => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const ICON = {
  check: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4.5 10.5l3.6 3.6 7.4-8.2" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  lock: '<svg viewBox="0 0 20 20" aria-hidden="true"><rect x="4.5" y="8.5" width="11" height="7.5" rx="1.6" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M7 8.5V6.8a3 3 0 016 0v1.7" fill="none" stroke="currentColor" stroke-width="1.7"/></svg>',
  dot: '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="3.2" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
  play: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M7 5.4v9.2l7.2-4.6z" fill="currentColor"/></svg>',
  ban: '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="6.2" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M5.6 5.6l8.8 8.8" stroke="currentColor" stroke-width="1.7"/></svg>',
  alert: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 3.4l7.2 12.8H2.8z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M10 8v3.4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><circle cx="10" cy="13.8" r="1" fill="currentColor"/></svg>',
  undo: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4.5 8.5H12a3.8 3.8 0 110 7.6H8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M7.5 5.2L4.2 8.5l3.3 3.3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  book: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 4.8A1.8 1.8 0 015.8 3h9.4v12.4H6a2 2 0 00-2 2z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M4 15.4a2 2 0 012-2h7.2" fill="none" stroke="currentColor" stroke-width="1.7"/></svg>',
  flag: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 17V3.6h9l-2.2 3.6L14 10.8H5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>'
};

const RISK_LABEL = { normal: '常规', irreversible: '不可逆', gate: '判定' };

function metaChips(s) {
  return Object.entries(s.meta || {})
    .map(([k, v]) => `<span class="chip"><b>${esc(k)}</b>${esc(v)}</span>`).join('');
}

/* ---------------------------------------------------------------- 渲染 -- */

function render() {
  try {
    renderProgress();
    renderRail();
    renderDetail();
    renderDrawer();
    $('#app').dataset.appState = 'ready';
  } catch (err) {
    $('#app').dataset.appState = 'error';
    $('#detail').innerHTML = `
      <div class="card error-card">
        <h2>出了点问题</h2>
        <p>演练数据渲染失败：${esc(err && err.message || err)}</p>
        <button type="button" class="btn primary" onclick="location.reload()">重新加载</button>
      </div>`;
  }
}

function renderProgress() {
  const p = progress();
  $('#progressText').textContent = `${p.done}/${p.total}`;
  $('#progressFill').style.width = p.pct + '%';
  $('#progressBar').setAttribute('aria-valuenow', String(p.pct));
}

function renderRail() {
  const cur = currentStep();
  const viewId = S.view || (cur ? cur.id : null);
  let html = '';
  for (const phase of FLOW.phases) {
    const sts = phase.steps;
    const doneN = sts.filter(s => S.done.has(s.id) || S.skipped.has(s.id)).length;
    const active = sts.some(s => s.id === viewId);
    html += `<div class="phase ${active ? 'phase-active' : ''}">
      <div class="phase-head">
        <span class="phase-name">${esc(phase.name)}</span>
        <span class="phase-count">${doneN}/${sts.length}</span>
      </div>
      <ol class="step-list">`;
    for (const s of sts) {
      const st = stepStatus(s);
      const icon = st === 'done' ? ICON.check : st === 'current' ? ICON.play : st === 'skipped' ? ICON.ban : st === 'locked' ? ICON.lock : ICON.dot;
      const irrev = isIrrev(s) ? '<span class="mini-badge danger-mini">不可逆</span>' : '';
      const title = st === 'skipped' ? `${esc(s.title)}（不适用）` : esc(s.title);
      html += `<li>
        <button type="button" class="step-row st-${st} ${s.id === viewId ? 'row-selected' : ''}"
          data-step="${s.id}" tabindex="${s.id === viewId ? '0' : '-1'}" ${cur && s.id === cur.id ? 'aria-current="step"' : ''}>
          <span class="st-icon">${icon}</span>
          <span class="st-body"><span class="st-title">${title}</span>${irrev}</span>
        </button>
      </li>`;
    }
    html += '</ol></div>';
  }
  $('#rail').innerHTML = html;
}

function renderDetail() {
  const cur = currentStep();
  const box = $('#detail');

  if (!cur) { box.innerHTML = summaryHTML(); return; }

  const s = stepById(S.view || cur.id);
  const isCurrent = s.id === cur.id;
  const st = stepStatus(s);
  const gateInfo = s.risk === 'gate' ? gateAdoption(s) : null;

  const banner = !isCurrent
    ? (st === 'done'
        ? `<div class="banner banner-done">${ICON.check} 此步已完成。内容仅供回看；不可逆步骤的“执行后补救”仍在下方。</div>`
        : st === 'skipped'
          ? `<div class="banner banner-skip">${ICON.ban} 此步为「不适用」（路径判定未选择该通道）。仅供对照。</div>`
          : `<div class="banner banner-lock">${ICON.lock} 此步尚未解锁：按序完成前面的步骤后才能执行。预览仅供参考。</div>`)
    : '';

  const preflightHTML = s.preflight ? `
    <section class="card">
      <h3 class="sec-title">${ICON.check} 前置自查 <span class="sec-hint" id="preflightHint">${preflightCount(s)}</span></h3>
      <div class="check-list" id="preflightList">
        ${s.preflight.map((t, i) => `
          <label class="check-row">
            <input type="checkbox" data-preflight="${i}" ${!isCurrent ? 'disabled' : ''} ${(S.checked[s.id] || [])[i] ? 'checked' : ''}>
            <span>${esc(t)}</span>
          </label>`).join('')}
      </div>
    </section>` : '';

  const riskHTML = isIrrev(s) ? `
    <section class="card danger-card">
      <h3 class="sec-title danger">${ICON.alert} 不可逆 · 执行前必读</h3>
      <p class="danger-text">${esc(s.consequence)}</p>
      <div class="recovery-grid">
        <div class="recovery-cell">
          <h4>${ICON.undo} 恢复路径 · 执行前</h4>
          <p>${esc(s.recovery.before)}</p>
        </div>
        <div class="recovery-cell">
          <h4>${ICON.flag} 恢复路径 · 执行后</h4>
          <p>${esc(s.recovery.after)}</p>
        </div>
      </div>
      <button type="button" class="btn link" id="btnOpenHandbookFromStep">在恢复手册中查看全部节点 →</button>
    </section>` : '';

  const advisoryHTML = (s.advisory && (s.advisory.regional || s.advisory.time)) ? `
    <section class="advisory">
      <h3 class="sec-title small">口径提示</h3>
      ${s.advisory.regional ? `<p><b>地区差异</b>${esc(s.advisory.regional)}</p>` : ''}
      ${s.advisory.time ? `<p><b>时效</b>${esc(s.advisory.time)}</p>` : ''}
    </section>` : '';

  const pitfallsHTML = s.pitfalls ? `
    <section class="card">
      <h3 class="sec-title">${ICON.alert} 易错点</h3>
      <ul class="plain-list">${s.pitfalls.map(t => `<li>${esc(t)}</li>`).join('')}</ul>
    </section>` : '';

  const gateHTML = s.risk === 'gate' ? `
    <section class="card gate-card">
      <h3 class="sec-title">${ICON.dot} 路径判定</h3>
      <p class="gate-intro">${esc(s.gate.intro)}</p>
      ${s.gate.questions.map((q, i) => `
        <fieldset class="gate-q">
          <legend>${esc(q.text)}</legend>
          <label><input type="radio" name="gq-${i}" data-gq="${i}" value="no" ${!isCurrent ? 'disabled' : ''}> 否</label>
          <label><input type="radio" name="gq-${i}" data-gq="${i}" value="yes" ${!isCurrent ? 'disabled' : ''}> 是</label>
        </fieldset>`).join('')}
      <div class="gate-result" id="gateResult">${gateInfo ? gateResultHTML(s, gateInfo) : '<span class="gate-hint">回答全部三问后给出推荐通道。</span>'}</div>
    </section>` : '';

  const actionHTML = isCurrent ? `
    <div class="action-bar">
      <p class="action-hint" id="actionHint">${actionHint(s)}</p>
      <button type="button" class="btn primary ${isIrrev(s) ? 'btn-danger' : ''}" id="btnComplete" ${canComplete(s) ? '' : 'disabled'}>
        ${isIrrev(s) ? '确认并完成本步' : s.risk === 'gate' ? '采纳推荐并继续' : '完成本步'}
      </button>
    </div>` : '';

  const stepNo = allSteps.indexOf(s) + 1;

  box.innerHTML = `
    ${banner}
    <header class="detail-head">
      <p class="detail-kicker">第 ${stepNo} 步 · 共 ${TOTAL} 步</p>
      <h2 class="detail-title">${esc(s.title)}</h2>
      <p class="detail-oneliner">${esc(s.oneLiner)}</p>
      <div class="chips">
        <span class="chip risk-${s.risk}">${RISK_LABEL[s.risk]}${s.branchKey ? ` · ${FLOW.meta.product === '办结' ? '分支' : ''}` : ''}</span>
        ${metaChips(s)}
      </div>
    </header>
    <section class="card">
      <h3 class="sec-title">${ICON.book} 办理要点</h3>
      <ul class="plain-list">${s.points.map(t => `<li>${esc(t)}</li>`).join('')}</ul>
    </section>
    ${gateHTML}
    ${preflightHTML}
    ${riskHTML}
    ${pitfallsHTML}
    ${advisoryHTML}
    ${actionHTML}`;
}

function preflightCount(s) {
  const arr = S.checked[s.id] || [];
  const n = s.preflight.filter((_, i) => arr[i]).length;
  return `${n}/${s.preflight.length}`;
}

function gateAnswers() {
  return [0, 1, 2].map(i => {
    const el = document.querySelector(`input[data-gq="${i}"]:checked`);
    return el ? el.value : null;
  });
}

function gateCompute(answers) {
  if (answers.some(a => a === 'yes')) return 'general';
  if (answers.every(a => a === 'no')) return 'fast';
  return null;
}

function gateAdoption() { return S.branch; }

function gateResultHTML(s, adopted) {
  const b = s.gate.branches[adopted];
  return `<span class="gate-pick">推荐通道：<b>${esc(b.label)}</b> — ${esc(b.why)}</span>`;
}

function actionHint(s) {
  if (!checkedAll(s)) return '完成前置自查后才能执行本步。';
  if (s.risk === 'gate') return '请先完成上面的判定并采纳推荐。';
  if (isIrrev(s)) return '本步不可逆：点击后将进入确认仪式。';
  return '确认无误后完成本步。';
}

function canComplete(s) {
  if (s.risk === 'gate') return gateCompute(gateAnswers()) !== null && checkedAll(s);
  return checkedAll(s);
}

/* ---------------------------------------------------------------- 办结 -- */

function summaryHTML() {
  const irrevDone = allSteps.filter(s => isIrrev(s) && S.done.has(s.id));
  return `
    <div class="summary">
      <div class="summary-badge">${ICON.check}</div>
      <h2>全程办结</h2>
      <p class="summary-sub">${esc(FLOW.meta.company)} 注销演练完成</p>
      <div class="summary-stats">
        <span class="chip"><b>${S.done.size}</b>步完成</span>
        <span class="chip"><b>${irrevDone.length}</b>次不可逆确认</span>
        <span class="chip"><b>0</b>次跳步</span>
      </div>
      <section class="card">
        <h3 class="sec-title">${ICON.check} 不可逆节点 · 均经确认仪式执行</h3>
        <ul class="plain-list">${irrevDone.map(s => `<li>${esc(s.title)} <span class="mini-badge ok-mini">已确认</span></li>`).join('')}</ul>
      </section>
      <section class="card">
        <h3 class="sec-title">${ICON.book} 归档清单（收尾核对）</h3>
        <ul class="plain-list">
          <li>解散决议、清算组备案回执</li>
          <li>债权人公告截图与送达凭证</li>
          <li>《清税证明》原件</li>
          <li>银行销户回执、社保公积金注销回执</li>
          <li>《注销核准通知书》、印章缴销凭证</li>
          <li>账簿凭证（保存 10 年以上）</li>
        </ul>
      </section>
      <button type="button" class="btn ghost" id="btnReset2">重置演练</button>
    </div>`;
}

/* -------------------------------------------------------- 抽屉（恢复手册） -- */

function renderDrawer() {
  const irrev = allSteps.filter(isIrrev);
  $('#drawerBody').innerHTML = irrev.map(s => {
    const st = S.done.has(s.id) ? '<span class="mini-badge ok-mini">已执行</span>' : '<span class="mini-badge">未执行</span>';
    return `
      <section class="hb-item">
        <header><h3>${esc(s.title)}</h3>${st}</header>
        <div class="recovery-grid single">
          <div class="recovery-cell"><h4>${ICON.undo} 执行前撤回</h4><p>${esc(s.recovery.before)}</p></div>
          <div class="recovery-cell"><h4>${ICON.flag} 执行后补救</h4><p>${esc(s.recovery.after)}</p></div>
        </div>
      </section>`;
  }).join('') + `<p class="drawer-note">${esc(FLOW.meta.disclaimer)}</p>`;
}

function openDrawer() {
  S.drawer = true;
  $('#drawerWrap').hidden = false;
  document.body.classList.add('no-scroll');
  $('#drawerClose').focus();
}
function closeDrawer() {
  if (!S.drawer) return;
  S.drawer = false;
  $('#drawerWrap').hidden = true;
  document.body.classList.remove('no-scroll');
  $('#btnHandbook').focus();
}

/* ---------------------------------------------------------------- 模态 -- */

let lastFocus = null;

function openModal(html, onMount) {
  lastFocus = document.activeElement;
  S.modal = true;
  $('#modal').innerHTML = html;
  $('#modalWrap').hidden = false;
  document.body.classList.add('no-scroll');
  if (onMount) onMount();
}

function closeModal() {
  if (!S.modal) return;
  S.modal = null;
  $('#modalWrap').hidden = true;
  $('#modal').innerHTML = '';
  document.body.classList.remove('no-scroll');
  if (lastFocus && document.contains(lastFocus)) lastFocus.focus();
}

function confirmModalHTML(s) {
  const typed = s.confirm.typed ? `
    <label class="typed-label" for="typedName">输入公司全名以确认：<b>${esc(FLOW.meta.company)}</b></label>
    <input type="text" id="typedName" class="typed-input" autocomplete="off" spellcheck="false" placeholder="输入公司全名">` : '';
  return `
    <div class="modal-head danger">
      ${ICON.alert}
      <h2 id="modalTitle">确认仪式 · ${esc(s.title)}</h2>
    </div>
    <p class="modal-lede danger-text">${esc(s.consequence)}</p>
    <div class="modal-recovery">
      <p><b>${ICON.undo} 执行前</b>${esc(s.recovery.before)}</p>
      <p><b>${ICON.flag} 执行后</b>${esc(s.recovery.after)}</p>
    </div>
    <div class="modal-promises">
      ${s.confirm.promises.map((t, i) => `
        <label class="check-row">
          <input type="checkbox" data-promise="${i}">
          <span>${esc(t)}</span>
        </label>`).join('')}
    </div>
    ${typed}
    <div class="modal-actions">
      <button type="button" class="btn ghost" data-close-modal-btn>取消（Esc）</button>
      <button type="button" class="btn primary btn-danger" id="btnConfirmIrrev" disabled>我已确认，执行</button>
    </div>`;
}

function resetModalHTML() {
  return `
    <div class="modal-head">
      <h2 id="modalTitle">重置演练？</h2>
    </div>
    <p class="modal-lede">将清空当前演练进度，回到第 1 步。此操作可逆（重新走一遍即可），但进度不会保留。</p>
    <div class="modal-actions">
      <button type="button" class="btn ghost" data-close-modal-btn>取消（Esc）</button>
      <button type="button" class="btn primary btn-danger" id="btnConfirmReset">重置</button>
    </div>`;
}

function syncConfirmButton(s) {
  const btn = $('#btnConfirmIrrev');
  if (!btn) return;
  const all = s.confirm.promises.every((_, i) => {
    const el = document.querySelector(`input[data-promise="${i}"]`);
    return el && el.checked;
  });
  const typedOk = !s.confirm.typed || ($('#typedName') && $('#typedName').value.trim() === FLOW.meta.company);
  btn.disabled = !(all && typedOk);
}

/* ---------------------------------------------------------------- 事件 -- */

function completeStep(s) {
  if (isIrrev(s)) {
    openModal(confirmModalHTML(s), () => {
      // 用 on* 属性而非 addEventListener：避免多次打开模态时监听器累积
      $('#modal').onchange = e => {
        if (e.target.matches('input[data-promise]')) syncConfirmButton(s);
      };
      $('#modal').oninput = e => {
        if (e.target.id === 'typedName') syncConfirmButton(s);
      };
      $('#btnConfirmIrrev').addEventListener('click', () => {
        S.done.add(s.id);
        closeModal();
        S.view = null;
        render();
        const ncu = currentStep();
        if (ncu) $('#detail').focus();
      });
      const first = $('#modal input[data-promise="0"]');
      if (first) first.focus(); else $('#typedName') && $('#typedName').focus();
    });
    return;
  }
  S.done.add(s.id);
  if (s.risk === 'gate') {
    const pick = gateCompute(gateAnswers());
    if (pick) {
      S.branch = pick;
      const other = Object.values(s.gate.branches).find(b => b.stepId !== s.gate.branches[pick].stepId);
      S.skipped.add(other.stepId);
    }
  }
  S.view = null;
  render();
  if (!currentStep()) $('#detail').focus();
}

function bind() {
  // 顶栏
  $('#btnHandbook').addEventListener('click', openDrawer);
  $('#drawerClose').addEventListener('click', closeDrawer);
  document.querySelector('[data-close-drawer]').addEventListener('click', closeDrawer);
  $('#btnReset').addEventListener('click', () => openModal(resetModalHTML(), () => {
    $('#btnConfirmReset').addEventListener('click', () => { S = freshState(); closeModal(); render(); $('#detail').focus(); });
  }));

  // 主区事件委托
  $('#rail').addEventListener('click', e => {
    const row = e.target.closest('[data-step]');
    if (row) { S.view = row.dataset.step; render(); }
  });

  // 层级轨 roving tabindex：←↑↓ 键在步骤间移动选择（单一 Tab 停靠点）
  $('#rail').addEventListener('keydown', e => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const cur = currentStep();
    const viewId = S.view || (cur ? cur.id : allSteps[allSteps.length - 1].id);
    let i = allSteps.findIndex(s => s.id === viewId);
    i = e.key === 'ArrowDown' ? Math.min(i + 1, allSteps.length - 1) : Math.max(i - 1, 0);
    S.view = allSteps[i].id;
    render();
    const row = document.querySelector(`[data-step="${S.view}"]`);
    if (row) row.focus();
  });

  $('#detail').addEventListener('click', e => {
    if (e.target.closest('#btnOpenHandbookFromStep')) { openDrawer(); return; }
    if (e.target.closest('#btnReset2')) { $('#btnReset').click(); return; }
    if (e.target.closest('#btnComplete')) {
      const cur = currentStep();
      if (cur && canComplete(cur)) completeStep(cur);
      return;
    }
  });

  $('#detail').addEventListener('change', e => {
    const cur = currentStep();
    if (!cur) return;
    if (e.target.matches('input[data-preflight]')) {
      const arr = S.checked[cur.id] || (S.checked[cur.id] = []);
      arr[Number(e.target.dataset.preflight)] = e.target.checked;
      const hint = $('#preflightHint'); if (hint) hint.textContent = preflightCount(cur);
      const btn = $('#btnComplete');
      if (btn) btn.disabled = !canComplete(cur);
      const ah = $('#actionHint'); if (ah) ah.textContent = actionHint(cur);
      return;
    }
    if (e.target.matches('input[data-gq]')) {
      const answers = gateAnswers();
      const pick = gateCompute(answers);
      const res = $('#gateResult');
      if (res) res.innerHTML = pick
        ? gateResultHTML(cur, pick)
        : '<span class="gate-hint">还有未回答的问题。</span>';
      const btn = $('#btnComplete');
      if (btn) btn.disabled = !canComplete(cur);
      const ah = $('#actionHint'); if (ah) ah.textContent = actionHint(cur);
    }
  });

  // 模态
  $('#modalWrap').addEventListener('click', e => {
    if (e.target.closest('[data-close-modal-btn]')) closeModal();
  });
  document.querySelector('[data-close-modal]').addEventListener('click', closeModal);

  // Esc：先关模态，再关抽屉
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (S.modal) { closeModal(); return; }
    if (S.drawer) closeDrawer();
  });

  // 模态内 Tab 焦点圈定
  $('#modalWrap').addEventListener('keydown', e => {
    if (e.key !== 'Tab') return;
    const focusables = $('#modal').querySelectorAll('button, input, [href]');
    if (!focusables.length) return;
    const first = focusables[0], last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) { last.focus(); e.preventDefault(); }
    else if (!e.shiftKey && document.activeElement === last) { first.focus(); e.preventDefault(); }
  });
}

/* ---------------------------------------------------------------- 启动 -- */

bind();
render(); // 数据随脚本内联，DOM 就绪即同步渲染首屏——无加载态
