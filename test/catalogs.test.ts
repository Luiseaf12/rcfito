import assert from 'node:assert/strict'
import test from 'node:test'
import { createDemoData, DEMO_ADMIN_ID, DEMO_READER_ID } from '../src/domain/demo.ts'
import { catalogKinds } from '../src/domain/model.ts'
import { applyCommand } from '../src/domain/rules.ts'
import { catalogEditLocks, catalogRelationOptions, validateCatalogEdit } from '../src/domain/catalogs.ts'
import { createClient } from '@supabase/supabase-js'
import { loadCatalogProductUsage } from '../src/data/catalog-usage.ts'

for (const kind of catalogKinds) {
  test(`${kind}: permite editar nombre/estado, conserva identidad, referencias e historial y rechaza lector`, () => {
    const data = createDemoData()
    const original = structuredClone(data)
    const admin = data.profiles.find(profile => profile.id === DEMO_ADMIN_ID)!
    const reader = data.profiles.find(profile => profile.id === DEMO_READER_ID)!
    const record = data.catalogs[kind][0]
    const command = { type: 'save_catalog' as const, kind, record: { ...record, name: `${record.name} corregido`, active: false } }
    assert.throws(() => applyCommand(data, command, reader), /consulta/)
    const next = applyCommand(data, command, admin)
    assert.deepEqual(next.catalogs[kind][0], command.record)
    assert.deepEqual(next.catalogs[kind].slice(1), data.catalogs[kind].slice(1))
    assert.deepEqual({ ...next, catalogs: data.catalogs }, data, 'editar no reescribe proyectos, lotes, etapas ni aplicaciones')
    assert.deepEqual(data, original)
  })
}

test('campo y variedad usados bloquean solo su relación, incluso si el uso ya es histórico', () => {
  const data = createDemoData()
  const admin = data.profiles.find(profile => profile.id === DEMO_ADMIN_ID)!
  data.lots = data.lots.filter(lot => lot.id === 'lot-history')
  data.stages = data.stages.filter(stage => stage.status === 'closed')
  const field = data.catalogs.fields.find(row => row.id === 'field-norte')!
  const variety = data.catalogs.varieties.find(row => row.id === 'var-pepino-persian')!
  assert.match(catalogEditLocks(data, 'fields', field).agricultural_unit_id!, /lotes relacionados/)
  assert.match(catalogEditLocks(data, 'varieties', variety).crop_id!, /etapas de siembra/)
  assert.throws(() => applyCommand(data, { type: 'save_catalog', kind: 'fields', record: { ...field, agricultural_unit_id: 'agri-culiacan' } }, admin), /agrícola no puede cambiar/)
  assert.throws(() => applyCommand(data, { type: 'save_catalog', kind: 'varieties', record: { ...variety, crop_id: 'crop-tomate' } }, admin), /cultivo no puede cambiar/)
  assert.deepEqual(catalogEditLocks(data, 'fields'), {})
  assert.deepEqual(catalogEditLocks(data, 'varieties', data.catalogs.varieties.find(row => row.id === 'var-pepino-slicer')), {})
})

test('sin uso permite cambiar agrícola, cultivo y unidad', () => {
  const data = createDemoData()
  data.lots = []; data.stages = []
  const admin = data.profiles.find(profile => profile.id === DEMO_ADMIN_ID)!
  const field = data.catalogs.fields[0]
  const variety = data.catalogs.varieties[0]
  const product = data.catalogs.products[0]
  let next = applyCommand(data, { type: 'save_catalog', kind: 'fields', record: { ...field, agricultural_unit_id: 'agri-culiacan' } }, admin)
  next = applyCommand(next, { type: 'save_catalog', kind: 'varieties', record: { ...variety, crop_id: 'crop-tomate' } }, admin)
  next = applyCommand(next, { type: 'save_catalog', kind: 'products', record: { ...product, unit: 'g' } }, admin)
  assert.equal(next.catalogs.fields[0].agricultural_unit_id, 'agri-culiacan')
  assert.equal(next.catalogs.varieties[0].crop_id, 'crop-tomate')
  assert.equal(next.catalogs.products[0].unit, 'g')
})

test('producto indicado o solo realizado bloquea unidad; composición y dosis siguen editables', () => {
  const data = createDemoData()
  const product = data.catalogs.products[0]
  for (const usage of [
    { applicationOrders: [{ products: [{ product_id: product.id }] }] },
    { applicationTargets: [{ actual_products: [{ product_id: product.id }] }] },
  ]) {
    const context = { ...data, ...usage }
    assert.match(catalogEditLocks(context, 'products', product).unit!, /unidad no puede cambiar/)
    assert.match(validateCatalogEdit(context, 'products', { ...product, unit: 'g' }).unit, /unidad no puede cambiar/)
    assert.deepEqual(validateCatalogEdit(context, 'products', { ...product, default_dose: 120, ingredients: [{ ingredient_id: 'ingredient-b', concentration: '20 g/L' }] }), {})
    assert.deepEqual(catalogEditLocks(context, 'products', data.catalogs.products[1]), {})
  }
})

