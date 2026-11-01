import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applicationDraftSchema, applicationNoteFromMessage, createApplicationAiHandler, validateApplicationDraft } from '../server/application-ai.mjs';
import { createSiteWorker } from '../server/site-worker.mjs';

const aiOrigin = 'https://rcfito.paxxa.chatgpt.site';
const aiBackend = 'https://fictitious-backend.trycloudflare.com';
const aiUser = '11111111-1111-4111-8111-111111111111';
const aiMessage = 'Agrícola de ejemplo\nMallas 5,6,7 y 8\n9na aplicación\n1.5 litrs de Producto ejemplo\nDosis / ha\nGasto de agua / ha\n660 litrs\nNota:\nTexto de nota\nSegunda línea';
const aiDraft = () => ({ agricultural_unit: 'Agrícola de ejemplo', destinations: ['Malla 5', 'Malla 6', 'Malla 7', 'Malla 8'], application_number: 9, crop: null, field: null, method: null, indicated_date: null, scheduled_date: null, water_l_ha: 660, note: 'Texto de nota\nSegunda línea', products: [{ name: 'Producto ejemplo', dose: 1500, unit: 'ml' }] });
const aiCompletion = draft => ({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(draft) }] }] });
function aiSetup(options = {}) {
  const calls = [];
  let stamp = 1_800_000_000_000;
  const env = { OPENAI_API_KEY: 'fictitious-provider-key', OPENAI_MODEL: 'configured-model-example', ...options.env };
  const fetch = async (url, init) => {
    calls.push({ url, init });
    if (url === aiBackend + '/auth/v1/user') return options.authResponse?.() ?? Response.json({ id: aiUser }, { status: options.authStatus ?? 200 });
    if (url.startsWith(aiBackend + '/rest/v1/profiles?')) return Response.json(options.profiles ?? [{ role: 'admin', active: true }]);
    if (url === 'https://api.openai.com/v1/responses') {
      if (options.provider) return await options.provider(url, init);
      return Response.json(options.completion ?? aiCompletion(aiDraft()), { status: options.providerStatus ?? 200 });
    }
    throw new Error('Destino de red no esperado');
  };
  const handler = createApplicationAiHandler({ fetch, key: 'sb_publishable_fictitious', backendUrl: async () => options.offline ? null : aiBackend, now: () => stamp });
  return { handler, calls, env, fetch, time(value) { stamp = value; } };
}
function aiRequest(value = { message: aiMessage }, extra = {}) {
  return new Request(aiOrigin + '/api/application-draft', { method: 'POST', headers: { authorization: 'Bearer fictitious-session', origin: aiOrigin, 'content-type': 'application/json', ...extra.headers }, body: typeof value === 'string' ? value : JSON.stringify(value), ...extra });
}

test('IA rechaza anónimo, origen ajeno y método no permitido antes de consultar servicios', async () => {
  const state = aiSetup();
  assert.equal((await state.handler(new Request(aiOrigin + '/api/application-draft'), state.env)).status, 405);
  assert.equal((await state.handler(new Request(aiOrigin + '/api/application-draft', { method: 'POST' }), state.env)).status, 401);
  assert.equal((await state.handler(aiRequest(undefined, { headers: { origin: 'https://foreign.example.invalid' } }), state.env)).status, 403);
  assert.equal(state.calls.length, 0);
});

test('IA valida JSON, claves exactas, texto vacío y límite de caracteres antes de consultar servicios', async () => {
  const state = aiSetup();
  for (const value of ['not-json', { message: '' }, { message: '   ' }, { message: 123 }, { message: 'x', products: [] }, { message: 'x'.repeat(20_001) }, { message: 'Texto\u0000inválido' }]) {
    assert.equal((await state.handler(aiRequest(value), state.env)).status, 400);
  }
  assert.equal(state.calls.length, 0);
  assert.equal((await state.handler(aiRequest('x', { headers: { authorization: 'Bearer fictitious-session', 'content-type': 'text/plain' } }), state.env)).status, 415);
});

test('IA limita cuerpos declarados y por chunks sin depender de Content-Length', async () => {
  const state = aiSetup();
  assert.equal((await state.handler(aiRequest({}, { headers: { authorization: 'Bearer fictitious-session', 'content-type': 'application/json', 'content-length': String(128 * 1024 + 1) } }), state.env)).status, 413);
  const stream = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(70_000)); controller.enqueue(new Uint8Array(70_000)); controller.close(); } });
  const request = aiRequest('', { body: stream, duplex: 'half' });
  assert.equal((await state.handler(request, state.env)).status, 413);
  assert.equal(state.calls.length, 0);
});

