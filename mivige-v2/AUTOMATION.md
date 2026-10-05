# Automatización MIVIGE — integración sobre build 3079

## Funcionamiento instalado
La integración conserva íntegros el ranking, Coulomb, seguimiento persistente y capas del build 3079. Este recolector es un protocolo independiente de asociaciones y sus resultados no deben sumarse a los del ranking ni cambiar sus pesos.
- GNSS: workflow existente cada 6 h, NGL IGS20 final/rápido; disponibilidad y antigüedad por estación.
- Nuevo workflow cada hora: catálogo ComCat regional M≥4,5 de 90 días; consulta de productos momento tensor, mecanismo focal y ruptura finita para eventos M≥5 de los últimos 7 días, máximo 30.
- Guarda catálogo, fecha, URL y SHA256. Cada ventana conserva parámetros, evidencia y lista de eventos usados antes del resultado.
- Archivo central automatic-ledger.json versionado en git, accesible desde cualquier dispositivo. No es un registro inmutable ni una validación independiente.
- No requiere llenar un formulario ni mantener abierto el visor. Los cron de GitHub pueden retrasarse o desactivarse por inactividad del repositorio.
- Consulta de salud de endpoints nacionales, sin mezclar sus muestras parciales con la base ComCat para las ventanas nuevas. Los catálogos nacionales del mapa continúan independientes.
- Regla exploratoria: fondo 89 días con ≥20 eventos M≥4,5; últimos 24 h con ≥3 y tasa ≥3 veces el fondo. Se emiten señal o control según la regla, en 24/72 h y M≥4,5/M≥6.
- Combinación GNSS solo si hay ≥3 estaciones con datos vigentes y snapshot <48 h; exige coincidencia del tamiz geodésico existente para señal positiva. Sin GNSS suficiente no se emite control negativo geodésico.
- No hay dirección física inferida de epicentros, probabilidades calibradas, modelo Coulomb, inversión de deslizamiento ni corrección hidrológica/estacional completa.
- M≥4,5 es un umbral de selección, no una magnitud de completitud demostrada. El catálogo global puede omitir eventos nacionales. Los resultados se refieren a este catálogo y a la versión de la regla, no a toda la sismicidad.
- La evaluación se realiza al cerrar la ventana; resultados provisionales por revisiones de catálogo. Si la ejecución falla no se evalúa ni emite. Si se pierde cobertura histórica, no evaluable.
- Zonas superpuestas y horizontes comparten eventos: no sumar coincidencias como evidencia independiente.
- Las ventanas manuales previas permanecen en el almacenamiento del navegador; esta capa no las usa ni las migra.

## Fuentes revisadas y límites de acceso

| Fuente | Enlace | Datos y estado |
|---|---|---|
| USGS ComCat | https://earthquake.usgs.gov/fdsnws/event/1/ | API pública integrada; catálogo y consulta de productos físicos publicados. Publicación desigual por evento. |
| NGL | https://geodesy.unr.edu/gps_timeseries/IGS20/tenv3/IGS20/ | Series ENU procesadas integradas por el colector GNSS existente. No son datos en tiempo real. |
| IG-EPN RENGEO | https://igepn.edu.ec/ | Red geodésica e informes científicos; no se ha verificado en esta revisión un endpoint abierto de series ENU continuas. |
| IGM REGME | https://www.geoportaligm.gob.ec/portal_geodesia/ | Inventario público ya integrado. Descarga RINEX https://www.geoportaligm.gob.ec/downloads/public/ solicita cuenta gratuita; no integrada como series numéricas directas. |
| SGC GeoRED | https://geored2.sgc.gov.co/redgnss/Paginas/Series-de-tiempo.aspx | Inventario integrado; enlaces consultados a gráficos PDF, no API ENU validada. |
| IGP Perú | https://ide.igp.gob.pe/ | Inventario GNSS integrado; observaciones ENU directas pendientes. No confundir IGP con la red geodésica IGN. |
| SIRGAS | https://www.sirgas.org/es/sirgas-realizations/sirgas-con-network/ | Red/soluciones de referencia y metadatos; integración de soluciones pendiente. |
| Chile CSN | https://www.csn.uchile.cl/centro-sismologico-nacional/politica-datos/ | Publica política de datos RINEX en gps.csn.uchile.cl; descarga y procesamiento PPP propios pendientes. |
| Global CMT | https://www.globalcmt.org/CMTfiles.html | NDK histórico y Quick CMT; fuente identificada, no parser incorporado. |
| Slab2 | https://www.usgs.gov/data/slab2-a-comprehensive-subduction-zone-geometry-model | Geometría de subducción; pendiente incorporar malla y selección de receptores. No proporciona deslizamiento actual. |
| EarthScope | https://service.earthscope.org/fdsnws/dataselect/1/ | Ondas miniSEED y metadatos; descarga/calibración/estimación de esfuerzo dinámico pendientes. |
| ASF HyP3 | https://hyp3-docs.asf.alaska.edu/using/authentication/ | InSAR bajo autenticación Earthdata y procesamiento. No integrado; nunca se interpreta como ausencia de deformación. |
| Venezuela | https://www.funvisis.gob.ve/ | No se verificó un endpoint operativo nacional reutilizable durante esta revisión. La consulta regional usa ComCat; cobertura nacional no garantizada. |

## Para automatización física completa
Se requieren conectores autorizados a los datos restringidos, procesamiento GNSS/InSAR, geometría y slip de fuente, receptores con mecanismos y cálculo Coulomb con incertidumbre. Una descarga de producto no equivale a ejecutar el modelo. La capa instalada es adquisición y contraste exploratorio automático, no pronóstico físico completo.

