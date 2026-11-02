import assert from 'node:assert/strict'
import test from 'node:test'
import { createDemoData, DEMO_ADMIN_ID } from '../src/domain/demo.ts'
import { applyCommand } from '../src/domain/rules.ts'
import { currentOrderIndication } from '../src/domain/application-editing.ts'
import { recipeCandidates, recipeSource, validateRecipeSource } from '../src/domain/application-recipes.ts'
import { readRecipeSource } from '../src/data/application-group-history.ts'
import type { ApplicationOrderInput } from '../src/domain/model.ts'

function fixture() {
  let data = createDemoData()
  const admin = data.profiles.find(item => item.id === DEMO_ADMIN_ID)!
  const record = (overrides: Partial<ApplicationOrderInput> = {}): ApplicationOrderInput => ({ id: crypto.randomUUID(), project_id: 'project-ensenada', field_id: 'field-norte', crop_id: 'crop-pepino', method_id: 'method-dron', indicated_date: '2026-10-10', scheduled_date: '2026-10-11', water_l_ha: 120, observations: 'Nota ficticia', stage_ids: ['stage-1'], products: [{ product_id: 'product-a', dose: 250 }], ...overrides })
  const create = (input = record()) => { data = applyCommand(data, { type: 'create_application_order', record: input }, admin); return data.applicationOrders.find(item => item.id === input.id)! }
  return { get data() { return data }, admin, record, create, set(value: typeof data) { data = value } }
}

test('base por fecha indicada, sin usar número ni fecha real, con empates explícitos', () => {
  const f = fixture()
  f.create(f.record({ application_number: 90, indicated_date: '2026-10-09' }))
  const a = f.create(), b = f.create()
  assert.deepEqual(recipeCandidates(f.data, ['stage-1']).map(item => item.order_id).sort(), [a.id, b.id].sort())
  assert.deepEqual(recipeCandidates(f.data, ['etapa-nueva']), [])
})

test('excluye canceladas, conserva realizadas y copia indicado sin tomar diferencias reales', () => {
  const f = fixture(), order = f.create()
  const target = f.data.applicationTargets.find(item => item.order_id === order.id)!
  f.set(applyCommand(f.data, { type: 'perform_application_targets', order_id: order.id, target_ids: [target.id], data: { actual_date: '2026-10-12', equipment: '', applicator: '', observations: '', changed: true, water_l_ha: 300, products: [{ product_id: 'product-a', dose: 900 }] } }, f.admin))
  const later = f.create(f.record({ indicated_date: '2026-10-11' }))
  f.set(applyCommand(f.data, { type: 'cancel_application_targets', order_id: later.id, target_ids: f.data.applicationTargets.filter(item => item.order_id === later.id).map(item => item.id), reason: 'Prueba ficticia' }, f.admin))
  assert.equal(recipeCandidates(f.data, ['stage-1'])[0].order_id, order.id)
  assert.equal(currentOrderIndication(f.data, order).products[0].dose, 250)
  assert.equal(currentOrderIndication(f.data, order).water_l_ha, 120)
})

test('grupo usa su emisión explícita aunque exista una individual posterior', () => {
  const f = fixture()
  f.set(applyCommand(f.data, { type: 'save_sowing_group', record: { id: 'group-test', project_id: 'project-ensenada', field_id: 'field-norte', crop_id: 'crop-pepino', name: 'Grupo ficticio', active: true, stage_ids: ['stage-1'] } }, f.admin))
  const grouped = f.create(f.record({ source_group_id: 'group-test' }))
  const individual = f.create(f.record({ indicated_date: '2026-10-11' }))
  assert.equal(recipeCandidates(f.data, ['stage-1'], 'group-test')[0].order_id, grouped.id)
  assert.equal(recipeCandidates(f.data, ['stage-1'])[0].order_id, individual.id)
  assert.deepEqual(recipeCandidates(f.data, ['stage-1'], 'otro-grupo'), [])
})

