(function(){
'use strict';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number=(v,n=3)=>Number.isFinite(v)?v.toFixed(n):'No evaluable';
const date=t=>t?new Date(t).toLocaleString('es-EC',{timeZone:'America/Guayaquil'}):'Sin fecha';
const degree=v=>number(v,0)+'°';
const stress=v=>Number.isFinite(v)?(Math.abs(v)<.001?v.toExponential(2):v.toFixed(4)):'—';
let data=null,ledger=null,layer=null,chosenSource='',chosenZone='ec_s',enabled=false;
const aside=document.querySelector('aside');if(!aside)return;
const card=document.createElement('section');card.className='card';card.id='physicalScenarioPanel';
card.innerHTML='<h2>Escenarios físicos · fuente y receptores</h2><div id="physicalBody">Consultando cálculos automáticos…</div>';
aside.insertBefore(card,document.getElementById('prospectiveProtocol')||aside.firstChild);
const style=document.createElement('style');style.textContent='#physicalScenarioPanel select{max-width:100%;width:100%;margin:5px 0 12px}#physicalScenarioPanel .mechanism{border-left:3px solid #60a5fa;padding:9px;margin:9px 0;background:#102238;border-radius:5px}#physicalScenarioPanel p{line-height:1.5}#physicalScenarioPanel button{margin:5px 0}#physicalScenarioPanel details{margin:9px 0}#physicalScenarioPanel .physical-warning{color:#fcd58a}';document.head.appendChild(style);
function signLabel(c){return c.sign==='positive'?'ΔCFS positivo en todos los escenarios muestreados':c.sign==='negative'?'ΔCFS negativo en todos los escenarios muestreados':'El signo cambia con los supuestos';}
function color(c){return c.sign==='positive'?'#fb923c':c.sign==='negative'?'#38bdf8':'#a1a1aa';}
function dynamicText(row,source){
 const d=row.dynamic,a=d.amplitude;
 let text='<b>1. Propagación de ondas</b><br>Azimut desde la fuente: '+degree(d.azimuth)+' · distancia '+number(d.distanceKm,0)+' km.';
 for(const kind of ['P','S']){const t=d.arrivals[kind];text+='<br>'+kind+': '+(t?number(t.minSeconds/60,2)+'–'+number(t.maxSeconds/60,2)+' min tras la ruptura · llegada '+date(source.time+t.minSeconds*1000):'sin fase calculable con estos modelos');}
 text+='<p class="small">Tiempos teóricos iasp91–ak135 hasta el punto representativo. Indican el paso de ondas del sismo seleccionado, no cuándo ocurrirá otro sismo. El rango es diferencia entre modelos.</p>';
 if(a.status==='modeled')text+='<div class="small">PGV ShakeMap: '+number(a.pgvCmS)+' cm/s · esfuerzo equivalente: '+stress(a.equivalentStressMPa)+' MPa. <b>Estimación de malla, no registro instrumental local.</b> ρ=2700 kg/m³, Vs=3500 m/s; proxy ρ·Vs·PGV, no esfuerzo resuelto sobre una falla.</div>';
 else text+='<div class="small">Amplitud: '+esc(a.reason)+'. Activación dinámica: no confirmada.</div>';
 return text;
}
function coulombText(c){
 let text='<b>2. Transferencia estática · simulación Coulomb</b><br>';
 if(c.status!=='scenario')return text+esc(c.reason)+'.';
 text+=signLabel(c)+'<br>ΔCFS central: <b>'+stress(c.valueMPa)+' MPa</b><br>Rango de sensibilidad: '+stress(c.minMPa)+' a '+stress(c.maxMPa)+' MPa.';
 text+='<p class="small physical-warning">Fuente puntual en espacio infinito, sin superficie libre. Orientación receptora supuesta: rumbo '+c.receiver.strike+'°, buzamiento '+c.receiver.dip+'°, rake '+c.receiver.rake+'°. Se evalúa un punto, no toda la zona ni una falla identificada. Un valor positivo no es probabilidad ni predicción.</p>';
 text+='<details><summary>Supuestos y sensibilidad</summary><p class="small">'+c.samples+' combinaciones. Profundidades '+c.depthsKm.join(', ')+' km; rumbo/rake ±20°, buzamiento ±10°, fricción 0.2–0.6 y Poisson 0.20–0.30. '+esc(c.uncertainty)+' Se excluyen receptores a más de 500 km y próximos a la fuente; allí se requiere un modelo de ruptura finita.</p></details>';
 return text;
}
function gnssText(zone){
 const g=data.geodesy[zone.id],stations=data.stations.filter(s=>g?.stations.includes(s.code));
 let text='<b>3. Deformación transitoria · observaciones GNSS</b><br>';
 if(!g)return text+'Datos insuficientes para este receptor.';
 text+=g.fresh+' estaciones utilizables recientes · '+stations.length+' series históricas analizables.';
 if(g.status==='coincident_change')text+='<br>Cambio aparente coincidente en '+g.candidates+' estaciones · dirección del cambio horizontal '+degree(g.azimuth)+' · coherencia '+number(g.coherence,2)+'.';
 else text+='<br>'+ (g.status==='insufficient'?'Cobertura reciente insuficiente.':'Sin coincidencia bajo el tamiz actual; no significa deformación cero.');
 text+='<p class="small">Se comparan velocidades de los últimos 7 días de cada serie con los 21 anteriores (E/N/U en mm/día). Esta dirección describe el movimiento de estaciones. Inversión de deslizamiento e incorporación de InSAR: pendientes; no se atribuye a afterslip ni se extrapola al siguiente sismo.</p>';
 if(stations.length)text+='<details><summary>Ver vectores, fechas y error formal</summary>'+stations.map(s=>'<p class="small"><b>'+esc(s.code)+'</b> · '+esc(s.observed_at.slice(0,10))+' · '+(s.fresh?'reciente':'histórica, excluida del tamiz actual')+'<br>Δv E/N/U: '+s.deltaVelocityMmDay.map(v=>number(v)).join(' / ')+' mm/día<br>Error formal (1σ): '+s.standardErrorMmDay.map(v=>number(v)).join(' / ')+' mm/día</p>').join('')+'<p class="small">Regresión lineal, error formal con residuos independientes. No corrige estacionalidad, carga hidrológica, offsets ni ruido correlacionado. Coincidencia entre estaciones no demuestra causa tectónica.</p></details>';
 return text;
}
function draw(selected){
 if(typeof L==='undefined'||typeof map==='undefined')return;
 if(!layer)layer=L.layerGroup();layer.clearLayers();
 if(!enabled||!selected){if(map.hasLayer(layer))map.removeLayer(layer);return;}
 const s=selected.source;
 L.marker([s.lat,s.lon],{icon:L.divIcon({className:'',html:'<span style="color:#fff;background:#334155;padding:3px;border-radius:3px">◆</span>',iconSize:[20,20]})}).bindPopup(esc(s.place)+' · M'+s.mag).addTo(layer);
 for(const r of selected.receivers){const z=data.zones.find(z=>z.id===r.id);if(!z)continue;
  const c=color(r.coulomb),points=[];
  // Spherical interpolation: geographic projection of the path, not a ray through depth.
  const toVector=(lat,lon)=>{lat*=Math.PI/180;lon*=Math.PI/180;return[Math.cos(lat)*Math.cos(lon),Math.cos(lat)*Math.sin(lon),Math.sin(lat)]};
  const a=toVector(s.lat,s.lon),b=toVector(z.lat,z.lon),angle=Math.acos(Math.max(-1,Math.min(1,a.reduce((v,x,i)=>v+x*b[i],0))));
  for(let j=0;j<=24;j++){const f=j/24,u=angle<1e-8?1-f:Math.sin((1-f)*angle)/Math.sin(angle),v=angle<1e-8?f:Math.sin(f*angle)/Math.sin(angle);const q=a.map((x,i)=>u*x+v*b[i]);points.push([Math.atan2(q[2],Math.hypot(q[0],q[1]))*180/Math.PI,Math.atan2(q[1],q[0])*180/Math.PI]);}
  L.polyline(points,{color:c,weight:r.id===chosenZone?3:1.5,opacity:r.id===chosenZone?.95:.45,dashArray:'6 7'}).bindTooltip(esc(z.name)+' · '+degree(r.dynamic.azimuth)+' · '+(r.coulomb.status==='scenario'?signLabel(r.coulomb):'Coulomb no evaluable')).on('click',()=>{chosenZone=r.id;render();}).addTo(layer);
  L.marker([z.lat,z.lon],{icon:L.divIcon({className:'',html:'<span style="color:'+c+'">◆</span>',iconSize:[12,12]})}).bindTooltip(esc(z.name)).on('click',()=>{chosenZone=r.id;render();}).addTo(layer);
 }
 layer.addTo(map);
}
function windowsText(){
 if(!ledger)return '<p class="small">Registro independiente aún no disponible.</p>';
 const list=ledger.issues||[],last=list.at(-1);let html='<p class="small">'+list.length+' cortes congelados; ventanas de 24/72 h, objetivos M≥4.0, 4.5 y 6.0. Se prueba por separado la selección de centros con ΔCFS positivo en toda la sensibilidad para la fuente más reciente. No se contabiliza el paso de ondas como un acierto.</p>';
 if(last)html+='<p class="small">Último registro: '+date(last.issuedAt)+' · inicio '+date(last.start)+' · '+last.selected.length+' receptores seleccionados.</p>';
 const groups={};
 for(const i of list){if(i.status==='INVALID_PUBLICATION')continue;for(const[h,e]of Object.entries(i.evaluations||{}))for(const[m,r]of Object.entries(e.targets)){const version=i.id.split('-').at(-1),key=version+'|'+h+'|'+m;const g=groups[key]||={version,h,m,n:0,TP:0,FP:0,FN:0,TN:0};g.n++;for(const k of ['TP','FP','FN','TN'])g[k]+=r.confusion[k];}}
 if(!Object.keys(groups).length)html+='<p class="small">Aún no hay resultados cerrados de esta capa. Evaluación 24 h después del fin de cada ventana.</p>';
 for(const g of Object.values(groups))html+='<p class="small">'+esc(g.version)+' · '+g.h+' h · M≥'+g.m+' · '+g.n+' cortes: coincidencias '+g.TP+', sin coincidencia '+g.FP+', omisiones '+g.FN+', negativos '+g.TN+'.</p>';
 return html+'<p class="small">Zonas y ventanas solapadas; recuentos dependientes. Sin tasa de acierto calibrada ni prueba de causalidad. Evaluación USGS; fallos de consulta quedan pendientes.</p><a href="data/physical-windows.json" target="_blank" rel="noopener">Registro auditable</a>';
}
function render(){
 const body=document.getElementById('physicalBody');if(!data)return;
 const age=data.generatedAt?(Date.now()-data.generatedAt)/3600000:Infinity,stale=age>2||data.runStatus!=='ok';
 let html='<p class="small"><b>Escenarios condicionados, sin dirección del próximo terremoto.</b> Los tres mecanismos se muestran con sus propias unidades; no se suman en una probabilidad.</p><p class="small">Cálculo: '+date(data.generatedAt)+(stale?' · <b class="physical-warning">REGISTRO CONSERVADO / ACTUALIZACIÓN PENDIENTE</b>':'')+'</p>';
 if(data.errors?.length)html+='<p class="small physical-warning">'+data.errors.length+' consulta(s) incompleta(s); revisar el registro de cálculos.</p>';
 if(!data.sources?.length){body.innerHTML=html+'<p>No hay fuentes calculables en el corte disponible. Se conservan los registros previos cuando falla una consulta.</p>';return;}
 const selected=data.sources.find(s=>s.source.id===chosenSource)||data.sources[0];chosenSource=selected.source.id;
 const zone=data.zones.find(z=>z.id===chosenZone)||data.zones[0];chosenZone=zone.id;
 const row=selected.receivers.find(r=>r.id===chosenZone);
 html+='<label for="physicalSource">Sismo de origen</label><select id="physicalSource">'+data.sources.map(s=>'<option value="'+esc(s.source.id)+'" '+(s.source.id===chosenSource?'selected':'')+'>M'+s.source.mag+' · '+esc(s.source.place)+' · '+date(s.source.time)+'</option>').join('')+'</select>';
 html+='<label for="physicalZone">Punto receptor representativo</label><select id="physicalZone">'+data.zones.map(z=>'<option value="'+esc(z.id)+'" '+(z.id===chosenZone?'selected':'')+'>'+esc(z.name)+'</option>').join('')+'</select>';
 html+='<label><input type="checkbox" id="physicalPaths" '+(enabled?'checked':'')+'> Mostrar trayectorias fuente → receptores</label><p class="small">Líneas discontinuas: proyección geográfica de los trayectos, no rutas de futuros terremotos. Naranja: ΔCFS positivo; celeste: negativo; gris: signo variable o no evaluable. Son signos de una simulación, no niveles de alerta.</p>';
 if(row)html+='<div class="mechanism">'+dynamicText(row,selected.source)+'</div><div class="mechanism">'+coulombText(row.coulomb)+'</div><div class="mechanism">'+gnssText(zone)+'</div>';
 const positives=selected.receivers.filter(r=>r.coulomb.sign==='positive');
 html+='<details><summary>¿Dónde favorece deslizamiento esta simulación?</summary><p class="small">'+(positives.length?positives.map(r=>{const z=data.zones.find(z=>z.id===r.id);return esc(z.name)+' · azimut '+degree(r.dynamic.azimuth)+' · '+stress(r.coulomb.valueMPa)+' MPa';}).join('<br>'):'No hay centros con signo positivo estable bajo los supuestos ensayados. Esto no significa ausencia de amenaza.')+'</p><p class="small">La simulación no identifica la siguiente falla que romperá. El resultado depende de orientaciones receptoras supuestas y no sustituye un cálculo de ruptura finita.</p></details>';
 html+='<details><summary>Seguimiento independiente de esta capa</summary>'+windowsText()+'</details><details><summary>Procedencia y alcance</summary><p class="small">'+esc(data.scope)+'<br>Tensor: USGS, N·m. GNSS: NGL/IGS20. Tiempos: ObsPy/TauP. Código '+esc(data.codeRevision?.slice(0,12))+'</p><a href="physical-method.html" target="_blank" rel="noopener">Método, supuestos y referencias</a> · <a href="data/physical-scenarios.json" target="_blank" rel="noopener">Descargar cálculos</a></details>';
 body.innerHTML=html;
 document.getElementById('physicalSource').onchange=e=>{chosenSource=e.target.value;render();};document.getElementById('physicalZone').onchange=e=>{chosenZone=e.target.value;render();};document.getElementById('physicalPaths').onchange=e=>{enabled=e.target.checked;draw(selected);};draw(selected);
}
async function refresh(){
 const results=await Promise.allSettled(['physical-scenarios.json','physical-windows.json'].map(async name=>{const r=await fetch('data/'+name+'?t='+Date.now(),{cache:'no-store'});if(!r.ok)throw Error(r.status);return r.json();}));
 if(results[0].status==='fulfilled')data=results[0].value;else if(data)data.runStatus='retained';
 if(results[1].status==='fulfilled')ledger=results[1].value;
 if(data)render();else document.getElementById('physicalBody').textContent='La primera ejecución automática está pendiente. Aún no hay escenarios físicos publicados.';
}
refresh();setInterval(refresh,300000);
})();
