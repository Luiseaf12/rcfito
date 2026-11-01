-- Catálogo configurable del uso principal de ingredientes, sin clasificar datos existentes.
begin;

create table public.ingredient_classifications (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check(btrim(code) <> ''),
  name text not null check(btrim(name) <> ''),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index ingredient_classifications_name_unique on public.ingredient_classifications
  (lower(regexp_replace(normalize(btrim(name),NFD),U&'[\0300-\036f]','','g')));

alter table public.active_ingredients add column classification_id uuid
  references public.ingredient_classifications(id) on delete restrict;
create index active_ingredients_classification_idx on public.active_ingredients(classification_id);

alter table public.ingredient_classifications enable row level security;
revoke all on public.ingredient_classifications from public,anon,authenticated;
grant select,insert,update,delete on public.ingredient_classifications to authenticated;
create policy admin_all on public.ingredient_classifications for all to authenticated
  using(rcfito_private.is_admin()) with check(rcfito_private.is_admin());
create policy active_reader on public.ingredient_classifications for select to authenticated
  using(rcfito_private.is_active_user());

create function rcfito_private.guard_ingredient_classification() returns trigger
language plpgsql security invoker set search_path='' as $$
declare classification_active boolean;
begin
  if new.classification_id is null then return new; end if;
  if tg_op='UPDATE' and new.classification_id is not distinct from old.classification_id then return new; end if;
  select active into classification_active from public.ingredient_classifications
    where id=new.classification_id for share;
  if classification_active is distinct from true then
    raise exception 'Selecciona una clasificación activa disponible. La clasificación inactiva existente puede conservarse.';
  end if;
  return new;
end $$;
revoke all on function rcfito_private.guard_ingredient_classification() from public,anon;
grant execute on function rcfito_private.guard_ingredient_classification() to authenticated;
create trigger guard_ingredient_classification before insert or update of classification_id
  on public.active_ingredients for each row execute function rcfito_private.guard_ingredient_classification();

notify pgrst, 'reload schema';
commit;
