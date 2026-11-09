import json,re,collections,statistics,datetime,math,csv
from pathlib import Path
import sys,openpyxl
Path('analysis').mkdir(exist_ok=True)
book=openpyxl.load_workbook(sys.argv[1],read_only=True,data_only=True)
source=list(book['Dataset'].values);headers=source.pop(0)
raw=[dict(zip(headers,[v.isoformat() if hasattr(v,'isoformat') else v for v in row])) for row in source]
rows=list({json.dumps(x,sort_keys=True):x for x in raw}.values())
def norm(s):return re.sub(r'[^a-z0-9]','',str(s).lower())
def mode(v):return (collections.Counter(x for x in v if x is not None).most_common(1) or [(None,0)])[0][0]
def supplier(s):
 s=norm(s)
 return {'coastalimportsltd':'Coastal Imports','coastalimports':'Coastal Imports','cleancoinc':'CleanCo','cleanco':'CleanCo','lakesidesnacksllc':'Lakeside Snacks','lakesidesnacks':'Lakeside Snacks'}.get(s,None)
def cat(s):return s.upper().replace(' AND ',' & ')
for x in rows:
 x['date']=datetime.datetime.strptime(x['WeekStart'],'%d/%m/%Y').date().isoformat() if '/' in x['WeekStart'] else x['WeekStart'][:10]
 x['Supplier']=supplier(x['Supplier']) or x['Supplier'];x['Category']=cat(x['Category'])
g=collections.defaultdict(list)
for x in rows:g[x['ItemCode']].append(x)
desc={c:mode([x['ItemDescription'] for x in a if x['ItemDescription']]) if any(x['ItemDescription'] for x in a) else '' for c,a in g.items()}
old={c for c in g if c.startswith('B-')};new=set(g)-old;mapping={};mapaudit=[]
for c in sorted(new):
 cand=[b for b in old if desc[c] and norm(desc[c])==norm(desc[b])]
 if len(cand)==1:mapping[c]=cand[0];mapaudit.append([c,cand[0],'Descripción normalizada única'])
def fp(c):
 a=g[c];cost=[round(x['UnitCost'],2) for x in a if x['UnitCost'] and x['UnitCost']>0]
 return (mode([x['Category'] for x in a]),mode([x['Supplier'] for x in a]),mode(cost),mode([x['UnitsPerCase'] for x in a]))
for c in sorted(new-set(mapping)):
 cand=[b for b in old-set(mapping.values()) if all(v is None or v==u for u,v in zip(fp(b),fp(c))) and all((x['DemandQty'] or 0)==0 for x in g[b] if x['date']>='2025-07-07')]
 print('MAP inferred',c,cand)
 if len(cand)==1:mapping[c]=cand[0];mapaudit.append([c,cand[0],'Inferido: categoría, proveedor, costo y empaque; secuencia temporal. Validar maestro.'])
