import assert from 'node:assert/strict'
import test from 'node:test'
import { applyApplicationCommand, stageApplicationCounts } from '../src/domain/applications.ts'
import { applyApplicationEditing, currentOrderIndication, indicationForTarget } from '../src/domain/application-editing.ts'
import { emptyWorkspace, type ApplicationCorrectionInput, type ApplicationOrderInput, type ApplicationPerformanceInput, type ApplicationRevisionInput, type UserProfile, type WorkspaceCommand, type WorkspaceData } from '../src/domain/model.ts'

// All values are fictitious and remain in memory; no network, APIs or operation.
const admin: UserProfile = { id: 'admin-demo', full_name: 'Administración de ejemplo', role: 'admin' }
const reader: UserProfile = { id: 'reader-demo', full_name: 'Consulta de ejemplo', role: 'reader' }
function apply(data: WorkspaceData, command: WorkspaceCommand, profile = admin) {
  const next = structuredClone(data)
  if (!applyApplicationCommand(next, command, profile)) throw new Error('Comando de prueba no reconocido')
  return next
}
function fixture() {
  const data = emptyWorkspace()
  data.catalogs.agricultural_units = [{ id: 'agri', name: 'Agrícola ficticia', active: true }]
  data.catalogs.fields = [{ id: 'field', name: 'Campo ficticio', agricultural_unit_id: 'agri', active: true }]
  data.catalogs.crops = [{ id: 'crop', name: 'Cultivo ficticio', active: true }]
  data.catalogs.varieties = [{ id: 'variety', name: 'Variedad ficticia', crop_id: 'crop', active: true }]
  data.catalogs.application_methods = [{ id: 'method-a', name: 'Medio inicial ficticio', active: true }, { id: 'method-b', name: 'Medio alterno ficticio', active: true }]
  data.catalogs.products = [{ id: 'liquid', name: 'Líquido ficticio', unit: 'ml', active: true, default_dose: 900 }, { id: 'solid', name: 'Sólido ficticio', unit: 'g', active: true, default_dose: 800 }, { id: 'new-product', name: 'Nuevo producto ficticio', unit: 'ml', active: true }, { id: 'inactive-product', name: 'Producto retirado ficticio', unit: 'g', active: false }]
  data.projects = [{ id: 'project', agricultural_unit_id: 'agri', name: 'Temporada ficticia', season: '2026', status: 'active' }]
  data.lots = [1, 2, 3, 4].map(number => ({ id: `lot-${number}`, project_id: 'project', field_id: 'field', name: `Malla ficticia ${number}`, area_ha: 1, infrastructure_type_id: 'infra', active: true }))
  data.subdivisions = [1, 2, 3, 4].map(number => ({ id: `sub-${number}`, lot_id: `lot-${number}`, name: 'Completa', area_ha: 1, active: true }))
  data.stages = [1, 2, 3, 4].map(number => ({ id: `stage-${number}`, subdivision_id: `sub-${number}`, stage_number: 2, crop_id: 'crop', variety_id: 'variety', area_ha: 1, planned_sowing_date: '2026-10-01', actual_sowing_date: '2026-10-02', closed_at: null, status: 'planted' }))
  const record: ApplicationOrderInput = { id: 'order', project_id: 'project', field_id: 'field', crop_id: 'crop', method_id: 'method-a', indicated_date: '2026-10-05', scheduled_date: '2026-10-06', water_l_ha: 120, observations: '  Nota inicial\nSegunda línea\n', source_text: 'Mensaje fuente ficticio original.', application_number: 23, stage_ids: data.stages.map(stage => stage.id), products: [{ product_id: 'liquid', dose: 250 }, { product_id: 'solid', dose: 35 }] }
  return { data: apply(data, { type: 'create_application_order', record }), record }
}
const targetFor = (data: WorkspaceData, number: number) => data.applicationTargets.find(target => target.stage_id === `stage-${number}`)!
function perform(data: WorkspaceData, numbers: number[], values: Partial<ApplicationPerformanceInput> = {}): WorkspaceCommand {
  return { type: 'perform_application_targets', order_id: 'order', target_ids: numbers.map(number => targetFor(data, number).id), data: { actual_date: '2026-10-10', equipment: 'Equipo ficticio', applicator: '', observations: 'Realización ficticia', changed: false, ...values } }
}
function mixed() {
  let { data, record } = fixture()
  data = apply(data, perform(data, [1]))
  data = apply(data, { type: 'cancel_application_targets', order_id: 'order', target_ids: [targetFor(data, 2).id], reason: 'Cancelación ficticia' })
  return { data, record }
}
function revision(data: WorkspaceData, overrides: Partial<ApplicationRevisionInput> = {}): ApplicationRevisionInput {
  return { id: crypto.randomUUID(), order_id: 'order', expected_revision: data.applicationOrders[0].revision ?? 0, target_ids: data.applicationTargets.filter(target => target.status === 'indicated').map(target => target.id), method_id: 'method-b', indicated_date: '2026-10-09', scheduled_date: '2026-10-11', water_l_ha: 180, observations: '  Nota revisada\nCon saltos\n', reason: '  Ajuste ficticio de la indicación  ', products: [{ product_id: 'liquid', dose: 300 }, { product_id: 'solid', dose: 40 }, { product_id: 'new-product', dose: 20 }], ...overrides }
}
function revise(data: WorkspaceData, record = revision(data)) { return apply(data, { type: 'revise_application_order', record }) }
function correction(data: WorkspaceData, targetNumber: number, overrides: Partial<ApplicationCorrectionInput> = {}): ApplicationCorrectionInput {
  const target = targetFor(data, targetNumber)
  return { id: crypto.randomUUID(), target_id: target.id, expected_version: target.correction_version ?? 0, actual_date: '2026-10-12', water_l_ha: 200, equipment: ' Equipo corregido ficticio ', applicator: ' Persona ficticia ', observations: '  Nota real corregida\nSegunda línea\n', reason: '  Corrección ficticia de captura  ', products: target.actual_products.map(product => ({ product_id: product.product_id, dose: product.dose + 1 })), ...overrides }
}
function correct(data: WorkspaceData, targetNumber = 1, record = correction(data, targetNumber)) { return apply(data, { type: 'correct_application_target', record }) }

