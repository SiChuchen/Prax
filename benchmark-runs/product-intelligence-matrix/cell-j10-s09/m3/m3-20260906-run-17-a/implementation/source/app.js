'use strict';

/* ============================================================
   RELEASEROOM · 发版指挥台
   cell-j10-s09 · complete × consequential-flow
   用户任务：零失误走完一个高后果发布流程；
   不可逆步骤（全量发布 / 密封回滚窗口）执行前强制确认、
   执行后提供回滚恢复路径，直至窗口被密封。
   所有数据随首屏内联 — 无任何异步加载。
   ============================================================ */

const FLOW = {
  meta: {
    product: 'checkout-api',
    version: 'v2.14.0',
    prev: 'v2.13.7',
    env: 'PRODUCTION',
    windowText: '今日 14:00–15:00 · UTC+8',
    instances: 48,
  },
  stages: [
    { id:'A', title:'预检',      goal:'发布前事实核对 — 全部通过才可进入灰度', steps:['a1','a2','a3'] },
    { id:'B', title:'灰度验证',  goal:'5% 灰度采集 7 个采样周期，指标达标后闭合', steps:['b1','b2'] },
    { id:'C', title:'全量发布',  goal:'执行不可逆切换 — 强制确认前置 + 回滚窗口兜底', steps:['c1','c2'], irreversible:true },
    { id:'D', title:'验证与收尾', goal:'冒烟通过 → 密封回滚窗口 → 归档', steps:['d1','d2','d3'] },
  ],
  steps: {
    a1:{stage:'A',kind:'check',title:'确认 CI 主干绿灯',desc:'主发布流水线全部通过，质量门禁无豁免。',
      ev:['流水线 release/2.14.0 · #4821 — 通过','测试 217/217 · 覆盖率 84.3%（门禁 ≥ 82%）','镜像 sha256:9f21c…e04b 已归档']},
    a2:{stage:'A',kind:'check',title:'发布公告已发出',desc:'#announce 已通知窗口、影响范围与回滚预案。',
      ev:['接收方：业务方 · 客服 · 支付网关','预期影响：发布期间下单延迟 +200ms 以内']},
    a3:{stage:'A',kind:'check',title:'与值班 SRE 完成对齐',desc:'值班知悉窗口；回滚预案已于昨日演练通过。',
      ev:['值班 SRE：已应答（09:12）','回滚演练 2026-09-08：通过 · 耗时 9m12s']},
    b1:{stage:'B',kind:'action',title:'部署 5% 灰度',desc:'12 台实例切入 v2.14.0，其余 36 台保持 v2.13.7。此步可逆 — 确认灰度前可撤销重做。',
      runLabel:'部署 5% 灰度',undoLabel:'撤销灰度（可逆）',
      lines:['解析镜像 sha256:9f21c…e04b','实例替换 4/12','实例替换 8/12','实例替换 12/12 · 健康检查通过'],
      doneText:'canary 5% 已部署 · 12/12 实例就绪'},
    b2:{stage:'B',kind:'observe',title:'观察灰度指标 · 7 个采样周期',desc:'逐周期采集错误率与 p99。7/7 达标后由你确认闭合 — 证据不足时确认将记一次失误。',
      confirmLabel:'确认灰度达标 · 闭合阶段'},
    c1:{stage:'C',kind:'gate',title:'全量发布前置核对',desc:'三项全部勾选后，发布进入待命。此步可逆 — 未执行前可反复核对修改。',
      checks:[
        {id:'c1a',text:'灰度 7/7 采样达标，当前无未处理 P2 以上告警'},
        {id:'c1b',text:'客服与支付侧已再次知情（近 10 分钟内）'},
        {id:'c1c',text:'回滚预案就绪：v2.13.7 镜像已在全部实例预热'}],
      armedText:'前置核对完成 · 发布待命'},
    c2:{stage:'C',kind:'irrev',title:'执行全量发布',desc:'48 台实例全部切换至 v2.14.0。不可逆 — 执行前强制确认；执行后回滚窗口保持开启，直至 D 阶段密封。',
      doneText:'已执行 · 48/48 实例上线 v2.14.0',
      lockedHint:'前置核对未完成 — 未待命时尝试执行将记一次失误'},
    d1:{stage:'D',kind:'action',title:'生产冒烟测试',desc:'核心链路 3 项探针。运行通过后需你确认。',
      runLabel:'运行冒烟测试',confirmLabel:'确认冒烟通过',
      lines:['GET / → 200 · 183ms','POST /order → 200 · 241ms','POST /pay/notify → 200 · 167ms'],
      doneText:'冒烟 3/3 通过 · 已确认'},
    d2:{stage:'D',kind:'irrev',title:'密封回滚窗口',desc:'密封后回滚入口永久关闭 — 同样不可逆。密封之前，回滚始终可用。',
      doneText:'回滚窗口已密封 · 恢复入口永久关闭',
      lockedHint:'需先完成 D1 冒烟确认 — 未满足时尝试将记一次失误'},
    d3:{stage:'D',kind:'check',title:'发布公告与复盘归档',desc:'对外公告切换为「已上线」，复盘纪要归档至 runbook。',
      ev:['公告状态：已上线（发布前草稿已归档）','复盘纪要：RUNBOOK/release-2.14.0']},
  },
};

