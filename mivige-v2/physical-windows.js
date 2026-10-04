/* Physical scenario ledger v1. User-declared evidence; no automatic physical forecast. */
(function(){
'use strict';
const KEY='mivige-physical-windows-v1',H=3600000;
let records=[],storageOK=true,layer=null;
try{const saved=JSON.parse(localStorage.getItem(KEY)||'[]');if(Array.isArray(saved))records=saved;}catch(e){storageOK=false;}
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const when=t=>new Date(t).toLocaleString('es-EC',{timeZone:'America/Guayaquil'});
const km=(a,b)=>{const k=Math.PI/180;return 12742*Math.asin(Math.min(1,Math.sqrt(Math.sin((a.lat-b.lat)*k/2)**2+Math.cos(a.lat*k)*Math.cos(b.lat*k)*Math.sin((a.lon-b.lon)*k/2)**2)));};
function matches(r,e){return e.time>=r.start&&e.time<r.end&&e.time<=Date.now()&&e.mag>=r.mag&&km(r.zone,e)<=r.zone.r&&(!r.zone.depth||Number.isFinite(e.depth)&&e.depth>=r.zone.depth[0]&&e.depth<=r.zone.depth[1]);}
function classify(active,hit){return active?(hit?'Coincidencia':'Sin coincidencia / falsa alarma experimental'):(hit?'Omisión':'Control negativo correcto');}
function save(){try{localStorage.setItem(KEY,JSON.stringify(records));storageOK=true;}catch(e){storageOK=false;}}
const card=document.createElement('section');card.className='card';card.id='physicalWindows';
card.innerHTML='<h2>Ventanas de contraste · física y geodinámica</h2><p class="small">Registra un escenario antes del resultado. El visor todavía no calcula Coulomb, inversión de deslizamiento ni probabilidades: la evidencia introducida es declarada por el usuario y no queda verificada automáticamente. Sin ella, el estado es pendiente de cálculo.</p>'+
'<details><summary>Registrar escenario o control prospectivo</summary><form id="physicalForm" style="display:grid;gap:10px;margin-top:10px">'+
'<label>Zona <select id="pwZone" required></select></label><div id="pwExtent" class="small"></div>'+
'<label>Mecanismo <select id="pwMechanism"><option>Cambio de esfuerzos de Coulomb</option><option>Deformación transitoria / deslizamiento lento</option><option>Activación dinámica</option><option>Modelo de tasa y estado</option><option>Hipótesis multievidencia</option></select></label>'+
'<label>Resultado esperado <select id="pwActive"><option value="yes">Al menos un evento que cumpla el objetivo</option><option value="no">Control: ningún evento que cumpla el objetivo</option></select></label>'+
'<label>Magnitud objetivo <select id="pwMag"><option value="4.5">M ≥ 4,5</option><option value="6">M ≥ 6,0</option></select></label>'+
'<label>Ventana desde el registro <select id="pwHours"><option value="24">24 horas</option><option value="72">72 horas</option></select></label>'+
'<label>Variables, valores, unidades e incertidumbre <textarea id="pwEvidence" required minlength="20" maxlength="3000" placeholder="Introduce resultados reales; por ejemplo, cambio de esfuerzo sobre una falla receptora, método y rango de incertidumbre."></textarea></label>'+
'<label>Procedencia y fecha del cálculo <textarea id="pwReference" required minlength="10" maxlength="2000" placeholder="Identificador del informe/dataset, fecha de observaciones y versión del método."></textarea></label>'+
'<p class="small">Inicio fijado al guardar; no admite fechas pasadas ni edición posterior desde el visor. Selecciona zonas y controles con un criterio previo, sin adaptarlos al resultado. Registrar ventanas aisladas no permite estimar la capacidad predictiva global.</p>'+
'<button type="submit">Fijar escenario y abrir ventana</button></form></details>'+
'<p id="pwMessage" role="status"></p><div id="pwRecords"></div><button id="pwExport">Descargar registro físico</button>'+
'<p class="small">Registro local de este navegador, no compartido ni inmutable. Contraste mientras el visor está abierto, con catálogo móvil de 7 días y revisiones posteriores. Las coincidencias no prueban causalidad ni equivalen a probabilidades. No se combinan los resultados de métodos, zonas, magnitudes u horizontes distintos.</p>';
const aside=document.querySelector('aside');if(!aside)return;aside.appendChild(card);
const $=id=>document.getElementById(id);
function zones(){return (window.mivigeV2?.states||[]).map(s=>s.s);}
function fill(){const select=$('pwZone'),old=select.value,zs=zones();select.innerHTML=zs.map(z=>'<option value="'+esc(z.id)+'">'+esc(z.country+' · '+z.name)+'</option>').join('');if(zs.some(z=>z.id===old))select.value=old;extent();}
function extent(){const z=zones().find(z=>z.id===$('pwZone').value);$('pwExtent').textContent=z?'Criterio geográfico: centro '+z.lat+', '+z.lon+'; radio '+z.r+' km.'+(z.depth?' Profundidad '+z.depth.join('–')+' km.':' Todas las profundidades.'):'Esperando segmentos del modelo.';}
function feedFor(z){return {'Ecuador':'IG-EPN','Perú':'IGP','Colombia':'SGC','Chile':'USGS','Venezuela':'USGS'}[z.country];}
function eventsFor(r){
 const refs=window.mivigeReviewedSnapshot?.events||[];
 const src=(typeof allEvents==='undefined'?[]:allEvents).filter(e=>!refs.some(o=>o.id===e.id||Math.abs(o.time-e.time)<60000&&km(o,e)<30&&Math.abs(o.mag-e.mag)<.6)).concat(refs);
 const out=[];for(const e of src.filter(e=>matches(r,e))){if(!out.some(o=>o.id===e.id||Math.abs(o.time-e.time)<60000&&km(o,e)<30&&Math.abs(o.mag-e.mag)<.6))out.push({id:e.id,time:e.time,lat:e.lat,lon:e.lon,depth:e.depth,mag:e.mag,source:e.source});}
 return out;
}
function evaluate(){
 const now=Date.now();
 for(const r of records){
 if(r.closed)continue;
 const feed=typeof sourceStatus==='undefined'?null:sourceStatus[feedFor(r.zone)];
 const fresh=feed?.ok&&!feed.truncated&&Number.isFinite(feed.fetchedAt)&&now-feed.fetchedAt>=0&&now-feed.fetchedAt<15*60000;
 r.matches=eventsFor(r);
 if(now<r.end){r.status='Abierta';continue;}
 if(now-r.start>7*24*H){r.status='No evaluable: ventana fuera del catálogo móvil';r.closed=true;continue;}
 if(!fresh){r.status='Cerrada; esperando catálogo vigente y suficiente';continue;}
 r.status=classify(r.active,r.matches.length>0)+' · provisional';r.closed=true;r.evaluatedAt=now;
 }
 save();render();
}
function render(){
 $('pwMessage').textContent=(storageOK?'Registro local disponible. ':'No se pudo guardar: exporta antes de cerrar. ')+(records.length?records.length+' escenario(s) registrado(s).':'Sin escenarios emitidos; cálculos físicos pendientes.');
 $('pwRecords').innerHTML=records.slice().reverse().map(r=>'<details style="margin:12px 0"><summary>'+esc(r.zone.name)+' · M≥'+r.mag+' · '+r.hours+' h · '+esc(r.status)+'</summary><p class="small">'+esc(r.mechanism)+' · '+(r.active?'Escenario con evento':'Control sin evento')+'<br>'+when(r.start)+' → '+when(r.end)+' (Ecuador)<br>Centro '+r.zone.lat+', '+r.zone.lon+'; radio '+r.zone.r+' km'+(r.zone.depth?' · profundidad '+r.zone.depth.join('–')+' km':'')+'<br><b>Evidencia declarada:</b> '+esc(r.evidence)+'<br><b>Procedencia:</b> '+esc(r.reference)+'<br>Eventos compatibles: '+(r.matches||[]).length+'</p></details>').join('');
 if(layer){layer.clearLayers();for(const r of records.filter(x=>!x.closed&&Date.now()<x.end))L.marker([r.zone.lat,r.zone.lon]).bindPopup('<b>Ventana experimental registrada</b><br>'+esc(r.zone.name)+' · M≥'+r.mag+'<br>'+when(r.start)+' → '+when(r.end)+'<br>'+esc(r.mechanism)+'<br>Radio evaluado: '+r.zone.r+' km. Marcador del centro; no epicentro previsto.').addTo(layer);}
}
$('pwZone').onchange=extent;
$('physicalForm').onsubmit=e=>{
 e.preventDefault();const z=zones().find(z=>z.id===$('pwZone').value);if(!z)return;
 const now=Date.now(),hours=Number($('pwHours').value),mag=Number($('pwMag').value),mechanism=$('pwMechanism').value;
 if(records.some(r=>r.zone.id===z.id&&r.mechanism===mechanism&&r.mag===mag&&r.hours===hours&&r.end>now)){$('pwMessage').textContent='Ya existe una ventana de este mecanismo, zona, objetivo y horizonte. Espera su cierre.';return;}
 const evidence=$('pwEvidence').value.trim(),reference=$('pwReference').value.trim();if(evidence.length<20||reference.length<10)return;
 records.push({version:'physical-ledger-1.0',id:String(now),start:now,end:now+hours*H,hours,mag,mechanism,zone:{...z},active:$('pwActive').value==='yes',evidence,reference,evidenceVerified:false,status:'Abierta',matches:[],closed:false,sourceStatus:typeof sourceStatus==='undefined'?null:JSON.parse(JSON.stringify(sourceStatus))});
 evaluate();
};
$('pwExport').onclick=()=>{const u=URL.createObjectURL(new Blob([JSON.stringify({version:'physical-ledger-1.0',exportedAt:new Date().toISOString(),records},null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=u;a.download='mivige-ventanas-fisicas.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);};
if(typeof L!=='undefined'&&typeof map!=='undefined'){layer=L.layerGroup().addTo(map);L.control.layers({},{'Ventanas físicas · centros de zonas':layer},{collapsed:true}).addTo(map);}
window.addEventListener('mivige:model',()=>{fill();evaluate();});setInterval(evaluate,60000);fill();evaluate();
})();
