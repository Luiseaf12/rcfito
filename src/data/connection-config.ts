export type Connection = { url: string; key: string; managed?: true }

export function normalizeConnection(value: Connection, baseUrl?: string): Connection {
  const url = new URL(value.url, baseUrl)
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error('Usa una URL HTTP o HTTPS sin credenciales, consultas ni fragmentos.')
  }
  if (url.protocol !== 'https:' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
    throw new Error('Para un servidor externo utiliza HTTPS.')
  }
  const key = value.key.trim()
  if (!key) throw new Error('La clave pública es obligatoria.')
  let role = ''
  try { role = JSON.parse(atob(key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).role } catch { /* Publishable keys are not JWTs. */ }
  if (key.startsWith('sb_secret_') || role === 'service_role') {
    throw new Error('Usa únicamente la clave pública publishable o anon. Las claves privadas no pertenecen al navegador.')
  }
  return { url: `${url.origin}${url.pathname.replace(/\/+$/, '')}`, key, ...(value.managed === true ? { managed: true as const } : {}) }
}

export function storedConnection(value: unknown): Connection | null {
  if (!value || typeof value !== 'object' || !('url' in value) || !('key' in value) || typeof value.url !== 'string' || typeof value.key !== 'string') return null
  try { return normalizeConnection(value as Connection) } catch { return null }
}

export function resolveConnection(saved: unknown, runtime: Connection | null, fallback: Connection | null = null): Connection | null {
  if (saved && typeof saved === 'object' && 'mode' in saved && saved.mode === 'demo') return null
  const previous = storedConnection(saved)
  // La clave pública identifica el backend gestionado; una URL vieja del túnel
  // no debe imponerse a su proxy estable. Otros servidores siguen siendo propios.
  if (runtime?.managed && (!previous || previous.key === runtime.key)) return runtime
  return previous ?? runtime ?? fallback
}

export function connectionSessionKey(connection: Connection): string {
  if (connection.managed) return `rcfito-managed-${encodeURIComponent(connection.key)}-auth-token`
  // Mismo namespace que el cliente Supabase existente para servidores manuales.
  return `sb-${new URL(connection.url).hostname.split('.')[0]}-auth-token`
}

type SessionStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export function migrateManagedSession(storage: SessionStorage, previous: Connection | null, current: Connection): boolean {
  if (!current.managed || !previous || previous.managed || previous.key !== current.key) return false
  const oldKey = connectionSessionKey(previous)
  const nextKey = connectionSessionKey(current)
  try {
    const serialized = storage.getItem(oldKey)
    if (!serialized) return false
    const session = JSON.parse(serialized)
    if (!session || typeof session.access_token !== 'string' || !session.access_token || typeof session.refresh_token !== 'string' || !session.refresh_token || !Number.isFinite(session.expires_at)) return false
    const copied = !storage.getItem(nextKey)
    if (copied) storage.setItem(nextKey, serialized)
    // Retirar el origen después de guardar impide resucitarlo tras cerrar sesión.
    storage.removeItem(oldKey)
    return copied
  } catch { return false } // El navegador puede impedir el acceso al almacenamiento.
}
