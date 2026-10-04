const map = L.map('map',{zoomControl:true}).setView([-1.6,-79.4],5.7);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18, attribution:'© OpenStreetMap'}).addTo(map);

const sourcePriority = {'IG-EPN':5,'IGP':4,'SGC':3,'USGS':2};
const sourceStatus = {};
const eventLayer = L.layerGroup().addTo(map);
const eqZoneLayer = L.layerGroup().addTo(map);
const extZoneLayer = L.layerGroup().addTo(map);
const iaexLayer = L.layerGroup().addTo(map);
const plateLayer = L.layerGroup().addTo(map);
let platesLoaded = false;
let allEvents = [];
let refreshAt = Date.now()+3600000;

const zonesEc = [
 {id:'golfo', name:'Tumbes – El Oro – Puná – Golfo', lat:-3.25, lon:-80.15, radius:190, base:0.90, why:'Subducción + corredor costero'},
 {id:'esman', name:'Esmeraldas – Manabí', lat:-0.55, lon:-80.35, radius:230, base:0.68, why:'Interfaz de subducción'},
 {id:'carchi',name:'Carchi – Ibarra – Otavalo',lat:0.45,lon:-78.15,radius:150,base:0.58,why:'Sismicidad cortical y fallas andinas'},
 {id:'quito',name:'Quito',lat:-0.20,lon:-78.50,radius:100,base:0.50,why:'Fallas corticales locales'},
 {id:'palla',name:'Pallatanga – Riobamba',lat:-1.80,lon:-78.75,radius:150,base:0.58,why:'Sistema Pallatanga / andino'},
 {id:'azuay',name:'Azuay – Cuenca',lat:-2.90,lon:-79.02,radius:135,base:0.43,why:'Zona andina; clasificación depende de profundidad y geometría'}
];
const zonesExt = [
 {id:'tumbes',name:'Tumbes – Zorritos (Perú)',lat:-3.65,lon:-80.45,radius:160,base:0.48,why:'Control transfronterizo'},
 {id:'jaen',name:'Jaén – Cajamarca – Bagua',lat:-5.75,lon:-78.69,radius:190,base:0.40,why:'Control cortical norte Perú'},
 {id:'amazonas',name:'Amazonas – Condorcanqui',lat:-4.25,lon:-77.75,radius:180,base:0.70,why:'Secuencia cortical reciente'},
 {id:'narino',name:'Chocó – Darién / Nariño',lat:3.40,lon:-77.00,radius:300,base:0.65,why:'Secuencias regionales y control'},
 {id:'cr',name:'Costa Rica',lat:9.8,lon:-84.1,radius:280,base:0.42,why:'Control Centroamérica'},
 {id:'mx',name:'Oaxaca – Guerrero',lat:16.5,lon:-98.2,radius:330,base:0.46,why:'Control México'},
 {id:'cl',name:'Chile centro-norte',lat:-28.5,lon:-71.4,radius:380,base:0.40,why:'Control Chile'}
];
const allZones = [...zonesEc,...zonesExt];
const footprints = [
 {name:'Huella antipodal Ecuador', lat:-0.8, lon:101.0, radius:700, color:'#af7cff'},
 {name:'Huella antipodal Colombia', lat:-3.2, lon:104.0, radius:850, color:'#d17dff'},
 {name:'Huella antipodal Perú', lat:-8.0, lon:103.5, radius:950, color:'#dba2ff'}
];

