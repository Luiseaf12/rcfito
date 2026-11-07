import { methodRoute, targetRoute } from './application-routes.ts'
import { nextStageApplicationNumber, stageApplicationNumber } from './applications.ts'
import type { SowingStage, WorkspaceData } from './model'

export type ApplicationDraftForm = {
  project_id: string
  field_id: string
  crop_id: string
  method_id: string
  indicated_date: string
  scheduled_date: string
  water_l_ha: string
  observations: string
  application_number: string
}
export type ApplicationDraftProduct = { product_id: string; dose: string; sourceName?: string; importUnit?: 'g' | 'ml' | null }
export type ApplicationDraftIssue = { field: string; message: string }
type ApplicationDraftReview = { imported: boolean; unresolvedDestinations: string[]; destinationsReviewed: boolean; numberReviewed: boolean }

function calendarDate(value: string): boolean {
  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value) || Number(value.slice(0, 4)) < 1) return false
  const parsed = new Date(`${value}T12:00:00Z`)
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

function amountIssue(raw: string, decimals: number, label: string): string {
  if (!raw.trim()) return `Captura ${label}.`
  const subject = label.charAt(0).toLocaleUpperCase('es-MX') + label.slice(1)
  const value = Number(raw)
  if (!Number.isFinite(value) || value <= 0) return `${subject} debe ser un número mayor que cero.`
  if (value >= 100_000_000) return `${subject} debe ser menor que 100,000,000 para poder guardarse.`
  if (Number(value.toFixed(decimals)) !== value) return `${subject} admite como máximo ${decimals} decimales; revisa el valor sin redondearlo automáticamente.`
  return ''
}

