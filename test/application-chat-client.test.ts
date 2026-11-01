import test from 'node:test'
import assert from 'node:assert/strict'
import { APPLICATION_AUDIO_MAX_BYTES, applicationQueryFilters, askApplicationChat, buildQueryFromChoice, executeApplicationQuery, transcribeApplicationAudio, validateApplicationAudio, type ApplicationQueryChoice, type ApplicationQueryFilters } from '../src/data/application-chat'

const orderId = '10000000-0000-4000-8000-000000000001'
const projectId = '10000000-0000-4000-8000-000000000002'
const result = {
  revision: 'revision-ficticia', as_of: '2026-11-01T12:00:00Z',
  query: { operation: 'historial', project_id: projectId, status: 'all' },
  summary: { destination_count: 1, order_count: 1 }, rows: [],
  sources: [{ order_id: orderId, folio: 'FICTICIO-1' }], incomplete_count: 0, truncated: false,
}

test('el chat envía pregunta y filtros acotados, sin workspace ni historial completo', async t => {
  let sent: RequestInit | undefined
  t.mock.method(globalThis, 'fetch', async (url: unknown, options?: RequestInit) => {
    assert.equal(url, '/api/application-chat')
    sent = options
    return Response.json({ answer: 'Hay un destino.', result, query: result.query, usage: { inputTokens: 120, outputTokens: 20, toolCalls: 1 }, cached: true, apiKey: 'campo-ficticio-no-permitido' })
  })
  const response = await askApplicationChat('  ¿Qué aplicaciones hay?  ', 'sesion-ficticia', { project_id: projectId, ...{ workspace: { secret: 'no-enviar' } } }, { operation: 'pendientes' })
  assert.deepEqual(JSON.parse(String(sent?.body)), { message: '¿Qué aplicaciones hay?', context: { project_id: projectId }, previousQuery: { operation: 'pendientes' } })
  assert.equal(new Headers(sent?.headers).get('authorization'), 'Bearer sesion-ficticia')
  assert.equal(sent?.cache, 'no-store')
  assert.equal(Object.hasOwn(response, 'apiKey'), false)
  assert.equal(response.cached, true)
  assert.equal(response.result?.sources[0].order_id, orderId)
})

test('los parámetros inválidos y preguntas demasiado largas no consumen el servicio', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => { throw new Error('No debe llamarse') })
  for (const value of [{ from: '2026-02-30' }, { from: '2026-11-02', to: '2026-11-01' }, { limit: 31 }, { offset: -1 }, { operation: 'sql' }, { project_id: '../otro' }]) assert.throws(() => applicationQueryFilters(value))
  await assert.rejects(askApplicationChat('x'.repeat(4001), 'sesion-ficticia'), /4,000/)
  await assert.rejects(askApplicationChat(' ', 'sesion-ficticia'), /pregunta/)
  assert.equal(fetch.mock.callCount(), 0)
})

test('el cliente rechaza referencias manipuladas y resultados incompletos', async t => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ answer: 'Dato ficticio', result: { ...result, sources: [{ order_id: '../../otra-ruta', folio: 'Inválido' }] } }))
  await assert.rejects(askApplicationChat('Pregunta', 'sesion-ficticia'), /referencia no válida/)
  t.mock.method(globalThis, 'fetch', async () => Response.json({ answer: 'Dato ficticio', result: { ...result, incomplete_count: -1 } }))
  await assert.rejects(askApplicationChat('Pregunta', 'sesion-ficticia'), /resultado incompleto/)
})

test('normaliza metadatos opcionales de fuentes y conserva compatibilidad con resultados anteriores', async t => {
  const metadata = { source_count: 24, sources_scope: 'matching_destinations', sources_truncated: true }
  t.mock.method(globalThis, 'fetch', async () => Response.json({ answer: 'Resultado ficticio con muestra.', result: { ...result, ...metadata, sources: [{ ...result.sources[0], target_id: null }] } }))
  const response = await askApplicationChat('Pregunta', 'sesion-ficticia')
  assert.equal(response.result?.source_count, 24)
  assert.equal(response.result?.sources_scope, 'matching_destinations')
  assert.equal(response.result?.sources_truncated, true)
  assert.equal(Object.hasOwn(response.result!.sources[0], 'target_id'), false)
  t.mock.method(globalThis, 'fetch', async () => Response.json({ answer: 'Resultado anterior.', result }))
  assert.equal((await askApplicationChat('Pregunta', 'sesion-ficticia')).result?.source_count, undefined)
})

