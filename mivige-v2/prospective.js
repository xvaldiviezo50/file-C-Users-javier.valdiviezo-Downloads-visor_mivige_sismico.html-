(function(){
'use strict';
if(typeof L==='undefined'||typeof map==='undefined')return;

const CFG={
  version:'3.5-observed-availability',
  historyH:168,
  low:40,
  high:65,
  sourceThresholds:[
    {max:1200,m:5.0,label:'regional'},
    {max:3000,m:5.5,label:'interregional'},
    {max:8000,m:6.0,label:'telesísmica'},
    {max:20050,m:6.5,label:'global/antipodal'}
  ]
};

const TARGETS=['cl_c','cl_n','pe_s','pe_c','pe_n','ec_s','ec_az','ec_c','ec_n','co_p','co_ch','pa_p','ven'];
const layer=L.layerGroup().addTo(map);
const linkLayer=L.layerGroup(); // Experimental regional links are optional; antipodes use their own strict filter.

function clamp(x,a=0,b=1){return Math.max(a,Math.min(b,x));}
function level(score){
  if(score>=CFG.high)return {name:'HIPÓTESIS · PUNTAJE ALTO',short:'Alta',color:'#e4493f'};
  if(score>=CFG.low)return {name:'HIPÓTESIS · PUNTAJE MEDIO',short:'Moderada',color:'#f0c644'};
  return {name:'HIPÓTESIS · PUNTAJE BAJO',short:'Baja',color:'#42b86b'};
}
function ageWeight(h){
  if(h<=6)return 1;
  if(h<=24)return .95;
  if(h<=72)return .82;
  if(h<=120)return .65;
  return .48;
}
function thresholdForDistance(d){
  return CFG.sourceThresholds.find(x=>d<=x.max)||CFG.sourceThresholds[CFG.sourceThresholds.length-1];
}
function bestSourceFor(st,events,now){
  const cut=now-CFG.historyH*3600e3;
  const candidates=[];
  for(const e of events){
    if(e.time<cut||e.time>now||Number(e.mag)<5)continue;
    const d=distKm(e.lat,e.lon,st.s.lat,st.s.lon);
    const th=thresholdForDistance(d);
    if(Number(e.mag)<th.m)continue;
    const h=(now-e.time)/3600e3;
    const mag=clamp((Number(e.mag)-th.m+0.4)/2.0);
    const aw=ageWeight(h);
    const score=mag*aw;
    candidates.push({e,d,th,h,score});
  }
  candidates.sort((a,b)=>b.score-a.score||b.e.mag-a.e.mag);
  return candidates[0]||null;
}
function nearestStateToEvent(states,e){
  let best=null;
  for(const st of states){
    const d=distKm(e.lat,e.lon,st.s.lat,st.s.lon);
    if(d<=st.s.r*1.4&&(!best||d<best.d))best={st,d};
  }
  return best;
}
function sourcePathScore(states,target,src){
  if(!src)return {points:0,label:'sin fuente material',sourceNode:null};
  const near=nearestStateToEvent(states,src.e);
  if(!near)return {points:6,label:'fuente remota sin continuidad tectónica directa',sourceNode:null};
  const steps=Math.abs(Number(target.s.ord)-Number(near.st.s.ord));
  const sameDirection=target.s.ord>=near.st.s.ord;
  const continuity=steps<=1?1:steps<=2?.82:steps<=3?.62:steps<=5?.38:.18;
  const dir=sameDirection?1:.75;
  return {points:16*continuity*dir,label:(sameDirection?'corredor S→N':'corredor inverso/mixto')+' · '+steps.toFixed(1)+' salto(s)',sourceNode:near.st};
}
function sequenceMemory(states,target,im){
  if(!im||im.r==null||!Array.isArray(im.pts)||im.pts.length<3)return {points:0,label:'sin cadena regional suficiente'};
  const north=im.r>0;
  const strength=clamp((Math.abs(im.r)-.25)/.75);
  const ords=im.pts.map(x=>x.st.s.ord);
  const front=north?Math.max(...ords):Math.min(...ords);
  const downstream=north?target.s.ord>=front:target.s.ord<=front;
  const pts=downstream?18*strength:8*strength;
  return {points:pts,label:(north?'frente aparente S→N':'frente aparente N→S')+' · r='+im.r.toFixed(2)+(downstream?' · receptor por delante del frente':' · receptor dentro/detrás del frente')};
}
function delayedWindow(src){
  if(!src)return {points:0,label:'sin ventana'};
  const h=src.h;
  if(h<=6)return {points:7,label:'0–6 h · respuesta inmediata'};
  if(h<=24)return {points:10,label:'6–24 h · respuesta temprana'};
  if(h<=72)return {points:12,label:'24–72 h · respuesta retardada'};
  if(h<=168)return {points:7,label:'3–7 d · memoria post-sísmica'};
  return {points:0,label:'fuera de memoria'};
}
function receiverScore(st){
  const ids=12*clamp(st.ids/100);
  const rate=8*clamp((st.rateRatio-.8)/2.2);
  return {points:ids+rate,label:'IDS '+st.ids.toFixed(0)+' · tasa ×'+st.rateRatio.toFixed(2)};
}
function dynamicScore(st,model){
  const d=model?.dyn?.by?.[st.s.id];
  if(!d)return {points:0,label:'IITE-D sin evaluar'};
  if(String(d.state||'').startsWith('tamiz dinámico compatible'))return {points:10,label:'IITE-D compatible a contrastar'};
  return {points:0,label:'sin respuesta dinámica anómala demostrada'};
}
function antipodeContinuous(st){
  const net=window.mivigeAntipodeNetworkV2, now=Date.now();
  if(!net||!Array.isArray(net.receivers)||!Array.isArray(window.allEvents||[]))return {value:null,label:'antípoda continua N/A'};
  const r=net.receivers.find(q=>q.id===st.s.id); if(!r)return {value:null,label:'receptor antipodal N/A'};
  const ap={lat:-r.lat,lon:r.lon<0?r.lon+180:r.lon-180};
  const pool=(window.allEvents||[]).filter(e=>['USGS','EMSC'].includes(e.source)&&e.time>=now-72*3600e3&&e.time<=now&&Number(e.mag)>=5)
    .map(e=>({e,d:distKm(ap.lat,ap.lon,e.lat,e.lon)})).filter(q=>q.d<=560);
  if(!pool.length)return {value:0,label:'sin fuente M≥5,0 en núcleo/halo durante 72 h'};
  pool.sort((a,b)=>{
    const sa=(Math.min(1,Math.max(0,(Number(a.e.mag)-5)/2))*.55 + Math.max(0,1-a.d/560)*.30 + Math.max(0,1-(now-a.e.time)/(72*3600e3))*.15);
    const sb=(Math.min(1,Math.max(0,(Number(b.e.mag)-5)/2))*.55 + Math.max(0,1-b.d/560)*.30 + Math.max(0,1-(now-b.e.time)/(72*3600e3))*.15);return sb-sa;
  });
  const q=pool[0],mag=Math.min(1,Math.max(0,(Number(q.e.mag)-5)/2)),geo=Math.max(0,1-q.d/560),age=Math.max(0,1-(now-q.e.time)/(72*3600e3));
  const value=100*(.55*mag+.30*geo+.15*age);
  return {value,label:'challenger antipodal continuo · M'+Number(q.e.mag).toFixed(1)+' · '+(q.d<=225?'núcleo':'halo')+' · '+Math.round(q.d)+' km',hit:q};
}
function antipodeScore(st){
  const net=window.mivigeAntipodeNetworkV2;
  if(!net||!Array.isArray(net.active))return {points:0,label:'sin fuente antipodal activa'};
  const hit=net.active.find(x=>x.r&&x.r.id===st.s.id);
  if(!hit)return {points:0,label:'sin fuente antipodal activa'};
  const d=Number(hit.src?.d);
  const pts=d<=225?10:d<=560?5:0;
  return {points:pts,label:(d<=225?'núcleo antipodal':d<=560?'halo antipodal':'sin activación antipodal')+' · '+Math.round(d)+' km',hit};
}
function sstScore(st){
  const s=window.mivigeSSTSignals&&window.mivigeSSTSignals[st.s.id];
  if(!s||!s.valid)return {points:0,label:'sin anomalía SST válida'};
  const pts=Math.min(5,5*Number(s.strength||0));
  return {points:pts,label:'SST anómala · z '+(Number.isFinite(s.z)?s.z.toFixed(1):'NA')};
}
function releaseAttenuation(states,target,path){
  if(!path.sourceNode)return {points:0,label:'sin nodos intermedios evaluables'};
  const a=path.sourceNode.s.ord,b=target.s.ord;
  const lo=Math.min(a,b),hi=Math.max(a,b);
  const mids=states.filter(x=>x.s.ord>lo&&x.s.ord<hi&&Number.isFinite(x.mr));
  if(!mids.length)return {points:0,label:'sin nodo intermedio'};
  const peak=Math.max(...mids.map(x=>Number(x.mr||0)));
  const penalty=peak>=10?6:peak>=4?3:0;
  return {points:-penalty,label:penalty?('atenuación experimental por liberación intermedia · pico momento/fondo ×'+peak.toFixed(1)):'sin atenuación experimental relevante'};
}
function quiescenceContext(st){
  if(st.rateRatio<.55&&st.prev.length>=4)return {points:2,label:'quiescencia relativa tras actividad previa · experimental'};
  return {points:0,label:'sin quiescencia relativa destacada'};
}
function confidence(model,st,src,dyn){
  let c=.55*Number(model?.idq?.score||0);
  if(st.mcInfo?.confidence==='media')c+=12; else c+=5;
  if(model?.idg?.coherent)c+=18;
  if(dyn.points>0)c+=10;
  if(src)c+=5;
  c=Math.min(100,Math.round(c));
  return {score:c,label:c>=75?'alta':c>=55?'moderada':'baja'};
}
function scoreOne(model,st,events,now){
  const src=bestSourceFor(st,events,now);
  const sourcePts=src?20*src.score:0;
  const coulomb=window.mivigeCoulomb&&window.mivigeCoulomb[st.s.id];
  const path=(coulomb&&coulomb.evaluable&&Number.isFinite(coulomb.score))?{points:coulomb.score,label:'Coulomb ΔCFS evaluable · '+(coulomb.label||'resultado disponible'),sourceNode:null,evaluable:true,value:clamp((coulomb.score+100)/200)*100}:{points:0,label:'Coulomb N/A · requiere mecanismo/ruptura y geometría receptora',sourceNode:null,evaluable:false,value:null};
  const seq={points:0,label:'orden de epicentros excluido de la proyección física'};
  const delay=delayedWindow(src);
  const recv=receiverScore(st);
  const dyn=dynamicScore(st,model);
  const anti=antipodeScore(st);
  const antiContinuous=antipodeContinuous(st);
  const sst=sstScore(st);
  const release={points:0,label:'descarga regional no inferida del momento sísmico'};
  const quiet=quiescenceContext(st);
  // Physics v1: only evaluable physical/observational channels enter the core score.
  // Challenger channels (antipode/SST) are retained for prospective validation but contribute 0 to core.
  const components=[
    // Validation track: preserve the pre-Coulomb weights so the historical signal is comparable over time.
    // Coulomb is scientific evidence shown separately and NEVER changes this experimental pattern score.
    {id:'source',value:src?100*src.score:null,weight:.25},
    {id:'receiver',value:st.hist.length?100*clamp((recv.points)/20):null,weight:.45},
    {id:'dynamic',value:model?.dyn?.by?.[st.s.id]?.source&&model.dyn.by[st.s.id].after>=5?100*clamp(dyn.points/10):null,weight:.15},
    {id:'geodesy',value:(st.idg&&st.idg.used>=3&&!String(st.idg.state).includes('atrasado'))?(st.idg.candidate?70:25):null,weight:.15}
  ];
  const evals=components.filter(x=>Number.isFinite(x.value));
  const w=evals.reduce((a,x)=>a+x.weight,0);
  let score=w?evals.reduce((a,x)=>a+x.value*x.weight,0)/w:0;
  score=Math.max(0,Math.min(100,score));
  const coverage=Math.round(100*w);
  const conf={score:coverage,label:'cobertura física '+coverage+'%'};
  return {components,hasEvidence:w>0,st,src,sourcePts,path,seq,delay,recv,dyn,anti,antiContinuous,sst,release,quiet,score,coverage:conf.score,conf,level:level(score),physicsVersion:CFG.version};
}
function fmtSource(x){
  if(!x||!x.src)return 'sin fuente material';
  const e=x.src.e;
  return 'M'+e.mag.toFixed(1)+' · '+Math.round(x.src.d)+' km · '+ecuTime(e.time)+' · '+(e.place||e.source);
}
function ensureCard(){
  if(document.getElementById('prospectiveEngineV2'))return;
  const aside=document.querySelector('aside');if(!aside)return;
  const c=document.createElement('section');c.className='card';c.id='prospectiveEngineV2';
  c.innerHTML='<h2>🎯 Proyección prospectiva experimental · MIVIGE</h2>'+
    '<div class="small">Esta salida es una <b>pista experimental de validación del patrón</b>, separada de la evidencia científica. Mantiene congeladas las ponderaciones pre-Coulomb: fuente 25%, respuesta observada del receptor 45%, tamiz dinámico 15% y GNSS 15% cuando son evaluables. <b>Coulomb no modifica esta alerta</b>: se conserva como evidencia científica independiente. Antípoda y SST también se registran como challengers para comprobar su desempeño prospectivo. La antípoda continua M≥5,0 combina magnitud, proximidad geométrica y edad del evento, pero no modifica el puntaje V1 mientras no supere validación contra baseline. <b>No es una probabilidad calibrada de terremoto.</b></div>'+
    '<div class="kpis" style="margin-top:8px">'+
      '<div class="kpi"><div class="name">Zona principal</div><div class="val" id="ppeTopDetail">—</div></div>'+
      '<div class="kpi"><div class="name">Nivel</div><div class="val" id="ppeLevel">—</div></div>'+
      '<div class="kpi"><div class="name">Validación predictiva</div><div class="val" id="ppeConfidence">—</div></div>'+
      '<div class="kpi"><div class="name">Fuente dominante</div><div class="val" id="ppeSource">—</div></div>'+
    '</div><div id="ppeRows" style="margin-top:8px"></div>'+
    '<details style="margin-top:8px"><summary>Qué se añadió respecto del visor anterior</summary><div class="small" style="margin-top:6px">'+
      '<b>Memoria:</b> 7 días, no solo 72 h. <b>Dirección física:</b> pendiente de cálculo; no se extrapola una cadena de epicentros. <b>Umbral fuente:</b> M5 regional, M5.5 interregional, M6 telesísmico y M6.5 global/antipodal. <b>Retardo:</b> 0–6, 6–24, 24–72 h y 3–7 d. <b>Descarga intermedia:</b> aporte desactivado hasta disponer de un cálculo físico. <b>Antípoda/SST:</b> modificadores explícitos del receptor.</div></details>';
  const h=[...document.querySelectorAll('section.card h2')].find(x=>/Alerta sísmica experimental/i.test(x.textContent||''));
  h?h.parentElement.insertAdjacentElement('afterend',c):aside.insertBefore(c,aside.firstChild);
}
function draw(results){
  layer.clearLayers();linkLayer.clearLayers();
  for(const x of results){
    const st=x.st,c=x.level.color;
    L.marker([st.s.lat,st.s.lon],{icon:L.divIcon({className:'prospective-symbol',html:'<span style="display:block;color:'+c+';font-size:19px;line-height:18px">◇</span>',iconSize:[18,18],iconAnchor:[9,9]})})
      .bindPopup('<b>'+st.s.name+'</b><br><b>'+x.level.name+'</b> · '+x.score.toFixed(0)+'/100<br>Validación predictiva: '+x.conf.label+'<br>Fuente: '+fmtSource(x)+'<br>'+x.seq.label+'<br>'+x.anti.label)
      .addTo(layer);
    if(x.src&&x.score>=CFG.low){
      L.polyline([[x.src.e.lat,x.src.e.lon],[st.s.lat,st.s.lon]],{color:c,weight:2.5,dashArray:'8 6',opacity:.72})
        .bindTooltip(x.level.name+' · '+st.s.name).addTo(linkLayer);
    }
  }
}
function snapshotOf(x){return {time:Date.now(),score:x.score,level:x.level.short,components:{source:x.src?100*x.src.score:null,receiver:100*clamp(x.recv.points/20),dynamic:100*clamp(x.dyn.points/10),geodesy:(x.st.idg&&x.st.idg.used>=3)?(x.st.idg.candidate?70:25):null}};}
function audit(results){let old={};try{old=JSON.parse(localStorage.getItem('mivige-pattern-audit-v2')||'{}');}catch(_){} const out={};for(const x of results){const prev=old[x.st.s.id]||null,cur=snapshotOf(x);x.audit={prev,delta:prev?cur.score-prev.score:null,componentDelta:{}};if(prev&&prev.components){for(const k of Object.keys(cur.components)){const a=cur.components[k],b=prev.components[k];x.audit.componentDelta[k]=(Number.isFinite(a)&&Number.isFinite(b))?a-b:null;}}out[x.st.s.id]=cur;}try{localStorage.setItem('mivige-pattern-audit-v2',JSON.stringify(out));}catch(_){} }
function freezeForecast(results,now){
  const key='mivige-prospective-ledger-v2'; let ledger=[]; try{ledger=JSON.parse(localStorage.getItem(key)||'[]');}catch(_){}
  const top5=results.slice(0,5).map((x,i)=>({rank:i+1,zoneId:x.st.s.id,zone:x.st.s.name,score:+x.score.toFixed(1),level:x.level.short,window:'24–72 h',components:{source:+x.sourcePts.toFixed(1),receiver:+x.recv.points.toFixed(1),dynamic:+x.dyn.points.toFixed(1),antipode:+x.anti.points.toFixed(1),sst:+x.sst.points.toFixed(1)}}));
  const bucket=Math.floor(now/(6*3600e3));
  if(!ledger.some(x=>x.bucket===bucket)){ledger.push({bucket,time:now,model:CFG.version,top5,status:'ABIERTA',closes:now+72*3600e3});ledger=ledger.slice(-120);try{localStorage.setItem(key,JSON.stringify(ledger));}catch(_){}}
  return ledger;
}
function renderLedger(ledger){
  const h=document.getElementById('forecastLedger'); if(!h)return;
  const a=(ledger||[]).slice().reverse().slice(0,5);
  h.innerHTML=a.length?a.map(x=>'<div class="listitem"><div><div class="zname">'+new Date(x.time).toLocaleString('es-EC')+' · '+x.status+'</div><div class="zdesc">'+x.top5.map(q=>'#'+q.rank+' '+q.zone+' '+q.score+'/100').join(' · ')+'</div></div></div>').join(''):'El primer corte prospectivo se registrará automáticamente.';
}
function auditText(x){const a=x.audit;if(!a||!a.prev)return 'línea base creada en este dispositivo';const ds=(a.delta>=0?'+':'')+a.delta.toFixed(1);const names={source:'fuente',receiver:'receptor',dynamic:'dinámica',geodesy:'GNSS'};const parts=Object.entries(a.componentDelta).filter(([,v])=>Number.isFinite(v)&&Math.abs(v)>=.05).sort((A,B)=>Math.abs(B[1])-Math.abs(A[1])).map(([k,v])=>names[k]+' '+(v>=0?'+':'')+v.toFixed(1));return 'anterior '+a.prev.score.toFixed(1)+'/100 ('+a.prev.level+') · Δ '+ds+(parts.length?' · cambios: '+parts.join(' · '):' · sin cambio material de componentes');}
function setTopLabel(value){['ppeTop','ppeTopDetail'].forEach(id=>{const el=document.getElementById(id);if(el)el.textContent=value;});}
function render(){
  ensureCard();
  const model=window.mivigeV2;
  if(!model||!Array.isArray(model.states)||!Array.isArray(allEvents))return;
  const now=Date.now();
  const results=model.states.filter(st=>TARGETS.includes(st.s.id)).map(st=>scoreOne(model,st,allEvents,now)).filter(x=>x.hasEvidence).sort((a,b)=>b.score-a.score);
  audit(results);
  if(results.length){const ledger=freezeForecast(results,now);renderLedger(ledger);}else{const el=document.getElementById('forecastLedger');if(el)el.textContent='Sin observaciones evaluables; no se registra un corte vacío.';}
  const top=results[0];
  if(!top){layer.clearLayers();linkLayer.clearLayers();document.getElementById('ppeLevel').textContent='SIN EVALUACIÓN PROSPECTIVA';document.getElementById('ppeRows').textContent='Esperando al menos un segmento definido. La capa experimental usa los catálogos abiertos disponibles y conserva la cobertura/calidad como dato separado.';setTopLabel('—');document.getElementById('ppeSource').textContent='—';document.getElementById('ppeConfidence').textContent='No validada';window.mivigeProspectiveV2={time:now,results:[],config:CFG};window.dispatchEvent(new Event('mivige:prospective'));return;}

  setTopLabel(top.st.s.name);
  document.getElementById('ppeLevel').textContent=top.level.name+' · '+top.score.toFixed(0)+'/100';
  document.getElementById('ppeLevel').style.color=top.level.color;
  document.getElementById('ppeConfidence').textContent=top.conf.label;
  document.getElementById('ppeSource').textContent=fmtSource(top);

  document.getElementById('ppeRows').innerHTML=results.slice(0,5).map((x,i)=>{
    const rankColor=i===0?'#e4493f':i===1?'#f08a24':i===2?'#f0c644':'#42b86b';
    const rankLabel='PRIORIDAD '+(i+1);
    const signals=[];
    if(x.src)signals.push('fuente M'+x.src.e.mag.toFixed(1));
    if(x.recv&&x.recv.points>0)signals.push('respuesta receptor');
    if(x.dyn&&x.dyn.points>0)signals.push('activación dinámica');
    if(x.anti&&x.anti.points>0)signals.push('antípoda challenger');
    if(x.sst&&x.sst.points>0)signals.push('SST challenger');
    return '<div style="border:2px solid '+rankColor+';border-left-width:8px;border-radius:10px;padding:10px 12px;margin:8px 0;background:rgba(255,255,255,.035)">'+
      '<div style="display:flex;justify-content:space-between;gap:10px;align-items:center"><div><b style="color:'+rankColor+'">'+rankLabel+'</b> · <b>'+x.st.s.name+'</b></div><div style="font-size:20px;font-weight:800;color:'+rankColor+'">'+x.score.toFixed(0)+'/100</div></div>'+
      '<div class="small" style="margin-top:5px"><b>Proyección experimental:</b> '+x.level.short+' · <b>ventana:</b> '+x.delay.label+'</div>'+
      '<div class="small"><b>Señales activas:</b> '+(signals.length?signals.join(' · '):'actividad del receptor')+'</div>'+
      '<details style="margin-top:5px"><summary>Ver fundamento y trazabilidad</summary><div class="small"><b>Fuente:</b> '+fmtSource(x)+'<br><b>Componentes:</b> fuente '+x.sourcePts.toFixed(1)+' · receptor '+x.recv.points.toFixed(1)+' · IITE-D '+x.dyn.points.toFixed(1)+' · antípoda '+x.anti.points.toFixed(1)+' · SST '+x.sst.points.toFixed(1)+'<br><b>Trazabilidad:</b> '+auditText(x)+'</div></details></div>';
  }).join('');


  draw(results);
  window.mivigeProspectiveV2={time:now,results,top,config:CFG};window.dispatchEvent(new Event('mivige:prospective'));
}
ensureCard();
try{L.control.layers({},{
  'Proyección experimental · zonas':layer,
  'Proyección experimental · vínculos fuente→receptor':linkLayer
},{collapsed:false,position:'topright'}).addTo(map);}catch(_){}
window.addEventListener('mivige:model',render);
setTimeout(render,3800);
setInterval(render,60000);
const b=document.getElementById('refresh');if(b)b.addEventListener('click',()=>setTimeout(render,3000));
})();
