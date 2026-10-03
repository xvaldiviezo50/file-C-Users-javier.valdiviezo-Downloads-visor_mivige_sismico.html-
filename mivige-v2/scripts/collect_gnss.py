"""Public NGL IGS20 observations. Diagnostic screening, never earthquake prediction."""
import concurrent.futures as cf
import datetime as dt
import hashlib
import json
import math
import pathlib
import statistics as stats
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
BASE = 'https://geodesy.unr.edu/'
DAY = 86400
NOW = dt.datetime.now(dt.timezone.utc).timestamp()

def fetch(path):
    req = urllib.request.Request(BASE + path, headers={'User-Agent': 'MIVIGE-academic-GNSS/2.2'})
    with urllib.request.urlopen(req, timeout=40) as r:
        raw = r.read(16000000)
    if len(raw) >= 16000000:
        raise ValueError('Archivo supera límite de descarga')
    return raw.decode('utf-8')

def distance(a, b):
    la, lb = map(math.radians, [a['lat'], b['lat']])
    dl = math.radians(a['lon'] - b['lon'])
    x = math.sin((la-lb)/2)**2 + math.cos(la)*math.cos(lb)*math.sin(dl/2)**2
    return 6371 * 2 * math.asin(math.sqrt(min(1,x)))

def holdings(text):
    out = {}
    for line in text.splitlines()[1:]:
        p = line.split()
        try:
            code, lat, lon = p[0], float(p[1]), (float(p[2])+180)%360-180
            if not (len(code)==4 and code.isalnum() and -57 <= lat <= 14 and -84 <= lon <= -58):
                continue
            out[code] = dict(code=code, lat=lat, lon=lon, last_inventory=p[8])
        except (ValueError, IndexError):
            continue
    return out

def parse(text, now=NOW):
    """Reconstruct full ENU (integer origin + fractional coordinate), never fraction alone."""
    out = {}
    epoch = dt.datetime(1858,11,17,tzinfo=dt.timezone.utc).timestamp()
    for line in text.splitlines():
        p = line.split()
        try:
            t = epoch + float(p[3])*DAY
            enu = [float(p[a])+float(p[b]) for a,b in [(7,8),(9,10),(11,12)]]
            sig = [float(p[k]) for k in (14,15,16)]
            if not all(math.isfinite(x) for x in [t,*enu,*sig]) or not now-400*DAY<=t<=now:
                continue
            if any(x<=0 for x in sig) or sig[0]>.01 or sig[1]>.01 or sig[2]>.03:
                continue
            out[t] = dict(t=t, enu=enu, sigma=sig)
        except (ValueError,IndexError):
            continue
    return out

def merge(final, rapid):
    """Remove robust overlap offset before extending finals. Do not double count epochs."""
    shared = sorted(set(final)&set(rapid))[-30:]
    if len(shared)<7:
        chosen = rapid if rapid and max(rapid)>max(final,default=0) else final
        return chosen, 'producto único; sin solape suficiente', False
    offsets = [stats.median(rapid[t]['enu'][k]-final[t]['enu'][k] for t in shared) for k in range(3)]
    result = dict(final)
    for t,row in rapid.items():
        if t not in result:
            result[t] = dict(row, enu=[row['enu'][k]-offsets[k] for k in range(3)])
    return result, 'final + rápido; ajuste de offset con ≥7 épocas comunes', True

def diagnose(rows, now=NOW):
    if not rows:
        return dict(usable=False,reason='sin épocas válidas',observed_at=None,age_days=None)
    ts = sorted(rows); last=ts[-1]; age=(now-last)/DAY
    base = [rows[t] for t in ts if last-100*DAY<=t<last-7*DAY]
    recent = [rows[t] for t in ts if last-7*DAY<=t<=last]
    result=dict(observed_at=dt.datetime.fromtimestamp(last,dt.timezone.utc).isoformat(),age_days=round(age,2),epochs=len(rows),baseline_epochs=len(base),recent_epochs=len(recent),usable=False)
    if age>7:
        return dict(result,reason='observaciones atrasadas (>7 días)')
    if len(base)<60 or len(recent)<5:
        return dict(result,reason='historia insuficiente: requiere 60 épocas base y 5 recientes')
    delta=[];noise=[];z=[]
    for k in range(3):
        xs=[(r['t']-last)/DAY for r in base]; ys=[r['enu'][k] for r in base]
        mx=stats.mean(xs);my=stats.mean(ys)
        slope=sum((x-mx)*(y-my) for x,y in zip(xs,ys))/sum((x-mx)**2 for x in xs)
        residual=[y-(my+slope*(x-mx)) for x,y in zip(xs,ys)]
        center=stats.median(residual)
        scale=max(1.4826*stats.median(abs(x-center) for x in residual),stats.median(r['sigma'][k] for r in recent),.001 if k<2 else .003)
        d=stats.median(r['enu'][k]-(my+slope*((r['t']-last)/DAY-mx)) for r in recent)-center
        delta.append(round(d*1000,3));noise.append(round(scale*1000,3));z.append(round(d/scale,3))
    candidate=math.hypot(*delta[:2])>=5 and max(abs(v) for v in z[:2])>=3
    return dict(result,usable=True,reason='tamiz disponible; QC preliminar',delta_mm=delta,noise_mm=noise,z=z,candidate=candidate)