test('rechaza metadatos de fuentes inválidos sin mostrar una muestra como completa', async t => {
  for (const metadata of [{ source_count: -1 }, { source_count: 1.5 }, { sources_scope: 4 }, { sources_truncated: 'sí' }]) {
    t.mock.method(globalThis, 'fetch', async () => Response.json({ answer: 'Resultado ficticio.', result: { ...result, ...metadata } }))
    await assert.rejects(askApplicationChat('Pregunta', 'sesion-ficticia'), /alcance de fuentes no válido/)
  }
})

test('una elección explícita sustituye solo su nombre ambiguo y conserva los demás filtros', () => {
  const query: ApplicationQueryFilters = { operation: 'historial', agricultural_unit: 'Agrícola ficticia', project: 'Temporada ficticia', field: 'Campo ficticio', lot: 'Lote repetido', product: 'Producto ficticio', folio: 'FOLIO-FICTICIO', from: '2026-10-01', to: '2026-10-31', limit: 20, offset: 0 }
  const mappings = [
    ['agricultural_unit', 'agricultural_unit_id', 'agricultural_unit'],
    ['project', 'project_id', 'project'], ['field', 'field_id', 'field'],
    ['lot', 'lot_id', 'lot'], ['product', 'product_id', 'product'], ['order', 'order_id', 'folio'],
  ] as const
  for (const [kind, idKey, nameKey] of mappings) {
    const selected = buildQueryFromChoice(query, { kind, id: orderId, name: 'Elección ficticia' })
    const expected = { ...query, [idKey]: orderId }
    delete expected[nameKey]
    assert.deepEqual(selected, expected)
  }
  assert.equal(query.lot, 'Lote repetido')
  assert.equal(query.order_id, undefined)
})

test('las opciones requieren un tipo permitido y un UUID válido antes de construir la consulta', async t => {
  for (const choice of [{ kind: 'sql', id: orderId, name: 'Ajena' }, { kind: 'lot', id: '../otra-ruta', name: 'Inválida' }]) assert.throws(() => buildQueryFromChoice(result.query as ApplicationQueryFilters, choice as ApplicationQueryChoice), /opción de selección no válida/)
  t.mock.method(globalThis, 'fetch', async () => Response.json({ answer: 'Precisa la opción.', result: { ...result, choices: [{ kind: 'lot', id: '../otra-ruta', name: 'Inválida' }] } }))
  await assert.rejects(askApplicationChat('Pregunta', 'sesion-ficticia'), /opción de selección no válida/)
})

test('resolver una elección llama a la rutina determinista y normaliza la misma respuesta del chat', async t => {
  const query = buildQueryFromChoice({ operation: 'historial', lot: 'Lote repetido', project_id: projectId, status: 'performed' }, { kind: 'lot', id: orderId, name: 'Lote repetido', project_name: 'Proyecto ficticio', season: '2026' })
  const calls: unknown[] = []
  t.mock.method(globalThis, 'fetch', async (url: unknown, options?: RequestInit) => {
    calls.push(url)
    assert.equal(url, '/api/application-query')
    assert.equal(options?.method, 'POST')
    assert.equal(options?.cache, 'no-store')
    assert.equal(new Headers(options?.headers).get('authorization'), 'Bearer sesion-ficticia')
    assert.deepEqual(JSON.parse(String(options?.body)), { query })
    return Response.json({ answer: 'Consulta ficticia resuelta.', query, result: { ...result, query }, usage: { inputTokens: 0, outputTokens: 0, toolCalls: 1 }, cached: false })
  })
  const response = await executeApplicationQuery(query, 'sesion-ficticia')
  assert.equal(response.answer, 'Consulta ficticia resuelta.')
  assert.deepEqual(response.query, query)
  assert.equal(response.usage?.inputTokens, 0)
  assert.deepEqual(calls, ['/api/application-query'])
})

