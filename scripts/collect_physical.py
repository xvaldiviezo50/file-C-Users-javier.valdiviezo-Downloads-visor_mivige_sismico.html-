"""Collect traceable inputs and publish independent physical scenarios. No core-score writes."""
import datetime as dt
import gzip,hashlib,json,math,os,sys,time,urllib.request,urllib.parse
import xml.etree.ElementTree as ET
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from obspy.taup import TauPyModel
import numpy as np
from physical_core import VERSION,geo,moment_ned,coulomb,station_change,geodesy_zone
from validate_ranking import next_start,get_catalogue,outcome,publication_time

ROOT=Path(__file__).resolve().parents[1];DATA=ROOT/'mivige-v2/data';HOUR=3600000

def encoded(x):return json.dumps(x,ensure_ascii=False,sort_keys=True,separators=(',',':'),allow_nan=False).encode()
def iso(ms):return dt.datetime.fromtimestamp(ms/1000,dt.timezone.utc).isoformat()
def day(s):return dt.datetime.fromisoformat(s.replace('Z','+00:00')).timestamp()/86400

def fetch(url):
    with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'MIVIGE-research/3097'}),timeout=35) as response:return response.read()

def preferred(products,kind):
    return next(iter(sorted([p for p in products.get(kind,[]) if p.get('status')!='DELETE'],key=lambda p:(p.get('preferredWeight',0),p.get('updateTime',0)),reverse=True)),None)

def shakemap(products,inputs):
    p=preferred(products,'shakemap')
    if not p:return None
    item=p.get('contents',{}).get('download/grid.xml')
    if not item:return None
    raw=fetch(item['url']);inputs['shakemap']=dict(url=item['url'],sha256=hashlib.sha256(raw).hexdigest(),units='cm/s',sampledNodes={})
    tree=ET.fromstring(raw)
    fields={e.attrib['name'].upper():(int(e.attrib['index'])-1,e.attrib.get('units')) for e in tree.iter() if e.tag.split('}')[-1]=='grid_field'}
    if not all(k in fields for k in ('LAT','LON','PGV')) or fields['PGV'][1] not in ('cms','cm/s'):return None
    values=next(e.text for e in tree.iter() if e.tag.split('}')[-1]=='grid_data')
    rows=np.array([[float(x) for x in line.split()] for line in values.strip().splitlines()])
    return rows[:,[fields['LAT'][0],fields['LON'][0],fields['PGV'][0]]]

def amplitude(grid,zone):
    if grid is None:return dict(status='missing',reason='Sin malla ShakeMap PGV disponible; no hay amplitud medida en el receptor')
    lat,lon=zone['lat'],zone['lon']
    if not grid[:,0].min()<=lat<=grid[:,0].max() or not grid[:,1].min()<=lon<=grid[:,1].max():return dict(status='outside',reason='Receptor fuera de la cobertura ShakeMap')
    ds=(grid[:,0]-lat)**2+((grid[:,1]-lon)*math.cos(math.radians(lat)))**2
    row=grid[int(np.argmin(ds))];distance,_=geo(lat,lon,row[0],row[1]);pgv=float(row[2])
    if distance>20 or pgv<0:return dict(status='missing',reason='Malla sin nodo válido a menos de 20 km')
    return dict(status='modeled',pgvCmS=pgv,equivalentStressMPa=2700*3500*(pgv/100)/1e6,nodeDistanceKm=distance,nodeLat=float(row[0]),nodeLon=float(row[1]),
        interpretation='PGV modelada/interpolada por ShakeMap, no forma de onda medida. Esfuerzo equivalente rho*Vs*PGV: proxy de onda plana, sin resolver la tracción sobre la falla.',assumedDensityKgM3=2700,assumedVsMS=3500)

def arrivals(models,source,zone):
    dist,az=geo(source['lat'],source['lon'],zone['lat'],zone['lon']);deg=dist/6371*180/math.pi;result={}
    for kind,phases in [('P',['P','p','Pn','Pg']),('S',['S','s','Sn','Sg'])]:
        times=[]
        for name,model in models.items():
            try:
                a=model.get_travel_times(source_depth_in_km=source['depth'],distance_in_degree=deg,phase_list=phases)
                if a:times.append(dict(model=name,seconds=float(a[0].time),phase=a[0].name))
            except (ValueError,TypeError):pass
        result[kind]=dict(models=times,minSeconds=min(x['seconds'] for x in times),maxSeconds=max(x['seconds'] for x in times)) if times else None
    return dict(distanceKm=dist,azimuth=az,arrivals=result,interpretation='Llegadas teóricas al punto superficial del segmento. Rango iasp91–ak135, no intervalo probabilístico ni fecha de otro sismo.')

