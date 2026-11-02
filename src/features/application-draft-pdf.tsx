import { useRef, useState } from 'react'
import { FileDown, LoaderCircle } from 'lucide-react'
import type { DraftRecipeDocument } from '@/domain/application-draft-document'
import type { SavedRecipeDocument } from '@/domain/saved-recipe-document'
import { Button } from '@/components/ui/button'
import { errorMessage } from './shared'

async function downloadDraft(snapshot: DraftRecipeDocument) {
  const { downloadDraftRecipe } = await import('@/export/download-application-draft')
  await downloadDraftRecipe(snapshot)
}
async function downloadSaved(snapshot: SavedRecipeDocument) {
  const { downloadSavedRecipe } = await import('@/export/download-application-draft')
  await downloadSavedRecipe(snapshot)
}
export function useDraftRecipePdf() { return useRecipePdf(downloadDraft) }
export function useSavedRecipePdf() { return useRecipePdf(downloadSaved) }

function useRecipePdf<T>(download: (snapshot: T) => Promise<void>) {
  const inProgress = useRef(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function exportDocument(snapshot: T) {
    if (inProgress.current) return
    inProgress.current = true; setBusy(true); setError('')
    try {
      const immutable = structuredClone(snapshot)
      await download(immutable)
    } catch (err) { setError(errorMessage(err)) }
    finally { inProgress.current = false; setBusy(false) }
  }
  return { busy, error, exportDocument }
}

type PdfButtonProps = { busy: boolean; disabled?: boolean; onClick: () => void }
export function DraftRecipePdfButton(props: PdfButtonProps) { return <RecipePdfButton {...props} label="Exportar borrador PDF" /> }
export function SavedRecipePdfButton(props: PdfButtonProps) { return <RecipePdfButton {...props} label="Exportar receta PDF" /> }
function RecipePdfButton({ busy, disabled, onClick, label }: PdfButtonProps & { label: string }) {
  return <Button type="button" variant="outline" disabled={busy || disabled} onClick={onClick}>{busy ? <LoaderCircle data-icon="inline-start" className="animate-spin" aria-hidden="true" /> : <FileDown data-icon="inline-start" aria-hidden="true" />}{busy ? 'Preparando PDF…' : label}</Button>
}