const ORDER = ['a1','a2','a3','b1','b2','c1','c2','d1','d2','d3'];
const ERR   = [0.08, 0.12, 0.11, 0.48, 0.15, 0.09, 0.07];   // 错误率 %
const P99   = [212, 198, 221, 486, 203, 189, 194];           // p99 ms
const ERR_T = 0.5, P99_T = 500;

const $ = s => document.querySelector(s);

/* ---------- 状态 ---------- */
let STATE_SEQ = 0;
let S;
function freshState(){
  return {
    seq: ++STATE_SEQ,
    done: new Set(),
    c1: { c1a:false, c1b:false, c1c:false },
    canarySamples: [], canaryP99: [],
    smoke: { run:false },
    win: { openAt:null, sealed:false },
    counts: { rollout:0, rollback:0 },
    mistakes: [], log: [],
    view:'A', follow:true,
    startAt: Date.now(),
    finished:false, overlayClosed:false,
    running:false, resetArm:false, resetArmUntil:0,
  };
}

/* ---------- 派生 ---------- */
const stageById    = id => FLOW.stages.find(s => s.id === id);
const stageSteps   = id => stageById(id).steps;
const stepDone     = id => S.done.has(id);
const stageComplete= id => stageSteps(id).every(stepDone);
const stageActive  = id => FLOW.stages.slice(0, FLOW.stages.findIndex(s => s.id === id)).every(st => stageComplete(st.id));
const c1Armed      = () => S.c1.c1a && S.c1.c1b && S.c1.c1c;
function currentStageId(){ return (FLOW.stages.find(s => !stageComplete(s.id)) || FLOW.stages[3]).id; }
const elapsed = () => Math.floor((Date.now() - S.startAt) / 1000);
const mmss    = s => String(Math.floor(s/60)).padStart(2,'0') + ':' + String(s%60).padStart(2,'0');
const stepNo  = id => ORDER.indexOf(id) + 1;

/* ---------- 反馈 ---------- */
function addLog(kind, text){ S.log.push({ t:mmss(elapsed()), kind, text }); renderLog(); }
function toast(text, kind){
  const el = document.createElement('div');
  el.className = 'toast ' + (kind || 'info');
  el.textContent = text;
  $('#toasts').appendChild(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 320); }, 2700);
}
function mistake(text, stepId){
  S.mistakes.push({ t:mmss(elapsed()), text, step:stepId || '' });
  addLog('warn', '失误 +1 — ' + text);
  toast('失误 +1 · ' + text, 'danger');
  renderChips();
}
function shake(id){
  const el = document.getElementById('step-' + id);
  if(!el) return;
  el.classList.remove('shake'); void el.offsetWidth;
  el.classList.add('shake');
  setTimeout(() => el.classList.remove('shake'), 500);
}

/* ---------- 带进度的模拟执行 ---------- */
function runWithLines(stepId, label, lines, done){
  if(S.running){ toast('操作进行中，请稍候'); return; }
  S.running = true;
  const box = document.getElementById('run-' + stepId);
  if(box) box.innerHTML = '<div class="rline head">▸ ' + label + '</div>';
  const seq0 = S.seq;
  let i = 0;
  const iv = setInterval(() => {
    if(S.seq !== seq0){ clearInterval(iv); S.running = false; return; }
    if(i < lines.length){
      if(box) box.insertAdjacentHTML('beforeend', '<div class="rline">▸ ' + lines[i++] + '</div>');
    } else {
      clearInterval(iv); S.running = false; done();
    }
  }, 380);
}

