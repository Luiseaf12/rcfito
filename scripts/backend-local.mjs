import { spawnSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const container = 'rcfito-db';
const project = 'rcfito-supabase';
const markerPrefix = 'rcfito-managed-migrations:';

function fail(code, message) { const error = new Error(message); error.code = code; throw error; }
function quote(value) { return `'${String(value).replaceAll("'", "''")}'`; }
export function migrationHash(sql) {
  return createHash('sha256').update(sql.replace(/\r\n/g, '\n')).digest('hex');
}

// Keep offsets while hiding SQL strings, quoted identifiers and comments.
// This distinguishes transaction wrappers from BEGIN/END inside function bodies.
export function visibleSql(sql) {
  let result = '';
  const hidden = (text) => text.replace(/[^\r\n]/g, ' ');
  for (let index = 0; index < sql.length;) {
    const start = index;
    if (sql.startsWith('--', index)) {
      const end = sql.indexOf('\n', index);
      index = end < 0 ? sql.length : end;
      result += hidden(sql.slice(start, index));
    } else if (sql.startsWith('/*', index)) {
      let depth = 1; index += 2;
      while (index < sql.length && depth) {
        if (sql.startsWith('/*', index)) { depth++; index += 2; }
        else if (sql.startsWith('*/', index)) { depth--; index += 2; }
        else index++;
      }
      if (depth) fail('INVALID_SQL_SOURCE', 'La migración contiene un comentario sin cerrar.');
      result += hidden(sql.slice(start, index));
    } else if (sql[index] === "'" || sql[index] === '"') {
      const delimiter = sql[index++]; let closed = false;
      while (index < sql.length) {
        if (sql[index] === delimiter) {
          if (sql[index + 1] === delimiter) { index += 2; continue; }
          index++; closed = true; break;
        }
        if (sql[index] === '\\' && /[eE]/.test(sql[start - 1] ?? '')) index += 2;
        else index++;
      }
      if (!closed) fail('INVALID_SQL_SOURCE', 'La migración contiene una cadena sin cerrar.');
      result += hidden(sql.slice(start, index));
    } else if (sql[index] === '$' && /^\$(?:[A-Za-z_][A-Za-z_0-9]*)?\$/.test(sql.slice(index))) {
      const delimiter = sql.slice(index).match(/^\$(?:[A-Za-z_][A-Za-z_0-9]*)?\$/)[0];
      const end = sql.indexOf(delimiter, index + delimiter.length);
      if (end < 0) fail('INVALID_SQL_SOURCE', 'La migración contiene un bloque SQL sin cerrar.');
      index = end + delimiter.length;
      result += hidden(sql.slice(start, index));
    } else result += sql[index++];
  }
  return result;
}

export function migrationBody(sql) {
  const normalized = sql.replace(/\r\n/g, '\n');
  const visible = visibleSql(normalized);
  const first = visible.match(/^\s*begin\s*;/i);
  const last = visible.match(/\bcommit\s*;\s*$/i);
  if (Boolean(first) !== Boolean(last)) fail('INVALID_SQL_WRAPPER', 'La migración debe tener BEGIN/COMMIT externos completos o ninguno.');
  const body = first ? normalized.slice(first[0].length, last.index) : normalized;
  const bodyVisible = visibleSql(body);
  if (/(?:^|;)\s*(?:begin\b|start\s+transaction\b|commit\b|rollback\b|end\s*;|savepoint\b|release\b|prepare\s+transaction\b)/i.test(bodyVisible) || /^\s*\\/m.test(bodyVisible)) {
    fail('UNSAFE_SQL_TRANSACTION', 'La migración contiene control transaccional o metacomandos que impedirían registrar su aplicación atómica.');
  }
  return body;
}

export function loadMigrations() {
  const directory = resolve(root, 'supabase/migrations');
  const files = readdirSync(directory).filter((file) => file.endsWith('.sql')).sort();
  if (!files.length) fail('NO_MIGRATIONS', 'No hay migraciones SQL locales.');
  return files.map((version) => {
    if (!/^\d{14}_[a-z0-9_]+\.sql$/.test(version)) fail('INVALID_MIGRATION_NAME', 'Hay una migración con nombre no reconocido.');
    const source = readFileSync(resolve(directory, version), 'utf8');
    return { version, sha256: migrationHash(source), body: migrationBody(source) };
  });
}

function validateRows(migrations, rows) {
  if (!Array.isArray(rows)) fail('INVALID_LEDGER', 'El registro de migraciones no es válido.');
  const known = new Map(migrations.map((migration) => [migration.version, migration.sha256]));
  const seen = new Set();
  for (const row of rows) {
    if (!row || seen.has(row.version) || !known.has(row.version)) fail('SOURCE_BEHIND_DATABASE', 'La base contiene versiones que esta revisión de código no reconoce; no se modificó.');
    if (row.sha256 !== known.get(row.version)) fail('MIGRATION_DRIFT', 'El checksum de una migración aplicada difiere del archivo local; se conserva la base sin forzar cambios.');
    seen.add(row.version);
  }
  return rows.map(({ version, sha256 }) => ({ version, sha256 }));
}

export function validateInstalledState(migrations, state) {
  let rows = validateRows(migrations, state.rows ?? []);
  let adopt = false;
  if (rows.length && !state.app_exists) fail('MISSING_APPLICATION_SCHEMA', 'Hay registro de migraciones pero falta el esquema de la aplicación; requiere revisión privada.');
  if (state.app_exists && !rows.length) {
    // A table name is not evidence of an exact installed migration. Only a marker
    // written by this manager with matching source hashes allows ledger recovery.
    if (typeof state.marker !== 'string' || !state.marker.startsWith(markerPrefix)) fail('UNTRACKED_INSTALLATION', 'El esquema ya existe sin un registro verificable de checksums; no se vuelve a ejecutar ni se adopta por coincidencia de nombres.');
    let marker;
    try { marker = JSON.parse(state.marker.slice(markerPrefix.length)); }
    catch { fail('INVALID_CHECKSUM_MARKER', 'El comprobante de migración instalado no es válido.'); }
    rows = validateRows(migrations, marker);
    if (!rows.length) fail('UNTRACKED_INSTALLATION', 'El esquema no tiene un comprobante de migración verificable.');
    adopt = true;
  }
  const installed = new Set(rows.map((row) => row.version));
  return { rows, adopt, pending: migrations.filter((migration) => !installed.has(migration.version)), marker: state.marker ?? null };
}

export function buildMigrationTransaction(migrations, plan) {
  const tag = `$rcfito_guard_${randomBytes(12).toString('hex')}$`;
  const knownVersions = migrations.map(({ version }) => quote(version)).join(',');
  const statements = [
    'begin;',
    "set local standard_conforming_strings = on;",
    "select pg_advisory_xact_lock(hashtextextended('rcfito-migrations',0));",
    'create schema if not exists rcfito_meta;',
    'revoke all on schema rcfito_meta from public, anon, authenticated;',
    'create table if not exists rcfito_meta.migrations(version text primary key,sha256 text not null check(sha256 ~ \'^[a-f0-9]{64}$\'),installed_at timestamptz not null default clock_timestamp());',
    'revoke all on rcfito_meta.migrations from public, anon, authenticated;',
    `do ${tag} begin
      if exists(select 1 from rcfito_meta.migrations where version <> all(array[${knownVersions}]::text[])) then raise exception 'SOURCE_BEHIND_DATABASE'; end if;
      if (to_regclass('public.agricultural_units') is not null or exists(select 1 from pg_namespace where nspname='rcfito_private')) and not exists(select 1 from rcfito_meta.migrations) then
        if ${plan.adopt ? 'false' : 'true'} or (select obj_description(oid,'pg_namespace') from pg_namespace where nspname='rcfito_private') is distinct from ${plan.marker === null ? 'null' : quote(plan.marker)} then raise exception 'UNTRACKED_INSTALLATION'; end if;
      end if;
    end ${tag};`,
  ];
  if (plan.adopt) for (const row of plan.rows) {
    statements.push(`insert into rcfito_meta.migrations(version,sha256) values(${quote(row.version)},${quote(row.sha256)}) on conflict(version) do nothing;`);
  }
  for (const migration of migrations) {
    statements.push(`do ${tag} declare installed_hash text; begin
      select sha256 into installed_hash from rcfito_meta.migrations where version=${quote(migration.version)};
      if found then
        if installed_hash<>${quote(migration.sha256)} then raise exception 'MIGRATION_DRIFT'; end if;
      else
        execute ${quote(migration.body)};
        insert into rcfito_meta.migrations(version,sha256) values(${quote(migration.version)},${quote(migration.sha256)});
      end if;
    end ${tag};`);
  }
  statements.push(`do ${tag} declare marker text; begin
    select ${quote(markerPrefix)} || coalesce(jsonb_agg(jsonb_build_object('version',version,'sha256',sha256) order by version),'[]'::jsonb)::text into marker from rcfito_meta.migrations;
    execute format('comment on schema rcfito_private is %L',marker);
  end ${tag};`, 'commit;');
  return statements.join('\n');
}

function docker(args, input) {
  const result = spawnSync('docker', args, { input, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  if (result.error || result.status !== 0) fail('DOCKER_OPERATION_FAILED', 'La operación Docker no se confirmó. Comprueba permisos/estado y vuelve a ejecutar; no se imprimen credenciales ni errores crudos del servidor.');
  return result.stdout.trim();
}
function assertTarget() {
  const name = docker(['inspect', container, '--format', '{{.Name}}']);
  let labels;
  try { labels = JSON.parse(docker(['inspect', container, '--format', '{{json .Config.Labels}}'])); }
  catch { fail('UNEXPECTED_DOCKER_TARGET', 'No se pudo verificar el contenedor de destino.'); }
  if (name !== `/${container}` || labels?.['com.docker.compose.project'] !== project) fail('UNEXPECTED_DOCKER_TARGET', 'El contenedor no pertenece al grupo rcfito-supabase; se conserva intacto.');
  if (docker(['inspect', container, '--format', '{{.State.Running}}']) !== 'true') fail('DATABASE_NOT_RUNNING', 'rcfito-db no está en ejecución.');
}
function sql(statement) {
  assertTarget();
  return docker(['exec', '--interactive', container, 'psql', '-X', '-U', 'postgres', '-d', 'postgres', '--quiet', '--tuples-only', '--no-align', '-v', 'ON_ERROR_STOP=1'], statement);
}
function installedState() {
  const metadata = JSON.parse(sql(`select jsonb_build_object(
    'ledger_exists',to_regclass('rcfito_meta.migrations') is not null,
    'app_exists',to_regclass('public.agricultural_units') is not null or exists(select 1 from pg_namespace where nspname='rcfito_private'),
    'marker',(select obj_description(oid,'pg_namespace') from pg_namespace where nspname='rcfito_private'));`));
  metadata.rows = metadata.ledger_exists
    ? JSON.parse(sql("select coalesce(jsonb_agg(jsonb_build_object('version',version,'sha256',sha256) order by version),'[]'::jsonb) from rcfito_meta.migrations;"))
    : [];
  return metadata;
}

export function runLocalBackend(args) {
  if (args.includes('--help')) {
    console.log('Uso: node scripts/backend-local.mjs migrate para aplicar, o --check para revisar. Sin argumentos solo revisa. Destino exclusivo: rcfito-db del proyecto Compose rcfito-supabase.');
    return;
  }
  if (args.some((arg) => !['migrate', '--check'].includes(arg)) || (args.includes('migrate') && args.includes('--check'))) fail('INVALID_ARGUMENT', 'Usa migrate o --check; no existe una opción force.');
  const migrations = loadMigrations();
  const plan = validateInstalledState(migrations, installedState());
  if (!args.includes('migrate')) {
    console.log(`Registro coherente: ${plan.rows.length} aplicadas, ${plan.pending.length} pendientes${plan.adopt ? '; comprobante válido disponible para reconstruir el registro' : ''}.`);
    return;
  }
  sql(buildMigrationTransaction(migrations, plan));
  const verified = validateInstalledState(migrations, installedState());
  if (verified.pending.length || verified.adopt) fail('MIGRATION_NOT_CONFIRMED', 'No se confirmó el registro final de todas las migraciones; conserva el estado y revisa antes de capturar.');
  console.log(`Migraciones confirmadas: ${verified.rows.length}; aplicadas ahora: ${plan.pending.length}. Registro SHA-256 privado actualizado. No se crearon datos de demostración.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { runLocalBackend(process.argv.slice(2)); }
  catch (error) { console.error(`${error.code ?? 'LOCAL_BACKEND_ERROR'}: ${error.message ?? 'No se confirmó la operación.'}`); process.exitCode = 1; }
}
