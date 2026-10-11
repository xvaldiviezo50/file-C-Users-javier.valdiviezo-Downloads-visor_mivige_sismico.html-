(function(){'use strict';
if(typeof L==='undefined'||typeof map==='undefined')return;
const REGIONS=[
['Tonga–Kermadec',-24,-175,'dinámica distante'],['Vanuatu–Santa Cruz',-15,167,'dinámica distante'],['Islas Salomón',-9,160,'dinámica distante'],['Nueva Bretaña–Papúa',-5,151,'dinámica distante'],['Indonesia–Banda',-7,128,'dinámica distante'],['Sumatra–Andamán',2,95,'antípoda potencial / dinámica'],['Filipinas–Marianas',15,143,'dinámica distante'],['Japón–Kuriles',39,145,'dinámica distante'],['Kamchatka–Aleutianas',53,160,'dinámica distante'],['Nueva Zelanda–Hikurangi',-40,177,'dinámica distante'],['México–Guatemala',15,-94,'corredor tectónico regional'],['Costa Rica–Panamá',9,-83,'corredor tectónico regional'],['Colombia–Ecuador',2,-79,'continuidad regional'],['Ecuador–Perú',-4,-81,'continuidad regional'],['Perú–Chile',-18,-72,'continuidad regional'],['Chile sur–Patagonia',-43,-74,'continuidad regional'],['Caribe sur–Venezuela',11,-67,'borde tectónico regional'],['Dorsal de Chile',-46,-76,'contexto tectónico'],['Fosa Perú–Chile',-28,-72,'contexto tectónico']];
const TARGETS=[['Chile norte',-23.5,-70.5],['Chile central',-32,-71.5],['Perú sur',-16.2,-73.3],['Perú central',-11.5,-77.2],['Perú norte',-6,-80.4],['Ecuador sur',-3.15,-80.2],['Ecuador norte',.55,-79.9],['Colombia Pacífico',3,-78],['Venezuela costera',10.2,-64.5]];
const radians=x=>x*Math.PI/180;
function distance(a,b,c,d){const t=Math.sin(radians(c-a)/2)**2+Math.cos(radians(a))*Math.cos(radians(c))*Math.sin(radians(d-b)/2)**2;return 12742*Math.asin(Math.min(1,Math.sqrt(t)))}
function antipode(lat,lon){return [-lat,lon<0?lon+180:lon-180]}
const layer=L.layerGroup();let enabled=false;
function showResearch(){const p=document.getElementById('mivigeTranspacific');if(p){p.scrollIntoView({behavior:'smooth',block:'start'});p.style.outline='2px solid #80c7ef';setTimeout(()=>p.style.outline='',2200)}}
function ensure(){
 if(document.getElementById('mivigeTranspacific'))return;
 const aside=document.querySelector('aside');if(!aside)return;
 const card=document.createElement('section');card.className='card';card.id='mivigeTranspacific';
 card.innerHTML='<h2>🌐 Red de hipótesis tectónicas y transpacíficas</h2><p class="small">19 regiones de investigación. No representan vínculos causales ni predicciones. Antípodas exactas se calculan por coordenadas; otras relaciones son hipótesis de activación dinámica o continuidad tectónica que requieren validación.</p><label><input type="checkbox" id="tpMapToggle"> Mostrar fuentes en el mapa</label><div id="tpStatus" class="small"></div><div id="tpRows" class="small"></div>';
 aside.prepend(card);
 const antipodalButton=document.getElementById('antiBottomBtn');
 if(antipodalButton){antipodalButton.insertAdjacentHTML('afterend','<button id="tpBottomBtn" type="button" style="position:fixed;right:12px;bottom:64px;z-index:1200;padding:10px;border-radius:20px;background:#123e61;color:white;font-weight:700">🌊 TONGA Y FUENTES TRANSPACÍFICAS</button>');document.getElementById('tpBottomBtn').addEventListener('click',showResearch)}
 const antipodalPanel=document.getElementById('antiBottomPanel');
 if(antipodalPanel){const link=document.createElement('button');link.type='button';link.textContent='🌊 Consultar Tonga y otras fuentes no antipodales';link.style.cssText='display:block;margin:10px 0;padding:9px';link.addEventListener('click',()=>{antipodalPanel.style.display='none';showResearch()});antipodalPanel.appendChild(link)}
 document.getElementById('tpMapToggle').addEventListener('change',e=>{enabled=e.target.checked;draw()});
}
function draw(){
 layer.clearLayers();if(!enabled)return;
 REGIONS.forEach(([name,lat,lon,type])=>L.circleMarker([lat,lon],{radius:5,color:'#80c7ef',fillOpacity:.6}).bindPopup('<b>'+name+'</b><br>'+type+'<br>Hipótesis no validada').addTo(layer));
}
function render(){
 ensure();const events=Array.isArray(window.allEvents)?window.allEvents:[],now=Date.now();
 const rows=REGIONS.map(([name,lat,lon,type])=>{
 const recent=events.filter(e=>Number.isFinite(e.time)&&e.time>=now-72*3600000&&Number(e.mag)>=5&&distance(lat,lon,e.lat,e.lon)<=850);
 const targets=TARGETS.map(([n,a,b])=>{const [p,q]=antipode(a,b);return {name:n,d:distance(lat,lon,p,q)}}).sort((a,b)=>a.d-b.d);
 const nearest=targets[0],anti=nearest.d<=560?'Antípoda geométrica '+nearest.name+' ('+Math.round(nearest.d)+' km)':'Sin coincidencia antipodal ≤560 km';
 return {name,type,n:recent.length,max:recent.length?Math.max(...recent.map(e=>e.mag)):null,anti};
 }).sort((a,b)=>b.n-a.n);
 const status=document.getElementById('tpStatus');if(status)status.textContent='Fuentes observadas M≥5 en 72 h, radio exploratorio 850 km · '+new Date(now).toISOString()+' · conteos descriptivos, sin inferencia causal.';
 const root=document.getElementById('tpRows');if(root)root.innerHTML=rows.map(x=>'<div style="padding:5px 0;border-bottom:1px solid #ffffff22"><b>'+x.name+'</b> · '+x.type+'<br>Eventos M≥5: '+x.n+(x.max?' · Mmáx '+x.max.toFixed(1):'')+'<br>'+x.anti+'</div>').join('');
 window.mivigeResearchRegions={version:'1.0',generatedAt:now,regions:rows,definition:REGIONS};
}
ensure();window.addEventListener('mivige:model',render);setTimeout(render,4500);setInterval(render,300000);
try{L.control.layers({},{'Fuentes tectónicas experimentales':layer},{collapsed:true}).addTo(map)}catch(_){}
})();