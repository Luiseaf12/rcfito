begin;

create function rcfito_private.menu_keys() returns text[] language sql immutable set search_path='' as $$
  select array['summary','projects','applications','queries','ai_capture','groups','users','connection',
    'catalog:agricultural_units','catalog:fields','catalog:crops','catalog:varieties','catalog:products',
    'catalog:active_ingredients','catalog:ingredient_classifications','catalog:brands','catalog:product_families',
    'catalog:infrastructure_types','catalog:application_methods']::text[]
$$;
alter table public.profiles add column menu_permissions text[] not null default '{}',
  add column access_version integer not null default 0 check(access_version>=0),
  add constraint profiles_valid_menus check(menu_permissions<@rcfito_private.menu_keys() and array_position(menu_permissions,null) is null);
-- Preserve existing access. New accounts start with no sections until assigned.
update public.profiles set menu_permissions=case when role='admin' then rcfito_private.menu_keys()
  else array_remove(array_remove(array_remove(rcfito_private.menu_keys(),'ai_capture'),'users'),'connection') end;

create function rcfito_private.has_menu(p_key text) returns boolean language sql stable security definer set search_path='' as $$
  select p_key=any(rcfito_private.menu_keys()) and auth.uid() is not null and exists(
    select 1 from public.profiles p where p.id=auth.uid() and p.active and
      (p.role='admin' or (p_key<>all(array['ai_capture','users','connection']) and p_key=any(p.menu_permissions))))
$$;
create function rcfito_private.require_menu(p_key text) returns void language plpgsql stable security invoker set search_path='' as $$
begin if not rcfito_private.is_active_user() then raise exception 'La consulta requiere una cuenta activa' using errcode='42501'; end if; if not rcfito_private.has_menu(p_key) then raise exception 'Tu cuenta no tiene acceso a esta sección' using errcode='42501'; end if; end $$;
create function rcfito_private.menu_data_access(p_table text) returns boolean language sql stable security invoker set search_path='' as $$
  select case
    when p_table=any(array['agricultural_units','fields','crops','varieties','products','active_ingredients','ingredient_classifications','brands','product_families','infrastructure_types','application_methods']) then
      rcfito_private.has_menu('catalog:'||p_table) or (current_setting('rcfito.menu_query',true)='queries' and rcfito_private.has_menu('queries'))
    when p_table=any(array['product_ingredients','product_synonyms']) then rcfito_private.has_menu('catalog:products') or (current_setting('rcfito.menu_query',true)='queries' and rcfito_private.has_menu('queries'))
    when p_table=any(array['sowing_projects','project_lots','lot_subdivisions','sowing_stages','lot_corrections']) then
      exists(select 1 from unnest(array['summary','projects','applications','queries','groups']) k where rcfito_private.has_menu(k))
    when p_table=any(array['application_orders','application_order_products','application_targets','application_actual_products','application_changes','application_change_products']) then
      exists(select 1 from unnest(array['summary','applications','queries']) k where rcfito_private.has_menu(k))
    when p_table=any(array['sowing_groups','sowing_group_members']) then
      exists(select 1 from unnest(array['summary','applications','queries','groups']) k where rcfito_private.has_menu(k))
    else false end
$$;
-- Restrictive policies combine with, never replace, existing agricultural RLS.
do $$ declare t text; begin
  foreach t in array array['agricultural_units','fields','crops','varieties','products','active_ingredients','ingredient_classifications','brands','product_families','infrastructure_types','application_methods','product_ingredients','product_synonyms','sowing_projects','project_lots','lot_subdivisions','sowing_stages','lot_corrections','application_orders','application_order_products','application_targets','application_actual_products','application_changes','application_change_products','sowing_groups','sowing_group_members'] loop
    execute format('create policy menu_read_guard on public.%I as restrictive for select to authenticated using ((select rcfito_private.menu_data_access(%L)))',t,t);
  end loop;
end $$;

