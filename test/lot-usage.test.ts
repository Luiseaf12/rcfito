import assert from 'node:assert/strict'
import test from 'node:test'
import { createDemoData, DEMO_READER_ID } from '../src/domain/demo.ts'
import { buildLotUsage } from '../src/domain/lot-usage.ts'
import { buildProductUsage, compareProductQuantity } from '../src/domain/product-usage.ts'
import { scopeWorkspace } from '../src/domain/rules.ts'
import type { ApplicationOrder, ApplicationTarget, ProductLine, WorkspaceData } from '../src/domain/model.ts'

// Fictitious, in-memory records only; these tests never connect to operation.
const liquid = (dose: number, name = 'Líquido conservado'): ProductLine => ({ product_id: 'product-a', product_name: name, unit: 'ml', dose })
const solid = (dose: number, name = 'Sólido conservado'): ProductLine => ({ product_id: 'product-b', product_name: name, unit: 'g', dose })

function fixture() {
  const data = createDemoData()
  data.lots.find(lot => lot.id === 'lot-1')!.name = 'Lote repetido'
  Object.assign(data.lots.find(lot => lot.id === 'lot-2')!, { name: 'Lote repetido', field_id: 'field-valle', field_name_snapshot: 'Campo del Valle' })
  data.lots.find(lot => lot.id === 'lot-history')!.name = 'Lote repetido'
  Object.assign(data.subdivisions.find(subdivision => subdivision.id === 'sub-lot-1')!, { area_ha: 8, active: false })
  Object.assign(data.stages.find(stage => stage.id === 'stage-1')!, { area_ha: 8, status: 'closed', closed_at: '2026-10-25' })
  data.subdivisions.push({ id: 'sub-lot-1-b', lot_id: 'lot-1', name: 'Parte B conservada', area_ha: 4, active: false })
  data.stages.push({ id: 'stage-lot-1-b', subdivision_id: 'sub-lot-1-b', stage_number: 2, crop_id: 'crop-tomate', variety_id: 'var-tomate-saladette',
    area_ha: 4, planned_sowing_date: '2026-10-01', actual_sowing_date: '2026-10-02', status: 'closed', closed_at: '2026-10-25', crop_name_snapshot: 'Tomate' })
  data.stages.push({ id: 'stage-south', subdivision_id: 'sub-lot-3', stage_number: 1, crop_id: 'crop-pepino', variety_id: 'var-pepino-persian',
    area_ha: 10, planned_sowing_date: '2026-10-01', actual_sowing_date: '2026-10-02', status: 'planted', closed_at: null, crop_name_snapshot: 'Pepino' })
  return data
}

function addRecord(data: WorkspaceData, id: string, options: {
  stageId?: string; date?: string; products?: ProductLine[]; status?: ApplicationTarget['status'];
  order?: Partial<ApplicationOrder>; target?: Partial<ApplicationTarget>
} = {}) {
  const stage = data.stages.find(item => item.id === (options.stageId ?? 'stage-1'))!
  const subdivision = data.subdivisions.find(item => item.id === stage.subdivision_id)!
  const lot = data.lots.find(item => item.id === subdivision.lot_id)!
  const project = data.projects.find(item => item.id === lot.project_id)!
  const status = options.status ?? 'performed', date = options.date ?? '2026-10-10', products = options.products ?? [liquid(100)]
  const order: ApplicationOrder = {
    id: `order-${id}`, folio: `APL-${id}`, project_id: project.id, field_id: lot.field_id, crop_id: stage.crop_id, method_id: 'method-dron',
    indicated_date: date, scheduled_date: '2026-12-31', water_l_ha: 100, observations: '', products,
    project_name: project.name, field_name: lot.field_name_snapshot, ...options.order,
  }
  const target: ApplicationTarget = {
    id, order_id: order.id, stage_id: stage.id, status, lot_name: lot.name, subdivision_name: subdivision.name, stage_number: stage.stage_number,
    crop_name: stage.crop_name_snapshot ?? 'Cultivo conservado', variety_name: '', area_ha: stage.area_ha,
    actual_date: status === 'performed' ? date : null, actual_water_l_ha: status === 'performed' ? 100 : null,
    actual_products: status === 'performed' ? products : [], equipment: '', applicator: '', actual_observations: '', cancellation_reason: '',
    has_changes: false, ...options.target,
  }
  data.applicationOrders.push(order)
  data.applicationTargets.push(target)
  return target
}

