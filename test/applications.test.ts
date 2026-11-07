import assert from 'node:assert/strict'
import test from 'node:test'
import { createDemoData, DEMO_ADMIN_ID, DEMO_READER_ID } from '../src/domain/demo.ts'
import { nextStageApplicationNumber, stageApplicationCounts, stageApplicationNumber } from '../src/domain/applications.ts'
import { applyCommand, scopeWorkspace } from '../src/domain/rules.ts'
import { applicationOriginLabel, targetGroupMembershipLabel } from '../src/domain/application-groups.ts'
import { readOrderGroupHistory, readTargetGroupHistory } from '../src/data/application-group-history.ts'
import type { ApplicationOrderInput, ApplicationPerformanceInput, SowingGroup, UserProfile, WorkspaceCommand, WorkspaceData } from '../src/domain/model.ts'

// Only fictitious in-memory fixtures: never connect to Docker, Auth or operation.
function fixture() {
  const data = createDemoData()
  const admin = data.profiles.find(profile => profile.id === DEMO_ADMIN_ID)!
  const reader = data.profiles.find(profile => profile.id === DEMO_READER_ID)!
  const second = data.stages.find(stage => stage.id === 'stage-2')!
  Object.assign(second, { crop_id: 'crop-pepino', variety_id: 'var-pepino-persian', crop_name_snapshot: 'Pepino', variety_name_snapshot: 'Persa', planned_sowing_date: '2026-10-02', actual_sowing_date: '2026-10-04', status: 'planted' })
  data.projects.find(project => project.id === 'project-culiacan')!.status = 'active'
  data.stages.push({ id: 'stage-remote', subdivision_id: 'sub-lot-3', stage_number: 1, crop_id: 'crop-pepino', variety_id: 'var-pepino-persian', area_ha: 10, planned_sowing_date: '2026-10-01', actual_sowing_date: '2026-10-02', closed_at: null, status: 'planted', crop_name_snapshot: 'Pepino', variety_name_snapshot: 'Persa' })
  return { data, admin, reader }
}

function input(overrides: Partial<ApplicationOrderInput> = {}): ApplicationOrderInput {
  return { id: crypto.randomUUID(), project_id: 'project-ensenada', field_id: 'field-norte', crop_id: 'crop-pepino', method_id: 'method-dron', indicated_date: '2026-10-10', scheduled_date: '2026-10-11', water_l_ha: 120, observations: 'Indicación ficticia', stage_ids: ['stage-1', 'stage-2'], products: [{ product_id: 'product-a', dose: 250 }, { product_id: 'product-b', dose: 35 }], ...overrides }
}

function perform(order_id: string, target_ids: string[], overrides: Partial<ApplicationPerformanceInput> = {}): WorkspaceCommand {
  return { type: 'perform_application_targets', order_id, target_ids, data: { actual_date: '2026-10-12', equipment: 'Equipo ficticio', applicator: '', observations: 'Realización ficticia', changed: false, ...overrides } }
}

function indicate(data: WorkspaceData, admin: UserProfile, record = input()) {
  const next = applyCommand(data, { type: 'create_application_order', record }, admin)
  const order = next.applicationOrders.find(row => row.id === record.id)!
  assert.ok(order, 'la orden debe existir después de confirmar la indicación')
  return { data: next, record, order, targets: next.applicationTargets.filter(target => target.order_id === order.id) }
}

function group(data: WorkspaceData, admin: UserProfile) {
  const next = applyCommand(data, { type: 'save_sowing_group', record: { project_id: 'project-ensenada', field_id: 'field-norte', crop_id: 'crop-pepino', name: 'Grupo ficticio', active: true, stage_ids: ['stage-1', 'stage-2'] } }, admin)
  const created = next.sowingGroups.find(row => row.name === 'Grupo ficticio')!
  assert.ok(created)
  return { data: next, group: created }
}

test('grupo de origen y pertenencias sobreviven renombre, retiro y reintento sin reinterpretar la historia', () => {
  const { data, admin } = fixture()
  const grouped = group(data, admin)
  const record = input({ source_group_id: grouped.group.id })
  const created = indicate(grouped.data, admin, record)
  assert.equal(created.order.selection_origin, 'group')
  assert.equal(created.order.source_group_name, 'Grupo ficticio')
  assert.ok(created.targets.every(target => target.group_memberships_snapshot?.[0]?.id === grouped.group.id))
  const changed = applyCommand(created.data, { type: 'save_sowing_group', record: { ...grouped.group, name: 'Grupo renombrado', active: false, stage_ids: [] } }, admin)
  const reloaded = JSON.parse(JSON.stringify(changed)) as WorkspaceData
  const retry = indicate(reloaded, admin, record)
  assert.equal(retry.order.source_group_name, 'Grupo ficticio')
  assert.equal(retry.order.source_group_id, grouped.group.id)
  assert.equal(retry.targets[0].group_memberships_snapshot?.[0]?.name, 'Grupo ficticio')
  assert.equal(retry.targets.length, 2)
  assert.throws(() => indicate(reloaded, admin, { ...record, source_group_id: null }), /identificador/)
  assert.match(applicationOriginLabel(retry.order), /Todo el grupo.*Grupo ficticio/)
})

