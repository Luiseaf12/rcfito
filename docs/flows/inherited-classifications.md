# Clasificaciones heredadas e historia reconstruida — RCF-048

Autorización del Propietario, 2026-11-19: retirar las clasificaciones propias de
Productos, heredar de ingredientes para reportes y reconstruir las aplicaciones
anteriores con ingredientes actuales, marcando explícitamente esa reconstrucción.
No se crea archivo adicional de clasificaciones propias retiradas. Estado: en
implementación/verificación. Agente principal: diseño, programación, QA y autorrevisión.

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
Docker se recuperó sin reinicio del agente. Pendientes respaldo privado,
migración de operación, commit/push y publicación de la revisión verificada.
