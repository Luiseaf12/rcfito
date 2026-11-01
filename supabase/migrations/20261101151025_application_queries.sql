-- Consultas tipadas de solo lectura. Las filas de negocio siempre pasan por RLS.
begin;

-- Invalidación conservadora y durable: una escritura invalida todos los resultados.
-- El UUID no revela conteos y el sello público se liga además al usuario/permisos.
create table rcfito_private.application_query_revision(
  singleton boolean primary key default true check(singleton),
  revision uuid not null default gen_random_uuid()
);
insert into rcfito_private.application_query_revision(singleton) values(true);
alter table rcfito_private.application_query_revision enable row level security;
revoke all on rcfito_private.application_query_revision from public,anon,authenticated;
grant select on rcfito_private.application_query_revision to authenticated;
create policy active_query_revision on rcfito_private.application_query_revision for select to authenticated
  using(rcfito_private.is_active_user());

create function rcfito_private.bump_application_query_revision() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  update rcfito_private.application_query_revision set revision=gen_random_uuid() where singleton;
  return null;
end $$;
revoke all on function rcfito_private.bump_application_query_revision() from public,anon,authenticated;
do $$ declare t text; begin
  foreach t in array array['agricultural_units','fields','crops','varieties','products','product_ingredients','product_synonyms',
    'active_ingredients','ingredient_classifications','application_methods','profiles','user_agricultural_units',
    'sowing_projects','project_lots','lot_subdivisions','sowing_stages','application_orders','application_order_products',
    'application_targets','application_actual_products','application_changes','application_change_products'] loop
    execute format('create trigger rcfito_query_revision after insert or update or delete or truncate on public.%I for each statement execute function rcfito_private.bump_application_query_revision()',t);
  end loop;
end $$;

create function public.application_query_stamp() returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare result text;
begin
  if not rcfito_private.is_active_user() then raise exception 'La consulta requiere una cuenta activa' using errcode='42501'; end if;
  select md5(r.revision::text||':'||auth.uid()::text||':'||p.role||':'||
    coalesce((select string_agg(a.agricultural_unit_id::text,',' order by a.agricultural_unit_id)
      from public.user_agricultural_units a where a.user_id=auth.uid()),'')) into result
  from rcfito_private.application_query_revision r join public.profiles p on p.id=auth.uid() and p.active where r.singleton;
  if result is null then raise exception 'No se pudo comprobar el permiso de consulta' using errcode='42501'; end if;
  return jsonb_build_object('revision',result,'as_of',statement_timestamp());
end $$;

create function rcfito_private.application_query_term(p_text text) returns text language sql immutable strict security invoker set search_path='' as $$
  select btrim(regexp_replace(lower(regexp_replace(normalize(p_text,NFD),U&'[\0300-\036f]','','g')),'[^a-z0-9]+',' ','g'))
$$;

create function rcfito_private.application_query_date(p_text text) returns date language plpgsql immutable strict security invoker set search_path='' as $$
begin
  if p_text !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or to_char(p_text::date,'YYYY-MM-DD')<>p_text then return null; end if;
  return p_text::date;
exception when datetime_field_overflow or invalid_datetime_format then return null;
end $$;

create function rcfito_private.application_query_snapshot(p_snapshot jsonb) returns jsonb language sql immutable security invoker set search_path='' as $$
  select jsonb_strip_nulls(jsonb_build_object('indicated_date',p_snapshot->'indicated_date','scheduled_date',p_snapshot->'scheduled_date',
    'actual_date',p_snapshot->'actual_date','water_l_ha',p_snapshot->'water_l_ha','method_name',p_snapshot->'method_name',
    'equipment',left(p_snapshot->>'equipment',200),'applicator',left(p_snapshot->>'applicator',200),'observations',left(p_snapshot->>'observations',300),
    'product_count',jsonb_array_length(s.products),'products_truncated',jsonb_array_length(s.products)>10,
    'products',coalesce((select jsonb_agg(x.value order by x.value->>'product_id') from
      (select jsonb_build_object('product_id',p->'product_id','product_name',p->'product_name','unit',p->'unit','dose',p->'dose') value
       from jsonb_array_elements(s.products) p order by p->>'product_id' limit 10) x),'[]'::jsonb)))
  from (select case when jsonb_typeof(p_snapshot->'products')='array' then p_snapshot->'products' else '[]'::jsonb end products) s
