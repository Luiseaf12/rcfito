# Eliminación excepcional de una captura errónea

Solicitud y aclaración del Propietario, 2026-11-02: eliminar completamente la
captura equivocada y liberar tanto su folio como sus números de aplicación por
etapa para volver a registrar desde IA. Estado: corrección puntual aplicada y
verificada. No crea un botón de borrado ni habilita eliminaciones por REST/RPC.

## Alcance confirmado

La revisión privada encontró una última orden con cuatro destinos pendientes,
sin realizaciones, cancelaciones, revisiones ni recetas que dependieran de ella.
Sus destinos ocupaban el último número consecutivo de cada etapa. Se retiró
únicamente esa orden, sus cinco líneas de producto y sus cuatro destinos.
Los identificadores y datos reales quedan en el plan/respaldo privados, fuera de Git.

La excepción no modifica la regla ordinaria de conservación del historial ni
autoriza borrar otras órdenes. El mantenimiento exige confirmación expresa del
Propietario para el caso, acceso de operador local y un plan congelado válido.
Se rechazan órdenes anteriores, destinos terminales, revisiones, dependencias,
saltos que impidan proponer el mismo número y cambios desde la revisión del plan.

## Procedimiento privado

[remove-erroneous-application.mjs](../../scripts/remove-erroneous-application.mjs)
solo accede a `rcfito-db` tras verificar su proyecto Compose `rcfito-supabase`.
`prepare`, `dry-run` y `apply` reciben el folio exacto y `--owner-confirmed`.
La marca registra una autorización ya obtenida; no concede autorización por sí sola.
El plan y sus resultados se guardan dentro de
`.artifacts/production-supabase/maintenance/remove-erroneous-application/`.

Antes de aplicar exige simulación aprobada del mismo SHA-256 y genera un respaldo
custom completo, validado con `pg_restore --list`, sin sobrescribir anteriores.
La transacción bloquea las tablas afectadas, vuelve a comparar el plan, retira
solo las filas revisadas y restaura las tres guardas que suspende durante ese
intervalo aislado. RLS, FK, permisos, funciones, otras guardas y grupos permanecen.
`ALTER SEQUENCE RESTART` vuelve a ofrecer el folio retirado y se revierte junto
con el borrado si algo falla. No se usa `setval`, no se renumeran otras órdenes
ni se repite preparación/reset del backend. Un segundo intento no borra una
eventual recaptura que haya reutilizado el folio con otra identidad.

Una auditoría privada mínima registra autoridad, hash del plan y conteos del
mantenimiento. La orden errónea deja de existir en las tablas de negocio.
La comparación por conteos/huellas conserva el resto de órdenes, productos,
destinos, eventos históricos, proyectos, lotes, siembras, grupos e integrantes.

## Resultado y verificación

2026-11-02: quince comprobaciones PostgreSQL en contenedor efímero, sin puertos,
con fixtures ficticios aprobadas mediante
`node scripts/backend-application-removal-test.mjs`. Cubren límites, plan alterado/
desactualizado, realizaciones/dependencias, rollback de datos y secuencia ante un
fallo posterior, restauración de guardas, permisos y recaptura grupal por la RPC
existente con igual folio y número, mensaje fuente y receta anterior.
El contenedor se retiró; no se usaron datos reales en las pruebas.

La simulación operativa aprobó y se revirtió por completo. Después, respaldo
privado validado (537,230 bytes) y aplicación confirmada: una orden, cuatro
destinos y cinco líneas retirados, con todos los demás datos/guardas idénticos.
La consulta posterior confirmó folio disponible sin consumirlo y siguiente número
liberado en las cuatro etapas. Registro de migraciones intacto: diez aplicadas,
cero pendientes. No se creó una aplicación de prueba en operación ni se consumió IA.

Al volver a Captura con IA, actualizar los datos antes de interpretar/guardar
para descartar referencias anteriores a la orden eliminada. El folio disponible
lo toma la siguiente orden guardada; no queda reservado para un usuario.
El número por etapa puede solicitarse explícitamente en la captura de IA.
La entrada y el frontend publicados permanecen iguales. Autorrevisión del agente
principal; no se atribuye revisión independiente. [Registro](../OPERATIONS.md#eliminación-excepcional-de-captura--rcf-037).