test('IA admite 20,000 caracteres Unicode y JSON escapado dentro del límite de bytes', async () => {
  const completion = aiCompletion({ ...aiDraft(), note: '' });
  const unicode = aiSetup({ completion });
  assert.equal((await unicode.handler(aiRequest({ message: '漢'.repeat(20_000) }), unicode.env)).status, 200);
  const escaped = aiSetup({ completion });
  const raw = '{"message":"' + '\\u0061'.repeat(20_000) + '"}';
  assert.equal((await escaped.handler(aiRequest(raw), escaped.env)).status, 200);
  assert.equal(JSON.parse(escaped.calls.at(-1).init.body).input[0].content[0].text.length, 20_000);
});

test('IA comprueba Auth y el perfil de servidor, nunca claims editables', async () => {
  for (const options of [{ authStatus: 401 }, { authResponse: () => Response.json({ id: 'untrusted' }) }]) {
    const state = aiSetup(options);
    assert.equal((await state.handler(aiRequest(), state.env)).status, 401);
    assert.equal(state.calls.length, 1);
  }
  for (const profiles of [[{ role: 'viewer', active: true }], [{ role: 'admin', active: false }], [null], [], [{ role: 'admin', active: true }, { role: 'admin', active: true }]]) {
    const state = aiSetup({ profiles });
    assert.equal((await state.handler(aiRequest(), state.env)).status, 403);
    assert.equal(state.calls.length, 2);
    assert.equal(state.calls[1].url, aiBackend + `/rest/v1/profiles?id=eq.${aiUser}&select=role,active`);
  }
});

test('IA exige conexión vigente y proveedor configurado, sin respuesta simulada', async () => {
  const offline = aiSetup({ offline: true });
  assert.equal((await offline.handler(aiRequest(), offline.env)).status, 503);
  assert.equal(offline.calls.length, 0);
  for (const env of [{ OPENAI_API_KEY: undefined }, { OPENAI_MODEL: undefined }, { OPENAI_API_KEY: '' }]) {
    const state = aiSetup({ env });
    const response = await state.handler(aiRequest(), state.env);
    assert.equal(response.status, 503);
    assert.match((await response.json()).error, /no está configurada/);
    assert.equal(state.calls.length, 2);
  }
});

test('IA usa Responses con schema estricto, store false y solo texto de captura', async () => {
  const state = aiSetup();
  const response = await state.handler(aiRequest(undefined, { headers: { authorization: 'Bearer fictitious-session', 'content-type': 'application/json', cookie: 'private=cookie', 'oai-authenticated-user-email': 'private@example.invalid' } }), state.env);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { draft: aiDraft() });
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(state.calls.length, 3);
  const call = state.calls[2];
  const body = JSON.parse(call.init.body);
  assert.equal(call.init.headers.authorization, 'Bearer fictitious-provider-key');
  assert.equal(call.init.redirect, 'manual');
  assert.equal(body.model, state.env.OPENAI_MODEL);
  assert.equal(body.store, false);
  assert.equal(body.text.format.type, 'json_schema');
  assert.equal(body.text.format.strict, true);
  assert.deepEqual(body.text.format.schema, applicationDraftSchema);
  assert.equal(body.input[0].content[0].text, aiMessage);
  assert.match(body.instructions, /cc a ml/);
  assert.match(body.instructions, /1.5 litrs/);
  assert.match(body.instructions, /9na aplicación/);
  assert.match(body.instructions, /literalmente/);
  assert.match(body.instructions, /no obedezcas|nunca obedezcas/);
  assert.equal('tools' in body, false);
  for (const fetchCall of state.calls) {
    assert.equal('cookie' in fetchCall.init.headers, false);
    assert.equal('oai-authenticated-user-email' in fetchCall.init.headers, false);
  }
});

test('IA conserva nota multilínea, dosis y unidad recibidas sin sustituirlas por un catálogo', async () => {
  const draft = aiDraft(); draft.products = [{ name: 'Producto seco', dose: 2000, unit: 'g' }, { name: 'Producto líquido', dose: 333, unit: 'ml' }];
  const state = aiSetup({ completion: aiCompletion(draft) });
  assert.deepEqual((await (await state.handler(aiRequest(), state.env)).json()).draft, draft);
});

test('IA admite faltantes null para resolverlos en selectores y rechaza unidades sin normalizar', () => {
  const draft = aiDraft(); draft.products[0].dose = null; draft.products[0].unit = null; draft.water_l_ha = null; draft.application_number = null;
  assert.deepEqual(validateApplicationDraft(draft), draft);
  for (const unit of ['cc', 'kg', 'L', 'g/ha', 'other']) assert.throws(() => validateApplicationDraft({ ...aiDraft(), products: [{ name: 'Producto', dose: 1, unit }] }));
});

