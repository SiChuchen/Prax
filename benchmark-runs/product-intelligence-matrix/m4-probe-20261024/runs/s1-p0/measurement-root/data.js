'use strict';
/* ============================================================
 * ASTROLABE·13 数据层 —— 巡天星表（确定性生成，随首屏同步就绪）
 * 13 个维度：分类 / 顺序 / 布尔 × 8，数值 × 8 中的 5 ... 见 DIMS
 * ============================================================ */

function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function makeRng(seed){const r=mulberry32(seed);return{
  u:r,
  range:(a,b)=>a+(b-a)*r(),
  int:(a,b)=>Math.floor(a+(b-a+1)*r()),
  pick:arr=>arr[Math.floor(r()*arr.length)],
  norm:(m,s)=>{const u=Math.max(1e-9,r()),v=Math.max(1e-9,r());return m+s*Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);},
  weighted:w=>{let tot=0;for(const k in w)tot+=w[k];let x=r()*tot;for(const k in w){x-=w[k];if(x<=0)return k;}return Object.keys(w)[0];}
};}
const clamp=(v,a,b)=>v<a?a:v>b?b:v;

/* ── 维度定义（value / label 键一律用 String(value)）── */
const DIMS=[
  {id:'spec',name:'光谱型',type:'cat',
   desc:'按表面有效温度划分的光谱类别',
   values:['O','B','A','F','G','K','M'],
   labels:{O:'O 型 · 蓝紫',B:'B 型 · 蓝白',A:'A 型 · 白',F:'F 型 · 黄白',G:'G 型 · 黄',K:'K 型 · 橙',M:'M 型 · 红'},
   clusters:{'炽热型':['O','B'],'中温型':['A','F','G'],'低温型':['K','M']}},
  {id:'lumin',name:'光度级',type:'ord',
   desc:'从超巨星到亚矮星的光度分类',
   order:['Ia','Ib','II','III','IV','V','VI'],
   labels:{Ia:'Ia 极亮超巨星',Ib:'Ib 亮超巨星',II:'II 亮巨星',III:'III 巨星',IV:'IV 亚巨星',V:'V 主序星',VI:'VI 亚矮星'}},
  {id:'zone',name:'天区星域',type:'cat',
   desc:'联测覆盖的 12 个天区（按半球分组）',
   values:['LYR','CYG','CAS','PER','ORI','CMA','LEO','VIR','VEL','CAR','CEN','TEL'],
   labels:{LYR:'天琴',CYG:'天鹅',CAS:'仙后',PER:'英仙',ORI:'猎户',CMA:'大犬',LEO:'狮子',VIR:'室女',VEL:'船帆',CAR:'船底',CEN:'半人马',TEL:'望远镜'},
   clusters:{'北天':['LYR','CYG','CAS','PER'],'赤道带':['ORI','CMA','LEO','VIR'],'南天':['VEL','CAR','CEN','TEL']}},
  {id:'varType',name:'变光类别',type:'cat',
   desc:'光变性质分类',
   values:['稳定','脉动','爆发','自转','食变'],
   labels:{'稳定':'稳定','脉动':'脉动','爆发':'爆发','自转':'自转','食变':'食变'}},
  {id:'survey',name:'联测计划',type:'cat',
   desc:'样本来源的四个巡天计划',
   values:['Orion 深场','Carina 南巡','北极冠计划','散点补巡'],
   labels:{'Orion 深场':'Orion 深场','Carina 南巡':'Carina 南巡','北极冠计划':'北极冠计划','散点补巡':'散点补巡'}},
  {id:'tempK',name:'有效温度',type:'num',unit:'K',fmt:'int',desc:'恒星表面有效温度'},
  {id:'massSol',name:'质量',type:'num',unit:'M☉',fmt:'fix2',desc:'以太阳质量为单位'},
  {id:'radiusSol',name:'半径',type:'num',unit:'R☉',fmt:'fix2',desc:'以太阳半径为单位'},
  {id:'magV',name:'视星等',type:'num',unit:'mag',fmt:'fix1',desc:'视星等，数值越小越亮'},
  {id:'distPc',name:'距离',type:'num',unit:'pc',fmt:'int',desc:'距太阳系距离（秒差距）'},
  {id:'metalFe',name:'金属丰度',type:'num',unit:'dex',fmt:'fix2',desc:'[Fe/H]，越低越贫金属'},
  {id:'ageGyr',name:'年龄',type:'num',unit:'Gyr',fmt:'fix1',desc:'估计恒星年龄'},
  {id:'cert',name:'复核状态',type:'bool',
   desc:'光谱是否经过人工复核',
   values:[true,false],
   labels:{'true':'已复核','false':'未复核'}},
];
const DIM=Object.fromEntries(DIMS.map(d=>[d.id,d]));

