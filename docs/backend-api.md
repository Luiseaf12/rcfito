# Contrato del backend de catálogos y siembras

Implementación para Supabase/PostgREST. Las tablas y RPC usan `snake_case`.
Los UUID se entregan como cadenas y las fechas civiles como `YYYY-MM-DD`.
Los `numeric` pueden recibirse como número o cadena; el consumidor normaliza
solo para operar, sin perder precisión en persistencia.

## Tablas

- Catálogos `agricultural_units`, `crops`, `brands`, `product_families`,
  `active_ingredients`, `infrastructure_types`, `application_methods`:
  `id`, `code`, `name`, `active`, `created_at`.
- `fields`: campos anteriores y `agricultural_unit_id`.
- `varieties`: campos de catálogo y `crop_id`.
- `products`: campos de catálogo, `unit` (`g`/`ml`), `default_dose`,
  `brand_id`, `product_family_id` opcionales.
- `product_ingredients`: `product_id`, `active_ingredient_id`, `concentration`
  opcional de texto con su unidad; clave compuesta producto/ingrediente.
- `profiles`: `id` de Auth, `display_name`, `role` (`admin`/`viewer`), `active`,
  `created_at`. Un alta de Auth genera perfil lector, nunca administrador.
- `user_agricultural_units`: `user_id`, `agricultural_unit_id`.
- `sowing_projects`: `id`, `agricultural_unit_id`, `name`, `season`, `status`
  (`draft`/`active`/`closed`), `start_date`, `observations`,
  `agricultural_unit_name`, `created_at`, `closed_at`.
- `project_lots`: `id`, `project_id`, `field_id`, `code`, `name`, `area_ha`,
  `infrastructure_type_id`, `active`, `field_name`, `agricultural_unit_name`,
  `infrastructure_type_name`, `created_at`. Los nombres son snapshots históricos.
- `lot_subdivisions`: `id`, `lot_id`, `code`, `name`, `area_ha`, `active`,
  `created_at`, `retired_at`. Una redistribución retira las anteriores sin borrarlas.
- `sowing_stages`: `id`, `subdivision_id`, `stage_number`, `crop_id`, `variety_id`,
  `area_ha`, `planned_sowing_date`, `actual_sowing_date`, `end_date`, `status`
  (`planned`/`planted`/`closed`), `observations`, `crop_name`, `variety_name`,
  `created_at`. Los nombres de cultivo/variedad son snapshots históricos.

## RPC

Todos requieren sesión de administrador. Son transaccionales y devuelven error
sin persistir un guardado parcial. La respuesta UUID es escalar.

| Función | Parámetros | Resultado |
| --- | --- | --- |
| `create_sowing_project` | `p_data`: agrícola, nombre, temporada, fecha opcional (por defecto hoy) y observaciones | UUID del proyecto en borrador. |
| `copy_sowing_project` | `p_source_project_id`, `p_data` con nombre/temporada/fecha | UUID de un proyecto nuevo de la misma agrícola; copia lotes y subdivisiones vigentes, sin etapas. |
| `create_project_lot` | `p_data`: `project_id`, `field_id`, `code`, `name`, `area_ha`, `infrastructure_type_id` | UUID del lote, con subdivisión única de toda la superficie. |
| `delete_project_lot` | `p_lot_id` | Sin valor. Elimina lote y subdivisiones solo si no hay ninguna etapa; nunca elimina historial de siembra. |
| `replace_lot_subdivisions` | `p_lot_id`, `p_subdivisions`: lista `{code,name,area_ha}` | Sin valor. Retira las anteriores y crea una configuración nueva; exige etapas previas cerradas. |
| `save_sowing_stage` | `p_data`: campos de etapa, `id` opcional generado por el cliente para alta/reintento o para editar planeación | UUID. Nueva etapa planeada con siguiente número; repetir el mismo UUID no crea otra etapa. |
| `transition_sowing_stage` | `p_stage_id`, `p_status` (`planted`/`closed`), `p_date` | Sin valor. Planta o cierra una etapa con validación de secuencia y fechas. |
| `discard_planned_stage` | `p_stage_id` | Sin valor. Retira solo la última etapa planeada; nunca elimina una siembra realizada. |
| `close_sowing_project` | `p_project_id` | Sin valor. Exige todas las etapas cerradas; congela su contenido. |
| `save_product` | `p_data`: producto con `id` opcional; `p_ingredients`: lista `{active_ingredient_id,concentration}` | UUID. Guarda producto y composición juntos. |
| `set_user_access` | `p_user_id`, `p_role`, `p_active`, `p_agricultural_unit_ids`: UUID[] | Sin valor. Cambia rol/estado y reemplaza agrícolas asignadas. |

