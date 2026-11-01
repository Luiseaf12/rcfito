import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeConnection } from '../src/data/connection-config'

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
