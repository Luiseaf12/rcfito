# Verificación y evidencia

## Comandos

Node.js 24 y npm. Ejecutar `npm ci` antes de checks de aplicación.

| Comando | Alcance |
| --- | --- |
| `npm test` | Reglas puras y conexión: permisos demo, relaciones, historial, transiciones y conservación del prefijo API. |
| `npm run typecheck` | Tipos de la aplicación TypeScript. |
| `npm run build` | Tipos y build Vite de producción a `dist/`. |
| `npm run docs:check` | Versión, hashes, mapa, enlaces de entradas y excepciones del estándar. |
| `node scripts/backend-test.mjs` | SQL, RLS y transacciones en PostgreSQL efímero, sin puertos. |
| `node scripts/backend-applications-test.mjs` | Migraciones y 116 comprobaciones SQL de regresión/aplicaciones en contenedor efímero; Auth stub. |
| `node scripts/backend-integration.mjs --fresh --cleanup` | Auth, REST, RPC, Edge y RLS reales en stack Supabase aislado. |
| `node scripts/backend-tunnel-check.mjs` | HTTPS, CORS, rutas bloqueadas, Auth y rechazos sin sesión sobre el Quick Tunnel activo. No crea datos de operación. |

Los scripts backend requieren Docker. Solo usan su proyecto/carpeta de QA y
fixtures ficticios; nunca leen el `.env` de la raíz. `--fresh` recrea el entorno
exclusivo de prueba y `--cleanup` lo detiene y retira sus datos. Detalles en
[backend-deployment](backend-deployment.md#pruebas-reproducibles).

## Evidencia de primera entrega: 2026-10-31

| Control | Resultado y límite |
| --- | --- |
| Dominio | 15/15 en [domain.test.ts](../test/domain.test.ts). Reglas puras con fixtures; no acredita servidor. |
| Tipos/build | `npm run typecheck` y `npm run build` aprobados por el agente principal. |
| SQL | 48 comprobaciones aprobadas: áreas, secuencia, copia, histórico, permisos y atomicidad. |
| HTTP real | 12 comprobaciones Auth/REST/Edge/RLS aprobadas con cuentas ficticias. |
| Aislamiento | Integración final detenida y sus datos ficticios retirados; contenedores ajenos conservados. |
| Compose | Composición Supabase validada con `docker compose config --quiet` y configuración ficticia; no inició operación. |
| Imagen frontend | Build aprobado con bases fijadas por digest. Contenedor efímero `rcfito-web-qa-20261031` respondió HTTP 200 con título correcto en loopback:5189 y fue retirado. No acredita operación. |
| Sites | Publicación privada exitosa confirmada por API nativa; inicio abierto en navegador. [Registro](OPERATIONS.md#primera-publicación-confirmada). |
| Dependencias | `npm audit --omit=dev`: cero vulnerabilidades. Auditoría total: 6 de tooling (2 bajas y 4 moderadas), pendientes de revisión; no se aplicó actualización forzada. |

## Inicio real local: verificado

Después de la primera entrega se inició la instalación de operación local,
separada de los entornos efímeros anteriores:

- Siete servicios del grupo `rcfito-supabase` sanos, con configuración privada y
  datos persistentes en `.artifacts/production-supabase`.
- Frontend Docker compilado en `http://127.0.0.1:5180`, con proxy `/supabase` y
  montaje exclusivo de configuración pública. En navegador muestra el acceso
  real de Supabase por esa configuración de arranque.
- Migración operativa aplicada con el helper; `--check` posterior: una aplicada,
  cero pendientes.
- `/supabase/auth/v1/health`: 200; settings de Auth: `disable_signup=true`;
  consulta REST anónima de agrícolas: 401. Rutas de PostgreSQL, proyecto/Studio
  y raíz `/supabase/` fuera del proxy permitido: 404.
- JSON público y bundle contrastados privadamente: sin clave de servicio,
  contraseñas BD/Studio ni secretos JWT. Conteos de operación antes de la
  primera cuenta: cero usuarios Auth, agrícolas y proyectos; sin fixtures.
- `npm test`: 17/17 aprobadas (15 de dominio y 2 de
  [conexión](../test/connection.test.ts)), según verificación del agente principal.
- Helper inicial: 18 casos simulados y 15 de regresión aprobados. Se corrigió
  `Referrer-Policy` del formulario para conservar origen en el envío; siguen
  rechazándose origen ausente/no permitido y `null`.
- El Propietario completó el formulario y confirmó su acceso. Tras recargar, el
  navegador mostró la sesión administradora de Supabase real, sin banner demo.
- Se creó una agrícola indicada por el Propietario; la interfaz confirmó
  guardado y el registro permaneció tras recargar y esperar la consulta.
  PostgreSQL confirmó un administrador activo, una agrícola y cero proyectos.
  No se cargaron fixtures; nombres, IDs y correo reales se omiten de Git.
- El asistente temporal quedó detenido. La contraseña fue elegida directamente
  por el usuario y no pasó por chat ni Git.

Esta evidencia cierra el arranque local, login y persistencia del recorrido
probado; no equivale a ejecutar todos los flujos contra la BD de operación.
Esta evidencia local no acredita por sí misma acceso desde otros dispositivos.
La verificación HTTPS posterior se registra abajo; Sites contra loopback no se
ha probado.

## Quick Tunnel HTTPS

2026-10-31: `rcfito-api-proxy` sano y `rcfito-quick-tunnel` activo en un grupo
Compose independiente. `node scripts/backend-local.mjs --check` confirmó una
migración aplicada y cero pendientes; no se reinició ni migró la base.

`node scripts/backend-tunnel-check.mjs` aprobó 20 comprobaciones sobre HTTPS
exterior: salud Auth, registro público deshabilitado, CORS/preflight para REST y
funciones desde Sites, rechazo de origen ajeno, rechazo de consultas anónimas con
y sin clave pública, rechazo del alta privada sin sesión y login ficticio
rechazado por Auth. Se comprobaron 404 para Studio, raíz, PostgreSQL, registro y
administración directa de Auth, incluidas variantes con doble codificación y
barra invertida. No se crearon cuentas ni registros de operación.

La revisión independiente encontró y se corrigieron diferencias de doble
decodificación entre proxy y gateway y la dependencia de las últimas líneas de
logs para recuperar la URL. La revisión posterior confirmó los 404 y la
conservación de consultas con acentos codificados. La URL se guarda ligada al ID
y arranque del contenedor, para invalidarla tras reinicios.

Se configuró el Site por UI y mostró la pantalla real de acceso de Supabase.
La conexión inicial fue publicada con resultado nativo `succeeded`, conservando
la audiencia privada; el JSON alojado y el acceso real se comprobaron en navegador.
El formulario publicado, con credenciales ficticias, alcanzó Auth a través del
túnel y mostró `Invalid login credentials`; no hubo error de CORS ni se creó una
cuenta. Esto acredita el recorrido de login fallido, no una sesión del Propietario.
`npm test` aprobó 17/17; tipos/build y checker documental aprobados. Vite se
configuró con `envDir: false` para no cargar el `.env` raíz durante el build.
El Propietario confirmó el acceso desde el Site con «Ya inicié sesión».
`node scripts/backend-tunnel.mjs status` confirmó el mismo túnel activo. La
herramienta de navegador no permitió reinspeccionar la pestaña después de esa
confirmación: el login exitoso se acredita por el Propietario, junto con las
pruebas HTTPS y del formulario anteriores, sin atribuir otra comprobación
automatizada de su sesión. No se acredita prueba en un celular ni disponibilidad
continua. El túnel es temporal y de prueba;
SMTP/recuperación sigue pendiente. Registro de versión en
[OPERATIONS](OPERATIONS.md#quick-tunnel-gratuito-para-pruebas).

## Navegador de demostración

La actualización automática del túnel tiene su evidencia independiente abajo.

Casos ejecutados por el agente principal a 1440 px en el frontend local:

- Crear «Cultivo de verificación», buscar `verificacion` sin depender de acentos,
  consultar Ver y abrir confirmación de descarte de un borrador modificado.
- Rechazar una temporada duplicada conservando la captura.
- Crear lote de 5 ha con subdivisión automática de superficie completa.
- Planear etapa 1 con cultivo, variedad y fecha; activar proyecto y registrar
  su siembra real.
- Simular lector de Ensenada: Culiacán fuera de su ámbito y sin controles de
  escritura.
- A 375 px, comprobar ausencia de desbordamiento horizontal general y ajustar
  el buscador para ese ancho.
- Cerrar el menú móvil con Escape.

Se corrigió el foco inicial de Ver para iniciar en el título del detalle. La
revisión completa de teclado, texto/zoom 200 %, altura reducida y contraste
medido sigue pendiente hasta registrar la evidencia final. Fichas detalladas:
[catálogos](flows/catalogs.md), [proyectos](flows/sowing-projects.md) y
[navegación](flows/navigation.md).

## Aplicaciones y grupos: entrega publicada

Evidencia del 2026-10-31:

- `npm test`: 54/54 aprobadas, incluidas las 20 de
  [aplicaciones](../test/applications.test.ts); `npm run typecheck` aprobado.
- SQL aislado: 116 comprobaciones (48 previas y 68 nuevas). HTTP con Supabase
  real aislado: 40 comprobaciones (12 previas y 28 de aplicaciones). El entorno
  exclusivo se detuvo y sus fixtures se retiraron.
- Demo en navegador, puerto 5174: crear indicación de un destino; abrir
  realización con cambios desmarcados y mezcla de lectura; confirmar y observar
  el destino realizado. Crear otra orden y registrar la excepción: producto A
  1 ml/ha frente a producto B 2 g/ha, agua 1 frente a 2 L/ha; el detalle conservó
  ambas mezclas. Crear y guardar un grupo manual con una etapa vigente.
- Reutilizar el grupo en una nueva indicación; cancelar un destino, rechazar
  motivo vacío y guardar con motivo. A 375 px no hubo desbordamiento general
  (documento de 360 px frente a viewport de 375 px).
- Revisión independiente y correcciones comprobadas en código: dosis hasta seis
  decimales, área de selección de 44 px y sin Editar para grupos de proyecto cerrado;
  SQL con diferencia real, nombres de grupos únicos, snapshots y bloqueos ordenados.
- Antes de aplicar el esquema de operación se generó un respaldo privado de
  PostgreSQL de 284149 bytes. Migración aditiva aplicada; ledger: dos aplicadas y
  cero pendientes. No se cargaron fixtures en operación.

En demo a 375 px se comprobó el lector sin Nueva indicación. Build, 54 pruebas,
tipos y docs aprobaron en el checkout aislado de esta entrega. El frontend Docker
quedó sano y el navegador en 5180 mostró sesión administradora, lista real de
aplicaciones vacía y ausencia de errores, sin insertar datos. Las nueve
comprobaciones HTTPS del Site aprobaron antes y después de publicar aplicaciones,
sin crear datos. GitHub recibió el commit validado, su workflow aprobó y Sites
confirmó `succeeded` para la versión 8, conservando audiencia pública y R2;
[registro exacto](OPERATIONS.md#despliegue-de-aplicaciones-y-grupos). Teclado completo y texto
200 % no están acreditados. La lectura real comprobada no equivale a ejecutar
captura de aplicaciones contra operación. Las capturas de esta ampliación
usan únicamente datos demo. Matriz: [aplicaciones](flows/applications.md#éxito-y-evidencia).

## Límites de cobertura

El navegador documentado probó la demostración. El backend HTTP se probó en un
entorno independiente. En operación local se verificaron login de administrador,
guardado, recarga y comprobación SQL de una agrícola, además de salud y rechazos
de acceso sin sesión. Los demás flujos reales no se infieren de esa captura.
El HTTPS exterior temporal tiene la evidencia separada de Quick Tunnel arriba;
no acredita una dirección estable ni disponibilidad de operación. Sites confirmó
sus revisiones anteriores; la audiencia vigente y el registro automático se
documentan abajo. Servir la interfaz y arrancar el túnel son operaciones separadas.

El checker documental comprueba destinos locales, no anchors ni URLs externas.
No certifica UX, RLS ni cálculos. Las referencias TS/TSX del bundle del estándar
no forman parte del código compilado de la aplicación.

## Actualización automática del túnel

Implementación del 2026-10-31: proxy de mismo origen, registro R2 de URL/vigencia y
publicador local con tarea Windows de inicio de sesión. Datos de negocio y
volúmenes de Supabase se conservan.

34 pruebas de dominio, conexión, Worker y publicador aprobadas. Cubren migración
de conexión y sesión del mismo backend, aislamiento de demo/custom, validación de
destinos/rutas, secreto de escritura, expiración del lease, caída sin cambio a
demo, conservación de JWT/apikey y cabeceras REST, exclusión de cookies/identidad,
rechazo de redirecciones y cambio del destino tras una renovación. Revisión
independiente realizada; se añadió timeout para que Docker no bloquee el monitor.

La tarea Windows quedó instalada y en ejecución con ACL privada para sus
credenciales y trigger de inicio de sesión. Sites confirmó `succeeded` para el
Worker con R2 operativo y el secreto runtime aplicado. Antes del despliegue Sites
ya figuraba público (revisión 2); se conservó esa audiencia y el secreto del
registro bloqueó actualizaciones sin autorización adicional.

`node scripts/site-connection-check.mjs` aprobó nueve comprobaciones: configuración
managed estable, lease del arranque actual, Auth por el proxy, HTML/JS del Worker,
rechazo de rutas administrativas y codificadas, datos/funciones sin sesión y
escritura del registro sin secreto. Se reinició solo `rcfito-quick-tunnel`, cambió
la URL y la tarea la registró sin ejecutar `once` ni republicar Sites; las nueve
comprobaciones volvieron a aprobar. La bitácora del monitor confirmó el cambio.
No se reinició la PC ni se modificaron datos de negocio para esta prueba.
Los 34 tests y tipos/build de esa publicación automática se comprobaron sobre una
revisión aislada, anterior a la entrega de aplicaciones documentada arriba.

## Edición válida de catálogos: 2026-10-31

17 pruebas nuevas cubren los diez catálogos, bloqueo por uso histórico, permisos,
referencias inactivas conservadas, campos inválidos y consulta paginada de uso de
productos. `npm test` aprobó 71 pruebas en el árbol integrado con aplicaciones y
51 en la revisión aislada de catálogos. `npm run typecheck`, `npm run build` y
`npm run docs:check` aprobaron en esa revisión. Tras integrar las aplicaciones
recién publicadas se repitieron los controles sobre el árbol final (71 pruebas).

`node scripts/backend-test.mjs` aprobó 65 comprobaciones SQL en PostgreSQL
efímero: edición de los diez catálogos, conservación de snapshots de lote/etapa,
restricciones de relaciones usadas, ingrediente existente inactivo y RLS. No se
requiere una migración para esta mejora; se conservan las restricciones del
servidor. La unidad usada ya está protegida por la migración de aplicaciones
cuando ese módulo está instalado. Auth stub no acredita una sesión real.

Navegador en demo a 1280 px: edición y persistencia tras recarga en los diez
catálogos; campo/variedad usados con relación bloqueada y motivo asociado;
clave original de producto conservada; descarte/reapertura, Escape y retorno
de foco; lector sin Crear/Editar. A 375 px, motivo legible y formulario con scroll
interno, documento de 375 px sin desbordamiento horizontal. La consulta del uso
de productos también funciona sin habilitar las pantallas de aplicaciones;
los errores de permisos/red no se interpretan como ausencia de uso. Esa frontera
se verifica con respuestas HTTP simuladas, no con escrituras en operación.

Revisión de React y contratos realizada por el autor: estado inicial estable,
validación compartida, controles deshabilitados durante guardado y motivo accesible.
No se presenta como revisión independiente. Zoom 200 %, contraste medido y
matriz completa de teclado permanecen en RCF-006. El build conserva la advertencia
previa de tamaño del chunk principal. Publicación: [OPERATIONS](OPERATIONS.md).

## Captura con IA, número por etapa y nota

2026-10-31: 113/113 pruebas de npm test aprobadas, incluidos 15 casos del dominio
de importación, 26 de aplicaciones y 28 de IA/Worker. npm run typecheck,
npm run build y npm run docs:check aprobados. El sandbox de Windows bloquea
subprocesos con EPERM; la ejecución autorizada fuera de esa restricción pasó.

SQL aislado: 161 comprobaciones (65 catálogos, 91 aplicaciones y 5 de backfill
sobre registros previos). HTTP/Auth/REST/Edge/RLS real aislado: 48 comprobaciones,
8 nuevas de número por etapa, origen/nota literales, reintento, conflictos,
permisos, reserva de número cancelado y continuación automática. El stack de QA
quedó detenido y sus datos ficticios retirados.

En navegador demo se completaron selectores y fechas vacías, código de producto,
dosis preservada, número 9 con confirmación del salto y nota editada en dos líneas.
El alta quedó indicada y la recarga conservó número, dosis, nota y origen. Una
segunda revisión sugirió el cultivo desde la aplicación anterior de la misma
etapa. A 375 px: menú de captura, diálogo, Escape/descarte y ancho sin overflow
(página375/375, diálogo328/328) después de corregir la grilla móvil. El lector demo carece del enlace y la URL
directa muestra captura reservada a administración.

Revisión independiente de interfaz/servidor/SQL encontró y cerró conservación de
nota completa, límites coherentes, contexto de agrícola corregida y reinicio de
confirmaciones. El módulo de importación conserva autorrevisión separada.

Operación: respaldo privado de 357,180 bytes, migración aditiva aplicada, ledger 3
aplicadas/cero pendientes, sin fixtures. Frontend Docker actualizado y HTML/bundle
200. La IA real permanece pendiente por decisión del Propietario; las pruebas
simulan el proveedor y no acreditan inferencia real ni captura UI en producción.

Sites versión 11 confirmó succeeded desde el commit validado; inicio/bundle 200,
IA anónima 401, proxy local 401 y salud Auth 200 posteriores aprobados sin
escrituras de operación ni inferencia. [Publicación](OPERATIONS.md#captura-con-ia-y-nota-actualización).

## Configuración de IA en Conexión y preferencias

2026-10-31: 136 pruebas, typecheck, build y docs:check aprobados. Incluyen servicio
con Auth/proveedor/R2 simulados, cifrado y manipulación, permisos, límites,
comprobante/expiración, escrituras concurrentes y captura usando la clave guardada.
El cliente descarta campos secretos inesperados y separa prueba de guardado.

Navegador: sección oculta para lector/sesión sin autenticar y demo administradora
con controles deshabilitados; escritorio y 375 px sin desbordamiento. Un arnés
aislado con el componente/adaptador/servicio reales y dependencias ficticias
verificó probar, invalidar al editar, guardar, recargar y conservar clave al cambiar
modelo. Sin claves reales, inferencia externa ni datos de operación. Revisión
independiente sin pendientes. [Ficha y alcance](flows/ai-settings.md).

## Cultivo registrado en primeras aplicaciones

2026-10-31: 140 pruebas, typecheck y build aprobados. Las 19 pruebas de importación
cubren primera aplicación al seleccionar temporada, historia parcial compatible,
etapas anteriores excluidas, selector explícito, cultivos distintos e historia
contradictoria. QA de navegador demo: aplicación 1 con Pepino y destino completos
automáticamente sin una aplicación anterior. Sin peticiones reales al proveedor
ni escrituras de datos operativos. [Ficha](flows/ai-capture.md#cultivo-registrado-en-primeras-aplicaciones).

## Autocompletado y pendientes de aprobación

2026-10-31: 161 pruebas completas, tipos y build aprobados. Incluyen 24 casos de
importación y 16 del validador compartido: ámbito activo/único, ambigüedad,
selecciones explícitas, dosis/unidades, fecha de siembra, duplicados incluso
cancelados, saltos de numeración y confirmaciones. Revisión independiente sin
hallazgos pendientes.

Navegador demo: contexto conocido preseleccionado, lista exacta de medio/fechas,
fecha anterior a siembra y número 23 confirmado antes de habilitar Aprobar.
Guardado con nota vacía y relectura tras recarga; duplicado identificado, cambio
de número invalida confirmación y unidad incompatible exige corregir dosis.
Mensaje sin contexto completa proyecto/campo/cultivo únicos sin marcar destinos.
Móvil 375 px sin desbordamiento y lista completa visible. Solo datos ficticios
en un origen local separado; sin consumo del proveedor ni escrituras operativas.
[Ficha](flows/ai-capture.md#autocompletado-y-pendientes-de-aprobación).

## Edición de aplicaciones e historial

2026-10-31: 181/181 pruebas de npm, TypeScript y revisión independiente sin
hallazgos pendientes. Incluyen 17 nuevas de dominio, tres de conciliación REST
y protección de catálogos usados solo en historial. SQL aislado: 244 comprobaciones
(65 catálogos, 91 aplicaciones, 78 edición, 10 actualización sobre registros
anteriores). HTTP/Auth/REST/RLS aislado: 71 (23 nuevas), repetidas tras endurecer
validaciones. Conflictos/reintentos, firma privada, fechas/tipos, cierre y permisos
comprobados; stacks aislados retirados, sin fixtures en operación.

UI demo aislada 5184: orden de tres destinos, uno realizado y otro cancelado;
revisión del único pendiente con A500→600 ml/ha, B250 g/ha agregado, agua660→700,
fechas20/21→23/24 octubre y nota/motivo. Los dos terminales retuvieron revisión0;
el pendiente recibió revisión1 y se realizó con esa nueva mezcla sin diferencias.
Corrección del primer realizado a A550+C100 ml/ha, agua680 y fecha23: historial
comparado conservó A500/agua660/fecha22, autor/motivo y conteos 0/2/1. Recarga
conservó corrección y eventos. Móvil sin overflow de página (360/360), historial
legible; lector demo consulta las versiones y carece de acciones de edición.
Estas capturas solo acreditan demo local; permisos reales se verificaron en el
backend aislado. Publicación y migración operativa en OPERATIONS.

Publicación comprobada: Site versión16 y Docker sirven el mismo commit 7942b85.
Catorce comprobaciones posteriores aprobadas: inicio/bundle/editor/historial y
salud Auth 200 en ambos, captura/configuración e historial anónimo 401. Ledger
operativo 4/0 y conteos de negocio intactos tras migrar. No se hicieron capturas
ficticias ni correcciones de datos reales en operación para esta verificación.

## Sinónimos y selector de productos

2026-11-01: 197 pruebas npm, TypeScript, build y docs:check aprobados. Incluyen
12 casos nuevos de sinónimos/etiquetas y cuatro de matching; conservación de
nombres oficiales heredados parecidos y bloqueo de borrar productos con aliases.
SQL aislado: 308 controles (64 nuevos). HTTP/Auth/REST/RLS: 87 (16 nuevos), con
carrera entre sinónimos similares y un único ganador. Validaciones Unicode,
límites, inactivos, inversión por renombre/DML, omisión/reemplazo y rollback
producto/composición/alias/auditoría comprobados; stacks QA retirados.

UI demo aislada 5185: alta de alias, detalle, persistencia tras recarga y búsqueda;
alias casi igual en otro producto bloqueado identificando al dueño y conservando
entradas. Descarte protegido. Revisión ficticia con nombre alterno resolvió el
producto/código y grabó la indicación con nombre oficial, dosis500ml y agua660.
La extracción del ejemplo se sustituyó solo en el harness ignorado de QA; no se
consumió el proveedor ni se probaron capturas ficticias en operación. Selector
Álamo/Beta/Zeta con ingredientes largos, sin nombre duplicado y sin overflow
móvil: página375/375, opciones276/276. Lector sin edición, aliases consultables.
Migración operativa con respaldo validado y ledger5/0.

Sites versión17 y Docker confirmados desde el commit cf245f9. Dieciséis
comprobaciones posteriores aprobaron: inicio/bundles/editores y salud Auth 200;
captura/configuración y tabla de sinónimos sin sesión 401 en ambos orígenes.
La configuración del proveedor se conservó; no se realizaron capturas ficticias
ni mutaciones de productos reales para verificar la publicación.

## Dashboard de uso de productos

[product-usage.test.ts](../test/product-usage.test.ts) cubre conteos por destino,
unidades, ponderación, correcciones/snapshots, filtros, permisos demo e incompletos.
La rectificación a Todas por defecto cubre los tres estados, temporadas cerradas,
indicaciones revisadas/canceladas congeladas, fechas según estado y falta de
historial sin fallback. No se escriben fixtures ni se capturan aplicaciones en
operación para verificar.

La primera revisión limpia aprobó 206 pruebas, tipos/build y checker. QA demo en
5193 con doce productos y quince destinos comprobó filtros, paginación de tabla e
historial, promedio ponderado, recarga conservando filtros, Escape y retorno de
foco, orden por fecha y lector limitado a su agrícola. A 375/1440 px, sin overflow
de página y con scroll de tablas contenido. Etapa inválida devuelve vacío; sin
errores de consola. El commit limpio también se comprobó en 5194.

Rectificación: 215 pruebas integradas aprobadas (13 del dashboard), tipos y
checker válidos. QA demo con 18 destinos comprobó Todas por defecto, cambio a
Realizadas/Canceladas, fechas/estados y temporada anterior en historial. A 375 px
no hubo overflow; estado inválido de URL no rompe el render ni amplía la consulta.
Revisión limpia: 215/215 pruebas, tipos/build y checker aprobados desde
`5266322878a855aa59b66e51842305a279bfe636`. Sites versión 19 confirmó succeeded;
HTML, bundle exacto y dashboard HTTP 200, con Todas y estados presentes. No se
escribieron datos ficticios en operación. [Publicación](OPERATIONS.md#dashboard-de-uso-de-productos).
[Contrato](flows/product-dashboard.md#verificación-y-publicación).

## Usos de ingredientes

2026-11-01: 211 pruebas cliente en la revisión integrada, 327 SQL y 99 HTTP
aislados aprobados. QA demo de relación, recarga, búsqueda, inactivos, lector
y formulario móvil; autorrevisión de permisos/persistencia. Doce comprobaciones
posteriores en Site/local aprobaron sin escrituras ficticias en operación.
[Evidencia y límites](flows/ingredient-classifications.md#verificación).

## Resumen por lote

[lot-usage.test.ts](../test/lot-usage.test.ts) comprueba identidad de lotes y
temporadas, destinos únicos con mezclas, superficies sin multiplicar, historia
del producto restringida al lote, filtros/estados, permisos y relaciones
incompletas. Orden numérico ascendente con g/ml intercalados y desempates
estables; comparte snapshots de indicaciones revisadas y realizaciones.
QA demo aislada en 5195 con trece lotes y productos g/ml intercalados:
Todas por defecto, conteos/superficies, lotes homónimos de distintas temporadas,
paginación de lotes/productos e historial exclusivo del lote comprobados. Escape
y cierres devuelven foco; paginar lotes cierra el detalle anterior. Lector limitado
a Ensenada, sin Culiacán. A 375/1440 px sin overflow de página; tablas con scroll
propio y cero errores de consola. Revisión independiente integrada.
Checkout limpio `ce7ed07fdd7c8ba593f4457627d96f20da488aaa`: 224/224 pruebas,
tipos/build y checker aprobados. Sites versión 20 confirmó succeeded; tres
comprobaciones posteriores de HTML/bundle exacto/dashboard HTTP 200 aprobadas.
[Publicación](OPERATIONS.md#publicación-del-resumen-por-lote).
Sin fixtures ni escrituras en operación.
[Fuente](flows/product-dashboard.md#ampliación-resumen-por-lote).

## Regresión de captura al volver a la ventana

2026-11-01: fixture aislado con `WorkspaceProvider`, `App` y formularios reales,
sesión y datos ficticios; sin acceso a operación. Un aviso `SIGNED_IN` del mismo
usuario reproducía el cierre del diálogo y la pérdida del texto antes del cambio.
Después de la corrección se comprobaron:

- Alta de producto: nombre y foco conservados al repetir `SIGNED_IN`, renovar
  con `TOKEN_REFRESHED` y fallar la siguiente consulta de datos.
- Nueva indicación: nota y agua de 250 L/ha conservadas tras ambos avisos.
- Consulta fallida: error visible con opción de actualizar, sin perder la captura.
- Descarte explícito: sigue requiriendo confirmación; cerrar sesión muestra login
  y retira el contenido de la cuenta.

`npm test`: 224 aprobadas; TypeScript aprobado. El fixture y la captura de QA
contienen únicamente ejemplos y no se incluyen en el build. Esta evidencia
comprueba la reacción del frontend a los eventos de Auth; no acredita una
recuperación de borradores después de recargar manualmente el documento.

Publicación de la corrección: Docker sano y Sites versión 21 `succeeded`;
HTML/bundle exacto comprobados en ambos destinos y nueve checks de conexión
aprobados sin crear datos. Evidencia en
[operación](OPERATIONS.md#captura-conservada-al-revalidar-sesión).

## Filtro global por lote

2026-11-01: cuatro casos en lot-usage.test.ts comprueban métricas, productos,
ranking e historial limitados al lote, intersecciones con todos los filtros,
identidades homónimas, IDs desconocidos/ajenos, jerarquía inválida y workspace de
lector. 228 pruebas cliente y tipos aprobados. QA demo aislado en 5196 confirmó
selección de dos lotes con resultados distintos, historial exclusivo, recarga,
cambio de agrícola y limpieza. Todas y Todos los lotes por defecto; cantidades
ascendentes mixtas conservadas. 375/1440 px sin overflow de página ni errores de
consola. Revisión independiente sin hallazgos. Revisión limpia 20c8ca6: 228/228
pruebas, tipos/build y checker aprobados. Sites versión 23 succeeded y tres
comprobaciones HTTP 200 de HTML/bundle/filtro aprobadas. No hubo escrituras en operación.
[Contrato](flows/product-dashboard.md#filtro-global-por-lote) y
[publicación](OPERATIONS.md#publicación-del-filtro-global-por-lote).

## Decimales en reportes

2026-11-01, RCF-027: 228/228 pruebas cliente, tipos y checker aprobados; ocho
comprobaciones puntuales de formato es-MX, redondeo hacia arriba/abajo, ceros
finales, conversión y cantidades pequeñas/grandes aprobadas. QA demo
local en 5196 confirmó métricas, tabla general, ranking con conteos enteros,
resumen/productos por lote e historial. Ejemplos: 3.60 L, 28.00 ha y promedio
128.57 ml/ha. Móvil a 375 px sin overflow de página y cero errores de consola.
Autorrevisión: el cambio se limita al formato de salida, sin tocar dominio,
ordenamiento, snapshots o formularios. Sin migraciones ni escrituras de datos
operativos. [Regla](FRONTEND.md#decimales-en-reportes).
Revisión limpia 672dd1b: build/checker aprobados y workflow de GitHub success.
Sites versión 24 succeeded y tres comprobaciones HTTP 200 de HTML, bundle exacto
y formato de dos posiciones aprobadas. QA local detenido y tab cerrado.
[Publicación](OPERATIONS.md#dos-decimales-en-reportes).

## Consultas de aplicaciones por chat, audio y CLI

Verificación 2026-11-01: `npm test` aprobó 265 pruebas integradas; tipos y build
aprobados. Pruebas nuevas cubren filtros, planes estructurados, Auth/perfil,
formatos/firma/tamaño de audio, reutilización de configuración, límites, caché
por usuario/revisión, invalidación, CLI login/refresh/logout, fuentes, cifras y
recuperación. Worker ESM compilado importa y resuelve las tres rutas nuevas.

`node scripts/backend-queries-test.mjs`: 75 comprobaciones SQL aprobadas en
PostgreSQL efímero con siete migraciones. `node scripts/backend-applications-test.mjs`
aprobó la regresión existente. `node scripts/backend-integration.mjs --fresh --cleanup --advisors`
aprobó Auth/REST/Edge/RLS y 19 verificaciones HTTP nuevas de consultas, incluidas
correcciones/revisión y pérdida de asignaciones o desactivación con el mismo JWT.
Advisors sin WARN/ERROR. El stack aislado quedó detenido y sus fixtures retirados.

La verificación del proveedor usa respuestas ficticias: no acredita inferencia
o reconocimiento de voz reales. QA navegador y despliegue se registran en
[la ficha](flows/application-chat.md) y [operación](OPERATIONS.md).
## Contexto implícito y totales por malla

2026-11-01: 281 pruebas integradas, tipos/build y checker aprobados. El caso
literal «cuánto de cada producto se ha aplicado en malla 5» está cubierto en el
CLI y handler compartido: última agrícola por usuario, temporada activa, lote
único, productos/total y procedencia de filtros. Incluye listas de35 y305
productos, aislamiento entre usuarios y cambios de revisión durante paginación.

SQL:124 comprobaciones de consultas (75 anteriores y49 de contexto). Integración
completa:129 comprobaciones HTTP/Auth/REST/Edge/RLS, con30 del módulo consultas.
El pipeline CLI→handler→Auth/REST→resolver→consulta se ejerció sin simulación de
base/Auth: última Ensenada ficticia, Malla5 y Malla15, temporadas anteriores,
realización corregida80g/40ml, indicadas999 y canceladas888 excluidas. La pregunta
mostró dos productos, filtros last_used/active_season/unique_match y cero tokens.
Advisors sin WARN/ERROR; stack aislado detenido y fixtures retirados.

Los resultados y nombres de esa prueba son ficticios, sin inferencia real ni
escrituras de aplicaciones en operación. QA de tablas/despliegue se registra en
[la ficha](flows/application-chat.md#contexto-implícito-y-tabla-de-consumo-por-malla).

## Origen de grupo en aplicaciones

2026-11-02, RCF-029: `npm test` 290/290; tipos/build y checker documental
aprobados. `backend-applications-test.mjs`: 351 comprobaciones SQL con nueve
migraciones; incluye actualización de historia previa sin atribución de grupo,
reintentos, varias pertenencias y conservación de origen/estados. Integración
Auth/REST/RPC/RLS: 153 comprobaciones totales, 21 nuevas del origen de grupo;
advisors de seguridad local sin WARN/ERROR. Ambos entornos de QA se retiraron.

La integración admite `RCFITO_SUPABASE_CLI` con la ruta a la CLI oficial para
invocarla directamente desde su directorio aislado. Esta entrega usó 2.120.0;
se evitó que `npm exec` buscara el entorno en un proyecto padre. Nunca usar el
`.env` raíz para QA. No se cambió la versión del stack de operación.

Navegador demo: grupo guardado, indicación grupal e individual del mismo lote,
recarga y origen/pertenencia correctos. Captura conservada al corregir dosis y
contexto visible al aparecer destinos. Detalle a 1440/375 px, sin overflow de

## Corrección histórica excepcional del grupo

2026-11-02: `node scripts/backend-group-backfill-test.mjs` aprobó 11
comprobaciones en un contenedor PostgreSQL efímero sin puertos, después retirado.
Cubre historia ficticia, plan desactualizado, simulación con rollback, aplicación
con auditoría, valores originales intactos, rechazo de repetición, guardas
restauradas y ausencia de permisos del cliente sobre la auditoría.

En operación se verificó un plan privado de 23 aplicaciones y 92 destinos,
simulación revertida, respaldo validado y aplicación única. Una conexión nueva
contrastó las huellas de órdenes y destinos, origen/pertenencias nuevos, una sola
entrada de auditoría y cuatro guardas habilitadas. Registro 9/0. No se crean
fixtures reales ni se modifican productos, fechas, estados o números.
[Registro](OPERATIONS.md#corrección-histórica-excepcional-del-grupo).
página a 375 px. Teclado completo, zoom y contraste medido siguen en RCF-006.
[Detalle, autorrevisión y límites](flows/application-group-origin.md).

Tras publicar RCF-029: cinco controles locales del frontend Docker sano y nueve
HTTPS del Site aprobados. Se confirmó el código nuevo en el bundle servido,
Auth y rechazo de datos sin sesión. Ninguno crea fixtures en operación.
[Fuente y despliegue](OPERATIONS.md#origen-de-grupo-en-aplicaciones).