Los catálogos simples se mantienen con operaciones de tabla protegidas por RLS.
La modificación del nombre de un catálogo no cambia los snapshots de una siembra
ya registrada. Los registros referenciados usan FK restrictivas y baja lógica.

Para activar un proyecto en borrador, actualizar únicamente `status: 'active'`
en `sowing_projects`. El servidor valida que no haya otro proyecto abierto de la
misma agrícola. Se conserva a lo sumo un proyecto abierto (`draft`/`active`).

## Acceso

- `anon`: sin lectura ni escritura de tablas de producto.
- Administrador activo: mantenimiento y RPC.
- Lector activo: catálogos comunes y solo agrícolas asignadas y sus registros.
- Un usuario desactivado no conserva acceso por tener un JWT todavía válido.
- Un lector no cambia su perfil, rol ni asignaciones.
- El primer administrador se habilita una sola vez con una operación SQL
  administrativa, después de crear su cuenta Auth; no existe registro público de
  administradores ni una RPC de autoasignación.

Las altas posteriores se solicitan mediante `POST /functions/v1/admin-create-user`
con JWT de administrador y cuerpo `{email,password,display_name,role,
agricultural_unit_ids}`. Devuelve HTTP 201 con `{id,email,display_name,role}`.
El servidor valida el JWT con Auth y consulta el perfil activo antes de utilizar
la clave privada de servicio. Un lector recibe 403. La función confirma el correo
en este flujo de alta administrada y elimina la cuenta si falla la asignación.
Los errores de compensación indican `partial_user_id` y requieren revisión.

## Límites

Esta entrega no crea órdenes de aplicación ni sus conteos. La regla de cancelar
órdenes pendientes antes de cerrar una etapa se incorporará cuando exista ese
módulo; no se informa un conteo supuesto. El navegador de Sites necesita un
endpoint HTTPS de Supabase accesible desde el dispositivo del visitante: publicar
el frontend no vuelve accesible una base privada de este equipo.

## Aplicaciones y grupos de siembra

La migración aditiva `20261101013723_applications_and_groups.sql` incorpora el
módulo de aplicaciones; una instalación anterior requiere aplicarla antes de
utilizar estas rutas. Este contrato amplía el límite de la primera entrega
descrito arriba. No incorpora el reporte completo ni indicadores financieros.

Las seis tablas nuevas permiten `SELECT` a sesiones activas mediante RLS. Solo
las RPC escriben; incluso el administrador no recibe permisos directos de
inserción, modificación o borrado. Los lectores consultan exclusivamente las
agrícolas asignadas, incluidos productos/destinos reales y grupos asociados.
No hay acceso anónimo. Las RPC públicas son `SECURITY INVOKER`; delegan a
mutadores del esquema privado que comprueban sesión y administrador activo.

| Tabla | Contenido |
| --- | --- |
| `application_orders` | `id` UUID estable del cliente, `folio` global `APL-000001`, `project_id`, `field_id`, `crop_id`, `method_id`, `indicated_date`, `scheduled_date`, `water_l_ha`, `observations`, `project_name`, `field_name`, `crop_name`, `method_name`, `agricultural_unit_name`, `season`, `request_signature`, `created_by`, `created_at`. |
| `application_order_products` | PK `order_id,product_id`; `dose`, `product_name`, `unit` (`g`/`ml`), `ingredients_snapshot` array de `{active_ingredient_id,name,concentration}`. |
| `application_targets` | `id`, `order_id`, `stage_id`, `status` (`indicated`/`performed`/`cancelled`); snapshots `lot_name`, `subdivision_name`, `stage_number`, `crop_name`, `variety_name`, `area_ha`; realización `actual_date`, `actual_water_l_ha`, `equipment`, `applicator`, `actual_observations`, `has_changes`, `execution_signature`; `cancellation_reason`, `cancelled_at`, `created_at`. |
| `application_actual_products` | PK `target_id,product_id`; `dose`, `product_name`, `unit`, `ingredients_snapshot`. Siempre hay copia propia de la mezcla realmente aplicada. |
| `sowing_groups` | `id`, `project_id`, `field_id`, `crop_id`, `name`, `active`; snapshots `project_name`, `field_name`, `crop_name`; `request_signature`, `created_at`. |
| `sowing_group_members` | PK `group_id,stage_id`; `active`, `retired_at`, `created_at`. Las asociaciones retiradas permanecen para historial. |

