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