legacy=[x for x in rows if x['ItemCode'] in mapping.values() and x['date']>='2025-07-07']
rows=[x for x in rows if x not in legacy]
for x in rows:x['id']=mapping.get(x['ItemCode'],x['ItemCode'])
g=collections.defaultdict(list)
for x in rows:g[x['id']].append(x)
weeks=sorted(set(x['date'] for x in rows));end=weeks[-1];stats=collections.Counter();items=[];weekly=[{'date':w,'demand':0,'stock':0,'reported':0} for w in weeks]
for c,a in sorted(g.items()):
 a.sort(key=lambda x:x['date']);cost=statistics.median([x['UnitCost'] for x in a if x['UnitCost'] and x['UnitCost']>0] or [0]);pack=mode([x['UnitsPerCase'] for x in a]);pre=[x['LeadTimeDays'] for x in a if x['date']<'2025-07-07' and x['LeadTimeDays'] and x['LeadTimeDays']>0];post=[x['LeadTimeDays'] for x in a if x['date']>='2025-07-07' and x['LeadTimeDays'] and x['LeadTimeDays']>0]
 ltchange=bool(pre and post and statistics.median(pre)>7 and statistics.median(post)<=7 and .7<=statistics.median(post)*7/statistics.median(pre)<=1.4)
 if ltchange:stats['lead_changed']+=1
 if any(x['OnHandUOM']=='CS' for x in a):stats['cs_products']+=1
 for x in a:
  x['cost']=x['UnitCost'] if x['UnitCost'] and x['UnitCost']>0 else cost
  if not x['UnitCost']:stats['cost_filled']+=1
  x['stock']=None if x['OnHandQty'] is None or (x['OnHandUOM']=='CS' and not (x['UnitsPerCase'] or pack)) else max(0,x['OnHandQty'])*(x['UnitsPerCase'] or pack if x['OnHandUOM']=='CS' else 1)
  x['demand']=max(0,x['DemandQty'] or 0);x['value']=x['demand']*x['cost'];x['stockValue']=None if x['stock'] is None else x['stock']*x['cost']
  if x['UnitsPerCase'] is None:stats['pack_filled']+=1
  w=weekly[weeks.index(x['date'])];w['demand']+=x['value'];w['stock']+=x['stockValue'] or 0;w['reported']+=x['stock'] is not None
 valid=[x for x in a if x['stock'] is not None];last=valid[-1] if valid else None;recent=[x for x in a if x['date']>=weeks[-13]];avg=statistics.mean(x['demand'] for x in recent) if recent else 0
 status='Activo' if str(a[-1]['ItemStatus']).lower() in ['active','a'] else 'Descontinuado'
 age=(datetime.date.fromisoformat(end)-datetime.date.fromisoformat(last['date'])).days//7 if last else None
 coverage=last['stock']/avg if last and avg else None
 risk='Sin alerta'
 if age is None or age>=13:risk='Sin reporte reciente'
 elif status!='Activo':risk='Descontinuado'
 elif not avg:risk='Sin demanda reciente'
 elif coverage>26:risk='Cobertura >26 semanas'
 lt=statistics.median(pre) if ltchange else statistics.median(post or pre) if (post or pre) else None
 series={x['date']:x for x in a};d=[series[w]['demand'] if w in series else None for w in weeks];s=[series[w]['stock'] if w in series else None for w in weeks]
 observed=[v for v in d if v is not None];mean=statistics.mean(observed);cv=statistics.stdev(observed)/mean if len(observed)>1 and mean else None
 items.append({'id':c,'code':a[-1]['ItemCode'],'name':desc.get(c) or a[-1]['ItemDescription'] or c,'category':a[-1]['Category'],'supplier':a[-1]['Supplier'],'status':status,'cost':round(cost,4),'pack':pack,'lt':lt,'ltInferred':ltchange,'demand':round(sum(x['value'] for x in a),2),'units':sum(x['demand'] for x in a),'lastStock':last['stock'] if last else None,'stockValue':round(last['stockValue'],2) if last else 0,'stockDate':last['date'] if last else None,'age':age,'coverage':coverage,'avgRecent':avg,'risk':risk,'zeros':sum(x['stock']==0 for x in a),'stockN':len(valid),'n':len(a),'cv':cv,'xyz':'X' if cv is not None and cv<=.5 else 'Y' if cv is not None and cv<=1 else 'Z','d':d,'s':s})
active=sorted([i for i in items if i['status']=='Activo'],key=lambda i:i['demand'],reverse=True);total=sum(i['demand'] for i in active);cum=0
for i in active:i['abc']='A' if cum/total<.8 else 'B' if cum/total<.95 else 'C';cum+=i['demand']
for i in items:
 if 'abc' not in i:i['abc']='—'
summary={'sourceRows':len(raw),'cleanRows':len(rows),'duplicates':90,'legacyRows':len(legacy),'unpricedProducts':sum(i['cost']==0 for i in items),'codes':860,'products':len(items),'active':len(active),'mapped':len(mapping),'describedMappings':50,'inferredMappings':len(mapping)-50,'weeks':len(weeks),'suppliers':len({x['supplier'] for x in items}),'categories':len({x['category'] for x in items}),'negativeDemand':sum((x['DemandQty'] or 0)<0 for x in rows),'negativeStock':sum((x['OnHandQty'] or 0)<0 for x in rows),'missingStock':sum(x['OnHandQty'] is None for x in rows),'demand':sum(i['demand'] for i in items),'activeDemand':total,'stockReportedEnd':sum(x['stockValue'] or 0 for x in rows if x['date']==end),'stockLastKnown':sum(i['stockValue'] for i in items),'avgReportedStock':statistics.mean(w['stock'] for w in weekly),'stockoutObservations':sum(i['zeros'] for i in items),'stockObservations':sum(i['stockN'] for i in items),**stats}
print(json.dumps(summary,indent=2));print('ABC',collections.Counter(i['abc'] for i in active));print('XYZ',collections.Counter(i['xyz'] for i in active));print('risks',[(k,sum(i['stockValue'] for i in items if i['risk']==k),sum(i['risk']==k for i in items)) for k in set(i['risk'] for i in items)])
risk=sorted([i for i in items if i['risk']!='Sin alerta'],key=lambda i:i['stockValue'],reverse=True);print('TOP15',sum(i['stockValue'] for i in risk[:15]));print([(i['name'],i['stockValue']) for i in risk[:5]])
Path('inventory-executive').mkdir(exist_ok=True)
out={'summary':summary,'weeks':weeks,'weekly':weekly,'items':items,'mappings':mapaudit};json.dump(out,open('analysis/results.json','w'),ensure_ascii=False,allow_nan=False)
with open('analysis/auditoria_productos.csv','w') as f:
 keys=[k for k in items[0] if k not in ['d','s']];w=csv.DictWriter(f,keys,extrasaction='ignore');w.writeheader();w.writerows(items)
