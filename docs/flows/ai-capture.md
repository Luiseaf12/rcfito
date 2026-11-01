# Captura de aplicaciones con IA

Fecha: 2026-10-31. Alcance autorizado por el Propietario: implementar,
verificar, commit/push y publicar conservando la audiencia de Sites.
Estado: implementación y pruebas aprobadas; código publicado en Sites versión 11.
El Propietario decidió dejar la activación del proveedor pendiente, sin crear
credenciales ni ejecutar inferencia real.

## Usuario, entrada y objetivo

El administrador pega un mensaje de aplicación en `/captura-ia`. El servicio
interpreta el texto y prepara un borrador editable; la aprobación explícita crea
una indicación con los mismos permisos y reglas de aplicaciones. El lector no
accede a esta captura ni al servicio de interpretación. Registrar la realización
continúa siendo una acción posterior por destino.

La entrada conserva el texto original, acepta hasta 20,000 caracteres y requiere
sesión de administrador, una agrícola con temporada activa y etapas sembradas
vigentes. La IA extrae nombres y valores, sin emitir recomendaciones agronómicas
ni conceder permisos o crear productos de catálogo.

## Recorrido principal

1. Pegar el mensaje y generar un borrador con IA. La petición se autentica en
   servidor; un fallo conserva el mensaje y permite reintentar o completar la
   captura manualmente, sin presentar esa alternativa como una interpretación IA.
2. Revisar contexto y destinos: coincidencias únicas, misma temporada/campo/cultivo
   y superficie completa. Los faltantes o ambigüedades aparecen como selectores;
   las fechas faltantes permanecen vacías con calendario.
3. Revisar productos: nombre único activo vincula su código/ID, conserva la dosis
   del mensaje y muestra unidades. Varias coincidencias o ninguna requieren
   selección. No sustituir la dosis por la predeterminada al elegir producto.
4. Revisar número por etapa, agua y Nota de la aplicación. Aprobar explícitamente
   después de completar los datos y aclaraciones; conservar el borrador si el
   servidor rechaza el guardado. Reintentos no duplican la orden ni sus destinos.
5. Consultar la orden guardada tras recargar: texto de origen, nota, productos,
   fechas, número y estado indicado por destino. La realización conserva las
   observaciones propias de cada destino por separado.

## Contratos confirmados

- `9na aplicación` representa el número 9 dentro de cada etapa elegida. El folio
  de orden es independiente. Número positivo y único por etapa, incluso tras
  cancelar. Se permiten saltos revisados para importar historia incompleta sin
  inventar aplicaciones anteriores; los conteos representan registros reales.
- Si falta cultivo, sugerir el de la aplicación anterior de las mismas etapas,
  comprobado contra su siembra vigente. Cuando falta historia en alguna etapa,
  completar el cultivo único registrado en las siembras vigentes de los destinos
  del mismo campo/proyecto. Cultivos distintos o historia contradictoria dejan
  el selector pendiente; no inferir del nombre libre del proyecto ni tomar el
  último cultivo general de la agrícola.
- `cc` equivale a `ml`; kg se convierten a g y litros de producto a ml. Agua en
  L/ha. No convertir masa a volumen: una diferencia de unidad con catálogo
  requiere aclaración explícita antes de aprobar.
- La Nota de la aplicación reutiliza `observations` de la orden, es opcional,
  multilínea y editable antes de aprobar. Extraer el bloque `Nota:` conservando
  texto y saltos; no inventar contenido ni repartirlo automáticamente por producto.
- Conservar texto original de origen y autor/fecha de creación en servidor.
  El detalle mantiene esa indicación histórica; no sobrescribirla al realizar.

## Cultivo registrado en primeras aplicaciones

2026-10-31: el Propietario reportó la configuración del proveedor y señaló que
la revisión pedía cultivo pese a estar registrado en la siembra. La resolución
anterior exigía historia completa para cualquier sugerencia. Ahora una primera
aplicación o historia parcial compatible hereda el cultivo único de las etapas
vigentes identificadas. El formulario conserva la selección editable y explica
su procedencia. La aplicación anterior compatible sigue siendo la primera fuente.

No se omiten destinos para fabricar una coincidencia: cultivos/campos distintos,
historia contradictoria y referencias ambiguas conservan sus revisiones. Un
selector explícito se respeta y no se reutiliza la etapa anterior de una misma
subdivisión. No cambia la validación del guardado ni los datos de las siembras.

