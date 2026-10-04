(function(){'use strict';
const KEY='mivige-observer-v1';
function get(){try{return JSON.parse(localStorage.getItem(KEY)||'{"samples":[]}')}catch(e){return {samples:[]}}}
function run(){const p=window.mivigeProspectiveV2;if(!p||!p.results)return;const d=get(),h=Math.floor(Date.now()/3600000);
for(const x of p.results){if(d.samples.some(s=>s.h===h&&s.id===x.st.s.id))continue;const z=(x.st.recent||[]).map(e=>+e.depth).filter(Number.isFinite);d.samples.push({h,id:x.st.s.id,score:+x.score.toFixed(1),ids:+x.st.ids.toFixed(1),rate:+x.st.rateRatio.toFixed(2),depth:z.length?+(z.reduce((a,b)=>a+b,0)/z.length).toFixed(1):null,sm:x.src?+x.src.e.mag:null,sd:x.src?Math.round(x.src.d):null});}
d.samples=d.samples.slice(-12000);try{localStorage.setItem(KEY,JSON.stringify(d))}catch(e){}render(d)}
function render(d){let c=document.getElementById('learningObserverCard');if(!c){const a=document.querySelector('aside');if(!a)return;c=document.createElement('section');c.className='card mivige-technical';c.id='learningObserverCard';a.appendChild(c)}
const hi=d.samples.filter(s=>s.score>=40),avg=(a,k)=>{const q=a.map(x=>x[k]).filter(Number.isFinite);return q.length?q.reduce((x,y)=>x+y,0)/q.length:null},fmt=v=>Number.isFinite(v)?v.toFixed(1):'N/A';
c.innerHTML='<h2>🧪 Aprendizaje paralelo · V1 congelado</h2><div class="small"><b>V1 no se modifica automáticamente.</b> Este observador acumula patrones candidatos para futuras versiones y los mantiene fuera de la alerta actual.</div><div class="small" style="margin-top:7px">Muestras: <b>'+d.samples.length+'</b> · estados V1 medios/altos: <b>'+hi.length+'</b><br>Candidatas observadas: profundidad local '+fmt(avg(hi,'depth'))+' km · tasa ×'+fmt(avg(hi,'rate'))+' · distancia fuente '+fmt(avg(hi,'sd'))+' km.<br><b>Estado:</b> observación; requieren muestra y validación prospectiva antes de recomendar V2.</div>'}
window.addEventListener('mivige:prospective',run);setTimeout(run,6500);setInterval(run,3600000);
})();