-- rcfito: catálogos y proyectos de siembra. No contiene datos reales.
begin;
create schema if not exists rcfito_private;
revoke all on schema rcfito_private from public;
grant usage on schema rcfito_private to authenticated;

create table public.agricultural_units (
  id uuid primary key default gen_random_uuid(), code text not null unique check (btrim(code) <> ''),
  name text not null check (btrim(name) <> ''), active boolean not null default true,
  created_at timestamptz not null default now()
);
create table public.fields (
  id uuid primary key default gen_random_uuid(), agricultural_unit_id uuid not null references public.agricultural_units on delete restrict,
  code text not null check (btrim(code) <> ''), name text not null check (btrim(name) <> ''),
  active boolean not null default true, created_at timestamptz not null default now(),
  unique (agricultural_unit_id, code), unique(id, agricultural_unit_id)
);
do $$
declare t text;
begin
  foreach t in array array['crops','brands','product_families','active_ingredients','infrastructure_types','application_methods'] loop
    execute format('create table public.%I (id uuid primary key default gen_random_uuid(), code text not null unique check (btrim(code) <> ''''), name text not null check (btrim(name) <> ''''), active boolean not null default true, created_at timestamptz not null default now())', t);
  end loop;
end $$;
create table public.varieties (
  id uuid primary key default gen_random_uuid(), crop_id uuid not null references public.crops on delete restrict,
  code text not null check (btrim(code) <> ''), name text not null check (btrim(name) <> ''),
  active boolean not null default true, created_at timestamptz not null default now(), unique(crop_id,code), unique(id,crop_id)
);
create table public.products (
  id uuid primary key default gen_random_uuid(), code text not null unique check (btrim(code) <> ''),
  name text not null check (btrim(name) <> ''), unit text not null check (unit in ('g','ml')),
  default_dose numeric(12,4) not null default 0 check(default_dose >= 0),
  brand_id uuid references public.brands on delete restrict,
  product_family_id uuid references public.product_families on delete restrict,
  active boolean not null default true, created_at timestamptz not null default now()
);
create table public.product_ingredients (
  product_id uuid not null references public.products on delete cascade,
  active_ingredient_id uuid not null references public.active_ingredients on delete restrict,
  concentration text check(concentration is null or btrim(concentration) <> ''),
  primary key(product_id,active_ingredient_id)
);
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text not null default '', role text not null default 'viewer' check(role in ('admin','viewer')),
  active boolean not null default true, created_at timestamptz not null default now()
);
create table public.user_agricultural_units (
  user_id uuid not null references public.profiles on delete cascade,
  agricultural_unit_id uuid not null references public.agricultural_units on delete restrict,
  primary key(user_id,agricultural_unit_id)
);
create table public.sowing_projects (
  id uuid primary key default gen_random_uuid(), agricultural_unit_id uuid not null references public.agricultural_units on delete restrict,
  name text not null check(btrim(name) <> ''), season text not null check(btrim(season) <> ''),
  status text not null default 'draft' check(status in ('draft','active','closed')),
  start_date date not null, observations text not null default '',
  agricultural_unit_name text not null default '', created_at timestamptz not null default now(), closed_at timestamptz,
  unique(agricultural_unit_id,season)
);
create unique index sowing_projects_one_open on public.sowing_projects(agricultural_unit_id) where status <> 'closed';
create table public.project_lots (
  id uuid primary key default gen_random_uuid(), project_id uuid not null references public.sowing_projects on delete restrict,
  field_id uuid not null references public.fields on delete restrict,
  code text not null check(btrim(code) <> ''), name text not null check(btrim(name) <> ''),
  area_ha numeric(12,4) not null check(area_ha > 0),
  infrastructure_type_id uuid not null references public.infrastructure_types on delete restrict,
  active boolean not null default true,
  field_name text not null default '', agricultural_unit_name text not null default '', infrastructure_type_name text not null default '',
  created_at timestamptz not null default now(), unique(project_id,field_id,code)
);
create table public.lot_subdivisions (
  id uuid primary key default gen_random_uuid(), lot_id uuid not null references public.project_lots on delete restrict,
  code text not null check(btrim(code) <> ''), name text not null check(btrim(name) <> ''),
  area_ha numeric(12,4) not null check(area_ha > 0), active boolean not null default true,
  created_at timestamptz not null default now(), retired_at timestamptz
);
create unique index lot_subdivisions_current_code on public.lot_subdivisions(lot_id,code) where active;
create table public.sowing_stages (
  id uuid primary key default gen_random_uuid(), subdivision_id uuid not null references public.lot_subdivisions on delete restrict,
  stage_number integer not null check(stage_number > 0), crop_id uuid not null references public.crops on delete restrict,
  variety_id uuid not null, area_ha numeric(12,4) not null check(area_ha > 0),
  planned_sowing_date date not null, actual_sowing_date date, end_date date,
  status text not null default 'planned' check(status in ('planned','planted','closed')),
  observations text not null default '', crop_name text not null default '', variety_name text not null default '',
  created_at timestamptz not null default now(), unique(subdivision_id,stage_number),
  foreign key(variety_id,crop_id) references public.varieties(id,crop_id) on delete restrict,
  check((status = 'planned' and actual_sowing_date is null and end_date is null)
    or (status = 'planted' and actual_sowing_date is not null and end_date is null)
    or (status = 'closed' and actual_sowing_date is not null and end_date is not null and end_date >= actual_sowing_date))
);
create unique index sowing_stages_one_planted on public.sowing_stages(subdivision_id) where status = 'planted';
create index fields_agricultural_unit_idx on public.fields(agricultural_unit_id);
create index user_agricultural_units_unit_idx on public.user_agricultural_units(agricultural_unit_id);
create index project_lots_project_idx on public.project_lots(project_id);
create index project_lots_field_idx on public.project_lots(field_id);
create index lot_subdivisions_lot_idx on public.lot_subdivisions(lot_id);
create index sowing_stages_subdivision_idx on public.sowing_stages(subdivision_id);
create index sowing_stages_crop_idx on public.sowing_stages(crop_id);
create index varieties_crop_idx on public.varieties(crop_id);
create index product_ingredients_ingredient_idx on public.product_ingredients(active_ingredient_id);
create index products_brand_idx on public.products(brand_id);
create index products_family_idx on public.products(product_family_id);
create index project_lots_infrastructure_idx on public.project_lots(infrastructure_type_id);

