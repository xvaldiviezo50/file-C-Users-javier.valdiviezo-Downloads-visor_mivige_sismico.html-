(function(){
'use strict';
const KEY='mivige-prospective-v2.1',VERSION='2.1.0',MAG=4.5,DAY=86400000;
let records=[],snapshots={},storageOK=true;
try{const saved=JSON.parse(localStorage.getItem(KEY)||'{}');records=Array.isArray(saved.records)?saved.records:[];snapshots=saved.snapshots||{};}catch(_){storageOK=false;}
const card=document.createElement('section');card.className='card';card.id='validation21';
card.innerHTML='<h2>Evaluación prospectiva · v2.1</h2><p class="small">Objetivo registrado: al menos un evento M≥4.5 dentro del círculo de cada zona en las próximas 24 o 72 horas. Puntaje alto: ≥65/100. Se registran también puntajes bajos para contar omisiones. Son pruebas de la hipótesis, sin probabilidad calibrada.</p><div id="validation21status" class="small"></div><button id="validation21export">Descargar registro de evaluación</button><p class="small">Registro en este navegador, exportable; no es un archivo público inmutable. Los resultados son provisionales y dependen del catálogo disponible. Las ventanas de una misma zona y horizonte no se superponen; zonas geográficas distintas sí pueden solaparse. No mezclar sus resultados como ensayos independientes.</p>';
document.querySelector('aside').appendChild(card);
function validFeeds(){return ['USGS','IG-EPN','IGP','SGC'].every(k=>sourceStatus[k]?.ok&&!sourceStatus[k].truncated&&Date.now()-sourceStatus[k].fetchedAt<15*60000);}
function persist(){try{localStorage.setItem(KEY,JSON.stringify({records,snapshots}));}catch(_){storageOK=false;}}
function run(){
 const now=Date.now(),p=window.mivigeProspectiveV2;
 if(!p||now-p.time>90000)return;
 let changed=false;
 for(const row of records.filter(r=>r.status==='pending'&&now>=r.end)){
  if(now-row.start>7*DAY){row.status='unverifiable';row.reason='La ventana salió del catálogo móvil de 7 días';changed=true;continue;}
  if(!validFeeds())continue;
  const found=allEvents.filter(e=>e.time>=row.start&&e.time<row.end&&e.mag>=MAG&&distKm(e.lat,e.lon,row.zone.lat,row.zone.lon)<=row.zone.r&&(!row.zone.depth||(Number.isFinite(e.depth)&&e.depth>=row.zone.depth[0]&&e.depth<=row.zone.depth[1])));
  row.status='closed';row.observed=found.length>0;row.events=found.map(e=>({id:e.id,source:e.source,time:e.time,mag:e.mag}));row.evaluatedAt=now;row.provisional=true;changed=true;
 }
 if(validFeeds())for(const x of p.results||[])for(const hours of [24,72]){
  if(records.some(r=>r.zone.id===x.st.s.id&&r.hours===hours&&r.status==='pending'))continue;
  records.push({version:VERSION,start:now,end:now+hours*3600000,hours,zone:{...x.st.s},targetMag:MAG,high:x.score>=65,score:x.score,threshold:65,status:'pending',catalogueCut:p.time,sourceStatus:JSON.parse(JSON.stringify(sourceStatus)),snapshotId:String(now),components:{source:x.sourcePts,path:x.path.points,sequence:x.seq.points,delay:x.delay.points,receiver:x.recv.points,dynamic:x.dyn.points,antipode:x.anti.points,sst:x.sst.points,release:x.release.points}});changed=true;
 }
 if(records.some(r=>r.snapshotId===String(now))&&!snapshots[String(now)])snapshots[String(now)]=allEvents.filter(e=>e.time>=now-7*DAY).map(e=>({id:e.id,source:e.source,time:e.time,mag:e.mag,lat:e.lat,lon:e.lon,depth:e.depth}));
 if(changed)persist();
 const lines=[storageOK?'Registro local disponible.':'El navegador no permite guardar: exporta el registro para conservarlo.',validFeeds()?'Fuentes descargadas sin truncamiento detectado.':'Registro nuevo en pausa: alguna fuente está ausente, vencida o truncada.'];
 for(const hours of [24,72]){
  const rows=records.filter(r=>r.hours===hours),m=MivigeQuality.skill(rows);
  lines.push(hours+' h: '+rows.filter(r=>r.status==='pending').length+' pendientes · '+m.n+' evaluadas · aciertos '+m.tp+' · falsas alarmas '+m.fp+' · omisiones '+m.fn+' · negativos correctos '+m.tn+'.');
 }
 lines.push('Capacidad predictiva: no validada. No se publica porcentaje de confianza.');
 document.getElementById('validation21status').textContent=lines.join(' ');
}
document.getElementById('validation21export').onclick=()=>{const blob=new Blob([JSON.stringify({version:VERSION,exportedAt:new Date().toISOString(),storageOK,records,snapshots},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='mivige-evaluacion-v2.1.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
window.addEventListener('mivige:model',run);setInterval(run,60000);setTimeout(run,4200);
})();
