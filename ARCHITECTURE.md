# Arquitectura de RCFito

## Implementación actual

Frontend React 19, TypeScript y Vite 8, con HashRouter para rutas estáticas en
Sites y Docker. shadcn usa base Radix y estilo nova; tema local, Geist e iconos
Lucide. Versiones exactas en [package.json](package.json) y su lockfile.

| Frontera | Archivos y responsabilidad |
| --- | --- |
| Presentación | [App](src/App.tsx), [catálogos](src/features/catalogs.tsx), [aplicaciones](src/features/applications.tsx), [grupos](src/features/sowing-groups.tsx) y controles de `src/components/ui/`; también proyectos, usuarios y conexión. |
| Coordinación | [WorkspaceProvider](src/data/workspace-context.tsx): sesión, consultas, mutaciones, modo y recuperación. |
| Modelo y dominio demo | [model](src/domain/model.ts), [rules](src/domain/rules.ts), [applications](src/domain/applications.ts) y [demo](src/domain/demo.ts): DTO, reglas puras y fixtures ficticios. |
| Datos reales | [Adaptador Supabase](src/data/supabase.ts): Auth, tablas y RPC; traduce nombres/estados del backend al DTO. |
| Conexión de arranque | [Configuración](src/data/connection-config.ts) y [main](src/main.tsx): carga opcional de `rcfito-config.json` con URL y clave pública antes de montar la aplicación. |
| Backend | [Migración inicial](supabase/migrations/20261031233122_catalogs_and_sowing_projects.sql) y [ampliación aditiva](supabase/migrations/20261101013723_applications_and_groups.sql), RLS/RPC transaccionales; [alta privada](supabase/functions/admin-create-user/index.ts). |
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
El equipo se captura como texto en las realizaciones.
Contrato completo: [backend-api](docs/backend-api.md).

Cada orden conserva una mezcla indicada y destinos completos por etapa. La
realización copia lo indicado o guarda una mezcla excepcional propia del destino;
los snapshots, estados terminales y reintentos evitan sobrescribir la historia o
duplicar conteos. Los grupos conservan referencias retiradas/cerradas; solo las
etapas sembradas vigentes se eligen en órdenes nuevas. RPC y guardas impiden
cerrar etapas/proyectos con destinos indicados pendientes.

## Backend elegido: API de Supabase

El Propietario eligió Supabase local bajo Docker: PostgreSQL, Auth, Data API/RPC
y funciones privadas de servidor. La migración implementa guardas de temporada,
superficie y secuencia, default de subdivisión, preservación histórica, copia y
guardados compuestos. El alta de cuentas valida JWT y perfil administrador antes
de usar la clave privada. Consultar [SECURITY](docs/SECURITY.md).

La verificación acumulada de aplicaciones aprobó 116 SQL y 40 comprobaciones
HTTP/Auth/REST/Edge/RLS en entornos aislados. La instalación de operación tiene
sus siete servicios activos y persistencia local. El ledger registra dos aplicadas y
cero pendientes; el navegador abre el acceso real y la API rechaza la consulta
anónima. El Propietario completó la primera cuenta y confirmó su acceso; se
verificaron sesión de administrador, guardado y relectura tras recargar, con
confirmación SQL en la base real. No se cargaron fixtures. El acceso HTTPS de
prueba se proporciona mediante Quick Tunnel; RCF-010 quedó cerrado por
confirmación del Propietario el 2026-11-01. Los límites técnicos se conservan en OPERATIONS.
El frontend demo se probó por separado.
La ampliación de aplicaciones se verificó en navegador demo y backend aislado;
el frontend Docker actualizado se comprobó en 5180 con sesión administradora y
lista real vacía, sin insertar aplicaciones. Sites confirmó la versión 8 y las
nueve comprobaciones HTTPS posteriores aprobaron. No se atribuye captura de
órdenes contra operación a los recorridos demo.

