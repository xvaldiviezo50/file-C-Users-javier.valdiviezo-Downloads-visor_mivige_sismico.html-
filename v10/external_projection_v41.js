(function(){
  const META={
    id:'MACP-02OCT2026-SN',
    source:'Miguel Angel Cruz Perez · publicación externa aportada por el usuario',
    nominal:'2026-10-02T16:49:00-05:00',
    viewed:'2026-10-02T19:49:00-05:00',
    uncertainty:'hora nominal inferida de “3 h” en captura; ±1 h',
    ecuadorStart:'2026-10-03T00:00:00-05:00',
    ecuadorEnd:'2026-10-05T00:00:00-05:00',
    venezuelaEnd:'2026-10-03T04:49:00-05:00',
    colombiaStart:'2026-10-04T00:00:00-05:00',
    colombiaEnd:'2026-10-05T16:49:00-05:00'
  };
  const R=[
    {id:'chile',name:'Chile',lat:-28.5,lon:-71.4,box:[-56,-17,-76,-66],ord:0},
    {id:'peru',name:'Perú',lat:-10.5,lon:-77.5,box:[-19.5,0,-82,-68],ord:1},
    {id:'ecuador',name:'Ecuador',lat:-1.4,lon:-79.9,box:[-5.2,2.2,-81.8,-75],ord:2},
    {id:'colombia',name:'Colombia',lat:4.3,lon:-77.0,box:[-4.5,13.5,-79.8,-66],ord:3}
  ];
  const V={id:'venezuela',name:'Venezuela costera',lat:10.3,lon:-64.4,box:[0,13,-73.5,-58]};
  const ATL={lat:10.0,lon:-52.0,name:'Atlántico occidental · origen no especificado'};
  const layer=(typeof L!=='undefined'&&typeof map!=='undefined')?L.layerGroup().addTo(map):null;
  const branch=(typeof L!=='undefined'&&typeof map!=='undefined')?L.layerGroup().addTo(map):null;

  function inBox(e,b){return e&&Number(e.lat)>=b[0]&&Number(e.lat)<=b[1]&&Number(e.lon)>=b[2]&&Number(e.lon)<=b[3];}
  function reg(e){return R.find(r=>inBox(e,r.box))||null;}
  function fmtT(ms){try{return new Intl.DateTimeFormat('es-EC',{timeZone:'America/Guayaquil',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(ms));}catch(_){return new Date(ms).toISOString();}}
  function eqMag(es){
    const a=es.filter(e=>Number(e.mag)>=3).map(e=>Math.pow(10,1.5*Number(e.mag)));
    if(!a.length)return null;
    return Math.log10(a.reduce((s,x)=>s+x,0))/1.5;
  }
  function stats(ev,r,a,b){
    const es=ev.filter(e=>e.time>=a&&e.time<=b&&inBox(e,r.box)&&Number(e.mag)>=3).sort((x,y)=>x.time-y.time);
    const moderate=es.filter(e=>e.mag>=4);
    return {es,n:es.length,n4:moderate.length,max:es.length?Math.max(...es.map(e=>e.mag)):0,eq:eqMag(es),first:es[0]||null,last:es[es.length-1]||null};
  }
  function releaseLabel(s){
    if(!s.n)return 'sin liberación observada ≥M3';
    if(s.eq>=5.2||s.n4>=3)return 'alta (proxy observacional)';
    if(s.eq>=4.5||s.n4>=1)return 'moderada (proxy observacional)';
    return 'baja (proxy observacional)';
  }
  function corr(xs,ys){
    if(xs.length<3)return null;
    const mx=xs.reduce((a,b)=>a+b,0)/xs.length,my=ys.reduce((a,b)=>a+b,0)/ys.length;
    let n=0,dx=0,dy=0;
    for(let i=0;i<xs.length;i++){const a=xs[i]-mx,b=ys[i]-my;n+=a*b;dx+=a*a;dy+=b*b;}
    return dx&&dy?n/Math.sqrt(dx*dy):null;
  }
  function sequentiality(ev){
    const t0=new Date(META.nominal).getTime(), now=Date.now();
    const pts=[];
    for(const r of R){
      const x=ev.filter(e=>e.time>=t0&&e.time<=now&&inBox(e,r.box)&&Number(e.mag)>=3.5).sort((a,b)=>a.time-b.time)[0];
      if(x)pts.push({ord:r.ord,t:x.time,r,e:x});
    }
    const c=corr(pts.map(x=>x.t),pts.map(x=>x.ord));
    return {pts,c,label:c==null?'datos insuficientes':c>=.65?'orden temporal S→N marcado':c>=.3?'tendencia S→N débil/moderada':c<=-.3?'orden contrario o mixto':'sin orden S→N claro'};
  }
  function phase(now,a,b){if(now<a)return 'pendiente';if(now<=b)return 'ventana activa';return 'ventana cerrada';}
  function makeMarker(r,n,text){
    return L.marker([r.lat,r.lon],{icon:L.divIcon({className:'',html:'<div style="background:#07111eee;border:2px solid #ffbd59;border-radius:18px;color:#fff;width:28px;height:28px;line-height:24px;text-align:center;font:800 12px Arial;box-shadow:0 2px 6px #0008">'+n+'</div>',iconSize:[30,30],iconAnchor:[15,15]})}).bindPopup(text);
  }
  function ensure(){
    if(document.getElementById('externalProjection41'))return;
    const aside=document.querySelector('aside');if(!aside)return;
    const c=document.createElement('section');c.className='card';c.id='externalProjection41';
    c.innerHTML=`<h2>📌 Proyección externa 02-oct · traducción técnica</h2>
      <div class="small"><b>Fuente externa:</b> Miguel Angel Cruz Perez. <b>La publicación no activa el modelo MIVIGE.</b> Esta tarjeta congela la afirmación y la convierte en observables para contrastarla prospectivamente.<br>
      <b>Claim congelado:</b> “ajuste” Sur→Norte: Chile → Perú → Ecuador (sábado–domingo) → Colombia; la intensidad en Colombia dependería del “desahogo” en Perú/Ecuador. Rama adicional: Atlántico → costas de Venezuela, con ruta a observar en 12 h.<br>
      <b>Hora nominal:</b> 02-oct ~16:49 ECU (${META.uncertainty}).</div>
      <div class="kpis" style="margin-top:8px">
        <div class="kpi"><div class="name">Orden S→N observado</div><div class="val" id="x41seq">—</div></div>
        <div class="kpi"><div class="name">Perú · liberación proxy</div><div class="val" id="x41peru">—</div></div>
        <div class="kpi"><div class="name">Ecuador · ventana</div><div class="val" id="x41ecu">—</div></div>
        <div class="kpi"><div class="name">Colombia · downstream</div><div class="val" id="x41col">—</div></div>
      </div>
      <div id="x41route" class="small" style="margin-top:8px"></div>
      <div id="x41ven" class="small" style="margin-top:8px"></div>
      <details style="margin-top:8px"><summary>Cómo se traduce técnicamente cada frase</summary>
        <div class="small" style="margin-top:6px">
          <b>“Ajuste Sur→Norte”</b> → orden temporal de primera activación M≥3.5 por segmento y correlación tiempo–posición.<br>
          <b>“Tensión sísmica”</b> → no se asume como esfuerzo físico; se observa tasa, clustering, magnitud y profundidad. Coulomb requiere mecanismo focal/geometría.<br>
          <b>“Desahogo” Perú/Ecuador</b> → proxy de liberación sísmica acumulada mediante magnitud equivalente de los eventos observados; <b>no implica conservación de energía entre países</b>.<br>
          <b>“La energía viene lenta”</b> → se contrasta como respuesta retardada 6–72 h; no se interpreta como velocidad física de “energía migratoria”.<br>
          <b>Atlántico→Venezuela</b> → hipótesis de disparo remoto sin fuente identificada en la publicación; se registra actividad costera y cambio de tasa, sin atribuir causalidad.
        </div>
      </details>`;
    const p=document.getElementById('projection40');p?p.insertAdjacentElement('afterend',c):aside.insertBefore(c,aside.firstChild);
  }
  function render(){
    ensure();let ev=[];try{ev=Array.isArray(allEvents)?allEvents:[]}catch(_){}
    const t0=new Date(META.nominal).getTime(),now=Date.now(),end=Math.max(now,t0),seq=sequentiality(ev);
    const pe=stats(ev,R[1],t0,end),ec=stats(ev,R[2],new Date(META.ecuadorStart).getTime(),Math.min(now,new Date(META.ecuadorEnd).getTime())),co=stats(ev,R[3],new Date(META.colombiaStart).getTime(),Math.min(now,new Date(META.colombiaEnd).getTime()));
    const ve=stats(ev,V,t0,Math.min(now,new Date(META.venezuelaEnd).getTime()));
    document.getElementById('x41seq').textContent=seq.c==null?'—':('r='+seq.c.toFixed(2)+' · '+seq.label);
    document.getElementById('x41peru').textContent=releaseLabel(pe)+(pe.eq?' · Meq '+pe.eq.toFixed(1):'');
    document.getElementById('x41ecu').textContent=phase(now,new Date(META.ecuadorStart).getTime(),new Date(META.ecuadorEnd).getTime())+(ec.n?' · '+ec.n+' M≥3':'');
    document.getElementById('x41col').textContent=phase(now,new Date(META.colombiaStart).getTime(),new Date(META.colombiaEnd).getTime())+(co.n?' · '+co.n+' M≥3':'');
    const parts=R.map((r,i)=>{
      const s=stats(ev,r,t0,end);
      return '<b>'+String(i+1).padStart(2,'0')+' '+r.name+'</b>: '+s.n+' M≥3 · '+s.n4+' M≥4 · Mmáx '+(s.max?s.max.toFixed(1):'—')+(s.eq?' · Meq '+s.eq.toFixed(1):'');
    });
    document.getElementById('x41route').innerHTML='<b>Corredor Pacífico congelado:</b><br>'+parts.join('<br>')+'<br><span style="color:#7894ac">Meq = magnitud equivalente del conjunto observado; se usa solo como proxy comparativo de liberación sísmica.</span>';
    document.getElementById('x41ven').innerHTML='<b>Rama Atlántico→Venezuela:</b> ventana 12 h '+phase(now,t0,new Date(META.venezuelaEnd).getTime())+' · '+ve.n+' M≥3 · '+ve.n4+' M≥4 · Mmáx '+(ve.max?ve.max.toFixed(1):'—')+'. <span style="color:#7894ac">La publicación no identifica una fuente atlántica concreta, por lo que MIVIGE no calcula causalidad ni directividad.</span>';

    if(layer){
      layer.clearLayers();
      const p=[[R[0].lat,R[0].lon],[R[1].lat,R[1].lon],[R[2].lat,R[2].lon],[R[3].lat,R[3].lon]];
      L.polyline(p,{weight:4,dashArray:'10 7',opacity:.8}).bindTooltip('Claim externo: ajuste Sur→Norte · no causal').addTo(layer);
      R.forEach((r,i)=>makeMarker(r,i+1,'<b>'+r.name+'</b><br>Segmento '+(i+1)+' de la proyección externa').addTo(layer));
      if(seq.pts.length>1){
        for(let i=0;i<seq.pts.length-1;i++){
          L.polyline([[seq.pts[i].e.lat,seq.pts[i].e.lon],[seq.pts[i+1].e.lat,seq.pts[i+1].e.lon]],{weight:2,dashArray:'4 5',opacity:.7}).bindTooltip('Primera activación M≥3.5 observada').addTo(layer);
        }
      }
    }
    if(branch){
      branch.clearLayers();
      L.polyline([[ATL.lat,ATL.lon],[V.lat,V.lon]],{weight:3,dashArray:'8 7',opacity:.7}).bindTooltip('Claim externo: Atlántico → Venezuela').addTo(branch);
      L.circleMarker([ATL.lat,ATL.lon],{radius:6,weight:2,fillOpacity:.5}).bindPopup('<b>Origen atlántico no especificado</b><br>No hay fuente concreta en la publicación; es un marcador conceptual.').addTo(branch);
      L.circle([V.lat,V.lon],{radius:500000,weight:1,dashArray:'5 5',fillOpacity:.02}).bindTooltip('Venezuela costera · ventana de 12 h del claim').addTo(branch);
    }
  }
  ensure();
  if(layer&&branch){try{L.control.layers({}, {'Proyección externa · Sur→Norte':layer,'Proyección externa · Atlántico→Venezuela':branch},{collapsed:false,position:'topright'}).addTo(map);}catch(_){}}
  setTimeout(render,2500);setInterval(render,60000);
  const b=document.getElementById('refresh');if(b)b.addEventListener('click',()=>setTimeout(render,2200));
  window.mivigeExternalProjection41={meta:META,render};
})();