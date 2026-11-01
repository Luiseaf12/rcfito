# Conexión automática del Quick Tunnel

El Propietario solicitó el 2026-10-31 que Sites actualice su conexión cuando
cambie la dirección del túnel al reiniciar esta PC. Se conserva el Quick Tunnel
gratuito y la audiencia que tenga configurada el Site.

## Funcionamiento

El navegador usa siempre `/supabase` en el mismo origen de Sites. El Worker de
Sites consulta el destino vigente y reenvía únicamente Auth, REST y funciones.
Los datos de negocio permanecen en Supabase de esta PC. R2 conserva solo la URL
y la vigencia del registro, sin sesiones, datos de negocio ni credenciales.

La tarea Windows `RCFito-Tunnel-Publisher` arranca al iniciar sesión, inicia Docker
Desktop mediante su CLI y espera al motor y al conector. Cada 30 segundos consulta
el arranque actual del contenedor y renueva el registro por HTTPS. El Worker fija
su vigencia en 120 segundos. Al caducar responde 503; la aplicación conserva su
modo real y no cambia a datos demo. Las consultas Docker tienen un plazo máximo
para que un motor todavía no disponible no bloquee permanentemente el monitor.

La tarea funciona en la sesión interactiva del usuario, igual que Docker Desktop.
Una PC detenida o sin sesión/Docker no permite consultar los datos. Esto no añade
garantías de disponibilidad a Quick Tunnel ni lo convierte en un endpoint estable
de operación continua.

## Credenciales y permisos

El actualizador usa el acceso de servicio existente de este Site y un secreto
adicional exclusivo de `POST /api/tunnel`. El secreto del servidor se configura
con la herramienta nativa de variables de Sites como
`RCFITO_TUNNEL_UPDATE_SECRET`; nunca se introduce en el frontend ni el manifiesto.
La configuración local se recibe por stdin oculto con
`node scripts/tunnel-publisher.mjs configure` y queda en
`.artifacts/quick-tunnel/private/publisher.json`, fuera de Git, con ACL restringida
al usuario y SYSTEM. No pasar credenciales por argumentos, chat ni logs.

El token de Sites se envía exclusivamente al Site como acceso de servicio; no
se entrega a Cloudflare Tunnel, Supabase, R2 ni al navegador. La petición de
registro solo contiene la URL. El Worker exige el secreto de actualización,
limita el cuerpo y valida host HTTPS `trycloudflare.com`, sin credenciales,
puerto, ruta, consulta o fragmento. Comprueba la salud del destino con clave
pública antes de aceptarlo y no sigue redirecciones. El proxy nunca reenvía
cookies o cabeceras de identidad de Sites; conserva JWT/apikey y cabeceras REST.

Auth/RLS de Supabase siguen autorizando los datos; publicar la dirección no
concede permisos de cuenta. Antes de este despliegue Sites ya figuraba público
(revisión de acceso 2); esta entrega conservó esa audiencia. El secreto adicional
protege la escritura del registro incluso con el frontend público.

## Comandos

Después de configurar los dos lados y publicar el Worker:

```powershell
powershell.exe -NoProfile -File scripts/tunnel-publisher-task.ps1 install
powershell.exe -NoProfile -File scripts/tunnel-publisher-task.ps1 status
node scripts/tunnel-publisher.mjs once
node scripts/site-connection-check.mjs
```

`install` registra la tarea del usuario y la inicia; evita instancias simultáneas
y configura tres reintentos si el proceso termina inesperadamente. `once` sirve
para comprobar o forzar una renovación; la tarea no requiere ejecutarlo después
de cada reinicio. La bitácora local acotada solo registra cambios de conexión o
espera, sin tokens ni cuerpos de respuesta.

Para detener el monitor actual, conservando Supabase:

```powershell
powershell.exe -NoProfile -File scripts/tunnel-publisher-task.ps1 stop
```

La tarea seguirá instalada y volverá a arrancar en el siguiente inicio de sesión.
Si se revoca o rota una de sus credenciales, requiere reconfiguración privada.
El helper rechaza sobrescribir silenciosamente credenciales diferentes.

## Navegadores existentes

La configuración inicial indica `managed: true`. Una conexión guardada con la
misma clave pública migra a la ruta estable y la sesión pasa a un almacenamiento
estable por backend. Se retira la copia anterior después de copiarla y no se
sobrescribe una sesión gestionada existente. Demo elegida o un servidor manual
con otra clave se conservan. Si no existe una conexión anterior identificable,
puede requerirse iniciar sesión una vez después de actualizar el frontend.

## Publicación y recuperación

`npm run build` compila el frontend y lo incorpora al Worker ESM, junto con el
manifiesto y su binding R2 `BUCKET`. `npm run build:frontend` conserva la salida
estática que necesita Docker local. Vite mantiene `envDir: false`.
El actualizador modifica el registro; no hace commits ni republica Sites cada
vez que cambia el túnel.

Conservar el acceso de servicio, el secreto de actualización y la configuración
privada al trasladar la operación. Reinstalar la tarea desde la nueva ruta de
código. El Site y el publicador deben referirse al mismo backend y al mismo Site.
La conexión local Docker continúa con `/supabase` de su propio Nginx.

Evidencia y límites en [TESTING](TESTING.md#actualización-automática-del-túnel).

## Cierre verificado

La tarea está instalada y en ejecución. Sites confirmó el despliegue
`appgdep_6ae69a6613b48191980d75618f20e62e`, versión
`appgprj_6ae67ae019e88191a7012093bb19c505~appgver_4d4204125a3c819198c24cc227cd4415`,
desde `8a4f4340140e568e73b0fcbac7c949baae07b56c`, con el secreto runtime aplicado y
R2 operativo. Se reinició únicamente `rcfito-quick-tunnel`: cambió la URL, el
monitor renovó el registro y las nueve comprobaciones HTTPS del Site volvieron a
aprobar sin volver a publicar el frontend. La prueba completa de reinicio de
Windows no se ejecutó; se verificó el trigger de inicio de sesión y la ejecución
real de la tarea. La revisión y el build se aislaron de otro trabajo concurrente.
