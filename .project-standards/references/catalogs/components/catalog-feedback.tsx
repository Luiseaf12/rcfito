import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"

export type CatalogFeedbackProps = {
  kind: "loading" | "empty" | "error"
  message?: string
  onRetry?: () => void
}

export function CatalogFeedback({ kind, message, onRetry }: CatalogFeedbackProps) {
  if (kind === "loading") {
    return (
      <div role="status" className="tw:flex tw:flex-col tw:gap-4">
        <span>{message ?? "Cargando catálogo…"}</span>
        <Skeleton aria-hidden="true" className="tw:h-11 tw:w-full" />
        <Skeleton aria-hidden="true" className="tw:h-11 tw:w-full" />
      </div>
    )
  }

  if (kind === "error") {
    return (
      <Alert variant="destructive">
        <AlertTitle>No se pudo cargar el catálogo</AlertTitle>
        <AlertDescription>{message ?? "Intenta cargarlo de nuevo."}</AlertDescription>
        {onRetry ? <Button type="button" variant="outline" onClick={onRetry}>Reintentar</Button> : null}
      </Alert>
    )
  }

  return (
    <Empty role="status">
      <EmptyHeader>
        <EmptyTitle>Aún no hay registros</EmptyTitle>
        <EmptyDescription>{message ?? "Los registros aparecerán aquí cuando se agreguen."}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}
