import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync, lstatSync, openSync, closeSync, unlinkSync, appendFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { uptime } from 'node:os';
import { setTimeout } from 'node:timers/promises';
import { readTunnelStatus } from './backend-tunnel.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const directory = resolve(root, '.artifacts/quick-tunnel/private');
const configPath = resolve(directory, 'publisher.json');
const logPath = resolve(directory, 'publisher.log');
const lockPath = resolve(directory, 'publisher.lock');
const siteOrigin = 'https://rcfito.paxxa.chatgpt.site';

export function publisherConfig(value) {
  if (!value || value.siteUrl !== siteOrigin || !/^[A-Za-z0-9_-]{32,512}$/.test(value.serviceToken) || !/^[A-Za-z0-9_-]{32,512}$/.test(value.updateSecret)) {
    throw new Error('La configuración privada del actualizador no es válida.');
  }
  return { siteUrl: siteOrigin, serviceToken: value.serviceToken, updateSecret: value.updateSecret };
}

function privateDirectory() {
  mkdirSync(directory, { recursive: true });
  if (lstatSync(directory).isSymbolicLink()) throw new Error('La carpeta privada no puede ser un enlace.');
  if (process.platform === 'win32') {
    const identity = `${process.env.USERDOMAIN}\\${process.env.USERNAME}`;
    const result = spawnSync('icacls.exe', [directory, '/inheritance:r', '/grant:r', `${identity}:(OI)(CI)F`, '*S-1-5-18:(OI)(CI)F'], { encoding: 'utf8', windowsHide: true });
    if (result.status !== 0) throw new Error('No se pudo restringir el acceso a la carpeta privada.');
  }
}

async function configure() {
  const input = await new Promise((done, reject) => {
    let value = '';
    const raw = process.stdin.isTTY;
    const finish = (error) => {
      process.stdin.removeListener('data', onData);
      process.stdin.removeListener('end', onEnd);
      if (raw) process.stdin.setRawMode(false);
      process.stdin.pause();
      error ? reject(error) : done(value);
    };
    const onData = chunk => {
      value += chunk;
      if (value.includes('\u0003') || value.length > 4096) finish(new Error('Entrada cancelada o demasiado grande.'));
      else if (/[\r\n]/.test(value)) finish();
    };
    const onEnd = () => finish();
    if (raw) process.stdin.setRawMode(true);
    console.log('Ready for publisher JSON on stdin (input is hidden).');
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', onData);
    process.stdin.once('end', onEnd);
    process.stdin.resume();
  });
  const config = publisherConfig(JSON.parse(input.trim()));
  privateDirectory();
  if (existsSync(configPath)) {
    const previous = publisherConfig(JSON.parse(readFileSync(configPath, 'utf8')));
    if (JSON.stringify(previous) !== JSON.stringify(config)) throw new Error('Ya existe una configuración privada diferente; se conserva sin rotar credenciales.');
  } else writeFileSync(configPath, `${JSON.stringify(config)}\n`, { mode: 0o600 });
  console.log('Actualizador configurado en su carpeta privada. Credenciales fuera de Git y con acceso restringido al usuario y SYSTEM.');
}

export async function publishOnce(config, statusReader = readTunnelStatus, send = fetch) {
  const current = statusReader();
  if (!current) throw new Error('Túnel todavía no disponible.');
  if (!/^https:\/\/[a-z0-9]+(?:-[a-z0-9]+)*\.trycloudflare\.com$/.test(current.url)) throw new Error('Dirección de túnel no válida.');
  const response = await send(`${config.siteUrl}/api/tunnel`, {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${config.updateSecret}`, 'OAI-Sites-Authorization': `Bearer ${config.serviceToken}` },
    body: JSON.stringify({ url: current.url }), redirect: 'error', signal: AbortSignal.timeout(20000),
  });
  if (response.status !== 200) { await response.body?.cancel(); throw new Error(`Registro temporal no confirmado (HTTP ${response.status}).`); }
  const result = await response.json();
  if (result.ok !== true || !Number.isFinite(result.expiresAt)) throw new Error('Respuesta del registro no válida.');
  const after = statusReader();
  if (!after || after.id !== current.id || after.startedAt !== current.startedAt || after.url !== current.url) throw new Error('El túnel cambió durante la publicación; se renovará en el siguiente intento.');
  return { url: current.url, expiresAt: result.expiresAt };
}

function log(message) {
  if (existsSync(logPath) && statSync(logPath).size > 256 * 1024) writeFileSync(logPath, '');
  appendFileSync(logPath, `${new Date().toISOString()} ${message}\n`);
}

function lock() {
  const boot = Date.now() - uptime() * 1000;
  if (existsSync(lockPath)) {
    let previous;
    try { previous = JSON.parse(readFileSync(lockPath, 'utf8')); } catch { throw new Error('El bloqueo del actualizador requiere revisión.'); }
    if (Math.abs(previous.boot - boot) < 30000) {
      try { process.kill(previous.pid, 0); throw new Error('Ya hay un actualizador activo.'); }
      catch (error) { if (error.code !== 'ESRCH') throw error; }
    }
    unlinkSync(lockPath);
  }
  closeSync(openSync(lockPath, 'wx', 0o600));
  writeFileSync(lockPath, JSON.stringify({ pid: process.pid, boot }));
  process.on('exit', () => {
    try { if (JSON.parse(readFileSync(lockPath, 'utf8')).pid === process.pid) unlinkSync(lockPath); } catch { /* Conservar bloqueo ajeno. */ }
  });
}

async function run(action) {
  if (action === 'configure') return configure();
  if (!['once', 'watch'].includes(action)) throw new Error('Usa configure, once o watch.');
  const config = publisherConfig(JSON.parse(readFileSync(configPath, 'utf8')));
  if (action === 'once') {
    const result = await publishOnce(config);
    console.log(`Dirección actual registrada; vigencia hasta ${new Date(result.expiresAt).toISOString()}.`);
    return;
  }
  lock();
  // Docker Desktop requiere la sesión interactiva de Windows, igual que esta tarea.
  if (process.platform === 'win32') spawnSync('docker', ['desktop', 'start', '--detach'], { windowsHide: true, stdio: 'ignore', timeout: 30000 });
  let previous = '';
  for (;;) {
    let state;
    try {
      const result = await publishOnce(config);
      state = `Conexión actualizada: ${result.url}`;
    } catch { state = 'Esperando Docker, túnel o conectividad con Sites; se reintentará automáticamente.'; }
    if (state !== previous) { log(state); previous = state; }
    await setTimeout(30000);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  run(process.argv[2] ?? 'once').catch(() => {
    console.error('No se pudo completar la operación del actualizador. Comprueba configuración privada, permisos y estado de Docker/Sites.');
    process.exitCode = 1;
  });
}
