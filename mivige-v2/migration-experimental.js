/* Experimental directional monitoring v3: two frozen observation corridors; never changes scientific ICM. */
(function(){
'use strict';
const H=3600000, cutoffHours=72;
const reviewed=[
{id:'igepn2026tkyp',source:'IG-EPN',time:Date.parse('2026-10-04T08:57:18Z'),lat:-3.041,lon:-80.216,depth:48.9,mag:4.5,place:'Machala · El Oro',reviewed:true},
{id:'igepn2026tjud',source:'IG-EPN',time:Date.parse('2026-10-03T17:34:20Z'),lat:.594,lon:-79.209,depth:67.7,mag:3.8,place:'Quinindé · Esmeraldas',reviewed:true},
{id:'igepn2026tjwt',source:'IG-EPN',time:Date.parse('2026-10-03T18:53:01Z'),lat:-1.301,lon:-80.516,depth:31,mag:3.7,place:'Jipijapa · Manabí',reviewed:true}
];
const CORRIDORS={
 west:{
  id:'west',name:'Occidente Ecuador–Colombia',minMag:3.0,maxPairKm:520,maxGapH:24,
  contains:e=>e.lat>=-5.5&&e.lat<=7&&e.lon>=-83&&e.lon<=-75,
  colorNorth:'#3ddbd9',colorSouth:'#ffbc66',
  hypothesis:'P-EXT-COL-ECU-06OCT-2026-01',
  frozenAt:'2026-10-06T12:18:00Z',
  note:'Dos frentes externos en seguimiento: costa norte de Colombia hacia el sur (~M3,5) y occidente Ecuador–Colombia hacia el norte (~M4,5).'
 },
 caribbean:{
  id:'caribbean',name:'Caribe · La Española–Venezuela–norte de Colombia',minMag:2.5,maxPairKm:850,maxGapH:24,
  contains:e=>e.lat>=8&&e.lat<=21&&e.lon>=-84&&e.lon<=-60,
  colorEast:'#c992ff',colorWest:'#5bc0ff',
  hypothesis:'P-EXT-CARIBE-06OCT-2026-01',
  frozenAt:'2026-10-06T20:14:00-05:00',
  note:'Actividad moderada-baja externa en Haití/República Dominicana, norte de Venezuela y Caribe/norte de Colombia; se evalúa continuidad, no transferencia causal.'
 }
};
function distance(a,b){
 const r=Math.PI/180,dlat=(b.lat-a.lat)*r,dlon=(b.lon-a.lon)*r;
 return 12742*Math.asin(Math.min(1,Math.sqrt(Math.sin(dlat/2)**2+Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin(dlon/2)**2)));
}
function bearing(a,b){
 const R=Math.PI/180,p1=a.lat*R,p2=b.lat*R,dl=(b.lon-a.lon)*R;
 const y=Math.sin(dl)*Math.cos(p2),x=Math.cos(p1)*Math.sin(p2)-Math.sin(p1)*Math.cos(p2)*Math.cos(dl);
 return (Math.atan2(y,x)*180/Math.PI+360)%360;
}
function angleDiff(a,b){const d=Math.abs(a-b)%360;return d>180?360-d:d;}
function meanBearing(xs){
 if(!xs.length)return null;
 const r=Math.PI/180,s=xs.reduce((a,x)=>a+Math.sin(x*r),0),c=xs.reduce((a,x)=>a+Math.cos(x*r),0);
 return (Math.atan2(s,c)*180/Math.PI+360)%360;
}
function directionLabel(brg){
 if(!Number.isFinite(brg))return 'sin dirección';
 if(brg>=337.5||brg<22.5)return'N';
 if(brg<67.5)return'NE';
 if(brg<112.5)return'E';
 if(brg<157.5)return'SE';
 if(brg<202.5)return'S';
 if(brg<247.5)return'SO';
 if(brg<292.5)return'O';
 return'NO';
}
function dedup(pool){
 const out=[];
 for(const e of pool.sort((a,b)=>a.time-b.time)){
  if(out.some(a=>a.id===e.id||(a.source!==e.source&&Math.abs(a.time-e.time)<60000&&distance(a,e)<30&&Math.abs(a.mag-e.mag)<.6)))continue;
  out.push(e);
 }
 return out;
}
function prepare(events,now,cfg){
 const valid=e=>Number.isFinite(e.time)&&e.time<=now&&e.time>=now-cutoffHours*H&&Number.isFinite(e.lat)&&Number.isFinite(e.lon)&&Number(e.mag)>=cfg.minMag&&cfg.contains(e);
 const base=events.filter(valid);
 const refs=cfg.id==='west'?reviewed.filter(valid):[];
 const pool=base.filter(e=>!refs.some(r=>r.id===e.id||Math.abs(r.time-e.time)<60000&&distance(r,e)<30&&Math.abs(r.mag-e.mag)<.6)).concat(refs);
 return dedup(pool);
}
function pairs(es,cfg){
 return es.slice(1).map((b,i)=>{
  const a=es[i],km=distance(a,b),hours=(b.time-a.time)/H,azimuth=bearing(a,b);
  const dd=(Number.isFinite(a.depth)&&Number.isFinite(b.depth))?b.depth-a.depth:null;
  return {a,b,km,hours,azimuth,direction:directionLabel(azimuth),depthDelta:dd,apparentKmH:hours>0?km/hours:null,eligible:hours>0&&hours<=cfg.maxGapH&&km<=cfg.maxPairKm};
 }).filter(p=>p.eligible);
}
function coherence(ps){
 const recent=ps.slice(-4);
 if(recent.length<2)return {coherent:false,count:recent.length,meanAzimuth:null,spread:null,label:'muestra insuficiente'};
 const mean=meanBearing(recent.map(p=>p.azimuth));
 const spread=Math.max(...recent.map(p=>angleDiff(p.azimuth,mean)));
 const coherent=spread<=45;
 return {coherent,count:recent.length,meanAzimuth:mean,spread,label:coherent?('secuencia cronológica coherente hacia '+directionLabel(mean)):'direcciones mixtas'};
}
function summarize(events,now,cfg){
 const es=prepare(events,now,cfg),ps=pairs(es,cfg),coh=coherence(ps);
 const north=ps.filter(p=>p.azimuth<=45||p.azimuth>=315).length;
 const south=ps.filter(p=>p.azimuth>=135&&p.azimuth<=225).length;
 const east=ps.filter(p=>p.azimuth>45&&p.azimuth<135).length;
 const west=ps.filter(p=>p.azimuth>225&&p.azimuth<315).length;
 return {config:cfg,events:es,pairs:ps,coherence:coh,counts:{north,south,east,west},latest:ps[ps.length-1]||null};
}
if(typeof module!=='undefined'&&module.exports){module.exports={prepare,pairs,coherence,summarize,reviewed,CORRIDORS};return;}
window.mivigeReviewedSnapshot={source:'https://igepn.edu.ec/portal/sismos/index2.html',checkedOn:'2026-10-04',events:reviewed};
const node=document.getElementById('migrationExperimental');
if(!node)return;
const layer=L.layerGroup().addTo(map);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const when=t=>new Date(t).toLocaleString('es-EC',{timeZone:'America/Guayaquil',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
const depth=x=>Number.isFinite(x)?x.toFixed(1):'NA';
let visible=true;
function pairColor(c,p){
 if(c.id==='west')return (p.azimuth<=45||p.azimuth>=315)?c.colorNorth:(p.azimuth>=135&&p.azimuth<=225)?c.colorSouth:'#aeb8c8';
 return (p.azimuth>45&&p.azimuth<135)?c.colorEast:(p.azimuth>225&&p.azimuth<315)?c.colorWest:'#aeb8c8';
}
function drawCorridor(s){
 s.pairs.slice(-8).forEach(p=>{
  const color=pairColor(s.config,p);
  L.polyline([[p.a.lat,p.a.lon],[p.b.lat,p.b.lon]],{color,weight:3,dashArray:'7 7',opacity:.82})
   .bindTooltip(esc(s.config.name+' · '+p.direction+' · orden temporal, no propagación demostrada')).addTo(layer);
  const angle=p.azimuth;
  L.marker([(p.a.lat+p.b.lat)/2,(p.a.lon+p.b.lon)/2],{interactive:false,icon:L.divIcon({className:'migration-arrow',html:'<span style="display:block;color:'+color+';font-size:22px;transform:rotate('+angle+'deg)">↑</span>',iconSize:[22,22],iconAnchor:[11,11]})}).addTo(layer);
 });
}
function section(s){
 const c=s.config,coh=s.coherence,last=s.latest;
 const state=coh.coherent?'<b>COMPATIBLE / PARCIAL</b> · '+esc(coh.label):'<b>ABIERTA</b> · '+esc(coh.label);
 const rows=s.pairs.slice(-6).reverse().map(p=>'<tr><td>'+esc(p.a.place||p.a.source)+' M'+Number(p.a.mag).toFixed(1)+' → '+esc(p.b.place||p.b.source)+' M'+Number(p.b.mag).toFixed(1)+'<br><small>'+when(p.a.time)+' → '+when(p.b.time)+'</small></td><td>'+p.direction+' · '+p.azimuth.toFixed(0)+'°<br>'+Math.round(p.hours*60)+' min · '+Math.round(p.km)+' km · '+(Number.isFinite(p.apparentKmH)?p.apparentKmH.toFixed(1):'NA')+' km/h aparente</td><td>'+depth(p.a.depth)+' → '+depth(p.b.depth)+' km'+(Number.isFinite(p.depthDelta)?'<br>Δ '+(p.depthDelta>=0?'+':'')+p.depthDelta.toFixed(1)+' km':'')+'</td></tr>').join('');
 return '<div style="border:1px solid #44556b;border-radius:8px;padding:8px;margin:8px 0"><p><b>'+esc(c.name)+'</b><br>'+state+'</p>'+
 '<p class="small"><b>'+esc(c.hypothesis)+'</b> · congelada '+esc(c.frozenAt)+'<br>'+esc(c.note)+'</p>'+
 '<p class="small">Ventana móvil 72 h · M≥'+c.minMag.toFixed(1)+' · pares consecutivos ≤'+c.maxGapH+' h y ≤'+c.maxPairKm+' km. '+s.events.length+' eventos deduplicados; '+s.pairs.length+' pares elegibles. Dispersión azimutal reciente: '+(Number.isFinite(coh.spread)?coh.spread.toFixed(0)+'°':'NA')+'.'+(last?' Último par '+last.direction+' a '+when(last.b.time)+'.':'')+'</p>'+
 '<table class="table"><thead><tr><th>Secuencia observada</th><th>Azimut / intervalo / velocidad aparente</th><th>Profundidad</th></tr></thead><tbody>'+(rows||'<tr><td colspan="3">Datos insuficientes para describir una secuencia reciente.</td></tr>')+'</tbody></table></div>';
}
function render(){
 const now=Date.now(),events=typeof allEvents!=='undefined'?allEvents:[];
 const west=summarize(events,now,CORRIDORS.west),caribbean=summarize(events,now,CORRIDORS.caribbean);
 layer.clearLayers();drawCorridor(west);drawCorridor(caribbean);
 node.innerHTML='<p><b>EXPERIMENTAL · seguimiento direccional ampliado build 3084</b></p>'+
 '<label><input id="migrationVisible" type="checkbox" '+(visible?'checked':'')+'> Mostrar enlaces discontinuos y flechas</label>'+
 section(west)+section(caribbean)+
 '<p><b>Lectura obligatoria:</b> azimut, velocidad aparente y continuidad describen el orden de epicentros. No representan viaje de energía, transferencia causal ni predicción del siguiente sismo.</p>'+
 '<p class="small">Los dos corredores se evalúan por separado. Solo una secuencia de ≥3 eventos (≥2 pares) con dispersión azimutal ≤45° se etiqueta como coherencia cronológica experimental. No modifica IDS, IDG, IITE, IADR ni el semáforo científico. La convergencia visual de ambos corredores tampoco constituye una segunda familia científica.</p>'+
 '<p class="small">Azuay conserva evaluación propia. RENGEO/GNSS ausente continúa como datos insuficientes, nunca deformación cero. Actualización: '+when(now)+'.</p>';
 node.querySelector('#migrationVisible').onchange=e=>{visible=e.target.checked;if(visible)layer.addTo(map);else map.removeLayer(layer);};
 window.mivigeMigrationExperimental={time:now,scientificWeight:0,corridors:{west,caribbean},externalHypotheses:[
  {id:CORRIDORS.west.hypothesis,frozenAt:CORRIDORS.west.frozenAt,status:west.coherence.coherent?'partial-compatible':'open',corridor:'west',scientificWeight:0},
  {id:CORRIDORS.caribbean.hypothesis,frozenAt:CORRIDORS.caribbean.frozenAt,status:caribbean.coherence.coherent?'partial-compatible':'open',corridor:'caribbean',scientificWeight:0}
 ]};
 window.dispatchEvent(new Event('mivige:migration-experimental'));
}
window.addEventListener('mivige:model',render);render();
})();