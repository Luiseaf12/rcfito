export type ApplicationQueryOperation = 'pendientes' | 'historial' | 'uso_producto' | 'detalle' | 'cambios'
export type ApplicationQueryFilters = {
  operation?: ApplicationQueryOperation
  agricultural_unit_id?: string
  project_id?: string
  field_id?: string
  lot_id?: string
  stage_id?: string
  product_id?: string
  order_id?: string
  agricultural_unit?: string
  project?: string
  field?: string
  lot?: string
  product?: string
  folio?: string
  stage_number?: number
  from?: string
  to?: string
  status?: 'indicated' | 'performed' | 'cancelled' | 'all'
  limit?: number
  offset?: number
}
export type ApplicationQuerySource = { order_id: string; target_id?: string; folio: string }
export type ApplicationQueryChoice = {
  id: string
  kind: 'agricultural_unit' | 'project' | 'field' | 'lot' | 'product' | 'order'
  name: string
  project_name?: string
  season?: string
}
export type ApplicationQueryResult = {
  revision: string
  as_of: string
  query: ApplicationQueryFilters
  summary: Record<string, unknown>
  rows: Record<string, unknown>[]
  sources: ApplicationQuerySource[]
  source_count?: number
  sources_scope?: string
  sources_truncated?: boolean
  incomplete_count: number
  truncated: boolean
  clarification?: string
  choices?: ApplicationQueryChoice[]
}
export type ApplicationChatResponse = {
  answer: string
  result?: ApplicationQueryResult
  query?: ApplicationQueryFilters
  usage?: { inputTokens: number; outputTokens: number; toolCalls: number }
  cached?: boolean
}

export const APPLICATION_AUDIO_MAX_BYTES = 10 * 1024 * 1024
export const APPLICATION_AUDIO_MAX_SECONDS = 120
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const stringKeys = ['agricultural_unit', 'project', 'field', 'lot', 'product', 'folio'] as const
const idKeys = ['agricultural_unit_id', 'project_id', 'field_id', 'lot_id', 'stage_id', 'product_id', 'order_id'] as const
const operations: ApplicationQueryOperation[] = ['pendientes', 'historial', 'uso_producto', 'detalle', 'cambios']
const object = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
const choiceFields = {
  agricultural_unit: ['agricultural_unit_id', 'agricultural_unit'],
  project: ['project_id', 'project'],
  field: ['field_id', 'field'],
  lot: ['lot_id', 'lot'],
  product: ['product_id', 'product'],
  order: ['order_id', 'folio'],
} as const

function queryChoice(value: unknown): ApplicationQueryChoice {
  if (!object(value) || typeof value.id !== 'string' || !uuidPattern.test(value.id) || typeof value.kind !== 'string' || !Object.hasOwn(choiceFields, value.kind)
    || typeof value.name !== 'string' || !value.name.trim() || value.name.length > 200
    || value.project_name != null && (typeof value.project_name !== 'string' || value.project_name.length > 200)
    || value.season != null && (typeof value.season !== 'string' || value.season.length > 200)) throw new Error('La consulta devolvió una opción de selección no válida.')
  return {
    id: value.id.toLowerCase(), kind: value.kind as ApplicationQueryChoice['kind'], name: value.name,
    ...(typeof value.project_name === 'string' ? { project_name: value.project_name } : {}),
    ...(typeof value.season === 'string' ? { season: value.season } : {}),
  }
}

/** A user's explicit choice replaces only its ambiguous name; remaining query filters stay intact. */
export function buildQueryFromChoice(query: ApplicationQueryFilters, choice: ApplicationQueryChoice): ApplicationQueryFilters {
  const selected = queryChoice(choice)
  const result = applicationQueryFilters(query)
  if (!result.operation) throw new Error('Falta el tipo de consulta que deseas precisar.')
  const [idKey, nameKey] = choiceFields[selected.kind]
  delete result[nameKey]
  result[idKey] = selected.id
  return result
}

