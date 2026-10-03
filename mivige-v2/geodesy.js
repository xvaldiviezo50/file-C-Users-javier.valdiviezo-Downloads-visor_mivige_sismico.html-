/* GNSS regional: downloaded observations, distinct from station-location overlays. */
(function(root){
'use strict';
const DAY=86400000;
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function assess(data,zone,now=Date.now()){
 const empty={state:'datos insuficientes',coherent:false,candidate:false,used:0,latency:null,detail:'sin series GNSS verificables',stations:[]};
 if(data?.schema!==1||!Array.isArray(data.stations))return empty;
 const selected=zone?(data.zones?.[zone]?.used||[]):data.stations.map(s=>s.code);
 const stations=data.stations.filter(s=>selected.includes(s.code)&&s.usable&&Number.isFinite(Date.parse(s.observed_at))&&now-Date.parse(s.observed_at)>=0&&now-Date.parse(s.observed_at)<=7*DAY);
 const recentSnapshot=Number.isFinite(Date.parse(data.generated_at))&&now-Date.parse(data.generated_at)>=0&&now-Date.parse(data.generated_at)<=2*DAY;
 const enough=stations.length>=3&&recentSnapshot;
 const candidates=(data.zones?.[zone]?.coherent_candidates||[]).filter(c=>stations.some(s=>s.code===c));
 const candidate=enough&&candidates.length>=3;
 const ages=stations.map(s=>(now-Date.parse(s.observed_at))/DAY).sort((a,b)=>a-b);
 return {state:!recentSnapshot?'snapshot GNSS atrasado':!enough?'cobertura GNSS insuficiente':candidate?'señal GNSS coincidente · revisión pendiente':'series disponibles · sin coincidencia bajo el tamiz',coherent:false,candidate,used:stations.length,latency:ages.length?ages[Math.floor(ages.length/2)]:null,detail:!recentSnapshot?'consulta automatizada no reciente':candidate?'≥3 estaciones; atribución tectónica y causas no tectónicas pendientes':'tamiz exploratorio; no equivale a ausencia de deformación',stations};
}
root.MivigeGeodesy={assess};
if(typeof module!=='undefined')module.exports=root.MivigeGeodesy;
if(typeof document==='undefined')return;
let data=null,layer=null;
function plot(s){
 const host=document.getElementById('gnssPlot');if(!host||!s)return;
 const p=s.series||[];if(p.length<2){host.textContent='Sin serie suficiente para graficar';return;}
 const start=Date.parse(p[0].date),span=Math.max(DAY,Date.parse(p.at(-1).date)-start);
 const values=p.flatMap(x=>x.mm),lo=Math.min(...values),hi=Math.max(...values),range=Math.max(1,hi-lo);
 const colors=['#65d6ff','#81e8ae','#e7aeff'];
 host.innerHTML='<svg viewBox="0 0 480 170" role="img" aria-label="Serie GNSS relativa en milímetros"><path d="M40 10V140H470" fill="none" stroke="#7594ad"/>'+[0,1,2].map(k=>'<polyline fill="none" stroke="'+colors[k]+'" stroke-width="1.7" points="'+p.map(r=>[40+430*(Date.parse(r.date)-start)/span,130-110*(r.mm[k]-lo)/range].join(',')).join(' ')+'"/>').join('')+'<text x="2" y="20" fill="#cadbea" font-size="10">'+hi.toFixed(1)+'</text><text x="2" y="133" fill="#cadbea" font-size="10">'+lo.toFixed(1)+'</text><text x="40" y="157" fill="#cadbea" font-size="10">'+esc(p[0].date)+'</text><text x="397" y="157" fill="#cadbea" font-size="10">'+esc(p.at(-1).date)+'</text></svg><div class="small">E azul · N verde · U violeta · mm respecto a primera época visible; incluye tendencia, no solo anomalía. '+esc(s.merge_method)+'</div>';
}
function render(d){
 data=d;const host=document.getElementById('gnssRegional');if(!host)return;
 if(d?.schema!==1||!Array.isArray(d.stations)){host.textContent='No se pudo leer el snapshot GNSS. La vigilancia sísmica continúa por separado.';return;}
 const g=assess(d),now=Date.now();
 host.innerHTML='<div class="kpis"><div class="kpi"><div class="name">Series consultadas</div><div class="val">'+d.stations.length+'</div></div><div class="kpi"><div class="name">Estaciones con tamiz vigente</div><div class="val">'+g.used+'</div></div></div><p class="small">Procesado: '+esc(d.generated_at)+'<br>Fuente: NGL / IGS20. Consulta programada cada 6 h; la frecuencia del proveedor puede ser menor.<br>'+esc(g.state.includes('atrasado')?g.state:'Disponibilidad regional; ver el resultado en cada zona')+'. Cada zona se evalúa por separado.</p><details><summary>Ver estaciones, fechas y motivos de exclusión</summary><div style="overflow:auto;max-height:320px"><table class="table"><thead><tr><th>Estación</th><th>Último dato</th><th>Estado</th></tr></thead><tbody>'+d.stations.map(s=>'<tr><td><a target="_blank" rel="noopener" href="https://geodesy.unr.edu/NGLStationPages/stations/'+encodeURIComponent(s.code)+'.sta">'+esc(s.code)+'</a></td><td>'+esc(s.observed_at?.slice(0,10)||'—')+'<br>'+ (s.observed_at?Math.max(0,(now-Date.parse(s.observed_at))/DAY).toFixed(1)+' d':'')+'</td><td>'+esc((s.usable&&now-Date.parse(s.observed_at)<=7*DAY)?(s.candidate?'cambio a revisar':'tamiz disponible'):(s.usable?'observaciones atrasadas (>7 días)':s.reason||'sin datos'))+'</td></tr>').join('')+'</tbody></table></div></details><p><label for="gnssStation">Serie de estación </label><select id="gnssStation">'+d.stations.filter(s=>s.series?.length).map(s=>'<option value="'+esc(s.code)+'">'+esc(s.code)+'</option>').join('')+'</select></p><div id="gnssPlot"></div><p class="small">'+esc(d.method)+'</p><a href="https://raw.githubusercontent.com/xvaldiviezo50/file-C-Users-javier.valdiviezo-Downloads-visor_mivige_sismico.html-/main/mivige-v2/data/gnss.json" target="_blank" rel="noopener">Descargar observaciones procesadas y trazabilidad</a>';
 const select=document.getElementById('gnssStation');if(select){select.onchange=()=>plot(d.stations.find(s=>s.code===select.value));const initial=d.stations.find(s=>s.usable&&s.series?.length)||d.stations.find(s=>s.series?.length);if(initial)select.value=initial.code;plot(initial);}
 if(typeof L!=='undefined'&&typeof map!=='undefined'){
  if(!layer){layer=L.layerGroup().addTo(map);L.control.layers({},{'GNSS · series procesadas NGL':layer},{collapsed:true}).addTo(map);}
  layer.clearLayers();d.stations.forEach(s=>{const age=(now-Date.parse(s.observed_at))/DAY,valid=s.usable&&age>=0&&age<=7,c=valid?'#65d6ff':'#8993a4';L.circleMarker([s.lat,s.lon],{radius:5,color:c,fillColor:c,fillOpacity:.85,weight:2}).bindPopup('<b>GNSS '+esc(s.code)+'</b><br>'+esc(s.observed_at?.slice(0,10)||'sin observaciones')+'<br>'+esc(s.reason)+'<br>Dato procesado; no predicción.<br><a target="_blank" rel="noopener" href="'+esc(s.url)+'">NGL: datos originales</a>').addTo(layer);});
 }
}
root.MivigeGeodesy.render=render;
})(typeof window!=='undefined'?window:globalThis);
