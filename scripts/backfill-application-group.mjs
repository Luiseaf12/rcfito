// Exceptional operator maintenance for the owner's 2026-11-02 confirmation.
// No RPC, automatic migration, credentials, or operational identifiers are shipped.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const correctionKey = 'RCF-029-owner-confirmed-group-20261102';
export const authority = 'Propietario del producto: Todas se emitieron para el grupo completo. Confirmado en este chat el 2026-11-02.';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const folder = resolve(root, '.artifacts/production-supabase/maintenance', correctionKey);
const planPath = resolve(folder, 'plan.json');
const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const literal = value => `'${String(value).replaceAll("'", "''")}'`;
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

export function snapshotQuery(ids) {
  if (ids && (!ids.length || ids.some(id => !uuid(id)) || new Set(ids).size !== ids.length)) throw new Error('Plan con identidades inválidas.');
  const predicate = ids ? `o.id=any(array[${ids.map(literal).join(',')}]::uuid[])` : "o.selection_origin='unknown'";
  return `with g as (select * from public.sowing_groups order by id limit 1),
  orders as (select o.* from public.application_orders o where ${predicate}),
  targets as (select t.* from public.application_targets t join orders o on o.id=t.order_id),
  members as (select m.* from public.sowing_group_members m join g on g.id=m.group_id)
  select jsonb_build_object(
    'group_count',(select count(*) from public.sowing_groups),
    'group',(select jsonb_build_object('id',g.id,'name',g.name,'active',g.active,'project_id',g.project_id,'field_id',g.field_id,'crop_id',g.crop_id,'row_hash',md5(to_jsonb(g)::text)) from g),
    'members',coalesce((select jsonb_agg(jsonb_build_object('stage_id',m.stage_id,'active',m.active,'row_hash',md5(to_jsonb(m)::text)) order by stage_id) from members m),'[]'::jsonb),
    'orders',coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'selection_origin',o.selection_origin,'source_group_id',o.source_group_id,'source_group_name',o.source_group_name,'row_hash',md5((to_jsonb(o)-array['selection_origin','source_group_id','source_group_name'])::text)) order by id) from orders o),'[]'::jsonb),
    'targets',coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'order_id',t.order_id,'stage_id',t.stage_id,'group_memberships_snapshot',t.group_memberships_snapshot,'row_hash',md5((to_jsonb(t)-'group_memberships_snapshot')::text)) order by id) from targets t),'[]'::jsonb),
    'invalid_orders',(select count(*) from orders o where not exists(select 1 from g where g.project_id=o.project_id and g.field_id=o.field_id and g.crop_id=o.crop_id)
      or exists((select t.stage_id from targets t where t.order_id=o.id) except (select m.stage_id from members m))
      or exists((select m.stage_id from members m) except (select t.stage_id from targets t where t.order_id=o.id)))
  ) as snapshot`;
}

export function validatePlan(plan) {
  const s = plan?.snapshot;
  if (plan?.operation_key !== correctionKey || plan?.authority !== authority || !s || s.group_count !== 1 || !uuid(s.group?.id) || s.group.active !== true || !s.members?.length || !s.orders?.length || !s.targets?.length || s.invalid_orders !== 0) throw new Error('El plan no corresponde a la corrección excepcional confirmada.');
  if (s.members.some(m => !uuid(m.stage_id)) || s.orders.some(o => !uuid(o.id) || o.selection_origin !== 'unknown' || o.source_group_id !== null || o.source_group_name !== null) || s.targets.some(t => !uuid(t.id) || t.group_memberships_snapshot !== null)) throw new Error('El plan incluye historia conocida o identidades incompatibles.');
  if (s.targets.length !== s.orders.length * s.members.length) throw new Error('Las aplicaciones no coinciden con el grupo completo revisado.');
  if (plan.sha256 !== digest({ operation_key: plan.operation_key, authority: plan.authority, snapshot: s })) throw new Error('El plan cambió después de prepararse.');
  return s;
}

