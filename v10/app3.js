function renderMap(internal, external, regionalEvents, iaex){
 eventLayer.clearLayers(); eqZoneLayer.clearLayers(); extZoneLayer.clearLayers(); iaexLayer.clearLayers();
 internal.forEach(z=>{
   const active=isActiveZone(z,iaex);
   const c=active?riskColor(z.opScore):'#587087';
   L.circle([z.lat,z.lon],{radius:z.radius*1000,color:c,weight:active?2:1,fillColor:c,fillOpacity:active?.13:.025,dashArray:active?'4 6':'2 10'})
   .bindTooltip(`${z.name}: ${active?'vigilancia activa':'zona base sin señal alta'}`) .addTo(eqZoneLayer);
 });
 external.forEach(z=>{
   const active=isActiveZone(z,iaex);
   const c=active?riskColor(z.opScore):'#587087';
   L.circle([z.lat,z.lon],{radius:z.radius*1000,color:c,weight:active?1.8:1,fillColor:c,fillOpacity:active?.09:.02,dashArray:active?'2 7':'2 10'})
   .bindTooltip(`${z.name}: ${active?levelFromScore(z.opScore):'zona base sin señal alta'}`) .addTo(extZoneLayer);
 });
 regionalEvents.forEach(e=>{
   const r=Math.max(4,Math.min(15,3+e.mag*1.7));
   L.circleMarker([e.lat,e.lon],{radius:r,color:tectonicColor(e),weight:2.5,fillColor:magColor(e.mag),fillOpacity:.9})
   .bindPopup(`<b>${e.source}</b><br>M ${e.mag.toFixed(1)} · ${e.depth.toFixed(0)} km<br><b>Clasificación preliminar:</b> ${tectonicClass(e)}<br>${ecuTime(e.time)} ECU<br>${e.place||''}`)
   .addTo(eventLayer);
 });
 footprints.forEach(fp=>{
   L.circle([fp.lat,fp.lon],{radius:fp.radius*1000,color:fp.color,weight:1,fill:false,dashArray:'6 6'}).bindTooltip(fp.name).addTo(iaexLayer);
 });
 const lead=iaex.cases[0];
 if(lead){
   L.circleMarker([lead.source.lat,lead.source.lon],{radius:8,color:'#2f001f',weight:1,fillColor:'#ff56a8',fillOpacity:.95}).bindPopup(`<b>Evento fuente IAEX</b><br>M ${lead.source.mag.toFixed(1)} · ${lead.source.place||lead.source.source}`).addTo(iaexLayer);
   L.circleMarker([lead.anti.lat,lead.anti.lon],{radius:7,color:'#2a1140',weight:1,fillColor:'#af7cff',fillOpacity:.95}).bindPopup(`<b>Antípoda exacta</b><br>${lead.anti.lat.toFixed(2)}, ${lead.anti.lon.toFixed(2)}`).addTo(iaexLayer);
   L.circle([lead.anti.lat,lead.anti.lon],{radius:300000,color:'#af7cff',weight:1,fill:false}).addTo(iaexLayer);
   L.circle([lead.anti.lat,lead.anti.lon],{radius:750000,color:'#d3b1ff',weight:1,fill:false,dashArray:'5 5'}).addTo(iaexLayer);
   L.polyline([[lead.source.lat,lead.source.lon],[lead.anti.lat,lead.anti.lon],[lead.zone.lat,lead.zone.lon]],{color:'#cf80ff',weight:2,dashArray:'6 6'}).addTo(iaexLayer);
 }
}
function updateSources(){
 const d=document.getElementById('sources'); d.innerHTML='';
 for(const [name,s] of Object.entries(sourceStatus)){
   d.insertAdjacentHTML('beforeend', `<div class="statusrow"><span>${name}</span><span class="${s.ok?'ok':'bad'}">${s.ok?'✓ '+s.count+' registros':'✕ no disponible'}</span></div>`);
 }
}
function agentState(){
 try{return JSON.parse(localStorage.getItem('mivigeAgentState')||'{}');}catch{return {}};
}
function saveAgentState(obj){ localStorage.setItem('mivigeAgentState', JSON.stringify(obj)); }
function pushAgentLog(text, level='blue'){
 const state=agentState(); const log=state.log||[]; log.unshift({time:Date.now(), text, level}); state.log=log.slice(0,25); saveAgentState(state);
}
function renderAgentLog(){
 const state=agentState(); const log=state.log||[]; const d=document.getElementById('agentLog');
 d.innerHTML = log.length ? log.map(x=>`<div class="entry"><span class="pill ${x.level}">${ecuTime(x.time)}</span>${x.text}</div>`).join('') : '<div class="entry">Sin decisiones registradas todavía.</div>';
}