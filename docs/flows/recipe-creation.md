# Nueva indicación desde cero o una receta anterior

Desde RCF-045 la numeración, sugerencia y búsqueda de bases se limitan a la vía
derivada del medio. El agua solo es opcional en Riego. [Contrato vigente](application-routes.md).

RCF-030. Diseño presentado y desarrollo autorizado por el Propietario el
2026-11-02. Primera entrega publicada en Sites 30. La ampliación de captura unificada fue
autorizada el mismo día tras revisar la propuesta interactiva: una entrada
**Nueva indicación**, última receta activa por defecto, búsqueda de anteriores
y captura desde cero. Implementada en `/aplicaciones/nueva`, publicada en Sites 31, GitHub y Docker; `/aplicaciones/nueva-receta` conserva compatibilidad.

## Decisiones confirmadas

El Propietario respondió las cuatro aclaraciones el 2026-11-02:

1. Guardar una nueva receta crea una **aplicación indicada**, usando el flujo
   actual. No se define una entidad independiente de recetas.
2. La base es la **mezcla indicada** de la receta anterior, incluso cuando hubo
   diferencias en su realización. Los valores realizados no sustituyen la base.
3. Para un lote se propone la **fecha de indicación más reciente dentro de su etapa
   vigente**. No se usa el mayor número ni la fecha de realización como criterio.
4. Para un grupo se propone la **última receta emitida para ese grupo**, aunque alguno
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

La aclaración posterior del Propietario permite **buscar y elegir una receta
activa anterior**, conservando la última activa como valor propuesto. Buscar no
amplía el contexto: lote/selección manual, solo sus etapas vigentes; grupo,
solo emisiones explícitas para ese grupo con destinos vigentes. Las canceladas
siguen excluidas y siempre se copia la última revisión indicada de la elegida.