export function correctionSql(plan, commit = false) {
  const s = validatePlan(plan), ids = s.orders.map(o => o.id);
  return `begin;
set local standard_conforming_strings=on;
set local lock_timeout='5s';
set local statement_timeout='30s';
select pg_advisory_xact_lock(hashtextextended(${literal(correctionKey)},0));
lock table public.sowing_groups,public.sowing_group_members,public.application_orders,public.application_targets in access exclusive mode;
create temp table correction_plan as select ${literal(JSON.stringify(plan))}::jsonb p;
do $check$ declare actual jsonb; begin
  if current_user<>'postgres' then raise exception 'Mantenimiento limitado al operador privado'; end if;
  select snapshot into actual from (${snapshotQuery(ids)}) reviewed;
  if actual is distinct from (select p->'snapshot' from correction_plan) then raise exception 'El conjunto revisado cambió; no se aplicó la corrección'; end if;
  if (select count(*)<>4 or not bool_and(tgenabled='O') from pg_trigger where not tgisinternal and
    ((tgrelid='public.application_orders'::regclass and tgname in ('rcfito_application_write','application_orders_group_history'))
    or (tgrelid='public.application_targets'::regclass and tgname in ('rcfito_application_write','application_targets_group_history')))) then raise exception 'Las guardas no tienen el estado esperado'; end if;
end $check$;
create schema if not exists rcfito_meta;
revoke all on schema rcfito_meta from public,anon,authenticated;
create table if not exists rcfito_meta.data_corrections(
  correction_key text primary key, applied_at timestamptz not null default clock_timestamp(),
  authority text not null, details jsonb not null);
revoke all on rcfito_meta.data_corrections from public,anon,authenticated;
do $check$ begin
  if exists(select 1 from rcfito_meta.data_corrections where correction_key=${literal(correctionKey)}) then raise exception 'La corrección excepcional ya fue aplicada'; end if;
end $check$;
create temp table correction_orders_before as select o.* from public.application_orders o where o.id=any(array[${ids.map(literal).join(',')}]::uuid[]);
create temp table correction_targets_before as select t.* from public.application_targets t join correction_orders_before o on o.id=t.order_id;
create temp table correction_guards_before as select oid,tgrelid,tgname,tgenabled,pg_get_triggerdef(oid) definition from pg_trigger where not tgisinternal and tgrelid in ('public.application_orders'::regclass,'public.application_targets'::regclass);
-- Locks isolate this brief, transaction-local maintenance window. Foreign keys,
-- RLS and all other triggers remain enabled; no client permission is added.
alter table public.application_orders disable trigger rcfito_application_write;
alter table public.application_orders disable trigger application_orders_group_history;
alter table public.application_targets disable trigger rcfito_application_write;
alter table public.application_targets disable trigger application_targets_group_history;
update public.application_orders o set selection_origin='group',
  source_group_id=(select (p#>>'{snapshot,group,id}')::uuid from correction_plan),
  source_group_name=(select p#>>'{snapshot,group,name}' from correction_plan)
  where o.id in (select id from correction_orders_before);
update public.application_targets t set group_memberships_snapshot=(select jsonb_build_array(jsonb_build_object('id',p#>>'{snapshot,group,id}','name',p#>>'{snapshot,group,name}')) from correction_plan)
  where t.id in (select id from correction_targets_before);
alter table public.application_orders enable trigger rcfito_application_write;
alter table public.application_orders enable trigger application_orders_group_history;
alter table public.application_targets enable trigger rcfito_application_write;
alter table public.application_targets enable trigger application_targets_group_history;
do $check$ begin
  if exists(select 1 from correction_orders_before b join public.application_orders a using(id)
    where (to_jsonb(a)-array['selection_origin','source_group_id','source_group_name']) is distinct from (to_jsonb(b)-array['selection_origin','source_group_id','source_group_name']))
    or exists(select 1 from correction_targets_before b join public.application_targets a using(id)
    where (to_jsonb(a)-'group_memberships_snapshot') is distinct from (to_jsonb(b)-'group_memberships_snapshot')) then raise exception 'Cambió un valor ajeno al grupo; se revierte toda la operación'; end if;
  if exists(select 1 from correction_guards_before b full join
    (select oid,tgrelid,tgname,tgenabled,pg_get_triggerdef(oid) definition from pg_trigger where not tgisinternal and tgrelid in ('public.application_orders'::regclass,'public.application_targets'::regclass)) a using(oid)
    where to_jsonb(a) is distinct from to_jsonb(b)) then raise exception 'Las guardas no quedaron restauradas'; end if;
end $check$;
insert into rcfito_meta.data_corrections(correction_key,authority,details)
select ${literal(correctionKey)},${literal(authority)},jsonb_build_object(
  'plan_sha256',p->>'sha256','group',p#>'{snapshot,group}',
  'before_orders',p#>'{snapshot,orders}','before_targets',p#>'{snapshot,targets}',
  'after_orders',(select jsonb_agg(jsonb_build_object('id',o.id,'selection_origin',o.selection_origin,'source_group_id',o.source_group_id,'source_group_name',o.source_group_name) order by o.id) from public.application_orders o join correction_orders_before b using(id)),
  'after_targets',(select jsonb_agg(jsonb_build_object('id',t.id,'group_memberships_snapshot',t.group_memberships_snapshot) order by t.id) from public.application_targets t join correction_targets_before b using(id))) from correction_plan;
select jsonb_build_object('mode',${literal(commit ? 'applied' : 'dry-run')},'orders',(select count(*) from correction_orders_before),'targets',(select count(*) from correction_targets_before),'guards_restored',true,'original_values_preserved',true);
${commit ? 'commit;' : 'rollback;'}`;
}

