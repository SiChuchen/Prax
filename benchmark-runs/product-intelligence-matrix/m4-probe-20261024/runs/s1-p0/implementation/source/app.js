'use strict';
/* ============================================================
 * ASTROLABE·13 应用层 —— explore × dimensional-space
 * 核心承诺：切换投影维度不重置认知（筛选/着色/历史全程保留），
 *           所有过滤/投影状态有归属（chips 标注来源）且可回退（操作史）。
 * ============================================================ */

/* ── 小工具 ── */
const $=s=>document.querySelector(s);
/* clamp 复用 data.js 顶层的全局定义（经典脚本共享全局词法作用域） */
function fnv(str){let h=0x811c9dc5;for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,0x01000193);}return h>>>0;}
function niceMax(v){const p=Math.pow(10,Math.floor(Math.log10(v||1)));const n=v/p;
  return (n<=1?1:n<=2?2:n<=2.5?2.5:n<=5?5:10)*p;}
function niceStep(raw){const p=Math.pow(10,Math.floor(Math.log10(raw||1)));const n=raw/p;
  return (n<=1?1:n<=2?2:n<=5?5:10)*p;}
function dvals(d){return d.type==='bool'?[true,false]:d.type==='ord'?d.order:d.values;}
function dlabel(d,v){return (d.labels&&d.labels[String(v)])||String(v);}
function fnum(d,v){return d.fmt==='int'?Math.round(v).toLocaleString('en-US')
  :d.fmt==='fix1'?(+v).toFixed(1):d.fmt==='fix2'?(+v).toFixed(2):String(v);}
function fval(d,v){return fnum(d,v)+(d.unit?' '+d.unit:'');}
function hms(t){const x=new Date(t);return [x.getHours(),x.getMinutes(),x.getSeconds()].map(n=>String(n).padStart(2,'0')).join(':');}

/* ── 视觉常量 ── */
const ACC='#59b7e8', ACC2='#ffd166';
const DIMC={}; DIMS.forEach((d,i)=>DIMC[d.id]=`hsl(${(i*29+197)%360} 62% 66%)`);
const CVAL=['#5ac8fa','#ffd166','#ff8fa3','#8ce99a','#b197fc','#ffa94d','#66d9e8',
            '#f783ac','#a9e34b','#4dabf7','#ffe0e6','#e599f7','#fff3a3','#63e6be'];
const CMAP_STOPS=[[59,15,112],[140,41,129],[222,73,104],[254,159,109],[252,253,191]];
function cmap(t){t=clamp(t,0,1)*(CMAP_STOPS.length-1);const i=Math.min(CMAP_STOPS.length-2,Math.floor(t));
  const a=CMAP_STOPS[i],b=CMAP_STOPS[i+1],f=t-i;
  return `rgb(${Math.round(a[0]+(b[0]-a[0])*f)},${Math.round(a[1]+(b[1]-a[1])*f)},${Math.round(a[2]+(b[2]-a[2])*f)})`;}
const VIA_ICON={'初始':'✦','点选':'◉','框选':'▭','维度列表':'◫','着色':'◐','芯片':'✕','按钮':'⟲','双击':'⌫'};

/* ── 状态与操作史（快照栈，支持回退/重做/回退至任意步）── */
const PROJ0='spec';
let state={proj:PROJ0,color:null,filters:{}};
let snaps=[structuredClone(state)];
let metas=[{t:Date.now(),via:'初始',desc:'初始状态 · 投影 光谱型'}];
let ptr=0;
const clone=s=>structuredClone(s);

function filterSig(){
  return JSON.stringify(Object.entries(state.filters)
    .map(([k,v])=>[k,v.kind==='in'?v.values.map(String).sort().join(','):(+v.lo).toFixed(3)+','+(+v.hi).toFixed(3)])
    .sort());
}
function passes(rec,filters,except){
  for(const id in filters){
    if(id===except)continue;
    const f=filters[id];
    if(f.kind==='in'){ if(!f.values.includes(rec[id]))return false; }
    else { const v=rec[id]; if(v<f.lo||v>f.hi)return false; }
  }
  return true;
}
function mutate(via,desc,fn){
  fn(state); ptr++;
  snaps=snaps.slice(0,ptr); metas=metas.slice(0,ptr);
  snaps.push(clone(state)); metas.push({t:Date.now(),via,desc});
  render();
}
function undo(){ if(ptr>0){ptr--;state=clone(snaps[ptr]);render();toast(`↶ 已回退：${metas[ptr+1].desc}`);} }
function redo(){ if(ptr<snaps.length-1){ptr++;state=clone(snaps[ptr]);render();toast(`↷ 已重做：${metas[ptr].desc}`);} }
function revertTo(i){ if(i===ptr)return; state=clone(snaps[i]);const from=ptr;ptr=i;render();
  toast(`已从 S${from} 回退至 S${i} · ${metas[i].desc}`); }

