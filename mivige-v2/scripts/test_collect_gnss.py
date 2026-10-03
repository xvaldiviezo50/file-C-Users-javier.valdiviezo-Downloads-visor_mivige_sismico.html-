import unittest
import collect_gnss as g

class ScientificControls(unittest.TestCase):
    def test_integer_origin_and_quality(self):
        text='X 26JAN01 2026 61041 0 0 0 123 0.75 456 -0.25 10 0.5 0 .001 .002 .003'
        rows=g.parse(text,now=1767312000)
        self.assertEqual(len(rows),1)
        self.assertEqual(next(iter(rows.values()))['enu'],[123.75,455.75,10.5])
        self.assertEqual(g.parse(text.replace('.001','nan'),now=1767312000),{})
    def rows(self,jump=0):
        now=1800000000
        return now,{now-i*g.DAY:dict(t=now-i*g.DAY,enu=[-.001*i+(jump if i<7 else 0),-.002*i,0],sigma=[.001,.001,.003]) for i in range(130)}
    def test_trend_not_anomaly(self):
        now,rows=self.rows();r=g.diagnose(rows,now)
        self.assertTrue(r['usable']);self.assertFalse(r['candidate'])
    def test_step_candidate_not_prediction(self):
        now,rows=self.rows(.020);r=g.diagnose(rows,now)
        self.assertTrue(r['candidate']);self.assertGreater(r['delta_mm'][0],19)
    def test_stale_and_sparse(self):
        now,rows=self.rows();self.assertFalse(g.diagnose(rows,now+8*g.DAY)['usable'])
        self.assertFalse(g.diagnose(dict(list(rows.items())[:5]),now)['usable'])
    def test_overlap_offset_not_deformation(self):
        now,final=self.rows();rapid={t:dict(r,enu=[x+.1 for x in r['enu']]) for t,r in final.items()}
        merged,_,aligned=g.merge(final,rapid)
        self.assertTrue(aligned);self.assertEqual(len(merged),len(final));self.assertFalse(g.diagnose(merged,now)['candidate'])

if __name__=='__main__':unittest.main()
