-- Datos ficticios; solo en PostgreSQL efímero sin puertos publicados.
begin;
do $$ begin if current_database()<>'rcfito_test' then raise exception 'Pruebas limitadas a rcfito_test'; end if; end $$;
create or replace function pg_temp.assert_true(value boolean, description text) returns void language plpgsql as $$
begin if value is distinct from true then raise exception 'FAIL: %',description; end if; raise notice 'PASS: %',description; end $$;
create or replace function pg_temp.expect_error(statement text, pattern text, description text) returns void language plpgsql as $$
begin begin execute statement; exception when others then
  if sqlerrm !~* pattern then raise exception 'FAIL: %; error inesperado: %',description,sqlerrm; end if;
  raise notice 'PASS: %',description; return;
end; raise exception 'FAIL: %; la operación debía fallar',description; end $$;
insert into auth.users(id,email) values ('10000000-0000-4000-8000-000000000001','admin@example.invalid'),('10000000-0000-4000-8000-000000000002','reader@example.invalid'),('10000000-0000-4000-8000-000000000003','unassigned@example.invalid');
update public.profiles set role='admin' where id='10000000-0000-4000-8000-000000000001';
insert into public.agricultural_units(id,code,name) values ('20000000-0000-4000-8000-000000000001','A','Agrícola A ficticia'),('20000000-0000-4000-8000-000000000002','B','Agrícola B ficticia');
insert into public.fields(id,agricultural_unit_id,code,name) values
('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','A','Campo A'),('30000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','B','Campo B'),('30000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000002','C','Campo C');
insert into public.crops(id,code,name) values('40000000-0000-4000-8000-000000000001','PEP','Pepino');
insert into public.varieties(id,crop_id,code,name) values('50000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','V','Variedad');
insert into public.infrastructure_types(id,code,name) values('60000000-0000-4000-8000-000000000001','CA','Campo abierto');
insert into public.active_ingredients(id,code,name) values('70000000-0000-4000-8000-000000000001','I','Ingrediente');
insert into public.application_methods(id,code,name) values('71000000-0000-4000-8000-000000000001','DR','Dron');
insert into public.products(id,code,name,unit,default_dose) values
('72000000-0000-4000-8000-000000000001','P1','Producto original','g',12),('72000000-0000-4000-8000-000000000002','P2','Producto segundo','ml',8),('72000000-0000-4000-8000-000000000003','P3','Producto nuevo','ml',3);
insert into public.product_ingredients(product_id,active_ingredient_id,concentration) values('72000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000001','50 g/L');
insert into public.user_agricultural_units values('10000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001');
set local role authenticated;
set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000001';
select set_config('test.project',public.create_sowing_project('{"agricultural_unit_id":"20000000-0000-4000-8000-000000000001","name":"Temporada A","season":"2026"}')::text,true);
select set_config('test.project_b',public.create_sowing_project('{"agricultural_unit_id":"20000000-0000-4000-8000-000000000002","name":"Temporada B","season":"2026"}')::text,true);
update public.sowing_projects set status='active';
do $$ declare lot uuid; sub uuid; pid uuid; fid uuid; begin
  for i in 1..4 loop
    pid:=case when i=4 then current_setting('test.project_b')::uuid else current_setting('test.project')::uuid end;
    fid:=case when i=4 then '30000000-0000-4000-8000-000000000003'::uuid when i=3 then '30000000-0000-4000-8000-000000000002'::uuid else '30000000-0000-4000-8000-000000000001'::uuid end;
    lot:=public.create_project_lot(jsonb_build_object('project_id',pid,'field_id',fid,'code','L'||i,'name','Lote '||i,'area_ha',5,'infrastructure_type_id','60000000-0000-4000-8000-000000000001'));
    select id into sub from public.lot_subdivisions where lot_id=lot;
    perform public.save_sowing_stage(jsonb_build_object('id',format('80000000-0000-4000-8000-%s',lpad(i::text,12,'0')),'subdivision_id',sub,'crop_id','40000000-0000-4000-8000-000000000001','variety_id','50000000-0000-4000-8000-000000000001','area_ha',5,'planned_sowing_date','2026-01-01'));
    perform public.transition_sowing_stage(format('80000000-0000-4000-8000-%s',lpad(i::text,12,'0'))::uuid,'planted','2026-01-02');
  end loop;