## Organización propuesta de Docker

Una sola instalación Docker administra dos grupos:

- `rcfito-frontend`: un contenedor `rcfito-web`, React compilado servido con Nginx.
- `rcfito-supabase`: siete servicios base `rcfito-db`, `rcfito-auth`, `rcfito-rest`,
  `rcfito-gateway`, `rcfito-studio`, `rcfito-meta` y `rcfito-functions`.

El acceso remoto de prueba añade el grupo opcional `rcfito-tunnel`, con
`rcfito-api-proxy` y `rcfito-quick-tunnel`: dos contenedores adicionales, sin puertos
de host y con imágenes fijadas. El proxy publica solo la API y rechaza rutas de
Studio, administración directa de Auth y rutas con codificación ambigua.

Son dos grupos Compose y ocho contenedores base, no dos contenedores totales.
Realtime, Storage y pooler quedan como perfiles opcionales. La adaptación usa la
configuración oficial versionada y la red `rcfito-backend`.
Guía: [backend-deployment](docs/backend-deployment.md).

La instalación local sirve el frontend en `http://127.0.0.1:5180`. La composición
[local](compose.local.yaml) monta únicamente un JSON de URL/clave pública; Nginx
envía `/supabase/auth/v1`, `/supabase/rest/v1` y `/supabase/functions/v1` a la puerta
API por la red Docker. No reenvía Studio ni rutas administrativas. El JSON se
carga en ejecución y la normalización conserva el prefijo `/supabase`.

El Site aloja el frontend y un Worker con proxy `/supabase` del mismo
origen. La configuración managed utiliza esa ruta fija y migra preferencias
anteriores del mismo backend. El actualizador de Windows renueva en R2 únicamente
la URL del Quick Tunnel y su vigencia; una URL caducada produce 503. Las sesiones,
permisos y datos de negocio permanecen en Supabase de esta PC. El proxy no
reenvía identidad o cookies de Sites. Detalle y límites:
[Conexión automática](docs/tunnel-auto-update.md).

Configuración, respaldos y datos persistentes se transfieren aparte al migrar de servidor;
ver [OPERATIONS](docs/OPERATIONS.md).

## Verificación y evolución

[TESTING](docs/TESTING.md) registra comandos y límites;
[implementation-plan](docs/implementation-plan.md) conserva alcance, responsables
y criterios. Aplicaciones/grupos están publicados; el Propietario confirmó el
cierre del reporte completo (RCF-011) el 2026-11-01.
Nuevos flujos conservan las fronteras de reglas/casos de uso, acceso a datos y
presentación del [estándar de ingeniería](.project-standards/ENGINEERING.md).

## Captura asistida de aplicaciones

La ruta `/captura-ia` reutiliza el shell y la captura de indicaciones.
`src/features/application-ai.tsx` coordina mensaje y revisión; el dominio puro
`src/domain/application-import.ts` valida la extracción, resuelve códigos y
etapas y sugiere cultivo desde el historial de esas mismas etapas. El adaptador
`src/data/application-ai.ts` llama al endpoint del mismo origen con la sesión
administradora de la conexión gestionada.

El Worker incorpora `server/application-ai.mjs`: autentica con Auth y perfil
activo, limita peticiones y extrae JSON estructurado sin crear registros. La
aprobación usa la RPC de aplicaciones existente; conserva `source_text`, nota
(`observations`) y número único por etapa. La migración aditiva conserva los
registros previos y asigna su numeración en orden histórico determinista.

Vite y Nginx reenvían únicamente `/api/application-draft` al Site. La clave de IA
permanece en secretos del Worker, separada de Supabase y del navegador. El
Propietario confirmó el cierre de la activación en RCF-014 el 2026-11-01.
Si falta configuración, el endpoint responde indisponibilidad explícita y se
puede completar la captura manualmente.

## Configuración de IA administrada

