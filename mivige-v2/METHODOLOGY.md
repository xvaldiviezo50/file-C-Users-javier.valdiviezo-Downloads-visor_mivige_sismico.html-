# MIVIGE v2 Público — metodología

## Definición
MIVIGE v2 es un sistema experimental de vigilancia y nowcasting geodinámico multievidencia. Integra sismicidad, geodesia, interacción tectónica, contexto de acoplamiento y migración, separando las capas científicas de las capas prospectivas experimentales.

No publica probabilidades de terremoto mientras el modelo no esté calibrado y validado prospectivamente.

## Jerarquía ICM
- ICM-0: fondo / sin convergencia.
- ICM-1: IDS elevado.
- ICM-2: IDS + IDG-ST coherente.
- ICM-3: IDS + IDG-ST + IITE compatible.
- ICM-4: convergencia anterior + IMST coherente.

## Variables científicas
### IDS
Vector de estado sísmico. La implementación pública actual usa:
- Mc proxy de ventana;
- tasa 24 h / tasa de fondo;
- clustering espacial;
- magnitud equivalente;
- b-value cuando n es suficiente;
- cambio de centroide;
- migración vertical;
- control de secuencia de réplicas.

El visor etiqueta el baseline como ETAS-proxy/tamiz, no como ETAS calibrado.

### IDG-ST
Deformación geodésica de corto plazo. Solo puede elevar evidencia cuando existen varias estaciones/observaciones con QC y coherencia espacial.

Regla: NA != 0. La ausencia de GNSS/InSAR utilizable se representa como datos insuficientes.

### IDG-HR
Canal de alta tasa para caracterización co/post-sísmica. No se reinterpreta retrospectivamente como precursor.

### IITE-S
Interacción estática por Coulomb. Requiere mecanismo focal, strike/dip/rake, geometría fuente-receptor y supuestos de fricción. Sin estos datos: NA.

### IITE-D
Interacción dinámica. La versión pública solo ejecuta un tamiz de fuente M>=6.5 + respuesta regional posterior. No calcula estrés dinámico físico ni causalidad.

### IAC
Acoplamiento interplaca. Se conserva como prior espacial, pero permanece NA automatizado hasta integrar una malla de acoplamiento regional trazable.

### IMST
Índice de migración sismo-tectónica. Usa el orden temporal de activación de segmentos y su posición a lo largo del grafo. Una correlación alta describe migración aparente, no causalidad.

### IDQ
Índice de disponibilidad/calidad: disponibilidad de feeds sísmicos, confianza del Mc proxy y geodesia QC.

## Grafo tectónico
Nodos: Chile central/norte, Perú sur/centro/norte, Ecuador sur, Azuay/intraslab, Manabí, Esmeraldas, Nariño/Cauca, Chocó y Venezuela costera.

Las aristas representan conectividad conceptual para análisis. No implican que esfuerzo o energía se transfieran causalmente entre nodos.

## Challenger experimental
- antípoda y huella;
- SST anómala persistente;
- redistribución progresiva de esfuerzos / activación secuencial;
- magnitud equivalente como proxy de liberación.

Estas variables no elevan por sí solas ICM.

## Validación futura
El baseline científico objetivo es ETAS calibrado sobre catálogos homogéneos y Mc trazable. Las versiones A/B/C/D deben compararse mediante:
- log-likelihood;
- information gain;
- Brier score cuando existan probabilidades calibradas;
- falsos positivos;
- omisiones;
- calibración espacial y temporal.

Hasta entonces, las salidas del visor son estados de vigilancia y convergencia de evidencia, no pronósticos deterministas ni alertas oficiales.
