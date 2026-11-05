import type { ApplicationOrder, ApplicationTarget } from './model'

type PreviousSchedule = Pick<ApplicationOrder, 'id' | 'folio' | 'scheduled_date'>
export type ScheduledInterval =
  | { kind: 'interval'; days: number; previous: PreviousSchedule }
  | { kind: 'first' | 'cancelled' | 'unavailable' }

const folios = new Intl.Collator('es-MX', { numeric: true })
/** Ascending recipe sequence, independent of scheduled dates. */
export function compareRecipeSequence(a: Pick<ApplicationOrder, 'folio' | 'id'>, b: Pick<ApplicationOrder, 'folio' | 'id'>): number {
  return folios.compare(a.folio, b.folio) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
}

export function scheduledIntervalLabel(days: number): string {
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

/** Use ALL authorized orders, with their latest indicated scheduled_date. */
export function buildScheduledIntervals(orders: readonly ApplicationOrder[], targets: readonly ApplicationTarget[]): Map<string, ScheduledInterval> {
  const byOrder = new Map<string, ApplicationTarget[]>()
  for (const target of targets) {
    const group = byOrder.get(target.order_id) ?? []
    group.push(target); byOrder.set(target.order_id, group)
  }
  const last = new Map<string, PreviousSchedule>()
  const result = new Map<string, ScheduledInterval>()
  const sequence = [...orders].sort(compareRecipeSequence)
  for (const order of sequence) {
    const destinations = byOrder.get(order.id) ?? []
    if (destinations.length && destinations.every(target => target.status === 'cancelled')) {
      result.set(order.id, { kind: 'cancelled' }); continue
    }
    const currentDay = day(order.scheduled_date)
    const key = context(order, destinations)
    if (currentDay === undefined || !key) {
      result.set(order.id, { kind: 'unavailable' }); continue
    }
    const previous = last.get(key)
    result.set(order.id, previous
      ? { kind: 'interval', days: currentDay - day(previous.scheduled_date)!, previous }
      : { kind: 'first' })
    last.set(key, { id: order.id, folio: order.folio, scheduled_date: order.scheduled_date })
  }
  return result
}
