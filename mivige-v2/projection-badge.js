(function(){
'use strict';
const COLORS={Alta:'#dc2626',Media:'#d97706',Baja:'#16a34a'};
function countryOf(x){
  const c=x?.st?.s?.country;
  if(c)return c;
  const id=String(x?.st?.s?.id||'');
  if(id.startsWith('ec_'))return 'Ecuador';
  if(id.startsWith('co_'))return 'Colombia';
  if(id.startsWith('pe_'))return 'Perú';
  if(id==='ven'||id.startsWith('ve_'))return 'Venezuela';
  if(id.startsWith('cl_'))return 'Chile';
  return null;
}
function publicLevel(score){
  if(score>=65)return 'Alta';
  if(score>=40)return 'Media';
  return 'Baja';
}
function aggregate(results){
  const by={};
  for(const x of results||[]){
    const country=countryOf(x); if(!country||!Number.isFinite(Number(x.score)))continue;
    if(!by[country])by[country]={country,score:-1,zones:[]};
    by[country].zones.push(x);
    if(Number(x.score)>by[country].score)by[country].score=Number(x.score);
  }
  return Object.values(by).sort((a,b)=>b.score-a.score).map((x,i)=>({
    ...x,priority:i+1,level:publicLevel(x.score),
    zone:x.zones.sort((a,b)=>b.score-a.score)[0]?.st?.s?.name||'—'
  }));
}
function ensurePanel(){
  let p=document.getElementById('regionalProjectionPanel'); if(p)return p;
  const aside=document.querySelector('aside'); if(!aside)return null;
  p=document.createElement('section');p.className='card';p.id='regionalProjectionPanel';
  p.innerHTML='<h2>Proyección experimental regional</h2><div class="small">Ranking comparativo del modelo experimental. No es probabilidad sísmica ni alerta oficial.</div><div id="regionalProjectionRows" style="margin-top:10px"></div><button id="technicalToggle" style="margin-top:10px">Ver evidencia técnica</button>';
  aside.insertBefore(p,aside.firstChild);
  document.getElementById('technicalToggle').onclick=()=>{
    const open=document.body.classList.toggle('show-technical');
    document.getElementById('technicalToggle').textContent=open?'Ocultar evidencia técnica':'Ver evidencia técnica';
  };
  return p;
}
function markTechnical(){
  [...document.querySelectorAll('aside > section.card')].forEach(s=>{
    if(s.id==='regionalProjectionPanel')return;
    const h=(s.querySelector('h2')?.textContent||'').toLowerCase();
    if(/vigilancia observada|capas científicas|migración direccional|activación sísmica regional|gnss regional|zonas de vigilancia|comparación de modelos|challenger experimental|proyección prospectiva|dirección y mecanismos|ventanas experimentales/.test(h))s.classList.add('mivige-technical');
  });
}
function render(){
  ensurePanel();markTechnical();
  const badge=document.getElementById('projectionBadge'),host=document.getElementById('regionalProjectionRows');
  const p=window.mivigeProspectiveV2;
  const ranking=aggregate(p?.results||[]);
  if(!ranking.length){
    if(badge){badge.style.background='#475569';badge.style.color='#fff';badge.innerHTML='<strong>PROYECCIÓN EXPERIMENTAL REGIONAL</strong><div>DATOS INSUFICIENTES</div>';}
    if(host)host.innerHTML='<div class="small">Esperando catálogos suficientes para comparar países.</div>';
    return;
  }
  const top=ranking[0],color=COLORS[top.level];
  if(badge){
    badge.style.background=color;badge.style.color='#fff';
    badge.innerHTML='<strong>PROYECCIÓN EXPERIMENTAL REGIONAL · '+top.level.toUpperCase()+'</strong><div>PRIORIDAD 1 · '+top.country.toUpperCase()+'</div>';
    badge.title='Ranking experimental regional; no constituye probabilidad de terremoto ni alerta oficial.';
  }
  if(host)host.innerHTML=ranking.slice(0,3).map(x=>{
    const c=COLORS[x.level];
    return '<div style="display:grid;grid-template-columns:34px 1fr auto;gap:8px;align-items:center;padding:10px 0;border-bottom:1px solid rgba(148,163,184,.22)">'+
      '<div style="font-size:20px;font-weight:800">#'+x.priority+'</div><div><b>'+x.country+'</b><div class="small">'+x.zone+'</div></div>'+
      '<div style="font-weight:800;color:'+c+'">'+x.level.toUpperCase()+'<br><span style="font-size:11px">'+x.score.toFixed(0)+'/100</span></div></div>';
  }).join('')+'<div class="small" style="margin-top:8px">ALTA ≥65 · MEDIA 40–64 · BAJA &lt;40. Se usa el segmento con mayor puntaje de cada país para no diluir una señal localizada.</div>';
  window.mivigeRegionalRanking=ranking;
}
function addStyle(){
 if(document.getElementById('regionalProjectionStyle'))return;
 const s=document.createElement('style');s.id='regionalProjectionStyle';
 s.textContent='.mivige-technical{display:none}.show-technical .mivige-technical{display:block}#regionalProjectionPanel{border:1px solid rgba(148,163,184,.3)}#regionalProjectionRows .small{opacity:.82}@media(max-width:600px){#regionalProjectionPanel{order:-1}}';
 document.head.appendChild(s);
}
addStyle();ensurePanel();markTechnical();render();
window.addEventListener('mivige:prospective',render);window.addEventListener('mivige:model',()=>setTimeout(render,50));
setTimeout(render,4200);setInterval(render,60000);
})();
