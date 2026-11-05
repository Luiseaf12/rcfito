-- Solo fixtures ficticios en PostgreSQL aislado, revertidos al terminar.
begin;
do $$ begin if current_database()<>'rcfito_test' then raise exception 'Pruebas limitadas a rcfito_test'; end if; end $$;
create function pg_temp.assert_true(value boolean, description text) returns void language plpgsql as $$
begin if value is distinct from true then raise exception 'FAIL: %',description; end if; raise notice 'PASS: %',description; end $$;
create function pg_temp.expect_error(statement text, pattern text, description text) returns void language plpgsql as $$
begin
  begin execute statement; exception when others then
    if sqlerrm !~* pattern then raise exception 'FAIL: %; error inesperado: %',description,sqlerrm; end if;
    raise notice 'PASS: %',description; return;
  end;
  raise exception 'FAIL: %; la operación debía fallar',description;
end $$;

insert into auth.users(id,email) values
('a1000000-0000-4000-8000-000000000001','classification-admin@example.invalid'),
('a1000000-0000-4000-8000-000000000002','classification-reader@example.invalid');
update public.profiles set role='admin' where id='a1000000-0000-4000-8000-000000000001';
do $$ begin
  if exists(select 1 from pg_attribute where attrelid='public.profiles'::regclass and attname='menu_permissions' and not attisdropped) then
    execute $seed$update public.profiles set menu_permissions=array_remove(array_remove(array_remove(rcfito_private.menu_keys(),'ai_capture'),'users'),'connection') where role='viewer'$seed$;
  end if;
end $$;

insert into public.active_ingredients(id,code,name) values('a2000000-0000-4000-8000-000000000001','CL-IA','Ingrediente ficticio');
select pg_temp.assert_true((select classification_id is null from public.active_ingredients where code='CL-IA'),'ingrediente puede conservarse sin clasificación');

set local role anon;
select pg_temp.expect_error('select * from public.ingredient_classifications','permission denied','anónimo no consulta clasificaciones');
reset role;
set local role authenticated;
set local request.jwt.claim.sub='a1000000-0000-4000-8000-000000000001';
insert into public.ingredient_classifications(id,code,name,active) values
('a3000000-0000-4000-8000-000000000001','CL-A','Clasificación ficticia',true),
('a3000000-0000-4000-8000-000000000002','CL-B','Otra clasificación ficticia',false);
select pg_temp.assert_true((select count(*)=2 from public.ingredient_classifications),'administrador crea y consulta clasificaciones');
select pg_temp.expect_error($q$insert into public.ingredient_classifications(code,name) values('CL-DUP','  CLASIFICACION FICTICIA  ')$q$,'unique constraint','unicidad normaliza acentos, caso y espacios exteriores');
select pg_temp.expect_error($q$insert into public.ingredient_classifications(code,name) values('CL-VACIO','   ')$q$,'check constraint','clasificación exige nombre');
update public.active_ingredients set classification_id='a3000000-0000-4000-8000-000000000001' where code='CL-IA';
select pg_temp.assert_true((select classification_id='a3000000-0000-4000-8000-000000000001' from public.active_ingredients where code='CL-IA'),'ingrediente se relaciona con una clasificación activa');
select pg_temp.expect_error($q$update public.active_ingredients set classification_id='a3000000-0000-4000-8000-000000000099' where code='CL-IA'$q$,'clasificación activa','referencia inexistente se rechaza');
select pg_temp.expect_error($q$update public.active_ingredients set classification_id='a3000000-0000-4000-8000-000000000002' where code='CL-IA'$q$,'clasificación activa','relación nueva con clasificación inactiva se rechaza');
select pg_temp.expect_error($q$delete from public.ingredient_classifications where code='CL-A'$q$,'foreign key','clasificación relacionada no se elimina');
update public.ingredient_classifications set name='Clasificación corregida',active=false where code='CL-A';
update public.active_ingredients set name='Ingrediente corregido',classification_id=classification_id where code='CL-IA';
select pg_temp.assert_true((select i.name='Ingrediente corregido' and c.name='Clasificación corregida' and not c.active from public.active_ingredients i join public.ingredient_classifications c on c.id=i.classification_id where i.code='CL-IA'),'edición conserva relación inactiva existente');
select pg_temp.expect_error($q$insert into public.active_ingredients(code,name,classification_id) values('CL-NUEVO','Ingrediente nuevo','a3000000-0000-4000-8000-000000000001')$q$,'clasificación activa','otro ingrediente no puede añadir la clasificación inactiva');

set local request.jwt.claim.sub='a1000000-0000-4000-8000-000000000002';
select pg_temp.assert_true((select count(*)=2 from public.ingredient_classifications),'lector activo consulta catálogo común e inactivos relacionados');
select pg_temp.expect_error($q$insert into public.ingredient_classifications(code,name) values('CL-NO','No permitido')$q$,'row-level security','lector no crea clasificaciones');
update public.ingredient_classifications set name='No autorizado' where code='CL-A';
select pg_temp.assert_true((select name='Clasificación corregida' from public.ingredient_classifications where code='CL-A'),'lector no edita clasificación por API directa');
update public.active_ingredients set classification_id=null where code='CL-IA';
select pg_temp.assert_true((select classification_id is not null from public.active_ingredients where code='CL-IA'),'lector no cambia relación por API directa');
set local request.jwt.claim.sub='a1000000-0000-4000-8000-000000000001';
update public.ingredient_classifications set active=true where code='CL-B';
update public.active_ingredients set classification_id='a3000000-0000-4000-8000-000000000002' where code='CL-IA';
select pg_temp.assert_true((select classification_id='a3000000-0000-4000-8000-000000000002' from public.active_ingredients where code='CL-IA'),'administrador puede cambiar clasificación principal');
update public.active_ingredients set classification_id=null where code='CL-IA';
select pg_temp.assert_true((select classification_id is null from public.active_ingredients where code='CL-IA'),'administrador puede retirar clasificación sin borrar ingrediente');
delete from public.ingredient_classifications where code='CL-B';
select pg_temp.assert_true((select count(*)=0 from public.ingredient_classifications where code='CL-B'),'clasificación sin relaciones se puede eliminar');
reset role;
update public.profiles set active=false where id='a1000000-0000-4000-8000-000000000002';
set local role authenticated;
set local request.jwt.claim.sub='a1000000-0000-4000-8000-000000000002';
select pg_temp.assert_true((select count(*)=0 from public.ingredient_classifications),'perfil inactivo pierde lectura de clasificaciones');
reset role;
rollback;
