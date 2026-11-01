import assert from 'node:assert/strict'
import test from 'node:test'
import { createDemoData, DEMO_ADMIN_ID, DEMO_READER_ID } from '../src/domain/demo.ts'
import { completeCatalogs } from '../src/domain/model.ts'
import { applyCommand } from '../src/domain/rules.ts'
import { catalogRelationOptions, validateCatalogEdit } from '../src/domain/catalogs.ts'

test('demo anterior conserva sus catálogos al añadir el de clasificaciones', () => {
  const { ingredient_classifications: _newCatalog, ...previous } = createDemoData().catalogs
  const upgraded = completeCatalogs(previous)
  assert.deepEqual(upgraded.ingredient_classifications, [])
  assert.deepEqual(upgraded.active_ingredients, previous.active_ingredients)
  assert.deepEqual(upgraded.products, previous.products)
  assert.equal('ingredient_classifications' in previous, false)
})

test('administrador crea clasificación, relaciona ingrediente y puede cambiarla o retirarla sin alterar historial', () => {
  const initial = createDemoData()
  const admin = initial.profiles.find(profile => profile.id === DEMO_ADMIN_ID)!
  let data = applyCommand(initial, { type: 'save_catalog', kind: 'ingredient_classifications', record: { name: 'Uso de prueba', active: true } }, admin)
  const classification = data.catalogs.ingredient_classifications.find(record => record.name === 'Uso de prueba')!
  const ingredient = data.catalogs.active_ingredients[0]
  data = applyCommand(data, { type: 'save_catalog', kind: 'active_ingredients', record: { ...ingredient, classification_id: classification.id } }, admin)
  assert.equal(data.catalogs.active_ingredients[0].classification_id, classification.id)
  assert.throws(() => applyCommand(data, { type: 'delete_catalog', kind: 'ingredient_classifications', id: classification.id }, admin), /relacionado/)
  data = applyCommand(data, { type: 'save_catalog', kind: 'active_ingredients', record: { ...ingredient, classification_id: null } }, admin)
  data = applyCommand(data, { type: 'delete_catalog', kind: 'ingredient_classifications', id: classification.id }, admin)
  assert.ok(!data.catalogs.ingredient_classifications.some(record => record.id === classification.id))
  assert.deepEqual(data.catalogs.products, initial.catalogs.products)
  assert.deepEqual(data.applicationOrders, initial.applicationOrders)
  assert.deepEqual(data.applicationTargets, initial.applicationTargets)
  assert.deepEqual(data.applicationChanges, initial.applicationChanges)
  assert.deepEqual(data.stages, initial.stages)
})

test('clasificación inactiva se conserva pero no se ofrece ni admite en relaciones nuevas', () => {
  const data = createDemoData()
  const classification = data.catalogs.ingredient_classifications[0]
  classification.active = false
  const ingredient = data.catalogs.active_ingredients[0]
  assert.deepEqual(validateCatalogEdit(data, 'active_ingredients', { ...ingredient, name: 'Ingrediente corregido' }), {})
  const another = data.catalogs.active_ingredients[1]
  assert.ok(validateCatalogEdit(data, 'active_ingredients', { ...another, classification_id: classification.id }).classification_id)
  assert.ok(validateCatalogEdit(data, 'active_ingredients', { ...another, classification_id: 'no-existe' }).classification_id)
  assert.equal(catalogRelationOptions(data.catalogs.ingredient_classifications).length, 0)
  assert.equal(catalogRelationOptions(data.catalogs.ingredient_classifications, [classification.id]).length, 1)
  assert.deepEqual(validateCatalogEdit(data, 'active_ingredients', { ...ingredient, classification_id: null }), {})
})

test('lector no crea clasificaciones ni modifica relación', () => {
  const data = createDemoData()
  const reader = data.profiles.find(profile => profile.id === DEMO_READER_ID)!
  assert.throws(() => applyCommand(data, { type: 'save_catalog', kind: 'ingredient_classifications', record: { name: 'No permitido', active: true } }, reader), /consulta/)
  assert.throws(() => applyCommand(data, { type: 'save_catalog', kind: 'active_ingredients', record: { ...data.catalogs.active_ingredients[0], classification_id: null } }, reader), /consulta/)
})
