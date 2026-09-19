(function(){
  const URL='manual_watch.json';
  let watchLayer=null;

  function ensureCard(){
    if(document.getElementById('manualScientificWatch')) return document.getElementById('manualScientificWatch');
    const aside=document.querySelector('aside');
    if(!aside) return null;
    const card=document.createElement('section');
    card.className='card';
    card.id='manualScientificWatch';
    card.innerHTML=`
      <h2>Corredor Perú–Ecuador · lectura visual</h2>
      <div class="kpis">
        <div class="kpi"><div class="name">Estado local</div><div class="val" id="mwLevel" style="font-size:13px">—</div></div>
        <div class="kpi"><div class="name">Señal</div><div class="val" id="mwSignal" style="font-size:13px">—</div></div>
        <div class="kpi"><div class="name">Eventos M5+</div><div class="val" id="mwCount">—</div></div>
        <div class="kpi"><div class="name">Semáforo MIVIGE</div><div class="val" id="mwGeneral" style="font-size:13px">—</div></div>
      </div>
      <div id="manualWatchBody" class="small" style="margin-top:10px">Cargando observación…</div>`;
    const persistent=document.getElementById('persistentAgentCard');
    if(persistent) persistent.insertAdjacentElement('afterend',card);
    else {
      const active=document.getElementById('zonesActive');
      if(active && active.parentElement) active.parentElement.insertAdjacentElement('afterend',card);
      else aside.insertBefore(card,aside.firstChild);
    }
    return card;
  }

  function fmtEvent(e){
    const t=e.time_local ? new Date(e.time_local).toLocaleString('es-EC',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',hour12:false}) : '—';
    const depth=Number.isFinite(Number(e.depth_km)) ? Number(e.depth_km).toFixed(1) : '—';
    return `<div style="display:grid;grid-template-columns:54px 1fr;gap:8px;padding:7px 0;border-bottom:1px solid #1d3851">
      <div style="font-weight:800;font-size:16px;color:#ffd665">M${Number(e.mag).toFixed(1)}</div>
      <div><b>${t}</b><br>${depth} km · ${e.region}<br><span style="color:#9db2c8">${e.source}</span></div>
    </div>`;
  }

  function render(s){
    ensureCard();
    const evidence=Array.isArray(s.evidence)?s.evidence:[];
    const latest=s.latest_event||null;
    document.getElementById('mwLevel').textContent=s.level||'—';
    document.getElementById('mwSignal').textContent=s.scientific_family||'—';
    document.getElementById('mwCount').textContent=evidence.filter(e=>Number(e.mag)>=5).length;
    document.getElementById('mwGeneral').textContent=s.general_status||'—';
    const el=document.getElementById('manualWatchBody');
    if(!el) return;
    el.innerHTML=`
      <div style="padding:8px 10px;border-left:4px solid #f0c644;background:#0b1a2a;border-radius:8px;margin-bottom:10px">
        <b>${s.title}</b><br>
        <span style="color:#ffd665">Recurrencia espacial M5+ · vigilancia reforzada</span>
      </div>
      <div>${evidence.map(fmtEvent).join('')}</div>
      <div style="margin-top:10px"><b>Cómo interpretarlo:</b> ${s.interpretation}</div>
      ${latest?`<div style="margin-top:10px;padding:8px 10px;border:1px solid #f08a24;border-radius:8px;background:#2a180d"><b>Evento más reciente · profundidad en revisión</b><br>${(latest.agency_solutions||[]).map(a=>`${a.agency}: ${a.mag} · ${a.depth_km} km · ${a.location}`).join('<br>')}<br><span style="color:#9db2c8">${latest.dedupe||''} ${latest.depth_status||''}</span></div>`:''}
      <div style="margin-top:10px;padding:8px 10px;border:1px solid #6b5715;border-radius:8px;background:#2a250d">
        <b>Condición de escalamiento:</b> ${s.escalation_rule}
      </div>
      <div style="margin-top:8px;color:#9db2c8">${s.disclaimer}</div>`;
  }

  function drawMap(s){
    if(typeof L==='undefined' || typeof map==='undefined') return;
    const ev=(s.evidence||[]).filter(e=>Number.isFinite(Number(e.lat))&&Number.isFinite(Number(e.lon)));
    if(!ev.length) return;
    if(watchLayer){ try{ map.removeLayer(watchLayer); }catch(_){ } }
    watchLayer=L.layerGroup();

    const latlngs=ev.map(e=>[Number(e.lat),Number(e.lon)]);
    const center=[latlngs.reduce((a,p)=>a+p[0],0)/latlngs.length,latlngs.reduce((a,p)=>a+p[1],0)/latlngs.length];

    L.circle(center,{
      radius:100000,
      color:'#f08a24',
      weight:2,
      opacity:0.9,
      fillColor:'#f0c644',
      fillOpacity:0.08,
      dashArray:'7,6'
    }).bindPopup(`<b>${s.title}</b><br>${s.level}<br><br>Radio operativo de vigilancia: ~100 km.<br><b>Nuevo M≥5 el 19-sep: disparador cumplido.</b><br>Este halo no representa una zona de predicción.`).addTo(watchLayer);

    L.polyline(latlngs,{
      color:'#f08a24',
      weight:3,
      opacity:0.85,
      dashArray:'9,7'
    }).bindTooltip('Secuencia espacial M5+ · 10–19 sep 2026',{sticky:true}).addTo(watchLayer);

    ev.forEach((e,i)=>{
      const mag=Number(e.mag), depth=Number(e.depth_km);
      const marker=L.circleMarker([Number(e.lat),Number(e.lon)],{
        radius:Math.max(7,mag*1.8),
        color:'#f08a24',
        weight:2,
        fillColor:i===ev.length-1?'#f0c644':'#ffb04a',
        fillOpacity:0.9
      });
      marker.bindPopup(`<b>M${mag.toFixed(1)} · ${e.region}</b><br>${new Date(e.time_local).toLocaleString('es-EC')}<br>Profundidad: ${Number.isFinite(depth)?depth.toFixed(1):'—'} km<br>Fuente: ${e.source}<br><br><b>Lectura MIVIGE:</b> parte del agrupamiento M5+ bajo observación reforzada.`);
      marker.bindTooltip(`M${mag.toFixed(1)} · ${Number.isFinite(depth)?depth.toFixed(0):'—'} km`,{direction:'top'});
      marker.addTo(watchLayer);
    });

    watchLayer.addTo(map);
    try{
      if(typeof L.control==='function' && !document.querySelector('.mivige-watch-legend')){
        const legend=L.control({position:'bottomleft'});
        legend.onAdd=function(){
          const d=L.DomUtil.create('div','legend mivige-watch-legend');
          d.innerHTML='<b>Corredor Perú–Ecuador</b><br><span style="color:#ffd665">●</span> M5+ observado<br><span style="color:#f08a24">- - -</span> corredor/halo de vigilancia';
          return d;
        };
        legend.addTo(map);
      }
    }catch(_){ }
  }

  async function load(){
    try{
      const r=await fetch(`${URL}?t=${Date.now()}`,{cache:'no-store'});
      if(!r.ok) throw new Error('HTTP '+r.status);
      const s=await r.json();
      render(s);
      drawMap(s);
    }catch(err){
      ensureCard();
      const el=document.getElementById('manualWatchBody');
      if(el) el.textContent='Observación científica complementaria temporalmente no disponible.';
    }
  }

  ensureCard();
  load();
  setInterval(load,300000);
})();