test('individual y selección manual conservan pertenencias múltiples sin convertirse en emisión de grupo', () => {
  const { data, admin } = fixture()
  const grouped = group(data, admin)
  const another = applyCommand(grouped.data, { type: 'save_sowing_group', record: { ...grouped.group, id: crypto.randomUUID(), name: 'Segundo grupo' } }, admin)
  const single = indicate(another, admin, input({ stage_ids: ['stage-1'] }))
  assert.equal(single.order.selection_origin, 'individual')
  assert.equal(single.order.source_group_id, null)
  assert.equal(single.targets[0].group_memberships_snapshot?.length, 2)
  assert.match(targetGroupMembershipLabel(single.targets[0]), /Grupo ficticio/)
  const multiple = indicate(another, admin)
  assert.equal(multiple.order.selection_origin, 'manual')
})

test('un grupo exige contexto activo y todos sus destinos vigentes; una etapa cerrada no se sustituye', () => {
  const { data, admin } = fixture()
  const grouped = group(data, admin)
  assert.throws(() => indicate(grouped.data, admin, input({ source_group_id: grouped.group.id, stage_ids: ['stage-1'] })), /todos sus destinos vigentes/)
  assert.throws(() => indicate(grouped.data, admin, input({ source_group_id: 'inexistente' })), /grupo activo/)
  grouped.data.stages.find(stage => stage.id === 'stage-2')!.status = 'closed'
  const current = indicate(grouped.data, admin, input({ source_group_id: grouped.group.id, stage_ids: ['stage-1'] }))
  assert.equal(current.targets.length, 1)
  assert.equal(current.order.selection_origin, 'group')
})

test('lectura del adaptador distingue historia desconocida, pertenencia vacía y grupo confirmado', () => {
  assert.deepEqual(readOrderGroupHistory({}), { selection_origin: 'unknown', source_group_id: null, source_group_name: null })
  assert.deepEqual(readTargetGroupHistory({}), { group_memberships_snapshot: null })
  assert.deepEqual(readTargetGroupHistory({ group_memberships_snapshot: [] }), { group_memberships_snapshot: [] })
  const history = { selection_origin: 'group', source_group_id: 'grupo', source_group_name: 'Nombre histórico' }
  assert.deepEqual(readOrderGroupHistory(history), history)
  assert.throws(() => readOrderGroupHistory({ selection_origin: 'group' }), /referencia histórica/)
  assert.throws(() => readTargetGroupHistory({ group_memberships_snapshot: [{ id: 1 }] }), /pertenencia histórica/)
})

test('indicar crea destinos completos con snapshots y una sola aplicación por etapa', () => {
  const { data, admin } = fixture()
  const original = structuredClone(data)
  const created = indicate(data, admin)
  assert.deepEqual(data, original, 'el comando es puro y conserva el origen')
  assert.equal(created.targets.length, 2)
  assert.deepEqual(created.targets.map(target => target.area_ha), [12, 7])
  assert.ok(created.targets.every(target => target.status === 'indicated' && target.actual_date === null && target.actual_products.length === 0))
  assert.deepEqual(created.order.products.map(product => product.unit), ['ml', 'g'])
  assert.deepEqual(stageApplicationCounts(created.data, 'stage-1'), { indicated: 1, performed: 0, cancelled: 0 })
  assert.deepEqual(stageApplicationCounts(created.data, 'stage-2'), { indicated: 1, performed: 0, cancelled: 0 })
})

test('un número indicado se conserva por etapa y los saltos no inventan aplicaciones anteriores', () => {
  const { data, admin } = fixture()
  const source = '  Mensaje ficticio\nAplicación 23\nNota:\nMañana y tarde  '
  const note = '  Mañana y tarde\nConservar indicación  '
  const created = indicate(data, admin, input({ application_number: 23, source_text: source, observations: note }))
  assert.deepEqual(created.targets.map(target => target.application_number), [23, 23])
  assert.equal(created.order.source_text, source)
  assert.equal(created.order.observations, note, 'la nota se conserva literalmente')
  assert.deepEqual(stageApplicationCounts(created.data, 'stage-1'), { indicated: 1, performed: 0, cancelled: 0 })
  assert.equal(nextStageApplicationNumber(created.data, 'stage-1'), 24)
})

