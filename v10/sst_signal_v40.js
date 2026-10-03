(function(){
  const API='https://marine-api.open-meteo.com/v1/marine';
  const P=[
    {id:'pe_s',name:'Perú sur',lat:-16.2,lon:-75.0},
    {id:'pe_c',name:'Perú central',lat:-11.3,lon:-78.5},
    {id:'pe_n',name:'Perú norte',lat:-6.2,lon:-81.5},
    {id:'ec_s',name:'Ecuador sur · Golfo',lat:-3.1,lon:-81.0},
    {id:'ec_c',name:'Ecuador centro · Manabí',lat:-1.0,lon:-81.3},
    {id:'ec_n',name:'Ecuador norte · Esmeraldas',lat:0.55,lon:-80.7},
    {id:'co_p',name:'Colombia Pacífico',lat:2.6,lon:-79.0},
    {id:'co_ch',name:'Chocó',lat:5.0,lon:-78.0}
  ];
  function mean(a){return a.length?a.reduce((s,x)=>s+x,0)/a.length:null}
  function std(a){if(a.length<4)return null;const m=mean(a);return Math.sqrt(mean(a.map(x=>(x-m)*(x-m))))}
  function clamp(x,a=0,b=1){return Math.max(a,Math.min(b,x))}
  function ensure(){
    if(document.getElementById('sst40'))return;
    const aside=document.querySelector('aside');if(!aside)return;
    const c=document.createElement('section');c.className='card';c.id='sst40';
    c.innerHTML='<h2>🌊 SST experimental · anomalía relativa</h2><div class="small"><b>No usa temperatura absoluta.</b> Calcula desviación de las últimas 24 h frente a una línea base móvil de ~6 días en puntos marinos cercanos a los receptores. Solo aporta hasta +5 puntos y únicamente si la señal es persistente; no se considera precursor sísmico establecido.</div><div id="sst40status" class="small" style="margin-top:8px">Consultando…</div><div id="sst40list" style="margin-top:8px"></div>';
    const a=document.getElementById('anti40');a?a.insertAdjacentElement('afterend',c):aside.appendChild(c);
  }
  async function load(){
    ensure();const st=document.getElementById('sst40status'),host=document.getElementById('sst40list');
    try{
      const lat=P.map(x=>x.lat).join(','),lon=P.map(x=>x.lon).join(',');
      const url=API+'?latitude='+encodeURIComponent(lat)+'&longitude='+encodeURIComponent(lon)+'&hourly=sea_surface_temperature&past_days=7&forecast_days=1&timezone=UTC&cell_selection=sea';
      const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw new Error('HTTP '+r.status);
      const raw=await r.json(),arr=Array.isArray(raw)?raw:[raw],signals={};
      const rows=[];
      P.forEach((p,i)=>{
        const d=arr[i]||{},times=d.hourly?.time||[],vals=(d.hourly?.sea_surface_temperature||[]).map(Number);
        const now=Date.now(),pairs=times.map((t,j)=>({t:Date.parse(t+'Z'),v:vals[j]})).filter(x=>Number.isFinite(x.t)&&Number.isFinite(x.v)&&x.t<=now);
        const recent=pairs.filter(x=>x.t>=now-24*3600e3).map(x=>x.v);
        const base=pairs.filter(x=>x.t<now-24*3600e3&&x.t>=now-7*86400e3).map(x=>x.v);
        const bm=mean(base),bs=std(base),rm=mean(recent);
        let z=null,persist=0,strength=0,valid=false;
        if(bm!==null&&bs!==null&&bs>=0.08&&rm!==null){
          z=(rm-bm)/bs;
          const sign=Math.sign(z)||1;
          persist=recent.length?recent.filter(v=>Math.sign(v-bm)===sign&&Math.abs(v-bm)>=1.5*bs).length/recent.length:0;
          valid=Math.abs(z)>=1.5&&persist>=0.35;
          strength=valid?clamp((Math.abs(z)-1.2)/2.0)*clamp(persist/.65):0;
        }
        signals[p.id]={valid,strength,z,persist,baseline:bm,recent:rm};
        rows.push('<div class="listitem"><div><div class="zname">'+p.name+'</div><div class="zdesc">'+(z===null?'sin línea base suficiente':('Δ24h '+(rm-bm>=0?'+':'')+(rm-bm).toFixed(2)+' °C · z '+z.toFixed(2)+' · persistencia '+Math.round(persist*100)+'%'))+'</div></div><div class="pct">'+(valid?('+'+(5*strength).toFixed(1)):'0')+'</div></div>');
      });
      window.mivigeSSTSignals=signals;host.innerHTML=rows.join('');st.textContent='Actualizado · línea base móvil 7 días · modificador experimental máximo +5';
      if(typeof window.mivigeRenderProjectionV40==='function')window.mivigeRenderProjectionV40();
    }catch(e){window.mivigeSSTSignals={};st.textContent='SST no disponible en este ciclo; no modifica ninguna proyección.';host.innerHTML='';}
  }
  ensure();load();setInterval(load,3*3600000);
})();