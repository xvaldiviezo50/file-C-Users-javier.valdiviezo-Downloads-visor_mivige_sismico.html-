(function(){
  const choco=[
    {name:'Sipí',region:'Chocó',country:'Colombia',lat:4.654,lon:-76.644},
    {name:'Istmina',region:'Chocó',country:'Colombia',lat:5.160,lon:-76.683},
    {name:'Condoto',region:'Chocó',country:'Colombia',lat:5.093,lon:-76.649},
    {name:'Nóvita',region:'Chocó',country:'Colombia',lat:4.956,lon:-76.607},
    {name:'Tadó',region:'Chocó',country:'Colombia',lat:5.265,lon:-76.558},
    {name:'San José del Palmar',region:'Chocó',country:'Colombia',lat:4.897,lon:-76.236},
    {name:'Quibdó',region:'Chocó',country:'Colombia',lat:5.691,lon:-76.658}
  ];
  function nearest(lat,lon){let b=null;for(const p of choco){const d=distKm(lat,lon,p.lat,p.lon);if(!b||d<b.d)b={...p,d};}return b;}
  function bearing(a,b,c,d){const r=Math.PI/180,A=a*r,C=c*r,D=(d-b)*r,y=Math.sin(D)*Math.cos(C),x=Math.cos(A)*Math.sin(C)-Math.sin(A)*Math.cos(C)*Math.cos(D);return(Math.atan2(y,x)*180/Math.PI+360)%360;}
  function dir8(x){return ['N','NE','E','SE','S','SO','O','NO'][Math.round(x/45)%8];}
  function chocoLabel(c){
    if(!(c.lat>=3.7&&c.lat<=6.2&&c.lon>=-77.5&&c.lon<=-75.8))return null;
    const ev=(c.events||[]).find(e=>e.place&&/Sipí|Istmina|Chocó|San José del Palmar|Condoto|Nóvita/i.test(String(e.place)));
    if(ev)return String(ev.place);
    const p=nearest(c.lat,c.lon);if(!p)return 'Chocó, Colombia';
    if(p.d<=20)return `${p.name}, ${p.region} (${p.country})`;
    return `≈${Math.round(p.d)} km ${dir8(bearing(p.lat,p.lon,c.lat,c.lon))} de ${p.name}, ${p.region} (${p.country})`;
  }
  function level(c){return c.score>=75?'Vigilancia reforzada':c.score>=55?'Alta prioridad':c.score>=38?'Observación prioritaria':'Seguimiento';}
  function repaint(){
    const cs=window.mivigeProactiveClusters;if(!Array.isArray(cs)||!cs.length)return;
    const host=document.getElementById('focusList');if(!host)return;
    const items=[...host.querySelectorAll('.listitem')];
    cs.slice(0,items.length).forEach((c,i)=>{
      const nm=chocoLabel(c);if(!nm)return;
      const zn=items[i].querySelector('.zname');if(zn)zn.innerHTML=`<b>Prioridad #${i+1}</b> · ${nm}`;
      if(i===0){const mf=document.getElementById('mainFocus');if(mf)mf.textContent=`${nm} · ${level(c)}`;}
    });
  }
  setInterval(repaint,1800);setTimeout(repaint,1800);
})();