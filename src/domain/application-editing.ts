import { applicationRoute, methodRoute, validateApplicationWater } from './application-routes.ts'
import type {
  ApplicationActualSnapshot, ApplicationChange, ApplicationCorrectionInput, ApplicationIndicationSnapshot,
  ApplicationOrder, ApplicationProductInput, ApplicationRevisionInput, ApplicationTarget, ProductLine,
  UserProfile, WorkspaceCommand, WorkspaceData,
} from './model'

function fail(message: string): never { throw new Error(message) }
const date = (value: string) => typeof value === 'string' && /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value) && Number(value.slice(0, 4)) > 0 && Number.isFinite(Date.parse(`${value}T12:00:00Z`)) && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mazatlan', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
function text(value: string, label: string, trimmed = false) {
  if (typeof value !== 'string' || value.length > 4000 || value.includes('\u0000')) fail(`${label} debe ser texto de hasta 4,000 caracteres, sin caracteres nulos.`)
  return trimmed ? value.trim() : value
}
function reason(value: string) {
  const result = text(value, 'El motivo', true)
  if (!result) fail('El motivo del cambio es obligatorio.')
  return result
}
function amount(value: number, label: string, decimals: number) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value >= 100_000_000 || Number(value.toFixed(decimals)) !== value) fail(`${label} debe ser positivo, menor que 100,000,000 y tener como máximo ${decimals} decimales.`)
}
function version(value: number) {
  if (!Number.isSafeInteger(value) || value < 0 || value >= 2_147_483_647) fail('La versión esperada debe ser un entero válido y permitir una nueva revisión.')
}
function identity(id: string) {
  if (typeof id !== 'string' || !id.trim() || id.length > 200) fail('El cambio requiere un identificador estable válido.')
}
function productInputs(products: ApplicationProductInput[]) {
  if (!Array.isArray(products) || !products.length) fail('Agrega al menos un producto a la mezcla.')
  const ids = new Set<string>()
  for (const product of products) {
    if (!product || typeof product.product_id !== 'string' || !product.product_id || ids.has(product.product_id)) fail('Selecciona productos válidos sin repetirlos en la mezcla.')
    ids.add(product.product_id)
    amount(product.dose, 'La dosis', 6)
  }
}
function mixture(products: ApplicationProductInput[]) {
  return JSON.stringify(products.map(product => [product.product_id, product.dose]).sort((left, right) => String(left[0]).localeCompare(String(right[0]))))
}
function snapshots(data: WorkspaceData, products: ApplicationProductInput[], retained: ProductLine[]) {
  productInputs(products)
  return products.map((product): ProductLine => {
    const previous = retained.find(item => item.product_id === product.product_id)
    if (previous) {
      if (previous.unit !== 'g' && previous.unit !== 'ml') fail('El producto histórico no tiene una unidad fija válida. Actualiza la información antes de editar.')
      return { ...structuredClone(previous), dose: product.dose }
    }
    const current = data.catalogs.products.find(item => item.id === product.product_id && item.active)
    if (!current) fail('Los productos nuevos deben estar activos. Los productos retirados solo pueden conservarse si ya forman parte de esta mezcla.')
    if (current.unit !== 'g' && current.unit !== 'ml') fail('El producto nuevo requiere una unidad fija g o ml.')
    return { product_id: current.id, dose: product.dose, product_name: current.name, unit: current.unit }
  })
}

function originalIndication(order: ApplicationOrder): ApplicationIndicationSnapshot {
  return structuredClone({ method_id: order.method_id, method_name: order.method_name ?? '', indicated_date: order.indicated_date, scheduled_date: order.scheduled_date, water_l_ha: order.water_l_ha, observations: order.observations, products: order.products })
}

export function indicationForTarget(data: WorkspaceData, order: ApplicationOrder, target: ApplicationTarget): ApplicationIndicationSnapshot {
  if (target.order_id !== order.id) fail('El destino no pertenece a la orden consultada.')
  if (!target.indication_change_id) return originalIndication(order)
  const change = (data.applicationChanges ?? []).find(item => item.id === target.indication_change_id && item.kind === 'indication' && item.order_id === order.id && item.target_id === null && item.target_ids.includes(target.id))
  if (!change || !('method_id' in change.after)) fail('No se encontró la indicación histórica de este destino. Actualiza la información antes de continuar.')
  return structuredClone(change.after as ApplicationIndicationSnapshot)
}

export function currentOrderIndication(data: WorkspaceData, order: ApplicationOrder): ApplicationIndicationSnapshot {
  const changes = (data.applicationChanges ?? []).filter(change => change.kind === 'indication' && change.order_id === order.id && change.target_id === null)
  const latest = changes.reduce<ApplicationChange | undefined>((current, change) => !current || change.version > current.version ? change : current, undefined)
  if (!latest) {
    if (order.revision) fail('Falta el historial de revisiones de la orden. Actualiza la información antes de continuar.')
    return originalIndication(order)
  }
  if (latest.version !== (order.revision ?? 0) || !('method_id' in latest.after)) fail('La revisión y el historial de la orden no coinciden. Actualiza la información antes de continuar.')
  return structuredClone(latest.after as ApplicationIndicationSnapshot)
}

