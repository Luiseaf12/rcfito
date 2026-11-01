import { currentOrderIndication, indicationForTarget } from '../domain/application-editing'
import type { ApplicationActualSnapshot, WorkspaceData } from '../domain/model'

/** Parallel REST reads must agree before exposing a version to an editor. */
export function reconcileApplicationHistory(data: WorkspaceData): void {
  const inconsistent = () => { throw new Error('La información cambió durante la consulta. Actualiza para cargar una versión completa del historial.') }
  const orders = new Map(data.applicationOrders.map(order => [order.id,order]))
  for (const order of data.applicationOrders) currentOrderIndication(data,order)
  for (const target of data.applicationTargets) {
    const order = orders.get(target.order_id)
    if (!order) return inconsistent()
    indicationForTarget(data,order,target)
    const change = target.indication_change_id ? data.applicationChanges.find(item=>item.id===target.indication_change_id) : undefined
    if (target.status==='indicated' && (change?.version??0)!==(order.revision??0)) return inconsistent()
    const corrections = data.applicationChanges.filter(item=>item.kind==='performance'&&item.target_id===target.id)
    const latest = corrections.reduce<typeof corrections[number]|undefined>((current,item)=>!current||item.version>current.version?item:current,undefined)
    if ((latest?.version??0)!==(target.correction_version??0)) return inconsistent()
    if (latest) {
      if (latest.order_id!==order.id||!latest.target_ids.includes(target.id)||!('actual_date' in latest.after)||target.status!=='performed') return inconsistent()
      const snapshot = latest.after as ApplicationActualSnapshot
      target.actual_date=snapshot.actual_date;target.actual_water_l_ha=snapshot.water_l_ha
      target.actual_products=structuredClone(snapshot.products);target.actual_observations=snapshot.observations
      target.equipment=snapshot.equipment;target.applicator=snapshot.applicator;target.has_changes=snapshot.has_changes
    }
    if (target.status==='performed'&&!target.actual_products.length) return inconsistent()
  }
}
