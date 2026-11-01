-- Solo fixtures aislados añadidos después del setup de applications.sql.
do $$ begin if current_database()<>'rcfito_test' then raise exception 'Pruebas limitadas a rcfito_test'; end if; end $$;
select pg_temp.assert_true((select not prosecdef and provolatile='s' from pg_proc where oid='public.application_query_resolve(jsonb,uuid)'::regprocedure),'resolver invoker STABLE conserva RLS y corte consistente');
update public.agricultural_units set name='Ensenada ficticia' where id='20000000-0000-4000-8000-000000000001';
-- Historia previa de la misma agrícola; nunca debe elegirse por "última fecha".
select public.create_application_order(pg_temp.order_data('90000000-0000-4000-8000-000000000080'),array['80000000-0000-4000-8000-000000000001']::uuid[],'[{"product_id":"72000000-0000-4000-8000-000000000001","dose":1000}]');
select public.perform_application_targets('90000000-0000-4000-8000-000000000080',pg_temp.target_ids('90000000-0000-4000-8000-000000000080'),'{"changed":false,"actual_date":"2026-01-04"}');
select public.transition_sowing_stage(id,'closed','2026-01-10') from public.sowing_stages where id=any(array['80000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000002','80000000-0000-4000-8000-000000000003']::uuid[]);
select public.close_sowing_project(current_setting('test.project')::uuid);
select set_config('test.previous_project',current_setting('test.project'),true);
select set_config('test.project',public.create_sowing_project('{"agricultural_unit_id":"20000000-0000-4000-8000-000000000001","name":"Temporada A","season":"2026-2027"}')::text,true);
update public.sowing_projects set status='active' where id=current_setting('test.project')::uuid;
insert into public.fields(id,agricultural_unit_id,code,name) values
 ('30000000-0000-4000-8000-000000000005','20000000-0000-4000-8000-000000000001','M5','Malla 5'),
 ('30000000-0000-4000-8000-000000000015','20000000-0000-4000-8000-000000000001','M15','Malla 15');
select set_config('test.malla5_lot',public.create_project_lot(jsonb_build_object('project_id',current_setting('test.project'),'field_id','30000000-0000-4000-8000-000000000005','code','LU5','name','Lote único M5','area_ha',4,'infrastructure_type_id','60000000-0000-4000-8000-000000000001'))::text,true);
select set_config('test.malla15_lot',public.create_project_lot(jsonb_build_object('project_id',current_setting('test.project'),'field_id','30000000-0000-4000-8000-000000000015','code','LU15','name','Lote único M15','area_ha',4,'infrastructure_type_id','60000000-0000-4000-8000-000000000001'))::text,true);
select public.save_sowing_stage(jsonb_build_object('id','80000000-0000-4000-8000-000000000005','subdivision_id',(select id from public.lot_subdivisions where lot_id=current_setting('test.malla5_lot')::uuid),'crop_id','40000000-0000-4000-8000-000000000001','variety_id','50000000-0000-4000-8000-000000000001','area_ha',4,'planned_sowing_date','2026-01-01'));
select public.save_sowing_stage(jsonb_build_object('id','80000000-0000-4000-8000-000000000015','subdivision_id',(select id from public.lot_subdivisions where lot_id=current_setting('test.malla15_lot')::uuid),'crop_id','40000000-0000-4000-8000-000000000001','variety_id','50000000-0000-4000-8000-000000000001','area_ha',4,'planned_sowing_date','2026-01-01'));
select public.transition_sowing_stage(id,'planted','2026-01-02') from public.sowing_stages where id=any(array['80000000-0000-4000-8000-000000000005','80000000-0000-4000-8000-000000000015']::uuid[]);
create function pg_temp.context_order(p_id text) returns jsonb language sql as $$ select pg_temp.order_data(p_id)||'{"field_id":"30000000-0000-4000-8000-000000000005"}'::jsonb $$;
select public.create_application_order(pg_temp.context_order('90000000-0000-4000-8000-000000000081'),array['80000000-0000-4000-8000-000000000005']::uuid[],pg_temp.mixture());
select public.perform_application_targets('90000000-0000-4000-8000-000000000081',pg_temp.target_ids('90000000-0000-4000-8000-000000000081'),'{"changed":false,"actual_date":"2026-01-04"}');
select public.correct_application_target(jsonb_build_object('id','b0000000-0000-4000-8000-000000000081','target_id',(select id from public.application_targets where order_id='90000000-0000-4000-8000-000000000081'),'expected_version',0,'actual_date','2026-01-05','water_l_ha',150,'equipment','Equipo corregido de M5','applicator','Aplicador ficticio','observations','Mezcla real vigente','reason','QA contexto corregido'),
 '[{"product_id":"72000000-0000-4000-8000-000000000001","dose":20},{"product_id":"72000000-0000-4000-8000-000000000003","dose":5}]');
