(function(){'use strict';
const VERSION='validation-ab-1.0',KEY='mivige-validation-ab-v1',H=3600000;
const weights={receiver:.30,source:.20,path:.15,sequence:.15,dynamic:.10,antipode:.07,sst:.03};
const labels={receiver:'Receptor',source:'Fuente',path:'Continuidad',sequence:'Secuencia',dynamic:'Dinámica',antipode:'Antípoda',sst:'SST'};
const clamp=x=>Math.max(0,Math.min(100,x));
function evaluate(row,omit){
 const components=row.components||[];
 const score=components.reduce((s,c)=>s+(c.id===omit?0:(Number.isFinite(c.value)?c.value*(weights[c.id]||0):0)),0);
 const active=components.filter(c=>c.id!==omit&&Number.isFinite(c.value)&&c.value>=20).length;
 const factor=active>=4?1.08:active===3?1:active===2?.90:.72;
 return +clamp(score*factor).toFixed(2);
}
function load(){try{return JSON.parse(localStorage.getItem(KEY)||'[]')}catch(_){return []}}
function save(a){try{localStorage.setItem(KEY,JSON.stringify(a.slice(-120)))}catch(_){}}
function escape(s){return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}
function init(){
 if(document.getElementById('abValidation'))return;
 const host=document.querySelector('aside');if(!host)return;
 const section=document.createElement('section');section.className='card';section.id='abValidation';
 section.innerHTML='<h2>🧪 Evaluación A/B · misma entrada, misma función</h2><div class="small">A: modelo publicado · B: referencia basada únicamente en actividad receptora (sin recalibración). Se calculan ablaciones de cada familia con los mismos componentes observados. Esta comparación es <b>de puntuaciones</b>, no una prueba de pronóstico. Los cortes congelados en este navegador no equivalen a un registro independiente del servidor.</div><div id="abCurrent">Esperando datos del motor.</div><h3>Cortes prospectivos locales</h3><div id="abLedger"></div>';
 host.prepend(section);
}
function run(){
 init();const data=window.mivigeProspectiveV2;if(!data||!Array.isArray(data.results))return;
 const rows=data.results.map(x=>({id:x.st.s.id,name:x.st.s.name,components:x.components||[],A:evaluate(x),B:+clamp((x.components||[]).find(c=>c.id==='receiver')?.value||0).toFixed(2),score:x.score}));
 const sortedA=[...rows].sort((a,b)=>b.A-a.A),sortedB=[...rows].sort((a,b)=>b.B-a.B);
 const ranked=sortedA.slice(0,5);
 const ab=document.getElementById('abCurrent');if(ab)ab.innerHTML='<div class="small">Versión '+VERSION+' · motor '+escape(data.config?.version||'no indicado')+' · <b>no son probabilidades</b></div><table style="width:100%;font-size:12px"><thead><tr><th>Zona</th><th>A /100</th><th>B /100</th><th>Δ A−B</th></tr></thead><tbody>'+ranked.map(x=>'<tr><td>'+escape(x.name)+'</td><td>'+x.A+'</td><td>'+x.B+'</td><td>'+(x.A-x.B).toFixed(1)+'</td></tr>').join('')+'</tbody></table><details><summary>Prueba de ablación: retirar una familia</summary><div class="small">'+Object.keys(weights).map(k=>'<p><b>'+labels[k]+':</b> '+ranked.map(x=>{const s=evaluate(x,k);return escape(x.name)+' '+s.toFixed(1)+' (Δ '+(s-x.A).toFixed(1)+')'}).join(' · ')+'</p>').join('')+'</div></details><div class="small">Top 5 referencia B: '+sortedB.slice(0,5).map(x=>escape(x.name)).join(' · ')+'</div>';
 const now=Date.now(),bucket=Math.floor(now/(6*H));let ledger=load();
 if(!ledger.some(x=>x.bucket===bucket)&&data.dataTime&&now-data.dataTime<15*60000){
 ledger.push({bucket,issuedAt:now,validFrom:now,validTo:now+72*H,model:VERSION,engine:data.config?.version||null,targetMagnitude:5,windowHours:72,topA:sortedA.slice(0,5).map(x=>({zoneId:x.id,score:x.A})),topB:sortedB.slice(0,5).map(x=>({zoneId:x.id,score:x.B})),status:'SIN EVALUAR'});save(ledger);}
 const el=document.getElementById('abLedger');if(el)el.innerHTML=ledger.slice(-5).reverse().map(x=>'<div class="small">'+new Date(x.issuedAt).toLocaleString('es-EC')+' · M≥'+x.targetMagnitude+' · 72 h · '+x.status+'</div>').join('')||'Sin cortes aún.';
}
window.addEventListener('mivige:prospective',run);setTimeout(run,5000);
})();