const endpoints = {
 'USGS':'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_week.geojson',
 'IG-EPN':"https://srvsigaweb.igepn.edu.ec/server/rest/services/Sismicidad_365/MapServer/0/query?where=1%3D1&outFields=sis3_evento%2Csis3_tiempo%2Csis3_latitud%2Csis3_longitud%2Csis3_profundidad%2Csis3_magnitud_M%2Csis3_tipo_magnitud_P&returnGeometry=true&outSR=4326&orderByFields=sis3_tiempo%20DESC&resultRecordCount=500&f=geojson",
 'IGP':"https://ide.igp.gob.pe/arcgis/rest/services/monitoreocensis/SismosReportados/MapServer/0/query?where=1%3D1&outFields=fecha%2Chora%2Clat%2Clon%2Cprof%2Cref%2Cmagnitud%2Cfechaevento%2Ccode&returnGeometry=true&outSR=4326&orderByFields=fechaevento%20DESC&resultRecordCount=500&f=geojson",
 'SGC':"https://geoportal.sgc.gov.co/arcgis/rest/services/catalogo_sismos/catalogo_de_sismos_2/MapServer/0/query?where=1%3D1&outFields=ESP_ID_EVENTO_TXT%2CESP_MAGNITUD%2CESP_PROFUNDIDAD%2CESP_FECHA_TXT%2CESP_FECHA%2CESP_LATITUD%2CESP_LONGITUD&returnGeometry=true&outSR=4326&orderByFields=ESP_FECHA%20DESC&resultRecordCount=500&f=geojson"
};

