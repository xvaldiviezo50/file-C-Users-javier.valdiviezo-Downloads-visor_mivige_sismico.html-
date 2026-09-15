(function(){
  const URL='../v23/predictions.json';
  function ensureCard(){
    if(document.getElementById('predictionValidationCard')) return;
    const aside=document.querySelector('aside'); if(!aside) return;
    const card=document.createElement('section'); card.className='card'; card.id='predictionValidationCard';
    card.innerHTML=`<h2>🧪 Pronósticos externos en validación</h2>
      <div id="predValidationStatus" class="small">Cargando pronósticos congelados…</div>
      <div id="predValidationList" style="margin-top:8px"></div>
      <div class="small" style="margin-top:8px"><b>Importante:</b> estas pruebas no son alertas oficiales ni modifican por sí solas el semáforo científico MIVIGE. Se evalúan prospectivamente contra resultados observados y contra ETAS/Omori.</div>`;
    const p=document.getElementById('persistentAgentCard');
    if(p) p.insertAdjacentElement('afterend',card); else aside.insertBefore(card,aside.firstChild);
  }
  function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
  function fmtRemaining(end){
    const ms=new Date(end).getTime()-Date.now();
    if(!Number.isFinite(ms)) return '—';
    if(ms<=0) return 'ventana finalizada';
    const h=Math.floor(ms/3600000), m=Math.floor((ms%3600000)/60000);
    return `${h} h ${m} min restantes`;
  }
  function evalObserved(p){
    if(!Array.isArray(window.allEvents)) return {label:'Pendiente',detail:'Esperando catálogo en vivo.'};
    const a=new Date(p.window_start).getTime(), b=new Date(p.window_end).getTime();
    const col=window.allEvents.filter(e=>e.time>=a&&e.time<=b&&e.lat>=-4.5&&e.lat<=13.5&&e.lon>=-82.5&&e.lon<=-66.5);
    const choco=col.filter(e=>e.lat>=3.0&&e.lat<=8.5&&e.lon>=-79.5&&e.lon<=-75.0);
    const exact=choco.find(e=>e.mag>=p.magnitude_min&&e.mag<=p.magnitude_max);
    if(exact) return {label:'Acierto exacto provisional',detail:`Evento M${exact.mag.toFixed(1)} en Chocó dentro de la ventana; falta verificar compatibilidad de secuencia/mecanismo antes de llamarlo réplica.`};
    const broad=col.find(e=>e.mag>=p.magnitude_min&&e.mag<=p.magnitude_max);
    if(broad) return {label:'Acierto amplio provisional',detail:`Evento M${broad.mag.toFixed(1)} en Colombia dentro de la ventana, fuera del criterio espacial exacto de Chocó.`};
    const partial=choco.find(e=>e.mag>=5.0&&e.mag<5.7);
    if(partial) return {label:'Parcial provisional',detail:`Evento M${partial.mag.toFixed(1)} en Chocó dentro de la ventana.`};
    if(Date.now()>b) return {label:'Fallo',detail:'Terminó la ventana sin M5.7–6.9 confirmado en Colombia.'};
    return {label:'Activo · sin cumplimiento aún',detail:'La ventana sigue abierta; eventos menores no cuentan como acierto.'};
  }
  function render(data){
    ensureCard();
    const list=document.getElementById('predValidationList');
    const status=document.getElementById('predValidationStatus');
    const ps=Array.isArray(data?.predictions)?data.predictions:[];
    status.textContent=ps.length?`${ps.length} pronóstico(s) congelado(s) bajo seguimiento`:'Sin pronósticos activos';
    list.innerHTML=ps.map(p=>{
      const ev=evalObserved(p);
      return `<div class="listitem" style="display:block">
        <div class="zname"><b>${esc(p.id)}</b> · ${esc(p.focus_region)}, ${esc(p.country)}</div>
        <div class="zdesc"><b>Fuente externa:</b> ${esc(p.source)}<br>
        <b>Ventana:</b> ${esc(p.window_start)} → ${esc(p.window_end)} · <b>${fmtRemaining(p.window_end)}</b><br>
        <b>Rango:</b> M${Number(p.magnitude_min).toFixed(1)}–${Number(p.magnitude_max).toFixed(1)}<br>
        <b>Estado de validación:</b> ${esc(ev.label)}<br>${esc(ev.detail)}<br>
        <b>Criterio exacto:</b> ${esc(p.criteria?.exact)}<br>
        <b>Parcial:</b> ${esc(p.criteria?.partial)}<br>
        <span style="color:#9db2c8">${esc(p.baseline_note)}</span></div>
      </div>`;
    }).join('');
  }
  async function load(){
    try{
      const r=await fetch(`${URL}?t=${Date.now()}`,{cache:'no-store'}); if(!r.ok) throw new Error('HTTP '+r.status);
      render(await r.json());
    }catch(e){ ensureCard(); document.getElementById('predValidationStatus').textContent='Pronósticos congelados no disponibles temporalmente.'; }
  }
  ensureCard(); load(); setInterval(load,60000);
  setInterval(()=>{try{load();}catch(e){}},60000);
})();