/** Keeps only the agreed query fields; workspace data and credentials never enter a prompt. */
export function applicationQueryFilters(value: unknown): ApplicationQueryFilters {
  if (!object(value)) throw new Error('Los filtros de consulta no son válidos.')
  const result: ApplicationQueryFilters = {}
  for (const key of idKeys) if (value[key] !== undefined) {
    if (typeof value[key] !== 'string' || !uuidPattern.test(value[key])) throw new Error('Selecciona un contexto de consulta válido.')
    result[key] = value[key]
  }
  for (const key of stringKeys) if (value[key] !== undefined) {
    if (typeof value[key] !== 'string' || !value[key].trim() || value[key].length > 200) throw new Error('Revisa los nombres de los filtros de consulta.')
    result[key] = value[key].trim()
  }
  if (value.operation !== undefined) {
    if (!operations.includes(value.operation as ApplicationQueryOperation)) throw new Error('El tipo de consulta no es válido.')
    result.operation = value.operation as ApplicationQueryOperation
  }
  if (value.status !== undefined) {
    if (!['indicated', 'performed', 'cancelled', 'all'].includes(String(value.status))) throw new Error('El estado de la consulta no es válido.')
    result.status = value.status as ApplicationQueryFilters['status']
  }
  for (const key of ['from', 'to'] as const) if (value[key] !== undefined) {
    const date = value[key]
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(`${date}T00:00:00Z`)) || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) throw new Error('Revisa las fechas de la consulta.')
    result[key] = date
  }
  if (result.from && result.to && result.from > result.to) throw new Error('La fecha inicial debe ser anterior a la final.')
  for (const key of ['stage_number', 'limit', 'offset'] as const) if (value[key] !== undefined) {
    const number = value[key]
    if (typeof number !== 'number' || !Number.isInteger(number) || number < (key === 'offset' ? 0 : 1) || number > (key === 'limit' ? 30 : key === 'offset' ? 1000 : 1_000_000)) throw new Error('Revisa los límites de la consulta.')
    result[key] = number
  }
  return result
}

export function validateApplicationAudio(file: File): void {
  if (!file.size || file.size > APPLICATION_AUDIO_MAX_BYTES) throw new Error('El audio debe contener sonido y pesar como máximo 10 MB.')
  const mime = file.type.split(';')[0].toLowerCase()
  const supported = ['audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/m4a', 'audio/x-m4a', 'audio/wav', 'audio/x-wav', 'audio/webm', 'video/mp4', 'video/webm']
  if (mime ? !supported.includes(mime) : !/\.(mp3|mp4|m4a|wav|webm)$/i.test(file.name)) throw new Error('Selecciona un audio MP3, MP4, M4A, WAV o WebM.')
}

async function responseBody(response: Response): Promise<Record<string, unknown>> {
  let body: unknown
  try { body = await response.json() } catch { throw new Error('No se pudo leer la respuesta del servicio. Tu pregunta y tu audio se conservan.') }
  if (!response.ok) throw new Error(object(body) && typeof body.error === 'string' ? body.error : 'El servicio no está disponible. Tu pregunta y tu audio se conservan.')
  if (!object(body)) throw new Error('El servicio devolvió una respuesta incompleta. Intenta nuevamente.')
  return body
}

function queryResult(value: unknown): ApplicationQueryResult {
  if (!object(value) || typeof value.revision !== 'string' || value.revision.length > 200 || typeof value.as_of !== 'string' || !Number.isFinite(Date.parse(value.as_of)) || !object(value.summary) || !Array.isArray(value.rows) || value.rows.length > 30 || !value.rows.every(object) || !Array.isArray(value.sources) || value.sources.length > 100 || typeof value.incomplete_count !== 'number' || !Number.isInteger(value.incomplete_count) || value.incomplete_count < 0 || typeof value.truncated !== 'boolean') throw new Error('La consulta devolvió un resultado incompleto. Intenta nuevamente.')
  if (value.source_count !== undefined && (typeof value.source_count !== 'number' || !Number.isSafeInteger(value.source_count) || value.source_count < 0)
    || value.sources_scope !== undefined && (typeof value.sources_scope !== 'string' || value.sources_scope.length > 80 || /[\u0000-\u001f]/.test(value.sources_scope))
    || value.sources_truncated !== undefined && typeof value.sources_truncated !== 'boolean') throw new Error('La consulta devolvió un alcance de fuentes no válido.')
  if (value.choices !== undefined && (!Array.isArray(value.choices) || value.choices.length > 30)) throw new Error('La consulta devolvió opciones de selección no válidas.')
  const choices = Array.isArray(value.choices) ? value.choices.map(queryChoice) : undefined
  const sources: ApplicationQuerySource[] = value.sources.map(source => {
    if (!object(source) || typeof source.order_id !== 'string' || !uuidPattern.test(source.order_id) || typeof source.folio !== 'string' || source.folio.length > 200 || source.target_id != null && (typeof source.target_id !== 'string' || !uuidPattern.test(source.target_id))) throw new Error('La consulta devolvió una referencia no válida.')
    return { order_id: source.order_id, folio: source.folio, ...(typeof source.target_id === 'string' ? { target_id: source.target_id } : {}) }
  })
  return {
    revision: value.revision, as_of: value.as_of, query: applicationQueryFilters(value.query),
    summary: value.summary, rows: value.rows, sources, incomplete_count: value.incomplete_count, truncated: value.truncated,
    ...(typeof value.source_count === 'number' ? { source_count: value.source_count } : {}),
    ...(typeof value.sources_scope === 'string' ? { sources_scope: value.sources_scope } : {}),
    ...(typeof value.sources_truncated === 'boolean' ? { sources_truncated: value.sources_truncated } : {}),
    ...(typeof value.clarification === 'string' ? { clarification: value.clarification.slice(0, 4000) } : {}),
    ...(choices ? { choices } : {}),
  }
}