/* ---------- 渲染 ---------- */
function renderChips(){
  const stagesDone = FLOW.stages.filter(stageComplete).length;
  const mtitle = S.mistakes.length ? S.mistakes.map(m => m.t + ' ' + m.text).join('；') : '当前零失误';
  $('#chips').innerHTML =
    '<span class="chip mono">' + FLOW.meta.product + ' · ' + FLOW.meta.version + '</span>' +
    '<span class="chip">' + FLOW.meta.env + ' · ' + FLOW.meta.windowText + '</span>' +
    '<span class="chip ' + (S.mistakes.length ? 'bad' : 'good') + '" id="mistakeChip" title="' + mtitle + '">失误 ' + S.mistakes.length + '</span>' +
    '<span class="chip">' + S.done.size + '/10 步 · 阶段 ' + stagesDone + '/4</span>' +
    '<span class="chip mono" id="clock">' + mmss(elapsed()) + '</span>' +
    '<button class="btn ghost sm" data-action="reset" id="resetBtn">重置演练</button>';
  $('#pfill').style.width = (S.done.size / ORDER.length * 100) + '%';
}

function renderNav(){
  $('#nav').innerHTML = FLOW.stages.map(s => {
    const done = stageComplete(s.id), act = stageActive(s.id);
    const cls = done ? 'done' : act ? 'cur' : 'lock';
    return '<button class="nv ' + cls + (s.id === S.view ? ' sel' : '') + '" data-action="nav-stage" data-stage="' + s.id + '">' +
      '<span class="nv-l ' + cls + '">' + s.id + '</span>' +
      '<span class="nv-t">' + s.title + (s.irreversible ? '<i class="nv-w">不可逆</i>' : '') + '</span>' +
      '<span class="nv-c">' + s.steps.filter(stepDone).length + '/' + s.steps.length + '</span></button>';
  }).join('');
}

function renderLog(){
  const ol = $('#log');
  if(!ol) return;
  ol.innerHTML = S.log.slice(-70).map(l =>
    '<li class="' + l.kind + '"><span class="lt">' + l.t + '</span><span>' + l.text + '</span></li>').join('');
  ol.scrollTop = ol.scrollHeight;
}

function renderBanner(){
  if(S.win.sealed)
    return '<div class="banner sealed">🔒 回滚窗口已密封 — v2.14.0 进入稳定运行，恢复入口已永久关闭</div>';
  if(S.win.openAt){
    const s = Math.floor((Date.now() - S.win.openAt) / 1000);
    return '<div class="banner open"><div><b>↺ 回滚窗口开启中</b> · 已开启 <span class="mono" id="btime">' + mmss(s) + '</span>' +
      ' — 密封前可随时回滚至 ' + FLOW.meta.prev + '</div>' +
      '<button class="btn recov" data-action="rollback">回滚发布（恢复路径）</button></div>';
  }
  return '';
}

function checkToggleAllowed(id){
  if(!stageActive(FLOW.steps[id].stage)) return false;
  if(id === 'd3') return !S.finished;
  return !stageComplete(FLOW.steps[id].stage);
}

