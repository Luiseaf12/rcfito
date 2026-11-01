import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSiteWorker, tunnelUrl } from '../server/site-worker.mjs';

const origin = 'https://rcfito.paxxa.chatgpt.site';
const target = 'https://valid-tunnel-name.trycloudflare.com';
const secret = 'fictitious-update-secret-with-at-least-32-characters';
const publicKey = 'sb_publishable_fictitious';
const baseTime = 1_800_000_000_000;
function setup() {
  let time = baseTime;
  let stored = null;
  const calls = [];
  let redirect = false;
  const env = { RCFITO_TUNNEL_UPDATE_SECRET: secret, BUCKET: {
    async get() { return stored ? { async json() { return structuredClone(stored); } } : null; },
    async put(_key, body) { stored = JSON.parse(body); },
  } };
  const worker = createSiteWorker({}, { key: publicKey }, { now: () => time, async fetch(url, options) {
    calls.push({ url, options });
    if (url.endsWith('/health')) return Response.json({ name: 'GoTrue' });
    if (redirect) return new Response(null, { status: 302, headers: { location: 'https://foreign.example.invalid', 'set-cookie': 'private=value' } });
    return Response.json([], { headers: { 'content-range': '0-0/1', 'preference-applied': 'count=exact', 'set-cookie': 'private=value', 'oai-authenticated-user-email': 'private@example.invalid' } });
  } });
  return { worker, env, calls, time: value => { time = value; }, stored: value => { stored = value; }, redirect: () => { redirect = true; } };
}
function update(state, value = target, auth = secret) {
  return state.worker.fetch(new Request(`${origin}/api/tunnel`, { method: 'POST', headers: { authorization: `Bearer ${auth}` }, body: JSON.stringify({ url: value }) }), state.env);
}

test('solo acepta hosts HTTPS Quick Tunnel exactos, sin rutas ni credenciales', () => {
  assert.equal(tunnelUrl(target), target);
  for (const url of ['http://valid-tunnel-name.trycloudflare.com', target + '/', target + '?x=1', target + '#x', target + ':443', 'https://x.trycloudflare.com.evil.invalid', 'https://x@valid-tunnel-name.trycloudflare.com', 'https://127.0.0.1']) assert.throws(() => tunnelUrl(url));
});

test('configuración managed sigue disponible sin almacenamiento ni túnel', async () => {
  const { worker } = setup();
  const response = await worker.fetch(new Request(origin + '/rcfito-config.json'), {});
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { mode: 'supabase', managed: true, url: '/supabase', key: publicKey });
  assert.equal((await worker.fetch(new Request(origin + '/supabase/auth/v1/token'), {})).status, 503);
});

test('registro exige secreto, limita el cuerpo y no sigue redirecciones', async () => {
  const state = setup();
  assert.equal((await update(state, target, 'incorrect')).status, 401);
  assert.equal(state.calls.length, 0);
  assert.equal((await update(state, target + '?redirect=1')).status, 400);
  const large = await state.worker.fetch(new Request(origin + '/api/tunnel', { method: 'POST', headers: { authorization: `Bearer ${secret}` }, body: 'x'.repeat(1025) }), state.env);
  assert.equal(large.status, 400);
  assert.equal((await update(state)).status, 200);
  assert.equal(state.calls[0].options.redirect, 'manual');
  assert.equal(state.calls[0].options.headers.apikey, publicKey);
});

test('la vigencia la calcula el servidor y caduca sin enviar sesiones a un destino viejo', async () => {
  const state = setup();
  const registered = await (await update(state)).json();
  assert.equal(registered.expiresAt, baseTime + 120000);
  state.time(baseTime + 120001);
  const count = state.calls.length;
  const expired = await state.worker.fetch(new Request(origin + '/supabase/rest/v1/crops', { headers: { authorization: 'Bearer fictitious-session' } }), state.env);
  assert.equal(expired.status, 503);
  assert.equal(state.calls.length, count);
  state.stored({ url: 'https://foreign.example.invalid', updatedAt: baseTime + 120001, expiresAt: baseTime + 240001 });
  assert.equal((await state.worker.fetch(new Request(origin + '/supabase/rest/v1/crops'), state.env)).status, 503);
});

test('proxy conserva JWT, apikey y cabeceras REST sin cookies ni identidad de Sites', async () => {
  const state = setup();
  await update(state);
  const response = await state.worker.fetch(new Request(origin + '/supabase/rest/v1/crops?name=eq.%C3%A1rbol', { headers: {
    authorization: 'Bearer fictitious-session', apikey: publicKey, range: '0-499', prefer: 'count=exact', cookie: 'private=cookie', 'oai-authenticated-user-email': 'private@example.invalid', 'OAI-Sites-Authorization': 'Bearer private-site-access',
  } }), state.env);
  const call = state.calls.at(-1);
  assert.equal(call.url, target + '/rest/v1/crops?name=eq.%C3%A1rbol');
  assert.equal(call.options.headers.get('authorization'), 'Bearer fictitious-session');
  assert.equal(call.options.headers.get('apikey'), publicKey);
  assert.equal(call.options.headers.get('range'), '0-499');
  assert.equal(call.options.headers.get('prefer'), 'count=exact');
  for (const name of ['cookie', 'oai-authenticated-user-email', 'OAI-Sites-Authorization']) assert.equal(call.options.headers.get(name), null);
  assert.equal(response.headers.get('content-range'), '0-0/1');
  assert.equal(response.headers.get('preference-applied'), 'count=exact');
  assert.equal(response.headers.get('set-cookie'), null);
  assert.equal(response.headers.get('oai-authenticated-user-email'), null);
});

test('rechaza rutas administrativas/codificadas y redirecciones del destino', async () => {
  const state = setup();
  await update(state);
  const count = state.calls.length;
  for (const path of ['/supabase/project/default', '/supabase/auth/v1/admin/users', '/supabase/auth/v1/%2561dmin/users', '/supabase/rest/v1/%252e%252e/%252e%252e/project/default']) {
    assert.equal((await state.worker.fetch(new Request(origin + path), state.env)).status, 404);
  }
  assert.equal(state.calls.length, count);
  state.redirect();
  const response = await state.worker.fetch(new Request(origin + '/supabase/rest/v1/crops'), state.env);
  assert.equal(response.status, 502);
  assert.equal(response.headers.get('location'), null);
});

test('un cambio de URL dirige la misma ruta estable al nuevo destino', async () => {
  const state = setup();
  await update(state);
  await state.worker.fetch(new Request(origin + '/supabase/rest/v1/crops'), state.env);
  assert.equal(state.calls.at(-1).url, target + '/rest/v1/crops');
  const replacement = 'https://replacement-tunnel.trycloudflare.com';
  await update(state, replacement);
  await state.worker.fetch(new Request(origin + '/supabase/rest/v1/crops'), state.env);
  assert.equal(state.calls.at(-1).url, replacement + '/rest/v1/crops');
});
