(function(){
'use strict';
const names=['Tonga–Kermadec','Vanuatu–Santa Cruz','Islas Salomón','Nueva Bretaña–Papúa','Indonesia–Banda','Sumatra–Andamán','Filipinas–Marianas','Japón–Kuriles','Kamchatka–Aleutianas','Nueva Zelanda–Hikurangi','México–Guatemala','Costa Rica–Panamá','Colombia–Ecuador','Ecuador–Perú','Perú–Chile','Chile sur–Patagonia','Caribe sur–Venezuela','Dorsal de Chile','Fosa Perú–Chile'];
function refresh(){
 const panel=document.getElementById('antiBottomPanel');
 if(!panel)return;
 let section=document.getElementById('mivigeAllSources');
 if(!section){section=document.createElement('section');section.id='mivigeAllSources';panel.appendChild(section)}
 const data=window.mivigeResearchRegions;
 const regions=Array.isArray(data?.regions)?data.regions:[];
 const ordered=names.map(name=>regions.find(r=>r.name===name)||{name,n:null});
 section.innerHTML='<h3>Fuentes tectónicas y transpacíficas en investigación</h3><p>Listado de regiones fuente, incluidas Tonga–Kermadec. No son antípodas geométricas de Sudamérica ni se presupone causalidad.</p>'+ordered.map(r=>'<p><b>'+r.name+'</b> · M≥5/72h: '+(r.n===null?'sin evaluación':r.n)+'</p>').join('');
}
setInterval(refresh,4000);setTimeout(refresh,6500);
})();