import type { ApplicationOrder, ProjectLot, WorkspaceData } from './model'

/** Resolve retained lot identity without inferring it from a snapshot name. */
export function createUsageLotResolver(data: WorkspaceData) {
  const projects = new Map(data.projects.map(row => [row.id, row]))
  const fields = new Map(data.catalogs.fields.map(row => [row.id, row]))
  const agriculturalUnits = new Set(data.catalogs.agricultural_units.map(row => row.id))
  const stages = new Map(data.stages.map(row => [row.id, row]))
  const subdivisions = new Map(data.subdivisions.map(row => [row.id, row]))
  const lots = new Map(data.lots.map(row => [row.id, row]))
  return (order: ApplicationOrder, stageId: string): ProjectLot | undefined => {
    const project = projects.get(order.project_id)
    const field = fields.get(order.field_id)
    const stage = stages.get(stageId)
    const subdivision = stage && subdivisions.get(stage.subdivision_id)
    const lot = subdivision && lots.get(subdivision.lot_id)
    const valid = project && field && lot
      && agriculturalUnits.has(project.agricultural_unit_id)
      && lot.project_id === order.project_id && lot.field_id === order.field_id
      && field.agricultural_unit_id === project.agricultural_unit_id
      && Number.isFinite(lot.area_ha) && lot.area_ha > 0
    return valid ? lot : undefined
  }
}
