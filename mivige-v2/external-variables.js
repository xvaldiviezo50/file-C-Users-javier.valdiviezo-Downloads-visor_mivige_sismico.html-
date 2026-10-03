/* Regional activation: measured descriptors and uncalibrated physical hypotheses. */
(function(){
'use strict';
const H=3600000, esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const countries=['Chile','Perú','Ecuador','Colombia','Venezuela'];
const time=t=>Number.isFinite(t)?new Intl.DateTimeFormat('es-EC',{timeZone:'America/Guayaquil',dateStyle:'short',timeStyle:'short'}).format(new Date(t)):'sin evento en la muestra';
function render(){
 const host=document.getElementById('externalVariables'),m=window.mivigeV2;if(!host||!m)return;
 const now=m.time, rows=countries.map(country=>{
  const zones=m.states.filter(st=>st.s.country===country), unique=new Map();
  zones.forEach(st=>st.hist.forEach(e=>{if(e.mag>=3&&e.time>=now-168*H&&e.time<=now)unique.set(e.source+':'+e.id+':'+e.time,e);}));
  const events=[...unique.values()].sort((a,b)=>a.time-b.time),r24=events.filter(e=>e.time>=now-24*H),r48=events.filter(e=>e.time>=now-48*H&&e.time<now-24*H);
  return {country,zones,events,r24,r48,last:events.at(-1),max:events.length?Math.max(...events.map(e=>e.mag)):null};
 });
 host.innerHTML='<p class="small"><b>Activación sísmica regional y respuesta retardada.</b> Se examina el orden Chile → Perú → Ecuador → Colombia mediante cambios de actividad, tiempos entre eventos y compatibilidad tectónica. La rama Atlántico → Venezuela requiere identificar su fuente. La dirección se contrasta con los datos, no se impone como resultado.</p>'+
 '<div class="kpis"><div class="kpi"><div class="name">Dirección de activación · IMST</div><div class="val">'+esc(m.im?.label||'sin secuencia evaluable')+'</div></div><div class="kpi"><div class="name">Ventana observada</div><div class="val">7 días · M≥3</div></div></div>'+
 '<p class="small">Registros disponibles dentro de los segmentos del modelo; no son catálogos completos de cada país. La ausencia de registros no equivale a ausencia de actividad. Corte: '+time(now)+'.</p>'+
 '<div style="overflow:auto"><table class="table"><thead><tr><th>Segmentos de</th><th>Últimas 24 h / 24 h previas</th><th>M máxima · 7 d</th><th>Último evento</th></tr></thead><tbody>'+rows.map(r=>'<tr><td>'+r.country+'</td><td>'+r.r24.length+' / '+r.r48.length+'</td><td>'+(r.max==null?'—':r.max.toFixed(1))+'</td><td>'+time(r.last?.time)+'</td></tr>').join('')+'</tbody></table></div>'+
 '<details open><summary>Variables observables y mecanismos por contrastar</summary><ul class="small">'+
 '<li><b>Persistencia y cambio de actividad:</b> conteos 24 h frente a las 24 h previas; la prueba de tasa mantiene sus controles de cobertura y completitud.</li>'+
 '<li><b>Secuencia sur→norte:</b> orden de activación de segmentos e IMST. El componente de secuencia ya alimenta el índice experimental cuando hay datos suficientes.</li>'+
 '<li><b>Tiempo de respuesta:</b> ventanas fuente–receptor 0–6, 6–24, 24–72 h y 3–7 días del motor prospectivo. Los intervalos entre sismos describen un retardo observado; no miden por sí solos una velocidad de propagación de esfuerzos.</li>'+
 '<li><b>Actividad y liberación sísmica intermedia:</b> magnitudes y actividad de Perú/Ecuador visibles arriba; el término de atenuación del motor es una hipótesis, no una medida de esfuerzo restante ni una ley de conservación calibrada.</li>'+
 '<li><b>Estado del receptor:</b> tasa, clustering, profundidad y GNSS por zona; mecanismos/Coulomb requieren datos propios. GNSS ausente no se sustituye por cero.</li>'+
 '<li><b>Atlántico→Venezuela, 12 h:</b> hipótesis documentada, sin un sismo fuente y hora inicial identificados; no se calcula un aporte numérico.</li>'+
 '<li><b>Compatibilidad física:</b> distancia y azimut son geometría; directividad requiere ruptura/mecanismo. Coulomb requiere falla fuente y receptora. El esfuerzo residual no se obtiene restando magnitudes o conteos.</li><li><b>Contraste de capacidad predictiva:</b> comparar el orden S→N con secuencias inversas y con el fondo sísmico, registrar aciertos, omisiones y falsas alarmas con reglas fijadas antes del evento. Los pesos se revisan con evaluación fuera de muestra.</li></ul></details>'+
 '<p class="small"><b>Estado:</b> descriptores calculados con el catálogo disponible; transferencia y atenuación regional pendientes de contraste físico y estadístico. Estas variables permanecen en evaluación experimental y no sustituyen GNSS/InSAR ausentes.</p>';
}
window.addEventListener('mivige:model',render);render();
})();
