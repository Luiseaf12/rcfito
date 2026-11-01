import test from 'node:test'
import assert from 'node:assert/strict'
import { readAiSettings, testAiConnection, persistAiSettings } from '../src/data/ai-settings'

const state = { configured: true, model: 'modelo-ficticio', keySuffix: 'demo', revision: 'revision-ficticia', storageReady: true, source: 'saved', testedAt: '2026-10-31T23:00:00Z' }
test('consulta solo el estado autorizado y descarta campos secretos inesperados del servidor', async t => {
  const calls: { url: unknown; options?: RequestInit }[] = []
  t.mock.method(globalThis, 'fetch', async (url: unknown, options?: RequestInit) => { calls.push({ url, options }); return Response.json({ ...state, apiKey: 'valor-ficticio-que-no-debe-regresar' }) })
  const result = await readAiSettings('sesion-ficticia')
  assert.deepEqual(result, state)
  assert.equal(calls[0].url, '/api/ai-settings')
  assert.equal(calls[0].options?.method, 'GET')
  assert.equal(calls[0].options?.cache, 'no-store')
  assert.equal(calls[0].options?.body, undefined)
  assert.equal(new Headers(calls[0].options?.headers).get('authorization'), 'Bearer sesion-ficticia')
})
test('prueba y guardado son acciones separadas y la clave nunca forma parte de la URL', async t => {
  const calls: { url: unknown; options?: RequestInit }[] = []
  t.mock.method(globalThis, 'fetch', async (url: unknown, options?: RequestInit) => {
    calls.push({ url, options })
    return Response.json(String(url).endsWith('/test') ? { ok: true, testToken: 'comprobante-ficticio', model: 'modelo-ficticio' } : state)
  })
  const input = { apiKey: 'credencial-ficticia-solo-en-el-cuerpo', model: 'modelo-ficticio', revision: 'revision-ficticia' }
  const tested = await testAiConnection('sesion-ficticia', input)
  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, '/api/ai-settings/test')
  assert.equal(calls[0].options?.method, 'POST')
  assert.deepEqual(JSON.parse(String(calls[0].options?.body)), input)
  assert.deepEqual(await persistAiSettings('sesion-ficticia', { ...input, testToken: tested.testToken }), state)
  assert.equal(calls[1].url, '/api/ai-settings')
  assert.equal(calls[1].options?.method, 'PUT')
})
test('conservar la clave guardada no solicita ni recibe su texto', async t => {
  t.mock.method(globalThis, 'fetch', async (_url: unknown, options?: RequestInit) => {
    const body = JSON.parse(String(options?.body))
    assert.equal(Object.hasOwn(body, 'apiKey'), false)
    return Response.json(state)
  })
  assert.equal((await persistAiSettings('sesion-ficticia', { model: 'modelo-ficticio', revision: 'revision-ficticia', testToken: 'comprobante-ficticio' })).keySuffix, 'demo')
})
test('un resultado incompleto, fallido o de otro modelo no habilita el guardado', async t => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ ok: true, testToken: 'comprobante', model: 'otro-modelo' }))
  await assert.rejects(testAiConnection('sesion-ficticia', { model: 'modelo-ficticio', revision: null }), /prueba no se confirmó/i)
  t.mock.method(globalThis, 'fetch', async () => Response.json({ error: 'La revisión cambió. Actualiza el estado.' }, { status: 409 }))
  await assert.rejects(readAiSettings('sesion-ficticia'), /revisión cambió/)
  t.mock.method(globalThis, 'fetch', async () => new Response('Respuesta interrumpida', { status: 502 }))
  await assert.rejects(readAiSettings('sesion-ficticia'), /actualiza el estado/)
})
