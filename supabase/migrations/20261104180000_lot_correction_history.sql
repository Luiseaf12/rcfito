begin;

set local lock_timeout='10s';
set local statement_timeout='60s';
lock table public.application_actual_products,public.application_changes,public.application_order_products,public.application_orders,public.application_targets,public.lot_subdivisions,public.project_lots,public.sowing_group_members,public.sowing_groups,public.sowing_projects,public.sowing_stages in share mode;
create temporary table rcf038_original_data(table_name text primary key,row_count bigint,fingerprint text) on commit drop;
do $$ declare t text; excluded text[]; n bigint; h text; begin
  foreach t in array array['application_actual_products','application_changes','application_order_products','application_orders','application_targets','lot_subdivisions','project_lots','sowing_group_members','sowing_groups','sowing_projects','sowing_stages'] loop
    excluded:=case t when 'project_lots' then array['correction_version'] when 'application_targets' then array['area_correction_id'] else '{}'::text[] end;
    execute format('select count(*),md5(coalesce(jsonb_agg(to_jsonb(x)-%L::text[] order by (to_jsonb(x)-%L::text[])::text),''[]''::jsonb)::text) from public.%I x',excluded,excluded,t) into n,h;
    insert into rcf038_original_data values(t,n,h);
  end loop;
end $$;

alter table public.project_lots add column correction_version integer not null default 0 check(correction_version>=0);
create table public.lot_corrections (
  id uuid primary key, lot_id uuid not null references public.project_lots on delete restrict,
  version integer not null check(version>0), reason text not null check(length(btrim(reason)) between 1 and 4000),
  changed_by uuid not null references public.profiles on delete restrict, changed_by_name text not null,
  changed_at timestamptz not null default now(), "before" jsonb not null, "after" jsonb not null,
  request_signature jsonb not null, write_set jsonb not null,
  unique(lot_id,version), check(jsonb_typeof("before")='object' and jsonb_typeof("after")='object')
);
create index lot_corrections_actor_idx on public.lot_corrections(changed_by);
alter table public.application_targets add column area_correction_id uuid references public.lot_corrections on delete restrict;
create index application_targets_area_correction_idx on public.application_targets(area_correction_id) where area_correction_id is not null;
alter table public.lot_corrections enable row level security;
revoke all on public.lot_corrections from public,anon,authenticated;
do $$ begin if exists(select 1 from pg_roles where rolname='service_role') then revoke all on public.lot_corrections from service_role; end if; end $$;
grant select(id,lot_id,version,reason,changed_by,changed_by_name,changed_at,"before","after") on public.lot_corrections to authenticated;
create policy lot_corrections_assigned on public.lot_corrections for select to authenticated using(exists(
  select 1 from public.project_lots l join public.sowing_projects p on p.id=l.project_id
  where l.id=lot_id and rcfito_private.can_access_unit(p.agricultural_unit_id)));

create function rcfito_private.guard_lot_correction() returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if tg_op<>'INSERT' then raise exception 'El historial de correcciones no se modifica ni elimina'; end if;
  if current_user<>'postgres' or current_setting('rcfito.lot_correction',true) is distinct from new.id::text then
    raise exception 'La corrección solo se registra por RPC' using errcode='42501';
  end if;
  return new;
end $$;
create trigger rcfito_lot_corrections before insert or update or delete on public.lot_corrections for each row execute function rcfito_private.guard_lot_correction();

-- The per-row write set binds each exception to the exact audited before/after.
-- A client-set GUC cannot grant this capability: only the definer role qualifies.
create function rcfito_private.lot_correction_allows(p_table text,p_old jsonb,p_new jsonb) returns boolean language plpgsql security invoker set search_path='' as $$
declare cid text:=current_setting('rcfito.lot_correction',true); entry jsonb; allowed text[];
begin
  if current_user<>'postgres' or coalesce(cid,'')='' then return false; end if;
  select write_set->p_table->(p_old->>'id') into entry from public.lot_corrections where id=cid::uuid;
  if entry is null then return false; end if;
  allowed:=case p_table
    when 'project_lots' then array['name','area_ha','correction_version','updated_at']
    when 'lot_subdivisions' then array['area_ha','updated_at']
    when 'sowing_stages' then array['area_ha','planned_sowing_date','actual_sowing_date','updated_at']
    when 'application_targets' then array['area_ha','area_correction_id','updated_at'] else null end;
  return allowed is not null and p_old @> (entry->'before') and p_new @> (entry->'after') and (p_old-allowed)=(p_new-allowed);
end $$;