test('subdivisiones conservan bases distintas aunque tengan fechas diferentes; mezcla nunca se combina', () => {
  const f = fixture()
  f.data.subdivisions.push({ ...f.data.subdivisions[0], id: 'sub-extra' })
  f.data.stages.push({ ...f.data.stages[0], id: 'stage-extra', subdivision_id: 'sub-extra' })
  const a = f.create(), b = f.create(f.record({ stage_ids: ['stage-extra'], indicated_date: '2026-10-11', products: [{ product_id: 'product-b', dose: 10 }] }))
  assert.deepEqual(recipeCandidates(f.data, ['stage-1', 'stage-extra']).map(item => item.order_id), [b.id, a.id])
  f.create(f.record({ stage_ids: ['stage-1', 'stage-extra'], indicated_date: '2026-10-12', scheduled_date: '2026-10-13' }))
  const options = recipeCandidates(f.data, ['stage-1', 'stage-extra'])
  assert.equal(options.length, 1)
  assert.equal(options[0].stage_ids.length, 2)
})

test('copia última revisión y guarda vínculo estable; reintento preserva identidad e historia', () => {
  const f = fixture(), order = f.create()
  f.set(applyCommand(f.data, { type: 'revise_application_order', record: { ...f.record(), id: crypto.randomUUID(), order_id: order.id, expected_revision: 0, target_ids: f.data.applicationTargets.map(item => item.id), water_l_ha: 180, observations: 'Versión revisada ficticia', reason: 'Ajuste ficticio', products: [{ product_id: 'product-a', dose: 300 }] } }, f.admin))
  const candidate = recipeCandidates(f.data, ['stage-1'])[0]
  const base = currentOrderIndication(f.data, f.data.applicationOrders.find(item => item.id === order.id)!)
  assert.equal(base.products[0].dose, 300)
  assert.equal(candidate.revision, 1)
  const input = f.record({ recipe_source: recipeSource(candidate), water_l_ha: base.water_l_ha })
  const before = structuredClone(f.data.applicationChanges)
  const copy = f.create(input)
  assert.deepEqual(copy.recipe_source, { order_id: order.id, revision: 1, stage_id: 'stage-1' })
  assert.deepEqual(f.data.applicationChanges, before)
  assert.equal(f.create(input).id, copy.id)
  assert.equal(f.data.applicationTargets.find(item => item.order_id === copy.id)?.application_number, 2)
  assert.throws(() => f.create({ ...input, recipe_source: { ...input.recipe_source!, revision: 0 } }), /identificador/)
})

test('rechaza bases obsoletas, canceladas o ajenas y nunca elimina la captura original', () => {
  const f = fixture(), order = f.create()
  const input = f.record({ recipe_source: { order_id: order.id, revision: 0, stage_id: 'stage-1' } })
  assert.doesNotThrow(() => validateRecipeSource(f.data, input))
  assert.throws(() => validateRecipeSource(f.data, { ...input, crop_id: 'otro' }), /mismo proyecto/)
  assert.throws(() => validateRecipeSource(f.data, { ...input, recipe_source: { ...input.recipe_source!, revision: 1 } }), /cambió/)
  assert.throws(() => validateRecipeSource(f.data, { ...input, source_group_id: 'otro' }), /lote o grupo/)
  assert.throws(() => validateRecipeSource(f.data, { ...input, recipe_source: { order_id: order.id, revision: 0 } }), /lote o grupo/)
  f.set(applyCommand(f.data, { type: 'cancel_application_targets', order_id: order.id, target_ids: f.data.applicationTargets.map(item => item.id), reason: 'Prueba ficticia' }, f.admin))
  assert.throws(() => f.create(input), /ya no está activa/)
  assert.equal(f.data.applicationOrders.length, 1)
})

test('adaptador recupera referencia persistida y rechaza versión corrupta', () => {
  assert.deepEqual(readRecipeSource({}), { recipe_source: null })
  assert.deepEqual(readRecipeSource({ recipe_source_order_id: 'base', recipe_source_revision: 2, recipe_source_stage_id: 'stage' }), { recipe_source: { order_id: 'base', revision: 2, stage_id: 'stage' } })
  assert.throws(() => readRecipeSource({ recipe_source_order_id: 'base', recipe_source_revision: '2' }), /verificar/)
})
