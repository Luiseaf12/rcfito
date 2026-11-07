-- RCF-045: la vía deriva del medio y queda fijada en cada receta/destino.
-- Historia existente confirmada Foliar por el Propietario; no se renumera.
begin;
alter table public.application_methods add column application_route text not null default 'foliar' check(application_route in ('foliar','irrigation'));
alter table public.application_orders add column application_route text not null default 'foliar' check(application_route in ('foliar','irrigation'));
alter table public.application_targets add column application_route text not null default 'foliar' check(application_route in ('foliar','irrigation'));
alter table public.application_targets drop constraint application_targets_stage_number_unique;
alter table public.application_targets add constraint application_targets_stage_route_number_unique unique(stage_id,application_route,application_number);
alter table public.application_orders alter column water_l_ha drop not null;
alter table public.application_orders add constraint application_orders_route_water check((application_route='irrigation' and (water_l_ha is null or water_l_ha>0)) or (application_route='foliar' and water_l_ha is not null and water_l_ha>0));
alter table public.application_targets drop constraint application_targets_check;
alter table public.application_targets add constraint application_targets_state_water check(
(status='indicated' and actual_date is null and actual_water_l_ha is null and cancellation_reason is null and not has_changes and execution_signature is null)
or (status='performed' and actual_date is not null and ((application_route='irrigation' and (actual_water_l_ha is null or actual_water_l_ha>0)) or (application_route='foliar' and actual_water_l_ha is not null and actual_water_l_ha>0)) and cancellation_reason is null and execution_signature is not null)
or (status='cancelled' and actual_date is null and actual_water_l_ha is null and cancellation_reason is not null and btrim(cancellation_reason)<>'' and not has_changes and execution_signature is null));

create function rcfito_private.application_water(p_value jsonb,p_route text) returns numeric language plpgsql security invoker set search_path='' as $$
begin
 if p_route='irrigation' and (p_value is null or p_value='null'::jsonb) then return null;end if;
 begin return rcfito_private.application_water(p_value); exception when others then raise exception 'Revise el gasto de agua: %',sqlerrm;end;
end $$;
revoke all on function rcfito_private.application_water(jsonb,text) from public,anon,authenticated;

create function rcfito_private.guard_application_route() returns trigger language plpgsql security definer set search_path='' as $$
declare route text;
begin
 if tg_table_name='application_methods' then
  if new.application_route is distinct from old.application_route and (exists(select 1 from public.application_orders where method_id=old.id) or exists(select 1 from public.application_changes where (before->>'method_id')::uuid=old.id or (after->>'method_id')::uuid=old.id)) then raise exception 'La vía de un medio utilizado es histórica; cree otro medio';end if;
 elsif tg_op='UPDATE' then
  if new.application_route is distinct from old.application_route then raise exception 'La vía histórica no cambia; cree una nueva receta';end if;
 elsif tg_table_name='application_orders' then
  select application_route into route from public.application_methods where id=new.method_id for share;
  if new.application_route is distinct from route then raise exception 'La vía debe corresponder al medio seleccionado';end if;
 else
  select application_route into route from public.application_orders where id=new.order_id;
  if new.application_route is distinct from route then raise exception 'La vía del destino debe corresponder a su receta';end if;
 end if;
 return new;
end $$;
revoke all on function rcfito_private.guard_application_route() from public,anon,authenticated;
create trigger rcfito_method_route before update of application_route on public.application_methods for each row execute function rcfito_private.guard_application_route();
create trigger rcfito_order_route before insert or update of application_route on public.application_orders for each row execute function rcfito_private.guard_application_route();
create trigger rcfito_target_route before insert or update of application_route on public.application_targets for each row execute function rcfito_private.guard_application_route();


