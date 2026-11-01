import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAiSettingsService } from '../server/ai-settings.mjs';
import { createSiteWorker } from '../server/site-worker.mjs';

const origin = 'https://rcfito.paxxa.chatgpt.site';
const backend = 'https://fictitious-config-backend.trycloudflare.com';
const adminId = '11111111-1111-4111-8111-111111111111';
const otherAdminId = '22222222-2222-4222-8222-222222222222';
const providerKey = 'fictitious-provider-api-key-1234';
const otherKey = 'fictitious-provider-api-key-5678';
const model = 'configured-model-example';
const initialTime = 1_800_000_000_000;
const settingsObjectKey = 'rcfito/ai-settings.json';
const complete = value => Response.json({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(value) }] }] });
function setup(options = {}) {
  const calls = [], writes = [];
  let stored = null, etag = null, sequence = 0, reads = 0, stamp = initialTime, putHook = null;
  const bucket = {
    async get(key) {
      if (key === 'rcfito/quick-tunnel.json') return { async json() { return { url: backend, updatedAt: stamp, expiresAt: stamp + 120_000 }; } };
      assert.equal(key, settingsObjectKey); reads++;
      if (!stored) return null;
      const snapshot = structuredClone(stored), snapshotEtag = etag;
      return { etag: snapshotEtag, size: JSON.stringify(snapshot).length, async json() { return snapshot; } };
    },
    async put(key, body, settings) {
      assert.equal(key, settingsObjectKey);
      if (putHook) await putHook();
      const condition = settings.onlyIf;
      if (condition.get('if-none-match') === '*' && stored) return null;
      if (condition.has('if-match') && condition.get('if-match') !== `"${etag}"`) return null;
      assert.ok(condition.has('if-match') || condition.get('if-none-match') === '*');
      stored = JSON.parse(body); etag = 'fictitious-etag-' + ++sequence;
      writes.push({ key, body, settings });
      return { etag };
    },
  };
  const env = { BUCKET: bucket, RCFITO_TUNNEL_UPDATE_SECRET: 'fictitious-stable-server-secret-32-characters-or-more', ...options.env };
  const fetch = async (url, init) => {
    calls.push({ url, init });
    if (url === backend + '/auth/v1/user') return Response.json({ id: init.headers.authorization === 'Bearer other-admin' ? otherAdminId : adminId }, { status: options.authStatus ?? 200 });
    if (url.startsWith(backend + '/rest/v1/profiles?')) return Response.json(options.profiles ?? [{ role: 'admin', active: true }]);
    if (url === 'https://api.openai.com/v1/responses') {
      if (options.provider) return options.provider(url, init);
      const body = JSON.parse(init.body);
      if (body.text.format.name === 'rcfito_ai_configuration_test') return complete({ ok: true });
      return complete({ agricultural_unit: null, destinations: [], application_number: null, crop: null, field: null, method: null, indicated_date: null, scheduled_date: null, water_l_ha: null, note: '', products: [] });
    }
    throw new Error('Destino no previsto');
  };
  const service = createAiSettingsService({ fetch, now: () => stamp, key: 'sb_publishable_fictitious', backendUrl: async () => backend });
  const request = (path, method = 'GET', body, headers = {}) => new Request(origin + path, { method, headers: { authorization: 'Bearer fictitious-admin', origin, ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...headers }, ...(body === undefined ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) }) });
  const call = (path = '/api/ai-settings', method = 'GET', body, headers) => service.handle(request(path, method, body, headers), env);
  const prove = (values = {}) => call('/api/ai-settings/test', 'POST', { apiKey: providerKey, model, revision: null, ...values });
  const save = (proof, values = {}, headers) => call('/api/ai-settings', 'PUT', { apiKey: providerKey, model, revision: null, testToken: proof.testToken, ...values }, headers);
  return { service, env, calls, writes, fetch, request, call, prove, save, stored: () => stored, reads: () => reads, mutate(fn) { stored = fn(structuredClone(stored)); }, putHook(fn) { putHook = fn; }, time(value) { stamp = value; } };
}
async function initialize(state) {
  const tested = await state.prove(); assert.equal(tested.status, 200);
  const response = await state.save(await tested.json()); assert.equal(response.status, 200);
  return response.json();
}

