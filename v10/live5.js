(function(){
  try{
    const FAST_MS=5*60*1000;
    const originalRefresh=window.refresh;
    if(typeof originalRefresh!=='function') return;
    let running=false;
    async function fastRefresh(){
      if(running) return;
      const btn=document.getElementById('refresh');
      if(btn && btn.disabled) return;
      running=true;
      try{
        await originalRefresh();
      }catch(e){
        console.warn('MIVIGE live refresh error',e);
      }finally{
        try{ refreshAt=Date.now()+FAST_MS; }catch(e){}
        running=false;
      }
    }
    window.refresh=fastRefresh;
    const btn=document.getElementById('refresh');
    if(btn) btn.onclick=fastRefresh;
    try{ refreshAt=Date.now()+FAST_MS; }catch(e){}
    setInterval(fastRefresh,FAST_MS);
    // El refresco horario original queda como respaldo; este control mantiene
    // el contador coherente con la consulta rápida de 5 minutos.
    setInterval(()=>{
      try{
        if(typeof refreshAt!=='undefined' && refreshAt-Date.now()>FAST_MS+15000){
          refreshAt=Date.now()+FAST_MS;
        }
      }catch(e){}
    },30000);

    // Etiqueta visible del modo de adquisición.
    const card=[...document.querySelectorAll('.card')].find(x=>x.querySelector('h2')?.textContent?.trim()==='Actualización');
    if(card && !document.getElementById('live5Status')){
      const d=document.createElement('div');
      d.id='live5Status'; d.className='small'; d.style.marginTop='8px';
      d.innerHTML='<b>⚡ Modo proactivo:</b> catálogos sísmicos consultados cada 5 minutos mientras el visor está abierto; análisis persistente del agente cada hora.';
      card.appendChild(d);
    }
  }catch(err){ console.warn('MIVIGE live5 unavailable',err); }
})();