-- Private helpers intentionally read server-controlled profiles, never user_metadata.
create function rcfito_private.is_active_user() returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists(select 1 from public.profiles where id=auth.uid() and active)
$$;
create function rcfito_private.is_admin() returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists(select 1 from public.profiles where id=auth.uid() and active and role='admin')
$$;
create function rcfito_private.can_access_unit(p_unit uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists(select 1 from public.profiles p where p.id=auth.uid() and p.active
    and (p.role='admin' or exists(select 1 from public.user_agricultural_units a where a.user_id=p.id and a.agricultural_unit_id=p_unit)))
$$;
create function rcfito_private.require_admin() returns void language plpgsql security invoker set search_path = '' as $$
begin
  if not rcfito_private.is_admin() then raise exception 'Esta operación requiere un administrador activo' using errcode='42501'; end if;
end $$;
create function rcfito_private.open_project(p_id uuid) returns public.sowing_projects language plpgsql security invoker set search_path = '' as $$
declare p public.sowing_projects;
begin
  select * into p from public.sowing_projects where id=p_id for update;
  if not found then raise exception 'Proyecto no disponible' using errcode='P0001'; end if;
  if p.status='closed' then raise exception 'El proyecto está cerrado y conserva su historial' using errcode='P0001'; end if;
  return p;
end $$;

-- Called only by the trusted Auth trigger; privileges are revoked below.
create function rcfito_private.handle_new_user() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id,display_name,role) values(new.id, coalesce(new.raw_user_meta_data->>'display_name',new.email,''),'viewer') on conflict(id) do nothing;
  return new;
