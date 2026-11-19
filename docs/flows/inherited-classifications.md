# Clasificaciones heredadas e historia reconstruida — RCF-048

Autorización del Propietario, 2026-11-19: retirar las clasificaciones propias de
Productos, heredar de ingredientes para reportes y reconstruir las aplicaciones
anteriores con ingredientes actuales, marcando explícitamente esa reconstrucción.
No se crea archivo adicional de clasificaciones propias retiradas. Estado: entrega
cerrada y publicada. Agente principal: diseño, programación, QA y autorrevisión.

## Catálogos y reglas

Ingredientes activos es la única fuente de clasificaciones, con principal opcional.
Productos conserva ingredientes/composición y muestra la unión de clasificaciones
por ID, sin duplicados ni principal de producto. No hay selección editable ni
columnas classification_id/classification_ids en Products tras migrar.
El filtro y la búsqueda de Productos usan la herencia actual. Un producto sin
ingredientes o con algún ingrediente sin clasificación se señala como incompleto.
Relaciones inactivas ya guardadas siguen aportando sus clasificaciones históricas.
Sinónimos de ingredientes/productos conservan sus ámbitos y reglas independientes.

Los campos propios anteriores se eliminan y se retiran sus claves obsoletas de los
eventos de metadatos de Productos, conservando nombres, estados, sinónimos, autores
y fechas útiles. Los eventos que solo contenían clasificaciones retiradas se
eliminan al quedar sin diferencia útil entre antes y después. No se trasladan selecciones propias a ingredientes ni se crea
una copia de archivo en operación. Sí se requiere respaldo técnico privado previo.

## Captura histórica y reconstrucción

La migración agrega classification_snapshot a líneas indicadas, realizadas y
ambas fases de productos en cada revisión/corrección. Reconstruye todas esas
líneas usando la composición y clasificaciones actuales de cada producto, con
origin=reconstructed y captured_at de la migración. No representa una clasificación
confirmada en la fecha original. Copia IDs y nombres de ingredientes/clasificaciones,
principal por ingrediente y complete. Falta de datos queda explícita; no se inventan
categorías. No reescribe dosis, nombres originales de producto, unidades, folios,
números, estados, superficies, firmas ni documentos originales antes/después.

Nuevas indicaciones, realizaciones y fases posteriores de correcciones capturan la
clasificación vigente con origin=recorded. La fase anterior conserva la copia previa.
Una edición posterior de ingredientes/composición no reclasifica aplicaciones
registradas. Reintentos idempotentes conservan su captura. El servidor calcula e
impone los datos; no acepta una clasificación histórica proporcionada por cliente.
Bloqueo compartido de captura/exclusivo de cambios del catálogo evita lecturas
mezcladas; los permisos agrícolas y de menú siguen en RLS/RPC.

## Reportes y exportación

Resumen de productos y por lote muestran clases guardadas, marca Reconstruida e
incompletos; el filtro por clasificación usa esas copias, no el catálogo actual.
Realizadas usan mezcla realizada/corregida; indicadas/canceladas usan indicación
retenida. Una misma cantidad se cuenta una sola vez aunque tenga varias clases;
las categorías se superponen y no son desgloses sumables entre sí.
Consultas REST/RPC/CLI aceptan classification_id, enriquecen sus productos y cambios
con clasificaciones históricas y mantienen límites/paginación/ámbito. PDF de receta
conserva las copias históricas; PDF de borrador muestra herencia actual provisional.

Referencias de catálogo se calculan en RPC privada con autorización del catálogo de
Productos. Devuelve solo IDs/nombres de clases y estado completo, no el catálogo
completo oculto de ingredientes. El frontend carga las copias por RLS de sus líneas.

## Aceptación

Actualización de datos existentes con revisiones y correcciones, misma información
original salvo campos retirados y columnas aditivas. Marca de reconstrucción en todas
las versiones; congelación después de editar el catálogo; captura nueva por fase;
permisos, idempotencia, copia histórica inmutable, cantidades no duplicadas y
clasificación incompleta sin ocultar consumos. Pruebas de dominio/SQL/Auth/REST,
PDF renderizado, QA escritorio/móvil, tipos/build/checker. Operación solo tras
respaldo validado y pruebas aprobadas, con comparación privada de registros.

## Estado de verificación

409 pruebas cliente y 601 comprobaciones SQL aprobadas, incluyendo actualización
desde la versión anterior y conservación de documentos originales. 331 controles
Auth/REST/Edge/RLS aprobados en el proyecto aislado; advisors sin WARN/ERROR.
QA ficticio en escritorio y 375 px: herencia actual, edición de ingrediente sin
reclasificar aplicación guardada, filtro histórico, cantidades únicas y PDF
renderizado correctos. Autorrevisión de contratos, permisos, hooks y tipos.
Docker se recuperó sin reinicio del agente. Fuente
`149b1e508789362a277e59b701bbd40803197084` en GitHub, Docker healthy y Sites 49.
Tipos/build/checker y 38 contrastes aprobados. Se conserva la advertencia previa
del chunk principal mayor a 500 kB. No se actualizaron dependencias.

Respaldo PostgreSQL custom privado validado: 671,097 bytes. Migración
20261119192222 aplicada con ledger SHA-256: 17 aplicadas/0 pendientes. Comparación
de todas las tablas públicas y auditoría privada igual al excluir exclusivamente
las columnas retiradas, las capturas nuevas y metadatos obsoletos autorizados.
Todas las líneas anteriores contienen origen reconstruido, fecha de migración y
clasificaciones de ingredientes actuales; las incompletas quedan explícitas.
Folios, números, dosis, nombres/unidades originales, firmas, estados, áreas,
documentos de cambios, roles y agrícolas conservados. Sin fixtures de operación
ni lectura/modificación del .env raíz. Respaldo en
.artifacts/production-supabase/backups/inherited-classifications-<fecha>/;
recuperación en entorno separado con escrituras detenidas y validación previa.

Sites confirmó succeeded, versión
`appgprj_6ae67ae019e88191a7012093bb19c505~appgver_ac073364529081919d7fa6dbd253512d`,
despliegue `appgdep_6aff54c1c75c8191a987b7cce3101fb5`, el 2026-11-19T19:58:01Z,
en [RCFito](https://rcfito.paxxa.chatgpt.site). Audiencia pública, R2 y entorno
revisión 1 conservados. Entrada /assets/index-tTFyVd-W.js y 37 recursos de aplicación
exactos por destino; 90 controles de recursos/Auth/rechazos anónimos y 9 de conexión
aprobados. La página HTML auxiliar de Nginx no es recurso de aplicación y Sites
transforma su HTML. El bundle del Site utiliza los recursos compilados por Docker;
configuración pública y entorno privado no se empaquetan.

El registro del túnel se renovó sin reinicios. La tarea automática estaba detenida
y la revisión automática inicialmente bloqueó iniciarla por la instrucción sobre
Docker. Tras autorización explícita del Propietario se inició la tarea existente:
estado Running, heartbeat actualizado y registro vigente renovado automáticamente.
El contenedor de datos conservó su arranque y estado healthy. Se mantienen los
límites de disponibilidad de esta PC y Quick Tunnel documentados en operación.
