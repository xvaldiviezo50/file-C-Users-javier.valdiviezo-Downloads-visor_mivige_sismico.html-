/* Experimental directional monitoring: never changes scientific ICM. */
(function(){
'use strict';
const H=3600000, cutoffHours=72;
const reviewed=[
{id:'igepn2026tjud',source:'IG-EPN',time:Date.parse('2026-10-03T17:34:20Z'),lat:.594,lon:-79.209,depth:67.7,mag:3.8,place:'Quinindé · Esmeraldas',reviewed:true},
{id:'igepn2026tjwt',source:'IG-EPN',time:Date.parse('2026-10-03T18:53:01Z'),lat:-1.301,lon:-80.516,depth:31,mag:3.7,place:'Jipijapa · Manabí',reviewed:true}
];
function prepare(events,now){
 const valid=e=>Number.isFinite(e.time)&&e.time<=now&&e.time>=now-cutoffHours*H&&Number.isFinite(e.lat)&&Number.isFinite(e.lon)&&e.mag>=3&&e.lat>=-5&&e.lat<=2&&e.lon>=-82&&e.lon<=-75;
 const ids=new Map();
 events.filter(valid).forEach(e=>ids.set(String(e.id||e.source+':'+e.time),e));
 // Reviewed bulletin snapshot supersedes GIS solutions with the same event ID only within this layer.
 reviewed.filter(valid).forEach(e=>ids.set(e.id,e));
 const sorted=[...ids.values()].sort((a,b)=>Number(!!b.reviewed)-Number(!!a.reviewed));
 const out=[];
 for(const e of sorted){
  if(out.some(a=>a.id===e.id||(a.source!==e.source&&Math.abs(a.time-e.time)<60000&&distance(a,e)<30&&Math.abs(a.mag-e.mag)<.6)))continue;
  out.push(e);
 }
 return out.sort((a,b)=>a.time-b.time);
}
function distance(a,b){
 const r=Math.PI/180,dlat=(b.lat-a.lat)*r,dlon=(b.lon-a.lon)*r;
 return 12742*Math.asin(Math.min(1,Math.sqrt(Math.sin(dlat/2)**2+Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin(dlon/2)**2)));
}
function pairs(es){
 return es.slice(1).map((b,i)=>{
 const a=es[i],km=distance(a,b),hours=(b.time-a.time)/H;
 return {a,b,km,hours,direction:b.lat-a.lat>.2?'S→N':b.lat-a.lat<-.2?'N→S':'sin dirección latitudinal clara',eligible:hours>0&&hours<=24&&km<=500};
 }).filter(p=>p.eligible);
}
if(typeof module!=='undefined'&&module.exports){module.exports={prepare,pairs,reviewed};return;}
const node=document.getElementById('migrationExperimental');
if(!node)return;
const layer=L.layerGroup().addTo(map);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const when=t=>new Date(t).toLocaleString('es-EC',{timeZone:'America/Guayaquil',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
let visible=true;
function render(){
 const now=Date.now(),es=prepare(typeof allEvents!=='undefined'?allEvents:[],now),ps=pairs(es);
 layer.clearLayers();
 ps.forEach(p=>{
  const color=p.direction==='S→N'?'#3ddbd9':p.direction==='N→S'?'#ffbc66':'#aeb8c8';
  L.polyline([[p.a.lat,p.a.lon],[p.b.lat,p.b.lon]],{color,weight:3,dashArray:'7 7',opacity:.85})
   .bindTooltip(esc(p.direction+' · orden temporal, no propagación demostrada')).addTo(layer);
  const angle=Math.atan2(p.b.lon-p.a.lon,p.b.lat-p.a.lat)*180/Math.PI;
  L.marker([(p.a.lat+p.b.lat)/2,(p.a.lon+p.b.lon)/2],{interactive:false,icon:L.divIcon({className:'migration-arrow',html:'<span style="display:block;color:'+color+';font-size:22px;transform:rotate('+angle+'deg)">↑</span>',iconSize:[22,22],iconAnchor:[11,11]})}).addTo(layer);
 });
 const latest=ps[ps.length-1],north=ps.filter(p=>p.direction==='S→N').length,south=ps.filter(p=>p.direction==='N→S').length;
 const status=latest?'Último par: '+latest.direction+' · '+when(latest.b.time):'Sin pares elegibles en la ventana';
 node.innerHTML='<p><b>EXPERIMENTAL · '+esc(status)+'</b></p>'+
 '<label><input id="migrationVisible" type="checkbox" '+(visible?'checked':'')+'> Mostrar enlaces discontinuos y flechas</label>'+
 '<p class="small">Ecuador y frontera inmediata · M≥3 · últimas 72 h. Pares consecutivos separados ≤24 h y ≤500 km; cambio latitudinal >0,2° para asignar dirección. Umbrales exploratorios, sin calibración predictiva. '+es.length+' eventos disponibles; '+north+' pares S→N y '+south+' N→S. Muestra parcial: estos conteos no representan probabilidades.</p>'+
 '<table class="table"><thead><tr><th>Secuencia observada</th><th>Dirección / intervalo</th><th>Profundidad</th></tr></thead><tbody>'+
 (ps.slice(-6).reverse().map(p=>'<tr><td>'+esc(p.a.place)+' M'+p.a.mag.toFixed(1)+' → '+esc(p.b.place)+' M'+p.b.mag.toFixed(1)+'<br><small>'+when(p.a.time)+' → '+when(p.b.time)+' (Ecuador)</small></td><td>'+p.direction+'<br>'+Math.round(p.hours*60)+' min · '+Math.round(p.km)+' km</td><td>'+p.a.depth.toFixed(1)+' → '+p.b.depth.toFixed(1)+' km</td></tr>').join('')||'<tr><td colspan="3">Datos insuficientes para describir una secuencia reciente.</td></tr>')+
 '</tbody></table>'+
 '<p><b>Escenarios de seguimiento, sin orden de riesgo</b></p><ul>'+
 '<li><b>Continuación hacia el norte:</b> Esmeraldas–Nariño/Cauca. Requiere nuevos eventos y tendencia persistente; el par Esmeraldas→Manabí no aporta evidencia a esa dirección.</li>'+
 '<li><b>Desplazamiento hacia el sur:</b> Manabí–Santa Elena–Golfo. Se conserva como hipótesis rival; un par no permite anunciar el siguiente lugar, magnitud o fecha.</li>'+
 '<li><b>Actividad local o sin dirección:</b> contrastar clustering, tasa de fondo y mecanismos focales antes de atribuir transferencia regional.</li></ul>'+
 '<p class="small">Azuay conserva su evaluación científica propia: no adquiere prioridad por el sismo de Esmeraldas. IDS, IDG-ST, IITE e IAC permanecen independientes; esta capa no eleva el ICM. GNSS/InSAR ausente continúa como datos insuficientes.</p>'+
 '<p class="small">Revisión de referencia: <a href="https://igepn.edu.ec/portal/sismos/index2.html" target="_blank" rel="noopener">boletín IG-EPN del 03/10/2026</a>: Esmeraldas 3,8 MLv / 67,7 km y Manabí 3,7 MLv / 31,0 km. Soluciones revisadas sustituyen sus mismos ID en esta capa; no se suman como nuevos sismos. Es una captura documental, no una conexión continua al boletín; se excluye automáticamente al superar 72 h. Los otros eventos proceden de los catálogos cargados. Actualización del cálculo: '+when(now)+'.</p>';
 node.querySelector('#migrationVisible').onchange=e=>{visible=e.target.checked;if(visible)layer.addTo(map);else map.removeLayer(layer);};
 window.mivigeMigrationExperimental={events:es,pairs:ps,time:now,scientificWeight:0};
}
window.addEventListener('mivige:model',render);render();
})();
