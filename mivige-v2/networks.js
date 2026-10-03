/* National inventories are coverage metadata; ENU remains a separate measurement. */
(function(){
'use strict';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const DAY=86400000, colors={rengeo:'#f1b653',regme:'#77df9d',geored:'#e49bef',igp:'#85c9ff'};
let inventory=null,control=null;const layers={};
function match(s){
 const data=window.MivigeGeodesy?.data;
 return data?.stations?.find(g=>g.code===s.code&&Math.hypot(g.lat-s.lat,(g.lon-s.lon)*Math.cos(s.lat*Math.PI/180))*111.2<=5);
}
function fresh(g){const age=Date.now()-Date.parse(g?.observed_at);return g?.usable&&age>=0&&age<=7*DAY;}
function status(g){return !g?'sin serie ENU integrada':(fresh(g)?'serie con tamiz vigente':g.reason||'serie no vigente')+' · '+(g.observed_at?.slice(0,10)||'sin época válida');}
function seriesButton(g){return g?.series?.length?'<button data-gnss-code="'+esc(g.code)+'">Ver serie '+esc(g.code)+'</button>':'';}
function showSeries(code){
 const select=document.getElementById('gnssStation');
 if(select&&Array.from(select.options).some(o=>o.value===code)){select.value=code;select.dispatchEvent(new Event('change'));document.getElementById('gnssRegional').scrollIntoView({behavior:'smooth'});}
}
document.addEventListener('click',e=>{const b=e.target.closest('[data-gnss-code]');if(b)showSeries(b.dataset.gnssCode);});
function render(){
 const host=document.getElementById('nationalNetworks');if(!inventory||!host)return;
 host.innerHTML='<p class="small">Cobertura nacional recuperada. Las series E/N/U coincidentes se procesan mediante NGL; el inventario institucional permite localizar y atribuir la estación. Una estación compartida no cuenta como evidencia independiente por cada red.</p>'+inventory.sources.map(source=>{
  const rows=source.stations.map(s=>({s,g:match(s)}));const matched=rows.filter(r=>r.g).length, usable=rows.filter(r=>fresh(r.g)).length;
  return '<details open><summary><b>'+esc(source.name)+'</b> · '+rows.length+' registros</summary><p class="small">'+matched+' coinciden con series consultadas · '+usable+' con tamiz vigente.<br>'+esc(source.status)+(source.retrieved_at?'<br>Inventario recuperado: '+esc(source.retrieved_at):'')+(source.checked_at&&Date.now()-Date.parse(source.checked_at)>2*DAY?'<br>Consulta de inventario atrasada (>2 días)':'')+'<br>'+esc(source.access)+(source.error?'<br>Último error: '+esc(source.error):'')+'</p><a href="'+esc(source.portal)+'" target="_blank" rel="noopener">Abrir fuente institucional</a><details><summary>Estaciones, estado y series</summary><div style="max-height:240px;overflow:auto"><table class="table"><thead><tr><th>Estación</th><th>Inventario</th><th>Medición E/N/U</th></tr></thead><tbody>'+rows.map(({s,g})=>'<tr><td>'+esc(s.code)+'<br>'+esc(s.name)+'</td><td>'+esc(s.declared_status)+'</td><td>'+esc(status(g))+seriesButton(g)+'</td></tr>').join('')+'</tbody></table></div></details></details>';
 }).join('')+'<p class="small">Sin ENU verificable = datos insuficientes. El estado operativo declarado por una institución no certifica actualidad o calidad de la serie.</p>';
 if(typeof L==='undefined'||typeof map==='undefined')return;
 if(!control){control=L.control.layers({},{},{collapsed:true,position:'topleft'}).addTo(map);}
 inventory.sources.forEach(source=>{
  if(!layers[source.id]){layers[source.id]=L.layerGroup().addTo(map);control.addOverlay(layers[source.id],source.name+' · inventario');}
  const layer=layers[source.id];layer.clearLayers();
  source.stations.forEach(s=>{
   const g=match(s),color=colors[source.id]||'#fff';
   const marker=L.marker([s.lat,s.lon],{icon:L.divIcon({className:'national-gnss-marker',html:'<span style="display:block;width:8px;height:8px;background:'+color+';border:1px solid #152239;transform:rotate(45deg)"></span>',iconSize:[10,10],iconAnchor:[5,5]})});
   marker.bindPopup('<b>'+esc(source.name)+' · '+esc(s.code)+'</b><br>'+esc(s.name)+'<br>Estado institucional: '+esc(s.declared_status)+'<br>'+esc(status(g))+'<br>'+seriesButton(g)+'<br><a target="_blank" rel="noopener" href="'+esc(source.portal)+'">Fuente institucional</a><br><small>'+esc(source.id==='rengeo'?'Ubicación aproximada heredada; vigencia no verificada.':'Inventario: '+(source.retrieved_at||'sin fecha'))+'</small>').addTo(layer);
  });
 });
}
async function load(){
 const urls=['https://raw.githubusercontent.com/xvaldiviezo50/file-C-Users-javier.valdiviezo-Downloads-visor_mivige_sismico.html-/main/mivige-v2/data/networks.json','data/networks.json'];
 for(const url of urls){try{const r=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(8000)});if(!r.ok)throw Error('HTTP '+r.status);const d=await r.json();if(d.schema!==1||!Array.isArray(d.sources))throw Error('Formato inválido');inventory=d;render();return;}catch(e){/* Try published backup. */}}
 document.getElementById('nationalNetworks').textContent=inventory?'No se pudo actualizar; se conserva el inventario cargado.':'Inventarios no disponibles en esta consulta; no implica ausencia de estaciones ni deformación.';
}
window.addEventListener('mivige:geodesy',render);
document.getElementById('refresh')?.addEventListener('click',load);
load();setInterval(load,6*3600000);
})();
