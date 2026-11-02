# Propuesta: nueva receta desde la última indicación

RCF-030. Propuesta presentada el 2026-11-02 para revisión del Propietario.
El entregable es el diseño de la pantalla y su recorrido. La aplicación real
todavía no incorpora esta pantalla ni la consulta de recetas base.

## Decisiones confirmadas

El Propietario respondió las cuatro aclaraciones el 2026-11-02:

1. Guardar una nueva receta crea una **aplicación indicada**, usando el flujo
   actual. No se define una entidad independiente de recetas.
2. La base es la **mezcla indicada** de la receta anterior, incluso cuando hubo
   diferencias en su realización. Los valores realizados no sustituyen la base.
3. Para un lote se elige la **fecha de indicación más reciente dentro de su etapa
   vigente**. No se usa el mayor número ni la fecha de realización como criterio.
4. Para un grupo se usa la **última receta emitida para ese grupo**, aunque alguno
   de sus lotes tenga una indicación individual posterior.

El mismo día confirmó los cuatro casos límite posteriores:

5. Solo se ofrecen **recetas activas**; las canceladas se excluyen de las
   candidatas, sin ofrecer su reutilización con una confirmación.
6. Si varias recetas comparten la fecha más reciente, mostrar las candidatas
   para que el administrador elija una.
7. Si las subdivisiones del lote tienen recetas distintas, permitir elegir cuál
   usar como base. No combinar sus mezclas automáticamente.
8. Si la indicación se corrigió, copiar su **última versión**, conservando la
   consulta de su historial.