function stepBody(id){
  const st = FLOW.steps[id], done = stepDone(id);

  if(st.kind === 'check'){
    let h = '<ul class="ev">' + st.ev.map(x => '<li>' + x + '</li>').join('') + '</ul>';
    const allowed = checkToggleAllowed(id);
    h += '<div class="btnrow">' + (done
      ? '<span class="doneline inline">✔ 已核对</span>' + (allowed ? '<button class="btn ghost sm" data-action="toggle-check" data-step="' + id + '">撤销核对</button>' : '')
      : '<button class="btn primary" data-action="toggle-check" data-step="' + id + '">我已核对 → 标记完成</button>') + '</div>';
    return h;
  }

  if(id === 'b1'){
    let h = '';
    if(done){
      h += '<p class="doneline">✔ ' + st.doneText + '</p>';
      if(!stepDone('b2')) h += '<div class="btnrow"><button class="btn ghost sm" data-action="undo-b1">' + st.undoLabel + '</button></div>';
    } else {
      h += '<div class="btnrow"><button class="btn" data-action="run-b1">' + st.runLabel + '</button></div>' +
           '<p class="hint">此步可逆 — 确认灰度达标之前可撤销重做</p>';
    }
    return h + '<div id="run-b1" class="rlines"></div>';
  }

  if(id === 'b2'){
    const n = S.canarySamples.length;
    let h = '<div class="metrics"><div class="mrow"><span>周期</span><span>错误率（阈值 &lt;0.5%）</span><span>p99（&lt;500ms）</span></div>';
    for(let i = 0; i < n; i++){
      const w = ERR[i] >= ERR_T || P99[i] >= P99_T;
      h += '<div class="mrow' + (w ? ' warn' : '') + '"><span>#' + (i+1) + '</span><span>' + ERR[i].toFixed(2) + '%</span><span>' + P99[i] + 'ms</span></div>';
    }
    h += '</div>';
    if(!done){
      h += '<div class="btnrow">' +
        '<button class="btn ghost" data-action="sample"' + (n >= 7 ? ' disabled' : '') + '>' + (n < 7 ? '采集采样周期（' + n + '/7）' : '采样完成 7/7') + '</button>' +
        '<button class="btn ' + (n >= 7 ? 'ok' : 'ghost') + '" data-action="confirm-b2">' + st.confirmLabel + '</button></div>';
      if(n > 0 && n < 7) h += '<p class="hint bad">证据不足时确认将记一次失误</p>';
      if(n >= 4 && n < 7) h += '<p class="hint warnnote">第 4 周期 0.48% 逼近阈值、p99 486ms 抬升 — 第 5 周期已回落，判定为抖动</p>';
    } else {
      h += '<p class="doneline">✔ 灰度达标已确认 — 7/7 采样 · 错误率峰值 0.48%（未破线）· p99 峰值 486ms</p>';
    }
    return h;
  }

  if(id === 'c1'){
    const canEd = stageActive('C') && !stepDone('c2');
    let h = '<div class="checks">' + st.checks.map(c =>
      '<label class="check"><input type="checkbox" data-action="toggle-c1" data-check="' + c.id + '"' +
      (S.c1[c.id] ? ' checked' : '') + (canEd ? '' : ' disabled') + '/><span>' + c.text + '</span></label>').join('') + '</div>';
    h += c1Armed()
      ? '<p class="armedline">● ' + st.armedText + '</p>'
      : '<p class="hint">勾选全部三项后，发布进入待命</p>';
    return h;
  }

  if(id === 'c2'){
    if(done)
      return '<p class="doneline">✔ ' + st.doneText + '</p>' +
        '<p class="recovnote"><span class="badge recov">恢复路径</span> 回滚窗口开启中（至 D2 密封）— 如需恢复，使用顶部横幅「回滚发布」</p>';
    if(stageActive('C') && c1Armed())
      return '<div class="btnrow"><button class="btn danger big" data-action="open-c2">⚠ 执行全量发布（不可逆）</button></div>' +
        '<p class="hint">将打开强制确认 — 勾选全部后果项并输入确认码后方可执行</p>';
    return '<div class="btnrow"><button class="btn ghost" data-action="open-c2">🔒 执行全量发布（未待命）</button></div>' +
      '<p class="hint bad">' + st.lockedHint + '</p>';
  }

  if(id === 'd1'){
    let h = '';
    if(done) h += '<p class="doneline">✔ ' + st.doneText + '</p>';
    else if(S.smoke.run) h += '<div class="btnrow"><button class="btn ok" data-action="confirm-d1">' + st.confirmLabel + '</button></div>';
    else h += '<div class="btnrow"><button class="btn" data-action="run-d1">' + st.runLabel + '</button></div>';
    return h + '<div id="run-d1" class="rlines"></div>';
  }

  if(id === 'd2'){
    if(done && S.win.sealed)
      return '<p class="doneline">✔ ' + st.doneText + '</p>';
    if(stepDone('d1') && S.win.openAt){
      const s = Math.floor((Date.now() - S.win.openAt) / 1000);
      return '<div class="btnrow"><button class="btn danger" data-action="seal">⚠ 密封回滚窗口（不可逆）</button>' +
        '<span class="mono" id="d2win" style="font-size:12px;color:var(--recover)">窗口已开启 ' + mmss(s) + '</span></div>' +
        '<p class="hint">密封前，回滚始终可用；密封后恢复入口永久关闭</p>';
    }
    return '<div class="btnrow"><button class="btn ghost" data-action="seal">🔒 密封回滚窗口</button></div>' +
      '<p class="hint bad">' + st.lockedHint + '</p>';
  }

  return '';
}

