-- Totales de una captura por imagen. Guarda solo metadatos revisados, no archivos.
begin;

alter table public.application_orders add column source_capture jsonb
  check(source_capture is null or (jsonb_typeof(source_capture)='object' and source_capture->>'kind'='image_totals'));

create function rcfito_private.normalized_application_image_source(p_source jsonb) returns jsonb language plpgsql immutable security invoker set search_path='' as $$
declare area numeric; quantity numeric; item jsonb; product_id uuid; seen uuid[]:='{}'; products jsonb:='[]'; unit text;
begin
  if p_source is null or p_source='null'::jsonb then return null; end if;
  if jsonb_typeof(p_source) is distinct from 'object' then raise exception 'El origen de imagen debe contener metadatos válidos'; end if;
  if not(p_source ?& array['kind','area_ha','products']) or exists(select 1 from jsonb_object_keys(p_source) x(key) where not(key=any(array['kind','area_ha','products']))) then raise exception 'El origen de imagen contiene campos no permitidos; no incluya archivos ni URLs'; end if;
  if p_source->>'kind' is distinct from 'image_totals' then raise exception 'Tipo de origen de imagen no válido'; end if;
  if jsonb_typeof(p_source->'area_ha') is distinct from 'number' then raise exception 'La superficie de la imagen debe ser numérica'; end if;
  area:=(p_source->>'area_ha')::numeric;
  if area<=0 or round(area,4)<>area then raise exception 'La superficie de la imagen debe ser positiva y admitir hasta cuatro decimales'; end if;
  if jsonb_typeof(p_source->'products') is distinct from 'array' then raise exception 'La imagen requiere una lista de productos'; end if;
  if jsonb_array_length(p_source->'products')<1 or jsonb_array_length(p_source->'products')>40 then raise exception 'La imagen admite de uno a cuarenta productos'; end if;
  for item in select value from jsonb_array_elements(p_source->'products') loop
    if jsonb_typeof(item) is distinct from 'object' then raise exception 'Cada producto de la imagen debe ser un objeto válido'; end if;
    if not(item ?& array['product_id','source_name','presentation','quantity','unit']) or exists(select 1 from jsonb_object_keys(item) x(key) where not(key=any(array['product_id','source_name','presentation','quantity','unit']))) then raise exception 'El producto de imagen contiene campos faltantes o no permitidos'; end if;
    if jsonb_typeof(item->'product_id') is distinct from 'string' then raise exception 'Seleccione el código interno de cada producto de la imagen'; end if;
    product_id:=(item->>'product_id')::uuid;
    if product_id=any(seen) then raise exception 'No repita un producto en los totales de la imagen'; end if;
    seen:=array_append(seen,product_id);
    if jsonb_typeof(item->'source_name') is distinct from 'string' or char_length(item->>'source_name')>200 or jsonb_typeof(item->'presentation') is distinct from 'string' or char_length(item->>'presentation')>200 then raise exception 'El nombre original y la presentación admiten texto de hasta 200 caracteres'; end if;
    if jsonb_typeof(item->'quantity') is distinct from 'number' then raise exception 'La cantidad total de imagen debe ser numérica'; end if;
    quantity:=(item->>'quantity')::numeric;
    if quantity<=0 or quantity>=100000000 or round(quantity,6)<>quantity then raise exception 'La cantidad total debe ser positiva, menor de cien millones y con hasta seis decimales'; end if;
    if jsonb_typeof(item->'unit') is distinct from 'string' or (item->>'unit') not in ('g','kg','ml','L') then raise exception 'Seleccione g, kg, ml o L para la cantidad total'; end if;
    unit:=item->>'unit';
    products:=products||jsonb_build_array(jsonb_build_object('product_id',product_id,'source_name',item->>'source_name','presentation',item->>'presentation','quantity',quantity,'unit',unit));
  end loop;
  select jsonb_agg(value order by value->>'product_id') into products from jsonb_array_elements(products);
  return jsonb_build_object('kind','image_totals','area_ha',area,'products',products);
