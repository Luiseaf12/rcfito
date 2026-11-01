import { spawnSync } from 'node:child_process';
import { mkdirSync, cpSync, copyFileSync, readFileSync, writeFileSync, existsSync, readdirSync, chmodSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const runtime = resolve(root, '.artifacts/production-supabase');
const source = resolve(root, 'infra/supabase/upstream');
const localSite = 'http://127.0.0.1:5180';
const publishedSite = 'https://rcfito.paxxa.chatgpt.site';

function option(args, name) {
  const index = args.indexOf(name);
  if (index < 0) return undefined;
  const value = args[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${name}: falta el valor.`);
  return value;
}

export function validateBackendUrl(value, label, local = false) {
  let url;
  try { url = new URL(value); } catch { throw new Error(`${label}: indica una URL completa.`); }
  const loopback = ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname);
  const protocolAllowed = url.protocol === 'https:' || (local && url.protocol === 'http:' && loopback);
  if (!protocolAllowed || url.username || url.password || url.search || url.hash) {
    throw new Error(`${label}: usa HTTPS sin credenciales, consulta ni fragmento; HTTP se permite solo con --local y un host loopback.`);
  }
  if (local && !loopback) throw new Error(`${label}: --local exige un host loopback.`);
  return `${url.origin}${url.pathname.replace(/\/+$/, '')}`;
}

export function backendConfiguration(args) {
  const local = args.includes('--local');
  const apiUrl = validateBackendUrl(option(args, '--api-url') ?? (local ? `${localSite}/supabase` : undefined), '--api-url', local);
  const siteUrl = validateBackendUrl(option(args, '--site-url') ?? (local ? localSite : undefined), '--site-url', local);
  const origins = local
    ? [new URL(siteUrl).origin, localSite, 'http://localhost:5180', publishedSite]
    : [new URL(siteUrl).origin];
  return { local, apiUrl, siteUrl, allowedOrigins: [...new Set(origins)] };
}

function executableShellScripts(directory) {
  for (const item of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, item.name);
    if (item.isSymbolicLink()) throw new Error('La plantilla contiene un enlace simbólico inesperado; no se modificaron permisos fuera de la carpeta local.');
    if (item.isDirectory()) executableShellScripts(path);
    else if (item.isFile() && item.name.endsWith('.sh')) chmodSync(path, 0o755);
  }
}

export function prepareBackend(args) {
  const config = backendConfiguration(args);
  if (existsSync(runtime) && readdirSync(runtime).length > 0) {
    throw new Error('Ya existe la configuración privada de operación. Se conserva intacta; no se regeneran claves automáticamente.');
  }
  mkdirSync(runtime, { recursive: true });
  cpSync(source, runtime, { recursive: true });
  copyFileSync(resolve(runtime, '.env.example'), resolve(runtime, '.env'));
  copyFileSync(resolve(root, 'infra/supabase/compose.rcfito.yaml'), resolve(runtime, 'compose.rcfito.yaml'));
  cpSync(resolve(root, 'supabase/functions/admin-create-user'), resolve(runtime, 'volumes/functions/admin-create-user'), { recursive: true });
  executableShellScripts(runtime);
  let env = readFileSync(resolve(runtime, '.env'), 'utf8');
  const values = {
    COMPOSE_FILE: 'docker-compose.yml',
    SUPABASE_PUBLIC_URL: config.apiUrl, API_EXTERNAL_URL: config.apiUrl, SITE_URL: config.siteUrl,
    ADDITIONAL_REDIRECT_URLS: [...new Set([config.siteUrl, ...(config.local ? [publishedSite] : [])])].join(','),
    ALLOWED_ORIGINS: config.allowedOrigins.join(','),
    API_GW_HTTP_PORT: '127.0.0.1:55451', DASHBOARD_USERNAME: 'rcfito-admin',
    DASHBOARD_PASSWORD: randomBytes(24).toString('base64url'), POSTGRES_PASSWORD: randomBytes(24).toString('base64url'),
    DISABLE_SIGNUP: 'true', ENABLE_ANONYMOUS_USERS: 'false', ENABLE_EMAIL_AUTOCONFIRM: 'false',
    FUNCTIONS_VERIFY_JWT: 'false', STUDIO_DEFAULT_ORGANIZATION: 'RC Fito', STUDIO_DEFAULT_PROJECT: 'RC Fito',
  };
  for (const [key, value] of Object.entries(values)) {
    const line = `${key}=${value}`;
    const pattern = new RegExp(`^${key}=.*$`, 'm');
    env = pattern.test(env) ? env.replace(pattern, line) : `${env}\n${line}\n`;
  }
  writeFileSync(resolve(runtime, '.env'), env, { mode: 0o600 });
  const bash = process.platform === 'win32' ? 'C:/Program Files/Git/bin/bash.exe' : 'bash';
  for (const script of ['utils/generate-keys.sh', 'utils/add-new-auth-keys.sh']) {
    const result = spawnSync(bash, [script, '--update-env'], { cwd: runtime, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });
    if (result.status !== 0) throw new Error('No se pudo completar la generación oficial de secretos. La configuración parcial se conserva para revisión privada. No se inició ningún servicio.');
  }
  for (const file of readdirSync(runtime)) {
    if (file === '.env' || file.startsWith('.env.')) chmodSync(resolve(runtime, file), 0o600);
  }
  writeFileSync(resolve(runtime, '.supabase-version'), 'ref=self-hosted/v0.8.3\n');
  console.log('Configuración privada preparada en .artifacts/production-supabase. No se inició Docker ni se publicaron puertos.');
  console.log(config.local
    ? 'Modo local: la API se utilizará mediante el proxy loopback /supabase. Aplicar migraciones y habilitar la primera cuenta administradora antes de capturar.'
    : 'Antes de iniciar: configurar proxy HTTPS y SMTP, aplicar migraciones y habilitar la primera cuenta administradora.');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { prepareBackend(process.argv.slice(2)); }
  catch (error) { console.error(error instanceof Error ? error.message : 'No se pudo preparar la configuración.'); process.exitCode = 1; }
}
