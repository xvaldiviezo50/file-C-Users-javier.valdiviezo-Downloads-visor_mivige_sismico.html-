(function(){
  const META={
    id:'P-SN-02OCT-2026-01',
    source:'Miguel Ángel Cruz Pérez (publicación externa)',
    viewed:'2026-10-02T19:49:00-05:00',
    nominalPublished:'2026-10-02T16:49:00-05:00',
    uncertainty:'±1 h (la captura mostraba “3 h”)',
    ecuadorStart:'2026-10-03T00:00:00-05:00',
    ecuadorEnd:'2026-10-05T00:00:00-05:00',
    regionalEnd:'2026-10-05T16:49:00-05:00'
  };
  const baseline=[
    'Chile: CSN M4.5, 14 km O de Quintero, 29 km, 02-oct 14:28 local.',
    'Perú: IGP/CENSIS reportó cuatro eventos el 02-oct: M4.0 Trujillo (56 km), M4.0 Atalaya/Ucayali (121 km), M3.5 Amazonas (20 km) y M3.3 Huarochirí/Lima (97 km).',
    'Venezuela: USGS M5.0, 26 km SSO de Güiria, ~9.8 km, 02-oct 11:31 hora Ecuador.',
    'Estos hechos prueban actividad regional simultánea, no una transferencia causal Sur→Norte.'
  ];
  function ensure(){
    if(document.getElementById('southNorthForecastCard')) return;
    const aside=document.querySelector('aside'); if(!aside) return;
    const card=document.createElement('section'); card.className='card'; card.id='southNorthForecastCard';
    card.innerHTML=`<h2>🧪 Hipótesis externa Sur→Norte · seguimiento prospectivo</h2>
      <div class="small"><b>ID:</b> ${META.id}<br><b>Estado científico:</b> <span id="snScientific">No confirmada</span><br>
      <b>Publicación nominal:</b> 02-oct-2026 ~16:49 ECU ${META.uncertainty}<br>
      <b>Claim explícito:</b> actividad/tensión avanzaría Chile → Perú → Ecuador entre sábado y domingo → luego Colombia. El texto no fija una magnitud exacta para Ecuador.</div>
      <div style="margin-top:8px" id="snBaseline"></div>
      <div style="margin-top:8px" class="kpis">
        <div class="kpi"><div class="name">Chile post-publicación</div><div class="val" id="snChile">—</div></div>
        <div class="kpi"><div class="name">Perú post-publicación</div><div class="val" id="snPeru">—</div></div>
        <div class="kpi"><div class="name">Ecuador sáb-dom</div><div class="val" id="snEcuador">Pendiente</div></div>
        <div class="kpi"><div class="name">Colombia después</div><div class="val" id="snColombia">Pendiente</div></div>
      </div>
      <div class="small" id="snAssessment" style="margin-top:8px"></div>
      <div class="small" style="margin-top:8px;color:#7894ac"><b>Regla:</b> esta capa es externa/experimental y nunca eleva por sí sola el semáforo MIVIGE. Para sostener activación física se requieren mecanismos, tiempos de propagación, ETAS/fondo y/o Coulomb/GNSS compatibles.</div>`;
    const exp=[...document.querySelectorAll('section.card h2')].find(h=>/CAPA B/.test(h.textContent));
    if(exp) exp.parentElement.insertAdjacentElement('afterend',card); else aside.insertBefore(card,aside.firstChild);
    document.getElementById('snBaseline').innerHTML='<b>Hechos verificados al congelar la prueba:</b><br>'+baseline.map(x=>'• '+x).join('<br>');
  }
  function inBox(e,b){return e&&e.lat>=b[0]&&e.lat<=b[1]&&e.lon>=b[2]&&e.lon<=b[3];}
  const B={
    chile:[-56,-17,-76,-66],
    peru:[-19.5,0,-82,-68],
    ecuador:[-5.2,2.2,-81.6,-75.0],
    colombia:[-4.5,13.5,-79.5,-66.5]
  };
  function maxEvent(arr){return arr.length?arr.slice().sort((a,b)=>b.mag-a.mag)[0]:null;}
  function fmt(e){return e?('M'+Number(e.mag).toFixed(1)+' · '+Math.round(Number(e.depth||0))+' km'):'sin evento ≥ filtro';}
  function render(){
    ensure();
    let ev=[];
    try{ if(Array.isArray(allEvents)) ev=allEvents; }catch(_){}
    const t0=new Date(META.nominalPublished).getTime();
    const eqA=new Date(META.ecuadorStart).getTime(), eqB=new Date(META.ecuadorEnd).getTime();
    const regB=new Date(META.regionalEnd).getTime();
    const relevant=ev.filter(e=>e.time>=t0 && e.time<=regB && Number(e.mag)>=3.0);
    const ch=maxEvent(relevant.filter(e=>inBox(e,B.chile)));
    const pe=maxEvent(relevant.filter(e=>inBox(e,B.peru)));
    const ec=maxEvent(ev.filter(e=>e.time>=eqA&&e.time<=eqB&&Number(e.mag)>=3.0&&inBox(e,B.ecuador)));
    const co=maxEvent(relevant.filter(e=>inBox(e,B.colombia)));
    document.getElementById('snChile').textContent=fmt(ch);
    document.getElementById('snPeru').textContent=fmt(pe);
    document.getElementById('snEcuador').textContent=Date.now()<eqA?'Ventana aún no inicia':fmt(ec);
    document.getElementById('snColombia').textContent=fmt(co);
    const now=Date.now();
    let assessment='No hay base para afirmar que los eventos observados sean una “energía” que migra de Chile a Colombia. La secuencia se mantiene como hipótesis prospectiva externa.';
    if(ec) assessment+=' Durante la ventana Ecuador existe actividad registrada, pero por sí sola no demuestra dirección ni causalidad.';
    if(now>eqB&&!ec) assessment+=' La ventana sábado-domingo terminó sin evento M≥3 en el catálogo combinado del visor.';
    document.getElementById('snAssessment').innerHTML='<b>Evaluación:</b> '+assessment;
    const sci=document.getElementById('snScientific'); if(sci) sci.textContent='No confirmada · compatibilidad temporal ≠ causalidad';
  }
  ensure(); setTimeout(render,1800); setInterval(render,60000);
})();