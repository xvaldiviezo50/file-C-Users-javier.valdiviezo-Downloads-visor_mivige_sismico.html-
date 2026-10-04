(()=>{
'use strict';
function init(){
 const map=window.mivigeMap;
 if(!map||!window.L){setTimeout(init,250);return;}
 const RainControl=L.Control.extend({
  options:{position:'topleft'},
  onAdd(){
   const box=L.DomUtil.create('div','leaflet-bar');
   const a=L.DomUtil.create('a','',box);
   a.href='#'; a.title='Activar/desactivar lluvia Ecuador · INAMHI';
   a.innerHTML='🌧'; a.style.fontSize='20px'; a.style.width='38px'; a.style.height='38px'; a.style.lineHeight='38px';
   L.DomEvent.disableClickPropagation(box);
   L.DomEvent.on(a,'click',L.DomEvent.stop).on(a,'click',toggle);
   return box;
  }
 });
 map.addControl(new RainControl());

 // Producto nacional oficial WRF. Se muestra como overlay ligero sobre Ecuador;
 // no altera ninguna variable ni índice sísmico.
 const bounds=L.latLngBounds([[-5.05,-81.35],[1.55,-75.15]]);
 let rain=null, active=false;
 function fresh(){return 'https://www.inamhi.gob.ec/pronostico/animacion_modelo/ecu_p_3h.gif?t='+Date.now();}
 function toggle(){
  if(active){ if(rain)map.removeLayer(rain); active=false; return; }
  if(rain)map.removeLayer(rain);
  rain=L.imageOverlay(fresh(),bounds,{opacity:0.42,interactive:false,className:'mivige-rain-overlay',crossOrigin:false}).addTo(map);
  active=true;
 }
 window.MIVIGE_RAIN={toggle};
}
init();
})();