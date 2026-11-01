import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout } from 'node:timers/promises';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { url, key } = JSON.parse(readFileSync(resolve(root, '.artifacts/quick-tunnel/connection.json'), 'utf8'));
assert.match(url, /^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/);
assert.ok(key.startsWith('sb_publishable_') || JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role === 'anon');
const origin = 'https://rcfito.paxxa.chatgpt.site';
let checks = 0;

async function request(path, options = {}) {
  return fetch(`${url}${path}`, { ...options, redirect: 'error', signal: AbortSignal.timeout(15000) });
}
function passed(message) { checks++; console.log(`OK ${message}`); }
function cors(response) { assert.equal(response.headers.get('access-control-allow-origin'), origin); }

try {
  let health;
  for (let attempt = 0; attempt < 20; attempt++) {
    try { health = await request('/auth/v1/health', { headers: { origin, apikey: key } }); } catch { /* DNS/route may still be propagating. */ }
    if (health?.status === 200) break;
    await setTimeout(1000);
  }
  assert.equal(health?.status, 200, 'Salud HTTPS de Auth'); cors(health); passed('Auth accesible por HTTPS y CORS del Site.');

  const settings = await request('/auth/v1/settings', { headers: { origin, apikey: key } });
  assert.equal(settings.status, 200); cors(settings);
  assert.equal((await settings.json()).disable_signup, true); passed('Registro público deshabilitado.');

  for (const path of ['/rest/v1/agricultural_units', '/functions/v1/admin-create-user']) {
    const preflight = await request(path, { method: 'OPTIONS', headers: { origin, 'access-control-request-method': 'POST', 'access-control-request-headers': 'apikey,authorization,content-type,x-client-info' } });
    assert.equal(preflight.status, 204); cors(preflight);
    for (const header of ['apikey', 'authorization', 'content-type', 'x-client-info', 'range', 'prefer']) {
      assert.ok(preflight.headers.get('access-control-allow-headers')?.split(/,\s*/).includes(header));
    }
    passed(`Preflight permitido: ${path}.`);
  }

  for (const path of [
    '/', '/healthz', '/project/default', '/pg', '/supabase/', '/auth/v1/admin/users', '/auth/v1/signup',
    '/rest/v1/%252e%252e/%252e%252e/project/default', '/auth/v1/%2561dmin/users',
    '/rest/v1/%255c..%255c..%255cproject/default', '/auth/v1/%61dmin/users',
  ]) {
    assert.equal((await request(path)).status, 404, `Ruta restringida: ${path}`);
    passed(`Ruta fuera del acceso permitido: ${path}.`);
  }

  const foreign = await request('/auth/v1/health', { headers: { origin: 'https://untrusted.example.invalid' } });
  assert.equal(foreign.status, 403); assert.equal(foreign.headers.get('access-control-allow-origin'), null);
  passed('Origen de navegador ajeno rechazado.');

  for (const headers of [{ origin }, { origin, apikey: key }]) {
    const response = await request('/rest/v1/agricultural_units?select=id&limit=0', { headers });
    assert.equal(response.status, 401); cors(response); passed('Consulta sin sesión rechazada.');
  }
  const privateFunction = await request('/functions/v1/admin-create-user', { method: 'POST', headers: { origin, apikey: key, 'content-type': 'application/json' }, body: '{}' });
  assert.equal(privateFunction.status, 401); cors(privateFunction); passed('Alta privada sin sesión rechazada.');

  const login = await request('/auth/v1/token?grant_type=password', {
    method: 'POST', headers: { origin, apikey: key, 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'tunnel-check@example.invalid', password: 'Ficticia-exclusiva-de-verificacion-2026' }),
  });
  assert.equal(login.status, 400); cors(login);
  assert.equal((await login.json()).error_code, 'invalid_credentials'); passed('Login alcanza Auth y rechaza credenciales ficticias.');
  console.log(`${checks} comprobaciones HTTPS aprobadas. No se crearon cuentas ni registros de operación.`);
} catch (error) {
  console.error(`Verificación del túnel incompleta: ${error.message}`);
  process.exitCode = 1;
}
