(function(){
  if(typeof L==='undefined' || typeof map==='undefined') return;
  const seqLayer=L.layerGroup().addTo(map);
  const COLORS={aftershock:'#4aa3ff',swarm:'#d66bff',mixed:'#ffb347',isolated:'#9aa7b4'};
  const LABELS={aftershock:'Réplica probable',swarm:'Enjambre probable',mixed:'Secuencia mixta / incierta',isolated:'Independiente / sin clasificar'};

  function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
  function fam(e){try{return tectonicFamily(e);}catch(_){if(e.depth>=70)return'intraslab';if(e.depth>=30)return'intermediate';if(e.lon<=-79.6)return'interface';return'cortical';}}
  function radiusForMain(m){return m>=7?350:m>=6?250:m>=5?160:m>=4?100:70;}
  function daysForMain(m){return m>=7?21:m>=6?14:m>=5?7:m>=4?3:1.5;}
  function parentScore(child,parent){
    if(parent.time>=child.time || parent.mag<child.mag+0.3) return 0;
    const dt=(child.time-parent.time)/86400000, days=daysForMain(parent.mag); if(dt>days) return 0;
    const r=radiusForMain(parent.mag), d=distKm(child.lat,child.lon,parent.lat,parent.lon); if(d>r) return 0;
    const fm=fam(child)===fam(parent)?1:0.55;
    const dz=Math.abs((child.depth||0)-(parent.depth||0)); const depth=dz<=35?1:dz<=80?0.7:0.4;
    const mag=Math.min(1,(parent.mag-child.mag)/1.5);
    return 100*(0.34*(1-d/r)+0.24*(1-dt/days)+0.20*mag+0.12*fm+0.10*depth);
  }

  function cluster(events){
    const cs=[];
    for(const e of events){
      const ef=fam(e), rr=ef==='intraslab'?180:ef==='intermediate'?140:110; let best=null;
      for(const c of cs){if(c.family!==ef)continue; const d=distKm(e.lat,e.lon,c.lat,c.lon); if(d<=rr && (!best||d<best.d))best={c,d};}
      if(!best) cs.push({family:ef,events:[e],lat:e.lat,lon:e.lon});
      else{const c=best.c;c.events.push(e);const n=c.events.length;c.lat=(c.lat*(n-1)+e.lat)/n;c.lon=(c.lon*(n-1)+e.lon)/n;}
    }
    return cs;
  }

  function classify(events){
    const now=Date.now(), cutoff=now-7*86400000;
    const pool=events.filter(e=>e&&e.time>=cutoff&&e.mag>=2.5&&e.lat>=-35&&e.lat<=20&&e.lon>=-111&&e.lon<=-70).sort((a,b)=>a.time-b.time);
    const info=new Map();
    for(let i=0;i<pool.length;i++){
      const e=pool[i]; let best=null;
      for(let j=0;j<i;j++){const p=pool[j]; const s=parentScore(e,p); if(s>=52 && (!best||s>best.score)) best={event:p,score:s};}
      info.set(e,{type:best&&best.score>=66?'aftershock':'isolated',parent:best?.event||null,parentScore:best?.score||0,cluster:null});
    }

    const recent=pool.filter(e=>e.time>=now-72*3600000);
    for(const c of cluster(recent)){
      if(c.events.length<4) continue;
      const mags=c.events.map(e=>e.mag).sort((a,b)=>b-a), max=mags[0], second=mags[1]??mags[0];
      const dominance=max-second;
      const sorted=c.events.slice().sort((a,b)=>a.time-b.time);
      const firstMaxIndex=sorted.findIndex(e=>e.mag===max);
      const maxEarly=firstMaxIndex>=0 && firstMaxIndex<=Math.max(1,Math.floor(sorted.length*0.30));
      const likelyAftershockCluster=max>=5.0 && dominance>=0.9 && maxEarly;
      const swarmLike=!likelyAftershockCluster && dominance<0.8 && c.events.length>=4;
      for(const e of c.events){
        const x=info.get(e); if(!x)continue; x.cluster=c;
        if(swarmLike){
          if(x.type==='aftershock' && x.parentScore>=78) x.type='mixed'; else x.type='swarm';
        } else if(likelyAftershockCluster && x.type!=='aftershock'){
          const main=c.events.find(z=>z.mag===max); if(main&&main.time<e.time){x.type='aftershock';x.parent=main;x.parentScore=Math.max(x.parentScore,68);}
        }
      }
    }
    return {pool,info};
  }

  function ensureCard(){
    if(document.getElementById('sequenceCard')) return;
    const aside=document.querySelector('aside'); if(!aside)return;
    const card=document.createElement('section');card.className='card';card.id='sequenceCard';
    card.innerHTML=`<h2>🧭 Tipo de secuencia sísmica</h2>
      <div class="kpis">
        <div class="kpi"><div class="name">Réplicas probables</div><div class="val" id="seqAfter">—</div></div>
        <div class="kpi"><div class="name">Enjambres probables</div><div class="val" id="seqSwarm">—</div></div>
        <div class="kpi"><div class="name">Mixtos/inciertos</div><div class="val" id="seqMixed">—</div></div>
        <div class="kpi"><div class="name">Aislados</div><div class="val" id="seqIso">—</div></div>
      </div>
      <div id="seqHot" class="small" style="margin-top:8px"></div>
      <div class="small" style="margin-top:8px;color:#7894ac"><b>Lectura:</b> azul = réplica probable de un evento mayor previo; morado = enjambre probable sin un mainshock dominante; naranja = secuencia mixta/incierta; gris = aislado/no clasificado. La clasificación es heurística y se recalcula con cada actualización del catálogo.</div>
      <div class="small" style="margin-top:6px;color:#7894ac"><b>Importante:</b> un enjambre no implica que vaya a ocurrir un terremoto mayor. Una secuencia de réplicas tampoco tiene riesgo cero: si después ocurre un evento mayor, el evento previo puede reclasificarse como precursor/foreshock.</div>`;
    const z=[...document.querySelectorAll('section.card h2')].find(h=>/Zonas activas priorizadas/.test(h.textContent));
    if(z)z.parentElement.insertAdjacentElement('afterend',card); else aside.appendChild(card);
  }

  function render(){
    ensureCard();
    let ev=[]; try{ev=Array.isArray(allEvents)?allEvents:[]}catch(_){ev=[];}
    if(!ev.length){document.getElementById('seqHot').textContent='Esperando catálogo sísmico…';return;}
    const out=classify(ev); seqLayer.clearLayers();
    const counts={aftershock:0,swarm:0,mixed:0,isolated:0}; const swarms=[];
    const recent=out.pool.filter(e=>Date.now()-e.time<=72*3600000);
    for(const e of recent){
      const x=out.info.get(e); if(!x)continue; counts[x.type]++;
      const color=COLORS[x.type], rr=Math.max(4,Math.min(10,3+(e.mag-2.5)*2));
      const m=L.circleMarker([e.lat,e.lon],{radius:rr,weight:2,color,fillColor:color,fillOpacity:x.type==='isolated'?0.35:0.75});
      let reason='Sin patrón suficiente para atribución.';
      if(x.type==='aftershock'&&x.parent){const dt=((e.time-x.parent.time)/3600000).toFixed(1);const d=Math.round(distKm(e.lat,e.lon,x.parent.lat,x.parent.lon));reason=`Compatible con réplica de M${x.parent.mag.toFixed(1)} previa · ${dt} h · ${d} km · score ${Math.round(x.parentScore)}/100.`;}
      if((x.type==='swarm'||x.type==='mixed')&&x.cluster){const mags=x.cluster.events.map(z=>z.mag);reason=`Clúster ${x.cluster.events.length} eventos/72 h · Mmáx ${Math.max(...mags).toFixed(1)} · sin dominio claro de un único mainshock.`;}
      m.bindPopup(`<b>${LABELS[x.type]}</b><br>M${e.mag.toFixed(1)} · ${Math.round(e.depth)} km<br>${esc(e.place||e.source||'')}<br><span style="font-size:11px">${esc(reason)}</span>`).addTo(seqLayer);
      if((x.type==='swarm'||x.type==='mixed')&&x.cluster&&!swarms.includes(x.cluster))swarms.push(x.cluster);
    }
    document.getElementById('seqAfter').textContent=counts.aftershock;
    document.getElementById('seqSwarm').textContent=counts.swarm;
    document.getElementById('seqMixed').textContent=counts.mixed;
    document.getElementById('seqIso').textContent=counts.isolated;
    swarms.sort((a,b)=>Math.max(...b.events.map(e=>e.mag))-Math.max(...a.events.map(e=>e.mag))||b.events.length-a.events.length);
    const top=swarms.slice(0,3).map(c=>{const mm=Math.max(...c.events.map(e=>e.mag)).toFixed(1);const la=c.events.reduce((s,e)=>s+e.lat,0)/c.events.length,lo=c.events.reduce((s,e)=>s+e.lon,0)/c.events.length;return `• ${c.events.length} eventos · Mmáx ${mm} · centro ${la.toFixed(2)}, ${lo.toFixed(2)} · ${c.family}`;});
    document.getElementById('seqHot').innerHTML=top.length?'<b>Enjambres/mixtos a vigilar:</b><br>'+top.join('<br>'):'<b>Enjambres/mixtos:</b> ninguno con criterio suficiente en las últimas 72 h.';
  }

  ensureCard();
  try{L.control.layers({}, {'Secuencias · réplicas vs enjambres':seqLayer},{collapsed:true,position:'topleft'}).addTo(map);}catch(_){ }
  setTimeout(render,1800); setInterval(render,60000);
  const btn=document.getElementById('refresh'); if(btn)btn.addEventListener('click',()=>setTimeout(render,1800));
  window.mivigeSequenceClassifier={render,classify};
})();