end $$;
create trigger rcfito_new_auth_user after insert on auth.users for each row execute function rcfito_private.handle_new_user();
insert into public.profiles(id,display_name) select id,coalesce(email,'') from auth.users on conflict(id) do nothing;

create function rcfito_private.guard_project() returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op='DELETE' then
    if old.status='closed' then raise exception 'No se elimina un proyecto histórico'; end if;
    return old;
  end if;
  if tg_op='UPDATE' then
    if old.status='closed' then raise exception 'El proyecto está cerrado y conserva su historial'; end if;
    if new.agricultural_unit_id<>old.agricultural_unit_id then raise exception 'La agrícola de un proyecto no se puede cambiar'; end if;
    new.agricultural_unit_name := old.agricultural_unit_name;
    if new.status='draft' and old.status='active' then raise exception 'Una temporada activa no vuelve a borrador'; end if;
  else
    if new.status<>'draft' then raise exception 'Un proyecto nuevo se crea como borrador'; end if;
    perform 1 from public.agricultural_units where id=new.agricultural_unit_id and active for update;
    if not found then raise exception 'La agrícola está inactiva o no disponible'; end if;
    select name into new.agricultural_unit_name from public.agricultural_units where id=new.agricultural_unit_id;
  end if;
  if new.status='closed' then
    if exists(select 1 from public.sowing_stages s join public.lot_subdivisions d on d.id=s.subdivision_id join public.project_lots l on l.id=d.lot_id where l.project_id=new.id and s.status<>'closed') then
      raise exception 'Cierre las etapas sembradas y retire las planeaciones pendientes antes de cerrar el proyecto';
    end if;
    new.closed_at:=now();
  else new.closed_at:=null;
  end if;
  return new;
end $$;
create trigger rcfito_guard_project before insert or update or delete on public.sowing_projects for each row execute function rcfito_private.guard_project();

create function rcfito_private.guard_field() returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if new.agricultural_unit_id<>old.agricultural_unit_id and exists(select 1 from public.project_lots where field_id=old.id) then
    raise exception 'El campo tiene historial y no puede cambiar de agrícola';
  end if;
  return new;
end $$;
create trigger rcfito_guard_field before update on public.fields for each row execute function rcfito_private.guard_field();

create function rcfito_private.guard_lot() returns trigger language plpgsql security invoker set search_path = '' as $$
declare p public.sowing_projects; f public.fields;
begin
  if tg_op='DELETE' then perform rcfito_private.open_project(old.project_id); return old; end if;
  p:=rcfito_private.open_project(new.project_id);
  if tg_op='UPDATE' then
    if new.project_id<>old.project_id then raise exception 'El lote no cambia de proyecto'; end if;
    if exists(select 1 from public.sowing_stages s join public.lot_subdivisions d on d.id=s.subdivision_id where d.lot_id=old.id) then
      raise exception 'El lote ya tiene siembras; conserve su configuración histórica';
    end if;
  end if;
  select * into f from public.fields where id=new.field_id;
  if f.agricultural_unit_id is distinct from p.agricultural_unit_id or not f.active then raise exception 'El campo debe estar activo y pertenecer a la agrícola del proyecto'; end if;
  if not exists(select 1 from public.infrastructure_types where id=new.infrastructure_type_id and active) then raise exception 'Seleccione una infraestructura activa'; end if;
  new.field_name:=f.name; new.agricultural_unit_name:=p.agricultural_unit_name;
  select name into new.infrastructure_type_name from public.infrastructure_types where id=new.infrastructure_type_id;
  return new;
