(function(){
  const STATE_URL='../v23/state.json';
  let lastStateVersion=null;
  function ensureCard(){
    if(document.getElementById('persistentAgentCard'))return;
    const aside=document.querySelector('aside');if(!aside)return;
    const card=document.createElement('section');card.className='card';card.id='persistentAgentCard';
    card.innerHTML=`<h2>⚡ Estado persistente del agente</h2>
      <div class="kpis"><div class="kpi"><div class="name">Último corte del agente</div><div class="val" id="persistentCut" style="font-size:13px">—</div></div>
      <div class="kpi"><div class="name">Estado</div><div class="val" id="persistentStatus" style="font-size:13px">—</div></div></div>
      <div id="persistentFocus" class="small" style="margin-top:8px">Esperando estado…</div>
      <div class="small" style="margin-top:8px">Este bloque es escrito por el agente horario y sirve como respaldo cuando un catálogo oficial todavía no ha propagado un evento al navegador. El visor sigue recalculando los feeds en vivo de forma independiente.</div>`;
    const proactive=document.getElementById('proactiveCard');
    if(proactive)proactive.insertAdjacentElement('afterend',card);else aside.insertBefore(card,aside.firstChild);
  }
  function renderState(s){
    ensureCard();
    document.getElementById('persistentCut').textContent=s.updated_at_ecuador||s.updated_at||'—';
    document.getElementById('persistentStatus').textContent=s.semaforo||'—';
    const f=(s.focus||[])[0];
    document.getElementById('persistentFocus').innerHTML=f?`<b>Foco principal:</b> ${f.name}<br><b>Nivel:</b> ${f.level}<br><b>Razón:</b> ${f.reason}<br><b>Siguiente revisión:</b> ${f.next_check}`:'Sin foco material persistente.';
  }
  function mergeEvents(s){
    if(!Array.isArray(s.events)||typeof allEvents==='undefined')return;
    let changed=false;
    for(const x of s.events){
      const e={source:x.source||'AGENTE',id:x.id||`persist-${x.time}-${x.lat}-${x.lon}`,time:Number(x.time),mag:Number(x.mag),depth:Number(x.depth),lat:Number(x.lat),lon:Number(x.lon),place:x.place||'Estado persistente'};
      if(!Number.isFinite(e.time)||!Number.isFinite(e.mag)||!Number.isFinite(e.lat)||!Number.isFinite(e.lon))continue;
      const exists=allEvents.some(o=>Math.abs(o.time-e.time)<=5*60*1000&&distKm(o.lat,o.lon,e.lat,e.lon)<=45);
      if(!exists){allEvents.push(e);changed=true;}
    }
    if(changed){allEvents=typeof dedupe==='function'?dedupe(allEvents):allEvents.sort((a,b)=>b.time-a.time);if(typeof render==='function')render(allEvents);}
  }
  async function load(){
    try{
      const r=await fetch(`${STATE_URL}?t=${Date.now()}`,{cache:'no-store'});if(!r.ok)throw new Error('HTTP '+r.status);
      const s=await r.json();renderState(s);
      if(s.version!==lastStateVersion){lastStateVersion=s.version;mergeEvents(s);}
    }catch(err){ensureCard();const el=document.getElementById('persistentFocus');if(el)el.textContent='Estado persistente no disponible; se mantienen los feeds en vivo.';}
  }
  ensureCard();load();setInterval(load,60000);
})();