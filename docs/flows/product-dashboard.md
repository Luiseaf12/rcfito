# Dashboard de uso de productos

Autorizado por el Propietario el 2026-11-01: tabla de productos, ranking por
aplicaciones e historial al seleccionar; filtros de agrícola, cultivo y etapa.
La rectificación posterior del mismo día exige todas las aplicaciones guardadas
por defecto, con filtro de estado e historial de temporadas anteriores. Sustituye
el ámbito inicial de solo realizadas/temporadas activas. Incluye commit/push y publicación en el Site existente
con su audiencia conservada. No sustituye el reporte completo RCF-011.

## Flujo

- Usuario y objetivo: administrador o lector autorizado que necesita conocer uso,
  cantidades, dosis y fechas por producto.
- Entrada: Resumen (`/`), tras cargar el workspace autorizado. Todas las temporadas
  y estados de las agrícolas disponibles; Estado inicia en Todas las aplicaciones.
- Recorrido: elegir agrícola/cultivo/etapa y, opcionalmente, estado → consultar resumen, ranking y tabla →
  seleccionar Ver historial en un producto → revisar sus registros y cerrar,
  conservando filtros y orden.
- Alternativas: sin aplicaciones guardadas o filtros sin
  coincidencias muestran vacío explicativo; los datos incompletos se identifican
  y se excluyen sin inventar mezclas ni fechas.
- Recuperación: limpiar filtros; ante error de carga usar Actualizar del shell.
  El error de servidor se conserva visible y no acredita información actualizada.
- Éxito observable: métricas, ranking e historial concuerdan con los destinos
  seleccionados. No hay escritura ni comparación programado/ejecutado.
