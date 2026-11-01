-- Sinónimos controlados: catálogo común, reserva incluso para productos inactivos.
begin;

create function rcfito_private.product_term_normalized(p_value text) returns text language sql immutable strict security invoker set search_path='' as $$
select btrim(regexp_replace(lower(regexp_replace(normalize(p_value,NFD),U&'[\0300-\036f]','','g')),'[^a-z0-9]+',' ','g'))
$$;
create function rcfito_private.product_term_compact(p_value text) returns text language sql immutable strict security invoker set search_path='' as $$
select replace(rcfito_private.product_term_normalized(p_value),' ','')
$$;
create function rcfito_private.product_terms_conflict(p_left text,p_right text) returns boolean language plpgsql immutable security invoker set search_path='' as $$
declare a text:=rcfito_private.product_term_compact(p_left); b text:=rcfito_private.product_term_compact(p_right);
  m integer; n integer; threshold integer; i integer; j integer; cost integer; previous integer[]; current_row integer[];
begin
  if a is null or b is null or a='' or b='' then return false; end if;
  if a=b then return true; end if;
  m:=char_length(a); n:=char_length(b);
  if least(m,n)<4 then return false; end if;
  if left(a,least(m,n))=left(b,least(m,n)) then return true; end if;
  threshold:=case when least(m,n)>=10 then 2 else 1 end;
  if abs(m-n)>threshold then return false; end if;
  select array_agg(x order by x) into previous from generate_series(0,n) x;
  for i in 1..m loop
    current_row:=array[i];
    for j in 1..n loop
      cost:=case when substr(a,i,1)=substr(b,j,1) then 0 else 1 end;
      current_row:=array_append(current_row,least(current_row[j]+1,previous[j+1]+1,previous[j]+cost));
    end loop;
    previous:=current_row;
  end loop;
  return previous[n+1]<=threshold;
end $$;

create table public.product_synonyms(
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products on delete restrict,
  name text not null check(char_length(name) between 2 and 80),
  normalized_name text generated always as (rcfito_private.product_term_compact(name)) stored not null unique check(normalized_name<>''),
  created_by uuid not null references auth.users on delete restrict,
  created_at timestamptz not null default now()
);
create index product_synonyms_product_idx on public.product_synonyms(product_id);
alter table public.product_synonyms enable row level security;
revoke all on public.product_synonyms from public,anon,authenticated;
grant select on public.product_synonyms to authenticated;
create policy product_synonyms_active_reader on public.product_synonyms for select to authenticated using(rcfito_private.is_active_user());

-- Auditoría privada sin FK al producto: no cambia la eliminación de un producto
-- sin uso después de retirar explícitamente sus sinónimos. Conserva su identidad.
create table rcfito_private.product_synonym_changes(
  id uuid primary key default gen_random_uuid(), product_id uuid not null,
  product_code text not null, product_name text not null,
  "before" text[] not null, "after" text[] not null,
  changed_by uuid not null references auth.users on delete restrict,
  changed_by_name text not null, changed_at timestamptz not null default now()
);
create index product_synonym_changes_product_idx on rcfito_private.product_synonym_changes(product_id,changed_at);
alter table rcfito_private.product_synonym_changes enable row level security;
revoke all on rcfito_private.product_synonym_changes from public,anon,authenticated;
do $$ begin if exists(select 1 from pg_roles where rolname='service_role') then
  revoke insert,update,delete,truncate on public.product_synonyms,rcfito_private.product_synonym_changes from service_role;
end if; end $$;

create function rcfito_private.lock_product_terms() returns trigger language plpgsql security invoker set search_path='' as $$
begin
  -- Statement trigger: obtener siempre este lock ANTES de cualquier row lock.
  perform pg_advisory_xact_lock(hashtextextended('rcfito-product-terms',0));
  return null;
end $$;
create trigger lock_product_terms before insert or update or delete on public.products for each statement execute function rcfito_private.lock_product_terms();

create function rcfito_private.assert_product_synonym(p_product_id uuid,p_alias text) returns void language plpgsql security invoker set search_path='' as $$
declare own public.products; conflict record; key text:=rcfito_private.product_term_compact(p_alias);
begin
  select * into own from public.products where id=p_product_id;
  if not found then raise exception 'Producto no disponible'; end if;
  if key=rcfito_private.product_term_compact(own.name) or key=rcfito_private.product_term_compact(own.code) then raise exception 'El sinónimo "%" equivale al nombre o código del mismo producto "%"',p_alias,own.name; end if;
  for conflict in
    select p.id,p.name product_name,p.code product_code,p.name term from public.products p where p.id<>p_product_id
    union all select p.id,p.name,p.code,p.code from public.products p where p.id<>p_product_id
    union all select p.id,p.name,p.code,s.name from public.product_synonyms s join public.products p on p.id=s.product_id where p.id<>p_product_id
  loop
    if rcfito_private.product_terms_conflict(p_alias,conflict.term) then raise exception 'El sinónimo "%" coincide o se parece a "%" del producto "%" (%); elige otro sinónimo',p_alias,conflict.term,conflict.product_name,conflict.product_code; end if;
  end loop;
