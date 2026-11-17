import test from 'node:test'
import assert from 'node:assert/strict'
import { createDemoData, DEMO_ADMIN_ID, DEMO_READER_ID } from '../src/domain/demo'
import { applyCommand, scopeWorkspace } from '../src/domain/rules'
import { classificationIds, classificationLabel, validateIngredientSynonyms } from '../src/domain/catalog-metadata'
import { validateCatalogEdit } from '../src/domain/catalogs'

function fixture() {
  const data = createDemoData()
  data.catalogs.ingredient_classifications = [{ id: 'c1', name: 'Insecticida', active: true }, { id: 'c2', name: 'Acaricida', active: true }]
  for (const kind of ['products', 'active_ingredients'] as const) for (const item of data.catalogs[kind]) { item.classification_id = null; item.classification_ids = [] }
  return { data, admin: data.profiles.find(item => item.id === DEMO_ADMIN_ID)!, reader: data.profiles.find(item => item.id === DEMO_READER_ID)! }
}
test('varias clasificaciones y principal opcional en ambos catálogos, sin herencia', () => {
  const { data, admin } = fixture()
  let next = data
  for (const kind of ['active_ingredients', 'products'] as const) {
    const row = data.catalogs[kind][0]
    next = applyCommand(next, { type: 'save_catalog', kind, record: { ...row, classification_ids: ['c1', 'c2'], classification_id: 'c2' } }, admin)
    assert.match(classificationLabel(next.catalogs[kind][0], data.catalogs.ingredient_classifications), /Acaricida \(principal\)/)
    next = applyCommand(next, { type: 'save_catalog', kind, record: { ...next.catalogs[kind][0], classification_id: null } }, admin)
    assert.deepEqual(next.catalogs[kind][0].classification_ids, ['c1', 'c2'])
  }
  assert.deepEqual(next.applicationOrders, data.applicationOrders)
  assert.deepEqual(next.applicationChanges, data.applicationChanges)
  assert.equal(next.catalogMetadataChanges?.length, 4)
  assert.equal(next.catalogMetadataChanges?.[0].after?.classifications[0].name, 'Insecticida')
  assert.deepEqual(scopeWorkspace(next, fixture().reader).catalogMetadataChanges, [])
})
test('principal fuera de selección, duplicados e inactivos nuevos rechazados', () => {
  const { data } = fixture(), row = data.catalogs.active_ingredients[0]
  assert.ok(validateCatalogEdit(data, 'active_ingredients', { ...row, classification_ids: ['c1'], classification_id: 'c2' }).classification_id)
  assert.ok(validateCatalogEdit(data, 'active_ingredients', { ...row, classification_ids: ['c1', 'c1'], classification_id: null }).classification_ids)
  data.catalogs.ingredient_classifications[1].active = false
  assert.ok(validateCatalogEdit(data, 'active_ingredients', { ...row, classification_ids: ['c2'], classification_id: null }).classification_ids)
  row.classification_ids = ['c2']; row.classification_id = null
  assert.deepEqual(validateCatalogEdit(data, 'active_ingredients', { ...row, classification_id: 'c2' }), {})
})
test('clasificación secundaria protege eliminación y principal anterior sigue disponible', () => {
  const { data, admin } = fixture()
  data.catalogs.products[0].classification_ids = ['c2']
  assert.throws(() => applyCommand(data, { type: 'delete_catalog', kind: 'ingredient_classifications', id: 'c2' }, admin), /relacionado/)
  assert.deepEqual(classificationIds({ classification_id: 'c1' }), ['c1'])
})
test('sinónimos de ingredientes: normalización, conflictos y ámbitos independientes', () => {
  const { data, admin, reader } = fixture(), row = data.catalogs.active_ingredients[0]
  const next = applyCommand(data, { type: 'save_catalog', kind: 'active_ingredients', record: { ...row, synonyms: ['Alias ficticio'] } }, admin)
  assert.deepEqual(next.catalogs.active_ingredients[0].synonyms, ['Alias ficticio'])
  assert.ok(validateIngredientSynonyms(next.catalogs.active_ingredients, { ...row, synonyms: ['Otro', 'Ót-ro'] }).synonyms)
  assert.ok(validateIngredientSynonyms(next.catalogs.active_ingredients, { ...row, synonyms: [row.name] }).synonyms)
  const other = { id: 'other', name: 'Otro ingrediente', active: false, synonyms: ['Reservado'] }
  assert.ok(validateIngredientSynonyms([other], { ...row, synonyms: ['reser-vádo'] }).synonyms)
  assert.ok(validateIngredientSynonyms([other], { ...row, name: 'Reservado', synonyms: [] }).name)
  assert.deepEqual(validateIngredientSynonyms([other], { ...row, synonyms: ['Reservados'] }), {})
  assert.throws(() => applyCommand(data, { type: 'save_catalog', kind: 'active_ingredients', record: { ...row, synonyms: ['No'] } }, reader), /consulta/)
  assert.equal(next.catalogMetadataChanges?.[0].after?.synonyms[0], 'Alias ficticio')
})