test('revisar conserva la orden base, estados terminales, números y superficies; registra snapshots y autor', () => {
  const { data } = mixed(), before = structuredClone(data), record = revision(data)
  const next = revise(data, record)
  assert.deepEqual(data, before)
  assert.equal(next.applicationOrders[0].revision, 1)
  assert.deepEqual({ ...next.applicationOrders[0], revision: 0 }, before.applicationOrders[0])
  assert.deepEqual(targetFor(next, 1), targetFor(before, 1))
  assert.deepEqual(targetFor(next, 2), targetFor(before, 2))
  for (const number of [3, 4]) assert.deepEqual(targetFor(next, number), { ...targetFor(before, number), indication_change_id: record.id })
  const event = next.applicationChanges[0]
  assert.equal(event.kind, 'indication'); assert.equal(event.version, 1); assert.equal(event.target_id, null)
  assert.equal(event.reason, 'Ajuste ficticio de la indicación'); assert.equal(event.changed_by, admin.id); assert.equal(event.changed_by_name, admin.full_name)
  assert.ok(Number.isFinite(Date.parse(event.changed_at)))
  assert.deepEqual(event.before, currentOrderIndication(before, before.applicationOrders[0]))
  assert.equal('observations' in event.after && event.after.observations, record.observations)
  assert.equal(next.applicationOrders[0].source_text, before.applicationOrders[0].source_text)
  assert.deepEqual(next.catalogs.products, before.catalogs.products)
  for (const stage of next.stages) assert.deepEqual(stageApplicationCounts(next, stage.id), stageApplicationCounts(before, stage.id))
})

test('revisión exige todos y solo los pendientes y CAS actualizado sin cambios parciales', () => {
  const { data } = mixed()
  for (const overrides of [
    { target_ids: [targetFor(data, 3).id] }, { target_ids: [targetFor(data, 1).id, targetFor(data, 3).id, targetFor(data, 4).id] },
    { target_ids: [] }, { target_ids: [targetFor(data, 3).id, targetFor(data, 3).id] }, { expected_revision: 1 },
  ]) {
    const before = structuredClone(data)
    assert.throws(() => revise(data, revision(data, overrides)), /destinos|repet|cambió/i)
    assert.deepEqual(data, before)
  }
  let noPending = data
  noPending = apply(noPending, { type: 'cancel_application_targets', order_id: 'order', target_ids: [targetFor(noPending, 3).id, targetFor(noPending, 4).id], reason: 'Motivo ficticio' })
  assert.throws(() => revise(noPending), /destinos|indicad/i)
})

