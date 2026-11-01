import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApplicationChatService } from '../server/application-chat.mjs';
import { createSiteWorker } from '../server/site-worker.mjs';

const origin = 'https://rcfito.paxxa.chatgpt.site';
const backend = 'https://fictitious.trycloudflare.com';
const user = '11111111-1111-4111-8111-111111111111';
const project = '22222222-2222-4222-8222-222222222222';
const request = (body = { message: '¿Qué aplicaciones están pendientes?' }, path = '/api/application-chat') => new Request(origin + path, { method: 'POST', headers: { origin, authorization: 'Bearer fictitious-session', 'content-type': 'application/json' }, body: JSON.stringify(body) });
function setup(options = {}) {
  const calls = []; let providerCalls = 0, dataCalls = 0;
  const fetch = async (url, init) => {
    calls.push({ url, init });
    if (url.endsWith('/auth/v1/user')) return Response.json({ id: user }, { status: options.authStatus ?? 200 });
    if (url.includes('/rest/v1/profiles?')) return Response.json(options.profiles ?? [{ role: 'viewer', active: true }]);
    if (url.endsWith('/application_query_stamp')) return Response.json({ revision: 'version', as_of: '2026-11-01T12:00:00Z' });
    if (url.endsWith('/application_query')) {
      dataCalls++; const query = JSON.parse(init.body).p_query;
      return Response.json({ revision: 'version', as_of: '2026-11-01T12:00:00Z', query, summary: { destination_count: 0, order_count: 0 }, rows: [], sources: [], incomplete_count: 0, truncated: false });
    }
    if (url.endsWith('/responses')) {
      providerCalls++;
      const plan = options.plan ?? { action: 'query', query: { operation: 'pendientes' }, clarification: null };
      return Response.json({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(plan) }] }], usage: { input_tokens: 500, output_tokens: 100 } }, { status: options.providerStatus ?? 200 });
    }
    if (url.endsWith('/transcriptions')) {
      providerCalls++;
      assert.equal(init.body.get('model'), 'gpt-transcribe'); assert.equal(init.body.get('file').name, 'consulta.wav');
      return Response.json({ text: '¿Qué aplicaciones están pendientes?' });
    }
    throw new Error('Unexpected destination');
  };
  const service = createApplicationChatService({ fetch, key: 'sb_publishable_fictitious', now: () => Date.parse('2026-11-01T12:00:00Z'), backendUrl: async () => options.offline ? null : backend, configuration: async () => options.unconfigured ? {} : { apiKey: 'fictitious-provider-secret', model: 'configured-model' } });
  return { ...service, calls, fetch, counts: () => ({ providerCalls, dataCalls }) };
}

test('chat rechaza anónimo, origen ajeno y método sin consumir proveedor', async () => {
  const state = setup();
  assert.equal((await state.handle(new Request(origin + '/api/application-chat'), {})).status, 405);
  assert.equal((await state.handle(new Request(origin + '/api/application-chat', { method: 'POST' }), {})).status, 401);
  const foreign = request(); foreign.headers.set('origin', 'https://foreign.invalid');
  assert.equal((await state.handle(foreign, {})).status, 403); assert.equal(state.calls.length, 0);
});

test('lector activo consulta; perfil desactivado, rol inválido y sesión vencida no consumen IA', async () => {
  for (const profiles of [[{ role: 'viewer', active: false }], [{ role: 'other', active: true }], [{ role: 'admin', active: 'true' }], [], [null]]) {
    const state = setup({ profiles }); assert.equal((await state.handle(request(), {})).status, 403); assert.equal(state.counts().providerCalls, 0);
  }
  const expired = setup({ authStatus: 401 }); assert.equal((await expired.handle(request(), {})).status, 401);
  const active = setup(); assert.equal((await active.handle(request(), {})).status, 200);
});