test('la numeración automática continúa de manera independiente en cada etapa', () => {
  const { data, admin } = fixture()
  const first = indicate(data, admin, input({ application_number: 9, stage_ids: ['stage-1'] }))
  const second = indicate(first.data, admin)
  assert.deepEqual(second.targets.map(target => target.application_number), [10, 1])
  assert.equal(second.order.application_number, undefined, 'la orden no inventa un número solicitado común')
})

test('una aplicación cancelada reserva su número y un conflicto deja intacto todo el lote', () => {
  const { data, admin } = fixture()
  const first = indicate(data, admin, input({ application_number: 9, stage_ids: ['stage-1'] }))
  const cancelled = applyCommand(first.data, { type: 'cancel_application_targets', order_id: first.order.id, target_ids: first.targets.map(target => target.id), reason: 'Prueba ficticia' }, admin)
  const original = structuredClone(cancelled)
  assert.throws(() => indicate(cancelled, admin, input({ application_number: 9 })), /aplicación 9.*registrada/i)
  assert.deepEqual(cancelled, original)
  const next = indicate(cancelled, admin, input({ stage_ids: ['stage-1'] }))
  assert.equal(next.targets[0].application_number, 10)
})

test('el número y el mensaje forman parte de la idempotencia de la captura', () => {
  const { data, admin } = fixture()
  const created = indicate(data, admin, input({ application_number: 23, source_text: 'Mensaje fuente ficticio' }))
  assert.deepEqual(applyCommand(created.data, { type: 'create_application_order', record: created.record }, admin), created.data)
  for (const record of [
    { ...created.record, application_number: 24 },
    { ...created.record, application_number: undefined },
    { ...created.record, source_text: 'Otro mensaje ficticio' },
    { ...created.record, source_text: undefined },
  ]) assert.throws(() => applyCommand(created.data, { type: 'create_application_order', record }, admin), /identificador|indicación/i)
  const automatic = indicate(data, admin)
  assert.throws(() => applyCommand(automatic.data, { type: 'create_application_order', record: { ...automatic.record, application_number: 1 } }, admin), /identificador|indicación/i)
})

test('la captura rechaza números inválidos y mensajes fuera de su contrato', () => {
  const { data, admin, reader } = fixture()
  for (const number of [0, -1, 1.5, NaN, Infinity, 2147483648]) {
    assert.throws(() => indicate(data, admin, input({ application_number: number })), /número de aplicación/i)
  }
  assert.throws(() => indicate(data, admin, input({ source_text: 'x'.repeat(20001) })), /mensaje original/i)
  assert.throws(() => applyCommand(data, { type: 'create_application_order', record: input({ application_number: 23 }) }, reader), /administración/i)
})

test('la demo anterior sin números conserva su secuencia al continuar capturando', () => {
  const { data, admin } = fixture()
  const first = indicate(data, admin)
  const second = indicate(first.data, admin)
  second.data.applicationTargets.forEach(target => { delete target.application_number })
  assert.deepEqual(second.data.applicationTargets.filter(target => target.stage_id === 'stage-1').map(target => stageApplicationNumber(second.data, target)), [1, 2])
  const next = indicate(second.data, admin)
  assert.deepEqual(next.targets.map(target => target.application_number), [3, 3])
})

test('indicación rechaza campo, cultivo, temporada o etapa incompatibles sin guardar parcialmente', () => {
  const { data, admin } = fixture()
  const invalid: Partial<ApplicationOrderInput>[] = [
    { stage_ids: ['stage-1', 'stage-remote'] }, { field_id: 'field-valle' },
    { crop_id: 'crop-tomate' }, { project_id: 'project-history' },
    { stage_ids: ['stage-history'] }, { stage_ids: ['stage-1', 'stage-1'] },
  ]
  for (const overrides of invalid) {
    const before = structuredClone(data)
    assert.throws(() => indicate(data, admin, input(overrides)))
    assert.deepEqual(data, before)
  }
  const planned = structuredClone(data)
  planned.stages.find(stage => stage.id === 'stage-2')!.status = 'planned'
  assert.throws(() => indicate(planned, admin), /vigent|siembra|etapa/i)
})

test('indicación exige productos y agua válidos; conserva unidades fijas y catálogo', () => {
  const { data, admin } = fixture()
  const invalid: Partial<ApplicationOrderInput>[] = [
    { products: [] }, { products: [{ product_id: 'product-a', dose: 0 }] },
    { products: [{ product_id: 'product-a', dose: Number.NaN }] },
    { products: [{ product_id: 'product-a', dose: 1 }, { product_id: 'product-a', dose: 2 }] },
    { water_l_ha: 0 }, { water_l_ha: Number.POSITIVE_INFINITY },
    { products: [{ product_id: 'missing-product', dose: 2 }] },
  ]
  for (const overrides of invalid) assert.throws(() => indicate(data, admin, input(overrides)))
  const inactive = structuredClone(data)
  inactive.catalogs.products.find(product => product.id === 'product-a')!.active = false
  assert.throws(() => indicate(inactive, admin), /activ/i)
  const before = structuredClone(data.catalogs.products)
  const created = indicate(data, admin)
  assert.deepEqual(created.data.catalogs.products, before)
})

