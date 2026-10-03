(function(root){
'use strict';
const DAY=86400000;
function number(x){return x===null||x===undefined||x===''?null:(Number.isFinite(Number(x))?Number(x):null);}
function clean(events,now=Date.now()){
 return events.filter(e=>e&&Number.isFinite(e.time)&&e.time>0&&e.time<=now&&Number.isFinite(e.mag)&&e.mag>=-2&&e.mag<=10&&Number.isFinite(e.lat)&&Math.abs(e.lat)<=90&&Number.isFinite(e.lon)&&Math.abs(e.lon)<=180);
}
function km(a,b){const p=Math.PI/180,x=Math.sin((b.lat-a.lat)*p/2)**2+Math.cos(a.lat*p)*Math.cos(b.lat*p)*Math.sin((b.lon-a.lon)*p/2)**2;return 12742*Math.asin(Math.sqrt(Math.min(1,x)));}
function deduplicate(events,priority={},now=Date.now()){
 const out=[];
 for(const e of clean(events,now).slice().sort((a,b)=>(priority[b.source]||0)-(priority[a.source]||0)||(b.updated||0)-(a.updated||0)||b.time-a.time)){
  const match=out.find(o=>o.source===e.source?Boolean(e.id&&o.id===e.id):Math.abs(o.time-e.time)<=15000&&km(o,e)<=20&&Math.abs(o.mag-e.mag)<=.6&&!(o.reports||[]).some(r=>r.source===e.source));
  const report={source:e.source,id:e.id,time:e.time,mag:e.mag,depth:e.depth,lat:e.lat,lon:e.lon};
  if(match)match.reports.push(report);else out.push({...e,reports:[report]});
 }
 return out.sort((a,b)=>b.time-a.time);
}
// Conditional Poisson rate test: given N events, K in t1 follows Binomial(N,t1/(t0+t1)).
function rateTest(k,n0,t1,t0){
 if(!Number.isInteger(k)||!Number.isInteger(n0)||k<0||n0<0||!(t1>0&&t0>0))return null;
 const n=k+n0,p=t1/(t1+t0);if(!n)return null;
 let logs=[],logChoose=0;
 for(let i=0;i<=n;i++){if(i>=k)logs.push(logChoose+i*Math.log(p)+(n-i)*Math.log1p(-p));if(i<n)logChoose+=Math.log(n-i)-Math.log(i+1);}
 const mx=Math.max(...logs);return Math.min(1,Math.exp(mx)*logs.reduce((a,l)=>a+Math.exp(l-mx),0));
}
function bh(ps,alpha=.05){const sorted=ps.map((p,i)=>({p,i})).filter(x=>Number.isFinite(x.p)).sort((a,b)=>a.p-b.p);let last=-1;sorted.forEach((x,i)=>{if(x.p<=alpha*(i+1)/sorted.length)last=i;});return ps.map((p,i)=>last>=0&&sorted.slice(0,last+1).some(x=>x.i===i));}
function skill(records){const r=records.filter(x=>x.status==='closed');let tp=0,fp=0,fn=0,tn=0;r.forEach(x=>{if(x.high&&x.observed)tp++;else if(x.high)fp++;else if(x.observed)fn++;else tn++;});return {n:r.length,tp,fp,fn,tn,precision:tp+fp?tp/(tp+fp):null,recall:tp+fn?tp/(tp+fn):null};}
const api={number,clean,deduplicate,rateTest,bh,skill,DAY,version:'2.1.0'};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
root.MivigeQuality=api;
})(typeof window!=='undefined'?window:globalThis);
