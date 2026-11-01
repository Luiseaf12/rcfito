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
El acceso remoto de prueba usa el Quick Tunnel; un endpoint estable de operación
requiere una decisión posterior.

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

La activación sigue pendiente de que el Propietario ingrese su clave y modelo en
esta sección. La verificación de implementación usa dependencias ficticias y no
confirma una conexión de proveedor real. Evidencia en
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
