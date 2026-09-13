function computeZonePackage(zone, events, hours){
 const inside=events.filter(e=>distKm(zone.lat,zone.lon,e.lat,e.lon)<=zone.radius);
 const activity=inside.reduce((s,e)=>s+eventContribution(e,hours),0);
 const cluster=Math.max(0,inside.filter(e=>e.mag>=3.5).length-1)*0.22;
 const signalRaw=activity+cluster;
 const raw=zone.base*2.0+signalRaw;
 const recent12=inside.filter(e=>Date.now()-e.time<=12*3600000).length;
 const prev12=inside.filter(e=>Date.now()-e.time>12*3600000 && Date.now()-e.time<=24*3600000).length;
 const trendScore = recent12>prev12*1.3 && recent12>=2 ? '↑ aumentando' : recent12<prev12*0.8 ? '↓ decayendo' : '→ estable';
 const anchor = inside.find(e=>e.mag>=4.5);
 let etas='Sin secuencia ancla';
 if(anchor){
   const sinceAnchorHours=Math.max(1,(Date.now()-anchor.time)/3600000);
   const expected=Math.max(1, 4/Math.sqrt(sinceAnchorHours));
   const obs=inside.filter(e=>e.time>=anchor.time).length;
   const ratio=obs/expected;
   etas = ratio>1.6 ? 'Excede proxy Omori' : ratio<0.8 ? 'Bajo Omori' : 'Compatible con Omori';
 }
 const observedScore=Math.min(100, signalRaw*15);
 let op=observedScore;
 if(etas==='Compatible con Omori') op-=10;
 if(etas==='Bajo Omori') op-=14;
 if(trendScore==='↓ decayendo') op-=8;
 if(trendScore==='↑ aumentando') op+=6;
 op=Math.max(0,Math.min(100,op));
 return {...zone, inside, raw, signalRaw, observedScore, opScore:op, activity, cluster, trendScore, etas};
}
function computeInternalPercentages(pkgs){ const sum=pkgs.reduce((s,z)=>s+z.signalRaw,0); pkgs.forEach(z=>z.pct=sum>0?100*z.signalRaw/sum:0); return pkgs.sort((a,b)=>b.opScore-a.opScore); }
function computeExternal(pkgs){ return pkgs.sort((a,b)=>b.opScore-a.opScore); }
function globalMajorEvents(events,hours){
 const cutoff=Date.now()-hours*3600000;
 return events.filter(e=>e.source==='USGS' && e.time>=cutoff && e.mag>=6.0);
}
function computeIAEX(events, hours){
 const majors = globalMajorEvents(events, hours);
 if(!majors.length) return {status:'Sin señal fuerte', window:'Sin ventana activa', cases:[]};
 const cases=[];
 for(const e of majors.slice(0,6)){
   const anti=antipode(e.lat,e.lon);
   let best=null;
   for(const z of allZones){
     const d=distKm(anti.lat,anti.lon,z.lat,z.lon);
     if(!best || d<best.distance) best={zone:z, distance:d};
   }
   const ageH=(Date.now()-e.time)/3600000;
   const geom = best.distance<=300?1:best.distance<=750?0.7:best.distance<=1500?0.35:0;
   const mag = e.mag>=7?1:e.mag>=6.5?0.65:0.35;
   const time = ageH<=6?1:ageH<=72?0.55:0.15;
   const receiverEvents = allEvents.filter(x=>distKm(best.zone.lat,best.zone.lon,x.lat,x.lon)<=best.zone.radius && x.time>=e.time);
   const prevReceiver = allEvents.filter(x=>distKm(best.zone.lat,best.zone.lon,x.lat,x.lon)<=best.zone.radius && x.time<e.time && x.time>=e.time-72*3600000);
   const excess = receiverEvents.length > prevReceiver.length*1.2 ? 0.8 : receiverEvents.length ? 0.45 : 0.1;
   const activePenalty = prevReceiver.length>=3 ? 0.20 : 0;
   const compat=0.0;
   let score = 25*geom + 20*mag + 20*time + 20*excess + 15*compat - 100*activePenalty;
   score = Math.max(0,Math.min(100,score));
   cases.push({source:e, anti, zone:best.zone, distance:best.distance, score, ageH, receiverCount:receiverEvents.length});
 }
 cases.sort((a,b)=>b.score-a.score);
 const lead=cases[0];
 let status='Sin señal fuerte';
 if(lead && lead.score>=55) status='Señal experimental alta'; else if(lead && lead.score>=35) status='Señal experimental moderada'; else if(lead && lead.score>0) status='Señal exploratoria';
 let window='Sin ventana activa';
 if(lead){ window = lead.ageH<=6 ? 'Ventana IAEX 0–6 h' : lead.ageH<=72 ? 'Ventana IAEX 6–72 h' : 'Ventana expirada'; }
 return {status, window, cases};
}
function activeReason(z, iaex){
 const recent45=z.inside.filter(e=>e.mag>=4.5).sort((a,b)=>b.time-a.time)[0];
 const recent35=z.inside.filter(e=>e.mag>=3.5).length;
 const ia=iaex?.cases?.find(c=>c.zone.id===z.id || c.zone.name===z.name);
 if(ia && ia.score>=35) return `IAEX experimental ${ia.score.toFixed(0)}/100 + actividad local`;
 if(z.etas==='Excede proxy Omori') return 'actividad por encima del proxy Omori/ETAS';
 if(recent45) return `evento reciente M${recent45.mag.toFixed(1)} a ${recent45.depth.toFixed(0)} km`;
 if(z.trendScore==='↑ aumentando' && recent35>=2) return 'tasa reciente en aumento + clustering';
 if(recent35>=3) return `${recent35} eventos M≥3.5 en la ventana`;
 return 'score operativo elevado por actividad reciente';
}
function isActiveZone(z, iaex){
 const recent35=z.inside.filter(e=>e.mag>=3.5).length;
 const recent30_24=z.inside.filter(e=>e.mag>=3.0 && Date.now()-e.time<=24*3600000).length;
 const has45=z.inside.some(e=>e.mag>=4.5);
 const ia=iaex?.cases?.find(c=>c.zone.id===z.id || c.zone.name===z.name);
 const experimentalReinforcement=!!(ia && ia.score>=35 && recent30_24>=1);
 return z.opScore>=50 || (z.opScore>=28 && (has45 || recent35>=2 || z.trendScore==='↑ aumentando' || z.etas==='Excede proxy Omori' || experimentalReinforcement));
}