end $$;
create function pg_temp.order_data(p_id text default '90000000-0000-4000-8000-000000000001') returns jsonb language sql as $$
select jsonb_build_object('id',p_id,'project_id',current_setting('test.project'),'field_id','30000000-0000-4000-8000-000000000001','crop_id','40000000-0000-4000-8000-000000000001','method_id','71000000-0000-4000-8000-000000000001','indicated_date','2026-01-03','scheduled_date','2026-01-06','water_l_ha',100,'observations','Indicación original') $$;
create function pg_temp.mixture() returns jsonb language sql as $$ select '[{"product_id":"72000000-0000-4000-8000-000000000001","dose":12},{"product_id":"72000000-0000-4000-8000-000000000002","dose":8}]'::jsonb $$;
create function pg_temp.stages() returns uuid[] language sql as $$ select array['80000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000002']::uuid[] $$;
create function pg_temp.target_ids(p_order uuid) returns uuid[] language sql as $$ select array_agg(id order by id) from public.application_targets where order_id=p_order $$;
create function pg_temp.group_data() returns jsonb language sql as $$ select pg_temp.order_data() - array['method_id','indicated_date','scheduled_date','water_l_ha','observations']::text[] || '{"id":"91000000-0000-4000-8000-000000000001","name":"Grupo manual","active":true}'::jsonb $$;

