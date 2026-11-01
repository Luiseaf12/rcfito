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
Falta publicar el commit consolidado en Sites, conservando su audiencia pública
vigente. Las nueve comprobaciones HTTPS previas aprobaron; no sustituyen el
resultado nativo del despliegue nuevo. Actualizar aquí la revisión y ese resultado;
el detalle de QA está en [TESTING](TESTING.md#aplicaciones-y-grupos-cierre-en-curso).

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
