(function(){
  const URL='choco_watch.json';
  let layer=null;

  function ensureCard(){
    if(document.getElementById('chocoWatchCard')) return;
    const aside=document.querySelector('aside');
    if(!aside) return;
    const card=document.createElement('section');
    card.className='card';
    card.id='chocoWatchCard';
    card.innerHTML=`
      <h2>Vigilancia Chocó</h2>
      <div class="kpis">
        <div class="kpi"><div class="name">Estado</div><div class="val" id="chocoLevel" style="font-size:13px">—</div></div>
        <div class="kpi"><div class="name">Lectura</div><div class="val" id="chocoReading" style="font-size:13px">—</div></div>
        <div class="kpi"><div class="name">Enjambre SGC</div><div class="val" id="chocoSwarmCount">—</div><div class="small" id="chocoSwarmCut" style="margin-top:3px">—</div></div>
        <div class="kpi"><div class="name">Réplicas M7,4</div><div class="val" id="chocoAftershockCount">—</div><div class="small" style="margin-top:3px">conteo separado</div></div>
        <div class="kpi"><div class="name">Pulso 18-sep</div><div class="val" id="chocoPulseCount">—</div><div class="small" id="chocoPulseM4" style="margin-top:3px">—</div></div>
        <div class="kpi"><div class="name">Mayor SGC hoy</div><div class="val" id="chocoLargestToday">—</div><div class="small" id="chocoLargestTime" style="margin-top:3px">—</div></div>
      </div>
      <div id="chocoCountNote" class="small" style="margin-top:8px;padding:8px;border:1px solid #335777;border-radius:8px;background:#0b1a2a">—</div>
      <div id="chocoAgency" class="small" style="margin-top:8px;padding:8px;border:1px solid #8a6b24;border-radius:8px;background:#241f0d">—</div>
      <div id="chocoEvidence" class="small" style="margin-top:8px">—</div>
      <div id="chocoAlerts" class="small" style="margin-top:8px">—</div>
      <div id="chocoRule" class="small" style="margin-top:8px">—</div>
      <div id="chocoDisclaimer" class="small" style="margin-top:8px;color:#9db2c8">—</div>`;
    const manual=document.getElementById('manualScientificWatch');
    if(manual) manual.insertAdjacentElement('afterend',card);
    else {
      const active=document.getElementById('zonesActive');
      if(active && active.parentElement) active.parentElement.insertAdjacentElement('afterend',card);
      else aside.appendChild(card);
    }
  }

  function renderCard(s){
    ensureCard();
    document.getElementById('chocoLevel').textContent=s.level||'—';
    document.getElementById('chocoReading').textContent='Enjambre / pulso activo';

    const c=s.official_counts||{};
    const p=s.recent_pulse||{};
    const a=s.agency_review||{};
    document.getElementById('chocoSwarmCount').textContent=c.swarm_label||'—';
    document.getElementById('chocoSwarmCut').textContent=c.swarm_cutoff?`corte oficial ${c.swarm_cutoff}`:'—';
    document.getElementById('chocoAftershockCount').textContent=c.aftershocks_label||'—';
    document.getElementById('chocoPulseCount').textContent=p.events_label||'—';
    document.getElementById('chocoPulseM4').textContent=p.m4plus_label||'—';
    document.getElementById('chocoLargestToday').textContent=p.largest_sgc_today||'—';
    document.getElementById('chocoLargestTime').textContent=p.largest_sgc_time?`${p.largest_sgc_time} · SGC`:'—';

    document.getElementById('chocoCountNote').innerHTML=`<b>${c.source||'SGC'}:</b> ${c.note||'—'}<br><b>Pulso actual:</b> ${p.interpretation||'—'}`;
    document.getElementById('chocoAgency').innerHTML=`<b>Contraste de agencias:</b> ${a.event_time||'—'} · SGC ${a.sgc_solution||'—'} · USGS ${a.usgs_solution||'—'}<br>${a.rule||''}`;

    const evidence=(s.evidence||[]).map(x=>`• ${x}`).join('<br>');
    const alerts=(s.alert_conditions||[]).map(x=>`• ${x}`).join('<br>');
    document.getElementById('chocoEvidence').innerHTML=`<b>Interpretación actual:</b> ${s.current_reading||'—'}<br><br><b>Evidencia:</b><br>${evidence}`;
    document.getElementById('chocoAlerts').innerHTML=`<b>Condiciones de alerta:</b><br>${alerts}`;
    document.getElementById('chocoRule').innerHTML=`<b>Regla MIVIGE:</b> ${s.status_logic?.rule||'—'}<br><b>Semáforo general:</b> ${s.general_status||'—'}`;
    document.getElementById('chocoDisclaimer').textContent=s.disclaimer||'';
  }

  function renderMap(s){
    if(typeof L==='undefined' || typeof map==='undefined') return;
    if(layer){ try{ map.removeLayer(layer); }catch(_){} }
    layer=L.layerGroup();
    const c=s.map?.center;
    const r=(s.map?.radius_km||170)*1000;
    const counts=s.official_counts||{};
    const p=s.recent_pulse||{};
    if(Array.isArray(c)&&c.length===2){
      L.circle(c,{radius:r,color:'#f0c644',weight:2,fillColor:'#f0c644',fillOpacity:0.08,dashArray:'7,6'})
        .bindPopup(`<b>${s.title}</b><br>${s.level}<br><br><b>Enjambre SGC:</b> ${counts.swarm_label||'—'} (corte ${counts.swarm_cutoff||'—'})<br><b>Pulso 18-sep:</b> ${p.events_label||'—'} · ${p.m4plus_label||'—'}<br><b>Mayor SGC hoy:</b> ${p.largest_sgc_today||'—'}<br><br>${s.current_reading}`)
        .addTo(layer);
      L.marker(c,{title:s.map?.label||'Vigilancia Chocó'})
        .bindTooltip(`${s.map?.label||'Vigilancia Chocó'} · ${p.m4plus_label||''}`,{permanent:false,direction:'top'})
        .bindPopup(`<b>${s.title}</b><br><b>${s.level}</b><br><b>${counts.swarm_label||'—'} del enjambre</b><br><b>${p.events_label||'—'} hoy</b><br>${s.disclaimer}`)
        .addTo(layer);
    }
    layer.addTo(map);
  }

  async function load(){
    try{
      const r=await fetch(`${URL}?t=${Date.now()}`,{cache:'no-store'});
      if(!r.ok) throw new Error('HTTP '+r.status);
      const s=await r.json();
      renderCard(s); renderMap(s);
    }catch(err){
      ensureCard();
      const el=document.getElementById('chocoEvidence');
      if(el) el.textContent='Vigilancia Chocó temporalmente no disponible.';
    }
  }

  ensureCard(); load(); setInterval(load,300000);
})();