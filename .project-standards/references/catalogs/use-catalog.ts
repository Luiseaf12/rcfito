import { useRef, useState } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import { CatalogSaveError, type CatalogRepository } from "./catalog-contract"

/** Coordination only. The repository owns authorization and persistence. */
export function useCatalog<TRecord, TInput>(repository: CatalogRepository<TRecord, TInput>, scope: string) {
  const query = useQuery({
    queryKey: ["catalog", scope], queryFn: () => repository.list(),
    retry: false, staleTime: Infinity, refetchOnWindowFocus: false,
  })
  const mutation = useMutation({ mutationFn: (input: TInput) => repository.save(input), retry: false })
  const locked = useRef(false)
  const uncertain = useRef<TInput | null>(null)
  const reviewRequired = useRef(false)
  const [busy, setBusy] = useState(false)
  const [saveError, setSaveError] = useState("")
  const [needsReconciliation, setNeedsReconciliation] = useState(false)
  const [needsReview, setNeedsReview] = useState(false)
  const [feedback, setFeedback] = useState("")

  const refresh = async (afterSave = false) => {
    try {
      await query.refetch({ throwOnError: true })
      if (afterSave || feedback) setFeedback("Registro guardado. El listado está actualizado.")
    } catch {
      if (afterSave) setFeedback("Registro guardado; no se pudo actualizar el listado. Usa Actualizar listado.")
    }
  }
  const confirmed = (record: TRecord, onSaved: (record: TRecord) => void) => {
    uncertain.current = null
    setNeedsReconciliation(false)
    setSaveError("")
    setFeedback("Registro guardado. Actualizando el listado…")
    onSaved(record)
    void refresh(true)
  }
  const conflict = (error: CatalogSaveError) => {
    uncertain.current = null
    setNeedsReconciliation(false)
    reviewRequired.current = true
    setNeedsReview(true)
    setSaveError(error.message)
    void refresh()
  }
  const save = async (input: TInput, onSaved: (record: TRecord) => void) => {
    if (locked.current || uncertain.current !== null || reviewRequired.current) return
    locked.current = true
    setBusy(true)
    setSaveError("")
    setFeedback("")
    try {
      confirmed(await mutation.mutateAsync(input), onSaved)
    } catch (error) {
      if (error instanceof CatalogSaveError && error.outcome === "conflict") { conflict(error); return }
      // Unexpected transport failures must not enable blind mutation retries.
      const unknown = !(error instanceof CatalogSaveError) || error.outcome === "unknown"
      if (unknown) {
        uncertain.current = input
        setNeedsReconciliation(true)
        setSaveError("No pudimos confirmar el guardado. Comprueba el resultado antes de volver a enviar.")
      } else setSaveError(error.message)
    } finally {
      locked.current = false
      setBusy(false)
    }
  }
  const reconcile = async (onSaved: (record: TRecord) => void) => {
    if (locked.current || uncertain.current === null) return
    locked.current = true
    setBusy(true)
    try {
      const result = await repository.reconcile(uncertain.current)
      if (result) confirmed(result, onSaved)
      else {
        uncertain.current = null
        setNeedsReconciliation(false)
        setSaveError("El cambio no se aplicó. Puedes volver a guardar la captura.")
      }
    } catch (error) {
      if (error instanceof CatalogSaveError && error.outcome === "conflict") conflict(error)
      else setSaveError("Todavía no pudimos confirmar el resultado. Comprueba de nuevo cuando haya conexión.")
    } finally {
      locked.current = false
      setBusy(false)
    }
  }
  return {
    records: query.data ?? [], loading: query.isPending, updating: query.isFetching && !query.isPending,
    loadError: query.isError, busy, saveError, needsReconciliation, needsReview, feedback,
    save, reconcile, refresh: () => refresh(), clearSaveError: () => { setSaveError(""); reviewRequired.current = false; setNeedsReview(false) },
  }
}
