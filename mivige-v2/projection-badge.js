(function(){
'use strict';
function render(){
 const el=document.getElementById('projectionBadge');if(!el)return;
 const p=window.MivigePattern?.current(),now=Date.now();
 const feed=typeof sourceStatus==='undefined'?null:sourceStatus['IG-EPN'];
 const fresh=feed?.ok&&!feed.truncated&&Number.isFinite(feed.fetchedAt)&&now-feed.fetchedAt>=0&&now-feed.fetchedAt<=15*60000;
 const relevant=p?.available&&[p.local,p.continuation].some(z=>z?.id?.startsWith('ec_'));
 const sufficient=fresh&&p&&p.sampleCount>=3;
 const grade=!sufficient?'SIN EVALUACIÓN SUFICIENTE':!relevant?'BAJA':p.runLength>=4?'ALTA':'MEDIA';
 const colors={ALTA:'#b91c1c',MEDIA:'#c65d08',BAJA:'#166534'};
 el.style.background=colors[grade]||'#475569';el.style.color='#fff';el.replaceChildren();
 const title=document.createElement('strong');title.textContent='PROYECCIÓN EXPERIMENTAL · ECUADOR';
 const value=document.createElement('div');value.textContent=grade;
 const basis=document.createElement('small');basis.style.display='block';
 basis.textContent=!sufficient?'Datos insuficientes para el patrón direccional.':relevant?p.direction+' · '+p.runLength+' eventos consecutivos · '+p.local.name:'Sin continuidad direccional activa hacia una zona ecuatoriana.';
 const note=document.createElement('small');note.style.display='block';note.textContent='Grado del patrón; no es una probabilidad de terremoto.';
 el.append(title,value,basis,note);
 el.title='Regla experimental v1: verde = patrón no activo; naranja = 3 eventos consecutivos compatibles; rojo = 4 o más. Requiere datos recientes y sin truncamiento detectado. No utiliza el ICM científico. Los cortes no están calibrados; verde no descarta un sismo fuerte.';
}
window.addEventListener('mivige:prospective',render);window.addEventListener('mivige:model',render);setInterval(render,60000);render();
})();