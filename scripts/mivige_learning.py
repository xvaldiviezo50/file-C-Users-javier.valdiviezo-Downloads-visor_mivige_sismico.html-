#!/usr/bin/env python3
import json,urllib.request,datetime,pathlib,math,time
from learning_targets import evaluate_antipodal
ROOT=pathlib.Path(__file__).resolve().parents[1]; OUT=ROOT/"mivige-v2"/"data"/"learning-state.json"; H=3600000; D=24*H
Z=[("cl_c","Chile central",-32,-71.5,360),("cl_n","Chile norte",-21,-70,430),("pe_s","Perú sur",-16,-72,430),("pe_c","Perú central",-11.5,-76,430),("pe_n","Perú norte",-6,-80,430),("ec_s","Ecuador sur · Golfo/El Oro",-3.2,-80.4,360),("ec_az","Ecuador · Azuay/intraslab",-2.9,-79,280),("ec_c","Ecuador centro · Manabí",-1,-80.4,350),("ec_n","Ecuador norte · Esmeraldas",1,-79.5,350),("co_p","Colombia Pacífico · Nariño/Cauca",3,-78,400),("co_ch","Colombia · Chocó",6,-77,400),("ven","Venezuela costera",10.5,-66.5,650)]
def dist(a,b,c,d):
 k=math.pi/180;q=math.sin((c-a)*k/2)**2+math.cos(a*k)*math.cos(c*k)*math.sin((d-b)*k/2)**2
 return 12742*math.asin(min(1,math.sqrt(q)))
def load():
 try:return json.loads(OUT.read_text())
 except:return {"version":"persistent-learning-2","v1_frozen":True,"snapshots":[],"windows":[],"candidates":{}}
def feed():
 u="https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_week.geojson"
 with urllib.request.urlopen(u,timeout=30) as f:j=json.load(f)
 return [{"id":x["id"],"t":x["properties"]["time"],"m":x["properties"]["mag"],"lat":x["geometry"]["coordinates"][1],"lon":x["geometry"]["coordinates"][0],"dep":x["geometry"]["coordinates"][2]} for x in j["features"] if x["properties"]["mag"] is not None]
now=int(time.time()*1000); ev=feed(); s=load(); windows=s.get("windows",[]); anti=s.get("antipode_learning",[])
# Antipodal M>6.0: new windows only; preserve all historical records and frozen V1.
def antipode(lat,lon): return (-lat, lon+180 if lon<0 else lon-180)
known={x["key"] for x in anti}
for e in ev:
 if not (e["m"]>6.0): continue
 alat,alon=antipode(e["lat"],e["lon"])
 for zid,zname,zlat,zlon,zr in Z:
  ad=dist(alat,alon,zlat,zlon)
  if ad>560: continue
  band="core" if ad<=225 else "halo"
  for hours in (24,72):
   key=e["id"]+"|"+zid+"|"+str(hours)
   if key not in known:
    anti.append({"key":key,"source_id":e["id"],"source_mag":e["m"],"source_time":e["t"],"source_depth":e["dep"],"source_lat":e["lat"],"source_lon":e["lon"],"antipode_lat":round(alat,4),"antipode_lon":round(alon,4),"zone":zid,"name":zname,"distance_antipode_km":round(ad,1),"band":band,"hours":hours,"start":e["t"],"end":e["t"]+hours*H,"targets":[3.0,3.5,4.0,4.5,6.0],"status":"pending","hits":[],"track":"antipodal-gt6-v2"});known.add(key)
for a in anti:
 if a["status"]!="pending" or now<a["end"]: continue
 z=next((q for q in Z if q[0]==a["zone"]),None)
 if not z: continue
 evaluate_antipodal(a,ev,z,dist,now)
# Mature previously frozen windows. Weekly feed supports the 72 h horizons used here.
for w in windows:
 if w["status"]!="pending" or now<w["end"]:continue
 hits=[e for e in ev if w["start"]<=e["t"]<w["end"] and e["m"]>=w["target"] and dist(w["lat"],w["lon"],e["lat"],e["lon"])<=w["radius"]]
 w["hits"]=[{"id":e["id"],"m":e["m"],"t":e["t"]} for e in hits]; observed=bool(hits)
 w["status"]="coincidence" if w["active"] and observed else "falseAlarm" if w["active"] else "omission" if observed else "correctNegative";w["evaluated"]=now
snap={"time":now,"zones":{}}
for id,name,lat,lon,r in Z:
 a=[e for e in ev if now-e["t"]<=D and dist(lat,lon,e["lat"],e["lon"])<=r]
 b=[e for e in ev if D<now-e["t"]<=7*D and dist(lat,lon,e["lat"],e["lon"])<=r]
 rate=len(a)/max(1/6,len(b)/6); ids=min(100,max(0,48*max(0,math.log(max(.5,rate),2)/2.5)))
 sources=[]
 for e in ev:
  age=now-e["t"];dd=dist(lat,lon,e["lat"],e["lon"])
  ok=(e["m"]>=5 and dd<=1200) or (e["m"]>=5.5 and dd<=3000) or (e["m"]>=6 and dd<=8000) or e["m"]>=6.5
  if age<=7*D and ok:sources.append((e,dd))
 src=max(sources,key=lambda q:q[0]["m"]-.0001*q[1]) if sources else None
 source=0 if not src else max(0,min(100,100*(src[0]["m"]-5)/2.5))*max(.15,1-(now-src[0]["t"])/(7*D))
 # Persistent server proxy: only components reproducible from public catalogue; no invented GNSS/dynamic values.
 score=(.45*ids+.25*source)/.70
 level="ALTA" if score>=65 else "MEDIA" if score>=40 else "BAJA"
 snap["zones"][id]={"name":name,"score_proxy":round(score,1),"level_proxy":level,"coverage":70,"ids_proxy":round(ids,1),"rate_ratio":round(rate,2),"source_proxy":round(source,1),"note":"server proxy; V1 browser remains authoritative"}
 active=score>=40
 for hours in (24,72):
  for target in (4.5,6.0):
   if not any(w["zone"]==id and w["hours"]==hours and w["target"]==target and w["status"]=="pending" for w in windows):
    windows.append({"version":"persistent-v2","zone":id,"name":name,"lat":lat,"lon":lon,"radius":r,"start":now,"end":now+hours*H,"hours":hours,"target":target,"active":active,"score_at_issue":round(score,1),"status":"pending","hits":[]})
s["version"]="persistent-learning-3";s["v1_frozen"]=True;s["antipode_learning"]=anti[-20000:];s["antipode_metrics"]={"pending":sum(x["status"]=="pending" for x in anti),"response":sum(x["status"]=="response" for x in anti),"noResponse":sum(x["status"]=="noResponse" for x in anti)};s["updated"]=now;s["snapshots"]=(s.get("snapshots",[])+[snap])[-2160:];s["windows"]=windows[-20000:]
closed=[w for w in windows if w["status"]!="pending"]; s["metrics"]={k:sum(w["status"]==k for w in closed) for k in ("coincidence","falseAlarm","omission","correctNegative")}
s["learning_policy"]="Observe, validate and recommend only. Never modify V1 weights, thresholds or alerts automatically."
OUT.parent.mkdir(parents=True,exist_ok=True);OUT.write_text(json.dumps(s,ensure_ascii=False,indent=2)+"\n")
