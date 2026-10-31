-- Fixtures ficticios. Transacción revertida al terminar; requiere rcfito_test.
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

insert into auth.users(id,email,raw_user_meta_data) values
('10000000-0000-4000-8000-000000000001','admin@example.invalid','{"role":"admin"}'),
('10000000-0000-4000-8000-000000000002','lector@example.invalid','{}'),
('10000000-0000-4000-8000-000000000003','sin-asignar@example.invalid','{}');
select pg_temp.assert_true((select role='viewer' from public.profiles where id='10000000-0000-4000-8000-000000000001'),'Auth no toma rol administrador desde user_metadata');
update public.profiles set role='admin' where id='10000000-0000-4000-8000-000000000001';

insert into public.agricultural_units(id,code,name) values
('20000000-0000-4000-8000-000000000001','AG-A','Agrícola A ficticia'),
('20000000-0000-4000-8000-000000000002','AG-B','Agrícola B ficticia');
insert into public.fields(id,agricultural_unit_id,code,name) values
('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','CA','Campo A ficticio'),
('30000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002','CB','Campo B ficticio');
insert into public.crops(id,code,name) values
('40000000-0000-4000-8000-000000000001','PEP','Pepino ficticio'),
('40000000-0000-4000-8000-000000000002','TOM','Tomate ficticio');
insert into public.varieties(id,crop_id,code,name) values
('50000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','V1','Variedad A ficticia'),
('50000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000002','V2','Variedad B ficticia');
insert into public.infrastructure_types(id,code,name) values('60000000-0000-4000-8000-000000000001','CA','Campo abierto ficticio');
insert into public.active_ingredients(id,code,name) values('70000000-0000-4000-8000-000000000001','IA','Ingrediente ficticio');
insert into public.user_agricultural_units values('10000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001');

set local role anon;
select pg_temp.expect_error('select * from public.agricultural_units','permission denied','anon no consulta datos');
reset role;
set local role authenticated;
set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000002';
select pg_temp.assert_true((select count(*)=1 from public.agricultural_units),'lector ve solo agrícola asignada');
select pg_temp.assert_true((select count(*)=1 from public.fields),'lector no ve campos de otra agrícola');
select pg_temp.assert_true((select count(*)=1 from public.profiles),'lector solo ve su perfil');
select pg_temp.expect_error($q$insert into public.crops(code,name) values('BAD','No permitido')$q$,'row-level security','lector no mantiene catálogos');
select pg_temp.expect_error($q$select public.create_sowing_project('{}')$q$,'administrador','RPC rechaza lector');
update public.profiles set role='admin' where id=auth.uid();
select pg_temp.assert_true((select role='viewer' from public.profiles where id=auth.uid()),'lector no escala su rol con API directa');

set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000001';
select set_config('test.project_a', public.create_sowing_project('{"agricultural_unit_id":"20000000-0000-4000-8000-000000000001","name":"Proyecto A","season":"2026","start_date":"2026-10-01"}')::text,true);
select set_config('test.project_b', public.create_sowing_project('{"agricultural_unit_id":"20000000-0000-4000-8000-000000000002","name":"Proyecto B","season":"2026","start_date":"2026-10-01"}')::text,true);
select pg_temp.assert_true((select count(*)=2 from public.sowing_projects),'agrícolas diferentes pueden tener temporadas abiertas');
select pg_temp.expect_error($q$select public.create_sowing_project('{"agricultural_unit_id":"20000000-0000-4000-8000-000000000001","name":"Siguiente","season":"2027","start_date":"2027-01-01"}')$q$,'unique constraint','no captura siguiente temporada mientras hay una abierta');

