(function(){
  try{
    if(typeof L==='undefined' || typeof map==='undefined' || !L.tileLayer){ return; }

    const INOCAR_MONITOR='https://www.inocar.mil.ec/web/index.php/productos/estaciones-de-monitoreo';
    const INOCAR_MAP='https://www.inocar.mil.ec/mareas/mapa_estaciones_monitoreo.php';
    const INOCAR_TSM='https://www.inocar.mil.ec/web/index.php/productos/temperatura-superficial-del-mar';

    // Campo oceánico continuo de contexto: NASA/JPL GHRSST MUR vía GIBS.
    // Se mantiene como respaldo espacial; para Ecuador se prioriza INOCAR.
    const sstUrl='https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/GHRSST_L4_MUR_Sea_Surface_Temperature/default/default/GoogleMapsCompatible_Level7/{z}/{y}/{x}.png';
    const sstLayer=L.tileLayer(sstUrl,{
      maxNativeZoom:7,maxZoom:18,minZoom:1,opacity:0.58,
      attribution:'SST global: NASA/JPL GHRSST MUR · Ecuador: INOCAR prioritario'
    });

    // Estaciones costeras/insulares de referencia INOCAR.
    // El valor actual se consulta en el monitor oficial, que actualiza sus gráficos cada hora.
    const inocarLayer=L.layerGroup().addTo(map);
    const stations=[
      {name:'Esmeraldas',lat:0.9833,lon:-79.6500,region:'Costa norte'},
      {name:'Manta',lat:-0.9350,lon:-80.7228,region:'Costa central'},
      {name:'La Libertad',lat:-2.2161,lon:-80.7228,region:'Santa Elena'},
      {name:'Puerto Bolívar',lat:-3.2667,lon:-80.0000,region:'Golfo de Guayaquil / El Oro'},
      {name:'Puerto Ayora',lat:-0.74955,lon:-90.31202,region:'Galápagos'}
    ];

    const stationIcon=(name)=>L.divIcon({className:'',html:`<div style="background:#07324a;color:#dff7ff;border:2px solid #42c7e8;border-radius:16px;padding:3px 7px;font:700 10px/1.2 Arial;box-shadow:0 1px 4px #0008;white-space:nowrap">🌡️ ${name}</div>`,iconAnchor:[22,10]});

    stations.forEach(s=>{
      L.marker([s.lat,s.lon],{icon:stationIcon(s.name)})
       .bindPopup(`<b>INOCAR · ${s.name}</b><br>${s.region}<br><b>Temperatura superficial del mar</b><br>Actualización oficial: horaria en el monitor de estaciones.<br><br><a href="${INOCAR_MONITOR}" target="_blank" rel="noopener">Abrir lectura oficial actual</a><br><a href="${INOCAR_TSM}" target="_blank" rel="noopener">Ver producto TSM INOCAR</a>`)
       .addTo(inocarLayer);
    });

    let sstEnabled=false, inocarEnabled=true;
    function setSST(on){
      sstEnabled=!!on;
      if(sstEnabled){ if(!map.hasLayer || !map.hasLayer(sstLayer)) sstLayer.addTo(map); }
      else if(map.removeLayer){ try{ map.removeLayer(sstLayer); }catch(e){} }
      const b=document.getElementById('sstToggle');
      if(b) b.textContent=sstEnabled?'Ocultar campo SST global':'Mostrar campo SST global';
      const st=document.getElementById('sstState');
      if(st) st.textContent=sstEnabled?'Visible · último campo disponible':'Disponible · capa apagada';
    }
    function setINOCAR(on){
      inocarEnabled=!!on;
      if(inocarEnabled){ if(!map.hasLayer || !map.hasLayer(inocarLayer)) inocarLayer.addTo(map); }
      else if(map.removeLayer){ try{ map.removeLayer(inocarLayer); }catch(e){} }
      const b=document.getElementById('inocarToggle');
      if(b) b.textContent=inocarEnabled?'Ocultar estaciones INOCAR':'Mostrar estaciones INOCAR';
      const st=document.getElementById('inocarState');
      if(st) st.textContent=inocarEnabled?'Visible · monitor horario oficial':'Disponible · capa apagada';
    }

    if(L.Control && L.Control.extend){
      const OceanControl=L.Control.extend({
        options:{position:'topright'},
        onAdd:function(){
          const box=L.DomUtil.create('div','leaflet-bar');
          box.style.background='#0d1b2d';box.style.color='#eaf2fb';box.style.padding='7px 9px';box.style.border='1px solid #335777';box.style.borderRadius='6px';box.style.fontSize='11px';box.style.cursor='pointer';
          box.title='INOCAR Ecuador · temperatura superficial del mar';
          box.innerHTML='🇪🇨🌊 INOCAR';
          box.onclick=function(ev){if(ev){ev.preventDefault();ev.stopPropagation();}setINOCAR(!inocarEnabled);};
          return box;
        }
      });
      new OceanControl().addTo(map);
    }

    const aside=document.querySelector('aside');
    if(aside && !document.getElementById('sstCard')){
      const card=document.createElement('section');
      card.className='card';card.id='sstCard';
      card.innerHTML=`<h2>🇪🇨🌊 Temperatura superficial del mar · Ecuador</h2>
        <div class="kpis">
          <div class="kpi"><div class="name">Fuente prioritaria Ecuador</div><div class="val" style="font-size:13px">INOCAR</div></div>
          <div class="kpi"><div class="name">Frecuencia oficial</div><div class="val" id="inocarState" style="font-size:13px">Visible · monitor horario oficial</div></div>
          <div class="kpi"><div class="name">Campo continuo</div><div class="val" style="font-size:13px">NASA/JPL GHRSST MUR</div></div>
          <div class="kpi"><div class="name">Estado SST global</div><div class="val" id="sstState" style="font-size:13px">Disponible · capa apagada</div></div>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px"><button id="inocarToggle">Ocultar estaciones INOCAR</button><button id="sstToggle">Mostrar campo SST global</button></div>
        <div class="small" style="margin-top:8px"><b>Lectura para Ecuador:</b> los marcadores INOCAR representan estaciones costeras/insulares; al tocarlos se abre el acceso a la lectura oficial actual. INOCAR indica que los gráficos de temperatura superficial costera se actualizan cada hora. El campo NASA/JPL se conserva como continuidad espacial del océano y no sustituye a INOCAR.</div>
        <details style="margin-top:8px"><summary style="cursor:pointer;font-weight:700">Ver monitor oficial INOCAR dentro del visor</summary><div style="margin-top:7px"><iframe src="${INOCAR_MAP}" title="INOCAR estaciones de monitoreo" style="width:100%;height:420px;border:1px solid #24415f;border-radius:8px;background:#fff" loading="lazy"></iframe></div></details>`;
      const cards=aside.querySelectorAll('.card');
      if(cards.length>=4) cards[3].insertAdjacentElement('afterend',card);else aside.appendChild(card);
      const b1=document.getElementById('sstToggle');if(b1)b1.onclick=()=>setSST(!sstEnabled);
      const b2=document.getElementById('inocarToggle');if(b2)b2.onclick=()=>setINOCAR(!inocarEnabled);
    }

    try{
      if(typeof sourceStatus!=='undefined'){
        sourceStatus['INOCAR TSM']={ok:true,count:stations.length};
        sourceStatus['NASA/JPL SST']={ok:true,count:1};
        if(typeof updateSources==='function') updateSources();
      }
    }catch(e){}

    window.mivigeSSTLayer=sstLayer;
    window.mivigeINOCARLayer=inocarLayer;
    window.mivigeSetSST=setSST;
    window.mivigeSetINOCAR=setINOCAR;
  }catch(err){console.warn('MIVIGE ocean layer unavailable',err);}
})();