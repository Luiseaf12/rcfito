-- Aplicaciones y grupos. Migración aditiva; no modifica la revisión instalada.
begin;

create sequence rcfito_private.application_folio_seq;
create function rcfito_private.next_application_folio() returns text language plpgsql security invoker set search_path='' as $$
declare n text;
begin
  n:=nextval('rcfito_private.application_folio_seq')::text;
  return 'APL-'||lpad(n,greatest(6,length(n)),'0');
end $$;
create function rcfito_private.normalized_group_name(p_name text) returns text language sql immutable strict security invoker set search_path='' as $$
  select lower(regexp_replace(normalize(btrim(p_name),NFD),U&'[\0300-\036f]','','g'))
$$;

create table public.application_orders(
  id uuid primary key,
  folio text not null unique default rcfito_private.next_application_folio(),
  project_id uuid not null references public.sowing_projects on delete restrict,
  field_id uuid not null references public.fields on delete restrict,
  crop_id uuid not null references public.crops on delete restrict,
  method_id uuid not null references public.application_methods on delete restrict,
  indicated_date date not null, scheduled_date date not null,
  water_l_ha numeric(12,4) not null check(water_l_ha>0), observations text not null default '',
  project_name text not null, field_name text not null, crop_name text not null, method_name text not null,
  agricultural_unit_name text not null, season text not null,
  request_signature jsonb not null,
  created_by uuid not null references auth.users on delete restrict,
  created_at timestamptz not null default now(),
  check(scheduled_date>=indicated_date)
);
create table public.application_order_products(
  order_id uuid not null references public.application_orders on delete restrict,
  product_id uuid not null references public.products on delete restrict,
  dose numeric(14,6) not null check(dose>0),
  product_name text not null, unit text not null check(unit in ('g','ml')),
  ingredients_snapshot jsonb not null default '[]' check(jsonb_typeof(ingredients_snapshot)='array'),
  primary key(order_id,product_id)
);
create table public.application_targets(
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.application_orders on delete restrict,
  stage_id uuid not null references public.sowing_stages on delete restrict,
  status text not null default 'indicated' check(status in ('indicated','performed','cancelled')),
  lot_name text not null, subdivision_name text not null, stage_number integer not null,
  crop_name text not null, variety_name text not null, area_ha numeric(12,4) not null check(area_ha>0),
  actual_date date, actual_water_l_ha numeric(12,4),
  equipment text not null default '', applicator text not null default '', actual_observations text not null default '',
  cancellation_reason text, has_changes boolean not null default false,
  execution_signature jsonb, cancelled_at timestamptz,
  created_at timestamptz not null default now(), unique(order_id,stage_id),
  check(
    (status='indicated' and actual_date is null and actual_water_l_ha is null and cancellation_reason is null and not has_changes and execution_signature is null)
    or (status='performed' and actual_date is not null and actual_water_l_ha is not null and actual_water_l_ha>0 and cancellation_reason is null and execution_signature is not null)
    or (status='cancelled' and actual_date is null and actual_water_l_ha is null and cancellation_reason is not null and btrim(cancellation_reason)<>'' and not has_changes and execution_signature is null)
  )
);
create table public.application_actual_products(
  target_id uuid not null references public.application_targets on delete restrict,
  product_id uuid not null references public.products on delete restrict,
  dose numeric(14,6) not null check(dose>0),
  product_name text not null, unit text not null check(unit in ('g','ml')),
  ingredients_snapshot jsonb not null default '[]' check(jsonb_typeof(ingredients_snapshot)='array'),
  primary key(target_id,product_id)
);
create table public.sowing_groups(
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.sowing_projects on delete restrict,
  field_id uuid not null references public.fields on delete restrict,
  crop_id uuid not null references public.crops on delete restrict,
  name text not null check(btrim(name)<>''), active boolean not null default true,
  project_name text not null, field_name text not null, crop_name text not null,
  request_signature jsonb not null, created_at timestamptz not null default now()
);
create table public.sowing_group_members(
  group_id uuid not null references public.sowing_groups on delete restrict,
  stage_id uuid not null references public.sowing_stages on delete restrict,
  active boolean not null default true, retired_at timestamptz,
  created_at timestamptz not null default now(), primary key(group_id,stage_id)
);
create index application_orders_project_idx on public.application_orders(project_id);
create index application_orders_field_idx on public.application_orders(field_id);
create index application_orders_crop_idx on public.application_orders(crop_id);
create index application_orders_method_idx on public.application_orders(method_id);
create index application_orders_scheduled_idx on public.application_orders(scheduled_date);
create index application_orders_indicated_idx on public.application_orders(indicated_date);
create index application_orders_creator_idx on public.application_orders(created_by);
create index application_order_products_product_idx on public.application_order_products(product_id);
create index application_targets_stage_status_idx on public.application_targets(stage_id,status);
create index application_targets_order_idx on public.application_targets(order_id);
create index application_targets_actual_idx on public.application_targets(actual_date) where status='performed';
create index application_actual_products_product_idx on public.application_actual_products(product_id);
create index sowing_groups_project_idx on public.sowing_groups(project_id);
create index sowing_groups_field_idx on public.sowing_groups(field_id);
create index sowing_groups_crop_idx on public.sowing_groups(crop_id);
create unique index sowing_groups_name_unique on public.sowing_groups(project_id,field_id,rcfito_private.normalized_group_name(name));
create index sowing_group_members_stage_idx on public.sowing_group_members(stage_id);

