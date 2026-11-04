import assert from 'node:assert/strict'
import test from 'node:test'
import { buildImageAllocation, imageSourceCaptureKey, validateImageExtraction, validateImageOrderSourceCapture, validateImageSourceCapture } from '../src/domain/application-image.ts'
import type { ImageExtraction, ImageSelectedStage, ImageTotalRow } from '../src/domain/application-image.ts'
import { emptyWorkspace } from '../src/domain/model.ts'
import type { ApplicationOrderInput, ApplicationSourceCapture, CatalogRecord, UserProfile, WorkspaceData } from '../src/domain/model.ts'
import { applyCommand } from '../src/domain/rules.ts'
import { nextStageApplicationNumber, stageApplicationCounts } from '../src/domain/applications.ts'

// Fictitious in-memory fixtures. No calls to models, databases, servers or operation.
const catalog: CatalogRecord[] = [
  { id: 'liquid', name: 'Producto líquido ficticio', active: true, unit: 'ml', default_dose: 99 },
  { id: 'solid', name: 'Producto sólido ficticio', active: true, unit: 'g', default_dose: 88 },
]
const selected: ImageSelectedStage[] = [{ stage_id: 'stage-a', area_ha: 12 }, { stage_id: 'stage-b', area_ha: 2 }]
const row = (overrides: Partial<ImageTotalRow> = {}): ImageTotalRow => ({ key: 'row-a', product_id: 'liquid', sourceName: '  Nombre escrito en imagen  ', presentation: 'Envase de 20 L', quantity: '42', totalUnit: 'L', ...overrides })
const extraction = (overrides: Partial<ImageExtraction> = {}): ImageExtraction => ({ agricultural_unit: null, destinations: [], application_number: null, crop: null, field: null, method: null, indicated_date: null, scheduled_date: null, water_l_ha: null, note: '', source_text: 'Texto OCR ficticio', products: [{ name: 'Nombre en imagen', presentation: 'Envase', quantity: 42, unit: 'L' }], ...overrides })
const source = (overrides: Partial<ApplicationSourceCapture> = {}): ApplicationSourceCapture => ({ kind: 'image_totals', area_ha: 14, products: [{ product_id: 'liquid', source_name: '  Nombre escrito en imagen  ', presentation: 'Envase de 20 L', quantity: 42, unit: 'L' }], ...overrides })
const admin: UserProfile = { id: 'admin-ficticio', full_name: 'Administrador ficticio', role: 'admin' }

function fixture(): WorkspaceData {
  const data = emptyWorkspace()
  data.catalogs.agricultural_units = [{ id: 'agri', name: 'Agrícola ficticia', active: true }]
  data.catalogs.fields = [{ id: 'field', name: 'Campo ficticio', agricultural_unit_id: 'agri', active: true }]
  data.catalogs.crops = [{ id: 'crop', name: 'Cultivo ficticio', active: true }]
  data.catalogs.varieties = [{ id: 'variety', name: 'Variedad ficticia', crop_id: 'crop', active: true }]
  data.catalogs.application_methods = [{ id: 'method', name: 'Medio ficticio', active: true }]
  data.catalogs.products = structuredClone(catalog)
  data.projects = [{ id: 'project', name: 'Temporada ficticia', season: '2026', agricultural_unit_id: 'agri', status: 'active' }]
  data.lots = selected.map((stage, index) => ({ id: `lot-${index}`, project_id: 'project', field_id: 'field', name: `Lote ficticio ${index + 1}`, area_ha: stage.area_ha, infrastructure_type_id: 'infra' }))
  data.subdivisions = selected.map((stage, index) => ({ id: `sub-${index}`, lot_id: `lot-${index}`, name: 'Completa', area_ha: stage.area_ha, active: true }))
  data.stages = selected.map((stage, index) => ({ id: stage.stage_id, subdivision_id: `sub-${index}`, stage_number: 1, crop_id: 'crop', variety_id: 'variety', area_ha: stage.area_ha, planned_sowing_date: '2026-10-01', actual_sowing_date: '2026-10-02', closed_at: null, status: 'planted' }))
  return data
}
function input(overrides: Partial<ApplicationOrderInput> = {}): ApplicationOrderInput {
  return { id: 'image-order', project_id: 'project', field_id: 'field', crop_id: 'crop', method_id: 'method', indicated_date: '2026-10-03', scheduled_date: '2026-10-04', water_l_ha: 100, observations: '  Nota literal\nsegunda línea  ', source_text: 'OCR ficticio\n42 L', stage_ids: selected.map(stage => stage.stage_id), products: [{ product_id: 'liquid', dose: 3000 }], source_capture: source(), ...overrides }
}
const save = (data: WorkspaceData, record: ApplicationOrderInput = input(), profile = admin) => applyCommand(data, { type: 'create_application_order', record }, profile)

