begin;
-- Small bounded sets of catalog references live with their parent, so existing
-- REST writes and product RPCs remain atomic. Triggers enforce references on
-- both sides; GIN indexes support lookups and deletion guards.
alter table public.active_ingredients add column classification_ids uuid[] not null default '{}', add column synonyms text[] not null default '{}';
alter table public.products add column classification_ids uuid[] not null default '{}', add column classification_id uuid references public.ingredient_classifications(id) on delete restrict;
update public.active_ingredients set classification_ids=array[classification_id] where classification_id is not null;
create index active_ingredients_classifications_idx on public.active_ingredients using gin(classification_ids);
create index products_classifications_idx on public.products using gin(classification_ids);
create index products_classification_idx on public.products(classification_id);

create function rcfito_private.guard_catalog_classifications() returns trigger language plpgsql security invoker set search_path='' as $$
declare previous_ids uuid[]:='{}'; item record;
begin
  if new.classification_ids is null then raise exception 'Las clasificaciones deben ser una lista'; end if;
  if tg_op='UPDATE' then previous_ids:=old.classification_ids; end if;
  -- Older clients know only the principal. A new principal joins the set.
  if new.classification_id is not null and not(new.classification_id=any(new.classification_ids)) then
    if (tg_op='INSERT' and cardinality(new.classification_ids)=0) or (tg_op='UPDATE' and new.classification_ids=old.classification_ids and new.classification_id is distinct from old.classification_id) then
      new.classification_ids:=array_append(new.classification_ids,new.classification_id);
    else raise exception 'La principal debe estar entre las clasificaciones seleccionadas'; end if;
  end if;
  if cardinality(new.classification_ids)>100 or array_position(new.classification_ids,null) is not null or cardinality(new.classification_ids)<>(select count(distinct x) from unnest(new.classification_ids) x) then raise exception 'Selecciona cada clasificación una sola vez, hasta 100'; end if;
  for item in select c.id,c.active from public.ingredient_classifications c where c.id=any(new.classification_ids) order by c.id for share loop
    if not item.active and not(item.id=any(previous_ids)) then raise exception 'Selecciona una clasificación activa disponible. Las inactivas ya relacionadas pueden conservarse'; end if;
  end loop;
  if (select count(*) from public.ingredient_classifications where id=any(new.classification_ids))<>cardinality(new.classification_ids) then raise exception 'Selecciona una clasificación activa disponible (foreign key)' using errcode='23503'; end if;
  select coalesce(array_agg(x order by x),'{}') into new.classification_ids from unnest(new.classification_ids) x;
  return new;
end $$;
-- The previous single-reference trigger rejects selecting a retained inactive
-- secondary as primary; the new guard validates the complete retained set.
drop trigger guard_ingredient_classification on public.active_ingredients;
create trigger guard_catalog_classifications before insert or update on public.active_ingredients for each row execute function rcfito_private.guard_catalog_classifications();
create trigger guard_catalog_classifications before insert or update on public.products for each row execute function rcfito_private.guard_catalog_classifications();
create function rcfito_private.guard_classification_delete() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if exists(select 1 from public.products where classification_ids @> array[old.id]) or exists(select 1 from public.active_ingredients where classification_ids @> array[old.id]) then raise exception 'Esta clasificación está relacionada (foreign key). Desactívala para conservar su historial' using errcode='23503'; end if;
  return old;
end $$;
create trigger guard_classification_delete before delete on public.ingredient_classifications for each row execute function rcfito_private.guard_classification_delete();

