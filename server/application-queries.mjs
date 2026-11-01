// Shared by the authenticated HTTP endpoints and the query CLI. No model executes SQL.
export class ApplicationQueryError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export const applicationQueryOperations = ['pendientes', 'historial', 'uso_producto', 'detalle', 'cambios'];
const queryIds = ['agricultural_unit_id', 'project_id', 'field_id', 'lot_id', 'stage_id', 'product_id', 'order_id'];
const queryNames = ['agricultural_unit', 'project', 'field', 'lot', 'product', 'folio'];
const queryKeys = ['operation', ...queryIds, ...queryNames, 'stage_number', 'from', 'to', 'status', 'limit', 'offset'];
const queryUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validateApplicationQuery(value, partial = false) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !queryKeys.includes(key))) throw new ApplicationQueryError(400, 'Los filtros de consulta no son válidos.');
  const clean = {};
  for (const [key, input] of Object.entries(value)) {
    if (input === null || input === undefined) continue;
    if (queryIds.includes(key)) {
      if (typeof input !== 'string' || !queryUuid.test(input)) throw new ApplicationQueryError(400, 'Hay una referencia de consulta inválida.');
      clean[key] = input.toLowerCase();
    } else if (queryNames.includes(key)) {
      if (typeof input !== 'string' || !input.trim() || input.trim().length > 200 || /[\u0000-\u001f]/.test(input)) throw new ApplicationQueryError(400, 'Revisa el nombre o folio de la consulta.');
      clean[key] = input.trim();
    } else if (key === 'operation') {
      if (!applicationQueryOperations.includes(input)) throw new ApplicationQueryError(400, 'Elige una operación de consulta disponible.');
      clean[key] = input;
    } else if (key === 'status') {
      if (!['all', 'indicated', 'performed', 'cancelled'].includes(input)) throw new ApplicationQueryError(400, 'El estado de aplicación no es válido.');
      clean[key] = input;
    } else if (['from', 'to'].includes(key)) {
      if (typeof input !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(input) || !Number.isFinite(Date.parse(input + 'T00:00:00Z')) || new Date(input + 'T00:00:00Z').toISOString().slice(0, 10) !== input) throw new ApplicationQueryError(400, 'Usa fechas válidas con formato AAAA-MM-DD.');
      clean[key] = input;
    } else {
      const bounds = key === 'limit' ? [1, 30] : key === 'offset' ? [0, 1000] : [1, 1_000_000];
      if (!Number.isSafeInteger(input) || input < bounds[0] || input > bounds[1]) throw new ApplicationQueryError(400, 'La etapa o paginación está fuera del límite permitido.');
      clean[key] = input;
    }
  }
  if (!partial && !clean.operation) throw new ApplicationQueryError(400, 'Indica qué consulta deseas ejecutar.');
  if (clean.from && clean.to && clean.from > clean.to) throw new ApplicationQueryError(400, 'La fecha inicial no puede ser posterior a la final.');
  if (!partial) {
    clean.limit ??= 10; clean.offset ??= 0;
    clean.status ??= clean.operation === 'pendientes' ? 'indicated' : clean.operation === 'uso_producto' ? 'performed' : 'all';
    if (clean.operation === 'pendientes' && clean.status !== 'indicated') throw new ApplicationQueryError(400, 'Las aplicaciones pendientes tienen estado indicado.');
  }
  return Object.fromEntries(Object.entries(clean).sort(([a], [b]) => a.localeCompare(b)));
}

const nullableQueryString = { type: ['string', 'null'] };
export const applicationQueryPlanSchema = {
  type: 'object', additionalProperties: false,
  properties: {
    action: { type: 'string', enum: ['query', 'clarify'] },
    clarification: nullableQueryString,
    query: {
      type: 'object', additionalProperties: false,
      properties: {
        operation: { type: ['string', 'null'], enum: [...applicationQueryOperations, null] },
        ...Object.fromEntries([...queryIds, ...queryNames, 'from', 'to'].map(key => [key, nullableQueryString])),
        status: { type: ['string', 'null'], enum: ['all', 'indicated', 'performed', 'cancelled', null] },
        stage_number: { type: ['integer', 'null'] }, limit: { type: ['integer', 'null'] }, offset: { type: ['integer', 'null'] },
      },
      required: queryKeys,
    },
  }, required: ['action', 'clarification', 'query'],
};

