# Seguridad

## Fronteras implementadas

Supabase Auth autentica cuentas. RLS protege tablas tanto en REST directo como
en RPC. Los perfiles y asignaciones controlados en servidor definen administrador
o lector; los claims editables del usuario no conceden privilegios. Un usuario
desactivado pierde lectura aun conservando un JWT previamente emitido.

El administrador mantiene datos y asignaciones. El lector consulta agrícolas
asignadas, campos y sus proyectos/lotes/subdivisiones/etapas, aplicaciones y
grupos. Los catálogos
comunes permiten consulta a cuentas activas. Se rechazan mutaciones del lector
y acceso anónimo. El menú refleja permisos; la frontera efectiva es el servidor.

[admin-create-user](../supabase/functions/admin-create-user/index.ts) valida JWT
con Auth y exige perfil administrador activo antes de usar la clave privada.
Compensa un fallo de asignación retirando la cuenta recién creada; si también
falla esa compensación informa resultado parcial. El primer administrador sigue
el procedimiento privado de [backend-deployment](backend-deployment.md), nunca
un registro público de administrador.

Las seis tablas nuevas de aplicaciones/grupos conceden lectura bajo RLS;
mutaciones solo por RPC. Los wrappers públicos son invoker y los mutadores
privados comprueban sesión y administrador activo antes de elevar privilegios.
La indicación y los resultados terminales son históricos; firmas y bloqueos
permiten reintentos sin duplicar destinos ni conteos. Las guardas también impiden
cerrar etapas/proyectos con indicadas pendientes y cambiar la unidad de productos
usados. Los integrantes retirados de un grupo se conservan, sin volverlos
destinos de una nueva orden.

## Secretos y entornos

La interfaz recibe URL y clave pública publishable/anon. Conexión rechaza claves
secretas/service_role. Configuración pública y sesión se guardan en el navegador;
las credenciales privilegiadas permanecen en servidor. No introducirlas en
variables `VITE_*`, Git, bundles, logs o capturas.

[.gitignore](../.gitignore) excluye `.env`, archivos privados, builds y artefactos;
se conserva [.env.example](../.env.example) con valores vacíos. El `.env`
preexistente del usuario se conserva sin lectura/modificación. Los scripts de
backend usan sus carpetas propias y Compose selecciona entorno explícito.
Vite usa `envDir: false` para no cargar archivos `.env` durante desarrollo o build;
la conexión de esta instalación se entrega mediante el JSON público.

La instalación real local guarda secretos y datos en
`.artifacts/production-supabase`. El frontend monta solamente
`frontend-config.json`, que contiene URL y clave pública; no monta el `.env`
privado. Nginx limita el proxy `/supabase` a Auth, REST y Edge Functions. Tanto el
frontend:5180 como la puerta API:55451 están ligados a loopback; HTTP local no
autoriza acceso remoto sin HTTPS.

El asistente inicial:5181 atiende solo `127.0.0.1`, comprueba origen/host y token
de formulario, y conserva la contraseña elegida únicamente en memoria durante
el alta. Usa la clave de servicio solo en su proceso local, exige que aún no
exista administrador activo y limita su duración. No introducir la contraseña
en el chat, comandos, Git o documentación. Las altas siguientes requieren la
sesión real del administrador y la función privada. El registro de migraciones
local rechaza hashes alterados o tablas sin procedencia gestionada.

El modo demo usa fixtures ficticios y localStorage. Su cambio de rol es una
simulación de UX, no autenticación ni aislamiento de datos reales. Un Site
privado controla quién abre el frontend; no sustituye Auth ni RLS.

## Ejemplos del proveedor y alerta de GitHub

