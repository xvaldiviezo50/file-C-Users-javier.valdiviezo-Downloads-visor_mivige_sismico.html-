(function(){
  const URL='manual_watch.json';

  function ensureCard(){
    if(document.getElementById('manualScientificWatch')) return document.getElementById('manualScientificWatch');
    const aside=document.querySelector('aside');
    if(!aside) return null;
    const card=document.createElement('section');
    card.className='card';
    card.id='manualScientificWatch';
    card.innerHTML='<h2>Observación científica complementaria</h2><div id="manualWatchBody" class="small">Cargando observación…</div>';
    const persistent=document.getElementById('persistentAgentCard');
    if(persistent) persistent.insertAdjacentElement('afterend',card);
    else aside.insertBefore(card,aside.firstChild);
    return card;
  }

  function fmtEvent(e){
    const t=e.time_local ? new Date(e.time_local).toLocaleString('es-EC',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',hour12:false}) : '—';
    return `<li><b>M${Number(e.mag).toFixed(1)}</b> · ${t} · ${e.depth_km ?? '—'} km · ${e.region}</li>`;
  }

  function render(s){
    ensureCard();
    const el=document.getElementById('manualWatchBody');
    if(!el) return;
    const events=(s.evidence||[]).map(fmtEvent).join('');
    el.innerHTML=`
      <div style="margin-bottom:8px"><b>${s.title}</b></div>
      <div><b>Nivel:</b> ${s.level} · <b>Familia:</b> ${s.scientific_family}</div>
      <ul style="padding-left:18px;margin:8px 0">${events}</ul>
      <div style="margin-top:8px"><b>Interpretación:</b> ${s.interpretation}</div>
      <div style="margin-top:8px"><b>Regla de escalamiento:</b> ${s.escalation_rule}</div>
      <div style="margin-top:8px"><b>Semáforo general:</b> ${s.general_status}</div>
      <div style="margin-top:8px;color:#9db2c8">${s.disclaimer}</div>`;
  }

  async function load(){
    try{
      const r=await fetch(`${URL}?t=${Date.now()}`,{cache:'no-store'});
      if(!r.ok) throw new Error('HTTP '+r.status);
      render(await r.json());
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
