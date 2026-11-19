begin;
-- Serialize source edits and snapshot capture without changing agricultural RLS.
select pg_advisory_xact_lock(hashtextextended('rcfito-classification-source',0));
create function rcfito_private.lock_classification_source() returns trigger language plpgsql security invoker set search_path='' as $$
begin perform pg_advisory_xact_lock(hashtextextended('rcfito-classification-source',0)); return null; end $$;
do $$ declare t text; begin foreach t in array array['products','product_ingredients','active_ingredients','ingredient_classifications'] loop
 execute format('create trigger a0_classification_source before insert or update or delete on public.%I for each statement execute function rcfito_private.lock_classification_source()',t);
end loop; end $$;

create function rcfito_private.capture_product_classifications(p_product_id uuid,p_origin text default 'recorded') returns jsonb language plpgsql security definer set search_path='' as $$
declare ingredients jsonb; classes jsonb; complete boolean;
begin
 perform pg_advisory_xact_lock_shared(hashtextextended('rcfito-classification-source',0));
 select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'name',i.name,'classification_id',i.classification_id,
   'classifications',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name) order by c.id) from public.ingredient_classifications c where c.id=any(i.classification_ids)),'[]'::jsonb)) order by i.id),'[]'::jsonb)
 into ingredients from public.product_ingredients pi join public.active_ingredients i on i.id=pi.active_ingredient_id where pi.product_id=p_product_id;
 select coalesce(jsonb_agg(x order by x->>'id'),'[]'::jsonb) into classes from (select distinct c x from jsonb_array_elements(ingredients) i cross join lateral jsonb_array_elements(i->'classifications') c) u;
 complete:=jsonb_array_length(ingredients)>0 and not exists(select 1 from jsonb_array_elements(ingredients) i where jsonb_array_length(i->'classifications')=0);
 return jsonb_build_object('origin',p_origin,'captured_at',transaction_timestamp(),'ingredients',ingredients,'classifications',classes,'complete',complete);
end $$;
create function rcfito_private.catalog_product_classifications() returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if not rcfito_private.is_active_user() then raise exception 'Inicia sesión con una cuenta activa' using errcode='42501'; end if;
 if not rcfito_private.has_menu('catalog:products') then return '{}'::jsonb; end if;
 select coalesce(jsonb_object_agg(p.id,rcfito_private.capture_product_classifications(p.id,'draft')-'ingredients'),'{}'::jsonb) into result from public.products p;
 return result;
end $$;
create function public.catalog_product_classifications() returns jsonb language sql security invoker set search_path='' as $$ select rcfito_private.catalog_product_classifications() $$;

-- Preserve existing JSON documents/signatures. Add provenance beside each line,
-- including both phases of every historical correction.
do $$ declare t text; begin foreach t in array array['application_order_products','application_actual_products','application_change_products'] loop
 if exists(select 1 from pg_trigger where tgrelid=('public.'||t)::regclass and not tgisinternal and tgenabled<>'O') then raise exception 'Hay triggers previamente deshabilitados: revisar antes de migrar'; end if;
 execute format('alter table public.%I add column classification_snapshot jsonb',t);
 execute format('alter table public.%I disable trigger user',t);
 execute format('update public.%I set classification_snapshot=rcfito_private.capture_product_classifications(product_id,''reconstructed'')',t);
 execute format('alter table public.%I enable trigger user',t);
 execute format('alter table public.%I alter column classification_snapshot set not null',t);
 execute format('alter table public.%I add constraint classification_snapshot_shape check(jsonb_typeof(classification_snapshot)=''object'' and classification_snapshot->>''origin'' in(''recorded'',''reconstructed'') and jsonb_typeof(classification_snapshot->''classifications'')=''array'')',t);
end loop; end $$;

