/* Directional scenarios v1: exploratory rules, no contribution to scientific ICM. */
(function(root){
'use strict';
const H=3600000;
const route=[{id:'co_p',name:'Nariño/Cauca',lat:2.5,lon:-77.7},{id:'ec_n',name:'Esmeraldas',lat:.55,lon:-79.9},{id:'ec_c',name:'Manabí',lat:-1,lon:-80.55},{id:'ec_s',name:'Golfo / El Oro',lat:-3.15,lon:-80.2},{id:'pe_n',name:'Norte de Perú · Tumbes/Piura',lat:-6,lon:-80.4}];
function km(a,b){const R=Math.PI/180;return 12742*Math.asin(Math.min(1,Math.sqrt(Math.sin((a.lat-b.lat)*R/2)**2+Math.cos(a.lat*R)*Math.cos(b.lat*R)*Math.sin((a.lon-b.lon)*R/2)**2)));}
function assess(events,reviewed,now){
 const refs=reviewed||[],pool=events.filter(e=>!refs.some(r=>r.id===e.id||Math.abs(r.time-e.time)<60000&&km(r,e)<30&&Math.abs(r.mag-e.mag)<.6)).concat(refs);
 const eligible=pool.filter(e=>e.time<=now&&e.time>=now-72*H&&e.mag>=3&&e.lat>=-6.5&&e.lat<=3&&e.lon>=-82&&e.lon<=-79);
 const unique=[];for(const e of eligible.sort((a,b)=>a.time-b.time)){if(!unique.some(r=>r.id===e.id||Math.abs(r.time-e.time)<60000&&km(r,e)<30&&Math.abs(r.mag-e.mag)<.6))unique.push(e);}
 const last=unique.slice(-3),none={version:'1.0',available:false,sampleCount:unique.length,events:last,reason:'Se necesitan tres eventos consecutivos en el corredor continental occidental.'};
 if(last.length<3)return none;
 const ds=last.slice(1).map((e,i)=>({hours:(e.time-last[i].time)/H,km:km(last[i],e),delta:e.lat-last[i].lat}));
 if(ds.some(d=>d.hours<=0||d.hours>24||d.km>500||Math.abs(d.delta)<=.2)||Math.sign(ds[0].delta)!==Math.sign(ds[1].delta))return {...none,reason:'Últimos tres eventos: sin continuidad direccional bajo los criterios fijados.'};
 const south=ds[0].delta<0,anchor=last[2];
 let index=0;route.forEach((r,i)=>{if(km(r,anchor)<km(route[index],anchor))index=i;});
 const step=south?1:-1;
 let runLength=3;for(let i=unique.length-4;i>=0;i--){const a=unique[i],b=unique[i+1],hours=(b.time-a.time)/H,delta=b.lat-a.lat;if(hours<=0||hours>24||km(a,b)>500||Math.abs(delta)<=.2||Math.sign(delta)!==Math.sign(ds[0].delta))break;runLength++;}
 return {version:'1.0',available:true,sampleCount:unique.length,runLength,direction:south?'N→S':'S→N',events:last,intervals:ds,anchor,local:route[index],continuation:route[index+step]||null,reverse:route[index-step]||null,depthSpread:Math.max(...last.map(e=>e.depth))-Math.min(...last.map(e=>e.depth))};
}
function current(){return assess(typeof allEvents==='undefined'?[]:allEvents,root.mivigeReviewedSnapshot?.events||[],Date.now());}
root.MivigePattern={assess,current};
if(typeof module!=='undefined')module.exports={assess};
if(typeof document==='undefined')return;
const card=document.createElement('section');card.className='card';card.id='directionalScenarios';
card.innerHTML='<h2>Escenarios de continuidad · patrón experimental</h2><div id="directionalScenarioBody"></div>';
document.getElementById('migrationExperimental')?.closest('section')?.insertAdjacentElement('afterend',card);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function render(){
 const p=current(),host=document.getElementById('directionalScenarioBody');if(!host)return;
 const available=(root.mivigeProspectiveV2?.results||[]).map(x=>x.st.s.id);
 host.innerHTML='<p class="small">Regla exploratoria v1: tres últimos eventos M≥3 en el corredor 82–79° O, 6,5° S–3° N; separaciones ≤24 h y ≤500 km; dos cambios de latitud del mismo signo mayores a 0,2°. Ventana de datos: 72 h. No identifica por sí sola una transferencia de esfuerzos.</p>'+
 (!p.available?'<p><b>Sin patrón direccional evaluable.</b> '+esc(p.reason)+'</p>':
 '<p><b>Dirección observada: '+p.direction+'</b><br>'+p.events.map(e=>esc(e.place||e.id)+' M'+e.mag.toFixed(1)).join(' → ')+'</p>'+
 '<table class="table"><thead><tr><th>Hipótesis rival</th><th>Zona de contraste</th><th>Registro</th></tr></thead><tbody>'+
 [['Continuidad en la dirección observada',p.continuation],['Persistencia local',p.local],['Reversión de dirección',p.reverse]].map(([label,z])=>'<tr><td>'+label+'</td><td>'+esc(z?.name||'Fuera del corredor definido')+'</td><td>'+(z&&available.includes(z.id)?'24 / 72 h · al registrar':'En espera de datos suficientes')+'</td></tr>').join('')+'</tbody></table>'+
 '<p class="small">Intervalos observados: '+p.intervals.map(x=>x.hours.toFixed(2)+' h').join(' y ')+'. No se extrapolan como hora del siguiente sismo. Rango de profundidades: '+(Number.isFinite(p.depthSpread)?p.depthSpread.toFixed(1)+' km':'sin información suficiente')+'; mecanismo focal y conexión tectónica pendientes.</p>')+
 '<p class="small">Escenarios para prueba, sin orden de riesgo ni probabilidad asignada. Se contrastan M≥4,5 y M≥6,0 por separado desde la emisión; la ventana no arranca retrospectivamente desde un sismo pasado. GNSS, IDS, IITE e IAC mantienen su evaluación independiente. Antípodas y SST no activan una alerta científica. Sin continuidad o sin datos, el patrón queda sin evaluación.</p>';
}
root.addEventListener('mivige:prospective',render);root.addEventListener('mivige:model',render);render();
})(typeof window!=='undefined'?window:globalThis);
