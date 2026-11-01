import test from 'node:test'
import assert from 'node:assert/strict'
import { APPLICATION_AUDIO_MAX_BYTES, applicationQueryFilterSourceLabel, applicationQueryFilters, askApplicationChat, buildIndicatedProductQuery, buildQueryFromChoice, executeApplicationQuery, formatApplicationProductTotal, transcribeApplicationAudio, validateApplicationAudio, type ApplicationQueryChoice, type ApplicationQueryFilters, type ApplicationQueryResult } from '../src/data/application-chat'

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

test('normaliza filtros aplicados y supuestos sin inventar contexto cuando faltan', async t => {
  const filters = [
    { key: 'agricultural_unit', label: 'Agrícola', value: 'Agrícola ficticia', source: 'last_used' },
    { key: 'project', label: 'Temporada', value: 'Proyecto ficticio 2026', source: 'active_season' },
    { key: 'lot', label: 'Lote', value: 'Malla ficticia 5', source: 'unique_match' },
    { key: 'status', label: 'Estado', value: 'Realizadas', source: 'explicit' },
  ]
  const assumptions = ['Se utilizó la última agrícola consultada por esta cuenta.']
  t.mock.method(globalThis, 'fetch', async () => Response.json({ answer: 'Resultado ficticio.', result: { ...result, filters: filters.map(filter => ({ ...filter, extra: 'campo-descartado' })), assumptions } }))
  const response = await askApplicationChat('Pregunta ficticia', 'sesion-ficticia')
  assert.deepEqual(response.result?.filters, filters)
  assert.deepEqual(response.result?.assumptions, assumptions)
  assert.equal(applicationQueryFilterSourceLabel('last_used'), 'Última agrícola utilizada')
  assert.equal(applicationQueryFilterSourceLabel('active_season'), 'Temporada activa')
  assert.equal(applicationQueryFilterSourceLabel('unique_match'), 'Coincidencia única')
  assert.equal(applicationQueryFilterSourceLabel('explicit'), 'Indicado explícitamente')
  t.mock.method(globalThis, 'fetch', async () => Response.json({ answer: 'Resultado anterior.', result }))
  const previous = await askApplicationChat('Pregunta ficticia', 'sesion-ficticia')
  assert.equal(previous.result?.filters, undefined)
  assert.equal(previous.result?.assumptions, undefined)
})

test('rechaza filtros sin procedencia válida, metadatos excesivos y supuestos ajenos al contrato', async t => {
  for (const metadata of [
    { filters: [{ key: 'lot', label: 'Lote', value: 'Ficticio', source: 'adivinado' }] },
    { filters: [{ key: 'lot', label: '', value: 'Ficticio', source: 'unique_match' }] },
    { filters: Array.from({ length: 31 }, () => ({ key: 'lot', label: 'Lote', value: 'Ficticio', source: 'unique_match' })) },
    { assumptions: ['x'.repeat(601)] }, { assumptions: [4] },
  ]) {
    t.mock.method(globalThis, 'fetch', async () => Response.json({ answer: 'Resultado ficticio.', result: { ...result, ...metadata } }))
    await assert.rejects(askApplicationChat('Pregunta ficticia', 'sesion-ficticia'), /filtros aplicados no válidos|criterios asumidos no válidos/)
  }
})

test('admite hasta 300 productos agrupados y rechaza un resultado que exceda el límite', async t => {
  const rows = Array.from({ length: 300 }, (_, index) => ({ product_name: `Producto ficticio ${index + 1}`, unit: index % 2 ? 'g' : 'ml', quantity: 1500, destination_count: 2 }))
  t.mock.method(globalThis, 'fetch', async () => Response.json({ answer: 'Resultado ficticio.', result: { ...result, query: { operation: 'uso_producto', status: 'performed' }, rows } }))
  assert.equal((await askApplicationChat('Pregunta ficticia', 'sesion-ficticia')).result?.rows.length, 300)
  rows.push({ product_name: 'Fuera de límite', unit: 'g', quantity: 10, destination_count: 1 })
  await assert.rejects(askApplicationChat('Pregunta ficticia', 'sesion-ficticia'), /resultado incompleto/)
})

