import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { correctionSql, makePlan, snapshotQuery } from './backfill-application-group.mjs';

const container='rcfito-group-history-test', purpose='history-group-backfill-test';
function docker(args,input,allowFailure=false){
  const r=spawnSync('docker',args,{input,encoding:'utf8',maxBuffer:8*1024*1024});
  if(!allowFailure&&(r.error||r.status!==0))throw new Error(r.stderr||'Falló el contenedor exclusivo de prueba.');
  return r;
}
function sql(input){return docker(['exec','-i',container,'psql','-h','127.0.0.1','-X','-U','postgres','-d','rcfito_test','-q','-A','-t','-v','ON_ERROR_STOP=1'],input).stdout.trim();}
function expectedError(input,pattern){
  const r=docker(['exec','-i',container,'psql','-h','127.0.0.1','-X','-U','postgres','-d','rcfito_test','-q','-A','-t','-v','ON_ERROR_STOP=1'],input,true);
  assert.notEqual(r.status,0);assert.match(r.stderr,pattern);
}
let started=false,checks=0;
const pass=message=>{checks++;console.log('PASS: '+message);};
try{
  if(docker(['inspect',container],undefined,true).status===0)throw new Error('El nombre de QA está ocupado; no se modifica el recurso existente.');
  docker(['run','--detach','--name',container,'--label','app=rcfito','--label',`purpose=${purpose}`,'--env','POSTGRES_PASSWORD=rcfito-fixture-password','--env','POSTGRES_DB=rcfito_test','--tmpfs','/var/lib/postgresql/data','postgres:17-alpine']);started=true;
  let ready=false;
  for(let i=0;i<40;i++){if(docker(['exec',container,'pg_isready','-h','127.0.0.1','-U','postgres','-d','rcfito_test'],undefined,true).status===0){ready=true;break;}await new Promise(done=>setTimeout(done,250));}
  assert.ok(ready);
  sql(readFileSync('supabase/tests/bootstrap-auth.sql','utf8'));
  const migrations=readdirSync('supabase/migrations').filter(name=>name.endsWith('.sql')).sort();
  for(const name of migrations.filter(name=>!name.endsWith('_application_group_origin.sql')))sql(readFileSync(resolve('supabase/migrations',name),'utf8'));
  const fixture=readFileSync('supabase/tests/applications.sql','utf8');
  const boundary=fixture.indexOf('-- Captura asistida:');assert.ok(boundary>0);
  sql(fixture.slice(0,boundary)+`select public.save_sowing_group(pg_temp.group_data(),pg_temp.stages());
    select public.create_application_order(pg_temp.order_data(),pg_temp.stages(),pg_temp.mixture()); commit;`);
  sql(readFileSync('supabase/migrations/'+migrations.find(name=>name.endsWith('_application_group_origin.sql')),'utf8'));
  const before=JSON.parse(sql(snapshotQuery()));const plan=makePlan(before);
  assert.equal(before.orders.length,1);assert.equal(before.targets.length,2);assert.equal(before.orders[0].selection_origin,'unknown');pass('fixture histórico ficticio conserva origen desconocido');
  const stale=structuredClone(before);stale.orders[0].row_hash='cambió';
  expectedError(correctionSql(makePlan(stale),true),/conjunto revisado cambió/i);
  assert.equal(JSON.parse(sql(snapshotQuery())).orders[0].selection_origin,'unknown');pass('plan desactualizado revierte toda la operación');
  const dry=JSON.parse(sql(correctionSql(plan,false)));assert.equal(dry.mode,'dry-run');
  assert.equal(JSON.parse(sql(snapshotQuery())).orders[0].selection_origin,'unknown');
  assert.equal(sql("select to_regclass('rcfito_meta.data_corrections') is null"),'t');pass('simulación revierte datos y auditoría sin dejar una vía de edición');
  const report=JSON.parse(sql(correctionSql(plan,true)));assert.equal(report.orders,1);assert.equal(report.targets,2);pass('corrección confirmada completa origen y pertenencias');
  const after=JSON.parse(sql(snapshotQuery(before.orders.map(order=>order.id))));
  assert.equal(after.orders[0].selection_origin,'group');assert.equal(after.orders[0].source_group_id,before.group.id);
  assert.ok(after.targets.every(target=>target.group_memberships_snapshot?.[0]?.id===before.group.id));pass('lectura posterior conserva el grupo de origen confirmado');
  assert.equal(after.orders[0].row_hash,before.orders[0].row_hash);
  assert.deepEqual(after.targets.map(target=>target.row_hash),before.targets.map(target=>target.row_hash));pass('fechas, mezclas, números, estados y demás valores permanecen intactos');
  assert.equal(sql("select count(*)=1 and bool_and(authority like '%Propietario%') from rcfito_meta.data_corrections"),'t');
  assert.equal(sql("select details#>>'{before_orders,0,selection_origin}' from rcfito_meta.data_corrections"),'unknown');pass('auditoría privada conserva autoridad y valor anterior');
  expectedError(correctionSql(plan,true),/conjunto revisado cambió|ya fue aplicada/i);
  assert.equal(sql('select count(*) from rcfito_meta.data_corrections'),'1');pass('una segunda ejecución se rechaza');
  expectedError("update public.application_orders set source_group_name='Edición indebida'",/inmutable|RPC/i);
  expectedError("update public.application_targets set group_memberships_snapshot='[]'",/históric|RPC|transición/i);pass('guardas ordinarias continúan rechazando cambios de historial');
  assert.equal(sql("select count(*)=4 and bool_and(tgenabled='O') from pg_trigger where (tgrelid='public.application_orders'::regclass and tgname in ('rcfito_application_write','application_orders_group_history')) or (tgrelid='public.application_targets'::regclass and tgname in ('rcfito_application_write','application_targets_group_history'))"),'t');pass('las cuatro guardas permanecen habilitadas');
  assert.equal(sql("select not has_table_privilege('authenticated','rcfito_meta.data_corrections','SELECT') and not has_schema_privilege('authenticated','rcfito_meta','USAGE')"),'t');pass('la auditoría no queda expuesta al cliente');
  console.log(`${checks} comprobaciones aisladas de la corrección excepcional aprobadas.`);
}finally{
  if(started){const labels=JSON.parse(docker(['inspect',container,'--format','{{json .Config.Labels}}']).stdout);if(labels.app!=='rcfito'||labels.purpose!==purpose)throw new Error('Se conserva un recurso de identidad diferente.');docker(['rm','--force',container]);}
}