test('una interpretación usa modelo configurado, contexto reducido y plantilla sin segunda inferencia', async () => {
  const state = setup(); const response = await state.handle(request({ message: '¿Qué falta?', context: { project_id: project } }), {});
  const body = await response.json(); assert.equal(response.status, 200); assert.equal(body.query.project_id, project);
  assert.deepEqual(body.usage, { inputTokens: 500, outputTokens: 100, toolCalls: 1 }); assert.deepEqual(state.counts(), { providerCalls: 1, dataCalls: 1 });
  const provider = JSON.parse(state.calls.find(call => call.url.endsWith('/responses')).init.body);
  assert.equal(provider.model, 'configured-model'); assert.equal(provider.store, false); assert.equal(provider.text.format.strict, true);
  assert.doesNotMatch(JSON.stringify(provider), /fictitious-session|fictitious-provider-secret|applicationTargets|catalogs/);
  assert.doesNotMatch(JSON.stringify(body), /fictitious-session|fictitious-provider-secret/);
});

test('el contexto visible no puede ampliarse con IDs distintos propuestos por el modelo', async () => {
  const state = setup({ plan: { action: 'query', query: { operation: 'historial', project_id: user }, clarification: null } });
  const body = await (await state.handle(request({ message: 'Consulta', context: { project_id: project } }), {})).json();
  assert.equal(body.query.project_id, project);
});

test('consulta estructurada de CLI funciona sin proveedor configurado y no consume IA', async () => {
  const state = setup({ unconfigured: true });
  assert.equal((await state.handle(request({ query: { operation: 'historial' } }, '/api/application-query'), {})).status, 200);
  assert.deepEqual(state.counts(), { providerCalls: 0, dataCalls: 1 });
  assert.equal((await state.handle(request(), {})).status, 503);
});

test('JSON, fechas, preguntas vacías y planes de escritura fallan sin ejecutar datos', async () => {
  for (const body of [{ message: '' }, { message: 'x'.repeat(4001) }, { message: 'x', sql: 'delete' }, { message: 'x', context: { from: '2026-02-30' } }]) {
    const state = setup(); assert.equal((await state.handle(request(body), {})).status, 400); assert.equal(state.counts().providerCalls, 0);
  }
  const unsafe = setup({ plan: { action: 'query', query: { operation: 'delete' }, clarification: null } });
  assert.equal((await unsafe.handle(request(), {})).status, 400); assert.equal(unsafe.counts().dataCalls, 0);
});

test('aclaraciones y límites del proveedor no fabrican datos o fuentes', async () => {
  const state = setup({ plan: { action: 'clarify', clarification: '¿Qué folio quieres consultar?', query: {} } });
  const body = await (await state.handle(request(), {})).json(); assert.match(body.answer, /folio/); assert.equal(body.result, undefined); assert.equal(state.counts().dataCalls, 0);
  const limited = setup({ providerStatus: 429 }); assert.equal((await limited.handle(request(), {})).status, 429);
});

function audioRequest(type = 'audio/wav', content = 'RIFF0000WAVEfictitious') {
  const form = new FormData(); form.append('audio', new Blob([content], { type }), 'private-recording-name.wav');
  return new Request(origin + '/api/application-transcription', { method: 'POST', headers: { origin, authorization: 'Bearer fictitious-session' }, body: form });
}
test('audio verifica formato/firma, reutiliza clave, renombra archivo y devuelve texto sin consultar BD', async () => {
  const state = setup(); const response = await state.handle(audioRequest(), {});
  assert.equal(response.status, 200); assert.match((await response.json()).text, /pendientes/); assert.deepEqual(state.counts(), { providerCalls: 1, dataCalls: 0 });
  for (const invalid of [audioRequest('text/plain'), audioRequest('audio/wav', 'not audio')]) assert.equal((await setup().handle(invalid, {})).status, 415);
});

test('audio sobredimensionado se rechaza antes de consumir proveedor', async () => {
  const state = setup(); const oversized = audioRequest(); oversized.headers.set('content-length', String(12 * 1024 * 1024));
  assert.equal((await state.handle(oversized, {})).status, 413); assert.equal(state.counts().providerCalls, 0);
});

test('Worker conecta las tres rutas nuevas con guardas y no las sirve como HTML', async () => {
  const worker = createSiteWorker({}, { key: 'sb_publishable_fictitious' });
  for (const path of ['/api/application-chat', '/api/application-query', '/api/application-transcription']) assert.equal((await worker.fetch(new Request(origin + path), {})).status, 405);
});