end $$;
create function rcfito_private.guard_product_terms() returns trigger language plpgsql security invoker set search_path='' as $$
declare conflict record; alias_name text;
begin
  if tg_op='UPDATE' and new.name is not distinct from old.name and new.code is not distinct from old.code then return new; end if;
  for conflict in select s.name term,p.name product_name,p.code product_code from public.product_synonyms s join public.products p on p.id=s.product_id where s.product_id<>new.id loop
    if rcfito_private.product_terms_conflict(new.name,conflict.term) then raise exception 'El nombre "%" coincide o se parece al sinónimo "%" del producto "%" (%)',new.name,conflict.term,conflict.product_name,conflict.product_code; end if;
    if rcfito_private.product_terms_conflict(new.code,conflict.term) then raise exception 'El código "%" coincide o se parece al sinónimo "%" del producto "%" (%)',new.code,conflict.term,conflict.product_name,conflict.product_code; end if;
  end loop;
  for alias_name in select name from public.product_synonyms where product_id=new.id loop
    if rcfito_private.product_term_compact(alias_name) in (rcfito_private.product_term_compact(new.name),rcfito_private.product_term_compact(new.code)) then raise exception 'El sinónimo "%" equivale al nuevo nombre o código del mismo producto "%"',alias_name,new.name; end if;
  end loop;
  return new;
end $$;
create trigger guard_product_terms before insert or update of name,code on public.products for each row execute function rcfito_private.guard_product_terms();

create function rcfito_private.guard_product_synonyms() returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if current_setting('rcfito.product_synonym_write',true) is distinct from 'save' then raise exception 'Los sinónimos se guardan junto con el producto mediante RPC'; end if;
  if tg_table_name='product_synonym_changes' then
    if tg_op<>'INSERT' then raise exception 'El historial de sinónimos solo se agrega'; end if;
    return new;
  end if;
  if tg_op='DELETE' then return old; end if;
  if tg_op='UPDATE' and (new.id,new.product_id,new.created_by,new.created_at) is distinct from (old.id,old.product_id,old.created_by,old.created_at) then raise exception 'La identidad de un sinónimo no cambia'; end if;
  if tg_op='INSERT' and new.created_by is distinct from auth.uid() then raise exception 'El autor del sinónimo se obtiene de la sesión'; end if;
  perform rcfito_private.assert_product_synonym(new.product_id,new.name);
  return new;
end $$;
create trigger guard_product_synonyms before insert or update or delete on public.product_synonyms for each row execute function rcfito_private.guard_product_synonyms();
create trigger guard_product_synonym_changes before insert or update or delete on rcfito_private.product_synonym_changes for each row execute function rcfito_private.guard_product_synonyms();

create function rcfito_private.save_product(p_data jsonb,p_ingredients jsonb default '[]') returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid; item jsonb; existing_ingredients uuid[]:='{}'; aliases text[]; keys text[]:='{}'; alias_name text; key text;
  before_names text[]; after_names text[]; actor_name text; previous_scope text:=current_setting('rcfito.product_synonym_write',true);