def prepare(feature):
    try:
        detail=json.loads(fetch(feature['properties']['detail']));return detail,None
    except Exception as exc:return None,str(exc)

def evaluate_windows(ledger,now):
    for item in ledger['issues']:
        path=ROOT/item['snapshot']
        if not path.exists():continue
        published=publication_time(path)
        if published is None:continue
        if published>=item['start'] or published<item['issuedAt']-300000:
            item['status']='INVALID_PUBLICATION';continue
        item['publishedAt']=published
        raw=gzip.decompress(path.read_bytes())
        if hashlib.sha256(raw).hexdigest()!=item['hash']:raise ValueError('Frozen scenario hash changed')
        snapshot=json.loads(raw);zones=[{'zone':z} for z in snapshot['scenarios']['zones']]
        for hours in (24,72):
            end=item['start']+hours*HOUR
            if now<end+24*HOUR or str(hours) in item['evaluations']:continue
            try:
                events,cat=get_catalogue(item['start'],end)
                item['evaluations'][str(hours)]={'catalogue':cat,'evaluatedAt':now,'targets':{str(m):outcome(zones,events,item['start'],end,m,item['selected']) for m in (4.,4.5,6.)}}
                item.pop('evaluationError',None)
            except Exception as exc:item['evaluationError']=str(exc)[:250]
        item['status']='EVALUATED' if len(item['evaluations'])==2 else 'PENDING'


