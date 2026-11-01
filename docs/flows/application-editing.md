# Edición de aplicaciones e historial de cambios

Autorización del Propietario: implementar la propuesta de edición, productos,
dosis, fechas e historial; commit, push y publicación en Sites. Amplía la regla
previa de indicación inmutable con revisiones registradas. Estado: implementada y verificada; publicación en curso.

## Usuario, entrada y recorrido

El administrador abre una aplicación y usa **Editar indicación**. El formulario
precarga la indicación vigente y muestra los destinos pendientes que recibirán
los cambios. Permite agregar/quitar productos, cambiar producto/dosis, medio,
agua, fechas de indicación/programación y nota. Motivo obligatorio. Folio,
número por etapa, campo/cultivo, destinos y superficie conservan su identidad.

Si parte de la orden está realizada o cancelada, la nueva indicación se asigna
solo a los pendientes. Cada destino conserva la revisión con la que se realizó
o canceló. Registrar realización consulta esa revisión, no la primera mezcla ni
la última de otros destinos. Un formulario de realización viejo no puede aplicar
una revisión que el usuario no vio.

Para un destino realizado se ofrece **Corregir realización**. Precarga productos,
dosis, agua, fecha real, equipo, aplicador y observaciones guardadas; requiere
motivo. Conserva estado, destino y conteos. La fecha no precede a su indicación
o siembra, no supera hoy ni el cierre de etapa cuando ya cerró. No reabre etapas.

Los formularios identifican campos pendientes, conservan entradas ante errores,
bloquean doble envío y protegen el descarte. El guardado confirma persistencia
antes de cerrar o anunciar éxito. Conflictos de versión conservan la captura y
requieren revisar el estado actual; no sobrescribir ni reintentar a ciegas.

## Historial y contrato de datos

Conservar la orden/productos originales y eventos append-only con valores antes
y después, destinos afectados, versión, autor/fecha y motivo. Los snapshots de
productos mantienen nombre, unidad e ingredientes; referencias FK impiden borrar
productos históricos. Un producto/método retenido puede permanecer inactivo;
incorporar uno distinto exige catálogo activo. Las dosis del catálogo no cambian.

El detalle ofrece la indicación vigente y el historial comparado, incluida la
primera indicación. Cada destino muestra su indicación y realización actuales y
sus correcciones. El lector solo consulta historial de agrícolas asignadas.

Aplicar una revisión exige versión esperada de orden y el conjunto exacto de
pendientes; corregir exige versión del destino realizado. UUID estable por
borrador permite reintento idéntico sin duplicar eventos; reutilizar ese UUID
con otra entrada falla. Las RPC validan autoridad y toda la transacción antes
de escribir; lectura bajo RLS y sin DML directo a eventos o snapshots históricos.

## Implementación y aceptación

Separar tipos/coordinación, helpers puros, adaptador RPC y presentación. Reutilizar
RecordDialog, Field, FormInput/FormSelect, Textarea, Checkbox, Alert y tablas de
mezcla existentes. Edición de una indicación mixta, realización de la revisión,
corrección posterior y comparación antes/después son los casos principales.

Verificar dominio, SQL aislado y Auth/REST/RLS reales aislados; conflictos,
reintentos, catálogo histórico, permisos y conteos. QA demo de agregar/quitar
productos, cambiar dosis/fechas y recargar historial; revisión móvil, errores y
lector. No usar fixtures en operación. Antes de migrar operación: respaldo
privado y ledger coherente; migración aditiva, sin resetear ni preparar secretos.

Evidencia: 181 pruebas del cliente, 244 comprobaciones SQL y 71 HTTP aisladas
aprobadas, revisión independiente sin hallazgos pendientes. QA demo mixta:
terminales retienen revisión0, pendiente recibe revisión1 y se realiza con su
mezcla nueva; corrección real conserva antes/después y conteos tras recargar.
Lector consulta historial sin acciones de edición; móvil sin overflow de página.
Respaldo privado validado y migración operativa confirmada (4 aplicadas/0
pendientes), conteos de negocio intactos y sin eventos ficticios. Publicación
y frontend Docker pendientes de confirmar en OPERATIONS.