end $$;

create function rcfito_private.validate_application_image_doses(p_source jsonb,p_products jsonb,p_area numeric) returns void language plpgsql security invoker set search_path='' as $$
declare item jsonb; supplied jsonb; dose numeric; catalog_unit text; source_unit text; multiplier numeric;
begin
  if p_source is null then return; end if;
  if (p_source->>'area_ha')::numeric is distinct from p_area then raise exception 'La superficie seleccionada cambió; actualiza los destinos y vuelve a calcular las dosis de la imagen'; end if;
  if jsonb_array_length(p_source->'products')<>jsonb_array_length(p_products) then raise exception 'Los productos de la mezcla deben coincidir exactamente con los totales de la imagen'; end if;
  for item in select value from jsonb_array_elements(p_source->'products') loop
    select value into supplied from jsonb_array_elements(p_products) where value->>'product_id'=item->>'product_id';
    if not found then raise exception 'Los productos de la mezcla deben coincidir exactamente con los totales de la imagen'; end if;
    select unit into catalog_unit from public.products where id=(item->>'product_id')::uuid and active for share;
    if not found then raise exception 'Seleccione productos activos para los totales de la imagen'; end if;
    source_unit:=case when item->>'unit' in ('g','kg') then 'g' else 'ml' end;
    if catalog_unit is distinct from source_unit then raise exception 'La unidad total no corresponde a la unidad fija del producto de la imagen'; end if;
    multiplier:=case when item->>'unit' in ('kg','L') then 1000 else 1 end;
    -- Cantidad tiene <=6 decimales y área <=4: ambos enteros escalados son exactos.
    -- div evita que / redondee antes de decidir un empate de la sexta decimal.
    dose:=div(2*(item->>'quantity')::numeric*multiplier*10000000000+p_area*10000,2*p_area*10000)/1000000;
    if dose<=0 or dose>=100000000 then raise exception 'La dosis calculada desde los totales queda fuera del rango permitido'; end if;
    if (supplied->>'dose')::numeric is distinct from dose then raise exception 'La dosis no coincide con el total de imagen dividido entre la superficie seleccionada'; end if;
  end loop;
end $$;
revoke all on function rcfito_private.normalized_application_image_source(jsonb),rcfito_private.validate_application_image_doses(jsonb,jsonb,numeric) from public,anon,authenticated;

create function rcfito_private.guard_application_image_source() returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if new.source_capture is distinct from old.source_capture then raise exception 'Los totales originales de la imagen son históricos y no se modifican'; end if;
  return new;
end $$;
revoke all on function rcfito_private.guard_application_image_source() from public,anon,authenticated;
create trigger guard_application_image_source before update of source_capture on public.application_orders for each row execute function rcfito_private.guard_application_image_source();