select pg_temp.expect_error($q$select public.create_application_order(pg_temp.order_data(),array['80000000-0000-4000-8000-000000000003']::uuid[],pg_temp.mixture())$q$,'mismo proyecto, campo y cultivo','destinos de otro campo rechazados');
select pg_temp.expect_error($q$select public.create_application_order(pg_temp.order_data(),array['80000000-0000-4000-8000-000000000004']::uuid[],pg_temp.mixture())$q$,'mismo proyecto, campo y cultivo','destinos de otra agrícola rechazados');
select pg_temp.expect_error($q$select public.create_application_order(pg_temp.order_data(),null,pg_temp.mixture())$q$,'destinos','NULL no crea orden sin destinos');
select pg_temp.expect_error($q$select public.create_application_order(pg_temp.order_data(),array['80000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000001']::uuid[],pg_temp.mixture())$q$,'repita','destinos duplicados rechazados');
select pg_temp.expect_error($q$select public.create_application_order(pg_temp.order_data(),pg_temp.stages(),'[]')$q$,'al menos un producto','mezcla vacía rechazada');
select pg_temp.expect_error($q$select public.create_application_order(pg_temp.order_data(),pg_temp.stages(),'[{"product_id":"72000000-0000-4000-8000-000000000001","dose":0}]')$q$,'mayor que cero','dosis cero rechazada');
select pg_temp.expect_error($q$select public.create_application_order(pg_temp.order_data()||'{"water_l_ha":0}',pg_temp.stages(),pg_temp.mixture())$q$,'gasto','agua cero rechazada');
select pg_temp.expect_error($q$select public.create_application_order(pg_temp.order_data()||'{"indicated_date":"2026-01-01"}',pg_temp.stages(),pg_temp.mixture())$q$,'preceder','indicación no precede siembra');
select pg_temp.expect_error($q$select public.create_application_order(pg_temp.order_data()||'{"scheduled_date":"2026-01-02"}',pg_temp.stages(),pg_temp.mixture())$q$,'fechas','programación no precede indicación');
select pg_temp.assert_true((select count(*)=0 from public.application_orders),'errores de creación no dejan filas parciales');
select public.create_application_order(pg_temp.order_data(),pg_temp.stages(),pg_temp.mixture());
select pg_temp.assert_true((select count(*)=2 and sum(area_ha)=10 from public.application_targets),'dos destinos completos con superficie de siembra');
select pg_temp.assert_true((select folio~'^APL-[0-9]{6,}$' from public.application_orders),'folio global legible');
select pg_temp.assert_true(public.create_application_order(pg_temp.order_data(),pg_temp.stages(),pg_temp.mixture())='90000000-0000-4000-8000-000000000001'::uuid,'UUID estable retorna la misma orden');
select pg_temp.expect_error($q$select public.create_application_order(pg_temp.order_data()||'{"water_l_ha":99}',pg_temp.stages(),pg_temp.mixture())$q$,'UUID','UUID con otra captura rechaza conflicto');
select pg_temp.expect_error($q$update public.application_orders set water_l_ha=1$q$,'permission denied','administrador no altera indicación directamente');
select pg_temp.expect_error($q$update public.application_targets set status='cancelled',cancellation_reason='Atajo'$q$,'permission denied','administrador no salta transición directa');
select pg_temp.expect_error($q$delete from public.application_order_products$q$,'permission denied','mezcla original no se elimina por tabla');
select pg_temp.expect_error($q$update public.products set unit='ml' where id='72000000-0000-4000-8000-000000000001'$q$,'unidad','unidad usada permanece fija');
select pg_temp.expect_error($q$delete from public.application_methods where id='71000000-0000-4000-8000-000000000001'$q$,'foreign key','medio usado conserva referencia');
select pg_temp.expect_error($q$select public.transition_sowing_stage('80000000-0000-4000-8000-000000000001','closed','2026-01-10')$q$,'indicadas','RPC cierre bloquea pendientes');
select pg_temp.expect_error($q$update public.sowing_stages set status='closed',end_date='2026-01-10' where id='80000000-0000-4000-8000-000000000001'$q$,'indicadas','cierre directo bloquea pendientes');
select pg_temp.expect_error(format($q$select public.close_sowing_project('%s')$q$,current_setting('test.project')),'indicadas|etapas','cierre temporada bloquea pendientes');
select pg_temp.expect_error($q$select public.cancel_application_targets('90000000-0000-4000-8000-000000000001',pg_temp.target_ids('90000000-0000-4000-8000-000000000001'),'  ')$q$,'motivo','cancelación requiere motivo');
select public.save_sowing_group(pg_temp.group_data(),pg_temp.stages());
select pg_temp.expect_error($q$select public.save_sowing_group(pg_temp.group_data()||'{"id":"91000000-0000-4000-8000-000000000002","name":"GRÚPO MANUAL"}',pg_temp.stages())$q$,'mismo|nombre','grupo no duplica nombre con acentos y mayúsculas');
select public.save_sowing_group(pg_temp.group_data(),array['80000000-0000-4000-8000-000000000001']::uuid[]);
select pg_temp.assert_true((select count(*)=2 and count(*) filter(where active)=1 and count(*) filter(where retired_at is not null)=1 from public.sowing_group_members),'retirar miembro conserva asociación histórica');
select public.save_sowing_group(pg_temp.group_data(),pg_temp.stages());
select pg_temp.assert_true((select count(*)=2 and bool_and(active) from public.sowing_group_members),'reelegir miembro no duplica historia');
select pg_temp.expect_error($q$select public.save_sowing_group(pg_temp.group_data(),array['80000000-0000-4000-8000-000000000003']::uuid[])$q$,'mismo campo y cultivo','grupo no acepta otro campo');
select pg_temp.expect_error($q$select public.save_sowing_group(pg_temp.group_data(),'{}')$q$,'destinos','grupo activo necesita miembros');
update public.products set name='Renombrado',active=false where id='72000000-0000-4000-8000-000000000001';
update public.active_ingredients set name='Ingrediente renombrado';
update public.fields set name='Campo renombrado' where id='30000000-0000-4000-8000-000000000001';
select pg_temp.assert_true((select product_name='Producto original' and ingredients_snapshot->0->>'name'='Ingrediente' from public.application_order_products where product_id='72000000-0000-4000-8000-000000000001'),'mezcla congela producto e ingrediente');
select pg_temp.assert_true((select field_name='Campo A' from public.application_orders),'orden congela nombre del campo');
select pg_temp.expect_error($q$select public.create_application_order(pg_temp.order_data('90000000-0000-4000-8000-000000000002'),pg_temp.stages(),pg_temp.mixture())$q$,'activos','nueva indicación no usa producto inactivo');
select pg_temp.expect_error($q$select public.perform_application_targets('90000000-0000-4000-8000-000000000001',pg_temp.target_ids('90000000-0000-4000-8000-000000000001'),'{"changed":false,"actual_date":"2026-01-02"}')$q$,'indicación','realización no precede indicación');
select pg_temp.expect_error(format($q$select public.perform_application_targets('90000000-0000-4000-8000-000000000001',pg_temp.target_ids('90000000-0000-4000-8000-000000000001'),'{"changed":false,"actual_date":"%s"}')$q$,(now() at time zone 'America/Mazatlan')::date+1),'hoy','realización futura rechazada');
select public.perform_application_targets('90000000-0000-4000-8000-000000000001',array[(select id from public.application_targets where stage_id='80000000-0000-4000-8000-000000000001')],'{"changed":false,"actual_date":"2026-01-04","equipment":"Dron A","water_l_ha":999,"products":[]}');
select pg_temp.assert_true((select status='performed' and actual_water_l_ha=100 and not has_changes from public.application_targets where stage_id='80000000-0000-4000-8000-000000000001'),'realización normal ignora overrides y copia agua');
select pg_temp.assert_true((select count(*)=2 and sum(dose)=20 from public.application_actual_products),'normal copia mezcla aun con producto original inactivo');
select pg_temp.assert_true((select performed_count=1 from public.application_stage_counts where stage_id='80000000-0000-4000-8000-000000000001'),'conteo una aplicación aunque contiene dos productos');
select pg_temp.expect_error($q$select public.perform_application_targets('90000000-0000-4000-8000-000000000001',pg_temp.target_ids('90000000-0000-4000-8000-000000000001'),'{"changed":false,"actual_date":"2026-01-05"}')$q$,'definitivo','lote de destinos rechaza conflicto terminal');
select pg_temp.assert_true((select status='indicated' from public.application_targets where stage_id='80000000-0000-4000-8000-000000000002'),'fallo mixto no realiza el destino pendiente');
select public.perform_application_targets('90000000-0000-4000-8000-000000000001',array[(select id from public.application_targets where stage_id='80000000-0000-4000-8000-000000000002')],'{"changed":true,"actual_date":"2026-01-05","equipment":"Tractor","water_l_ha":80,"products":[{"product_id":"72000000-0000-4000-8000-000000000001","dose":11},{"product_id":"72000000-0000-4000-8000-000000000003","dose":4}]}');
select pg_temp.assert_true((select has_changes and actual_water_l_ha=80 from public.application_targets where stage_id='80000000-0000-4000-8000-000000000002'),'excepción conserva agua distinta');
select pg_temp.assert_true((select count(*)=2 and sum(dose)=20 from public.application_order_products),'excepción no reescribe mezcla indicada');
select pg_temp.assert_true((select product_name='Producto original' and unit='g' from public.application_actual_products p join public.application_targets t on t.id=p.target_id where t.stage_id='80000000-0000-4000-8000-000000000002' and product_id='72000000-0000-4000-8000-000000000001'),'excepción retiene snapshot original inactivo');
select pg_temp.expect_error($q$select public.transition_sowing_stage('80000000-0000-4000-8000-000000000001','closed','2026-01-03')$q$,'última aplicación','cierre no precede última realización');
select public.transition_sowing_stage('80000000-0000-4000-8000-000000000001','closed','2026-01-10');
select public.transition_sowing_stage('80000000-0000-4000-8000-000000000002','closed','2026-01-10');
update public.products set active=false where id='72000000-0000-4000-8000-000000000003';
select public.perform_application_targets('90000000-0000-4000-8000-000000000001',array[(select id from public.application_targets where stage_id='80000000-0000-4000-8000-000000000002')],'{"changed":true,"actual_date":"2026-01-05","equipment":"Tractor","water_l_ha":80,"products":[{"product_id":"72000000-0000-4000-8000-000000000001","dose":11},{"product_id":"72000000-0000-4000-8000-000000000003","dose":4}]}');
select pg_temp.assert_true((select count(*)=4 from public.application_actual_products),'retry excepción después de cierre e inactivación no duplica');
select pg_temp.assert_true(public.create_application_order(pg_temp.order_data(),pg_temp.stages(),pg_temp.mixture())='90000000-0000-4000-8000-000000000001'::uuid,'retry orden tras cierre conserva original');
select public.save_sowing_group(pg_temp.group_data(),pg_temp.stages());
select pg_temp.assert_true((select count(*)=2 from public.sowing_group_members),'retry grupo tras cierre conserva miembros históricos');
select public.save_sowing_group(pg_temp.group_data()||'{"active":false}','{}');
select pg_temp.assert_true((select count(*)=2 and not bool_or(active) from public.sowing_group_members),'desactivar grupo retira miembros sin borrar');
select pg_temp.expect_error($q$select public.save_sowing_group(pg_temp.group_data(),pg_temp.stages())$q$,'sembradas','grupo no reelige etapas cerradas');