- Evidencia: [verificación](#verificación-y-publicación).

## Cálculos y filtros

`performed` usa exclusivamente productos y fecha reales propios del destino, con
las correcciones vigentes hidratadas por el adaptador. `indicated` y `cancelled`
usan productos y fecha de indicación de su snapshot histórico, resuelto con
indicationForTarget. Una cancelada conserva la revisión que le correspondía.
No se usa fecha programada ni dosis actual del catálogo. Falta de historial no
autoriza sustituir por otra indicación. El filtro Estado permite Todas,
Indicadas, Realizadas y Canceladas y se conserva en la URL.

- Aplicaciones por producto: destinos registrados que lo contienen. Una mezcla
  con varios productos contribuye una vez a cada producto y una vez al conteo
  general. El número capturado de aplicación no sustituye un conteo.
- Cantidad: suma de dosis registrada × superficie histórica del destino. Se
  identifica como calculada según los estados seleccionados; al incluir indicadas
  o canceladas no equivale a consumo real. ml se presentan en L y g en kg.
- Superficie acumulada: suma de hectáreas de sus aplicaciones, con repetición de
  superficie cuando hubo aplicaciones sucesivas; no es superficie física única.
- Dosis promedio: cantidad en unidad base / superficie acumulada, sin redondeos
  intermedios. Unidad ml/ha o g/ha; no se mezclan unidades.
- Última fecha: máximo de fecha del registro, real para realizada y de indicación
  para los demás estados. Historial descendente con estado y origen de fecha visibles.
- Destinos: número de etapas distintas con ese producto registrado.
- Producto: identidad y unidad propias, conservando el nombre histórico;
  productos inactivos y etapas cerradas siguen apareciendo si fueron utilizados.
- Agrícola y cultivo son identidades, etapa es el número local de siembra de
  cada subdivisión. Elegir Etapa 1 puede reunir varias subdivisiones. Cambiar
  agrícola/cultivo/estado retira filtros dependientes incompatibles. Las selecciones
  permanecen en la URL, sin guardar datos de negocio.

La presentación de cantidades, dosis y superficies sigue la regla de
[dos decimales](../FRONTEND.md#decimales-en-reportes), también en resumen por lote,
ranking e historial. Cálculos y ordenamiento conservan su precisión original.

## Presentación y permisos

Reutiliza shell, Card, FieldGroup/FormSelect, Table, Button, Alert, Empty y
RecordDialog sobre shadcn/Radix. Tabla ordenable y paginada, ranking de diez
productos por conteo e historial paginado en diálogo con título, Escape y retorno
de foco. Cantidades separadas por unidad, estado, origen de fecha y unidades visibles.
Scroll horizontal contenido a las tablas en móvil; no hay gráficos financieros.

El dominio recibe el workspace ya autorizado. Demo usa scopeWorkspace y datos
ficticios; Supabase mantiene Auth/RLS/asignaciones. No hay endpoint privilegiado,
migración ni consultas nuevas que amplíen el acceso. QA nunca carga fixtures en
operación ni modifica el `.env` preexistente.

## Filtro global por lote

Autorizado el 2026-11-01 con commit/push y Sites. El selector Lote inicia en Todos
los lotes y usa el ID del lote de temporada; cada opción muestra nombre, campo,
temporada y agrícola, incluyendo lotes retirados o sin aplicaciones. Opciones
limitadas a las agrícolas disponibles y a la agrícola seleccionada.

Recorrido: elegir agrícola y lote → consultar métricas, tabla general y ranking
recalculados → abrir historial o productos del lote → cerrar conservando filtros.
El lote se cruza con cultivo, etapa y estado; Todas sigue como estado inicial y
la tabla conserva cantidad ascendente mixta. El resumen por lote recibe el mismo
filtro. Cambiar agrícola limpia lote y sus filtros dependientes; los demás
filtros conservan el lote y pueden producir un vacío explicativo. Todos los lotes
retira solo ese filtro. Limpiar filtros los retira todos. La URL conserva lote
para recarga y los IDs desconocidos/no asignados no amplían la consulta.

La vinculación stage → subdivision → lot verifica proyecto, campo y agrícola en
una función compartida por los dos cálculos; no se deduce identidad por nombre.
Sin migraciones ni consultas nuevas. Cuatro pruebas adicionales comprueban el
filtro en métricas/productos/ranking/historial, intersecciones y lectura autorizada,
lotes homónimos y IDs ajenos o con jerarquía inválida. 228 pruebas y tipos
aprobados; QA demo en 5196 confirma cambios al seleccionar, historial exclusivo,
recarga, cambio de agrícola y limpieza, con Todas por defecto. 375/1440 px sin
overflow de página ni errores de consola. Revisión independiente sin hallazgos.
Revisión limpia 20c8ca6 aprobó 228/228 pruebas, tipos/build y checker. Subida a
GitHub y repositorio de Sites; versión 23 publicada con resultado succeeded y
tres comprobaciones HTTP posteriores aprobadas. [Evidencia](../OPERATIONS.md#publicación-del-filtro-global-por-lote).

## Verificación y publicación

### Ampliación: resumen por lote

Autorizada el 2026-11-01 con commit/push y Sites. Una malla puede contener más de
un lote; esta entrega agrupa por identidad del lote de su proyecto/temporada, sin
crear una entidad malla ni mezclar lotes del mismo nombre. Usa los filtros globales
y Todas por defecto. Recorrido: filtrar → consultar lotes → Ver productos → abrir
historial del producto de ese lote → cerrar conservando contexto y foco.

El resumen muestra superficie configurada del lote, aplicaciones por destino,
productos distintos y última fecha registrada. Varias subdivisiones o etapas no
se confunden con una aplicación física única. Una mezcla con varios productos
cuenta una sola vez por destino. La superficie configurada no se multiplica por
aplicaciones ni por productos. Se conservan subdivisiones retiradas y etapas
cerradas; faltantes de relación no se agrupan por un nombre ambiguo.

La tabla general de productos inicia por cantidad ascendente; **Ver productos**
del lote inicia por cantidad descendente conforme a RCF-031. Ambas comparan el
número de L/kg sin agrupar líquidos/sólidos y conservan la unidad en cada fila.
El cálculo y ordenamiento usan su precisión original; no se suman masas y
volúmenes entre sí. El ranking conserva aplicaciones descendentes y el historial sus fechas.
El historial de un producto abierto desde un lote contiene únicamente ese lote.
Sin datos se muestra vacío explicativo; errores de carga conservan recuperación
del shell y las validaciones de historial existentes. No hay migraciones ni
ampliación de permisos; cálculo sobre el workspace autorizado.

Estado de la ampliación: implementación, 224 pruebas y QA demo aprobados. Se
comprobaron lotes homónimos de temporadas distintas, conteos/superficie, orden
ascendente con L/kg intercalados, historial exclusivo, paginación y retorno de
foco. Lector limitado y 375/1440 px sin overflow de página; cero errores de
consola. Revisión independiente integrada. Cierre: revisión limpia ce7ed07 con 224/224 pruebas, tipos/build y checker
aprobados. Commit/push a GitHub y repositorio de Sites; publicación versión 20
confirmada con tres comprobaciones HTTP posteriores.
[Publicación](../OPERATIONS.md#publicación-del-resumen-por-lote).

### Orden descendente por lote — RCF-031

Autorizado el 2026-11-03, sin dudas adicionales: abrir **Ver productos** conserva
los filtros y la identidad del lote de temporada. Sus filas se ordenan de mayor
a menor cantidad calculada antes de paginar. Los empates conservan nombre
ascendente en español y clave estable. La cabecera muestra ↓ y
`aria-sort="descending"`; la nota describe el mismo orden.

Se conserva el comparador ascendente predeterminado de la tabla general,
el ranking por aplicaciones y las fechas descendentes del historial. Las unidades,
fórmulas, cantidades y permisos mantienen su contrato vigente. No hay migraciones,
nuevos endpoints ni escrituras de datos de operación.

2026-11-03: 312 pruebas, tipos, build de 38 recursos y checker aprobados.
Regresiones de orden mixto L/kg, desempates, cantidades distintas que redondean
al mismo valor y orden global/ranking conservados. QA demo: trece productos en
dos páginas, cabecera descendente, filtro Realizadas, historial exclusivo con
retorno de foco y móvil 375 px sin overflow de página. Sin avisos ni errores de
consola. Autorrevisión del diff; no se atribuye revisión independiente. Publicación
pendiente.

La primera revisión pasó 206 pruebas desde checkout limpio y QA de filtros,
paginación, dosis ponderada, lector demo y 375/1440 px. La rectificación a Todas
por defecto agrega casos de estados, temporadas anteriores y snapshots de
indicación por destino. 215 pruebas integradas (13 de dashboard), tipos y checker aprobados. QA demo de
Todas/Realizadas/Canceladas, temporada anterior, historial por estado y móvil
aprobado; URL de estado inválido devuelve vacío sin romper el render. Revisión
independiente integrada. Cierre: 215/215 pruebas, tipos/build y checker aprobados desde revisión limpia.
Commit 5266322 subido a GitHub y al repositorio del Site; publicación versión 19
confirmada, con tres comprobaciones HTTP posteriores. No se escribieron fixtures
en operación. Accesibilidad general adicional conserva el pendiente RCF-006.
Evidencia nativa de Sites en [OPERATIONS](../OPERATIONS.md#dashboard-de-uso-de-productos).