test('revisión es idempotente por ID y payload incluso después de otras revisiones o realizaciones', () => {
  const { data } = mixed(), first = revision(data)
  const one = revise(data, first)
  const done = apply(one, perform(one, [3], { expected_revision: 1 }))
  const two = revise(done, revision(done, { water_l_ha: 210 }))
  assert.deepEqual(revise(two, { ...first, target_ids: [...first.target_ids].reverse(), products: [...first.products].reverse() }), two)
  assert.throws(() => revise(two, { ...first, water_l_ha: 181 }), /identificador|cambio/i)
  assert.throws(() => revise(one, { ...first, id: crypto.randomUUID() }), /cambió/i)
  assert.equal(targetFor(two, 3).indication_change_id, first.id)
  assert.equal(targetFor(two, 4).indication_change_id, two.applicationChanges[1].id)
  assert.deepEqual(two.applicationChanges[1].before, one.applicationChanges[0].after)
})

test('realizar sin excepción copia la indicación histórica de cada destino, no la orden original', () => {
  const { data } = mixed()
  const revised = revise(data)
  const next = apply(revised, perform(revised, [1, 3, 4], { expected_revision: 1 }))
  const original = next.applicationOrders[0]
  assert.deepEqual(targetFor(next, 1).actual_products, original.products)
  for (const number of [3, 4]) {
    const target = targetFor(next, number), indication = indicationForTarget(next, original, target)
    assert.deepEqual(target.actual_products, indication.products)
    assert.equal(target.actual_water_l_ha, 180)
    assert.equal(target.has_changes, false)
    assert.equal(target.application_number, 23)
  }
  assert.deepEqual(indicationForTarget(next, original, targetFor(next, 1)).products, original.products)
})

test('una excepción se compara contra la revisión de ese destino y conserva la indicación', () => {
  const revised = revise(mixed().data)
  const next = apply(revised, perform(revised, [3], { expected_revision: 1, changed: true, water_l_ha: 120, products: revised.applicationOrders[0].products.map(product => ({ product_id: product.product_id, dose: product.dose })) }))
  assert.equal(targetFor(next, 3).has_changes, true)
  assert.equal(indicationForTarget(next, next.applicationOrders[0], targetFor(next, 3)).water_l_ha, 180)
  assert.deepEqual(next.applicationChanges, revised.applicationChanges)
})

test('realización pendiente exige la revisión vista; reintento terminal sigue válido tras revisiones nuevas', () => {
  const { data } = mixed(), revised = revise(data)
  for (const expected_revision of [undefined, 0, 2]) assert.throws(() => apply(revised, perform(revised, [3], { expected_revision })), /indicación cambió/i)
  const request = perform(revised, [3], { expected_revision: 1 })
  const performed = apply(revised, request)
  const newer = revise(performed, revision(performed, { indicated_date: '2026-10-11', scheduled_date: '2026-10-12' }))
  assert.deepEqual(apply(newer, request), newer)
  const legacy = fixture().data
  assert.doesNotThrow(() => apply(legacy, perform(legacy, [1])))
  assert.throws(() => apply(legacy, perform(legacy, [1], { expected_revision: 1 })), /indicación cambió/i)
})

test('productos y medio retenidos conservan snapshots incluso inactivos; nuevos deben estar activos', () => {
  const { data } = mixed()
  const original = currentOrderIndication(data, data.applicationOrders[0])
  Object.assign(data.catalogs.products[0], { active: false, name: 'Nombre cambiado ficticio', unit: 'g' })
  Object.assign(data.catalogs.application_methods[0], { active: false, name: 'Medio renombrado ficticio' })
  const next = revise(data, revision(data, { method_id: 'method-a', products: [{ product_id: 'liquid', dose: 400 }, { product_id: 'solid', dose: 40 }] }))
  const snapshot = currentOrderIndication(next, next.applicationOrders[0])
  assert.equal(snapshot.method_name, original.method_name)
  assert.equal(snapshot.products[0].unit, 'ml')
  assert.equal(snapshot.products[0].product_name, original.products[0].product_name)
  assert.throws(() => revise(data, revision(data, { products: [{ product_id: 'inactive-product', dose: 10 }] })), /activos/i)
  data.catalogs.application_methods[1].active = false
  assert.throws(() => revise(data), /medio.*activo/i)
})

