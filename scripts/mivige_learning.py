#!/usr/bin/env python3
import json, urllib.request, datetime, pathlib
root=pathlib.Path(__file__).resolve().parents[1]
out=root/"mivige-v2"/"data"/"learning-state.json"
try: state=json.loads(out.read_text())
except: state={"version":"persistent-learning-1","v1_frozen":True,"snapshots":[]}
url="https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_week.geojson"
with urllib.request.urlopen(url,timeout=30) as f: data=json.load(f)
now=datetime.datetime.now(datetime.timezone.utc).isoformat()
events=[x for x in data.get("features",[]) if x.get("properties",{}).get("mag") is not None]
m45=sum(1 for x in events if x["properties"]["mag"]>=4.5)
m60=sum(1 for x in events if x["properties"]["mag"]>=6.0)
state["v1_frozen"]=True
state["updated"]=now
state["snapshots"]=(state.get("snapshots",[])+[{"time":now,"catalog":"USGS weekly","events":len(events),"m45":m45,"m60":m60}])[-2160:]
state["learning_policy"]="Observe and recommend only. Never modify V1 weights, thresholds, or alerts automatically."
out.parent.mkdir(parents=True,exist_ok=True)
out.write_text(json.dumps(state,indent=2,ensure_ascii=False)+"\n")
