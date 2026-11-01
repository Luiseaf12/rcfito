-- Captura asistida: mensaje fuente y número de aplicación propio de cada etapa.
-- Aditiva: conserva indicaciones, notas, destinos, estados y sus identificadores.
begin;

alter table public.application_orders add column source_text text not null default '' check(char_length(source_text)<=20000);
alter table public.application_targets add column application_number integer;

-- La guarda histórica se suspende únicamente durante este backfill transaccional.
-- El ALTER mantiene el bloqueo exclusivo hasta COMMIT; no hay ventana de escritura.
alter table public.application_targets disable trigger rcfito_application_write;
with numbered as (
  select t.id,row_number() over(partition by t.stage_id order by o.created_at,substring(o.folio from 5)::bigint,t.id)::integer as number
  from public.application_targets t join public.application_orders o on o.id=t.order_id
)
update public.application_targets t set application_number=n.number from numbered n where n.id=t.id;
alter table public.application_targets enable trigger rcfito_application_write;
alter table public.application_targets alter column application_number set not null;
alter table public.application_targets add constraint application_targets_positive_number check(application_number>0);
alter table public.application_targets add constraint application_targets_stage_number_unique unique(stage_id,application_number);

create function rcfito_private.guard_application_number() returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if new.application_number is distinct from old.application_number then raise exception 'El número histórico de aplicación no se modifica'; end if;
  return new;
end $$;
revoke all on function rcfito_private.guard_application_number() from public,anon,authenticated;
create trigger rcfito_application_number before update of application_number on public.application_targets for each row execute function rcfito_private.guard_application_number();

create or replace function rcfito_private.create_application_order(p_data jsonb,p_stage_ids uuid[],p_products jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare order_id uuid; project public.sowing_projects; ids uuid[]; products jsonb; signature jsonb; previous public.application_orders;
  item jsonb; snapshot jsonb; stage record; water numeric(12,4); indicated date; scheduled date; field_name text; crop_name text; method_name text;
  requested_number integer; number_value numeric; next_number bigint; source_text text:='';
  previous_scope text:=current_setting('rcfito.application_write',true);
begin
  if auth.uid() is null then raise exception 'Inicia sesión' using errcode='42501'; end if;
  perform rcfito_private.require_admin();
  if p_data is null or jsonb_typeof(p_data) is distinct from 'object' or nullif(p_data->>'id','') is null then raise exception 'La orden requiere un UUID estable'; end if;
  order_id:=(p_data->>'id')::uuid; ids:=rcfito_private.application_stage_ids(p_stage_ids); products:=rcfito_private.normalized_application_products(p_products);
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
  if jsonb_typeof(p_data->'water_l_ha') is distinct from 'number' then raise exception 'Capture gasto de agua por hectárea'; end if;
  water:=(p_data->>'water_l_ha')::numeric(12,4); indicated:=(p_data->>'indicated_date')::date; scheduled:=(p_data->>'scheduled_date')::date;
  if water<=0 or indicated is null or scheduled is null or scheduled<indicated then raise exception 'Revise gasto de agua y fechas de indicación/programación'; end if;
  signature:=jsonb_build_object('project_id',(p_data->>'project_id')::uuid,'field_id',(p_data->>'field_id')::uuid,'crop_id',(p_data->>'crop_id')::uuid,'method_id',(p_data->>'method_id')::uuid,'indicated_date',indicated,'scheduled_date',scheduled,'water_l_ha',water,'observations',coalesce(p_data->>'observations',''),'stage_ids',to_jsonb(ids),'products',products);
  -- Mantener idéntica la firma de entradas antiguas sin estos campos.
  if requested_number is not null then signature:=signature||jsonb_build_object('application_number',requested_number); end if;
  if source_text<>'' then signature:=signature||jsonb_build_object('source_text',source_text); end if;
  perform pg_advisory_xact_lock(hashtextextended('rcfito-order:'||order_id::text,0));
  select * into previous from public.application_orders where id=order_id for update;
  if found then
    if previous.request_signature=signature then return order_id; end if;
    raise exception 'El UUID ya corresponde a otra indicación';
  end if;
  -- Bloquear las etapas en orden serializa número explícito y max+1 concurrentes.
  -- Se conserva el orden etapa -> proyecto usado por las transiciones existentes.
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
    select coalesce(requested_number::bigint,coalesce(max(t.application_number),0)::bigint+1) into next_number from public.application_targets t where t.stage_id=stage.id;
    if next_number>2147483647 then raise exception 'La numeración de esta etapa alcanzó su límite'; end if;
    if exists(select 1 from public.application_targets t where t.stage_id=stage.id and t.application_number=next_number) then raise exception 'La aplicación % ya está registrada en una de las etapas seleccionadas',next_number; end if;
  end loop;
  for item in select value from jsonb_array_elements(products) loop perform rcfito_private.application_product_snapshot((item->>'product_id')::uuid); end loop;
  perform set_config('rcfito.application_write','create',true);
  insert into public.application_orders(id,project_id,field_id,crop_id,method_id,indicated_date,scheduled_date,water_l_ha,observations,source_text,project_name,field_name,crop_name,method_name,agricultural_unit_name,season,request_signature,created_by)
  values(order_id,project.id,(p_data->>'field_id')::uuid,(p_data->>'crop_id')::uuid,(p_data->>'method_id')::uuid,indicated,scheduled,water,coalesce(p_data->>'observations',''),source_text,project.name,field_name,crop_name,method_name,project.agricultural_unit_name,project.season,signature,auth.uid());
  for item in select value from jsonb_array_elements(products) loop
    snapshot:=rcfito_private.application_product_snapshot((item->>'product_id')::uuid);
    insert into public.application_order_products(order_id,product_id,dose,product_name,unit,ingredients_snapshot)
    values(order_id,(item->>'product_id')::uuid,(item->>'dose')::numeric,snapshot->>'product_name',snapshot->>'unit',snapshot->'ingredients_snapshot');
  end loop;
  insert into public.application_targets(order_id,stage_id,application_number,lot_name,subdivision_name,stage_number,crop_name,variety_name,area_ha)
  select order_id,s.id,coalesce(requested_number,(select coalesce(max(t.application_number),0)+1 from public.application_targets t where t.stage_id=s.id)),l.name,d.name,s.stage_number,s.crop_name,s.variety_name,s.area_ha
  from public.sowing_stages s join public.lot_subdivisions d on d.id=s.subdivision_id join public.project_lots l on l.id=d.lot_id where s.id=any(ids);
  perform set_config('rcfito.application_write',coalesce(previous_scope,''),true);
  return order_id;
end $$;

commit;
