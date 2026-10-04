(function(){
'use strict';
const COLORS={Alta:'#dc2626',Media:'#d97706',Baja:'#16a34a'};
function level(s){return s>=65?'Alta':s>=40?'Media':'Baja';}
function ensurePanel(){
 const aside=document.querySelector('aside');if(!aside)return null;
 const old=[...aside.querySelectorAll('#regionalProjectionPanel,#ecuadorProjectionPanel')],p=old[0]||document.createElement('section');
 old.slice(1).forEach(x=>x.remove());p.className='card';p.id='regionalProjectionPanel';
 if(!p.parentNode)aside.insertBefore(p,aside.firstChild);return p;
}
function markTechnical(){[...document.querySelectorAll('aside > section.card')].forEach(s=>{if(s.id==='regionalProjectionPanel')return;const h=(s.querySelector('h2')?.textContent||'').toLowerCase();if(/vigilancia observada|capas científicas|migración direccional|activación sísmica regional|gnss regional|zonas de vigilancia|comparación de modelos|challenger experimental|proyección prospectiva|dirección y mecanismos|ventanas experimentales/.test(h))s.classList.add('mivige-technical');});}
function render(){
 const panel=ensurePanel();markTechnical();if(!panel)return;
 const badge=document.getElementById('projectionBadge'),results=(window.mivigeProspectiveV2?.results||[]).slice().sort((a,b)=>b.score-a.score);
 const top=results[0]||null,lv=level(top?.score||0),color=COLORS[lv];
 if(badge){badge.style.background=color;badge.style.color='#fff';badge.innerHTML='<strong>PROYECCIÓN EXPERIMENTAL REGIONAL</strong><div>'+lv.toUpperCase()+' · '+(top?top.st.s.name:'sin activación destacada')+'</div>';}
 const grouped={};
 results.forEach(x=>{const k=x.st.s.country||'Región';if(!grouped[k]||x.score>grouped[k].score)grouped[k]=x;});
 const countries=Object.entries(grouped).map(([country,x])=>({country,x,score:x.score})).sort((a,b)=>b.score-a.score);
 const rows=results.slice(0,5);
 panel.innerHTML='<h2>Prioridad regional de seguimiento</h2>'+
 '<div style="font-size:28px;font-weight:900;color:'+color+'">'+lv.toUpperCase()+'</div>'+
 '<div class="small">Ranking absoluto de receptores regionales; no es una competencia entre países ni una predicción del próximo terremoto.</div>'+
 '<div style="margin-top:10px"><div class="small" style="font-weight:900;margin-bottom:5px">PHYSICS v1 · RANKING AUTOMÁTICO POR LOCALIDAD</div>'+results.slice(0,7).map((x,i)=>{const ev=[];if(x.sourcePts>0)ev.push('fuente');if(x.recv?.points>0)ev.push('respuesta local');if(x.dyn?.points>0)ev.push('dinámica');const pending=[];if(!x.path?.points)pending.push('Coulomb N/A');if(!(x.st?.geo?.used>0))pending.push('GNSS N/A');return '<div style="display:grid;grid-template-columns:30px 1fr auto;gap:7px;padding:9px 0;border-bottom:1px solid rgba(148,163,184,.22)"><b>#'+(i+1)+'</b><span><b>'+x.st.s.name+'</b><br><span class="small">'+(x.st.s.country||'Región')+' · evidencia: '+(ev.join(' + ')||'señal basal')+(pending.length?' · '+pending.join(' · '):'')+'</span></span><span style="font-weight:900;color:'+COLORS[level(x.score)]+'">'+level(x.score).toUpperCase()+' · '+x.score.toFixed(0)+'/100 · cob. '+(x.coverage??0)+'%</span></div>'}).join('')+'</div>'+
 '<details style="margin-top:10px"><summary><b>Ver evidencia por zona</b></summary><div style="margin-top:8px">'+rows.map((x,i)=>'<div style="display:grid;grid-template-columns:30px 1fr auto;gap:7px;padding:8px 0;border-bottom:1px solid rgba(148,163,184,.22)"><b>#'+(i+1)+'</b><span><b>'+x.st.s.name+'</b><br><span class="small">'+(x.st.s.country||'Región')+'</span></span><span style="font-weight:800;color:'+COLORS[level(x.score)]+'">'+level(x.score).toUpperCase()+' · '+x.score.toFixed(0)+'</span></div>').join('')+'</div>'+
 '<p class="small"><b>Physics v1:</b> el ranking principal utiliza únicamente los canales físicos/observacionales evaluables. <b>Challenger Antípoda:</b> se registra por separado y no suma al índice principal; sus ventanas 24/72 h permitirán comprobar si añade desempeño prospectivo frente a Physics solo. La focalización antipodal de ondas no se interpreta como migración de energía tectónica ni como causalidad demostrada.</p>'+
 '<button id="technicalToggle">Ver evidencia técnica</button>';
 const b=document.getElementById('technicalToggle');if(b)b.onclick=()=>{const o=document.body.classList.toggle('show-technical');b.textContent=o?'Ocultar evidencia técnica':'Ver evidencia técnica';};
}
if(!document.getElementById('regionalProjectionStyle')){const s=document.createElement('style');s.id='regionalProjectionStyle';s.textContent='.mivige-technical{display:none}.show-technical .mivige-technical{display:block}#regionalProjectionPanel{border:1px solid rgba(148,163,184,.3)}';document.head.appendChild(s);}
render();window.addEventListener('mivige:prospective',render);window.addEventListener('mivige:model',()=>setTimeout(render,50));setTimeout(render,4200);setInterval(render,60000);
})();