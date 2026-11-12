/* Standalone research view: it NEVER changes the operational MIVIGE score or alert. */
(function(){
'use strict';
const core=window.MivigeQuiescenceCore;
if(!core)return;
const REGIONS=[
 {id:'cascadia',name:'Cascadia · costa noroccidental',bounds:[39,51,-132,-121],note:'Oregón, Washington, Columbia Británica y margen oceánico adyacente'},
 {id:'alaska',name:'Alaska · Aleutianas orientales',bounds:[50,66,-178,-130],note:'Sector norteamericano y Aleutianas orientales; no cubre toda la placa del Pacífico'},
 {id:'japan',name:'Japón · margen occidental del Pacífico',bounds:[29,46,129,148],note:'Región japonesa incluida en el rectángulo de consulta, no todo el arco'},
];
const state={lastCut:null,regions:[],busy:false};
const DAY=core.DAY,THRESHOLD=3.5;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const when=ms=>new Date(ms).toLocaleString('es-EC',{timeZone:'America/Guayaquil',dateStyle:'short',timeStyle:'short'});
const fixed=n=>Number.isFinite(n)?n.toFixed(2):'N/A';
function ensure(){
 let card=document.getElementById('quiescenceObserver');if(card)return card;
 card=document.createElement('section');card.className='card';card.id='quiescenceObserver';
 card.innerHTML='<h2>Quietud sísmica y deformación · observatorio experimental</h2>'+
 '<p class="small"><b>Comparación observacional independiente del TOP 5.</b> Cascadia, Alaska y Japón. Se buscan reducciones relativas de actividad, nunca señales automáticas de terremoto inminente. No modifica el semáforo, los puntajes ni los registros prospectivos del modelo principal.</p>'+
 '<div class="controls" style="margin:8px 0"><button type="button" id="quietRefresh">Consultar catálogos</button><button type="button" id="quietExport" disabled>Exportar observaciones</button></div>'+
 '<div class="small" id="quietStatus" role="status" aria-live="polite">Preparando consulta USGS…</div>'+
 '<div id="quietRegions" style="margin-top:8px"></div>'+
 '<div id="quietGNSS" style="margin-top:10px"></div>'+
 '<details style="margin-top:10px"><summary>Método, calidad y límites de interpretación</summary>'+
 '<div class="small" style="margin-top:6px">Fuente: USGS ComCat FDSN Event Service; rectángulos geográficos fijos y magnitud M≥3.5. Consulta de 90 días mediante HTTP, sin rellenar lagunas con ceros. <b>24 h:</b> 1 día frente a los 30 anteriores. <b>72 h:</b> 3 días frente a los 30 anteriores. <b>30 días:</b> 30 días frente a los 60 anteriores. Se requiere un mínimo de 20 eventos en cada período de referencia. Estadístico: contraste binomial unilateral condicionado al recuento total, con ajuste Benjamini–Hochberg entre regiones y ventanas. El descenso solo se etiqueta exploratoriamente con razón ≤0.50 y q≤0.05. Las ventanas se solapan, los eventos pueden estar agrupados y M≥3.5 no asegura completitud de catálogo en todas las regiones ni épocas. <b>No inferir bloqueo tectónico, velocidad de deformación, esfuerzos, deslizamiento lento, causalidad ni predicción de terremotos.</b> Las series GNSS o InSAR deben tener geometría, correcciones y calidad independiente para evaluar deformación.</div>'+
 '<div class="small" style="margin-top:7px"><a href="https://earthquake.usgs.gov/fdsnws/event/1/" target="_blank" rel="noopener noreferrer">Documentación oficial USGS · catálogo FDSN</a></div>'+
 '</details>';
 const parent=document.querySelector('aside');
 const rank=document.getElementById('regionalProjectionPanel');
 if(rank)rank.insertAdjacentElement('afterend',card);
 else if(parent)parent.insertBefore(card,parent.firstChild);
 card.querySelector('#quietRefresh').addEventListener('click',()=>refresh());
 card.querySelector('#quietExport').addEventListener('click',exportData);
 return card;
}
function buildURL(region,cut){
 const [minLat,maxLat,minLon,maxLon]=region.bounds;
 const p=new URLSearchParams({
  format:'geojson',starttime:new Date(cut-90*DAY).toISOString(),endtime:new Date(cut).toISOString(),
  minlatitude:String(minLat),maxlatitude:String(maxLat),
  minlongitude:String(minLon),maxlongitude:String(maxLon),
  minmagnitude:String(THRESHOLD),orderby:'time-asc',limit:'20000'
 });
 return 'https://earthquake.usgs.gov/fdsnws/event/1/query?'+p.toString();
}
async function load(region,cut){
 const url=buildURL(region,cut);
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
 try{
  const response=await fetch(url,{cache:'no-store',signal:controller.signal});
  if(response.status===204)return {...region,status:'ok',url,count:0,consultedAt:Date.now(),windows:core.evaluate([],cut)};
  if(!response.ok)throw Error('HTTP '+response.status);
  const json=await response.json();
  if(!Array.isArray(json.features))throw Error('respuesta sin lista de eventos');
  const count=Number(json.metadata?.count);
  if((Number.isFinite(count)&&count>json.features.length)||json.features.length>=20000)throw Error('catálogo excede límite 20.000; evaluación omitida');
  const events=json.features.map(f=>({id:String(f.id||''),time:Number(f.properties?.time),mag:Number(f.properties?.mag)}))
    .filter(e=>Number.isFinite(e.time)&&Number.isFinite(e.mag)&&e.time>=cut-90*DAY&&e.time<=cut&&e.mag>=THRESHOLD);
  return {...region,status:'ok',url,count:events.length,consultedAt:Date.now(),windows:core.evaluate(events,cut)};
 }catch(e){
  return {...region,status:'error',url,error:String(e?.message||e).slice(0,120),count:null,windows:[]};
 }finally{clearTimeout(timer);}
}
function regionalGNSS(){
 // Existing GNSS coverage applies only to the Americas in the current project inventory.
 // It does not supply station-series evidence for Cascadia, Japan or Alaska.
 const snapshot=window.MivigeGeodesy?.data;
 if(!snapshot?.stations||!Array.isArray(snapshot.stations)){
  return '<div class="small"><b>GNSS / InSAR:</b> N/A para las tres regiones comparativas. El inventario geodésico regional todavía no está accesible; N/A nunca significa deformación cero.</div>';
 }
 const now=Date.now(),at=Date.parse(snapshot.generated_at||'');
 const recent=Number.isFinite(at)&&now-at>=0&&now-at<=2*DAY;
 const active=snapshot.stations.filter(s=>s.usable&&Number.isFinite(Date.parse(s.observed_at))&&
  now-Date.parse(s.observed_at)>=0&&now-Date.parse(s.observed_at)<=7*DAY).length;
 return '<div class="small"><b>Control GNSS regional (Chile–Colombia):</b> '+snapshot.stations.length+' estaciones en el inventario, '+(recent?active+' series marcadas utilizables y recientes':'snapshot no vigente')+' al corte '+esc(snapshot.generated_at||'N/A')+'. Esta cobertura NO incluye GNSS validado para Cascadia, Alaska ni Japón. En esas regiones: GNSS / InSAR = <b>N/A</b>. La disponibilidad de series no constituye por sí sola medición de esfuerzos ni detección de deslizamiento lento.</div>';
}
function render(){
 const host=ensure().querySelector('#quietRegions'),status=document.getElementById('quietStatus');
 if(!host||!status)return;
 document.getElementById('quietExport').disabled=!state.regions.some(r=>r.status==='ok');
 status.textContent=state.busy?'Consultando 90 días de sismicidad USGS por región…':
  'Corte de los datos: '+(state.lastCut?when(state.lastCut):'sin consulta')+
  ' · '+state.regions.filter(r=>r.status==='ok').length+'/3 catálogos recibidos · actualización independiente cada 30 min.';
 host.innerHTML=state.regions.map(region=>{
  if(region.status!=='ok')return '<section class="listitem"><div><b>'+esc(region.name)+'</b><p class="small">DATOS INSUFICIENTES · '+esc(region.error||'consulta pendiente')+'. Sin clasificación, no se asume cero sismos.</p></div></section>';
  const lines=region.windows.map(w=>{
   const label=w.state==='descenso estadístico preliminar'?'DESCENSO PRELIMINAR':
    w.state==='muestra insuficiente'?'NO EVALUABLE':'SIN DESCENSO ESTADÍSTICO';
   return '<tr><td>'+esc(w.label)+'</td><td>'+w.recent+'</td><td>'+w.baseline+'</td>'+
     '<td>'+fixed(w.ratio)+'</td><td>'+fixed(w.q)+'</td><td>'+esc(label)+'</td></tr>';
  }).join('');
  const signal=region.windows.some(w=>w.state==='descenso estadístico preliminar');
  return '<section class="listitem" style="display:block;margin:7px 0;padding:10px;border-left:4px solid '+(signal?'#f2c464':'#668fa8')+'">'+
   '<b>'+esc(region.name)+'</b> <span class="small">· '+region.count+' eventos M≥'+THRESHOLD+' en 90 días</span>'+
   '<div class="small">'+esc(region.note)+' · consulta '+when(region.consultedAt)+' · fuente USGS</div>'+
   '<div style="overflow-x:auto"><table class="table" style="min-width:430px"><thead><tr><th>Ventana</th><th>Actual</th><th>Fondo</th><th>Razón</th><th>q</th><th>Lectura</th></tr></thead><tbody>'+lines+'</tbody></table></div>'+
   '<div class="small">'+(signal?'Se observa una disminución preliminar en una ventana, no una señal de terremoto próximo.':'Ningún descenso confirmado con los umbrales exploratorios; no significa ausencia de peligro sísmico.')+' · <a href="'+region.url+'" target="_blank" rel="noopener noreferrer">Consulta USGS</a></div>'+
   '<div class="small"><b>Deformación local GNSS / InSAR:</b> N/A · sin series regionales integradas, no interpretable como esfuerzo nulo.</div>'+
   '</section>';
 }).join('');
 document.getElementById('quietGNSS').innerHTML=regionalGNSS();
}
async function refresh(){
 if(state.busy)return;
 ensure();state.busy=true;render();
 const cut=Date.now();
 const entries=await Promise.all(REGIONS.map(r=>load(r,cut)));
 core.correctFDR(entries);
 state.regions=entries;state.lastCut=cut;state.busy=false;
 window.mivigeQuiescence={schema:1,cutISO:new Date(cut).toISOString(),magnitudeThreshold:THRESHOLD,
  source:'USGS FDSN Event Service',scope:'experimental observational only; excluded from core ranking',
  regions:entries.map(r=>({id:r.id,name:r.name,status:r.status,consultedAt:r.consultedAt||null,
   url:r.url||null,count:r.count,windows:r.windows,error:r.error||null}))};
 render();
}
function exportData(){
 if(!window.mivigeQuiescence)return;
 const url=URL.createObjectURL(new Blob([JSON.stringify(window.mivigeQuiescence,null,2)],{type:'application/json'}));
 const a=document.createElement('a');a.href=url;a.download='mivige-quietud-observacional.json';a.click();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
}
ensure();render();
window.addEventListener('mivige:geodesy',()=>{if(document.getElementById('quietGNSS'))document.getElementById('quietGNSS').innerHTML=regionalGNSS();});
setTimeout(refresh,400);
setInterval(refresh,30*60*1000);
})();
