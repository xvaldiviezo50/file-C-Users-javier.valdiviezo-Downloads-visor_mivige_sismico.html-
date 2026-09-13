function runAgent(internal, external, regional, iaex){
 const state=agentState();
 const prevTop=state.topZoneId || null;
 const prevSem=state.semaforo || null;
 const activeInternal=internal.filter(z=>isActiveZone(z,iaex));
 const activeExternal=external.filter(z=>isActiveZone(z,iaex));
 const top=activeInternal[0] || internal[0];
 const topExternal=activeExternal[0] || null;
 const maxRegionalMag = regional.length ? Math.max(...regional.map(e=>e.mag)) : 0;
 const seismicFamilyActive = activeInternal.length>0 || activeExternal.length>0 || maxRegionalMag>=5;
 let sem = seismicFamilyActive ? 'AMARILLO · 1 familia: sismicidad' : 'VERDE · sin anomalía multimétodo';
 let semClass=seismicFamilyActive?'#6b5715':'#174f2c';
 document.getElementById('semaforo').textContent=sem;
 document.getElementById('semaforo').style.background=semClass;
 document.getElementById('agentChampion').textContent='Champion activo';
 document.getElementById('agentChallenger').textContent=state.challenger || 'Sin challenger';
 let decision = activeInternal.length ? `Priorizar ${top.name}` : 'Sin zona ecuatoriana en vigilancia alta';
 if(topExternal && topExternal.opScore>=50) decision += ` + control externo ${topExternal.name}`;
 if(iaex.cases[0] && iaex.cases[0].score>=35) decision += ' · abrir vigilancia IAEX';
 document.getElementById('agentDecision').textContent=decision;
 document.getElementById('iite').textContent = 'No calculado · requiere mecanismo/Coulomb';
 document.getElementById('iem').textContent = top.trendScore==='↑ aumentando' ? 'Ventana prospectiva sugerida' : 'En seguimiento';
 document.getElementById('iaex').textContent = iaex.status;
 document.getElementById('iaexWindow').textContent = iaex.window;
 const topId=activeInternal.length?top.id:null;
 const stateChanged = prevTop!==topId || prevSem!==sem || maxRegionalMag>=5 || (iaex.cases[0] && iaex.cases[0].score>=35);
 if(stateChanged){
   let msg = `Decisión: ${decision}.`;
   if(activeInternal.length) msg += ` Zona líder Ecuador: <b>${top.name}</b> (${top.pct.toFixed(1)}% de la señal ecuatoriana reciente).`;
   if(topExternal) msg += ` Control externo: <b>${topExternal.name}</b> (${levelFromScore(topExternal.opScore)}).`;
   if(iaex.cases[0]) msg += ` IAEX: ${iaex.cases[0].zone.name}, score ${iaex.cases[0].score.toFixed(1)}, distancia antipodal ${Math.round(iaex.cases[0].distance)} km.`;
   pushAgentLog(msg, sem.startsWith('ROJO')?'red':sem.startsWith('NARANJA')?'orange':'blue');
 }
 state.topZoneId=topId; state.semaforo=sem; state.lastDecision=decision; state.lastCut=Date.now(); state.champion='MIVIGE Agent v1.3 – Champion'; saveAgentState(state);
 renderAgentLog();
}
function render(all){
 const hours=Number(document.getElementById('window').value);
 const minmag=Number(document.getElementById('minmag').value);
 const cutoff=Date.now()-hours*3600000;
 const tectFilter=document.getElementById('tectonicFilter').value;
 const regionalAll = all.filter(e=>e.time>=cutoff && e.mag>=minmag && e.lat>=-35 && e.lat<=20 && e.lon>=-111 && e.lon<=-70);
 const regional = regionalAll.filter(e=>tectFilter==='all' || tectonicFamily(e)===tectFilter);
 const internal = computeInternalPercentages(zonesEc.map(z=>computeZonePackage(z, all.filter(e=>e.time>=cutoff), hours)));
 const external = computeExternal(zonesExt.map(z=>computeZonePackage(z, all.filter(e=>e.time>=cutoff), hours)));
 const idsRaw=regionalAll.reduce((s,e)=>s+eventContribution(e,hours),0);
 const ids=Math.min(100,Math.round(100*(1-Math.exp(-idsRaw/12))));
 document.getElementById('ids').textContent = ids+'/100';
 const global7 = all.some(e=>e.source==='USGS' && e.time>=cutoff && e.mag>=7);
 document.getElementById('iadr').textContent = global7 ? 'Evento fuente global detectado · respuesta local no confirmada' : 'Sin activación remota confirmada';
 const iaex = computeIAEX(all, hours);
 const azuayWatch=computeAzuayIntraslab(all,hours);
 if(azuayWatch.level==='active'){ const az=internal.find(z=>z.id==='azuay'); if(az) az.opScore=Math.max(az.opScore,55); }
 renderAzuayIntraslab(azuayWatch);
 renderActiveZones(internal, external, iaex);
 renderSpotWatches(internal,external,azuayWatch,iaex);
 renderMap(internal, external, regional, iaex);
 const rows = regional.slice(0,22).map(e=>`<tr><td>${ecuTime(e.time)}</td><td><b>${e.mag.toFixed(1)}</b></td><td>${e.depth.toFixed(0)} km</td><td>${tectonicClass(e)}</td><td>${e.source}</td></tr>`).join('');
 document.getElementById('events').innerHTML = rows || '<tr><td colspan="5">Sin eventos que cumplan el filtro.</td></tr>';
 runAgent(internal, external, regional, iaex);
}
async function refresh(){
 document.getElementById('refresh').disabled=true; document.getElementById('refresh').textContent='Actualizando…';
 const parts = await Promise.all(Object.entries(endpoints).map(([n,u])=>fetchSource(n,u)));
 allEvents = dedupe(parts.flat());
 document.getElementById('cut').textContent = fmtFull(Date.now());
 refreshAt = Date.now()+3600000;
 render(allEvents); updateSources();
 document.getElementById('refresh').disabled=false; document.getElementById('refresh').textContent='Actualizar ahora';
}
function tick(){ const left=Math.max(0,refreshAt-Date.now()); const m=Math.floor(left/60000), s=Math.floor((left%60000)/1000); document.getElementById('next').textContent=`${m}m ${String(s).padStart(2,'0')}s`; }

