(function(){
  const CFG={
    id:'MIVIGE-RTD-v38',
    screeningMag:5.0,
    responseMag:3.0,
    maxLagHours:72,
    basis:'Redistribución de esfuerzos (Coulomb) + disparo dinámico por ondas sísmicas',
    status:'experimental'
  };

  const BOX={
    chile:[-56,-17,-76,-66],
    peru:[-19.5,0,-82,-68],
    ecuador:[-5.2,2.2,-81.6,-75.0],
    colombia:[-4.5,13.5,-79.5,-66.5],
    centroamerica:[7,19,-93,-77]
  };
  const ORDER=['chile','peru','ecuador','colombia','centroamerica'];
  const LABEL={chile:'Chile',peru:'Perú',ecuador:'Ecuador',colombia:'Colombia',centroamerica:'Centroamérica'};

  function inBox(e,b){
    const lat=Number(e&&e.lat), lon=Number(e&&(e.lon??e.lng));
    return Number.isFinite(lat)&&Number.isFinite(lon)&&lat>=b[0]&&lat<=b[1]&&lon>=b[2]&&lon<=b[3];
  }
  function regionOf(e){
    return ORDER.find(k=>inBox(e,BOX[k]))||null;
  }
  function hoursSelected(){
    const el=document.getElementById('window');
    const h=Number(el&&el.value);
    return Number.isFinite(h)?h:72;
  }
  function fmtEvent(e){
    if(!e) return '—';
    const r=regionOf(e);
    const t=new Date(Number(e.time));
    return 'M'+Number(e.mag).toFixed(1)+' · '+(r?LABEL[r]:'fuera del corredor')+' · '+Math.round(Number(e.depth||0))+' km · '+t.toLocaleString('es-EC',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});
  }
  function magClass(m){
    if(m>=7) return 'fuente grande: evaluar disparo remoto';
    if(m>=6.5) return 'candidato fuerte para análisis dinámico';
    if(m>=5) return 'tamiz MIVIGE experimental; causalidad remota no inferible';
    return 'sin fuente de tamiz';
  }
  function depthClass(d){
    d=Number(d||0);
    if(d<35) return 'cortical';
    if(d<70) return 'intermedia';
    return 'profunda/intraslab';
  }
  function ensure(){
    if(document.getElementById('stressTransferCard')) return;
    const aside=document.querySelector('aside'); if(!aside) return;
    const card=document.createElement('section');
    card.className='card'; card.id='stressTransferCard';
    card.innerHTML=`<h2>🧪 Redistribución de esfuerzos / acomodación tectónica</h2>
      <div class="small"><b>Regla MIVIGE:</b> esta capa <b>no se activa por publicaciones</b>. Evalúa si los datos observados son compatibles con mecanismos físicos conocidos: cambio de esfuerzo de Coulomb y/o disparo dinámico por ondas sísmicas.<br>
      <b>Tamiz:</b> fuentes M≥${CFG.screeningMag.toFixed(1)}; respuestas M≥${CFG.responseMag.toFixed(1)} dentro de hasta ${CFG.maxLagHours} h. El umbral M5 es operacional/experimental, no un umbral físico universal.</div>
      <div class="kpis" style="margin-top:8px">
        <div class="kpi"><div class="name">Fuente candidata</div><div class="val" id="stSource">—</div></div>
        <div class="kpi"><div class="name">Respuesta regional</div><div class="val" id="stResponse">—</div></div>
        <div class="kpi"><div class="name">Compatibilidad física</div><div class="val" id="stCompat">—</div></div>
        <div class="kpi"><div class="name">Causalidad</div><div class="val" id="stCausal">No demostrada</div></div>
      </div>
      <div class="small" id="stPath" style="margin-top:8px">—</div>
      <div class="small" id="stAssessment" style="margin-top:8px">—</div>
      <details style="margin-top:8px"><summary>Qué exige MIVIGE para subir el nivel de evidencia</summary>
        <div class="small" style="margin-top:6px">
        1) mecanismo focal/geométrico compatible; 2) cambio de tasa por encima del fondo/ETAS; 3) secuencia espacio-temporal no explicada solo por réplicas locales; 4) cálculo Coulomb cuando la distancia y geometría lo permitan; 5) para hipótesis regionales, corroboración geodésica GNSS/InSAR y/o evidencia de esfuerzo dinámico. Sin estas condiciones, una coincidencia temporal permanece experimental.
        </div>
      </details>
      <div class="small" style="margin-top:8px;color:#7894ac"><b>Base científica:</b> el esfuerzo estático puede favorecer o inhibir fallas cercanas según geometría; las ondas sísmicas pueden producir disparo dinámico remoto bajo ciertas condiciones. Ninguno de estos mecanismos establece una ruta determinista Chile→Perú→Ecuador→Colombia ni permite predecir fecha, lugar y magnitud.</div>`;
    const exp=[...document.querySelectorAll('section.card h2')].find(h=>/CAPA B/.test(h.textContent));
    if(exp) exp.parentElement.insertAdjacentElement('afterend',card); else aside.insertBefore(card,aside.firstChild);
  }

  function render(){
    ensure();
    let ev=[]; try{if(Array.isArray(allEvents)) ev=allEvents;}catch(_){}
    const now=Date.now(), h=hoursSelected(), t0=now-h*3600e3;
    const corridor=ev.filter(e=>Number(e.time)>=t0 && regionOf(e));
    const sources=corridor.filter(e=>Number(e.mag)>=CFG.screeningMag).sort((a,b)=>Number(b.time)-Number(a.time));
    const src=sources[0]||null;

    const sourceEl=document.getElementById('stSource');
    const respEl=document.getElementById('stResponse');
    const compatEl=document.getElementById('stCompat');
    const causalEl=document.getElementById('stCausal');
    const pathEl=document.getElementById('stPath');
    const assessEl=document.getElementById('stAssessment');
    if(!sourceEl) return;

    if(!src){
      sourceEl.textContent='Sin M≥'+CFG.screeningMag.toFixed(1)+' en '+h+' h';
      respEl.textContent='No evaluada';
      compatEl.textContent='Sin señal';
      causalEl.textContent='No demostrada';
      pathEl.innerHTML='<b>Secuencia:</b> no hay fuente candidata en el corredor monitoreado.';
      assessEl.innerHTML='<b>Evaluación:</b> no se activa la hipótesis de redistribución regional.';
      return;
    }

    const sr=regionOf(src), st=Number(src.time), end=Math.min(now,st+CFG.maxLagHours*3600e3);
    const post=corridor.filter(e=>Number(e.time)>st && Number(e.time)<=end && Number(e.mag)>=CFG.responseMag && regionOf(e)!==sr)
      .sort((a,b)=>Number(a.time)-Number(b.time));

    const uniq=[...new Set(post.map(regionOf))];
    const mainResp=post.slice().sort((a,b)=>Number(b.mag)-Number(a.mag))[0]||null;
    const sourceDepth=depthClass(src.depth);
    const sameDepth=post.filter(e=>depthClass(e.depth)===sourceDepth).length;
    const adjacent=post.filter(e=>{
      const a=ORDER.indexOf(sr), b=ORDER.indexOf(regionOf(e));
      return a>=0&&b>=0&&Math.abs(a-b)===1;
    }).length;

    let compat='Temporal únicamente';
    if(Number(src.mag)>=6.5 && post.length && (adjacent>0||sameDepth>0)) compat='Candidato a disparo/redistribución';
    else if(post.length && (adjacent>0||sameDepth>0)) compat='Compatibilidad parcial';
    if(Number(src.mag)>=7 && post.length>=2 && uniq.length>=2) compat='Compatibilidad observacional reforzada';

    sourceEl.textContent=fmtEvent(src);
    respEl.textContent=post.length?post.length+' evento(s) · '+uniq.map(k=>LABEL[k]).join(', '):'Sin respuesta ≥M'+CFG.responseMag.toFixed(1);
    compatEl.textContent=compat;
    causalEl.textContent='No demostrada';

    const path=[fmtEvent(src)].concat(post.slice(0,5).map(fmtEvent));
    pathEl.innerHTML='<b>Secuencia observada (no causal):</b><br>'+path.map((x,i)=>(i?'→ ':'')+x).join('<br>');

    let msg='La fuente '+magClass(Number(src.mag))+'. ';
    if(post.length){
      msg+='Hay actividad posterior en otros segmentos del corredor dentro de '+CFG.maxLagHours+' h. ';
      if(adjacent) msg+='Existe continuidad geográfica adyacente en '+adjacent+' evento(s). ';
      if(sameDepth) msg+='Hay '+sameDepth+' respuesta(s) de clase de profundidad semejante. ';
      msg+='Esto justifica mantener la hipótesis bajo vigilancia, pero no prueba que el sismo fuente haya transferido energía o esfuerzo hasta esos eventos.';
    }else{
      msg+='No se observa una respuesta regional que sostenga la hipótesis en la ventana actual.';
    }
    assessEl.innerHTML='<b>Evaluación:</b> '+msg;
  }

  ensure();
  setTimeout(render,1800);
  setInterval(render,60000);
  document.addEventListener('change',e=>{if(e.target&&e.target.id==='window') render();});
})();