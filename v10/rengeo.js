(function(){
  if(typeof L==='undefined' || typeof map==='undefined') return;
  const STATE_URL='../v23/state.json';
  const rengeoLayer=L.layerGroup().addTo(map);

  // Estaciones tectónicas RENGEO publicadas por IG-EPN en su tabla oficial.
  // Son metadatos de ubicación/código; no se interpreta deformación sin serie E/N/U reciente y QC.
  const stations=[
    ['ESMR',0.94,-79.72],['GGPA',-0.18,-78.59],['GMTE',-1.94,-78.71],['IBEC',0.35,-78.12],
    ['JAM2',-0.21,-80.26],['MHLA',-1.29,-80.45],['MLEC',-1.07,-80.91],['MOMP',0.49,-80.05],
    ['MRO2',-2.64,-80.34],['MUIS',0.60,-80.02],['NORE',-0.92,-75.40],['PBLR',0.88,-79.08],
    ['PPRT',-0.13,-80.22],['PSTO',-0.69,-78.64],['PIS1',-1.08,-78.44],['PUYO',-1.52,-78.04],
    ['RIOP',-1.65,-78.65],['SLGO',-1.60,-80.85],['SALF',-0.23,-78.15],['SECO',0.00,-79.87],
    ['SIDR',-0.38,-80.19],['TEN1',-0.99,-77.82],['UIOM',-0.18,-78.46],['VIHE',-0.63,-79.55],
    ['YTZA',-4.06,-78.95],['CABP',-0.39,-80.45],['FLFR',-0.36,-79.84],['HSPR',-0.35,-78.85],
    ['ISPT',-1.26,-81.07],['LCSD',-0.91,-80.27],['LGCB',0.38,-79.58],['MADL',0.26,-79.89],
    ['PDNS',0.07,-80.05],['PTGL',0.78,-80.03],['QUEM',-0.24,-78.49],['RVRD',1.07,-79.39],
    ['SEVG',-1.06,-79.96],['SNLR',1.29,-78.84]
  ];

  function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
  function val(v){return v===null||v===undefined?'—':String(v);}
  function ensureCard(){
    if(document.getElementById('rengeoCard')) return;
    const aside=document.querySelector('aside'); if(!aside) return;
    const card=document.createElement('section'); card.className='card'; card.id='rengeoCard';
    card.innerHTML=`<h2>🇪🇨🛰️ RENGEO · IG-EPN</h2>
      <div class="kpis">
        <div class="kpi"><div class="name">Estaciones tectónicas visibles</div><div class="val" id="rengeoVisible">${stations.length}</div></div>
        <div class="kpi"><div class="name">Dato vigente</div><div class="val" id="rengeoFresh">—</div></div>
        <div class="kpi"><div class="name">Usadas tras QC</div><div class="val" id="rengeoUsed">—</div></div>
        <div class="kpi"><div class="name">No automatizables</div><div class="val" id="rengeoNonAuto">—</div></div>
      </div>
      <div class="small" style="margin-top:8px"><b>Latencia mediana:</b> <span id="rengeoLatency">—</span><br><b>Estaciones del foco:</b> <span id="rengeoFocus">—</span><br><b>Estado:</b> <span id="rengeoStatus">esperando mediciones públicas automatizables</span></div>
      <div id="rengeoAnom" class="small" style="margin-top:8px"><b>Anomalías coherentes:</b> ninguna confirmada / datos insuficientes.</div>
      <div class="small" style="margin-top:8px;color:#7894ac"><b>Regla MIVIGE:</b> RENGEO es obligatoria para Ecuador. Las ubicaciones se muestran siempre; solo series E/N/U actuales, con latencia y control de calidad verificados, pueden modificar IDG. Ausencia de dato automatizable ≠ ausencia de deformación.</div>`;
    const gs=document.getElementById('gnssStationsCard');
    if(gs) gs.insertAdjacentElement('afterend',card); else {const g=document.getElementById('gnssRegionalCard'); if(g)g.insertAdjacentElement('afterend',card); else aside.insertBefore(card,aside.firstChild);}
  }

  function draw(){
    rengeoLayer.clearLayers();
    for(const [code,lat,lon] of stations){
      const m=L.circleMarker([lat,lon],{radius:4.4,weight:1.2,color:'#07111e',fillColor:'#ffd166',fillOpacity:0.95});
      m.bindPopup(`<b>${esc(code)}</b><br>RENGEO · IG-EPN · Ecuador<br><span style="font-size:11px;color:#7894ac">Ubicación/código publicados por IG-EPN. La presencia del marcador no implica que exista una solución E/N/U de baja latencia disponible en este ciclo.</span>`);
      m.addTo(rengeoLayer);
    }
  }

  function arrText(v){
    if(!Array.isArray(v)||!v.length)return '—';
    return v.map(x=>typeof x==='string'?x:(x.code||x.station||x.name||JSON.stringify(x))).slice(0,8).join(', ')+(v.length>8?'…':'');
  }
  function renderState(s){
    ensureCard();
    const r=s?.gnss?.rengeo || null;
    if(!r){
      document.getElementById('rengeoFresh').textContent='—';
      document.getElementById('rengeoUsed').textContent='—';
      document.getElementById('rengeoNonAuto').textContent='—';
      document.getElementById('rengeoLatency').textContent='—';
      document.getElementById('rengeoFocus').textContent='—';
      document.getElementById('rengeoStatus').textContent='datos insuficientes RENGEO · esperando primer ciclo v1.5';
      return;
    }
    document.getElementById('rengeoFresh').textContent=val(r.rengeo_fresh);
    document.getElementById('rengeoUsed').textContent=val(r.rengeo_used_qc);
    document.getElementById('rengeoNonAuto').textContent=val(r.rengeo_non_automatable);
    document.getElementById('rengeoLatency').textContent=val(r.rengeo_median_latency);
    document.getElementById('rengeoFocus').textContent=arrText(r.rengeo_focus_stations);
    const an=Array.isArray(r.rengeo_coherent_anomalies)?r.rengeo_coherent_anomalies:[];
    document.getElementById('rengeoAnom').innerHTML=an.length?'<b>Anomalías coherentes:</b><br>'+an.map(esc).join('<br>'):'<b>Anomalías coherentes:</b> ninguna confirmada / datos insuficientes.';
    const det=r.rengeo_detected;
    document.getElementById('rengeoStatus').textContent=`RENGEO detectadas por agente: ${val(det)} · solo contribuyen a IDG las que pasan QC`;
  }
  async function loadState(){
    try{const r=await fetch(`${STATE_URL}?rengeo=${Date.now()}`,{cache:'no-store'});if(!r.ok)throw new Error('HTTP '+r.status);renderState(await r.json());}
    catch(e){ensureCard();document.getElementById('rengeoStatus').textContent='estado RENGEO no disponible temporalmente';}
  }

  ensureCard(); draw(); loadState();
  try{L.control.layers({}, {'GNSS · RENGEO IG-EPN (Ecuador)':rengeoLayer},{collapsed:true,position:'topleft'}).addTo(map);}catch(e){}
  setInterval(loadState,60000);
  window.mivigeRengeoStations=stations.map(x=>({code:x[0],lat:x[1],lon:x[2]}));
})();