/** The same blocking issues drive both the approval button and final submission. */
export function applicationDraftIssues(data: WorkspaceData, form: ApplicationDraftForm, rows: ApplicationDraftProduct[], selectedStageIds: string[], review: ApplicationDraftReview): ApplicationDraftIssue[] {
  const issues: ApplicationDraftIssue[] = []
  const byField = new Map<string, ApplicationDraftIssue>()
  const add = (field: string, message: string) => {
    const previous = byField.get(field)
    if (previous) {
      if (!previous.message.includes(message)) previous.message += ` ${message}`
    } else {
      const issue = { field, message }
      byField.set(field, issue)
      issues.push(issue)
    }
  }
  const project = data.projects.find(item => item.id === form.project_id)
  const agriculturalUnit = data.catalogs.agricultural_units.find(item => item.id === project?.agricultural_unit_id)
  if (!form.project_id) add('project_id', 'Selecciona el proyecto de temporada de la aplicación.')
  else if (!project || project.status !== 'active') add('project_id', 'El proyecto seleccionado no está activo. Selecciona una temporada vigente.')
  else if (!agriculturalUnit?.active) add('project_id', 'La agrícola del proyecto no está activa. Selecciona un proyecto de una agrícola activa.')

  const field = data.catalogs.fields.find(item => item.id === form.field_id)
  if (!form.field_id) add('field_id', 'Selecciona el campo de la aplicación.')
  else if (!field?.active) add('field_id', 'El campo seleccionado no está disponible. Selecciona un campo activo.')
  else if (project && field.agricultural_unit_id !== project.agricultural_unit_id) add('field_id', 'El campo seleccionado no pertenece a la agrícola de este proyecto.')

  const crop = data.catalogs.crops.find(item => item.id === form.crop_id)
  if (!form.crop_id) add('crop_id', 'Selecciona el cultivo de las siembras que recibirán la aplicación.')
  else if (!crop?.active) add('crop_id', 'El cultivo seleccionado no está disponible. Selecciona un cultivo activo.')

  const method = data.catalogs.application_methods.find(item => item.id === form.method_id)
  if (!form.method_id) add('method_id', 'Selecciona el medio de aplicación.')
  else if (!method?.active) add('method_id', 'El medio de aplicación seleccionado ya no está activo. Selecciona otro medio.')

  const indicatedIsValid = calendarDate(form.indicated_date)
  const scheduledIsValid = calendarDate(form.scheduled_date)
  if (!form.indicated_date) add('indicated_date', 'Selecciona la fecha de indicación.')
  else if (!indicatedIsValid) add('indicated_date', 'La fecha de indicación no es una fecha de calendario válida.')
  if (!form.scheduled_date) add('scheduled_date', 'Selecciona la fecha programada de aplicación.')
  else if (!scheduledIsValid) add('scheduled_date', 'La fecha programada no es una fecha de calendario válida.')
  if (indicatedIsValid && scheduledIsValid && form.scheduled_date < form.indicated_date) add('scheduled_date', 'La fecha programada debe ser igual o posterior a la fecha de indicación.')

  const route = methodRoute(data, form.method_id)
  const waterIssue = route === 'irrigation' && !form.water_l_ha.trim() ? null : amountIssue(form.water_l_ha, 4, 'el gasto de agua en L/ha')
  if (waterIssue) add('water_l_ha', waterIssue)
  if (form.observations.length > 4000) add('observations', `La Nota de la aplicación tiene ${form.observations.length.toLocaleString('es-MX')} caracteres; el máximo es 4,000.`)
  if (form.observations.includes('\u0000')) add('observations', 'La Nota de la aplicación contiene un carácter nulo que no puede guardarse. Retíralo del texto.')

  const stages = new Map(data.stages.map(stage => [stage.id, stage]))
  const subdivisions = new Map(data.subdivisions.map(subdivision => [subdivision.id, subdivision]))
  const lots = new Map(data.lots.map(lot => [lot.id, lot]))
  const validDestinations: { stage: SowingStage; label: string }[] = []
  const numberReferences: { id: string; label: string }[] = []
  if (!selectedStageIds.length) add('destinations', 'Selecciona al menos una etapa sembrada como destino de la aplicación.')
  if (new Set(selectedStageIds).size !== selectedStageIds.length) add('destinations', 'La selección repite una etapa. Incluye cada destino una sola vez.')
  for (const [index, id] of [...new Set(selectedStageIds)].entries()) {
    const stage = stages.get(id)
    const subdivision = stage ? subdivisions.get(stage.subdivision_id) : undefined
    const lot = subdivision ? lots.get(subdivision.lot_id) : undefined
    const label = lot && subdivision && stage ? `${lot.name} · ${subdivision.name} · Etapa ${stage.stage_number}` : `El destino ${index + 1}`
    numberReferences.push({ id, label })
    if (!stage || !subdivision || !lot) { add('destinations', `${label} ya no está disponible. Actualiza la selección de destinos.`); continue }
    if (stage.status !== 'planted' || stage.closed_at || !subdivision.active || lot.active === false) { add('destinations', `${label} no es una siembra vigente disponible. Selecciona una etapa sembrada activa.`); continue }
    if (form.project_id && lot.project_id !== form.project_id || form.field_id && lot.field_id !== form.field_id || form.crop_id && stage.crop_id !== form.crop_id) { add('destinations', `${label} no corresponde al proyecto, campo y cultivo seleccionados. Revisa el contexto o retira ese destino.`); continue }
    if (!stage.actual_sowing_date || !calendarDate(stage.actual_sowing_date)) { add('destinations', `${label} no tiene una fecha real de siembra válida. Revisa su registro de siembra.`); continue }
    if (!Number.isFinite(stage.area_ha) || stage.area_ha <= 0) { add('destinations', `${label} no tiene una superficie sembrada válida. Revisa su registro de siembra.`); continue }
    validDestinations.push({ stage, label })
    if (indicatedIsValid && form.indicated_date < stage.actual_sowing_date) add('indicated_date', `La fecha de indicación es anterior a la siembra real de ${label} (${stage.actual_sowing_date}).`)
  }
  if (review.imported && review.unresolvedDestinations.length && !review.destinationsReviewed) add('destinations_review', `Confirma que la selección representa los destinos pendientes del mensaje: ${[...new Set(review.unresolvedDestinations)].join(', ')}.`)

  if (!rows.length) add('products', 'Agrega al menos un producto a la mezcla de la aplicación.')
  const catalogProducts = new Map(data.catalogs.products.map(product => [product.id, product]))
  const firstProductLine = new Map<string, number>()
  rows.forEach((row, index) => {
    const product = catalogProducts.get(row.product_id)
    const originalName = row.sourceName?.trim()
    const reference = `Renglón ${index + 1}${originalName || product ? ` (${originalName || product!.name})` : ''}`
    if (!row.product_id) add(`product:${index}`, `${reference}: selecciona el producto del catálogo.`)
    else if (!product?.active) add(`product:${index}`, `${reference}: el producto seleccionado no está activo o ya no existe. Selecciona un producto disponible.`)
    if (row.product_id) {
      const first = firstProductLine.get(row.product_id)
      if (first !== undefined) add(`product:${index}`, `${reference}: el producto está repetido en el renglón ${first + 1}. Conserva un solo renglón por producto.`)
      else firstProductLine.set(row.product_id, index)
    }
    const doseIssue = amountIssue(row.dose, 6, `la dosis del renglón ${index + 1}${originalName ? ` (${originalName})` : ''}`)
    if (doseIssue) add(`dose:${index}`, doseIssue)
    if (product && product.unit !== 'g' && product.unit !== 'ml') add(`unit:${index}`, `${reference}: el producto no tiene una unidad válida de catálogo (g o ml). Revisa el producto antes de aprobar.`)
    if (review.imported && row.sourceName !== undefined) {
      if (row.importUnit !== 'g' && row.importUnit !== 'ml') add(`unit:${index}`, `${reference}: confirma la unidad del mensaje (g/ha o ml/ha) y su dosis.`)
      else if (product && product.unit && product.unit !== row.importUnit) add(`unit:${index}`, `${reference}: el mensaje usa ${row.importUnit}/ha y el catálogo ${product.unit}/ha. Aclara la unidad y confirma la dosis.`)
    }
  })

  const rawNumber = form.application_number.trim()
  const requestedNumber = Number(rawNumber)
  const validNumber = !!rawNumber && Number.isSafeInteger(requestedNumber) && requestedNumber >= 1 && requestedNumber <= 2_147_483_647
  if (!rawNumber && review.imported) add('application_number', 'Completa el número de aplicación dentro de la etapa de siembra.')
  else if (rawNumber && !validNumber) add('application_number', 'El número de aplicación debe ser un entero entre 1 y 2,147,483,647.')
  if (validNumber) {
    const duplicates = numberReferences.filter(reference => data.applicationTargets.some(target => target.stage_id === reference.id && targetRoute(data, target) === route && stageApplicationNumber(data, target) === requestedNumber))
    if (duplicates.length) add('application_number', `La aplicación ${requestedNumber} ya está registrada en ${duplicates.map(destination => destination.label).join('; ')}. Revisa el historial; ese número no se puede repetir, aunque esté cancelado.`)
    else {
      const unusual = validDestinations.filter(({ stage }) => nextStageApplicationNumber(data, stage.id, route) !== requestedNumber)
      if (unusual.length && !review.numberReviewed) add('number_review', `Revisa y confirma la aplicación ${requestedNumber} en estas etapas: ${unusual.map(({ stage, label }) => `${label} (siguiente disponible: ${nextStageApplicationNumber(data, stage.id, route)})`).join('; ')}.`)
    }
  } else if (!rawNumber && !review.imported) {
    const exhausted = validDestinations.filter(({ stage }) => nextStageApplicationNumber(data, stage.id, route) > 2_147_483_647)
    if (exhausted.length) add('application_number', `La numeración automática alcanzó su límite en ${exhausted.map(destination => destination.label).join('; ')}. Revisa el historial antes de guardar.`)
  }
  return issues
}
