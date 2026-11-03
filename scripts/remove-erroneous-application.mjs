// Private operator maintenance, not a client endpoint. Requires an owner-confirmed
// plan, an unchanged last order without executions/history/dependants, and backup.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const authority='Solicitud explícita del Propietario: eliminar la captura errónea y liberar folio/números para recapturar desde IA.';
const literal=value=>`'${String(value).replaceAll("'","''")}'`;
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
function folioNumber(folio){if(typeof folio!=='string'||!/^APL-\d{6,12}$/.test(folio)||Number(folio.slice(4))<1)throw Error('Folio inválido.');return Number(folio.slice(4));}

export function snapshotQuery(folio){
  const number=folioNumber(folio);
  const tables={
    application_orders:'not exists(select 1 from o where o.id=a.id)',
    application_order_products:'not exists(select 1 from o where o.id=a.order_id)',
    application_targets:'not exists(select 1 from o where o.id=a.order_id)',
    application_actual_products:'true',application_changes:'true',application_change_products:'true',
    sowing_groups:'true',sowing_group_members:'true',sowing_stages:'true',sowing_projects:'true',
    project_lots:'true',lot_subdivisions:'true',products:'true',product_ingredients:'true',
  };
  const hashes=Object.entries(tables).map(([table,predicate])=>`${literal(table)},(select jsonb_build_object('count',count(*),'hash',md5(coalesce(string_agg(to_jsonb(a)::text,E'\\n' order by to_jsonb(a)::text),''))) from public.${table} a where ${predicate})`).join(',');
  return `with o as (select * from public.application_orders where folio=${literal(folio)}),t as (select t.* from public.application_targets t join o on o.id=t.order_id)
  select jsonb_build_object(
    'folio',${literal(folio)},'found',(select count(*) from o),
    'order',(select jsonb_build_object('id',id,'revision',revision,'hash',md5(to_jsonb(o)::text)) from o),
    'targets',coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'stage_id',t.stage_id,'status',t.status,'number',t.application_number,'correction_version',t.correction_version,'indication_change_id',t.indication_change_id,'previous_number',(select coalesce(max(a.application_number),0) from public.application_targets a where a.stage_id=t.stage_id and a.order_id<>t.order_id),'hash',md5(to_jsonb(t)::text)) order by t.id) from t),'[]'::jsonb),
    'order_products',(select count(*) from public.application_order_products p join o on o.id=p.order_id),
    'product_hash',(select md5(coalesce(string_agg(to_jsonb(p)::text,E'\\n' order by to_jsonb(p)::text),'')) from public.application_order_products p join o on o.id=p.order_id),
    'changes',(select count(*) from public.application_changes c join o on o.id=c.order_id),
    'actual_products',(select count(*) from public.application_actual_products p join t on t.id=p.target_id),
    'derived_recipes',(select count(*) from public.application_orders a join o on a.recipe_source_order_id=o.id),
    'later_folios',(select count(*) from public.application_orders where substring(folio from 5)::bigint>${number}),
    'unchanged',jsonb_build_object(${hashes}),
    'sequence',(select jsonb_build_object('last_value',last_value,'is_called',is_called) from rcfito_private.application_folio_seq),
    'sequence_options',(select jsonb_build_object('increment',seqincrement,'cache',seqcache,'cycle',seqcycle) from pg_sequence where seqrelid='rcfito_private.application_folio_seq'::regclass),
    'guards',(select jsonb_agg(jsonb_build_object('table',tgrelid::regclass::text,'name',tgname,'enabled',tgenabled,'definition',pg_get_triggerdef(oid)) order by tgrelid,tgname) from pg_trigger where not tgisinternal and tgrelid in ('public.application_orders'::regclass,'public.application_order_products'::regclass,'public.application_targets'::regclass,'public.application_actual_products'::regclass,'public.application_changes'::regclass,'public.application_change_products'::regclass,'public.sowing_groups'::regclass,'public.sowing_group_members'::regclass))
  )`;
}