function actualSnapshot(target: ApplicationTarget): ApplicationActualSnapshot {
  if (!target.actual_date) fail('El destino realizado no tiene una captura real completa. Actualiza la información antes de corregir.')
  return structuredClone({ actual_date: target.actual_date, water_l_ha: target.actual_water_l_ha, equipment: target.equipment, applicator: target.applicator, observations: target.actual_observations, products: target.actual_products, has_changes: target.has_changes })
}
function revisionKey(record: ApplicationRevisionInput) {
  return JSON.stringify({ order_id: record.order_id, expected_revision: record.expected_revision, target_ids: [...record.target_ids].sort(), method_id: record.method_id,
    indicated_date: record.indicated_date, scheduled_date: record.scheduled_date, water_l_ha: record.water_l_ha, observations: record.observations, products: mixture(record.products), reason: record.reason.trim() })
}
function correctionKey(record: ApplicationCorrectionInput) {
  return JSON.stringify({ target_id: record.target_id, expected_version: record.expected_version, actual_date: record.actual_date, water_l_ha: record.water_l_ha,
    equipment: record.equipment.trim(), applicator: record.applicator.trim(), observations: record.observations, products: mixture(record.products), reason: record.reason.trim() })
}
function sameRevision(change: ApplicationChange, record: ApplicationRevisionInput) {
  if (change.kind !== 'indication' || change.target_id !== null || change.order_id !== record.order_id || !('method_id' in change.after)) return false
  const after = change.after as ApplicationIndicationSnapshot
  return revisionKey({ ...record, order_id: change.order_id, expected_revision: change.version - 1, target_ids: change.target_ids, ...after, reason: change.reason }) === revisionKey(record)
}
function sameCorrection(change: ApplicationChange, record: ApplicationCorrectionInput) {
  if (change.kind !== 'performance' || change.target_id !== record.target_id || !('actual_date' in change.after)) return false
  const after = change.after as ApplicationActualSnapshot
  return correctionKey({ ...record, target_id: change.target_id, expected_version: change.version - 1, ...after, reason: change.reason }) === correctionKey(record)
}