export async function queryReadJson(source, maximum, signal) {
  const length = source.headers.get('content-length');
  if (length && /^\d+$/.test(length) && Number(length) > maximum) throw new ApplicationQueryError(413, 'La solicitud o respuesta supera el tamaño permitido.');
  const reader = source.body?.getReader();
  if (!reader) throw new ApplicationQueryError(400, 'El contenido está incompleto.');
  const chunks = []; let total = 0;
  const abort = () => { void reader.cancel().catch(() => {}); };
  signal.addEventListener('abort', abort, { once: true });
  try {
    for (;;) {
      signal.throwIfAborted();
      const { value, done } = await reader.read();
      signal.throwIfAborted();
      if (done) break;
      total += value.length;
      if (total > maximum) { await reader.cancel(); throw new ApplicationQueryError(413, 'La solicitud o respuesta supera el tamaño permitido.'); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(total); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
    catch { throw new ApplicationQueryError(400, 'El contenido JSON no es válido.'); }
  } finally { signal.removeEventListener('abort', abort); reader.releaseLock(); }
}

function validQueryResult(value) {
  return value && typeof value === 'object' && typeof value.revision === 'string' && value.revision.length <= 200
    && typeof value.as_of === 'string' && Number.isFinite(Date.parse(value.as_of)) && value.query && typeof value.query === 'object'
    && value.summary && typeof value.summary === 'object' && Array.isArray(value.rows) && value.rows.length <= 30
    && Array.isArray(value.sources) && value.sources.length <= 30
    && value.sources.every(source => source && queryUuid.test(source.order_id) && typeof source.folio === 'string')
    && Number.isSafeInteger(value.incomplete_count) && value.incomplete_count >= 0 && typeof value.truncated === 'boolean';
}

async function queryDigest(value) {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

export function createApplicationQueryRunner({ fetch: queryFetch = fetch, now = Date.now, key }) {
  // At most 32 memory entries / ~2 MiB and 32 persistent slots per user.
  const memory = new Map();
  async function rpc(base, authorization, name, body, signal) {
    const response = await queryFetch(base + '/rest/v1/rpc/' + name, { method: 'POST', redirect: 'manual', signal,
      headers: { apikey: key, authorization, 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify(body) });
    if (!response.ok) {
      let error; try { error = await queryReadJson(response, 8192, signal); } catch { /* Use a safe, fixed error below. */ }
      if (response.status === 401 || response.status === 403) throw new ApplicationQueryError(response.status, 'Tu sesión o permisos cambiaron. Inicia sesión y revisa tus agrícolas asignadas.');
      if (error?.code === 'PGRST202' || response.status === 404) throw new ApplicationQueryError(503, 'Las rutinas de consultas todavía no están instaladas en este backend.');
      if (['22023', '22P02', '22007', '22008'].includes(error?.code)) throw new ApplicationQueryError(400, 'Revisa los filtros, fechas y referencias de la consulta.');
      throw new ApplicationQueryError(503, 'No se pudo consultar la información vigente. Conserva tu pregunta y vuelve a intentar.');
    }
    return queryReadJson(response, 256 * 1024, signal);
  }
  async function run(input, { base, authorization, userId, env = {}, signal }) {
    const query = validateApplicationQuery(input);
    // Always ask the backend, including on a hit: revoked users / assignments cannot use old cache.
    const stamp = await rpc(base, authorization, 'application_query_stamp', {}, signal);
    if (!stamp || typeof stamp.revision !== 'string' || typeof stamp.as_of !== 'string') throw new ApplicationQueryError(502, 'El backend no confirmó una revisión válida.');
    const userHash = await queryDigest(key + '|' + userId);
    const digest = await queryDigest(JSON.stringify(query));
    const memoryKey = userHash + ':' + digest;
    const slot = parseInt(digest.slice(0, 8), 16) % 32;
    const storageKey = `rcfito/query-cache/v1/${userHash}/${slot}.json`;
    function usable(entry) {
      return entry?.digest === digest && entry.revision === stamp.revision && Number.isFinite(entry.expiresAt)
        && entry.expiresAt > now() && entry.expiresAt <= now() + 60_000 && validQueryResult(entry.result);
    }
    let entry = memory.get(memoryKey);
    if (!usable(entry) && env.BUCKET) {
      try {
        const stored = await env.BUCKET.get(storageKey);
        if (stored && stored.size <= 64 * 1024) { const candidate = await stored.json(); if (usable(candidate)) entry = candidate; }
      } catch { /* Cache is optional; data/auth errors never fall back to stale results. */ }
    }
    if (usable(entry)) return { result: structuredClone(entry.result), query: entry.result.query, cached: true };
    const result = await rpc(base, authorization, 'application_query', { p_query: query }, signal);
    if (!validQueryResult(result)) throw new ApplicationQueryError(502, 'El backend devolvió una consulta incompleta. Actualiza y vuelve a intentar.');
    entry = { digest, revision: result.revision, expiresAt: now() + 60_000, result };
    const encoded = JSON.stringify(entry);
    if (encoded.length <= 32 * 1024 && !result.clarification) {
      memory.delete(memoryKey); memory.set(memoryKey, entry);
      while (memory.size > 32) memory.delete(memory.keys().next().value);
      if (env.BUCKET) {
        try { await env.BUCKET.put(storageKey, encoded, { httpMetadata: { contentType: 'application/json', cacheControl: 'no-store' } }); }
        catch { /* Query succeeded even when optional persistence failed. */ }
      }
    }
    return { result, query: result.query, cached: false };
  }
  return { run };
}

const queryNumber = value => new Intl.NumberFormat('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value) || 0);
const queryCount = value => new Intl.NumberFormat('es-MX', { maximumFractionDigits: 0 }).format(Number(value) || 0);
export function formatApplicationQueryAnswer(result) {
  if (result.clarification) {
    const choices = (result.choices ?? []).slice(0, 10).map(choice => [choice.name, choice.project_name, choice.season].filter(Boolean).join(' · '));
    return [result.clarification, ...choices.map(choice => '• ' + choice)].join('\n').slice(0, 5000);
  }
  const summary = result.summary;
  const state = { performed: 'realizadas', indicated: 'indicadas', cancelled: 'canceladas', all: 'de todos los estados' }[result.query.status] ?? 'registradas';
  const lines = result.query.operation === 'cambios' ? [] : [`Encontré ${queryCount(summary.destination_count)} ${summary.destination_count === 1 ? 'destino' : 'destinos'} en ${queryCount(summary.order_count)} ${summary.order_count === 1 ? 'orden' : 'órdenes'} (${state}).`];
  if (result.query.from || result.query.to) lines.push(`Periodo: ${result.query.from ?? 'sin inicio'} a ${result.query.to ?? 'sin fin'}.`);
  if (result.query.operation === 'uso_producto') {
    lines.push(`Cantidad calculada: ${queryNumber((summary.liquid_ml ?? 0) / 1000)} L y ${queryNumber((summary.solid_g ?? 0) / 1000)} kg.`);
    if (result.query.status !== 'performed') lines.push('Las cantidades incluyen indicaciones históricas y no equivalen a consumo real.');
    for (const row of result.rows) lines.push(`${row.product_name ?? row.name}: ${queryNumber((row.quantity ?? row.total_quantity ?? 0) / 1000)} ${row.unit === 'g' ? 'kg' : 'L'}; ${queryCount(row.destination_count)} destinos; dosis promedio ponderada ${queryNumber(row.average_dose)} ${row.unit}/ha${row.last_date ? `; última fecha ${row.last_date}` : ''}.`);
  } else if (result.query.operation === 'cambios') {
    const eventCount = summary.total_rows ?? result.rows.length;
    lines.push(`${queryCount(eventCount)} ${eventCount === 1 ? 'cambio registrado' : 'cambios registrados'}.`);
    for (const row of result.rows) lines.push(`${row.changed_at ?? ''} · ${row.kind === 'performance' ? 'Corrección real' : 'Revisión de indicación'} ${row.version ?? ''}: ${(row.reason ?? '').slice(0, 300)}`);
  } else {
    for (const row of result.rows) {
      const rowState = { performed: 'Realizada', indicated: 'Indicada', cancelled: 'Cancelada' }[row.status] ?? '';
      const dateLabel = result.query.operation === 'pendientes' ? 'Fecha programada' : row.status === 'performed' ? 'Fecha real' : 'Fecha de indicación';
      const products = (row.products ?? []).slice(0, 8).map(product => `${product.product_name}: ${queryNumber(product.dose)} ${product.unit}/ha`).join('; ') + ((row.products?.length ?? 0) > 8 ? `; y ${row.products.length - 8} productos más (ver fuente)` : '');
      lines.push([row.folio, rowState, [row.lot_name, row.subdivision_name, row.stage_number ? `etapa ${row.stage_number}` : ''].filter(Boolean).join(' · '), (row.record_date ?? row.actual_date ?? row.scheduled_date) ? `${dateLabel}: ${row.record_date ?? row.actual_date ?? row.scheduled_date}` : '',
        row.application_number ? `aplicación ${row.application_number}` : '', products].filter(Boolean).join(' — '));
      if (result.query.operation === 'detalle') {
        const details = [
          row.water_l_ha != null ? `Agua: ${queryNumber(row.water_l_ha)} L/ha` : '',
          row.equipment ? `Equipo: ${row.equipment}` : '', row.applicator ? `Aplicador: ${row.applicator}` : '',
          row.observations ? `Observaciones: ${row.observations.slice(0, 500)}` : '', row.actual_observations ? `Observaciones reales: ${row.actual_observations.slice(0, 500)}` : '',
          row.cancellation_reason ? `Cancelación: ${row.cancellation_reason}` : '',
        ].filter(Boolean);
        if (details.length) lines.push(details.join(' · '));
      }
    }
  }
  if (result.incomplete_count) lines.push(`Se omitieron ${queryCount(result.incomplete_count)} registros incompletos.`);
  if (result.truncated) lines.push('Hay más resultados. Acota los filtros o solicita la siguiente página.');
  if (result.sources_truncated) lines.push('Las fuentes enlazadas son una muestra de los registros usados en el cálculo.');
  if (!result.rows.length && !(summary.total_rows ?? summary.destination_count)) lines.push('No hay coincidencias con estos filtros dentro de tus permisos.');
  const answer = lines.join('\n');
  return answer.length <= 7000 ? answer : answer.slice(0, 6800) + '\nRespuesta abreviada por tamaño. Acota los filtros o abre las aplicaciones enlazadas para ver el detalle completo.';
}
