(function(){
  try{
    if(typeof zonesExt==='undefined' || typeof allZones==='undefined') return;
    if(!zonesExt.some(z=>z.id==='loreto_andoas_intraslab')){
      const z={
        id:'loreto_andoas_intraslab',
        name:'Loreto–Andoas–Datem del Marañón · intraslab',
        lat:-3.20,
        lon:-77.10,
        radius:150,
        base:0.55,
        depthMin:70,
        depthMax:150,
        why:'Corredor intraslab de la placa de Nazca subducida · solo 70–150 km'
      };
      zonesExt.push(z);
      allZones.push(z);
    }
  }catch(err){console.warn('No se pudo añadir corredor intraslab Loreto-Andoas',err);}
})();