function renderStep(id){
  const st = FLOW.steps[id], done = stepDone(id), act = stageActive(st.stage);
  const cls = done ? 'done' : act ? 'active' : 'locked';
  const irrev = st.kind === 'irrev';
  let h = '<article class="step ' + cls + (irrev ? ' irrev' : '') + '" id="step-' + id + '">' +
    '<div class="step-h"><span class="sdot ' + cls + '">' + (done ? '✓' : act ? stepNo(id) : '·') + '</span>' +
    '<h3>' + stepNo(id) + ' · ' + st.title + (irrev ? ' <span class="badge irrev">不可逆</span>' : '') + '</h3>' +
    '<span class="step-state ' + cls + '">' + (done ? '已完成' : act ? '待操作' : '未解锁') + '</span></div>' +
    '<p class="desc">' + st.desc + '</p>';
  if(cls === 'locked') return h + '<p class="lockednote">🔒 完成上一阶段后解锁</p></article>';
  return h + stepBody(id) + '</article>';
}

function renderPanel(){
  const cur = currentStageId();
  if(S.follow) S.view = cur;
  const id = S.view, st = stageById(id);
  const complete = stageComplete(id), active = stageActive(id);
  const cls = complete ? 'done' : active ? 'active' : 'locked';
  const label = complete ? '已完成 · 只读' : active ? '进行中' : '未解锁';

  let h = '<div class="flowstrip">' + FLOW.stages.map(s => {
    const c = stageComplete(s.id) ? 'done' : stageActive(s.id) ? 'cur' : 'lock';
    return '<button class="fs ' + c + (s.id === id ? ' sel' : '') + '" data-action="nav-stage" data-stage="' + s.id + '">' +
      '<span class="fs-l">' + s.id + ' · ' + (c === 'done' ? '完成' : c === 'cur' ? '进行中' : '未解锁') + '</span>' +
      '<span class="fs-t">' + s.title + (s.irreversible ? ' <span class="fs-w">不可逆</span>' : '') + '</span>' +
      '<span class="fs-c">' + s.steps.filter(stepDone).length + '/' + s.steps.length + '</span></button>';
  }).join('<span class="fs-arrow">→</span>') + '</div>';

  h += renderBanner();

  h += '<section class="stage ' + cls + '"><header class="stage-h">' +
    '<span class="stage-letter ' + cls + '">' + id + '</span>' +
    '<div class="stage-meta"><h2>' + st.title + (st.irreversible ? ' <span class="badge irrev">含不可逆步骤</span>' : '') + '</h2><p>' + st.goal + '</p></div>' +
    '<div class="stage-side"><span class="stage-count">' + st.steps.filter(stepDone).length + '/' + st.steps.length + '</span>' +
    '<span class="stage-state ' + cls + '">' + label + '</span></div></header>';

  h += st.steps.map(renderStep).join('');

  if(id === 'D' && complete && !S.finished)
    h += '<div class="finishbar"><button class="btn ok big" data-action="finish">完成本次发布 ✓</button>' +
      '<span>全部 10 步已闭合 — 确认后生成交接记录与复盘统计</span></div>';

  h += '</section>';

  if(id !== cur && !S.finished)
    h += '<div class="gocur"><button class="btn ghost sm" data-action="go-current">回到当前阶段（' + cur + '）</button></div>';

  $('#panel').innerHTML = h;
}

/* ---------- 不可逆操作确认模态 ---------- */
let M = null;

