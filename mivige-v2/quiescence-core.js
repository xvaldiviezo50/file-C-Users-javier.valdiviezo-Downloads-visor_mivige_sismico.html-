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
function distanceKm(a,b){
 const p=Math.PI/180;
 const x=Math.sin((b.lat-a.lat)*p/2)**2+
   Math.cos(a.lat*p)*Math.cos(b.lat*p)*Math.sin((b.lon-a.lon)*p/2)**2;
 return 12742*Math.asin(Math.sqrt(Math.min(1,x)));
}
function localPairs(events){
 // Fraction with a predecessor within 24 hours and 50 km.
 // Counts event clustering, never resolves the rupture mechanism.
 const ordered=events.slice().sort((a,b)=>a.time-b.time);
 let matched=0;
 for(let i=0;i<ordered.length;i++){
  const e=ordered[i];
  for(let j=i-1;j>=0;j--){
   const prior=ordered[j];
   if(e.time-prior.time>DAY)break;
   if(distanceKm(e,prior)<=50){matched++;break;}
  }
 }
 return ordered.length?matched/ordered.length:null;
}
function spatialContext(events,now=Date.now()){
 const valid=(events||[]).filter(e=>isFiniteEvent(e,now)&&Number.isFinite(Number(e.lat))&&Number.isFinite(Number(e.lon))&&
  Math.abs(Number(e.lat))<=90&&Math.abs(Number(e.lon))<=180);
 const current=valid.filter(e=>e.time>now-30*DAY&&e.time<=now);
 const previous=valid.filter(e=>e.time>now-60*DAY&&e.time<=now-30*DAY);
 if(current.length<8||previous.length<8){
  return {evaluable:false,current:current.length,previous:previous.length,
   clusterRecent:null,clusterPrevious:null,centroidShiftKm:null,reason:'menos de 8 eventos geolocalizados por período'};
 }
 const centre=a=>({lat:a.reduce((s,e)=>s+Number(e.lat),0)/a.length,
  lon:a.reduce((s,e)=>s+Number(e.lon),0)/a.length});
 return {evaluable:true,current:current.length,previous:previous.length,
  clusterRecent:localPairs(current),clusterPrevious:localPairs(previous),
  centroidShiftKm:distanceKm(centre(current),centre(previous)),
  reason:'indicador descriptivo, no migración tectónica causal'};
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
const api={DAY,WINDOWS,lowerTail,evaluate,correctFDR,spatialContext,version:'1.1.0'};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
root.MivigeQuiescenceCore=api;
})(typeof window!=='undefined'?window:globalThis);
