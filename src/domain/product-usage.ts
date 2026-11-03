import { createUsageLotResolver } from './usage-lot'
import { indicationForTarget } from './application-editing'
import type { ApplicationTarget, ProductLine, WorkspaceData } from './model'

export type ProductUsageFilters = {
  agriculturalUnitId?: string
  lotId?: string
  cropId?: string
  stageNumber?: number
  status?: ApplicationTarget['status'] | 'all'
}

export type ProductUsageHistory = {
  targetId: string
  stageId: string
  productName: string
  orderId: string
  folio: string
  recordDate: string
  status: ApplicationTarget['status']
  source: 'actual' | 'indication'
  agriculturalUnitName: string
  projectName: string
  season: string
  fieldName: string
  lotName: string
  subdivisionName: string
  stageNumber: number
  cropName: string
  areaHa: number
  dose: number
  quantity: number
}

export type ProductUsageSummary = {
  key: string
  productId: string
  name: string
  unit: 'g' | 'ml'
  applicationCount: number
  totalQuantity: number
  accumulatedAreaHa: number
  averageDose: number
  lastRecordedDate: string
  destinationCount: number
  history: ProductUsageHistory[]
}

export type ProductUsageResult = {
  products: ProductUsageSummary[]
  applicationCount: number
  liquidMl: number
  solidG: number
  incompleteCount: number
}

const positive = (value: number) => Number.isFinite(value) && value > 0
const productKey = (product: ProductLine) => JSON.stringify([product.product_id, product.unit])

/** Quantity order follows the displayed L/kg number without combining units. */
export function compareProductQuantity(a: ProductUsageSummary, b: ProductUsageSummary, direction: 'ascending' | 'descending' = 'ascending'): number {
  const difference = a.totalQuantity / 1000 - b.totalQuantity / 1000
  return (direction === 'descending' ? -difference : difference)
    || a.name.localeCompare(b.name, 'es-MX') || a.key.localeCompare(b.key)
}

/** Recomputes a product from a validated subset without changing its snapshots. */
export function summarizeProductUsage(
  product: Pick<ProductUsageSummary, 'key' | 'productId' | 'unit'>,
  records: ProductUsageHistory[],
): ProductUsageSummary {
  const history = [...records].sort((a, b) => b.recordDate.localeCompare(a.recordDate) || a.targetId.localeCompare(b.targetId))
  const totalQuantity = history.reduce((sum, record) => sum + record.quantity, 0)
  const accumulatedAreaHa = history.reduce((sum, record) => sum + record.areaHa, 0)
  return {
    ...product, name: history[0]?.productName ?? '',
    applicationCount: new Set(history.map(record => record.targetId)).size,
    totalQuantity, accumulatedAreaHa, averageDose: accumulatedAreaHa ? totalQuantity / accumulatedAreaHa : 0,
    lastRecordedDate: history[0]?.recordDate ?? '',
    destinationCount: new Set(history.map(record => record.stageId)).size,
    history,
  }
}

function validDate(value: string | null): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

function validProducts(products: ProductLine[], area: number) {
  if (!Array.isArray(products) || products.length === 0) return false
  const seen = new Set<string>()
  return products.every(product => {
    if (!product || !product.product_id?.trim() || !product.product_name?.trim()
      || !['g', 'ml'].includes(product.unit) || !positive(product.dose)
      || !Number.isFinite(product.dose * area)) return false
    const key = productKey(product)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/** Uses each saved destination's current actual or retained indication snapshot. */
export function buildProductUsage(data: WorkspaceData, filters: ProductUsageFilters = {}): ProductUsageResult {
  const projects = new Map(data.projects.filter(project => !filters.agriculturalUnitId
    || project.agricultural_unit_id === filters.agriculturalUnitId)
    .map(project => [project.id, project]))
  const orders = new Map(data.applicationOrders.map(order => [order.id, order]))
  const agriculturalUnits = new Map(data.catalogs.agricultural_units.map(unit => [unit.id, unit.name]))
  const fields = new Map(data.catalogs.fields.map(field => [field.id, field.name]))
  const groups = new Map<string, { key: string; productId: string; unit: ProductLine['unit']; history: ProductUsageHistory[] }>()
  const countedTargets = new Set<string>()
  const resolveLot = filters.lotId ? createUsageLotResolver(data) : undefined
  let incompleteCount = 0

  for (const target of data.applicationTargets) {
    if (countedTargets.has(target.id)
      || (filters.status && filters.status !== 'all' && target.status !== filters.status)) continue
    const order = orders.get(target.order_id)
    const project = order && projects.get(order.project_id)
    if (!order || !project || (filters.cropId && order.crop_id !== filters.cropId)
      || (filters.stageNumber !== undefined && target.stage_number !== filters.stageNumber)) continue

    if (filters.lotId && resolveLot?.(order, target.stage_id)?.id !== filters.lotId) continue

    if (!target.id || !target.stage_id || !Number.isInteger(target.stage_number) || target.stage_number < 1
      || !['indicated', 'performed', 'cancelled'].includes(target.status) || !positive(target.area_ha)) {
      incompleteCount++
      continue
    }

    let products: ProductLine[], recordDate: string | null
    const source = target.status === 'performed' ? 'actual' : 'indication'
    if (target.status === 'performed') {
      products = target.actual_products
      recordDate = target.actual_date
    } else {
      try {
        const indication = indicationForTarget(data, order, target)
        products = indication.products
        recordDate = indication.indicated_date
      } catch {
        incompleteCount++
        continue
      }
    }
    if (!validDate(recordDate) || !validProducts(products, target.area_ha)) {
      incompleteCount++
      continue
    }

    countedTargets.add(target.id)
    for (const product of products) {
      const key = productKey(product)
      let group = groups.get(key)
      if (!group) {
        group = { key, productId: product.product_id, unit: product.unit, history: [] }
        groups.set(key, group)
      }
      const history: ProductUsageHistory = {
        targetId: target.id, stageId: target.stage_id, productName: product.product_name,
        orderId: order.id, folio: order.folio, recordDate, status: target.status, source,
        agriculturalUnitName: agriculturalUnits.get(project.agricultural_unit_id) ?? 'Agrícola no disponible',
        projectName: order.project_name ?? project.name, season: project.season,
        fieldName: order.field_name ?? fields.get(order.field_id) ?? 'Campo no disponible',
        lotName: target.lot_name, subdivisionName: target.subdivision_name, stageNumber: target.stage_number,
        cropName: target.crop_name, areaHa: target.area_ha, dose: product.dose,
        quantity: product.dose * target.area_ha,
      }
      group.history.push(history)
    }
  }

  const products = [...groups.values()].map(group => summarizeProductUsage(group, group.history))
    .sort((a, b) => b.applicationCount - a.applicationCount || a.name.localeCompare(b.name, 'es-MX') || a.key.localeCompare(b.key))

  return {
    products, applicationCount: countedTargets.size, incompleteCount,
    liquidMl: products.filter(product => product.unit === 'ml').reduce((sum, product) => sum + product.totalQuantity, 0),
    solidG: products.filter(product => product.unit === 'g').reduce((sum, product) => sum + product.totalQuantity, 0),
  }
}
