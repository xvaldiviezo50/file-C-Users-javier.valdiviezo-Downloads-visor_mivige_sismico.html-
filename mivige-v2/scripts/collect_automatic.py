"""Automated evidence acquisition and prospective association tests, not a physical forecast."""
import concurrent.futures as cf
import datetime as dt
import hashlib
import json
import math
import pathlib
import urllib.parse
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
DAY = 86400
VERSION = 'auto-association-1.0'
API = 'https://earthquake.usgs.gov/fdsnws/event/1/query'
CONFIG = dict(version=VERSION, catalog_days=90, detection_mag=4.5, baseline_days=89,
              baseline_min_events=20, recent_min_events=3, rate_ratio_min=3,
              horizons_hours=[24,72], target_magnitudes=[4.5,6],
              gnss_min_stations=3, gnss_max_age_days=7, gnss_snapshot_max_age_hours=48,
              meaning='Tamiz de asociaciones prospectivas; umbrales exploratorios no calibrados. No calcula Coulomb, dirección ni probabilidad.')
def iso(t):
    return dt.datetime.fromtimestamp(t,dt.timezone.utc).isoformat()
def stamp(s):
    if not isinstance(s,str):raise ValueError('Fecha no disponible')
    return dt.datetime.fromisoformat(s.replace('Z','+00:00')).timestamp()
def read(path,default):
    return json.loads(path.read_text()) if path.exists() else default
def write(path,obj):
    temp=path.with_suffix('.tmp')
    temp.write_text(json.dumps(obj,ensure_ascii=False,allow_nan=False,separators=(',',':'))+'\n')
    temp.replace(path)
def fetch(url):
    req=urllib.request.Request(url,headers={'User-Agent':'MIVIGE-research-automation/1.0'})
    with urllib.request.urlopen(req,timeout=45) as res:
        raw=res.read(15000000)
    if len(raw)>=15000000:raise ValueError('Respuesta supera límite; no se evalúa como completa')
    return json.loads(raw),hashlib.sha256(raw).hexdigest()
def distance(a,b):
    x,y=math.radians(a['lat']),math.radians(b['lat'])
    return 12742*math.asin(min(1,math.sqrt(math.sin((x-y)/2)**2+math.cos(x)*math.cos(y)*math.sin(math.radians(a['lon']-b['lon'])/2)**2)))
def inside(e,z):
    return distance(e,z)<=z['r'] and ('depth' not in z or e.get('depth') is not None and z['depth'][0]<=e['depth']<=z['depth'][1])
def normalize(j,now):
    if not isinstance(j.get('features'),list):raise ValueError('No es un catálogo GeoJSON')
    if len(j['features'])>=20000:raise ValueError('Posible catálogo truncado')
    result={}
    for f in j['features']:
        p=f['properties'];c=f['geometry']['coordinates']
        e=dict(id=f['id'],time=p['time']/1000,mag=p['mag'],mag_type=p.get('magType'),lat=c[1],lon=c[0],depth=c[2],place=p.get('place'),detail=p.get('detail'),updated=p.get('updated'),source='USGS ComCat',contributor=p.get('net'))
        if all(isinstance(e[k],(int,float)) and math.isfinite(e[k]) for k in ['time','mag','lat','lon','depth']) and now-90*DAY<=e['time']<=now and e['mag']>=4.5:result[e['id']]=e
    return sorted(result.values(),key=lambda e:e['time'])
def detail(e):
    try:
        j,digest=fetch(e['detail'])
        products={}
        for kind in ['moment-tensor','focal-mechanism','finite-fault']:
            choices=[p for p in j.get('properties',{}).get('products',{}).get(kind,[]) if p.get('status')!='DELETE']
            if choices:
                p=max(choices,key=lambda p:(p.get('preferredWeight',0),p.get('updateTime',0)))
                products[kind]=dict(source=p.get('source'),code=p.get('code'),updated=p.get('updateTime'),properties=p.get('properties'),files={k:v.get('url') for k,v in p.get('contents',{}).items() if v.get('url')})
        return dict(event_id=e['id'],status='consultado',products=products,url=e['detail'],sha256=digest)
    except Exception as ex:return dict(event_id=e['id'],status='consulta fallida',products={},error=str(ex)[:200])