def main():
    now=int(time.time()*1000);output=DATA/'physical-scenarios.json';ledgerpath=DATA/'physical-windows.json'
    old=json.loads(output.read_text()) if output.exists() else None
    ledger=json.loads(ledgerpath.read_text()) if ledgerpath.exists() else {'version':VERSION,'issues':[]}
    try:evaluate_windows(ledger,now)
    except Exception as exc:ledger['error']=str(exc)[:250]
    try:
        zones=json.loads((ROOT/'mivige-v2/segments.json').read_text());receivers={r['id']:r for r in json.loads((ROOT/'mivige-v2/physical-receivers.json').read_text())}
        url='https://earthquake.usgs.gov/fdsnws/event/1/query?'+urllib.parse.urlencode(dict(format='geojson',starttime=iso(now-14*24*HOUR),endtime=iso(now),minmagnitude=5.5,minlatitude=-60,maxlatitude=35,minlongitude=-120,maxlongitude=-45,orderby='time',limit=8))
        catalog=json.loads(fetch(url));inputs={'catalogue':{'url':url,'data':catalog},'events':{}}
        models={k:TauPyModel(model=k) for k in ('iasp91','ak135')}
        sources=[];errors=[]
        features=catalog.get('features')
        if not isinstance(features,list):raise ValueError('Invalid source catalogue')
        for feature,(detail,error) in zip(features,ThreadPoolExecutor(max_workers=4).map(prepare,features)):
            if error:errors.append({'id':feature['id'],'error':error});continue
            p=detail['properties'];lon,lat,depth=detail['geometry']['coordinates'];source=dict(id=detail['id'],time=p['time'],mag=p['mag'],magType=p.get('magType'),lat=lat,lon=lon,depth=depth,place=p.get('place'),url=p.get('url'),updated=p.get('updated'))
            sourceinputs={'detail':detail,'detailUrl':feature['properties']['detail']};inputs['events'][source['id']]=sourceinputs
            products=p.get('products',{});mt=preferred(products,'moment-tensor');moment=moment_ned(mt['properties']) if mt else None
            # Use the centroid associated with the tensor for the static source when provided.
            static_source=dict(source)
            if mt:
                for outputkey,inputkey in [('lat','derived-latitude'),('lon','derived-longitude'),('depth','derived-depth')]:
                    try:static_source[outputkey]=float(mt['properties'][inputkey])
                    except (ValueError,TypeError,KeyError):pass
            try:grid=shakemap(products,sourceinputs)
            except Exception as exc:grid=None;errors.append({'id':source['id'],'shakemap':str(exc)[:180]})
            rows=[]
            for zone in zones:
                dynamic=arrivals(models,source,zone);dynamic['amplitude']=amplitude(grid,zone)
                if 'shakemap' in sourceinputs:sourceinputs['shakemap']['sampledNodes'][zone['id']]=dynamic['amplitude']
                rows.append({'id':zone['id'],'dynamic':dynamic,'coulomb':coulomb(static_source,zone,receivers.get(zone['id']),moment)})
            sources.append({'source':source,'staticSource':static_source,'momentTensor':{'provider':mt.get('source'),'updated':mt.get('updateTime'),'units':'N m','ned':moment.tolist()} if moment is not None else None,'receivers':rows})
        if features and not sources:raise ValueError('All source detail requests failed')
        gnss=json.loads((DATA/'gnss.json').read_text());inputs['gnss']=gnss
        stations=[s for st in gnss.get('stations',[]) if (s:=station_change(st,now/86400000,day(gnss['generated_at']))) is not None]
        codepaths=['scripts/physical_core.py','scripts/collect_physical.py','mivige-v2/segments.json','mivige-v2/physical-receivers.json','scripts/validate_ranking.py']
        manifest={p:hashlib.sha256((ROOT/p).read_bytes()).hexdigest() for p in codepaths}
        data={'version':VERSION,'generatedAt':now,'lastAttemptAt':now,'runStatus':'ok','codeRevision':os.getenv('GITHUB_SHA','local-unpublished'),'manifest':manifest,'dependencies':{'obspy':'1.4.2','numpy':np.__version__,'python':sys.version.split()[0]},'zones':zones,'sources':sources,'stations':stations,'geodesy':{z['id']:geodesy_zone(z,stations) for z in zones},'errors':errors,'inputHash':hashlib.sha256(encoded(inputs)).hexdigest(),
              'scope':'8 eventos USGS más recientes M≥5.5, últimos 14 días, América (-60 a 35°, -120 a -45°). Geodesia histórica conservada con fechas; solo fresca entra al tamiz. Sin dirección del siguiente terremoto.'}
        output.write_bytes(encoded(data)+b'\n')
        issued=int(time.time()*1000);start=next_start(issued)
        if sources and sources[0]['source']['id']==features[0]['id'] and not any(i['start']==start for i in ledger['issues']):
            # Independently test the newest source, not whichever source best matches future events.
            source=sources[0];selected=[r['id'] for r in source['receivers'] if r['coulomb'].get('sign')=='positive']
            identity=str(start)+'-'+hashlib.sha256(encoded(manifest)).hexdigest()[:12]
            rel=f'mivige-v2/data/physical-snapshots/{identity}.json.gz';path=ROOT/rel;path.parent.mkdir(parents=True,exist_ok=True)
            if path.exists():raise ValueError('Immutable snapshot already exists')
            raw=encoded({'inputs':inputs,'scenarios':data,'issuedAt':issued,'start':start});path.write_bytes(gzip.compress(raw))
            ledger['issues'].append(dict(id=identity,snapshot=rel,hash=hashlib.sha256(raw).hexdigest(),issuedAt=issued,start=start,source=source['source']['id'],selected=selected,status='PENDING',evaluations={},rule='Fuente más reciente; centros con ΔCFS positivo en toda la sensibilidad. Hipótesis geométrica, no probabilidad. Casos sin selección conservados.'))
        print(json.dumps({'sources':len(sources),'staticScenarios':sum(r['coulomb']['status']=='scenario' for s in sources for r in s['receivers']),'gnssStations':len(stations),'windows':len(ledger['issues'])}))
    except Exception as exc:
        data=old or {'version':VERSION,'generatedAt':None,'zones':[],'sources':[],'stations':[],'geodesy':{}}
        data.update(runStatus='retained' if old else 'unavailable',lastAttemptAt=now,error=str(exc)[:400]);output.write_bytes(encoded(data)+b'\n');print('Retained:',str(exc))
    ledger['updatedAt']=now;ledgerpath.write_bytes(encoded(ledger)+b'\n')

if __name__=='__main__':main()
