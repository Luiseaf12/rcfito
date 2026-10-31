import { spawnSync } from 'node:child_process';
import { mkdirSync, cpSync, copyFileSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const runtime = resolve(root, '.artifacts/production-supabase');
const source = resolve(root, 'infra/supabase/upstream');
const args = process.argv.slice(2);
function option(name) { const index = args.indexOf(name); return index < 0 ? undefined : args[index + 1]; }
function absoluteHttps(value, label) {
  let url; try { url = new URL(value); } catch { throw new Error(`${label}: indica una URL HTTPS completa.`); }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) throw new Error(`${label}: indica una URL HTTPS sin credenciales.`);
  return url.origin;
}
const apiUrl = absoluteHttps(option('--api-url'), '--api-url');
const siteUrl = absoluteHttps(option('--site-url'), '--site-url');
if (existsSync(resolve(runtime, '.env'))) throw new Error('Ya existe la configuración privada de producción. Se conserva; no se regeneran claves automáticamente.');
mkdirSync(runtime, { recursive: true });
cpSync(source, runtime, { recursive: true });
copyFileSync(resolve(runtime, '.env.example'), resolve(runtime, '.env'));
copyFileSync(resolve(root, 'infra/supabase/compose.rcfito.yaml'), resolve(runtime, 'compose.rcfito.yaml'));
cpSync(resolve(root, 'supabase/functions/admin-create-user'), resolve(runtime, 'volumes/functions/admin-create-user'), { recursive: true });
let env = readFileSync(resolve(runtime, '.env'), 'utf8');
const values = {
  COMPOSE_FILE: 'docker-compose.yml',
  SUPABASE_PUBLIC_URL: apiUrl, API_EXTERNAL_URL: apiUrl, SITE_URL: siteUrl,
  ADDITIONAL_REDIRECT_URLS: siteUrl, ALLOWED_ORIGINS: siteUrl,
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
// The official scripts print credentials. Capture all output and never echo it.
const bash = process.platform === 'win32' ? 'C:/Program Files/Git/bin/bash.exe' : 'bash';
for (const script of ['utils/generate-keys.sh', 'utils/add-new-auth-keys.sh']) {
  const result = spawnSync(bash, [script, '--update-env'], { cwd: runtime, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });
  if (result.status !== 0) throw new Error('No se pudo completar la generación oficial de secretos; revisa la configuración privada local. No se inició ningún servicio.');
}
// generate-keys may rotate DB/dashboard secrets; retain secure generated values.
writeFileSync(resolve(runtime, '.supabase-version'), 'ref=self-hosted/v0.8.3\n');
console.log('Configuración privada preparada en .artifacts/production-supabase. No se inició Docker ni se publicaron puertos.');
console.log('Antes de iniciar: configurar proxy HTTPS y SMTP, aplicar migración y habilitar la primera cuenta administradora según docs/backend-deployment.md.');
