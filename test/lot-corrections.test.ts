import assert from 'node:assert/strict'
import test from 'node:test'
import { createDemoData, DEMO_ADMIN_ID, DEMO_READER_ID } from '../src/domain/demo.ts'
import { applyCommand, scopeWorkspace } from '../src/domain/rules.ts'
import { lotCorrectionContext, reconcileLotCorrections } from '../src/domain/lot-corrections.ts'
import { buildProductUsage } from '../src/domain/product-usage.ts'
import { snapshotSavedRecipe, savedRecipeReference } from '../src/domain/saved-recipe-document.ts'
import type { LotCorrectionInput, WorkspaceData } from '../src/domain/model.ts'

function fixture() {
  let data = createDemoData()
  const admin = data.profiles.find(row => row.id === DEMO_ADMIN_ID)!
  const stage = data.stages.find(row => row.id === 'stage-1')!
  stage.stage_number = 2
  data.stages.push({ ...stage, id: 'previous-stage', stage_number: 1, status: 'closed', planned_sowing_date: '2026-09-01', actual_sowing_date: '2026-09-03', closed_at: '2026-10-01' })
  for (let index = 0; index < 3; index++) {
    data = applyCommand(data, { type: 'create_application_order', record: { id: `order-${index}`, project_id: 'project-ensenada', field_id: 'field-norte', crop_id: 'crop-pepino', method_id: 'method-dron', indicated_date: '2026-10-10', scheduled_date: '2026-10-11', water_l_ha: 120, observations: 'Receta ficticia', stage_ids: ['stage-1'], products: [{ product_id: 'product-a', dose: 250 }] } }, admin)
  }
  const performed = data.applicationTargets.find(row => row.order_id === 'order-1')!
  data = applyCommand(data, { type: 'perform_application_targets', order_id: 'order-1', target_ids: [performed.id], data: { actual_date: '2026-10-11', equipment: 'Equipo ficticio', applicator: '', observations: '', changed: false } }, admin)
  data = applyCommand(data, { type: 'cancel_application_targets', order_id: 'order-2', target_ids: [data.applicationTargets.find(row => row.order_id === 'order-2')!.id], reason: 'Cancelación ficticia' }, admin)
  const input: LotCorrectionInput = { id: 'change-1', lot_id: 'lot-1', expected_version: 0, name: 'Malla corregida', area_ha: 10, stage_id: 'stage-1', planned_sowing_date: '2026-10-01', actual_sowing_date: '2026-10-02', reason: 'Corrección ficticia' }
  return { data, admin, input }
}

test('corrige malla/siembra vigente y todas sus recetas sin cambiar identidades, estados ni mezclas', () => {
  const { data, admin, input } = fixture()
  const before = structuredClone(data)
  const result = applyCommand(data, { type: 'correct_lot', record: input }, admin)
  const context = lotCorrectionContext(result, 'lot-1')
  assert.equal(context.lot.name, 'Malla corregida')
  assert.equal(context.lot.area_ha, 10)
  assert.equal(context.lot.correction_version, 1)
  assert.equal(context.subdivisions[0].area_ha, 10)
  assert.equal(context.current[0].area_ha, 10)
  assert.equal(context.current[0].actual_sowing_date, '2026-10-02')
  assert.deepEqual(result.stages.find(row => row.id === 'previous-stage'), before.stages.find(row => row.id === 'previous-stage'))
  assert.deepEqual(result.applicationOrders, before.applicationOrders)
  assert.deepEqual(result.applicationChanges, before.applicationChanges)
  assert.equal(context.targets.length, 3)
  assert.deepEqual(new Set(context.targets.map(row => row.status)), new Set(['indicated', 'performed', 'cancelled']))
  for (const target of context.targets) {
    assert.equal(target.area_ha, 10)
    assert.equal(target.area_correction_id, input.id)
    const { area_ha: _area, area_correction_id: _change, ...rest } = target
    const { area_ha: _beforeArea, ...original } = before.applicationTargets.find(row => row.id === target.id)!
    assert.deepEqual(rest, original)
  }
  assert.equal(buildProductUsage(before).liquidMl, 9000)
  assert.equal(buildProductUsage(result).liquidMl, 7500)
  const event = result.lotCorrections![0]
  assert.equal(event.before.lot.area_ha, 12)
  assert.equal(event.before.targets[0].area_ha, 12)
  assert.equal(event.after.targets[0].area_ha, 10)
  assert.equal(event.changed_by, admin.id)
  assert.equal(event.reason, input.reason)
  reconcileLotCorrections(result)
  assert.deepEqual(data, before, 'el workspace de entrada no se muta')
})