end $$;
create trigger rcfito_guard_lot before insert or update or delete on public.project_lots for each row execute function rcfito_private.guard_lot();

create function rcfito_private.guard_subdivision() returns trigger language plpgsql security invoker set search_path = '' as $$
declare l public.project_lots; used_area numeric;
begin
  select * into l from public.project_lots where id=case when tg_op='DELETE' then old.lot_id else new.lot_id end for update;
  perform rcfito_private.open_project(l.project_id);
  if tg_op='DELETE' then return old; end if;
  if tg_op='UPDATE' then
    if new.lot_id<>old.lot_id then raise exception 'Una subdivisión no cambia de lote'; end if;
    if exists(select 1 from public.sowing_stages where subdivision_id=old.id) and
       (new.name,new.code,new.area_ha) is distinct from (old.name,old.code,old.area_ha) then raise exception 'La subdivisión tiene historial; cree una configuración nueva'; end if;
    if not old.active and new is distinct from old then raise exception 'Una subdivisión retirada conserva su historial'; end if;
    if old.active and not new.active then
      if exists(select 1 from public.sowing_stages where subdivision_id=old.id and status<>'closed') then raise exception 'Cierre o retire las etapas pendientes antes de redistribuir'; end if;
      new.retired_at:=now();
    end if;
  end if;
  if new.active then
    select coalesce(sum(area_ha),0) into used_area from public.lot_subdivisions where lot_id=new.lot_id and active and id<>new.id;
    if used_area+new.area_ha>l.area_ha then raise exception 'La superficie de subdivisiones excede la superficie del lote'; end if;
  end if;
  return new;
end $$;
create trigger rcfito_guard_subdivision before insert or update or delete on public.lot_subdivisions for each row execute function rcfito_private.guard_subdivision();

create function rcfito_private.default_subdivision() returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op='INSERT' then
    insert into public.lot_subdivisions(lot_id,code,name,area_ha) values(new.id,'01','Lote completo',new.area_ha);
  elsif new.area_ha<>old.area_ha and (select count(*) from public.lot_subdivisions where lot_id=new.id and active)=1 then
    update public.lot_subdivisions set area_ha=new.area_ha where lot_id=new.id and active;
  elsif (select coalesce(sum(area_ha),0) from public.lot_subdivisions where lot_id=new.id and active)>new.area_ha then
    raise exception 'La superficie del lote es menor que sus subdivisiones';
  end if;
  return new;
end $$;
create trigger rcfito_default_subdivision after insert or update of area_ha on public.project_lots for each row execute function rcfito_private.default_subdivision();

