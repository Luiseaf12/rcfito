import type { ApplicationActualSnapshot, ApplicationOrderInput, ApplicationPerformanceInput, ApplicationProductInput, ApplicationTarget, ProductLine, SowingStage, UserProfile, WorkspaceCommand, WorkspaceData } from './model'
import { applyApplicationEditing, indicationForTarget } from './application-editing.ts'
import { applicationGroupOrigin, groupMembershipsAtCreation } from './application-groups.ts'
import { validateRecipeSource } from './application-recipes.ts'
import { imageSourceCaptureKey, validateImageOrderSourceCapture, validateImageSourceCapture } from './application-image.ts'

const fail = (message: string): never => { throw new Error(message) }
const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T12:00:00Z`)) && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value
const positive = (value: number, label: string) => { if (!Number.isFinite(value) || value <= 0) fail(`${label} debe ser mayor que cero.`) }
const trim = (value: string | undefined) => (value ?? '').trim()
const normalized = (value: string) => trim(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es-MX')
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mazatlan', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())

export function stageApplicationCounts(data: WorkspaceData, stageId: string) {
  const targets = (data.applicationTargets ?? []).filter(target => target.stage_id === stageId)
  return { indicated: targets.filter(t => t.status === 'indicated').length, performed: targets.filter(t => t.status === 'performed').length, cancelled: targets.filter(t => t.status === 'cancelled').length }
}

// Legacy browser demos predate persisted numbers. Their insertion order is stable.
export function stageApplicationNumber(data: WorkspaceData, target: ApplicationTarget): number {
  return target.application_number ?? data.applicationTargets.filter(item => item.stage_id === target.stage_id).findIndex(item => item.id === target.id) + 1
}

export function nextStageApplicationNumber(data: WorkspaceData, stageId: string): number {
  return Math.max(0, ...data.applicationTargets.filter(target => target.stage_id === stageId).map(target => stageApplicationNumber(data, target))) + 1
}

function destinations(data: WorkspaceData, stageIds: string[], projectId: string, fieldId: string, cropId: string): SowingStage[] {
  const project = data.projects.find(p => p.id === projectId) ?? fail('No se encontró la temporada.')
  if (project.status !== 'active') fail('Selecciona una temporada activa.')
  if (!data.catalogs.fields.some(f => f.id === fieldId && f.active && f.agricultural_unit_id === project.agricultural_unit_id)) fail('El campo no pertenece a la agrícola de esta temporada o está inactivo.')
  if (!data.catalogs.crops.some(c => c.id === cropId && c.active)) fail('Selecciona un cultivo activo.')
  if (!stageIds.length || new Set(stageIds).size !== stageIds.length) fail('Selecciona destinos completos sin repetirlos.')
  return stageIds.map(id => {
    const stage = data.stages.find(s => s.id === id)
    const sub = data.subdivisions.find(s => s.id === stage?.subdivision_id)
    const lot = data.lots.find(l => l.id === sub?.lot_id)
    if (!stage || stage.status !== 'planted' || !sub?.active || lot?.active === false || lot?.project_id !== projectId || lot?.field_id !== fieldId || stage.crop_id !== cropId) {
      fail('Todos los destinos deben ser siembras vigentes del mismo campo y cultivo.')
    }
    return stage!
  })
}

function productLines(data: WorkspaceData, inputs: ApplicationProductInput[], original: ProductLine[] = []): ProductLine[] {
  if (!inputs?.length) fail('Agrega al menos un producto.')
  if (new Set(inputs.map(p => p.product_id)).size !== inputs.length) fail('Un producto no puede repetirse en la mezcla.')
  return inputs.map(input => {
    positive(input.dose, 'La dosis')
    const previous = original.find(p => p.product_id === input.product_id)
    const product = data.catalogs.products.find(p => p.id === input.product_id)
    if (!previous && !product?.active) fail('Solo puedes agregar productos activos.')
    const unit = previous?.unit ?? product?.unit ?? fail('El producto debe tener su unidad fija configurada.')
    if (unit !== 'g' && unit !== 'ml') fail('El producto debe tener su unidad fija configurada.')
    return { product_id: input.product_id, dose: input.dose, product_name: previous?.product_name ?? product!.name, unit }
  })
}

function mixtureKey(products: ApplicationProductInput[]) {
  return JSON.stringify(products.map(p => [p.product_id, Number(p.dose)]).sort((a, b) => String(a[0]).localeCompare(String(b[0]))))
}

function requestKey(record: ApplicationOrderInput) {
  return JSON.stringify({ id: record.id, project_id: record.project_id, field_id: record.field_id, crop_id: record.crop_id, method_id: record.method_id,
    indicated_date: record.indicated_date, scheduled_date: record.scheduled_date, water_l_ha: record.water_l_ha, observations: record.observations,
    source_text: record.source_text ?? '', source_capture: imageSourceCaptureKey(record.source_capture), source_group_id: record.source_group_id ?? null, recipe_source: record.recipe_source ? [record.recipe_source.order_id, record.recipe_source.revision, record.recipe_source.stage_id ?? null] : null, application_number: record.application_number ?? null, stage_ids: [...record.stage_ids].sort(), products: mixtureKey(record.products) })
}

function firstPerformance(data: WorkspaceData, target: ApplicationTarget): ApplicationActualSnapshot {
  const firstCorrection = (data.applicationChanges ?? []).filter(change => change.kind === 'performance' && change.target_id === target.id && change.order_id === target.order_id)
    .reduce<(typeof data.applicationChanges)[number] | undefined>((first, change) => !first || change.version < first.version ? change : first, undefined)
  if (firstCorrection) return structuredClone(firstCorrection.before as ApplicationActualSnapshot)
  return { actual_date: target.actual_date!, water_l_ha: target.actual_water_l_ha!, products: target.actual_products, equipment: target.equipment, applicator: target.applicator, observations: target.actual_observations, has_changes: target.has_changes }
}

function performance(data: WorkspaceData, command: Extract<WorkspaceCommand, { type: 'perform_application_targets' }>, target: ApplicationTarget) {
  const order = data.applicationOrders.find(o => o.id === command.order_id) ?? fail('No se encontró la orden.')
  const indication = indicationForTarget(data, order, target)
  const values: ApplicationPerformanceInput = command.data
  if (!validDate(values.actual_date) || values.actual_date < indication.indicated_date || values.actual_date > today()) fail('La fecha real debe ser válida, igual o posterior a la indicación histórica del destino y no futura.')
  const historical = target.status === 'performed' ? firstPerformance(data, target).products : []
  const products = values.changed ? productLines(data, values.products ?? [], [...historical, ...indication.products]) : structuredClone(indication.products)
  const water = values.changed ? values.water_l_ha! : indication.water_l_ha
  positive(water, 'El gasto de agua')
  return { order, actual_date: values.actual_date, actual_products: products, actual_water_l_ha: water, equipment: trim(values.equipment), applicator: trim(values.applicator), actual_observations: trim(values.observations), has_changes: water !== indication.water_l_ha || mixtureKey(products) !== mixtureKey(indication.products) }
}

export function applyApplicationCommand(data: WorkspaceData, command: WorkspaceCommand, profile: UserProfile): boolean {
  if (applyApplicationEditing(data, profile, command)) return true
  if (!['create_application_order', 'perform_application_targets', 'cancel_application_targets', 'save_sowing_group'].includes(command.type)) return false
  if (profile.role !== 'admin') fail('Solo la administración puede guardar aplicaciones.')
  switch (command.type) {
    case 'create_application_order': {
      const record = command.record
      if (record.application_number !== undefined && (!Number.isInteger(record.application_number) || record.application_number < 1 || record.application_number > 2147483647)) fail('El número de aplicación debe ser un entero positivo válido.')
      if (record.source_text !== undefined && (typeof record.source_text !== 'string' || record.source_text.length > 20000)) fail('El mensaje original debe ser texto de hasta 20,000 caracteres.')
      const sourceCapture = record.source_capture == null ? null : validateImageSourceCapture(record.source_capture)
      const existing = data.applicationOrders.find(o => o.id === record.id)
      if (existing) {
        const previous = { ...existing, application_number: existing.application_number, source_text: existing.source_text, stage_ids: data.applicationTargets.filter(t => t.order_id === existing.id).map(t => t.stage_id), products: existing.products.map(p => ({ product_id: p.product_id, dose: p.dose })) }
        // Compare only creation inputs: presentation snapshots/folio never change a retry.
        if (requestKey(previous) !== requestKey(record)) fail('Ese identificador ya pertenece a otra indicación.')
        return true
      }
      const stages = destinations(data, record.stage_ids, record.project_id, record.field_id, record.crop_id)
      if (sourceCapture) validateImageOrderSourceCapture(sourceCapture, stages.map(stage => ({ stage_id: stage.id, area_ha: stage.area_ha })), data.catalogs.products, record.products)
      const groupOrigin = applicationGroupOrigin(data, record)
      validateRecipeSource(data, record)
      if (!validDate(record.indicated_date) || !validDate(record.scheduled_date) || record.scheduled_date < record.indicated_date) fail('La fecha programada debe ser igual o posterior a la indicación.')
      if (stages.some(stage => !stage.actual_sowing_date || record.indicated_date < stage.actual_sowing_date)) fail('La indicación no puede ser anterior a la siembra real de sus destinos.')
      positive(record.water_l_ha, 'El gasto de agua')
      const method = data.catalogs.application_methods.find(m => m.id === record.method_id && m.active) ?? fail('Selecciona un medio de aplicación activo.')
      const products = productLines(data, record.products)
      const applicationNumbers = new Map(stages.map(stage => [stage.id, record.application_number ?? nextStageApplicationNumber(data, stage.id)]))
      for (const stage of stages) {
        const number = applicationNumbers.get(stage.id)!
        if (number > 2147483647) fail('La numeración de esta etapa alcanzó su límite.')
        if (data.applicationTargets.some(target => target.stage_id === stage.id && stageApplicationNumber(data, target) === number)) fail(`La aplicación ${number} ya está registrada en una de las etapas seleccionadas.`)
      }
      const nextNumber = Math.max(0, ...data.applicationOrders.map(o => Number(o.folio.replace(/^APL-/, '')) || 0)) + 1
      const { stage_ids: _stageIds, ...order } = record
      data.applicationOrders.push({ ...order, source_capture: structuredClone(sourceCapture), ...groupOrigin, products, revision: 0, folio: `APL-${String(nextNumber).padStart(6, '0')}`, project_name: data.projects.find(p => p.id === record.project_id)!.name, field_name: data.catalogs.fields.find(f => f.id === record.field_id)!.name, crop_name: data.catalogs.crops.find(c => c.id === record.crop_id)!.name, method_name: method.name })
      for (const stage of stages) {
        const sub = data.subdivisions.find(s => s.id === stage.subdivision_id)!
        const lot = data.lots.find(l => l.id === sub.lot_id)!
        data.applicationTargets.push({ id: crypto.randomUUID(), order_id: record.id, stage_id: stage.id, group_memberships_snapshot: groupMembershipsAtCreation(data, record, stage.id), application_number: applicationNumbers.get(stage.id)!, indication_change_id: null, correction_version: 0, status: 'indicated', lot_name: lot.name, subdivision_name: sub.name, stage_number: stage.stage_number, crop_name: stage.crop_name_snapshot ?? data.catalogs.crops.find(c => c.id === stage.crop_id)!.name, variety_name: stage.variety_name_snapshot ?? data.catalogs.varieties.find(v => v.id === stage.variety_id)!.name, area_ha: stage.area_ha, actual_date: null, actual_water_l_ha: null, actual_products: [], equipment: '', applicator: '', actual_observations: '', cancellation_reason: '', has_changes: false })
      }
      return true
    }
    case 'perform_application_targets': {
      if (!command.target_ids.length || new Set(command.target_ids).size !== command.target_ids.length) fail('Selecciona destinos sin repetirlos.')
      const order = data.applicationOrders.find(item => item.id === command.order_id) ?? fail('No se encontró la orden.')
      const targets = command.target_ids.map(id => data.applicationTargets.find(t => t.id === id && t.order_id === command.order_id) ?? fail('Hay un destino que no pertenece a la orden.'))
      if (targets.some(target => target.status === 'indicated')) {
        const expected = command.data.expected_revision
        if (expected === undefined ? (order.revision ?? 0) > 0 : !Number.isSafeInteger(expected) || expected < 0 || expected !== (order.revision ?? 0)) fail('La indicación cambió desde que abriste la realización. Actualiza y revisa los valores vigentes antes de confirmar.')
      }
      const pending = new Map<string, ReturnType<typeof performance>>()
      for (const target of targets) {
        if (target.status === 'cancelled') fail('Una aplicación cancelada no puede realizarse.')
        const actual = performance(data, command, target)
        if (target.status === 'performed') {
          const initial = firstPerformance(data, target)
          if (initial.actual_date !== actual.actual_date || initial.water_l_ha !== actual.actual_water_l_ha || mixtureKey(initial.products) !== mixtureKey(actual.actual_products) || initial.equipment !== actual.equipment || initial.applicator !== actual.applicator || initial.observations !== actual.actual_observations) fail('Ese destino ya fue realizado con otros datos y conserva su historia y correcciones.')
          continue
        }
        destinations(data, [target.stage_id], actual.order.project_id, actual.order.field_id, actual.order.crop_id)
        const stage = data.stages.find(s => s.id === target.stage_id)!
        if (actual.actual_date < stage.actual_sowing_date!) fail('La realización no puede ser anterior a la siembra real.')
        pending.set(target.id, actual)
      }
      for (const target of targets.filter(t => t.status === 'indicated')) {
        const { order: _order, ...values } = pending.get(target.id)!
        Object.assign(target, structuredClone(values), { status: 'performed' })
      }
      return true
    }
    case 'cancel_application_targets': {
      const reason = trim(command.reason)
      if (!reason) fail('El motivo de cancelación es obligatorio.')
      if (!data.applicationOrders.some(o => o.id === command.order_id)) fail('No se encontró la orden.')
      if (!command.target_ids.length || new Set(command.target_ids).size !== command.target_ids.length) fail('Selecciona destinos sin repetirlos.')
      const targets = command.target_ids.map(id => data.applicationTargets.find(t => t.id === id && t.order_id === command.order_id) ?? fail('Hay un destino que no pertenece a la orden.'))
      if (targets.some(t => t.status === 'performed' || t.status === 'cancelled' && t.cancellation_reason !== reason)) fail('Solo se pueden cancelar destinos indicados; los resultados previos se conservan.')
      targets.forEach(target => Object.assign(target, { status: 'cancelled', cancellation_reason: reason }))
      return true
    }
    case 'save_sowing_group': {
      const record = command.record
      if (!trim(record.name)) fail('El nombre del grupo es obligatorio.')
      if (data.sowingGroups.some(g => g.id !== record.id && g.project_id === record.project_id && g.field_id === record.field_id && normalized(g.name) === normalized(record.name))) fail('Ya existe un grupo con ese nombre en el campo.')
      const existing = data.sowingGroups.find(g => g.id === record.id)
      if (existing && (existing.project_id !== record.project_id || existing.field_id !== record.field_id || existing.crop_id !== record.crop_id)) fail('El ámbito de un grupo existente no se puede cambiar.')
      if (record.stage_ids.length !== new Set(record.stage_ids).size) fail('Los integrantes del grupo no pueden repetirse.')
      if (record.stage_ids.length || record.active) destinations(data, record.stage_ids, record.project_id, record.field_id, record.crop_id)
      else if (!existing) {
        const project = data.projects.find(p => p.id === record.project_id && p.status === 'active')
        if (!project || !data.catalogs.fields.some(f => f.id === record.field_id && f.active && f.agricultural_unit_id === project.agricultural_unit_id) || !data.catalogs.crops.some(c => c.id === record.crop_id && c.active)) fail('Selecciona una temporada, campo y cultivo vigentes para el grupo.')
      }
      if (existing) {
        const historical = [...new Set([...(existing.historical_stage_ids ?? []), ...existing.stage_ids.filter(id => !record.stage_ids.includes(id))])].filter(id => !record.stage_ids.includes(id))
        Object.assign(existing, structuredClone(record), { name: trim(record.name), historical_stage_ids: historical })
      }
      else data.sowingGroups.push({ ...record, name: trim(record.name), id: record.id ?? crypto.randomUUID() })
      return true
    }
  }
  return false
}