create function rcfito_private.stamp_application_classifications() returns trigger language plpgsql security definer set search_path='' as $$
declare change public.application_changes; previous_change uuid; prior jsonb;
begin
 if tg_op='UPDATE' then raise exception 'La clasificación histórica no se modifica; registra una corrección'; end if;
 if tg_table_name='application_change_products' and to_jsonb(new)->>'phase'='before' then
   select * into change from public.application_changes where id=new.change_id;
   if change.kind='performance' then
     select classification_snapshot into prior from public.application_actual_products where target_id=change.target_id and product_id=new.product_id;
   else
     select indication_change_id into previous_change from public.application_targets where id=change.target_ids[1];
     if previous_change is not null then select classification_snapshot into prior from public.application_change_products where change_id=previous_change and phase='after' and product_id=new.product_id;
     else select classification_snapshot into prior from public.application_order_products where order_id=change.order_id and product_id=new.product_id; end if;
   end if;
   new.classification_snapshot:=coalesce(prior,rcfito_private.capture_product_classifications(new.product_id,'reconstructed'));
 else new.classification_snapshot:=rcfito_private.capture_product_classifications(new.product_id,'recorded'); end if;
 return new;
end $$;
do $$ declare t text; begin foreach t in array array['application_order_products','application_actual_products','application_change_products'] loop
 execute format('create trigger a_classification_snapshot before insert or update on public.%I for each row execute function rcfito_private.stamp_application_classifications()',t);
end loop; end $$;

create function rcfito_private.application_classification(p_order_id uuid,p_target_id uuid,p_product_id uuid,p_kind text,p_change_id uuid) returns jsonb language sql stable security invoker set search_path='' as $$
 select case when p_change_id is not null then (select classification_snapshot from public.application_change_products where change_id=p_change_id and phase='after' and product_id=p_product_id)
 when p_kind='actual' then (select classification_snapshot from public.application_actual_products where target_id=p_target_id and product_id=p_product_id)
 else (select classification_snapshot from public.application_order_products where order_id=p_order_id and product_id=p_product_id) end
$$;
create function rcfito_private.classified_change_snapshot(p_change_id uuid,p_phase text,p_snapshot jsonb) returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_set(p_snapshot,'{products}',coalesce((select jsonb_agg(x||jsonb_build_object('classification_snapshot',(select classification_snapshot from public.application_change_products where change_id=p_change_id and phase=p_phase and product_id=(x->>'product_id')::uuid)) order by x->>'product_id') from jsonb_array_elements(p_snapshot->'products') x),'[]'::jsonb))
$$;

-- Remove independent product classifications; keep useful name/synonym audit.
drop trigger guard_catalog_classifications on public.products;
create or replace function rcfito_private.guard_classification_delete() returns trigger language plpgsql security definer set search_path='' as $$
begin if exists(select 1 from public.active_ingredients where classification_ids @> array[old.id]) then raise exception 'Esta clasificación está relacionada (foreign key). Desactívala para conservar su historial' using errcode='23503'; end if; return old; end $$;
create or replace function rcfito_private.save_product(p_data jsonb,p_ingredients jsonb default '[]') returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid; b jsonb; a jsonb; previous public.products;
begin
 perform rcfito_private.require_admin();
 if p_data ?| array['classification_ids','classification_id'] then raise exception 'Las clasificaciones del producto se heredan de sus ingredientes. Actualiza la vista'; end if;
 perform pg_advisory_xact_lock(hashtextextended('rcfito-classification-source',0));
 perform pg_advisory_xact_lock(hashtextextended('rcfito-product-terms',0));
 if nullif(p_data->>'id','') is not null then select * into previous from public.products where id=(p_data->>'id')::uuid for update; if found then b:=rcfito_private.catalog_metadata_snapshot(to_jsonb(previous),'products'); end if; end if;
 result:=rcfito_private.save_product_before_classifications(p_data,p_ingredients);
 select rcfito_private.catalog_metadata_snapshot(to_jsonb(p),'products') into a from public.products p where id=result;
 perform rcfito_private.record_catalog_metadata('products',result,b,a);
 return result;
