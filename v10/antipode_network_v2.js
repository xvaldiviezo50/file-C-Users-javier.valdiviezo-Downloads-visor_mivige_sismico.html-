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
  {id:'pe_s',country:'Perú',name:'Perú sur',lat:-16.2,lon:-73.3,r:360,sourceRegion:'Vietnam/Laos central'},
  {id:'pe_c',country:'Perú',name:'Perú central',lat:-11.5,lon:-77.2,r:340,sourceRegion:'Golfo de Tailandia / Camboya'},
  {id:'pe_n',country:'Perú',name:'Perú norte',lat:-6.0,lon:-80.4,r:330,sourceRegion:'Mar de Andamán / Tailandia-Malasia'},
  {id:'ec_s',country:'Ecuador',name:'Ecuador sur · Golfo/El Oro',lat:-3.15,lon:-80.2,r:190,sourceRegion:'Norte de Sumatra / Indonesia'},
  {id:'ec_c',country:'Ecuador',name:'Ecuador centro · Manabí',lat:-1.0,lon:-80.55,r:220,sourceRegion:'Sumatra occidental / Indonesia'},
  {id:'ec_n',country:'Ecuador',name:'Ecuador norte · Esmeraldas',lat:0.55,lon:-79.9,r:210,sourceRegion:'Sumatra occidental / Indonesia'},
  {id:'co_p',country:'Colombia',name:'Colombia Pacífico · Nariño/Cauca',lat:2.5,lon:-77.7,r:250,sourceRegion:'Sumatra central / Indonesia'},
  {id:'co_ch',country:'Colombia',name:'Colombia · Chocó',lat:4.9,lon:-76.75,r:250,sourceRegion:'Sumatra sur / Indonesia'}
];

