import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout } from 'node:timers/promises';
import { publisherConfig } from './tunnel-publisher.mjs';
import { readTunnelStatus } from './backend-tunnel.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const config = publisherConfig(JSON.parse(readFileSync(resolve(root, '.artifacts/quick-tunnel/private/publisher.json'), 'utf8')));
const { key } = JSON.parse(readFileSync(resolve(root, 'public/rcfito-config.json'), 'utf8'));
let checks = 0;
async function request(path, options = {}) {
  return fetch(`${config.siteUrl}${path}`, { ...options, headers: { ...options.headers, 'OAI-Sites-Authorization': `Bearer ${config.serviceToken}` }, redirect: 'error', signal: AbortSignal.timeout(15000) });
}
function pass(message) { checks++; console.log(`OK ${message}`); }

try {
  const initial = await request('/rcfito-config.json');
  assert.equal(initial.status, 200);
  assert.deepEqual(await initial.json(), { mode: 'supabase', managed: true, url: '/supabase', key });
  pass('Configuración estable del mismo origen, sin URL del túnel en el navegador.');

  const current = readTunnelStatus();
  assert.ok(current, 'Túnel local activo');
  let renewed = false;
  let healthy = false;
  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      const state = await (await request('/api/tunnel')).json();
      renewed = state.available === true && state.expiresAt > Date.now() && state.updatedAt >= Date.parse(current.startedAt) - 5000;
      if (renewed) healthy = (await request('/supabase/auth/v1/health', { headers: { apikey: key } })).status === 200;
      if (renewed && healthy) break;
    } catch { /* Esperar la renovación del publicador después del arranque. */ }
    await setTimeout(2000);
  }
  assert.ok(renewed && healthy, 'El registro y proxy deben alcanzar el túnel del arranque actual');
  pass('Publicador renovó el registro para el arranque actual y Auth responde por la ruta fija.');

  const page = await request('/');
  assert.equal(page.status, 200);
  const html = await page.text();
  const entry = html.match(/src="(\/assets\/[^" ]+\.js)"/)?.[1];
  assert.ok(entry);
  const asset = await request(entry);
  assert.equal(asset.status, 200); assert.ok(asset.headers.get('content-type')?.includes('javascript'));
  await asset.body?.cancel();
  pass('Frontend y JavaScript servidos por el Worker privado.');

  for (const path of ['/supabase/auth/v1/admin/users', '/supabase/rest/v1/%252e%252e/%252e%252e/project/default', '/supabase/project/default']) {
    assert.equal((await request(path)).status, 404);
    pass(`Ruta restringida: ${path}.`);
  }
  assert.equal((await request('/supabase/rest/v1/agricultural_units?select=id&limit=0', { headers: { apikey: key } })).status, 401);
  pass('Consulta de datos sin sesión rechazada a través de Sites.');
  assert.equal((await request('/supabase/functions/v1/admin-create-user', { method: 'POST', headers: { apikey: key, 'content-type': 'application/json' }, body: '{}' })).status, 401);
  pass('Función privada sin sesión rechazada a través del proxy.');
  assert.equal((await request('/api/tunnel', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url: current.url }) })).status, 401);
  pass('Acceso al Site por sí solo no permite cambiar el túnel.');
  console.log(`${checks} comprobaciones del Site aprobadas; sin crear datos ni cuentas.`);
} catch (error) {
  console.error(`Verificación del Site incompleta: ${error.message}`);
  process.exitCode = 1;
}
