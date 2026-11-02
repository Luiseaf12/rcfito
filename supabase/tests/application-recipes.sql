-- Appended to the transactional, fictitious applications fixture by the test runner.
select public.save_sowing_group(pg_temp.group_data(),pg_temp.stages());
select public.create_application_order(pg_temp.order_data()||'{"source_group_id":"91000000-0000-4000-8000-000000000001"}',pg_temp.stages(),pg_temp.mixture());
create function pg_temp.recipe_data(p_id text default '90000000-0000-4000-8000-000000000002') returns jsonb language sql as $$
select pg_temp.order_data(p_id)||'{"source_group_id":"91000000-0000-4000-8000-000000000001","recipe_source":{"order_id":"90000000-0000-4000-8000-000000000001","revision":0}}'::jsonb $$;
select public.create_application_order(pg_temp.recipe_data(),pg_temp.stages(),pg_temp.mixture());
select pg_temp.assert_true((select recipe_source_order_id='90000000-0000-4000-8000-000000000001' and recipe_source_revision=0 and recipe_source_stage_id is null from public.application_orders where id='90000000-0000-4000-8000-000000000002'),'receta nueva conserva referencia grupal y versión');
select pg_temp.assert_true((select bool_and(application_number=2 and status='indicated') from public.application_targets where order_id='90000000-0000-4000-8000-000000000002'),'receta nueva asigna siguiente número por etapa e indicada');
select pg_temp.assert_true((select count(*)=0 from public.application_changes),'copiar no modifica ni inventa historial de la receta anterior');
select pg_temp.expect_error($q$select public.create_application_order(pg_temp.recipe_data('90000000-0000-4000-8000-000000000003')||'{"recipe_source":{"order_id":"90000000-0000-4000-8000-000000000001","revision":1}}',pg_temp.stages(),pg_temp.mixture())$q$,'base cambió','receta obsoleta bloqueada atómicamente');
select pg_temp.expect_error($q$select public.create_application_order(pg_temp.recipe_data('90000000-0000-4000-8000-000000000003')||'{"recipe_source":{"order_id":"90000000-0000-4000-8000-000000000001","revision":"0"}}',pg_temp.stages(),pg_temp.mixture())$q$,'versión válidas','versión textual rechazada');
select pg_temp.expect_error($q$select public.create_application_order(pg_temp.recipe_data('90000000-0000-4000-8000-000000000003')||'{"recipe_source":{"order_id":"90000000-0000-4000-8000-000000000001","revision":0.5}}',pg_temp.stages(),pg_temp.mixture())$q$,'versión.*válida','versión fraccionaria rechazada');
select pg_temp.expect_error($q$select public.create_application_order(pg_temp.recipe_data('90000000-0000-4000-8000-000000000003')-'source_group_id',pg_temp.stages(),pg_temp.mixture())$q$,'etapa del lote','copia individual exige etapa explícita');
select public.create_application_order(pg_temp.order_data('90000000-0000-4000-8000-000000000003')||'{"recipe_source":{"order_id":"90000000-0000-4000-8000-000000000001","revision":0,"stage_id":"80000000-0000-4000-8000-000000000001"}}',array['80000000-0000-4000-8000-000000000001']::uuid[],pg_temp.mixture());
select pg_temp.assert_true((select selection_origin='individual' and source_group_id is null and recipe_source_stage_id='80000000-0000-4000-8000-000000000001' from public.application_orders where id='90000000-0000-4000-8000-000000000003'),'lote en grupo conserva emisión individual y base grupal sin ampliar destinos');
select pg_temp.expect_error($q$select public.create_application_order(pg_temp.recipe_data('90000000-0000-4000-8000-000000000004')||'{"recipe_source":{"order_id":"90000000-0000-4000-8000-000000000003","revision":0}}',pg_temp.stages(),pg_temp.mixture())$q$,'grupo seleccionado','grupo no copia receta individual de un integrante');
select pg_temp.expect_error($q$select public.create_application_order(pg_temp.recipe_data()||'{"recipe_source":{"order_id":"90000000-0000-4000-8000-000000000001","revision":1}}',pg_temp.stages(),pg_temp.mixture())$q$,'UUID ya corresponde','reintento no cambia su base');
select public.cancel_application_targets('90000000-0000-4000-8000-000000000001',pg_temp.target_ids('90000000-0000-4000-8000-000000000001'),'Cancelación ficticia');
select pg_temp.expect_error($q$select public.create_application_order(pg_temp.recipe_data('90000000-0000-4000-8000-000000000004'),pg_temp.stages(),pg_temp.mixture())$q$,'ya no está activa','base cancelada no reutilizable');
select pg_temp.assert_true(public.create_application_order(pg_temp.recipe_data(),pg_temp.stages(),pg_temp.mixture())='90000000-0000-4000-8000-000000000002','reintento exacto conserva éxito aunque se cancele después la base');
select pg_temp.assert_true((select count(*)=3 from public.application_orders),'rechazos no dejan nuevas órdenes parciales');
set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000002';
select pg_temp.assert_true((select recipe_source_revision=0 from public.application_orders where id='90000000-0000-4000-8000-000000000002'),'lector asignado consulta vínculo de receta');
select pg_temp.expect_error($q$select public.create_application_order(pg_temp.recipe_data('90000000-0000-4000-8000-000000000004'),pg_temp.stages(),pg_temp.mixture())$q$,'administrador','lector no crea copia de receta');
set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000003';
select pg_temp.assert_true((select count(*)=0 from public.application_orders),'RLS oculta también referencia de receta fuera de su agrícola');
reset role;
select pg_temp.expect_error($q$update public.application_orders set recipe_source_revision=5 where id='90000000-0000-4000-8000-000000000002'$q$,'inmutable|RPC|indicaci','metadatos de receta son inmutables incluso con SQL directo');
rollback;
