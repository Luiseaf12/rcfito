import assert from 'node:assert/strict'
import test from 'node:test'
import { createDemoData, DEMO_ADMIN_ID, DEMO_READER_ID } from '../src/domain/demo.ts'
import { buildProductUsage } from '../src/domain/product-usage.ts'
import { applyCommand, scopeWorkspace } from '../src/domain/rules.ts'
import type { ApplicationOrder, ApplicationTarget, ProductLine, WorkspaceData } from '../src/domain/model.ts'

// All records are fictitious and stay in memory; no backend or operation data.
const liquid = (dose: number, name = 'Producto líquido histórico'): ProductLine => ({ product_id: 'product-a', product_name: name, unit: 'ml', dose })
const solid = (dose: number): ProductLine => ({ product_id: 'product-b', product_name: 'Producto sólido histórico', unit: 'g', dose })

function fixture() {
  const data = createDemoData()
  data.projects.find(project => project.id === 'project-culiacan')!.status = 'active'
  return data
}

function addOrder(data: WorkspaceData, id = 'order-1', overrides: Partial<ApplicationOrder> = {}) {
  const order: ApplicationOrder = {
    id, folio: `APL-${id}`, project_id: 'project-ensenada', field_id: 'field-norte', crop_id: 'crop-pepino', method_id: 'method-dron',
    indicated_date: '2026-10-01', scheduled_date: '2026-10-02', water_l_ha: 120, observations: '',
    products: [{ product_id: 'product-c', product_name: 'Solo indicado', unit: 'ml', dose: 999 }],
    project_name: 'Proyecto conservado', field_name: 'Campo conservado', crop_name: 'Pepino', ...overrides,
  }
  data.applicationOrders.push(order)
  return order
}

function addTarget(data: WorkspaceData, id: string, overrides: Partial<ApplicationTarget> = {}) {
  const target: ApplicationTarget = {
    id, order_id: 'order-1', stage_id: 'stage-1', status: 'performed', lot_name: 'Lote conservado', subdivision_name: 'Subdivisión conservada',
    stage_number: 1, crop_name: 'Pepino conservado', variety_name: 'Variedad conservada', area_ha: 2,
    actual_date: '2026-10-03', actual_water_l_ha: 120, actual_products: [liquid(100)], equipment: '', applicator: '',
    actual_observations: '', cancellation_reason: '', has_changes: false, ...overrides,
  }
  data.applicationTargets.push(target)
  return target
}

test('al filtrar realizadas cuenta destinos y calcula cantidades y dosis ponderadas solo con sus productos reales', () => {
  const data = fixture()
  addOrder(data)
  addTarget(data, 'target-small', { actual_products: [liquid(100), solid(25)] })
  addTarget(data, 'target-large', { stage_id: 'stage-2', area_ha: 8, actual_date: '2026-10-08', actual_products: [liquid(200)] })
  addTarget(data, 'target-indicated', { status: 'indicated', actual_date: null, actual_products: [] })
  addTarget(data, 'target-cancelled', { status: 'cancelled', actual_date: null, actual_products: [] })
  const original = structuredClone(data)
  const result = buildProductUsage(data, { status: 'performed' })
  assert.equal(result.applicationCount, 2, 'varios productos de una mezcla no multiplican el total general')
  assert.equal(result.products.length, 2)
  const [a, b] = result.products
  assert.equal(a.productId, 'product-a')
  assert.equal(a.applicationCount, 2)
  assert.equal(a.totalQuantity, 1800)
  assert.equal(a.accumulatedAreaHa, 10)
  assert.equal(a.averageDose, 180, 'la media debe ponderarse por superficie, no ser 150')
  assert.equal(a.destinationCount, 2)
  assert.equal(a.lastRecordedDate, '2026-10-08')
  assert.deepEqual(a.history.map(row => row.targetId), ['target-large', 'target-small'])
  assert.equal(a.history[0].quantity, 1600)
  assert.equal(b.totalQuantity, 50)
  assert.equal(b.averageDose, 25)
  assert.equal(result.liquidMl, 1800)
  assert.equal(result.solidG, 50)
  assert.equal(result.incompleteCount, 0)
  assert.deepEqual(data, original, 'el análisis no cambia la fuente')
})