/* ── 统计计算 ── */
let VIS=[],currentStats=null,chartGeom=null,drag=null;
const NB=32;

function computeStats(){
  VIS=DATA.filter(r=>passes(r,state.filters,null));
  const d=DIM[state.proj], isNum=d.type==='num';
  const cd=state.color?DIM[state.color]:null;
  const colorKind=!cd?'none':cd.type==='num'?'num':'cat';
  let groups=null; const slots=[];
  if(isNum){ for(let i=0;i<NB;i++)slots.push({key:i,all:0,vis:0,segs:colorKind==='cat'?{}:null}); }
  else{
    groups=(d.clusters?Object.entries(d.clusters).map(([name,vs])=>({name,vals:vs}))
                      :[{name:null,vals:dvals(d).map(String)}]).map(g=>({...g,vals:g.vals}));
    groups.forEach((g,gi)=>g.vals.forEach(v=>slots.push({key:isNum?v:v,gi,raw:dvals(d).find(x=>String(x)===String(v)),all:0,vis:0,segs:colorKind==='cat'?{}:null})));
  }
  const byKey=new Map(slots.map(s=>[String(s.raw!==undefined?s.raw:s.key),s]));
  const legend=new Map();
  const span=d.dmax-d.dmin;
  for(const r of DATA){
    let s;
    if(isNum){
      const v=r[d.id]; if(v<d.dmin||v>d.dmax)continue;
      let bi=Math.floor((v-d.dmin)/span*NB); if(bi>=NB)bi=NB-1;
      s=slots[bi];
    } else s=byKey.get(String(r[d.id]));
    if(!s)continue;
    if(!passes(r,state.filters,state.proj))continue;   // 只被本维筛掉的 → 幽灵计数
    s.all++;
    if(!passes(r,state.filters,null))continue;          // 全部通过 → 可见计数
    s.vis++;
    if(colorKind==='cat'){const cv=r[state.color];s.segs[cv]=(s.segs[cv]||0)+1;legend.set(cv,(legend.get(cv)||0)+1);}
    else if(colorKind==='num'){s.csum=(s.csum||0)+r[state.color];s.cn=(s.cn||0)+1;}
  }
  let mx=0; for(const s of slots)mx=Math.max(mx,s.all);
  return {d,isNum,cd,colorKind,slots,groups,ymax:niceMax(mx||1),legend};
}

/* ── 画布投影 ── */
const cv=$('#cv'),ctx=cv.getContext('2d'),cvBox=$('#canvasBox');
const DPR=window.devicePixelRatio||1;