test('valida extracción de imagen y conserva OCR, nota y presentación literalmente', () => {
  const raw = extraction({ note: '  Mañana\nEvitar calor\n  ', source_text: '  42 L\nTexto literal  ', products: [{ name: '  Producto original  ', presentation: '  Caja / 20 L  ', quantity: 42, unit: 'L' }] })
  const before = structuredClone(raw)
  const result = validateImageExtraction(raw)
  assert.deepEqual(result, raw)
  assert.deepEqual(raw, before)
  assert.notEqual(result.products, raw.products)
})

test('faltantes permanecen nulos y conserva el renglón para aclarar sin adivinar presentación o unidad', () => {
  const result = validateImageExtraction({ products: [{ name: null, presentation: null, quantity: null, unit: null }, {}] })
  assert.deepEqual(result.products, [{ name: '', presentation: '', quantity: null, unit: null }, { name: '', presentation: '', quantity: null, unit: null }])
  assert.equal(result.crop, null)
  assert.equal(result.water_l_ha, null)
  assert.equal(result.source_text, '')
  assert.equal(result.note, '')
  assert.throws(() => validateImageExtraction(extraction({ products: [{ name: 'A', presentation: 'Envase 1 L', quantity: 1, unit: 'cc' as 'ml' }] })), /unidad.*renglón 1/)
})

test('extracción limita 40 renglones, 200 caracteres de nombre/presentación, OCR 20k y nota 4k', () => {
  const product = { name: 'A'.repeat(200), presentation: 'B'.repeat(200), quantity: 0.000001, unit: 'g' as const }
  assert.equal(validateImageExtraction(extraction({ products: Array.from({ length: 40 }, () => ({ ...product })), source_text: 'x'.repeat(20000), note: 'n'.repeat(4000) })).products.length, 40)
  for (const patch of [
    { products: Array.from({ length: 41 }, () => ({ ...product })) },
    { products: [{ ...product, name: 'x'.repeat(201) }] },
    { products: [{ ...product, presentation: 'x'.repeat(201) }] },
    { source_text: 'x'.repeat(20001) }, { note: 'n'.repeat(4001) },
    { products: [{ ...product, name: 'x\u0000' }] }, { source_text: '\u0000' },
  ]) assert.throws(() => validateImageExtraction(extraction(patch)))
})

test('extracción rechaza totales no positivos, infinitos, límite, exceso de decimales, dosis y bytes', () => {
  for (const quantity of [0, -1, NaN, Infinity, 100_000_000, 0.0000001, 1.0000001, '42']) {
    assert.throws(() => validateImageExtraction({ ...extraction(), products: [{ name: 'A', presentation: '', quantity, unit: 'L' }] }), /cantidad total/)
  }
  assert.throws(() => validateImageExtraction({ ...extraction(), image: 'bytes' }), /campos no admitidos/)
  assert.throws(() => validateImageExtraction({ ...extraction(), products: [{ name: 'A', presentation: '', quantity: 42, dose: 3, unit: 'L' }] }), /campos no admitidos/)
  assert.throws(() => validateImageExtraction(extraction({ indicated_date: '2026-02-30' })), /fecha/)
  assert.throws(() => validateImageExtraction(extraction({ application_number: 0 })), /número/)
})