test('la superficie acumulada cuenta cada aplicación y los destinos cuentan cada etapa una sola vez', () => {
  const data = fixture()
  addOrder(data)
  addOrder(data, 'order-2')
  addTarget(data, 'target-1')
  addTarget(data, 'target-2', { order_id: 'order-2', actual_date: '2026-10-12', actual_products: [liquid(50)] })
  const result = buildProductUsage(data)
  const product = result.products[0]
  assert.equal(product.applicationCount, 2)
  assert.equal(product.destinationCount, 1)
  assert.equal(product.accumulatedAreaHa, 4)
  assert.equal(product.totalQuantity, 300)
  assert.equal(product.averageDose, 75)
})

test('filtra agrícola, cultivo y número de etapa incluyendo proyectos y etapas cerrados', () => {
  const data = fixture()
  data.stages.find(stage => stage.id === 'stage-1')!.status = 'closed'
  addOrder(data)
  addOrder(data, 'order-south', { project_id: 'project-culiacan', field_id: 'field-rio' })
  addOrder(data, 'order-tomato', { crop_id: 'crop-tomate' })
  addOrder(data, 'order-history', { project_id: 'project-history' })
  addTarget(data, 'north-1')
  addTarget(data, 'north-2', { stage_id: 'stage-next', stage_number: 2 })
  addTarget(data, 'south-1', { order_id: 'order-south', stage_id: 'south-stage' })
  addTarget(data, 'tomato-1', { order_id: 'order-tomato', stage_id: 'tomato-stage', crop_name: 'Tomate' })
  addTarget(data, 'history-1', { order_id: 'order-history', stage_id: 'stage-history' })
  assert.equal(buildProductUsage(data).applicationCount, 5)
  assert.equal(buildProductUsage(data, { agriculturalUnitId: 'agri-ensenada' }).applicationCount, 4)
  assert.equal(buildProductUsage(data, { cropId: 'crop-pepino', stageNumber: 1 }).applicationCount, 3, 'etapa 1 se repite en varias subdivisiones y temporadas')
  const selected = buildProductUsage(data, { agriculturalUnitId: 'agri-ensenada', cropId: 'crop-pepino', stageNumber: 1 })
  assert.equal(selected.applicationCount, 2, 'las etapas cerradas y la temporada anterior siguen contando')
  assert.deepEqual(selected.products[0].history.map(row => row.targetId), ['history-1', 'north-1'])
  assert.equal(buildProductUsage(data, { stageNumber: 2 }).applicationCount, 1)
  assert.equal(buildProductUsage(data, { agriculturalUnitId: 'agri-unknown' }).applicationCount, 0)
  assert.equal(buildProductUsage(data, { agriculturalUnitId: '', cropId: '' }).applicationCount, 5)
  data.projects.find(project => project.id === 'project-culiacan')!.status = 'draft'
  assert.equal(buildProductUsage(data).applicationCount, 5, 'el estado del proyecto no oculta registros guardados')
})

test('usa nombres y superficies conservados aunque cambien catálogos y siembras', () => {
  const data = fixture()
  addOrder(data)
  addTarget(data, 'target-old', { actual_products: [liquid(100, 'Nombre anterior')] })
  addTarget(data, 'target-new', { actual_date: '2026-10-09', actual_products: [liquid(100, 'Nombre de realización más reciente')] })
  data.catalogs.products = []
  data.catalogs.fields[0].name = 'Campo renombrado'
  data.projects[0].name = 'Proyecto renombrado'
  data.stages[0].area_ha = 999
  const product = buildProductUsage(data).products[0]
  assert.equal(product.name, 'Nombre de realización más reciente')
  assert.equal(product.history[0].fieldName, 'Campo conservado')
  assert.equal(product.history[0].projectName, 'Proyecto conservado')
  assert.equal(product.history[0].lotName, 'Lote conservado')
  assert.equal(product.history[0].subdivisionName, 'Subdivisión conservada')
  assert.equal(product.history[0].cropName, 'Pepino conservado')
  assert.equal(product.history[0].agriculturalUnitName, 'Ensenada')
  assert.equal(product.history[0].season, '2026–2027')
  assert.equal(product.history[0].areaHa, 2)
  assert.equal(product.totalQuantity, 400)
})

