(function(){
  try{
    if(typeof L==='undefined' || typeof map==='undefined') return;

    let mode='sismos';
    let irLayer=null;
    let radarLayer=null;
    let radarFrameTime=null;
    let irFrameTime=null;
    const seismicLayers=[eventLayer,eqZoneLayer,extZoneLayer,iaexLayer,plateLayer];

    const css=document.createElement('style');
    css.textContent=`
      .mivige-modebox{background:#07111eee;color:#eaf2fb;border:1px solid #294663;border-radius:12px;padding:7px;box-shadow:0 4px 14px #0007;min-width:220px}
      .mivige-modebox .row{display:flex;gap:5px;flex-wrap:wrap}
      .mivige-modebtn{border:1px solid #365a7d;background:#0d2034;color:#dcecff;border-radius:9px;padding:7px 9px;font:700 11px Arial;cursor:pointer}
      .mivige-modebtn.active{background:#1b5c89;border-color:#79c9ff;color:white}
      .mivige-mode-meta{font:10px Arial;color:#9db2c8;margin-top:6px;line-height:1.3}
      .mivige-weather-range{width:100%;accent-color:#64c8ff}
      @media(max-width:700px){.mivige-modebox{min-width:0;max-width:260px}.mivige-modebtn{padding:6px 7px;font-size:10px}}
    `;
    document.head.appendChild(css);

    function safeHas(layer){try{return map.hasLayer(layer);}catch(e){return false;}}
    function addSeismic(){seismicLayers.forEach(l=>{try{if(l&&!safeHas(l))l.addTo(map);}catch(e){}});}
    function removeSeismic(){seismicLayers.forEach(l=>{try{if(l&&safeHas(l))map.removeLayer(l);}catch(e){}});}

    function makeIR(){
      if(irLayer) return irLayer;
      irLayer=L.tileLayer('https://gis.nnvl.noaa.gov/arcgis/rest/services/GOES/GOES_current/ImageServer/tile/{z}/{y}/{x}',{
        maxZoom:12,opacity:0.72,zIndex:240,
        attribution:'NOAA/NESDIS GOES infrared'
      });
      return irLayer;
    }

    async function updateIRTime(){
      try{
        const r=await fetch('https://gis.nnvl.noaa.gov/arcgis/rest/services/GOES/GOES_current/ImageServer?f=pjson',{cache:'no-store'});
        if(!r.ok) return;
        const j=await r.json();
        const te=j?.timeInfo?.timeExtent;
        if(Array.isArray(te)&&te.length>1&&Number.isFinite(Number(te[1]))) irFrameTime=Number(te[1]);
        updateMeta();
      }catch(e){}
    }

    async function loadRadar(){
      try{
        const r=await fetch('https://api.rainviewer.com/public/weather-maps.json',{cache:'no-store'});
        if(!r.ok) throw new Error('HTTP '+r.status);
        const j=await r.json();
        const frames=j?.radar?.past||[];
        const f=frames[frames.length-1];
        if(!f||!j.host) throw new Error('sin frame');
        const t=Number(f.time)*1000;
        if(radarLayer && radarFrameTime===t) return;
        const old=radarLayer;
        radarLayer=L.tileLayer(`${j.host}${f.path}/256/{z}/{x}/{y}/2/1_1.png`,{
          maxZoom:7,opacity:0.66,zIndex:260,
          attribution:'RainViewer weather radar'
        });
        radarFrameTime=t;
        if(old&&safeHas(old)) map.removeLayer(old);
        if(mode!=='sismos') radarLayer.addTo(map);
        updateMeta();
      }catch(e){
        const st=document.getElementById('meteoStatus');if(st)st.textContent='Radar: no disponible temporalmente';
      }
    }

    function formatTime(ms){
      if(!ms) return '—';
      try{return new Intl.DateTimeFormat('es-EC',{timeZone:'America/Guayaquil',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(ms));}catch(e){return new Date(ms).toLocaleString();}
    }

    function updateMeta(){
      const st=document.getElementById('meteoStatus');
      if(st) st.innerHTML=`NOAA IR: <b>${formatTime(irFrameTime)}</b> · lluvia/radar: <b>${formatTime(radarFrameTime)}</b>`;
      const sm=document.getElementById('modeMeta');
      if(sm) sm.textContent=mode==='sismos'?'Solo geodinámica':mode==='meteo'?'Satélite IR + precipitación':'Sismos + satélite IR + precipitación';
    }

    function setMode(next){
      mode=next;
      if(mode==='sismos'){
        if(irLayer&&safeHas(irLayer))map.removeLayer(irLayer);
        if(radarLayer&&safeHas(radarLayer))map.removeLayer(radarLayer);
        addSeismic();
      }else if(mode==='meteo'){
        removeSeismic();
        const ir=makeIR(); if(!safeHas(ir))ir.addTo(map);
        if(radarLayer&&!safeHas(radarLayer))radarLayer.addTo(map);
      }else{
        addSeismic();
        const ir=makeIR(); if(!safeHas(ir))ir.addTo(map);
        if(radarLayer&&!safeHas(radarLayer))radarLayer.addTo(map);
      }
      document.querySelectorAll('.mivige-modebtn').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));
      updateMeta();
    }

    const ctl=L.control({position:'topleft'});
    ctl.onAdd=function(){
      const d=L.DomUtil.create('div','mivige-modebox');
      d.innerHTML=`<div style="font:800 11px Arial;margin-bottom:6px">Vista del mapa</div><div class="row"><button class="mivige-modebtn active" data-mode="sismos">🌎 Sismos</button><button class="mivige-modebtn" data-mode="meteo">☁ Meteo</button><button class="mivige-modebtn" data-mode="mixto">🛰 Mixto</button></div><div id="modeMeta" class="mivige-mode-meta">Solo geodinámica</div>`;
      L.DomEvent.disableClickPropagation(d);L.DomEvent.disableScrollPropagation(d);
      setTimeout(()=>d.querySelectorAll('.mivige-modebtn').forEach(b=>b.onclick=()=>setMode(b.dataset.mode)),0);
      return d;
    };
    ctl.addTo(map);

    function ensureCard(){
      if(document.getElementById('meteoCard'))return;
      const aside=document.querySelector('aside');if(!aside)return;
      const card=document.createElement('section');card.className='card';card.id='meteoCard';
      card.innerHTML=`<h2>☁️ Modo meteorológico</h2>
        <div class="small" id="meteoStatus">Cargando capas…</div>
        <div style="margin-top:9px"><b>Opacidad satélite IR</b><input id="irOpacity" class="mivige-weather-range" type="range" min="0" max="100" value="72"></div>
        <div style="margin-top:7px"><b>Opacidad precipitación</b><input id="radarOpacity" class="mivige-weather-range" type="range" min="0" max="100" value="66"></div>
        <div class="small" style="margin-top:8px">Fuentes: <b>NOAA/NESDIS GOES</b> para infrarrojo y <b>RainViewer</b> para radar/precipitación. La capa meteorológica es contextual y <b>no modifica IDS/IEG ni el semáforo sísmico</b>.</div>`;
      const first=aside.querySelector('.card'); if(first) first.insertAdjacentElement('afterend',card); else aside.prepend(card);
      const io=card.querySelector('#irOpacity');io.oninput=()=>{if(irLayer)irLayer.setOpacity(Number(io.value)/100);};
      const ro=card.querySelector('#radarOpacity');ro.oninput=()=>{if(radarLayer)radarLayer.setOpacity(Number(ro.value)/100);};
    }

    ensureCard();
    updateIRTime();
    loadRadar();
    setInterval(loadRadar,5*60*1000);
    setInterval(updateIRTime,10*60*1000);
    window.mivigeSetMapMode=setMode;
  }catch(err){console.warn('MIVIGE meteo29 no disponible',err);}
})();