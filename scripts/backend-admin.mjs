import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs, parseEnv } from 'node:util';

const host = '127.0.0.1';
const port = 5181;
const origin = `http://${host}:${port}`;
const apiUrl = 'http://127.0.0.1:55451';
const bodyLimit = 16 * 1024;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class BootstrapError extends Error {
  constructor(message, { status = 503, terminal = false, code = 'BOOTSTRAP_FAILED' } = {}) {
    super(message);
    this.name = 'BootstrapError';
    this.status = status;
    this.terminal = terminal;
    this.code = code;
  }
}

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);

export function validatePassword(password, confirmation) {
  if (typeof password !== 'string' || password.length < 12 || password.length > 256) {
    throw new BootstrapError('Elige una contraseña de entre 12 y 256 caracteres.', { status: 400, code: 'PASSWORD_INVALID' });
  }
  if (typeof confirmation !== 'string' || password !== confirmation) {
    throw new BootstrapError('Las contraseñas no coinciden. Escríbelas de nuevo.', { status: 400, code: 'PASSWORD_MISMATCH' });
  }
}

function safeEqual(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string') return false;
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function validateConfig(config) {
  if (typeof config.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(config.email) || config.email.length > 254) {
    throw new Error('Indica un correo válido mediante --email.');
  }
  if (typeof config.displayName !== 'string' || !config.displayName.trim() || config.displayName.length > 120) {
    throw new Error('El nombre de administración debe contener entre 1 y 120 caracteres.');
  }
  if (typeof config.serviceRoleKey !== 'string' || config.serviceRoleKey.length < 20) {
    throw new Error('La configuración privada no contiene una clave de servicio válida.');
  }
  // Even injected test configuration cannot direct a production credential off-host.
  if (config.apiUrl !== apiUrl) throw new Error('La API de bootstrap debe ser http://127.0.0.1:55451.');
}

function apiRequest(config, path, { method = 'GET', body, prefer } = {}) {
  return config.fetchImpl(`${config.apiUrl}${path}`, {
    method,
    redirect: 'error',
    headers: {
      apikey: config.serviceRoleKey,
      authorization: `Bearer ${config.serviceRoleKey}`,
      'content-type': 'application/json',
      ...(prefer ? { Prefer: prefer } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(15000),
  });
}

export async function activeAdminExists(config) {
  let response;
  try { response = await apiRequest(config, '/rest/v1/profiles?select=id&role=eq.admin&active=eq.true&limit=1'); }
  catch { throw new BootstrapError('No se pudo verificar si ya existe una cuenta administradora. Comprueba que Supabase esté disponible.'); }
  if (!response.ok) throw new BootstrapError('No se pudo verificar la administración. Comprueba la API y las migraciones antes de continuar.');
  let rows;
  try { rows = await response.json(); } catch { throw new BootstrapError('La verificación de administración devolvió una respuesta no válida.'); }
  if (!Array.isArray(rows) || rows.some((row) => !uuid.test(row?.id ?? ''))) {
    throw new BootstrapError('La verificación de administración devolvió una respuesta no válida.');
  }
  return rows.length > 0;
}

/** Injectable fetch permits isolated API-stub tests; this function never starts a server. */
export async function createFirstAdministrator(options, password) {
  const config = { apiUrl, displayName: 'Administración RCFito', fetchImpl: fetch, ...options };
  validateConfig(config);
  validatePassword(password, password);
  if (await activeAdminExists(config)) {
    throw new BootstrapError('Ya existe una cuenta administradora activa. Este asistente no modifica cuentas ni contraseñas existentes.', { status: 409, terminal: true, code: 'ADMIN_EXISTS' });
  }

  let response;
  try {
    response = await apiRequest(config, '/auth/v1/admin/users', {
      method: 'POST',
      body: { email: config.email, password, email_confirm: true, user_metadata: { display_name: config.displayName } },
    });
  } catch {
    throw new BootstrapError('No se pudo confirmar el alta de la cuenta. El asistente quedó bloqueado para evitar repetir una creación de resultado desconocido. Requiere revisión privada.', { status: 502, terminal: true, code: 'CREATE_UNKNOWN' });
  }
  if (!response.ok) {
    throw new BootstrapError('Auth rechazó el alta. El correo podría estar registrado o no cumplir una política del servidor. No se modificó ninguna cuenta existente.', { status: 409, terminal: true, code: 'CREATE_REJECTED' });
  }
  let created;
  try { created = await response.json(); } catch { /* Outcome is unknown; do not modify another account by email. */ }
  const id = created?.id ?? created?.user?.id;
  if (!uuid.test(id ?? '')) {
    throw new BootstrapError('Auth no devolvió una identidad válida. El resultado del alta requiere revisión privada; no se modificará ninguna cuenta existente.', { status: 502, terminal: true, code: 'CREATE_UNKNOWN' });
  }

  let promotionFailure;
  try {
    if (await activeAdminExists(config)) {
      throw new BootstrapError('Otra cuenta administradora se habilitó durante el proceso.', { status: 409, terminal: true, code: 'ADMIN_RACE' });
    }
    const promoted = await apiRequest(config, `/rest/v1/profiles?id=eq.${encodeURIComponent(id)}&select=id,role,active`, {
      method: 'PATCH', prefer: 'return=representation', body: { display_name: config.displayName, role: 'admin', active: true },
    });
    if (!promoted.ok) throw new Error('Promotion failed');
    const profiles = await promoted.json();
    if (!Array.isArray(profiles) || profiles.length !== 1 || profiles[0].id !== id || profiles[0].role !== 'admin' || profiles[0].active !== true) {
      throw new Error('Promotion not confirmed');
    }
    return { id, email: config.email, displayName: config.displayName };
  } catch (error) { promotionFailure = error; }

  // Compensation is restricted to the exact identity created by this invocation.
  let removed = false;
  try { const cleanup = await apiRequest(config, `/auth/v1/admin/users/${encodeURIComponent(id)}`, { method: 'DELETE' }); removed = cleanup.ok; } catch { /* Report partial outcome without secrets. */ }
  if (!removed) {
    throw new BootstrapError('La cuenta se creó, pero no se confirmó su habilitación y tampoco pudo retirarse. El resultado es parcial y requiere revisión administrativa privada. No repitas el alta.', { status: 500, terminal: true, code: 'PARTIAL_CREATE' });
  }
  if (promotionFailure instanceof BootstrapError && promotionFailure.code === 'ADMIN_RACE') {
    throw new BootstrapError('Ya se habilitó otra cuenta administradora. La cuenta creada por este intento fue retirada; no se modificó la cuenta existente.', { status: 409, terminal: true, code: 'ADMIN_EXISTS' });
  }
  throw new BootstrapError('No se pudo habilitar el perfil administrador. La cuenta recién creada fue retirada y no se confirmó ningún alta.', { status: 503, code: 'PROMOTION_ROLLED_BACK' });
}

async function readForm(request) {
  const contentType = request.headers['content-type']?.split(';')[0].trim().toLowerCase();
  if (contentType !== 'application/x-www-form-urlencoded') throw new BootstrapError('Formato de formulario no permitido.', { status: 415 });
  const declaredLength = request.headers['content-length'];
  if (declaredLength !== undefined && (!/^\d+$/.test(declaredLength) || Number(declaredLength) > bodyLimit)) throw new BootstrapError('El formulario supera el tamaño permitido.', { status: 413 });
  const parts = [];
  let size = 0;
  for await (const part of request) {
    size += part.length;
    if (size > bodyLimit) throw new BootstrapError('El formulario supera el tamaño permitido.', { status: 413 });
    parts.push(part);
  }
  const values = new URLSearchParams(Buffer.concat(parts).toString('utf8'));
  const allowed = new Set(['_csrf', 'password', 'confirmation']);
  for (const key of values.keys()) if (!allowed.has(key) || values.getAll(key).length !== 1) throw new BootstrapError('El formulario contiene campos no permitidos o duplicados.', { status: 400 });
  if (values.size !== allowed.size) throw new BootstrapError('El formulario está incompleto.', { status: 400 });
  return values;
}

function renderPage(config, csrf, nonce, { state = 'form', error = '' } = {}) {
  const form = state === 'form' ? `<p>Elige tu contraseña en este navegador. Se creará únicamente la primera cuenta administradora.</p>
    <dl><div><dt>Correo de acceso</dt><dd>${escapeHtml(config.email)}</dd></div><div><dt>Nombre</dt><dd>${escapeHtml(config.displayName)}</dd></div></dl>
    <form method="post" action="/create-admin" autocomplete="off"><input type="hidden" name="_csrf" value="${escapeHtml(csrf)}">
      <label for="password">Contraseña <span>(mínimo 12 caracteres)</span></label><input id="password" name="password" type="password" minlength="12" maxlength="256" autocomplete="new-password" required autofocus>
      <label for="confirmation">Confirmar contraseña</label><input id="confirmation" name="confirmation" type="password" minlength="12" maxlength="256" autocomplete="new-password" required>
      <button type="submit">Crear mi cuenta administradora</button>
    </form><p class="note">La contraseña no se escribe en archivos ni se registra en logs. Las claves privadas permanecen en el proceso local.</p>` : state === 'complete' ? `<div class="success" role="status"><h2>Cuenta administradora creada</h2><p>Ya puedes iniciar sesión con ${escapeHtml(config.email)} y la contraseña que elegiste. Este asistente no admite más altas.</p></div><a class="button" href="http://127.0.0.1:5180/">Abrir RCFito</a>` : state === 'busy' ? `<h2>Creación en curso</h2><p>La solicitud se está procesando. No envíes otra alta.</p><a class="button" href="/">Consultar el resultado</a>` : `<h2>Asistente cerrado para nuevas altas</h2><p>Este proceso solo habilita la primera cuenta administradora. No permite modificar cuentas ni contraseñas.</p><a class="button" href="http://127.0.0.1:5180/">Abrir RCFito</a>`;
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Primera cuenta · RCFito</title><style nonce="${nonce}">
    :root{color-scheme:light;font-family:system-ui,sans-serif;color:#17392b;background:#f3f5ed}*{box-sizing:border-box}body{margin:0;padding:32px 16px}main{max-width:600px;margin:0 auto;background:white;border:1px solid #d6dfd1;border-radius:20px;padding:32px}header p{font-size:.8rem;letter-spacing:.12em;text-transform:uppercase;color:#42664f;font-weight:700}h1{font-size:1.8rem;line-height:1.2;margin:0 0 20px}h2{font-size:1.25rem}p{line-height:1.6}dl{padding:16px;background:#f3f5ed;border-radius:12px;overflow-wrap:anywhere}dl div+div{margin-top:12px}dt{font-size:.85rem;color:#42664f}dd{margin:4px 0 0;font-weight:600}form{display:flex;flex-direction:column;gap:12px;margin-top:24px}label{font-weight:600}label span{font-weight:400;font-size:.9rem}input{width:100%;min-height:48px;border:1px solid #829c86;border-radius:8px;font:inherit;padding:10px 12px;margin-bottom:8px}button,.button{display:block;min-height:48px;border:0;border-radius:8px;background:#224f38;color:white;font:inherit;font-weight:700;padding:14px 18px;text-align:center;text-decoration:none;cursor:pointer}input:focus-visible,button:focus-visible,a:focus-visible{outline:3px solid #5f8549;outline-offset:3px}.note{font-size:.9rem;color:#42664f}.error{padding:14px 16px;background:#fff0ed;border:1px solid #bc5644;color:#752c20;border-radius:10px}.success{padding:4px 0 20px}.success h2{color:#224f38}@media(max-width:420px){body{padding:16px 12px}main{padding:24px 18px}}
    </style></head><body><main><header><p>Configuración local y privada</p><h1>Primera cuenta de RCFito</h1></header>${error ? `<p class="error" role="alert">${escapeHtml(error)}</p>` : ''}${form}</main></body></html>`;
}

export function createBootstrapServer(options) {
  const config = { apiUrl, displayName: 'Administración RCFito', fetchImpl: fetch, ...options };
  validateConfig(config);
  const csrf = randomBytes(32).toString('hex');
  let inFlight = false;
  let completed = false;
  let closed = false;

  function respond(response, status, { state = 'form', error = '' } = {}) {
    const nonce = randomBytes(18).toString('base64');
    response.writeHead(status, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, max-age=0',
      Pragma: 'no-cache',
      'Content-Security-Policy': `default-src 'none'; style-src 'nonce-${nonce}'; script-src 'none'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'`,
      'X-Frame-Options': 'DENY',
      'X-Content-Type-Options': 'nosniff',
      // HTML form POST is not a CORS fetch. no-referrer can taint its Origin to
      // null, which would correctly fail the strict Origin check below.
      // same-origin preserves this local form's Origin and suppresses referrers
      // on navigation to a different origin, including the frontend port.
      'Referrer-Policy': 'same-origin',
      'Cross-Origin-Resource-Policy': 'same-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    });
    response.end(renderPage(config, csrf, nonce, { state, error }));
  }

  const server = createServer(async (request, response) => {
    const remote = request.socket.remoteAddress;
    const hostHeaders = request.rawHeaders.filter((value, index) => index % 2 === 0 && value.toLowerCase() === 'host').length;
    if (!['127.0.0.1', '::ffff:127.0.0.1'].includes(remote) || request.headers.host !== `${host}:${port}` || hostHeaders !== 1) {
      respond(response, 403, { state: 'closed', error: 'Este asistente solo admite acceso local mediante http://127.0.0.1:5181.' }); return;
    }
    if (request.method === 'GET' && request.url === '/') {
      if (completed) { respond(response, 200, { state: 'complete' }); return; }
      if (closed) { respond(response, 409, { state: 'closed' }); return; }
      if (inFlight) { respond(response, 202, { state: 'busy' }); return; }
      try { if (await activeAdminExists(config)) { closed = true; respond(response, 409, { state: 'closed', error: 'Ya existe una cuenta administradora activa.' }); return; } }
      catch { respond(response, 503, { state: 'closed', error: 'No se pudo verificar la administración. Comprueba Supabase y las migraciones, y vuelve a cargar esta página.' }); return; }
      respond(response, 200); return;
    }
    if (request.method !== 'POST' || request.url !== '/create-admin') { respond(response, 404, { state: 'closed', error: 'Ruta no disponible.' }); return; }
    if (request.headers.origin !== origin) { respond(response, 403, { state: 'closed', error: 'Origen de formulario no autorizado.' }); return; }
    if (completed || closed) { respond(response, 409, { state: completed ? 'complete' : 'closed', error: 'El asistente ya no admite nuevas altas.' }); return; }
    if (inFlight) { respond(response, 409, { state: 'busy', error: 'Hay una creación en curso. Espera y consulta su resultado.' }); return; }
    inFlight = true;
    try {
      const values = await readForm(request);
      if (!safeEqual(values.get('_csrf'), csrf)) throw new BootstrapError('El formulario no es válido. Vuelve a cargar esta página.', { status: 403 });
      const password = values.get('password');
      validatePassword(password, values.get('confirmation'));
      await createFirstAdministrator(config, password);
      completed = true;
      closed = true;
      response.writeHead(303, { Location: '/', 'Cache-Control': 'no-store', 'Referrer-Policy': 'same-origin' });
      response.end();
    } catch (error) {
      const safe = error instanceof BootstrapError ? error : new BootstrapError('No se pudo completar el proceso. No se confirmó el alta.');
      if (safe.terminal) closed = true;
      respond(response, safe.status, { state: closed ? 'closed' : 'form', error: safe.message });
    } finally { inFlight = false; }
  });
  server.requestTimeout = 20000;
  server.headersTimeout = 10000;
  server.keepAliveTimeout = 3000;
  server.maxHeadersCount = 40;
  return server;
}

function main() {
  const { values } = parseArgs({ options: { email: { type: 'string' }, name: { type: 'string' }, help: { type: 'boolean' } }, strict: true });
  if (values.help) { console.log('Uso: node scripts/backend-admin.mjs --email <correo> [--name <nombre>]\nAsistente temporal en http://127.0.0.1:5181; la contraseña se elige en el navegador.'); return; }
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  let environment;
  try { environment = parseEnv(readFileSync(resolve(root, '.artifacts/production-supabase/.env'), 'utf8')); }
  catch { throw new Error('No se pudo leer la configuración privada de operación. Prepara primero Supabase para RCFito.'); }
  const server = createBootstrapServer({ email: values.email?.trim(), displayName: values.name?.trim() || 'Administración RCFito', serviceRoleKey: environment.SERVICE_ROLE_KEY || environment.SUPABASE_SERVICE_ROLE_KEY });
  server.once('error', () => { console.error('No se pudo abrir el asistente en 127.0.0.1:5181. Comprueba que el puerto esté disponible.'); process.exitCode = 1; });
  server.listen(port, host, () => { console.log(`Asistente temporal: ${origin}`); console.log('Elige la contraseña en el navegador. El proceso se cerrará automáticamente en 30 minutos.'); });
  const expiry = setTimeout(() => { server.close(); server.closeIdleConnections(); }, 30 * 60 * 1000);
  expiry.unref();
  server.on('close', () => clearTimeout(expiry));
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { server.close(); server.closeIdleConnections(); });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); }
  catch (error) { console.error(error instanceof Error ? error.message : 'No se pudo iniciar el asistente.'); process.exitCode = 1; }
}
