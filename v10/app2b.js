function computeAzuayIntraslab(events,hours){
 const cutoff=Date.now()-hours*3600000;
 const z=zonesEc.find(x=>x.id==='azuay');
 const ins=events.filter(e=>e.time>=cutoff && distKm(z.lat,z.lon,e.lat,e.lon)<=z.radius && e.depth>=70 && e.depth<=120);
 ins.sort((a,b)=>b.time-a.time);
 const recent24=ins.filter(e=>Date.now()-e.time<=24*3600000);
 const prev24=ins.filter(e=>Date.now()-e.time>24*3600000 && Date.now()-e.time<=48*3600000);
 const maxMag=ins.length?Math.max(...ins.map(e=>e.mag)):0;
 const count35=ins.filter(e=>e.mag>=3.5).length;
 const trend=recent24.length>prev24.length && recent24.length>=2?'↑ aumentando':recent24.length<prev24.length?'↓ decayendo':'→ estable';
 let state='Sin señal intraslab reciente';
 let level='none';
 let scenario='Sin secuencia intraslab relevante en la ventana.';
 if(ins.length){
   state='Vigilancia puntual baja–moderada'; level='spot';
   scenario='Escenario dominante: evento aislado o réplicas menores dentro de la placa subducida.';
 }
 if(maxMag>=4.5 || ins.length>=3 || (count35>=2 && recent24.length>=2)){
   state='Vigilancia intraslab elevada'; level='active';
   scenario='Cambio material: clustering/aumento de magnitud intraslab; revisar migración hipocentral y mecanismos.';
 }
 return {events:ins,recent24,prev24,maxMag,count35,trend,state,level,scenario,last:ins[0]||null};
}
function renderAzuayIntraslab(w){
 document.getElementById('azuayState').textContent=w.state;
 document.getElementById('azuayCount').textContent=String(w.events.length);
 document.getElementById('azuayTrend').textContent=w.trend;
 document.getElementById('azuayLast').textContent=w.last?`M${w.last.mag.toFixed(1)} · ${w.last.depth.toFixed(0)} km · ${ecuTime(w.last.time)}`:'—';
 document.getElementById('azuayExplain').innerHTML=w.scenario+' <b>Regla:</b> elevar si M≥4.5, ≥3 eventos 70–120 km, o ≥2 M≥3.5 con concentración reciente.';
}
function renderSpotWatches(internal,external,azuay,iaex){
 const items=[];
 if(azuay.level==='spot' && azuay.last){ items.push({name:'Azuay–Cuenca · intraslab',text:`${azuay.state}. Último: M${azuay.last.mag.toFixed(1)} a ${azuay.last.depth.toFixed(0)} km. ${azuay.scenario}`}); }
 const pool=[...internal,...external];
 pool.forEach(z=>{
   if(isActiveZone(z,iaex)) return;
   const last=z.inside.filter(e=>e.mag>=3.5).sort((a,b)=>b.time-a.time)[0];
   if(last && Date.now()-last.time<=24*3600000) items.push({name:z.name,text:`Evento reciente M${last.mag.toFixed(1)} a ${last.depth.toFixed(0)} km, pero sin clustering/score suficiente para vigilancia alta.`});
 });
 document.getElementById('spotWatches').innerHTML=items.length?items.slice(0,6).map(x=>`<div class="listitem"><div class="dot" style="background:#52a8ff"></div><div><div class="zname">${x.name}</div><div class="zdesc">${x.text}</div></div><div class="pct" style="color:#9bd4ff">Puntual</div></div>`).join(''):'<div class="small">Sin señales puntuales adicionales.</div>';
}
function renderActiveZones(internal, external, iaex){
 const active=[...internal.map(z=>({...z,scope:'Ecuador'})),...external.map(z=>({...z,scope:'Regional'}))]
   .filter(z=>isActiveZone(z,iaex))
   .sort((a,b)=>b.opScore-a.opScore);
 const host=document.getElementById('zonesActive');
 if(!active.length){
   host.innerHTML='<div class="small">No hay zonas que superen actualmente el umbral de vigilancia activa.</div>';
 }else{
   host.innerHTML='';
   active.forEach(z=>{
     const c=riskColor(z.opScore);
     const lvl=z.opScore>=70?'Muy alta':z.opScore>=50?'Alta':'Moderada';
     host.insertAdjacentHTML('beforeend',`<div class="listitem"><div class="dot" style="background:${c}"></div><div><div class="zname">${z.name}</div><div class="zdesc">${z.scope} · ${activeReason(z,iaex)}<br>Tendencia: ${z.trendScore} · Omori/ETAS: ${z.etas}</div></div><div class="pct">${lvl}</div></div>`);
   });
 }
 const inactive=[...internal.map(z=>({...z,scope:'Ecuador'})),...external.map(z=>({...z,scope:'Regional'}))]
   .filter(z=>!isActiveZone(z,iaex));
 const bg=document.getElementById('zonesBackground');
 bg.innerHTML=inactive.map(z=>`<div class="listitem"><div class="dot" style="background:#46647e"></div><div><div class="zname">${z.name}</div><div class="zdesc">${z.scope} · sin señal operativa alta actual</div></div><div class="pct" style="color:#9db2c8">Base</div></div>`).join('') || '<div class="small">Todas las zonas monitoreadas están activas.</div>';
}
function renderZones(list, targetId, mode='internal'){
 const host=document.getElementById(targetId); host.innerHTML='';
 list.forEach(z=>{
   const color=riskColor(mode==='internal'?z.pct*1.7:z.opScore);
   const badge = mode==='internal' ? `${z.pct.toFixed(1)}%` : levelFromScore(z.opScore);
   const desc = mode==='internal' ? z.why : `${z.why} · ${z.trendScore}`;
   host.insertAdjacentHTML('beforeend', `<div class="listitem"><div class="dot" style="background:${color}"></div><div><div class="zname">${z.name}</div><div class="zdesc">${desc}<br>Actividad: ${levelFromScore(z.observedScore)} · Omori/ETAS: ${z.etas}</div></div><div class="pct">${badge}</div></div>`);
 });
}