def station(s):
    paths={'final':f'gps_timeseries/IGS20/tenv3/IGS20/{s["code"]}.tenv3','rapid':f'gps_timeseries/IGS20/rapids/IGS20/{s["code"]}.tenv3'}
    product={}; provenance=[];errors=[]
    for key,path in paths.items():
        try:
            raw=fetch(path);product[key]=parse(raw)
            provenance.append(dict(product=key,url=BASE+path,sha256=hashlib.sha256(raw.encode()).hexdigest(),valid_epochs=len(product[key])))
        except Exception as e:
            product[key]={};errors.append(key+': '+str(e)[:120])
    rows,method,aligned=merge(product['final'],product['rapid'])
    d=diagnose(rows)
    # Two products with a large unsupported boundary must never generate a candidate.
    d['candidate']=bool(d.get('candidate',False))
    points=[]
    if rows:
        t0=max(rows)-120*DAY;keys=[t for t in sorted(rows) if t>=t0];ref=rows[keys[0]]['enu']
        points=[dict(date=dt.datetime.fromtimestamp(t,dt.timezone.utc).strftime('%Y-%m-%d'),mm=[round((rows[t]['enu'][k]-ref[k])*1000,3) for k in range(3)]) for t in keys]
    return dict(s,**d,merge_method=method,products=provenance,errors=errors,series=points,url=BASE+f'NGLStationPages/stations/{s["code"]}.sta')

def build():
    segments=json.loads((ROOT/'segments.json').read_text())
    inventory={};errors=[]
    for name in ('DataHoldings.txt','DataHoldingsRapid24hr.txt'):
        try:
            for code,s in holdings(fetch('NGLStationPages/'+name)).items():
                if code not in inventory or s['last_inventory']>inventory[code]['last_inventory']:
                    inventory[code]=s
        except Exception as e:errors.append(name+': '+str(e))
    if not inventory:raise RuntimeError('Inventario no disponible: se conserva snapshot anterior')
    selected={}
    for seg in segments:
        near=[s for s in inventory.values() if distance(s,seg)<=max(seg['r'],250)]
        near.sort(key=lambda s:(-dt.date.fromisoformat(s['last_inventory']).toordinal(),distance(s,seg)))
        local=[]
        for s in near:
            if any(distance(s,x)<2 for x in local):continue
            local.append(s);selected[s['code']]=s
            if len(local)>=8:break
    with cf.ThreadPoolExecutor(max_workers=6) as ex:
        stations=list(ex.map(station,selected.values()))
    zones={}
    for seg in segments:
        ss=[s for s in stations if distance(s,seg)<=max(seg['r'],250)]
        usable=[]
        for s in sorted(ss,key=lambda s:(s.get('age_days') if s.get('age_days') is not None else 1e6)):
            if s['usable'] and not any(distance(s,x)<2 for x in usable):usable.append(s)
        candidates=[s for s in usable if s.get('candidate')]
        coherent=[]
        for a in candidates:
            group=[]
            for b in candidates:
                va,vb=a['delta_mm'][:2],b['delta_mm'][:2]
                cosine=sum(x*y for x,y in zip(va,vb))/(math.hypot(*va)*math.hypot(*vb))
                if cosine>=.8 and abs(a['age_days']-b['age_days'])<=2:group.append(b['code'])
            if len(group)>len(coherent):coherent=group
        state='candidate' if len(coherent)>=3 else 'available' if len(usable)>=3 else 'insufficient'
        zones[seg['id']]=dict(state=state,stations=[s['code'] for s in ss],used=[s['code'] for s in usable],coherent_candidates=coherent if len(coherent)>=3 else [],spatial_radius_km=max(seg['r'],250),tectonic_attribution='no resuelta',confirmed=False)
    return dict(schema=1,version='2.2',generated_at=dt.datetime.now(dt.timezone.utc).isoformat(),source='Nevada Geodetic Laboratory / IGS20',inventory_count=len(inventory),selected_count=len(stations),errors=errors,stations=stations,zones=zones,method='Tamiz exploratorio: residual mediano 7 días frente a tendencia de 93 días; NO precursor validado. Sin corrección estacional/hidrológica ni revisión instrumental completa.')

if __name__=='__main__':
    data=build();target=ROOT/'data/gnss.json'
    if not any(s.get('observed_at') for s in data['stations']):raise RuntimeError('Sin series legibles: conservar snapshot anterior')
    target.parent.mkdir(exist_ok=True);tmp=target.with_suffix('.tmp');tmp.write_text(json.dumps(data,ensure_ascii=False,allow_nan=False,separators=(',',':'))+'\n');tmp.replace(target)
    print(json.dumps({'stations':len(data['stations']),'usable':sum(s['usable'] for s in data['stations']),'zones':{k:v['state'] for k,v in data['zones'].items()}},ensure_ascii=False))
