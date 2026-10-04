(function(){
'use strict';
function render(){
const el=document.getElementById('projectionBadge');if(!el)return;
el.style.background='#475569';el.style.color='#fff';
el.innerHTML='<strong>CAPA EXPERIMENTAL · ECUADOR</strong><div>DIRECCIÓN FÍSICA SIN DETERMINAR</div><small>Cálculo de esfuerzos y deformación pendiente. Sin probabilidad calibrada.</small>';
el.title='La secuencia de epicentros no determina una dirección física ni una probabilidad de sismo fuerte. Este estado no implica ausencia de peligro.';
}
window.addEventListener('mivige:prospective',render);window.addEventListener('mivige:model',render);render();
})();