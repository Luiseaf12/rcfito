import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout } from 'node:timers/promises';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const runtime = resolve(root, '.artifacts/quick-tunnel');
const containers = ['rcfito-api-proxy', 'rcfito-quick-tunnel'];
const compose = ['compose', '--env-file', '.env.example', '-f', 'compose.tunnel.yaml'];

function docker(args, optional = false, timeout = 20000) {
  const result = spawnSync('docker', args, { cwd: root, encoding: 'utf8', windowsHide: true, timeout, maxBuffer: 2 * 1024 * 1024 });
  if (result.error || result.status !== 0) {
    if (optional) return null;
    throw new Error('No se confirmó la operación Docker. Comprueba que Docker Desktop esté activo y que tu sesión tenga acceso.');
  }
  return `${result.stdout ?? ''}\n${result.stderr ?? ''}`.trim();
}

function inspect(name) {
  const result = docker(['inspect', '--format', '{{json .State}}\n{{index .Config.Labels "com.docker.compose.project"}}\n{{.Id}}', name], true);
  if (result === null) return null;
  const [state, project, id] = result.split(/\r?\n/);
  return { ...JSON.parse(state), project, id };
}

function assertOwned() {
  for (const name of containers) {
    const state = inspect(name);
    if (state && state.project !== 'rcfito-tunnel') throw new Error(`El nombre ${name} pertenece a otro proyecto; se conserva intacto.`);
  }
}

function currentUrl() {
  const state = inspect('rcfito-quick-tunnel');
  if (!state?.Running) return null;
  const cachePath = resolve(runtime, 'tunnel.json');
  try {
    const cached = JSON.parse(readFileSync(cachePath, 'utf8'));
    if (cached.id === state.id && cached.startedAt === state.StartedAt && /^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/.test(cached.url)) return cached.url;
  } catch { /* Un inicio nuevo se descubre en los logs, nunca en la conexión vieja. */ }
  const logs = docker(['logs', '--since', state.StartedAt, 'rcfito-quick-tunnel']);
  const url = logs.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com\b/g)?.at(-1) ?? null;
  if (url) {
    mkdirSync(runtime, { recursive: true });
    writeFileSync(cachePath, `${JSON.stringify({ id: state.id, startedAt: state.StartedAt, url })}\n`);
  }
  return url;
}

export function readTunnelStatus() {
  docker(['version', '--format', '{{.Server.Version}}']);
  assertOwned();
  const state = inspect('rcfito-quick-tunnel');
  const url = currentUrl();
  return state?.Running && url ? { url, id: state.id, startedAt: state.StartedAt } : null;
}

function readPublicKey() {
  const { key } = JSON.parse(readFileSync(resolve(root, '.artifacts/production-supabase/frontend-config.json'), 'utf8'));
  let role;
  try { role = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role; } catch { /* Publishable key. */ }
  if (typeof key !== 'string' || key.startsWith('sb_secret_') || role === 'service_role' || !(key.startsWith('sb_publishable_') || role === 'anon')) {
    throw new Error('La configuración del frontend no contiene una clave pública válida; no se exportó.');
  }
  return key;
}

function savePublicConnection(url) {
  const key = readPublicKey();
  mkdirSync(runtime, { recursive: true });
  writeFileSync(resolve(runtime, 'connection.json'), `${JSON.stringify({ url, key }, null, 2)}\n`);
}

async function run(action) {
  if (!['start', 'status', 'stop', 'site-config', '--help'].includes(action)) throw new Error('Usa start, status, stop o site-config.');
  if (action === '--help') {
    console.log('Uso: node scripts/backend-tunnel.mjs start|status|stop|site-config. Solo administra el grupo rcfito-tunnel; site-config prepara el JSON público para publicar en Sites.');
    return;
  }
  // Comprobar el motor antes de interpretar errores de inspect como ausencia.
  docker(['version', '--format', '{{.Server.Version}}']);
  assertOwned();
  if (action === 'stop') {
    docker([...compose, 'stop']);
    console.log('Quick Tunnel detenido. Supabase y el frontend local se conservan; la URL temporal ya no funciona.');
    return;
  }
  if (action === 'start') {
    const gateway = inspect('rcfito-gateway');
    if (!gateway?.Running || gateway.project !== 'rcfito-supabase') throw new Error('Primero debe estar activo el gateway de la instalación rcfito-supabase.');
    // Validar la configuración pública antes de abrir el acceso exterior.
    readPublicKey();
    docker([...compose, 'config', '--quiet']);
    docker([...compose, 'up', '-d', '--wait'], false, 180000);
    console.log('Conector iniciado. Esperando la dirección HTTPS temporal…');
  }
  for (let attempt = 0; attempt < (action === 'start' ? 60 : 1); attempt++) {
    const url = currentUrl();
    if (url) {
      savePublicConnection(url);
      if (action === 'site-config') {
        writeFileSync(resolve(root, 'public/rcfito-config.json'), `${JSON.stringify({ mode: 'supabase', managed: true, url: '/supabase', key: readPublicKey() }, null, 2)}\n`);
        console.log('Conexión estable /supabase del Site preparada. El actualizador registra la dirección del túnel sin modificar el frontend.');
      }
      console.log(`API de RCFito: ${url}`);
      console.log('Conexión pública: .artifacts/quick-tunnel/connection.json (URL y clave pública; sin secretos).');
      console.log('El actualizador registra esta dirección automáticamente; el Site conserva su ruta /supabase.');
      return;
    }
    if (action === 'start') await setTimeout(1000);
  }
  throw new Error('El túnel aún no tiene una URL activa. Revisa el estado de rcfito-quick-tunnel y vuelve a consultar status.');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  run(process.argv[2] ?? 'status').catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