-- Marking an exception and then restoring the original values is not a difference.
select public.create_application_order(pg_temp.order_data('90000000-0000-4000-8000-000000000002')||'{"field_id":"30000000-0000-4000-8000-000000000002"}',array['80000000-0000-4000-8000-000000000003']::uuid[],'[{"product_id":"72000000-0000-4000-8000-000000000002","dose":8}]');
select pg_temp.expect_error($q$select public.perform_application_targets('90000000-0000-4000-8000-000000000002',pg_temp.target_ids('90000000-0000-4000-8000-000000000002'),'{"changed":true,"actual_date":"2026-01-05","water_l_ha":100,"products":[{"product_id":"72000000-0000-4000-8000-000000000003","dose":4}]}')$q$,'activos','excepción no introduce producto nuevo inactivo');
select pg_temp.assert_true((select status='indicated' from public.application_targets where order_id='90000000-0000-4000-8000-000000000002'),'excepción inválida no guarda estado parcial');
select public.perform_application_targets('90000000-0000-4000-8000-000000000002',pg_temp.target_ids('90000000-0000-4000-8000-000000000002'),'{"changed":true,"actual_date":"2026-01-05","water_l_ha":100,"products":[{"product_id":"72000000-0000-4000-8000-000000000002","dose":8}]}');
select pg_temp.assert_true((select not has_changes from public.application_targets where order_id='90000000-0000-4000-8000-000000000002'),'excepción con valores iguales no declara diferencias');