create table public.user_access_changes(
  id uuid primary key default gen_random_uuid(), user_id uuid references public.profiles(id) on delete set null,
  changed_by uuid references public.profiles(id) on delete set null, changed_by_name text not null,
  changed_at timestamptz not null default clock_timestamp(), before jsonb not null, after jsonb not null
);
create index user_access_changes_user_idx on public.user_access_changes(user_id,changed_at desc);
create index user_access_changes_actor_idx on public.user_access_changes(changed_by);
alter table public.user_access_changes enable row level security;
revoke all on public.user_access_changes from public,anon,authenticated;
grant select on public.user_access_changes to authenticated;
create policy access_history_admin on public.user_access_changes for select to authenticated using((select rcfito_private.is_admin()));
revoke insert,update,delete on public.profiles,public.user_agricultural_units from authenticated;

create function rcfito_private.access_snapshot(p_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object('role',p.role,'active',p.active,'menus',case when p.role='admin' then rcfito_private.menu_keys() else p.menu_permissions end,
    'agricultural_unit_ids',coalesce((select jsonb_agg(a.agricultural_unit_id order by a.agricultural_unit_id) from public.user_agricultural_units a where a.user_id=p.id),'[]'))
  from public.profiles p where p.id=p_id
$$;
create function rcfito_private.set_user_menu_access(p_user_id uuid,p_role text,p_active boolean,p_agricultural_unit_ids uuid[],p_menu_permissions text[],p_expected_version integer) returns void
language plpgsql security definer set search_path='' as $$
declare previous public.profiles; menus text[]; before_state jsonb; after_state jsonb; actor text;
begin
  perform rcfito_private.require_admin();
  perform pg_advisory_xact_lock(hashtext('rcfito-user-access'));
  -- Recheck after serializing concurrent administrator changes.
  perform rcfito_private.require_admin();
  if p_role is null or p_role not in ('admin','viewer') or p_active is null then raise exception 'Rol o estado inválido'; end if;
  select * into previous from public.profiles where id=p_user_id for update;
  if not found then raise exception 'Primero cree la cuenta en Auth'; end if;
  if p_expected_version is not null and p_expected_version<>previous.access_version then raise exception 'El acceso cambió. Actualiza y revisa los permisos antes de guardar'; end if;
  if previous.role='admin' and previous.active and (p_role<>'admin' or not p_active)
    and not exists(select 1 from public.profiles where id<>p_user_id and role='admin' and active) then raise exception 'Debe conservar al menos un administrador activo'; end if;
  if cardinality(p_agricultural_unit_ids)>500 or array_position(p_agricultural_unit_ids,null) is not null
    or exists(select 1 from unnest(p_agricultural_unit_ids) as requested(id) where not exists(select 1 from public.agricultural_units a where a.id=requested.id)) then raise exception 'Selecciona agrícolas válidas'; end if;
  menus:=coalesce(p_menu_permissions,previous.menu_permissions);
  if p_menu_permissions is null and previous.role='admin' and p_role='viewer' then menus:=array_remove(array_remove(array_remove(menus,'ai_capture'),'users'),'connection'); end if;
  if cardinality(menus)>50 or array_position(menus,null) is not null or not menus<@rcfito_private.menu_keys() then raise exception 'La selección contiene un menú inválido'; end if;
  if p_role='viewer' and menus&&array['ai_capture','users','connection'] then raise exception 'Captura con IA, usuarios y configuración requieren administrador'; end if;
  if p_role='admin' then menus:=rcfito_private.menu_keys(); end if;
  select coalesce(array_agg(k order by k),'{}') into menus from (select distinct unnest(menus) k) x;
  before_state:=rcfito_private.access_snapshot(p_user_id);
  update public.profiles set role=p_role,active=p_active,menu_permissions=menus,access_version=access_version+1 where id=p_user_id;
  delete from public.user_agricultural_units where user_id=p_user_id;
  insert into public.user_agricultural_units(user_id,agricultural_unit_id) select p_user_id,unnest(coalesce(p_agricultural_unit_ids,'{}')) on conflict do nothing;
  after_state:=rcfito_private.access_snapshot(p_user_id);
  select display_name into actor from public.profiles where id=auth.uid();
  insert into public.user_access_changes(user_id,changed_by,changed_by_name,before,after) values(p_user_id,auth.uid(),coalesce(actor,'Administración'),before_state,after_state);
end $$;
create function public.set_user_menu_access(p_user_id uuid,p_role text,p_active boolean,p_agricultural_unit_ids uuid[],p_menu_permissions text[],p_expected_version integer) returns void
language plpgsql security invoker set search_path='' as $$
begin
  if p_expected_version is null or p_expected_version<0 then raise exception 'Actualiza los permisos antes de guardar'; end if;
  perform rcfito_private.set_user_menu_access(p_user_id,p_role,p_active,p_agricultural_unit_ids,p_menu_permissions,p_expected_version);
end $$;
create or replace function public.set_user_access(p_user_id uuid,p_role text,p_active boolean,p_agricultural_unit_ids uuid[]) returns void language sql security invoker set search_path='' as $$
  select rcfito_private.set_user_menu_access(p_user_id,p_role,p_active,p_agricultural_unit_ids,null,null)
$$;

-- Hidden catalogs expose only the names actually needed by authorized selectors.
-- This private definer intentionally bypasses catalog-menu RLS while checking the
-- active account, enabled feature and every agricultural reference explicitly.
create function rcfito_private.menu_reference_catalogs() returns jsonb language plpgsql stable security definer set search_path='' as $$
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
  ), grouped as (select kind,jsonb_agg((jsonb_build_object('id',id,'name',name,'active',active)||case when kind='fields' then jsonb_build_object('agricultural_unit_id',(select agricultural_unit_id from public.fields f where f.id=refs.id)) when kind='varieties' then jsonb_build_object('crop_id',(select crop_id from public.varieties v where v.id=refs.id)) else '{}'::jsonb end) order by id) rows from refs group by kind)
  select coalesce(jsonb_object_agg(kind,rows),'{}') into result from grouped;
  return result;