end $$;
create or replace function rcfito_private.catalog_metadata_snapshot(p_row jsonb,p_kind text) returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('name',p_row->'name','active',p_row->'active','synonyms',case when p_kind='active_ingredients' then coalesce(p_row->'synonyms','[]'::jsonb) else coalesce((select jsonb_agg(name order by normalized_name) from public.product_synonyms where product_id=(p_row->>'id')::uuid),'[]'::jsonb) end)
 ||case when p_kind='active_ingredients' then jsonb_build_object('classification_id',p_row->'classification_id','classifications',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name) order by id) from public.ingredient_classifications where id in(select value::uuid from jsonb_array_elements_text(p_row->'classification_ids'))),'[]'::jsonb)) else '{}'::jsonb end
$$;
update public.catalog_metadata_changes set "before"="before"-array['classification_id','classifications'],"after"="after"-array['classification_id','classifications'] where kind='products';
delete from public.catalog_metadata_changes where kind='products' and "before" is not distinct from "after";
alter table public.products drop column classification_id,drop column classification_ids;

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
    union all select 'ingredient_classifications',c.id,c.name,c.active from public.ingredient_classifications c where (rcfito_private.has_menu('catalog:active_ingredients') and exists(select 1 from public.active_ingredients i where c.id=any(i.classification_ids))) or (rcfito_private.has_menu('catalog:products') and exists(select 1 from public.product_ingredients pi join public.active_ingredients i on i.id=pi.active_ingredient_id where c.id=any(i.classification_ids)))
    union all select 'brands',b.id,b.name,b.active from public.brands b where rcfito_private.has_menu('catalog:products') and exists(select 1 from public.products p where p.brand_id=b.id)
    union all select 'product_families',f.id,f.name,f.active from public.product_families f where rcfito_private.has_menu('catalog:products') and exists(select 1 from public.products p where p.product_family_id=f.id)
  ), grouped as (select kind,jsonb_agg((jsonb_build_object('id',id,'name',name,'active',active)||case when kind='fields' then jsonb_build_object('agricultural_unit_id',(select agricultural_unit_id from public.fields f where f.id=refs.id)) when kind='varieties' then jsonb_build_object('crop_id',(select crop_id from public.varieties v where v.id=refs.id)) else '{}'::jsonb end) order by id) rows from refs group by kind)
  select coalesce(jsonb_object_agg(kind,rows),'{}') into result from grouped;
  return result;
end $$;
create or replace function rcfito_private.application_query_snapshot(p_snapshot jsonb) returns jsonb language sql immutable security invoker set search_path='' as $$
  select jsonb_strip_nulls(jsonb_build_object('indicated_date',p_snapshot->'indicated_date','scheduled_date',p_snapshot->'scheduled_date',
    'actual_date',p_snapshot->'actual_date','water_l_ha',p_snapshot->'water_l_ha','method_name',p_snapshot->'method_name',
    'equipment',left(p_snapshot->>'equipment',200),'applicator',left(p_snapshot->>'applicator',200),'observations',left(p_snapshot->>'observations',300),
    'product_count',jsonb_array_length(s.products),'products_truncated',jsonb_array_length(s.products)>10,
    'products',coalesce((select jsonb_agg(x.value order by x.value->>'product_id') from
      (select jsonb_build_object('product_id',p->'product_id','product_name',p->'product_name','unit',p->'unit','dose',p->'dose','classification_snapshot',p->'classification_snapshot') value
       from jsonb_array_elements(s.products) p order by p->>'product_id' limit 10) x),'[]'::jsonb)))
  from (select case when jsonb_typeof(p_snapshot->'products')='array' then p_snapshot->'products' else '[]'::jsonb end products) s
$$;

create or replace function rcfito_private.application_query(p_query jsonb) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare q jsonb; stamp jsonb; result jsonb; op text; key text; value jsonb; candidates jsonb; item record;
  page_limit integer:=10; page_offset integer:=0; status_filter text;
