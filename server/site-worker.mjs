const registryKey = 'rcfito/quick-tunnel.json';
const leaseMs = 120_000;
const proxyRequestHeaders = ['authorization', 'apikey', 'content-type', 'accept', 'x-client-info', 'x-supabase-api-version', 'prefer', 'range', 'range-unit', 'accept-profile', 'content-profile'];
const proxyResponseHeaders = ['content-type', 'content-range', 'range', 'preference-applied', 'www-authenticate', 'retry-after'];

export function tunnelUrl(value) {
  if (typeof value !== 'string' || !/^https:\/\/[a-z0-9]+(?:-[a-z0-9]+)*\.trycloudflare\.com$/.test(value)) throw new Error('INVALID_TUNNEL');
  return value;
}

export function apiPath(path) {
  return /^\/supabase\/(auth\/v1|rest\/v1|functions\/v1)(\/[A-Za-z0-9_.-]+)*\/?$/.test(path)
    && !/^\/supabase\/auth\/v1\/(admin|invite|generate_link|signup)(\/|$)/.test(path);
}

function json(body, status = 200, extra = {}) {
  return Response.json(body, { status, headers: { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', ...extra } });
}

async function equalSecret(received, expected) {
  if (!expected || expected.length < 32 || received.length > 512) return false;
  const hashes = await Promise.all([received, expected].map(value => crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))));
  const [left, right] = hashes.map(value => new Uint8Array(value));
  let difference = 0;
  for (let index = 0; index < left.length; index++) difference |= left[index] ^ right[index];
  return difference === 0;
}

async function smallJson(request) {
  const reader = request.body?.getReader();
  if (!reader) throw new Error('INVALID_BODY');
  let size = 0;
  const chunks = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 1024) { await reader.cancel(); throw new Error('BODY_TOO_LARGE'); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return JSON.parse(new TextDecoder().decode(bytes));
}

function activeRecord(record, now) {
  if (!record || !Number.isFinite(record.updatedAt) || !Number.isFinite(record.expiresAt)) return null;
  if (record.updatedAt > now + 5000 || record.expiresAt <= now || record.expiresAt - record.updatedAt !== leaseMs || record.expiresAt > now + leaseMs + 5000) return null;
  try { return { ...record, url: tunnelUrl(record.url) }; } catch { return null; }
}

export function createSiteWorker(assets = {}, settings = {}, services = {}) {
  const remoteFetch = services.fetch ?? fetch;
  const now = services.now ?? Date.now;
  async function registry(env) {
    if (!env.BUCKET) return null;
    const object = await env.BUCKET.get(registryKey);
    return object ? activeRecord(await object.json(), now()) : null;
  }
  return {
    async fetch(request, env) {
      const url = new URL(request.url);
      const path = url.pathname;
      try {
        if (path === '/rcfito-config.json') {
          if (!['GET', 'HEAD'].includes(request.method)) return json({ error: 'Método no permitido.' }, 405);
          // La conexión sigue siendo real aunque la PC o el registro estén caídos.
          return json({ mode: 'supabase', managed: true, url: '/supabase', key: settings.key });
        }
        if (path === '/api/tunnel') {
          if (request.method === 'GET') {
            const record = await registry(env);
            return json({ available: Boolean(record), updatedAt: record?.updatedAt ?? null, expiresAt: record?.expiresAt ?? null });
          }
          if (request.method !== 'POST') return json({ error: 'Método no permitido.' }, 405);
          const origin = request.headers.get('origin');
          if (origin && origin !== url.origin) return json({ error: 'Origen no permitido.' }, 403);
          const token = request.headers.get('authorization')?.replace(/^Bearer /, '') ?? '';
          if (!await equalSecret(token, env.RCFITO_TUNNEL_UPDATE_SECRET)) return json({ error: 'Actualizador no autorizado.' }, 401);
          if (!env.BUCKET) return json({ error: 'Registro de conexión no disponible.' }, 503);
          let target;
          try {
            const body = await smallJson(request);
            if (!body || Object.keys(body).length !== 1) throw new Error('INVALID_BODY');
            target = tunnelUrl(body.url);
          } catch { return json({ error: 'Dirección de túnel no válida.' }, 400); }
          const health = await remoteFetch(`${target}/auth/v1/health`, { headers: { apikey: settings.key }, redirect: 'manual', signal: AbortSignal.timeout(8000) });
          if (health.status !== 200 || !health.headers.get('content-type')?.includes('application/json')) return json({ error: 'El túnel todavía no está listo.' }, 502);
          await health.body?.cancel();
          const updatedAt = now();
          const expiresAt = updatedAt + leaseMs;
          await env.BUCKET.put(registryKey, JSON.stringify({ url: target, updatedAt, expiresAt }), { httpMetadata: { contentType: 'application/json', cacheControl: 'no-store' } });
          return json({ ok: true, expiresAt });
        }
        if (path === '/supabase' || path.startsWith('/supabase/')) {
          if (!apiPath(path)) return json({ error: 'Ruta no disponible.' }, 404);
          const origin = request.headers.get('origin');
          if (origin && origin !== url.origin) return json({ error: 'Origen no permitido.' }, 403);
          const record = await registry(env);
          if (!record) return json({ error: 'El servidor de esta PC está desconectado. Espera a que Docker y el túnel vuelvan a estar activos.' }, 503, { 'retry-after': '15' });
          const headers = new Headers();
          for (const name of proxyRequestHeaders) if (request.headers.has(name)) headers.set(name, request.headers.get(name));
          const response = await remoteFetch(`${record.url}${path.slice('/supabase'.length)}${url.search}`, {
            method: request.method, headers,
            ...(!['GET', 'HEAD'].includes(request.method) ? { body: request.body, duplex: 'half' } : {}),
            redirect: 'manual', signal: AbortSignal.timeout(30000),
          });
          // Una redirección nunca transmite la sesión a un destino diferente.
          if (response.status >= 300 && response.status < 400) { await response.body?.cancel(); return json({ error: 'Respuesta inesperada del servidor.' }, 502); }
          const outgoing = new Headers({ 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
          for (const name of proxyResponseHeaders) if (response.headers.has(name)) outgoing.set(name, response.headers.get(name));
          return new Response(response.body, { status: response.status, headers: outgoing });
        }
        if (!['GET', 'HEAD'].includes(request.method)) return json({ error: 'Método no permitido.' }, 405);
        const asset = assets[path === '/' ? '/index.html' : path];
        if (!asset) return json({ error: 'Ruta no disponible.' }, 404);
        const bytes = request.method === 'HEAD' ? null : Uint8Array.from(atob(asset.body), character => character.charCodeAt(0));
        return new Response(bytes, { headers: { 'content-type': asset.type, 'cache-control': path.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-store', 'x-content-type-options': 'nosniff', 'referrer-policy': 'strict-origin-when-cross-origin' } });
      } catch { return json({ error: 'La conexión temporal no está disponible. Intenta de nuevo en unos instantes.' }, 503, { 'retry-after': '15' }); }
    },
  };
}
