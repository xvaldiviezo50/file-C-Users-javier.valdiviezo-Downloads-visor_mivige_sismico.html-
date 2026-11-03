(function(){
'use strict';
const COLORS={Alta:'#dc2626',Media:'#d97706',Baja:'#16a34a'};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const time=t=>new Date(t).toLocaleString('es-EC',{timeZone:'America/Guayaquil'});
function level(s){return s>=65?'Alta':s>=40?'Media':'Baja';}
function markTechnical(){
 document.querySelectorAll('aside > section.card').forEach(s=>{
  if(s.id==='regionalProjectionPanel'||s.id==='prospectiveProtocol')return;
  const h=(s.querySelector('h2')?.textContent||'').toLowerCase();
  if(s.id==='preventionDashboard'||s.id==='priorityRankingFixed'||s.id==='modelArchitecture'||s.id==='observationLayers'||s.id==='sst40'||/evidencia activa|vigilancia observada|capas científicas|migración direccional|activación sísmica regional|gnss regional|zonas de vigilancia|comparación de modelos|challenger|proyección prospectiva|dirección y mecanismos|ventanas experimentales|contraste automático/.test(h))s.classList.add('mivige-technical');
 });
}
function sourceCoverage(){
 const statuses=typeof sourceStatus==='object'?Object.entries(sourceStatus).filter(([n])=>['USGS','EMSC','IG-EPN','IGP','SGC'].includes(n)):[];
 const active=statuses.filter(([,s])=>s.ok);
 return '<div class="small"><b>Catálogos recibidos:</b> '+(active.length?active.map(([n,s])=>esc(n)+' ('+s.count+(s.truncated?', parcial':'')+')').join(' · '):'consultando fuentes')+
 '</div><details><summary>Fuentes y cobertura</summary>'+statuses.map(([n,s])=>'<div class="small"><b>'+esc(n)+'</b> · '+(s.ok?'recibido '+time(s.fetchedAt)+(s.truncated?' · catálogo parcial':'')+(s.newest?' · último evento '+time(s.newest):''):'no disponible en esta consulta')+'</div>').join('')+
 '<p class="small">USGS y EMSC aportan cobertura mundial; IG-EPN, IGP y SGC complementan la región cuando responden. Los duplicados se unifican. La ausencia de registros no demuestra ausencia de actividad. No se afirma cobertura de todas las redes del mundo.</p></details>';
}
function row(x,i){
 const s=x.st,lv=level(x.score),color=COLORS[lv],obs=[];
 const events=(s.hist||[]),names=[...new Set(events.flatMap(e=>(e.reports||[e]).map(r=>r.source)))];
 if(events.length)obs.push(events.length+' eventos locales en 7 días · '+(s.recent||[]).length+' sobre Mc en 24 h · '+esc(names.join(' / ')));
 if(events.length&&Number.isFinite(s.rateRatio))obs.push('Tasa 24 h/fondo ×'+s.rateRatio.toFixed(2)+' · IDS '+s.ids.toFixed(0)+'/100'+(events.length<20?' · muestra pequeña':''));
 if(x.src)obs.push('Fuente '+esc(x.src.e.source)+' · M'+Number(x.src.e.mag).toFixed(1)+' · '+Math.round(x.src.d)+' km · '+time(x.src.e.time));
 if(x.components?.some(c=>c.id==='geodesy'&&Number.isFinite(c.value)))obs.push('GNSS: '+s.idg.used+' estaciones utilizables');
 if(x.components?.some(c=>c.id==='dynamic'&&Number.isFinite(c.value)))obs.push(esc(x.dyn.label));
 const challengers=[];
 if(x.antiContinuous?.hit)challengers.push(esc(x.antiContinuous.label));
 else if(x.anti?.hit)challengers.push(esc(x.anti.label));
 if(x.sst?.points>0)challengers.push(esc(x.sst.label));
 return '<article class="obs-row" style="border-left:5px solid '+color+'"><div class="obs-row-head"><b>#'+(i+1)+' · '+esc(s.s.name)+'</b><strong style="color:'+color+'">'+Math.round(x.score)+'/100 · '+lv.toUpperCase()+'</strong></div>'+
 '<div class="small">'+obs.join('<br>')+'</div>'+
 (challengers.length?'<div class="small"><b>Hipótesis complementarias observadas:</b> '+challengers.join(' · ')+'</div>':'')+
 '<div class="small">Cobertura de componentes: '+x.coverage+'% · seguimiento 24/72 h.</div></article>';
}
function recentRegionalEvents(p){
 const now=Date.now(),events=Array.isArray(window.allEvents)?window.allEvents:[];
 const states=window.mivigeV2?.states||[];
 const noteworthy=events.filter(e=>e&&Number.isFinite(Number(e.time))&&Number.isFinite(Number(e.mag))&&
  Number(e.mag)>=5&&now-Number(e.time)>=-60000&&now-Number(e.time)<=48*3600e3&&
  (/colombia|per[uú]|ecuador/i.test(e.place||'')||
   (Number(e.lat)>=-18&&Number(e.lat)<=15&&Number(e.lon)>=-87&&Number(e.lon)<=-69)))
  .sort((a,b)=>b.time-a.time).slice(0,5);
 const pe=states.find(x=>x.s.id==='pe_n');
 const thresholds=p?.config?.sourceThresholds||[];
 const ranked=p?.results||[];
 let rows=[];
 for(const e of noteworthy){
  const neighbors=states.map(st=>({st,d:distKm(Number(e.lat),Number(e.lon),st.s.lat,st.s.lon)}))
   .sort((a,b)=>a.d-b.d);
  const nearest=neighbors[0],local=neighbors.find(x=>x.d<=x.st.s.r);
  const receiver=local||null;
  const rank=receiver?ranked.find(x=>x.st.s.id===receiver.st.s.id):null;
  let peNote='';
  if(pe&&/colombia/i.test(e.place||'')&&thresholds.length){
   const d=distKm(Number(e.lat),Number(e.lon),pe.s.lat,pe.s.lon);
   const t=thresholds.find(x=>d<=x.max)||thresholds[thresholds.length-1];
   peNote='<div class="small">Contraste Perú norte: distancia '+Math.round(d)+' km · fuente requerida M≥'+t.m.toFixed(1)+' · '+(Number(e.mag)>=t.m?'cumple el umbral de selección de fuente (no implica efecto físico)':'no alcanza el umbral para esta fuente')+'.</div>';
  }
  rows.push('<article class="obs-row" style="border-left:4px solid #52a8ff">'+
   '<div><b>Sismo observado M'+Number(e.mag).toFixed(1)+'</b> · '+esc(e.place||'sin lugar informado')+
   ' · '+time(Number(e.time))+'</div>'+
   '<div class="small">Fuente '+esc(e.source||'catálogo integrado')+
   ' · profundidad '+(Number.isFinite(Number(e.depth))&&e.depth!=null?Number(e.depth).toFixed(1)+' km':'N/A')+
   ' · '+(receiver?'Dentro de '+esc(receiver.st.s.name)+' ('+Math.round(receiver.d)+' km del centro)':nearest?'Fuera del radio local del segmento más próximo':'Sin segmentos evaluables')+
   (rank?' · puntaje de ranking '+rank.score.toFixed(1)+'/100':' · sin clasificación local confirmada')+'.</div>'+
   peNote+'</article>');
 }
 return '<section aria-label="Actividad reciente independiente del ranking"><h3 style="font-size:14px;margin:12px 0 6px">Sismos regionales M≥5 · observación de 48 h</h3>'+
  '<p class="small">El evento aparece como observación aunque no alcance el TOP 5. Solo se modifican los puntajes cuando las reglas del modelo lo justifican; la distancia y magnitud no demuestran transmisión de esfuerzos.</p>'+
  (rows.length?rows.join(''):'<p class="small">Sin eventos M≥5 verificables en la selección regional de esta consulta; revisar cobertura de fuentes.</p>')+
  '</section>';
}
function render(){
 const aside=document.querySelector('aside');if(!aside)return;
 let panel=document.getElementById('regionalProjectionPanel');
 if(!panel){panel=document.createElement('section');panel.id='regionalProjectionPanel';panel.className='card';aside.insertBefore(panel,aside.firstChild);}
 markTechnical();
 const p=window.mivigeProspectiveV2;
 const results=(p?.results||[]).filter(x=>x.hasEvidence!==false&&Number.isFinite(x.score)).slice().sort((a,b)=>b.score-a.score);
 const stale=Boolean(p?.dataTime&&Date.now()-p.dataTime>15*60000),top=results[0],lv=top&&!stale?level(top.score):'Sin evaluación',color=COLORS[lv]||'#64748b';
 const badge=document.getElementById('projectionBadge');
 if(badge){badge.style.background=color;badge.style.color='#fff';badge.innerHTML='<strong>PRIORIDAD DE OBSERVACIÓN EXPERIMENTAL</strong><div>'+lv.toUpperCase()+' · '+(top&&!stale?esc(top.st.s.name):stale?'actualización pendiente':'esperando datos')+'</div>';}
 panel.innerHTML='<h2>TOP 5 · observación experimental</h2><p class="small">Orden automático por señales disponibles. El puntaje organiza el seguimiento; no es probabilidad de un sismo ni alerta oficial. Los colores expresan el nivel del puntaje. <b>El puesto 1 no demuestra dónde ocurrirá el siguiente sismo fuerte.</b></p>'+
 (p?.time?'<div class="small"><b>Corte:</b> '+time(p.dataTime||p.time)+(stale?' · DATOS ATRASADOS':'')+'</div>':'')+
 (results.length?results.slice(0,5).map(row).join(''):'<p>Esperando observaciones verificables; no se asigna nivel bajo por falta de datos.</p>')+
 recentRegionalEvents(p)+
 sourceCoverage()+
 '<details><summary>Método y aprendizaje</summary><p class="small">Pesos fijos del motor: receptor 30%, fuente 20%, continuidad 15%, secuencia 15%, dinámica 10%, antípoda 7% y SST 3% nominal (actualmente sin valor evaluable). Los canales ausentes no se renormalizan. La convergencia aplica un factor adicional. GNSS y Coulomb se contrastan aparte. La cobertura no representa confianza ni probabilidad. No hay ajuste automático de pesos. El registro central valida este motor, separado del seguimiento histórico que usaba otra fórmula.</p></details>'+
 '<button id="technicalToggle" type="button" aria-expanded="'+document.body.classList.contains('show-technical')+'">'+(document.body.classList.contains('show-technical')?'Ocultar':'Mostrar')+' contraste científico y capas complementarias</button>';
 document.getElementById('technicalToggle').onclick=()=>{const open=document.body.classList.toggle('show-technical');const b=document.getElementById('technicalToggle');b.textContent=(open?'Ocultar':'Mostrar')+' contraste científico y capas complementarias';b.setAttribute('aria-expanded',String(open));};
}
if(!document.getElementById('regionalProjectionStyle')){
 const s=document.createElement('style');s.id='regionalProjectionStyle';
 s.textContent='.mivige-technical{display:none}.show-technical .mivige-technical{display:block}.obs-row{padding:10px;margin:10px 0;background:#0b1a2a;border-radius:8px}.obs-row-head{display:flex;flex-wrap:wrap;gap:6px;justify-content:space-between;margin-bottom:6px}.obs-row .small{font-size:12px;overflow-wrap:anywhere}#technicalToggle{margin-top:10px;width:100%}#regionalProjectionPanel summary{padding:8px 0}';
 document.head.appendChild(s);
}
render();window.addEventListener('mivige:prospective',render);window.addEventListener('mivige:model',()=>setTimeout(render,50));setTimeout(render,4200);setInterval(render,60000);
})();