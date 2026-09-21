(function(){
  try{
    if(typeof L==='undefined' || typeof map==='undefined' || !L.tileLayer){ return; }

    const INOCAR_MONITOR='https://www.inocar.mil.ec/web/index.php/productos/estaciones-de-monitoreo';
    const INOCAR_MAP='https://www.inocar.mil.ec/mareas/mapa_estaciones_monitoreo.php';
    const INOCAR_TSM='https://www.inocar.mil.ec/web/index.php/productos/temperatura-superficial-del-mar';
    const MARINE_API='https://marine-api.open-meteo.com/v1/marine';

    // Campo continuo: NASA/JPL GHRSST MUR. Ecuador mantiene a INOCAR como referencia institucional.
    const sstUrl='https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/GHRSST_L4_MUR_Sea_Surface_Temperature/default/default/GoogleMapsCompatible_Level7/{z}/{y}/{x}.png';
    const sstLayer=L.tileLayer(sstUrl,{maxNativeZoom:7,maxZoom:18,minZoom:1,opacity:0.58,attribution:'SST global: NASA/JPL GHRSST MUR · Ecuador: INOCAR prioritario'});
    const inocarLayer=L.layerGroup().addTo(map);

    const stations=[
      {name:'Esmeraldas',lat:0.999,lon:-79.646,region:'Costa norte'},
      {name:'Manta',lat:-0.936,lon:-80.75,region:'Costa central'},
      {name:'La Libertad',lat:-2.22,lon:-80.91,region:'Santa Elena'},
      {name:'Puerto Bolívar',lat:-3.262,lon:-80.001,region:'Golfo de Guayaquil / El Oro'},
      {name:'Puerto Ayora',lat:-0.7496,lon:-90.312,region:'Galápagos'}
    ];
    const readings={};
    const markers={};

    function tempColor(v){
      if(v==null) return '#42c7e8';
      if(v>=29) return '#e4493f';
      if(v>=27) return '#f08a24';
      if(v>=25) return '#f0c644';
      if(v>=23) return '#42b86b';
      return '#52a8ff';
    }
    function stationIcon(s){
      const r=readings[s.name], v=r?.value;
      const label=v!=null?`${v.toFixed(1)}°C`:'—';
      return L.divIcon({className:'',html:`<div style="background:#07324a;color:#fff;border:2px solid ${tempColor(v)};border-radius:16px;padding:3px 7px;font:700 10px/1.2 Arial;box-shadow:0 1px 4px #0008;white-space:nowrap">🌡️ ${s.name} ${label}</div>`,iconAnchor:[28,10]});
    }
    function popupHTML(s){
      const r=readings[s.name];
      const value=r?.value!=null?`<span style="font-size:19px;font-weight:800">${r.value.toFixed(1)} °C</span>`:'<b>Valor numérico no disponible</b>';
      const when=r?.time?`<br><span style="font-size:11px">Hora del campo: ${r.time} (Ecuador)</span>`:'';
      return `<b>INOCAR · ${s.name}</b><br>${s.region}<br><b>TSM numérica al momento de consulta</b><br>${value}${when}<br><span style="font-size:10px;color:#9db2c8">Valor automático modelado en el punto marino más cercano (Open-Meteo/Copernicus). Contrastar con la estación/gráfico oficial INOCAR.</span><br><br><a href="${INOCAR_MONITOR}" target="_blank" rel="noopener">Abrir monitor oficial INOCAR</a><br><a href="${INOCAR_TSM}" target="_blank" rel="noopener">Producto TSM INOCAR</a>`;
    }

    stations.forEach(s=>{
      const m=L.marker([s.lat,s.lon],{icon:stationIcon(s)}).bindPopup(popupHTML(s)).addTo(inocarLayer);
      markers[s.name]=m;
    });

    function renderNumericTable(){
      const host=document.getElementById('ecuadorSSTValues');
      if(!host) return;
      host.innerHTML=stations.map(s=>{
        const r=readings[s.name], v=r?.value;
        return `<div style="display:grid;grid-template-columns:1fr auto;gap:10px;padding:7px 0;border-bottom:1px solid #1d3851"><div><b>${s.name}</b><div class="small">${s.region}</div></div><div style="font-size:18px;font-weight:800;color:${tempColor(v)}">${v!=null?v.toFixed(1)+' °C':'—'}</div></div>`;
      }).join('');
      const vals=stations.map(s=>readings[s.name]?.value).filter(v=>Number.isFinite(v));
      const summary=document.getElementById('sstSummary');
      if(summary){
        if(vals.length){
          const avg=vals.reduce((a,b)=>a+b,0)/vals.length;
          summary.textContent=`Promedio de referencias: ${avg.toFixed(1)} °C · rango ${Math.min(...vals).toFixed(1)}–${Math.max(...vals).toFixed(1)} °C`;
        } else summary.textContent='Sin valores numéricos disponibles en este momento.';
      }
    }

    async function loadNumericSST(){
      const status=document.getElementById('numericSSTStatus');
      if(status) status.textContent='Consultando…';
      try{
        const lats=stations.map(s=>s.lat).join(','), lons=stations.map(s=>s.lon).join(',');
        const url=`${MARINE_API}?latitude=${encodeURIComponent(lats)}&longitude=${encodeURIComponent(lons)}&current=sea_surface_temperature&timezone=America%2FGuayaquil&cell_selection=sea`;
        const r=await fetch(url,{cache:'no-store'});
        if(!r.ok) throw new Error('HTTP '+r.status);
        const data=await r.json();
        const arr=Array.isArray(data)?data:[data];
        stations.forEach((s,i)=>{
          const d=arr[i]||{}; const v=Number(d.current?.sea_surface_temperature);
          readings[s.name]={value:Number.isFinite(v)?v:null,time:d.current?.time||null,source:'Open-Meteo/Copernicus'};
          const m=markers[s.name];
          if(m){ if(m.setIcon) m.setIcon(stationIcon(s)); if(m.setPopupContent) m.setPopupContent(popupHTML(s)); else if(m.bindPopup) m.bindPopup(popupHTML(s)); }
        });
        renderNumericTable();
        const times=stations.map(s=>readings[s.name]?.time).filter(Boolean);
        if(status) status.textContent=times.length?`Actualizado · ${times[0]} ECU`:'Actualizado';
      }catch(err){
        if(status) status.textContent='No disponible · usar monitor INOCAR';
        renderNumericTable();
        console.warn('SST numeric feed unavailable',err);
      }
    }

    let sstEnabled=false, inocarEnabled=true;
    function setSST(on){
      sstEnabled=!!on;
      if(sstEnabled){ if(!map.hasLayer || !map.hasLayer(sstLayer)) sstLayer.addTo(map); }
      else if(map.removeLayer){ try{map.removeLayer(sstLayer);}catch(e){} }
      const b=document.getElementById('sstToggle'); if(b)b.textContent=sstEnabled?'Ocultar campo SST global':'Mostrar campo SST global';
      const st=document.getElementById('sstState'); if(st)st.textContent=sstEnabled?'Visible · último campo disponible':'Disponible · capa apagada';
    }
    function setINOCAR(on){
      inocarEnabled=!!on;
      if(inocarEnabled){ if(!map.hasLayer || !map.hasLayer(inocarLayer)) inocarLayer.addTo(map); }
      else if(map.removeLayer){ try{map.removeLayer(inocarLayer);}catch(e){} }
      const b=document.getElementById('inocarToggle'); if(b)b.textContent=inocarEnabled?'Ocultar referencias Ecuador':'Mostrar referencias Ecuador';
      const st=document.getElementById('inocarState'); if(st)st.textContent=inocarEnabled?'Visible · INOCAR + valores numéricos':'Disponible · capa apagada';
    }

    if(L.Control && L.Control.extend){
      const OceanControl=L.Control.extend({options:{position:'topright'},onAdd:function(){const box=L.DomUtil.create('div','leaflet-bar');box.style.background='#0d1b2d';box.style.color='#eaf2fb';box.style.padding='7px 9px';box.style.border='1px solid #335777';box.style.borderRadius='6px';box.style.fontSize='11px';box.style.cursor='pointer';box.title='TSM Ecuador · INOCAR + valor numérico';box.innerHTML='🇪🇨🌊 TSM';box.onclick=function(ev){if(ev){ev.preventDefault();ev.stopPropagation();}setINOCAR(!inocarEnabled);};return box;}});
      new OceanControl().addTo(map);
    }

    const aside=document.querySelector('aside');
    if(aside && !document.getElementById('sstCard')){
      const card=document.createElement('section');card.className='card';card.id='sstCard';
      card.innerHTML=`<h2>🇪🇨🌊 Temperatura superficial del mar · Ecuador</h2>
        <div class="kpis"><div class="kpi"><div class="name">Referencia institucional</div><div class="val" style="font-size:13px">INOCAR</div></div><div class="kpi"><div class="name">Valor numérico</div><div class="val" id="numericSSTStatus" style="font-size:13px">Consultando…</div></div><div class="kpi"><div class="name">Campo continuo</div><div class="val" style="font-size:13px">NASA/JPL GHRSST</div></div><div class="kpi"><div class="name">Capa Ecuador</div><div class="val" id="inocarState" style="font-size:13px">Visible</div></div></div>
        <div id="ecuadorSSTValues" style="margin-top:8px"></div><div id="sstSummary" class="small" style="margin-top:7px"></div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px"><button id="refreshSST">Actualizar valores</button><button id="inocarToggle">Ocultar referencias Ecuador</button><button id="sstToggle">Mostrar campo SST global</button></div>
        <div class="small" style="margin-top:8px"><b>Cómo leerlo:</b> INOCAR sigue siendo la referencia oficial ecuatoriana y sus gráficos costeros se actualizan cada hora. Como INOCAR no expone aquí una API numérica pública estable, el número automático se obtiene para la coordenada marina de cada estación con el modelo marino Copernicus servido por Open‑Meteo. Por eso el visor distingue explícitamente <b>referencia oficial</b> de <b>estimación modelada actual</b>.</div>
        <details style="margin-top:8px"><summary style="cursor:pointer;font-weight:700">Ver monitor oficial INOCAR</summary><div style="margin-top:7px"><iframe src="${INOCAR_MAP}" title="INOCAR estaciones de monitoreo" style="width:100%;height:420px;border:1px solid #24415f;border-radius:8px;background:#fff" loading="lazy"></iframe></div></details>`;
      aside.appendChild(card);
      document.getElementById('sstToggle').onclick=()=>setSST(!sstEnabled);
      document.getElementById('inocarToggle').onclick=()=>setINOCAR(!inocarEnabled);
      document.getElementById('refreshSST').onclick=loadNumericSST;
    }

    try{if(typeof sourceStatus!=='undefined'){sourceStatus['INOCAR TSM']={ok:true,count:stations.length};sourceStatus['SST numérica Copernicus']={ok:true,count:stations.length};sourceStatus['NASA/JPL SST']={ok:true,count:1};if(typeof updateSources==='function')updateSources();}}catch(e){}

    window.mivigeSSTLayer=sstLayer;window.mivigeINOCARLayer=inocarLayer;window.mivigeSetSST=setSST;window.mivigeSetINOCAR=setINOCAR;window.mivigeRefreshSST=loadNumericSST;
    loadNumericSST(); setInterval(loadNumericSST,3600000);
  }catch(err){console.warn('MIVIGE ocean layer unavailable',err);}
})();