(function(){
'use strict';
const COLORS={Alta:'#dc2626',Media:'#d97706',Baja:'#16a34a'};
function level(score){return score>=65?'Alta':score>=40?'Media':'Baja';}
function isEcuador(x){const id=String(x?.st?.s?.id||'');return x?.st?.s?.country==='Ecuador'||id.startsWith('ec_');}
function ensurePanel(){
 const aside=document.querySelector('aside');if(!aside)return null;
 const old=[...aside.querySelectorAll('#regionalProjectionPanel,#ecuadorProjectionPanel')];
 let p=old[0]||null; old.slice(1).forEach(x=>x.remove());
 if(!p){p=document.createElement('section');p.className='card';aside.insertBefore(p,aside.firstChild);}
 p.id='ecuadorProjectionPanel'; return p;
}
function markTechnical(){
 [...document.querySelectorAll('aside > section.card')].forEach(s=>{
  if(s.id==='ecuadorProjectionPanel')return;
  const h=(s.querySelector('h2')?.textContent||'').toLowerCase();
  if(/vigilancia observada|capas científicas|migración direccional|activación sísmica regional|gnss regional|zonas de vigilancia|comparación de modelos|challenger experimental|proyección prospectiva|dirección y mecanismos|ventanas experimentales/.test(h))s.classList.add('mivige-technical');
 });
}
function render(){
 const panel=ensurePanel();markTechnical();if(!panel)return;
 const badge=document.getElementById('projectionBadge'),p=window.mivigeProspectiveV2;
 const ec=(p?.results||[]).filter(isEcuador).sort((a,b)=>b.score-a.score);
 if(!ec.length){
  const lv='Baja',color=COLORS[lv];
  panel.innerHTML='<h2>Proyección experimental · Ecuador</h2><div style="font-size:29px;font-weight:900;color:'+color+'">BAJA</div><div class="small" style="margin-top:4px">Índice experimental 0/100 · sin señal experimental suficiente para elevar el nivel con los datos abiertos cargados en este corte.</div><p class="small"><b>Cobertura:</b> la disponibilidad de fuentes se informa por separado y no sustituye esta clasificación.</p><button id="technicalToggle">Ver evidencia técnica</button>';
  if(badge){badge.style.background=color;badge.style.color='#fff';badge.innerHTML='<strong>ECUADOR · PROYECCIÓN EXPERIMENTAL</strong><div>BAJA · 0/100</div>';}
 }else{
  const top=ec[0],lv=level(top.score),color=COLORS[lv];
  panel.innerHTML='<h2>Proyección experimental · Ecuador</h2>'+
   '<div style="font-size:29px;font-weight:900;color:'+color+'">'+lv.toUpperCase()+'</div>'+
   '<div style="font-size:18px;font-weight:750;margin-top:4px">'+top.st.s.name+'</div>'+
   '<div class="small" style="margin-top:4px">Índice experimental '+top.score.toFixed(0)+'/100 · zona ecuatoriana con mayor señal actual</div>'+
   '<div style="margin-top:10px"><div class="small" style="font-weight:800;margin-bottom:4px">PRIORIDAD DE SEGUIMIENTO</div>'+ec.slice(0,3).map((x,i)=>'<div style="display:flex;justify-content:space-between;gap:8px;padding:7px 0;border-bottom:1px solid rgba(148,163,184,.22)"><span><b>PRIORIDAD '+(i+1)+' · '+x.st.s.name+'</b></span><span style="font-weight:800;color:'+COLORS[level(x.score)]+'">'+level(x.score).toUpperCase()+' · '+x.score.toFixed(0)+'</span></div>').join('')+'</div>'+
   '<p class="small" style="margin-top:9px"><b>Lectura:</b> clasificación absoluta de Ecuador a partir de la capa experimental y sus ventanas prospectivas. Los eventos de Colombia, Perú, Chile, Venezuela y otras regiones pueden actuar como evidencia de entrada/contexto; no compiten con Ecuador en un ranking.</p>'+
   '<button id="technicalToggle">Ver evidencia técnica</button>';
  if(badge){badge.style.background=color;badge.style.color='#fff';badge.innerHTML='<strong>ECUADOR · PROYECCIÓN EXPERIMENTAL</strong><div>'+lv.toUpperCase()+' · '+top.score.toFixed(0)+'/100</div>';}
 }
 const b=document.getElementById('technicalToggle');if(b)b.onclick=()=>{const open=document.body.classList.toggle('show-technical');b.textContent=open?'Ocultar evidencia técnica':'Ver evidencia técnica';};
}
function style(){
 if(document.getElementById('regionalProjectionStyle'))return;
 const s=document.createElement('style');s.id='regionalProjectionStyle';s.textContent='.mivige-technical{display:none}.show-technical .mivige-technical{display:block}#ecuadorProjectionPanel{border:1px solid rgba(148,163,184,.3)}';document.head.appendChild(s);
}
style();ensurePanel();markTechnical();render();
window.addEventListener('mivige:prospective',render);window.addEventListener('mivige:model',()=>setTimeout(render,50));
setTimeout(render,4200);setInterval(render,60000);
})();
