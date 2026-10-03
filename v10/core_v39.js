(function(){
  const SCI={
    sourceMag:5.0,
    recentHours:72,
    activeMag:4.5
  };

  function updateSources(){
    const d=document.getElementById('sources'); if(!d) return;
    d.innerHTML='';
    for(const [name,s] of Object.entries(sourceStatus)){
      d.insertAdjacentHTML('beforeend',
        '<div class="statusrow"><span>'+name+'</span><span class="'+(s.ok?'ok':'bad')+'">'+
        (s.ok?'✓ '+s.count+' registros':'✕ no disponible')+'</span></div>');
    }
  }

  function renderMap(regional){
    eventLayer.clearLayers(); eqZoneLayer.clearLayers(); extZoneLayer.clearLayers(); iaexLayer.clearLayers();
    regional.forEach(e=>{
      const r=Math.max(4,Math.min(15,3+e.mag*1.7));
      L.circleMarker([e.lat,e.lon],{
        radius:r,color:tectonicColor(e),weight:2.5,fillColor:magColor(e.mag),fillOpacity:.9
      }).bindPopup('<b>'+e.source+'</b><br>M '+e.mag.toFixed(1)+' · '+e.depth.toFixed(0)+' km<br><b>Clasificación preliminar:</b> '+tectonicClass(e)+'<br>'+ecuTime(e.time)+' ECU<br>'+(e.place||''))
        .addTo(eventLayer);
    });
  }

  function scientificState(regional,hours){
    const idsRaw=regional.reduce((s,e)=>s+eventContribution(e,hours),0);
    const ids=Math.min(100,Math.round(100*(1-Math.exp(-idsRaw/12))));
    const mmax=regional.length?Math.max(...regional.map(e=>e.mag)):0;
    const recent6=regional.filter(e=>Date.now()-e.time<=6*3600000).length;
    const prev6=regional.filter(e=>Date.now()-e.time>6*3600000&&Date.now()-e.time<=12*3600000).length;
    const rate=recent6>=2 && recent6>prev6*1.5 ? 'Tasa reciente ↑' : recent6<prev6 ? 'Tasa reciente ↓' : 'Tasa estable';
    const material=regional.filter(e=>e.mag>=SCI.activeMag).length;
    return {ids,mmax,rate,material};
  }

  function setAgent(sci){
    const sem=document.getElementById('semaforo');
    let label='VERDE · vigilancia de fondo', bg='#174f2c';
    if(sci.mmax>=6.0 || sci.material>=2){label='AMARILLO · vigilancia sísmica reforzada';bg='#6b5715';}
    else if(sci.mmax>=SCI.activeMag || sci.rate==='Tasa reciente ↑'){label='AMARILLO · señal sísmica activa';bg='#6b5715';}
    if(sem){sem.textContent=label;sem.style.background=bg;}
    const dec=document.getElementById('agentDecision');
    if(dec) dec.textContent=sci.mmax?('Mmáx regional '+sci.mmax.toFixed(1)+' · '+sci.rate):'Sin señal material';
    const bias=document.getElementById('biasCtrl'); if(bias) bias.textContent='Solo variables sísmicas/tectónicas';
  }

  function render(all){
    const hours=Number(document.getElementById('window').value);
    const minmag=Number(document.getElementById('minmag').value);
    const cutoff=Date.now()-hours*3600000;
    const tectFilter=document.getElementById('tectonicFilter').value;

    const regionalAll=all.filter(e=>e.time>=cutoff&&e.mag>=minmag&&e.lat>=-35&&e.lat<=20&&e.lon>=-111&&e.lon<=-66);
    const regional=regionalAll.filter(e=>tectFilter==='all'||tectonicFamily(e)===tectFilter);

    const sci=scientificState(regionalAll,hours);
    const ids=document.getElementById('ids'); if(ids) ids.textContent=sci.ids+'/100';
    const iite=document.getElementById('iite'); if(iite) iite.textContent='Mecanismo/Coulomb: pendiente';
    const iadr=document.getElementById('iadr'); if(iadr) iadr.textContent=sci.rate;

    const azuayWatch=computeAzuayIntraslab(all,hours);
    if(document.getElementById('azuayState')) renderAzuayIntraslab(azuayWatch);

    renderMap(regional);

    const rows=regional.slice(0,28).map(e=>'<tr><td>'+ecuTime(e.time)+'</td><td><b>'+e.mag.toFixed(1)+'</b></td><td>'+e.depth.toFixed(0)+' km</td><td>'+tectonicClass(e)+'</td><td>'+e.source+'</td></tr>').join('');
    const tbl=document.getElementById('events'); if(tbl) tbl.innerHTML=rows||'<tr><td colspan="5">Sin eventos que cumplan el filtro.</td></tr>';

    setAgent(sci);
    if(typeof window.mivigeUpdateDirectionalModel==='function') window.mivigeUpdateDirectionalModel(all);
  }

  async function refresh(){
    const btn=document.getElementById('refresh');
    if(btn){btn.disabled=true;btn.textContent='Actualizando…';}
    const parts=await Promise.all(Object.entries(endpoints).map(([n,u])=>fetchSource(n,u)));
    allEvents=dedupe(parts.flat());
    const cut=document.getElementById('cut'); if(cut) cut.textContent=fmtFull(Date.now());
    refreshAt=Date.now()+3600000;
    render(allEvents); updateSources();
    if(btn){btn.disabled=false;btn.textContent='Actualizar ahora';}
  }

  function tick(){
    const left=Math.max(0,refreshAt-Date.now()),m=Math.floor(left/60000),s=Math.floor((left%60000)/1000);
    const n=document.getElementById('next'); if(n)n.textContent=m+'m '+String(s).padStart(2,'0')+'s';
  }

  window.render=render;
  window.refresh=refresh;
  window.updateSources=updateSources;

  const b=document.getElementById('refresh'); if(b)b.onclick=refresh;
  const w=document.getElementById('window'); if(w)w.onchange=()=>render(allEvents);
  const mm=document.getElementById('minmag'); if(mm)mm.onchange=()=>render(allEvents);
  const tf=document.getElementById('tectonicFilter'); if(tf)tf.onchange=()=>render(allEvents);

  setInterval(tick,1000);
  setInterval(refresh,3600000);

  const legend=L.control({position:'bottomleft'});
  legend.onAdd=()=>{const d=L.DomUtil.create('div','legend');d.innerHTML='<b>Magnitud (relleno)</b><br><i style="background:#42b86b"></i>M&lt;3 <i style="background:#f0c644"></i>M3–3.9 <i style="background:#f08a24"></i>M4–4.9 <i style="background:#e4493f"></i>M5+<br><b>Tipo tectónico (borde)</b><br><i style="background:#f0c644"></i>Cortical <i style="background:#f08a24"></i>Interfaz <i style="background:#52a8ff"></i>Intermedio <i style="background:#af7cff"></i>Intraslab';return d;};
  legend.addTo(map);
  L.control.layers({},{"Sismos recientes":eventLayer,"Placas tectónicas":plateLayer},{collapsed:false,position:'topright'}).addTo(map);

  loadPlates(); refresh();
})();