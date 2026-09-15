(function(){
  const STATE_URL='../v23/state.json';
  function val(v){return v===null||v===undefined?'—':String(v);}
  function ensureCard(){
    if(document.getElementById('gnssRegionalCard')) return;
    const aside=document.querySelector('aside'); if(!aside) return;
    const card=document.createElement('section'); card.className='card'; card.id='gnssRegionalCard';
    card.innerHTML=`<h2>🛰️ GNSS regional · IDG</h2>
      <div class="kpis">
        <div class="kpi"><div class="name">Detectadas</div><div class="val" id="gnssDetected">—</div></div>
        <div class="kpi"><div class="name">Dato vigente</div><div class="val" id="gnssFresh">—</div></div>
        <div class="kpi"><div class="name">Usadas tras QC</div><div class="val" id="gnssUsed">—</div></div>
        <div class="kpi"><div class="name">Descartadas</div><div class="val" id="gnssRejected">—</div></div>
      </div>
      <div class="small" style="margin-top:8px"><b>Latencia mediana:</b> <span id="gnssLatency">—</span><br><b>Cobertura del foco:</b> <span id="gnssCoverage">—</span><br><b>Estado IDG:</b> <span id="gnssIdg">datos insuficientes</span></div>
      <div id="gnssSources" class="small" style="margin-top:8px"></div>
      <div id="gnssAnomalies" class="small" style="margin-top:8px"></div>
      <div class="small" style="margin-top:8px;color:#7894ac">RT/NRT recibe mayor peso; soluciones diarias se muestran como baja latencia/diarias y nunca como tiempo real. Solo deformaciones coherentes tras control de calidad pueden elevar IDG.</div>`;
    const sci=[...document.querySelectorAll('section.card h2')].find(h=>/CAPA A/.test(h.textContent));
    if(sci) sci.parentElement.insertAdjacentElement('afterend',card); else aside.insertBefore(card,aside.firstChild);
  }
  function render(s){
    ensureCard(); const g=s&&s.gnss?s.gnss:null;
    const idg=document.getElementById('idg');
    if(!g){
      document.getElementById('gnssIdg').textContent='datos insuficientes · esperando primer ciclo GNSS v1.5';
      if(idg) idg.textContent='Datos insuficientes';
      document.getElementById('gnssSources').innerHTML='<b>Fuentes previstas:</b> SGC-GeoRED · IGM-REGME/IG-EPN-RENGEO · IGN/IGP Perú · Chile/SIRGAS · OVSICORI/RSN/EarthScope · UNAM/INEGI · IGS.';
      return;
    }
    document.getElementById('gnssDetected').textContent=val(g.stations_detected);
    document.getElementById('gnssFresh').textContent=val(g.stations_fresh);
    document.getElementById('gnssUsed').textContent=val(g.stations_used_qc);
    document.getElementById('gnssRejected').textContent=val(g.stations_rejected);
    document.getElementById('gnssLatency').textContent=val(g.median_latency);
    document.getElementById('gnssCoverage').textContent=val(g.focus_coverage);
    document.getElementById('gnssIdg').textContent=val(g.idg_status);
    if(idg) idg.textContent=val(g.idg_status);
    const src=Array.isArray(g.sources)?g.sources:[];
    document.getElementById('gnssSources').innerHTML=src.length?'<b>Fuentes GNSS:</b> '+src.map(x=>typeof x==='string'?x:(x.name||x.source||'fuente')+(x.status?' · '+x.status:'')).join('<br>'):'<b>Fuentes GNSS:</b> sin estado automatizado aún.';
    const a=Array.isArray(g.coherent_anomalies)?g.coherent_anomalies:[];
    document.getElementById('gnssAnomalies').innerHTML=a.length?'<b>Anomalías coherentes:</b><br>'+a.join('<br>'):'<b>Anomalías coherentes:</b> ninguna confirmada / datos insuficientes.';
  }
  async function load(){
    try{const r=await fetch(`${STATE_URL}?gnss=${Date.now()}`,{cache:'no-store'}); if(!r.ok) throw new Error('HTTP '+r.status); render(await r.json());}
    catch(e){ensureCard();document.getElementById('gnssIdg').textContent='estado GNSS no disponible';}
  }
  ensureCard(); load(); setInterval(load,60000);
  setTimeout(()=>{const c=document.getElementById('championName');if(c)c.textContent='MIVIGE Agent v1.5 – Champion GNSS regional';},500);
})();