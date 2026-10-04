(()=>{"use strict";
const BASE="https://www.inamhi.gob.ec/pronostico/animacion_modelo/";
const PRODUCTS={"Ecuador":"ecu_p_3h.gif",
"Azuay":"Azuay_p_3h.gif","Cañar":"Canar_Prov_p_6h.gif","Chimborazo":"Chimborazo_p_3h.gif",
"Cotopaxi":"Cotopaxi_p_3h.gif","El Oro":"El_Oro_p_3h.gif","Morona Santiago":"MoronaSantiago_p_3h.gif",
"Pastaza":"Pastaza_p_3h.gif","Tungurahua":"Tungurahua_p_3h.gif"
};
function init(){
 if(!window.L||!window.mivigeMap) return setTimeout(init,700);
 const css=document.createElement("style");css.textContent=`
 .rainCtl{background:#0b1725;color:#e9f6ff;border:1px solid #3c6d8b;border-radius:7px;padding:7px 10px;box-shadow:0 2px 10px #0008;font:12px system-ui;cursor:pointer}
 .rainPanel{position:absolute;z-index:1002;left:12px;bottom:26px;width:min(430px,calc(100vw - 24px));max-height:72vh;overflow:auto;background:#08131eeF;color:#e9f6ff;border:1px solid #3c6d8b;border-radius:10px;padding:10px;box-shadow:0 8px 28px #000b}
 .rainPanel h3{margin:0 0 7px;font-size:14px}.rainPanel img{display:block;width:100%;height:auto;border-radius:6px;background:#fff}
 .rainRow{display:flex;gap:6px;align-items:center;margin:6px 0}.rainRow select,.rainRow button{background:#10283b;color:#e9f6ff;border:1px solid #416982;border-radius:5px;padding:5px}
 .rainMeta{font-size:11px;line-height:1.35;color:#bcd1df;margin-top:7px}.rainDot{display:inline-block;width:8px;height:8px;border-radius:50%;background:#52b7ff;margin-right:5px}
 `;document.head.appendChild(css);
 const C=L.Control.extend({options:{position:"topleft"},onAdd(){const b=L.DomUtil.create("button","rainCtl");b.type="button";b.innerHTML="☔ Lluvia · INAMHI";L.DomEvent.disableClickPropagation(b);b.onclick=toggle;return b;}});
 new C().addTo(window.mivigeMap);
 const p=document.createElement("div");p.id="rainPanel";p.className="rainPanel";p.hidden=true;
 p.innerHTML='<h3>Precipitación · fuente oficial INAMHI</h3><div class="rainRow"><label>Zona</label><select id="rainRegion"></select><button id="rainReload">Actualizar</button><button id="rainClose">×</button></div><img id="rainImg" alt="Animación oficial INAMHI de precipitación WRF cada 3 horas"><div class="rainMeta"><span class="rainDot"></span><b>WRF · precipitación 3-horaria</b><br>La animación muestra la evolución/recorrido previsto de la lluvia en cuadros sucesivos. Es una capa meteorológica independiente: no modifica IDG, IDS, IITE, IADR ni el semáforo sísmico.<br><span id="rainStamp"></span><br><a href="https://inamhi.geoglows.org/apps/met-data-explorer" target="_blank" rel="noopener" style="color:#86ccff">INAMHI GEOGLOWS · explorador meteorológico</a></div>';
 document.getElementById("map").appendChild(p);
 const s=p.querySelector("#rainRegion");Object.keys(PRODUCTS).forEach(k=>{const o=document.createElement("option");o.value=k;o.textContent=k;s.appendChild(o)});s.value="Ecuador";
 function load(){const f=PRODUCTS[s.value];p.querySelector("#rainImg").src=BASE+f+"?t="+Date.now();p.querySelector("#rainStamp").textContent="Consulta: "+new Date().toLocaleString("es-EC",{timeZone:"America/Guayaquil"})+" · producto servido directamente por INAMHI."}
 s.onchange=load;p.querySelector("#rainReload").onclick=load;p.querySelector("#rainClose").onclick=()=>p.hidden=true;load();
 function toggle(){p.hidden=!p.hidden;if(!p.hidden)load()}
 window.MIVIGE_RAIN={toggle,load,products:PRODUCTS}; const mainBtn=document.getElementById("rainToggleMain"); if(mainBtn) mainBtn.onclick=toggle;
}
init();
})();