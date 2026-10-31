import { useId, type ReactNode } from "react"
import { Card, CardAction, CardContent, CardHeader } from "@/components/ui/card"

export type CatalogPageProps = {
  id?: string
  title: string
  description?: string
  headingLevel?: 1 | 2
  action?: ReactNode
  toolbar?: ReactNode
  resultsSummary?: string
  feedback?: ReactNode
  busy?: boolean
  children: ReactNode
}

/** Presentation only: the catalog controller owns permissions and query state. */
export function CatalogPage({
  id,
  title,
  description,
  headingLevel = 1,
  action,
  toolbar,
  resultsSummary,
  feedback,
  busy = false,
  children,
}: CatalogPageProps) {
  const headingId = useId()
  const Heading = headingLevel === 1 ? "h1" : "h2"

  return (
    <section id={id} data-ui-catalog aria-labelledby={headingId} className="catalog-page tw:flex tw:flex-col tw:gap-6">
      <Card>
      <CardHeader>
        <div className="tw:flex tw:min-w-0 tw:flex-col tw:gap-2">
          <Heading id={headingId}>{title}</Heading>
          {description ? <p>{description}</p> : null}
        </div>
        {action ? <CardAction>{action}</CardAction> : null}
      </CardHeader>
      <CardContent className="tw:flex tw:flex-col tw:gap-4">
      {toolbar}
      {resultsSummary !== undefined ? <p role="status">{resultsSummary}</p> : null}
      {feedback}
      <div aria-busy={busy} className="tw:min-w-0">{children}</div>
      </CardContent>
      </Card>
    </section>
  )
}
