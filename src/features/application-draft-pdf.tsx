import { useRef, useState } from 'react'
import { FileDown, LoaderCircle } from 'lucide-react'
import type { DraftRecipeDocument } from '@/domain/application-draft-document'
import { Button } from '@/components/ui/button'
import { errorMessage } from './shared'

export function useDraftRecipePdf() {
  const inProgress = useRef(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function exportDocument(snapshot: DraftRecipeDocument) {
    if (inProgress.current) return
    inProgress.current = true; setBusy(true); setError('')
    try {
      const immutable = structuredClone(snapshot)
      const { downloadDraftRecipe } = await import('@/export/download-application-draft')
      await downloadDraftRecipe(immutable)
    } catch (err) { setError(errorMessage(err)) }
    finally { inProgress.current = false; setBusy(false) }
  }
  return { busy, error, exportDocument }
}

export function DraftRecipePdfButton({ busy, disabled, onClick }: { busy: boolean; disabled?: boolean; onClick: () => void }) {
  return <Button type="button" variant="outline" disabled={busy || disabled} onClick={onClick}>{busy ? <LoaderCircle data-icon="inline-start" className="animate-spin" aria-hidden="true" /> : <FileDown data-icon="inline-start" aria-hidden="true" />}{busy ? 'Preparando PDF…' : 'Exportar borrador PDF'}</Button>
}
