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
  if (labelsResult.status !== 0 || !labelsResult.stdout.includes(project)) throw new Error('El contenedor no corresponde al proyecto de integración aislado.');
  const result = spawnSync('docker', ['exec', '--interactive', databaseContainer, 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '--quiet'], { input, encoding: 'utf8' });
  if (result.status !== 0) throw new Error('Falló una consulta del fixture de integración.');
  return result.stdout;
}
function assert(value, message) { if (!value) throw new Error(message); console.log(`PASS: ${message}`); }

mkdirSync(resolve(workdir, 'supabase/migrations'), { recursive: true });
mkdirSync(resolve(workdir, 'supabase/functions/admin-create-user'), { recursive: true });
// Empty file is deliberate: never inherit/read the task root .env.
writeFileSync(resolve(workdir, '.env'), '# Isolated test workdir; never copy the root .env.\n');
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
  sql(`update public.profiles set active=false where id='${reader.id}';`);
  const revoked = await request('/rest/v1/agricultural_units?select=id', readerToken);
  assert(revoked.status === 200 && revoked.data.length === 0, 'Desactivación bloquea JWT de lector ya emitido');
  console.log('Integración Auth/REST/Edge/RLS verificada; credenciales de prueba no se escribieron ni imprimieron.');
} finally {
  // Keep the isolated stack for parent browser QA unless --cleanup was requested.
  if (process.argv.includes('--cleanup')) {
    cli(['stop', '--no-backup']);
    console.log('Stack de integración detenido y datos ficticios eliminados.');
  } else console.log('Stack aislado sigue disponible solo para QA local en 127.0.0.1:55441.');
}