function populated() {
  const data = fixture()
  addRecord(data, 'north-a', { products: [liquid(100), solid(50)] })
  addRecord(data, 'north-b', { date: '2026-10-20', products: [liquid(200)] })
  addRecord(data, 'north-c', { stageId: 'stage-lot-1-b', date: '2026-10-21', products: [solid(100)] })
  addRecord(data, 'other-lot', { stageId: 'stage-2', date: '2026-10-30', products: [liquid(1000, 'Nombre más reciente de otro lote')] })
  addRecord(data, 'previous-season', { stageId: 'stage-history', date: '2025-12-12', products: [liquid(10)] })
  addRecord(data, 'south-indicated', { stageId: 'stage-south', status: 'indicated', date: '2026-10-09', products: [liquid(30)] })
  return data
}

test('separa lotes por identidad aunque repitan nombre, campo o temporada y conserva proyectos cerrados y borradores', () => {
  const data = populated(), original = structuredClone(data)
  const result = buildLotUsage(data)
  assert.equal(result.incompleteCount, 0)
  assert.equal(result.lots.length, 4)
  assert.equal(result.lots.filter(lot => lot.name === 'Lote repetido').length, 3)
  assert.equal(new Set(result.lots.map(lot => lot.key)).size, 4)
  assert.ok(result.lots.some(lot => lot.projectId === 'project-history' && lot.season === '2025–2026'))
  assert.ok(result.lots.some(lot => lot.projectId === 'project-culiacan'), 'la planeación con un registro guardado no se oculta')
  const north = result.lots.filter(lot => lot.projectId === 'project-ensenada')
  assert.equal(north.length, 2)
  assert.notEqual(north[0].fieldName, north[1].fieldName)
  assert.deepEqual(data, original)
})

test('resume mezclas y subdivisiones con aplicaciones únicas y superficie configurada sin multiplicarla', () => {
  const result = buildLotUsage(populated())
  const lot = result.lots.find(row => row.lotId === 'lot-1')!
  assert.equal(lot.areaHa, 12, 'no es la suma de superficies repetidas por aplicaciones o productos')
  assert.equal(lot.applicationCount, 3, 'la mezcla de dos productos sigue siendo un solo destino')
  assert.equal(lot.productCount, 2)
  assert.equal(lot.lastRecordedDate, '2026-10-21')
  assert.deepEqual(lot.products.map(product => product.productId), ['product-b', 'product-a'], 'cantidad ascendente con unidades mezcladas')
  const a = lot.products.find(product => product.productId === 'product-a')!
  assert.equal(a.applicationCount, 2)
  assert.equal(a.destinationCount, 1)
  assert.equal(a.totalQuantity, 2400)
  assert.equal(a.accumulatedAreaHa, 16)
  assert.equal(a.averageDose, 150)
  assert.equal(a.name, 'Líquido conservado', 'no toma el nombre más reciente de un lote distinto')
  assert.deepEqual(a.history.map(record => record.targetId), ['north-b', 'north-a'])
  const b = lot.products.find(product => product.productId === 'product-b')!
  assert.equal(b.destinationCount, 2, 'las subdivisiones retiradas y etapas cerradas mantienen su identidad')
  assert.equal(b.totalQuantity, 800)
  assert.equal(b.accumulatedAreaHa, 12)
  assert.equal(b.averageDose, 800 / 12)
  assert.deepEqual(b.history.map(record => record.targetId), ['north-c', 'north-a'])
  assert.ok(lot.products.every(product => product.history.every(record => record.targetId.startsWith('north-'))))
})

