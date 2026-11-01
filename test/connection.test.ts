import { test } from 'node:test'
import assert from 'node:assert/strict'
import { connectionSessionKey, migrateManagedSession, normalizeConnection, resolveConnection, type Connection } from '../src/data/connection-config'

test('la conexión conserva el subdirectorio del proxy después de normalizar y persistir', () => {
  const saved = JSON.stringify(normalizeConnection({ url: 'http://127.0.0.1:5180/supabase///', key: ' sb_publishable_example ' }))
  assert.deepEqual(normalizeConnection(JSON.parse(saved)), { url: 'http://127.0.0.1:5180/supabase', key: 'sb_publishable_example' })
  assert.equal(normalizeConnection({ url: '/supabase', key: 'public' }, 'http://127.0.0.1:5180/').url, 'http://127.0.0.1:5180/supabase')
})

test('la conexión rechaza secretos, credenciales incrustadas y HTTP fuera de loopback', () => {
  const jwt = `x.${btoa(JSON.stringify({ role: 'service_role' }))}.x`
  for (const key of ['sb_secret_example', jwt, '']) assert.throws(() => normalizeConnection({ url: 'https://api.example.invalid/supabase', key }))
  for (const url of ['http://192.168.1.20', 'https://user:pass@api.example.invalid', 'https://api.example.invalid/?key=secret', 'https://api.example.invalid/#fragment']) {
    assert.throws(() => normalizeConnection({ url, key: 'public' }))
  }
})

const publicKey = 'sb_publishable_connection_test'
const legacy: Connection = { url: 'https://old-link.trycloudflare.com', key: publicKey }
const managed: Connection = { url: 'https://site.example.invalid/supabase', key: publicKey, managed: true }

function memoryStorage(initial: Record<string, string> = {}) {
  const items = new Map(Object.entries(initial))
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => { items.set(key, value) },
    removeItem: (key: string) => { items.delete(key) },
  }
}

const fictitiousSession = JSON.stringify({ access_token: 'fictitious-access', refresh_token: 'fictitious-refresh', expires_at: 2000000000 })

test('el proxy gestionado conserva su marca al normalizar y reemplaza el túnel guardado del mismo backend', () => {
  assert.deepEqual(normalizeConnection({ url: '/supabase/', key: publicKey, managed: true }, 'https://site.example.invalid/'), managed)
  assert.deepEqual(resolveConnection(legacy, managed), managed)
  assert.deepEqual(resolveConnection({ ...legacy, key: ` ${publicKey} ` }, managed), managed)
  assert.deepEqual(resolveConnection(managed, managed), managed)
})

test('la preferencia por la demo y los servidores con otra clave no son reemplazados', () => {
  const custom: Connection = { url: 'https://custom.example.invalid/api', key: 'sb_publishable_other_test' }
  assert.equal(resolveConnection({ mode: 'demo' }, managed), null)
  assert.deepEqual(resolveConnection(custom, managed), custom)
  assert.deepEqual(resolveConnection(legacy, null), legacy)
  assert.deepEqual(resolveConnection({ url: 'invalid', key: publicKey }, managed), managed)
  assert.deepEqual(resolveConnection(null, managed), managed)
  assert.deepEqual(resolveConnection(null, null, custom), custom)
})

test('el almacenamiento de sesión gestionado es estable y está separado de servidores manuales y otras claves', () => {
  assert.equal(connectionSessionKey(legacy), 'sb-old-link-auth-token')
  assert.equal(connectionSessionKey({ ...legacy, url: `${legacy.url}/api` }), 'sb-old-link-auth-token')
  assert.equal(connectionSessionKey(managed), connectionSessionKey({ ...managed, url: 'https://site.example.invalid/supabase/' }))
  assert.notEqual(connectionSessionKey(managed), connectionSessionKey({ ...managed, key: 'sb_publishable_other_test' }))
  assert.notEqual(connectionSessionKey(managed), connectionSessionKey({ ...managed, managed: undefined }))
})

test('la sesión del túnel guardado migra una sola vez y no resucita después de cerrarla', () => {
  const oldKey = connectionSessionKey(legacy), nextKey = connectionSessionKey(managed)
  const storage = memoryStorage({ [oldKey]: fictitiousSession })
  assert.equal(migrateManagedSession(storage, legacy, managed), true)
  assert.equal(storage.getItem(nextKey), fictitiousSession)
  assert.equal(storage.getItem(oldKey), null)
  storage.removeItem(nextKey) // Cierre de sesión normal del cliente gestionado.
  assert.equal(migrateManagedSession(storage, legacy, managed), false)
  assert.equal(storage.getItem(nextKey), null)
})

test('la migración conserva una sesión gestionada existente y no copia sesiones de otra clave', () => {
  const oldKey = connectionSessionKey(legacy), nextKey = connectionSessionKey(managed)
  const existingSession = JSON.stringify({ access_token: 'fictitious-current-access', refresh_token: 'fictitious-current-refresh', expires_at: 2000000001 })
  const storage = memoryStorage({ [oldKey]: fictitiousSession, [nextKey]: existingSession })
  assert.equal(migrateManagedSession(storage, legacy, managed), false)
  assert.equal(storage.getItem(nextKey), existingSession)
  assert.equal(storage.getItem(oldKey), null)

  const customStorage = memoryStorage({ [oldKey]: fictitiousSession })
  assert.equal(migrateManagedSession(customStorage, { ...legacy, key: 'sb_publishable_other_test' }, managed), false)
  assert.equal(customStorage.getItem(oldKey), fictitiousSession)
  assert.equal(customStorage.getItem(nextKey), null)
  assert.equal(migrateManagedSession(customStorage, legacy, { ...managed, managed: undefined }), false)
  assert.equal(migrateManagedSession(customStorage, null, managed), false)
})

test('una sesión malformada o almacenamiento bloqueado no rompen la elección de conexión', () => {
  const oldKey = connectionSessionKey(legacy), nextKey = connectionSessionKey(managed)
  for (const serialized of ['invalid-json', 'null', '{}', JSON.stringify({ access_token: 'fictitious', refresh_token: 'fictitious', expires_at: 'invalid' })]) {
    const storage = memoryStorage({ [oldKey]: serialized })
    assert.equal(migrateManagedSession(storage, legacy, managed), false)
    assert.equal(storage.getItem(oldKey), serialized)
    assert.equal(storage.getItem(nextKey), null)
  }
  const blocked = { getItem() { throw new Error('Almacenamiento bloqueado') }, setItem() { throw new Error('Almacenamiento bloqueado') }, removeItem() { throw new Error('Almacenamiento bloqueado') } }
  assert.equal(migrateManagedSession(blocked, legacy, managed), false)
  assert.deepEqual(resolveConnection(legacy, managed), managed)
})