`application_stage_counts` es una vista con `security_invoker=true`: `stage_id`,
`indicated_count`, `performed_count`, `cancelled_count`. Cuenta un destino una vez,
independientemente de sus productos. Ausencia de fila equivale a cero destinos;
la vista conserva RLS del usuario.

| RPC | Argumentos y resultado |
| --- | --- |
| `create_application_order` | `p_data jsonb`, `p_stage_ids uuid[]`, `p_products jsonb` → UUID de orden. |
| `perform_application_targets` | `p_order_id uuid`, `p_target_ids uuid[]`, `p_data jsonb` → void. |
| `cancel_application_targets` | `p_order_id uuid`, `p_target_ids uuid[]`, `p_reason text` → void. |
| `save_sowing_group` | `p_data jsonb`, `p_stage_ids uuid[]` → UUID de grupo. |

Para indicar, `p_data` contiene `{id,project_id,field_id,crop_id,method_id,
indicated_date,scheduled_date,water_l_ha,observations?}`; `id` es obligatorio y lo
genera el cliente una vez por borrador. `p_products` contiene al menos un
`{product_id,dose}`. Los destinos son etapas sembradas vigentes completas del
mismo proyecto activo, campo y cultivo. Dosis y agua son números positivos;
el servidor no acepta productos repetidos ni destinos repetidos. La indicación
no precede ninguna siembra y la programación no precede la indicación.

Para realizar, `p_data` contiene `{actual_date,equipment?,applicator?,observations?,
changed}`. Con `changed:false`, el servidor ignora cualquier override y copia
exactamente agua y mezcla indicadas. Con `changed:true` exige `water_l_ha` y
`products:[{product_id,dose}]`; conserva el original y guarda la mezcla real de
cada destino. Los productos originalmente indicados pueden conservarse estando
inactivos, con su unidad/nombre originales; los nuevos deben estar activos.
`has_changes` refleja diferencias reales de agua/productos/dosis respecto de la
indicación, aunque el usuario haya marcado cambios y luego deje los mismos
valores. La fecha real no precede indicación/siembra ni supera el día actual en
`America/Mazatlan`; puede preceder la fecha programada.

Una cancelación exige motivo no vacío y conserva la indicación. Los destinos
terminales no cambian a otro resultado. El lote de destinos de una llamada se
valida completo antes de escribir: un conflicto revierte toda la llamada. Una
orden con el mismo UUID y entrada normalizada idéntica retorna la misma orden;
otra entrada con ese UUID se rechaza. Repetir una realización idéntica o una
cancelación con el mismo motivo no duplica filas/conteos, incluso si la etapa
se cerró o el catálogo se desactivó después de la primera confirmación.

Para guardar grupos, `p_data` contiene `{id?,project_id,field_id,crop_id,name,
active?}`; se recomienda UUID estable también para el alta. `p_stage_ids` es
únicamente la selección vigente; requiere al menos una etapa sembrada si el
grupo está activo. Omitir un integrante lo marca inactivo con fecha de retiro,
sin borrar su asociación. Es posible desactivar un grupo sin destinos. Las
etapas cerradas conservan su referencia y nunca se remapean a la siguiente
siembra. El contexto de un grupo existente no se modifica. Un reintento idéntico
no vuelve a validar la elegibilidad ya cambiada por un cierre posterior.
El nombre es único por proyecto y campo al comparar sin acentos ni mayúsculas;
un índice único también protege las escrituras concurrentes.

El servidor impide cerrar etapas o temporadas con destinos indicados. La fecha
de cierre de etapa no puede preceder a su última aplicación realizada. Un
producto usado conserva su unidad y las referencias históricas usan FK
restrictivas. Los snapshots de indicación y realización no se reescriben cuando
se renombran los catálogos. No se calculan totales de agua/productos ni importes.