test('aplica agrícola, cultivo, etapa y estado antes de agrupar y mantiene los valores solo del lote seleccionado', () => {
  const data = populated()
  assert.equal(buildLotUsage(data, { agriculturalUnitId: 'agri-culiacan' }).lots.length, 1)
  assert.equal(buildLotUsage(data, { status: 'performed' }).lots.length, 3)
  const indicated = buildLotUsage(data, { status: 'indicated' })
  assert.equal(indicated.lots.length, 1)
  assert.equal(indicated.lots[0].lotId, 'lot-3')
  assert.equal(indicated.lots[0].products[0].totalQuantity, 300)
  assert.equal(indicated.lots[0].products[0].history[0].source, 'indication')
  const selected = buildLotUsage(data, { agriculturalUnitId: 'agri-ensenada', cropId: 'crop-tomate', stageNumber: 2 })
  assert.equal(selected.lots.length, 1)
  assert.equal(selected.lots[0].lotId, 'lot-1')
  assert.equal(selected.lots[0].applicationCount, 1)
  assert.equal(selected.lots[0].productCount, 1)
  assert.equal(selected.lots[0].products[0].totalQuantity, 400)
  assert.deepEqual(buildLotUsage(data, { status: 'cancelled' }), { lots: [], incompleteCount: 0 })
})

test('la selección validada conserva revisiones indicadas y canceladas por destino sin usar otra mezcla', () => {
  const data = fixture()
  const pending = addRecord(data, 'pending', { status: 'indicated', date: '2026-10-10', products: [liquid(100)] })
  const cancelled = addRecord(data, 'cancelled', { status: 'cancelled', date: '2026-10-11', products: [liquid(100)] })
  const base = { method_id: 'method-dron', method_name: 'Dron', indicated_date: '2026-10-10', scheduled_date: '2026-10-20', water_l_ha: 100, observations: '', products: [liquid(100)] }
  for (const [target, id, dose, date] of [[pending, 'revision-pending', 50, '2026-10-15'], [cancelled, 'revision-cancelled', 25, '2026-10-12']] as const) {
    target.indication_change_id = id
    data.applicationChanges.push({ id, order_id: target.order_id, target_id: null, kind: 'indication', version: 1, target_ids: [target.id],
      reason: 'Revisión ficticia', changed_by: 'demo-admin', changed_by_name: 'Administración', changed_at: `${date}T12:00:00Z`, before: base,
      after: { ...base, indicated_date: date, products: [solid(dose)] },
    })
  }
  const lot = buildLotUsage(data).lots[0]
  assert.equal(lot.products.length, 1)
  assert.equal(lot.products[0].unit, 'g')
  assert.equal(lot.products[0].totalQuantity, 600)
  assert.deepEqual(lot.products[0].history.map(record => [record.status, record.dose, record.recordDate]), [
    ['indicated', 50, '2026-10-15'], ['cancelled', 25, '2026-10-12'],
  ])
  data.applicationChanges = []
  assert.deepEqual(buildLotUsage(data), { lots: [], incompleteCount: 2 }, 'sin snapshot no vuelve a la indicación base')
})

test('excluye relaciones faltantes o incoherentes una vez por destino sin agrupar por el nombre histórico', () => {
  const data = fixture()
  addRecord(data, 'valid', { products: [liquid(100)] })
  addRecord(data, 'missing-stage', { products: [liquid(100), solid(50)], target: { stage_id: 'missing-stage' } })
  addRecord(data, 'missing-subdivision', { products: [liquid(100), solid(50)] })
  const stage = structuredClone(data.stages[0]); stage.id = 'stage-missing-subdivision'; stage.subdivision_id = 'missing-subdivision'
  data.stages.push(stage)
  data.applicationTargets.find(target => target.id === 'missing-subdivision')!.stage_id = stage.id
  addRecord(data, 'wrong-project', { products: [liquid(100), solid(50)], order: { project_id: 'project-history' } })
  addRecord(data, 'wrong-field', { products: [liquid(100), solid(50)], order: { field_id: 'field-valle' } })
  addRecord(data, 'incomplete-products', { target: { actual_products: [] } })
  const result = buildLotUsage(data)
  assert.equal(result.incompleteCount, 5)
  assert.equal(result.lots.length, 1)
  assert.equal(result.lots[0].applicationCount, 1)
  assert.equal(result.lots[0].products[0].totalQuantity, 800)
  data.lots.find(lot => lot.id === 'lot-1')!.area_ha = NaN
  assert.deepEqual(buildLotUsage(data), { lots: [], incompleteCount: 6 })
})

