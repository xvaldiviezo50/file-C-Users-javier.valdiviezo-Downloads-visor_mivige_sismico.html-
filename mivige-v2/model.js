(function(){
'use strict';

const CFG={
  version:'MIVIGE v2.2.1 · geodesia regional',
  refreshMs:5*60*1000,
  windowHours:72,
  minDisplayMag:3.0,
  mcFloor:2.8,
  activationHours:24,
  historyDays:7,
  dynSourceMag:6.5
};

const SEG=[
  {id:'cl_c',name:'Chile central',lat:-32.0,lon:-71.5,r:360,ord:0,country:'Chile'},
  {id:'cl_n',name:'Chile norte',lat:-23.5,lon:-70.5,r:390,ord:1,country:'Chile'},
  {id:'pe_s',name:'Perú sur',lat:-16.2,lon:-73.3,r:360,ord:2,country:'Perú'},
  {id:'pe_c',name:'Perú central',lat:-11.5,lon:-77.2,r:340,ord:3,country:'Perú'},
  {id:'pe_n',name:'Perú norte',lat:-6.0,lon:-80.4,r:330,ord:4,country:'Perú'},
  {id:'ec_s',name:'Ecuador sur · Golfo/El Oro',lat:-3.15,lon:-80.2,r:190,ord:5,country:'Ecuador'},
  {id:'ec_az',name:'Ecuador · Azuay/intraslab',lat:-2.9,lon:-79.0,r:150,ord:5.4,country:'Ecuador',depth:[60,180]},
  {id:'ec_c',name:'Ecuador centro · Manabí',lat:-1.0,lon:-80.55,r:220,ord:6,country:'Ecuador'},
  {id:'ec_n',name:'Ecuador norte · Esmeraldas',lat:0.55,lon:-79.9,r:210,ord:7,country:'Ecuador'},
  {id:'co_p',name:'Colombia Pacífico · Nariño/Cauca',lat:2.5,lon:-77.7,r:250,ord:8,country:'Colombia'},
  {id:'co_ch',name:'Colombia · Chocó',lat:4.9,lon:-76.75,r:250,ord:9,country:'Colombia'},
  {id:'pa_p',name:'Panamá · Pacífico/Darién',lat:6.2,lon:-81.2,r:430,ord:9.5,country:'Panamá'},
  {id:'ven',name:'Venezuela costera',lat:10.2,lon:-64.5,r:520,ord:10,country:'Venezuela'}
];

const graphLayer=L.layerGroup().addTo(map);
const activationLayer=L.layerGroup().addTo(map);
const experimentalLayer=L.layerGroup();

let gnssState=null;
let lastModel=null;

function clamp(x,a=0,b=1){return Math.max(a,Math.min(b,x));}
function mean(a){return a.length?a.reduce((s,x)=>s+x,0)/a.length:null;}
function median(a){if(!a.length)return null;const b=a.slice().sort((x,y)=>x-y),n=b.length;return n%2?b[(n-1)/2]:(b[n/2-1]+b[n/2])/2;}
function sumMoment(es){return es.reduce((s,e)=>s+Math.pow(10,1.5*Number(e.mag||0)),0);}
function meq(es){const x=sumMoment(es);return x>0?Math.log10(x)/1.5:null;}
function fmtNum(x,d=1){return Number.isFinite(x)?Number(x).toFixed(d):'NA';}
function family(e){
  try{return tectonicFamily(e);}catch(_){
    const d=e.depth;
    if(d>=70)return'intraslab';
    if(d>=30)return'intermediate';
    if(Number(e.lon)<=-79.6)return'interface';
    return'cortical';
  }
}
function eventsInSegment(events,s,a,b,minMag=0){
  return events.filter(e=>{
    if(!e||e.time<a||e.time>=b||Number(e.mag)<minMag)return false;
    if(distKm(e.lat,e.lon,s.lat,s.lon)>s.r)return false;
    if(s.depth && (!Number.isFinite(e.depth)||e.depth<s.depth[0]||e.depth>s.depth[1]))return false;
    return true;
  });
}
function estimateMc(es){
  const mags=es.map(e=>Math.round(Number(e.mag)*10)/10).filter(Number.isFinite);
  if(mags.length<15)return {mc:Math.max(CFG.mcFloor,3.0),confidence:'baja',n:mags.length,method:'piso conservador'};
  const h={};mags.forEach(m=>h[m]=(h[m]||0)+1);
  const mode=Number(Object.entries(h).sort((a,b)=>b[1]-a[1])[0][0]);
  const mc=Math.max(CFG.mcFloor,Math.min(4.2,Math.round((mode+0.2)*10)/10));
  return {mc,confidence:mags.length>=40?'media':'baja',n:mags.length,method:'máxima curvatura proxy (7 d)'};
}
function bValue(es,mc){
  const x=es.map(e=>Number(e.mag)).filter(m=>m>=mc);
  if(x.length<20)return null;
  const av=mean(x);const den=av-(mc-0.05);
  return den>0?Math.log10(Math.E)/den:null;
}
function centroid(es){
  if(!es.length)return null;
  return {lat:mean(es.map(e=>e.lat)),lon:mean(es.map(e=>e.lon)),depth:mean(es.map(e=>e.depth).filter(Number.isFinite))};
}
function nearestNeighborFraction(es,km=80){
  if(es.length<2)return 0;
  let n=0;
  for(let i=0;i<es.length;i++){
    let best=Infinity;
    for(let j=0;j<es.length;j++){if(i===j)continue;best=Math.min(best,distKm(es[i].lat,es[i].lon,es[j].lat,es[j].lon));}
    if(best<=km)n++;
  }
  return n/es.length;
}
function corr(xs,ys){
  if(xs.length<3||ys.length!==xs.length)return null;
  const mx=mean(xs),my=mean(ys);let num=0,dx=0,dy=0;
  for(let i=0;i<xs.length;i++){const a=xs[i]-mx,b=ys[i]-my;num+=a*b;dx+=a*a;dy+=b*b;}
  return dx&&dy?num/Math.sqrt(dx*dy):null;
}
function sourcePriorityLabel(){
  const ok=Object.entries(sourceStatus).filter(([k,v])=>v&&v.ok&&['IG-EPN','IGP','SGC','USGS'].includes(k)).map(([k])=>k);
  return ok.length?ok.join(' + '):'sin feeds confirmados';
}
function aftershockContext(all,mc){
  const sorted=all.slice().sort((a,b)=>b.mag-a.mag);
  const anchor=sorted.find(e=>Number(e.mag)>=Math.max(4.5,mc+1));
  if(!anchor)return {anchor:null,fraction:0,label:'sin mainshock dominante'};
  const r=anchor.mag>=7?350:anchor.mag>=6?250:anchor.mag>=5?170:100;
  const post=all.filter(e=>e.time>anchor.time&&distKm(e.lat,e.lon,anchor.lat,anchor.lon)<=r);
  const frac=all.length?post.length/all.length:0;
  return {anchor,fraction:frac,label:frac>=.65?'secuencia dominada por réplicas probable':frac>=.35?'componente de réplicas posible':'sin dominio claro de réplicas'};
}
function segmentState(events,s,now){
  const h=3600e3, histStart=now-CFG.historyDays*24*h;
  const hist=eventsInSegment(events,s,histStart,now+1,0);
  const mcInfo=estimateMc(hist);
  const mc=mcInfo.mc;
  const recent=eventsInSegment(events,s,now-24*h,now+1,mc);
  const prev=eventsInSegment(events,s,now-7*24*h,now-24*h,mc);
  const prevRate=prev.length/6;
  const rateRatio=(recent.length+1)/(prevRate+1);
  const cluster=nearestNeighborFraction(recent,80);
  const mr=(sumMoment(recent)+1)/(sumMoment(prev)/6+1);
  const cNow=centroid(recent),cPrev=centroid(prev);
  const horizontalShift=(cNow&&cPrev)?distKm(cNow.lat,cNow.lon,cPrev.lat,cPrev.lon):null;
  const verticalShift=(cNow&&cPrev&&Number.isFinite(cNow.depth)&&Number.isFinite(cPrev.depth))?cNow.depth-cPrev.depth:null;
  const recent72=eventsInSegment(events,s,now-72*h,now+1,mc);
  const depthKnown=recent72.filter(e=>Number.isFinite(e.depth));
  const depthCorr=depthKnown.length>=4?corr(depthKnown.map(e=>e.time),depthKnown.map(e=>e.depth)):null;
  const b=bValue(hist,mc);
  const seq=aftershockContext(hist.filter(e=>e.mag>=mc),mc);

  const rateScore=100*clamp(Math.log2(Math.max(.5,rateRatio))/2.5);
  const clusterScore=100*cluster;
  const momentScore=100*clamp(Math.log10(Math.max(1,mr))/2);
  const migrationScore=100*clamp(((horizontalShift||0)/Math.max(80,s.r))*.7 + Math.min(1,Math.abs(verticalShift||0)/50)*.3);
  let ids=.48*rateScore+.24*clusterScore+.18*momentScore+.10*migrationScore;
  if(seq.fraction>=.65)ids*=.78;
  ids=Math.max(0,Math.min(100,ids));

  let baseline='sin exceso';
  if(rateRatio>=2 && seq.fraction<.65)baseline='exceso sobre fondo de 6 días · no es ETAS';
  else if(seq.fraction>=.65)baseline='actividad compatible con secuencia de réplicas (tamiz)';
  else if(rateRatio>=1.35)baseline='tasa por encima del fondo';
  else if(rateRatio<.75)baseline='tasa por debajo del fondo';

  return {
    s,mcInfo,mc,recent,prev,hist,rateRatio,cluster,mr,horizontalShift,verticalShift,depthCorr,b,seq,ids,baseline,
    meqRecent:meq(recent),mmax:recent.length?Math.max(...recent.map(e=>e.mag)):null,
    active:ids>=60 || (rateRatio>=2&&recent.length>=2)
  };
}
function imst(states,now){
  const start=now-72*3600e3,pts=[];
  states.forEach(st=>{
    const threshold=Math.max(3.5,st.mc);
    const e=eventsInSegment(allEvents,st.s,start,now+1,threshold).sort((a,b)=>a.time-b.time).find(e=>!pts.some(p=>p.e===e));
    if(e && (st.rateRatio>=1.25||st.ids>=45))pts.push({st,e});
  });
  pts.sort((a,b)=>a.e.time-b.e.time);
  if(pts.length<3)return {r:null,label:'datos insuficientes',pts,score:null};
  const r=corr(pts.map(x=>x.e.time),pts.map(x=>x.st.s.ord));
  const score=r==null?null:100*Math.abs(r);
  const label=r>=.65?'migración aparente hacia el norte · marcada':r>=.3?'migración aparente hacia el norte · débil/moderada':r<=-.65?'migración aparente hacia el sur · marcada':r<=-.3?'migración aparente hacia el sur · débil/moderada':'sin dirección regional clara';
  return {r,label,pts,score};
}
function dynamicScreen(events,states,now){
  const cut=now-72*3600e3;
  const sources=events.filter(e=>e.source==='USGS'&&e.time>=cut&&e.mag>=CFG.dynSourceMag).sort((a,b)=>b.mag-a.mag||b.time-a.time);
  const src=sources[0]||null;
  const by={};
  states.forEach(st=>{
    if(!src){by[st.s.id]={state:'sin fuente global M≥'+CFG.dynSourceMag,source:null,distance:null};return;}
    const after=eventsInSegment(events,st.s,src.time,Math.min(now,src.time+72*3600e3)+1,Math.max(st.mc,3.0));
    const before=eventsInSegment(events,st.s,Math.max(src.time-72*3600e3,now-7*86400e3),src.time,Math.max(st.mc,3.0));
    const afterDays=Math.max(1/24,(Math.min(now,src.time+72*3600e3)-src.time)/86400e3);
    const beforeDays=(src.time-Math.max(src.time-72*3600e3,now-7*86400e3))/86400e3;
    const ratio=beforeDays>0?((after.length+.5)/afterDays)/((before.length+.5)/beforeDays):null;
    const compatible=afterDays>=.25&&beforeDays>=1&&after.length>=5&&before.length>=5&&ratio>=1.5;
    by[st.s.id]={state:compatible?'tamiz dinámico compatible · causalidad no demostrada':'sin respuesta anómala demostrada',source:src,distance:distKm(src.lat,src.lon,st.s.lat,st.s.lon),ratio,after:after.length};
  });
  return {source:src,by};
}
function antipodeScreen(events,now){
  const cut=now-72*3600e3;
  const src=events.filter(e=>e.source==='USGS'&&e.time>=cut&&e.mag>=6.5).sort((a,b)=>b.mag-a.mag)[0];
  if(!src)return {source:null,target:null,distance:null,label:'sin fuente M≥6.5'};
  const ap=antipode(src.lat,src.lon);
  let best=null;
  SEG.forEach(s=>{const d=distKm(ap.lat,ap.lon,s.lat,s.lon);if(!best||d<best.d)best={s,d};});
  return {source:src,target:best.s,distance:best.d,ap,label:best.d<=225?'huella antipodal núcleo':best.d<=560?'huella antipodal halo':'fuera de huella operativa'};
}
async function loadGnssState(){
  const urls=['https://raw.githubusercontent.com/xvaldiviezo50/file-C-Users-javier.valdiviezo-Downloads-visor_mivige_sismico.html-/main/mivige-v2/data/gnss.json','data/gnss.json'];
  gnssState=null;
  for(const url of urls){
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);
    try{const r=await fetch(url+'?t='+Date.now(),{cache:'no-store',signal:controller.signal});if(!r.ok)continue;const j=await r.json();if(j.schema===1&&Array.isArray(j.stations)){gnssState=j;break;}}
    catch(_){}finally{clearTimeout(timer);}
  }
  MivigeGeodesy.render(gnssState);
}
function idgState(zone){return MivigeGeodesy.assess(gnssState,zone);}
function idq(states,idg){
  const feeds=['IG-EPN','IGP','SGC','USGS'];
  const ok=feeds.filter(k=>sourceStatus[k]&&sourceStatus[k].ok).length/feeds.length;
  const mc=states.length?mean(states.map(s=>s.mcInfo.confidence==='media'?1:.55)):.3;
  const geo=states.length?states.filter(s=>s.idg.used>=3&&!s.idg.state.includes('atrasado')).length/states.length:0;
  const score=Math.round(100*(.45*ok+.30*mc+.25*geo));
  return {score,feeds:ok,mc,geo,label:score>=75?'buena':score>=55?'moderada':'limitada'};
}
function icmFor(st,idg,dyn,im){
  const ids=st.ids>=60;
  const geo=false; // NGL screening candidates require independent geophysical review before scientific escalation.
  const interaction=false; // Temporal rate coincidence is experimental, not verified Coulomb or dynamic stress.
  const mig=im&&im.r!=null&&Math.abs(im.r)>=.65&&im.pts.some(x=>x.st.s.id===st.s.id);
  let tier=0,label='sin convergencia; peligro sísmico no determinado';
  if(!st.dataReady)return {tier:-1,label:'datos insuficientes / catálogo parcial',ids:false,geo:false,interaction:false,mig:false};
  if(ids&&st.rateSignificant){tier=1;label='vigilancia sísmica reforzada';}
  if(ids&&geo){tier=2;label='sismicidad + deformación';}
  if(ids&&geo&&interaction){tier=3;label='sismicidad + deformación + interacción compatible';}
  if(ids&&geo&&interaction&&mig){tier=4;label='convergencia multimétodo + migración coherente';}
  return {tier,label,ids,geo,interaction,mig};
}
function projectionLevel(t){if(t<0)return {label:'EVALUACIÓN PARCIAL',short:'Parcial',color:'#8993a4'};if(t>=3)return {label:'CONVERGENCIA ALTA',short:'Alta',color:'#e4493f'};if(t>=1)return {label:'ACTIVIDAD ELEVADA',short:'Elevada',color:'#f0c644'};return {label:'SIN EXCESO ROBUSTO DETECTADO',short:'Fondo',color:'#42b86b'};}
function tierColor(t){return projectionLevel(t).color;}
function renderMap(states,im){
  eventLayer.clearLayers();graphLayer.clearLayers();activationLayer.clearLayers();
  const hours=Number(document.getElementById('window').value||72),minMag=Number(document.getElementById('minmag').value||3),tf=document.getElementById('tectonicFilter').value,cut=Date.now()-hours*3600e3;
  allEvents.filter(e=>e.time>=cut&&e.mag>=minMag&&e.lat>=-56&&e.lat<=15&&e.lon>=-112&&e.lon<=-58)
    .filter(e=>tf==='all'||family(e)===tf)
    .slice(0,450).forEach(e=>{
      L.circleMarker([e.lat,e.lon],{radius:Math.max(3,Math.min(12,2+e.mag*1.5)),color:tectonicColor(e),weight:1.8,fillColor:magColor(e.mag),fillOpacity:.82})
        .bindPopup('<b>'+e.source+'</b><br>M'+e.mag.toFixed(1)+' · '+fmtNum(e.depth,0)+' km<br>'+tectonicClass(e)+'<br>'+ecuTime(e.time)).addTo(eventLayer);
    });

  const sorted=states.slice().sort((a,b)=>a.s.ord-b.s.ord);
  for(let i=0;i<sorted.length-1;i++){
    const a=sorted[i],b=sorted[i+1];
    if(Math.abs(a.s.ord-b.s.ord)>1.6)continue;
    L.polyline([[a.s.lat,a.s.lon],[b.s.lat,b.s.lon]],{weight:1.2,color:'#54708a',opacity:.5,dashArray:'5 6'})
      .bindTooltip('Conectividad tectónica conceptual · no implica transferencia causal').addTo(graphLayer);
  }
  states.forEach(st=>{
    const c=tierColor(st.icm.tier);
    L.marker([st.s.lat,st.s.lon],{icon:L.divIcon({className:'zone-symbol',html:'<span style="display:block;width:10px;height:10px;background:'+c+';border:2px solid white;transform:rotate(45deg)"></span>',iconSize:[14,14],iconAnchor:[7,7]})})
      .bindPopup('<b>'+st.s.name+'</b><br><b>'+projectionLevel(st.icm.tier).label+'</b><br>Nivel técnico: ICM-'+st.icm.tier+' · '+st.icm.label+'<br>IDS '+st.ids.toFixed(0)+'/100 · Mc '+st.mc.toFixed(1)+'<br>'+st.baseline).addTo(graphLayer);
  });
  if(im&&im.pts.length>1){
    for(let i=0;i<im.pts.length-1;i++){
      const a=im.pts[i],b=im.pts[i+1];
      L.polyline([[a.e.lat,a.e.lon],[b.e.lat,b.e.lon]],{weight:3,color:'#d66bff',opacity:.75,dashArray:'8 6'})
        .bindTooltip('IMST · orden de primera activación').addTo(activationLayer);
    }
  }
}
function renderSources(){
  const d=document.getElementById('sources');if(!d)return;d.innerHTML='';
  for(const [name,s] of Object.entries(sourceStatus)){
    d.insertAdjacentHTML('beforeend','<div class="statusrow"><span>'+name+'</span><span class="'+(s.ok?'ok':'bad')+'">'+(s.ok?'✓ '+s.count+' registros'+(s.truncated?' · PARCIAL (límite de consulta)':'')+(s.rejected?' · '+s.rejected+' inválidos excluidos':''):'✕ '+String(s.error||'no disponible').replace(/[<>&]/g,''))+'</span></div>');
  }
}
function render(states,im,dyn,anti,idg,idqv){
  states.forEach(st=>{st.icm=icmFor(st,idg,dyn.by[st.s.id],im);});
  const ranked=states.slice().sort((a,b)=>Math.max(0,b.icm.tier)-Math.max(0,a.icm.tier)||((a.icm.tier>=1&&b.icm.tier>=1)?b.ids-a.ids:a.s.ord-b.s.ord));
  const priorityHost=document.getElementById('priorityRankingMirror');
  if(priorityHost){
    priorityHost.innerHTML=ranked.map((st,i)=>{
      const lv=projectionLevel(st.icm.tier);
      const score=Math.round(Math.max(0,Math.min(100,st.ids)));
      const trend=st.rateRatio>1.25?'↑':st.rateRatio<0.8?'↓':'→';
      return '<div class="listitem"><div class="dot" style="background:'+tierColor(st.icm.tier)+'"></div><div><div class="zname"><b>#'+(i+1)+'</b> '+st.s.name+'</div><div class="zdesc"><b>'+lv.label+'</b> · IDS '+score+'/100 · tendencia '+trend+' · tasa 24 h/fondo ×'+st.rateRatio.toFixed(2)+(st.dataReady?'':' · '+st.coverageReason)+'</div></div><div class="pct" style="color:'+tierColor(st.icm.tier)+'">'+score+'</div></div>';
    }).join('');
  }
  const top=ranked.find(st=>st.dataReady&&st.icm.tier>=1)||null;
  const maxTier=top?top.icm.tier:states.some(st=>st.dataReady)?0:-1;
  const sem=document.getElementById('semaforo');
  if(sem){
    const publicLevel=projectionLevel(maxTier);
    sem.textContent=(maxTier<0?'GRIS':maxTier>=3?'ROJO':maxTier>=1?'AMARILLO':'VERDE')+' · '+publicLevel.label;
    sem.style.background=publicLevel.color;
    sem.style.color=maxTier===2?'#07111e':'#fff';
  }
  document.getElementById('mainDecision').textContent=top?(projectionLevel(top.icm.tier).label+' · '+top.s.name):(maxTier<0?'EVALUACIÓN PARCIAL · sin prioridad asignable':'SIN VIGILANCIA REFORZADA en zonas evaluables');
  const coverage=document.getElementById('coverageSummary');if(coverage)coverage.textContent=allEvents.length+' eventos descargados · '+states.filter(s=>s.dataReady).length+'/'+states.length+' zonas con muestra para prueba de tasa. Los eventos y series disponibles se muestran aunque una prueba no sea evaluable. Consulta el motivo por zona.';
  document.getElementById('idgST').textContent=idg.state;
  document.getElementById('idgHR').textContent='canal co/post-sísmico · no precursor';
  document.getElementById('imst').textContent=im.r==null?'NA · '+im.label:('r='+im.r.toFixed(2)+' · '+im.label);
  document.getElementById('idq').textContent=idqv.score+'/100 · '+idqv.label;
  document.getElementById('iiteS').textContent='NA · requiere mecanismos focales + geometría';
  document.getElementById('iiteD').textContent=dyn.source?('tamiz activo · fuente M'+dyn.source.mag.toFixed(1)):'sin fuente M≥'+CFG.dynSourceMag;
  document.getElementById('iac').textContent='NA automatizado · prior espacial pendiente de malla de acoplamiento';

  const host=document.getElementById('zones');
  host.innerHTML=ranked.map((st,i)=>{
    const d=dyn.by[st.s.id];
    return '<div class="listitem"><div class="dot" style="background:'+tierColor(st.icm.tier)+'"></div><div><div class="zname">'+st.s.name+'</div><div class="zdesc">'+
      '<b>Evaluación:</b> '+(st.dataReady?st.icm.label:st.coverageReason)+' · <b>IDS:</b> '+st.ids.toFixed(0)+'/100<br>'+
      '<b>Mc:</b> '+st.mc.toFixed(1)+' ('+st.mcInfo.confidence+') · <b>tasa 24h/fondo:</b> ×'+st.rateRatio.toFixed(2)+' · <b>cluster:</b> '+Math.round(st.cluster*100)+'%<br>'+
      '<b>Meq 24 h:</b> '+(st.meqRecent==null?'NA':st.meqRecent.toFixed(1))+' · <b>b:</b> '+(st.b==null?'NA':st.b.toFixed(2))+' · <b>Δcentroide:</b> '+(st.horizontalShift==null?'NA':Math.round(st.horizontalShift)+' km')+' · <b>Δz:</b> '+(st.verticalShift==null?'NA':st.verticalShift.toFixed(0)+' km')+'<br>'+
      '<b>GNSS de la zona:</b> '+st.idg.state+' · '+st.idg.used+' estaciones utilizables'+(st.idg.latency==null?'':' · antigüedad mediana '+st.idg.latency.toFixed(1)+' días')+'<br>'+
      (st.idg.candidate&&st.rateSignificant?'<b>Coincidencia sísmico-geodésica a revisar; no alerta predictiva.</b><br>':'')+
      '<b>Eventos:</b> '+st.recent.length+' en 24 h / '+st.hist.length+' en 7 días sobre selección del segmento<br>'+
      '<b>Control de tasa:</b> p='+fmtNum(st.rateP,4)+' · '+(st.rateSignificant?'exceso tras control múltiple':'sin exceso robusto / muestra insuficiente')+'<br><b>Baseline:</b> '+st.baseline+' · <b>IITE-D:</b> '+d.state+
      '</div></div><div class="pct" style="color:'+projectionLevel(st.icm.tier).color+'">'+projectionLevel(st.icm.tier).short+'</div></div>';
  }).join('');

  const sci=document.getElementById('evidenceMatrix');
  sci.innerHTML=
    '<div class="statusrow"><span>IDS</span><span>'+(ranked.some(s=>s.dataReady&&s.ids>=60&&s.rateSignificant)?'vigilancia reforzada en ≥1 segmento':'consultar cobertura y tasas por zona')+'</span></div>'+
    '<div class="statusrow"><span>IDG-ST</span><span>'+idg.state+'</span></div>'+
    '<div class="statusrow"><span>IITE-S</span><span>NA · sin Coulomb automatizado</span></div>'+
    '<div class="statusrow"><span>IITE-D</span><span>'+(Object.values(dyn.by).some(x=>x.state.startsWith('tamiz dinámico compatible'))?'compatibilidad a contrastar':'sin compatibilidad demostrada')+'</span></div>'+
    '<div class="statusrow"><span>IAC</span><span>conservado como prior espacial · dataset pendiente</span></div>'+
    '<div class="statusrow"><span>IMST</span><span>'+im.label+'</span></div>'+
    '<div class="statusrow"><span>IDQ</span><span>'+idqv.score+'/100 · '+idqv.label+'</span></div>';

  const exp=document.getElementById('experimental');
  const sst=window.mivigeSSTSignals||{};
  const sstHits=Object.entries(sst).filter(([k,v])=>v&&v.valid).map(([k,v])=>k+' z='+fmtNum(v.z,1));
  exp.innerHTML=
    '<div class="statusrow"><span>Antípoda / huella</span><span>'+anti.label+(anti.target?' · '+anti.target.name+' · '+Math.round(anti.distance)+' km':'')+'</span></div>'+
    '<div class="statusrow"><span>SST anómala</span><span>'+(sstHits.length?sstHits.join(' · '):'sin señal válida / datos aún no cargados')+'</span></div>'+
    '<div class="statusrow"><span>RPE / activación secuencial</span><span>'+im.label+' · se evalúa mediante IMST, no como “energía migratoria”</span></div>'+
    '<div class="statusrow"><span>Magnitud equivalente</span><span>conservada como proxy de liberación sísmica, no como “desahogo” causal</span></div>';

  const models=document.getElementById('models');
  const hasIDS=ranked.some(s=>s.dataReady&&s.ids>=60&&s.rateSignificant), hasGeo=ranked.some(s=>s.idg.used>=3&&!s.idg.state.includes('atrasado')), hasInt=false;
  models.innerHTML=
    '<div class="statusrow"><span>Modelo A · baseline + IDS</span><span>'+(hasIDS?'activo':'fondo')+'</span></div>'+
    '<div class="statusrow"><span>Modelo B · A + IDG-ST</span><span>'+(hasGeo?'tamiz GNSS disponible por zona · integración predictiva no validada':'cobertura geodésica insuficiente')+'</span></div>'+
    '<div class="statusrow"><span>Modelo C · B + IITE + IAC</span><span>'+'pendiente de mecanismos, Coulomb y malla de acoplamiento'+'</span></div>'+
    '<div class="statusrow"><span>Modelo D · C + experimentales</span><span>Challenger · requiere validación prospectiva</span></div>';

  const rows=allEvents.filter(e=>e.time>=Date.now()-72*3600e3&&e.mag>=Number(document.getElementById('minmag').value||3)&&e.lat>=-56&&e.lat<=15&&e.lon>=-112&&e.lon<=-58)
    .slice(0,28).map(e=>'<tr><td>'+ecuTime(e.time)+'</td><td><b>'+e.mag.toFixed(1)+'</b></td><td>'+fmtNum(e.depth,0)+' km</td><td>'+tectonicClass(e)+'</td><td>'+e.source+'</td></tr>').join('');
  document.getElementById('events').innerHTML=rows||'<tr><td colspan="5">Sin eventos para el filtro.</td></tr>';

  renderMap(states,im);
}
async function runModel(){
  const now=Date.now();
  const states=SEG.map(s=>segmentState(allEvents,s,now));
  const significant=MivigeQuality.bh(states.map(st=>st.hist.length>=20?MivigeQuality.rateTest(st.recent.length,st.prev.length,1,6):null));
  states.forEach((st,i)=>{
    const national={'Ecuador':'IG-EPN','Perú':'IGP','Colombia':'SGC'}[st.s.country]||'USGS';
    const feed=sourceStatus[national];
    st.idg=idgState(st.s.id);
    st.dataReady=Boolean(feed?.ok&&!feed.truncated&&now-feed.fetchedAt<15*60000&&st.hist.length>=20);
    st.coverageReason=!feed?.ok?national+': fuente no vigente o consulta fallida':feed.truncated?national+': catálogo parcial':now-feed.fetchedAt>=15*60000?national+': consulta atrasada':st.hist.length<20?'Muestra de '+st.hist.length+'/20 eventos en 7 días para evaluar la tasa':'Catálogo y muestra disponibles';
    st.rateP=st.hist.length>=20?MivigeQuality.rateTest(st.recent.length,st.prev.length,1,6):null;st.rateSignificant=st.dataReady&&significant[i];
  });
  const im=imst(states,now);
  const dyn=dynamicScreen(allEvents,states,now);
  const anti=antipodeScreen(allEvents,now);
  const idg=idgState();
  idg.state=states.filter(s=>s.idg.used>=3&&!s.idg.state.includes('atrasado')).length+'/'+states.length+' zonas con cobertura para tamiz GNSS';
  const q=idq(states,idg);
  lastModel={states,im,dyn,anti,idg,idq:q,time:now};
  render(states,im,dyn,anti,idg,q);
  window.mivigeV2=lastModel;
  window.dispatchEvent(new Event('mivige:model'));
}
let refreshing=false;
async function refresh(){
  if(refreshing)return;refreshing=true;
  try{
  const btn=document.getElementById('refresh');
  if(btn){btn.disabled=true;btn.textContent='Actualizando…';}
  const [parts]=await Promise.all([Promise.all(Object.entries(endpoints).map(([n,u])=>fetchSource(n,u))),loadGnssState()]);
  allEvents=dedupe(parts.flat());
  document.getElementById('cut').textContent=fmtFull(Date.now());
  refreshAt=Date.now()+CFG.refreshMs;
  renderSources();
  await runModel();
  }catch(error){const sem=document.getElementById('semaforo');if(sem){sem.textContent='DATOS INSUFICIENTES · error de actualización';sem.style.background='#8993a4';}console.error(error);}
  finally{refreshing=false;const btn=document.getElementById('refresh');if(btn){btn.disabled=false;btn.textContent='Actualizar datos';}}
}
function tick(){
  const left=Math.max(0,refreshAt-Date.now()),m=Math.floor(left/60000),s=Math.floor((left%60000)/1000);
  const el=document.getElementById('next');if(el)el.textContent=m+'m '+String(s).padStart(2,'0')+'s';
}
function bind(){
  document.getElementById('refresh').onclick=refresh;
  ['window','minmag','tectonicFilter'].forEach(id=>document.getElementById(id).onchange=()=>lastModel&&render(lastModel.states,lastModel.im,lastModel.dyn,lastModel.anti,lastModel.idg,lastModel.idq));
}
window.updateSources=renderSources;
window.refresh=refresh;
try{L.control.layers({},{
  'Eventos sísmicos':eventLayer,
  'Grafo tectónico / ICM':graphLayer,
  'IMST · activación secuencial':activationLayer,
  'Placas tectónicas':plateLayer
},{collapsed:false,position:'topright'}).addTo(map);}catch(_){}
bind();
setInterval(tick,1000);
setInterval(refresh,CFG.refreshMs);
loadPlates();
refresh();
})();
