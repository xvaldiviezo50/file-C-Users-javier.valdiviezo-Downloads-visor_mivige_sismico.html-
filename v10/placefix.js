(function(){
  try{
    const gazetteer=[
      // Ecuador
      ['Esmeraldas','Esmeraldas','Ecuador',0.968,-79.651],['Muisne','Esmeraldas','Ecuador',0.611,-80.020],['Pedernales','Manabí','Ecuador',0.072,-80.052],['Jama','Manabí','Ecuador',-0.204,-80.263],['Manta','Manabí','Ecuador',-0.954,-80.733],['Puerto López','Manabí','Ecuador',-1.560,-80.812],['Guayaquil','Guayas','Ecuador',-2.171,-79.922],['Playas','Guayas','Ecuador',-2.639,-80.389],['Naranjal','Guayas','Ecuador',-2.674,-79.618],['Machala','El Oro','Ecuador',-3.258,-79.960],['Huaquillas','El Oro','Ecuador',-3.476,-80.230],['Cuenca','Azuay','Ecuador',-2.900,-79.005],['Azogues','Cañar','Ecuador',-2.739,-78.849],['Loja','Loja','Ecuador',-3.993,-79.205],['Riobamba','Chimborazo','Ecuador',-1.664,-78.654],['Pallatanga','Chimborazo','Ecuador',-2.002,-78.965],['Ambato','Tungurahua','Ecuador',-1.249,-78.616],['Quito','Pichincha','Ecuador',-0.180,-78.468],['Otavalo','Imbabura','Ecuador',0.234,-78.261],['Ibarra','Imbabura','Ecuador',0.351,-78.123],['El Ángel','Carchi','Ecuador',0.622,-77.940],['Tulcán','Carchi','Ecuador',0.812,-77.718],
      // Perú norte y Amazonía
      ['Tumbes','Tumbes','Perú',-3.566,-80.451],['Zorritos','Tumbes','Perú',-3.680,-80.678],['Máncora','Piura','Perú',-4.107,-81.047],['Talara','Piura','Perú',-4.579,-81.271],['Piura','Piura','Perú',-5.194,-80.632],['Jaén','Cajamarca','Perú',-5.709,-78.807],['Bagua','Amazonas','Perú',-5.638,-78.531],['Chachapoyas','Amazonas','Perú',-6.231,-77.870],['Santa María de Nieva','Amazonas','Perú',-4.592,-77.864],['Andoas','Loreto','Perú',-2.902,-76.403],['San Lorenzo','Loreto','Perú',-4.828,-76.555],['Iquitos','Loreto','Perú',-3.749,-73.254],['Moyobamba','San Martín','Perú',-6.034,-76.972],['Tarapoto','San Martín','Perú',-6.487,-76.359],
      // Perú centro-sur: añadido para los focos que aparecían solo como coordenadas
      ['Lima','Lima','Perú',-12.046,-77.043],['Callao','Callao','Perú',-12.056,-77.118],['Pisco','Ica','Perú',-13.710,-76.203],['Paracas','Ica','Perú',-13.835,-76.250],['Ica','Ica','Perú',-14.068,-75.728],['Nazca','Ica','Perú',-14.830,-74.940],['San Juan de Marcona','Ica','Perú',-15.365,-75.162],['Ayacucho','Ayacucho','Perú',-13.163,-74.224],['Abancay','Apurímac','Perú',-13.634,-72.881],['Cusco','Cusco','Perú',-13.532,-71.967],['Quincemil','Cusco','Perú',-13.235,-70.754],['Mazuko / Inambari','Madre de Dios','Perú',-13.100,-70.370],['Puerto Maldonado','Madre de Dios','Perú',-12.593,-69.189],['Arequipa','Arequipa','Perú',-16.409,-71.537],
      // Colombia
      ['Ipiales','Nariño','Colombia',0.831,-77.644],['Pasto','Nariño','Colombia',1.214,-77.281],['Tumaco','Nariño','Colombia',1.807,-78.764],['Popayán','Cauca','Colombia',2.444,-76.614],['Cali','Valle del Cauca','Colombia',3.451,-76.532],['Buenaventura','Valle del Cauca','Colombia',3.880,-77.031],['Quibdó','Chocó','Colombia',5.691,-76.658],
      // Centroamérica y México
      ['San José','San José','Costa Rica',9.928,-84.091],['Nicoya','Guanacaste','Costa Rica',10.148,-85.453],['Tapachula','Chiapas','México',14.906,-92.263],['Puerto Madero','Chiapas','México',14.721,-92.421],['Tuxtla Gutiérrez','Chiapas','México',16.753,-93.116],['Salina Cruz','Oaxaca','México',16.177,-95.200],['Puerto Escondido','Oaxaca','México',15.872,-97.077],['Acapulco','Guerrero','México',16.853,-99.823],['Puerto San José','Escuintla','Guatemala',13.925,-90.821],
      // Chile
      ['Arica','Arica y Parinacota','Chile',-18.478,-70.312],['Iquique','Tarapacá','Chile',-20.214,-70.152],['Antofagasta','Antofagasta','Chile',-23.650,-70.400],['Copiapó','Atacama','Chile',-27.366,-70.332],['La Serena','Coquimbo','Chile',-29.902,-71.252],['Valparaíso','Valparaíso','Chile',-33.047,-71.613],['Santiago','Metropolitana','Chile',-33.449,-70.669]
    ].map(x=>({name:x[0],region:x[1],country:x[2],lat:x[3],lon:x[4]}));

    function nearest(lat,lon){let best=null;for(const p of gazetteer){const d=distKm(lat,lon,p.lat,p.lon);if(!best||d<best.d)best={...p,d};}return best;}
    function bearing(lat1,lon1,lat2,lon2){const p=Math.PI/180,a=lat1*p,b=lat2*p,dl=(lon2-lon1)*p,y=Math.sin(dl)*Math.cos(b),x=Math.cos(a)*Math.sin(b)-Math.sin(a)*Math.cos(b)*Math.cos(dl);return( Math.atan2(y,x)*180/Math.PI+360)%360;}
    function dir8(d){return ['N','NE','E','SE','S','SO','O','NO'][Math.round(d/45)%8];}
    function usablePlace(s){if(!s)return false;const t=String(s).trim();return t.length>3&&!/^(Ecuador|Perú|Colombia|USGS|IGP|SGC)$/i.test(t);}
    function label(c){
      const anchor=(c.events||[]).slice().sort((a,b)=>(b.mag-a.mag)||(b.time-a.time))[0];
      if(anchor&&usablePlace(anchor.place)) return anchor.place;
      const p=nearest(c.lat,c.lon);if(!p)return 'Sector regional';
      if(p.d<=20)return `${p.name}, ${p.region} (${p.country})`;
      const d=Math.round(p.d),dir=dir8(bearing(p.lat,p.lon,c.lat,c.lon));
      const marine=(c.lon<p.lon-0.35 && ['Ica','Lima','Callao','Chiapas','Oaxaca','Guerrero','Manabí','Esmeraldas','El Oro','Tumbes','Piura'].includes(p.region));
      if(marine)return `Mar frente a ${p.name}, ${p.region} (${p.country}) · ≈${d} km ${dir}`;
      return `≈${d} km ${dir} de ${p.name}, ${p.region} (${p.country})`;
    }
    function family(c){return c.family==='intraslab'?'Intraslab':c.family==='intermediate'?'Intermedia / placa subducida':c.family==='interface'?'Interfaz / somera costera':'Cortical somera';}
    function level(c){return c.score>=75?'Vigilancia reforzada':c.score>=55?'Alta prioridad':c.score>=38?'Observación prioritaria':'Seguimiento';}
    function color(c){return c.score>=75?'#e4493f':c.score>=55?'#f08a24':c.score>=38?'#f0c644':'#52a8ff';}
    function action(c){if(c.family==='intraslab')return 'Revisar continuidad 70–150 km, mecanismos focales y migración hipocentral.';if(c.family==='intermediate')return 'Revisar geometría de la placa subducida, profundidad y continuidad espacial.';if(c.family==='interface')return 'Revisar interfaz de subducción, mecanismos y tsunami si aumenta la magnitud.';return 'Contrastar con fallas activas, mecanismos focales y clustering cortical.';}
    function why(c){const n=(c.events||[]).length;return `Mmáx ${Number(c.maxMag||0).toFixed(1)} · ${n} eventos M≥3 · ${c.count35||0} M≥3.5 · prof. media ${Number(c.meanDepth||0).toFixed(0)} km${c.accelerating?' · tasa 12 h en aumento':''}${n>=2&&Number(c.depStd||99)<=20?' · profundidad coherente':''}`;}

    let placeLayer=null;
    function repaint(){
      const clusters=window.mivigeProactiveClusters;if(!Array.isArray(clusters)||!clusters.length)return;
      const host=document.getElementById('focusList');
      if(host)host.innerHTML=clusters.slice(0,6).map((c,i)=>{const nm=label(c);return `<div class="listitem"><div class="dot" style="background:${color(c)}"></div><div><div class="zname"><b>Prioridad #${i+1}</b> · ${nm}</div><div class="zdesc">${family(c)} · score ${c.score}/100${c.zoneName?` · zona MIVIGE: ${c.zoneName}`:''}<br>${why(c)}<br><b>Focalizar:</b> ${action(c)}<br><span style="color:#7894ac">Centro técnico ${c.lat.toFixed(2)}°, ${c.lon.toFixed(2)}°</span></div></div><div class="pct">${level(c)}</div></div>`;}).join('');
      const mf=document.getElementById('mainFocus');if(mf)mf.textContent=`${label(clusters[0])} · ${level(clusters[0])}`;
      if(typeof L!=='undefined'&&typeof map!=='undefined'&&L.layerGroup){
        if(!placeLayer)placeLayer=L.layerGroup().addTo(map);else placeLayer.clearLayers();
        clusters.slice(0,6).forEach((c,i)=>{const nm=label(c);L.marker([c.lat,c.lon],{icon:L.divIcon({className:'',html:`<div style="background:#07111edd;border:1px solid ${color(c)};color:#fff;border-radius:7px;padding:3px 6px;font:700 10px Arial;white-space:nowrap;box-shadow:0 1px 4px #0008">#${i+1} ${nm}</div>`,iconAnchor:[15,12]})}).bindPopup(`<b>Prioridad #${i+1}</b><br>${nm}<br>${family(c)} · ${level(c)} · score ${c.score}/100<br>${why(c)}<br><br><b>Focalizar:</b> ${action(c)}<br><span style="font-size:10px;color:#7894ac">Centro técnico ${c.lat.toFixed(2)}°, ${c.lon.toFixed(2)}°</span>`).addTo(placeLayer);});
      }
    }

    const originalRender=window.render;
    if(typeof originalRender==='function')window.render=function(){const out=originalRender.apply(this,arguments);setTimeout(repaint,0);return out;};
    const obs=new MutationObserver(()=>{if(document.getElementById('focusList'))setTimeout(repaint,0);});
    obs.observe(document.body,{childList:true,subtree:true});
    setTimeout(repaint,1200);
    window.mivigeRepaintPlaceLabels=repaint;
  }catch(err){console.warn('MIVIGE place labels unavailable',err);}
})();