function modals(){
  const m = FLOW.meta;
  return {
    rollout: () => ({
      sev:'danger',
      title:'不可逆操作 · 执行全量发布',
      sub:m.product + ' ' + m.version + ' → ' + m.env + ' · ' + m.instances + ' 实例',
      intro:'执行后 ' + m.instances + ' 台实例将全部切换至 ' + m.version + '，' + m.prev + ' 立即退出生产负载。' +
        '<b>发布本身无法撤销</b> — 唯一的恢复手段是回滚（约 8–12 分钟）。回滚窗口将保持开启，直至你在阶段 D 主动密封。',
      boxes:[
        '我理解：本操作不可撤销，只能通过回滚恢复',
        '我理解：若需回滚，耗时 8–12 分钟，期间下单链路受影响',
        '我确认：灰度指标达标，且当前无未处理 P2 以上告警'],
      phrase:'ROLLOUT-PROD',
      actionLabel:'执行全量发布',
      lines:['路由权重 5% → 100%','实例替换 16/48','实例替换 32/48','实例替换 48/48 · 健康检查通过'],
      onDone(){
        S.done.add('c2'); S.win.openAt = Date.now(); S.counts.rollout++;
        addLog('danger', 'C2 已执行全量发布 — ' + m.version + ' 上线 ' + m.instances + '/' + m.instances + ' · 回滚窗口开启');
        toast('全量发布已执行 · 回滚窗口开启', 'danger');
        renderAll();
      }
    }),
    rollback: () => ({
      sev:'recover',
      title:'恢复路径 · 回滚发布',
      sub:m.version + ' → ' + m.prev + ' · 预计 8–12 分钟',
      intro:'回滚将使 ' + m.version + ' 全部退出生产负载，切回 ' + m.prev + '。全量发布步骤复位为待命，冒烟结果作废，需重新执行。' +
        '<b>回滚是正当恢复手段，不计失误。</b>',
      boxes:[
        '我理解：回滚将使 ' + m.version + ' 全部退出生产负载',
        '我理解：回滚后需重新执行全量发布与冒烟验证'],
      phrase:'ROLLBACK',
      actionLabel:'执行回滚',
      lines:['切回镜像 ' + m.prev,'实例替换 18/48','实例替换 48/48 · 路由恢复'],
      onDone(){
        S.done.delete('c2'); S.done.delete('d1');
        S.smoke.run = false;
        S.win.openAt = null; S.win.sealed = false;
        S.counts.rollback++; S.follow = true;
        addLog('recover', '已回滚至 ' + m.prev + ' — 全量发布恢复/撤销，C2 复位为待命');
        toast('已回滚 · 发布复位为待命，可重新执行', 'ok');
        renderAll();
      }
    }),
    seal: () => ({
      sev:'danger',
      title:'不可逆操作 · 密封回滚窗口',
      sub:'密封后回滚入口永久关闭 · 唯一恢复手段是下一次发布',
      intro:'密封后，本次发布的恢复路径被永久移除。<b>此操作同样不可逆。</b>请确认冒烟已通过且业务指标平稳。',
      boxes:[
        '我确认：冒烟测试 3/3 通过，业务指标平稳',
        '我理解：密封后恢复入口永久关闭，本操作不可逆'],
      phrase:'SEAL',
      actionLabel:'密封回滚窗口',
      lines:['关闭回滚入口','归档回滚预案 · 窗口密封'],
      onDone(){
        S.win.sealed = true; S.done.add('d2');
        addLog('warn', 'D2 回滚窗口已密封 — 恢复入口永久关闭');
        toast('回滚窗口已密封', 'warn');
        renderAll();
      }
    }),
  };
}

function openModal(kind){ M = { kind, exec:false }; renderModal(); }
function closeModal(){ M = null; renderModal(); }

function renderModal(){
  const root = $('#modal');
  if(!M){ root.classList.remove('show'); root.innerHTML = ''; return; }
  const cfg = modals()[M.kind]();
  const dis = M.exec ? ' disabled' : '';
  root.classList.add('show');
  root.innerHTML = '<div class="modal ' + cfg.sev + '">' +
    '<header><span class="m-icon">' + (cfg.sev === 'recover' ? '↺' : '⚠') + '</span>' +
    '<div><h3>' + cfg.title + '</h3><p class="m-sub">' + cfg.sub + '</p></div></header>' +
    '<p class="m-intro">' + cfg.intro + '</p>' +
    '<div class="m-boxes">' + cfg.boxes.map((b, i) =>
      '<label class="m-box"><input type="checkbox" class="mbox" data-i="' + i + '"' + dis + '/><span>' + b + '</span></label>').join('') + '</div>' +
    '<div class="m-phrase"><label>确认码</label>' +
    '<input id="mphrase" type="text" spellcheck="false" autocomplete="off" placeholder="' + cfg.phrase + '"' + dis + '/>' +
    '<p class="m-hint">输入 <code>' + cfg.phrase + '</code> 以确认你理解上述后果</p></div>' +
    '<div id="mlines" class="rlines"></div>' +
    '<footer><button class="btn ghost" data-action="modal-cancel"' + dis + '>取消</button>' +
    '<button class="btn ' + (cfg.sev === 'recover' ? 'recov' : 'danger') + '" data-action="modal-confirm"' + dis + '>' +
    (M.exec ? '执行中…' : cfg.actionLabel) + '</button></footer></div>';
}

