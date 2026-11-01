import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const runtime = resolve(root, '.artifacts/production-supabase');
const env = parseEnv(readFileSync(resolve(runtime, '.env'), 'utf8'));
const key = env.SUPABASE_PUBLISHABLE_KEY || env.ANON_KEY;
let anonymous = key?.startsWith('sb_publishable_');
try { anonymous ||= JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role === 'anon'; } catch { /* Publishable keys are not JWTs. */ }
if (!anonymous) throw new Error('Falta una clave pública válida en la instalación local.');
writeFileSync(resolve(runtime, 'frontend-config.json'), JSON.stringify({ mode: 'supabase', url: '/supabase', key }) + '\n', { mode: 0o644 });
console.log('Conexión pública local preparada para el proxy /supabase. Ninguna clave privada se copia al frontend.');
