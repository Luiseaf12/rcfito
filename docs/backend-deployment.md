# Supabase: operación y pruebas

## Estado

La migración y la función de altas están implementadas. La instalación de
operación y su endpoint HTTPS exterior se preparan por separado del frontend
publicado en Sites. Un sitio alojado no convierte `localhost` de este equipo en
un servidor accesible desde otros dispositivos.

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

Para generar una configuración nueva, con las URLs HTTPS reales:

```sh
node scripts/backend-prepare.mjs --api-url https://api.ejemplo.invalid --site-url https://sitio.ejemplo.invalid
```

Las URLs anteriores son ejemplos, no destinos configurados. El helper copia el
bundle a `.artifacts/production-supabase`, genera secretos con las utilidades
oficiales y conserva `.env` fuera de Git. Nunca imprime claves. Rechaza una
configuración privada existente para evitar rotar secretos accidentalmente.
En Windows necesita Bash de Git y OpenSSL; Linux necesita Bash, OpenSSL y Node.

Desde esa carpeta se administra el grupo con archivos explícitos:

```sh
docker compose -f docker-compose.yml -f compose.rcfito.yaml config --quiet
docker compose -f docker-compose.yml -f compose.rcfito.yaml up -d
```

La puerta API se enlaza a `127.0.0.1:55451`; PostgreSQL no publica puerto.
Configurar el proxy HTTPS hacia la puerta API o la red `rcfito-backend`, con
acceso administrativo de Studio restringido. Configurar SMTP para recuperación
de cuentas antes de habilitar esa función. La aplicación usa únicamente la clave
publicable, nunca la clave de servicio.

Después de que Auth inicialice su esquema, aplicar una sola vez cada migración
pendiente de `supabase/migrations` con un cliente PostgreSQL administrativo
contra esta instalación, respetando su orden. La migración contiene una
transacción; no se instala en el arranque para evitar ejecutar SQL antes de que
exista `auth.users`. Conservar un registro de las migraciones aplicadas.

## Primera cuenta y altas posteriores

Crear la primera cuenta mediante la API administrativa de Auth desde un entorno
privado; después habilitar su perfil con SQL administrativo:

```sql
update public.profiles set role = 'admin'
where id = '<uuid-de-la-cuenta-creada-en-auth>';
```

El UUID es un marcador que debe sustituirse, no un usuario ficticio a crear en
producción. El alta pública queda deshabilitada. Las altas posteriores usan
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
se conservaron. La composición de operación pasó `docker compose config --quiet`
con configuración ficticia; no se inició ni se acredita un despliegue de operación.

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
