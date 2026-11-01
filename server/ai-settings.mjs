// R2 conditional writes use If-Match / If-None-Match, not a read-then-write lock.
// https://developers.cloudflare.com/r2/api/workers/workers-api-reference/#conditional-operations
const aiSettingsKey = 'rcfito/ai-settings.json';
const aiSettingsEncoder = new TextEncoder();
const aiSettingsProofLifetime = 10 * 60_000;
class AiSettingsError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
function aiSettingsJson(body, status = 200, headers = {}) {
  return Response.json(body, { status, headers: { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', ...headers } });
}
function aiSettingsBase64(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes))).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}
function aiSettingsBytes(value, maximum = 12_000) {
  if (typeof value !== 'string' || value.length > maximum || !/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('INVALID_ENCODING');
  const normalized = value.replaceAll('-', '+').replaceAll('_', '/');
  return Uint8Array.from(atob(normalized + '='.repeat((4 - normalized.length % 4) % 4)), character => character.charCodeAt(0));
}
function aiSettingsRoot(env) {
  const secret = env.RCFITO_AI_CONFIG_SECRET === undefined ? env.RCFITO_TUNNEL_UPDATE_SECRET : env.RCFITO_AI_CONFIG_SECRET;
  return typeof secret === 'string' && secret.length >= 32 && secret.length <= 4096 ? secret : null;
}
async function aiSettingsDerivedKey(secret, purpose) {
  if (!secret) throw new AiSettingsError(503, 'El almacenamiento seguro de IA todavía no está preparado en el servidor.');
  const material = await crypto.subtle.importKey('raw', aiSettingsEncoder.encode(secret), 'HKDF', false, ['deriveKey']);
  const algorithm = purpose === 'encryption' ? { name: 'AES-GCM', length: 256 } : { name: 'HMAC', hash: 'SHA-256', length: 256 };
  return crypto.subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: aiSettingsEncoder.encode(aiSettingsKey + '/v1'), info: aiSettingsEncoder.encode('rcfito/ai-configuration/' + purpose + '/v1') }, material, algorithm, false, purpose === 'encryption' ? ['encrypt', 'decrypt'] : ['sign', 'verify']);
}
function aiSettingsValidKey(value) { return typeof value === 'string' && /^[\x21-\x7e]{20,2048}$/.test(value); }
function aiSettingsValidModel(value) { return typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}$/.test(value); }
function aiSettingsMetadata(envelope) { return { version: envelope.version, revision: envelope.revision, updatedBy: envelope.updatedBy, updatedAt: envelope.updatedAt, testedAt: envelope.testedAt }; }
async function aiSettingsEncrypt(configuration, secret, userId, stamp) {
  const testedAt = configuration.testedAt;
  const envelope = { version: 1, revision: crypto.randomUUID(), updatedBy: userId, updatedAt: new Date(stamp).toISOString(), testedAt };
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encryptionKey = await aiSettingsDerivedKey(secret, 'encryption');
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: aiSettingsEncoder.encode(JSON.stringify(aiSettingsMetadata(envelope))) }, encryptionKey, aiSettingsEncoder.encode(JSON.stringify({ apiKey: configuration.apiKey, model: configuration.model, testedAt })));
  return { ...envelope, iv: aiSettingsBase64(iv), ciphertext: aiSettingsBase64(ciphertext) };
}
async function aiSettingsDecrypt(envelope, secret) {
  try {
    if (!envelope || envelope.version !== 1 || typeof envelope.revision !== 'string' || !/^[0-9a-f-]{36}$/.test(envelope.revision) || typeof envelope.updatedBy !== 'string' || !/^[0-9a-f-]{36}$/i.test(envelope.updatedBy)
      || typeof envelope.updatedAt !== 'string' || !Number.isFinite(Date.parse(envelope.updatedAt)) || typeof envelope.testedAt !== 'string' || !Number.isFinite(Date.parse(envelope.testedAt))) throw new Error('INVALID_ENVELOPE');
    const iv = aiSettingsBytes(envelope.iv, 32);
    if (iv.length !== 12) throw new Error('INVALID_IV');
    const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv, additionalData: aiSettingsEncoder.encode(JSON.stringify(aiSettingsMetadata(envelope))) }, await aiSettingsDerivedKey(secret, 'encryption'), aiSettingsBytes(envelope.ciphertext));
    const decoded = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(plaintext));
    if (!aiSettingsValidKey(decoded.apiKey) || !aiSettingsValidModel(decoded.model) || decoded.testedAt !== envelope.testedAt) throw new Error('INVALID_CONFIGURATION');
    return { apiKey: decoded.apiKey, model: decoded.model, testedAt: decoded.testedAt };
  } catch { throw new AiSettingsError(503, 'No se pudo abrir la configuración cifrada de IA. Requiere recuperación administrativa antes de volver a guardar.'); }
}
async function aiSettingsReadJson(source, maximum, signal) {
  const size = source.headers.get('content-length');
  if (size && /^\d+$/.test(size) && Number(size) > maximum) throw new AiSettingsError(413, 'La solicitud supera el tamaño permitido.');
  const reader = source.body?.getReader();
  if (!reader) throw new AiSettingsError(400, 'La solicitud JSON está incompleta.');
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
      if (total > maximum) { await reader.cancel(); throw new AiSettingsError(413, 'La solicitud supera el tamaño permitido.'); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(total); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
    catch { throw new AiSettingsError(400, 'La solicitud JSON no es válida.'); }
  } finally { signal.removeEventListener('abort', abort); reader.releaseLock(); }
}
async function aiSettingsFingerprint(apiKey) { return aiSettingsBase64(await crypto.subtle.digest('SHA-256', aiSettingsEncoder.encode(apiKey))); }
async function aiSettingsProof(secret, values) {
  const encoded = aiSettingsBase64(aiSettingsEncoder.encode(JSON.stringify(values)));
  const signature = await crypto.subtle.sign('HMAC', await aiSettingsDerivedKey(secret, 'proof'), aiSettingsEncoder.encode(encoded));
  return encoded + '.' + aiSettingsBase64(signature);
}
async function aiSettingsVerifyProof(token, secret, expected, stamp) {
  try {
    if (typeof token !== 'string' || token.length > 4096 || token.split('.').length !== 2) throw new Error('INVALID_PROOF');
    const [encoded, signature] = token.split('.');
    const valid = await crypto.subtle.verify('HMAC', await aiSettingsDerivedKey(secret, 'proof'), aiSettingsBytes(signature, 128), aiSettingsEncoder.encode(encoded));
    if (!valid) throw new Error('INVALID_PROOF');
    const proof = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(aiSettingsBytes(encoded, 3500)));
    if (proof.version !== 1 || proof.userId !== expected.userId || proof.fingerprint !== expected.fingerprint || proof.model !== expected.model || proof.revision !== expected.revision
      || !Number.isSafeInteger(proof.issuedAt) || !Number.isSafeInteger(proof.expiresAt) || proof.expiresAt - proof.issuedAt !== aiSettingsProofLifetime || proof.issuedAt > stamp + 5000 || proof.expiresAt <= stamp) throw new Error('INVALID_PROOF');
    return proof;
  } catch { throw new AiSettingsError(409, 'La prueba ya no es válida para esta clave, modelo o revisión. Vuelve a probar la conexión antes de guardar.'); }
}

