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

Frontend Docker, commit/push y Sites: en publicación. El cierre se registra aquí
tras confirmar sus resultados. [Contrato](flows/application-group-origin.md).
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