test('la realización habitual copia la indicación histórica sin depender del catálogo actual', () => {
  const { data, admin } = fixture()
  const created = indicate(data, admin)
  const before = structuredClone(created.order)
  for (const product of created.data.catalogs.products) {
    product.name = 'Nombre posterior'
    product.active = false
    product.default_dose = 999
    product.unit = product.unit === 'g' ? 'ml' : 'g'
  }
  const next = applyCommand(created.data, perform(created.order.id, [created.targets[0].id]), admin)
  const actual = next.applicationTargets.find(target => target.id === created.targets[0].id)!
  assert.equal(actual.status, 'performed')
  assert.equal(actual.actual_date, '2026-10-12')
  assert.equal(actual.actual_water_l_ha, before.water_l_ha)
  assert.deepEqual(actual.actual_products, before.products)
  assert.equal(actual.has_changes, false)
  assert.equal(actual.equipment, 'Equipo ficticio')
  assert.equal(actual.applicator, '', 'el aplicador es opcional')
  assert.equal(actual.actual_observations, 'Realización ficticia')
  assert.deepEqual(next.applicationOrders.find(order => order.id === before.id), before)
  assert.equal(next.applicationTargets.find(target => target.id === created.targets[1].id)!.status, 'indicated')
})

test('la excepción conserva productos, dosis y agua propios del destino y compara cambios reales', () => {
  const { data, admin } = fixture()
  const created = indicate(data, admin)
  const original = structuredClone(created.data)
  const next = applyCommand(created.data, perform(created.order.id, [created.targets[0].id], { changed: true, water_l_ha: 145, products: [{ product_id: 'product-b', dose: 48 }, { product_id: 'product-c', dose: 20 }] }), admin)
  const actual = next.applicationTargets.find(target => target.id === created.targets[0].id)!
  assert.deepEqual(actual.actual_products.map(product => [product.product_id, product.dose, product.unit]), [['product-b', 48, 'g'], ['product-c', 20, 'ml']])
  assert.equal(actual.actual_water_l_ha, 145)
  assert.equal(actual.has_changes, true)
  assert.deepEqual(next.applicationOrders, original.applicationOrders)
  assert.deepEqual(next.catalogs.products, original.catalogs.products)
  assert.deepEqual(next.applicationTargets.find(target => target.id === created.targets[1].id), original.applicationTargets.find(target => target.id === created.targets[1].id))
  assert.deepEqual(stageApplicationCounts(next, 'stage-1'), { indicated: 0, performed: 1, cancelled: 0 })
})

test('marcar excepción sin cambiar los valores no inventa una diferencia', () => {
  const { data, admin } = fixture()
  const created = indicate(data, admin)
  const next = applyCommand(created.data, perform(created.order.id, [created.targets[0].id], { changed: true, water_l_ha: created.order.water_l_ha, products: [...created.record.products].reverse() }), admin)
  assert.equal(next.applicationTargets.find(target => target.id === created.targets[0].id)!.has_changes, false)
})

test('los catálogos usados conservan unidad y referencias sin congelar dosis sugeridas futuras', () => {
  const { data, admin } = fixture()
  const created = indicate(data, admin)
  const product = created.data.catalogs.products.find(row => row.id === 'product-a')!
  assert.throws(() => applyCommand(created.data, { type: 'save_catalog', kind: 'products', record: { ...product, unit: 'g' } }, admin), /unidad|historia/i)
  assert.throws(() => applyCommand(created.data, { type: 'delete_catalog', kind: 'products', id: 'product-a' }, admin), /relacion|historia|inactiv/i)
  assert.throws(() => applyCommand(created.data, { type: 'delete_catalog', kind: 'application_methods', id: 'method-dron' }, admin), /relacion|historia|inactiv/i)
  const updated = applyCommand(created.data, { type: 'save_catalog', kind: 'products', record: { ...product, name: 'Nombre futuro ficticio', default_dose: 900 } }, admin)
  assert.deepEqual(updated.applicationOrders, created.data.applicationOrders)
  const performed = applyCommand(updated, perform(created.order.id, [created.targets[0].id], { changed: true, water_l_ha: 140, products: [{ product_id: 'product-c', dose: 15 }] }), admin)
  assert.throws(() => applyCommand(performed, { type: 'delete_catalog', kind: 'products', id: 'product-c' }, admin), /relacion|historia|inactiv/i)
})

test('añadir un producto inactivo a la mezcla real se rechaza y no deja una realización parcial', () => {
  const { data, admin } = fixture()
  const created = indicate(data, admin)
  created.data.catalogs.products.find(product => product.id === 'product-c')!.active = false
  const before = structuredClone(created.data)
  assert.throws(() => applyCommand(created.data, perform(created.order.id, created.targets.map(target => target.id), { changed: true, water_l_ha: 125, products: [{ product_id: 'product-c', dose: 10 }] }), admin), /activ/i)
  assert.deepEqual(created.data, before)
})