function draw(){
  if(!currentStats)return;
  const W=cvBox.clientWidth,H=cvBox.clientHeight; if(W<60||H<60)return;
  cv.width=W*DPR;cv.height=H*DPR;ctx.setTransform(DPR,0,0,DPR,0,0);ctx.clearRect(0,0,W,H);
  const S=currentStats,d=S.d;
  const hasClusters=!S.isNum&&S.groups&&S.groups[0].name;
  const M={l:48,r:16,t:hasClusters?30:18,b:46};
  const pw=W-M.l-M.r,ph=H-M.t-M.b;
  chartGeom={M,pw,ph,W,H,S};
  const n=S.slots.length,sw=pw/n,bw=Math.min(sw*.72,64);
  const y=v=>M.t+ph-ph*v/S.ymax, x=i=>M.l+i*sw;

  /* y 网格 */
  ctx.font='10.5px Consolas,monospace';ctx.textBaseline='middle';
  for(let i=0;i<=4;i++){
    const val=S.ymax*i/4,yy=y(val);
    ctx.strokeStyle='rgba(120,140,190,.14)';ctx.beginPath();ctx.moveTo(M.l,yy);ctx.lineTo(M.l+pw,yy);ctx.stroke();
    ctx.fillStyle='#5b6b8f';ctx.textAlign='right';ctx.fillText(Math.round(val).toLocaleString('en-US'),M.l-7,yy);
  }
  ctx.textAlign='left';ctx.fillText('样本数',M.l-38,M.t-8);

  /* 数值维：已有区间筛选底带 */
  const f=state.filters[d.id];
  if(S.isNum&&f&&f.kind==='range')drawBand(val2px(f.lo),val2px(f.hi),'筛选区间',false);
  if(S.isNum&&drag&&drag.moved)drawBand(Math.min(drag.x0,drag.x1),Math.max(drag.x0,drag.x1),liveBandText(),'');

  /* 柱体 */
  const segOrder=S.cd?dvals(S.cd):null;
  S.slots.forEach((s,i)=>{
    const bx=x(i)+(sw-bw)/2,yb=M.t+ph;
    if(s.all>s.vis){ /* 幽灵底柱：被本维筛掉的部分 */
      ctx.fillStyle='rgba(148,163,199,.15)';ctx.fillRect(bx,y(s.all),bw,yb-y(s.all));
      ctx.setLineDash([3,3]);ctx.strokeStyle='rgba(148,163,199,.4)';
      ctx.strokeRect(bx+.5,y(s.all)+.5,bw-1,yb-y(s.all)-1);ctx.setLineDash([]);
    }
    let yy=yb;
    if(S.colorKind==='cat'){
      for(const sv of segOrder){
        const c=s.segs[sv]; if(!c)continue;
        const hh=c/S.ymax*ph; if(hh<=0)continue;
        ctx.fillStyle=segColor(sv);ctx.fillRect(bx,yy-hh,bw,hh);yy-=hh;
      }
    }else if(S.colorKind==='num'&&s.cn){
      ctx.fillStyle=cmap((s.csum/s.cn-d.dmin)/ (d.dmax-d.dmin));
      ctx.fillRect(bx,y(s.vis),bw,yb-y(s.vis));
    }else{
      ctx.fillStyle=ACC;ctx.fillRect(bx,y(s.vis),bw,yb-y(s.vis));
    }
    /* 本维筛选命中：金色描边 */
    if(f&&f.kind==='in'&&f.values.map(String).includes(String(s.raw!==undefined?s.raw:s.key))){
      ctx.strokeStyle=ACC2;ctx.lineWidth=1.5;
      ctx.strokeRect(bx-1,y(s.vis)-1,bw+2,yb-y(s.vis)+1);ctx.lineWidth=1;
    }
    /* 柱顶计数 */
    if(sw>=24&&s.vis>0){
      ctx.fillStyle=(f&&f.kind==='in'&&f.values.map(String).includes(String(s.raw!==undefined?s.raw:s.key)))?ACC2:'#8fa0c4';
      ctx.textAlign='center';ctx.textBaseline='alphabetic';
      ctx.font='10px Consolas,monospace';
      ctx.fillText(s.vis,bx+bw/2,y(s.vis)-5);ctx.textBaseline='middle';
    }
  });

  /* x 轴 */
  ctx.strokeStyle='rgba(120,140,190,.35)';ctx.beginPath();ctx.moveTo(M.l,M.t+ph+.5);ctx.lineTo(M.l+pw,M.t+ph+.5);ctx.stroke();
  ctx.font='11px "Microsoft YaHei",sans-serif';ctx.fillStyle='#8fa0c4';ctx.textAlign='center';
  if(S.isNum){
    const span=d.dmax-d.dmin,step=niceStep(span/6);
    ctx.font='10.5px Consolas,monospace';
    for(let v=Math.ceil(d.dmin/step)*step;v<=d.dmax+1e-9;v+=step){
      const px=val2px(v);
      ctx.fillText(fnum(d,v),px,M.t+ph+14);
      ctx.strokeStyle='rgba(120,140,190,.25)';ctx.beginPath();ctx.moveTo(px,M.t+ph);ctx.lineTo(px,M.t+ph+4);ctx.stroke();
    }
    ctx.fillText(d.unit,M.l+pw,M.t+ph+30);
  }else{
    S.slots.forEach((s,i)=>{
      const lb=dlabel(d,s.raw!==undefined?s.raw:s.key);
      if(sw>=16||(sw>=8&&i%2===0)){ctx.fillText(lb,x(i)+sw/2,M.t+ph+14);}
      else if(s.all>s.vis&&s.vis===0){/* 被筛除 */}
    });
    /* 被本维完全筛除的值：标签加删除线 */
    if(f&&f.kind==='in'){
      S.slots.forEach((s,i)=>{
        const k=String(s.raw!==undefined?s.raw:s.key);
        if(!f.values.map(String).includes(k)){
          const lb=dlabel(d,s.raw),lx=x(i)+sw/2;
          if(sw>=16||(sw>=8&&i%2===0)){
            const w2=ctx.measureText(lb).width/2;
            ctx.strokeStyle='rgba(255,122,118,.8)';ctx.beginPath();
            ctx.moveTo(lx-w2-2,M.t+ph+14);ctx.lineTo(lx+w2+2,M.t+ph+14);ctx.stroke();
          }
        }
      });
    }
    /* 分组带（层级）*/
    if(hasClusters){
      let gi=0;
      S.groups.forEach(g=>{
        const idxs=S.slots.map((s,i)=>s.gi===gi?i:-1).filter(i=>i>=0);
        if(idxs.length){
          const x0=x(idxs[0])+2,x1=x(idxs[idxs.length-1])+sw-2;
          ctx.strokeStyle='rgba(143,160,196,.35)';ctx.beginPath();ctx.moveTo(x0,M.t-16);ctx.lineTo(x0,M.t-12);
          ctx.lineTo(x1,M.t-12);ctx.lineTo(x1,M.t-16);ctx.stroke();
          ctx.fillStyle='#8fa0c4';ctx.fillText(g.name,(x0+x1)/2,M.t-22);
        }
        gi++;
      });
    }
  }
}
function val2px(v){const g=chartGeom,d=chartGeom.S.d;return g.M.l+(v-d.dmin)/(d.dmax-d.dmin)*g.pw;}
function px2val(px){const g=chartGeom,d=chartGeom.S.d;return clamp(d.dmin+(px-g.M.l)/g.pw*(d.dmax-d.dmin),d.dmin,d.dmax);}
function drawBand(px0,px1,label,italic){
  const g=chartGeom;
  ctx.fillStyle='rgba(255,209,102,.07)';ctx.fillRect(px0,g.M.t,px1-px0,g.ph);
  ctx.setLineDash([4,3]);ctx.strokeStyle='rgba(255,209,102,.55)';
  ctx.beginPath();ctx.moveTo(px0,g.M.t);ctx.lineTo(px0,g.M.t+g.ph);
  ctx.moveTo(px1,g.M.t);ctx.lineTo(px1,g.M.t+g.ph);ctx.stroke();ctx.setLineDash([]);
  if(label){ctx.fillStyle=ACC2;ctx.font=(italic?'italic ':'')+'10.5px Consolas,monospace';
    ctx.textAlign='center';ctx.fillText(label,(px0+px1)/2,g.M.t-5);}
}
function liveBandText(){
  const d=chartGeom.S.d,lo=px2val(Math.min(drag.x0,drag.x1)),hi=px2val(Math.max(drag.x0,drag.x1));
  return `${fnum(d,lo)} – ${fnum(d,hi)} ${d.unit||''}`;
}
function segColor(v){
  const cd=DIM[state.color];const idx=dvals(cd).findIndex(x=>String(x)===String(v));
  return cd.type==='num'?cmap((+v-cd.dmin)/(cd.dmax-cd.dmin)):CVAL[((idx%CVAL.length)+CVAL.length)%CVAL.length];
}