function modalConfirm(){
  if(!M || M.exec) return;
  const cfg = modals()[M.kind]();
  const boxes = Array.from(document.querySelectorAll('#modal .mbox'));
  const phraseEl = document.getElementById('mphrase');
  const missing = boxes.filter(b => !b.checked).length;
  const phrase = phraseEl.value.trim();
  if(missing > 0 || phrase !== cfg.phrase){
    const why = [];
    if(missing > 0) why.push('后果确认项未全部勾选（' + (boxes.length - missing) + '/' + boxes.length + '）');
    if(phrase !== cfg.phrase) why.push('确认码不匹配');
    mistake('确认要件未满足 — ' + why.join(' · '));
    const card = document.querySelector('#modal .modal');
    if(card){ card.classList.remove('shake'); void card.offsetWidth; card.classList.add('shake'); setTimeout(() => card.classList.remove('shake'), 480); }
    return;
  }
  M.exec = true;
  renderModal();
  const box = document.getElementById('mlines');
  const seq0 = S.seq;
  let i = 0;
  const iv = setInterval(() => {
    if(S.seq !== seq0 || !M){ clearInterval(iv); return; }
    if(i < cfg.lines.length) box.insertAdjacentHTML('beforeend', '<div class="rline">▸ ' + cfg.lines[i++] + '</div>');
    else { clearInterval(iv); setTimeout(() => { if(!M) return; const done = cfg.onDone; M = null; $('#modal').classList.remove('show'); $('#modal').innerHTML = ''; done(); }, 350); }
  }, 420);
}

/* ---------- 完成证书 ---------- */
function renderCompletion(){
  const root = $('#completion');
  if(!S.finished || S.overlayClosed){ root.classList.remove('show'); root.innerHTML = ''; return; }
  root.classList.add('show');
  const zero = S.mistakes.length === 0;
  const rb = S.counts.rollback;
  root.innerHTML = '<div class="modal certify' + (zero ? ' good' : '') + '">' +
    '<div class="cert-badge">' + (zero ? '✔' : '△') + '</div>' +
    '<h2>' + (zero ? '零失误完成' : '完成 · 共 ' + S.mistakes.length + ' 次失误') + '</h2>' +
    '<p class="cert-sub">' + FLOW.meta.product + ' ' + FLOW.meta.version + ' 已全量上线 · 回滚窗口已密封 · 交接记录已生成</p>' +
    '<div class="cert-stats">' +
    '<div><i>' + mmss(elapsed()) + '</i><span>总耗时</span></div>' +
    '<div><i>' + S.counts.rollout + '</i><span>全量发布执行</span></div>' +
    '<div><i>' + rb + '</i><span>回滚恢复</span></div>' +
    '<div><i>' + S.mistakes.length + '</i><span>失误</span></div></div>' +
    (zero
      ? '<p class="cert-zero">✔ 零失误 — 达成「走完全程、零失误」成功标准' + (rb ? '（含 ' + rb + ' 次回滚恢复；恢复属正当路径，不计失误）' : '') + '</p>'
      : '<ul class="cert-mistakes">' + S.mistakes.map(mm =>
          '<li><span class="mono lt">' + mm.t + '</span> ' + mm.text + (mm.step ? ' · 步骤 ' + mm.step.toUpperCase() : '') + '</li>').join('') + '</ul>') +
    '<div class="cert-actions"><button class="btn ok" data-action="reset2">重新演练</button>' +
    '<button class="btn ghost" data-action="close-completion">查看指挥台</button></div></div>';
}

/* ---------- 汇总渲染 ---------- */
function renderAll(){ renderChips(); renderNav(); renderPanel(); renderLog(); renderCompletion(); }

