const M=D.meta, MS=D.months;
const fi=n=>Number(n||0).toLocaleString('es-EC');
const money=n=>'USD '+Number(n||0).toLocaleString('es-EC',{minimumFractionDigits:2,maximumFractionDigits:2});
const pct=n=>Number(n||0).toLocaleString('es-EC',{maximumFractionDigits:1})+'%';
const S=a=>a.reduce((x,y)=>x+(+y||0),0);
const E=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

const income={
 total:1097539.32,
 main:[
  ['Paquete',509448.83,46,'blue'],
  ['Bajo demanda',367717.78,34,'orange'],
  ['Ingresos Complementarios',141780.78,13,'cyan'],
  ['Proyectos',52139.93,5,'purple'],
  ['Por facturar',26452.00,2,'green']
 ],
 demand:[['Recursos bibliográficos',315693.88],['TMO',52023.90]],
 other:[['Flexibilización',131878.48],['Capacitación interna',7181.30],['Planillaje interno',2721.00]],
 projects:[['ENTITLE',24555.93],['TEST BEST',17000.00],['ETALENT',10584.00]]
};

const services=[
 {name:'TMO · Formación',accent:'#0e67b2',promise:'Cursos, certificaciones, tracks y academias para fortalecer capacidades.',metrics:[['Inscripciones',7835],['Cursos impartidos',150],['TMO Track',4284],['Cisco',634]],opp:'Escalar cursos especializados, certificaciones y venta institucional.'},
 {name:'MOOCs',accent:'#09a8b8',promise:'Oferta de aprendizaje abierto y autogestionado.',metrics:[['Participantes activos','+4.000'],['Cursos disponibles','+75']],opp:'Ampliar catálogo y reutilizar contenidos producidos por CEDIA.'},
 {name:'ROA',accent:'#0e8da0',promise:'Objetos de aprendizaje reutilizables para docencia.',metrics:[['Objetos','+200'],['Categorías',11]],opp:'Nueva plataforma y lanzamiento 2027 para colegios e institutos.'},
 {name:'Diagnóstico de Competencias',accent:'#6f4fb3',promise:'Medición institucional de competencias digitales docentes.',metrics:[['Ejecutados',3],['En ejecución',2],['Interesadas',3]],opp:'Convertir diagnóstico en puerta de entrada a rutas formativas TMO.'},
 {name:'Repositorio del Conocimiento',accent:'#2f9d50',promise:'Difusión de conocimiento generado por proyectos y fondos.',metrics:[['Videos publicados',354],['Estudios de vigilancia','25+']],opp:'Fortalecer acceso federado y consumo de conocimiento especializado.'},
 {name:'RRAAE',accent:'#2f77c5',promise:'Red nacional de repositorios y acceso abierto.',metrics:[['Publicaciones',682777],['Fuentes',136],['Instituciones',67],['Visitas 2026',130746]],opp:'RRAAE 2.0, DataCite Ecuador, IA en repositorios y servicios interbibliotecarios.'},
 {name:'AIRA Academics / Avante',accent:'#e98a2e',promise:'Apoyo a investigación y adopción de servicios académicos con IA.',metrics:[['Instituciones activas',8],['En instalación',12],['Univ. adjudicadas',15],['Institutos adjudicados',5]],opp:'Meta 2027: adopción AIRA Academics en 32 instituciones.'}
];

