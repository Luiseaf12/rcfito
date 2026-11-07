import assert from 'node:assert/strict'
import test from 'node:test'
import { createDemoData, DEMO_ADMIN_ID } from '../src/domain/demo.ts'
import { applicationDraftIssues } from '../src/domain/application-draft.ts'
import { draftPdfIssues, draftRecipeReference, snapshotDraftRecipe, type DraftRecipeDocumentInput } from '../src/domain/application-draft-document.ts'
import { applyCommand } from '../src/domain/rules.ts'

function fixture() {
  const data = createDemoData(), admin = data.profiles.find(item => item.id === DEMO_ADMIN_ID)!
  const input: DraftRecipeDocumentInput = {
    id: '11111111-1111-4111-8111-111111111111', profile: admin, generated_at: '2026-11-02T20:30:00Z',
    form: { project_id: 'project-ensenada', field_id: 'field-norte', crop_id: 'crop-pepino', method_id: 'method-dron', indicated_date: '2026-10-10', scheduled_date: '', water_l_ha: '120.1234', observations: 'Revisar el follaje.\nNota ficticia con acentos: áéíóú ñ.', application_number: '' },
    products: [{ product_id: 'product-a', dose: '0.123456' }, { product_id: 'product-b', dose: '9.876543' }], stage_ids: ['stage-1'],
    review: { imported: false, unresolvedDestinations: [], destinationsReviewed: true, numberReviewed: false },
  }
  return { data, input }
}

test('borrador exporta dosis y agua por hectárea, destino completo y fecha pendiente sin crear órdenes ni reservar números', () => {
  const { data, input } = fixture(), before = structuredClone(data)
  const snapshot = snapshotDraftRecipe(data, input)
  assert.equal(snapshot.scheduled_date, '')
  assert.equal(snapshot.products[0].dose, .123456)
  assert.equal(snapshot.products[1].unit, 'g')
  assert.equal(snapshot.products[0].unit, 'ml')
  assert.equal(snapshot.water_l_ha, 120.1234)
  assert.equal(snapshot.targets[0].area_ha, data.stages[0].area_ha)
  assert.equal(snapshot.targets[0].stage_id, 'stage-1')
  assert.equal(snapshot.requested_number, null)
  assert.equal(snapshot.source, null)
  assert.deepEqual(data, before)
  assert.ok(!Object.keys(snapshot).some(key => key.startsWith('total_')))
  input.products[0].dose = '300'
  data.catalogs.products[0].name = 'Cambio posterior'
  assert.equal(snapshot.products[0].dose, .123456)
  assert.notEqual(snapshot.products[0].name, 'Cambio posterior')
})

test('solo se omite la programación vacía para PDF; guardar y fechas inválidas conservan sus bloqueos', () => {
  const { data, input } = fixture()
  const saveIssues = applicationDraftIssues(data, input.form, input.products, input.stage_ids, input.review)
  assert.ok(saveIssues.some(issue => issue.field === 'scheduled_date'))
  assert.equal(draftPdfIssues(input.form, saveIssues).length, 0)
  for (const date of ['2026-10-09', '2026-02-31', ' ']) {
    input.form.scheduled_date = date
    assert.throws(() => snapshotDraftRecipe(data, input), /fecha|Fecha/)
  }
  input.form.scheduled_date = '2026-10-12'
  assert.equal(snapshotDraftRecipe(data, input).scheduled_date, '2026-10-12')
})

test('PDF no admite dosis, unidades, destinos o productos sin revisar aunque sea un borrador', () => {
  const { data, input } = fixture()
  assert.throws(() => snapshotDraftRecipe(data, { ...input, products: [{ product_id: 'product-a', dose: '0' }] }), /mayor que cero/)
  assert.throws(() => snapshotDraftRecipe(data, { ...input, stage_ids: [] }), /etapa sembrada/)
  assert.throws(() => snapshotDraftRecipe(data, { ...input, profile: { ...input.profile, role: 'reader' } }), /administración/)
  assert.throws(() => snapshotDraftRecipe(data, { ...input, products: [{ product_id: 'product-a', dose: '3', sourceName: 'Producto ficticio', importUnit: 'g' }], review: { ...input.review, imported: true } }), /unidad|unidades|ml\/ha/)
  data.catalogs.products.find(item => item.id === 'product-a')!.active = false
  assert.throws(() => snapshotDraftRecipe(data, input), /no está activo/)
})

test('PDF preserva grupo de emisión, copia elegida y controles de versión; no infiere un grupo solo por pertenencia', () => {
  let { data, input } = fixture()
  data = applyCommand(data, { type: 'save_sowing_group', record: { id: 'group-pdf', project_id: input.form.project_id, field_id: input.form.field_id, crop_id: input.form.crop_id, active: true, name: 'Grupo PDF ficticio', stage_ids: input.stage_ids } }, input.profile)
  const record = { ...input.form, scheduled_date: '2026-10-11', id: 'source-pdf', stage_ids: input.stage_ids, water_l_ha: 100, application_number: undefined, source_group_id: 'group-pdf', products: [{ product_id: 'product-a', dose: 10 }] }
  data = applyCommand(data, { type: 'create_application_order', record }, input.profile)
  const before = structuredClone(data)
  const copy = snapshotDraftRecipe(data, { ...input, source_group_id: 'group-pdf', recipe_source: { order_id: 'source-pdf', revision: 0 } })
  assert.equal(copy.selection, 'Grupo: Grupo PDF ficticio')
  assert.equal(copy.source?.folio, data.applicationOrders[0].folio)
  assert.equal(copy.source?.revision, 0)
  assert.equal(snapshotDraftRecipe(data, input).selection, 'Un lote')
  assert.throws(() => snapshotDraftRecipe(data, { ...input, source_group_id: 'group-pdf', recipe_source: { order_id: 'source-pdf', revision: 1 } }), /base cambió/)
  assert.deepEqual(data, before)
})

test('referencia identifica cambios de contenido y mantiene la misma receta entre descargas', async () => {
  const { data, input } = fixture(), snapshot = snapshotDraftRecipe(data, input)
  const first = await draftRecipeReference(snapshot)
  assert.match(first.reference, /^BR-11111111-[A-F0-9]{12}$/)
  assert.equal((await draftRecipeReference({ ...snapshot, generated_at: '2026-11-03T10:00:00Z' })).reference, first.reference)
  assert.notEqual((await draftRecipeReference({ ...snapshot, water_l_ha: 150 })).reference, first.reference)
  assert.notEqual((await draftRecipeReference({ ...snapshot, scheduled_date: '2026-11-03' })).reference, first.reference)
  assert.notEqual((await draftRecipeReference({ ...snapshot, products: [{ ...snapshot.products[0], dose: 2 }] })).reference, first.reference)
})

test('RCF-045: borrador de riego permite agua ausente y no reserva ningún número', () => {
  const {data,input}=fixture(), before=structuredClone(data)
  input.form.method_id='method-riego';input.form.water_l_ha=''
  const snapshot=snapshotDraftRecipe(data,input)
  assert.equal(snapshot.application_route,'irrigation')
  assert.equal(snapshot.water_l_ha,null)
  assert.equal(snapshot.products[0].dose,.123456)
  assert.deepEqual(data,before)
  input.form.method_id='method-dron'
  assert.throws(()=>snapshotDraftRecipe(data,input),/agua/)
})
