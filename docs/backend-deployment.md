# Supabase: operación y pruebas

## Estado

La migración y la función de altas están implementadas. La instalación de
operación local ya inició sus siete servicios sanos con datos persistentes. El
frontend Docker está en `http://127.0.0.1:5180`, con conexión del mismo origen
mediante `/supabase`. La migración está aplicada y la pantalla de acceso real se
abre en navegador. Primera cuenta, login de administrador y captura persistida
tras recargar ya están comprobados con confirmación en PostgreSQL.
El acceso exterior de prueba utiliza Cloudflare Quick Tunnel y un proxy limitado
a la API, según [OPERATIONS](OPERATIONS.md#quick-tunnel-gratuito-para-pruebas).
El endpoint estable de operación y SMTP siguen pendientes. La conexión de Sites
a loopback no se usa para este acceso remoto.

## Configuración de operación

Se conserva una copia de la configuración oficial de Supabase
`self-hosted/v0.8.3`, revisión `bc27d2661edd09a5d0b8d76ce33da6d4071a756e`, en
`infra/supabase/upstream/`, con su licencia. La adaptación está separada en
`infra/supabase/compose.rcfito.yaml`. Los ejemplos de secretos comentados del
proveedor se sustituyeron por referencias a variables, según el
[registro de seguridad](SECURITY.md#ejemplos-del-proveedor-y-alerta-de-github).

El grupo `rcfito-supabase` inicia siete servicios: `rcfito-db`, `rcfito-auth`,
`rcfito-rest`, `rcfito-gateway`, `rcfito-studio`, `rcfito-meta` y
`rcfito-functions`. Realtime, almacenamiento de archivos y pooler están en
perfiles opcionales, desactivados para el alcance actual. El frontend es el
otro grupo Compose, definido por su propio runbook.

Para una instalación local **nueva**:

```sh
node scripts/backend-prepare.mjs --local
```

La instalación actual ya está preparada; no repetir este comando. Para una
instalación nueva con acceso exterior se usan las URLs HTTPS reales:

```sh
node scripts/backend-prepare.mjs --api-url https://api.ejemplo.invalid --site-url https://sitio.ejemplo.invalid
```

Las URLs anteriores son ejemplos, no destinos configurados. El helper copia el
bundle a `.artifacts/production-supabase`, genera secretos con las utilidades
oficiales y conserva `.env` fuera de Git. Nunca imprime claves. Rechaza una
configuración privada existente para evitar rotar secretos accidentalmente.
En Windows necesita Bash de Git y OpenSSL; Linux necesita Bash, OpenSSL y Node.

Desde la raíz del repositorio se administra el grupo con entorno y archivos
explícitos; así Compose no lee el `.env` preexistente del usuario:

```sh
docker compose --env-file .artifacts/production-supabase/.env -f .artifacts/production-supabase/docker-compose.yml -f .artifacts/production-supabase/compose.rcfito.yaml config --quiet
docker compose --env-file .artifacts/production-supabase/.env -f .artifacts/production-supabase/docker-compose.yml -f .artifacts/production-supabase/compose.rcfito.yaml up -d --wait
```

La puerta API se enlaza a `127.0.0.1:55451`; PostgreSQL no publica puerto.
El frontend local reenvía únicamente Auth, REST y funciones bajo `/supabase` por
la red `rcfito-backend`; no expone Studio. El arranque y JSON público del frontend
están en [OPERATIONS](OPERATIONS.md#docker-y-supabase). Para acceso exterior,
usar el proxy del Quick Tunnel o configurar otro proxy HTTPS y restringir Studio.
Configurar SMTP antes de habilitar
recuperación de cuentas. La aplicación usa únicamente la clave publicable.

Después de que Auth inicialice su esquema:

```sh
node scripts/backend-local.mjs --check
node scripts/backend-local.mjs migrate
node scripts/backend-local.mjs --check
```

`--check` solo consulta. `migrate` aplica las pendientes de `supabase/migrations`
en orden, con bloqueo y transacción; registra versión/hash en el ledger privado
`rcfito_meta.migrations`. Una migración aplicada con igual hash se omite. Un hash
distinto, versión desconocida o tablas sin registro gestionado detienen la
operación; no hay opción de forzar adopción. El helper exige el contenedor
`rcfito-db` y el grupo `rcfito-supabase` antes de ejecutar SQL. No instala SQL en
el arranque de Docker ni toca los stacks de QA.

Verificado en la instalación local: `migrate` aplicó una migración y el
`--check` posterior registró una aplicada y cero pendientes.

## Primera cuenta y altas posteriores

Después de aplicar migraciones, iniciar el asistente privado:

```sh
node scripts/backend-admin.mjs --email CORREO_AUTORIZADO
```

Sustituir `CORREO_AUTORIZADO` por la cuenta indicada por el Propietario. Abrir
`http://127.0.0.1:5181` en este equipo y elegir/confirmar allí una contraseña de
12 a 256 caracteres. No pasar la contraseña por comandos, chat ni archivos. El
asistente usa la API administrativa local, habilita el perfil administrador y
rechaza nuevas altas si ya existe uno activo. Es temporal (30 minutos), solo
atiende loopback y bloquea nuevas capturas después de completar el alta; cerrar
el proceso al terminar. En esta instalación el Propietario completó el alta y
confirmó el acceso; se verificó la sesión real y el asistente quedó detenido.
La contraseña fue elegida por el usuario y no se capturó en chat ni Git.

El alta pública queda deshabilitada. Las altas posteriores usan
`admin-create-user` con el JWT del administrador activo; la función verifica
Auth y perfil antes de usar la clave de servicio. El cuerpo es:

```json
{
  "email": "persona@ejemplo.invalid",
  "password": "contraseña-elegida-por-la-administración",
  "display_name": "Nombre",
  "role": "viewer",
  "agricultural_unit_ids": []
}
```

La contraseña de ejemplo no se utiliza para crear ninguna cuenta. La función
confirma el correo en este flujo de alta administrada, asigna rol/agrícolas por
RPC y elimina la cuenta recién creada si falla la asignación. Si también falla
la eliminación compensatoria, informa guardado parcial para revisión; nunca
presenta esa situación como alta exitosa. `ALLOWED_ORIGINS` declara las URLs de
frontend permitidas; cada petición además requiere un JWT válido y perfil admin.

## Pruebas reproducibles

```sh
node scripts/backend-test.mjs
node scripts/backend-integration.mjs
```

El primer comando usa un contenedor efímero `rcfito-backend-test`, sin puertos y
con fixtures ficticios, y lo elimina al terminar. Comprueba migración,
restricciones, atomicidad y RLS con stubs mínimos de Auth; no acredita Auth/REST.

El segundo prepara `.artifacts/supabase-integration` con configuración propia y
un `.env` vacío: nunca lee ni copia el `.env` de la raíz. Inicia el proyecto CLI
`rcfito-local-test` en API `55441`, BD `55442` y puertos auxiliares `5544x`.
Usa cuentas ficticias y verifica Auth, REST, RLS y la función privada. Las claves
se mantienen en memoria. Es un stack exclusivo para desarrollo/QA, sin acceso
exterior. Agregar `--cleanup` detiene ese proyecto y retira sus datos de prueba.
Agregar `--fresh` recrea únicamente ese proyecto de QA antes de probar una
revisión nueva de las migraciones; no reescribe migraciones de una base de operación.

Verificación del 2026-10-31: 48 comprobaciones SQL aprobadas y 12 comprobaciones
de integración con Auth, REST y Edge Functions reales aprobadas. La integración
se repitió con la migración final y `--fresh --cleanup`; el proyecto de QA quedó
detenido y sus datos ficticios retirados. Los contenedores de otros proyectos
se conservaron. Esa evidencia corresponde al stack aislado. Posteriormente se
iniciaron los siete servicios de operación local y el frontend Docker, se aplicó
la migración y se abrió el acceso real. Auth salud devuelve 200, el registro
público está desactivado, REST anónimo devuelve 401 y las rutas ajenas al proxy
permitido devuelven 404. El cierre local incluye cuenta administradora, login,
captura y conservación tras recargar, confirmados en PostgreSQL sin cargar
fixtures. Detalle: [TESTING](TESTING.md#inicio-real-local-verificado).

## Migración a otro servidor

Conservar el bundle, la adaptación Compose, las funciones y las versiones
fijadas. Pausar escrituras, tomar un respaldo consistente de PostgreSQL y
respaldar `.env`, las claves de cifrado y los demás datos persistentes. Restaurar
inicialmente en las mismas versiones; ajustar URLs, DNS/HTTPS y orígenes cuando
corresponda, y probar login, asignaciones e historial antes de reabrir captura.
Exportar imágenes de contenedores no incluye sus volúmenes.

## Fuentes

- [Supabase autohospedado](https://supabase.com/docs/guides/self-hosting).
- [Configuración oficial versionada](https://github.com/supabase/supabase/tree/self-hosted/v0.8.3/docker).
- [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).


## Correcciones de malla — RCF-038

La migración aditiva 20261104180000_lot_correction_history.sql requiere instalarse
antes del frontend que consulta lot_corrections. El gestor backend-local mantiene
checksums y ejecuta la ampliación junto con su registro en una transacción. La
migración compara las once tablas de negocio antes/después y revierte si cambian
sus valores originales. No incluye correcciones ni fixtures de operación.

Instalada el 2026-11-04 tras respaldo privado validado: once migraciones aplicadas,
cero pendientes y auditoría vacía. [Entrega y respaldo](OPERATIONS.md#correcciones-de-malla--rcf-038).
