import regularUrl from '@/assets/fonts/Vera.ttf?url'
import boldUrl from '@/assets/fonts/VeraBd.ttf?url'
import type { DraftRecipeDocument } from '@/domain/application-draft-document'
import { createDraftRecipePdf, type DraftPdfFonts } from './application-draft-pdf'

let cachedFonts: Promise<DraftPdfFonts> | undefined
async function font(url: string) {
  const response = await fetch(url, { credentials: 'omit' })
  if (!response.ok) throw new Error('No se pudo cargar la tipografía del PDF. Intenta exportar nuevamente.')
  const bytes = new Uint8Array(await response.arrayBuffer())
  if (bytes.length < 1000 || bytes[0] !== 0 || bytes[1] !== 1 || bytes[2] !== 0 || bytes[3] !== 0) throw new Error('La tipografía del PDF no está disponible. Intenta exportar nuevamente.')
  let binary = ''
  for (let index = 0; index < bytes.length; index += 32768) binary += String.fromCharCode(...bytes.subarray(index, index + 32768))
  return btoa(binary)
}
function fonts() {
  cachedFonts ??= Promise.all([font(regularUrl), font(boldUrl)]).then(([regular, bold]) => ({ regular, bold })).catch(error => { cachedFonts = undefined; throw error })
  return cachedFonts
}

export async function downloadDraftRecipe(snapshot: DraftRecipeDocument) {
  const { doc, filename } = await createDraftRecipePdf(snapshot, await fonts())
  const url = URL.createObjectURL(doc.output('blob'))
  const anchor = document.createElement('a')
  anchor.href = url; anchor.download = filename; anchor.hidden = true
  document.body.append(anchor)
  try { anchor.click() }
  finally { anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000) }
}
