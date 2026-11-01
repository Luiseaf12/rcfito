import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApplicationChatService } from '../server/application-chat.mjs';
import { createApplicationQueryRunner, parseQuickProductQuestion, formatApplicationQueryTables } from '../server/application-queries.mjs';
import { runQueryCli, parseQueryCli } from '../scripts/query-cli.mjs';

const origin = 'https://rcfito.paxxa.chatgpt.site';
const unit = '11111111-1111-4111-8111-111111111111';
const project = '22222222-2222-4222-8222-222222222222';
const lot = '33333333-3333-4333-8333-333333333333';
const otherUser = '44444444-4444-4444-8444-444444444444';
const order = '55555555-5555-4555-8555-555555555555';
const question = 'cuánto de cada producto se ha aplicado en malla 5';
function contextSetup(options = {}) {
  const objects = new Map(), calls = [], queries = [];
  const env = { BUCKET: { async get(key) { const value = objects.get(key); return value ? { size: value.length, async json() { return JSON.parse(value); } } : null; }, async put(key, value) { objects.set(key, value); } } };
  const backendFetch = async (url, init) => {
    calls.push(url);
    if (url.endsWith('/auth/v1/user')) return Response.json({ id: init.headers.authorization.includes('other') ? otherUser : unit });
    if (url.includes('/profiles?')) return Response.json([{ role: 'viewer', active: true }]);
    if (url.endsWith('/application_query_stamp')) return Response.json({ revision: 'r1', as_of: '2026-11-01T12:00:00Z' });
    if (url.endsWith('/application_query_resolve')) {
      const body = JSON.parse(init.body);
      if (!body.p_query.agricultural_unit_id && body.p_last_unit_id !== unit) return Response.json({ revision: 'r1', as_of: '2026-11-01T12:00:00Z', query: body.p_query, filters: [], clarification: 'Elige una agrícola autorizada.', choices: [] });
      assert.equal(body.p_query.lot, 'malla 5');
      const query = { ...body.p_query, agricultural_unit_id: unit, project_id: project, lot_id: lot }; delete query.lot;
      return Response.json({ revision: 'r1', as_of: '2026-11-01T12:00:00Z', query, filters: [
        { key: 'agricultural_unit', label: 'Agrícola', value: 'Ensenada ficticia', source: body.p_query.agricultural_unit_id ? 'explicit' : 'last_used' },
        { key: 'project', label: 'Temporada', value: 'Temporada actual ficticia', source: 'active_season' },
        { key: 'lot', label: 'Lote', value: 'Lote único de Malla 5', source: 'unique_match' },
        { key: 'status', label: 'Estado', value: 'Realizadas', source: 'explicit' },
      ] });
    }
    if (url.endsWith('/application_query')) {
      const query = JSON.parse(init.body).p_query; queries.push(query);
      const resolved = query.operation === 'uso_producto';
      if (resolved) { assert.equal(query.agricultural_unit_id, unit); assert.equal(query.project_id, project); assert.equal(query.lot_id, lot); assert.equal(query.status, 'performed'); }
      const total = options.total ?? 2;
      const rows = resolved ? Array.from({ length: Math.min(30, Math.max(0, total - query.offset)) }, (_, i) => {
        const index = i + query.offset;
        return { product_id: `product-${index}`, product_name: index ? `Producto sólido ficticio ${index}` : 'Producto líquido ficticio', unit: index ? 'g' : 'ml', quantity: index ? 750 : 2500, destination_count: 2, order_count: 1 };
      }) : [{ agricultural_unit_id: unit }];
      return Response.json({ revision: options.changePage && query.offset ? 'r2' : 'r1', as_of: '2026-11-01T12:00:00Z', query, summary: { destination_count: 2, order_count: 1, total_rows: total, liquid_ml: 2500, solid_g: 750 * (total - 1) }, rows,
        sources: [{ order_id: order, folio: 'FICTICIO-1' }], source_count: 1, incomplete_count: 0, truncated: resolved && query.offset + rows.length < total });
    }
    throw new Error('La prueba no permite inferencia ni otros servicios.');
  };
  const service = createApplicationChatService({ key: 'sb_publishable_fictitious', fetch: backendFetch, backendUrl: async () => 'https://fictitious.invalid', configuration: async () => { throw new Error('No debe consultar IA para esta pregunta.'); } });
  const bridge = async (url, init) => service.handle(new Request(url, init), env);
  const cli = (args, token = 'fixture-session') => runQueryCli(args, { env: { RCFITO_ACCESS_TOKEN: token }, fetch: bridge, output: text => outputs.push(text) });
  const outputs = [];
  return { objects, calls, queries, env, bridge, cli, outputs, service, backendFetch };
}

test('la pregunta literal y acentos resuelven intención, sin confundir malla5/15 o varias mallas', () => {
  assert.deepEqual(parseQuickProductQuestion('¿Cuánto de cada producto se ha aplicado en malla 5?'), { operation: 'uso_producto', status: 'performed', lot: 'malla 5', limit: 30, offset: 0 });
  assert.equal(parseQuickProductQuestion('Cuanto de cada producto se aplicó en malla 15.').lot, 'malla 15');
  assert.equal(parseQuickProductQuestion(question + ' y malla 15'), null);
  assert.equal(parseQuickProductQuestion('cuánto de cada producto se ha indicado en malla 5'), null);
});