create function rcfito_private.lock_ingredient_terms() returns trigger language plpgsql security invoker set search_path='' as $$
begin perform pg_advisory_xact_lock(hashtextextended('rcfito-ingredient-terms',0)); return null; end $$;
create trigger lock_ingredient_terms before insert or update or delete on public.active_ingredients for each statement execute function rcfito_private.lock_ingredient_terms();
create function rcfito_private.guard_ingredient_terms() returns trigger language plpgsql security invoker set search_path='' as $$
declare alias_name text; key text; keys text[]:='{}'; conflict text;
begin
  if cardinality(new.synonyms)>20 or array_position(new.synonyms,null) is not null then raise exception 'Registra hasta 20 sinónimos de texto'; end if;
  foreach alias_name in array new.synonyms loop
    key:=rcfito_private.product_term_compact(alias_name);
    if char_length(btrim(alias_name)) not between 2 and 80 or key='' then raise exception 'Cada sinónimo debe contener de 2 a 80 caracteres'; end if;
    if key=any(keys) then raise exception 'El sinónimo "%" está repetido',alias_name; end if;
    keys:=array_append(keys,key);
    if key in(rcfito_private.product_term_compact(new.name),rcfito_private.product_term_compact(new.code)) then raise exception 'El sinónimo "%" ya coincide con el nombre o código del ingrediente',alias_name; end if;
    select i.name into conflict from public.active_ingredients i where i.id<>new.id and (key=rcfito_private.product_term_compact(i.name) or key=rcfito_private.product_term_compact(i.code) or exists(select 1 from unnest(i.synonyms) term where rcfito_private.product_term_compact(term)=key)) limit 1;
    if found then raise exception 'El sinónimo "%" ya identifica al ingrediente "%"',alias_name,conflict; end if;
  end loop;
  select i.name into conflict from public.active_ingredients i where i.id<>new.id and exists(select 1 from unnest(i.synonyms) term where rcfito_private.product_term_compact(term) in(rcfito_private.product_term_compact(new.name),rcfito_private.product_term_compact(new.code))) limit 1;
  if found then raise exception 'El nombre o código ya es un sinónimo del ingrediente "%"',conflict; end if;
  select coalesce(array_agg(btrim(x) order by rcfito_private.product_term_compact(x)),'{}') into new.synonyms from unnest(new.synonyms) x;
  return new;
end $$;
create trigger guard_ingredient_terms before insert or update on public.active_ingredients for each row execute function rcfito_private.guard_ingredient_terms();

create table public.catalog_metadata_changes(
 id uuid primary key default gen_random_uuid(), kind text not null check(kind in('products','active_ingredients')),record_id uuid not null,
 transaction_id bigint not null default txid_current(), "before" jsonb, "after" jsonb,
 changed_by uuid not null references auth.users(id) on delete restrict,changed_by_name text not null,changed_at timestamptz not null default now(),
 unique(kind,record_id,transaction_id)
);
create index catalog_metadata_changes_record_idx on public.catalog_metadata_changes(kind,record_id,changed_at);
create index catalog_metadata_changes_actor_idx on public.catalog_metadata_changes(changed_by);
alter table public.catalog_metadata_changes enable row level security;
revoke all on public.catalog_metadata_changes from public,anon,authenticated;
grant select on public.catalog_metadata_changes to authenticated;
create policy catalog_metadata_admin_read on public.catalog_metadata_changes for select to authenticated using((select rcfito_private.is_admin()));

create function rcfito_private.catalog_metadata_snapshot(p_row jsonb,p_kind text) returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('name',p_row->'name','active',p_row->'active','classification_id',p_row->'classification_id',
 'classifications',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name) order by id) from public.ingredient_classifications where id in(select value::uuid from jsonb_array_elements_text(p_row->'classification_ids'))),'[]'::jsonb),
 'synonyms',case when p_kind='active_ingredients' then coalesce(p_row->'synonyms','[]'::jsonb) else coalesce((select jsonb_agg(name order by normalized_name) from public.product_synonyms where product_id=(p_row->>'id')::uuid),'[]'::jsonb) end)
$$;
create function rcfito_private.record_catalog_metadata(p_kind text,p_id uuid,p_before jsonb,p_after jsonb) returns void language plpgsql security invoker set search_path='' as $$
begin
 if p_before is not distinct from p_after or not rcfito_private.is_admin() then return; end if;
 insert into public.catalog_metadata_changes(kind,record_id,"before","after",changed_by,changed_by_name)
 values(p_kind,p_id,p_before,p_after,auth.uid(),(select display_name from public.profiles where id=auth.uid()))
 on conflict(kind,record_id,transaction_id) do update set "after"=excluded."after";