test('la creación es idempotente por ID y rechaza otro contenido bajo la misma identidad', () => {
  const { data, admin } = fixture()
  const created = indicate(data, admin)
  const retry = applyCommand(created.data, { type: 'create_application_order', record: { ...created.record, stage_ids: [...created.record.stage_ids].reverse(), products: [...created.record.products].reverse() } }, admin)
  assert.deepEqual(retry, created.data)
  assert.throws(() => applyCommand(created.data, { type: 'create_application_order', record: { ...created.record, water_l_ha: 121 } }, admin), /identific|indicaci|datos/i)
})

test('realizar repetidamente los mismos datos no duplica conteos ni sobrescribe un resultado distinto', () => {
  const { data, admin } = fixture()
  const created = indicate(data, admin)
  const command = perform(created.order.id, [created.targets[0].id])
  const next = applyCommand(created.data, command, admin)
  assert.deepEqual(applyCommand(next, command, admin), next)
  assert.throws(() => applyCommand(next, perform(created.order.id, [created.targets[0].id], { equipment: 'Otro equipo' }), admin), /realiz|historia|datos/i)
  assert.deepEqual(stageApplicationCounts(next, 'stage-1'), { indicated: 0, performed: 1, cancelled: 0 })
  const closed = applyCommand(next, { type: 'close_stage', id: 'stage-1', closed_at: '2026-10-20' }, admin)
  assert.deepEqual(applyCommand(closed, command, admin), closed, 'un reintento confirmado sigue siendo seguro tras cerrar la etapa')
})

test('el reintento de excepción reconoce el snapshot real aunque el producto agregado ya esté inactivo', () => {
  const { data, admin } = fixture()
  const created = indicate(data, admin)
  const command = perform(created.order.id, [created.targets[0].id], { changed: true, water_l_ha: 140, products: [{ product_id: 'product-c', dose: 15 }] })
  const performed = applyCommand(created.data, command, admin)
  const product = performed.catalogs.products.find(row => row.id === 'product-c')!
  Object.assign(product, { active: false, name: 'Renombrado después', unit: 'g' })
  const retried = applyCommand(performed, command, admin)
  assert.deepEqual(retried, performed)
  assert.equal(retried.applicationTargets.find(target => target.id === created.targets[0].id)!.actual_products[0].unit, 'ml')
  assert.throws(() => applyCommand(performed, perform(created.order.id, [created.targets[1].id], { changed: true, water_l_ha: 140, products: [{ product_id: 'product-c', dose: 15 }] }), admin), /activ/i)
})

test('un lote de destinos inválido se rechaza completo y no modifica al destino válido', () => {
  const { data, admin } = fixture()
  const created = indicate(data, admin)
  const other = indicate(created.data, admin, input({ stage_ids: ['stage-1'] }))
  const before = structuredClone(other.data)
  assert.throws(() => applyCommand(other.data, perform(created.order.id, [created.targets[0].id, other.targets[0].id]), admin), /destino|orden/i)
  assert.deepEqual(other.data, before)
  assert.throws(() => applyCommand(other.data, perform(created.order.id, [created.targets[0].id, created.targets[0].id]), admin), /repet|destino/i)
})

test('cancelar exige motivo, afecta solo al destino elegido y es idempotente con el mismo motivo', () => {
  const { data, admin } = fixture()
  const created = indicate(data, admin)
  const command: WorkspaceCommand = { type: 'cancel_application_targets', order_id: created.order.id, target_ids: [created.targets[0].id], reason: '  No se realizará  ' }
  assert.throws(() => applyCommand(created.data, { ...command, reason: ' ' }, admin), /motivo/i)
  const next = applyCommand(created.data, command, admin)
  assert.equal(next.applicationTargets.find(target => target.id === created.targets[0].id)!.cancellation_reason, 'No se realizará')
  assert.equal(next.applicationTargets.find(target => target.id === created.targets[1].id)!.status, 'indicated')
  assert.deepEqual(next.applicationOrders, created.data.applicationOrders)
  assert.deepEqual(applyCommand(next, command, admin), next)
  assert.throws(() => applyCommand(next, { ...command, reason: 'Otro motivo' }, admin), /indicad|previo|conserv/i)
  assert.throws(() => applyCommand(next, perform(created.order.id, [created.targets[0].id]), admin), /cancel/i)
})

