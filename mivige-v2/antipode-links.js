(function(){
'use strict';

if(typeof L==='undefined'||typeof map==='undefined')return;

const CFG={
  sourceMag:6.5,
  coreKm:225,
  haloKm:560,
  watchHours:72,
  responseMagFloor:3.5
};

const RECEIVERS=[
  {id:'cl_c',country:'Chile',name:'Chile central',lat:-32.0,lon:-71.5,r:360,sourceRegion:'Asia oriental / antípoda calculada'},
  {id:'cl_n',country:'Chile',name:'Chile norte',lat:-23.5,lon:-70.5,r:390,sourceRegion:'Asia oriental / antípoda calculada'},
  {id:'pe_s',country:'Perú',name:'Perú sur',lat:-16.2,lon:-73.3,r:360,sourceRegion:'Vietnam/Laos central'},
  {id:'pe_c',country:'Perú',name:'Perú central',lat:-11.5,lon:-77.2,r:340,sourceRegion:'Golfo de Tailandia / Camboya'},
  {id:'pe_n',country:'Perú',name:'Perú norte',lat:-6.0,lon:-80.4,r:330,sourceRegion:'Mar de Andamán / Tailandia-Malasia'},
  {id:'ec_s',country:'Ecuador',name:'Ecuador sur · Golfo/El Oro',lat:-3.15,lon:-80.2,r:190,sourceRegion:'Norte de Sumatra / Indonesia'},
  {id:'ec_az',country:'Ecuador',name:'Ecuador · Azuay/intraslab',lat:-2.9,lon:-79.0,r:150,sourceRegion:'Sumatra / Indonesia · antípoda calculada'},
  {id:'ec_c',country:'Ecuador',name:'Ecuador centro · Manabí',lat:-1.0,lon:-80.55,r:220,sourceRegion:'Sumatra occidental / Indonesia'},
  {id:'ec_n',country:'Ecuador',name:'Ecuador norte · Esmeraldas',lat:0.55,lon:-79.9,r:210,sourceRegion:'Sumatra occidental / Indonesia'},
  {id:'co_p',country:'Colombia',name:'Colombia Pacífico · Nariño/Cauca',lat:2.5,lon:-77.7,r:250,sourceRegion:'Sumatra central / Indonesia'},
  {id:'co_ch',country:'Colombia',name:'Colombia · Chocó',lat:4.9,lon:-76.75,r:250,sourceRegion:'Sumatra sur / Indonesia'},
  {id:'ven',country:'Venezuela',name:'Venezuela costera',lat:10.2,lon:-64.5,r:520,sourceRegion:'Océano Índico / Asia meridional · antípoda calculada'}
];

const layer=L.layerGroup(); // No area circles: links are the primary representation.
const links=L.layerGroup().addTo(map);
const learningLinks=L.layerGroup().addTo(map);
const sourceEvents=L.layerGroup().addTo(map);

function anti(lat,lon){return {lat:-lat,lon:lon<0?lon+180:lon-180};}
function nearReceiver(events,r,a,b,minMag){
  return events.filter(e=>e.time>=a&&e.time<b&&Number(e.mag)>=minMag&&distKm(e.lat,e.lon,r.lat,r.lon)<=r.r);
}
function findMc(r){
  const m=window.mivigeV2?.states?.find(x=>x.s&&x.s.id===r.id);
  return m&&Number.isFinite(m.mc)?m.mc:3.0;
}
function fmt(e){
  if(!e)return '—';
  return 'M'+Number(e.mag).toFixed(1)+' · '+Math.round(Number(e.depth||0))+' km · '+ecuTime(Number(e.time))+' · '+(e.place||e.source||'');
}
function focusState(d){
  if(d<=CFG.coreKm)return {label:'NÚCLEO',score:1};
  if(d<=CFG.haloKm)return {label:'HALO',score:Math.max(0,1-(d-CFG.coreKm)/(CFG.haloKm-CFG.coreKm))};
  return {label:'SIN ACTIVACIÓN',score:0};
}
function learningCandidates(events,r,now){
  const ap=anti(r.lat,r.lon),cut=now-CFG.watchHours*3600e3;
  return events.filter(e=>e.source==='USGS'&&e.time>=cut&&e.time<=now&&Number(e.mag)>=5.0&&Number(e.mag)<CFG.sourceMag)
    .map(e=>({e,d:distKm(ap.lat,ap.lon,e.lat,e.lon)})).filter(x=>x.d<=CFG.haloKm)
    .sort((a,b)=>a.d-b.d||b.e.mag-a.e.mag);
}
function sourceCandidates(events,r,now){
  const ap=anti(r.lat,r.lon);
  const cut=now-CFG.watchHours*3600e3;
  const pool=events.filter(e=>e.source==='USGS'&&e.time>=cut&&e.time<=now&&Number(e.mag)>=CFG.sourceMag);
  return pool.map(e=>{
    const d=distKm(ap.lat,ap.lon,e.lat,e.lon);
    const f=focusState(d);
    return {e,d,f};
  }).filter(x=>x.d<=CFG.haloKm).sort((a,b)=>a.d-b.d||b.e.mag-a.e.mag);
}
function response(events,r,src,now){
  if(!src)return {state:'sin fuente activa',post:[],pre:[],ratio:null};
  const t0=src.time, end=Math.min(now,t0+CFG.watchHours*3600e3),span=Math.max(1,end-t0);
  const minMag=Math.max(CFG.responseMagFloor,findMc(r));
  const post=nearReceiver(events,r,t0,end+1,minMag);
  const pre=nearReceiver(events,r,t0-span,t0,minMag);
  const ratio=(post.length+1)/(pre.length+1);
  let state='sin respuesta material';
  if(post.length&&ratio>=1.5)state='respuesta compatible experimental';
  else if(post.length)state='respuesta parcial';
  else if(now<t0+CFG.watchHours*3600e3)state='ventana abierta · sin respuesta aún';
  return {state,post,pre,ratio,minMag};
}
function color(label){return label==='NÚCLEO'?'#e4493f':label==='HALO'?'#f0c644':'#42b86b';}
function ensureBottomPanel(){
  if(document.getElementById('antiBottomBtn'))return;
  const btn=document.createElement('button');btn.id='antiBottomBtn';btn.type='button';btn.textContent='🌐 ANTÍPODAS ACTIVAS';btn.style.cssText='position:fixed;left:50%;bottom:14px;transform:translateX(-50%);z-index:1200;padding:10px 16px;border-radius:22px;font-weight:800;box-shadow:0 3px 14px #0008';
  const panel=document.createElement('div');panel.id='antiBottomPanel';panel.style.cssText='display:none;position:fixed;left:10px;right:10px;bottom:58px;max-height:52vh;overflow:auto;z-index:1199;background:#101820ee;border:1px solid #6b7b88;border-radius:12px;padding:12px;color:#fff;box-shadow:0 5px 22px #000a';
  panel.innerHTML='<div style="display:flex;justify-content:space-between;gap:8px"><b>🌐 Países/regiones antipodales activas</b><button id="antiBottomClose">×</button></div><div class="small">V1 M≥6,5 y challengers M5,0–6,49 se muestran por separado.</div><div id="antiBottomRows" style="margin-top:8px">Calculando…</div>';
  document.body.appendChild(panel);document.body.appendChild(btn);
  btn.onclick=()=>panel.style.display=panel.style.display==='none'?'block':'none';
  panel.querySelector('#antiBottomClose').onclick=()=>panel.style.display='none';
}
function renderVisibleAntipodes(active,learning){
 const rows=document.getElementById('antiVisibleRows'),sum=document.getElementById('antiVisibleSummary');if(!rows||!sum)return;
 const items=[];
 active.forEach(x=>items.push({kind:'V1',r:x.r,e:x.src.e,d:x.src.d,band:x.src.f.label}));
 learning.forEach(x=>items.push({kind:'CHALLENGER',r:x.r,e:x.q.e,d:x.q.d,band:x.q.d<=CFG.coreKm?'NÚCLEO':'HALO'}));
 const unique=[];items.forEach(x=>{const k=x.kind+'|'+x.r.id+'|'+(x.e.id||x.e.time);if(!unique.some(y=>y.k===k))unique.push({...x,k});});
 sum.innerHTML=unique.length?'<b>'+unique.length+' coincidencia(s) antipodal(es) M≥5,0</b> en las últimas 72 h.':'<b>SIN ACTIVACIÓN ANTIPODAL DETECTADA</b> · no hay fuentes M≥5,0 dentro de núcleo/halo en las últimas 72 h.';
 rows.innerHTML=unique.map(x=>'<div class="listitem"><div><b>'+x.kind+' · '+x.r.country+' · '+x.r.name+'</b><div class="zdesc">Fuente: '+fmt(x.e)+'<br>Antípoda receptora: '+x.band+' · '+Math.round(x.d)+' km · seguimiento 24/72 h</div></div></div>').join('');
}
function renderBottom(active,learning){
  ensureBottomPanel();const el=document.getElementById('antiBottomRows'),btn=document.getElementById('antiBottomBtn');if(!el)return;
  const rows=[];
  active.forEach(x=>rows.push('<div class="listitem"><div><b>'+x.r.country+' → '+x.r.name+'</b><br><span class="small">V1 · M'+Number(x.src.e.mag).toFixed(1)+' · '+x.src.f.label+' · '+Math.round(x.src.d)+' km · '+(x.src.e.place||'fuente global')+'</span></div></div>'));
  learning.forEach(x=>rows.push('<div class="listitem"><div><b>'+x.r.country+' → '+x.r.name+'</b><br><span class="small">CHALLENGER · M'+Number(x.q.e.mag).toFixed(1)+' · '+(x.q.d<=CFG.coreKm?'NÚCLEO':'HALO')+' · '+Math.round(x.q.d)+' km · '+(x.q.e.place||'fuente global')+' · 24/72 h</span></div></div>'));
  el.innerHTML=rows.length?rows.join(''):'<div class="small">Sin fuentes antipodales M≥5,0 dentro del núcleo/halo durante las últimas 72 h.</div>';
  btn.textContent='🌐 ANTÍPODAS ACTIVAS · '+rows.length;
}
function ensureCard(){
  if(document.getElementById('antipodeNetworkV2'))return;
  const aside=document.querySelector('aside');if(!aside)return;
  const c=document.createElement('section');c.className='card';c.id='antipodeNetworkV2';
  c.innerHTML='<h2>🌐 Challenger Antípoda · vigilancia permanente por receptor</h2>'+
    '<div class="small"><b>Geometría:</b> antípoda = (−latitud, longitud ±180°). Para cada receptor sudamericano se calcula su punto antipodal exacto y se busca una fuente global M≥'+CFG.sourceMag.toFixed(1)+' durante '+CFG.watchHours+' h. <b>Núcleo:</b> ≤'+CFG.coreKm+' km; <b>halo experimental:</b> '+CFG.coreKm+'–'+CFG.haloKm+' km. Una coincidencia no demuestra que el evento remoto haya causado un sismo en el receptor.</div>'+
    '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px"><button id="antiViewSources">Ver vínculos antipodales</button><button id="antiViewReceivers">Volver a Sudamérica</button></div>'+
    '<div id="antiSummary" class="small" style="margin-top:8px">Calculando red antipodal…</div>'+
    '<div id="antiRows" style="margin-top:8px"></div>'+
    '<details style="margin-top:8px"><summary>Cómo se usa en MIVIGE</summary><div class="small" style="margin-top:6px">'+
      '1) un terremoto remoto M≥'+CFG.sourceMag.toFixed(1)+' debe caer dentro de la huella antipodal de un receptor; '+
      '2) se abre una ventana 0–6 h / 6–24 h / 24–72 h; '+
      '3) se compara la sismicidad receptora contra una ventana previa equivalente y su Mc local; '+
      '4) el resultado se registra como experimental y <b>no eleva por sí solo el ICM científico</b>.'+
    '</div></details>';
  const exp=[...document.querySelectorAll('section.card h2')].find(h=>/Challenger experimental/i.test(h.textContent||''));
  exp?exp.parentElement.insertAdjacentElement('afterend',c):aside.appendChild(c);
  document.getElementById('antiViewSources').onclick=()=>{
    const pts=(window.mivigeAntipodeNetworkV2?.active||[]).filter(x=>x.src.d<=CFG.coreKm).flatMap(x=>[[x.src.e.lat,x.src.e.lon],[x.r.lat,x.r.lon]]);
    if(pts.length)map.fitBounds(pts,{padding:[25,25]});
    if(!map.hasLayer(links))links.addTo(map);
    if(!map.hasLayer(sourceEvents))sourceEvents.addTo(map);
  };
  document.getElementById('antiViewReceivers').onclick=()=>{
    map.fitBounds(RECEIVERS.map(r=>[r.lat,r.lon]),{padding:[60,60],maxZoom:5});
    if(!map.hasLayer(links))links.addTo(map);
  };
}
function drawReceiver(r,ap,status,src){
  if(!src||src.d>CFG.coreKm)return;
  const c=color(status.label);
  L.circleMarker([src.e.lat,src.e.lon],{radius:5,color:c,weight:2,fillColor:c,fillOpacity:.9})
    .bindPopup('<b>Origen del sismo · vínculo antipodal experimental</b><br>'+fmt(src.e)+'<br>Receptor: '+r.name+'<br>Distancia a antípoda exacta: '+Math.round(src.d)+' km · '+src.f.label)
    .addTo(sourceEvents);
}
function drawLearningLinks(items){
  learningLinks.clearLayers();
  items.forEach(x=>{const q=x.q,r=x.r,c=q.d<=CFG.coreKm?'#f0c644':'#8fb8ff';const label='CHALLENGER M'+Number(q.e.mag).toFixed(1)+' · '+(q.d<=CFG.coreKm?'NÚCLEO':'HALO')+' · '+Math.round(q.d)+' km → '+r.name+' · 24/72 h · no activa V1';L.polyline([[q.e.lat,q.e.lon],[r.lat,r.lon]],{color:c,weight:1.8,dashArray:'4 8',opacity:.7}).bindTooltip(label).bindPopup(label+'<br>Relación geométrica experimental; no implica transferencia causal de energía.').addTo(learningLinks);L.circleMarker([q.e.lat,q.e.lon],{radius:4,color:c,weight:1.5,fillOpacity:.75}).bindPopup('<b>Fuente antipodal en aprendizaje</b><br>'+fmt(q.e)+'<br>'+label).addTo(learningLinks);});
}
function drawLinks(active){
  links.clearLayers();
  active.filter(x=>x.src.d<=CFG.coreKm).forEach(x=>{
    const r=x.r,origin=[x.src.e.lat,x.src.e.lon],dest=[r.lat,r.lon],c='#d7a5ff';
    const label='Sismo '+fmt(x.src.e)+' → '+r.name+' · correspondencia con núcleo antipodal (≤'+CFG.coreKm+' km)';
    L.polyline([origin,dest],{color:c,weight:2.5,dashArray:'9 7',opacity:.9})
      .bindTooltip(label).bindPopup(label+'<br>La línea indica una relación geométrica; no una trayectoria de energía ni causalidad demostrada.').addTo(links);
    // Arrowhead near Ecuador; schematic direction only, not wave propagation.
    const dx=dest[1]-origin[1],dy=dest[0]-origin[0],len=Math.hypot(dx,dy),ux=dx/len,uy=dy/len;
    const tip=[dest[0]-uy*.8,dest[1]-ux*.8],size=1.25;
    L.polyline([[tip[0]-uy*size+ux*size*.45,tip[1]-ux*size-uy*size*.45],tip,[tip[0]-uy*size-ux*size*.45,tip[1]-ux*size+uy*size*.45]],{color:c,weight:2.5,opacity:.9,interactive:false}).addTo(links);
  });
}
function run(){
  ensureCard();
  if(!Array.isArray(allEvents))return;
  layer.clearLayers();sourceEvents.clearLayers();
  const now=Date.now(),rows=[],active=[],learning=[];
  let nCore=0,nHalo=0;
  for(const r of RECEIVERS){
    const ap=anti(r.lat,r.lon);
    const cand=sourceCandidates(allEvents,r,now);
    const learn=learningCandidates(allEvents,r,now);
    learn.forEach(q=>learning.push({r,q}));
    const src=cand[0]||null;
    const st=src?src.f:{label:'SIN ACTIVACIÓN',score:0};
    if(st.label==='NÚCLEO')nCore++; else if(st.label==='HALO')nHalo++;
    const resp=response(allEvents,r,src&&src.e,now);
    // Draw every qualifying event, not only the nearest event per receptor.
    cand.forEach(candidate=>{
      active.push({r,ap,src:candidate});
      drawReceiver(r,ap,candidate.f,candidate);
    });
    const windowLabel=src?((now-src.e.time)/3600e3<=6?'0–6 h':(now-src.e.time)/3600e3<=24?'6–24 h':'24–72 h'):'—';
    rows.push('<div class="listitem"><div class="dot" style="background:'+color(st.label)+'"></div><div><div class="zname">'+r.country+' · '+r.name+'</div><div class="zdesc">'+
      '<b>Fuente antipodal:</b> '+r.sourceRegion+' · exacta '+ap.lat.toFixed(2)+'°, '+ap.lon.toFixed(2)+'°<br>'+
      (src?('<b>Evento:</b> '+fmt(src.e)+'<br><b>Distancia:</b> '+Math.round(src.d)+' km · <b>'+st.label+'</b> · ventana '+windowLabel+'<br><b>Receptor:</b> '+resp.state+(resp.ratio!=null?' · razón tasa ×'+resp.ratio.toFixed(2):'')):'<b>Estado:</b> SIN ACTIVACIÓN ANTIPODAL DETECTADA · sin fuente M≥'+CFG.sourceMag.toFixed(1)+' dentro del halo en '+CFG.watchHours+' h')+
      (learn.length?('<br><span style="color:#f0c644"><b>CHALLENGER EN OBSERVACIÓN:</b> '+learn.slice(0,3).map(q=>'M'+Number(q.e.mag).toFixed(1)+' · '+(q.d<=CFG.coreKm?'NÚCLEO':'HALO')+' · '+Math.round(q.d)+' km').join(' | ')+' · ventanas 24/72 h · no activa V1</span>'):'')+
      '</div></div><div class="pct">'+st.label+'</div></div>');
  }
  drawLinks(active);
  drawLearningLinks(learning);\n  renderBottom(active,learning);\n  renderVisibleAntipodes(active,learning);
  const direct=active.filter(x=>x.src.d<=CFG.coreKm);
  const sourceButton=document.getElementById('antiViewSources');sourceButton.disabled=!direct.length;sourceButton.textContent=direct.length?'Ver vínculos activos':'Sin activación núcleo';
  document.getElementById('antiRows').innerHTML=rows.join('');
  document.getElementById('antiSummary').innerHTML='<b>Estado actual:</b> '+nCore+' receptor(es) con fuente en núcleo · '+nHalo+' en halo · '+(RECEIVERS.length-nCore-nHalo)+' sin fuente antipodal activa. '+
    '<br><b>Mapa:</b> líneas discontinuas hacia los receptores únicamente si un sismo M≥'+CFG.sourceMag+' de las últimas '+CFG.watchHours+' h está a ≤'+CFG.coreKm+' km de su antípoda. Los eventos solo en el halo no generan líneas. Sin evento correspondiente, no se dibuja ningún vínculo.<br><b>Patrón geográfico:</b> cada receptor usa su <b>antípoda matemática exacta</b>; las etiquetas regionales son descriptivas y no sustituyen el cálculo geométrico. La ausencia de una fuente en la huella significa <b>sin activación antipodal detectada</b>, no ausencia de peligro sísmico.<br><b>Aprendizaje:</b> fuentes M5,0–6,49 dentro de núcleo/halo se muestran como CHALLENGER EN OBSERVACIÓN y se siguen a 24/72 h; no activan V1.';
  window.mivigeAntipodeNetworkV2={receivers:RECEIVERS,active,config:CFG};
}
ensureCard();
try{L.control.layers({},{
  'Antípodas · vínculos fuente → receptor':links,
  'Red antipodal · fuentes M≥6.5':sourceEvents,
  'Antípodas · aprendizaje M5.0–6.49':learningLinks
},{collapsed:true,position:'topright'}).addTo(map);}catch(_){}
window.addEventListener('mivige:model',run);
setTimeout(run,2800);
setInterval(run,60000);
const b=document.getElementById('refresh');if(b)b.addEventListener('click',()=>setTimeout(run,2200));
})();