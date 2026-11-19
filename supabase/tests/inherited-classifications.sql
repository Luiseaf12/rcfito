-- Runner prepends isolated app fixtures and rolls this transaction back.
insert into public.ingredient_classifications(id,code,name) values
 ('c1000000-0000-4000-8000-000000000001','INH1','Insecticida heredada'),
 ('c1000000-0000-4000-8000-000000000002','INH2','Acaricida heredada');
update public.active_ingredients set classification_ids=array['c1000000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000002']::uuid[],classification_id='c1000000-0000-4000-8000-000000000001' where code='I';
select pg_temp.assert_true((select not exists(select 1 from pg_attribute where attrelid='public.products'::regclass and attname in('classification_id','classification_ids') and not attisdropped)),'herencia: campos propios eliminados');
select pg_temp.assert_true(jsonb_array_length(public.catalog_product_classifications()->'72000000-0000-4000-8000-000000000001'->'classifications')=2,'herencia: producto recibe unión de ingredientes');
select pg_temp.assert_true((public.catalog_product_classifications()->'72000000-0000-4000-8000-000000000002'->>'complete')::boolean=false,'herencia: producto sin ingredientes se marca incompleto');
select pg_temp.expect_error($q$select public.save_product('{"code":"NO","name":"No válido","unit":"g","classification_ids":[]}', '[]')$q$,'heredan','herencia: cliente anterior no guarda selecciones propias');
select public.create_application_order(pg_temp.order_data(),pg_temp.stages(),pg_temp.mixture());
select pg_temp.assert_true((select bool_and(classification_snapshot->>'origin'='recorded') from public.application_order_products),'herencia: indicación nueva marcada como registrada');
select pg_temp.assert_true((select jsonb_array_length(classification_snapshot->'classifications')=2 from public.application_order_products where product_id='72000000-0000-4000-8000-000000000001'),'herencia: indicación conserva dos clases');
select pg_temp.assert_true((public.application_query('{"operation":"uso_producto","status":"indicated","product_id":"72000000-0000-4000-8000-000000000001","classification_id":"c1000000-0000-4000-8000-000000000001"}')->'summary'->>'liquid_ml')::numeric=0,'herencia: filtro no convierte sólidos en líquidos');
select pg_temp.assert_true((public.application_query('{"operation":"uso_producto","status":"indicated","classification_id":"c1000000-0000-4000-8000-000000000001"}')->'summary'->>'solid_g')::numeric=(public.application_query('{"operation":"uso_producto","status":"indicated","classification_id":"c1000000-0000-4000-8000-000000000002"}')->'summary'->>'solid_g')::numeric,'herencia: dos clases no duplican cantidades');
update public.active_ingredients set classification_ids=array['c1000000-0000-4000-8000-000000000001']::uuid[] where code='I';
update public.ingredient_classifications set name='Etiqueta actual cambiada' where code='INH2';
select pg_temp.assert_true((select classification_snapshot->'classifications' @> '[{"id":"c1000000-0000-4000-8000-000000000002","name":"Acaricida heredada"}]'::jsonb from public.application_order_products where product_id='72000000-0000-4000-8000-000000000001'),'herencia: catálogo editado no cambia indicación histórica');
select public.perform_application_targets('90000000-0000-4000-8000-000000000001',pg_temp.target_ids('90000000-0000-4000-8000-000000000001'),'{"changed":false,"actual_date":"2026-01-06"}');
select pg_temp.assert_true((select bool_and(jsonb_array_length(classification_snapshot->'classifications')=1) from public.application_actual_products where product_id='72000000-0000-4000-8000-000000000001'),'herencia: realización captura catálogo vigente de ese momento');
select pg_temp.assert_true(jsonb_array_length(public.application_query('{"operation":"uso_producto","classification_id":"c1000000-0000-4000-8000-000000000002"}')->'rows')=0,'herencia: filtro usa mezcla realizada');
update public.active_ingredients set classification_id=null,classification_ids='{}' where code='I';
select public.correct_application_target(jsonb_build_object('id','c2000000-0000-4000-8000-000000000001','target_id',(pg_temp.target_ids('90000000-0000-4000-8000-000000000001'))[1],'expected_version',0,'actual_date','2026-01-06','water_l_ha',110,'equipment','Equipo','applicator','Persona ficticia','observations','Cambio','reason','Corrección de prueba'),'[{"product_id":"72000000-0000-4000-8000-000000000001","dose":13}]');
select pg_temp.assert_true((select jsonb_array_length(classification_snapshot->'classifications')=1 from public.application_change_products where change_id='c2000000-0000-4000-8000-000000000001' and phase='before' and product_id='72000000-0000-4000-8000-000000000001'),'herencia: corrección conserva clasificación anterior');
select pg_temp.assert_true((select jsonb_array_length(classification_snapshot->'classifications')=0 and classification_snapshot->>'complete'='false' from public.application_change_products where change_id='c2000000-0000-4000-8000-000000000001' and phase='after' and product_id='72000000-0000-4000-8000-000000000001'),'herencia: corrección guarda nueva clasificación incompleta');
select pg_temp.assert_true(public.application_query('{"operation":"cambios","order_id":"90000000-0000-4000-8000-000000000001"}')->'rows'->0->'difference'->'before'->'products'->0 ? 'classification_snapshot','herencia: consultas de cambios incluyen clasificación histórica');
select pg_temp.expect_error($q$update public.application_order_products set classification_snapshot='{}'$q$,'permission denied|histórica|RPC','herencia: cliente no altera copia histórica');
select pg_temp.expect_error($q$select rcfito_private.capture_product_classifications('72000000-0000-4000-8000-000000000001')$q$,'permission denied','herencia: captura interna no es API pública');
set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000002';
select pg_temp.assert_true(jsonb_array_length(public.application_query('{"operation":"historial"}')->'rows')>0,'herencia: lector asignado consulta clasificaciones guardadas');
reset role;
update public.profiles set menu_permissions=array['summary'] where id='10000000-0000-4000-8000-000000000002';
set local role authenticated;
set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000002';
select pg_temp.assert_true(public.catalog_product_classifications()='{}'::jsonb,'herencia: menú oculto no abre catálogo de productos');
set local role anon;
select pg_temp.expect_error('select public.catalog_product_classifications()','permission denied','herencia: anónimo no consulta herencia');
reset role;
rollback;
