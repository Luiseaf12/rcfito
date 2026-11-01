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

## Límites de cobertura

El navegador documentado probó la demostración. El backend HTTP se probó en un
entorno independiente. En operación local se verificaron login de administrador,
guardado, recarga y comprobación SQL de una agrícola, además de salud y rechazos
de acceso sin sesión. Los demás flujos reales no se infieren de esa captura.
El HTTPS exterior temporal tiene la evidencia separada de Quick Tunnel arriba;
no acredita una dirección estable ni disponibilidad de operación. Sites confirmó
su despliegue privado; servir la interfaz y arrancar el túnel son operaciones
separadas.

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
Los 34 tests y tipos/build se comprobaron sobre una revisión aislada que conserva
fuera de esta publicación los cambios de aplicaciones agrícolas en curso.