$$;

-- Búsqueda exacta: una coincidencia parcial nunca se convierte en identidad.
-- Un catálogo común de productos es visible a todo usuario activo por contrato.
create function rcfito_private.application_query_candidates(p_kind text,p_term text,p_scope jsonb) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare result jsonb; term text:=rcfito_private.application_query_term(p_term);
begin
  if not rcfito_private.is_active_user() then raise exception 'La consulta requiere una cuenta activa' using errcode='42501'; end if;
  with candidates as (
    select a.id,a.name,'agricultural_unit'::text kind,null::text project_name,null::text season
      from public.agricultural_units a where p_kind='agricultural_unit'
        and (rcfito_private.application_query_term(a.name)=term or rcfito_private.application_query_term(a.code)=term)
    union all
    select p.id,p.name,'project',p.name,p.season from public.sowing_projects p where p_kind='project'
      and (p_scope->>'agricultural_unit_id' is null or p.agricultural_unit_id=(p_scope->>'agricultural_unit_id')::uuid)
      and rcfito_private.application_query_term(p.name)=term
    union all
    select f.id,f.name,'field',null,null from public.fields f where p_kind='field'
      and (p_scope->>'agricultural_unit_id' is null or f.agricultural_unit_id=(p_scope->>'agricultural_unit_id')::uuid)
      and (p_scope->>'project_id' is null or exists(select 1 from public.project_lots l where l.field_id=f.id and l.project_id=(p_scope->>'project_id')::uuid))
      and (rcfito_private.application_query_term(f.name)=term or rcfito_private.application_query_term(f.code)=term)
    union all
    select l.id,l.name,'lot',p.name,p.season from public.project_lots l join public.sowing_projects p on p.id=l.project_id where p_kind='lot'
      and (p_scope->>'agricultural_unit_id' is null or p.agricultural_unit_id=(p_scope->>'agricultural_unit_id')::uuid)
      and (p_scope->>'project_id' is null or p.id=(p_scope->>'project_id')::uuid)
      and (p_scope->>'field_id' is null or l.field_id=(p_scope->>'field_id')::uuid)
      and (rcfito_private.application_query_term(l.name)=term or rcfito_private.application_query_term(l.code)=term)
    union all
    select p.id,p.name,'product',null,null from public.products p where p_kind='product'
      and (rcfito_private.application_query_term(p.name)=term or rcfito_private.application_query_term(p.code)=term
        or exists(select 1 from public.product_synonyms s where s.product_id=p.id and rcfito_private.application_query_term(s.name)=term))
    union all
    select o.id,o.folio,'order',o.project_name,o.season from public.application_orders o join public.sowing_projects p on p.id=o.project_id where p_kind='order'
      and (p_scope->>'agricultural_unit_id' is null or p.agricultural_unit_id=(p_scope->>'agricultural_unit_id')::uuid)
      and (p_scope->>'project_id' is null or p.id=(p_scope->>'project_id')::uuid)
      and (p_scope->>'field_id' is null or o.field_id=(p_scope->>'field_id')::uuid)
      and rcfito_private.application_query_term(o.folio)=term
  ) select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into result from (select * from candidates order by name,id limit 11) x;
  return result;
end $$;

create function public.application_query(p_query jsonb) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare q jsonb; stamp jsonb; result jsonb; op text; key text; value jsonb; candidates jsonb; item record;
  page_limit integer:=10; page_offset integer:=0; status_filter text;