/* ── 画布交互 ── */
function evPos(e){const r=cv.getBoundingClientRect();return{mx:e.clientX-r.left,my:e.clientY-r.top};}
function slotFromMx(mx){
  if(!chartGeom)return -1;const g=chartGeom;
  if(mx<g.M.l||mx>g.M.l+g.pw)return -1;
  return Math.min(g.S.slots.length-1,Math.floor((mx-g.M.l)/g.pw*g.S.slots.length));
}
cv.addEventListener('pointerdown',e=>{
  const {mx}=evPos(e);const d=DIM[state.proj];
  if(d.type==='num'&&chartGeom&&mx>=chartGeom.M.l&&mx<=chartGeom.M.l+chartGeom.pw){
    drag={x0:mx,x1:mx,moved:false};cv.setPointerCapture(e.pointerId);tipEl.style.display='none';
  }
});
cv.addEventListener('pointermove',e=>{
  const {mx,my}=evPos(e);
  if(drag){drag.x1=mx;if(Math.abs(mx-drag.x0)>4)drag.moved=true;draw();return;}
  hover(mx,my,e);
});
cv.addEventListener('pointerleave',()=>{if(!drag)tipEl.style.display='none';});
window.addEventListener('pointerup',e=>{
  if(!drag)return;
  const d=DIM[state.proj];
  if(drag.moved){
    const lo=px2val(Math.min(drag.x0,drag.x1)),hi=px2val(Math.max(drag.x0,drag.x1));
    if(lo<=d.dmin+1e-9&&hi>=d.dmax-1e-9){toast('所选区间覆盖全域，未添加筛选');}
    else mutate('框选',`${d.name} ∈ ${fnum(d,lo)} – ${fnum(d,hi)} ${d.unit}`,s=>{s.filters[d.id]={kind:'range',lo,hi,via:'框选'};});
  }
  drag=null;draw();e.preventDefault();
});
cv.addEventListener('dblclick',()=>{
  const d=DIM[state.proj];
  if(state.filters[d.id])mutate('双击',`清除本维筛选 · ${d.name}`,s=>{delete s.filters[d.id];});
});
cv.addEventListener('click',e=>{
  if(drag)return;
  const d=DIM[state.proj];
  if(d.type==='num')return;
  const i=slotFromMx(evPos(e).mx);if(i<0)return;
  const s=currentStats.slots[i];const v=s.raw!==undefined?s.raw:s.key;
  toggleCatFilter(d,v);
});
function toggleCatFilter(d,v){
  const f=state.filters[d.id];const adding=!f||!f.values.includes(v);
  mutate('点选',`${d.name} ${adding?'加入':'移除'}筛选值「${dlabel(d,v)}」`,s=>{
    if(!s.filters[d.id])s.filters[d.id]={kind:'in',values:[v],via:'点选'};
    else{
      const fs=s.filters[d.id];
      fs.values=fs.values.includes(v)?fs.values.filter(x=>x!==v):[...fs.values,v];
      if(!fs.values.length)delete s.filters[d.id];
    }
  });
}