test('un resultado realizado no puede cancelarse y los estados terminales no se mezclan parcialmente', () => {
  const { data, admin } = fixture()
  const created = indicate(data, admin)
  const performed = applyCommand(created.data, perform(created.order.id, [created.targets[0].id]), admin)
  const before = structuredClone(performed)
  assert.throws(() => applyCommand(performed, { type: 'cancel_application_targets', order_id: created.order.id, target_ids: created.targets.map(target => target.id), reason: 'Cancelar todo' }, admin), /indicad|realiz|conserv/i)
  assert.deepEqual(performed, before)
})

test('los conteos separan estados y no multiplican por productos ni por excepciones', () => {
  const { data, admin } = fixture()
  const pending = indicate(data, admin, input({ stage_ids: ['stage-1'] }))
  const actual = indicate(pending.data, admin, input({ stage_ids: ['stage-1'] }))
  const done = applyCommand(actual.data, perform(actual.order.id, actual.targets.map(target => target.id), { changed: true, water_l_ha: 130, products: [{ product_id: 'product-a', dose: 300 }, { product_id: 'product-c', dose: 10 }] }), admin)
  const cancelled = indicate(done, admin, input({ stage_ids: ['stage-1'] }))
  const next = applyCommand(cancelled.data, { type: 'cancel_application_targets', order_id: cancelled.order.id, target_ids: cancelled.targets.map(target => target.id), reason: 'Ficticio' }, admin)
  assert.deepEqual(stageApplicationCounts(next, 'stage-1'), { indicated: 1, performed: 1, cancelled: 1 })
  assert.deepEqual(stageApplicationCounts(next, 'stage-2'), { indicated: 0, performed: 0, cancelled: 0 })
})

test('las aplicaciones indicadas bloquean cierre de etapa y temporada hasta resolverlas', () => {
  const { data, admin } = fixture()
  const created = indicate(data, admin)
  assert.throws(() => applyCommand(created.data, { type: 'close_stage', id: 'stage-1', closed_at: '2026-10-20' }, admin), /pendiente|indicad|aplicaci/i)
  assert.throws(() => applyCommand(created.data, { type: 'close_project', id: 'project-ensenada' }, admin))
  assert.ok(created.data.applicationTargets.every(target => target.status === 'indicated'), 'cerrar no cancela silenciosamente')
  let next = applyCommand(created.data, { type: 'cancel_application_targets', order_id: created.order.id, target_ids: created.targets.map(target => target.id), reason: 'No se realizará' }, admin)
  next = applyCommand(next, { type: 'close_stage', id: 'stage-1', closed_at: '2026-10-20' }, admin)
  next = applyCommand(next, { type: 'close_stage', id: 'stage-2', closed_at: '2026-10-20' }, admin)
  next = applyCommand(next, { type: 'close_project', id: 'project-ensenada' }, admin)
  assert.equal(next.projects.find(project => project.id === 'project-ensenada')!.status, 'closed')
  assert.equal(next.applicationTargets.length, 2, 'el cierre conserva el historial')
})

test('los grupos son manuales, del mismo ámbito y no remapean una etapa cerrada a la siguiente', () => {
  const { data, admin } = fixture()
  const saved = group(data, admin)
  assert.deepEqual(saved.group.stage_ids, ['stage-1', 'stage-2'])
  assert.throws(() => applyCommand(saved.data, { type: 'save_sowing_group', record: { ...saved.group, stage_ids: ['stage-1', 'stage-remote'] } }, admin), /campo|cultivo|vigent|destino/i)
  const closed = applyCommand(saved.data, { type: 'close_stage', id: 'stage-1', closed_at: '2026-10-20' }, admin)
  assert.ok(closed.sowingGroups.find(row => row.id === saved.group.id)!.stage_ids.includes('stage-1'))
  assert.throws(() => indicate(closed, admin, input({ stage_ids: saved.group.stage_ids })), /vigent|siembra|etapa/i)
  const updated = applyCommand(closed, { type: 'save_sowing_group', record: { ...saved.group, name: 'Grupo actualizado', stage_ids: ['stage-2'] } }, admin)
  const stored = updated.sowingGroups.find(row => row.id === saved.group.id)! as SowingGroup & { historical_stage_ids?: string[] }
  assert.ok(stored.historical_stage_ids?.includes('stage-1'), 'retirar una integrante conserva su pertenencia histórica')
  assert.deepEqual(stored.stage_ids, ['stage-2'])
  assert.equal(indicate(updated, admin, input({ stage_ids: stored.stage_ids })).targets[0].stage_id, 'stage-2')
})

test('archivar un grupo nunca admite integrantes arbitrarios ni otro ámbito', () => {
  const { data, admin } = fixture()
  const saved = group(data, admin)
  const before = structuredClone(saved.data)
  assert.throws(() => applyCommand(saved.data, { type: 'save_sowing_group', record: { ...saved.group, active: false, field_id: 'field-rio', project_id: 'project-culiacan', stage_ids: ['stage-remote'] } }, admin), /ámbito|campo|proyecto/i)
  let result = saved.data
  try {
    result = applyCommand(saved.data, { type: 'save_sowing_group', record: { ...saved.group, active: false, stage_ids: ['stage-remote', 'missing-stage'] } }, admin)
  } catch { /* Rejection and preserving existing membership are both safe archive contracts. */ }
  const stored = result.sowingGroups.find(row => row.id === saved.group.id)!
  assert.deepEqual(stored.stage_ids, saved.group.stage_ids)
  assert.deepEqual(saved.data, before)
})