-- Authentication is always verified before a privileged mutator queries data.
-- Only private mutators use SECURITY DEFINER; public API wrappers remain invoker.
create function rcfito_private.application_stage_ids(p_ids uuid[],p_allow_empty boolean default false) returns uuid[] language plpgsql security invoker set search_path='' as $$
declare result uuid[];
begin
  if p_ids is null or (not p_allow_empty and cardinality(p_ids)=0) or array_position(p_ids,null) is not null then raise exception 'Seleccione destinos válidos'; end if;
  select coalesce(array_agg(distinct id order by id),'{}'::uuid[]) into result from unnest(p_ids) as x(id);
  if cardinality(result)<>cardinality(p_ids) then raise exception 'No repita un destino en la selección'; end if;
  return result;
end $$;
create function rcfito_private.normalized_application_products(p_products jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare item jsonb; pid uuid; amount numeric(14,6); result jsonb:='[]'; seen uuid[]:='{}';
begin
  if p_products is null or jsonb_typeof(p_products) is distinct from 'array' or jsonb_array_length(p_products)<1 then raise exception 'Capture al menos un producto'; end if;
  for item in select value from jsonb_array_elements(p_products) loop
    if jsonb_typeof(item) is distinct from 'object' or jsonb_typeof(item->'dose') is distinct from 'number' or nullif(item->>'product_id','') is null then raise exception 'Producto y dosis deben ser válidos'; end if;
    pid:=(item->>'product_id')::uuid; amount:=(item->>'dose')::numeric(14,6);
    if amount<=0 then raise exception 'La dosis debe ser mayor que cero'; end if;
    if pid=any(seen) then raise exception 'No repita un producto en la mezcla'; end if;
    seen:=array_append(seen,pid);
    result:=result||jsonb_build_array(jsonb_build_object('product_id',pid,'dose',amount));
  end loop;
  select jsonb_agg(value order by value->>'product_id') into result from jsonb_array_elements(result);
  return result;
end $$;
create function rcfito_private.application_product_snapshot(p_product_id uuid,p_order_id uuid default null) returns jsonb language plpgsql security invoker set search_path='' as $$
declare original public.application_order_products; product public.products; ingredients jsonb;
begin
  if p_order_id is not null then
    select * into original from public.application_order_products where order_id=p_order_id and product_id=p_product_id;
    if found then return jsonb_build_object('product_name',original.product_name,'unit',original.unit,'ingredients_snapshot',original.ingredients_snapshot); end if;
  end if;
  select * into product from public.products where id=p_product_id and active for share;
  if not found then raise exception 'Los productos nuevos deben estar activos'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('active_ingredient_id',i.id,'name',i.name,'concentration',pi.concentration) order by i.id),'[]'::jsonb)
  into ingredients from public.product_ingredients pi join public.active_ingredients i on i.id=pi.active_ingredient_id where pi.product_id=product.id;
  return jsonb_build_object('product_name',product.name,'unit',product.unit,'ingredients_snapshot',ingredients);