/* ── 悬停提示 ── */
const tipEl=$('#tooltip');
function hover(mx,my,e){
  if(!chartGeom){return;}
  const g=chartGeom,S=g.S;if(my<g.M.t||my>g.M.t+g.ph){tipEl.style.display='none';return;}
  const i=slotFromMx(mx);if(i<0){tipEl.style.display='none';return;}
  const s=S.slots[i],d=S.d;
  const key=s.raw!==undefined?s.raw:s.key;
  const f=state.filters[d.id];
  const pct=VIS.length?(s.vis/VIS.length*100).toFixed(1):'0.0';
  let title;
  if(S.isNum){
    const span=d.dmax-d.dmin,bw=span/NB;
    title=`${fnum(d,d.dmin+key*bw)} – ${fnum(d,d.dmin+(key+1)*bw)} ${d.unit}`;
  }else title=dlabel(d,key);
  let html=`<h4>${title}</h4>
    <div class="row"><span>可见样本</span><b>${s.vis}</b></div>
    <div class="row"><span>占可见</span><b>${pct}%</b></div>`;
  if(s.all>s.vis)html+=`<div class="row"><span>被本维筛除</span><b>${s.all-s.vis}</b></div>`;
  if(S.colorKind==='cat'){
    const top=Object.entries(s.segs).sort((a,b)=>b[1]-a[1]).slice(0,3);
    for(const[v,c]of top)html+=`<div class="row"><span>· ${dlabel(S.cd,v)}</span><b>${c}</b></div>`;
  }else if(S.colorKind==='num'&&s.cn){
    html+=`<div class="row"><span>· ${S.cd.name}均值</span><b>${fnum(S.cd,s.csum/s.cn)}</b></div>`;
  }
  html+=`<div class="tip">${S.isNum?'拖拽设区间 · 双击清除':'点击 加入/移除 筛选'}</div>`;
  tipEl.innerHTML=html;tipEl.style.display='block';
  const bw2=tipEl.offsetWidth,bh=tipEl.offsetHeight;
  let lx=mx+16,ly=my+14;
  if(lx+bw2>g.W-8)lx=mx-bw2-14; if(ly+bh>g.H-8)ly=my-bh-10;
  tipEl.style.left=lx+'px';tipEl.style.top=ly+'px';
}