test('conserva relaciones inactivas existentes y excluye otras de las opciones y de nuevas capturas', () => {
  const data = createDemoData()
  const admin = data.profiles.find(profile => profile.id === DEMO_ADMIN_ID)!
  for (const kind of ['agricultural_units', 'crops', 'brands', 'product_families', 'active_ingredients'] as const) {
    data.catalogs[kind].forEach(row => { row.active = false })
  }
  for (const kind of ['fields', 'varieties', 'products'] as const) {
    const record = data.catalogs[kind][0]
    assert.doesNotThrow(() => applyCommand(data, { type: 'save_catalog', kind, record: { ...record, name: `${record.name} corregido` } }, admin))
    assert.ok(Object.keys(validateCatalogEdit(data, kind, { ...record, id: 'nuevo' })).length, 'alta no hereda referencias inactivas')
  }
  const product = data.catalogs.products[0]
  const choices = catalogRelationOptions(data.catalogs.active_ingredients, product.ingredients!.map(item => item.ingredient_id))
  assert.deepEqual(choices.map(choice => choice.value), ['ingredient-a'])
  assert.match(choices[0].label, /inactivo/)
  assert.deepEqual(catalogRelationOptions(data.catalogs.active_ingredients), [])
  assert.ok(validateCatalogEdit(data, 'products', { ...product, ingredients: [{ ingredient_id: 'ingredient-b', concentration: null }] }).ingredients)
})

test('errores de nombre, dosis y composición se asocian a su campo', () => {
  const data = createDemoData()
  const product = data.catalogs.products[0]
  assert.ok(validateCatalogEdit(data, 'products', { ...product, name: '  ' }).name)
  assert.ok(validateCatalogEdit(data, 'products', { ...product, id: 'otro', name: `  ${product.name.toUpperCase()}  ` }).name)
  assert.ok(validateCatalogEdit(data, 'products', { ...product, default_dose: -1 }).default_dose)
  assert.ok(validateCatalogEdit(data, 'products', { ...product, default_dose: NaN }).default_dose)
  assert.ok(validateCatalogEdit(data, 'products', { ...product, ingredients: [{ ingredient_id: '', concentration: null }] }).ingredients)
  assert.ok(validateCatalogEdit(data, 'products', { ...product, ingredients: [product.ingredients![0], product.ingredients![0]] }).ingredients)
})

test('la consulta de uso pagina indicación/realización y bloquea unidad sin cargar las pantallas de aplicaciones', async () => {
  const requests: string[] = []
  const client = createClient('http://127.0.0.1:5199', 'clave-publica-ficticia', {
    auth: { persistSession: false }, global: { fetch: async (input, init) => {
      const url = new URL(String(input)); requests.push(url.pathname + url.search)
      const range = new Headers(init?.headers).get('range')
      const start = url.searchParams.get('offset') ?? range?.split('-')[0] ?? '0'
      const rows = url.pathname.endsWith('application_order_products')
        ? start === '0' ? Array.from({ length: 500 }, () => ({ product_id: 'product-a' })) : [{ product_id: 'product-b' }]
        : [{ product_id: 'product-c' }]
      return new Response(JSON.stringify(rows), { status: 200, headers: { 'content-type': 'application/json' } })
    } },
  })
  const used = await loadCatalogProductUsage(client)
  assert.deepEqual([...used].sort(), ['product-a', 'product-b', 'product-c'])
  assert.equal(requests.length, 3)
  assert.ok(requests.every(url => url.includes('select=product_id')))
  const data = createDemoData()
  const product = { ...data.catalogs.products[0], unit_locked: used.has('product-a') }
  assert.ok(catalogEditLocks(data, 'products', product).unit)
})

test('uso ausente en esquema anterior es compatible; fallas de permisos o red no desbloquean unidades', async () => {
  const client = (code: string, status: number) => createClient('http://127.0.0.1:5199', 'clave-publica-ficticia', {
    auth: { persistSession: false }, global: { fetch: async () => new Response(JSON.stringify({ code, message: 'Error de prueba' }), { status, headers: { 'content-type': 'application/json' } }) },
  })
  assert.equal((await loadCatalogProductUsage(client('PGRST205', 404))).size, 0)
  await assert.rejects(loadCatalogProductUsage(client('42501', 403)), /comprobar el uso/)
})