test('corregir realizado guarda pre/post, motivo y autor sin cambiar indicación, identidad ni conteos', () => {
  const { data } = mixed(), revised = revise(data), done = apply(revised, perform(revised, [3], { expected_revision: 1 }))
  const before = structuredClone(done), record = correction(done, 3), next = correct(done, 3, record)
  const target = targetFor(next, 3), oldTarget = targetFor(before, 3), event = next.applicationChanges.at(-1)!
  assert.equal(target.status, 'performed'); assert.equal(target.correction_version, 1)
  assert.equal(target.actual_water_l_ha, 200); assert.equal(target.equipment, 'Equipo corregido ficticio')
  assert.equal(target.actual_observations, record.observations); assert.equal(target.has_changes, true)
  assert.equal(target.indication_change_id, oldTarget.indication_change_id)
  assert.equal(target.application_number, oldTarget.application_number)
  assert.equal(target.area_ha, oldTarget.area_ha)
  assert.deepEqual(next.applicationOrders, before.applicationOrders)
  assert.equal(event.kind, 'performance'); assert.equal(event.target_id, target.id); assert.equal(event.version, 1)
  assert.equal(event.reason, 'Corrección ficticia de captura'); assert.equal(event.changed_by, admin.id)
  assert.equal('water_l_ha' in event.before && event.before.water_l_ha, oldTarget.actual_water_l_ha)
  assert.equal('observations' in event.after && event.after.observations, record.observations)
  assert.deepEqual(stageApplicationCounts(next, target.stage_id), stageApplicationCounts(before, target.stage_id))
})

test('corrección permite etapa/proyecto cerrados dentro de sus fechas históricas', () => {
  const { data } = mixed()
  data.projects[0].status = 'closed'
  Object.assign(data.stages[0], { status: 'closed', closed_at: '2026-10-20' })
  data.lots[0].active = false; data.subdivisions[0].active = false
  data.catalogs.agricultural_units[0].active = false
  const next = correct(data)
  assert.equal(targetFor(next, 1).actual_date, '2026-10-12')
  assert.equal(next.projects[0].status, 'closed')
  assert.equal(next.stages[0].closed_at, '2026-10-20')
  assert.throws(() => correct(data, 1, correction(data, 1, { actual_date: '2026-10-21' })), /cierre/i)
})

test('has_changes corregido se calcula contra la indicación revisada del destino', () => {
  const revised = revise(mixed().data), done = apply(revised, perform(revised, [3], { expected_revision: 1 }))
  const corrected = correct(done, 3)
  assert.equal(targetFor(corrected, 3).has_changes, true)
  const indicated = indicationForTarget(corrected, corrected.applicationOrders[0], targetFor(corrected, 3))
  const restored = correct(corrected, 3, correction(corrected, 3, { water_l_ha: indicated.water_l_ha, products: indicated.products.map(product => ({ product_id: product.product_id, dose: product.dose })) }))
  assert.equal(targetFor(restored, 3).has_changes, false)
  assert.equal(targetFor(restored, 3).actual_water_l_ha, 180)
  assert.equal(restored.applicationOrders[0].water_l_ha, 120, 'la comparación no vuelve a la orden base')
})

test('corrección solo admite realizados, CAS vigente y reintentos exactos sin restaurar versiones viejas', () => {
  const { data } = mixed()
  for (const number of [2, 3]) assert.throws(() => correct(data, number, correction(data, number, { products: [{ product_id: 'liquid', dose: 250 }] })), /realizados|realizada/i)
  const record = correction(data, 1), one = correct(data, 1, record)
  const two = correct(one, 1, correction(one, 1, { water_l_ha: 220 }))
  assert.deepEqual(correct(two, 1, { ...record, products: [...record.products].reverse() }), two)
  assert.throws(() => correct(one, 1, { ...record, id: crypto.randomUUID() }), /cambió/i)
  assert.throws(() => correct(two, 1, { ...record, observations: 'Otro contenido' }), /identificador/i)
  assert.equal(targetFor(two, 1).actual_water_l_ha, 220)
  assert.equal(targetFor(two, 1).correction_version, 2)
})

test('corrección retiene snapshots actuales inactivos pero reintroducir un producto retirado exige activo', () => {
  const { data } = mixed()
  const first = correct(data, 1, correction(data, 1, { products: [{ product_id: 'liquid', dose: 250 }] }))
  Object.assign(first.catalogs.products[0], { active: false, name: 'Renombrado después', unit: 'g' })
  first.catalogs.products[1].active = false
  const next = correct(first, 1, correction(first, 1, { products: [{ product_id: 'liquid', dose: 270 }] }))
  assert.equal(targetFor(next, 1).actual_products[0].unit, 'ml')
  assert.equal(targetFor(next, 1).actual_products[0].product_name, 'Líquido ficticio')
  assert.throws(() => correct(first, 1, correction(first, 1, { products: [{ product_id: 'liquid', dose: 270 }, { product_id: 'solid', dose: 35 }] })), /activos/i)
  assert.throws(() => correct(first, 1, correction(first, 1, { products: [{ product_id: 'inactive-product', dose: 10 }] })), /activos/i)
})

