import { currentOrderIndication } from './application-editing.ts'
import type { ApplicationOrderInput, ApplicationRecipeSource, WorkspaceData } from './model'

export type RecipeCandidate = { order_id: string; stage_ids: string[]; revision: number; indicated_date: string }

/** Latest active indication per current stage; group history requires explicit origin. */
export function recipeCandidates(data: WorkspaceData, stageIds: string[], groupId?: string): RecipeCandidate[] {
  const candidates = new Map<string, RecipeCandidate>()
  const orders = data.applicationOrders.filter(order => !groupId || order.selection_origin === 'group' && order.source_group_id === groupId)
  const latest = (ids: string[]) => {
    const active = orders.filter(order => data.applicationTargets.some(target => target.order_id === order.id && ids.includes(target.stage_id) && target.status !== 'cancelled'))
      .map(order => ({ order, indication: currentOrderIndication(data, order) }))
    const date = active.reduce((max, item) => item.indication.indicated_date > max ? item.indication.indicated_date : max, '')
    for (const { order, indication } of active.filter(item => item.indication.indicated_date === date)) {
      const stages = ids.filter(id => data.applicationTargets.some(target => target.order_id === order.id && target.stage_id === id && target.status !== 'cancelled'))
      const previous = candidates.get(order.id)
      candidates.set(order.id, { order_id: order.id, revision: order.revision ?? 0, indicated_date: indication.indicated_date, stage_ids: [...new Set([...(previous?.stage_ids ?? []), ...stages])].sort() })
    }
  }
  if (groupId) latest(stageIds)
  else stageIds.forEach(id => latest([id]))
  return [...candidates.values()].sort((a, b) => b.indicated_date.localeCompare(a.indicated_date) || a.order_id.localeCompare(b.order_id))
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