test('configuración exige Origin permitido y admin activo antes de leer R2 o usar proveedor', async () => {
  const state = setup();
  assert.equal((await state.call('/api/ai-settings', 'GET', undefined, { origin: 'https://foreign.example.invalid' })).status, 403);
  assert.equal((await state.service.handle(new Request(origin + '/api/ai-settings'), state.env)).status, 401);
  assert.equal(state.reads(), 0); assert.equal(state.calls.length, 0);
  for (const options of [{ authStatus: 401 }, { profiles: [{ role: 'viewer', active: true }] }, { profiles: [{ role: 'admin', active: false }] }]) {
    const denied = setup(options);
    for (const [path, method, body] of [['/api/ai-settings', 'GET'], ['/api/ai-settings/test', 'POST', { apiKey: providerKey, model, revision: null }], ['/api/ai-settings', 'PUT', { apiKey: providerKey, model, revision: null, testToken: 'fake' }]]) {
      assert.equal((await denied.call(path, method, body)).status, options.authStatus === 401 ? 401 : 403);
    }
    assert.equal(denied.reads(), 0);
    assert.ok(denied.calls.every(call => call.url.startsWith(backend)));
  }
});

test('GET informa configuración vacía y disponibilidad de almacenamiento sin exponer secretos', async () => {
  const state = setup();
  const response = await state.call();
  assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await response.json(), { configured: false, model: '', keySuffix: null, revision: null, storageReady: true, source: 'none', testedAt: null });
  const unavailable = setup({ env: { RCFITO_TUNNEL_UPDATE_SECRET: undefined } });
  assert.equal((await (await unavailable.call()).json()).storageReady, false);
  assert.equal((await unavailable.prove()).status, 503);
  assert.equal(unavailable.calls.filter(call => call.url.startsWith('https://api.openai.com')).length, 0);
});

test('clave acepta 20 a 2048 caracteres ASCII sin espacios y nunca expone claves cortas de entorno', async () => {
  for (const invalid of ['short-key', 'abcd', 'a'.repeat(19), 'a'.repeat(2049), 'a'.repeat(20) + ' x', 'clave-con-un-caracter-ñ']) {
    const state = setup({ env: { OPENAI_API_KEY: invalid, OPENAI_MODEL: model } });
    const status = await (await state.call()).json();
    assert.equal(status.configured, false);
    assert.equal(status.keySuffix, null);
    const response = await state.prove({ apiKey: invalid });
    assert.equal(response.status, 400);
    assert.equal(state.calls.filter(call => call.url.startsWith('https://api.openai.com')).length, 0);
  }
  for (const length of [20, 2048]) {
    const state = setup();
    const proof = await (await state.prove({ apiKey: 'a'.repeat(length) })).json();
    const response = await state.save(proof, { apiKey: 'a'.repeat(length) });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).keySuffix, 'aaaa');
  }
});

test('la prueba usa Responses y salida estructurada con datos ficticios, sin persistir clave', async () => {
  const state = setup();
  const response = await state.prove();
  assert.equal(response.status, 200);
  const proof = await response.json();
  assert.equal(proof.ok, true); assert.equal(proof.model, model); assert.match(proof.testToken, /^[\w-]+\.[\w-]+$/);
  assert.doesNotMatch(JSON.stringify(proof), new RegExp(providerKey));
  assert.equal(state.writes.length, 0); assert.equal(state.stored(), null);
  const provider = state.calls.at(-1), body = JSON.parse(provider.init.body);
  assert.equal(provider.init.headers.authorization, `Bearer ${providerKey}`);
  assert.equal(provider.init.redirect, 'manual'); assert.ok(provider.init.signal);
  assert.equal(body.store, false); assert.equal(body.model, model); assert.equal(body.text.format.strict, true);
  assert.match(body.input, /ficticia/); assert.doesNotMatch(JSON.stringify(body), /Agrícola|Malla/);
  assert.equal((await (await state.call()).json()).configured, false);
});

test('guardar exige prueba y cifra AES-GCM antes de R2; GET solo devuelve últimos cuatro', async () => {
  const state = setup();
  const missing = await state.save({ testToken: 'missing' }); assert.equal(missing.status, 409); assert.equal(state.writes.length, 0);
  const saved = await initialize(state);
  assert.equal(saved.configured, true); assert.equal(saved.source, 'saved'); assert.equal(saved.keySuffix, '1234');
  assert.match(saved.revision, /^[0-9a-f-]{36}$/); assert.equal(saved.testedAt, new Date(initialTime).toISOString());
  assert.equal(state.writes.length, 1);
  assert.doesNotMatch(state.writes[0].body, new RegExp(providerKey));
  const envelope = state.stored();
  assert.equal(envelope.version, 1); assert.equal(envelope.updatedBy, adminId);
  assert.ok(envelope.iv && envelope.ciphertext); assert.equal('apiKey' in envelope, false); assert.equal('model' in envelope, false);
  assert.equal(state.writes[0].settings.onlyIf.get('if-none-match'), '*');
  assert.deepEqual(await (await state.call()).json(), saved);
  assert.equal((await state.service.readConfiguration(state.env)).apiKey, providerKey);
});

