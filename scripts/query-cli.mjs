import { readFile, writeFile, mkdir, lstat, chmod, rename, unlink } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import { validateApplicationQuery } from '../server/application-queries.mjs';

const cliRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cliSessionDirectory = join(cliRoot, '.artifacts', 'query-cli');
const cliSessionPath = join(cliSessionDirectory, 'session.json');
const cliDefaultUrl = 'https://rcfito.paxxa.chatgpt.site';
const cliHelp = `Consultas de RCFito (solo lectura; no consumen IA)

npm run consultas -- login [--url https://sitio]
npm run consultas -- pendientes --proyecto-id <UUID> --json
npm run consultas -- uso-producto --producto "Nombre o sinónimo" --lote "Lote" --estado realizadas --desde AAAA-MM-DD --hasta AAAA-MM-DD --json
npm run consultas -- historial --etapa-id <UUID> --limite 10 --desplazamiento 0
npm run consultas -- detalle --folio <folio>
npm run consultas -- cambios --orden-id <UUID>
npm run consultas -- logout

Filtros: --agricola[-id], --proyecto[-id], --campo[-id], --lote[-id],
--etapa-id, --producto[-id], --orden-id, --folio, --numero-etapa,
--desde, --hasta, --estado (todas/indicadas/realizadas/canceladas),
--limite (1..30), --desplazamiento (0..1000), --json, --url.
Login pide contraseña oculta y conserva la sesión en una carpeta privada ignorada.
También admite RCFITO_ACCESS_TOKEN en el entorno. Nunca pases tokens por argumentos.`;

function cliUrl(value) {
  let url; try { url = new URL(value); } catch { throw new Error('La URL del sitio no es válida.'); }
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/' || !(url.protocol === 'https:' || url.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname))) throw new Error('Usa el origen HTTPS del sitio o HTTP de loopback, sin ruta ni credenciales.');
  return url.origin;
}

export function parseQueryCli(args) {
  if (!args.length || args.includes('--help') || args.includes('-h')) return { command: 'help' };
  const aliases = { pendientes: 'pendientes', historial: 'historial', 'uso-producto': 'uso_producto', detalle: 'detalle', cambios: 'cambios', login: 'login', logout: 'logout' };
  const command = aliases[args[0]];
  if (!command) throw new Error('Comando no disponible. Usa --help.');
  const flags = { '--agricola-id': 'agricultural_unit_id', '--proyecto-id': 'project_id', '--campo-id': 'field_id', '--lote-id': 'lot_id', '--etapa-id': 'stage_id', '--producto-id': 'product_id', '--orden-id': 'order_id',
    '--agricola': 'agricultural_unit', '--proyecto': 'project', '--campo': 'field', '--lote': 'lot', '--producto': 'product', '--folio': 'folio', '--numero-etapa': 'stage_number', '--desde': 'from', '--hasta': 'to', '--estado': 'status', '--limite': 'limit', '--desplazamiento': 'offset' };
  const query = { operation: command }; let json = false, url;
  const seen = new Set();
  for (let index = 1; index < args.length; index++) {
    const flag = args[index];
    if (seen.has(flag)) throw new Error('Hay una opción repetida. Usa --help.');
    seen.add(flag);
    if (flag === '--json') { json = true; continue; }
    if (!(flag in flags) && flag !== '--url') throw new Error('Opción no disponible. Usa --help; las credenciales no se reciben por argumentos.');
    const value = args[++index];
    if (!value || value.startsWith('--')) throw new Error('Falta el valor de una opción.');
    if (flag === '--url') { url = cliUrl(value); continue; }
    if (command === 'login' || command === 'logout') throw new Error('Los filtros solo se usan con consultas.');
    const field = flags[flag];
    if (field === 'status') {
      const state = { todas: 'all', indicadas: 'indicated', realizadas: 'performed', canceladas: 'cancelled', all: 'all', indicated: 'indicated', performed: 'performed', cancelled: 'cancelled' }[value];
      if (!state) throw new Error('Estado no válido. Usa todas, indicadas, realizadas o canceladas.');
      query.status = state;
    } else if (['stage_number', 'limit', 'offset'].includes(field)) {
      if (!/^\d+$/.test(value)) throw new Error('La etapa y los límites deben ser enteros.');
      query[field] = Number(value);
    } else query[field] = value;
  }
  return { command, json, url, ...(!['login', 'logout'].includes(command) ? { query: validateApplicationQuery(query) } : {}) };
}

