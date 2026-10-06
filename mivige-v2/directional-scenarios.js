/* Directional scenarios v3: frozen external hypotheses; no contribution to scientific ICM. */
(function(root){
'use strict';
function current(){
 const m=root.mivigeMigrationExperimental;
 const west=m?.corridors?.west||null,caribbean=m?.corridors?.caribbean||null;
 return {
  version:'3.0',
  physicalDirection:null,
  forecastEnabled:false,
  available:!!m,
  continuation:null,local:null,reverse:null,
  corridors:{west,caribbean},
  hypotheses:m?.externalHypotheses||[],
  convergenceObserved:!!(west?.coherence?.coherent&&caribbean?.coherence?.coherent),
  reason:m?'Corredores experimentales evaluados por separado; causalidad física no inferida.':'Esperando catálogos para evaluar corredores.'
 };
}
function assess(){return current();}
root.MivigePattern={assess,current};
if(typeof module!=='undefined')module.exports={assess,current};
if(typeof document==='undefined')return;
const card=document.createElement('section');card.className='card';card.id='directionalScenarios';
card.innerHTML='<h2>Dirección y mecanismos físicos · investigación</h2><div id="directionalScenarioBody"></div>';
document.getElementById('migrationExperimental')?.closest('section')?.insertAdjacentElement('afterend',card);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function stateLine(s){
 if(!s)return'Datos insuficientes.';
 const c=s.coherence||{};
 return (c.coherent?'coherencia cronológica experimental':'sin coherencia direccional suficiente')+' · '+(c.label||'')+' · eventos '+(s.events?.length||0)+' · pares '+(s.pairs?.length||0)+(Number.isFinite(c.spread)?' · dispersión '+c.spread.toFixed(0)+'°':'');
}
function render(){
 const p=current(),host=document.getElementById('directionalScenarioBody');if(!host)return;
 host.innerHTML='<p><b>Dirección física: sin determinar.</b> El seguimiento experimental ahora separa dos hipótesis congeladas y mide orden temporal, azimut, profundidad y velocidad aparente. Ninguna selecciona automáticamente la siguiente zona ni activa el semáforo científico.</p>'+
 '<table class="table"><thead><tr><th>Hipótesis congelada</th><th>Estado observacional</th></tr></thead><tbody>'+
 '<tr><td><b>P-EXT-COL-ECU-06OCT-2026-01</b><br><small>Occidente Ecuador–Colombia · dos frentes externos en seguimiento.</small></td><td>'+esc(stateLine(p.corridors.west))+'</td></tr>'+
 '<tr><td><b>P-EXT-CARIBE-06OCT-2026-01</b><br><small>La Española–Venezuela–Caribe/norte de Colombia.</small></td><td>'+esc(stateLine(p.corridors.caribbean))+'</td></tr></tbody></table>'+
 (p.convergenceObserved?'<p><b>Convergencia visual experimental:</b> ambos corredores muestran continuidad cronológica bajo los umbrales exploratorios. Esto no demuestra convergencia de esfuerzos ni transferencia causal.</p>':'<p class="small">No hay convergencia observacional simultánea suficiente en ambos corredores bajo los criterios congelados.</p>')+
 '<table class="table"><thead><tr><th>Mecanismo investigable</th><th>Qué falta calcular</th></tr></thead><tbody>'+
 '<tr><td>Transferencia estática de esfuerzos · Coulomb</td><td>Geometría y deslizamiento de la ruptura, orientación de fallas receptoras y sensibilidad a incertidumbres. No calculado.</td></tr>'+
 '<tr><td>Deslizamiento lento / deformación transitoria</td><td>GNSS/InSAR reciente y coherente en varias estaciones, corregido por efectos no tectónicos; inversión de deslizamiento. No determinado.</td></tr>'+
 '<tr><td>Activación dinámica</td><td>Ondas registradas y esfuerzo dinámico en el receptor. La secuencia temporal, distancia o antípoda no bastan.</td></tr>'+
 '<tr><td>ETAS / tasa y estado</td><td>Tasa esperada calibrada y significancia para distinguir fondo, réplicas y exceso real. El baseline de 6 días del visor es solo un tamiz.</td></tr></tbody></table>'+
 '<p class="small">Ningún mecanismo físico queda confirmado por esta capa. Persistencia local o una secuencia ordenada no mide energía acumulada ni identifica un precursor. IDS, IDG, IITE e IADR mantienen evaluación independiente.</p>';
}
root.addEventListener('mivige:prospective',render);root.addEventListener('mivige:model',render);root.addEventListener('mivige:migration-experimental',render);render();
})(typeof window!=='undefined'?window:globalThis);