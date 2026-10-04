(function(){
'use strict';
const RECEIVERS=[
{id:'cl_c',strike:10,dip:18,rake:90},{id:'cl_n',strike:5,dip:20,rake:90},
{id:'pe_s',strike:320,dip:20,rake:90},{id:'pe_c',strike:330,dip:18,rake:90},{id:'pe_n',strike:340,dip:18,rake:90},
{id:'ec_s',strike:25,dip:18,rake:90},{id:'ec_az',strike:25,dip:55,rake:90},{id:'ec_c',strike:25,dip:18,rake:90},{id:'ec_n',strike:30,dip:18,rake:90},
{id:'co_p',strike:35,dip:20,rake:90},{id:'co_ch',strike:20,dip:35,rake:90},{id:'ven',strike:80,dip:70,rake:0}
];
const state={};
function preferred(products,type){const a=products?.[type];if(!Array.isArray(a)||!a.length)return null;return a.filter(x=>x.status!=='DELETE').sort((a,b)=>(b.preferredWeight||0)-(a.preferredWeight||0)||(b.updateTime||0)-(a.updateTime||0))[0]||null;}
function num(p,...keys){for(const k of keys){const v=Number(p?.[k]);if(Number.isFinite(v))return v;}return null;}
function mechanism(prod){if(!prod)return null;const p=prod.properties||{};return {strike:num(p,'nodal-plane-1-strike','np1-strike'),dip:num(p,'nodal-plane-1-dip','np1-dip'),rake:num(p,'nodal-plane-1-rake','np1-rake'),source:prod.source||'USGS'};}
function receiver(id){return RECEIVERS.find(x=>x.id===id);}
function angular(a,b){let d=Math.abs(a-b)%360;return d>180?360-d:d;}
function compatibility(src,rec){
 if(!src||!rec||![src.strike,src.dip,src.rake].every(Number.isFinite))return null;
 // Geometry screen only. It is NOT a ΔCFS calculation and therefore cannot be scored as Coulomb.
 const strike=angular(src.strike,rec.strike),dip=Math.abs(src.dip-rec.dip),rake=angular(src.rake,rec.rake);
 return {strike,dip,rake,label:'geometría disponible · cálculo ΔCFS pendiente'};
}
async function detail(e){
 const url=e?.detail||e?.urlDetail||e?.properties?.detail;
 if(!url)return null;
 try{const q=await fetch(url,{cache:'no-store'});return q.ok?await q.json():null;}catch(_){return null;}
}
async function run(){
 const model=window.mivigeV2;if(!model||!Array.isArray(model.states)||!Array.isArray(window.allEvents||allEvents))return;
 const evs=(window.allEvents||allEvents).filter(e=>e.source==='USGS'&&Number(e.mag)>=5.5).sort((a,b)=>b.time-a.time).slice(0,12);
 for(const st of model.states){
  const rec=receiver(st.s.id);if(!rec)continue;
  let best={evaluable:false,score:null,label:'Coulomb N/A · sin mecanismo/ruptura suficiente',provenance:'USGS ComCat'};
  for(const e of evs){
   const d=await detail(e);if(!d)continue;
   const products=d.properties?.products||{};
   const ff=preferred(products,'finite-fault'),mt=preferred(products,'moment-tensor'),fm=preferred(products,'focal-mechanism');
   const mech=mechanism(fm)||mechanism(mt);
   if(!mech)continue;
   const geom=compatibility(mech,rec);
   // A focal mechanism plus an assumed receiver orientation is still insufficient for a defensible
   // static stress value without a source slip/rupture model. Keep N/A unless a future solver consumes finite-fault slip.
   best={evaluable:false,score:null,label:(ff?'finite-fault + mecanismo disponibles':'mecanismo disponible')+' · ΔCFS aún N/A hasta resolver deslizamiento→receptor',sourceEvent:e,mechanism:mech,receiver:rec,geometry:geom,finiteFault:Boolean(ff),provenance:'USGS ComCat detail products'};
   if(ff)break;
  }
  state[st.s.id]=best;
 }
 window.mivigeCoulomb=state;
 window.dispatchEvent(new Event('mivige:coulomb'));
}
window.MivigeCoulomb={run,state,receivers:RECEIVERS};
window.addEventListener('mivige:model',()=>run().catch(()=>{}));
setTimeout(()=>run().catch(()=>{}),5000);
})();