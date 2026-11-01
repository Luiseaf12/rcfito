import type { ProjectLot, WorkspaceData } from './model'
import {
  buildProductUsage, compareProductQuantity, summarizeProductUsage,
  type ProductUsageFilters, type ProductUsageHistory, type ProductUsageSummary,
} from './product-usage'

export type LotUsageSummary = {
  key: string
  lotId: string
  projectId: string
  agriculturalUnitName: string
  projectName: string
  season: string
  fieldName: string
  name: string
  areaHa: number
  applicationCount: number
  productCount: number
  lastRecordedDate: string
  products: ProductUsageSummary[]
}

export type LotUsageResult = { lots: LotUsageSummary[]; incompleteCount: number }

/** Groups the same validated records as the product dashboard by retained lot identity. */
export function buildLotUsage(data: WorkspaceData, filters: ProductUsageFilters = {}): LotUsageResult {
  const usage = buildProductUsage(data, filters)
  const orders = new Map(data.applicationOrders.map(order => [order.id, order]))
  const projects = new Map(data.projects.map(project => [project.id, project]))
  const agriculturalUnits = new Map(data.catalogs.agricultural_units.map(unit => [unit.id, unit]))
  const fields = new Map(data.catalogs.fields.map(field => [field.id, field]))
  const stages = new Map(data.stages.map(stage => [stage.id, stage]))
  const subdivisions = new Map(data.subdivisions.map(subdivision => [subdivision.id, subdivision]))
  const lots = new Map(data.lots.map(lot => [lot.id, lot]))
  const targetLots = new Map<string, ProjectLot | null>()
  const invalidTargets = new Set<string>()
  const groups = new Map<string, {
    summary: LotUsageSummary
    products: Map<string, { product: ProductUsageSummary; history: ProductUsageHistory[] }>
    targetIds: Set<string>
  }>()

  for (const product of usage.products) {
    for (const history of product.history) {
      if (!targetLots.has(history.targetId)) {
        const order = orders.get(history.orderId)
        const project = order && projects.get(order.project_id)
        const field = order && fields.get(order.field_id)
        const stage = stages.get(history.stageId)
        const subdivision = stage && subdivisions.get(stage.subdivision_id)
        const lot = subdivision && lots.get(subdivision.lot_id)
        const valid = order && project && field && lot
          && agriculturalUnits.has(project.agricultural_unit_id)
          && lot.project_id === order.project_id && lot.field_id === order.field_id
          && field.agricultural_unit_id === project.agricultural_unit_id
          && Number.isFinite(lot.area_ha) && lot.area_ha > 0
        targetLots.set(history.targetId, valid ? lot : null)
        if (!valid) invalidTargets.add(history.targetId)
      }
      const lot = targetLots.get(history.targetId)
      if (!lot) continue
      const key = JSON.stringify([lot.project_id, lot.id])
      let group = groups.get(key)
      if (!group) {
        const project = projects.get(lot.project_id)!
        const field = fields.get(lot.field_id)!
        group = {
          summary: {
            key, lotId: lot.id, projectId: project.id,
            agriculturalUnitName: agriculturalUnits.get(project.agricultural_unit_id)!.name,
            projectName: project.name, season: project.season,
            fieldName: lot.field_name_snapshot ?? field.name, name: lot.name, areaHa: lot.area_ha,
            applicationCount: 0, productCount: 0, lastRecordedDate: '', products: [],
          },
          products: new Map(), targetIds: new Set(),
        }
        groups.set(key, group)
      }
      let productGroup = group.products.get(product.key)
      if (!productGroup) {
        productGroup = { product, history: [] }
        group.products.set(product.key, productGroup)
      }
      productGroup.history.push(history)
      group.targetIds.add(history.targetId)
      if (history.recordDate > group.summary.lastRecordedDate) group.summary.lastRecordedDate = history.recordDate
    }
  }

  const summaries = [...groups.values()].map(group => {
    group.summary.applicationCount = group.targetIds.size
    group.summary.products = [...group.products.values()]
      .map(({ product, history }) => summarizeProductUsage(product, history))
      .sort(compareProductQuantity)
    group.summary.productCount = new Set(group.summary.products.map(product => product.productId)).size
    return group.summary
  }).sort((a, b) => a.agriculturalUnitName.localeCompare(b.agriculturalUnitName, 'es-MX')
    || a.fieldName.localeCompare(b.fieldName, 'es-MX') || a.name.localeCompare(b.name, 'es-MX', { numeric: true })
    || a.key.localeCompare(b.key))

  return { lots: summaries, incompleteCount: usage.incompleteCount + invalidTargets.size }
}
