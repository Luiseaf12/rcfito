import { readFileSync, writeFileSync, readdirSync, lstatSync, mkdirSync, rmSync } from 'node:fs';
import { resolve, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, 'dist');
const client = resolve(dist, 'client');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };
const assets = {};
let bytes = 0;
function collect(directory) {
  for (const item of readdirSync(directory)) {
    const filename = resolve(directory, item);
    const stat = lstatSync(filename);
    if (stat.isSymbolicLink()) throw new Error('El build contiene un enlace no permitido.');
    if (stat.isDirectory()) collect(filename);
    else if (stat.isFile()) {
      const path = '/' + relative(client, filename).split(sep).join('/');
      if (path === '/rcfito-config.json') continue;
      const content = readFileSync(filename);
      bytes += content.length;
      if (bytes > 5 * 1024 * 1024) throw new Error('Los recursos superan el límite previsto para el Worker.');
      assets[path] = { body: content.toString('base64'), type: types['.' + item.split('.').at(-1)] ?? 'application/octet-stream' };
    }
  }
}
collect(client);
if (!assets['/index.html']) throw new Error('Falta index.html del frontend.');
const { key } = JSON.parse(readFileSync(resolve(root, 'public/rcfito-config.json'), 'utf8'));
let role;
try { role = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role; } catch { /* Publishable key. */ }
if (typeof key !== 'string' || key.startsWith('sb_secret_') || role === 'service_role' || !(key.startsWith('sb_publishable_') || role === 'anon')) throw new Error('El build solo admite una clave pública.');
const aiSource = readFileSync(resolve(root, 'server/application-ai.mjs'), 'utf8');
const aiSettingsSource = readFileSync(resolve(root, 'server/ai-settings.mjs'), 'utf8');
const workerSource = readFileSync(resolve(root, 'server/site-worker.mjs'), 'utf8');
const querySource = readFileSync(resolve(root, 'server/application-queries.mjs'), 'utf8');
const chatSource = readFileSync(resolve(root, 'server/application-chat.mjs'), 'utf8').replace(/^import .* from '\.\/application-queries\.mjs';\r?\n/, '');
if (/^\s*import\s/m.test(chatSource)) throw new Error('El servicio de consultas contiene un import no empaquetado.');
const aiImports = ["import { createApplicationAiHandler } from './application-ai.mjs';", "import { createAiSettingsService } from './ai-settings.mjs';", "import { createApplicationChatService } from './application-chat.mjs';"];
let embeddedWorker = workerSource;
for (const statement of aiImports) {
  if (!embeddedWorker.includes(statement)) throw new Error('La entrada del Worker cambió; revisa el empaquetado de IA.');
  embeddedWorker = embeddedWorker.replace(statement, '');
}
if (/^\s*import\s/m.test(embeddedWorker)) throw new Error('El Worker contiene un import que no está empaquetado.');
const source = `${aiSettingsSource}\n${aiSource}\n${querySource}\n${chatSource}\n${embeddedWorker}`;
if (dist !== resolve(root, 'dist') || lstatSync(dist).isSymbolicLink()) throw new Error('Destino de build no permitido.');
rmSync(dist, { recursive: true });
mkdirSync(resolve(dist, 'server'), { recursive: true });
mkdirSync(resolve(dist, '.openai'), { recursive: true });
writeFileSync(resolve(dist, 'server/index.js'), `${source}\nexport default createSiteWorker(${JSON.stringify(assets)}, ${JSON.stringify({ key })});\n`);
writeFileSync(resolve(dist, '.openai/hosting.json'), readFileSync(resolve(root, '.openai/hosting.json')));
// Los recursos están embebidos en el ESM; no se envían archivos privados ni fuentes.
console.log(`Worker preparado: ${Object.keys(assets).length} recursos públicos, ${bytes} bytes antes de codificación.`);
