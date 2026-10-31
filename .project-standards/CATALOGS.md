# Catálogos reutilizables

## Alcance y adopción

Contrato obligatorio para catálogos nuevos o cuyo recorrido se intervenga en
Vales, Apoyosing o FI. Un catálogo es una colección de registros que permite
consultar y, según permisos locales, crear o editar. Aplicar esta norma junto con
[FRONTEND.md](FRONTEND.md) y [ENGINEERING.md](ENGINEERING.md). La ficha local usa
[templates/catalog.md](templates/catalog.md) y puede completar la ficha de flujo
existente; no duplicar requisitos ni inventariar pantallas ajenas al cambio.

Las reglas del producto gobiernan campos, estados, permisos, relaciones,
unicidad y operaciones admitidas. Registrar las diferencias justificadas en
`standards.config.json` y su complemento local, con motivo, responsable y revisión.
La adopción documental no acredita una migración de UI ni de persistencia.

Por solicitud del Propietario del 2026-10-14, **los controles y las composiciones
definidos aquí son obligatorios** para catálogos nuevos o intervenidos. Cada
catálogo debe implementar **Ver y Editar** conforme a sus permisos; consultar
[Acciones Ver y Editar](#acciones-ver-y-editar). La revisión de un catálogo
heredado registra su cobertura pendiente, sin declarar una migración realizada.

## Recorrido y estados

Listado → búsqueda/filtros → Ver o Editar → formulario modal → validación →
guardado → actualización del listado conservando contexto. La creación utiliza
el mismo contenedor y formulario cuando el producto permite crear registros.
Ver presenta un detalle de consulta; Editar presenta captura. No hacer pasar
campos deshabilitados por un detalle si dificultan lectura o acceso.

| Estado | Comportamiento observable |
| --- | --- |
| Carga inicial | Progreso accesible; sin mostrar vacío antes de terminar. |
| Listado | Acciones visibles según capacidades locales; registros con identidad estable. |
| Vacío | Explicar que no hay registros y ofrecer creación solo cuando corresponda. |
| Sin coincidencias | Mostrar filtros activos y permitir limpiarlos. |
| Error de consulta | Explicar el fallo y permitir reintentar; conservar filtros. |
| Actualización | Conservar datos previos y contexto; indicar que se están actualizando. |
| Detalle | Mostrar datos y acciones permitidas sin iniciar una mutación. |
| Captura inválida | Errores junto al campo, resumen cuando ayude y foco accesible. |
| Guardando | Bloquear doble envío y evitar descarte accidental de una operación pendiente. |
| Error de guardado | Conservar captura; permitir corregir o reintentar según el resultado. |
| Guardado confirmado | Confirmar persistencia; cerrar o pasar a detalle según el flujo local. |
| Error de actualización posterior | Informar «Guardado; no se pudo actualizar el listado» y ofrecer actualizar. |

Guardado y actualización posterior tienen resultados independientes. Una falla
al releer no puede anunciar que falló el guardado ni habilitar repetir una
creación ya confirmada. Si una respuesta se pierde y el resultado es desconocido,
reconciliar por identidad o mecanismo local de idempotencia antes de repetir
operaciones que puedan duplicarse. No anunciar éxito antes de confirmar persistencia.

## Composición y responsabilidades

Extraer partes repetidas con responsabilidades acotadas. Los nombres siguientes
identifican las composiciones obligatorias. Reutilizar una implementación
compartida por proyecto de `CatalogPage`, `CatalogToolbar`, `DataTable`,
`RecordDialog`, `RecordDetails` y estados comunes. Un adaptador puede conservar
nombres y APIs existentes si la ficha mapea su ruta y función al contrato.
Mantener los formularios propios de cada entidad sobre los controles comunes.

| Composición obligatoria | Responsabilidad | Controles obligatorios según su función |
| --- | --- | --- |
| `CatalogPage` | Título, acción principal, toolbar, resultados y contenedores de detalle/captura. | Composición; sin consulta ni reglas de negocio. |
| `CatalogToolbar` | Búsqueda, filtros, limpieza y contexto del resultado. | InputGroup + InputGroupInput + InputGroupAddon, Field/FieldLabel; Combobox/Select para filtros y Button para limpiar. |
| `DataTable` | Render de columnas, ordenación, paginación y acciones por fila. | Table y su composición; Button para ordenar y Ver/Editar; Pagination o controles comunes de página con Button. |
| `RecordDialog` | Título, foco, apertura, cierre y acciones del contenedor. | Dialog y su composición con título; Drawer/Sheet solo cuando el perfil móvil documentado lo requiera. |
| `RecordDetails` | Datos de consulta, etiquetas, estados y relaciones visibles. | Estructura semántica de detalle; Badge para el estado del registro y Separator para divisores de sección. |
| Formulario de entidad | Valores iniciales, captura, esquema y errores específicos. | FieldGroup + Field + FieldLabel + FieldError; Input para texto, Select/Combobox para opciones, Textarea para texto multilínea y MoneyInput para moneda. |
| Estados compartidos | Carga, vacío, error y actualización. | Skeleton para carga, Empty para vacío/sin coincidencias, Alert para errores y Spinner para indicadores gráficos adicionales de progreso. |

Los controles shadcn provienen de la instalación del consumidor; conservar su
primitiva, variantes y tokens. No sustituirlos por inputs, botones, tablas o
modales hechos aparte ni duplicar una composición por catálogo. El HTML semántico
de un formulario/detalle y los elementos nativos expresamente definidos, como
`datalist`, siguen formando parte de la composición. Usar solo los controles
que correspondan a los campos y estados existentes; no añadir campos o secciones
para completar la tabla.

Si falta un control, incorporarlo o adaptar la composición conforme al perfil
local antes de cerrar la implementación. Una diferencia técnica requiere el
registro indicado en Alcance y adopción; una preferencia visual o un nombre
coincidente no acredita conformidad. No imponer otro preset, marca o librería
de coordinación como efecto de esta obligación.

Separar tres fronteras:

1. **Presentación:** recibe datos, estado y callbacks; no importa cliente de base,
   credenciales ni reglas de persistencia. Usa los componentes/tokens del proyecto.
2. **Coordinación:** posee el estado del recorrido, carga y mutaciones; conecta
   capacidades, formulario y adaptador. Evita copias contradictorias de un registro.
3. **Datos/casos de uso:** consulta y guarda; traduce errores de frontera y aplica
   contratos del producto. No importa componentes visuales.

Cada entidad aporta columnas, filtros, identidad, valores iniciales, formulario,
detalle y capacidades. Reutilizar controles y contenedores; conservar formularios
especializados para relaciones, expedientes u operaciones complejas. Una colección
de opciones no debe convertirse en un generador universal que concentre reglas de
todos los productos. Extraer una variación solo cuando hay una repetición comprobada.

## Acciones Ver y Editar

Cada fila consultable tiene una columna **Acciones** con un `Button` visible
**Ver**. Cada fila editable por el usuario añade un `Button` visible **Editar**,
junto a Ver, también en móvil. Conservar los textos visibles y un nombre accesible
que identifique el registro, por ejemplo «Ver Banco Ejemplo» y «Editar Banco
Ejemplo». Los iconos, si se usan, son decorativos; no sustituyen el texto ni
hacen depender la acción de hover, doble clic o pulsar toda la fila.

- **Ver:** abre el `RecordDialog` compartido en modo consulta con `RecordDetails`
  del registro seleccionado. Permite Cerrar y ofrece Editar desde el detalle
  cuando el usuario tiene permiso. Consultar no crea ni guarda registros.
- **Editar:** abre el mismo contenedor con el formulario de la entidad,
  inicializado con los datos del mismo registro. Presenta Cancelar y Guardar,
  validación por campo y los estados de persistencia definidos en este contrato.
- **Permisos y bloqueos:** el controlador y el servidor conservan la autorización.
  No mostrar ni habilitar edición a quien carece de permiso; no añadir permisos
  por cumplir esta norma. Si el producto define registros de solo consulta,
  documentar esa condición y su fuente en la ficha. Un bloqueo temporal de
  escritura mantiene la opción identificable y explica su causa según el estado
  local, sin anunciar un guardado ni permitir doble envío.
- **Identidad y contexto:** Ver, Editar y Ver → Editar usan la identidad estable
  de la fila, conservan búsqueda, filtros, orden y página y devuelven el foco a
  un disparador visible al cerrar. La columna Acciones no se ordena ni participa
  en la búsqueda.

Un catálogo editable que ofrezca solo Ver, solo Editar o una acción sin recorrido
funcional no cumple el estándar. La ficha identifica los roles/capacidades de
ambas acciones y cualquier restricción de solo consulta basada en el producto.

## Búsqueda mientras se escribe

El listado se filtra al escribir o pegar texto, sin exigir Enter ni un botón
Buscar. Componer el buscador con etiqueta visible asociada, `type="search"` e
icono de lupa decorativo al inicio. El control obligatorio es `InputGroup` con
`InputGroupInput` seguido en el DOM por `InputGroupAddon align="inline-start"`;
marcar el icono `aria-hidden`. Reutilizar el control y los tokens del consumidor.

Conservar el texto capturado exactamente en el estado y en el campo: espacios,
mayúsculas, acentos y ceros iniciales. Normalizar únicamente una copia para
comparar o consultar, conforme al contrato local; no usar `trim()`, cambios de
caso ni recortes en el callback de captura. El buscador reduce el conjunto de
resultados, no modifica el texto ni los registros. No introducir límites de
longitud arbitrarios; documentar los límites existentes si el producto los exige.

Las sugerencias son opcionales. Un `datalist` nativo puede proponer valores del
conjunto ya disponible, sin forzar una selección ni sustituir automáticamente
lo escrito. Reutilizar Combobox cuando el producto necesite una interacción que
el control nativo no cubra; comprobar teclado y accesibilidad en ese caso. No
descargar todo un catálogo remoto únicamente para ofrecer sugerencias.

En modo local, filtrar el conjunto completo y acotado. En modo servidor, actualizar
la consulta con debounce/cancelación según el adaptador y descartar respuestas
anteriores; no presentar el filtrado de una sola página como búsqueda global.
Mostrar el resultado y el estado sin coincidencias con filtros vigentes; usar
conteos derivados o metadatos reales. Reiniciar la página al cambiar la búsqueda
según el contrato de estado y consultas.

Escribir conserva los demás filtros. Ofrecer limpieza accesible con alcance
claro: la cancelación nativa del campo limpia solo su texto; una acción «Limpiar
búsqueda y filtros» puede restablecer ambos a los valores iniciales locales.
Mantener el foco y el contexto del listado al abrir/cerrar Ver o Editar. Buscar,
seleccionar una sugerencia o limpiar nunca inicia una escritura de datos.

Comprobar escritura y pegado sin Enter, comparación normalizada sin alterar la
captura, ceros iniciales, consulta larga, sin coincidencias, limpieza, teclado y
conservación de filtros. El desplazamiento interno de texto largo en el campo
no debe recortar su valor ni causar overflow del documento, también en móvil y
con texto al 200 %. Registrar evidencia en la ficha del catálogo.

## Diálogos y portales

Ver y Crear/Editar usan el contenedor compartido del proyecto, con título,
descripción y acciones claras. El detalle presenta etiquetas y valores legibles;
la captura conserva el formulario específico de la entidad. Ambos deben aparecer
sobre toda la navegación, con un fondo modal que cubra también la barra lateral.
Mantener ancho limitado al viewport, altura máxima y scroll interno cuando sea
necesario; el título inicial y las acciones deben ser accesibles sin recortes.

La frontera de integración pertenece al adaptador visual del consumidor:

- Montar el portal en el contenedor de overlays del proyecto o en un host dentro
  de `document.body`, fuera de ancestros que recorten o cambien las coordenadas
  del diálogo. Conservar los tokens y el contexto de tema en ese host.
- Definir el nivel modal en la escala de capas del shell. Verificar el orden
  efectivo entre navegación, fondo modal, diálogo y controles emergentes; un
  número de `z-index` aislado no acredita que el contenido quede por encima.
  No elevar cada pantalla o selector con números arbitrarios. El valor concreto
  pertenece al perfil local; `200` es la adaptación de Apoyosing.
- Si se usa un host para overlays de posición fija, evitar `transform`, `filter`
  o `contain` que cambien su bloque de referencia, salvo diseño y verificación
  explícitos. Un host vacío no debe ocupar espacio en el layout del shell.
- Mantener los menús de Select/Combobox dentro del ámbito accesible del diálogo.
  Respetar el anidamiento de portales y la gestión de foco de la primitiva local;
  no enviar un selector interno a un host hermano que lo oculte para tecnologías
  de asistencia o lo deje detrás del modal. En esta referencia Base UI, el
  formulario omite el contenedor explícito y hereda el portal del diálogo.
- Conservar foco inicial, Tab/Shift+Tab contenidos y retorno al disparador o
  alternativa visible. Escape cierra primero un selector abierto y después el
  diálogo, respetando los bloqueos de guardado y descarte ya definidos.
- Si el adaptador crea un host, desmontar la raíz React y sus portales antes de
  retirar el host y liberar el estado de ese montaje. Remontar o cambiar ámbito
  no debe acumular hosts, diálogos ni cachés de la identidad anterior.

El contenedor común resuelve presentación, capas y accesibilidad; el controlador
de catálogo conserva permisos, selección, borrador y decisiones de cierre.
Consultar la [receta de integración](references/catalogs/README.md#portal-del-diálogo)
antes de copiar el ejemplo a otro shell.

## Estado y consultas

- Un propietario por responsabilidad: consulta del listado, datos del servidor,
  selección/modo del diálogo y borrador del formulario. Derivar conteos y resultados
  en lugar de mantener duplicados. Identificar la selección por ID estable.
- Conservar búsqueda, filtros, orden y página al abrir/cerrar y después de guardar.
  Cambiar filtros o tamaño de página vuelve al inicio; si una página deja de existir,
  ajustar a una página válida. Explicar cuando el registro sale del filtro vigente.
- Declarar modo **local** o **servidor**. Local procesa un conjunto completo y acotado.
  Servidor aplica búsqueda, filtros, orden y paginación al mismo conjunto; nunca
  filtrar u ordenar solo la página recibida como si representara todo el catálogo.
- Documentar campos buscables, normalización, orden por tipo y criterios iniciales.
  No imponer Activos, unicidad, acentos o una cantidad máxima entre productos.
  El orden paginado debe ser estable, con desempate por identidad cuando corresponda.
- El adaptador devuelve registros y metadatos suficientes para navegar: total real
  o continuidad/cursor. No inventar un total si el servicio no lo entrega.
- En consultas remotas, incluir los parámetros y el ámbito autorizado en la clave
  de caché; descartar respuestas de búsquedas anteriores. Limpiar o aislar caché al
  cambiar usuario/ámbito. Debounce y cancelación dependen del adaptador local.

## Captura, permisos y persistencia

Inicializar la captura al cambiar registro o modo; evitar que una recarga del
listado sobrescriba un borrador. Al cancelar o cambiar un borrador modificado,
confirmar descarte cuando pueda perder trabajo. Tras cancelar y reabrir, recuperar
valores persistidos según el contrato local. El detalle conserva Escape y retorno
de foco; cualquier bloqueo temporal del formulario debe explicar su causa.

Validar tipos y reglas conocidas en el formulario y volver a validar en el
servidor/base. Asociar errores de campo a controles y conservar un error general
para conflictos, falta de permiso o fallas sin campo. El permiso visual describe
capacidades; la frontera de confianza vuelve a autorizar cada operación.

Un guardado que el usuario percibe como una operación única debe tener un
resultado único. Para cambios dependientes, usar transacción/caso de uso atómico
del adaptador local. Si el producto admite resultado parcial, describirlo en la
ficha, devolver qué se confirmó y ofrecer recuperación precisa; no mostrar un
error general que oculte registros ya creados. No añadir transacciones remotas o
migraciones como consecuencia automática de adoptar documentación.

Después de confirmar, actualizar el registro y los conjuntos afectados según el
adaptador. Una invalidación no obliga a vaciar toda la caché ni a recargar la página.
Evitar doble envío también mientras se confirma una operación; el servidor conserva
sus propias garantías. Conflictos de concurrencia respetan la política local y
permiten revisar los datos vigentes antes de sobrescribirlos.

## Referencia React y adaptación local

Los controles y las composiciones de esta norma son obligatorios. La referencia
de coordinación usa React + TypeScript, componentes shadcn del proyecto,
TanStack Table para la tabla, React Hook Form + Zod para captura/validación y
TanStack Query para estado del servidor. Estas librerías de coordinación siguen
siendo una referencia; no es obligatorio instalar nuevas dependencias por adoptar
documentación. Fijar versiones compatibles, alias,
primitivas (Radix/Base/Aria) y convenciones del stack antes de integrar.

La referencia versionada está en [references/catalogs](references/catalogs/README.md),
con un ejemplo de Sucursales y datos ficticios. Sus tipos separan registro,
captura, consulta y resultado; no conectan con bases reales. Su adaptador de
ejemplo se reemplaza por los servicios y permisos del consumidor.

Fuentes oficiales para el adaptador:

- [Data Table de shadcn](https://ui.shadcn.com/docs/components/data-table): tabla
  por composición y extracción de piezas repetidas.
- [React Hook Form con shadcn](https://ui.shadcn.com/docs/forms/react-hook-form):
  controles y errores accesibles con Field.
- [Invalidación después de mutaciones](https://tanstack.com/query/latest/docs/framework/react/guides/invalidations-from-mutations):
  coordinación entre persistencia y consultas afectadas.

## Verificación y distribución

Completar la ficha local con recorrido principal, error recuperable, permisos y
evidencia de [FRONTEND.md](FRONTEND.md#accesibilidad-y-evidencia). Comprobar además
contexto conservado, cancelación/reapertura, doble envío, búsqueda sin resultados,
error de guardado y error de actualización posterior. Operaciones compuestas
requieren evidencia del resultado de persistencia en entorno aislado/autorizado.

Para declarar conforme un catálogo nuevo/intervenido, la ficha debe registrar
el mapa de composiciones/controles a archivos locales y demostrar Ver, Editar
desde fila y Ver → Editar sobre la misma identidad, con un actor autorizado y
otro de solo consulta. Comprobar botones visibles en escritorio/móvil, teclado,
validación, cancelación, permisos y contexto. El actor sin permiso no puede abrir
captura ni guardar mediante una llamada directa al controlador. El guardado se
verifica con datos ficticios o en un entorno aislado/autorizado.

La ausencia de un control obligatorio aplicable o de una acción autorizada es
una desviación que impide cerrar su adopción como conforme. Completar la
implementación o resolver la diferencia registrada antes de cerrar. Revisar
imports, uso real y comportamiento; el checker documental no certifica que
un control se renderice ni que las acciones funcionen.

La evidencia del modal debe incluir Ver → Editar, cierre y reapertura, selector
por teclado y desmontaje/remontaje, en escritorio y móvil. Revisar también texto
ampliado al 200 %, límites del viewport, scroll y acciones accesibles. Comprobar
superposición real del título, superficie y fondo sobre la navegación mediante
capturas y una prueba de capas cuando sea posible: `isVisible`, roles y ausencia
de overflow por sí solos no detectan un modal tapado. Los controles emergentes
deben ser visibles, seleccionables y permanecer en el ámbito accesible del diálogo.
Registrar en la ficha entorno, datos ficticios, tamaños, método de ampliación y
resultado; distinguir pruebas simuladas, publicación y aceptación del Propietario.

Piloto de adopción: Sucursales de Apoyosing, conservando sus campos y reglas
vigentes. Después evaluar Clientes para probar relaciones y resultado de guardado
compuesto antes de ampliar a otros catálogos. Un ejemplo con datos ficticios no
certifica ese piloto. Registrar resultado pendiente hasta ejecutar el flujo real.

Revisar impacto antes de distribuir: compatibilidad del adaptador, reglas locales,
componentes ya instalados y deuda heredada. Ejecutar checks del consumidor y
`npm run audit` central después de la adopción; no publicar ni modificar bases como
efecto de esa revisión. La referencia versionada acompaña al bundle, pero no se
inyecta automáticamente en el código de aplicación.
