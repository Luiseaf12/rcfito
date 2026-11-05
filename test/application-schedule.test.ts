import assert from 'node:assert/strict'
import test from 'node:test'
import { buildScheduledIntervals } from '../src/domain/application-schedule.ts'
import { currentOrderIndication } from '../src/domain/application-editing.ts'
import { emptyWorkspace, type ApplicationOrder, type ApplicationTarget } from '../src/domain/model.ts'

function fixture(dates: string[]) {
  const data = emptyWorkspace()
  data.applicationOrders = dates.map((date, i): ApplicationOrder => ({
    id: `order-${i + 1}`, folio: `APL-${i + 1}`, project_id: 'project', field_id: 'field', crop_id: 'crop', method_id: 'method',
    indicated_date: '2026-09-01', scheduled_date: date, water_l_ha: 100, observations: '', products: [],
    selection_origin: 'group', source_group_id: 'group-a', source_group_name: 'Grupo ficticio',
  }))
  data.applicationTargets = data.applicationOrders.flatMap(order => ['stage-a', 'stage-b'].map((stage, i): ApplicationTarget => ({
    id: `${order.id}-${stage}`, order_id: order.id, stage_id: stage, status: 'indicated',
    lot_name: `Malla ${i + 1}`, subdivision_name: 'Completa', stage_number: 1, crop_name: 'Cultivo', variety_name: 'Variedad', area_ha: 5,
    actual_date: null, actual_water_l_ha: null, actual_products: [], equipment: '', applicator: '', actual_observations: '', cancellation_reason: '', has_changes: false,
  })))
  return data
}

test('fechas de la captura dan 5, 16 y 5 días; usa cronología programada sin mutar datos', () => {
  const data = fixture(['2026-09-04', '2026-09-09', '2026-09-25', '2026-09-30'])
  data.applicationOrders.reverse(); data.applicationTargets.reverse()
  const original = structuredClone(data)
  const result = buildScheduledIntervals(data.applicationOrders, data.applicationTargets)
  assert.deepEqual(result.get('order-1'), { kind: 'first' })
  for (const [id, days, prior] of [['order-2', 5, 'order-1'], ['order-3', 16, 'order-2'], ['order-4', 5, 'order-3']] as const) {
    const interval = result.get(id)
    assert.equal(interval?.kind, 'interval')
    if (interval?.kind === 'interval') { assert.equal(interval.days, days); assert.equal(interval.previous.id, prior) }
  }
  assert.deepEqual(data, original)
})

test('grupo, selección manual, lote, proyecto, campo, cultivo y etapas no cruzan sus referencias', () => {
  const data = fixture(Array.from({ length: 9 }, (_, i) => `2026-09-${String(i + 1).padStart(2, '0')}`))
  data.applicationOrders[1].source_group_id = 'group-b'
  data.applicationOrders[2].selection_origin = 'individual'
  data.applicationOrders[3].selection_origin = 'manual'
  data.applicationOrders[4].project_id = 'other-project'
  data.applicationOrders[5].field_id = 'other-field'
  data.applicationOrders[6].crop_id = 'other-crop'
  data.applicationTargets.filter(target => target.order_id === 'order-8').forEach(target => { target.stage_id += '-next-sowing' })
  const result = buildScheduledIntervals(data.applicationOrders, data.applicationTargets)
  for (let i = 1; i <= 8; i++) assert.deepEqual(result.get(`order-${i}`), { kind: 'first' })
  const final = result.get('order-9')
  assert.equal(final?.kind, 'interval')
  if (final?.kind === 'interval') { assert.equal(final.days, 8); assert.equal(final.previous.id, 'order-1') }
  data.applicationTargets = data.applicationTargets.filter(target => target.id !== 'order-9-stage-b')
  assert.deepEqual(buildScheduledIntervals(data.applicationOrders, data.applicationTargets).get('order-9'), { kind: 'first' }, 'una selección diferente no inventa un intervalo conjunto')
})