create function rcfito_private.guard_stage() returns trigger language plpgsql security invoker set search_path = '' as $$
declare d public.lot_subdivisions; l public.project_lots; p public.sowing_projects; previous_end date; max_number integer;
begin
  select * into d from public.lot_subdivisions where id=case when tg_op='DELETE' then old.subdivision_id else new.subdivision_id end for update;
  select * into l from public.project_lots where id=d.lot_id;
  p:=rcfito_private.open_project(l.project_id);
  if tg_op='DELETE' then
    if old.status<>'planned' then raise exception 'Solo puede retirar una etapa planeada sin siembra'; end if;
    if exists(select 1 from public.sowing_stages where subdivision_id=old.subdivision_id and stage_number>old.stage_number) then raise exception 'Retire primero la última etapa planeada'; end if;
    return old;
  end if;
  if not d.active or not l.active then raise exception 'La subdivisión y el lote deben estar vigentes'; end if;
  if new.area_ha>d.area_ha then raise exception 'La superficie de siembra excede la subdivisión'; end if;
  if tg_op='INSERT' then
    if new.status<>'planned' then raise exception 'Una etapa nueva se registra como planeación'; end if;
    select coalesce(max(stage_number),0) into max_number from public.sowing_stages where subdivision_id=d.id;
    new.stage_number:=max_number+1;
  else
    if (new.subdivision_id,new.stage_number) is distinct from (old.subdivision_id,old.stage_number) then raise exception 'La etapa no cambia de subdivisión ni de número'; end if;
    if old.status='closed' then raise exception 'Una etapa cerrada conserva su historial'; end if;
    if old.status='planted' and (new.crop_id,new.variety_id,new.area_ha,new.planned_sowing_date,new.actual_sowing_date,new.observations) is distinct from (old.crop_id,old.variety_id,old.area_ha,old.planned_sowing_date,old.actual_sowing_date,old.observations) then raise exception 'La siembra ya realizada conserva sus datos'; end if;
    if old.status='planted' and new.status<>'closed' then raise exception 'Una etapa sembrada solo puede cerrarse'; end if;
    if old.status='planned' and new.status='closed' then raise exception 'Primero registre la realización de la siembra'; end if;
  end if;
  if new.status='planted' then
    if p.status<>'active' then raise exception 'Active el proyecto antes de registrar una siembra realizada'; end if;
    if exists(select 1 from public.sowing_stages where subdivision_id=d.id and id<>new.id and stage_number<new.stage_number and status<>'closed') then raise exception 'Cierre las etapas anteriores antes de sembrar la siguiente'; end if;
    select max(end_date) into previous_end from public.sowing_stages where subdivision_id=d.id and stage_number<new.stage_number;
    if previous_end is not null and new.actual_sowing_date<previous_end then raise exception 'La nueva siembra no puede preceder el cierre de la anterior'; end if;
  end if;
  if tg_op='INSERT' or old.status='planned' then
    if not exists(select 1 from public.crops where id=new.crop_id and active) or not exists(select 1 from public.varieties where id=new.variety_id and crop_id=new.crop_id and active) then raise exception 'Seleccione un cultivo y variedad activos y relacionados'; end if;
    select name into new.crop_name from public.crops where id=new.crop_id;
    select name into new.variety_name from public.varieties where id=new.variety_id;
  else
    new.crop_name:=old.crop_name; new.variety_name:=old.variety_name;
  end if;
  return new;
end $$;
create trigger rcfito_guard_stage before insert or update or delete on public.sowing_stages for each row execute function rcfito_private.guard_stage();

