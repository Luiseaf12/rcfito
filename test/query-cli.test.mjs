import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseQueryCli, runQueryCli } from '../scripts/query-cli.mjs';

const site = 'https://rcfito.paxxa.chatgpt.site';
const token = 'fictitious-session';
test('CLI interpreta filtros, estados y unidades de paginación y rechaza comandos/credenciales arbitrarios', () => {
  const parsed = parseQueryCli(['uso-producto', '--producto', 'Producto ejemplo', '--estado', 'realizadas', '--desde', '2026-10-01', '--limite', '20', '--json']);
  assert.equal(parsed.query.operation, 'uso_producto'); assert.equal(parsed.query.status, 'performed'); assert.equal(parsed.query.limit, 20); assert.equal(parsed.json, true);
  for (const args of [['sql'], ['historial', '--token', token], ['historial', '--limite', '31'], ['historial', '--desde', '2026-02-30'], ['historial', '--estado', 'inventado'], ['historial', '--json', '--json'], ['login', '--url', 'http://foreign.invalid'], ['login', '--url', 'https://user:password@example.invalid'], ['historial', '--producto']]) assert.throws(() => parseQueryCli(args));
});

test('CLI ejecuta endpoint de rutinas y JSON sin enviar credenciales en cuerpo ni consumir IA', async () => {
  const calls = [], outputs = [];
  await runQueryCli(['historial', '--json'], { env: { RCFITO_ACCESS_TOKEN: token }, output: text => outputs.push(text), fetch: async (url, init) => {
    calls.push({ url, init }); return Response.json({ answer: 'Sin coincidencias', result: { as_of: '2026-11-01T12:00:00Z' }, usage: { inputTokens: 0, outputTokens: 0, toolCalls: 1 } });
  } });
  assert.equal(calls.length, 1); assert.equal(calls[0].url, site + '/api/application-query'); assert.equal(calls[0].init.headers.authorization, 'Bearer ' + token);
  assert.doesNotMatch(calls[0].init.body, /fictitious-session/); assert.doesNotMatch(outputs.join(''), /fictitious-session/); assert.equal(JSON.parse(outputs[0]).usage.inputTokens, 0);
});

test('CLI rechaza otra URL antes de enviar sesión guardada', async () => {
  await assert.rejects(runQueryCli(['historial', '--url', 'https://foreign.invalid'], { env: {}, readSession: async () => ({ site, access_token: token }), fetch: async () => { throw new Error('No debe enviar'); } }), /no coincide/);
});

test('login y refresh usan conexión gestionada del mismo origen sin imprimir contraseña o tokens', async () => {
  const outputs = [], saved = [], calls = []; let queryCalls = 0;
  const deps = { env: {}, output: text => outputs.push(text), promptCredentials: async () => ({ email: 'example@example.invalid', password: 'fictitious-password' }), saveSession: async session => saved.push(session), readSession: async () => ({ site, access_token: 'expired', refresh_token: 'fictitious-refresh' }), fetch: async (url, init) => {
    calls.push({ url, init });
    if (url.endsWith('/rcfito-config.json')) return Response.json({ managed: true, url: '/supabase', key: 'sb_publishable_fictitious' });
    if (url.includes('/auth/v1/token')) return Response.json({ access_token: token, refresh_token: 'new-fictitious-refresh', expires_at: 1800000000 });
    queryCalls++; return queryCalls === 1 ? Response.json({ error: 'expired' }, { status: 401 }) : Response.json({ answer: 'Consulta lista', result: { as_of: '2026-11-01' } });
  } };
  await runQueryCli(['login'], deps); await runQueryCli(['historial'], deps);
  assert.equal(saved.length, 2); assert.ok(calls.some(call => call.url.endsWith('grant_type=refresh_token')));
  assert.doesNotMatch(outputs.join(''), /fictitious-password|fictitious-refresh|fictitious-session/);
});

test('CLI logout revoca sesión y retira archivo local sin revelar credenciales', async () => {
  let removed = false; const calls = [];
  await runQueryCli(['logout'], { output() {}, readSession: async () => ({ site, access_token: token }), removeSession: async () => { removed = true; }, fetch: async (url, init) => { calls.push({ url, init }); return url.endsWith('/rcfito-config.json') ? Response.json({ managed: true, url: '/supabase', key: 'sb_publishable_fictitious' }) : new Response(null, { status: 204 }); } });
  assert.equal(removed, true); assert.equal(calls[1].url, site + '/supabase/auth/v1/logout?scope=local');
});