Verificación reproducible: `node scripts/backend-applications-test.mjs`, con
PostgreSQL efímero `rcfito-applications-test`, sin puertos publicados ni datos
reales. Comprueba migraciones, invariantes, permisos/RLS e idempotencia; Auth es
un stub SQL y no acredita por sí solo el recorrido HTTP/Auth del sistema real.

## Revisiones y correcciones de aplicaciones

La migración aditiva `20261101051210_application_revision_history.sql` conserva
orden y productos originales. Añade `application_orders.revision` (0 inicial),
`application_targets.indication_change_id` (null = original) y
`correction_version` (0 inicial). Un destino terminal conserva su indicación.

`application_changes` guarda `id,order_id,target_id,kind,version,target_ids,
reason,changed_by,changed_by_name,changed_at,before,after`. `kind` distingue
`indication` y `performance`; snapshots JSON conservan productos/unidad/nombres,
dosis, agua, fechas y nota, y para lo real equipo/aplicador/`has_changes`.
`request_signature` es privada: la lectura REST enumera columnas y la excluye.
`application_change_products` referencia productos por evento/fase `before/after`
y conserva snapshots; FK restrictiva y guarda de unidad también cubren este uso.
Ambas tablas son append-only, con SELECT/RLS por agrícola y sin DML de cliente.

| RPC | Entrada |
| --- | --- |
| `revise_application_order(p_data jsonb,p_products jsonb)` → UUID | `p_data:{id,order_id,expected_revision,target_ids,method_id,indicated_date,scheduled_date,water_l_ha,observations,reason}`; productos `[{product_id,dose}]`. |
| `correct_application_target(p_data jsonb,p_products jsonb)` → UUID | `p_data:{id,target_id,expected_version,actual_date,water_l_ha,equipment,applicator,observations,reason}`; mismos productos. |

Administrador activo y motivo no vacío obligatorios. Revisar exige proyecto
activo y exactamente todos sus destinos pendientes; solo ellos reciben la nueva
indicación. Corregir exige destino realizado, mantiene estado/conteos y puede
corregir etapas cerradas sin reabrirlas: fecha entre indicación/siembra y hoy,
sin superar cierre. Productos/método retenidos pueden estar inactivos; incorporar
otro exige catálogo activo. Un producto retirado de lo real no se recupera como
inactivo solo por aparecer en la indicación. Dosis hasta seis decimales, agua
cuatro; textos hasta 4,000 caracteres y fechas civiles ISO válidas.

UUID estable permite repetir entrada idéntica sin nuevos eventos; otra entrada
falla. Bloqueo orden→destinos y versión esperada protegen concurrencia con
realizar/cancelar/editar. `perform_application_targets.p_data.expected_revision`
debe coincidir con la indicación mostrada cuando revision>0; en órdenes originales
se conserva compatibilidad omitiéndola. La copia habitual usa la indicación de
cada destino. Reintentar una realización anterior no deshace una corrección.

El adaptador comprueba coherencia de revisiones/referencias y reintenta una vez
la lectura si cambió entre peticiones REST; no entrega un workspace incoherente.
Los campos reales corregidos se hidratan desde el evento correspondiente.
Flujo y aceptación: [edición](flows/application-editing.md).

## Sinónimos de productos

La migración aditiva `20261101124719_product_synonyms.sql` incorpora `product_synonyms`: `id,product_id,
name,normalized_name,created_by,created_at`. La clave normalizada compacta es
única global; lectura a cuentas activas bajo RLS, sin DML directo del cliente.
El reemplazo conserva auditoría privada con antes/después, autor y fecha.

`save_product(p_data,p_ingredients)` mantiene su firma: `p_data.synonyms` es
lista opcional de strings. Omitir conserva; [] retira; lista explícita sustituye
atómicamente junto con producto e ingredientes. Hasta 20, 2–80 caracteres cada
uno, sin vacíos, duplicados ni equivalentes al nombre/código propio. Comparación
NFD/sin diacríticos/minúsculas/separadores compactados; conflictos exactos y por
prefijo/distancia definidos en la [ficha](flows/product-synonyms.md).

Todos los productos, incluso inactivos, reservan sus aliases. El servidor valida
alias contra nombre/código/alias ajenos y renombres contra aliases ajenos; lock
global de catálogo y triggers protegen concurrencia y rutas DML. No se reescriben
productos históricos ni se generan sinónimos supuestos en la migración.
