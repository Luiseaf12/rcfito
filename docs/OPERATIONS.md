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
migraciones, primera cuenta y altas privadas. La composición base tiene siete
servicios y grupo `rcfito-supabase`. La instalación de operación y su endpoint
HTTPS no se han iniciado ni configurado.

El frontend se administra por separado como `rcfito-frontend`/`rcfito-web`:

```sh
docker network create rcfito-backend
docker compose --env-file .env.example -f compose.frontend.yaml up -d --build
```

Crear la red solo si aún no existe; la composición Supabase también la usa.
El frontend queda en `http://127.0.0.1:5180`, enlazado a loopback; el acceso
exterior requiere proxy/HTTPS. El `.env` preexistente del usuario no se modifica:
frontend selecciona explícitamente el ejemplo vacío y backend genera su
configuración privada en una carpeta propia ignorada.

El servidor de operación permanecerá en este equipo y deberá estar encendido
durante el uso. Sites aloja el frontend, no la base local; cada dispositivo
necesita una URL HTTPS de Supabase accesible para operar con datos reales.

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