/** A question carries selected IDs and the preceding query, never the workspace or transcript history. */
export async function askApplicationChat(message: string, accessToken: string, context: ApplicationQueryFilters = {}, previousQuery?: ApplicationQueryFilters | null, signal?: AbortSignal): Promise<ApplicationChatResponse> {
  if (!message.trim() || message.length > 4000) throw new Error('Escribe una pregunta de hasta 4,000 caracteres.')
  const response = await fetch('/api/application-chat', {
    method: 'POST', cache: 'no-store', headers: { 'content-type': 'application/json', authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ message: message.trim(), context: applicationQueryFilters(context), ...(previousQuery ? { previousQuery: applicationQueryFilters(previousQuery) } : {}) }),
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(65_000)]) : AbortSignal.timeout(65_000),
  })
  return normalizeChatResponse(await responseBody(response))
}

function normalizeChatResponse(body: Record<string, unknown>): ApplicationChatResponse {
  if (typeof body.answer !== 'string' || !body.answer.trim() || body.answer.length > 20_000) throw new Error('El chat no devolvió una respuesta completa. Tu pregunta se conserva.')
  const result: ApplicationChatResponse = { answer: body.answer }
  if (body.query !== undefined) result.query = applicationQueryFilters(body.query)
  if (body.result !== undefined) result.result = queryResult(body.result)
  if (typeof body.cached === 'boolean') result.cached = body.cached
  const usage = body.usage
  if (object(usage) && ['inputTokens', 'outputTokens', 'toolCalls'].every(key => typeof usage[key] === 'number' && Number.isFinite(usage[key]) && Number(usage[key]) >= 0)) result.usage = { inputTokens: Number(usage.inputTokens), outputTokens: Number(usage.outputTokens), toolCalls: Number(usage.toolCalls) }
  return result
}

/** Explicit choices and CLI-style requests execute a bounded routine without another model call. */
export async function executeApplicationQuery(query: ApplicationQueryFilters, accessToken: string, signal?: AbortSignal): Promise<ApplicationChatResponse> {
  const normalized = applicationQueryFilters(query)
  if (!normalized.operation) throw new Error('Indica qué consulta deseas ejecutar.')
  const response = await fetch('/api/application-query', {
    method: 'POST', cache: 'no-store', headers: { 'content-type': 'application/json', authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ query: normalized }),
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(65_000)]) : AbortSignal.timeout(65_000),
  })
  return normalizeChatResponse(await responseBody(response))
}

export async function transcribeApplicationAudio(file: File, accessToken: string, signal?: AbortSignal): Promise<string> {
  validateApplicationAudio(file)
  const form = new FormData()
  // Some browsers leave M4A/WAV MIME empty. The server still checks the actual file signature.
  const types: Record<string, string> = { mp3: 'audio/mpeg', mp4: 'video/mp4', m4a: 'audio/mp4', wav: 'audio/wav', webm: 'audio/webm' }
  const uploaded = file.type ? file : new File([file], file.name, { type: types[file.name.split('.').at(-1)?.toLowerCase() ?? ''] })
  form.append('audio', uploaded, file.name)
  const response = await fetch('/api/application-transcription', {
    method: 'POST', cache: 'no-store', headers: { authorization: `Bearer ${accessToken}` }, body: form,
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(65_000)]) : AbortSignal.timeout(65_000),
  })
  const body = await responseBody(response)
  if (typeof body.text !== 'string' || !body.text.trim() || body.text.length > 4000) throw new Error('No se recibió una pregunta de hasta 4,000 caracteres. Conserva el audio o escribe tu pregunta.')
  return body.text.trim()
}