/* ── 渲染：维度列表 ── */
function renderDimList(){
  const box=$('#dimList');const secs=[['分类 · 顺序 · 布尔',DIMS.filter(d=>d.type!=='num')],['数值',DIMS.filter(d=>d.type==='num')]];
  box.innerHTML=secs.map(([t,ds])=>`<div class="sec"><h3>${t}</h3>`+ds.map(d=>{
    const filtered=state.filters[d.id];
    return `<div class="dim ${state.proj===d.id?'active':''}" data-id="${d.id}" tabindex="0" role="button"
        title="${d.desc}${d.type==='num'?` · 全域 ${fnum(d,d.dmin)}–${fnum(d,d.dmax)} ${d.unit}`:''}">
      <span class="dot" style="background:${DIMC[d.id]};color:${DIMC[d.id]}"></span>
      <span class="dbody"><span class="dname">${d.name}</span>
        <span class="dmeta">${typeCN(d)}${d.type==='num'?` · ${fnum(d,d.dmin)}–${fnum(d,d.dmax)}`:` · ${dvals(d).length} 值`}</span></span>
      ${filtered?'<span class="badge f">筛选</span>':''}${state.proj===d.id?'<span class="badge p">投影</span>':''}
    </div>`;}).join('')+'</div>').join('');
  box.querySelectorAll('.dim').forEach(el=>{
    const go=()=>{const d=DIM[el.dataset.id];if(state.proj===d.id)return;
      mutate('维度列表',`切换投影 → ${d.name}`,s=>{s.proj=d.id;if(s.color===d.id)s.color=null;});
      toast(`投影已切换至「${d.name}」· 筛选 / 着色 / 历史均已保留`);};
    el.addEventListener('click',go);
    el.addEventListener('keydown',ev=>{if(ev.key==='Enter')go();});
  });
}
function typeCN(d){return d.type==='num'?'数值':d.type==='ord'?'顺序':d.type==='bool'?'布尔':'分类';}

/* ── 渲染：状态归属 chips ── */
function renderChips(){
  const box=$('#chips');const parts=[];
  const d=DIM[state.proj];
  parts.push(chipHTML({dot:DIMC[d.id],text:`投影 · <b>${d.name}</b>`,via:'维度列表',
    x:state.proj!==PROJ0,attr:`data-clear-proj="1"`,title:'点击 ✕ 将投影重置为「光谱型」'}));
  if(state.color){const cd=DIM[state.color];
    parts.push(chipHTML({dot:cd.type==='num'?'#b197fc':DIMC[cd.id],text:`着色 · <b>${cd.name}</b>`,via:'着色',
      x:true,attr:'data-clear-color="1"',title:'点击 ✕ 取消着色'}));}
  for(const id in state.filters){
    const fl=state.filters[id],dim=DIM[id];let text;
    if(fl.kind==='in'){
      const vs=fl.values.map(v=>dlabel(dim,v));
      text=`${dim.name} ∈ <b>${vs.slice(0,2).join('、')}${vs.length>2?` +${vs.length-2}`:''}</b>`;
    }else text=`${dim.name} ∈ <b>${fnum(dim,fl.lo)} – ${fnum(dim,fl.hi)} ${dim.unit}</b>`;
    parts.push(chipHTML({dot:DIMC[id],text,via:fl.via||'—',x:true,attr:`data-del="${id}"`,title:'点击 ✕ 移除该筛选'}));
  }
  const nf=Object.keys(state.filters).length;
  if(nf)parts.push(`<button class="chip clear" data-clearall="1">清除全部筛选（${nf}）</button>`);
  if(parts.length===1)parts.push('<span class="hint">暂无筛选 —— 点击柱条或拖拽直方图即可创建，状态将跨维度保留</span>');
  box.innerHTML=parts.join('');
  box.querySelectorAll('button[data-del]').forEach(el=>el.addEventListener('click',()=>{
    const id=el.dataset.del;mutate('芯片',`移除筛选 · ${DIM[id].name}`,s=>{delete s.filters[id];});}));
  const cp=box.querySelector('button[data-clear-proj]');
  if(cp)cp.addEventListener('click',()=>mutate('芯片','投影重置为 光谱型',s=>{s.proj=PROJ0;if(s.color===PROJ0)s.color=null;}));
  const cc=box.querySelector('button[data-clear-color]');
  if(cc)cc.addEventListener('click',()=>mutate('芯片','取消着色',s=>{s.color=null;}));
  const ca=box.querySelector('[data-clearall]');
  if(ca)ca.addEventListener('click',()=>mutate('芯片',`清除全部筛选（${nf} 项）`,s=>{s.filters={};}));
}
function chipHTML({dot,text,via,x,attr,title}){
  return `<span class="chip" ${title?`title="${title}"`:''}>
    <span class="cdot" style="background:${dot}"></span><span>${text}</span>
    <small>${via}</small>${x?`<button class="x" ${attr}>✕</button>`:''}</span>`;
}

/* ── 渲染：操作史 ── */
function renderHistory(){
  const ol=$('#histList');
  ol.innerHTML=metas.map((m,i)=>`<li class="hrow ${i===ptr?'current':i>ptr?'future':''}" data-i="${i}" title="点击回退至此状态">
    <div class="h1"><span>S${i} · ${VIA_ICON[m.via]||'·'} ${m.via}</span><span>${hms(m.t)}</span></div>
    <p class="hd">${m.desc}</p></li>`).reverse().join('');
  ol.querySelectorAll('.hrow').forEach(el=>el.addEventListener('click',()=>revertTo(+el.dataset.i)));
}

