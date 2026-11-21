import unittest,datetime as dt,math
import numpy as np
from physical_core import *

class PhysicalTests(unittest.TestCase):
    def test_coulomb_convention_tension_positive(self):
        self.assertAlmostEqual(cfs(np.eye(3)*1e6,32,55,90,.4),.4,places=10)
        n,s=vectors(35,70,-20)
        self.assertAlmostEqual(cfs((np.outer(s,n)+np.outer(n,s))*1e6,35,70,-20),1,places=10)
    def test_vectors_orthonormal(self):
        for a in (0,45,90,240):
            n,s=vectors(a,60,35)
            self.assertAlmostEqual(n@s,0);self.assertAlmostEqual(n@n,1);self.assertAlmostEqual(s@s,1)
    def test_tensor_coordinate_transform_and_units(self):
        p=dict(zip(['tensor-mrr','tensor-mtt','tensor-mpp','tensor-mrt','tensor-mrp','tensor-mtp'],[1e18,2e18,3e18,4e18,5e18,6e18]))
        np.testing.assert_allclose(moment_ned(p),np.array([[2,-6,4],[-6,3,-5],[4,-5,1]])*1e18)
        self.assertIsNone(moment_ned({}))
    def test_analytic_isotropic_source(self):
        x=np.array([100e3,20e3,40e3]);r=np.linalg.norm(x);nu=.25;m=1e18
        expected=(1-2*nu)*m/(4*math.pi*(1-nu))*(np.eye(3)/r**3-3*np.outer(x,x)/r**5)
        np.testing.assert_allclose(stress(np.eye(3)*m,x,nu),expected,rtol=2e-6)
    def test_rotation_and_inverse_cube(self):
        m=np.array([[0,1,0],[1,0,0],[0,0,0]])*1e18;x=np.array([100e3,20e3,50e3])
        q=np.array([[0,-1,0],[1,0,0],[0,0,1]])
        np.testing.assert_allclose(stress(q@m@q.T,q@x),q@stress(m,x)@q.T,rtol=1e-6,atol=1e-5)
        np.testing.assert_allclose(stress(m,2*x),stress(m,x)/8,rtol=1e-6)
        np.testing.assert_allclose(stress(-m,x),-stress(m,x),rtol=1e-6)
    def test_derivative_convergence(self):
        m=np.diag([1e18,-1e18,0]);x=[100e3,80e3,40e3]
        np.testing.assert_allclose(stress(m,x,step=1),stress(m,x,step=10),rtol=1e-5)
    def test_domain_no_fabricated_coulomb(self):
        src=dict(lat=0,lon=0,depth=10);z=dict(lat=0,lon=.01);rec=dict(strike=0,dip=20,rake=90);m=np.diag([1e18,-1e18,0])
        self.assertEqual(coulomb(src,z,rec,m)['status'],'near_source')
        self.assertEqual(coulomb(src,dict(lat=10,lon=0),rec,m)['status'],'outside')
        self.assertEqual(coulomb(src,z,rec,None)['status'],'missing')
    def test_gnss_velocity_change_and_stale_exclusion(self):
        end=20000.;series=[]
        for i in range(40):
            t=end-39+i;extra=max(0,t-(end-7))
            series.append(dict(date=dt.datetime.fromtimestamp(t*86400,dt.timezone.utc).date().isoformat(),mm=[i+2*extra,2*i,0]))
        st=dict(code='TEST',lat=0,lon=0,series=series,observed_at=series[-1]['date'],usable=True)
        r=station_change(st,end,end)
        np.testing.assert_allclose(r['deltaVelocityMmDay'],[2,0,0],atol=1e-10)
        self.assertTrue(r['fresh']);self.assertTrue(r['candidate']);self.assertAlmostEqual(r['azimuth'],90)
        old=station_change(st,end+30,end+30);self.assertFalse(old['fresh']);self.assertFalse(old['candidate'])
    def test_gnss_missing_is_not_zero(self):
        self.assertIsNone(station_change(dict(series=[]),20000,20000))
        self.assertIsNone(geodesy_zone(dict(lat=0,lon=0,r=100),[])['physicalDirection'])
    def test_geography_both_directions(self):
        self.assertAlmostEqual(geo(0,0,1,0)[1],0)
        self.assertAlmostEqual(geo(1,0,0,0)[1],180)
    def test_taup_known_reference(self):
        from obspy.taup import TauPyModel
        # Vertical path in the constant 5.8 km/s upper 20 km of iasp91.
        p=TauPyModel('iasp91').get_travel_times(10,0,phase_list=['p'])[0].time
        self.assertAlmostEqual(p,10/5.8,places=5)

if __name__=='__main__':unittest.main()

class DataBoundaryTests(unittest.TestCase):
    def test_shakemap_units_and_coverage(self):
        from collect_physical import amplitude
        grid=np.array([[0,0,1.0],[1,1,2.0]])
        r=amplitude(grid,dict(lat=0,lon=0))
        self.assertAlmostEqual(r['equivalentStressMPa'],.0945)
        self.assertEqual(r['status'],'modeled')
        self.assertEqual(amplitude(grid,dict(lat=10,lon=10))['status'],'outside')
        self.assertEqual(amplitude(None,dict(lat=0,lon=0))['status'],'missing')
    def test_publication_after_start_is_not_evaluated(self):
        from unittest.mock import patch
        import tempfile
        from pathlib import Path
        import collect_physical as p
        with tempfile.TemporaryDirectory() as t:
            root=Path(t);(root/'snap.gz').write_text('unused')
            i=dict(snapshot='snap.gz',start=1000,issuedAt=0,evaluations={})
            with patch.object(p,'ROOT',root),patch.object(p,'publication_time',return_value=2000),patch.object(p,'get_catalogue') as q:
                p.evaluate_windows(dict(issues=[i]),1000000)
                q.assert_not_called();self.assertEqual(i['status'],'INVALID_PUBLICATION')
