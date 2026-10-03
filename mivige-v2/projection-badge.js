(function(){
'use strict';
function render(){
 const el=document.getElementById('projectionBadge');if(!el)return;
 const model=window.mivigeProspectiveV2,now=Date.now();
 const rows=(model?.results||[]).filter(x=>['ec_s','ec_az','ec_c','ec_n'].includes(x.st.s.id)&&x.st.dataReady&&Number.isFinite(x.score));
 const fresh=model&&now-model.time>=0&&now-model.time<=15*60000;
 const best=rows.slice().sort((a,b)=>b.score-a.score)[0];
 const complete=rows.length===4;
 const grade=!fresh||!best||(!complete&&best.score<40)?'SIN EVALUACIÓN SUFICIENTE':best.score>=65?'ALTA':best.score>=40?'MEDIA':'BAJA';
 const color=grade==='ALTA'?'#b91c1c':grade==='MEDIA'?'#c65d08':grade==='BAJA'?'#166534':'#475569';
 el.style.background=color;el.style.color='#fff';
 el.replaceChildren();
 const title=document.createElement('strong');title.textContent='PROYECCIÓN EXPERIMENTAL · ECUADOR';
 const value=document.createElement('div');value.textContent=grade+(grade!=='SIN EVALUACIÓN SUFICIENTE'?' · '+Math.round(best.score)+'/100':'');
 const note=document.createElement('small');note.style.display='block';note.textContent='Índice no calibrado; no estima magnitud ni probabilidad.'+(fresh&&!complete?' Cobertura parcial.':'');
 el.append(title,value,note);
 el.title='Verde: baja (<40); naranja: media (40–64); rojo: alta (≥65). Gris: datos insuficientes. Se utiliza el mayor puntaje de las zonas ecuatorianas evaluables. Una proyección baja no descarta un sismo fuerte.';
}
window.addEventListener('mivige:prospective',render);render();
})();