test('clave vacía u omitida conserva la guardada y permite probar otro modelo', async () => {
  const state = setup(), first = await initialize(state);
  const proof = await (await state.prove({ apiKey: '', model: 'another-model-example', revision: first.revision })).json();
  assert.equal(state.calls.at(-1).init.headers.authorization, `Bearer ${providerKey}`);
  const response = await state.save(proof, { apiKey: undefined, model: 'another-model-example', revision: first.revision });
  assert.equal(response.status, 200);
  const saved = await response.json(); assert.equal(saved.keySuffix, '1234'); assert.equal(saved.model, 'another-model-example'); assert.notEqual(saved.revision, first.revision);
  assert.equal(state.writes[1].settings.onlyIf.get('if-match'), '"fictitious-etag-1"');
  assert.equal((await state.service.readConfiguration(state.env)).apiKey, providerKey);
});

test('prueba HMAC queda vinculada a clave, modelo, admin y revisión', async () => {
  const state = setup(), proof = await (await state.prove()).json();
  for (const [values, headers] of [[{ apiKey: otherKey }], [{ model: 'different-model' }], [{ revision: 'changed' }], [{}, { authorization: 'Bearer other-admin' }], [{ testToken: proof.testToken.slice(0, -2) + 'aa' }]]) {
    assert.equal((await state.save(proof, values, headers)).status, 409);
  }
  assert.equal(state.writes.length, 0);
  assert.equal((await state.save(proof)).status, 200);
  assert.equal((await state.save(proof)).status, 409);
  assert.equal(state.writes.length, 1);
});

test('prueba caduca a los diez minutos y no escribe configuración', async () => {
  const state = setup(), proof = await (await state.prove()).json();
  state.time(initialTime + 600_000);
  assert.equal((await state.save(proof)).status, 409); assert.equal(state.writes.length, 0);
});

test('R2 condicional impide sobreescribir cambios concurrentes tanto al crear como al editar', async () => {
  for (const existing of [false, true]) {
    const state = setup();
    const revision = existing ? (await initialize(state)).revision : null;
    const proofA = await (await state.prove({ revision })).json(), proofB = await (await state.prove({ revision })).json();
    let arrive = 0, unblock;
    const barrier = new Promise(resolve => { unblock = resolve; });
    state.putHook(async () => { if (++arrive === 2) unblock(); await barrier; });
    const results = await Promise.all([state.save(proofA, { revision }), state.save(proofB, { revision })]);
    assert.deepEqual(results.map(response => response.status).sort(), [200, 409]);
    assert.equal(state.writes.length, existing ? 2 : 1);
  }
});

test('ciphertext o metadatos alterados fallan cerrados, incluso si hay clave en entorno', async () => {
  for (const corrupt of [envelope => ({ ...envelope, ciphertext: envelope.ciphertext.slice(0, -3) + 'abc' }), envelope => ({ ...envelope, updatedBy: otherAdminId }), envelope => ({ ...envelope, revision: crypto.randomUUID() })]) {
    const state = setup({ env: { OPENAI_API_KEY: otherKey, OPENAI_MODEL: 'environment-model' } });
    await initialize(state); state.mutate(corrupt);
    const response = await state.call(); assert.equal(response.status, 503);
    assert.doesNotMatch(await response.text(), new RegExp(providerKey + '|' + otherKey));
    await assert.rejects(state.service.readConfiguration(state.env));
  }
});

test('dominio HKDF de configuración permite secreto propio y falla si cambia el secreto raíz', async () => {
  const state = setup({ env: { RCFITO_AI_CONFIG_SECRET: 'fictitious-dedicated-config-secret-with-32-characters' } });
  await initialize(state);
  state.env.RCFITO_TUNNEL_UPDATE_SECRET = 'different-fictitious-tunnel-secret-with-32-characters';
  assert.equal((await state.call()).status, 200);
  state.env.RCFITO_AI_CONFIG_SECRET = 'different-fictitious-config-secret-with-32-characters';
  assert.equal((await state.call()).status, 503);
});

