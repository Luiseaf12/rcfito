import type { ApplicationTarget, CatalogRecord, LotSubdivision, ProjectLot, SowingStage, WorkspaceData } from './model'

export type ExtractedProduct = { name: string; dose: number | null; unit: 'g' | 'ml' | null }
export type ExtractedApplication = {
  agricultural_unit: string | null
  destinations: string[]
  application_number: number | null
  crop: string | null
  field: string | null
  method: string | null
  indicated_date: string | null
  scheduled_date: string | null
  water_l_ha: number | null
  note: string
  products: ExtractedProduct[]
}

const extractedKeys = ['agricultural_unit', 'destinations', 'application_number', 'crop', 'field', 'method', 'indicated_date', 'scheduled_date', 'water_l_ha', 'note', 'products']
const fail = (field: string): never => { throw new Error(`La interpretación contiene un valor no válido en ${field}. Revisa el mensaje e inténtalo de nuevo.`) }
const object = (value: unknown, field: string): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fail(field)
  return value as Record<string, unknown>
}
const onlyKeys = (value: Record<string, unknown>, keys: readonly string[], field: string) => {
  if (Object.keys(value).some(key => !keys.includes(key))) fail(field)
}
const text = (value: unknown, field: string, limit = 200): string | null => {
  if (value == null) return null
  if (typeof value !== 'string' || value.length > limit || /\u0000/.test(value)) return fail(field)
  return value.trim() || null
}
const positive = (value: unknown, field: string, decimals: number): number | null => {
  if (value == null) return null
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value >= 100_000_000 || Number(value.toFixed(decimals)) !== value) return fail(field)
  return value
}
const date = (value: unknown, field: string): string | null => {
  const result = text(value, field, 10)
  if (!result) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result)) return fail(field)
  const parsed = new Date(`${result}T12:00:00Z`)
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== result) return fail(field)
  return result
}

/** Validate a model response without guessing missing identifiers, dates or units. */
export function validateExtractedApplication(value: unknown): ExtractedApplication {
  const raw = object(value, 'la respuesta')
  onlyKeys(raw, extractedKeys, 'la respuesta')
  const names = raw.destinations ?? []
  if (!Array.isArray(names) || names.length > 100) return fail('destinos')
  const destinations = names.map((name, index) => text(name, `destino ${index + 1}`) ?? fail(`destino ${index + 1}`))
  if (new Set(destinations.map(normalizeImportName)).size !== destinations.length) return fail('destinos repetidos')
  const sourceProducts = raw.products ?? []
  if (!Array.isArray(sourceProducts) || sourceProducts.length > 40) return fail('productos')
  const products = sourceProducts.map((source, index): ExtractedProduct => {
    const row = object(source, `producto ${index + 1}`)
    onlyKeys(row, ['name', 'dose', 'unit'], `producto ${index + 1}`)
    const unit = row.unit ?? null
    if (unit !== null && unit !== 'g' && unit !== 'ml') return fail(`unidad del producto ${index + 1}`)
    return { name: text(row.name, `nombre del producto ${index + 1}`) ?? fail(`nombre del producto ${index + 1}`), dose: positive(row.dose, `dosis del producto ${index + 1}`, 6), unit }
  })
  const applicationNumber = raw.application_number ?? null
  if (applicationNumber !== null && (typeof applicationNumber !== 'number' || !Number.isSafeInteger(applicationNumber) || applicationNumber <= 0 || applicationNumber > 2_147_483_647)) return fail('número de aplicación')
  // Notes are user content. Preserve wording, whitespace and line breaks for review.
  const note = raw.note ?? ''
  if (typeof note !== 'string' || note.length > 4000 || /\u0000/.test(note)) return fail('nota')
  return {
    agricultural_unit: text(raw.agricultural_unit, 'agrícola'), destinations, application_number: applicationNumber,
    crop: text(raw.crop, 'cultivo'), field: text(raw.field, 'campo'), method: text(raw.method, 'medio'),
    indicated_date: date(raw.indicated_date, 'fecha de indicación'), scheduled_date: date(raw.scheduled_date, 'fecha programada'),
    water_l_ha: positive(raw.water_l_ha, 'agua por hectárea', 4), note, products,
  }
}

