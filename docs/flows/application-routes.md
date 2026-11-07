# Vías y numeración por etapa — RCF-045

Estado: cerrada y publicada en GitHub, frontend Docker y Sites 45 el 2026-11-06,
con el límite de verificación de navegador indicado abajo.
El Propietario aprobó las reglas y autorizó desarrollo,
commit, push y publicación el 2026-11-06; no hay dudas de alcance.

## Contrato y recorrido

Cada medio pertenece a una única vía: **Foliar** o **Riego**. Administración
configura esa relación en Medios de aplicación. Al crear una receta se elige
el medio; se incorpora el medio Sistema de riego para comenzar. La vía se muestra como información derivada, sin preguntar otra vez.

- Cada etapa lleva dos consecutivos independientes desde 1. Cancelar conserva
  el número sin liberarlo. El folio general APL conserva su identidad y su orden
  descendente; Foliar/Riego y el número por etapa se muestran por separado.
- Las recetas existentes se clasifican como Foliar, según confirmación expresa
  del Propietario (todas corresponden a bomba motor), sin renumerar ni cambiar
  sus mezclas, fechas, estados, firmas o historial.
- La receta anterior sugerida, su buscador y los intervalos por fecha real se
  limitan a la misma vía, manteniendo los ámbitos históricos de grupo/destinos.
  Cambiar el medio recalcula sugerencias y numeración sin borrar silenciosamente
  datos capturados ni aplicar automáticamente otra mezcla.
- La vía de una receta queda fija al guardar. Puede corregirse el medio dentro
  de la misma vía; cambiar de vía exige una receta nueva. La vía de un medio ya
  utilizado tampoco se reclasifica, para conservar interpretaciones históricas.
- En Riego el gasto de agua es opcional: ausencia se guarda como null y se
  presenta como «No especificado», sin convertirla en cero. Si se captura, debe
  ser positivo y se expresa en L/ha. En Foliar conserva su obligatoriedad.
- Dosis y productos mantienen sus unidades por hectárea. PDF, realización,
  corrección, consultas y captura asistida conservan esta distinción.

Administración crea o selecciona el medio, elige lote/grupo y receta base de su
vía, revisa el siguiente número por etapa, mezcla y fechas, y guarda. Lectores
solo consultan según sus menús y agrícolas asignadas. Errores de validación o
concurrencia conservan el borrador; el servidor comprueba vía, números e historial
en la misma transacción y mantiene los permisos de menú de RCF-044.

## Verificación y recuperación

Aceptación: series intercaladas y concurrentes, reinicio en otra etapa,
cancelación, referencias y recetas de otra vía, riego con/sin agua, foliar sin
agua rechazado, corrección de medio dentro/fuera de vía, catálogo utilizado,
permisos, PDFs y captura asistida. Migración aditiva con respaldo privado antes
de aplicar en operación; nunca resetear ni cargar fixtures reales.
Recuperación: conservar respaldo y fuente previa; no volver al frontend anterior
mientras existan recetas de riego sin agua, pues su contrato anterior era distinto.

399 pruebas de dominio/adaptador aprobadas; 535 comprobaciones SQL y 288 HTTP
con Auth/REST/RPC/RLS reales en el stack aislado, retirado al terminar. Incluyen
concurrencia, idempotencia, ausencia de agua, correcciones, vía fija, clasificación
del catálogo y regresión de permisos de menú. Advisors sin hallazgos WARN/ERROR.
Tipos/build aprobados; se conserva la advertencia anterior del chunk principal.
Autorrevisión de React, datos y permisos; sin revisión independiente.

Ocho casos PDF ficticios (borrador/guardada, simple/extensa, superficies corregidas
y riego sin agua) aprobados; las dos páginas de riego se renderizaron e inspeccionaron.
La comprobación interactiva de navegador y móvil no se realizó: el control local
está deshabilitado en los ajustes de Work. No se presenta la prueba automática ni
la inspección PDF como evidencia de ese recorrido.

Respaldo custom privado de 636,480 bytes, verificado por listado y SHA-256, antes
de aplicar `20261106233000_application_routes.sql`. Ledger 14/0. Comparación privada
confirma órdenes, destinos, números, estados, firmas, mezclas e historial idénticos,
con vía Foliar añadida según lo autorizado. Se incorpora únicamente el medio
Sistema de riego; no se crearon recetas, realizaciones ni fixtures de operación.

Fuente `f44b09a` publicada; Docker healthy, entrada y 38 recursos estáticos exactos
por destino, Auth y rechazo anónimo aprobados. Nueve controles del Site y veinte
HTTPS del túnel aprobados sin datos de prueba en operación. Audiencia y entorno
conservados. [Publicación](../OPERATIONS.md#vías-y-numeración-por-etapa--rcf-045).
