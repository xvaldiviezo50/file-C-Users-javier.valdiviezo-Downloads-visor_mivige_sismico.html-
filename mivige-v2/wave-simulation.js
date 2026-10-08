/* Independent educational homogeneous-medium simulation. No model scores modified. */
(()=>{'use strict';
const radius=(v,t,h)=>v*t<h?0:Math.sqrt(Math.max(0,(v*t)**2-h*h));
const travel=(d,h,v)=>Math.hypot(d,h)/v;
window.MIVIGE_WAVE_PHYSICS={radius,travel};
function init(){
 if(!window.L||document.getElementById('waveDialog'))return;
 const style=document.createElement('style');style.textContent=`
 #waveDialog{color:#e6f1fa;background:#102637;border:1px solid #547188;border-radius:14px;width:min(940px,94vw);max-height:92vh;padding:16px;box-sizing:border-box;overflow:auto}
 #waveDialog::backdrop{background:#000b}#waveDialog h2{margin:0;font-size:21px}#waveDialog p{line-height:1.45}#waveDialog button,#waveDialog select,#waveDialog input{font:inherit;padding:7px;border-radius:6px;max-width:100%;box-sizing:border-box}#waveDialog button{cursor:pointer}#waveDialog .wave-fields{display:grid;grid-template-columns:repeat(auto-fit,minmax(125px,1fr));gap:10px}#waveDialog label{display:flex;flex-direction:column;gap:4px;font-size:13px}#waveDialog input{width:100%}#waveMap{height:290px;margin:12px 0;background:#142f42}#waveCanvas{display:block;width:100%;height:230px;background:#091b29;border-radius:8px}#waveDialog .wave-actions{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:12px 0}#waveDialog .wave-note{font-size:13px;color:#bdd0de}#waveDialog #waveError{color:#ffb69e}#waveLauncher{margin:10px;padding:10px 15px;border-radius:8px;cursor:pointer;background:#173e55;color:white;border:1px solid #74b5da}`;
 document.head.append(style);
 const button=document.createElement('button');button.id='waveLauncher';button.textContent='▶ Simular ondas y movimiento del terreno';
 const anchor=document.getElementById('map');if(!anchor)return;anchor.after(button);
 const dialog=document.createElement('dialog');dialog.id='waveDialog';dialog.setAttribute('aria-labelledby','waveTitle');
 dialog.innerHTML=`<div style="display:flex;justify-content:space-between;gap:10px"><h2 id="waveTitle">Ondas sísmicas · simulación ilustrativa</h2><button id="waveClose" aria-label="Cerrar simulación">Cerrar ✕</button></div>
 <p class="wave-note">Ondas P (azul) y S (naranja) en un medio homogéneo. Movimiento transitorio amplificado en unidades arbitrarias: no es deformación GNSS/InSAR, daño estimado ni proyección de futuros sismos.</p>
 <label>Sismo de referencia o escenario<select id="waveSource"><option value="manual">Escenario configurable · no es un evento observado</option></select></label>
 <div class="wave-fields" style="margin-top:10px"><label>Latitud (°)<input id="waveLat" type="number" min="-85" max="85" step="0.001" value="-1.5"></label><label>Longitud (°)<input id="waveLon" type="number" min="-180" max="180" step="0.001" value="-79"></label><label>Profundidad (km)<input id="waveDepth" type="number" min="0" max="700" value="20"></label><label>Velocidad P (km/s)<input id="waveVp" type="number" min="1" max="15" step="0.1" value="6"></label><label>Velocidad S (km/s)<input id="waveVs" type="number" min="0.1" max="10" step="0.1" value="3.5"></label></div>
 <p id="waveError" role="alert"></p><div class="wave-actions"><button id="wavePlay">▶ Reproducir</button><button id="waveReset">Reiniciar</button><label>Velocidad de animación<select id="waveSpeed"><option value="1">1×</option><option value="5" selected>5×</option><option value="10">10×</option></select></label><button id="waveFit">Centrar escenario</button></div>
 <label>Tiempo simulado desde la ruptura: <output id="waveTime">0 s</output><input id="waveTimeline" aria-label="Tiempo desde la ruptura en segundos" type="range" min="0" max="180" step="0.1" value="0"></label>
 <div id="waveMap" aria-label="Mapa de frentes de ondas simulados"></div><p class="wave-note">Los círculos representan la intersección de cada frente con la superficie. Pulsa el mapa para colocar un receptor a ≤500 km del epicentro.</p><p id="waveArrival" role="status"></p>
 <canvas id="waveCanvas" role="img" aria-label="Corte esquemático de movimiento P y S exagerado; eje horizontal distancia y eje vertical profundidad"></canvas>
 <p class="wave-note">Corte de un lado del epicentro hacia el receptor. Las partículas oscilan; no viajan con el frente. P: movimiento paralelo a la propagación. S: perpendicular. Magnitud y amplitud física no se calculan.</p>
 <details><summary>Supuestos de la simulación</summary><p class="wave-note">Velocidades iniciales supuestas: P=6 y S=3,5 km/s, editables y sin calibración local. Trayectorias rectas, fuente puntual y superficie plana; sin refracción, relieve, ondas superficiales ni efectos del suelo. El mapa aproxima distancias geográficas hasta 500 km. Radio superficial r=√((v·t)²−h²), después de t=h/v. Tiempo de llegada al receptor: √(d²+h²)/v. La amplitud dibujada es arbitraria; no representa desplazamiento permanente ni transferencia de esfuerzos. Los parámetros se reinician al abrir y no alteran el modelo MIVIGE.</p></details>`;
 document.body.append(dialog);
 const el=id=>document.getElementById(id), fields=['waveLat','waveLon','waveDepth','waveVp','waveVs'];
 let m,origin,pWave,sWave,receiver,receiverLine,events=[],t=0,playing=false,raf=0,last=0,cfg,dist=100,receiverPoint=null;
 function read(){const a=fields.map(id=>el(id).value.trim()===''?NaN:Number(el(id).value));const [lat,lon,h,vp,vs]=a;
 if(a.some(v=>!Number.isFinite(v))||Math.abs(lat)>85||Math.abs(lon)>180||h<0||h>700||vp<1||vp>15||vs<=0||vs>10||vs>=vp){el('waveError').textContent='Revisa coordenadas, profundidad (0–700 km) y velocidades: P debe ser mayor que S.';return false;}
 cfg={lat,lon,h,vp,vs};el('waveError').textContent='';return true;}
 function pause(){playing=false;cancelAnimationFrame(raf);el('wavePlay').textContent='▶ Reproducir';last=0;}
 function point(){return receiverPoint||[cfg.lat, cfg.lon+(100/(111.195*Math.cos(cfg.lat*Math.PI/180)))];}
 function setup(){if(!read())return false;t=0;el('waveTimeline').max=String(Math.ceil(travel(500,cfg.h,cfg.vs)+10));
 const o=[cfg.lat,cfg.lon];origin.setLatLng(o);pWave.setLatLng(o);sWave.setLatLng(o);receiver.setLatLng(point());receiverLine.setLatLngs([o,point()]);dist=m.distance(o,point())/1000;draw();return true;}
 function draw(){if(!cfg)return;el('waveTimeline').value=t;el('waveTime').textContent=t.toFixed(1)+' s';
 const rp=radius(cfg.vp,t,cfg.h),rs=radius(cfg.vs,t,cfg.h);
 pWave.setRadius(Math.min(500,rp)*1000).setStyle({opacity:rp>0&&rp<=500?.9:0,fillOpacity:0});sWave.setRadius(Math.min(500,rs)*1000).setStyle({opacity:rs>0&&rs<=500?.9:0,fillOpacity:0});
 el('waveArrival').textContent=`Receptor a ${dist.toFixed(1)} km · llegada P: ${travel(dist,cfg.h,cfg.vp).toFixed(1)} s · llegada S: ${travel(dist,cfg.h,cfg.vs).toFixed(1)} s. Tiempos ilustrativos.`;
 const canvas=el('waveCanvas'),w=canvas.clientWidth||600,h=230,dpr=window.devicePixelRatio||1;canvas.width=w*dpr;canvas.height=h*dpr;const ctx=canvas.getContext('2d');ctx.scale(dpr,dpr);ctx.clearRect(0,0,w,h);
 const x0=44,y0=30,ww=w-62,hh=166,maxZ=Math.max(100,cfg.h*1.2),sx=ww/500,sz=hh/maxZ;
 ctx.strokeStyle='#50677a';ctx.beginPath();ctx.moveTo(x0,y0);ctx.lineTo(w-18,y0);ctx.stroke();ctx.fillStyle='#c0d3df';ctx.font=(w<420?'10':'12')+'px sans-serif';ctx.fillText('Superficie · distancia horizontal 0–500 km',x0,17);ctx.fillText(`Profundidad 0–${maxZ.toFixed(0)} km · ejes con escalas distintas`,x0,220);
 for(let x=0;x<=500;x+=20)for(let z=0;z<=maxZ;z+=maxZ/10){const dz=z-cfg.h,r=Math.hypot(x,dz),ux=r?x/r:0,uz=r?dz/r:0;
 const packet=v=>{const q=t-r/v;return q>0&&q<8?Math.sin(Math.PI*q/4)**2*Math.sin(Math.PI*q):0;};
 const ap=packet(cfg.vp),as=packet(cfg.vs),px=x0+x*sx,py=y0+z*sz;
 ctx.fillStyle='#436075';ctx.fillRect(px-1,py-1,2,2);ctx.fillStyle=Math.abs(ap)>Math.abs(as)?'#6bd6ff':'#ffb263';ctx.beginPath();ctx.arc(px+7*(ap*ux-as*uz),py+7*(ap*uz+as*ux),2,0,Math.PI*2);ctx.fill();}
 ctx.save();ctx.beginPath();ctx.rect(x0,y0,ww,hh);ctx.clip();for(const [v,color] of [[cfg.vp,'#6bd6ff'],[cfg.vs,'#ffb263']]){ctx.strokeStyle=color;ctx.beginPath();ctx.ellipse(x0,y0+cfg.h*sz,v*t*sx,v*t*sz,0,0,Math.PI*2);ctx.stroke();}ctx.restore();ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(x0,y0+cfg.h*sz,5,0,Math.PI*2);ctx.fill();ctx.fillText('Fuente',x0+8,Math.min(199,y0+cfg.h*sz));
 }
 function tick(now){if(!playing)return;if(last)t=Math.min(Number(el('waveTimeline').max),t+(now-last)/1000*Number(el('waveSpeed').value));last=now;draw();if(t>=Number(el('waveTimeline').max))pause();else raf=requestAnimationFrame(tick);}
 function populate(){el('waveSource').length=1;let raw=window.allEvents||[];events=raw.filter(e=>e.lat!=null&&e.lon!=null&&Number.isFinite(Number(e.lat))&&Number.isFinite(Number(e.lon))&&e.depth!=null&&Number.isFinite(Number(e.depth))).slice().sort((a,b)=>b.time-a.time).slice(0,200);events.forEach((e,i)=>{const o=document.createElement('option');o.value=i;o.textContent=`${e.place||e.source||'Sismo'} · M${e.mag??'?'} · ${Number.isFinite(Number(e.time))?new Date(Number(e.time)).toLocaleString('es-EC'):'fecha no disponible'}`;el('waveSource').append(o);});}
 button.onclick=()=>{dialog.showModal();populate();fields.forEach((id,i)=>el(id).value=[-1.5,-79,20,6,3.5][i]);receiverPoint=null;
 if(!m){m=L.map('waveMap').setView([-1.5,-79],6);L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap contributors',maxZoom:15}).addTo(m);origin=L.circleMarker([-1.5,-79],{radius:6,color:'#fff'}).addTo(m).bindTooltip('Fuente del escenario');pWave=L.circle([-1.5,-79],{radius:0,color:'#6bd6ff',weight:3,fill:false,interactive:false}).addTo(m);sWave=L.circle([-1.5,-79],{radius:0,color:'#ffb263',weight:3,fill:false,interactive:false}).addTo(m);receiver=L.marker([-1.5,-78]).addTo(m).bindTooltip('Receptor simulado');receiverLine=L.polyline([],{color:'#9badbb',dashArray:'4 6',weight:1}).addTo(m);
 m.on('click',e=>{if(!cfg)return;const d=m.distance([cfg.lat,cfg.lon],e.latlng)/1000;if(d>500){el('waveError').textContent='Coloca el receptor dentro de 500 km del epicentro.';return;}el('waveError').textContent='';receiverPoint=[e.latlng.lat,e.latlng.lng];dist=d;receiver.setLatLng(receiverPoint);receiverLine.setLatLngs([[cfg.lat,cfg.lon],receiverPoint]);draw();});}
 m.invalidateSize();setup();m.setView([cfg.lat,cfg.lon],6);};
 el('waveSource').onchange=()=>{pause();const e=events[Number(el('waveSource').value)];if(el('waveSource').value!=='manual'&&e){el('waveLat').value=e.lat;el('waveLon').value=e.lon;el('waveDepth').value=e.depth;}receiverPoint=null;if(setup())m.setView([cfg.lat,cfg.lon],6);};
 fields.forEach(id=>el(id).onchange=()=>{pause();el('waveSource').value='manual';receiverPoint=null;setup();});
 el('wavePlay').onclick=()=>{if(playing){pause();return;}if(!read())return;if(t>=Number(el('waveTimeline').max))t=0;playing=true;el('wavePlay').textContent='Ⅱ Pausar';raf=requestAnimationFrame(tick);};
 el('waveReset').onclick=()=>{pause();setup();};el('waveTimeline').oninput=()=>{pause();t=Number(el('waveTimeline').value);draw();};el('waveFit').onclick=()=>{if(cfg)m.setView([cfg.lat,cfg.lon],6);};
 el('waveClose').onclick=()=>dialog.close();dialog.addEventListener('close',()=>{pause();button.focus();});document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});window.addEventListener('resize',()=>{if(dialog.open){m.invalidateSize();draw();}});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