test('reparte 42 L uniformemente entre 12 y 2 ha y conserva fuente con códigos sin usar dosis default', () => {
  const rows = [row()]
  const before = structuredClone({ rows, selected, catalog })
  const result = buildImageAllocation(rows, selected, catalog)
  assert.deepEqual(result.errors, [])
  assert.equal(result.area_ha, 14)
  assert.deepEqual(result.doseRows, [{ product_id: 'liquid', dose: '3000', sourceName: rows[0].sourceName, importUnit: 'ml' }])
  assert.deepEqual(result.source_capture, source())
  assert.deepEqual(result.allocations, [{ key: 'row-a', product_id: 'liquid', source_name: rows[0].sourceName, presentation: rows[0].presentation, quantity: 42, unit: 'L', base_unit: 'ml', dose: '3000', original_total: 42, reconstructed_total: 42, delta: 0 }])
  assert.deepEqual({ rows, selected, catalog }, before)
})

test('normaliza kg a g y L a ml; g y ml quedan en unidad base sin multiplicar presentaciones', () => {
  for (const [product_id, quantity, totalUnit, dose, importUnit] of [
    ['solid', '12', 'kg', '6000', 'g'], ['liquid', '12', 'L', '6000', 'ml'],
    ['solid', '12', 'g', '6', 'g'], ['liquid', '12', 'ml', '6', 'ml'],
    ['solid', '0.333333', 'kg', '166.6665', 'g'],
  ] as const) {
    const result = buildImageAllocation([row({ product_id, quantity, totalUnit, presentation: 'Caja de 100 envases de 20 L' })], [{ stage_id: 'one', area_ha: 2 }], catalog)
    assert.deepEqual(result.errors, [])
    assert.equal(result.doseRows[0].dose, dose)
    assert.equal(result.doseRows[0].importUnit, importUnit)
    assert.equal(result.allocations[0].original_total, Number(quantity))
    assert.equal(result.allocations[0].delta, 0)
  }
})

test('suma superficies fraccionarias de forma decimal exacta y recalcula al cambiar destinos', () => {
  const rows = [row({ quantity: '12' })]
  const fractions = buildImageAllocation(rows, [{ stage_id: 'a', area_ha: 0.1 }, { stage_id: 'b', area_ha: 0.2 }], catalog)
  assert.equal(fractions.area_ha, 0.3)
  assert.equal(fractions.doseRows[0].dose, '40000')
  assert.equal(fractions.source_capture!.area_ha, 0.3)
  assert.equal(buildImageAllocation(rows, [{ stage_id: 'a', area_ha: 2 }], catalog).doseRows[0].dose, '6000')
  assert.equal(buildImageAllocation(rows, [{ stage_id: 'a', area_ha: 12 }], catalog).doseRows[0].dose, '1000')
})

test('redondea HALF_UP a seis decimales exactos y muestra reconstrucción/delta sin cancelación binaria', () => {
  for (const [quantity, area, dose, reconstructed, delta] of [
    ['1.000001', 2, '0.500001', 1.000002, 0.000001],
    ['1.000003', 2, '0.500002', 1.000004, 0.000001],
    ['1', 3, '0.333333', 0.999999, -0.000001],
    ['2', 3, '0.666667', 2.000001, 0.000001],
  ] as const) {
    const result = buildImageAllocation([row({ quantity, totalUnit: 'ml' })], [{ stage_id: 'a', area_ha: area }], catalog)
    assert.deepEqual(result.errors, [])
    assert.equal(result.doseRows[0].dose, dose)
    assert.equal(result.allocations[0].reconstructed_total, reconstructed)
    assert.equal(result.allocations[0].delta, delta)
  }
  const liters = buildImageAllocation([row({ quantity: '1', totalUnit: 'L' })], [{ stage_id: 'a', area_ha: 3 }], catalog)
  assert.equal(liters.doseRows[0].dose, '333.333333')
  assert.equal(liters.allocations[0].reconstructed_total, 0.999999999)
  assert.equal(liters.allocations[0].delta, -0.000000001)
})

