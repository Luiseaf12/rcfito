import assert from 'node:assert/strict'
import test from 'node:test'
import { buildApplicationDates, commonApplicationInterval, matchesApplicationDate, compareRecipeSequence, applicationIntervalLabel } from '../src/domain/application-schedule.ts'
import { emptyWorkspace, type ApplicationOrder, type ApplicationTarget } from '../src/domain/model.ts'

function fixture(dates: (string | null)[]) {
  const data = emptyWorkspace()
  data.applicationOrders = dates.map((_, i): ApplicationOrder => ({
    id: `order-${i + 1}`, folio: `APL-${i + 1}`, project_id: 'project', field_id: 'field', crop_id: 'crop', method_id: 'method',
    indicated_date: '2026-01-01', scheduled_date: '2026-12-31', water_l_ha: 100, observations: '', products: [],
    selection_origin: 'group', source_group_id: 'group-a', source_group_name: 'Grupo ficticio',
  }))
  data.applicationTargets = data.applicationOrders.flatMap((order, n) => ['stage-a', 'stage-b'].map((stage, i): ApplicationTarget => ({
    id: `${order.id}-${stage}`, order_id: order.id, stage_id: stage, status: dates[n] === null ? 'indicated' : 'performed',
    lot_name: `Malla ${i + 1}`, subdivision_name: 'Completa', stage_number: 1, crop_name: 'Cultivo', variety_name: 'Variedad', area_ha: 5,
    actual_date: dates[n], actual_water_l_ha: 100, actual_products: [], equipment: '', applicator: '', actual_observations: '', cancellation_reason: '', has_changes: false,
  })))
  return data
}
const calculate = (data: ReturnType<typeof fixture>) => buildApplicationDates(data.applicationOrders, data.applicationTargets)
const target = (data: ReturnType<typeof fixture>, n: number, stage = 'a') => data.applicationTargets.find(item => item.id === `order-${n}-stage-${stage}`)!
const interval = (data: ReturnType<typeof fixture>, n: number, stage = 'a') => calculate(data).get(`order-${n}`)!.entries.find(entry => entry.target.stage_id === `stage-${stage}`)!.interval

test('usa exclusivamente fechas reales, conserva datos y fechas programadas distintas', () => {
  const data = fixture(['2026-09-04', '2026-09-09', '2026-09-25', '2026-09-30'])
  data.applicationOrders.reverse(); data.applicationTargets.reverse()
  const before = structuredClone(data), result = calculate(data)
  assert.equal(commonApplicationInterval(result.get('order-1')!)?.kind, 'first')
  for (const [n, days] of [[2, 5], [3, 16], [4, 5]]) {
    const actual = commonApplicationInterval(result.get(`order-${n}`)!)
    assert.equal(actual?.kind === 'interval' && actual.days, days)
    assert.equal(actual?.kind === 'interval' && actual.previous.id, `order-${n - 1}`)
  }
  assert.deepEqual(data, before)
})

test('grupo, origen, selección, proyecto, campo, cultivo y etapas aíslan sus referencias', () => {
  const data = fixture(Array.from({ length: 9 }, (_, i) => `2026-09-${String(i + 1).padStart(2, '0')}`))
  data.applicationOrders[1].source_group_id = 'group-b'
  data.applicationOrders[2].selection_origin = 'individual'
  data.applicationOrders[3].selection_origin = 'manual'
  data.applicationOrders[4].project_id = 'other-project'
  data.applicationOrders[5].field_id = 'other-field'
  data.applicationOrders[6].crop_id = 'other-crop'
  data.applicationTargets.filter(item => item.order_id === 'order-8').forEach(item => { item.stage_id += '-next-sowing' })
  for (let n = 1; n <= 8; n++) assert.equal(commonApplicationInterval(calculate(data).get(`order-${n}`)!)?.kind, 'first')
  const last = interval(data, 9)
  assert.equal(last.kind === 'interval' && last.days, 8)
  data.applicationTargets = data.applicationTargets.filter(item => item.id !== 'order-9-stage-b')
  assert.equal(interval(data, 9).kind, 'first')
})

