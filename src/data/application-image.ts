import { validateImageExtraction, type ImageExtraction } from '@/domain/application-image'

export type CaptureImage = { mime_type: 'image/png' | 'image/jpeg' | 'image/webp'; data: string }
export const MAX_CAPTURE_IMAGE_BYTES = 5 * 1024 * 1024

/** Decode locally before accepting a preview; the server validates independently. */
export async function readCaptureImage(file: File): Promise<CaptureImage> {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw new Error('Selecciona una imagen PNG, JPEG o WebP.')
  if (!file.size || file.size > MAX_CAPTURE_IMAGE_BYTES) throw new Error('La imagen debe pesar entre 1 byte y 5 MB.')
  const bitmap = await createImageBitmap(file).catch(() => { throw new Error('No se pudo abrir la imagen. Revisa el archivo o selecciona otra imagen.') })
  try { if (!bitmap.width || !bitmap.height || bitmap.width * bitmap.height > 20_000_000) throw new Error('La imagen admite hasta 20 megapíxeles.') } finally { bitmap.close() }
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('No se pudo leer la imagen. Intenta seleccionarla nuevamente.'))
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('La imagen está vacía.'))
    reader.readAsDataURL(file)
  })
  return { mime_type: file.type as CaptureImage['mime_type'], data: dataUrl.slice(dataUrl.indexOf(',') + 1) }
}

export const captureImageUrl = (image: CaptureImage) => `data:${image.mime_type};base64,${image.data}`

export async function interpretApplicationImage(message: string, image: CaptureImage, accessToken: string, signal?: AbortSignal): Promise<ImageExtraction> {
  if (message.length > 20_000) throw new Error('El contexto admite hasta 20,000 caracteres.')
  const response = await fetch('/api/application-draft', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${accessToken}` }, body: JSON.stringify({ message, image }), signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(50_000)]) : AbortSignal.timeout(50_000) })
  let body: { imageDraft?: unknown; error?: unknown }
  try { body = await response.json() } catch { throw new Error('No se pudo interpretar la respuesta. Conserva la imagen e intenta nuevamente.') }
  if (!response.ok) throw new Error(typeof body.error === 'string' ? body.error : 'No se pudo interpretar la imagen. Puedes conservarla y reintentar.')
  return validateImageExtraction(body.imageDraft)
}
