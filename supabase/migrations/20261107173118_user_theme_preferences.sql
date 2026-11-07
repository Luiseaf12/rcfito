begin;
create table public.user_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  theme text not null default 'system' check(theme in ('system','light','dark'))
);
alter table public.user_preferences enable row level security;
revoke all on public.user_preferences from public, anon, authenticated;
grant select, insert, update on public.user_preferences to authenticated;
create policy own_active_preferences on public.user_preferences for all to authenticated
  using (user_id=(select auth.uid()) and (select rcfito_private.is_active_user()))
  with check (user_id=(select auth.uid()) and (select rcfito_private.is_active_user()));
comment on table public.user_preferences is 'Preferencias personales; cada cuenta activa administra solo las suyas, sin modificar permisos.';
notify pgrst, 'reload schema';
commit;
