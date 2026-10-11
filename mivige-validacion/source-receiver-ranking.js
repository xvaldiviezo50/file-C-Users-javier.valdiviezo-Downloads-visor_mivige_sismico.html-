(function(){'use strict';
const receivers=[['Chile norte',-23.5,-70.5,'Chile'],['Chile central',-32,-71.5,'Chile'],['Perú sur',-16.2,-73.3,'Perú'],['Perú central',-11.5,-77.2,'Perú'],['Perú norte',-6,-80.4,'Perú'],['Ecuador sur',-3.15,-80.2,'Ecuador'],['Ecuador norte',.55,-79.9,'Ecuador'],['Colombia Pacífico',3,-78,'Colombia'],['Colombia Chocó',4.9,-76.75,'Colombia'],['Venezuela costera',10.2,-64.5,'Venezuela']];
const regions=[['Tonga–Kermadec',-24,-175],['Vanuatu–Santa Cruz',-15,167],['Islas Salomón',-9,160],['Nueva Bretaña–Papúa',-5,151],['Indonesia–Banda',-7,128],['Sumatra–Andamán',2,95],['Filipinas–Marianas',15,143],['Japón–Kuriles',39,145],['Kamchatka–Aleutianas',53,160],['Nueva Zelanda–Hikurangi',-40,177],['México–Guatemala',15,-94],['Costa Rica–Panamá',9,-83],['Colombia–Ecuador',2,-79],['Ecuador–Perú',-4,-81],['Perú–Chile',-18,-72],['Chile sur–Patagonia',-43,-74],['Caribe sur–Venezuela',11,-67],['Dorsal de Chile',-46,-76],['Fosa Perú–Chile',-28,-72]];
const rad=x=>x*Math.PI/180;
function dist(a,b,c,d){const q=Math.sin(rad(c-a)/2)**2+Math.cos(rad(a))*Math.cos(rad(c))*Math.sin(rad(d-b)/2)**2;return 12742*Math.asin(Math.min(1,Math.sqrt(q)))}
function anti(a,b){return [-a,b<0?b+180:b-180]}
function country(place){const s=String(place||'').toLowerCase();if(/tonga|kermadec/.test(s))return 'Tonga–Kermadec';if(/vanuatu|santa cruz/.test(s))return 'Vanuatu–Santa Cruz';if(/solomon/.test(s))return 'Islas Salomón';if(/papua|new britain/.test(s))return 'Nueva Bretaña–Papúa';if(/indonesia|sumatra|banda|java/.test(s))return 'Indonesia';if(/chile/.test(s))return 'Chile';if(/peru|perú/.test(s))return 'Perú';if(/ecuador/.test(s))return 'Ecuador';if(/colombia/.test(s))return 'Colombia';if(/panama|panamá/.test(s))return 'Panamá';if(/japan/.test(s))return 'Japón';return ''}
function rank(){
 const modal=document.getElementById('antiBottomPanel');if(!modal)return;
 const events=Array.isArray(window.allEvents)?window.allEvents:[],now=Date.now();
 const pool=events.filter(e=>Number.isFinite(Number(e.lat))&&Number.isFinite(Number(e.lon))&&Number.isFinite(Number(e.time))&&e.time>=now-72*3600000&&Number(e.mag)>=4);
 const selected=[];
 regions.forEach(([name,lat,lon])=>{
  const local=pool.filter(e=>dist(lat,lon,e.lat,e.lon)<=850).sort((a,b)=>Number(b.mag)-Number(a.mag)||b.time-a.time);
  if(local.length)selected.push({name,event:local[0],n:local.length});
 });
 selected.sort((a,b)=>Number(b.event.mag)-Number(a.event.mag)||b.event.time-a.event.time);
 let box=document.getElementById('mivigeUnifiedRank');
 if(!box){box=document.createElement('section');box.id='mivigeUnifiedRank';modal.appendChild(box)}
 const esc=x=>String(x??'').replace(/[&<>"]/g,k=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[k]));
 const all=selected.slice(0,15);
 box.innerHTML='<h3>Ranking fuente → receptores sudamericanos</h3><p style="font-size:12px">Fuentes M≥4 / 72 h; asociación geométrica o distancia, no probabilidad ni pronóstico validado. Distancias antipodales ≤560 km se señalan expresamente.</p>'+all.map((x,i)=>{
  const e=x.event;
  const scored=receivers.map(([name,lat,lon,nation])=>{const a=anti(lat,lon),d=dist(e.lat,e.lon,a[0],a[1]);return {name,nation,d,geo:d<=560}});
  scored.sort((a,b)=>a.d-b.d);
  const matches=scored.filter(q=>q.geo);
  const targets=matches.length?matches:scored.slice(0,3);
  return '<div style="border-top:1px solid #ffffff33;padding:9px 0"><b>#'+(i+1)+' · '+esc(country(e.place)||x.name)+' · M'+Number(e.mag).toFixed(1)+'</b><div style="font-size:12px">'+esc(e.place||x.name)+' · '+new Date(e.time).toLocaleString('es-EC')+'</div><div style="margin-top:5px;font-size:12px"><b>Receptores:</b> '+targets.map(t=>esc(t.nation)+' ('+esc(t.name)+') · '+Math.round(t.d)+' km '+(t.geo?'antípoda':'sin coincidencia antipodal')).join(' | ')+'</div></div>';
 }).join('')+(selected.length?'':'<p>Sin eventos fuente M≥4 registrados en las regiones seleccionadas durante 72 h.</p>');
 const old=document.getElementById('antiBottomRows');if(old)old.style.display='none';
 const prior=document.getElementById('mivigeAllSources');if(prior)prior.style.display='none';
 const button=document.getElementById('antiBottomBtn');if(button)button.textContent='🌐 RANKING FUENTE → RECEPTOR · '+selected.length;
}
setInterval(rank,30000);setTimeout(rank,4500);
})();