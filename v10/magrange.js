(function(){
  function round1(x){return Math.round(x*10)/10;}
  function band(c){
    const m=Number(c?.maxMag||0);
    const n45=Number(c?.count45||0);
    const accel=!!c?.accelerating;
    let low=Math.max(3.5,m-0.4);
    let up=m+0.4+(accel?0.3:0)+(n45>=2?0.3:0)+(Number(c?.score||0)>=75?0.2:0);
    up=Math.min(6.5,up);
    if(up<low+0.4)up=low+0.4;
    return {low:round1(low),up:round1(up)};
  }
  function note(c){
    const b=band(c);
    return `Banda experimental 24–72 h: M${b.low.toFixed(1)}–${b.up.toFixed(1)}`;
  }
  function annotate(){
    const clusters=window.mivigeProactiveClusters;
    const host=document.getElementById('focusList');
    if(!host||!Array.isArray(clusters)||!clusters.length)return;
    const items=host.querySelectorAll('.listitem');
    items.forEach((el,i)=>{
      const c=clusters[i]; if(!c)return;
      const z=el.querySelector('.zdesc'); if(!z)return;
      if(z.querySelector('.mivige-magband'))return;
      const div=document.createElement('div');div.className='mivige-magband';
      div.innerHTML=`<b style="color:#d8e8f7">${note(c)}</b><br><span style="color:#7894ac">Rango operativo no calibrado: deriva del Mmáx reciente, aceleración, recurrencia M≥4.5 y score del foco; no es una probabilidad física ni predicción oficial.</span>`;
      z.insertBefore(div,z.firstChild);
    });
  }
  const obs=new MutationObserver(()=>setTimeout(annotate,0));
  obs.observe(document.body,{childList:true,subtree:true});
  setTimeout(annotate,1200);
  setInterval(annotate,30000);
  window.mivigeMagnitudeBand=band;
})();