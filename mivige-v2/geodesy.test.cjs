const assert=require('node:assert/strict'),{assess}=require('./geodesy.js');
const now=Date.now(),iso=t=>new Date(t).toISOString(),day=86400000;
const d={schema:1,generated_at:iso(now),stations:['A','B','C'].map(code=>({code,usable:true,observed_at:iso(now-day)})),zones:{x:{used:['A','B','C'],coherent_candidates:['A','B','C']},y:{used:[],coherent_candidates:[]}}};
assert(assess(d,'x',now).candidate);assert(!assess(d,'x',now).coherent);
assert(!assess(d,'y',now).candidate);assert.equal(assess(d,'y',now).used,0);
assert(!assess(d,'x',now+8*day).candidate);
assert(!assess({...d,generated_at:iso(now-3*day)},'x',now).candidate);
assert(!assess(null,'x',now).coherent);
console.log('GNSS: asociación espacial, caducidad y candidatos sin confirmación automática: OK');