/* ---------- 交互 ---------- */
document.addEventListener('click', e => {
  const el = e.target.closest('[data-action]');
  if(!el) return;
  const a = el.dataset.action;

  switch(a){
    case 'nav-stage':
      S.view = el.dataset.stage;
      S.follow = (S.view === currentStageId());
      renderPanel(); renderNav();
      break;

    case 'go-current':
      S.follow = true;
      renderPanel(); renderNav();
      break;

    case 'toggle-check': {
      const id = el.dataset.step;
      if(checkToggleAllowed(id)){
        if(stepDone(id)) S.done.delete(id);
        else { S.done.add(id); addLog('ok', stepNo(id) + ' 已核对 — ' + FLOW.steps[id].title); }
        renderAll();
      } else if(stepDone(id)) toast('该核对项已随阶段闭合锁定');
      break;
    }

    case 'toggle-c1': {
      if(stepDone('c2') || el.disabled) break;
      const was = c1Armed();
      S.c1[el.dataset.check] = !S.c1[el.dataset.check];
      const now = c1Armed();
      if(now) S.done.add('c1'); else S.done.delete('c1');
      if(!was && now) addLog('ok', 'C1 前置核对完成 — 发布待命');
      if(was && !now) addLog('info', 'C1 前置核对被撤回 — 发布退出待命');
      renderPanel();
      break;
    }

    case 'sample': {
      const n = S.canarySamples.length;
      if(n >= 7 || stepDone('b2')) break;
      S.canarySamples.push(ERR[n]); S.canaryP99.push(P99[n]);
      const warn = ERR[n] >= ERR_T || P99[n] >= P99_T;
      addLog(warn ? 'warn' : 'info', 'B2 采样 ' + (n+1) + '/7 — 错误率 ' + ERR[n].toFixed(2) + '% · p99 ' + P99[n] + 'ms' + (warn ? '（预警，未破线）' : ''));
      renderPanel();
      break;
    }

    case 'confirm-b2':
      if(S.canarySamples.length < 7){
        mistake('灰度证据不足（采样 ' + S.canarySamples.length + '/7）即确认达标', 'b2'); shake('b2'); break;
      }
      S.done.add('b2');
      addLog('ok', 'B2 灰度达标已确认 — 7/7 采样 · 错误率峰值 0.48% 未破线');
      toast('灰度阶段闭合', 'ok');
      renderAll();
      break;

    case 'run-b1':
      runWithLines('b1', FLOW.steps.b1.runLabel, FLOW.steps.b1.lines, () => {
        S.done.add('b1'); addLog('ok', 'B1 canary 5% 已部署 · 12/12 实例就绪'); renderAll();
      });
      break;

    case 'undo-b1':
      S.done.delete('b1'); S.canarySamples = []; S.canaryP99 = [];
      addLog('info', 'B1 灰度已撤销（可逆步骤）— 采样清零');
      renderAll();
      break;

    case 'run-d1':
      runWithLines('d1', FLOW.steps.d1.runLabel, FLOW.steps.d1.lines, () => {
        S.smoke.run = true; addLog('info', 'D1 冒烟测试 3/3 通过 — 待确认'); renderAll();
      });
      break;

    case 'confirm-d1':
      S.done.add('d1'); addLog('ok', 'D1 冒烟通过已确认'); renderAll();
      break;

    case 'open-c2':
      if(stepDone('c2')) break;
      if(!(stageActive('C') && c1Armed())){ mistake('前置核对未完成即尝试执行全量发布', 'c2'); shake('c2'); break; }
      openModal('rollout');
      break;

    case 'rollback':
      if(S.win.openAt && !S.win.sealed) openModal('rollback');
      break;

    case 'seal':
      if(S.win.sealed || stepDone('d2')) break;
      if(!(stepDone('d1') && S.win.openAt)){ mistake('冒烟未确认即尝试密封回滚窗口', 'd2'); shake('d2'); break; }
      openModal('seal');
      break;

    case 'finish':
      if(ORDER.every(stepDone)){
        S.finished = true;
        addLog('ok', '发布流程闭合 — 交接记录已生成');
        renderAll();
      } else { mistake('流程未闭合即尝试完成', 'd3'); shake('d3'); }
      break;

    case 'reset': {
      if(M) break; /* 模态执行中不可重置，避免卡死 */
      const now = Date.now();
      if(!S.resetArm || now > S.resetArmUntil){
        S.resetArm = true; S.resetArmUntil = now + 3000;
        el.textContent = '确认重置？';
        setTimeout(() => { S.resetArm = false; const b = document.getElementById('resetBtn'); if(b) b.textContent = '重置演练'; }, 3000);
        break;
      }
      S = freshState(); bootLog(); renderAll(); toast('已重置', 'ok');
      break;
    }

    case 'reset2':
      S = freshState(); bootLog(); renderAll(); toast('已重置', 'ok');
      break;

    case 'modal-cancel': if(M && !M.exec) closeModal(); break;
    case 'modal-confirm': modalConfirm(); break;

    case 'close-completion':
      S.overlayClosed = true; renderCompletion(); break;
  }
});

/* ---------- 时钟 ---------- */
setInterval(() => {
  const c = document.getElementById('clock');
  if(c) c.textContent = mmss(elapsed());
  if(S.win.openAt && !S.win.sealed){
    const s = mmss(Math.floor((Date.now() - S.win.openAt) / 1000));
    const bt = document.getElementById('btime'); if(bt) bt.textContent = s;
    const d2 = document.getElementById('d2win'); if(d2) d2.textContent = '窗口已开启 ' + s;
  }
}, 1000);

/* ---------- 启动 ---------- */
function bootLog(){
  addLog('info', '指挥台就绪 — 流程定义 ' + FLOW.meta.product + ' ' + FLOW.meta.version + ' 已随首屏内联加载（零异步）');
  addLog('info', '发布窗口 ' + FLOW.meta.windowText + ' · 任务目标：零失误走完全程');
}
S = freshState();
bootLog();
renderAll();