export function makePlan(snapshot){const plan={operation_key:`remove-erroneous-application:${snapshot.order?.id}`,authority,snapshot};return {...plan,sha256:digest(plan)};}
export function validatePlan(plan){
  const s=plan?.snapshot,n=folioNumber(s?.folio);
  if(plan.authority!==authority||!uuid(s.order?.id)||plan.operation_key!==`remove-erroneous-application:${s.order.id}`||s.found!==1||s.order.revision!==0||!s.targets?.length||s.order_products<1||s.changes!==0||s.actual_products!==0||s.derived_recipes!==0||s.later_folios!==0)throw Error('Solo se permite la última captura pendiente, sin revisiones, realizaciones ni dependencias.');
  if(s.targets.some(t=>!uuid(t.id)||!uuid(t.stage_id)||t.status!=='indicated'||t.correction_version!==0||t.indication_change_id!==null||!Number.isInteger(t.number)||t.number!==t.previous_number+1))throw Error('Los destinos deben estar pendientes y ocupar el último número consecutivo de cada etapa.');
  if(s.sequence_options?.increment!==1||s.sequence_options?.cache!==1||s.sequence_options?.cycle!==false||s.sequence?.is_called!==true||s.sequence.last_value<n)throw Error('La secuencia no tiene el estado esperado; no se reinicia.');
  if(!s.guards?.length||s.guards.some(g=>g.enabled!=='O')||['application_orders','application_order_products','application_targets'].some(table=>!s.guards.some(g=>g.table.replace(/^public\./,'')===table&&g.name==='rcfito_application_write')))throw Error('Las guardas no tienen el estado esperado.');
  if(plan.sha256!==digest({operation_key:plan.operation_key,authority:plan.authority,snapshot:s}))throw Error('El plan privado cambió.');
  return s;
}

export function removalSql(plan,commit=false){
  const s=validatePlan(plan),number=folioNumber(s.folio);
  return `begin;
set local standard_conforming_strings=on;
set local lock_timeout='5s';
set local statement_timeout='30s';
select pg_advisory_xact_lock(hashtextextended('rcfito-remove-erroneous-application',0));
lock table public.application_orders,public.application_targets,public.application_order_products,public.application_actual_products,public.application_changes,public.application_change_products,public.sowing_groups,public.sowing_group_members,public.sowing_stages in access exclusive mode;
create temp table removal_plan as select ${literal(JSON.stringify(plan))}::jsonb p;
do $check$ declare actual jsonb; begin
  if current_user<>'postgres' then raise exception 'Operación exclusiva del operador privado'; end if;
  select * into actual from (${snapshotQuery(s.folio)}) reviewed;
  if actual is distinct from (select p->'snapshot' from removal_plan) then raise exception 'La captura o sus dependencias cambiaron; no se eliminó'; end if;
end $check$;
create schema if not exists rcfito_meta;
revoke all on schema rcfito_meta from public,anon,authenticated;
create table if not exists rcfito_meta.data_corrections(correction_key text primary key,applied_at timestamptz not null default clock_timestamp(),authority text not null,details jsonb not null);
revoke all on rcfito_meta.data_corrections from public,anon,authenticated;
do $check$ begin
  if exists(select 1 from rcfito_meta.data_corrections where correction_key=${literal(plan.operation_key)}) then raise exception 'La corrección ya fue aplicada; no se repite'; end if;
end $check$;
-- Table locks isolate this transaction-local maintenance exception. No grants,
-- RLS, foreign keys, other triggers or client RPCs are weakened.
alter table public.application_order_products disable trigger rcfito_application_write;
alter table public.application_targets disable trigger rcfito_application_write;
alter table public.application_orders disable trigger rcfito_application_write;
delete from public.application_order_products where order_id=${literal(s.order.id)}::uuid;
delete from public.application_targets where order_id=${literal(s.order.id)}::uuid;
delete from public.application_orders where id=${literal(s.order.id)}::uuid and folio=${literal(s.folio)};
alter table public.application_order_products enable trigger rcfito_application_write;
alter table public.application_targets enable trigger rcfito_application_write;
alter table public.application_orders enable trigger rcfito_application_write;
-- ALTER SEQUENCE RESTART is transactional; unlike setval it rolls back with
-- the deletion, including during dry-run, and serializes concurrent nextval.
alter sequence rcfito_private.application_folio_seq restart with ${number};
do $check$ declare actual jsonb; begin
  select * into actual from (${snapshotQuery(s.folio)}) reviewed;
  if (actual->>'found')::int<>0 or actual->'unchanged' is distinct from (select p#>'{snapshot,unchanged}' from removal_plan)
    or actual->'guards' is distinct from (select p#>'{snapshot,guards}' from removal_plan)
    or actual->'sequence' is distinct from jsonb_build_object('last_value',${number},'is_called',false) then raise exception 'La verificación posterior falló; se revierte la eliminación completa'; end if;
  if exists(select 1 from jsonb_array_elements((select p#>'{snapshot,targets}' from removal_plan)) target where exists(select 1 from public.application_targets t where t.stage_id=(target->>'stage_id')::uuid and t.application_number=(target->>'number')::int)) then raise exception 'Un número de aplicación no quedó libre'; end if;
end $check$;
insert into rcfito_meta.data_corrections(correction_key,authority,details)
values(${literal(plan.operation_key)},${literal(authority)},jsonb_build_object('plan_sha256',${literal(plan.sha256)},'folio',${literal(s.folio)},'deleted_orders',1,'deleted_targets',${s.targets.length},'other_data_unchanged',true,'guards_restored',true));
select jsonb_build_object('mode',${literal(commit?'applied':'dry-run')},'deleted_orders',1,'deleted_targets',${s.targets.length},'deleted_product_lines',${s.order_products},'folio_free',true,'stage_numbers_free',true,'other_data_unchanged',true,'guards_restored',true,'plan_sha256',${literal(plan.sha256)});
${commit?'commit;':'rollback;'}`;
}