function kpi(label,value,sub=''){
 return '<div class="kpi"><div class="label">'+E(label)+'</div><div class="value">'+E(value)+'</div><div class="sub">'+E(sub)+'</div></div>';
}
function barRows(rows,cls=''){
 const mx=Math.max(...rows.map(r=>r[1]),1);
 return rows.map(r=>'<div class="metric-row"><div class="metric-name">'+E(r[0])+'</div><div class="bar '+cls+'"><span style="width:'+(r[1]/mx*100)+'%"></span></div><div class="amount">'+(typeof r[1]==='number'?fi(r[1]):E(r[1]))+'</div></div>').join('');
}
function moneyRows(rows,cls=''){
 const mx=Math.max(...rows.map(r=>r[1]),1);
 return rows.map(r=>'<div class="metric-row"><div class="metric-name">'+E(r[0])+'</div><div class="bar '+cls+'"><span style="width:'+(r[1]/mx*100)+'%"></span></div><div class="amount">'+money(r[1])+'</div></div>').join('');
}
function aggregate(rows,nameIndex,valueIndex,filterFn){
 const map={};
 rows.filter(filterFn||(()=>true)).forEach(r=>{ const k=r[nameIndex]; map[k]=(map[k]||0)+(+r[valueIndex]||0); });
 return Object.entries(map).sort((a,b)=>b[1]-a[1]);
}
function ranking(rows,limit=10,cls=''){
 const z=rows.slice(0,limit), mx=Math.max(...z.map(r=>r[1]),1);
 return z.map((r,i)=>'<div class="rank-row"><div class="rank-name"><b>'+(i+1)+'.</b> '+E(r[0])+'</div><div class="bar '+cls+'"><span style="width:'+(r[1]/mx*100)+'%"></span></div><div class="rank-value">'+fi(r[1])+'</div></div>').join('');
}
function monthly(){
 const max=Math.max(...D.monthly.map(r=>r[4]),1);
 return D.monthly.map(r=>{
  const total=r[4]||1;
  return '<div class="chart-month"><div class="chart-label">'+E(r[0])+'</div><div class="stackbar">'+
   '<span style="width:'+(r[1]/total*100)+'%;background:#0e67b2"></span>'+
   '<span style="width:'+(r[2]/total*100)+'%;background:#09a89a"></span>'+
   '<span style="width:'+(r[3]/total*100)+'%;background:#7658b4"></span></div>'+
   '<div class="chart-vals">'+fi(r[1])+' · '+fi(r[2])+' · '+fi(r[3])+' = <b>'+fi(r[4])+'</b></div></div>';
 }).join('')+
 '<div class="legend"><span><i style="background:#0e67b2"></i>TMO directa</span><span><i style="background:#09a89a"></i>TMO Track</span><span><i style="background:#7658b4"></i>Cisco</span></div>';
}

document.getElementById('hero-kpis').innerHTML=
 kpi('Ingresos Área 2026',money(income.total),'Composición total reportada')+
 kpi('Inscripciones',fi(M.total_all),'Ecosistema de formación')+
 kpi('Cursos impartidos','150','TMO, TMO Track y academias')+
 kpi('TMO Track',fi(M.total_track),'11 cursos para la venta')+
 kpi('Oferta TMO directa',fi(M.tmo_offers),'Cursos / módulos registrados');

document.getElementById('tmo-summary').innerHTML=
 '<div class="service-metrics">'+
  '<div class="service-metric"><strong>'+fi(M.total_tmo)+'</strong><span>TMO directa</span></div>'+
  '<div class="service-metric"><strong>'+fi(M.total_track)+'</strong><span>TMO Track</span></div>'+
  '<div class="service-metric"><strong>'+fi(M.total_cisco)+'</strong><span>Cisco</span></div>'+
  '<div class="service-metric"><strong>150</strong><span>Cursos impartidos</span></div>'+
 '</div><div class="opportunity"><b>Lectura:</b> la TMO combina oferta abierta, venta institucional, tracks y alianzas tecnológicas; es el servicio con mayor volumen visible de usuarios.</div>';

document.getElementById('revenue-summary').innerHTML=
 '<div class="metric-row"><div class="metric-name">Paquete</div><div class="bar green"><span style="width:100%"></span></div><div class="amount">46%</div></div>'+
 '<div class="metric-row"><div class="metric-name">Bajo demanda</div><div class="bar orange"><span style="width:74%"></span></div><div class="amount">34%</div></div>'+
 '<div class="metric-row"><div class="metric-name">Ingresos Complementarios</div><div class="bar"><span style="width:28%"></span></div><div class="amount">13%</div></div>'+
 '<div class="metric-row"><div class="metric-name">Proyectos</div><div class="bar purple"><span style="width:11%"></span></div><div class="amount">5%</div></div>'+
 '<div class="opportunity"><b>Prioridad:</b> Paquete + Bajo demanda concentran el 80% de los ingresos del Área.</div>';