begin
  stamp:=public.application_query_stamp();
  if p_query is null or jsonb_typeof(p_query)<>'object' or octet_length(p_query::text)>8192 then raise exception 'La consulta debe ser un objeto de hasta 8192 bytes'; end if;
  q:=jsonb_strip_nulls(p_query);
  for key,value in select * from jsonb_each(q) loop
    if not key=any(array['operation','agricultural_unit_id','project_id','field_id','lot_id','stage_id','product_id','order_id',
      'agricultural_unit','project','field','lot','product','folio','stage_number','from','to','status','limit','offset']) then
      raise exception 'La consulta contiene un filtro no permitido: %',key;
    end if;
    if key=any(array['agricultural_unit_id','project_id','field_id','lot_id','stage_id','product_id','order_id']) then
      if jsonb_typeof(value)<>'string' or value#>>'{}' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise exception 'El filtro % requiere un UUID válido',key; end if;
      q:=jsonb_set(q,array[key],to_jsonb(lower(value#>>'{}')));
    elsif key=any(array['stage_number','limit','offset']) then
      if jsonb_typeof(value)<>'number' or (value#>>'{}')::numeric<>trunc((value#>>'{}')::numeric)
        or (value#>>'{}')::numeric<(case when key='offset' then 0 else 1 end)
        or (value#>>'{}')::numeric>(case key when 'limit' then 30 when 'offset' then 1000 else 2147483647 end) then raise exception 'El filtro % está fuera del rango permitido',key; end if;
    else
      if jsonb_typeof(value)<>'string' or btrim(value#>>'{}')='' or char_length(value#>>'{}')>200 then raise exception 'El filtro % requiere texto de hasta 200 caracteres',key; end if;
      q:=jsonb_set(q,array[key],to_jsonb(btrim(value#>>'{}')));
      if key in ('from','to') then
        if q->>key !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or to_char((q->>key)::date,'YYYY-MM-DD')<>q->>key then raise exception 'Fecha inválida: %',key; end if;
      end if;
    end if;
  end loop;
  op:=q->>'operation';
  if op is null or op not in ('pendientes','historial','uso_producto','detalle','cambios') then raise exception 'Selecciona una operación de consulta válida'; end if;
  if q ? 'from' and q ? 'to' and (q->>'from')::date>(q->>'to')::date then raise exception 'El inicio del periodo no puede ser posterior al fin'; end if;
  if q ? 'status' and q->>'status' not in ('indicated','performed','cancelled','all') then raise exception 'Estado de consulta inválido'; end if;
  status_filter:=case when op='pendientes' then 'indicated' else coalesce(q->>'status',case when op='uso_producto' then 'performed' else 'all' end) end;
  if op='pendientes' and q ? 'status' and q->>'status'<>'indicated' then raise exception 'Pendientes solo admite estado indicado'; end if;
  page_limit:=coalesce((q->>'limit')::integer,10);page_offset:=coalesce((q->>'offset')::integer,0);
  q:=q||jsonb_build_object('status',status_filter,'limit',page_limit,'offset',page_offset);
  for item in select * from (values
    ('agricultural_unit','agricultural_unit_id','agricultural_unit'),('project','project_id','project'),('field','field_id','field'),
    ('lot','lot_id','lot'),('product','product_id','product'),('folio','order_id','order')) x(name_key,id_key,kind)
  loop
    if q ? item.name_key then
      candidates:=rcfito_private.application_query_candidates(item.kind,q->>item.name_key,q);
      if jsonb_array_length(candidates)<>1 or (q ? item.id_key and q->>item.id_key<>candidates->0->>'id') then
        return stamp||jsonb_build_object('query',q,'summary','{}'::jsonb,'rows','[]'::jsonb,'sources','[]'::jsonb,'incomplete_count',0,'truncated',false,
          'clarification',case when jsonb_array_length(candidates)=0 then 'No encontré una coincidencia exacta autorizada para '||item.name_key||'. Revisa el nombre o selecciona su identificador.'
            when jsonb_array_length(candidates)>1 then 'Hay varias coincidencias para '||item.name_key||'. Selecciona proyecto, temporada o identificador antes de consultar.'
            else 'El nombre y el identificador de '||item.name_key||' no coinciden. Aclara cuál deseas consultar.' end,'choices',candidates);
      end if;
      q:=q||jsonb_build_object(item.id_key,candidates->0->>'id');
    end if;
  end loop;
  if op in ('detalle','cambios') and not q ? 'order_id' then
    return stamp||jsonb_build_object('query',q,'summary','{}'::jsonb,'rows','[]'::jsonb,'sources','[]'::jsonb,'incomplete_count',0,'truncated',false,
      'clarification','Indica el folio o identificador de la orden que deseas consultar.','choices','[]'::jsonb);
  end if;

  if op='cambios' then
    with changes as materialized (
      select c.id,c.order_id,c.target_id,o.folio,c.kind,c.version,left(c.reason,600) reason,c.changed_at,c.changed_by_name,
        jsonb_build_object('before',rcfito_private.application_query_snapshot(c."before"),
          'after',rcfito_private.application_query_snapshot(c."after")) difference
      from public.application_changes c join public.application_orders o on o.id=c.order_id join public.sowing_projects p on p.id=o.project_id
      where c.order_id=(q->>'order_id')::uuid
        and (q->>'agricultural_unit_id' is null or p.agricultural_unit_id=(q->>'agricultural_unit_id')::uuid)
        and (q->>'project_id' is null or o.project_id=(q->>'project_id')::uuid)
        and (q->>'field_id' is null or o.field_id=(q->>'field_id')::uuid)
        and (q->>'from' is null or (c.changed_at at time zone 'America/Mazatlan')::date>=(q->>'from')::date)
        and (q->>'to' is null or (c.changed_at at time zone 'America/Mazatlan')::date<=(q->>'to')::date)
        and exists(select 1 from public.application_targets t join public.sowing_stages s on s.id=t.stage_id join public.lot_subdivisions d on d.id=s.subdivision_id
          where t.id=any(c.target_ids) and (q->>'stage_id' is null or t.stage_id=(q->>'stage_id')::uuid)
            and (q->>'stage_number' is null or t.stage_number=(q->>'stage_number')::integer)
            and (q->>'lot_id' is null or d.lot_id=(q->>'lot_id')::uuid)
            and (status_filter='all' or t.status=status_filter))
        and (q->>'product_id' is null or exists(select 1 from public.application_change_products cp where cp.change_id=c.id and cp.product_id=(q->>'product_id')::uuid))
    ), page as (select * from changes order by changed_at desc,id desc limit page_limit offset page_offset)
    select jsonb_build_object('summary',jsonb_build_object('event_count',(select count(*) from changes),'total_rows',(select count(*) from changes)),
      'rows',coalesce((select jsonb_agg(to_jsonb(x) order by x.changed_at desc,x.id desc) from page x),'[]'::jsonb),
      'sources',coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('order_id',x.order_id,'target_id',x.target_id,'folio',x.folio))) from page x),'[]'::jsonb),
      'source_count',(select count(*) from changes),'sources_scope','matching_events',
      'sources_truncated',(select count(*) from changes)>(select count(*) from page),
      'incomplete_count',0,'truncated',(select count(*) from changes)>page_offset+page_limit) into result;
    return stamp||result||jsonb_build_object('query',q);
  end if;

  with raw as materialized (
    select t.id target_id,t.order_id,t.stage_id,t.application_number,t.status,t.lot_name,t.subdivision_name,t.stage_number,t.crop_name,t.variety_name,t.area_ha,t.cancellation_reason,
      o.folio,o.project_id,o.project_name,o.field_id,o.field_name,o.agricultural_unit_name,o.season,p.agricultural_unit_id,d.lot_id,
      o.revision,t.indication_change_id,t.correction_version,ic.version indication_version,pc.version performance_version,
      case when t.indication_change_id is null then jsonb_build_object('indicated_date',o.indicated_date,'scheduled_date',o.scheduled_date,'water_l_ha',o.water_l_ha,'method_name',o.method_name,'observations',o.observations,
        'products',coalesce((select jsonb_agg(jsonb_build_object('product_id',x.product_id,'product_name',x.product_name,'unit',x.unit,'dose',x.dose) order by x.product_id) from public.application_order_products x where x.order_id=o.id),'[]'::jsonb))
        else ic."after" end indication,
      case when pc.version is not null then pc."after" else jsonb_build_object('actual_date',t.actual_date,'water_l_ha',t.actual_water_l_ha,'equipment',t.equipment,'applicator',t.applicator,'observations',t.actual_observations,'has_changes',t.has_changes,
        'products',coalesce((select jsonb_agg(jsonb_build_object('product_id',x.product_id,'product_name',x.product_name,'unit',x.unit,'dose',x.dose) order by x.product_id) from public.application_actual_products x where x.target_id=t.id),'[]'::jsonb)) end actual
    from public.application_targets t join public.application_orders o on o.id=t.order_id join public.sowing_projects p on p.id=o.project_id
      join public.sowing_stages s on s.id=t.stage_id join public.lot_subdivisions d on d.id=s.subdivision_id join public.project_lots l on l.id=d.lot_id and l.project_id=o.project_id and l.field_id=o.field_id
      left join public.application_changes ic on ic.id=t.indication_change_id and ic.order_id=o.id and ic.kind='indication' and t.id=any(ic.target_ids)
      left join lateral (select c.version,c."after" from public.application_changes c where c.target_id=t.id and c.kind='performance' and c.order_id=o.id and t.id=any(c.target_ids) order by c.version desc limit 1) pc on true
    where (status_filter='all' or t.status=status_filter)
      and (q->>'agricultural_unit_id' is null or p.agricultural_unit_id=(q->>'agricultural_unit_id')::uuid)
      and (q->>'project_id' is null or o.project_id=(q->>'project_id')::uuid)
      and (q->>'field_id' is null or o.field_id=(q->>'field_id')::uuid)
      and (q->>'lot_id' is null or d.lot_id=(q->>'lot_id')::uuid)
      and (q->>'stage_id' is null or t.stage_id=(q->>'stage_id')::uuid)
      and (q->>'stage_number' is null or t.stage_number=(q->>'stage_number')::integer)
      and (q->>'order_id' is null or o.id=(q->>'order_id')::uuid)
  ), snapshots as materialized (
    select raw.*,case when status='performed' then actual else indication end snapshot,
      rcfito_private.application_query_date(case when op='pendientes' then indication->>'scheduled_date' when status='performed' then actual->>'actual_date' else indication->>'indicated_date' end)::text record_date,
      (indication_change_id is null or indication_version is not null)
        and (status<>'indicated' or coalesce(indication_version,0)=revision)
        and coalesce(performance_version,0)=correction_version as history_valid
    from raw
  ), normalized as materialized (
    select snapshots.*,case when jsonb_typeof(snapshot->'products')='array' then snapshot->'products' else '[]'::jsonb end snapshot_products from snapshots
  ), checked as materialized (
    select normalized.*,coalesce(history_valid and record_date is not null and area_ha>0 and stage_number>0
      and jsonb_array_length(snapshot_products)>0
      and not exists(select 1 from jsonb_array_elements(snapshot_products) x where jsonb_typeof(x->'dose') is distinct from 'number'
        or (x->>'dose')::numeric<=0 or coalesce(x->>'unit','') not in ('g','ml') or nullif(btrim(x->>'product_name'),'') is null or nullif(x->>'product_id','') is null)
      and (select count(*)=count(distinct x->>'product_id') from jsonb_array_elements(snapshot_products) x),false) valid
    from normalized
  ), dated as materialized (
    select * from checked where (record_date is null or ((q->>'from' is null or record_date>=(q->>'from')) and (q->>'to' is null or record_date<=(q->>'to'))))
      and (q->>'product_id' is null or exists(select 1 from jsonb_array_elements(snapshot_products) x where x->>'product_id'=q->>'product_id'))
  ), facts as materialized (
    select dated.*,coalesce((select jsonb_agg(jsonb_build_object('product_id',x->>'product_id','product_name',x->>'product_name','unit',x->>'unit','dose',(x->>'dose')::numeric,'quantity',(x->>'dose')::numeric*area_ha) order by x->>'product_id')
      from jsonb_array_elements(snapshot_products) x where q->>'product_id' is null or x->>'product_id'=q->>'product_id'),'[]'::jsonb) products
    from dated where valid
  ), lines as materialized (
    select f.target_id,f.order_id,f.record_date,f.area_ha,x->>'product_id' product_id,x->>'product_name' product_name,x->>'unit' unit,(x->>'dose')::numeric dose,(x->>'quantity')::numeric quantity
    from facts f cross join lateral jsonb_array_elements(f.products) x
  ), usage as materialized (
    select product_id,unit,(array_agg(product_name order by record_date desc,target_id))[1] product_name,
      sum(quantity) quantity,sum(quantity)/nullif(sum(area_ha),0) average_dose,count(distinct target_id) destination_count,count(distinct order_id) order_count,max(record_date) last_date
    from lines group by product_id,unit
  ), page as (select * from facts order by record_date desc,target_id limit page_limit offset page_offset),
  usage_page as materialized (select * from usage order by quantity desc,product_name,product_id,unit limit page_limit offset page_offset),
  usage_sources as materialized (
    select f.order_id,f.target_id,f.folio,l.product_id,l.unit,l.record_date,
      row_number() over(partition by l.product_id,l.unit order by l.record_date desc,l.target_id) occurrence
    from lines l join usage_page u on u.product_id=l.product_id and u.unit=l.unit join facts f on f.target_id=l.target_id
  ), usage_source_page as (
    -- Primero una evidencia por cada producto mostrado; después ejemplos adicionales.
    select * from usage_sources order by occurrence,product_id,unit,record_date desc,target_id limit 30
  )
  select jsonb_build_object('summary',jsonb_build_object('destination_count',(select count(*) from facts),'order_count',(select count(distinct order_id) from facts),
      'liquid_ml',coalesce((select sum(quantity) from lines where unit='ml'),0),'solid_g',coalesce((select sum(quantity) from lines where unit='g'),0),
      'area_ha',coalesce((select sum(area_ha) from facts),0),'total_rows',case when op='uso_producto' then (select count(*) from usage) else (select count(*) from facts) end),
    'rows',case when op='uso_producto' then coalesce((select jsonb_agg(to_jsonb(u) order by u.quantity desc,u.product_name,u.product_id,u.unit) from usage_page u),'[]'::jsonb)
      else coalesce((select jsonb_agg(jsonb_build_object('order_id',f.order_id,'target_id',f.target_id,'stage_id',f.stage_id,'folio',f.folio,'application_number',f.application_number,'status',f.status,'record_date',f.record_date,
        'indicated_date',f.indication->>'indicated_date','scheduled_date',f.indication->>'scheduled_date','actual_date',f.actual->>'actual_date','lot_id',f.lot_id,'lot_name',f.lot_name,'subdivision_name',f.subdivision_name,'stage_number',f.stage_number,
        'agricultural_unit_id',f.agricultural_unit_id,'agricultural_unit_name',f.agricultural_unit_name,'project_name',f.project_name,'season',f.season,'field_name',f.field_name,'crop_name',f.crop_name,'variety_name',f.variety_name,
        'area_ha',f.area_ha,'products',f.products,'water_l_ha',f.snapshot->'water_l_ha','method_name',f.indication->>'method_name','equipment',left(f.actual->>'equipment',200),'applicator',left(f.actual->>'applicator',200),
        'observations',left(f.snapshot->>'observations',600),'cancellation_reason',left(f.cancellation_reason,600),'source',case when f.status='performed' then 'actual' else 'indication' end) order by f.record_date desc,f.target_id) from page f),'[]'::jsonb) end,
    'sources',case when op='uso_producto' then coalesce((select jsonb_agg(jsonb_build_object('order_id',s.order_id,'target_id',s.target_id,'folio',s.folio,'product_id',s.product_id,'unit',s.unit) order by s.occurrence,s.product_id,s.unit,s.record_date desc,s.target_id) from usage_source_page s),'[]'::jsonb)
      else coalesce((select jsonb_agg(jsonb_build_object('order_id',f.order_id,'target_id',f.target_id,'folio',f.folio) order by f.record_date desc,f.target_id) from page f),'[]'::jsonb) end,
    'source_count',case when op='uso_producto' then (select count(*) from usage_sources) else (select count(*) from facts) end,
    'sources_scope',case when op='uso_producto' then 'displayed_products' else 'matching_destinations' end,
    'sources_truncated',case when op='uso_producto' then (select count(*) from usage_sources)>30 else (select count(*) from facts)>(select count(*) from page) end,
    'incomplete_count',(select count(*) from dated where not valid),
    'truncated',case when op='uso_producto' then (select count(*) from usage)>page_offset+page_limit else (select count(*) from facts)>page_offset+page_limit end) into result;
  return stamp||result||jsonb_build_object('query',q);
end $$;

revoke all on function public.application_query_stamp(),public.application_query(jsonb),rcfito_private.application_query_term(text),rcfito_private.application_query_date(text),rcfito_private.application_query_snapshot(jsonb),rcfito_private.application_query_candidates(text,text,jsonb) from public,anon;
grant execute on function public.application_query_stamp(),public.application_query(jsonb),rcfito_private.application_query_term(text),rcfito_private.application_query_date(text),rcfito_private.application_query_snapshot(jsonb),rcfito_private.application_query_candidates(text,text,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