test('CLI con solo la pregunta usa última agrícola Ensenada, temporada activa, lote único y devuelve totales sin IA', async () => {
  const state = contextSetup();
  // A prior completed query establishes which farm the user last used.
  await state.cli(['historial', '--agricola-id', unit, '--json']);
  await state.cli([question, '--json']);
  const response = JSON.parse(state.outputs.at(-1));
  assert.equal(response.usage.inputTokens, 0); assert.equal(response.usage.outputTokens, 0);
  assert.equal(response.result.filters.find(filter => filter.key === 'agricultural_unit').source, 'last_used');
  assert.equal(response.result.filters.find(filter => filter.key === 'project').source, 'active_season');
  assert.equal(response.result.filters.find(filter => filter.key === 'lot').source, 'unique_match');
  assert.deepEqual(response.result.rows.map(row => row.quantity), [2500, 750]);
  assert.equal(response.query.status, 'performed');
  assert.ok(state.calls.every(url => !url.includes('openai.com')));
  await state.cli(['preguntar', question]);
  const table = state.outputs.at(-1);
  assert.match(table, /\| Filtro \| Valor aplicado \| Procedencia \|/);
  assert.match(table, /Ensenada ficticia/); assert.match(table, /Última agrícola utilizada/);
  assert.match(table, /\| Producto \| Total aplicado \| Unidad \|/);
  assert.match(table, /Producto líquido ficticio \| 2.50 \| L/);
  assert.match(table, /Producto sólido ficticio 1 \| 0.75 \| kg/);
});

test('el contexto recordado está ligado al usuario, no se reutiliza entre cuentas', async () => {
  const state = contextSetup(); await state.cli(['historial', '--agricola-id', unit, '--json']);
  await state.cli(['preguntar', question, '--json'], 'other-session');
  const response = JSON.parse(state.outputs.at(-1));
  assert.equal(response.result.rows.length, 0); assert.match(response.result.clarification, /Elige una agrícola/);
});

test('una conversación abierta puede aportar su última agrícola antes de existir preferencia guardada', async () => {
  const state = contextSetup();
  const response = await state.bridge(origin + '/api/application-chat', { method: 'POST', headers: { authorization: 'Bearer fixture-session', 'content-type': 'application/json' }, body: JSON.stringify({ message: question, previousQuery: { operation: 'historial', agricultural_unit_id: unit } }) });
  const body = await response.json();
  assert.equal(response.status, 200); assert.equal(body.query.agricultural_unit_id, unit); assert.equal(body.usage.inputTokens, 0);
});

test('lista completa pagina productos y conserva filtros sin omitir el producto31', async () => {
  const state = contextSetup({ total: 35 }); await state.cli(['historial', '--agricola-id', unit, '--json']);
  await state.cli(['preguntar', question, '--json']);
  const result = JSON.parse(state.outputs.at(-1)).result;
  assert.equal(result.rows.length, 35); assert.equal(result.truncated, false); assert.equal(result.rows[34].product_name, 'Producto sólido ficticio 34');
  assert.deepEqual(state.queries.filter(query => query.operation === 'uso_producto').map(query => query.offset), [0, 30]);
});

test('elegir una agrícola tras aclaración vuelve a resolver temporada/lote y completa productos', async () => {
  const state = contextSetup({ total: 35 });
  const response = await state.bridge(origin + '/api/application-query', { method: 'POST', headers: { authorization: 'Bearer fixture-session', 'content-type': 'application/json' }, body: JSON.stringify({ query: { operation: 'uso_producto', agricultural_unit_id: unit, lot: 'malla 5', status: 'performed', limit: 30, offset: 0 } }) });
  const body = await response.json();
  assert.equal(response.status, 200); assert.equal(body.query.project_id, project); assert.equal(body.query.lot_id, lot); assert.equal(body.result.rows.length, 35);
  assert.ok(body.result.filters.some(filter => filter.source === 'active_season')); assert.equal(body.usage.inputTokens, 0);
});

test('cambios durante paginación no devuelven una tabla mezclada de revisiones', async () => {
  const state = contextSetup({ total: 35, changePage: true }); await state.cli(['historial', '--agricola-id', unit, '--json']);
  await assert.rejects(state.cli(['preguntar', question]), /cambiaron al completar/);
});

test('al superar300 productos informa que se acoten filtros y conserva el resultado como parcial', async () => {
  const state = contextSetup({ total: 305 }); await state.cli(['historial', '--agricola-id', unit, '--json']);
  await state.cli(['preguntar', question, '--json']);
  const response = JSON.parse(state.outputs.at(-1));
  assert.equal(response.result.rows.length, 300); assert.equal(response.result.truncated, true);
  assert.equal(response.queryOptions.completeProducts, true);
  // Even an abbreviated narrative must not direct the user to a repeated page.
  assert.doesNotMatch(response.answer, /solicita la siguiente página/);
});

test('CLI preguntar limita argumentos y tabla identifica cantidades de estados no realizados', () => {
  assert.equal(parseQueryCli(['preguntar', question]).message, question);
  assert.throws(() => parseQueryCli(['preguntar', question, '--agricola', 'other']));
  assert.throws(() => parseQueryCli(['preguntar', 'x'.repeat(4001)]));
  const table = formatApplicationQueryTables({ query: { operation: 'uso_producto', status: 'cancelled' }, rows: [{ product_name: 'A|B', unit: 'g', quantity: 1000 }], summary: {}, incomplete_count: 0, truncated: true });
  assert.doesNotMatch(table, /Total aplicado/); assert.match(table, /A\\\|B/); assert.match(table, /límite de seguridad/);
});
