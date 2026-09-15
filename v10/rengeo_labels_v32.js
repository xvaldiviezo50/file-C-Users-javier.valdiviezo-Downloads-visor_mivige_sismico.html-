setTimeout(function(){
var a=document.getElementById('rengeoFresh');
var b=document.getElementById('rengeoUsed');
var c=document.getElementById('rengeoNonAuto');
var d=document.getElementById('rengeoLatency');
var e=document.getElementById('rengeoStatus');
if(a&&a.textContent.trim()==='—')a.textContent='Pendiente lectura E/N/U';
if(b&&b.textContent.trim()==='—')b.textContent='0 confirmadas';
if(c&&c.textContent.trim()==='—')c.textContent='En evaluación';
if(d&&d.textContent.trim()==='—')d.textContent='No verificada';
if(e&&e.textContent.indexOf('esperando')>=0)e.textContent='RENGEO visible; conector de mediciones en evaluación automática';
},2000);