create or replace function rcfito_private.guard_lot() returns trigger language plpgsql security invoker set search_path = '' as $$
declare p public.sowing_projects; f public.fields;
begin
  if tg_op='UPDATE' then
    if rcfito_private.lot_correction_allows(tg_table_name,to_jsonb(old),to_jsonb(new)) then return new; end if;
    if new.correction_version is distinct from old.correction_version then raise exception 'La versión de corrección solo cambia por RPC'; end if;
  end if;
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

create or replace function rcfito_private.guard_subdivision() returns trigger language plpgsql security invoker set search_path = '' as $$
declare l public.project_lots; used_area numeric;
begin
  if tg_op='UPDATE' then
    if rcfito_private.lot_correction_allows(tg_table_name,to_jsonb(old),to_jsonb(new)) then return new; end if;
  end if;
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

create or replace function rcfito_private.guard_stage() returns trigger language plpgsql security invoker set search_path = '' as $$
declare d public.lot_subdivisions; l public.project_lots; p public.sowing_projects; previous_end date; max_number integer;
begin
  if tg_op='UPDATE' then
    if rcfito_private.lot_correction_allows(tg_table_name,to_jsonb(old),to_jsonb(new)) then return new; end if;
  end if;
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

create or replace function rcfito_private.guard_application_write() returns trigger language plpgsql security invoker set search_path='' as $$
declare mode text:=current_setting('rcfito.application_write',true);
begin
  if tg_op='UPDATE' then
    if rcfito_private.lot_correction_allows(tg_table_name,to_jsonb(old),to_jsonb(new)) then return new; end if;
    if tg_table_name='application_targets' then
      if new.area_correction_id is distinct from old.area_correction_id then raise exception 'La corrección de superficie solo cambia por RPC'; end if;
    end if;
  end if;
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