test('unidades ausentes/incompatibles exigen aclaración y nunca convierten masa en volumen', () => {
  for (const totalUnit of [null, 'kg', 'g'] as const) {
    const result = buildImageAllocation([row({ totalUnit })], selected, catalog)
    assert.ok(result.errors.some(issue => issue.field === 'unit:0'))
    assert.equal(result.doseRows[0].dose, '')
    assert.equal(result.source_capture, null)
  }
  const missingCatalogUnit = buildImageAllocation([row()], selected, [{ ...catalog[0], unit: undefined }])
  assert.match(missingCatalogUnit.errors[0].message, /unidad fija/)
  assert.equal(missingCatalogUnit.doseRows[0].importUnit, 'ml')
})

test('productos faltantes, inactivos y duplicados conservan filas pendientes sin elegir coincidencias', () => {
  const result = buildImageAllocation([row({ product_id: '' }), row({ key: 'b', product_id: 'solid', totalUnit: 'kg' })], selected, [{ ...catalog[1], active: false }])
  assert.equal(result.doseRows.length, 2)
  assert.ok(result.errors.some(issue => issue.field === 'product:0'))
  assert.ok(result.errors.some(issue => issue.field === 'product:1'))
  assert.equal(result.source_capture, null)
  const duplicate = buildImageAllocation([row(), row({ key: 'b', quantity: '1' })], selected, catalog)
  assert.equal(duplicate.errors.filter(issue => issue.field.startsWith('product:')).length, 2)
  assert.equal(duplicate.doseRows[0].dose, '')
  assert.equal(duplicate.source_capture, null)
})

test('totales vacíos o inválidos conservan un bloqueo de cantidad concreto por renglón', () => {
  for (const quantity of ['', ' ', 'abc', 'Infinity', '1,5', '0', '-1', '100000000', '0.0000001', '1.0000001']) {
    const result = buildImageAllocation([row({ quantity })], selected, catalog)
    assert.ok(result.errors.some(issue => issue.field === 'quantity:0'), quantity)
    assert.equal(result.doseRows[0].dose, '')
    assert.equal(result.source_capture, null)
  }
  assert.equal(buildImageAllocation([row({ quantity: '1e-6' })], [{ stage_id: 'a', area_ha: 1 }], catalog).doseRows[0].dose, '0.001')
  assert.equal(buildImageAllocation([row({ quantity: '1.0000000' })], selected, catalog).errors.length, 0)
})

test('destinos vacíos, repetidos o superficies no válidas impiden repartir y guardar', () => {
  for (const stages of [[], [selected[0], selected[0]], [{ stage_id: '', area_ha: 1 }], ...[0, -1, NaN, Infinity, 0.00001].map(area_ha => [{ stage_id: 'one', area_ha }])]) {
    const result = buildImageAllocation([row()], stages, catalog)
    assert.ok(result.errors.some(issue => issue.field === 'destinations'))
    assert.equal(result.doseRows[0].dose, '')
    assert.equal(result.source_capture, null)
  }
})

test('no acepta dosis redondeada a cero ni dosis que alcanza límite SQL', () => {
  const small = buildImageAllocation([row({ quantity: '0.000001', totalUnit: 'ml' })], [{ stage_id: 'a', area_ha: 3 }], catalog)
  assert.ok(small.errors.some(issue => /dosis calculada/.test(issue.message)))
  const big = buildImageAllocation([row({ quantity: '100000', totalUnit: 'L' })], [{ stage_id: 'a', area_ha: 1 }], catalog)
  assert.ok(big.errors.some(issue => /dosis calculada/.test(issue.message)))
  assert.equal(small.source_capture, null)
  assert.equal(big.source_capture, null)
})

