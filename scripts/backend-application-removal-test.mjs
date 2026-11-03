import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { makePlan, removalSql, snapshotQuery, validatePlan } from './remove-erroneous-application.mjs';

const container='rcfito-application-removal-test',purpose='erroneous-application-removal-test';
const first='90000000-0000-4000-8000-000000000001',second='90000000-0000-4000-8000-000000000002',replacement='90000000-0000-4000-8000-000000000003';
const admin=`set local role authenticated; set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000001';`;
function docker(args,input,allowFailure=false){const r=spawnSync('docker',args,{input,encoding:'utf8',maxBuffer:8*1024*1024});if(!allowFailure&&(r.error||r.status!==0))throw Error(r.stderr||'Falló el contenedor exclusivo de QA.');return r;}
const psql=['exec','-i',container,'psql','-h','127.0.0.1','-X','-U','postgres','-d','rcfito_test','-q','-A','-t','-v','ON_ERROR_STOP=1'];
function sql(input){return docker(psql,input).stdout.trim();}
function json(input){const lines=sql(input).split('\n').filter(line=>line.startsWith('{'));assert.equal(lines.length,1);return JSON.parse(lines[0]);}
function expectedError(input,pattern){const r=docker(psql,input,true);assert.notEqual(r.status,0);assert.match(r.stderr,pattern);}
const snapshot=()=>json(snapshotQuery('APL-000002'));
function newOrder(id,extra={}){return `select public.create_application_order((select jsonb_build_object('id','${id}','project_id',project_id,'field_id',field_id,'crop_id',crop_id,'method_id',method_id,'source_group_id',source_group_id,'indicated_date',indicated_date,'scheduled_date',scheduled_date,'water_l_ha',water_l_ha,'observations','Captura ficticia IA') from public.application_orders where id='${first}')||'${JSON.stringify(extra)}'::jsonb,(select array_agg(stage_id order by stage_id) from public.application_targets where order_id='${first}'),(select jsonb_agg(jsonb_build_object('product_id',product_id,'dose',dose)) from public.application_order_products where order_id='${first}'));`;}
let started=false,checks=0;
function pass(message){checks++;console.log('PASS '+message);}
try{
  if(docker(['inspect',container],undefined,true).status===0)throw Error('Nombre de QA ocupado; no se modifica el recurso existente.');
  docker(['run','--detach','--name',container,'--label','app=rcfito','--label',`purpose=${purpose}`,'--env','POSTGRES_PASSWORD=rcfito-fixture-password','--env','POSTGRES_DB=rcfito_test','--tmpfs','/var/lib/postgresql/data','postgres:17-alpine']);started=true;
  let ready=false;for(let n=0;n<40;n++){if(docker(['exec',container,'pg_isready','-h','127.0.0.1','-U','postgres','-d','rcfito_test'],undefined,true).status===0){ready=true;break;}await new Promise(done=>setTimeout(done,250));}assert.ok(ready);
  sql(readFileSync('supabase/tests/bootstrap-auth.sql','utf8'));
  for(const file of readdirSync('supabase/migrations').filter(file=>file.endsWith('.sql')).sort())sql(readFileSync(resolve('supabase/migrations',file),'utf8'));
  const source=readFileSync('supabase/tests/applications.sql','utf8'),end=source.indexOf('-- Captura asistida:');assert.ok(end>0);
  sql(source.slice(0,end)+`select public.save_sowing_group(pg_temp.group_data(),pg_temp.stages());
    select public.create_application_order(pg_temp.order_data()||'{"source_group_id":"91000000-0000-4000-8000-000000000001"}',pg_temp.stages(),pg_temp.mixture());
    select public.create_application_order(pg_temp.order_data('${second}')||'{"source_group_id":"91000000-0000-4000-8000-000000000001","application_number":2}',pg_temp.stages(),pg_temp.mixture()); commit;`);
  assert.throws(()=>snapshotQuery("APL-000002';delete"),/inválido/);pass('entrada inválida no genera SQL de mantenimiento');
  assert.throws(()=>validatePlan(makePlan(json(snapshotQuery('APL-000001')))),/última/);pass('rechaza una orden anterior y números ocupados posteriormente');
  const performed=json(`begin;${admin} select public.perform_application_targets('${second}',array[(select id from public.application_targets where order_id='${second}' limit 1)],'{"changed":false,"actual_date":"2026-01-06"}'); reset role;${snapshotQuery('APL-000002')};rollback;`);
  assert.throws(()=>validatePlan(makePlan(performed)),/realizaciones|destinos/i);pass('una realización impide preparar la eliminación');
  const dependent=json(`begin;${admin}${newOrder(replacement,{recipe_source:{order_id:second,revision:0}})} reset role;${snapshotQuery('APL-000002')};rollback;`);
  assert.equal(dependent.derived_recipes,1);assert.throws(()=>validatePlan(makePlan(dependent)),/dependencias/);pass('una receta derivada impide eliminar su base');
  const before=snapshot(),plan=makePlan(before);assert.equal(validatePlan(plan).targets.length,2);
  const tampered=structuredClone(plan);tampered.snapshot.product_hash='cambió';assert.throws(()=>validatePlan(tampered),/plan privado cambió/);pass('detecta alteración del plan congelado');
  const stale=structuredClone(before);stale.product_hash='ya no coincide';
  expectedError(removalSql(makePlan(stale),true),/cambiaron/);assert.deepEqual(snapshot(),before);pass('rechaza plan desactualizado sin cambios de datos/secuencia');
  const dry=json(removalSql(plan,false));assert.equal(dry.mode,'dry-run');assert.deepEqual(snapshot(),before);pass('simulación restaura orden, destinos, guardas y secuencia');
  assert.equal(sql("select to_regclass('rcfito_meta.data_corrections') is null"),'t');pass('simulación no deja auditoría ni funciones nuevas');
  expectedError(removalSql(plan,true).replace('insert into rcfito_meta.data_corrections','select 1/0; insert into rcfito_meta.data_corrections'),/division by zero/);
  assert.deepEqual(snapshot(),before);pass('fallo posterior al borrado revierte también ALTER SEQUENCE RESTART');
  const result=json(removalSql(plan,true));assert.equal(result.deleted_orders,1);assert.equal(result.deleted_targets,2);pass('elimina solo orden errónea, mezcla y destinos');
  const after=snapshot();assert.equal(after.found,0);assert.deepEqual(after.unchanged,before.unchanged);assert.deepEqual(after.guards,before.guards);assert.deepEqual(after.sequence,{last_value:2,is_called:false});pass('grupo, miembros, otras aplicaciones, guardas y números quedan correctos');
  assert.equal(sql("select not has_schema_privilege('authenticated','rcfito_meta','USAGE') and not has_table_privilege('authenticated','rcfito_meta.data_corrections','SELECT')"),'t');pass('auditoría mínima queda privada y sin nueva vía cliente');
  expectedError(`begin;set local role authenticated; delete from public.application_orders;commit;`,/permission denied/);
  expectedError(`delete from public.application_orders where id='${first}'`,/guard_application_write|no se elimina/);pass('borrado ordinario sigue bloqueado para cliente y operador');
  sql(`begin;${admin}${newOrder(replacement,{application_number:2,source_text:'Mensaje ficticio de recaptura IA',recipe_source:{order_id:first,revision:0}})}commit;`);
  assert.equal(sql(`select folio from public.application_orders where id='${replacement}'`),'APL-000002');
  assert.equal(sql(`select bool_and(application_number=2) and count(*)=2 from public.application_targets where order_id='${replacement}'`),'t');pass('recaptura grupal por RPC reutiliza folio y número explícito, con receta anterior');
  expectedError(removalSql(plan,true),/cambiaron|ya fue aplicada/);
  assert.equal(sql(`select count(*) from public.application_orders where id='${replacement}'`),'1');pass('repetir el mantenimiento nunca borra la recaptura nueva');
  console.log(`${checks} comprobaciones aisladas de eliminación/recaptura aprobadas.`);
}finally{
  if(started){const labels=JSON.parse(docker(['inspect',container,'--format','{{json .Config.Labels}}']).stdout);if(labels.app!=='rcfito'||labels.purpose!==purpose)throw Error('Identidad de QA distinta; se conserva el recurso.');docker(['rm','--force',container]);}
}