end $$;
create function public.menu_reference_catalogs() returns jsonb language sql stable security invoker set search_path='' as $$ select rcfito_private.menu_reference_catalogs() $$;

-- Keep the invoker query implementation and its agricultural RLS. Only the
-- authorized wrapper can enable the transaction-local catalog lookup context.
alter function public.application_query(jsonb) set schema rcfito_private;
alter function public.application_query_stamp() set schema rcfito_private;
alter function public.application_query_resolve(jsonb,uuid) set schema rcfito_private;
create function public.application_query(p_query jsonb) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare result jsonb; previous text:=current_setting('rcfito.menu_query',true);
begin perform rcfito_private.require_menu('queries'); perform set_config('rcfito.menu_query','queries',true);
  result:=rcfito_private.application_query(p_query); perform set_config('rcfito.menu_query',coalesce(previous,''),true);return result; end $$;
create function public.application_query_stamp() returns jsonb language plpgsql stable security invoker set search_path='' as $$
begin perform rcfito_private.require_menu('queries');return rcfito_private.application_query_stamp();end $$;
create function public.application_query_resolve(p_query jsonb,p_last_unit_id uuid default null) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare result jsonb; previous text:=current_setting('rcfito.menu_query',true);
begin perform rcfito_private.require_menu('queries'); perform set_config('rcfito.menu_query','queries',true);
  result:=rcfito_private.application_query_resolve(p_query,p_last_unit_id); perform set_config('rcfito.menu_query',coalesce(previous,''),true);return result; end $$;

revoke all on function rcfito_private.access_snapshot(uuid) from public,anon,authenticated;
revoke all on function rcfito_private.menu_keys(),rcfito_private.has_menu(text),rcfito_private.require_menu(text),rcfito_private.menu_data_access(text),rcfito_private.menu_reference_catalogs(),rcfito_private.set_user_menu_access(uuid,text,boolean,uuid[],text[],integer),
  public.set_user_menu_access(uuid,text,boolean,uuid[],text[],integer),public.menu_reference_catalogs(),public.application_query(jsonb),public.application_query_stamp(),public.application_query_resolve(jsonb,uuid) from public,anon,authenticated;
grant execute on function rcfito_private.menu_keys(),rcfito_private.has_menu(text),rcfito_private.require_menu(text),rcfito_private.menu_data_access(text),rcfito_private.menu_reference_catalogs(),rcfito_private.set_user_menu_access(uuid,text,boolean,uuid[],text[],integer),
  public.set_user_menu_access(uuid,text,boolean,uuid[],text[],integer),public.menu_reference_catalogs(),public.application_query(jsonb),public.application_query_stamp(),public.application_query_resolve(jsonb,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
