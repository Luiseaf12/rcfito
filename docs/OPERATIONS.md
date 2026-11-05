# Operación y publicación

## Frontend local

Node.js 24 y npm:

```sh
npm ci
npm run dev
```

Abrir `http://127.0.0.1:5173`. La demo guarda datos ficticios en el navegador.
En **Conexión y preferencias** se configura URL de Supabase y clave pública;
el modo real presenta el acceso con la cuenta de Auth asignada. Para revisar el
build: `npm run build` y `npm run preview`.

## Docker y Supabase

[backend-deployment](backend-deployment.md) describe configuración versionada,
migraciones, primera cuenta y altas privadas. La instalación de operación local
ya inició siete servicios sanos en el grupo `rcfito-supabase`, con configuración
privada y persistencia en `.artifacts/production-supabase`. La migración está
aplicada sin pendientes. El Propietario completó su primera cuenta y confirmó el
acceso; el navegador muestra administrador en Supabase real y conserva una
captura tras recargar, confirmada también en PostgreSQL. El acceso HTTPS temporal
para Sites se configura mediante el Quick Tunnel descrito abajo.

El frontend se administra por separado como `rcfito-frontend`/`rcfito-web`:

```sh
node scripts/frontend-local.mjs
docker compose --env-file .env.example -f compose.frontend.yaml -f compose.local.yaml up -d --build
```

