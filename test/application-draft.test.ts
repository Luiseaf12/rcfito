import assert from 'node:assert/strict'
import test from 'node:test'
import { applicationDraftIssues, type ApplicationDraftForm, type ApplicationDraftProduct } from '../src/domain/application-draft.ts'
import { emptyWorkspace, type ApplicationTarget, type WorkspaceData } from '../src/domain/model.ts'

// Only fictitious in-memory data; never reach Auth, provider, Docker or operation.
function fixture() {
  const data = emptyWorkspace()
  data.catalogs.agricultural_units = [{ id: 'agri', name: 'Agrícola de ejemplo', active: true }, { id: 'other-agri', name: 'Otra agrícola ficticia', active: true }]
  data.catalogs.fields = [{ id: 'field', name: 'Campo de ejemplo', agricultural_unit_id: 'agri', active: true }, { id: 'other-field', name: 'Otro campo ficticio', agricultural_unit_id: 'other-agri', active: true }]
  data.catalogs.crops = [{ id: 'crop', name: 'Cultivo de ejemplo', active: true }, { id: 'other-crop', name: 'Otro cultivo ficticio', active: true }]
  data.catalogs.application_methods = [{ id: 'method', name: 'Medio de ejemplo', active: true }]
  data.catalogs.products = [{ id: 'liquid', name: 'Líquido de ejemplo', active: true, unit: 'ml', default_dose: 999 }, { id: 'solid', name: 'Sólido de ejemplo', active: true, unit: 'g', default_dose: 700 }]
  data.projects = [{ id: 'project', agricultural_unit_id: 'agri', name: 'Temporada ficticia', season: '2026', status: 'active' }]
  data.lots = [1, 2].map(number => ({ id: `lot-${number}`, project_id: 'project', field_id: 'field', name: `Malla de ejemplo ${number}`, area_ha: 1, infrastructure_type_id: 'infra', active: true }))
  data.subdivisions = [1, 2].map(number => ({ id: `sub-${number}`, lot_id: `lot-${number}`, name: 'Completa', area_ha: 1, active: true }))
  data.stages = [1, 2].map(number => ({ id: `stage-${number}`, subdivision_id: `sub-${number}`, stage_number: 2, crop_id: 'crop', variety_id: 'variety', area_ha: 1, planned_sowing_date: '2026-10-01', actual_sowing_date: '2026-10-03', closed_at: null, status: 'planted' }))
  return data
}
function form(overrides: Partial<ApplicationDraftForm> = {}): ApplicationDraftForm {
  return { project_id: 'project', field_id: 'field', crop_id: 'crop', method_id: 'method', indicated_date: '2026-10-10', scheduled_date: '2026-10-11', water_l_ha: '660', observations: '  Nota ficticia\nSegunda línea\n', application_number: '1', ...overrides }
}
function rows(): ApplicationDraftProduct[] {
  return [{ product_id: 'liquid', dose: '333', sourceName: 'Líquido de ejemplo', importUnit: 'ml' }, { product_id: 'solid', dose: '2000', sourceName: 'Sólido de ejemplo', importUnit: 'g' }]
}
const review = (overrides: Partial<Parameters<typeof applicationDraftIssues>[4]> = {}) => ({ imported: true, unresolvedDestinations: [] as string[], destinationsReviewed: false, numberReviewed: false, ...overrides })
function target(data: WorkspaceData, stageId: string, number?: number, status: ApplicationTarget['status'] = 'indicated') {
  const row: ApplicationTarget = { id: `target-${stageId}-${data.applicationTargets.length}`, order_id: 'historic-order', stage_id: stageId, application_number: number, status, lot_name: 'Malla de ejemplo', subdivision_name: 'Completa', stage_number: 2, crop_name: 'Cultivo de ejemplo', variety_name: 'Variedad ficticia', area_ha: 1, actual_date: null, actual_water_l_ha: null, actual_products: [], equipment: '', applicator: '', actual_observations: '', cancellation_reason: status === 'cancelled' ? 'Motivo ficticio' : '', has_changes: false }
  data.applicationTargets.push(row)
}
const fields = (issues: ReturnType<typeof applicationDraftIssues>) => issues.map(issue => issue.field)