Se conservan los requisitos de [PRODUCT](../PRODUCT.md#propuesta-de-pantalla-de-recetas):
editar la copia sin sobrescribir la receta anterior, sugerir el grupo de origen
y mostrar el siguiente número por lote-etapa. Los destinos reales pertenecen a
etapas concretas de subdivisiones; el nombre de lote no sustituye su identidad.

## Flujo propuesto

- Usuario y objetivo: administrador que necesita indicar una nueva aplicación
  sin recapturar una mezcla anterior. El lector conserva su consulta actual.
- Entrada: acción **Nueva receta** dentro de Aplicaciones, junto a la captura
  manual existente. Abrir la pantalla conserva el proyecto/campo/cultivo elegido
  cuando sea compatible. Ruta propuesta: `/aplicaciones/nueva-receta`.
- Precondiciones: sesión administradora, proyecto activo y etapas sembradas
  vigentes del mismo proyecto, campo y cultivo. La autorización efectiva seguirá
  en el servidor, conforme al [contrato existente](applications.md).
- Recorrido:
  1. Confirmar el contexto y elegir **Un lote** o **Un grupo**. Ver sus destinos
     completos, etapa, variedad, superficie y siguiente número individual.
  2. Revisar el folio, fecha y origen de la receta base. **Ver receta anterior**
     despliega su indicación de solo lectura. Si provino de un grupo, **Usar grupo**
     ofrece cambiar explícitamente los destinos y cargar la última receta de ese
     grupo; mientras no se acepte, se conserva únicamente el lote elegido.
  3. Editar productos, dosis, agua, medio y nota. Capturar las fechas de la nueva
     indicación; no copiar automáticamente la programación antigua.
  4. Revisar destinos y números y pulsar **Guardar nueva indicación**. Tras la
     persistencia confirmada, ir al detalle de la nueva orden con su folio y los
     números efectivamente asignados por destino.
- Alternativas: sin historia se ofrece primera captura; un error de consulta
  permite reintentar; un grupo sin destinos vigentes no permite guardar; un grupo
  no identificable no se infiere por coincidencia de integrantes.
- Recuperación: conservar la captura ante errores, confirmar reemplazos de una
  mezcla editada y proteger el descarte al salir. Un guardado ya confirmado no se
  repite por un fallo posterior al actualizar la consulta.
- Éxito observable: nueva orden con identidad propia, destinos en estado indicada
  y numeración por etapa; receta anterior e historial conservados. En el prototipo
  el resultado se identifica como simulación y no demuestra persistencia.
- Evidencia: revisión del prototipo y límites al final de esta ficha. Pruebas de
  integración, permisos y persistencia de esta ampliación: **pendientes**.

## Composición de la pantalla

Una pantalla dentro del shell actual, sin añadir otra sección al menú principal.
Conserva tipografía, paleta y componentes de
[FRONTEND](../FRONTEND.md). La maqueta del chat usa datos y productos ficticios.

| Bloque | Información y acciones |
| --- | --- |
| Encabezado | Nueva receta; contexto de agrícola, temporada, campo y cultivo. Selectores de contexto cuando sea necesario, sin recapturar selecciones válidas. |
| Destino de la receta | Selector Un lote / Un grupo y búsqueda del destino dentro del contexto autorizado; nunca ampliar a otros campos o cultivos. |
| Grupo sugerido | Nombre del grupo asociado a la receta base y acción Usar grupo. No extender silenciosamente una captura individual. |
| Destinos y numeración | Lote, subdivisión cuando corresponda, etapa, variedad, superficie y Siguiente #n. Cada destino conserva su secuencia; no se impone un número común al grupo. |
| Receta base | Folio, fecha de indicación, origen lote/grupo y consulta desplegable de mezcla, agua, medio y nota. Siempre separada de la copia editable. |
| Editar nueva receta | Editor de productos existente, dosis con unidad fija, agua L/ha, medio, fechas y nota opcional. |
| Guardado | Pendientes junto a los campos, una acción principal Guardar nueva indicación, progreso y resultado verificable. |

En móvil los bloques conservan este orden. Productos y campos se apilan sin
encoger controles; la fila de cada destino conserva etapa y número visibles.
El menú móvil reutilizará el shell existente. La maqueta solo representa su
ubicación; no implementa un segundo sistema de navegación.

## Reutilización de controles

Esta tabla es una propuesta de composición para el desarrollo posterior,
no evidencia de componentes nuevos instalados:

| Necesidad | Composición del proyecto |
| --- | --- |
| Página y contexto | Shell, encabezado y controles de contexto existentes. |
| Elegir lote o grupo | ToggleGroup/ToggleGroupItem de shadcn; selector buscable existente cuando el volumen lo requiera. |
| Campos y errores | FieldGroup/Field, FormSelect, FormInput, TextField y FieldError existentes. |
| Productos | ProductMixtureEditor compartido; no modificar dosis predeterminadas del catálogo. |
| Base de solo lectura | Card, Collapsible y presentadores de mezcla/historial existentes. |
| Destinos | Presentación común de etapas; numeración con nextStageApplicationNumber para la previsualización. |
| Confirmaciones | AlertDialog y protección de descarte compartida. |
| Carga y resultado | Skeleton/Alert/Button y coordinación de mutaciones existentes. |

La maqueta usa controles HTML para explorar el recorrido, sin instalar
dependencias ni modificar los componentes de la aplicación.

## Detalles propuestos para revisión

Los siguientes comportamientos completan el diseño. Son propuestas del agente;
las ocho respuestas anteriores son las decisiones ya confirmadas.

- **Identificar la base:** restringir siempre a etapas vigentes del contexto.
  La selección de una base entre subdivisiones no cambia por sí sola los destinos
  de la nueva indicación; se revisan explícitamente antes de guardar. Mostrar
  referencia de la revisión copiada y aplicar las decisiones confirmadas sobre
  actividad, empates y mezcla por subdivisión.
- **Fecha nueva:** iniciar indicación en la fecha local del usuario, editable;
  programación comienza vacía y debe confirmarse. Conservar las validaciones
  existentes, incluida programación igual o posterior a indicación.
- **Cambio de destino:** si se editaron mezcla, agua, medio o nota, confirmar
  antes de sustituirlos por la nueva base. Cancelar conserva captura y selección.
  Aceptar conserva las fechas nuevas compatibles y vuelve a validar el conjunto.
- **Grupo sugerido:** al aceptarlo, recalcular integrantes vigentes, numeración y
  base del grupo. Si la base difiere de la vista individual, mostrar el nuevo
  folio y avisar del cambio; no mantener una mezcla individual como si fuera la
  última receta del grupo.
- **Historia no disponible:** si no hay receta del grupo, ofrecer captura vacía;
  no recurrir silenciosamente a la receta individual de uno de sus miembros.
- **Referencias inactivas:** mostrar el producto o medio histórico con su motivo
  de bloqueo y pedir sustitución por una referencia válida antes de guardar.
  No sustituir productos ni unidades automáticamente.
- **Asignación de números:** previsualizar el siguiente de cada etapa usando la
  regla existente, que incluye números ocupados por aplicaciones canceladas.
  Guardar sin imponer un número común, y mostrar los números confirmados por el
  servidor. No reservar numeración por abrir la pantalla.
- **Cambios concurrentes:** si cambian etapas, grupo o receta base mientras se
  edita, conservar el borrador y pedir revisión del cambio detectado. El servidor
  vuelve a validar destinos y números; un éxito confirmado no se convierte en
  un segundo intento de creación.

## Grupo de origen y alcance técnico

Revisión de código preparatoria: `NewApplicationDialog` mantiene `groupId` para
elegir destinos, pero el comando de creación envía `stage_ids` sin identidad del
grupo. Esto no equivale a una auditoría de persistencia y no cierra RCF-029.

Para implementar esta propuesta se deberá resolver la identidad histórica del
grupo utilizado al emitir una receta. No basta consultar los grupos a los que
pertenece hoy un lote ni comparar una lista de destinos con los integrantes
actuales. Una receta emitida manualmente para varios lotes no acredita que se
haya emitido para un grupo guardado. Las órdenes anteriores sin ese dato tendrán
un estado explícito de grupo no identificable; no se inventará su asociación.
La [implementación de RCF-029](application-group-origin.md) distingue el grupo
usado para emitir la orden de las pertenencias de cada destino al momento del
registro. Esta base ya está implementada y probada; su publicación se registra
por separado de la pantalla propuesta en esta ficha.

La futura ampliación deberá mantener reglas/casos de uso, coordinación y
adaptador separados. El diseño no incorpora una llamada de IA: la selección de
la receta base y la numeración se determinan por reglas y datos existentes.

## Estados y criterios de aceptación

| Caso | Resultado esperado del desarrollo posterior |
| --- | --- |
| Lote con receta previa | Mostrar última indicación de su etapa vigente, consulta anterior y copia editable. |
| Lote cuya base provino de grupo | Sugerir el grupo identificado; conservar solo el lote hasta aceptar. |
| Grupo con historia mixta | Usar última receta del grupo, aunque un miembro tenga una individual posterior. |
| Receta cancelada | Excluirla de las candidatas; solo ofrecer recetas activas. |
| Empate de fecha | Mostrar las candidatas y exigir elección de la base. |
| Subdivisiones con recetas distintas | Permitir elegir una base sin combinar sus mezclas automáticamente. |
| Indicación corregida | Copiar su última versión y conservar la consulta del historial. |
| Etapa nueva o grupo sin receta | Captura inicial sin heredar recetas de temporadas o etapas cerradas. |
| Integrante cerrado/retirado | Conservarlo en la historia, excluirlo de la nueva orden y explicar el motivo. |
| Números distintos entre miembros | Mostrar y guardar el siguiente de cada etapa, sin reutilizar números cancelados. |
| Cambio tras editar | Confirmar sustitución; cancelar conserva selección y borrador. |
| Error al consultar base | Mostrar error y reintento; no presentarlo como ausencia de historia. |
| Datos incompletos/inactivos | Error junto al campo y lista de pendientes; conservar valores capturados. |
| Guardado y doble envío | Una sola creación; detalle con folio, números y estado indicada tras confirmación. |
| Lector/petición directa | Sin creación; ámbito autorizado y autorización comprobados en servidor. |
| Receta anterior | Mezcla e historial anteriores intactos después de guardar la nueva. |
| Accesibilidad y móvil | Labels, foco, teclado, retorno al origen, controles de 44 px y reflujo sin desbordamiento general. |

## Evidencia del diseño

Prototipo interactivo presentado en este chat el 2026-11-02. Datos ficticios,
sin acceso a Supabase, sin almacenamiento y sin mutaciones reales. Incluye lote
con grupo anterior, lote con receta individual posterior, grupo con numeración
distinta y grupo/lote sin receta. El guardado muestra un resultado simulado.

Verificación del prototipo en navegador el 2026-11-02:

- Lote con sugerencia de grupo y cambio explícito a tres destinos; siguientes
  números 10, 8 y 4, con integrante cerrado identificado y excluido.
- Receta individual posterior de Malla 05 separada de la última receta del grupo.
- Consulta de receta anterior con dosis 120 conservada al editar su copia a 150.
- Captura editada conservada al cancelar el cambio de destino; al aceptarlo se
  vuelve a cargar la base correcta. Alta y eliminación de un renglón de producto.
- Lote y grupo sin receta, con captura inicial y siguiente número 1.
- Errores de programación vacía y anterior a la indicación. Guardado simulado de
  uno y tres destinos; activación con Enter y bloqueo del segundo envío.
- Ventanas de navegador de 1440, 1024, 375 y 320 px; sin desbordamiento horizontal
  del documento interior. Dosis etiquetadas también en la presentación móvil.
- Sin errores de consola observados en el recorrido final. `npm run docs:check`
  aprobado: estándar 4.3.0 válido, sin diferencias de integridad.

Solo se verificó el prototipo. Recorrido completo de teclado, zoom 200 %,
contraste medido y casos concurrentes del diseño: pendientes de la implementación.
No se atribuyen pruebas de frontend operativo, RLS/RPC, migraciones, Docker ni
Sites a esta propuesta. La apariencia del prototipo sigue el tema del chat;
la implementación futura conserva el perfil de marca vigente del proyecto.
