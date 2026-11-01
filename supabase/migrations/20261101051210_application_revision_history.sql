-- Revisiones auditables sin reescribir la indicación original ni los conteos.
begin;

alter table public.application_orders add column revision integer not null default 0 check(revision>=0);
alter table public.application_targets add column indication_change_id uuid;
alter table public.application_targets add column correction_version integer not null default 0 check(correction_version>=0);

create table public.application_changes(
  id uuid primary key,
  order_id uuid not null references public.application_orders on delete restrict,
  target_id uuid references public.application_targets on delete restrict,
  kind text not null check(kind in ('indication','performance')),
  version integer not null check(version>0),
  target_ids uuid[] not null check(cardinality(target_ids)>0),
  reason text not null check(btrim(reason)<>'' and char_length(reason)<=4000),
  changed_by uuid not null references auth.users on delete restrict,
  changed_by_name text not null,
  changed_at timestamptz not null default now(),
  "before" jsonb not null check(jsonb_typeof("before")='object'),
  "after" jsonb not null check(jsonb_typeof("after")='object'),
  request_signature jsonb not null,
  check((kind='indication' and target_id is null) or (kind='performance' and target_id is not null and target_ids=array[target_id]))
);
create unique index application_changes_indication_version on public.application_changes(order_id,version) where kind='indication';
create unique index application_changes_performance_version on public.application_changes(target_id,version) where kind='performance';
create index application_changes_order_idx on public.application_changes(order_id,changed_at);
create index application_changes_actor_idx on public.application_changes(changed_by);
create table public.application_change_products(
  change_id uuid not null references public.application_changes on delete restrict,
  phase text not null check(phase in ('before','after')),
  product_id uuid not null references public.products on delete restrict,
  snapshot jsonb not null check(jsonb_typeof(snapshot)='object'),
  primary key(change_id,phase,product_id)
);
create index application_change_products_product_idx on public.application_change_products(product_id);
alter table public.application_targets add constraint application_targets_indication_change_fk foreign key(indication_change_id) references public.application_changes on delete restrict;
create index application_targets_indication_change_idx on public.application_targets(indication_change_id);
alter table public.application_changes enable row level security;
alter table public.application_change_products enable row level security;
revoke all on public.application_changes,public.application_change_products from public,anon,authenticated;
-- La firma interna no forma parte del contrato de lectura REST.
grant select(id,order_id,target_id,kind,version,target_ids,reason,changed_by,changed_by_name,changed_at,"before","after") on public.application_changes to authenticated;
grant select on public.application_change_products to authenticated;
create policy application_changes_assigned on public.application_changes for select to authenticated using(exists(select 1 from public.application_orders o where o.id=order_id));
create policy application_change_products_assigned on public.application_change_products for select to authenticated using(exists(select 1 from public.application_changes c where c.id=change_id));
do $$ begin if exists(select 1 from pg_roles where rolname='service_role') then
  revoke insert,update,delete,truncate on public.application_changes,public.application_change_products from service_role;
end if; end $$;

create function rcfito_private.guard_application_change() returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if tg_op<>'INSERT' or current_setting('rcfito.application_write',true) not in ('revise','correct') or current_setting('rcfito.application_write',true) is null then raise exception 'El historial de cambios solo se agrega mediante RPC'; end if;
  return new;
end $$;
create trigger rcfito_application_changes before insert or update or delete on public.application_changes for each row execute function rcfito_private.guard_application_change();
create trigger rcfito_application_change_products before insert or update or delete on public.application_change_products for each row execute function rcfito_private.guard_application_change();

