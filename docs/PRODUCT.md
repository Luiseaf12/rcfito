# Producto y flujos

## Estado y autoridad

Requisitos confirmados por el Propietario en esta conversación el 2026-10-31.
La primera entrega de catálogos y proyectos de siembra está implementada en React,
con adaptador Supabase Auth/REST/RPC, migración, RLS y función privada de usuarios.
La operación local tiene cuenta administradora, login y captura persistente
verificados. El acceso HTTPS de prueba y sus límites vigentes se registran en
[OPERATIONS](OPERATIONS.md).

El Propietario autorizó desarrollo, subagentes, commit/push y publicación en
Sites. El Propietario autorizó ahora desarrollar captura de aplicaciones,
agrupaciones guardadas, detalle y conteos por etapa, con subagentes. Esta
ampliación está implementada, publicada en Docker/Sites y probada en demo y
backend aislado. El frontend Docker ya consulta la lista real vacía
con sesión administradora; no se insertaron aplicaciones para esa comprobación.
El reporte completo queda para otra entrega. Al realizar una aplicación se
podrán cambiar productos, dosis y gasto de agua, conservando por separado lo
indicado y lo realmente aplicado; esas diferencias serán excepcionales.

## Primera entrega implementada

- Diez catálogos con Ver/Editar según permisos, búsqueda, filtros, paginación,
  baja lógica y eliminación protegida de registros relacionados.
- Usuarios, rol y agrícolas asignadas; alta real mediante función privada de
  servidor. Demostración con perfiles ficticios claramente identificados.
- Proyecto por agrícola/temporada, lotes propios, subdivisión de área completa
  por defecto, redistribución excepcional e historial.
- Etapas planeadas, registro de siembra real, cierre y retiro de la última
  planeación; secuencia y fechas controladas.
- Activación/cierre de temporada y copia de distribución sin etapas ni conteos.
- Configuración de URL/clave pública de Supabase y demostración local persistente
  en el navegador. No se incluyen datos reales de la operación.

Flujos: [catálogos](flows/catalogs.md), [proyectos](flows/sowing-projects.md) y
[navegación](flows/navigation.md). Evidencia y límites: [TESTING](TESTING.md).

## Objetivo

La captura asistida por IA y sus reglas confirmadas se describen en la
[ficha de captura con IA](flows/ai-capture.md). El Propietario autorizó su
implementación, commit/push y publicación el 2026-10-31.

Registrar y consultar las aplicaciones de productos realizadas en las agrícolas
de una empresa, con trazabilidad por campo, lote, subdivisión, etapa de siembra,
cultivo y temporada. Los medios de aplicación pueden ser dron, tractor, bomba
manual u otros configurados por el administrador.

El alcance es técnico y operativo. Se registra lo aplicado; quedan fuera
inventario, importes, costos, precios y comisiones. El uso será desde oficina y
celulares, siempre con conexión.

## Referencia