test('borrador completo no tiene bloqueos y conserva dosis, unidades, nota e historial', () => {
  const data = fixture(), input = form(), products = rows(), selected = ['stage-1', 'stage-2'], checks = review()
  const original = structuredClone({ data, input, products, selected, checks })
  assert.deepEqual(applicationDraftIssues(data, input, products, selected, checks), [])
  assert.deepEqual({ data, input, products, selected, checks }, original)
  assert.equal(products[0].dose, '333')
  assert.equal(data.catalogs.products[0].default_dose, 999)
})

test('borrador vacío indica cada campo pendiente sin exigir una nota opcional', () => {
  const input = Object.fromEntries(Object.keys(form()).map(key => [key, ''])) as ApplicationDraftForm
  const issues = applicationDraftIssues(fixture(), input, [{ product_id: '', dose: '' }], [], review())
  assert.deepEqual(new Set(fields(issues)), new Set(['project_id', 'field_id', 'crop_id', 'method_id', 'indicated_date', 'scheduled_date', 'water_l_ha', 'application_number', 'destinations', 'product:0', 'dose:0']))
  assert.ok(issues.find(issue => issue.field === 'product:0')?.message.includes('Renglón 1'))
  assert.equal(issues.some(issue => issue.field === 'observations'), false)
  assert.equal(issues.some(issue => issue.field === 'number_review'), false)
  assert.equal(new Set(fields(issues)).size, issues.length, 'cada campo tiene un único mensaje consolidado')
})

test('proyecto, agrícola, campo, cultivo y medio tienen que seguir activos y relacionados', () => {
  const cases: [string, (data: WorkspaceData) => void][] = [
    ['project_id', data => { data.projects[0].status = 'closed' }],
    ['project_id', data => { data.catalogs.agricultural_units[0].active = false }],
    ['field_id', data => { data.catalogs.fields[0].active = false }],
    ['field_id', data => { data.catalogs.fields[0].agricultural_unit_id = 'other-agri' }],
    ['crop_id', data => { data.catalogs.crops[0].active = false }],
    ['method_id', data => { data.catalogs.application_methods[0].active = false }],
  ]
  for (const [field, change] of cases) {
    const data = fixture(); change(data)
    assert.ok(fields(applicationDraftIssues(data, form(), rows(), ['stage-1'], review())).includes(field), field)
  }
  for (const field of ['project_id', 'field_id', 'crop_id', 'method_id'] as const) assert.ok(fields(applicationDraftIssues(fixture(), form({ [field]: 'missing' }), rows(), ['stage-1'], review())).includes(field))
})

test('la selección no admite destinos repetidos, desaparecidos, cerrados o fuera de contexto', () => {
  for (const selected of [[], ['stage-1', 'stage-1'], ['missing-stage']]) assert.ok(fields(applicationDraftIssues(fixture(), form(), rows(), selected, review())).includes('destinations'))
  const changes: ((data: WorkspaceData) => void)[] = [
    data => { data.stages[0].status = 'planned' }, data => { data.stages[0].status = 'closed' },
    data => { data.stages[0].closed_at = '2026-10-09' }, data => { data.lots[0].active = false },
    data => { data.subdivisions[0].active = false }, data => { data.stages[0].actual_sowing_date = null },
    data => { data.stages[0].actual_sowing_date = '2026-02-30' }, data => { data.stages[0].area_ha = 0 },
    data => { data.lots[0].project_id = 'other-project' }, data => { data.lots[0].field_id = 'other-field' },
    data => { data.stages[0].crop_id = 'other-crop' }, data => { data.subdivisions = data.subdivisions.slice(1) },
  ]
  for (const change of changes) {
    const data = fixture(); change(data)
    const issue = applicationDraftIssues(data, form(), rows(), ['stage-1'], review()).find(issue => issue.field === 'destinations')
    assert.ok(issue, change.toString())
    assert.match(issue.message, /Malla de ejemplo 1|destino 1/)
  }
})

test('las fechas se validan por calendario, orden y siembra real de todos los destinos', () => {
  for (const indicated_date of ['', '2026-02-30', '2026-13-01', '31/10/2026', '0000-01-01']) assert.ok(fields(applicationDraftIssues(fixture(), form({ indicated_date }), rows(), ['stage-1'], review())).includes('indicated_date'))
  for (const scheduled_date of ['', '2026-02-30', '2026-01-01']) assert.ok(fields(applicationDraftIssues(fixture(), form({ scheduled_date }), rows(), ['stage-1'], review())).includes('scheduled_date'))
  assert.deepEqual(applicationDraftIssues(fixture(), form({ indicated_date: '2028-02-29', scheduled_date: '2028-02-29' }), rows(), ['stage-1'], review()), [])
  const data = fixture(); data.stages[1].actual_sowing_date = '2026-10-12'
  const issues = applicationDraftIssues(data, form(), rows(), ['stage-1', 'stage-2'], review())
  assert.match(issues.find(issue => issue.field === 'indicated_date')!.message, /Malla de ejemplo 2.*2026-10-12/)
})