test('excluye totalmente canceladas; una cancelación parcial no salta la receta por destino', () => {
  const data = fixture(['2026-09-01', '2026-09-03', '2026-09-06', '2026-09-08'])
  data.applicationTargets.filter(item => item.order_id === 'order-2').forEach(item => { item.status = 'cancelled' })
  target(data, 3).status = 'cancelled'
  assert.equal(calculate(data).get('order-2')!.cancelledCount, 2)
  assert.deepEqual(calculate(data).get('order-2')!.dates, [])
  const third = interval(data, 3, 'b'), fourth = interval(data, 4)
  assert.equal(third.kind === 'interval' && third.days, 5)
  assert.equal(fourth.kind, 'missing-date')
  assert.equal('previous' in fourth && fourth.previous?.id, 'order-3')
  const other = interval(data, 4, 'b')
  assert.equal(other.kind === 'interval' && other.days, 2)
})

test('mismo día da cero y al día siguiente uno, con folios naturales estables', () => {
  const data = fixture(Array(10).fill('2026-09-01'))
  data.applicationTargets.filter(item => item.order_id === 'order-10').forEach(item => { item.actual_date = '2026-09-02' })
  const same = interval(data, 9), next = interval(data, 10)
  assert.equal(same.kind === 'interval' && same.days, 0)
  assert.equal(next.kind === 'interval' && next.days, 1)
  assert.equal(next.kind === 'interval' && next.previous.folio, 'APL-9')
  assert.deepEqual([...buildApplicationDates([...data.applicationOrders].reverse(), data.applicationTargets)], [...calculate(data)])
})

test('calendario exacto entre meses, año bisiesto y cambio horario', () => {
  for (const [from, to, days] of [['2024-02-28', '2024-03-01', 2], ['2026-03-07', '2026-03-09', 2], ['2026-12-31', '2027-01-01', 1]] as const) {
    const actual = interval(fixture([from, to]), 2)
    assert.equal(actual.kind === 'interval' && actual.days, days)
  }
})

test('fechas inválidas no se usan ni permiten saltarse la receta anterior', () => {
  for (const invalid of ['2026-02-30', 'no-fecha', '2026-3-1', '2026-03-01T00:00:00Z', '']) {
    const data = fixture(['2026-02-28', invalid, '2026-03-01'])
    assert.deepEqual(calculate(data).get('order-2')!.dates, [])
    const actual = interval(data, 3)
    assert.equal(actual.kind, 'missing-date')
    assert.equal('previous' in actual && actual.previous?.folio, 'APL-2')
  }
})

test('una corrección real recalcula todo el historial antes de filtrar; programación no influye', () => {
  const data = fixture(['2026-09-01', '2026-09-05', '2026-09-10'])
  data.applicationTargets.filter(item => item.order_id === 'order-2').forEach(item => { item.actual_date = '2026-09-12' })
  data.applicationOrders[1].scheduled_date = '2026-10-01'
  const result = calculate(data), visible = data.applicationOrders.filter(item => item.id === 'order-3').slice(0, 1)
  const actual = commonApplicationInterval(result.get(visible[0].id)!)
  assert.equal(actual?.kind === 'interval' && actual.days, -2)
  assert.equal(actual?.kind === 'interval' && actual.previous.actual_date, '2026-09-12')
})

test('sin destinos, origen desconocido, grupo sin identidad o etapas duplicadas no inventa referencia', () => {
  const data = fixture(Array(4).fill('2026-09-01'))
  data.applicationTargets = data.applicationTargets.filter(item => item.order_id !== 'order-1')
  data.applicationOrders[1].selection_origin = 'unknown'
  data.applicationOrders[2].source_group_id = null
  data.applicationTargets.push({ ...target(data, 4), id: 'duplicate' })
  assert.equal(calculate(data).get('order-1')!.entries.length, 0)
  for (const n of [2, 3, 4]) assert.equal(commonApplicationInterval(calculate(data).get(`order-${n}`)!)?.kind, 'unavailable')
})

test('el folio previo manda aunque las fechas reales retrocedan', () => {
  const data = fixture(['2028-04-09', '2028-03-14', '2028-03-19', '2028-04-25', '2028-04-30'])
  data.applicationOrders.forEach((order, i) => { order.folio = `APL-${101 + i}` })
  for (const [n, days] of [[2, -26], [3, 5], [4, 37], [5, 5]]) {
    const actual = interval(data, n)
    assert.equal(actual.kind === 'interval' && actual.days, days)
    assert.equal(actual.kind === 'interval' && actual.previous.folio, `APL-${99 + n}`)
  }
})