test('las correcciones vigentes sustituyen los valores reales anteriores sin contar sus eventos otra vez', () => {
  let data = createDemoData()
  const admin = data.profiles.find(profile => profile.id === DEMO_ADMIN_ID)!
  data = applyCommand(data, { type: 'create_application_order', record: {
    id: 'corrected-order', project_id: 'project-ensenada', field_id: 'field-norte', crop_id: 'crop-pepino', method_id: 'method-dron',
    indicated_date: '2026-10-10', scheduled_date: '2026-10-11', water_l_ha: 100, observations: '',
    stage_ids: ['stage-1'], products: [{ product_id: 'product-a', dose: 100 }],
  } }, admin)
  const targetId = data.applicationTargets[0].id
  data = applyCommand(data, { type: 'perform_application_targets', order_id: 'corrected-order', target_ids: [targetId], data: {
    actual_date: '2026-10-12', equipment: '', applicator: '', observations: '', changed: false,
  } }, admin)
  data = applyCommand(data, { type: 'correct_application_target', record: {
    id: 'correction-1', target_id: targetId, expected_version: 0, actual_date: '2026-10-14', water_l_ha: 110,
    equipment: '', applicator: '', observations: '', reason: 'Corrección ficticia', products: [{ product_id: 'product-b', dose: 250 }],
  } }, admin)
  const result = buildProductUsage(data)
  assert.equal(result.applicationCount, 1)
  assert.equal(result.products.length, 1)
  assert.equal(result.products[0].productId, 'product-b')
  assert.equal(result.solidG, 3000)
  assert.equal(result.liquidMl, 0)
  assert.equal(result.products[0].lastRecordedDate, '2026-10-14')
})

test('separa unidades conservadas del mismo identificador de producto y ordena empates de manera estable', () => {
  const data = fixture()
  addOrder(data)
  addTarget(data, 'target-z', { actual_products: [liquid(100, 'Zeta')] })
  addTarget(data, 'target-a', { actual_products: [liquid(200, 'Alfa')] })
  addTarget(data, 'target-solid', { actual_products: [{ ...liquid(50, 'Sólido conservado'), unit: 'g' }] })
  const result = buildProductUsage(data)
  assert.equal(result.products.length, 2)
  assert.equal(result.products[0].name, 'Alfa')
  assert.notEqual(result.products[0].key, result.products[1].key)
  assert.equal(result.liquidMl, 600)
  assert.equal(result.solidG, 100)
  data.applicationTargets.reverse()
  assert.deepEqual(buildProductUsage(data), result)
})

test('excluye realizaciones incompletas o inválidas completas sin usar la mezcla indicada', () => {
  const data = fixture()
  addOrder(data)
  addTarget(data, 'valid')
  addTarget(data, 'no-date', { actual_date: null })
  addTarget(data, 'invalid-date', { actual_date: '2026-02-30' })
  addTarget(data, 'no-products', { actual_products: [] })
  addTarget(data, 'no-stage', { stage_id: '' })
  addTarget(data, 'invalid-stage-number', { stage_number: 0 })
  addTarget(data, 'zero-area', { area_ha: 0 })
  addTarget(data, 'infinite-area', { area_ha: Infinity })
  addTarget(data, 'invalid-dose', { actual_products: [liquid(100), solid(NaN)] })
  addTarget(data, 'zero-dose', { actual_products: [liquid(0)] })
  addTarget(data, 'duplicate-product', { actual_products: [liquid(100), liquid(200)] })
  addTarget(data, 'empty-product-name', { actual_products: [liquid(100, '')] })
  const result = buildProductUsage(data)
  assert.equal(result.applicationCount, 1)
  assert.equal(result.incompleteCount, 11)
  assert.equal(result.products.length, 1)
  assert.equal(result.liquidMl, 200)
  assert.equal(result.solidG, 0)
  assert.equal(result.products[0].history.length, 1)
})