create or replace function rcfito_private.create_application_order(p_data jsonb,p_stage_ids uuid[],p_products jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare order_id uuid; project public.sowing_projects; ids uuid[]; products jsonb; signature jsonb; previous public.application_orders;
  item jsonb; snapshot jsonb; stage record; water numeric(12,4); indicated date; scheduled date; field_name text; crop_name text; method_name text;
  requested_number integer; number_value numeric; next_number bigint; source_text text:='';
  group_id uuid; group_name text; group_row public.sowing_groups; eligible_ids uuid[]; origin text;
  capture jsonb; capture_area numeric;
  recipe jsonb; recipe_id uuid; recipe_revision integer; recipe_stage uuid; recipe_order public.application_orders;
  previous_scope text:=current_setting('rcfito.application_write',true);
begin
  if auth.uid() is null then raise exception 'Inicia sesión' using errcode='42501'; end if;
  perform rcfito_private.require_admin();
  if p_data is null or jsonb_typeof(p_data) is distinct from 'object' or nullif(p_data->>'id','') is null then raise exception 'La orden requiere un UUID estable'; end if;
  order_id:=(p_data->>'id')::uuid; ids:=rcfito_private.application_stage_ids(p_stage_ids); products:=rcfito_private.normalized_application_products(p_products);
  capture:=rcfito_private.normalized_application_image_source(p_data->'source_capture');
  if p_data ? 'source_group_id' and jsonb_typeof(p_data->'source_group_id') not in ('null','string') then raise exception 'El grupo de origen requiere un UUID válido'; end if;
  group_id:=(p_data->>'source_group_id')::uuid;
  if p_data->'recipe_source' is not null and p_data->'recipe_source'<>'null'::jsonb then
    recipe:=p_data->'recipe_source';
    if jsonb_typeof(recipe) is distinct from 'object' or jsonb_typeof(recipe->'order_id') is distinct from 'string'
      or jsonb_typeof(recipe->'revision') is distinct from 'number' then raise exception 'La receta base requiere orden y versión válidas'; end if;
    recipe_id:=(recipe->>'order_id')::uuid;
    number_value:=(recipe->>'revision')::numeric;
    if number_value<0 or number_value>2147483647 or trunc(number_value)<>number_value then raise exception 'La versión de la receta base no es válida'; end if;
    recipe_revision:=number_value::integer;
    recipe_stage:=(recipe->>'stage_id')::uuid;
    recipe:=jsonb_build_object('order_id',recipe_id,'revision',recipe_revision);
    if recipe_stage is not null then recipe:=recipe||jsonb_build_object('stage_id',recipe_stage); end if;
  end if;
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
  if group_id is not null then signature:=signature||jsonb_build_object('source_group_id',group_id); end if;
  if recipe is not null then signature:=signature||jsonb_build_object('recipe_source',recipe); end if;
  if capture is not null then signature:=signature||jsonb_build_object('source_capture',capture); end if;
  perform pg_advisory_xact_lock(hashtextextended('rcfito-order:'||order_id::text,0));
  select * into previous from public.application_orders where id=order_id for update;
  if found then
    if previous.request_signature=signature then return order_id; end if;
    raise exception 'El UUID ya corresponde a otra indicación';
  end if;
  -- Source order before group/stages matches revision/cancellation lock order.
  if recipe_id is not null then
    select * into recipe_order from public.application_orders where id=recipe_id for share;
    if not found or recipe_order.revision<>recipe_revision then raise exception 'La receta base cambió. Vuelva a cargarla antes de guardar'; end if;
    if recipe_order.project_id<>(p_data->>'project_id')::uuid or recipe_order.field_id<>(p_data->>'field_id')::uuid or recipe_order.crop_id<>(p_data->>'crop_id')::uuid then raise exception 'La receta base no pertenece al mismo proyecto, campo y cultivo'; end if;
    if group_id is not null then
      if recipe_order.selection_origin<>'group' or recipe_order.source_group_id is distinct from group_id or recipe_stage is not null then raise exception 'La receta base no corresponde al grupo seleccionado'; end if;
    elsif recipe_stage is null or not(recipe_stage=any(ids)) then raise exception 'La receta base requiere una etapa del lote seleccionado'; end if;
    if not exists(select 1 from public.application_targets t where t.order_id=recipe_id and t.stage_id=any(ids)
      and (recipe_stage is null or t.stage_id=recipe_stage) and t.status<>'cancelled') then raise exception 'La receta base ya no está activa para los destinos seleccionados'; end if;
  end if;
  -- Group edits take this same lock before locking stages. Retries above preserve the original snapshots.
  if group_id is not null then perform pg_advisory_xact_lock(hashtextextended('rcfito-group:'||group_id::text,0)); end if;
  -- Bloquear las etapas en orden serializa número explícito y max+1 concurrentes.
  -- Se conserva el orden etapa -> proyecto usado por las transiciones existentes.
  perform 1 from public.sowing_stages where id=any(ids) order by id for update;
  project:=rcfito_private.open_project((p_data->>'project_id')::uuid);
  if project.status<>'active' then raise exception 'La temporada debe estar activa para indicar aplicaciones'; end if;
  if group_id is not null then
    select * into group_row from public.sowing_groups g where g.id=group_id and g.active
      and g.project_id=project.id and g.field_id=(p_data->>'field_id')::uuid and g.crop_id=(p_data->>'crop_id')::uuid;
    if not found then raise exception 'Seleccione un grupo activo del mismo proyecto, campo y cultivo'; end if;
    group_name:=group_row.name;
    select array_agg(s.id order by s.id) into eligible_ids
      from public.sowing_group_members m join public.sowing_stages s on s.id=m.stage_id
      join public.lot_subdivisions d on d.id=s.subdivision_id join public.project_lots l on l.id=d.lot_id
      where m.group_id=group_row.id and m.active and s.status='planted' and d.active and l.active
        and l.project_id=project.id and l.field_id=group_row.field_id and s.crop_id=group_row.crop_id;
    if ids is distinct from coalesce(eligible_ids,array[]::uuid[]) then
      raise exception 'Revise el grupo: incluya todos sus destinos vigentes o use selección manual';
    end if;
    origin:='group';
  else
    select case when count(distinct d.lot_id)=1 then 'individual' else 'manual' end into origin
      from public.sowing_stages s join public.lot_subdivisions d on d.id=s.subdivision_id where s.id=any(ids);
  end if;
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
  -- Las etapas siguen bloqueadas: el área actual es la base autoritativa.
  if capture is not null then
    select sum(area_ha) into capture_area from public.sowing_stages where id=any(ids);
    perform rcfito_private.validate_application_image_doses(capture,products,capture_area);
  end if;
  for item in select value from jsonb_array_elements(products) loop perform rcfito_private.application_product_snapshot((item->>'product_id')::uuid); end loop;
  perform set_config('rcfito.application_write','create',true);
  insert into public.application_orders(id,project_id,field_id,crop_id,method_id,indicated_date,scheduled_date,water_l_ha,observations,source_text,project_name,field_name,crop_name,method_name,agricultural_unit_name,season,request_signature,created_by,selection_origin,source_group_id,source_group_name,recipe_source_order_id,recipe_source_revision,recipe_source_stage_id,source_capture)
  values(order_id,project.id,(p_data->>'field_id')::uuid,(p_data->>'crop_id')::uuid,(p_data->>'method_id')::uuid,indicated,scheduled,water,coalesce(p_data->>'observations',''),source_text,project.name,field_name,crop_name,method_name,project.agricultural_unit_name,project.season,signature,auth.uid(),origin,group_id,group_name,recipe_id,recipe_revision,recipe_stage,capture);
  for item in select value from jsonb_array_elements(products) loop
    snapshot:=rcfito_private.application_product_snapshot((item->>'product_id')::uuid);
    insert into public.application_order_products(order_id,product_id,dose,product_name,unit,ingredients_snapshot)
    values(order_id,(item->>'product_id')::uuid,(item->>'dose')::numeric,snapshot->>'product_name',snapshot->>'unit',snapshot->'ingredients_snapshot');
  end loop;
  insert into public.application_targets(order_id,stage_id,application_number,lot_name,subdivision_name,stage_number,crop_name,variety_name,area_ha,group_memberships_snapshot)
  select order_id,s.id,coalesce(requested_number,(select coalesce(max(t.application_number),0)+1 from public.application_targets t where t.stage_id=s.id)),l.name,d.name,s.stage_number,s.crop_name,s.variety_name,s.area_ha,
    coalesce((select jsonb_agg(jsonb_build_object('id',g.id,'name',g.name) order by g.id)
      from public.sowing_groups g join public.sowing_group_members m on m.group_id=g.id
      where m.stage_id=s.id and m.active and g.active and g.project_id=project.id
        and g.field_id=l.field_id and g.crop_id=s.crop_id),'[]'::jsonb)
  from public.sowing_stages s join public.lot_subdivisions d on d.id=s.subdivision_id join public.project_lots l on l.id=d.lot_id where s.id=any(ids);
  perform set_config('rcfito.application_write',coalesce(previous_scope,''),true);
  return order_id;
end $$;

notify pgrst,'reload schema';
commit;
