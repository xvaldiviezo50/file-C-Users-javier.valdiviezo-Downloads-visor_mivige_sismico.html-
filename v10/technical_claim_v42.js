(function(){
  const CLAIM={
    id:'MACP-02OCT2026-SN',
    nominal:'2026-10-02T16:49:00-05:00',
    viewed:'2026-10-02T19:49:00-05:00',
    uncertainty:'±1 h por captura “3 h”',
    ecuadorStart:'2026-10-03T00:00:00-05:00',
    ecuadorEnd:'2026-10-05T00:00:00-05:00',
    colombiaStart:'2026-10-04T00:00:00-05:00',
    colombiaEnd:'2026-10-05T16:49:00-05:00',
    venezuelaEnd:'2026-10-03T04:49:00-05:00'
  };
  const ZONES=[
    {id:'ec_s',name:'Z1 · Ecuador sur — Tumbes/El Oro/Golfo',lat:-3.15,lon:-80.25,r:190,ord:1,path:1.00,window:'Ecuador · sáb–dom'},
    {id:'ec_c',name:'Z2 · Ecuador centro — Manabí',lat:-1.05,lon:-80.55,r:220,ord:2,path:.84,window:'Ecuador · sáb–dom'},
    {id:'ec_n',name:'Z3 · Ecuador norte — Esmeraldas',lat:.55,lon:-79.95,r:210,ord:3,path:.70,window:'Ecuador · sáb–dom'},
    {id:'co_p',name:'Z4 · Colombia Pacífico — Nariño/Cauca',lat:2.55,lon:-77.65,r:260,ord:4,path:.58,window:'Después de Ecuador · prueba ≤72 h'},
    {id:'co_ch',name:'Z5 · Chocó',lat:4.95,lon:-76.75,r:250,ord:5,path:.42,window:'Después de Ecuador · penalizar actividad previa'}
  ];
  const SRCBOX={
    chile:[-56,-17,-76,-66],
    peru:[-19.5,0,-82,-68],
    venezuela:[7,13,-73,-58]
  };
  const layer=(typeof L!=='undefined'&&typeof map!=='undefined')?L.layerGroup().addTo(map):null;
  const claimLayer=(typeof L!=='undefined'&&typeof map!=='undefined')?L.layerGroup().addTo(map):null;
  const atlLayer=(typeof L!=='undefined'&&typeof map!=='undefined')?L.layerGroup().addTo(map):null;

  function clamp(x,a=0,b=1){return Math.max(a,Math.min(b,x));}
  function inBox(e,b){return e&&Number(e.lat)>=b[0]&&Number(e.lat)<=b[1]&&Number(e.lon)>=b[2]&&Number(e.lon)<=b[3];}
  function fam(e){
    try{return tectonicFamily(e);}catch(_){
      const d=Number(e.depth||0);
      if(d>=70)return'intraslab';
      if(d>=30)return'intermediate';
      if(Number(e.lon)<=-79.6)return'interface';
      return'cortical';
    }
  }
  function famCompat(a,b){
    if(!a||!b)return .45;
    if(a===b)return 1;
    const slab=new Set(['interface','intermediate','intraslab']);
    return slab.has(a)&&slab.has(b)?.68:.28;
  }
  function near(ev,z,a,b,minMag){
    return ev.filter(e=>e.time>=a&&e.time<b&&Number(e.mag)>=minMag&&distKm(e.lat,e.lon,z.lat,z.lon)<=z.r);
  }
  function mean(a){return a.length?a.reduce((s,x)=>s+x,0)/a.length:0;}
  function dominantFamily(es){
    if(!es.length)return null;
    const c={}; es.forEach(e=>c[fam(e)]=(c[fam(e)]||0)+1);
    return Object.entries(c).sort((a,b)=>b[1]-a[1])[0][0];
  }
  function priorState(ev,z,t0){
    const h=3600e3;
    const p24=near(ev,z,t0-24*h,t0,3.0);
    const p48=near(ev,z,t0-72*h,t0-24*h,3.0);
    const base24=p48.length/2;
    const ratio=(p24.length+1)/(base24+1);
    const max=p24.length?Math.max(...p24.map(e=>Number(e.mag))):0;
    const score=100*(.50*clamp((ratio-.7)/1.8)+.30*clamp(p24.length/5)+.20*clamp((max-2.8)/2.2));
    return {p24,p48,ratio,max,score,label:score>=65?'alta':score>=42?'moderada':'baja',family:dominantFamily(p24)};
  }
  function momentProxy(es){
    const vals=es.filter(e=>Number(e.mag)>=3).map(e=>Math.pow(10,1.5*Number(e.mag)));
    if(!vals.length)return null;
    return Math.log10(vals.reduce((s,x)=>s+x,0))/1.5;
  }
  function sourceState(ev,t0){
    const a=t0-48*3600e3;
    const ch=ev.filter(e=>e.time>=a&&e.time<=t0&&inBox(e,SRCBOX.chile)&&Number(e.mag)>=3.5);
    const pe=ev.filter(e=>e.time>=a&&e.time<=t0&&inBox(e,SRCBOX.peru)&&Number(e.mag)>=3.5);
    const all=[...ch,...pe].sort((x,y)=>y.time-x.time);
    const anchor=all[0]||null;
    const mmax=all.length?Math.max(...all.map(e=>Number(e.mag))):0;
    const sourcePower=clamp((mmax-3.5)/2.5);
    return {ch,pe,all,anchor,mmax,sourcePower,family:anchor?fam(anchor):null};
  }
  function validation(ev,z,t0){
    const end=Math.min(Date.now(),t0+72*3600e3);
    const span=Math.max(1,end-t0);
    const post=near(ev,z,t0,end+1,3.5);
    const pre=near(ev,z,t0-span,t0,3.5);
    const ratio=(post.length+1)/(pre.length+1);
    let state='pendiente';
    if(post.length&&ratio>=1.5)state='respuesta compatible';
    else if(post.length)state='respuesta parcial';
    else if(Date.now()>t0+72*3600e3)state='sin respuesta material';
    return {post,pre,ratio,state};
  }
  function currentSst(z){
    const s=window.mivigeSSTSignals&&window.mivigeSSTSignals[z.id];
    return s&&s.valid?Math.min(5,5*Number(s.strength||0)):0;
  }
  function currentAntipode(z){
    const cands=window.mivigeProjectionV40?.data?.antiCases||[];
    const hit=cands.find(x=>x.s&&x.s.id===z.id);
    return hit?Math.min(5,5*Number(hit.focus||0)):0;
  }
  function scoreZone(ev,z,t0,src){
    const prior=priorState(ev,z,t0);
    const continuity=35*z.path;
    const priorPts=30*(prior.score/100);
    const sourcePts=20*src.sourcePower;
    const famPts=15*famCompat(src.family,prior.family);
    const frozen=Math.min(100,continuity+priorPts+sourcePts+famPts);
    const sst=currentSst(z),anti=currentAntipode(z);
    const liveExp=Math.min(8,sst+anti);
    return {z,prior,continuity,priorPts,sourcePts,famPts,frozen,liveExp,display:Math.min(100,frozen+liveExp)};
  }
  function corr(xs,ys){
    if(xs.length<3)return null;
    const mx=mean(xs),my=mean(ys);let n=0,dx=0,dy=0;
    for(let i=0;i<xs.length;i++){const a=xs[i]-mx,b=ys[i]-my;n+=a*b;dx+=a*a;dy+=b*b;}
    return dx&&dy?n/Math.sqrt(dx*dy):null;
  }
  function observedMigration(ev,t0){
    const nodes=[
      {ord:0,name:'Chile',box:SRCBOX.chile},
      {ord:1,name:'Perú',box:SRCBOX.peru},
      ...ZONES.map(z=>({ord:z.ord+1,name:z.name,zone:z}))
    ];
    const pts=[];
    for(const n of nodes){
      const x=n.zone
        ? near(ev,n.zone,t0,Date.now()+1,3.5).sort((a,b)=>a.time-b.time)[0]
        : ev.filter(e=>e.time>=t0&&Number(e.mag)>=3.5&&inBox(e,n.box)).sort((a,b)=>a.time-b.time)[0];
      if(x)pts.push({ord:n.ord,name:n.name,e:x});
    }
    pts.sort((a,b)=>a.e.time-b.e.time);
    const c=corr(pts.map(x=>x.e.time),pts.map(x=>x.ord));
    return {pts,c,label:c==null?'datos insuficientes':c>=.65?'migración aparente S→N marcada':c>=.3?'migración aparente S→N débil/moderada':c<=-.3?'orden contrario/mixto':'sin orden claro'};
  }
  function fmt(e){return e?'M'+Number(e.mag).toFixed(1)+' · '+Math.round(Number(e.depth||0))+' km · '+ecuTime(Number(e.time)):'—';}
  function phase(now,a,b){return now<a?'pendiente':now<=b?'activa':'cerrada';}
  function color(s){return s>=70?'#e4493f':s>=55?'#f08a24':s>=40?'#f0c644':'#52a8ff';}

  function ensure(){
    if(document.getElementById('technicalClaim42'))return;
    const aside=document.querySelector('aside');if(!aside)return;
    const card=document.createElement('section');card.className='card';card.id='technicalClaim42';
    card.innerHTML=
      '<h2>🧠 Proyección del sismólogo · reconstrucción técnica</h2>'+
      '<div class="small"><b>No conocemos su algoritmo original.</b> Esta capa reconstruye qué mecanismos podrían corresponder a sus frases y los somete a prueba con datos. La publicación externa no modifica por sí sola el semáforo científico.</div>'+
      '<div class="kpis" style="margin-top:8px">'+
        '<div class="kpi"><div class="name">Fuente Chile–Perú</div><div class="val" id="t42src">—</div></div>'+
        '<div class="kpi"><div class="name">Migración observada</div><div class="val" id="t42mig">—</div></div>'+
        '<div class="kpi"><div class="name">“Desahogo” Perú</div><div class="val" id="t42rel">—</div></div>'+
        '<div class="kpi"><div class="name">Venezuela 12 h</div><div class="val" id="t42ven">—</div></div>'+
      '</div>'+
      '<div id="t42zones" style="margin-top:8px"></div>'+
      '<details style="margin-top:8px"><summary>Traducción física de sus criterios</summary>'+
        '<div class="small" style="margin-top:6px">'+
        '<b>1. “Chile no termina de ajustarse”</b> → post-sismicidad, afterslip y relajación post-sísmica. Para confirmarlo se necesita GNSS/InSAR; la sola sismicidad no basta.<br>'+
        '<b>2. “Tensión con Perú”</b> → posible redistribución de esfuerzos. El cambio estático de Coulomb requiere mecanismo focal, plano de falla y geometría del receptor; sin esos datos queda no calculado.<br>'+
        '<b>3. “De Sur a Norte”</b> → migración aparente a lo largo del margen. Se mide con el orden temporal de activación por segmentos y una correlación tiempo–posición; no se supone de antemano.<br>'+
        '<b>4. “La energía viene lenta”</b> → no puede ser velocidad de ondas sísmicas. Se traduce como respuesta retardada 6–72 h compatible con rate-and-state, afterslip, slow slip o disparo dinámico retardado.<br>'+
        '<b>5. “Desahogo en Perú/Ecuador”</b> → se prueba con liberación sísmica acumulada (magnitud equivalente) y cambio de tasa. Es un proxy experimental; no existe una ley que diga que liberar más energía en un país reduzca necesariamente la siguiente ruptura al norte.<br>'+
        '<b>6. Cambio de geometría de la placa</b> → el margen Nazca–Sudamérica no es uniforme; los cambios de inclinación de la losa se usan como filtro de continuidad, no como una cadena rígida Chile→Perú→Ecuador→Colombia.'+
        '</div></details>';
    const p=document.getElementById('projection40');p?p.insertAdjacentElement('afterend',card):aside.insertBefore(card,aside.firstChild);

    const key=document.createElement('section');key.className='card';key.id='zones42legend';
    key.innerHTML='<h2>🗺️ Zonas proyectadas experimentales</h2><div class="small"><b>Naranja/rojo:</b> mayor prioridad técnica del modelo reconstruido. <b>Amarillo:</b> vigilancia intermedia. <b>Azul:</b> exploratoria. Son zonas de vigilancia, no probabilidades de ocurrencia ni alertas oficiales.</div>';
    card.insertAdjacentElement('afterend',key);
  }

  function render(){
    ensure();let ev=[];try{ev=Array.isArray(allEvents)?allEvents:[]}catch(_){}
    const t0=new Date(CLAIM.nominal).getTime(),now=Date.now(),src=sourceState(ev,t0),mig=observedMigration(ev,t0);
    const scored=ZONES.map(z=>scoreZone(ev,z,t0,src)).sort((a,b)=>b.display-a.display);
    const peruPost=ev.filter(e=>e.time>=t0&&e.time<=now&&inBox(e,SRCBOX.peru)&&Number(e.mag)>=3);
    const peruMeq=momentProxy(peruPost);
    const ve=ev.filter(e=>e.time>=t0&&e.time<=Math.min(now,new Date(CLAIM.venezuelaEnd).getTime())&&inBox(e,SRCBOX.venezuela)&&Number(e.mag)>=3);
    document.getElementById('t42src').textContent=src.anchor?(fmt(src.anchor)+' · Mmáx48h '+src.mmax.toFixed(1)):'sin ancla M≥3.5';
    document.getElementById('t42mig').textContent=mig.c==null?'—':('r='+mig.c.toFixed(2)+' · '+mig.label);
    document.getElementById('t42rel').textContent=peruMeq?('Meq '+peruMeq.toFixed(1)+' · '+peruPost.length+' M≥3'):'sin señal ≥M3';
    document.getElementById('t42ven').textContent=phase(now,t0,new Date(CLAIM.venezuelaEnd).getTime())+' · '+ve.length+' M≥3';

    const host=document.getElementById('t42zones');
    host.innerHTML=scored.map((x,i)=>{
      const v=validation(ev,x.z,t0),mods=[];
      if(x.liveExp>.2)mods.push('modif. experimental vivo +'+x.liveExp.toFixed(1));
      return '<div class="listitem"><div class="dot" style="background:'+color(x.display)+'"></div><div><div class="zname"><b>#'+(i+1)+'</b> '+x.z.name+'</div><div class="zdesc">'+
        '<b>Índice técnico reconstruido:</b> '+x.frozen.toFixed(1)+'/100'+(mods.length?' · '+mods.join(''):'')+'<br>'+
        'continuidad '+x.continuity.toFixed(1)+' · susceptibilidad previa '+x.priorPts.toFixed(1)+' · fuente '+x.sourcePts.toFixed(1)+' · familia/profundidad '+x.famPts.toFixed(1)+'<br>'+
        '<b>Ventana del claim:</b> '+x.z.window+' · <b>validación:</b> '+v.state+(v.post.length?' · '+v.post.length+' M≥3.5 · razón tasa ×'+v.ratio.toFixed(2):'')+
        '</div></div><div class="pct">'+(x.display>=70?'Alta':x.display>=55?'Prioritaria':x.display>=40?'Media':'Exploratoria')+'</div></div>';
    }).join('');

    if(layer){
      layer.clearLayers();
      scored.forEach((x,i)=>{
        L.circle([x.z.lat,x.z.lon],{
          radius:x.z.r*1000,color:color(x.display),weight:i<2?3:2,fillColor:color(x.display),
          fillOpacity:i<2?.13:.06,dashArray:i<2?'':'7 6'
        }).bindPopup('<b>'+x.z.name+'</b><br>Índice técnico reconstruido '+x.frozen.toFixed(1)+'/100<br>Susceptibilidad previa '+x.prior.label+' · razón ×'+x.prior.ratio.toFixed(2)+'<br>Ventana: '+x.z.window).addTo(layer);
        L.marker([x.z.lat,x.z.lon],{interactive:false,icon:L.divIcon({className:'',html:'<div style="background:#07111edd;border:2px solid '+color(x.display)+';color:#fff;border-radius:8px;padding:3px 6px;font:800 10px Arial;white-space:nowrap">#'+(i+1)+' '+x.z.name.replace(/^Z\\d · /,'')+'</div>',iconAnchor:[12,12]})}).addTo(layer);
      });
    }
    if(claimLayer){
      claimLayer.clearLayers();
      const path=[[-28.5,-71.4],[-10.5,-77.5],[-3.15,-80.25],[-1.05,-80.55],[.55,-79.95],[2.55,-77.65],[4.95,-76.75]];
      L.polyline(path,{weight:4,dashArray:'10 8',opacity:.75}).bindTooltip('Trayectoria declarada: Sur→Norte · claim externo').addTo(claimLayer);
      if(mig.pts.length>1){
        for(let i=0;i<mig.pts.length-1;i++){
          L.polyline([[mig.pts[i].e.lat,mig.pts[i].e.lon],[mig.pts[i+1].e.lat,mig.pts[i+1].e.lon]],{weight:2,dashArray:'4 5',opacity:.75}).bindTooltip('Orden observado de primera activación M≥3.5').addTo(claimLayer);
        }
      }
    }
    if(atlLayer){
      atlLayer.clearLayers();
      L.circle([10.3,-64.4],{radius:520000,weight:2,dashArray:'7 6',fillOpacity:.04}).bindTooltip('Venezuela costera · nodo externo del claim').addTo(atlLayer);
      L.polyline([[10,-52],[10.3,-64.4]],{weight:3,dashArray:'8 7',opacity:.65}).bindTooltip('Atlántico→Venezuela · origen no especificado en la publicación').addTo(atlLayer);
    }
    window.mivigeTechnicalClaim42={claim:CLAIM,source:src,migration:mig,zones:scored};
  }

  ensure();
  if(layer&&claimLayer&&atlLayer){
    try{L.control.layers({},{
      'Zonas proyectadas técnicas v42':layer,
      'Trayectoria declarada vs observada':claimLayer,
      'Rama Atlántico→Venezuela':atlLayer
    },{collapsed:false,position:'topright'}).addTo(map);}catch(_){}
  }
  setTimeout(render,2600);setInterval(render,60000);
  const b=document.getElementById('refresh');if(b)b.addEventListener('click',()=>setTimeout(render,2300));
  window.mivigeRenderTechnicalClaim42=render;
})();