function distKm(a,b,c,d){
 const R=6371, p=Math.PI/180, dlat=(c-a)*p, dlon=(d-b)*p;
 const x=Math.sin(dlat/2)**2+Math.cos(a*p)*Math.cos(c*p)*Math.sin(dlon/2)**2;
 return 2*R*Math.asin(Math.sqrt(x));
}
function antipode(lat,lon){ let aLon = lon<0 ? lon+180 : lon-180; return {lat:-lat, lon:aLon}; }
function n(v, fallback=null){ const x=Number(v); return Number.isFinite(x)?x:fallback; }
function parseTime(v){ if(v==null) return null; if(typeof v==='number') return v; const t=Date.parse(v); return Number.isFinite(t)?t:null; }
function ecuTime(ms){ return new Intl.DateTimeFormat('es-EC',{timeZone:'America/Guayaquil',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(ms)); }
function fmtFull(ms){ return new Intl.DateTimeFormat('es-EC',{timeZone:'America/Guayaquil',dateStyle:'medium',timeStyle:'short'}).format(new Date(ms)); }
async function loadPlates(){
  if(platesLoaded) return;
  const urls=[
    'https://cdn.jsdelivr.net/gh/fraxen/tectonicplates/GeoJSON/PB2002_boundaries.json',
    'https://raw.githubusercontent.com/fraxen/tectonicplates/master/GeoJSON/PB2002_boundaries.json'
  ];
  for(const url of urls){
    try{
      const r=await fetch(url,{cache:'force-cache'});
      if(!r.ok) throw new Error('HTTP '+r.status);
      const j=await r.json();
      L.geoJSON(j,{style:{color:'#52a8ff',weight:1.6,opacity:0.9}}).bindPopup('Límite de placa tectónica · PB2002').addTo(plateLayer);
      const labels=[[-8,-90,'Nazca'],[-12,-63,'Sudamericana'],[8,-104,'Cocos'],[15,-75,'Caribe'],[2,-125,'Pacífica'],[-50,-80,'Antártica']];
      labels.forEach(([la,lo,nm])=>L.marker([la,lo],{interactive:false,icon:L.divIcon({className:'',html:`<div style="color:#9bd4ff;font-weight:800;font-size:11px;text-shadow:0 1px 2px #000;background:#07111eaa;padding:2px 5px;border-radius:5px;white-space:nowrap">Placa ${nm}</div>`})}).addTo(plateLayer));
      platesLoaded=true;
      sourceStatus['Placas tectónicas']={ok:true,count:(j.features||[]).length};
      updateSources();
      return;
    }catch(err){ sourceStatus['Placas tectónicas']={ok:false,error:String(err).slice(0,80)}; }
  }
  updateSources();
}
function magColor(m){ return m>=7?'#7a0019':m>=6?'#a90000':m>=5?'#e4493f':m>=4?'#f08a24':m>=3?'#f0c644':'#42b86b'; }
function riskColor(s){ return s>=70?'#e4493f':s>=50?'#f08a24':s>=28?'#f0c644':'#42b86b'; }
function levelFromScore(s){ return s>=70?'Muy alto':s>=50?'Alto':s>=28?'Moderado':'Bajo'; }
function tectonicFamily(e){
  if(e.depth>150) return 'intraslab';
  if(e.depth>=70) return 'intraslab';
  if(e.depth>=30) return 'intermediate';
  if(e.lon<=-79.6) return 'interface';
  return 'cortical';
}
function tectonicClass(e){
  const f=tectonicFamily(e);
  if(e.depth>150) return 'Intraslab profundo (placa subducida)';
  if(f==='intraslab') return 'Intraslab probable (placa de Nazca)';
  if(f==='intermediate') return 'Intermedio: placa subducida / transición probable';
  if(f==='interface') return 'Somero costero: interfaz o cortical; revisar geometría/mecanismo';
  return 'Cortical somero probable';
}
function tectonicColor(e){
  const f=tectonicFamily(e);
  return f==='intraslab'?'#af7cff':f==='intermediate'?'#52a8ff':f==='interface'?'#f08a24':'#f0c644';
}
function normalize(source, f){
 const p=f.properties||{}, g=f.geometry?.coordinates||[];
 if(source==='USGS') return {source,id:f.id||p.code,time:p.time,mag:n(p.mag),depth:n(g[2],0),lat:n(g[1]),lon:n(g[0]),place:p.place||'USGS'};
 if(source==='IG-EPN') return {source,id:p.sis3_evento,time:parseTime(p.sis3_tiempo),mag:n(p.sis3_magnitud_M),depth:n(p.sis3_profundidad,0),lat:n(p.sis3_latitud,g[1]),lon:n(p.sis3_longitud,g[0]),place:'Ecuador'};
 if(source==='IGP') return {source,id:p.code||p.objectid,time:parseTime(p.fechaevento||p.fecha),mag:n(p.magnitud),depth:n(p.prof,0),lat:n(p.lat,g[1]),lon:n(p.lon,g[0]),place:p.ref||'Perú'};
 if(source==='SGC') return {source,id:p.ESP_ID_EVENTO_TXT,time:parseTime(p.ESP_FECHA||p.ESP_FECHA_TXT),mag:n(p.ESP_MAGNITUD),depth:n(p.ESP_PROFUNDIDAD,0),lat:n(p.ESP_LATITUD,g[1]),lon:n(p.ESP_LONGITUD,g[0]),place:'Colombia'};
 }
function dedupe(events){
 const sorted=events.filter(e=>e&&e.time&&e.mag!=null&&e.lat!=null&&e.lon!=null).sort((a,b)=>b.time-a.time||sourcePriority[b.source]-sourcePriority[a.source]);
 const out=[];
 for(const e of sorted){
   const idx=out.findIndex(o=>Math.abs(o.time-e.time)<=5*60*1000 && distKm(o.lat,o.lon,e.lat,e.lon)<=45);
   if(idx<0) out.push(e); else if(sourcePriority[e.source]>sourcePriority[out[idx].source]) out[idx]=e;
 }
 return out.sort((a,b)=>b.time-a.time);
}
async function fetchSource(name,url){
 try{
   const r=await fetch(url,{cache:'no-store'}); if(!r.ok) throw new Error('HTTP '+r.status);
   const j=await r.json(); const feats=j.features||[]; sourceStatus[name]={ok:true,count:feats.length};
   return feats.map(f=>normalize(name,f)).filter(Boolean);
 }catch(err){ sourceStatus[name]={ok:false,error:String(err).slice(0,80)}; return []; }
}
function eventContribution(e,hours){
 const age=Math.max(0,(Date.now()-e.time)/3600000);
 const t=Math.exp(-age/Math.max(18,hours/2));
 const mw=Math.max(0,e.mag-2.0);
 const mag=Math.pow(mw,1.65);
 const depth=e.depth<=30?1.10:e.depth<=70?1.0:e.depth<=150?0.78:0.55;
 return t*mag*depth;
}