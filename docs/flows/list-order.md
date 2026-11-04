# Orden de listados y selectores — RCF-039

Estado: verificación terminada; publicación en curso. Autorizado por el Propietario el
2026-11-04 mediante «documéntalo y aplícalo a todos los listados y selectores,
respetando los órdenes especiales que ya acordamos».

La fuente normativa única es [FRONTEND](../FRONTEND.md#orden-general-de-listados--rcf-039).
El bundle compartido se conserva intacto; esta ampliación pertenece a RCFito.

## Cobertura de presentación

| Recorrido | Aplicación del criterio |
| --- | --- |
| Catálogos | Tablas antes de paginar, todos sus selectores de relaciones, ingredientes y sinónimos de lectura. Se conservan inactivos ya relacionados, opciones deshabilitadas y cambio A-Z/Z-A de la tabla. |
| Proyectos | Tarjetas de proyectos por nombre; mallas y subdivisiones activas/anteriores por nombre. Selectores de agrícola, campo, infraestructura, cultivo y variedad. |
| Grupos | Tabla antes de paginar; integrantes vigentes e históricos por destino. Selectores de contexto y variedad, casillas de siembras por malla/subdivisión/etapa. |
| Usuarios | Nombres de usuarios, agrícolas en resúmenes y casillas de asignación. Roles por etiqueta. |
| Recetas y aplicaciones | Selectores de contexto, lote/grupo, medio, productos y unidades. Destinos y mezclas de lectura por nombre. Listas de destinos de revisiones y grupos de pertenencia histórica. |
| Reporte | Filtros de agrícola/lote/cultivo/etapa y resumen por nombre de malla. Orden por nombre de productos cuando lo elige el usuario y desempates de los órdenes numéricos. |
| Consultas | Selectores directos de agrícola/proyecto, coincidencias por nombre, fuentes por folio y productos dentro del detalle. |
| Correcciones de malla | Selector de etapa natural; destinos del evento por folio/etapa antes del límite de visualización. |
| Conexión y preferencias | Selector de perfil demo por su etiqueta; configuración sin otros selectores de registros. |

## Órdenes especiales conservados

| Elemento | Orden específico y fuente |
| --- | --- |
| Aplicaciones | Fecha programada descendente y folio de desempate; [aplicaciones](applications.md). |
| Última receta y búsqueda de anteriores | Indicación más reciente primero, solo activas del ámbito/etapa; [RCF-030](recipe-creation.md). El selector de bases usa el orden suministrado por ese recorrido. |
| Historiales | Fecha/versión descendente; [edición](application-editing.md) y [corrección de malla](lot-corrections.md). |
| Etapas | Número ascendente dentro de la subdivisión; [proyectos](sowing-projects.md). |
| Reporte de productos | Tabla general por cantidad ascendente inicialmente, productos de un lote por cantidad descendente (RCF-031), ranking por aplicaciones descendente, dosis por unidad y elección de columna/dirección; [reporte](product-dashboard.md). |
| Respuestas del chat | Consultas paginadas por fecha, versión o cantidad según operación; se mantiene su orden global de servidor. [Consultas](application-chat.md). |
| Formularios | Posición de renglones editables, estado del ciclo, validaciones y acciones; [captura](recipe-creation.md) y [catálogos](catalogs.md). |
| Navegación | Grupos y destinos del mapa funcional; [navegación](navigation.md). |

La modificación es de presentación. No cambia pertenencias, permisos, dosis,
cantidades, snapshots ni el contenido de las peticiones guardadas. No requiere
migraciones, escrituras en operación ni volver a ejecutar correcciones históricas.

## Verificación

325 pruebas aprobadas, incluidas cinco regresiones nuevas de español/eñe,
números naturales, identidad de desempate, opciones fijadas, inactivos retenidos,
paginación global y conservación de datos. Tipos y build aprobados. Las pruebas
existentes conservan cantidades ascendentes/descendentes, ranking, fechas y
última receta activa. Autorrevisión de React y del inventario, sin revisión
independiente; permisos y backend no se modifican.

QA demo: ingredientes renombrados en orden inverso aparecen A-Z en tabla y en
el selector anidado de un producto; conserva seleccionado, duplicado deshabilitado
y foco. Nombres ficticios restaurados y recarga comprobada. Proyectos, agrícolas,
campos, once mallas, asignaciones, contexto de grupos y selectores directos del
chat revisados. Resumen de trece mallas en dos páginas mantiene el orden global.

Aplicaciones conserva fecha/folio y secuencia de estados. Medios Bomba manual,
Dron y Tractor aparecen A-Z; recetas de noviembre preceden a la de octubre y
los empates requieren elección como antes. El reporte general conserva cantidad
ascendente, ranking por conteo y productos del lote descendentes con trece filas.
En móvil 375×812 px, selector anidado ordenado y ancho del documento 375 px; sin
avisos ni errores de consola. No se acredita una nueva prueba de Auth/REST ni de
PDF; los artefactos y datos de QA son ficticios y quedan fuera de Git/builds.

Publicación y comprobaciones posteriores en
[OPERATIONS](../OPERATIONS.md#orden-alfabético-general--rcf-039).
