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
      </div>
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
    document.getElementById('chocoReading').textContent='Enjambre / reajuste persistente';
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
    if(Array.isArray(c)&&c.length===2){
      L.circle(c,{radius:r,color:'#f0c644',weight:2,fillColor:'#f0c644',fillOpacity:0.08,dashArray:'7,6'})
        .bindPopup(`<b>${s.title}</b><br>${s.level}<br><br>${s.current_reading}<br><br><b>Escalar solo si:</b> M≥5, aceleración sostenida, migración coherente o segunda familia científica.`)
        .addTo(layer);
      L.marker(c,{title:s.map?.label||'Vigilancia Chocó'})
        .bindTooltip(s.map?.label||'Vigilancia Chocó',{permanent:false,direction:'top'})
        .bindPopup(`<b>${s.title}</b><br><b>${s.level}</b><br>${s.disclaimer}`)
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