-- Rechazar precisión excesiva antes del cast evita redondeos silenciosos.
create or replace function rcfito_private.normalized_application_products(p_products jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare item jsonb; pid uuid; amount numeric; result jsonb:='[]'; seen uuid[]:='{}';
begin
  if p_products is null or jsonb_typeof(p_products) is distinct from 'array' or jsonb_array_length(p_products)<1 then raise exception 'Capture al menos un producto'; end if;
  for item in select value from jsonb_array_elements(p_products) loop
    if jsonb_typeof(item) is distinct from 'object' or jsonb_typeof(item->'dose') is distinct from 'number' or nullif(item->>'product_id','') is null then raise exception 'Producto y dosis deben ser válidos'; end if;
    pid:=(item->>'product_id')::uuid; amount:=(item->>'dose')::numeric;
    if amount<=0 then raise exception 'La dosis debe ser mayor que cero'; end if;
    if amount>99999999.999999 or round(amount,6)<>amount then raise exception 'La dosis admite hasta seis decimales sin redondeo'; end if;
    if pid=any(seen) then raise exception 'No repita un producto en la mezcla'; end if;
    seen:=array_append(seen,pid);
    result:=result||jsonb_build_array(jsonb_build_object('product_id',pid,'dose',amount));
  end loop;
  select jsonb_agg(value order by value->>'product_id') into result from jsonb_array_elements(result);
  return result;
end $$;
create function rcfito_private.application_water(p_value jsonb) returns numeric language plpgsql security invoker set search_path='' as $$
declare amount numeric;
begin
  if jsonb_typeof(p_value) is distinct from 'number' then raise exception 'Capture gasto de agua numérico por hectárea'; end if;
  amount:=(p_value#>>'{}')::numeric;
  if amount<=0 or amount>99999999.9999 or round(amount,4)<>amount then raise exception 'El agua debe ser positiva y admite hasta cuatro decimales sin redondeo'; end if;
  return amount;
end $$;
create function rcfito_private.application_version(p_value jsonb) returns integer language plpgsql security invoker set search_path='' as $$
declare amount numeric;
begin
  if jsonb_typeof(p_value) is distinct from 'number' then raise exception 'Capture una versión esperada válida'; end if;
  amount:=(p_value#>>'{}')::numeric;
  if amount<0 or amount>2147483646 or trunc(amount)<>amount then raise exception 'Capture una versión esperada válida'; end if;
  return amount::integer;
end $$;
create function rcfito_private.application_edit_trim(p_value text) returns text language sql immutable security invoker set search_path='' as $$
select regexp_replace(p_value,'^[[:space:]]+|[[:space:]]+$','','g')
$$;
create function rcfito_private.application_edit_date(p_value jsonb) returns date language plpgsql security invoker set search_path='' as $$
begin
  if jsonb_typeof(p_value) is distinct from 'string' or (p_value#>>'{}') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then raise exception 'Capture una fecha válida en formato año-mes-día'; end if;
  return (p_value#>>'{}')::date;
end $$;
create function rcfito_private.application_edit_data(p_data jsonb,p_keys text[]) returns void language plpgsql security invoker set search_path='' as $$
begin
  if p_data is null or jsonb_typeof(p_data) is distinct from 'object' or nullif(p_data->>'id','') is null then raise exception 'El cambio requiere un UUID estable'; end if;
  if exists(select 1 from jsonb_object_keys(p_data) x(key) where not(key=any(p_keys))) then raise exception 'La revisión contiene campos no editables'; end if;
  if jsonb_typeof(p_data->'reason') is distinct from 'string' or rcfito_private.application_edit_trim(p_data->>'reason')='' or char_length(p_data->>'reason')>4000 then raise exception 'Capture un motivo obligatorio de hasta 4000 caracteres'; end if;
  if p_data ? 'observations' and (jsonb_typeof(p_data->'observations') is distinct from 'string' or char_length(p_data->>'observations')>4000) then raise exception 'La nota admite hasta 4000 caracteres'; end if;
  if p_data ? 'equipment' and jsonb_typeof(p_data->'equipment') is distinct from 'string' then raise exception 'Capture equipo como texto'; end if;
  if p_data ? 'applicator' and jsonb_typeof(p_data->'applicator') is distinct from 'string' then raise exception 'Capture aplicador como texto'; end if;
end $$;
create function rcfito_private.application_product_inputs(p_products jsonb) returns jsonb language sql immutable security invoker set search_path='' as $$
select coalesce(jsonb_agg(jsonb_build_object('product_id',x->'product_id','dose',x->'dose') order by x->>'product_id'),'[]'::jsonb) from jsonb_array_elements(p_products) x
$$;
create function rcfito_private.application_snapshot_products(p_products jsonb,p_retained jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare item jsonb; snapshot jsonb; result jsonb:='[]';
begin
  for item in select value from jsonb_array_elements(rcfito_private.normalized_application_products(p_products)) loop
    select value into snapshot from jsonb_array_elements(p_retained) where value->>'product_id'=item->>'product_id';
    if not found then snapshot:=rcfito_private.application_product_snapshot((item->>'product_id')::uuid); end if;
    result:=result||jsonb_build_array(jsonb_build_object('product_id',item->'product_id','dose',item->'dose','product_name',snapshot->'product_name','unit',snapshot->'unit','ingredients_snapshot',coalesce(snapshot->'ingredients_snapshot','[]'::jsonb)));
  end loop;
  return result;
end $$;
create function rcfito_private.application_indication(p_target_id uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
declare target public.application_targets; application public.application_orders; result jsonb; products jsonb;
begin
  select * into target from public.application_targets where id=p_target_id;
  if not found then raise exception 'Destino inexistente'; end if;
  if target.indication_change_id is not null then
    select c."after" into result from public.application_changes c where c.id=target.indication_change_id and c.order_id=target.order_id and c.kind='indication' and target.id=any(c.target_ids);
    if not found then raise exception 'Falta la revisión histórica de la indicación'; end if;
    return result;
  end if;
  select * into application from public.application_orders where id=target.order_id;
  select jsonb_agg(jsonb_build_object('product_id',p.product_id,'dose',p.dose,'product_name',p.product_name,'unit',p.unit,'ingredients_snapshot',p.ingredients_snapshot) order by p.product_id) into products from public.application_order_products p where p.order_id=target.order_id;
  return jsonb_build_object('method_id',application.method_id,'method_name',application.method_name,'indicated_date',application.indicated_date,'scheduled_date',application.scheduled_date,'water_l_ha',application.water_l_ha,'observations',application.observations,'products',products);
end $$;
create function rcfito_private.application_performance(p_target_id uuid) returns jsonb language sql security invoker set search_path='' as $$
select jsonb_build_object('actual_date',t.actual_date,'water_l_ha',t.actual_water_l_ha,'equipment',t.equipment,'applicator',t.applicator,'observations',t.actual_observations,'has_changes',t.has_changes,'products',
  (select jsonb_agg(jsonb_build_object('product_id',p.product_id,'dose',p.dose,'product_name',p.product_name,'unit',p.unit,'ingredients_snapshot',p.ingredients_snapshot) order by p.product_id) from public.application_actual_products p where p.target_id=t.id))
from public.application_targets t where t.id=p_target_id
$$;
create function rcfito_private.store_application_change_products(p_id uuid,p_before jsonb,p_after jsonb) returns void language plpgsql security invoker set search_path='' as $$
begin
  insert into public.application_change_products(change_id,phase,product_id,snapshot)
    select p_id,'before',(x->>'product_id')::uuid,x from jsonb_array_elements(p_before->'products') x
    union all select p_id,'after',(x->>'product_id')::uuid,x from jsonb_array_elements(p_after->'products') x;
end $$;

create or replace function rcfito_private.guard_application_write() returns trigger language plpgsql security invoker set search_path='' as $$
declare mode text:=current_setting('rcfito.application_write',true);
begin
  if tg_op='DELETE' then
    if tg_table_name='application_actual_products' and mode='correct' and exists(select 1 from public.application_targets t join public.application_changes c on c.target_id=t.id and c.kind='performance' and c.version=t.correction_version where t.id=old.target_id and t.status='performed') then return old; end if;
    raise exception 'El historial de aplicaciones y grupos no se elimina';
  end if;
  if tg_table_name='application_orders' then
    if tg_op='UPDATE' and mode='revise' and new.revision=old.revision+1 and (to_jsonb(new)-'revision')=(to_jsonb(old)-'revision') and exists(select 1 from public.application_changes c where c.order_id=old.id and c.kind='indication' and c.version=new.revision) then return new; end if;
    if mode is distinct from 'create' or tg_op<>'INSERT' or new.revision<>0 then raise exception 'La indicación original es inmutable y se guarda por RPC'; end if;
  elsif tg_table_name='application_order_products' then
    if mode is distinct from 'create' or tg_op<>'INSERT' then raise exception 'La indicación original es inmutable y se guarda por RPC'; end if;
  elsif tg_table_name='application_actual_products' then
    if mode not in ('perform','correct') or mode is null or tg_op<>'INSERT' or not exists(select 1 from public.application_targets where id=new.target_id and status='performed') then raise exception 'La realización solo se guarda por RPC'; end if;
  elsif tg_table_name='application_targets' then
    if tg_op='INSERT' then
      if mode is distinct from 'create' or new.status<>'indicated' or new.indication_change_id is not null or new.correction_version<>0 then raise exception 'El destino se crea indicado mediante RPC'; end if;
    else
      if mode='revise' and old.status='indicated' and new.status='indicated' and (to_jsonb(new)-'indication_change_id')=(to_jsonb(old)-'indication_change_id') and new.indication_change_id is distinct from old.indication_change_id and exists(select 1 from public.application_changes c where c.id=new.indication_change_id and c.kind='indication' and c.order_id=old.order_id and old.id=any(c.target_ids)) then return new; end if;
      if mode='correct' and old.status='performed' and new.status='performed' and new.correction_version=old.correction_version+1
        and (to_jsonb(new)-array['actual_date','actual_water_l_ha','equipment','applicator','actual_observations','has_changes','correction_version'])=(to_jsonb(old)-array['actual_date','actual_water_l_ha','equipment','applicator','actual_observations','has_changes','correction_version'])
        and exists(select 1 from public.application_changes c where c.kind='performance' and c.order_id=old.order_id and c.target_id=old.id and c.version=new.correction_version) then return new; end if;
      if old.status<>'indicated' then raise exception 'Un destino terminal conserva su historial'; end if;
      if (new.id,new.order_id,new.stage_id,new.application_number,new.lot_name,new.subdivision_name,new.stage_number,new.crop_name,new.variety_name,new.area_ha,new.created_at,new.indication_change_id,new.correction_version)
        is distinct from (old.id,old.order_id,old.stage_id,old.application_number,old.lot_name,old.subdivision_name,old.stage_number,old.crop_name,old.variety_name,old.area_ha,old.created_at,old.indication_change_id,old.correction_version) then raise exception 'El destino y sus snapshots son inmutables'; end if;
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

create function rcfito_private.revise_application_order(p_data jsonb,p_products jsonb) returns uuid language plpgsql security definer set search_path='' as $$
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
  water:=rcfito_private.application_water(p_data->'water_l_ha'); method_id:=(p_data->>'method_id')::uuid;
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
  if method_id=(before_snapshot->>'method_id')::uuid then method_name:=before_snapshot->>'method_name';
  else select name into method_name from public.application_methods where id=method_id and active; if not found then raise exception 'Seleccione un medio de aplicación activo'; end if; end if;
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

create function rcfito_private.correct_application_target(p_data jsonb,p_products jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare change_id uuid; target_id uuid; order_id uuid; expected integer; application public.application_orders; target public.application_targets;
  previous public.application_changes; before_snapshot jsonb; after_snapshot jsonb; indication jsonb; normalized jsonb; products jsonb; signature jsonb;
  actual date; water numeric; differs boolean; stage public.sowing_stages; actor_name text;
  previous_scope text:=current_setting('rcfito.application_write',true);
begin
  if auth.uid() is null then raise exception 'Inicia sesión' using errcode='42501'; end if;
  perform rcfito_private.require_admin();
  perform rcfito_private.application_edit_data(p_data,array['id','target_id','expected_version','actual_date','water_l_ha','equipment','applicator','observations','reason']);
  change_id:=(p_data->>'id')::uuid; target_id:=(p_data->>'target_id')::uuid; expected:=rcfito_private.application_version(p_data->'expected_version');
  normalized:=rcfito_private.normalized_application_products(p_products); water:=rcfito_private.application_water(p_data->'water_l_ha'); actual:=rcfito_private.application_edit_date(p_data->'actual_date');
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
  if changed then supplied_products:=rcfito_private.normalized_application_products(p_data->'products'); perform rcfito_private.application_water(p_data->'water_l_ha'); end if;
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

create or replace function rcfito_private.guard_used_product_unit() returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if new.unit<>old.unit and (exists(select 1 from public.application_order_products where product_id=old.id) or exists(select 1 from public.application_actual_products where product_id=old.id) or exists(select 1 from public.application_change_products where product_id=old.id)) then raise exception 'La unidad de un producto usado en aplicaciones no puede cambiar'; end if;
  return new;
end $$;

create function public.revise_application_order(p_data jsonb,p_products jsonb) returns uuid language sql security invoker set search_path='' as $$ select rcfito_private.revise_application_order(p_data,p_products) $$;
create function public.correct_application_target(p_data jsonb,p_products jsonb) returns uuid language sql security invoker set search_path='' as $$ select rcfito_private.correct_application_target(p_data,p_products) $$;
do $$ declare f regprocedure; begin
  for f in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='rcfito_private' and p.proname in ('guard_application_change','application_water','application_version','application_edit_trim','application_edit_date','application_edit_data','application_product_inputs','application_snapshot_products','application_indication','application_performance','store_application_change_products','revise_application_order','correct_application_target') loop execute format('revoke all on function %s from public,anon,authenticated',f); end loop;
  for f in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','rcfito_private') and p.proname in ('revise_application_order','correct_application_target') loop
    execute format('revoke all on function %s from public,anon',f);
    execute format('grant execute on function %s to authenticated',f);
  end loop;
end $$;

notify pgrst,'reload schema';
commit;