Evidencia: 19 pruebas de importación y 140 en la suite completa, tipos/build y
QA demo con Pepino y aplicación 1 completados. El navegador muestra cultivo y
destino seleccionados sin historia previa. Sin llamadas reales de IA ni
escrituras en operación durante esta verificación. Publicada en Sites versión 14
y frontend Docker actualizado desde el mismo commit; ver
[OPERATIONS](../OPERATIONS.md#corrección-de-cultivo-en-la-captura).

## Recuperación, permisos y accesibilidad

### Autocompletado y pendientes de aprobación

Ampliación autorizada por el Propietario: completar el contexto registrado y
explicar por qué Aprobar y guardar sigue inactivo; commit/push y publicación
en Sites autorizados. Estado: implementado y publicado en Sites versión 15;
frontend Docker actualizado desde el mismo commit validado.

Resolver agrícola/proyecto, campo, cultivo y destinos por coincidencias únicas
en los datos autorizados. Un proyecto o campo con una sola opción vigente se
completa aunque las referencias de mallas aún requieran revisión; varias opciones
conservan selección explícita. No tomar datos del nombre libre del proyecto ni
inventar medio, fechas, dosis, agua o nota que no estén en el mensaje.

La misma validación pura determina los pendientes visibles, el estado del botón
y el envío. Mostrar cada dato faltante o incompatible junto a su campo y una lista
antes de Aprobar: contexto, destinos, productos/unidades/dosis, agua, fechas,
número disponible y confirmaciones de referencias o saltos. Nota vacía es válida.
Corregir cualquier pendiente actualiza inmediatamente la lista; el estado listo
confirma que se puede aprobar. Conservar el borrador ante rechazos del servidor.

Evidencia: 161 pruebas completas aprobadas, incluidas 24 de importación y 16 de
validación del borrador. Cubren contexto único sin agrícola/referencias,
ambigüedad, selectores explícitos, revisiones, fechas, unidades, duplicados y
precisión de dosis/agua. Tipos y build aprobados; revisión independiente sin
hallazgos pendientes.

Navegador demo: contexto/cultivo/producto/código/dosis completos del ejemplo;
solo medio y fechas pendientes. Una fecha anterior a siembra y el salto a número
23 aparecen explícitos; corregir fecha y confirmar habilita Aprobar. Nota vacía
permitida, guardado ficticio confirmado y número 23 conservado tras recarga.
Cambiar número invalida confirmación; un duplicado se identifica sin ofrecer una
confirmación para eludirlo. Unidad incompatible exige aclaración y nueva dosis.
Completar manualmente un mensaje sin contexto conserva proyecto/campo/cultivo
únicos y deja destinos sin marcar. Móvil 375 px: documento 375 y diálogo 328 px,
sin desbordamiento; lista y botón legibles. Sin aplicaciones ni inferencia ficticia
en operación. [Publicación](../OPERATIONS.md#autocompletado-y-pendientes-de-aprobación).

Validación por campo, carga visible, doble envío bloqueado y protección de
descarte del borrador. Un cambio de contexto retira destinos incompatibles tras
confirmación. Las referencias sin resolver permanecen visibles y exigen revisión
explícita; nunca omitir silenciosamente una malla o producto del mensaje.

Reutilizar Sidebar, enlaces y permisos del shell, RecordDialog, Field, Select,
Textarea, Checkbox y Alert de shadcn. Móvil y escritorio comparten ruta; a 375 px
mantener el scroll dentro de tablas, foco visible y objetivos de 44 px. Escape
protege la captura y devuelve foco. Navegación y Escape comprobados; teclado
completo y lectura a 200 % permanecen pendientes en RCF-006.

La inferencia real requiere proveedor configurado únicamente en servidor; una
clave ausente produce un estado indisponible explícito. La demo puede revisar
ejemplos ficticios identificados y no acredita inferencia, seguridad o persistencia
de operación. No incorporar mensajes operativos reales a Git ni a capturas públicas.

## Evidencia y cierre

113 pruebas totales aprobadas, incluidas extracción/resolución y servidor IA con
proveedor simulado; 161 comprobaciones SQL y 48 HTTP aisladas aprobadas. Navegador
demo: selectores, código/dosis, número 9, nota multilinea y relectura tras recarga;
sugerencia de cultivo histórica y móvil 375 px sin overflow comprobados. Escape
protege el borrador. La revisión independiente cerró sus hallazgos. Evidencia y
límites completos en [TESTING](../TESTING.md#captura-con-ia-número-por-etapa-y-nota).
Publicación y activación real se registran por separado en [OPERATIONS](../OPERATIONS.md#captura-con-ia-y-nota-actualización).

## Productos reconocidos por sinónimos

La extracción conserva el nombre del mensaje. La revisión busca coincidencia
exacta única entre nombre/código/sinónimos de productos activos; recupera su ID
y código, identifica el alias y mantiene dosis/unidad del mensaje. Parecidos o
ambigüedades requieren selección. El selector presenta nombre e ingredientes,
ordenado alfabéticamente. [Sinónimos](product-synonyms.md).
