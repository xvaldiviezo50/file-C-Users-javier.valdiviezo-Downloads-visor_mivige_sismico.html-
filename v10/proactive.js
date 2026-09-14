(function(){
  try{
    const WATCH_HOURS=72;
    const SNAPSHOT_KEY='mivigeProactiveSnapshotV2';
    const proactiveLayer=(typeof L!=='undefined' && typeof map!=='undefined' && L.layerGroup)?L.layerGroup().addTo(map):null;

    const refs=[
      {name:'Tumbes–El Oro–Puná–Golfo',lat:-3.25,lon:-80.15},
      {name:'Azuay–Cuenca',lat:-2.90,lon:-79.02},
      {name:'Pallatanga–Riobamba',lat:-1.80,lon:-78.75},
      {name:'Quito',lat:-0.20,lon:-78.50},
      {name:'Carchi–Ibarra–Otavalo',lat:0.45,lon:-78.15},
      {name:'Esmeraldas–Manabí',lat:-0.55,lon:-80.35},
      {name:'Loreto–Andoas–Datem del Marañón',lat:-3.00,lon:-76.45},
      {name:'Amazonas–Condorcanqui',lat:-4.25,lon:-77.75},
      {name:'Jaén–Bagua–Cajamarca',lat:-5.75,lon:-78.69},
      {name:'Chocó–Darién/Nariño',lat:3.40,lon:-77.00},
      {name:'Costa Rica',lat:9.8,lon:-84.1},
      {name:'Oaxaca–Guerrero–Chiapas',lat:16.0,lon:-96.5},
      {name:'Chile centro-norte',lat:-28.5,lon:-71.4}
    ];

    // Gazetteer local del visor: permite traducir el centro de cada clúster a un lugar
    // comprensible sin depender de un servicio externo de geocodificación.
    const places=[
      // Ecuador
      {name:'Esmeraldas',region:'Esmeraldas',country:'Ecuador',lat:0.968,lon:-79.651},{name:'Muisne',region:'Esmeraldas',country:'Ecuador',lat:0.611,lon:-80.020},{name:'Pedernales',region:'Manabí',country:'Ecuador',lat:0.072,lon:-80.052},{name:'Jama',region:'Manabí',country:'Ecuador',lat:-0.204,lon:-80.263},{name:'Bahía de Caráquez',region:'Manabí',country:'Ecuador',lat:-0.601,lon:-80.423},{name:'Manta',region:'Manabí',country:'Ecuador',lat:-0.954,lon:-80.733},{name:'Puerto López',region:'Manabí',country:'Ecuador',lat:-1.560,lon:-80.812},{name:'Guayaquil',region:'Guayas',country:'Ecuador',lat:-2.171,lon:-79.922},{name:'Posorja',region:'Guayas',country:'Ecuador',lat:-2.710,lon:-80.240},{name:'Playas',region:'Guayas',country:'Ecuador',lat:-2.639,lon:-80.389},{name:'Naranjal',region:'Guayas',country:'Ecuador',lat:-2.674,lon:-79.618},{name:'Machala',region:'El Oro',country:'Ecuador',lat:-3.258,lon:-79.960},{name:'Huaquillas',region:'El Oro',country:'Ecuador',lat:-3.476,lon:-80.230},{name:'Cuenca',region:'Azuay',country:'Ecuador',lat:-2.900,lon:-79.005},{name:'Azogues',region:'Cañar',country:'Ecuador',lat:-2.739,lon:-78.849},{name:'Loja',region:'Loja',country:'Ecuador',lat:-3.993,lon:-79.205},{name:'Riobamba',region:'Chimborazo',country:'Ecuador',lat:-1.664,lon:-78.654},{name:'Pallatanga',region:'Chimborazo',country:'Ecuador',lat:-2.002,lon:-78.965},{name:'Ambato',region:'Tungurahua',country:'Ecuador',lat:-1.249,lon:-78.616},{name:'Latacunga',region:'Cotopaxi',country:'Ecuador',lat:-0.935,lon:-78.615},{name:'Quito',region:'Pichincha',country:'Ecuador',lat:-0.180,lon:-78.468},{name:'Santo Domingo',region:'Santo Domingo',country:'Ecuador',lat:-0.253,lon:-79.175},{name:'Otavalo',region:'Imbabura',country:'Ecuador',lat:0.234,lon:-78.261},{name:'Ibarra',region:'Imbabura',country:'Ecuador',lat:0.351,lon:-78.123},{name:'El Ángel',region:'Carchi',country:'Ecuador',lat:0.622,lon:-77.940},{name:'Tulcán',region:'Carchi',country:'Ecuador',lat:0.812,lon:-77.718},
      // Perú
      {name:'Tumbes',region:'Tumbes',country:'Perú',lat:-3.566,lon:-80.451},{name:'Zorritos',region:'Tumbes',country:'Perú',lat:-3.680,lon:-80.678},{name:'Máncora',region:'Piura',country:'Perú',lat:-4.107,lon:-81.047},{name:'Talara',region:'Piura',country:'Perú',lat:-4.579,lon:-81.271},{name:'Sullana',region:'Piura',country:'Perú',lat:-4.903,lon:-80.685},{name:'Piura',region:'Piura',country:'Perú',lat:-5.194,lon:-80.632},{name:'Jaén',region:'Cajamarca',country:'Perú',lat:-5.709,lon:-78.807},{name:'Bagua',region:'Amazonas',country:'Perú',lat:-5.638,lon:-78.531},{name:'Chachapoyas',region:'Amazonas',country:'Perú',lat:-6.231,lon:-77.870},{name:'Santa María de Nieva',region:'Amazonas',country:'Perú',lat:-4.592,lon:-77.864},{name:'Andoas',region:'Loreto',country:'Perú',lat:-2.902,lon:-76.403},{name:'San Lorenzo',region:'Loreto',country:'Perú',lat:-4.828,lon:-76.555},{name:'Yurimaguas',region:'Loreto',country:'Perú',lat:-5.896,lon:-76.104},{name:'Iquitos',region:'Loreto',country:'Perú',lat:-3.749,lon:-73.254},{name:'Moyobamba',region:'San Martín',country:'Perú',lat:-6.034,lon:-76.972},{name:'Tarapoto',region:'San Martín',country:'Perú',lat:-6.487,lon:-76.359},{name:'Cajamarca',region:'Cajamarca',country:'Perú',lat:-7.161,lon:-78.513},{name:'Chiclayo',region:'Lambayeque',country:'Perú',lat:-6.771,lon:-79.840},{name:'Trujillo',region:'La Libertad',country:'Perú',lat:-8.111,lon:-79.029},{name:'Lima',region:'Lima',country:'Perú',lat:-12.046,lon:-77.043},
      // Colombia
      {name:'Ipiales',region:'Nariño',country:'Colombia',lat:0.831,lon:-77.644},{name:'Pasto',region:'Nariño',country:'Colombia',lat:1.214,lon:-77.281},{name:'Tumaco',region:'Nariño',country:'Colombia',lat:1.807,lon:-78.764},{name:'Popayán',region:'Cauca',country:'Colombia',lat:2.444,lon:-76.614},{name:'Cali',region:'Valle del Cauca',country:'Colombia',lat:3.451,lon:-76.532},{name:'Buenaventura',region:'Valle del Cauca',country:'Colombia',lat:3.880,lon:-77.031},{name:'Quibdó',region:'Chocó',country:'Colombia',lat:5.691,lon:-76.658},{name:'Medellín',region:'Antioquia',country:'Colombia',lat:6.244,lon:-75.581},{name:'Bogotá',region:'Cundinamarca',country:'Colombia',lat:4.711,lon:-74.072},
      // Costa Rica
      {name:'San José',region:'San José',country:'Costa Rica',lat:9.928,lon:-84.091},{name:'Nicoya',region:'Guanacaste',country:'Costa Rica',lat:10.148,lon:-85.453},{name:'Quepos',region:'Puntarenas',country:'Costa Rica',lat:9.431,lon:-84.162},{name:'Limón',region:'Limón',country:'Costa Rica',lat:9.991,lon:-83.036},
      // México
      {name:'Tapachula',region:'Chiapas',country:'México',lat:14.906,lon:-92.263},{name:'Tuxtla Gutiérrez',region:'Chiapas',country:'México',lat:16.753,lon:-93.116},{name:'Salina Cruz',region:'Oaxaca',country:'México',lat:16.177,lon:-95.200},{name:'Puerto Escondido',region:'Oaxaca',country:'México',lat:15.872,lon:-97.077},{name:'Oaxaca de Juárez',region:'Oaxaca',country:'México',lat:17.073,lon:-96.726},{name:'Acapulco',region:'Guerrero',country:'México',lat:16.853,lon:-99.823},{name:'Chilpancingo',region:'Guerrero',country:'México',lat:17.552,lon:-99.501},
      // Chile
      {name:'Arica',region:'Arica y Parinacota',country:'Chile',lat:-18.478,lon:-70.312},{name:'Iquique',region:'Tarapacá',country:'Chile',lat:-20.214,lon:-70.152},{name:'Antofagasta',region:'Antofagasta',country:'Chile',lat:-23.650,lon:-70.400},{name:'Copiapó',region:'Atacama',country:'Chile',lat:-27.366,lon:-70.332},{name:'La Serena',region:'Coquimbo',country:'Chile',lat:-29.902,lon:-71.252},{name:'Valparaíso',region:'Valparaíso',country:'Chile',lat:-33.047,lon:-71.613},{name:'Santiago',region:'Metropolitana',country:'Chile',lat:-33.449,lon:-70.669}
    ];

    function fp(e){const bucket=Math.round(e.time/(5*60*1000));return [bucket,Math.round(e.lat*5),Math.round(e.lon*5)].join(':');}
    function loadSnapshot(){try{return JSON.parse(localStorage.getItem(SNAPSHOT_KEY)||'null');}catch(e){return null;}}
    function saveSnapshot(events){try{localStorage.setItem(SNAPSHOT_KEY,JSON.stringify({time:Date.now(),ids:events.slice(0,500).map(fp)}));}catch(e){}}
    function nearestRef(lat,lon){let best=null;refs.forEach(r=>{const d=distKm(lat,lon,r.lat,r.lon);if(!best||d<best.d)best={...r,d};});return best;}
    function nearestPlace(lat,lon){let best=null;places.forEach(p=>{const d=distKm(lat,lon,p.lat,p.lon);if(!best||d<best.d)best={...p,d};});return best;}
    function bearing(lat1,lon1,lat2,lon2){const p=Math.PI/180;const a=lat1*p,b=lat2*p,dl=(lon2-lon1)*p;const y=Math.sin(dl)*Math.cos(b);const x=Math.cos(a)*Math.sin(b)-Math.sin(a)*Math.cos(b)*Math.cos(dl);return (Math.atan2(y,x)*180/Math.PI+360)%360;}
    function dir8(deg){return ['N','NE','E','SE','S','SO','O','NO'][Math.round(deg/45)%8];}
    function locationLabel(lat,lon){
      const p=nearestPlace(lat,lon);const r=nearestRef(lat,lon);
      if(p){
        if(p.d<=25)return {label:`${p.name}, ${p.region} (${p.country})`,place:p,zone:r,dist:p.d};
        if(p.d<=260){const dir=dir8(bearing(p.lat,p.lon,lat,lon));return {label:`≈${Math.round(p.d)} km ${dir} de ${p.name}, ${p.region} (${p.country})`,place:p,zone:r,dist:p.d};}
      }
      if(r&&r.d<=420)return {label:`Sector ${r.name}`,place:p,zone:r,dist:p?.d||null};
      if(p){const dir=dir8(bearing(p.lat,p.lon,lat,lon));return {label:`Sector regional ≈${Math.round(p.d)} km ${dir} de ${p.name} (${p.country})`,place:p,zone:r,dist:p.d};}
      return {label:`Sector regional`,place:null,zone:r,dist:null};
    }
    function depthStd(events){if(events.length<2)return 0;const avg=events.reduce((s,e)=>s+e.depth,0)/events.length;return Math.sqrt(events.reduce((s,e)=>s+Math.pow(e.depth-avg,2),0)/events.length);}

    function clusterEvents(events){
      const cutoff=Date.now()-WATCH_HOURS*3600000;
      const pool=events.filter(e=>e.time>=cutoff&&e.mag>=3.0&&e.lat>=-35&&e.lat<=20&&e.lon>=-111&&e.lon<=-70).sort((a,b)=>b.time-a.time);
      const clusters=[];
      pool.forEach(e=>{
        const fam=tectonicFamily(e);const radius=fam==='intraslab'?280:fam==='intermediate'?230:190;let best=null;
        clusters.forEach(c=>{if(c.family!==fam)return;const d=distKm(e.lat,e.lon,c.lat,c.lon);if(d<=radius&&(!best||d<best.d))best={c,d};});
        if(!best){clusters.push({family:fam,events:[e],lat:e.lat,lon:e.lon});}
        else{const c=best.c;c.events.push(e);const w=c.events.reduce((s,x)=>s+Math.max(1,x.mag-2),0);c.lat=c.events.reduce((s,x)=>s+x.lat*Math.max(1,x.mag-2),0)/w;c.lon=c.events.reduce((s,x)=>s+x.lon*Math.max(1,x.mag-2),0)/w;}
      });
      return clusters.map(c=>{
        c.events.sort((a,b)=>b.time-a.time);
        const latest=c.events[0],maxMag=Math.max(...c.events.map(e=>e.mag)),count35=c.events.filter(e=>e.mag>=3.5).length,count45=c.events.filter(e=>e.mag>=4.5).length;
        const r12=c.events.filter(e=>Date.now()-e.time<=12*3600000).length,p12=c.events.filter(e=>Date.now()-e.time>12*3600000&&Date.now()-e.time<=24*3600000).length;
        const accelerating=r12>=2&&r12>p12*1.35,recencyH=(Date.now()-latest.time)/3600000,depStd=depthStd(c.events),meanDepth=c.events.reduce((s,e)=>s+e.depth,0)/c.events.length;
        let score=0;score+=maxMag>=6?55:maxMag>=5?42:maxMag>=4.5?32:maxMag>=4?22:10;score+=Math.min(24,count35*8);score+=Math.min(15,c.events.length*3);score+=recencyH<=6?12:recencyH<=24?8:recencyH<=48?4:0;if(accelerating)score+=10;if(c.events.length>=2&&depStd<=20)score+=6;if(count45>=2)score+=8;score=Math.min(100,score);
        const loc=locationLabel(c.lat,c.lon);const zoneName=loc.zone&&loc.zone.d<=420?loc.zone.name:null;
        return {...c,latest,maxMag,count35,count45,accelerating,recencyH,depStd,meanDepth,score,name:loc.label,zoneName,placeDistance:loc.dist,refDistance:loc.zone?.d||null};
      }).filter(c=>c.maxMag>=4.0||c.count35>=2||c.events.length>=3).sort((a,b)=>b.score-a.score);
    }

    function familyLabel(f){return f==='intraslab'?'Intraslab':f==='intermediate'?'Intermedia / placa subducida':f==='interface'?'Interfaz / somera costera':'Cortical somera';}
    function level(c){return c.score>=75?'Vigilancia reforzada':c.score>=55?'Alta prioridad':c.score>=38?'Observación prioritaria':'Seguimiento';}
    function levelColor(c){return c.score>=75?'#e4493f':c.score>=55?'#f08a24':c.score>=38?'#f0c644':'#52a8ff';}
    function action(c){if(c.family==='intraslab')return 'Revisar continuidad 70–150 km, mecanismos focales y migración hipocentral; mantener separado del riesgo cortical.';if(c.family==='intermediate')return 'Revisar geometría de la placa subducida, profundidad y continuidad espacial de los hipocentros.';if(c.family==='interface')return 'Revisar secuencia de interfaz, magnitud/profundidad, mecanismos y boletines de tsunami si la magnitud aumenta.';return 'Contrastar con fallas activas, profundidad, mecanismos focales y clustering cortical.';}
    function why(c){const bits=[`Mmáx ${c.maxMag.toFixed(1)}`,`${c.events.length} eventos M≥3`,`${c.count35} M≥3.5`,`prof. media ${c.meanDepth.toFixed(0)} km`];if(c.accelerating)bits.push('tasa 12 h en aumento');if(c.events.length>=2&&c.depStd<=20)bits.push('profundidad coherente');return bits.join(' · ');}
    function zoneLine(c){return c.zoneName&&c.name.indexOf(c.zoneName)<0?`<br><span style="color:#9db2c8">Zona MIVIGE: ${c.zoneName}</span>`:'';}

    function ensurePanel(){
      if(document.getElementById('proactiveCard'))return;const aside=document.querySelector('aside');if(!aside)return;
      const card=document.createElement('section');card.className='card';card.id='proactiveCard';
      card.innerHTML=`<h2>🧭 Focos preventivos automáticos</h2><div class="kpis"><div class="kpi"><div class="name">Actualización</div><div class="val" id="proactiveStatus" style="font-size:13px">Esperando datos…</div></div><div class="kpi"><div class="name">Eventos nuevos</div><div class="val" id="newEventCount">—</div></div><div class="kpi"><div class="name">Foco principal</div><div class="val" id="mainFocus" style="font-size:13px">—</div></div><div class="kpi"><div class="name">Acción del agente</div><div class="val" id="mainAction" style="font-size:12px">—</div></div></div><div id="focusList" style="margin-top:8px"></div><div class="small" style="margin-top:8px"><b>Motor proactivo:</b> el ranking muestra <b>Prioridad #1, #2…</b>. Cada foco se traduce a la localidad conocida más cercana y muestra distancia/dirección cuando el centro está fuera de una ciudad. Las coordenadas quedan solo como dato técnico secundario. Es una prioridad de vigilancia, no una predicción determinista.</div>`;
      const active=document.getElementById('zonesActive')?.closest('.card');if(active)active.insertAdjacentElement('beforebegin',card);else aside.insertBefore(card,aside.firstChild);
    }

    function drawFocus(clusters){
      if(!proactiveLayer)return;proactiveLayer.clearLayers();
      clusters.slice(0,6).forEach((c,i)=>{const col=levelColor(c),radius=Math.max(70000,Math.min(240000,70000+c.events.length*18000+c.maxMag*8000));L.circle([c.lat,c.lon],{radius,color:col,weight:i===0?3:2,fillColor:col,fillOpacity:i===0?.13:.07,dashArray:'7 5'}).bindPopup(`<b>Prioridad #${i+1} · ${c.name}</b>${zoneLine(c)}<br>${level(c)} · score operativo ${c.score}/100<br>${familyLabel(c.family)}<br>${why(c)}<br><span style="color:#9db2c8">Centro técnico: ${c.lat.toFixed(2)}°, ${c.lon.toFixed(2)}°</span><br><br><b>Observación recomendada:</b> ${action(c)}`).addTo(proactiveLayer);});
    }

    function updateProactive(events){
      ensurePanel();if(!Array.isArray(events))events=[];const prev=loadSnapshot(),prevIds=new Set(prev?.ids||[]),baseline=!prev,newEvents=baseline?[]:events.filter(e=>!prevIds.has(fp(e))&&e.time>=Date.now()-6*3600000),clusters=clusterEvents(events);drawFocus(clusters);const top=clusters[0];
      const status=document.getElementById('proactiveStatus');if(status)status.textContent=`Recalculado · ${fmtFull(Date.now())}`;const cnt=document.getElementById('newEventCount');if(cnt)cnt.textContent=baseline?'Base inicial':String(newEvents.length);const mf=document.getElementById('mainFocus');if(mf)mf.textContent=top?`${top.name} · ${level(top)}`:'Sin foco prioritario';const ma=document.getElementById('mainAction');if(ma)ma.textContent=top?action(top):'Mantener vigilancia de fondo';
      const host=document.getElementById('focusList');if(host){host.innerHTML=clusters.length?clusters.slice(0,6).map((c,i)=>`<div class="listitem"><div class="dot" style="background:${levelColor(c)}"></div><div><div class="zname"><b>Prioridad #${i+1}</b> · ${c.name}</div><div class="zdesc">${familyLabel(c.family)} · score ${c.score}/100${c.zoneName?` · zona: ${c.zoneName}`:''}<br>${why(c)}<br><b>Focalizar:</b> ${action(c)}<br><span style="color:#7894ac">Centro técnico ${c.lat.toFixed(2)}°, ${c.lon.toFixed(2)}°</span></div></div><div class="pct">${level(c)}</div></div>`).join(''):'<div class="small">No se detectan focos dinámicos que superen el umbral operativo en la ventana actual.</div>';}
      if(newEvents.length){const material=newEvents.filter(e=>e.mag>=5),msg=material.length?`${material.length} evento(s) nuevo(s) M≥5 incorporados automáticamente.`:`${newEvents.length} evento(s) nuevo(s) incorporados desde la revisión anterior.`;try{if(typeof pushAgentLog==='function')pushAgentLog(`Motor proactivo: ${msg}${top?` Foco principal: <b>${top.name}</b> (${level(top)}).`:''}`,material.length?'orange':'blue');}catch(e){}}
      saveSnapshot(events);window.mivigeProactiveClusters=clusters;
    }

    ensurePanel();if(proactiveLayer&&typeof L!=='undefined'&&L.control?.layers){try{L.control.layers({}, {'Focos preventivos automáticos':proactiveLayer},{collapsed:true,position:'topright'}).addTo(map);}catch(e){}}
    const originalRender=window.render;if(typeof originalRender==='function'){window.render=function(all){const out=originalRender.apply(this,arguments);try{updateProactive(all);}catch(e){console.warn('MIVIGE proactive update failed',e);}return out;};}
    setTimeout(()=>{try{if(Array.isArray(window.allEvents)&&window.allEvents.length)updateProactive(window.allEvents);}catch(e){}},1800);window.mivigeUpdateProactive=updateProactive;
  }catch(err){console.warn('MIVIGE proactive engine unavailable',err);}
})();