/** Mutates only the caller's workspace clone after all command checks pass. */
export function applyApplicationEditing(data: WorkspaceData, profile: UserProfile, command: WorkspaceCommand): boolean {
  if (command.type !== 'revise_application_order' && command.type !== 'correct_application_target') return false
  if (profile.role !== 'admin') fail('Solo la administración puede editar aplicaciones.')
  const record = command.record
  identity(record.id)
  const changeReason = reason(record.reason)
  text(record.observations, 'La nota de la aplicación')
  if (record.water_l_ha != null) amount(record.water_l_ha, 'El gasto de agua', 4)
  productInputs(record.products)
  const changes = data.applicationChanges ?? []
  const existing = changes.find(change => change.id === record.id)

  if (command.type === 'revise_application_order') {
    const revision = command.record
    version(revision.expected_revision)
    if (!Array.isArray(revision.target_ids) || !revision.target_ids.length || new Set(revision.target_ids).size !== revision.target_ids.length) fail('Selecciona todos los destinos indicados, sin repetirlos.')
    if (!date(revision.indicated_date) || !date(revision.scheduled_date) || revision.scheduled_date < revision.indicated_date) fail('Las fechas de indicación y programación deben ser válidas y estar en orden.')
    if (existing) {
      if (!sameRevision(existing, revision)) fail('Ese identificador ya corresponde a otro cambio de aplicación.')
      return true
    }
    const order = data.applicationOrders.find(item => item.id === revision.order_id) ?? fail('No se encontró la orden que deseas revisar.')
    if ((order.revision ?? 0) !== revision.expected_revision) fail('La orden cambió desde que abriste la edición. Actualiza y vuelve a revisar.')
    const pending = data.applicationTargets.filter(target => target.order_id === order.id && target.status === 'indicated')
    if (!pending.length || JSON.stringify(pending.map(target => target.id).sort()) !== JSON.stringify([...revision.target_ids].sort())) fail('La revisión debe incluir exactamente todos los destinos todavía indicados. Actualiza los estados antes de guardar.')
    const project = data.projects.find(item => item.id === order.project_id && item.status === 'active')
    const field = data.catalogs.fields.find(item => item.id === order.field_id && item.active)
    if (!project || !field || field.agricultural_unit_id !== project.agricultural_unit_id || !data.catalogs.agricultural_units.some(unit => unit.id === project.agricultural_unit_id && unit.active) || !data.catalogs.crops.some(crop => crop.id === order.crop_id && crop.active)) fail('La revisión requiere el mismo proyecto, agrícola, campo y cultivo activos.')
    for (const target of pending) {
      const stage = data.stages.find(item => item.id === target.stage_id)
      const subdivision = data.subdivisions.find(item => item.id === stage?.subdivision_id)
      const lot = data.lots.find(item => item.id === subdivision?.lot_id)
      if (!stage || stage.status !== 'planted' || stage.closed_at || !subdivision?.active || !lot || lot.active === false || lot.project_id !== order.project_id || lot.field_id !== order.field_id || stage.crop_id !== order.crop_id) fail('Los destinos revisados deben seguir sembrados y vigentes en el mismo proyecto, campo y cultivo.')
      if (!stage.actual_sowing_date || !date(stage.actual_sowing_date) || revision.indicated_date < stage.actual_sowing_date) fail('La indicación revisada no puede ser anterior a la siembra real de ninguno de sus destinos.')
    }
    const before = currentOrderIndication(data, order)
    const method = revision.method_id === before.method_id ? { id: before.method_id, name: before.method_name } : data.catalogs.application_methods.find(item => item.id === revision.method_id && item.active)
    if (!method) fail('Selecciona un medio de aplicación nuevo activo o conserva el medio indicado.')
    if (revision.method_id !== before.method_id && methodRoute(data, revision.method_id) !== applicationRoute(order)) fail('La vía no se puede cambiar. Crea una nueva receta para otra vía.')
    validateApplicationWater(revision.water_l_ha, applicationRoute(order))
    const after: ApplicationIndicationSnapshot = { method_id: method.id, method_name: method.name, indicated_date: revision.indicated_date, scheduled_date: revision.scheduled_date, water_l_ha: revision.water_l_ha, observations: revision.observations, products: snapshots(data, revision.products, before.products) }
    const change: ApplicationChange = { id: revision.id, order_id: order.id, target_id: null, kind: 'indication', version: revision.expected_revision + 1, target_ids: [...revision.target_ids].sort(), reason: changeReason, changed_by: profile.id, changed_by_name: profile.full_name, changed_at: new Date().toISOString(), before, after }
    data.applicationChanges ??= []
    data.applicationChanges.push(change)
    order.revision = change.version
    pending.forEach(target => { target.indication_change_id = change.id })
    return true
  }

  const correction = command.record
  version(correction.expected_version)
  const equipment = text(correction.equipment, 'El equipo', true)
  const applicator = text(correction.applicator, 'El aplicador', true)
  if (!date(correction.actual_date)) fail('Captura una fecha real de aplicación válida.')
  if (existing) {
    if (!sameCorrection(existing, correction)) fail('Ese identificador ya corresponde a otro cambio de aplicación.')
    return true
  }
  const target = data.applicationTargets.find(item => item.id === correction.target_id) ?? fail('No se encontró el destino que deseas corregir.')
  if (target.status !== 'performed') fail('Solo se pueden corregir destinos realizados; las indicaciones y cancelaciones conservan su estado.')
  if ((target.correction_version ?? 0) !== correction.expected_version) fail('La realización cambió desde que abriste la corrección. Actualiza y vuelve a revisar.')
  const order = data.applicationOrders.find(item => item.id === target.order_id) ?? fail('No se encontró la orden de este destino.')
  validateApplicationWater(correction.water_l_ha, applicationRoute(order))
  const indication = indicationForTarget(data, order, target)
  const stage = data.stages.find(item => item.id === target.stage_id)
  if (!stage?.actual_sowing_date || !date(stage.actual_sowing_date)) fail('No se encontró una fecha real de siembra válida para corregir este destino.')
  if (correction.actual_date < stage.actual_sowing_date || correction.actual_date < indication.indicated_date || correction.actual_date > today()) fail('La fecha real corregida debe estar entre la siembra e indicación históricas y hoy.')
  if (stage.closed_at && (!date(stage.closed_at) || correction.actual_date > stage.closed_at)) fail('La fecha real corregida no puede ser posterior al cierre de la etapa.')
  const before = actualSnapshot(target)
  const products = snapshots(data, correction.products, before.products)
  const after: ApplicationActualSnapshot = { actual_date: correction.actual_date, water_l_ha: correction.water_l_ha, equipment, applicator, observations: correction.observations, products, has_changes: correction.water_l_ha !== indication.water_l_ha || mixture(products) !== mixture(indication.products) }
  const change: ApplicationChange = { id: correction.id, order_id: order.id, target_id: target.id, kind: 'performance', version: correction.expected_version + 1, target_ids: [target.id], reason: changeReason, changed_by: profile.id, changed_by_name: profile.full_name, changed_at: new Date().toISOString(), before, after }
  data.applicationChanges ??= []
  data.applicationChanges.push(change)
  Object.assign(target, { actual_date: after.actual_date, actual_water_l_ha: after.water_l_ha, equipment, applicator, actual_observations: after.observations, actual_products: structuredClone(products), has_changes: after.has_changes, correction_version: change.version })
  return true
}
