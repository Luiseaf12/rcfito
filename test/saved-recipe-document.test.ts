import assert from 'node:assert/strict'
import test from 'node:test'
import { createDemoData, DEMO_ADMIN_ID } from '../src/domain/demo.ts'
import { applyCommand } from '../src/domain/rules.ts'
import { snapshotSavedRecipe, savedRecipeReference } from '../src/domain/saved-recipe-document.ts'
import { currentOrderIndication } from '../src/domain/application-editing.ts'

function fixture() {
  let data = createDemoData()
  const admin = data.profiles.find(item => item.id === DEMO_ADMIN_ID)!
  Object.assign(data.stages.find(item => item.id === 'stage-2')!, { crop_id: 'crop-pepino', variety_id: 'var-pepino-persian', crop_name_snapshot: 'Pepino', variety_name_snapshot: 'Persa', actual_sowing_date: '2026-10-03', status: 'planted' })
  data = applyCommand(data, { type: 'create_application_order', record: { id: 'saved-qa', project_id: 'project-ensenada', field_id: 'field-norte', crop_id: 'crop-pepino', method_id: 'method-dron', indicated_date: '2026-10-09', scheduled_date: '2026-10-10', water_l_ha: 100, observations: 'Nota original ficticia', stage_ids: ['stage-1', 'stage-2'], products: [{ product_id: 'product-a', dose: 10 }] } }, admin)
  const targets = data.applicationTargets.filter(item => item.order_id === 'saved-qa')
  data = applyCommand(data, { type: 'perform_application_targets', order_id: 'saved-qa', target_ids: [targets[0].id], data: { actual_date: '2026-10-10', equipment: 'Equipo QA', applicator: 'Persona QA', observations: 'Nota real que no debe exportarse', changed: true, water_l_ha: 999, products: [{ product_id: 'product-b', dose: 900 }] } }, admin)
  data = applyCommand(data, { type: 'revise_application_order', record: { id: 'revision-qa', order_id: 'saved-qa', expected_revision: 0, target_ids: [targets[1].id], method_id: 'method-dron', indicated_date: '2026-10-11', scheduled_date: '2026-10-12', water_l_ha: 120.1234, observations: 'Última nota indicada ficticia', reason: 'Revisión QA', products: [{ product_id: 'product-a', dose: .123456 }] } }, admin)
  return { data, admin }
}
const time = '2026-11-02T21:00:00Z'

test('exporta exclusivamente la última indicación con destinos y revisiones guardados sin mutaciones', () => {
  const { data, admin } = fixture(), before = structuredClone(data)
  const saved = snapshotSavedRecipe(data, admin, 'saved-qa', time)
  const latest = currentOrderIndication(data, data.applicationOrders[0])
  assert.equal(saved.revision, 1)
  assert.equal(saved.water_l_ha, 120.1234)
  assert.equal(saved.products[0].dose, .123456)
  assert.deepEqual(saved.products, latest.products)
  assert.equal(saved.observations, latest.observations)
  assert.deepEqual(saved.targets.map(item => [item.status, item.indication_revision]), [['performed', 0], ['indicated', 1]])
  assert.ok(saved.targets.every(item => item.application_number === 1))
  assert.ok(!JSON.stringify(saved).includes('Nota real que no debe exportarse'))
  assert.ok(!('actual_products' in saved) && !('total_water' in saved))
  assert.deepEqual(data, before)
  data.applicationChanges[0].after.products[0].dose = 20
  assert.equal(saved.products[0].dose, .123456)
})

test('conserva snapshots históricos aunque se cierren proyecto y etapas o cambie el catálogo', () => {
  const { data, admin } = fixture()
  const original = snapshotSavedRecipe(data, admin, 'saved-qa', time)
  data.projects[0].status = 'closed'
  data.stages.forEach(item => { item.status = 'closed'; item.variety_name_snapshot = 'Nueva variedad' })
  data.lots.forEach(item => { item.name = 'Lote renombrado'; item.active = false })
  data.subdivisions.forEach(item => { item.name = 'Subdivisión renombrada'; item.active = false })
  data.catalogs.products.forEach(item => { item.name = 'Producto renombrado'; item.unit = 'g'; item.active = false })
  const saved = snapshotSavedRecipe(data, admin, 'saved-qa', time)
  assert.deepEqual(saved.products, original.products)
  assert.deepEqual(saved.targets, original.targets)
  assert.equal(saved.products[0].unit, 'ml')
})

test('el lector asignado puede exportar; otra agrícola y órdenes ausentes se rechazan', () => {
  const { data } = fixture()
  const reader = { id: 'reader-pdf', full_name: 'Consulta QA', role: 'reader' as const }
  assert.throws(() => snapshotSavedRecipe(data, reader, 'saved-qa', time), /no está disponible/)
  data.assignments.push({ user_id: reader.id, agricultural_unit_id: data.projects.find(item => item.id === 'project-ensenada')!.agricultural_unit_id })
  assert.equal(snapshotSavedRecipe(data, reader, 'saved-qa', time).exported_by, reader.full_name)
  assert.throws(() => snapshotSavedRecipe(data, reader, 'missing', time), /no está disponible/)
})

test('historial incompleto y destinos ausentes bloquean una copia engañosa', () => {
  const { data, admin } = fixture()
  data.applicationChanges = []
  assert.throws(() => snapshotSavedRecipe(data, admin, 'saved-qa', time), /historial/)
  const clean = fixture()
  clean.data.applicationTargets = []
  assert.throws(() => snapshotSavedRecipe(clean.data, clean.admin, 'saved-qa', time), /destinos guardados/)
})

test('la referencia de copia es estable al reexportar y cambia al cambiar revisión o seguimiento', async () => {
  const { data, admin } = fixture()
  const saved = snapshotSavedRecipe(data, admin, 'saved-qa', time)
  const first = await savedRecipeReference(saved)
  assert.equal((await savedRecipeReference({ ...saved, generated_at: '2026-11-02T22:00:00Z' })).reference, first.reference)
  assert.notEqual((await savedRecipeReference({ ...saved, revision: 2 })).reference, first.reference)
  const changed = structuredClone(saved); changed.targets[1].status = 'cancelled'
  assert.notEqual((await savedRecipeReference(changed)).reference, first.reference)
})
