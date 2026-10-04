/* Prospective hypothesis ledger. No probability calibration or scientific-alert effects. */
(function(){
'use strict';
const KEY='mivige-hypotheses-v1',VERSION='1.0.0',DAY=86400000;
const defs=[
['combined','Modelo combinado',x=>x.score>=65],
['source','Fuente regional/remota',x=>x.sourcePts>0],
['path','Continuidad tectónica',x=>x.path.points>0],
['sequence','Migración secuencial',x=>x.seq.points>0],
['delay','Ventana retardada',x=>x.delay.points>0],
['dynamic','Interacción dinámica',x=>x.dyn.points>0],
['antipode','Correspondencia antipodal',x=>x.anti.points>0],
['sst','SST persistente',x=>x.sst.points>0],
['release','Atenuación intermedia',x=>x.release.points<0],
['quiet','Quiescencia relativa',x=>x.quiet.points>0],
['withoutSequence','Combinado sin migración',x=>x.score-x.seq.points>=65],
['withoutAntipode','Combinado sin antípoda',x=>x.score-x.anti.points>=65],
['withoutSST','Combinado sin SST',x=>x.score-x.sst.points>=65],
['withoutRelease','Combinado sin atenuación',x=>x.score-x.release.points>=65]
];
let records=[],snapshots={},storageOK=true;
try{const a=JSON.parse(localStorage.getItem(KEY)||'{}');records=Array.isArray(a.records)?a.records:[];snapshots=a.snapshots||{};}catch(_){storageOK=false;}
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const time=t=>new Date(t).toLocaleString('es-EC',{timeZone:'America/Guayaquil',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
const national=z=>({'Ecuador':'IG-EPN','Perú':'IGP','Colombia':'SGC','Chile':'USGS','Venezuela':'USGS'}[z.country]);
function feedOK(name,now){
 const s=typeof sourceStatus!=='undefined'?sourceStatus[name]:null;
 return !!(s?.ok&&!s.truncated&&Number.isFinite(s.fetchedAt)&&now-s.fetchedAt>=0&&now-s.fetchedAt<15*60000);
}
function usable(id,x,model){
 if(id==='sst'||id==='withoutSST')return Number.isFinite(window.mivigeSSTSignals?.[x.st.s.id]?.z);
 if(id==='sequence'||id==='withoutSequence')return Number.isFinite(model?.im?.r)&&model.im.pts?.length>=3;
 return true;
}
function classify(active,observed){return active?(observed?'coincidence':'falseAlarm'):(observed?'omission':'correctNegative');}
function save(){try{localStorage.setItem(KEY,JSON.stringify({version:VERSION,records,snapshots}));}catch(_){storageOK=false;}}
const card=document.createElement('section');card.className='card';card.id='hypothesisValidation';
card.innerHTML='<h2>Ventanas experimentales · seguimiento y validación</h2><p class="small">Objetivos separados: M≥4,5 y M≥6,0; horizontes de 24 y 72 h desde el registro. Cada hipótesis se congela antes de observar el resultado. Una coincidencia temporal no demuestra causalidad.</p><div id="hypothesisStatus"></div><label>Objetivo <select id="hypothesisMag"><option value="4.5">M≥4,5</option><option value="6">M≥6,0</option></select></label> <label>Ventana <select id="hypothesisHours"><option value="24">24 h</option><option value="72">72 h</option></select></label><div id="hypothesisMetrics"></div><details><summary>Ventanas registradas y criterios</summary><p class="small">Combinado: ≥65/100. Capas individuales: aporte mayor que cero; atenuación: aporte negativo. Las variantes sin capa usan el mismo corte de 65, sin reajustarlo. Son controles exploratorios, no un modelo ETAS ni probabilidades. La atenuación se evalúa como asociación; su mejora se contrasta con la variante sin atenuación.</p><div id="hypothesisWindows" style="max-height:320px;overflow:auto"></div></details><button id="hypothesisExport">Descargar registro y datos de entrada</button><p class="small">Registro local en este navegador: funciona mientras el visor está abierto y se conserva al volver. No es un archivo público inmutable. Resultados provisionales por revisiones del catálogo. Ventanas de una misma hipótesis/zona/objetivo/horizonte no se superponen; otros horizontes, zonas y capas sí pueden compartir eventos. No sumar sus coincidencias como pruebas independientes. Sin evaluación suficiente no se declara fallo ni ausencia de sismo.</p>';
document.querySelector('aside').appendChild(card);
function display(){
 const mag=Number(document.getElementById('hypothesisMag').value),hours=Number(document.getElementById('hypothesisHours').value);
 const rows=records.filter(r=>r.targetMag===mag&&r.hours===hours);
 document.getElementById('hypothesisStatus').textContent=(storageOK?'Registro guardado localmente. ':'No se pudo guardar; exporta antes de cerrar. ')+records.filter(r=>r.status==='pending').length+' ventanas abiertas. '+(records.length?'':'Esperando zonas con catálogos suficientes; no se generan proyecciones con datos incompletos.');
 document.getElementById('hypothesisMetrics').innerHTML='<table class="table"><thead><tr><th>Hipótesis</th><th>Abiertas</th><th>Coinc.</th><th>Falsas</th><th>Omis.</th><th>Neg.</th><th>No eval.</th></tr></thead><tbody>'+defs.map(([id,label])=>{
 const a=rows.filter(r=>r.hypothesis===id),n=s=>a.filter(r=>r.status===s).length;
 return '<tr><td>'+label+'</td>'+['pending','coincidence','falseAlarm','omission','correctNegative','unverifiable'].map(s=>'<td>'+n(s)+'</td>').join('')+'</tr>';
 }).join('')+'</tbody></table>';
 const labels={pending:'abierta',coincidence:'coincidencia',falseAlarm:'falsa alarma experimental',omission:'omisión',correctNegative:'negativo correcto',unverifiable:'no evaluable'};
 document.getElementById('hypothesisWindows').innerHTML=rows.slice(-80).reverse().map(r=>'<p class="small"><b>'+esc(r.label)+' · '+esc(r.zone.name)+'</b><br>'+time(r.start)+' → '+time(r.end)+' (Ecuador)<br>M≥'+r.targetMag+' · '+(r.active?'señal activa':'control sin señal')+' · '+labels[r.status]+(r.reason?' · '+esc(r.reason):'')+'</p>').join('')||'<p class="small">Aún no hay ventanas para esta selección.</p>';
}
function run(){
 const now=Date.now(),p=window.mivigeProspectiveV2,model=window.mivigeV2;
 if(!Array.isArray(typeof allEvents!=='undefined'?allEvents:null)){display();return;}
 let changed=false;
 for(const r of records.filter(r=>r.status==='pending'&&now>=r.end)){
  if(now-r.start>7*DAY){r.status='unverifiable';r.reason='Ventana fuera del catálogo móvil; falta archivo completo';changed=true;continue;}
  if(!feedOK(national(r.zone),now)){r.reason='Esperando catálogo nacional vigente y completo';continue;}
  const found=allEvents.filter(e=>e.time>=r.start&&e.time<r.end&&e.mag>=r.targetMag&&distKm(e.lat,e.lon,r.zone.lat,r.zone.lon)<=r.zone.r&&(!r.zone.depth||(Number.isFinite(e.depth)&&e.depth>=r.zone.depth[0]&&e.depth<=r.zone.depth[1])));
  r.events=found.map(e=>({id:e.id,source:e.source,time:e.time,mag:e.mag,lat:e.lat,lon:e.lon,depth:e.depth}));
  r.observed=found.length>0;r.status=classify(r.active,r.observed);r.evaluatedAt=now;r.provisional=true;delete r.reason;changed=true;
 }
 if(p&&now-p.time>=0&&now-p.time<=90000&&feedOK('USGS',now)){
 for(const x of p.results||[]){
  if(!x.st.dataReady||!feedOK(national(x.st.s),now))continue;
  for(const [id,label,test] of defs){
   if(!usable(id,x,model))continue;
   for(const hours of [24,72])for(const targetMag of [4.5,6]){
    if(records.some(r=>r.hypothesis===id&&r.zone.id===x.st.s.id&&r.hours===hours&&r.targetMag===targetMag&&r.status==='pending'))continue;
    const sid=String(now);
    if(!snapshots[sid])snapshots[sid]={issuedAt:now,catalogueCut:p.time,sourceStatus:JSON.parse(JSON.stringify(sourceStatus)),events:allEvents.filter(e=>e.time>=now-7*DAY).map(e=>({id:e.id,source:e.source,time:e.time,mag:e.mag,lat:e.lat,lon:e.lon,depth:e.depth})),sst:window.mivigeSSTSignals||{},config:p.config};
    const components={};for(const k of ['path','seq','delay','recv','dyn','anti','sst','release','quiet'])components[k]={points:x[k].points,label:x[k].label};
    records.push({version:VERSION,hypothesis:id,label,start:now,end:now+hours*3600000,hours,targetMag,zone:{...x.st.s},active:!!test(x),status:'pending',score:x.score,components,sourcePoints:x.sourcePts,sourceEvent:x.src?.e||null,snapshotId:sid});
    changed=true;
   }
  }
 }
 }
 if(changed)save();display();
}
document.getElementById('hypothesisMag').onchange=display;document.getElementById('hypothesisHours').onchange=display;
document.getElementById('hypothesisExport').onclick=()=>{
 const blob=new Blob([JSON.stringify({version:VERSION,exportedAt:new Date().toISOString(),storageOK,records,snapshots},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download='mivige-ventanas-experimentales-v1.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
window.addEventListener('mivige:prospective',run);setInterval(run,60000);setTimeout(run,4500);display();
})();