test('cada dosis pendiente o incorrecta identifica su renglón y conserva el texto capturado', () => {
  for (const dose of ['', ' ', 'cero', 'NaN', 'Infinity', '0', '-1', '0.0000001', '1.1234567', '100000000']) {
    const products = rows(); products[0].dose = dose
    const before = structuredClone(products)
    const issues = applicationDraftIssues(fixture(), form(), products, ['stage-1'], review())
    assert.match(issues.find(issue => issue.field === 'dose:0')!.message, /renglón 1/)
    assert.deepEqual(products, before)
  }
  for (const dose of ['0.000001', '1.123456', '99999999.999999']) {
    const products = rows(); products[0].dose = dose
    assert.equal(fields(applicationDraftIssues(fixture(), form(), products, ['stage-1'], review())).includes('dose:0'), false)
  }
})

test('el agua usa litros por hectárea positivos con cuatro decimales y límite SQL', () => {
  for (const water_l_ha of ['', ' ', 'cero', 'Infinity', '0', '-2', '0.00001', '660.00001', '100000000']) assert.ok(fields(applicationDraftIssues(fixture(), form({ water_l_ha }), rows(), ['stage-1'], review())).includes('water_l_ha'))
  for (const water_l_ha of ['0.0001', '660.1234', '99999999.9999']) assert.equal(fields(applicationDraftIssues(fixture(), form({ water_l_ha }), rows(), ['stage-1'], review())).includes('water_l_ha'), false)
})

test('productos activos y sin repetir; una mezcla vacía tiene un bloqueo explícito', () => {
  assert.ok(fields(applicationDraftIssues(fixture(), form(), [], ['stage-1'], review())).includes('products'))
  const data = fixture(); data.catalogs.products[0].active = false
  assert.ok(fields(applicationDraftIssues(data, form(), rows(), ['stage-1'], review())).includes('product:0'))
  const unknown = rows(); unknown[0].product_id = 'missing'
  assert.ok(fields(applicationDraftIssues(fixture(), form(), unknown, ['stage-1'], review())).includes('product:0'))
  const duplicate = [rows()[0], { ...rows()[0], dose: '200' }]
  const issues = applicationDraftIssues(fixture(), form(), duplicate, ['stage-1'], review())
  assert.match(issues.find(issue => issue.field === 'product:1')!.message, /repetido en el renglón 1/)
})

test('unidades ausentes o incompatibles se aclaran sin transformar gramos y mililitros', () => {
  for (const importUnit of [null, undefined, 'g'] as const) {
    const products = rows(); products[0].importUnit = importUnit
    const before = structuredClone(products)
    const issues = applicationDraftIssues(fixture(), form(), products, ['stage-1'], review())
    assert.match(issues.find(issue => issue.field === 'unit:0')!.message, /Renglón 1.*unidad/)
    assert.deepEqual(products, before)
  }
  const data = fixture(); data.catalogs.products[0].unit = undefined
  assert.ok(fields(applicationDraftIssues(data, form(), rows(), ['stage-1'], review())).includes('unit:0'))
  assert.deepEqual(applicationDraftIssues(fixture(), form(), [{ product_id: 'liquid', dose: '333' }], ['stage-1'], review()), [], 'una fila agregada manualmente toma su unidad del catálogo')
  const manual = rows(); manual[0].importUnit = 'g'
  assert.equal(fields(applicationDraftIssues(fixture(), form(), manual, ['stage-1'], review({ imported: false }))).includes('unit:0'), false)
})

test('nota opcional conserva saltos y espacios y solo bloquea exceso o caracteres nulos', () => {
  for (const observations of ['', '  Nota de ejemplo\nSegunda línea\n', 'x'.repeat(4000)]) {
    const input = form({ observations })
    assert.deepEqual(applicationDraftIssues(fixture(), input, rows(), ['stage-1'], review()), [])
    assert.equal(input.observations, observations)
  }
  for (const observations of ['x'.repeat(4001), 'Nota\u0000 inválida']) assert.ok(fields(applicationDraftIssues(fixture(), form({ observations }), rows(), ['stage-1'], review())).includes('observations'))
})

