(function(){
  const URL='tectonic_prospect.json';
  function ensureCard(){
    if(document.getElementById('tectonicProspectCard')) return;
    const aside=document.querySelector('aside'); if(!aside) return;
    const card=document.createElement('section');
    card.className='card'; card.id='tectonicProspectCard';
    card.innerHTML=`
      <h2>Prospección técnico-científica · acomodación de placas</h2>
      <div id="tpPrinciple" class="small">Cargando…</div>
      <div id="tpScenarios" class="small" style="margin-top:10px"></div>
      <div id="tpHorizons" class="small" style="margin-top:10px"></div>
      <div id="tpRule" class="small" style="margin-top:10px;padding:8px;border:1px solid #315b73;border-radius:8px;background:#0c1b27"></div>
      <div id="tpDisclaimer" class="small" style="margin-top:8px;color:#9db2c8"></div>`;
    const choco=document.getElementById('chocoWatchCard');
    if(choco) choco.insertAdjacentElement('afterend',card); else aside.appendChild(card);
  }
  function badge(s){
    if(/PLAUSIBLE|MECANISMO/i.test(s)) return '#42b86b';
    if(/EXPERIMENTAL|CONTROL/i.test(s)) return '#af7cff';
    return '#f0c644';
  }
  function render(d){
    ensureCard();
    document.getElementById('tpPrinciple').innerHTML='<b>Principio:</b> '+d.principle;
    document.getElementById('tpScenarios').innerHTML=(d.scenarios||[]).map(s=>{
      const c=badge(s.support);
      return '<div style="margin:8px 0;padding:9px 10px;border-left:4px solid '+c+';background:#101923;border-radius:8px">'+
        '<div style="display:flex;justify-content:space-between;gap:8px"><b>'+s.name+'</b><span style="color:'+c+';font-weight:800">'+s.support+'</span></div>'+
        '<div style="margin-top:4px"><b>Peso científico:</b> '+s.scientific_weight+'</div>'+
        '<div style="margin-top:4px"><b>Mecanismo:</b> '+s.mechanism+'</div>'+
        '<div style="margin-top:4px"><b>Prospección:</b> '+s.future_prospect+'</div>'+
        '<div style="margin-top:4px;color:#9db2c8"><b>Qué debe aparecer para reforzarla:</b> '+(s.triggers||[]).join(' · ')+'</div></div>';
    }).join('');
    document.getElementById('tpHorizons').innerHTML='<b>Horizontes de vigilancia</b>'+(d.horizons||[]).map(h=>'<div style="padding:5px 0;border-bottom:1px solid #1d3851"><b>'+h.window+':</b> '+h.prospect+'</div>').join('');
    document.getElementById('tpRule').innerHTML='<b>Regla de decisión:</b> '+d.decision_rule;
    document.getElementById('tpDisclaimer').textContent=d.disclaimer||'';
  }
  async function load(){
    try{
      const r=await fetch(URL+'?t='+Date.now(),{cache:'no-store'});
      if(!r.ok) throw new Error('HTTP '+r.status);
      render(await r.json());
    }catch(e){
      ensureCard();
      const x=document.getElementById('tpPrinciple'); if(x) x.textContent='Prospección técnica temporalmente no disponible.';
    }
  }
  ensureCard(); load(); setInterval(load,300000);
})();