export function createAiSettingsService({ fetch: settingsFetch = fetch, now = Date.now, key, backendUrl }) {
  const attempts = new Map(); let running = 0;
  async function readConfiguration(env) {
    let object;
    try { object = env.BUCKET ? await env.BUCKET.get(aiSettingsKey) : null; }
    catch { throw new AiSettingsError(503, 'No se pudo consultar la configuración segura de IA. Intenta nuevamente.'); }
    const storageReady = Boolean(env.BUCKET && aiSettingsRoot(env));
    if (object) {
      if (!storageReady || typeof object.etag !== 'string' || !object.etag || object.size > 16_384) throw new AiSettingsError(503, 'El almacenamiento seguro de IA requiere revisión administrativa.');
      let envelope;
      try { envelope = await object.json(); } catch { throw new AiSettingsError(503, 'No se pudo abrir la configuración cifrada de IA. Requiere recuperación administrativa.'); }
      const configuration = await aiSettingsDecrypt(envelope, aiSettingsRoot(env));
      return { ...configuration, source: 'saved', revision: envelope.revision, etag: object.etag, storageReady };
    }
    const apiKey = aiSettingsValidKey(env.OPENAI_API_KEY) ? env.OPENAI_API_KEY : '';
    const model = aiSettingsValidModel(env.OPENAI_MODEL?.trim()) ? env.OPENAI_MODEL.trim() : '';
    return { apiKey, model, source: apiKey || model ? 'environment' : 'none', revision: null, etag: null, testedAt: null, storageReady };
  }
  function sanitized(configuration) { return { configured: Boolean(configuration.apiKey && configuration.model), model: configuration.model, keySuffix: configuration.apiKey ? configuration.apiKey.slice(-4) : null, revision: configuration.revision, storageReady: configuration.storageReady, source: configuration.source, testedAt: configuration.testedAt }; }
  async function authorize(request, env, signal) {
    const authorization = request.headers.get('authorization');
    if (!authorization || !/^Bearer [A-Za-z0-9._~-]{1,8192}$/.test(authorization)) throw new AiSettingsError(401, 'Inicia sesión como administrador para configurar la IA.');
    const base = await backendUrl(env);
    if (!base || typeof key !== 'string' || !key) throw new AiSettingsError(503, 'El servidor de esta PC está desconectado. Espera a que vuelva la conexión.');
    const headers = { apikey: key, authorization, accept: 'application/json' };
    const identityResponse = await settingsFetch(base + '/auth/v1/user', { headers, redirect: 'manual', signal });
    if (identityResponse.status !== 200) { await identityResponse.body?.cancel(); throw new AiSettingsError(401, 'La sesión no es válida o venció. Inicia sesión nuevamente.'); }
    const identity = await aiSettingsReadJson(identityResponse, 65_536, signal);
    if (typeof identity.id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(identity.id)) throw new AiSettingsError(401, 'La sesión no es válida.');
    const profileResponse = await settingsFetch(base + `/rest/v1/profiles?id=eq.${encodeURIComponent(identity.id)}&select=role,active`, { headers, redirect: 'manual', signal });
    if (profileResponse.status !== 200) { await profileResponse.body?.cancel(); throw new AiSettingsError(403, 'No se pudo comprobar tu permiso para configurar IA.'); }
    const profiles = await aiSettingsReadJson(profileResponse, 16_384, signal);
    if (!Array.isArray(profiles) || profiles.length !== 1 || profiles[0]?.role !== 'admin' || profiles[0]?.active !== true) throw new AiSettingsError(403, 'La configuración de IA requiere una cuenta administradora activa.');
    return identity.id;
  }
  function reserve(userId) {
    const minute = Math.floor(now() / 60_000);
    for (const [id, item] of attempts) if (item.minute < minute - 1 && !item.active) attempts.delete(id);
    const previous = attempts.get(userId) ?? { minute, count: 0, active: false };
    const item = { minute, count: previous.minute === minute ? previous.count : 0, active: previous.active };
    if (item.active || item.count >= 5 || running >= 4) throw new AiSettingsError(429, 'Ya hay una prueba en curso o alcanzaste el límite temporal. Espera antes de probar nuevamente.');
    item.count++; item.active = true; running++; attempts.set(userId, item);
    return () => { item.active = false; running--; };
  }
  async function handle(request, env) {
    let release;
    try {
      const url = new URL(request.url), testing = url.pathname === '/api/ai-settings/test';
      if (request.headers.get('origin') && request.headers.get('origin') !== url.origin) throw new AiSettingsError(403, 'Origen no permitido.');
      if (testing ? request.method !== 'POST' : !['GET', 'PUT'].includes(request.method)) throw new AiSettingsError(405, 'Método no permitido.');
      const signal = AbortSignal.timeout(35_000);
      const userId = await authorize(request, env, signal);
      const current = await readConfiguration(env);
      if (!testing && request.method === 'GET') return aiSettingsJson(sanitized(current));
      if (!current.storageReady) throw new AiSettingsError(503, 'El almacenamiento seguro de IA todavía no está preparado en el servidor.');
      if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') ?? '')) throw new AiSettingsError(415, 'Envía la configuración en formato JSON.');
      const body = await aiSettingsReadJson(request, 16_384, signal);
      const keys = testing ? ['apiKey', 'model', 'revision'] : ['apiKey', 'model', 'revision', 'testToken'];
      if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(name => !keys.includes(name)) || !Object.hasOwn(body, 'revision')
        || body.revision !== null && (typeof body.revision !== 'string' || body.revision.length > 128) || typeof body.model !== 'string' || !aiSettingsValidModel(body.model.trim())
        || body.apiKey !== undefined && typeof body.apiKey !== 'string') throw new AiSettingsError(400, 'Revisa la clave, el modelo y la revisión de la configuración.');
      if (body.revision !== current.revision) throw new AiSettingsError(409, 'La configuración cambió desde que la consultaste. Actualiza la sección y vuelve a probar.');
      const apiKey = body.apiKey?.trim() || current.apiKey, model = body.model.trim();
      if (!aiSettingsValidKey(apiKey)) throw new AiSettingsError(400, 'Ingresa una clave de API válida para probar la conexión.');
      const fingerprint = await aiSettingsFingerprint(apiKey), secret = aiSettingsRoot(env);
      if (testing) {
        release = reserve(userId);
        const response = await settingsFetch('https://api.openai.com/v1/responses', {
          method: 'POST', redirect: 'manual', signal,
          headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
          body: JSON.stringify({ model, store: false, max_output_tokens: 1024,
            instructions: 'Prueba técnica de salida estructurada. Devuelve únicamente el objeto JSON solicitado con ok igual a true.',
            input: 'Prueba ficticia de conexión, sin datos de negocio.',
            text: { format: { type: 'json_schema', name: 'rcfito_ai_configuration_test', strict: true, schema: { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'], additionalProperties: false } } },
          }),
        });
        if (response.status !== 200) {
          await response.body?.cancel();
          throw new AiSettingsError(response.status === 429 ? 429 : 502, response.status === 401 || response.status === 403 ? 'El proveedor rechazó la clave o su acceso al modelo. Revisa los datos e intenta nuevamente.' : response.status === 429 ? 'El proveedor alcanzó su límite de solicitudes o saldo. Revisa la cuenta antes de probar nuevamente.' : 'El proveedor no confirmó la prueba del modelo. Revisa el modelo y vuelve a intentar.');
        }
        let result, output;
        try {
          result = await aiSettingsReadJson(response, 32_768, signal);
          const contents = Array.isArray(result.output) ? result.output.filter(item => item?.type === 'message').flatMap(item => Array.isArray(item.content) ? item.content : []) : [];
          if (result.status !== 'completed' || contents.some(item => item?.type === 'refusal')) throw new Error('NOT_COMPLETED');
          output = JSON.parse(contents.filter(item => item?.type === 'output_text' && typeof item.text === 'string').map(item => item.text).join(''));
          if (!output || typeof output !== 'object' || Object.keys(output).length !== 1 || output.ok !== true) throw new Error('INVALID_TEST_RESULT');
        } catch { throw new AiSettingsError(502, 'El modelo no confirmó una salida estructurada válida. Revisa el modelo y vuelve a probar.'); }
        const stamp = now();
        const testToken = await aiSettingsProof(secret, { version: 1, userId, fingerprint, model, revision: current.revision, issuedAt: stamp, expiresAt: stamp + aiSettingsProofLifetime, nonce: crypto.randomUUID() });
        return aiSettingsJson({ ok: true, testToken, model });
      }
      const proof = await aiSettingsVerifyProof(body.testToken, secret, { userId, fingerprint, model, revision: current.revision }, now());
      const configuration = { apiKey, model, testedAt: new Date(proof.issuedAt).toISOString() };
      const envelope = await aiSettingsEncrypt(configuration, secret, userId, now());
      const onlyIf = new Headers(current.etag ? { 'if-match': `"${current.etag}"` } : { 'if-none-match': '*' });
      const saved = await env.BUCKET.put(aiSettingsKey, JSON.stringify(envelope), { onlyIf, httpMetadata: { contentType: 'application/json', cacheControl: 'no-store' } });
      if (!saved) throw new AiSettingsError(409, 'Otra persona cambió la configuración mientras guardabas. Actualiza y vuelve a probar.');
      return aiSettingsJson(sanitized({ ...configuration, source: 'saved', revision: envelope.revision, storageReady: true }));
    } catch (error) {
      if (error instanceof AiSettingsError) return aiSettingsJson({ error: error.message }, error.status, error.status === 429 ? { 'retry-after': '60' } : {});
      return aiSettingsJson({ error: error?.name === 'TimeoutError' || error?.name === 'AbortError' ? 'La prueba tardó demasiado. Conserva los datos y vuelve a intentar.' : 'No se pudo completar la configuración de IA. No se confirmó el guardado.' }, 503);
    } finally { release?.(); }
  }
  return { handle, readConfiguration };
}