[mdron](https://github.com/Luiseaf12/mdron), revisión
`33d47194d7a230abe96edb7fd68c77fbae1b367d`, es la referencia solicitada para
examinar catálogos y captura de aplicaciones. La revisión fue de código,
especificación y migraciones; no se ejecutó su aplicación ni se consultaron sus
datos. Sus reglas comerciales, permisos de desarrollo y stack no constituyen
decisiones de rcfito.

## Definición del primer alcance

### Estructura operativa

| Concepto | Significado confirmado |
| --- | --- |
| Empresa | Organización que reúne varias agrícolas. |
| Agrícola | Unidad como Ensenada, Constitución, La Trinidad, Tula, Culiacán o Los Mochis; contiene campos. |
| Campo | Pertenece a una agrícola y es la referencia común para la distribución de lotes de cada temporada. |
| Lote | Forma parte de la configuración del proyecto de siembra; su superficie y distribución se conservan para esa temporada. Puede cambiar de tamaño, dividirse, unirse o dejar de existir en la siguiente. |
| Subdivisión | División espacial del lote; por defecto existe una sola que cubre todo el lote. |
| Etapa | Siembra sucesiva de una subdivisión dentro de una temporada; registra cultivo, variedad, superficie y fechas de siembra. |
| Proyecto de siembra | Representa una temporada de una sola agrícola y agrupa su configuración de campos, lotes, subdivisiones y etapas. |

### Temporadas, subdivisiones y etapas

- Cada agrícola captura su propio proyecto por temporada. Un proyecto pertenece
  a una sola agrícola. Puede haber temporadas activas simultáneamente en agrícolas
  diferentes; cada agrícola tiene una sola temporada activa.
- Mientras una agrícola tenga una temporada activa, no se pueden cargar datos a
  su siguiente temporada. Esta restricción no impide planear las etapas siguientes
  dentro de la temporada actual.
- Los lotes se definen dentro de cada proyecto de temporada. Puede cambiar su
  cantidad, distribución y superficie entre temporadas; no constituyen un catálogo
  global de lotes con superficie permanente.
- Cuando corresponda habilitar la captura del nuevo proyecto, se puede copiar la
  distribución de lotes de la temporada anterior como punto de partida y ajustar
  tamaños, agregar o retirar lotes, unirlos o dividirlos. La configuración del
  proyecto anterior permanece intacta.
- Un lote tiene por defecto una subdivisión que abarca toda su superficie;
  solo en casos especiales se crean varias subdivisiones mediante una decisión
  explícita del administrador.
- Copiar la distribución para una temporada nueva no arrastra etapas, aplicaciones
  ni sus conteos. La primera siembra de cada subdivisión inicia en etapa 1.
- Cada subdivisión inicia su propia numeración de etapas dentro de la temporada.
  Su primera siembra es etapa 1; terminada esa siembra, una nueva siembra en la
  misma subdivisión es etapa 2, y así sucesivamente, incluso si repite cultivo.
- Es posible planear una etapa siguiente mientras la etapa actual de la
  subdivisión continúa activa, dentro del mismo proyecto de temporada. La
  planeación anticipada es distinta de registrar la siguiente etapa como sembrada.
- Las subdivisiones pueden tener diferentes cultivos, superficies y fechas.
  Cada siembra registra cultivo y variedad, superficie, fecha planeada y fecha
  real de siembra.
- El tipo de infraestructura se asigna al lote completo dentro de su configuración
  de temporada; sus subdivisiones comparten ese tipo de infraestructura.
- El proceso se cierra por lote/subdivisión. La configuración de subdivisiones y
  siembras puede cambiar al terminar ese proceso, aunque la temporada continúe,
  conservando la versión histórica utilizada por las siembras anteriores.
- Conservar la configuración histórica usada por cada siembra y temporada:
  cambios posteriores de divisiones, superficies, cultivos o fechas no deben
  reescribir el historial anterior.
- Puede quedar superficie del lote de esa temporada sin sembrar. Esa situación debe quedar
  identificada y visible porque es excepcional. La representación de superficies
  físicas y sembradas se concretará en la propuesta.
- El número de etapa identifica una siembra; es distinto del conteo de
  aplicaciones de esa etapa. El conteo de aplicaciones se reinicia con cada nueva
  siembra, con cantidades separadas de indicadas, realizadas y canceladas. Una
  aplicación realizada con varios productos cuenta como una aplicación por etapa.

Ejemplo: un lote sin divisiones adicionales usa su subdivisión única. En una
temporada se siembra pepino en etapa 1; al terminar ese proceso se vuelve a
sembrar pepino en la misma subdivisión como etapa 2. Ambas siembras conservan
su configuración e historial propios.

### Catálogos

| Catálogo o relación | Definición confirmada |
| --- | --- |
| Agrícolas y campos | Catálogos que mantienen la estructura operativa común a los proyectos de siembra. |
| Lotes, subdivisiones y etapas | Configuración propia de cada proyecto de temporada, con historial; los lotes pueden copiarse de un proyecto anterior como base. |
| Cultivos y variedades | La variedad se relaciona con el cultivo de la siembra. |
| Productos | Nombre, unidad fija en gramos o mililitros y dosis predeterminada modificable en cada aplicación. |
| Usos de ingredientes | Catálogo configurable de clasificaciones para el uso principal de cada ingrediente; relación opcional única para conservar los registros actuales sin inventar su clasificación. |
| Ingredientes activos | Clasificación principal opcional; mantenimiento en [ficha de clasificaciones](flows/ingredient-classifications.md). Un producto puede relacionarse con varios ingredientes activos. Al capturar cada relación se solicita su concentración como dato opcional, propio de ese ingrediente en ese producto. |
| Marca y familia de producto | Datos opcionales del producto. |
| Tipos de infraestructura | Catálogo ampliable: mallasombra, campo abierto, invernadero y otros; se asigna al lote completo. |
| Medios de aplicación | Catálogo ampliable: dron, tractor, bomba manual y otros. |
| Usuarios y agrícolas asignadas | Administración de usuarios, sus roles y las agrícolas que cada usuario normal puede consultar; ver Usuarios y entorno. |

El equipo utilizado se menciona en un campo de texto de la aplicación; no existe
catálogo de equipos. La concentración se guarda en la relación producto-ingrediente,
porque puede variar entre productos que comparten un mismo ingrediente. Su
formato y unidad se concretarán en la propuesta.

El administrador puede ampliar los catálogos configurables. Su presentación y
mantenimiento aplicarán [CATALOGS](../.project-standards/CATALOGS.md), conservando
las referencias históricas de siembras y aplicaciones.

### Agrupaciones de siembras

Implementadas en la ampliación autorizada, con frontend Docker comprobado y
publicación final de Sites confirmada.
No forman parte de la primera entrega histórica de catálogos y proyectos.

El usuario puede guardar grupos con nombre para reutilizarlos al indicar
aplicaciones similares. Agrupan etapas de subdivisiones del mismo campo y
cultivo, por ejemplo sembradas en fechas cercanas. La selección es manual;
no se ha definido un umbral automático de cercanía de fechas.

Los integrantes apuntan a etapas concretas del mismo proyecto, campo y cultivo.
Al cerrar una etapa se conserva su pertenencia histórica y se excluye de los
destinos disponibles para órdenes nuevas; no se sustituye por una nueva siembra
de la misma subdivisión. El usuario revisa los integrantes vigentes al reutilizar
el grupo. Las órdenes pendientes de una etapa deben cancelarse antes de cerrarla.

### Aplicaciones: alcance confirmado

Alcance implementado y publicado. La [ficha previa](flows/applications.md)
define recorrido y criterios; registra por separado dominio, SQL/HTTP aislados y
navegador demo. El frontend Docker actualizado se comprobó con lectura real vacía
y sesión administradora; captura contra operación no ejercida en QA.

- Se captura una orden para uno o varios destinos de una temporada activa, de un
  mismo campo y cultivo. Los destinos se seleccionan directamente o mediante un
  grupo guardado y solo pueden ser etapas sembradas vigentes. Si un lote tiene
  subdivisiones con diferentes cultivos, se incluyen únicamente las subdivisiones
  del cultivo seleccionado, vinculadas a sus etapas de siembra.
- Todos los destinos de una orden comparten productos, dosis y gasto de agua
  indicados. La indicación guardada queda como lectura histórica. La realización
  conserva sus valores propios por destino, según la decisión de indicación y
  realización descrita más abajo.
  La orden tiene un único medio de aplicación elegido del catálogo. El equipo
  utilizado se menciona como texto, sin selección de un catálogo de equipos.
- Estados por destino: indicada, cancelada y realizada. Una orden con varios
  destinos puede tener unos realizados y otros todavía indicados.
- Distinguir cuándo se emitió la indicación, para cuándo se programó y cuándo se
  realizó. Los destinos pueden registrar diferentes fechas de realización.
  Conservar observaciones en cada aplicación.
- Se realizan completos los lotes/destinos indicados. La realización por partes
  de una orden corresponde a destinos completos, sin fraccionar la superficie de
  un mismo destino al registrar su realización.
- Puede cancelarse un destino específico dejando vigentes los demás. El motivo
  de cancelación es obligatorio.
- Antes de cerrar una etapa o proyecto, resolver las aplicaciones indicadas
  pendientes mediante realización o cancelación; las que no se realizaron se
  cancelan con motivo. El cierre no cancela silenciosamente ni borra historial.
- El nombre del aplicador se captura en un campo opcional; no requiere un catálogo
  independiente ni que la persona tenga usuario del sistema.
- Una aplicación puede contener varios productos. La dosis de cada producto se
  expresa en g/ha o ml/ha según su unidad fija. Modificar la dosis de una
  aplicación no modifica la predeterminada del catálogo.
- Siempre se indica el gasto de agua en litros por hectárea. No se requiere
  calcular automáticamente cantidades totales de agua ni de productos.
- La superficie procede de la siembra registrada en el proyecto.
- Al realizar se pueden cambiar los productos, sus dosis y el gasto de agua.
  El guardado conserva tanto la indicación original como lo realmente aplicado;
  los cambios de realización no sobrescriben la indicación ni modifican las
  dosis predeterminadas del catálogo.
- El caso habitual confirma expresamente que se aplicó lo indicado y guarda una
  copia como valores reales propios del destino, sin recapturar la mezcla.
  La casilla **Hubo cambios en productos, dosis o agua** inicia desmarcada; solo
  al marcarla se habilita la copia editable de esos valores excepcionales.
- El detalle compara indicado y realizado por destino. La lista filtrada y los
  conteos de indicadas/realizadas/canceladas por etapa forman parte de esta
  ampliación; no equivalen al reporte completo.

### Reporte

Requisito de entrega posterior. La lista filtrada, el detalle y los conteos por
etapa de esta ampliación no sustituyen el reporte completo.

Un solo reporte consultable con filtros por agrícola, campo, lote, etapa,
cultivo, producto y rango de fechas. Debe permitir agrupar por esas mismas
dimensiones. La representación explícita de la subdivisión se concretará junto
con los destinos de las aplicaciones.

El rango permite elegir fecha de indicación, programada o de realización; por
defecto utiliza la fecha programada. Las columnas y la presentación de las
agrupaciones se concretarán en la propuesta. No hay indicadores financieros.

### Usuarios y entorno

- Frontend implementado en React, TypeScript y Vite, por elección del Propietario
  para React y adaptación técnica de esta entrega.
- Backend con la API de Supabase, por elección del Propietario; PostgreSQL, Auth
  y las reglas de acceso forman parte de esa arquitectura. El diseño técnico se
  mantiene en [ARCHITECTURE](../ARCHITECTURE.md).
- Administrador: puede consultar y realizar todas las operaciones de captura y
  mantenimiento, incluida la asignación de agrícolas a usuarios.
- Usuario normal: solo puede consultar las agrícolas que la administración le
  haya asignado; no puede guardar cambios. Proyectos, campos, lotes, etapas,
  aplicaciones y reporte deben respetar ese ámbito de consulta.
- Persistencia en una instalación local de Supabase bajo Docker en este equipo.
  El acceso debe estar disponible desde oficina y celulares externos a la red
  local; el equipo permanecerá encendido durante el uso.
- Auth, RLS y asignaciones están implementados y se probaron en un stack aislado.
  La instalación local, su primera cuenta y la captura real se verificaron.
  El estado de HTTPS de prueba y del endpoint estable se mantiene en
  [SECURITY](SECURITY.md) y [OPERATIONS](OPERATIONS.md).

## Decisión sobre indicación y realización

Confirmación explícita del Propietario, 2026-10-31: «al realizarla se podrán
cambiar los productos, las dosis y el gasto de agua, conservando tanto lo
indicado como lo realmente aplicado». Esta decisión resuelve la ambigüedad de
la respuesta anterior «no se asumira que se aplico tal cual».

El Propietario precisó que cambiar productos, dosis o gasto de agua será muy
excepcional. Por ello, el recorrido habitual pide confirmar lo indicado y guarda
su copia como realización. La opción de cambios empieza apagada y permite
editar la copia real cuando se necesita; nunca modifica la indicación original.

La orden conserva su mezcla indicada. Cada destino realizado conserva la lista
de productos, dosis y gasto de agua efectivamente aplicados, además de su fecha
real y demás datos de realización. El detalle permitirá comparar ambas
versiones. Los destinos todavía indicados mantienen su estado y su indicación
cuando se registra la realización de otros destinos de la orden.

La captura de diferencias pertenece a la misma aplicación del destino; no genera
una aplicación adicional en el conteo de la etapa. Las consultas de lo aplicado
utilizarán los datos de realización conservando identificable la indicación.
El rango de fechas sigue usando la fecha programada por defecto, con las
alternativas de fecha de indicación y de realización ya definidas.

Esta regla está implementada y se verificó en dominio, backend aislado y demo.
El estado de despliegue y los límites de esa evidencia constan en la
[ficha](flows/applications.md#éxito-y-evidencia).

## Por concretar en la propuesta

La entrega posterior concretará columnas, agrupaciones y presentación del
reporte completo. La ampliación actual ya define destinos con estados propios,
indicación histórica, excepción de realización y vigencia de grupos en la
[ficha de aplicaciones](flows/applications.md).
Las pantallas de catálogos y proyectos y su esquema ya se implementaron dentro
del alcance autorizado; sus límites de operación/publicación están registrados
en [OPERATIONS](OPERATIONS.md) y [PLANS](PLANS.md).

## Documentación y verificación de flujos

Documentar cada flujo importante nuevo o intervenido con la
[ficha de flujo](../.project-standards/templates/flow.md), aquí o en una fuente
local enlazada. Usar las fichas de
[catálogo](../.project-standards/templates/catalog.md),
[navegación](../.project-standards/templates/navigation.md) o
[reporte histórico](../.project-standards/templates/historical-report.md)
cuando aplique. Mantener requisitos, decisiones y evidencia junto al flujo.

El pendiente de definición está en [PLANS](PLANS.md). El producto solo se
considerará verificado con las comprobaciones descritas en [TESTING](TESTING.md).

## Configuración administradora de IA

El administrador activo configura clave y modelo en Conexión y preferencias.
Probar confirma ambos antes de permitir guardar en el servidor; una clave vacía
conserva la existente. La clave completa no vuelve a mostrarse. La configuración
es común a la instalación y se usa en Captura con IA sin nueva publicación.
El lector no ve la sección ni tiene acceso a sus endpoints. Contrato operativo
y casos de error en [la ficha de configuración](flows/ai-settings.md).

## Cultivo ya registrado en la captura asistida

Cuando el mensaje omite cultivo y falta una aplicación anterior, usar el cultivo
único de las siembras vigentes de los destinos identificados del mismo campo y
proyecto. No volver a solicitar un dato ya determinado por esas siembras. Una
aplicación anterior compatible conserva prioridad; cultivos distintos o historia
contradictoria requieren revisión. No interpretar el nombre libre del proyecto
como un cultivo. [Contrato y evidencia](flows/ai-capture.md#cultivo-registrado-en-primeras-aplicaciones).

## Contexto conocido y pendientes de aprobación

La captura asistida completa agrícola/proyecto, campo y cultivo cuando los
datos activos autorizados permiten una coincidencia única, aunque falten nombres
de destinos. Los destinos sin identificar permanecen sin marcar y requieren
selección; las referencias ambiguas exigen revisión explícita. No inventar medio,
fechas, agua ni dosis a partir de datos de siembra o de otra aplicación.

El botón Aprobar usa la misma validación que el envío y muestra cada pendiente
por campo: incluye fechas anteriores a siembra, número repetido, salto pendiente
de confirmación, productos/unidades/dosis y destinos. Nota vacía es válida.
Completar o corregir lo señalado actualiza la lista y habilita la aprobación.
[Contrato y evidencia](flows/ai-capture.md#autocompletado-y-pendientes-de-aprobación).

## Edición de aplicaciones autorizada

La primera indicación permanece como historial. El administrador puede agregar,
quitar o cambiar productos, dosis, medio, agua, fechas y nota para todos los
destinos todavía pendientes; realizados/cancelados conservan su indicación.
También puede corregir los datos reales de un destino realizado, con productos,
dosis, agua y fecha real, equipo, aplicador y observaciones. Cada guardado exige
motivo y conserva antes/después, autor, fecha y versión. No cambia folio,
número por etapa, destinos, estado ni conteos. El lector consulta historial
asignado sin editar. Esta ampliación sustituye la restricción anterior de cancelar
y emitir de nuevo para corregir; [contrato de edición](flows/application-editing.md).

## Sinónimos y selección de productos

El administrador mantiene hasta 20 sinónimos por producto (2–80 caracteres).
Nombre/código/sinónimos exactos y únicos de un producto activo completan su código
en la captura IA; similitudes o ambigüedades requieren selección. El lector solo
consulta. Bloquear conflictos normalizados y parecidos entre sinónimos y términos
de otro producto, incluidos inactivos; comprobar también renombres/códigos.
El selector se ordena por nombre español/números y muestra una vez el nombre,
seguido de ingredientes configurados; conservar identidad/código y snapshots
históricos. Reglas exactas y aceptación: [ficha](flows/product-synonyms.md).

## Dashboard de uso de productos

Autorizado el 2026-11-01: en Resumen, tabla de productos realizados, ranking por
aplicaciones e historial al seleccionar. Solo temporadas activas; filtros de
agrícola, cultivo y número de etapa. Cantidades calculadas desde dosis/superficie
reales, promedio ponderado, última fecha real y etapas distintas por producto.
Conserva unidades y snapshots; no compara programado/ejecutado ni sustituye el
reporte completo. [Contrato, recorrido y evidencia](flows/product-dashboard.md).
