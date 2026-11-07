# Aplicaciones: indicar, realizar y conservar diferencias

La ampliación [Foliar/Riego — RCF-045](application-routes.md) fija la vía por
medio, separa consecutivos y antecedentes por etapa/vía y permite agua opcional
en riego, conservando los demás contratos de este flujo.

Fecha: 2026-10-31. Estado: ficha previa a UI, dominio/SQL/HTTP aislados aprobados
y recorridos demo comprobados; Docker actualizado y Sites versión 8 publicados.
Fuente de negocio: [PRODUCT](../PRODUCT.md#aplicaciones-alcance-confirmado).
Controles: [FRONTEND](../FRONTEND.md) y componentes compartidos existentes.
Esta ficha describe el resultado requerido; los contratos técnicos corresponden
al modelo y las RPC del módulo, sin establecer nombres de tablas o parámetros.

## Usuario, entrada y objetivo

El administrador indica aplicaciones para siembras vigentes, registra su
realización por destino o cancela lo pendiente. El lector consulta únicamente
las agrícolas asignadas; no crea órdenes, grupos ni cambios de estado.

La entrada requiere sesión activa, una temporada activa y etapas sembradas
vigentes. Cada destino es una etapa concreta de subdivisión, con toda su
superficie sembrada. Una orden reúne destinos del mismo proyecto, campo y
cultivo; no mezcla temporadas ni selecciona etapas planeadas o cerradas.

Rutas implementadas con el HashRouter existente:

| Ruta | Objetivo y contexto visible |
| --- | --- |
| `/aplicaciones` | Lista filtrada, acceso a detalle y nueva indicación para administrador. |
| `/aplicaciones/:orderId` | Mezcla indicada, destinos, estados y comparación de lo realizado. |
| `/grupos-siembra` | Consulta de agrupaciones manuales y mantenimiento por administrador. |

Agrícola, temporada, campo y cultivo acompañan la selección y el detalle. Las
rutas se integran al mapa compartido de escritorio/móvil; no duplican el shell.

## Recorrido principal: cinco pasos

1. En Aplicaciones, elegir agrícola, proyecto activo, campo y cultivo. Seleccionar
   destinos completos, directamente o desde un grupo del mismo contexto; mostrar
   lote, subdivisión, número de etapa, siembra y superficie de cada destino.
2. Capturar fecha de indicación, programada, medio, observaciones y mezcla común:
   productos, dosis con unidad fija y agua en L/ha. Revisar destinos y guardar
   la orden. El detalle conserva esa indicación histórica en solo lectura.
3. Abrir un destino indicado y registrar fecha real, equipo utilizado como texto,
   aplicador opcional y observaciones. Inicialmente mostrar la mezcla indicada y
   la casilla desmarcada **Hubo cambios en productos, dosis o agua**. El caso
   habitual confirma expresamente que se aplicó lo indicado, sin recapturarlo.
4. Si hubo cambios, marcar la casilla: abrir una copia editable de productos,
   dosis y agua para ese destino. Revisar la diferencia y guardar la realización;
   conservar la mezcla indicada. Los demás destinos mantienen sus estados.
5. Consultar el detalle y los conteos de la etapa. Cancelar destinos todavía
   indicados con motivo obligatorio cuando corresponda. Antes de cerrar una
   etapa o temporada resolver sus pendientes; el cierre conserva el historial.

## Agrupaciones manuales

Desde Grupos, el administrador elige proyecto/campo/cultivo, nombra el grupo y
selecciona etapas. No se agrupa por una cercanía de fechas calculada. El listado
permite consultar los integrantes y reutilizar los vigentes en una orden.

Los integrantes son referencias a etapas concretas; no se convierten a la nueva
siembra de una misma subdivisión ni se trasladan a otra temporada. Al cerrar una
etapa se conserva su pertenencia histórica y se excluye de los destinos
seleccionables. Mostrar cuántos integrantes siguen disponibles y cuáles están
cerrados antes de confirmar la selección. Si no queda ninguno, explicar por qué
no se puede indicar una nueva orden desde ese grupo.

## Invariantes y criterios observables

| Regla | Resultado requerido |
| --- | --- |
| Destinos | Etapas sembradas vigentes de un mismo proyecto activo, campo y cultivo; selección completa de su superficie, sin fracciones de realización. |
| Mezcla indicada | Una mezcla y medio comunes a la orden. Guardarla conserva productos, unidades, dosis y agua históricos; no cambia por editar el catálogo. |
| Fechas | Se distinguen indicación, programación y realización. La realización requiere una fecha real confirmada; abrir el formulario no convierte una orden en realizada. |
| Estado | Cada destino pasa de indicado a realizado o cancelado. Un estado terminal no se vuelve a procesar y no altera otros destinos. |
| Realización habitual | Casilla de cambios desmarcada; confirmar y guardar copia los valores indicados como valores reales propios del destino. No basta abrir/cerrar el formulario. |
| Excepción | Casilla marcada habilita productos/dosis/agua reales. La copia editable no modifica la indicación, otro destino ni la dosis predeterminada del catálogo. |
| Comparación | Antes y después del guardado se identifican indicado y realizado; productos agregados/retirados, unidad, dosis y agua pueden distinguirse en lectura. |
| Cancelación | Solo un destino indicado se cancela, con motivo obligatorio; conserva la indicación y los otros destinos. |
| Cierre | El servidor rechaza cerrar etapa/proyecto con destinos indicados pendientes y la UI permite ubicarlos para resolverlos. No cancelación silenciosa ni cierre que borre órdenes. |
| Conteos | Por etapa: indicadas, realizadas y canceladas por separado. Varios productos o una excepción de mezcla siguen siendo una sola aplicación por destino/etapa. |
| Grupos | Integrantes manuales del mismo campo/cultivo y proyecto; las etapas cerradas conservan referencia histórica y quedan fuera de nuevas órdenes. |
| Permisos | Lector ve solo agrícolas asignadas y no controles de escritura; peticiones directas de escritura o lectura ajena son rechazadas por el backend. |
| Superficie y unidades | Área viene de la etapa; g/ha o ml/ha según producto y agua en L/ha. No hay importes, inventario ni totales calculados de agua/productos. |

El listado ofrece consulta filtrada y el detalle/conteos permiten seguir el
trabajo. El reporte completo con agrupaciones, sus columnas y exportaciones
queda fuera de esta entrega. No presentar la lista como ese reporte terminado.

## Vacíos, errores y recuperación

- Sin temporada activa o siembras disponibles: explicar la precondición y enlazar
  proyectos de siembra al administrador; el lector conserva una salida de consulta.
- Sin resultados: conservar filtros y ofrecer limpiarlos; distinguirlo de una
  consulta fallida o de no tener agrícolas asignadas.
- Cambio de campo/cultivo/proyecto: no conservar destinos ni grupos incompatibles
  de forma oculta. Si afecta un borrador, advertir antes de descartarlo.
- Catálogo vacío o referencia inactiva: explicar la selección no disponible;
  mantener legible cualquier valor histórico usado.
- Error de validación o guardado rechazado: conservar la captura, indicar el
  campo/estado involucrado y permitir corregir o recargar el estado vigente.
- Concurrencia: volver a comprobar etapa/proyecto y estado del destino en
  servidor. Un cierre o realización concurrente se informa sin duplicar conteos.
- Guardado confirmado y consulta posterior fallida: informar ambos resultados y
  ofrecer recargar; no reenviar una creación confirmada como si hubiera fallado.
- Borrador modificado: confirmar descarte al salir. Guardar bloquea doble envío;
  un reintento debe respetar el resultado/idempotencia del contrato técnico.

## Móvil y teclado

Reutilizar formularios, diálogos, selecciones, alertas y estados compartidos.
Etiquetas asociadas, unidades junto al campo, controles de al menos 44 px, foco
visible y errores vinculados. La casilla de excepción se opera con teclado y
deja claro cuándo se edita lo real. No usar solo color para estados/diferencias.

A 375 px la selección de destinos y comparación mantienen contexto y acciones
legibles, con scroll de tabla contenido si hace falta y sin overflow de página.
Diálogos mantienen título, Escape, foco inicial/retorno y protección de borrador.
Comprobar escritorio, móvil, teclado y texto 200 % antes de acreditar esos casos.

## Éxito y evidencia

Éxito observable: el guardado devuelve una orden/destino persistido; tras recargar
se conserva indicación y realización propia, comparación, estado y conteo. Una
cancelación deja motivo y el cierre vuelve a estar permitido solo al resolver
los pendientes correspondientes.

Pruebas puras: 20/20 aprobadas en
[applications.test.ts](../../test/applications.test.ts), con fixtures ficticios
en memoria. Cubren snapshots, realización habitual/excepcional, atomicidad,
reintentos, estados/conteos, cierres, grupos/historial, catálogos y ámbito del
lector. No acreditan RPC/RLS ni interacción en navegador.

Backend aislado: `node scripts/backend-applications-test.mjs` aprobó 116
comprobaciones SQL (48 de regresión y 68 del módulo), según ejecución del
subagente backend. Se revisaron guardas, RLS, historial, unidad, normalización de
nombres y bloqueos; el contenedor exclusivo se retiró al terminar. Auth usa un
stub: esta evidencia no acredita login/REST reales ni migración de operación.

La integración real aislada aprobó 40 comprobaciones HTTP (12 previas y 28 del
módulo), con Auth/REST/Edge/RLS; su entorno exclusivo se retiró. El agente principal
verificó en demo, puerto 5174, una orden de un destino, realización habitual con casilla desmarcada,
excepción que conserva ambas mezclas y guardado de un grupo manual vigente.
El total de pruebas puras pasó a 54 y TypeScript aprobó. Se corrigieron formato
de dosis a seis decimales, selector de 44 px y edición de grupos de proyecto cerrado.

La migración aditiva ya se aplicó en operación después de un respaldo privado:
ledger con dos aplicadas/cero pendientes, sin fixtures. El frontend Docker
actualizado quedó sano; en 5180 el navegador mostró sesión administradora y lista
real vacía, sin errores ni inserciones. Sites confirmó `succeeded` para la versión
8; nueve comprobaciones HTTPS posteriores aprobaron sin crear datos. El commit
y resultado nativo se conservan en [OPERATIONS](../OPERATIONS.md#despliegue-de-aplicaciones-y-grupos).
El navegador demo no acredita captura del módulo contra operación. Se comprobó reuso del grupo, cancelación, rechazo de motivo
vacío y ausencia de desbordamiento general a 375 px. El lector demo a ese ancho
no ofrece Nueva indicación;
no hay evidencia completa de teclado o texto 200 %.

| Caso a probar | Estado |
| --- | --- |
| Orden con varios destinos; rechazos de campo/cultivo/temporada/etapa incompatibles | Dominio/SQL/HTTP aprobados; alta UI demo de un destino comprobada. |
| Realizar un destino sin cambios y conservar pendientes los demás; fecha/equipo/aplicador/observaciones | Dominio/SQL/HTTP aprobados; realización habitual UI demo guardada. |
| Excepción con producto agregado/retirado, dosis/agua distintas y comparación histórica tras recarga | Dominio/SQL/HTTP aprobados; comparación de ambas mezclas UI demo comprobada. Recarga específica UI pendiente. |
| Cancelar con motivo; bloquear cierre hasta resolver indicadas; conservar historia | Dominio/SQL/HTTP aprobados; cancelación UI y rechazo de motivo vacío comprobados en demo. |
| Conteos por etapa sin multiplicarlos por productos o excepciones | Dominio/SQL/HTTP aprobados; revisión visual completa de conteos pendiente. |
| Crear/reutilizar grupo; excluir cerradas sin borrar integrantes históricos | Dominio/SQL/HTTP aprobados; creación y reutilización UI demo comprobadas. |
| Anónimo, lector asignado/no asignado y peticiones directas | Dominio/RLS/HTTP aprobados en entornos aislados; lector UI demo a 375 px sin Nueva indicación comprobado. |
| Doble envío, guardado confirmado/relectura fallida, concurrencia y descarte de borrador | Atomicidad/reintentos puros aprobados; red/concurrencia/UX pendientes. |
| 375/1440 px, teclado, foco, Escape y texto 200 % | Recorridos demo de escritorio y 375 px sin desbordamiento general comprobados. Teclado/foco/200 % completos pendientes. |

Las pruebas demo, SQL/HTTP aisladas y navegador contra Supabase real se registran
por separado. No cargar fixtures en la instalación de operación ni incluir datos
reales, sesiones o secretos en Git, capturas publicadas o esta ficha.

## Selección de cultivo y variedad en grupos

Corrección solicitada el 2026-10-31: al crear un grupo se eligen proyecto activo,
campo y un cultivo activo del catálogo, incluso cuando ese cultivo todavía no
tiene etapas sembradas disponibles. En ese caso se explica cómo registrar la
variedad y la siembra real en Proyectos; un grupo activo sigue necesitando miembros
sembrados vigentes. Al editar, proyecto/campo/cultivo permanecen bloqueados con
su motivo para conservar la identidad e historial del grupo.

La variedad pertenece a cada etapa. Se muestra explícitamente en los candidatos
y en el detalle, y el selector Variedad de las siembras filtra esos candidatos sin
cambiar su variedad ni los integrantes seleccionados de otras variedades. Las
acciones Seleccionar todos/Limpiar afectan solo la lista visible; el total del
grupo incluye todos los seleccionados. No se introduce una variedad fija al grupo.

Criterios de QA: elegir un cultivo sin siembras y recibir orientación; seleccionar
un cultivo con siembras, filtrar su variedad y guardar; cambiar/limpiar filtros sin
perder miembros; recargar y consultar la variedad original; edición del contexto
bloqueada con motivo; vacío de proyecto/campo/cultivos; móvil y lector sin captura.
Verificación del 2026-10-31: 115 pruebas automáticas aprobadas, incluidas dos
regresiones que impiden perder miembros de otras variedades al seleccionar o
limpiar el filtro. Tipos/build y control documental aprobados. Navegador demo:
selección de Pimiento/Rojo sin siembras con orientación y rechazo de grupo activo
vacío; selección de Pepino/Persa, filtro Slicer sin pérdida del miembro oculto,
guardado, recarga y detalle con variedad original; edición con contexto bloqueado
y motivo visible. A 375 px, documento de 375 px y diálogo con scroll interno sin
desbordamiento. No se modificó el esquema ni se crearon fixtures en operación.
La revisión React fue del autor; teclado/contraste/zoom completos siguen en RCF-006.

## Edición posterior de una aplicación

La indicación original sigue disponible en solo lectura. **Editar indicación**
crea una revisión para todos y solo los pendientes; **Corregir realización**
registra una corrección individual de lo aplicado. Motivo obligatorio e historial
antes/después, autor/fecha/versiones. Esta ampliación autorizada permite corregir
sin cancelar/recrear la orden. Contrato, permisos, validaciones y aceptación en
la [ficha de edición](application-editing.md).