Conexión y preferencias coordina un adaptador de configuración separado de la
vista. El Worker comprueba Auth/perfil de administrador y guarda la clave cifrada
en un objeto R2 exclusivo; la captura resuelve esa configuración en cada petición.
La prueba y el guardado son acciones distintas con comprobante temporal y revisión
condicional. Contrato y recorrido en [la ficha](docs/flows/ai-settings.md).

## Edición e historial de aplicaciones

[application-editing](src/domain/application-editing.ts) coordina revisiones de
indicación y correcciones reales con snapshots, versiones e idempotencia. Los
helpers resuelven indicación por destino; la orden conserva su primera versión.
[application-history](src/data/application-history.ts) concilia lecturas REST y
hidrata correcciones desde eventos antes de exponer el workspace. Adaptador RPC
en Supabase; [editor e historial](src/features/application-editing.tsx) y
[campos compartidos](src/features/application-fields.tsx) separan presentación.
La [migración](supabase/migrations/20261101051210_application_revision_history.sql)
mantiene eventos append-only y referencias de productos con RLS. Flujo completo
en [edición](docs/flows/application-editing.md).

## Resolución de sinónimos de productos

[product-synonyms](src/domain/product-synonyms.ts) reúne normalización, conflictos,
orden y etiquetas; catálogo y matcher de importación lo consumen. Adaptador
Supabase carga la tabla de sinónimos y extiende save_product sin cambiar su firma.
Editor Productos y ProductMixtureEditor comparten el catálogo; la extracción IA
conserva el nombre escrito y la vinculación determinista ocurre al revisar.
[Ficha](docs/flows/product-synonyms.md) define límites y seguridad.

## Dashboard de uso de productos

[product-dashboard](src/features/product-dashboard.tsx) ofrece filtros, tabla,
ranking e historial en `/`. [product-usage](src/domain/product-usage.ts) agrega el
workspace autorizado de todas las temporadas y estados, sin consultas o mutaciones
nuevas. Todas las aplicaciones es el estado inicial. Realizadas usan snapshots
reales corregidos; indicadas/canceladas resuelven su indicación histórica por
destino con indicationForTarget. Cantidades por unidad, promedio ponderado y
fechas según estado se definen en [la ficha](docs/flows/product-dashboard.md).
Carga diferida, shell y errores existentes conservados.

## Resumen por lote

