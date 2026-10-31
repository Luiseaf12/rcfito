-- Solo para el contenedor efímero rcfito-backend-test. No ejecutar en Supabase.
do $$ begin
  if current_database()<>'rcfito_test' then raise exception 'Bootstrap limitado a rcfito_test'; end if;
end $$;
create role anon nologin;
create role authenticated nologin;
create schema auth;
create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb not null default '{}');
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$$;
grant usage on schema auth to anon,authenticated;
grant execute on function auth.uid() to anon,authenticated;