def national_health(source):
    try:
        j,digest=fetch(source['url'])
        if j.get('error') or not isinstance(j.get('features'),list):raise ValueError('Respuesta sin colección válida')
        fields={'IG-EPN':'sis3_tiempo','IGP':'fechaevento','SGC':'ESP_FECHA'}
        dates=[f.get('properties',{}).get(fields[source['name']]) for f in j['features']]
        dates=[v/1000 for v in dates if isinstance(v,(int,float)) and math.isfinite(v)]
        truncated=bool(j.get('exceededTransferLimit') or j.get('properties',{}).get('exceededTransferLimit'))
        return dict(source,checked_at=iso(dt.datetime.now(dt.timezone.utc).timestamp()),count=len(j['features']),dated_count=len(dates),latest=iso(max(dates)) if dates else None,truncated=truncated,sha256=digest,status='muestra consultada; no usada en ventanas automáticas',reason='Validación de esquema, paginación y cobertura histórica nacional pendiente')
    except Exception as ex:return dict(source,status='consulta fallida',error=str(ex)[:200])
def gnss_for(g,z,now):
    try:fresh=0<=now-stamp(g['generated_at'])<=48*3600
    except (KeyError,ValueError):fresh=False
    zg=g.get('zones',{}).get(z['id'],{})
    stations=[]
    for s in g.get('stations',[]):
        try:valid=0<=now-stamp(s['observed_at'])<=7*DAY
        except (KeyError,TypeError,ValueError):valid=False
        if fresh and valid and s.get('usable') and s['code'] in zg.get('used',[]):stations.append(s)
    codes={s['code'] for s in stations}
    candidates=[c for c in zg.get('coherent_candidates',[]) if c in codes]
    return dict(available=len(stations)>=3,candidate=len(stations)>=3 and len(candidates)>=3,
                generated_at=g.get('generated_at'),stations=[{k:s.get(k) for k in ['code','observed_at','delta_mm','noise_mm','z','products']} for s in stations],
                candidate_codes=candidates,tectonic_attribution='pendiente; no se descartan efectos estacionales, hidrológicos o instrumentales')
def assess(events,g,z,now):
    local=[e for e in events if inside(e,z)]
    base=[e for e in local if now-90*DAY<=e['time']<now-DAY]
    recent=[e for e in local if now-DAY<=e['time']<=now]
    ratio=len(recent)/(len(base)/89) if base else None
    ready=len(base)>=20
    seismic=ready and len(recent)>=3 and ratio>=3
    geodesy=gnss_for(g,z,now)
    return dict(zone=z,baseline_count=len(base),recent_count=len(recent),rate_ratio=ratio,
                seismic_evaluable=ready,seismic_candidate=seismic,gnss=geodesy,
                event_ids=[e['id'] for e in local],
                physical_direction=None,coulomb='no calculado',slow_slip_inversion='no calculada')
def result(active,found):
    return 'coincidencia' if active and found else 'falsa_alarma' if active else 'omision' if found else 'negativo_correcto'
def advance(records,events,now,catalog_ok,catalog_start):
    for r in records:
        if r['status']!='abierta':continue
        if now<r['end']:continue
        if r['start']<catalog_start:
            r.update(status='no_evaluable',reason='No hay archivo completo de la ventana en el catálogo móvil')
        elif catalog_ok:
            hits=[e for e in events if r['start']<=e['time']<r['end'] and e['mag']>=r['target_mag'] and inside(e,r['zone'])]
            r.update(status=result(r['active'],bool(hits)),events=hits,evaluated_at=iso(now),provisional=True)
    return records
