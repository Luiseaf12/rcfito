import { applicationRoute, validateApplicationWater } from './application-routes.ts'
import { currentOrderIndication, indicationForTarget } from './application-editing.ts'
import { applicationOriginLabel } from './application-groups.ts'
import type { ApplicationTarget, ProductLine, UserProfile, WorkspaceData } from './model'

export type SavedRecipeDocument = {
  order_id: string; folio: string; revision: number; generated_at: string; exported_by: string
  agricultural_unit: string; project: string; season: string; field: string; crop: string; selection: string
  application_route?: import('./model').ApplicationRoute; method: string; indicated_date: string; scheduled_date: string; water_l_ha: number | null; observations: string
  source: { folio: string; revision: number } | null
  products: ProductLine[]
  targets: { id: string; lot: string; subdivision: string; stage_number: number; variety: string; area_ha: number; application_number: number | null; status: ApplicationTarget['status']; indication_revision: number; area_correction?: { version: number; changed_at: string; previous_area_ha: number } }[]
}

/** Read-only copy of the latest saved indication; historical targets retain their own revision. */
export function snapshotSavedRecipe(data: WorkspaceData, profile: UserProfile, orderId: string, generatedAt: string): SavedRecipeDocument {
  const order = data.applicationOrders.find(item => item.id === orderId)
  const project = data.projects.find(item => item.id === order?.project_id)
  if (!order || !project || (profile.role !== 'admin' && (profile.role !== 'reader' || !data.assignments.some(item => item.user_id === profile.id && item.agricultural_unit_id === project.agricultural_unit_id)))) throw new Error('La receta no está disponible para tu usuario. Actualiza la consulta.')
  if (!Number.isFinite(Date.parse(generatedAt))) throw new Error('No se pudo preparar la fecha de exportación.')
  const indication = currentOrderIndication(data, order)
  if (!indication.products.length || indication.products.some(item => !item.product_name || !Number.isFinite(item.dose) || item.dose <= 0 || !['g', 'ml'].includes(item.unit))) throw new Error('La receta guardada no tiene una mezcla válida para exportar. Actualiza la consulta.')
  validateApplicationWater(indication.water_l_ha, applicationRoute(order))
  const targets = data.applicationTargets.filter(item => item.order_id === order.id).map(target => {
    indicationForTarget(data, order, target)
    const change = target.indication_change_id ? data.applicationChanges.find(item => item.id === target.indication_change_id) : undefined
    const areaChange = target.area_correction_id ? data.lotCorrections?.find(item => item.id === target.area_correction_id) : undefined
    const areaBefore = areaChange?.before.targets.find(item => item.id === target.id)
    if (target.area_correction_id && (!areaChange || !areaBefore)) throw new Error('No se encontró el historial de la superficie corregida. Actualiza la consulta.')
    return { id: target.id, lot: target.lot_name, subdivision: target.subdivision_name, stage_number: target.stage_number, variety: target.variety_name, area_ha: target.area_ha, application_number: target.application_number ?? order.application_number ?? null, status: target.status, indication_revision: change?.version ?? 0, ...(areaChange && areaBefore ? { area_correction: { version: areaChange.version, changed_at: areaChange.changed_at, previous_area_ha: areaBefore.area_ha } } : {}) }
  }).sort((a, b) => a.lot.localeCompare(b.lot, 'es', { numeric: true }) || a.subdivision.localeCompare(b.subdivision, 'es', { numeric: true }) || a.stage_number - b.stage_number || a.id.localeCompare(b.id))
  if (!targets.length) throw new Error('No se encontraron los destinos guardados. Actualiza la consulta antes de exportar.')
  const name = (kind: keyof WorkspaceData['catalogs'], id: string) => data.catalogs[kind].find(item => item.id === id)?.name ?? 'No registrado'
  const source = order.recipe_source
  return {
    order_id: order.id, folio: order.folio, revision: order.revision ?? 0, generated_at: new Date(generatedAt).toISOString(), exported_by: profile.full_name,
    agricultural_unit: name('agricultural_units', project.agricultural_unit_id), project: order.project_name || project.name, season: project.season,
    field: order.field_name || name('fields', order.field_id), crop: order.crop_name || name('crops', order.crop_id), selection: applicationOriginLabel(order),
    application_route: applicationRoute(order), method: indication.method_name || name('application_methods', indication.method_id), indicated_date: indication.indicated_date, scheduled_date: indication.scheduled_date,
    water_l_ha: indication.water_l_ha, observations: indication.observations, products: structuredClone(indication.products), targets,
    source: source ? { folio: data.applicationOrders.find(item => item.id === source.order_id)?.folio ?? 'Referencia no disponible', revision: source.revision } : null,
  }
}

export async function savedRecipeReference(snapshot: SavedRecipeDocument) {
  const { generated_at: _generatedAt, ...content } = snapshot
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(content)))
  const hash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
  return { reference: `RC-${hash.slice(0, 16).toUpperCase()}`, hash }
}
