/* GNSS regional: downloaded observations, distinct from station-location overlays. */
(function(root){
'use strict';
const DAY=86400000;
// ISO 3166-1; coordinate cross-check with Natural Earth 10m and national inventories.
const stationCountries={"QSTP":"CL","SMA3":"CL","USCL":"CL","CAL9":"CL","BTO1":"CL","SAL1":"CL","POR2":"CL","SLM1":"CL","IQQE":"CL","ANTF":"CL","PB22":"CL","MCL1":"CL","RAD1":"CL","PB02":"CL","PB01":"CL","JRGN":"CL","AREG":"PE","LCUZ":"PE","LAYA":"PE","ATIC":"PE","CHRA":"PE","SJUA":"PE","NZCA":"PE","PTCL":"PE","LHYO":"PE","CAL3":"PE","ANCN":"PE","PIUR":"PE","RIOP":"EC","CSEC":"EC","CHZO":"EC","CNEC":"EC","VCES":"EC","BIEC":"EC","VZCY":"EC","MZEC":"EC","TEN1":"EC","CONE":"EC","ESMR":"EC","QITO":"EC","SHEC":"EC","ASEC":"EC","QUI3":"EC","LIEC":"EC","IBEC":"EC","COEC":"EC","OLAY":"CO","PTIA":"CO","EBRD":"CO","CMBI":"CO","VMER":"CO","AECT":"CO","SIPI":"CO","ISTM":"CO","BADO":"CO","INTO":"CO","QBDO":"CO","INOB":"CO","ZARZ":"CO","CCS1":"VE","BONK":"BQ","TTSF":"TT","TTUW":"TT","CN46":"GD","CN57":"TT","MTRN":"VE","CN41":"VE","GGPA":"EC","SALF":"EC","QUEM":"EC","SNLR":"EC","AEBS":"CO","AEDO":"CO","AEMO":"CO","AEMT":"CO","AESI":"CO","AGTU":"CO","AJCM":"CO","ALPA":"CO","ASVI":"CO","BAAP":"CO","BASO":"CO","BOBG":"CO","BOGT":"CO","CAPI":"CO","CN35":"CO","CN37":"CO","CORO":"CO","CPAS":"CO","CUC1":"CO","DICA":"CO","HITU":"CO","INSJ":"CO","INVE":"CO","LEDE":"CO","OAMU":"CO","OCEL":"CO","OVSC":"CO","PASI":"CO","PLTR":"CO","POVA":"CO","PUBE":"CO","PUIN":"CO","QUIL":"CO","SAN0":"CO","SEL1":"CO","SGCC":"CO","SGCG":"CO","SUAM":"CO","SVNA":"CO","TCOA":"CO","TEAT":"CO","TITI":"CO","TONE":"CO","TUCO":"CO","UDAP":"CO","UGCT":"CO","UNCA":"CO","URR0":"CO","UWAS":"CO","VBAM":"CO","VBAR":"CO","VBUV":"CO","VCRG":"CO","VCTG":"CO","VDPR":"CO","VEDE":"CO","VMAG":"CO","VMES":"CO","VNEI":"CO","VORA":"CO","VORI":"CO","VPIJ":"CO","VPOL":"CO","VPOM":"CO","VSJG":"CO","VSJP":"CO","VSOA":"CO","VTAM":"CO","VTUL":"CO","VYPL":"CO","TQPL":"PE","LYAR":"PE","GLRV":"PE","TRTA":"PE"};
const countryNames={EC:'Ecuador',CO:'Colombia',PE:'Perú',CL:'Chile',VE:'Venezuela',TT:'Trinidad y Tobago',GD:'Granada',BQ:'Bonaire (Caribe Neerlandés)'};
const country=s=>stationCountries[s.code]||'—';
const stationLabel=s=>country(s)+' · '+s.code;
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function assess(data,zone,now=Date.now()){
 const empty={state:'datos insuficientes',coherent:false,candidate:false,used:0,latency:null,detail:'sin series GNSS verificables',stations:[]};
 if(data?.schema!==1||!Array.isArray(data.stations))return empty;
 const selected=zone?(data.zones?.[zone]?.used||[]):data.stations.map(s=>s.code);
 const stations=data.stations.filter(s=>selected.includes(s.code)&&s.usable&&Number.isFinite(Date.parse(s.observed_at))&&now-Date.parse(s.observed_at)>=0&&now-Date.parse(s.observed_at)<=7*DAY);
 const recentSnapshot=Number.isFinite(Date.parse(data.generated_at))&&now-Date.parse(data.generated_at)>=0&&now-Date.parse(data.generated_at)<=2*DAY;
 const enough=stations.length>=3&&recentSnapshot;
 const candidates=(data.zones?.[zone]?.coherent_candidates||[]).filter(c=>stations.some(s=>s.code===c));
 const candidate=enough&&candidates.length>=3;
 const ages=stations.map(s=>(now-Date.parse(s.observed_at))/DAY).sort((a,b)=>a-b);
 return {state:!recentSnapshot?'snapshot GNSS atrasado':!enough?'cobertura GNSS insuficiente':candidate?'señal GNSS coincidente · revisión pendiente':'series disponibles · sin coincidencia bajo el tamiz',coherent:false,candidate,used:stations.length,latency:ages.length?ages[Math.floor(ages.length/2)]:null,detail:!recentSnapshot?'consulta automatizada no reciente':candidate?'≥3 estaciones; atribución tectónica y causas no tectónicas pendientes':'tamiz exploratorio; no equivale a ausencia de deformación',stations};
}
root.MivigeGeodesy={assess};
if(typeof module!=='undefined')module.exports=root.MivigeGeodesy;
if(typeof document==='undefined')return;
let data=null,layer=null;
function plot(s){
 const host=document.getElementById('gnssPlot');if(!host||!s)return;
 host.setAttribute('title',(countryNames[country(s)]||'País sin verificar')+' · '+s.code+' · '+s.lat.toFixed(4)+', '+s.lon.toFixed(4));
 const p=s.series||[];if(p.length<2){host.textContent='Sin serie suficiente para graficar';return;}
 const start=Date.parse(p[0].date),span=Math.max(DAY,Date.parse(p.at(-1).date)-start);
 const values=p.flatMap(x=>x.mm),lo=Math.min(...values),hi=Math.max(...values),range=Math.max(1,hi-lo);
 const colors=['#65d6ff','#81e8ae','#e7aeff'];
 host.innerHTML='<div class="small" style="margin-bottom:6px">'+esc(stationLabel(s))+' · '+esc(countryNames[country(s)]||'País sin verificar')+' · última observación: '+esc(s.observed_at?.slice(0,10)||'sin fecha')+'</div><svg viewBox="0 0 480 255" role="img" aria-label="Serie GNSS relativa en milímetros"><path d="M40 10V140H470" fill="none" stroke="#7594ad"/>'+[0,1,2].map(k=>'<polyline fill="none" stroke="'+colors[k]+'" stroke-width="1.7" points="'+p.map(r=>[40+430*(Date.parse(r.date)-start)/span,130-110*(r.mm[k]-lo)/range].join(',')).join(' ')+'"/>').join('')+'<text x="2" y="20" fill="#cadbea" font-size="10">'+hi.toFixed(1)+'</text><text x="2" y="133" fill="#cadbea" font-size="10">'+lo.toFixed(1)+'</text><text x="40" y="157" fill="#cadbea" font-size="10">'+esc(p[0].date)+'</text><text x="397" y="157" fill="#cadbea" font-size="10">'+esc(p.at(-1).date)+'</text><text x="55" y="14" fill="#65d6ff" font-size="10">E: este</text><text x="135" y="14" fill="#81e8ae" font-size="10">N: norte</text><text x="220" y="14" fill="#e7aeff" font-size="10">U: vertical</text><text x="315" y="14" fill="#cadbea" font-size="9">mm relativos · con tendencia</text><text x="40" y="180" fill="#65d6ff" font-size="12">Este: aumenta → este · disminuye → oeste</text><text x="40" y="199" fill="#81e8ae" font-size="12">Norte: aumenta → norte · disminuye → sur</text><text x="40" y="218" fill="#e7aeff" font-size="12">Vertical: aumenta → sube · disminuye → baja</text><text x="40" y="240" fill="#cadbea" font-size="10">Movimiento de la estación; no indica migración de sismos.</text></svg>';
}
function render(d){
 data=d;root.MivigeGeodesy.data=d;root.dispatchEvent(new Event('mivige:geodesy'));const host=document.getElementById('gnssRegional');if(!host)return;
 if(d?.schema!==1||!Array.isArray(d.stations)){host.textContent='No se pudo leer el snapshot GNSS. La vigilancia sísmica continúa por separado.';return;}
 const g=assess(d),now=Date.now();
 host.innerHTML='<div class="kpis"><div class="kpi"><div class="name">Series consultadas</div><div class="val">'+d.stations.length+'</div></div><div class="kpi"><div class="name">Estaciones con tamiz vigente</div><div class="val">'+g.used+'</div></div></div><p class="small">Procesado: '+esc(d.generated_at)+'<br>Fuente: NGL / IGS20. Consulta programada cada 6 h; la frecuencia del proveedor puede ser menor.<br>'+esc(g.state.includes('atrasado')?g.state:'Disponibilidad regional; ver el resultado en cada zona')+'. Cada zona se evalúa por separado.</p><details><summary>Ver estaciones, fechas y motivos de exclusión</summary><div style="overflow:auto;max-height:320px"><table class="table"><thead><tr><th>Estación</th><th>Último dato</th><th>Estado</th></tr></thead><tbody>'+d.stations.map(s=>'<tr><td>'+esc(stationLabel(s))+'</td><td>'+esc(s.observed_at?.slice(0,10)||'—')+'<br>'+ (s.observed_at?Math.max(0,(now-Date.parse(s.observed_at))/DAY).toFixed(1)+' d':'')+'</td><td>'+esc((s.usable&&now-Date.parse(s.observed_at)<=7*DAY)?(s.candidate?'cambio a revisar':'tamiz disponible'):(s.usable?'observaciones atrasadas (>7 días)':s.reason||'sin datos'))+'</td></tr>').join('')+'</tbody></table></div></details><p><label for="gnssStation">Serie de estación </label><select id="gnssStation">'+d.stations.filter(s=>s.series?.length).map(s=>'<option value="'+esc(s.code)+'">'+esc(stationLabel(s))+'</option>').join('')+'</select></p><div id="gnssPlot"></div>';
 const select=document.getElementById('gnssStation');if(select){select.onchange=()=>plot(d.stations.find(s=>s.code===select.value));const initial=d.stations.find(s=>s.usable&&s.series?.length)||d.stations.find(s=>s.series?.length);if(initial)select.value=initial.code;plot(initial);}
 if(typeof L!=='undefined'&&typeof map!=='undefined'){
  if(!layer){layer=L.layerGroup().addTo(map);L.control.layers({},{'GNSS · series procesadas NGL':layer},{collapsed:true}).addTo(map);}
  layer.clearLayers();d.stations.forEach(s=>{const age=(now-Date.parse(s.observed_at))/DAY,valid=s.usable&&age>=0&&age<=7,c=valid?'#65d6ff':'#8993a4';L.circleMarker([s.lat,s.lon],{radius:5,color:c,fillColor:c,fillOpacity:.85,weight:2}).bindPopup('<b>GNSS '+esc(stationLabel(s))+'</b><br>'+esc(s.observed_at?.slice(0,10)||'sin observaciones')+'<br>'+esc(s.reason)+'<br>Dato procesado; no predicción.<br><a target="_blank" rel="noopener" href="'+esc(s.url)+'">NGL: datos originales</a>').addTo(layer);});
 }
}
root.MivigeGeodesy.render=render;
})(typeof window!=='undefined'?window:globalThis);
