-- Resolución de contexto de consulta; no agrega datos ni cambia snapshots.
begin;

create function rcfito_private.application_query_context_options(p_kind text,p_scope jsonb,p_active_only boolean default false)
returns jsonb language sql stable security invoker set search_path='' as $$
  with options as (
    select a.id,a.name,'agricultural_unit'::text kind,null::text project_name,null::text season
      from public.agricultural_units a where p_kind='agricultural_unit'
        and (not p_active_only or exists(select 1 from public.sowing_projects p where p.agricultural_unit_id=a.id and p.status='active'))
    union all
    select p.id,p.name,'project',p.name,p.season from public.sowing_projects p where p_kind='project'
      and (p_scope->>'agricultural_unit_id' is null or p.agricultural_unit_id=(p_scope->>'agricultural_unit_id')::uuid)
      and (not p_active_only or p.status='active')
    union all
    select f.id,f.name,'field',null,null from public.fields f where p_kind='field'
      and (p_scope->>'agricultural_unit_id' is null or f.agricultural_unit_id=(p_scope->>'agricultural_unit_id')::uuid)
      and (p_scope->>'project_id' is null or exists(select 1 from public.project_lots l where l.field_id=f.id and l.project_id=(p_scope->>'project_id')::uuid))
    union all
    select l.id,l.name,'lot',p.name,p.season from public.project_lots l join public.sowing_projects p on p.id=l.project_id where p_kind='lot'
      and (p_scope->>'agricultural_unit_id' is null or p.agricultural_unit_id=(p_scope->>'agricultural_unit_id')::uuid)
      and (p_scope->>'project_id' is null or p.id=(p_scope->>'project_id')::uuid)
      and (p_scope->>'field_id' is null or l.field_id=(p_scope->>'field_id')::uuid)
  ) select coalesce(jsonb_agg(jsonb_strip_nulls(to_jsonb(x))),'[]'::jsonb) from (select * from options order by name,id limit 11) x
$$;

create function rcfito_private.application_query_context_result(p_query jsonb,p_sources jsonb,p_clarification text default null,p_choices jsonb default '[]')
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare filters jsonb; result jsonb;
begin
  -- Estas etiquetas se obtienen con los permisos vigentes del mismo usuario.
  with values_for_filters as (
    select 1 position,'agricultural_unit_id'::text key,'Agrícola'::text label,a.name value from public.agricultural_units a where a.id=(p_query->>'agricultural_unit_id')::uuid
    union all select 2,'project_id','Temporada',p.name||' · '||p.season from public.sowing_projects p where p.id=(p_query->>'project_id')::uuid
    union all select 3,'field_id','Campo',f.name from public.fields f where f.id=(p_query->>'field_id')::uuid
    union all select 3,'field_id','Campo','Todos los campos de la temporada' where p_query ? 'project_id' and not p_query ? 'field_id'
    union all select 4,'lot_id','Lote',l.name from public.project_lots l where l.id=(p_query->>'lot_id')::uuid
    union all select 4,'lot_id','Lote','Todos los lotes de la temporada' where p_query ? 'project_id' and not p_query ? 'lot_id'
    union all select 5,'status','Estado',case p_query->>'status' when 'performed' then 'Realizadas' when 'indicated' then 'Indicadas' when 'cancelled' then 'Canceladas' else 'Todas las aplicaciones' end where p_query ? 'status'
    union all select 6,'from','Desde',p_query->>'from' where p_query ? 'from'
    union all select 7,'to','Hasta',p_query->>'to' where p_query ? 'to'
    union all select 8,'product_id','Producto',p.name from public.products p where p.id=(p_query->>'product_id')::uuid
    union all select 9,'stage_id','Siembra','Etapa '||s.stage_number::text||' · '||d.name||' · '||l.name
      from public.sowing_stages s join public.lot_subdivisions d on d.id=s.subdivision_id join public.project_lots l on l.id=d.lot_id where s.id=(p_query->>'stage_id')::uuid
    union all select 10,'stage_number','Etapa',p_query->>'stage_number' where p_query ? 'stage_number'
    union all select 11,'order_id','Orden',o.folio from public.application_orders o where o.id=(p_query->>'order_id')::uuid
  ) select coalesce(jsonb_agg(jsonb_build_object('key',f.key,'label',f.label,'value',f.value,
      'source',coalesce(p_sources->>f.key,case when f.key in ('field_id','lot_id') and not p_query ? f.key then 'unique_match' else 'explicit' end)) order by f.position),'[]'::jsonb)
    into filters from values_for_filters f;
  result:=public.application_query_stamp()||jsonb_build_object('query',p_query,'filters',filters);
  if p_clarification is not null then result:=result||jsonb_build_object('clarification',p_clarification,'choices',p_choices); end if;
  return result;
