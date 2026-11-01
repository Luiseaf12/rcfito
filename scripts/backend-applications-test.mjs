import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

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
  for (const file of migrations) sql(readFileSync(resolve(root, 'supabase/migrations', file), 'utf8'));
  sql(readFileSync(resolve(root, 'supabase/tests/catalogs-and-sowing.sql'), 'utf8'));
  sql(readFileSync(resolve(root, 'supabase/tests/applications.sql'), 'utf8'));
  console.log(`Backend aplicaciones verificado: ${migrations.length} migración(es), fixtures aislados y controles de RLS/integridad. Auth es un stub de prueba; REST/Auth reales requieren integración aparte.`);
} finally {
  if (started) removeOwnedContainer();
}
