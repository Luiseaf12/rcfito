import assert from 'node:assert/strict'
import test from 'node:test'
import { matchImportedProducts, resolveImportContext, validateExtractedApplication, type ExtractedApplication } from '../src/domain/application-import.ts'
import { emptyWorkspace, type ApplicationOrder, type ApplicationTarget, type CatalogRecord, type WorkspaceData } from '../src/domain/model.ts'

// Fictitious fixtures in memory. No operational data, browser or external calls.
const extracted = (overrides: Partial<ExtractedApplication> = {}) => validateExtractedApplication({
  agricultural_unit: 'Agrícola de ejemplo', destinations: ['Malla 5', 'Malla 6'], application_number: 9,
  crop: null, field: null, method: null, indicated_date: null, scheduled_date: null,
  water_l_ha: 660, note: '', products: [{ name: 'Producto Ácido A', dose: 333, unit: 'ml' }], ...overrides,
})
const products: CatalogRecord[] = [
  { id: 'liquid-a', name: 'Producto Ácido A', code: 'DEMO-A', unit: 'ml', default_dose: 900, active: true },
  { id: 'solid-b', name: 'Producto sólido B', code: 'DEMO-B', unit: 'g', default_dose: 400, active: true },
  { id: 'inactive', name: 'Producto retirado', unit: 'ml', active: false },
]

function fixture() {
  const data = emptyWorkspace()
  data.catalogs.agricultural_units = [{ id: 'agri', name: 'Agrícola de ejemplo', code: 'DEM', active: true }]
  data.catalogs.fields = [
    { id: 'field-a', name: 'Campo de ejemplo A', agricultural_unit_id: 'agri', active: true },
    { id: 'field-b', name: 'Campo de ejemplo B', agricultural_unit_id: 'agri', active: true },
  ]
  data.catalogs.crops = [{ id: 'crop-a', name: 'Cultivo de ejemplo A', code: 'CA', active: true }, { id: 'crop-b', name: 'Cultivo de ejemplo B', active: true }]
  data.catalogs.application_methods = [{ id: 'method-a', name: 'Medio de ejemplo A', active: true }]
  data.catalogs.products = structuredClone(products)
  data.projects = [{ id: 'project', agricultural_unit_id: 'agri', name: 'Temporada ficticia', season: '2026', status: 'active' }]
  data.lots = [5, 6].map(number => ({ id: `lot-${number}`, project_id: 'project', field_id: 'field-a', name: `Malla ${number}`, code: `M${number}`, area_ha: 1, infrastructure_type_id: 'infra', active: true }))
  data.subdivisions = [5, 6].map(number => ({ id: `sub-${number}`, lot_id: `lot-${number}`, name: 'Completa', area_ha: 1, active: true }))
  data.stages = [5, 6].map(number => ({ id: `stage-${number}`, subdivision_id: `sub-${number}`, stage_number: 2, crop_id: 'crop-a', variety_id: 'variety', area_ha: 1, planned_sowing_date: '2026-10-01', actual_sowing_date: '2026-10-02', closed_at: null, status: 'planted' }))
  return data
}

function history(data: WorkspaceData, stageId: string, number: number, cropId = 'crop-a', overrides: Partial<ApplicationTarget> = {}) {
  const id = `order-${stageId}-${number}`
  const stage = data.stages.find(row => row.id === stageId)!
  const order: ApplicationOrder = { id, folio: `APL-${number}`, project_id: 'project', field_id: 'field-a', crop_id: cropId, method_id: 'method-a', indicated_date: '2026-10-05', scheduled_date: '2026-10-06', water_l_ha: 100, observations: '', products: [] }
  const target: ApplicationTarget & { application_number?: number } = {
    id: `target-${id}`, order_id: id, stage_id: stageId, application_number: number, status: 'performed', lot_name: '', subdivision_name: '', stage_number: stage.stage_number,
    crop_name: '', variety_name: '', area_ha: 1, actual_date: '2026-10-06', actual_water_l_ha: 100, actual_products: [], equipment: '', applicator: '', actual_observations: '', cancellation_reason: '', has_changes: false, ...overrides,
  }
  data.applicationOrders.push(order)
  data.applicationTargets.push(target)
  return { order, target }
}

test('valida faltantes sin inventar datos y conserva literalmente la nota multilínea', () => {
  const note = '  Texto de ejemplo\nSegunda línea\n'
  const value = validateExtractedApplication({ note })
  assert.equal(value.note, note)
  assert.equal(value.agricultural_unit, null)
  assert.equal(value.application_number, null)
  assert.equal(value.water_l_ha, null)
  assert.deepEqual(value.products, [])
  assert.deepEqual(value.destinations, [])
  assert.equal(validateExtractedApplication({ crop: '  Cultivo A  ' }).crop, 'Cultivo A')
})

