import { Link } from 'react-router-dom'
import { ChevronDown } from 'lucide-react'
import type { ScheduledInterval } from '@/domain/application-schedule'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { formatDate } from './shared'

export function ScheduledDate({ date, interval }: { date: string; interval?: ScheduledInterval }) {
  if (interval?.kind !== 'interval') {
    const message = interval?.kind === 'first' ? 'Sin receta anterior'
      : interval?.kind === 'cancelled' ? 'Receta cancelada' : 'Sin referencia comparable'
    return <><div>{formatDate(date)}</div><div className="muted record-secondary">{message}</div></>
  }
  const label = `${interval.days} ${interval.days === 1 ? 'día' : 'días'} desde la anterior`
  return <Collapsible>
    <div>{formatDate(date)}</div>
    <CollapsibleTrigger asChild><Button variant="ghost" size="sm" className="justify-start whitespace-normal px-0 text-left" aria-label={`${label}. Consultar fecha y receta anterior`}><span className="record-secondary">{label}</span><ChevronDown data-icon="inline-end" aria-hidden="true" /></Button></CollapsibleTrigger>
    <CollapsibleContent className="muted record-secondary">
      Respecto a {formatDate(interval.previous.scheduled_date)} · <Link to={`/aplicaciones/${interval.previous.id}`}>{interval.previous.folio}</Link>
    </CollapsibleContent>
  </Collapsible>
}
