import unittest
import tempfile
from pathlib import Path
import gzip
import json
from unittest.mock import patch
import validate_ranking as v

class ProspectiveRules(unittest.TestCase):
    def setUp(self):
        self.zones=[dict(zone=dict(id='a',lat=0,lon=0,r=100,ord=1),score=50,history=[]),dict(zone=dict(id='b',lat=10,lon=0,r=100,ord=2),score=10,history=[])]
    def event(self, id='one', time=100, mag=4.5, lat=0, depth=20):
        return dict(id=id,time=time,mag=mag,lat=lat,lon=0,depth=depth)
    def test_prior_events_and_end_boundary_do_not_count(self):
        r=v.outcome(self.zones,[self.event(time=99),self.event(time=200)],100,200,4.5,['a'])
        self.assertEqual(r['confusion'],dict(TP=0,FP=1,FN=0,TN=1))
    def test_magnitude_targets_are_independent(self):
        es=[self.event()]
        self.assertEqual(v.outcome(self.zones,es,100,200,4.5,['a'])['confusion']['TP'],1)
        self.assertEqual(v.outcome(self.zones,es,100,200,6,['a'])['confusion']['FP'],1)
    def test_omissions_are_retained_and_ids_deduplicated(self):
        e=self.event(lat=10)
        r=v.outcome(self.zones,[e,e],100,200,4.5,['a'])
        self.assertEqual(r['confusion']['FN'],1)
        self.assertEqual(r['zones'][1]['eventIds'],['one'])
    def test_depth_missing_is_not_assumed_in_zone(self):
        self.zones[0]['zone']['depth']=[0,40]
        self.assertFalse(v.inside(self.event(depth=None),self.zones[0]['zone']))
        self.assertFalse(v.inside(self.event(depth=60),self.zones[0]['zone']))
    def test_baseline_uses_only_past_target_events(self):
        self.zones[0]['history']=[self.event(time=110,mag=7)]
        self.zones[1]['history']=[self.event(time=90,lat=10)]
        self.assertEqual(v.baseline(self.zones,100,4.5,1),['b'])
    def test_publication_lead(self):
        for now in (0,5*v.HOUR,6*v.HOUR-1,6*v.HOUR):
            self.assertGreaterEqual(v.next_start(now)-now,v.HOUR)
    def test_catalogue_failure_never_marks_negative(self):
        issue=dict(snapshot='not-yet-published.json.gz',start=0,issuedAt=0,evaluations={})
        with patch.object(v,'publication_time',return_value=None),patch.object(v,'get_catalogue') as query:
            v.evaluate_pending(dict(issues=[issue]),100*v.HOUR)
            query.assert_not_called()
            self.assertEqual(issue['evaluations'],{})

    def test_outage_keeps_closed_window_pending(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);snapshot={'capture':{'zones':self.zones}}
            with gzip.open(root/'snapshot.gz','wt') as f: json.dump(snapshot,f)
            issue=dict(snapshot='snapshot.gz',start=10*v.HOUR,issuedAt=0,evaluations={},inputHash=v.digest(snapshot))
            with patch.object(v,'ROOT',root),patch.object(v,'publication_time',return_value=v.HOUR),patch.object(v,'get_catalogue',side_effect=OSError('outage')):
                v.evaluate_pending(dict(issues=[issue]),200*v.HOUR)
            self.assertEqual(issue['status'],'PENDING')
            self.assertEqual(issue['evaluations'],{})
            self.assertEqual(issue['evaluationError'],'outage')
    def test_late_publication_is_excluded(self):
        issue=dict(snapshot='snapshot.gz',start=v.HOUR,issuedAt=0,evaluations={})
        with patch.object(v,'publication_time',return_value=2*v.HOUR),patch.object(v,'get_catalogue') as query:
            v.evaluate_pending(dict(issues=[issue]),200*v.HOUR)
            query.assert_not_called()
        self.assertEqual(issue['status'],'INVALID_PUBLICATION')

if __name__=='__main__': unittest.main()
