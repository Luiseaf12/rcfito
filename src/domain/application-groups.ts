import type { ApplicationGroupSnapshot, ApplicationOrder, ApplicationOrderInput, ApplicationTarget, SowingGroup, WorkspaceData } from './model'

function sameContext(group: SowingGroup, order: Pick<ApplicationOrder, 'project_id' | 'field_id' | 'crop_id'>) {
  return group.project_id === order.project_id && group.field_id === order.field_id && group.crop_id === order.crop_id
}

export function eligibleGroupStages(data: WorkspaceData, group: SowingGroup): string[] {
  return group.stage_ids.filter(id => {
    const stage = data.stages.find(item => item.id === id)
    const subdivision = data.subdivisions.find(item => item.id === stage?.subdivision_id)
    const lot = data.lots.find(item => item.id === subdivision?.lot_id)
    return stage?.status === 'planted' && subdivision?.active && lot && lot.active !== false && lot.project_id === group.project_id && lot.field_id === group.field_id && stage.crop_id === group.crop_id
  }).sort()
}

// This is demo validation. The real adapter delegates the same rule to the RPC.
export function applicationGroupOrigin(data: WorkspaceData, record: ApplicationOrderInput): Pick<ApplicationOrder, 'selection_origin' | 'source_group_id' | 'source_group_name'> {
  if (record.source_group_id != null) {
    const group = data.sowingGroups.find(item => item.id === record.source_group_id)
    if (!group?.active || !sameContext(group, record)) throw new Error('Selecciona un grupo activo del mismo proyecto, campo y cultivo.')
    const eligible = eligibleGroupStages(data, group)
    if (!eligible.length || JSON.stringify(eligible) !== JSON.stringify([...record.stage_ids].sort())) throw new Error('Revisa el grupo: deben incluirse todos sus destinos vigentes. Para ajustar destinos, usa selección manual.')
    return { selection_origin: 'group', source_group_id: group.id, source_group_name: group.name }
  }
  const lotIds = new Set(record.stage_ids.map(id => {
    const stage = data.stages.find(item => item.id === id)
    return data.subdivisions.find(item => item.id === stage?.subdivision_id)?.lot_id
  }))
  return { selection_origin: lotIds.size === 1 ? 'individual' : 'manual', source_group_id: null, source_group_name: null }
}

export function groupMembershipsAtCreation(data: WorkspaceData, order: ApplicationOrderInput, stageId: string): ApplicationGroupSnapshot[] {
  return data.sowingGroups.filter(group => group.active && sameContext(group, order) && group.stage_ids.includes(stageId))
    .map(group => ({ id: group.id, name: group.name })).sort((a, b) => a.id.localeCompare(b.id))
}

export function applicationOriginLabel(order: ApplicationOrder): string {
  switch (order.selection_origin) {
    case 'group': return `Todo el grupo · ${order.source_group_name ?? 'Grupo de origen'}`
    case 'individual': return 'Individual · un solo lote'
    case 'manual': return 'Selección manual · varios lotes'
    default: return 'Grupo de origen no registrado'
  }
}

export function targetGroupMembershipLabel(target: ApplicationTarget): string {
  if (target.group_memberships_snapshot == null) return 'Pertenencia al registrar: no registrada'
  return target.group_memberships_snapshot.length ? `Pertenecía a: ${target.group_memberships_snapshot.map(group => group.name).join(', ')}` : 'Sin grupos activos al registrar'
}
