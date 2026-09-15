/* MIVIGE v35 — capas oficiales INAMHI (WMS público)
 * Fuente: https://geoservicios.inamhi.gob.ec/geoserver/
 * Integración visual independiente: no modifica IDG/IDS/IITE/IADR ni Champion/Challenger.
 */
(function () {
  'use strict';
  if (typeof L === 'undefined' || typeof map === 'undefined') return;

  const WMS = 'https://geoservicios.inamhi.gob.ec/geoserver/wms';
  const caps = 'https://geoservicios.inamhi.gob.ec/geoserver/wms?service=WMS&request=GetCapabilities';

  // Grupo INAMHI. Las capas concretas se descubren desde GetCapabilities para no inventar nombres.
  const inamhiGroup = L.layerGroup();
  const registry = {};

  function addLayer(name, title) {
    if (!name || registry[name]) return;
    const lyr = L.tileLayer.wms(WMS, {
      layers: name,
      format: 'image/png',
      transparent: true,
      version: '1.1.1',
      opacity: 0.68,
      attribution: 'INAMHI'
    });
    registry[name] = lyr;
    lyr.addTo(inamhiGroup);
  }

  // Selección automática conservadora de productos hidrometeorológicos útiles para vigilancia territorial.
  fetch(caps)
    .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
    .then(txt => {
      const xml = new DOMParser().parseFromString(txt, 'text/xml');
      const layers = Array.from(xml.getElementsByTagName('Layer'));
      const candidates = [];
      layers.forEach(node => {
        const n = node.getElementsByTagName('Name')[0];
        const t = node.getElementsByTagName('Title')[0];
        if (!n) return;
        const name = (n.textContent || '').trim();
        const title = t ? (t.textContent || '').trim() : name;
        const s = (name + ' ' + title).toLowerCase();
        if (/(precipit|lluv|inund|hidro|caudal|estacion|meteor|radar|sequia)/.test(s)) candidates.push({name,title});
      });
      // Evita saturar el visor: registra hasta 12 capas pertinentes; apagadas por defecto.
      const chosen = candidates.slice(0,12);
      window.MIVIGE_INAMHI = {wms: WMS, capabilities: caps, layers: chosen, registry};

      // Añadir control Leaflet propio para activar individualmente las capas.
      const overlays = {};
      chosen.forEach(x => {
        const lyr = L.tileLayer.wms(WMS, {layers:x.name,format:'image/png',transparent:true,version:'1.1.1',opacity:0.68,attribution:'INAMHI'});
        registry[x.name] = lyr;
        overlays['INAMHI · ' + x.title] = lyr;
      });
      if (Object.keys(overlays).length) L.control.layers(null, overlays, {collapsed:true, position:'topright'}).addTo(map);
      console.info('[MIVIGE] INAMHI WMS:', chosen.length, 'capas registradas');
    })
    .catch(err => {
      window.MIVIGE_INAMHI = {wms: WMS, capabilities: caps, layers: [], registry, error:String(err)};
      console.warn('[MIVIGE] INAMHI no automatizable en este ciclo:', err);
    });
})();