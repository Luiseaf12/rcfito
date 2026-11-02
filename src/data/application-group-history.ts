import type { ApplicationOrder, ApplicationSelectionOrigin, ApplicationTarget } from '@/domain/model'

export function readOrderGroupHistory(row: Record<string, unknown>): Pick<ApplicationOrder, 'selection_origin' | 'source_group_id' | 'source_group_name'> {
  const origin = row.selection_origin ?? 'unknown'
  if (!['unknown', 'group', 'individual', 'manual'].includes(String(origin))) throw new Error('No se pudo verificar el origen de la aplicación.')
  if (origin === 'group' && (typeof row.source_group_id !== 'string' || typeof row.source_group_name !== 'string')) throw new Error('Falta la referencia histórica del grupo de la aplicación.')
  return { selection_origin: origin as ApplicationSelectionOrigin, source_group_id: typeof row.source_group_id === 'string' ? row.source_group_id : null, source_group_name: typeof row.source_group_name === 'string' ? row.source_group_name : null }
}

export function readTargetGroupHistory(row: Record<string, unknown>): Pick<ApplicationTarget, 'group_memberships_snapshot'> {
  const value = row.group_memberships_snapshot
  if (value == null) return { group_memberships_snapshot: null }
  if (!Array.isArray(value) || value.some(item => !item || typeof item.id !== 'string' || typeof item.name !== 'string')) throw new Error('No se pudo verificar la pertenencia histórica del destino.')
  return { group_memberships_snapshot: value.map(item => ({ id: item.id as string, name: item.name as string })) }
}