begin
  stamp:=public.application_query_stamp();
  if p_query is null or jsonb_typeof(p_query)<>'object' or octet_length(p_query::text)>8192 then raise exception 'La consulta debe ser un objeto de hasta 8192 bytes'; end if;
  q:=jsonb_strip_nulls(p_query);
  for key,value in select * from jsonb_each(q) loop
    if not key=any(array['operation','agricultural_unit_id','project_id','field_id','lot_id','stage_id','product_id','order_id','classification_id',
      'agricultural_unit','project','field','lot','product','folio','stage_number','from','to','status','limit','offset']) then
      raise exception 'La consulta contiene un filtro no permitido: %',key;
    end if;
    if key=any(array['agricultural_unit_id','project_id','field_id','lot_id','stage_id','product_id','order_id','classification_id']) then
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
        jsonb_build_object('before',rcfito_private.application_query_snapshot(rcfito_private.classified_change_snapshot(c.id,'before',c."before")),
          'after',rcfito_private.application_query_snapshot(rcfito_private.classified_change_snapshot(c.id,'after',c."after"))) difference
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
        and (q->>'product_id' is null or exists(select 1 from public.application_change_products cp where cp.change_id=c.id and cp.product_id=(q->>'product_id')::uuid)) and (q->>'classification_id' is null or exists(select 1 from public.application_change_products cp cross join lateral jsonb_array_elements(cp.classification_snapshot->'classifications') cl where cp.change_id=c.id and cl->>'id'=q->>'classification_id' and (q->>'product_id' is null or cp.product_id=(q->>'product_id')::uuid)))
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
      o.revision,t.indication_change_id,t.correction_version,ic.version indication_version,pc.version performance_version,pc.id performance_change_id,
      case when t.indication_change_id is null then jsonb_build_object('indicated_date',o.indicated_date,'scheduled_date',o.scheduled_date,'water_l_ha',o.water_l_ha,'method_name',o.method_name,'observations',o.observations,
        'products',coalesce((select jsonb_agg(jsonb_build_object('product_id',x.product_id,'product_name',x.product_name,'unit',x.unit,'dose',x.dose) order by x.product_id) from public.application_order_products x where x.order_id=o.id),'[]'::jsonb))
        else ic."after" end indication,
      case when pc.version is not null then pc."after" else jsonb_build_object('actual_date',t.actual_date,'water_l_ha',t.actual_water_l_ha,'equipment',t.equipment,'applicator',t.applicator,'observations',t.actual_observations,'has_changes',t.has_changes,
        'products',coalesce((select jsonb_agg(jsonb_build_object('product_id',x.product_id,'product_name',x.product_name,'unit',x.unit,'dose',x.dose) order by x.product_id) from public.application_actual_products x where x.target_id=t.id),'[]'::jsonb)) end actual
    from public.application_targets t join public.application_orders o on o.id=t.order_id join public.sowing_projects p on p.id=o.project_id
      join public.sowing_stages s on s.id=t.stage_id join public.lot_subdivisions d on d.id=s.subdivision_id join public.project_lots l on l.id=d.lot_id and l.project_id=o.project_id and l.field_id=o.field_id
      left join public.application_changes ic on ic.id=t.indication_change_id and ic.order_id=o.id and ic.kind='indication' and t.id=any(ic.target_ids)
      left join lateral (select c.id,c.version,c."after" from public.application_changes c where c.target_id=t.id and c.kind='performance' and c.order_id=o.id and t.id=any(c.target_ids) order by c.version desc limit 1) pc on true
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
    select snapshots.*,coalesce((select jsonb_agg(x||jsonb_build_object('classification_snapshot',rcfito_private.application_classification(order_id,target_id,(x->>'product_id')::uuid,case when status='performed' then 'actual' else 'indication' end,case when status='performed' then performance_change_id else indication_change_id end))) from jsonb_array_elements(case when jsonb_typeof(snapshot->'products')='array' then snapshot->'products' else '[]'::jsonb end) x),'[]'::jsonb) snapshot_products from snapshots
  ), checked as materialized (
    select normalized.*,coalesce(history_valid and record_date is not null and area_ha>0 and stage_number>0
      and jsonb_array_length(snapshot_products)>0
      and not exists(select 1 from jsonb_array_elements(snapshot_products) x where jsonb_typeof(x->'dose') is distinct from 'number'
        or (x->>'dose')::numeric<=0 or coalesce(x->>'unit','') not in ('g','ml') or nullif(btrim(x->>'product_name'),'') is null or nullif(x->>'product_id','') is null)
      and (select count(*)=count(distinct x->>'product_id') from jsonb_array_elements(snapshot_products) x),false) valid
    from normalized
  ), dated as materialized (
    select * from checked where (record_date is null or ((q->>'from' is null or record_date>=(q->>'from')) and (q->>'to' is null or record_date<=(q->>'to'))))
      and (q->>'product_id' is null or exists(select 1 from jsonb_array_elements(snapshot_products) x where x->>'product_id'=q->>'product_id')) and (q->>'classification_id' is null or exists(select 1 from jsonb_array_elements(snapshot_products) x cross join lateral jsonb_array_elements(x->'classification_snapshot'->'classifications') c where c->>'id'=q->>'classification_id' and (q->>'product_id' is null or x->>'product_id'=q->>'product_id')))
  ), facts as materialized (
    select dated.*,coalesce((select jsonb_agg(jsonb_build_object('product_id',x->>'product_id','product_name',x->>'product_name','unit',x->>'unit','dose',(x->>'dose')::numeric,'quantity',(x->>'dose')::numeric*area_ha,'classification_snapshot',x->'classification_snapshot') order by x->>'product_id')
      from jsonb_array_elements(snapshot_products) x where (q->>'product_id' is null or x->>'product_id'=q->>'product_id') and (q->>'classification_id' is null or exists(select 1 from jsonb_array_elements(x->'classification_snapshot'->'classifications') c where c->>'id'=q->>'classification_id'))),'[]'::jsonb) products
    from dated where valid
  ), lines as materialized (
    select f.target_id,f.order_id,f.record_date,f.area_ha,x->>'product_id' product_id,x->>'product_name' product_name,x->>'unit' unit,(x->>'dose')::numeric dose,(x->>'quantity')::numeric quantity,x->'classification_snapshot' classification_snapshot
    from facts f cross join lateral jsonb_array_elements(f.products) x
  ), usage as materialized (
    select product_id,unit,(array_agg(product_name order by record_date desc,target_id))[1] product_name,
      sum(quantity) quantity,sum(quantity)/nullif(sum(area_ha),0) average_dose,count(distinct target_id) destination_count,count(distinct order_id) order_count,max(record_date) last_date, count(*) filter(where classification_snapshot->>'origin'='reconstructed') reconstructed_count, count(*) filter(where classification_snapshot->>'complete' is distinct from 'true') classification_incomplete_count, (select coalesce(jsonb_agg(u.c order by u.c->>'id'),'[]'::jsonb) from (select distinct on(c->>'id') c from lines l2 cross join lateral jsonb_array_elements(l2.classification_snapshot->'classifications') c where l2.product_id=lines.product_id and l2.unit=lines.unit order by c->>'id',l2.record_date desc,l2.target_id) u) classifications
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

-- Snapshot/capture functions cannot be invoked to read hidden catalogs.
do $$ declare f regprocedure; begin
 for f in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='rcfito_private' and p.proname in('lock_classification_source','capture_product_classifications','catalog_product_classifications','stamp_application_classifications','application_classification','classified_change_snapshot') loop execute format('revoke all on function %s from public,anon,authenticated',f); end loop;
end $$;
grant execute on function rcfito_private.catalog_product_classifications(),rcfito_private.application_classification(uuid,uuid,uuid,text,uuid),rcfito_private.classified_change_snapshot(uuid,text,jsonb) to authenticated;
revoke all on function public.catalog_product_classifications() from public,anon;
grant execute on function public.catalog_product_classifications() to authenticated;
notify pgrst,'reload schema';
commit;
