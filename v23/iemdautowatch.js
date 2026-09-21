(function(){
  const RULES_URL='iemd_auto_rules.json';
  let rulesDoc=null, autoLayer=null, visible=true, lastFingerprint='';

  function ensureCard(){
    if(document.getElementById('iemdAutoCard')) return;
    const aside=document.querySelector('aside'); if(!aside) return;
    const card=document.createElement('section');
    card.className='card'; card.id='iemdAutoCard';
    card.innerHTML=`
      <h2>IEM-D automático · fuentes globales → zona de estudio</h2>
      <div class="kpis">
        <div class="kpi"><div class="name">Fuentes detectadas</div><div class="val" id="autoSrcCount">—</div></div>
        <div class="kpi"><div class="name">Proyecciones activas</div><div class="val" id="autoActiveCount">—</div></div>
        <div class="kpi"><div class="name">Coincidencias</div><div class="val" id="autoMatchCount">—</div></div><div class="kpi"><div class="name">PM máximo</div><div class="val" id="autoPMMax">—</div></div><div class="kpi"><div class="name">σdyn proxy máx.</div><div class="val" id="autoSigmaMax" style="font-size:12px">—</div></div>
        <div class="kpi"><div class="name">Zona de estudio</div><div class="val" style="font-size:12px">EC · PE · CO</div></div><div class="kpi"><div class="name">Motor</div><div class="val" id="autoEngineState" style="font-size:12px">Esperando feeds…</div></div>
      </div>
      <div class="controls" style="margin-top:8px"><button id="autoToggle">Ocultar proyecciones automáticas</button></div>
      <div id="autoProjectionList" class="small" style="margin-top:10px">Esperando datos sísmicos…</div>
      <div class="small" style="margin-top:8px;padding:8px;border:1px solid #7549a8;border-radius:8px;background:#171020">
        <b>Lectura:</b> el motor detecta automáticamente eventos fuente globales, pero solo activa reglas congeladas cuyo destino esté en <b>Ecuador, Perú o Colombia</b>. Genera el corredor prospectivo y busca eventos receptores posteriores. Una coincidencia no demuestra transferencia física de energía. El IPD usa un PGV/σdyn proxy de primer orden para evaluar plausibilidad física relativa.
      </div>`;
    const learning=document.getElementById('learningCard');
    if(learning) learning.insertAdjacentElement('beforebegin',card);
    else {
      const iemd=document.getElementById('iemdCard');
      if(iemd) iemd.insertAdjacentElement('afterend',card); else aside.appendChild(card);
    }
    document.getElementById('autoToggle').onclick=()=>{
      visible=!visible;
      if(autoLayer&&typeof map!=='undefined'){
        if(visible) autoLayer.addTo(map); else {try{map.removeLayer(autoLayer);}catch(_){}}
      }
      document.getElementById('autoToggle').textContent=visible?'Ocultar proyecciones automáticas':'Mostrar proyecciones automáticas';
    };
  }

  function inRule(e,r){
    const b=r.source_box||{};
    if(e.lat<b.lat_min||e.lat>b.lat_max||e.mag<r.source_min_mag) return false;
    return (b.lon_ranges||[]).some(x=>e.lon>=x[0]&&e.lon<=x[1]);
  }
  function hoursSince(t){return (Date.now()-t)/3600000;}
  function endTime(src,r){return src.time+(r.window_hours||168)*3600000;}
  function clamp(v,a=0,b=100){return Math.max(a,Math.min(b,v));}
  function pmSource(e){
    const mag=clamp((e.mag-4)*28,0,100);
    const depthBonus=e.depth<=40?18:e.depth<=100?10:e.depth<=300?4:0;
    return clamp(mag+depthBonus);
  }
  function seismicMomentMw(mw){
    return Math.pow(10,1.5*mw+9.1);
  }
  function depthFactor(h){
    if(h<=50) return 1.0;
    if(h<=150) return 0.85;
    return 0.65;
  }
  function ipdPhysics(e,r){
    const R=Math.max(100,distKm(e.lat,e.lon,r.target_center[0],r.target_center[1]));
    const M0=seismicMomentMw(e.mag);
    // Proxy heurístico de PGV para comparación interna; no es registro instrumental ni GMPE validada.
    const pgv=1e-4*Math.pow(10,0.5*(e.mag-5))*Math.pow(1000/R,0.8)*Math.exp(-R/18000)*depthFactor(e.depth);
    const rho=2700, Vs=3500;
    const sigmaPa=rho*Vs*pgv;
    const sigmaKPa=sigmaPa/1000;
    // Escala IPD 0–100 basada en orden de magnitud de σdyn proxy.
    const score=clamp(25*(Math.log10(Math.max(sigmaKPa,0.01))+2),0,100);
    return {score,distance_km:R,m0_nm:M0,pgv_m_s:pgv,sigma_kpa:sigmaKPa,depth_factor:depthFactor(e.depth)};
  }
  function pmPropagation(e,r){
    return ipdPhysics(e,r).score;
  }
  function preSourceReceiver(src,r,events){
    const before=events.filter(e=>e.time<src.time&&e.time>=src.time-72*3600000&&distKm(r.target_center[0],r.target_center[1],e.lat,e.lon)<=r.target_radius_km);
    const m35=before.filter(e=>e.mag>=3.5).length;
    const m45=before.filter(e=>e.mag>=4.5).length;
    const max=before.length?Math.max(...before.map(e=>e.mag)):0;
    let raw=clamp(m35*7+m45*15+Math.max(0,max-3.5)*18,0,100);
    const backgroundPenalty=before.length>=8?0.65:before.length>=4?0.8:1;
    return {score:clamp(raw*backgroundPenalty),count:before.length,maxMag:max,penalty:backgroundPenalty};
  }
  function pmFor(src,r,events){
    const S=pmSource(src), IPD=ipdPhysics(src,r), R=preSourceReceiver(src,r,events);
    const total=clamp(0.35*S+0.25*IPD.score+0.40*R.score);
    return {source:S,propagation:IPD.score,receiver:R.score,total,receiver_meta:R,ipd:IPD};
  }
  function targetEvents(src,r,events){
    const end=endTime(src,r);
    return events.filter(e=>e.time>src.time&&e.time<=end&&e.mag>=r.receiver_min_mag&&distKm(r.target_center[0],r.target_center[1],e.lat,e.lon)<=r.target_radius_km).sort((a,b)=>a.time-b.time);
  }
  function project(events){
    if(!rulesDoc) return [];
    const allowed=new Set(rulesDoc.study_scope?.countries||['Ecuador','Perú','Colombia']);
    const usgs=events.filter(e=>e.source==='USGS');
    const out=[];
    for(const r of rulesDoc.rules||[]){
      const targets=Array.isArray(r.target_countries)?r.target_countries:[];
      if(!targets.length || !targets.some(c=>allowed.has(c))) continue;
      for(const e of usgs){
        if(!inRule(e,r)) continue;
        const age=hoursSince(e.time);
        if(age<0||age>(r.window_hours||168)) continue;
        const matches=targetEvents(e,r,events);
        const pm=pmFor(e,r,events);
        out.push({rule:r,source:e,matches,pm,expires:endTime(e,r),status:matches.length?'COINCIDENCIA':'PENDIENTE'});
      }
    }
    const uniq=[];
    const seen=new Set();
    for(const p of out.sort((a,b)=>b.source.time-a.source.time)){
      const k=p.rule.id+'|'+p.source.id;
      if(!seen.has(k)){seen.add(k);uniq.push(p);}
    }
    return uniq.slice(0,20);
  }

  function fmt(t){try{return new Intl.DateTimeFormat('es-EC',{timeZone:'America/Guayaquil',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(t));}catch(_){return new Date(t).toLocaleString();}}
  function color(s){return s==='COINCIDENCIA'?'#42b86b':'#af7cff';}
  function pmLabel(v){return v>=70?'Muy alto exp.':v>=50?'Alto exp.':v>=30?'Moderado exp.':'Bajo exp.';}
  function sigmaLabel(kpa){
    if(kpa>=10) return 'físicamente relevante como perturbación proxy';
    if(kpa>=1) return 'rango de interés experimental';
    return 'perturbación proxy baja';
  }
  function sci(n,d=2){ if(!Number.isFinite(Number(n)))return '—'; return Number(n).toExponential(d); }
  function miniBar(label,v){
    const n=clamp(Number(v)||0);
    return '<div style="margin-top:4px"><div style="display:flex;justify-content:space-between"><span>'+label+'</span><b>'+n.toFixed(0)+'</b></div><div style="height:6px;background:#142538;border-radius:999px;overflow:hidden"><div style="width:'+n+'%;height:100%;background:#8c6fd1"></div></div></div>';
  }
  function remaining(p){const h=Math.max(0,(p.expires-Date.now())/3600000);return h>=24?(h/24).toFixed(1)+' d':h.toFixed(1)+' h';}
  function mid(a,b){let l2=b[1],d=l2-a[1];if(d>180)l2-=360;if(d<-180)l2+=360;let lon=(a[1]+l2)/2;if(lon>180)lon-=360;if(lon<-180)lon+=360;return[(a[0]+b[0])/2+5,lon];}

  function render(projects){
    ensureCard();
    const srcCount=new Set(projects.map(p=>p.source.id)).size;
    const matches=projects.filter(p=>p.status==='COINCIDENCIA').length;
    const pmMax=projects.length?Math.max(...projects.map(p=>p.pm?.total||0)):0;
    const sigmaMax=projects.length?Math.max(...projects.map(p=>p.pm?.ipd?.sigma_kpa||0)):0;
    document.getElementById('autoSrcCount').textContent=srcCount;
    document.getElementById('autoActiveCount').textContent=projects.length;
    document.getElementById('autoMatchCount').textContent=matches;
    document.getElementById('autoPMMax').textContent=pmMax.toFixed(0)+'/100';
    document.getElementById('autoSigmaMax').textContent=sigmaMax.toFixed(3)+' kPa';
    document.getElementById('autoEngineState').textContent='AUTO · '+fmt(Date.now());

    const host=document.getElementById('autoProjectionList');
    host.innerHTML=projects.length?projects.map(p=>{
      const c=color(p.status), m=p.matches[0];
      return `<div style="margin:8px 0;padding:9px 10px;border-left:4px solid ${c};background:#0d1623;border-radius:8px">
        <div style="display:flex;justify-content:space-between;gap:8px"><b>${p.rule.source_label} · M${p.source.mag.toFixed(1)}</b><span style="color:${c};font-weight:800">${p.status}</span></div>
        <div>${fmt(p.source.time)} · ${p.source.depth.toFixed(0)} km · ${p.source.place||p.source.source}</div>
        <div style="margin-top:4px">→ <b>${p.rule.target_name}</b> · M≥${p.rule.receiver_min_mag.toFixed(1)} · quedan ${remaining(p)}</div>
        ${m?`<div style="margin-top:4px;color:#9fd5ad"><b>Receptor:</b> M${m.mag.toFixed(1)} · ${fmt(m.time)} · ${m.depth.toFixed(0)} km · ${m.source}</div>`:''}
        <div style="margin-top:7px;padding:7px;border:1px solid #4b3e6d;border-radius:7px;background:#161221"><b>PM experimental: ${(p.pm?.total||0).toFixed(0)}/100 · ${pmLabel(p.pm?.total||0)}</b>
          ${miniBar('Fuente',p.pm?.source)}
          ${miniBar('IPD físico',p.pm?.propagation)}
          ${miniBar('Receptor',p.pm?.receiver)}
          <div style="margin-top:5px;color:#b8cbe0"><b>Física fuente→receptor:</b><br>
          R = ${(p.pm?.ipd?.distance_km||0).toFixed(0)} km · M0 = ${sci(p.pm?.ipd?.m0_nm,2)} N·m<br>
          PGV proxy = ${sci(p.pm?.ipd?.pgv_m_s,2)} m/s · σdyn proxy = <b>${(p.pm?.ipd?.sigma_kpa||0).toFixed(3)} kPa</b><br>
          <span style="color:#9db2c8">${sigmaLabel(p.pm?.ipd?.sigma_kpa||0)} · proxy de primer orden, no medición instrumental.</span>
        </div>
        <div style="color:#9db2c8;margin-top:4px">Actividad previa receptor: ${p.pm?.receiver_meta?.count||0} eventos / 72 h · penalización fondo: ${p.pm?.receiver_meta?.penalty||1}</div>
        </div>
        <div style="color:#9db2c8;margin-top:4px">${p.rule.note}</div>
      </div>`;
    }).join(''):'<span style="color:#9db2c8">No hay eventos fuente que activen actualmente las reglas automáticas.</span>';

    if(typeof L==='undefined'||typeof map==='undefined') return;
    if(autoLayer){try{map.removeLayer(autoLayer);}catch(_){}}
    autoLayer=L.layerGroup();
    projects.forEach(p=>{
      const c=color(p.status), src=[p.source.lat,p.source.lon], dst=p.rule.target_center;
      L.circleMarker(src,{radius:7+Math.max(0,p.source.mag-4),color:'#fff',weight:1.5,fillColor:c,fillOpacity:.95})
        .bindPopup(`<b>Fuente automática IEM-D</b><br>${p.rule.source_label}<br>M${p.source.mag.toFixed(1)} · ${p.source.depth.toFixed(0)} km<br>${fmt(p.source.time)}<br><br>→ ${p.rule.target_name}<br>Ventana: ${p.rule.window_hours/24} días`)
        .addTo(autoLayer);
      const bend=mid(src,dst);
      L.polyline([src,bend,dst],{color:c,weight:Math.max(2,2+(p.pm?.total||0)/35),opacity:.75,dashArray:'8,7'})
        .bindPopup(`<b>Proyección automática experimental</b><br>${p.rule.source_label} → ${p.rule.target_name}<br>Estado: ${p.status}<br>PM: <b>${(p.pm?.total||0).toFixed(0)}/100</b> · ${pmLabel(p.pm?.total||0)}<br>Fuente ${p.pm?.source?.toFixed(0)||0} · IPD ${p.pm?.propagation?.toFixed(0)||0} · Receptor ${p.pm?.receiver?.toFixed(0)||0}<br>σdyn proxy ${(p.pm?.ipd?.sigma_kpa||0).toFixed(3)} kPa · ${sigmaLabel(p.pm?.ipd?.sigma_kpa||0)}<br>Umbral receptor: M≥${p.rule.receiver_min_mag.toFixed(1)}`)
        .addTo(autoLayer);
      L.circle(dst,{radius:p.rule.target_radius_km*1000,color:c,weight:2,fillColor:c,fillOpacity:.07,dashArray:'6,6'})
        .bindPopup(`<b>Zona receptora IEM-D</b><br>${p.rule.target_name}<br>Estado: ${p.status}<br>Ventana restante: ${remaining(p)}`)
        .addTo(autoLayer);
      p.matches.slice(0,3).forEach(m=>{
        L.circleMarker([m.lat,m.lon],{radius:6,color:'#fff',weight:1,fillColor:'#42b86b',fillOpacity:.95})
          .bindPopup(`<b>Evento receptor coincidente</b><br>M${m.mag.toFixed(1)} · ${m.depth.toFixed(0)} km<br>${fmt(m.time)} · ${m.source}<br><span style="color:#9db2c8">Coincidencia con criterio prospectivo; causalidad no demostrada.</span>`)
          .addTo(autoLayer);
      });
    });
    if(visible)autoLayer.addTo(map);
    window.mivigeAutoIEMDStats={sources:srcCount,active:projects.length,matches,pmMax,sigmaMax,scope:'Ecuador–Perú–Colombia'};
  }

  function recalc(){
    try{
      const ev=(typeof allEvents!=='undefined'&&Array.isArray(allEvents))?allEvents:[];
      if(!ev.length||!rulesDoc){ensureCard();return;}
      const projects=project(ev);
      const fp=projects.map(p=>p.rule.id+'|'+p.source.id+'|'+p.status+'|'+p.matches.length).join(';');
      if(fp!==lastFingerprint){lastFingerprint=fp;render(projects);} else {
        const st=document.getElementById('autoEngineState');if(st)st.textContent='AUTO · '+fmt(Date.now());
      }
    }catch(e){console.warn('IEM-D auto error',e);}
  }
  async function init(){
    ensureCard();
    try{
      const r=await fetch(RULES_URL+'?t='+Date.now(),{cache:'no-store'});
      if(!r.ok)throw new Error('HTTP '+r.status);
      rulesDoc=await r.json();
      recalc();
      setInterval(recalc,15000);
    }catch(e){
      document.getElementById('autoProjectionList').textContent='Reglas IEM-D automáticas no disponibles.';
    }
  }
  init();
})();