test('número obligatorio importado y formato inválido tienen un bloqueo propio sin pedir confirmación', () => {
  for (const application_number of ['', ' ', '0', '-1', '1.5', '9na', 'Infinity', '2147483648']) {
    const issues = applicationDraftIssues(fixture(), form({ application_number }), rows(), ['stage-1'], review())
    assert.ok(fields(issues).includes('application_number'), application_number)
    assert.equal(fields(issues).includes('number_review'), false, application_number)
  }
  assert.deepEqual(applicationDraftIssues(fixture(), form({ application_number: '2147483647' }), rows(), ['stage-1'], review({ numberReviewed: true })), [])
})

test('número duplicado incluso cancelado bloquea y nunca se resuelve con confirmar salto', () => {
  for (const status of ['indicated', 'performed', 'cancelled'] as const) {
    const data = fixture(); target(data, 'stage-1', 9, status)
    const issues = applicationDraftIssues(data, form({ application_number: '9' }), rows(), ['stage-1', 'stage-2'], review({ numberReviewed: true }))
    assert.match(issues.find(issue => issue.field === 'application_number')!.message, /aplicación 9 ya está registrada.*Malla de ejemplo 1/)
    assert.equal(fields(issues).includes('number_review'), false)
  }
  const data = fixture(); target(data, 'stage-1', 9); data.stages[0].status = 'closed'
  const issues = applicationDraftIssues(data, form({ application_number: '9' }), rows(), ['stage-1', 'stage-2'], review())
  assert.ok(fields(issues).includes('application_number'))
  assert.ok(fields(issues).includes('destinations'))
  assert.equal(fields(issues).includes('number_review'), false, 'un destino inválido no debe ocultar un número duplicado de esa selección')
})

test('salto de número pide revisión por etapa y al confirmar no inventa conteos anteriores', () => {
  const data = fixture(); target(data, 'stage-1', 7)
  const issues = applicationDraftIssues(data, form({ application_number: '23' }), rows(), ['stage-1', 'stage-2'], review())
  const issue = issues.find(issue => issue.field === 'number_review')!
  assert.match(issue.message, /aplicación 23/)
  assert.match(issue.message, /Malla de ejemplo 1.*siguiente disponible: 8/)
  assert.match(issue.message, /Malla de ejemplo 2.*siguiente disponible: 1/)
  assert.deepEqual(applicationDraftIssues(data, form({ application_number: '23' }), rows(), ['stage-1', 'stage-2'], review({ numberReviewed: true })), [])
  assert.equal(data.applicationTargets.length, 1)
})

test('numeración automática manual admite vacío y señala una etapa agotada', () => {
  const data = fixture(); target(data, 'stage-1', 4)
  const checks = review({ imported: false })
  assert.deepEqual(applicationDraftIssues(data, form({ application_number: '' }), rows(), ['stage-1', 'stage-2'], checks), [])
  target(data, 'stage-2', 2_147_483_647)
  const issues = applicationDraftIssues(data, form({ application_number: '' }), rows(), ['stage-1', 'stage-2'], checks)
  assert.match(issues.find(issue => issue.field === 'application_number')!.message, /alcanzó su límite.*Malla de ejemplo 2/)
  assert.equal(fields(issues).includes('number_review'), false)
})

test('numeración legado usa el helper existente para detectar duplicados', () => {
  const data = fixture(); target(data, 'stage-1')
  assert.ok(fields(applicationDraftIssues(data, form(), rows(), ['stage-1'], review())).includes('application_number'))
})

test('los destinos sin coincidencia única tienen una confirmación precisa y separada', () => {
  const checks = review({ unresolvedDestinations: ['Malla de ejemplo 7', 'Malla de ejemplo 8'] })
  const issues = applicationDraftIssues(fixture(), form(), rows(), ['stage-1'], checks)
  assert.match(issues.find(issue => issue.field === 'destinations_review')!.message, /Malla de ejemplo 7, Malla de ejemplo 8/)
  assert.deepEqual(applicationDraftIssues(fixture(), form(), rows(), ['stage-1'], { ...checks, destinationsReviewed: true }), [])
  assert.deepEqual(applicationDraftIssues(fixture(), form(), rows(), ['stage-1'], { ...checks, imported: false }), [])
})
