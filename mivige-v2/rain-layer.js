/* Independent weather overlay. Nothing is loaded until the user activates it. */
(function(){'use strict';
if(typeof map==='undefined'||typeof L==='undefined')return;
const css=document.createElement('style');css.textContent='#rainPanel[hidden],#rainPanel [hidden]{display:none!important}#rainPanel select{max-width:100%}#rainPanel .controls{flex-wrap:wrap}';document.head.append(css);
const panel=document.createElement('section');panel.id='rainPanel';panel.className='card';panel.style.margin='10px';panel.hidden=true;
panel.innerHTML='<h2>Lluvias · INAMHI / INOCAR</h2><div class="controls"><label>Producto <select id="rainProduct"><option value="sat">INAMHI–GEOGLOWS · estimación satelital 24 h</option><option value="wrf">INAMHI–GEOGLOWS · pronóstico WRF 3 h</option><option value="inocar">INOCAR · pronóstico WRF 3 h</option></select></label><label>Fecha <select id="rainDate"></select></label><button id="rainPrev" aria-label="Fecha anterior">◀</button><button id="rainNext" aria-label="Fecha siguiente">▶</button><button id="rainReload">Actualizar</button><button id="rainClose">Ocultar lluvias</button></div><p id="rainStatus" class="small" role="status"></p><div id="rainMapOptions"><label>Opacidad <input id="rainOpacity" type="range" min="10" max="90" value="55"></label><button id="rainExtent">Ver cobertura</button><img id="rainLegend" alt="Escala de precipitación en milímetros" style="display:block;max-width:100%;max-height:100px;margin-top:8px"></div><img id="rainInocar" alt="Precipitación WRF de INOCAR; fecha y escala en el mapa" style="display:block;width:100%;height:auto" hidden><p class="small" id="rainDescription"></p>';
document.getElementById('map').after(panel);
const $=id=>document.getElementById(id);let active=false,layer=null,products={},generation=0;
const button=document.createElement('button');button.id='rainToggle';button.textContent='🌧 Lluvias';button.setAttribute('aria-pressed','false');button.setAttribute('aria-controls','rainPanel');button.style.cssText='background:#12354c;color:white;border:1px solid #609abc;border-radius:6px;padding:9px;cursor:pointer';
const control=L.control({position:'topleft'});control.onAdd=()=>{const box=L.DomUtil.create('div');box.append(button);L.DomEvent.disableClickPropagation(box);return box;};control.addTo(map);
function remove(){if(layer){map.removeLayer(layer);layer=null;}}
function fmt(d){return new Date(d).toLocaleString('es-EC',{timeZone:'UTC',dateStyle:'short',timeStyle:'short'})+' UTC';}
function options(){const p=products[$('rainProduct').value];$('rainDate').replaceChildren();if(!p)return;for(const [i,d] of p.dates.entries()){const o=document.createElement('option');o.value=String(i);o.textContent=$('rainProduct').value==='inocar'?d+' (Ecuador)':fmt(d);$('rainDate').append(o);}const now=Date.now();let nearest=0;let distance=Infinity;p.dates.forEach((d,i)=>{const t=Date.parse($('rainProduct').value==='inocar'?d.replace(' ','T')+'-05:00':d);if(Math.abs(t-now)<distance){nearest=i;distance=Math.abs(t-now);}});$('rainDate').value=String(nearest);}
function draw(){
 remove();if(!active)return;const k=$('rainProduct').value,p=products[k];$('rainInocar').hidden=k!=='inocar';$('rainMapOptions').hidden=k==='inocar';
 $('rainInocar').removeAttribute('src');$('rainLegend').removeAttribute('src');
 if(!p?.dates?.length){$('rainStatus').textContent='El proveedor no respondió y no hay fechas guardadas para este producto. Puedes seleccionar otro producto.';return;}
 const i=Number($('rainDate').value||0),d=p.dates[i];
 $('rainPrev').disabled=i===0;$('rainNext').disabled=i===p.dates.length-1;
 if(k==='inocar'){
  $('rainDescription').textContent='INOCAR · WRF preoperacional, en validación. Acumulación prevista de 3 horas (mm), Ecuador continental y Galápagos. Producto cartográfico oficial dentro del visor; no se superpone como raster georreferenciado. La fecha impresa en la imagen prevalece.';
  $('rainStatus').textContent='Pronóstico desde '+d+' (hora de Ecuador). Consultando imagen…';
  const img=$('rainInocar');img.onload=()=>{if(active&&$('rainProduct').value==='inocar')$('rainStatus').textContent='INOCAR · fecha seleccionada '+d+' · comprueba el intervalo impreso en el mapa.';};img.onerror=()=>{if(active&&$('rainProduct').value==='inocar')$('rainStatus').textContent='INOCAR no pudo entregar esta imagen. Cambia la fecha o pulsa Actualizar.';};
  img.src='https://www.inocar.mil.ec/modelnum/wrf/imagenes/TP_Ecuador_y_Galapagos-'+i+'.png?t='+Date.now();return;
 }
 const selectedTime=Date.parse(d),old=Date.now()-selectedTime>(k==='sat'?48:6)*3600e3;
 $('rainStatus').textContent=(old?'HISTÓRICO / ATRASADO · ':'')+(k==='sat'?'Estimación satelital · ':'Pronóstico WRF · ')+fmt(d)+(p.init?' · inicialización '+fmt(p.init):'');
 $('rainDescription').textContent=k==='sat'?'Precipitación estimada por satélite PERSIANN PDIR, acumulación de 24 h (mm), distribuida por INAMHI–GEOGLOWS. Cobertura publicada: Ecuador continental.':'Pronóstico WRF de precipitación de 3 h (mm), distribuido por INAMHI–GEOGLOWS. Se conservan las fechas disponibles aunque el proveedor esté atrasado. Cobertura publicada: Ecuador continental.';
 const opts={layers:(k==='sat'?'satellite_based_precipitation:':'wrf:')+p.layer,format:'image/png',transparent:true,version:'1.1.1',time:d,opacity:Number($('rainOpacity').value)/100,bounds:p.bounds,attribution:'INAMHI–GEOGLOWS',zIndex:350};if(p.init)opts.dim_initd=p.init;
 layer=L.tileLayer.wms(p.source,opts);const current=layer;layer.on('tileerror',()=>{if(active&&layer===current)$('rainStatus').textContent='No se pudo cargar parte de la capa · '+fmt(d)+' · Actualizar para reintentar.';});layer.addTo(map);
 $('rainLegend').src=p.source+'?service=WMS&request=GetLegendGraphic&format=image/png&layer='+encodeURIComponent(opts.layers);
}
async function load(){const token=++generation;$('rainStatus').textContent='Consultando productos oficiales…';try{const r=await fetch('data/rain-products.json?t='+Date.now(),{signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error();const j=await r.json();if(j.schema!==1)throw Error();products=j.products;}catch(_){if(!Object.keys(products).length){$('rainStatus').textContent='No se pudo obtener el catálogo de lluvia. Pulsa Actualizar para reintentar.';return;}}if(!active||token!==generation)return;options();draw();}
function toggle(){active=!active;button.setAttribute('aria-pressed',String(active));button.textContent=active?'🌧 Ocultar lluvias':'🌧 Lluvias';panel.hidden=!active;if(active)load();else{generation++;remove();$('rainInocar').removeAttribute('src');$('rainLegend').removeAttribute('src');}}
button.onclick=toggle;$('rainClose').onclick=toggle;$('rainReload').onclick=load;$('rainProduct').onchange=()=>{options();draw();};$('rainDate').onchange=draw;$('rainOpacity').oninput=()=>layer?.setOpacity(Number($('rainOpacity').value)/100);$('rainExtent').onclick=()=>{const p=products[$('rainProduct').value];if(p?.bounds)map.fitBounds(p.bounds);};
for(const [id,step] of [['rainPrev',-1],['rainNext',1]])$(id).onclick=()=>{const n=$('rainDate').options.length;$('rainDate').value=String(Math.max(0,Math.min(n-1,Number($('rainDate').value)+step)));draw();};
window.MIVIGE_RAIN={toggle,get active(){return active;}};
})();