document.getElementById('refresh').onclick=refresh;
document.getElementById('window').onchange=()=>render(allEvents);
document.getElementById('minmag').onchange=()=>render(allEvents);
document.getElementById('tectonicFilter').onchange=()=>render(allEvents);
setInterval(tick,1000); setInterval(refresh,3600000);
const legend=L.control({position:'bottomleft'});
legend.onAdd=()=>{const d=L.DomUtil.create('div','legend'); d.innerHTML=`<b>Magnitud (relleno)</b><br><i style="background:#42b86b"></i>M&lt;3 <i style="background:#f0c644"></i>M3–3.9 <i style="background:#f08a24"></i>M4–4.9 <i style="background:#e4493f"></i>M5+<br><b>Tipo tectónico (borde)</b><br><i style="background:#f0c644"></i>Cortical <i style="background:#f08a24"></i>Interfaz/somero costero<br><i style="background:#52a8ff"></i>Intermedio <i style="background:#af7cff"></i>Intraslab<br><span style="color:#9db2c8">Círculos discontinuos = zonas MIVIGE</span><br><span style="color:#d3b1ff">Morado = IAEX experimental</span>`; return d; };
legend.addTo(map);
const overlays={"Sismos recientes":eventLayer,"Zonas Ecuador":eqZoneLayer,"Controles externos":extZoneLayer,"IAEX antípodas":iaexLayer,"Placas tectónicas":plateLayer};
L.control.layers({},overlays,{collapsed:false,position:'topright'}).addTo(map);
renderAgentLog(); loadPlates(); refresh();