async function cliSafeDirectory() {
  for (const path of [join(cliRoot, '.artifacts'), cliSessionDirectory]) {
    try { if ((await lstat(path)).isSymbolicLink()) throw new Error('La carpeta de sesión no puede ser un enlace.'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    await mkdir(path, { recursive: true });
  }
  await chmod(cliSessionDirectory, 0o700);
  if (process.platform === 'win32') {
    const identity = execFileSync('whoami.exe', [], { encoding: 'utf8', windowsHide: true }).trim();
    execFileSync('icacls.exe', [cliSessionDirectory, '/inheritance:r', '/grant:r', `${identity}:(OI)(CI)F`], { stdio: 'pipe', windowsHide: true });
  }
}
async function cliReadSession() {
  for (const path of [join(cliRoot, '.artifacts'), cliSessionDirectory, cliSessionPath]) {
    try { if ((await lstat(path)).isSymbolicLink()) throw new Error('La ruta de sesión no puede ser un enlace.'); }
    catch (error) { if (error.code === 'ENOENT') return null; throw error; }
  }
  const raw = await readFile(cliSessionPath, 'utf8');
  if (raw.length > 20_000) throw new Error('El archivo de sesión no es válido. Inicia sesión nuevamente.');
  try { return JSON.parse(raw); } catch { throw new Error('El archivo de sesión no es válido. Inicia sesión nuevamente.'); }
}
async function cliSaveSession(session) {
  await cliSafeDirectory();
  try { if ((await lstat(cliSessionPath)).isSymbolicLink()) throw new Error('El archivo de sesión no puede ser un enlace.'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const temporary = join(cliSessionDirectory, `session-${crypto.randomUUID()}.tmp`);
  try { await writeFile(temporary, JSON.stringify(session), { mode: 0o600, flag: 'wx' }); await rename(temporary, cliSessionPath); }
  finally { await unlink(temporary).catch(() => {}); }
}
async function cliHiddenPassword() {
  if (!process.stdin.isTTY || !process.stdin.setRawMode) throw new Error('Login requiere una terminal interactiva para ocultar la contraseña.');
  process.stderr.write('Contraseña: ');
  const wasRaw = process.stdin.isRaw;
  process.stdin.setRawMode(true); process.stdin.resume();
  return new Promise((resolvePassword, rejectPassword) => {
    let value = '';
    const finish = error => { process.stdin.off('data', receive); process.stdin.setRawMode(wasRaw); process.stdin.pause(); process.stderr.write('\n'); if (error) rejectPassword(error); else resolvePassword(value); };
    const receive = chunk => {
      for (const character of chunk.toString('utf8')) {
        if (character === '\r' || character === '\n') { finish(); return; }
        if (character === '\u0003') { finish(new Error('Inicio de sesión cancelado.')); return; }
        if (character === '\u007f' || character === '\b') value = value.slice(0, -1);
        else if (character >= ' ' && value.length < 1024) value += character;
      }
    };
    process.stdin.on('data', receive);
  });
}
async function cliPromptCredentials() {
  const prompt = createInterface({ input: process.stdin, output: process.stderr });
  let email;
  try { email = (await prompt.question('Correo: ')).trim(); } finally { prompt.close(); }
  return { email, password: await cliHiddenPassword() };
}

export async function runQueryCli(args, dependencies = {}) {
  const parsed = parseQueryCli(args);
  const output = dependencies.output ?? (text => process.stdout.write(text + '\n'));
  if (parsed.command === 'help') { output(cliHelp); return; }
  const http = dependencies.fetch ?? fetch;
  const readSession = dependencies.readSession ?? cliReadSession;
  const saveSession = dependencies.saveSession ?? cliSaveSession;
  const environment = dependencies.env ?? process.env;
  async function fetchJson(url, options = {}) {
    const response = await http(url, { ...options, redirect: 'manual', signal: AbortSignal.timeout(50_000) });
    let body; try { body = await response.json(); } catch { throw new Error('El servidor no devolvió una respuesta válida.'); }
    return { response, body };
  }
  async function loginOrRefresh(site, credentials, refresh = false) {
    const { response: configResponse, body: config } = await fetchJson(site + '/rcfito-config.json');
    if (!configResponse.ok || !config.managed || config.url !== '/supabase' || typeof config.key !== 'string') throw new Error('El sitio no ofrece una conexión gestionada válida.');
    const { response, body } = await fetchJson(site + '/supabase/auth/v1/token?grant_type=' + (refresh ? 'refresh_token' : 'password'), {
      method: 'POST', headers: { 'content-type': 'application/json', apikey: config.key }, body: JSON.stringify(credentials) });
    if (!response.ok || typeof body.access_token !== 'string' || typeof body.refresh_token !== 'string') throw new Error('No se pudo iniciar o renovar la sesión. Revisa tus datos y permisos.');
    const session = { site, access_token: body.access_token, refresh_token: body.refresh_token, expires_at: body.expires_at };
    await saveSession(session);
    return session;
  }
  if (parsed.command === 'login') {
    const credentials = await (dependencies.promptCredentials ?? cliPromptCredentials)();
    await loginOrRefresh(parsed.url ?? cliDefaultUrl, credentials);
    output('Sesión guardada en la carpeta privada del CLI.'); return;
  }
  if (parsed.command === 'logout') {
    const session = await readSession();
    if (session?.access_token) {
      const site = cliUrl(session.site);
      if (parsed.url && site !== parsed.url) throw new Error('La URL no coincide con la sesión guardada.');
      const config = await fetchJson(site + '/rcfito-config.json');
      if (!config.response.ok || config.body.url !== '/supabase' || typeof config.body.key !== 'string') throw new Error('No se pudo comprobar el servidor para cerrar sesión.');
      const response = await http(site + '/supabase/auth/v1/logout?scope=local', { method: 'POST', headers: { authorization: 'Bearer ' + session.access_token, apikey: config.body.key }, redirect: 'manual', signal: AbortSignal.timeout(15_000) });
      if (!response.ok && response.status !== 401) throw new Error('No se pudo revocar la sesión. Intenta cerrar sesión nuevamente.');
      await response.body?.cancel();
    }
    await (dependencies.removeSession ?? (() => unlink(cliSessionPath).catch(error => { if (error.code !== 'ENOENT') throw error; })))();
    output('Sesión del CLI cerrada.'); return;
  }
  const token = environment.RCFITO_ACCESS_TOKEN;
  let session = token ? { site: parsed.url ?? cliDefaultUrl, access_token: token } : await readSession();
  if (!session?.access_token || typeof session.access_token !== 'string') throw new Error('Primero ejecuta npm run consultas -- login.');
  const site = cliUrl(session.site);
  if (parsed.url && parsed.url !== site) throw new Error('La URL no coincide con la sesión guardada. Inicia sesión en ese sitio.');
  async function queryRequest() {
    return fetchJson(site + '/api/application-query', { method: 'POST', headers: { authorization: 'Bearer ' + session.access_token, 'content-type': 'application/json' }, body: JSON.stringify({ query: parsed.query }) });
  }
  let result = await queryRequest();
  if (result.response.status === 401 && !token && typeof session.refresh_token === 'string') {
    session = await loginOrRefresh(site, { refresh_token: session.refresh_token }, true); result = await queryRequest();
  }
  if (!result.response.ok) throw new Error(typeof result.body.error === 'string' ? result.body.error : 'No se pudo ejecutar la consulta.');
  if (!result.body.result || typeof result.body.answer !== 'string') throw new Error('La respuesta de consulta está incompleta.');
  output(parsed.json ? JSON.stringify(result.body, null, 2) : result.body.answer + '\nCorte: ' + result.body.result.as_of + (result.body.cached ? ' · resultado reutilizado vigente' : ''));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runQueryCli(process.argv.slice(2)).catch(error => { process.stderr.write('Error: ' + (error.message || 'No se pudo ejecutar el CLI.') + '\n'); process.exitCode = 1; });
}
