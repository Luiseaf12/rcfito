export type Connection = { url: string; key: string }

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
  return { url: `${url.origin}${url.pathname.replace(/\/+$/, '')}`, key }
}
