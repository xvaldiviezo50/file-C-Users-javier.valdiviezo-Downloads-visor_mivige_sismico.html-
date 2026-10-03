import unittest
from collect_networks import normalize

class InventoryControls(unittest.TestCase):
    def feature(self, code='TEST', coords=None, red='GNSS'):
        return dict(type='Feature',geometry=dict(type='Point',coordinates=coords or [-75,-10]),properties=dict(codigo=code,red=red))
    def test_institution_error_is_not_empty_coverage(self):
        for data in [dict(error={'code':400}),dict(features=[],exceededTransferLimit=True),dict(features=[])]:
            with self.assertRaises(ValueError):normalize(data,'igp')
    def test_only_valid_gnss_and_deduplicated_locations(self):
        data=dict(features=[self.feature(),self.feature(),self.feature('SEIS',red='SISMICA'),self.feature('NULL',[None,-10]),self.feature('BAD',[999,-10])])
        result=normalize(data,'igp');self.assertEqual(len(result),1);self.assertEqual(result[0]['code'],'TEST')
    def test_sgc_native_fields(self):
        f=self.feature();f['properties']=dict(ID_cGNSS='ALPA',Sitio_cGNSS='Riohacha',Entidad_Red_cGNSS='SGC-GeoRED')
        result=normalize(dict(features=[f]),'geored')[0]
        self.assertEqual(result['code'],'ALPA');self.assertEqual(result['network'],'SGC-GeoRED')
if __name__=='__main__':unittest.main()
