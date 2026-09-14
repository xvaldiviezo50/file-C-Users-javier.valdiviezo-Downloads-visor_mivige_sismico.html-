(function(){
  try{
    const WATCH_HOURS=72;
    const SNAPSHOT_KEY='mivigeProactiveSnapshotV1';
    const proactiveLayer=(typeof L!=='undefined' && typeof map!=='undefined' && L.layerGroup)?L.layerGroup().addTo(map):null;

    const refs=[
      {name:'Tumbes–El Oro–Puná–Golfo',lat:-3.25,lon:-80.15},
      {name:'Azuay–Cuenca',lat:-2.90,lon:-79.02},
      {name:'Pallatanga–Riobamba',lat:-1.80,lon:-78.75},
      {name:'Quito',lat:-0.20,lon:-78.50},
      {name:'Carchi–Ibarra–Otavalo',lat:0.45,lon:-78.15},
      {name:'Esmeraldas–Manabí',lat:-0.55,lon:-80.35},
      {name:'Loreto–Andoas–Datem del Marañón',lat:-3.00,lon:-76.45},
      {name:'Amazonas–Condorcanqui',lat:-4.25,lon:-77.75},
      {name:'Jaén–Bagua–Cajamarca',lat:-5.75,lon:-78.69},
      {name:'Chocó–Darién/Nariño',lat:3.40,lon:-77.00},
      {name:'Costa Rica',lat:9.8,lon:-84.1},
      {name:'Oaxaca–Guerrero–Chiapas',lat:16.0,lon:-96.5},
      {name:'Chile centro-norte',lat:-28.5,lon:-71.4}
    ];

    function fp(e){
      const bucket=Math.round(e.time/(5*60*1000));
      return [bucket,Math.round(e.lat*5),Math.round(e.lon*5)].join(':');
    }
    function loadSnapshot(){try{return JSON.parse(localStorage.getItem(SNAPSHOT_KEY)||'null');}catch(e){return null;}}
    function saveSnapshot(events){
      try{localStorage.setItem(SNAPSHOT_KEY,JSON.stringify({time:Date.now(),ids:events.slice(0,500).map(fp)}));}catch(e){}
    }
    function nearestRef(lat,lon){
      let best=null;
      refs.forEach(r=>{const d=distKm(lat,lon,r.lat,r.lon);if(!best||d<best.d)best={...r,d};});
      return best;
    }
    function depthStd(events){
      if(events.length<2)return 0;
      const avg=events.reduce((s,e)=>s+e.depth,0)/events.length;
      return Math.sqrt(events.reduce((s,e)=>s+Math.pow(e.depth-avg,2),0)/events.length);
    }
    function clusterEvents(events){
      const cutoff=Date.now()-WATCH_HOURS*3600000;
      const pool=events.filter(e=>e.time>=cutoff&&e.mag>=3.0&&e.lat>=-35&&e.lat<=20&&e.lon>=-111&&e.lon<=-70).sort((a,b)=>b.time-a.time);
      const clusters=[];
      pool.forEach(e=>{
        const fam=tectonicFamily(e);
        const radius=fam==='intraslab'?280:fam==='intermediate'?230:190;
        let best=null;
        clusters.forEach(c=>{
          if(c.family!==fam)return;
          const d=distKm(e.lat,e.lon,c.lat,c.lon);
          if(d<=radius && (!best||d<best.d))best={c,d};
        });
        if(!best){clusters.push({family:fam,events:[e],lat:e.lat,lon:e.lon});}
        else{
          const c=best.c;c.events.push(e);
          const w=c.events.reduce((s,x)=>s+Math.max(1,x.mag-2),0);
          c.lat=c.events.reduce((s,x)=>s+x.lat*Math.max(1,x.mag-2),0)/w;
          c.lon=c.events.reduce((s,x)=>s+x.lon*Math.max(1,x.mag-2),0)/w;
        }
      });
      return clusters.map(c=>{
        c.events.sort((a,b)=>b.time-a.time);
        const latest=c.events[0];
        const maxMag=Math.max(...c.events.map(e=>e.mag));
        const count35=c.events.filter(e=>e.mag>=3.5).length;
        const count45=c.events.filter(e=>e.mag>=4.5).length;
        const r12=c.events.filter(e=>Date.now()-e.time<=12*3600000).length;
        const p12=c.events.filter(e=>Date.now()-e.time>12*3600000&&Date.now()-e.time<=24*3600000).length;
        const accelerating=r12>=2 && r12>p12*1.35;
        const recencyH=(Date.now()-latest.time)/3600000;
        const depStd=depthStd(c.events);
        const meanDepth=c.events.reduce((s,e)=>s+e.depth,0)/c.events.length;
        let score=0;
        score+=maxMag>=6?55:maxMag>=5?42:maxMag>=4.5?32:maxMag>=4?22:10;
        score+=Math.min(24,count35*8);
        score+=Math.min(15,c.events.length*3);
        score+=recencyH<=6?12:recencyH<=24?8:recencyH<=48?4:0;
        if(accelerating)score+=10;
        if(c.events.length>=2&&depStd<=20)score+=6;
        if(count45>=2)score+=8;
        score=Math.min(100,score);
        const ref=nearestRef(c.lat,c.lon);
        const name=(ref&&ref.d<=350)?ref.name:`Foco dinámico ${c.lat.toFixed(1)}°, ${c.lon.toFixed(1)}°`;
        return {...c,latest,maxMag,count35,count45,accelerating,recencyH,depStd,meanDepth,score,name,refDistance:ref?.d||null};
      }).filter(c=>c.maxMag>=4.0||c.count35>=2||c.events.length>=3).sort((a,b)=>b.score-a.score);
    }

    function familyLabel(f){return f==='intraslab'?'Intraslab':f==='intermediate'?'Intermedia / placa subducida':f==='interface'?'Interfaz / somera costera':'Cortical somera';}
    function level(c){return c.score>=75?'Vigilancia reforzada':c.score>=55?'Alta prioridad':c.score>=38?'Observación prioritaria':'Seguimiento';}
    function levelColor(c){return c.score>=75?'#e4493f':c.score>=55?'#f08a24':c.score>=38?'#f0c644':'#52a8ff';}
    function action(c){
      if(c.family==='intraslab')return 'Revisar continuidad 70–150 km, mecanismos focales y migración hipocentral; mantener separado del riesgo cortical.';
      if(c.family==='intermediate')return 'Revisar geometría de la placa subducida, profundidad y continuidad espacial de los hipocentros.';
      if(c.family==='interface')return 'Revisar secuencia de interfaz, magnitud/profundidad, mecanismos y boletines de tsunami si la magnitud aumenta.';
      return 'Contrastar con fallas activas, profundidad, mecanismos focales y clustering cortical.';
    }
    function why(c){
      const bits=[`Mmáx ${c.maxMag.toFixed(1)}`,`${c.events.length} eventos M≥3`,`${c.count35} M≥3.5`,`prof. media ${c.meanDepth.toFixed(0)} km`];
      if(c.accelerating)bits.push('tasa 12 h en aumento');
      if(c.events.length>=2&&c.depStd<=20)bits.push('profundidad coherente');
      return bits.join(' · ');
    }

    function ensurePanel(){
      if(document.getElementById('proactiveCard'))return;
      const aside=document.querySelector('aside');if(!aside)return;
      const card=document.createElement('section');card.className='card';card.id='proactiveCard';
      card.innerHTML=`<h2>🧭 Focos preventivos automáticos</h2>
        <div class="kpis">
          <div class="kpi"><div class="name">Actualización</div><div class="val" id="proactiveStatus" style="font-size:13px">Esperando datos…</div></div>
          <div class="kpi"><div class="name">Eventos nuevos</div><div class="val" id="newEventCount">—</div></div>
          <div class="kpi"><div class="name">Foco principal</div><div class="val" id="mainFocus" style="font-size:13px">—</div></div>
          <div class="kpi"><div class="name">Acción del agente</div><div class="val" id="mainAction" style="font-size:12px">—</div></div>
        </div>
        <div id="focusList" style="margin-top:8px"></div>
        <div class="small" style="margin-top:8px"><b>Motor proactivo:</b> cada actualización manual y cada ciclo horario vuelve a descargar los catálogos, deduplica, reclasifica profundidad/tipo tectónico, detecta focos dinámicos y redefine dónde concentrar observaciones. Es una prioridad de vigilancia, no una predicción determinista de terremotos.</div>`;
      const active=document.getElementById('zonesActive')?.closest('.card');
      if(active)active.insertAdjacentElement('beforebegin',card);else aside.insertBefore(card,aside.firstChild);
    }

    function drawFocus(clusters){
      if(!proactiveLayer)return;
      proactiveLayer.clearLayers();
      clusters.slice(0,6).forEach((c,i)=>{
        const col=levelColor(c);const radius=Math.max(70000,Math.min(240000,70000+c.events.length*18000+c.maxMag*8000));
        L.circle([c.lat,c.lon],{radius,color:col,weight:i===0?3:2,fillColor:col,fillOpacity:i===0?.13:.07,dashArray:'7 5'})
          .bindPopup(`<b>${c.name}</b><br>${level(c)} · score operativo ${c.score}/100<br>${familyLabel(c.family)}<br>${why(c)}<br><br><b>Observación recomendada:</b> ${action(c)}`)
          .addTo(proactiveLayer);
      });
    }

    function updateProactive(events){
      ensurePanel();
      if(!Array.isArray(events))events=[];
      const prev=loadSnapshot();
      const nowIds=new Set(events.map(fp));
      const prevIds=new Set(prev?.ids||[]);
      const baseline=!prev;
      const newEvents=baseline?[]:events.filter(e=>!prevIds.has(fp(e))&&e.time>=Date.now()-6*3600000);
      const clusters=clusterEvents(events);
      drawFocus(clusters);
      const top=clusters[0];
      const status=document.getElementById('proactiveStatus');if(status)status.textContent=`Recalculado · ${fmtFull(Date.now())}`;
      const cnt=document.getElementById('newEventCount');if(cnt)cnt.textContent=baseline?'Base inicial':String(newEvents.length);
      const mf=document.getElementById('mainFocus');if(mf)mf.textContent=top?`${top.name} · ${level(top)}`:'Sin foco prioritario';
      const ma=document.getElementById('mainAction');if(ma)ma.textContent=top?action(top):'Mantener vigilancia de fondo';
      const host=document.getElementById('focusList');
      if(host){
        host.innerHTML=clusters.length?clusters.slice(0,6).map((c,i)=>`<div class="listitem"><div class="dot" style="background:${levelColor(c)}"></div><div><div class="zname">${i+1}. ${c.name}</div><div class="zdesc">${familyLabel(c.family)} · ${why(c)}<br><b>Focalizar:</b> ${action(c)}</div></div><div class="pct">${level(c)}</div></div>`).join(''):'<div class="small">No se detectan focos dinámicos que superen el umbral operativo en la ventana actual.</div>';
      }
      if(newEvents.length){
        const material=newEvents.filter(e=>e.mag>=5);
        const msg=material.length?`${material.length} evento(s) nuevo(s) M≥5 incorporados automáticamente.`:`${newEvents.length} evento(s) nuevo(s) incorporados desde la revisión anterior.`;
        try{if(typeof pushAgentLog==='function')pushAgentLog(`Motor proactivo: ${msg}${top?` Foco principal: <b>${top.name}</b> (${level(top)}).`:''}`,material.length?'orange':'blue');}catch(e){}
      }
      saveSnapshot(events);
      window.mivigeProactiveClusters=clusters;
    }

    ensurePanel();
    if(proactiveLayer && typeof L!=='undefined' && L.control?.layers){
      try{L.control.layers({}, {'Focos preventivos automáticos':proactiveLayer},{collapsed:true,position:'topright'}).addTo(map);}catch(e){}
    }

    const originalRender=window.render;
    if(typeof originalRender==='function'){
      window.render=function(all){
        const out=originalRender.apply(this,arguments);
        try{updateProactive(all);}catch(e){console.warn('MIVIGE proactive update failed',e);}
        return out;
      };
    }

    // If the first asynchronous refresh finished before this module loaded, analyze the current catalogue too.
    setTimeout(()=>{try{if(Array.isArray(window.allEvents)&&window.allEvents.length)updateProactive(window.allEvents);}catch(e){}},1800);
    window.mivigeUpdateProactive=updateProactive;
  }catch(err){console.warn('MIVIGE proactive engine unavailable',err);}
})();