select public.create_application_order(pg_temp.context_order('90000000-0000-4000-8000-000000000082'),array['80000000-0000-4000-8000-000000000005']::uuid[],'[{"product_id":"72000000-0000-4000-8000-000000000001","dose":999}]');
select public.create_application_order(pg_temp.context_order('90000000-0000-4000-8000-000000000083'),array['80000000-0000-4000-8000-000000000005']::uuid[],'[{"product_id":"72000000-0000-4000-8000-000000000001","dose":888}]');
select public.cancel_application_targets('90000000-0000-4000-8000-000000000083',pg_temp.target_ids('90000000-0000-4000-8000-000000000083'),'Cancelación ficticia de M5');
select public.create_application_order(pg_temp.order_data('90000000-0000-4000-8000-000000000084')||'{"field_id":"30000000-0000-4000-8000-000000000015"}',array['80000000-0000-4000-8000-000000000015']::uuid[],'[{"product_id":"72000000-0000-4000-8000-000000000001","dose":50}]');
select public.perform_application_targets('90000000-0000-4000-8000-000000000084',pg_temp.target_ids('90000000-0000-4000-8000-000000000084'),'{"changed":false,"actual_date":"2026-01-04"}');

select set_config('test.resolved_malla5',public.application_query_resolve('{"operation":"uso_producto","lot":"malla 5"}','20000000-0000-4000-8000-000000000001')::text,true);
select pg_temp.assert_true(not current_setting('test.resolved_malla5')::jsonb ? 'clarification','pregunta sin contexto usa última agrícola autorizada y resuelve malla 5');
select pg_temp.assert_true(current_setting('test.resolved_malla5')::jsonb#>>'{query,agricultural_unit_id}'='20000000-0000-4000-8000-000000000001','última agrícola Ensenada se conserva sin hardcode de nombre');
select pg_temp.assert_true(current_setting('test.resolved_malla5')::jsonb#>>'{query,project_id}'=current_setting('test.project'),'temporada activa prevalece sobre anterior cerrada');
select pg_temp.assert_true(current_setting('test.resolved_malla5')::jsonb#>>'{query,lot_id}'=current_setting('test.malla5_lot'),'campo Malla 5 se convierte únicamente en su lote inequívoco');
select pg_temp.assert_true(current_setting('test.resolved_malla5')::jsonb#>>'{query,status}'='performed','se ha aplicado consulta realizadas por defecto');
select pg_temp.assert_true(current_setting('test.resolved_malla5')::jsonb->>'revision'=public.application_query_stamp()->>'revision','resolver devuelve sello del mismo corte');
select pg_temp.assert_true(not exists(select 1 from jsonb_object_keys(current_setting('test.resolved_malla5')::jsonb->'query') k where k not in ('operation','agricultural_unit_id','project_id','field_id','lot_id','status')),'query resuelta solo tiene claves ejecutables estándar');
select pg_temp.assert_true(not current_setting('test.resolved_malla5')::jsonb->'query' ? 'lot','nombre de malla se retira al fijar ID');
select pg_temp.assert_true(exists(select 1 from jsonb_array_elements(current_setting('test.resolved_malla5')::jsonb->'filters') f where f->>'key'='agricultural_unit_id' and f->>'value'='Ensenada ficticia' and f->>'source'='last_used'),'filtro legible explica última agrícola');
select pg_temp.assert_true(exists(select 1 from jsonb_array_elements(current_setting('test.resolved_malla5')::jsonb->'filters') f where f->>'key'='project_id' and f->>'value'='Temporada A · 2026-2027' and f->>'source'='active_season'),'filtro legible incluye nombre y temporada activa');
select pg_temp.assert_true(exists(select 1 from jsonb_array_elements(current_setting('test.resolved_malla5')::jsonb->'filters') f where f->>'key'='field_id' and f->>'value'='Malla 5') and exists(select 1 from jsonb_array_elements(current_setting('test.resolved_malla5')::jsonb->'filters') f where f->>'key'='lot_id' and f->>'value'='Lote único M5'),'campo y lote resueltos quedan visibles');
select set_config('test.resolved_usage',public.application_query(current_setting('test.resolved_malla5')::jsonb->'query')::text,true);
select pg_temp.assert_true((current_setting('test.resolved_usage')::jsonb#>>'{summary,solid_g}')::numeric=80 and (current_setting('test.resolved_usage')::jsonb#>>'{summary,liquid_ml}')::numeric=20,'pipeline resolución y consulta devuelve mezcla real corregida por producto');
select pg_temp.assert_true(current_setting('test.resolved_usage')::jsonb#>>'{summary,destination_count}'='1' and current_setting('test.resolved_usage')::jsonb#>>'{summary,order_count}'='1','pipeline excluye indicadas, canceladas, Malla 15 y temporada cerrada');
select pg_temp.assert_true(jsonb_array_length(current_setting('test.resolved_usage')::jsonb->'rows')=2,'pipeline ofrece cada producto real y unidad separada');
select pg_temp.assert_true(public.application_query_resolve('{"operation":"uso_producto"}') ? 'clarification','administrador con dos agrícolas activas debe escoger cuando no hay último uso');
select pg_temp.assert_true(public.application_query_resolve('{"operation":"uso_producto","agricultural_unit":"Ensenada ficticia"}','20000000-0000-4000-8000-000000000002')#>>'{query,agricultural_unit_id}'='20000000-0000-4000-8000-000000000001','agrícola explícita prevalece sobre última usada');
select pg_temp.assert_true(public.application_query_resolve(jsonb_build_object('operation','uso_producto','project_id',current_setting('test.previous_project')),'20000000-0000-4000-8000-000000000002')#>>'{query,project_id}'=current_setting('test.previous_project'),'proyecto explícito cerrado se conserva incluso con última agrícola distinta');
select pg_temp.assert_true((public.application_query(public.application_query_resolve(jsonb_build_object('operation','uso_producto','project_id',current_setting('test.previous_project')))->'query')#>>'{summary,solid_g}')::numeric=5000,'proyecto cerrado explícito conserva su historial real');
select pg_temp.assert_true(not public.application_query_resolve(jsonb_build_object('operation','uso_producto','project_id',current_setting('test.previous_project'),'project','Temporada A')) ? 'clarification','ID explícito desambigua nombre homónimo de temporada');
select pg_temp.assert_true(not public.application_query_resolve(jsonb_build_object('operation','uso_producto','project_id',current_setting('test.previous_project'),'project','Temporada A'))->'query' ? 'project','nombre homónimo desaparece al fijar ID de temporada');
select pg_temp.assert_true(public.application_query_resolve('{"operation":"uso_producto","project":"Temporada A","agricultural_unit":"Ensenada ficticia"}') ? 'clarification','nombre homónimo sin ID exige elección de temporada');
select pg_temp.assert_true(public.application_query_resolve('{"operation":"uso_producto","lot":"malla 15"}','20000000-0000-4000-8000-000000000001')#>>'{query,lot_id}'=current_setting('test.malla15_lot'),'Malla 15 conserva identidad distinta de Malla 5');
select pg_temp.assert_true(public.application_query_resolve('{"operation":"uso_producto","lot":"malla 1"}','20000000-0000-4000-8000-000000000001') ? 'clarification','Malla 1 no hace substring contra Malla 15');
select pg_temp.assert_true(public.application_query_resolve('{"operation":"uso_producto","lot":"malla 5","from":"2026-01-01","to":"2026-01-06","stage_number":1,"product":"Producto original"}','20000000-0000-4000-8000-000000000001')#>>'{query,from}'='2026-01-01','resolver conserva fechas explícitas');
select pg_temp.assert_true(public.application_query_resolve('{"operation":"uso_producto","lot":"malla 5","from":"2026-01-01","to":"2026-01-06","stage_number":1,"product":"Producto original"}','20000000-0000-4000-8000-000000000001')#>>'{query,product_id}'='72000000-0000-4000-8000-000000000001','producto exacto y número de etapa se conservan resueltos');
select pg_temp.assert_true(public.application_query_resolve('{"operation":"uso_producto","lot":"malla 5","status":"all"}','20000000-0000-4000-8000-000000000001')#>>'{query,status}'='all','estado explícito todas se respeta');

savepoint context_lot_exact;
select set_config('test.exact_lot',public.create_project_lot(jsonb_build_object('project_id',current_setting('test.project'),'field_id','30000000-0000-4000-8000-000000000001','code','EX5','name','Malla 5','area_ha',2,'infrastructure_type_id','60000000-0000-4000-8000-000000000001'))::text,true);
select pg_temp.assert_true(public.application_query_resolve('{"operation":"uso_producto","lot":"malla 5"}','20000000-0000-4000-8000-000000000001')#>>'{query,lot_id}'=current_setting('test.exact_lot'),'lote de nombre exacto tiene prioridad sobre campo homónimo');
rollback to context_lot_exact;release savepoint context_lot_exact;

savepoint context_retired_lot;
select set_config('test.retired_lot',public.create_project_lot(jsonb_build_object('project_id',current_setting('test.project'),'field_id','30000000-0000-4000-8000-000000000005','code','RET5','name','Lote retirado M5','area_ha',2,'infrastructure_type_id','60000000-0000-4000-8000-000000000001'))::text,true);
update public.project_lots set active=false where id=current_setting('test.retired_lot')::uuid;
select pg_temp.assert_true(jsonb_array_length(public.application_query_resolve('{"operation":"uso_producto","lot":"malla 5"}','20000000-0000-4000-8000-000000000001')->'choices')=2,'dos lotes de campo exigen aclaración incluyendo el retirado');
select pg_temp.assert_true(public.application_query_resolve('{"operation":"uso_producto","lot":"malla 5"}','20000000-0000-4000-8000-000000000001') ? 'clarification','no se elige automáticamente el único lote vigente');
rollback to context_retired_lot;release savepoint context_retired_lot;

savepoint context_two_fields;
insert into public.fields(id,agricultural_unit_id,code,name) values('30000000-0000-4000-8000-000000000025','20000000-0000-4000-8000-000000000001','MX5','Malla 5');
select pg_temp.assert_true(jsonb_array_length(public.application_query_resolve('{"operation":"uso_producto","lot":"malla 5"}','20000000-0000-4000-8000-000000000001')->'choices')=2,'campos exactos homónimos exigen aclaración aunque uno aún no tenga lotes');
rollback to context_two_fields;release savepoint context_two_fields;

savepoint context_numeric;
select set_config('test.numeric7',public.create_project_lot(jsonb_build_object('project_id',current_setting('test.project'),'field_id','30000000-0000-4000-8000-000000000001','code','7','name','Lote numérico siete','area_ha',2,'infrastructure_type_id','60000000-0000-4000-8000-000000000001'))::text,true);
select public.create_project_lot(jsonb_build_object('project_id',current_setting('test.project'),'field_id','30000000-0000-4000-8000-000000000001','code','17','name','Lote numérico diecisiete','area_ha',2,'infrastructure_type_id','60000000-0000-4000-8000-000000000001'));
select pg_temp.assert_true(public.application_query_resolve('{"operation":"uso_producto","lot":"malla 7"}','20000000-0000-4000-8000-000000000001')#>>'{query,lot_id}'=current_setting('test.numeric7'),'referencia Malla 7 admite código numérico completo único sin incluir 17');
select public.create_project_lot(jsonb_build_object('project_id',current_setting('test.project'),'field_id','30000000-0000-4000-8000-000000000015','code','7','name','Otro lote siete','area_ha',2,'infrastructure_type_id','60000000-0000-4000-8000-000000000001'));
select pg_temp.assert_true(jsonb_array_length(public.application_query_resolve('{"operation":"uso_producto","lot":"malla 7"}','20000000-0000-4000-8000-000000000001')->'choices')=2,'dos códigos numéricos iguales en campos diferentes no se adivinan');
rollback to context_numeric;release savepoint context_numeric;

savepoint context_one_active_unit;
select public.transition_sowing_stage('80000000-0000-4000-8000-000000000004','closed','2026-01-10');
select public.close_sowing_project(current_setting('test.project_b')::uuid);
select pg_temp.assert_true(public.application_query_resolve('{"operation":"uso_producto"}')#>>'{query,agricultural_unit_id}'='20000000-0000-4000-8000-000000000001','única agrícola con temporada activa puede completar contexto entre varias autorizadas');
rollback to context_one_active_unit;release savepoint context_one_active_unit;

savepoint context_no_active_season;
select public.cancel_application_targets('90000000-0000-4000-8000-000000000082',pg_temp.target_ids('90000000-0000-4000-8000-000000000082'),'Cierre ficticio de temporada');
select public.transition_sowing_stage(id,'closed','2026-01-10') from public.sowing_stages where id=any(array['80000000-0000-4000-8000-000000000005','80000000-0000-4000-8000-000000000015']::uuid[]);
select public.close_sowing_project(current_setting('test.project')::uuid);
select pg_temp.assert_true(public.application_query_resolve('{"operation":"uso_producto"}','20000000-0000-4000-8000-000000000001') ? 'clarification','sin temporada activa se aclara en vez de elegir última cerrada');
select pg_temp.assert_true(not public.application_query_resolve('{"operation":"uso_producto"}','20000000-0000-4000-8000-000000000001')->'query' ? 'project_id','ausencia de activa no inventa proyecto');
rollback to context_no_active_season;release savepoint context_no_active_season;

select pg_temp.expect_error($q$select public.application_query_resolve('{"operation":"uso_producto","sql":"select *"}')$q$,'no permitido','resolver rechaza SQL arbitrario');
select pg_temp.expect_error($q$select public.application_query_resolve('{"operation":"uso_producto","project_id":"x"}')$q$,'UUID','resolver valida UUID');
select pg_temp.expect_error($q$select public.application_query_resolve('{"operation":"uso_producto","from":"2026-02-30"}')$q$,'Fecha','resolver valida fechas civiles');
select pg_temp.expect_error($q$select public.application_query_resolve('{"operation":"uso_producto","limit":31}')$q$,'rango','resolver conserva límite de páginas');
set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000002';
select pg_temp.assert_true(public.application_query_resolve('{"operation":"uso_producto","lot":"malla 5"}')#>>'{query,agricultural_unit_id}'='20000000-0000-4000-8000-000000000001','lector con una agrícola autorizada completa contexto sin último uso');
select pg_temp.assert_true(jsonb_array_length(public.application_query_resolve('{"operation":"uso_producto"}','20000000-0000-4000-8000-000000000002')->'choices')=1,'última agrícola ajena solo ofrece opciones autorizadas');
select pg_temp.assert_true(not exists(select 1 from jsonb_array_elements(public.application_query_resolve('{"operation":"uso_producto"}','20000000-0000-4000-8000-000000000002')->'choices') c where c->>'id'='20000000-0000-4000-8000-000000000002'),'última agrícola no autorizada no revela su identidad en opciones');
select pg_temp.assert_true(public.application_query_resolve(jsonb_build_object('operation','uso_producto','project_id',current_setting('test.project_b'))) ? 'clarification','ID de proyecto ajeno no resuelve contexto mediante RLS');
select pg_temp.assert_true(not public.application_query_resolve(jsonb_build_object('operation','uso_producto','project_id',current_setting('test.project_b')))->'query' ? 'project_id','ID ajeno no aparece como filtro resuelto');
set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000001';
select public.set_user_access('10000000-0000-4000-8000-000000000002','viewer',true,'{}');
set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000002';
select pg_temp.assert_true(public.application_query_resolve('{"operation":"uso_producto"}','20000000-0000-4000-8000-000000000001') ? 'clarification','revocar última agrícola exige nuevo contexto con el mismo JWT');
select pg_temp.assert_true(jsonb_array_length(public.application_query_resolve('{"operation":"uso_producto"}','20000000-0000-4000-8000-000000000001')->'choices')=0,'revocación no conserva opciones ni nombres anteriores');
set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000001';
select public.set_user_access('10000000-0000-4000-8000-000000000002','viewer',false,'{}');
set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000002';
select pg_temp.expect_error($q$select public.application_query_resolve('{"operation":"uso_producto"}')$q$,'cuenta activa','perfil desactivado no resuelve contexto con JWT previo');
set local role anon;
select pg_temp.expect_error($q$select public.application_query_resolve('{"operation":"uso_producto"}')$q$,'permission denied','anónimo no ejecuta resolver');
reset role;
rollback;
