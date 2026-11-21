"""Replay archived numerical inputs without web access: python scripts/replay_physical.py SNAPSHOT.gz."""
import gzip,json,sys,hashlib
from pathlib import Path
import numpy as np
from obspy.taup import TauPyModel
from physical_core import coulomb,station_change,geodesy_zone
from collect_physical import arrivals,day
root=Path(__file__).resolve().parents[1]
snapshot=json.loads(gzip.decompress(Path(sys.argv[1]).read_bytes()));data=snapshot['scenarios']
for p,h in data['manifest'].items():
    if hashlib.sha256((root/p).read_bytes()).hexdigest()!=h:raise SystemExit('Code mismatch; check out recorded revision: '+p)
receivers={r['id']:r for r in json.loads((root/'mivige-v2/physical-receivers.json').read_text())}
zones={z['id']:z for z in data['zones']};models={k:TauPyModel(k) for k in ('iasp91','ak135')};checks=0
for source in data['sources']:
    moment=np.array(source['momentTensor']['ned']) if source['momentTensor'] else None
    for r in source['receivers']:
        actual=coulomb(source['staticSource'],zones[r['id']],receivers.get(r['id']),moment);assert actual['status']==r['coulomb']['status']
        if actual['status']=='scenario':
            for k in ('valueMPa','minMPa','maxMPa'):np.testing.assert_allclose(actual[k],r['coulomb'][k],rtol=1e-8,atol=1e-12)
        a=arrivals(models,source['source'],zones[r['id']])
        for phase in ('P','S'):
            expected=r['dynamic']['arrivals'][phase];observed=a['arrivals'][phase]
            assert (expected is None)==(observed is None)
            if expected:np.testing.assert_allclose([observed['minSeconds'],observed['maxSeconds']],[expected['minSeconds'],expected['maxSeconds']],atol=1e-6)
        checks+=1
gnss=snapshot['inputs']['gnss'];actual=[r for s in gnss['stations'] if (r:=station_change(s,data['generatedAt']/86400000,day(gnss['generated_at']))) is not None]
assert len(actual)==len(data['stations'])
for a,b in zip(actual,data['stations']):
    assert a['code']==b['code'] and a['fresh']==b['fresh']
    np.testing.assert_allclose(a['deltaVelocityMmDay'],b['deltaVelocityMmDay'],atol=1e-10)
print('Replay verified:',checks,'source-receiver scenarios;',len(actual),'GNSS series')