/** Normalization is used only for comparisons; original names remain visible. */
export const normalizeImportName = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('es-MX')

export type ImportedProductMatch = {
  sourceName: string
  productId: string
  dose: string
  unit: 'g' | 'ml' | null
  candidates: CatalogRecord[]
  issue: string
}

export function matchImportedProducts(products: readonly ExtractedProduct[], catalogProducts: readonly CatalogRecord[]): ImportedProductMatch[] {
  const active = catalogProducts.filter(product => product.active)
  return products.map(source => {
    const name = normalizeImportName(source.name)
    const exact = active.filter(product => normalizeImportName(product.name) === name)
    const product = exact.length === 1 ? exact[0] : undefined
    const candidates = exact.length ? exact : active.filter(candidate => {
      const candidateName = normalizeImportName(candidate.name)
      return name.length >= 3 && (candidateName.includes(name) || name.includes(candidateName))
    }).slice(0, 10)
    const issue = !product ? exact.length > 1 ? 'Hay varias coincidencias de nombre. Selecciona el producto correcto.' : 'Selecciona un producto activo del catálogo.'
      : source.unit === null ? 'Confirma la unidad del mensaje antes de aprobar.'
      : product.unit !== source.unit ? `El mensaje usa ${source.unit}/ha y el catálogo ${product.unit ?? 'una unidad sin definir'}/ha. Aclara la unidad antes de aprobar.`
      : source.dose === null ? 'Completa la dosis del mensaje antes de aprobar.' : ''
    return { sourceName: source.name, productId: product?.id ?? '', dose: source.dose == null ? '' : String(source.dose), unit: source.unit, candidates, issue }
  })
}

export type ImportDestination = { stage: SowingStage; lot: ProjectLot; subdivision: LotSubdivision }
export type ImportContextOverrides = { agriculturalUnitId?: string; projectId?: string; fieldId?: string; cropId?: string }
export type ImportContext = {
  agriculturalUnitId: string
  projectId: string
  fieldId: string
  cropId: string
  methodId: string
  candidateDestinations: ImportDestination[]
  selectedStageIds: string[]
  unresolvedDestinations: string[]
  suggestedCropId: string
  cropSuggestionReason: string
  warnings: string[]
}

const unique = <T>(values: readonly T[]) => [...new Set(values)]
const uniqueRecord = (records: readonly CatalogRecord[], name: string | null) => {
  if (!name) return ''
  const needle = normalizeImportName(name)
  const matches = records.filter(record => record.active && (normalizeImportName(record.name) === needle || record.code && normalizeImportName(record.code) === needle))
  return matches.length === 1 ? matches[0].id : ''
}
const destinationName = (value: string) => normalizeImportName(value)
  .replace(/\bmallas\b/g, 'malla').replace(/([a-z])(?=\d)|(?<=\d)(?=[a-z])/g, '$1 ')
  .replace(/[\s/_.-]+/g, ' ').replace(/\b0+(\d+)\b/g, '$1').trim()
const matchesDestination = (destination: ImportDestination, name: string) => {
  const { lot, subdivision } = destination
  const aliases = [lot.name, lot.code, subdivision.name, `${lot.name} ${subdivision.name}`, lot.code && `${lot.code} ${subdivision.name}`].filter((value): value is string => Boolean(value))
  return aliases.some(alias => destinationName(alias) === destinationName(name))
}