test('listado descendente antes de paginar y mensajes de cero, singular y signo', () => {
  const data = fixture(Array(12).fill('2028-08-01')), original = structuredClone(data.applicationOrders)
  const sorted = [...data.applicationOrders].sort((a, b) => compareRecipeSequence(b, a))
  assert.deepEqual(sorted.slice(0, 8).map(item => item.folio), ['APL-12', 'APL-11', 'APL-10', 'APL-9', 'APL-8', 'APL-7', 'APL-6', 'APL-5'])
  assert.deepEqual(sorted.slice(8).map(item => item.folio), ['APL-4', 'APL-3', 'APL-2', 'APL-1'])
  assert.deepEqual(data.applicationOrders, original)
  for (const [days, label] of [[-26, '26 días antes de la anterior'], [-1, '1 día antes de la anterior'], [0, '0 días desde la anterior'], [1, '1 día desde la anterior']] as const) assert.equal(applicationIntervalLabel(days), label)
})

test('fecha común, fechas distintas y realización parcial conservan sus datos por destino', () => {
  const data = fixture(['2026-09-01', '2026-09-06'])
  target(data, 2, 'b').actual_date = '2026-09-08'
  let summary = calculate(data).get('order-2')!
  assert.deepEqual(summary.dates, ['2026-09-06', '2026-09-08'])
  assert.equal(commonApplicationInterval(summary), undefined)
  assert.deepEqual(summary.entries.map(entry => entry.interval.kind === 'interval' && entry.interval.days), [5, 7])
  target(data, 2, 'b').status = 'indicated'
  summary = calculate(data).get('order-2')!
  assert.deepEqual(summary.dates, ['2026-09-06'])
  assert.equal(summary.pendingCount, 1); assert.equal(summary.performedCount, 1)
  assert.equal(commonApplicationInterval(summary), undefined)
})

test('una fecha actual común con anteriores distintas no es un intervalo conjunto', () => {
  const data = fixture(['2026-09-01', '2026-09-06'])
  target(data, 1, 'b').actual_date = '2026-09-02'
  const summary = calculate(data).get('order-2')!
  assert.equal(commonApplicationInterval(summary), undefined)
  assert.deepEqual(summary.entries.map(entry => entry.interval.kind === 'interval' && entry.interval.days), [5, 4])
})

test('filtro real inclusivo exige que una misma fecha caiga dentro de ambos límites', () => {
  const data = fixture(['2026-09-01'])
  target(data, 1, 'b').actual_date = '2026-09-10'
  const summary = calculate(data).get('order-1')!
  assert.equal(matchesApplicationDate(summary, '2026-09-01', '2026-09-01'), true)
  assert.equal(matchesApplicationDate(summary, '2026-09-10', ''), true)
  assert.equal(matchesApplicationDate(summary, '', '2026-09-01'), true)
  assert.equal(matchesApplicationDate(summary, '2026-09-02', '2026-09-09'), false)
  assert.equal(matchesApplicationDate(summary, '2026-09-10', '2026-09-01'), false)
  assert.equal(matchesApplicationDate(summary, '2026-12-31', '2026-12-31'), false)
})

test('sin rango mantiene pendientes/canceladas; con rango exige realización válida', () => {
  const data = fixture([null, '2026-09-01'])
  data.applicationTargets.filter(item => item.order_id === 'order-2').forEach(item => { item.status = 'cancelled' })
  for (const summary of calculate(data).values()) {
    assert.equal(matchesApplicationDate(summary, '', ''), true)
    assert.equal(matchesApplicationDate(summary, '2026-01-01', '2026-12-31'), false)
  }
  assert.equal(matchesApplicationDate(undefined, '2026-01-01', ''), false)
})

test('anterior pendiente se conserva como referencia aunque exista una aplicada más antigua', () => {
  const data = fixture(['2026-09-01', null, '2026-09-10'])
  const missing = interval(data, 3)
  assert.equal(missing.kind, 'missing-date')
  assert.deepEqual('previous' in missing && missing.previous, { id: 'order-2', folio: 'APL-2', actual_date: null })
  assert.equal(interval(data, 2).kind, 'missing-date')
})

test('detalle alfabético natural sin mutar los destinos', () => {
  const data = fixture(['2026-09-01'])
  target(data, 1).lot_name = 'Malla 10'; target(data, 1, 'b').lot_name = 'malla 2'
  const before = structuredClone(data.applicationTargets)
  assert.deepEqual(calculate(data).get('order-1')!.entries.map(entry => entry.target.lot_name), ['malla 2', 'Malla 10'])
  assert.deepEqual(data.applicationTargets, before)
})