test('el lector no guarda órdenes, realizaciones, cancelaciones ni grupos', () => {
  const { data, admin, reader } = fixture()
  const created = indicate(data, admin)
  const before = structuredClone(created.data)
  const commands: WorkspaceCommand[] = [
    { type: 'create_application_order', record: input() }, perform(created.order.id, [created.targets[0].id]),
    { type: 'cancel_application_targets', order_id: created.order.id, target_ids: [created.targets[0].id], reason: 'No autorizado' },
    { type: 'save_sowing_group', record: { project_id: 'project-ensenada', field_id: 'field-norte', crop_id: 'crop-pepino', name: 'No autorizado', active: true, stage_ids: ['stage-1'] } },
  ]
  for (const command of commands) assert.throws(() => applyCommand(created.data, command, reader), /consulta|administraci/i)
  assert.deepEqual(created.data, before)
})

test('el ámbito del lector filtra órdenes, destinos y grupos de agrícolas no asignadas', () => {
  const { data, admin, reader } = fixture()
  const local = indicate(data, admin, input({ stage_ids: ['stage-1'] }))
  const remote = indicate(local.data, admin, input({ project_id: 'project-culiacan', field_id: 'field-rio', stage_ids: ['stage-remote'] }))
  const localGroup = group(remote.data, admin)
  const withRemoteGroup = applyCommand(localGroup.data, { type: 'save_sowing_group', record: { project_id: 'project-culiacan', field_id: 'field-rio', crop_id: 'crop-pepino', name: 'Grupo remoto ficticio', active: true, stage_ids: ['stage-remote'] } }, admin)
  const scoped = scopeWorkspace(withRemoteGroup, reader)
  assert.deepEqual(scoped.applicationOrders.map(order => order.id), [local.order.id])
  assert.ok(scoped.applicationTargets.every(target => target.order_id === local.order.id && target.stage_id !== 'stage-remote'))
  assert.deepEqual(scoped.sowingGroups.map(row => row.id), [localGroup.group.id])
  assert.equal(withRemoteGroup.applicationOrders.length, 2, 'filtrar no modifica el origen')
})

import { recipeHistory } from '../src/domain/application-recipes.ts'
import { buildApplicationDates, commonApplicationInterval } from '../src/domain/application-schedule.ts'
import { snapshotSavedRecipe } from '../src/domain/saved-recipe-document.ts'

test('RCF-045: foliar y riego intercalados numeran por etapa sin liberar cancelados', () => {
  const { data, admin } = fixture()
  let current = data
  for (const [method, expected] of [['method-dron',1],['method-riego',1],['method-tractor',2],['method-riego',2]] as const) {
    const created = indicate(current, admin, input({ method_id: method, water_l_ha: method === 'method-riego' ? null : 100 }))
    assert.ok(created.targets.every(target => target.application_number === expected))
    assert.equal(created.order.application_route, method === 'method-riego' ? 'irrigation' : 'foliar')
    current = created.data
    if (method === 'method-riego' && expected === 2) current = applyCommand(current, {type:'cancel_application_targets',order_id:created.order.id,target_ids:created.targets.map(target=>target.id),reason:'Prueba ficticia'},admin)
  }
  assert.equal(nextStageApplicationNumber(current,'stage-1','irrigation'),3)
  assert.equal(nextStageApplicationNumber(current,'stage-1','foliar'),3)
  assert.equal(nextStageApplicationNumber(current,'otra-etapa','irrigation'),1)
  assert.equal(nextStageApplicationNumber(current,'otra-etapa','foliar'),1)
})

test('RCF-045: agua omitida de riego sobrevive realización, corrección, PDF y recarga', () => {
  const { data, admin } = fixture()
  const created = indicate(data,admin,input({method_id:'method-riego',water_l_ha:null}))
  const performed = applyCommand(created.data, perform(created.order.id, created.targets.map(target=>target.id)),admin)
  assert.ok(performed.applicationTargets.every(target=>target.actual_water_l_ha===null))
  const corrected=applyCommand(performed,{type:'correct_application_target',record:{id:crypto.randomUUID(),target_id:created.targets[0].id,expected_version:0,actual_date:'2026-10-13',water_l_ha:null,equipment:'Otro equipo ficticio',applicator:'',observations:'',reason:'Prueba de corrección sin agua',products:created.order.products.map(product=>({product_id:product.product_id,dose:product.dose}))}},admin)
  const reloaded=JSON.parse(JSON.stringify(corrected)) as WorkspaceData
  assert.equal(reloaded.applicationChanges[0].after.water_l_ha,null)
  const snapshot=snapshotSavedRecipe(reloaded,admin,created.order.id,'2026-11-01T12:00:00Z')
  assert.equal(snapshot.water_l_ha,null)
  assert.equal(snapshot.application_route,'irrigation')
  assert.equal(reloaded.applicationTargets[0].actual_water_l_ha,null)
})