test('guardados sucesivos usan IV aleatorio y cifrados diferentes', async () => {
  const state = setup(), first = await initialize(state), before = structuredClone(state.stored());
  const proof = await (await state.prove({ revision: first.revision })).json();
  assert.equal((await state.save(proof, { revision: first.revision })).status, 200);
  assert.notEqual(state.stored().iv, before.iv); assert.notEqual(state.stored().ciphertext, before.ciphertext);
});

test('fallback al entorno ocurre solo cuando no existe objeto guardado', async () => {
  const state = setup({ env: { OPENAI_API_KEY: otherKey, OPENAI_MODEL: 'environment-model' } });
  const initial = await (await state.call()).json();
  assert.equal(initial.source, 'environment'); assert.equal(initial.keySuffix, '5678'); assert.equal(initial.revision, null);
  const saved = await initialize(state); assert.equal(saved.source, 'saved'); assert.equal(saved.keySuffix, '1234');
  const resolved = await state.service.readConfiguration(state.env); assert.equal(resolved.apiKey, providerKey); assert.equal(resolved.model, model);
});

test('Worker usa la clave guardada en captura y consulta R2 de nuevo en cada petición', async () => {
  const state = setup({ env: { OPENAI_API_KEY: otherKey, OPENAI_MODEL: 'environment-model' } }), saved = await initialize(state);
  const worker = createSiteWorker({}, { key: 'sb_publishable_fictitious' }, { fetch: state.fetch, now: () => initialTime });
  const capture = () => worker.fetch(state.request('/api/application-draft', 'POST', { message: 'Mensaje ficticio sin nota.' }), state.env);
  assert.equal((await capture()).status, 200);
  assert.equal(state.calls.at(-1).init.headers.authorization, `Bearer ${providerKey}`);
  const proof = await (await state.prove({ apiKey: otherKey, model: 'new-saved-model', revision: saved.revision })).json();
  assert.equal((await state.save(proof, { apiKey: otherKey, model: 'new-saved-model', revision: saved.revision })).status, 200);
  assert.equal((await capture()).status, 200);
  assert.equal(state.calls.at(-1).init.headers.authorization, `Bearer ${otherKey}`);
  assert.equal(JSON.parse(state.calls.at(-1).init.body).model, 'new-saved-model');
  const status = await worker.fetch(state.request('/api/ai-settings'), state.env);
  assert.equal(status.status, 200); assert.equal((await status.json()).keySuffix, '5678');
});

test('validación de entradas y cuerpos acotados rechaza secretos mal formados antes de probar', async () => {
  const state = setup();
  for (const body of [{ apiKey: providerKey, model }, { apiKey: providerKey, model: 'bad\nmodel', revision: null }, { apiKey: 'bad\nkey', model, revision: null }, { apiKey: providerKey, model, revision: null, endpoint: 'https://foreign.example.invalid' }, 'not-json', { apiKey: 'a'.repeat(20_000), model, revision: null }]) {
    const response = await state.call('/api/ai-settings/test', 'POST', body);
    assert.ok([400, 413].includes(response.status));
  }
  assert.equal(state.calls.filter(call => call.url.startsWith('https://api.openai.com')).length, 0); assert.equal(state.writes.length, 0);
});

test('errores, redirecciones y respuestas de proveedor se saneen sin guardar ni emitir prueba', async () => {
  for (const provider of [
    async () => new Response(providerKey, { status: 401 }), async () => new Response(providerKey, { status: 429 }),
    async () => new Response(null, { status: 302, headers: { location: 'https://foreign.example.invalid' } }),
    async () => new Response(providerKey), async () => complete({ ok: false }),
    async () => Response.json({ status: 'completed', output: [{ type: 'message', content: [{ type: 'refusal', refusal: providerKey }] }] }),
    async () => { throw new Error(providerKey); },
  ]) {
    const state = setup({ provider }), response = await state.prove(), body = await response.json();
    assert.ok([429, 502, 503].includes(response.status)); assert.equal('testToken' in body, false);
    assert.doesNotMatch(JSON.stringify(body), new RegExp(providerKey)); assert.equal(state.writes.length, 0);
  }
});

test('pruebas tienen límite de frecuencia y una prueba simultánea por administrador', async () => {
  const state = setup();
  for (let index = 0; index < 5; index++) assert.equal((await state.prove()).status, 200);
  assert.equal((await state.prove()).status, 429);
  let started, finish;
  const ready = new Promise(resolve => { started = resolve; });
  const parallel = setup({ provider: async () => { started(); return new Promise(resolve => { finish = resolve; }); } });
  const first = parallel.prove(); await ready;
  assert.equal((await parallel.prove()).status, 429);
  finish(complete({ ok: true })); assert.equal((await first).status, 200);
});
