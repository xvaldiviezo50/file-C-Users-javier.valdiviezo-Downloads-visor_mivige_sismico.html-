/* Uses the same agency parsers as the viewer. Append/revise by agency + ID. */
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'../..'),target=path.join(root,'mivige-v2/data/observations-history.json');
const layer={addTo(){return this},setView(){return this}};
const context={console,URL,AbortController,setTimeout,clearTimeout,fetch,Date,window:{},L:{map:()=>layer,tileLayer:()=>layer,layerGroup:()=>layer}};
vm.createContext(context);
for(const p of ['v10/app1.js','mivige-v2/quality.js'])vm.runInContext(fs.readFileSync(path.join(root,p),'utf8'),context);
context.MivigeQuality=context.window.MivigeQuality;
vm.runInContext(fs.readFileSync(path.join(root,'mivige-v2/data-quality.js'),'utf8'),context);
(async()=>{
 let saved={schema:1,sources:{}};if(fs.existsSync(target))saved=JSON.parse(fs.readFileSync(target));
 const result=await vm.runInContext('(async()=>{const out={};await Promise.all(Object.entries(endpoints).map(async([n,u])=>{const events=await fetchSource(n,u);out[n]={events,status:sourceStatus[n]};}));return out;})()',context);
 for(const [name,v] of Object.entries(result)){
  const old=saved.sources[name]||{events:[]};
  if(v.events.length){const m=new Map(old.events.map(e=>[e.id||e.time+":"+e.lat+":"+e.lon,e]));for(const e of v.events)m.set(e.id||e.time+":"+e.lat+":"+e.lon,e);saved.sources[name]={events:[...m.values()].sort((a,b)=>b.time-a.time),fetchedAt:v.status.fetchedAt,status:v.status};}
  console.log(name,v.events.length,'received;',saved.sources[name]?.events.length||0,'retained');
 }
 saved.lastAttemptAt=Date.now();fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,JSON.stringify(saved));
})();
