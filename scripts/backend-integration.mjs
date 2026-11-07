import { verifyApplicationRoutes } from './backend-route-http-checks.mjs';
import { verifyMenuPermissions } from './backend-menu-http-checks.mjs';
import { spawnSync } from 'node:child_process';
import { randomUUID, randomBytes } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyApplicationQueries } from './backend-query-http-checks.mjs';
import { verifyApplicationGroups } from './backend-group-http-checks.mjs';
import { verifyLotCorrections } from './backend-lot-http-checks.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const workdir = resolve(root, '.artifacts/supabase-integration');
const npmCli = resolve(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js');
const project = 'rcfito-local-test';
const databaseContainer = `supabase_db_${project}`;
function cli(args) {
  const result = process.env.RCFITO_SUPABASE_CLI
    ? spawnSync(process.env.RCFITO_SUPABASE_CLI, [...args, '--workdir', workdir], { cwd: workdir, encoding: 'utf8', maxBuffer: 12 * 1024 * 1024 })
    : process.platform === 'win32'
    ? spawnSync(process.execPath, [npmCli, 'exec', '--yes', '--package=supabase', '--', 'supabase', ...args, '--workdir', workdir], { cwd: workdir, encoding: 'utf8', maxBuffer: 12 * 1024 * 1024 })
    : spawnSync('npx', ['--yes', 'supabase', ...args, '--workdir', workdir], { cwd: workdir, encoding: 'utf8', maxBuffer: 12 * 1024 * 1024 });
  if (result.status !== 0) {
    // CLI errors/status can contain secrets. Keep raw output out of logs/files.
    let code = 'CLI_COMMAND_FAILED';
    try { code = JSON.parse(result.stderr.trim()).error?.code ?? code; } catch { /* sanitized */ }
    throw new Error(`Supabase ${args[0]}: ${code}`);
  }
  return result.stdout;
}
function sql(input) {
  const labelsResult = spawnSync('docker', ['inspect', databaseContainer, '--format', '{{json .Config.Labels}}'], { encoding: 'utf8' });
  let labels;
  try { labels = JSON.parse(labelsResult.stdout); } catch { /* checked below */ }
  if (labelsResult.status !== 0 || labels?.['com.supabase.cli.project'] !== project) throw new Error('El contenedor no corresponde al proyecto de integración aislado.');
  const result = spawnSync('docker', ['exec', '--interactive', databaseContainer, 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '--quiet'], { input, encoding: 'utf8' });
  if (result.status !== 0) throw new Error('Falló una consulta del fixture de integración.');
  return result.stdout;
}
function assert(value, message) { if (!value) throw new Error(message); console.log(`PASS: ${message}`); }
let assertionCount = 0;
function check(value, message) { assert(value, message); assertionCount++; }
const succeeded = (response) => response.status >= 200 && response.status < 300;

mkdirSync(resolve(workdir, 'supabase/migrations'), { recursive: true });
mkdirSync(resolve(workdir, 'supabase/functions/admin-create-user'), { recursive: true });
// Empty file is deliberate: never inherit/read the task root .env.
writeFileSync(resolve(workdir, '.env'), '# Isolated test workdir; never copy the root .env.\n');
const configuration = readFileSync(resolve(root, 'supabase/config.toml'), 'utf8');
if (!/^project_id\s*=\s*"rcfito-local-test"\s*$/m.test(configuration) || !/^port\s*=\s*55441\s*$/m.test(configuration) || !/^port\s*=\s*55442\s*$/m.test(configuration)) throw new Error('La configuración no identifica el proyecto y puertos de pruebas autorizados.');
copyFileSync(resolve(root, 'supabase/config.toml'), resolve(workdir, 'supabase/config.toml'));
for (const file of readdirSync(resolve(root, 'supabase/migrations')).filter((file) => file.endsWith('.sql'))) {
  copyFileSync(resolve(root, 'supabase/migrations', file), resolve(workdir, 'supabase/migrations', file));
}
for (const file of ['index.ts', 'deno.json']) copyFileSync(resolve(root, 'supabase/functions/admin-create-user', file), resolve(workdir, 'supabase/functions/admin-create-user', file));

console.log('Preparando Auth/REST/RLS reales en el proyecto aislado rcfito-local-test.');
if (process.argv.includes('--fresh')) {
  cli(['stop', '--no-backup']);
  console.log('Se retiró únicamente la instalación ficticia anterior de rcfito-local-test.');
}
cli(['start', '--exclude', 'realtime,storage-api,imgproxy,postgres-meta,studio,mailpit,logflare,vector,supavisor']);
const status = JSON.parse(cli(['status', '-o', 'json']));
const base = status.API_URL ?? status.api_url;
const publicKey = status.ANON_KEY ?? status.anon_key;
const serviceKey = status.SERVICE_ROLE_KEY ?? status.service_role_key;
if (!base || !publicKey || !serviceKey || !base.includes(':55441')) throw new Error('El estado de la CLI no coincide con el endpoint de prueba esperado.');
const password = randomBytes(24).toString('base64url');
const suffix = randomUUID().slice(0, 8);
const ids = { unitA: randomUUID(), unitB: randomUUID() };
async function request(path, token = publicKey, body, method = body === undefined ? 'GET' : 'POST', origin) {
  const response = await fetch(`${base}${path}`, {
    method, headers: { apikey: publicKey, authorization: `Bearer ${token}`, 'content-type': 'application/json', ...(origin ? { origin } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(30000),
  });
  const text = await response.text();
  let data; try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  return { status: response.status, data };
}
async function adminCreate(email, metadata = {}) {
  const response = await fetch(`${base}/auth/v1/admin/users`, {
    method: 'POST', headers: { apikey: serviceKey, authorization: `Bearer ${serviceKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({ email, password, email_confirm: true, user_metadata: metadata }), signal: AbortSignal.timeout(30000),
  });
  const user = await response.json();
  if (!response.ok || !user.id) throw new Error('No se pudo crear una cuenta ficticia en Auth.');
  return user;
}
async function login(email) {
  const result = await request('/auth/v1/token?grant_type=password', publicKey, { email, password });
  if (result.status !== 200 || !result.data.access_token) throw new Error('El login real del fixture no funcionó.');
  return result.data.access_token;
}
async function verifyApplications(adminToken, readerToken, noAccessToken, projectA) {
  const fixture = Object.fromEntries(['fieldA', 'fieldB', 'crop', 'variety', 'infrastructure', 'method', 'ingredient', 'productA', 'productB', 'productC', 'order', 'orderB', 'group'].map((key) => [key, randomUUID()]));
  // Only fictitious catalog setup uses SQL; all workflow mutations below go through REST/RPC.
  sql(`insert into public.fields(id,agricultural_unit_id,code,name) values
    ('${fixture.fieldA}','${ids.unitA}','QA-FA-${suffix}','Campo A ficticio'),('${fixture.fieldB}','${ids.unitB}','QA-FB-${suffix}','Campo B ficticio');
    insert into public.crops(id,code,name) values('${fixture.crop}','QA-C-${suffix}','Cultivo ficticio');
    insert into public.varieties(id,crop_id,code,name) values('${fixture.variety}','${fixture.crop}','QA-V-${suffix}','Variedad ficticia');
    insert into public.infrastructure_types(id,code,name) values('${fixture.infrastructure}','QA-I-${suffix}','Campo abierto ficticio');
    insert into public.application_methods(id,code,name) values('${fixture.method}','QA-M-${suffix}','Dron ficticio');
    insert into public.active_ingredients(id,code,name) values('${fixture.ingredient}','QA-IA-${suffix}','Ingrediente original');
    insert into public.products(id,code,name,unit,default_dose) values
    ('${fixture.productA}','QA-P1-${suffix}','Producto original','g',12),('${fixture.productB}','QA-P2-${suffix}','Producto segundo','ml',8),('${fixture.productC}','QA-P3-${suffix}','Producto nuevo','ml',4);
    insert into public.product_ingredients(product_id,active_ingredient_id,concentration) values('${fixture.productA}','${fixture.ingredient}','50 g/L');`);
  const projectB = await request('/rest/v1/rpc/create_sowing_project', adminToken, { p_data: { agricultural_unit_id: ids.unitB, name: 'Temporada B ficticia', season: `QA-${suffix}` } });
  check(projectB.status === 200 && typeof projectB.data === 'string', 'Aplicaciones: proyecto de otra agrícola preparado por RPC');
  for (const id of [projectA, projectB.data]) {
    const active = await request(`/rest/v1/sowing_projects?id=eq.${id}`, adminToken, { status: 'active' }, 'PATCH');
    check(active.status === 204, 'Aplicaciones: temporada activada por REST');
  }
  const stages = [];
  for (let i = 0; i < 3; i++) {
    const lot = await request('/rest/v1/rpc/create_project_lot', adminToken, { p_data: {
      project_id: i === 2 ? projectB.data : projectA, field_id: i === 2 ? fixture.fieldB : fixture.fieldA,
      code: `QA-L${i}-${suffix}`, name: `Lote ficticio ${i}`, area_ha: 5, infrastructure_type_id: fixture.infrastructure,
    } });
    if (lot.status !== 200 || typeof lot.data !== 'string') throw new Error('Aplicaciones: falló el alta RPC de un lote ficticio.');
    const subdivisions = await request(`/rest/v1/lot_subdivisions?lot_id=eq.${lot.data}&select=id,area_ha`, adminToken);
    if (subdivisions.status !== 200 || subdivisions.data?.length !== 1 || Number(subdivisions.data[0].area_ha) !== 5) throw new Error('Aplicaciones: la subdivisión automática no coincide.');
    const stageId = randomUUID();
    const stage = await request('/rest/v1/rpc/save_sowing_stage', adminToken, { p_data: {
      id: stageId, subdivision_id: subdivisions.data[0].id, crop_id: fixture.crop, variety_id: fixture.variety, area_ha: 5, planned_sowing_date: '2026-01-01',
    } });
    const planted = await request('/rest/v1/rpc/transition_sowing_stage', adminToken, { p_stage_id: stageId, p_status: 'planted', p_date: '2026-01-02' });
    check(stage.status === 200 && stage.data === stageId && succeeded(planted), 'Aplicaciones: etapa planeada y sembrada por RPC');
    stages.push(stageId);
  }
  const sourceText = '  Agrícola ficticia\n9na aplicación\nNota:\nMañana y tarde  ';
  const applicationNote = '  Mañana y tarde\nNota original ficticia  ';
  const data = { id: fixture.order, project_id: projectA, field_id: fixture.fieldA, crop_id: fixture.crop, method_id: fixture.method,
    indicated_date: '2026-01-03', scheduled_date: '2026-01-06', water_l_ha: 100, observations: applicationNote, source_text: sourceText, application_number: 9 };
  const mixture = [{ product_id: fixture.productA, dose: 12 }, { product_id: fixture.productB, dose: 8 }];
  const orderBody = { p_data: data, p_stage_ids: stages.slice(0, 2), p_products: mixture };
  const createOrder = await request('/rest/v1/rpc/create_application_order', adminToken, orderBody);
  check(createOrder.status === 200 && createOrder.data === fixture.order, 'Aplicaciones: orden con dos destinos creada por HTTP');
  const repeated = await request('/rest/v1/rpc/create_application_order', adminToken, orderBody);
  check(repeated.status === 200 && repeated.data === fixture.order, 'Aplicaciones: reintento de orden conserva UUID');
  const targetRows = await request(`/rest/v1/application_targets?order_id=eq.${fixture.order}&select=*`, adminToken);
  check(targetRows.status === 200 && targetRows.data?.length === 2 && targetRows.data.every((row) => row.status === 'indicated' && Number(row.area_ha) === 5), 'Aplicaciones: destinos completos persistidos y consultables por REST');
  check(targetRows.data.every((row) => row.application_number === 9), 'Captura IA: número 9 persistido por cada etapa tras relectura REST');
  const sourceOrder = await request(`/rest/v1/application_orders?id=eq.${fixture.order}&select=id,source_text,observations`, adminToken);
  check(sourceOrder.status === 200 && sourceOrder.data?.length === 1 && sourceOrder.data[0].source_text === sourceText && sourceOrder.data[0].observations === applicationNote, 'Captura IA: mensaje y nota multilínea conservados literalmente tras recarga REST');
  const duplicateId = randomUUID();
  const duplicateNumber = await request('/rest/v1/rpc/create_application_order', adminToken, { ...orderBody, p_data: { ...data, id: duplicateId } });
  const duplicateRows = await request(`/rest/v1/application_orders?id=eq.${duplicateId}&select=id`, adminToken);
  check(duplicateNumber.status >= 400 && /ya está registrada|unique/i.test(duplicateNumber.data?.message ?? '') && duplicateRows.data?.length === 0, 'Captura IA: número duplicado rechazado sin orden parcial');
  const differentSource = await request('/rest/v1/rpc/create_application_order', adminToken, { ...orderBody, p_data: { ...data, source_text: `${sourceText}\nOtra instrucción ficticia` } });
  const differentNumber = await request('/rest/v1/rpc/create_application_order', adminToken, { ...orderBody, p_data: { ...data, application_number: 10 } });
  check(differentSource.status >= 400 && differentNumber.status >= 400, 'Captura IA: UUID estable rechaza otra fuente o número');
  const targetA = targetRows.data.find((row) => row.stage_id === stages[0]);
  const targetB = targetRows.data.find((row) => row.stage_id === stages[1]);
  const direct = await request(`/rest/v1/application_targets?id=eq.${targetA.id}`, adminToken, { status: 'cancelled', cancellation_reason: 'Atajo' }, 'PATCH');
  check(direct.status === 403, 'Aplicaciones: administrador tampoco puede saltar lifecycle por PATCH');
  const denied = await request('/rest/v1/rpc/create_application_order', readerToken, orderBody);
  check(denied.status === 403, 'Aplicaciones: RPC rechaza lector con JWT real');
  const noAuth = await request('/rest/v1/application_orders?select=id');
  check(noAuth.status === 401 || noAuth.status === 403, 'Aplicaciones: REST anónimo rechazado');
  const noAuthCapture = await request('/rest/v1/rpc/create_application_order', publicKey, orderBody);
  check(noAuthCapture.status === 401 || noAuthCapture.status === 403, 'Captura IA: RPC con número, fuente y nota rechaza anónimo');
  const closePending = await request('/rest/v1/rpc/transition_sowing_stage', adminToken, { p_stage_id: stages[0], p_status: 'closed', p_date: '2026-01-10' });
  check(closePending.status >= 400, 'Aplicaciones: pendiente bloquea cierre real de etapa');
  const blankCancel = await request('/rest/v1/rpc/cancel_application_targets', adminToken, { p_order_id: fixture.order, p_target_ids: [targetA.id], p_reason: '  ' });
  check(blankCancel.status >= 400, 'Aplicaciones: cancelación exige motivo por HTTP');
  const group = await request('/rest/v1/rpc/save_sowing_group', adminToken, { p_data: { id: fixture.group, project_id: projectA, field_id: fixture.fieldA, crop_id: fixture.crop, name: 'Grupo ficticio', active: true }, p_stage_ids: stages.slice(0, 2) });
  check(group.status === 200 && group.data === fixture.group, 'Aplicaciones: agrupación manual creada por HTTP');
  const rename = await request(`/rest/v1/products?id=eq.${fixture.productA}`, adminToken, { name: 'Producto renombrado', active: false }, 'PATCH');
  const renameIngredient = await request(`/rest/v1/active_ingredients?id=eq.${fixture.ingredient}`, adminToken, { name: 'Ingrediente renombrado' }, 'PATCH');
  check(rename.status === 204 && renameIngredient.status === 204, 'Aplicaciones: catálogos originales renombrados e inactivados por REST');
  const normalData = { actual_date: '2026-01-04', equipment: 'Dron ficticio', applicator: 'Aplicador ficticio', observations: 'Realización habitual', changed: false, water_l_ha: 999, products: [] };
  const normal = await request('/rest/v1/rpc/perform_application_targets', adminToken, { p_order_id: fixture.order, p_target_ids: [targetA.id], p_data: normalData });
  check(succeeded(normal), 'Aplicaciones: realización normal acepta producto original ahora inactivo');
  const normalTarget = await request(`/rest/v1/application_targets?id=eq.${targetA.id}&select=*`, adminToken);
  const actualA = await request(`/rest/v1/application_actual_products?target_id=eq.${targetA.id}&select=*`, adminToken);
  check(normalTarget.data?.[0]?.status === 'performed' && Number(normalTarget.data[0].actual_water_l_ha) === 100 && normalTarget.data[0].has_changes === false && actualA.data?.length === 2 && actualA.data.some((row) => row.product_id === fixture.productA && Number(row.dose) === 12 && row.product_name === 'Producto original' && row.ingredients_snapshot?.[0]?.name === 'Ingrediente original'), 'Aplicaciones: servidor ignora overrides y conserva mezcla/snapshots originales');
  const changedData = { actual_date: '2026-01-05', equipment: 'Tractor ficticio', changed: true, water_l_ha: 80,
    products: [{ product_id: fixture.productA, dose: 11 }, { product_id: fixture.productC, dose: 4 }] };
  const conflict = await request('/rest/v1/rpc/perform_application_targets', adminToken, { p_order_id: fixture.order, p_target_ids: [targetA.id, targetB.id], p_data: changedData });
  const untouched = await request(`/rest/v1/application_targets?id=eq.${targetB.id}&select=status`, adminToken);
  check(conflict.status >= 400 && untouched.data?.[0]?.status === 'indicated', 'Aplicaciones: conflicto terminal revierte el lote completo de destinos');
  const changed = await request('/rest/v1/rpc/perform_application_targets', adminToken, { p_order_id: fixture.order, p_target_ids: [targetB.id], p_data: changedData });
  const changedTarget = await request(`/rest/v1/application_targets?id=eq.${targetB.id}&select=*`, adminToken);
  const indicatedProducts = await request(`/rest/v1/application_order_products?order_id=eq.${fixture.order}&select=*`, adminToken);
  const actualB = await request(`/rest/v1/application_actual_products?target_id=eq.${targetB.id}&select=*`, adminToken);
  check(succeeded(changed) && changedTarget.data?.[0]?.has_changes === true && Number(changedTarget.data[0].actual_water_l_ha) === 80 && actualB.data?.some((row) => row.product_id === fixture.productC && Number(row.dose) === 4) && indicatedProducts.data?.length === 2 && indicatedProducts.data.some((row) => row.product_id === fixture.productA && Number(row.dose) === 12), 'Aplicaciones: excepción propia del destino conserva indicación y otros destinos');
  const counts = await request(`/rest/v1/application_stage_counts?stage_id=eq.${stages[0]}&select=*`, adminToken);
  check(counts.status === 200 && Number(counts.data?.[0]?.performed_count) === 1, 'Aplicaciones: conteo REST no multiplica productos');
  const preservedNote = await request(`/rest/v1/application_orders?id=eq.${fixture.order}&select=source_text,observations`, adminToken);
  check(preservedNote.status === 200 && preservedNote.data?.[0]?.source_text === sourceText && preservedNote.data[0].observations === applicationNote && Number(counts.data[0].performed_count) === 1, 'Captura IA: número 9 no inventa ocho aplicaciones ni reescribe nota al realizar');
  const earlyClose = await request('/rest/v1/rpc/transition_sowing_stage', adminToken, { p_stage_id: stages[0], p_status: 'closed', p_date: '2026-01-03' });
  check(earlyClose.status >= 400, 'Aplicaciones: cierre no precede última realización por HTTP');
  const closed = await request('/rest/v1/rpc/transition_sowing_stage', adminToken, { p_stage_id: stages[1], p_status: 'closed', p_date: '2026-01-10' });
  const inactiveNew = await request(`/rest/v1/products?id=eq.${fixture.productC}`, adminToken, { active: false }, 'PATCH');
  const changedRetry = await request('/rest/v1/rpc/perform_application_targets', adminToken, { p_order_id: fixture.order, p_target_ids: [targetB.id], p_data: changedData });
  const retryProducts = await request(`/rest/v1/application_actual_products?target_id=eq.${targetB.id}&select=product_id`, adminToken);
  check(succeeded(closed) && inactiveNew.status === 204 && succeeded(changedRetry) && retryProducts.data?.length === 2, 'Aplicaciones: retry terminal funciona tras cierre e inactivación sin duplicados');
  const orderB = await request('/rest/v1/rpc/create_application_order', adminToken, { p_data: { ...data, id: fixture.orderB, project_id: projectB.data, field_id: fixture.fieldB }, p_stage_ids: [stages[2]], p_products: [{ product_id: fixture.productB, dose: 8 }] });
  const rowsB = await request(`/rest/v1/application_targets?order_id=eq.${fixture.orderB}&select=id`, adminToken);
  check(orderB.status === 200 && rowsB.data?.length === 1, 'Aplicaciones: orden ficticia de segunda agrícola registrada');
  const readerOrders = await request('/rest/v1/application_orders?select=id,field_name', readerToken);
  const readerTargets = await request(`/rest/v1/application_targets?order_id=eq.${fixture.orderB}&select=*`, readerToken);
  const noAccess = await request('/rest/v1/application_orders?select=id', noAccessToken);
  check(readerOrders.status === 200 && readerOrders.data?.length === 1 && readerOrders.data[0].id === fixture.order && readerTargets.status === 200 && readerTargets.data?.length === 0 && noAccess.data?.length === 0, 'Aplicaciones: RLS HTTP oculta órdenes y destinos de otra agrícola');
  const targetOther = rowsB.data[0].id;
  const foreignCancel = await request('/rest/v1/rpc/cancel_application_targets', adminToken, { p_order_id: fixture.orderB, p_target_ids: [targetOther, targetA.id], p_reason: 'No se realizará' });
  const remains = await request(`/rest/v1/application_targets?id=eq.${targetOther}&select=status`, adminToken);
  check(foreignCancel.status >= 400 && remains.data?.[0]?.status === 'indicated', 'Aplicaciones: cancelación con destino ajeno es atómica');
  const cancel = await request('/rest/v1/rpc/cancel_application_targets', adminToken, { p_order_id: fixture.orderB, p_target_ids: [targetOther], p_reason: 'No se realizará' });
  const cancelRetry = await request('/rest/v1/rpc/cancel_application_targets', adminToken, { p_order_id: fixture.orderB, p_target_ids: [targetOther], p_reason: 'No se realizará' });
  const cancelled = await request(`/rest/v1/application_targets?id=eq.${targetOther}&select=status,cancellation_reason`, adminToken);
  check(succeeded(cancel) && succeeded(cancelRetry) && cancelled.data?.[0]?.status === 'cancelled' && cancelled.data[0].cancellation_reason === 'No se realizará', 'Aplicaciones: cancelación persistida con motivo e idempotencia');
  const numberAfterCancel = await request('/rest/v1/rpc/create_application_order', adminToken, { p_data: { ...data, id: randomUUID(), project_id: projectB.data, field_id: fixture.fieldB }, p_stage_ids: [stages[2]], p_products: [{ product_id: fixture.productB, dose: 8 }] });
  check(numberAfterCancel.status >= 400 && /ya está registrada|unique/i.test(numberAfterCancel.data?.message ?? ''), 'Captura IA: número cancelado permanece reservado por etapa');
  const automaticId = randomUUID();
  const automaticOrder = await request('/rest/v1/rpc/create_application_order', adminToken, { p_data: { ...data, id: automaticId, project_id: projectB.data, field_id: fixture.fieldB, application_number: undefined }, p_stage_ids: [stages[2]], p_products: [{ product_id: fixture.productB, dose: 8 }] });
  const automaticTarget = await request(`/rest/v1/application_targets?order_id=eq.${automaticId}&select=application_number,stage_id`, adminToken);
  check(automaticOrder.status === 200 && automaticTarget.status === 200 && automaticTarget.data?.length === 1 && automaticTarget.data[0].application_number === 10 && automaticTarget.data[0].stage_id === stages[2], 'Captura IA: numeración automática continúa en 10 tras número 9 cancelado');
  const unit = await request(`/rest/v1/products?id=eq.${fixture.productA}`, adminToken, { unit: 'ml' }, 'PATCH');
  check(unit.status >= 400, 'Aplicaciones: unidad usada bloqueada también por REST');
  await verifyApplicationGroups({ request, check, adminToken, readerToken, noAccessToken, data, mixture: [{ product_id: fixture.productB, dose: 8 }], varietyId: fixture.variety, infrastructureId: fixture.infrastructure });
  console.log(`Integración aplicaciones: ${assertionCount} comprobaciones HTTP/Auth/REST aprobadas.`);
}
async function verifyApplicationChanges(adminToken, readerToken, noAccessToken, projectA) {
  const fixture = Object.fromEntries(['fieldA', 'fieldB', 'crop', 'variety', 'infrastructure', 'methodA', 'methodB', 'ingredient', 'productA', 'productB', 'productHistory', 'productNew', 'order', 'otherOrder'].map(key => [key, randomUUID()]));
  const previousAssertions = assertionCount;
  // New, fictitious fixtures belong only to this CLI project; workflow writes use RPC.
  sql(`insert into public.fields(id,agricultural_unit_id,code,name) values
    ('${fixture.fieldA}','${ids.unitA}','QA-EDIT-FA-${suffix}','Campo edición A ficticio'),('${fixture.fieldB}','${ids.unitB}','QA-EDIT-FB-${suffix}','Campo edición B ficticio');
    insert into public.crops(id,code,name) values('${fixture.crop}','QA-EDIT-C-${suffix}','Cultivo de edición ficticio');
    insert into public.varieties(id,crop_id,code,name) values('${fixture.variety}','${fixture.crop}','QA-EDIT-V-${suffix}','Variedad de edición ficticia');
    insert into public.infrastructure_types(id,code,name) values('${fixture.infrastructure}','QA-EDIT-I-${suffix}','Infraestructura de edición ficticia');
    insert into public.application_methods(id,code,name) values
    ('${fixture.methodA}','QA-EDIT-MA-${suffix}','Medio original ficticio'),('${fixture.methodB}','QA-EDIT-MB-${suffix}','Medio revisado ficticio');
    insert into public.active_ingredients(id,code,name) values('${fixture.ingredient}','QA-EDIT-IA-${suffix}','Ingrediente histórico ficticio');
    insert into public.products(id,code,name,unit,default_dose) values
    ('${fixture.productA}','QA-EDIT-P1-${suffix}','Sólido original ficticio','g',12),('${fixture.productB}','QA-EDIT-P2-${suffix}','Líquido original ficticio','ml',8),
    ('${fixture.productHistory}','QA-EDIT-P3-${suffix}','Producto histórico ficticio','g',20),('${fixture.productNew}','QA-EDIT-P4-${suffix}','Producto final ficticio','ml',4);
    insert into public.product_ingredients(product_id,active_ingredient_id,concentration) values('${fixture.productHistory}','${fixture.ingredient}','25 g/L');`);
  const otherProjects = await request(`/rest/v1/sowing_projects?agricultural_unit_id=eq.${ids.unitB}&status=eq.active&select=id`, adminToken);
  if (otherProjects.status !== 200 || otherProjects.data?.length !== 1) throw new Error('Edición: falta la temporada ficticia de segunda agrícola.');
  const projectB = otherProjects.data[0].id, stageIds = [];
  for (let index = 0; index < 5; index++) {
    const lot = await request('/rest/v1/rpc/create_project_lot', adminToken, { p_data: { project_id: index === 4 ? projectB : projectA, field_id: index === 4 ? fixture.fieldB : fixture.fieldA, code: `QA-EDIT-L${index}-${suffix}`, name: `Malla de edición ficticia ${index}`, area_ha: 2, infrastructure_type_id: fixture.infrastructure } });
    if (lot.status !== 200 || typeof lot.data !== 'string') throw new Error('Edición: falló crear lote ficticio por RPC.');
    const subdivisions = await request(`/rest/v1/lot_subdivisions?lot_id=eq.${lot.data}&select=id`, adminToken);
    if (subdivisions.status !== 200 || subdivisions.data?.length !== 1) throw new Error('Edición: subdivisión ficticia no disponible.');
    const id = randomUUID();
    const stage = await request('/rest/v1/rpc/save_sowing_stage', adminToken, { p_data: { id, subdivision_id: subdivisions.data[0].id, crop_id: fixture.crop, variety_id: fixture.variety, area_ha: 2, planned_sowing_date: '2026-01-01' } });
    const planted = await request('/rest/v1/rpc/transition_sowing_stage', adminToken, { p_stage_id: id, p_status: 'planted', p_date: '2026-01-02' });
    if (stage.status !== 200 || !succeeded(planted)) throw new Error('Edición: no se confirmó sembrar el fixture.');
    stageIds.push(id);
  }
  const originalData = { id: fixture.order, project_id: projectA, field_id: fixture.fieldA, crop_id: fixture.crop, method_id: fixture.methodA, indicated_date: '2026-01-03', scheduled_date: '2026-01-04', water_l_ha: 100, observations: '  Nota original de edición\nSegunda línea  ', source_text: 'Mensaje ficticio de edición\nAplicación 23', application_number: 23 };
  const originalProducts = [{ product_id: fixture.productA, dose: 12 }, { product_id: fixture.productB, dose: 8 }];
  const creation = await request('/rest/v1/rpc/create_application_order', adminToken, { p_data: originalData, p_stage_ids: stageIds.slice(0, 4), p_products: originalProducts });
  const originalOrder = await request(`/rest/v1/application_orders?id=eq.${fixture.order}&select=id,folio,revision,source_text,observations,water_l_ha,method_id,indicated_date,scheduled_date`, adminToken);
  const initialTargets = await request(`/rest/v1/application_targets?order_id=eq.${fixture.order}&select=*`, adminToken);
  check(creation.status === 200 && originalOrder.data?.[0]?.revision === 0 && initialTargets.data?.length === 4 && initialTargets.data.every(row => row.correction_version === 0 && row.indication_change_id === null), 'Edición: orden original y cuatro destinos parten con revisión y versiones cero');
  const targetIds = stageIds.slice(0, 4).map(stageId => initialTargets.data.find(row => row.stage_id === stageId).id);
  const originalPerformance = { p_order_id: fixture.order, p_target_ids: [targetIds[0]], p_data: { actual_date: '2026-01-05', equipment: 'Equipo original ficticio', applicator: 'Aplicador ficticio', observations: 'Realización original', changed: false } };
  const normal = await request('/rest/v1/rpc/perform_application_targets', adminToken, originalPerformance);
  const cancel = await request('/rest/v1/rpc/cancel_application_targets', adminToken, { p_order_id: fixture.order, p_target_ids: [targetIds[1]], p_reason: 'Cancelación ficticia para historial' });
  check(succeeded(normal) && succeeded(cancel), 'Edición: fixture combina un realizado, un cancelado y dos indicados');
  const baseTarget = (await request(`/rest/v1/application_targets?id=eq.${targetIds[0]}&select=*`, adminToken)).data[0];
  const baseCancelled = (await request(`/rest/v1/application_targets?id=eq.${targetIds[1]}&select=*`, adminToken)).data[0];
  const revisionId = randomUUID();
  const revision = { id: revisionId, order_id: fixture.order, expected_revision: 0, target_ids: targetIds.slice(2), method_id: fixture.methodB, indicated_date: '2026-01-04', scheduled_date: '2026-01-06', water_l_ha: 150, observations: '  Nota revisada\nSolo destinos pendientes  ', reason: 'Ajuste ficticio de la indicación pendiente' };
  const revisedProducts = [{ product_id: fixture.productHistory, dose: 20 }, { product_id: fixture.productB, dose: 9 }];
  const revise = (values, products = revisedProducts, token = adminToken) => request('/rest/v1/rpc/revise_application_order', token, { p_data: values, p_products: products });
  const correctionId = randomUUID();
  const correction = { id: correctionId, target_id: targetIds[0], expected_version: 0, actual_date: '2026-01-06', water_l_ha: 110, equipment: 'Equipo corregido ficticio', applicator: 'Aplicador corregido ficticio', observations: '  Nota real corregida\nSegunda línea  ', reason: 'Corrección ficticia de captura real' };
  const correctedProducts = [{ product_id: fixture.productA, dose: 13 }, { product_id: fixture.productB, dose: 8 }];
  const correct = (values, products = correctedProducts, token = adminToken) => request('/rest/v1/rpc/correct_application_target', token, { p_data: values, p_products: products });
  const inactive = await adminCreate(`qa-inactive-editor-${suffix}@example.invalid`, { display_name: 'Admin inactivo ficticio' });
  sql(`update public.profiles set role='admin',active=false where id='${inactive.id}';`);
  const inactiveToken = await login(inactive.email);
  for (const [token, label] of [[readerToken, 'lector'], [publicKey, 'anónimo'], [inactiveToken, 'administrador inactivo']]) {
    const deniedRevision = await revise(revision, revisedProducts, token), deniedCorrection = await correct(correction, correctedProducts, token);
    check([401, 403].includes(deniedRevision.status) && [401, 403].includes(deniedCorrection.status), `Edición: ambas RPC rechazan ${label} con autorización de servidor`);
  }
  const noReason = await revise({ ...revision, id: randomUUID(), reason: ' \n\t\r\n ' });
  const invalidRevisionDate = await revise({ ...revision, id: randomUUID(), indicated_date: '2026-1-4' });
  const partial = await revise({ ...revision, id: randomUUID(), target_ids: [targetIds[2]] });
  const terminalIncluded = await revise({ ...revision, id: randomUUID(), target_ids: targetIds.slice(1) });
  const preHistory = await request(`/rest/v1/application_changes?order_id=eq.${fixture.order}&select=id`, adminToken);
  check(noReason.status >= 400 && invalidRevisionDate.status >= 400 && partial.status >= 400 && terminalIncluded.status >= 400 && preHistory.data?.length === 0, 'Edición: motivo, fechas ISO y conjunto exacto de pendientes obligatorios, sin eventos parciales');
  const [revised, retry] = await Promise.all([revise(revision), revise(revision)]);
  const changedSameId = await revise({ ...revision, reason: 'Otra intención con UUID reutilizado' });
  const stale = await revise({ ...revision, id: randomUUID() });
  const historyColumns = 'id,order_id,target_id,kind,version,target_ids,reason,changed_by,changed_by_name,changed_at,before,after';
  const afterRevision = await request(`/rest/v1/application_targets?order_id=eq.${fixture.order}&select=*`, adminToken);
  const changes = await request(`/rest/v1/application_changes?order_id=eq.${fixture.order}&select=${historyColumns}&order=version.asc`, adminToken);
  check(revised.status === 200 && revised.data === revisionId && retry.status === 200 && retry.data === revisionId && changedSameId.status >= 400 && stale.status >= 400 && changes.data?.length === 1, 'Edición: CAS e idempotencia crean un solo evento y rechazan otra intención o revisión vencida');
  const revisionEvent = changes.data[0];
  check(revisionEvent.kind === 'indication' && revisionEvent.version === 1 && revisionEvent.target_id === null && revisionEvent.target_ids.length === 2 && revisionEvent.reason === revision.reason && revisionEvent.changed_by_name === 'QA Admin' && revisionEvent.changed_at && Number(revisionEvent.before.water_l_ha) === 100 && Number(revisionEvent.after.water_l_ha) === 150 && revisionEvent.after.observations === revision.observations && revisionEvent.after.products.some(row => row.product_id === fixture.productHistory && row.product_name === 'Producto histórico ficticio'), 'Edición: evento REST conserva antes/después, motivo, autor y nota multilínea');
  check(JSON.stringify(afterRevision.data.find(row => row.id === targetIds[0])) === JSON.stringify(baseTarget) && JSON.stringify(afterRevision.data.find(row => row.id === targetIds[1])) === JSON.stringify(baseCancelled) && afterRevision.data.filter(row => row.status === 'indicated').every(row => row.indication_change_id === revisionId), 'Edición: revisión solo cambia punteros pendientes y conserva realizado/cancelado completos');
  const signature = await request(`/rest/v1/application_changes?id=eq.${revisionId}&select=request_signature`, adminToken);
  check(signature.status === 403, 'Edición: firma privada de idempotencia no se expone por REST ni al administrador');
  const renameProduct = await request(`/rest/v1/products?id=eq.${fixture.productHistory}`, adminToken, { name: 'Producto histórico renombrado', active: false }, 'PATCH');
  const renameIngredient = await request(`/rest/v1/active_ingredients?id=eq.${fixture.ingredient}`, adminToken, { name: 'Ingrediente histórico renombrado' }, 'PATCH');
  const stalePerform = await request('/rest/v1/rpc/perform_application_targets', adminToken, { p_order_id: fixture.order, p_target_ids: [targetIds[2]], p_data: { expected_revision: 0, actual_date: '2026-01-07', equipment: 'Equipo desfasado ficticio', changed: false } });
  const pendingAfterStale = await request(`/rest/v1/application_targets?id=eq.${targetIds[2]}&select=status`, adminToken);
  check(stalePerform.status >= 400 && pendingAfterStale.data?.[0]?.status === 'indicated', 'Edición: realización con revisión desfasada se rechaza sin procesar el destino');
  const performRevised = await request('/rest/v1/rpc/perform_application_targets', adminToken, { p_order_id: fixture.order, p_target_ids: [targetIds[2]], p_data: { expected_revision: 1, actual_date: '2026-01-07', equipment: 'Equipo revisión ficticio', observations: 'Cumple revisión uno', changed: false } });
  const revisedActual = await request(`/rest/v1/application_actual_products?target_id=eq.${targetIds[2]}&select=*`, adminToken);
  const revisedTarget = await request(`/rest/v1/application_targets?id=eq.${targetIds[2]}&select=*`, adminToken);
  check(renameProduct.status === 204 && renameIngredient.status === 204 && succeeded(performRevised) && Number(revisedTarget.data?.[0]?.actual_water_l_ha) === 150 && revisedTarget.data[0].indication_change_id === revisionId && revisedTarget.data[0].has_changes === false && revisedActual.data.some(row => row.product_id === fixture.productHistory && row.product_name === 'Producto histórico ficticio' && row.ingredients_snapshot?.[0]?.name === 'Ingrediente histórico ficticio'), 'Edición: realización copia la revisión propia y snapshots aunque se renombre/inactive el catálogo');
  const secondRevisionId = randomUUID();
  const finalProducts = [{ product_id: fixture.productB, dose: 8 }, { product_id: fixture.productNew, dose: 4 }];
  const secondRevision = { ...revision, id: secondRevisionId, expected_revision: 1, target_ids: [targetIds[3]], method_id: fixture.methodA, water_l_ha: 180, observations: 'Segunda nota de indicación', reason: 'Segundo ajuste ficticio del único pendiente' };
  const staleSet = await revise({ ...secondRevision, id: randomUUID(), target_ids: targetIds.slice(2) }, finalProducts);
  const second = await revise(secondRevision, finalProducts);
  const finalTargets = await request(`/rest/v1/application_targets?order_id=eq.${fixture.order}&select=*`, adminToken);
  check(staleSet.status >= 400 && second.status === 200 && finalTargets.data.find(row => row.id === targetIds[2]).indication_change_id === revisionId && finalTargets.data.find(row => row.id === targetIds[3]).indication_change_id === secondRevisionId, 'Edición: CAS de destinos impide incluir uno ya realizado y conserva revisiones distintas por destino');
  const deniedPendingCorrection = await correct({ ...correction, id: randomUUID(), target_id: targetIds[3] });
  const deniedCancelledCorrection = await correct({ ...correction, id: randomUUID(), target_id: targetIds[1] });
  const noReasonCorrection = await correct({ ...correction, id: randomUUID(), reason: '' });
  const invalidEquipment = await correct({ ...correction, id: randomUUID(), equipment: 123 });
  const invalidCorrectionDate = await correct({ ...correction, id: randomUUID(), actual_date: '2026-1-6' });
  check(deniedPendingCorrection.status >= 400 && deniedCancelledCorrection.status >= 400 && noReasonCorrection.status >= 400 && invalidEquipment.status >= 400 && invalidCorrectionDate.status >= 400, 'Edición: corregir requiere realizado, motivo, fechas ISO y equipo textual sin cambiar estados');
  const correctionResult = await correct(correction), correctionRetry = await correct(correction);
  const correctionConflict = await correct({ ...correction, water_l_ha: 111 });
  const staleCorrection = await correct({ ...correction, id: randomUUID() });
  const correctionTarget = await request(`/rest/v1/application_targets?id=eq.${targetIds[0]}&select=*`, adminToken);
  check(correctionResult.status === 200 && correctionResult.data === correctionId && correctionRetry.status === 200 && correctionConflict.status >= 400 && staleCorrection.status >= 400 && correctionTarget.data[0].correction_version === 1 && correctionTarget.data[0].status === 'performed' && correctionTarget.data[0].has_changes === true && correctionTarget.data[0].actual_observations === correction.observations, 'Edición: corrección persistida con CAS, UUID estable, nota y estado realizado');
  const correctionEvent = await request(`/rest/v1/application_changes?id=eq.${correctionId}&select=${historyColumns}`, adminToken);
  check(correctionEvent.data?.length === 1 && correctionEvent.data[0].kind === 'performance' && correctionEvent.data[0].target_id === targetIds[0] && Number(correctionEvent.data[0].before.water_l_ha) === 100 && Number(correctionEvent.data[0].after.water_l_ha) === 110 && correctionEvent.data[0].before.equipment === 'Equipo original ficticio' && correctionEvent.data[0].after.equipment === correction.equipment, 'Edición: corrección conserva realización anterior y posterior en historial REST');
  const secondCorrection = await correct({ ...correction, id: randomUUID(), expected_version: 1, actual_date: '2026-01-06', water_l_ha: 100, equipment: 'Equipo nuevamente corregido', reason: 'Volver a la mezcla indicada, conservando historial' }, originalProducts);
  const sameMixture = await request(`/rest/v1/application_targets?id=eq.${targetIds[0]}&select=status,correction_version,has_changes`, adminToken);
  check(secondCorrection.status === 200 && sameMixture.data[0].correction_version === 2 && sameMixture.data[0].has_changes === false && sameMixture.data[0].status === 'performed', 'Edición: has_changes se recalcula contra su indicación original, sin borrar correcciones anteriores');
  const originalRetry = await request('/rest/v1/rpc/perform_application_targets', adminToken, { ...originalPerformance, p_data: { ...originalPerformance.p_data, expected_revision: 0 } });
  const afterOriginalRetry = await request(`/rest/v1/application_targets?id=eq.${targetIds[0]}&select=correction_version,equipment,actual_date`, adminToken);
  check(succeeded(originalRetry) && afterOriginalRetry.data?.[0]?.correction_version === 2 && afterOriginalRetry.data[0].equipment === 'Equipo nuevamente corregido' && afterOriginalRetry.data[0].actual_date === '2026-01-06', 'Edición: retry de realización original no deshace correcciones ni depende de revisión posterior de la orden');
  const historyRemovalCorrection = await correct({ ...correction, id: randomUUID(), target_id: targetIds[2], actual_date: '2026-01-07', water_l_ha: 160, reason: 'Retirar producto de la realización manteniendo su historia' }, finalProducts);
  const historyOnlyProducts = await request(`/rest/v1/application_change_products?product_id=eq.${fixture.productHistory}&select=change_id,phase,product_id,snapshot`, adminToken);
  const removeHistoryProduct = await request(`/rest/v1/products?id=eq.${fixture.productHistory}`, adminToken, undefined, 'DELETE');
  check(historyRemovalCorrection.status === 200 && historyOnlyProducts.status === 200 && historyOnlyProducts.data.length > 0 && historyOnlyProducts.data.some(row => row.snapshot.product_name === 'Producto histórico ficticio') && removeHistoryProduct.status >= 400, 'Edición: producto retirado de valores actuales sigue protegido por referencias históricas y snapshot');
  const finalOrder = await request(`/rest/v1/application_orders?id=eq.${fixture.order}&select=id,folio,revision,source_text,observations,water_l_ha,method_id,indicated_date,scheduled_date`, adminToken);
  const counts = await request(`/rest/v1/application_stage_counts?stage_id=in.(${stageIds.slice(0, 4).join(',')})&select=*`, adminToken);
  const latestTargets = await request(`/rest/v1/application_targets?order_id=eq.${fixture.order}&select=id,stage_id,application_number,status`, adminToken);
  check(finalOrder.data?.[0]?.revision === 2 && JSON.stringify({ ...finalOrder.data[0], revision: 0 }) === JSON.stringify(originalOrder.data[0]) && latestTargets.data.length === 4 && latestTargets.data.every(row => row.application_number === 23 && targetIds.includes(row.id)) && counts.data.every(row => Number(row.indicated_count) + Number(row.performed_count) + Number(row.cancelled_count) === 1), 'Edición: identidad, número por etapa, fuente, orden original y conteos se conservan tras revisiones/correcciones');
  for (const [table, body] of [['application_changes', { id: randomUUID(), order_id: fixture.order, kind: 'indication' }], ['application_change_products', { change_id: revisionId, phase: 'after', product_id: fixture.productA }]]) {
    const insert = await request(`/rest/v1/${table}`, adminToken, body);
    const update = await request(`/rest/v1/${table}?${table === 'application_changes' ? `id=eq.${revisionId}` : `change_id=eq.${revisionId}`}`, adminToken, table === 'application_changes' ? { reason: 'Atajo prohibido' } : { snapshot: {} }, 'PATCH');
    const remove = await request(`/rest/v1/${table}?${table === 'application_changes' ? `id=eq.${revisionId}` : `change_id=eq.${revisionId}`}`, adminToken, undefined, 'DELETE');
    check(insert.status === 403 && update.status === 403 && remove.status === 403, `Edición: ${table} rechaza DML directo incluso de administrador`);
  }
  const otherCreation = await request('/rest/v1/rpc/create_application_order', adminToken, { p_data: { ...originalData, id: fixture.otherOrder, project_id: projectB, field_id: fixture.fieldB }, p_stage_ids: [stageIds[4]], p_products: originalProducts });
  const otherTarget = await request(`/rest/v1/application_targets?order_id=eq.${fixture.otherOrder}&select=id`, adminToken);
  const otherRevisionId = randomUUID();
  const otherRevision = await revise({ ...revision, id: otherRevisionId, order_id: fixture.otherOrder, target_ids: [otherTarget.data[0].id] }, finalProducts);
  const ownHistory = await request(`/rest/v1/application_changes?order_id=eq.${fixture.order}&select=${historyColumns}`, readerToken);
  const hiddenHistory = await request(`/rest/v1/application_changes?order_id=eq.${fixture.otherOrder}&select=${historyColumns}`, readerToken);
  const hiddenProducts = await request(`/rest/v1/application_change_products?change_id=eq.${otherRevisionId}&select=change_id,phase,product_id,snapshot`, readerToken);
  const noAccessHistory = await request('/rest/v1/application_changes?select=id', noAccessToken);
  const inactiveHistory = await request('/rest/v1/application_changes?select=id', inactiveToken);
  const anonHistory = await request('/rest/v1/application_changes?select=id');
  check(otherCreation.status === 200 && otherRevision.status === 200 && ownHistory.status === 200 && ownHistory.data.length === 5 && hiddenHistory.data?.length === 0 && hiddenProducts.data?.length === 0 && noAccessHistory.data?.length === 0 && inactiveHistory.data?.length === 0 && [401, 403].includes(anonHistory.status), 'Edición: RLS real limita eventos/productos históricos por agrícola y sesión activa');
  console.log(`Integración edición: ${assertionCount - previousAssertions} comprobaciones HTTP/Auth/REST/RLS nuevas aprobadas.`);
}
async function verifyProductSynonyms(adminToken, readerToken, noAccessToken) {
  const previousAssertions = assertionCount;
  let productSequence = 0;
  const productData = (name, synonyms) => ({
    code: `QA-SN-${suffix}-${++productSequence}`, name, unit: 'ml', default_dose: 7, active: true,
    ...(synonyms === undefined ? {} : { synonyms }),
  });
  const save = (data, token = adminToken, ingredients = []) => request('/rest/v1/rpc/save_product', token, { p_data: data, p_ingredients: ingredients });
  const readAliases = (id, token = adminToken) => request(`/rest/v1/product_synonyms?product_id=eq.${id}&select=id,product_id,name,normalized_name,created_by,created_at&order=normalized_name.asc`, token);
  const readProduct = (id) => request(`/rest/v1/products?id=eq.${id}&select=id,code,name,unit,default_dose,active`, adminToken);
  const create = async (data) => {
    const result = await save(data);
    if (result.status !== 200 || typeof result.data !== 'string') throw new Error('Sinónimos: no se pudo crear un producto ficticio por RPC.');
    return { ...data, id: result.data };
  };
  const primary = await create(productData('Estelar mezcla QA', ['  ÁLGA+Plús  ', 'ZEQ', 'WexA', 'abcdefghijklm']));
  const secondary = await create(productData('Júpiter micronutriente QA'));
  const inactive = await create({ ...productData('Reserva inactiva QA', ['Cobalto vital']), active: false });
  const firstAliases = await readAliases(primary.id);
  check(firstAliases.status === 200 && firstAliases.data.length === 4 && firstAliases.data.some(row => row.name === 'ÁLGA+Plús' && row.normalized_name === 'algaplus') && firstAliases.data.every(row => row.id && row.product_id === primary.id && row.created_by && row.created_at), 'Sinónimos: RPC conserva nombre legible, normalización compacta y procedencia por REST');

  const preserved = await save({ ...primary, synonyms: undefined, default_dose: 9 });
  const afterOmission = await readAliases(primary.id);
  check(preserved.status === 200 && JSON.stringify(afterOmission.data) === JSON.stringify(firstAliases.data), 'Sinónimos: omitir el campo conserva aliases e identidad de sus registros');
  const activeReaders = await Promise.all([readAliases(primary.id, readerToken), readAliases(primary.id, noAccessToken)]);
  const inactiveAliases = await readAliases(inactive.id, readerToken);
  check(activeReaders.every(result => result.status === 200 && result.data.length === 4) && inactiveAliases.status === 200 && inactiveAliases.data.length === 1, 'Sinónimos: catálogos comunes se leen por usuarios activos incluso sin agrícola asignada o producto inactivo');
  const inactiveUser = await adminCreate(`qa-synonyms-inactive-${suffix}@example.invalid`);
  const inactiveToken = await login(inactiveUser.email);
  sql(`update public.profiles set role='admin',active=false where id='${inactiveUser.id}';`);
  const deniedReads = await Promise.all([readAliases(primary.id, publicKey), readAliases(primary.id, inactiveToken)]);
  check([401, 403].includes(deniedReads[0].status) && deniedReads[1].status === 200 && deniedReads[1].data.length === 0, 'Sinónimos: anónimo y JWT de perfil desactivado no revelan filas');
  const deniedWrites = await Promise.all([
    save({ ...secondary, synonyms: ['Prohibido lector'] }, readerToken),
    save({ ...secondary, synonyms: ['Prohibido anónimo'] }, publicKey),
    save({ ...secondary, synonyms: ['Prohibido inactivo'] }, inactiveToken),
  ]);
  check(deniedWrites.every(result => [401, 403].includes(result.status)), 'Sinónimos: RPC exige administrador activo con Auth real');
  const firstAlias = firstAliases.data[0];
  const directInsert = await request('/rest/v1/product_synonyms', adminToken, { product_id: secondary.id, name: 'Atajo ficticio' });
  const directUpdate = await request(`/rest/v1/product_synonyms?id=eq.${firstAlias.id}`, adminToken, { name: 'Atajo ficticio' }, 'PATCH');
  const directDelete = await request(`/rest/v1/product_synonyms?id=eq.${firstAlias.id}`, adminToken, undefined, 'DELETE');
  check(directInsert.status === 403 && directUpdate.status === 403 && directDelete.status === 403, 'Sinónimos: tabla rechaza INSERT/PATCH/DELETE directos incluso al administrador');

  const invalidAliases = [null, 'No es lista', [123], ['a'], ['x'.repeat(81)], ['---'], ['Duplicado útil', 'duplicado-util'], [primary.name], [primary.code], Array.from({ length: 21 }, () => randomUUID())];
  const rejectedLimits = [];
  for (const synonyms of invalidAliases) rejectedLimits.push(await save({ ...primary, default_dose: 999, synonyms }));
  const afterInvalid = await readAliases(primary.id), unchangedPrimary = await readProduct(primary.id);
  check(rejectedLimits.every(result => result.status >= 400) && Number(unchangedPrimary.data[0].default_dose) === 9 && JSON.stringify(afterInvalid.data) === JSON.stringify(firstAliases.data), 'Sinónimos: límites, tipos, vacíos y duplicados propios se rechazan con rollback de producto y aliases');

  const conflictTerms = ['algá plus', primary.name, primary.code, 'Algaplus eco', 'Xalgaplus', 'algaplut', 'WexB', 'abcxefghijylm', inactive.name, inactive.code, 'Cobalto vital'];
  const conflictResults = [];
  for (const alias of conflictTerms) conflictResults.push(await save({ ...secondary, default_dose: 999, synonyms: [alias] }));
  const unchangedSecondary = await readProduct(secondary.id), noSecondaryAliases = await readAliases(secondary.id);
  check(conflictResults.every(result => result.status >= 400) && Number(unchangedSecondary.data[0].default_dose) === 7 && noSecondaryAliases.data.length === 0, 'Sinónimos: bloquea equivalencias, prefijos y distancia por nombre/código/alias, incluidos inactivos, sin cambios parciales');
  const shortAllowed = await save({ ...secondary, synonyms: ['ZEP', 'ZEQP'] });
  const shortAliases = await readAliases(secondary.id);
  check(shortAllowed.status === 200 && shortAliases.data.length === 2, 'Sinónimos: términos cortos distintos solo se comparan por igualdad exacta');
  const shortExact = await save({ ...secondary, synonyms: ['z-e-q'] });
  check(shortExact.status >= 400 && (await readAliases(secondary.id)).data.length === 2, 'Sinónimos: igualdad compacta de un término corto también se bloquea');

  const inverseName = await save({ ...secondary, name: 'ALGÁ PLUS', synonyms: undefined });
  const inverseCode = await save({ ...secondary, code: 'Cobalto-vital', synonyms: undefined });
  const directName = await request(`/rest/v1/products?id=eq.${secondary.id}`, adminToken, { name: 'Algaplut' }, 'PATCH');
  const directCode = await request(`/rest/v1/products?id=eq.${secondary.id}`, adminToken, { code: 'Algaplus eco' }, 'PATCH');
  check(inverseName.status >= 400 && inverseCode.status >= 400 && directName.status >= 400 && directCode.status >= 400 && (await readProduct(secondary.id)).data[0].name === secondary.name, 'Sinónimos: control inverso protege nombres/códigos por RPC y PATCH directo');
  const officialLegacyA = await create(productData('Producto legado turquesa'));
  const officialLegacyB = await create(productData('Producto legado turquese'));
  check(officialLegacyA.id !== officialLegacyB.id, 'Sinónimos: nombres oficiales parecidos entre sí continúan permitidos sin aliases en conflicto');

  const maxAliases = Array.from({ length: 20 }, () => `QA${randomUUID().replaceAll('-', '')}${randomUUID().replaceAll('-', '')}${randomUUID().slice(0, 14)}`);
  const boundaryData = productData('Límites de aliases QA', maxAliases);
  const boundary = await create(boundaryData);
  const boundaryAliases = await readAliases(boundary.id);
  check(maxAliases.every(name => name.length === 80) && boundaryAliases.data.length === 20 && boundaryAliases.data.every(row => maxAliases.includes(row.name)), 'Sinónimos: acepta veinte aliases de ochenta caracteres sin truncarlos');
  const twoCharacter = await save({ ...boundary, synonyms: ['QX'] });
  check(twoCharacter.status === 200 && (await readAliases(boundary.id)).data[0].name === 'QX', 'Sinónimos: acepta el límite inferior de dos caracteres');
  const cleared = await save({ ...secondary, synonyms: [] });
  check(cleared.status === 200 && (await readAliases(secondary.id)).data.length === 0, 'Sinónimos: lista vacía borra explícitamente los aliases del producto');

  const raceA = await create(productData('Identidad concurrente mercurio QA'));
  const raceB = await create(productData('Identidad concurrente saturno QA'));
  const race = await Promise.all([
    save({ ...raceA, default_dose: 11, synonyms: ['Hidrógeno lunar'] }),
    save({ ...raceB, default_dose: 12, synonyms: ['Hidrogeno lunax'] }),
  ]);
  const raceAliases = await request(`/rest/v1/product_synonyms?product_id=in.(${raceA.id},${raceB.id})&select=product_id,name`, adminToken);
  const raceProducts = await Promise.all([readProduct(raceA.id), readProduct(raceB.id)]);
  check(race.filter(succeeded).length === 1 && race.filter(result => result.status >= 400).length === 1 && raceAliases.data.length === 1 && raceProducts.every((result, index) => Number(result.data[0].default_dose) === (succeeded(race[index]) ? index === 0 ? 11 : 12 : 7)), 'Sinónimos: carrera HTTP serializa un único propietario y revierte íntegro al competidor');
  console.log(`Integración sinónimos: ${assertionCount - previousAssertions} comprobaciones HTTP/Auth/REST/RLS nuevas aprobadas.`);
}
async function verifyApplicationImage(adminToken,readerToken,noAccessToken,readerId) {
  const tag=randomUUID().slice(0,8), fixture=Object.fromEntries(['unit','field','crop','variety','infra','method','mass','volume'].map(key=>[key,randomUUID()]));
  const rpc=(name,body,token=adminToken)=>request('/rest/v1/rpc/'+name,token,body);
  const read=(path,token=adminToken)=>request('/rest/v1/'+path,token);
  for(const [table,body] of [
    ['agricultural_units',{id:fixture.unit,code:`IMG-${tag}`,name:`Agrícola imagen ficticia ${tag}`}],
    ['fields',{id:fixture.field,agricultural_unit_id:fixture.unit,code:`IMG-${tag}`,name:'Campo de imagen ficticio'}],
    ['crops',{id:fixture.crop,code:`IMG-${tag}`,name:`Cultivo de imagen ${tag}`}],
    ['varieties',{id:fixture.variety,crop_id:fixture.crop,code:`IMG-${tag}`,name:`Variedad de imagen ${tag}`}],
    ['infrastructure_types',{id:fixture.infra,code:`IMG-${tag}`,name:`Infraestructura imagen ${tag}`}],
    ['application_methods',{id:fixture.method,code:`IMG-${tag}`,name:`Medio imagen ${tag}`}],
    ['products',{id:fixture.mass,code:`IMG-M-${tag}`,name:`Producto masa imagen ${tag}`,unit:'g',default_dose:1}],
    ['products',{id:fixture.volume,code:`IMG-V-${tag}`,name:`Producto volumen imagen ${tag}`,unit:'ml',default_dose:1}],
  ]) check(succeeded(await request('/rest/v1/'+table,adminToken,body)),`Imagen: fixture ${table} creado por REST solo en QA`);
  const projectRow=await rpc('create_sowing_project',{p_data:{agricultural_unit_id:fixture.unit,name:'Temporada imagen ficticia',season:`QA-${tag}`}});
  check(projectRow.status===200&&typeof projectRow.data==='string','Imagen: proyecto de QA creado por RPC');
  const projectId=projectRow.data;
  check(succeeded(await request(`/rest/v1/sowing_projects?id=eq.${projectId}`,adminToken,{status:'active'},'PATCH')),'Imagen: temporada de QA activa');
  const imageAssignments=(await request(`/rest/v1/user_agricultural_units?user_id=eq.${readerId}&select=agricultural_unit_id`,adminToken)).data;
  check(succeeded(await request('/rest/v1/rpc/set_user_access',adminToken,{p_user_id:readerId,p_role:'viewer',p_active:true,p_agricultural_unit_ids:[...imageAssignments.map(row=>row.agricultural_unit_id),fixture.unit]})),'Imagen: lector ficticio asignado a agrícola del caso');
  const stages=[],lots=[];
  for(const [index,area] of [12,2].entries()) {
    const lot=await rpc('create_project_lot',{p_data:{project_id:projectId,field_id:fixture.field,code:`IMAGE-${index}`,name:`Malla imagen ficticia ${index}`,area_ha:area,infrastructure_type_id:fixture.infra}});
    check(lot.status===200,'Imagen: malla con superficie propia creada');lots.push(lot.data);
    const subs=await read(`lot_subdivisions?lot_id=eq.${lot.data}&select=id`), stageId=randomUUID();
    check(subs.status===200&&subs.data?.length===1,'Imagen: subdivisión completa identificada');
    check(succeeded(await rpc('save_sowing_stage',{p_data:{id:stageId,subdivision_id:subs.data[0].id,crop_id:fixture.crop,variety_id:fixture.variety,area_ha:area,planned_sowing_date:'2026-01-01'}}))&&succeeded(await rpc('transition_sowing_stage',{p_stage_id:stageId,p_status:'planted',p_date:'2026-01-02'})),'Imagen: etapa de doce o dos hectáreas sembrada por RPC');
    stages.push(stageId);
  }
  const source={kind:'image_totals',area_ha:14,products:[
    {product_id:fixture.mass,source_name:'  Alias OCR masa ficticio  ',presentation:'Bolsa de 1 kg',quantity:28,unit:'kg'},
    {product_id:fixture.volume,source_name:'Alias OCR volumen ficticio',presentation:'Envase 20 L',quantity:1,unit:'L'},
  ]};
  const sourceText='  OCR ficticio\nContexto de dos mallas revisado  ';
  const data={id:randomUUID(),project_id:projectId,field_id:fixture.field,crop_id:fixture.crop,method_id:fixture.method,indicated_date:'2026-01-03',scheduled_date:'2026-01-04',water_l_ha:660,observations:'Nota de imagen ficticia',source_text:sourceText,source_capture:source};
  const products=[{product_id:fixture.mass,dose:2000},{product_id:fixture.volume,dose:71.428571}];
  const body={p_data:data,p_stage_ids:stages,p_products:products};
  const denied=await rpc('create_application_order',body,readerToken),anonymous=await request('/rest/v1/rpc/create_application_order',undefined,body);
  check(denied.status===403&&[401,403].includes(anonymous.status),'Imagen: lector y anónimo no crean captura');
  const [first,retry]=await Promise.all([rpc('create_application_order',body),rpc('create_application_order',body)]);
  check(first.status===200&&retry.status===200&&first.data===data.id&&retry.data===data.id,'Imagen: doble envío concurrente retorna una sola orden');
  const targetRows=await read(`application_targets?order_id=eq.${data.id}&select=id,stage_id,area_ha`);
  const productRows=await read(`application_order_products?order_id=eq.${data.id}&select=product_id,dose,unit`);
  check(targetRows.status===200&&targetRows.data?.length===2&&targetRows.data.reduce((sum,t)=>sum+Number(t.area_ha),0)===14,'Imagen: dos etapas completas suman catorce hectáreas sin duplicarse');
  check(productRows.status===200&&productRows.data?.length===2&&Number(productRows.data.find(p=>p.product_id===fixture.mass)?.dose)===2000&&Number(productRows.data.find(p=>p.product_id===fixture.volume)?.dose)===71.428571,'Imagen: backend persiste conversión de totales kg/L con seis decimales');
  const stored=await read(`application_orders?id=eq.${data.id}&select=source_capture,source_text,observations`);
  const storedMass=stored.data?.[0]?.source_capture?.products?.find(p=>p.product_id===fixture.mass);
  check(stored.status===200&&stored.data?.[0]?.source_text===sourceText&&stored.data[0].source_capture.area_ha===14&&storedMass?.source_name===source.products[0].source_name&&storedMass?.presentation==='Bolsa de 1 kg'&&storedMass?.quantity===28,'Imagen: relectura conserva metadatos y texto OCR literal');
  check((await request(`/rest/v1/application_orders?id=eq.${data.id}`,adminToken,{source_capture:null},'PATCH')).status===403,'Imagen: escritura directa no altera fuente original');
  check((await read(`application_orders?id=eq.${data.id}&select=source_capture`,readerToken)).data?.[0]?.source_capture?.kind==='image_totals'&&(await read(`application_orders?id=eq.${data.id}&select=source_capture`,noAccessToken)).data?.length===0,'Imagen: RLS permite lector asignado y oculta fuente ajena');
  const invalid=await rpc('create_application_order',{...body,p_data:{...data,id:randomUUID()},p_products:products.map(p=>({...p,dose:p.dose+0.000001}))});
  check(invalid.status>=400,'Imagen: servidor rechaza dosis manipuladas por cliente');
  const changedSource=structuredClone(source);changedSource.products[0].presentation='Otro envase';
  check((await rpc('create_application_order',{...body,p_data:{...data,source_capture:changedSource}})).status>=400,'Imagen: UUID idéntico rechaza evidencia original diferente');
  const extra=await rpc('create_application_order',{...body,p_data:{...data,id:randomUUID(),source_capture:{...source,image_url:'https://example.invalid/image.png'}}});
  check(extra.status>=400,'Imagen: metadatos no admiten URL de archivo ni campos extra');
  const corrected=await rpc('correct_project_lot',{p_data:{id:randomUUID(),lot_id:lots[0],expected_version:0,name:'Malla imagen corregida',area_ha:11,stage_id:stages[0],planned_sowing_date:'2026-01-01',actual_sowing_date:'2026-01-02',reason:'Corrección ficticia de superficie'}});
  check(corrected.status===200,'Imagen: corrección de superficie se confirma por RPC existente');
  const afterArea=await read(`application_orders?id=eq.${data.id}&select=source_capture`);
  check(afterArea.data?.[0]?.source_capture?.area_ha===14&&(await rpc('create_application_order',body)).status===200,'Imagen: fuente histórica y reintento se conservan tras cambio de área');
  const staleId=randomUUID(),stale=await rpc('create_application_order',{...body,p_data:{...data,id:staleId}});
  check(stale.status>=400&&/superficie.*cambió/i.test(stale.data?.message??'')&&(await read(`application_orders?id=eq.${staleId}&select=id`)).data?.length===0,'Imagen: área actual trece rechaza formulario previo de catorce sin fila parcial');
  const recalculated=await rpc('create_application_order',{...body,p_data:{...data,id:staleId,source_capture:{...source,area_ha:13}},p_products:[{product_id:fixture.mass,dose:2153.846154},{product_id:fixture.volume,dose:76.923077}]});
  check(recalculated.status===200,'Imagen: recalcular con área actual permite guardar');
  const revised=await rpc('revise_application_order',{p_data:{id:randomUUID(),order_id:data.id,expected_revision:0,target_ids:targetRows.data.map(t=>t.id),method_id:fixture.method,indicated_date:data.indicated_date,scheduled_date:data.scheduled_date,water_l_ha:650,observations:'Nota revisada de imagen',reason:'Revisión ficticia'},p_products:[{product_id:fixture.mass,dose:1},{product_id:fixture.volume,dose:2}]});
  const afterRevision=await read(`application_orders?id=eq.${data.id}&select=revision,source_capture`);
  check(revised.status===200&&afterRevision.data?.[0]?.revision===1&&afterRevision.data[0].source_capture.area_ha===14,'Imagen: revisión de indicación conserva evidencia original');
  const performed=await rpc('perform_application_targets',{p_order_id:data.id,p_target_ids:[targetRows.data[0].id],p_data:{actual_date:'2026-01-04',changed:false,expected_revision:1}});
  const correction=await rpc('correct_application_target',{p_data:{id:randomUUID(),target_id:targetRows.data[0].id,expected_version:0,actual_date:'2026-01-05',water_l_ha:650,equipment:'Equipo ficticio',applicator:'',observations:'Nota real corregida',reason:'Corrección ficticia'},p_products:[{product_id:fixture.mass,dose:3}]});
  const afterPerformance=await read(`application_orders?id=eq.${data.id}&select=source_capture,source_text`);
  check(succeeded(performed)&&correction.status===200&&afterPerformance.data?.[0]?.source_capture?.area_ha===14&&afterPerformance.data[0].source_text===sourceText,'Imagen: realización y su corrección conservan origen y OCR originales');
}
try {
  const admin = await adminCreate(`qa-admin-${suffix}@example.invalid`, { display_name: 'QA Admin', role: 'admin' });
  const reader = await adminCreate(`qa-reader-${suffix}@example.invalid`, { display_name: 'QA Lector' });
  const unassigned = await adminCreate(`qa-unassigned-${suffix}@example.invalid`);
  sql(`update public.profiles set role='admin' where id='${admin.id}';
    update public.profiles set menu_permissions=array_remove(array_remove(array_remove(rcfito_private.menu_keys(),'ai_capture'),'users'),'connection') where role='viewer';
    insert into public.agricultural_units(id,code,name) values ('${ids.unitA}','QA-A-${suffix}','Agrícola A ficticia'),('${ids.unitB}','QA-B-${suffix}','Agrícola B ficticia');
    insert into public.user_agricultural_units(user_id,agricultural_unit_id) values('${reader.id}','${ids.unitA}');`);
  const adminToken = await login(admin.email);
  const readerToken = await login(reader.email);
  const noAccessToken = await login(unassigned.email);
  const ownUnits = await request('/rest/v1/agricultural_units?select=id,name', readerToken);
  assert(ownUnits.status === 200 && ownUnits.data.length === 1 && ownUnits.data[0].id === ids.unitA, 'REST limita agrícolas al lector asignado');
  const other = await request(`/rest/v1/agricultural_units?id=eq.${ids.unitB}&select=id,name`, readerToken);
  assert(other.status === 200 && other.data.length === 0, 'Filtro directo no revela otra agrícola');
  const noUnits = await request('/rest/v1/agricultural_units?select=id', noAccessToken);
  assert(noUnits.status === 200 && noUnits.data.length === 0, 'Cuenta sin asignaciones no ve agrícolas');
  const write = await request('/rest/v1/crops', readerToken, { code: `BAD-${suffix}`, name: 'No permitido' });
  assert(write.status === 403, 'REST rechaza escritura de lector');
  const rpcDenied = await request('/rest/v1/rpc/create_sowing_project', readerToken, { p_data: { agricultural_unit_id: ids.unitA, name: 'No permitido', season: 'QA' } });
  assert(rpcDenied.status === 403, 'RPC verifica administrador con JWT real');
  const create = await request('/rest/v1/rpc/create_sowing_project', adminToken, { p_data: { agricultural_unit_id: ids.unitA, name: 'Temporada QA', season: `QA-${suffix}` } });
  assert(create.status === 200 && typeof create.data === 'string', 'RPC real crea proyecto en borrador sin fecha oculta obligatoria');
  const duplicate = await request('/rest/v1/rpc/create_sowing_project', adminToken, { p_data: { agricultural_unit_id: ids.unitA, name: 'Otra', season: `NEXT-${suffix}` } });
  assert(duplicate.status >= 400, 'RPC real bloquea segunda temporada capturable');
  const badIdentity = await request('/functions/v1/admin-create-user', 'invalid-token', {});
  assert(badIdentity.status === 401, 'Función privada rechaza token inválido');
  const readerCreate = await request('/functions/v1/admin-create-user', readerToken, {});
  assert(readerCreate.status === 403, 'Función privada rechaza lector');
  const account = await request('/functions/v1/admin-create-user', adminToken, {
    email: `qa-created-${suffix}@example.invalid`, password, display_name: 'Usuario creado por QA', role: 'viewer', agricultural_unit_ids: [ids.unitA],
  });
  assert(account.status === 201 && account.data?.id, 'Función privada crea cuenta y asigna agrícolas con administrador real');
  const createdToken = await login(`qa-created-${suffix}@example.invalid`);
  const createdUnits = await request('/rest/v1/agricultural_units?select=id', createdToken);
  assert(createdUnits.status === 200 && createdUnits.data.length === 1 && createdUnits.data[0].id === ids.unitA, 'La cuenta creada consulta solo la agrícola asignada');
  const limitedEmail=`qa-menu-${suffix}@example.invalid`;
  const limited=await request('/functions/v1/admin-create-user',adminToken,{email:limitedEmail,password,display_name:'Consulta limitada ficticia',role:'viewer',agricultural_unit_ids:[ids.unitA],menu_permissions:['queries']});
  check(limited.status===201,'Menús: alta privada acepta permisos seleccionados');
  const limitedToken=await login(limitedEmail);
  const limitedProfile=await request(`/rest/v1/profiles?id=eq.${limited.data.id}&select=role,menu_permissions,access_version`,limitedToken);
  check(limitedProfile.status===200&&limitedProfile.data[0].role==='viewer'&&JSON.stringify(limitedProfile.data[0].menu_permissions)==='["queries"]'&&limitedProfile.data[0].access_version===1,'Menús: cuenta nueva conserva rol y selección exacta');
  check((await request('/rest/v1/agricultural_units?select=id',limitedToken)).data.length===0&&(await request('/rest/v1/rpc/menu_reference_catalogs',limitedToken,{})).data.agricultural_units.length===1,'Menús: alta limitada obtiene referencias asignadas sin catálogo completo');
  await verifyApplications(adminToken, readerToken, noAccessToken, create.data);
  await verifyApplicationChanges(adminToken, readerToken, noAccessToken, create.data);
  await verifyApplicationQueries({ request, check, adminToken, readerToken, noAccessToken, readerId: reader.id, unitA: ids.unitA, unitB: ids.unitB, projectA: create.data, base, publicKey });
  await verifyProductSynonyms(adminToken, readerToken, noAccessToken);
  const classificationId = randomUUID(), classifiedIngredientId = randomUUID();
  const classification = { id: classificationId, code: `QA-CLASS-${suffix}`, name: `Clasificación ficticia ${suffix}` };
  check((await request('/rest/v1/ingredient_classifications', adminToken, classification)).status === 201, 'Clasificaciones: administrador crea por REST');
  check((await request('/rest/v1/active_ingredients', adminToken, { id: classifiedIngredientId, code: `QA-CLASS-ING-${suffix}`, name: `Ingrediente clasificado ${suffix}`, classification_id: classificationId })).status === 201, 'Clasificaciones: ingrediente guarda relación por REST');
  const classifiedRead = await request(`/rest/v1/active_ingredients?id=eq.${classifiedIngredientId}&select=classification_id`, adminToken);
  check(classifiedRead.status === 200 && classifiedRead.data?.[0]?.classification_id === classificationId, 'Clasificaciones: relectura conserva relación');
  check((await request(`/rest/v1/ingredient_classifications?id=eq.${classificationId}&select=id`, readerToken)).data?.length === 1, 'Clasificaciones: lector consulta catálogo común');
  check((await request('/rest/v1/ingredient_classifications', readerToken, { code: `QA-DENIED-${suffix}`, name: 'No permitido' })).status === 403, 'Clasificaciones: lector no escribe');
  check((await request('/rest/v1/ingredient_classifications?select=id')).status === 401, 'Clasificaciones: acceso anónimo rechazado');
  check((await request(`/rest/v1/ingredient_classifications?id=eq.${classificationId}`, adminToken, { active: false }, 'PATCH')).status === 204, 'Clasificaciones: baja lógica conserva registros');
  check((await request(`/rest/v1/active_ingredients?id=eq.${classifiedIngredientId}`, adminToken, { name: `Ingrediente corregido ${suffix}`, classification_id: classificationId }, 'PATCH')).status === 204, 'Clasificaciones: edición conserva relación inactiva existente');
  check((await request('/rest/v1/active_ingredients', adminToken, { code: `QA-BAD-CLASS-${suffix}`, name: `Ingrediente no válido ${suffix}`, classification_id: classificationId })).status >= 400, 'Clasificaciones: otra relación con opción inactiva se rechaza');
  check((await request(`/rest/v1/ingredient_classifications?id=eq.${classificationId}`, adminToken, undefined, 'DELETE')).status === 409, 'Clasificaciones: FK protege eliminación relacionada');
  check((await request(`/rest/v1/active_ingredients?id=eq.${classifiedIngredientId}`, adminToken, { classification_id: null }, 'PATCH')).status === 204, 'Clasificaciones: administrador puede retirar relación');
  check((await request(`/rest/v1/ingredient_classifications?id=eq.${classificationId}`, adminToken, undefined, 'DELETE')).status === 204, 'Clasificaciones: eliminación libre confirmada');

  await verifyLotCorrections({ request, check, adminToken, readerToken, noAccessToken, readerId: reader.id });
  await verifyApplicationImage(adminToken,readerToken,noAccessToken,reader.id);
  await verifyApplicationRoutes({request,check,adminToken,readerToken});
  await verifyMenuPermissions({request,check,adminToken,readerToken,readerId:reader.id,unitA:ids.unitA,base,publicKey});
  sql(`update public.profiles set active=false where id='${reader.id}';`);
  const revoked = await request('/rest/v1/agricultural_units?select=id', readerToken);
  assert(revoked.status === 200 && revoked.data.length === 0, 'Desactivación bloquea JWT de lector ya emitido');
  if (process.argv.includes('--advisors')) {
    // The CLI may send its human-readable result to stderr and leave stdout empty.
    // Its documented fail-on boundary gives a stable signal without logging either stream.
    cli(['db', 'advisors', '--local', '--type', 'security', '--level', 'warn', '--fail-on', 'warn']);
    console.log('Advisors de seguridad local: exit 0 con --fail-on warn; sin hallazgos WARN/ERROR.');
  }
  console.log('Integración Auth/REST/Edge/RLS verificada; credenciales de prueba no se escribieron ni imprimieron.');
} finally {
  // Keep the isolated stack for parent browser QA unless --cleanup was requested.
  if (process.argv.includes('--cleanup')) {
    cli(['stop', '--no-backup']);
    console.log('Stack de integración detenido y datos ficticios eliminados.');
  } else console.log('Stack aislado sigue disponible solo para QA local en 127.0.0.1:55441.');
}