document.getElementById('service-strip').innerHTML=services.slice(1).map(s=>{
 const best=s.metrics[0];
 return '<div class="mini-service" style="border-top:4px solid '+s.accent+'"><b>'+E(s.name)+'</b><strong>'+E(best[1])+'</strong><span>'+E(best[0])+'</span></div>';
}).join('');

document.getElementById('tmo-kpis').innerHTML=
 kpi('TMO directa',fi(M.total_tmo),'Inscripciones')+
 kpi('TMO Track',fi(M.total_track),'Inscripciones')+
 kpi('Cisco',fi(M.total_cisco),'Inscripciones')+
 kpi('Cursos para la venta','11','TMO Track')+
 kpi('Cursos impartidos','150','Gestión 2026');

document.getElementById('monthly-chart').innerHTML=monthly();

const direct=aggregate(D.offers,1,2).slice(0,8).map(r=>[r[0],r[1]]);
const track=aggregate(D.tc,2,3,r=>r[1]==='TMO TRACK').slice(0,8);
const cisco=aggregate(D.tc,2,3,r=>r[1]==='CISCO').slice(0,5);
const allProducts=[
 ...direct.map(r=>['TMO · '+r[0],r[1]]),
 ...track.map(r=>['Track · '+r[0],r[1]]),
 ...cisco.map(r=>['Cisco · '+r[0].replace(/^\d+\.\s*CISCO[- ]*/i,''),r[1]])
].sort((a,b)=>b[1]-a[1]).slice(0,10);
document.getElementById('top-products').innerHTML=ranking(allProducts,10,'green');

document.getElementById('services-grid').innerHTML=services.map(s=>
 '<div class="service-card" style="--blue:'+s.accent+';border-top:4px solid '+s.accent+'">'+
 '<h3>'+E(s.name)+'</h3><div class="promise">'+E(s.promise)+'</div>'+
 '<div class="service-metrics">'+s.metrics.map(m=>'<div class="service-metric"><strong style="color:'+s.accent+'">'+E(typeof m[1]==='number'?fi(m[1]):m[1])+'</strong><span>'+E(m[0])+'</span></div>').join('')+'</div>'+
 '<div class="opportunity"><b>Oportunidad:</b> '+E(s.opp)+'</div></div>'
).join('');

const maxIncome=Math.max(...income.main.map(r=>r[1]));
document.getElementById('income-main').innerHTML=income.main.map(r=>
 '<div class="metric-row"><div><b>'+E(r[0])+'</b><div class="mini-note">'+r[2]+'% del total</div></div><div class="bar '+r[3]+'"><span style="width:'+(r[1]/maxIncome*100)+'%"></span></div><div class="amount">'+money(r[1])+'</div></div>'
).join('');
document.getElementById('income-demand').innerHTML=moneyRows(income.demand,'orange');
document.getElementById('income-other').innerHTML=moneyRows(income.other,'');
document.getElementById('income-projects').innerHTML=moneyRows(income.projects,'purple');

document.getElementById('direct-ranking').innerHTML=ranking(direct,12,'');
document.getElementById('track-ranking').innerHTML=
 '<div class="tag">TMO TRACK</div>'+ranking(track,8,'green')+
 '<div class="tag" style="margin-top:15px">CISCO</div>'+ranking(cisco,7,'purple');

document.querySelectorAll('.tab').forEach(btn=>btn.onclick=()=>{
 document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));
 document.querySelectorAll('.view').forEach(x=>x.classList.remove('active'));
 btn.classList.add('active');
 document.getElementById(btn.dataset.view).classList.add('active');
 window.scrollTo({top:0,behavior:'smooth'});
});