function docker(args,input,binary=false){const r=spawnSync('docker',args,{input,encoding:binary?undefined:'utf8',maxBuffer:64*1024*1024});if(r.error||r.status!==0)throw Error('No se confirmó la operación; revisar el plan privado antes de reintentar.');return r.stdout;}
function sql(input){const labels=JSON.parse(docker(['inspect','rcfito-db','--format','{{json .Config.Labels}}']));if(labels['com.docker.compose.project']!=='rcfito-supabase')throw Error('Contenedor de identidad diferente; se conserva intacto.');return docker(['exec','-i','rcfito-db','psql','-X','-U','postgres','-d','postgres','-q','-A','-t','-v','ON_ERROR_STOP=1'],input).trim();}
async function main(args){
  const [mode,folio,...flags]=args;folioNumber(folio);
  if(!['prepare','dry-run','apply'].includes(mode)||flags.join(' ')!=='--owner-confirmed')throw Error('Uso: prepare|dry-run|apply APL-NNNNNN --owner-confirmed. Solo para una eliminación expresamente autorizada.');
  const folder=resolve(root,'.artifacts/production-supabase/maintenance/remove-erroneous-application',folio),path=resolve(folder,'plan.json');
  if(mode==='prepare'){
    if(existsSync(path))throw Error('Ya existe un plan privado para este folio; revisar antes de repetir.');
    const plan=makePlan(JSON.parse(sql(`begin read only; ${snapshotQuery(folio)}; rollback;`)));const s=validatePlan(plan);mkdirSync(folder,{recursive:true});writeFileSync(path,JSON.stringify(plan,null,2),{flag:'wx'});
    console.log(JSON.stringify({reviewed_orders:1,reviewed_targets:s.targets.length,plan_sha256:plan.sha256}));return;
  }
  const plan=JSON.parse(readFileSync(path,'utf8'));validatePlan(plan);
  if(plan.snapshot.folio!==folio)throw Error('Plan de otro folio.');
  if(existsSync(resolve(folder,'apply.json')))throw Error('La eliminación ya tiene resultado registrado; no se repite.');
  if(mode==='apply'){
    const dry=JSON.parse(readFileSync(resolve(folder,'dry-run.json'),'utf8'));if(dry.mode!=='dry-run'||dry.plan_sha256!==plan.sha256||dry.guards_restored!==true)throw Error('Falta simulación validada del mismo plan.');
    sql('begin read only; select 1; rollback;');
    const backupPath=resolve(folder,'before-removal.dump');if(existsSync(backupPath))throw Error('Existe respaldo de una ejecución anterior; revisar antes de continuar.');
    const backup=docker(['exec','rcfito-db','pg_dump','-U','postgres','-d','postgres','--format=custom'],undefined,true);if(backup.byteLength<10000)throw Error('Respaldo incompleto.');
    const listing=docker(['exec','-i','rcfito-db','pg_restore','--list'],backup);if(!listing.includes('application_orders')||!listing.includes('application_targets'))throw Error('Respaldo inválido.');writeFileSync(backupPath,backup,{flag:'wx'});
    console.log(JSON.stringify({backup_validated:true,bytes:backup.byteLength}));
  }
  const report=sql(removalSql(plan,mode==='apply'));writeFileSync(resolve(folder,mode+'.json'),report+'\n',{flag:'wx'});console.log(report);
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main(process.argv.slice(2)).catch(error=>{console.error(error.message);process.exitCode=1;});
