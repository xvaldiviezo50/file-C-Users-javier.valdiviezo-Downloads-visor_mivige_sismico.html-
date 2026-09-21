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
        <div class="kpi"><div class="name">Coincidencias</div><div class="val" id="autoMatchCount">—</div></div>
        <div class="kpi"><div class="name">Zona de estudio</div><div class="val" style="font-size:12px">EC · PE · CO</div></div><div class="kpi"><div class="name">Motor</div><div class="val" id="autoEngineState" style="font-size:12px">Esperando feeds…</div></div>
      </div>
      <div class="controls" style="margin-top:8px"><button id="autoToggle">Ocultar proyecciones automáticas</button></div>
      <div id="autoProjectionList" class="small" style="margin-top:10px">Esperando datos sísmicos…</div>
      <div class="small" style="margin-top:8px;padding:8px;border:1px solid #7549a8;border-radius:8px;background:#171020">
        <b>Lectura:</b> el motor detecta automáticamente eventos fuente globales, pero solo activa reglas congeladas cuyo destino esté en <b>Ecuador, Perú o Colombia</b>. Genera el corredor prospectivo y busca eventos receptores posteriores. Una coincidencia no demuestra transferencia física de energía.
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
        out.push({rule:r,source:e,matches,expires:endTime(e,r),status:matches.length?'COINCIDENCIA':'PENDIENTE'});
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
  function remaining(p){const h=Math.max(0,(p.expires-Date.now())/3600000);return h>=24?(h/24).toFixed(1)+' d':h.toFixed(1)+' h';}
  function mid(a,b){let l2=b[1],d=l2-a[1];if(d>180)l2-=360;if(d<-180)l2+=360;let lon=(a[1]+l2)/2;if(lon>180)lon-=360;if(lon<-180)lon+=360;return[(a[0]+b[0])/2+5,lon];}

  function render(projects){
    ensureCard();
    const srcCount=new Set(projects.map(p=>p.source.id)).size;
    const matches=projects.filter(p=>p.status==='COINCIDENCIA').length;
    document.getElementById('autoSrcCount').textContent=srcCount;
    document.getElementById('autoActiveCount').textContent=projects.length;
    document.getElementById('autoMatchCount').textContent=matches;
    document.getElementById('autoEngineState').textContent='AUTO · '+fmt(Date.now());

    const host=document.getElementById('autoProjectionList');
    host.innerHTML=projects.length?projects.map(p=>{
      const c=color(p.status), m=p.matches[0];
      return `<div style="margin:8px 0;padding:9px 10px;border-left:4px solid ${c};background:#0d1623;border-radius:8px">
        <div style="display:flex;justify-content:space-between;gap:8px"><b>${p.rule.source_label} · M${p.source.mag.toFixed(1)}</b><span style="color:${c};font-weight:800">${p.status}</span></div>
        <div>${fmt(p.source.time)} · ${p.source.depth.toFixed(0)} km · ${p.source.place||p.source.source}</div>
        <div style="margin-top:4px">→ <b>${p.rule.target_name}</b> · M≥${p.rule.receiver_min_mag.toFixed(1)} · quedan ${remaining(p)}</div>
        ${m?`<div style="margin-top:4px;color:#9fd5ad"><b>Receptor:</b> M${m.mag.toFixed(1)} · ${fmt(m.time)} · ${m.depth.toFixed(0)} km · ${m.source}</div>`:''}
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
      L.polyline([src,bend,dst],{color:c,weight:3,opacity:.75,dashArray:'8,7'})
        .bindPopup(`<b>Proyección automática experimental</b><br>${p.rule.source_label} → ${p.rule.target_name}<br>Estado: ${p.status}<br>Umbral receptor: M≥${p.rule.receiver_min_mag.toFixed(1)}`)
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
    window.mivigeAutoIEMDStats={sources:srcCount,active:projects.length,matches,scope:'Ecuador–Perú–Colombia'};
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