Estos comandos requieren el backend local ya preparado e iniciado según su
guía. El helper produce solo URL `/supabase` y clave pública; Compose monta ese
JSON en lectura. No monta secretos en Nginx. La interfaz queda en
[RCFito local](http://127.0.0.1:5180), enlazada a loopback, y dirige Auth/REST/Edge
al backend por su proxy del mismo origen.

El `.env` preexistente del usuario no se modifica: frontend selecciona
explícitamente el ejemplo vacío y backend selecciona su entorno privado propio.
En una instalación nueva, para la primera cuenta se inicia un asistente temporal
en loopback:5181 y el Propietario elige la contraseña allí; ver
[primera cuenta](backend-deployment.md#primera-cuenta-y-altas-posteriores). En
esta instalación ya se completó el alta y el asistente está detenido.
No repetir la preparación sobre la instalación existente ni usar comandos de
limpieza de QA contra sus volúmenes.

El servidor de operación permanecerá en este equipo y deberá estar encendido
durante el uso. Este arranque permite operar desde ese equipo. Sites aloja el
frontend, no la base local. Otros dispositivos necesitan un endpoint HTTPS
accesible: el `127.0.0.1` del celular no señala este servidor. Un Site abierto en
este mismo equipo podría requerir permisos de acceso a red local del navegador;
ese recorrido no se ha verificado y el acceso recomendado ahora es la URL local.
El acceso remoto documentado usa Quick Tunnel y el proxy del Site. RCF-010
quedó cerrado por confirmación del Propietario el 2026-11-01; se conserva la
configuración aceptada y los límites técnicos descritos en este documento.

## Quick Tunnel gratuito para pruebas

El seguimiento de cambios de dirección ahora se gestiona según
[Conexión automática](tunnel-auto-update.md). El Site usa una ruta fija y el
actualizador de Windows renueva el destino sin volver a publicar el frontend.

El Propietario eligió Cloudflare Quick Tunnel sin comprar dominio. La composición
[compose.tunnel.yaml](../compose.tunnel.yaml) añade el grupo `rcfito-tunnel`, con
`rcfito-api-proxy` y `rcfito-quick-tunnel`. Usa la red `rcfito-backend`, sin publicar
puertos del host. Las imágenes quedan fijadas por digest. Supabase, su entorno
privado y sus volúmenes se conservan.

Con Docker Desktop y el backend local activos, desde la raíz:

```sh
node scripts/backend-tunnel.mjs start
node scripts/backend-tunnel-check.mjs
```

`start` conserva un conector que ya esté activo e informa su URL HTTPS
`trycloudflare.com`. También genera `.artifacts/quick-tunnel/connection.json`,
con URL y clave pública únicamente. No lee el `.env` raíz ni modifica el entorno
privado. La caché de dirección se vincula al contenedor y su inicio, para no
reutilizar una URL anterior después de un reinicio.

En el Site, **Conexión y preferencias** permite guardar esos dos valores en el
navegador. Para preparar esa conexión como valor inicial para otros dispositivos:

```sh
node scripts/backend-tunnel.mjs site-config
```

Este comando actualiza exclusivamente `public/rcfito-config.json` con URL y clave
pública. Después publicar esa revisión siguiendo **GitHub y Sites**, más abajo.
La configuración gestionada reemplaza una dirección anterior del mismo backend;
demo elegida o un servidor con otra clave se conservan. El frontend Docker sigue
usando su montaje local `/supabase`. `site-config` prepara esa ruta estable, no la
dirección aleatoria del túnel.

El proxy solo reenvía `/auth/v1`, `/rest/v1` y `/functions/v1`; bloquea Studio,
registro y administración directa de Auth y rutas ambiguas con escapes
residuales. CORS admite el origen exacto del Site. Auth/RLS y la función privada
siguen comprobando sesión y permisos; CORS no sustituye esa autorización.

Consultar o detener solo este grupo:

```sh
node scripts/backend-tunnel.mjs status
node scripts/backend-tunnel.mjs stop
```

Detener el túnel no detiene ni borra Supabase. Al volver a crear o reiniciar el
conector, la URL puede cambiar. Con el actualizador instalado se renueva el
registro automáticamente; `status` permite diagnosticar el arranque actual.
Los contenedores reinician con Docker salvo detención manual, pero la dirección
anterior no se recupera por ese reinicio, pero el navegador conserva su ruta fija.
La PC, la sesión de Windows, Docker y la conexión a internet deben estar activos.

Cloudflare destina [Quick Tunnels](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/)
a pruebas/desarrollo: sin garantía de disponibilidad, con hasta 200 peticiones
simultáneas y sin SSE. SMTP y enlaces de recuperación por correo siguen pendientes;
esta conexión verifica acceso mediante contraseña, no esos flujos.

Publicación confirmada el 2026-10-31: configuración inicial de Supabase preparada
desde el commit `5aa55844e6d73308acc83b357dc48bc87bddc504`. Sites devolvió
`succeeded` para `appgdep_6ae68f83468c8191b9e3388adea83176`, versión
`appgprj_6ae67ae019e88191a7012093bb19c505~appgver_a4f585c8f9a881919348a61c68ffc2fb`,
en [RCFito](https://rcfito.paxxa.chatgpt.site). La audiencia privada se conservó.
En navegador se comprobó el JSON alojado y la pantalla de acceso real.
Posteriormente el Propietario confirmó su inicio de sesión en Sites; el comando
`status` confirmó el mismo túnel activo. Este resultado cierra el acceso temporal
de prueba de RCF-008; la dirección estable de operación permanece en RCF-010.

## GitHub y Sites

El Propietario autorizó commit/push a
[Luiseaf12/rcfito](https://github.com/Luiseaf12/rcfito) y publicación en ChatGPT
Sites. [hosting.json](../.openai/hosting.json) conserva la identidad. El build
actual produce un Worker con frontend embebido y un registro R2 de conexión;
la base de negocio permanece en esta PC. Se conserva la audiencia configurada:
la lectura previa al despliegue automático encontró el Site público (revisión 2).
Los datos siguen exigiendo acceso de Supabase y el registro, su secreto adicional.

Publicar la misma revisión validada: checks de [TESTING](TESTING.md), revisión
del diff/exclusiones de secretos, commit y push; después empaquetar el build de
ese commit y guardar/desplegar la versión con Sites. Declarar éxito solo con el
resultado nativo y URL devuelta. La primera publicación está registrada abajo.

La versión alojada puede explorar fixtures del navegador y configurar conexión
real. Publicación privada no certifica seguridad de Supabase ni hace accesible
`localhost`. `ALLOWED_ORIGINS` del backend debe incluir la URL efectiva del
frontend para las altas privadas de cuentas.

El workflow compartido ejecuta `npm run standards:check` en push/PR. Exigir
`Estándar compartido / standards` para bloquear merges necesita protección de
rama en GitHub por separado.

## Primera publicación confirmada

2026-10-31: commit de implementación
`86711d964da6d943e5553a755e2253aa72b787c4` subido a `origin/main` y al repositorio
del Site. El archivo de publicación se construyó desde esa revisión validada.
Sites devolvió `succeeded` para el despliegue
`appgdep_6ae680d202b481919285cb7aad2aff13`, versión
`appgprj_6ae67ae019e88191a7012093bb19c505~appgver_84f6e068e00881919c6e4766da23893f`.
URL privada: [RCFito](https://rcfito.paxxa.chatgpt.site). Se abrió su inicio en
navegador y se conservó la audiencia privada. Revisiones documentales posteriores
pueden tener otro commit/versión sin alterar esta evidencia de primera entrega.

## Publicación de la revisión operativa

La operación local quedó verificada el 2026-10-31. Su código está subido a GitHub
en `320c13aef1e9de764e2a30fbee5b854360e512ac`. Sites confirmó `succeeded` para
el despliegue privado `appgdep_6ae68cadfc808191b252cb2f5ffc3e2e`, versión
`appgprj_6ae67ae019e88191a7012093bb19c505~appgver_7df53f12cd1c81919a8d30452da082b9`,
en [RCFito](https://rcfito.paxxa.chatgpt.site). Los commits documentales posteriores
conservan esta evidencia de publicación de la revisión operativa. Actualizar el
frontend alojado no habilita por sí mismo acceso remoto a la BD; ese acceso se
verificó posteriormente en RCF-008 y su actualización automática en RCF-012.

## Despliegue de aplicaciones y grupos

2026-10-31: esquema aplicado en operación después de generar un respaldo privado
de PostgreSQL (284149 bytes). `backend-local.mjs --check` confirmó dos migraciones
aplicadas y cero pendientes. La segunda es aditiva y conserva la primera revisión;
no se cargaron fixtures ni se publicaron datos operativos.

La interfaz del módulo y el backend aislado pasaron su revisión funcional. Build,
54 pruebas, tipos y docs aprobaron en el checkout aislado de la entrega. El
frontend Docker actualizado quedó sano; el navegador en 5180 mostró sesión
administradora y lista real de aplicaciones vacía, sin errores ni inserciones.
Publicación confirmada desde el commit
`03b661b1bfaafd2031fe7c3de4e46324cae22d67` en GitHub. El workflow
[Estándar compartido](https://github.com/Luiseaf12/rcfito/actions/runs/41263640681)
aprobó. Sites devolvió `succeeded` el `2026-11-01T02:04:39Z` para el despliegue
`appgdep_6ae69e321420819192fcac7a67f002a9`, versión 8:
`appgprj_6ae67ae019e88191a7012093bb19c505~appgver_ac9fbda520d48191a9b0afe9730124c6`.
URL: [RCFito](https://rcfito.paxxa.chatgpt.site). Se conservaron la audiencia
pública vigente, el registro R2 y la revisión 1 de variables del entorno.

Las nueve comprobaciones HTTPS de `site-connection-check.mjs` aprobaron antes y
después de publicar, sin crear datos: Auth, proxy, registro vigente y rechazos.
Se cerraron el servidor demo de QA y su pestaña temporal; la interfaz de operación
queda disponible en 5180. RCF-004 queda cerrado. Las escrituras de aplicaciones
se probaron en demo/backend aislado; en operación se verificó lectura autenticada
vacía. Detalle y límites: [TESTING](TESTING.md#aplicaciones-y-grupos-entrega-publicada).

## Respaldo y cambio de servidor

Conservar Compose, imágenes/versiones fijadas, migraciones y funciones. Pausar
escrituras, tomar un respaldo consistente de PostgreSQL y guardar aparte
configuración privada, claves de cifrado y otros datos persistentes. Restaurar
primero en las mismas versiones, ajustar URLs/DNS/HTTPS/orígenes y probar acceso,
asignaciones e historial antes de reabrir captura. Exportar imágenes no copia
volúmenes. La guía aún no acredita un simulacro de migración de operación.

Recuperar una versión de Sites revierte el frontend, no datos ni migraciones.
Conservar versión anterior y respaldos antes de cambios de esquema. La
actualización del bundle sigue [STANDARDS](STANDARDS.md#actualización).

## Publicación de edición de catálogos

2026-10-31: commit `5768f9aede41854566a723ce3cd90afb2a0dbbe4` subido a
GitHub y al repositorio de Sites, integrado sobre la entrega de aplicaciones
recién publicada. Se resolvieron conflictos conservando ambos recorridos y se
repitieron 71 pruebas, tipos/build y control documental. Evidencia de catálogos y
65 comprobaciones SQL aisladas en [TESTING](TESTING.md#edición-válida-de-catálogos-2026-10-31).

Sites confirmó `succeeded`, versión 10
`appgprj_6ae67ae019e88191a7012093bb19c505~appgver_740df350e8a0819186ad66eb0f97046c`,
despliegue `appgdep_6ae69fd97eec81919ee75b7eb10fa509`, en
[RCFito](https://rcfito.paxxa.chatgpt.site). Se conservó la audiencia pública
existente y el registro de conexión. La apertura de origen se repitió tras
integrar para verificar el commit exacto antes de empaquetar.

El frontend Docker se reconstruyó desde ese mismo checkout validado, mediante
un override de contexto de build y los Compose originales con `.env.example`
explícito. Conserva el montaje público existente y el backend. HTML y bundle de
catálogos devolvieron HTTP 200 en `http://127.0.0.1:5180`. No se aplicaron
migraciones ni se generaron datos de prueba en operación para esta mejora.

## Captura con IA y nota: actualización

2026-10-31: migración aditiva de fuente/numeración aplicada en rcfito-db después
de generar un respaldo privado en .artifacts/production-supabase/backups.
Ledger coherente: 3 aplicadas y 0 pendientes. No se reiniciaron ni prepararon
secretos/volúmenes y no se cargaron datos de prueba en operación. El frontend
Docker se reconstruyó con entorno Compose explícito; HTML y bundle devolvieron
200 con la ruta de captura nueva. Evidencia en [TESTING](TESTING.md#captura-con-ia-número-por-etapa-y-nota).

El endpoint de IA se aloja en el Worker del Site. El frontend local reenvía su
ruta exacta al mismo Site; Auth/perfil y la RPC conservan el control de acceso.
Para activar más adelante, configurar OPENAI_API_KEY como secreto y OPENAI_MODEL
como modelo vigente del proveedor mediante las herramientas de Sites. No usar
el .env preexistente, variables VITE_* ni archivos versionados para secretos.
El Propietario dejó esa activación pendiente: no se creó una clave ni se comprobó
inferencia real. La captura manual y la revisión del borrador siguen disponibles.

Sites confirmó `succeeded`, versión 11, desde el commit
`c3ec45fb3ead01fe4726b589ff80e4b72b99b0bc` validado en checkout limpio y subido a
GitHub y al repositorio del Site. Versión guardada:
`appgprj_6ae67ae019e88191a7012093bb19c505~appgver_4758009458308191b672fd7e0524d043`;
despliegue `appgdep_6ae6a90a41a48191ae08a50c48fcf580`, en
[RCFito](https://rcfito.paxxa.chatgpt.site). Se conservó la audiencia pública
existente y las variables del registro de conexión.

Verificación posterior: inicio y bundle 200, ruta de captura presente, servicio
IA anónimo 401, proxy IA local 401 y salud Auth 200. Sin escrituras de operación
ni llamadas al proveedor. La activación de IA continúa diferida por el Propietario.

## Publicación de cultivo y variedad en grupos

2026-10-31: commit `c10976eec7c5e64c660cf750864c64e6c3bd45f3` subido a
GitHub y al repositorio de Sites. Cultivo ofrece el catálogo activo al crear;
variedad se muestra por siembra y permite filtrar candidatos sin retirar miembros
ocultos. La edición explica los bloqueos de contexto. 115 pruebas, tipos/build,
check documental y QA demo de captura/recarga/filtros/móvil aprobados; ver
[ficha](flows/applications.md#selección-de-cultivo-y-variedad-en-grupos).

Sites confirmó `succeeded` para la versión 12
`appgprj_6ae67ae019e88191a7012093bb19c505~appgver_d23d31978358819191fbe0fe98811277`,
despliegue `appgdep_6ae6ada616548191866aa363f511adf7`, en
[RCFito](https://rcfito.paxxa.chatgpt.site), conservando audiencia y entorno.
Docker frontend se reconstruyó desde el mismo commit con entorno Compose
explícito y montaje público existente; HTML y bundle de Grupos respondieron HTTP
200. No se modificó el esquema ni se escribieron fixtures en operación.

## Configuración de IA en el servidor

El administrador activo abre Conexión y preferencias, ingresa clave y modelo,
pulsa Probar conexión y después Guardar configuración. Cada prueba envía una
solicitud mínima al proveedor y puede consumir su cuota. No guarda aplicaciones.
Cambiar entradas requiere otra prueba. Dejar clave vacía conserva la guardada;
Actualizar estado permite recuperar la revisión vigente ante un conflicto.

El Worker conserva un objeto exclusivo R2, rcfito/ai-settings.json, con la clave
cifrada y metadatos autenticados. Requiere BUCKET y un secreto estable de al menos
32 caracteres: RCFITO_AI_CONFIG_SECRET, o, si no se define, el secreto existente
RCFITO_TUNNEL_UPDATE_SECRET. HKDF usa dominios separados por propósito. Este
despliegue reutiliza la custodia existente sin revelar ni modificar secretos.
OPENAI_API_KEY/OPENAI_MODEL siguen como compatibilidad solo si no existe objeto
guardado; la configuración guardada tiene prioridad y no se cachea entre capturas.

Respaldar de forma privada el objeto cifrado y el secreto raíz por separado.
Cambiar o perder ese secreto impide descifrar el objeto; el servicio falla
explícitamente y no cambia de clave en silencio. Para rotarlo, recuperar la clave
con el secreto anterior por un procedimiento privado y reconfigurar, o retirar el
objeto mediante administración de R2 y volver a ingresar/probar/guardar la clave.
No borrar el registro del túnel ni publicar respaldos, claves o entorno privado.

El Propietario confirmó el 2026-11-01 el cierre de la activación en RCF-014.
La verificación histórica de implementación usa dependencias ficticias y no
se presenta como una nueva prueba de proveedor real. Evidencia en
[TESTING](TESTING.md#configuración-de-ia-en-conexión-y-preferencias).

2026-10-31: commit f83529da44d84a549d84270fd3cc652d67ff357f subido a GitHub
y al repositorio de Sites, validado y empaquetado desde checkout limpio. Sites
confirmó succeeded para la versión 13
`appgprj_6ae67ae019e88191a7012093bb19c505~appgver_d735ab03e7e4819197ce74e9bfaf3af0`,
despliegue `appgdep_6ae6b0768e108191ba3c6e27239e7177`, en
[RCFito](https://rcfito.paxxa.chatgpt.site), conservando audiencia pública y entorno.
El frontend Docker se reconstruyó desde el mismo commit con Compose explícito y
montaje público conservado; backend y volúmenes no cambiaron.

Trece comprobaciones posteriores aprobadas: HTML y bundle nuevo 200 en Site y
local, GET/PUT de configuración y POST de prueba/captura anónimos 401 en ambos,
y salud Auth 200. La vista publicada sin sesión no muestra controles de IA.
No se guardó configuración ni se hizo inferencia con claves reales durante QA.

## Corrección de cultivo en la captura

2026-10-31: la captura toma el cultivo único de las siembras vigentes cuando falta
historia previa, conservando revisión de contradicciones y selección explícita.
140 pruebas, tipos/build y QA demo aprobados. No requiere migraciones, nueva
clave ni cambios de configuración del proveedor.

El Propietario autorizó expresamente commit, push y publicación de esta corrección.
Commit `0d33a3f1a5f059d811e9c47bd4b86ddcb532179e` subido a GitHub y al
repositorio de Sites, validado/empaquetado desde checkout limpio. Sites confirmó
succeeded para la versión 14
`appgprj_6ae67ae019e88191a7012093bb19c505~appgver_6e3d53df340c8191a3211bf512b41ff1`,
despliegue `appgdep_6ae6bc1a8c24819181a8e95d1201e0e1`, conservando audiencia
pública y entorno. Frontend Docker actualizado desde la misma revisión con
Compose explícito y montaje público conservado.

Nueve comprobaciones posteriores aprobadas: inicio y bundle con el texto corregido
200 en Site y local, captura/configuración sin sesión 401 en ambos y salud Auth
200. Sin escrituras de aplicaciones ni consumo del proveedor en la verificación.
[Evidencia](TESTING.md#cultivo-registrado-en-primeras-aplicaciones).

## Autocompletado y pendientes de aprobación

2026-10-31: corrección autorizada con commit/push y publicación. Contexto único
completado desde siembras; una validación compartida explica cada bloqueo y
permite aprobar al resolverlos. 161 pruebas, tipos/build, QA demo de guardado y
móvil aprobados, con revisión independiente sin pendientes. No requiere cambios
de esquema, nuevas claves ni ajustes del proveedor.

Commit `6b0bd2cc5e77329b4b53d74c57c9a69c3594cc93` subido a GitHub y al
repositorio de Sites, validado y empaquetado desde checkout limpio. Sites confirmó
succeeded para la versión 15
`appgprj_6ae67ae019e88191a7012093bb19c505~appgver_8722cee8b6788191a9c197dffa43752e`,
despliegue `appgdep_6ae6c2c477448191b1aebb758d742813`, conservando audiencia
pública y entorno. Docker frontend actualizado desde el mismo commit mediante
Compose explícito y montaje público conservado; backend/volúmenes intactos.

Once comprobaciones posteriores aprobadas: inicio, contexto y resumen de
pendientes 200 en Site/local, captura/configuración sin sesión 401 en ambos y
salud Auth 200. Sin escrituras de aplicaciones ni consumo del proveedor durante
esa verificación. Conservar el mensaje antes de recargar para abrir el borrador
con la nueva versión. [Evidencia](TESTING.md#autocompletado-y-pendientes-de-aprobación).

## Edición de aplicaciones e historial

Cambio autorizado para commit/push y publicación en el mismo Site, conservando
audiencia. Requiere aplicar `20261101051210_application_revision_history.sql`
antes de servir el frontend nuevo. Es aditiva: revisión0 y referencia original
en registros existentes; no inventa eventos ni modifica productos originales.
Conservar respaldo privado previo, secretos/volúmenes y configuración IA/R2.
No ejecutar preparación ni reset de operación.

2026-10-31: respaldo custom de PostgreSQL creado y validado privadamente en
.artifacts/production-supabase/backups (367,912 bytes). Migración aplicada:
cuatro registradas, cero pendientes. Conteos de órdenes, destinos por estado y
productos originales/reales idénticos antes/después; cero eventos inventados.
181 pruebas, 244 SQL, 71 HTTP aisladas y QA demo/móvil/lector aprobados.

Commit `7942b851259b80b7b53cfee9ae81ed139bf14776` subido a GitHub y al
repositorio de Sites; se repitieron 181 pruebas, tipos, docs y build desde checkout
limpio y se empaquetó ese mismo commit. Sites confirmó succeeded, versión 16
`appgprj_6ae67ae019e88191a7012093bb19c505~appgver_1b63022b45748191b5ec8d450d7b83d3`,
despliegue `appgdep_6ae6cf1eb7408191933a7aa7fa6ccaa7`; audiencia pública,
R2 y entorno revisión1 conservados. No se leyó ni cambió la clave IA guardada.
Frontend Docker reconstruido desde el mismo checkout con Compose explícito y
montaje de configuración pública conservado; secretos y volúmenes intactos.

Catorce comprobaciones posteriores aprobadas en Site y local: inicio, bundle con
autocompletado previo, editor/historial y salud Auth 200; captura/configuración
sin sesión e historial anónimo 401. Sin escrituras de aplicaciones ni consumo
del proveedor en operación para verificar. Evidencia en
[TESTING](TESTING.md#edición-de-aplicaciones-e-historial).

## Sinónimos y selector de productos

Solicitud autorizada para commit/push y Sites conservando audiencia. Aplicar la
migración aditiva de sinónimos antes del frontend nuevo, con respaldo privado
validado y sin preparación/reset de operación. No se requieren cambios del
proveedor IA ni claves.

2026-11-01: respaldo privado custom validado (419,056 bytes) antes de aplicar
`20261101124719_product_synonyms.sql`. Ledger coherente con cinco aplicadas y
cero pendientes; conteos de órdenes, destinos por estado y productos originales/
reales intactos. Cero sinónimos inventados. 197 pruebas cliente, 308 SQL aisladas,
87 HTTP y QA demo/móvil/lector aprobados; revisión independiente integrada.
Commit `cf245f95700e01be0d4e3c2c57708bd65f9b051f` subido a GitHub y al
repositorio de Sites. Validado desde checkout limpio con 197 pruebas, tipos,
docs y build; Docker reconstruido desde ese mismo commit con configuración
pública montada y backend/secretos/volúmenes conservados.

Sites confirmó succeeded, versión17
`appgprj_6ae67ae019e88191a7012093bb19c505~appgver_7dd6157a8c108191ac23515097945914`,
despliegue `appgdep_6ae7387039508191a508f1d53f5aeac7`. Audiencia pública,
R2 y entorno revisión1 conservados. Dieciséis comprobaciones posteriores
aprobadas en Site/local: inicio, bundle/adaptador, editor de alias y captura,
salud Auth 200; captura/configuración y sinónimos sin sesión 401. Sin consumo
del proveedor ni escrituras ficticias en operación. Registro de evidencia en
[TESTING](TESTING.md#sinónimos-y-selector-de-productos).

## Dashboard de uso de productos

Solicitud del 2026-11-01 con commit/push y Sites, rectificada durante la entrega:
Todas las aplicaciones guardadas por defecto; filtros de agrícola/cultivo/etapa y
estado, sobre todas las temporadas autorizadas. Tabla, ranking e historial con
valores y fechas según el estado. No requiere migraciones, cambios de secretos,
configuración ni volúmenes.

El commit inicial `5f040bae1551d1c4a2cc8217a9b6675515aa7c9f` quedó en GitHub y
fue incluido en la publicación posterior de Usos de ingredientes, versión 18.
La rectificación se valida y publica sobre esa revisión, conservando sus cambios
y la audiencia pública. Los fixtures permanecen fuera del build y de operación.
Commit `5266322878a855aa59b66e51842305a279bfe636` subido a GitHub y al
repositorio del Site, validado y empaquetado desde checkout limpio: 215 pruebas,
tipos/build y checker aprobados. Sites confirmó `succeeded`, versión 19
`appgprj_6ae67ae019e88191a7012093bb19c505~appgver_eb2516fdc00c8191ac967af97f8fdfb2`,
despliegue `appgdep_6ae74b1d9a4c8191ac0ec8eba36c27c0`, en
[RCFito](https://rcfito.paxxa.chatgpt.site). Audiencia pública y entorno revisión 1
conservados. Tres comprobaciones posteriores aprobaron HTML, bundle exacto y
dashboard con Todas/estados HTTP 200. Sin escrituras ficticias en operación.
[Contrato y evidencia](flows/product-dashboard.md).

## Usos de ingredientes

2026-11-01: catálogo de clasificaciones principales de ingredientes y relación
opcional publicados desde el commit `a98f662787cbf63d0bd5920a5363e453a96f64f1`.
Se integraron los cambios recientes sin reemplazar trabajo local. La revisión
limpia aprobó 211 pruebas cliente, tipos/build y checker documental; el alcance
de persistencia aprobó 327 comprobaciones SQL y 99 HTTP con Supabase aislado.
QA demo de alta/relación/recarga, inactivos, lector y móvil aprobado; autorrevisión.

Antes del frontend se validó respaldo custom privado de PostgreSQL (442,895 bytes)
y se aplicó `20261101131945_ingredient_classifications.sql` con el gestor SHA-256:
seis aplicadas y cero pendientes. La comparación privada de productos,
composiciones, aplicaciones y su historial fue idéntica antes/después. Sin datos
ficticios en operación; catálogo vacío e ingredientes existentes sin clasificar.
No se leyó ni modificó el `.env` del usuario.

Docker reconstruido desde el mismo checkout, con montaje público conservado.
Sites confirmó `succeeded`, versión 18
`appgprj_6ae67ae019e88191a7012093bb19c505~appgver_90ff9d2328f0819186c6b6ebea1e1458`,
despliegue `appgdep_6ae74055171c8191848cbcdd649912e4`, en
[RCFito](https://rcfito.paxxa.chatgpt.site). Audiencia pública y entorno revisión 1
conservados. Doce comprobaciones posteriores en Site/local aprobaron HTML,
bundle exacto, selector de clasificación, conexión del mismo origen y rechazo
del catálogo anónimo 401. Sin escrituras de prueba en operación. Contrato y
límites de QA en [la ficha](flows/ingredient-classifications.md).

## Publicación del resumen por lote

Solicitud del 2026-11-01 con commit/push y Sites: resumen por lote, productos e
historial, Todas por defecto y cantidades ascendentes sin separar unidades. No
requiere migración ni cambios de secretos/configuración o datos. Validar y
empaquetar desde checkout limpio, conservando los cambios previos y la audiencia
pública existente.

Commit `ce7ed07fdd7c8ba593f4457627d96f20da488aaa` subido a GitHub y al
repositorio del Site; checkout limpio aprobó 224 pruebas, tipos/build y checker.
Sites confirmó `succeeded`, versión 20
`appgprj_6ae67ae019e88191a7012093bb19c505~appgver_9a2dd438d2608191a66c40b00536ecce`,
despliegue `appgdep_6ae7511fe7c881918829f8253bd77fac`, en
[RCFito](https://rcfito.paxxa.chatgpt.site). Audiencia pública y entorno revisión 1
conservados. Tres comprobaciones HTTP posteriores aprobaron inicio, bundle
exacto y resumen por lote/Todas. Sin escrituras ficticias en operación.
[Contrato](flows/product-dashboard.md#ampliación-resumen-por-lote).

## Captura conservada al revalidar sesión

2026-11-01: corregido el desmontaje de formularios al recibir de nuevo la sesión
del mismo usuario. Se mantiene la consulta en segundo plano y se conserva el
loader para inicio de conexión/cambio de identidad. No requiere migraciones,
reinicio del backend ni cambios de configuración, secretos o volúmenes.

Corrección `78182ba`, integrada con el cierre concurrente del resumen por lote en
`e3182347b89c98e9c2daa390351fe1b3dcd3375f`. 224 pruebas, tipos/build y checker
aprobados; QA aislado reprodujo la pérdida anterior y verificó nombre/nota/agua,
renovación, error de consulta, descarte y cierre de sesión. Autorrevisión.
Docker reconstruido y sano con el montaje público original. Sites confirmó
`succeeded`, versión 21
`appgprj_6ae67ae019e88191a7012093bb19c505~appgver_46f5ada9cf888191b905696a174dc531`,
despliegue `appgdep_6ae752c343c48191b1a941d50778b34d` a las
`2026-11-01T14:55:13Z`, en [RCFito](https://rcfito.paxxa.chatgpt.site).
Audiencia pública y entorno revisión 1 conservados. Nueve comprobaciones de
conexión posteriores aprobaron; HTML y hash del bundle coincidieron con la
compilación validada tanto en Sites como en 5180. Sin escrituras de negocio.
La versión nueva entra en vigor al recargar después de guardar o terminar una
captura abierta; el despliegue no fuerza esa recarga del navegador.

## Publicación del filtro global por lote

Solicitud del 2026-11-01 con commit/push y Sites: agregar Lote al dashboard para
actualizar métricas, tabla general, ranking, resumen e historiales. Todos los
lotes y Todas las aplicaciones se conservan por defecto; selección persistida en
URL e identidad de temporada. Sin migraciones ni cambios en el backend o entorno.

Implementado desde 4f78ff0 en worktree aislado, conservando la corrección de sesión
y los cambios locales de otras tareas. Commit 20c8ca6933727df3416092eed225ae1f9cb50aa5
subido a GitHub y repositorio de Sites. Revisión limpia aprobó 228/228 pruebas,
tipos/build y checker; QA demo/móvil e intersecciones aprobados, con revisión
independiente sin hallazgos. Sites confirmó succeeded, versión 23
appgprj_6ae67ae019e88191a7012093bb19c505~appgver_ae0c8d987b908191a75885fd77f9652f,
despliegue appgdep_6ae75b41bb48819184b4410f0d3a72de a las
2026-11-01T15:31:19Z, en [RCFito](https://rcfito.paxxa.chatgpt.site).
Audiencia pública y entorno revisión 1 conservados. Tres comprobaciones HTTP 200
posteriores verificaron HTML, bundle exacto y filtro Todos los lotes/Todas.
Sin migraciones ni escrituras ficticias en operación; servidor/tab de QA cerrados.
Recargar después de terminar cualquier captura abierta para recibir la versión.
[Contrato](flows/product-dashboard.md#filtro-global-por-lote).

## Dos decimales en reportes

2026-11-01, RCF-027: regla local documentada y formato de presentación compartido
aplicado a métricas, tablas generales/por lote e historial del dashboard. Se
conservan cálculos, captura y conteos; sin migraciones ni cambios de configuración.
Commit 672dd1b3d8fdfeea694e922c194b15bd90564583 subido a GitHub y repositorio de
Sites. 228 pruebas, ocho comprobaciones puntuales de redondeo, tipos/build/checker,
workflow de GitHub y QA demo/móvil aprobados. Autorrevisión. Sites confirmó
succeeded, versión 24
appgprj_6ae67ae019e88191a7012093bb19c505~appgver_76e8f420b11c8191a2b3fbdcd17ad8a8,
despliegue appgdep_6ae7677e4f348191b64fff081e1e48a6 a las
2026-11-01T16:23:33Z, en [RCFito](https://rcfito.paxxa.chatgpt.site).
Audiencia pública y entorno revisión 1 conservados; tres comprobaciones HTTP 200
posteriores verificaron HTML/bundle exacto y mínimo/máximo de dos decimales.
Sin datos ficticios en operación. La reapertura del source verificó el commit
actual antes de empaquetar, tras rechazarse la referencia de apertura anterior.
Recargar después de terminar cualquier captura abierta para recibir la versión.
[Regla](FRONTEND.md#decimales-en-reportes) y [QA](TESTING.md#decimales-en-reportes).

## Consultas por chat, audio y CLI

2026-11-01: rutinas de lectura instaladas tras respaldo privado de PostgreSQL de
450,444 bytes. `backend-local.mjs migrate` confirmó una migración aplicada;
`--check` registró siete aplicadas y cero pendientes, sin fixtures en operación.
La migración añade solo consultas, helpers de lectura e invalidación; no cambia
el contenido de aplicaciones existentes. La reversión de frontend puede usar la
versión anterior; el esquema aditivo puede permanecer instalado.

El Worker reutiliza la configuración cifrada de IA. Las consultas estructuradas
del CLI funcionan sin inferencia; el chat interpreta con el modelo guardado y
transcribe con `gpt-transcribe` usando la misma clave. El proveedor debe permitir
acceso a ese modelo de audio. Los límites de tamaño y formatos son compartidos
por cliente/servidor; el límite de dos minutos se comprueba en el navegador.

La caché privada utiliza el prefijo R2 `rcfito/query-cache/v1/`, separado de
configuración/túnel. Son como máximo 32 posiciones por usuario/instalación,
revalidación obligatoria contra Supabase y 60 segundos de validez lógica. Los
objetos caducados se sobrescriben; no se considera un archivo de conversación.
CLI login/refresh/logout conserva su sesión solo en `.artifacts/query-cli/` con
permisos privados. No copiar esa carpeta al publicar ni incluirla en Git.

Sites versión 25 confirmó `succeeded` para la fuente
`2e530ff6d3919a48d6749b61f600009654d03fb7`, integrada con las mejoras remotas de
reportes y sesión. Audiencia pública y entorno revisión 1 conservados; frontend
Docker actualizado desde la misma revisión limpia. Nueve comprobaciones HTTPS y
bundle/rutas Docker aprobados. [RCFito](https://rcfito.paxxa.chatgpt.site/#/consultas).

Versión nativa:
`appgprj_6ae67ae019e88191a7012093bb19c505~appgver_9ca87611ecf8819182be50fd487ef94f`.
Despliegue: `appgdep_6ae7688f0a1881919576944c60a1b2d7`.
[Ficha](flows/application-chat.md).

## Cierres confirmados por el Propietario

2026-11-01: el Propietario confirmó expresamente que RCF-010 (acceso remoto
estable), RCF-011 (reporte completo) y RCF-014 (captura con IA) ya quedaron
terminados y pidió cerrarlos. Esa confirmación es la evidencia de actualización
del estado; no se ejecutó una nueva instalación, cambio de proveedor o prueba
de disponibilidad durante esta revisión documental. Los registros históricos
conservan sus resultados y los límites propios de Quick Tunnel.
## Contexto y totales de productos por malla

2026-11-01: añadida la rutina invoker de resolución de contexto de consultas.
Respaldo privado previo de490,019 bytes; operación confirmó ocho migraciones
aplicadas y cero pendientes, sin fixtures. No se modificaron aplicaciones.

La pregunta habitual «cuánto de cada producto se ha aplicado en malla 5» no
requiere inferencia. El último contexto autorizado por usuario se guarda como
referencia de agrícola en `rcfito/query-context/v1/`, sin JWT ni conversación.
Las consultas estructuradas y el chat comparten resolución, cifras, filtros y
tablas. Se revalida el contexto después de cambios de asignaciones/estado.

281 pruebas integradas,124 SQL de consultas y129 HTTP acumuladas aprobadas en
aislamiento; incluye el pipeline literal del CLI con Auth/REST reales. La
publicación de esta ampliación confirmó `succeeded` en Sites versión26 con fuente
`4b0a4005005b3d7ff21875eaa6cdce28ab770a8f`. Frontend Docker actualizado desde
el mismo checkout limpio; audiencia pública y entorno revisión1 conservados.
Once comprobaciones posteriores de Sites/Docker aprobaron bundle, tablas y
rechazo de consultas anónimas. No se ejecutó inferencia real para esta prueba.

Versión nativa:
`appgprj_6ae67ae019e88191a7012093bb19c505~appgver_cfd7c892272881918da5b451e57bc8e2`.
Despliegue: `appgdep_6ae774fb57908191966de675183e20ec`.

La revisión visual posterior comprobó la frase literal con servicios ficticios
en escritorio y móvil de375 px, sin consumo de proveedor. Las tablas conservan
ancho mínimo legible y desplazamiento horizontal interno, sin desbordamiento del
documento. Build y check documental aprobados después del ajuste.

Sites versión27 confirmó `succeeded` para la fuente
`9f943df2ea2ea6472aa04d75309ec6c9bac557c2`; Docker usa el mismo build. Audiencia
pública y entorno revisión1 conservados. Doce comprobaciones posteriores
aprobaron bundle, tablas, CSS móvil y protección de endpoints.

Versión nativa:
`appgprj_6ae67ae019e88191a7012093bb19c505~appgver_9dd70f652a608191958d46859ac054e2`.
Despliegue: `appgdep_6ae776da2ce881919574998505cbe9d2`.

## Corrección de preguntas equivalentes de productos

2026-11-01: la pregunta «Qué productos hemos usado en malla 5» conserva la
resolución del lote y devuelve productos/cantidades. Si no hay realizadas,
explica la ausencia y permite consultar indicadas explícitamente con los mismos
filtros. Verificación en backend aislado con Auth/REST/RLS reales y navegador
ficticio a375 px.286 pruebas,132 comprobaciones acumuladas de integración,
tipos/build y checker aprobados; revisión independiente sin pendientes.

Fuente publicada: `8aea36e3b921f483ee1ffaa78f5e5d7632a5edc1` en GitHub y Sites
versión28, con frontend Docker de la misma revisión limpia. Doce comprobaciones
posteriores confirmaron bundle, tabla de productos, acción de indicados, CSS y
rechazo de consultas anónimas. Audiencia pública y entorno revisión1 conservados.
Sin migraciones ni escrituras operativas; no se usó inferencia real.

Versión nativa:
`appgprj_6ae67ae019e88191a7012093bb19c505~appgver_f1b6bc4b085c8191afe717275ebb4838`.
Despliegue: `appgdep_6ae78587b00081919508803493dfb9a9`.

## Origen de grupo en aplicaciones

2026-11-02: RCF-029 autorizado después de revisar la distinción entre emisión
para grupo e individual. Respaldo custom privado de PostgreSQL creado y validado
(516,088 bytes) antes de aplicar `20261102152713_application_group_origin.sql`.
Registro operativo: nueve migraciones aplicadas, cero pendientes. Comparación
privada antes/después confirmó órdenes, destinos, estados, números y valores
originales intactos. No se cargaron fixtures en operación.

La migración conserva desconocido el origen antiguo y registra el origen de
las creaciones nuevas. Secretos, volúmenes, configuración pública y audiencia
vigente se conservan. La reversión del frontend no elimina estas columnas ni
reescribe historia. Validación previa: 290 pruebas, 351 SQL, 153 HTTP, advisors
sin WARN/ERROR y QA demo de origen/recarga/móvil. Hubo autorrevisión.

## Corrección histórica excepcional del grupo

2026-11-02: el Propietario solicitó corregir el historial una sola vez y confirmó
que todas las aplicaciones se emitieron para el grupo completo. Revisión de
solo lectura: 23 órdenes de origen desconocido, 92 destinos y un único grupo de
cuatro integrantes; mismo contexto y coincidencia completa en las 23 órdenes.

`scripts/backfill-application-group.mjs` congeló un plan privado de esos IDs y
huellas. Pasaron 11 comprobaciones aisladas con fixtures, incluida reversión,
auditoría, reintento rechazado y guardas habilitadas. La simulación operativa se
revirtió; después se creó y validó un respaldo custom nuevo de 522,936 bytes y
se aplicó la corrección limitada al plan en una sola transacción.

Plan, respaldo e informes quedan fuera de Git en el directorio privado de
mantenimiento de `.artifacts/production-supabase`. Auditoría única en
`rcfito_meta.data_corrections`: autoridad del Propietario, huella del plan,
identidades y metadatos antes/después. Una conexión nueva confirmó las 23/92
referencias corregidas, valores originales intactos, las cuatro guardas
habilitadas y ausencia de acceso del cliente a la auditoría. Registro de
migraciones: nueve aplicadas, cero pendientes; no se modificaron migraciones.

La interfaz publicada en Sites 29 y Docker recupera esos datos al recargar.
Esta operación modifica únicamente datos del backend, sin nueva publicación del
frontend. [Alcance autorizado](flows/application-group-origin.md#corrección-histórica-confirmada-por-el-propietario).

Fuente `0ac5ad41ba204c920105832601e7ccd434f37665` integrada con la documentación
remota reciente y subida a GitHub y al repositorio de Sites. Checkout limpio:
290 pruebas, docs y build aprobados. Docker reconstruido desde esa fuente,
contenedor healthy y cinco comprobaciones locales aprobadas: frontend, código
de origen, Auth, REST anónimo rechazado y límite del proxy.

Sites confirmó `succeeded`, versión 29
`appgprj_6ae67ae019e88191a7012093bb19c505~appgver_1a8e501d3c048191bc9d1ad9431cef0c`,
despliegue `appgdep_6ae8b4cccd0481918b1e0865ab714f1e`, en
[RCFito](https://rcfito.paxxa.chatgpt.site). Audiencia pública, R2 y revisión de
entorno 1 conservados. Las nueve comprobaciones HTTPS posteriores aprobaron
sin crear datos ni cuentas. [Contrato](flows/application-group-origin.md).
Los cambios ajenos preexistentes del workspace quedaron fuera de esta fuente.


## Nuevas recetas por lote o grupo — RCF-030

2026-11-02: fuente `7bf313769deb5b99db019c28382024896ec01e47` publicada en
GitHub, Docker y Sites versión **30**. Pantalla en Aplicaciones → Nueva receta.
Crea una indicación desde la última base activa por etapa o emisión explícita de
grupo, con elección entre empates, copia de última revisión y referencia de la
base conservada. [Contrato y evidencia](flows/recipe-creation.md).

Migración `20261102171500_application_recipe_source` aplicada mediante el migrador
registrado: 10 aplicadas/0 pendientes. Respaldo privado previo de 531,292 bytes
validado con pg_restore. Hashes de las 23 órdenes, 92 destinos, productos e
historial conservaron los valores originales; las nuevas referencias quedaron
nulas en las órdenes anteriores. Sin nuevas capturas ni fixtures en operación.

297 pruebas de dominio, 372 SQL, 167 HTTP y advisors sin WARN/ERROR aprobados;
typecheck, build, docs y diff correctos. Navegador demo: individual/grupo,
base de última revisión, empates, grupo sugerido explícito, confirmaciones,
recarga, lector y móvil 375 px/escritorio 1440 px. No se atribuye una captura
real de la nueva pantalla a la verificación demo. Autorrevisión, sin revisor
independiente; se conserva la advertencia previa de bundle mayor de 500 kB.

Docker reconstruido desde esa fuente y healthy: frontend/pantalla/Auth HTTP 200,
consulta anónima 401. Sites confirmó `succeeded`, versión
`appgprj_6ae67ae019e88191a7012093bb19c505~appgver_a67893d2d0b4819180b5fee841816010`,
despliegue `appgdep_6ae8c8c4a1ec81918c8a41707e175895`, en
[RCFito](https://rcfito.paxxa.chatgpt.site). Audiencia pública, R2 y revisión de
entorno 1 conservados. Nueve comprobaciones HTTPS de conexión y tres del código
publicado aprobaron sin escrituras. Los cambios ajenos del workspace quedaron
fuera del commit de implementación.


## Captura unificada de indicaciones — RCF-030

2026-11-02: fuente `32c4937a27e8a603c45f123115911dc5b81fd7c1` publicada en
GitHub, Docker y Sites versión **31**. Aplicaciones muestra un solo botón
**Nueva indicación**: última activa por defecto, búsqueda de anteriores activas
y modo desde cero en el mismo formulario. Se conservan selección manual,
numeración opcional revisada y la revisión propia de captura con IA.
[Contrato y evidencia](flows/recipe-creation.md#ampliación-autorizada-una-sola-entrada).

301 pruebas de dominio y 167 controles HTTP/Auth/REST/Edge/RLS aprobados;
advisors sin WARN/ERROR. Tipos, build, docs y diff aprobados. QA con datos
ficticios: carga inicial, empates, búsqueda, rechazo de recetas individuales
para un grupo, confirmación de reemplazo, fechas conservadas, guardado individual
desde anterior, manual desde cero con dos destinos/número confirmado, recarga,
contexto heredado, lector y móvil 375 px. Autorrevisión de React/contratos;
no se presenta como revisión independiente. Advertencia previa del bundle
principal mayor de 500 kB conservada.

No se añadieron migraciones ni se escribieron datos de operación. Registro
comprobado: 10 aplicadas/0 pendientes. Los respaldos e historial anteriores
permanecen conservados. Docker healthy, frontend/código/Auth HTTP 200, consulta
anónima 401 y bundle exacto comprobados.

Sites confirmó `succeeded`, versión
`appgprj_6ae67ae019e88191a7012093bb19c505~appgver_87b8216f08f881918b442689242a2abb`,
despliegue `appgdep_6ae8dcb73e60819187a068ca1b16fb9d`, en
[RCFito](https://rcfito.paxxa.chatgpt.site). Audiencia pública, R2 y revisión de
entorno 1 conservados. Nueve controles HTTPS de conexión y tres de código
publicado aprobados sin crear datos ni cuentas. Fuente trabajada en checkout
limpio; cambios ajenos preexistentes fuera del commit.

## PDF del borrador de receta — RCF-035

2026-11-02: fuente `16522f0795375b085bbe1143f4dfee41d708f188` publicada en
GitHub, frontend Docker y Sites versión **32**. La captura unificada y la revisión
de IA ofrecen **Exportar borrador PDF** antes de guardar. Incluye destinos,
productos, dosis y agua por hectárea; fecha programada vacía se presenta como
«Fecha programada por confirmar». Guardar conserva su validación original.
[Contrato y evidencia](flows/recipe-draft-pdf.md).

306 pruebas, tipos, build y checker documental aprobados. PDF ficticios de una
y cuatro páginas renderizados/revisados, más descargas reales de la demo desde
base anterior y revisión IA. Dosis precisas, cambios de referencia, bloqueo de
guardar sin fecha y móvil 375 px comprobados. Autorrevisión de React y fronteras;
no se atribuye revisión independiente. Cero vulnerabilidades de producción;
advertencias anteriores de herramientas/chunk principal conservadas.

No hay nuevas migraciones, cambios de backend, datos operativos escritos ni
servicios externos al exportar. Tipografías locales con licencia redistribuida;
las copias ficticias de QA quedan fuera de Git y del build público. Docker
`healthy`; bundle exacto, módulo PDF, dos fuentes TTF, licencia, Auth y rechazo
anónimo comprobados en local y Sites. Nueve controles HTTPS de conexión pasaron.

Sites confirmó `succeeded`, versión
`appgprj_6ae67ae019e88191a7012093bb19c505~appgver_e37bb3e285c88191b4779cb97f04987f`,
despliegue `appgdep_6ae8f304dac4819190c5691154dfc8bc`, en
[RCFito](https://rcfito.paxxa.chatgpt.site). Audiencia pública, R2 y revisión de
entorno 1 conservados. Cambios ajenos del workspace fuera de los commits propios.

## PDF de recetas guardadas — RCF-036

2026-11-02: fuente `cd165f882c6d02a71c75ccf0d50fc70b40b44dcc` publicada en
GitHub, frontend Docker y Sites versión **33**. El detalle ofrece **Exportar
receta PDF** de la última versión indicada confirmada por el Propietario, con
folio/revisión, destinos históricos, productos, dosis y agua por hectárea.
No incluye la mezcla real aplicada ni calcula totales. Conserva número, estado
y revisión indicada por destino; identifica los que recibieron otra revisión.
[Contrato](flows/saved-recipe-pdf.md).

311 pruebas, tipos, build, checker y revisión del diff aprobados. PDF ficticios
de una/seis páginas renderizados e inspeccionados, más regresión de borrador
de una/cuatro. Navegador: descargas de revisión 0 y última revisión 1 tras recarga,
lector asignado, rechazo de agrícola ajena, móvil 375 px y borrador sin fecha.
Archivos descargados verificados. Autorrevisión de React/contratos/permisos;
sin revisión independiente ni pruebas nuevas de SQL/HTTP de RCF-030.

No hay nuevos endpoints, dependencias, migraciones ni datos operativos escritos.
Docker `healthy`; código exacto, botón, formatos guardado/borrador, fuentes,
licencia, Auth y rechazo anónimo comprobados en local y Sites. Nueve controles
HTTPS de conexión aprobaron. Advertencias anteriores de tooling/chunk conservadas.

Sites confirmó `succeeded`, versión
`appgprj_6ae67ae019e88191a7012093bb19c505~appgver_f73c308ae0a08191841e82afc92be9ab`,
despliegue `appgdep_6ae8f79ea7a48191b7436c6e5e81f135`, en
[RCFito](https://rcfito.paxxa.chatgpt.site). Audiencia pública, R2 y revisión de
entorno 1 conservados. Los PDF de QA ficticios quedan fuera de Git y builds.

## Dependencias de desarrollo — RCF-005

2026-11-02: fuente final `87964bf84b5c614f7e83bfce03b84a608b8c6d3a` publicada
en GitHub, frontend Docker y Sites versión **35**. Se retiró la CLI de shadcn
no ejecutada por los comandos del proyecto y sus 214 dependencias exclusivas.
La hoja CSS que aportaba se conserva localmente, sin modificaciones y con su
licencia MIT distribuida. `@shadcn/react`, Radix y los componentes permanecen.
[Revisión de cadenas y avisos](SECURITY.md#dependencias-de-desarrollo--rcf-005).

Instalación reproducible de 163 paquetes, 164 auditados; auditorías completa y
producción en cero. Los paquetes restantes conservan versión y metadatos; sin
overrides ni avisos ignorados. 311 pruebas, tipos, build/checker y compilación
Docker Linux aprobados. Esta última detectó y permitió corregir una resolución
CSS desde el checkout padre que ocultaba el fallo en el primer build local.
El manifiesto final conserva idénticos los 37 recursos existentes de Sites 33
y añade solo la licencia de shadcn. La advertencia previa del chunk permanece.
[Evidencia](TESTING.md#dependencias-de-desarrollo--rcf-005).

La versión 34 se guardó sin desplegar; el despliegue se realizó sobre la versión
35, que incluye el import CSS local comprobado. Docker `healthy`; recursos
exactos, estilos y licencia MIT, PDF/fuentes, Auth y rechazo anónimo comprobados
en local y Sites. Nueve controles HTTPS de conexión aprobados. Sin migraciones,
nuevos datos ni cambios de configuración del backend. Los informes privados
de npm se conservan fuera de Git; no se leyó el `.env` de la raíz.

Sites confirmó `succeeded`, versión
`appgprj_6ae67ae019e88191a7012093bb19c505~appgver_143dc8bcd8fc8191851b875938ef778c`,
despliegue `appgdep_6ae92e9a887481919a55425921d3cb82`, en
[RCFito](https://rcfito.paxxa.chatgpt.site). Audiencia pública, R2 y revisión de
entorno 1 conservados. Cambios ajenos del workspace fuera de los commits propios.


## Eliminación excepcional de captura — RCF-037

2026-11-02: aplicada la eliminación puntual solicitada por el Propietario para
liberar folio y números de aplicación. Quince controles PostgreSQL aislados y
simulación operativa aprobados antes de ejecutar. Respaldo privado custom de
537,230 bytes validado; una orden pendiente, cuatro destinos y cinco líneas
retirados. Sin realizaciones, revisiones ni recetas dependientes.

Comparación antes/después confirma grupos, integrantes, demás aplicaciones e
historial idénticos. Guardas restauradas, FK/RLS/permisos conservados y ledger
10/0 intacto. Se comprobó sin consumir la secuencia que el folio retirado y el
siguiente número de las cuatro etapas quedaron disponibles. Plan/resultados y
respaldo solo en mantenimiento privado; ningún dato identificable en Git.
[Procedimiento, límites y recaptura](flows/application-removal.md).

No cambian frontend, Worker, endpoints ni configuración: no requiere nuevo
despliegue de Docker/Sites. No se creó una recaptura ficticia en operación ni
se consumió IA. Cierre de la corrección de datos, sin afirmar validación de una
nueva captura real del Propietario.

## Accesibilidad y descarte — RCF-006

Las correcciones de teclado, foco, contraste, botones y ventanas bajas quedaron
publicadas el 2026-11-02 desde la fuente `22a2fe21884fbbf034ce0e491d9d568e48bdafa2`
en GitHub, frontend Docker y Sites versión **36**. Sites confirmó `succeeded`,
despliegue `appgdep_6ae947eed92c81919c38dac4f8f85373`, en
[RCFito](https://rcfito.paxxa.chatgpt.site). Audiencia pública, R2 y revisión de
entorno 1 conservados. Recursos publicados, PDF/fuentes, Auth y rechazo anónimo
comprobados en Docker y Sites sin escrituras de operación.

2026-11-03: el Propietario solicitó «descarta la 006». Se cancela la verificación
restante al 200 % y la tarea pasa a descartada; las mejoras publicadas se
conservan. El descarte no acredita esa prueba ni la revisión completa de
accesibilidad. No requiere modificar o volver a desplegar la aplicación.
[Decisión y evidencia parcial](accessibility-review.md#descarte-por-el-propietario).

## Orden descendente por lote — RCF-031

2026-11-03: fuente `71256caaf1288daa120c1a575c579893d0807c43` publicada en
GitHub, frontend Docker y Sites versión **37**. **Ver productos** del lote ordena
por cantidad calculada descendente antes de paginar; tabla general ascendente,
ranking, historial, unidades y filtros conservados.

312 pruebas, tipos, build Linux/Windows y checker aprobados. QA con trece
productos/dos páginas, filtro Realizadas, historial exclusivo con retorno de foco
y móvil 375 px aprobado. Entrada, CSS, JS principal y módulos reporte/compartido
exactos, Auth y rechazo anónimo verificados en Docker/Sites. Nueve controles
HTTPS de conexión aprobados; Docker `healthy`. Sin migraciones ni escrituras
de operación. [Reglas y evidencia](flows/product-dashboard.md#orden-descendente-por-lote--rcf-031).

Sites confirmó `succeeded`, versión
`appgprj_6ae67ae019e88191a7012093bb19c505~appgver_24b5678623388191a42b7ef0a4044eb1`,
despliegue `appgdep_6aea56c2ab648191b01eadc1784d7930`, en
[RCFito](https://rcfito.paxxa.chatgpt.site). Audiencia pública, R2 y revisión de
entorno 1 conservados. Cambios ajenos del workspace fuera de los commits propios.


## Correcciones de malla — RCF-038

2026-11-04: migración 20261104180000 instalada en rcfito-db después de un respaldo
privado custom de 446,125 bytes, índice y copia SHA-256 validados. Registro de once
migraciones coherente, cero pendientes. La comparación transaccional de conteos y
huellas confirma que once tablas de negocio conservan sus valores originales;
solo se añaden metadatos y la auditoría vacía. No se llamó a la RPC de corrección
en operación ni se cargaron fixtures. RLS, columnas privadas y denegación de DML
y RPC anónima comprobados; caché de esquema REST renovada.

Verificación previa: 320 pruebas puras, 417 SQL, 210 HTTP/Auth y advisors sin
WARN/ERROR en entornos aislados. [Alcance y evidencia](flows/lot-corrections.md).
Fuente 61c248318fcd45e7c70951e8c5167a2de18d1fa6 publicada en GitHub, frontend
Docker healthy y Sites versión **38**. Entrada y seis recursos exactos, incluidos
editor/historial/PDF, Auth y rechazo anónimo de REST/RPC verificados en ambos
destinos; nueve controles HTTPS de conexión aprobados sin escrituras. Build
Linux/Windows y checker aprobados; advertencia previa del chunk conservada.

Sites confirmó succeeded, versión
appgprj_6ae67ae019e88191a7012093bb19c505~appgver_4dc7629840888191816fa12b7bfc6025,
despliegue appgdep_6aeb363a965881919d9963220c1227fe en
[RCFito](https://rcfito.paxxa.chatgpt.site). Audiencia pública, R2 y revisión de
entorno 1 conservados. Los cambios ajenos de la carpeta no forman parte de esta
entrega. Los respaldos y los PDF/capturas ficticios permanecen fuera de Git/builds.


## Orden alfabético general — RCF-039

2026-11-04: criterio compartido aplicado a listados y selectores de registros,
con excepciones expresas de fechas, etapas, cantidades, ranking y secuencias de
captura/estados. Regla normativa en [FRONTEND](FRONTEND.md#orden-general-de-listados--rcf-039)
e [inventario de cobertura](flows/list-order.md). 325 pruebas, tipos y QA demo
escritorio/móvil aprobados. No hay migraciones ni cambios de permisos, fórmulas,
dependencias o configuración de backend. Ninguna escritura de datos en operación.
Fuente 621f02e4662045e88072d19902c56a082e241144 publicada en GitHub, frontend
Docker healthy y Sites versión **39**. Build Linux/Windows y checker aprobados;
advertencia previa de tamaño del chunk conservada. Entrada y los 37 recursos
estáticos exactos, incluido el orden compartido, comprobados en Docker y Sites.
Auth y rechazo anónimo de datos y nueve controles HTTPS aprobados. Ledger 11/0
conservado, sin nuevas migraciones ni escrituras de datos operativos.

Sites confirmó succeeded, versión
appgprj_6ae67ae019e88191a7012093bb19c505~appgver_58d6f068dbb0819187210d43acfd1947,
despliegue appgdep_6aeb5048fe1c8191a89300c59f458db8 en
[RCFito](https://rcfito.paxxa.chatgpt.site). Audiencia pública, R2 y revisión de
entorno 1 conservados. Cambios ajenos de la carpeta excluidos de esta entrega.


## Captura desde imagen — RCF-040

2026-11-04: fuente b61d3362448eb37e48a047e852c214052cac1555 en GitHub.
Migración 20261104171758 instalada con respaldo privado validado de 570,619
bytes; ledger 12/0, conteos y hashes de órdenes/destinos/productos/historial
conservados. Sin fixtures ni inferencias reales en operación.

Docker healthy y Sites versión **40**, construidos desde la misma copia limpia.
367 pruebas, tipos, checker y build Linux/Windows aprobados; regresión SQL/HTTP
aislada aprobada. Entrada y 38 recursos exactos por destino, interfaz compilada
de imagen, Auth y rechazo anónimo de datos/IA comprobados: nueve controles
por destino. La entrada del Site admite solo la inyección conocida de Cloudflare.

Sites confirmó succeeded, versión
appgprj_6ae67ae019e88191a7012093bb19c505~appgver_515f3e12426c81919cc581379839d355,
despliegue appgdep_6aeb9d4f82e88191aeb9ce173e4e0eb3 en
[RCFito](https://rcfito.paxxa.chatgpt.site). Audiencia pública, R2, revisión de
entorno 1 y configuración IA conservados. Cambios ajenos excluidos.
Advertencia previa de tamaño del chunk conservada.

La herramienta visual agotó el acceso a la ventana; el recorrido de carga/pegado,
aprobación y móvil no se verificó en navegador. Se acredita código y pruebas
automatizadas, con ese límite explícito en [la ficha](flows/image-capture.md).


## Intervalo programado de aplicaciones — RCF-041

2026-11-05: añadido el intervalo calendario bajo la fecha programada, con apertura
de fecha/folio anterior. Usa historial autorizado completo y la última indicación,
con ámbito histórico y exclusión de cancelaciones totales. [Reglas](flows/application-schedule.md).
374 pruebas, tipos/build/checker y QA demo de teclado, móvil y lector aprobados.
No hay migraciones, dependencias o permisos nuevos ni escrituras de operación.
Fuente 090b91dc886a32f96f8cc1e2c641c7364883cefe publicada en GitHub, frontend
Docker healthy y Sites versión **41**. Build Linux/Windows y checker aprobados;
advertencia previa del tamaño de chunk conservada. Entrada y 38 recursos exactos,
incluido el intervalo compilado, Auth y rechazo anónimo comprobados en Docker y
Sites; nueve controles HTTPS aprobados. Registro de migraciones 12/0 conservado.

Sites confirmó succeeded, versión
appgprj_6ae67ae019e88191a7012093bb19c505~appgver_949dcc54b10481918feb8980eb25557d,
despliegue appgdep_6aece24a2b588191a55162013a63ffef en
[RCFito](https://rcfito.paxxa.chatgpt.site). Audiencia pública, R2 y revisión de
entorno 1 conservados. Cambios ajenos de la carpeta excluidos de la entrega.


## Secuencia descendente de recetas — RCF-042

2026-11-05: la receta anterior se elige por folio, con listado de mayor a menor
número. Fechas programadas se usan solo para la diferencia; los retrocesos se
muestran como «N días antes de la anterior». 376 pruebas y QA demo de escritorio,
móvil, teclado y recarga aprobados; caso reportado comprobado en consulta privada
de solo lectura. [Decisión y reglas](flows/application-schedule.md#corrección-de-secuencia--rcf-042).
Sin migraciones, dependencias ni escrituras de datos en operación.
Fuente `eddc923eb26e41b24be228538ec31ef14c20a63f` publicada en GitHub, frontend
Docker healthy y Sites versión **42**. Tipos/build/checker aprobados; advertencia
previa de tamaño de chunk conservada. Entrada y 38 recursos estáticos exactos,
incluida la secuencia corregida, Auth y rechazo anónimo comprobados en ambos
destinos. Nueve controles HTTPS aprobados y registro de migraciones 12/0 conservado.

Sites confirmó `succeeded`, versión
`appgprj_6ae67ae019e88191a7012093bb19c505~appgver_c64caa3ce70c8191b9d73b7ccf305519`,
despliegue `appgdep_6aece69f4be0819195c3131a4bd28fc9` en
[RCFito](https://rcfito.paxxa.chatgpt.site). Audiencia pública, R2 y revisión de
entorno 1 conservados. Cambios ajenos del workspace excluidos de la entrega.

## Fecha real e intervalo de aplicaciones — RCF-043

2026-11-05: el listado muestra fechas reales y compara el mismo destino con la
receta anterior por folio. Contempla fechas distintas, parcial, pendiente y
cancelación sin usar la programación como reemplazo. Filtros por realización;
folios descendentes conservados. [Contrato](flows/application-performance-dates.md).
383 pruebas, tipos/build y QA demo de teclado, móvil y recarga aprobados.
Sin migraciones, dependencias, permisos nuevos ni escrituras de operación.
Fuente `041a9260b47898c06acf1f0992113b07a408347f` publicada en GitHub, frontend
Docker healthy y Sites versión **43**. Entrada y 38 recursos estáticos exactos,
incluidas fechas reales y estados, Auth y rechazo anónimo verificados en ambos
destinos. Nueve controles HTTPS aprobados y registro de migraciones 12/0 conservado.
Tipos/build/checker aprobados; advertencia previa de tamaño de chunk conservada.

Sites confirmó `succeeded`, versión
`appgprj_6ae67ae019e88191a7012093bb19c505~appgver_65c50fc334f881919f4f80450f95e0bc`,
despliegue `appgdep_6aeced4adf6c8191894af4288639eb76` en
[RCFito](https://rcfito.paxxa.chatgpt.site). Audiencia pública, R2 y revisión de
entorno 1 conservados. Cambios ajenos del workspace excluidos de la entrega.


## Permisos de menú por usuario — RCF-044

2026-11-05: fuente `1ffb49b0b26fee32c1852a35d6c6fb8ac5148ad8` publicada en
GitHub, Docker y Sites **44**. Usuarios y accesos permite seleccionar menús y
catálogos por cuenta de consulta, plantillas, copia e historial. Se conserva
administración completa, último administrador activo, roles y ámbito agrícola.
[Contrato, dependencias y QA](flows/menu-permissions.md).

391 pruebas de cliente en la revisión integrada con fechas reales; 516 SQL de
aplicaciones/catálogos/menús y 124 de consultas/contexto, más 268 HTTP/Auth/REST/
Edge/RLS aprobados. Advisors sin WARN/ERROR; tipos, build y checker aprobados.
QA ficticio de permisos, URL directa, cero secciones, copia, plantilla, bloqueo
de último administrador, recarga, historial, descarte y móvil 375 px aprobado.
Autorrevisión; no se presenta como revisión independiente. Advertencia anterior
del chunk principal conservada. Los recursos de QA ficticios quedan fuera de Git.

Respaldo privado custom validado (600,378 bytes) y copia previa del código de alta
antes de `20261105203609_user_menu_permissions.sql`; ledger SHA-256 con trece
aplicadas y cero pendientes. Comparación privada conserva todos los registros de
negocio, roles y asignaciones. La inicialización añade los menús compatibles a las
cuentas existentes, sin eventos de cambios inventados. Se actualizó solo el código
de admin-create-user y se reinició su servicio. Entorno, secretos y volúmenes
conservados; no se leyó ni modificó el `.env` del usuario ni se generaron fixtures.

Docker healthy y build integrado exacto. Sites confirmó succeeded para versión
`appgprj_6ae67ae019e88191a7012093bb19c505~appgver_871bf3687ab48191b91a91723d0a7b2e`,
despliegue `appgdep_6aecf05a60008191a093230e29efa19b`, en
[RCFito](https://rcfito.paxxa.chatgpt.site). Audiencia pública, R2 y entorno
revisión 1 conservados. Se comprobaron entrada y 38 recursos estáticos exactos
por destino, configuración del mismo origen, Auth 200 y rechazo anónimo 401 de
referencias, sello, alta e historial (90 controles en total). Otros 20 controles
HTTPS del túnel aprobaron sin crear cuentas ni registros de operación.