end $$;

create function public.application_query_resolve(p_query jsonb,p_last_unit_id uuid default null)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare q jsonb; original jsonb; sources jsonb:='{}'; item record; key text; value jsonb; candidates jsonb; choices jsonb;
  pid uuid; uid uuid; fid uuid; lid uuid; existing_id text; numeric_reference text; unit_source text; lot_source text:='explicit';
  unit_row public.agricultural_units; project_row public.sowing_projects; field_row public.fields; lot_row public.project_lots;
begin
  if not rcfito_private.is_active_user() then raise exception 'La consulta requiere una cuenta activa' using errcode='42501'; end if;
  if p_query is null or jsonb_typeof(p_query)<>'object' or octet_length(p_query::text)>8192 then raise exception 'La consulta debe ser un objeto de hasta 8192 bytes'; end if;
  q:=jsonb_strip_nulls(p_query);original:=q;
  for key,value in select * from jsonb_each(q) loop
    if not key=any(array['operation','agricultural_unit_id','project_id','field_id','lot_id','stage_id','product_id','order_id',
      'agricultural_unit','project','field','lot','product','folio','stage_number','from','to','status','limit','offset']) then raise exception 'La consulta contiene un filtro no permitido: %',key; end if;
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
      if key in ('from','to') and rcfito_private.application_query_date(q->>key) is null then raise exception 'Fecha inválida: %',key; end if;
    end if;
  end loop;
  if q->>'operation' is null or q->>'operation' not in ('pendientes','historial','uso_producto','detalle','cambios') then raise exception 'Selecciona una operación de consulta válida'; end if;
  if q ? 'from' and q ? 'to' and (q->>'from')::date>(q->>'to')::date then raise exception 'El inicio del periodo no puede ser posterior al fin'; end if;
  if q ? 'status' and q->>'status' not in ('indicated','performed','cancelled','all') then raise exception 'Estado de consulta inválido'; end if;
  if q->>'operation'='pendientes' and q ? 'status' and q->>'status'<>'indicated' then raise exception 'Pendientes solo admite estado indicado'; end if;
  if not q ? 'status' then
    q:=q||jsonb_build_object('status',case q->>'operation' when 'pendientes' then 'indicated' when 'uso_producto' then 'performed' else 'all' end);
    sources:=sources||'{"status":"unique_match"}';
  end if;

  -- La agrícola explícita se resuelve antes de considerar la preferencia anterior.
  if q ? 'agricultural_unit' then
    candidates:=rcfito_private.application_query_candidates('agricultural_unit',q->>'agricultural_unit',q);
    if q ? 'agricultural_unit_id' then select coalesce(jsonb_agg(x),'[]') into candidates from jsonb_array_elements(candidates) x where x->>'id'=q->>'agricultural_unit_id'; end if;
    if jsonb_array_length(candidates)<>1 then return rcfito_private.application_query_context_result(q-'agricultural_unit_id',sources,'Selecciona una agrícola autorizada con nombre o código exacto.',candidates); end if;
    q:=q-'agricultural_unit'||jsonb_build_object('agricultural_unit_id',candidates->0->>'id');
  end if;
  if q ? 'agricultural_unit_id' then
    select * into unit_row from public.agricultural_units a where a.id=(q->>'agricultural_unit_id')::uuid;
    if not found then return rcfito_private.application_query_context_result(q-'agricultural_unit_id',sources,'La agrícola indicada no está disponible con tus permisos.',rcfito_private.application_query_context_options('agricultural_unit','{}')); end if;
    sources:=sources||'{"agricultural_unit_id":"explicit"}';
  end if;

  -- Las identidades explícitas de temporada, orden, lote o siembra conservan su
  -- contexto histórico y prevalecen sobre último uso y temporada activa.
  for item in select * from (values('project_id'),('order_id'),('lot_id'),('stage_id')) v(id_key) loop
    if not q ? item.id_key then continue; end if;
    pid:=null;uid:=null;
    if item.id_key='project_id' then select p.id,p.agricultural_unit_id into pid,uid from public.sowing_projects p where p.id=(q->>item.id_key)::uuid;
    elsif item.id_key='order_id' then select p.id,p.agricultural_unit_id into pid,uid from public.application_orders o join public.sowing_projects p on p.id=o.project_id where o.id=(q->>item.id_key)::uuid;
    elsif item.id_key='lot_id' then select p.id,p.agricultural_unit_id into pid,uid from public.project_lots l join public.sowing_projects p on p.id=l.project_id where l.id=(q->>item.id_key)::uuid;
    else select p.id,p.agricultural_unit_id into pid,uid from public.sowing_stages s join public.lot_subdivisions d on d.id=s.subdivision_id join public.project_lots l on l.id=d.lot_id join public.sowing_projects p on p.id=l.project_id where s.id=(q->>item.id_key)::uuid; end if;
    if pid is null then return rcfito_private.application_query_context_result(q-item.id_key,sources,'La referencia indicada no está disponible con tus permisos. Revisa su identificador.'); end if;
    if (q ? 'project_id' and q->>'project_id'<>pid::text) or (q ? 'agricultural_unit_id' and q->>'agricultural_unit_id'<>uid::text) then
      return rcfito_private.application_query_context_result(q,sources,'Las referencias explícitas no pertenecen a la misma agrícola y temporada. Aclara el contexto.');
    end if;
    q:=q||jsonb_build_object('project_id',pid,'agricultural_unit_id',uid);
    sources:=sources||'{"project_id":"explicit","agricultural_unit_id":"explicit"}';
  end loop;
  if q ? 'project' then
    candidates:=rcfito_private.application_query_candidates('project',q->>'project',q);
    if q ? 'project_id' then select coalesce(jsonb_agg(x),'[]') into candidates from jsonb_array_elements(candidates) x where x->>'id'=q->>'project_id'; end if;
    if jsonb_array_length(candidates)<>1 then return rcfito_private.application_query_context_result(q-'project_id',sources,'Selecciona una temporada autorizada con nombre exacto.',candidates); end if;
    select * into project_row from public.sowing_projects p where p.id=(candidates->0->>'id')::uuid;
    q:=q-'project'||jsonb_build_object('project_id',project_row.id,'agricultural_unit_id',project_row.agricultural_unit_id);
    sources:=sources||'{"project_id":"explicit","agricultural_unit_id":"explicit"}';
  end if;
  if q ? 'folio' then
    candidates:=rcfito_private.application_query_candidates('order',q->>'folio',q);
    if q ? 'order_id' then select coalesce(jsonb_agg(x),'[]') into candidates from jsonb_array_elements(candidates) x where x->>'id'=q->>'order_id'; end if;
    if jsonb_array_length(candidates)<>1 then return rcfito_private.application_query_context_result(q-'order_id',sources,'Selecciona el folio exacto de una orden autorizada.',candidates); end if;
    select p.* into project_row from public.application_orders o join public.sowing_projects p on p.id=o.project_id where o.id=(candidates->0->>'id')::uuid;
    q:=q-'folio'||jsonb_build_object('order_id',candidates->0->>'id','project_id',project_row.id,'agricultural_unit_id',project_row.agricultural_unit_id);
    sources:=sources||'{"project_id":"explicit","agricultural_unit_id":"explicit","order_id":"explicit"}';
  end if;
  if q ? 'field_id' then
    select * into field_row from public.fields f where f.id=(q->>'field_id')::uuid;
    if not found then return rcfito_private.application_query_context_result(q-'field_id',sources,'El campo indicado no está disponible con tus permisos.'); end if;
    if q ? 'agricultural_unit_id' and q->>'agricultural_unit_id'<>field_row.agricultural_unit_id::text then return rcfito_private.application_query_context_result(q,sources,'El campo indicado pertenece a otra agrícola. Aclara el contexto.'); end if;
    q:=q||jsonb_build_object('agricultural_unit_id',field_row.agricultural_unit_id);
    sources:=sources||'{"agricultural_unit_id":"explicit","field_id":"explicit"}';
  end if;

  if not q ? 'agricultural_unit_id' then
    if p_last_unit_id is not null then
      select * into unit_row from public.agricultural_units a where a.id=p_last_unit_id;
      if not found then return rcfito_private.application_query_context_result(q,sources,'La última agrícola utilizada ya no está disponible. Selecciona una agrícola autorizada.',rcfito_private.application_query_context_options('agricultural_unit','{}')); end if;
      q:=q||jsonb_build_object('agricultural_unit_id',unit_row.id);unit_source:='last_used';
    else
      candidates:=rcfito_private.application_query_context_options('agricultural_unit','{}');
      if jsonb_array_length(candidates)=1 then unit_source:='unique_match';
      else
        choices:=rcfito_private.application_query_context_options('agricultural_unit','{}',true);
        if jsonb_array_length(choices)=1 then candidates:=choices;unit_source:='active_season';
        else return rcfito_private.application_query_context_result(q,sources,'Selecciona la agrícola que deseas consultar.',candidates); end if;
      end if;
      q:=q||jsonb_build_object('agricultural_unit_id',candidates->0->>'id');
    end if;
    sources:=sources||jsonb_build_object('agricultural_unit_id',unit_source);
  end if;
  if not q ? 'project_id' then
    candidates:=rcfito_private.application_query_context_options('project',q,true);
    if jsonb_array_length(candidates)<>1 then return rcfito_private.application_query_context_result(q,sources,
      case when jsonb_array_length(candidates)=0 then 'Esta agrícola no tiene una temporada activa. Selecciona explícitamente la temporada que deseas consultar.' else 'Hay varias temporadas activas. Selecciona la temporada que deseas consultar.' end,
      rcfito_private.application_query_context_options('project',q)); end if;
    q:=q||jsonb_build_object('project_id',candidates->0->>'id');sources:=sources||'{"project_id":"active_season"}';
  end if;

  if q ? 'field' then
    candidates:=rcfito_private.application_query_candidates('field',q->>'field',q);
    if q ? 'field_id' then select coalesce(jsonb_agg(x),'[]') into candidates from jsonb_array_elements(candidates) x where x->>'id'=q->>'field_id'; end if;
    if jsonb_array_length(candidates)<>1 then return rcfito_private.application_query_context_result(q-'field_id',sources,'Selecciona un campo con nombre o código exacto dentro de la temporada.',candidates); end if;
    q:=q-'field'||jsonb_build_object('field_id',candidates->0->>'id');sources:=sources||'{"field_id":"explicit"}';
  end if;
  if q ? 'lot' then
    existing_id:=q->>'lot_id';
    candidates:=rcfito_private.application_query_candidates('lot',q->>'lot',q);
    if existing_id is not null then select coalesce(jsonb_agg(x),'[]') into candidates from jsonb_array_elements(candidates) x where x->>'id'=existing_id; end if;
    if jsonb_array_length(candidates)=0 then
      -- "Malla 5" puede ser el nombre/código exacto de un campo. Solo se
      -- transforma en lote si ese campo tiene una identidad de lote inequívoca.
      select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into choices from (
        select f.id,f.name,'field'::text kind from public.fields f
        where f.agricultural_unit_id=(q->>'agricultural_unit_id')::uuid
          and (rcfito_private.application_query_term(f.name)=rcfito_private.application_query_term(q->>'lot')
            or rcfito_private.application_query_term(f.code)=rcfito_private.application_query_term(q->>'lot'))
        order by f.name,f.id limit 11
      ) x;
      if jsonb_array_length(choices)>1 then return rcfito_private.application_query_context_result(q-'lot_id',sources,'La referencia coincide con varios campos. Selecciona un campo antes de consultar.',choices); end if;
      if jsonb_array_length(choices)=1 then
        fid:=(choices->0->>'id')::uuid;
        if q ? 'field_id' and q->>'field_id'<>fid::text then return rcfito_private.application_query_context_result(q,sources,'La referencia de malla y el campo seleccionado no coinciden.'); end if;
        q:=q||jsonb_build_object('field_id',fid);sources:=sources||'{"field_id":"unique_match"}';
        candidates:=rcfito_private.application_query_context_options('lot',q);
        if existing_id is not null then select coalesce(jsonb_agg(x),'[]') into candidates from jsonb_array_elements(candidates) x where x->>'id'=existing_id; end if;
        if jsonb_array_length(candidates)<>1 then return rcfito_private.application_query_context_result(q-'lot_id',sources,'El campo no identifica un solo lote de esta temporada. Selecciona un lote; también se consideran los lotes históricos retirados.',candidates); end if;
        lot_source:='unique_match';
      else
        -- Compatibilidad numérica completa y acotada; nunca substring 5 -> 15.
        numeric_reference:=substring(rcfito_private.application_query_term(q->>'lot') from '^malla[[:space:]]*([0-9]+)$');
        if numeric_reference is not null then
          candidates:=rcfito_private.application_query_candidates('lot',numeric_reference,q);
          if existing_id is not null then select coalesce(jsonb_agg(x),'[]') into candidates from jsonb_array_elements(candidates) x where x->>'id'=existing_id; end if;
          lot_source:='unique_match';
        end if;
      end if;
    end if;
    if jsonb_array_length(candidates)<>1 then return rcfito_private.application_query_context_result(q-'lot_id',sources,'Selecciona un lote con nombre o código exacto dentro de la temporada.',candidates); end if;
    q:=q-'lot'||jsonb_build_object('lot_id',candidates->0->>'id');sources:=sources||jsonb_build_object('lot_id',case when existing_id is not null then 'explicit' else lot_source end);
  end if;
  if q ? 'lot_id' then
    select * into lot_row from public.project_lots l where l.id=(q->>'lot_id')::uuid and l.project_id=(q->>'project_id')::uuid;
    if not found or (q ? 'field_id' and q->>'field_id'<>lot_row.field_id::text) then return rcfito_private.application_query_context_result(q-'lot_id',sources,'El lote no pertenece al campo y temporada seleccionados.'); end if;
    if not q ? 'field_id' then q:=q||jsonb_build_object('field_id',lot_row.field_id);sources:=sources||jsonb_build_object('field_id',coalesce(sources->>'lot_id','explicit')); end if;
  end if;
  if q ? 'stage_id' then
    select l.id,l.field_id into lid,fid from public.sowing_stages s join public.lot_subdivisions d on d.id=s.subdivision_id join public.project_lots l on l.id=d.lot_id
      where s.id=(q->>'stage_id')::uuid and l.project_id=(q->>'project_id')::uuid and (q->>'stage_number' is null or s.stage_number=(q->>'stage_number')::integer);
    if lid is null or (q ? 'lot_id' and q->>'lot_id'<>lid::text) or (q ? 'field_id' and q->>'field_id'<>fid::text) then return rcfito_private.application_query_context_result(q-'stage_id',sources,'La siembra no pertenece al lote, campo y etapa seleccionados.'); end if;
    q:=q||jsonb_build_object('lot_id',lid,'field_id',fid);sources:=sources||'{"lot_id":"explicit","field_id":"explicit","stage_id":"explicit"}';
  end if;
  if q ? 'product' then
    candidates:=rcfito_private.application_query_candidates('product',q->>'product',q);
    if q ? 'product_id' then select coalesce(jsonb_agg(x),'[]') into candidates from jsonb_array_elements(candidates) x where x->>'id'=q->>'product_id'; end if;
    if jsonb_array_length(candidates)<>1 then return rcfito_private.application_query_context_result(q-'product_id',sources,'Selecciona un producto con nombre, código o sinónimo exacto.',candidates); end if;
    q:=q-'product'||jsonb_build_object('product_id',candidates->0->>'id');sources:=sources||'{"product_id":"explicit"}';
  end if;
  if q ? 'product_id' and not exists(select 1 from public.products p where p.id=(q->>'product_id')::uuid) then return rcfito_private.application_query_context_result(q-'product_id',sources,'El producto indicado no está disponible con tus permisos.'); end if;
  -- Todo identificador fijo retira su nombre redundante: un homónimo en otra
  -- temporada no vuelve a abrir la resolución al ejecutar application_query.
  for item in select * from (values('agricultural_unit_id','agricultural_unit'),('project_id','project'),('field_id','field'),('lot_id','lot'),('product_id','product'),('order_id','folio')) v(id_key,name_key) loop
    if q ? item.id_key then q:=q-item.name_key; end if;
  end loop;
  return rcfito_private.application_query_context_result(q,sources);
end $$;

revoke all on function rcfito_private.application_query_context_options(text,jsonb,boolean),rcfito_private.application_query_context_result(jsonb,jsonb,text,jsonb),public.application_query_resolve(jsonb,uuid) from public,anon;
grant execute on function rcfito_private.application_query_context_options(text,jsonb,boolean),rcfito_private.application_query_context_result(jsonb,jsonb,text,jsonb),public.application_query_resolve(jsonb,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
