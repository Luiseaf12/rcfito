-- El runner añade fixtures de applications.sql en rcfito_test y revierte todo.
do $$ begin if current_database()<>'rcfito_test' then raise exception 'Pruebas limitadas a rcfito_test'; end if; end $$;
select pg_temp.assert_true((select not prosecdef and provolatile='s' from pg_proc where oid='public.application_query(jsonb)'::regprocedure),'consulta invoker estable conserva RLS y un mismo snapshot');
select pg_temp.assert_true((select not prosecdef and provolatile='s' from pg_proc where oid='public.application_query_stamp()'::regprocedure),'sello invoker estable');
select set_config('test.query_revision',public.application_query_stamp()->>'revision',true);
select public.create_application_order(pg_temp.order_data(),pg_temp.stages(),pg_temp.mixture());
select pg_temp.assert_true(public.application_query_stamp()->>'revision'<>current_setting('test.query_revision'),'crear indicación invalida sello durable');
select pg_temp.assert_true(public.application_query('{"operation":"historial"}')->>'revision'=public.application_query_stamp()->>'revision','respuesta y sello tienen la misma revisión');
select pg_temp.assert_true(public.application_query('{"operation":"historial"}')#>>'{summary,destination_count}'='2','historial cuenta dos destinos');
select pg_temp.assert_true(public.application_query('{"operation":"historial"}')#>>'{summary,order_count}'='1','historial distingue una orden de dos destinos');
select pg_temp.assert_true(public.application_query('{"operation":"historial"}')#>>'{summary,solid_g}'='120.0000000000','cantidad indicada g por superficie histórica');
select pg_temp.assert_true((public.application_query('{"operation":"historial"}')#>>'{summary,liquid_ml}')::numeric=80,'cantidad ml separada de masa');
select pg_temp.assert_true(public.application_query('{"operation":"uso_producto"}')#>>'{summary,destination_count}'='0','usos consulta realizadas por defecto');
select pg_temp.assert_true(public.application_query('{"operation":"pendientes","from":"2026-01-06","to":"2026-01-06"}')#>>'{summary,destination_count}'='2','pendientes filtra fecha programada');
select pg_temp.assert_true(public.application_query('{"operation":"historial","from":"2026-01-06","to":"2026-01-06"}')#>>'{summary,destination_count}'='0','historial indicado usa fecha indicada');
select pg_temp.assert_true(public.application_query('{"operation":"historial","limit":1}')->>'truncated'='true','paginación declara filas omitidas');
select pg_temp.assert_true(public.application_query('{"operation":"historial","limit":1}')->>'sources_truncated'='true','paginación declara evidencia parcial de agregados');
select pg_temp.assert_true(jsonb_array_length(public.application_query('{"operation":"historial","limit":1,"offset":1}')->'rows')=1,'segunda página acotada');
select pg_temp.assert_true(public.application_query('{"operation":"detalle"}') ? 'clarification','detalle exige identidad de orden');
select pg_temp.assert_true(public.application_query(jsonb_build_object('operation','detalle','folio',(select folio from public.application_orders where id='90000000-0000-4000-8000-000000000001'))) #>>'{summary,destination_count}'='2','folio resuelve detalle exacto');
select pg_temp.assert_true(public.application_query('{"operation":"historial","agricultural_unit":"agricola a ficticia","lot":"lote 1"}')#>>'{summary,destination_count}'='1','nombres exactos normalizan acentos y conservan ámbito');
select pg_temp.assert_true(public.application_query('{"operation":"historial","lot":"lote"}') ? 'clarification','nombre parcial exige aclaración');
select pg_temp.assert_true(public.application_query('{"operation":"historial","lot":"Lote 1","lot_id":"ffffffff-ffff-4fff-8fff-ffffffffffff"}') ? 'clarification','nombre e ID incompatibles exigen aclaración');
select pg_temp.expect_error($q$select public.application_query('{"operation":"historial","sql":"select *"}')$q$,'no permitido','consulta rechaza SQL y campos arbitrarios');
select pg_temp.expect_error($q$select public.application_query('{"operation":"borrar"}')$q$,'operación','solo rutinas autorizadas');
select pg_temp.expect_error($q$select public.application_query('{"operation":"historial","project_id":"invalido"}')$q$,'UUID','UUID inválido rechazado');
select pg_temp.expect_error($q$select public.application_query('{"operation":"historial","limit":31}')$q$,'rango','límite máximo de 30');
select pg_temp.expect_error($q$select public.application_query('{"operation":"historial","offset":1001}')$q$,'rango','offset máximo acotado');
select pg_temp.expect_error($q$select public.application_query('{"operation":"historial","limit":1.5}')$q$,'rango','límite fraccionario rechazado');
select pg_temp.expect_error($q$select public.application_query('{"operation":"historial","from":"2026-02-30"}')$q$,'date|fecha','fecha civil inexistente rechazada');
select pg_temp.expect_error($q$select public.application_query('{"operation":"historial","from":"2026-02-01","to":"2026-01-01"}')$q$,'inicio','periodo invertido rechazado');
select pg_temp.expect_error($q$select public.application_query('{"operation":"pendientes","status":"performed"}')$q$,'Pendientes','estado no contradice rutina');

select public.perform_application_targets('90000000-0000-4000-8000-000000000001',array[(select id from public.application_targets where stage_id='80000000-0000-4000-8000-000000000001')],'{"changed":false,"actual_date":"2026-01-04","equipment":"Dron ficticio","applicator":"Aplicador ficticio"}');
select pg_temp.assert_true(public.application_query('{"operation":"uso_producto"}')#>>'{summary,destination_count}'='1','uso real excluye destino pendiente');
select pg_temp.assert_true(public.application_query('{"operation":"uso_producto","limit":1,"offset":1}')#>>'{sources,0,product_id}'=public.application_query('{"operation":"uso_producto","limit":1,"offset":1}')#>>'{rows,0,product_id}','evidencia de producto paginado pertenece al producto mostrado');
select pg_temp.assert_true(jsonb_array_length(public.application_query('{"operation":"uso_producto","limit":1,"offset":1}')->'sources')=1,'página de producto conserva evidencia aun sin segunda fila de destinos');
select pg_temp.assert_true((public.application_query('{"operation":"uso_producto"}')#>>'{summary,solid_g}')::numeric=60,'consumo real usa mezcla efectiva');
select pg_temp.assert_true(public.application_query('{"operation":"historial","from":"2026-01-04","to":"2026-01-04"}')#>>'{summary,destination_count}'='1','historial real usa fecha efectiva');
select set_config('test.query_revision',public.application_query_stamp()->>'revision',true);
select public.correct_application_target(jsonb_build_object('id','b0000000-0000-4000-8000-000000000070','target_id',(select id from public.application_targets where stage_id='80000000-0000-4000-8000-000000000001'),'expected_version',0,'actual_date','2026-01-05','water_l_ha',150,'equipment','Equipo corregido','applicator','Aplicador corregido','observations','Nota real vigente','reason','Corrección ficticia'),
  '[{"product_id":"72000000-0000-4000-8000-000000000001","dose":20},{"product_id":"72000000-0000-4000-8000-000000000003","dose":4}]');
select pg_temp.assert_true(public.application_query_stamp()->>'revision'<>current_setting('test.query_revision'),'corrección invalida caché');
select pg_temp.assert_true((public.application_query('{"operation":"uso_producto"}')#>>'{summary,solid_g}')::numeric=100,'consulta usa dosis corregida');
select pg_temp.assert_true((public.application_query('{"operation":"uso_producto"}')#>>'{summary,liquid_ml}')::numeric=20,'consulta usa producto corregido');
select pg_temp.assert_true(public.application_query('{"operation":"uso_producto","from":"2026-01-04","to":"2026-01-04"}')#>>'{summary,destination_count}'='0','fecha original corregida deja de contribuir');
select pg_temp.assert_true((public.application_query('{"operation":"uso_producto","product":"Producto original"}')#>>'{rows,0,average_dose}')::numeric=20,'dosis promedio ponderada calculada en servidor');
select pg_temp.assert_true(public.application_query('{"operation":"detalle","order_id":"90000000-0000-4000-8000-000000000001","status":"performed"}')#>>'{rows,0,equipment}'='Equipo corregido','detalle expone equipo efectivo vigente');
select pg_temp.assert_true(public.application_query('{"operation":"cambios","order_id":"90000000-0000-4000-8000-000000000001"}')#>>'{summary,event_count}'='1','historial incluye corrección auditada');
select pg_temp.assert_true(public.application_query('{"operation":"cambios","order_id":"90000000-0000-4000-8000-000000000001"}')#>>'{rows,0,reason}'='Corrección ficticia','cambio explica motivo real');

select public.revise_application_order(jsonb_build_object('id','a0000000-0000-4000-8000-000000000070','order_id','90000000-0000-4000-8000-000000000001','expected_revision',0,'target_ids',array[(select id from public.application_targets where stage_id='80000000-0000-4000-8000-000000000002')],
  'method_id','71000000-0000-4000-8000-000000000001','indicated_date','2026-01-04','scheduled_date','2026-01-07','water_l_ha',110,'observations','Nota revisada','reason','Revisión ficticia'),
  '[{"product_id":"72000000-0000-4000-8000-000000000001","dose":18},{"product_id":"72000000-0000-4000-8000-000000000003","dose":3}]');
select pg_temp.assert_true((public.application_query('{"operation":"pendientes"}')#>>'{summary,solid_g}')::numeric=90,'pendientes usan indicación revisada');
select pg_temp.assert_true(public.application_query('{"operation":"pendientes"}')#>>'{rows,0,scheduled_date}'='2026-01-07','fecha programada revisada');
select pg_temp.assert_true(not exists(select 1 from jsonb_array_elements(public.application_query('{"operation":"cambios","order_id":"90000000-0000-4000-8000-000000000001"}')->'sources') s where s ? 'target_id' and jsonb_typeof(s->'target_id')='null'),'evento de indicación omite target_id nulo en fuentes');
select pg_temp.assert_true(public.application_query('{"operation":"cambios","order_id":"90000000-0000-4000-8000-000000000001"}')#>>'{sources_truncated}'='false','eventos completos identifican trazabilidad completa');
select public.cancel_application_targets('90000000-0000-4000-8000-000000000001',array[(select id from public.application_targets where stage_id='80000000-0000-4000-8000-000000000002')],'Cancelación ficticia');
select pg_temp.assert_true(public.application_query('{"operation":"pendientes"}')#>>'{summary,destination_count}'='0','canceladas dejan de estar pendientes');
select pg_temp.assert_true((public.application_query('{"operation":"historial","status":"cancelled"}')#>>'{summary,solid_g}')::numeric=90,'canceladas retienen snapshot correspondiente');
select pg_temp.assert_true(public.application_query('{"operation":"detalle","order_id":"90000000-0000-4000-8000-000000000001","status":"cancelled"}')#>>'{rows,0,cancellation_reason}'='Cancelación ficticia','detalle cancelado conserva motivo registrado');
select pg_temp.assert_true((public.application_query('{"operation":"historial"}')#>>'{summary,solid_g}')::numeric=190,'todas combina cantidades identificadas por estado');

savepoint query_ambiguity;
select public.create_project_lot(jsonb_build_object('project_id',current_setting('test.project'),'field_id','30000000-0000-4000-8000-000000000001','code','LD','name','Lote 1','area_ha',5,'infrastructure_type_id','60000000-0000-4000-8000-000000000001'));
select pg_temp.assert_true(jsonb_array_length(public.application_query('{"operation":"historial","lot":"Lote 1"}')->'choices')=2,'nombres ambiguos devuelven todas las opciones acotadas');
select pg_temp.assert_true(jsonb_array_length(public.application_query('{"operation":"historial","lot":"Lote 1"}')->'rows')=0,'ambigüedad no ejecuta una consulta escogida arbitrariamente');
rollback to query_ambiguity;
release savepoint query_ambiguity;

savepoint query_weighted;
select set_config('test.weighted_lot',public.create_project_lot(jsonb_build_object('project_id',current_setting('test.project'),'field_id','30000000-0000-4000-8000-000000000001','code','LQ','name','Lote ponderado','area_ha',10,'infrastructure_type_id','60000000-0000-4000-8000-000000000001'))::text,true);
select public.save_sowing_stage(jsonb_build_object('id','80000000-0000-4000-8000-000000000070','subdivision_id',(select id from public.lot_subdivisions where lot_id=current_setting('test.weighted_lot')::uuid),'crop_id','40000000-0000-4000-8000-000000000001','variety_id','50000000-0000-4000-8000-000000000001','area_ha',10,'planned_sowing_date','2026-01-01'));
select public.transition_sowing_stage('80000000-0000-4000-8000-000000000070','planted','2026-01-02');
select public.create_application_order(pg_temp.order_data('90000000-0000-4000-8000-000000000072'),array['80000000-0000-4000-8000-000000000070']::uuid[],'[{"product_id":"72000000-0000-4000-8000-000000000001","dose":2}]');
select public.perform_application_targets('90000000-0000-4000-8000-000000000072',pg_temp.target_ids('90000000-0000-4000-8000-000000000072'),'{"changed":false,"actual_date":"2026-01-04"}');
select pg_temp.assert_true((public.application_query('{"operation":"uso_producto","product":"Producto original"}')#>>'{rows,0,average_dose}')::numeric=8,'promedio usa cantidad total sobre 15 ha acumuladas, no promedio simple de dosis');
select pg_temp.assert_true(public.application_query('{"operation":"uso_producto","product":"Producto original"}')#>>'{summary,order_count}'='2','uso distingue órdenes del producto en superficies diferentes');
rollback to query_weighted;
release savepoint query_weighted;

savepoint query_incomplete;
reset role;
select set_config('rcfito.application_write','correct',true);
insert into public.application_changes(id,order_id,target_id,kind,version,target_ids,reason,changed_by,changed_by_name,"before","after",request_signature)
  select 'b0000000-0000-4000-8000-000000000099',order_id,target_id,kind,2,target_ids,'Fixture incompleto','10000000-0000-4000-8000-000000000001','Actor ficticio',"after",'{"actual_date":"2026-02-30","products":{}}','{}'
  from public.application_changes where id='b0000000-0000-4000-8000-000000000070';
select set_config('rcfito.application_write','',true);
set local role authenticated;
select pg_temp.assert_true(public.application_query('{"operation":"uso_producto"}')->>'incomplete_count'='1','historia inconciliable se identifica como incompleta');
select pg_temp.assert_true(public.application_query('{"operation":"uso_producto"}')#>>'{summary,destination_count}'='0','dato incompleto no se sustituye por mezcla antigua');
rollback to query_incomplete;
release savepoint query_incomplete;

savepoint query_sources;
do $$ declare order_id uuid; begin
  for i in 1..31 loop
    order_id:=format('90000000-0000-4000-8000-%s',lpad((1000+i)::text,12,'0'))::uuid;
    perform public.create_application_order(pg_temp.order_data(order_id::text),array['80000000-0000-4000-8000-000000000001']::uuid[],'[{"product_id":"72000000-0000-4000-8000-000000000001","dose":1}]');
    perform public.perform_application_targets(order_id,pg_temp.target_ids(order_id),'{"changed":false,"actual_date":"2026-01-04"}');
  end loop;
end $$;
select pg_temp.assert_true(jsonb_array_length(public.application_query('{"operation":"uso_producto"}')->'sources')=30,'fuentes de uso quedan limitadas a 30');
select pg_temp.assert_true(public.application_query('{"operation":"uso_producto"}')->>'sources_truncated'='true','evidencia de uso declara truncamiento independiente de filas');
select pg_temp.assert_true(public.application_query('{"operation":"uso_producto"}')->>'source_count'='33','conteo de evidencia corresponde a pares producto y destino mostrados');
select pg_temp.assert_true(not exists(select 1 from jsonb_array_elements(public.application_query('{"operation":"uso_producto"}')->'rows') r where not exists(select 1 from jsonb_array_elements(public.application_query('{"operation":"uso_producto"}')->'sources') s where s->>'product_id'=r->>'product_id' and s->>'unit'=r->>'unit')),'cada producto mostrado tiene al menos una fuente incluso al truncar');
rollback to query_sources;
release savepoint query_sources;

select set_config('test.query_revision',public.application_query_stamp()->>'revision',true);
update public.products set name='Producto renombrado' where id='72000000-0000-4000-8000-000000000001';
select pg_temp.assert_true(public.application_query_stamp()->>'revision'<>current_setting('test.query_revision'),'cambio de catálogo invalida resolución y caché');
select pg_temp.assert_true(public.application_query('{"operation":"uso_producto","product_id":"72000000-0000-4000-8000-000000000001"}')#>>'{rows,0,product_name}'='Producto original','cálculos conservan nombre histórico tras renombrar catálogo');
select public.save_product('{"id":"72000000-0000-4000-8000-000000000003","code":"P3","name":"Producto nuevo","unit":"ml","default_dose":3,"active":true,"synonyms":["Alias ficticio"]}','[]');
select pg_temp.assert_true((public.application_query('{"operation":"uso_producto","product":"alias ficticio"}')#>>'{summary,liquid_ml}')::numeric=20,'consulta resuelve sinónimo exacto de producto');

-- Orden de otra agrícola para comprobar que filtros arbitrarios nunca elevan RLS.
select public.create_application_order(pg_temp.order_data('90000000-0000-4000-8000-000000000071')||jsonb_build_object('project_id',current_setting('test.project_b'),'field_id','30000000-0000-4000-8000-000000000003'),array['80000000-0000-4000-8000-000000000004']::uuid[],pg_temp.mixture());
select set_config('test.admin_revision',public.application_query_stamp()->>'revision',true);
set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000002';
select pg_temp.assert_true(public.application_query_stamp()->>'revision'<>current_setting('test.admin_revision'),'sello vinculado a identidad y permisos');
select pg_temp.assert_true(public.application_query('{"operation":"historial"}')#>>'{summary,destination_count}'='2','lector solo ve destinos de agrícola asignada');
select pg_temp.assert_true(public.application_query(jsonb_build_object('operation','historial','project_id',current_setting('test.project_b')))#>>'{summary,destination_count}'='0','UUID ajeno no evade RLS');
select pg_temp.assert_true(jsonb_array_length(public.application_query('{"operation":"historial","agricultural_unit":"Agrícola B ficticia"}')->'choices')=0,'resolver no revela agrícola ajena');
select pg_temp.assert_true(public.application_query('{"operation":"detalle","order_id":"90000000-0000-4000-8000-000000000071"}')#>>'{summary,destination_count}'='0','detalle ajeno no revela registros');
select pg_temp.expect_error('update rcfito_private.application_query_revision set revision=gen_random_uuid()','permission denied','lector no manipula revisión de caché');
select pg_temp.expect_error('select rcfito_private.bump_application_query_revision()','permission denied','lector no ejecuta trigger privilegiado');
select set_config('test.reader_revision',public.application_query_stamp()->>'revision',true);
set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000001';
select public.set_user_access('10000000-0000-4000-8000-000000000002','viewer',true,'{}');
set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000002';
select pg_temp.assert_true(public.application_query_stamp()->>'revision'<>current_setting('test.reader_revision'),'revocar asignaciones invalida sello anterior');
select pg_temp.assert_true(public.application_query('{"operation":"historial"}')#>>'{summary,destination_count}'='0','revocación efectiva con el mismo JWT');
set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000001';
select public.set_user_access('10000000-0000-4000-8000-000000000002','viewer',false,'{}');
set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000002';
select pg_temp.expect_error('select public.application_query_stamp()','cuenta activa','usuario desactivado no recupera caché con JWT emitido');
select pg_temp.expect_error($q$select public.application_query('{"operation":"historial"}')$q$,'cuenta activa','usuario desactivado no consulta');
set local role anon;
select pg_temp.expect_error('select public.application_query_stamp()','permission denied','anónimo no obtiene sello');
select pg_temp.expect_error($q$select public.application_query('{"operation":"historial"}')$q$,'permission denied','anónimo no consulta RPC');
reset role;
rollback;