test('normaliza las opciones autorizadas sin conservar campos inesperados', async t => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ answer: 'Elige un lote.', result: { ...result, choices: [{ kind: 'lot', id: orderId, name: 'Lote ficticio', project_name: null, season: '2026', secret: 'campo-no-permitido' }] } }))
  const response = await askApplicationChat('Pregunta', 'sesion-ficticia')
  assert.deepEqual(response.result?.choices, [{ kind: 'lot', id: orderId, name: 'Lote ficticio', season: '2026' }])
})

test('un error del servidor conserva su explicación y un fallo de lectura conserva el borrador', async t => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ error: 'Tu sesión venció.' }, { status: 401 }))
  await assert.rejects(askApplicationChat('Pregunta', 'sesion-ficticia'), /sesión venció/)
  t.mock.method(globalThis, 'fetch', async () => new Response('Servicio desconectado', { status: 503 }))
  await assert.rejects(askApplicationChat('Pregunta', 'sesion-ficticia'), /conservan/)
})

test('la transcripción sube solo audio y sesión y deja el boundary multipart al navegador', async t => {
  const audio = new File(['audio-ficticio'], 'pregunta.webm', { type: 'audio/webm;codecs=opus' })
  t.mock.method(globalThis, 'fetch', async (url: unknown, options?: RequestInit) => {
    assert.equal(url, '/api/application-transcription')
    assert.equal(new Headers(options?.headers).get('authorization'), 'Bearer sesion-ficticia')
    assert.equal(new Headers(options?.headers).get('content-type'), null)
    assert.ok(options?.body instanceof FormData)
    assert.deepEqual([...options.body.keys()], ['audio'])
    assert.equal((options.body.get('audio') as File).name, 'pregunta.webm')
    return Response.json({ text: '  ¿Qué falta realizar?  ', key: 'campo-ficticio-descartado' })
  })
  assert.equal(await transcribeApplicationAudio(audio, 'sesion-ficticia'), '¿Qué falta realizar?')
})

test('audio vacío, formatos ajenos y más de 10 MB se rechazan antes de enviar', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => { throw new Error('No debe llamarse') })
  assert.throws(() => validateApplicationAudio(new File([], 'vacío.webm', { type: 'audio/webm' })), /10 MB/)
  assert.throws(() => validateApplicationAudio(new File(['dato'], 'dato.txt', { type: 'text/plain' })), /audio MP3/)
  assert.throws(() => validateApplicationAudio(new File(['dato'], 'dato.ogg', { type: 'audio/ogg' })), /audio MP3/)
  await assert.rejects(transcribeApplicationAudio(new File([new Uint8Array(APPLICATION_AUDIO_MAX_BYTES + 1)], 'largo.webm', { type: 'audio/webm' }), 'sesion-ficticia'), /10 MB/)
  assert.equal(fetch.mock.callCount(), 0)
})

test('un audio con extensión válida y MIME vacío se normaliza para multipart', async t => {
  t.mock.method(globalThis, 'fetch', async (_url: unknown, options?: RequestInit) => {
    const file = (options?.body as FormData).get('audio') as File
    assert.equal(file.type, 'audio/mp4')
    return Response.json({ text: 'Pregunta ficticia.' })
  })
  assert.equal(await transcribeApplicationAudio(new File(['ficticio'], 'pregunta.M4A'), 'sesion-ficticia'), 'Pregunta ficticia.')
})

test('una transcripción vacía o excesiva no sustituye la pregunta', async t => {
  const audio = new File(['ficticio'], 'pregunta.mp3', { type: 'audio/mpeg' })
  t.mock.method(globalThis, 'fetch', async () => Response.json({ text: 'x'.repeat(4001) }))
  await assert.rejects(transcribeApplicationAudio(audio, 'sesion-ficticia'), /4,000/)
  t.mock.method(globalThis, 'fetch', async () => Response.json({ text: '' }))
  await assert.rejects(transcribeApplicationAudio(audio, 'sesion-ficticia'), /4,000/)
})