test('excluye totalmente canceladas; incluye realizadas y parcialmente canceladas', () => {
  const data = fixture(['2026-09-01', '2026-09-03', '2026-09-06', '2026-09-08'])
  data.applicationTargets.filter(target => target.order_id === 'order-2').forEach(target => { target.status = 'cancelled' })
  data.applicationTargets.filter(target => target.order_id === 'order-3').forEach(target => { target.status = 'performed' })
  data.applicationTargets.find(target => target.order_id === 'order-4')!.status = 'cancelled'
  const result = buildScheduledIntervals(data.applicationOrders, data.applicationTargets)
  assert.deepEqual(result.get('order-2'), { kind: 'cancelled' })
  const third = result.get('order-3'), fourth = result.get('order-4')
  assert.equal(third?.kind === 'interval' && third.days, 5)
  assert.equal(fourth?.kind === 'interval' && fourth.days, 2)
})

test('mismo día da cero con folios naturales estables y al día siguiente da uno', () => {
  const data = fixture(Array(10).fill('2026-09-01'))
  data.applicationOrders[9].scheduled_date = '2026-09-02'
  const result = buildScheduledIntervals([...data.applicationOrders].reverse(), data.applicationTargets)
  assert.deepEqual(result.get('order-1'), { kind: 'first' })
  const same = result.get('order-9'), next = result.get('order-10')
  assert.equal(same?.kind === 'interval' && same.days, 0)
  assert.equal(same?.kind === 'interval' && same.previous.folio, 'APL-8')
  assert.equal(next?.kind === 'interval' && next.days, 1)
  assert.deepEqual([...result], [...buildScheduledIntervals(data.applicationOrders, data.applicationTargets)])
})

test('días calendario exactos entre meses, año bisiesto y cambio horario; fechas inválidas no cuentan', () => {
  for (const [from, to, days] of [['2024-02-28', '2024-03-01', 2], ['2026-03-07', '2026-03-09', 2], ['2026-12-31', '2027-01-01', 1]] as const) {
    const data = fixture([from, to])
    const result = buildScheduledIntervals(data.applicationOrders, data.applicationTargets).get('order-2')
    assert.equal(result?.kind === 'interval' && result.days, days)
  }
  const data = fixture(['2026-02-28', '2026-02-30', '2026-03-01'])
  const result = buildScheduledIntervals(data.applicationOrders, data.applicationTargets)
  assert.deepEqual(result.get('order-2'), { kind: 'unavailable' })
  const third = result.get('order-3')
  assert.equal(third?.kind === 'interval' && third.days, 1)
})

test('la última indicación recalcula referencias aunque la anterior no aparezca en la página o filtro', () => {
  const data = fixture(['2026-09-01', '2026-09-05', '2026-09-10'])
  const order = data.applicationOrders[1]
  const before = currentOrderIndication(data, order)
  data.applicationChanges.push({ id: 'revision', order_id: order.id, target_id: null, target_ids: data.applicationTargets.filter(target => target.order_id === order.id).map(target => target.id), kind: 'indication', version: 1,
    reason: 'Cambio ficticio', changed_by: 'admin', changed_by_name: 'QA', changed_at: '2026-09-05T15:00:00Z', before, after: { ...before, scheduled_date: '2026-09-08' } })
  order.revision = 1
  const all = data.applicationOrders.map(item => ({ ...item, ...currentOrderIndication(data, item) }))
  const intervals = buildScheduledIntervals(all, data.applicationTargets)
  const visible = all.filter(item => item.id === 'order-3').slice(0, 1)
  const interval = intervals.get(visible[0].id)
  assert.equal(interval?.kind === 'interval' && interval.days, 2)
  assert.equal(interval?.kind === 'interval' && interval.previous.scheduled_date, '2026-09-08')
})

test('sin destinos, origen desconocido o grupo sin identidad no se inventan recetas anteriores', () => {
  const data = fixture(['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04'])
  data.applicationTargets = data.applicationTargets.filter(target => target.order_id !== 'order-1')
  data.applicationOrders[1].selection_origin = 'unknown'
  data.applicationOrders[2].source_group_id = null
  data.applicationTargets.push({ ...data.applicationTargets.find(target => target.order_id === 'order-4')!, id: 'duplicate' })
  for (const interval of buildScheduledIntervals(data.applicationOrders, data.applicationTargets).values()) assert.equal(interval.kind, 'unavailable')
})
