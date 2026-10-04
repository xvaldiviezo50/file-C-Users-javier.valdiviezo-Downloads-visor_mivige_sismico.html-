/* Automatic physical/geodynamic evidence monitor. Scientific track only; never changes experimental V1. */
(function(){'use strict';
const card=document.createElement('section');card.className='card';card.id='physicalWindows';
card.innerHTML='<h2>Contraste automático · física y geodinámica</h2><p class="small"><b>Sin ingreso manual.</b> Esta pista científica lee automáticamente la evidencia disponible del visor. Coulomb permanece separado del patrón experimental V1 y solo se considera evaluable cuando existen insumos físicos suficientes; N/A nunca equivale a cero.</p><div id="pwAuto"></div><p class="small">La validación prospectiva operativa (M≥4,5 y M≥6,0; 24/72 h) se abre y contrasta automáticamente en el módulo de seguimiento. Esta tarjeta no modifica puntajes, niveles ni pesos de V1.</p>';
const aside=document.querySelector('aside');if(!aside)return;aside.appendChild(card);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function render(){
 const states=window.mivigeV2?.states||[],cs=window.mivigeCoulomb||{};
 if(!states.length){document.getElementById('pwAuto').innerHTML='<p class="small">Esperando actualización automática del modelo…</p>';return;}
 document.getElementById('pwAuto').innerHTML=states.map(st=>{const z=st.s,c=cs[z.id];
 const coul=c?.evaluable&&Number.isFinite(c.score)?esc(c.label||'evaluable'):'N/A · mecanismo/ruptura/geometría receptora insuficientes';
 const gn=(st.idg&&st.idg.used>=3)?('evaluable · '+st.idg.used+' estaciones'):'N/A · cobertura insuficiente';
 return '<details style="margin:10px 0"><summary>'+esc(z.country+' · '+z.name)+'</summary><p class="small"><b>Coulomb:</b> '+coul+'<br><b>GNSS:</b> '+gn+'<br><b>Actividad receptora:</b> IDS '+Number(st.ids||0).toFixed(0)+' · tasa ×'+Number(st.rateRatio||0).toFixed(2)+'<br><b>Estado:</b> evidencia automática; pista científica independiente de V1.</p></details>';
 }).join('');
}
window.addEventListener('mivige:model',render);window.addEventListener('mivige:prospective',render);setInterval(render,60000);setTimeout(render,5000);
})();