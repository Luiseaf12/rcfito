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
El acceso desde otros dispositivos no se verifica mientras falte
un endpoint HTTPS accesible. Sites contra loopback en el mismo equipo tampoco
se ha probado.

## Navegador de demostración

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
No hay endpoint HTTPS exterior configurado. Sites confirmó su despliegue
privado; esa publicación sirve la interfaz y no publica el Supabase local.

El checker documental comprueba destinos locales, no anchors ni URLs externas.
No certifica UX, RLS ni cálculos. Las referencias TS/TSX del bundle del estándar
no forman parte del código compilado de la aplicación.