create or replace function rcfito_private.create_application_order(p_data jsonb,p_stage_ids uuid[],p_products jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare order_id uuid; project public.sowing_projects; ids uuid[]; products jsonb; signature jsonb; previous public.application_orders;
  item jsonb; snapshot jsonb; stage record; water numeric(12,4); indicated date; scheduled date; field_name text; crop_name text; method_name text; route text;
  requested_number integer; number_value numeric; next_number bigint; source_text text:='';
  group_id uuid; group_name text; group_row public.sowing_groups; eligible_ids uuid[]; origin text;
  capture jsonb; capture_area numeric;
  recipe jsonb; recipe_id uuid; recipe_revision integer; recipe_stage uuid; recipe_order public.application_orders;
  previous_scope text:=current_setting('rcfito.application_write',true);
begin
  if auth.uid() is null then raise exception 'Inicia sesión' using errcode='42501'; end if;
  perform rcfito_private.require_admin();
  if p_data is null or jsonb_typeof(p_data) is distinct from 'object' or nullif(p_data->>'id','') is null then raise exception 'La orden requiere un UUID estable'; end if;
  order_id:=(p_data->>'id')::uuid; ids:=rcfito_private.application_stage_ids(p_stage_ids); products:=rcfito_private.normalized_application_products(p_products);
  capture:=rcfito_private.normalized_application_image_source(p_data->'source_capture');
  if p_data ? 'source_group_id' and jsonb_typeof(p_data->'source_group_id') not in ('null','string') then raise exception 'El grupo de origen requiere un UUID válido'; end if;
  group_id:=(p_data->>'source_group_id')::uuid;
  if p_data->'recipe_source' is not null and p_data->'recipe_source'<>'null'::jsonb then
    recipe:=p_data->'recipe_source';
    if jsonb_typeof(recipe) is distinct from 'object' or jsonb_typeof(recipe->'order_id') is distinct from 'string'
      or jsonb_typeof(recipe->'revision') is distinct from 'number' then raise exception 'La receta base requiere orden y versión válidas'; end if;
    recipe_id:=(recipe->>'order_id')::uuid;
    number_value:=(recipe->>'revision')::numeric;
    if number_value<0 or number_value>2147483647 or trunc(number_value)<>number_value then raise exception 'La versión de la receta base no es válida'; end if;
    recipe_revision:=number_value::integer;
    recipe_stage:=(recipe->>'stage_id')::uuid;
    recipe:=jsonb_build_object('order_id',recipe_id,'revision',recipe_revision);
    if recipe_stage is not null then recipe:=recipe||jsonb_build_object('stage_id',recipe_stage); end if;
  end if;
  if p_data ? 'application_number' then
    if jsonb_typeof(p_data->'application_number') is distinct from 'number' then raise exception 'El número de aplicación debe ser un entero positivo válido'; end if;
    number_value:=(p_data->>'application_number')::numeric;
    if number_value<1 or number_value>2147483647 or trunc(number_value)<>number_value then raise exception 'El número de aplicación debe ser un entero positivo válido'; end if;
    requested_number:=number_value::integer;
  end if;
  if p_data ? 'source_text' then
    if jsonb_typeof(p_data->'source_text') is distinct from 'string' then raise exception 'El mensaje original debe ser texto'; end if;
    source_text:=p_data->>'source_text';
    if char_length(source_text)>20000 then raise exception 'El mensaje original supera 20,000 caracteres'; end if;
  end if;
  select application_route into route from public.application_methods where id=(p_data->>'method_id')::uuid for share;
  if not found then raise exception 'Seleccione un medio de aplicación válido';end if;
  water:=rcfito_private.application_water(p_data->'water_l_ha',route); indicated:=(p_data->>'indicated_date')::date; scheduled:=(p_data->>'scheduled_date')::date;
  if water<=0 or indicated is null or scheduled is null or scheduled<indicated then raise exception 'Revise gasto de agua y fechas de indicación/programación'; end if;
  signature:=jsonb_build_object('project_id',(p_data->>'project_id')::uuid,'field_id',(p_data->>'field_id')::uuid,'crop_id',(p_data->>'crop_id')::uuid,'method_id',(p_data->>'method_id')::uuid,'indicated_date',indicated,'scheduled_date',scheduled,'water_l_ha',water,'observations',coalesce(p_data->>'observations',''),'stage_ids',to_jsonb(ids),'products',products);
  -- Mantener idéntica la firma de entradas antiguas sin estos campos.
  if requested_number is not null then signature:=signature||jsonb_build_object('application_number',requested_number); end if;
  if source_text<>'' then signature:=signature||jsonb_build_object('source_text',source_text); end if;
  if group_id is not null then signature:=signature||jsonb_build_object('source_group_id',group_id); end if;
  if recipe is not null then signature:=signature||jsonb_build_object('recipe_source',recipe); end if;
  if capture is not null then signature:=signature||jsonb_build_object('source_capture',capture); end if;
  perform pg_advisory_xact_lock(hashtextextended('rcfito-order:'||order_id::text,0));
  select * into previous from public.application_orders where id=order_id for update;
  if found then
    if previous.request_signature=signature then return order_id; end if;
    raise exception 'El UUID ya corresponde a otra indicación';
  end if;
  -- Source order before group/stages matches revision/cancellation lock order.
  if recipe_id is not null then
    select * into recipe_order from public.application_orders where id=recipe_id for share;
    if not found or recipe_order.revision<>recipe_revision then raise exception 'La receta base cambió. Vuelva a cargarla antes de guardar'; end if;
    if recipe_order.application_route is distinct from route then raise exception 'La receta base debe pertenecer a la misma vía';end if;
    if recipe_order.project_id<>(p_data->>'project_id')::uuid or recipe_order.field_id<>(p_data->>'field_id')::uuid or recipe_order.crop_id<>(p_data->>'crop_id')::uuid then raise exception 'La receta base no pertenece al mismo proyecto, campo y cultivo'; end if;
    if group_id is not null then
      if recipe_order.selection_origin<>'group' or recipe_order.source_group_id is distinct from group_id or recipe_stage is not null then raise exception 'La receta base no corresponde al grupo seleccionado'; end if;
    elsif recipe_stage is null or not(recipe_stage=any(ids)) then raise exception 'La receta base requiere una etapa del lote seleccionado'; end if;
    if not exists(select 1 from public.application_targets t where t.order_id=recipe_id and t.stage_id=any(ids)
      and (recipe_stage is null or t.stage_id=recipe_stage) and t.status<>'cancelled') then raise exception 'La receta base ya no está activa para los destinos seleccionados'; end if;
  end if;
  -- Group edits take this same lock before locking stages. Retries above preserve the original snapshots.
  if group_id is not null then perform pg_advisory_xact_lock(hashtextextended('rcfito-group:'||group_id::text,0)); end if;
  -- Bloquear las etapas en orden serializa número explícito y max+1 concurrentes.
  -- Se conserva el orden etapa -> proyecto usado por las transiciones existentes.
  perform 1 from public.sowing_stages where id=any(ids) order by id for update;
  project:=rcfito_private.open_project((p_data->>'project_id')::uuid);
  if project.status<>'active' then raise exception 'La temporada debe estar activa para indicar aplicaciones'; end if;
  if group_id is not null then
    select * into group_row from public.sowing_groups g where g.id=group_id and g.active
      and g.project_id=project.id and g.field_id=(p_data->>'field_id')::uuid and g.crop_id=(p_data->>'crop_id')::uuid;
    if not found then raise exception 'Seleccione un grupo activo del mismo proyecto, campo y cultivo'; end if;
    group_name:=group_row.name;
    select array_agg(s.id order by s.id) into eligible_ids
      from public.sowing_group_members m join public.sowing_stages s on s.id=m.stage_id
      join public.lot_subdivisions d on d.id=s.subdivision_id join public.project_lots l on l.id=d.lot_id
      where m.group_id=group_row.id and m.active and s.status='planted' and d.active and l.active
        and l.project_id=project.id and l.field_id=group_row.field_id and s.crop_id=group_row.crop_id;
    if ids is distinct from coalesce(eligible_ids,array[]::uuid[]) then
      raise exception 'Revise el grupo: incluya todos sus destinos vigentes o use selección manual';
    end if;
    origin:='group';
  else
    select case when count(distinct d.lot_id)=1 then 'individual' else 'manual' end into origin
      from public.sowing_stages s join public.lot_subdivisions d on d.id=s.subdivision_id where s.id=any(ids);
  end if;
  select name into field_name from public.fields where id=(p_data->>'field_id')::uuid and agricultural_unit_id=project.agricultural_unit_id and active;
  if not found then raise exception 'Seleccione un campo activo de la agrícola del proyecto'; end if;
  select name into crop_name from public.crops where id=(p_data->>'crop_id')::uuid and active;
  if not found then raise exception 'Seleccione un cultivo activo'; end if;
  select name into method_name from public.application_methods where id=(p_data->>'method_id')::uuid and active;
  if not found then raise exception 'Seleccione un medio de aplicación activo'; end if;
  if (select count(*) from public.sowing_stages where id=any(ids))<>cardinality(ids) then raise exception 'Hay etapas no disponibles'; end if;
  for stage in select s.*,d.active subdivision_active,d.name subdivision_name,l.active lot_active,l.project_id,l.field_id,l.name lot_name from public.sowing_stages s join public.lot_subdivisions d on d.id=s.subdivision_id join public.project_lots l on l.id=d.lot_id where s.id=any(ids) order by s.id for update of s loop
    if stage.status<>'planted' or not stage.subdivision_active or not stage.lot_active or stage.project_id<>project.id or stage.field_id<>(p_data->>'field_id')::uuid or stage.crop_id<>(p_data->>'crop_id')::uuid then raise exception 'Todos los destinos deben ser siembras vigentes del mismo proyecto, campo y cultivo'; end if;
    if indicated<stage.actual_sowing_date then raise exception 'La indicación no puede preceder la siembra del destino'; end if;
    select coalesce(requested_number::bigint,coalesce(max(t.application_number),0)::bigint+1) into next_number from public.application_targets t where t.stage_id=stage.id and t.application_route=route;
    if next_number>2147483647 then raise exception 'La numeración de esta etapa alcanzó su límite'; end if;
    if exists(select 1 from public.application_targets t where t.stage_id=stage.id and t.application_route=route and t.application_number=next_number) then raise exception 'La aplicación % ya está registrada en una de las etapas seleccionadas',next_number; end if;
  end loop;
  -- Las etapas siguen bloqueadas: el área actual es la base autoritativa.
  if capture is not null then
    select sum(area_ha) into capture_area from public.sowing_stages where id=any(ids);
    perform rcfito_private.validate_application_image_doses(capture,products,capture_area);
  end if;
  for item in select value from jsonb_array_elements(products) loop perform rcfito_private.application_product_snapshot((item->>'product_id')::uuid); end loop;
  perform set_config('rcfito.application_write','create',true);
  insert into public.application_orders(id,project_id,field_id,crop_id,method_id,application_route,indicated_date,scheduled_date,water_l_ha,observations,source_text,project_name,field_name,crop_name,method_name,agricultural_unit_name,season,request_signature,created_by,selection_origin,source_group_id,source_group_name,recipe_source_order_id,recipe_source_revision,recipe_source_stage_id,source_capture)
  values(order_id,project.id,(p_data->>'field_id')::uuid,(p_data->>'crop_id')::uuid,(p_data->>'method_id')::uuid,route,indicated,scheduled,water,coalesce(p_data->>'observations',''),source_text,project.name,field_name,crop_name,method_name,project.agricultural_unit_name,project.season,signature,auth.uid(),origin,group_id,group_name,recipe_id,recipe_revision,recipe_stage,capture);
  for item in select value from jsonb_array_elements(products) loop
    snapshot:=rcfito_private.application_product_snapshot((item->>'product_id')::uuid);
    insert into public.application_order_products(order_id,product_id,dose,product_name,unit,ingredients_snapshot)
    values(order_id,(item->>'product_id')::uuid,(item->>'dose')::numeric,snapshot->>'product_name',snapshot->>'unit',snapshot->'ingredients_snapshot');
  end loop;
  insert into public.application_targets(order_id,stage_id,application_route,application_number,lot_name,subdivision_name,stage_number,crop_name,variety_name,area_ha,group_memberships_snapshot)
  select order_id,s.id,route,coalesce(requested_number,(select coalesce(max(t.application_number),0)+1 from public.application_targets t where t.stage_id=s.id and t.application_route=route)),l.name,d.name,s.stage_number,s.crop_name,s.variety_name,s.area_ha,
    coalesce((select jsonb_agg(jsonb_build_object('id',g.id,'name',g.name) order by g.id)
      from public.sowing_groups g join public.sowing_group_members m on m.group_id=g.id
      where m.stage_id=s.id and m.active and g.active and g.project_id=project.id
        and g.field_id=l.field_id and g.crop_id=s.crop_id),'[]'::jsonb)
  from public.sowing_stages s join public.lot_subdivisions d on d.id=s.subdivision_id join public.project_lots l on l.id=d.lot_id where s.id=any(ids);
  perform set_config('rcfito.application_write',coalesce(previous_scope,''),true);
  return order_id;
end $$;

create or replace function rcfito_private.perform_application_targets(p_order_id uuid,p_target_ids uuid[],p_data jsonb) returns void language plpgsql security definer set search_path='' as $$
declare ids uuid[]; application public.application_orders; target public.application_targets; stage record;
  changed boolean; differs boolean; actual date; water numeric; products jsonb; supplied_products jsonb; snapshots jsonb; indication jsonb; signature jsonb;
  pending uuid[]:='{}'; previous_scope text:=current_setting('rcfito.application_write',true);
begin
  if auth.uid() is null then raise exception 'Se requiere una sesión' using errcode='42501'; end if;
  perform rcfito_private.require_admin();
  ids:=rcfito_private.application_stage_ids(p_target_ids);
  if p_data is null or jsonb_typeof(p_data) is distinct from 'object' or jsonb_typeof(p_data->'changed') is distinct from 'boolean' then raise exception 'Indique si hubo cambios en la realización'; end if;
  changed:=(p_data->>'changed')::boolean; actual:=(p_data->>'actual_date')::date;
  if actual is null then raise exception 'Capture la fecha de realización'; end if;
  select * into application from public.application_orders where id=p_order_id for update;
  if not found then raise exception 'Orden inexistente'; end if;
  if changed then supplied_products:=rcfito_private.normalized_application_products(p_data->'products'); perform rcfito_private.application_water(p_data->'water_l_ha',application.application_route); end if;
  if (select count(*) from public.application_targets where order_id=p_order_id and id=any(ids))<>cardinality(ids) then raise exception 'Los destinos deben pertenecer a la orden'; end if;
  for target in select * from public.application_targets where id=any(ids) order by id for update loop
    indication:=rcfito_private.application_indication(target.id);
    products:=case when changed then supplied_products else rcfito_private.application_product_inputs(indication->'products') end;
    water:=case when changed then (p_data->>'water_l_ha')::numeric else (indication->>'water_l_ha')::numeric end;
    signature:=jsonb_build_object('actual_date',actual,'equipment',coalesce(p_data->>'equipment',''),'applicator',coalesce(p_data->>'applicator',''),'observations',coalesce(p_data->>'observations',''),'changed',changed,'water_l_ha',water,'products',products);
    -- La firma de primera ejecución se conserva aunque después se corrija.
    if target.status='performed' and target.execution_signature=signature then continue; end if;
    if target.status<>'indicated' then raise exception 'Un destino ya tiene otro resultado definitivo'; end if;
    pending:=array_append(pending,target.id);
  end loop;
  if cardinality(pending)=0 then return; end if;
  if p_data ? 'expected_revision' then
    if rcfito_private.application_version(p_data->'expected_revision')<>application.revision then raise exception 'La indicación cambió; actualiza la vista antes de realizar'; end if;
  elsif application.revision>0 then raise exception 'La indicación fue revisada; confirma su revisión vigente antes de realizar'; end if;
  perform 1 from public.sowing_stages s join public.application_targets t on t.stage_id=s.id where t.id=any(pending) order by s.id for update of s;
  perform rcfito_private.open_project(application.project_id);
  if not exists(select 1 from public.sowing_projects where id=application.project_id and status='active') then raise exception 'El proyecto debe estar activo'; end if;
  if actual>(now() at time zone 'America/Mazatlan')::date then raise exception 'La fecha de realización debe estar entre la indicación y hoy'; end if;
  for stage in select s.*,d.active subdivision_active,l.active lot_active,t.id target_id from public.sowing_stages s join public.lot_subdivisions d on d.id=s.subdivision_id join public.project_lots l on l.id=d.lot_id join public.application_targets t on t.stage_id=s.id where t.id=any(pending) order by s.id loop
    if stage.status<>'planted' or not stage.subdivision_active or not stage.lot_active then raise exception 'El destino debe conservar su etapa sembrada vigente'; end if;
    indication:=rcfito_private.application_indication(stage.target_id);
    if actual<(indication->>'indicated_date')::date then raise exception 'La fecha de realización no puede preceder la indicación vigente'; end if;
    if actual<stage.actual_sowing_date then raise exception 'La realización no puede preceder a la siembra'; end if;
    products:=case when changed then supplied_products else rcfito_private.application_product_inputs(indication->'products') end;
    perform rcfito_private.application_snapshot_products(products,indication->'products');
  end loop;
  perform set_config('rcfito.application_write','perform',true);
  for target in select * from public.application_targets where id=any(pending) order by id loop
    indication:=rcfito_private.application_indication(target.id);
    products:=case when changed then supplied_products else rcfito_private.application_product_inputs(indication->'products') end;
    water:=case when changed then (p_data->>'water_l_ha')::numeric else (indication->>'water_l_ha')::numeric end;
    snapshots:=rcfito_private.application_snapshot_products(products,indication->'products');
    differs:=water is distinct from (indication->>'water_l_ha')::numeric or products is distinct from rcfito_private.application_product_inputs(indication->'products');
    signature:=jsonb_build_object('actual_date',actual,'equipment',coalesce(p_data->>'equipment',''),'applicator',coalesce(p_data->>'applicator',''),'observations',coalesce(p_data->>'observations',''),'changed',changed,'water_l_ha',water,'products',products);
    update public.application_targets set status='performed',actual_date=actual,actual_water_l_ha=water,equipment=signature->>'equipment',applicator=signature->>'applicator',actual_observations=signature->>'observations',has_changes=differs,execution_signature=signature where id=target.id;
    insert into public.application_actual_products(target_id,product_id,dose,product_name,unit,ingredients_snapshot)
      select target.id,(x->>'product_id')::uuid,(x->>'dose')::numeric,x->>'product_name',x->>'unit',x->'ingredients_snapshot' from jsonb_array_elements(snapshots) x;
  end loop;
  perform set_config('rcfito.application_write',coalesce(previous_scope,''),true);
end $$;

create or replace function rcfito_private.revise_application_order(p_data jsonb,p_products jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare change_id uuid; application public.application_orders; previous public.application_changes; target public.application_targets;
  expected integer; ids uuid[]; pending uuid[]; normalized jsonb; signature jsonb; before_snapshot jsonb; after_snapshot jsonb;
  indicated date; scheduled date; water numeric; method_id uuid; method_name text; stage record; actor_name text;
  previous_scope text:=current_setting('rcfito.application_write',true);
begin
  if auth.uid() is null then raise exception 'Inicia sesión' using errcode='42501'; end if;
  perform rcfito_private.require_admin();
  perform rcfito_private.application_edit_data(p_data,array['id','order_id','expected_revision','target_ids','method_id','indicated_date','scheduled_date','water_l_ha','observations','reason']);
  change_id:=(p_data->>'id')::uuid; expected:=rcfito_private.application_version(p_data->'expected_revision');
  if jsonb_typeof(p_data->'target_ids') is distinct from 'array' then raise exception 'Seleccione todos los destinos pendientes'; end if;
  select array_agg(value::uuid) into ids from jsonb_array_elements_text(p_data->'target_ids');
  ids:=rcfito_private.application_stage_ids(ids); normalized:=rcfito_private.normalized_application_products(p_products);
  water:=rcfito_private.application_water(p_data->'water_l_ha',(select o.application_route from public.application_orders o where o.id=(p_data->>'order_id')::uuid)); method_id:=(p_data->>'method_id')::uuid;
  indicated:=rcfito_private.application_edit_date(p_data->'indicated_date'); scheduled:=rcfito_private.application_edit_date(p_data->'scheduled_date');
  if indicated is null or scheduled is null or scheduled<indicated then raise exception 'Revise fechas de indicación y programación'; end if;
  signature:=jsonb_build_object('kind','indication','order_id',(p_data->>'order_id')::uuid,'expected_revision',expected,'target_ids',ids,'method_id',method_id,'indicated_date',indicated,'scheduled_date',scheduled,'water_l_ha',water,'observations',coalesce(p_data->>'observations',''),'reason',rcfito_private.application_edit_trim(p_data->>'reason'),'products',normalized);
  perform pg_advisory_xact_lock(hashtextextended('rcfito-change:'||change_id::text,0));
  select * into previous from public.application_changes where id=change_id;
  if found then if previous.request_signature=signature then return change_id; end if; raise exception 'El UUID ya corresponde a otro cambio'; end if;
  select * into application from public.application_orders where id=(p_data->>'order_id')::uuid for update;
  if not found then raise exception 'Orden inexistente'; end if;
  if application.revision<>expected then raise exception 'La indicación cambió; actualiza la vista antes de editar'; end if;
  perform 1 from public.application_targets where order_id=application.id order by id for update;
  select array_agg(id order by id) into pending from public.application_targets where order_id=application.id and status='indicated';
  if pending is null or pending is distinct from ids then raise exception 'La revisión debe incluir todos y solo los destinos pendientes actuales'; end if;
  for target in select * from public.application_targets where id=any(pending) order by id loop
    if before_snapshot is null then before_snapshot:=rcfito_private.application_indication(target.id);
    elsif before_snapshot is distinct from rcfito_private.application_indication(target.id) then raise exception 'Los destinos pendientes tienen indicaciones diferentes'; end if;
  end loop;
  perform 1 from public.sowing_stages s join public.application_targets t on t.stage_id=s.id where t.id=any(pending) order by s.id for update of s;
  if (rcfito_private.open_project(application.project_id)).status<>'active' then raise exception 'La temporada debe estar activa'; end if;
  for stage in select s.*,d.active subdivision_active,l.active lot_active,l.project_id,l.field_id from public.sowing_stages s join public.lot_subdivisions d on d.id=s.subdivision_id join public.project_lots l on l.id=d.lot_id join public.application_targets t on t.stage_id=s.id where t.id=any(pending) order by s.id loop
    if stage.status<>'planted' or not stage.subdivision_active or not stage.lot_active or stage.project_id<>application.project_id or stage.field_id<>application.field_id or stage.crop_id<>application.crop_id then raise exception 'Los destinos deben conservar sus siembras vigentes'; end if;
    if indicated<stage.actual_sowing_date then raise exception 'La indicación no puede preceder la siembra del destino'; end if;
  end loop;
  perform 1 from public.application_methods where id=method_id for share;
  if method_id=(before_snapshot->>'method_id')::uuid then method_name:=before_snapshot->>'method_name';
  else select name into method_name from public.application_methods where id=method_id and active; if not found then raise exception 'Seleccione un medio de aplicación activo'; end if; end if;
  if (select m.application_route from public.application_methods m where m.id=method_id) is distinct from application.application_route then raise exception 'La vía no se puede cambiar; cree una nueva receta';end if;
  if method_name is null then raise exception 'Seleccione un medio de aplicación válido'; end if;
  after_snapshot:=jsonb_build_object('method_id',method_id,'method_name',method_name,'indicated_date',indicated,'scheduled_date',scheduled,'water_l_ha',water,'observations',coalesce(p_data->>'observations',''),'products',rcfito_private.application_snapshot_products(normalized,before_snapshot->'products'));
  select display_name into actor_name from public.profiles where id=auth.uid();
  perform set_config('rcfito.application_write','revise',true);
  insert into public.application_changes(id,order_id,kind,version,target_ids,reason,changed_by,changed_by_name,"before","after",request_signature)
    values(change_id,application.id,'indication',expected+1,pending,rcfito_private.application_edit_trim(p_data->>'reason'),auth.uid(),actor_name,before_snapshot,after_snapshot,signature);
  perform rcfito_private.store_application_change_products(change_id,before_snapshot,after_snapshot);
  update public.application_orders set revision=expected+1 where id=application.id;
  update public.application_targets set indication_change_id=change_id where id=any(pending);
  perform set_config('rcfito.application_write',coalesce(previous_scope,''),true);
  return change_id;
end $$;

create or replace function rcfito_private.correct_application_target(p_data jsonb,p_products jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare change_id uuid; target_id uuid; order_id uuid; expected integer; application public.application_orders; target public.application_targets;
  previous public.application_changes; before_snapshot jsonb; after_snapshot jsonb; indication jsonb; normalized jsonb; products jsonb; signature jsonb;
  actual date; water numeric; differs boolean; stage public.sowing_stages; actor_name text;
  previous_scope text:=current_setting('rcfito.application_write',true);
begin
  if auth.uid() is null then raise exception 'Inicia sesión' using errcode='42501'; end if;
  perform rcfito_private.require_admin();
  perform rcfito_private.application_edit_data(p_data,array['id','target_id','expected_version','actual_date','water_l_ha','equipment','applicator','observations','reason']);
  change_id:=(p_data->>'id')::uuid; target_id:=(p_data->>'target_id')::uuid; expected:=rcfito_private.application_version(p_data->'expected_version');
  normalized:=rcfito_private.normalized_application_products(p_products); water:=rcfito_private.application_water(p_data->'water_l_ha',(select o.application_route from public.application_targets t join public.application_orders o on o.id=t.order_id where t.id=target_id)); actual:=rcfito_private.application_edit_date(p_data->'actual_date');
  if actual is null then raise exception 'Capture una fecha real válida'; end if;
  signature:=jsonb_build_object('kind','performance','target_id',target_id,'expected_version',expected,'actual_date',actual,'water_l_ha',water,'equipment',rcfito_private.application_edit_trim(coalesce(p_data->>'equipment','')),'applicator',rcfito_private.application_edit_trim(coalesce(p_data->>'applicator','')),'observations',coalesce(p_data->>'observations',''),'reason',rcfito_private.application_edit_trim(p_data->>'reason'),'products',normalized);
  perform pg_advisory_xact_lock(hashtextextended('rcfito-change:'||change_id::text,0));
  select * into previous from public.application_changes where id=change_id;
  if found then if previous.request_signature=signature then return change_id; end if; raise exception 'El UUID ya corresponde a otro cambio'; end if;
  select t.order_id into order_id from public.application_targets t where t.id=target_id;
  select * into application from public.application_orders where id=order_id for update;
  if not found then raise exception 'Orden o destino inexistente'; end if;
  select * into target from public.application_targets t where t.id=target_id for update;
  if target.status<>'performed' then raise exception 'Solo se corrigen aplicaciones realizadas'; end if;
  if target.correction_version<>expected then raise exception 'La realización cambió; actualiza la vista antes de corregir'; end if;
  select * into stage from public.sowing_stages where id=target.stage_id for update;
  indication:=rcfito_private.application_indication(target.id);
  if actual<stage.actual_sowing_date or actual<(indication->>'indicated_date')::date or actual>(now() at time zone 'America/Mazatlan')::date or (stage.end_date is not null and actual>stage.end_date) then raise exception 'La fecha real debe respetar siembra, indicación, cierre y día actual'; end if;
  before_snapshot:=rcfito_private.application_performance(target.id);
  products:=rcfito_private.application_snapshot_products(normalized,before_snapshot->'products');
  differs:=water is distinct from (indication->>'water_l_ha')::numeric or normalized is distinct from rcfito_private.application_product_inputs(indication->'products');
  after_snapshot:=jsonb_build_object('actual_date',actual,'water_l_ha',water,'equipment',signature->>'equipment','applicator',signature->>'applicator','observations',signature->>'observations','has_changes',differs,'products',products);
  select display_name into actor_name from public.profiles where id=auth.uid();
  perform set_config('rcfito.application_write','correct',true);
  insert into public.application_changes(id,order_id,target_id,kind,version,target_ids,reason,changed_by,changed_by_name,"before","after",request_signature)
    values(change_id,application.id,target.id,'performance',expected+1,array[target.id],rcfito_private.application_edit_trim(p_data->>'reason'),auth.uid(),actor_name,before_snapshot,after_snapshot,signature);
  perform rcfito_private.store_application_change_products(change_id,before_snapshot,after_snapshot);
  update public.application_targets set actual_date=actual,actual_water_l_ha=water,equipment=signature->>'equipment',applicator=signature->>'applicator',actual_observations=signature->>'observations',has_changes=differs,correction_version=expected+1 where id=target.id;
  delete from public.application_actual_products p where p.target_id=target.id;
  insert into public.application_actual_products(target_id,product_id,dose,product_name,unit,ingredients_snapshot)
    select target.id,(x->>'product_id')::uuid,(x->>'dose')::numeric,x->>'product_name',x->>'unit',x->'ingredients_snapshot' from jsonb_array_elements(products) x;
  perform set_config('rcfito.application_write',coalesce(previous_scope,''),true);
  return change_id;
end $$;

create or replace function rcfito_private.menu_reference_catalogs() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare scoped boolean; apps boolean; result jsonb;
begin
  if not rcfito_private.is_active_user() then raise exception 'Se requiere una cuenta activa' using errcode='42501'; end if;
  if rcfito_private.is_admin() then return '{}'::jsonb; end if;
  scoped:=exists(select 1 from unnest(array['summary','projects','applications','queries','groups']) k where rcfito_private.has_menu(k));
  apps:=exists(select 1 from unnest(array['summary','applications','queries']) k where rcfito_private.has_menu(k));
  with projects as (select p.* from public.sowing_projects p where scoped and rcfito_private.can_access_unit(p.agricultural_unit_id)),
  lots as (select l.* from public.project_lots l join projects p on p.id=l.project_id),
  stages as (select s.* from public.sowing_stages s join public.lot_subdivisions d on d.id=s.subdivision_id join lots l on l.id=d.lot_id),
  orders as (select o.* from public.application_orders o join projects p on p.id=o.project_id where apps),
  product_ids as (select product_id id from public.application_order_products where order_id in(select id from orders)
    union select a.product_id from public.application_actual_products a join public.application_targets t on t.id=a.target_id where t.order_id in(select id from orders)),
  refs(kind,id,name,active) as (
    select 'agricultural_units',a.id,a.name,a.active from public.agricultural_units a where (scoped or rcfito_private.has_menu('catalog:fields')) and rcfito_private.can_access_unit(a.id)
    union all select 'fields',f.id,f.name,f.active from public.fields f where scoped and rcfito_private.can_access_unit(f.agricultural_unit_id)
    union all select 'crops',c.id,c.name,c.active from public.crops c where c.id in(select crop_id from stages) or (rcfito_private.has_menu('catalog:varieties') and exists(select 1 from public.varieties v where v.crop_id=c.id))
    union all select 'varieties',v.id,v.name,v.active from public.varieties v where v.id in(select variety_id from stages)
    union all select 'infrastructure_types',i.id,i.name,i.active from public.infrastructure_types i where i.id in(select infrastructure_type_id from lots)
    union all select 'application_methods',m.id,m.name,m.active from public.application_methods m where m.id in(select method_id from orders)
    union all select 'products',p.id,p.name,p.active from public.products p where p.id in(select id from product_ids)
    union all select 'active_ingredients',i.id,i.name,i.active from public.active_ingredients i where rcfito_private.has_menu('catalog:products') and exists(select 1 from public.product_ingredients p where p.active_ingredient_id=i.id)
    union all select 'ingredient_classifications',c.id,c.name,c.active from public.ingredient_classifications c where rcfito_private.has_menu('catalog:active_ingredients') and exists(select 1 from public.active_ingredients i where i.classification_id=c.id)
    union all select 'brands',b.id,b.name,b.active from public.brands b where rcfito_private.has_menu('catalog:products') and exists(select 1 from public.products p where p.brand_id=b.id)
    union all select 'product_families',f.id,f.name,f.active from public.product_families f where rcfito_private.has_menu('catalog:products') and exists(select 1 from public.products p where p.product_family_id=f.id)
  ), grouped as (select kind,jsonb_agg((jsonb_build_object('id',id,'name',name,'active',active)||case when kind='fields' then jsonb_build_object('agricultural_unit_id',(select agricultural_unit_id from public.fields f where f.id=refs.id)) when kind='application_methods' then jsonb_build_object('application_route',(select m.application_route from public.application_methods m where m.id=refs.id)) when kind='varieties' then jsonb_build_object('crop_id',(select crop_id from public.varieties v where v.id=refs.id)) else '{}'::jsonb end) order by id) rows from refs group by kind)
  select coalesce(jsonb_object_agg(kind,rows),'{}') into result from grouped;
  return result;
end $$;

-- Medio disponible para comenzar riego; no crea recetas ni destinos.
insert into public.application_methods(code,name,application_route) select 'Sistema de riego','Sistema de riego','irrigation' where not exists(select 1 from public.application_methods where lower(btrim(name))='sistema de riego');

notify pgrst,'reload schema';
commit;