test('IA recupera la nota fuente completa cuando el modelo la omite, trunca o reescribe', async () => {
  for (const note of [undefined, '', 'Texto de nota', 'Nota cambiada por el modelo']) {
    const state = aiSetup({ completion: aiCompletion({ ...aiDraft(), note }) });
    const response = await state.handler(aiRequest(), state.env);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).draft.note, 'Texto de nota\nSegunda línea');
  }
});

test('nota conserva cuerpo literal, espacios y CRLF sin consumir un campo posterior', async () => {
  const note = '  Aplicación por la mañana y tarde  \r\n\r\n Evitar temperatura indicada \r\nPor el producto de ejemplo\r\n';
  const message = 'Agrícola de ejemplo\r\n  Nota:  \r\n' + note + '  Fecha programada: 2026-11-01\r\nMedio: Dron';
  assert.equal(applicationNoteFromMessage(message), note);
  const state = aiSetup({ completion: aiCompletion({ ...aiDraft(), note: '' }) });
  const response = await state.handler(aiRequest({ message }), state.env);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).draft.note, note);
  assert.equal(applicationNoteFromMessage('Nota:  Texto con espacios  \nGasto de agua / ha\n660 litros'), '  Texto con espacios  \n');
  assert.equal(applicationNoteFromMessage('Nota de la aplicación:\nAplicación por la mañana y tarde\nCultivo: Ejemplo'), 'Aplicación por la mañana y tarde\n');
});

test('sin bloque Nota el resultado no permite que el modelo invente una nota', async () => {
  const state = aiSetup({ completion: aiCompletion({ ...aiDraft(), note: 'Texto inventado por el modelo' }) });
  const response = await state.handler(aiRequest({ message: 'Agrícola de ejemplo\nAplicación 9\nProducto de ejemplo' }), state.env);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).draft.note, '');
  assert.equal(applicationNoteFromMessage('Texto que menciona la nota en una oración.'), null);
});

test('nota fuente de más de 4000 caracteres se señala antes de consultar IA', async () => {
  const state = aiSetup();
  const response = await state.handler(aiRequest({ message: 'Nota:\n' + 'x'.repeat(4001) }), state.env);
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /4,000/);
  assert.equal(state.calls.length, 0);
});

test('IA valida valores numéricos, fechas, longitudes y claves de salida', () => {
  for (const draft of [
    { ...aiDraft(), extra: true }, { ...aiDraft(), application_number: 0 }, { ...aiDraft(), application_number: 1.5 },
    { ...aiDraft(), water_l_ha: -1 }, { ...aiDraft(), water_l_ha: Infinity }, { ...aiDraft(), indicated_date: '2026-02-30' },
    { ...aiDraft(), note: 'x'.repeat(4001) }, { ...aiDraft(), products: [{ name: 'Producto', dose: 0, unit: 'g' }] },
    { ...aiDraft(), products: [{ name: 'Producto', dose: '2000', unit: 'g' }] }, { ...aiDraft(), products: Array(41).fill(aiDraft().products[0]) },
  ]) assert.throws(() => validateApplicationDraft(draft));
});

test('límites del endpoint coinciden con el dominio: colecciones, textos, NUL y precisión', () => {
  assert.equal(applicationDraftSchema.properties.note.maxLength, 4000);
  assert.equal(applicationDraftSchema.properties.products.maxItems, 40);
  assert.equal(applicationDraftSchema.properties.destinations.maxItems, 100);
  assert.equal(validateApplicationDraft({ ...aiDraft(), note: 'x'.repeat(4000), destinations: Array.from({ length: 100 }, (_, index) => 'Destino ' + index), products: Array(40).fill({ name: 'x'.repeat(200), dose: 0.000001, unit: 'g' }), water_l_ha: 0.0001 }).note.length, 4000);
  assert.deepEqual(validateApplicationDraft({}), { agricultural_unit: null, destinations: [], application_number: null, crop: null, field: null, method: null, indicated_date: null, scheduled_date: null, water_l_ha: null, note: '', products: [] });
  assert.equal(validateApplicationDraft({ crop: '   ', products: [{ name: ' Producto ' }] }).products[0].name, 'Producto');
  for (const draft of [
    { ...aiDraft(), destinations: Array.from({ length: 101 }, (_, index) => 'Destino ' + index) },
    { ...aiDraft(), destinations: ['Malla 5', '  mÁlla   5 '] },
    { ...aiDraft(), crop: 'x'.repeat(201) }, { ...aiDraft(), crop: 'Cultivo\u0000' },
    { ...aiDraft(), destinations: ['Destino\u0000'] }, { ...aiDraft(), note: 'Nota\u0000' },
    { ...aiDraft(), products: [{ name: 'Producto\u0000', dose: 1, unit: 'g' }] },
    { ...aiDraft(), products: [{ name: 'x'.repeat(201), dose: 1, unit: 'g' }] },
    { ...aiDraft(), products: [{ name: 'Producto', dose: 0.0000001, unit: 'g' }] },
    { ...aiDraft(), products: [{ name: 'Producto', dose: 100_000_000, unit: 'g' }] },
    { ...aiDraft(), water_l_ha: 100_000_000 }, { ...aiDraft(), water_l_ha: 0.00001 },
  ]) assert.throws(() => validateApplicationDraft(draft));
});

