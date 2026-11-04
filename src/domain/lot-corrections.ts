import type { LotCorrectionInput, LotCorrectionSnapshot, UserProfile, WorkspaceData } from './model'

const fail = (message: string): never => { throw new Error(message) }
const validDate = (value: string | undefined) => Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T12:00:00Z`)) && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value)
const signature = (value: LotCorrectionInput | undefined) => value && JSON.stringify(Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined).sort(([a], [b]) => a.localeCompare(b))))

export function lotCorrectionContext(data: WorkspaceData, lotId: string) {
  const lot = data.lots.find(row => row.id === lotId) ?? fail('No se encontró la malla.')
  const project = data.projects.find(row => row.id === lot.project_id) ?? fail('No se encontró el proyecto.')
  const subdivisions = data.subdivisions.filter(row => row.lot_id === lot.id)
  const ids = new Set(subdivisions.map(row => row.id))
  const stages = data.stages.filter(row => ids.has(row.subdivision_id))
  const stageIds = new Set(stages.map(row => row.id))
  const orders = new Set(data.applicationOrders.filter(row => row.project_id === project.id).map(row => row.id))
  const targets = data.applicationTargets.filter(row => stageIds.has(row.stage_id) && orders.has(row.order_id))
  const current = stages.filter(row => row.status === 'planted' && subdivisions.some(sub => sub.id === row.subdivision_id && sub.active))
  return { lot, project, subdivisions, stages, targets, current, simple: subdivisions.length === 1 && subdivisions[0].active }
}

export function applyLotCorrection(data: WorkspaceData, input: LotCorrectionInput, profile: UserProfile, now = new Date().toISOString()): void {
  if (profile.role !== 'admin') fail('Solo la administración puede corregir una malla.')
  if (Object.keys(input).some(key => !['id','lot_id','expected_version','name','area_ha','stage_id','planned_sowing_date','actual_sowing_date','reason'].includes(key))) fail('La corrección contiene campos no editables.')
  if (!input.id || !input.reason?.trim() || input.reason.trim().length > 4000) fail('Captura un motivo de corrección válido, de hasta 4,000 caracteres.')
  const previous = data.lotCorrections?.find(row => row.id === input.id)
  if (previous) {
    if (signature(previous.request) === signature(input)) return
    fail('El identificador ya pertenece a otra corrección.')
  }
  const context = lotCorrectionContext(data, input.lot_id)
  const { lot, project, subdivisions, stages, targets, current, simple } = context
  if (project.status === 'closed' || lot.active === false) fail('Solo se corrige una malla vigente de un proyecto abierto.')
  if (!Number.isInteger(input.expected_version) || input.expected_version !== (lot.correction_version ?? 0)) fail('La malla cambió. Actualiza los datos y revisa la corrección.')
  const name = input.name?.trim()
  if (!name || name.length > 200) fail('Captura un nombre de hasta 200 caracteres.')
  if (data.lots.some(row => row.id !== lot.id && row.project_id === lot.project_id && row.name.trim().toLocaleLowerCase('es-MX') === name.toLocaleLowerCase('es-MX'))) fail('Ya existe una malla con ese nombre en el proyecto.')
  const stage = input.stage_id ? current.find(row => row.id === input.stage_id) : undefined
  if (input.stage_id && !stage) fail('Selecciona una siembra vigente de esta malla.')
  if ((input.planned_sowing_date !== undefined || input.actual_sowing_date !== undefined) && !stage) fail('Las fechas solo se corrigen en la siembra vigente.')
  if (stage && (!validDate(input.planned_sowing_date) || !validDate(input.actual_sowing_date))) fail('Captura las dos fechas de siembra válidas.')
  if (stage && input.actual_sowing_date !== stage.actual_sowing_date) {
    const previousEnd = stages.filter(row => row.subdivision_id === stage.subdivision_id && row.stage_number < stage.stage_number && row.closed_at).map(row => row.closed_at!).sort().at(-1)
    if (previousEnd && input.actual_sowing_date! < previousEnd) fail('La fecha real no puede preceder el cierre de la etapa anterior.')
    const stageTargets = targets.filter(row => row.stage_id === stage.id)
    const dates = stageTargets.flatMap(target => {
      const order = data.applicationOrders.find(row => row.id === target.order_id)!
      const changes = data.applicationChanges.filter(row => row.order_id === order.id && (row.target_id === target.id || row.target_ids.includes(target.id)))
      return [order.indicated_date, ...(target.actual_date ? [target.actual_date] : []), ...changes.flatMap(change => [change.before, change.after].map(snapshot => 'indicated_date' in snapshot ? snapshot.indicated_date : snapshot.actual_date))]
    }).sort()
    if (dates[0] && input.actual_sowing_date! > dates[0]) fail(`La fecha real no puede ser posterior a una aplicación registrada (${dates[0]}).`)
  }
  if (input.area_ha !== undefined) {
    if (!simple || current.length !== 1 || !stage) fail('La corrección conjunta de superficie requiere una subdivisión única y su siembra vigente; no se ajustan repartos automáticamente.')
    if (!Number.isFinite(input.area_ha) || input.area_ha <= 0 || input.area_ha >= 100000000 || Math.abs(input.area_ha * 10000 - Math.round(input.area_ha * 10000)) > 0.00001) fail('La superficie debe ser positiva y tener como máximo cuatro decimales.')
    if (stages.some(row => row.id !== stage!.id && row.status !== 'closed' && row.area_ha > input.area_ha!)) fail('Una etapa planeada excede la superficie corregida. Corrige primero esa planeación.')
  }
  const snapshot = (): LotCorrectionSnapshot => ({
    lot: { id: lot.id, name: lot.name, area_ha: lot.area_ha, correction_version: lot.correction_version ?? 0 },
    subdivisions: input.area_ha === undefined ? [] : subdivisions.map(row => ({ id: row.id, area_ha: row.area_ha })),
    stages: stage ? [{ id: stage.id, area_ha: stage.area_ha, planned_sowing_date: stage.planned_sowing_date, actual_sowing_date: stage.actual_sowing_date, status: stage.status }] : [],
    targets: input.area_ha === undefined ? [] : targets.map(row => ({ id: row.id, area_ha: row.area_ha, status: row.status, area_correction_id: row.area_correction_id ?? null })),
  })
  const before = snapshot()
  const changed = lot.name !== name || input.area_ha !== undefined && (lot.area_ha !== input.area_ha || stage?.area_ha !== input.area_ha || targets.some(row => row.area_ha !== input.area_ha)) || stage && (stage.planned_sowing_date !== input.planned_sowing_date || stage.actual_sowing_date !== input.actual_sowing_date)
  if (!changed) fail('No hay cambios para registrar.')
  lot.name = name
  lot.correction_version = (lot.correction_version ?? 0) + 1
  if (stage) { stage.planned_sowing_date = input.planned_sowing_date!; stage.actual_sowing_date = input.actual_sowing_date! }
  if (input.area_ha !== undefined) {
    lot.area_ha = input.area_ha
    subdivisions[0].area_ha = input.area_ha
    stage!.area_ha = input.area_ha
    targets.forEach(target => { target.area_ha = input.area_ha!; target.area_correction_id = input.id })
  }
  data.lotCorrections ??= []
  data.lotCorrections.push({ id: input.id, lot_id: lot.id, version: lot.correction_version, reason: input.reason.trim(), changed_by: profile.id, changed_by_name: profile.full_name, changed_at: now, before, after: snapshot(), request: structuredClone(input) })
}

/** REST reads may straddle a correction transaction; reject mismatched versions. */
export function reconcileLotCorrections(data: WorkspaceData): void {
  for (const target of data.applicationTargets) {
    if (!target.area_correction_id) continue
    const change = data.lotCorrections?.find(row => row.id === target.area_correction_id)
    const after = change?.after.targets.find(row => row.id === target.id)
    if (!after || after.area_ha !== target.area_ha) fail('La superficie cambió durante la consulta. Actualiza los datos.')
  }
  for (const lot of data.lots) {
    if (!lot.correction_version) continue
    const change = data.lotCorrections?.find(row => row.lot_id === lot.id && row.version === lot.correction_version)
    if (!change || change.after.lot.name !== lot.name || change.after.lot.area_ha !== lot.area_ha) fail('La malla cambió durante la consulta. Actualiza los datos.')
    for (const stage of change!.after.stages) {
      const current = data.stages.find(row => row.id === stage.id)
      if (current && (current.area_ha !== stage.area_ha || current.planned_sowing_date !== stage.planned_sowing_date || current.actual_sowing_date !== stage.actual_sowing_date)) fail('La siembra cambió durante la consulta. Actualiza los datos.')
    }
    for (const target of change!.after.targets) {
      const current = data.applicationTargets.find(row => row.id === target.id)
      if (current && (current.area_ha !== target.area_ha || current.area_correction_id !== change!.id)) fail('Las recetas cambiaron durante la consulta. Actualiza los datos.')
    }
  }
}
