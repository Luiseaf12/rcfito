# Producto y flujos

## Estado y autoridad

Requisitos confirmados por el Propietario en esta conversación el 2026-10-31.
La primera entrega de catálogos y proyectos de siembra está implementada en React,
con adaptador Supabase Auth/REST/RPC, migración, RLS y función privada de usuarios.
La demostración de navegador y el backend aislado se verificaron por separado;
la instalación de operación y su endpoint HTTPS siguen pendientes.

El Propietario autorizó desarrollo, subagentes, commit/push y publicación en
Sites. Las órdenes de aplicación, agrupaciones guardadas y reporte corresponden
a una entrega posterior. Se conserva su aclaración pendiente sobre lo realizado
respecto de lo indicado; no bloquea la entrega actual.

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
| Ingredientes activos | Un producto puede relacionarse con varios ingredientes activos. Al capturar cada relación se solicita su concentración como dato opcional, propio de ese ingrediente en ese producto. |
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

Requisito para la entrega posterior de aplicaciones; no está implementado en
la primera entrega de catálogos y proyectos.

El usuario puede guardar grupos con nombre para reutilizarlos al indicar
aplicaciones similares. Agrupan etapas de subdivisiones del mismo campo y
cultivo, por ejemplo sembradas en fechas cercanas. La selección es manual;
no se ha definido un umbral automático de cercanía de fechas.

La representación de integrantes al cerrar una etapa o cambiar la configuración
se concretará en la propuesta, conservando las referencias históricas. Las
órdenes pendientes de una etapa deben cancelarse antes de cerrar esa etapa.

### Aplicaciones: alcance confirmado

Requisitos confirmados para desarrollo posterior; esta entrega no registra
órdenes de aplicación ni genera sus conteos.

- Se captura una orden para uno o varios destinos de un mismo campo y cultivo,
  seleccionados directamente o mediante un grupo guardado. Si un lote tiene
  subdivisiones con diferentes cultivos, se incluyen únicamente las subdivisiones
  del cultivo seleccionado, vinculadas a sus etapas de siembra.
- Todos los destinos de una orden comparten productos, dosis y gasto de agua.
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
- Antes de cerrar una etapa, cancelar sus aplicaciones indicadas pendientes.
- El nombre del aplicador se captura en un campo opcional; no requiere un catálogo
  independiente ni que la persona tenga usuario del sistema.
- Una aplicación puede contener varios productos. La dosis de cada producto se
  expresa en g/ha o ml/ha según su unidad fija. Modificar la dosis de una
  aplicación no modifica la predeterminada del catálogo.
- Siempre se indica el gasto de agua en litros por hectárea. No se requiere
  calcular automáticamente cantidades totales de agua ni de productos.
- La superficie procede de la siembra registrada en el proyecto.
- El tratamiento de diferencias entre indicación y ejecución conserva la
  aclaración pendiente del apartado siguiente; todavía no se fija una regla.

### Reporte

Requisito de entrega posterior; el resumen actual muestra siembras y proyectos,
no sustituye este reporte de aplicaciones.

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
  La instalación de operación, su primera cuenta y acceso HTTPS exterior siguen
  pendientes. Consultar [SECURITY](SECURITY.md) y [OPERATIONS](OPERATIONS.md).

## Por definir antes de la propuesta

La respuesta a la pregunta sobre registrar diferencias entre indicación y
ejecución fue «no se asumira que se aplico tal cual». Falta distinguir si significa
«No; se asumirá que se aplicó tal cual», sin un registro de cambios de ejecución,
o «No se asumirá que se aplicó tal cual», que requeriría confirmar qué se aplicó
realmente. Mantener esta decisión pendiente hasta recibir la aclaración.

La entrega posterior concretará columnas del reporte, representación de una
orden con destinos en diferentes estados y vigencia de grupos al cerrar etapas.
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
