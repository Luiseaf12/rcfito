# Arquitectura de RCFito

## Implementación actual

Frontend React 19, TypeScript y Vite 8, con HashRouter para rutas estáticas en
Sites y Docker. shadcn usa base Radix y estilo nova; tema local, Geist e iconos
Lucide. Versiones exactas en [package.json](package.json) y su lockfile.

| Frontera | Archivos y responsabilidad |
| --- | --- |
| Presentación | [App](src/App.tsx), [features](src/features/catalogs.tsx) y controles de `src/components/ui/`: shell, catálogos, proyectos, usuarios y conexión. |
| Coordinación | [WorkspaceProvider](src/data/workspace-context.tsx): sesión, consultas, mutaciones, modo y recuperación. |
| Modelo y dominio demo | [model](src/domain/model.ts), [rules](src/domain/rules.ts), [demo](src/domain/demo.ts): DTO, reglas puras y fixtures ficticios. |
| Datos reales | [Adaptador Supabase](src/data/supabase.ts): Auth, tablas y RPC; traduce nombres/estados del backend al DTO. |
| Conexión de arranque | [Configuración](src/data/connection-config.ts) y [main](src/main.tsx): carga opcional de `rcfito-config.json` con URL y clave pública antes de montar la aplicación. |
| Backend | [Migración](supabase/migrations/20261031233122_catalogs_and_sowing_projects.sql), RLS y funciones transaccionales; [alta privada](supabase/functions/admin-create-user/index.ts). |
| Despliegue | [Frontend Compose](compose.frontend.yaml), [adaptación Supabase](infra/supabase/compose.rcfito.yaml) e [identidad Sites](.openai/hosting.json). |

La presentación no importa el cliente Supabase. Las reglas demo no se consideran
una frontera de seguridad. El servidor real autentica, autoriza y comprueba las
restricciones ante peticiones directas. No hay API Fastify propia.

## Datos e historial

Agrícolas/campos son referencias comunes. Cada proyecto pertenece a una agrícola
y temporada; sus lotes, áreas y subdivisiones son una configuración independiente.
Copiar distribución crea identidades nuevas, sin siembras ni conteos. Las etapas
son siembras sucesivas de una subdivisión.

Los snapshots de campo/infraestructura/cultivo/variedad y las subdivisiones
retiradas conservan el historial. RLS delimita proyectos, lotes y etapas a las
agrícolas asignadas. La concentración opcional pertenece a producto-ingrediente.
El equipo se capturará como texto en aplicaciones futuras.
Contrato completo: [backend-api](docs/backend-api.md).

## Backend elegido: API de Supabase

El Propietario eligió Supabase local bajo Docker: PostgreSQL, Auth, Data API/RPC
y funciones privadas de servidor. La migración implementa guardas de temporada,
superficie y secuencia, default de subdivisión, preservación histórica, copia y
guardados compuestos. El alta de cuentas valida JWT y perfil administrador antes
de usar la clave privada. Consultar [SECURITY](docs/SECURITY.md).

Se ejecutaron 48 verificaciones SQL y 12 comprobaciones con Auth/REST/Edge/RLS
reales en entornos aislados. La instalación de operación ya tiene sus siete
servicios activos y persistencia local. La migración registra una aplicada y
cero pendientes; el navegador abre el acceso real y la API rechaza la consulta
anónima. El Propietario completó la primera cuenta y confirmó su acceso; se
verificaron sesión de administrador, guardado y relectura tras recargar, con
confirmación SQL en la base real. No se cargaron fixtures. La URL HTTPS exterior
sigue pendiente. El frontend demo se probó por separado.

## Organización propuesta de Docker

Una sola instalación Docker administra dos grupos:

- `rcfito-frontend`: un contenedor `rcfito-web`, React compilado servido con Nginx.
- `rcfito-supabase`: siete servicios base `rcfito-db`, `rcfito-auth`, `rcfito-rest`,
  `rcfito-gateway`, `rcfito-studio`, `rcfito-meta` y `rcfito-functions`.

Son dos grupos Compose y ocho contenedores base, no dos contenedores totales.
Realtime, Storage y pooler quedan como perfiles opcionales. La adaptación usa la
configuración oficial versionada y la red `rcfito-backend`.
Guía: [backend-deployment](docs/backend-deployment.md).

La instalación local sirve el frontend en `http://127.0.0.1:5180`. La composición
[local](compose.local.yaml) monta únicamente un JSON de URL/clave pública; Nginx
envía `/supabase/auth/v1`, `/supabase/rest/v1` y `/supabase/functions/v1` a la puerta
API por la red Docker. No reenvía Studio ni rutas administrativas. El JSON se
carga en ejecución y la normalización conserva el prefijo `/supabase`.

El Site aloja el frontend privado con demo y opción de conexión. Para acceso
desde otros dispositivos, el navegador necesita una URL HTTPS de Supabase
accesible. La conexión de Sites a loopback en este mismo equipo depende de los
permisos del navegador y no se verificó. Sites no vuelve público `localhost` ni
sustituye la base por D1.

Configuración, respaldos y datos persistentes se transfieren aparte al migrar de servidor;
ver [OPERATIONS](docs/OPERATIONS.md).

## Verificación y evolución

[TESTING](docs/TESTING.md) registra comandos y límites;
[implementation-plan](docs/implementation-plan.md) conserva alcance, responsables
y criterios. Las órdenes de aplicación y su reporte están fuera de esta entrega.
Nuevos flujos conservan las fronteras de reglas/casos de uso, acceso a datos y
presentación del [estándar de ingeniería](.project-standards/ENGINEERING.md).