-- A second agricultural unit proves parent/child RLS without names leaking.
select public.create_application_order(pg_temp.order_data('90000000-0000-4000-8000-000000000003')||jsonb_build_object('project_id',current_setting('test.project_b'),'field_id','30000000-0000-4000-8000-000000000003'),array['80000000-0000-4000-8000-000000000004']::uuid[],'[{"product_id":"72000000-0000-4000-8000-000000000002","dose":8}]');
select public.cancel_application_targets('90000000-0000-4000-8000-000000000003',pg_temp.target_ids('90000000-0000-4000-8000-000000000003'),'No se realizará');
select public.cancel_application_targets('90000000-0000-4000-8000-000000000003',pg_temp.target_ids('90000000-0000-4000-8000-000000000003'),'No se realizará');
select pg_temp.assert_true((select cancelled_count=1 from public.application_stage_counts where stage_id='80000000-0000-4000-8000-000000000004'),'cancelación repetida cuenta una sola vez');
select pg_temp.expect_error($q$select public.cancel_application_targets('90000000-0000-4000-8000-000000000003',pg_temp.target_ids('90000000-0000-4000-8000-000000000003'),'Otro motivo')$q$,'definitivo','cancelación terminal no cambia motivo');
select pg_temp.expect_error($q$select public.perform_application_targets('90000000-0000-4000-8000-000000000003',pg_temp.target_ids('90000000-0000-4000-8000-000000000003'),'{"changed":false,"actual_date":"2026-01-04"}')$q$,'definitivo','cancelada no puede realizarse');
set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000002';
select pg_temp.assert_true((select count(*)=2 from public.application_orders),'lector solo ve órdenes de agrícola asignada');
select pg_temp.assert_true((select count(*)=3 from public.application_targets),'RLS destinos sigue agrícola');
select pg_temp.assert_true((select count(*)=5 from public.application_actual_products),'RLS mezcla real sigue agrícola');
select pg_temp.assert_true((select count(*)=3 from public.application_stage_counts),'view invoker no filtra fuera de RLS');
select pg_temp.assert_true((select count(*)=1 from public.sowing_groups),'lector ve grupo permitido');
select pg_temp.expect_error($q$select public.create_application_order(pg_temp.order_data(),pg_temp.stages(),pg_temp.mixture())$q$,'administrador','lector no crea órdenes');
select pg_temp.expect_error($q$select public.save_sowing_group(pg_temp.group_data(),'{}')$q$,'administrador','lector no guarda grupos');
select pg_temp.expect_error($q$select public.cancel_application_targets('90000000-0000-4000-8000-000000000001',pg_temp.target_ids('90000000-0000-4000-8000-000000000001'),'No')$q$,'administrador','lector no cambia resultados');
set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000003';
select pg_temp.assert_true((select count(*)=0 from public.application_orders),'lector sin asignación no ve ninguna orden');
reset role;
update public.profiles set active=false where id='10000000-0000-4000-8000-000000000001';
set local role authenticated;
set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000001';
select pg_temp.assert_true((select count(*)=0 from public.application_targets),'administrador inactivo pierde lectura con JWT anterior');
select pg_temp.expect_error($q$select public.create_application_order(pg_temp.order_data(),pg_temp.stages(),pg_temp.mixture())$q$,'administrador','administrador inactivo pierde RPC');
reset role;
set local role anon;
select pg_temp.expect_error('select * from public.application_orders','permission denied','anon no consulta aplicaciones');
select pg_temp.expect_error($q$select public.cancel_application_targets(null,null,null)$q$,'permission denied','anon no ejecuta RPC');
reset role;
select pg_temp.assert_true((select bool_and(not prosecdef) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('create_application_order','perform_application_targets','cancel_application_targets','save_sowing_group')),'RPC públicas son invoker');
select pg_temp.assert_true((select count(*)=6 and bool_and(relrowsecurity) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('application_orders','application_order_products','application_targets','application_actual_products','sowing_groups','sowing_group_members')),'seis tablas expuestas con RLS');
rollback;