/* ── 渲染：图表头 / 图例 ── */
function renderChartHead(){
  const S=currentStats,d=S.d;
  $('#projTitle').innerHTML=`投影 · ${d.name}<small>${S.isNum
    ?`${fnum(d,d.dmin)}–${fnum(d,d.dmax)} ${d.unit} · 轴域固定`
    :`${S.slots.length} 值${d.clusters?' · 层级分组':''}`}</small>`;
  const lg=$('#legend');
  if(S.colorKind==='cat'){
    lg.innerHTML=dvals(S.cd).map(v=>`<span class="lg"><i style="background:${segColor(v)}"></i>${dlabel(S.cd,v)}<b>${S.legend.get(v)||0}</b></span>`).join('');
  }else if(S.colorKind==='num'){
    lg.innerHTML=`<span class="lg">${fnum(S.cd,S.cd.dmin)}</span>
      <span class="lgrad" style="background:linear-gradient(90deg,${CMAP_STOPS.map((c,i)=>`rgb(${c.join(',')}) ${i/(CMAP_STOPS.length-1)*100}%`).join(',')})"></span>
      <span class="lg">${fnum(S.cd,S.cd.dmax)} ${S.cd.unit}</span>`;
  }else lg.innerHTML='<span class="hint">单色模式 · 选择着色维度可在投影内再叠加一维</span>';
  const sel=$('#colorSel');
  const opts=['<option value="">无着色</option>'].concat(
    DIMS.filter(x=>x.id!==state.proj).map(x=>`<option value="${x.id}" ${state.color===x.id?'selected':''}>${x.name}（${typeCN(x)}）</option>`));
  sel.innerHTML=opts.join('');
}

/* ── 渲染：代表样本托盘 ── */
function renderTray(){
  const box=$('#trayCards');
  $('#trayCount').textContent=`可见 ${VIS.length} 例`;
  if(!VIS.length){box.innerHTML='<div class="card empty">当前筛选下无可见样本 —— 移除部分筛选后再探索</div>';return;}
  const rng=makeRng(fnv(filterSig())^fnv(state.proj));
  const used=new Set(),picks=[];
  while(picks.length<3&&used.size<VIS.length){
    const i=Math.floor(rng.u()*VIS.length);
    if(used.has(i))continue;used.add(i);picks.push(VIS[i]);
  }
  box.innerHTML=picks.map(r=>`<div class="card" data-id="${r.id}">
    <div class="cn"><span>${r.name} <span style="color:${DIMC.spec}">${dlabel(DIM.spec,r.spec).slice(0,3)}</span></span><span class="cid">${r.id}</span></div>
    <div class="cstats"><span>T <b>${r.tempK.toLocaleString('en-US')}K</b></span><span>M <b>${r.massSol}M☉</b></span><span>m <b>${r.magV}</b></span><span>${dlabel(DIM.zone,r.zone)}</span></div>
  </div>`).join('');
  box.querySelectorAll('.card').forEach(el=>el.addEventListener('click',()=>{
    openDetail(DATA.find(r=>r.id===el.dataset.id));}));
}

/* ── 详情卡 ── */
const detailEl=$('#detail');
function openDetail(r){
  detailEl.innerHTML=`<div class="dcard">
    <h3>${r.name}<span class="cid">${r.id} · ${r.survey}</span></h3>
    <table>${DIMS.map(d=>`<tr><td>${d.name}</td><td>${d.type==='bool'?dlabel(d,r[d.id]):fval(d,r[d.id])}</td></tr>`).join('')}</table>
    <button class="close">关闭（Esc）</button></div>`;
  detailEl.hidden=false;
  detailEl.querySelector('.close').addEventListener('click',closeDetail);
}
function closeDetail(){detailEl.hidden=true;}
detailEl.addEventListener('click',e=>{if(e.target===detailEl)closeDetail();});

/* ── Toast / 底栏 / 按钮 ── */
let toastTimer=null;
function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),2600);}
function renderStatus(){
  const nf=Object.keys(state.filters).length;
  const pct=(VIS.length/TOTAL*100).toFixed(1);
  $('#statusBar').innerHTML=`<span>可见 <b>${VIS.length.toLocaleString('en-US')}</b> / ${TOTAL.toLocaleString('en-US')}（${pct}%）· 活动筛选 <b>${nf}</b> · 投影 <b>${DIM[state.proj].name}</b>${state.color?` · 着色 <b>${DIM[state.color].name}</b>`:''} · 操作史 <b>${snaps.length}</b> 步</span>
    <span class="keys">点选柱条 = 值筛选 · 拖拽直方图 = 区间筛选 · 双击 = 清除本维 · Ctrl+Z / Ctrl+Y 回退重做</span>`;
}
function updateButtons(){
  $('#undoBtn').disabled=ptr===0;
  $('#redoBtn').disabled=ptr===snaps.length-1;
}

