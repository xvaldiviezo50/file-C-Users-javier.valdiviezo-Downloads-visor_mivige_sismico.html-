(function(){
  const CFG={sourceMag:5.0,responseMag:3.5,maxLagH:72,minDistanceKm:120};
  const BOX={
    chile:[-56,-17,-76,-66],peru:[-19.5,0,-82,-68],ecuador:[-5.2,2.2,-81.6,-75],
    colombia:[-4.5,13.5,-79.5,-66.5],centroamerica:[7,19,-93,-77]
  };
  const ORDER=['chile','peru','ecuador','colombia','centroamerica'];
  const LABEL={chile:'Chile',peru:'Perú',ecuador:'Ecuador',colombia:'Colombia',centroamerica:'Centroamérica'};
  let layer=null;

  function inBox(e,b){return e&&Number.isFinite(Number(e.lat))&&Number.isFinite(Number(e.lon))&&Number(e.lat)>=b[0]&&Number(e.lat)<=b[1]&&Number(e.lon)>=b[2]&&Number(e.lon)<=b[3];}
  function region(e){return ORDER.find(k=>inBox(e,BOX[k]))||null;}
  function depthFamily(e){try{return tectonicFamily(e)}catch(_){const d=Number(e.depth||0);return d>=70?'intraslab':d>=30?'intermediate':Number(e.lon)<=-79.6?'interface':'cortical';}}
  function lagLabel(h){return h<=6?'0–6 h':h<=24?'6–24 h':'24–72 h';}
  function fmt(e){return 'M'+Number(e.mag).toFixed(1)+' · '+LABEL[region(e)]+' · '+Math.round(Number(e.depth||0))+' km · '+ecuTime(Number(e.time));}
  function ensure(){
    if(document.getElementById('directional39'))return;
    const aside=document.querySelector('aside');if(!aside)return;
    const c=document.createElement('section');c.className='card';c.id='directional39';
    c.innerHTML='<h2>🧭 Modelo direccional depurado</h2>'+
      '<div class="small"><b>Objetivo:</b> estudiar desplazamientos aparentes de actividad a partir de datos observados, sin asumir “energía migratoria”. Solo usa: evento fuente, tiempo, distancia, continuidad regional, familia tectónica/profundidad y cambio de tasa.</div>'+
      '<div class="kpis" style="margin-top:8px">'+
      '<div class="kpi"><div class="name">Fuente</div><div class="val" id="d39source">—</div></div>'+
      '<div class="kpi"><div class="name">Dirección observada</div><div class="val" id="d39dir">—</div></div>'+
      '<div class="kpi"><div class="name">Ventana</div><div class="val" id="d39win">—</div></div>'+
      '<div class="kpi"><div class="name">Evidencia</div><div class="val" id="d39ev">—</div></div></div>'+
      '<div class="small" id="d39path" style="margin-top:8px">—</div>'+
      '<div class="small" id="d39why" style="margin-top:8px">—</div>'+
      '<div class="small" style="margin-top:8px;color:#7894ac"><b>Variables retiradas del modelo direccional:</b> meteorología, SST, antípodas, “huellas de energía” y rangos de magnitud predictivos. Se mantienen solo como antecedentes históricos fuera de este cálculo.</div>';
    const sci=[...document.querySelectorAll('section.card h2')].find(h=>/CAPA A/.test(h.textContent));
    if(sci)sci.parentElement.insertAdjacentElement('afterend',c);else aside.insertBefore(c,aside.firstChild);
    if(typeof L!=='undefined'&&typeof map!=='undefined'){layer=L.layerGroup().addTo(map);try{L.control.layers({},{"Secuencia direccional v39":layer},{collapsed:true,position:'topleft'}).addTo(map);}catch(_){}}
  }

  function rateRatio(events,r,t0,t1){
    const len=t1-t0;if(len<=0)return 1;
    const post=events.filter(e=>region(e)===r&&e.time>=t0&&e.time<=t1&&e.mag>=CFG.responseMag).length;
    const pre=events.filter(e=>region(e)===r&&e.time>=t0-len&&e.time<t0&&e.mag>=CFG.responseMag).length;
    return (post+1)/(pre+1);
  }

  function chooseSource(events){
    const cut=Date.now()-72*3600000;
    return events.filter(e=>e.time>=cut&&region(e)&&Number(e.mag)>=CFG.sourceMag).sort((a,b)=>b.time-a.time)[0]||null;
  }

  function update(events){
    ensure();if(!Array.isArray(events))events=[];
    const src=chooseSource(events);
    const sEl=document.getElementById('d39source'),dEl=document.getElementById('d39dir'),wEl=document.getElementById('d39win'),eEl=document.getElementById('d39ev'),pEl=document.getElementById('d39path'),yEl=document.getElementById('d39why');
    if(layer)layer.clearLayers();
    if(!src){
      sEl.textContent='Sin fuente M≥5 en 72 h';dEl.textContent='No evaluada';wEl.textContent='—';eEl.textContent='Sin señal';
      pEl.textContent='No existe una fuente candidata reciente para construir secuencia.';yEl.textContent='El módulo permanece en vigilancia de fondo.';return;
    }
    const sr=region(src),end=Math.min(Date.now(),src.time+CFG.maxLagH*3600000);
    let responses=events.filter(e=>e.time>src.time&&e.time<=end&&region(e)&&region(e)!==sr&&Number(e.mag)>=CFG.responseMag&&distKm(src.lat,src.lon,e.lat,e.lon)>=CFG.minDistanceKm)
      .sort((a,b)=>a.time-b.time);

    const firstByRegion=[];
    for(const r of ORDER){const x=responses.find(e=>region(e)===r);if(x)firstByRegion.push(x);}
    firstByRegion.sort((a,b)=>a.time-b.time);

    const srcIdx=ORDER.indexOf(sr);
    const signs=firstByRegion.map(e=>Math.sign(ORDER.indexOf(region(e))-srcIdx)).filter(Boolean);
    let dir='Sin dirección consistente';
    if(signs.length){
      const north=signs.filter(x=>x>0).length,south=signs.filter(x=>x<0).length;
      if(north>south)dir='Predominio hacia el norte';
      else if(south>north)dir='Predominio hacia el sur';
      else dir='Bidireccional/mixta';
    }

    let adjacent=0,sameFam=0,rateUp=0;
    const sf=depthFamily(src);
    for(const e of firstByRegion){
      if(Math.abs(ORDER.indexOf(region(e))-srcIdx)===1)adjacent++;
      if(depthFamily(e)===sf)sameFam++;
      if(rateRatio(events,region(e),src.time,end)>=1.5)rateUp++;
    }

    let evidence='Temporal';
    const support=(adjacent>0?1:0)+(sameFam>0?1:0)+(rateUp>0?1:0)+(firstByRegion.length>=2?1:0);
    if(support>=3)evidence='Observacional reforzada';
    else if(support===2)evidence='Observacional moderada';
    else if(support===1)evidence='Observacional débil';

    sEl.textContent=fmt(src);
    dEl.textContent=dir;
    const last=firstByRegion[firstByRegion.length-1];
    wEl.textContent=last?lagLabel((last.time-src.time)/3600000):'Sin respuesta';
    eEl.textContent=evidence;

    const path=[src,...firstByRegion];
    pEl.innerHTML='<b>Secuencia observada:</b><br>'+path.map((e,i)=>(i?'→ ':'')+fmt(e)).join('<br>');
    yEl.innerHTML='<b>Soportes observados:</b> '+adjacent+' continuidad(es) regional(es) adyacente(s) · '+sameFam+' coincidencia(s) de familia tectónica · '+rateUp+' aumento(s) de tasa frente al periodo previo. <b>No prueba causalidad.</b>';

    if(layer&&path.length>1){
      for(let i=0;i<path.length-1;i++){
        L.polyline([[path[i].lat,path[i].lon],[path[i+1].lat,path[i+1].lon]],{weight:2,dashArray:'7 5'}).addTo(layer);
      }
    }
  }

  window.mivigeUpdateDirectionalModel=update;
  ensure();
  setTimeout(()=>{try{update(allEvents)}catch(_){}},2000);
})();