test('límite de renglones y textos también se aplica a la revisión manual', () => {
  for (const rows of [[], Array.from({ length: 41 }, (_, index) => row({ key: String(index) }))]) {
    assert.ok(buildImageAllocation(rows, selected, catalog).errors.some(issue => issue.field === 'products'))
  }
  const invalid = buildImageAllocation([row({ sourceName: 'x'.repeat(201), presentation: 'n\u0000' })], selected, catalog)
  assert.deepEqual(invalid.errors.map(issue => issue.field), ['sourceName:0', 'presentation:0'])
  assert.equal(invalid.source_capture, null)
})

test('valida fuente estricta, sin bytes, enlaces, unidades inventadas ni metadatos parciales', () => {
  assert.deepEqual(validateImageSourceCapture(source()), source())
  const original = source().products[0]
  for (const value of [
    null, [], {}, { ...source(), kind: 'text' }, { ...source(), area_ha: 0 }, { ...source(), area_ha: 14.00001 },
    { ...source(), url: 'https://example.invalid' }, { ...source(), products: [] },
    { ...source(), products: [{ ...original, image: 'bytes' }] },
    { ...source(), products: [{ ...original, product_id: '' }] },
    { ...source(), products: [{ ...original, source_name: undefined }] },
    { ...source(), products: [{ ...original, presentation: null }] },
    { ...source(), products: [{ ...original, quantity: '42' }] },
    { ...source(), products: [{ ...original, quantity: 0.0000001 }] },
    { ...source(), products: [{ ...original, unit: null }] },
    { ...source(), products: [{ ...original, unit: 'cc' }] },
    { ...source(), products: [original, original] },
  ]) assert.throws(() => validateImageSourceCapture(value))
  assert.equal(validateImageSourceCapture(source({ products: [{ ...original, source_name: '', presentation: '' }] })).products[0].source_name, '')
})

test('la validación al guardar exige misma área vigente y mismo conjunto de dosis por ID', () => {
  const inputs = [{ product_id: 'liquid', dose: 3000 }]
  assert.deepEqual(validateImageOrderSourceCapture(source(), selected, catalog, inputs), source())
  assert.throws(() => validateImageOrderSourceCapture(source(), [{ stage_id: 'a', area_ha: 15 }], catalog, inputs), /superficie.*cambió/)
  for (const products of [[], [{ product_id: 'liquid', dose: 3001 }], [{ product_id: 'solid', dose: 3000 }], [...inputs, ...inputs]]) {
    assert.throws(() => validateImageOrderSourceCapture(source(), selected, catalog, products), /dosis.*reparto uniforme/)
  }
  const massRow = row({ key: 'b', product_id: 'solid', quantity: '7', totalUnit: 'kg' })
  const allocation = buildImageAllocation([row(), massRow], selected, catalog)
  assert.deepEqual(validateImageOrderSourceCapture(allocation.source_capture, selected, catalog, [{ product_id: 'solid', dose: 500 }, ...inputs]), allocation.source_capture)
})

test('guarda metadatos originales, totales y nota sin mutarlos, y conserva numeración por etapa', () => {
  const data = fixture()
  const record = input()
  const before = structuredClone(record)
  const result = save(data, record)
  assert.equal(data.applicationOrders.length, 0)
  assert.deepEqual(record, before)
  assert.deepEqual(result.applicationOrders[0].source_capture, source())
  assert.equal(result.applicationOrders[0].observations, record.observations)
  assert.equal(result.applicationOrders[0].source_text, record.source_text)
  assert.equal(result.applicationOrders[0].products[0].dose, 3000)
  assert.equal(result.applicationTargets.length, 2)
  assert.ok(result.applicationTargets.every(target => target.application_number === 1))
  assert.equal(nextStageApplicationNumber(result, 'stage-a'), 2)
  assert.deepEqual(stageApplicationCounts(result, 'stage-a'), { indicated: 1, performed: 0, cancelled: 0 })
  record.source_capture!.products[0].presentation = 'Edición posterior del formulario'
  assert.equal(result.applicationOrders[0].source_capture!.products[0].presentation, before.source_capture!.products[0].presentation)
})

