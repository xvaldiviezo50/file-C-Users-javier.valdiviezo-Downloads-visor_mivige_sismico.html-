"""Exploratory physics, SI units; deliberately independent of MIVIGE's score."""
import math
import numpy as np

VERSION = 'physical-scenarios-1'

def finite(x):
    return isinstance(x, (int,float)) and math.isfinite(x)

def geo(lat1,lon1,lat2,lon2):
    a,b=map(math.radians,(lat1,lat2));dl=math.radians(lon2-lon1)
    h=math.sin((b-a)/2)**2+math.cos(a)*math.cos(b)*math.sin(dl/2)**2
    distance=6371*2*math.asin(min(1,math.sqrt(h)))
    az=math.degrees(math.atan2(math.sin(dl)*math.cos(b),math.cos(a)*math.sin(b)-math.sin(a)*math.cos(b)*math.cos(dl)))%360
    return distance,az

def moment_ned(properties):
    keys=['tensor-mrr','tensor-mtt','tensor-mpp','tensor-mrt','tensor-mrp','tensor-mtp']
    try:
        vals=[float(properties[k]) for k in keys]
        if not all(math.isfinite(v) for v in vals): return None
    except (KeyError,ValueError,TypeError): return None
    rr,tt,pp,rt,rp,tp=vals
    # USGS r,t,p = up,south,east; output north,east,down. Units N m.
    return np.array([[tt,-tp,rt],[-tp,pp,-rp],[rt,-rp,rr]])

def displacement(moment,x,nu=.25,mu=30e9):
    """-M_jk dG_ij/dx_k, Kelvin infinite-space Green tensor. m."""
    x=np.asarray(x,dtype=float);r=np.linalg.norm(x)
    if r<=0: raise ValueError('Source singularity')
    return ((2-4*nu)*(moment@x)-np.trace(moment)*x+3*x*(x@moment@x)/r**2)/(16*math.pi*mu*(1-nu)*r**3)

def stress(moment,x,nu=.25,step=None):
    """Symmetric Cauchy stress; tension positive, Pa. Central derivative."""
    x=np.asarray(x,dtype=float);h=step or max(1.,np.linalg.norm(x)*1e-4);mu=30e9
    grad=np.column_stack([(displacement(moment,x+np.eye(3)[j]*h,nu,mu)-displacement(moment,x-np.eye(3)[j]*h,nu,mu))/(2*h) for j in range(3)])
    strain=(grad+grad.T)/2
    return 2*mu*strain+(2*mu*nu/(1-2*nu))*np.trace(strain)*np.eye(3)

def vectors(strike,dip,rake):
    p,d,l=map(math.radians,(strike,dip,rake))
    normal=np.array([-math.sin(d)*math.sin(p),math.sin(d)*math.cos(p),-math.cos(d)])
    slip=np.array([math.cos(l)*math.cos(p)+math.cos(d)*math.sin(l)*math.sin(p),math.cos(l)*math.sin(p)-math.cos(d)*math.sin(l)*math.cos(p),-math.sin(l)*math.sin(d)])
    return normal,slip

def cfs(tensor,strike,dip,rake,friction=.4):
    n,s=vectors(strike,dip,rake);traction=tensor@n
    return float(s@traction+friction*(n@traction))/1e6

