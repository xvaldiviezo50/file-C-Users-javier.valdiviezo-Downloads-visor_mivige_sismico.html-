(function(){
  const MODULE_URL='geodesy_module.json';
  const STATE_URL='state.json';

  function ensureCard(){
    if(document.getElementById('geodesyModuleCard')) return;
    const aside=document.querySelector('aside');
    if(!aside) return;
    const card=document.createElement('section');
    card.className='card';
    card.id='geodesyModuleCard';
    card.innerHTML=`
      <h2>GEODESIA / SISMOGEODESIA 2.0</h2>
      <div class="kpis">
        <div class="kpi"><div class="name">IDG-LT · largo plazo</div><div class="val" id="geoLT" style="font-size:12px">—</div></div>
        <div class="kpi"><div class="name">IDG-ST · transitorios</div><div class="val" id="geoST" style="font-size:12px">—</div></div>
        <div class="kpi"><div class="name">IDG-HR · cinemático</div><div class="val" id="geoHR" style="font-size:12px">—</div></div>
        <div class="kpi"><div class="name">IAC · acoplamiento</div><div class="val" id="geoIAC" style="font-size:12px">—</div></div>
      </div>
      <div id="geoStatus" class="small" style="margin-top:9px">—</div>
      <div id="geoFusion" class="small" style="margin-top:9px">—</div>
      <details style="margin-top:8px"><summary style="cursor:pointer">Qué aporta al modelo</summary><div id="geoMethods" class="small" style="margin-top:8px">—</div></details>
      <div id="geoNote" class="small" style="margin-top:8px;color:#9db2c8">—</div>`;

    const choco=document.getElementById('chocoWatchCard');
    if(choco) choco.insertAdjacentElement('afterend',card);
    else {
      const sci=document.querySelector('section.card h2');
      if(sci && sci.parentElement) sci.parentElement.insertAdjacentElement('afterend',card);
      else aside.appendChild(card);
    }
  }

  function badgeText(status){
    if(!status) return '—';
    if(/insuficient/i.test(status)) return 'Datos insuficientes';
    if(/habilitado/i.test(status)) return 'Caracterización activa';
    if(/contexto|base/i.test(status)) return 'Contexto/base';
    if(/baja latencia/i.test(status)) return 'Pendiente datos NRT';
    return status;
  }

  function render(module,state){
    ensureCard();
    const c=module.components||{};
    document.getElementById('geoLT').textContent=badgeText(c.IDG_LT?.status);
    document.getElementById('geoST').textContent=badgeText(state?.gnss?.idg_status || c.IDG_ST?.status);
    document.getElementById('geoHR').textContent=badgeText(c.IDG_HR?.status);
    document.getElementById('geoIAC').textContent=badgeText(c.IAC?.status);

    const gnssStatus=state?.gnss?.idg_status || state?.gnss?.focus_coverage || 'Sin estado GNSS operativo disponible';
    document.getElementById('geoStatus').innerHTML=`<b>Estado geodésico operativo:</b> ${gnssStatus}.<br><b>Lectura:</b> el visor separa ahora deformación de largo plazo, transitorios y respuesta cinemática para evitar tratar señales cosísmicas como precursores.`;

    const rules=(module.fusion_rules||[]).map((x,i)=>`${i+1}. ${x}`).join('<br>');
    document.getElementById('geoFusion').innerHTML=`<b>Reglas de fusión MIVIGE:</b><br>${rules}`;

    const methods=(module.methodological_contributions||[]).map(x=>`• ${x}`).join('<br>');
    document.getElementById('geoMethods').innerHTML=methods;
    document.getElementById('geoNote').innerHTML=`${module.provenance||''}<br><br>${module.decision_use||''}`;
  }

  async function load(){
    try{
      const [mRes,sRes]=await Promise.all([
        fetch(`${MODULE_URL}?t=${Date.now()}`,{cache:'no-store'}),
        fetch(`${STATE_URL}?t=${Date.now()}`,{cache:'no-store'})
      ]);
      if(!mRes.ok) throw new Error('Módulo HTTP '+mRes.status);
      const module=await mRes.json();
      let state={};
      if(sRes.ok){ try{state=await sRes.json();}catch(_){state={};} }
      render(module,state);
    }catch(err){
      ensureCard();
      const el=document.getElementById('geoStatus');
      if(el) el.textContent='Módulo geodésico temporalmente no disponible.';
    }
  }

  ensureCard(); load(); setInterval(load,300000);
})();