/* ── 生成 2,600 条星表记录（含真实的维度间相关结构）── */
const GREEK=['α','β','γ','δ','ε','ζ','η','θ','ι','κ','λ','μ','ν','ξ'];
const ZONES={'北天':[['LYR','天琴'],['CYG','天鹅'],['CAS','仙后'],['PER','英仙']],
             '赤道带':[['ORI','猎户'],['CMA','大犬'],['LEO','狮子'],['VIR','室女']],
             '南天':[['VEL','船帆'],['CAR','船底'],['CEN','半人马'],['TEL','望远镜']]};
const SPEC_BY_LUM={
  V:{M:34,K:26,G:14,F:10,A:8,B:6,O:2},
  VI:{M:58,K:28,G:9,F:5},
  IV:{K:22,G:24,F:22,A:16,B:12,O:4},
  III:{M:22,K:34,G:18,F:13,A:8,B:4,O:1},
  II:{M:16,K:30,G:24,F:14,A:10,B:4,O:2},
  Ib:{M:4,K:10,G:14,F:16,A:18,B:22,O:16},
  Ia:{M:2,K:4,G:10,F:12,A:18,B:30,O:24}};
const TEMP_BASE={O:35000,B:21000,A:8800,F:6700,G:5700,K:4400,M:3200};

function generateCatalog(seed){
  const R=makeRng(seed); const recs=[];
  for(let i=0;i<2600;i++){
    const lumin=R.weighted({V:52,IV:12,III:18,II:6,Ib:5,Ia:2.5,VI:4.5});
    const spec=R.weighted(SPEC_BY_LUM[lumin]);
    const tempK=Math.round(clamp(R.norm(TEMP_BASE[spec],TEMP_BASE[spec]*0.09),2400,42000));
    const lumF={VI:.7,V:1,IV:1.35,III:2.6,II:3.4,Ib:5.5,Ia:7.5}[lumin];
    const massSol=clamp(+(Math.pow(tempK/5778,3.1)*lumF*R.range(.92,1.08)).toFixed(2),.08,42);
    const radF={VI:.4,V:1,IV:2.3,III:6.8,II:11,Ib:27,Ia:36}[lumin];
    const radiusSol=clamp(+(Math.pow(tempK/5778,.8)*radF*R.range(.9,1.1)).toFixed(2),.12,40);
    const magBase={Ia:-4,Ib:-2.6,II:-1,III:.4,IV:1.6,V:5.2,VI:6.8}[lumin];
    const magV=clamp(+(magBase+R.range(-.7,.7)).toFixed(1),-5,9.8);
    const distPc=Math.round(clamp(Math.exp(R.norm(5.1,.9)),6,1400));
    const ageGyr=clamp(+((lumin==='V'||lumin==='VI')?R.range(.3,11):R.range(2,12.8)).toFixed(1),.1,13);
    const metalFe=clamp(+(0.28-0.21*ageGyr+R.norm(0,.16)).toFixed(2),-2.5,.55);
    let varType='稳定';
    if(R.u()>=.74){
      const giant=['III','II','Ib','Ia'].includes(lumin);
      varType=R.weighted(giant?{'脉动':.6,'爆发':.1,'自转':.1,'食变':.2}
                              :{'脉动':.15,'爆发':.25,'自转':.35,'食变':.25});
    }
    const survey=R.weighted({'Orion 深场':.31,'Carina 南巡':.26,'北极冠计划':.18,'散点补巡':.25});
    const hemi=R.weighted({'Orion 深场':{'赤道带':.55,'北天':.3,'南天':.15},
                           'Carina 南巡':{'南天':.7,'赤道带':.18,'北天':.12},
                           '北极冠计划':{'北天':.85,'赤道带':.08,'南天':.07},
                           '散点补巡':{'北天':.42,'南天':.4,'赤道带':.18}}[survey]);
    const z=R.pick(ZONES[hemi]);
    const cert=R.u()<(survey==='Orion 深场'?.86:survey==='散点补巡'?.52:.7);
    const name=z[0]+' '+R.pick(GREEK)+(R.u()<.3?'-'+R.int(2,9):'');
    recs.push({id:'AST-'+(1001+i),name,spec,lumin,zone:z[0],varType,survey,
               tempK,massSol,radiusSol,magV,distPc,metalFe,ageGyr,cert});
  }
  return recs;
}

const SEED=20260902;              /* 取自基准 plan 冻结日 2026-09-02 */
const DATA=generateCatalog(SEED);
const TOTAL=DATA.length;

/* 数值维度的固定全域（轴域固定：筛选/切换不改变坐标范围） */
for(const d of DIMS){
  if(d.type==='num'){
    let mn=Infinity,mx=-Infinity;
    for(const r of DATA){const v=r[d.id];if(v<mn)mn=v;if(v>mx)mx=v;}
    d.dmin=mn;d.dmax=mx;
  }
}
