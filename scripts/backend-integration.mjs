import { spawnSync } from 'node:child_process';
import { randomUUID, randomBytes } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const workdir = resolve(root, '.artifacts/supabase-integration');
const npmCli = resolve(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js');
const project = 'rcfito-local-test';
const databaseContainer = `supabase_db_${project}`;
function cli(args) {
  const result = process.platform === 'win32'
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
  console.log(`Integración aplicaciones: ${assertionCount} comprobaciones HTTP/Auth/REST aprobadas.`);
}
try {
  const admin = await adminCreate(`qa-admin-${suffix}@example.invalid`, { display_name: 'QA Admin', role: 'admin' });
  const reader = await adminCreate(`qa-reader-${suffix}@example.invalid`, { display_name: 'QA Lector' });
  const unassigned = await adminCreate(`qa-unassigned-${suffix}@example.invalid`);
  sql(`update public.profiles set role='admin' where id='${admin.id}';
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
  await verifyApplications(adminToken, readerToken, noAccessToken, create.data);
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
