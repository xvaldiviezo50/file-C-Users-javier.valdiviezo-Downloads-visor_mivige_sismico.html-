(function(){
  const CFG={
    id:'MIVIGE-RED-v39',
    sourceMag:5.0,
    responseMag:3.0,
    maxLagH:72,
    validation:'prospectiva',
    note:'No es probabilidad de terremoto ni demuestra causalidad.'
  };
  const BOX={
    chile:[-56,-17,-76,-66],
    peru:[-19.5,0,-82,-68],
    ecuador:[-5.2,2.2,-81.6,-75.0],
    colombia:[-4.5,13.5,-79.5,-66.5],
    centroamerica:[7,19,-93,-77]
  };
  const ORDER=['chile','peru','ecuador','colombia','centroamerica'];
  const LABEL={chile:'Chile',peru:'Perú',ecuador:'Ecuador',colombia:'Colombia',centroamerica:'Centroamérica'};
  const layer=(typeof L!=='undefined'&&typeof map!=='undefined')?L.layerGroup().addTo(map):null;

  // v39: IAEX/antípodas queda fuera del modelo principal. Se conserva solo en versiones históricas.
  try{
    computeIAEX=function(){return {status:'Retirado del modelo principal v39',window:'—',cases:[]};};
  }catch(_){}

  function inBox(e,b){
    const lat=Number(e&&e.lat), lon=Number(e&&(e.lon??e.lng));
    return Number.isFinite(lat)&&Number.isFinite(lon)&&lat>=b[0]&&lat<=b[1]&&lon>=b[2]&&lon<=b[3];
  }
  function regionOf(e){ return ORDER.find(k=>inBox(e,BOX[k]))||null; }
  function depthClass(d){
    d=Number(d||0);
    if(d<35) return 'somero/cortical';
    if(d<70) return 'intermedio';
    return 'profundo/intraslab';
  }
  function hoursSelected(){
    const n=Number(document.getElementById('window')?.value||72);
    return Number.isFinite(n)?n:72;
  }
  function fmtTime(ms){
    try{return new Intl.DateTimeFormat('es-EC',{timeZone:'America/Guayaquil',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(ms));}
    catch(_){return new Date(ms).toISOString();}
  }
  function fmtEvent(e){
    if(!e) return '—';
    const r=regionOf(e);
    return 'M'+Number(e.mag).toFixed(1)+' · '+(r?LABEL[r]:'fuera del corredor')+' · '+Math.round(Number(e.depth||0))+' km · '+fmtTime(Number(e.time));
  }
  function adjacentRegions(r){
    const i=ORDER.indexOf(r); if(i<0) return [];
    return [ORDER[i-1],ORDER[i+1]].filter(Boolean);
  }
  function eventsIn(ev,r,a,b,minMag){
    return ev.filter(e=>regionOf(e)===r && Number(e.time)>=a && Number(e.time)<b && Number(e.mag)>=minMag);
  }
  function susceptibility(ev,r,srcT){
    const pre24=eventsIn(ev,r,srcT-24*3600e3,srcT,CFG.responseMag);
    const old48=eventsIn(ev,r,srcT-72*3600e3,srcT-24*3600e3,CFG.responseMag);
    const oldRate24=old48.length/2;
    const ratio=(pre24.length+1)/(oldRate24+1);
    const maxMag=pre24.length?Math.max(...pre24.map(x=>Number(x.mag)||0)):0;
    const score=100*(0.55*Math.min(1,ratio/2)+0.25*Math.min(1,pre24.length/4)+0.20*Math.min(1,maxMag/5));
    const label=score>=65?'elevada':score>=42?'moderada':'baja';
    return {r,pre24:pre24.length,old48:old48.length,ratio,maxMag,score,label};
  }
  function response(ev,r,srcT,now){
    const elapsed=Math.max(1,Math.min(CFG.maxLagH,(now-srcT)/3600e3));
    const span=elapsed*3600e3;
    const post=eventsIn(ev,r,srcT,srcT+span+1,CFG.responseMag);
    const pre=eventsIn(ev,r,srcT-span,srcT,CFG.responseMag);
    const ratio=(post.length+1)/(pre.length+1);
    return {r,elapsed,post,pre,ratio};
  }
  function sourceClass(m){
    if(m>=7) return 'fuente grande';
    if(m>=6.5) return 'fuente fuerte';
    return 'fuente de tamiz';
  }
  function ensureCard(){
    if(document.getElementById('reducedModel39')) return;
    const aside=document.querySelector('aside'); if(!aside) return;
    const card=document.createElement('section');
    card.className='card'; card.id='reducedModel39';
    card.innerHTML=`<h2>🧭 MIVIGE reducido v39 · interacción y desplazamiento observado</h2>
      <div class="small"><b>Núcleo:</b> fuente sísmica + conectividad tectónica + estado previo del receptor + ventana temporal + cambio de tasa + compatibilidad de profundidad. <b>Fuera del modelo principal:</b> meteorología, antípodas/IAEX y el antiguo IEM. GNSS/InSAR permanece como evidencia científica cuando exista dato real, nunca como cero por ausencia de datos.</div>
      <div class="kpis" style="margin-top:8px">
        <div class="kpi"><div class="name">Fuente actual</div><div class="val" id="r39src">—</div></div>
        <div class="kpi"><div class="name">Receptor candidato ex ante</div><div class="val" id="r39recv">—</div></div>
        <div class="kpi"><div class="name">Respuesta observada</div><div class="val" id="r39resp">—</div></div>
        <div class="kpi"><div class="name">Nivel de evidencia</div><div class="val" id="r39evid">—</div></div>
      </div>
      <div class="small" id="r39path" style="margin-top:8px">—</div>
      <div class="small" id="r39why" style="margin-top:8px">—</div>
      <details style="margin-top:8px"><summary>Variables que sí participan</summary>
        <div class="small" style="margin-top:6px">
        <b>Científicas:</b> magnitud, profundidad/tipo tectónico, tasa sísmica, clustering/secuencias, ETAS/Omori, conectividad tectónica, GNSS/InSAR cuando exista y mecanismos/Coulomb cuando puedan calcularse.<br>
        <b>Experimental útil:</b> receptor candidato por susceptibilidad previa y desplazamiento espacio-temporal observado entre segmentos adyacentes. Se valida con aciertos, parciales, falsos positivos y fallos; no con coincidencias retrospectivas seleccionadas.
        </div>
      </details>
      <div class="small" style="margin-top:8px;color:#7894ac"><b>Interpretación:</b> una línea en el mapa representa una secuencia observada después de una fuente, no “energía que viaja”. Para hablar de interacción física se requiere evidencia independiente adicional.</div>`;
    const a=[...document.querySelectorAll('section.card h2')].find(h=>/CAPA A/.test(h.textContent));
    a?a.parentElement.insertAdjacentElement('afterend',card):aside.insertBefore(card,aside.firstChild);
  }

  function hideDeprecated(){
    [...document.querySelectorAll('section.card')].forEach(c=>{
      const t=c.querySelector('h2')?.textContent||'';
      if(/CAPA B|Meteorolog|SST|Pronósticos externos/i.test(t)) c.style.display='none';
    });
    try{ if(typeof iaexLayer!=='undefined') iaexLayer.clearLayers(); }catch(_){}
    document.querySelectorAll('.leaflet-control-layers-overlays label').forEach(l=>{
      if(/IAEX|antípod/i.test(l.textContent||'')) l.style.display='none';
    });
  }

  function render(){
    ensureCard(); hideDeprecated();
    let ev=[]; try{ev=Array.isArray(allEvents)?allEvents:[]}catch(_){}
    const now=Date.now(), h=hoursSelected(), t0=now-h*3600e3;
    const corridor=ev.filter(e=>Number(e.time)>=t0 && regionOf(e));
    const src=corridor.filter(e=>Number(e.mag)>=CFG.sourceMag).sort((a,b)=>Number(b.time)-Number(a.time))[0]||null;
    const srcEl=document.getElementById('r39src'), recvEl=document.getElementById('r39recv'), respEl=document.getElementById('r39resp'), evidEl=document.getElementById('r39evid'), pathEl=document.getElementById('r39path'), whyEl=document.getElementById('r39why');
    if(!srcEl) return;
    if(layer) layer.clearLayers();

    if(!src){
      srcEl.textContent='Sin M≥'+CFG.sourceMag.toFixed(1)+' en '+h+' h';
      recvEl.textContent='No calculado';
      respEl.textContent='Sin ventana activa';
      evidEl.textContent='Sin señal';
      pathEl.innerHTML='<b>Desplazamiento:</b> no hay fuente candidata activa.';
      whyEl.innerHTML='<b>Modelo:</b> no genera una proyección sin una fuente que supere el tamiz.';
      return;
    }

    const sr=regionOf(src), st=Number(src.time), candidates=adjacentRegions(sr);
    const susc=candidates.map(r=>susceptibility(ev,r,st)).sort((a,b)=>b.score-a.score);
    const lead=susc[0]||null;
    const responses=candidates.map(r=>response(ev,r,st,now));
    const allPost=responses.flatMap(x=>x.post).sort((a,b)=>Number(a.time)-Number(b.time));
    const leadResp=lead?responses.find(x=>x.r===lead.r):null;

    srcEl.textContent=fmtEvent(src);
    recvEl.textContent=lead ? LABEL[lead.r]+' · susceptibilidad '+lead.label : 'Sin segmento adyacente';
    if(leadResp){
      respEl.textContent=leadResp.post.length+' evento(s) ≥M'+CFG.responseMag.toFixed(1)+' · tasa '+(leadResp.ratio>=1.5?'↑':leadResp.ratio<=0.75?'↓':'→');
    }else respEl.textContent='No evaluable';

    let evidence='Coincidencia temporal';
    const adjacentPost=allPost.length>0;
    const rateRise=responses.some(x=>x.ratio>=1.5 && x.post.length>=2);
    const depthMatch=allPost.some(e=>depthClass(e.depth)===depthClass(src.depth));
    if(adjacentPost && (rateRise||depthMatch)) evidence='Compatibilidad regional';
    if(Number(src.mag)>=6.5 && adjacentPost && rateRise && depthMatch) evidence='Compatibilidad física a contrastar';
    evidEl.textContent=evidence;

    const seq=[src,...allPost.slice(0,6)];
    pathEl.innerHTML='<b>Secuencia observada:</b><br>'+seq.map((e,i)=>(i?'→ ':'')+fmtEvent(e)).join('<br>');
    const prior=lead?`Antes de la fuente, ${LABEL[lead.r]} tenía ${lead.pre24} evento(s) ≥M${CFG.responseMag.toFixed(1)} en 24 h; su tasa relativa frente a las 48 h previas fue ×${lead.ratio.toFixed(2)}.`:'';
    const aft=leadResp?` Después de la fuente registra ${leadResp.post.length} frente a ${leadResp.pre.length} en una ventana comparable (razón suavizada ×${leadResp.ratio.toFixed(2)}).`:'';
    whyEl.innerHTML='<b>Por qué ese receptor:</b> '+prior+aft+' <b>'+CFG.note+'</b>';

    if(layer){
      L.circleMarker([src.lat,src.lon],{radius:9,weight:3,fillOpacity:.9}).bindPopup('<b>Fuente v39</b><br>'+fmtEvent(src)).addTo(layer);
      let prev=src;
      for(const e of allPost.slice(0,6)){
        L.polyline([[prev.lat,prev.lon],[e.lat,e.lon]],{weight:2,dashArray:'6 5',opacity:.8}).bindTooltip('Secuencia observada · '+Math.round((e.time-st)/3600e3)+' h desde la fuente').addTo(layer);
        L.circleMarker([e.lat,e.lon],{radius:6,weight:2,fillOpacity:.75}).bindPopup('<b>Respuesta observada</b><br>'+fmtEvent(e)).addTo(layer);
        prev=e;
      }
    }
  }

  ensureCard();
  if(layer){ try{L.control.layers({}, {'MIVIGE v39 · interacción reducida':layer},{collapsed:true,position:'topleft'}).addTo(map);}catch(_){} }
  setTimeout(render,2200);
  setInterval(render,60000);
  document.addEventListener('change',e=>{if(['window','minmag','tectonicFilter'].includes(e.target?.id)) setTimeout(render,100);});
  const b=document.getElementById('refresh'); if(b)b.addEventListener('click',()=>setTimeout(render,2200));
})();