test('la frontera rechaza datos incorrectos, precisión no soportada y unidades sin normalizar', () => {
  const invalid = [null, [], { extra: 'campo inventado' }, { application_number: '9na' }, { application_number: 0 }, { application_number: 1.5 }, { application_number: 2_147_483_648 },
    { water_l_ha: 0 }, { water_l_ha: 660.00001 }, { water_l_ha: 100_000_000 }, { indicated_date: '2026-02-30' }, { scheduled_date: '31/10/2026' },
    { note: 'x'.repeat(4001) }, { note: 'x\u0000y' }, { destinations: ['Malla 5', 'malla 5'] }, { destinations: [null] },
    { products: [{ name: 'A', dose: '333', unit: 'ml' }] }, { products: [{ name: 'A', dose: -1, unit: 'g' }] },
    { products: [{ name: 'A', dose: 1.0000001, unit: 'g' }] }, { products: [{ name: 'A', dose: 333, unit: 'cc' }] },
    { products: [{ name: 'A', dose: 1.5, unit: 'L' }] }, { products: [{ name: '', dose: 1, unit: 'g' }] },
    { products: Array.from({ length: 41 }, () => ({ name: 'A', dose: 1, unit: 'g' })) },
  ]
  for (const value of invalid) assert.throws(() => validateExtractedApplication(value), /interpretación|valor/i)
  assert.equal(extracted({ indicated_date: '2028-02-29' }).indicated_date, '2028-02-29')
})

test('coincidencia única trae código/ID y conserva la dosis del mensaje frente a la predeterminada', () => {
  const matches = matchImportedProducts([{ name: '  PRODUCTO   ACIDO A ', dose: 333, unit: 'ml' }], products)
  assert.equal(matches[0].productId, 'liquid-a')
  assert.equal(matches[0].candidates[0].code, 'DEMO-A')
  assert.equal(matches[0].dose, '333')
  assert.equal(matches[0].unit, 'ml')
  assert.equal(matches[0].sourceName, '  PRODUCTO   ACIDO A ')
  assert.equal(matches[0].issue, '')
  assert.equal(products[0].default_dose, 900)
})

test('unidad incompatible conserva referencia pero exige revisión y no convierte masa a volumen', () => {
  const match = matchImportedProducts([{ name: 'Producto Ácido A', dose: 333, unit: 'g' }], products)[0]
  assert.equal(match.productId, 'liquid-a')
  assert.equal(match.unit, 'g')
  assert.equal(match.dose, '333')
  assert.match(match.issue, /mensaje usa g\/ha.*catálogo ml\/ha/)
})

test('nombres ambiguos, inactivos o aproximados requieren selección explícita', () => {
  const duplicate = matchImportedProducts([{ name: 'producto acido a', dose: 1, unit: 'ml' }], [...products, { ...products[0], id: 'duplicate' }])[0]
  assert.equal(duplicate.productId, '')
  assert.equal(duplicate.candidates.length, 2)
  assert.match(duplicate.issue, /varias coincidencias/)
  const inactive = matchImportedProducts([{ name: 'Producto retirado', dose: 1, unit: 'ml' }], products)[0]
  assert.equal(inactive.productId, '')
  assert.match(inactive.issue, /activo/)
  const approximate = matchImportedProducts([{ name: 'Acido A', dose: 1, unit: 'ml' }], products)[0]
  assert.equal(approximate.productId, '')
  assert.equal(approximate.candidates[0].id, 'liquid-a')
  assert.match(matchImportedProducts([{ name: products[0].name, dose: null, unit: 'ml' }], products)[0].issue, /dosis/)
  assert.match(matchImportedProducts([{ name: products[0].name, dose: 1, unit: null }], products)[0].issue, /unidad/)
})

test('resuelve agrícola, temporada activa, campo, medio y destinos únicos por nombre o código', () => {
  const data = fixture()
  const before = structuredClone(data)
  const context = resolveImportContext(data, extracted({ agricultural_unit: 'DEM', crop: 'CA', method: 'Medio de ejemplo A', destinations: ['Mallas 05', 'M6'] }))
  assert.equal(context.agriculturalUnitId, 'agri')
  assert.equal(context.projectId, 'project')
  assert.equal(context.fieldId, 'field-a')
  assert.equal(context.cropId, 'crop-a')
  assert.equal(context.methodId, 'method-a')
  assert.deepEqual(context.selectedStageIds, ['stage-5', 'stage-6'])
  assert.deepEqual(context.unresolvedDestinations, [])
  assert.deepEqual(data, before)
})

test('sin cultivo e historial de las mismas etapas mantiene el selector pendiente', () => {
  const context = resolveImportContext(fixture(), extracted())
  assert.equal(context.cropId, '')
  assert.equal(context.suggestedCropId, '')
  assert.match(context.cropSuggestionReason, /Falta una aplicación anterior/)
  assert.equal(context.candidateDestinations.length, 2)
})