[lot-usage](src/domain/lot-usage.ts) agrupa destinos validados por identidad del
lote de temporada y reutiliza los snapshots/cálculos de product-usage. La
[presentación por lote](src/features/lot-usage-panel.tsx) mantiene selección y
paginación; [controles compartidos](src/features/product-usage-shared.tsx) reúnen
formatos, paginación e historial, conservando el filtro del lote al abrirlo.
[usage-lot](src/domain/usage-lot.ts) resuelve y valida la jerarquía histórica por
ID para el filtro global y el resumen; ProductUsageFilters.lotId se aplica antes
de agregar productos, métricas y ranking. La URL conserva el ID, y las opciones
se derivan del workspace autorizado sin fusionar nombres repetidos.
Sin nuevo adaptador, consulta ni migración. [Contrato](docs/flows/product-dashboard.md#ampliación-resumen-por-lote).

## Motor de consultas, chat y audio

`server/application-queries.mjs` valida consultas, ejecuta RPC con la sesión del
usuario, comprueba revisión/permisos antes de reutilizar caché y compone respuestas
deterministas. `server/application-chat.mjs` interpreta texto con el modelo ya
configurado y transcribe archivos con la misma clave y `gpt-transcribe`. Una
pregunta consume una interpretación estructurada; los resultados SQL no se
reenvían al modelo. Los endpoints se integran en el Worker y proxies actuales.

`application_query` y `application_query_stamp` son RPC invoker de lectura bajo
RLS. La invalidación durable es global y conservadora, ligada además a usuario,
rol y asignaciones. Cada resultado procede del mismo corte de datos. R2 contiene
hasta 32 posiciones de caché por usuario, con validez máxima de 60 segundos y
revalidación obligatoria; los objetos pueden persistir hasta sobrescribirse.

`scripts/query-cli.mjs` usa el endpoint de consulta estructurada, sin proveedor de
IA. Su sesión privada soporta login, renovación y logout. Presentación en
`src/features/application-chat.tsx`, adaptador en `src/data/application-chat.ts`
y coordinación en WorkspaceProvider. [Ficha de consultas](docs/flows/application-chat.md).
## Contexto implícito de consumo por malla

El motor de consultas interpreta directamente la pregunta habitual por malla,
recupera una referencia privada de última agrícola del usuario y llama a
`application_query_resolve`. La RPC resuelve agrícola, temporada activa y lote
único con RLS y devuelve filtros legibles. Otra agrícola o temporada explícitas
prevalecen. Las RPC de cantidades existentes mantienen el cálculo histórico.

CLI acepta `preguntar "..."` o la pregunta entre comillas como único argumento.
Chat y CLI muestran las mismas filas y procedencia de filtros; la UI utiliza
tablas shadcn y el CLI una tabla de texto/JSON. El modo de resolución y lista

## Origen histórico de aplicaciones

RCF-029 añade `application-groups` al dominio y `application-group-history` al
adaptador. La UI envía solo el grupo elegido; la RPC valida el conjunto completo
y guarda el origen en la orden y las pertenencias en cada destino. El adaptador
recupera esos snapshots, mientras que la simulación demo mantiene su contrato
separado. La migración aditiva conserva desconocido el origen antiguo.
[Contrato y verificación](docs/flows/application-group-origin.md).
completa acompaña cada respuesta y se conserva al seleccionar coincidencias.
[Contrato](docs/flows/application-chat.md#contexto-implícito-y-tabla-de-consumo-por-malla).


RCF-030: `domain/application-recipes.ts` resuelve bases por fecha y etapa/origen;
`features/application-recipes.tsx` coordina la captura unificada desde cero o
receta previa y `application-recipe-picker.tsx` su buscador de historia activa;
el adaptador recupera `recipe_source` y la RPC valida su versión/estado antes de
crear una orden independiente. La navegación hash usa `createHashRouter` para
proteger cambios también con Atrás. [Contrato](docs/flows/recipe-creation.md).

RCF-035: `domain/application-draft-document.ts` valida y copia la indicación
editable en un documento independiente. `features/application-draft-pdf.tsx`
coordina estado/error y carga diferida; `export/download-application-draft.ts`
carga fuentes locales y descarga, mientras `export/application-draft-pdf.ts`
renderiza texto y tablas sin conocer el workspace ni su adaptador. No hay RPC,
persistencia de borradores, reservas ni envío externo al exportar.
[Contrato y precisión](docs/flows/recipe-draft-pdf.md).

RCF-036 añade `domain/saved-recipe-document.ts`: copia de la última indicación
guardada y snapshots de destinos, sin reconstruir mezclas desde el catálogo.
`export/saved-recipe-pdf.ts` y el borrador comparten `recipe-pdf-layout.ts`, fuentes,
descarga y estado/error del hook. El detalle ofrece exportación de consulta;
no hay nuevos endpoints, escrituras ni migraciones.
[Contrato](docs/flows/saved-recipe-pdf.md).


## Cantidades totales desde imagen — RCF-040

`image-capture-page` coordina carga/pegado, contexto e interpretación;
`image-capture-fields` presenta totales y reparto. `data/application-image`
encapsula lectura/transporte y `domain/application-image` valida y calcula con
enteros decimales exactos. El endpoint y Worker embeben `server/application-image`
para validar binarios. La migración `20261104171758` incorpora source_capture
y valida el reparto dentro de create_application_order. [Contrato](docs/flows/image-capture.md).