-- RLS covers direct table endpoints as well as RPC invocations.
do $$
declare t text;
begin
  foreach t in array array['agricultural_units','fields','crops','varieties','brands','product_families','active_ingredients','infrastructure_types','application_methods','products','product_ingredients','profiles','user_agricultural_units','sowing_projects','project_lots','lot_subdivisions','sowing_stages'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from anon, authenticated',t);
    execute format('grant select, insert, update, delete on public.%I to authenticated',t);
    execute format('create policy admin_all on public.%I for all to authenticated using (rcfito_private.is_admin()) with check (rcfito_private.is_admin())',t);
  end loop;
  foreach t in array array['crops','varieties','brands','product_families','active_ingredients','infrastructure_types','application_methods','products','product_ingredients'] loop
    execute format('create policy active_reader on public.%I for select to authenticated using (rcfito_private.is_active_user())',t);
  end loop;
end $$;
create policy assigned_unit on public.agricultural_units for select to authenticated using(rcfito_private.can_access_unit(id));
create policy assigned_fields on public.fields for select to authenticated using(rcfito_private.can_access_unit(agricultural_unit_id));
create policy own_profile on public.profiles for select to authenticated using(id=auth.uid() and active);
create policy own_assignments on public.user_agricultural_units for select to authenticated using(user_id=auth.uid() and rcfito_private.is_active_user());
create policy assigned_projects on public.sowing_projects for select to authenticated using(rcfito_private.can_access_unit(agricultural_unit_id));
create policy assigned_lots on public.project_lots for select to authenticated using(exists(select 1 from public.sowing_projects p where p.id=project_id and rcfito_private.can_access_unit(p.agricultural_unit_id)));
create policy assigned_subdivisions on public.lot_subdivisions for select to authenticated using(exists(select 1 from public.project_lots l join public.sowing_projects p on p.id=l.project_id where l.id=lot_id and rcfito_private.can_access_unit(p.agricultural_unit_id)));
create policy assigned_stages on public.sowing_stages for select to authenticated using(exists(select 1 from public.lot_subdivisions d join public.project_lots l on l.id=d.lot_id join public.sowing_projects p on p.id=l.project_id where d.id=subdivision_id and rcfito_private.can_access_unit(p.agricultural_unit_id)));

create function public.create_sowing_project(p_data jsonb) returns uuid language plpgsql security invoker set search_path = '' as $$
declare result uuid;
begin
  perform rcfito_private.require_admin();
  insert into public.sowing_projects(agricultural_unit_id,name,season,start_date,observations)
  values((p_data->>'agricultural_unit_id')::uuid,p_data->>'name',p_data->>'season',coalesce(nullif(p_data->>'start_date','')::date,current_date),coalesce(p_data->>'observations','')) returning id into result;
  return result;
end $$;
create function public.create_project_lot(p_data jsonb) returns uuid language plpgsql security invoker set search_path = '' as $$
declare result uuid;
begin
  perform rcfito_private.require_admin();
  insert into public.project_lots(project_id,field_id,code,name,area_ha,infrastructure_type_id)
  values((p_data->>'project_id')::uuid,(p_data->>'field_id')::uuid,p_data->>'code',p_data->>'name',(p_data->>'area_ha')::numeric,(p_data->>'infrastructure_type_id')::uuid) returning id into result;
  return result;
end $$;
create function public.replace_lot_subdivisions(p_lot_id uuid,p_subdivisions jsonb) returns void language plpgsql security invoker set search_path = '' as $$
declare item jsonb;
begin
  perform rcfito_private.require_admin();
  if p_subdivisions is null or jsonb_typeof(p_subdivisions) is distinct from 'array' or jsonb_array_length(p_subdivisions)<1 then raise exception 'Capture al menos una subdivisión'; end if;
  perform 1 from public.project_lots where id=p_lot_id for update;
  if not found then raise exception 'Lote no disponible'; end if;
  update public.lot_subdivisions set active=false where lot_id=p_lot_id and active;
  for item in select value from jsonb_array_elements(p_subdivisions) loop
    insert into public.lot_subdivisions(lot_id,code,name,area_ha) values(p_lot_id,item->>'code',item->>'name',(item->>'area_ha')::numeric);
  end loop;
end $$;
create function public.delete_project_lot(p_lot_id uuid) returns void language plpgsql security invoker set search_path = '' as $$
declare lot public.project_lots;
begin
  perform rcfito_private.require_admin();
  select * into lot from public.project_lots where id=p_lot_id for update;
  if not found then raise exception 'Lote no disponible'; end if;
  perform rcfito_private.open_project(lot.project_id);
  if exists(select 1 from public.sowing_stages s join public.lot_subdivisions d on d.id=s.subdivision_id where d.lot_id=lot.id) then raise exception 'El lote tiene siembras; conserve su historial'; end if;
  delete from public.lot_subdivisions where lot_id=lot.id;
  delete from public.project_lots where id=lot.id;
end $$;
create function public.copy_sowing_project(p_source_project_id uuid,p_data jsonb) returns uuid language plpgsql security invoker set search_path = '' as $$
declare source public.sowing_projects; result uuid; lot public.project_lots; new_lot uuid; d public.lot_subdivisions;
begin
  perform rcfito_private.require_admin();
  select * into source from public.sowing_projects where id=p_source_project_id for update;
  if not found or source.status<>'closed' then raise exception 'Solo se copia una temporada cerrada'; end if;
  result:=public.create_sowing_project(p_data || jsonb_build_object('agricultural_unit_id',source.agricultural_unit_id));
  for lot in select * from public.project_lots where project_id=source.id and active loop
    new_lot:=public.create_project_lot(jsonb_build_object('project_id',result,'field_id',lot.field_id,'code',lot.code,'name',lot.name,'area_ha',lot.area_ha,'infrastructure_type_id',lot.infrastructure_type_id));
    -- The inserted default has no history and can be replaced atomically.
    delete from public.lot_subdivisions where lot_id=new_lot;
    for d in select * from public.lot_subdivisions where lot_id=lot.id and active loop
      insert into public.lot_subdivisions(lot_id,code,name,area_ha) values(new_lot,d.code,d.name,d.area_ha);
    end loop;
    if not exists(select 1 from public.lot_subdivisions where lot_id=new_lot) then
      insert into public.lot_subdivisions(lot_id,code,name,area_ha) values(new_lot,'01','Lote completo',lot.area_ha);
    end if;
  end loop;
  return result;
end $$;
create function public.save_sowing_stage(p_data jsonb) returns uuid language plpgsql security invoker set search_path = '' as $$
declare result uuid;
begin
  perform rcfito_private.require_admin();
  if nullif(p_data->>'id','') is null or not exists(select 1 from public.sowing_stages where id=(p_data->>'id')::uuid) then
    insert into public.sowing_stages(id,subdivision_id,stage_number,crop_id,variety_id,area_ha,planned_sowing_date,observations)
    values(coalesce(nullif(p_data->>'id','')::uuid,gen_random_uuid()),(p_data->>'subdivision_id')::uuid,1,(p_data->>'crop_id')::uuid,(p_data->>'variety_id')::uuid,(p_data->>'area_ha')::numeric,(p_data->>'planned_sowing_date')::date,coalesce(p_data->>'observations','')) returning id into result;
  else
    update public.sowing_stages set crop_id=(p_data->>'crop_id')::uuid,variety_id=(p_data->>'variety_id')::uuid,area_ha=(p_data->>'area_ha')::numeric,planned_sowing_date=(p_data->>'planned_sowing_date')::date,observations=coalesce(p_data->>'observations','') where id=(p_data->>'id')::uuid and status='planned' returning id into result;
    if result is null then raise exception 'La etapa no está disponible para editar planeación'; end if;
  end if;
  return result;
end $$;
create function public.transition_sowing_stage(p_stage_id uuid,p_status text,p_date date) returns void language plpgsql security invoker set search_path = '' as $$
begin
  perform rcfito_private.require_admin();
  if p_date is null or p_status is null or p_status not in ('planted','closed') then raise exception 'Indique fecha y transición válidas'; end if;
  if p_status='planted' then
    update public.sowing_stages set status='planted',actual_sowing_date=p_date where id=p_stage_id and status='planned';
  else
    update public.sowing_stages set status='closed',end_date=p_date where id=p_stage_id and status='planted';
  end if;
  if not found then raise exception 'La transición no corresponde al estado actual de la etapa'; end if;
end $$;
create function public.discard_planned_stage(p_stage_id uuid) returns void language plpgsql security invoker set search_path = '' as $$
begin
  perform rcfito_private.require_admin();
  delete from public.sowing_stages where id=p_stage_id and status='planned';
  if not found then raise exception 'Solo puede retirar una etapa planeada'; end if;
end $$;
create function public.close_sowing_project(p_project_id uuid) returns void language plpgsql security invoker set search_path = '' as $$
begin
  perform rcfito_private.require_admin();
  update public.sowing_projects set status='closed' where id=p_project_id and status<>'closed';
  if not found then raise exception 'El proyecto no está abierto'; end if;
end $$;
create function public.save_product(p_data jsonb,p_ingredients jsonb default '[]') returns uuid language plpgsql security invoker set search_path = '' as $$
declare result uuid; item jsonb; existing_ingredients uuid[] := '{}';
begin
  perform rcfito_private.require_admin();
  if p_ingredients is null or jsonb_typeof(p_ingredients) is distinct from 'array' then raise exception 'La composición debe ser una lista'; end if;
  if nullif(p_data->>'id','') is null then
    insert into public.products(code,name,unit,default_dose,brand_id,product_family_id,active)
    values(p_data->>'code',p_data->>'name',p_data->>'unit',coalesce((p_data->>'default_dose')::numeric,0),nullif(p_data->>'brand_id','')::uuid,nullif(p_data->>'product_family_id','')::uuid,coalesce((p_data->>'active')::boolean,true)) returning id into result;
  else
    update public.products set code=p_data->>'code',name=p_data->>'name',unit=p_data->>'unit',default_dose=coalesce((p_data->>'default_dose')::numeric,0),brand_id=nullif(p_data->>'brand_id','')::uuid,product_family_id=nullif(p_data->>'product_family_id','')::uuid,active=coalesce((p_data->>'active')::boolean,true) where id=(p_data->>'id')::uuid returning id into result;
    if result is null then raise exception 'Producto no disponible'; end if;
    select coalesce(array_agg(active_ingredient_id),'{}') into existing_ingredients from public.product_ingredients where product_id=result;
    delete from public.product_ingredients where product_id=result;
  end if;
  for item in select value from jsonb_array_elements(p_ingredients) loop
    if not exists(select 1 from public.active_ingredients where id=(item->>'active_ingredient_id')::uuid and active) and not ((item->>'active_ingredient_id')::uuid=any(existing_ingredients)) then raise exception 'Seleccione ingredientes activos disponibles'; end if;
    insert into public.product_ingredients(product_id,active_ingredient_id,concentration) values(result,(item->>'active_ingredient_id')::uuid,nullif(btrim(item->>'concentration'),''));
  end loop;
  return result;
end $$;
create function public.set_user_access(p_user_id uuid,p_role text,p_active boolean,p_agricultural_unit_ids uuid[]) returns void language plpgsql security invoker set search_path = '' as $$
begin
  perform rcfito_private.require_admin();
  if p_role is null or p_role not in ('admin','viewer') or p_active is null then raise exception 'Rol o estado inválido'; end if;
  -- Serialize administrator changes to retain at least one active administrator.
  perform pg_advisory_xact_lock(hashtext('rcfito-user-access'));
  if exists(select 1 from public.profiles where id=p_user_id and role='admin' and active)
    and (p_role<>'admin' or not p_active)
    and not exists(select 1 from public.profiles where id<>p_user_id and role='admin' and active) then raise exception 'Debe conservar al menos un administrador activo'; end if;
  update public.profiles set role=p_role,active=p_active where id=p_user_id;
  if not found then raise exception 'Primero cree la cuenta en Auth'; end if;
  delete from public.user_agricultural_units where user_id=p_user_id;
  insert into public.user_agricultural_units(user_id,agricultural_unit_id) select p_user_id,unnest(coalesce(p_agricultural_unit_ids,'{}')) on conflict do nothing;
end $$;

-- Public functions are explicitly executable only by authenticated clients.
revoke all on all functions in schema rcfito_private from public, anon, authenticated;
grant execute on function rcfito_private.is_active_user(),rcfito_private.is_admin(),rcfito_private.can_access_unit(uuid),rcfito_private.require_admin(),rcfito_private.open_project(uuid) to authenticated;
do $$
declare fn record;
begin
  for fn in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('create_sowing_project','copy_sowing_project','create_project_lot','delete_project_lot','replace_lot_subdivisions','save_sowing_stage','transition_sowing_stage','discard_planned_stage','close_sowing_project','save_product','set_user_access') loop
    execute format('revoke all on function %s from public, anon, authenticated',fn.signature);
    execute format('grant execute on function %s to authenticated',fn.signature);
  end loop;
end $$;
commit;