create function rcfito_private.correct_project_lot(p_data jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare cid uuid; lot public.project_lots; project public.sowing_projects; stage public.sowing_stages;
  previous public.lot_corrections; expected integer; new_name text; reason text; area numeric;
  planned date; actual date; first_application date; previous_end date; has_area boolean; has_stage boolean;
  before_data jsonb; after_data jsonb; writes jsonb; part text; old_scope text:=current_setting('rcfito.lot_correction',true);
begin
  if auth.uid() is null then raise exception 'Inicia sesión' using errcode='42501'; end if;
  perform rcfito_private.require_admin();
  perform rcfito_private.application_edit_data(p_data,array['id','lot_id','expected_version','name','area_ha','stage_id','planned_sowing_date','actual_sowing_date','reason']);
  cid:=(p_data->>'id')::uuid;
  if cid is null then raise exception 'La corrección requiere un UUID estable'; end if;
  if not pg_try_advisory_xact_lock(hashtextextended(cid::text,38)) then raise exception 'La corrección se está guardando. Espera y vuelve a intentar' using errcode='40001'; end if;
  select * into previous from public.lot_corrections where id=cid;
  if found then
    if previous.request_signature=p_data then return cid; end if;
    raise exception 'El identificador ya pertenece a otra corrección';
  end if;
  expected:=rcfito_private.application_version(p_data->'expected_version');
  if jsonb_typeof(p_data->'name') is distinct from 'string' or jsonb_typeof(p_data->'reason') is distinct from 'string' then raise exception 'Captura nombre y motivo'; end if;
  -- Match String.trim in the editor, including Unicode spaces independent of DB locale.
  new_name:=btrim(p_data->>'name',U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF');
  reason:=btrim(p_data->>'reason',U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF');
  if length(new_name) not between 1 and 200 or length(reason) not between 1 and 4000 then raise exception 'Nombre o motivo fuera del límite permitido'; end if;
  -- NOWAIT avoids inverting an existing application's order/target/stage locks.
  perform 1 from public.application_orders o where exists(select 1 from public.application_targets t join public.sowing_stages s on s.id=t.stage_id join public.lot_subdivisions d on d.id=s.subdivision_id where d.lot_id=(p_data->>'lot_id')::uuid and t.order_id=o.id) order by o.id for update nowait;
  select * into lot from public.project_lots where id=(p_data->>'lot_id')::uuid for update nowait;
  if not found then raise exception 'No se encontró la malla'; end if;
  select * into project from public.sowing_projects where id=lot.project_id for update nowait;
  if project.status='closed' or not lot.active then raise exception 'Solo se corrige una malla vigente de un proyecto abierto'; end if;
  if expected<>lot.correction_version then raise exception 'La malla cambió. Actualiza los datos y revisa la corrección' using errcode='40001'; end if;
  perform 1 from public.lot_subdivisions where lot_id=lot.id order by id for update nowait;
  perform 1 from public.sowing_stages where subdivision_id in(select id from public.lot_subdivisions where lot_id=lot.id) order by id for update nowait;
  perform 1 from public.application_targets t join public.application_orders o on o.id=t.order_id join public.sowing_stages s on s.id=t.stage_id join public.lot_subdivisions d on d.id=s.subdivision_id where d.lot_id=lot.id and o.project_id=lot.project_id order by t.id for update of t nowait;
  has_area:=p_data ? 'area_ha'; has_stage:=p_data ? 'stage_id';
  if has_stage then
    select s.* into stage from public.sowing_stages s join public.lot_subdivisions d on d.id=s.subdivision_id where s.id=(p_data->>'stage_id')::uuid and d.lot_id=lot.id and d.active and s.status='planted';
    if not found then raise exception 'Selecciona una siembra vigente de esta malla'; end if;
    planned:=rcfito_private.application_edit_date(p_data->'planned_sowing_date'); actual:=rcfito_private.application_edit_date(p_data->'actual_sowing_date');
    if actual is distinct from stage.actual_sowing_date then
    select max(end_date) into previous_end from public.sowing_stages where subdivision_id=stage.subdivision_id and stage_number<stage.stage_number;
    if previous_end is not null and actual<previous_end then raise exception 'La fecha real no puede preceder el cierre de la etapa anterior'; end if;
    select min(value) into first_application from (
      select o.indicated_date as value from public.application_targets t join public.application_orders o on o.id=t.order_id where t.stage_id=stage.id
      union all select actual_date from public.application_targets where stage_id=stage.id
      union all select coalesce((snap->>'indicated_date')::date,(snap->>'actual_date')::date) from public.application_changes c join public.application_targets t on (c.target_id=t.id or t.id=any(c.target_ids)) cross join lateral (values(c."before"),(c."after")) q(snap) where t.stage_id=stage.id
    ) dates;
    if first_application is not null and actual>first_application then raise exception 'La fecha real no puede ser posterior a una aplicación registrada (%)',first_application; end if;
    end if;
  elsif p_data ? 'planned_sowing_date' or p_data ? 'actual_sowing_date' then raise exception 'Las fechas solo se corrigen en la siembra vigente';
  end if;
  if has_area then
    if jsonb_typeof(p_data->'area_ha') is distinct from 'number' then raise exception 'La superficie debe ser numérica'; end if;
    area:=(p_data->>'area_ha')::numeric;
    if area<=0 or area>=100000000 or round(area,4)<>area then raise exception 'La superficie debe ser positiva y tener como máximo cuatro decimales'; end if;
    if not has_stage or (select count(*) from public.lot_subdivisions where lot_id=lot.id)<>1
      or not exists(select 1 from public.lot_subdivisions where lot_id=lot.id and active)
      or (select count(*) from public.sowing_stages s join public.lot_subdivisions d on d.id=s.subdivision_id where d.lot_id=lot.id and s.status='planted')<>1 then
      raise exception 'La corrección conjunta de superficie requiere una subdivisión única y su siembra vigente; no se ajustan repartos automáticamente';
    end if;
    if exists(select 1 from public.sowing_stages s join public.lot_subdivisions d on d.id=s.subdivision_id where d.lot_id=lot.id and s.id<>stage.id and s.status<>'closed' and s.area_ha>area) then raise exception 'Una etapa planeada excede la superficie corregida. Corrige primero esa planeación'; end if;
  end if;
  if exists(select 1 from public.project_lots where project_id=lot.project_id and id<>lot.id and lower(name)=lower(new_name)) then raise exception 'Ya existe una malla con ese nombre en el proyecto'; end if;
  select jsonb_build_object(
    'lot',jsonb_build_object('id',lot.id,'name',lot.name,'area_ha',lot.area_ha,'correction_version',lot.correction_version),
    'subdivisions',case when has_area then (select coalesce(jsonb_agg(jsonb_build_object('id',id,'area_ha',area_ha) order by id),'[]') from public.lot_subdivisions where lot_id=lot.id) else '[]'::jsonb end,
    'stages',case when has_stage then jsonb_build_array(jsonb_build_object('id',stage.id,'area_ha',stage.area_ha,'planned_sowing_date',stage.planned_sowing_date,'actual_sowing_date',stage.actual_sowing_date,'status',stage.status)) else '[]'::jsonb end,
    'targets',case when has_area then (select coalesce(jsonb_agg(jsonb_build_object('id',t.id,'area_ha',t.area_ha,'status',t.status,'area_correction_id',t.area_correction_id) order by t.id),'[]') from public.application_targets t join public.application_orders o on o.id=t.order_id join public.sowing_stages s on s.id=t.stage_id join public.lot_subdivisions d on d.id=s.subdivision_id where d.lot_id=lot.id and o.project_id=lot.project_id) else '[]'::jsonb end
  ) into before_data;
  if jsonb_array_length(before_data->'targets')>20000 then raise exception 'La corrección supera el límite de esta versión'; end if;
  if new_name=lot.name and (not has_stage or (planned=stage.planned_sowing_date and actual=stage.actual_sowing_date))
    and (not has_area or (area=lot.area_ha and area=stage.area_ha and not exists(select 1 from jsonb_array_elements(before_data->'targets') t where (t->>'area_ha')::numeric<>area))) then raise exception 'No hay cambios para registrar'; end if;
  after_data:=jsonb_set(before_data,'{lot}',jsonb_build_object('id',lot.id,'name',new_name,'area_ha',coalesce(area,lot.area_ha),'correction_version',lot.correction_version+1));
  if has_stage then after_data:=jsonb_set(after_data,'{stages}',jsonb_build_array(jsonb_build_object('id',stage.id,'area_ha',coalesce(area,stage.area_ha),'planned_sowing_date',planned,'actual_sowing_date',actual,'status',stage.status))); end if;
  if has_area then
    after_data:=jsonb_set(after_data,'{subdivisions}',(select jsonb_agg(x||jsonb_build_object('area_ha',area)) from jsonb_array_elements(before_data->'subdivisions') x));
    after_data:=jsonb_set(after_data,'{targets}',(select coalesce(jsonb_agg(x||jsonb_build_object('area_ha',area,'area_correction_id',cid)),'[]') from jsonb_array_elements(before_data->'targets') x));
  end if;
  writes:=jsonb_build_object('project_lots',jsonb_build_object(lot.id::text,jsonb_build_object('before',before_data->'lot','after',after_data->'lot')));
  foreach part in array array['subdivisions','stages','targets'] loop
    writes:=writes||jsonb_build_object(case part when 'subdivisions' then 'lot_subdivisions' when 'stages' then 'sowing_stages' else 'application_targets' end,
      (select coalesce(jsonb_object_agg(b->>'id',jsonb_build_object('before',b,'after',a)),'{}') from jsonb_array_elements(before_data->part) b join jsonb_array_elements(after_data->part) a on a->>'id'=b->>'id'));
  end loop;
  perform set_config('rcfito.lot_correction',cid::text,true);
  insert into public.lot_corrections(id,lot_id,version,reason,changed_by,changed_by_name,"before","after",request_signature,write_set)
    values(cid,lot.id,lot.correction_version+1,reason,auth.uid(),(select display_name from public.profiles where id=auth.uid()),before_data,after_data,p_data,writes);
  update public.project_lots set name=new_name,area_ha=coalesce(area,lot.area_ha),correction_version=lot.correction_version+1 where id=lot.id;
  if has_stage then update public.sowing_stages set area_ha=coalesce(area,stage.area_ha),planned_sowing_date=planned,actual_sowing_date=actual where id=stage.id; end if;
  if has_area then update public.application_targets set area_ha=area,area_correction_id=cid where id in(select (x->>'id')::uuid from jsonb_array_elements(after_data->'targets') x); end if;
  perform set_config('rcfito.lot_correction',coalesce(old_scope,''),true);
  return cid;
exception when lock_not_available then
  raise exception 'Los datos están ocupados por otra operación. Actualiza y vuelve a intentar' using errcode='40001';
end $$;
create function public.correct_project_lot(p_data jsonb) returns uuid language sql security invoker set search_path='' as $$ select rcfito_private.correct_project_lot(p_data) $$;
revoke all on function public.correct_project_lot(jsonb) from public,anon;
revoke all on function rcfito_private.correct_project_lot(jsonb),rcfito_private.lot_correction_allows(text,jsonb,jsonb),rcfito_private.guard_lot_correction() from public,anon;
grant execute on function public.correct_project_lot(jsonb),rcfito_private.correct_project_lot(jsonb),rcfito_private.lot_correction_allows(text,jsonb,jsonb) to authenticated;

-- Installing the feature must not itself correct or rewrite any business data.
do $$ declare row record; excluded text[]; n bigint; h text; begin
  for row in select * from rcf038_original_data loop
    excluded:=case row.table_name when 'project_lots' then array['correction_version'] when 'application_targets' then array['area_correction_id'] else '{}'::text[] end;
    execute format('select count(*),md5(coalesce(jsonb_agg(to_jsonb(x)-%L::text[] order by (to_jsonb(x)-%L::text[])::text),''[]''::jsonb)::text) from public.%I x',excluded,excluded,row.table_name) into n,h;
    if n<>row.row_count or h<>row.fingerprint then raise exception 'La instalación modificó datos existentes de %; se revierte',row.table_name; end if;
  end loop;
end $$;

commit;