Se conservan los requisitos de [PRODUCT](../PRODUCT.md#propuesta-de-pantalla-de-recetas):
editar la copia sin sobrescribir la receta anterior, sugerir el grupo de origen
y mostrar el siguiente número por lote-etapa. Los destinos reales pertenecen a
etapas concretas de subdivisiones; el nombre de lote no sustituye su identidad.

## Flujo implementado

- Usuario y objetivo: administrador que necesita indicar una nueva aplicación
  sin recapturar una mezcla anterior. El lector conserva su consulta actual.
- Entrada: un solo botón **Nueva indicación** dentro de Aplicaciones. Abrir la pantalla conserva el proyecto/campo/cultivo elegido
  cuando sea compatible. Ruta: `/aplicaciones/nueva`; el enlace anterior continúa funcionando.
- Precondiciones: sesión administradora, proyecto activo y etapas sembradas
  vigentes del mismo proyecto, campo y cultivo. La autorización efectiva seguirá
  en el servidor, conforme al [contrato existente](applications.md).
- Recorrido:
  1. Confirmar el contexto y elegir **Un lote** o **Un grupo**. Ver sus destinos
     completos, etapa, variedad, superficie y siguiente número individual.
  2. Elegir **Usar receta anterior** (por defecto) o **Empezar desde cero**.
     La sugerencia es la última activa; **Buscar otra receta** permite buscar
     por folio, fecha, producto, medio o nota y elegir una anterior. Revisar su
     folio, fecha, origen y versión. **Ver receta anterior**
     despliega su indicación de solo lectura. Si provino de un grupo, **Usar grupo**
     ofrece cambiar explícitamente los destinos y cargar la última receta de ese
     grupo; mientras no se acepte, se conserva únicamente el lote elegido.
  3. Editar productos, dosis, agua, medio y nota. Capturar las fechas de la nueva
     indicación; no copiar automáticamente la programación antigua.
  4. Revisar destinos y números y pulsar **Guardar indicación**. Tras la
     persistencia confirmada, ir al detalle de la nueva orden con su folio y los
     números efectivamente asignados por destino.
- Alternativas: sin historia se ofrece **Continuar desde cero**; un error de consulta
  permite reintentar; un grupo sin destinos vigentes no permite guardar; un grupo
  no identificable no se infiere por coincidencia de integrantes.
- Recuperación: conservar la captura ante errores, confirmar reemplazos de una
  mezcla editada y proteger el descarte al salir. Un guardado ya confirmado no se
  repite por un fallo posterior al actualizar la consulta.
- Éxito observable: nueva orden con identidad propia, destinos en estado indicada
  y numeración por etapa; receta anterior e historial conservados. La demostración usa datos ficticios en el navegador; la persistencia real se
  comprueba por separado en Supabase aislado.
- Evidencia: revisión del prototipo y límites al final de esta ficha. Pruebas de
  integración, permisos y persistencia: evidencia al final de esta ficha.

## Composición de la pantalla

Una pantalla dentro del shell actual, sin añadir otra sección al menú principal.
Conserva tipografía, paleta y componentes de
[FRONTEND](../FRONTEND.md). La maqueta del chat usa datos y productos ficticios.

| Bloque | Información y acciones |
| --- | --- |
| Encabezado | Nueva indicación; contexto de agrícola, temporada, campo y cultivo. Selectores de contexto cuando sea necesario, sin recapturar selecciones válidas. |
| Destino de la indicación | Selector Un lote / Un grupo / Manual y búsqueda del destino dentro del contexto autorizado; nunca ampliar a otros campos o cultivos. |
| Grupo sugerido | Nombre del grupo asociado a la receta base y acción Usar grupo. No extender silenciosamente una captura individual. |
| Destinos y numeración | Lote, subdivisión cuando corresponda, etapa, variedad, superficie y Siguiente #n. Cada destino conserva su secuencia; no se impone un número común al grupo. |
| Forma de comenzar | Usar receta anterior o Empezar desde cero, sobre un único editor. |
| Receta base | Última activa propuesta, búsqueda paginada de anteriores activas y referencia de folio/fecha/versión elegida; consulta desplegable. Siempre separada de la copia editable. |
| Datos de la nueva indicación | Editor de productos existente, dosis con unidad fija, agua L/ha, medio, fechas y nota opcional. |
| Guardado | Pendientes junto a los campos, una acción principal Guardar indicación, progreso y resultado verificable. |

En móvil los bloques conservan este orden. Productos y campos se apilan sin
encoger controles; la fila de cada destino conserva etapa y número visibles.
El menú móvil reutilizará el shell existente. La maqueta solo representa su
ubicación; no implementa un segundo sistema de navegación.

## Reutilización de controles

Composición reutilizada por la pantalla implementada:

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

## Comportamientos de la implementación

Estos comportamientos completan las ocho decisiones confirmadas.

- **Identificar la base:** restringir siempre a etapas vigentes del contexto.
  La selección de una base entre subdivisiones no cambia por sí sola los destinos
  de la nueva indicación; se revisan explícitamente antes de guardar. Mostrar
  referencia de la revisión copiada y aplicar las decisiones confirmadas sobre
  actividad, empates y mezcla por subdivisión.
- **Fecha nueva:** iniciar indicación en la fecha operativa de RCFito (America/Mazatlan), editable;
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
  El valor predeterminado es automático por etapa. Se conserva la captura
  opcional de número del flujo manual; duplicados se bloquean y un número
  distinto del siguiente exige revisión explícita. Mostrar números confirmados
  por el servidor. No reservar numeración por abrir la pantalla.
- **Cambios concurrentes:** si cambian etapas, grupo o receta base mientras se
  edita, conservar el borrador y pedir revisión del cambio detectado. El servidor
  vuelve a validar destinos y números; un éxito confirmado no se convierte en
  un segundo intento de creación.

## Grupo de origen y alcance técnico

La [implementación de RCF-029](application-group-origin.md) conserva el grupo
usado para emitir la orden por su ID y nombre histórico. Las pertenencias actuales
no sustituyen ese origen. La corrección única confirmada por el Propietario ya
vinculó las 23 órdenes anteriores al grupo completo; esta pantalla no la repite.

`application-recipes.ts` resuelve historia activa y sugerencias por etapa vigente
y grupo explícito; `searchRecipes` filtra esa historia autorizada por la versión
indicada vigente. `ApplicationRecipePicker` reutiliza RecordDialog, SearchField,
Card y paginación de diez resultados, con foco y cierre compartidos.
Activa significa que el destino de la base está **indicado o realizado**, nunca
cancelado. La fecha se toma de la última versión de la indicación. No se copian
realizaciones, programación, número ni texto de captura con IA.

`ApplicationCreationPage` coordina selección, confirmaciones y borrador con los
editores compartidos. Conserva fechas nuevas al cambiar la base y muestra los
valores históricos inactivos hasta que se sustituyan. La navegación por menú,
Cancelar o Atrás usa el bloqueo de React Router; cerrar/recargar usa el aviso
nativo del navegador. El router mantiene las mismas rutas hash mediante
`createHashRouter`, para cubrir también Atrás del navegador.

Al guardar se envía `recipe_source: { order_id, revision, stage_id? }` junto al
comando existente. La etapa es obligatoria para una copia individual; se omite
para una base grupal. La migración aditiva `20261102171500_application_recipe_source`
conserva tres referencias inmutables, sin inferir bases históricas ni cambiar las
firmas de reintentos anteriores. El servidor comprueba versión, contexto, estado
no cancelado y origen explícito de grupo antes de crear. Bloquea la orden base
antes del grupo/etapas para serializar revisiones o cancelaciones concurrentes.
Un reintento exacto ya confirmado devuelve la misma identidad aunque la base
haya cambiado después. Los números se asignan por etapa bajo bloqueo existente.

El adaptador recupera la referencia al recargar y el detalle enlaza la base y
versión copiadas. El borrador permanece ante errores; Actualizar vuelve a consultar
sin sustituirlo. Reemplazarlo exige confirmación si se editó la mezcla, agua,
medio o nota. No se incorpora ninguna llamada de IA.

## Estados y criterios de aceptación

| Caso | Resultado esperado |
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

La evidencia anterior corresponde exclusivamente al prototipo. La implementación
conserva el perfil de marca del proyecto. Recorrido exhaustivo de teclado, zoom
200 % y contraste medido no se acreditan con esa maqueta.


## Verificación de la pantalla real — 2026-11-02

- 297 pruebas de dominio aprobadas: fecha indicada, empates, historias distintas
  por subdivisión, emisión de grupo frente a individual posterior, cancelación,
  última revisión, reintentos y referencia persistida. Sin conexiones reales.
- 372 comprobaciones SQL en PostgreSQL efímero: migración conserva órdenes,
  destinos y firmas previas; nuevas referencias y números, bases obsoletas,
  canceladas o ajenas, inmutabilidad y RLS. Auth simulado solo en esta suite.
- 167 controles HTTP con Auth/REST/Edge/RLS reales en Supabase aislado; 14 nuevos
  de recetas. Relectura, número individual, copia de grupo, lector, ámbito,
  rechazo atómico y reintento. Advisors sin WARN/ERROR; stack de prueba retirado.
- Navegador con datos ficticios: copia individual con dosis editada y referencia
  tras recarga; grupo sin historia no toma las recetas individuales; primera
  receta grupal con números distintos 6/2 y posterior copia desde esa emisión.
  Cambio de destino y Atrás/menú protegen el borrador mediante confirmación.
- Revisión de React, accesibilidad y permisos realizada por el mismo agente;
  no se presenta como revisión independiente.

- Empates comprobados en pantalla: elección entre tres recetas de la misma
  fecha; sugerencia de grupo solo tras elegir una base grupal y acción explícita
  Usar grupo. Móvil 375 px y escritorio 1440 px sin desbordamiento general;
  controles visibles de al menos 44 px. Lector directo sin formulario de creación.
- `typecheck`, `build`, `docs:check` y revisión del diff aprobados. Se conserva
  la advertencia previa de chunk principal mayor de 500 kB.
- Migración operativa confirmada: 10 aplicadas/0 pendientes. Respaldo privado
  validado de 531,292 bytes. Hashes de órdenes, destinos, productos e historial
  idénticos antes/después, excluyendo únicamente las tres columnas nuevas nulas;
  23 órdenes/92 destinos conservados. Sin capturas ficticias en operación.

Fuente `7bf3137` publicada en GitHub, Docker healthy y Sites versión 30 con
resultado `succeeded`. Nueve comprobaciones HTTPS de conexión y tres de código
aprobadas; audiencia conservada. [Registro operativo](../OPERATIONS.md#nuevas-recetas-por-lote-o-grupo--rcf-030).


## Ampliación autorizada: una sola entrada

La ampliación posterior de [PDF del borrador — RCF-035](recipe-draft-pdf.md)
añade descarga antes de guardar en este mismo formulario, con mezcla y destinos
actuales y sin modificar las reglas de persistencia.

La solicitud «adelante» posterior a la propuesta autoriza integrar ambos recorridos.
La última activa se propone si es única; los empates o historias diferentes por
subdivisión conservan la elección explícita. Buscar otra no modifica los destinos.
Elegir una anterior carga mezcla, agua, medio y nota de su última revisión.
Cambiar de receta, modo o destino confirma el reemplazo si se editó la mezcla.
Las fechas nuevas y el número capturado se conservan y se vuelven a validar.
Desde cero retira `recipe_source`; la captura con IA mantiene su revisión propia.
Los filtros compatibles de agrícola/campo/cultivo se llevan a la entrada única.

Se conservan selección manual de varios destinos, numeración opcional con revisión,
UUID estable, protección al salir, rechazo de referencias inactivas y control de
versión en servidor. El contrato RPC existente ya acepta una base anterior activa;
esta ampliación no añade migraciones, permisos ni escrituras operativas.

Evidencia nueva: 301 pruebas de dominio y 167 controles HTTP/Auth/REST/Edge/RLS,
con advisors sin WARN/ERROR. El caso HTTP ahora crea una indicación posterior y
comprueba que una anterior sigue siendo una base válida. Stack aislado retirado.
QA demo: una sola entrada, última única precargada, empates, búsqueda anterior,
reemplazo cancelado, copia individual con vínculo tras recarga, captura desde cero
manual con dos destinos y número 9 confirmado, grupo sin recetas individuales,
cambio de modo con fechas conservadas y descarte protegido. Móvil 375 px sin
desbordamiento horizontal; control de búsqueda corregido a 44 px en la primitiva compartida.
Contexto agrícola/campo/cultivo heredado cuando es compatible y lector directo
sin creación comprobados. `typecheck`, `build`, `docs:check` y diff aprobados;
se conserva la advertencia previa de chunk mayor de 500 kB.
Autorrevisión de React y permisos; no se atribuye revisión independiente.

Fuente `32c4937` publicada en GitHub, Docker healthy y Sites versión 31 con
resultado `succeeded`. Nueve controles HTTPS de conexión y tres del código
publicado aprobados, sin escrituras operativas. [Registro](../OPERATIONS.md#captura-unificada-de-indicaciones--rcf-030).