test('la simulación rechaza fuente inválida, dosis intervenida, superficie cambiada y lector', () => {
  const data = fixture()
  assert.throws(() => save(data, input({ source_capture: { ...source(), extra: 'bytes' } as ApplicationSourceCapture })), /campos no admitidos/)
  assert.throws(() => save(data, input({ products: [{ product_id: 'liquid', dose: 42 }] })), /reparto uniforme/)
  data.stages[0].area_ha = 13
  assert.throws(() => save(data), /superficie.*cambió/)
  assert.throws(() => save(fixture(), input(), { ...admin, role: 'reader' }), /consulta/)
  assert.equal(data.applicationOrders.length, 0)
})

test('reintento idéntico conserva origen incluso tras corrección de área, cierre o producto retirado', () => {
  const record = input()
  const saved = save(fixture(), record)
  const beforeSource = structuredClone(saved.applicationOrders[0].source_capture)
  saved.stages[0].area_ha = 13
  saved.projects[0].status = 'closed'
  saved.catalogs.products[0].active = false
  const retry = save(JSON.parse(JSON.stringify(saved)) as WorkspaceData, record)
  assert.equal(retry.applicationOrders.length, 1)
  assert.equal(retry.applicationTargets.length, 2)
  assert.deepEqual(retry.applicationOrders[0].source_capture, beforeSource)
  assert.ok(retry.applicationTargets.every(target => target.application_number === 1))
  for (const source_capture of [null, source({ area_ha: 15 }), source({ products: [{ ...source().products[0], source_name: 'Otro nombre' }] }), source({ products: [{ ...source().products[0], quantity: 43 }] })]) {
    assert.throws(() => save(saved, { ...record, source_capture }), /identificador/)
  }
})

test('fuente y productos reordenados son el mismo reintento, pero cambiar presentación no lo es', () => {
  const allocation = buildImageAllocation([row(), row({ key: 'b', product_id: 'solid', quantity: '7', totalUnit: 'kg' })], selected, catalog)
  const record = input({ source_capture: allocation.source_capture, products: allocation.doseRows.map(row => ({ product_id: row.product_id, dose: Number(row.dose) })) })
  const saved = save(fixture(), record)
  const reversed = { ...record, products: record.products.slice().reverse(), source_capture: { ...record.source_capture!, products: record.source_capture!.products.slice().reverse() } }
  assert.equal(save(saved, reversed).applicationOrders.length, 1)
  assert.equal(imageSourceCaptureKey(record.source_capture), imageSourceCaptureKey(reversed.source_capture))
  assert.throws(() => save(saved, { ...record, source_capture: { ...record.source_capture!, products: record.source_capture!.products.map(row => ({ ...row, presentation: 'Presentación nueva' })) } }), /identificador/)
})

test('sin fuente y fuente nula conservan creación y reintento de captura manual anterior', () => {
  const record = input({ source_capture: undefined })
  const saved = save(fixture(), record)
  assert.equal(saved.applicationOrders[0].source_capture, null)
  assert.equal(save(saved, { ...record, source_capture: null }).applicationOrders.length, 1)
  assert.equal(imageSourceCaptureKey(undefined), imageSourceCaptureKey(null))
})

test('revisar la indicación no reescribe las cantidades ni superficie originales de la imagen', () => {
  const saved = save(fixture())
  const before = structuredClone(saved.applicationOrders[0].source_capture)
  const revised = applyCommand(saved, { type: 'revise_application_order', record: { id: 'revision-image', order_id: 'image-order', expected_revision: 0, target_ids: saved.applicationTargets.map(target => target.id), method_id: 'method', indicated_date: '2026-10-03', scheduled_date: '2026-10-04', water_l_ha: 101, observations: 'Nota revisada', reason: 'Ajuste ficticio', products: [{ product_id: 'liquid', dose: 1000 }] } }, admin)
  assert.equal(revised.applicationOrders[0].revision, 1)
  assert.deepEqual(revised.applicationOrders[0].source_capture, before)
  assert.equal(revised.applicationOrders[0].products[0].dose, 3000)
  assert.equal(revised.applicationChanges[0].after.products[0].dose, 1000)
  assert.equal(save(revised).applicationOrders.length, 1)
})
