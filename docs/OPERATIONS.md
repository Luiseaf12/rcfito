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
captura tras recargar, confirmada también en PostgreSQL. HTTPS exterior no está
configurado.

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
El dominio y acceso remoto quedan pendientes por separado.

## GitHub y Sites

El Propietario autorizó commit/push a
[Luiseaf12/rcfito](https://github.com/Luiseaf12/rcfito) y publicación en ChatGPT
Sites. [hosting.json](../.openai/hosting.json) conserva la identidad y declara
`dist` como salida estática. La audiencia nueva es privada y se conserva.

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
frontend alojado no habilita por sí mismo acceso remoto a la BD; esa conexión
sigue en RCF-008.

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
