import unittest
import collect_automatic as m

class AutomaticTests(unittest.TestCase):
    def setUp(self):
        self.now=1800000000
        self.zone=dict(id='ec_n',name='test',country='Ecuador',lat=0,lon=-80,r=100)
    def event(self,time,mag=5,lat=0):
        return dict(id=str(time),time=time,mag=mag,lat=lat,lon=-80,depth=20)
    def test_missing_geodesy_never_becomes_negative_control(self):
        events=[self.event(self.now-(i+2)*m.DAY) for i in range(25)]
        state=m.assess(events,{},self.zone,self.now)
        records=m.issue([], [state],self.now,{},None)
        self.assertEqual(len(records),4)
        self.assertTrue(all(r['mechanism']=='actividad_sismica' for r in records))
        self.assertFalse(state['gnss']['available'])
    def test_stale_and_null_station_dates(self):
        g=dict(generated_at=m.iso(self.now),zones={'ec_n':{'used':['A','B','C']}},stations=[dict(code=c,usable=True,observed_at=None) for c in 'ABC'])
        self.assertFalse(m.gnss_for(g,self.zone,self.now)['available'])
        for s in g['stations']:s['observed_at']=m.iso(self.now-8*m.DAY)
        self.assertFalse(m.gnss_for(g,self.zone,self.now)['available'])
    def test_frozen_window_no_overlap(self):
        events=[self.event(self.now-(i+2)*m.DAY) for i in range(25)]
        state=m.assess(events,{},self.zone,self.now)
        records=m.issue([], [state],self.now,{},None)
        starts=[r['start'] for r in records]
        m.issue(records,[state],self.now+3600,{},None)
        self.assertEqual(len(records),4)
        self.assertEqual(starts,[r['start'] for r in records])
    def test_time_magnitude_and_location(self):
        r=dict(start=self.now,end=self.now+24*3600,target_mag=6,zone=self.zone,active=True,status='abierta')
        events=[self.event(self.now-1,7),self.event(self.now+1,5),self.event(self.now+2,7,5)]
        m.advance([r],events,self.now+25*3600,True,self.now-90*m.DAY)
        self.assertEqual(r['status'],'falsa_alarma')
    def test_outage_cannot_close_window(self):
        r=dict(start=self.now,end=self.now+3600,status='abierta')
        m.advance([r],[],self.now+7200,False,self.now-90*m.DAY)
        self.assertEqual(r['status'],'abierta')
    def test_empty_catalogue_does_not_emit(self):
        s=m.assess([],{},self.zone,self.now)
        self.assertEqual(m.issue([],[s],self.now,{},None),[])
    def test_all_four_outcomes(self):
        self.assertEqual([m.result(a,h) for a,h in [(True,True),(True,False),(False,True),(False,False)]],['coincidencia','falsa_alarma','omision','negativo_correcto'])
if __name__=='__main__':unittest.main()