/* ── 总渲染 ── */
function render(){
  currentStats=computeStats();
  renderDimList();renderChips();renderHistory();renderChartHead();renderTray();renderStatus();updateButtons();
  draw();
}

/* ── 静态接线 ── */
$('#undoBtn').addEventListener('click',undo);
$('#redoBtn').addEventListener('click',redo);
$('#resetBtn').addEventListener('click',()=>mutate('按钮','重置全部（投影 / 着色 / 筛选）',s=>{s.proj=PROJ0;s.color=null;s.filters={};}));
$('#colorSel').addEventListener('change',e=>{
  const v=e.target.value||null;
  if(v===state.proj){toast('着色维度不能与投影相同');e.target.value=state.color||'';return;}
  mutate('着色',v?`着色维度 → ${DIM[v].name}`:'取消着色',s=>{s.color=v;});
});
$('#histToggle').addEventListener('click',()=>{
  $('#main').classList.toggle('histCollapsed');
  $('#histToggle').textContent=$('#main').classList.contains('histCollapsed')?'+':'—';
  requestAnimationFrame(draw);
});
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){if(!detailEl.hidden)closeDetail();else if(drag){drag=null;draw();}return;}
  if((e.ctrlKey||e.metaKey)&&!e.shiftKey&&e.key.toLowerCase()==='z'){e.preventDefault();undo();}
  else if(((e.ctrlKey||e.metaKey)&&(e.shiftKey&&e.key.toLowerCase()==='z'))||((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y')){e.preventDefault();redo();}
});
new ResizeObserver(()=>draw()).observe(cvBox);

/* ── 首屏同步就绪（无加载态）── */
$('#hdrTotal').textContent=TOTAL.toLocaleString('en-US');
render();

/* ── 可见错误横幅（任何 JS 错误立即在画面上暴露）── */
window.addEventListener('error',ev=>{
  let b=document.getElementById('errBanner');
  if(!b){b=document.createElement('div');b.id='errBanner';
    b.style.cssText='position:fixed;top:0;left:0;right:0;z-index:999;background:#7a1010;color:#fff;font:12px Consolas,monospace;padding:6px 10px;';
    document.body.appendChild(b);}
  b.textContent+=`⚠ JS错误: ${ev.message} @${ev.lineno||'?'}  `;
});

/* ── 场景引擎：?at=f=spec:K,M;p=tempK;r=tempK:3200,6000;c=lumin;u ──
 * 仅供演示/取证：与用户手势走完全相同的 mutate() 状态通道。 */
(function(){
  const at=new URLSearchParams(location.search).get('at');
  if(!at)return;
  const coerce=(d,v)=>d.type==='bool'?v==='true':v;
  for(const step of at.split(';').map(s=>s.trim()).filter(Boolean)){
    const eq=step.indexOf('='),op=eq<0?step:step.slice(0,eq),arg=eq<0?'':step.slice(eq+1);
    try{
      if(op==='f'){ const [dim,vs]=arg.split(':');const d=DIM[dim];
        vs.split(',').forEach(v=>toggleCatFilter(d,coerce(d,v))); }
      else if(op==='r'){ const [dim,ab]=arg.split(':');const d=DIM[dim];const [lo,hi]=ab.split(',').map(Number);
        mutate('框选',`${d.name} ∈ ${fnum(d,lo)} – ${fnum(d,hi)} ${d.unit}`,s=>{s.filters[dim]={kind:'range',lo,hi,via:'框选'};}); }
      else if(op==='p'){ const d=DIM[arg];
        mutate('维度列表',`切换投影 → ${d.name}`,s=>{s.proj=arg;if(s.color===arg)s.color=null;});
        toast(`投影已切换至「${d.name}」· 筛选 / 着色 / 历史均已保留`); }
      else if(op==='c'){ const v=arg||null;
        mutate('着色',v?`着色维度 → ${DIM[v].name}`:'取消着色',s=>{s.color=v;}); }
      else if(op==='u'){ undo(); }
    }catch(err){console.error('scenario step failed:',step,err);}
  }
})();