test('reintento de realización original después de corregir es no-op y conserva toda la corrección', () => {
  const { data } = mixed(), original = perform(data, [1])
  const corrected = correct(data)
  assert.deepEqual(apply(corrected, original), corrected)
  assert.throws(() => apply(corrected, perform(corrected, [1], { actual_date: '2026-10-12', equipment: 'Equipo corregido ficticio', applicator: 'Persona ficticia', observations: 'Otra realización', changed: true, water_l_ha: 200, products: targetFor(corrected, 1).actual_products.map(product => ({ product_id: product.product_id, dose: product.dose })) })), /historia|realizado/i)
  assert.equal(targetFor(corrected, 1).actual_water_l_ha, 200)
})

test('reintento de excepción original reconoce snapshot previo a corrección con producto agregado luego inactivo', () => {
  const { data } = fixture()
  const original = perform(data, [1], { changed: true, water_l_ha: 130, products: [{ product_id: 'new-product', dose: 12 }] })
  const done = apply(data, original)
  const corrected = correct(done, 1, correction(done, 1, { products: [{ product_id: 'liquid', dose: 250 }] }))
  Object.assign(corrected.catalogs.products[2], { active: false, unit: 'g', name: 'Nombre posterior ficticio' })
  assert.deepEqual(apply(corrected, original), corrected)
  assert.deepEqual(targetFor(corrected, 1).actual_products.map(product => product.product_id), ['liquid'])
})

test('revisiones y correcciones validan motivo, nota, precisión, productos y fechas sin tocar el origen', () => {
  const { data } = mixed()
  const invalid: Partial<ApplicationRevisionInput>[] = [{ reason: ' ' }, { reason: 'x'.repeat(4001) }, { observations: 'x'.repeat(4001) }, { observations: 'nulo\u0000' }, { water_l_ha: 0.00001 }, { water_l_ha: 100_000_000 }, { products: [{ product_id: 'liquid', dose: 1.0000001 }] }, { products: [] }, { products: [{ product_id: 'liquid', dose: 1 }, { product_id: 'liquid', dose: 2 }] }, { indicated_date: '2026-02-30' }, { indicated_date: '2026-10-01' }, { scheduled_date: '2026-10-08' }]
  for (const values of invalid) {
    const before = structuredClone(data)
    assert.throws(() => revise(data, revision(data, values)))
    assert.deepEqual(data, before)
  }
  for (const values of [{ reason: '' }, { water_l_ha: 0.00001 }, { products: [{ product_id: 'liquid', dose: -1 }] }, { observations: 'x'.repeat(4001) }, { actual_date: '2026-10-01' }, { actual_date: '2099-01-01' }, { actual_date: '2026-02-30' }]) assert.throws(() => correct(data, 1, correction(data, 1, values)))
  const revised = revise(data), done = apply(revised, perform(revised, [3], { expected_revision: 1 }))
  assert.throws(() => correct(done, 3, correction(done, 3, { actual_date: '2026-10-08' })), /indicación históricas/i)
})

test('lectores no editan ni invocando helpers directos; helpers de lectura devuelven copias sin alias', () => {
  const { data } = mixed()
  assert.throws(() => apply(data, { type: 'revise_application_order', record: revision(data) }, reader), /administración/i)
  assert.throws(() => applyApplicationEditing(structuredClone(data), reader, { type: 'correct_application_target', record: correction(data, 1) }), /administración/i)
  const next = revise(data), order = next.applicationOrders[0]
  const a = currentOrderIndication(next, order), b = indicationForTarget(next, order, targetFor(next, 3))
  a.products[0].dose = 99999; b.observations = 'Cambio local'
  assert.equal(currentOrderIndication(next, order).products[0].dose, 300)
  assert.notEqual(indicationForTarget(next, order, targetFor(next, 3)).observations, 'Cambio local')
  targetFor(next, 3).indication_change_id = 'missing-change'
  assert.throws(() => indicationForTarget(next, order, targetFor(next, 3)), /histórica/i)
})

test('una demo anterior sin metadatos de edición usa versión cero y crea historial al editar', () => {
  const { data } = mixed()
  delete (data as Partial<WorkspaceData>).applicationChanges
  delete data.applicationOrders[0].revision
  for (const target of data.applicationTargets) { delete target.indication_change_id; delete target.correction_version }
  assert.equal(currentOrderIndication(data, data.applicationOrders[0]).water_l_ha, 120)
  const corrected = correct(data)
  assert.equal(corrected.applicationChanges.length, 1)
  assert.equal(targetFor(corrected, 1).correction_version, 1)
  const revised = revise(data)
  assert.equal(revised.applicationChanges.length, 1)
  assert.equal(revised.applicationOrders[0].revision, 1)
})
