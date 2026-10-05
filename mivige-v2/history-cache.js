/* Last observations survive failed/empty requests; their timestamps never advance. */
(function(){
'use strict';
const KEY='mivige-observations-v1';
let saved={sources:{}};
try{const j=JSON.parse(localStorage.getItem(KEY));if(j?.sources)saved=j;}catch(_){}
function merge(a,b){const m=new Map();for(const e of [...a,...b])m.set(e.source+':'+(e.id||e.time+':'+e.lat+':'+e.lon),e);return [...m.values()].sort((a,b)=>b.time-a.time);}
function persist(){try{localStorage.setItem(KEY,JSON.stringify(saved));}catch(_){/* Server copy and in-memory data remain available. */}}
const ready=(async()=>{try{const r=await fetch('data/observations-history.json',{cache:'no-cache',signal:AbortSignal.timeout(8000)});if(!r.ok)return;const j=await r.json();for(const [name,v] of Object.entries(j.sources||{})){const old=saved.sources[name];saved.sources[name]={...((old?.fetchedAt||0)>(v.fetchedAt||0)?old:v),events:(old?.fetchedAt||0)>(v.fetchedAt||0)?merge(v.events||[],old?.events||[]):merge(old?.events||[],v.events||[])};}persist();}catch(_){}})();
const liveFetch=fetchSource;
fetchSource=async function(name,url){
 await ready;
 const events=await liveFetch(name,url),status=sourceStatus[name]||{},old=saved.sources[name];
 if(events.length){saved.sources[name]={events:merge(old?.events||[],events),fetchedAt:status.fetchedAt||Date.now(),status:{...status}};persist();}
 if(!events.length&&old?.events?.length){sourceStatus[name]={...status,ok:false,cached:true,count:old.events.length,lastSuccessAt:old.fetchedAt,error:status.error||'Respuesta vacía; se conserva el histórico'};return old.events;}
 return events;
};
function draw(){
 let card=document.getElementById('retainedObservations');
 if(!card){card=document.createElement('section');card.id='retainedObservations';card.className='card';const h=document.createElement('h2');h.textContent='Registros conservados';card.append(h);const b=document.createElement('div');b.id='retainedBody';card.append(b);document.getElementById('preventionDashboard')?.before(card);}
 const body=document.getElementById('retainedBody');body.replaceChildren();
 const entries=Object.entries(saved.sources),failed=entries.filter(([name])=>sourceStatus[name]?.cached);
 const msg=document.createElement('p');msg.className='small';msg.textContent=failed.length?'Consulta parcial: '+failed.map(([n])=>n).join(', ')+'. Se conservan las últimas observaciones; no equivalen a cobertura actual.':'Los registros se conservan entre consultas, con su fecha original.';body.append(msg);
 const dates=document.createElement('div');dates.className='small';dates.textContent=entries.map(([n,v])=>n+': última consulta con registros '+fmtFull(v.fetchedAt)).join(' · ');body.append(dates);
 const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Consultar registros históricos';details.append(summary);
 const select=document.createElement('select');for(const [k,v] of [['EC','Ecuador y frontera'],['ALL','Región y mundo']]){const o=document.createElement('option');o.value=k;o.textContent=v;select.append(o);}details.append(select);
 const list=document.createElement('div');details.append(list);
 function rows(){list.replaceChildren();const es=dedupe(entries.flatMap(([,v])=>v.events||[])).filter(e=>select.value==='ALL'||(e.lat>=-5.1&&e.lat<=1.8&&e.lon>=-92.5&&e.lon<=-75));es.slice(0,50).forEach(e=>{const row=document.createElement('div');row.className='listitem small';row.textContent=fmtFull(e.time)+' · M'+e.mag.toFixed(1)+' · '+(e.place||'')+' · '+e.source+' · '+e.lat.toFixed(3)+', '+e.lon.toFixed(3)+(Date.now()-e.time>72*36e5?' · histórico (>72 h)':'');list.append(row);});if(!es.length)list.textContent='Aún no se recibió un registro para esta selección.';}
 select.onchange=rows;rows();body.append(details);
 const btn=document.createElement('button');btn.textContent='Descargar registros conservados';btn.onclick=()=>{const u=URL.createObjectURL(new Blob([JSON.stringify(saved,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=u;a.download='mivige-registros.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);};body.append(btn);
 window.mivigeHistory={count:entries.reduce((n,[,v])=>n+v.events.length,0),cachedSources:failed.map(([n])=>n)};
}
window.addEventListener('mivige:model',draw);ready.then(draw);
})();
