import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { migrationBody } from './backend-local.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const container = 'rcfito-applications-test';
const image = 'postgres:17-alpine';
function docker(args, input, quiet = false) {
  const result = spawnSync('docker', args, { input, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${args[0]}: ${result.stderr || result.stdout}`);
  if (!quiet && result.stderr) process.stdout.write(result.stderr);
  return result.stdout;
}
function removeOwnedContainer() {
  const probe = spawnSync('docker', ['inspect', container, '--format', '{{json .Config.Labels}}'], { encoding: 'utf8' });
  if (probe.status !== 0) {
    if (/No such (object|container)/i.test(probe.stderr)) return;
    throw new Error(probe.stderr || 'Docker no está disponible');
  }
  const labels = JSON.parse(probe.stdout);
  if (labels?.app !== 'rcfito' || labels?.purpose !== 'applications-test') throw new Error('El nombre de prueba pertenece a otro recurso; se conserva intacto.');
  docker(['rm', '--force', container], undefined, true);
}
function sql(text) {
  return docker(['exec', '--interactive', container, 'psql', '-h', '127.0.0.1', '-U', 'postgres', '-d', 'rcfito_test', '-v', 'ON_ERROR_STOP=1', '--quiet'], text);
}

let started = false;
try {
  removeOwnedContainer();
  docker(['run', '--detach', '--name', container, '--label', 'app=rcfito', '--label', 'purpose=applications-test', '--env', 'POSTGRES_PASSWORD=rcfito-fixture-password', '--env', 'POSTGRES_DB=rcfito_test', '--tmpfs', '/var/lib/postgresql/data', image], undefined, true);
  started = true;
  let ready = false;
  for (let attempt = 0; attempt < 40; attempt++) {
    const probe = spawnSync('docker', ['exec', container, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres', '-d', 'rcfito_test'], { encoding: 'utf8' });
    if (probe.status === 0) { ready = true; break; }
    await new Promise((done) => setTimeout(done, 250));
  }
  if (!ready) throw new Error('PostgreSQL de prueba no quedó disponible.');
  sql(readFileSync(resolve(root, 'supabase/tests/bootstrap-auth.sql'), 'utf8'));
  const migrations = readdirSync(resolve(root, 'supabase/migrations')).filter((file) => file.endsWith('.sql')).sort();
  const applicationTests = readFileSync(resolve(root, 'supabase/tests/applications.sql'), 'utf8');
  for (const file of migrations) {
    const source = readFileSync(resolve(root, 'supabase/migrations', file), 'utf8');
    if (file.endsWith('_application_capture_source_and_stage_number.sql')) {
      // Probar la actualización sobre historia previa y revertir toda esa prueba;
      // después se aplica la misma migración al entorno vacío del resto de casos.
      const setupEnd = applicationTests.indexOf('-- Captura asistida:');
      if (setupEnd < 0) throw new Error('Falta el límite de fixtures para la prueba de actualización.');
      sql(`${applicationTests.slice(0, setupEnd)}
        select public.create_application_order(pg_temp.order_data(),pg_temp.stages(),pg_temp.mixture());
        select public.create_application_order(pg_temp.order_data('90000000-0000-4000-8000-000000000002'),array['80000000-0000-4000-8000-000000000001']::uuid[],pg_temp.mixture());
        select public.perform_application_targets('90000000-0000-4000-8000-000000000001',array[(select id from public.application_targets where order_id='90000000-0000-4000-8000-000000000001' and stage_id='80000000-0000-4000-8000-000000000001')],'{"changed":false,"actual_date":"2026-01-04"}');
        select public.cancel_application_targets('90000000-0000-4000-8000-000000000002',pg_temp.target_ids('90000000-0000-4000-8000-000000000002'),'Cancelación ficticia anterior');
        reset role;
        create temporary table before_capture_upgrade as select
          (select jsonb_agg(to_jsonb(t) order by t.id) from public.application_targets t) as targets,
          (select jsonb_agg(to_jsonb(o) order by o.id) from public.application_orders o) as orders;
        ${migrationBody(source)}
        select pg_temp.assert_true((select array_agg(application_number order by order_id,stage_id)=array[1,1,2] from public.application_targets),'backfill secuencial determinista por etapa');
        select pg_temp.assert_true((select jsonb_agg(to_jsonb(t)-'application_number' order by t.id) from public.application_targets t)=(select targets from before_capture_upgrade),'backfill conserva destinos completos, estados y snapshots');
        select pg_temp.assert_true((select jsonb_agg(to_jsonb(o)-'source_text' order by o.id) from public.application_orders o)=(select orders from before_capture_upgrade),'backfill conserva órdenes, firmas y notas anteriores');
        select pg_temp.assert_true((select bool_and(source_text='') from public.application_orders),'historia anterior conserva fuente vacía sin texto inventado');
        set local role authenticated;
        select pg_temp.assert_true(public.create_application_order(pg_temp.order_data(),pg_temp.stages(),pg_temp.mixture())='90000000-0000-4000-8000-000000000001'::uuid,'reintento histórico compatible tras migración');
        rollback;
      `);
    }
    if (file.endsWith('_application_revision_history.sql')) {
      const setupEnd = applicationTests.indexOf('-- Captura asistida:');
      if (setupEnd < 0) throw new Error('Falta el límite de fixtures para probar revisiones aditivas.');
      sql(`${applicationTests.slice(0, setupEnd)}
        select public.create_application_order(pg_temp.order_data()||'{"application_number":9,"source_text":"Mensaje anterior ficticio"}',pg_temp.stages(),pg_temp.mixture());
        select public.perform_application_targets('90000000-0000-4000-8000-000000000001',array[(select id from public.application_targets where stage_id='80000000-0000-4000-8000-000000000001')],'{"changed":false,"actual_date":"2026-01-04"}');
        reset role;
        create temporary table before_revision_upgrade as select
          (select jsonb_agg(to_jsonb(t) order by t.id) from public.application_targets t) as targets,
          (select jsonb_agg(to_jsonb(o) order by o.id) from public.application_orders o) as orders;
        ${migrationBody(source)}
        select pg_temp.assert_true((select bool_and(revision=0) from public.application_orders) and (select bool_and(indication_change_id is null and correction_version=0) from public.application_targets),'migración de revisión inicializa metadatos anteriores sin eventos');
        select pg_temp.assert_true((select jsonb_agg(to_jsonb(t)-array['indication_change_id','correction_version'] order by t.id) from public.application_targets t)=(select targets from before_revision_upgrade),'migración conserva ejecución, número y snapshots de destinos');
        select pg_temp.assert_true((select jsonb_agg(to_jsonb(o)-'revision' order by o.id) from public.application_orders o)=(select orders from before_revision_upgrade),'migración conserva órdenes, notas y fuente');
        select pg_temp.assert_true((select count(*)=0 from public.application_changes) and (select count(*)=0 from public.application_change_products),'migración no inventa historial ni referencias de productos');
        set local role authenticated;
        select public.perform_application_targets('90000000-0000-4000-8000-000000000001',array[(select id from public.application_targets where stage_id='80000000-0000-4000-8000-000000000001')],'{"changed":false,"actual_date":"2026-01-04"}');
        select pg_temp.assert_true((select count(*)=2 from public.application_actual_products),'reintento anterior sigue idempotente tras migración de revisión');
        rollback;
      `);
    }
    sql(source);
  }
  sql(readFileSync(resolve(root, 'supabase/tests/catalogs-and-sowing.sql'), 'utf8'));
  sql(readFileSync(resolve(root, 'supabase/tests/ingredient-classifications.sql'), 'utf8'));
  sql(applicationTests);
  const editingSetupEnd = applicationTests.indexOf('-- Captura asistida:');
  if (editingSetupEnd < 0) throw new Error('Falta el límite de fixtures para pruebas de edición.');
  sql(applicationTests.slice(0, editingSetupEnd) + readFileSync(resolve(root, 'supabase/tests/application-editing.sql'), 'utf8'));
  sql(readFileSync(resolve(root, 'supabase/tests/product-synonyms.sql'), 'utf8'));
  console.log(`Backend aplicaciones verificado: ${migrations.length} migración(es), fixtures aislados y controles de RLS/integridad. Auth es un stub de prueba; REST/Auth reales requieren integración aparte.`);
} finally {
  if (started) removeOwnedContainer();
}
