/* MIVIGE quiescence observer: descriptive rate comparisons, NOT a forecast.
 * Pure functions are accessible for independent tests; no side effects on the core ranking.
 */
(function(root){
'use strict';
const DAY=86400000;
const WINDOWS=[
 {id:'24h',label:'24 h',recentDays:1,baselineDays:30,baselineOffsetDays:1},
 {id:'72h',label:'72 h',recentDays:3,baselineDays:30,baselineOffsetDays:3},
 {id:'30d',label:'30 días',recentDays:30,baselineDays:60,baselineOffsetDays:30}
];
function isFiniteEvent(e,now){
 return e&&Number.isFinite(Number(e.time))&&Number(e.time)>now-90*DAY&&Number(e.time)<=now&&
  Number.isFinite(Number(e.mag))&&Number(e.mag)>=3.5;
}
function lowerTail(k,n0,t1,t0){
 // Exact one-sided conditional binomial tail: K | (K+N0).
 // The null hypothesis is equal seismic-event rates during the two intervals.
 if(!Number.isInteger(k)||!Number.isInteger(n0)||k<0||n0<0||t1<=0||t0<=0||k+n0===0)return null;
 const total=k+n0,p=t1/(t0+t1);
 let lc=0,logs=[];
 for(let i=0;i<=k;i++){
  logs.push(lc+i*Math.log(p)+(total-i)*Math.log1p(-p));
  lc+=Math.log(total-i)-Math.log(i+1);
 }
 const peak=Math.max(...logs);
 return Math.min(1,Math.exp(peak)*logs.reduce((sum,x)=>sum+Math.exp(x-peak),0));
}
function evaluate(events,now=Date.now()){
 if(!Array.isArray(events))return [];
 const valid=events.filter(e=>isFiniteEvent(e,now));
 return WINDOWS.map(w=>{
  const recentStart=now-w.recentDays*DAY;
  const baseEnd=now-w.baselineOffsetDays*DAY;
  const baseStart=baseEnd-w.baselineDays*DAY;
  const recent=valid.filter(e=>Number(e.time)>recentStart&&Number(e.time)<=now).length;
  const baseline=valid.filter(e=>Number(e.time)>baseStart&&Number(e.time)<=baseEnd).length;
  const sufficient=baseline>=20; // A small reference is not a quiescence baseline.
  const rate=recent/w.recentDays;
  const baseRate=baseline/w.baselineDays;
  const ratio=baseRate>0?rate/baseRate:null;
  const p=sufficient?lowerTail(recent,baseline,w.recentDays,w.baselineDays):null;
  return {id:w.id,label:w.label,recent,baseline,recentDays:w.recentDays,
   baselineDays:w.baselineDays,rate,baseRate,ratio,p,q:null,sufficient,
   state:sufficient?'observado':'muestra insuficiente'};
 });
}
function correctFDR(regions){
 // Benjamini-Hochberg over ALL available region-window comparisons.
 // Overlapping windows and clustered aftershocks violate simple independence;
 // adjusted significance is only a descriptive flag, never a hazard warning.
 const all=regions.flatMap(r=>(r.windows||[]).map(w=>w));
 const tests=all.filter(w=>w.sufficient&&Number.isFinite(w.p)).sort((a,b)=>a.p-b.p);
 let q=1;
 for(let i=tests.length-1;i>=0;i--){
  q=Math.min(q,tests[i].p*tests.length/(i+1));
  tests[i].q=q;
 }
 for(const w of all){
  w.state=!w.sufficient?'muestra insuficiente':
    Number.isFinite(w.ratio)&&w.ratio<=0.5&&w.q<=0.05?
      'descenso estadístico preliminar':'sin descenso estadístico verificado';
 }
 return regions;
}
const api={DAY,WINDOWS,lowerTail,evaluate,correctFDR,version:'1.0.0'};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
root.MivigeQuiescenceCore=api;
})(typeof window!=='undefined'?window:globalThis);
