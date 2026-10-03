/* Overrides only the v2 page. Other historic viewers retain their original parsers. */
n=(value,fallback=null)=>MivigeQuality.number(value)??fallback;
dedupe=events=>MivigeQuality.deduplicate(events,sourcePriority);
const originalNormalizeV21=normalize;
// This historical SGC service does not support offsets. Its latest date must be shown.
{const u=new URL(endpoints.SGC);u.searchParams.delete('resultRecordCount');u.searchParams.set('orderByFields','ESP_FECHA_LONG DESC');endpoints.SGC=u.href;}
normalize=function(source,f){
 const e=originalNormalizeV21(source,f);if(!e)return null;
 const p=f.properties||{},g=f.geometry?.coordinates||[];
 if(source==='SGC'&&/^\d{13}$/.test(String(p.ESP_FECHA_TXT)))e.time=Number(p.ESP_FECHA_TXT);
 const depths={'USGS':g[2],'IG-EPN':p.sis3_profundidad,'IGP':p.prof,'SGC':p.ESP_PROFUNDIDAD};
 e.depth=MivigeQuality.number(depths[source]);
 e.magType=source==='USGS'?p.magType:source==='IG-EPN'?p.sis3_tipo_magnitud_P:null;
 e.updated=source==='USGS'?MivigeQuality.number(p.updated):null;
 return e;
};
fetchSource=async function(name,url){
 const requestedAt=Date.now(),controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
 try{
  let features=[],truncated=false,generated=null;
  for(let page=0;page<10;page++){
   const pageURL=new URL(url);if(name!=='USGS'&&name!=='SGC')pageURL.searchParams.set('resultOffset',String(page*500));
   const r=await fetch(pageURL.href,{cache:'no-store',signal:controller.signal});if(!r.ok)throw Error('HTTP '+r.status);
   const j=await r.json();if(j.error||!Array.isArray(j.features))throw Error('Catálogo inválido');
   features.push(...j.features);generated=j.metadata?.generated||null;
   const sample=MivigeQuality.clean(j.features.map(f=>normalize(name,f)),requestedAt);
   const crossedBoundary=sample.some(e=>e.time<=requestedAt-7*86400000);
   const more=Boolean(j.exceededTransferLimit||j.properties?.exceededTransferLimit)||j.features.length>=500;
   truncated=name!=='USGS'&&more&&!crossedBoundary;
   if(name==='USGS'||name==='SGC'||!truncated)break;
  }
  const events=MivigeQuality.clean(features.map(f=>normalize(name,f)),requestedAt);
  const newest=events.length?Math.max(...events.map(e=>e.time)):null;
  const stale=(Number.isFinite(generated)&&requestedAt-generated>30*60000)||(name==='SGC'&&(!newest||requestedAt-newest>7*86400000));
  sourceStatus[name]={ok:!stale,count:events.length,rejected:features.length-events.length,truncated,fetchedAt:Date.now(),generated,stale,newest:events.length?Math.max(...events.map(e=>e.time)):null,oldest:events.length?Math.min(...events.map(e=>e.time)):null};
  if(stale){sourceStatus[name].error='Catálogo sin actualización reciente'+(newest?' · último evento '+new Date(newest).toISOString().slice(0,10):'');return [];}
  return events;
 }catch(error){sourceStatus[name]={ok:false,count:0,fetchedAt:Date.now(),error:String(error).slice(0,100)};return [];}
 finally{clearTimeout(timer);}
};
const oldTectonicClassV21=tectonicClass;
tectonicFamily=function(e){if(!Number.isFinite(e.depth))return 'unknown';return e.depth>=70?'intraslab':e.depth>=30?'intermediate':'shallow';};
tectonicClass=function(e){return !Number.isFinite(e.depth)?'Profundidad no disponible':e.depth>=70?'Profundo/intermedio; origen intraslab por confirmar':e.depth>=30?'Profundidad intermedia; mecanismo no determinado':'Somero; cortical/interfaz no resuelto';};
