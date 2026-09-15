(function(){
  if(typeof L==='undefined' || typeof map==='undefined') return;

  const geoRedLayer=L.layerGroup().addTo(map);
  const earthscopeLayer=L.layerGroup().addTo(map);
  const sourceState={geored:{status:'cargando',count:0},earthscope:{status:'cargando',count:0}};
  const stations=[];

  function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
  function num(v){const x=Number(v);return Number.isFinite(x)?x:null;}
  function ensureCard(){
    if(document.getElementById('gnssStationsCard')) return;
    const aside=document.querySelector('aside'); if(!aside) return;
    const card=document.createElement('section'); card.className='card'; card.id='gnssStationsCard';
    card.innerHTML=`<h2>📡 Estaciones GNSS públicas visibles</h2>
      <div class="kpis">
        <div class="kpi"><div class="name">Total en mapa</div><div class="val" id="gnssMapTotal">—</div></div>
        <div class="kpi"><div class="name">GeoRED Colombia</div><div class="val" id="gnssGeoRedCount">—</div></div>
        <div class="kpi"><div class="name">EarthScope regional</div><div class="val" id="gnssEarthCount">—</div></div>
        <div class="kpi"><div class="name">Cobertura</div><div class="val" style="font-size:12px">Chile → México</div></div>
      </div>
      <div id="gnssMapStatus" class="small" style="margin-top:8px">Cargando metadatos públicos…</div>
      <div class="small" style="margin-top:8px;color:#7894ac"><b>Importante:</b> estos puntos representan estaciones GNSS públicas y sus metadatos de ubicación. Que una estación aparezca en el mapa no significa que su desplazamiento E/N/U esté entrando todavía al IDG. Solo datos de posición/deformación con latencia y calidad verificadas pueden modificar el componente geodésico.</div>`;
    const g=document.getElementById('gnssRegionalCard');
    if(g) g.insertAdjacentElement('afterend',card); else aside.insertBefore(card,aside.firstChild);
  }
  function updateCard(){
    ensureCard();
    document.getElementById('gnssMapTotal').textContent=stations.length;
    document.getElementById('gnssGeoRedCount').textContent=sourceState.geored.status==='ok'?sourceState.geored.count:'—';
    document.getElementById('gnssEarthCount').textContent=sourceState.earthscope.status==='ok'?sourceState.earthscope.count:'—';
    const parts=[];
    parts.push(`SGC-GeoRED: ${sourceState.geored.status==='ok'?sourceState.geored.count+' estaciones':'no disponible ('+sourceState.geored.status+')'}`);
    parts.push(`EarthScope/UNAVCO: ${sourceState.earthscope.status==='ok'?sourceState.earthscope.count+' estaciones regionales':'no disponible ('+sourceState.earthscope.status+')'}`);
    parts.push('REGME Ecuador: red oficial de 48 estaciones; se mostrará directamente cuando el servicio de ubicación del IGM sea consumible desde el navegador o aparezca en EarthScope/SIRGAS.');
    document.getElementById('gnssMapStatus').innerHTML=parts.map(esc).join('<br>');
  }
  function addStation(s,layer,color){
    if(!Number.isFinite(s.lat)||!Number.isFinite(s.lon)) return false;
    const duplicate=stations.some(x=>((s.code&&x.code&&String(s.code).toUpperCase()===String(x.code).toUpperCase()) || (Math.abs(x.lat-s.lat)<0.0008&&Math.abs(x.lon-s.lon)<0.0008)));
    if(duplicate) return false;
    stations.push(s);
    const marker=L.circleMarker([s.lat,s.lon],{radius:3.7,weight:1,color:'#07111e',fillColor:color,fillOpacity:0.9});
    marker.bindPopup(`<b>${esc(s.code||'GNSS')}</b><br>${esc(s.name||s.site||'Estación GNSS')}<br>${esc(s.region||'')} ${s.country?'· '+esc(s.country):''}<br><b>Red:</b> ${esc(s.network||s.source)}<br><span style="font-size:11px;color:#7894ac">Ubicación pública de estación. Estado de deformación/latencia no inferido solo por este marcador.</span>`);
    marker.addTo(layer); return true;
  }

  async function loadGeoRed(){
    const url='https://geoportal.sgc.gov.co/arcgis/rest/services/Estaciones_GNSS/Estaciones_GNSS_GEORED_SGC/MapServer/0/query?where=1%3D1&outFields=*&returnGeometry=true&outSR=4326&f=geojson';
    try{
      const r=await fetch(url,{cache:'no-store'}); if(!r.ok) throw new Error('HTTP '+r.status);
      const j=await r.json(); let count=0;
      for(const f of (j.features||[])){
        const p=f.properties||{}, c=f.geometry&&f.geometry.coordinates||[];
        const s={source:'SGC-GeoRED',network:p['ENTIDAD-RED']||p.ENTIDAD_RED||'GeoRED',code:p.ID||p.CODIGO||p.Codigo||'',name:p.SITIO||p.NOMBRE||p.MUNICIPIO||'Estación GeoRED',region:p.DEPARTAMENTO||p.MUNICIPIO||'',country:'Colombia',lat:num(c[1])??num(p.LATITUD_DECIMAL)??num(p.LATITUD),lon:num(c[0])??num(p.LONGITUD_DECIMAL)??num(p.LONGITUD)};
        if(addStation(s,geoRedLayer,'#39d0c3')) count++;
      }
      sourceState.geored={status:'ok',count};
    }catch(e){sourceState.geored={status:String(e.message||e).slice(0,40),count:0};}
    updateCard();
  }

  function collectObjects(node,out,depth){
    if(depth>8||node==null) return;
    if(Array.isArray(node)){for(const x of node) collectObjects(x,out,depth+1); return;}
    if(typeof node!=='object') return;
    const lat=num(node.latitude??node.lat??node.Latitude??node.LATITUDE);
    const lon=num(node.longitude??node.lon??node.lng??node.Longitude??node.LONGITUDE);
    if(lat!==null&&lon!==null) out.push(node);
    for(const v of Object.values(node)) if(v&&typeof v==='object') collectObjects(v,out,depth+1);
  }
  async function loadEarthScope(){
    const url='https://web-services.unavco.org/gps/metadata/sites/v1?minlatitude=-35&maxlatitude=20&minLongitude=-111&maxLongitude=-70&format=json';
    try{
      const r=await fetch(url,{cache:'no-store'}); if(!r.ok) throw new Error('HTTP '+r.status);
      const j=await r.json(); const objs=[]; collectObjects(j,objs,0); let count=0;
      for(const p of objs){
        const lat=num(p.latitude??p.lat??p.Latitude??p.LATITUDE),lon=num(p.longitude??p.lon??p.lng??p.Longitude??p.LONGITUDE); if(lat===null||lon===null)continue;
        const code=p.fourCharacterId||p.stationId||p.siteId||p.code||p.id||p.station||p.name||'';
        const s={source:'EarthScope/UNAVCO',network:p.network||p.networkName||p.activity||p.project||'GNSS público',code:String(code).slice(0,16),name:p.siteName||p.stationName||p.name||String(code)||'Estación GNSS',region:p.state||p.region||p.country||'',country:p.country||'',lat,lon};
        if(addStation(s,earthscopeLayer,'#b98cff')) count++;
      }
      sourceState.earthscope={status:'ok',count};
    }catch(e){sourceState.earthscope={status:String(e.message||e).slice(0,40),count:0};}
    updateCard();
  }

  ensureCard(); updateCard();
  try{L.control.layers({}, {'GNSS · GeoRED Colombia':geoRedLayer,'GNSS · EarthScope regional':earthscopeLayer},{collapsed:true,position:'topleft'}).addTo(map);}catch(e){}
  Promise.allSettled([loadGeoRed(),loadEarthScope()]).then(()=>{window.mivigeGnssStations=stations;updateCard();});
  setInterval(()=>{geoRedLayer.clearLayers();earthscopeLayer.clearLayers();stations.length=0;loadGeoRed();loadEarthScope();},6*3600000);
})();