begin
  if auth.uid() is null then raise exception 'Inicia sesión' using errcode='42501'; end if;
  perform rcfito_private.require_admin();
  if p_data is null or jsonb_typeof(p_data) is distinct from 'object' then raise exception 'Capture un producto válido'; end if;
  if p_ingredients is null or jsonb_typeof(p_ingredients) is distinct from 'array' then raise exception 'La composición debe ser una lista'; end if;
  -- Mismo orden de locks que el DML directo: catálogo global -> producto.
  perform pg_advisory_xact_lock(hashtextextended('rcfito-product-terms',0));
  if nullif(p_data->>'id','') is not null then
    select id into result from public.products where id=(p_data->>'id')::uuid for update;
    if not found then raise exception 'Producto no disponible'; end if;
  end if;
  select coalesce(array_agg(name order by normalized_name),'{}') into before_names from public.product_synonyms where product_id=result;
  if p_data ? 'synonyms' then
    if jsonb_typeof(p_data->'synonyms') is distinct from 'array' then raise exception 'Los sinónimos deben ser una lista de textos'; end if;
    if jsonb_array_length(p_data->'synonyms')>20 then raise exception 'Capture como máximo 20 sinónimos por producto'; end if;
    aliases:='{}';
    for item in select value from jsonb_array_elements(p_data->'synonyms') loop
      if jsonb_typeof(item) is distinct from 'string' then raise exception 'Cada sinónimo debe ser texto'; end if;
      alias_name:=regexp_replace(item#>>'{}','^[[:space:]]+|[[:space:]]+$','','g'); key:=rcfito_private.product_term_compact(alias_name);
      if char_length(alias_name)<2 or char_length(alias_name)>80 or key='' then raise exception 'Cada sinónimo debe contener de 2 a 80 caracteres y al menos una letra o número'; end if;
      if key=any(keys) then raise exception 'No repita un sinónimo equivalente: "%"',alias_name; end if;
      if key=rcfito_private.product_term_compact(p_data->>'name') or key=rcfito_private.product_term_compact(p_data->>'code') then raise exception 'El sinónimo "%" equivale al nombre o código del mismo producto',alias_name; end if;
      aliases:=array_append(aliases,alias_name); keys:=array_append(keys,key);
    end loop;
    perform set_config('rcfito.product_synonym_write','save',true);
    -- Retirar antes del rename permite convertir un alias retirado en nombre.
    delete from public.product_synonyms where product_id=result and not(normalized_name=any(keys));
  end if;
  if result is null then
    insert into public.products(code,name,unit,default_dose,brand_id,product_family_id,active)
      values(p_data->>'code',p_data->>'name',p_data->>'unit',coalesce((p_data->>'default_dose')::numeric,0),nullif(p_data->>'brand_id','')::uuid,nullif(p_data->>'product_family_id','')::uuid,coalesce((p_data->>'active')::boolean,true)) returning id into result;
  else
    update public.products set code=p_data->>'code',name=p_data->>'name',unit=p_data->>'unit',default_dose=coalesce((p_data->>'default_dose')::numeric,0),brand_id=nullif(p_data->>'brand_id','')::uuid,product_family_id=nullif(p_data->>'product_family_id','')::uuid,active=coalesce((p_data->>'active')::boolean,true) where id=result;
    select coalesce(array_agg(active_ingredient_id),'{}') into existing_ingredients from public.product_ingredients where product_id=result;
    delete from public.product_ingredients where product_id=result;
  end if;
  for item in select value from jsonb_array_elements(p_ingredients) loop
    if not exists(select 1 from public.active_ingredients where id=(item->>'active_ingredient_id')::uuid and active) and not ((item->>'active_ingredient_id')::uuid=any(existing_ingredients)) then raise exception 'Seleccione ingredientes activos disponibles'; end if;
    insert into public.product_ingredients(product_id,active_ingredient_id,concentration) values(result,(item->>'active_ingredient_id')::uuid,nullif(btrim(item->>'concentration'),''));
  end loop;
  if p_data ? 'synonyms' then
    foreach alias_name in array aliases loop
      key:=rcfito_private.product_term_compact(alias_name);
      update public.product_synonyms set name=alias_name where product_id=result and normalized_name=key;
      if not found then insert into public.product_synonyms(product_id,name,created_by) values(result,alias_name,auth.uid()); end if;
    end loop;
    select coalesce(array_agg(name order by normalized_name),'{}') into after_names from public.product_synonyms where product_id=result;
    if before_names is distinct from after_names then
      select display_name into actor_name from public.profiles where id=auth.uid();
      insert into rcfito_private.product_synonym_changes(product_id,product_code,product_name,"before","after",changed_by,changed_by_name)
        values(result,p_data->>'code',p_data->>'name',before_names,after_names,auth.uid(),actor_name);
    end if;
  end if;
  perform set_config('rcfito.product_synonym_write',coalesce(previous_scope,''),true);
  return result;
end $$;
create or replace function public.save_product(p_data jsonb,p_ingredients jsonb default '[]') returns uuid language sql security invoker set search_path='' as $$select rcfito_private.save_product(p_data,p_ingredients)$$;

do $$ declare f regprocedure; begin
  for f in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='rcfito_private' and p.proname in ('product_term_normalized','product_term_compact','product_terms_conflict','lock_product_terms','assert_product_synonym','guard_product_terms','guard_product_synonyms','save_product') loop execute format('revoke all on function %s from public,anon,authenticated',f); end loop;
end $$;
-- Los triggers invoker de products llaman estas funciones puras/bajo RLS.
grant execute on function rcfito_private.product_term_normalized(text),rcfito_private.product_term_compact(text),rcfito_private.product_terms_conflict(text,text) to authenticated;
grant execute on function rcfito_private.save_product(jsonb,jsonb) to authenticated;
revoke all on function public.save_product(jsonb,jsonb) from public,anon;
grant execute on function public.save_product(jsonb,jsonb) to authenticated;

notify pgrst,'reload schema';
commit;
