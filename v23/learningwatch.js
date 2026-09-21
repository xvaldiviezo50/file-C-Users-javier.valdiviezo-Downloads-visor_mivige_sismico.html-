(function(){
  const URL='learning_model.json';

  function ensureCard(){
    if(document.getElementById('learningCard')) return;
    const aside=document.querySelector('aside'); if(!aside) return;
    const card=document.createElement('section');
    card.className='card'; card.id='learningCard';
    card.innerHTML=`
      <h2>Aprendizaje + Convergencia</h2>
      <div class="kpis">
        <div class="kpi"><div class="name">Convergencia</div><div class="val" id="learnConv" style="font-size:13px">—</div></div>
        <div class="kpi"><div class="name">Peso científico</div><div class="val" id="learnSci">—</div></div>
        <div class="kpi"><div class="name">Peso experimental activo</div><div class="val" id="learnExp">—</div></div>
        <div class="kpi"><div class="name">Modo</div><div class="val" id="learnMode" style="font-size:13px">—</div></div>
      </div>
      <div id="learnBars" class="small" style="margin-top:10px">—</div>
      <div id="learnModels" class="small" style="margin-top:10px">—</div>
      <div id="learnRule" class="small" style="margin-top:10px;padding:8px;border:1px solid #315b73;border-radius:8px;background:#0c1b27">—</div>
      <div id="learnSafe" class="small" style="margin-top:8px;color:#9db2c8">—</div>`;
    const iemd=document.getElementById('iemdCard');
    if(iemd) iemd.insertAdjacentElement('afterend',card);
    else aside.appendChild(card);
  }

  function bar(label,value,status){
    const v=Math.max(0,Math.min(100,Number(value)||0));
    return `<div style="margin:7px 0"><div style="display:flex;justify-content:space-between;gap:8px"><span>${label}</span><b>${v.toFixed(0)}%</b></div><div style="height:8px;background:#142538;border-radius:999px;overflow:hidden"><div style="width:${v}%;height:100%;background:linear-gradient(90deg,#4f8fb7,#9d7bd8)"></div></div><div style="color:#8fa6bb;font-size:10px;margin-top:2px">${status||''}</div></div>`;
  }

  function render(d){
    ensureCard();
    const sci=d.blocks?.scientific||{};
    const exp=d.blocks?.experimental||{};
    const models=exp.models||[];
    const activeExp=models.reduce((a,m)=>a+(Number(m.current_weight_pct)||0),0);

    document.getElementById('learnConv').textContent=d.convergence?.current_level||'—';
    document.getElementById('learnSci').textContent='100% base';
    document.getElementById('learnExp').textContent=activeExp.toFixed(1)+'%';
    document.getElementById('learnMode').textContent=d.mode||'—';

    document.getElementById('learnBars').innerHTML='<b>Familias científicas</b>'+ (sci.families||[]).map(f=>bar(f.id+' · '+f.label,f.base_weight_pct,f.status)).join('');

    document.getElementById('learnModels').innerHTML='<b>Modelos experimentales adaptativos</b>'+models.map(m=>{
      const ev=Number(m.evaluable_cases)||0, min=Number(m.minimum_cases_to_unlock)||20;
      const progress=Math.min(100,100*ev/min);
      return `<div style="margin:8px 0;padding:8px 10px;border-left:4px solid ${m.current_weight_pct>0?'#42b86b':'#7f8da0'};background:#101923;border-radius:8px">
        <b>${m.label}</b><br>
        Peso actual: <b>${Number(m.current_weight_pct||0).toFixed(1)}%</b> / máximo ${m.max_weight_pct}%<br>
        Casos evaluables: ${ev}/${min}<br>
        <div style="height:7px;background:#142538;border-radius:999px;overflow:hidden;margin-top:5px"><div style="width:${progress}%;height:100%;background:#7f8da0"></div></div>
        <span style="color:#9db2c8">${m.status}</span>
      </div>`;
    }).join('');

    document.getElementById('learnRule').innerHTML='<b>Cómo aprende:</b> '+(d.learning_rules?.reliability_formula||'—')+'<br><b>Actualización de peso:</b> '+(d.learning_rules?.weight_formula||'—')+'<br><b>Convergencia actual:</b> '+(d.convergence?.current_reason||'—');
    document.getElementById('learnSafe').innerHTML='<b>Salvaguardas:</b><br>'+ (d.safeguards||[]).map(x=>'• '+x).join('<br>');
  }

  async function load(){
    try{
      const r=await fetch(URL+'?t='+Date.now(),{cache:'no-store'});
      if(!r.ok) throw new Error('HTTP '+r.status);
      render(await r.json());
    }catch(e){
      ensureCard();
      const x=document.getElementById('learnRule'); if(x)x.textContent='Motor de aprendizaje temporalmente no disponible.';
    }
  }
  ensureCard(); load(); setInterval(load,300000);
})();