end $$;
create function rcfito_private.audit_catalog_metadata() returns trigger language plpgsql security definer set search_path='' as $$
declare b jsonb; a jsonb;
begin
 if tg_op<>'INSERT' then b:=rcfito_private.catalog_metadata_snapshot(to_jsonb(old),tg_table_name); end if;
 if tg_op<>'DELETE' then a:=rcfito_private.catalog_metadata_snapshot(to_jsonb(new),tg_table_name); end if;
 perform rcfito_private.record_catalog_metadata(tg_table_name,coalesce(new.id,old.id),b,a);
 return null;
end $$;
create trigger audit_catalog_metadata after insert or update or delete on public.products for each row execute function rcfito_private.audit_catalog_metadata();
create trigger audit_catalog_metadata after insert or update or delete on public.active_ingredients for each row execute function rcfito_private.audit_catalog_metadata();

alter function rcfito_private.save_product(jsonb,jsonb) rename to save_product_before_classifications;
create function rcfito_private.save_product(p_data jsonb,p_ingredients jsonb default '[]') returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid; b jsonb; a jsonb; previous public.products;
begin
 perform rcfito_private.require_admin();
 perform pg_advisory_xact_lock(hashtextextended('rcfito-product-terms',0));
 if nullif(p_data->>'id','') is not null then select * into previous from public.products where id=(p_data->>'id')::uuid for update; if found then b:=rcfito_private.catalog_metadata_snapshot(to_jsonb(previous),'products'); end if; end if;
 result:=rcfito_private.save_product_before_classifications(p_data,p_ingredients);
 if p_data ? 'classification_ids' and jsonb_typeof(p_data->'classification_ids') is distinct from 'array' then raise exception 'Las clasificaciones deben ser una lista'; end if;
 update public.products set classification_ids=case when p_data ? 'classification_ids' then array(select value::uuid from jsonb_array_elements_text(p_data->'classification_ids')) else classification_ids end,
 classification_id=case when p_data ? 'classification_id' then nullif(p_data->>'classification_id','')::uuid else classification_id end where id=result;
 select rcfito_private.catalog_metadata_snapshot(to_jsonb(p),'products') into a from public.products p where id=result;
 perform rcfito_private.record_catalog_metadata('products',result,b,a);
 return result;
end $$;
revoke all on function rcfito_private.save_product_before_classifications(jsonb,jsonb) from public,anon,authenticated;
revoke all on function rcfito_private.save_product(jsonb,jsonb) from public,anon;
grant execute on function rcfito_private.save_product(jsonb,jsonb) to authenticated;

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
    union all select 'ingredient_classifications',c.id,c.name,c.active from public.ingredient_classifications c where (rcfito_private.has_menu('catalog:active_ingredients') and exists(select 1 from public.active_ingredients i where c.id=any(i.classification_ids))) or (rcfito_private.has_menu('catalog:products') and exists(select 1 from public.products p where c.id=any(p.classification_ids)))
    union all select 'brands',b.id,b.name,b.active from public.brands b where rcfito_private.has_menu('catalog:products') and exists(select 1 from public.products p where p.brand_id=b.id)
    union all select 'product_families',f.id,f.name,f.active from public.product_families f where rcfito_private.has_menu('catalog:products') and exists(select 1 from public.products p where p.product_family_id=f.id)
  ), grouped as (select kind,jsonb_agg((jsonb_build_object('id',id,'name',name,'active',active)||case when kind='fields' then jsonb_build_object('agricultural_unit_id',(select agricultural_unit_id from public.fields f where f.id=refs.id)) when kind='varieties' then jsonb_build_object('crop_id',(select crop_id from public.varieties v where v.id=refs.id)) else '{}'::jsonb end) order by id) rows from refs group by kind)
  select coalesce(jsonb_object_agg(kind,rows),'{}') into result from grouped;
  return result;
end $$;

do $$ declare f regprocedure; begin
 for f in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='rcfito_private' and p.proname in('guard_catalog_classifications','guard_classification_delete','lock_ingredient_terms','guard_ingredient_terms','catalog_metadata_snapshot','record_catalog_metadata','audit_catalog_metadata') loop execute format('revoke all on function %s from public,anon,authenticated',f); end loop;
end $$;
do $$ begin if exists(select 1 from pg_roles where rolname='service_role') then revoke insert,update,delete,truncate on public.catalog_metadata_changes from service_role; end if; end $$;
notify pgrst,'reload schema';
commit;
