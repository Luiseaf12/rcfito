import type { ApplicationOrder, ApplicationTarget } from './model'
import { sortDisplay } from './list-order'

type PreviousApplication = Pick<ApplicationOrder, 'id' | 'folio'> & { actual_date: string | null }
export type ActualInterval =
  | { kind: 'interval'; days: number; previous: PreviousApplication & { actual_date: string } }
  | { kind: 'missing-date'; previous?: PreviousApplication }
  | { kind: 'first' | 'cancelled' | 'unavailable' }
export type TargetApplicationDate = { target: ApplicationTarget; date: string | null; interval: ActualInterval }
export type ApplicationDates = {
  entries: TargetApplicationDate[]; dates: string[];
  pendingCount: number; performedCount: number; cancelledCount: number;
}

const folios = new Intl.Collator('es-MX', { numeric: true })
/** Ascending recipe sequence, independent of scheduled dates. */
export function compareRecipeSequence(a: Pick<ApplicationOrder, 'folio' | 'id'>, b: Pick<ApplicationOrder, 'folio' | 'id'>): number {
  return folios.compare(a.folio, b.folio) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
}

export function applicationIntervalLabel(days: number): string {
  const count = Math.abs(days)
  return `${count} ${count === 1 ? 'día' : 'días'} ${days < 0 ? 'antes de la anterior' : 'desde la anterior'}`
}

function day(value: string): number | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return
  const epoch = Date.parse(`${value}T00:00:00Z`)
  if (Number.isFinite(epoch) && new Date(epoch).toISOString().slice(0, 10) === value) return epoch / 86_400_000
}

function context(order: ApplicationOrder, targets: readonly ApplicationTarget[]): string | undefined {
  const origin = order.selection_origin
  if (!origin || origin === 'unknown' || !targets.length) return
  if (origin === 'group' && !order.source_group_id) return
  const stages = [...new Set(targets.map(target => target.stage_id))].sort()
  if (stages.length !== targets.length || stages.some(id => !id)) return
  // Stage identity also retains the lot/subdivision and sowing season. Do not
  // infer a group from its current membership or compare different selections.
  return JSON.stringify([order.project_id, order.field_id, order.crop_id, origin,
    origin === 'group' ? order.source_group_id : null, stages])
}

function actualDate(target: ApplicationTarget): string | null {
  return target.status === 'performed' && target.actual_date && day(target.actual_date) !== undefined ? target.actual_date : null
}

/** Use ALL authorized recipes and the current performance of each historical target. */
export function buildApplicationDates(orders: readonly ApplicationOrder[], targets: readonly ApplicationTarget[]): Map<string, ApplicationDates> {
  const byOrder = new Map<string, ApplicationTarget[]>()
  for (const target of targets) {
    const group = byOrder.get(target.order_id) ?? []
    group.push(target); byOrder.set(target.order_id, group)
  }
  const last = new Map<string, { order: ApplicationOrder; targets: Map<string, ApplicationTarget> }>()
  const result = new Map<string, ApplicationDates>()
  const sequence = [...orders].sort(compareRecipeSequence)
  for (const order of sequence) {
    const destinations = byOrder.get(order.id) ?? []
    const key = context(order, destinations)
    const previous = key ? last.get(key) : undefined
    const entries = sortDisplay(destinations, target => `${target.lot_name} ${target.subdivision_name}`, target => target.id).map((target): TargetApplicationDate => {
      const date = actualDate(target)
      const priorTarget = previous?.targets.get(target.stage_id)
      const priorDate = priorTarget ? actualDate(priorTarget) : null
      const reference = previous ? { id: previous.order.id, folio: previous.order.folio, actual_date: priorDate } : undefined
      let interval: ActualInterval
      if (target.status === 'cancelled') interval = { kind: 'cancelled' }
      else if (!key) interval = { kind: 'unavailable' }
      else if (!date) interval = { kind: 'missing-date', ...(reference ? { previous: reference } : {}) }
      else if (!previous) interval = { kind: 'first' }
      else if (!priorDate) interval = { kind: 'missing-date', previous: reference! }
      else interval = { kind: 'interval', days: day(date)! - day(priorDate)!, previous: { ...reference!, actual_date: priorDate } }
      return { target, date, interval }
    })
    result.set(order.id, {
      entries, dates: [...new Set(entries.flatMap(entry => entry.date ? [entry.date] : []))].sort(),
      pendingCount: destinations.filter(target => target.status === 'indicated').length,
      performedCount: destinations.filter(target => target.status === 'performed').length,
      cancelledCount: destinations.filter(target => target.status === 'cancelled').length,
    })
    // Missing dates and partially cancelled recipes still occupy their sequence position.
    if (key && !destinations.every(target => target.status === 'cancelled')) {
      last.set(key, { order, targets: new Map(destinations.map(target => [target.stage_id, target])) })
    }
  }
  return result
}

/** A date range matches one actual performance within BOTH bounds, never the schedule. */
export function matchesApplicationDate(summary: ApplicationDates | undefined, from: string, to: string): boolean {
  if (!from && !to) return true
  if (from && to && from > to) return false
  return summary?.dates.some(date => (!from || date >= from) && (!to || date <= to)) ?? false
}

/** Only combine intervals when all non-cancelled destinations have the same dates/reference. */
export function commonApplicationInterval(summary: ApplicationDates): ActualInterval | undefined {
  if (summary.dates.length > 1) return
  const intervals = summary.entries.filter(entry => entry.target.status !== 'cancelled').map(entry => entry.interval)
  const first = intervals[0]
  if (!first) return
  return intervals.every(interval => JSON.stringify(interval) === JSON.stringify(first)) ? first : undefined
}