test('un lote con referencia perdida o un campo de otra agrícola no recibe identidad inventada', () => {
  const data = fixture()
  addRecord(data, 'missing-lot')
  data.subdivisions.find(subdivision => subdivision.id === 'sub-lot-1')!.lot_id = 'missing-lot'
  assert.deepEqual(buildLotUsage(data), { lots: [], incompleteCount: 1 })
  const other = fixture()
  addRecord(other, 'wrong-agricultural-field')
  other.catalogs.fields.find(field => field.id === 'field-norte')!.agricultural_unit_id = 'agri-culiacan'
  assert.deepEqual(buildLotUsage(other), { lots: [], incompleteCount: 1 })
})

test('ordena cantidades ascendentes entre L y kg con desempates estables y mantiene el ranking global por aplicaciones', () => {
  const data = fixture()
  addRecord(data, 'first', { products: [liquid(125, 'Zeta'), solid(62.5, 'Beta')] })
  addRecord(data, 'second', { products: [liquid(125, 'Zeta')] })
  addRecord(data, 'equal-quantity', { products: [{ product_id: 'product-c', product_name: 'Alfa', unit: 'g', dose: 62.5 }] })
  addRecord(data, 'equal-name', { products: [{ product_id: 'product-d', product_name: 'Alfa', unit: 'ml', dose: 62.5 }] })
  const global = buildProductUsage(data)
  assert.equal(global.products[0].productId, 'product-a', 'el ranking conserva aplicaciones descendentes')
  const sorted = [...global.products].sort(compareProductQuantity)
  assert.deepEqual(sorted.map(product => product.productId), ['product-c', 'product-d', 'product-b', 'product-a'])
  assert.deepEqual(sorted.map(product => product.totalQuantity / 1000), [0.5, 0.5, 0.5, 2])
  assert.deepEqual(buildLotUsage(data).lots[0].products.map(product => product.productId), sorted.map(product => product.productId))
  data.applicationTargets.reverse()
  assert.deepEqual(buildLotUsage(data).lots[0].products, buildLotUsage({ ...data, applicationTargets: [...data.applicationTargets].reverse() }).lots[0].products)
})

test('el lector solo agrupa lotes de su workspace autorizado y una consulta vacía no genera resúmenes', () => {
  const data = populated()
  const reader = data.profiles.find(profile => profile.id === DEMO_READER_ID)!
  const result = buildLotUsage(scopeWorkspace(data, reader))
  assert.equal(result.lots.length, 3)
  assert.ok(result.lots.every(lot => lot.agriculturalUnitName === 'Ensenada'))
  assert.equal(buildLotUsage(scopeWorkspace(data, reader), { agriculturalUnitId: 'agri-culiacan' }).lots.length, 0)
  assert.deepEqual(buildLotUsage(createDemoData()), { lots: [], incompleteCount: 0 })
})

test('productos distintos cuenta identidades aunque una unidad histórica requiera filas separadas', () => {
  const data = fixture()
  addRecord(data, 'liquid-snapshot', { products: [liquid(100)] })
  addRecord(data, 'solid-snapshot', { products: [{ ...liquid(50), unit: 'g' }] })
  const lot = buildLotUsage(data).lots[0]
  assert.equal(lot.productCount, 1)
  assert.equal(lot.products.length, 2)
  assert.equal(lot.applicationCount, 2)
  assert.deepEqual(lot.products.map(product => [product.unit, product.totalQuantity]), [['g', 400], ['ml', 800]])
})