/** Resolve only unambiguous references from the already authorized workspace. */
export function resolveImportContext(data: WorkspaceData, extracted: ExtractedApplication, overrides: ImportContextOverrides = {}): ImportContext {
  const warnings: string[] = []
  const activeUnits = data.catalogs.agricultural_units.filter(unit => unit.active)
  let agriculturalUnitId = overrides.agriculturalUnitId === undefined ? uniqueRecord(activeUnits, extracted.agricultural_unit) : activeUnits.find(unit => unit.id === overrides.agriculturalUnitId)?.id ?? ''
  const overriddenProject = overrides.projectId ? data.projects.find(project => project.id === overrides.projectId && project.status === 'active' && (!agriculturalUnitId || project.agricultural_unit_id === agriculturalUnitId) && activeUnits.some(unit => unit.id === project.agricultural_unit_id)) : undefined
  if (overriddenProject && !agriculturalUnitId && overrides.agriculturalUnitId === undefined) agriculturalUnitId = overriddenProject.agricultural_unit_id
  const projects = data.projects.filter(project => project.status === 'active' && project.agricultural_unit_id === agriculturalUnitId)
  const projectId = overrides.projectId === undefined ? projects.length === 1 ? projects[0].id : '' : overriddenProject?.id ?? ''
  const fields = data.catalogs.fields.filter(field => field.active && field.agricultural_unit_id === agriculturalUnitId)
  let fieldId = overrides.fieldId === undefined ? uniqueRecord(fields, extracted.field) : fields.find(field => field.id === overrides.fieldId)?.id ?? ''
  const crops = data.catalogs.crops.filter(crop => crop.active)
  let cropId = overrides.cropId === undefined ? uniqueRecord(crops, extracted.crop) : crops.find(crop => crop.id === overrides.cropId)?.id ?? ''
  const methodId = uniqueRecord(data.catalogs.application_methods, extracted.method)
  if (extracted.agricultural_unit && !agriculturalUnitId) warnings.push('Selecciona la agrícola: el nombre del mensaje no tiene una coincidencia única activa.')
  if (agriculturalUnitId && !projectId) warnings.push('Selecciona una temporada activa de la agrícola.')
  if (extracted.field && !fieldId) warnings.push('Selecciona el campo: el nombre del mensaje no tiene una coincidencia única activa.')
  if (extracted.crop && !cropId) warnings.push('Selecciona el cultivo: el nombre del mensaje no tiene una coincidencia única activa.')
  const lots = new Map(data.lots.filter(lot => lot.project_id === projectId && lot.active !== false && fields.some(field => field.id === lot.field_id)).map(lot => [lot.id, lot]))
  const subdivisions = new Map(data.subdivisions.filter(subdivision => subdivision.active && lots.has(subdivision.lot_id)).map(subdivision => [subdivision.id, subdivision]))
  const available: ImportDestination[] = data.stages.filter(stage => stage.status === 'planted' && Boolean(stage.actual_sowing_date) && subdivisions.has(stage.subdivision_id) && crops.some(crop => crop.id === stage.crop_id)).map(stage => {
    const subdivision = subdivisions.get(stage.subdivision_id)!
    return { stage, subdivision, lot: lots.get(subdivision.lot_id)! }
  })
  const resolveNames = (field: string, crop: string) => extracted.destinations.map(name => ({ name, matches: available.filter(destination => matchesDestination(destination, name) && (!field || destination.lot.field_id === field) && (!crop || destination.stage.crop_id === crop)) }))
  let resolved = resolveNames(fieldId, cropId)
  const unambiguous = () => resolved.filter(row => row.matches.length === 1).map(row => row.matches[0])
  const inferredFields = unique(unambiguous().map(destination => destination.lot.field_id))
  if (!fieldId && overrides.fieldId === undefined && !extracted.field && inferredFields.length === 1) fieldId = inferredFields[0]
  if (inferredFields.length > 1 && !fieldId) warnings.push('Los destinos pertenecen a distintos campos. Selecciona destinos de un mismo campo para la orden.')
  resolved = resolveNames(fieldId, cropId)
  const matched = unambiguous()
  let suggestedCropId = ''
  let cropSuggestionReason = ''
  if (!extracted.crop && matched.length && resolved.every(row => row.matches.length === 1)) {
    const orders = new Map(data.applicationOrders.map(order => [order.id, order]))
    const histories = matched.map(destination => {
      const previous = data.applicationTargets.filter(target => {
        const order = orders.get(target.order_id)
        const applicationNumber = (target as ApplicationTarget & { application_number?: number }).application_number
        return target.stage_id === destination.stage.id && target.status !== 'cancelled' && order?.project_id === projectId && (!extracted.application_number || !applicationNumber || applicationNumber < extracted.application_number) && (!extracted.indicated_date || order.indicated_date <= extracted.indicated_date)
      }).sort((left, right) => {
        const leftNumber = (left as ApplicationTarget & { application_number?: number }).application_number
        const rightNumber = (right as ApplicationTarget & { application_number?: number }).application_number
        const leftOrder = orders.get(left.order_id)!, rightOrder = orders.get(right.order_id)!
        return leftNumber && rightNumber && leftNumber !== rightNumber ? rightNumber - leftNumber : rightOrder.indicated_date.localeCompare(leftOrder.indicated_date) || rightOrder.scheduled_date.localeCompare(leftOrder.scheduled_date) || rightOrder.folio.localeCompare(leftOrder.folio)
      })[0]
      return { destination, previous: previous ? orders.get(previous.order_id) : undefined }
    })
    const priorCrops = unique(histories.map(history => history.previous?.crop_id).filter((id): id is string => Boolean(id)))
    const currentCrops = unique(matched.map(destination => destination.stage.crop_id))
    const compatibleHistory = histories.every(history => !history.previous || history.previous.field_id === history.destination.lot.field_id && history.previous.crop_id === history.destination.stage.crop_id)
    if (histories.every(history => history.previous) && compatibleHistory && priorCrops.length === 1) {
      suggestedCropId = priorCrops[0]
      cropSuggestionReason = 'Cultivo de la aplicación anterior de las mismas etapas, coincidente con sus siembras vigentes.'
      if (overrides.cropId === undefined) cropId = suggestedCropId
    } else if (compatibleHistory && currentCrops.length === 1 && unique(matched.map(destination => destination.lot.field_id)).length === 1) {
      suggestedCropId = currentCrops[0]
      cropSuggestionReason = 'Cultivo tomado de las siembras vigentes del proyecto. No se requiere una aplicación anterior.'
      if (overrides.cropId === undefined) cropId = suggestedCropId
    } else {
      cropSuggestionReason = compatibleHistory ? 'Los destinos no tienen un único campo y cultivo. Revisa las siembras y selecciona el cultivo.' : 'El historial y las siembras no permiten sugerir un cultivo común. Revisa las etapas y selecciona el cultivo.'
      warnings.push(cropSuggestionReason)
    }
  } else if (!extracted.crop && !matched.length) {
    cropSuggestionReason = 'Selecciona las siembras para consultar su aplicación anterior.'
  }
  resolved = resolveNames(fieldId, cropId)
  const unresolvedDestinations = resolved.filter(row => row.matches.length !== 1).map(row => row.name)
  for (const row of resolved) {
    if (row.matches.length !== 1) warnings.push(row.matches.length ? `«${row.name}» corresponde a varias siembras vigentes. Selecciona su destino explícitamente.` : `No hay una siembra vigente de «${row.name}» en el contexto seleccionado. Revisa sus destinos.`)
  }
  if (!extracted.destinations.length) warnings.push('Selecciona los destinos de la aplicación; el mensaje no los identifica.')
  const selected = unique(resolved.filter(row => row.matches.length === 1).map(row => row.matches[0].stage.id))
  const selectedRows = available.filter(destination => selected.includes(destination.stage.id))
  const incompatible = unique(selectedRows.map(destination => destination.lot.field_id)).length > 1 || unique(selectedRows.map(destination => destination.stage.crop_id)).length > 1
  if (incompatible) warnings.push('La orden requiere destinos del mismo campo y cultivo. Revisa la selección antes de aprobar.')
  return {
    agriculturalUnitId, projectId, fieldId, cropId, methodId,
    candidateDestinations: available.filter(destination => (!fieldId || destination.lot.field_id === fieldId) && (!cropId || destination.stage.crop_id === cropId)),
    selectedStageIds: incompatible ? [] : selected, unresolvedDestinations,
    suggestedCropId, cropSuggestionReason, warnings: unique(warnings),
  }
}