def issue(records,states,now,catalog_meta,gnss_hash):
    for s in states:
        if not s['seismic_evaluable']:continue
        for mechanism in ['actividad_sismica','sismicidad_y_gnss']:
            if mechanism=='sismicidad_y_gnss' and not s['gnss']['available']:continue
            active=s['seismic_candidate'] and (mechanism=='actividad_sismica' or s['gnss']['candidate'])
            for hours in CONFIG['horizons_hours']:
                for mag in CONFIG['target_magnitudes']:
                    if any(r['version']==VERSION and r['zone']['id']==s['zone']['id'] and r['mechanism']==mechanism and r['hours']==hours and r['target_mag']==mag and r['end']>now for r in records):continue
                    key=f"{VERSION}:{s['zone']['id']}:{mechanism}:{hours}:{mag}:{int(now)}"
                    records.append(dict(id=key,version=VERSION,zone=s['zone'],mechanism=mechanism,
                                        hours=hours,target_mag=mag,start=now,end=now+hours*3600,
                                        active=bool(active),status='abierta',evidence=s,config=CONFIG,
                                        catalogue=catalog_meta,gnss_sha256=gnss_hash,physical_mechanism_confirmed=False))
    return records
def build():
    now=dt.datetime.now(dt.timezone.utc).timestamp()
    folder=ROOT/'data';folder.mkdir(exist_ok=True)
    zones=read(ROOT/'segments.json',[])
    ledger=read(folder/'automatic-ledger.json',{'records':[]})
    records=ledger['records']
    query=dict(format='geojson',starttime=iso(now-90*DAY),endtime=iso(now),
               minlatitude=-57,maxlatitude=14,minlongitude=-84,maxlongitude=-58,
               minmagnitude=4.5,limit=20000,orderby='time-asc')
    url=API+'?'+urllib.parse.urlencode(query)
    try:
        payload,digest=fetch(url);events=normalize(payload,now)
        meta=dict(status='consultado',url=url,sha256=digest,retrieved_at=iso(now),count=len(events),
                  coverage='ComCat regional M≥4,5; no equivale a catálogo nacional completo ni a completitud estadística demostrada')
        write(folder/'automatic-catalogue.json',dict(meta=meta,events=events))
    except Exception as ex:
        previous=read(folder/'automatic.json',{})
        previous.update(schema=1,generated_at=iso(now),run_status='fallo de catálogo; no se emiten ni evalúan ventanas',error=str(ex)[:300])
        write(folder/'automatic.json',previous)
        raise
    gnss_path=folder/'gnss.json';g=read(gnss_path,{})
    ghash=hashlib.sha256(gnss_path.read_bytes()).hexdigest() if gnss_path.exists() else None
    states=[assess(events,g,z,now) for z in zones]
    selected=sorted([e for e in events if e['mag']>=5 and e['time']>=now-7*DAY],key=lambda e:-e['time'])
    with cf.ThreadPoolExecutor(max_workers=4) as pool:products=list(pool.map(detail,selected[:30]))
    with cf.ThreadPoolExecutor(max_workers=3) as pool:national=list(pool.map(national_health,read(folder/'national-sources.json',[])))
    advance(records,events,now,True,now-90*DAY)
    issue(records,states,now,meta,ghash)
    write(folder/'automatic-ledger.json',dict(schema=1,version=VERSION,updated_at=iso(now),records=records))
    # Store each run's evidence in git, and every issue's inputs in the ledger.
    report=dict(schema=1,generated_at=iso(now),run_status='ok',config=CONFIG,catalogue=meta,
                gnss_generated_at=g.get('generated_at'),states=states,products=products,
                national_catalogues=national,
                product_scope=dict(days=7,min_magnitude=5,limit=30,eligible=len(selected),truncated=len(selected)>30),
                product_counts={kind:sum(kind in p['products'] for p in products) for kind in ['moment-tensor','focal-mechanism','finite-fault']},
                pending=['Coulomb: geometría receptora, deslizamiento e inversión no integrados',
                         'InSAR: procesamiento y acceso autenticado por integrar',
                         'Esfuerzos dinámicos: descarga de ondas y cálculo por integrar'],
                ledger_records=len(records))
    write(folder/'automatic.json',report)
    print(json.dumps({'catalogue':len(events),'products':report['product_counts'],'evaluable_zones':sum(s['seismic_evaluable'] for s in states),'gnss_zones':sum(s['gnss']['available'] for s in states),'windows':len(records)},ensure_ascii=False))
if __name__=='__main__':build()
