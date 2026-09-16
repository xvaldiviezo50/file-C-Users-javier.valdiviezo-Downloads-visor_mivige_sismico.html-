(function(){
  /* MIVIGE v35 · complemento oficial IG-EPN de baja latencia.
     No sustituye el catálogo ArcGIS: añade publicaciones oficiales recientes y
     deduplica por ID/hora/posición. Telegram oficial es la fuente web legible;
     si CORS impide lectura directa, se muestra el estado sin inventar datos. */
  const FEED='https://t.me/s/SismosVolcanesIGEPN';
  const EVERY=5*60*1000;
  function parseNum(s){return Number(String(s||'').replace(',','.'));}
  function parsePosts(html){
    const doc=new DOMParser().parseFromString(html,'text/html'), out=[];
    doc.querySelectorAll('.tgme_widget_message_text').forEach(el=>{
      const t=(el.innerText||el.textContent||'').replace(/\u00a0/g,' ');
      if(!/Evento:\s*igepn/i.test(t)) return;
      const id=t.match(/Evento:\s*(igepn\w+)/i)?.[1];
      const dt=t.match(/Ocurrido:\s*(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})/i);
      const mag=t.match(/Mag\.:\s*([0-9.,]+)/i), dep=t.match(/Prof\.:\s*([0-9.,]+)\s*km/i);
      const lat=t.match(/Lat\.:\s*([0-9.,]+)°\s*([NS])/i), lon=t.match(/Long\.:\s*([0-9.,]+)°\s*([EW])/i);
      if(!id||!dt||!mag||!dep||!lat||!lon) return;
      let la=parseNum(lat[1])*(lat[2].toUpperCase()==='S'?-1:1), lo=parseNum(lon[1])*(lon[2].toUpperCase()==='W'?-1:1);
      const time=Date.parse(dt[1]+'T'+dt[2]+'-05:00');
      const place=t.match(/Localizado:\s*([^\n]+)/i)?.[1]?.trim()||'Ecuador';
      const revised=/\[REVISADO\]/i.test(t), preliminary=/\[PRELIMINAR\]/i.test(t);
      out.push({source:'IG-EPN',sourceDetail:'IG-EPN red oficial',id,time,mag:parseNum(mag[1]),depth:parseNum(dep[1]),lat:la,lon:lo,place,status:revised?'Revisado':preliminary?'Preliminar':'Publicado'});
    });
    // conservar la publicación más reciente/revisada de un mismo ID
    const m=new Map(); out.forEach(e=>{const o=m.get(e.id); if(!o||e.status==='Revisado')m.set(e.id,e);});
    return [...m.values()];
  }
  async function socialRefresh(){
    try{
      const r=await fetch(FEED,{cache:'no-store'}); if(!r.ok) throw Error('HTTP '+r.status);
      const es=parsePosts(await r.text());
      window.igepnSocialEvents=es;
      if(typeof sourceStatus!=='undefined') sourceStatus['IG-EPN red oficial']={ok:true,count:es.length,latency:'baja latencia'};
      if(typeof allEvents!=='undefined'&&typeof dedupe==='function'&&es.length){ allEvents=dedupe([...allEvents,...es]); }
      if(typeof updateSources==='function') updateSources();
    }catch(err){
      window.igepnSocialEvents=[];
      if(typeof sourceStatus!=='undefined') sourceStatus['IG-EPN red oficial']={ok:false,error:'Fuente oficial complementaria no legible desde navegador (CORS/red)'};
      if(typeof updateSources==='function') updateSources();
    }
  }
  window.refreshIGEPNOfficialSocial=socialRefresh;
  setTimeout(socialRefresh,1500); setInterval(socialRefresh,EVERY);
})();