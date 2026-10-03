(function(){
  const CFG={
    id:'MIVIGE-SAS-v39',
    sourceMag:5.0,
    responseMag:3.0,
    pacificLagH:72,
    atlanticLagH:12,
    source:'Concepto experimental de ajuste secuencial aportado por el usuario',
    note:'La publicación no activa el modelo: solo los catálogos observados.'
  };

  const PBOX={
    chile:[-56,-17,-76,-66],
    peru:[-19.5,-3,-82,-68],
    ecuador:[-5.2,2.2,-81.6,-75],
    colombia:[1.5,13.5,-79.5,-66.5]
  };
  const PORDER=['chile','peru','ecuador','colombia'];
  const LABEL={chile:'Chile',peru:'Perú',ecuador:'Ecuador',colombia:'Colombia',atlantico:'Atlántico occidental',venezuela:'Venezuela'};
  const ABOX={
    atlantico:[0,25,-60,-35],
    venezuela:[0,13,-73,-59],
    colombia:[1.5,13.5,-79.5,-66.5]
  };

  function inBox(e,b){
    const lat=Number(e&&e.lat), lon=Number(e&&(e.lon??e.lng));
    return Number.isFinite(lat)&&Number.isFinite(lon)&&lat>=b[0]&&lat<=b[1]&&lon>=b[2]&&lon<=b[3];
  }
  function pregion(e){return PORDER.find(k=>inBox(e,PBOX[k]))||null;}
  function aregion(e){return ['atlantico','venezuela','colombia'].find(k=>inBox(e,ABOX[k]))||null;}
  function hoursSelected(){
    const el=document.getElementById('window'), v=Number(el&&el.value);
    return Number.isFinite(v)?v:72;
  }
  function moment(m){
    m=Number(m);
    return Number.isFinite(m)?Math.pow(10,1.5*m+9.1):0;
  }
  function fmtMoment(x){
    if(!Number.isFinite(x)||x<=0) return '0';
    const exp=Math.floor(Math.log10(x)), mant=x/Math.pow(10,exp);
    return mant.toFixed(2)+'×10^'+exp+' N·m';
  }
  function fmtEvent(e,rf){
    if(!e) return '—';
    const r=rf(e), t=new Date(Number(e.time));
    return 'M'+Number(e.mag).toFixed(1)+' · '+(r?LABEL[r]:e.place||'')+' · '+Math.round(Number(e.depth||0))+' km · '+t.toLocaleString('es-EC',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});
  }
  function lag(a,b){
    return Math.max(0,(Number(b.time)-Number(a.time))/3600000);
  }
  function firstByRegion(events, rf, order, startTime){
    const out={};
    for(const r of order){
      const e=events.filter(x=>Number(x.time)>startTime&&rf(x)===r).sort((a,b)=>Number(a.time)-Number(b.time))[0];
      if(e) out[r]=e;
    }
    return out;
  }
  function chainFromSource(src, events){
    const sr=pregion(src), si=PORDER.indexOf(sr);
    if(si<0) return {score:0,seq:[],uniq:[],adj:0};
    const end=Number(src.time)+CFG.pacificLagH*3600000;
    const post=events.filter(e=>Number(e.time)>Number(src.time)&&Number(e.time)<=end&&Number(e.mag)>=CFG.responseMag&&pregion(e)&&PORDER.indexOf(pregion(e))>si)
      .sort((a,b)=>Number(a.time)-Number(b.time));
    const first=firstByRegion(post,pregion,PORDER.slice(si+1),Number(src.time));
    let prev=src, seq=[], adj=0, expected=si+1;
    for(let i=si+1;i<PORDER.length;i++){
      const r=PORDER[i], e=first[r];
      if(!e) continue;
      seq.push(e);
      if(i===expected && Number(e.time)>Number(prev.time)){adj++; expected=i+1; prev=e;}
    }
    const uniq=[...new Set(post.map(pregion))];
    const score=uniq.length*2+adj+(Number(src.mag)>=6.5?1:0);
    return {score,seq,uniq,adj,post};
  }
  function bestPacific(events,t0){
    const cand=events.filter(e=>Number(e.time)>=t0&&Number(e.mag)>=CFG.sourceMag&&pregion(e));
    let best=null;
    for(const src of cand){
      const c=chainFromSource(src,events);
      if(!best||c.score>best.c.score||(c.score===best.c.score&&Number(src.time)>Number(best.src.time))) best={src,c};
    }
    return best;
  }
  function dischargeProxy(src,events){
    if(!src) return null;
    const sr=pregion(src), si=PORDER.indexOf(sr), end=Number(src.time)+CFG.pacificLagH*3600000;
    const mids=PORDER.slice(si+1,-1);
    const rel=events.filter(e=>Number(e.time)>Number(src.time)&&Number(e.time)<=end&&Number(e.mag)>=CFG.responseMag&&mids.includes(pregion(e)));
    const released=rel.reduce((s,e)=>s+moment(e.mag),0), srcM=moment(src.mag), ratio=srcM?released/srcM:0;
    let level='bajo';
    if(ratio>=0.10) level='alto'; else if(ratio>=0.01) level='moderado';
    return {events:rel,released,ratio,level};
  }
  function atlanticSequence(events,t0){
    const sources=events.filter(e=>Number(e.time)>=t0&&Number(e.mag)>=CFG.sourceMag&&aregion(e)==='atlantico').sort((a,b)=>Number(b.time)-Number(a.time));
    const src=sources[0]; if(!src) return null;
    const end=Number(src.time)+CFG.atlanticLagH*3600000;
    const post=events.filter(e=>Number(e.time)>Number(src.time)&&Number(e.time)<=end&&Number(e.mag)>=CFG.responseMag&&['venezuela','colombia'].includes(aregion(e))).sort((a,b)=>Number(a.time)-Number(b.time));
    return {src,post};
  }

  function addMapCorridors(){
    try{
      if(typeof map==='undefined'||typeof L==='undefined'||window.__mivigeV39Corridors) return;
      window.__mivigeV39Corridors=true;
      const p=L.polyline([[-33,-72],[-12,-77],[-1.5,-79],[5,-77]],{dashArray:'8 8',weight:2,opacity:.65}).addTo(map);
      p.bindTooltip('Corredor experimental Pacífico S→N · no representa una trayectoria física de energía');
      const a=L.polyline([[12,-50],[10,-64],[7,-73]],{dashArray:'4 10',weight:2,opacity:.55}).addTo(map);
      a.bindTooltip('Corredor experimental Atlántico→Venezuela · hipótesis separada');
    }catch(_){}
  }

  function ensure(){
    if(document.getElementById('seqAdjustCard')) return;
    const aside=document.querySelector('aside'); if(!aside) return;

    const card=document.createElement('section'); card.className='card'; card.id='seqAdjustCard';
    card.innerHTML=`<h2>🧪 Ajuste tectónico secuencial · modelo experimental depurado</h2>
      <div class="small"><b>Concepto incorporado:</b> tensión/ajuste que puede manifestarse de Sur→Norte, con liberación intermedia ("desahogo") y posible continuidad hacia el siguiente segmento. <b>La publicación no activa nada:</b> el módulo se calcula únicamente con eventos observados.</div>
      <div class="kpis" style="margin-top:8px">
        <div class="kpi"><div class="name">Fuente / inicio</div><div class="val" id="sasSource">—</div></div>
        <div class="kpi"><div class="name">Progresión S→N</div><div class="val" id="sasProgress">—</div></div>
        <div class="kpi"><div class="name">Desahogo intermedio</div><div class="val" id="sasDischarge">—</div></div>
        <div class="kpi"><div class="name">Continuidad experimental</div><div class="val" id="sasContinuity">—</div></div>
      </div>
      <div class="small" id="sasRoute" style="margin-top:8px">—</div>
      <div class="small" id="sasPhysics" style="margin-top:8px">—</div>
      <details style="margin-top:8px"><summary>Cómo traducimos el lenguaje del sismólogo</summary>
        <div class="small" style="margin-top:6px">
        • <b>"Ajuste/tensión"</b> → posible redistribución de esfuerzos y respuesta de fallas ya cargadas.<br>
        • <b>"Energía viene lenta"</b> → en MIVIGE no significa una onda viajando durante horas/días; se interpreta como <b>respuesta retardada/cascada</b> que debe comprobarse estadísticamente.<br>
        • <b>"Desahogo"</b> → proxy experimental basado en el <b>momento sísmico liberado</b> en Perú/Ecuador; no demuestra que esa liberación reduzca físicamente el esfuerzo hacia Colombia.<br>
        • <b>"Fuerza con que llega"</b> → se reemplaza por <b>continuidad de la secuencia</b>; MIVIGE no calcula una fuerza física sin modelo de fallas/Coulomb.
        </div>
      </details>
      <div class="small" style="margin-top:8px;color:#7894ac"><b>Estado:</b> hipótesis experimental. Para pasar a evidencia de interacción se requieren mecanismos focales, geometría de fallas, ΔCFS, cambio de tasa sobre fondo/ETAS y, cuando sea posible, GNSS/InSAR.</div>`;

    const atl=document.createElement('section'); atl.className='card'; atl.id='atlanticAdjustCard';
    atl.innerHTML=`<h2>🧪 Corredor independiente Atlántico → Venezuela</h2>
      <div class="small">Se mantiene separado del corredor Pacífico. Ventana piloto: <b>${CFG.atlanticLagH} h</b>, tomada del concepto observado; no es un umbral científico establecido.</div>
      <div class="kpis" style="margin-top:8px">
        <div class="kpi"><div class="name">Fuente Atlántico</div><div class="val" id="atlSource">—</div></div>
        <div class="kpi"><div class="name">Respuesta Venezuela/Colombia</div><div class="val" id="atlResponse">—</div></div>
      </div>
      <div class="small" id="atlRoute" style="margin-top:8px">—</div>`;

    const exp=[...document.querySelectorAll('section.card h2')].find(h=>/CAPA B/.test(h.textContent));
    if(exp){
      exp.parentElement.insertAdjacentElement('afterend',atl);
      exp.parentElement.insertAdjacentElement('afterend',card);
    }else{
      aside.insertBefore(atl,aside.firstChild); aside.insertBefore(card,aside.firstChild);
    }
  }

  function render(){
    ensure(); addMapCorridors();
    let ev=[]; try{if(Array.isArray(allEvents)) ev=allEvents;}catch(_){}
    const now=Date.now(), h=hoursSelected(), t0=now-h*3600000;
    const best=bestPacific(ev,t0);

    const srcEl=document.getElementById('sasSource'), progEl=document.getElementById('sasProgress'), disEl=document.getElementById('sasDischarge'), conEl=document.getElementById('sasContinuity'), routeEl=document.getElementById('sasRoute'), phyEl=document.getElementById('sasPhysics');
    if(!srcEl) return;

    if(!best){
      srcEl.textContent='Sin fuente M≥'+CFG.sourceMag.toFixed(1);
      progEl.textContent='Sin secuencia';
      disEl.textContent='No calculado';
      conEl.textContent='No activa';
      routeEl.innerHTML='<b>Ruta:</b> no hay fuente candidata en la ventana seleccionada.';
      phyEl.innerHTML='<b>Lectura:</b> la hipótesis S→N no se activa.';
    }else{
      const {src,c}=best, sr=pregion(src), si=PORDER.indexOf(sr), dp=dischargeProxy(src,ev);
      srcEl.textContent=fmtEvent(src,pregion);
      progEl.textContent=c.uniq.length?c.uniq.map(r=>LABEL[r]).join(' → '):'Sin avance a otro segmento';
      disEl.textContent=dp?dp.level+' · '+(dp.ratio*100).toFixed(2)+'% M0 fuente':'—';

      let cont='baja';
      if(c.adj>=2) cont='alta'; else if(c.adj===1||c.uniq.length>=2) cont='moderada';
      if(dp&&dp.level==='alto'&&cont==='alta') cont='moderada según heurística de desahogo';
      else if(dp&&dp.level==='alto'&&cont==='moderada') cont='baja según heurística de desahogo';
      conEl.textContent=cont;

      const seq=[src].concat(c.seq);
      routeEl.innerHTML='<b>Secuencia observada:</b><br>'+seq.map((e,i)=>{
        const r=pregion(e);
        const dt=i?(' · +'+lag(seq[i-1],e).toFixed(1)+' h'):'';
        return (i?'→ ':'')+fmtEvent(e,pregion)+dt;
      }).join('<br>');

      const next=PORDER[Math.min(PORDER.length-1, si+1+c.adj)];
      let physics='La progresión detectada es <b>espacio-temporal</b>, no causal. ';
      if(Number(src.mag)>=6.5) physics+='La magnitud de la fuente justifica revisar disparo dinámico remoto. ';
      else physics+='Con una fuente M&lt;6.5, MIVIGE la mantiene principalmente como patrón experimental; M5 es solo el tamiz operativo del visor. ';
      physics+='El proxy de "desahogo" suma momento sísmico en segmentos intermedios ('+(dp?fmtMoment(dp.released):'0')+'), pero no equivale a una transferencia de fuerza medida.';
      phyEl.innerHTML='<b>Lectura físico-técnica:</b> '+physics;
    }

    const as=atlanticSequence(ev,t0);
    const aSrc=document.getElementById('atlSource'), aResp=document.getElementById('atlResponse'), aRoute=document.getElementById('atlRoute');
    if(as){
      aSrc.textContent=fmtEvent(as.src,aregion);
      aResp.textContent=as.post.length?as.post.length+' evento(s) ≥M'+CFG.responseMag.toFixed(1):'Sin respuesta en '+CFG.atlanticLagH+' h';
      const list=[as.src].concat(as.post.slice(0,5));
      aRoute.innerHTML='<b>Secuencia observada:</b><br>'+list.map((e,i)=>(i?'→ ':'')+fmtEvent(e,aregion)+(i?' · +'+lag(as.src,e).toFixed(1)+' h':'')).join('<br>')+'<br><b>Nota:</b> coincidencia temporal ≠ ruta física demostrada.';
    }else{
      aSrc.textContent='Sin fuente M≥'+CFG.sourceMag.toFixed(1);
      aResp.textContent='No evaluada';
      aRoute.innerHTML='<b>Ruta:</b> sin fuente candidata en el Atlántico occidental dentro de la ventana seleccionada.';
    }
  }

  ensure();
  setTimeout(render,1800);
  setInterval(render,60000);
  document.addEventListener('change',e=>{if(e.target&&e.target.id==='window') render();});
})();