end $$;

create function rcfito_private.guard_application_write() returns trigger language plpgsql security invoker set search_path='' as $$
declare mode text:=current_setting('rcfito.application_write',true);
begin
  if tg_op='DELETE' then raise exception 'El historial de aplicaciones y grupos no se elimina'; end if;
  if tg_table_name in ('application_orders','application_order_products') then
    if mode is distinct from 'create' or tg_op<>'INSERT' then raise exception 'La indicación original es inmutable y se guarda por RPC'; end if;
  elsif tg_table_name='application_actual_products' then
    if mode is distinct from 'perform' or tg_op<>'INSERT' or not exists(select 1 from public.application_targets where id=new.target_id and status='performed') then raise exception 'La realización solo se guarda por RPC'; end if;
  elsif tg_table_name='application_targets' then
    if tg_op='INSERT' then
      if mode is distinct from 'create' or new.status<>'indicated' then raise exception 'El destino se crea indicado mediante RPC'; end if;
    else
      if old.status<>'indicated' then raise exception 'Un destino terminal conserva su historial'; end if;
      if (new.id,new.order_id,new.stage_id,new.lot_name,new.subdivision_name,new.stage_number,new.crop_name,new.variety_name,new.area_ha,new.created_at)
         is distinct from (old.id,old.order_id,old.stage_id,old.lot_name,old.subdivision_name,old.stage_number,old.crop_name,old.variety_name,old.area_ha,old.created_at) then raise exception 'El destino y sus snapshots son inmutables'; end if;
      if not ((mode='perform' and new.status='performed') or (mode='cancel' and new.status='cancelled')) then raise exception 'La transición del destino requiere RPC'; end if;
    end if;
  elsif tg_table_name='sowing_groups' then
    if mode is distinct from 'group' then raise exception 'Los grupos se guardan por RPC'; end if;
    if tg_op='UPDATE' and (new.id,new.project_id,new.field_id,new.crop_id,new.project_name,new.field_name,new.crop_name,new.created_at)
      is distinct from (old.id,old.project_id,old.field_id,old.crop_id,old.project_name,old.field_name,old.crop_name,old.created_at) then raise exception 'El contexto del grupo no cambia; cree otro grupo'; end if;
  elsif tg_table_name='sowing_group_members' then
    if mode is distinct from 'group' then raise exception 'Los integrantes del grupo se guardan por RPC'; end if;
    if tg_op='UPDATE' and (new.group_id,new.stage_id,new.created_at) is distinct from (old.group_id,old.stage_id,old.created_at) then raise exception 'La asociación histórica del grupo no cambia'; end if;
  end if;
  return new;
end $$;

