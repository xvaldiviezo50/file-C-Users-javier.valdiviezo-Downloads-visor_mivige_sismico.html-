const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const elements=new Map(),listeners={};
function el(id=''){if(elements.has(id))return elements.get(id);const e={id,style:{},textContent:'',innerHTML:'',value:id==='window'?'72':id==='minmag'?'3':'all',addEventListener(){},appendChild(c){if(c.id)elements.set(c.id,c);},insertBefore(c){if(c.id)elements.set(c.id,c);},insertAdjacentElement(_,c){if(c.id)elements.set(c.id,c);},insertAdjacentHTML(){},click(){}};if(id)elements.set(id,e);return e;}
const layer=()=>new Proxy({},{get:(o,k)=>k==='then'?undefined:(...a)=>o.proxy||(o.proxy=layer())});
const ctx={console,Date,Math,Number,String,Array,Object,JSON,Intl,Map,Set,Promise,AbortController,URL,Blob,Event,setInterval(){},setTimeout(){},clearTimeout(){},document:{getElementById:el,querySelector:()=>el('aside'),querySelectorAll:()=>[],createElement:()=>el()},L:new Proxy({control:{layers:layer}},{get:(o,k)=>o[k]||layer}),localStorage:{getItem:()=>null,setItem(){}},fetch:async()=>({ok:true,json:async()=>({features:[]})}),addEventListener(n,f){(listeners[n]??=[]).push(f);},dispatchEvent(e){for(const f of listeners[e.type]||[])f();}};
ctx.window=ctx;vm.createContext(ctx);
for(const f of ['../v10/app1.js','quality.js','data-quality.js','model.js','prospective.js','validation.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,f),'utf8'),ctx,{filename:f});
(async()=>{
 await new Promise(resolve=>setImmediate(resolve));
 await ctx.refresh();
 assert.equal(ctx.mivigeV2.states.length,12);
 assert(ctx.mivigeV2.states.every(s=>s.icm.tier===-1));
 assert.match(el('semaforo').textContent,/GRIS/);
 assert.equal(ctx.mivigeProspectiveV2.results.length,0);
 // Synthetic dense local catalogue exercises render + real cross-file hooks.
 vm.runInContext(`fetchSource=async function(name){sourceStatus[name]={ok:true,truncated:false,fetchedAt:Date.now(),count:30};return name==='IG-EPN'?Array.from({length:30},(_,i)=>({source:name,id:'test'+i,time:Date.now()-(i+1)*18000000,mag:4.5,lat:-3.15,lon:-80.2,depth:null})):[];}`,ctx);
 await ctx.refresh();
 assert(ctx.mivigeV2.states.some(s=>s.dataReady));
 assert(ctx.mivigeProspectiveV2.results.length>0);
 assert(!el('ppeRows').innerHTML.includes('null/100'));
 assert(!el('semaforo').textContent.includes('HIPÓTESIS'));
 assert.match(el('validation21status').textContent,/pendientes/);
 // JSON error must not become a successful empty feed.
 ctx.fetch=async()=>({ok:true,json:async()=>({error:{message:'service failure'}})});
 vm.runInContext(fs.readFileSync(path.join(__dirname,'data-quality.js'),'utf8').replace('const originalNormalizeV21=normalize;','').replace('const oldTectonicClassV21=tectonicClass;',''),ctx);
 await vm.runInContext(`fetchSource('SGC','https://test.invalid')`,ctx);
 assert.equal(vm.runInContext(`sourceStatus.SGC.ok`,ctx),false);
 let calls=0;ctx.fetch=async()=>({ok:true,json:async()=>({features:Array.from({length:500},(_,i)=>({properties:{sis3_evento:'p'+calls+'-'+i,sis3_tiempo:Date.now()-(++calls>500?8:1)*86400000,sis3_magnitud_M:4,sis3_latitud:-2,sis3_longitud:-79,sis3_profundidad:null}}))})});
 await vm.runInContext(`fetchSource('IG-EPN','https://test.invalid')`,ctx);
 assert.equal(calls,1000);assert.equal(vm.runInContext(`sourceStatus['IG-EPN'].truncated`,ctx),false);
 console.log('Integración: sin datos → gris; catálogo válido → render y registro; error de fuente → fallo explícito: OK');
})().catch(e=>{console.error(e);process.exitCode=1;});
