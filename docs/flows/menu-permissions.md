# Permisos de menú por usuario — RCF-044

Solicitud del Propietario, 2026-11-05: implementar la propuesta de permisos de
menú y, tras verificarlos, hacer commit, push y publicación. No hay dudas de alcance.
Estado: implementado y publicado en Sites 44; Docker actualizado.
Contrato de negocio: [PRODUCT](../PRODUCT.md#permisos-de-menú-por-usuario).
El agente principal asume diseño, implementación, pruebas y autorrevisión; no
se atribuye revisión independiente.

## Recorrido y reglas

En Usuarios y accesos → Editar acceso se eligen las secciones de cada cuenta de
consulta. Los once catálogos tienen casillas individuales. Una cuenta sin menús
puede iniciar/cerrar sesión y solicitar una revisión de sus accesos. Se ofrecen
Consulta de campo, Consulta de reportes, Consulta completa y Sin secciones.
Copiar permisos toma solo los menús de consulta: no copia rol ni agrícolas.
La plantilla Administración corresponde al rol Administrador y habilita todo.
Captura con IA, Usuarios y accesos y Conexión/configuración requieren ese rol.
La consulta con IA conserva su propio permiso Consultas.

Las agrícolas asignadas y el rol siguen delimitando datos y operaciones. Ver
una página no concede escritura. Los administradores conservan todas las
secciones y la RPC mantiene al menos un administrador activo, también frente a
cambios simultáneos. Los cambios de rol/asignaciones/menús pasan por una única
RPC transaccional con versión esperada; un conflicto conserva el formulario y
exige actualizar. El historial muestra autor/fecha, menús agregados/retirados,
rol y agrícolas anteriores/nuevas. Solo administración consulta esa auditoría.

Las cuentas existentes conservan sus secciones operativas y catálogos de
consulta. Las cuentas nuevas parten sin menús en servidor hasta completar el
alta/asignación; el formulario propone Consulta de reportes. Las llamadas del
cliente anterior al alta conservan su selección de consulta completa. El acceso
de configuración después del login queda reservado a administración; antes del
login se conserva el diagnóstico público de conexión necesario para entrar.

## Navegación y composición

Fuente única: [menu-permissions.ts](../../src/domain/menu-permissions.ts), con
clave, etiqueta, URL, grupo y restricción de rol. La consumen menú, encabezado,
guarda de rutas, editor, plantillas y copia. [App](../../src/App.tsx) conserva
Sidebar/Provider/Group/Menu/Button, Collapsible/Trigger/Content, Button y Link
reales. La sección Catálogos usa estado local y apertura al entrar en sus rutas;
se retiran todos los grupos vacíos. Se conservan tokens, iconos y acabados del
tema actual, sin nueva paleta. El panel móvil y los portales/foco pertenecen a
las primitivas existentes; no se añade otro Sheet ni un manejador de Escape.

| Grupo | Claves y destinos | Ruta y aliases | Política |
| --- | --- | --- | --- |
| Espacio de trabajo | summary, projects, applications, queries, groups | `/`, `/proyectos` y detalle, `/aplicaciones` y detalle/alta/nueva-receta, `/consultas`, `/grupos-siembra` | Menú autorizado; creación/edición mantienen además el rol previo. |
| Espacio de trabajo | ai_capture | `/captura-ia` | Administrador. |
| Catálogos | `catalog:<kind>` para cada uno de los once catálogos | `/catalogos/:kind` | Permiso específico; Ver/Editar según rol actual. |
| Administración | users, connection | `/usuarios`, `/conexion` | Administrador; conexión básica previa a login conservada. |

Una ruta restringida muestra No tienes acceso y permite ir a la primera sección
habilitada; el inicio `/` redirige allí cuando Resumen no está permitido. Cero
secciones muestra su estado específico. Las rutas desconocidas conservan la
página de no encontrada. La marca enlaza el inicio autorizado. Los enlaces y
estados activos cubren detalles/aliases sin duplicar mapas. Las consultas de
fondo y la renovación de sesión conservan los formularios montados; al volver
el foco se refrescan permisos sin activar el loader de navegación.

El editor reutiliza RecordDialog/useFormClose, FieldSet/Legend/Description,
Checkbox, FormSelect, Alert y Button. Cambios sin guardar requieren descarte;
guardado bloquea doble envío y el error mantiene los valores. El historial usa
la misma fuente de nombres de menú. La demo conserva datos anteriores sin
reemplazar el navegador y permite volver a administración simulada mediante un
control explícito identificado como demo.

## Servidor, referencias y compatibilidad

Migración aditiva `20261105203609_user_menu_permissions.sql`: columnas de menús
y versión en profiles, auditoría con RLS e índices, RPC de edición y referencias.
No confía en claims editables ni en permisos enviados por el navegador. Las
políticas SELECT restrictivas se combinan con las RLS agrícolas existentes.
Se retira escritura directa de perfiles/asignaciones al cliente, incluido admin:
la RPC comprueba autoridad antes y después de serializar cambios y los audita.

Resumen, Aplicaciones y Consultas comparten datos de aplicaciones; Proyectos y
Grupos utilizan referencias de sus siembras. El permiso autoriza esos datos
compartidos dentro del ámbito agrícola, sin abrir las otras pantallas. Una
cuenta con solo un catálogo no recibe los datos operativos. Ocultar un catálogo
bloquea su lectura completa por REST; `menu_reference_catalogs` entrega solo los
IDs/nombres/estado y relaciones mínimas que requieren los filtros autorizados.
Los productos de referencia son los utilizados, sin dosis predeterminadas ni
columnas de mantenimiento. No se entregan referencias agrícolas ajenas.

Las RPC de Consultas requieren su menú explícito. Mantienen las implementaciones
invoker y RLS; una envoltura habilita solo durante esa llamada las búsquedas de
nombres de catálogos. Restaura el contexto antes de devolver y no abre lecturas
REST posteriores. Los originales se conservan en el esquema privado, fuera de
la API. Worker comprueba el permiso de Consultas antes de cargar configuración,
interpretar texto o transcribir audio. La revocación sirve con JWT ya emitido;
los cambios invalidan la revisión de consultas mediante los triggers existentes.
Una cuenta desactivada no conserva menú, datos ni referencias.

El alta de usuarios envía los menús a la RPC dentro del proceso administrado;
si falla la asignación, conserva la compensación de eliminación de la cuenta.
No se guardan contraseñas/tokens en auditoría ni se crean claves nuevas. La
migración se aplica con respaldo antes del frontend y se actualiza únicamente
la función privada de alta, conservando su entorno, secretos y volúmenes.

## Verificación

2026-11-05: 391 pruebas cliente, 516 comprobaciones SQL de aplicaciones/
catálogos/menús y 124 de consultas/contexto aprobadas. Incluyen actualización
sobre cuentas anteriores sin cambiar roles, órdenes o destinos; cuenta nueva
sin permisos, conflicto, auditoría, rol, agrícolas, catálogos y referencias,
revocación con sesión anterior y último administrador. Se ajustaron los fixtures
para asignar sus permisos expresamente y usar la RPC auditada.

268 controles Auth/REST/Edge/RLS aprobados, incluidos alta con selección exacta,
revocación/reconcesión con el mismo JWT, acceso directo, historial, rechazo de
PATCH de perfil y chat/CLI/audio sin consumo de proveedor. Advisors de seguridad
del entorno aislado sin WARN/ERROR. El stack ficticio quedó detenido y limpio.
Tipos y build aprobados; advertencia previa del chunk principal conservada.

QA en navegador con datos ficticios: seleccionar dos menús, guardar/recargar,
detalle e historial con diferencias, copiar desde admin sin elevar rol, plantilla
de reportes, bloqueo de último administrador y descarte. Lector: solo dos
enlaces, grupos vacíos ocultos, URL directa rechazada, inicio autorizado y cero
secciones. Formulario móvil a 375 px sin overflow (diálogo 343.2 px), viewport
restaurado. Evidencia privada ficticia en `.artifacts/menu-permissions/`.
La seguridad/persistencia real se acredita con HTTP; la demo solo acredita UX.

Operación: respaldo custom privado validado (600,378 bytes), migración aplicada
y registro SHA-256 con trece aplicadas/cero pendientes. Huellas antes/después
de negocio, roles y asignaciones idénticas; administrador conserva el control.
Actualizado solo el código de alta y reiniciado su servicio, con entorno,
secretos y volúmenes conservados. Sin fixtures ni cambios manuales de permisos
de cuentas reales.

Cierre: fuente `1ffb49b0b26fee32c1852a35d6c6fb8ac5148ad8` en GitHub,
Docker healthy y Sites 44 con resultado nativo succeeded. Se integró la entrega
concurrente de fechas reales, con 391 pruebas y build/checker aprobados sobre la
misma revisión. Entrada y 38 recursos exactos por destino, seis controles de
conexión/permisos por destino (90 en total) y 20 controles HTTPS aprobados.
Se conserva audiencia pública, R2 y entorno revisión 1. No hubo cambios de
permisos manuales ni fixtures en operación. [Publicación](../OPERATIONS.md#permisos-de-menú-por-usuario--rcf-044).