do $$ declare t text; begin
  foreach t in array array['application_orders','application_order_products','application_targets','application_actual_products','sowing_groups','sowing_group_members'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from public, anon, authenticated',t);
    execute format('grant select on public.%I to authenticated',t);
    if exists(select 1 from pg_roles where rolname='service_role') then execute format('revoke insert,update,delete,truncate on public.%I from service_role',t); end if;
    execute format('create trigger rcfito_application_write before insert or update or delete on public.%I for each row execute function rcfito_private.guard_application_write()',t);
  end loop;
end $$;
create policy application_orders_assigned on public.application_orders for select to authenticated using(exists(select 1 from public.sowing_projects p where p.id=project_id and rcfito_private.can_access_unit(p.agricultural_unit_id)));
create policy application_order_products_assigned on public.application_order_products for select to authenticated using(exists(select 1 from public.application_orders o where o.id=order_id));
create policy application_targets_assigned on public.application_targets for select to authenticated using(exists(select 1 from public.application_orders o where o.id=order_id));
create policy application_actual_products_assigned on public.application_actual_products for select to authenticated using(exists(select 1 from public.application_targets t where t.id=target_id));
create policy sowing_groups_assigned on public.sowing_groups for select to authenticated using(exists(select 1 from public.sowing_projects p where p.id=project_id and rcfito_private.can_access_unit(p.agricultural_unit_id)));
create policy sowing_group_members_assigned on public.sowing_group_members for select to authenticated using(exists(select 1 from public.sowing_groups g where g.id=group_id));

create function rcfito_private.create_application_order(p_data jsonb,p_stage_ids uuid[],p_products jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare order_id uuid; project public.sowing_projects; ids uuid[]; products jsonb; signature jsonb; previous public.application_orders;
  item jsonb; snapshot jsonb; stage record; water numeric(12,4); indicated date; scheduled date; field_name text; crop_name text; method_name text;
  previous_scope text:=current_setting('rcfito.application_write',true);
begin
  if auth.uid() is null then raise exception 'Inicia sesión' using errcode='42501'; end if;
  perform rcfito_private.require_admin();
  if p_data is null or jsonb_typeof(p_data) is distinct from 'object' or nullif(p_data->>'id','') is null then raise exception 'La orden requiere un UUID estable'; end if;
  order_id:=(p_data->>'id')::uuid; ids:=rcfito_private.application_stage_ids(p_stage_ids); products:=rcfito_private.normalized_application_products(p_products);
  if jsonb_typeof(p_data->'water_l_ha') is distinct from 'number' then raise exception 'Capture gasto de agua por hectárea'; end if;
  water:=(p_data->>'water_l_ha')::numeric(12,4); indicated:=(p_data->>'indicated_date')::date; scheduled:=(p_data->>'scheduled_date')::date;
  if water<=0 or indicated is null or scheduled is null or scheduled<indicated then raise exception 'Revise gasto de agua y fechas de indicación/programación'; end if;
  signature:=jsonb_build_object('project_id',(p_data->>'project_id')::uuid,'field_id',(p_data->>'field_id')::uuid,'crop_id',(p_data->>'crop_id')::uuid,'method_id',(p_data->>'method_id')::uuid,'indicated_date',indicated,'scheduled_date',scheduled,'water_l_ha',water,'observations',coalesce(p_data->>'observations',''),'stage_ids',to_jsonb(ids),'products',products);
  perform pg_advisory_xact_lock(hashtextextended('rcfito-order:'||order_id::text,0));
  select * into previous from public.application_orders where id=order_id for update;
  if found then
    if previous.request_signature=signature then return order_id; end if;
    raise exception 'El UUID ya corresponde a otra indicación';
  end if;
  -- Stage transitions acquire the stage before their project: keep that order.
  perform 1 from public.sowing_stages where id=any(ids) order by id for update;
  project:=rcfito_private.open_project((p_data->>'project_id')::uuid);
  if project.status<>'active' then raise exception 'La temporada debe estar activa para indicar aplicaciones'; end if;
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
  end loop;
  -- Validate every product before persisting any row.
  for item in select value from jsonb_array_elements(products) loop perform rcfito_private.application_product_snapshot((item->>'product_id')::uuid); end loop;
  perform set_config('rcfito.application_write','create',true);
  insert into public.application_orders(id,project_id,field_id,crop_id,method_id,indicated_date,scheduled_date,water_l_ha,observations,project_name,field_name,crop_name,method_name,agricultural_unit_name,season,request_signature,created_by)
  values(order_id,project.id,(p_data->>'field_id')::uuid,(p_data->>'crop_id')::uuid,(p_data->>'method_id')::uuid,indicated,scheduled,water,coalesce(p_data->>'observations',''),project.name,field_name,crop_name,method_name,project.agricultural_unit_name,project.season,signature,auth.uid());
  for item in select value from jsonb_array_elements(products) loop
    snapshot:=rcfito_private.application_product_snapshot((item->>'product_id')::uuid);
    insert into public.application_order_products(order_id,product_id,dose,product_name,unit,ingredients_snapshot)
    values(order_id,(item->>'product_id')::uuid,(item->>'dose')::numeric,snapshot->>'product_name',snapshot->>'unit',snapshot->'ingredients_snapshot');
  end loop;
  insert into public.application_targets(order_id,stage_id,lot_name,subdivision_name,stage_number,crop_name,variety_name,area_ha)
  select order_id,s.id,l.name,d.name,s.stage_number,s.crop_name,s.variety_name,s.area_ha from public.sowing_stages s join public.lot_subdivisions d on d.id=s.subdivision_id join public.project_lots l on l.id=d.lot_id where s.id=any(ids);
  perform set_config('rcfito.application_write',coalesce(previous_scope,''),true);
  return order_id;
end $$;

create function rcfito_private.perform_application_targets(p_order_id uuid,p_target_ids uuid[],p_data jsonb) returns void language plpgsql security definer set search_path='' as $$
declare ids uuid[]; application public.application_orders; target public.application_targets; stage record;
  changed boolean; differs boolean; actual date; water numeric(12,4); products jsonb; original_products jsonb; item jsonb; snapshot jsonb; signature jsonb;
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
  select jsonb_agg(jsonb_build_object('product_id',product_id,'dose',dose) order by product_id) into original_products from public.application_order_products where order_id=p_order_id;
  if changed then
    if jsonb_typeof(p_data->'water_l_ha') is distinct from 'number' then raise exception 'Capture el gasto de agua'; end if;
    water:=(p_data->>'water_l_ha')::numeric(12,4);
    if water<=0 then raise exception 'El gasto de agua debe ser mayor que cero'; end if;
    products:=rcfito_private.normalized_application_products(p_data->'products');
  else
    water:=application.water_l_ha;
    products:=original_products;
  end if;
  differs:=water is distinct from application.water_l_ha or products is distinct from original_products;
  signature:=jsonb_build_object('actual_date',actual,'equipment',coalesce(p_data->>'equipment',''),'applicator',coalesce(p_data->>'applicator',''),
    'observations',coalesce(p_data->>'observations',''),'changed',changed,'water_l_ha',water,'products',products);
  if (select count(*) from public.application_targets where order_id=p_order_id and id=any(ids))<>cardinality(ids) then raise exception 'Los destinos deben pertenecer a la orden'; end if;
  for target in select * from public.application_targets where id=any(ids) order by id for update loop
    if target.status='performed' and target.execution_signature=signature then continue; end if;
    if target.status<>'indicated' then raise exception 'Un destino ya tiene otro resultado definitivo'; end if;
    pending:=array_append(pending,target.id);
  end loop;
  -- A retry of an identical terminal request remains valid after later closure or deactivation.
  if cardinality(pending)=0 then return; end if;
  perform 1 from public.sowing_stages s join public.application_targets t on t.stage_id=s.id where t.id=any(pending) order by s.id for update of s;
  perform rcfito_private.open_project(application.project_id);
  if not exists(select 1 from public.sowing_projects where id=application.project_id and status='active') then raise exception 'El proyecto debe estar activo'; end if;
  if actual<application.indicated_date or actual>(now() at time zone 'America/Mazatlan')::date then raise exception 'La fecha de realización debe estar entre la indicación y hoy'; end if;
  for stage in select s.*,d.active subdivision_active,l.active lot_active from public.sowing_stages s join public.lot_subdivisions d on d.id=s.subdivision_id join public.project_lots l on l.id=d.lot_id join public.application_targets t on t.stage_id=s.id where t.id=any(pending) order by s.id for update of s loop
    if stage.status<>'planted' or not stage.subdivision_active or not stage.lot_active then raise exception 'El destino debe conservar su etapa sembrada vigente'; end if;
    if actual<stage.actual_sowing_date then raise exception 'La realización no puede preceder a la siembra'; end if;
  end loop;
  for item in select value from jsonb_array_elements(products) loop perform rcfito_private.application_product_snapshot((item->>'product_id')::uuid,p_order_id); end loop;
  perform set_config('rcfito.application_write','perform',true);
  for target in select * from public.application_targets where id=any(pending) order by id loop
    update public.application_targets set status='performed',actual_date=actual,actual_water_l_ha=water,equipment=signature->>'equipment',applicator=signature->>'applicator',actual_observations=signature->>'observations',has_changes=differs,execution_signature=signature where id=target.id;
    for item in select value from jsonb_array_elements(products) loop
      snapshot:=rcfito_private.application_product_snapshot((item->>'product_id')::uuid,p_order_id);
      insert into public.application_actual_products(target_id,product_id,dose,product_name,unit,ingredients_snapshot)
      values(target.id,(item->>'product_id')::uuid,(item->>'dose')::numeric,snapshot->>'product_name',snapshot->>'unit',snapshot->'ingredients_snapshot');
    end loop;
  end loop;
  perform set_config('rcfito.application_write',coalesce(previous_scope,''),true);
end $$;

create function rcfito_private.cancel_application_targets(p_order_id uuid,p_target_ids uuid[],p_reason text) returns void language plpgsql security definer set search_path='' as $$
declare ids uuid[]; target public.application_targets; reason text:=btrim(p_reason); previous_scope text:=current_setting('rcfito.application_write',true);
begin
  if auth.uid() is null then raise exception 'Se requiere una sesión' using errcode='42501'; end if;
  perform rcfito_private.require_admin();
  ids:=rcfito_private.application_stage_ids(p_target_ids);
  if reason is null or reason='' then raise exception 'Capture el motivo de cancelación'; end if;
  perform 1 from public.application_orders where id=p_order_id for update;
  if not found then raise exception 'Orden inexistente'; end if;
  if (select count(*) from public.application_targets where order_id=p_order_id and id=any(ids))<>cardinality(ids) then raise exception 'Los destinos deben pertenecer a la orden'; end if;
  for target in select * from public.application_targets where id=any(ids) order by id for update loop
    if target.status='cancelled' and target.cancellation_reason=reason then continue; end if;
    if target.status<>'indicated' then raise exception 'Un destino ya tiene otro resultado definitivo'; end if;
  end loop;
  perform set_config('rcfito.application_write','cancel',true);
  update public.application_targets set status='cancelled',cancellation_reason=reason,cancelled_at=now() where id=any(ids) and status='indicated';
  perform set_config('rcfito.application_write',coalesce(previous_scope,''),true);
end $$;

create function rcfito_private.save_sowing_group(p_data jsonb,p_stage_ids uuid[]) returns uuid language plpgsql security definer set search_path='' as $$
declare v_group_id uuid; ids uuid[]; is_active boolean; signature jsonb; existing public.sowing_groups; project public.sowing_projects; stage record;
  label text; field_name text; crop_name text; previous_scope text:=current_setting('rcfito.application_write',true);
begin
  if auth.uid() is null then raise exception 'Se requiere una sesión' using errcode='42501'; end if;
  perform rcfito_private.require_admin();
  if p_data is null or jsonb_typeof(p_data) is distinct from 'object' then raise exception 'Capture un grupo válido'; end if;
  v_group_id:=coalesce(nullif(p_data->>'id','')::uuid,gen_random_uuid()); label:=btrim(p_data->>'name');
  if label is null or label='' then raise exception 'Capture el nombre del grupo'; end if;
  if p_data ? 'active' and jsonb_typeof(p_data->'active') is distinct from 'boolean' then raise exception 'Estado de grupo inválido'; end if;
  is_active:=coalesce((p_data->>'active')::boolean,true); ids:=rcfito_private.application_stage_ids(p_stage_ids,not is_active);
  signature:=jsonb_build_object('project_id',(p_data->>'project_id')::uuid,'field_id',(p_data->>'field_id')::uuid,'crop_id',(p_data->>'crop_id')::uuid,'name',label,'active',is_active,'stage_ids',to_jsonb(ids));
  perform pg_advisory_xact_lock(hashtextextended('rcfito-group:'||v_group_id::text,0));
  select * into existing from public.sowing_groups where id=v_group_id for update;
  if found then
    if existing.request_signature=signature then return v_group_id; end if;
    if (existing.project_id,existing.field_id,existing.crop_id) is distinct from ((p_data->>'project_id')::uuid,(p_data->>'field_id')::uuid,(p_data->>'crop_id')::uuid) then raise exception 'El grupo conserva su proyecto, campo y cultivo'; end if;
  end if;
  perform 1 from public.sowing_stages where id=any(ids) order by id for update;
  project:=rcfito_private.open_project((p_data->>'project_id')::uuid);
  if project.status<>'active' then raise exception 'El proyecto debe estar activo'; end if;
  if exists(select 1 from public.sowing_groups g where g.project_id=project.id and g.field_id=(p_data->>'field_id')::uuid and g.id<>v_group_id and rcfito_private.normalized_group_name(g.name)=rcfito_private.normalized_group_name(label)) then raise exception 'Ya existe un grupo con ese nombre en el campo'; end if;
  select name into field_name from public.fields where id=(p_data->>'field_id')::uuid and agricultural_unit_id=project.agricultural_unit_id and active;
  if not found then raise exception 'El campo debe pertenecer a la agrícola y estar activo'; end if;
  select name into crop_name from public.crops where id=(p_data->>'crop_id')::uuid and active;
  if not found then raise exception 'El cultivo debe estar activo'; end if;
  if (select count(*) from public.sowing_stages where id=any(ids))<>cardinality(ids) then raise exception 'Etapas inexistentes'; end if;
  for stage in select s.*,d.active subdivision_active,l.active lot_active,l.project_id,l.field_id from public.sowing_stages s join public.lot_subdivisions d on d.id=s.subdivision_id join public.project_lots l on l.id=d.lot_id where s.id=any(ids) order by s.id for update of s loop
    if stage.status<>'planted' or not stage.subdivision_active or not stage.lot_active or stage.project_id<>project.id or stage.field_id<>(p_data->>'field_id')::uuid or stage.crop_id<>(p_data->>'crop_id')::uuid then raise exception 'Los miembros deben ser etapas sembradas del mismo campo y cultivo'; end if;
  end loop;
  perform set_config('rcfito.application_write','group',true);
  insert into public.sowing_groups(id,project_id,field_id,crop_id,name,active,project_name,field_name,crop_name,request_signature)
  values(v_group_id,project.id,(p_data->>'field_id')::uuid,(p_data->>'crop_id')::uuid,label,is_active,project.name,field_name,crop_name,signature)
  on conflict(id) do update set name=excluded.name,active=excluded.active,request_signature=excluded.request_signature;
  update public.sowing_group_members m set active=false,retired_at=now() where m.group_id=v_group_id and m.active and not(m.stage_id=any(ids));
  insert into public.sowing_group_members(group_id,stage_id) select v_group_id,unnest(ids)
  on conflict(group_id,stage_id) do update set active=true,retired_at=null;
  perform set_config('rcfito.application_write',coalesce(previous_scope,''),true);
  return v_group_id;
end $$;

-- Additive guards also protect existing direct-admin API transitions.
create function rcfito_private.guard_application_closure() returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if new.status='closed' and old.status<>'closed' then
    if tg_table_name='sowing_stages' then
      if exists(select 1 from public.application_targets where stage_id=new.id and status='indicated') then raise exception 'Cancele o realice las aplicaciones indicadas antes de cerrar la etapa'; end if;
      if new.end_date<(select max(actual_date) from public.application_targets where stage_id=new.id and status='performed') then raise exception 'El cierre no puede preceder a la última aplicación realizada'; end if;
    else
      if exists(select 1 from public.application_targets t join public.application_orders o on o.id=t.order_id where o.project_id=new.id and t.status='indicated') then raise exception 'Cancele o realice las aplicaciones indicadas antes de cerrar la temporada'; end if;
    end if;
  end if;
  return new;
end $$;
create trigger guard_applications_before_stage_close before update of status,end_date on public.sowing_stages for each row execute function rcfito_private.guard_application_closure();
create trigger guard_applications_before_project_close before update of status on public.sowing_projects for each row execute function rcfito_private.guard_application_closure();
create function rcfito_private.guard_used_product_unit() returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if new.unit<>old.unit and (exists(select 1 from public.application_order_products where product_id=old.id) or exists(select 1 from public.application_actual_products where product_id=old.id)) then raise exception 'La unidad de un producto usado en aplicaciones no puede cambiar'; end if;
  return new;
end $$;
create trigger guard_used_product_unit before update of unit on public.products for each row execute function rcfito_private.guard_used_product_unit();

create view public.application_stage_counts with(security_invoker=true) as
select stage_id,count(*) filter(where status='indicated') indicated_count,count(*) filter(where status='performed') performed_count,count(*) filter(where status='cancelled') cancelled_count from public.application_targets group by stage_id;
revoke all on public.application_stage_counts from public,anon,authenticated;
grant select on public.application_stage_counts to authenticated;

create function public.create_application_order(p_data jsonb,p_stage_ids uuid[],p_products jsonb) returns uuid language sql security invoker set search_path='' as $$select rcfito_private.create_application_order(p_data,p_stage_ids,p_products)$$;
create function public.perform_application_targets(p_order_id uuid,p_target_ids uuid[],p_data jsonb) returns void language sql security invoker set search_path='' as $$select rcfito_private.perform_application_targets(p_order_id,p_target_ids,p_data)$$;
create function public.cancel_application_targets(p_order_id uuid,p_target_ids uuid[],p_reason text) returns void language sql security invoker set search_path='' as $$select rcfito_private.cancel_application_targets(p_order_id,p_target_ids,p_reason)$$;
create function public.save_sowing_group(p_data jsonb,p_stage_ids uuid[]) returns uuid language sql security invoker set search_path='' as $$select rcfito_private.save_sowing_group(p_data,p_stage_ids)$$;
do $$ declare f regprocedure; begin
  for f in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='rcfito_private' and p.proname in ('next_application_folio','normalized_group_name','application_stage_ids','normalized_application_products','application_product_snapshot','guard_application_write','create_application_order','perform_application_targets','cancel_application_targets','save_sowing_group','guard_application_closure','guard_used_product_unit') loop
    execute format('revoke all on function %s from public,anon,authenticated',f);
  end loop;
  for f in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','rcfito_private') and p.proname in ('create_application_order','perform_application_targets','cancel_application_targets','save_sowing_group') loop
    execute format('revoke all on function %s from public,anon',f);
    execute format('grant execute on function %s to authenticated',f);
  end loop;
end $$;
-- Invoker triggers on initial tables require execution of trigger bodies only;
-- helper table SELECT remains subject to the caller's RLS.
grant execute on function rcfito_private.guard_application_closure(),rcfito_private.guard_used_product_unit() to authenticated;
revoke all on sequence rcfito_private.application_folio_seq from public,anon,authenticated;

notify pgrst,'reload schema';
commit;
