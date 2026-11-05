import { Link } from 'react-router-dom'
import { ChevronDown } from 'lucide-react'
import { applicationIntervalLabel, commonApplicationInterval, type ActualInterval, type ApplicationDates } from '@/domain/application-schedule'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { formatDate } from './shared'

function intervalLabel(interval: ActualInterval): string {
  return interval.kind === 'interval' ? applicationIntervalLabel(interval.days)
    : interval.kind === 'first' ? 'Sin receta anterior'
      : interval.kind === 'missing-date' ? 'Sin fecha para comparar'
        : interval.kind === 'cancelled' ? 'Cancelada' : 'Sin referencia comparable'
}

export function ApplicationDate({ summary }: { summary?: ApplicationDates }) {
  if (!summary?.entries.length) return <><div>Fecha real no disponible</div><div className="muted record-secondary">Sin referencia comparable</div></>
  if (summary.cancelledCount === summary.entries.length) return <div>Cancelada</div>
  const date = summary.dates.length > 1 ? 'Varias fechas' : summary.dates.length === 1 ? formatDate(summary.dates[0])
    : summary.performedCount ? 'Fecha real no disponible' : 'Pendiente de aplicación'
  const common = commonApplicationInterval(summary)
  const label = common ? intervalLabel(common) : 'Ver fechas e intervalos por lote'
  return <Collapsible>
    <div>{date}</div>
    {summary.pendingCount > 0 && summary.performedCount > 0 && <div className="muted record-secondary">Aplicación parcial · {summary.pendingCount} {summary.pendingCount === 1 ? 'destino pendiente' : 'destinos pendientes'}</div>}
    <CollapsibleTrigger asChild><Button variant="ghost" size="sm" className="justify-start whitespace-normal px-0 text-left" aria-label={`${label}. Consultar fechas e intervalos por lote`}><span className="record-secondary">{label}</span><ChevronDown data-icon="inline-end" aria-hidden="true" /></Button></CollapsibleTrigger>
    <CollapsibleContent className="record-secondary">
      <ul className="flex flex-col gap-3 py-2">
        {summary.entries.map(({ target, date: actualDate, interval }) => <li key={target.id}>
          <div>{target.lot_name} · {target.subdivision_name} · Etapa {target.stage_number}</div>
          <div className="muted">{target.status === 'cancelled' ? 'Cancelada' : target.status === 'indicated' ? 'Pendiente de aplicación' : actualDate ? `Aplicada: ${formatDate(actualDate)}` : 'Fecha real no disponible'}</div>
          {target.status !== 'cancelled' && <div>{intervalLabel(interval)}</div>}
          {'previous' in interval && interval.previous && <div className="muted">Respecto a {interval.previous.actual_date ? formatDate(interval.previous.actual_date) : 'sin fecha real'} · <Link to={`/aplicaciones/${interval.previous.id}`}>{interval.previous.folio}</Link></div>}
        </li>)}
      </ul>
    </CollapsibleContent>
  </Collapsible>
}
