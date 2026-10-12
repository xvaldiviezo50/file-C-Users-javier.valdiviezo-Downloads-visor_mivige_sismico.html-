(function(){
'use strict';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date=x=>new Date(x).toLocaleString('es-EC',{timeZone:'America/Guayaquil'});
async function render(){
 const host=document.getElementById('centralValidation');if(!host)return;
 try{
  const r=await fetch('data/validation-state.json?t='+Date.now(),{cache:'no-store'});if(!r.ok)throw Error('registro no disponible');
  const data=await r.json(),issues=data.issues||[],last=issues.at(-1);
  let html='<p class="small">Registro compartido · actualizado '+date(data.updatedAt)+' · '+issues.length+' emisiones conservadas.</p>';
  if(data.captureError)html+='<p class="small">Última emisión pendiente por falta de una captura fresca verificable. Los registros anteriores se conservan.</p>';
  if(last){
   const by=Object.fromEntries(last.zones.map(x=>[x.zone.id,x]));
   html+='<p class="small"><b>Último ranking congelado:</b> '+date(last.issuedAt)+'<br>Inicio de seguimiento: '+date(last.start)+'<br>'+last.top5.map((id,i)=>'#'+(i+1)+' '+esc(by[id]?.zone.name||id)+' '+Number(by[id]?.score).toFixed(1)+'/100').join('<br>')+'</p>';
  }else html+='<p>Aún no hay emisiones prospectivas verificadas. No se convierten asociaciones históricas en aciertos.</p>';
  const groups={};
  for(const issue of issues){
   if(issue.status==='INVALID_PUBLICATION')continue;
   for(const [hours,ev] of Object.entries(issue.evaluations||{}))for(const [mag,res] of Object.entries(ev.targets)){
    const key=issue.algorithm+'|'+hours+'|'+mag;
    const g=groups[key] ||= {hash:issue.algorithm,hours,mag,n:0,TP:0,FP:0,FN:0,TN:0,top:0,base:0};
    g.n++;for(const k of ['TP','FP','FN','TN'])g[k]+=res.threshold40.confusion[k];
    g.top+=res.top5.confusion.TP;g.base+=res.baseline.confusion.TP;
   }
  }
  html+='<div class="small"><b>Resultados por versión, plazo y magnitud</b></div>';
  if(!Object.keys(groups).length)html+='<p class="small">Todavía no hay ventanas cerradas y evaluadas. El primer resultado requiere el plazo de seguimiento más 24 h de espera de catálogo.</p>';
  for(const g of Object.values(groups))html+='<div class="listitem small"><div><b>M≥'+g.mag+' · '+g.hours+' h · '+g.n+' cortes</b><br>Versión '+esc(g.hash.slice(0,12))+'<br>Umbral 40: coincidencias '+g.TP+' · sin coincidencia '+g.FP+' · omisiones '+g.FN+' · negativos '+g.TN+'<br>Zonas con evento en TOP 5: modelo '+g.top+' / referencia por actividad previa '+g.base+'</div></div>';
  html+='<p class="small">Una coincidencia no demuestra el mecanismo físico. Los resultados solo cubren el catálogo USGS consultado; no equivalen a ausencia de sismos en otras redes.</p><a href="data/validation-state.json" target="_blank" rel="noopener">Descargar registro y resultados</a>';
  if(last)html+=' · <a href="../'+esc(last.snapshot)+'" download>Datos y código identificado del último corte</a>';
  host.innerHTML=html;
 }catch(e){host.textContent='Registro central temporalmente no disponible. No se asignan aciertos ni nivel bajo por esta ausencia.';}
 const old=document.querySelector('#persistentLearning');
 if(old){const h=old.querySelector('h2');if(h)h.textContent='Seguimiento histórico · fórmula anterior (excluido de validación)';}
}
render();setInterval(render,300000);
})();