def coulomb(source,zone,receiver,moment):
    if moment is None: return dict(status='missing',reason='Sin tensor de momento USGS completo')
    if receiver is None: return dict(status='missing',reason='Sin orientación receptora de escenario')
    if not finite(source.get('depth')) or source['depth']<0: return dict(status='missing',reason='Profundidad de fuente no válida')
    dist,az=geo(source['lat'],source['lon'],zone['lat'],zone['lon'])
    if dist>500: return dict(status='outside',reason='Fuera del dominio local de 500 km del modelo estático')
    m0=float(np.linalg.norm(moment)/math.sqrt(2))
    if m0<=0:return dict(status='missing',reason='Tensor nulo')
    # Conservative point-source exclusion, circular crack with assumed 0.1 MPa drop.
    radius=(7*m0/(16*1e5))**(1/3)/1000
    depths=zone.get('depth')
    depths=[depths[0],sum(depths)/2,depths[1]] if depths else [10,20,40]
    positions=[np.array([dist*math.cos(math.radians(az))*1000,dist*math.sin(math.radians(az))*1000,(d-source['depth'])*1000]) for d in depths]
    if min(np.linalg.norm(x) for x in positions)<max(30,3*radius)*1000:
        return dict(status='near_source',reason='Demasiado cerca de la ruptura: requiere fuente finita',sourceRadiusAssumedKm=radius)
    values=[]
    for x in positions:
        for nu in (.20,.25,.30):
            sig=stress(moment,x,nu)
            for ds in (-20,0,20):
                for dd in (-10,0,10):
                    for dr in (-20,0,20):
                        for friction in (.2,.4,.6):
                            values.append(cfs(sig,receiver['strike']+ds,max(1,min(89,receiver['dip']+dd)),receiver['rake']+dr,friction))
    mid=stress(moment,positions[1]);value=cfs(mid,receiver['strike'],receiver['dip'],receiver['rake'])
    lo,hi=min(values),max(values)
    sign='positive' if lo>0 else 'negative' if hi<0 else 'mixed'
    return dict(status='scenario',valueMPa=value,minMPa=lo,maxMPa=hi,sign=sign,samples=len(values),receiver=receiver,depthsKm=depths,sourceRadiusAssumedKm=radius,
        uncertainty='Rango de sensibilidad a geometría, profundidad, Poisson y fricción; no intervalo de confianza. No incluye error del tensor ni de la estructura terrestre.',model='Fuente puntual, espacio elástico infinito; sin superficie libre. Orientación receptora supuesta, no falla identificada.')

def regression(rows,k):
    t=np.array([r[0] for r in rows]); y=np.array([r[1][k] for r in rows]);t=t-t.mean();ss=float(t@t)
    if len(rows)<3 or ss<=0:raise ValueError('Insufficient epochs')
    b=float(t@(y-y.mean())/ss);res=y-y.mean()-b*t
    se=math.sqrt(float(res@res)/(len(rows)-2)/ss)
    return b,se

def station_change(station,now_days,snapshot_days):
    import datetime as dt
    def day(s):return dt.datetime.fromisoformat(s.replace('Z','+00:00')).timestamp()/86400
    try:
        rows=sorted({day(r['date']):r['mm'] for r in station.get('series',[]) if len(r.get('mm',[]))==3 and all(finite(v) for v in r['mm'])}.items())
    except (ValueError,TypeError):return None
    rows=[r for r in rows if r[0]<=now_days]
    if not rows:return None
    end=rows[-1][0];before=[r for r in rows if end-28<=r[0]<=end-7];after=[r for r in rows if end-7<r[0]<=end]
    if len(before)<14 or len(after)<5 or after[-1][0]-after[0][0]<4:return None
    change=[];errors=[]
    for k in range(3):
        b,e=regression(before,k);a,f=regression(after,k);change.append(a-b);errors.append(math.hypot(e,f))
    fresh=0<=now_days-end<=7 and 0<=now_days-snapshot_days<=2 and station.get('usable') is True
    norm=math.hypot(*change[:2]);noise=math.hypot(*errors[:2])
    return dict(code=station['code'],lat=station['lat'],lon=station['lon'],observed_at=station['observed_at'],fresh=fresh,deltaVelocityMmDay=change,standardErrorMmDay=errors,
        azimuth=(math.degrees(math.atan2(change[0],change[1]))%360) if norm>0 else None,horizontal=norm,candidate=fresh and norm>max(2*noise,1e-9),
        nBefore=len(before),nAfter=len(after),attribution='Cambio aparente; estacionalidad, carga hidrológica, offsets y ruido correlacionado no corregidos. No demuestra deslizamiento lento.')

def geodesy_zone(zone,stations):
    local=[s for s in stations if geo(zone['lat'],zone['lon'],s['lat'],s['lon'])[0]<=zone['r']]
    current=[s for s in local if s['fresh']];signals=[s for s in current if s['candidate']]
    coherence=None;azimuth=None
    if len(signals)>=3:
        east=sum(s['deltaVelocityMmDay'][0]/s['horizontal'] for s in signals)/len(signals)
        north=sum(s['deltaVelocityMmDay'][1]/s['horizontal'] for s in signals)/len(signals)
        coherence=math.hypot(east,north)
        if coherence>=.7:azimuth=math.degrees(math.atan2(east,north))%360
    return dict(stations=[s['code'] for s in local],fresh=len(current),candidates=len(signals),coherence=coherence,azimuth=azimuth,
        status='coincident_change' if azimuth is not None else 'available' if len(current)>=3 else 'insufficient',
        physicalDirection=None,reason='Dirección del cambio de velocidad de estaciones; inversión de deslizamiento pendiente')
