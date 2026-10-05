"""Retain public weather metadata, including original valid times, on outages."""
import json, urllib.request, xml.etree.ElementTree as ET
from pathlib import Path
from datetime import datetime, timezone
from concurrent.futures import ThreadPoolExecutor
OUT=Path(__file__).resolve().parents[1]/'data/rain-products.json'
SOURCES={
 'sat':('https://services.geoglows.org/geoserver/satellite_based_precipitation/wms','persiann_pdir_24h'),
 'wrf':('https://services.geoglows.org/geoserver/wrf/wms','wrf_precipitation'),
 'inocar':('https://www.inocar.mil.ec/mareas/consultar_valores_parametros.php?id_modelo=2&id_dominio=1',None)}
def parse(key,raw):
 url,name=SOURCES[key]
 if key=='inocar':
  dates=json.loads(raw)
  if not isinstance(dates,list) or not dates:raise ValueError('Empty date list')
  for d in dates:datetime.strptime(d,'%Y-%m-%d %H:%M:%S')
  return {'dates':dates,'source':url}
 root=ET.fromstring(raw)
 layer=next(l for l in root.findall('.//Layer') if l.findtext('Name') in [name,key+':'+name])
 ext={e.get('name').lower():e for e in layer.findall('Extent')}
 dates=[d.strip() for d in ext['time'].text.split(',') if '/' not in d]
 for d in dates:datetime.fromisoformat(d.replace('Z','+00:00'))
 init=ext['initd'].get('default') if 'initd' in ext else None
 dates=[d for d in dates if not init or d>=init][-72:]
 b=layer.find('LatLonBoundingBox')
 return {'dates':dates,'init':init,'source':url,'layer':name,'bounds':[[float(b.get('miny')),float(b.get('minx'))],[float(b.get('maxy')),float(b.get('maxx'))]]}
def collect(key):
 url,_=SOURCES[key]
 if key!='inocar':url+='?service=WMS&version=1.1.1&request=GetCapabilities'
 try:
  with urllib.request.urlopen(url,timeout=25) as r:raw=r.read()
  return key,{**parse(key,raw),'retrievedAt':datetime.now(timezone.utc).isoformat()}
 except Exception as e:
  print(key,'retained previous metadata:',e);return key,None
if __name__=='__main__':
 data=json.loads(OUT.read_text()) if OUT.exists() else {'schema':1,'products':{}}
 with ThreadPoolExecutor(max_workers=3) as pool:
  for key,value in pool.map(collect,SOURCES):
   if value:data['products'][key]=value
 OUT.parent.mkdir(parents=True,exist_ok=True);OUT.write_text(json.dumps(data,ensure_ascii=False))
