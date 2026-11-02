import { currentOrderIndication } from './application-editing.ts'
import type { ApplicationOrderInput, ApplicationRecipeSource, WorkspaceData } from './model'

export type RecipeCandidate = { order_id: string; stage_ids: string[]; revision: number; indicated_date: string }

/** All active bases for the selected current stages; group history requires explicit origin. */
export function recipeHistory(data: WorkspaceData, stageIds: string[], groupId?: string): RecipeCandidate[] {
  const selected = new Set(stageIds)
  const stagesByOrder = new Map<string, Set<string>>()
  for (const target of data.applicationTargets) {
    if (target.status === 'cancelled' || !selected.has(target.stage_id)) continue
    const stages = stagesByOrder.get(target.order_id) ?? new Set<string>()
    stages.add(target.stage_id)
    stagesByOrder.set(target.order_id, stages)
  }
  return data.applicationOrders.filter(order => stagesByOrder.has(order.id) && (!groupId || order.selection_origin === 'group' && order.source_group_id === groupId))
    .map(order => ({ order_id: order.id, revision: order.revision ?? 0, indicated_date: currentOrderIndication(data, order).indicated_date, stage_ids: [...stagesByOrder.get(order.id)!].sort() }))
    .sort((a, b) => b.indicated_date.localeCompare(a.indicated_date) || a.order_id.localeCompare(b.order_id))
}

/** The automatic suggestion preserves ties and separate subdivision histories. */
export function recipeCandidates(data: WorkspaceData, stageIds: string[], groupId?: string): RecipeCandidate[] {
  const history = recipeHistory(data, stageIds, groupId)
  if (groupId) return history.filter(candidate => candidate.indicated_date === history[0]?.indicated_date)
  const dates = new Map<string, string>()
  for (const candidate of history) for (const id of candidate.stage_ids) if (!dates.has(id)) dates.set(id, candidate.indicated_date)
  return history.map(candidate => ({ ...candidate, stage_ids: candidate.stage_ids.filter(id => dates.get(id) === candidate.indicated_date) })).filter(candidate => candidate.stage_ids.length)
}

const searchText = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es-MX').replace(/\s+/g, ' ').trim()

/** Search only the authorized, scoped history, using the latest indicated version. */
export function searchRecipes(data: WorkspaceData, history: RecipeCandidate[], query: string): RecipeCandidate[] {
  const terms = searchText(query).split(' ').filter(Boolean)
  if (!terms.length) return history
  const orders = new Map(data.applicationOrders.map(order => [order.id, order]))
  return history.filter(candidate => {
    const order = orders.get(candidate.order_id)
    if (!order) return false
    const indication = currentOrderIndication(data, order)
    const [year, month, day] = indication.indicated_date.split('-')
    const date = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${indication.indicated_date}T12:00:00Z`))
    const text = searchText([order.folio, indication.indicated_date, `${Number(day)}/${Number(month)}/${year}`, date, indication.method_name || data.catalogs.application_methods.find(item => item.id === indication.method_id)?.name || '', indication.observations, order.source_group_name ?? '', ...indication.products.map(product => product.product_name)].join(' '))
    const words = text.split(/[^a-z0-9]+/)
    return terms.every(term => term.length === 1 ? words.includes(term) : text.includes(term))
  })
}

/** A chosen base can be edited, but must still be the same active revision at save time. */
export function validateRecipeSource(data: WorkspaceData, record: ApplicationOrderInput): void {
  const source = record.recipe_source
  if (!source) return
  const order = data.applicationOrders.find(item => item.id === source.order_id)
  if (!order || !Number.isSafeInteger(source.revision) || source.revision < 0 || (order.revision ?? 0) !== source.revision) throw new Error('La receta base cambió. Vuelve a cargarla antes de guardar; tu captura se conserva.')
  if (order.project_id !== record.project_id || order.field_id !== record.field_id || order.crop_id !== record.crop_id) throw new Error('La receta base no pertenece al mismo proyecto, campo y cultivo.')
  if (record.source_group_id ? order.selection_origin !== 'group' || order.source_group_id !== record.source_group_id || source.stage_id != null : !source.stage_id || !record.stage_ids.includes(source.stage_id)) throw new Error('La receta base no corresponde al lote o grupo seleccionado.')
  if (!data.applicationTargets.some(target => target.order_id === order.id && record.stage_ids.includes(target.stage_id) && (!source.stage_id || target.stage_id === source.stage_id) && target.status !== 'cancelled')) throw new Error('La receta base ya no está activa para los destinos seleccionados.')
}

export function recipeSource(candidate: RecipeCandidate, groupId?: string): ApplicationRecipeSource {
  return { order_id: candidate.order_id, revision: candidate.revision, ...(groupId ? {} : { stage_id: candidate.stage_ids[0] }) }
}
