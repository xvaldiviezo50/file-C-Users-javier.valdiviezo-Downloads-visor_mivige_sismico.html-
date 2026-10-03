(function(){
  const V='v40';
  const CFG={
    corridorSourceMag:5.0,
    globalAntipodeMag:6.5,
    receiverMinMag:3.0,
    validationMag:3.5,
    maxLagH:72,
    freezeScore:55,
    antipodeCoreKm:225,
    antipodeHaloKm:560
  };

  const SEG=[
    {id:'cl_c',name:'Chile central',lat:-32.0,lon:-71.5,r:360,ord:0,coast:true},
    {id:'cl_n',name:'Chile norte',lat:-23.5,lon:-70.5,r:420,ord:1,coast:true},
    {id:'pe_s',name:'Perú sur',lat:-16.2,lon:-73.5,r:380,ord:2,coast:true},
    {id:'pe_c',name:'Perú central',lat:-11.3,lon:-77.4,r:360,ord:3,coast:true},
    {id:'pe_n',name:'Perú norte',lat:-6.2,lon:-80.4,r:350,ord:4,coast:true},
    {id:'ec_s',name:'Ecuador sur · Golfo/El Oro',lat:-3.1,lon:-80.3,r:220,ord:5,coast:true},
    {id:'ec_c',name:'Ecuador centro · Manabí',lat:-1.0,lon:-80.7,r:230,ord:6,coast:true},
    {id:'ec_n',name:'Ecuador norte · Esmeraldas',lat:0.55,lon:-79.9,r:220,ord:7,coast:true},
    {id:'co_p',name:'Colombia Pacífico · Nariño/Cauca',lat:2.6,lon:-77.7,r:280,ord:8,coast:true},
    {id:'co_ch',name:'Chocó',lat:5.0,lon:-76.8,r:260,ord:9,coast:true},
    {id:'ca',name:'Centroamérica sur',lat:10.0,lon:-85.5,r:520,ord:10,coast:true}
  ];

  const projLayer=(typeof L!=='undefined'&&typeof map!=='undefined')?L.layerGroup().addTo(map):null;
  const antiLayer=(typeof L!=='undefined'&&typeof map!=='undefined')?L.layerGroup().addTo(map):null;
  const STORE='mivigeProjectionLogV40';

  function clamp(x,a=0,b=1){return Math.max(a,Math.min(b,x));}
  function segOf(e,max=650){
    if(!e)return null; let best=null;
    for(const s of SEG){const d=distKm(e.lat,e.lon,s.lat,s.lon);if((!best||d<best.d)&&d<=max)best={s,d};}
    return best;
  }
  function family(e){
    try{return tectonicFamily(e);}catch(_){const d=Number(e.depth||0);return d>=70?'intraslab':d>=30?'intermediate':Number(e.lon)<=-79.6?'interface':'cortical';}
  }
  function mean(a){return a.length?a.reduce((s,x)=>s+x,0)/a.length:0;}
  function std(a){if(a.length<2)return 0;const m=mean(a);return Math.sqrt(mean(a.map(x=>(x-m)*(x-m))));}
  function eventsNear(ev,s,a,b,minMag){
    return ev.filter(e=>e.time>=a&&e.time<b&&Number(e.mag)>=minMag&&distKm(e.lat,e.lon,s.lat,s.lon)<=s.r);
  }
  function dominantFamily(es){
    if(!es.length)return null;const c={};es.forEach(e=>c[family(e)]=(c[family(e)]||0)+1);
    return Object.entries(c).sort((a,b)=>b[1]-a[1])[0][0];
  }
  function priorState(ev,s,t){
    const h=3600e3;
    const p24=eventsNear(ev,s,t-24*h,t,CFG.receiverMinMag);
    const p48=eventsNear(ev,s,t-72*h,t-24*h,CFG.receiverMinMag);
    const base24=p48.length/2;
    const ratio=(p24.length+1)/(base24+1);
    const maxMag=p24.length?Math.max(...p24.map(e=>Number(e.mag))):0;
    const depths=p24.map(e=>Number(e.depth||0));
    const coherent=p24.length>=3&&std(depths)<=22;
    const fam=dominantFamily(p24);
    const score=100*(
      .40*clamp((ratio-0.7)/1.8)+
      .25*clamp(p24.length/5)+
      .20*clamp((maxMag-2.8)/2.2)+
      .15*(coherent?1:0)
    );
    return {p24,p48,ratio,maxMag,coherent,fam,score,label:score>=68?'alta':score>=45?'moderada':'baja'};
  }
  function responseState(ev,s,t0,t1){
    const span=Math.max(1,t1-t0);
    const post=eventsNear(ev,s,t0,t1+1,CFG.validationMag);
    const pre=eventsNear(ev,s,t0-span,t0,CFG.validationMag);
    const ratio=(post.length+1)/(pre.length+1);
    return {post,pre,ratio};
  }
  function power(m){return clamp((Number(m)-4.7)/3.0);}
  function continuity(a,b){
    if(!a||!b)return 0;
    const n=Math.abs(a.ord-b.ord);
    return n===1?1:n===2?.68:n===3?.38:.10;
  }
  function familyCompat(srcFam,recvFam){
    if(!recvFam)return .45;
    if(srcFam===recvFam)return 1;
    if((srcFam==='interface'||srcFam==='intermediate'||srcFam==='intraslab')&&(recvFam==='interface'||recvFam==='intermediate'||recvFam==='intraslab'))return .65;
    return .30;
  }
  function anti(lat,lon){return {lat:-lat,lon:lon<0?lon+180:lon-180};}
  function antiFocusKm(d){if(d<=CFG.antipodeCoreKm)return 1;if(d<=CFG.antipodeHaloKm)return clamp(1-(d-CFG.antipodeCoreKm)/(CFG.antipodeHaloKm-CFG.antipodeCoreKm));return 0;}
  function lagLabel(h){return h<=6?'0–6 h':h<=24?'6–24 h':h<=72?'24–72 h':'cerrada';}
  function fmt(e){
    const near=segOf(e,800);const nm=near?near.s.name:(e.place||e.source||'evento');
    return 'M'+Number(e.mag).toFixed(1)+' · '+nm+' · '+Math.round(Number(e.depth||0))+' km · '+ecuTime(Number(e.time));
  }
  function getSST(id){
    const x=window.mivigeSSTSignals&&window.mivigeSSTSignals[id];
    return x&&x.valid?clamp(x.strength):0;
  }
  function getLog(){try{return JSON.parse(localStorage.getItem(STORE)||'[]')}catch(_){return[]}}
  function saveLog(x){try{localStorage.setItem(STORE,JSON.stringify(x.slice(-120)))}catch(_){}}

  function ensure(){
    if(document.getElementById('projection40'))return;
    const aside=document.querySelector('aside');if(!aside)return;
    const c=document.createElement('section');c.className='card';c.id='projection40';
    c.innerHTML=`<h2>🎯 MIVIGE v40 · proyección depurada</h2>
      <div class="small"><b>Proyección ≠ probabilidad de terremoto.</b> El ranking es una prioridad operacional que se congela antes de observar la respuesta. Núcleo científico: fuente, estado previo del receptor, continuidad tectónica y tipo/profundidad. Modificadores experimentales: focalización antipodal y SST anómala persistente; nunca pueden dominar el resultado.</div>
      <div class="kpis" style="margin-top:8px">
        <div class="kpi"><div class="name">Fuente tectónica</div><div class="val" id="p40src">—</div></div>
        <div class="kpi"><div class="name">Receptor #1</div><div class="val" id="p40top">—</div></div>
        <div class="kpi"><div class="name">Ventana</div><div class="val" id="p40win">—</div></div>
        <div class="kpi"><div class="name">Calibración</div><div class="val" id="p40cal">Sin muestra</div></div>
      </div>
      <div id="p40list" style="margin-top:8px"></div>
      <details style="margin-top:8px"><summary>Pesos y límites</summary><div class="small" style="margin-top:6px">
        <b>Núcleo ex ante:</b> fuente 30%, susceptibilidad sísmica previa 35%, continuidad del margen 25%, compatibilidad de familia tectónica 10%.<br>
        <b>Experimental:</b> antípoda hasta +10 puntos y SST hasta +5; el total experimental se limita a +12. GNSS solo se añadirá cuando exista desplazamiento E/N/U reciente con QC. Directividad y Coulomb no reciben puntos sin mecanismo focal/geometría verificable.<br>
        <b>Validación:</b> respuesta M≥${CFG.validationMag.toFixed(1)} y cambio de tasa se evalúan después; no se usan para inflar retrospectivamente la proyección inicial.
      </div></details>`;
    const a=[...document.querySelectorAll('section.card h2')].find(h=>/CAPA A/.test(h.textContent));
    a?a.parentElement.insertAdjacentElement('afterend',c):aside.insertBefore(c,aside.firstChild);

    const ac=document.createElement('section');ac.className='card';ac.id='anti40';
    ac.innerHTML='<h2>🌐 Antípoda / huella focal</h2><div class="small" id="anti40txt">Buscando fuentes globales M≥6.5…</div>';
    c.insertAdjacentElement('afterend',ac);
  }

  function currentCorridorSource(ev){
    const cut=Date.now()-CFG.maxLagH*3600e3;
    return ev.filter(e=>e.time>=cut&&Number(e.mag)>=CFG.corridorSourceMag&&segOf(e,500))
      .sort((a,b)=>Number(b.time)-Number(a.time))[0]||null;
  }

  function antipodalCases(ev){
    const cut=Date.now()-CFG.maxLagH*3600e3;
    const srcs=ev.filter(e=>e.source==='USGS'&&e.time>=cut&&Number(e.mag)>=CFG.globalAntipodeMag);
    const out=[];
    for(const e of srcs){
      const ap=anti(e.lat,e.lon);
      let best=null;
      for(const s of SEG){
        const d=distKm(ap.lat,ap.lon,s.lat,s.lon);
        if(!best||d<best.d)best={s,d};
      }
      if(best&&best.d<=CFG.antipodeHaloKm)out.push({source:e,ap,s:best.s,d:best.d,focus:antiFocusKm(best.d)});
    }
    return out.sort((a,b)=>(b.focus*power(b.source.mag))-(a.focus*power(a.source.mag)));
  }

  function build(ev){
    const src=currentCorridorSource(ev);
    const antiCases=antipodalCases(ev);
    const antiBySeg={};
    antiCases.forEach(x=>{if(!antiBySeg[x.s.id]||x.focus>antiBySeg[x.s.id].focus)antiBySeg[x.s.id]=x;});

    const map=new Map();
    if(src){
      const s0=segOf(src,500)?.s;
      for(const s of SEG){
        if(s.id===s0.id)continue;
        const n=Math.abs(s.ord-s0.ord);
        if(n>3)continue;
        const prior=priorState(ev,s,src.time);
        const cont=continuity(s0,s);
        const fam=familyCompat(family(src),prior.fam);
        const scientific=30*power(src.mag)+35*(prior.score/100)+25*cont+10*fam;
        const antiCase=antiBySeg[s.id];
        const antiBoost=antiCase?10*antiCase.focus*power(antiCase.source.mag):0;
        const sstBoost=5*getSST(s.id);
        const exp=Math.min(12,antiBoost+sstBoost);
        const score=Math.min(100,scientific+exp);
        map.set(s.id,{s,src,prior,scientific,antiCase,antiBoost,sstBoost,score,mechanism:'corredor tectónico'});
      }
    }

    for(const x of antiCases){
      if(map.has(x.s.id))continue;
      const prior=priorState(ev,x.s,x.source.time);
      const scientific=20*power(x.source.mag)+35*(prior.score/100);
      const antiBoost=10*x.focus*power(x.source.mag);
      const sstBoost=5*getSST(x.s.id);
      const score=Math.min(75,scientific+Math.min(12,antiBoost+sstBoost));
      map.set(x.s.id,{s:x.s,src:x.source,prior,scientific,antiCase:x,antiBoost,sstBoost,score,mechanism:'antípoda experimental'});
    }
    return {src,antiCases,candidates:[...map.values()].sort((a,b)=>b.score-a.score)};
  }

  function validation(ev,c){
    const now=Math.min(Date.now(),c.src.time+CFG.maxLagH*3600e3);
    const r=responseState(ev,c.s,c.src.time,now);
    const famMatch=r.post.some(e=>family(e)===(c.prior.fam||family(c.src)));
    let state='pendiente';
    if(r.post.length&&r.ratio>=1.5)state='respuesta compatible';
    else if(r.post.length)state='respuesta parcial';
    else if(Date.now()>c.src.time+CFG.maxLagH*3600e3)state='sin respuesta material';
    return {...r,state,famMatch};
  }

  function freeze(cands){
    const log=getLog();let changed=false;
    for(const c of cands.filter(x=>x.score>=CFG.freezeScore).slice(0,3)){
      const key=V+'|'+(c.src.id||c.src.time)+'|'+c.s.id;
      if(log.some(x=>x.key===key))continue;
      log.push({key,version:V,sourceId:c.src.id||null,sourceTime:c.src.time,target:c.s.id,targetName:c.s.name,score:Number(c.score.toFixed(1)),created:Date.now(),windowEnd:c.src.time+CFG.maxLagH*3600e3,status:'pendiente'});
      changed=true;
    }
    if(changed)saveLog(log);
  }

  function updateLog(ev){
    const log=getLog();let changed=false;
    for(const x of log){
      if(x.status!=='pendiente')continue;
      const s=SEG.find(q=>q.id===x.target);if(!s)continue;
      const post=eventsNear(ev,s,x.sourceTime,Math.min(Date.now(),x.windowEnd)+1,CFG.validationMag);
      const span=Math.max(1,Math.min(Date.now(),x.windowEnd)-x.sourceTime);
      const pre=eventsNear(ev,s,x.sourceTime-span,x.sourceTime,CFG.validationMag);
      const rr=(post.length+1)/(pre.length+1);
      if(post.length&&rr>=1.5){x.status='compatible';x.closed=Date.now();changed=true;}
      else if(post.length&&Date.now()>x.windowEnd){x.status='parcial';x.closed=Date.now();changed=true;}
      else if(Date.now()>x.windowEnd){x.status='fallo';x.closed=Date.now();changed=true;}
    }
    if(changed)saveLog(log);
    return log;
  }

  function renderCalibration(log){
    const closed=log.filter(x=>x.status!=='pendiente'),ok=closed.filter(x=>x.status==='compatible').length,part=closed.filter(x=>x.status==='parcial').length,fail=closed.filter(x=>x.status==='fallo').length;
    const el=document.getElementById('p40cal');
    if(el)el.textContent=closed.length?('C '+ok+' · P '+part+' · F '+fail):'Sin muestra cerrada';
  }

  function render(ev){
    ensure();if(!Array.isArray(ev))ev=[];
    const data=build(ev),cands=data.candidates;
    freeze(cands);const log=updateLog(ev);renderCalibration(log);
    if(projLayer)projLayer.clearLayers();if(antiLayer)antiLayer.clearLayers();

    const srcEl=document.getElementById('p40src'),topEl=document.getElementById('p40top'),winEl=document.getElementById('p40win'),host=document.getElementById('p40list');
    srcEl.textContent=data.src?fmt(data.src):'Sin fuente M≥5 del corredor en 72 h';
    const top=cands[0];
    topEl.textContent=top?(top.s.name+' · '+top.score.toFixed(0)+'/100'):'Sin receptor proyectable';
    winEl.textContent=top?lagLabel((Date.now()-top.src.time)/3600e3):'—';

    host.innerHTML=cands.length?cands.slice(0,5).map((c,i)=>{
      const v=validation(ev,c);
      const exp=[];
      if(c.antiBoost>0.2)exp.push('antípoda +'+c.antiBoost.toFixed(1));
      if(c.sstBoost>0.2)exp.push('SST +'+c.sstBoost.toFixed(1));
      return '<div class="listitem"><div class="dot" style="background:'+riskColor(c.score)+'"></div><div><div class="zname"><b>#'+(i+1)+'</b> '+c.s.name+'</div><div class="zdesc">'+
        '<b>Prioridad:</b> '+c.score.toFixed(1)+'/100 (núcleo '+c.scientific.toFixed(1)+(exp.length?' · '+exp.join(' · '):'')+')<br>'+
        '<b>Ex ante:</b> susceptibilidad '+c.prior.label+' · razón previa ×'+c.prior.ratio.toFixed(2)+' · '+(c.prior.fam||'familia no definida')+'<br>'+
        '<b>Mecanismo:</b> '+c.mechanism+' · <b>validación:</b> '+v.state+(v.post.length?' · '+v.post.length+' M≥'+CFG.validationMag.toFixed(1):'')+
        '</div></div><div class="pct">'+(c.score>=70?'Alta':c.score>=55?'Prioritaria':'Exploratoria')+'</div></div>';
    }).join(''):'<div class="small">No hay una combinación fuente–receptor suficiente para generar proyección.</div>';

    if(projLayer&&data.src){
      L.circleMarker([data.src.lat,data.src.lon],{radius:9,weight:3,fillOpacity:.9}).bindPopup('<b>Fuente v40</b><br>'+fmt(data.src)).addTo(projLayer);
      cands.slice(0,3).forEach(c=>{
        L.polyline([[data.src.lat,data.src.lon],[c.s.lat,c.s.lon]],{weight:Math.max(1,Math.min(4,c.score/25)),dashArray:'7 5',opacity:.75}).bindTooltip(c.s.name+' · '+c.score.toFixed(0)+'/100').addTo(projLayer);
        L.circle([c.s.lat,c.s.lon],{radius:c.s.r*1000,weight:1,fillOpacity:.025,dashArray:'4 6'}).bindTooltip(c.s.name).addTo(projLayer);
      });
    }

    const ac=data.antiCases[0],antiTxt=document.getElementById('anti40txt');
    if(ac){
      antiTxt.innerHTML='<b>Fuente:</b> '+fmt(ac.source)+'<br><b>Antípoda:</b> '+ac.ap.lat.toFixed(2)+'°, '+ac.ap.lon.toFixed(2)+'° · receptor más cercano: '+ac.s.name+' ('+Math.round(ac.d)+' km)<br><b>Huella:</b> '+(ac.d<=CFG.antipodeCoreKm?'núcleo ≤225 km':'halo 225–560 km')+' · peso experimental '+(10*ac.focus*power(ac.source.mag)).toFixed(1)+'/10. La focalización de ondas es física; una respuesta sísmica inducida en ese receptor no se presupone.';
      if(antiLayer){
        L.circleMarker([ac.ap.lat,ac.ap.lon],{radius:7,weight:2,fillOpacity:.8}).bindPopup('<b>Antípoda exacta</b><br>'+ac.ap.lat.toFixed(2)+', '+ac.ap.lon.toFixed(2)).addTo(antiLayer);
        L.circle([ac.ap.lat,ac.ap.lon],{radius:CFG.antipodeCoreKm*1000,weight:2,fillOpacity:.02}).addTo(antiLayer);
        L.circle([ac.ap.lat,ac.ap.lon],{radius:CFG.antipodeHaloKm*1000,weight:1,dashArray:'6 6',fillOpacity:0}).addTo(antiLayer);
      }
    }else antiTxt.textContent='No hay una fuente global M≥6.5 en 72 h cuya antípoda caiga a ≤560 km de los segmentos monitoreados.';

    window.mivigeProjectionV40={version:V,data,log};
  }

  function updateSources(){
    const d=document.getElementById('sources');if(!d)return;d.innerHTML='';
    for(const [name,s] of Object.entries(sourceStatus)){
      d.insertAdjacentHTML('beforeend','<div class="statusrow"><span>'+name+'</span><span class="'+(s.ok?'ok':'bad')+'">'+(s.ok?'✓ '+s.count+' registros':'✕ no disponible')+'</span></div>');
    }
  }

  function renderBase(all){
    const hours=Number(document.getElementById('window').value),minmag=Number(document.getElementById('minmag').value),cut=Date.now()-hours*3600e3,tf=document.getElementById('tectonicFilter').value;
    const regional=all.filter(e=>e.time>=cut&&e.mag>=minmag&&e.lat>=-35&&e.lat<=20&&e.lon>=-111&&e.lon<=-66).filter(e=>tf==='all'||family(e)===tf);
    eventLayer.clearLayers();
    regional.forEach(e=>{
      L.circleMarker([e.lat,e.lon],{radius:Math.max(4,Math.min(14,3+e.mag*1.6)),color:tectonicColor(e),weight:2.2,fillColor:magColor(e.mag),fillOpacity:.88})
        .bindPopup('<b>'+e.source+'</b><br>M'+e.mag.toFixed(1)+' · '+e.depth.toFixed(0)+' km<br>'+tectonicClass(e)+'<br>'+ecuTime(e.time)).addTo(eventLayer);
    });
    const idsRaw=regional.reduce((s,e)=>s+eventContribution(e,hours),0),ids=Math.min(100,Math.round(100*(1-Math.exp(-idsRaw/12))));
    const idsEl=document.getElementById('ids');if(idsEl)idsEl.textContent=ids+'/100';
    const rows=regional.slice(0,30).map(e=>'<tr><td>'+ecuTime(e.time)+'</td><td><b>'+e.mag.toFixed(1)+'</b></td><td>'+e.depth.toFixed(0)+' km</td><td>'+tectonicClass(e)+'</td><td>'+e.source+'</td></tr>').join('');
    document.getElementById('events').innerHTML=rows||'<tr><td colspan="5">Sin eventos que cumplan el filtro.</td></tr>';
    render(all);
    const sem=document.getElementById('semaforo'),top=window.mivigeProjectionV40?.data?.candidates?.[0];
    if(sem){if(top&&top.score>=70){sem.textContent='AMARILLO · proyección prioritaria';sem.style.background='#6b5715';}else{sem.textContent='VERDE · vigilancia';sem.style.background='#174f2c';}}
    const dec=document.getElementById('agentDecision');if(dec)dec.textContent=top?('Vigilar '+top.s.name+' · '+top.score.toFixed(0)+'/100'):'Sin proyección prioritaria';
  }

  async function refresh(){
    const b=document.getElementById('refresh');if(b){b.disabled=true;b.textContent='Actualizando…';}
    const parts=await Promise.all(Object.entries(endpoints).map(([n,u])=>fetchSource(n,u)));
    allEvents=dedupe(parts.flat());document.getElementById('cut').textContent=fmtFull(Date.now());refreshAt=Date.now()+3600000;
    renderBase(allEvents);updateSources();
    if(b){b.disabled=false;b.textContent='Actualizar ahora';}
  }

  window.render=function(all){renderBase(all)};
  window.refresh=refresh;
  window.mivigeRenderProjectionV40=()=>render(allEvents);
  window.mivigeSegmentsV40=SEG;

  const b=document.getElementById('refresh');if(b)b.onclick=refresh;
  ['window','minmag','tectonicFilter'].forEach(id=>{const e=document.getElementById(id);if(e)e.onchange=()=>renderBase(allEvents);});
  ensure();
  if(projLayer&&antiLayer){try{L.control.layers({}, {'Proyecciones v40':projLayer,'Antípoda / huella v40':antiLayer},{collapsed:false,position:'topright'}).addTo(map);}catch(_){}}
  setInterval(()=>{const left=Math.max(0,refreshAt-Date.now()),m=Math.floor(left/60000),s=Math.floor((left%60000)/1000),el=document.getElementById('next');if(el)el.textContent=m+'m '+String(s).padStart(2,'0')+'s';},1000);
  setInterval(refresh,3600000);
  loadPlates();refresh();
})();