function docker(args, input, binary = false) {
  const r = spawnSync('docker', args, { input, encoding: binary ? undefined : 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.error || r.status !== 0) throw new Error('No se confirmó el mantenimiento; la transacción se revierte al cerrar la conexión. Revisar el plan privado antes de reintentar.');
  return r.stdout;
}
function assertTarget() {
  const labels = JSON.parse(docker(['inspect','rcfito-db','--format','{{json .Config.Labels}}']));
  if (labels['com.docker.compose.project'] !== 'rcfito-supabase') throw new Error('Destino de operación incompatible.');
}
function sql(statement) { assertTarget(); return docker(['exec','-i','rcfito-db','psql','-X','-U','postgres','-d','postgres','-A','-t','-q','-v','ON_ERROR_STOP=1'], statement).trim(); }

export function makePlan(snapshot) {
  const plan = { operation_key: correctionKey, authority, snapshot };
  return { ...plan, sha256: digest(plan) };
}

async function main(args) {
  if (args.length === 2 && args[0] === 'prepare' && args[1] === '--owner-confirmed') {
    if (existsSync(planPath)) throw new Error('Ya existe un plan privado congelado para esta única corrección.');
    const snapshot = JSON.parse(sql(`begin read only; ${snapshotQuery()}; rollback;`));
    const plan = makePlan(snapshot); validatePlan(plan); mkdirSync(folder,{recursive:true});
    writeFileSync(planPath,JSON.stringify(plan,null,2),{flag:'wx'});
    console.log(JSON.stringify({reviewed_orders:snapshot.orders.length,reviewed_targets:snapshot.targets.length,members:snapshot.members.length,plan_sha256:plan.sha256}));
  } else if (args.length === 1 && ['dry-run','apply'].includes(args[0])) {
    const plan=JSON.parse(readFileSync(planPath,'utf8'));validatePlan(plan);
    if (args[0] === 'apply') {
      assertTarget();
      const backupPath=resolve(folder,'before-correction.dump');
      if (existsSync(backupPath)) throw new Error('Ya hay un respaldo de esta ejecución; revisar su resultado antes de repetir.');
      const backup=docker(['exec','rcfito-db','pg_dump','-U','postgres','-d','postgres','--format=custom'],undefined,true);
      if(backup.byteLength<1000)throw new Error('Respaldo vacío.');
      docker(['exec','-i','rcfito-db','pg_restore','--list'],backup);
      writeFileSync(backupPath,backup,{flag:'wx'});
      console.log(JSON.stringify({backup_validated:true,bytes:backup.byteLength}));
    }
    const report=sql(correctionSql(plan,args[0]==='apply'));
    writeFileSync(resolve(folder,args[0]+'.json'),report+'\n',{flag:'wx'});
    console.log(report);
  } else throw new Error('Uso: prepare --owner-confirmed, dry-run o apply. Solo para la corrección excepcional autorizada.');
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main(process.argv.slice(2)).catch(error=>{console.error(error.message);process.exitCode=1;});