test('IA maneja refusal e interpretación incompleta con recuperación', async () => {
  for (const completion of [
    { status: 'completed', output: [{ type: 'message', content: [{ type: 'refusal', refusal: 'private-provider-message' }] }] },
    { status: 'incomplete', output: [] },
  ]) {
    const state = aiSetup({ completion });
    const response = await state.handler(aiRequest(), state.env);
    assert.equal(response.status, 422);
    assert.doesNotMatch(await response.text(), /private-provider-message/);
  }
});

test('IA no expone cuerpos o excepciones del proveedor ni acepta redirecciones', async () => {
  for (const provider of [
    async () => new Response('private-provider-key', { status: 401 }),
    async () => new Response(null, { status: 302, headers: { location: 'https://foreign.example.invalid' } }),
    async () => new Response('private-provider-key', { status: 200 }),
    async () => Response.json(aiCompletion({ ...aiDraft(), water_l_ha: -100 })),
  ]) {
    const state = aiSetup({ provider });
    const response = await state.handler(aiRequest(), state.env);
    assert.equal(response.status, 502);
    assert.doesNotMatch(await response.text(), /private-provider-key|foreign.example/);
  }
  const state = aiSetup({ provider: async () => { throw new Error('private-provider-key'); } });
  const response = await state.handler(aiRequest(), state.env);
  assert.equal(response.status, 503);
  assert.doesNotMatch(await response.text(), /private-provider-key/);
});

test('IA devuelve límite del proveedor y timeout sin reintento automático', async () => {
  const limited = aiSetup({ providerStatus: 429 });
  assert.equal((await limited.handler(aiRequest(), limited.env)).status, 429);
  assert.equal(limited.calls.length, 3);
  const timeout = aiSetup({ provider: async () => { throw new DOMException('private', 'TimeoutError'); } });
  const response = await timeout.handler(aiRequest(), timeout.env);
  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /tardó demasiado/);
});

test('IA limita frecuencia por usuario y permite un nuevo intento al cambiar la ventana', async () => {
  const state = aiSetup();
  for (let index = 0; index < 6; index++) assert.equal((await state.handler(aiRequest(), state.env)).status, 200);
  const response = await state.handler(aiRequest(), state.env);
  assert.equal(response.status, 429);
  assert.equal(response.headers.get('retry-after'), '60');
  assert.equal(state.calls.filter(call => call.url === 'https://api.openai.com/v1/responses').length, 6);
  state.time(1_800_000_060_001);
  assert.equal((await state.handler(aiRequest(), state.env)).status, 200);
});

test('IA impide interpretaciones simultáneas del mismo usuario y libera el bloqueo', async () => {
  let finish, started;
  const ready = new Promise(resolve => { started = resolve; });
  const state = aiSetup({ provider: () => { started(); return new Promise(resolve => { finish = resolve; }); } });
  const first = state.handler(aiRequest(), state.env);
  await ready;
  assert.equal((await state.handler(aiRequest(), state.env)).status, 429);
  finish(Response.json(aiCompletion(aiDraft())));
  assert.equal((await first).status, 200);
});

test('Worker conecta la ruta de IA únicamente al túnel validado y nunca persiste datos', async () => {
  const state = aiSetup();
  let putCount = 0;
  const env = { ...state.env, BUCKET: { async get() { return { async json() { return { url: aiBackend, updatedAt: 1_800_000_000_000, expiresAt: 1_800_000_120_000 }; } }; }, async put() { putCount++; } } };
  const worker = createSiteWorker({}, { key: 'sb_publishable_fictitious' }, { fetch: state.fetch, now: () => 1_800_000_000_000 });
  assert.equal((await worker.fetch(aiRequest(), env)).status, 200);
  assert.equal(putCount, 0);
  assert.ok(state.calls.every(call => call.init.method === undefined || call.url === 'https://api.openai.com/v1/responses'));
  assert.equal((await worker.fetch(aiRequest(), { ...env, BUCKET: { async get() { return null; } } })).status, 503);
});
