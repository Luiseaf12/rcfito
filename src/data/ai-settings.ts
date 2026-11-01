export type AiSettingsStatus = {
  configured: boolean
  model: string
  keySuffix: string | null
  revision: string | null
  storageReady: boolean
  source: 'saved' | 'environment' | 'none'
  testedAt: string | null
}
export type AiSettingsInput = { apiKey?: string; model: string; revision: string | null }
export type AiSettingsTestResult = { ok: true; testToken: string; model: string }
export type AiSettingsSaveInput = AiSettingsInput & { testToken: string }

function settingsStatus(value: unknown): AiSettingsStatus {
  if (!value || typeof value !== 'object') throw new Error('El estado de IA no es válido. Actualiza el estado para continuar.')
  const raw = value as Record<string, unknown>
  if (typeof raw.configured !== 'boolean' || typeof raw.storageReady !== 'boolean' || typeof raw.model !== 'string' || raw.model.length > 200 || !(raw.keySuffix === null || typeof raw.keySuffix === 'string' && raw.keySuffix.length <= 4) || !(raw.revision === null || typeof raw.revision === 'string' && raw.revision.length <= 200) || !['saved', 'environment', 'none'].includes(String(raw.source)) || !(raw.testedAt === null || typeof raw.testedAt === 'string' && Number.isFinite(Date.parse(raw.testedAt)))) throw new Error('El estado de IA no es válido. Actualiza el estado para continuar.')
  // Return only the public state; an unexpected field never reaches the form.
  return { configured: raw.configured, storageReady: raw.storageReady, model: raw.model, keySuffix: raw.keySuffix as string | null, revision: raw.revision as string | null, source: raw.source as AiSettingsStatus['source'], testedAt: raw.testedAt as string | null }
}
async function settingsRequest(path: string, method: 'GET' | 'POST' | 'PUT', accessToken: string, input?: AiSettingsInput | AiSettingsSaveInput, signal?: AbortSignal): Promise<unknown> {
  const response = await fetch(path, {
    method, cache: 'no-store', headers: { authorization: `Bearer ${accessToken}`, ...(input ? { 'content-type': 'application/json' } : {}) },
    ...(input ? { body: JSON.stringify(input) } : {}), signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(50_000)]) : AbortSignal.timeout(50_000),
  })
  let body: unknown
  try { body = await response.json() } catch { throw new Error('El servidor no devolvió el estado de IA. Conserva lo escrito y actualiza el estado antes de reintentar.') }
  if (!response.ok) {
    const message = body && typeof body === 'object' && 'error' in body ? (body as { error: unknown }).error : null
    throw new Error(typeof message === 'string' ? message : 'No se confirmó la operación de IA. Actualiza el estado antes de volver a probar.')
  }
  return body
}
export async function readAiSettings(accessToken: string, signal?: AbortSignal) {
  return settingsStatus(await settingsRequest('/api/ai-settings', 'GET', accessToken, undefined, signal))
}
export async function testAiConnection(accessToken: string, input: AiSettingsInput, signal?: AbortSignal): Promise<AiSettingsTestResult> {
  const value = await settingsRequest('/api/ai-settings/test', 'POST', accessToken, input, signal) as Record<string, unknown> | null
  if (!value || value.ok !== true || typeof value.testToken !== 'string' || !value.testToken || value.testToken.length > 4096 || typeof value.model !== 'string' || value.model !== input.model.trim()) throw new Error('La prueba no se confirmó. Vuelve a probar la conexión antes de guardar.')
  return { ok: true, testToken: value.testToken, model: value.model }
}
export async function persistAiSettings(accessToken: string, input: AiSettingsSaveInput, signal?: AbortSignal) {
  return settingsStatus(await settingsRequest('/api/ai-settings', 'PUT', accessToken, input, signal))
}