select set_config('test.lot',public.create_project_lot(jsonb_build_object('project_id',current_setting('test.project_a'),'field_id','30000000-0000-4000-8000-000000000001','code','L1','name','Lote 1 ficticio','area_ha',10,'infrastructure_type_id','60000000-0000-4000-8000-000000000001'))::text,true);
select pg_temp.assert_true((select count(*)=1 and sum(area_ha)=10 from public.lot_subdivisions where lot_id=current_setting('test.lot')::uuid),'crear lote genera subdivisión completa atómica');
select set_config('test.subdivision',(select id::text from public.lot_subdivisions where lot_id=current_setting('test.lot')::uuid),true);
select pg_temp.expect_error($q$update public.fields set agricultural_unit_id='20000000-0000-4000-8000-000000000002' where id='30000000-0000-4000-8000-000000000001'$q$,'historial','campo usado no cambia de agrícola');
select pg_temp.expect_error(format($q$select public.create_project_lot('{
"project_id":"%s","field_id":"30000000-0000-4000-8000-000000000002","code":"BAD","name":"Fuera","area_ha":2,"infrastructure_type_id":"60000000-0000-4000-8000-000000000001"}')$q$,current_setting('test.project_a')),'pertenecer','lote no usa campo de otra agrícola');
select pg_temp.expect_error(format($q$select public.replace_lot_subdivisions('%s','[{"code":"A","name":"Parte A","area_ha":8},{"code":"B","name":"Parte B","area_ha":8}]')$q$,current_setting('test.lot')),'excede','subdivisiones no exceden superficie física');
select pg_temp.assert_true((select count(*)=1 and sum(area_ha)=10 from public.lot_subdivisions where lot_id=current_setting('test.lot')::uuid and active),'error de redistribución revierte retiros parciales');
select pg_temp.expect_error(format($q$select public.replace_lot_subdivisions('%s',null)$q$,current_setting('test.lot')),'al menos una','redistribución NULL no retira todas las subdivisiones');
select pg_temp.assert_true((select count(*)=1 from public.lot_subdivisions where lot_id=current_setting('test.lot')::uuid and active),'NULL conserva subdivisión vigente');
select set_config('test.unused_lot',public.create_project_lot(jsonb_build_object('project_id',current_setting('test.project_a'),'field_id','30000000-0000-4000-8000-000000000001','code','BORRAR','name','Sin historial','area_ha',1,'infrastructure_type_id','60000000-0000-4000-8000-000000000001'))::text,true);
select public.delete_project_lot(current_setting('test.unused_lot')::uuid);
select pg_temp.assert_true((select count(*)=0 from public.lot_subdivisions where lot_id=current_setting('test.unused_lot')::uuid),'eliminar lote sin uso retira subdivisión default atómicamente');

select set_config('test.stage1',public.save_sowing_stage(jsonb_build_object('id','80000000-0000-4000-8000-000000000001','subdivision_id',current_setting('test.subdivision'),'crop_id','40000000-0000-4000-8000-000000000001','variety_id','50000000-0000-4000-8000-000000000001','area_ha',9,'planned_sowing_date','2026-10-02'))::text,true);
select public.save_sowing_stage(jsonb_build_object('id',current_setting('test.stage1'),'subdivision_id',current_setting('test.subdivision'),'crop_id','40000000-0000-4000-8000-000000000001','variety_id','50000000-0000-4000-8000-000000000001','area_ha',9,'planned_sowing_date','2026-10-02'));
select pg_temp.assert_true((select count(*)=1 from public.sowing_stages where subdivision_id=current_setting('test.subdivision')::uuid),'reintento de alta con UUID estable no duplica etapa');
select pg_temp.expect_error(format($q$select public.transition_sowing_stage('%s','planted','2026-10-03')$q$,current_setting('test.stage1')),'Active el proyecto','siembra real requiere proyecto activo');
update public.sowing_projects set status='active' where id=current_setting('test.project_a')::uuid;
select public.transition_sowing_stage(current_setting('test.stage1')::uuid,'planted','2026-10-03');
select pg_temp.expect_error(format($q$select public.delete_project_lot('%s')$q$,current_setting('test.lot')),'historial','no se elimina lote con siembras');
select pg_temp.expect_error(format($q$select public.transition_sowing_stage('%s',null,'2026-10-03')$q$,current_setting('test.stage1')),'transición válidas','estado NULL no cierra una siembra');
select set_config('test.stage2',public.save_sowing_stage(jsonb_build_object('subdivision_id',current_setting('test.subdivision'),'crop_id','40000000-0000-4000-8000-000000000001','variety_id','50000000-0000-4000-8000-000000000001','area_ha',10,'planned_sowing_date','2026-11-01'))::text,true);
select pg_temp.assert_true((select stage_number=2 and status='planned' from public.sowing_stages where id=current_setting('test.stage2')::uuid),'permite planear etapa siguiente mientras actual sembrada');
select pg_temp.expect_error(format($q$select public.transition_sowing_stage('%s','planted','2026-11-01')$q$,current_setting('test.stage2')),'Cierre las etapas anteriores','impide dos etapas sembradas simultáneas');
select pg_temp.expect_error(format($q$update public.sowing_stages set status='closed',end_date=null where id='%s'$q$,current_setting('test.stage1')),'check constraint','API directa no cierra etapa sin fecha final');
select pg_temp.expect_error(format($q$select public.close_sowing_project('%s')$q$,current_setting('test.project_a')),'Cierre las etapas','proyecto no cierra con etapas pendientes');
select pg_temp.expect_error(format($q$update public.project_lots set area_ha=12 where id='%s'$q$,current_setting('test.lot')),'histórica','lote con siembra conserva superficie histórica');
select pg_temp.expect_error(format($q$select public.save_sowing_stage('{"subdivision_id":"%s","crop_id":"40000000-0000-4000-8000-000000000001","variety_id":"50000000-0000-4000-8000-000000000002","area_ha":1,"planned_sowing_date":"2026-12-01"}')$q$,current_setting('test.subdivision')),'relacionados','variedad debe pertenecer al cultivo');
select pg_temp.expect_error(format($q$select public.save_sowing_stage('{"subdivision_id":"%s","crop_id":"40000000-0000-4000-8000-000000000001","variety_id":"50000000-0000-4000-8000-000000000001","area_ha":11,"planned_sowing_date":"2026-12-01"}')$q$,current_setting('test.subdivision')),'excede','superficie de siembra no excede subdivisión');

select public.transition_sowing_stage(current_setting('test.stage1')::uuid,'closed','2026-10-30');
update public.crops set name='Cultivo renombrado' where id='40000000-0000-4000-8000-000000000001';
update public.fields set name='Campo renombrado' where id='30000000-0000-4000-8000-000000000001';
update public.infrastructure_types set name='Infraestructura renombrada' where id='60000000-0000-4000-8000-000000000001';
select pg_temp.assert_true((select crop_name='Pepino ficticio' from public.sowing_stages where id=current_setting('test.stage1')::uuid),'renombrar cultivo no altera siembra histórica');
select pg_temp.assert_true((select field_name='Campo A ficticio' and infrastructure_type_name='Campo abierto ficticio' from public.project_lots where id=current_setting('test.lot')::uuid),'renombrar catálogos no altera lote histórico');
select pg_temp.expect_error(format($q$update public.sowing_stages set observations='Cambio' where id='%s'$q$,current_setting('test.stage1')),'historial','siembra cerrada no se reescribe');
select pg_temp.expect_error(format($q$select public.transition_sowing_stage('%s','planted','2026-10-01')$q$,current_setting('test.stage2')),'preceder','siembra posterior no precede cierre previo');
select public.discard_planned_stage(current_setting('test.stage2')::uuid);
select public.close_sowing_project(current_setting('test.project_a')::uuid);
select set_config('test.copy',public.copy_sowing_project(current_setting('test.project_a')::uuid,'{"name":"Proyecto A siguiente","season":"2027","start_date":"2027-01-01"}')::text,true);
select pg_temp.assert_true((select count(*)=1 from public.project_lots where project_id=current_setting('test.copy')::uuid),'copiar temporada crea distribución independiente');
select pg_temp.assert_true((select count(*)=0 from public.sowing_stages s join public.lot_subdivisions d on d.id=s.subdivision_id join public.project_lots l on l.id=d.lot_id where l.project_id=current_setting('test.copy')::uuid),'copiar temporada no arrastra etapas');
select pg_temp.expect_error(format($q$update public.sowing_projects set name='Cambio' where id='%s'$q$,current_setting('test.project_a')),'historial','proyecto cerrado no se reescribe');

select pg_temp.expect_error($q$select public.save_product('{"code":"PX","name":"Producto inválido","unit":"g","default_dose":1}','[{"active_ingredient_id":"70000000-0000-4000-8000-000000000001"},{"active_ingredient_id":"70000000-0000-4000-8000-000000000001"}]')$q$,'unique constraint','composición duplicada revierte guardado');
select pg_temp.assert_true((select count(*)=0 from public.products where code='PX'),'fallo de composición no deja producto parcial');
select set_config('test.product',public.save_product('{"code":"P1","name":"Producto ficticio","unit":"ml","default_dose":1}','[{"active_ingredient_id":"70000000-0000-4000-8000-000000000001","concentration":"10 g/L"}]')::text,true);
select pg_temp.assert_true((select concentration='10 g/L' from public.product_ingredients where product_id=current_setting('test.product')::uuid),'concentración conserva valor y unidad del producto');
select pg_temp.expect_error($q$select public.set_user_access('10000000-0000-4000-8000-000000000001','viewer',true,'{}')$q$,'administrador activo','se conserva al menos un administrador activo');

set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000002';
select pg_temp.assert_true((select count(*)=2 from public.sowing_projects),'lector asignado ve temporadas propias e historial');
select pg_temp.assert_true((select count(*)=0 from public.sowing_projects where agricultural_unit_id='20000000-0000-4000-8000-000000000002'),'lector no ve otra agrícola ni por filtro directo');
select pg_temp.assert_true((select count(*)=2 from public.project_lots),'lector recibe solo lotes de sus proyectos');
select pg_temp.assert_true((select count(*)=1 from public.user_agricultural_units),'lector no ve asignaciones ajenas');
set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000003';
select pg_temp.assert_true((select count(*)=0 from public.sowing_projects),'lector sin asignaciones no ve proyectos');
select pg_temp.assert_true((select count(*)=0 from public.agricultural_units),'lector sin asignaciones no ve nombres de agrícolas');
reset role;
update public.profiles set active=false where id='10000000-0000-4000-8000-000000000002';
set local role authenticated;
set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000002';
select pg_temp.assert_true((select count(*)=0 from public.products),'desactivar perfil corta acceso con JWT previo');
select pg_temp.assert_true((select count(*)=0 from public.sowing_projects),'perfil inactivo no conserva acceso a sus agrícolas');
reset role;
rollback;
