(function(){
  const URL='iemd_watch.json';
  let layer=null;
  let visible=true;
  let controlAdded=false;

  function ensureCard(){
    if(document.getElementById('iemdCard')) return;
    const aside=document.querySelector('aside');
    if(!aside) return;
    const card=document.createElement('section');
    card.className='card';
    card.id='iemdCard';
    card.innerHTML=`
      <h2>IEM-D · Migración direccional experimental</h2>
      <div class="kpis">
        <div class="kpi"><div class="name">Casos activos</div><div class="val" id="iemdCount">—</div></div>
        <div class="kpi"><div class="name">Estado</div><div class="val" id="iemdStatus" style="font-size:13px">—</div></div>
        <div class="kpi"><div class="name">Capa mapa</div><div class="val" id="iemdMapState" style="font-size:13px">Visible</div></div>
      </div>
      <div class="controls" style="margin-top:8px"><button id="iemdToggle">Ocultar IEM-D</button></div>
      <div id="iemdCases" class="small" style="margin-top:10px">Cargando…</div>
      <div id="iemdMethod" class="small" style="margin-top:10px;padding:8px;border:1px solid #7549a8;border-radius:8px;background:#171020">—</div>
      <div id="iemdDisclaimer" class="small" style="margin-top:8px;color:#b8a6cf">—</div>`;
    const exp=document.querySelector('section.card h2');
    const manual=document.getElementById('manualScientificWatch');
    if(manual) manual.insertAdjacentElement('afterend',card);
    else aside.appendChild(card);

    document.getElementById('iemdToggle').onclick=()=>{
      visible=!visible;
      if(layer && typeof map!=='undefined'){
        if(visible){ layer.addTo(map); }
        else { try{map.removeLayer(layer);}catch(_){} }
      }
      document.getElementById('iemdToggle').textContent=visible?'Ocultar IEM-D':'Mostrar IEM-D';
      document.getElementById('iemdMapState').textContent=visible?'Visible':'Oculta';
    };
  }

  function statusColor(status){
    if(status==='CUMPLIDO') return '#42b86b';
    if(status==='FALLIDO') return '#e4493f';
    if(status==='PARCIAL') return '#f08a24';
    return '#af7cff';
  }

  function caseHtml(c){
    const o=c.origin||{}, p=c.projection||{}, ph=c.physics||{};
    const col=statusColor(p.status);
    return `<div style="margin:8px 0;padding:9px 10px;border-left:4px solid ${col};background:#0d1623;border-radius:8px">
      <div style="display:flex;justify-content:space-between;gap:8px"><b>${o.label} · M${Number(o.mag).toFixed(1)}</b><span style="color:${col};font-weight:800">${p.status||'—'}</span></div>
      <div style="margin-top:4px">→ <b>${p.target_name}</b> · ${p.window_label}</div>
      <div style="color:#9db2c8;margin-top:4px">Origen: ${o.agency} · ${o.depth_km} km · ${o.verification}</div>
      <div style="color:#c8b8dd;margin-top:4px">Física: ${ph.dynamic_triggering||'—'}</div>
      <div style="color:#9db2c8;margin-top:4px">Control: ${p.baseline_penalty||'—'}</div>
    </div>`;
  }

  function renderCard(d){
    ensureCard();
    const cases=d.cases||[];
    document.getElementById('iemdCount').textContent=cases.length;
    document.getElementById('iemdStatus').textContent=d.status||'—';
    document.getElementById('iemdCases').innerHTML=cases.map(caseHtml).join('')||'Sin casos.';
    document.getElementById('iemdMethod').innerHTML='<b>Regla de validación:</b> '+(d.methodology||'—')+'<br><b>No retrofit:</b> '+(d.evaluation_rules?.no_retrofit||'—');
    document.getElementById('iemdDisclaimer').textContent=d.disclaimer||'';
  }

  function arrowIcon(color,label){
    return L.divIcon({
      className:'',
      html:`<div style="transform:translate(-50%,-50%);font-size:24px;color:${color};font-weight:900;text-shadow:0 1px 3px #000">➜</div><div style="transform:translate(-50%,-8px);background:#100b19dd;border:1px solid ${color};color:#eee;padding:2px 5px;border-radius:5px;font-size:10px;white-space:nowrap">${label}</div>`,
      iconSize:[1,1]
    });
  }

  function midpoint(a,b){
    let lon1=a[1], lon2=b[1];
    let d=lon2-lon1;
    if(d>180) lon2-=360;
    if(d<-180) lon2+=360;
    let lon=(lon1+lon2)/2;
    if(lon>180) lon-=360;
    if(lon<-180) lon+=360;
    return [(a[0]+b[0])/2,lon];
  }

  function pathPoints(a,b){
    const m=midpoint(a,b);
    const bend=[m[0]+(a[0]>b[0]?-7:7),m[1]];
    return [a,bend,b];
  }

  function draw(d){
    if(typeof L==='undefined'||typeof map==='undefined') return;
    if(layer){ try{map.removeLayer(layer);}catch(_){} }
    layer=L.layerGroup();

    (d.cases||[]).forEach((c,idx)=>{
      const o=c.origin||{}, p=c.projection||{};
      if(!Number.isFinite(Number(o.lat))||!Number.isFinite(Number(o.lon))||!Array.isArray(p.target_center)) return;
      const src=[Number(o.lat),Number(o.lon)];
      const dst=[Number(p.target_center[0]),Number(p.target_center[1])];
      const color=statusColor(p.status);

      L.circleMarker(src,{radius:8+Math.max(0,Number(o.mag)-4)*2,color:'#fff',weight:1.5,fillColor:color,fillOpacity:.95})
        .bindPopup(`<b>Origen IEM-D</b><br>${o.label}<br>M${Number(o.mag).toFixed(1)} · ${o.depth_km} km<br>${o.agency}<br><br><b>Destino experimental:</b> ${p.target_name}<br><b>Ventana:</b> ${p.window_label}<br><span style="color:#b8a6cf">No implica trayectoria física demostrada de energía.</span>`)
        .bindTooltip(`Origen · ${o.label} M${Number(o.mag).toFixed(1)}`,{direction:'top'})
        .addTo(layer);

      const pts=pathPoints(src,dst);
      L.polyline(pts,{color,weight:3,opacity:.78,dashArray:'10,8'})
        .bindPopup(`<b>Corredor experimental IEM-D</b><br>${o.label} → ${p.target_name}<br>Ventana: ${p.window_label}<br>Estado: ${p.status}<br><br>${c.physics?.interpretation||''}`)
        .addTo(layer);

      const mid=pts[1];
      L.marker(mid,{interactive:false,icon:arrowIcon(color,p.window_label)}).addTo(layer);

      L.circle(dst,{radius:(Number(p.target_radius_km)||250)*1000,color,weight:2,fillColor:color,fillOpacity:.08,dashArray:'6,6'})
        .bindPopup(`<b>Zona receptora propuesta</b><br>${p.target_name}<br>Ventana: ${p.window_label}<br>Estado: <b>${p.status}</b><br><br><b>Penalización de fondo:</b> ${p.baseline_penalty}<br><b>Criterio de magnitud:</b> ${p.magnitude_rule}`)
        .bindTooltip(`${p.target_name} · ${p.status}`,{direction:'top'})
        .addTo(layer);
    });

    if(visible) layer.addTo(map);

    if(!controlAdded){
      try{
        const lg=L.control({position:'bottomright'});
        lg.onAdd=()=>{
          const d=L.DomUtil.create('div','legend');
          d.innerHTML='<b>IEM-D experimental</b><br><span style="color:#af7cff">●</span> origen verificado<br><span style="color:#af7cff">- - - ➜</span> corredor de prueba<br><span style="color:#af7cff">◯</span> zona receptora propuesta<br><span style="color:#9db2c8">No representa transferencia física demostrada.</span>';
          return d;
        };
        lg.addTo(map);
      }catch(_){}
      controlAdded=true;
    }
  }

  async function load(){
    try{
      const r=await fetch(`${URL}?t=${Date.now()}`,{cache:'no-store'});
      if(!r.ok) throw new Error('HTTP '+r.status);
      const d=await r.json();
      renderCard(d); draw(d);
    }catch(err){
      ensureCard();
      const e=document.getElementById('iemdCases');
      if(e)e.textContent='IEM-D temporalmente no disponible.';
    }
  }

  ensureCard();load();setInterval(load,300000);
})();