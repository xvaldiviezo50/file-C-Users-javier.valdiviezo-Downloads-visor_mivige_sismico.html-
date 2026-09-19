(function(){
  function fmt(ms){
    if(!Number.isFinite(Number(ms))) return '—';
    try{
      return new Intl.DateTimeFormat('es-EC',{
        timeZone:'America/Guayaquil',
        day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',hour12:false
      }).format(new Date(Number(ms)));
    }catch(_){ return new Date(Number(ms)).toLocaleString(); }
  }

  function update(){
    const evEl=document.getElementById('lastEventReceived');
    const anEl=document.getElementById('lastMivigeAnalysis');

    if(evEl){
      try{
        if(Array.isArray(window.allEvents || allEvents) && (window.allEvents || allEvents).length){
          const a=(window.allEvents || allEvents).slice().sort((x,y)=>Number(y.time)-Number(x.time));
          const e=a[0];
          evEl.innerHTML='<b>M'+Number(e.mag).toFixed(1)+'</b> · '+fmt(e.time)+'<br><span style="font-size:11px">'+(e.source||'—')+'</span>';
        }else{
          evEl.textContent='Esperando catálogo…';
        }
      }catch(_){ evEl.textContent='Esperando catálogo…'; }
    }

    if(anEl){
      try{
        const raw=localStorage.getItem('mivigeAgentState');
        const st=raw?JSON.parse(raw):{};
        anEl.innerHTML=st.lastCut?fmt(st.lastCut)+'<br><span style="font-size:11px">recalculo local del visor</span>':'Esperando cálculo…';
      }catch(_){ anEl.textContent='—'; }
    }
  }

  update();
  setInterval(update,1000);
})();