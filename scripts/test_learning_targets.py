import copy
import unittest
from learning_targets import evaluate_antipodal

class TargetsTest(unittest.TestCase):
    def evaluate(self, **changes):
        r=dict(start=100,end=200,targets=[3,3.5,4,4.5,6],status="pending")
        r.update(changes)
        original=copy.deepcopy(r)
        events=[dict(id="valid",t=150,m=4.5,lat=0,lon=0),
                dict(id="before",t=99,m=7,lat=0,lon=0),
                dict(id="end",t=200,m=7,lat=0,lon=0),
                dict(id="outside",t=150,m=7,lat=2,lon=0)]
        evaluate_antipodal(r,events,("z","zone",0,0,100),lambda a,b,c,d:abs(c)*100,300)
        self.assertEqual(r["start"],original["start"])
        self.assertEqual(r["end"],original["end"])
        return r
    def test_list_targets_independent(self):
        r=self.evaluate()
        self.assertEqual([x["status"] for x in r["target_results"]],["response"]*4+["noResponse"])
        self.assertEqual([x["id"] for x in r["hits"]],["valid"])
        self.assertEqual(r["targets"],[3,3.5,4,4.5,6])
    def test_legacy_scalar(self):
        r=self.evaluate(targets=None,target=6)
        self.assertEqual(r["status"],"noResponse")
    def test_missing_not_invented(self):
        self.assertEqual(self.evaluate(targets=None)["status"],"unverifiable")
    def test_invalid_targets(self):
        for bad in ([],[None],[True],["4.5"],[float("nan")]):
            self.assertEqual(self.evaluate(targets=bad)["status"],"unverifiable")
if __name__=="__main__":unittest.main()