test('PDF guardado y recetas nuevas usan superficie corregida; referencia y originales quedan distinguibles', async () => {
  const { data, admin, input } = fixture()
  const original = snapshotSavedRecipe(data, admin, 'order-1', '2026-11-04T18:00:00Z')
  let result = applyCommand(data, { type: 'correct_lot', record: input }, admin)
  const corrected = snapshotSavedRecipe(result, admin, 'order-1', '2026-11-04T18:00:00Z')
  assert.equal(original.targets[0].area_ha, 12)
  assert.equal(corrected.targets[0].area_ha, 10)
  assert.equal(corrected.targets[0].area_correction?.previous_area_ha, 12)
  assert.equal(corrected.targets[0].area_correction?.version, 1)
  assert.deepEqual(corrected.products, original.products)
  assert.notEqual((await savedRecipeReference(corrected)).reference, (await savedRecipeReference(original)).reference)
  const order = data.applicationOrders[0]
  result = applyCommand(result, { type: 'create_application_order', record: { ...order, id: 'new-order', stage_ids: ['stage-1'] } }, admin)
  const target = result.applicationTargets.find(row => row.order_id === 'new-order')!
  assert.equal(target.area_ha, 10)
  assert.equal(target.lot_name, 'Malla corregida')
  assert.equal(data.applicationTargets[0].lot_name, 'Lote 01')
})

test('reintento es idempotente y versión esperada evita perder correcciones concurrentes', () => {
  const { data, admin, input } = fixture()
  const result = applyCommand(data, { type: 'correct_lot', record: input }, admin)
  const reordered = Object.fromEntries(Object.entries(input).reverse()) as LotCorrectionInput
  assert.deepEqual(applyCommand(result, { type: 'correct_lot', record: reordered }, admin), result)
  assert.throws(() => applyCommand(result, { type: 'correct_lot', record: { ...input, name: 'Otra' } }, admin), /identificador/)
  assert.throws(() => applyCommand(result, { type: 'correct_lot', record: { ...input, id: 'change-2' } }, admin), /cambió/)
  const renamed = applyCommand(result, { type: 'correct_lot', record: { id: 'change-2', lot_id: input.lot_id, expected_version: 1, name: 'Nombre nuevo', reason: 'Solo nombre' } }, admin)
  assert.deepEqual(renamed.applicationTargets, result.applicationTargets)
  assert.equal(renamed.lotCorrections![1].before.targets.length, 0)
  reconcileLotCorrections(renamed)
})

test('fechas incompatibles, superficies inválidas y etapa cerrada/ajena no alteran la captura', () => {
  const { data, admin, input } = fixture()
  const before = structuredClone(data)
  const invalid: [Partial<LotCorrectionInput>, RegExp][] = [
    [{ actual_sowing_date: '2026-10-12' }, /aplicación/],
    [{ actual_sowing_date: '2026-09-30' }, /cierre/],
    [{ planned_sowing_date: '2026-02-30' }, /fechas/],
    [{ area_ha: 0 }, /superficie/],
    [{ area_ha: 10.00001 }, /decimales/],
    [{ stage_id: 'previous-stage' }, /vigente/],
    [{ stage_id: 'stage-history' }, /vigente/],
    [{ name: 'Lote 02' }, /nombre/],
    [{ reason: '' }, /motivo/],
  ]
  for (const [patch, error] of invalid) assert.throws(() => applyCommand(data, { type: 'correct_lot', record: { ...input, ...patch } }, admin), error)
  assert.deepEqual(data, before)
  const missingStage = { ...input }; delete missingStage.stage_id; delete missingStage.actual_sowing_date; delete missingStage.planned_sowing_date
  assert.throws(() => applyCommand(data, { type: 'correct_lot', record: missingStage }, admin), /vigente/)
})