test('el lote filtra métricas, productos, ranking e historial por identidad de temporada', () => {
  const data = fixture()
  addRecord(data, 'selected-a', { products: [liquid(100), solid(25)] })
  addRecord(data, 'selected-b', { products: [liquid(200)] })
  addRecord(data, 'other-lot', { stageId: 'stage-2', products: [solid(500)] })
  addRecord(data, 'other-season', { stageId: 'stage-history', products: [solid(900)] })
  const filtered = buildProductUsage(data, { lotId: 'lot-1' })
  assert.equal(filtered.applicationCount, 2)
  assert.equal(filtered.liquidMl, 2400)
  assert.equal(filtered.solidG, 200)
  assert.equal(filtered.products[0].productId, 'product-a')
  assert.equal(filtered.products[0].applicationCount, 2)
  assert.deepEqual(filtered.products.flatMap(product => product.history.map(row => row.targetId)).sort(), ['selected-a', 'selected-a', 'selected-b'])
  const lots = buildLotUsage(data, { lotId: 'lot-1' })
  assert.equal(lots.lots.length, 1)
  assert.equal(lots.lots[0].lotId, 'lot-1')
  assert.equal(lots.lots[0].applicationCount, filtered.applicationCount)
  assert.equal(lots.lots[0].products.find(product => product.productId === 'product-a')!.totalQuantity, 2400)
  assert.equal(buildProductUsage(data, { lotId: 'lot-history' }).solidG, 18000)
  assert.equal(buildProductUsage(data).applicationCount, 4)
})

test('el filtro por lote se cruza con cultivo, etapa, estado y agrícola sin perder retiradas', () => {
  const data = fixture()
  addRecord(data, 'actual', { products: [liquid(100)] })
  addRecord(data, 'pending', { status: 'indicated', products: [liquid(20)] })
  addRecord(data, 'cancelled', { stageId: 'stage-lot-1-b', status: 'cancelled', products: [solid(50)] })
  assert.equal(buildProductUsage(data, { lotId: 'lot-1' }).applicationCount, 3)
  const filtered = buildProductUsage(data, { lotId: 'lot-1', cropId: 'crop-tomate', stageNumber: 2, status: 'cancelled', agriculturalUnitId: 'agri-ensenada' })
  assert.equal(filtered.applicationCount, 1)
  assert.equal(filtered.solidG, 200)
  assert.equal(filtered.products[0].history[0].status, 'cancelled')
  assert.equal(buildLotUsage(data, { lotId: 'lot-1', status: 'performed' }).lots[0].applicationCount, 1)
  assert.equal(buildProductUsage(data, { lotId: 'lot-1', agriculturalUnitId: 'agri-culiacan' }).applicationCount, 0)
  assert.equal(buildProductUsage(data, { lotId: 'lot-1', cropId: 'crop-pepino', stageNumber: 2 }).applicationCount, 0)
})

test('lote inexistente o relación ajena nunca amplían el resumen general ni el ranking', () => {
  const data = fixture()
  addRecord(data, 'missing-stage', { target: { stage_id: 'missing' } })
  addRecord(data, 'foreign-project', { order: { project_id: 'project-culiacan', field_id: 'field-rio' } })
  for (const lotId of ['lot-1', 'missing-lot', '__proto__']) {
    const result = buildProductUsage(data, { lotId })
    assert.equal(result.applicationCount, 0)
    assert.deepEqual(result.products, [])
    assert.equal(buildLotUsage(data, { lotId }).lots.length, 0)
  }
})

test('el lector solo puede filtrar los lotes presentes en su workspace autorizado', () => {
  const data = fixture()
  addRecord(data, 'assigned')
  addRecord(data, 'foreign', { stageId: 'stage-south' })
  const reader = data.profiles.find(profile => profile.id === DEMO_READER_ID)!
  const authorized = scopeWorkspace(data, reader)
  assert.equal(buildProductUsage(authorized, { lotId: 'lot-1' }).applicationCount, 1)
  assert.equal(buildProductUsage(authorized, { lotId: 'lot-3' }).applicationCount, 0)
  assert.equal(buildLotUsage(authorized, { lotId: 'lot-3' }).lots.length, 0)
})
