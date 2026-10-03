# MIVIGE v2.1 — vigilancia observada y evaluación prospectiva

Esta versión corrige controles de calidad del visor. No demuestra una mejora de precisión predictiva, ni constituye alerta oficial. No hay un ETAS calibrado ni probabilidades de terremoto validadas.

## Correcciones

- Valores numéricos nulos o vacíos no se convierten a cero. Eventos con coordenadas, magnitud o tiempo inválidos, o fecha futura, se excluyen. Profundidad desconocida se conserva como NA.
- Los eventos distintos de una misma agencia no se fusionan por cercanía. El cruce entre agencias usa 15 segundos, 20 km y diferencia de magnitud ≤0.6; conserva los reportes asociados. Es una asociación conservadora, no una identificación garantizada. Casos con grandes discrepancias requieren revisión.
- Las consultas tienen límite de 20 segundos. Errores JSON de ArcGIS, se paginan las consultas nacionales de 500 registros hasta cubrir siete días o terminar el catálogo. Si se alcanza el límite de diez páginas sin cobertura suficiente se marca catálogo parcial. Un feed USGS generado hace más de 30 minutos se marca vencido. No se declara completitud instrumental a partir del éxito HTTP.
- Clasificación por profundidad descriptiva. Una longitud geográfica fija ya no decide si el evento rompió la interfaz o la corteza; se necesitan geometría de losa y mecanismos focales.
- El semáforo principal muestra vigilancia observada. Gris: catálogo ausente/parcial o menos de 20 eventos en la zona. Verde: sin exceso detectado bajo el tamiz; no significa seguridad. Amarillo: IDS elevado y prueba de aumento de tasa. Las hipótesis experimentales no sobrescriben este semáforo.
- El tamiz dinámico compara tasas por día, corrigiendo ventanas de exposición diferentes. Es asociación temporal, no prueba de transferencia de esfuerzos.
- GNSS requiere fecha de observación reciente. Sin asociación geográfica de estaciones a receptores, una anomalía regional no eleva todas las zonas. Coulomb, acoplamiento y geodesia espacial siguen pendientes de datos verificables.
- Cada evento puede ocupar como máximo un nodo en el cálculo del orden de primera activación. La correlación resultante no prueba migración causal.

## Prueba de tasa

Se compara el último día con los seis anteriores, usando un umbral Mc proxy común. Condicionado al número total, se calcula la cola binomial con exposición 1/7. Se aplica Benjamini–Hochberg (q=0.05) entre las zonas evaluables. La prueba supone conteos Poisson: el agrupamiento de réplicas, el solapamiento espacial y cambios de detección pueden violar ese supuesto. Por ello es un diagnóstico, no una significancia causal ni una probabilidad de un terremoto futuro. El Mc de siete días y las magnitudes heterogéneas limitan también el resultado.

## Hipótesis conservadas

Antípoda, SST, secuencias norte/sur, retardo, quiescencia y liberación intermedia permanecen como variables experimentales del puntaje histórico. Sus pesos y umbrales no se han optimizado ni validado. Se elimina el porcentaje artificial de “confianza científica”. El índice 0–100 no es una probabilidad. No se fuerza una proyección alta.

## Registro prospectivo

Se congela desde el momento de emisión, nunca desde la hora de un sismo ya observado. Objetivo: ≥1 evento M≥4.5 en el círculo y profundidad de la zona, horizontes 24 y 72 horas. Puntaje ≥65 es positivo; se registran negativos para contar omisiones. Cada zona/horizonte abre una nueva ventana después de cerrar la anterior. Se conservan parámetros, componentes, corte, estado de fuentes y catálogo de entrada.

La evaluación requiere las cuatro fuentes operativas sin truncamiento detectado y la ventana aún dentro del catálogo móvil de siete días. Si salió, es no verificable, nunca un fallo por defecto. Los resultados de catálogos vivos son provisionales. El registro está en localStorage, es editable y depende del navegador abierto; no es prueba pública inmutable. Exportar para auditoría. No se presentan porcentajes de rendimiento con muestras insuficientes o dependientes.

## Trabajo requerido para demostrar precisión

1. Catálogo histórico homogéneo por zona, revisiones, tipo de magnitud, Mc temporal y geometría tectónica.
2. Baseline de sismicidad de fondo y ETAS estimados solo en entrenamiento.
3. Validación temporal fuera de muestra y prospectiva, con ventanas y objetivos fijados antes del resultado; comparación contra persistencia/fondo.
4. Pruebas de ablación para cada variable adicional. Conservar en producción solo aportes reproducibles, con incertidumbre y control de pruebas múltiples.
5. Calibración de probabilidades y evaluación de log-score, Brier y ganancia de información cuando existan salidas probabilísticas defendibles.

Referencias primarias: [USGS — fundamento de pronósticos de réplicas](https://earthquake.usgs.gov/data/oaf/background.php), [USGS — descripción del pronóstico](https://earthquake.usgs.gov/data/products/oaf/overview.php), [Helmstetter y Sornette — límites de predictibilidad ETAS](https://arxiv.org/abs/cond-mat/0208597).