La [alerta 1](https://github.com/Luiseaf12/rcfito/security/secret-scanning/1)
identificó como secreto de Stripe un ejemplo comentado de hooks de Auth en
[docker-compose.yml](../infra/supabase/upstream/docker-compose.yml). El valor
procede de la revisión oficial fijada de Supabase; su Base64 decodifica texto
explícito de ejemplo, sin corresponder a una credencial operativa de RCFito.

La adaptación local sustituye los dos ejemplos de secretos SMS/email por
referencias a sus variables de entorno, manteniendo las líneas comentadas.
Los hooks y la configuración efectiva de servicios permanecen iguales.
`UPSTREAM_VERSION` identifica la fuente original, con este ajuste local de
saneamiento documentado. No copiar los valores antiguos al actualizar el proveedor.

2026-10-31: GitHub confirmó la alerta 1 en estado `resolved`, resolución
`false_positive`, con explicación auditada. Se verificó que solo cambiaron
comentarios del Compose, `docker compose ... config --quiet` aprobó con el
entorno de ejemplo explícito y `npm run docs:check` pasó. No se reescribió el
historial: el ejemplo anterior sigue en su commit original y la resolución queda
registrada en GitHub.

## Evidencia y pendientes

48 comprobaciones SQL y 12 verificaciones Auth/REST/Edge/RLS aprobaron en entornos
aislados: rechazo de anónimo/lector, asignaciones y JWT de perfil desactivado.
El stack de QA quedó detenido y sus datos ficticios retirados; otros stacks no
se modificaron. Comandos y alcance: [TESTING](TESTING.md).

Ampliación de aplicaciones: 116 comprobaciones SQL y 40 HTTP reales aprobadas en
entornos aislados, con revisión independiente. En operación se generó un respaldo
privado y se aplicó la migración aditiva (dos aplicadas/cero pendientes), sin
fixtures. El frontend Docker actualizado mostró sesión administradora y lista
real vacía en 5180, sin insertar datos. La lectura está comprobada; los recorridos
de captura de aplicaciones siguen siendo demo o integración aislada. Sites
publicó la versión 8 con audiencia pública conservada; nueve comprobaciones
HTTPS posteriores aprobaron sin crear datos. La audiencia del frontend no
sustituye Auth/RLS ni el secreto privado de actualización del registro. Capturas de QA solo
con datos demo; no incluir datos o cuentas reales en Git.

La instalación de operación local está iniciada con secretos privados y sus
siete servicios sanos. Se verificaron primera cuenta, login y captura desde el
navegador con la base real. Se confirmó una migración
aplicada sin pendientes, Auth salud 200, registro público deshabilitado, REST
anónimo 401 y rutas ajenas al proxy permitido 404. La comparación privada del
JSON/bundle no encontró claves de servicio, contraseñas de BD/Studio ni secretos
JWT. La consulta de conteos previa a la primera cuenta encontró cero usuarios,
agrícolas y proyectos: no se cargaron fixtures en operación.

El asistente inicial corrigió su política de referente a `same-origin` para que
el envío del formulario conserve origen verificable; no admite un origen `null`.
La regresión del helper se comprobó con peticiones simuladas y el Propietario
completó el alta y confirmó su acceso. El asistente ya está detenido; la
contraseña fue elegida por el usuario sin pasar por chat ni Git. El navegador
mostró administrador real, confirmó guardado y conservó el registro al recargar;
SQL confirmó un administrador activo, una agrícola y cero proyectos. Nombres,
identificadores y correo de operación no se incluyen en este registro público.
El HTTPS exterior de prueba usa el grupo separado `rcfito-tunnel`, sin puertos
publicados en el host ni montaje de secretos. El proxy solo reenvía Auth/REST/
funciones, bloquea Studio y administración directa de Auth y rechaza escapes
residuales para evitar diferencias de decodificación con el gateway. CORS admite
el origen del Site; las peticiones directas sin Origin siguen requiriendo Auth/RLS.
La clave publicable del JSON de conexión puede entregarse al navegador; no
concede permisos de cuenta por sí misma. URL temporal y claves públicas no son
credenciales privilegiadas.

La revisión independiente detectó y se corrigieron un escape por doble
decodificación y la pérdida de la URL al crecer los logs; se verificaron las
correcciones con peticiones anónimas y pruebas HTTPS. Evidencia en
[TESTING](TESTING.md#quick-tunnel-https). El endpoint estable y SMTP de recuperación
siguen pendientes. Las pruebas demo y HTTP aisladas se conservan por separado.

## Registro automático de la conexión

El Worker de Sites respeta la audiencia configurada y autoriza el registro con un
secreto adicional de actualización. En esta publicación la audiencia ya era
pública; los datos siguen exigiendo sesión y permisos en Supabase. El publicador local usa acceso de servicio
existente del Site; ambas credenciales permanecen fuera de Git, del navegador y
de R2, en su carpeta local con ACL restringida. El servidor valida la dirección y
su salud, fija una vigencia de 120 segundos y rechaza rutas o destinos ambiguos.
Un registro vencido no se usa para reenviar sesiones. Las consultas Docker del
monitor tienen timeout y se reintentan cuando el motor vuelve a estar disponible.

El proxy permite solo las rutas API y cabeceras necesarias; no reenvía cookies,
identidad de ChatGPT, credenciales del actualizador, redirecciones ni Set-Cookie
del destino. La configuración managed queda disponible aun con la PC caída y no
simula conexión de datos mediante demo. R2 contiene únicamente URL/vigencia, sin
registros de negocio. Procedimiento: [Conexión automática](tunnel-auto-update.md).

## Servicio de interpretación de aplicaciones

`POST /api/application-draft` requiere bearer de la conexión gestionada, Auth
válido y perfil administrador activo consultado en el servidor. Un lector o
anónimo no consume inferencia. Solo se envía el mensaje; el modelo no recibe
sesiones, credenciales, catálogos ni historial de la base. La autorización de
creación permanece en la RPC, incluso si se omite la interfaz de revisión.

Mensaje de hasta 20,000 caracteres y cuerpo 128 KiB, nota 4,000, hasta 40 productos y
100 destinos; entradas y salidas se validan. El servicio limita por usuario e
instancia y usa timeout; esos límites no son una cuota distribuida. El proveedor
recibe store:false; el Worker no registra mensajes ni tokens. El bloque Nota se
recupera literalmente de la fuente para impedir omisiones o resúmenes del modelo.

OPENAI_API_KEY y OPENAI_MODEL son configuración exclusiva del Worker; nunca
VITE_*, repositorio o navegador. El Propietario decidió dejar la activación
pendiente: no se creó ni escribió una clave y no se ejecutó inferencia real.
La nueva migración fue probada en aislamiento y aplicada con respaldo privado;
no se cargaron mensajes ni fixtures en operación.

## Custodia de la clave de IA

GET/PUT /api/ai-settings y POST /api/ai-settings/test verifican sesión Auth y
perfil activo administrador antes de leer R2 o invocar proveedor. No confían en
roles del navegador. Mismo origen, cuerpos acotados y límite de pruebas por
administrador complementan esa autorización.

La clave se cifra con AES-256-GCM e IV aleatorio. HKDF separa cifrado y HMAC a
partir del secreto estable del servidor; metadatos autenticados detectan cambios.
El navegador recibe solo modelo/estado/últimos cuatro caracteres. Guardar exige
una prueba HMAC de diez minutos ligada a usuario, clave, modelo y revisión;
R2 condicional rechaza sobrescrituras concurrentes. Los errores no reproducen
claves ni respuestas privadas del proveedor. Custodia y recuperación en
[OPERATIONS](OPERATIONS.md#configuración-de-ia-en-el-servidor).

## Edición de aplicaciones e historial

Las revisiones/correcciones solo se escriben mediante RPC con administrador
activo. `application_changes` y `application_change_products` no conceden DML
directo; SELECT bajo RLS conserva alcance de la agrícola asignada e impide acceso
anónimo/inactivo. La firma de reintento no es una columna pública de lectura.
Las RPC bloquean orden/destinos, validan versión y conjunto exacto pendiente,
exigen motivo y escriben evento/snapshots/referencias de forma atómica. Originales
y eventos anteriores no se reescriben; FK y unidad protegen productos que solo
figuren en historial. Correcciones reales mantienen estado y límite de cierre.
[Contrato](backend-api.md#revisiones-y-correcciones-de-aplicaciones).

## Sinónimos de productos

RLS permite lectura de sinónimos solo a usuarios activos del catálogo común.
Escritura mediante save_product con perfil administrador activo y validación
atómica; cliente sin DML sobre sinónimos ni auditoría privada. Triggers y lock
de catálogo evitan eludir conflictos cambiando nombres/códigos directamente o
guardando concurrentemente. Inactivos siguen reservando sus nombres alternos.
La captura solo completa coincidencias exactas y únicas; nunca decide por
similitud. [Contrato](backend-api.md#sinónimos-de-productos).

## Consultas de aplicaciones

Los endpoints `/api/application-query`, `/api/application-chat` y
`/api/application-transcription` validan Auth y perfil activo admin/viewer antes
de ejecutar consultas o consumir proveedor. Las RPC invoker vuelven a comprobar
cuenta activa y RLS en cada lectura, incluidos IDs/nombres enviados directamente.
No se permite SQL libre ni operaciones de escritura desde el plan del modelo.

El chat envía al proveedor pregunta, filtros acotados, consulta previa y contexto
de fechas; no envía workspace ni resultados de negocio completos. Audio envía
solo el archivo explícitamente elegido, renombrado, usando la clave existente.
La transcripción se revisa antes de consultar. No se guardan grabaciones ni
conversaciones. La configuración y clave siguen reservadas a administración.

La caché R2 es privada y acotada a 32 posiciones por usuario; guarda resúmenes y
fuentes autorizadas, nunca JWT ni claves. Su validez lógica máxima es 60 segundos;
los objetos persisten hasta sobrescribirse. Toda entrega exige un sello de datos
y permisos vigente bajo la sesión del usuario. Un fallo de Auth/backend impide
servir resultados previos. Cambios de perfil/asignaciones invalidan la revisión.
El límite de memoria es de 32 entradas pequeñas. Cuotas por usuario/instancia y
timeouts limitan uso; no constituyen una cuota distribuida de facturación.

CLI guarda sesión en `.artifacts/query-cli/`, ignorada, con permisos POSIX
0700/0600 o ACL del usuario Windows. Rechaza enlaces en la ruta, oculta contraseña,
no recibe tokens por argumentos y renueva únicamente contra el origen de login.
El `.env` del usuario no se lee ni modifica. [Ficha](flows/application-chat.md).
