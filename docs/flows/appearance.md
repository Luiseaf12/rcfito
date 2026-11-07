# Apariencia por usuario — RCF-034

Fecha: 2026-11-07. El Propietario confirmó Sistema, Claro y Oscuro, con elección
guardada por usuario. Sistema es el valor inicial cuando no existe preferencia.

## Recorrido y alcance

1. Iniciar sesión y abrir Apariencia desde el botón de la barra superior.
2. Elegir Sistema, Claro u Oscuro. Administradores y lectores administran su
   propia elección, incluso si no tienen acceso al menú Conexión.
3. Confirmado el guardado, aplicar el tema sin desmontar la ruta ni los
   formularios abiertos. La siguiente sesión/dispositivo recupera la elección
   de la misma cuenta desde Supabase.

Sistema sigue `prefers-color-scheme`, incluidos cambios del equipo mientras la
página está abierta. Se almacena literalmente `system`, de modo que cada equipo
resuelve su apariencia local. Claro y Oscuro prevalecen sobre el sistema.
Al cerrar sesión o cambiar de identidad se vuelve inicialmente a Sistema y se
consulta la preferencia de la nueva cuenta; no se reutiliza la de otra persona.
La consulta se revalida al recuperar el foco, sin sustituir formularios.

## Persistencia y fallos

`user_preferences` guarda un registro por perfil con `theme` validado. RLS exige
cuenta activa y `user_id=auth.uid()` tanto para leer como para escribir. Ni el
administrador puede editar la apariencia ajena. El cliente comparte la sesión
existente; no añade clientes Auth. La demo guarda ejemplos por perfil demo en
el navegador y no simula persistencia del servidor.

La elección se aplica después de confirmar persistencia. Un error de guardado
conserva la opción previa y permite volver a intentarlo. Un error de lectura
muestra el aviso y Reintentar; no escribe Sistema sobre una preferencia que no
se pudo consultar. Respuestas obsoletas se descartan al cambiar usuario o guardar.

## Evidencia y límites

- 402 pruebas de aplicación aprobadas, incluidas tres del contrato de apariencia;
  tipos y build aprobados.
- PostgreSQL efímero: regresión completa aprobada y once comprobaciones nuevas
  de preferencias, aislamiento, temas inválidos, usuarios inactivos y anónimo.
- Auth/REST reales aislados: once comprobaciones nuevas aprobadas; relectura de
  preferencias e independencia entre administrador y lector. Advisors sin
  WARN/ERROR. Los entornos ficticios se retiraron al finalizar.
- Contraste: 20 pares claros y 18 oscuros aprobados, incluyendo texto, ayuda,
  errores, campos, acción y foco. No equivale a inspección de estilos renderizados.
- Revisión visual y recorrido UI pendientes: Computer Use informó que el uso de
  navegador local está deshabilitado en Work. No se generaron capturas ni se
  atribuyen pruebas de navegador a estos resultados. Autorrevisión de código.
- Operación: respaldo custom privado validado (640314 bytes) y migración aditiva
  aplicada; quince migraciones y cero pendientes. Sin fixtures en operación.

Publicación y siguientes verificaciones se registran en OPERATIONS y PLANS.
