import { validateExtractedApplication, type ExtractedApplication } from '@/domain/application-import'

/** Sends only the source message and the current session to this installation. */
export async function interpretApplicationMessage(message: string, accessToken: string, signal?: AbortSignal): Promise<ExtractedApplication> {
  if (!message.trim() || message.length > 20_000) throw new Error('Pega un mensaje de hasta 20,000 caracteres.')
  const response = await fetch('/api/application-draft', {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ message }), signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(50_000)]) : AbortSignal.timeout(50_000),
  })
  let body: { draft?: unknown; error?: unknown }
  try { body = await response.json() } catch { throw new Error('No se pudo interpretar la respuesta del servicio de IA. Tu mensaje se conserva; puedes reintentar.') }
  if (!response.ok) throw new Error(typeof body?.error === 'string' ? body.error : 'La interpretación con IA no está disponible. Tu mensaje se conserva.')
  return validateExtractedApplication(body?.draft)
}
