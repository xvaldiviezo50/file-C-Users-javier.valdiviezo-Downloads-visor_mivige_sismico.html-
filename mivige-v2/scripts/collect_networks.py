"""National station inventories, not displacement measurements. Public GET only."""
import concurrent.futures as cf
import datetime as dt
import json
import math
import pathlib
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
SOURCES = [
 dict(id='regme',name='IGM · REGME Ecuador',url='https://www.geoportaligm.gob.ec/geoserver_geodesia/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=gnss:estaciones_regme_vista&outputFormat=application/json&srsName=EPSG:4326',portal='https://www.geoportaligm.gob.ec/visor_regme/',access='Inventario oficial y estado declarado; RINEX mediante registro en IGM. ENU directo pendiente.'),
 dict(id='geored',name='SGC · GeoRED Colombia',url='https://geoportal.sgc.gov.co/arcgis/rest/services/Estaciones_GNSS/Estaciones_GNSS_GEORED_SGC/MapServer/0/query?where=1%3D1&outFields=*&returnGeometry=true&outSR=4326&f=geojson',portal='https://geored2.sgc.gov.co/redgnss/Paginas/Series-de-tiempo.aspx',access='Inventario oficial; gráficos institucionales disponibles. ENU directo pendiente.'),
 dict(id='igp',name='IGP · GNSS Perú',url='https://ide.igp.gob.pe/arcgis/rest/services/REDES/Red_Estaciones/MapServer/1/query?where=red%3D%27GNSS%27&outFields=*&returnGeometry=true&outSR=4326&f=geojson',portal='https://ide.igp.gob.pe/',access='Inventario GNSS oficial, filtrado por tipo de red. ENU directo pendiente; no representa la red IGN completa.')
]

def normalize(payload, source):
    if payload.get('error') or not isinstance(payload.get('features'),list):
        raise ValueError('Respuesta sin colección de estaciones')
    if payload.get('exceededTransferLimit'):
        raise ValueError('Inventario truncado por el proveedor')
    result={}
    for f in payload['features']:
        p=f.get('properties') or {};g=f.get('geometry') or {}
        if g.get('type')!='Point':continue
        xy=g.get('coordinates',[])
        if len(xy)<2 or any(isinstance(x,bool) or not isinstance(x,(float,int)) or not math.isfinite(x) for x in xy[:2]):continue
        lon,lat=xy[:2]
        if not -90<=lat<=90 or not -180<=lon<=180:continue
        code=str(p.get('codigo') or p.get('ID_cGNSS') or '').strip().upper()
        if not code:continue
        if source=='igp' and p.get('red')!='GNSS':continue
        key=(code,round(lat,5),round(lon,5))
        result[key]=dict(code=code,lat=lat,lon=lon,name=p.get('nombre') or p.get('Sitio_cGNSS') or code,network=p.get('Entidad_Red_cGNSS') or source,declared_status=p.get('estado') or 'no publicado')
    if not result:raise ValueError('Sin estaciones válidas; se conserva inventario anterior')
    return list(result.values())

def collect(source, previous):
    checked=dt.datetime.now(dt.timezone.utc).isoformat()
    try:
        req=urllib.request.Request(source['url'],headers={'User-Agent':'MIVIGE-public-station-inventory/2.2.3'})
        with urllib.request.urlopen(req,timeout=35) as r:
            payload=json.load(r)
        return dict(source,stations=normalize(payload,source['id']),status='consultado',checked_at=checked,retrieved_at=checked)
    except Exception as e:
        return dict(source,stations=previous.get('stations',[]),status='consulta fallida; último inventario conservado' if previous.get('stations') else 'no disponible',checked_at=checked,retrieved_at=previous.get('retrieved_at'),error=str(e))

def build():
    target=ROOT/'data/networks.json'
    old=json.loads(target.read_text()) if target.exists() else {}
    previous={s['id']:s for s in old.get('sources',[])}
    with cf.ThreadPoolExecutor(max_workers=3) as ex:
        sources=list(ex.map(lambda s:collect(s,previous.get(s['id'],{})),SOURCES))
    epn=json.loads((ROOT/'data/rengeo-reference.json').read_text())
    sources.insert(0,epn)
    data=dict(schema=1,generated_at=dt.datetime.now(dt.timezone.utc).isoformat(),sources=sources)
    tmp=target.with_suffix('.tmp');tmp.write_text(json.dumps(data,ensure_ascii=False,allow_nan=False,separators=(',',':'))+'\n');tmp.replace(target)
    print(json.dumps({s['id']:{'stations':len(s['stations']),'status':s['status']} for s in sources},ensure_ascii=False))
if __name__=='__main__':build()