test('no duplica un destino repetido y respeta el ámbito que entrega el adaptador al lector', () => {
  const data = fixture()
  addOrder(data)
  addOrder(data, 'south-order', { project_id: 'project-culiacan', field_id: 'field-rio' })
  const target = addTarget(data, 'north-target')
  data.applicationTargets.push(structuredClone(target))
  addTarget(data, 'south-target', { order_id: 'south-order', stage_id: 'south-stage' })
  assert.equal(buildProductUsage(data).applicationCount, 2)
  assert.equal(buildProductUsage(data).products[0].applicationCount, 2)
  const reader = data.profiles.find(profile => profile.id === DEMO_READER_ID)!
  const scoped = scopeWorkspace(data, reader)
  const result = buildProductUsage(scoped)
  assert.equal(result.applicationCount, 1)
  assert.equal(result.liquidMl, 200)
  assert.ok(result.products[0].history.every(row => row.agriculturalUnitName === 'Ensenada'))
})

test('una consulta sin registros devuelve un resumen vacío sin valores no finitos', () => {
  assert.deepEqual(buildProductUsage(createDemoData()), { products: [], applicationCount: 0, liquidMl: 0, solidG: 0, incompleteCount: 0 })
})

test('por defecto incluye indicadas, realizadas y canceladas con la fecha y mezcla correspondientes a cada estado', () => {
  const data = fixture()
  addOrder(data, 'order-1', { products: [liquid(100, 'Nombre indicado')], indicated_date: '2026-10-01', scheduled_date: '2026-12-15' })
  addTarget(data, 'indicated', { status: 'indicated', actual_date: null, actual_products: [] })
  addTarget(data, 'cancelled', { status: 'cancelled', actual_date: '2026-10-31', actual_products: [solid(999)] })
  addTarget(data, 'performed', { actual_date: '2026-10-05', actual_products: [liquid(200, 'Nombre realizado')] })
  const original = structuredClone(data)
  const result = buildProductUsage(data)
  assert.equal(result.applicationCount, 3)
  assert.equal(result.products.length, 1)
  assert.equal(result.products[0].applicationCount, 3)
  assert.equal(result.products[0].name, 'Nombre realizado')
  assert.equal(result.products[0].totalQuantity, 800)
  assert.equal(result.products[0].averageDose, 800 / 6)
  assert.equal(result.products[0].lastRecordedDate, '2026-10-05', 'ni la programación ni la fecha residual cancelada sustituyen la fecha de registro')
  assert.deepEqual(result.products[0].history.map(row => [row.targetId, row.status, row.source, row.recordDate]), [
    ['performed', 'performed', 'actual', '2026-10-05'],
    ['cancelled', 'cancelled', 'indication', '2026-10-01'],
    ['indicated', 'indicated', 'indication', '2026-10-01'],
  ])
  assert.deepEqual(buildProductUsage(data, { status: 'all' }), result)
  const indicated = buildProductUsage(data, { status: 'indicated' })
  assert.equal(indicated.applicationCount, 1)
  assert.equal(indicated.liquidMl, 200)
  assert.equal(indicated.solidG, 0)
  const cancelled = buildProductUsage(data, { status: 'cancelled' })
  assert.equal(cancelled.applicationCount, 1)
  assert.equal(cancelled.liquidMl, 200, 'los valores reales residuales no pertenecen a una cancelada')
  assert.equal(cancelled.solidG, 0)
  const performed = buildProductUsage(data, { status: 'performed' })
  assert.equal(performed.applicationCount, 1)
  assert.equal(performed.liquidMl, 400)
  assert.deepEqual(data, original)
})