test('las cantidades de producto muestran L o kg separados con dos decimales', () => {
  assert.equal(formatApplicationProductTotal(1500, 'ml'), '1.50 L')
  assert.equal(formatApplicationProductTotal(1500, 'g'), '1.50 kg')
  assert.equal(formatApplicationProductTotal(250, 'g'), '0.25 kg')
  assert.equal(formatApplicationProductTotal(0, 'ml'), '0.00 L')
  assert.equal(formatApplicationProductTotal(1234567.8, 'ml'), '1,234.57 L')
  for (const [quantity, unit] of [[NaN, 'ml'], [-1, 'g'], [1000, 'kg'], ['1000', 'ml']]) assert.equal(formatApplicationProductTotal(quantity, unit), 'No disponible')
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

test('las opciones de una aclaración conservan todas las temporadas y la paginación explícita', async t => {
  const query = buildQueryFromChoice({ operation: 'uso_producto', status: 'performed', lot: 'Lote repetido', limit: 30, offset: 30 }, { kind: 'lot', id: orderId, name: 'Lote repetido' })
  const options = { resolveContext: false, completeProducts: false }
  t.mock.method(globalThis, 'fetch', async (url: unknown, input?: RequestInit) => {
    assert.equal(url, '/api/application-query')
    assert.deepEqual(JSON.parse(String(input?.body)), { query, ...options })
    return Response.json({ answer: 'Página explícita de todas las temporadas.', query, result: { ...result, query }, queryOptions: { ...options, extra: 'no-conservar' } })
  })
  const response = await executeApplicationQuery(query, 'sesion-ficticia', undefined, options)
  assert.deepEqual(response.queryOptions, options)
  assert.equal(response.query?.offset, 30)
})

test('una aclaración con contexto asumido conserva la resolución de contexto y lista completa', async t => {
  const options = { resolveContext: true, completeProducts: true }
  t.mock.method(globalThis, 'fetch', async (url: unknown, input?: RequestInit) => {
    if (url === '/api/application-chat') return Response.json({ answer: 'Precisa el lote.', queryOptions: options, result: { ...result, choices: [{ kind: 'lot', id: orderId, name: 'Lote ficticio' }] } })
    assert.deepEqual(JSON.parse(String(input?.body)), { query: { operation: 'uso_producto', lot_id: orderId }, ...options })
    return Response.json({ answer: 'Lista completa resuelta.', queryOptions: options })
  })
  const response = await askApplicationChat('Pregunta ficticia', 'sesion-ficticia')
  assert.deepEqual(response.queryOptions, options)
  assert.deepEqual((await executeApplicationQuery({ operation: 'uso_producto', lot_id: orderId }, 'sesion-ficticia', undefined, response.queryOptions)).queryOptions, options)
})

test('las opciones de alcance requieren booleanos exactos, sin coerción de texto o números', async t => {
  for (const queryOptions of [{ resolveContext: 'false', completeProducts: false }, { resolveContext: false, completeProducts: 0 }, { resolveContext: true }]) {
    t.mock.method(globalThis, 'fetch', async () => Response.json({ answer: 'Respuesta ficticia.', queryOptions }))
    await assert.rejects(askApplicationChat('Pregunta ficticia', 'sesion-ficticia'), /opciones de alcance/)
  }
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

test('ofrecer productos indicados conserva el ámbito y exige una consulta de realizadas vacía comprobada', () => {
  const empty: ApplicationQueryResult = { ...result, query: { operation: 'uso_producto', status: 'performed', lot_id: orderId, project_id: projectId, from: '2026-10-01', offset: 0 }, rows: [], summary: { destination_count: 0, total_rows: 0 }, incomplete_count: 0, truncated: false }
  assert.deepEqual(buildIndicatedProductQuery(empty), { ...empty.query, status: 'indicated', limit: 30, offset: 0 })
  for (const changed of [{ ...empty, clarification: 'Precisa lote' }, { ...empty, rows: [{ product_name: 'Ya existe' }] }, { ...empty, incomplete_count: 1 }, { ...empty, truncated: true }, { ...empty, summary: {} }, { ...empty, query: { ...empty.query, offset: 30 } }, { ...empty, query: { ...empty.query, status: 'all' as const } }]) assert.equal(buildIndicatedProductQuery(changed), null)
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