test('no inventa reparto en subdivisiones ni reduce una planeación futura sin corregirla', () => {
  const { data, admin, input } = fixture()
  const split = structuredClone(data)
  split.subdivisions.push({ id: 'retired-subdivision', lot_id: 'lot-1', name: 'Historia de distribución', area_ha: 12, active: false })
  assert.throws(() => applyCommand(split, { type: 'correct_lot', record: input }, admin), /subdivisión única/)
  const planned = { ...data.stages.find(row => row.id === 'stage-1')!, id: 'next-stage', stage_number: 3, status: 'planned' as const, area_ha: 12, actual_sowing_date: null }
  data.stages.push(planned)
  assert.throws(() => applyCommand(data, { type: 'correct_lot', record: input }, admin), /planeada excede/)
})

test('el historial está limitado al ámbito del lector y la copia de distribución inicia sin versiones ajenas', () => {
  const { data, admin, input } = fixture()
  let result = applyCommand(data, { type: 'correct_lot', record: input }, admin)
  result = applyCommand(result, { type: 'correct_lot', record: { id: 'other-change', lot_id: 'lot-3', expected_version: 0, name: 'Otra agrícola', reason: 'Solo nombre' } }, admin)
  const reader = data.profiles.find(row => row.id === DEMO_READER_ID)!
  assert.throws(() => applyCommand(data, { type: 'correct_lot', record: input }, reader), /consulta/)
  assert.equal(scopeWorkspace(result, reader).lotCorrections!.length, 1)
  result.projects.find(row => row.id === 'project-ensenada')!.status = 'closed'
  assert.throws(() => applyCommand(result, { type: 'correct_lot', record: { ...input, id: 'new-change', expected_version: 1 } }, admin), /abierto/)
  const copied = applyCommand(result, { type: 'copy_project', id: 'project-ensenada', name: 'Nuevo proyecto', season: '2027–2028' }, admin)
  const project = copied.projects.find(row => row.name === 'Nuevo proyecto')!
  assert.ok(copied.lots.filter(row => row.project_id === project.id).every(row => row.correction_version === 0))
  assert.equal(copied.lotCorrections!.length, result.lotCorrections!.length)
})

test('lectura REST cruzada con una transacción se detecta antes de mostrar cifras mezcladas', () => {
  const { data, admin, input } = fixture()
  const result = applyCommand(data, { type: 'correct_lot', record: input }, admin)
  const inconsistent = (mutate: (value: WorkspaceData) => void) => { const copy = structuredClone(result); mutate(copy); assert.throws(() => reconcileLotCorrections(copy), /consulta|consult|cambió|cambiaron/) }
  inconsistent(copy => { copy.lotCorrections = [] })
  inconsistent(copy => { copy.lots[0].area_ha = 12 })
  inconsistent(copy => { copy.stages.find(row => row.id === 'stage-1')!.actual_sowing_date = '2026-10-03' })
  inconsistent(copy => { copy.applicationTargets[0].area_ha = 12 })
  inconsistent(copy => { copy.applicationTargets[0].area_correction_id = null })
})

test('corregir superficie sin tocar fechas no exige reescribir una fecha histórica preexistente', () => {
  const { data, admin, input } = fixture()
  data.applicationOrders[0].indicated_date = '2026-10-01'
  const result = applyCommand(data, { type: 'correct_lot', record: { ...input, actual_sowing_date: '2026-10-03' } }, admin)
  assert.equal(result.stages.find(row => row.id === 'stage-1')!.actual_sowing_date, '2026-10-03')
  assert.deepEqual(result.applicationOrders, data.applicationOrders)
  assert.equal(result.applicationTargets[0].area_ha, 10)
})
