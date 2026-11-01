import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateApplicationQuery, createApplicationQueryRunner, formatApplicationQueryAnswer } from '../server/application-queries.mjs';

const user = '11111111-1111-4111-8111-111111111111';
const order = '22222222-2222-4222-8222-222222222222';
const result = (query = { operation: 'historial', status: 'all', limit: 10, offset: 0 }) => ({ revision: 'revision-1', as_of: '2026-11-01T12:00:00Z', query,
  summary: { destination_count: 2, order_count: 1, liquid_ml: 1500, solid_g: 1000, total_rows: 2 }, rows: [], sources: [{ order_id: order, folio: 'F1' }], incomplete_count: 0, truncated: false });

test('consultas validan fechas reales, parámetros exactos, identidades, límites y estados', () => {
  for (const query of [{ operation: 'sql' }, { operation: 'historial', sql: 'select 1' }, { operation: 'historial', project_id: 'no-id' }, { operation: 'historial', from: '2026-02-30' }, { operation: 'historial', from: '2026-11-02', to: '2026-11-01' }, { operation: 'historial', limit: 31 }, { operation: 'historial', offset: 1001 }, { operation: 'historial', status: 'other' }, { operation: 'pendientes', status: 'performed' }, { operation: 'historial', stage_number: 1.5 }]) assert.throws(() => validateApplicationQuery(query));
  assert.equal(validateApplicationQuery({ operation: 'uso_producto' }).status, 'performed');
  assert.equal(validateApplicationQuery({ operation: 'historial' }).status, 'all');
  assert.equal(validateApplicationQuery({ operation: 'pendientes' }).status, 'indicated');
  assert.equal(validateApplicationQuery({ operation: 'historial', lot: '  Lote 4 ' }).lot, 'Lote 4');
});

function runnerSetup() {
  let revision = 'revision-1', available = true, stampCalls = 0, queryCalls = 0;
  const storage = new Map();
  const env = { BUCKET: { async get(key) { const data = storage.get(key); return data ? { size: data.length, async json() { return JSON.parse(data); } } : null; }, async put(key, data) { storage.set(key, data); } } };
  const options = { key: 'sb_publishable_fictitious', now: () => 1000, fetch: async (url, init) => {
    assert.equal(init.headers.authorization, 'Bearer fictitious-session');
    if (url.endsWith('application_query_stamp')) { stampCalls++; return available ? Response.json({ revision, as_of: '2026-11-01T12:00:00Z' }) : Response.json({ error: 'expired' }, { status: 403 }); }
    queryCalls++; const data = result(JSON.parse(init.body).p_query); data.revision = revision; data.query.lot_id = order; return Response.json(data);
  } };
  const auth = { base: 'https://fictitious.example.invalid', authorization: 'Bearer fictitious-session', userId: user, env, signal: AbortSignal.timeout(5000) };
  return { options, auth, storage, runner: createApplicationQueryRunner(options), counts: () => ({ stampCalls, queryCalls }), revise() { revision = 'revision-2'; }, revoke() { available = false; } };
}

test('caché comprueba revisión en cada petición, conserva IDs resueltos e invalida al cambiar datos', async () => {
  const state = runnerSetup();
  const query = { operation: 'historial', lot: 'Lote 4' };
  assert.equal((await state.runner.run(query, state.auth)).cached, false);
  const second = await state.runner.run(query, state.auth);
  assert.equal(second.cached, true); assert.equal(second.query.lot_id, order);
  assert.deepEqual(state.counts(), { stampCalls: 2, queryCalls: 1 });
  state.revise(); assert.equal((await state.runner.run(query, state.auth)).cached, false);
  assert.equal(state.counts().queryCalls, 2);
});

test('caché persistente reutiliza entre instancias y aísla usuarios y filtros', async () => {
  const state = runnerSetup();
  await state.runner.run({ operation: 'historial' }, state.auth);
  const otherInstance = createApplicationQueryRunner(state.options);
  assert.equal((await otherInstance.run({ operation: 'historial' }, state.auth)).cached, true);
  assert.equal((await otherInstance.run({ operation: 'historial', status: 'performed' }, state.auth)).cached, false);
  assert.equal((await otherInstance.run({ operation: 'historial' }, { ...state.auth, userId: order })).cached, false);
  for (const [key, data] of state.storage) { assert.doesNotMatch(key, /Bearer|session/); assert.doesNotMatch(data, /fictitious-session|sb_publishable/); }
});

test('revocación o desconexión impide servir caché aunque exista un resultado anterior', async () => {
  const state = runnerSetup();
  await state.runner.run({ operation: 'historial' }, state.auth);
  state.revoke(); await assert.rejects(state.runner.run({ operation: 'historial' }, state.auth), /permisos/);
  assert.equal(state.counts().queryCalls, 1);
});

test('fallos opcionales de caché no convierten consulta confirmada en fallo', async () => {
  const state = runnerSetup();
  const auth = { ...state.auth, env: { BUCKET: { get() { throw new Error('offline'); }, put() { throw new Error('offline'); } } } };
  assert.equal((await state.runner.run({ operation: 'historial' }, auth)).result.summary.destination_count, 2);
});

test('respuesta distingue unidades, promedio ponderado, órdenes/destinos y consumo real', () => {
  const data = result({ operation: 'uso_producto', status: 'all' });
  data.rows = [{ product_name: 'Producto de ejemplo', unit: 'ml', quantity: 1500, average_dose: 750, destination_count: 2 }];
  const answer = formatApplicationQueryAnswer(data);
  assert.match(answer, /2 destinos en 1 orden/); assert.match(answer, /1.50 L y 1.00 kg/); assert.match(answer, /no equivalen a consumo real/); assert.match(answer, /750.00 ml\/ha/);
});

test('detalle expone agua, equipo, aplicador y notas y cambios no inventa conteos de destinos', () => {
  const data = result({ operation: 'detalle', status: 'performed' });
  data.rows = [{ folio: 'F1', water_l_ha: 250, equipment: 'Equipo ejemplo', applicator: 'Persona ejemplo', observations: 'Nota ejemplo', products: [] }];
  const answer = formatApplicationQueryAnswer(data);
  for (const text of ['250.00 L/ha', 'Equipo ejemplo', 'Persona ejemplo', 'Nota ejemplo']) assert.ok(answer.includes(text));
  data.query = { operation: 'cambios' }; data.summary = { event_count: 1, total_rows: 1 }; data.rows = [{ kind: 'indication', version: 1, reason: 'Motivo ejemplo' }];
  assert.doesNotMatch(formatApplicationQueryAnswer(data), /0 destinos/);
});

test('respuesta muestra hasta 30 filas y explica fuentes de muestra o abreviación por tamaño', () => {
  const data = result(); data.sources_truncated = true;
  data.rows = Array.from({ length: 30 }, (_, index) => ({ folio: 'Folio-' + (index + 1), products: [] }));
  assert.match(formatApplicationQueryAnswer(data), /Folio-30/); assert.match(formatApplicationQueryAnswer(data), /muestra/);
  data.rows = data.rows.map(row => ({ ...row, products: Array.from({ length: 8 }, () => ({ product_name: 'x'.repeat(200), dose: 1, unit: 'ml' })) }));
  const answer = formatApplicationQueryAnswer(data); assert.ok(answer.length <= 7000); assert.match(answer, /abreviada/);
});
