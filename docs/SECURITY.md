# Seguridad

## Fronteras implementadas

Supabase Auth autentica cuentas. RLS protege tablas tanto en REST directo como
en RPC. Los perfiles y asignaciones controlados en servidor definen administrador
o lector; los claims editables del usuario no conceden privilegios. Un usuario
desactivado pierde lectura aun conservando un JWT previamente emitido.

El administrador mantiene datos y asignaciones. El lector consulta agrícolas
asignadas, campos y sus proyectos/lotes/subdivisiones/etapas. Los catálogos
comunes permiten consulta a cuentas activas. Se rechazan mutaciones del lector
y acceso anónimo. El menú refleja permisos; la frontera efectiva es el servidor.

[admin-create-user](../supabase/functions/admin-create-user/index.ts) valida JWT
con Auth y exige perfil administrador activo antes de usar la clave privada.
Compensa un fallo de asignación retirando la cuenta recién creada; si también
falla esa compensación informa resultado parcial. El primer administrador sigue
el procedimiento privado de [backend-deployment](backend-deployment.md), nunca
un registro público de administrador.

## Secretos y entornos

La interfaz recibe URL y clave pública publishable/anon. Conexión rechaza claves
secretas/service_role. Configuración pública y sesión se guardan en el navegador;
las credenciales privilegiadas permanecen en servidor. No introducirlas en
variables `VITE_*`, Git, bundles, logs o capturas.

[.gitignore](../.gitignore) excluye `.env`, archivos privados, builds y artefactos;
se conserva [.env.example](../.env.example) con valores vacíos. El `.env`
preexistente del usuario se conserva sin lectura/modificación. Los scripts de
backend usan sus carpetas propias y Compose selecciona entorno explícito.

El modo demo usa fixtures ficticios y localStorage. Su cambio de rol es una
simulación de UX, no autenticación ni aislamiento de datos reales. Un Site
privado controla quién abre el frontend; no sustituye Auth ni RLS.

## Evidencia y pendientes

48 comprobaciones SQL y 12 verificaciones Auth/REST/Edge/RLS aprobaron en entornos
aislados: rechazo de anónimo/lector, asignaciones y JWT de perfil desactivado.
El stack de QA quedó detenido y sus datos ficticios retirados; otros stacks no
se modificaron. Comandos y alcance: [TESTING](TESTING.md).

La instalación de operación, HTTPS exterior, secretos, primera cuenta y orígenes
permitidos de la URL publicada están pendientes. El navegador demo y los tests
HTTP se verificaron por separado; no se declara un recorrido de navegador contra
la instalación de operación.
