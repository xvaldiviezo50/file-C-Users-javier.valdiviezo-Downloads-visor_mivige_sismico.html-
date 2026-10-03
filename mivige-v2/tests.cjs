const assert=require('node:assert/strict');
const Q=require('./quality.js');
const now=Date.now(),base={source:'USGS',id:'a',time:now-1000,mag:4.5,lat:-2,lon:-79,depth:10};
assert.equal(Q.number(null),null);assert.equal(Q.number(''),null);assert.equal(Q.number('4.5'),4.5);
assert.equal(Q.clean([{...base,time:now+1},base,{...base,mag:null},{...base,lat:100}],now).length,1);
// Real events from one network must not disappear in a dense swarm.
assert.equal(Q.deduplicate([base,{...base,id:'b',time:now-2000}],{},now).length,2);
const merged=Q.deduplicate([base,{...base,source:'IG-EPN',id:'national',mag:4.7}],{'IG-EPN':5,USGS:2},now);
assert.equal(merged.length,1);assert.equal(merged[0].source,'IG-EPN');assert.equal(merged[0].reports.length,2);
assert.equal(Q.deduplicate([base,{...base,id:'b',source:'IGP',time:now-120000}],{},now).length,2);
assert.equal(Q.rateTest(0,0,1,6),null);assert(Math.abs(Q.rateTest(1,0,1,6)-1/7)<1e-12);
assert(Q.rateTest(10,1,1,6)<.000001);assert(Q.rateTest(1,10,1,6)>.5);
assert.deepEqual(Q.bh([.001,.01,.8,null]),[true,true,false,false]);
assert.deepEqual(Q.skill([{status:'closed',high:true,observed:true},{status:'closed',high:false,observed:true},{status:'pending',high:true}]),{n:2,tp:1,fp:0,fn:1,tn:0,precision:1,recall:.5});
console.log('Controles numéricos, catálogo, deduplicación y evaluación: OK');