test('sugiere cultivo desde la aplicación anterior de cada etapa vigente', () => {
  const data = fixture()
  history(data, 'stage-5', 8)
  history(data, 'stage-6', 8)
  const context = resolveImportContext(data, extracted())
  assert.equal(context.suggestedCropId, 'crop-a')
  assert.equal(context.cropId, 'crop-a')
  assert.match(context.cropSuggestionReason, /mismas etapas/)
  assert.deepEqual(context.selectedStageIds, ['stage-5', 'stage-6'])
})

test('para importar una aplicación anterior ignora números posteriores de la misma etapa', () => {
  const data = fixture()
  for (const stage of ['stage-5', 'stage-6']) {
    history(data, stage, 8)
    history(data, stage, 10, 'crop-b')
  }
  assert.equal(resolveImportContext(data, extracted({ application_number: 9 })).cropId, 'crop-a')
})

test('no reutiliza el cultivo de otra etapa de la misma subdivisión', () => {
  const data = fixture()
  data.stages.push({ ...data.stages[0], id: 'stage-old', stage_number: 1, status: 'closed', closed_at: '2026-09-01' })
  history(data, 'stage-old', 8)
  history(data, 'stage-6', 8)
  const context = resolveImportContext(data, extracted())
  assert.equal(context.cropId, '')
  assert.equal(context.suggestedCropId, '')
  assert.match(context.cropSuggestionReason, /Falta una aplicación anterior/)
})

test('historial incompatible con el cultivo vigente se señala sin cambiar la etapa', () => {
  const data = fixture()
  history(data, 'stage-5', 7)
  history(data, 'stage-5', 8, 'crop-b')
  history(data, 'stage-6', 8)
  const context = resolveImportContext(data, extracted())
  assert.equal(context.cropId, '')
  assert.equal(context.suggestedCropId, '')
  assert.match(context.cropSuggestionReason, /historial y las siembras/)
  assert.equal(data.stages[0].crop_id, 'crop-a')
})

test('una malla con varias subdivisiones exige elegir los destinos sin omisiones silenciosas', () => {
  const data = fixture()
  data.subdivisions.push({ id: 'sub-5-b', lot_id: 'lot-5', name: 'Segunda', area_ha: 0.5, active: true })
  data.stages.push({ ...data.stages[0], id: 'stage-5-b', subdivision_id: 'sub-5-b', area_ha: 0.5 })
  const context = resolveImportContext(data, extracted({ crop: 'CA' }))
  assert.deepEqual(context.unresolvedDestinations, ['Malla 5'])
  assert.deepEqual(context.selectedStageIds, ['stage-6'])
  assert.equal(context.candidateDestinations.length, 3)
  assert.ok(context.warnings.some(warning => warning.includes('varias siembras')))
  const explicit = resolveImportContext(data, extracted({ crop: 'CA', destinations: ['Malla 5 Segunda'] }))
  assert.deepEqual(explicit.selectedStageIds, ['stage-5-b'])
})

test('etapas planeadas, cerradas y lotes o subdivisiones inactivos quedan fuera de selección', () => {
  for (const makeUnavailable of [
    (data: WorkspaceData) => { data.stages[0].status = 'planned' },
    (data: WorkspaceData) => { data.stages[0].status = 'closed' },
    (data: WorkspaceData) => { data.lots[0].active = false },
    (data: WorkspaceData) => { data.subdivisions[0].active = false },
  ]) {
    const data = fixture()
    makeUnavailable(data)
    const context = resolveImportContext(data, extracted({ crop: 'CA' }))
    assert.deepEqual(context.selectedStageIds, ['stage-6'])
    assert.deepEqual(context.unresolvedDestinations, ['Malla 5'])
  }
})

test('campos o cultivos distintos bloquean selección automática conjunta', () => {
  const differentFields = fixture()
  differentFields.lots[1].field_id = 'field-b'
  const context = resolveImportContext(differentFields, extracted({ crop: 'CA' }))
  assert.equal(context.fieldId, '')
  assert.deepEqual(context.selectedStageIds, [])
  assert.ok(context.warnings.some(warning => warning.includes('distintos campos')))
  const differentCrops = fixture()
  differentCrops.stages[1].crop_id = 'crop-b'
  history(differentCrops, 'stage-5', 8)
  history(differentCrops, 'stage-6', 8, 'crop-b')
  const mixed = resolveImportContext(differentCrops, extracted())
  assert.equal(mixed.cropId, '')
  assert.deepEqual(mixed.selectedStageIds, [])
})

test('los selectores explícitos filtran las coincidencias y no retienen destinos incompatibles', () => {
  const data = fixture()
  const context = resolveImportContext(data, extracted({ crop: 'CA' }), { agriculturalUnitId: 'agri', projectId: 'project', fieldId: 'field-b', cropId: 'crop-a' })
  assert.deepEqual(context.selectedStageIds, [])
  assert.deepEqual(context.unresolvedDestinations, ['Malla 5', 'Malla 6'])
  assert.equal(context.candidateDestinations.length, 0)
  const reset = resolveImportContext(data, extracted({ crop: 'CA' }), { fieldId: '' })
  assert.equal(reset.fieldId, '', 'una selección vacía explícita no se vuelve a inferir')
})