test('RCF-045: foliar exige agua, riego rechaza cero y conserva cantidades capturadas', () => {
  const {data,admin}=fixture()
  assert.throws(()=>indicate(data,admin,input({water_l_ha:null})),/agua/)
  assert.throws(()=>indicate(data,admin,input({method_id:'method-riego',water_l_ha:0})),/agua/)
  const created=indicate(data,admin,input({method_id:'method-riego',water_l_ha:2345.6789}))
  assert.equal(created.order.water_l_ha,2345.6789)
  const result=applyCommand(created.data,perform(created.order.id,created.targets.map(target=>target.id),{changed:true,water_l_ha:null,products:created.record.products}),admin)
  assert.ok(result.applicationTargets.every(target=>target.actual_water_l_ha===null&&target.has_changes))
})

test('RCF-045: selección de receta e intervalos aíslan la vía, sin renumerar folios', () => {
  const {data,admin}=fixture()
  const first=indicate(data,admin,input())
  const middle=indicate(first.data,admin,input({method_id:'method-riego',water_l_ha:null}))
  const last=indicate(middle.data,admin,input({indicated_date:'2026-10-11'}))
  let performed=applyCommand(last.data,perform(first.order.id,first.targets.map(target=>target.id),{actual_date:'2026-10-12'}),admin)
  performed=applyCommand(performed,perform(middle.order.id,middle.targets.map(target=>target.id),{actual_date:'2026-10-14'}),admin)
  performed=applyCommand(performed,perform(last.order.id,last.targets.map(target=>target.id),{actual_date:'2026-10-17'}),admin)
  assert.deepEqual(recipeHistory(performed,['stage-1','stage-2'],undefined,'irrigation').map(item=>item.order_id),[middle.order.id])
  const dates=buildApplicationDates(performed.applicationOrders,performed.applicationTargets)
  const interval=commonApplicationInterval(dates.get(last.order.id)!)
  assert.equal(interval?.kind==='interval'&&interval.days,5)
  assert.equal(interval?.kind==='interval'&&interval.previous.id,first.order.id)
  assert.equal(commonApplicationInterval(dates.get(middle.order.id)!)?.kind,'first')
  assert.equal(last.order.folio,'APL-000003')
  assert.throws(()=>indicate(performed,admin,input({method_id:'method-riego',water_l_ha:null,recipe_source:{order_id:first.order.id,revision:0,stage_id:'stage-1'}})),/misma vía/)
})

test('RCF-045: receta guardada permite otro medio de la misma vía y rechaza cambiarla', () => {
  const {data,admin}=fixture()
  const created=indicate(data,admin,input())
  const record={id:crypto.randomUUID(),order_id:created.order.id,expected_revision:0,target_ids:created.targets.map(target=>target.id),method_id:'method-riego',indicated_date:'2026-10-10',scheduled_date:'2026-10-12',water_l_ha:100,observations:'',reason:'Cambio ficticio',products:created.record.products}
  assert.throws(()=>applyCommand(created.data,{type:'revise_application_order',record},admin),/vía/)
  const revised=applyCommand(created.data,{type:'revise_application_order',record:{...record,method_id:'method-tractor'}},admin)
  assert.equal(revised.applicationOrders[0].application_route,'foliar')
  assert.equal('method_id' in revised.applicationChanges[0].after && revised.applicationChanges[0].after.method_id,'method-tractor')
  assert.ok(revised.applicationTargets.every(target=>target.application_number===1))
})

test('RCF-045: medio utilizado no cambia de vía y lectores no configuran medios', () => {
  const {data,admin,reader}=fixture()
  const created=indicate(data,admin,input())
  const method=created.data.catalogs.application_methods.find(item=>item.id==='method-dron')!
  assert.throws(()=>applyCommand(created.data,{type:'save_catalog',kind:'application_methods',record:{...method,application_route:'irrigation'}},admin),/vía/)
  assert.throws(()=>applyCommand(data,{type:'save_catalog',kind:'application_methods',record:{name:'Riego ficticio',active:true,application_route:'irrigation'}},reader),/administración|permisos/)
  const changed=applyCommand(created.data,{type:'save_catalog',kind:'application_methods',record:{...method,name:'Dron renombrado'}},admin)
  assert.equal(changed.applicationOrders[0].method_name,'Dron')
})
