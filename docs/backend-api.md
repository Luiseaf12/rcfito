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