const layer=L.layerGroup().addTo(map);
const links=L.layerGroup();
const sourceEvents=L.layerGroup();

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
  return {label:'FUERA',score:0};
}
function sourceCandidates(events,r,now){
  const ap=anti(r.lat,r.lon);
  const cut=now-CFG.watchHours*3600e3;
  const pool=events.filter(e=>e.source==='USGS'&&e.time>=cut&&Number(e.mag)>=CFG.sourceMag);
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
function color(label){return label==='NÚCLEO'?'#e4493f':label==='HALO'?'#f0c644':'#46647e';}
function ensureCard(){
  if(document.getElementById('antipodeNetworkV2'))return;
  const aside=document.querySelector('aside');if(!aside)return;
  const c=document.createElement('section');c.className='card';c.id='antipodeNetworkV2';
  c.innerHTML='<h2>🌐 Red antipodal · Ecuador–Perú–Colombia</h2>'+
    '<div class="small"><b>Geometría:</b> antípoda = (−latitud, longitud ±180°). Para cada receptor sudamericano se calcula su punto antipodal exacto y se busca una fuente global M≥'+CFG.sourceMag.toFixed(1)+' durante '+CFG.watchHours+' h. <b>Núcleo:</b> ≤'+CFG.coreKm+' km; <b>halo experimental:</b> '+CFG.coreKm+'–'+CFG.haloKm+' km. Una coincidencia no demuestra que el evento remoto haya causado un sismo en el receptor.</div>'+
    '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px"><button id="antiViewSources">Ver fuentes antipodales</button><button id="antiViewReceivers">Volver a Sudamérica</button></div>'+
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
    const pts=RECEIVERS.map(r=>{const a=anti(r.lat,r.lon);return [a.lat,a.lon]});
    if(pts.length)map.fitBounds(pts,{padding:[25,25]});
    if(!map.hasLayer(layer))layer.addTo(map);
    if(!map.hasLayer(sourceEvents))sourceEvents.addTo(map);
  };
  document.getElementById('antiViewReceivers').onclick=()=>{
    map.fitBounds(RECEIVERS.map(r=>[r.lat,r.lon]),{padding:[25,25]});
    if(!map.hasLayer(layer))layer.addTo(map);
  };
}
function drawReceiver(r,ap,status,src){
  const c=color(status.label);
  L.circle([r.lat,r.lon],{radius:r.r*1000,color:c,weight:2,fillColor:c,fillOpacity:.06})
    .bindPopup('<b>Receptor experimental</b><br>'+r.name+'<br>Antípoda: '+ap.lat.toFixed(2)+'°, '+ap.lon.toFixed(2)+'°<br>Zona fuente aproximada: '+r.sourceRegion)
    .addTo(layer);
  L.circle([ap.lat,ap.lon],{radius:CFG.coreKm*1000,color:'#e4493f',weight:2,fillColor:'#e4493f',fillOpacity:.035})
    .bindTooltip(r.name+' · núcleo antipodal').addTo(layer);
  L.circle([ap.lat,ap.lon],{radius:CFG.haloKm*1000,color:'#f0c644',weight:1,dashArray:'6 6',fillOpacity:0})
    .bindTooltip(r.name+' · halo antipodal').addTo(layer);
  if(src){
    L.circleMarker([src.e.lat,src.e.lon],{radius:8,color:c,weight:2.5,fillColor:magColor(src.e.mag),fillOpacity:.9})
      .bindPopup('<b>Fuente antipodal candidata</b><br>'+fmt(src.e)+'<br>Distancia a antípoda exacta: '+Math.round(src.d)+' km · '+src.f.label)
      .addTo(sourceEvents);
  }
}
function drawLinks(active){
  links.clearLayers();
  active.forEach(x=>{
    if(!x.src)return;
    const ap=x.ap;
    L.polyline([[x.r.lat,x.r.lon],[ap.lat,ap.lon]],{color:'#af7cff',weight:1.6,dashArray:'5 7',opacity:.65})
      .bindTooltip(x.r.name+' ↔ antípoda exacta').addTo(links);
  });
}
function run(){
  ensureCard();
  if(!Array.isArray(allEvents))return;
  layer.clearLayers();sourceEvents.clearLayers();
  const now=Date.now(),rows=[],active=[];
  let nCore=0,nHalo=0;
  for(const r of RECEIVERS){
    const ap=anti(r.lat,r.lon);
    const cand=sourceCandidates(allEvents,r,now);
    const src=cand[0]||null;
    const st=src?src.f:{label:'FUERA',score:0};
    if(st.label==='NÚCLEO')nCore++; else if(st.label==='HALO')nHalo++;
    const resp=response(allEvents,r,src&&src.e,now);
    if(src)active.push({r,ap,src});
    drawReceiver(r,ap,st,src);
    const windowLabel=src?((now-src.e.time)/3600e3<=6?'0–6 h':(now-src.e.time)/3600e3<=24?'6–24 h':'24–72 h'):'—';
    rows.push('<div class="listitem"><div class="dot" style="background:'+color(st.label)+'"></div><div><div class="zname">'+r.country+' · '+r.name+'</div><div class="zdesc">'+
      '<b>Fuente antipodal:</b> '+r.sourceRegion+' · exacta '+ap.lat.toFixed(2)+'°, '+ap.lon.toFixed(2)+'°<br>'+
      (src?('<b>Evento:</b> '+fmt(src.e)+'<br><b>Distancia:</b> '+Math.round(src.d)+' km · <b>'+st.label+'</b> · ventana '+windowLabel+'<br><b>Receptor:</b> '+resp.state+(resp.ratio!=null?' · razón tasa ×'+resp.ratio.toFixed(2):'')):'<b>Estado:</b> sin fuente M≥'+CFG.sourceMag.toFixed(1)+' dentro del halo en '+CFG.watchHours+' h')+
      '</div></div><div class="pct">'+st.label+'</div></div>');
  }
  drawLinks(active);
  document.getElementById('antiRows').innerHTML=rows.join('');
  document.getElementById('antiSummary').innerHTML='<b>Estado actual:</b> '+nCore+' receptor(es) con fuente en núcleo · '+nHalo+' en halo · '+(RECEIVERS.length-nCore-nHalo)+' sin fuente antipodal activa. '+
    '<br><b>Patrón geográfico:</b> las antípodas de Ecuador y Colombia Pacífico se concentran principalmente en <b>Sumatra/Indonesia</b>; las de Perú se extienden desde el <b>Mar de Andamán–Malasia/Tailandia</b> hasta <b>Camboya–Vietnam/Laos</b>.';
  window.mivigeAntipodeNetworkV2={receivers:RECEIVERS,active,config:CFG};
}
ensureCard();
try{L.control.layers({},{
  'Red antipodal · receptores y huellas':layer,
  'Red antipodal · vínculos':links,
  'Red antipodal · fuentes M≥6.5':sourceEvents
},{collapsed:true,position:'topright'}).addTo(map);}catch(_){}
setTimeout(run,2800);
setInterval(run,60000);
const b=document.getElementById('refresh');if(b)b.addEventListener('click',()=>setTimeout(run,2200));
})();