function revisedIndications() {
  let data = createDemoData()
  const admin = data.profiles.find(profile => profile.id === DEMO_ADMIN_ID)!
  Object.assign(data.stages.find(stage => stage.id === 'stage-2')!, {
    crop_id: 'crop-pepino', variety_id: 'var-pepino-persian', crop_name_snapshot: 'Pepino', variety_name_snapshot: 'Persa',
    status: 'planted', planned_sowing_date: '2026-10-02', actual_sowing_date: '2026-10-04',
  })
  data = applyCommand(data, { type: 'create_application_order', record: {
    id: 'revised-order', project_id: 'project-ensenada', field_id: 'field-norte', crop_id: 'crop-pepino', method_id: 'method-dron',
    indicated_date: '2026-10-10', scheduled_date: '2026-10-15', water_l_ha: 100, observations: '',
    stage_ids: ['stage-1', 'stage-2'], products: [{ product_id: 'product-a', dose: 100 }],
  } }, admin)
  data = applyCommand(data, { type: 'revise_application_order', record: {
    id: 'revision-1', order_id: 'revised-order', expected_revision: 0, target_ids: data.applicationTargets.map(target => target.id),
    method_id: 'method-dron', indicated_date: '2026-10-11', scheduled_date: '2026-10-16', water_l_ha: 110, observations: '',
    reason: 'Primera revisión ficticia', products: [{ product_id: 'product-b', dose: 25 }],
  } }, admin)
  const cancelledId = data.applicationTargets.find(target => target.stage_id === 'stage-1')!.id
  data = applyCommand(data, { type: 'cancel_application_targets', order_id: 'revised-order', target_ids: [cancelledId], reason: 'Cancelación ficticia' }, admin)
  data = applyCommand(data, { type: 'revise_application_order', record: {
    id: 'revision-2', order_id: 'revised-order', expected_revision: 1,
    target_ids: data.applicationTargets.filter(target => target.status === 'indicated').map(target => target.id),
    method_id: 'method-dron', indicated_date: '2026-10-12', scheduled_date: '2026-10-17', water_l_ha: 120, observations: '',
    reason: 'Segunda revisión ficticia', products: [{ product_id: 'product-a', dose: 300 }],
  } }, admin)
  return { data, cancelledId }
}

test('la indicación usa su revisión vigente y la cancelada mantiene congelada la revisión que tenía', () => {
  const { data, cancelledId } = revisedIndications()
  const original = structuredClone(data)
  const result = buildProductUsage(data)
  const liquidProduct = result.products.find(product => product.unit === 'ml')!
  const solidProduct = result.products.find(product => product.unit === 'g')!
  assert.equal(result.applicationCount, 2)
  assert.equal(result.incompleteCount, 0)
  assert.equal(liquidProduct.totalQuantity, 2100)
  assert.equal(liquidProduct.averageDose, 300)
  assert.equal(liquidProduct.lastRecordedDate, '2026-10-12')
  assert.equal(liquidProduct.history[0].status, 'indicated')
  assert.equal(liquidProduct.history[0].source, 'indication')
  assert.equal(solidProduct.totalQuantity, 300)
  assert.equal(solidProduct.averageDose, 25)
  assert.equal(solidProduct.lastRecordedDate, '2026-10-11')
  assert.equal(solidProduct.history[0].targetId, cancelledId)
  assert.equal(solidProduct.history[0].status, 'cancelled')
  assert.equal(data.applicationOrders[0].products[0].dose, 100, 'la orden base no representa las revisiones de los destinos')
  assert.deepEqual(data, original)
})

test('el historial de indicación faltante excluye el destino sin sustituirlo por la orden base', () => {
  const { data } = revisedIndications()
  data.applicationChanges = data.applicationChanges.filter(change => change.id !== 'revision-1')
  const partial = buildProductUsage(data)
  assert.equal(partial.incompleteCount, 1)
  assert.equal(partial.applicationCount, 1)
  assert.equal(partial.solidG, 0)
  assert.equal(partial.liquidMl, 2100)
  data.applicationChanges = []
  const empty = buildProductUsage(data)
  assert.equal(empty.incompleteCount, 2)
  assert.equal(empty.applicationCount, 0)
  assert.deepEqual(empty.products, [])
})

test('una realizada incompleta nunca utiliza los productos indicados aunque se consulte Todos', () => {
  const data = fixture()
  addOrder(data, 'order-1', { products: [solid(200)] })
  addTarget(data, 'performed-empty', { actual_products: [], actual_date: '2026-10-05' })
  addTarget(data, 'performed-no-date', { actual_products: [liquid(100)], actual_date: null })
  addTarget(data, 'indicated-valid', { status: 'indicated', actual_products: [], actual_date: null })
  const result = buildProductUsage(data)
  assert.equal(result.incompleteCount, 2)
  assert.equal(result.applicationCount, 1)
  assert.equal(result.products.length, 1)
  assert.equal(result.solidG, 400)
  assert.equal(result.liquidMl, 0)
  const actualOnly = buildProductUsage(data, { status: 'performed' })
  assert.equal(actualOnly.incompleteCount, 2)
  assert.equal(actualOnly.applicationCount, 0)
})
