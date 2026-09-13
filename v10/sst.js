(function(){
  try{
    if(typeof L==='undefined' || typeof map==='undefined' || !L.tileLayer){ return; }

    // NASA/JPL GHRSST MUR L4 SST. GIBS "default" time resolves to the most recent
    // image available for the layer. This is near-real-time daily imagery, not
    // instantaneous ocean temperature; typical latency is about one day.
    const sstUrl='https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/GHRSST_L4_MUR_Sea_Surface_Temperature/default/default/GoogleMapsCompatible_Level7/{z}/{y}/{x}.png';
    const sstLayer=L.tileLayer(sstUrl,{
      maxNativeZoom:7,
      maxZoom:18,
      minZoom:1,
      opacity:0.58,
      attribution:'SST: NASA/JPL GHRSST MUR via NASA GIBS'
    });

    let enabled=false;
    function setSST(on){
      enabled=!!on;
      if(enabled){ if(!map.hasLayer || !map.hasLayer(sstLayer)) sstLayer.addTo(map); }
      else if(map.removeLayer){ try{ map.removeLayer(sstLayer); }catch(e){} }
      const b=document.getElementById('sstToggle');
      if(b){ b.textContent=enabled?'Ocultar temperatura del mar':'Mostrar temperatura del mar'; b.dataset.on=enabled?'1':'0'; }
      const s=document.getElementById('sstState');
      if(s) s.textContent=enabled?'Visible · último campo disponible':'Disponible · capa apagada';
    }

    // Small map control, independent of the main Leaflet layer control.
    if(L.Control && L.Control.extend){
      const SSTControl=L.Control.extend({
        options:{position:'topright'},
        onAdd:function(){
          const box=L.DomUtil.create('div','leaflet-bar');
          box.style.background='#0d1b2d'; box.style.color='#eaf2fb'; box.style.padding='7px 9px';
          box.style.border='1px solid #335777'; box.style.borderRadius='6px'; box.style.fontSize='11px'; box.style.cursor='pointer';
          box.title='Temperatura superficial del mar · NASA/JPL GHRSST MUR';
          box.innerHTML='🌊 SST';
          box.onclick=function(ev){ if(ev){ev.preventDefault();ev.stopPropagation();} setSST(!enabled); };
          return box;
        }
      });
      new SSTControl().addTo(map);
    }

    // Add a concise information card to the sidebar.
    const aside=document.querySelector('aside');
    if(aside && !document.getElementById('sstCard')){
      const card=document.createElement('section');
      card.className='card'; card.id='sstCard';
      card.innerHTML=`<h2>🌊 Temperatura superficial del mar</h2>
        <div class="kpis">
          <div class="kpi"><div class="name">Fuente</div><div class="val" style="font-size:13px">NASA/JPL GHRSST MUR</div></div>
          <div class="kpi"><div class="name">Actualización</div><div class="val" id="sstState" style="font-size:13px">Disponible · capa apagada</div></div>
        </div>
        <button id="sstToggle" style="margin-top:8px">Mostrar temperatura del mar</button>
        <div class="small" style="margin-top:8px">SST global L4 de alta resolución, servida por NASA GIBS. Es una capa <b>casi en tiempo real</b> con actualización diaria y latencia típica de alrededor de 1 día; no representa temperatura instantánea. Se usa como contexto oceánico y no modifica por sí sola el semáforo sísmico MIVIGE.</div>`;
      const cards=aside.querySelectorAll('.card');
      if(cards.length>=4) cards[3].insertAdjacentElement('afterend',card); else aside.appendChild(card);
      const btn=document.getElementById('sstToggle');
      if(btn) btn.onclick=()=>setSST(!enabled);
    }

    window.mivigeSSTLayer=sstLayer;
    window.mivigeSetSST=setSST;
  }catch(err){
    console.warn('MIVIGE SST layer unavailable',err);
  }
})();
