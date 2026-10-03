(function(){
  const CFG={
    id:'MIVIGE-RED-v40',
    sourceMag:5.0,
    responseMag:3.0,
    maxLagH:72,
    atlanticLagH:12,
    note:'No es probabilidad de terremoto ni demuestra causalidad.'
  };

  const PBOX={
    chile:[-56,-17,-76,-66],
    peru:[-19.5,-3,-82,-68],
    ecuador:[-5.2,2.2,-81.6,-75.0],
    colombia:[1.5,13.5,-79.5,-66.5],
    centroamerica:[7,19,-93,-77]
  };
  const PORDER=['chile','peru','ecuador','colombia','centroamerica'];
  const LABEL={
    chile:'Chile',peru:'Perú',ecuador:'Ecuador',colombia:'Colombia',centroamerica:'Centroamérica',
    atlantico:'Atlántico occidental',venezuela:'Venezuela'
  };
  const ABOX={
    atlantico:[0,25,-60,-35],
    venezuela:[0,13,-73,-59],
    colombia:[1.5,13.5,-79.5,-66.5]
  };

  const layer=(typeof L!=='undefined'&&typeof map!=='undefined')?L.layerGroup().addTo(map):null;

  try{ computeIAEX=function(){return {status:'Retirado del modelo principal v40',window:'—',cases:[]};}; }catch(_){}

  function inBox(e,b){
    const lat=Number(e&&e.lat), lon=Number(e&&(e.lon??e.lng));
    return Number.isFinite(lat)&&Number.isFinite(lon)&&lat>=b[0]&&lat<=b[1]&&lon>=b[2]&&lon<=b[3];
  }
  function pregion(e){return PORDER.find(k=>inBox(e,PBOX[k]))||null;}
  function aregion(e){return ['atlantico','venezuela','colombia'].find(k=>inBox(e,ABOX[k]))||null;}
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
  function fmtEvent(e,rf=pregion){
    if(!e) return '—';
    const r=rf(e);
    return 'M'+Number(e.mag).toFixed(1)+' · '+(r?LABEL[r]:'fuera del corredor')+' · '+Math.round(Number(e.depth||0))+' km · '+fmtTime(Number(e.time));
  }
  function eventsIn(ev,r,a,b,minMag,rf=pregion){
    return ev.filter(e=>rf(e)===r && Number(e.time)>=a && Number(e.time)<b && Number(e.mag)>=minMag);
  }
  function seismicMoment(m){
    m=Number(m);
    return Number.isFinite(m)?Math.pow(10,1.5*m+9.1):0;
  }
  function fmtMoment(x){
    if(!Number.isFinite(x)||x<=0) return '0';
    const p=Math.floor(Math.log10(x)), a=x/Math.pow(10,p);
    return a.toFixed(2)+'×10^'+p+' N·m';
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
  function northwardRegions(r){
    const i=PORDER.indexOf(r);
    return i<0?[]:PORDER.slice(i+1);
  }
  function firstAfter(ev,r,t0,t1){
    return ev.filter(e=>pregion(e)===r&&Number(e.time)>t0&&Number(e.time)<=t1&&Number(e.mag)>=CFG.responseMag)
      .sort((a,b)=>Number(a.time)-Number(b.time))[0]||null;
  }
  function sequentialPath(ev,src){
    const sr=pregion(src), si=PORDER.indexOf(sr), end=Math.min(Date.now(),Number(src.time)+CFG.maxLagH*3600e3);
    if(si<0) return {seq:[],adjacent:0,regions:[]};
    const seq=[], regions=[];
    let lastT=Number(src.time), expected=si+1, adjacent=0;
    for(let i=si+1;i<PORDER.length;i++){
      const e=firstAfter(ev,PORDER[i],lastT,end);
      if(e){
        seq.push(e); regions.push(PORDER[i]);
        if(i===expected){adjacent++; expected=i+1;}
        lastT=Number(e.time);
      }
    }
    return {seq,adjacent,regions};
  }
  function dischargeProxy(ev,src){
    const sr=pregion(src), si=PORDER.indexOf(sr);
    if(si<0||si>=PORDER.length-2) return {events:[],released:0,ratio:0,level:'no aplica'};
    const mids=PORDER.slice(si+1,-2+1); // hasta Ecuador cuando el objetivo natural es Colombia/Centroamérica
    const end=Math.min(Date.now(),Number(src.time)+CFG.maxLagH*3600e3);
    const events=ev.filter(e=>Number(e.time)>Number(src.time)&&Number(e.time)<=end&&Number(e.mag)>=CFG.responseMag&&mids.includes(pregion(e)));
    const released=events.reduce((s,e)=>s+seismicMoment(e.mag),0);
    const srcM=seismicMoment(src.mag);
    const ratio=srcM?released/srcM:0;
    const level=ratio>=0.10?'alto':ratio>=0.01?'moderado':'bajo';
    return {events,released,ratio,level};
  }
  function atlanticSequence(ev,t0){
    const src=ev.filter(e=>Number(e.time)>=t0&&Number(e.mag)>=CFG.sourceMag&&aregion(e)==='atlantico')
      .sort((a,b)=>Number(b.time)-Number(a.time))[0]||null;
    if(!src) return null;
    const end=Number(src.time)+CFG.atlanticLagH*3600e3;
    const post=ev.filter(e=>Number(e.time)>Number(src.time)&&Number(e.time)<=end&&Number(e.mag)>=CFG.responseMag&&['venezuela','colombia'].includes(aregion(e)))
      .sort((a,b)=>Number(a.time)-Number(b.time));
    return {src,post};
  }

  function ensureCards(){
    const aside=document.querySelector('aside'); if(!aside) return;

    if(!document.getElementById('reducedModel40')){
      const card=document.createElement('section'); card.className='card'; card.id='reducedModel40';
      card.innerHTML=`<h2>🧭 MIVIGE v40 · núcleo científico + ajuste secuencial</h2>
        <div class="small"><b>Modelo depurado:</b> fuente sísmica + conectividad tectónica + estado previo del receptor + cambio de tasa + profundidad + progresión espacial. Meteorología, IAEX/antípodas e IEM antiguo quedan fuera del modelo principal.</div>
        <div class="kpis" style="margin-top:8px">
          <div class="kpi"><div class="name">Fuente actual</div><div class="val" id="v40src">—</div></div>
          <div class="kpi"><div class="name">Receptor ex ante</div><div class="val" id="v40recv">—</div></div>
          <div class="kpi"><div class="name">Respuesta observada</div><div class="val" id="v40resp">—</div></div>
          <div class="kpi"><div class="name">Evidencia</div><div class="val" id="v40evid">—</div></div>
        </div>
        <div class="small" id="v40why" style="margin-top:8px">—</div>
        <hr style="border:0;border-top:1px solid rgba(120,148,172,.25);margin:10px 0">
        <div class="small"><b>Concepto experimental del sismólogo, traducido a variables medibles:</b></div>
        <div class="kpis" style="margin-top:8px">
          <div class="kpi"><div class="name">Progresión S→N</div><div class="val" id="v40progress">—</div></div>
          <div class="kpi"><div class="name">Desahogo intermedio</div><div class="val" id="v40discharge">—</div></div>
          <div class="kpi"><div class="name">Continuidad</div><div class="val" id="v40continuity">—</div></div>
          <div class="kpi"><div class="name">Ventana</div><div class="val">0–72 h</div></div>
        </div>
        <div class="small" id="v40path" style="margin-top:8px">—</div>
        <details style="margin-top:8px"><summary>Cómo se interpreta "ajuste", "desahogo" y "energía lenta"</summary>
          <div class="small" style="margin-top:6px">
          <b>Ajuste/tensión:</b> se contrasta con redistribución de esfuerzos y con la susceptibilidad previa del receptor.<br>
          <b>Desahogo:</b> proxy experimental = momento sísmico liberado en segmentos intermedios. No demuestra que disminuya el esfuerzo hacia el siguiente país.<br>
          <b>Energía viene lenta:</b> no se interpreta como una onda que tarda horas o días; se prueba como respuesta retardada/cascada de fallas ya cargadas.<br>
          <b>Fuerza con que llega:</b> MIVIGE no la trata como fuerza física; la sustituye por continuidad de secuencia + cambio de tasa + evidencia independiente.
          </div>
        </details>
        <div class="small" style="margin-top:8px;color:#7894ac"><b>Para elevar evidencia:</b> mecanismo focal, geometría de falla, ΔCFS, ETAS/fondo y GNSS/InSAR. Una secuencia temporal por sí sola no demuestra causalidad.</div>`;
      const a=[...document.querySelectorAll('section.card h2')].find(h=>/CAPA A/.test(h.textContent));
      a?a.parentElement.insertAdjacentElement('afterend',card):aside.insertBefore(card,aside.firstChild);
    }

    if(!document.getElementById('atlantic40')){
      const card=document.createElement('section'); card.className='card'; card.id='atlantic40';
      card.innerHTML=`<h2>🧪 Atlántico → Venezuela · corredor separado</h2>
        <div class="small">Ventana piloto: <b>${CFG.atlanticLagH} h</b>. Se conserva como hipótesis experimental independiente del corredor Pacífico.</div>
        <div class="kpis" style="margin-top:8px">
          <div class="kpi"><div class="name">Fuente Atlántico</div><div class="val" id="v40atlSrc">—</div></div>
          <div class="kpi"><div class="name">Respuesta VZ/CO</div><div class="val" id="v40atlResp">—</div></div>
        </div>
        <div class="small" id="v40atlPath" style="margin-top:8px">—</div>`;
      const core=document.getElementById('reducedModel40');
      core?core.insertAdjacentElement('afterend',card):aside.insertBefore(card,aside.firstChild);
    }
  }

  function hideDeprecated(){
    [...document.querySelectorAll('section.card')].forEach(c=>{
      const t=c.querySelector('h2')?.textContent||'';
      if(/CAPA B|Meteorolog|SST|Pronósticos externos/i.test(t)) c.style.display='none';
    });
    try{if(typeof iaexLayer!=='undefined')iaexLayer.clearLayers();}catch(_){}
    document.querySelectorAll('.leaflet-control-layers-overlays label').forEach(l=>{
      if(/IAEX|antípod/i.test(l.textContent||'')) l.style.display='none';
    });
  }

  function render(){
    ensureCards(); hideDeprecated();
    let ev=[]; try{ev=Array.isArray(allEvents)?allEvents:[]}catch(_){}
    const now=Date.now(), h=hoursSelected(), t0=now-h*3600e3;
    const corridor=ev.filter(e=>Number(e.time)>=t0&&pregion(e));
    const src=corridor.filter(e=>Number(e.mag)>=CFG.sourceMag).sort((a,b)=>Number(b.time)-Number(a.time))[0]||null;

    const srcEl=document.getElementById('v40src'), recvEl=document.getElementById('v40recv'), respEl=document.getElementById('v40resp'),
          evidEl=document.getElementById('v40evid'), whyEl=document.getElementById('v40why'), progEl=document.getElementById('v40progress'),
          disEl=document.getElementById('v40discharge'), conEl=document.getElementById('v40continuity'), pathEl=document.getElementById('v40path');
    if(!srcEl)return;
    if(layer)layer.clearLayers();

    if(!src){
      srcEl.textContent='Sin M≥'+CFG.sourceMag.toFixed(1)+' en '+h+' h';
      recvEl.textContent='No calculado'; respEl.textContent='Sin ventana activa'; evidEl.textContent='Sin señal';
      progEl.textContent='Sin secuencia'; disEl.textContent='No calculado'; conEl.textContent='No activa';
      whyEl.innerHTML='<b>Modelo:</b> no genera proyección sin una fuente que supere el tamiz.';
      pathEl.innerHTML='<b>Secuencia:</b> no hay fuente candidata activa.';
    }else{
      const sr=pregion(src), st=Number(src.time), north=northwardRegions(sr);
      const susc=north.slice(0,2).map(r=>susceptibility(ev,r,st)).sort((a,b)=>b.score-a.score);
      const lead=susc[0]||null;
      const leadResp=lead?response(ev,lead.r,st,now):null;
      const seq=sequentialPath(ev,src);
      const dp=dischargeProxy(ev,src);

      srcEl.textContent=fmtEvent(src);
      recvEl.textContent=lead?LABEL[lead.r]+' · susceptibilidad '+lead.label:'Sin receptor norte';
      respEl.textContent=leadResp?(leadResp.post.length+' evento(s) ≥M'+CFG.responseMag.toFixed(1)+' · tasa '+(leadResp.ratio>=1.5?'↑':leadResp.ratio<=0.75?'↓':'→')):'No evaluable';

      const depthMatch=leadResp?leadResp.post.some(e=>depthClass(e.depth)===depthClass(src.depth)):false;
      const rateRise=leadResp?leadResp.ratio>=1.5&&leadResp.post.length>=2:false;
      let evidence='Coincidencia temporal';
      if(seq.seq.length&&(rateRise||depthMatch))evidence='Compatibilidad regional';
      if(Number(src.mag)>=6.5&&seq.seq.length&&rateRise&&depthMatch)evidence='Compatibilidad física a contrastar';
      evidEl.textContent=evidence;

      progEl.textContent=seq.regions.length?seq.regions.map(r=>LABEL[r]).join(' → '):'Sin avance norte';
      disEl.textContent=dp.level==='no aplica'?'No aplica':dp.level+' · '+(dp.ratio*100).toFixed(2)+'% M0 fuente';

      let cont='baja';
      if(seq.adjacent>=3)cont='alta';
      else if(seq.adjacent>=1)cont='moderada';
      if(dp.level==='alto'&&cont==='alta')cont='moderada según heurística';
      else if(dp.level==='alto'&&cont==='moderada')cont='baja según heurística';
      conEl.textContent=cont;

      const prior=lead?('Antes de la fuente, '+LABEL[lead.r]+' tenía '+lead.pre24+' evento(s) ≥M'+CFG.responseMag.toFixed(1)+' en 24 h; tasa relativa ×'+lead.ratio.toFixed(2)+'. '):'';
      const aft=leadResp?('Después registra '+leadResp.post.length+' frente a '+leadResp.pre.length+' en ventana comparable; razón suavizada ×'+leadResp.ratio.toFixed(2)+'. '):'';
      whyEl.innerHTML='<b>Receptor:</b> '+prior+aft+'<b>'+CFG.note+'</b>';

      const path=[src,...seq.seq];
      pathEl.innerHTML='<b>Secuencia observada:</b><br>'+path.map((e,i)=>{
        const dt=i?(' · +'+((Number(e.time)-Number(path[i-1].time))/3600000).toFixed(1)+' h'):'';
        return (i?'→ ':'')+fmtEvent(e)+dt;
      }).join('<br>')+
      (dp.level!=='no aplica'?'<br><b>Proxy de desahogo:</b> '+fmtMoment(dp.released)+' liberados en segmentos intermedios; es una heurística experimental, no una medición de "fuerza residual".':'');

      if(layer){
        L.circleMarker([src.lat,src.lon],{radius:9,weight:3,fillOpacity:.9}).bindPopup('<b>Fuente v40</b><br>'+fmtEvent(src)).addTo(layer);
        let prev=src;
        for(const e of seq.seq.slice(0,6)){
          L.polyline([[prev.lat,prev.lon],[e.lat,e.lon]],{weight:2,dashArray:'6 5',opacity:.8}).bindTooltip('Secuencia observada · no trayectoria física de energía').addTo(layer);
          L.circleMarker([e.lat,e.lon],{radius:6,weight:2,fillOpacity:.75}).bindPopup('<b>Respuesta observada</b><br>'+fmtEvent(e)).addTo(layer);
          prev=e;
        }
      }
    }

    const atl=atlanticSequence(ev,t0);
    const aS=document.getElementById('v40atlSrc'), aR=document.getElementById('v40atlResp'), aP=document.getElementById('v40atlPath');
    if(atl){
      aS.textContent=fmtEvent(atl.src,aregion);
      aR.textContent=atl.post.length?atl.post.length+' evento(s) ≥M'+CFG.responseMag.toFixed(1):'Sin respuesta en '+CFG.atlanticLagH+' h';
      aP.innerHTML='<b>Secuencia:</b><br>'+[atl.src,...atl.post.slice(0,5)].map((e,i)=>(i?'→ ':'')+fmtEvent(e,aregion)+(i?' · +'+((Number(e.time)-Number(atl.src.time))/3600000).toFixed(1)+' h':'')).join('<br>')+'<br><b>Nota:</b> compatibilidad temporal ≠ ruta causal demostrada.';
    }else{
      aS.textContent='Sin fuente M≥'+CFG.sourceMag.toFixed(1);
      aR.textContent='No evaluada';
      aP.innerHTML='<b>Ruta:</b> sin fuente candidata en el Atlántico occidental dentro de la ventana seleccionada.';
    }
  }

  ensureCards();
  if(layer){try{L.control.layers({}, {'MIVIGE v40 · secuencia observada':layer},{collapsed:true,position:'topleft'}).addTo(map);}catch(_){}}
  setTimeout(render,2200);
  setInterval(render,60000);
  document.addEventListener('change',e=>{if(['window','minmag','tectonicFilter'].includes(e.target?.id))setTimeout(render,100);});
  const b=document.getElementById('refresh'); if(b)b.addEventListener('click',()=>setTimeout(render,2200));
})();