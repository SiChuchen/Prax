'use strict';
/* PulseWatch · 指标流监视台 — cell-j04-s04 (monitor × volatile-evidence-stream)
 *
 * 验收种子：指标变化可追溯，无闪烁噪声。
 * - 可追溯：全局事件流 + 单指标状态变化史 + 曲线上的事件标记，任何状态变化都能回放。
 * - 无闪烁：阈值判定带滞后（连续 2 样本触发 / 3 样本恢复）、网格定序不重排、
 *   更新只改 textContent 与 canvas、等宽数字，杜绝布局抖动与状态抖动。
 * - 首屏即用：240 个历史样本在脚本内同步生成，首帧即完整可用，无加载态。
 */

// ---------- 基础工具 ----------
function mulberry32(seed){let a=seed>>>0;return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function hashStr(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
function gauss(rng){let u=0,v=0;while(u===0)u=rng();while(v===0)v=rng();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);}
const $=(s,el)=>(el||document).querySelector(s);
const pad2=n=>String(n).padStart(2,'0');
function fmtClock(ms){const d=new Date(ms);return pad2(d.getHours())+':'+pad2(d.getMinutes())+':'+pad2(d.getSeconds());}
function fmtDur(ms){const s=Math.max(0,Math.floor(ms/1000));return pad2(Math.floor(s/60))+':'+pad2(s%60);}
function fmtNum(v,dec){if(dec===0&&Math.abs(v)>=1000)return Math.round(v).toLocaleString('en-US');return v.toFixed(dec);}
function fmtPct(p){return (p>=0?'+':'')+p.toFixed(1)+'%';}

const STATUS={ok:{word:'正常',c:'#3ecf8e'},warn:{word:'警告',c:'#f0b429'},crit:{word:'严重',c:'#ff5c5c'}};
const TRANS_TXT={ 'ok>warn':'转为警告','warn>crit':'升级为严重','ok>crit':'突发严重','warn>ok':'恢复','crit>ok':'恢复','crit>warn':'降级为警告' };

// ---------- 指标目录（28 项 · 4 域）----------
// bands: wh/ch = 警告/严重上限, wl/cl = 警告/严重下限; dir: lowGood=越高越坏, highGood=越低越坏, neutral
const CATS={
  edge:    {label:'接入 Edge',    c:'var(--c-edge)'},
  payments:{label:'交易 Payments',c:'var(--c-payments)'},
  search:  {label:'检索 Search',  c:'var(--c-search)'},
  storage: {label:'存储 Storage', c:'var(--c-storage)'},
};
function M(id,cat,label,unit,dec,base,jit,bands,dir){return{id,cat,label,unit,dec,base,jit,wh:null,ch:null,wl:null,cl:null,...bands,dir};}
const METRICS=[
  M('gateway.rps','edge','网关吞吐','req/s',0,4200,90,{wh:6000,ch:7200},'neutral'),
  M('gateway.p99_latency','edge','网关 P99 延迟','ms',0,120,8,{wh:220,ch:320},'lowGood'),
  M('gateway.error_rate','edge','网关错误率','%',2,0.60,0.12,{wh:2,ch:4},'lowGood'),
  M('edge.cache_hit','edge','边缘缓存命中','%',1,78,3,{wl:60,cl:45},'highGood'),
  M('cdn.egress','edge','CDN 出口带宽','Gbps',1,34,2.5,{wh:52,ch:60},'neutral'),
  M('edge.dropped_conn','edge','边缘丢弃连接','个',0,12,4,{wh:60,ch:120},'lowGood'),
  M('gateway.active_conn','edge','活跃连接数','',0,8600,220,{wh:12000,ch:15000},'neutral'),
  M('checkout.rps','payments','结账吞吐','单/s',0,940,30,{wl:600,cl:420},'highGood'),
  M('checkout.error_rate','payments','结账错误率','%',2,0.40,0.10,{wh:2,ch:4.5},'lowGood'),
  M('payment.auth_latency','payments','支付鉴权 P95','ms',0,210,12,{wh:400,ch:600},'lowGood'),
  M('payment.queue_depth','payments','支付队列积压','笔',0,140,18,{wh:400,ch:800},'lowGood'),
  M('payment.success_rate','payments','支付成功率','%',2,99.2,0.25,{wl:97.5,cl:95},'highGood'),
  M('refunds.rps','payments','退款速率','单/s',1,6,1.2,{wh:15,ch:25},'lowGood'),
  M('settlement.lag','payments','清结算延迟','s',0,45,6,{wh:120,ch:240},'lowGood'),
  M('search.qps','search','检索吞吐','qps',0,2600,70,{wl:1500,cl:1000},'highGood'),
  M('search.latency','search','检索 P95 延迟','ms',0,95,7,{wh:200,ch:350},'lowGood'),
  M('search.zero_rate','search','零结果率','%',1,2.1,0.4,{wh:6,ch:10},'lowGood'),
  M('index.lag','search','索引同步延迟','s',1,4,0.8,{wh:15,ch:40},'lowGood'),
  M('search.suggest_rps','search','联想请求量','qps',0,720,25,{wl:400,cl:250},'highGood'),
  M('embedding.queue','search','向量化队列','条',0,85,10,{wh:250,ch:500},'lowGood'),
  M('search.cache_hit','search','检索缓存命中','%',1,84,2.5,{wl:65,cl:50},'highGood'),
  M('db.cpu','storage','数据库 CPU','%',1,46,3,{wh:80,ch:92},'lowGood'),
  M('db.replica_lag','storage','副本同步延迟','s',1,1.2,0.3,{wh:8,ch:20},'lowGood'),
  M('disk.used','storage','磁盘使用率','%',1,61,0.4,{wh:85,ch:93},'lowGood'),
  M('redis.hit_rate','storage','Redis 命中率','%',1,92,1.2,{wl:80,cl:65},'highGood'),
  M('redis.evictions','storage','Redis 键淘汰','k/min',1,0.8,0.3,{wh:4,ch:9},'lowGood'),
  M('kafka.lag','storage','Kafka 消费延迟','s',1,0.9,0.25,{wh:5,ch:15},'lowGood'),
  M('db.slow_queries','storage','慢查询','条/min',0,14,3,{wh:45,ch:90},'lowGood'),
];

// ---------- 事件剧本（tick 为 2s 采样序号；负值 = 已注入首屏历史）----------
const INCIDENTS=[
  {id:'checkout.error_rate', start:-52, total:120, mag: 4.8},  // 载入时已处于严重态
  {id:'payment.queue_depth', start:-34, total: 90, mag: 300},  // 载入时处于警告态
  {id:'index.lag',           start:-22, total: 70, mag: 13},   // 载入时处于警告态
  {id:'db.replica_lag',      start:  14, total: 70, mag: 26},  // 载入后 ~21s 爆发 → 严重
  {id:'search.latency',      start:  36, total: 60, mag:180},  // ~54s 警告漂移
  {id:'redis.hit_rate',      start:  64, total: 55, mag:-15},  // ~96s 命中率下探警告
  {id:'gateway.p99_latency', start:  96, total: 60, mag:230},  // ~144s 延迟抬升
];

// ---------- 运行时状态 ----------
const HIST_LEN=240, SAMPLE_MS=2000, SPARK_LEN=120;
const metrics=METRICS.map(spec=>{
  const rng=mulberry32(hashStr(spec.id));
  return{spec,rng,v:spec.base,hist:[],st:'ok',since:0,critStreak:0,warnStreak:0,okStreak:0,trace:[]};
});
const byId=Object.fromEntries(metrics.map(m=>[m.spec.id,m]));
let EVENTS=[];      // 全局事件（时间升序）
let NEW_EVENTS=[];  // 本 tick 新产生的事件
let T=0, simT=0;    // 采样序号 / 模拟时钟

function incidentTarget(m){
  for(const inc of INCIDENTS){
    if(inc.id!==m.spec.id)continue;
    const p=T-inc.start;
    if(p<0||p>=inc.total)continue;
    const e=Math.min(1,p/8,(inc.total-p)/8); // 8 tick 起坡 / 8 tick 回落
    return m.spec.base+inc.mag*Math.max(0,e);
  }
  return null;
}

function trans(m,to,now){
  const from=m.st;
  if(from===to)return;
  m.st=to; m.since=now; m.critStreak=m.warnStreak=m.okStreak=0;
  const ev={t:now,id:m.spec.id,from,to,v:m.v};
  EVENTS.push(ev); if(EVENTS.length>200)EVENTS.splice(0,EVENTS.length-200);
  m.trace.push(ev); if(m.trace.length>24)m.trace.shift();
  NEW_EVENTS.push(ev);
}

/* 阈值判定：滞后状态机。
 * 进入 warn/crit 需连续 2 个样本越界，恢复需连续 3 个样本回到带内 ——
 * 单点毛刺不会翻转状态，事件流与告警条因此不闪烁。 */
function evaluate(m,now){
  const s=m.spec,v=m.v;
  const outC=(s.ch!=null&&v>s.ch)||(s.cl!=null&&v<s.cl);
  const outW=(s.wh!=null&&v>s.wh)||(s.wl!=null&&v<s.wl);
  m.critStreak=outC?m.critStreak+1:0;
  if(m.st!=='crit'&&m.critStreak>=2)return trans(m,'crit',now);
  if(m.st==='ok'){
    m.warnStreak=outW?m.warnStreak+1:0;
    if(m.warnStreak>=2)return trans(m,'warn',now);
  }else{
    m.okStreak=!outW?m.okStreak+1:0;
    if(m.okStreak>=3)return trans(m,'ok',now);
  }
}

function step(m,now){
  const tgt=incidentTarget(m);
  const base=tgt!=null?tgt:m.spec.base;
  const pull=tgt!=null?0.30:0.05; // 事件期间被强行拉向事件目标，其余时候均值回归
  m.v+=(base-m.v)*pull+gauss(m.rng)*m.spec.jit*(tgt!=null?0.4:1);
  if(m.v<0)m.v=0;
  m.hist.push({t:now,v:m.v});
  if(m.hist.length>HIST_LEN)m.hist.shift();
  evaluate(m,now);
}

// ---------- 首屏历史：同步生成，无加载态 ----------
const t0=Date.now()-(HIST_LEN-1)*SAMPLE_MS;
metrics.forEach(m=>{m.v=m.spec.base;m.since=t0;});
for(T=-HIST_LEN+1;T<=0;T++){
  const now=t0+(T+HIST_LEN-1)*SAMPLE_MS;
  for(const m of metrics)step(m,now);
}
EVENTS=EVENTS.slice(-60);
simT=t0+(HIST_LEN-1)*SAMPLE_MS;

// ---------- DOM 引用 ----------
const gridEl=$('#metrics'), feedEl=$('#feed');
const elClock=$('#clock'), elFlow=$('#flowState'), elPulse=$('#pulseDot');
const cntOk=$('#cntOk'), cntWarn=$('#cntWarn'), cntCrit=$('#cntCrit');
const attEl=$('#attention');
const dEmpty=$('#detailEmpty'), dBody=$('#detailBody');
let selId=null, activeCat='all', onlyBad=false, paused=false, speed=1;

// ---------- 网格构建（一次构建，此后只就地更新）----------
const tileRefs={};
function buildGrid(){
  for(const[cat,meta]of Object.entries(CATS)){
    const sec=document.createElement('section');
    sec.className='cat-group'; sec.dataset.cat=cat;
    sec.style.setProperty('--cat',meta.c);
    sec.innerHTML=`<h2>${meta.label} <span class="gcount" data-gcount></span></h2><div class="grid"></div>`;
    const wrap=sec.querySelector('.grid');
    for(const m of metrics.filter(x=>x.spec.cat===cat)){
      const s=m.spec;
      const b=document.createElement('button');
      b.className='tile'; b.dataset.id=s.id;
      b.style.setProperty('--cat',meta.c);
      b.setAttribute('aria-label',`${s.label} 当前值与走势`);
      b.innerHTML=
        `<div class="tile-head"><span class="tile-name">${s.label}</span><span class="dot"></span></div>`+
        `<div class="tile-val"><span class="v mono">–</span><span class="u">${s.unit}</span></div>`+
        `<div class="tile-delta"><span class="arr"></span><span class="pct"></span><span>/1min</span></div>`+
        `<canvas class="spark" aria-hidden="true"></canvas>`+
        `<div class="tile-foot"><span class="stword ok">正常</span><span class="since"></span></div>`;
      wrap.appendChild(b);
      tileRefs[s.id]={
        root:b, name:b.querySelector('.tile-name'),
        v:b.querySelector('.v'), arr:b.querySelector('.arr'), pct:b.querySelector('.pct'),
        dot:b.querySelector('.dot'), stw:b.querySelector('.stword'), since:b.querySelector('.since'),
        spark:b.querySelector('.spark'),
        _cls:'', _stTxt:'', _vTxt:'', _pTxt:'', _arr:'',
      };
      b.title=`${s.label} · ${s.id}`;
      b.addEventListener('click',()=>select(s.id));
    }
    gridEl.appendChild(sec);
  }
}

// ---------- Sparkline / 详情曲线 ----------
function scaleFor(m,vals){
  let lo=Math.min(...vals),hi=Math.max(...vals);
  const s=m.spec;
  if(s.wh!=null&&s.wh<=hi*2.2)hi=Math.max(hi,s.wh*1.06);
  if(s.ch!=null&&s.ch<=hi*2.8)hi=Math.max(hi,s.ch*1.03);
  if(s.wl!=null&&s.wl>=lo*0.5)lo=Math.min(lo,s.wl*0.94);
  if(s.cl!=null&&s.cl>=lo*0.4)lo=Math.min(lo,s.cl*0.97);
  if(hi-lo<1e-9){hi+=1;lo-=1;}
  const pad=(hi-lo)*0.08;
  return{lo:lo-pad,hi:hi+pad};
}

function drawSeries(cv,m,pts,opts){
  const dpr=window.devicePixelRatio||1;
  const w=cv.clientWidth,h=cv.clientHeight;
  if(w<10||h<10)return;
  const W=Math.round(w*dpr),H=Math.round(h*dpr);
  if(cv.width!==W||cv.height!==H){cv.width=W;cv.height=H;}
  const g=cv.getContext('2d');
  g.setTransform(dpr,0,0,dpr,0,0); g.clearRect(0,0,w,h);
  const vals=pts.map(p=>p.v);
  const{lo,hi}=scaleFor(m,vals);
  const Y=v=>h-(v-lo)/(hi-lo)*h;
  const X=i=>pts.length>1?i/(pts.length-1)*w:w/2;
  const s=m.spec;

  // 阈值带：警告带(琥珀) / 严重带(红)，铺满纵向区间
  if(s.ch!=null&&s.ch<hi){g.fillStyle='rgba(255,92,92,.10)';g.fillRect(0,0,w,Math.max(0,Y(s.ch)));}
  else if(s.cl!=null&&s.cl>lo){g.fillStyle='rgba(255,92,92,.10)';g.fillRect(0,Y(s.cl),w,h-Y(s.cl));}
  if(s.wh!=null&&s.wh<hi){g.fillStyle='rgba(240,180,41,.08)';g.fillRect(0,0,w,Math.max(0,Y(s.wh)));}
  else if(s.wl!=null&&s.wl>lo){g.fillStyle='rgba(240,180,41,.08)';g.fillRect(0,Y(s.wl),w,h-Y(s.wl));}

  // 阈值虚线
  g.setLineDash([3,4]); g.lineWidth=1;
  const thr=[[s.wh,'#f0b429'],[s.ch,'#ff5c5c'],[s.wl,'#f0b429'],[s.cl,'#ff5c5c']];
  for(const[tv,tc]of thr){
    if(tv==null||tv>hi||tv<lo)continue;
    const y=Y(tv);
    g.strokeStyle=tc; g.globalAlpha=.55;
    g.beginPath(); g.moveTo(0,y); g.lineTo(w,y); g.stroke();
    if(opts.labels){
      g.globalAlpha=.9; g.fillStyle=tc; g.font='9px Cascadia Mono,Consolas,monospace';
      g.font="9px 'Cascadia Mono',Consolas,monospace";
      g.fillText((tv===s.wh||tv===s.wl?'warn ':'crit ')+tv,w-50,y-3);
    }
  }
  g.setLineDash([]); g.globalAlpha=1;

  // 事件标记（仅详情）：状态变化时刻的纵向刻痕
  if(opts.markers){
    const tA=pts[0].t,tB=pts[pts.length-1].t;
    for(const ev of m.trace){
      if(ev.t<tA||ev.t>tB)continue;
      const x=X((ev.t-tA)/(tB-tA)*(pts.length-1));
      const c=STATUS[ev.to].c;
      g.globalAlpha=.28; g.strokeStyle=c;
      g.beginPath(); g.moveTo(x,0); g.lineTo(x,h); g.stroke();
      g.globalAlpha=1; g.fillStyle=c;
      g.beginPath(); g.moveTo(x-3,h-1); g.lineTo(x+3,h-1); g.lineTo(x,h-6); g.closePath(); g.fill();
    }
  }

  // 主折线：状态色仅在异常时接管，正常态用中性蓝灰
  const lc=m.st==='ok'?'#7f9db8':STATUS[m.st].c;
  g.strokeStyle=lc; g.lineWidth=1.5; g.lineJoin='round'; g.lineCap='round';
  g.beginPath();
  vals.forEach((v,i)=>{i?g.lineTo(X(i),Y(v)):g.moveTo(X(i),Y(v));});
  g.stroke();
  // 线下方淡填充
  g.globalAlpha=.10; g.fillStyle=lc; g.lineTo(X(vals.length-1),h); g.lineTo(X(0),h); g.closePath(); g.fill();
  g.globalAlpha=1;

  // 端点
  const ex=X(vals.length-1),ey=Y(vals[vals.length-1]);
  g.fillStyle=STATUS[m.st].c; g.globalAlpha=.25;
  g.beginPath(); g.arc(ex,ey,6,0,7); g.fill();
  g.globalAlpha=1;
  g.beginPath(); g.arc(ex,ey,2.6,0,7); g.fill();
}

function drawSpark(m){drawSeries(tileRefs[m.spec.id].spark,m,m.hist.slice(-SPARK_LEN),{});}

// ---------- 就地更新（不改布局）----------
function statusClass(el,cls){if(el._cls!==cls){el.className='dot'+(cls?' '+cls:'');el._cls=cls;}}
function updateTile(m){
  const r=tileRefs[m.spec.id],s=m.spec;
  const vTxt=fmtNum(m.v,s.dec);
  if(r._vTxt!==vTxt){r.v.textContent=vTxt;r._vTxt=vTxt;}
  const ref=m.hist.length>30?m.hist[m.hist.length-31].v:m.hist[0].v;
  const pct=ref!==0?(m.v-ref)/Math.abs(ref)*100:0;
  const pTxt=fmtPct(pct);
  if(r._pTxt!==pTxt){r.pct.textContent=pTxt;r._pTxt=pTxt;}
  const arr=pct>=0?'▲':'▼';
  if(r._arr!==arr){r.arr.textContent=arr;r._arr=arr;}
  // 涨跌好坏着色：对延迟/错误类，上升是坏消息；对命中率类，下降是坏消息
  let dc='';
  if(s.dir==='lowGood')dc=pct>0.5?'bad':pct<-0.5?'good':'';
  else if(s.dir==='highGood')dc=pct<-0.5?'bad':pct>0.5?'good':'';
  r.pct.className='pct'+(dc?' '+dc:'');
  statusClass(r.dot,m.st==='ok'?'':m.st);
  const stTxt=STATUS[m.st].word;
  if(r._stTxt!==stTxt){
    r.stw.textContent=stTxt; r.stw.className='stword '+m.st; r._stTxt=stTxt;
    r.root.classList.toggle('warn',m.st==='warn');
    r.root.classList.toggle('crit',m.st==='crit');
  }
  const sinceTxt=m.st==='ok'?'':'持续 '+fmtDur(simT-m.since);
  if(r.since.textContent!==sinceTxt)r.since.textContent=sinceTxt;
  drawSpark(m);
}

function setCounts(){
  let nOk=0,nW=0,nC=0;
  for(const m of metrics){if(m.st==='ok')nOk++;else if(m.st==='warn')nW++;else nC++;}
  cntOk.textContent=nOk+' 正常';
  cntWarn.textContent=nW+' 警告'; cntWarn.classList.toggle('hot',nW>0);
  cntCrit.textContent=nC+' 严重'; cntCrit.classList.toggle('hot',nC>0);
}

// ---------- 告警条（成员变化才重建，数值就地更新）----------
let attKey=''; const attRefs={};
function renderAttention(){
  const bad=metrics.filter(m=>m.st!=='ok')
    .sort((a,b)=>(a.st==='crit'?0:1)-(b.st==='crit'?0:1)||a.since-b.since);
  const key=bad.map(m=>m.spec.id+':'+m.st).join('|');
  if(key!==attKey){
    attKey=key; attEl.innerHTML=''; for(const k in attRefs)delete attRefs[k];
    if(!bad.length){
      attEl.className='attention all-ok';
      attEl.innerHTML='<span class="att-label">告警</span><span class="att-all"><span class="pulse-dot"></span>全部指标正常 — 流式监控中</span>';
    }else{
      attEl.className='attention';
      const lab=document.createElement('span');
      lab.className='att-label'; lab.textContent='告警 '+bad.length;
      attEl.appendChild(lab);
      for(const m of bad){
        const st=m.st;
        const b=document.createElement('button');
        b.className='att-chip '+st;
        b.innerHTML=`<span class="adot"></span><b>${m.spec.label}</b><span class="aval"></span><span class="asub"></span>`;
        b.addEventListener('click',()=>{select(m.spec.id);pingTile(m.spec.id);});
        attEl.appendChild(b);
        attRefs[m.spec.id]={v:b.querySelector('.aval'),sub:b.querySelector('.asub')};
      }
    }
  }
  for(const m of bad){
    const r=attRefs[m.spec.id]; if(!r)continue;
    r.v.textContent=fmtNum(m.v,m.spec.dec)+m.spec.unit;
    r.sub.textContent=STATUS[m.st].word+' · '+fmtDur(simT-m.since);
  }
}

// ---------- 事件流 ----------
function evRow(ev){
  const m=byId[ev.id];
  const cls=ev.to==='crit'?'crit':ev.to==='warn'?'warn':'ok';
  const d=new Date(ev.t);
  return `<li><button class="ev ${cls}" data-id="${ev.id}">`+
    `<span class="ev-t mono">${fmtClock(ev.t)}</span><span class="ev-dot"></span>`+
    `<span class="ev-main"><b>${m.spec.label}</b><em>${STATUS[ev.from].word} → ${STATUS[ev.to].word} · ${TRANS_TXT[ev.from+'>'+ev.to]||''}</em></span>`+
    `<span class="ev-v mono">${fmtNum(ev.v,m.spec.dec)}${m.spec.unit}</span></button></li>`;
}
function flushFeed(){
  for(const ev of NEW_EVENTS)feedEl.insertAdjacentHTML('afterbegin',evRow(ev));
  while(feedEl.children.length>60)feedEl.lastElementChild.remove();
}
feedEl.addEventListener('click',e=>{
  const b=e.target.closest('button[data-id]');
  if(!b)return;
  select(b.dataset.id); pingTile(b.dataset.id);
});

// ---------- 详情追溯 ----------
const dName=$('#dName'),dCat=$('#dCat'),dVal=$('#dVal'),dUnit=$('#dUnit'),dDelta=$('#dDelta');
const dChart=$('#dChart'),dStats=$('#dStats'),dTrace=$('#dTrace');
let lastTraceKey='';
function select(id){
  selId=id;
  for(const m of metrics)tileRefs[m.spec.id].root.classList.toggle('sel',m.spec.id===id);
  dEmpty.hidden=!!id; dBody.hidden=!id;
  $('#btnCloseDetail').hidden=!id;
  lastTraceKey='';
  renderDetail();
  if(id)tileRefs[id].root.scrollIntoView({block:'nearest',behavior:'smooth'});
}
$('#btnCloseDetail').addEventListener('click',()=>select(null));
function pingTile(id){
  const r=tileRefs[id]; if(!r)return;
  r.root.scrollIntoView({block:'nearest',behavior:'smooth'});
  r.root.classList.remove('ping'); void r.root.offsetWidth; r.root.classList.add('ping');
  setTimeout(()=>r.root.classList.remove('ping'),1100);
}
function renderDetail(){
  if(!selId)return;
  const m=byId[selId],s=m.spec,meta=CATS[s.cat];
  dName.innerHTML=s.label+' <small>'+s.id+'</small>';
  dCat.textContent=meta.label; dCat.style.setProperty('--cat',meta.c);
  dVal.textContent=fmtNum(m.v,s.dec); dUnit.textContent=s.unit;
  const ref=m.hist.length>30?m.hist[m.hist.length-31].v:m.hist[0].v;
  const pct=ref!==0?(m.v-ref)/Math.abs(ref)*100:0;
  dDelta.textContent=fmtPct(pct)+' /1min';
  let dc='';
  if(s.dir==='lowGood')dc=pct>0.5?'bad':pct<-0.5?'good':'';
  else if(s.dir==='highGood')dc=pct<-0.5?'bad':pct>0.5?'good':'';
  dDelta.className='d-delta mono'+(dc?' '+dc:'');
  drawSeries(dChart,m,m.hist,{markers:true,labels:true});
  // 5 分钟统计
  const w5=m.hist.slice(-150).map(p=>p.v);
  const mn=Math.min(...w5),mx=Math.max(...w5),avg=w5.reduce((a,b)=>a+b,0)/w5.length;
  const th=s.wh!=null?`警告>${s.wh} · 严重>${s.ch}`:`警告<${s.wl} · 严重<${s.cl}`;
  dStats.innerHTML=`5min 区间 ${fmtNum(mn,s.dec)}–${fmtNum(mx,s.dec)} · 均值 ${fmtNum(avg,s.dec)}<br>${s.dir==='lowGood'?'上限':'下限'}阈值：${th} · 滞后 2 触发 / 3 恢复`;
  // 状态变化史（内容变化才重建）
  const key=m.trace.map(e=>e.t).join(',');
  if(key!==lastTraceKey){
    lastTraceKey=key;
    dTrace.innerHTML=[...m.trace].reverse().map(ev=>
      `<li><span class="t-dot" style="background:${STATUS[ev.to].c}"></span>`+
      `<span class="t-time">${fmtClock(ev.t)}</span>`+
      `<span class="t-chg">${STATUS[ev.from].word} → ${STATUS[ev.to].word}</span>`+
      `<span class="t-v">${fmtNum(ev.v,s.dec)}${s.unit}</span></li>`).join('')||
      '<li><span class="t-chg">本会话内暂无状态变化</span></li>';
  }
}

// ---------- 筛选 ----------
function applyFilter(){
  for(const m of metrics){
    const hide=(activeCat!=='all'&&m.spec.cat!==activeCat)||(onlyBad&&m.st==='ok');
    tileRefs[m.spec.id].root.hidden=hide;
  }
  for(const sec of gridEl.children){
    sec.hidden=activeCat!=='all'&&sec.dataset.cat!==activeCat;
  }
}
function buildChips(){
  const box=$('#catChips');
  const mk=(val,label)=>{
    const b=document.createElement('button');
    b.className='chip'+(val==='all'?' on':''); b.textContent=label; b.dataset.cat=val;
    b.addEventListener('click',()=>{activeCat=val;
      box.querySelectorAll('.chip').forEach(c=>c.classList.toggle('on',c.dataset.cat===val));
      applyFilter();});
    box.appendChild(b);
  };
  mk('all','全部');
  for(const[k,v]of Object.entries(CATS))mk(k,v.label);
}

// ---------- 主循环 ----------
function renderTick(){
  elClock.textContent=fmtClock(simT);
  applyFilterVisibilityOnly();
  for(const m of metrics){updateTile(m);}
  // 分组计数（按当前可见卡片数）
  for(const sec of gridEl.children){
    const n=[...sec.querySelectorAll('.tile:not([hidden])')].length;
    const gc=sec.querySelector('[data-gcount]');
    if(gc.textContent!==String(n))gc.textContent=n;
  }
  setCounts(); renderAttention(); renderDetail();
}
/* applyFilter 的轻量版：仅当状态变化影响“仅看异常”时切换 hidden，不重绘画布 */
function applyFilterVisibilityOnly(){
  if(!onlyBad)return;
  for(const m of metrics){
    tileRefs[m.spec.id].root.hidden=m.st==='ok';
  }
}
function liveTick(){
  T++; simT+=SAMPLE_MS;
  NEW_EVENTS=[];
  for(const m of metrics)step(m,simT);
  renderTick(); flushFeed();
}
let timer=null;
function start(){stop();timer=setInterval(liveTick,1500/speed);}
function stop(){if(timer){clearInterval(timer);timer=null;}}
$('#btnPause').addEventListener('click',()=>{
  paused=!paused;
  if(paused){stop();$('#btnPause').textContent='继续';elFlow.textContent='已暂停';elPulse.classList.add('paused');}
  else{$('#btnPause').textContent='暂停';elFlow.textContent='实时流 '+speed+'×';elPulse.classList.remove('paused');start();}
});
$('#btnSpeed').addEventListener('click',()=>{
  speed=speed===1?2:speed===2?4:1;
  $('#btnSpeed').textContent='速度 '+speed+'×';
  elFlow.textContent=paused?'已暂停':'实时流 '+speed+'×';
  if(!paused)start();
});
$('#btnOnlyBad').addEventListener('click',()=>{
  onlyBad=!onlyBad;
  $('#btnOnlyBad').classList.toggle('on',onlyBad);
  $('#btnOnlyBad').setAttribute('aria-pressed',String(onlyBad));
  applyFilter();
});
let rz=null;
window.addEventListener('resize',()=>{
  clearTimeout(rz);
  rz=setTimeout(()=>{for(const m of metrics)drawSpark(m);renderDetail();},120);
});

// ---------- 启动 ----------
buildGrid();
buildChips();
renderTick();
for(const ev of EVENTS)feedEl.insertAdjacentHTML('afterbegin',evRow(ev)); // 时间升序逐条前插 → 最新在顶
// 深链：?select=<metric.id> 直达该指标的追溯视图
const qSel=new URLSearchParams(location.search).get('select');
if(qSel&&byId[qSel])select(qSel);
start();
window.__PULSE_READY={metrics:metrics.length,events:EVENTS.length};
console.log('[pulse] ready ·',metrics.length,'metrics ·',EVENTS.length,'seeded events · anomalies:',
  metrics.filter(m=>m.st!=='ok').map(m=>m.spec.id+':'+m.st).join(', ')||'none');
